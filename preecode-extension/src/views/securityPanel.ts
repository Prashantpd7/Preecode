import * as vscode from 'vscode';
import { fetchAiSecurityAudits } from '../services/apiService';
import { SecurityCenterState, SecurityAuditLog } from '../types/security.types';
import { DEFAULT_SECURITY_STATE } from '../utils/constants';

export class SecurityCenterPanel implements vscode.WebviewViewProvider {
  public static readonly viewId = 'preecode.securityCenter';
  public static currentPanel: SecurityCenterPanel | undefined;
  
  private webviewView: vscode.WebviewView | null = null;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private state: SecurityCenterState = { ...DEFAULT_SECURITY_STATE };

  constructor(
    private readonly context: vscode.ExtensionContext,
    extensionUri: vscode.Uri,
    initialStatus: 'Connected' | 'Disconnected'
  ) {
    this.extensionUri = extensionUri;
    this.state.armorIQStatus = initialStatus;
    SecurityCenterPanel.currentPanel = this;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'webview')]
    };

    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'ready':
            await this.refreshData(this.context);
            break;
          case 'refresh':
            await this.refreshData(this.context);
            break;
          case 'exportLogs':
            await this.exportLogs(message.logs);
            break;
          case 'applyFix':
            await this.applyFix(message.fixedCode);
            break;
        }
      },
      null,
      this.disposables
    );

    this.refreshData(this.context);
  }

  public updateState(newState: Partial<SecurityCenterState>) {
    this.state = { ...this.state, ...newState };
    if (this.webviewView) {
      this.webviewView.webview.postMessage({ type: 'state', state: this.state });
    }
  }

  public async refreshData(context: vscode.ExtensionContext) {
    try {
      const logs = await fetchAiSecurityAudits(context, 50);
      this.updateState({ auditLogs: logs });
    } catch (err) {
      console.error('Failed to refresh security logs:', err);
    }
  }

  private async exportLogs(logs: SecurityAuditLog[]) {
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('preecode_security_logs.json'),
      filters: { 'JSON Files': ['json'] }
    });

    if (saveUri) {
      try {
        const content = JSON.stringify(logs, null, 2);
        await vscode.workspace.fs.writeFile(saveUri, Buffer.from(content, 'utf8'));
        void vscode.window.showInformationMessage('Security logs exported successfully!');
      } catch (err: any) {
        void vscode.window.showErrorMessage(`Failed to export logs: ${err.message}`);
      }
    }
  }

  private async applyFix(fixedCode: string) {
    const active = vscode.window.activeTextEditor;
    if (!active) {
      void vscode.window.showErrorMessage('No active text editor to apply the fix.');
      return;
    }

    try {
      const selection = active.selection;
      if (!selection.isEmpty) {
        await active.edit((editBuilder) => {
          editBuilder.replace(selection, fixedCode);
        });
      } else {
        const fullRange = new vscode.Range(
          active.document.positionAt(0),
          active.document.positionAt(active.document.getText().length)
        );
        await active.edit((editBuilder) => {
          editBuilder.replace(fullRange, fixedCode);
        });
      }
      void vscode.window.showInformationMessage('Security Center: Fix applied successfully!');
      // Re-analyze the code automatically to update the dashboard
      await vscode.commands.executeCommand('preecode.securityAnalyze');
    } catch (err: any) {
      void vscode.window.showErrorMessage(`Failed to apply fix: ${err.message}`);
    }
  }

  private getHtml(): string {
    const nonce = String(Date.now());

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PREECODE Security Center</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #d4d4d4);
      --card-bg: rgba(255, 255, 255, 0.03);
      --card-border: rgba(255, 255, 255, 0.1);
      --glow: rgba(0, 150, 255, 0.15);
      --accent: var(--vscode-button-background, #007acc);
      --accent-hover: var(--vscode-button-hoverBackground, #0062a3);
      
      --critical: #f14c4c;
      --high: #d86927;
      --medium: #cca700;
      --low: #388a34;
      --info: #3794d6;
    }

    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      margin: 0;
      padding: 12px;
      line-height: 1.4;
    }

    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 10px;
      margin-bottom: 16px;
    }

    h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.3px;
      background: linear-gradient(135deg, #58a6ff 0%, #bc8cff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid transparent;
    }

    .badge-success {
      background-color: rgba(56, 138, 52, 0.15);
      color: #3fb950;
      border-color: rgba(63, 185, 80, 0.3);
    }

    .badge-error {
      background-color: rgba(241, 76, 76, 0.15);
      color: #ff7b72;
      border-color: rgba(241, 76, 76, 0.3);
    }

    .badge-warning {
      background-color: rgba(204, 167, 0, 0.15);
      color: #d29922;
      border-color: rgba(210, 153, 34, 0.3);
    }

    .grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(5px);
    }

    .card-title {
      font-size: 13px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .collapsible-header {
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .collapsible-content {
      margin-top: 10px;
      display: none;
    }

    .collapsible-content.show {
      display: block;
    }

    .chevron {
      transition: transform 0.2s;
    }

    .chevron.rotate {
      transform: rotate(180deg);
    }

    .button {
      background-color: var(--accent);
      color: #ffffff;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: background-color 0.2s;
    }

    .button:hover {
      background-color: var(--accent-hover);
    }

    .button-secondary {
      background-color: transparent;
      border: 1px solid var(--card-border);
      color: var(--fg);
    }

    .button-secondary:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }

    .vulnerability-item {
      border-left: 3px solid var(--info);
      background-color: rgba(255, 255, 255, 0.01);
      padding: 8px 10px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 8px;
    }

    .vulnerability-item.critical { border-left-color: var(--critical); }
    .vulnerability-item.high { border-left-color: var(--high); }
    .vulnerability-item.medium { border-left-color: var(--medium); }
    .vulnerability-item.low { border-left-color: var(--low); }

    .vuln-title {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 2px;
    }

    .vuln-desc {
      font-size: 11px;
      opacity: 0.8;
      margin-bottom: 6px;
    }

    .vuln-rec {
      font-size: 10px;
      color: #8b949e;
      background: rgba(0, 0, 0, 0.15);
      padding: 4px 8px;
      border-radius: 3px;
    }

    pre {
      background-color: rgba(0, 0, 0, 0.2);
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family, Consolas, Monaco, monospace);
      font-size: 11px;
      margin: 0;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .code-box {
      margin-top: 8px;
    }

    .audit-log-row {
      padding: 8px 0;
      border-bottom: 1px solid var(--card-border);
      font-size: 11px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .audit-log-row:last-child {
      border-bottom: none;
    }

    .empty-state {
      text-align: center;
      padding: 24px 12px;
      opacity: 0.6;
      font-size: 11px;
    }

    .flex-row {
      display: flex;
      gap: 6px;
      align-items: center;
    }
  </style>
</head>
<body>
  <div class="header-container">
    <div>
      <h1>Security Center</h1>
    </div>
    <div class="flex-row">
      <button class="button button-secondary" id="refreshBtn" style="padding: 2px 6px; font-size: 10px;">↻ Refresh</button>
      <div id="armoriqBadge" class="badge">Checking...</div>
    </div>
  </div>

  <div class="grid">
    <!-- ArmorClaw Scanner Results -->
    <div class="card">
      <div class="card-title">
        <span>🔒 ArmorClaw Scan</span>
        <span id="scanStatusBadge" class="badge badge-success" style="margin-left: auto;">Idle</span>
      </div>
      <div id="scanResultsContainer">
        <div class="empty-state">No scans run in this session. Generate code to scan.</div>
      </div>
    </div>

    <!-- Policy Engine Card -->
    <div class="card">
      <div class="card-title">
        <span>⚠️ Policy Engine</span>
      </div>
      <div id="policyContainer">
        <div class="empty-state">No policy evaluated yet.</div>
      </div>
    </div>

    <!-- AI Fix Suggestions -->
    <div class="card">
      <div class="card-title">
        <span>🤖 AI Fix Suggestions</span>
      </div>
      <div id="fixContainer">
        <div class="empty-state">No fixes generated yet.</div>
      </div>
    </div>

    <!-- Audit Logs Card -->
    <div class="card">
      <div class="card-title collapsible-header" id="logsHeader">
        <span>📜 Audit Logs</span>
        <span class="chevron" id="logsChevron">▼</span>
      </div>
      <div class="collapsible-content show" id="logsContent">
        <div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
          <button class="button button-secondary" id="exportBtn" style="padding: 2px 6px; font-size: 10px;">Export Logs</button>
        </div>
        <div id="auditLogsContainer" style="max-height: 250px; overflow-y: auto; padding-right: 2px;">
          <div class="empty-state">No logs available.</div>
        </div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // Elements
    const armoriqBadge = document.getElementById('armoriqBadge');
    const scanStatusBadge = document.getElementById('scanStatusBadge');
    const scanResultsContainer = document.getElementById('scanResultsContainer');
    const policyContainer = document.getElementById('policyContainer');
    const fixContainer = document.getElementById('fixContainer');
    const auditLogsContainer = document.getElementById('auditLogsContainer');
    const refreshBtn = document.getElementById('refreshBtn');
    const exportBtn = document.getElementById('exportBtn');

    // Collapsible Logic
    const logsHeader = document.getElementById('logsHeader');
    const logsContent = document.getElementById('logsContent');
    const logsChevron = document.getElementById('logsChevron');

    logsHeader.addEventListener('click', () => {
      logsContent.classList.toggle('show');
      logsChevron.classList.toggle('rotate');
    });

    let currentLogs = [];

    // Trigger Initial Fetch
    vscode.postMessage({ type: 'ready' });

    refreshBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });

    exportBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'exportLogs', logs: currentLogs });
    });

    // Message Listener
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'state') {
        renderState(message.state);
      }
    });

    function renderState(state) {
      currentLogs = state.auditLogs || [];

      // Render ArmorIQ connection badge
      if (state.armorIQStatus === 'Connected') {
        armoriqBadge.textContent = 'Connected';
        armoriqBadge.className = 'badge badge-success';
      } else {
        armoriqBadge.textContent = 'Offline';
        armoriqBadge.className = 'badge badge-error';
      }

      // Render ArmorClaw results
      if (state.lastScanCode) {
        const scoreColorClass = state.securityScore >= 80 ? 'badge-success' : (state.securityScore >= 50 ? 'badge-warning' : 'badge-error');
        scanStatusBadge.innerHTML = \`<span class="badge \${scoreColorClass}" style="margin-right: 6px; border: 1px solid var(--card-border);">Score: \${state.securityScore}/100</span> \` + (state.lastScanIssues.length > 0 ? 'Violated' : 'Secure');
        scanStatusBadge.className = state.lastScanIssues.length > 0 ? 'badge badge-error' : 'badge badge-success';

        let html = '';
        if (state.lastScanIssues.length === 0) {
          html = '<div class="badge badge-success" style="width: 100%; box-sizing: border-box; text-align: center; justify-content: center; padding: 6px;">✓ 0 Vulnerabilities Detected.</div>';
        } else {
          state.lastScanIssues.forEach(issue => {
            html += \`
              <div class="vulnerability-item \${issue.severity}">
                <div class="vuln-title">\${issue.issue} (Line \${issue.lineNumber})</div>
                <div class="vuln-desc">\${issue.description}</div>
                <div class="vuln-rec">Rec: \${issue.recommendation}</div>
              </div>
            \`;
          });
        }

        html += \`
          <div class="code-box">
            <div style="font-size: 10px; font-weight: 600; margin-bottom: 4px;">Scanned Code:</div>
            <pre><code>\${escapeHtml(state.lastScanCode)}</code></pre>
          </div>
        \`;
        scanResultsContainer.innerHTML = html;
      }

      // Render Policy Decision
      if (state.lastPolicyResult) {
        const p = state.lastPolicyResult;
        let badgeClass = 'badge-success';
        if (p.action === 'Block') badgeClass = 'badge-error';
        if (p.action === 'Warn') badgeClass = 'badge-warning';

        policyContainer.innerHTML = \`
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>Action: <span class="badge \${badgeClass}">\${p.action}ed</span></strong>
              <span style="font-size: 10px; opacity: 0.7;">\${p.status}</span>
            </div>
            <div style="font-size: 11px; opacity: 0.9;">\${p.reason}</div>
          </div>
        \`;
      } else {
        policyContainer.innerHTML = '<div class="empty-state">No policy evaluated yet.</div>';
      }

      // Render Fix suggestions
      if (state.lastFix) {
        const f = state.lastFix;
        let practicesHtml = '';
        f.bestPractices.forEach(p => {
          practicesHtml += \`<li>\${p}</li>\`;
        });

        fixContainer.innerHTML = \`
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 11px; opacity: 0.85;">\· \${f.explanation}</div>
            
            <div class="code-box">
              <div style="font-size: 10px; font-weight: 600; margin-bottom: 4px;">Fixed Code:</div>
              <pre><code>\${escapeHtml(f.fixedCode)}</code></pre>
            </div>

            <div style="font-size: 11px; font-weight: 600; margin-top: 4px;">Best Practices:</div>
            <ul style="font-size: 11px; padding-left: 14px; margin: 0; opacity: 0.85;">
              \${practicesHtml}
            </ul>

            <button class="button" id="applyFixBtn" style="margin-top: 10px; width: 100%; justify-content: center;">Fix Security Issues</button>
          </div>
        \`;

        const applyFixBtn = document.getElementById('applyFixBtn');
        if (applyFixBtn) {
          applyFixBtn.onclick = () => {
            vscode.postMessage({ type: 'applyFix', fixedCode: f.fixedCode });
          };
        }
      } else {
        fixContainer.innerHTML = '<div class="empty-state">No fixes generated yet.</div>';
      }

      // Render Audit logs
      if (currentLogs && currentLogs.length > 0) {
        let html = '';
        currentLogs.forEach(log => {
          let badgeClass = 'badge-success';
          if (log.riskLevel === 'critical' || log.riskLevel === 'high') badgeClass = 'badge-error';
          if (log.riskLevel === 'medium') badgeClass = 'badge-warning';

          const time = new Date(log.timestamp).toLocaleTimeString();
          html += \`
            <div class="audit-log-row">
              <div>
                <span style="font-weight: 600;">\${escapeHtml(log.prompt.substring(0, 15))}...</span>
                <div style="font-size: 9px; opacity: 0.6; margin-top: 1px;">\${time}</div>
              </div>
              <div class="flex-row">
                <span class="badge \${badgeClass}">\${log.riskLevel}</span>
                <span class="badge \${log.policyAction === 'Block' ? 'badge-error' : (log.policyAction === 'Warn' ? 'badge-warning' : 'badge-success')}">\${log.policyAction}</span>
              </div>
            </div>
          \`;
        });
        auditLogsContainer.innerHTML = html;
      } else {
        auditLogsContainer.innerHTML = '<div class="empty-state">No logs available.</div>';
      }
    }

    function escapeHtml(unsafe) {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  </script>
</body>
</html>`;
  }
}
