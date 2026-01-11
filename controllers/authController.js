const LogData = require("../helpers/logFile");
const Provider = require("../models/provider");
const User = require("../models/user");
const messages = require("../utils/messages");
const { validateCoordinates } = require("../utils/locationUtils");
const generateToken = require("../utils/generateToken");
const { registerUserInJavaAuth, registerProviderInJavaAuth } = require("../utils/authServiceClient");

// ---------------- Get all users ----------------
const getUsers = async (req, res) => {
  try {
    const users = await User.find(); // get all users
    return res.status(200).json({
      statusCode: 200,
      message: messages.success.FETCH_USER,
      data: users,
    });
  } catch (error) {
    var Method = "Geeting Error on (Users API)";
    LogData.LogFileData(error, Method);
    res.status(500).json({ statusCode: 500, message: messages.error.ERROR });
  }
};

// ---------------- User Registration ----------------
const register = async (req, res) => {
  try {
    console.log("Received register request:", req.body);
    const {
      email,
      password,
      fullName,
      phone,
      address,
      city,
      pincode,
      emergencyContact,
      location // { lat, lng }
    } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Email and password are required",
      });
    }

    if (!fullName) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Full name is required",
      });
    }

    // Enhanced validation for optional fields
    const errors = {};

    if (fullName && fullName.length < 2) {
      errors.fullName = "Full name must be at least 2 characters";
    }

    if (phone && !/^\+?[\d\s\-\(\)]{10,15}$/.test(phone)) {
      errors.phone = "Invalid phone number format";
    }

    if (address && address.length < 5) {
      errors.address = "Address must be at least 5 characters";
    }

    if (city && city.length < 2) {
      errors.city = "City must be at least 2 characters";
    }

    if (pincode && !/^\d{5,6}$/.test(pincode)) {
      errors.pincode = "Pincode must be 5-6 digits";
    }

    if (location) {
      if (!location.lat || !location.lng) {
        errors.location = "Location must have both lat and lng";
      } else if (location.lat < -90 || location.lat > 90) {
        errors.location = "Invalid latitude";
      } else if (location.lng < -180 || location.lng > 180) {
        errors.location = "Invalid longitude";
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Validation failed",
        errors: errors
      });
    }

    // STEP 1: Register user in Java Auth Service
    let javaAuthResponse;
    try {
      javaAuthResponse = await registerUserInJavaAuth({
        email,
        password,
        fullName,
        phoneNumber: phone || null
      });
      console.log("Java Auth registration successful:", javaAuthResponse.userId);
    } catch (javaAuthError) {
      console.error("Java Auth registration failed:", javaAuthError);
      return res.status(javaAuthError.status || 500).json({
        success: false,
        statusCode: javaAuthError.status || 500,
        message: javaAuthError.message || "Authentication service error",
        details: javaAuthError.details
      });
    }

    // STEP 2: Create user in MongoDB with business data
    try {
      // Check if user already exists in MongoDB (edge case: previous failed registration)
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        console.warn(`User with email ${email} already exists in MongoDB`);
        // Return existing data with new tokens from Java Auth
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: "User already exists, logged in successfully",
          accessToken: javaAuthResponse.accessToken,
          refreshToken: javaAuthResponse.refreshToken,
          tokenType: javaAuthResponse.tokenType,
          expiresIn: javaAuthResponse.expiresIn,
          userId: existingUser._id.toString(),
          javaUserId: javaAuthResponse.userId,
          userType: 'user',
          data: {
            _id: existingUser._id.toString(),
            javaUserId: existingUser.javaUserId,
            email: existingUser.email,
            fullName: existingUser.fullName,
            phone: existingUser.phone,
            address: existingUser.address,
            city: existingUser.city,
            pincode: existingUser.pincode,
            location: existingUser.location
          }
        });
      }

      // Create new user in MongoDB with business fields
      const userData = {
        javaUserId: javaAuthResponse.userId, // Store Java Auth userId
        email: javaAuthResponse.email,
        fullName: javaAuthResponse.fullName,
        name: javaAuthResponse.fullName,
        phone: phone || "",
        address: address || "",
        city: city || "",
        pincode: pincode || "",
        emergencyContact: emergencyContact || "",
        role: 'user',
        location: location ? {
          lat: location.lat,
          lng: location.lng,
          lastUpdated: new Date()
        } : {
          lat: null,
          lng: null,
          lastUpdated: null
        }
      };

      const newUser = new User(userData);
      newUser.userId = newUser._id.toString(); // Keep for backward compatibility
      await newUser.save();

      console.log(`User synced to MongoDB: ${newUser._id} (Java Auth ID: ${javaAuthResponse.userId})`);

      // STEP 3: Return combined response with tokens + MongoDB data
      return res.status(201).json({
        success: true,
        statusCode: 201,
        message: "User registered successfully",
        accessToken: javaAuthResponse.accessToken,
        refreshToken: javaAuthResponse.refreshToken,
        tokenType: javaAuthResponse.tokenType,
        expiresIn: javaAuthResponse.expiresIn,
        userId: newUser._id.toString(),
        javaUserId: javaAuthResponse.userId,
        userType: 'user',
        data: {
          _id: newUser._id.toString(),
          javaUserId: newUser.javaUserId,
          email: newUser.email,
          fullName: newUser.fullName,
          phone: newUser.phone,
          address: newUser.address,
          city: newUser.city,
          pincode: newUser.pincode,
          emergencyContact: newUser.emergencyContact,
          location: newUser.location,
          createdAt: newUser.createdAt,
          updatedAt: newUser.updatedAt
        }
      });

    } catch (mongoError) {
      console.error("MongoDB save failed after Java Auth success:", mongoError);
      // Java Auth user is created, but MongoDB failed
      return res.status(500).json({
        success: false,
        statusCode: 500,
        message: "User created in authentication service but failed to sync business data",
        error: mongoError.message,
        javaUserId: javaAuthResponse.userId,
        suggestion: "Please contact support to complete your registration"
      });
    }

  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ---------------- User Login ----------------
const login = async (req, res) => {
  try {
    console.log("Received login request:", req.body);
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Email and password are required.",
      });
    }
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Invalid email or password.",
      });
    }

    // Update user's updatedAt timestamp on login
    user.updatedAt = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Login successful",
      userId: user._id.toString(),
      token: generateToken(user._id),
      userType: 'user',
      data: {
        _id: user._id.toString(),
        userId: user._id.toString(),
        email: user.email,
        fullName: user.fullName || "",
        name: user.fullName || user.name || "", // Use fullName as display name
        phone: user.phone || "",
        address: user.address || "",
        city: user.city || "",
        pincode: user.pincode || "",
        emergencyContact: user.emergencyContact || "",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ---------------- Provider Register ----------------
const providerRegister = async (req, res) => {
  try {
    console.log("Received provider register request:", req.body);
    const {
      email,
      password,
      address,
      name,
      phone,
      serviceCategories,
      serviceTypes,
      experience,
      latitude,
      longitude
    } = req.body;

    // Basic validation
    if (!email || !password || !address) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Email, password, and address are required.",
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Provider name is required",
      });
    }

    // Validate coordinates if provided
    if ((latitude !== undefined || longitude !== undefined)) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: "Invalid coordinates provided.",
        });
      }
    }

    // STEP 1: Register provider in Java Auth Service
    let javaAuthResponse;
    try {
      javaAuthResponse = await registerProviderInJavaAuth({
        email,
        password,
        fullName: name,
        phoneNumber: phone || null
      });
      console.log("Java Auth provider registration successful:", javaAuthResponse.userId);
    } catch (javaAuthError) {
      console.error("Java Auth provider registration failed:", javaAuthError);
      return res.status(javaAuthError.status || 500).json({
        success: false,
        statusCode: javaAuthError.status || 500,
        message: javaAuthError.message || "Authentication service error",
        details: javaAuthError.details
      });
    }

    // STEP 2: Create provider in MongoDB with business data
    try {
      const existingProvider = await Provider.findOne({ email });
      if (existingProvider) {
        console.warn(`Provider with email ${email} already exists in MongoDB`);
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: "Provider already exists, logged in successfully",
          accessToken: javaAuthResponse.accessToken,
          refreshToken: javaAuthResponse.refreshToken,
          tokenType: javaAuthResponse.tokenType,
          expiresIn: javaAuthResponse.expiresIn,
          providerId: existingProvider._id.toString(),
          javaUserId: javaAuthResponse.userId,
          userType: 'provider',
          data: {
            _id: existingProvider._id.toString(),
            javaUserId: existingProvider.javaUserId,
            email: existingProvider.email,
            name: existingProvider.name,
            phone: existingProvider.phone,
            serviceCategories: existingProvider.serviceCategories,
            location: existingProvider.location
          }
        });
      }

      // Prepare provider data with defaults
      const providerData = {
        javaUserId: javaAuthResponse.userId, // Store Java Auth userId
        email: javaAuthResponse.email,
        name: javaAuthResponse.fullName || name,
        phone: phone || "",
        address: address,
        serviceCategories: serviceCategories || ["plumber", "electrician", "carpenter", "painter", "ac_repair", "cleaning"],
        serviceTypes: serviceTypes || [],
        experience: experience || "0 years",
        role: 'provider',
        rating: 0,
        isAvailable: true,
        location: latitude && longitude ? {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address: address || "",
          lastUpdated: new Date()
        } : null
      };

      const newProvider = new Provider(providerData);
      newProvider.providerId = newProvider._id.toString(); // Keep for backward compatibility
      await newProvider.save();

      console.log(`Provider synced to MongoDB: ${newProvider._id} (Java Auth ID: ${javaAuthResponse.userId})`);

      // STEP 3: Return combined response
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "Provider registered successfully",
        accessToken: javaAuthResponse.accessToken,
        refreshToken: javaAuthResponse.refreshToken,
        tokenType: javaAuthResponse.tokenType,
        expiresIn: javaAuthResponse.expiresIn,
        providerId: newProvider._id.toString(),
        javaUserId: javaAuthResponse.userId,
        userType: 'provider',
        data: {
          _id: newProvider._id.toString(),
          javaUserId: newProvider.javaUserId,
          email: newProvider.email,
          name: newProvider.name,
          phone: newProvider.phone,
          address: newProvider.address,
          serviceCategories: newProvider.serviceCategories,
          serviceTypes: newProvider.serviceTypes,
          experience: newProvider.experience,
          rating: newProvider.rating,
          isAvailable: newProvider.isAvailable,
          location: newProvider.location,
          createdAt: newProvider.createdAt
        }
      });

    } catch (mongoError) {
      console.error("MongoDB save failed after Java Auth success:", mongoError);
      return res.status(500).json({
        success: false,
        statusCode: 500,
        message: "Provider created in authentication service but failed to sync business data",
        error: mongoError.message,
        javaUserId: javaAuthResponse.userId,
        suggestion: "Please contact support to complete your registration"
      });
    }

  } catch (error) {
    console.error("Provider registration error:", error);
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ---------------- Provider Login ----------------
const providerLogin = async (req, res) => {
  try {
    console.log("Received provider login request:", req.body);
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Email and password are required.",
      });
    }
    const provider = await Provider.findOne({ email });
    if (!provider || provider.password !== password) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Invalid email or password.",
      });
    }
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Provider login successful",
      providerId: provider._id.toString(), // Use database ID as providerId
      token: generateToken(provider._id), // Add JWT token
      userType: 'provider',
      data: {
        _id: provider._id.toString(),
        providerId: provider._id.toString(),
        email: provider.email,
        address: provider.address,
        name: provider.name || "",
        phone: provider.phone || "",
        lat: provider.location?.latitude || null,
        lng: provider.location?.longitude || null,
        serviceCategories: provider.serviceCategories || ["plumber", "electrician", "carpenter", "painter", "ac_repair", "cleaning"],
        serviceTypes: provider.serviceTypes || [],
        experience: provider.experience || "0 years",
        rating: provider.rating || 0,
        isAvailable: provider.isAvailable !== undefined ? provider.isAvailable : true,
        location: provider.location || null, // NEW: Include location data
        createdAt: provider.createdAt
      },
    });
  } catch (error) {
    console.error("Provider login error:", error);
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ---------------- Update Provider Profile ----------------
const updateProviderProfile = async (req, res) => {
  try {
    console.log("Received provider profile update request:", req.body);
    const {
      providerId,
      name,
      phone,
      serviceCategories,
      serviceTypes,
      experience
    } = req.body;

    if (!providerId) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Provider ID is required.",
      });
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Provider not found.",
      });
    }

    // Update fields if provided
    if (name !== undefined) provider.name = name;
    if (phone !== undefined) provider.phone = phone;
    if (serviceCategories !== undefined) provider.serviceCategories = serviceCategories;
    if (serviceTypes !== undefined) provider.serviceTypes = serviceTypes;
    if (experience !== undefined) provider.experience = experience;

    await provider.save();

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Provider profile updated successfully",
      providerId: provider._id.toString(),
      data: {
        email: provider.email,
        address: provider.address,
        name: provider.name,
        phone: provider.phone,
        serviceCategories: provider.serviceCategories,
        serviceTypes: provider.serviceTypes,
        experience: provider.experience,
        rating: provider.rating,
        isAvailable: provider.isAvailable,
        _id: provider._id,
      }
    });
  } catch (error) {
    console.error("Provider profile update error:", error);
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ---------------- Get Provider Profile ----------------
const getProviderProfile = async (req, res) => {
  try {
    const { providerId } = req.params;

    if (!providerId) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Provider ID is required.",
      });
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Provider not found.",
      });
    }

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Provider profile retrieved successfully",
      data: {
        email: provider.email,
        address: provider.address,
        name: provider.name || "",
        phone: provider.phone || "",
        serviceCategories: provider.serviceCategories || [],
        serviceTypes: provider.serviceTypes || [],
        experience: provider.experience || "0 years",
        rating: provider.rating || 0,
        isAvailable: provider.isAvailable !== undefined ? provider.isAvailable : true,
        _id: provider._id,
      }
    });
  } catch (error) {
    console.error("Get provider profile error:", error);
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ---------------- Update Provider Location ----------------
const updateProviderLocation = async (req, res) => {
  try {
    console.log("Received provider location update request:", req.body);
    const { providerId, latitude, longitude, address } = req.body;

    if (!providerId) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Provider ID is required.",
      });
    }

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Latitude and longitude are required.",
      });
    }

    // Validate coordinates
    if (!validateCoordinates(parseFloat(latitude), parseFloat(longitude))) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid coordinates. Latitude must be -90 to 90, longitude must be -180 to 180.",
      });
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Provider not found.",
      });
    }

    // Update location
    provider.location = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address || provider.location?.address || "",
      lastUpdated: new Date()
    };

    await provider.save();

    console.log(`📍 Provider ${providerId} location updated:`, provider.location);

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Location updated successfully",
      data: {
        location: provider.location
      }
    });
  } catch (error) {
    console.error("Provider location update error:", error);
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  providerRegister,
  providerLogin,
  getUsers,
  updateProviderProfile,
  getProviderProfile,
  updateProviderLocation,
};
