const { generateResponse } = require('../../../services/aiService');

// ── Strip markdown code fences ────────────────────────────────────────────────
function stripFences(text) {
  return text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
}

// ── Generate interview questions via OpenRouter ───────────────────────────────
async function generateInterviewQuestions(role, difficulty, resumeText) {
  const resumePart = resumeText
    ? `\n\nCandidate resume (use it to personalise 2 of the 5 questions):\n${resumeText.slice(0, 2000)}`
    : '';

  const prompt = `You are a senior technical interviewer at a top tech company.
Generate exactly 5 interview questions for a ${difficulty}-level ${role} candidate.${resumePart}

Rules:
- Mix technical, behavioural, and situational questions appropriate for the role and difficulty.
- Each question must have 4-6 expectedKeywords that a strong answer should contain.
- Return ONLY a valid JSON array, no markdown, no explanation.

Format:
[
  { "question": "...", "expectedKeywords": ["kw1", "kw2", "kw3", "kw4"] },
  ...
]`;

  try {
    const raw = await generateResponse([{ role: 'user', content: prompt }], { temperature: 0.7, maxTokens: 1200 });
    const cleaned = stripFences(raw);
    const questions = JSON.parse(cleaned);
    if (Array.isArray(questions) && questions.length >= 3) return questions.slice(0, 5);
    throw new Error('Invalid response shape');
  } catch (err) {
    console.error('[interview/service] generateInterviewQuestions error:', err.message);
    throw new Error('Failed to generate interview questions. Please try again.');
  }
}

// ── Evaluate a candidate answer via OpenRouter ────────────────────────────────
async function evaluateAnswer(questionText, transcription, expectedKeywords) {
  const kwList = (expectedKeywords || []).join(', ');

  const prompt = `You are a strict but fair technical interviewer evaluating a candidate's answer.

Question: ${questionText}
Expected keywords/concepts: ${kwList}
Candidate's answer: ${transcription || '[No answer provided]'}

Score the answer on three dimensions (0-100 each):
- relevance: How directly does the answer address the question?
- completeness: How thoroughly does it cover the key concepts?
- clarity: How clear, structured, and articulate is the response?

Also write 2-3 sentences of specific, actionable feedback.

Return ONLY valid JSON, no markdown:
{ "relevance": number, "completeness": number, "clarity": number, "feedback": "string" }`;

  try {
    const raw = await generateResponse([{ role: 'user', content: prompt }], { temperature: 0.4, maxTokens: 400 });
    const cleaned = stripFences(raw);
    const result = JSON.parse(cleaned);
    if (typeof result.relevance === 'number') return result;
    throw new Error('Invalid shape');
  } catch (err) {
    console.error('[interview/service] evaluateAnswer error:', err.message);
    return { relevance: 50, completeness: 50, clarity: 50, feedback: 'Unable to evaluate answer at this time.' };
  }
}

module.exports = { generateInterviewQuestions, evaluateAnswer };
