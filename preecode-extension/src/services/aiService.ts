import OpenAI from "openai";
import * as vscode from 'vscode';

function createOpenAIClient(): OpenAI | null {
    const configKey = vscode.workspace.getConfiguration('preecode').get<string>('openaiApiKey') || '';
    const apiKey = String(configKey || process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
        return null;
    }
    return new OpenAI({ apiKey });
}

export async function generatePracticeQuestion(
    topic: string,
    language: string,
    difficulty: string,
    recentQuestions: string[] = []
): Promise<string> {
    const openai = createOpenAIClient();
    if (!openai) {
        throw new Error('OpenAI API key not configured. Set preecode.openaiApiKey in VS Code settings or OPENAI_API_KEY.');
    }

    try {

        // 🔥 Language-specific enforcement
        let languageInstruction = "";

        if (language === "javascript") {
            languageInstruction = `
- Generate PURE JavaScript.
- DO NOT use TypeScript type annotations.
- DO NOT use ": number", ": string", "number[]", etc.
- Do NOT write function signatures with types.
`;
        } else if (language === "typescript") {
            languageInstruction = `
- Generate proper TypeScript.
- Type annotations are allowed.
`;
        } else if (language === "python") {
            languageInstruction = `
- Generate proper Python.
- Do NOT use JavaScript syntax.
`;
        }

        const safeDifficulty = String(difficulty || 'medium').trim().toLowerCase();
        const safeTopic = String(topic || 'General').trim() || 'General';
        const safeLanguage = String(language || 'plaintext').trim().toLowerCase() || 'plaintext';
        const recentList = recentQuestions
            .map((q) => q.trim())
            .filter(Boolean)
            .slice(0, 5)
            .map((q, i) => `${i + 1}. ${q}`)
            .join('\n');

        const prompt = `
    Generate ONE high-quality ${safeDifficulty} coding practice problem.

    Topic focus: ${safeTopic}
    Programming language for solution: ${safeLanguage}

${languageInstruction}

    Difficulty design rules:
    - easy: basic logic, 1-2 core conditions, straightforward constraints.
    - medium: combines multiple conditions/data rules, requires careful edge-case handling.
    - hard: non-trivial constraints, trickier corner cases, and optimization awareness.

    Variation rules:
    - Create a different scenario and objective each time.
    - Avoid repeating common cliches and avoid reusing exact wording.
    - If recent questions are provided, do not generate the same or near-duplicate problem.

    Recent questions to avoid repeating:
    ${recentList || '(none)'}

Return output STRICTLY in this format:

[QUESTION]
    Clear problem statement only, including input/output expectations and constraints.

[HINT]
    A concise, non-spoiler hint.

[SOLUTION]
    Complete correct solution in ${safeLanguage}.

Rules for [SOLUTION]:
- DO NOT wrap the solution in markdown.
- DO NOT use triple backticks.
- Return raw code only inside [SOLUTION].
- Do not add extra headings.
- Do not add explanations outside blocks.
- Do not remove the block labels.
- Solution must be valid runnable ${safeLanguage} code.
- Solution MUST include both function definition AND an execution block.
- After defining the function, ALWAYS include a small execution block that:
  * Calls the function with sample input.
  * Prints or logs the result.
${safeLanguage === 'python' ? `- For Python: Add execution block as:
  if __name__ == "__main__":
      print(function_name(sample_input))` : `- For ${language}: Add execution block as:
  console.log(function_name(sample_input));`}
- The code must be immediately runnable when user clicks Run.
- Do not include any markdown or explanations.
`;

        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL_MINI || 'gpt-4o-mini',
            messages: [
                { role: "user", content: prompt }
            ],
            temperature: 0.9,
        });

        let rawText = response.choices[0].message.content || '';

        // 🔥 Safe Cleanup Layer
            rawText = rawText
        .replace(/```[\w]*\n?/g, "")   // remove ```python or ```
        .replace(/```/g, "")          // remove closing ```
        .replace(/^\s*[=-]{3,}\s*$/gm, "")
        .replace(/Question:/gi, "")
        .trim();


        return rawText;

    } catch (error: any) {
        const errorMessage = error?.message || JSON.stringify(error);
        console.error("OPENAI ERROR:", errorMessage, "Status:", error?.status);
        throw new Error(errorMessage || 'OpenAI question generation failed.');
    }
}
