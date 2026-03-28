/**
 * chat.js – Chat interface with SSE streaming support.
 *
 * Handles sending user messages, displaying AI status/actions,
 * streaming the explanation, and triggering preview refresh.
 */

import { authFetch, showToast, getActiveProject } from './app.js';
import { refreshPreview } from './preview.js';

const messagesEl    = document.getElementById('messages');
const welcomeScreen = document.getElementById('welcomeScreen');
const chatInput     = document.getElementById('chatInput');
const sendBtn       = document.getElementById('sendBtn');

let conversationHistory = [];
let isStreaming = false;

export function initChat() {
  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
  });

  // Suggestion chips on welcome screen
  document.querySelectorAll('.chip[data-suggestion]').forEach(chip => {
    chip.addEventListener('click', () => {
      const project = getActiveProject();
      if (!project) {
        showToast('Select or create a project first', 'error');
        return;
      }
      chatInput.value = chip.dataset.suggestion;
      chatInput.style.height = 'auto';
      sendMessage();
    });
  });
}

/**
 * Called when a project is selected. Loads chat history.
 * @param {object} project
 */
export function loadChat(project) {
  welcomeScreen.classList.add('hidden');
  messagesEl.classList.remove('hidden');
  messagesEl.innerHTML = '';
  conversationHistory = [];

  chatInput.disabled = false;
  sendBtn.disabled = false;
  chatInput.placeholder = `Chat with AI about "${project.name}"…`;

  // Load persisted chat history from project.json
  if (project.chatHistory?.length) {
    const pairs = project.chatHistory;
    for (let i = 0; i < pairs.length; i++) {
      const entry = pairs[i];
      if (entry.role === 'user') appendMessage('user', entry.content);
      else if (entry.role === 'assistant') appendMessage('assistant', entry.content);
    }
    conversationHistory = pairs.slice(-20); // last 10 pairs for context
    scrollToBottom();
  } else {
    appendSystemMessage(`👋 Hi! I'm your AI assistant for **${project.name}**. What would you like to create or change?`);
  }
}

async function sendMessage() {
  const project = getActiveProject();
  if (!project || isStreaming) return;

  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;
  isStreaming = true;

  // Show user bubble
  appendMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });

  // Create AI response bubble (will be filled via SSE)
  const aiBubble = createAIBubble();
  scrollToBottom();

  try {
    const response = await fetch(`/api/projects/${project.id}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('customy_token')}`
      },
      body: JSON.stringify({
        message: text,
        history: conversationHistory.slice(-20)
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Request failed');
    }

    // SSE parsing
    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let appliedCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          handleSSEEvent(event, aiBubble);
          if (event.type === 'done') appliedCount = event.appliedCount || 0;
        } catch { /* skip malformed */ }
      }
    }

    // Refresh is no longer needed in the admin panel
    // The user will refresh the separate tab manually or the AI will tell them to

  } catch (err) {
    aiBubble.querySelector('.bubble').innerHTML =
      `<span style="color:#f87171">⚠️ ${err.message}</span>`;
    showToast(err.message, 'error');
  } finally {
    sendBtn.disabled = false;
    isStreaming = false;
    scrollToBottom();
  }
}

function handleSSEEvent(event, aiBubble) {
  const bubble    = aiBubble.querySelector('.bubble');
  const statusEl  = aiBubble.querySelector('.status-indicator');
  const actionsEl = aiBubble.querySelector('.actions-area');

  switch (event.type) {
    case 'status':
      if (statusEl) statusEl.textContent = event.text;
      break;

    case 'action': {
      if (statusEl) statusEl.style.display = 'none';
      if (actionsEl) {
        const pill = document.createElement('span');
        pill.className  = 'action-pill';
        const icons = { create_file: '✦', update_file: '✏️', delete_file: '🗑', refactor_file: '♻️' };
        pill.textContent = `${icons[event.action.type] || '•'} ${event.action.path}`;
        actionsEl.appendChild(pill);
      }
      break;
    }

    case 'explanation': {
      if (statusEl) statusEl.remove();
      if (actionsEl) actionsEl.style.marginBottom = '0.75rem';
      // Render markdown-ish explanation
      bubble.querySelector('.explanation-text').innerHTML = formatExplanation(event.text);
      conversationHistory.push({ role: 'assistant', content: event.text });
      break;
    }

    case 'done':
      break;

    case 'error':
      bubble.innerHTML = `<span style="color:#f87171">⚠️ ${event.text}</span>`;
      break;
  }
  scrollToBottom();
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function createAIBubble() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message assistant';
  wrapper.innerHTML = `
    <div class="avatar" aria-hidden="true">✦</div>
    <div class="bubble">
      <div class="status-indicator">⏳ Thinking…</div>
      <div class="actions-area" style="margin-bottom:0"></div>
      <div class="explanation-text"></div>
    </div>
  `;
  messagesEl.appendChild(wrapper);
  return wrapper;
}

function appendMessage(role, content) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;
  const avatar = role === 'user'
    ? '<div class="avatar" aria-hidden="true">👤</div>'
    : '<div class="avatar" aria-hidden="true">✦</div>';
  const side = role === 'user' ? 'user' : 'assistant';
  wrapper.innerHTML = `${avatar}<div class="bubble">${formatExplanation(content)}</div>`;
  if (role === 'user') {
    // put avatar on right for user messages
    wrapper.innerHTML = `<div class="bubble">${escapeHtml(content)}</div>${avatar}`;
  }
  messagesEl.appendChild(wrapper);
}

function appendSystemMessage(text) {
  const el = document.createElement('div');
  el.style.cssText = 'text-align:center;color:var(--text-muted);font-size:0.85rem;padding:1rem 0';
  el.textContent = text.replace(/\*\*(.*?)\*\*/g, '$1');
  messagesEl.appendChild(el);
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatExplanation(text) {
  // Basic markdown: bold, code, newlines
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(124,58,237,0.12);padding:0.1em 0.35em;border-radius:4px;font-size:0.85em">$1</code>')
    .replace(/\n/g, '<br>');
}
