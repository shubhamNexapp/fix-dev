/**
 * Provider Location Data Checker
 * Run this to check which providers have location data vs which don't
 */

const mongoose = require('mongoose');
const Provider = require('./models/provider');
require('dotenv').config();

async function checkProviderLocations() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fixhomi');
    console.log('🔗 Connected to MongoDB');
    
    const providers = await Provider.find({});
    
    console.log(`\n📊 Provider Location Data Report (${providers.length} total providers):\n`);
    
    let hasLocation = 0;
    let missingLocation = 0;
    
    providers.forEach((provider, index) => {
      const hasLocationData = provider.location && 
                             provider.location.latitude && 
                             provider.location.longitude;
      
      if (hasLocationData) {
        hasLocation++;
        console.log(`✅ ${index + 1}. ${provider.name || 'Unnamed'} (${provider._id})`);
        console.log(`   📍 Location: ${provider.location.latitude}, ${provider.location.longitude}`);
        console.log(`   🏷️  Services: ${provider.serviceCategories ? provider.serviceCategories.join(', ') : 'None'}`);
        console.log(`   📱 Available: ${provider.isAvailable ? 'Yes' : 'No'}\n`);
      } else {
        missingLocation++;
        console.log(`❌ ${index + 1}. ${provider.name || 'Unnamed'} (${provider._id})`);
        console.log(`   📍 Location: MISSING`);
        console.log(`   🏷️  Services: ${provider.serviceCategories ? provider.serviceCategories.join(', ') : 'None'}`);
        console.log(`   📱 Available: ${provider.isAvailable ? 'Yes' : 'No'}`);
        console.log(`   ⚠️  Will NOT receive requests in 1km hyper-local system\n`);
      }
    });
    
    console.log('📈 Summary:');
    console.log(`✅ Providers with location: ${hasLocation}`);
    console.log(`❌ Providers missing location: ${missingLocation}`);
    console.log(`🎯 Ready for 1km hyper-local: ${hasLocation} providers`);
    
    if (missingLocation > 0) {
      console.log('\n💡 To fix "unknown distance" and unwanted notifications:');
      console.log('   1. Providers without location data need to update their location');
      console.log('   2. Use PUT /auth/provider/location API endpoint');
      console.log('   3. Or update location during provider registration');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkProviderLocations();