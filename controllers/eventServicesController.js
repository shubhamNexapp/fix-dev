// controllers/eventServicesController.js
const EventService = require("../models/eventServices");
const TraditionalService = require("../models/traditionalService");

const messages = require("../utils/messages");
const nodemailer = require("nodemailer");
const { sendOtpEmail } = require("../utils/sendEmail");


// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// create new booking
const createEventService = async (req, res) => {
    try {
        const { userId, serviceType, serviceName, eventDate } = req.body;

        if (!userId || !serviceType || !serviceName || !eventDate) {
            return res.status(400).json({ error: "userId, serviceType, serviceName, and eventDate are required" });
        }

        // Prevent duplicate booking for same user, same serviceType, same date
        const existing = await EventService.findOne({
            userId,
            serviceType,
            eventDate: new Date(eventDate),
            status: { $in: ["pending", "accepted"] }, // still active requests
        });

        if (existing) {
            return res.status(409).json({
                error: "You already have a booking for this service on this date. Please complete or cancel it first.",
            });
        }
        const newService = new EventService(req.body);
        newService.serviceId = newService._id.toString(); // for simplicity, using _id as serviceId
        await newService.save();

        return res.status(201).json({
            statusCode: 201,
            message: messages.success.SERVICE_BOOKED_SUCCESSFULLY,
            data: newService
        });

    } catch (err) {
        console.error("Error creating event service:", err);
        if (err.code === 11000) {
            return res.status(409).json({ error: "Duplicate booking for same service on same date." });
        }
        res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error",
            error: err.message
        });
    }
};

// provider accept booking
const acceptEventService = async (req, res) => {
    try {
        const { id } = req.params; // booking ID
        const { providerId, userEmail } = req.body;

        const service = await EventService.findById(id);
        if (!service) return res.status(404).json({ error: "Service not found" });

        if (service.status !== "pending") {
            return res.status(400).json({ error: `Cannot accept a ${service.status} request` });
        }

        await service.markAccepted(providerId);

        // Generate OTP valid for 1 hour
        const otp = generateOTP();
        service.completionOtp = otp;
        service.otpExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await service.save();

        // Send OTP Email
        await sendOtpEmail({
            to: userEmail,
            otp,
            serviceName: service.serviceName,
            eventDate: service.eventDate
        });

        return res.status(200).json({
            statusCode: 200,
            message: messages.success.SERVICE_ACCEPTED_SUCCESSFULLY,
            data: service
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error",
            error: err.message
        });
    }
};

// verify OTP (user provides it after completion)
const verifyCompletionOtp = async (req, res) => {
    try {
        const { id } = req.params;
        const { otp } = req.body;

        const service = await EventService.findById(id);
        if (!service) return res.status(404).json({ error: "Service not found" });

        if (service.status !== "accepted") {
            return res.status(400).json({ error: "Service is not in accepted state." });
        }

        if (!service.completionOtp || !service.otpExpiresAt) {
            return res.status(400).json({ error: "No OTP generated for this service." });
        }

        // if (service.otpExpiresAt < new Date()) {
        //     return res.status(400).json({ error: "OTP expired. Please request again." });
        // }

        if (service.completionOtp !== otp) {
            return res.status(400).json({ error: "Invalid OTP." });
        }

        // Mark completed
        service.otpVerified = true;
        await service.markCompleted();

        return res.status(200).json({
            statusCode: 200,
            message: "OTP verified successfully. Service marked as completed.",
            data: service,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// provider reject booking
const rejectEventService = async (req, res) => {
    try {
        const { id } = req.params;
        const service = await EventService.findById(id);
        if (!service) return res.status(404).json({ error: "Service not found" });

        service.status = "rejected";
        service.isAccepted = false;
        service.rejectedAt = new Date();
        await service.save();

        return res.status(200).json({
            statusCode: 200,
            message: messages.success.SERVICE_REJECTED_SUCCESSFULLY,
            data: service
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error",
            error: err.message
        });
    }
};

// get bookings for user
const getUserBookings = async (req, res) => {
    try {
        const { userId } = req.params;
        const services = await EventService.find({ userId }).sort({ createdAt: -1 });
        if (!services || services.length === 0) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: messages.error.SERVICE_HISTORY_NOT_FOUND,
                data: []
            });
        }
        res.status(200).json({
            success: true,
            statusCode: 200,
            message: messages.success.FETCH_USERS_SERVICES,
            data: services
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error",
            error: err.message
        });
    }
};

// get bookings for provider
const getProviderBookings = async (req, res) => {
    try {
        const { providerId } = req.params;
        const services = await EventService.find({ providerId }).sort({ createdAt: -1 });
        if (!services || services.length === 0) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                message: messages.error.SERVICE_HISTORY_NOT_FOUND,
                data: []
            });
        }
        res.status(200).json({
            success: true,
            statusCode: 200,
            message: messages.success.FETCH_PROVIDERS_SERVICES,
            data: services
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            statusCode: 500,
            message: "Internal server error",
            error: err.message
        });
    }
};

module.exports = {
    createEventService,
    acceptEventService,
    rejectEventService,
    getUserBookings,
    getProviderBookings,
    verifyCompletionOtp
};
