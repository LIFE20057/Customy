/**
 * editor-injector.js
 * Injected into Customy projects when ?edit=true is present.
 * Enables: element selection, highlighting, and context-aware AI chat.
 */

(function() {
  if (window.__customy_editor_active) return;
  window.__customy_editor_active = true;

  console.log('✦ Customy AI Editor Active');

  let selectedElement = null;
  let hoveredElement = null;
  let isMinimized = false;
  let isStreaming = false;

  // ─── DOM Selection Helpers ─────────────────────────────────

  function getUniqueSelector(el) {
    if (!(el instanceof Element)) return;
    const path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += '#' + el.id;
        path.unshift(selector);
        break;
      } else {
        let sib = el, nth = 1;
        while (sib = sib.previousElementSibling) {
          if (sib.nodeName.toLowerCase() == selector) nth++;
        }
        if (nth != 1) selector += ":nth-of-type("+nth+")";
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(" > ");
  }

  // ─── Highlight Logic ───────────────────────────────────────

  function clearHover() {
    if (hoveredElement) {
      hoveredElement.classList.remove('customy-hover');
      hoveredElement = null;
    }
  }

  function handleMouseOver(e) {
    if (isStreaming) return;
    const target = e.target;
    if (target.closest('#customy-editor-container')) return;
    
    clearHover();
    hoveredElement = target;
    target.classList.add('customy-hover');
  }

  function handleClick(e) {
    if (isStreaming) return;
    const target = e.target;
    if (target.closest('#customy-editor-container')) return;

    e.preventDefault();
    e.stopPropagation();

    if (selectedElement) {
      selectedElement.classList.remove('customy-selected');
    }

    selectedElement = target;
    selectedElement.classList.add('customy-selected');

    updateSelectionBar();
  }

  // ─── UI Creation ───────────────────────────────────────────

  function createUI() {
    const container = document.createElement('div');
    container.id = 'customy-editor-container';
    container.innerHTML = `
      <div class="customy-header" id="customy-drag-handle">
        <h3><span class="status-dot"></span> Customy AI Editor</h3>
        <div class="customy-controls">
          <button class="customy-icon-btn" id="customy-minimize" title="Minimize">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button class="customy-icon-btn" id="customy-close" title="Exit Edit Mode">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <div id="customy-selection-bar">
        <span>Target:</span>
        <span class="selector-tag" id="customy-active-selector">No element selected</span>
      </div>

      <div id="customy-chat-history">
        <div class="customy-msg ai customy-animate-in">
          Select an element and tell me what you'd like to change! I can edit text, swap images, or restyle sections.
        </div>
      </div>

      <div class="customy-input-area">
        <div class="customy-input-wrapper">
          <textarea id="customy-chat-input" placeholder="How should I modify this?" rows="1"></textarea>
          <button id="customy-send-btn" disabled>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    // Event Listeners
    document.getElementById('customy-minimize').onclick = toggleMinimize;
    document.getElementById('customy-drag-handle').onclick = (e) => {
      if (e.target.closest('.customy-controls')) return;
      toggleMinimize();
    };
    document.getElementById('customy-close').onclick = exitEditMode;
    document.getElementById('customy-send-btn').onclick = sendMessage;
    document.getElementById('customy-chat-input').onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };
    document.getElementById('customy-chat-input').oninput = (e) => {
      const btn = document.getElementById('customy-send-btn');
      btn.disabled = !e.target.value.trim();
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    };
  }

  function updateSelectionBar() {
    const bar = document.getElementById('customy-active-selector');
    if (selectedElement) {
      bar.textContent = getUniqueSelector(selectedElement);
      document.getElementById('customy-chat-input').focus();
    } else {
      bar.textContent = 'No element selected';
    }
  }

  function toggleMinimize() {
    isMinimized = !isMinimized;
    document.getElementById('customy-editor-container').classList.toggle('minimized', isMinimized);
  }

  function exitEditMode() {
    const url = new URL(window.location.href);
    url.searchParams.delete('edit');
    window.location.href = url.toString();
  }

  function appendMessage(role, text) {
    const history = document.getElementById('customy-chat-history');
    const msg = document.createElement('div');
    msg.className = `customy-msg ${role} customy-animate-in`;
    msg.textContent = text;
    history.appendChild(msg);
    history.scrollTop = history.scrollHeight;
    return msg;
  }

  function appendStatus(text) {
    const history = document.getElementById('customy-chat-history');
    const msg = document.createElement('div');
    msg.className = 'customy-msg status customy-animate-in';
    msg.textContent = text;
    history.appendChild(msg);
    history.scrollTop = history.scrollHeight;
    return msg;
  }

  async function sendMessage() {
    const input = document.getElementById('customy-chat-input');
    const btn = document.getElementById('customy-send-btn');
    const text = input.value.trim();
    if (!text || isStreaming) return;

    isStreaming = true;
    input.value = '';
    input.disabled = true;
    btn.disabled = true;

    appendMessage('user', text);
    const statusMsg = appendStatus('🤖 Planning changes...');
    const aiMsg = appendMessage('ai', '');
    
    // Extract projectId from URL /preview/:projectId/...
    const pathParts = window.location.pathname.split('/');
    const projectId = pathParts[2]; // /preview/PROJECT_ID/index.html

    const selector = selectedElement ? getUniqueSelector(selectedElement) : null;

    try {
      const token = localStorage.getItem('customy_token');
      const response = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text,
          selector: selector,
          history: [] // could persist if needed
        })
      });

      if (!response.ok) throw new Error('Failed to connect to AI');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let explanation = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'status') {
              statusMsg.textContent = `🤖 ${event.text}`;
            } else if (event.type === 'explanation') {
              explanation = event.text;
              aiMsg.textContent = explanation;
            } else if (event.type === 'done') {
              statusMsg.textContent = '✅ Changes applied! Reloading in 2s...';
              setTimeout(() => exitEditMode(), 2000);
            } else if (event.type === 'error') {
              throw new Error(event.text);
            }
          } catch(e) { /* ignore chunk errors */ }
        }
      }

    } catch (err) {
      statusMsg.textContent = `⚠️ Error: ${err.message}`;
    } finally {
      isStreaming = false;
      input.disabled = false;
      btn.disabled = false;
      input.focus();
    }
  }

  // ─── Initialize ────────────────────────────────────────────

  window.addEventListener('mouseover', handleMouseOver);
  window.addEventListener('click', handleClick, true);
  createUI();

})();
