# 🎯 Progressive Search Data Specification

## Backend Implementation Status: ✅ COMPLETE

This document details the exact data flow between frontend and backend for the progressive search system with 30-second intervals.

---

## 📤 **Frontend → Backend (Service Request)**

### **Socket Event: `serviceRequest`**
```json
{
  "requestId": "req_1726920600000_xyz789",
  "userId": "670e1234567890abcdef5678", 
  "serviceType": "painter",
  "serviceName": "Painter",
  "serviceIcon": "🎨",
  "serviceDescription": "Professional painting services",
  "description": "Need wall painting for 2BHK apartment",
  "userLocation": {
    "latitude": 12.9716,
    "longitude": 77.5946
  },
  "urgency": "normal"
}
```

**Required Fields**: `requestId`, `userId`, `serviceType`, `description`, `userLocation`  
**Optional Fields**: `serviceName`, `serviceIcon`, `serviceDescription`, `urgency`

---

## 📥 **Backend → Frontend (Progressive Search Updates)**

### **1. Immediate Confirmation: `serviceRequestConfirmed`**
```json
{
  "requestId": "req_1726920600000_xyz789",
  "searchPhase": 1,
  "searchRadius": 1,
  "providerCount": 0,
  "status": "searching",
  "message": "Searching within 1km radius...",
  "serviceType": "painter",
  "elapsedTime": 0
}
```

### **2. Phase Updates (Every 30s): `searchPhaseUpdate`**
```json
{
  "requestId": "req_1726920600000_xyz789",
  "searchPhase": 2,
  "searchRadius": 2,
  "message": "Expanding search to 2km radius",
  "elapsedTime": 30,
  "status": "searching"
}
```

### **3. Providers Found: `providersFound`**
```json
{
  "requestId": "req_1726920600000_xyz789",
  "providerCount": 3,
  "searchRadius": 2,
  "searchPhase": 2,
  "nearestDistance": 1.3,
  "status": "providers_found",
  "message": "Found 3 providers within 2km!",
  "elapsedTime": 45
}
```

### **4. Search Timeout: `searchTimeout`**
```json
{
  "requestId": "req_1726920600000_xyz789",
  "message": "No painter providers found within 4km after 2 minutes",
  "searchPhase": 4,
  "searchRadius": 4,
  "elapsedTime": 120
}
```

---

## 📨 **Backend → Providers (Service Request Notification)**

### **Socket Event: `incomingServiceRequest`**
```json
{
  "requestId": "req_1726920600000_xyz789",
  "userId": "670e1234567890abcdef5678",
  "serviceType": "painter",
  "serviceName": "Painter",
  "description": "Need wall painting for 2BHK apartment",
  "userLocation": {
    "latitude": 12.9716,
    "longitude": 77.5946
  },
  "providerId": "670e9876543210fedcba4321",
  "distance": 1.3,
  "userDistance": "1.3km away",
  "searchPhase": 2,
  "searchRadius": 2,
  "priority": "high",
  "elapsedTime": 45,
  "urgency": "normal"
}
```

**New Fields Added**:
- ✅ `searchPhase`: Current search phase (1-4)
- ✅ `searchRadius`: Current search radius in km
- ✅ `priority`: Request priority based on search phase
- ✅ `elapsedTime`: Seconds since search started

---

## ⚙️ **Backend Configuration**

### **Updated Constants in `utils/locationUtils.js`**:
```javascript
const PROXIMITY_CONFIG = {
  DEFAULT_RADIUS_KM: 1,         // Start at 1km
  MAX_RADIUS_KM: 4,             // Maximum 4km (reduced from 5)
  RADIUS_INCREMENT_KM: 1,       // Expand by 1km each phase
  PHASE_DURATION_SECONDS: 30,   // 30 seconds per phase
  MAX_SEARCH_TIME_SECONDS: 120, // 2 minutes total search time
  MAX_PROVIDERS_PER_REQUEST: 10,
  LOCATION_REQUIRED: true
};
```

---

## 🕐 **Progressive Search Timeline**

| Phase | Time Range | Search Radius | Priority | Status |
|-------|------------|---------------|----------|---------|
| 1 | 0-30s | 1km | High | Searching |
| 2 | 30-60s | 2km | High | Searching |
| 3 | 60-90s | 3km | Medium | Searching |  
| 4 | 90-120s | 4km | Low | Searching |
| Timeout | >120s | - | - | Timeout |

---

## 🔧 **Provider Priority Logic**

```javascript
// Priority calculation based on search phase
const priority = searchPhase <= 2 ? 'high' : 
                 searchPhase === 3 ? 'medium' : 'low';
```

- **High Priority**: Found in first 60 seconds (1-2km)
- **Medium Priority**: Found in 60-90 seconds (3km)  
- **Low Priority**: Found in final phase (4km)

---

## 📊 **Socket Event Summary**

### **New Events Implemented**:
1. ✅ `searchPhaseUpdate` - Sent every 30 seconds during search
2. ✅ `providersFound` - Sent when providers are discovered
3. ✅ `searchTimeout` - Sent after 120 seconds with no providers

### **Enhanced Events**:
1. ✅ `serviceRequestConfirmed` - Now includes progressive search data
2. ✅ `incomingServiceRequest` - Now includes priority and phase data

---

## 🎯 **Expected User Experience**

```
0s:   🎯 "Searching within 1km radius..."
30s:  📍 "Expanding search to 2km radius"  
60s:  🔍 "Expanding search to 3km radius"
90s:  📡 "Final search within 4km..."
120s: ❌ "No providers found within 4km after 2 minutes"
```

**OR**

```
45s: ✅ "Found 3 providers within 2km!" (success in phase 2)
```

---

## 🚀 **Implementation Status**

- ✅ **Progressive Search Algorithm**: 30-second intervals implemented
- ✅ **Socket Events**: All new events created and sending correct data
- ✅ **Configuration**: Updated for 1-4km range with timing
- ✅ **Priority System**: High/Medium/Low based on search phase
- ✅ **Timeout Handling**: 120-second maximum search time
- ✅ **Data Structure**: All required fields included
- ✅ **Backward Compatibility**: Existing fields preserved

The backend is now **100% compatible** with the frontend's progressive search UI and will provide all the data needed for the enhanced user experience! 🎯