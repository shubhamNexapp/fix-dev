const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/authRoutes");

// Import models
const Provider = require("./models/provider");
const ServiceRequest = require("./models/serviceRequest");

// Import location utilities
const { 
  calculateDistance, 
  validateCoordinates, 
  PROXIMITY_CONFIG,
} = require("./utils/locationUtils");

// ETA utility functions
const isToday = (date) => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const formatTimeForDisplay = (isoString) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  } catch (error) {
    console.warn('Error formatting time:', error);
    return 'Invalid time';
  }
};

const calculateDurationFromNow = (isoString) => {
  try {
    const targetTime = new Date(isoString);
    const now = new Date();
    const diffMs = targetTime.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Now';
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  } catch (error) {
    console.warn('Error calculating duration:', error);
    return 'Unknown';
  }
};

const processETAData = (estimatedTime, estimatedTimeFormatted, estimatedDuration) => {
  console.log('🔧 Processing ETA - Input data:', {
    estimatedTime,
    estimatedTimeFormatted,
    estimatedDuration
  });
  
  // Handle new structured format - PASS THROUGH AS-IS (no timezone conversion)
  if (estimatedTime && estimatedTimeFormatted && estimatedDuration) {
    const result = {
      completionTime: estimatedTime,           // Pass through frontend ISO string as-is
      displayTime: estimatedTimeFormatted,     // Pass through frontend formatted time as-is  
      timeFromNow: estimatedDuration,          // Pass through frontend duration as-is
      isToday: true                            // Always true for India operations
    };
    console.log('✅ Using new format (pass-through):', result);
    return result;
  }
  
  // Handle legacy format (just estimatedTime as duration string)
  if (estimatedTime && typeof estimatedTime === 'string') {
    const result = {
      completionTime: null,
      displayTime: null,
      timeFromNow: estimatedTime,              // Pass through legacy duration as-is
      isToday: true
    };
    console.log('✅ Using legacy format:', result);
    return result;
  }
  
  // Fallback
  const result = {
    completionTime: null,
    displayTime: 'TBD',
    timeFromNow: 'Unknown',
    isToday: true
  };
  console.log('⚠️ Using fallback format:', result);
  return result;
};

// Service categories constant
const ALLOWED_SERVICE_CATEGORIES = ["plumber", "electrician", "carpenter", "painter", "ac_repair", "cleaning"];

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: "*", // Configure this with your frontend URL in production
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to database
connectDB();

// In-memory maps for Socket.IO
const connectedUsers = new Map(); // userId -> socketId
const connectedProviders = new Map(); // providerId -> socketId
const activeRequests = new Map(); // requestId -> request data
const userLocations = new Map(); // userId -> { latitude, longitude, timestamp }
const activeSearchIntervals = new Map(); // requestId -> { interval, timeout }
const userActiveRequests = new Map(); // userId -> requestId
const requestProviders = new Map(); // requestId -> Set of provider IDs who received the request

// Function to cancel existing search for a user
const cancelExistingSearch = (userId) => {
  const existingRequestId = userActiveRequests.get(userId);
  if (existingRequestId) {
    console.log(`🚫 Cancelling existing search for user ${userId}, request ${existingRequestId}`);
    
    // Clean up search intervals
    const searchData = activeSearchIntervals.get(existingRequestId);
    if (searchData) {
      clearInterval(searchData.interval);
      clearTimeout(searchData.timeout);
      searchData.stopSearch();
      activeSearchIntervals.delete(existingRequestId);
    }
    
    // Remove from active requests
    activeRequests.delete(existingRequestId);
    userActiveRequests.delete(userId);
    
    console.log(`✅ Cancelled existing search for user ${userId}`);
  }
};

// Utility function for validating socket data
const validateSocketData = (data, requiredFields) => {
  const missing = requiredFields.filter(field => !data[field]);
  return missing.length === 0 ? null : missing;
};

// Proximity-based provider finding function
const findNearbyProviders = async (userLocation, serviceType, radiusKm = PROXIMITY_CONFIG.DEFAULT_RADIUS_KM) => {
  const nearbyProviders = [];
  
  console.log(`🔍 Searching for ${serviceType} providers within ${radiusKm}km of user location:`, userLocation);
  
  for (const [providerId, providerSocketId] of connectedProviders) {
    try {
      const provider = await Provider.findById(providerId);
      
      if (!provider) {
        console.log(`⏭️ Provider ${providerId} not found in database`);
        continue;
      }
      
      // Check service category compatibility
      const hasServiceCategory = provider.serviceCategories && provider.serviceCategories.length > 0 
        ? provider.serviceCategories.includes(serviceType)
        : true;
        
      if (!hasServiceCategory) {
        console.log(`⏭️ Provider ${providerId} doesn't offer ${serviceType} service`);
        continue;
      }
      
      // Check availability and online status
      if (provider.isAvailable === false) {
        console.log(`⏭️ Provider ${providerId} is not available`);
        continue;
      }

      // Use best available location (prioritize live location, fallback to static)
      let providerLat = null;
      let providerLng = null;
      let locationSource = 'none';

      // Debug logging for provider location data
      console.log(`🔍 Provider ${providerId} location data:`, {
        hasCurrentLocation: !!(provider.currentLocation?.lat && provider.currentLocation?.lng),
        currentLocation: provider.currentLocation,
        hasStaticLocation: !!(provider.location?.latitude && provider.location?.longitude),
        staticLocation: provider.location,
        isOnline: provider.isOnline
      });

      if (provider.currentLocation && provider.currentLocation.lat && provider.currentLocation.lng) {
        providerLat = provider.currentLocation.lat;
        providerLng = provider.currentLocation.lng;
        locationSource = provider.isOnline ? 'live_online' : 'live_offline';
      } else if (provider.location && provider.location.latitude && provider.location.longitude) {
        providerLat = provider.location.latitude;
        providerLng = provider.location.longitude;
        locationSource = 'static';
      }
      
      // Check location proximity
      if (providerLat && providerLng) {
        const distance = calculateDistance(
          userLocation.latitude, userLocation.longitude,
          providerLat, providerLng
        );
        
        if (distance <= radiusKm) {
          nearbyProviders.push({
            providerId,
            providerSocketId,
            provider,
            distance: Math.round(distance * 100) / 100,
            locationSource,
            isOnline: provider.isOnline || false
          });
          console.log(`✅ Provider ${providerId} found at ${distance}km (${provider.name || 'Unnamed'}) [${locationSource} location, ${provider.isOnline ? 'online' : 'offline'}]`);
        } else {
          console.log(`⏭️ Provider ${providerId} too far: ${distance}km > ${radiusKm}km`);
        }
      } else {
        console.log(`⏭️ Provider ${providerId} skipped - no location data`);
      }
    } catch (error) {
      console.error(`❌ Error checking provider ${providerId}:`, error);
    }
  }
  
  // Sort by online status first, then by distance
  nearbyProviders.sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  });
  
  // Limit to maximum providers per request
  const limitedProviders = nearbyProviders.slice(0, PROXIMITY_CONFIG.MAX_PROVIDERS_PER_REQUEST);
  
  console.log(`📊 Found ${nearbyProviders.length} providers (${nearbyProviders.filter(p => p.isOnline).length} online), limited to ${limitedProviders.length}`);
  
  return limitedProviders;
};

// Notify nearby users when a provider moves
const notifyNearbyUsers = async (providerId, providerLocation) => {
  try {
    const provider = await Provider.findById(providerId);
    if (!provider || !provider.isOnline) {
      return;
    }

    for (const [requestId, requestData] of activeRequests) {
      if (requestData.status !== 'pending') {
        continue;
      }

      if (!provider.serviceCategories.includes(requestData.serviceType)) {
        continue;
      }

      const distance = calculateDistance(
        requestData.location.latitude, requestData.location.longitude,
        providerLocation.lat, providerLocation.lng
      );

      if (distance <= PROXIMITY_CONFIG.DEFAULT_RADIUS_KM) {
        const userSocketId = connectedUsers.get(requestData.userId);
        if (userSocketId) {
          io.to(userSocketId).emit('newProviderInRange', {
            provider: {
              id: providerId,
              name: provider.name || 'Service Provider',
              services: provider.serviceCategories,
              location: {
                lat: providerLocation.lat,
                lng: providerLocation.lng
              },
              distance: Math.round(distance * 100) / 100,
              rating: provider.rating || 0
            },
            userLocation: requestData.location,
            requestId: requestId
          });
          console.log(`📱 Notified user ${requestData.userId} of new provider ${providerId} in range (${distance}km)`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error notifying nearby users:', error);
  }
};

// Update proximity search results when provider status changes
const updateProximitySearchResults = async (providerId, isOnline) => {
  try {
    for (const [requestId, requestData] of activeRequests) {
      if (requestData.status !== 'pending') {
        continue;
      }

      const provider = await Provider.findById(providerId);
      if (!provider || !provider.serviceCategories.includes(requestData.serviceType)) {
        continue;
      }

      let distance = null;
      let providerLat = null;
      let providerLng = null;

      if (provider.currentLocation && provider.currentLocation.lat && provider.currentLocation.lng) {
        providerLat = provider.currentLocation.lat;
        providerLng = provider.currentLocation.lng;
      } else if (provider.location && provider.location.latitude && provider.location.longitude) {
        providerLat = provider.location.latitude;
        providerLng = provider.location.longitude;
      }

      if (providerLat && providerLng) {
        distance = calculateDistance(
          requestData.location.latitude, requestData.location.longitude,
          providerLat, providerLng
        );
      }

      const userSocketId = connectedUsers.get(requestData.userId);
      if (userSocketId) {
        if (isOnline && distance && distance <= PROXIMITY_CONFIG.MAX_RADIUS_KM) {
          io.to(userSocketId).emit('providerStatusChanged', {
            providerId: providerId,
            status: 'online',
            distance: distance ? Math.round(distance * 100) / 100 : null,
            provider: {
              id: providerId,
              name: provider.name || 'Service Provider',
              rating: provider.rating || 0
            },
            requestId: requestId
          });
          console.log(`📱 Notified user ${requestData.userId} that provider ${providerId} came online`);
        } else if (!isOnline) {
          io.to(userSocketId).emit('providerStatusChanged', {
            providerId: providerId,
            status: 'offline',
            distance: distance ? Math.round(distance * 100) / 100 : null,
            requestId: requestId
          });
          console.log(`📱 Notified user ${requestData.userId} that provider ${providerId} went offline`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error updating proximity search results:', error);
  }
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  // Handle user/provider registration
  socket.on('register', (data) => {
    const missing = validateSocketData(data, ['userId', 'userType']);
    if (missing) {
      socket.emit('error', {
        message: 'Missing required fields',
        missing
      });
      return;
    }

    const { userId, userType } = data;
    
    if (userType === 'user') {
      connectedUsers.set(userId, socket.id);
      console.log(`👤 User ${userId} registered with socket ${socket.id}`);
    } else if (userType === 'provider') {
      connectedProviders.set(userId, socket.id);
      console.log(`🔧 Provider ${userId} registered with socket ${socket.id}`);
    } else {
      socket.emit('error', {
        message: 'Invalid userType. Must be "user" or "provider"'
      });
      return;
    }
    
    socket.userId = userId;
    socket.userType = userType;

    socket.emit('registered', {
      success: true,
      userId,
      userType,
      message: `Successfully registered as ${userType}`
    });
  });

  // Handle location updates
  socket.on('locationUpdate', (data) => {
    const missing = validateSocketData(data, ['userId', 'latitude', 'longitude']);
    if (missing) {
      socket.emit('error', {
        message: 'Missing required fields for location update',
        missing
      });
      return;
    }

    const { userId, latitude, longitude, timestamp } = data;
    console.log(`📍 Location update from ${userId}: ${latitude}, ${longitude}`);
    
    userLocations.set(userId, { 
      latitude, 
      longitude, 
      timestamp: timestamp || new Date() 
    });
  });

  // Handle service requests from users
  socket.on('serviceRequest', async (data) => {
    console.log('🚨 Service request received:', data);
    
    if (data.userId) {
      cancelExistingSearch(data.userId);
    }
    
    const requiredFields = ['requestId', 'userId', 'serviceType', 'description', 'userLocation'];
    const missing = validateSocketData(data, requiredFields);
    if (missing) {
      console.log('❌ Missing fields in service request:', missing);
      socket.emit('error', {
        message: 'Missing required fields for service request',
        missing
      });
      return;
    }

    const { 
      requestId, 
      userId, 
      serviceType, 
      serviceName,
      serviceIcon,
      serviceDescription,
      description, 
      userLocation, 
      urgency 
    } = data;

    if (!ALLOWED_SERVICE_CATEGORIES.includes(serviceType)) {
      console.log('❌ Invalid service type:', serviceType);
      socket.emit('error', { 
        message: `Invalid service type. Allowed types: ${ALLOWED_SERVICE_CATEGORIES.join(', ')}` 
      });
      return;
    }

    if (!validateCoordinates(userLocation.latitude, userLocation.longitude)) {
      console.log('❌ Invalid user location:', userLocation);
      socket.emit('error', { 
        message: 'Invalid user location coordinates' 
      });
      return;
    }

    if (!connectedUsers.has(userId)) {
      console.log('❌ User not registered:', userId);
      socket.emit('error', { message: 'User not properly registered' });
      return;
    }
    
    const requestData = {
      requestId,
      userId,
      serviceType,
      serviceName: serviceName || serviceType.charAt(0).toUpperCase() + serviceType.slice(1),
      serviceIcon: serviceIcon || '🔧',
      serviceDescription: serviceDescription || `${serviceType} service`,
      description,
      location: userLocation,
      urgency: urgency || 'medium',
      status: 'pending',
      timestamp: new Date(),
      userSocketId: socket.id
    };
    
    activeRequests.set(requestId, requestData);
    console.log(`🚨 New service request ${requestId} from user ${userId} for ${serviceType}`);
    
    try {
      const serviceRequest = new ServiceRequest({
        requestId,
        userId,
        serviceType,
        serviceName: requestData.serviceName,
        serviceIcon: requestData.serviceIcon,
        serviceDescription: requestData.serviceDescription,
        description,
        userLocation, // Keep for backward compatibility
        location: { // Add for new schema requirements
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          address: "", // Optional field
          landmark: "" // Optional field
        },
        urgency: requestData.urgency
      });
      await serviceRequest.save();
      console.log(`💾 Service request ${requestId} saved to database`);
    } catch (dbError) {
      console.error('❌ Error saving request to database:', dbError);
    }
    
    const searchStartTime = Date.now();
    let searchPhase = 1;
    let searchRadius = PROXIMITY_CONFIG.DEFAULT_RADIUS_KM;
    let searchInProgress = true;
    
    console.log(`🎯 Starting progressive proximity search for ${serviceType} providers...`);
    
    socket.emit('serviceRequestConfirmed', {
      requestId,
      searchPhase: 1,
      searchRadius: searchRadius,
      providerCount: 0,
      status: 'searching',
      message: `Searching within ${searchRadius}km radius...`,
      serviceType,
      elapsedTime: 0
    });
    
    const performProgressiveSearch = async () => {
      const elapsedTime = Math.floor((Date.now() - searchStartTime) / 1000);
      
      if (elapsedTime >= PROXIMITY_CONFIG.MAX_SEARCH_TIME_SECONDS) {
        console.log(`⏰ Search timeout after ${elapsedTime}s - no providers found within ${PROXIMITY_CONFIG.MAX_RADIUS_KM}km`);
        socket.emit('searchTimeout', {
          requestId,
          message: `No ${serviceType} providers found within ${PROXIMITY_CONFIG.MAX_RADIUS_KM}km after 2 minutes`,
          searchPhase: 4,
          searchRadius: PROXIMITY_CONFIG.MAX_RADIUS_KM,
          elapsedTime
        });
        searchInProgress = false;
        return;
      }
      
      console.log(`🔍 Phase ${searchPhase}: Searching within ${searchRadius}km... (${elapsedTime}s elapsed)`);
      
      const nearbyProviders = await findNearbyProviders(userLocation, serviceType, searchRadius);
      
      if (nearbyProviders.length > 0) {
        console.log(`✅ Found ${nearbyProviders.length} providers within ${searchRadius}km in phase ${searchPhase}`);
        
        const priority = searchPhase <= 2 ? 'high' : searchPhase === 3 ? 'medium' : 'low';
        
        const broadcastPromises = nearbyProviders.map(({ providerId, providerSocketId, distance, provider }) => {
          return new Promise((resolve) => {
            io.to(providerSocketId).emit('incomingServiceRequest', {
              ...requestData,
              providerId,
              distance: distance !== null ? distance : "Unknown",
              userDistance: distance !== null ? `${distance}km away` : "Distance unknown",
              searchPhase,
              searchRadius,
              priority,
              elapsedTime
            });
            
            // Track that this provider received this request
            if (!requestProviders.has(requestId)) {
              requestProviders.set(requestId, new Set());
            }
            requestProviders.get(requestId).add(providerId);
            
            console.log(`📤 Sent request to provider ${providerId} (${provider.name || 'Unnamed'}) - ${distance !== null ? distance + 'km' : 'unknown distance'} [Priority: ${priority}]`);
            resolve();
          });
        });
        
        await Promise.all(broadcastPromises);
        
        const nearestDistance = nearbyProviders.length > 0 && nearbyProviders[0].distance !== null 
          ? nearbyProviders[0].distance 
          : null;
        
        socket.emit('providersFound', {
          requestId,
          providerCount: nearbyProviders.length,
          searchRadius,
          searchPhase,
          nearestDistance,
          status: 'providers_found',
          message: `Found ${nearbyProviders.length} providers within ${searchRadius}km!`,
          elapsedTime
        });
        
        // Clean up search intervals and tracking
        const searchData = activeSearchIntervals.get(requestId);
        if (searchData) {
          clearInterval(searchData.interval);
          clearTimeout(searchData.timeout);
          activeSearchIntervals.delete(requestId);
          console.log(`🔄 Cleaned up search interval for request ${requestId} - providers found`);
        }
        
        // Note: Keep requestProviders tracking until request is completed or cancelled
        // This allows for proper cancellation even after providers are found
        
        searchInProgress = false;
        return;
      }
      
      console.log(`📡 Phase ${searchPhase}: No providers found within ${searchRadius}km at ${elapsedTime}s`);
      
      const expectedPhase = Math.floor(elapsedTime / PROXIMITY_CONFIG.PHASE_DURATION_SECONDS) + 1;
      const expectedRadius = expectedPhase;
      
      if (expectedPhase > searchPhase && searchRadius < PROXIMITY_CONFIG.MAX_RADIUS_KM) {
        searchPhase = expectedPhase;
        searchRadius = expectedRadius;
        
        socket.emit('searchPhaseUpdate', {
          requestId,
          searchPhase,
          searchRadius,
          message: `Expanding search to ${searchRadius}km radius`,
          elapsedTime,
          status: 'searching'
        });
        
        console.log(`📈 Expanded to phase ${searchPhase}: ${searchRadius}km radius at ${elapsedTime}s`);
      } else if (searchRadius >= PROXIMITY_CONFIG.MAX_RADIUS_KM) {
        socket.emit('searchTimeout', {
          requestId,
          message: `No ${serviceType} providers found within ${PROXIMITY_CONFIG.MAX_RADIUS_KM}km`,
          searchPhase,
          searchRadius: PROXIMITY_CONFIG.MAX_RADIUS_KM,
          elapsedTime
        });
        searchInProgress = false;
      }
    };
    
    await performProgressiveSearch();
    
    const searchInterval = setInterval(async () => {
      if (!searchInProgress) {
        clearInterval(searchInterval);
        activeSearchIntervals.delete(requestId);
        return;
      }
      
      await performProgressiveSearch();
    }, PROXIMITY_CONFIG.PHASE_DURATION_SECONDS * 1000);
    
    const searchTimeout = setTimeout(() => {
      if (searchInterval) {
        clearInterval(searchInterval);
        searchInProgress = false;
        activeSearchIntervals.delete(requestId);
      }
    }, PROXIMITY_CONFIG.MAX_SEARCH_TIME_SECONDS * 1000);
    
    activeSearchIntervals.set(requestId, { 
      interval: searchInterval, 
      timeout: searchTimeout,
      searchInProgress: () => searchInProgress,
      stopSearch: () => { searchInProgress = false; }
    });
    
    userActiveRequests.set(userId, requestId);
  });

  // Handle service request cancellation
  socket.on('cancelServiceRequest', async (data) => {
    console.log('🚫 Service request cancellation received:', data);
    
    const missing = validateSocketData(data, ['requestId']);
    if (missing) {
      console.log('❌ Missing fields in cancellation request:', missing);
      socket.emit('error', {
        message: 'Missing required fields for cancellation',
        missing
      });
      return;
    }

    const { requestId, userId, timestamp, reason } = data;

    try {
      // 1. Stop progressive search for this request
      const searchData = activeSearchIntervals.get(requestId);
      if (searchData) {
        clearInterval(searchData.interval);
        clearTimeout(searchData.timeout);
        searchData.stopSearch();
        activeSearchIntervals.delete(requestId);
        console.log(`🔄 Cleaned up search interval for request ${requestId}`);
      }

      // 2. Notify all providers who received this request
      const providersWhoReceived = requestProviders.get(requestId);
      if (providersWhoReceived && providersWhoReceived.size > 0) {
        console.log(`📤 Notifying ${providersWhoReceived.size} providers about cancellation for request ${requestId}`);
        
        for (const providerId of providersWhoReceived) {
          const providerSocketId = connectedProviders.get(providerId);
          if (providerSocketId) {
            io.to(providerSocketId).emit('requestCancelled', {
              requestId: requestId,
              userId: userId || 'unknown',
              message: 'Service request was cancelled by the user',
              timestamp: timestamp || new Date().toISOString(),
              reason: reason || 'user_cancelled',
              status: 'cancelled'
            });
            console.log(`📤 Cancellation notification sent to provider ${providerId}`);
          }
        }
        
        // Clean up provider tracking for this request
        requestProviders.delete(requestId);
      } else {
        console.log(`ℹ️ No providers to notify for request ${requestId}`);
      }

      // 3. Remove from active requests
      activeRequests.delete(requestId);
      
      // 4. Remove user tracking for this request
      for (const [userId, userRequestId] of userActiveRequests.entries()) {
        if (userRequestId === requestId) {
          userActiveRequests.delete(userId);
          break;
        }
      }
      
      // 5. Confirm cancellation to user
      socket.emit('requestCancelled', {
        success: true,
        requestId,
        message: 'Service request cancelled successfully',
        status: 'cancelled'
      });

      console.log(`✅ Service request ${requestId} cancelled successfully and providers notified`);
    } catch (error) {
      console.error('❌ Error cancelling service request:', error);
      socket.emit('error', {
        message: 'Failed to cancel service request'
      });
    }
  });

  // Handle provider responses
  socket.on('providerResponse', async (data) => {
    console.log('🔧 Provider response received:', data);
    
    const missing = validateSocketData(data, ['requestId', 'providerId', 'response']);
    if (missing) {
      console.log('❌ Missing fields in provider response:', missing);
      socket.emit('error', {
        message: 'Missing required fields for provider response',
        missing
      });
      return;
    }

    const { requestId, providerId, response, estimatedTime, estimatedTimeFormatted, estimatedDuration } = data;

    console.log('🔧 Processing ETA data:', {
      estimatedTime,
      estimatedTimeFormatted, 
      estimatedDuration,
      isNewFormat: !!(estimatedTime && estimatedTimeFormatted && estimatedDuration)
    });

    // Check if provider exists in database (relaxed connection check for now)
    try {
      const provider = await Provider.findById(providerId);
      if (!provider) {
        console.log('❌ Provider not found in database:', providerId);
        socket.emit('error', { message: 'Provider not found in database' });
        return;
      }
      console.log(`✅ Provider ${providerId} verified in database (${provider.name})`);
    } catch (error) {
      console.log('❌ Error verifying provider:', error);
      socket.emit('error', { message: 'Error verifying provider' });
      return;
    }
    
    const request = activeRequests.get(requestId);
    if (!request) {
      console.log('❌ Request not found in activeRequests:', requestId);
      socket.emit('error', { message: 'Request not found' });
      return;
    }
    
    console.log(`🔧 Provider ${providerId} ${response}ed request ${requestId}`);
    
    if (response === 'accept') {
      request.status = 'accepted';
      request.assignedProviderId = providerId;
      request.estimatedTime = estimatedTime;
      
      // Store new ETA format if available
      if (estimatedTime && estimatedTimeFormatted && estimatedDuration) {
        request.eta = {
          estimatedCompletionTime: new Date(estimatedTime),
          estimatedTimeFormatted,
          estimatedDuration
        };
      }
      
      activeRequests.set(requestId, request);
      
      // Update database with accepted status and new ETA format
      try {
        const updateData = { 
          status: 'accepted',
          assignedProviderId: providerId,
          estimatedTime: estimatedTime, // Keep for backward compatibility
          'timestamps.acceptedAt': new Date()
        };
        
        // Add new ETA data if available
        if (estimatedTime && estimatedTimeFormatted && estimatedDuration) {
          updateData['eta.estimatedCompletionTime'] = new Date(estimatedTime);
          updateData['eta.estimatedTimeFormatted'] = estimatedTimeFormatted;
          updateData['eta.estimatedDuration'] = estimatedDuration;
          updateData['eta.lastUpdated'] = new Date();
        }
        
        await ServiceRequest.findOneAndUpdate({ requestId }, updateData);
        console.log(`💾 Request ${requestId} status updated to 'accepted' in database with ETA:`, updateData);
      } catch (dbError) {
        console.error(`❌ Error updating request status in database:`, dbError);
      }
      
      // Clean up provider tracking since request is now accepted
      requestProviders.delete(requestId);
      
      console.log(`✅ Request ${requestId} marked as accepted by provider ${providerId}`);
    }
    
    try {
      const provider = await Provider.findById(providerId);
      if (!provider) {
        console.log(`❌ Provider ${providerId} not found in database`);
        socket.emit('error', { message: 'Provider not found in database' });
        return;
      }
      
      let distance = null;
      if (provider.location && provider.location.latitude && provider.location.longitude && 
          request.location && request.location.latitude && request.location.longitude) {
        distance = calculateDistance(
          request.location.latitude, request.location.longitude,
          provider.location.latitude, provider.location.longitude
        );
        console.log(`📏 Calculated distance: ${distance}km`);
      }
      
      const providerInfo = {
        id: providerId,
        name: provider.name || "Service Provider",
        phone: provider.phone || "",
        rating: provider.rating || 0,
        experience: provider.experience || "0 years"
      };
      
      const userSocketId = connectedUsers.get(request.userId) || request.userSocketId;
      
      if (userSocketId) {
        // Process ETA data for user response
        const etaData = processETAData(estimatedTime, estimatedTimeFormatted, estimatedDuration);
        
        const responsePayload = {
          requestId,
          providerId,
          response,
          estimatedTime, // Keep for backward compatibility
          status: request.status,
          providerName: providerInfo.name,
          providerPhone: providerInfo.phone,
          providerRating: providerInfo.rating,
          providerExperience: providerInfo.experience,
          distance: distance,
          timestamp: new Date().toISOString(),
          providerInfo,
          
          // NEW: Structured ETA object for better frontend handling
          eta: etaData
        };
        
        io.to(userSocketId).emit('providerResponse', responsePayload);
        io.to(userSocketId).emit('serviceRequestUpdate', responsePayload);
        io.to(userSocketId).emit('requestStatusUpdate', responsePayload);
        console.log(`📤 Sent response to user socket ${userSocketId}:`, responsePayload);
        console.log(`🕐 ETA sent to user:`, {
          'eta.completionTime': responsePayload.eta.completionTime,
          'eta.displayTime': responsePayload.eta.displayTime,
          'eta.timeFromNow': responsePayload.eta.timeFromNow,
          'eta.isToday': responsePayload.eta.isToday
        });
      } else {
        console.log(`❌ No valid socket ID found for user ${request.userId}`);
      }
    } catch (error) {
      console.error(`❌ Error fetching provider details for ${providerId}:`, error);
      
      const userSocketId = connectedUsers.get(request.userId) || request.userSocketId;
      if (userSocketId) {
        // Process ETA data for fallback response
        const etaData = processETAData(estimatedTime, estimatedTimeFormatted, estimatedDuration);
        
        const fallbackPayload = {
          requestId,
          providerId,
          response,
          estimatedTime, // Keep for backward compatibility
          status: request.status,
          timestamp: new Date().toISOString(),
          providerInfo: { id: providerId },
          
          // NEW: Structured ETA object for fallback
          eta: etaData
        };
        
        io.to(userSocketId).emit('providerResponse', fallbackPayload);
        io.to(userSocketId).emit('serviceRequestUpdate', fallbackPayload);
        io.to(userSocketId).emit('requestStatusUpdate', fallbackPayload);
        console.log(`📤 Sent fallback response to user socket ${userSocketId}:`, fallbackPayload);
      }
    }
  });

  // Handle service completion
  socket.on('serviceComplete', async (data) => {
    console.log('🏁 Service completion received:', data);
    
    const missing = validateSocketData(data, ['requestId', 'providerId']);
    if (missing) {
      console.log('❌ Missing fields in service completion:', missing);
      socket.emit('error', {
        message: 'Missing required fields for service completion',
        missing
      });
      return;
    }

    const { requestId, providerId, completionNotes, actualCost } = data;

    try {
      // Update service request in database
      const updatedRequest = await ServiceRequest.findOneAndUpdate(
        { requestId, assignedProviderId: providerId },
        { 
          status: 'completed',
          'timestamps.completedAt': new Date(),
          completionNotes: completionNotes || '',
          'pricing.actualCost': actualCost || null
        },
        { new: true }
      );

      if (!updatedRequest) {
        console.log(`❌ Service request ${requestId} not found or not assigned to provider ${providerId}`);
        socket.emit('error', { message: 'Service request not found or access denied' });
        return;
      }

      // Remove from active requests
      activeRequests.delete(requestId);
      
      console.log(`✅ Service request ${requestId} marked as completed in database`);

      // Notify user of completion
      const userSocketId = connectedUsers.get(updatedRequest.userId);
      if (userSocketId) {
        const completionPayload = {
          requestId,
          status: 'completed',
          completedAt: updatedRequest.timestamps.completedAt,
          completionNotes: completionNotes || '',
          actualCost: actualCost || null,
          providerId
        };
        
        io.to(userSocketId).emit('serviceCompleted', completionPayload);
        console.log(`📤 Sent completion notification to user ${updatedRequest.userId}`);
      }

      // Confirm completion to provider
      socket.emit('serviceCompletionConfirmed', {
        requestId,
        status: 'completed',
        message: 'Service marked as completed successfully'
      });

    } catch (error) {
      console.error(`❌ Error completing service request ${requestId}:`, error);
      socket.emit('error', { 
        message: 'Failed to complete service request',
        error: error.message 
      });
    }
  });

  // Handle provider live location updates
  socket.on('providerLocationUpdate', async (data) => {
    console.log('📍 Provider location update received:', data);
    
    const missing = validateSocketData(data, ['providerId', 'lat', 'lng']);
    if (missing) {
      console.log('❌ Missing fields in provider location update:', missing);
      socket.emit('locationUpdateConfirmed', {
        success: false,
        message: 'Missing required fields for location update'
      });
      return;
    }

    const { providerId, lat, lng, timestamp, accuracy } = data;
    
    if (!validateCoordinates(lat, lng)) {
      console.log('❌ Invalid location coordinates:', { lat, lng });
      socket.emit('locationUpdateConfirmed', {
        success: false,
        message: 'Invalid location coordinates'
      });
      return;
    }

    try {
      const updateData = {
        'currentLocation.lat': lat,
        'currentLocation.lng': lng,
        'currentLocation.accuracy': accuracy || null,
        'currentLocation.lastUpdated': new Date(timestamp || Date.now()),
        'locationTracking.enabled': true
      };

      const updatedProvider = await Provider.findByIdAndUpdate(
        providerId, 
        updateData,
        { new: true }
      );

      if (!updatedProvider) {
        console.log('❌ Provider not found for location update:', providerId);
        socket.emit('locationUpdateConfirmed', {
          success: false,
          message: 'Provider not found'
        });
        return;
      }

      await Provider.findByIdAndUpdate(providerId, {
        $push: {
          locationHistory: {
            $each: [{
              lat: lat,
              lng: lng,
              accuracy: accuracy || null,
              timestamp: new Date(timestamp || Date.now())
            }],
            $slice: -100
          }
        }
      });

      console.log(`✅ Location updated for provider ${providerId}:`, {
        lat: lat,
        lng: lng,
        accuracy: accuracy
      });

      socket.emit('locationUpdateConfirmed', {
        success: true,
        message: 'Location updated successfully',
        location: {
          lat: lat,
          lng: lng,
          timestamp: timestamp || Date.now()
        }
      });

      await notifyNearbyUsers(providerId, { lat, lng });
    } catch (error) {
      console.error('❌ Error updating provider location:', error);
      socket.emit('locationUpdateConfirmed', {
        success: false,
        message: 'Failed to update location'
      });
    }
  });

  // Handle provider online/offline status updates
  socket.on('providerStatusUpdate', async (data) => {
    console.log('🟢 Provider status update received:', {
      rawData: data,
      providerId: data?.providerId,
      providerIdType: typeof data?.providerId,
      hasProviderId: !!data?.providerId
    });
    
    const missing = validateSocketData(data, ['providerId']);
    if (missing) {
      console.log('❌ Missing fields in provider status update:', missing);
      socket.emit('error', {
        message: 'Missing required fields for status update',
        missing
      });
      return;
    }

    const { providerId, isOnline, isAvailable, location } = data;
    
    const onlineStatus = isOnline !== undefined ? isOnline : isAvailable;
    
    if (onlineStatus === undefined) {
      console.log('❌ Missing online status field (isOnline or isAvailable)');
      socket.emit('error', {
        message: 'Missing online status field: provide either isOnline or isAvailable'
      });
      return;
    }

    try {
      const updateData = {
        isOnline: onlineStatus,
        isAvailable: onlineStatus,
        lastOnline: new Date()
      };

      if (location && validateCoordinates(location.lat, location.lng)) {
        updateData['currentLocation.lat'] = location.lat;
        updateData['currentLocation.lng'] = location.lng;
        updateData['currentLocation.accuracy'] = location.accuracy || null;
        updateData['currentLocation.lastUpdated'] = new Date();
        updateData['locationTracking.enabled'] = onlineStatus;
      }

      const updatedProvider = await Provider.findByIdAndUpdate(
        providerId,
        updateData,
        { new: true }
      );

      if (!updatedProvider) {
        console.log('❌ Provider not found for status update:', providerId);
        socket.emit('error', { message: 'Provider not found' });
        return;
      }

      console.log(`✅ Status updated for provider ${providerId}: ${onlineStatus ? 'ONLINE' : 'OFFLINE'}`);

      await updateProximitySearchResults(providerId, onlineStatus);

      socket.emit('statusUpdateConfirmed', {
        success: true,
        isOnline: onlineStatus,
        message: `Provider is now ${onlineStatus ? 'online' : 'offline'}`
      });
    } catch (error) {
      console.error('❌ Error updating provider status:', error);
      socket.emit('error', {
        message: 'Failed to update provider status'
      });
    }
  });

  // Handle stop location tracking
  socket.on('providerLocationStop', async (data) => {
    console.log('🛑 Provider location stop received:', {
      rawData: data,
      providerId: data?.providerId,
      providerIdType: typeof data?.providerId,
      hasProviderId: !!data?.providerId,
      keys: Object.keys(data || {})
    });
    
    const missing = validateSocketData(data, ['providerId']);
    if (missing) {
      console.log('❌ Missing fields in provider location stop:', missing);
      console.log('📊 Data analysis:', {
        providerId: data?.providerId,
        providerIdValue: JSON.stringify(data?.providerId),
        isUndefined: data?.providerId === undefined,
        isNull: data?.providerId === null,
        isEmpty: data?.providerId === '',
        isFalsy: !data?.providerId
      });
      socket.emit('error', {
        message: 'Missing required fields',
        missing
      });
      return;
    }

    const { providerId } = data;

    try {
      const updatedProvider = await Provider.findByIdAndUpdate(providerId, {
        'locationTracking.enabled': false,
        'currentLocation.lastUpdated': new Date(),
        isOnline: false
      }, { new: true });

      if (!updatedProvider) {
        console.log('❌ Provider not found for location stop:', providerId);
        socket.emit('error', { message: 'Provider not found' });
        return;
      }

      console.log(`✅ Location tracking stopped for provider ${providerId}`);

      socket.emit('locationStopConfirmed', {
        success: true,
        message: 'Location tracking stopped successfully'
      });
    } catch (error) {
      console.error('❌ Error stopping location tracking:', error);
      socket.emit('error', {
        message: 'Failed to stop location tracking'
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    
    if (socket.userId && socket.userType) {
      if (socket.userType === 'user') {
        connectedUsers.delete(socket.userId);
        console.log(`👤 User ${socket.userId} removed from connected users`);
      } else if (socket.userType === 'provider') {
        connectedProviders.delete(socket.userId);
        console.log(`🔧 Provider ${socket.userId} removed from connected providers`);
      }
    }
    
    console.log(`📊 Connected users: ${connectedUsers.size}, Connected providers: ${connectedProviders.size}`);
  });
});

// Routes
app.use("/auth", authRoutes);

// Import and use new API routes
const userRoutes = require("./routes/userRoutes");
const providerRoutes = require("./routes/providerRoutes");

app.use("/api/user", userRoutes);
app.use("/api/provider", providerRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Fixhomi Backend API',
    connectedUsers: connectedUsers.size,
    connectedProviders: connectedProviders.size,
    activeRequests: activeRequests.size,
    userLocations: userLocations.size,
    users: Array.from(connectedUsers.keys()),
    providers: Array.from(connectedProviders.keys()),
    timestamp: new Date().toISOString(),
    socketServer: 'Socket.IO enabled',
    status: 'running'
  });
});

// Start server only after DB connection
const startServer = async () => {
  try {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Socket.IO server ready for connections`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();