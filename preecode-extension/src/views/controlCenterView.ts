import * as vscode from 'vscode';
import { preecodeStore } from '../state/store';
import { PreecodeState } from '../state/types';
import { getFrontendUrl } from '../services/apiService';

export interface ControlCenterHandlers {
  onQuickAction: (request: {
    action: 'practice' | 'generate' | 'detect' | 'debug' | 'fix' | 'explain' | 'review' | 'explainQuestion' | 'showHint' | 'showSolution' | 'explainSolution' | 'evaluateCode' | 'differentApproach' | 'saveQuestion';
    payload?: {
      language?: string;
      difficulty?: 'easy' | 'medium' | 'hard';
    };
  }) => Promise<void>;
  onTimerMenu: () => Promise<void>;
  onPanelNarrowHint: () => Promise<void>;
  onLogout: () => Promise<void>;
  onAskChat: (text: string) => Promise<void>;
  onNewChat: () => Promise<void>;
  onDebugStart: (startLine: number, endLine: number) => Promise<void>;
  onDebugNavigate: (direction: 'prev' | 'next') => Promise<void>;
  onDebugAsk: (text: string) => Promise<void>;
  onLogin: () => Promise<void>;
  onTourStep: (step: string) => Promise<void>;
  onSidebarOpened: () => Promise<void>;
}

export class ControlCenterViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'preecode.controlCenter';
  private webviewView: vscode.WebviewView | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly handlers: ControlCenterHandlers
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.webviewView = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'webview')]
    };

    view.webview.html = this.getHtml(view.webview);

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.unsubscribe = preecodeStore.subscribe((state) => {
      this.postState(state);
    });

    // Notify when sidebar opens for onboarding
    void this.handlers.onSidebarOpened();

    view.webview.onDidReceiveMessage(async (message: { type: string; payload?: any; action?: string; height?: number; startLine?: number; endLine?: number; direction?: 'prev' | 'next' }) => {
      if (message.type === 'quickAction' && message.action) {
        await this.handlers.onQuickAction({
          action: message.action as 'practice' | 'generate' | 'detect' | 'debug' | 'fix' | 'explain' | 'review' | 'explainQuestion' | 'showHint' | 'showSolution' | 'explainSolution' | 'evaluateCode' | 'differentApproach' | 'saveQuestion',
          payload: message.payload
        });
        return;
      }

      if (message.type === 'debugStart' && typeof message.startLine === 'number' && typeof message.endLine === 'number') {
        await this.handlers.onDebugStart(message.startLine, message.endLine);
        return;
      }

      if (message.type === 'debugNavigate' && message.direction) {
        await this.handlers.onDebugNavigate(message.direction);
        return;
      }

      if (message.type === 'debugAsk' && message.payload) {
        await this.handlers.onDebugAsk(message.payload);
        return;
      }

      if (message.type === 'askChat' && message.payload) {
        await this.handlers.onAskChat(message.payload);
        return;
      }

      if (message.type === 'timerMenu') {
        await this.handlers.onTimerMenu();
        return;
      }

      if (message.type === 'panelNarrowHint') {
        await this.handlers.onPanelNarrowHint();
        return;
      }

      if (message.type === 'newChat') {
        await this.handlers.onNewChat();
        return;
      }

      if (message.type === 'login') {
        await this.handlers.onLogin();
        return;
      }

      if (message.type === 'logout') {
        await this.handlers.onLogout();
        return;
      }

      if (message.type === 'tourStep' && message.payload) {
        await this.handlers.onTourStep(message.payload);
        return;
      }

      if (message.type === 'openDashboard') {
        const url = `${getFrontendUrl()}/pages/dashboard.html`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
        return;
      }

      if (message.type === 'ready') {
        this.postState(preecodeStore.getState());
        return;
      }

      if (message.type === 'chatDockResize') {
        const nextHeight = message.height;
        if (typeof nextHeight !== 'number') {
          return;
        }
        preecodeStore.setState((state) => ({
          ...state,
          chat: {
            ...state.chat,
            dockHeight: Math.max(120, nextHeight)
          }
        }));
      }
    });

    // Fire one initial state push for environments where webview is already ready.
    this.postState(preecodeStore.getState());
  }

  private postState(state: PreecodeState): void {
    this.webviewView?.webview.postMessage({
      type: 'state',
      payload: state
    });
    // Also send onboarding state separately for webview to handle
    this.webviewView?.webview.postMessage({
      type: 'onboarding',
      payload: state.onboarding
    });
  }

  public postMessage(message: unknown): void {
    this.webviewView?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = String(Date.now());
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview', 'control-center.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview', 'control-center.js'));

    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data: https:`
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${cssUri}" />
  <title>Preecode Control Center</title>
</head>
<body>
  <div class="root">

    <!-- ── HEADER ── -->
    <section class="card header-card">
      <div class="header-row">
        <div id="profileTrigger" class="profile-group" role="button" tabindex="0" aria-label="Profile menu">
          <div id="profileAvatar" class="avatar" aria-hidden="true">PC</div>
          <div class="profile-copy">
            <div id="userName" class="title">Preecode</div>
            <div id="syncStatus" class="sub" style="display:none"></div>
          </div>
        </div>
        <button id="loginBtn" class="btn btn-dashboard" data-mode="login" aria-label="Login">
          <span class="btn-text">Login</span>
        </button>
        <div id="profileMenu" class="profile-menu hidden" role="menu">
          <button id="profileLogoutBtn" class="profile-menu-item" type="button" role="menuitem">Logout</button>
        </div>
      </div>
    </section>

    <!-- ── CTA / TOOLS FLOW ── -->
    <section class="card cta-section hidden" id="toolsFlow">
      <!-- Primary CTA -->
      <button class="btn btn-primary full" data-mode-target="practice" data-action="practice" aria-label="Start Practice Session">
        ▶ Start Practice Session
      </button>

      <!-- Mode chooser shown after click — handled via JS mode-chooser reveal -->
      <div class="mode-chooser hidden" id="modeChooser">
        <div class="mode-card" data-action="generate" data-mode-target="solution" role="button" tabindex="0">
          <span class="mode-icon">✨</span>
          <span class="mode-label">AI Generated</span>
          <span class="mode-sub">New question</span>
        </div>
        <div class="mode-card" data-action="detect" data-mode-target="solution" role="button" tabindex="0">
          <span class="mode-icon">🔍</span>
          <span class="mode-label">From Code</span>
          <span class="mode-sub">Detect question</span>
        </div>
      </div>

      <!-- AI Tools -->
      <div class="tools-section" style="padding:10px 0 0">
        <div class="section-label" style="margin-bottom:8px">AI Tools</div>
        <div class="tools-grid" id="quickActionsSection">
          <button class="tool-btn" data-action="debug" aria-label="Debug Code">
            <span class="tool-icon">🐛</span>
            <span class="tool-label">Debug Code</span>
          </button>
          <button class="tool-btn" data-action="fix" aria-label="Fix Code">
            <span class="tool-icon">🔧</span>
            <span class="tool-label">Fix Code</span>
          </button>
          <button id="explainSelectionBtn" class="tool-btn" data-action="explain" aria-label="Explain Selection">
            <span class="tool-icon">💡</span>
            <span class="tool-label">Explain Selection</span>
          </button>
          <button id="reviewCodeBtn" class="tool-btn" data-action="review" aria-label="Review Code">
            <span class="tool-icon">👁</span>
            <span class="tool-label">Review Code</span>
          </button>
        </div>
      </div>

      <!-- Insight boxes -->
      <div class="insight-block hidden" id="insightBlock">
        <div id="problemInCodeLabel" class="insight-title hidden">Problem In Code</div>
        <div class="ghost-line hidden" id="problemInCodeLine"></div>
        <div id="expectedFixLabel" class="insight-title hidden" style="margin-top:8px">Expected Fix</div>
        <div class="ghost-line hidden" id="expectedFixLine"></div>
      </div>

      <div class="hidden-bindings" aria-hidden="true">
        <strong id="practiceQuestion">-</strong>
        <strong id="practiceDifficulty">easy</strong>
        <strong id="practiceAttempts">0</strong>
        <strong id="runStatus">idle</strong>
      </div>
    </section>

    <!-- ── PRACTICE FLOW (mode chooser active) ── -->
    <section class="card practice-section hidden" id="practiceFlow">
      <div class="section-head-row">
        <button class="back-btn" data-nav-back="tools" aria-label="Back to tools">← Back</button>
        <div class="section-label normal">Practice Session</div>
        <span id="practiceTimerValue" class="timer" role="timer" aria-label="Practice timer">00:00</span>
      </div>

      <div class="practice-actions" id="practiceStatePrimary">
        <div class="mode-chooser">
          <div class="mode-card" data-action="generate" data-mode-target="solution" role="button" tabindex="0">
            <span class="mode-icon">✨</span>
            <span class="mode-label">AI Generated</span>
            <span class="mode-sub">New question</span>
          </div>
          <div class="mode-card" data-action="detect" data-mode-target="solution" role="button" tabindex="0">
            <span class="mode-icon">🔍</span>
            <span class="mode-label">From Code</span>
            <span class="mode-sub">Detect question</span>
          </div>
        </div>
      </div>

      <div class="hidden-bindings" aria-hidden="true">
        <strong id="practiceQuestionFlow">-</strong>
        <strong id="practiceDifficultyFlow">easy</strong>
        <strong id="practiceAttemptsFlow">0</strong>
        <strong id="runStatusFlow">idle</strong>
      </div>
    </section>

    <!-- ── SOLUTION / ACTIVE PRACTICE FLOW ── -->
    <section class="card practice-section hidden" id="solutionFlow">
      <div class="section-head-row">
        <button class="back-btn" data-nav-back="tools" aria-label="Back to tools">← Back</button>
        <div class="section-label normal">Practice Questions</div>
        <span id="solutionTimerValue" class="timer" role="timer" aria-label="Session timer">00:00</span>
      </div>

      <div id="practiceStateSecondary" class="practice-actions">
        <div class="action-grid">
          <button id="explainQuestionBtn" class="btn btn-secondary btn-sm" data-action="explainQuestion">Explain Question</button>
          <button id="showHintBtn" class="btn btn-secondary btn-sm" data-action="showHint">Show Hint</button>
          <button id="showSolutionBtn" class="btn btn-secondary btn-sm" data-action="showSolution">Show Solution</button>
          <button class="btn btn-secondary btn-sm" data-action="differentApproach">Different Approach</button>
          <button id="explainSolutionBtn" class="btn btn-secondary btn-sm" data-action="explainSolution">Explain Solution</button>
          <button id="evaluateCodeBtn" class="btn btn-secondary btn-sm" data-action="evaluateCode">Evaluate Code</button>
        </div>
        <button id="saveQuestionBtn" class="btn btn-success" data-action="saveQuestion" style="margin-top:8px">
          ✓ Save Question
        </button>
      </div>

      <div class="hidden-bindings" aria-hidden="true">
        <strong id="practiceQuestionSolution">-</strong>
        <strong id="practiceDifficultySolution">easy</strong>
        <strong id="practiceAttemptsSolution">0</strong>
        <strong id="runStatusSolution">idle</strong>
      </div>
    </section>

    <!-- ── CHAT DOCK ── -->
    <div id="chatDock" class="chat-dock">
      <div id="chatGrip" class="chat-grip" aria-hidden="true" title="Drag to resize"></div>
      <div class="dock-head">
        <span>AI Chat</span>
        <button id="newChatBtn" class="dock-plus-btn" aria-label="Start new chat" title="New chat">+</button>
      </div>

      <!-- Debug panel -->
      <section id="debugPanel" class="debug-panel hidden" aria-label="Debug panel">
        <div class="debug-head-row">
          <div class="section-label">Debugging Code…</div>
          <button id="debugCloseBtn" class="debug-close-btn" aria-label="Close debug">×</button>
        </div>
        <div id="debugRangeForm" class="debug-range-form">
          <div class="debug-preview-box" aria-hidden="true"></div>
          <div class="debug-range-row">
            <input id="debugStartLine" type="number" min="1" placeholder="Start line" aria-label="Start line" />
            <input id="debugEndLine" type="number" min="1" placeholder="End line" aria-label="End line" />
            <button id="debugStartBtn" class="btn btn-primary btn-sm">Start</button>
          </div>
        </div>
        <div id="debugSession" class="debug-session hidden">
          <div class="debug-nav-row">
            <button id="debugPrevBtn" class="btn btn-secondary btn-sm">← Prev</button>
            <div id="debugLineBadge" class="debug-line-badge">Line -</div>
            <button id="debugNextBtn" class="btn btn-secondary btn-sm">Next →</button>
          </div>
          <pre id="debugCodeView" class="debug-code-view"></pre>
          <div id="debugCurrentExplain" class="debug-current-explain">-</div>
        </div>
      </section>

      <div id="chatFeed" class="chat-feed" role="log" aria-live="polite" aria-label="Chat messages"></div>

      <div class="ask-row">
        <input id="chatInput" type="text" placeholder="Ask Preecode AI…" aria-label="Chat input" autocomplete="off" />
        <button id="sendBtn" class="btn btn-send" aria-label="Send message">Send</button>
      </div>

      <div class="hidden-bindings" aria-hidden="true">
        <span id="compactTimer">00:00</span>
      </div>
    </div>

  </div>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    this.unsubscribe?.();
  }
}
