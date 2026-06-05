const { chat, getHint, reviewCode, generateQuestion, reviewProject } = require('../services/aiService');
const { saveMemory } = require('../services/hindsightService');

// POST /api/ai/generate-question
exports.generatePracticeQuestion = async (req, res, next) => {
  try {
    const { language, difficulty, topic } = req.body;
    if (!language) {
      return res.status(400).json({ message: 'language is required.' });
    }
    const result = await generateQuestion(language, difficulty, topic);

    // Save memory for question generation (fire and forget)
    saveMemory({
      user_id: String(req.user._id),
      memory_type: 'question_generated',
      content: `Generated ${difficulty || 'medium'} coding question in ${language}${topic ? ` (${topic})` : ''}`,
      metadata: {
        language,
        difficulty: difficulty || 'medium',
        topic: topic || 'General',
        question_title: result.title || ''
      }
    }).catch(err => {
      console.error("[QUESTION_MEMORY] Failed to save question memory:", err.message);
    });

    res.json({ question: result });
  } catch (error) {
    console.error('[CONTROLLER_ERROR]', error.message);
    next(error);
  }
};

// POST /api/ai/chat
exports.chatWithAI = async (req, res, next) => {
  try {
    const { message, context, history } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'message is required.' });
    }
    const response = await chat(message, context, history);

    // Save memory for chat interaction (fire and forget)
    saveMemory({
      user_id: String(req.user._id),
      memory_type: 'chat_interaction',
      content: `Chat: ${message.substring(0, 100)}...`,
      metadata: {
        message_preview: message.substring(0, 200),
        has_context: !!context
      }
    }).catch(err => {
      console.error("[CHAT_MEMORY] Failed to save chat memory:", err.message);
    });

    res.json({ response });
  } catch (error) {
    next(error);
  }
};

// POST /api/ai/hint
exports.getAIHint = async (req, res, next) => {
  try {
    const { problemDescription, language } = req.body;
    if (!problemDescription) {
      return res.status(400).json({ message: 'problemDescription is required.' });
    }
    const hint = await getHint(problemDescription, language);

    // Save memory for hint request (fire and forget)
    saveMemory({
      user_id: String(req.user._id),
      memory_type: 'hint_requested',
      content: `Hint requested for ${language || 'unknown'} problem`,
      metadata: {
        language: language || 'unknown',
        problem_preview: problemDescription.substring(0, 100)
      }
    }).catch(err => {
      console.error("[HINT_MEMORY] Failed to save hint memory:", err.message);
    });

    res.json({ hint });
  } catch (error) {
    next(error);
  }
};

// POST /api/ai/review
exports.reviewUserCode = async (req, res, next) => {
  try {
    const { code, language, problemDescription } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'code is required.' });
    }
    const review = await reviewCode(code, language, problemDescription);

    // Save memory for code review (fire and forget)
    saveMemory({
      user_id: String(req.user._id),
      memory_type: 'code_review',
      content: `Code review for ${language || 'unknown'} solution`,
      metadata: {
        language: language || 'unknown',
        has_problem_description: !!problemDescription,
        code_length: code.length
      }
    }).catch(err => {
      console.error("[REVIEW_MEMORY] Failed to save review memory:", err.message);
    });

    res.json({ review });
  } catch (error) {
    next(error);
  }
};

// POST /api/ai/project-review
exports.reviewProjectCode = async (req, res, next) => {
  try {
    const { files, projectInfo, analysisLevel } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ message: 'files array is required and must not be empty.' });
    }

    const validatedFiles = files.map(f => ({
      path: String(f.path || 'unknown').slice(0, 500),
      content: String(f.content || '').slice(0, 50000),
      language: String(f.language || 'text').slice(0, 50),
    }));

    const review = await reviewProject(validatedFiles, projectInfo, analysisLevel);
    res.json(review);
  } catch (error) {
    next(error);
  }
};
