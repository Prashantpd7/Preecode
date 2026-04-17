/**
 * GitHub OAuth Routes
 * ─────────────────────────────────────────────────────────────
 * GET /api/auth/github          → Redirect user to GitHub OAuth
 * GET /api/auth/github/callback → Handle GitHub callback, issue JWT
 *
 * No passport. No external auth libs. Pure fetch + JWT.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// ── Config ────────────────────────────────────────────────────
const GITHUB_CLIENT_ID     = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const FRONTEND_URL         = process.env.FRONTEND_URL || 'http://localhost:3000';
const JWT_SECRET           = process.env.JWT_SECRET;

// Validate on startup
if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.warn('⚠️  [github-auth] GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set.');
}

// ── Step 1: Redirect to GitHub ────────────────────────────────
/**
 * GET /api/auth/github
 * Builds the GitHub OAuth authorization URL and redirects the user.
 * Scope: user:email — so we can read their email even if it's private.
 */
router.get('/', (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({ error: 'GitHub OAuth not configured on server.' });
  }

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    scope: 'user:email',
    // Optional: pass a random state for CSRF protection
    // state: crypto.randomUUID(),
  });

  const githubAuthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  console.log('[github-auth] Redirecting to GitHub OAuth');
  return res.redirect(githubAuthUrl);
});

// ── Step 2: Handle GitHub Callback ───────────────────────────
/**
 * GET /api/auth/github/callback
 * GitHub redirects here with ?code=...
 * We exchange the code for an access token, fetch user info,
 * find or create the user in MongoDB, then issue a JWT.
 */
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  // GitHub denied access or something went wrong
  if (error) {
    console.error('[github-auth] GitHub returned error:', error);
    return res.redirect(`${FRONTEND_URL}/login.html?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.error('[github-auth] No code in callback query');
    return res.redirect(`${FRONTEND_URL}/login.html?error=missing_code`);
  }

  try {
    // ── 2a: Exchange code for access token ──────────────────
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json', // so GitHub returns JSON not form-encoded
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error('[github-auth] Token exchange failed:', tokenData.error_description || tokenData.error);
      return res.redirect(`${FRONTEND_URL}/login.html?error=token_exchange_failed`);
    }

    const accessToken = tokenData.access_token;
    console.log('[github-auth] Access token obtained');

    // ── 2b: Fetch GitHub user profile ───────────────────────
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Preecode-App', // GitHub requires a User-Agent header
      },
    });

    if (!userResponse.ok) {
      console.error('[github-auth] Failed to fetch GitHub user:', userResponse.status);
      return res.redirect(`${FRONTEND_URL}/login.html?error=user_fetch_failed`);
    }

    const githubUser = await userResponse.json();
    console.log('[github-auth] GitHub user fetched:', githubUser.login);

    // ── 2c: Get email (may be null if user keeps it private) ─
    let email = githubUser.email;

    if (!email) {
      // Fetch from /user/emails endpoint which returns all emails including private ones
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Preecode-App',
        },
      });

      if (emailsResponse.ok) {
        const emails = await emailsResponse.json();
        // Prefer primary + verified email
        const primary = emails.find(e => e.primary && e.verified);
        email = primary ? primary.email : (emails[0]?.email || null);
        console.log('[github-auth] Email fetched from /user/emails:', email ? '✓' : 'still null');
      }
    }

    if (!email) {
      console.error('[github-auth] Could not retrieve email for user:', githubUser.login);
      return res.redirect(`${FRONTEND_URL}/login.html?error=no_email`);
    }

    // ── 2d: Find or create user in MongoDB ──────────────────
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // New user — create account
      // Generate a unique username from GitHub login
      const baseUsername = githubUser.login.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      let username = baseUsername;
      let suffix = 1;
      while (await User.findOne({ username })) {
        username = `${baseUsername}_${suffix++}`;
      }

      user = await User.create({
        email: email.toLowerCase(),
        username,
        name: githubUser.name || githubUser.login,
        avatar: githubUser.avatar_url || '',
        provider: 'github',
        providerId: String(githubUser.id),
        // No password for OAuth users
        password: undefined,
      });
      console.log('[github-auth] New user created:', user._id);
    } else {
      // Existing user — update GitHub info if not already set
      if (!user.providerId) {
        user.providerId = String(githubUser.id);
        user.provider = user.provider || 'github';
        await user.save();
      }
      console.log('[github-auth] Existing user found:', user._id);
    }

    // ── 2e: Issue JWT ────────────────────────────────────────
    const token = jwt.sign(
      { id: user._id, tokenVersion: user.tokenVersion || 0 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('[github-auth] ✅ JWT issued for user:', user._id);

    // ── 2f: Redirect to frontend with token ─────────────────
    // The frontend callback.html stores the token in localStorage
    return res.redirect(`${FRONTEND_URL}/auth/callback.html?token=${encodeURIComponent(token)}`);

  } catch (err) {
    console.error('[github-auth] Unexpected error:', err.message);
    return res.redirect(`${FRONTEND_URL}/login.html?error=server_error`);
  }
});

module.exports = router;
