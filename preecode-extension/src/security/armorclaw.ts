import { ArmorClawIssue } from '../types/security.types';

export function scanCode(code: string, language: string): ArmorClawIssue[] {
  const issues: ArmorClawIssue[] = [];
  if (!code || !code.trim()) {
    return issues;
  }

  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const trimmed = line.trim();

    // 1. Hardcoded Secrets & API Keys
    if (
      /(password|passwd|pass|client_secret|clientsecret|client_id|clientid|db_pass|dbpassword|dbpwd|private_key|privatekey)\s*[:=]\s*["'`]([a-zA-Z0-9_\-\.@#\$%\^&\*\(\)\+]{4,})["'`]/i.test(trimmed)
    ) {
      // Ignore if it looks like an env reference or variable
      if (!/\b(process\.env|os\.environ|getenv|os\.getenv)\b/i.test(trimmed)) {
        issues.push({
          issue: 'Hardcoded Secret',
          severity: 'critical',
          description: `A hardcoded credential/secret was found on line ${lineNumber}.`,
          lineNumber,
          recommendation: 'Move all credentials, passwords, and secrets to environment variables or use a secret management service.'
        });
      }
    }

    // API Key Checks
    if (
      /(api_key|apikey|api_secret|apisecret|auth_token|authtoken|jwt_secret|jwtsecret|secret_key|secretkey|token)\s*[:=]\s*["'`]([a-zA-Z0-9_\-\.]{8,})["'`]/i.test(trimmed) ||
      /\b(sk_live_[0-9a-zA-Z]{24}|AIzaSy[a-zA-Z0-9_\-]{33}|[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})\b/.test(trimmed)
    ) {
      if (!/\b(process\.env|os\.environ|getenv|os\.getenv)\b/i.test(trimmed)) {
        issues.push({
          issue: 'Hardcoded API Key',
          severity: 'high',
          description: `An exposed API key or access token was found on line ${lineNumber}.`,
          lineNumber,
          recommendation: 'Use environment variables (e.g. process.env.API_KEY) and avoid committing credentials to version control.'
        });
      }
    }

    // 2. SQL Injection
    if (
      /(\.query|\.execute|\.raw)\s*\(\s*["'`].*?\$\{\w+\}.*?["'`]\s*\)/i.test(trimmed) ||
      /(\.query|\.execute|\.raw)\s*\(\s*["'`].*?["'`]\s*\+\s*\w+/i.test(trimmed) ||
      /\b(select|insert|update|delete)\b.*?\+.*?\bfrom\b/i.test(trimmed) ||
      /\b(cursor\.execute|db\.query)\s*\(\s*f["'`].*?\{\w+\}.*?["'`]\s*\)/i.test(trimmed)
    ) {
      issues.push({
        issue: 'SQL Injection Vulnerability',
        severity: 'critical',
        description: `Unsanitized input is direct concatenated or interpolated into a SQL query on line ${lineNumber}.`,
        lineNumber,
        recommendation: 'Use parameterized queries, prepared statements, or an Object Relational Mapper (ORM) to pass inputs safely.'
      });
    }

    // 3. Command Injection
    if (
      /(\bchild_process\.(exec|execSync|spawn|spawnSync)|os\.system|subprocess\.(Popen|run|call))\s*\(\s*["'`].*?\$\{\w+\}.*?["'`]\s*\)/i.test(trimmed) ||
      /(\bchild_process\.(exec|execSync|spawn|spawnSync)|os\.system|subprocess\.(Popen|run|call))\s*\(\s*["'`].*?["'`]\s*\+\s*\w+/i.test(trimmed) ||
      /(\bchild_process\.(exec|execSync|spawn|spawnSync)|os\.system|subprocess\.(Popen|run|call))\s*\(\s*f["'`].*?\{\w+\}.*?["'`]\s*\)/i.test(trimmed)
    ) {
      issues.push({
        issue: 'Command Injection Vulnerability',
        severity: 'critical',
        description: `Running system command with direct string concatenation or interpolation on line ${lineNumber}.`,
        lineNumber,
        recommendation: 'Avoid executing shell commands with user input. If required, sanitize inputs strictly or use run arguments arrays instead of shell command strings.'
      });
    }

    // 4. eval() Usage
    if (/\beval\s*\(\s*/.test(trimmed) || /\bnew\s+Function\s*\(\s*/.test(trimmed) || /\bwindow\.execScript\s*\(\s*/.test(trimmed)) {
      issues.push({
        issue: 'Unsafe Dynamic Code Execution (eval)',
        severity: 'high',
        description: `Use of eval() or unsafe dynamic function constructor found on line ${lineNumber}.`,
        lineNumber,
        recommendation: 'Refactor code to avoid dynamic code evaluation (eval), as it executes input with high privileges and causes performance degradation.'
      });
    }

    // 5. Unsafe File Operations (Directory Traversal)
    if (
      /(\bfs\.read(FileSync|File|Stream)|fs\.write(FileSync|File)|open)\s*\(\s*.*?\+\s*.*?\)/i.test(trimmed) ||
      /(\bfs\.read(FileSync|File|Stream)|fs\.write(FileSync|File)|open)\s*\(\s*.*?f["'`].*?\{\w+\}.*?["'`]\s*\)/i.test(trimmed)
    ) {
      if (/\.\./.test(trimmed) || /\b(path|filepath|filename)\b/i.test(trimmed)) {
        issues.push({
          issue: 'Unsafe File Path Operation',
          severity: 'medium',
          description: `Constructing file path dynamically on line ${lineNumber} could expose files to Path Traversal attacks.`,
          lineNumber,
          recommendation: 'Use path utilities (like Node\'s path.resolve or path.join) and sanitize/validate path inputs against a whitelist before access.'
        });
      }
    }

    // 6. Cross-Site Scripting (XSS)
    if (
      /(\.innerHTML|\.outerHTML)\s*=/i.test(trimmed) ||
      /\bdocument\.write\s*\(\s*/i.test(trimmed) ||
      /\bdangerouslySetInnerHTML\b/i.test(trimmed)
    ) {
      issues.push({
        issue: 'Cross-Site Scripting (XSS)',
        severity: 'high',
        description: `Direct manipulation of HTML content using raw variables on line ${lineNumber}.`,
        lineNumber,
        recommendation: 'Use textContent, innerText, or secure escaping/sanitization libraries (like DOMPurify) to prevent injection of malicious scripts.'
      });
    }

    // 7. Authentication Risks / Weak Crypto / Weak Credentials
    if (
      /(md5|sha1)\s*\(\s*/i.test(trimmed) ||
      /crypto\.createHash\s*\(\s*["'](md5|sha1)["']\)/i.test(trimmed)
    ) {
      issues.push({
        issue: 'Insecure Cryptographic Algorithm',
        severity: 'medium',
        description: `Use of weak or outdated cryptographic hash function (MD5/SHA1) detected on line ${lineNumber}.`,
        lineNumber,
        recommendation: 'Upgrade to secure algorithms such as SHA-256, bcrypt, scrypt, or argon2 for hashing sensitive data/passwords.'
      });
    }

    if (
      /(password|password123|admin|123456|root|qwerty)\b/i.test(trimmed) &&
      /(['"`]password['"`]|['"`]passwd['"`]|['"`]pass['"`])\s*[:=]/i.test(trimmed)
    ) {
      issues.push({
        issue: 'Weak / Default Authentication Credentials',
        severity: 'high',
        description: `Potential use of extremely weak, easily guessable default credentials on line ${lineNumber}.`,
        lineNumber,
        recommendation: 'Ensure passwords have appropriate length, entropy, and complexity, and use environment variables rather than default values.'
      });
    }
  }

  return issues;
}
