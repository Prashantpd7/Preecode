const Submission = require('../models/Submission');
const User = require('../models/User');
const { saveMemory } = require('../services/hindsightService');

// Add submission and update user stats
exports.addSubmission = async (req, res, next) => {
  try {
    const submittedUserId = req.body.userId;
    const userId = submittedUserId || (req.user && (req.user._id || req.user.id));
    const problemName = (req.body.problemName || '').trim();
    const difficultyRaw = String(req.body.difficulty || '').toLowerCase();
    const statusRaw = String(req.body.status || '').toLowerCase();
    const topic = (req.body.topic || 'General').trim();
    const timeTaken = (req.body.timeTaken || '00:00').trim();
    const language = (req.body.language || 'unknown').trim();

    let difficulty = 'easy';
    if (difficultyRaw === 'medium' || difficultyRaw === 'hard' || difficultyRaw === 'easy') {
      difficulty = difficultyRaw;
    }

    let status = 'wrong';
    if (statusRaw.includes('accept') || statusRaw.includes('correct') || statusRaw === 'passed') {
      status = 'accepted';
    } else if (statusRaw.includes('runtime') || statusRaw.includes('exception') || statusRaw.includes('crash')) {
      status = 'runtime_error';
    } else if (statusRaw.includes('compil') || statusRaw.includes('build fail')) {
      status = 'compilation_error';
    } else if (statusRaw.includes('timeout') || statusRaw.includes('tle') || statusRaw.includes('time limit')) {
      status = 'time_limit_exceeded';
    }

    console.log('[submission] Received status="' + req.body.status + '" → parsed="' + status + '" for problem="' + problemName + '"');

    if (!userId || !problemName) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const submission = await Submission.create({
      userId,
      problemName,
      difficulty,
      status,
      topic,
      timeTaken,
      language
    });

    // Stats are now calculated from Submission collection directly via userController.getStats.
    // The User model no longer has totalSolved/easySolved/mediumSolved/hardSolved fields,
    // so we skip updating them here to avoid silent no-ops on save.
    // See preecode-backend/models/User.js for the current schema.

    // Save memory for submission (fire and forget)
    saveMemory({
      user_id: String(userId),
      memory_type: 'submission',
      content: `Submission: ${problemName} (${status})`,
      metadata: {
        problemName,
        language,
        difficulty,
        topic,
        status,
        timeTaken,
        problemDescription: req.body.problemDescription || ''
      }
    }).catch(err => {
      console.error("[SUBMISSION_MEMORY] Failed to save submission memory:", err.message);
    });

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
