/**
 * app.js – Customy SPA bootstrap.
 * Initialises theme, auth guard, and wires together all modules.
 */

import { initSidebar } from './sidebar.js';
import { initChat }    from './chat.js';
import { initPreview } from './preview.js';
import { initEditor }  from './editor.js';

export const TOKEN_KEY = 'customy_token';
export const THEME_KEY = 'customy_theme';

// ─── Auth guard ───────────────────────────────────────────────────────────────
const token = localStorage.getItem(TOKEN_KEY);
if (!token) { location.href = '/login.html'; }

export function getToken() { return localStorage.getItem(TOKEN_KEY); }

export function authFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...(options.headers || {})
    }
  });
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const html         = document.documentElement;
const themeToggle  = document.getElementById('themeToggle');
const savedTheme   = localStorage.getItem(THEME_KEY) || 'dark';
html.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

themeToggle.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  themeToggle.textContent = next === 'dark' ? '🌙' : '☀️';
});

// ─── Logout ───────────────────────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('customy_user');
  location.href = '/login.html';
});

// ─── Toast system ─────────────────────────────────────────────────────────────
const toastContainer = document.getElementById('toastContainer');

export function showToast(message, type = 'info', duration = 3500) {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  toastContainer.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// ─── Sidebar toggle ───────────────────────────────────────────────────────────
const sidebar       = document.getElementById('sidebar');
const expandBtn     = document.getElementById('expandSidebar');
const collapseBtn   = document.getElementById('collapseSidebar');
const mobileBtn     = document.getElementById('mobileSidebarBtn');

function isMobile() { return window.innerWidth <= 768; }

function updateSidebarControls() {
  if (isMobile()) {
    expandBtn.style.display  = 'none';
    mobileBtn.style.display  = 'flex';
    collapseBtn.style.display = 'none';
  } else {
    mobileBtn.style.display  = 'none';
    const collapsed = sidebar.classList.contains('collapsed');
    expandBtn.style.display  = collapsed ? 'flex' : 'none';
    collapseBtn.style.display = collapsed ? 'none' : 'flex';
  }
}

collapseBtn.addEventListener('click', () => {
  sidebar.classList.add('collapsed');
  expandBtn.style.display = 'flex';
  collapseBtn.style.display = 'none';
});
expandBtn.addEventListener('click', () => {
  sidebar.classList.remove('collapsed');
  expandBtn.style.display = 'none';
  collapseBtn.style.display = 'flex';
});
mobileBtn.addEventListener('click', () => {
  sidebar.classList.toggle('mobile-open');
});
window.addEventListener('resize', updateSidebarControls);
updateSidebarControls();

// ─── Shared state (active project) ───────────────────────────────────────────
let activeProject = null;

export function getActiveProject()        { return activeProject; }
export function setActiveProject(project) { activeProject = project; }

// ─── Initialise modules ───────────────────────────────────────────────────────
initSidebar();
initChat();
initPreview();
initEditor();
