/**
 * Test Distance Calculation for 1km Hyper-Local System
 * Run this to verify distance calculations are working correctly
 */

const { calculateDistance, validateCoordinates } = require('./utils/locationUtils');

console.log('🧪 Testing Distance Calculation for 1km Hyper-Local System\n');

// Test coordinates (example locations)
const userLocation = {
  latitude: 19.0760, // Mumbai coordinates
  longitude: 72.8777
};

const testProviders = [
  {
    name: "Provider 1 - Very Close",
    location: {
      latitude: 19.0770, // ~1.1km away
      longitude: 72.8787
    }
  },
  {
    name: "Provider 2 - Within 1km",
    location: {
      latitude: 19.0765, // ~0.8km away  
      longitude: 72.8782
    }
  },
  {
    name: "Provider 3 - Outside 1km",
    location: {
      latitude: 19.0850, // ~2.5km away
      longitude: 72.8850
    }
  },
  {
    name: "Provider 4 - Far Away",
    location: {
      latitude: 19.1200, // ~6km away
      longitude: 72.9200
    }
  }
];

console.log('👤 User Location:', userLocation);
console.log('📍 Testing providers at various distances:\n');

testProviders.forEach((provider, index) => {
  const distance = calculateDistance(
    userLocation.latitude, userLocation.longitude,
    provider.location.latitude, provider.location.longitude
  );
  
  const withinRadius = distance <= 1; // 1km radius test
  const status = withinRadius ? '✅ INCLUDED' : '❌ EXCLUDED';
  
  console.log(`${index + 1}. ${provider.name}`);
  console.log(`   📏 Distance: ${distance}km`);
  console.log(`   🎯 Status: ${status} (1km radius)`);
  console.log(`   📍 Location: ${provider.location.latitude}, ${provider.location.longitude}\n`);
});

// Test coordinate validation
console.log('🔍 Testing coordinate validation:');
const testCoords = [
  { lat: 19.0760, lng: 72.8777, expected: true, desc: "Valid Mumbai coordinates" },
  { lat: 91, lng: 72.8777, expected: false, desc: "Invalid latitude > 90" },
  { lat: 19.0760, lng: 181, expected: false, desc: "Invalid longitude > 180" },
  { lat: null, lng: 72.8777, expected: false, desc: "Null latitude" },
  { lat: "19.0760", lng: 72.8777, expected: false, desc: "String latitude" }
];

testCoords.forEach((test, index) => {
  const isValid = validateCoordinates(test.lat, test.lng);
  const result = isValid === test.expected ? '✅' : '❌';
  console.log(`${index + 1}. ${result} ${test.desc}: ${isValid}`);
});

console.log('\n🏁 Distance calculation test completed!');
console.log('💡 If providers outside 1km are still getting requests:');
console.log('   1. Check if they have location data stored');
console.log('   2. Verify their coordinates are correct'); 
console.log('   3. Ensure backend uses this updated distance logic');