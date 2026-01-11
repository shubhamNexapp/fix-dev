const express = require("express");
const router = express.Router();

const {
  createRequest,
  getNearbyProviders,
  acceptRequest,
  rejectRequest,
  verifyCompletionOtp,
  getUserRequests,
  getProviderRequests
} = require("../controllers/traditionalServiceController");

router.post("/create", createRequest);
router.post("/:id/providers", getNearbyProviders);

router.post("/:id/accept", acceptRequest);
router.post("/:id/reject", rejectRequest);
router.post("/:id/verify-otp", verifyCompletionOtp);

router.get("/user/:userId", getUserRequests);
router.get("/provider/:providerId", getProviderRequests);

module.exports = router;
