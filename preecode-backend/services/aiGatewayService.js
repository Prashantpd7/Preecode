/**
 * AI Gateway Service — SINGLE source of truth for all OpenRouter AI access.
 *
 * Every AI feature in Preecode (chat, hints, reviews, questions, interviews,
 * resume analysis, security analysis, extension actions) MUST route through
 * this service. No other file may call OpenRouter or any AI provider directly.
 *
 * To switch models in the future:
 *   Change PRIMARY_MODEL / FALLBACK_MODEL_* env vars. No code changes needed.
 *
 * To switch providers in the future:
 *   Only this file needs modification. No frontend, extension, controller,
 *   or route changes are required.
 *
 * Architecture:
 *   Website / Extension → Backend API → aiGatewayService → OpenRouter → Model
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ─── Model Configuration (from environment variables) ────────────────────────
// Models are loaded from env vars so you never need to modify code to change them.
// Set these in .env (local) or Render dashboard (production).
//
//   PRIMARY_MODEL=qwen/qwen3-235b-a22b:free
//   FALLBACK_MODEL_1=deepseek/deepseek-chat-v3-0324:free
//   FALLBACK_MODEL_2=meta-llama/llama-4-maverick:free
//   FALLBACK_MODEL_3=mistralai/mistral-small-3.1-24b-instruct:free
//   FALLBACK_MODEL_4=openrouter/free
//   FALLBACK_MODEL_5=openrouter/auto

function buildModelChain() {
  const primary = String(process.env.PRIMARY_MODEL || '').trim();
  const fallbacks = [];

  for (let i = 1; i <= 10; i++) {
    const key = `FALLBACK_MODEL_${i}`;
    const value = String(process.env[key] || '').trim();
    if (value) fallbacks.push(value);
  }

  // Default chain used when no env vars are configured
  if (!primary && fallbacks.length === 0) {
    return [
      'qwen/qwen3-235b-a22b:free',
      'deepseek/deepseek-chat-v3-0324:free',
      'meta-llama/llama-4-maverick:free',
      'mistralai/mistral-small-3.1-24b-instruct:free',
      'openrouter/free',
      'openrouter/auto',
    ];
  }

  const chain = [];
  if (primary) chain.push(primary);
  chain.push(...fallbacks);
  return chain;
}

let _models = null;
function getModels() {
  if (!_models) {
    _models = buildModelChain();
  }
  return _models;
}

// ─── Operational Configuration ───────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [800, 2000, 4000];
const REQUEST_TIMEOUT_MS = 45000; // 45s — free models can be slow
const MIN_REQUEST_SPACING_MS = 200;

let lastRequestAtMs = 0;
let currentKeyIndex = 0;
let startupLogged = false;

// ─── API Key Management ──────────────────────────────────────────────────────
function getApiKeys() {
  const keysString = String(process.env.OPENROUTER_API_KEY || '').trim();
  if (!keysString) return [];
  return keysString.split(',').map(k => k.trim()).filter(k => k.length > 0);
}

function getApiKey() {
  const keys = getApiKeys();
  if (keys.length === 0) return '';
  const key = keys[currentKeyIndex % keys.length];
  return key;
}

function rotateToNextKey() {
  const keys = getApiKeys();
  if (keys.length > 1) {
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  }
}

// ─── Startup Diagnostics ─────────────────────────────────────────────────────
function buildModelChainSummary() {
  const models = getModels();
  if (models.length === 0) return '(no models configured)';
  return models.map((m, i) => `${i === 0 ? 'PRIMARY' : `FALLBACK ${i}`}=${m}`).join('\n║  ');
}

function logStartupDiagnostics() {
  if (startupLogged) return;
  startupLogged = true;

  const keys = getApiKeys();
  const models = getModels();
  const modelSummary = buildModelChainSummary();

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         AI GATEWAY SERVICE — Startup Diagnostics          ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  Provider         │ OpenRouter                               ║`);
  console.log(`║  API Key Present  │ ${keys.length > 0 ? 'YES' : 'NO — AI features will fail'}              ║`);
  console.log(`║  Model Chain      │ ${models.length} model(s) configured              ║`);
  console.log(`║  ${modelSummary}`);
  console.log(`║  Max Retries      │ ${MAX_RETRIES}                              ║`);
  console.log(`║  Request Timeout  │ ${REQUEST_TIMEOUT_MS}ms                         ║`);
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  if (keys.length === 0) {
    console.warn('[ai-gateway] ⚠️  OPENROUTER_API_KEY is not configured.');
    console.warn('[ai-gateway] ⚠️  All AI features will return configuration errors until the key is set.');
    console.warn('[ai-gateway] ⚠️  Set OPENROUTER_API_KEY in environment variables or .env file.');
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyRateLimitDelay() {
  const now = Date.now();
  const elapsed = now - lastRequestAtMs;
  if (elapsed < MIN_REQUEST_SPACING_MS) {
    await sleep(MIN_REQUEST_SPACING_MS - elapsed);
  }
  lastRequestAtMs = Date.now();
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    const err = new Error('Invalid payload: messages must be a non-empty array.');
    err.statusCode = 400;
    err.code = 'INVALID_PAYLOAD';
    throw err;
  }
  for (const message of messages) {
    if (!message || typeof message.role !== 'string' || !message.role.trim() ||
        typeof message.content !== 'string' || !message.content.trim()) {
      const err = new Error('Invalid payload: each message must include role and content.');
      err.statusCode = 400;
      err.code = 'INVALID_PAYLOAD';
      throw err;
    }
  }
}

function validateModel(model) {
  if (typeof model !== 'string' || model.trim().length === 0) {
    const err = new Error('Invalid payload: model must be a non-empty string.');
    err.statusCode = 400;
    err.code = 'INVALID_PAYLOAD';
    throw err;
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseJsonSafely(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ─── Core AI Call ────────────────────────────────────────────────────────────
// This is the ONLY function that makes HTTP requests to OpenRouter.
// All AI features must eventually call this function.

/**
 * Makes an AI request through the gateway.
 *
 * @param {Array} messages - Array of { role, content } message objects
 * @param {Object} [options]
 * @param {number} [options.temperature=0.7]
 * @param {number} [options.maxTokens=512]
 * @param {string} [options.feature='unknown'] - Feature name for diagnostics
 * @returns {Promise<{content: string, model: string, raw: Object}>}
 */
async function callAI(messages, options = {}) {
  logStartupDiagnostics();

  const startTime = Date.now();
  const feature = options.feature || 'unknown';
  const models = getModels();

  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error('AI is not configured. Set OPENROUTER_API_KEY in backend environment variables.');
    err.statusCode = 503;
    err.code = 'AI_GATEWAY_API_KEY_MISSING';
    throw err;
  }

  validateMessages(messages);

  const config = {
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 512,
  };

  const errors = [];

  // Try each model in order (PRIMARY first, then FALLBACK_1, FALLBACK_2, ...)
  for (const model of models) {
    if (!model || typeof model !== 'string') continue;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const attemptNumber = attempt + 1;
      const payload = {
        model,
        messages,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
      };

      try {
        validateModel(payload.model);
        validateMessages(payload.messages);

        await applyRateLimitDelay();

        const response = await fetchWithTimeout(
          OPENROUTER_URL,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': process.env.BACKEND_URL || 'http://localhost:5001',
              'X-Title': 'Preecode',
            },
            body: JSON.stringify(payload),
          },
          REQUEST_TIMEOUT_MS
        );

        const rawBody = await response.text();
        const parsedBody = parseJsonSafely(rawBody);

        if (!response.ok) {
          const providerMessage = parsedBody?.error?.message || `OpenRouter HTTP ${response.status}`;
          const skipImmediately = response.status === 402 || response.status === 404;
          const isRateLimit = response.status === 429 ||
            providerMessage.includes('Rate limit exceeded') ||
            providerMessage.includes('free-models-per-day');
          const retryable = !skipImmediately && (response.status === 429 || response.status >= 500 || response.status === 408);

          if (isRateLimit && getApiKeys().length > 1) {
            rotateToNextKey();
            if (attempt < MAX_RETRIES) {
              await sleep(500);
              continue;
            }
          }

          errors.push({ model, attempt: attemptNumber, status: response.status, message: providerMessage });

          if (skipImmediately) break;
          if (retryable && attempt < MAX_RETRIES) {
            await sleep(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
            continue;
          }
          break;
        }

        const content = parsedBody?.choices?.[0]?.message?.content;

        if (!content || typeof content !== 'string') {
          errors.push({ model, attempt: attemptNumber, status: response.status, message: 'Empty content' });
          break;
        }

        const latency = Date.now() - startTime;
        console.log(`[ai-gateway] ✅ Feature=${feature} Model=${model} Attempt=${attemptNumber} Latency=${latency}ms`);

        return { content, model, raw: parsedBody };
      } catch (error) {
        const isTimeout = error && error.name === 'AbortError';
        const retryable = isTimeout || (error && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT'));

        errors.push({
          model,
          attempt: attemptNumber,
          message: isTimeout ? 'Request timed out.' : error?.message || 'Network error',
        });

        if (retryable && attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
          continue;
        }
        break;
      }
    }
  }

  const lastError = errors[errors.length - 1] || {};
  const latency = Date.now() - startTime;
  const errorSummary = errors.map(e => `[${e.model} attempt ${e.attempt}]: ${e.message}`).join(' | ');

  console.error(`[ai-gateway] ❌ Feature=${feature} Failed=${errors.length} models Latency=${latency}ms`);

  const err = new Error(
    `AI request failed across all models. Last error: ${lastError.message || 'Unknown'}. Full trace: ${errorSummary}`
  );
  err.statusCode = 502;
  err.code = 'AI_GATEWAY_FALLBACK_EXHAUSTED';
  err.details = { errors, feature, latency };
  throw err;
}

// ─── Health / Status ─────────────────────────────────────────────────────────

/**
 * Returns the current status of the AI gateway.
 */
function getStatus() {
  const models = getModels();
  return {
    provider: 'OpenRouter',
    endpoint: OPENROUTER_URL,
    primaryModel: models[0] || 'none',
    fallbackCount: models.length - 1,
    modelCount: models.length,
    models: models,
    keyConfigured: getApiKeys().length > 0,
    keyCount: getApiKeys().length,
    maxRetries: MAX_RETRIES,
    timeoutMs: REQUEST_TIMEOUT_MS,
    status: getApiKeys().length > 0 ? 'ready' : 'misconfigured',
  };
}

module.exports = {
  callAI,
  getStatus,
  // Exposed for backward compatibility with existing aiService.js
  OPENROUTER_URL,
  get MODELS() { return getModels(); },
};
