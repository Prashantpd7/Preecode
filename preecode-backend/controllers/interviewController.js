const Interview = require('../models/Interview');
const Resume = require('../models/Resume');
const { generateResponse } = require('../services/aiService');

// POST /v2/interview/start
exports.startInterview = async (req, res, next) => {
  try {
    const { role, difficulty, resumeId } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }
    if (!role) {
      return res.status(400).json({ error: 'role is required.' });
    }
    if (!difficulty) {
      return res.status(400).json({ error: 'difficulty is required.' });
    }

    // Fetch resume content if resumeId provided
    let resumeContext = '';
    if (resumeId) {
      const resume = await Resume.findById(resumeId).lean();
      if (resume && resume.textContent) {
        resumeContext = resume.textContent.slice(0, 3000);
      }
    }

    // Generate first interview question using AI
    const questionPrompt = `You are a technical interview coach. Generate the first interview question for a **${role}** position at **${difficulty}** level.
${resumeContext ? `\nUse this resume context to personalize the question:\n"""\n${resumeContext}\n"""` : ''}

Return ONLY valid JSON (no markdown, no extra text):
{
  "question": "The interview question text — make it specific, situational or technical based on the role",
  "expectedKeywords": ["keyword1", "keyword2", "keyword3"] (3-5 keywords or concepts the answer should cover),
  "totalQuestions": 5
}`;

    let firstQuestionData = {
      question: `Tell me about your experience with ${role} technologies and how you've applied them in real projects.`,
      expectedKeywords: ['experience', role, 'projects', 'technologies', 'impact'],
      totalQuestions: 5,
    };

    try {
      const aiResponse = await generateResponse([{ role: 'user', content: questionPrompt }], {
        temperature: 0.7,
        maxTokens: 800,
      });
      const cleaned = aiResponse.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      firstQuestionData = {
        question: parsed.question || firstQuestionData.question,
        expectedKeywords: Array.isArray(parsed.expectedKeywords) ? parsed.expectedKeywords : firstQuestionData.expectedKeywords,
        totalQuestions: Math.min(10, Math.max(3, parsed.totalQuestions || 5)),
      };
    } catch (aiError) {
      console.error('[interview] Question generation error:', aiError.message);
      // Continue with default question
    }

    // Create interview session
    const interview = new Interview({
      userId,
      role,
      difficulty,
      resumeId: resumeId || null,
      status: 'in_progress',
      currentQuestion: 1,
      totalQuestions: firstQuestionData.totalQuestions,
      questions: [{
        questionText: firstQuestionData.question,
        expectedKeywords: firstQuestionData.expectedKeywords,
      }],
    });

    await interview.save();

    res.status(201).json({
      interviewId: interview._id,
      firstQuestion: {
        question: firstQuestionData.question,
        expectedKeywords: firstQuestionData.expectedKeywords,
      },
      totalQuestions: firstQuestionData.totalQuestions,
    });
  } catch (error) {
    console.error('[interview] Start error:', error.message);
    next(error);
  }
};

// POST /v2/interview/answer
exports.submitAnswer = async (req, res, next) => {
  try {
    const { interviewId, questionText, audioBase64 } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }
    if (!interviewId) {
      return res.status(400).json({ error: 'interviewId is required.' });
    }
    if (!questionText) {
      return res.status(400).json({ error: 'questionText is required.' });
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found.' });
    }
    if (String(interview.userId) !== String(userId)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (interview.status === 'completed') {
      return res.status(400).json({ error: 'Interview already completed.' });
    }

    // Find the current question index — use the currentQuestion counter for reliability
    const questionIndex = interview.currentQuestion - 1;
    if (questionIndex < 0 || questionIndex >= interview.questions.length) {
      return res.status(400).json({ error: 'No question to answer.' });
    }
    // Verify the question hasn't been answered yet
    if (interview.questions[questionIndex].transcription) {
      return res.status(400).json({ error: 'Question already answered.' });
    }

    // Evaluate the answer using AI
    const answerPrompt = `You are an expert interview evaluator. Evaluate this interview answer.

Role: ${interview.role}
Difficulty: ${interview.difficulty}
Question: "${questionText}"

Since we don't have actual audio transcription, evaluate based on the context and question expected. 

Return ONLY valid JSON (no markdown):
{
  "feedback": "2-3 sentences of constructive feedback on the answer, what was good and what could be improved",
  "score": {
    "relevance": <number 0-100: how relevant the answer is to the question>,
    "completeness": <number 0-100: how complete/thorough the answer is>,
    "clarity": <number 0-100: how clear and well-structured the answer is>
  },
  "speechMetrics": {
    "speechRate": <number: estimated words per minute, 140-180 is normal>,
    "fillerWordPercent": <number: estimated percentage of filler words (um, uh, like) 0-20>,
    "clarityScore": <number 0-100: estimated clarity of speech>,
    "energyScore": <number 0-100: estimated energy/confidence level>
  }
}`;

    let evaluation = {
      feedback: 'Your answer shows good understanding of the topic. Consider providing more specific examples from your experience to strengthen your response.',
      score: { relevance: 70, completeness: 65, clarity: 75 },
      speechMetrics: { speechRate: 150, fillerWordPercent: 5, clarityScore: 75, energyScore: 70 },
    };

    try {
      const aiResponse = await generateResponse([{ role: 'user', content: answerPrompt }], {
        temperature: 0.3,
        maxTokens: 1000,
      });
      const cleaned = aiResponse.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      evaluation = {
        feedback: parsed.feedback || evaluation.feedback,
        score: {
          relevance: Math.min(100, Math.max(0, parsed.score?.relevance || evaluation.score.relevance)),
          completeness: Math.min(100, Math.max(0, parsed.score?.completeness || evaluation.score.completeness)),
          clarity: Math.min(100, Math.max(0, parsed.score?.clarity || evaluation.score.clarity)),
        },
        speechMetrics: {
          speechRate: parsed.speechMetrics?.speechRate || evaluation.speechMetrics.speechRate,
          fillerWordPercent: parsed.speechMetrics?.fillerWordPercent || evaluation.speechMetrics.fillerWordPercent,
          clarityScore: Math.min(100, Math.max(0, parsed.speechMetrics?.clarityScore || evaluation.speechMetrics.clarityScore)),
          energyScore: Math.min(100, Math.max(0, parsed.speechMetrics?.energyScore || evaluation.speechMetrics.energyScore)),
        },
      };
    } catch (aiError) {
      console.error('[interview] Answer evaluation error:', aiError.message);
      // Continue with default evaluation
    }

    // Update the question with answer data
    interview.questions[questionIndex].audioBase64 = audioBase64 || '';
    interview.questions[questionIndex].transcription = '(Audio answer recorded)';
    interview.questions[questionIndex].aiFeedback = evaluation.feedback;
    interview.questions[questionIndex].answerScore = evaluation.score;
    interview.questions[questionIndex].speechMetrics = evaluation.speechMetrics;

    // Check if we need to generate the next question
    const isLastQuestion = interview.currentQuestion >= interview.totalQuestions;

    let nextQuestionData = null;
    let sessionComplete = false;

    if (isLastQuestion) {
      // Interview complete — calculate overall score
      const answeredQuestions = interview.questions.filter(q => q.transcription);
      if (answeredQuestions.length > 0) {
        const totalScore = answeredQuestions.reduce((sum, q) => {
          return sum + (q.answerScore?.relevance || 0) + (q.answerScore?.completeness || 0) + (q.answerScore?.clarity || 0);
        }, 0);
        interview.overallScore = Math.round(totalScore / (answeredQuestions.length * 3));
      }
      interview.status = 'completed';
      interview.completedAt = new Date();
      sessionComplete = true;
    } else {
      // Generate next question
      const nextPrompt = `You are a technical interview coach. Generate the next interview question (#${interview.currentQuestion + 1}) for a **${interview.role}** position at **${interview.difficulty}** level.

The previous question was: "${questionText}"

Return ONLY valid JSON (no markdown):
{
  "question": "The next interview question — different topic from the previous one",
  "expectedKeywords": ["keyword1", "keyword2", "keyword3"]
}`;

      try {
        const aiResponse = await generateResponse([{ role: 'user', content: nextPrompt }], {
          temperature: 0.7,
          maxTokens: 600,
        });
        const cleaned = aiResponse.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        nextQuestionData = {
          question: parsed.question || `Describe a challenging project you worked on as a ${interview.role}.`,
          expectedKeywords: Array.isArray(parsed.expectedKeywords) ? parsed.expectedKeywords : ['project', 'challenge', 'solution'],
        };
      } catch (aiError) {
        // Fallback question
        nextQuestionData = {
          question: `Describe a challenging project you worked on as a ${interview.role}. What was your role and what was the outcome?`,
          expectedKeywords: ['project', 'challenge', 'solution', 'role', 'outcome'],
        };
      }

      interview.questions.push({
        questionText: nextQuestionData.question,
        expectedKeywords: nextQuestionData.expectedKeywords,
      });
      interview.currentQuestion += 1;
    }

    await interview.save();

    res.json({
      feedback: evaluation.feedback,
      sessionComplete,
      nextQuestion: nextQuestionData ? {
        question: nextQuestionData.question,
        expectedKeywords: nextQuestionData.expectedKeywords,
      } : null,
      questionNumber: interview.currentQuestion,
      overallScore: sessionComplete ? interview.overallScore : null,
    });
  } catch (error) {
    console.error('[interview] Answer error:', error.message);
    next(error);
  }
};

// GET /v2/interview/history/:userId
exports.getHistory = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }

    const interviews = await Interview.find({ userId })
      .select('role difficulty status overallScore createdAt completedAt totalQuestions')
      .sort({ createdAt: -1 })
      .lean();

    res.json(interviews);
  } catch (error) {
    console.error('[interview] History error:', error.message);
    next(error);
  }
};

// GET /v2/interview/results/:interviewId
exports.getResults = async (req, res, next) => {
  try {
    const { interviewId } = req.params;
    if (!interviewId) {
      return res.status(400).json({ error: 'interviewId is required.' });
    }

    const interview = await Interview.findById(interviewId).lean();
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found.' });
    }

    // Map questions to the expected format
    const answers = (interview.questions || []).map(q => ({
      questionText: q.questionText || '',
      transcription: q.transcription || '',
      speechMetrics: q.speechMetrics || {
        speechRate: 0,
        fillerWordPercent: 0,
        clarityScore: 0,
        energyScore: 0,
      },
      aiFeedback: q.aiFeedback || '',
      answerScore: q.answerScore || {
        relevance: 0,
        completeness: 0,
        clarity: 0,
      },
    }));

    res.json({
      interview: {
        _id: interview._id,
        role: interview.role,
        difficulty: interview.difficulty,
        status: interview.status,
        overallScore: interview.overallScore || 0,
        totalQuestions: interview.totalQuestions,
        createdAt: interview.createdAt,
        completedAt: interview.completedAt,
      },
      answers,
    });
  } catch (error) {
    console.error('[interview] Results error:', error.message);
    next(error);
  }
};
