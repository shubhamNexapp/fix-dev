// routes/eventService.routes.js
const express = require("express");
const router = express.Router();
const {
  createEventService,
  acceptEventService,
  rejectEventService,
  getUserBookings,
  getProviderBookings,
  verifyCompletionOtp,
} = require("../controllers/eventServicesController");

// user creates a booking
router.post("/create-service", createEventService);

// provider accepts/rejects booking
router.post("/:id/accept", acceptEventService);
router.post("/:id/reject", rejectEventService);
router.post("/:id/verify-otp", verifyCompletionOtp);

// list bookings
router.get("/user/:userId", getUserBookings);
router.get("/provider/:providerId", getProviderBookings);


module.exports = router;
