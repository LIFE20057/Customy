/**
 * preview.js – Live preview iframe panel.
 */

import { showToast } from './app.js';

const previewPane      = document.getElementById('previewPane');
const previewFrame     = document.getElementById('previewFrame');
const previewToggleBtn = document.getElementById('previewToggleBtn');
const refreshPreviewBtn = document.getElementById('refreshPreviewBtn');
const openPreviewBtn   = document.getElementById('openPreviewBtn');

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
}

export function refreshPreview(projectId) {
  currentProjectId = projectId;
  const url = `/preview/${projectId}/index.html?_t=${Date.now()}`;
  previewFrame.src = url;
  openPreviewBtn.title = `Open preview of ${projectId}`;
}

function togglePreview() {
  previewPane.classList.toggle('hidden');
  previewToggleBtn.title = previewPane.classList.contains('hidden')
    ? 'Show preview'
    : 'Hide preview';
}
