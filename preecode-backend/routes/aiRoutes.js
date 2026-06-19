const express = require('express');
const router = express.Router();
const { chatWithAI, getAIHint, reviewUserCode, generatePracticeQuestion, reviewProjectCode } = require('../controllers/aiController');
const auth = require('../middleware/authMiddleware');
const aiGateway = require('../services/aiGatewayService');

router.post('/generate-question', auth, generatePracticeQuestion);
router.post('/chat', auth, chatWithAI);
router.post('/hint', auth, getAIHint);
router.post('/review', auth, reviewUserCode);
router.post('/project-review', auth, reviewProjectCode);

/**
 * GET /api/ai/health
 * Returns the AI Gateway health status.
 */
router.get('/health', (_req, res) => {
  const status = aiGateway.getStatus();
  res.json({
    success: true,
    data: {
      provider: status.provider,
      modelCount: status.modelCount,
      models: status.models,
      keyConfigured: status.keyConfigured,
      keyCount: status.keyCount,
      maxRetries: status.maxRetries,
      timeoutMs: status.timeoutMs,
      status: status.status,
    },
  });
});

module.exports = router;
