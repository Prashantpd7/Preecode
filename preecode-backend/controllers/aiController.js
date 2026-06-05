const { chat, getHint, reviewCode, generateQuestion } = require('../services/aiService');
const { saveMemory } = require('../services/hindsightService');

// POST /api/ai/generate-question
exports.generatePracticeQuestion = async (req, res, next) => {
  try {
    const { language, difficulty } = req.body;
    if (!language) {
      return res.status(400).json({ message: 'language is required.' });
    }
    const result = await generateQuestion(language, difficulty, req.user);
    res.json({ question: result });
  } catch (error) {
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

    // Save memory for AI chat (fire and forget)
    if (req.user) {
      saveMemory({
        user_id: String(req.user._id),
        memory_type: 'ai_chat',
        content: `User asked: "${message.substring(0, 100)}..."`,
        metadata: {
          userMessage: message,
          hasContext: !!context,
          contextLength: context ? context.length : 0
        }
      }).catch(err => {
        console.error("[AI_CHAT_MEMORY] Failed to save chat memory:", err.message);
      });
    }

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

    // Save memory for hint (fire and forget)
    if (req.user) {
      saveMemory({
        user_id: String(req.user._id),
        memory_type: 'hint_used',
        content: `Got hint for ${language || 'unknown'} problem`,
        metadata: {
          language: language || 'unknown',
          problemDescription: problemDescription.substring(0, 200)
        }
      }).catch(err => {
        console.error("[HINT_MEMORY] Failed to save hint memory:", err.message);
      });
    }

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
    if (req.user) {
      saveMemory({
        user_id: String(req.user._id),
        memory_type: 'code_review',
        content: `Code review requested for ${language || 'unknown'}`,
        metadata: {
          language: language || 'unknown',
          codeLength: code.length,
          hasProblemaDescription: !!problemDescription
        }
      }).catch(err => {
        console.error("[REVIEW_MEMORY] Failed to save review memory:", err.message);
      });
    }

    res.json({ review });
  } catch (error) {
    next(error);
  }
};
