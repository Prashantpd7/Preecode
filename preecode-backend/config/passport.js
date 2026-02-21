const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// FIX: callbackURL must be an ABSOLUTE URL pointing to the backend (port 5001).
// A relative path like '/api/auth/google/callback' causes passport to resolve it
// relative to whatever host made the request — which can point to the wrong server.
const BACKEND_URL = `http://localhost:${process.env.PORT || 5001}`;

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