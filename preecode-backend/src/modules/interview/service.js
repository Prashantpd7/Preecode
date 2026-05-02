const { generateResponse } = require('../../../services/aiService');

// ── Strip markdown code fences ────────────────────────────────────────────────
function stripFences(text) {
  return text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
}

// ── Generate interview questions via OpenRouter ───────────────────────────────
async function generateInterviewQuestions(role, difficulty, resumeText) {
  console.log('[interview/service] generateInterviewQuestions called:', { role, difficulty, hasResume: !!resumeText });

  const resumePart = resumeText
    ? `\n\nCandidate resume (use it to personalise 2 of the 5 questions):\n${resumeText.slice(0, 2000)}`
    : '';

  const prompt = `You are a senior technical interviewer at a top tech company.
Generate exactly 5 interview questions for a ${difficulty}-level ${role} candidate.${resumePart}

Rules:
- Mix technical, behavioural, and situational questions appropriate for the role and difficulty.
- Each question must have 4-6 expectedKeywords that a strong answer should contain.
- Return ONLY a valid JSON array, no markdown, no explanation, no extra text.
- Start directly with [ and end with ]

Format:
[
  { "question": "...", "expectedKeywords": ["kw1", "kw2", "kw3", "kw4"] },
  { "question": "...", "expectedKeywords": ["kw1", "kw2", "kw3", "kw4"] },
  { "question": "...", "expectedKeywords": ["kw1", "kw2", "kw3", "kw4"] },
  { "question": "...", "expectedKeywords": ["kw1", "kw2", "kw3", "kw4"] },
  { "question": "...", "expectedKeywords": ["kw1", "kw2", "kw3", "kw4"] }
]`;

  try {
    console.log('[interview/service] Calling AI service...');
    const raw = await generateResponse([{ role: 'user', content: prompt }], { temperature: 0.7, maxTokens: 1500 });
    
    if (!raw || typeof raw !== 'string') {
      console.error('[interview/service] Invalid AI response type:', typeof raw);
      throw new Error('AI service returned invalid response');
    }

    console.log('[interview/service] AI response received, length:', raw.length);
    let cleaned = stripFences(raw).trim();
    
    // Extract JSON array if there's extra text
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    
    console.log('[interview/service] Cleaned response, length:', cleaned.length);

    let questions;
    try {
      questions = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[interview/service] JSON parse error:', parseErr.message);
      console.error('[interview/service] Cleaned response:', cleaned.slice(0, 500));
      throw new Error('Failed to parse AI response as JSON');
    }

    if (!Array.isArray(questions)) {
      console.error('[interview/service] Response is not an array:', typeof questions);
      throw new Error('AI response is not an array');
    }

    if (questions.length < 3) {
      console.error('[interview/service] Not enough questions generated:', questions.length);
      throw new Error('AI generated insufficient questions');
    }

    // Validate question structure
    const validQuestions = questions.filter(q => 
      q && 
      typeof q.question === 'string' && 
      q.question.length > 10 &&
      Array.isArray(q.expectedKeywords) && 
      q.expectedKeywords.length > 0
    );

    if (validQuestions.length < 3) {
      console.error('[interview/service] Not enough valid questions:', validQuestions.length);
      throw new Error('AI generated invalid question format');
    }

    console.log('[interview/service] Successfully generated', validQuestions.length, 'valid questions');
    return validQuestions.slice(0, 5);
  } catch (err) {
    console.error('[interview/service] generateInterviewQuestions error:', err.message);
    if (err.message.includes('AI service') || err.message.includes('parse') || err.message.includes('array') || err.message.includes('invalid')) {
      throw err;
    }
    throw new Error('Failed to generate interview questions. Please try again.');
  }
}

// ── Evaluate a candidate answer via OpenRouter ────────────────────────────────
async function evaluateAnswer(questionText, transcription, expectedKeywords) {
  console.log('[interview/service] evaluateAnswer called:', { 
    questionLength: questionText?.length, 
    transcriptionLength: transcription?.length,
    keywordsCount: expectedKeywords?.length 
  });

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
    console.log('[interview/service] Calling AI service for evaluation...');
    const raw = await generateResponse([{ role: 'user', content: prompt }], { temperature: 0.4, maxTokens: 400 });
    
    if (!raw || typeof raw !== 'string') {
      console.error('[interview/service] Invalid AI response type:', typeof raw);
      throw new Error('AI service returned invalid response');
    }

    console.log('[interview/service] AI evaluation response received, length:', raw.length);
    const cleaned = stripFences(raw);
    
    let result;
    try {
      result = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[interview/service] JSON parse error:', parseErr.message);
      console.error('[interview/service] Raw response:', raw.slice(0, 300));
      throw new Error('Failed to parse evaluation response');
    }

    // Validate response structure
    if (typeof result.relevance !== 'number' || 
        typeof result.completeness !== 'number' || 
        typeof result.clarity !== 'number' ||
        typeof result.feedback !== 'string') {
      console.error('[interview/service] Invalid evaluation structure:', result);
      throw new Error('Invalid evaluation format');
    }

    // Ensure scores are in valid range
    result.relevance = Math.max(0, Math.min(100, result.relevance));
    result.completeness = Math.max(0, Math.min(100, result.completeness));
    result.clarity = Math.max(0, Math.min(100, result.clarity));

    console.log('[interview/service] Evaluation successful:', {
      relevance: result.relevance,
      completeness: result.completeness,
      clarity: result.clarity
    });

    return result;
  } catch (err) {
    console.error('[interview/service] evaluateAnswer error:', err.message);
    // Return fallback scores instead of throwing
    return { 
      relevance: 50, 
      completeness: 50, 
      clarity: 50, 
      feedback: 'Unable to evaluate answer at this time. Please continue with the next question.' 
    };
  }
}

module.exports = { generateInterviewQuestions, evaluateAnswer };
