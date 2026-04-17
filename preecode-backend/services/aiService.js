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
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2048,
    };

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
      throw new Error('No response from OpenRouter API');
    }

    const content = data.choices[0].message?.content;
    if (!content) {
      throw new Error('Empty response from OpenRouter API');
    }

    return content;
  } catch (error) {
    console.error('OpenRouter API Error:', error);
    throw new Error(`AI service error: ${error.message}`);
  }
}

async function chat(message, context, history = []) {
  const safeHistory = Array.isArray(history)
    ? history
        .filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant') && typeof entry.text === 'string')
        .slice(-12)
        .map((entry) => ({ role: entry.role, content: entry.text.trim().slice(0, 2000) }))
    : [];

  const systemPrompt = [
    'You are Preecode AI, a helpful coding assistant.',
    'Answer the user question directly and specifically.',
    'If the user asks for output, compute it step by step from the provided code/context.',
    'Use concise, practical language.',
    'If context is missing, ask one short clarifying question instead of guessing.'
  ].join(' ');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(context ? [{ role: 'system', content: `Editor context:\n${context}` }] : []),
    ...safeHistory,
    { role: 'user', content: message }
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

async function generateQuestion(language, difficulty) {
  const safeLanguage = String(language || 'python').trim().toLowerCase() || 'python';
  const safeDifficulty = String(difficulty || 'medium').trim().toLowerCase();

  let languageInstruction = '';
  if (safeLanguage === 'javascript') {
    languageInstruction = 'Use pure JavaScript only. No TypeScript annotations. Use console.log for output.';
  } else if (safeLanguage === 'typescript') {
    languageInstruction = 'Use TypeScript with proper types. Use console.log for output.';
  } else if (safeLanguage === 'python') {
    languageInstruction = 'Use Python 3 only. Use print() for output.';
  } else if (safeLanguage === 'java') {
    languageInstruction = 'Use Java. Include a public class Solution with a main method. Use System.out.println for output.';
  } else if (safeLanguage === 'cpp') {
    languageInstruction = 'Use C++17. Include necessary headers. Use cout for output.';
  } else if (safeLanguage === 'c') {
    languageInstruction = 'Use C. Include necessary headers. Use printf for output.';
  } else if (safeLanguage === 'go') {
    languageInstruction = 'Use Go. Include package main and import fmt. Use fmt.Println for output.';
  } else if (safeLanguage === 'rust') {
    languageInstruction = 'Use Rust. Include a main function. Use println! for output.';
  }

  const difficultyContext = {
    easy: 'beginner-friendly, solvable in under 15 minutes, focuses on basic loops, arrays, or string manipulation',
    medium: 'intermediate level, solvable in 20-35 minutes, involves data structures like hashmaps or recursion',
    hard: 'advanced level, solvable in 40-60 minutes, involves dynamic programming, graphs, or complex algorithms',
  }[safeDifficulty] || 'intermediate level';

  const prompt = `You are an expert coding interview coach creating a ${safeDifficulty} practice problem.
${languageInstruction}
Difficulty context: ${difficultyContext}.

Generate a single, well-defined coding challenge. The problem must be self-contained and runnable.

Return EXACTLY in this format with no extra text:

[QUESTION]
Write a clear 2-4 sentence problem description. State the function name, what it takes as input, and what it should return or print. Include 1-2 concrete examples inline (e.g. "For input [1,2,3], the output should be 6").

[HINT]
One sentence hint that nudges toward the approach without giving away the solution.

[SOLUTION]
Complete, runnable ${safeLanguage} code that solves the problem. Must include the function definition AND a demonstration call that prints the result. No markdown fences.`;

  const messages = [{ role: 'user', content: prompt }];
  const raw = await generateResponse(messages, { temperature: 0.75, maxTokens: 800 });

  return raw
    .replace(/```[\w]*\n?/g, '')
    .replace(/```/g, '')
    .trim();
}

module.exports = { generateResponse, chat, getHint, reviewCode, generateQuestion };
