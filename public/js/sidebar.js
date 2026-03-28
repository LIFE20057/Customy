/**
 * sidebar.js – Project sidebar: list, select, create, delete projects.
 */

import { authFetch, showToast, getActiveProject, setActiveProject } from './app.js';
import { loadChat } from './chat.js';

const projectList     = document.getElementById('projectList');
const projectTitle    = document.getElementById('projectTitle');
const newProjectBtn   = document.getElementById('newProjectBtn');
const newProjectModal = document.getElementById('newProjectModal');
const cancelBtn       = document.getElementById('cancelProjectBtn');
const confirmBtn      = document.getElementById('confirmProjectBtn');
const nameInput       = document.getElementById('newProjectName');
const descInput       = document.getElementById('newProjectDesc');
const editorBtn       = document.getElementById('editorBtn');
const versionsBtn     = document.getElementById('versionsBtn');
const versionsPanel   = document.getElementById('versionsPanel');
const closeVersionsBtn = document.getElementById('closeVersionsBtn');
const versionList     = document.getElementById('versionList');
const editModeBtn     = document.getElementById('editModeBtn');
const openPreviewBtn   = document.getElementById('openPreviewBtn');

let projects = [];

export function initSidebar() {
  loadProjects();
  newProjectBtn.addEventListener('click', openModal);
  cancelBtn.addEventListener('click', closeModal);
  confirmBtn.addEventListener('click', createProject);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') createProject(); });
  newProjectModal.addEventListener('click', e => { if (e.target === newProjectModal) closeModal(); });

  versionsBtn.addEventListener('click', loadVersions);
  closeVersionsBtn.addEventListener('click', () => versionsPanel.classList.remove('open'));

  editModeBtn.addEventListener('click', () => {
    const p = getActiveProject();
    if (p) window.open(`/preview/${p.id}/?edit=true`, '_blank');
  });
  openPreviewBtn.addEventListener('click', () => {
    const p = getActiveProject();
    if (p) window.open(`/preview/${p.id}/`, '_blank');
  });
}

async function loadProjects() {
  try {
    const res = await authFetch('/api/projects');
    if (!res.ok) throw new Error('Unauthorized');
    const data = await res.json();
    projects = data.projects || [];
    renderProjects();
  } catch (err) {
    if (err.message === 'Unauthorized') {
       localStorage.removeItem('customy_token');
       location.href = '/login.html';
    }
    showToast('Failed to load projects', 'error');
  }
}

function renderProjects() {
  if (projects.length === 0) {
    projectList.innerHTML = '<div class="project-item" style="color:var(--text-muted);font-size:0.82rem">No projects yet. Create one!</div>';
    return;
  }
  projectList.innerHTML = projects.map(p => `
    <div class="project-item" role="listitem" data-id="${p.id}" tabindex="0" aria-label="Project: ${p.name}">
      <span class="p-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
      </span>
      <span class="p-name">${p.name}</span>
      <button class="delete-project-btn" title="Delete project" aria-label="Delete project ${p.name}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      </button>
    </div>
  `).join('');

  projectList.querySelectorAll('.project-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.delete-project-btn');
      if (deleteBtn) {
        e.stopPropagation();
        confirmDeleteProject(item.dataset.id);
      } else {
        selectProject(item.dataset.id);
      }
    });
    item.addEventListener('keydown', e => { 
      if (e.key === 'Enter' || e.key === ' ') selectProject(item.dataset.id); 
    });
  });

  // Re-select active project if present
  const ap = getActiveProject();
  if (ap) highlightProject(ap.id);
}

export function selectProject(id) {
  const project = projects.find(p => p.id === id);
  if (!project) return;
  setActiveProject(project);

  projectTitle.innerHTML = `
    <span style="opacity:0.6;font-weight:400;margin-right:8px">Project:</span>
    ${project.name}${project.description ? ' <span style="color:var(--text-muted);font-weight:400;margin-left:8px;font-size:0.9rem">— ' + project.description + '</span>' : ''}
  `;
  highlightProject(id);

  editorBtn.disabled = false;
  editModeBtn.disabled = false;
  openPreviewBtn.disabled = false;
  loadChat(project);

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('mobile-open');
}

function highlightProject(id) {
  projectList.querySelectorAll('.project-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
}

function openModal() {
  nameInput.value = '';
  descInput.value = '';
  newProjectModal.classList.add('open');
  setTimeout(() => nameInput.focus(), 50);
}

function closeModal() {
  newProjectModal.classList.remove('open');
}

async function createProject() {
  const name = nameInput.value.trim();
  const desc = descInput.value.trim();
  if (!name) { nameInput.focus(); return; }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    showToast('Name must contain only letters, numbers, hyphens, underscores', 'error');
    return;
  }
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Creating…';
  try {
    const res = await authFetch('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description: desc })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    closeModal();
    showToast(`Project "${name}" created!`, 'success');
    await loadProjects();
    selectProject(name);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Create Project';
  }
}

async function loadVersions() {
  const project = getActiveProject();
  if (!project) { showToast('Select a project first', 'error'); return; }
  versionsPanel.classList.add('open');
  versionList.innerHTML = '<div style="padding:1rem;color:var(--text-muted);font-size:0.85rem">Loading…</div>';
  try {
    const res  = await authFetch(`/api/projects/${project.id}/versions`);
    const data = await res.json();
    if (!data.snapshots?.length) {
      versionList.innerHTML = '<div style="padding:1rem;color:var(--text-muted);font-size:0.85rem">No snapshots yet.</div>';
      return;
    }
    versionList.innerHTML = data.snapshots.map(s => `
      <div class="version-item" role="listitem" tabindex="0" data-filename="${s.filename}">
        <div class="v-name">${s.filename}</div>
        <div class="v-date">${new Date(s.created).toLocaleString()}</div>
        <div class="v-size">${(s.size / 1024).toFixed(1)} KB</div>
      </div>
    `).join('');
    versionList.querySelectorAll('.version-item').forEach(el => {
      el.addEventListener('click', () => rollbackTo(el.dataset.filename));
    });
  } catch {
    versionList.innerHTML = '<div style="padding:1rem;color:#f87171;font-size:0.85rem">Failed to load.</div>';
  }
}

async function rollbackTo(filename) {
  const project = getActiveProject();
  if (!confirm(`Restore snapshot "${filename}"? Current state will be backed up first.`)) return;
  try {
    const res = await authFetch(`/api/projects/${project.id}/rollback/${encodeURIComponent(filename)}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Rolled back successfully!', 'success');
    versionsPanel.classList.remove('open');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
async function confirmDeleteProject(id) {
  const project = projects.find(p => p.id === id);
  if (!project) return;

  if (!confirm(`Are you sure you want to delete project "${project.name}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const res = await authFetch(`/api/projects/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(`Project "${project.name}" deleted.`, 'success');

    // Visual feedback: fade out the item
    const item = projectList.querySelector(`.project-item[data-id="${id}"]`);
    if (item) {
      item.style.opacity = '0';
      item.style.transform = 'scale(0.95)';
      item.style.transition = 'all 0.3s ease';
    }

    // If active project was deleted, reset UI
    const ap = getActiveProject();
    if (ap && ap.id === id) {
      setActiveProject(null);
      projectTitle.textContent = 'Select a project to begin';
      editorBtn.disabled = true;
      editModeBtn.disabled = true;
      openPreviewBtn.disabled = true;
      document.getElementById('welcomeScreen').classList.remove('hidden');
      document.getElementById('messages').classList.add('hidden');
    }

    // Delay reload to let animation finish
    setTimeout(async () => {
      await loadProjects();
    }, 300);
  } catch (err) {
    showToast(err.message, 'error');
  }
}
