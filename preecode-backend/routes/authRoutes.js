const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');

const router = express.Router();

/* ================= GOOGLE OAUTH START ================= */

router.get('/google', (req, res, next) => {
  // Accept an optional `redirect` query param (e.g. vscode://...)
  // Store in session/temporary storage to pass through OAuth callback
  if (req.query && req.query.redirect) {
    try {
      console.log('[auth] /google received redirect:', req.query.redirect);
      // Store the redirect in a session-like manner (we'll use a simple approach)
      res.cookie('oauth_redirect', req.query.redirect, {
        maxAge: 10 * 60 * 1000, // 10 minutes
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production'
      });
    } catch (e) {
      console.warn('[auth] /google failed to store redirect:', e && e.message);
    }
  }

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
});

// Use env var for frontend URL; in production Render will set FRONTEND_URL
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

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
      { id: req.user._id, tokenVersion: req.user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    console.log('[auth] Generated JWT for user:', req.user && req.user._id);

    // Get redirect from cookie if available
    let originalRedirect = req.cookies?.oauth_redirect || null;
    if (originalRedirect) {
      console.log('[auth] Retrieved redirect from cookie:', originalRedirect);
      // Clear the cookie
      res.clearCookie('oauth_redirect');
    }

    // If redirect is a VS Code URI, redirect directly to VS Code
    if (originalRedirect && originalRedirect.toLowerCase().startsWith('vscode://')) {
      const sep = originalRedirect.indexOf('?') === -1 ? '?' : '&';
      const vscodeUri = `${originalRedirect}${sep}token=${encodeURIComponent(token)}`;
      console.log('[auth] Redirecting directly to VS Code:', vscodeUri);
      return res.redirect(vscodeUri);
    }

    // For web logins, redirect to frontend callback page
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
    { id: user._id, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token });
});

// Debug helper: visit /api/auth/debug?redirect=vscode://...&token=XYZ to render
// a page with a clickable link that opens the deep link. Useful to test
// whether the browser/OS will allow opening VS Code from the site.
router.get('/debug', (req, res) => {
  const redirect = req.query.redirect || '';
  const token = req.query.token || 'TEST_TOKEN';
  let decoded = redirect;
  try {
    decoded = decodeURIComponent(String(redirect));
  } catch (e) {
    decoded = String(redirect);
  }
  const sep = decoded.indexOf('?') === -1 ? '?' : '&';
  const deepLink = decoded ? `${decoded}${sep}token=${encodeURIComponent(String(token))}` : '';

  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Auth Debug</title></head><body style="background:#0B0F14;color:#fff;font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center;max-width:720px;padding:24px"><h2>Auth Debug</h2><p>Click the button below to attempt opening VS Code via the deep link.</p>${deepLink ? `<p><a id="open" href="${deepLink}" style="display:inline-block;padding:12px 18px;background:#ffa116;color:#081018;border-radius:8px;text-decoration:none">Open VS Code</a></p><p style="color:#9ca3af">If nothing happens, your browser may be blocking custom-scheme navigation. Try another browser or copy the link and run <code>open '${deepLink}'</code> in a terminal.</p>` : '<p style="color:#f88">No redirect provided. Use ?redirect=vscode://preecode.preecode/auth</p>'}</div></body></html>`);
});

module.exports = router;