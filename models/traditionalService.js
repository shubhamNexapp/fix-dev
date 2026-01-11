const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Allowed traditional services
 */
const TRADITIONAL_SERVICES = [
  "electrician",
  "plumber",
  "electronics_technician",
  "carpenter",
  "painter",
  "solar_repairing",
  "welder",
  "salon",
  "vehicle_cleaning",
  "mason_tiler",
  "driver"
];

/**
 * Track rejected providers per request
 */
const rejectedProviderSchema = new Schema(
  {
    providerId: { type: String, ref: "Provider", required: true },
    rejectedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const traditionalServiceSchema = new Schema(
  {
    // soft delete
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },

    // ids
    requestId: { type: String, unique: true },
    serviceId: { type: String },

    userId: { type: String, ref: "User", required: true },
    providerId: { type: String, ref: "Provider", default: null },

    // service
    serviceType: {
      type: String,
      enum: TRADITIONAL_SERVICES,
      required: true
    },

    description: { type: String, default: "" },

    /**
     * GeoJSON location
     */
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true
      }
    },

    serviceDate: { type: Date, required: true },

    status: {
      type: String,
      enum: ["pending", "accepted", "completed", "cancelled", "rejected"],
      default: "pending"
    },

    acceptedAt: Date,
    completedAt: Date,
    rejectedAt: Date,

    /**
     * OTP verification
     */
    completionOtp: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    otpVerified: { type: Boolean, default: false },

    /**
     * Providers rejected during provider cycling
     */
    rejectedProviders: [rejectedProviderSchema],

    pricing: {
      estimatedCost: Number,
      actualCost: Number,
      currency: { type: String, default: "INR" }
    }
  },
  { timestamps: true }
);

/**
 * Geo index for proximity search
 */
traditionalServiceSchema.index({ location: "2dsphere" });

/**
 * Prevent same provider booking on same date
 */
traditionalServiceSchema.index(
  { userId: 1, providerId: 1, serviceDate: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "accepted"] }
    }
  }
);

/**
 * Generate requestId
 */
traditionalServiceSchema.pre("validate", function (next) {
  if (!this.requestId) {
    const short = Date.now().toString(36);
    const rnd = Math.floor(Math.random() * 9000) + 1000;
    this.requestId = `TRD-${short}-${rnd}`;
  }
  next();
});

/**
 * Accept service
 */
traditionalServiceSchema.methods.acceptService = async function (providerId) {
  this.providerId = providerId;
  this.status = "accepted";
  this.acceptedAt = new Date();
  await this.save();
  return this;
};

/**
 * Complete service
 */
traditionalServiceSchema.methods.completeService = async function () {
  this.status = "completed";
  this.completedAt = new Date();
  this.otpVerified = true;
  await this.save();
  return this;
};

module.exports = mongoose.model(
  "TraditionalService",
  traditionalServiceSchema
);
