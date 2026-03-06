import OpenAI from "openai";

function createOpenAIClient(): OpenAI | null {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return null;
    }
    return new OpenAI({ apiKey });
}

export async function generatePracticeQuestion(
    topic: string,
    language: string,
    difficulty: string
): Promise<string> {

    function localFallbackQuestion(): string {
        const lang = String(language || 'plaintext').toLowerCase();
        const topicName = String(topic || 'General').trim() || 'General';
        const diff = String(difficulty || 'medium').trim().toLowerCase();

        const solution = lang === 'python'
            ? [
                'def solve_even_sum(nums):',
                '    return sum(x for x in nums if x % 2 == 0)',
                '',
                'if __name__ == "__main__":',
                '    print(solve_even_sum([1, 2, 3, 4, 5, 6]))'
              ].join('\n')
            : [
                'function solveEvenSum(nums) {',
                '  return nums.filter((x) => x % 2 === 0).reduce((acc, x) => acc + x, 0);',
                '}',
                '',
                'console.log(solveEvenSum([1, 2, 3, 4, 5, 6]));'
              ].join('\n');

        return [
            '[QUESTION]',
            `Write a ${diff} ${topicName} problem in ${language}.`,
            'Given an array of integers, return the sum of all even values.',
            '',
            '[HINT]',
            'Loop through the array once and add numbers where value % 2 is 0.',
            '',
            '[SOLUTION]',
            solution
        ].join('\n');
    }

    const openai = createOpenAIClient();
    if (!openai) {
        return localFallbackQuestion();
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

        const prompt = `
Generate a ${difficulty} level coding practice problem.

Topic: ${topic}
Programming Language: ${language}

${languageInstruction}

Return output STRICTLY in this format:

[QUESTION]
Clear problem statement only.

[HINT]
A helpful hint for solving the problem.

[SOLUTION]
Complete correct solution in ${language}.

Rules for [SOLUTION]:
- DO NOT wrap the solution in markdown.
- DO NOT use triple backticks.
- Return raw code only inside [SOLUTION].
- Do not add extra headings.
- Do not add explanations outside blocks.
- Do not remove the block labels.
- Solution must be valid runnable ${language} code.
- Solution MUST include both function definition AND an execution block.
- After defining the function, ALWAYS include a small execution block that:
  * Calls the function with sample input.
  * Prints or logs the result.
${language === 'python' ? `- For Python: Add execution block as:
  if __name__ == "__main__":
      print(function_name(sample_input))` : `- For ${language}: Add execution block as:
  console.log(function_name(sample_input));`}
- The code must be immediately runnable when user clicks Run.
- Do not include any markdown or explanations.
`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "user", content: prompt }
            ],
            temperature: 0.6,
        });

        let rawText = response.choices[0].message.content || "No content generated.";

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

        // Always fall back to a local question — never show raw API error strings to users
        return localFallbackQuestion();
    }
}
