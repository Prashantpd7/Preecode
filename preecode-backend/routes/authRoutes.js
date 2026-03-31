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

function renderVsCodeLaunchPage(res, deepLink) {
  const safeDeepLink = escapeHtml(deepLink);
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
      --accent: linear-gradient(120deg, #fbbf24, #f97316);
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
      max-width: 620px;
      background: var(--panel);
      border: 1px solid #1f2937;
      border-radius: 14px;
      padding: 22px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
    }
    h2 { margin: 0 0 10px; font-size: 22px; color: var(--text); }
    p { margin: 0; color: var(--muted); line-height: 1.6; }
    .actions { margin-top: 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .primary {
      display: inline-block;
      padding: 12px 18px;
      border-radius: 10px;
      background: var(--accent);
      color: #0b0f14;
      font-weight: 600;
      text-decoration: none;
      box-shadow: 0 12px 30px rgba(0,0,0,0.25);
    }
    .secondary {
      padding: 11px 15px;
      border-radius: 10px;
      border: 1px solid #374151;
      background: #0f172a;
      color: var(--text);
      cursor: pointer;
      font-weight: 600;
    }
    .note { margin-top: 12px; font-size: 14px; color: var(--muted); }
    .status { margin-top: 12px; font-size: 14px; color: #34d399; }
  </style>
</head>
<body>
  <main class="card">
    <h2>Login complete</h2>
    <p>VS Code should open automatically. If it does not, use the options below.</p>
    <div class="actions">
      <a id="open-vscode" class="primary" href="${safeDeepLink}">Open Visual Studio Code</a>
      <button id="copy-link" class="secondary" type="button">Copy link</button>
    </div>
    <p class="note">If the automatic prompt is blocked, click "Open Visual Studio Code" or paste the copied link into your browser.</p>
    <div id="status" class="status" style="display:none;"></div>
  </main>
  <script>
    (function () {
      var deepLink = ${JSON.stringify(deepLink)};
      var statusEl = document.getElementById('status');

      function triggerVsCode() {
        try {
          var frame = document.createElement('iframe');
          frame.style.display = 'none';
          frame.src = deepLink;
          document.body.appendChild(frame);
          setTimeout(function () {
            try { document.body.removeChild(frame); } catch (e) {}
          }, 1200);
        } catch (e) {
          // ignore
        }

        // Second attempt after the page has painted, to align with the desired flow order.
        setTimeout(function () {
          try { window.location.href = deepLink; } catch (e) {}
        }, 350);
      }

      function startLaunch() {
        // Allow the fallback UI to paint before triggering the deep link prompt.
        requestAnimationFrame(function () {
          setTimeout(triggerVsCode, 120);
        });
      }

      function openViaButton(event) {
        try {
          event && event.preventDefault();
          window.location.href = deepLink;
        } catch (e) {
          // ignore
        }
      }

      function copyLink(event) {
        if (event) event.preventDefault();
        var text = deepLink;
        var onSuccess = function () {
          if (statusEl) {
            statusEl.textContent = 'Link copied. Paste into your browser if VS Code does not open.';
            statusEl.style.display = 'block';
          }
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(onSuccess).catch(function () {
            fallbackCopy(text, onSuccess);
          });
        } else {
          fallbackCopy(text, onSuccess);
        }
      }

      function fallbackCopy(text, onSuccess) {
        try {
          var textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          var ok = document.execCommand('copy');
          document.body.removeChild(textarea);
          if (ok && onSuccess) onSuccess();
        } catch (e) {
          // ignore
        }
      }

      var button = document.getElementById('open-vscode');
      if (button) {
        button.addEventListener('click', openViaButton);
      }

      var copyBtn = document.getElementById('copy-link');
      if (copyBtn) {
        copyBtn.addEventListener('click', copyLink);
      }

      startLaunch();
    })();
  </script>
  <noscript>
    <a href="${safeDeepLink}">Open Visual Studio Code</a>
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

    // VS Code auth flow: direct deep-link redirect for reliable app handoff.
    if (originalRedirect && originalRedirect.toLowerCase().startsWith('vscode://')) {
      const sep = originalRedirect.indexOf('?') === -1 ? '?' : '&';
      const origin = `${req.protocol}://${req.get('host')}`;
      const completeUrl = `${origin}/api/auth/redirect-complete?v=${Date.now()}`;
      const vscodeUri = `${originalRedirect}${sep}token=${encodeURIComponent(token)}&postLogin=${encodeURIComponent(completeUrl)}`;
      // Show fallback immediately on the launch page and still provide a post-login confirmation.
      console.log('[auth] Rendering VS Code launch page with postLogin fallback:', vscodeUri);
      return renderVsCodeLaunchPage(res, vscodeUri);
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