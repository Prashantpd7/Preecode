const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { chatWithAI, getAIHint, reviewUserCode, generatePracticeQuestion, verifyCode } = require('../controllers/aiController');
const auth = require('../middleware/authMiddleware');

// Rate limiting for AI endpoints - prevent credit exhaustion
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 AI requests per 15 minutes per IP
  message: { message: 'Too many AI requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/generate-question', auth, aiLimiter, generatePracticeQuestion);
router.post('/chat', auth, aiLimiter, chatWithAI);
router.post('/hint', auth, aiLimiter, getAIHint);
router.post('/review', auth, aiLimiter, reviewUserCode);
router.post('/verify', auth, aiLimiter, verifyCode);

module.exports = router;
