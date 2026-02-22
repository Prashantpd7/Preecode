/* chatbot.js – AI Chatbot floating panel */
(function () {
  // Only show for logged-in users
  if (!localStorage.getItem('token')) return;

  // Floating action button
  var fab = document.createElement('button');
  fab.className = 'ai-chat-fab';
  fab.setAttribute('aria-label', 'Open AI Chat');
  fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';

  // Chat panel
  var panel = document.createElement('div');
  panel.className = 'ai-chat-panel';
  panel.innerHTML =
    '<div class="ai-chat-header">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<span style="font-size:16px;color:#ff6b00">AI</span>' +
        '<span style="font-weight:600;font-size:14px;color:#e4e4e7">Preecode AI</span>' +
      '</div>' +
      '<button id="aiChatClose" style="background:none;border:none;color:#71717a;cursor:pointer;font-size:18px">&times;</button>' +
    '</div>' +
    '<div class="ai-chat-messages" id="aiChatMessages">' +
      '<div class="ai-msg bot">Hi! I\'m Preecode AI. Ask me anything about coding, algorithms, or debugging.</div>' +
    '</div>' +
    '<div class="ai-chat-input-row">' +
      '<input type="text" id="aiChatInput" placeholder="Ask something..." />' +
      '<button id="aiChatSend">Send</button>' +
    '</div>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  // Toggle panel
  fab.addEventListener('click', function () {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      document.getElementById('aiChatInput').focus();
    }
  });

  document.getElementById('aiChatClose').addEventListener('click', function () {
    panel.classList.remove('open');
  });

  // Send message
  function sendMessage() {
    var input = document.getElementById('aiChatInput');
    var msg = input.value.trim();
    if (!msg) return;

    var messages = document.getElementById('aiChatMessages');
    var sendBtn = document.getElementById('aiChatSend');

    // Add user message
    var userDiv = document.createElement('div');
    userDiv.className = 'ai-msg user';
    userDiv.textContent = msg;
    messages.appendChild(userDiv);

    input.value = '';
    sendBtn.disabled = true;
    messages.scrollTop = messages.scrollHeight;

    // Add loading indicator
    var loadDiv = document.createElement('div');
    loadDiv.className = 'ai-msg bot';
    loadDiv.textContent = 'Thinking...';
    messages.appendChild(loadDiv);
    messages.scrollTop = messages.scrollHeight;

    Api.chatWithAI(msg)
      .then(function (data) {
        loadDiv.textContent = data.response;
      })
      .catch(function (err) {
        loadDiv.textContent = 'Error: ' + (err.message || 'Something went wrong');
        loadDiv.style.color = '#f87171';
      })
      .finally(function () {
        sendBtn.disabled = false;
        messages.scrollTop = messages.scrollHeight;
      });
  }

  document.getElementById('aiChatSend').addEventListener('click', sendMessage);
  document.getElementById('aiChatInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });
})();
