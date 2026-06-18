import * as vscode from 'vscode';
import { sendAIChatMessage } from '../services/apiService';
import { ArmorClawIssue, SecurityFix } from '../types/security.types';

export async function generateSecurityFix(
  context: vscode.ExtensionContext,
  codeSnippet: string,
  issue: ArmorClawIssue,
  language: string
): Promise<SecurityFix> {
  const prompt = [
    `You are a Senior Application Security Engineer. Resolve the security issue in the following code snippet.`,
    ``,
    `Vulnerability Details:`,
    `- Issue: ${issue.issue}`,
    `- Severity: ${issue.severity}`,
    `- Description: ${issue.description}`,
    `- Line Number: ${issue.lineNumber}`,
    `- Recommendation: ${issue.recommendation}`,
    ``,
    `Language: ${language}`,
    ``,
    `Vulnerable Code Snippet:`,
    `\`\`\`${language}`,
    codeSnippet,
    `\`\`\``,
    ``,
    `Provide your response strictly in JSON format with the following structure (no markdown fences around the JSON, return ONLY the raw JSON string):`,
    `{`,
    `  "explanation": "<Brief secure explanation of the vulnerability and why it is unsafe>",`,
    `  "fixedCode": "<Complete secured code snippet to replace the vulnerable code>",`,
    `  "bestPractices": [`,
    `    "<Best practice recommendation 1>",`,
    `    "<Best practice recommendation 2>",`,
    `    "<Best practice recommendation 3>"`,
    `  ]`,
    `}`
  ].join('\n');

  try {
    const rawResponse = await sendAIChatMessage(
      context,
      prompt,
      'System: You are an AI security advisor answering in JSON.',
      []
    );

    const parsed = parseJsonResponse(rawResponse);
    if (!parsed || typeof parsed.fixedCode !== 'string') {
      throw new Error('Invalid JSON response format.');
    }

    return {
      explanation: parsed.explanation || 'Vulnerability detected and mitigated.',
      fixedCode: stripCodeFences(parsed.fixedCode),
      bestPractices: Array.isArray(parsed.bestPractices) ? parsed.bestPractices : [issue.recommendation]
    };
  } catch (error: any) {
    console.error('[SecurityFix] AI generation failed:', error);

    // Try rule-based fallback fix
    const ruleFix = getRuleBasedFix(codeSnippet, issue, language);
    if (ruleFix) {
      console.log('[SecurityFix] Successfully applied rule-based fallback fix');
      return ruleFix;
    }

    // Return a fallback suggestion
    return {
      explanation: `Failed to generate dynamic fix: ${error.message || error}`,
      fixedCode: codeSnippet, // fallback to original code so we don't crash
      bestPractices: [issue.recommendation]
    };
  }
}

function getRuleBasedFix(code: string, issue: ArmorClawIssue, language: string): SecurityFix | null {
  const lines = code.split('\n');
  const lineIdx = issue.lineNumber - 1;
  if (lineIdx < 0 || lineIdx >= lines.length) return null;

  const targetLine = lines[lineIdx];
  let fixedLine = targetLine;
  let explanation = '';
  let bestPractices: string[] = [];

  const lowerIssue = issue.issue.toLowerCase();

  if (lowerIssue.includes('secret') || lowerIssue.includes('api key') || lowerIssue.includes('credential')) {
    // Replace hardcoded values with process.env
    const match = targetLine.match(/(password|passwd|pass|client_secret|clientsecret|client_id|clientid|db_pass|dbpassword|dbpwd|private_key|privatekey|api_key|apikey|api_secret|apisecret|auth_token|authtoken|jwt_secret|jwtsecret|secret_key|secretkey|token)\s*[:=]\s*["'`]([a-zA-Z0-9_\-\.@#\$%\^&\*\(\)\+]{4,})["'`]/i);
    if (match) {
      const varName = match[1];
      const envName = varName.toUpperCase();
      fixedLine = targetLine.replace(match[0], `${varName} = process.env.${envName}`);
      explanation = `Replaced hardcoded sensitive credential with safe environment variable reference process.env.${envName}.`;
      bestPractices = [
        'Never store credentials in source code.',
        'Use dotenv or equivalent package to load values from environment.',
        'Add .env files to .gitignore.'
      ];
    }
  } else if (lowerIssue.includes('sql injection')) {
    if (targetLine.includes('+')) {
      const match = targetLine.match(/(\.query|\.execute|\.raw)\s*\(\s*(["'`].*?["'`])\s*\+\s*(\w+)\s*\)/i);
      if (match) {
        const method = match[1];
        const queryStr = match[2];
        const param = match[3];
        const quote = queryStr.slice(-1);
        const newQueryStr = queryStr.slice(0, -1) + '?' + quote;
        fixedLine = targetLine.replace(match[0], `${method}(${newQueryStr}, [${param}])`);
        explanation = `Converts SQL concatenation into parameterized query to prevent SQL Injection.`;
        bestPractices = [
          'Use parameterized queries or prepared statements.',
          'Never concatenate raw user input into database commands.'
        ];
      }
    }
  } else if (lowerIssue.includes('eval')) {
    const match = targetLine.match(/\beval\s*\(\s*(.*?)\s*\)/);
    if (match) {
      fixedLine = targetLine.replace(match[0], `JSON.parse(${match[1]}) /* Fixed: Replaced unsafe eval() with JSON.parse() */`);
      explanation = `Replaced unsafe dynamic code evaluation (eval) with safer JSON.parse.`;
      bestPractices = [
        'Do not execute dynamic strings as code.',
        'Use JSON.parse for parsing structured data.'
      ];
    }
  } else if (lowerIssue.includes('xss')) {
    if (targetLine.includes('.innerHTML')) {
      fixedLine = targetLine.replace(/\.innerHTML\s*=/g, '.textContent =');
      explanation = `Replaced unsafe .innerHTML assignment with secure .textContent to prevent XSS.`;
      bestPractices = [
        'Avoid innerHTML unless values are strictly sanitized.',
        'Use textContent or innerText to treat input as plain text.'
      ];
    }
  }

  if (fixedLine !== targetLine) {
    lines[lineIdx] = fixedLine;
    return {
      explanation,
      fixedCode: lines.join('\n'),
      bestPractices
    };
  }

  return null;
}

function parseJsonResponse(raw: string): any {
  const text = String(raw || '').trim();
  try {
    return JSON.parse(text);
  } catch {
    // Attempt block recovery
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        // ignore
      }
    }
    return null;
  }
}

function stripCodeFences(code: string): string {
  return code
    .replace(/^```[a-zA-Z]*\n/gm, '')
    .replace(/```$/gm, '')
    .trim();
}
