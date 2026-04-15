const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Validate required Google OAuth configuration
const validateGoogleConfig = () => {
  const requiredVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    console.warn(`⚠️  Missing Google OAuth configuration: ${missing.join(', ')}`);
  }
};

validateGoogleConfig();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || `${BACKEND_URL}/api/auth/google/callback`;

console.log('[passport] Google OAuth configured:');
console.log(`  CALLBACK_URL: ${GOOGLE_CALLBACK_URL}`);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('[passport] Google profile received for:', profile.emails[0]?.value);

        let user = await User.findOne({ providerId: profile.id });
        const providerAvatar = profile.photos[0]?.value || '';

        if (user) {
          console.log('[passport] Existing user found:', user._id);
          if (providerAvatar && user.avatar !== providerAvatar) {
            user.avatar = providerAvatar;
            await user.save();
          }
          return done(null, user);
        }

        console.log('[passport] Creating new user from Google profile');

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
          avatar: providerAvatar,
        });

        console.log('[passport] New user created with ID:', user._id);
        return done(null, user);
      } catch (error) {
        console.error('[passport] Error in Google strategy:', error.message);
        return done(error, null);
      }
    }
  )
);

module.exports = passport;