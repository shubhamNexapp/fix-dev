# FIXORA Backend - Profile & History API Documentation

## New API Endpoints Implementation

This document describes the newly implemented API endpoints for user profiles and service history management.

## Authentication
All API endpoints require authentication using Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## User Profile & History Endpoints

### 1. Get User Profile
**Endpoint:** `GET /api/user/profile/:userId`
**Authentication:** Required (User must own the profile)

**Response:**
```json
{
  "success": true,
  "profile": {
    "userId": "user123",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "address": "123 Main St",
    "city": "New York",
    "createdAt": "2025-09-22T10:30:00.000Z",
    "profileCompleteness": 85
  }
}
```

### 2. Get User Service History
**Endpoint:** `GET /api/user/service-history/:userId`
**Authentication:** Required (User must own the history)

**Query Parameters:**
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `status` (optional): Filter by status ("completed|cancelled|pending|accepted")

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "requestId": "req_123456789",
      "serviceName": "Plumber",
      "serviceIcon": "🔧",
      "description": "Fix kitchen sink leak",
      "status": "completed",
      "createdAt": "2025-09-20T14:30:00.000Z",
      "acceptedAt": null,
      "completedAt": null,
      "estimatedTime": "2 hours",
      "provider": {
        "providerId": "prov_987654321",
        "name": "John Smith",
        "phone": "+1234567890",
        "rating": 4.5,
        "experience": "5 years"
      },
      "userRating": null,
      "totalCost": null
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

## Provider History Endpoints

### 1. Get Provider Accepted Requests
**Endpoint:** `GET /api/provider/accepted-requests/:providerId`
**Authentication:** Required (Provider must own the requests)

**Query Parameters:**
- `limit` (optional): Number of results (default: 50)
- `status` (optional): Filter by status ("accepted|in-progress|completed")

**Response:**
```json
{
  "success": true,
  "requests": [
    {
      "requestId": "req_123456789",
      "serviceName": "Plumber",
      "serviceIcon": "🔧",
      "description": "Fix kitchen sink leak",
      "status": "completed",
      "acceptedAt": "2025-09-20T14:45:00.000Z",
      "completedAt": null,
      "estimatedTime": "2 hours",
      "user": {
        "userId": "user_456789123",
        "name": "Alice Johnson",
        "phone": "+1987654321",
        "address": "123 Main St, City, State",
        "lat": 40.7128,
        "lng": -74.0060
      },
      "provider": {
        "providerId": "prov_987654321",
        "lat": 40.7100,
        "lng": -74.0050
      },
      "userRating": null,
      "distance": "0.8km"
    }
  ],
  "stats": {
    "totalCompleted": 45,
    "totalActive": 3,
    "averageRating": 0,
    "totalEarnings": 0
  }
}
```

### 2. Complete Service Request
**Endpoint:** `POST /api/provider/complete-request`
**Authentication:** Required (Provider must own the request)

**Request Body:**
```json
{
  "requestId": "req_123456789",
  "providerId": "prov_987654321",
  "completedAt": "2025-09-22T16:30:00.000Z",
  "actualDuration": "2.5 hours",
  "completionNotes": "Successfully fixed leak and tested all connections"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Request marked as completed successfully",
  "requestId": "req_123456789",
  "completedAt": "2025-09-22T16:30:00.000Z"
}
```

## Enhanced Data Models

### User Model Enhancements
- Added `name`, `phone`, `city` fields
- Added `location` object with lat/lng coordinates
- Added `preferences` for user settings
- Added `stats` for tracking user activity
- Maintains backward compatibility with existing `address` field

### ServiceRequest Model Enhancements
- Added enhanced `timestamps` object with detailed timing
- Added `ratings` system for user/provider ratings
- Added `pricing` information structure
- Added `metadata` for search and discovery tracking
- Added `attachments` array for media files
- Maintains backward compatibility with existing fields

### Provider Model Enhancements
- Added enhanced `ratings` system with breakdown
- Added comprehensive `stats` tracking
- Added `availability` management with working hours
- Added `verification` status tracking
- Maintains backward compatibility with existing rating field

## Database Indexes

The following indexes have been added for optimal query performance:

### User Collection
- `{ email: 1 }` (unique)
- `{ phone: 1 }`
- `{ "location.lat": 1, "location.lng": 1 }`

### ServiceRequest Collection
- `{ requestId: 1 }` (unique)
- `{ userId: 1, "timestamps.createdAt": -1 }`
- `{ providerId: 1, "timestamps.acceptedAt": -1 }`
- `{ assignedProviderId: 1, "timestamp": -1 }` (backward compatibility)
- `{ status: 1 }`
- `{ "location.latitude": 1, "location.longitude": 1 }`

## Error Responses

All endpoints return consistent error responses:
```json
{
  "success": false,
  "message": "Error description"
}
```

Common error codes:
- `400`: Bad Request (missing or invalid parameters)
- `401`: Unauthorized (invalid or missing token)
- `403`: Forbidden (access denied)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

## Backward Compatibility

All changes maintain backward compatibility with existing frontend code:
- Original field names are preserved
- New fields are additive only
- Existing API behavior is unchanged
- Database queries support both old and new field structures

## Usage Examples

### Get User Profile
```bash
curl -X GET "http://localhost:5050/api/user/profile/user123" \
  -H "Authorization: Bearer <token>"
```

### Get Service History with Filtering
```bash
curl -X GET "http://localhost:5050/api/user/service-history/user123?status=completed&limit=10" \
  -H "Authorization: Bearer <token>"
```

### Complete a Service Request
```bash
curl -X POST "http://localhost:5050/api/provider/complete-request" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_123",
    "providerId": "prov_456",
    "actualDuration": "2 hours",
    "completionNotes": "Work completed successfully"
  }'
```

## Future Enhancements

The following features are prepared for future implementation:
- Rating system activation
- Pricing calculation
- Advanced search filters
- Real-time notifications
- File upload for attachments
- Provider verification workflow