// Quick test script to check provider data
const mongoose = require('mongoose');
require('dotenv').config();

const Provider = require('./models/provider');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

const checkProvider = async () => {
  await connectDB();
  
  const providerId = '68d05358c9b48bc4876dc617';
  console.log(`🔍 Checking provider: ${providerId}`);
  
  try {
    const provider = await Provider.findById(providerId);
    
    if (!provider) {
      console.log('❌ Provider not found');
      return;
    }
    
    console.log('📋 Provider data:');
    console.log('- Name:', provider.name);
    console.log('- Email:', provider.email);
    console.log('- Service Categories:', provider.serviceCategories);
    console.log('- Is Available:', provider.isAvailable);
    console.log('- Is Online:', provider.isOnline);
    
    console.log('\n📍 Location Data:');
    console.log('- Static Location:', provider.location);
    console.log('- Current Location:', provider.currentLocation);
    console.log('- Location Tracking:', provider.locationTracking);
    
    console.log('\n🔧 Recommendations:');
    
    if (!provider.location?.latitude || !provider.location?.longitude) {
      console.log('⚠️  Provider has no static location set');
    }
    
    if (!provider.currentLocation?.lat || !provider.currentLocation?.lng) {
      console.log('⚠️  Provider has no current location set');
    }
    
    if (!provider.serviceCategories || provider.serviceCategories.length === 0) {
      console.log('⚠️  Provider has no service categories set');
    }
    
    if (!provider.name || provider.name === '') {
      console.log('⚠️  Provider has no name set');
    }
    
  } catch (error) {
    console.error('❌ Error checking provider:', error);
  }
  
  mongoose.connection.close();
};

checkProvider();