// Enhanced location and distance utilities for the profile and history features

// Haversine formula for distance calculation
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// Format distance for display
function formatDistance(distance) {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
}

// Request status validation
const RequestStatusFlow = {
  pending: ['accepted', 'cancelled', 'rejected'],
  accepted: ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
  completed: [], // Terminal state
  cancelled: [], // Terminal state
  rejected: [] // Terminal state
};

// Function to validate status transitions
function isValidStatusTransition(currentStatus, newStatus) {
  const validTransitions = RequestStatusFlow[currentStatus] || [];
  return validTransitions.includes(newStatus);
}

// Function to update request status with proper timestamps
async function updateRequestStatusWithTimestamp(ServiceRequest, requestId, newStatus, metadata = {}) {
  const request = await ServiceRequest.findOne({ requestId });
  if (!request) {
    throw new Error('Request not found');
  }
  
  if (!isValidStatusTransition(request.status, newStatus)) {
    throw new Error(`Invalid status transition from ${request.status} to ${newStatus}`);
  }
  
  const updateData = { status: newStatus };
  
  // Set appropriate timestamp
  const now = new Date();
  switch (newStatus) {
    case 'accepted':
      updateData['timestamps.acceptedAt'] = now;
      break;
    case 'in-progress':
      updateData['timestamps.startedAt'] = now;
      break;
    case 'completed':
      updateData['timestamps.completedAt'] = now;
      break;
    case 'cancelled':
      updateData['timestamps.cancelledAt'] = now;
      break;
  }
  
  // Add metadata
  Object.assign(updateData, metadata);
  
  return await ServiceRequest.updateOne({ requestId }, updateData);
}

// Calculate profile completeness percentage
function calculateProfileCompleteness(profile, requiredFields = ['name', 'email', 'phone', 'address', 'city']) {
  const completedFields = requiredFields.filter(field => 
    profile[field] && 
    profile[field].toString().trim() !== ''
  );
  return Math.round((completedFields.length / requiredFields.length) * 100);
}

// Enhanced getBestProviderLocation function for better location handling
function getBestProviderLocation(provider) {
  // Prefer live location if recent (within last 5 minutes)
  if (provider.currentLocation?.lat && provider.currentLocation?.lng) {
    const lastUpdate = new Date(provider.currentLocation.lastUpdated);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    if (lastUpdate > fiveMinutesAgo) {
      return {
        lat: provider.currentLocation.lat,
        lng: provider.currentLocation.lng,
        type: 'live',
        lastUpdated: provider.currentLocation.lastUpdated
      };
    }
  }
  
  // Fall back to profile location
  if (provider.location?.latitude && provider.location?.longitude) {
    return {
      lat: provider.location.latitude,
      lng: provider.location.longitude,
      type: 'profile',
      lastUpdated: provider.location.lastUpdated
    };
  }
  
  return null;
}

// Calculate effective distance considering location accuracy
function calculateEffectiveDistance(userLat, userLng, providerLocation) {
  if (!providerLocation) return null;
  
  const baseDistance = calculateDistance(
    userLat, 
    userLng, 
    providerLocation.lat, 
    providerLocation.lng
  );
  
  // Add uncertainty factor for older locations
  if (providerLocation.type === 'profile') {
    return baseDistance + 0.5; // Add 500m uncertainty for profile locations
  }
  
  return baseDistance;
}

module.exports = {
  calculateDistance,
  formatDistance,
  toRadians,
  RequestStatusFlow,
  isValidStatusTransition,
  updateRequestStatusWithTimestamp,
  calculateProfileCompleteness,
  getBestProviderLocation,
  calculateEffectiveDistance
};