const express = require('express');
const router = express.Router();
const auth = require('../../../middleware/authMiddleware');
const { upload, uploadLimiter, uploadResume, getAnalysis, listResumes, saveBuiltResume, getBuiltResumes } = require('./controller');

router.post('/upload',            auth, uploadLimiter, upload.single('file'), uploadResume);
router.get('/analysis/:resumeId', auth, getAnalysis);
router.get('/list/:userId',       auth, listResumes);

// Resume Builder Routes
router.post('/build', auth, saveBuiltResume);
router.get('/built', auth, getBuiltResumes);

module.exports = router;
