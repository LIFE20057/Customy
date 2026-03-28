/**
 * preview.js – Live preview iframe panel with device toggle.
 */

import { showToast } from './app.js';

const previewPane      = document.getElementById('previewPane');
const previewFrame     = document.getElementById('previewFrame');
const previewToggleBtn = document.getElementById('previewToggleBtn');
const refreshPreviewBtn = document.getElementById('refreshPreviewBtn');
const openPreviewBtn   = document.getElementById('openPreviewBtn');
const deviceButtons    = document.querySelectorAll('.device-toggle .icon-btn');

let currentProjectId = null;

export function initPreview() {
  previewToggleBtn.addEventListener('click', togglePreview);
  refreshPreviewBtn.addEventListener('click', () => {
    if (currentProjectId) refreshPreview(currentProjectId);
  });
  openPreviewBtn.addEventListener('click', () => {
    if (currentProjectId) {
      window.open(`/preview/${currentProjectId}/`, '_blank');
    }
  });

  // Device Toggle logic
  deviceButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const device = btn.dataset.device;
      
      // Update UI
      deviceButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update Frame
      previewFrame.className = device;
    });
  });
}

export function refreshPreview(projectId) {
  if (!projectId) {
    previewFrame.src = 'about:blank';
    currentProjectId = null;
    return;
  }
  currentProjectId = projectId;
  const url = `/preview/${projectId}/index.html?_t=${Date.now()}`;
  previewFrame.src = url;
  if (openPreviewBtn) openPreviewBtn.title = `Open preview of ${projectId}`;
}

function togglePreview() {
  previewPane.classList.toggle('hidden');
  previewToggleBtn.title = previewPane.classList.contains('hidden')
    ? 'Show preview'
    : 'Hide preview';
}
