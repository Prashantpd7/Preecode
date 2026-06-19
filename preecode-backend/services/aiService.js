/**
 * Preecode AI Service — routes all AI requests through the central AI Gateway.
 *
 * This file now delegates to aiGatewayService.js for all OpenRouter interactions.
 * It remains as the public API for controllers, preserving backward-compatible exports.
 *
 * No models, API keys, or OpenRouter URLs are defined here.
 * See aiGatewayService.js for the single source of truth.
 */

const aiGateway = require('./aiGatewayService');

// ─── Backward-compatible re-exports ──────────────────────────────────────────

function buildStructuredError(base) {
  const err = new Error(base.message);
  err.name = 'OpenRouterError';
  err.statusCode = base.statusCode || 502;
  err.code = base.code || 'OPENROUTER_REQUEST_FAILED';
  err.details = {
    model: base.model,
    attempt: base.attempt,
    providerStatus: base.providerStatus,
    retryable: Boolean(base.retryable),
    responseBody: base.responseBody,
    cause: base.cause,
  };
  return err;
}

/**
 * Backward-compatible wrapper: delegates directly to aiGateway.callAI()
 */
async function call_openrouter(messages, options = {}) {
  const result = await aiGateway.callAI(messages, { ...options, feature: 'call_openrouter' });
  return result;
}

/**
 * Backward-compatible wrapper: calls the gateway and returns just the content string.
 */
async function generateResponse(messages, options = {}) {
  try {
    const result = await aiGateway.callAI(messages, { ...options, feature: 'generate_response' });
    return result.content;
  } catch (error) {
    if (error && error.name === 'OpenRouterError') {
      throw error;
    }
    const wrapped = buildStructuredError({
      message: `AI service error: ${error?.message || 'Unknown error'}`,
      statusCode: error?.statusCode || 502,
      code: error?.code || 'OPENROUTER_UNEXPECTED_ERROR',
      responseBody: error?.message,
      cause: error,
      retryable: false,
    });
    throw wrapped;
  }
}

async function generateResponse(messages, options = {}) {
  try {
    const result = await call_openrouter(messages, options);
    return result.content;
  } catch (error) {
    if (error && error.name === 'OpenRouterError') {
      throw error;
    }

    const wrapped = buildStructuredError({
      message: `AI service error: ${error?.message || 'Unknown error'}`,
      statusCode: error?.statusCode || 502,
      code: error?.code || 'OPENROUTER_UNEXPECTED_ERROR',
      responseBody: error?.message,
      cause: error,
      retryable: false,
    });
    throw wrapped;
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

async function generateQuestion(language, difficulty, topic) {
  const safeLanguage = String(language || 'python').trim().toLowerCase() || 'python';
  const safeDifficulty = String(difficulty || 'medium').trim().toLowerCase();
  const safeTopic = String(topic || '').trim().toLowerCase();
  const safeCompany = 'Preecode';

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

async function reviewProject(files, projectInfo = {}, analysisLevel = 'quick') {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('Files array is required and must not be empty.');
  }

  const fileCount = Math.min(files.length, analysisLevel === 'deep' ? files.length : 2);
  const selectedFiles = files.slice(0, fileCount);

  const fileDetails = selectedFiles
    .map(f => `## File: ${f.path}\nLanguage: ${f.language}\n\`\`\`${f.language}\n${f.content}\n\`\`\``)
    .join('\n\n');

  const projectContext = [
    projectInfo.name ? `Project: ${projectInfo.name}` : '',
    projectInfo.frameworks?.length ? `Frameworks: ${projectInfo.frameworks.join(', ')}` : '',
    projectInfo.languages?.length ? `Languages: ${projectInfo.languages.join(', ')}` : '',
    projectInfo.totalFiles ? `Total Files: ${projectInfo.totalFiles}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `You are a comprehensive code reviewer. Analyze this project code and provide a detailed review.

${projectContext}

${fileDetails}

Provide a structured JSON response (no markdown):
{
  "projectSummary": {
    "overallScore": <number 1-100>,
    "riskLevel": "low" | "medium" | "high",
    "mainFindings": ["finding 1", "finding 2", "finding 3"]
  },
  "findings": [
    {
      "category": "bugs" | "security" | "performance" | "architecture" | "quality" | "maintainability",
      "severity": "critical" | "high" | "medium" | "low",
      "title": "issue title",
      "description": "detailed description",
      "affectedFiles": ["file1.js"],
      "suggestedFix": "how to fix",
      "improvedCode": "optional: fixed code snippet"
    }
  ],
  "bestPractices": {
    "observed": ["practice 1", "practice 2"],
    "recommendations": ["recommendation 1", "recommendation 2"],
    "frameworkSpecific": ["framework advice"]
  },
  "performanceInsights": {
    "potentialBottlenecks": ["bottleneck 1"],
    "optimization": "general optimization advice"
  }
}`;

  try {
    const raw = await generateResponse([{ role: 'user', content: prompt }], { temperature: 0.3, maxTokens: 2000 });
    const cleaned = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleaned);

    return {
      projectSummary: result.projectSummary || {},
      findings: result.findings || [],
      bestPractices: result.bestPractices || {},
      performanceInsights: result.performanceInsights || {},
      filesAnalyzed: selectedFiles.length,
      totalFiles: projectInfo.totalFiles || files.length,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[ai/project-review] error:', err.message);
    throw new Error(`Failed to analyze project: ${err.message}`);
  }
}

module.exports = { call_openrouter, generateResponse, chat, getHint, reviewCode, generateQuestion, verifyCodeOutput, reviewProject };
