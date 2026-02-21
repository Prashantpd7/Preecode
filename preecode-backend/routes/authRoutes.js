const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Start Google OAuth
// router.get(
//   '/google',
//   passport.authenticate('google', {
//     scope: ['profile', 'email'],
//     session: false,
//   })
// );

router.get('/dev-login', async (req, res) => {
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

// Google Callback — simple redirect now works because frontend and backend
// are on the SAME origin (localhost:5001). No cross-origin port stripping.
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login.html?error=oauth_failed',
  }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅  OAuth success — redirecting to dashboard');

    // Simple redirect — works perfectly now that frontend is served by the same
    // Express server on port 5001. No cross-origin issues, no port stripping.
    res.redirect(`/dashboard.html?token=${token}`);
  }
);

module.exports = router;