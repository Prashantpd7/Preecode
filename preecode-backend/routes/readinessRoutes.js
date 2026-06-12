const express = require('express');
const auth = require('../middleware/authMiddleware');
const readinessController = require('../controllers/readinessController');

const router = express.Router();

// GET /v2/readiness/:userId — Get placement readiness data
router.get('/:userId', auth, readinessController.getReadiness);

module.exports = router;
