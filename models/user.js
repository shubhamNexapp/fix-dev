const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  // Java Auth Integration - Links to PostgreSQL user ID
  javaUserId: { 
    type: Number, 
    sparse: true,  // Allow null for backward compatibility with existing users
    index: true 
  },

  // Basic authentication fields
  isDeleted: { type: Boolean, default: false },
  email: { type: String, unique: true, required: true },
  password: { type: String }, // Optional now - Java Auth handles authentication

  // Enhanced profile fields for frontend compatibility
  name: { type: String, default: "" },
  fullName: { type: String, default: "" }, // NEW: Full name field for frontend
  phone: { type: String, default: "" },
  address: { type: String, default: "" },
  city: { type: String, default: "" },
  pincode: { type: String, default: "" }, // NEW: Pincode field for frontend
  emergencyContact: { type: String, default: "" }, // NEW: Emergency contact field
  userId: { type: Number },
  role: { type: String, default: 'user' }, // Role field

  // Location data
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    lastUpdated: { type: Date, default: null }
  },

  // Profile management
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  // User preferences
  preferences: {
    notifications: { type: Boolean, default: true },
    locationSharing: { type: Boolean, default: true }
  },

  // User statistics
  stats: {
    totalRequests: { type: Number, default: 0 },
    completedRequests: { type: Number, default: 0 },
    cancelledRequests: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 }
  }
}, {
  timestamps: true // This adds createdAt and updatedAt automatically
});

// Indexes for efficient querying (email index already created by unique: true in schema)
userSchema.index({ phone: 1 });
userSchema.index({ "location.lat": 1, "location.lng": 1 });
userSchema.index({ javaUserId: 1 }); // Index for Java Auth user ID lookups

const User = mongoose.model("User", userSchema);

module.exports = User;