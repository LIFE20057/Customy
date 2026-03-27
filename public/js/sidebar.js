/**
 * sidebar.js – Project sidebar: list, select, create, delete projects.
 */

import { authFetch, showToast, getActiveProject, setActiveProject } from './app.js';
import { loadChat } from './chat.js';
import { refreshPreview } from './preview.js';

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
}

async function loadProjects() {
  try {
    const res = await authFetch('/api/projects');
    const data = await res.json();
    projects = data.projects || [];
    renderProjects();
  } catch {
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
      <span class="p-icon" aria-hidden="true">🗂</span>
      <span class="p-name">${p.name}</span>
    </div>
  `).join('');

  projectList.querySelectorAll('.project-item').forEach(item => {
    item.addEventListener('click', () => selectProject(item.dataset.id));
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectProject(item.dataset.id); });
  });

  // Re-select active project if present
  const ap = getActiveProject();
  if (ap) highlightProject(ap.id);
}

export function selectProject(id) {
  const project = projects.find(p => p.id === id);
  if (!project) return;
  setActiveProject(project);

  projectTitle.textContent = `📁 ${project.name}${project.description ? ' — ' + project.description : ''}`;
  highlightProject(id);

  editorBtn.disabled = false;
  loadChat(project);
  refreshPreview(project.id);

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
    refreshPreview(project.id);
  } catch (err) {
    showToast(err.message, 'error');
  }
}
