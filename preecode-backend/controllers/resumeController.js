const Resume = require('../models/Resume');
const { generateResponse } = require('../services/aiService');

// Try to load pdf-parse — it may fail in some environments (e.g. missing native deps)
let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (_) {
  console.warn('[resume] pdf-parse module not available — PDF text extraction will be limited.');
}

// Try to load mammoth for DOCX text extraction
let mammoth = null;
try {
  mammoth = require('mammoth');
} catch (_) {
  mammoth = null;
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

    if (fileType === 'pdf') {
      // Try pdf-parse first (if available)
      if (pdfParse && pdfParse.PDFParse) {
        try {
          const instance = new pdfParse.PDFParse({ data: buffer, verbosity: 0 });
          await instance.load();
          let text = await instance.getText();
          // pdf-parse v2 may return text as string or object with text property
          if (text && typeof text === 'object' && text.text) text = text.text;
          const cleaned = (String(text || '')).trim();
          if (cleaned.length > 20) return cleaned;
        } catch (pdfErr) {
          console.warn('[resume] pdf-parse failed, falling back to raw text:', pdfErr.message);
        }
      }

      // Fallback: extract text from PDF buffer.
      // PDFs contain text between parentheses, BT/ET markers, etc.
      // We use a smarter extraction than just utf-8 decode.
      try {
        let rawPdf = buffer.toString('latin1');
        // Remove non-printable control chars except newlines/tabs
        rawPdf = rawPdf.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        // Try to find text between parentheses inside BT...ET blocks (PDF text objects)
        const textBlocks = [];
        const btEtRegex = /BT[\s\S]*?ET/g;
        let btMatch;
        while ((btMatch = btEtRegex.exec(rawPdf)) !== null) {
          const block = btMatch[0];
          // Extract strings in parentheses within text blocks
          const parenRegex = /\(([^)]*)\)/g;
          let pMatch;
          while ((pMatch = parenRegex.exec(block)) !== null) {
            const str = pMatch[1]
              .replace(/\\([0-9]{3})/g, (_, d) => String.fromCharCode(parseInt(d, 8))) // octal escapes
              .replace(/\\([nrtf])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', f: '\f' }[c] || c))
              .replace(/\\(.)/g, '$1') // remove other backslash escapes
              .replace(/\s+/g, ' ');
            if (str.length > 2) textBlocks.push(str);
          }
        }
        if (textBlocks.length > 3) {
          const result = textBlocks.join(' ').trim();
          if (result.length > 50) return result;
        }

        // Another fallback: extract any words (sequences of printable chars) from latin1
        const words = rawPdf.match(/[A-Za-z][A-Za-z0-9._\-]{2,}/g);
        if (words && words.length > 10) {
          return words.join(' ');
        }
      } catch (fallbackErr) {
        console.warn('[resume] PDF fallback extraction failed:', fallbackErr.message);
      }
    }

    if (fileType === 'docx') {
      // Use mammoth for DOCX extraction if available
      if (mammoth) {
        try {
          const result = await mammoth.extractRawText({ buffer });
          const cleaned = (result.value || '').trim();
          if (cleaned.length > 20) return cleaned;
        } catch (docxErr) {
          console.warn('[resume] mammoth failed for DOCX:', docxErr.message);
        }
      }

      // Simple JS-based DOCX text extraction fallback.
      // DOCX is a ZIP archive; we try to read word/document.xml directly.
      try {
        const { execSync } = require('child_process');
        // Try using a quick JS-based approach: use 'strings' command or xml parsing
        const strOutput = execSync(`cd /tmp && python3 -c "
import zipfile, sys, re
from io import BytesIO
buf = sys.stdin.buffer.read()
try:
    z = zipfile.ZipFile(BytesIO(buf))
    xml = z.read('word/document.xml')
    texts = re.findall(r'<w:t[^>]*>([^<]+)</w:t>', xml.decode('utf-8', errors='replace'))
    if texts:
        print(' '.join(texts))
except:
    pass
" 2>/dev/null`, {
          input: buffer,
          encoding: 'utf-8',
          timeout: 5000,
          maxBuffer: 10 * 1024 * 1024
        });
        const docxText = strOutput.trim();
        if (docxText.length > 50) return docxText;
      } catch (_cmdErr) {
        // python3 not available or zipfile failed
      }
    }

    // Generic fallback: try to extract any readable ASCII text from any file type
    const raw = buffer.toString('utf-8');
    // Remove null bytes and other non-printable chars (keep newlines, tabs)
    const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
                       .replace(/[\x80-\xFF]/g, '')
                       .replace(/\s+/g, ' ')
                       .trim();
    if (cleaned.length > 50) return cleaned;

    // Last resort: try latin1 decoding and extract word-like sequences
    const latinText = buffer.toString('latin1');
    const words = latinText.match(/[A-Za-z][A-Za-z0-9._@#\-]{2,}/g);
    if (words && words.length > 10) {
      return words.join(' ');
    }

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

    // Log the extracted text for validation
    console.log('[resume] === VALIDATION: Raw resume text (first 500 chars) ===');
    console.log(analysisText.slice(0, 500));
    console.log('[resume] === END VALIDATION ===');

    // Analyze resume using AI
    let analysisResult = {
      atsScore: 0,
      structureScore: 0,
      skills: [],
      matchScore: 0,
      missingSkills: [],
      missingKeywords: [],
      strengths: [],
      weaknesses: [],
      suggestions: [],
      rawAnalysis: '',
    };

    try {
      const roleKeywordMap = {
        'Frontend Developer': 'React, JavaScript, TypeScript, HTML, CSS, Angular, Vue, Next.js, Responsive Design, REST APIs, Frontend Testing, UI/UX, Webpack, Git',
        'Backend Developer': 'Node.js, Python, Java, Go, SQL, PostgreSQL, MongoDB, REST APIs, GraphQL, Docker, Kubernetes, AWS, Microservices, Redis, CI/CD',
        'Full Stack Developer': 'JavaScript, TypeScript, React, Node.js, Python, SQL, MongoDB, REST APIs, Docker, Git, AWS, CI/CD, HTML, CSS',
        'SDE': 'Data Structures, Algorithms, System Design, OOP, SQL, Distributed Systems, Design Patterns, Operating Systems, Networking, Git',
        'AI/ML Engineer': 'Python, TensorFlow, PyTorch, Machine Learning, Deep Learning, NLP, Computer Vision, Data Processing, Pandas, NumPy, SQL, Scikit-learn'
      };
      const roleKeywords = roleKeywordMap[targetRole] || 'problem-solving, programming, teamwork, communication, technical skills';

      const aiPrompt = `You are an expert resume reviewer and ATS (Applicant Tracking System) analyst. Your analysis must be based ONLY on the resume text provided below. Do NOT invent or infer any information not present in the text.

## RESUME TEXT (${targetRole} position):
"""
${analysisText}
"""

## EXTRACTION RULES (CRITICAL):
1. ONLY list skills, technologies, and keywords that appear EXACTLY in the resume text above.
2. Do NOT infer skills. If "Python" appears but "Machine Learning" does not, do NOT add "Machine Learning".
3. If a section (Education, Experience, Projects) is missing, mark it as absent.
4. Be honest about what is and is not in the resume.

## ATS SCORING RUBRIC:
Calculate atsScore (0-100) based ONLY on what is present in the resume:
- Contact info (email, phone, location present): 0-10 pts
- Education section present with details: 0-15 pts
- Experience/Work section present with details: 0-20 pts
- Projects section present: 0-10 pts
- Skills section present with relevant keywords: 0-10 pts
- Clear section headings and ATS-friendly formatting: 0-5 pts
- Keywords matching the target role (${targetRole}): 0-10 pts
- Quantified achievements (numbers, percentages, $$): 0-10 pts
- Action verbs (led, created, developed, implemented, built, designed): 0-5 pts
- Appropriate resume length (roughly 1-2 pages worth of content): 0-5 pts
- Deductions for repetition, vague language, missing dates: -10 to 0 pts

## STRUCTURE SCORING:
Calculate structureScore (0-100):
- Clear section headers: 0-20 pts
- Consistent formatting (bullets, spacing): 0-20 pts
- Logical flow/order of sections: 0-20 pts
- Readable layout and white space: 0-20 pts
- Bullet points vs paragraphs: 0-20 pts

## ROLE MATCH SCORING:
Calculate matchScore (0-100) by comparing resume skills/experience against these typical keywords for ${targetRole}:
${roleKeywords}

Only give points for skills that the resume ACTUALLY contains. If the resume has 3 out of 10 expected skills, matchScore should be around 30, not 85.

## MISSING KEYWORDS:
List important skills, tools, or technologies for a ${targetRole} that are NOT found in the resume text at all.

## STRENGTHS:
List 2-4 genuine strengths of this resume based ONLY on what is present (e.g., "Clear and detailed experience section", "Strong technical skill set in Python and SQL").

## WEAKNESSES:
List 2-4 honest weaknesses or gaps in this resume based on what is missing (e.g., "No projects section", "Missing quantified achievements", "No education section").

## SUGGESTIONS:
Provide 3-5 specific, actionable suggestions. Each suggestion must:
1. Reference a specific issue found in the resume (or missing from it)
2. Explain why it matters for ${targetRole}
3. Give an exact fix or example of what to add

Example of a good suggestion: "Your resume lacks a Projects section. Recruiters for ${targetRole} expect to see project experience. Add 2-3 projects with technologies used and your specific contributions."

Return ONLY valid JSON (no markdown, no extra text):
{
  "extractedSections": {
    "hasContact": true or false,
    "hasEducation": true or false,
    "hasExperience": true or false,
    "hasProjects": true or false,
    "hasSkills": true or false,
    "hasQuantifiedAchievements": true or false,
    "hasActionVerbs": true or false
  },
  "atsScore": <number 0-100, calculated using the rubric above>,
  "structureScore": <number 0-100, calculated using the rubric above>,
  "matchScore": <number 0-100, based on actual keyword overlap with ${targetRole}>,
  "skills": ["ONLY skills that appear in the resume text"],
  "missingKeywords": ["important skills for ${targetRole} not found in resume"],
  "strengths": ["strength based on resume content"],
  "weaknesses": ["weakness based on missing content"],
  "suggestions": ["specific, actionable suggestion with issue + why + fix"]
}`;

      const aiResponse = await generateResponse([{ role: 'user', content: aiPrompt }], {
        temperature: 0.2,
        maxTokens: 2000,
      });

      // Parse AI response
      const cleaned = aiResponse.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      analysisResult = {
        atsScore: Math.min(100, Math.max(0, parsed.atsScore || 0)),
        structureScore: Math.min(100, Math.max(0, parsed.structureScore || 0)),
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        matchScore: Math.min(100, Math.max(0, parsed.matchScore || 0)),
        missingSkills: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
        missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        rawAnalysis: cleaned,
      };

      console.log('[resume] === VALIDATION: Skills extracted by AI ===');
      console.log(JSON.stringify(analysisResult.skills, null, 2));
      console.log('[resume] === VALIDATION: Strengths ===');
      console.log(JSON.stringify(analysisResult.strengths, null, 2));
      console.log('[resume] === VALIDATION: Weaknesses ===');
      console.log(JSON.stringify(analysisResult.weaknesses, null, 2));
      console.log('[resume] === VALIDATION: ATS Score =', analysisResult.atsScore, ', Structure =', analysisResult.structureScore, ', Match =', analysisResult.matchScore);
      console.log('[resume] === END VALIDATION ===');
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
        missingKeywords: analysisResult.missingKeywords,
        strengths: analysisResult.strengths,
        weaknesses: analysisResult.weaknesses,
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
        strengths: resume.analysis?.strengths || [],
        weaknesses: resume.analysis?.weaknesses || [],
      },
      score: {
        matchScore: resume.analysis?.matchScore || 0,
        targetRole: resume.targetRole,
        missingSkills: resume.analysis?.missingSkills || [],
        missingKeywords: resume.analysis?.missingKeywords || [],
        suggestions: resume.analysis?.suggestions || [],
      },
    });
  } catch (error) {
    console.error('[resume] Analysis error:', error.message);
    next(error);
  }
};
