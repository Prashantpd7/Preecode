import * as vscode from 'vscode';
import { saveAiSecurityAudit } from '../services/apiService';
import { SecurityAuditLog } from '../types/security.types';

export async function logSecurityAudit(
  context: vscode.ExtensionContext,
  logEntry: SecurityAuditLog
): Promise<boolean> {
  try {
    const success = await saveAiSecurityAudit(context, logEntry);
    if (success) {
      console.log('[AuditLogger] Audit log saved to backend.');
    } else {
      console.warn('[AuditLogger] Backend failed to save audit log.');
    }
    return success;
  } catch (error) {
    console.error('[AuditLogger] Error writing audit log to backend:', error);
    return false;
  }
}
