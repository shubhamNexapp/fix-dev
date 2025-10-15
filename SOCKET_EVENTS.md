# Socket.IO Events Documentation

## Server Configuration
- **Port**: 5050
- **CORS**: Enabled for all origins (configure for production)
- **Transport**: WebSocket with fallback

## In-Memory Data Structures

- `connectedUsers` - Map of userId → socketId for connected users
- `connectedProviders` - Map of providerId → socketId for connected providers  
- `activeRequests` - Map of requestId → request data for ongoing service requests
- `userLocations` - Map of userId → { latitude, longitude, timestamp } for location tracking

## Authentication Updates

### User Authentication
- **Login**: `POST /auth/login` → Returns `{ success, userId, userType: 'user' }`
- **Signup**: `POST /auth/register` or `/auth/signup` → Returns `{ success, userId, userType: 'user' }`

### Provider Authentication  
- **Login**: `POST /auth/provider/login` → Returns `{ success, providerId, userType: 'provider' }`
- **Signup**: `POST /auth/provider/register` or `/auth/provider/signup` → Returns `{ success, providerId, userType: 'provider' }`

## Frontend → Backend Events

### `register`
Register a user or provider when they connect (with validation)
```javascript
socket.emit('register', {
  userId: 'user123', // Real database ID from auth response
  userType: 'user' // or 'provider'
});

// Response:
socket.on('registered', (data) => {
  // { success: true, userId, userType, message }
});
```

### `locationUpdate`
Send location updates (with validation)
```javascript
socket.emit('locationUpdate', {
  userId: 'user123',
  latitude: 40.7128,
  longitude: -74.0060,
  timestamp: new Date() // optional
});
```

### `serviceRequest`
Submit a new service request (with enhanced validation)
```javascript
socket.emit('serviceRequest', {
  requestId: 'req_123',
  userId: 'user123', // Must be registered user
  serviceType: 'plumbing',
  description: 'Leaky faucet repair',
  userLocation: { latitude: 40.7128, longitude: -74.0060 },
  urgency: 'medium'
});
```

### `providerResponse`
Respond to a service request (with validation)
```javascript
socket.emit('providerResponse', {
  requestId: 'req_123',
  providerId: 'provider456', // Must be registered provider
  response: 'accept', // or 'decline'
  estimatedTime: '30 minutes'
});
```

## Backend → Frontend Events

### `registered`
Confirmation of successful registration
```javascript
socket.on('registered', (data) => {
  // { success: true, userId, userType, message }
});
```

### `incomingServiceRequest`
Broadcast new service requests to all providers (enhanced)
```javascript
socket.on('incomingServiceRequest', (data) => {
  // data contains: requestId, userId, serviceType, description, location, urgency, status, timestamp, providerId
});
```

### `providerResponse`
Notify users of provider responses to their requests (enhanced)
```javascript
socket.on('providerResponse', (data) => {
  // data contains: requestId, providerId, response, estimatedTime, status, providerInfo
});
```

### `error`
Error messages for validation failures
```javascript
socket.on('error', (data) => {
  // { message: 'Error description', missing?: ['field1', 'field2'] }
});
```

## Validation & Error Handling

- **Required field validation** for all events
- **User/provider registration validation** before allowing requests
- **Request existence validation** for provider responses
- **Detailed error messages** with missing field information

## Server Logs

Enhanced logging includes:
- ✅ Client connections/disconnections
- ✅ User/provider registrations with validation
- ✅ Location updates with storage
- ✅ Service request submissions and broadcasts with user verification
- ✅ Provider responses with validation
- ✅ Connection cleanup and error handling

## Health Check

GET `/` endpoint returns enhanced information:
```json
{
  "message": "Fixhomi Backend API",
  "connectedUsers": 0,
  "connectedProviders": 0,
  "activeRequests": 0,
  "userLocations": 0,
  "users": ["userId1", "userId2"],
  "providers": ["providerId1", "providerId2"],
  "timestamp": "2025-09-14T...",
  "socketServer": "Socket.IO enabled",
  "status": "running"
}
```

## Testing Flow

1. **User Registration/Login** → Backend returns real `userId` and `userType: 'user'`
2. **Provider Registration/Login** → Backend returns real `providerId` and `userType: 'provider'`
3. **Socket Registration** → Frontend uses real IDs to register on socket
4. **Location Updates** → Stored in `userLocations` map for proximity matching
5. **Service Requests** → Validated and broadcasted to all registered providers
6. **Provider Responses** → Validated and sent back to requesting user

## Key Improvements

- ✅ **Real Database IDs**: Uses actual MongoDB ObjectIDs instead of emails
- ✅ **Enhanced Validation**: Comprehensive field validation with error messages
- ✅ **Location Storage**: Persistent location tracking for users/providers
- ✅ **Error Handling**: Proper error responses for invalid data
- ✅ **Registration Verification**: Ensures users/providers are properly registered
- ✅ **Enhanced Logging**: Detailed logs for debugging and monitoring
