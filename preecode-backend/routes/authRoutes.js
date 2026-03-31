const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');

const router = express.Router();

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderVsCodeLaunchPage(res, deepLink, completeUrl) {
  const safeDeepLink = escapeHtml(deepLink);
  const safeCompleteUrl = escapeHtml(completeUrl);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Preecode Redirect</title>
</head>
<body>
  <script>
    (function () {
      var deepLink = ${JSON.stringify(deepLink)};
      var completeUrl = ${JSON.stringify(completeUrl)};

      function openVsCode() {
        try {
          window.location.href = deepLink;
        } catch (e) {
          // ignore
        }
      }

      // Trigger browser app-launch popup first.
      openVsCode();

      // Move browser away from Google chooser to final fallback page.
      setTimeout(function () {
        try {
          window.location.replace(completeUrl);
        } catch (e) {
          // ignore
        }
      }, 120);
    })();
  </script>
  <noscript>
    <a href="${safeDeepLink}">Open Visual Studio Code</a>
    <a href="${safeCompleteUrl}">Continue</a>
  </noscript>
</body>
</html>`);
}

router.get('/redirect-complete', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Preecode Login Complete</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0f14;
      --panel: #111827;
      --text: #d1d5db;
      --muted: #9ca3af;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at top, #172554 0%, var(--bg) 45%);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
    }
    .card {
      width: 100%;
      max-width: 560px;
      background: var(--panel);
      border: 1px solid #1f2937;
      border-radius: 14px;
      padding: 22px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
    }
    h2 { margin: 0 0 8px; font-size: 22px; color: var(--text); }
    p { margin: 0; color: var(--muted); line-height: 1.6; }
  </style>
</head>
<body>
  <main class="card">
    <h2>Login complete</h2>
    <p>If Visual Studio Code is not opened automatically, you can open manually.</p>
  </main>
</body>
</html>`);
});

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

    // If redirect is a VS Code URI, redirect directly so browser triggers app handoff.
    if (originalRedirect && originalRedirect.toLowerCase().startsWith('vscode://')) {
      const sep = originalRedirect.indexOf('?') === -1 ? '?' : '&';
      const origin = `${req.protocol}://${req.get('host')}`;
      const completeUrl = `${origin}/api/auth/redirect-complete?v=${Date.now()}`;
      const vscodeUri = `${originalRedirect}${sep}token=${encodeURIComponent(token)}`;
      console.log('[auth] Launching VS Code then showing fallback page:', vscodeUri);
      return renderVsCodeLaunchPage(res, vscodeUri, completeUrl);
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