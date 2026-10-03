const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  generateAccessToken,
  generateRefreshToken
} = require('../utils/generateTokens');

// ==================================================
// REFRESH COOKIE OPTIONS
// ==================================================

const getRefreshCookieOptions = () => ({
  httpOnly: true,

  // localhost HTTP = false
  // deployed HTTPS = true
  secure: process.env.NODE_ENV === 'production',

  sameSite: 'strict',

  maxAge: 7 * 24 * 60 * 60 * 1000,

  path: '/'
});

// ==================================================
// REGISTER
// Public registrations are ALWAYS Employee
// ==================================================

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password'
      });
    }

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration data'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const userExists = await User.findOne({
      email: normalizedEmail
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,

      // IMPORTANT:
      // Public users cannot choose privileged roles
      role: 'Employee',

      provider: 'local'
    });

    const accessToken =
      generateAccessToken(user);

    const refreshToken =
      generateRefreshToken(user);

    user.refreshToken = refreshToken;

    await user.save();

    res.cookie(
      'refreshToken',
      refreshToken,
      getRefreshCookieOptions()
    );

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('REGISTER ERROR:', error);

    return res.status(500).json({
      success: false,
      message:
        error.message || 'Registration failed'
    });
  }
};

// ==================================================
// LOGIN
// ==================================================

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    if (
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid login data'
      });
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.password) {
      return res.status(401).json({
        success: false,
        message:
          `Please login using ${user.provider}`
      });
    }

    const passwordMatches =
      await user.comparePassword(password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const accessToken =
      generateAccessToken(user);

    const refreshToken =
      generateRefreshToken(user);

    user.refreshToken = refreshToken;

    await user.save();

    res.cookie(
      'refreshToken',
      refreshToken,
      getRefreshCookieOptions()
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('LOGIN ERROR:', error);

    return res.status(500).json({
      success: false,
      message:
        error.message || 'Login failed'
    });
  }
};

// ==================================================
// REFRESH TOKEN ROTATION
// ==================================================

const refresh = async (req, res) => {
  try {
    const oldRefreshToken =
      req.cookies?.refreshToken;

    if (!oldRefreshToken) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided'
      });
    }

    const decoded = jwt.verify(
      oldRefreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    const user = await User.findById(
      decoded.id
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (
      user.refreshToken !==
      oldRefreshToken
    ) {
      return res.status(401).json({
        success: false,
        message:
          'Refresh token has been revoked'
      });
    }

    const newAccessToken =
      generateAccessToken(user);

    const newRefreshToken =
      generateRefreshToken(user);

    // Rotation: old token is replaced
    user.refreshToken = newRefreshToken;

    await user.save();

    res.cookie(
      'refreshToken',
      newRefreshToken,
      getRefreshCookieOptions()
    );

    return res.status(200).json({
      success: true,
      message:
        'Token refreshed successfully',
      accessToken: newAccessToken
    });
  } catch (error) {
    console.error(
      'REFRESH ERROR:',
      error.message
    );

    return res.status(401).json({
      success: false,
      message:
        'Invalid or expired refresh token'
    });
  }
};

// ==================================================
// LOGOUT + TOKEN REVOCATION
// ==================================================

const logout = async (req, res) => {
  try {
    const refreshToken =
      req.cookies?.refreshToken;

    if (refreshToken) {
      const user = await User.findOne({
        refreshToken
      });

      if (user) {
        user.refreshToken = null;
        await user.save();
      }
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        'production',
      sameSite: 'strict',
      path: '/'
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('LOGOUT ERROR:', error);

    return res.status(500).json({
      success: false,
      message:
        error.message || 'Logout failed'
    });
  }
};

// ==================================================
// OAUTH SUCCESS
// ==================================================

const oauthSuccess = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          'OAuth authentication failed'
      });
    }

    /*
      Access token is deliberately NOT placed in the URL.

      OAuth establishes the refresh-token cookie.
      Frontend then calls /api/v1/auth/refresh to obtain
      its short-lived access token.
    */

    const refreshToken =
      generateRefreshToken(user);

    user.refreshToken = refreshToken;

    await user.save();

    res.cookie(
      'refreshToken',
      refreshToken,
      getRefreshCookieOptions()
    );

    const clientURL =
      process.env.CLIENT_URL ||
      'http://localhost:5000';

    return res.redirect(
      `${clientURL}/?oauth=success`
    );
  } catch (error) {
    console.error(
      'OAUTH SUCCESS ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'OAuth login failed'
    });
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  oauthSuccess
};