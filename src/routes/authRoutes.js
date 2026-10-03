const express = require('express');
const passport = require('passport');
const { register, login, refresh, logout, oauthSuccess } = require('../controllers/authController');
const { loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Local Auth
router.post('/register', register);
router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// GitHub OAuth
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/' }),
  oauthSuccess
);

module.exports = router;