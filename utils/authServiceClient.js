const axios = require('axios');

const JAVA_AUTH_BASE_URL = process.env.JAVA_AUTH_URL || 'http://localhost:8080';

/**
 * Register a new user in Java Auth Service
 * @param {Object} registerData - Registration data
 * @param {string} registerData.email - User email
 * @param {string} registerData.password - User password
 * @param {string} registerData.fullName - User full name
 * @param {string} [registerData.phoneNumber] - User phone number (optional)
 * @returns {Promise<Object>} Java Auth response
 */
async function registerUserInJavaAuth(registerData) {
  try {
    const response = await axios.post(
      `${JAVA_AUTH_BASE_URL}/api/auth/register`,
      {
        email: registerData.email,
        password: registerData.password,
        fullName: registerData.fullName,
        phoneNumber: registerData.phoneNumber,
        role: 'USER'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      }
    );
    
    return response.data;
  } catch (error) {
    // Handle different error types
    if (error.response) {
      // Java Auth returned an error response
      throw {
        status: error.response.status,
        message: error.response.data.message || 'Java Auth registration failed',
        details: error.response.data
      };
    } else if (error.request) {
      // No response received (Java Auth might be down)
      throw {
        status: 503,
        message: 'Java Auth Service is unavailable',
        details: 'Could not connect to authentication service'
      };
    } else {
      // Request setup error
      throw {
        status: 500,
        message: 'Failed to send registration request',
        details: error.message
      };
    }
  }
}

/**
 * Register a new provider in Java Auth Service
 * @param {Object} registerData - Registration data
 * @param {string} registerData.email - Provider email
 * @param {string} registerData.password - Provider password
 * @param {string} registerData.fullName - Provider full name
 * @param {string} [registerData.phoneNumber] - Provider phone number (optional)
 * @returns {Promise<Object>} Java Auth response
 */
async function registerProviderInJavaAuth(registerData) {
  try {
    const response = await axios.post(
      `${JAVA_AUTH_BASE_URL}/api/auth/register`,
      {
        email: registerData.email,
        password: registerData.password,
        fullName: registerData.fullName,
        phoneNumber: registerData.phoneNumber,
        role: 'SERVICE_PROVIDER'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    return response.data;
  } catch (error) {
    if (error.response) {
      throw {
        status: error.response.status,
        message: error.response.data.message || 'Java Auth registration failed',
        details: error.response.data
      };
    } else if (error.request) {
      throw {
        status: 503,
        message: 'Java Auth Service is unavailable',
        details: 'Could not connect to authentication service'
      };
    } else {
      throw {
        status: 500,
        message: 'Failed to send registration request',
        details: error.message
      };
    }
  }
}

/**
 * Validate JWT token with Java Auth Service
 * @param {string} token - JWT access token
 * @returns {Promise<Object>} Token validation response
 */
async function validateToken(token) {
  try {
    const response = await axios.get(
      `${JAVA_AUTH_BASE_URL}/api/user/profile`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 5000
      }
    );
    
    return response.data;
  } catch (error) {
    if (error.response) {
      throw {
        status: error.response.status,
        message: 'Token validation failed',
        details: error.response.data
      };
    } else {
      throw {
        status: 503,
        message: 'Java Auth Service is unavailable'
      };
    }
  }
}

module.exports = {
  registerUserInJavaAuth,
  registerProviderInJavaAuth,
  validateToken
};
