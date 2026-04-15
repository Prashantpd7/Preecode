const express = require('express');
const router = express.Router();
const auth = require('../../../middleware/authMiddleware');
const {
  startInterview,
  submitAnswer,
  getResults,
  getHistory,
  startLimiter,
} = require('./controller');

router.post('/start',  auth, startLimiter, startInterview);
router.post('/answer', auth, submitAnswer);
router.get('/results/:interviewId', auth, getResults);
router.get('/history/:userId',      auth, getHistory);

module.exports = router;
