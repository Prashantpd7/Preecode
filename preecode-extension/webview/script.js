const vscode = acquireVsCodeApi();

const elements = {
  userName: document.getElementById('userName'),
  timer: document.getElementById('timer'),
  fileName: document.getElementById('fileName'),
  fileLanguage: document.getElementById('fileLanguage'),
  monitorState: document.getElementById('monitorState'),
  monitorDiagnostics: document.getElementById('monitorDiagnostics'),
  monitorSelection: document.getElementById('monitorSelection'),
  monitorVisibleRange: document.getElementById('monitorVisibleRange'),
  monitorTopIssue: document.getElementById('monitorTopIssue'),
  topIssueCard: document.getElementById('topIssueCard'),
  typingIndicator: document.getElementById('typingIndicator'),
  helpPopup: document.getElementById('helpPopup'),
  helpYes: document.getElementById('helpYes'),
  helpLater: document.getElementById('helpLater'),
  problemOutput: document.getElementById('problemOutput'),
  reasonOutput: document.getElementById('reasonOutput'),
  issueHighlightOutput: document.getElementById('issueHighlightOutput'),
  expectedFixOutput: document.getElementById('expectedFixOutput'),
  stepsOutput: document.getElementById('stepsOutput'),
  lineExecutionOutput: document.getElementById('lineExecutionOutput'),
  fixedCodeOutput: document.getElementById('fixedCodeOutput'),
  suggestionsOutput: document.getElementById('suggestionsOutput')
};

let hasIssues = false;
let popupVisible = false;
let typingTimeout = null;

function setTyping(active) {
  if (active) {
    elements.typingIndicator.classList.add('active');
    if (elements.monitorState) {
      elements.monitorState.textContent = 'User is typing';
    }
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    typingTimeout = setTimeout(() => {
      elements.typingIndicator.classList.remove('active');
      if (elements.monitorState && elements.monitorState.textContent === 'User is typing') {
        elements.monitorState.textContent = hasIssues ? 'Issue detected' : 'Monitoring';
      }
    }, 1200);
  }
}

function setIssues(active) {
  hasIssues = active;
  if (elements.topIssueCard) {
    elements.topIssueCard.classList.toggle('has-issue', active);
  }
  if (active && !popupVisible) {
    elements.helpPopup.classList.add('show');
    popupVisible = true;
  }
  if (!active) {
    elements.helpPopup.classList.remove('show');
    popupVisible = false;
  }
}

function updateMonitor(payload) {
  if (!payload) return;
  if (elements.monitorState && payload.state) {
    elements.monitorState.textContent = payload.state;
  }
  if (elements.monitorDiagnostics) {
    const errors = Number(payload.errors || 0);
    const warnings = Number(payload.warnings || 0);
    elements.monitorDiagnostics.textContent = `E:${errors} W:${warnings}`;
  }
  if (elements.monitorSelection) {
    elements.monitorSelection.textContent = payload.selection || 'No selection';
  }
  if (elements.monitorVisibleRange) {
    elements.monitorVisibleRange.textContent = payload.visibleRange || '-';
  }
  if (elements.monitorTopIssue) {
    elements.monitorTopIssue.textContent = payload.topIssue || 'No issue detected';
  }
}

function renderOutput(payload) {
  const problem = payload.problem || '-';
  const reason = payload.reason || '-';
  const issueHighlight = payload.highlight_issue || '-';
  const expectedFix = payload.highlight_fix || '-';
  const steps = Array.isArray(payload.step_by_step)
    ? payload.step_by_step.join('\n')
    : payload.step_by_step || '-';
  const lineExec = Array.isArray(payload.line_execution)
    ? payload.line_execution.join('\n')
    : payload.line_execution || '-';
  const fixedCode = payload.fixed_code || '-';
  const suggestions = Array.isArray(payload.suggestions)
    ? payload.suggestions.join('\n')
    : payload.suggestions || '-';

  elements.problemOutput.textContent = problem;
  elements.reasonOutput.textContent = reason;
  elements.issueHighlightOutput.textContent = issueHighlight;
  elements.expectedFixOutput.textContent = expectedFix;
  elements.stepsOutput.textContent = steps;
  elements.lineExecutionOutput.textContent = lineExec;
  elements.fixedCodeOutput.textContent = fixedCode;
  elements.suggestionsOutput.textContent = suggestions;
}

function sendAction(action) {
  vscode.postMessage({ type: 'action', action });
}

Array.from(document.querySelectorAll('.action-btn')).forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.getAttribute('data-action');
    if (action) {
      sendAction(action);
    }
  });
});

if (elements.helpYes) {
  elements.helpYes.addEventListener('click', () => {
    elements.helpPopup.classList.remove('show');
    popupVisible = false;
    sendAction('debug');
  });
}

if (elements.helpLater) {
  elements.helpLater.addEventListener('click', () => {
    elements.helpPopup.classList.remove('show');
    popupVisible = false;
  });
}

window.addEventListener('message', (event) => {
  const message = event.data;
  if (!message || !message.type) return;

  switch (message.type) {
    case 'init':
      if (message.userName) elements.userName.textContent = message.userName;
      if (message.timer) elements.timer.textContent = message.timer;
      if (message.fileName) elements.fileName.textContent = message.fileName;
      if (message.language) elements.fileLanguage.textContent = message.language;
      updateMonitor(message.monitor || null);
      break;
    case 'fileInfo':
      if (message.fileName) elements.fileName.textContent = message.fileName;
      if (message.language) elements.fileLanguage.textContent = message.language;
      break;
    case 'typing':
      setTyping(true);
      break;
    case 'diagnostics':
      setIssues(Boolean(message.hasIssues));
      updateMonitor(message.monitor || null);
      break;
    case 'monitor':
      updateMonitor(message.payload || null);
      break;
    case 'timer':
      if (message.timer) elements.timer.textContent = message.timer;
      break;
    case 'assistantResponse':
      renderOutput(message.payload || {});
      break;
    case 'assistantError':
      renderOutput({
        problem: 'Request failed',
        reason: message.error || 'Unknown error',
        highlight_issue: 'Review top issue from monitor section.',
        highlight_fix: 'Apply the shown keyword/syntax correction.',
        step_by_step: 'Check API key or use Fix Code for local automatic correction.',
        line_execution: '-',
        fixed_code: '-',
        suggestions: '-'
      });
      break;
    default:
      break;
  }
});

vscode.postMessage({ type: 'ready' });
