/**
 * AI Gateway Service — SINGLE source of truth for all AI provider access.
 *
 * Every AI feature in Preecode (chat, hints, reviews, questions, interviews,
 * resume analysis, security analysis, extension actions) MUST route through
 * this service. No other file may call any AI provider directly.
 *
 * Providers (tried in order):
 *   1. z.ai (Zhipu GLM) — primary. OpenAI-compatible.
 *      Env: ZAI_API_KEY (required), ZAI_BASE_URL, ZAI_MODEL, ZAI_FALLBACK_MODEL
 *   2. NVIDIA NIM — fallback. OpenAI-compatible.
 *      Env: NVIDIA_API_KEY (required), NVIDIA_BASE_URL, NVIDIA_MODEL,
 *           NVIDIA_FALLBACK_MODEL
 *
 * To switch models in the future:
 *   Change the ZAI_* / NVIDIA_* env vars. No code changes needed.
 *
 * Architecture:
 *   Website / Extension → Backend API → aiGatewayService → z.ai → NVIDIA NIM
 */

const DEFAULT_ZAI_BASE_URL = 'https://api.z.ai/api/paas/v4';
const DEFAULT_ZAI_MODEL = 'glm-4.7-flash';
const DEFAULT_ZAI_FALLBACK_MODEL = 'glm-4.5-flash';

const DEFAULT_NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_NVIDIA_MODEL = 'deepseek-ai/deepseek-v4.1-flash';
const DEFAULT_NVIDIA_FALLBACK_MODEL = 'nvidia/llama-3.1-nemotron-70b-instruct';

// ─── Provider Configuration ──────────────────────────────────────────────────

function splitKeys(value) {
  return String(value || '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((item) => {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function buildProviders() {
  const providers = [];

  const zaiKeys = splitKeys(process.env.ZAI_API_KEY);
  if (zaiKeys.length > 0) {
    providers.push({
      id: 'zai',
      label: 'z.ai (Zhipu GLM)',
      baseUrl: String(process.env.ZAI_BASE_URL || DEFAULT_ZAI_BASE_URL).trim() || DEFAULT_ZAI_BASE_URL,
      keys: zaiKeys,
      keyIndex: 0,
      models: dedupe([
        String(process.env.ZAI_MODEL || DEFAULT_ZAI_MODEL).trim() || DEFAULT_ZAI_MODEL,
        String(process.env.ZAI_FALLBACK_MODEL || DEFAULT_ZAI_FALLBACK_MODEL).trim() || DEFAULT_ZAI_FALLBACK_MODEL,
      ]),
    });
  }

  const nvidiaKeys = splitKeys(process.env.NVIDIA_API_KEY);
  if (nvidiaKeys.length > 0) {
    providers.push({
      id: 'nvidia',
      label: 'NVIDIA NIM',
      baseUrl:
        String(process.env.NVIDIA_BASE_URL || DEFAULT_NVIDIA_BASE_URL).trim() || DEFAULT_NVIDIA_BASE_URL,
      keys: nvidiaKeys,
      keyIndex: 0,
      models: dedupe([
        String(process.env.NVIDIA_MODEL || DEFAULT_NVIDIA_MODEL).trim() || DEFAULT_NVIDIA_MODEL,
        String(process.env.NVIDIA_FALLBACK_MODEL || DEFAULT_NVIDIA_FALLBACK_MODEL).trim() ||
          DEFAULT_NVIDIA_FALLBACK_MODEL,
      ]),
    });
  }

  return providers;
}

let _providers = null;
function getProviders() {
  if (!_providers) {
    _providers = buildProviders();
  }
  return _providers;
}

function getProviderKey(provider) {
  if (!provider.keys.length) return '';
  return provider.keys[provider.keyIndex % provider.keys.length];
}

function rotateProviderKey(provider) {
  if (provider.keys.length > 1) {
    provider.keyIndex = (provider.keyIndex + 1) % provider.keys.length;
  }
}

// ─── Operational Configuration ───────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [800, 2000, 4000];
const REQUEST_TIMEOUT_MS = 45000; // 45s — free-tier models can be slow
const MIN_REQUEST_SPACING_MS = 200;

let lastRequestAtMs = 0;
let startupLogged = false;

// ─── Startup Diagnostics ─────────────────────────────────────────────────────
function logStartupDiagnostics() {
  if (startupLogged) return;
  startupLogged = true;

  const providers = getProviders();

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         AI GATEWAY SERVICE — Startup Diagnostics          ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  if (providers.length === 0) {
    console.log('║  Providers        │ NONE — AI features will fail            ║');
  }
  providers.forEach((p, i) => {
    const role = i === 0 ? 'PRIMARY ' : 'FALLBACK';
    console.log(`║  ${role} │ ${p.label} (${p.models.join(', ')})`);
    console.log(`║           │ ${p.baseUrl}  keys=${p.keys.length}`);
  });
  console.log(`║  Max Retries      │ ${MAX_RETRIES}                              ║`);
  console.log(`║  Request Timeout  │ ${REQUEST_TIMEOUT_MS}ms                         ║`);
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  if (providers.length === 0) {
    console.warn('[ai-gateway] ⚠️  No AI provider keys configured.');
    console.warn('[ai-gateway] ⚠️  Set ZAI_API_KEY (primary) and/or NVIDIA_API_KEY (fallback).');
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
    if (
      !message ||
      typeof message.role !== 'string' ||
      !message.role.trim() ||
      typeof message.content !== 'string' ||
      !message.content.trim()
    ) {
      const err = new Error('Invalid payload: each message must include role and content.');
      err.statusCode = 400;
      err.code = 'INVALID_PAYLOAD';
      throw err;
    }
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
// This is the ONLY function that makes HTTP requests to AI providers.
// All AI features must eventually call this function.

/**
 * Makes an AI request through the gateway.
 * Tries z.ai models first, then falls back to NVIDIA NIM models.
 *
 * @param {Array} messages - Array of { role, content } message objects
 * @param {Object} [options]
 * @param {number} [options.temperature=0.7]
 * @param {number} [options.maxTokens=512]
 * @param {string} [options.feature='unknown'] - Feature name for diagnostics
 * @returns {Promise<{content: string, model: string, provider: string, raw: Object}>}
 */
async function callAI(messages, options = {}) {
  logStartupDiagnostics();

  const startTime = Date.now();
  const feature = options.feature || 'unknown';
  const providers = getProviders();

  if (providers.length === 0) {
    const err = new Error(
      'AI is not configured. Set ZAI_API_KEY (primary) and/or NVIDIA_API_KEY (fallback) in backend environment variables.'
    );
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

  // Try each provider in order (z.ai first, then NVIDIA), each model in order.
  for (const provider of providers) {
    const apiKey = getProviderKey(provider);
    if (!apiKey) continue;

    const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    for (const model of provider.models) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        const attemptNumber = attempt + 1;
        const payload = {
          model,
          messages,
          temperature: config.temperature,
          max_tokens: config.max_tokens,
        };
        if (provider.id === 'zai') {
          // GLM flash models "think" by default and burn every token on
          // reasoning_content, leaving message.content empty. Disable thinking
          // so the answer lands in content (verified live 2026-09-25).
          payload.thinking = { type: 'disabled' };
        }

        try {
          await applyRateLimitDelay();

          const response = await fetchWithTimeout(
            url,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${getProviderKey(provider)}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            },
            REQUEST_TIMEOUT_MS
          );

          const rawBody = await response.text();
          const parsedBody = parseJsonSafely(rawBody);

          if (!response.ok) {
            const providerMessage =
              parsedBody?.error?.message || `${provider.label} HTTP ${response.status}`;
            const skipImmediately = response.status === 402 || response.status === 404;
            const isRateLimit =
              response.status === 429 ||
              providerMessage.includes('Rate limit exceeded') ||
              providerMessage.includes('rate_limit');
            const retryable =
              !skipImmediately &&
              (response.status === 429 || response.status >= 500 || response.status === 408);

            if (isRateLimit) {
              rotateProviderKey(provider);
              if (attempt < MAX_RETRIES) {
                await sleep(500);
                continue;
              }
            }

            errors.push({
              provider: provider.id,
              model,
              attempt: attemptNumber,
              status: response.status,
              message: providerMessage,
            });

            if (skipImmediately) break;
            if (retryable && attempt < MAX_RETRIES) {
              await sleep(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
              continue;
            }
            break;
          }

          const content = parsedBody?.choices?.[0]?.message?.content;

          if (!content || typeof content !== 'string') {
            errors.push({
              provider: provider.id,
              model,
              attempt: attemptNumber,
              status: response.status,
              message: 'Empty content',
            });
            break;
          }

          const latency = Date.now() - startTime;
          console.log(
            `[ai-gateway] ✅ Feature=${feature} Provider=${provider.id} Model=${model} Attempt=${attemptNumber} Latency=${latency}ms`
          );

          return { content, model, provider: provider.id, raw: parsedBody };
        } catch (error) {
          const isTimeout = error && error.name === 'AbortError';
          const retryable =
            isTimeout || (error && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT'));

          errors.push({
            provider: provider.id,
            model,
            attempt: attemptNumber,
            message: isTimeout ? 'Request timed out.' : error?.message || 'Network error',
          });

          if (retryable && attempt < MAX_RETRIES) {
            await sleep(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[attempt - 1] || 1000);
            continue;
          }
          break;
        }
      }
    }
  }

  const lastError = errors[errors.length - 1] || {};
  const latency = Date.now() - startTime;
  const errorSummary = errors
    .map((e) => `[${e.provider}/${e.model} attempt ${e.attempt}]: ${e.message}`)
    .join(' | ');

  console.error(`[ai-gateway] ❌ Feature=${feature} Failed=${errors.length} attempts Latency=${latency}ms`);

  const err = new Error(
    `AI request failed across all providers. Last error: ${lastError.message || 'Unknown'}. Full trace: ${errorSummary}`
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
  const providers = getProviders();
  return {
    providers: providers.map((p) => ({
      id: p.id,
      label: p.label,
      endpoint: p.baseUrl,
      models: p.models,
      keyConfigured: p.keys.length > 0,
      keyCount: p.keys.length,
    })),
    primaryProvider: providers[0]?.id || 'none',
    primaryModel: providers[0]?.models[0] || 'none',
    providerCount: providers.length,
    keyConfigured: providers.length > 0,
    maxRetries: MAX_RETRIES,
    timeoutMs: REQUEST_TIMEOUT_MS,
    status: providers.length > 0 ? 'ready' : 'misconfigured',
  };
}

module.exports = {
  callAI,
  getStatus,
};
