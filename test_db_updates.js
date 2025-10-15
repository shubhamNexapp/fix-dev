// Test script to check if service requests are being updated in database
const mongoose = require('mongoose');
require('dotenv').config();
const ServiceRequest = require('./models/serviceRequest');

async function checkRecentRequests() {
  await mongoose.connect(process.env.MONGO_URI);
  
  console.log('📋 Recent Service Requests (last 3):');
  const requests = await ServiceRequest.find({})
    .sort({ timestamp: -1 })
    .limit(3)
    .lean();
  
  requests.forEach((req, index) => {
    console.log(`\n${index + 1}. RequestId: ${req.requestId}`);
    console.log(`   UserId: ${req.userId}`);
    console.log(`   Status: ${req.status}`);
    console.log(`   ServiceType: ${req.serviceType}`);
    console.log(`   AssignedProviderId: ${req.assignedProviderId || 'None'}`);
    console.log(`   EstimatedTime: ${req.estimatedTime || 'None'}`);
    console.log(`   Created: ${req.timestamp}`);
    console.log(`   AcceptedAt: ${req.timestamps?.acceptedAt || 'None'}`);
    console.log(`   CompletedAt: ${req.timestamps?.completedAt || 'None'}`);
  });
  
  // Check for any accepted requests
  const acceptedCount = await ServiceRequest.countDocuments({ status: 'accepted' });
  const completedCount = await ServiceRequest.countDocuments({ status: 'completed' });
  const pendingCount = await ServiceRequest.countDocuments({ status: 'pending' });
  
  console.log(`\n📊 Request Status Summary:`);
  console.log(`   Pending: ${pendingCount}`);
  console.log(`   Accepted: ${acceptedCount}`);
  console.log(`   Completed: ${completedCount}`);
  
  mongoose.disconnect();
}

checkRecentRequests().catch(console.error);