const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Submission = require('../models/Submission');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
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
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      foundingBadgeLevel: user.foundingBadgeLevel,
      hasShared: user.hasShared,
      earlyAccessEndDate: user.earlyAccessEndDate,
      earlyAccessMonthsGranted: user.earlyAccessMonthsGranted,
      certificateId: user.certificateId,
      token: generateToken(user._id),
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
    const user = await User.create({ username, email, password });
    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      foundingBadgeLevel: user.foundingBadgeLevel,
      hasShared: user.hasShared,
      earlyAccessEndDate: user.earlyAccessEndDate,
      earlyAccessMonthsGranted: user.earlyAccessMonthsGranted,
      certificateId: user.certificateId,
      isNewUser: true,
      token: generateToken(user._id),
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
