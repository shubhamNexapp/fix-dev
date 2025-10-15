const LogData = require("../helpers/logFile");
const Provider = require("../models/provider");
const User = require("../models/user");
const messages = require("../utils/messages");
const { validateCoordinates } = require("../utils/locationUtils");
const generateToken = require("../utils/generateToken");

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
      emergencyContact
    } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Email and password are required",
      });
    }

    // Enhanced validation for new fields
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

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Validation failed",
        errors: errors
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: messages.error.USER_ALREADY_REGISTERED,
      });
    }

    // Create new user with enhanced fields
    const userData = {
      email,
      password,
      fullName: fullName || "",
      name: fullName || "", // Keep name field for backward compatibility
      phone: phone || "",
      address: address || "",
      city: city || "",
      pincode: pincode || "",
      emergencyContact: emergencyContact || ""
    };

    const newUser = new User(userData);

    newUser.userId = newUser._id.toString(); // Set userId to string version of _id 

    await newUser.save();

    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: "User registered successfully",
      userId: newUser._id.toString(),
      token: generateToken(newUser.userId),
      userType: 'user',
      data: {
        _id: newUser._id.toString(),
        userId: newUser._id.toString(),
        email: newUser.email,
        fullName: newUser.fullName,
        name: newUser.fullName, // Use fullName as name for display
        phone: newUser.phone,
        address: newUser.address,
        city: newUser.city,
        pincode: newUser.pincode,
        emergencyContact: newUser.emergencyContact,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt
      }
    });
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
      latitude,  // NEW: Location data
      longitude  // NEW: Location data
    } = req.body;

    if (!email || !password || !address) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Email, password, and address are required.",
      });
    }

    // Validate coordinates if provided
    if ((latitude !== undefined || longitude !== undefined) &&
      !validateCoordinates(parseFloat(latitude), parseFloat(longitude))) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid coordinates provided.",
      });
    }

    const existingProvider = await Provider.findOne({ email });
    if (existingProvider) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Provider with this email already exists.",
      });
    }

    // Prepare provider data with defaults for backward compatibility
    const providerData = {
      email,
      password,
      address,
      name: name || "",
      phone: phone || "",
      serviceCategories: serviceCategories || ["plumber", "electrician", "carpenter", "painter", "ac_repair", "cleaning"],
      serviceTypes: serviceTypes || [],
      experience: experience || "0 years",
      rating: 0,
      isAvailable: true,
      // NEW: Add location if provided
      location: latitude && longitude ? {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || "",
        lastUpdated: new Date()
      } : null
    };

    const newProvider = new Provider(providerData);
    newProvider.providerId = newProvider._id.toString(); // Set providerId to string version of _id
    await newProvider.save();

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Provider registered successfully",
      providerId: newProvider.providerId,
      token: generateToken(newProvider.providerId),
      userType: 'provider',
      data: {
        _id: newProvider._id.toString(),
        providerId: newProvider._id.toString(),
        email: newProvider.email,
        address: newProvider.address,
        name: newProvider.name || "",
        phone: newProvider.phone || "",
        lat: newProvider.location?.latitude || null,
        lng: newProvider.location?.longitude || null,
        serviceCategories: newProvider.serviceCategories || [],
        serviceTypes: newProvider.serviceTypes || [],
        experience: newProvider.experience || null,
        rating: newProvider.rating || 0,
        isAvailable: newProvider.isAvailable !== undefined ? newProvider.isAvailable : true,
        location: newProvider.location, // NEW: Include location in response
        createdAt: newProvider.createdAt
      }
    });
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
