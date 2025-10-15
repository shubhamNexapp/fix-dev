/**
 * Location Utilities for Proximity-Based Provider Matching
 * Implements Haversine formula for calculating distances between GPS coordinates
 */

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point  
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers (rounded to 2 decimal places)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert degrees to radians
 * @param {number} deg - Degrees to convert
 * @returns {number} Radians
 */
function deg2rad(deg) {
  return deg * (Math.PI/180);
}

/**
 * Validate GPS coordinates
 * @param {number} latitude - Latitude to validate
 * @param {number} longitude - Longitude to validate
 * @returns {boolean} True if coordinates are valid
 */
function validateCoordinates(latitude, longitude) {
  return (
    typeof latitude === 'number' && 
    typeof longitude === 'number' &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180
  );
}

/**
 * Format distance for display
 * @param {number} distance - Distance in kilometers
 * @returns {string} Formatted distance string
 */
function formatDistance(distance) {
  if (distance === null || distance === undefined) {
    return "Unknown distance";
  }
  
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m away`;
  } else {
    return `${distance}km away`;
  }
}

/**
 * Check if a location is stale (older than threshold)
 * @param {Date} lastUpdated - Last update timestamp
 * @param {number} thresholdMinutes - Threshold in minutes (default from config)
 * @returns {boolean} True if location is stale
 */
function isLocationStale(lastUpdated, thresholdMinutes = PROXIMITY_CONFIG.LIVE_LOCATION.STALE_LOCATION_MINUTES) {
  if (!lastUpdated) return true;
  const now = new Date();
  const diffMinutes = (now - new Date(lastUpdated)) / (1000 * 60);
  return diffMinutes > thresholdMinutes;
}

/**
 * Check if GPS accuracy is acceptable for live location services
 * @param {number} accuracy - GPS accuracy in meters
 * @returns {boolean} True if accuracy is acceptable
 */
function isAccuracyAcceptable(accuracy) {
  if (!accuracy) return false;
  return accuracy <= PROXIMITY_CONFIG.LIVE_LOCATION.MAX_ACCURACY_THRESHOLD_M;
}

/**
 * Calculate effective distance with provider priority boosts
 * @param {number} actualDistance - Actual distance in km
 * @param {boolean} isOnline - Provider online status
 * @param {boolean} hasLiveLocation - Provider has live location
 * @param {number} accuracy - Location accuracy in meters
 * @returns {number} Effective distance for sorting
 */
function calculateEffectiveDistance(actualDistance, isOnline = false, hasLiveLocation = false, accuracy = null) {
  let effectiveDistance = actualDistance;
  
  // Apply online provider boost
  if (isOnline) {
    effectiveDistance -= PROXIMITY_CONFIG.PROVIDER_PRIORITY.ONLINE_BOOST;
  }
  
  // Apply live location boost (only if accuracy is good)
  if (hasLiveLocation && accuracy && accuracy <= PROXIMITY_CONFIG.PROVIDER_PRIORITY.MIN_ACCURACY_FOR_PRIORITY) {
    effectiveDistance -= PROXIMITY_CONFIG.PROVIDER_PRIORITY.LIVE_LOCATION_BOOST;
  }
  
  // Ensure minimum distance of 0
  return Math.max(0, effectiveDistance);
}

/**
 * Determine if significant movement occurred (battery optimization)
 * @param {Object} oldLocation - Previous location {lat, lng}
 * @param {Object} newLocation - New location {lat, lng}
 * @returns {boolean} True if movement is significant enough to process
 */
function isSignificantMovement(oldLocation, newLocation) {
  if (!oldLocation || !newLocation) return true;
  
  const distance = calculateDistance(
    oldLocation.lat, oldLocation.lng,
    newLocation.lat, newLocation.lng
  );
  
  // Convert threshold from meters to kilometers
  const thresholdKm = PROXIMITY_CONFIG.LIVE_LOCATION.MIN_DISTANCE_THRESHOLD_M / 1000;
  return distance >= thresholdKm;
}

/**
 * Get the best available location for a provider
 * @param {Object} provider - Provider object from database
 * @returns {Object|null} Best location {lat, lng, source, accuracy, lastUpdated}
 */
function getBestProviderLocation(provider) {
  if (!provider) return null;
  
  // Prefer live location if available and not stale
  if (provider.currentLocation && 
      provider.currentLocation.lat && 
      provider.currentLocation.lng &&
      !isLocationStale(provider.currentLocation.lastUpdated)) {
    
    return {
      lat: provider.currentLocation.lat,
      lng: provider.currentLocation.lng,
      source: 'live',
      accuracy: provider.currentLocation.accuracy,
      lastUpdated: provider.currentLocation.lastUpdated,
      isStale: false
    };
  }
  
  // Fallback to static location
  if (provider.location && 
      provider.location.latitude && 
      provider.location.longitude) {
    
    return {
      lat: provider.location.latitude,
      lng: provider.location.longitude,
      source: 'static',
      accuracy: null,
      lastUpdated: provider.location.lastUpdated,
      isStale: isLocationStale(provider.location.lastUpdated)
    };
  }
  
  return null;
}

/**
 * Enhanced proximity search with live location support
 * @param {Object} userLocation - User location {latitude, longitude}
 * @param {Array} providers - Array of provider objects
 * @param {number} radiusKm - Search radius in kilometers
 * @returns {Array} Sorted array of nearby providers with distance and priority info
 */
function findProvidersInRadius(userLocation, providers, radiusKm) {
  const nearbyProviders = [];
  
  providers.forEach(provider => {
    const location = getBestProviderLocation(provider);
    if (!location) return;
    
    const distance = calculateDistance(
      userLocation.latitude, userLocation.longitude,
      location.lat, location.lng
    );
    
    if (distance <= radiusKm) {
      const effectiveDistance = calculateEffectiveDistance(
        distance,
        provider.isOnline,
        location.source === 'live',
        location.accuracy
      );
      
      nearbyProviders.push({
        provider,
        distance: Math.round(distance * 100) / 100,
        effectiveDistance: Math.round(effectiveDistance * 100) / 100,
        location,
        priority: provider.isOnline ? (location.source === 'live' ? 'high' : 'medium') : 'low'
      });
    }
  });
  
  // Sort by effective distance (with priority boosts applied)
  nearbyProviders.sort((a, b) => a.effectiveDistance - b.effectiveDistance);
  
  return nearbyProviders;
}

// Proximity configuration constants
const PROXIMITY_CONFIG = {
  DEFAULT_RADIUS_KM: 1,         // Initial search radius
  MAX_RADIUS_KM: 4,             // Maximum search radius (reduced from 5 to 4)
  RADIUS_INCREMENT_KM: 1,       // How much to expand radius each attempt
  PHASE_DURATION_SECONDS: 30,   // Duration of each search phase (30 seconds)
  MAX_SEARCH_TIME_SECONDS: 120, // Maximum total search time (2 minutes)
  MAX_PROVIDERS_PER_REQUEST: 10, // Maximum providers to notify per request
  LOCATION_REQUIRED: true,      // Location is MANDATORY for hyper-local matching
  
  // NEW: Live location tracking settings
  LIVE_LOCATION: {
    UPDATE_INTERVAL_MS: 30000,    // 30 seconds between location updates
    MIN_DISTANCE_THRESHOLD_M: 50, // Minimum 50 meters movement to trigger update
    MAX_ACCURACY_THRESHOLD_M: 100, // Maximum GPS accuracy accepted (100m)
    HISTORY_LIMIT: 100,           // Maximum location history entries to keep
    STALE_LOCATION_MINUTES: 10,   // Consider location stale after 10 minutes
    PRIORITY_RADIUS_KM: 2,        // Priority radius for online providers
    BATTERY_SAVE_MODE: true       // Enable battery optimization features
  },
  
  // NEW: Provider prioritization settings
  PROVIDER_PRIORITY: {
    ONLINE_BOOST: 0.5,           // Reduce effective distance by 0.5km for online providers
    LIVE_LOCATION_BOOST: 0.3,    // Additional 0.3km boost for providers with live location
    MAX_OFFLINE_HOURS: 24,       // Hide providers offline for more than 24 hours
    MIN_ACCURACY_FOR_PRIORITY: 50 // Minimum GPS accuracy (meters) for live location priority
  },
  
  // NEW: Real-time notification settings
  NOTIFICATIONS: {
    NEW_PROVIDER_RADIUS_KM: 1.5, // Notify users when provider enters 1.5km range
    STATUS_CHANGE_RADIUS_KM: 3,  // Notify status changes within 3km
    DEBOUNCE_INTERVAL_MS: 5000   // Minimum 5 seconds between notifications
  }
};

module.exports = {
  calculateDistance,
  deg2rad,
  validateCoordinates,
  formatDistance,
  PROXIMITY_CONFIG,
  // NEW: Live location utility functions
  isLocationStale,
  isAccuracyAcceptable,
  calculateEffectiveDistance,
  isSignificantMovement,
  getBestProviderLocation,
  findProvidersInRadius
};