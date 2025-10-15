const Provider = require("./models/provider");
const ServiceRequest = require("./models/serviceRequest");
const { 
  calculateDistance, 
  validateCoordinates, 
  PROXIMITY_CONFIG,
} = require("./utils/locationUtils");
const {
  isToday,
  formatTimeForDisplay,
  calculateDurationFromNow,
  processETAData
} = require("./utils/socketUtils"); // Move your helpers here if not already

const ALLOWED_SERVICE_CATEGORIES = ["plumber", "electrician", "carpenter", "painter", "ac_repair", "cleaning"];

module.exports = (io) => {
  // In-memory maps
  const connectedUsers = new Map();
  const connectedProviders = new Map();
  const activeRequests = new Map();
  const userLocations = new Map();
  const activeSearchIntervals = new Map();
  const userActiveRequests = new Map();
  const requestProviders = new Map();

  // --- All event handlers and helpers ---
  // You can copy your event handlers and helper functions here,
  // using the same logic as in your original server.js.
  // For brevity, see previous message for full event handler code.

  // Example: Register event
  io.on('connection', (socket) => {
    // ... all your socket event handlers ...
    // Use the same logic as in your original server.js
  });

  // Optionally, export maps for health check if needed
  module.exports.connectedUsers = connectedUsers;
  module.exports.connectedProviders = connectedProviders;
  module.exports.activeRequests = activeRequests;
  module.exports.userLocations = userLocations;
};