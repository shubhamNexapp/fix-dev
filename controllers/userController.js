const express = require("express");
const router = express.Router();
const User = require("../models/user");
const ServiceRequest = require("../models/serviceRequest");
const Provider = require("../models/provider");
const { authenticateUser } = require("../middlewares/authMiddleware");

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

module.exports = {
    getUserById,
    updateUserById,
    getServiceHistory
}