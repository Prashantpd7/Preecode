/**
 * requireAuth middleware
 * ─────────────────────────────────────────────────────────────
 * Protects routes by verifying the JWT in the Authorization header.
 *
 * Usage:
 *   const requireAuth = require('../middleware/requireAuth');
 *   router.get('/protected', requireAuth, (req, res) => { ... });
 *
 * The decoded user payload is attached to req.user.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const requireAuth = async (req, res, next) => {
  try {
    // Expect: Authorization: Bearer <token>
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    // Verify signature + expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user from DB (catches deleted/banned accounts)
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    // Optional: token version check (invalidate all tokens on password change)
    if (user.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ error: 'Token has been invalidated. Please log in again.' });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    console.error('[requireAuth] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Authentication error.' });
  }
};

module.exports = requireAuth;
