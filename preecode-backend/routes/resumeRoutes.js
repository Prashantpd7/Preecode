const express = require('express');
const multer = require('multer');
const auth = require('../middleware/authMiddleware');
const resumeController = require('../controllers/resumeController');

const router = express.Router();

// Configure multer for memory storage (handles PDF, DOCX, TXT files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/msword',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Also allow by extension since some browsers may send generic mime types
      const ext = (file.originalname || '').split('.').pop().toLowerCase();
      if (['pdf', 'docx', 'txt', 'doc'].includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF, DOCX, and TXT files are allowed'), false);
      }
    }
  },
});

// POST /v2/resume/upload — Upload and analyze a resume
router.post('/upload', auth, upload.single('file'), resumeController.uploadResume);

// GET /v2/resume/list/:userId — List all resumes for a user
router.get('/list/:userId', auth, resumeController.listResumes);

// GET /v2/resume/analysis/:resumeId — Get full analysis for a resume
router.get('/analysis/:resumeId', auth, resumeController.getAnalysis);

module.exports = router;
