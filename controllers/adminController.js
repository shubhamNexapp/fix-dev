const Admin = require("../models/admin");
const Provider = require("../models/provider");
const ServiceRequest = require("../models/serviceRequest");
const User = require("../models/user");
const generateToken = require("../utils/generateToken");
const { validateCoordinates } = require("../utils/locationUtils");
const messages = require("../utils/messages");
const { success, error } = require("../utils/messages");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const transporter = nodemailer.createTransport({
    service: "Gmail", // or your email provider
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// const createAdmin = async (req, res) => {
//     try {
//         const { email, password, name, phone, address, pincode, emergencyContact } = req.body;

//         // Hash the password before saving
//         const hashedPassword = await bcrypt.hash(password, 10);

//         const admin = new Admin({
//             email,
//             password: hashedPassword,
//             name,
//             phone,
//             address,
//             pincode,
//             emergencyContact,
//             role: "admin",
//         });

//         await admin.save();

//         res.status(201).json({
//             success: true,
//             message: "Admin created successfully",
//             data: {
//                 id: admin._id,
//                 email: admin.email,
//                 role: admin.role,
//             },
//         });
//     } catch (error) {
//         console.error("Error creating admin:", error);
//         res.status(500).json({ success: false, message: "Internal server error" });
//     }
// };

const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // Find admin by email
        const admin = await Admin.findOne({ email, isDeleted: false });
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid password"
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: admin._id, role: admin.role },
            process.env.JWT_SECRET || "your_jwt_secret",
            { expiresIn: "1d" }
        );

        res.json({
            statusCode: 200,
            message: "Admin login successful",
            token,
            data: {
                id: admin._id,
                email: admin.email,
                role: admin.role,
                name: admin.name,
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        // Generate token
        const resetToken = crypto.randomBytes(20).toString("hex");

        // Hash token and save to DB
        admin.resetPasswordToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");
        admin.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
        await admin.save();

        // Create reset URL
        const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;

        // Send email
        const message = `
            <h2>You requested a password reset</h2>
            <p>Click the link below to reset your password:</p>
            <a href="${resetUrl}" target="_blank">${resetUrl}</a>
            <p>This link expires in 10 minutes.</p>
        `;

        await transporter.sendMail({
            to: admin.email,
            subject: "Password Reset Request",
            html: message
        });

        console.log("Reset token (send this in URL):", resetToken);

        res.status(200).json({ message: "Password reset email sent" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

const resetPassword = async (req, res) => {
    const resetPasswordToken = crypto
        .createHash("sha256")
        .update(req.params.token)
        .digest("hex");

    try {
        const admin = await Admin.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!admin) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        admin.password = hashedPassword;

        // Clear reset fields
        admin.resetPasswordToken = undefined;
        admin.resetPasswordExpire = undefined;

        await admin.save();

        res.status(200).json({ message: "Password reset successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

const getUsers = async (req, res) => {
    try {
        let { page = 1, limit = 10 } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;

        // Fetch paginated users
        const users = await User.find({ isDeleted: false })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .lean();

        const total = await User.countDocuments({ isDeleted: false });

        if (!users || users.length === 0) {
            return res.status(404).json({
                success: false,
                message: error.USER_NOT_FOUND,
            });
        }

        res.json({
            statusCode: 200,
            message: success.FETCH_USER,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
            data: users,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const getProviders = async (req, res) => {
    try {
        let { page = 1, limit = 10 } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;

        // Fetch paginated providers
        const providers = await Provider.find({ isDeleted: false })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .lean();

        const total = await Provider.countDocuments({ isDeleted: false });

        if (!providers || providers.length === 0) {
            return res.status(404).json({
                success: false,
                message: error.PROVIDER_NOT_FOUND,
            });
        }

        res.json({
            statusCode: 200,
            message: success.FETCH_PROVIDER,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
            data: providers,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const getServiceHistory = async (req, res) => {
    try {
        // Default values if not provided
        let { page = 1, limit = 10, status } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);

        // Calculate skip value
        const skip = (page - 1) * limit;

        // Build query object
        const query = {  };
        if (status) {
            query.status = status; // filter by status if provided
        }

        // Fetch paginated data
        const requests = await ServiceRequest.find(query)
            .sort({ timestamp: -1 })
            .limit(limit)
            .skip(skip)
            .lean();

        // Get total count
        const total = await ServiceRequest.countDocuments(query);

        res.json({
            statusCode: 200,
            message: success.FETCH_SERVICE_HISTORY,
            pagination: {
                total,                 // total number of docs
                page,                  // current page
                limit,                 // docs per page
                totalPages: Math.ceil(total / limit), // total pages
                hasMore: page * limit < total
            },
            data: requests,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const addUser = async (req, res) => {
    try {
        const {
            email,
            password,
            name,
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

        if (name && name.length < 2) {
            errors.name = "Name must be at least 2 characters";
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
        const existingUser = await User.findOne({
            isDeleted: false,
            $or: [
                { email },
                { phone }
            ]
        });

        if (existingUser) {
            let reason = '';
            if (existingUser.email === email) reason = "Email already registered";
            else if (existingUser.phone === phone) reason = "Phone number already registered";
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: reason || messages.error.USER_ALREADY_REGISTERED,
            });
        }

        // Create new user with enhanced fields
        const userData = {
            email,
            password,
            name: name || "", // Keep name field for backward compatibility
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
            statusCode: 201,
            message: messages.success.USER_REGISTER_SUCCESSFULLY,
            token: generateToken(newUser.userId),
            data: newUser
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

const updateUser = async (req, res) => {
    try {
        const { userId, email, name, phone, address, city, pincode, emergencyContact } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "User ID is required",
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "User not found",
            });
        }

        // Validation
        const errors = {};

        if (name && name.length < 2) errors.name = "Name must be at least 2 characters";
        if (phone && !/^\+?[\d\s\-\(\)]{10,15}$/.test(phone)) errors.phone = "Invalid phone number format";
        if (address && address.length < 5) errors.address = "Address must be at least 5 characters";
        if (city && city.length < 2) errors.city = "City must be at least 2 characters";
        if (pincode && !/^\d{5,6}$/.test(pincode)) errors.pincode = "Pincode must be 5-6 digits";

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Validation failed",
                errors
            });
        }

        // Check if email or phone is used by another user
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }],
            _id: { $ne: userId } // exclude current user
        });

        if (existingUser) {
            let reason = '';
            if (existingUser.email === email) reason = "Email already registered";
            else if (existingUser.phone === phone) reason = "Phone number already registered";

            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: reason,
            });
        }

        // Update fields
        user.email = email || user.email;
        user.name = name || user.name;
        user.phone = phone || user.phone;
        user.address = address || user.address;
        user.city = city || user.city;
        user.pincode = pincode || user.pincode;
        user.emergencyContact = emergencyContact || user.emergencyContact;

        await user.save();

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: messages.success.USER_UPDATED_SUCCESSFULLY,
            data: user,
        });

    } catch (error) {
        console.error("Update user error:", error);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error",
            error: error.message,
        });
    }
};


const addProvider = async (req, res) => {
    try {
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

        const existingProvider = await Provider.findOne({
            isDeleted: false,
            $or: [
                { email },
                { phone }
            ]
        });

        if (existingProvider) {
            let reason = '';
            if (existingProvider.email === email) reason = "Email already registered";
            else if (existingProvider.phone === phone) reason = "Phone number already registered";
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: reason || messages.error.PROVIDER_ALREADY_REGISTERED,
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
            statusCode: 200,
            message: messages.success.PROVIDER_REGISTER_SUCCESSFULLY,
            providerId: newProvider.providerId,
            token: generateToken(newProvider.providerId),
            data: newProvider
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error",
            error: error.message,
        });
    }
};

const updateProvider = async (req, res) => {
    try {
        const { providerId, email, name, phone} = req.body;

        if (!providerId) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "User ID is required",
            });
        }

        const provider = await Provider.findById(providerId);
        if (!provider) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: "Provider not found",
            });
        }

        // Validation
        const errors = {};

        if (name && name.length < 2) errors.name = "Name must be at least 2 characters";
        if (phone && !/^\+?[\d\s\-\(\)]{10,15}$/.test(phone)) errors.phone = "Invalid phone number format";

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: "Validation failed",
                errors
            });
        }

        // Check if email or phone is used by another user
        const existingProvider = await Provider.findOne({
            $or: [{ email }, { phone }],
            _id: { $ne: providerId } // exclude current provider
        });

        if (existingProvider) {
            let reason = '';
            if (existingProvider.email === email) reason = "Email already registered";
            else if (existingProvider.phone === phone) reason = "Phone number already registered";

            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: reason,
            });
        }

        // Update fields
        provider.email = email || provider.email;
        provider.name = name || provider.name;
        provider.phone = phone || provider.phone;

        await provider.save();

        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: messages.success.PROVIDER_UPDATED_SUCCESSFULLY,
            data: provider,
        });

    } catch (error) {
        console.error("Update provider error:", error);
        return res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error",
            error: error.message,
        });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params; // User ID from URL

        const user = await User.findByIdAndUpdate(
            id,
            { isDeleted: true },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: error.USER_NOT_FOUND,
            });
        }

        res.json({
            statusCode: 200,
            message: success.USER_DELETED || "User deleted successfully",
            data: user,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error",
            error: err.message,
        });
    }
};

const deleteProvider = async (req, res) => {
    try {
        const { id } = req.params; // Provider ID from URL

        const provider = await Provider.findByIdAndUpdate(
            id,
            { isDeleted: true },
            { new: true }
        );

        if (!provider) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: error.PROVIDER_NOT_FOUND,
            });
        }

        res.json({
            statusCode: 200,
            message: success.PROVIDER_DELETED || "Provider deleted successfully",
            data: provider,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error",
            error: err.message,
        });
    }
};

const deleteServiceHistory = async (req, res) => {
    try {
        const { id } = req.params; // ServiceRequest ID from URL

        const service = await ServiceRequest.findByIdAndUpdate(
            id,
            { isDeleted: true },
            { new: true }
        );

        if (!service) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: error.SERVICE_REQUEST_NOT_FOUND || "Service request not found",
            });
        }

        res.json({
            statusCode: 200,
            message: success.SERVICE_REQUEST_DELETED || "Service request deleted successfully",
            data: service,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error",
            error: err.message,
        });
    }
};

module.exports = {
    // createAdmin,
    adminLogin,
    forgotPassword,
    resetPassword,
    getUsers,
    getProviders,
    getServiceHistory,
    addUser,
    addProvider,
    deleteUser,
    deleteProvider,
    deleteServiceHistory,
    updateUser,
    updateProvider
}