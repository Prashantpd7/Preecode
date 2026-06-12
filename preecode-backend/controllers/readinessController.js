const Submission = require('../models/Submission');
const Interview = require('../models/Interview');
const Resume = require('../models/Resume');

// GET /v2/readiness/:userId
exports.getReadiness = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }

    // Fetch all data in parallel
    const [submissions, interviews, resumes] = await Promise.all([
      Submission.find({ userId }).lean(),
      Interview.find({ userId, status: 'completed' }).sort({ createdAt: -1 }).lean(),
      Resume.find({ userId }).sort({ uploadedAt: -1 }).lean(),
    ]);

    // Calculate problem-solving stats
    const totalSolved = submissions.length;
    const easySolved = submissions.filter(s => s.difficulty === 'easy').length;
    const mediumSolved = submissions.filter(s => s.difficulty === 'medium').length;
    const hardSolved = submissions.filter(s => s.difficulty === 'hard').length;
    const acceptedSolved = submissions.filter(s => s.status === 'accepted').length;

    // Calculate interview score (best recent)
    const interviewScore = interviews.length > 0
      ? Math.max(...interviews.map(iv => iv.overallScore || 0))
      : 0;

    // Calculate resume score (best recent)
    const resumeScore = resumes.length > 0
      ? Math.max(...resumes.map(r => Math.max(r.atsScore || 0, r.analysis?.matchScore || 0)))
      : 0;

    // Calculate readiness percentage
    // Weights: problems solved (40%), interview score (30%), resume score (30%)
    const problemWeight = Math.min(100, (totalSolved / 20) * 100) * 0.4;
    const interviewWeight = interviewScore * 0.3;
    const resumeWeight = resumeScore * 0.3;
    const readinessPercent = Math.min(100, Math.round(problemWeight + interviewWeight + resumeWeight));

    // Generate improvement plan (can also use AI for personalized tips)
    let improvementPlan = [];

    if (totalSolved < 10) {
      improvementPlan.push('Solve more coding problems — aim for at least 10 problems to build fundamentals.');
    }
    if (acceptedSolved < totalSolved * 0.5 && totalSolved > 0) {
      improvementPlan.push('Focus on accuracy — review your wrong submissions to identify recurring mistakes.');
    }
    if (easySolved > 0 && mediumSolved === 0) {
      improvementPlan.push('Challenge yourself with medium-difficulty problems to grow beyond basics.');
    }
    if (interviewScore < 50 && interviews.length > 0) {
      improvementPlan.push('Practice more mock interviews — focus on structuring your answers clearly.');
    }
    if (interviews.length < 2) {
      improvementPlan.push('Complete at least 2-3 mock interviews to build interview confidence.');
    }
    if (resumeScore < 60 && resumes.length > 0) {
      improvementPlan.push('Improve your resume — add more relevant keywords and quantify achievements.');
    }
    if (resumes.length === 0) {
      improvementPlan.push('Upload your resume for AI-powered analysis and improvement suggestions.');
    }
    if (interviews.length === 0 && totalSolved === 0) {
      improvementPlan.push('Start by solving your first coding problem to begin tracking your progress.');
    }

    if (improvementPlan.length === 0) {
      improvementPlan.push('Great progress! Keep solving problems and taking mock interviews to maintain your edge.');
    }

    res.json({
      readinessPercent,
      breakdown: {
        totalSolved,
        easySolved,
        mediumSolved,
        hardSolved,
        acceptedSolved,
      },
      interviewScore,
      resumeScore,
      improvementPlan,
    });
  } catch (error) {
    console.error('[readiness] Get readiness error:', error.message);
    next(error);
  }
};
