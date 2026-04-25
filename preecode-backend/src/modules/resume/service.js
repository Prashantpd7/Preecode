const { generateResponse } = require('../../../services/aiService');

// ── Strip markdown code fences ────────────────────────────────────────────────
function stripFences(text) {
  return text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
}

// ── Deep resume analysis via OpenRouter ──────────────────────────────────────
async function analyzeResume(extractedText, targetRole) {
  if (!extractedText || extractedText.trim().length < 50) {
    throw new Error('Resume text is too short to analyze. Please upload a valid resume with more content.');
  }

  const prompt = `You are an expert ATS system and senior technical recruiter.
Analyze the following resume for a ${targetRole} position and provide a thorough, honest assessment.

Resume:
${extractedText.slice(0, 4000)}

Evaluate and return ONLY valid JSON (no markdown, no explanation):
{
  "skills": ["list of technical and soft skills found in the resume"],
  "experience": ["list of roles/positions/companies mentioned"],
  "keywords": ["important keywords present that are relevant to ${targetRole}"],
  "atsScore": <0-100, how well the resume passes ATS filters for ${targetRole}>,
  "structureScore": <0-100, quality of resume structure, formatting, and readability>,
  "matchScore": <0-100, how well the candidate matches a ${targetRole} role>,
  "missingSkills": ["important skills for ${targetRole} that are absent from the resume"],
  "suggestions": [
    "specific actionable suggestion 1",
    "specific actionable suggestion 2",
    "specific actionable suggestion 3",
    "specific actionable suggestion 4",
    "specific actionable suggestion 5"
  ]
}

Be strict and realistic with scores. A score of 90+ means the resume is exceptional.`;

  try {
    console.log('[resume/service] Calling AI service for analysis...');
    const raw = await generateResponse([{ role: 'user', content: prompt }], { temperature: 0.3, maxTokens: 1500 });
    
    if (!raw || typeof raw !== 'string') {
      throw new Error('AI service returned invalid response');
    }

    console.log('[resume/service] AI response received, parsing JSON...');
    const cleaned = stripFences(raw);
    
    let result;
    try {
      result = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[resume/service] JSON parse error:', parseErr.message);
      console.error('[resume/service] Raw response:', raw.substring(0, 500));
      throw new Error('AI returned invalid JSON format. Please try again.');
    }

    // Validate response structure
    if (typeof result.atsScore !== 'number' || 
        typeof result.structureScore !== 'number' || 
        typeof result.matchScore !== 'number') {
      console.error('[resume/service] Invalid response structure:', result);
      throw new Error('AI response missing required scores');
    }

    if (!Array.isArray(result.skills)) result.skills = [];
    if (!Array.isArray(result.experience)) result.experience = [];
    if (!Array.isArray(result.keywords)) result.keywords = [];
    if (!Array.isArray(result.missingSkills)) result.missingSkills = [];
    if (!Array.isArray(result.suggestions)) result.suggestions = [];

    console.log('[resume/service] Analysis successful');
    return result;
  } catch (err) {
    console.error('[resume/service] analyzeResume error:', err.message);
    if (err.message.includes('AI')) {
      throw err; // Re-throw AI-specific errors
    }
    throw new Error('Resume analysis failed. Please try again or contact support if the issue persists.');
  }
}

// ── Generate improvement plan via OpenRouter ──────────────────────────────────
async function generateImprovementPlan(codingScore, interviewScore, resumeScore) {
  const prompt = `A developer has these placement readiness scores:
- Coding: ${codingScore}/100
- Interview: ${interviewScore}/100  
- Resume: ${resumeScore}/100

Based on their weakest areas, write exactly 3 short, specific, actionable improvement tips.
Each tip should be 1-2 sentences and directly address the lowest scores.

Return ONLY a valid JSON array of 3 strings, no markdown.`;

  try {
    const raw = await generateResponse([{ role: 'user', content: prompt }], { temperature: 0.6, maxTokens: 400 });
    const cleaned = stripFences(raw);
    const result = JSON.parse(cleaned);
    if (Array.isArray(result) && result.length >= 3) return result.slice(0, 3);
    throw new Error('Invalid shape');
  } catch (err) {
    console.error('[resume/service] generateImprovementPlan error:', err.message);
    return [
      'Solve at least 2 coding problems daily focusing on your weakest topics.',
      'Practice mock interviews out loud — record yourself and review your answers.',
      'Tailor your resume with quantified achievements and role-specific keywords.',
    ];
  }
}

module.exports = { analyzeResume, generateImprovementPlan };
