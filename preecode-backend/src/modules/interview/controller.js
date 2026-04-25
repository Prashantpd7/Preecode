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

    console.log('[interview/start] Request received:', {
      userId: userId.toString(),
      role,
      difficulty,
      resumeId
    });

    if (!role) {
      console.error('[interview/start] Missing role');
      return res.status(400).json({ error: 'Role is required' });
    }
    if (!difficulty) {
      console.error('[interview/start] Missing difficulty');
      return res.status(400).json({ error: 'Difficulty is required' });
    }

    // Optionally fetch resume text for personalised questions
    let resumeText = '';
    if (resumeId) {
      try {
        console.log('[interview/start] Fetching resume:', resumeId);
        const Resume = require('../resume/model');
        const resume = await Resume.findOne({ _id: resumeId, userId });
        if (resume) {
          resumeText = resume.extractedText || '';
          console.log('[interview/start] Resume found, text length:', resumeText.length);
        } else {
          console.warn('[interview/start] Resume not found');
        }
      } catch (resumeErr) {
        console.error('[interview/start] Resume fetch error:', resumeErr);
      }
    }

    console.log('[interview/start] Generating questions...');
    let questions;
    try {
      questions = await generateInterviewQuestions(role, difficulty, resumeText);
      console.log('[interview/start] Questions generated:', questions.length);
    } catch (genErr) {
      console.error('[interview/start] Question generation failed:', genErr);
      return res.status(500).json({ 
        error: 'Failed to generate interview questions: ' + (genErr.message || 'Please try again.') 
      });
    }

    console.log('[interview/start] Creating interview document...');
    const interview = await Interview.create({
      userId,
      role,
      difficulty,
      resumeId: resumeId || null,
      questions,
      status: 'in_progress',
    });

    console.log('[interview/start] Interview created:', interview._id.toString());

    return res.status(201).json({
      interviewId: interview._id,
      firstQuestion: questions[0],
      totalQuestions: questions.length,
    });
  } catch (err) {
    console.error('[interview/controller] startInterview error:', err);
    return res.status(500).json({ 
      error: 'Internal server error: ' + (err.message || 'Please try again later.') 
    });
  }
}

// ── POST /api/v2/interview/answer ─────────────────────────────────────────────
async function submitAnswer(req, res) {
  try {
    const { interviewId, questionText, audioBase64, transcription: clientTranscription } = req.body;
    const userId = req.user._id;

    console.log('[interview/submitAnswer] Request received:', {
      userId: userId.toString(),
      interviewId,
      hasAudio: !!audioBase64,
      audioLength: audioBase64 ? audioBase64.length : 0,
      hasClientTranscription: !!clientTranscription
    });

    if (!interviewId) {
      console.error('[interview/submitAnswer] Missing interviewId');
      return res.status(400).json({ error: 'interviewId is required' });
    }
    if (!questionText) {
      console.error('[interview/submitAnswer] Missing questionText');
      return res.status(400).json({ error: 'questionText is required' });
    }
    if (!audioBase64) {
      console.error('[interview/submitAnswer] Missing audioBase64');
      return res.status(400).json({ error: 'audioBase64 is required' });
    }

    console.log('[interview/submitAnswer] Finding interview...');
    const interview = await Interview.findOne({ _id: interviewId, userId });
    if (!interview) {
      console.error('[interview/submitAnswer] Interview not found');
      return res.status(404).json({ error: 'Interview not found' });
    }

    console.log('[interview/submitAnswer] Interview found, status:', interview.status);

    // Call Python microservice for transcription + speech metrics
    let speechData = {
      transcription: clientTranscription || '',
      speechRate: 120, // default dummy metrics
      fillerWordPercent: 2.5,
      clarityScore: 85,
      energyScore: 75,
    };

    try {
      console.log('[interview/submitAnswer] Calling microservice...');
      const microserviceUrl = process.env.PYTHON_MICROSERVICE_URL || 'http://localhost:8001';
      const url = new URL(microserviceUrl);
      const msData = await callMicroservice(url.hostname, url.port || 8001, audioBase64);
      console.log('[interview/submitAnswer] Microservice response received');
      speechData = msData;
    } catch (msErr) {
      console.warn('[interview/submitAnswer] Microservice unavailable, using fallback:', msErr.message);
      if (!speechData.transcription) {
        speechData.transcription = '[Audio transcription unavailable]';
      }
    }

    // Find the question object to get expectedKeywords
    const questionObj = interview.questions.find((q) => q.question === questionText) || {};
    const expectedKeywords = questionObj.expectedKeywords || [];

    console.log('[interview/submitAnswer] Evaluating answer with AI...');
    let evaluation;
    try {
      evaluation = await evaluateAnswer(questionText, speechData.transcription, expectedKeywords);
      console.log('[interview/submitAnswer] AI evaluation complete');
    } catch (evalErr) {
      console.error('[interview/submitAnswer] AI evaluation failed:', evalErr);
      return res.status(500).json({ 
        error: 'Failed to evaluate answer: ' + (evalErr.message || 'Please try again.') 
      });
    }

    // Save answer
    console.log('[interview/submitAnswer] Saving answer...');
    try {
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
      console.log('[interview/submitAnswer] Answer saved');
    } catch (saveErr) {
      console.error('[interview/submitAnswer] Failed to save answer:', saveErr);
      return res.status(500).json({ error: 'Failed to save answer: ' + saveErr.message });
    }

    // Determine if more questions remain
    const answeredCount = await InterviewAnswer.countDocuments({ interviewId });
    const totalQuestions = interview.questions.length;
    const nextIndex = answeredCount; // 0-based index of next question

    console.log('[interview/submitAnswer] Progress:', { answeredCount, totalQuestions, nextIndex });

    if (nextIndex < totalQuestions) {
      console.log('[interview/submitAnswer] More questions remaining');
      return res.json({
        feedback: evaluation.feedback,
        nextQuestion: interview.questions[nextIndex],
        questionNumber: nextIndex + 1,
        totalQuestions,
        sessionComplete: false,
      });
    }

    // Last question — compute overall score and complete
    console.log('[interview/submitAnswer] Last question, computing overall score...');
    const allAnswers = await InterviewAnswer.find({ interviewId });
    const scores = allAnswers.map((a) => (a.answerScore.relevance + a.answerScore.completeness + a.answerScore.clarity) / 3);
    const overallScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

    console.log('[interview/submitAnswer] Overall score:', overallScore);

    await Interview.findByIdAndUpdate(interviewId, {
      status: 'completed',
      overallScore,
      completedAt: new Date(),
    });

    console.log('[interview/submitAnswer] Interview completed successfully');

    return res.json({
      feedback: evaluation.feedback,
      sessionComplete: true,
      overallScore,
    });
  } catch (err) {
    console.error('[interview/controller] submitAnswer error:', err);
    return res.status(500).json({ 
      error: 'Internal server error: ' + (err.message || 'Please try again later.') 
    });
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
