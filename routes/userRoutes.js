const express = require("express");
const router = express.Router();
const { authenticateProvider } = require("../middlewares/authMiddleware");

const { 
    registerUser,
    getUserById, 
    updateUserById, 
    getServiceHistory, 
    getAllUsers
} = require("../controllers/userController");

// ============ PUBLIC ROUTES ============
// User Registration (no authentication required)
router.post("/register", registerUser);

// ============ PROTECTED ROUTES ============
router.get("/profile/users", getAllUsers);
router.get("/profile/:userId", authenticateProvider, getUserById);
router.put("/profile/:userId", authenticateProvider, updateUserById);
router.get("/service-history/:userId", authenticateProvider, getServiceHistory);

module.exports = router;