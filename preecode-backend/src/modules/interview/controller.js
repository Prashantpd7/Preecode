const Interview = require('./model');
const InterviewAnswer = require('./answerModel');
const { generateInterviewQuestions, evaluateAnswer } = require('./service');
const rateLimit = require('express-rate-limit');
const http = require('http');

// Per-user rate limiter: 10 starts per hour
const startLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?._id?.toString() || 'anon',
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many interview sessions started. Try again in an hour.' },
});

// ── POST /api/v2/interview/start ──────────────────────────────────────────────
async function startInterview(req, res) {
  try {
    const { role, difficulty, resumeId } = req.body;
    const userId = req.user._id;

    if (!role) return res.status(400).json({ error: 'role is required' });
    if (!difficulty) return res.status(400).json({ error: 'difficulty is required' });

    // Optionally fetch resume text for personalised questions
    let resumeText = '';
    if (resumeId) {
      try {
        const Resume = require('../resume/model');
        const resume = await Resume.findOne({ _id: resumeId, userId });
        if (resume) resumeText = resume.extractedText || '';
      } catch (_) {}
    }

    const questions = await generateInterviewQuestions(role, difficulty, resumeText);

    const interview = await Interview.create({
      userId,
      role,
      difficulty,
      resumeId: resumeId || null,
      questions,
      status: 'in_progress',
    });

    return res.status(201).json({
      interviewId: interview._id,
      firstQuestion: questions[0],
      totalQuestions: questions.length,
    });
  } catch (err) {
    console.error('[interview/controller] startInterview:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── POST /api/v2/interview/answer ─────────────────────────────────────────────
async function submitAnswer(req, res) {
  try {
    const { interviewId, questionText, audioBase64 } = req.body;
    const userId = req.user._id;

    if (!interviewId) return res.status(400).json({ error: 'interviewId is required' });
    if (!questionText) return res.status(400).json({ error: 'questionText is required' });
    if (!audioBase64) return res.status(400).json({ error: 'audioBase64 is required' });

    const interview = await Interview.findOne({ _id: interviewId, userId });
    if (!interview) return res.status(404).json({ error: 'Interview not found' });

    // Call Python microservice for transcription + speech metrics
    let speechData = {
      transcription: '',
      speechRate: 0,
      fillerWordPercent: 0,
      clarityScore: 0,
      energyScore: 75,
    };

    try {
      const microserviceUrl = process.env.PYTHON_MICROSERVICE_URL || 'http://localhost:8001';
      const url = new URL(microserviceUrl);
      speechData = await callMicroservice(url.hostname, url.port || 8001, audioBase64);
    } catch (msErr) {
      console.warn('[interview/controller] microservice unavailable, using fallback:', msErr.message);
      speechData.transcription = '[Audio transcription unavailable]';
    }

    // Find the question object to get expectedKeywords
    const questionObj = interview.questions.find((q) => q.question === questionText) || {};
    const expectedKeywords = questionObj.expectedKeywords || [];

    // Evaluate answer with AI
    const evaluation = await evaluateAnswer(questionText, speechData.transcription, expectedKeywords);

    // Save answer
    await InterviewAnswer.create({
      interviewId,
      userId,
      questionText,
      transcription: speechData.transcription,
      speechMetrics: {
        speechRate: speechData.speechRate,
        fillerWordPercent: speechData.fillerWordPercent,
        clarityScore: speechData.clarityScore,
        energyScore: speechData.energyScore,
      },
      answerScore: {
        relevance: evaluation.relevance,
        completeness: evaluation.completeness,
        clarity: evaluation.clarity,
      },
      aiFeedback: evaluation.feedback,
    });

    // Determine if more questions remain
    const answeredCount = await InterviewAnswer.countDocuments({ interviewId });
    const totalQuestions = interview.questions.length;
    const nextIndex = answeredCount; // 0-based index of next question

    if (nextIndex < totalQuestions) {
      return res.json({
        feedback: evaluation.feedback,
        nextQuestion: interview.questions[nextIndex],
        questionNumber: nextIndex + 1,
        totalQuestions,
        sessionComplete: false,
      });
    }

    // Last question — compute overall score and complete
    const allAnswers = await InterviewAnswer.find({ interviewId });
    const scores = allAnswers.map((a) => (a.answerScore.relevance + a.answerScore.completeness + a.answerScore.clarity) / 3);
    const overallScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

    await Interview.findByIdAndUpdate(interviewId, {
      status: 'completed',
      overallScore,
      completedAt: new Date(),
    });

    return res.json({
      feedback: evaluation.feedback,
      sessionComplete: true,
      overallScore,
    });
  } catch (err) {
    console.error('[interview/controller] submitAnswer:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── GET /api/v2/interview/results/:interviewId ────────────────────────────────
async function getResults(req, res) {
  try {
    const { interviewId } = req.params;
    const userId = req.user._id;

    const interview = await Interview.findOne({ _id: interviewId, userId });
    if (!interview) return res.status(404).json({ error: 'Interview not found' });

    const answers = await InterviewAnswer.find({ interviewId }).sort({ createdAt: 1 });

    return res.json({ interview, answers });
  } catch (err) {
    console.error('[interview/controller] getResults:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── GET /api/v2/interview/history/:userId ─────────────────────────────────────
async function getHistory(req, res) {
  try {
    const userId = req.user._id;
    const interviews = await Interview.find({ userId, status: 'completed' })
      .sort({ createdAt: -1 })
      .select('-questions');
    return res.json(interviews);
  } catch (err) {
    console.error('[interview/controller] getHistory:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Helper: call Python microservice ─────────────────────────────────────────
function callMicroservice(hostname, port, audioBase64) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ audio_base64: audioBase64 });
    const options = {
      hostname,
      port: Number(port),
      path: '/process-audio',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Microservice timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { startInterview, submitAnswer, getResults, getHistory, startLimiter };
