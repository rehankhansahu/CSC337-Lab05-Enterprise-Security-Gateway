const rateLimit = require('express-rate-limit');

// ==================================================
// LOGIN RATE LIMITER
// Maximum 5 FAILED login attempts within 15 minutes
// ==================================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  // Maximum 5 failed requests from one IP
  max: 5,

  // Successful login requests will not count
  skipSuccessfulRequests: true,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: 'Too many failed login attempts. Please try again after 15 minutes.'
  }
});

module.exports = { loginLimiter };