const Resume = require('../models/Resume');
const { generateResponse } = require('../services/aiService');

// Try to load pdf-parse — it may fail in some environments
let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (_) {
  console.warn('[resume] pdf-parse module not available — PDF text extraction will be limited.');
}

/**
 * Extract text content from an uploaded file buffer.
 * Uses pdf-parse for PDFs and plain conversion for TXT.
 * Returns the extracted text or empty string on failure.
 */
async function extractTextFromBuffer(buffer, fileType) {
  try {
    if (fileType === 'txt') {
      return buffer.toString('utf-8');
    }

    if (fileType === 'pdf' && pdfParse && pdfParse.PDFParse) {
      try {
        const instance = new pdfParse.PDFParse({ data: buffer, verbosity: 0 });
        await instance.load(buffer);
        const text = await instance.getText();
        const cleaned = (text || '').trim();
        if (cleaned.length > 20) return cleaned;
      } catch (pdfErr) {
        console.warn('[resume] pdf-parse failed, falling back to raw text:', pdfErr.message);
      }
    }

    // Fallback: try to extract any readable ASCII text from the buffer
    const raw = buffer.toString('utf-8');
    // Strip non-printable, non-whitespace characters
    const cleaned = raw.replace(/[^\x20-\x7E\x0A\x0D\x09]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length > 50) return cleaned;

    // Last resort: try latin1 decoding (more tolerant than utf-8)
    const latinText = buffer.toString('latin1');
    const latinCleaned = latinText.replace(/[^\x20-\x7E\x0A\x0D\x09]/g, ' ').replace(/\s+/g, ' ').trim();
    if (latinCleaned.length > 50) return latinCleaned;

    return '';
  } catch (err) {
    console.error('[resume] Text extraction error:', err.message);
    return '';
  }
}

// POST /v2/resume/upload
exports.uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { userId, targetRole } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }
    if (!targetRole) {
      return res.status(400).json({ error: 'targetRole is required.' });
    }

    const fileType = (req.file.originalname || '').split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(fileType)) {
      return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF, DOCX, or TXT file.' });
    }

    // Extract text from the file (async now)
    const textContent = await extractTextFromBuffer(req.file.buffer, fileType);
    if (!textContent) {
      return res.status(422).json({ error: 'Could not extract text from the uploaded file. Please try a different format.' });
    }

    // Truncate very long resumes for AI analysis
    const analysisText = textContent.length > 8000 ? textContent.slice(0, 8000) : textContent;

    // Analyze resume using AI
    let analysisResult = {
      atsScore: 0,
      structureScore: 0,
      skills: [],
      matchScore: 0,
      missingSkills: [],
      suggestions: [],
      rawAnalysis: '',
    };

    try {
      const aiPrompt = `You are an expert resume reviewer and ATS (Applicant Tracking System) analyst.

Analyze the following resume text for a **${targetRole}** position.

Resume text:
"""
${analysisText}
"""

Return ONLY valid JSON (no markdown, no extra text):
{
  "atsScore": <number 0-100: how ATS-friendly this resume is — includes keyword optimization, formatting, and relevant content>,
  "structureScore": <number 0-100: how well structured and organized the resume is>,
  "skills": ["skill1", "skill2", ...] (list all technical and soft skills found in the resume),
  "matchScore": <number 0-100: how well the resume matches the target role of ${targetRole}>,
  "missingSkills": ["missing_skill1", "missing_skill2", ...] (important skills for ${targetRole} that are NOT found in the resume),
  "suggestions": ["suggestion1", "suggestion2", "suggestion3", ...] (3-5 specific, actionable suggestions to improve this resume for ${targetRole} applications)
}`;

      const aiResponse = await generateResponse([{ role: 'user', content: aiPrompt }], {
        temperature: 0.3,
        maxTokens: 1500,
      });

      // Parse AI response
      const cleaned = aiResponse.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      analysisResult = {
        atsScore: Math.min(100, Math.max(0, parsed.atsScore || 0)),
        structureScore: Math.min(100, Math.max(0, parsed.structureScore || 0)),
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        matchScore: Math.min(100, Math.max(0, parsed.matchScore || 0)),
        missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        rawAnalysis: cleaned,
      };
    } catch (aiError) {
      console.error('[resume] AI analysis failed:', aiError.message);
      // Continue with default scores — the resume is still saved
    }

    // Save resume to database
    const resume = new Resume({
      userId,
      fileName: req.file.originalname,
      fileType,
      fileSize: req.file.size,
      fileData: req.file.buffer,
      textContent: textContent.slice(0, 50000), // limit stored text
      targetRole,
      atsScore: analysisResult.atsScore,
      structureScore: analysisResult.structureScore,
      skills: analysisResult.skills,
      analysis: {
        matchScore: analysisResult.matchScore,
        missingSkills: analysisResult.missingSkills,
        suggestions: analysisResult.suggestions,
        rawAnalysis: analysisResult.rawAnalysis,
      },
    });

    await resume.save();

    res.status(201).json({
      resumeId: resume._id,
      fileName: resume.fileName,
      atsScore: resume.atsScore,
      structureScore: resume.structureScore,
      matchScore: resume.analysis.matchScore,
    });
  } catch (error) {
    console.error('[resume] Upload error:', error.message);
    next(error);
  }
};

// GET /v2/resume/list/:userId
exports.listResumes = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }

    const resumes = await Resume.find({ userId })
      .select('fileName fileType targetRole atsScore structureScore analysis.matchScore uploadedAt')
      .sort({ uploadedAt: -1 })
      .lean();

    res.json(resumes);
  } catch (error) {
    console.error('[resume] List error:', error.message);
    next(error);
  }
};

// GET /v2/resume/analysis/:resumeId
exports.getAnalysis = async (req, res, next) => {
  try {
    const { resumeId } = req.params;
    if (!resumeId) {
      return res.status(400).json({ error: 'resumeId is required.' });
    }

    const resume = await Resume.findById(resumeId).lean();
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found.' });
    }

    res.json({
      resume: {
        _id: resume._id,
        fileName: resume.fileName,
        fileType: resume.fileType,
        uploadedAt: resume.uploadedAt,
        targetRole: resume.targetRole,
        atsScore: resume.atsScore,
        structureScore: resume.structureScore,
        skills: resume.skills || [],
      },
      score: {
        matchScore: resume.analysis?.matchScore || 0,
        targetRole: resume.targetRole,
        missingSkills: resume.analysis?.missingSkills || [],
        suggestions: resume.analysis?.suggestions || [],
      },
    });
  } catch (error) {
    console.error('[resume] Analysis error:', error.message);
    next(error);
  }
};
