const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { createUser, getUser, getStats, loginUser, updateProfile, logoutUser, forgotPassword, verifyOtp, resetPassword, changePassword, deleteAccount, logoutAllDevices, updateNotificationPrefs } = require('../controllers/userController');
const validateObjectId = require('../middleware/validateObjectId');
const auth = require('../middleware/authMiddleware');
const checkEarlyAccess = require('../middleware/checkEarlyAccess');

// Rate limiting for auth endpoints - prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes per IP
  message: { message: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Rate limiting for password reset - prevent abuse
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour per IP
  message: { message: 'Too many password reset attempts. Please try again in 1 hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Debug logs for route hits
router.post('/login', authLimiter, (req, res, next) => {
	console.log('[users] POST /api/users/login from', req.ip, 'bodyKeys=', Object.keys(req.body));
	return loginUser(req, res, next);
});

router.post('/', authLimiter, (req, res, next) => {
	console.log('[users] POST /api/users (create) from', req.ip, 'bodyKeys=', Object.keys(req.body));
	return createUser(req, res, next);
});

// Password reset routes (no auth required)
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/verify-otp', passwordResetLimiter, verifyOtp);
router.post('/reset-password', passwordResetLimiter, resetPassword);

// Return current authenticated user
router.get('/me', auth, checkEarlyAccess, (req, res, next) => {
  return require('../controllers/userController').getMe(req, res, next);
});

// Update user profile
router.put('/profile/update', auth, (req, res, next) => {
	console.log('[users] PUT /api/users/profile/update from', req.ip, 'bodyKeys=', Object.keys(req.body));
	return updateProfile(req, res, next);
});

// Change password (authenticated)
router.put('/change-password', auth, changePassword);

// Delete account (authenticated)
router.delete('/account', auth, deleteAccount);

// Logout all devices (authenticated)
router.post('/logout-all', auth, logoutAllDevices);

// Update notification preferences
router.put('/notifications', auth, updateNotificationPrefs);

router.post('/logout', auth, logoutUser);

router.get('/stats/:id', auth, checkEarlyAccess, validateObjectId, getStats);
router.get('/:id', auth, checkEarlyAccess, validateObjectId, getUser);

module.exports = router;
