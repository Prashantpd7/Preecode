const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Ordered fallback list used when a provider/model is temporarily unstable.
const OPENROUTER_MODELS = [
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'anthropic/claude-3-haiku'
];
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const REQUEST_TIMEOUT_MS = 12000;
const MIN_REQUEST_SPACING_MS = 200;

let lastRequestAtMs = 0;

export interface OpenRouterMessage {
    role: string;
    content: string;
}

export interface CallOpenRouterOptions {
    temperature?: number;
    max_tokens?: number;
}

export interface CallOpenRouterResult {
    content: string;
    model: string;
    raw: any;
}

export class OpenRouterRequestError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly details: any;

    constructor(message: string, statusCode: number, code: string, details?: any) {
        super(message);
        this.name = 'OpenRouterRequestError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details || {};
    }
}

function getOpenRouterApiKey(): string {
    return String(process.env.OPENROUTER_API_KEY || '').trim();
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyRateLimitDelay(): Promise<void> {
    // Spread rapid calls slightly to reduce 429 responses during bursts.
    const now = Date.now();
    const elapsed = now - lastRequestAtMs;
    if (elapsed < MIN_REQUEST_SPACING_MS) {
        await sleep(MIN_REQUEST_SPACING_MS - elapsed);
    }
    lastRequestAtMs = Date.now();
}

function validateMessages(messages: OpenRouterMessage[]): void {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new OpenRouterRequestError(
            'Invalid OpenRouter payload: messages must be a non-empty array.',
            400,
            'INVALID_OPENROUTER_PAYLOAD'
        );
    }

    for (const message of messages) {
        const validRole = typeof message?.role === 'string' && message.role.trim().length > 0;
        const validContent = typeof message?.content === 'string' && message.content.trim().length > 0;
        if (!validRole || !validContent) {
            throw new OpenRouterRequestError(
                'Invalid OpenRouter payload: each message must include role and content.',
                400,
                'INVALID_OPENROUTER_PAYLOAD'
            );
        }
    }
}

function validateModel(model: string): void {
    if (typeof model !== 'string' || model.trim().length === 0) {
        throw new OpenRouterRequestError(
            'Invalid OpenRouter payload: model must be a non-empty string.',
            400,
            'INVALID_OPENROUTER_PAYLOAD'
        );
    }
}

function parseJsonSafely(rawText: string): any {
    if (!rawText) {
        return null;
    }

    try {
        return JSON.parse(rawText);
    } catch {
        return null;
    }
}

async function fetchWithTimeout(url: string, options: any, timeoutMs: number): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        if ((globalThis as any).fetch) {
            return await (globalThis as any).fetch(url, { ...options, signal: controller.signal });
        }

        const mod = await import('node-fetch');
        const fn = (mod && (mod.default || mod)) as any;
        return await fn(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function call_openrouter(
    messages: OpenRouterMessage[],
    options: CallOpenRouterOptions = {}
): Promise<CallOpenRouterResult> {
    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
        throw new OpenRouterRequestError(
            'OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable.',
            503,
            'OPENROUTER_API_KEY_MISSING'
        );
    }

    validateMessages(messages);

    const requestOptions = {
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 700,
    };

    const errorLog: Array<Record<string, any>> = [];

    // Retry each model before failing over to the next model in the chain.
    for (const model of OPENROUTER_MODELS) {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
            const attemptNumber = attempt + 1;

            try {
                await applyRateLimitDelay();

                const payload = {
                    model,
                    messages,
                    temperature: requestOptions.temperature,
                    max_tokens: requestOptions.max_tokens,
                };

                validateModel(payload.model);

                const response = await fetchWithTimeout(
                    OPENROUTER_URL,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload),
                    },
                    REQUEST_TIMEOUT_MS
                );

                const rawBody = await response.text();
                const parsedBody = parseJsonSafely(rawBody);

                if (!response.ok) {
                    const message = parsedBody?.error?.message || `OpenRouter HTTP ${response.status}`;
                    const retryable = response.status === 429 || response.status >= 500 || response.status === 408;

                    console.error('[extension-ai] OpenRouter non-200 response', {
                        model,
                        attempt: attemptNumber,
                        status: response.status,
                        body: rawBody,
                    });

                    errorLog.push({
                        model,
                        attempt: attemptNumber,
                        status: response.status,
                        message,
                    });

                    if (retryable && attempt < MAX_RETRIES) {
                        await sleep(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
                        continue;
                    }

                    break;
                }

                const content = parsedBody?.choices?.[0]?.message?.content;
                if (!content || typeof content !== 'string') {
                    errorLog.push({
                        model,
                        attempt: attemptNumber,
                        status: response.status,
                        message: 'OpenRouter returned empty content.',
                    });
                    break;
                }

                return {
                    content,
                    model,
                    raw: parsedBody,
                };
            } catch (error: any) {
                const isTimeout = error?.name === 'AbortError';
                const retryable = isTimeout || error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT';

                console.error('[extension-ai] OpenRouter network/timeout error', {
                    model,
                    attempt: attemptNumber,
                    error: error?.message || String(error),
                });

                errorLog.push({
                    model,
                    attempt: attemptNumber,
                    message: isTimeout ? 'OpenRouter request timed out.' : error?.message || 'Network error',
                });

                if (retryable && attempt < MAX_RETRIES) {
                    await sleep(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
                    continue;
                }

                break;
            }
        }
    }

    const lastError = errorLog[errorLog.length - 1] || {};
    throw new OpenRouterRequestError(
        'OpenRouter request failed after retries and model fallbacks.',
        lastError.status || 502,
        'OPENROUTER_FALLBACK_EXHAUSTED',
        {
            model: lastError.model,
            attempt: lastError.attempt,
            providerStatus: lastError.status,
            errorLog,
        }
    );
}
