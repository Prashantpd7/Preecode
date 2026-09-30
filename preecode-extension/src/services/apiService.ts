import * as vscode from 'vscode';
import { getToken, deleteToken } from './authService';

export const DEFAULT_BACKEND_URL = 'https://preecode-backend.onrender.com';
// Non-streaming AI requests get 90s: free-tier models can be slow, and a slow
// answer is not a dead server. Timeouts are reported as timeouts, not as
// "server is starting up" (see mapAIError below).
const QUESTION_REQUEST_TIMEOUT_MS = 90_000;
// Streaming requests: generous total budget; an inactivity watchdog (no token
// for 60s) catches genuinely stuck streams instead of a short total timeout.
const STREAM_TOTAL_TIMEOUT_MS = 180_000;
const STREAM_INACTIVITY_TIMEOUT_MS = 60_000;

function normalizeBaseUrl(url: string): string {
    return String(url || '').trim().replace(/\/$/, '');
}

export function getBackendUrl(): string {
    // Use inspect() to check if the user explicitly set this in VS Code settings.
    // get() returns the package.json default even when not explicitly set, which
    // would prevent env var overrides (like .env.local) from ever being checked.
    const config = vscode.workspace.getConfiguration('preecode');
    const inspected = config.inspect<string>('backendUrl');
    if (inspected) {
        // Only use VS Code setting if user explicitly set it (not the default)
        const explicitValue = inspected.globalValue ?? inspected.workspaceValue ?? inspected.workspaceFolderValue;
        if (explicitValue) {
            return normalizeBaseUrl(explicitValue.trim());
        }
    }

    const envConfigured = process.env.PREECODE_BACKEND_URL?.trim();
    if (envConfigured) {
        // Keep local debugging explicit: only use an env override when the developer opted in.
        return normalizeBaseUrl(envConfigured);
    }

    return DEFAULT_BACKEND_URL;
}

export function getFrontendUrl(): string {
    const config = vscode.workspace.getConfiguration('preecode');
    const inspected = config.inspect<string>('frontendUrl');
    if (inspected) {
        const explicitValue = inspected.globalValue ?? inspected.workspaceValue ?? inspected.workspaceFolderValue;
        if (explicitValue) {
            return normalizeBaseUrl(explicitValue.trim());
        }
    }
    const envConfigured = process.env.PREECODE_FRONTEND_URL?.trim();
    if (envConfigured) {
        return normalizeBaseUrl(envConfigured);
    }
    return 'https://preecode.vercel.app';
}

export function getApiBase(): string {
    return `${getBackendUrl()}/api`;
}

export const API_BASE = getApiBase();

// Helper to obtain a fetch implementation in Node + ESM environments.
export async function doFetch(url: string, opts?: any): Promise<any> {
    if ((globalThis as any).fetch) {
        return (globalThis as any).fetch(url, opts);
    }
    const mod = await import('node-fetch');
    const fn = (mod && (mod.default || mod)) as any;
    return fn(url, opts);
}

export async function doFetchWithTimeout(url: string, opts: any, timeoutMs = QUESTION_REQUEST_TIMEOUT_MS): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await doFetch(url, { ...(opts || {}), signal: controller.signal });
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            // A timeout means the request was slow — NOT that the server is down.
            throw new Error('Request timed out. The AI is taking longer than usual — please try again.');
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * True only when the failure looks like the server itself is unreachable
 * (down, waking up, DNS failure) — as opposed to a slow AI response.
 * Only in this case should the UI say the server is "starting up".
 */
function isServerUnreachable(error: any): boolean {
    const msg = String(error?.message || '').toLowerCase();
    const code = String((error as any)?.code || '').toLowerCase();
    return (
        msg.includes('fetch failed') ||
        msg.includes('failed to fetch') ||
        msg.includes('network request failed') ||
        msg.includes('socket hang up') ||
        msg.includes('econnrefused') ||
        msg.includes('enotfound') ||
        msg.includes('eai_again') ||
        code.includes('econnrefused') ||
        code.includes('enotfound')
    );
}

/**
 * Maps a raw request failure to an honest user-facing error:
 * - server unreachable  -> "server is starting up" (retry shortly)
 * - slow AI response    -> "taking longer than usual" (not a server problem)
 * - anything else       -> the original message
 */
function mapAIError(error: any, fallback: string): Error {
    const msg = String(error?.message || '');
    if (isServerUnreachable(error)) {
        return new Error('Preecode server is starting up. Please wait a moment and try again.');
    }
    if (msg.toLowerCase().includes('timed out') || msg.includes('AbortError')) {
        return new Error('The AI is taking longer than usual. Please try again.');
    }
    return new Error(msg || fallback);
}

/**
 * Reads a Server-Sent Events stream from the backend (see
 * POST /api/ai/chat/stream and /api/ai/generate-question/stream).
 *
 * Protocol: `data: {"token": "..."}` per chunk, then
 * `data: {"done": true, "result": {...}}`, then `data: [DONE]`.
 * Resolves with the final `result` object (or null when the stream carries none).
 */
export async function doFetchStream(
    url: string,
    opts: any,
    onToken: (token: string) => void,
    timeouts: { totalMs?: number; inactivityMs?: number } = {}
): Promise<any> {
    const totalMs = timeouts.totalMs ?? STREAM_TOTAL_TIMEOUT_MS;
    const inactivityMs = timeouts.inactivityMs ?? STREAM_INACTIVITY_TIMEOUT_MS;
    const controller = new AbortController();
    const totalTimer = setTimeout(() => controller.abort(), totalMs);
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    const resetInactivity = () => {
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
        }
        inactivityTimer = setTimeout(() => controller.abort(), inactivityMs);
    };

    try {
        resetInactivity();
        const response: any = await doFetch(url, { ...(opts || {}), signal: controller.signal });

        if (response.status === 401) {
            throw new Error('Session expired. Please login again.');
        }
        if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(String(errorData?.message || `AI request failed (${response.status}).`));
        }

        const reader = response.body?.getReader?.();
        if (!reader) {
            throw new Error('Streaming is not supported in this environment.');
        }

        let result: any = null;
        let buffer = '';
        const decoder = new TextDecoder();
        for (;;) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            resetInactivity();
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) {
                    continue;
                }
                const data = trimmed.slice(5).trim();
                if (!data || data === '[DONE]') {
                    continue;
                }
                let parsed: any = null;
                try {
                    parsed = JSON.parse(data);
                } catch {
                    continue;
                }
                if (parsed && typeof parsed.error === 'string' && parsed.error) {
                    throw new Error(parsed.error);
                }
                if (parsed && parsed.done) {
                    result = parsed.result ?? null;
                    continue;
                }
                const token = parsed?.token;
                if (typeof token === 'string' && token.length > 0) {
                    try {
                        onToken(token);
                    } catch {
                        // Never let a UI callback break the stream.
                    }
                }
            }
        }
        return result;
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            throw new Error('Request timed out. The AI is taking longer than usual — please try again.');
        }
        throw error;
    } finally {
        clearTimeout(totalTimer);
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
        }
    }
}

// Shape of practice data sent after each successful run
export interface PracticeData {
    question: string;
    timeTaken: string;      // formatted "MM:SS"
    topic?: string;         // e.g., 'Arrays', 'Strings', etc.
    hintsUsed: number;
    solutionViewed: boolean;
    language: string;
    date: string;           // ISO 8601 date string
    difficulty?: 'easy' | 'medium' | 'hard';
    hintUsagePercent?: number;
    aiRating?: number;
}

// Shape of submission data sent when user submits a solution from the extension
export interface SubmissionData {
    problemName: string;
    difficulty?: string;
    status: string; // e.g., 'Accepted', 'Wrong Answer'
    topic?: string; // e.g., 'Arrays', 'Strings', etc.
    timeTaken?: string; // formatted "MM:SS"
    date?: string;  // ISO string
}

export interface ChatHistoryItem {
    role: 'user' | 'assistant';
    text: string;
}

export interface GenerateQuestionRequest {
    language: string;
    difficulty: 'easy' | 'medium' | 'hard';
}

function normalizeDifficulty(input?: string): 'easy' | 'medium' | 'hard' {
    const value = String(input || '').trim().toLowerCase();
    if (value === 'easy' || value === 'medium' || value === 'hard') return value;
    return 'easy';
}

function normalizeStatus(input: string): 'accepted' | 'wrong' {
    const value = String(input || '').trim().toLowerCase();
    if (value.includes('accept') || value.includes('correct')) return 'accepted';
    return 'wrong';
}

export async function sendSubmission(
    context: vscode.ExtensionContext,
    data: SubmissionData
): Promise<boolean> {
    const token = await getToken(context);
    if (!token) {
        vscode.window.showErrorMessage('preecode: Please login first to submit.');
        return false;
    }

    try {
        // Resolve userId from /users/me so backend receives an explicit userId
        let userId: string | undefined;
        try {
            const meRes = await doFetch(`${API_BASE}/users/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (meRes && meRes.ok) {
                const meJson: any = await meRes.json();
                userId = meJson._id || meJson.id;
            }
        } catch (e) { /* ignore */ }

        const response = await doFetch(`${API_BASE}/submissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId,
                problemName: (data.problemName || 'Practice Session').trim(),
                difficulty: normalizeDifficulty(data.difficulty),
                status: normalizeStatus(data.status),
                topic: data.topic || 'General',
                timeTaken: data.timeTaken || '00:00',
            })
        });

        if (response.status === 401) {
            await deleteToken(context);
            vscode.window.showErrorMessage('preecode: Session expired. Please login again.');
            return false;
        }

        if (response.status === 429) {
            vscode.window.showWarningMessage('preecode: Too many requests right now. Please wait a few seconds and try again.');
            return false;
        }

        if (!response.ok) {
            vscode.window.showErrorMessage(`preecode: Failed to submit (${response.status}).`);
            return false;
        }

        vscode.window.showInformationMessage(`preecode: Submission saved (${(data.problemName || 'Practice Session').trim()})`);
        return true;
    } catch (err) {
        vscode.window.showErrorMessage('preecode: Could not reach server. Submission not saved.');
        return false;
    }
}

/**
 * Sends practice session data to the backend after a successful run.
 *
 * Phase 2: POST /api/practice with Bearer token.
 * Phase 4: Handles fetch failures and 401 session expiry cleanly.
 *
 * Returns true if data was sent successfully, false otherwise.
 */
export async function sendPracticeData(
    context: vscode.ExtensionContext,
    data: PracticeData
): Promise<boolean> {
    // Get stored token — if missing, user is not logged in
    const token = await getToken(context);

    if (!token) {
        vscode.window.showErrorMessage(
            'preecode: Please login first to save your practice data. Use "preecode: Login" command.'
        );
        return false;
    }

    try {
        const response = await doFetch(`${API_BASE}/practice`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        // Phase 4: 401 means token is expired or invalid — auto logout
        if (response.status === 401) {
            await deleteToken(context);
            vscode.window.showErrorMessage(
                'preecode: Session expired. Please login again using "preecode: Login".'
            );
            return false;
        }

        if (response.status === 429) {
            vscode.window.showWarningMessage(
                'preecode: Too many requests right now. Please wait a few seconds and try saving again.'
            );
            return false;
        }

        if (!response.ok) {
            vscode.window.showErrorMessage(
                `preecode: Failed to save practice data (${response.status}). Will try again next time.`
            );
            return false;
        }

        // Notify user of saved practice (non-blocking)
        try {
            vscode.window.showInformationMessage(`preecode: Practice saved — ${data.timeTaken}`);
        } catch (e) {
            console.log('Could not show notification:', e);
        }

        return true;

    } catch (error: any) {
        // Phase 4: Network failure or fetch error — show message, do not crash
        vscode.window.showErrorMessage(
            'preecode: Could not reach server. Practice data not saved. Check your connection.'
        );
        return false;
    }
}

export async function sendAIChatMessage(
    context: vscode.ExtensionContext,
    message: string,
    editorContext: string,
    history: ChatHistoryItem[] = []
): Promise<string> {
    const token = await getToken(context);
    if (!token) {
        throw new Error('Please login to Preecode to use AI chat.');
    }

    const safeHistory = (Array.isArray(history) ? history : [])
        .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.text === 'string')
        .slice(-12)
        .map((item) => ({ role: item.role, text: item.text.trim().slice(0, 2000) }));

    try {
        console.log('[Preecode] Calling backend API: /api/ai/chat');
        const response = await doFetchWithTimeout(`${API_BASE}/ai/chat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                context: editorContext,
                history: safeHistory
            })
        });

        if (response.status === 401) {
            await deleteToken(context);
            throw new Error('Session expired. Please login again.');
        }

        if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `AI chat failed (${response.status}).`);
        }

        const payload: any = await response.json();
        console.log('[Preecode] Backend response received: /api/ai/chat');
        return String(payload?.response || '').trim();
    } catch (error: any) {
        throw mapAIError(error, 'Could not reach AI chat service.');
    }
}

/**
 * Streaming variant of sendAIChatMessage: tokens are delivered to onToken as
 * the AI generates them (word-by-word rendering), and the promise resolves
 * with the complete response text. Falls back gracefully — callers can catch
 * a 404 and use sendAIChatMessage when the backend predates /ai/chat/stream.
 */
export async function sendAIChatMessageStream(
    context: vscode.ExtensionContext,
    message: string,
    editorContext: string,
    history: ChatHistoryItem[] = [],
    onToken: (token: string) => void = () => {}
): Promise<string> {
    const token = await getToken(context);
    if (!token) {
        throw new Error('Please login to Preecode to use AI chat.');
    }

    const safeHistory = (Array.isArray(history) ? history : [])
        .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.text === 'string')
        .slice(-12)
        .map((item) => ({ role: item.role, text: item.text.trim().slice(0, 2000) }));

    try {
        console.log('[Preecode] Calling backend API: /api/ai/chat/stream');
        const result: any = await doFetchStream(`${API_BASE}/ai/chat/stream`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({
                message,
                context: editorContext,
                history: safeHistory
            })
        }, onToken);

        const text = String(result?.response || '').trim();
        console.log('[Preecode] Backend stream completed: /api/ai/chat/stream');
        return text;
    } catch (error: any) {
        if (String(error?.message || '').includes('Session expired')) {
            await deleteToken(context);
        }
        throw mapAIError(error, 'Could not reach AI chat service.');
    }
}

function normalizeQuestionResponse(payload: any): string {
    const question = String(payload?.question || payload?.data?.question || payload?.result?.question || '').trim();
    const hint = String(payload?.hint || payload?.data?.hint || payload?.result?.hint || '').trim();
    const solution = String(payload?.solution || payload?.data?.solution || payload?.result?.solution || '').trim();

    if (!question) {
        throw new Error('Backend returned empty question content.');
    }

    const blocks = ['[QUESTION]', question];
    if (hint) {
        blocks.push('', '[HINT]', hint);
    }
    if (solution) {
        blocks.push('', '[SOLUTION]', solution);
    }

    return blocks.join('\n');
}

function ensureQuestionBlock(text: string): string {
    const cleaned = String(text || '').trim();
    if (!cleaned) {
        throw new Error('Backend returned empty question content.');
    }
    if (/\[QUESTION\]/i.test(cleaned)) {
        return cleaned;
    }
    return ['[QUESTION]', cleaned].join('\n');
}

export async function generateQuestionFromBackend(
    context: vscode.ExtensionContext,
    request: GenerateQuestionRequest
): Promise<string> {
    const language = String(request.language || '').trim().toLowerCase() || 'plaintext';
    const difficulty = normalizeDifficulty(request.difficulty);

    const token = await getToken(context);
    if (!token) {
        throw new Error('Please login to Preecode to generate questions.');
    }

    // Primary: dedicated generate-question endpoint
    try {
        console.log('[Preecode] Calling backend API: /api/ai/generate-question');
        const response = await doFetchWithTimeout(`${API_BASE}/ai/generate-question`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ language, difficulty })
        });

        if (response.status === 401) {
            await deleteToken(context);
            throw new Error('Session expired. Please login again.');
        }

        if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const message = String(errorData?.message || '').trim();
            throw new Error(message || `Question generation failed (${response.status}).`);
        }

        const payload: any = await response.json().catch(() => ({}));
        console.log('[Preecode] Backend response received: /api/ai/generate-question');
        return ensureQuestionBlock(String(payload?.question || ''));
    } catch (error: any) {
        const msg = String(error?.message || '');
        // Re-throw auth errors immediately — no point in fallback
        if (msg.includes('Session expired') || msg.includes('login')) {
            throw error;
        }
        console.warn('[Preecode] Primary generate-question failed, trying chat fallback:', msg);
    }

    // Fallback: use /api/ai/chat to generate a question
    try {
        const prompt = [
            `Generate one ${difficulty} coding practice question in ${language}.`,
            'Return strictly in this format (no markdown fences):',
            '[QUESTION]',
            '<clear problem statement with input/output and constraints>',
            '',
            '[HINT]',
            '<a concise non-spoiler hint>',
            '',
            '[SOLUTION]',
            '<complete correct solution in ' + language + ', raw code only, no backticks>',
            '',
            'Rules: include a small execution block that runs and prints sample output.'
        ].join('\n');

        console.log('[Preecode] Calling backend fallback: /api/ai/chat for question generation');
        const response = await doFetchWithTimeout(`${API_BASE}/ai/chat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: prompt,
                context: `language=${language};difficulty=${difficulty}`,
                history: []
            })
        });

        if (response.status === 401) {
            await deleteToken(context);
            throw new Error('Session expired. Please login again.');
        }

        if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const message = String(errorData?.message || '').trim();
            throw new Error(message || `Question generation failed (${response.status}).`);
        }

        const payload: any = await response.json().catch(() => ({}));
        console.log('[Preecode] Backend fallback response received');
        const content = String(payload?.response || '').trim();
        return ensureQuestionBlock(content);
    } catch (error: any) {
        throw mapAIError(error, 'Could not reach question generation service.');
    }
}

/**
 * Streaming variant of generateQuestionFromBackend: raw tokens are delivered
 * to onToken as the AI generates them (typing effect in the editor), and the
 * promise resolves with the final parsed question in [QUESTION] block format.
 */
export async function generateQuestionStreamFromBackend(
    context: vscode.ExtensionContext,
    request: GenerateQuestionRequest,
    onToken: (token: string) => void = () => {}
): Promise<string> {
    const language = String(request.language || '').trim().toLowerCase() || 'plaintext';
    const difficulty = normalizeDifficulty(request.difficulty);

    const token = await getToken(context);
    if (!token) {
        throw new Error('Please login to Preecode to generate questions.');
    }

    try {
        console.log('[Preecode] Calling backend API: /api/ai/generate-question/stream');
        const result: any = await doFetchStream(`${API_BASE}/ai/generate-question/stream`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({ language, difficulty })
        }, onToken);

        console.log('[Preecode] Backend stream completed: /api/ai/generate-question/stream');
        return ensureQuestionBlock(String(result?.question || ''));
    } catch (error: any) {
        const msg = String(error?.message || '');
        if (msg.includes('Session expired') || msg.includes('login')) {
            throw error;
        }
        throw mapAIError(error, 'Could not reach question generation service.');
    }
}



