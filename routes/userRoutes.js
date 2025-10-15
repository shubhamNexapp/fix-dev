const express = require("express");
const router = express.Router();
const { authenticateProvider } = require("../middlewares/authMiddleware");

const { getUserById, updateUserById , getServiceHistory} = require("../controllers/userController");

router.get("/profile/:userId", authenticateProvider, getUserById);
router.put("/profile/:userId", authenticateProvider, updateUserById);
router.get("/service-history/:userId", authenticateProvider, getServiceHistory);

module.exports = router;