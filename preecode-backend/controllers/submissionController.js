const Submission = require('../models/Submission');
const User = require('../models/User');

// Add submission and update user stats
exports.addSubmission = async (req, res, next) => {
  try {
    const { userId, problemName, difficulty, status } = req.body;
    if (!userId || !problemName || !difficulty || !status) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const submission = await Submission.create({ userId, problemName, difficulty, status });
    // Update stats if accepted
    if (status === 'accepted') {
      user.totalSolved += 1;
      if (difficulty === 'easy') user.easySolved += 1;
      if (difficulty === 'medium') user.mediumSolved += 1;
      if (difficulty === 'hard') user.hardSolved += 1;
      await user.save();
    }
    res.status(201).json(submission);
  } catch (error) {
    next(error);
  }
};

// Get user submissions
exports.getUserSubmissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const submissions = await Submission.find({ userId: id })
      .sort({ submittedAt: -1 })
      .select('-__v');
    res.json(submissions);
  } catch (error) {
    next(error);
  }
};
