const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Submission = require('../models/Submission');
const crypto = require('crypto');

const generateToken = (userId, tokenVersion = 0) => {
  return jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const avatarFromEmail = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  return `https://unavatar.io/google/${encodeURIComponent(normalized)}`;
};

const isGeneratedFallbackAvatar = (url) => {
  const value = String(url || '').toLowerCase();
  if (!value) return true;
  return (
    value.includes('gravatar.com/avatar/') ||
    value.includes('ui-avatars.com') ||
    value.includes('unavatar.io/google/')
  );
};

const ensureAvatar = async (userDoc) => {
  if (!userDoc) {
    return userDoc;
  }
  const fallbackAvatar = avatarFromEmail(userDoc.email);
  if (!fallbackAvatar) {
    return userDoc;
  }
  if (userDoc.avatar && !isGeneratedFallbackAvatar(userDoc.avatar)) {
    return userDoc;
  }
  if (userDoc.avatar === fallbackAvatar) {
    return userDoc;
  }
  userDoc.avatar = fallbackAvatar;
  await userDoc.save();
  return userDoc;
};

// Login user by email + password
exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const user = await User.findOne({ email }).select('-__v');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (!user.avatar || isGeneratedFallbackAvatar(user.avatar)) {
      user.avatar = avatarFromEmail(user.email);
      await user.save();
    }

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar || '',
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      foundingBadgeLevel: user.foundingBadgeLevel,
      hasShared: user.hasShared,
      earlyAccessEndDate: user.earlyAccessEndDate,
      earlyAccessMonthsGranted: user.earlyAccessMonthsGranted,
      certificateId: user.certificateId,
      token: generateToken(user._id, user.tokenVersion || 0),
    });
  } catch (error) {
    next(error);
  }
};

// Create user
exports.createUser = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required.' });
    }
    const userExists = await User.findOne({ $or: [{ username }, { email }] });
    if (userExists) {
      return res.status(409).json({ message: 'User already exists.' });
    }
    const user = await User.create({
      username,
      email,
      password,
      avatar: avatarFromEmail(email)
    });
    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar || '',
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      foundingBadgeLevel: user.foundingBadgeLevel,
      hasShared: user.hasShared,
      earlyAccessEndDate: user.earlyAccessEndDate,
      earlyAccessMonthsGranted: user.earlyAccessMonthsGranted,
      certificateId: user.certificateId,
      isNewUser: true,
      token: generateToken(user._id, user.tokenVersion || 0),
    });
  } catch (error) {
    next(error);
  }
};

// Get user profile
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -__v');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    await ensureAvatar(user);
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// Get current authenticated user
exports.getMe = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    const user = await User.findById(req.user._id).select('-password -__v');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    await ensureAvatar(user);
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// Get dashboard stats
exports.getStats = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-__v');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    // Get recent submissions (last 10)
    const recentSubmissions = await Submission.find({ userId: user._id })
      .sort({ submittedAt: -1 })
      .limit(10)
      .select('-__v -userId');
    res.json({
      totalSolved: user.totalSolved,
      easySolved: user.easySolved,
      mediumSolved: user.mediumSolved,
      hardSolved: user.hardSolved,
      recentSubmissions,
    });
  } catch (error) {
    next(error);
  }
};

// Update user profile
exports.updateProfile = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    const { username, avatar } = req.body;
    const userId = req.user._id;

    // Validate input
    if (username && username.trim() === '') {
      return res.status(400).json({ message: 'Username cannot be empty.' });
    }

    // Check if new username is unique (if changed)
    if (username && username !== req.user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser && existingUser._id.toString() !== userId.toString()) {
        return res.status(409).json({ message: 'Username already taken.' });
      }
    }

    // Update user
    const updateFields = {};
    if (username) updateFields.username = username;
    if (avatar) updateFields.avatar = avatar;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true }
    ).select('-password -__v');

    res.json({
      message: 'Profile updated successfully.',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// Logout current user (invalidate existing JWTs by bumping tokenVersion)
exports.logoutUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};
