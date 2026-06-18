export const PREECODE_SECURITY_STATE_KEY = 'preecode.securityCenterState';
export const PREECODE_OPEN_SECURITY_CENTER_CMD = 'preecode.openSecurityCenter';

export const ARMORIQ_API_URL = 'https://api.armoriq.ai/v1';

export const DEFAULT_SECURITY_STATE = {
  armorIQStatus: 'Disconnected' as const,
  securityScore: 100,
  lastScanTime: null,
  lastScanCode: null,
  lastScanIssues: [],
  lastPolicyResult: null,
  lastFix: null,
  auditLogs: []
};
