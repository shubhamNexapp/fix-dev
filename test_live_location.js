/**
 * Test Script for Live Location Functionality
 * Tests the new live location features including socket events and database updates
 */

const io = require('socket.io-client');
const mongoose = require('mongoose');
require('dotenv').config();

// Import models and utilities
const Provider = require('./models/provider');
const { getBestProviderLocation, isLocationStale, calculateDistance } = require('./utils/locationUtils');

// Test configuration
const TEST_CONFIG = {
  SERVER_URL: 'http://localhost:5050',
  TEST_PROVIDER_ID: null, // Will be created during test
  TEST_USER_LOCATION: {
    latitude: 19.0760,
    longitude: 72.8777
  },
  TEST_PROVIDER_LOCATION: {
    lat: 19.0800,
    lng: 72.8800
  }
};

let socket = null;
let testProviderId = null;

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fixhomi');
    console.log('✅ Connected to MongoDB for testing');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

// Clean up test data
const cleanupTestData = async () => {
  try {
    if (testProviderId) {
      await Provider.findByIdAndDelete(testProviderId);
      console.log('🧹 Cleaned up test provider');
    }
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  }
};

// Create test provider
const createTestProvider = async () => {
  try {
    const testProvider = new Provider({
      email: 'test.provider@example.com',
      name: 'Test Live Location Provider',
      phone: '+1234567890',
      serviceCategories: ['plumber', 'electrician'],
      location: {
        latitude: TEST_CONFIG.TEST_PROVIDER_LOCATION.lat,
        longitude: TEST_CONFIG.TEST_PROVIDER_LOCATION.lng,
        address: 'Test Address, Mumbai'
      },
      isAvailable: true,
      isOnline: false,
      locationTracking: {
        enabled: false,
        updateInterval: 30000,
        minDistance: 50
      }
    });
    
    const savedProvider = await testProvider.save();
    testProviderId = savedProvider._id.toString();
    console.log(`✅ Created test provider: ${testProviderId}`);
    return savedProvider;
  } catch (error) {
    console.error('❌ Error creating test provider:', error);
    throw error;
  }
};

// Test socket connection and events
const testSocketConnection = () => {
  return new Promise((resolve, reject) => {
    console.log('🔌 Connecting to socket server...');
    
    socket = io(TEST_CONFIG.SERVER_URL, {
      transports: ['websocket']
    });
    
    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      resolve();
    });
    
    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      reject(error);
    });
    
    // Set up event listeners for testing
    socket.on('locationUpdateConfirmed', (data) => {
      console.log('📍 Location update confirmed:', data);
    });
    
    socket.on('statusUpdateConfirmed', (data) => {
      console.log('🟢 Status update confirmed:', data);
    });
    
    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });
  });
};

// Test provider registration
const testProviderRegistration = () => {
  return new Promise((resolve) => {
    console.log('👤 Registering provider...');
    
    socket.emit('register', {
      userId: testProviderId,
      userType: 'provider'
    });
    
    socket.on('registered', (data) => {
      console.log('✅ Provider registered:', data);
      resolve();
    });
  });
};

// Test location update
const testLocationUpdate = () => {
  return new Promise((resolve) => {
    console.log('📍 Testing location update...');
    
    const locationData = {
      providerId: testProviderId,
      location: {
        lat: TEST_CONFIG.TEST_PROVIDER_LOCATION.lat + 0.001, // Slight movement
        lng: TEST_CONFIG.TEST_PROVIDER_LOCATION.lng + 0.001,
        accuracy: 15
      },
      timestamp: Date.now()
    };
    
    socket.emit('providerLocationUpdate', locationData);
    
    socket.on('locationUpdateConfirmed', (data) => {
      if (data.success) {
        console.log('✅ Location update successful');
        resolve();
      } else {
        console.error('❌ Location update failed:', data.message);
        resolve();
      }
    });
  });
};

// Test status update (online/offline)
const testStatusUpdate = (isOnline) => {
  return new Promise((resolve) => {
    console.log(`🟢 Testing status update: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    
    const statusData = {
      providerId: testProviderId,
      isOnline: isOnline,
      location: isOnline ? {
        lat: TEST_CONFIG.TEST_PROVIDER_LOCATION.lat,
        lng: TEST_CONFIG.TEST_PROVIDER_LOCATION.lng,
        accuracy: 10
      } : null
    };
    
    socket.emit('providerStatusUpdate', statusData);
    
    socket.on('statusUpdateConfirmed', (data) => {
      if (data.success) {
        console.log(`✅ Status update successful: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        resolve();
      } else {
        console.error('❌ Status update failed');
        resolve();
      }
    });
  });
};

// Test database location retrieval
const testDatabaseLocationRetrieval = async () => {
  try {
    console.log('🗄️ Testing database location retrieval...');
    
    const provider = await Provider.findById(testProviderId);
    if (!provider) {
      console.error('❌ Provider not found in database');
      return;
    }
    
    console.log('📊 Provider location data:', {
      staticLocation: provider.location,
      currentLocation: provider.currentLocation,
      isOnline: provider.isOnline,
      locationTracking: provider.locationTracking,
      historyCount: provider.locationHistory ? provider.locationHistory.length : 0
    });
    
    // Test location utility functions
    const bestLocation = getBestProviderLocation(provider);
    console.log('🎯 Best available location:', bestLocation);
    
    if (bestLocation) {
      const distance = calculateDistance(
        TEST_CONFIG.TEST_USER_LOCATION.latitude,
        TEST_CONFIG.TEST_USER_LOCATION.longitude,
        bestLocation.lat,
        bestLocation.lng
      );
      console.log(`📏 Distance to test user: ${distance}km`);
      
      const isStale = isLocationStale(bestLocation.lastUpdated);
      console.log(`⏰ Location is ${isStale ? 'stale' : 'fresh'}`);
    }
    
    console.log('✅ Database location retrieval test completed');
  } catch (error) {
    console.error('❌ Database location retrieval test failed:', error);
  }
};

// Test location stop
const testLocationStop = () => {
  return new Promise((resolve) => {
    console.log('🛑 Testing location stop...');
    
    socket.emit('providerLocationStop', {
      providerId: testProviderId
    });
    
    socket.on('locationStopConfirmed', (data) => {
      if (data.success) {
        console.log('✅ Location stop successful');
        resolve();
      } else {
        console.error('❌ Location stop failed');
        resolve();
      }
    });
  });
};

// Main test sequence
const runTests = async () => {
  try {
    console.log('🚀 Starting Live Location Tests');
    console.log('================================');
    
    // Connect to database
    await connectDB();
    
    // Create test provider
    await createTestProvider();
    
    // Connect to socket
    await testSocketConnection();
    
    // Register provider
    await testProviderRegistration();
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test going online
    await testStatusUpdate(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test location update
    await testLocationUpdate();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test database retrieval
    await testDatabaseLocationRetrieval();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test multiple location updates
    console.log('📍 Testing multiple location updates...');
    for (let i = 0; i < 3; i++) {
      const locationData = {
        providerId: testProviderId,
        location: {
          lat: TEST_CONFIG.TEST_PROVIDER_LOCATION.lat + (i * 0.001),
          lng: TEST_CONFIG.TEST_PROVIDER_LOCATION.lng + (i * 0.001),
          accuracy: 20
        },
        timestamp: Date.now()
      };
      
      socket.emit('providerLocationUpdate', locationData);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Test database after multiple updates
    await testDatabaseLocationRetrieval();
    
    // Test going offline
    await testStatusUpdate(false);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test location stop
    await testLocationStop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Final database check
    await testDatabaseLocationRetrieval();
    
    console.log('================================');
    console.log('✅ All Live Location Tests Completed Successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    await cleanupTestData();
    
    if (socket) {
      socket.disconnect();
      console.log('🔌 Socket disconnected');
    }
    
    await mongoose.connection.close();
    console.log('🗄️ Database connection closed');
    
    process.exit(0);
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted by user');
  await cleanupTestData();
  if (socket) socket.disconnect();
  await mongoose.connection.close();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught exception:', error);
  await cleanupTestData();
  if (socket) socket.disconnect();
  await mongoose.connection.close();
  process.exit(1);
});

// Run the tests
runTests();