const express = require("express");
const router = express.Router();
const { authenticateProvider } = require("../middlewares/authMiddleware");

const { acceptedRequest, completeRequest } = require("../controllers/providerController");

router.post("/accepted-requests/:providerId", authenticateProvider, acceptedRequest);
router.get("/complete-request", authenticateProvider, completeRequest);

module.exports = router;