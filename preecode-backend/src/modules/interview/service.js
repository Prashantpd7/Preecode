const https = require('https');

// ── Shared AI caller ──────────────────────────────────────────────────────────
async function callAI(prompt) {
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (openaiKey) {
    return callOpenAI(prompt, openaiKey);
  } else if (geminiKey) {
    return callGemini(prompt, geminiKey);
  }
  throw new Error('No AI API key configured');
}

function callOpenAI(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
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
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.choices[0].message.content);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function callGemini(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    });
    const path = `/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.candidates[0].content.parts[0].text);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Strip markdown code fences from AI response ───────────────────────────────
function stripFences(text) {
  return text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
}

// ── Fallback questions per role ───────────────────────────────────────────────
const FALLBACK_QUESTIONS = {
  default: [
    { question: 'Explain the difference between synchronous and asynchronous programming.', expectedKeywords: ['async', 'sync', 'callback', 'promise', 'blocking'] },
    { question: 'What is the difference between a stack and a queue?', expectedKeywords: ['LIFO', 'FIFO', 'push', 'pop', 'enqueue', 'dequeue'] },
    { question: 'Describe a challenging project you worked on and how you overcame obstacles.', expectedKeywords: ['challenge', 'solution', 'team', 'deadline', 'approach'] },
    { question: 'What is Big O notation and why does it matter?', expectedKeywords: ['time complexity', 'space complexity', 'O(n)', 'O(log n)', 'performance'] },
    { question: 'How do you approach debugging a production issue?', expectedKeywords: ['logs', 'reproduce', 'isolate', 'fix', 'monitor'] },
  ],
};

// ── Public API ────────────────────────────────────────────────────────────────
async function generateInterviewQuestions(role, difficulty, resumeText) {
  const resumePart = resumeText
    ? `Resume context (use 2 of the 5 questions based on this): ${resumeText.slice(0, 1500)}`
    : 'No resume provided.';

  const prompt = `You are a senior technical interviewer. Generate exactly 5 interview questions for a ${difficulty}-level ${role} candidate. ${resumePart} Return ONLY a valid JSON array with no markdown: [{ "question": string, "expectedKeywords": string[] }]`;

  try {
    const raw = await callAI(prompt);
    const cleaned = stripFences(raw);
    const questions = JSON.parse(cleaned);
    if (Array.isArray(questions) && questions.length > 0) return questions;
    throw new Error('Empty array');
  } catch (err) {
    console.error('[interview/service] generateInterviewQuestions fallback:', err.message);
    return FALLBACK_QUESTIONS.default;
  }
}

async function evaluateAnswer(questionText, transcription, expectedKeywords) {
  const prompt = `Score this interview answer strictly from 0 to 100 on three dimensions. Question: ${questionText}. Candidate's answer: ${transcription}. Expected keywords to look for: ${(expectedKeywords || []).join(', ')}. Return ONLY valid JSON with no markdown: { "relevance": number, "completeness": number, "clarity": number, "feedback": string }`;

  try {
    const raw = await callAI(prompt);
    const cleaned = stripFences(raw);
    const result = JSON.parse(cleaned);
    if (typeof result.relevance === 'number') return result;
    throw new Error('Invalid shape');
  } catch (err) {
    console.error('[interview/service] evaluateAnswer fallback:', err.message);
    return { relevance: 50, completeness: 50, clarity: 50, feedback: 'Unable to evaluate.' };
  }
}

module.exports = { generateInterviewQuestions, evaluateAnswer };
