const express = require("express");
const Provider = require("../models/provider");
const ServiceRequest = require("../models/serviceRequest");
const User = require("../models/user");

// Helper function to calculate distance
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function formatDistance(distance) {
    if (distance < 1) {
        return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
}

// Helper function to calculate provider stats
async function calculateProviderStats(providerId) {
    const requests = await ServiceRequest.find({ assignedProviderId: providerId });

    const totalRequests = requests.length;
    const completedRequests = requests.filter(r => r.status === 'completed').length;
    const activeRequests = requests.filter(r => ['accepted', 'in-progress'].includes(r.status)).length;

    // Calculate average rating (when rating system is implemented)
    const averageRating = 0; // Placeholder

    return {
        totalCompleted: completedRequests,
        totalActive: activeRequests,
        averageRating: averageRating,
        totalEarnings: 0 // Placeholder until pricing is implemented
    };
}

const acceptedRequest =  async () => {
try {
        const { providerId } = req.params;
        const { limit = 50, status } = req.query;

        // Validate ownership
        if (req.provider.providerId !== providerId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Build query - only accepted/completed requests
        const query = {
            assignedProviderId: providerId,
            status: { $in: ['accepted', 'in-progress', 'completed'] }
        };
        if (status) query.status = status;

        const requests = await ServiceRequest.find(query)
            .sort({ timestamp: -1 }) // Using existing timestamp field
            .limit(parseInt(limit))
            .lean();

        // Get provider location for distance calculation
        const provider = await Provider.findOne({ _id: providerId })
            .select('location.latitude location.longitude currentLocation.lat currentLocation.lng');

        // Populate user details and calculate distances
        const enrichedRequests = await Promise.all(
            requests.map(async (request) => {
                const user = await User.findOne({ _id: request.userId })
                    .select('name phone address email');

                let distance = null;
                if (provider?.currentLocation?.lat && provider?.currentLocation?.lng &&
                    request.userLocation?.latitude && request.userLocation?.longitude) {
                    const dist = calculateDistance(
                        provider.currentLocation.lat, provider.currentLocation.lng,
                        request.userLocation.latitude, request.userLocation.longitude
                    );
                    distance = formatDistance(dist);
                } else if (provider?.location?.latitude && provider?.location?.longitude &&
                    request.userLocation?.latitude && request.userLocation?.longitude) {
                    const dist = calculateDistance(
                        provider.location.latitude, provider.location.longitude,
                        request.userLocation.latitude, request.userLocation.longitude
                    );
                    distance = formatDistance(dist);
                }

                return {
                    requestId: request.requestId,
                    serviceName: request.serviceName,
                    serviceIcon: request.serviceIcon,
                    description: request.description,
                    status: request.status,
                    acceptedAt: request.timestamp, // Placeholder until proper timestamps
                    completedAt: null, // Will be enhanced when timestamps are added
                    estimatedTime: request.estimatedTime,
                    user: {
                        userId: request.userId,
                        name: user?.name || user?.email || 'Unknown',
                        phone: user?.phone || 'Not available',
                        address: user?.address || 'Address not provided',
                        lat: request.userLocation?.latitude,
                        lng: request.userLocation?.longitude
                    },
                    provider: {
                        providerId: providerId,
                        lat: provider?.currentLocation?.lat || provider?.location?.latitude,
                        lng: provider?.currentLocation?.lng || provider?.location?.longitude
                    },
                    userRating: null, // Will be enhanced when ratings are added
                    distance
                };
            })
        );

        // Calculate stats
        const stats = await calculateProviderStats(providerId);

        res.json({
            success: true,
            requests: enrichedRequests,
            stats
        });
    } catch (error) {
        console.error('Error fetching provider requests:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

const completeRequest = async () => {
try {
        const { requestId, providerId, completedAt, actualDuration, completionNotes } = req.body;

        // Validate required fields
        if (!requestId || !providerId) {
            return res.status(400).json({
                success: false,
                message: 'Request ID and Provider ID are required'
            });
        }

        // Validate ownership
        if (req.provider.providerId !== providerId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Find and validate request
        const request = await ServiceRequest.findOne({
            requestId,
            assignedProviderId: providerId
        });

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        if (!['accepted', 'in-progress'].includes(request.status)) {
            return res.status(400).json({
                success: false,
                message: 'Request cannot be completed in current status'
            });
        }

        // Update request status
        const updateData = {
            status: 'completed'
        };

        // Add completion data if provided
        if (actualDuration) updateData.actualDuration = actualDuration;
        if (completionNotes) updateData.completionNotes = completionNotes;

        await ServiceRequest.updateOne({ requestId }, updateData);

        res.json({
            success: true,
            message: 'Request marked as completed successfully',
            requestId,
            completedAt: completedAt || new Date().toISOString()
        });
    } catch (error) {
        console.error('Error completing request:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

module.exports = {
    acceptedRequest, 
    completeRequest
}