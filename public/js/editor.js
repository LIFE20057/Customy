/**
 * editor.js – Advanced code editor panel using CodeMirror (loaded from CDN).
 * Provides file tree, syntax-highlighted editor, and manual save.
 */

import { authFetch, showToast, getActiveProject } from './app.js';

const editorPanel   = document.getElementById('editorPanel');
const editorBtn     = document.getElementById('editorBtn');
const closeEditorBtn = document.getElementById('closeEditorBtn');
const saveFileBtn   = document.getElementById('saveFileBtn');
const fileTreeEl    = document.getElementById('fileTree');
const filenameEl    = document.getElementById('editorFilename');
const codeAreaEl    = document.getElementById('codeEditorArea');

let cmEditor    = null;
let currentFile = null;

export function initEditor() {
  editorBtn.addEventListener('click', openEditor);
  closeEditorBtn.addEventListener('click', closeEditor);
  saveFileBtn.addEventListener('click', saveFile);
  editorPanel.addEventListener('click', e => {
    if (e.target === editorPanel) closeEditor();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && editorPanel.classList.contains('open')) closeEditor();
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && editorPanel.classList.contains('open')) {
      e.preventDefault();
      saveFile();
    }
  });
}

function openEditor() {
  const project = getActiveProject();
  if (!project) return;
  editorPanel.classList.add('open');
  loadFileTree(project.id);

  if (!cmEditor) {
    cmEditor = window.CodeMirror(codeAreaEl, {
      theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dracula' : 'default',
      lineNumbers: true,
      mode: 'htmlmixed',
      tabSize: 2,
      indentWithTabs: false,
      lineWrapping: true,
      autofocus: false
    });
    codeAreaEl.style.height = 'calc(100% - 0px)';
    cmEditor.setSize('100%', '100%');
  }

  // Sync theme
  cmEditor.setOption('theme', document.documentElement.getAttribute('data-theme') === 'dark' ? 'dracula' : 'default');
}

function closeEditor() {
  editorPanel.classList.remove('open');
}

async function loadFileTree(projectId) {
  fileTreeEl.innerHTML = '<div style="padding:0.5rem;color:var(--text-muted);font-size:0.8rem">Loading…</div>';
  try {
    const res  = await authFetch(`/api/projects/${projectId}/files`);
    const data = await res.json();
    fileTreeEl.innerHTML = '';
    renderTree(data.tree || [], fileTreeEl, '', projectId);
  } catch {
    fileTreeEl.innerHTML = '<div style="padding:0.5rem;color:#f87171;font-size:0.8rem">Failed to load files.</div>';
  }
}

function renderTree(nodes, container, prefix, projectId) {
  nodes.forEach(node => {
    const el = document.createElement('div');
    if (node.type === 'directory') {
      el.className = 'file-tree-item file-tree-dir';
      el.innerHTML = `<span aria-hidden="true">📁</span> ${node.name}`;
      container.appendChild(el);
      if (node.children?.length) {
        const sub = document.createElement('div');
        sub.style.paddingLeft = '1rem';
        renderTree(node.children, sub, prefix + node.name + '/', projectId);
        container.appendChild(sub);
      }
    } else {
      el.className = 'file-tree-item';
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'treeitem');
      el.setAttribute('aria-label', `File: ${node.name}`);
      el.innerHTML = `<span aria-hidden="true">${fileIcon(node.name)}</span> ${node.name}`;
      el.dataset.path = node.path;
      el.addEventListener('click', () => openFile(projectId, node.path));
      el.addEventListener('keydown', e => { if (e.key === 'Enter') openFile(projectId, node.path); });
      container.appendChild(el);
    }
  });
}

async function openFile(projectId, filePath) {
  try {
    const res  = await authFetch(`/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    currentFile = { projectId, filePath };
    filenameEl.textContent = filePath;

    const mode = detectMode(filePath);
    cmEditor.setOption('mode', mode);
    cmEditor.setValue(data.content || '');
    cmEditor.clearHistory();

    // Highlight active
    fileTreeEl.querySelectorAll('.file-tree-item').forEach(el => {
      el.classList.toggle('active', el.dataset.path === filePath);
    });
  } catch (err) {
    showToast(`Could not open file: ${err.message}`, 'error');
  }
}

async function saveFile() {
  if (!currentFile || !cmEditor) return;
  const { projectId, filePath } = currentFile;
  saveFileBtn.disabled = true;
  saveFileBtn.textContent = '💾 Saving…';
  try {
    const res = await authFetch(`/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`, {
      method: 'POST',
      body: JSON.stringify({ content: cmEditor.getValue() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(`Saved: ${filePath}`, 'success');

    // Refresh preview
    const { refreshPreview } = await import('./preview.js');
    refreshPreview(projectId);
  } catch (err) {
    showToast(`Save failed: ${err.message}`, 'error');
  } finally {
    saveFileBtn.disabled = false;
    saveFileBtn.textContent = '💾 Save';
  }
}

function detectMode(filename) {
  if (filename.endsWith('.html') || filename.endsWith('.htm')) return 'htmlmixed';
  if (filename.endsWith('.css')) return 'css';
  if (filename.endsWith('.js') || filename.endsWith('.mjs')) return 'javascript';
  if (filename.endsWith('.json')) return { name: 'javascript', json: true };
  return 'text';
}

function fileIcon(name) {
  if (name.endsWith('.html') || name.endsWith('.htm')) return '🌐';
  if (name.endsWith('.css')) return '🎨';
  if (name.endsWith('.js'))  return '⚡';
  if (name.endsWith('.json')) return '{}';
  if (name.endsWith('.md'))  return '📄';
  if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(name)) return '🖼';
  return '📄';
}
