const express = require('express');
const router = express.Router();
const auth = require('../../../middleware/authMiddleware');
const { getReadiness } = require('./controller');

router.get('/:userId', auth, getReadiness);

module.exports = router;
