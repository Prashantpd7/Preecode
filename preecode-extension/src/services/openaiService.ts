import * as vscode from 'vscode';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export async function generateQuestionExplanation(question: string, code: string, language: string): Promise<string> {
	if (!OPENAI_API_KEY) {
		vscode.window.showErrorMessage('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
		return '';
	}

	try {
		const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${OPENAI_API_KEY}`,
			},
			body: JSON.stringify({
				model: 'gpt-4-turbo',
				messages: [
					{
						role: 'system',
						content: 'You are an expert code reviewer and teacher. Provide concise, helpful feedback on the submitted code solution.' 
					},
					{
						role: 'user',
						content: `Question: ${question}\n\nLanguage: ${language}\n\nSolution Code:\n${code}\n\nProvide helpful feedback and explain the approach.`
					}
				],
				temperature: 0.7,
				max_tokens: 500,
			}),
		});

		if (!response.ok) {
			const errorData = await response.json() as any;
			vscode.window.showErrorMessage(`OpenAI API Error: ${errorData.error?.message || 'Unknown error'}`);
			return '';
		}

		const data: any = await response.json();
		return data.choices[0]?.message?.content || '';
	} catch (error) {
		console.error('OpenAI API Error:', error);
		vscode.window.showErrorMessage(`Failed to get AI feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
		return '';
	}
}

export async function detectTopic(question: string, code: string): Promise<string> {
	if (!OPENAI_API_KEY) {
		return 'General';
	}

	try {
		const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${OPENAI_API_KEY}`,
			},
			body: JSON.stringify({
				model: 'gpt-4-turbo',
				messages: [
					{
						role: 'system',
						content: 'You are a coding topic classifier. Return only one of these topics: Arrays, Strings, LinkedList, Trees, Graphs, Dynamic Programming, Sorting, Searching, Hashing, Stacks, Queues, Greedy, BackTracking, or General'
					},
					{
						role: 'user',
						content: `Classify this coding problem into ONE category:\n\nQuestion: ${question}\n\nCode:\n${code}`
					}
				],
				temperature: 0.3,
				max_tokens: 50,
			}),
		});

		if (!response.ok) {
			return 'General';
		}

		const data: any = await response.json();
		const topic = data.choices[0]?.message?.content?.trim() || 'General';
		return topic;
	} catch (error) {
		console.error('Topic detection error:', error);
		return 'General';
	}
}

export async function generateHint(question: string, language: string): Promise<string> {
	if (!OPENAI_API_KEY) {
		return 'No hint available. Configure OpenAI API key.';
	}

	try {
		const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${OPENAI_API_KEY}`,
			},
			body: JSON.stringify({
				model: 'gpt-4-turbo',
				messages: [
					{
						role: 'system',
						content: 'You are a helpful programming mentor. Provide a single hint (not the solution) to help solve the problem.'
					},
					{
						role: 'user',
						content: `Give me ONE helpful hint for this problem:\n\nQuestion: ${question}\n\nLanguage: ${language}\n\nDo not provide the solution, only a hint.`
					}
				],
				temperature: 0.7,
				max_tokens: 200,
			}),
		});

		if (!response.ok) {
			return 'Could not generate hint.';
		}

		const data: any = await response.json();
		return data.choices[0]?.message?.content || 'No hint available.';
	} catch (error) {
		console.error('Hint generation error:', error);
		return 'Could not generate hint.';
	}
}
