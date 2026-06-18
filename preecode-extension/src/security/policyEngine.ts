import { ArmorClawIssue, PolicyResult } from '../types/security.types';

export function evaluatePolicy(issues: ArmorClawIssue[]): PolicyResult {
  if (!issues || issues.length === 0) {
    return {
      action: 'Allow',
      reason: 'No security issues detected.',
      status: 'Policy Passed'
    };
  }

  // 1. Check for Block actions (High / Critical severity, Secrets, API keys)
  for (const issue of issues) {
    const isSecret = issue.issue.toLowerCase().includes('secret') || issue.description.toLowerCase().includes('secret');
    const isApiKey = issue.issue.toLowerCase().includes('api key') || issue.description.toLowerCase().includes('api key') || issue.issue.toLowerCase().includes('credential');

    if (
      issue.severity === 'critical' ||
      issue.severity === 'high' ||
      isSecret ||
      isApiKey
    ) {
      return {
        action: 'Block',
        reason: `${issue.issue}: ${issue.description}`,
        status: 'Policy Violation Detected'
      };
    }
  }

  // 2. Check for Warn actions (Medium severity)
  const mediumIssues = issues.filter(issue => issue.severity === 'medium');
  if (mediumIssues.length > 0) {
    return {
      action: 'Warn',
      reason: `${mediumIssues[0].issue}: ${mediumIssues[0].description}`,
      status: 'Policy Warning'
    };
  }

  // 3. Low/Info severity issues
  return {
    action: 'Allow',
    reason: 'Issues found are low risk and allowed by policy.',
    status: 'Policy Passed with Low Risks'
  };
}
