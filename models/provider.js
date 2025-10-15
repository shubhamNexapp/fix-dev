const mongoose = require("mongoose");

const providerSchema = mongoose.Schema({
  isDeleted: { type: Boolean, default: false },
  email: { type: String, unique: true },
  password: { type: String },
  address: { type: String },
  // New service-related fields
  name: { type: String, default: "" },
  phone: { type: String, default: "" },
  serviceCategories: {
    type: [String],
    default: ["plumber", "electrician", "carpenter", "painter", "ac_repair", "cleaning"],
    validate: {
      validator: function (v) {
        const allowedCategories = ["plumber", "electrician", "carpenter", "painter", "ac_repair", "cleaning"];
        return v.every(category => allowedCategories.includes(category));
      },
      message: 'Invalid service category'
    }
  },
  serviceTypes: { type: [String], default: [] },
  experience: { type: String, default: "0 years" },
  providerId: { type: String, },
  role: { type: String, default: 'provider' }, // Role field

  // Enhanced rating system
  rating: { type: Number, default: 0, min: 0, max: 5 }, // Keep for backward compatibility
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    total: { type: Number, default: 0 },
    breakdown: {
      5: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      1: { type: Number, default: 0 }
    }
  },

  // Profile management
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  // Enhanced statistics
  stats: {
    totalRequests: { type: Number, default: 0 },
    completedRequests: { type: Number, default: 0 },
    cancelledRequests: { type: Number, default: 0 },
    responseTime: { type: Number, default: 0 }, // Average response time in minutes
    completionRate: { type: Number, default: 0 }, // Percentage
    totalEarnings: { type: Number, default: 0 }
  },

  // Availability management
  availability: {
    isOnline: { type: Boolean, default: false },
    workingHours: {
      monday: { start: { type: String, default: "09:00" }, end: { type: String, default: "18:00" } },
      tuesday: { start: { type: String, default: "09:00" }, end: { type: String, default: "18:00" } },
      wednesday: { start: { type: String, default: "09:00" }, end: { type: String, default: "18:00" } },
      thursday: { start: { type: String, default: "09:00" }, end: { type: String, default: "18:00" } },
      friday: { start: { type: String, default: "09:00" }, end: { type: String, default: "18:00" } },
      saturday: { start: { type: String, default: "09:00" }, end: { type: String, default: "16:00" } },
      sunday: { start: { type: String, default: "10:00" }, end: { type: String, default: "16:00" } }
    },
    unavailableDates: [{ type: Date }]
  },

  // Verification status
  verification: {
    isVerified: { type: Boolean, default: false },
    documents: [{ type: String }], // Document URLs
    verifiedAt: { type: Date, default: null }
  },

  isAvailable: { type: Boolean, default: true },
  // Static location fields for profile setup
  location: {
    latitude: {
      type: Number,
      default: null,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      default: null,
      min: -180,
      max: 180
    },
    address: {
      type: String,
      default: ""
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },

  // NEW: Live location tracking fields
  currentLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    lastUpdated: { type: Date, default: null }
  },

  // NEW: Online status management
  isOnline: { type: Boolean, default: false },
  lastOnline: { type: Date, default: null },

  // NEW: Location tracking settings
  locationTracking: {
    enabled: { type: Boolean, default: false },
    updateInterval: { type: Number, default: 30000 }, // 30 seconds
    minDistance: { type: Number, default: 50 } // 50 meters
  },

  // NEW: Location history for analytics (optional)
  locationHistory: [{
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    timestamp: { type: Date, default: Date.now }
  }]
});

// Create geospatial indexes for efficient location-based queries
// Static location index for profile-based searches
providerSchema.index({
  "location.latitude": 1,
  "location.longitude": 1
});

// NEW: Live location index for real-time proximity searches
providerSchema.index({
  "currentLocation.lat": 1,
  "currentLocation.lng": 1,
  "isOnline": 1
});

// NEW: Compound index for live location queries with service categories
providerSchema.index({
  "serviceCategories": 1,
  "isOnline": 1,
  "currentLocation.lat": 1,
  "currentLocation.lng": 1
});

// Alternative: Create a 2dsphere index for more advanced geospatial operations
// Uncomment if using MongoDB's geospatial features extensively
// providerSchema.index({ "currentLocation": "2dsphere" });

const Provider = mongoose.model("Provider", providerSchema);

module.exports = Provider;
