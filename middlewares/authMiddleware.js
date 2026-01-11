const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Provider = require("../models/provider");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (error) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

// Enhanced authentication middleware for users
const authenticateUser = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Extract javaUserId from JWT "sub" field (if present)
      const javaUserId = decoded.sub;
      
      let user;
      // Try to find user by javaUserId first (new auth flow)
      if (javaUserId) {
        user = await User.findOne({ javaUserId: javaUserId }).select("-password");
      }
      
      // Fallback to old auth flow (find by MongoDB _id)
      if (!user && decoded.id) {
        user = await User.findById(decoded.id).select("-password");
      }
      
      if (!user) {
        return res.status(401).json({ success: false, message: "User not found" });
      }
      
      req.user = user;
      req.user.userId = user._id.toString(); // Add userId for route compatibility
      req.user.javaUserId = user.javaUserId; // Add javaUserId if available
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: "Not authorized, token failed" });
    }
  } else {
    return res.status(401).json({ success: false, message: "Not authorized, no token" });
  }
};

// Enhanced authentication middleware for providers
const authenticateProvider = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Extract javaUserId from JWT "sub" field (if present)
      const javaUserId = decoded.sub;
      
      let provider;
      // Try to find provider by javaUserId first (new auth flow)
      if (javaUserId) {
        provider = await Provider.findOne({ javaUserId: javaUserId }).select("-password");
      }
      
      // Fallback to old auth flow (find by MongoDB _id)
      if (!provider && decoded.id) {
        provider = await Provider.findById(decoded.id).select("-password");
      }
      
      if (!provider) {
        return res.status(401).json({ success: false, message: "Provider not found" });
      }
      
      req.provider = provider;
      req.provider.providerId = provider._id.toString(); // Add providerId for route compatibility
      req.provider.javaUserId = provider.javaUserId; // Add javaUserId if available
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: "Not authorized, token failed" });
    }
  } else {
    return res.status(401).json({ success: false, message: "Not authorized, no token" });
  }
};

module.exports = { protect, authenticateUser, authenticateProvider };
