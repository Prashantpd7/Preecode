import * as vscode from 'vscode';
import { getToken, deleteToken } from './authService';
import { getBackendUrl, doFetchWithTimeout } from './apiService';

/**
 * Security issue found during code analysis
 */
export interface SecurityIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  whyDangerous: string;
  howToFix: string;
  secureExample: string;
  lineNumber?: number;
}

/**
 * Result of a security analysis
 */
export interface SecurityAnalysisResult {
  score: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  issues: SecurityIssue[];
  recommendations: string[];
  totalIssues: number;
}

const SECURITY_REQUEST_TIMEOUT_MS = 60000; // 60s for thorough analysis

/**
 * Analyzes the provided code for security vulnerabilities via the backend API
 *
 * @param context - VS Code extension context (for auth token)
 * @param code - Source code to analyze
 * @param fileName - Name of the file being analyzed
 * @param language - Programming language of the code
 * @returns SecurityAnalysisResult with score, issues, recommendations
 */
export async function analyzeCodeSecurity(
  context: vscode.ExtensionContext,
  code: string,
  fileName: string,
  language: string
): Promise<SecurityAnalysisResult> {
  const token = await getToken(context);
  if (!token) {
    throw new Error('Please login to Preecode to use Security Analyze.');
  }

  if (!code || !code.trim()) {
    throw new Error('No code provided for security analysis.');
  }    try {
    console.log('[Preecode Security] Calling backend API: /api/security/analyze');

    // DIAGNOSTIC: Print token info
    console.log('[Preecode Security DIAG] Token retrieved:', token ? `${token.slice(0, 15)}... (${token.length} chars)` : 'NO TOKEN');
    
    // JWT DIAGNOSTIC: Decode token to check issuer and expiry
    try {
      const payloadBase64 = token!.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));
      console.log('[Preecode Security DIAG] JWT payload:', JSON.stringify(payload, null, 2));
      const expDate = new Date((payload?.exp || 0) * 1000);
      const nowDate = new Date();
      console.log('[Preecode Security DIAG] JWT expires:', expDate.toISOString());
      console.log('[Preecode Security DIAG] Current time:', nowDate.toISOString());
      console.log('[Preecode Security DIAG] JWT expired?', expDate < nowDate);
    } catch (e) {
      console.log('[Preecode Security DIAG] JWT decode failed:', e);
    }
    
    // Use getBackendUrl() dynamically to support local dev environments.
    // The security analysis endpoint is served alongside the main backend
    // at /api/security/analyze on whatever backend URL is configured.
    const apiUrl = `${getBackendUrl()}/api/security/analyze`;
    console.log('[Preecode Security DIAG] URL:', apiUrl);

    // Use doFetchWithTimeout (same as all other working features like sendAIChatMessage)
    // This ensures Authorization header is sent identically to how other features send it
    const response = await doFetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code.trim(),
          fileName,
          language,
        }),
      },
      SECURITY_REQUEST_TIMEOUT_MS
    );
    
    console.log('[Preecode Security DIAG] Response status:', response.status);
    console.log('[Preecode Security DIAG] Response OK:', response.ok);
    
    // DIAGNOSTIC: Read response body to see exact error message
    try {
      const cloned = response.clone();
      const bodyText = await cloned.text().catch(() => '(could not read)');
      console.log('[Preecode Security DIAG] Response body:', bodyText.slice(0, 500));
    } catch(e) {
      console.log('[Preecode Security DIAG] Could not read response body:', e);
    }

    if (response.status === 401) {
      await deleteToken(context);
      throw new Error('Session expired. Please login again.');
    }

    if (response.status === 429) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Security analysis failed (${response.status}).`
      );
    }

    const payload: any = await response.json().catch(() => ({}));
    console.log('[Preecode Security] Backend response received');

    const result: SecurityAnalysisResult = {
      score: payload?.data?.score ?? 0,
      severity: payload?.data?.severity ?? 'low',
      summary: payload?.data?.summary ?? 'No summary available.',
      issues: Array.isArray(payload?.data?.issues) ? payload.data.issues : [],
      recommendations: Array.isArray(payload?.data?.recommendations)
        ? payload.data.recommendations
        : [],
      totalIssues: payload?.data?.totalIssues ?? 0,
    };

    return result;
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg.includes('waking up') || msg.includes('abort')) {
      throw new Error(
        'Preecode server is starting up. Please wait a moment and try again.'
      );
    }
    throw new Error(msg || 'Could not reach security analysis service.');
  }
}

/**
 * Formats the security analysis result into a readable string
 * for display in the VS Code notification or panel
 */
export function formatSecurityResult(result: SecurityAnalysisResult): string {
  const lines: string[] = [];
  lines.push(`🔒 Security Score: ${result.score}/100`);
  lines.push(`Risk Level: ${result.severity.toUpperCase()}`);
  lines.push(`Issues Found: ${result.totalIssues}`);
  lines.push('');
  lines.push(result.summary);
  lines.push('');

  if (result.issues.length > 0) {
    lines.push('─'.repeat(40));
    lines.push('ISSUES:');
    lines.push('');

    for (const issue of result.issues) {
      const severityIcon =
        issue.severity === 'critical'
          ? '🔴'
          : issue.severity === 'high'
            ? '🟠'
            : issue.severity === 'medium'
              ? '🟡'
              : '🟢';
      const lineInfo = issue.lineNumber ? ` (line ${issue.lineNumber})` : '';
      lines.push(`${severityIcon} [${issue.severity.toUpperCase()}] ${issue.title}${lineInfo}`);
      if (issue.description) {
        lines.push(`   ${issue.description}`);
      }
      lines.push('');
    }
  }

  if (result.recommendations.length > 0) {
    lines.push('─'.repeat(40));
    lines.push('RECOMMENDATIONS:');
    lines.push('');

    for (const rec of result.recommendations) {
      lines.push(`  • ${rec}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
