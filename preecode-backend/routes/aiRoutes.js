const express = require('express');
const router = express.Router();
const { chatWithAI, getAIHint, reviewUserCode, generatePracticeQuestion, verifyCode } = require('../controllers/aiController');
const auth = require('../middleware/authMiddleware');

router.post('/generate-question', auth, generatePracticeQuestion);
router.post('/chat', auth, chatWithAI);
router.post('/hint', auth, getAIHint);
router.post('/review', auth, reviewUserCode);
router.post('/verify', auth, verifyCode);

module.exports = router;
