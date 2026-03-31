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

function renderVsCodeRedirectBridge(res, deepLink) {
  const safeDeepLink = escapeHtml(deepLink);
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
      --text: #e5e7eb;
      --muted: #9ca3af;
      --ok-bg: #052e16;
      --ok-border: #166534;
      --ok-text: #86efac;
      --btn: #f59e0b;
      --btn-text: #1f2937;
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
    h2 { margin: 0 0 8px; font-size: 22px; }
    p { margin: 0 0 14px; color: var(--muted); line-height: 1.5; }
    .ok {
      background: var(--ok-bg);
      border: 1px solid var(--ok-border);
      color: var(--ok-text);
      padding: 11px 12px;
      border-radius: 10px;
      font-size: 14px;
      margin-bottom: 12px;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 6px;
    }
    .btn {
      display: inline-block;
      text-decoration: none;
      border-radius: 8px;
      border: none;
      background: var(--btn);
      color: var(--btn-text);
      font-weight: 700;
      padding: 10px 14px;
      cursor: pointer;
    }
    .link {
      color: #93c5fd;
      text-decoration: none;
      font-size: 13px;
    }
    code {
      display: block;
      margin-top: 12px;
      padding: 10px;
      border-radius: 8px;
      background: #0b1220;
      border: 1px solid #1f2937;
      color: #cbd5e1;
      font-size: 11px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <main class="card">
    <h2>Login complete</h2>
    <div class="ok" id="status">You are logged in. Opening Visual Studio Code...</div>
    <p>If Visual Studio Code is not opened automatically, use the button below. You can then return to VS Code manually.</p>
    <div class="actions">
      <a id="openBtn" class="btn" href="${safeDeepLink}">Open Visual Studio Code</a>
      <a class="link" href="${safeDeepLink}">Try deep link again</a>
    </div>
    <code>${safeDeepLink}</code>
  </main>

  <script>
    (function () {
      var deepLink = ${JSON.stringify(deepLink)};
      var status = document.getElementById('status');
      var openBtn = document.getElementById('openBtn');

      function openVsCode() {
        try {
          window.location.href = deepLink;
        } catch (e) {
          // ignore
        }
      }

      if (openBtn) {
        openBtn.addEventListener('click', function () {
          status.textContent = 'Attempting to open Visual Studio Code...';
        });
      }

      // Attempt once immediately and once shortly after for reliability.
      openVsCode();
      setTimeout(openVsCode, 500);

      // Keep this page stable and informative instead of appearing stuck.
      setTimeout(function () {
        status.textContent = 'You are logged in. If VS Code did not open, click "Open Visual Studio Code" or switch to VS Code manually.';
      }, 1800);
    })();
  </script>
</body>
</html>`);
}

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

    // If redirect is a VS Code URI, show a bridge page with clear fallback UI.
    if (originalRedirect && originalRedirect.toLowerCase().startsWith('vscode://')) {
      const sep = originalRedirect.indexOf('?') === -1 ? '?' : '&';
      const vscodeUri = `${originalRedirect}${sep}token=${encodeURIComponent(token)}`;
      console.log('[auth] Rendering VS Code bridge page:', vscodeUri);
      return renderVsCodeRedirectBridge(res, vscodeUri);
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