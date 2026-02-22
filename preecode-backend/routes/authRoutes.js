const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');

const router = express.Router();

/* ================= GOOGLE OAUTH START ================= */

router.get('/google', (req, res, next) => {
  // Accept an optional `redirect` query param (e.g. vscode://...)
  // and include it in the OAuth `state` so it is returned to the callback.
  let state;
  if (req.query && req.query.redirect) {
    try {
      state = Buffer.from(String(req.query.redirect)).toString('base64');
    } catch (e) {
      state = undefined;
    }
  }

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state: state,
  })(req, res, next);
});

// Use env var for frontend URL; in production Render will set FRONTEND_URL
const FRONTEND_URL = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://preecode.vercel.app' : 'http://localhost:3000');

/* ================= GOOGLE OAUTH CALLBACK ================= */

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${FRONTEND_URL}/auth/callback.html?error=oauth_failed`,
  }),
  (req, res) => {
    console.log('[auth] Google callback hit for user:', req.user && req.user._id);
    const token = jwt.sign(
      { id: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    console.log('[auth] Generated JWT for user:', req.user && req.user._id);

    // If the OAuth `state` contains a redirect (base64-encoded), prefer
    // redirecting directly to that target with the token appended. This
    // allows VS Code deep links like `vscode://publisher.extension/auth` to
    // receive the JWT and complete extension login.
    let originalRedirect = null;
    if (req.query && req.query.state) {
      try {
        const decoded = Buffer.from(String(req.query.state), 'base64').toString('utf8');
        console.log('[auth] OAuth state decoded:', decoded);
        originalRedirect = decoded;
        // Basic safety: only allow schemes like vscode:// or https://
        if (decoded.startsWith('vscode://') || decoded.startsWith('https://') || decoded.startsWith('http://')) {
          const sep = decoded.indexOf('?') === -1 ? '?' : '&';
          return res.redirect(`${decoded}${sep}token=${token}`);
        }
      } catch (e) {
        console.warn('[auth] Failed to decode OAuth state:', e && e.message);
        // fall through to default redirect
      }
    }

    // Fallback: redirect to frontend callback page which will persist the token
    // If we decoded an original redirect, include it so the frontend can
    // forward the token (useful when browsers block direct custom-scheme opens).
    if (originalRedirect) {
      return res.redirect(`${FRONTEND_URL}/auth/callback.html?token=${token}&redirect=${encodeURIComponent(originalRedirect)}`);
    }

    res.redirect(`${FRONTEND_URL}/auth/callback.html?token=${token}`);
  }
);

/* ================= DEV LOGIN (Optional) ================= */

router.get('/dev-login', async (req, res) => {
  const User = require('../models/User');
  const user = await User.findOne();

  if (!user) {
    return res.json({ error: "No user exists in DB" });
  }

  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token });
});

module.exports = router;