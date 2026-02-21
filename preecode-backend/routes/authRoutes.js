const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');

const router = express.Router();

/* ================= GOOGLE OAUTH START ================= */

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

/* ================= GOOGLE OAUTH CALLBACK ================= */

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login.html?error=oauth_failed`,
  }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirect to Vercel frontend with token
    res.redirect(
      `${process.env.FRONTEND_URL}/dashboard.html?token=${token}`
    );
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