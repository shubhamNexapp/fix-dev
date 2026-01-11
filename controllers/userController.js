const express = require("express");
const router = express.Router();
const User = require("../models/user");
const ServiceRequest = require("../models/serviceRequest");
const Provider = require("../models/provider");
const { authenticateUser } = require("../middlewares/authMiddleware");
const generateToken = require("../utils/generateToken");
const bcrypt = require("bcryptjs");
const { registerUserInJavaAuth } = require("../utils/authServiceClient");

// Helper function to calculate profile completeness
function calculateProfileCompleteness(user) {
    const fields = ['fullName', 'email', 'phone', 'address', 'city', 'pincode'];
    const completedFields = fields.filter(field => user[field] && user[field].trim());
    return Math.round((completedFields.length / fields.length) * 100);
}

const getUserById = async () => {
    try {
        const { userId } = req.params;

        // Validate ownership
        if (req.user.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                code: 'UNAUTHORIZED'
            });
        }

        const user = await User.findById(userId).select('-password -__v');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Calculate profile completeness
        const completeness = calculateProfileCompleteness(user);

        res.json({
            success: true,
            profile: {
                _id: user._id.toString(),
                email: user.email,
                fullName: user.fullName || "",
                name: user.fullName || user.name || "",
                phone: user.phone || "",
                address: user.address || "",
                city: user.city || "",
                pincode: user.pincode || "",
                emergencyContact: user.emergencyContact || "",
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                profileCompleteness: completeness
            }
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

const getAllUsers = async (req, res) => {
    try {
        const users = await User.find();
        if (!users || users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Users not found',
                code: 'USER_NOT_FOUND'
            });
        }
        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

const updateUserById = async () => {
    try {
        const { userId } = req.params;
        const { fullName, phone, address, city, pincode, emergencyContact } = req.body;

        // Validate ownership
        if (req.user.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                code: 'UNAUTHORIZED'
            });
        }

        // Enhanced validation for profile update
        const errors = {};

        if (fullName !== undefined) {
            if (typeof fullName !== 'string') {
                errors.fullName = "Full name must be a string";
            } else if (fullName.trim().length < 2) {
                errors.fullName = "Full name must be at least 2 characters";
            }
        }

        if (phone !== undefined) {
            if (typeof phone !== 'string') {
                errors.phone = "Phone must be a string";
            } else if (phone.trim() && !/^\+?[\d\s\-\(\)]{10,15}$/.test(phone.trim())) {
                errors.phone = "Invalid phone number format";
            }
        }

        if (address !== undefined) {
            if (typeof address !== 'string') {
                errors.address = "Address must be a string";
            } else if (address.trim().length > 0 && address.trim().length < 5) {
                errors.address = "Address must be at least 5 characters";
            }
        }

        if (city !== undefined) {
            if (typeof city !== 'string') {
                errors.city = "City must be a string";
            } else if (city.trim().length > 0 && city.trim().length < 2) {
                errors.city = "City must be at least 2 characters";
            }
        }

        if (pincode !== undefined) {
            if (typeof pincode !== 'string') {
                errors.pincode = "Pincode must be a string";
            } else if (pincode.trim() && !/^\d{5,6}$/.test(pincode.trim())) {
                errors.pincode = "Pincode must be 5-6 digits";
            }
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: errors
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Update fields only if provided
        if (fullName !== undefined) {
            user.fullName = fullName.trim();
            user.name = fullName.trim(); // Keep name field in sync
        }
        if (phone !== undefined) user.phone = phone.trim();
        if (address !== undefined) user.address = address.trim();
        if (city !== undefined) user.city = city.trim();
        if (pincode !== undefined) user.pincode = pincode.trim();
        if (emergencyContact !== undefined) user.emergencyContact = emergencyContact.trim();

        // Update timestamp
        user.updatedAt = new Date();

        await user.save();

        res.json({
            success: true,
            message: "Profile updated successfully",
            data: {
                _id: user._id.toString(),
                email: user.email,
                fullName: user.fullName,
                name: user.fullName, // Use fullName as display name
                phone: user.phone,
                address: user.address,
                city: user.city,
                pincode: user.pincode,
                emergencyContact: user.emergencyContact,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

const getServiceHistory = async () => {
    try {
        const { userId } = req.params;
        const { limit = 50, offset = 0, status } = req.query;

        // Validate ownership
        if (req.user.userId !== userId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Build query
        const query = { userId }; // This should match the ServiceRequest userId field
        if (status) query.status = status;

        // Execute query with pagination
        const requests = await ServiceRequest.find(query)
            .sort({ timestamp: -1 }) // Using existing timestamp field
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .lean();

        // Get total count
        const total = await ServiceRequest.countDocuments(query);

        // Populate provider details
        const enrichedRequests = await Promise.all(
            requests.map(async (request) => {
                let provider = null;
                if (request.assignedProviderId) {
                    const providerData = await Provider.findOne({ _id: request.assignedProviderId })
                        .select('name phone rating experience');

                    if (providerData) {
                        provider = {
                            providerId: request.assignedProviderId,
                            name: providerData.name || 'Unknown',
                            phone: providerData.phone || 'Not available',
                            rating: providerData.rating || null,
                            experience: providerData.experience || null
                        };
                    }
                }

                // Format response according to frontend expectations
                return {
                    requestId: request.requestId,
                    serviceName: request.serviceName,
                    serviceIcon: request.serviceIcon,
                    description: request.description,
                    status: request.status,
                    createdAt: request.timestamp, // Using existing timestamp field
                    acceptedAt: null, // Will be enhanced when timestamps are added
                    completedAt: null, // Will be enhanced when timestamps are added
                    estimatedTime: request.estimatedTime,
                    provider: provider,
                    userRating: null, // Will be enhanced when ratings are added
                    totalCost: null // Will be enhanced when pricing is added
                };
            })
        );

        res.json({
            success: true,
            history: enrichedRequests,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + parseInt(limit)) < total
            }
        });
    } catch (error) {
        console.error('Error fetching service history:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}
// GET /api/user/profile/:userId
router.get('/profile/:userId', authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate ownership
        if (req.user.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                code: 'UNAUTHORIZED'
            });
        }

        const user = await User.findById(userId).select('-password -__v');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Calculate profile completeness
        const completeness = calculateProfileCompleteness(user);

        res.json({
            success: true,
            profile: {
                _id: user._id.toString(),
                email: user.email,
                fullName: user.fullName || "",
                name: user.fullName || user.name || "",
                phone: user.phone || "",
                address: user.address || "",
                city: user.city || "",
                pincode: user.pincode || "",
                emergencyContact: user.emergencyContact || "",
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                profileCompleteness: completeness
            }
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// PUT /api/user/profile/:userId
router.put('/profile/:userId', authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;
        const { fullName, phone, address, city, pincode, emergencyContact } = req.body;

        // Validate ownership
        if (req.user.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                code: 'UNAUTHORIZED'
            });
        }

        // Enhanced validation for profile update
        const errors = {};

        if (fullName !== undefined) {
            if (typeof fullName !== 'string') {
                errors.fullName = "Full name must be a string";
            } else if (fullName.trim().length < 2) {
                errors.fullName = "Full name must be at least 2 characters";
            }
        }

        if (phone !== undefined) {
            if (typeof phone !== 'string') {
                errors.phone = "Phone must be a string";
            } else if (phone.trim() && !/^\+?[\d\s\-\(\)]{10,15}$/.test(phone.trim())) {
                errors.phone = "Invalid phone number format";
            }
        }

        if (address !== undefined) {
            if (typeof address !== 'string') {
                errors.address = "Address must be a string";
            } else if (address.trim().length > 0 && address.trim().length < 5) {
                errors.address = "Address must be at least 5 characters";
            }
        }

        if (city !== undefined) {
            if (typeof city !== 'string') {
                errors.city = "City must be a string";
            } else if (city.trim().length > 0 && city.trim().length < 2) {
                errors.city = "City must be at least 2 characters";
            }
        }

        if (pincode !== undefined) {
            if (typeof pincode !== 'string') {
                errors.pincode = "Pincode must be a string";
            } else if (pincode.trim() && !/^\d{5,6}$/.test(pincode.trim())) {
                errors.pincode = "Pincode must be 5-6 digits";
            }
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: errors
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Update fields only if provided
        if (fullName !== undefined) {
            user.fullName = fullName.trim();
            user.name = fullName.trim(); // Keep name field in sync
        }
        if (phone !== undefined) user.phone = phone.trim();
        if (address !== undefined) user.address = address.trim();
        if (city !== undefined) user.city = city.trim();
        if (pincode !== undefined) user.pincode = pincode.trim();
        if (emergencyContact !== undefined) user.emergencyContact = emergencyContact.trim();

        // Update timestamp
        user.updatedAt = new Date();

        await user.save();

        res.json({
            success: true,
            message: "Profile updated successfully",
            data: {
                _id: user._id.toString(),
                email: user.email,
                fullName: user.fullName,
                name: user.fullName, // Use fullName as display name
                phone: user.phone,
                address: user.address,
                city: user.city,
                pincode: user.pincode,
                emergencyContact: user.emergencyContact,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// GET /api/user/service-history/:userId
router.get('/service-history/:userId', authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, offset = 0, status } = req.query;

        // Validate ownership
        if (req.user.userId !== userId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Build query
        const query = { userId }; // This should match the ServiceRequest userId field
        if (status) query.status = status;

        // Execute query with pagination
        const requests = await ServiceRequest.find(query)
            .sort({ timestamp: -1 }) // Using existing timestamp field
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .lean();

        // Get total count
        const total = await ServiceRequest.countDocuments(query);

        // Populate provider details
        const enrichedRequests = await Promise.all(
            requests.map(async (request) => {
                let provider = null;
                if (request.assignedProviderId) {
                    const providerData = await Provider.findOne({ _id: request.assignedProviderId })
                        .select('name phone rating experience');

                    if (providerData) {
                        provider = {
                            providerId: request.assignedProviderId,
                            name: providerData.name || 'Unknown',
                            phone: providerData.phone || 'Not available',
                            rating: providerData.rating || null,
                            experience: providerData.experience || null
                        };
                    }
                }

                // Format response according to frontend expectations
                return {
                    requestId: request.requestId,
                    serviceName: request.serviceName,
                    serviceIcon: request.serviceIcon,
                    description: request.description,
                    status: request.status,
                    createdAt: request.timestamp, // Using existing timestamp field
                    acceptedAt: null, // Will be enhanced when timestamps are added
                    completedAt: null, // Will be enhanced when timestamps are added
                    estimatedTime: request.estimatedTime,
                    provider: provider,
                    userRating: null, // Will be enhanced when ratings are added
                    totalCost: null // Will be enhanced when pricing is added
                };
            })
        );

        res.json({
            success: true,
            history: enrichedRequests,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + parseInt(limit)) < total
            }
        });
    } catch (error) {
        console.error('Error fetching service history:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ---------------- User Registration (Java Auth Integrated) ----------------
const registerUser = async (req, res) => {
    try {
        console.log("📝 User registration request received:", {
            email: req.body.email,
            hasPassword: !!req.body.password,
            hasFullName: !!req.body.fullName,
            hasPhone: !!req.body.phone
        });

        const {
            email,
            password,
            fullName,
            phone,
            address,
            city,
            pincode,
            emergencyContact,
            lat,
            lng,
            location // Support both formats
        } = req.body;

        // ============ VALIDATION ============
        
        // 1. Required fields validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Email and password are required",
                code: "MISSING_REQUIRED_FIELDS"
            });
        }

        if (!fullName) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Full name is required",
                code: "MISSING_FULLNAME"
            });
        }

        // 2. Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Invalid email format",
                code: "INVALID_EMAIL"
            });
        }

        // 3. Password validation (Java Auth requires 8+ chars)
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Password must be at least 8 characters long",
                code: "WEAK_PASSWORD"
            });
        }

        // 4. Enhanced field validation
        const errors = {};

        if (fullName.trim().length < 2) {
            errors.fullName = "Full name must be at least 2 characters";
        }

        if (phone && !/^\+?[\d\s\-\(\)]{10,15}$/.test(phone)) {
            errors.phone = "Invalid phone number format (10-15 digits)";
        }

        if (address && address.trim().length < 5) {
            errors.address = "Address must be at least 5 characters";
        }

        if (city && city.trim().length < 2) {
            errors.city = "City must be at least 2 characters";
        }

        if (pincode && !/^\d{5,6}$/.test(pincode)) {
            errors.pincode = "Pincode must be 5-6 digits";
        }

        // Support both location formats: {lat, lng} or location: {lat, lng}
        const userLat = lat !== undefined ? lat : location?.lat;
        const userLng = lng !== undefined ? lng : location?.lng;

        if (userLat !== undefined && (typeof userLat !== 'number' || userLat < -90 || userLat > 90)) {
            errors.lat = "Latitude must be between -90 and 90";
        }

        if (userLng !== undefined && (typeof userLng !== 'number' || userLng < -180 || userLng > 180)) {
            errors.lng = "Longitude must be between -180 and 180";
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Validation failed",
                code: "VALIDATION_ERROR",
                errors: errors
            });
        }

        // ============ STEP 1: REGISTER IN JAVA AUTH ============
        
        console.log("🔐 Step 1: Registering user in Java Auth Service...");
        let javaAuthResponse;
        
        try {
            javaAuthResponse = await registerUserInJavaAuth({
                email: email.toLowerCase(),
                password: password,
                fullName: fullName.trim(),
                phoneNumber: phone?.trim() || null
            });
            
            console.log("✅ Java Auth registration successful - User ID:", javaAuthResponse.userId);
        } catch (javaAuthError) {
            console.error("❌ Java Auth registration failed:", javaAuthError);
            return res.status(javaAuthError.status || 500).json({
                success: false,
                statusCode: javaAuthError.status || 500,
                message: javaAuthError.message || "Authentication service error",
                code: "JAVA_AUTH_ERROR",
                details: javaAuthError.details
            });
        }

        // ============ STEP 2: CREATE USER IN MONGODB ============
        
        console.log("💾 Step 2: Creating user in MongoDB...");
        
        try {
            // Check if user already exists in MongoDB (edge case)
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser) {
                console.warn("⚠️ User already exists in MongoDB, returning with new Java Auth tokens");
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
                        javaUserId: existingUser.javaUserId || javaAuthResponse.userId,
                        email: existingUser.email,
                        fullName: existingUser.fullName,
                        phone: existingUser.phone,
                        address: existingUser.address,
                        city: existingUser.city,
                        pincode: existingUser.pincode,
                        location: existingUser.location,
                        profileCompleteness: calculateProfileCompleteness(existingUser)
                    }
                });
            }

            // Create new user in MongoDB with business fields
            const userData = {
                javaUserId: javaAuthResponse.userId, // Link to Java Auth
                email: javaAuthResponse.email.toLowerCase(),
                fullName: javaAuthResponse.fullName,
                name: javaAuthResponse.fullName, // Backward compatibility
                phone: phone?.trim() || "",
                address: address?.trim() || "",
                city: city?.trim() || "",
                pincode: pincode?.trim() || "",
                emergencyContact: emergencyContact?.trim() || "",
                role: 'user',
                isDeleted: false
            };

            // Add location if provided
            if (userLat !== undefined && userLng !== undefined) {
                userData.location = {
                    lat: userLat,
                    lng: userLng,
                    lastUpdated: new Date()
                };
            } else {
                userData.location = {
                    lat: null,
                    lng: null,
                    lastUpdated: null
                };
            }

            const newUser = new User(userData);
            newUser.userId = javaAuthResponse.userId; // For backward compatibility

            await newUser.save();

            console.log("✅ User synced to MongoDB:", newUser._id.toString(), "(Java Auth ID:", javaAuthResponse.userId + ")");

            // ============ STEP 3: RETURN COMBINED RESPONSE ============
            
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
                    name: newUser.fullName,
                    phone: newUser.phone,
                    address: newUser.address,
                    city: newUser.city,
                    pincode: newUser.pincode,
                    emergencyContact: newUser.emergencyContact,
                    location: newUser.location,
                    role: newUser.role,
                    createdAt: newUser.createdAt,
                    updatedAt: newUser.updatedAt,
                    profileCompleteness: calculateProfileCompleteness(newUser)
                }
            });

        } catch (mongoError) {
            console.error("❌ MongoDB save failed after Java Auth success:", mongoError);
            
            // Handle mongoose duplicate key error
            if (mongoError.code === 11000) {
                const field = Object.keys(mongoError.keyPattern)[0];
                return res.status(409).json({
                    success: false,
                    statusCode: 409,
                    message: `User with this ${field} already exists`,
                    code: "DUPLICATE_KEY_ERROR",
                    javaUserId: javaAuthResponse.userId
                });
            }

            // Critical: Java Auth user created but MongoDB failed
            return res.status(500).json({
                success: false,
                statusCode: 500,
                message: "User created in authentication service but failed to sync business data",
                code: "MONGODB_SYNC_ERROR",
                error: mongoError.message,
                javaUserId: javaAuthResponse.userId,
                suggestion: "Please contact support to complete your registration"
            });
        }

    } catch (error) {
        console.error("❌ User registration error:", error);

        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error during registration",
            code: "INTERNAL_ERROR",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    registerUser,
    getAllUsers,
    getUserById,
    updateUserById,
    getServiceHistory,
}