const openrouterApiKey = String(process.env.OPENROUTER_API_KEY || '').trim();

if (!openrouterApiKey) {
  console.warn('[ai] OPENROUTER_API_KEY is missing. AI endpoints will return configuration errors until the key is set.');
}

async function generateResponse(messages, options = {}) {
  if (!openrouterApiKey) {
    const err = new Error('AI is not configured. Set OPENROUTER_API_KEY in backend environment variables.');
    err.statusCode = 503;
    throw err;
  }

  try {
    console.log('Using OpenRouter API');

    const requestBody = {
      model: 'openai/gpt-oss-120b:free',
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2048,
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0]) throw new Error('No response from OpenRouter API');
    const content = data.choices[0].message?.content;
    if (!content) throw new Error('Empty response from OpenRouter API');
    return content;
  } catch (error) {
    console.error('OpenRouter API Error:', error);
    throw new Error(`AI service error: ${error.message}`);
  }
}

async function chat(message, context, history = []) {
  const safeHistory = Array.isArray(history)
    ? history
        .filter((e) => e && (e.role === 'user' || e.role === 'assistant') && typeof e.text === 'string')
        .slice(-12)
        .map((e) => ({ role: e.role, content: e.text.trim().slice(0, 2000) }))
    : [];

  const systemPrompt = [
    'You are Preecode AI, a helpful coding assistant.',
    'Answer the user question directly and specifically.',
    'If the user asks for output, compute it step by step from the provided code/context.',
    'Use concise, practical language.',
    'If context is missing, ask one short clarifying question instead of guessing.',
  ].join(' ');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(context ? [{ role: 'system', content: `Editor context:\n${context}` }] : []),
    ...safeHistory,
    { role: 'user', content: message },
  ];

  return generateResponse(messages, { temperature: 0.5 });
}

async function getHint(problemDescription, language) {
  const prompt = `Given this programming problem, provide a helpful hint that guides the student toward the solution without giving away the answer.

Problem: ${problemDescription}
Language: ${language || 'any'}

Provide:
1. A conceptual hint about the approach
2. The key data structure or algorithm to consider
3. A small nudge about the first step

Do NOT provide the full solution.`;
  return generateResponse([{ role: 'user', content: prompt }], { temperature: 0.6 });
}

async function reviewCode(code, language, problemDescription) {
  const prompt = `You are a code reviewer. Analyze this ${language || 'code'} and provide a concise review.

${problemDescription ? 'Problem: ' + problemDescription : ''}

Code:
${code}

Respond in this format:

Correctness:
<2 sentences max>

Edge Cases:
<2 sentences max>

Time Complexity:
<1-2 sentences>

Code Quality:
<2 sentences max>

Suggestions:
<2-3 bullet points for improvement, or "No improvements needed">

Final Verdict:
<Correct / Partially Correct / Needs Improvement>`;
  return generateResponse([{ role: 'user', content: prompt }], { temperature: 0.4 });
}

// Company list for random assignment
const COMPANIES = ['Amazon', 'Google', 'Microsoft', 'Meta', 'Apple', 'Netflix', 'Uber', 'Airbnb', 'LinkedIn', 'Adobe'];

async function generateQuestion(language, difficulty, company) {
  const safeLanguage = String(language || 'python').trim().toLowerCase() || 'python';
  const safeDifficulty = String(difficulty || 'medium').trim().toLowerCase();
  const safeCompany = company || COMPANIES[Math.floor(Math.random() * COMPANIES.length)];

  const langInstructions = {
    javascript: 'Use pure JavaScript only. No TypeScript. Use console.log for output.',
    typescript: 'Use TypeScript with proper types. Use console.log for output.',
    python: 'Use Python 3. Use print() for output.',
    java: 'Use Java. Include public class Solution with main method. Use System.out.println.',
    cpp: 'Use C++17. Include needed headers. Use cout for output.',
    c: 'Use C. Include needed headers. Use printf for output.',
    go: 'Use Go. Include package main and import fmt. Use fmt.Println.',
    rust: 'Use Rust. Include main function. Use println!.',
  };

  const difficultyContext = {
    easy: 'basic loops, arrays, or string manipulation — solvable in under 15 min',
    medium: 'hashmaps, recursion, or sorting — solvable in 20-30 min',
    hard: 'dynamic programming, graphs, or trees — solvable in 40-60 min',
  }[safeDifficulty] || 'intermediate level';

  const prompt = `You are a coding interview coach at ${safeCompany}.
Generate ONE short ${safeDifficulty} coding problem in ${safeLanguage} style (${difficultyContext}).
${langInstructions[safeLanguage] || ''}

Return ONLY valid JSON, no markdown, no extra text:
{
  "company": "${safeCompany}",
  "title": "Short problem title (3-6 words)",
  "question": "2-3 sentences max. State the function name, inputs, output, and one inline example.",
  "hint": "One sentence nudging toward the approach without giving it away.",
  "solution": "Complete runnable ${safeLanguage} code with function + one demo print call. No markdown fences."
}`;

  const raw = await generateResponse([{ role: 'user', content: prompt }], { temperature: 0.75, maxTokens: 600 });
  const cleaned = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.question || !parsed.solution) throw new Error('Invalid shape');
    return parsed;
  } catch {
    // Fallback: return raw as question text
    return { company: safeCompany, title: 'Coding Challenge', question: cleaned, hint: '', solution: '' };
  }
}

async function verifyCodeOutput(question, code, output, language) {
  const prompt = `You are a coding problem verifier. Check if the code output is correct for the given problem.

Problem: ${question}
User's ${language} code: ${code}
Code output: ${output}

Return ONLY valid JSON (no markdown):
{
  "correct": true or false,
  "feedback": "1-2 sentence explanation of why correct or what is wrong",
  "mistakes": ["specific mistake 1", "specific mistake 2"]
}`;

  try {
    const raw = await generateResponse([{ role: 'user', content: prompt }], { temperature: 0.2, maxTokens: 400 });
    const cleaned = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleaned);
    if (typeof result.correct !== 'boolean') throw new Error('Invalid shape');
    return result;
  } catch (err) {
    console.error('[ai/verify] error:', err.message);
    return { correct: false, feedback: 'Could not verify output. Please check manually.', mistakes: [] };
  }
}

module.exports = { generateResponse, chat, getHint, reviewCode, generateQuestion, verifyCodeOutput };
