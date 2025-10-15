const express = require("express");
const router = express.Router();

const { register, login, providerRegister, providerLogin, getUsers, updateProviderProfile, getProviderProfile, updateProviderLocation } = require("../controllers/authController");

// Get all users
router.get("/users", getUsers);

// User routes
router.post("/register", register);
router.post("/signup", register); // Alternative endpoint for consistency
router.post("/login", login);

// Service provider routes
router.post("/provider/register", providerRegister);
router.post("/provider/signup", providerRegister); // Alternative endpoint for consistency
router.post("/provider/login", providerLogin);
router.put("/provider/profile", updateProviderProfile); // Update provider profile
router.get("/provider/profile/:providerId", getProviderProfile); // Get provider profile
router.put("/provider/location", updateProviderLocation); // Update provider location

module.exports = router;
