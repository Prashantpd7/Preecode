/**
 * ArmorClaw Security Analysis Service
 * 
 * Provides static code security analysis using OpenRouter AI.
 * Architecture designed for seamless ArmorClaw SDK integration:
 * 
 * To connect ArmorClaw SDK later:
 *   1. Import ArmorClaw SDK: const { ArmorClaw } = require('armorclaw-sdk');
 *   2. Initialize with ARMORCLAW_API_KEY env var
 *   3. Replace the AI-based analysis with ArmorClaw's scan() method
 *   4. The return shape (ISecurityAnalysisResult) remains unchanged
 * 
 * @see ArmorClaw Integration Points (search for "ARMORCLAW_INTEGRATION")
 */

const { generateResponse } = require('./aiService');
const { createAuditEntry } = require('./armoriqService');

// ============================================================================
// ARMORCLAW_INTEGRATION: Uncomment and configure when ArmorClaw SDK is available
// ============================================================================
// const { ArmorClaw } = require('armorclaw-sdk');
// 
// function getArmorClawClient() {
//   const apiKey = process.env.ARMORCLAW_API_KEY;
//   if (!apiKey) return null;
//   return new ArmorClaw({ apiKey });
// }

/**
 * @typedef {Object} SecurityIssue
 * @property {string} type - Issue type (e.g., 'hardcoded_secret', 'sql_injection', 'xss', 'insecure_crypto', 'command_injection', 'path_traversal', 'insecure_deserialization', 'code_injection', 'auth_bypass', 'information_exposure', 'best_practice')
 * @property {string} severity - 'critical' | 'high' | 'medium' | 'low' | 'info'
 * @property {string} title - Short issue title
 * @property {string} description - Detailed explanation
 * @property {string} whyDangerous - Why this issue is a security risk
 * @property {string} howToFix - Remediation steps
 * @property {string} secureExample - Fixed/secure code example
 * @property {number} [lineNumber] - Optional line number where issue was found
 */

/**
 * @typedef {Object} ISecurityAnalysisResult
 * @property {number} score - Security score 0-100
 * @property {string} severity - 'low' | 'medium' | 'high' | 'critical'
 * @property {SecurityIssue[]} issues - Array of found security issues
 * @property {string[]} recommendations - List of security recommendations
 * @property {number} totalIssues - Total issue count
 * @property {string} summary - Overall security summary
 */

/**
 * Analyzes code for security vulnerabilities
 * 
 * ARMORCLAW_INTEGRATION: Replace the AI-based implementation with:
 *   const client = getArmorClawClient();
 *   if (client) {
 *     const result = await client.scan({ code, language, options: { ... } });
 *     return transformArmorClawResult(result);
 *   }
 *   // fallback to AI-based analysis
 *
 * @param {string} code - Source code to analyze
 * @param {string} language - Programming language
 * @param {Object} [options] - Additional options
 * @returns {Promise<ISecurityAnalysisResult>}
 */
async function analyzeCode(code, language, options = {}) {
  if (!code || typeof code !== 'string' || !code.trim()) {
    return createEmptyResult('No code provided for analysis.');
  }

  // ============================================================================
  // ARMORCLAW_INTEGRATION POINT #1
  // Uncomment to use ArmorClaw SDK when available:
  //
  // const client = getArmorClawClient();
  // if (client) {
  //   try {
  //     const scanResult = await client.scan({
  //       code,
  //       language: language || 'auto',
  //       options: {
  //         ...options,
  //         severityThreshold: 'low',
  //         includeSuggestions: true,
  //         includeCodeExamples: true,
  //       }
  //     });
  //     return transformArmorClawResult(scanResult);
  //   } catch (armorClawError) {
  //     console.error('[ARMORCLAW] SDK scan failed, falling back to AI:', armorClawError.message);
  //     // Fall through to AI-based analysis
  //   }
  // }
  // ============================================================================

  // AI-based security analysis (current implementation)
  const prompt = buildSecurityAnalysisPrompt(code, language, options);

  try {
    const rawResponse = await generateResponse(
      [{ role: 'user', content: prompt }],
      { temperature: 0.2, maxTokens: 2000 }
    );

    const result = parseAnalysisResponse(rawResponse, code);

    // Create audit log for this security scan
    createAuditEntry({
      action: 'security_scan',
      resource: 'code_analysis',
      status: 'completed',
      details: {
        language,
        codeLength: code.length,
        score: result.score,
        issueCount: result.totalIssues,
        severity: result.severity,
      },
    }).catch((err) => {
      console.error('[ARMORCLAW] Audit log failed:', err.message);
    });

    return result;
  } catch (error) {
    console.error('[ARMORCLAW] Analysis failed:', error.message);

    createAuditEntry({
      action: 'security_scan',
      resource: 'code_analysis',
      status: 'failed',
      details: {
        language,
        codeLength: code.length,
        error: error.message,
      },
    }).catch(() => {});

    return createEmptyResult(
      'Security analysis could not be completed due to a service error.',
      error.message
    );
  }
}

/**
 * ARMORCLAW_INTEGRATION POINT #2
 * Transforms ArmorClaw SDK scan result to internal format.
 * This function ensures the ArmorClaw output matches our ISecurityAnalysisResult shape.
 * 
 * @param {Object} raw - Raw ArmorClaw SDK scan result
 * @returns {ISecurityAnalysisResult}
 */
// function transformArmorClawResult(raw) {
//   return {
//     score: raw.securityScore ?? raw.score ?? 50,
//     severity: normalizeSeverity(raw.riskLevel || raw.severity || 'medium'),
//     issues: (raw.vulnerabilities || raw.findings || []).map(v => ({
//       type: v.type || v.category || 'unknown',
//       severity: normalizeSeverity(v.severity || v.risk || 'medium'),
//       title: v.title || v.name || 'Security Issue',
//       description: v.description || v.details || '',
//       whyDangerous: v.impact || v.riskDescription || '',
//       howToFix: v.remediation || v.fix || '',
//       secureExample: v.secureCode || v.fixExample || '',
//       lineNumber: v.line || v.lineNumber,
//     })),
//     recommendations: raw.recommendations || raw.suggestions || [],
//     totalIssues: raw.totalIssues ?? (raw.vulnerabilities?.length ?? 0),
//     summary: raw.summary || raw.overview || '',
//   };
// }

/**
 * Builds the AI prompt for security analysis
 */
function buildSecurityAnalysisPrompt(code, language, options) {
  const maxCodeLength = 8000;
  const truncatedCode = code.length > maxCodeLength
    ? code.substring(0, maxCodeLength) + '\n// ... [truncated]'
    : code;

  return `You are a senior application security engineer. Analyze the following ${language || 'unknown'} code for security vulnerabilities.

Perform a thorough security review covering:
1. **Hardcoded Secrets** - API keys, passwords, tokens, credentials
2. **Injection Flaws** - SQL injection, NoSQL injection, command injection, code injection
3. **Cross-Site Scripting (XSS)** - Reflected, stored, DOM-based
4. **Insecure Cryptographic Practices** - Weak algorithms, hardcoded keys, improper IV usage
5. **Path Traversal** - Unsanitized file paths
6. **Insecure Deserialization** - Unsafe deserialization of user input
7. **Authentication/Authorization Issues** - Weak auth, missing checks, privilege escalation
8. **Information Exposure** - Sensitive data in logs, error messages, or responses
9. **Input Validation** - Missing or insufficient input sanitization
10. **Dependency/Supply Chain Risks** - If identifiable from imports

${options.additionalChecks ? `Additional checks: ${options.additionalChecks}` : ''}

Code to analyze:
\`\`\`${language || 'text'}
${truncatedCode}
\`\`\`

Return your analysis as valid JSON ONLY. No markdown, no extra text:

{
  "score": <number 0-100, where 100 is perfectly secure>,
  "severity": "<overall severity: critical|high|medium|low>",
  "summary": "<one-line summary of security posture>",
  "issues": [
    {
      "type": "<issue category: hardcoded_secret|sql_injection|xss|command_injection|path_traversal|insecure_crypto|insecure_deserialization|auth_bypass|information_exposure|input_validation|best_practice>",
      "severity": "<critical|high|medium|low|info>",
      "title": "<short descriptive title>",
      "description": "<detailed explanation of the issue, including where in the code it occurs>",
      "whyDangerous": "<explanation of potential impact if exploited>",
      "howToFix": "<step-by-step remediation instructions>",
      "secureExample": "<concise secure code example showing the fix>"
    }
  ],
  "recommendations": [
    "<security best practice recommendation 1>",
    "<security best practice recommendation 2>",
    "<security best practice recommendation 3>"
  ]
}

Rules:
- Be accurate and avoid false positives
- If the code is secure, return score: 100, severity: "low", empty issues array
- Include line numbers in description when possible
- Prioritize critical and high severity issues`;
}

/**
 * Extracts JSON from AI response text with multiple fallback strategies.
 * The AI sometimes wraps JSON in extra text, uses code blocks, or has minor syntax issues.
 */
function extractJsonFromResponse(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return null;

  // Strategy 1: Try direct parse first (fast path)
  try {
    return JSON.parse(text);
  } catch (e) {
    // Continue to fallbacks
  }

  // Strategy 2: Extract JSON from markdown code blocks (```json ... ``` or ``` ... ```)
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (e) {
      // Continue
    }
  }

  // Strategy 3: Find the first `{` and last `}` to extract JSON object
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      // Continue
    }
  }

  // Strategy 4: Fix common JSON issues (single quotes, trailing commas) and retry
  try {
    const fixed = text
      .replace(/'/g, '"') // Replace all single quotes with double quotes
      .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas before } or ]
      .trim();
    const firstBrace4 = fixed.indexOf('{');
    const lastBrace4 = fixed.lastIndexOf('}');
    if (firstBrace4 !== -1 && lastBrace4 > firstBrace4) {
      return JSON.parse(fixed.slice(firstBrace4, lastBrace4 + 1));
    }
  } catch (e) {
    // All strategies failed
  }

  return null;
}

/**
 * Parses the AI response into structured result
 */
function parseAnalysisResponse(rawText, originalCode) {
  try {
    const parsed = extractJsonFromResponse(rawText);
    if (!parsed) {
      console.error('[ARMORCLAW] Could not extract JSON from AI response. First 200 chars:', String(rawText || '').slice(0, 200));
      return createEmptyResult(
        'Could not parse security analysis results.',
        'AI response was not valid JSON'
      );
    }

    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    const score = clampScore(parsed.score);
    const severity = parsed.severity || calculateSeverity(score, issues.length);
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
      : generateDefaultRecommendations(issues);

    return {
      score,
      severity: normalizeSeverity(severity),
      issues: issues.map(normalizeIssue),
      recommendations,
      totalIssues: issues.length,
      summary: parsed.summary || generateSummary(score, issues.length),
    };
  } catch (parseError) {
    console.error('[ARMORCLAW] Failed to parse AI response:', parseError.message);
    console.error('[ARMORCLAW] Raw response (first 500 chars):', String(rawText || '').slice(0, 500));
    return createEmptyResult(
      'Could not parse security analysis results.',
      parseError.message
    );
  }
}

/**
 * Normalizes an issue to ensure all fields exist
 */
function normalizeIssue(issue) {
  return {
    type: String(issue.type || 'best_practice'),
    severity: normalizeSeverity(issue.severity || 'medium'),
    title: String(issue.title || 'Security Issue'),
    description: String(issue.description || 'No description provided.'),
    whyDangerous: String(issue.whyDangerous || issue.whyDangerous === '' ? issue.whyDangerous : 'Potential security risk that could lead to exploitation.'),
    howToFix: String(issue.howToFix || issue.howToFix === '' ? issue.howToFix : 'Review and follow security best practices.'),
    secureExample: String(issue.secureExample || ''),
    lineNumber: issue.lineNumber || undefined,
  };
}

/**
 * Normalizes severity string
 */
function normalizeSeverity(severity) {
  const s = String(severity || '').toLowerCase().trim();
  if (s.includes('critical')) return 'critical';
  if (s.includes('high')) return 'high';
  if (s.includes('medium') || s.includes('moderate')) return 'medium';
  if (s.includes('low') || s.includes('info') || s.includes('informational')) return 'low';
  return 'medium';
}

/**
 * Calculates severity from score and issue count
 */
function calculateSeverity(score, issueCount) {
  if (score <= 30 || issueCount >= 5) return 'critical';
  if (score <= 50 || issueCount >= 3) return 'high';
  if (score <= 75 || issueCount >= 1) return 'medium';
  return 'low';
}

/**
 * Clamps score between 0 and 100
 */
function clampScore(score) {
  const num = Number(score);
  if (!Number.isFinite(num)) return 50;
  return Math.max(0, Math.min(100, Math.round(num)));
}

/**
 * Generates a summary string
 */
function generateSummary(score, issueCount) {
  if (issueCount === 0) return 'No security issues detected. Code appears to be secure.';
  if (score >= 80) return 'Minor security improvements recommended.';
  if (score >= 60) return 'Moderate security concerns that should be addressed.';
  if (score >= 40) return 'Significant security issues found that require attention.';
  return 'Critical security vulnerabilities detected. Immediate action required.';
}

/**
 * Generates default recommendations based on found issues
 */
function generateDefaultRecommendations(issues) {
  const recs = new Set();

  for (const issue of issues) {
    const type = String(issue.type || '').toLowerCase();
    if (type.includes('secret') || type.includes('key') || type.includes('credential')) {
      recs.add('Use environment variables or a secret management service for all credentials.');
    }
    if (type.includes('sql') || type.includes('injection')) {
      recs.add('Use parameterized queries or an ORM to prevent injection attacks.');
    }
    if (type.includes('xss')) {
      recs.add('Sanitize and escape all user input before rendering. Use Content Security Policy headers.');
    }
    if (type.includes('crypto') || type.includes('encrypt')) {
      recs.add('Use modern, well-audited cryptographic libraries. Never implement custom crypto.');
    }
    if (type.includes('deserialization')) {
      recs.add('Avoid deserializing untrusted data. If necessary, use safe serialization formats like JSON.');
    }
  }

  recs.add('Run a dependency vulnerability scanner (e.g., npm audit, pip audit, or OWASP Dependency-Check).');
  recs.add('Implement proper input validation and output encoding across all entry points.');

  return Array.from(recs);
}

/**
 * Creates an empty/safe result for edge cases
 */
function createEmptyResult(summary, errorMessage) {
  const result = {
    score: 0,
    severity: 'low',
    issues: [],
    recommendations: [
      'Unable to complete security analysis. Please try again.',
      'If the issue persists, check that your code is valid and complete.',
    ],
    totalIssues: 0,
    summary: summary || 'Security analysis could not be completed.',
  };

  if (errorMessage) {
    result.error = errorMessage;
  }

  return result;
}

/**
 * ARMORCLAW_INTEGRATION POINT #3
 * Configuration validation for ArmorClaw SDK
 * Returns true if ArmorClaw API key is configured
 */
// function isArmorClawConfigured() {
//   return !!(process.env.ARMORCLAW_API_KEY);
// }

module.exports = {
  analyzeCode,
};

// Type exports for JSDoc documentation (no runtime effect)
module.exports.ISecurityAnalysisResult = {};
module.exports.SecurityIssue = {};
