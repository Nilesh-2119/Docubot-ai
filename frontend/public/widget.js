(function () {
    'use strict';

    // Get bot ID from script tag
    const scriptTag = document.currentScript;
    const botId = scriptTag?.getAttribute('data-bot-id');
    const apiUrl = scriptTag?.getAttribute('data-api-url') || scriptTag?.src?.replace('/widget.js', '') || 'http://localhost:8000';

    if (!botId) {
        console.error('DocuBot Widget: Missing data-bot-id attribute');
        return;
    }

    // Generate a session ID
    let sessionId = localStorage.getItem('docubot_session_' + botId);
    if (!sessionId) {
        sessionId = 'widget_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('docubot_session_' + botId, sessionId);
    }

    // Create shadow DOM for style isolation
    const host = document.createElement('div');
    host.id = 'docubot-widget-host';
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    // Styles
    const styles = document.createElement('style');
    styles.textContent = `
    * { margin: 0; padding: 0; box-sizing: border-box; }

    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    :host {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }

    .docubot-bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 24px rgba(99, 102, 241, 0.4);
      z-index: 99999;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .docubot-bubble:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 32px rgba(99, 102, 241, 0.5);
    }

    .docubot-bubble svg {
      width: 28px;
      height: 28px;
      transition: transform 0.3s;
    }

    .docubot-bubble.open svg {
      transform: rotate(90deg);
    }

    .docubot-chat {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      height: 520px;
      background: #0f172a;
      border-radius: 20px;
      border: 1px solid #1e293b;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      z-index: 99998;
      display: none;
      flex-direction: column;
      overflow: hidden;
      animation: slideUp 0.3s ease-out;
    }

    .docubot-chat.open { display: flex; }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .docubot-header {
      padding: 16px 20px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .docubot-header-icon {
      width: 36px;
      height: 36px;
      background: rgba(99, 102, 241, 0.15);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .docubot-header-icon svg {
      width: 20px;
      height: 20px;
      color: #818cf8;
    }

    .docubot-header-title {
      font-size: 14px;
      font-weight: 600;
      color: #f1f5f9;
    }

    .docubot-header-subtitle {
      font-size: 11px;
      color: #64748b;
    }

    .docubot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .docubot-messages::-webkit-scrollbar { width: 4px; }
    .docubot-messages::-webkit-scrollbar-track { background: transparent; }
    .docubot-messages::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }

    .docubot-msg {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.5;
      word-wrap: break-word;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .docubot-msg.user {
      align-self: flex-end;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: white;
      border-bottom-right-radius: 6px;
    }

    .docubot-msg.assistant {
      align-self: flex-start;
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
      border-bottom-left-radius: 6px;
    }

    .docubot-typing {
      align-self: flex-start;
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      border-bottom-left-radius: 6px;
    }

    .docubot-typing-dot {
      width: 6px;
      height: 6px;
      background: #64748b;
      border-radius: 50%;
      animation: bounce 1.4s ease-in-out infinite;
    }

    .docubot-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .docubot-typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    .docubot-input-area {
      padding: 12px 16px;
      border-top: 1px solid #1e293b;
      display: flex;
      gap: 8px;
      background: #0f172a;
    }

    .docubot-input {
      flex: 1;
      background: #1e293b;
      border: 1px solid #334155;
      color: #f1f5f9;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }

    .docubot-input:focus {
      border-color: #6366f1;
    }

    .docubot-input::placeholder {
      color: #475569;
    }

    .docubot-send {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .docubot-send:hover { opacity: 0.9; }
    .docubot-send:disabled { opacity: 0.3; cursor: not-allowed; }

    .docubot-send svg { width: 18px; height: 18px; }

    .docubot-powered {
      text-align: center;
      padding: 6px;
      font-size: 10px;
      color: #475569;
    }
  `;
    shadow.appendChild(styles);

    // Chat container
    const container = document.createElement('div');
    shadow.appendChild(container);

    let isOpen = false;
    let isLoading = false;
    let messages = [];
    let botName = 'AI Assistant';

    // Fetch bot info
    fetch(apiUrl + '/api/widget/' + botId + '/info')
        .then(r => r.json())
        .then(info => {
            botName = info.name || 'AI Assistant';
            render();
        })
        .catch(() => render());

    function render() {
        container.innerHTML = `
      <button class="docubot-bubble ${isOpen ? 'open' : ''}" id="docubot-toggle">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${isOpen
                ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
                : '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
            }
        </svg>
      </button>

      <div class="docubot-chat ${isOpen ? 'open' : ''}">
        <div class="docubot-header">
          <div class="docubot-header-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <div class="docubot-header-title">${botName}</div>
            <div class="docubot-header-subtitle">Powered by DocuBot AI</div>
          </div>
        </div>

        <div class="docubot-messages" id="docubot-messages">
          ${messages.length === 0 ? `
            <div class="docubot-msg assistant">
              👋 Hi! I'm ${botName}. Ask me anything about the documents I've been trained on.
            </div>
          ` : ''}
          ${messages.map(m =>
                `<div class="docubot-msg ${m.role}">${escapeHtml(m.content)}</div>`
            ).join('')}
          ${isLoading ? `
            <div class="docubot-typing">
              <div class="docubot-typing-dot"></div>
              <div class="docubot-typing-dot"></div>
              <div class="docubot-typing-dot"></div>
            </div>
          ` : ''}
        </div>

        <div class="docubot-input-area">
          <input class="docubot-input" id="docubot-input" placeholder="Type a message..." ${isLoading ? 'disabled' : ''} />
          <button class="docubot-send" id="docubot-send" ${isLoading ? 'disabled' : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        <div class="docubot-powered">Powered by DocuBot AI</div>
      </div>
    `;

        // Event listeners
        container.querySelector('#docubot-toggle').addEventListener('click', () => {
            isOpen = !isOpen;
            render();
            if (isOpen) {
                setTimeout(() => {
                    const input = container.querySelector('#docubot-input');
                    if (input) input.focus();
                }, 100);
            }
        });

        const input = container.querySelector('#docubot-input');
        const sendBtn = container.querySelector('#docubot-send');

        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', sendMessage);
        }

        // Scroll to bottom
        const msgsDiv = container.querySelector('#docubot-messages');
        if (msgsDiv) msgsDiv.scrollTop = msgsDiv.scrollHeight;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.innerText = text;
        return div.innerHTML;
    }

    async function sendMessage() {
        const input = container.querySelector('#docubot-input');
        const text = input?.value?.trim();
        if (!text || isLoading) return;

        messages.push({ role: 'user', content: text });
        isLoading = true;
        render();

        try {
            const response = await fetch(apiUrl + '/api/widget/' + botId + '/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, session_id: sessionId }),
            });

            const data = await response.json();
            messages.push({ role: 'assistant', content: data.response || 'Sorry, I could not process your request.' });
        } catch (error) {
            messages.push({ role: 'assistant', content: 'Sorry, something went wrong. Please try again.' });
        }

        isLoading = false;
        render();
    }

    render();
})();
