export interface ArmorClawIssue {
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  lineNumber: number;
  recommendation: string;
}

export interface PolicyResult {
  action: 'Block' | 'Warn' | 'Allow';
  reason: string;
  status: string;
}

export interface SecurityFix {
  explanation: string;
  fixedCode: string;
  bestPractices: string[];
}

export interface SecurityAuditLog {
  _id?: string;
  timestamp: string;
  prompt: string;
  generatedCode: string;
  securityIssues: ArmorClawIssue[];
  securityScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  policyAction: 'Block' | 'Warn' | 'Allow';
  armorIQStatus: string;
}

export interface SecurityCenterState {
  armorIQStatus: 'Connected' | 'Disconnected' | 'Connecting';
  securityScore: number;
  lastScanTime: string | null;
  lastScanCode: string | null;
  lastScanIssues: ArmorClawIssue[];
  lastPolicyResult: PolicyResult | null;
  lastFix: SecurityFix | null;
  auditLogs: SecurityAuditLog[];
}
