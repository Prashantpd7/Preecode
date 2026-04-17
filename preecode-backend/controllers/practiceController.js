const Practice = require('../models/Practice');

// Save a practice session
exports.addPractice = async (req, res, next) => {
  try {
    const { question, timeTaken, hintsUsed, solutionViewed, language, date, topic, difficulty, hintUsagePercent, aiRating } = req.body;
    if (!question || !timeTaken || !language || !date) {
      return res.status(400).json({ message: 'question, timeTaken, language, and date are required.' });
    }
    const practice = await Practice.create({
      userId: req.user._id,
      question,
      timeTaken,
      topic: topic || 'General',
      difficulty: ['easy', 'medium', 'hard'].includes(String(difficulty || '').toLowerCase()) ? String(difficulty).toLowerCase() : 'medium',
      hintsUsed: hintsUsed || 0,
      hintUsagePercent: Number.isFinite(Number(hintUsagePercent)) ? Math.max(0, Math.min(100, Number(hintUsagePercent))) : 0,
      aiRating: Number.isFinite(Number(aiRating)) ? Math.max(0, Math.min(10, Number(aiRating))) : 0,
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

// Judge0 language IDs
const LANG_IDS = {
  python: 71, javascript: 63, typescript: 74,
  java: 62, cpp: 54, c: 50, go: 60, rust: 73,
};

// Run code via Judge0 CE (proxy to avoid CORS on frontend)
exports.runCode = async (req, res, next) => {
  try {
    const { code, language } = req.body;
    if (!code || !language) return res.status(400).json({ error: 'code and language are required' });

    const langId = LANG_IDS[language];
    if (!langId) return res.status(400).json({ error: 'Unsupported language' });

    const response = await fetch('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_code: code, language_id: langId, stdin: '' }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'Code runner error', detail: err });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    next(err);
  }
};
