const OpenAI = require('openai');

const openaiApiKey = String(process.env.OPENAI_API_KEY || '').trim();
const openai = openaiApiKey
  ? new OpenAI({ apiKey: openaiApiKey })
  : null;

if (!openai) {
  console.warn('[ai] OPENAI_API_KEY is missing. AI endpoints will return configuration errors until the key is set.');
}

async function generateResponse(prompt, options = {}) {
  if (!openai) {
    const err = new Error('AI is not configured. Set OPENAI_API_KEY in backend environment variables.');
    err.statusCode = 503;
    throw err;
  }

  try {
    const message = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2048,
    });
    return message.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error(`AI service error: ${error.message}`);
  }
}

async function chat(message, context) {
  const prompt = `You are Preecode AI, a helpful coding assistant.
You help users with programming questions, debugging, and learning concepts.
Be concise and practical. Use code examples when helpful.
${context ? 'Context: ' + context : ''}

User: ${message}`;
  return generateResponse(prompt, { temperature: 0.7 });
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
  return generateResponse(prompt, { temperature: 0.6 });
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
  return generateResponse(prompt, { temperature: 0.4 });
}

module.exports = { generateResponse, chat, getHint, reviewCode };
