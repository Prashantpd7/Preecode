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
    const { interviewId, questionText, audioBase64, transcription: candidateTranscript } = req.body;
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

    // Find the current question index
    const questionIndex = interview.currentQuestion - 1;
    if (questionIndex < 0 || questionIndex >= interview.questions.length) {
      return res.status(400).json({ error: 'No question to answer.' });
    }
    if (interview.questions[questionIndex].transcription) {
      return res.status(400).json({ error: 'Question already answered.' });
    }

    // Use the real transcript from the candidate, or fallback to empty
    const finalTranscript = (candidateTranscript || '').trim();
    console.log('[interview] Evaluating answer for question:', questionText.slice(0, 60));
    console.log('[interview] Candidate transcript:', finalTranscript.slice(0, 200));

    // Evaluate the answer using AI — based on REAL transcript
    const answerPrompt = `You are a strict technical interview evaluator. Your job is to evaluate the candidate's ACTUAL spoken answer against the question asked.

Role: ${interview.role}
Difficulty: ${interview.difficulty}
Question: "${questionText}"

Candidate's actual transcribed answer:
"""
${finalTranscript || '(No answer provided — candidate said nothing or audio could not be transcribed)'}
"""

## EVALUATION RULES (CRITICAL):
1. Base your evaluation SOLELY on the candidate's transcript above. Do NOT imagine what they might have said.
2. If the transcript is empty, the candidate said nothing — score 0 across the board.
3. Be honest and harsh when appropriate. A wrong answer deserves a low score.
4. If the answer is factually incorrect, score it low.
5. If the answer is partially correct, give partial credit.
6. If the answer is completely irrelevant (e.g., nonsense, unrelated topic), score near 0.
7. There is NO minimum score floor. A bad answer MUST get a bad score.

## SCORING RUBRIC:
- technicalAccuracy (0-100): Is the answer factually correct? Does it demonstrate real knowledge?
- relevance (0-100): Is the answer directly relevant to the question asked?
- completeness (0-100): Does the answer fully address the question or is it partial?
- communication (0-100): Is the answer clear, well-structured, and easy to understand?
- confidence (0-100): Does the candidate sound confident or hesitant based on transcript cues?

Then:
- Generate an expected answer or key points that a good candidate would mention.
- Identify which key concepts from the expected answer were DETECTED in the transcript.
- Identify which key concepts were MISSING.
- Generate an improved answer example.

Return ONLY valid JSON (no markdown):
{
  "feedback": "1-2 sentences: what the candidate got right and what they missed. Be specific and reference the transcript.",
  "expectedAnswer": "What a strong candidate would say — 2-4 sentences covering the key concepts",
  "keyPoints": ["key concept 1", "key concept 2", "key concept 3"],
  "detectedConcepts": ["concept from transcript that matches expected points"],
  "missingConcepts": ["expected concept NOT found in transcript"],
  "improvedAnswer": "Example of a strong answer the candidate could give next time — 2-4 sentences",
  "scores": {
    "technicalAccuracy": <number 0-100>,
    "relevance": <number 0-100>,
    "completeness": <number 0-100>,
    "communication": <number 0-100>,
    "confidence": <number 0-100>
  }
}`;

    let evaluation = {
      feedback: '',
      expectedAnswer: '',
      keyPoints: [],
      detectedConcepts: [],
      missingConcepts: [],
      improvedAnswer: '',
      scores: { technicalAccuracy: 0, relevance: 0, completeness: 0, communication: 0, confidence: 0 },
    };

    try {
      const aiResponse = await generateResponse([{ role: 'user', content: answerPrompt }], {
        temperature: 0.2,
        maxTokens: 1500,
      });
      const cleaned = aiResponse.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      evaluation = {
        feedback: parsed.feedback || evaluation.feedback,
        expectedAnswer: parsed.expectedAnswer || '',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        detectedConcepts: Array.isArray(parsed.detectedConcepts) ? parsed.detectedConcepts : [],
        missingConcepts: Array.isArray(parsed.missingConcepts) ? parsed.missingConcepts : [],
        improvedAnswer: parsed.improvedAnswer || '',
        scores: {
          technicalAccuracy: Math.min(100, Math.max(0, parsed.scores?.technicalAccuracy || 0)),
          relevance: Math.min(100, Math.max(0, parsed.scores?.relevance || 0)),
          completeness: Math.min(100, Math.max(0, parsed.scores?.completeness || 0)),
          communication: Math.min(100, Math.max(0, parsed.scores?.communication || 0)),
          confidence: Math.min(100, Math.max(0, parsed.scores?.confidence || 0)),
        },
      };
    } catch (aiError) {
      console.error('[interview] Answer evaluation error:', aiError.message);
      // If AI fails, the evaluation stays at all zeros (honest: we couldn't evaluate)
      evaluation.feedback = 'Could not evaluate the answer due to a system error.';
    }

    // Log evaluation for debugging
    console.log('[interview] Evaluation scores:', JSON.stringify(evaluation.scores));
    console.log('[interview] Detected concepts:', JSON.stringify(evaluation.detectedConcepts));
    console.log('[interview] Missing concepts:', JSON.stringify(evaluation.missingConcepts));
    console.log('[interview] Transcript length:', finalTranscript.length, 'chars');

    // Update the question with REAL answer data
    interview.questions[questionIndex].audioBase64 = audioBase64 || '';
    interview.questions[questionIndex].transcription = finalTranscript || '(No speech detected)';
    interview.questions[questionIndex].aiFeedback = evaluation.feedback;
    interview.questions[questionIndex].answerScore = {
      relevance: evaluation.scores.relevance,
      completeness: evaluation.scores.completeness,
      clarity: evaluation.scores.communication,
    };
    interview.questions[questionIndex].speechMetrics = {
      speechRate: 0,
      fillerWordPercent: 0,
      clarityScore: evaluation.scores.communication,
      energyScore: evaluation.scores.confidence,
    };
    // New detailed evaluation fields
    interview.questions[questionIndex].expectedAnswer = evaluation.expectedAnswer;
    interview.questions[questionIndex].keyPoints = evaluation.keyPoints;
    interview.questions[questionIndex].detectedConcepts = evaluation.detectedConcepts;
    interview.questions[questionIndex].missingConcepts = evaluation.missingConcepts;
    interview.questions[questionIndex].improvedAnswer = evaluation.improvedAnswer;
    interview.questions[questionIndex].technicalAccuracy = evaluation.scores.technicalAccuracy;
    interview.questions[questionIndex].communication = evaluation.scores.communication;
    interview.questions[questionIndex].confidence = evaluation.scores.confidence;

    // Check if we need to generate the next question
    const isLastQuestion = interview.currentQuestion >= interview.totalQuestions;

    let nextQuestionData = null;
    let sessionComplete = false;

    if (isLastQuestion) {
      // Interview complete — calculate overall score using the 5-score system
      const answeredQuestions = interview.questions.filter(q => q.transcription && q.transcription !== '(No speech detected)');
      if (answeredQuestions.length > 0) {
        const totalScore = answeredQuestions.reduce((sum, q) => {
          return sum + (q.technicalAccuracy || 0) + (q.answerScore?.relevance || 0) +
                 (q.answerScore?.completeness || 0) + (q.communication || 0) + (q.confidence || 0);
        }, 0);
        interview.overallScore = Math.round(totalScore / (answeredQuestions.length * 5));
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

    // Map questions to the expected format with new detailed fields
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
      // New detailed evaluation fields
      expectedAnswer: q.expectedAnswer || '',
      keyPoints: q.keyPoints || [],
      detectedConcepts: q.detectedConcepts || [],
      missingConcepts: q.missingConcepts || [],
      improvedAnswer: q.improvedAnswer || '',
      technicalAccuracy: q.technicalAccuracy || 0,
      communication: q.communication || 0,
      confidence: q.confidence || 0,
    }));

    // Calculate overall score using the 5-score system
    const scoredQuestions = answers.filter(a => a.transcription && a.transcription !== '(No speech detected)');
    let overallScore = 0;
    if (scoredQuestions.length > 0) {
      const total = scoredQuestions.reduce((sum, a) => {
        return sum + a.technicalAccuracy + (a.answerScore?.relevance || 0) +
               (a.answerScore?.completeness || 0) + a.communication + a.confidence;
      }, 0);
      overallScore = Math.round(total / (scoredQuestions.length * 5));
    }

    res.json({
      interview: {
        _id: interview._id,
        role: interview.role,
        difficulty: interview.difficulty,
        status: interview.status,
        overallScore: interview.overallScore || overallScore || 0,
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
