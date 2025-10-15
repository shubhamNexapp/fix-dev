# 🚀 Live Location Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
# This includes socket.io-client for testing
```

### 2. Start the Server
```bash
npm start
# or for development
npm run dev
```

### 3. Run Migration (First Time Setup)
```bash
# Preview what will be migrated (recommended first)
npm run migrate:location

# Apply the migration (after reviewing)
# Edit migrate_live_location.js and set DRY_RUN = false, then:
npm run migrate:location
```

### 4. Test Live Location Features
```bash
npm run test:location
```

## ✅ Verification Checklist

After setup, verify these work:

- [ ] Server starts without errors
- [ ] Socket.IO connections work (check console logs)
- [ ] Provider schema includes new live location fields
- [ ] Existing providers migrated successfully
- [ ] Test script completes all checks

## 🔧 Configuration

### Environment Variables
Make sure your `.env` file includes:
```
MONGO_URI=mongodb://localhost:27017/fixhomi
PORT=5050
```

### Live Location Settings
Customize in `utils/locationUtils.js`:
```javascript
PROXIMITY_CONFIG.LIVE_LOCATION = {
  UPDATE_INTERVAL_MS: 30000,    // How often to accept updates
  MIN_DISTANCE_THRESHOLD_M: 50, // Minimum movement to process
  // ... other settings
}
```

## 📱 Frontend Integration

Your React Native app should now:

1. **Connect to socket** with provider registration
2. **Send location updates** via `providerLocationUpdate` event
3. **Handle confirmations** via `locationUpdateConfirmed` event
4. **Manage online status** via `providerStatusUpdate` event

## 🆘 Troubleshooting

### Common Issues:

1. **Socket connection fails**
   - Check server is running on correct port
   - Verify CORS settings in server.js

2. **Location updates not saving**
   - Check coordinate validation (lat: -90 to 90, lng: -180 to 180)
   - Verify GPS accuracy is acceptable (<100m)

3. **Migration fails**
   - Ensure database connection is working
   - Check console logs for specific errors
   - Run with DRY_RUN=true first

4. **Providers not appearing in search**
   - Verify they have location data
   - Check if they're marked as online
   - Confirm service categories match search

## 📊 Monitoring

Monitor these metrics in production:
- Location update frequency per provider
- Socket connection stability
- Database query performance
- GPS accuracy distribution

## 🔄 Next Steps

1. Deploy to production environment
2. Test with real mobile devices
3. Monitor location update patterns
4. Optimize based on usage analytics
5. Implement additional features like geofencing

## 📞 Support

If you encounter issues:
1. Check the console logs
2. Run the test script: `npm run test:location`
3. Review the documentation: `LIVE_LOCATION_DOCUMENTATION.md`
4. Verify your provider data with the migration script