const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function generateResponse(prompt, options = {}) {
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature || 0.7,
      maxOutputTokens: options.maxTokens || 2048,
    },
  });
  return result.response.text();
}

async function chat(message, context) {
  const prompt = `You are preecode AI, a helpful coding assistant.
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
