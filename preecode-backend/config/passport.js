const passport = require('passport');
const User = require('../models/User');
const {
  googleCallbackUrl,
  googleClientId,
  googleClientSecret,
} = require('./runtimeConfig');

// Only configure Google Strategy if Google OAuth credentials are provided
if (googleClientId && googleClientSecret) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;

  passport.use(
    new GoogleStrategy(
      {
        // OAuth config stays env-driven so local and production use the same contract.
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackUrl,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          const providerAvatar = profile.photos?.[0]?.value || '';

          if (!email) {
            return done(new Error('Google account did not provide an email'), null);
          }

          // Check if Google account already exists
          let user = await User.findOne({ providerId: profile.id });

          if (user) {
            if (providerAvatar && user.avatar !== providerAvatar) {
              user.avatar = providerAvatar;
              await user.save();
            }

            return done(null, user);
          }

          // Check if email already exists
          user = await User.findOne({ email });

          if (user) {
            user.provider = 'google';
            user.providerId = profile.id;

            if (providerAvatar && user.avatar !== providerAvatar) {
              user.avatar = providerAvatar;
            }

            await user.save();

            return done(null, user);
          }

          // Create new user
          const baseUsername =
            profile.displayName.replace(/\s+/g, '_').toLowerCase();

          let username = baseUsername;
          let counter = 1;

          while (await User.findOne({ username })) {
            username = `${baseUsername}_${counter}`;
            counter++;
          }

          user = await User.create({
            name: profile.displayName,
            username,
            email,
            provider: 'google',
            providerId: profile.id,
            avatar: providerAvatar,
          });

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  console.log('[passport] Google OAuth strategy configured');
} else {
  console.log('[passport] Google OAuth strategy DISABLED (no credentials). Use email/password login.');
}

module.exports = passport;
