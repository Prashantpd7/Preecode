const path = require('path');
const fs = require('fs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const Resume = require('./model');
const ResumeScore = require('./scoreModel');
const { analyzeResume } = require('./service');

// ── Upload directory ──────────────────────────────────────────────────────────
const UPLOAD_DIR = process.env.RESUME_UPLOAD_DIR || path.join(__dirname, '../../../uploads/resumes');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Multer config ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only PDF, DOCX, and TXT files are allowed'));
  },
});

// Per-user rate limiter: 10 uploads per hour
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?._id?.toString() || 'anon',
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many resume uploads. Try again in an hour.' },
});

// ── Text extraction helpers ───────────────────────────────────────────────────
async function extractText(filePath, ext) {
  if (ext === '.txt') {
    return fs.readFileSync(filePath, 'utf8');
  }
  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  return '';
}

// ── POST /api/v2/resume/upload ────────────────────────────────────────────────
async function uploadResume(req, res) {
  try {
    const { targetRole } = req.body;
    const userId = req.user._id;

    if (!req.file) return res.status(400).json({ error: 'file is required' });
    if (!targetRole) return res.status(400).json({ error: 'targetRole is required' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let extractedText = '';
    try {
      extractedText = await extractText(req.file.path, ext);
    } catch (parseErr) {
      console.warn('[resume/controller] text extraction failed:', parseErr.message);
    }

    // AI analysis
    const analysis = await analyzeResume(extractedText, targetRole);

    // Save Resume document
    const resume = await Resume.create({
      userId,
      fileName: req.file.originalname,
      fileUrl: req.file.path,
      extractedText,
      skills: analysis.skills || [],
      experience: analysis.experience || [],
      keywords: analysis.keywords || [],
      atsScore: analysis.atsScore || 0,
      structureScore: analysis.structureScore || 0,
    });

    // Save ResumeScore document
    const score = await ResumeScore.create({
      resumeId: resume._id,
      userId,
      targetRole,
      matchScore: analysis.matchScore || 0,
      missingSkills: analysis.missingSkills || [],
      suggestions: analysis.suggestions || [],
    });

    return res.status(201).json({
      resumeId: resume._id,
      atsScore: resume.atsScore,
      structureScore: resume.structureScore,
      matchScore: score.matchScore,
      missingSkills: score.missingSkills,
      suggestions: score.suggestions,
    });
  } catch (err) {
    console.error('[resume/controller] uploadResume:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── GET /api/v2/resume/analysis/:resumeId ─────────────────────────────────────
async function getAnalysis(req, res) {
  try {
    const { resumeId } = req.params;
    const userId = req.user._id;

    const resume = await Resume.findOne({ _id: resumeId, userId });
    if (!resume) return res.status(404).json({ error: 'Resume not found' });

    const score = await ResumeScore.findOne({ resumeId }).sort({ scoredAt: -1 });

    return res.json({ resume, score });
  } catch (err) {
    console.error('[resume/controller] getAnalysis:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── GET /api/v2/resume/list/:userId ───────────────────────────────────────────
async function listResumes(req, res) {
  try {
    const userId = req.user._id;
    const resumes = await Resume.find({ userId }).sort({ uploadedAt: -1 }).select('-extractedText');
    return res.json(resumes);
  } catch (err) {
    console.error('[resume/controller] listResumes:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { upload, uploadLimiter, uploadResume, getAnalysis, listResumes };
