const express = require('express');
const router = express.Router();
const { addPractice, getPractice, runCode } = require('../controllers/practiceController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, addPractice);
router.get('/', auth, getPractice);
router.post('/run', auth, runCode);

module.exports = router;
