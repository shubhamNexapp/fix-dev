const mongoose = require("mongoose");
const TraditionalService = require("../models/traditionalService");
const Provider = require("../models/provider");
const { sendOtpEmail } = require("../utils/sendEmail");

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Create request
 */
exports.createRequest = async (req, res) => {
  try {
    const { userId, serviceType, location, serviceDate } = req.body;

    if (!userId || !serviceType || !location || !serviceDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate location coordinates (GeoJSON format: [longitude, latitude])
    if (location && location.coordinates) {
      const [lng, lat] = location.coordinates;

      if (lng < -180 || lng > 180) {
        return res.status(400).json({
          error: "Invalid longitude. Must be between -180 and 180",
          received: { longitude: lng, latitude: lat }
        });
      }

      if (lat < -90 || lat > 90) {
        return res.status(400).json({
          error: "Invalid latitude. Must be between -90 and 90. Note: GeoJSON format is [longitude, latitude]",
          received: { longitude: lng, latitude: lat }
        });
      }
    }

    const service = new TraditionalService(req.body);
    service.serviceId = service._id.toString();
    await service.save();

    res.status(201).json({
      message: "Service request created",
      data: service
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get nearby providers with progressive distance search
 * Search within 5km -> 10km progressively
 * Only expand to next radius if less than 20 providers found
 * Stop at 10km (do not search beyond)
 */
exports.getNearbyProviders = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.body; // Default limit increased to 20

    const request = await TraditionalService.findById(id);
    if (!request) return res.status(404).json({ error: "Request not found" });

    const rejectedIds = request.rejectedProviders.map(
      (r) => r.providerId
    );

    // Progressive distance search: 5km -> 10km (only 2 steps)
    const MINIMUM_PROVIDERS_THRESHOLD = 20; // Expand search if less than 20 providers
    const searchDistances = [
      { radius: 5000, label: "5 km" },   // 5000 meters - First search
      { radius: 10000, label: "10 km" }  // 10000 meters - Final search (max radius)
    ];

    let providers = [];
    let searchedDistance = null;
    let shouldContinueSearch = true;

    // Try each distance until we find enough providers or reach max radius
    for (let i = 0; i < searchDistances.length && shouldContinueSearch; i++) {
      const { radius, label } = searchDistances[i];
      const isLastRadius = i === searchDistances.length - 1;

      console.log(`🔍 Searching for providers within ${label}...`);

      providers = await Provider.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: request.location.coordinates
            },
            distanceField: "distance",
            maxDistance: radius, // Search within this radius
            spherical: true
          }
        },
        {
          $match: {
            services: request.serviceType,
            isActive: true,
            _id: { $nin: rejectedIds }
          }
        },
        { $sort: { distance: 1 } },
        { $limit: limit }
      ]);

      searchedDistance = label;
      
      console.log(`✅ Found ${providers.length} provider(s) within ${label}`);

      // Decision logic:
      // 1. If we found >= 20 providers, stop searching
      // 2. If this is the last radius (10km), stop searching regardless
      // 3. Otherwise, continue to next radius
      if (providers.length >= MINIMUM_PROVIDERS_THRESHOLD) {
        console.log(`✓ Found sufficient providers (${providers.length} >= ${MINIMUM_PROVIDERS_THRESHOLD}), stopping search`);
        shouldContinueSearch = false;
      } else if (isLastRadius) {
        console.log(`✓ Reached maximum search radius (${label}), stopping search`);
        shouldContinueSearch = false;
      } else {
        console.log(`⚠️ Found only ${providers.length} provider(s), expanding search to next radius...`);
      }
    }

    // Return results
    if (providers.length === 0) {
      return res.json({
        providers: [],
        message: `No providers found within ${searchedDistance}`,
        searchedDistance,
        foundCount: 0,
        searchedRadiusMeters: searchDistances.find(d => d.label === searchedDistance).radius,
        fallback: true
      });
    }

    res.json({
      providers,
      message: `Found ${providers.length} provider(s) within ${searchedDistance}`,
      searchedDistance,
      foundCount: providers.length,
      searchedRadiusMeters: searchDistances.find(d => d.label === searchedDistance).radius,
      meetsThreshold: providers.length >= MINIMUM_PROVIDERS_THRESHOLD,
      fallback: false
    });
  } catch (err) {
    console.error('❌ Error in getNearbyProviders:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Accept request
 */
exports.acceptRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerId, userEmail } = req.body;

    const service = await TraditionalService.findById(id);
    if (!service) return res.status(404).json({ error: "Not found" });

    if (service.status !== "pending") {
      return res
        .status(400)
        .json({ error: "Request already processed" });
    }

    await service.acceptService(providerId);

    const otp = generateOTP();
    service.completionOtp = otp;
    service.otpExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await service.save();

    await sendOtpEmail({
      to: userEmail,
      otp,
      serviceName: service.serviceType,
      eventDate: service.serviceDate
    });

    res.json({
      message: "Service accepted",
      data: service
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Reject provider
 */
exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerId } = req.body;

    await TraditionalService.findByIdAndUpdate(id, {
      $addToSet: {
        rejectedProviders: {
          providerId: new mongoose.Types.ObjectId(providerId)
        }
      }
    });

    res.json({ message: "Provider rejected" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Verify OTP
 */
exports.verifyCompletionOtp = async (req, res) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;

    const service = await TraditionalService.findById(id);
    if (!service) return res.status(404).json({ error: "Not found" });

    if (
      service.completionOtp !== otp
    ) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    await service.completeService();
    res.json({ message: "Service completed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * User bookings
 */
exports.getUserRequests = async (req, res) => {
  const data = await TraditionalService.find({
    userId: req.params.userId
  }).sort({ createdAt: -1 });

  res.json(data);
};

/**
 * Provider bookings
 */
exports.getProviderRequests = async (req, res) => {
  const data = await TraditionalService.find({
    providerId: req.params.providerId
  }).sort({ createdAt: -1 });

  res.json(data);
};
