const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Use explicit backend URL from env in production. Render should set BACKEND_URL.
// Fallback to the known Render hostname used for this project, and localhost for dev.
const BACKEND_URL = process.env.BACKEND_URL || (process.env.NODE_ENV === 'production' ? 'https://preecode-backend.onrender.com' : 'http://localhost:5001');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${BACKEND_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ providerId: profile.id });

        if (user) {
          return done(null, user);
        }

        // Generate a unique username from Google display name
        const baseUsername = profile.displayName.replace(/\s+/g, '_').toLowerCase();
        let username = baseUsername;
        let counter = 1;
        while (await User.findOne({ username })) {
          username = `${baseUsername}_${counter}`;
          counter++;
        }

        user = await User.create({
          name: profile.displayName,
          username,
          email: profile.emails[0].value,
          provider: 'google',
          providerId: profile.id,
          avatar: profile.photos[0]?.value || '',
        });

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

module.exports = passport;