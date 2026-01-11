// models/eventService.model.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const allowedServiceTypes = ["photographer", "influencer"];

const attachmentSchema = new Schema({
  url: { type: String, required: true },
  mimeType: { type: String },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const eventServiceSchema = new Schema({
  isDeleted: { type: Boolean, default: false },
  isAccepted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },

  requestId: { type: String, required: true, unique: true },
  serviceId: { type: String },
  userId: { type: String, ref: "User", required: true },
  providerId: { type: String, ref: "Provider", default: null },

  serviceType: {
    type: String,
    required: true,
    enum: allowedServiceTypes,
  },
  serviceName: { type: String, required: true },
  serviceDescription: { type: String, default: "" },

  eventDate: { type: Date, required: true }, // important for duplicate booking restriction
  notes: { type: String, default: "" },

  status: {
    type: String,
    enum: ["pending", "accepted", "completed", "cancelled", "rejected"],
    default: "pending",
  },

  acceptedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },

  // OTP for completion verification
  completionOtp: { type: String, default: null },
  otpExpiresAt: { type: Date, default: null },
  otpVerified: { type: Boolean, default: false },

  pricing: {
    estimatedCost: { type: Number, default: null },
    actualCost: { type: Number, default: null },
    currency: { type: String, default: "INR" },
  },

  ratings: {
    userRating: { type: Number, min: 1, max: 5, default: null },
    providerRating: { type: Number, min: 1, max: 5, default: null },
  },

  attachments: [attachmentSchema],
}, { timestamps: true });

// unique index to prevent duplicate booking (same user, same serviceType, same eventDate)
eventServiceSchema.index({ userId: 1, serviceType: 1, eventDate: 1 }, { unique: true });

// Pre-validate to generate requestId
eventServiceSchema.pre("validate", function (next) {
  if (!this.requestId) {
    const short = Date.now().toString(36);
    const rnd = Math.floor(Math.random() * 9000) + 1000;
    this.requestId = `EVT-${short}-${rnd}`;
  }
  next();
});

// Instance method: accept request
eventServiceSchema.methods.markAccepted = async function (providerId) {
  this.providerId = providerId;
  this.status = "accepted";
  this.isAccepted = true;
  this.acceptedAt = new Date();
  await this.save();
  return this;
};

// Instance method: mark completed
eventServiceSchema.methods.markCompleted = async function () {
  this.status = "completed";
  this.completedAt = new Date();
  await this.save();
  return this;
};

module.exports = mongoose.model("EventService", eventServiceSchema);
