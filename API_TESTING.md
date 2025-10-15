# API Testing Guide

## Server Status
- **Server URL**: `http://localhost:5050`
- **Socket.IO**: Enabled
- **Status**: ✅ Running

## Authentication Endpoints

### User Registration
```bash
curl -X POST http://localhost:5050/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "password123",
    "address": "123 Main St"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User registered successfully",
  "userId": "66e5b8f123456789abcdef12",
  "userType": "user",
  "data": { ... }
}
```

### User Login
```bash
curl -X POST http://localhost:5050/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "userId": "66e5b8f123456789abcdef12",
  "userType": "user",
  "data": { ... }
}
```

### Provider Registration
```bash
curl -X POST http://localhost:5050/auth/provider/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "provider@test.com",
    "password": "password123",
    "address": "456 Service Ave"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Provider registered successfully",
  "providerId": "66e5b8f123456789abcdef34",
  "userType": "provider",
  "data": { ... }
}
```

### Provider Login
```bash
curl -X POST http://localhost:5050/auth/provider/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "provider@test.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Provider login successful",
  "providerId": "66e5b8f123456789abcdef34",
  "userType": "provider",
  "data": { ... }
}
```

## Health Check
```bash
curl http://localhost:5050/
```

**Expected Response:**
```json
{
  "message": "Fixhomi Backend API",
  "connectedUsers": 0,
  "connectedProviders": 0,
  "activeRequests": 0,
  "userLocations": 0,
  "users": [],
  "providers": [],
  "timestamp": "2025-09-14T...",
  "socketServer": "Socket.IO enabled",
  "status": "running"
}
```

## Socket.IO Testing

### Frontend JavaScript Example
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5050');

// 1. Register after login
socket.emit('register', {
  userId: 'USER_ID_FROM_LOGIN_RESPONSE',
  userType: 'user' // or 'provider'
});

// 2. Listen for registration confirmation
socket.on('registered', (data) => {
  console.log('Registered:', data);
});

// 3. Send location update (for users/providers)
socket.emit('locationUpdate', {
  userId: 'USER_ID',
  latitude: 40.7128,
  longitude: -74.0060
});

// 4. Send service request (for users)
socket.emit('serviceRequest', {
  requestId: 'req_' + Date.now(),
  userId: 'USER_ID',
  serviceType: 'plumbing',
  description: 'Leaky faucet repair',
  userLocation: { latitude: 40.7128, longitude: -74.0060 },
  urgency: 'medium'
});

// 5. Listen for incoming requests (providers)
socket.on('incomingServiceRequest', (request) => {
  console.log('New service request:', request);
});

// 6. Respond to request (providers)
socket.emit('providerResponse', {
  requestId: 'req_12345',
  providerId: 'PROVIDER_ID',
  response: 'accept',
  estimatedTime: '30 minutes'
});

// 7. Listen for provider responses (users)
socket.on('providerResponse', (response) => {
  console.log('Provider response:', response);
});

// 8. Handle errors
socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

## Testing Flow

1. **Register/Login User** → Get real `userId`
2. **Register/Login Provider** → Get real `providerId`
3. **Connect to Socket.IO** → Use real IDs
4. **Register on Socket** → Frontend sends registration
5. **Send Location Updates** → Track user/provider locations
6. **Create Service Request** → User requests help
7. **Provider Responds** → Provider accepts/declines
8. **Real-time Updates** → Both sides get notifications

## Key Features Implemented

✅ **Real Database IDs**: Uses MongoDB ObjectIDs from auth responses  
✅ **Enhanced Validation**: Comprehensive field validation with error messages  
✅ **Location Storage**: Persistent location tracking in `userLocations` map  
✅ **Error Handling**: Proper error responses for invalid data  
✅ **Registration Verification**: Ensures users/providers are properly registered  
✅ **Enhanced Logging**: Detailed logs for debugging and monitoring  
✅ **Health Monitoring**: Comprehensive status endpoint with connection details
