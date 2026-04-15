const User = require('../../../models/User');
const Submission = require('../../../models/Submission');
const Interview = require('../interview/model');
const ResumeScore = require('../resume/scoreModel');
const { generateImprovementPlan } = require('./service');

// ── GET /api/v2/readiness/:userId ─────────────────────────────────────────────
async function getReadiness(req, res) {
  try {
    const userId = req.user._id;

    // 1. Coding stats — from User model (totalSolved) + Submission collection
    const user = await User.findById(userId).select('totalSolved easySolved mediumSolved hardSolved');
    const totalSolved = user ? user.totalSolved || 0 : 0;
    const codingScore = Math.min(100, Math.round((totalSolved / 200) * 100));

    // 2. Best interview score
    const bestInterview = await Interview.findOne({ userId, status: 'completed' })
      .sort({ overallScore: -1 })
      .select('overallScore');
    const interviewScore = bestInterview ? bestInterview.overallScore : 0;

    // 3. Latest resume scores
    const latestScore = await ResumeScore.findOne({ userId }).sort({ scoredAt: -1 });
    let resumeScore = 0;
    if (latestScore) {
      // Get atsScore from the Resume document
      const Resume = require('../resume/model');
      const resume = await Resume.findById(latestScore.resumeId).select('atsScore');
      const atsScore = resume ? resume.atsScore : 0;
      resumeScore = Math.round((atsScore + latestScore.matchScore) / 2);
    }

    // 4. Composite readiness
    const readinessPercent = Math.round(
      codingScore * 0.40 + interviewScore * 0.35 + resumeScore * 0.25
    );

    // 5. AI improvement plan
    const improvementPlan = await generateImprovementPlan(codingScore, interviewScore, resumeScore);

    return res.json({
      readinessPercent,
      codingScore,
      interviewScore,
      resumeScore,
      improvementPlan,
      breakdown: {
        totalSolved,
        easySolved: user?.easySolved || 0,
        mediumSolved: user?.mediumSolved || 0,
        hardSolved: user?.hardSolved || 0,
      },
    });
  } catch (err) {
    console.error('[readiness/controller] getReadiness:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getReadiness };
