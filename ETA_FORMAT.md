# Enhanced ETA Format Documentation

## Overview

The backend now supports both legacy and new structured ETA formats for better time management and user experience.

## Frontend to Backend: Provider Response Format

### New Format (Recommended)
```javascript
// Provider accepts with time picker selection
socket.emit('providerResponse', {
  requestId: "req_123",
  providerId: "provider_456", 
  response: "accept",
  estimatedTime: "2025-09-22T17:30:00.000Z",     // ISO timestamp
  estimatedTimeFormatted: "5:30 PM",             // Human readable
  estimatedDuration: "3h 30m"                    // Duration from now
});
```

### Legacy Format (Still Supported)
```javascript
// Old format - still works
socket.emit('providerResponse', {
  requestId: "req_123",
  providerId: "provider_456",
  response: "accept", 
  estimatedTime: "30 minutes"  // Free text duration
});
```

## Backend to Frontend: User Notification Format

### New Enhanced Format
```javascript
// User receives structured ETA data
{
  requestId: "req_123",
  providerId: "provider_456",
  response: "accept",
  estimatedTime: "2025-09-22T17:30:00.000Z",  // Legacy field
  providerName: "John Smith",
  providerPhone: "+1234567890",
  
  // NEW: Structured ETA object
  eta: {
    completionTime: "2025-09-22T17:30:00.000Z",  // ISO timestamp
    displayTime: "5:30 PM",                      // Show to user
    timeFromNow: "3h 30m",                       // Duration text
    isToday: true                                 // Helper for UI
  }
}
```

## Database Storage

### ServiceRequest Model Enhancement
```javascript
{
  // Legacy field (maintained for compatibility)
  estimatedTime: "30 minutes",
  
  // NEW: Structured ETA data
  eta: {
    estimatedCompletionTime: Date,     // Actual completion timestamp
    estimatedTimeFormatted: String,    // "3:30 PM"
    estimatedDuration: String,         // "2h 30m"
    lastUpdated: Date                  // When ETA was set/updated
  }
}
```

## Utility Functions Available

- `isToday(date)` - Check if date is today
- `formatTimeForDisplay(isoString)` - Convert ISO to "3:30 PM" format
- `calculateDurationFromNow(isoString)` - Calculate time remaining
- `processETAData(estimatedTime, formatted, duration)` - Process all ETA formats

## Migration Notes

1. **Backward Compatibility**: Old format still works completely
2. **New Features**: Enhanced UI requires new structured format
3. **Database**: Both old and new data stored for transition period
4. **Frontend**: Can detect format and handle appropriately

## Usage Examples

### Frontend Time Picker Integration
```javascript
// Frontend generates and sends:
const selectedTime = "2025-09-22T15:30:00.000Z";
const formatted = "3:30 PM";
const duration = "1h 45m";

socket.emit('providerResponse', {
  requestId,
  providerId,
  response: 'accept',
  estimatedTime: selectedTime,
  estimatedTimeFormatted: formatted,
  estimatedDuration: duration
});
```

### User Interface Display
```javascript
// Frontend receives and displays:
if (response.eta.completionTime) {
  // New format
  showETA(`Service ETA: ${response.eta.displayTime} (${response.eta.timeFromNow} from now)`);
} else {
  // Legacy format
  showETA(`Estimated time: ${response.estimatedTime}`);
}
```

## Testing

Test both formats work:

1. **New Format**: Use time picker on provider app
2. **Legacy Format**: Send old-style duration text
3. **User Display**: Verify both show appropriate messages
4. **Database**: Check both storage formats persist correctly
