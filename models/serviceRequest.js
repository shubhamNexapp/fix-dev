const mongoose = require("mongoose");

const serviceRequestSchema = mongoose.Schema({
  isDeleted: { type: Boolean, default: false },
  requestId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  providerId: { type: String, default: null }, // Reference to assigned provider

  // Service details
  serviceType: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        const allowedCategories = ["plumber", "electrician", "carpenter", "painter", "ac_repair", "cleaning"];
        return allowedCategories.includes(v);
      },
      message: 'Invalid service type'
    }
  },
  serviceName: { type: String, required: true },
  serviceIcon: { type: String, required: true },
  serviceCategory: { type: String, default: function () { return this.serviceType; } },
  serviceDescription: { type: String, required: true },
  description: { type: String, required: true },
  serviceId: { type: String, },

 // Profile management
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },


  // Location information
  location: {
    latitude: { type: Number, required: false }, // Made optional for backward compatibility
    longitude: { type: Number, required: false }, // Made optional for backward compatibility
    address: { type: String, default: "" },
    landmark: { type: String, default: "" }
  },
  // Keep userLocation for backward compatibility
  userLocation: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },

  // Request status and priority
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in-progress', 'completed', 'cancelled', 'rejected'],
    default: 'pending'
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Enhanced timestamps
  timestamps: {
    createdAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null }
  },

  // Keep original timestamp for backward compatibility
  timestamp: { type: Date, default: Date.now },

  // Service execution details
  assignedProviderId: { type: String, default: null }, // Backward compatibility
  estimatedTime: { type: String, default: null }, // Legacy field for backward compatibility
  actualDuration: { type: String, default: null },
  completionNotes: { type: String, default: "" },

  // NEW: Enhanced ETA information
  eta: {
    estimatedCompletionTime: { type: Date, default: null }, // Actual timestamp when service will be completed
    estimatedTimeFormatted: { type: String, default: null }, // Human readable time like "3:30 PM"
    estimatedDuration: { type: String, default: null }, // Duration from acceptance like "2h 30m"
    lastUpdated: { type: Date, default: null } // When ETA was last updated
  },

  // Pricing information
  pricing: {
    estimatedCost: { type: Number, default: null },
    actualCost: { type: Number, default: null },
    currency: { type: String, default: "USD" }
  },

  // Rating system
  ratings: {
    userRating: { type: Number, min: 1, max: 5, default: null },
    providerRating: { type: Number, min: 1, max: 5, default: null },
    userReview: { type: String, default: "" },
    providerReview: { type: String, default: "" }
  },

  // Search and discovery metadata
  searchRadius: { type: Number, default: 1 },
  metadata: {
    searchPhase: { type: Number, default: 1 },
    providersContacted: [{ type: String }],
    responseTime: { type: Number, default: null }
  },

  // Media attachments
  attachments: [{ type: String }] // URLs to images/documents
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes for efficient querying (requestId index already created by unique: true in schema)
serviceRequestSchema.index({ userId: 1, "timestamps.createdAt": -1 });
serviceRequestSchema.index({ providerId: 1, "timestamps.acceptedAt": -1 });
serviceRequestSchema.index({ assignedProviderId: 1, "timestamp": -1 }); // Backward compatibility
serviceRequestSchema.index({ status: 1 });
serviceRequestSchema.index({ "location.latitude": 1, "location.longitude": 1 });
serviceRequestSchema.index({ "userLocation.latitude": 1, "userLocation.longitude": 1 }); // Backward compatibility

const ServiceRequest = mongoose.model("ServiceRequest", serviceRequestSchema);

module.exports = ServiceRequest;