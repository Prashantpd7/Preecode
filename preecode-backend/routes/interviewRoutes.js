const express = require('express');
const auth = require('../middleware/authMiddleware');
const interviewController = require('../controllers/interviewController');

const router = express.Router();

// POST /v2/interview/start — Start a new interview session
router.post('/start', auth, interviewController.startInterview);

// POST /v2/interview/answer — Submit an answer for the current question
router.post('/answer', auth, interviewController.submitAnswer);

// GET /v2/interview/history/:userId — Get interview history for a user
router.get('/history/:userId', auth, interviewController.getHistory);

// GET /v2/interview/results/:interviewId — Get detailed results for an interview
router.get('/results/:interviewId', auth, interviewController.getResults);

module.exports = router;
