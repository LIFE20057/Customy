/**
 * auth.js – Login page logic.
 * Handles form submit, token storage, theme, and redirect.
 */

const TOKEN_KEY = 'customy_token';
const USER_KEY  = 'customy_user';

// Theme toggle
const html   = document.documentElement;
const toggle = document.getElementById('themeToggle');
const saved  = localStorage.getItem('customy_theme') || 'dark';
html.setAttribute('data-theme', saved);
toggle.textContent = saved === 'dark' ? '🌙' : '☀️';
toggle.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('customy_theme', next);
  toggle.textContent = next === 'dark' ? '🌙' : '☀️';
});

// If already logged in, go to app
if (localStorage.getItem(TOKEN_KEY)) {
  location.href = '/';
}

const form   = document.getElementById('loginForm');
const errMsg = document.getElementById('errMsg');
const loginBtn = document.getElementById('loginBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errMsg.classList.remove('visible');
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in…';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify({ username: data.username, role: data.role }));
    location.href = '/';
  } catch (err) {
    errMsg.textContent = err.message;
    errMsg.classList.add('visible');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign in';
  }
});
