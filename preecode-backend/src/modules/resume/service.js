const https = require('https');

// ── Shared AI caller (same pattern as interview/service) ──────────────────────
async function callAI(prompt) {
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (openaiKey) return callOpenAI(prompt, openaiKey);
  if (geminiKey) return callGemini(prompt, geminiKey);
  throw new Error('No AI API key configured');
}

function callOpenAI(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    });
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data).choices[0].message.content); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function callGemini(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data).candidates[0].content.parts[0].text); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function stripFences(text) {
  return text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
}

function extractJson(text) {
  const cleaned = stripFences(text || '');
  if (!cleaned) throw new Error('Empty AI response');
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw err;
    return JSON.parse(match[0]);
  }
}

function toScore(value) {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number'
    ? value
    : Number(String(value).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizeStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeAnalysis(result) {
  if (!result || typeof result !== 'object') throw new Error('Invalid shape');
  const atsScore = toScore(result.atsScore ?? result.ats_score ?? result.ats);
  const structureScore = toScore(result.structureScore ?? result.structure_score ?? result.structure);
  const matchScore = toScore(result.matchScore ?? result.match_score ?? result.roleMatch ?? result.role_match);
  const skills = normalizeStringArray(result.skills);
  const experience = normalizeStringArray(result.experience);
  const keywords = normalizeStringArray(result.keywords);
  const missingSkills = normalizeStringArray(result.missingSkills ?? result.missing_skills);
  const suggestions = normalizeStringArray(result.suggestions ?? result.recommendations);

  const hasAnyScore = atsScore !== null || structureScore !== null || matchScore !== null;
  const hasAnyContent = skills.length || experience.length || keywords.length || missingSkills.length || suggestions.length;
  if (!hasAnyScore && !hasAnyContent) throw new Error('Invalid shape');

  return {
    skills,
    experience,
    keywords,
    atsScore: atsScore ?? 0,
    structureScore: structureScore ?? 0,
    matchScore: matchScore ?? 0,
    missingSkills,
    suggestions,
  };
}

const FALLBACK_ANALYSIS = {
  skills: [],
  experience: [],
  keywords: [],
  atsScore: 0,
  structureScore: 0,
  matchScore: 0,
  missingSkills: [],
  suggestions: ['Unable to analyze. Please re-upload.'],
};

// ── Public API ────────────────────────────────────────────────────────────────
async function analyzeResume(extractedText, targetRole) {
  const prompt = `Analyze this resume for a ${targetRole} position. Resume text: ${extractedText.slice(0, 3000)}. Return ONLY valid JSON with no markdown: { "skills": string[], "experience": string[], "keywords": string[], "atsScore": number, "structureScore": number, "matchScore": number, "missingSkills": string[], "suggestions": string[] }. All scores are 0-100.`;

  try {
    const raw = await callAI(prompt);
    const result = extractJson(raw);
    return normalizeAnalysis(result);
  } catch (err) {
    console.error('[resume/service] analyzeResume fallback:', err.message);
    return { ...FALLBACK_ANALYSIS };
  }
}

async function generateImprovementPlan(codingScore, interviewScore, resumeScore) {
  const prompt = `A student has these placement readiness scores — Coding: ${codingScore}/100, Interview: ${interviewScore}/100, Resume: ${resumeScore}/100. Write exactly 3 short, specific, actionable improvement tips. Return ONLY a valid JSON array of 3 strings.`;

  try {
    const raw = await callAI(prompt);
    const cleaned = stripFences(raw);
    const result = JSON.parse(cleaned);
    if (Array.isArray(result) && result.length >= 3) return result.slice(0, 3);
    throw new Error('Invalid shape');
  } catch (err) {
    console.error('[resume/service] generateImprovementPlan fallback:', err.message);
    return [
      'Solve at least 2 coding problems daily to improve your problem-solving speed.',
      'Practice mock interviews focusing on clear communication and structured answers.',
      'Update your resume with quantified achievements and relevant keywords for your target role.',
    ];
  }
}

module.exports = { analyzeResume, generateImprovementPlan };
