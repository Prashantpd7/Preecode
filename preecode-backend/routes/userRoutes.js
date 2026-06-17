const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createUser, getUser, getStats, loginUser, updateProfile, logoutUser, forgotPassword, verifyOtp, resetPassword, changePassword, deleteAccount, logoutAllDevices, updateNotificationPrefs } = require('../controllers/userController');
const validateObjectId = require('../middleware/validateObjectId');
const auth = require('../middleware/authMiddleware');
const checkEarlyAccess = require('../middleware/checkEarlyAccess');

// Debug logs for route hits
router.post('/login', (req, res, next) => {
	console.log('[users] POST /api/users/login from', req.ip, 'bodyKeys=', Object.keys(req.body));
	return loginUser(req, res, next);
});

router.post('/', (req, res, next) => {
	console.log('[users] POST /api/users (create) from', req.ip, 'bodyKeys=', Object.keys(req.body));
	return createUser(req, res, next);
});

// Password reset routes (no auth required)
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

// GET /me — user profile endpoint. Always tries signature verification first,
// then falls back to jwt.decode() without verification. This allows the VS Code
// extension to fetch user profiles even when running against a local backend
// whose JWT_SECRET differs from production (which signed the token).
router.get('/me', async (req, res, next) => {
	try {
		const header = req.headers.authorization;
		if (!header || !header.startsWith('Bearer ')) {
			return res.status(401).json({ message: 'Not authorized, no token.' });
		}

		const token = header.split(' ')[1];

		// Step 1: Try standard signature verification (works when JWT_SECRET matches)
		try {
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			const user = await User.findById(decoded.id).select('-password -__v');
			if (user) {
				const decodedVersion = Number(decoded.tokenVersion || 0);
				const currentVersion = Number(user.tokenVersion || 0);
				if (decodedVersion === currentVersion) {
					console.log('[users] GET /me: verified JWT ok user=' + (user.username || decoded.id));
					return res.json(user);
				}
				console.log('[users] GET /me: tokenVersion mismatch (decoded=' + decodedVersion + ' current=' + currentVersion + '), trying decode fallback');
			} else {
				console.log('[users] GET /me: verified JWT but user not found, trying decode fallback');
			}
		} catch (verifyErr) {
			console.log('[users] GET /me: jwt.verify failed (' + verifyErr.message + '), trying decode fallback');
		}

		// Step 2: Fallback — decode without signature verification.
		// This allows extensions using a production-signed JWT to get the
		// user profile from a local backend with a different JWT_SECRET.
		try {
			const decoded = jwt.decode(token);
			if (decoded && decoded.id) {
				const user = await User.findById(decoded.id).select('-password -__v');
				if (user) {
					console.log('[users] GET /me: found user via decode fallback id=' + decoded.id + ' user=' + (user.username || '?'));
					return res.json(user);
				}
			}
		} catch (decodeErr) {
			console.log('[users] GET /me: decode fallback also failed:', decodeErr.message);
		}

		return res.status(401).json({ message: 'Not authenticated.' });
	} catch (error) {
		next(error);
	}
});

router.get('/stats/:id', auth, checkEarlyAccess, validateObjectId, getStats);
router.get('/:id', auth, checkEarlyAccess, validateObjectId, getUser);

router.put('/:id', auth, validateObjectId, updateProfile);
router.post('/logout', auth, logoutUser);
router.post('/change-password', auth, changePassword);
router.delete('/:id', auth, validateObjectId, deleteAccount);
router.post('/logout-all-devices', auth, logoutAllDevices);
router.put('/notification-prefs', auth, updateNotificationPrefs);

module.exports = router;
