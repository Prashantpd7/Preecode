const Practice = require('../models/Practice');

// Save a practice session
exports.addPractice = async (req, res, next) => {
  try {
    const { question, timeTaken, hintsUsed, solutionViewed, language, date } = req.body;
    if (!question || !timeTaken || !language || !date) {
      return res.status(400).json({ message: 'question, timeTaken, language, and date are required.' });
    }
    const practice = await Practice.create({
      userId: req.user._id,
      question,
      timeTaken,
      hintsUsed: hintsUsed || 0,
      solutionViewed: solutionViewed || false,
      language,
      date,
    });
    res.status(201).json(practice);
  } catch (error) {
    next(error);
  }
};

// Get all practice sessions for the logged-in user
exports.getPractice = async (req, res, next) => {
  try {
    const practices = await Practice.find({ userId: req.user._id })
      .sort({ date: -1 })
      .limit(50)
      .lean();
    res.json(practices);
  } catch (error) {
    next(error);
  }
};
