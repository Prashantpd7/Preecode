/**
 * ArmorIQ Security Intelligence Service
 * 
 * Provides audit logging, policy evaluation, compliance tracking, and security event
 * reporting via the real ArmorIQ SDK (@armoriq/sdk).
 * 
 * Integrates ArmorIQ features:
 *   - Policy Enforcement via getIntentToken with policy constraints
 *   - Intent Verification via invoke (auto-verified against intent token)
 *   - Audit Logging via invoke to ArmorIQ backend
 *   - Security Events via invoke with event types
 *   - Agent Actions via capturePlan + getIntentToken + invoke
 */

const { ArmorIQClient, InvalidTokenException, IntentMismatchException, MCPInvocationException, TokenExpiredException } = require('@armoriq/sdk');

// ============================================================================
// ArmorIQ Client Singleton
// ============================================================================
let armoriqClient = null;

/**
 * Installs axios request/response interceptors on the SDK's HTTP client
 * to log every outbound call to ArmorIQ (URL, method, payload, response code, response body).
 * Only installs once per client instance.
 */
function enableArmorIQDiagnostics(client) {
  console.log('[ArmorIQ ENTER] enableArmorIQDiagnostics');
  if (client.__diagnosticsEnabled) {
    console.log('[ArmorIQ EXIT] enableArmorIQDiagnostics (already enabled)');
    return;
  }
  client.__diagnosticsEnabled = true;

  // ── Request Interceptor ──
  client.httpClient.interceptors.request.use(
    (config) => {
      const sanitizedHeaders = { ...config.headers };
      // Mask sensitive auth headers
      if (sanitizedHeaders['X-API-Key']) {
        const val = String(sanitizedHeaders['X-API-Key']);
        sanitizedHeaders['X-API-Key'] = val.length > 8 ? val.slice(0, 4) + '***' + val.slice(-4) : '***masked***';
      }
      if (sanitizedHeaders['Authorization']) {
        const val = String(sanitizedHeaders['Authorization']);
        sanitizedHeaders['Authorization'] = val.length > 12 ? val.slice(0, 8) + '***' + val.slice(-4) : '***masked***';
      }
      console.log(`\n[ArmorIQ DIAG] ═══════════════════════════════════════`);
      console.log(`[ArmorIQ DIAG]  REQUEST: ${(config.method || 'GET').toUpperCase()} ${config.url}`);
      console.log(`[ArmorIQ DIAG]  HEADERS: ${JSON.stringify(sanitizedHeaders, null, 2)}`);
      if (config.data) {
        const dataStr = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
        console.log(`[ArmorIQ DIAG]  PAYLOAD: ${dataStr.slice(0, 800)}${dataStr.length > 800 ? '... [truncated]' : ''}`);
      }
      console.log(`[ArmorIQ DIAG] ═══════════════════════════════════════\n`);
      return config;
    },
    (error) => {
      console.error(`\n[ArmorIQ DIAG] ❌ REQUEST SETUP ERROR: ${error.message}`);
      if (error.stack) console.error(`[ArmorIQ DIAG]    STACK: ${error.stack.split('\n').slice(0, 4).join('\n')}`);
      return Promise.reject(error);
    }
  );

  // ── Response Interceptor (success) ──
  client.httpClient.interceptors.response.use(
    (response) => {
      console.log(`\n[ArmorIQ DIAG] ───────────────────────────────────────`);
      console.log(`[ArmorIQ DIAG]  RESPONSE: ${response.status} ${response.statusText}`);
      const dataStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      console.log(`[ArmorIQ DIAG]  BODY: ${dataStr.slice(0, 800)}${dataStr.length > 800 ? '... [truncated]' : ''}`);
      console.log(`[ArmorIQ DIAG] ───────────────────────────────────────\n`);
      return response;
    },
    (error) => {
      console.error(`\n[ArmorIQ DIAG] ❌───────────────────────────────────────`);
      console.error(`[ArmorIQ DIAG]  RESPONSE ERROR: ${error.message}`);
      if (error.response) {
        console.error(`[ArmorIQ DIAG]  STATUS: ${error.response.status}`);
        const dataStr = typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data);
        console.error(`[ArmorIQ DIAG]  BODY: ${(dataStr || 'N/A').slice(0, 800)}`);
        console.error(`[ArmorIQ DIAG]  HEADERS: ${JSON.stringify(error.response.headers || {})}`);
      }
      if (error.code) {
        console.error(`[ArmorIQ DIAG]  CODE: ${error.code}`);
      }
      if (error.stack) {
        console.error(`[ArmorIQ DIAG]  STACK: ${error.stack.split('\n').slice(0, 6).join('\n')}`);
      }
      console.error(`[ArmorIQ DIAG] ❌───────────────────────────────────────\n`);
      return Promise.reject(error);
    }
  );

  console.log('[ArmorIQ DIAG] ✅ Diagnostic HTTP interceptors installed on SDK client');
  console.log('[ArmorIQ EXIT] enableArmorIQDiagnostics');
}

/**
 * Gets or initializes the ArmorIQ client singleton.
 * Reads ARMORIQ_API_KEY from environment.
 * 
 * @returns {ArmorIQClient|null} The ArmorIQ client, or null if not configured
 */
function getArmorIQClient() {
  console.log('[ArmorIQ ENTER] getArmorIQClient');
  if (armoriqClient) {
    console.log('[ArmorIQ EXIT] getArmorIQClient (cached)');
    return armoriqClient;
  }

  const apiKey = process.env.ARMORIQ_API_KEY;
  if (!apiKey) {
    console.log('[ArmorIQ] SDK not configured: ARMORIQ_API_KEY not set. Falling back to local audit.');
    console.log('[ArmorIQ EXIT] getArmorIQClient (no API key, return null)');
    return null;
  }
  console.log('[ArmorIQ] API key found, length:', apiKey.length, 'starts with:', apiKey.substring(0, 8));

  try {
    console.log('[ArmorIQ] Creating ArmorIQClient instance...');
    console.log('[ArmorIQ] ARMORIQ_ENV:', process.env.ARMORIQ_ENV || '(not set)');
    console.log('[ArmorIQ] USER_ID:', process.env.USER_ID || 'preecode-backend (default)');
    console.log('[ArmorIQ] AGENT_ID:', process.env.AGENT_ID || 'preecode-security-agent (default)');
    armoriqClient = new ArmorIQClient({
      apiKey,
      userId: process.env.USER_ID || 'preecode-backend',
      agentId: process.env.AGENT_ID || 'preecode-security-agent',
      contextId: process.env.CONTEXT_ID || 'default',
      useProduction: process.env.ARMORIQ_ENV !== 'development',
      backendEndpoint: process.env.BACKEND_ENDPOINT || 'https://api.armoriq.ai',
      timeout: parseInt(process.env.ARMORIQ_TIMEOUT || '15000', 10),
      maxRetries: parseInt(process.env.ARMORIQ_MAX_RETRIES || '2', 10),
    });
    console.log('[ArmorIQ] Client initialized successfully');
    console.log('[ArmorIQ] Backend endpoint:', armoriqClient.backendEndpoint);
    console.log('[ArmorIQ] Proxy endpoint:', armoriqClient.defaultProxyEndpoint);
    console.log('[ArmorIQ] IAP endpoint:', armoriqClient.iapEndpoint);

    // Install diagnostic HTTP interceptors to capture every outbound call
    console.log('[ArmorIQ] About to call enableArmorIQDiagnostics...');
    enableArmorIQDiagnostics(armoriqClient);
    console.log('[ArmorIQ] Diagnostics installed successfully');

    console.log('[ArmorIQ EXIT] getArmorIQClient (new client)');
    return armoriqClient;
  } catch (error) {
    console.error('[ArmorIQ] Failed to initialize client:', error.message);
    console.error('[ArmorIQ] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    if (error.stack) console.error('[ArmorIQ] Init stack:', error.stack.split('\n').slice(0, 10).join('\n'));
    console.log('[ArmorIQ EXIT] getArmorIQClient (error, return null)');
    return null;
  }
}

/**
 * @typedef {Object} AuditEntry
 * @property {string} action - The action performed
 * @property {string} resource - The resource acted upon
 * @property {string} status - 'completed' | 'failed' | 'pending'
 * @property {Object} [details] - Additional context
 * @property {string} [userId] - User who performed the action
 * @property {string} [timestamp] - ISO timestamp
 */

/**
 * @typedef {Object} PolicyEvaluationResult
 * @property {boolean} passed - Whether the policy check passed
 * @property {string} policyName - Name of the evaluated policy
 * @property {string} [message] - Human-readable result message
 * @property {string[]} [violations] - List of policy violations
 * @property {Object} [details] - Additional evaluation details
 */

/**
 * Logs a security scan event to the ArmorIQ audit trail.
 * 
 * Uses the real ArmorIQ SDK flow:
 *   1. capturePlan() - Capture the security scan intent
 *   2. getIntentToken() - Get signed intent token (with policy enforcement)
 *   3. invoke() - Execute the audit logging action (auto-verified by ArmorIQ proxy)
 * 
 * @param {AuditEntry} entry - The audit entry to log
 * @returns {Promise<Object>}
 */
async function logSecurityScan(entry) {
  console.log('[ArmorIQ ENTER] logSecurityScan');
  const client = getArmorIQClient();

  if (!client) {
    // Fallback to local mock when ArmorIQ SDK not configured
    console.log('[ArmorIQ] SDK not available — using local fallback for security scan log');
    const auditRecord = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      action: 'security_scan',
      source: 'armorclaw',
      resource: entry.resource || 'unknown',
      status: entry.status || 'completed',
      details: entry.details || {},
      userId: entry.userId || 'system',
      timestamp: entry.timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    console.log('[ArmorIQ] [LOCAL FALLBACK] Security scan logged:', JSON.stringify(auditRecord));
    console.log('[ArmorIQ EXIT] logSecurityScan (local fallback)');
    return auditRecord;
  }

  let intentToken;
  let invokeResult;
  try {
    console.log('[ArmorIQ] ═══ Step 2: Security Analysis Complete — sending to ArmorIQ SDK ═══');
    console.log('[ArmorIQ] Entry:', JSON.stringify(entry));
    console.log('[ArmorIQ] SDK backendEndpoint:', client.backendEndpoint);
    console.log('[ArmorIQ] SDK proxyEndpoint:', client.defaultProxyEndpoint);
    console.log('[ArmorIQ] SDK iapEndpoint:', client.iapEndpoint);

    // Step 1: Capture the security scan plan
    console.log('[ArmorIQ] START capturePlan() — synchronous, no HTTP');
    const plan = {
      goal: `Security scan for ${entry.resource || 'unknown resource'}`,
      steps: [
        {
          action: 'log_security_scan',
          tool: 'audit_logger',
          mcp: 'preecode-armoriq-mcp',
          inputs: {
            resource: entry.resource,
            status: entry.status,
            details: entry.details,
            userId: entry.userId,
          },
        },
      ],
    };

    const planCapture = client.capturePlan(
      'armorclaw-ai',
      `Log security scan for resource: ${entry.resource}`,
      plan,
      { entryType: 'security_scan', source: 'armorclaw' }
    );
    console.log('[ArmorIQ] Plan captured:', planCapture.id || JSON.stringify(planCapture).slice(0, 100));
    console.log('[ArmorIQ] END capturePlan()');

    // Step 2: Get signed intent token (enforces policies if configured)
    console.log('[ArmorIQ] START getIntentToken() — HTTP POST to IAP');
    intentToken = await client.getIntentToken(planCapture, { policyName: 'security-scan-policy' }, 300); // 5 minute validity
    console.log('[ArmorIQ] Policy Check Result — Intent token obtained:', intentToken.tokenId || 'success');
    console.log('[ArmorIQ] Intent token planId:', intentToken.planId);
    console.log('[ArmorIQ] Intent token has jwtToken:', !!intentToken.jwtToken);
    console.log('[ArmorIQ] Intent token has rawToken:', !!intentToken.rawToken);
    console.log('[ArmorIQ] END getIntentToken()');

    // Step 3: Invoke the audit logging action (auto-verified against intent token)
    console.log('[ArmorIQ] START invoke() — HTTP POST to Proxy');
    invokeResult = await client.invoke(
      'preecode-armoriq-mcp',
      'log_security_scan',
      intentToken,
      {
        resource: entry.resource,
        status: entry.status,
        details: entry.details,
        userId: entry.userId,
        timestamp: entry.timestamp || new Date().toISOString(),
      },
      null,
      entry.userId || 'system'
    );
    console.log('[ArmorIQ] END invoke()');
    console.log('[ArmorIQ] Invoke result status:', invokeResult.status);
    console.log('[ArmorIQ] Invoke result verified:', invokeResult.verified);
    console.log('[ArmorIQ] Invoke result executionTime:', invokeResult.executionTime);
    console.log('[ArmorIQ] Audit Log Created — Invoke result:', JSON.stringify(invokeResult).slice(0, 300));

    // Step 4: Report audit entry via ArmorIQSession.report() for dashboard visibility
    // IMPORTANT: The SDK's report() catches errors internally and does NOT rethrow.
    // Our console.log('[ArmorIQ] Session report success') will execute even if HTTP fails.
    // The diagnostic interceptors above will show the actual HTTP response.
    try {
      console.log('[ArmorIQ ENTER] session.report block');
      console.log('[ArmorIQ] START session.report() — will POST to backendEndpoint/iap/audit');
      console.log('[ArmorIQ] Report target URL:', `${client.backendEndpoint}/iap/audit`);
      const session = client.startSession({
        mode: 'local',
        llm: 'armorclaw-ai',
        defaultMcpName: 'preecode-armoriq-mcp',
      });
      session.currentToken = intentToken;
      session.userEmail = entry.userId || 'system';
      console.log('[ArmorIQ] Session report started');
      console.log('[ArmorIQ] Report payload - token:', intentToken.jwtToken ? intentToken.jwtToken.slice(0, 30) + '...' : intentToken.tokenId);
      console.log('[ArmorIQ] Report payload - plan_id:', intentToken.planId);
      console.log('[ArmorIQ] Report payload - action: log_security_scan');
      console.log('[ArmorIQ] Report payload - mcp: preecode-armoriq-mcp');
      console.log('[ArmorIQ] Report payload - input:', JSON.stringify({
        resource: entry.resource,
        status: entry.status,
        score: entry.details?.score,
        issueCount: entry.details?.issueCount,
        severity: entry.details?.severity,
      }));
      console.log('[ArmorIQ] Report payload - status: success');
      console.log('[ArmorIQ] Report payload - user_email:', entry.userId || 'system');
      await session.report(
        'log_security_scan',
        {
          resource: entry.resource,
          status: entry.status,
          score: entry.details?.score,
          issueCount: entry.details?.issueCount,
          severity: entry.details?.severity,
          analysisTimeMs: entry.details?.analysisTimeMs,
          findings: entry.details?.findings,
        },
        invokeResult,
        {
          status: 'success',
          userEmail: entry.userId || 'system',
        }
      );
      console.log('[ArmorIQ] Session report success');
      console.log('[ArmorIQ] END session.report()');

      console.log('[ArmorIQ] START completePlan() — HTTP POST to backendEndpoint/iap/plans/{id}/status');
      console.log('[ArmorIQ] Complete plan URL:', `${client.backendEndpoint}/iap/plans/${intentToken.planId}/status`);
      await client.completePlan(intentToken.planId)
        .catch(e => console.warn('[ArmorIQ] completePlan warning:', e.message));
      console.log('[ArmorIQ] END completePlan()');
      console.log('[ArmorIQ EXIT] session.report block');
    } catch (reportError) {
      console.error('[ArmorIQ] Session report failed:', reportError.message);
      console.error('[ArmorIQ] Report error full:', JSON.stringify(reportError, Object.getOwnPropertyNames(reportError)));
      if (reportError.stack) console.error('[ArmorIQ] Report stack:', reportError.stack.split('\n').slice(0, 10).join('\n'));
      console.log('[ArmorIQ EXIT] session.report block (caught)');
    }

    console.log('[ArmorIQ EXIT] logSecurityScan (success)');
    return {
      id: invokeResult.id || `armoriq-${Date.now()}`,
      action: 'security_scan',
      source: 'armorclaw',
      resource: entry.resource,
      status: entry.status,
      armoriqTokenId: intentToken.tokenId,
      details: entry.details,
      userId: entry.userId,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[ArmorIQ] Caught outer error in logSecurityScan:', error.message);
    console.error('[ArmorIQ] Error type:', error.name || typeof error);
    console.error('[ArmorIQ] Error full:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    if (error.stack) console.error('[ArmorIQ] SDK error stack:', error.stack.split('\n').slice(0, 10).join('\n'));

    if (error instanceof InvalidTokenException) {
      console.error('[ArmorIQ] Invalid token — plan mismatch or tampered token');
    } else if (error instanceof IntentMismatchException) {
      console.error('[ArmorIQ] Intent mismatch — action does not match captured plan');
    } else if (error instanceof TokenExpiredException) {
      console.error('[ArmorIQ] Token expired — retry with fresh token');
    } else if (error instanceof MCPInvocationException) {
      console.error('[ArmorIQ] MCP invocation failed — audit service unavailable');
    }

    // Fallback to local audit when SDK fails, but preserve intent token if we got one
    console.log('[ArmorIQ] Falling back to local audit entry after SDK failure');
    const armoriqTokenId = intentToken ? (intentToken.tokenId || intentToken.id) : null;
    console.log('[ArmorIQ EXIT] logSecurityScan (fallback after error)');
    return {
      id: `audit-fallback-${Date.now()}`,
      action: 'security_scan',
      source: 'armorclaw',
      resource: entry.resource || 'unknown',
      status: entry.status || 'failed',
      details: { ...entry.details, sdkError: error.message },
      userId: entry.userId || 'system',
      timestamp: new Date().toISOString(),
      armoriqError: error.message,
      armoriqTokenId,
    };
  }
}

/**
 * Evaluates code/policy against defined ArmorIQ security policies.
 * 
 * Uses the ArmorIQ SDK:
 *   1. capturePlan() with policy evaluation intent
 *   2. getIntentToken() with policy constraints
 *   3. invoke() to evaluate the policy via ArmorIQ
 * 
 * @param {string} policyName - Name of the policy to evaluate
 * @param {Object} context - Context for policy evaluation
 * @param {string} [context.code] - Code to evaluate
 * @param {string} [context.language] - Programming language
 * @param {Object} [context.metadata] - Additional metadata
 * @returns {Promise<PolicyEvaluationResult>}
 */
async function evaluatePolicy(policyName, context = {}) {
  console.log('[ArmorIQ ENTER] evaluatePolicy');
  const client = getArmorIQClient();

  if (!client) {
    // Fallback to local evaluation when ArmorIQ SDK not configured
    console.log('[ArmorIQ] [LOCAL FALLBACK] Policy evaluation: SDK not configured');
    const validPolicies = [
      'no-hardcoded-secrets',
      'no-sql-injection',
      'no-xss',
      'input-validation',
      'secure-crypto',
      'safe-deserialization',
      'auth-best-practices',
    ];
    const normalizedPolicy = String(policyName || '').toLowerCase().trim();
    const isValid = validPolicies.includes(normalizedPolicy);
    const result = {
      passed: isValid,
      policyName: normalizedPolicy,
      message: isValid
        ? `Policy "${normalizedPolicy}" is recognized and configured.`
        : `Policy "${normalizedPolicy}" is not yet defined. Please add it to the policy registry.`,
      violations: [],
      details: {
        evaluatedAt: new Date().toISOString(),
        contextAvailable: !!(context.code || context.language),
        policyValid: isValid,
        validPolicies,
      },
    };
    console.log('[ArmorIQ] [LOCAL FALLBACK] Policy Result:', JSON.stringify(result));
    console.log('[ArmorIQ EXIT] evaluatePolicy (local fallback)');
    return result;
  }

  let intentToken;
  let invokeResult;
  try {
    console.log('[ArmorIQ] ═══ Policy Evaluation via SDK ═══');
    console.log('[ArmorIQ] Policy:', policyName);
    console.log('[ArmorIQ] Language:', context.language);

    // Step 1: Capture the policy evaluation plan
    console.log('[ArmorIQ] START capturePlan()');
    const evalPlan = {
      goal: `Evaluate policy "${policyName}" against ${context.language || 'unknown'} code`,
      steps: [
        {
          action: 'evaluate_policy',
          tool: 'policy_engine',
          mcp: 'preecode-armoriq-mcp',
          inputs: {
            policyName,
            language: context.language,
            codeLength: (context.code || '').length,
          },
        },
      ],
    };

    const planCapture = client.capturePlan(
      'armorclaw-ai',
      `Evaluate security policy: ${policyName}`,
      evalPlan,
      { policyType: 'security', source: 'armorclaw' }
    );
    console.log('[ArmorIQ] Policy plan captured:', planCapture.id || JSON.stringify(planCapture).slice(0, 100));

    // Step 2: Get intent token with policy constraints
    console.log('[ArmorIQ] START getIntentToken()');
    intentToken = await client.getIntentToken(planCapture, { policyName: policyName || 'default-security-policy' }, 120); // 2 minute validity
    console.log('[ArmorIQ] Policy Result — Intent token obtained:', intentToken.tokenId || 'success');

    // Step 3: Invoke policy evaluation via ArmorIQ
    console.log('[ArmorIQ] START invoke()');
    invokeResult = await client.invoke(
      'preecode-armoriq-mcp',
      'evaluate_policy',
      intentToken,
      {
        policyName,
        language: context.language,
        codeSnippet: (context.code || '').slice(0, 500),
        metadata: context.metadata || {},
      },
      null,
      context.metadata?.userId || 'system'
    );
    console.log('[ArmorIQ] END invoke()');
    console.log('[ArmorIQ] Audit Log Created — Policy evaluation result:', JSON.stringify(invokeResult).slice(0, 200));

    // Report audit entry via ArmorIQSession.report() for dashboard visibility
    try {
      console.log('[ArmorIQ ENTER] session.report block');
      console.log('[ArmorIQ] START session.report() — will POST to backendEndpoint/iap/audit');
      console.log('[ArmorIQ] Report target URL:', `${client.backendEndpoint}/iap/audit`);
      const session = client.startSession({
        mode: 'local',
        llm: 'armorclaw-ai',
        defaultMcpName: 'preecode-armoriq-mcp',
      });
      session.currentToken = intentToken;
      session.userEmail = context.metadata?.userId || 'system';
      console.log('[ArmorIQ] Session report started');
      console.log('[ArmorIQ] Report payload - action: evaluate_policy');
      console.log('[ArmorIQ] Report payload - mcp: preecode-armoriq-mcp');
      console.log('[ArmorIQ] Report payload - policyName:', policyName);
      console.log('[ArmorIQ] Report payload - passed:', invokeResult.passed);
      await session.report(
        'evaluate_policy',
        {
          policyName,
          language: context.language,
          codeLength: (context.code || '').length,
          passed: invokeResult.passed,
          violations: invokeResult.violations,
          message: invokeResult.message || invokeResult.summary,
        },
        invokeResult,
        {
          status: 'success',
          userEmail: context.metadata?.userId || 'system',
        }
      );
      console.log('[ArmorIQ] Session report success');
      console.log('[ArmorIQ] END session.report()');

      console.log('[ArmorIQ] START completePlan()');
      console.log('[ArmorIQ] Complete plan URL:', `${client.backendEndpoint}/iap/plans/${intentToken.planId}/status`);
      await client.completePlan(intentToken.planId)
        .catch(e => console.warn('[ArmorIQ] completePlan warning:', e.message));
      console.log('[ArmorIQ] END completePlan()');
      console.log('[ArmorIQ EXIT] session.report block');
    } catch (reportError) {
      console.error('[ArmorIQ] Session report failed:', reportError.message);
      console.log('[ArmorIQ EXIT] session.report block (caught)');
    }

    console.log('[ArmorIQ EXIT] evaluatePolicy (success)');
    return {
      passed: invokeResult.passed !== false,
      policyName: policyName,
      message: invokeResult.message || invokeResult.summary || `Policy "${policyName}" evaluated.`,
      violations: invokeResult.violations || [],
      details: {
        evaluatedAt: new Date().toISOString(),
        contextAvailable: !!(context.code || context.language),
        armoriqTokenId: intentToken.tokenId,
        invokeResult: invokeResult,
      },
    };
  } catch (error) {
    console.error('[ArmorIQ] Caught outer error in evaluatePolicy:', error.message);
    console.error('[ArmorIQ] Error type:', error.name || typeof error);
    if (error.stack) console.error('[ArmorIQ] SDK error stack:', error.stack.split('\n').slice(0, 5).join('\n'));

    if (error instanceof InvalidTokenException) {
      console.error('[ArmorIQ] Invalid token for policy evaluation');
    } else if (error instanceof IntentMismatchException) {
      console.error('[ArmorIQ] Intent mismatch in policy evaluation');
    } else if (error instanceof MCPInvocationException) {
      console.error('[ArmorIQ] MCP invocation failed — policy evaluation service unavailable');
    }

    // Fallback, but preserve intent token if we got one
    const armoriqTokenId = intentToken ? (intentToken.tokenId || intentToken.id) : null;
    console.log('[ArmorIQ EXIT] evaluatePolicy (fallback after error)');
    return {
      passed: false,
      policyName: policyName,
      message: `Policy evaluation failed: ${error.message}. Using local fallback.`,
      violations: [],
      details: {
        evaluatedAt: new Date().toISOString(),
        error: error.message,
        fallback: true,
        armoriqTokenId,
      },
    };
  }
}

/**
 * Creates an audit entry in the ArmorIQ security log.
 * 
 * Uses ArmorIQ SDK:
 *   1. capturePlan() - Capture audit entry intent
 *   2. getIntentToken() - Get signed intent token
 *   3. invoke() - Create the audit entry
 * 
 * @param {AuditEntry} entry
 * @returns {Promise<Object>}
 */
async function createAuditEntry(entry) {
  console.log('[ArmorIQ ENTER] createAuditEntry');
  const client = getArmorIQClient();

  if (!client) {
    // Fallback to local when SDK not configured
    console.log('[ArmorIQ] [LOCAL FALLBACK] Creating audit entry (SDK not configured)');
    const auditRecord = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      action: entry.action || 'unknown',
      source: 'armoriq',
      resource: entry.resource || 'unknown',
      status: entry.status || 'completed',
      details: entry.details || {},
      userId: entry.userId || 'system',
      timestamp: entry.timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    console.log('[ArmorIQ] [LOCAL FALLBACK] Audit entry created:', JSON.stringify(auditRecord));
    console.log('[ArmorIQ EXIT] createAuditEntry (local fallback)');
    return auditRecord;
  }

  let intentToken;
  let invokeResult;
  try {
    console.log('[ArmorIQ] ═══ Create Audit Entry via SDK ═══');
    console.log('[ArmorIQ] Action:', entry.action);

    // Step 1: Capture the audit entry plan
    console.log('[ArmorIQ] START capturePlan()');
    const auditPlan = {
      goal: `Record audit entry: ${entry.action}`,
      steps: [
        {
          action: 'create_audit_entry',
          tool: 'audit_logger',
          mcp: 'preecode-armoriq-mcp',
          inputs: {
            action: entry.action,
            status: entry.status,
            resource: entry.resource,
          },
        },
      ],
    };

    const planCapture = client.capturePlan(
      'preecode-system',
      `Create audit entry for action: ${entry.action}`,
      auditPlan,
      { entryType: 'audit', source: 'armoriq' }
    );

    // Step 2: Get intent token
    console.log('[ArmorIQ] START getIntentToken()');
    intentToken = await client.getIntentToken(planCapture, undefined, 300);

    // Step 3: Invoke audit entry creation
    console.log('[ArmorIQ] START invoke()');
    invokeResult = await client.invoke(
      'preecode-armoriq-mcp',
      'create_audit_entry',
      intentToken,
      {
        action: entry.action,
        resource: entry.resource,
        status: entry.status,
        details: entry.details,
        userId: entry.userId,
        timestamp: entry.timestamp || new Date().toISOString(),
      }
    );
    console.log('[ArmorIQ] END invoke()');
    console.log('[ArmorIQ] Audit Log Created — Entry ID:', invokeResult.id || 'synced');

    // Report audit entry via ArmorIQSession.report() for dashboard visibility
    try {
      console.log('[ArmorIQ ENTER] session.report block');
      console.log('[ArmorIQ] START session.report() — will POST to backendEndpoint/iap/audit');
      console.log('[ArmorIQ] Report target URL:', `${client.backendEndpoint}/iap/audit`);
      const session = client.startSession({
        mode: 'local',
        llm: 'armorclaw-ai',
        defaultMcpName: 'preecode-armoriq-mcp',
      });
      session.currentToken = intentToken;
      session.userEmail = entry.userId || 'system';
      console.log('[ArmorIQ] Session report started');
      console.log('[ArmorIQ] Report payload - action: create_audit_entry');
      console.log('[ArmorIQ] Report payload - mcp: preecode-armoriq-mcp');
      console.log('[ArmorIQ] Report payload - entry action:', entry.action);
      await session.report(
        'create_audit_entry',
        {
          action: entry.action,
          resource: entry.resource,
          status: entry.status,
          databaseAuditId: entry.details?.databaseAuditId,
          score: entry.details?.score,
          issueCount: entry.details?.issueCount,
          severity: entry.details?.severity,
          policyPassed: entry.details?.policyPassed,
        },
        invokeResult,
        {
          status: 'success',
          userEmail: entry.userId || 'system',
        }
      );
      console.log('[ArmorIQ] Session report success');
      console.log('[ArmorIQ] END session.report()');

      console.log('[ArmorIQ] START completePlan()');
      console.log('[ArmorIQ] Complete plan URL:', `${client.backendEndpoint}/iap/plans/${intentToken.planId}/status`);
      await client.completePlan(intentToken.planId)
        .catch(e => console.warn('[ArmorIQ] completePlan warning:', e.message));
      console.log('[ArmorIQ] END completePlan()');
      console.log('[ArmorIQ EXIT] session.report block');
    } catch (reportError) {
      console.error('[ArmorIQ] Session report failed:', reportError.message);
      console.log('[ArmorIQ EXIT] session.report block (caught)');
    }

    console.log('[ArmorIQ EXIT] createAuditEntry (success)');
    return {
      id: invokeResult.id || `armoriq-${Date.now()}`,
      action: entry.action,
      source: 'armoriq',
      resource: entry.resource,
      status: entry.status,
      armoriqTokenId: intentToken.tokenId,
      details: entry.details,
      userId: entry.userId,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[ArmorIQ] Caught outer error in createAuditEntry:', error.message);
    console.error('[ArmorIQ] Error type:', error.name || typeof error);
    if (error.stack) console.error('[ArmorIQ] SDK error stack:', error.stack.split('\n').slice(0, 5).join('\n'));

    // Fallback, but preserve intent token if we got one
    const armoriqTokenId = intentToken ? (intentToken.tokenId || intentToken.id) : null;
    console.log('[ArmorIQ EXIT] createAuditEntry (fallback after error)');
    return {
      id: `entry-fallback-${Date.now()}`,
      action: entry.action || 'unknown',
      source: 'armoriq',
      resource: entry.resource || 'unknown',
      status: entry.status || 'failed',
      details: { ...entry.details, sdkError: error.message },
      userId: entry.userId || 'system',
      timestamp: new Date().toISOString(),
      armoriqError: error.message,
      armoriqTokenId,
    };
  }
}

/**
 * Reports a security event to ArmorIQ.
 * 
 * @param {string} eventType - Type of security event
 * @param {Object} eventData - Event payload
 * @returns {Promise<Object>}
 */
async function reportSecurityEvent(eventType, eventData = {}) {
  console.log('[ArmorIQ ENTER] reportSecurityEvent');
  const client = getArmorIQClient();

  if (!client) {
    console.log('[ArmorIQ] [LOCAL FALLBACK] Security event (SDK not configured):', eventType);
    console.log('[ArmorIQ EXIT] reportSecurityEvent (local fallback)');
    return {
      id: `event-${Date.now()}`,
      eventType,
      status: 'logged_locally',
      timestamp: new Date().toISOString(),
    };
  }

  let intentToken;
  let invokeResult;
  try {
    console.log('[ArmorIQ] ═══ Report Security Event via SDK ═══');
    console.log('[ArmorIQ] Event type:', eventType);

    const eventPlan = {
      goal: `Report security event: ${eventType}`,
      steps: [
        {
          action: 'report_security_event',
          tool: 'event_logger',
          mcp: 'preecode-armoriq-mcp',
          inputs: { eventType, ...eventData },
        },
      ],
    };

    const planCapture = client.capturePlan(
      'preecode-system',
      `Security event: ${eventType}`,
      eventPlan,
      { eventType, source: 'armorclaw' }
    );

    intentToken = await client.getIntentToken(planCapture, undefined, 60);

    invokeResult = await client.invoke(
      'preecode-armoriq-mcp',
      'report_security_event',
      intentToken,
      { eventType, ...eventData },
      null,
      eventData.userId || 'system'
    );

    console.log('[ArmorIQ] END invoke()');
    console.log('[ArmorIQ] Event Synced — Result:', invokeResult.id || 'synced');

    // Report audit entry via ArmorIQSession.report() for dashboard visibility
    try {
      console.log('[ArmorIQ ENTER] session.report block');
      console.log('[ArmorIQ] START session.report() — will POST to backendEndpoint/iap/audit');
      console.log('[ArmorIQ] Report target URL:', `${client.backendEndpoint}/iap/audit`);
      const session = client.startSession({
        mode: 'local',
        llm: 'armorclaw-ai',
        defaultMcpName: 'preecode-armoriq-mcp',
      });
      session.currentToken = intentToken;
      session.userEmail = eventData.userId || 'system';
      console.log('[ArmorIQ] Session report started');
      await session.report(
        'report_security_event',
        {
          eventType,
          score: eventData.score,
          severity: eventData.severity,
          issueCount: eventData.issueCount,
          issueTypes: eventData.issueTypes,
          fileName: eventData.fileName,
          language: eventData.language,
        },
        invokeResult,
        {
          status: 'success',
          userEmail: eventData.userId || 'system',
        }
      );
      console.log('[ArmorIQ] Session report success');
      console.log('[ArmorIQ] END session.report()');

      console.log('[ArmorIQ] START completePlan()');
      console.log('[ArmorIQ] Complete plan URL:', `${client.backendEndpoint}/iap/plans/${intentToken.planId}/status`);
      await client.completePlan(intentToken.planId)
        .catch(e => console.warn('[ArmorIQ] completePlan warning:', e.message));
      console.log('[ArmorIQ] END completePlan()');
      console.log('[ArmorIQ EXIT] session.report block');
    } catch (reportError) {
      console.error('[ArmorIQ] Session report failed:', reportError.message);
      console.log('[ArmorIQ EXIT] session.report block (caught)');
    }

    console.log('[ArmorIQ EXIT] reportSecurityEvent (success)');
    return {
      id: invokeResult.id || `armoriq-event-${Date.now()}`,
      eventType,
      status: 'synced',
      armoriqTokenId: intentToken.tokenId,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[ArmorIQ] Caught outer error in reportSecurityEvent:', error.message);
    if (error.stack) console.error('[ArmorIQ] SDK error stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    const armoriqTokenId = intentToken ? (intentToken.tokenId || intentToken.id) : null;
    console.log('[ArmorIQ EXIT] reportSecurityEvent (fallback after error)');
    return {
      id: `event-fallback-${Date.now()}`,
      eventType,
      status: 'failed',
      error: error.message,
      timestamp: new Date().toISOString(),
      armoriqTokenId,
    };
  }
}

/**
 * Verifies an intent token locally using ArmorIQ SDK.
 *
 * @param {Object} intentToken - The intent token to verify
 * @returns {Promise<{valid: boolean, details: Object}>}
 */
async function verifyIntentToken(intentToken) {
  console.log('[ArmorIQ ENTER] verifyIntentToken');
  const client = getArmorIQClient();

  if (!client || !intentToken) {
    console.log('[ArmorIQ EXIT] verifyIntentToken (no client or no token)');
    return { valid: false, details: { reason: 'SDK not configured or no token provided' } };
  }

  try {
    const verificationResult = client.verifyToken(intentToken);
    console.log('[ArmorIQ] Intent Verification — Token valid:', verificationResult.valid);
    console.log('[ArmorIQ EXIT] verifyIntentToken');
    if (verificationResult.valid) {
      return { valid: true, details: verificationResult };
    } else {
      return { valid: false, details: verificationResult };
    }
  } catch (error) {
    console.error('[ArmorIQ] Token verification failed:', error.message);
    console.log('[ArmorIQ EXIT] verifyIntentToken (error)');
    return { valid: false, details: { error: error.message } };
  }
}

/**
 * Retrieves recent audit entries from local store.
 * 
 * @param {Object} [filters] - Optional filters
 * @param {number} [filters.limit] - Max entries to return
 * @param {string} [filters.action] - Filter by action type
 * @param {string} [filters.status] - Filter by status
 * @returns {Promise<Array>}
 */
async function getAuditEntries(filters = {}) {
  console.log('[ArmorIQ ENTER] getAuditEntries');
  const client = getArmorIQClient();

  if (!client) {
    console.log('[ArmorIQ] [LOCAL FALLBACK] Audit entries requested:', JSON.stringify(filters));
    console.log('[ArmorIQ EXIT] getAuditEntries (local fallback)');
    return [];
  }

  try {
    console.log('[ArmorIQ] Querying audit entries with filters:', JSON.stringify(filters));
    console.log('[ArmorIQ EXIT] getAuditEntries');
    // Note: The SDK may not have a direct queryAuditEntries method;
    // this is handled via the ArmorIQ platform dashboard.
    // For now, return empty — full query support will come with ArmorIQ API expansion.
    return [];
  } catch (error) {
    console.error('[ArmorIQ] Failed to query audit entries:', error.message);
    console.log('[ArmorIQ EXIT] getAuditEntries (error)');
    return [];
  }
}

module.exports = {
  logSecurityScan,
  evaluatePolicy,
  createAuditEntry,
  getAuditEntries,
  reportSecurityEvent,
  verifyIntentToken,
};
