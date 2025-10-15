const express = require("express");
const router = express.Router();

const { getUsers, getProviders, getServiceHistory, addUser, addProvider, deleteUser, deleteProvider, deleteServiceHistory, createAdmin, adminLogin, forgotPassword, resetPassword, updateUser, updateProvider } = require("../controllers/adminController");

// router.post("/create-admin", createAdmin);

router.post("/admin-login", adminLogin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/get-users", getUsers);
router.get("/get-providers", getProviders);
router.get("/get-service-history", getServiceHistory);

router.post("/add-user", addUser);
router.post("/update-user", updateUser);
router.post("/delete-user/:id", deleteUser);

router.post("/add-provider", addProvider);
router.post("/update-provider", updateProvider);
router.post("/delete-provider/:id", deleteProvider);

router.post("/delete-service-history/:id", deleteServiceHistory);

module.exports = router;