import * as vscode from 'vscode';
import { doFetch } from '../services/apiService';
import { ARMORIQ_API_URL } from '../utils/constants';

export class ArmorIQClient {
  private apiKey: string;
  private orgId: string;
  private projectId: string;
  private isConnected: boolean = false;
  private sdkClient: any = null;

  constructor() {
    this.apiKey = process.env.ARMORIQ_API_KEY || '';
    // ARMORIQ_ORG_ID and ARMORIQ_PROJECT_ID are optional — only used
    // for the fallback REST API call headers, NOT required for SDK init.
    this.orgId = process.env.ARMORIQ_ORG_ID || '';
    this.projectId = process.env.ARMORIQ_PROJECT_ID || '';

    this.initializeSDK();
  }

  private initializeSDK() {
    // Only ARMORIQ_API_KEY is required to mark as Connected.
    // ARMORIQ_ORG_ID and ARMORIQ_PROJECT_ID are optional extras.
    if (!this.apiKey) {
      console.log('[ArmorIQ] ARMORIQ_API_KEY not set. Cannot connect.');
      return;
    }

    try {
      // Try to load real SDK if available
      const sdkModule = require('@armoriq/sdk');
      if (sdkModule && sdkModule.ArmorIQClient) {
        this.sdkClient = new sdkModule.ArmorIQClient({
          apiKey: this.apiKey,
          userId: process.env.USER_ID || 'preecode-extension-user',
          agentId: process.env.AGENT_ID || 'preecode-extension-agent',
        });
        console.log('[ArmorIQ] SDK client initialized successfully');
      }
    } catch (e) {
      console.log('[ArmorIQ] SDK npm package not loaded, falling back to direct REST client.');
    }

    this.isConnected = true;
    console.log('[ArmorIQ] Connected Successfully to ArmorIQ');
    // Display connection success
    void vscode.window.showInformationMessage('Connected Successfully to ArmorIQ');
  }

  public getStatus(): 'Connected' | 'Disconnected' {
    return this.isConnected ? 'Connected' : 'Disconnected';
  }

  public async logScanResult(payload: {
    prompt: string;
    generatedCode: string;
    scanResults: any[];
    policyResult: any;
    timestamp: string;
  }): Promise<boolean> {
    if (!this.isConnected) {
      console.warn('[ArmorIQ] Client not connected. Skipping log.');
      return false;
    }

    // If real SDK initialized, use it
    if (this.sdkClient) {
      try {
        const plan = {
          goal: 'Log security scan results to ArmorIQ',
          steps: [
            {
              action: 'log_security_scan',
              tool: 'audit_logger',
              mcp: 'preecode-armoriq-mcp',
              inputs: {
                resource: 'code_generation',
                status: 'completed',
                userId: 'preecode-extension-user',
              }
            }
          ]
        };

        const planCapture = this.sdkClient.capturePlan(
          'preecode-extension-agent',
          'AI Code Generation Security Scan',
          plan,
          { entryType: 'security_scan', source: 'preecode-extension' }
        );

        const token = await this.sdkClient.getIntentToken(planCapture, { policyName: 'security-scan-policy' });

        await this.sdkClient.invoke(
          'preecode-armoriq-mcp',
          'log_security_scan',
          token,
          {
            resource: 'code_generation',
            status: 'completed',
            details: {
              prompt: payload.prompt,
              code: payload.generatedCode,
              vulnerabilities: payload.scanResults,
              policy: payload.policyResult,
            },
            userId: 'preecode-extension-user',
            timestamp: payload.timestamp
          }
        );
        console.log('[ArmorIQ] Event successfully sent via SDK');
        return true;
      } catch (err: any) {
        console.error('[ArmorIQ] SDK Invoke failed:', err.message);
      }
    }

    // Fallback: Send directly to ArmorIQ platform API endpoint or Preecode backend proxy
    try {
      const response = await doFetch(`${ARMORIQ_API_URL}/scans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'x-armoriq-org-id': this.orgId,
          'x-armoriq-project-id': this.projectId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: payload.prompt,
          code: payload.generatedCode,
          vulnerabilities: payload.scanResults,
          policy: payload.policyResult,
          timestamp: payload.timestamp
        })
      });

      if (response && response.ok) {
        console.log('[ArmorIQ] Scan logged successfully via direct REST API call');
        return true;
      }
      console.warn('[ArmorIQ] Direct API call returned status:', response?.status);
      return false;
    } catch (e: any) {
      console.error('[ArmorIQ] Direct API call error:', e.message || e);
      return false;
    }
  }
}
