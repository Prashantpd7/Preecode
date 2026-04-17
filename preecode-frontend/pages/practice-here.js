(function () {
  'use strict';

  var API_BASE = window.API_BASE || 'https://preecode-backend.onrender.com/api';

  // ── Judge0 language IDs ──
  var LANG_IDS = {
    python: 71,
    javascript: 63,
    typescript: 74,
    java: 62,
    cpp: 54,
    c: 50,
    go: 60,
    rust: 73,
  };

  // ── Monaco language map ──
  var MONACO_LANG = {
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    go: 'go',
    rust: 'rust',
  };

  // ── Default starters ──
  var STARTERS = {
    python: '# Write your solution here\n\n',
    javascript: '// Write your solution here\n\n',
    typescript: '// Write your solution here\n\n',
    java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n',
    cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
    c: '#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
    go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    // Write your solution here\n    fmt.Println("Hello")\n}\n',
    rust: 'fn main() {\n    // Write your solution here\n    println!("Hello");\n}\n',
  };

  var editor = null;
  var currentQuestion = null;
  var currentHint = null;
  var timerInterval = null;
  var timerSeconds = 0;
  var hintShown = false;

  // ── Init Monaco ──
  require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
  require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('monacoEditor'), {
      value: STARTERS['python'],
      language: 'python',
      theme: 'vs-dark',
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      lineNumbers: 'on',
      roundedSelection: true,
      padding: { top: 16, bottom: 16 },
      suggestOnTriggerCharacters: true,
    });
    document.getElementById('editorLoading').style.display = 'none';
  });

  // ── Language change ──
  document.getElementById('langSelect').addEventListener('change', function () {
    var lang = this.value;
    if (editor) {
      monaco.editor.setModelLanguage(editor.getModel(), MONACO_LANG[lang]);
      if (!currentQuestion) editor.setValue(STARTERS[lang]);
    }
  });

  // ── Timer ──
  function startTimer() {
    clearInterval(timerInterval);
    timerSeconds = 0;
    updateTimerDisplay();
    timerInterval = setInterval(function () {
      timerSeconds++;
      updateTimerDisplay();
    }, 1000);
  }

  function updateTimerDisplay() {
    var m = Math.floor(timerSeconds / 60);
    var s = timerSeconds % 60;
    document.getElementById('timerDisplay').textContent =
      (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  // ── Generate Question ──
  document.getElementById('genBtn').addEventListener('click', generateQuestion);

  function generateQuestion() {
    var lang = document.getElementById('langSelect').value;
    var diff = document.getElementById('diffSelect').value;
    var btn = document.getElementById('genBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';

    // Reset state
    hintShown = false;
    document.getElementById('hintBox').classList.remove('visible');
    document.getElementById('hintBtn').disabled = true;
    document.getElementById('problemHeader').style.display = 'none';
    document.getElementById('problemBody').innerHTML = '<div class="ph-problem__empty"><div class="ph-loading__spinner" style="margin:0 auto"></div><p style="margin-top:12px">Generating your challenge...</p></div>';
    document.getElementById('outputBody').textContent = 'Run your code to see output here...';
    document.getElementById('outputBody').className = 'ph-output__body';
    document.getElementById('outputStatus').style.display = 'none';

    var token = localStorage.getItem('token') || '';
    fetch(API_BASE + '/ai/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ language: lang, difficulty: diff }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var raw = data.question || data.content || '';
        parseAndRenderQuestion(raw, lang, diff);
        startTimer();
        document.getElementById('hintBtn').disabled = false;
      })
      .catch(function (err) {
        document.getElementById('problemBody').innerHTML = '<div class="ph-problem__empty"><p style="color:#f87171">Failed to generate question. Please try again.</p></div>';
        console.error(err);
      })
      .finally(function () {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> New Question';
      });
  }

  function parseAndRenderQuestion(raw, lang, diff) {
    var qMatch = raw.match(/\[QUESTION\]([\s\S]*?)(?=\[HINT\]|\[SOLUTION\]|$)/i);
    var hMatch = raw.match(/\[HINT\]([\s\S]*?)(?=\[QUESTION\]|\[SOLUTION\]|$)/i);
    var sMatch = raw.match(/\[SOLUTION\]([\s\S]*?)$/i);

    var question = qMatch ? qMatch[1].trim() : raw.trim();
    var hint = hMatch ? hMatch[1].trim() : '';
    var solution = sMatch ? sMatch[1].trim() : STARTERS[lang];

    currentQuestion = question;
    currentHint = hint;

    // Render problem
    document.getElementById('problemHeader').style.display = 'block';
    var badge = document.getElementById('diffBadge');
    badge.textContent = diff.charAt(0).toUpperCase() + diff.slice(1);
    badge.className = 'ph-problem__badge ph-problem__badge--' + diff;
    document.getElementById('problemTitle').textContent = extractTitle(question);
    document.getElementById('problemBody').innerHTML = '<p>' + escHtml(question).replace(/\n/g, '</p><p>') + '</p>';

    // Set editor to starter (not solution)
    if (editor) editor.setValue(STARTERS[lang]);
  }

  function extractTitle(text) {
    var first = text.split(/[.!?\n]/)[0].trim();
    return first.length > 60 ? first.slice(0, 57) + '...' : first;
  }

  function escHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  // ── Hint ──
  document.getElementById('hintBtn').addEventListener('click', function () {
    if (!currentHint) return;
    var box = document.getElementById('hintBox');
    if (!hintShown) {
      box.textContent = '💡 ' + currentHint;
      box.classList.add('visible');
      hintShown = true;
      this.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hide Hint';
    } else {
      box.classList.remove('visible');
      hintShown = false;
      this.innerHTML = '<i class="fa-solid fa-lightbulb"></i> Hint';
    }
  });

  // ── Run Code via Judge0 ──
  document.getElementById('runBtn').addEventListener('click', runCode);

  function runCode() {
    if (!editor) return;
    var code = editor.getValue().trim();
    var lang = document.getElementById('langSelect').value;

    // Validate: don't run empty or starter-only code
    var starter = STARTERS[lang].trim();
    if (!code || code === starter) {
      var outputBody = document.getElementById('outputBody');
      var outputStatus = document.getElementById('outputStatus');
      outputBody.className = 'ph-output__body error';
      outputBody.textContent = 'Write some code before running!';
      outputStatus.style.display = 'inline-block';
      outputStatus.className = 'ph-output__status ph-output__status--err';
      outputStatus.textContent = 'No Code';
      return;
    }

    var langId = LANG_IDS[lang];
    var runBtn = document.getElementById('runBtn');
    outputBody = document.getElementById('outputBody');
    outputStatus = document.getElementById('outputStatus');

    runBtn.disabled = true;
    runBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running...';
    outputBody.className = 'ph-output__body';
    outputBody.textContent = 'Running...';
    outputStatus.style.display = 'inline-block';
    outputStatus.className = 'ph-output__status ph-output__status--run';
    outputStatus.textContent = 'Running';

    // Use Judge0 CE public API
    var JUDGE0 = 'https://judge0-ce.p.rapidapi.com';
    var RAPID_KEY = ''; // Public endpoint fallback below

    // Try public Judge0 instance first
    fetch('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_code: code, language_id: langId, stdin: '' }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { handleJudgeResult(data); })
      .catch(function () {
        // Fallback: try backend proxy
        var token = localStorage.getItem('token') || '';
        return fetch(API_BASE + '/practice/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ code: code, language: lang }),
        })
          .then(function (r) { return r.json(); })
          .then(function (data) { handleJudgeResult(data); })
          .catch(function (err) {
            outputBody.className = 'ph-output__body error';
            outputBody.textContent = 'Could not connect to code runner. Please try again.';
            outputStatus.className = 'ph-output__status ph-output__status--err';
            outputStatus.textContent = 'Error';
          });
      })
      .finally(function () {
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fa-solid fa-play"></i> Run';
      });
  }

  function handleJudgeResult(data) {
    var outputBody = document.getElementById('outputBody');
    var outputStatus = document.getElementById('outputStatus');
    var stdout = data.stdout || '';
    var stderr = data.stderr || '';
    var compileOutput = data.compile_output || '';
    var statusDesc = (data.status && data.status.description) || '';

    if (stdout) {
      outputBody.className = 'ph-output__body';
      outputBody.textContent = stdout;
      outputStatus.className = 'ph-output__status ph-output__status--ok';
      outputStatus.textContent = 'Accepted';
    } else if (stderr || compileOutput) {
      outputBody.className = 'ph-output__body error';
      outputBody.textContent = stderr || compileOutput;
      outputStatus.className = 'ph-output__status ph-output__status--err';
      outputStatus.textContent = statusDesc || 'Error';
    } else {
      outputBody.className = 'ph-output__body';
      outputBody.textContent = statusDesc || 'No output';
      outputStatus.className = 'ph-output__status ph-output__status--ok';
      outputStatus.textContent = statusDesc || 'Done';
    }
  }

  // ── Save Session ──
  document.getElementById('saveBtn').addEventListener('click', saveSession);

  function saveSession() {
    if (!currentQuestion) {
      alert('Generate a question first before saving.');
      return;
    }
    stopTimer();
    var token = localStorage.getItem('token') || '';
    var lang = document.getElementById('langSelect').value;
    var diff = document.getElementById('diffSelect').value;
    var mins = Math.floor(timerSeconds / 60);
    var secs = timerSeconds % 60;
    var timeTaken = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;

    fetch(API_BASE + '/practice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        question: currentQuestion,
        timeTaken: timeTaken,
        language: lang,
        difficulty: diff,
        date: new Date().toISOString(),
        hintsUsed: hintShown ? 1 : 0,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function () {
        var btn = document.getElementById('saveBtn');
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
        btn.style.background = '#22c55e';
        setTimeout(function () {
          btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save';
          btn.style.background = '';
        }, 2000);
        startTimer(); // resume timer
      })
      .catch(function () { alert('Failed to save session.'); startTimer(); });
  }

  // ── Keyboard shortcut: Ctrl+Enter to run ──
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runCode();
    }
  });

})();
