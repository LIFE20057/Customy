/**
 * previewInjector.js – Intercepts HTML responses from /preview/:projectId
 * and injects the editor script/styles when in edit mode.
 */

import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

export function previewInjector(req, res, next) {
  // We only care about GET requests for HTML files (or directories, which serve index.html)
  if (req.method !== 'GET') return next();

  const isEditMode = req.query.edit === 'true';
  const siteDir = process.env.SITE_DIR || './site';
  const projectId = req.params.projectId;

  // Reconstruct the file path
  // The middleware is mounted at /preview/:projectId
  // req.path will be the subpath (e.g. / or /index.html or /css/style.css)
  let subPath = req.path;
  if (subPath.endsWith('/')) subPath += 'index.html';
  
  const fullPath = path.join(ROOT_DIR, siteDir, projectId, subPath);

  // We only inject into HTML files
  if (!fullPath.endsWith('.html')) return next();

  if (!fs.existsSync(fullPath)) return next();

  if (isEditMode) {
    try {
      let content = fs.readFileSync(fullPath, 'utf8');

      // Inject styles before </head>
      const styles = `
    <!-- Customy Editor Overlay Styles -->
    <link rel="stylesheet" href="/css/editor-overlay.css">
    `;
      content = content.replace('</head>', `${styles}\n</head>`);

      // Inject script before </body>
      // We also inject the projectId as a global variable so the script knows where it is
      const script = `
    <!-- Customy Editor Injector Script -->
    <script>window.__CUSTOMY_PROJECT_ID__ = "${projectId}";</script>
    <script type="module" src="/js/editor-injector.js"></script>
    `;
      content = content.replace('</body>', `${script}\n</body>`);

      return res.send(content);
    } catch (err) {
      console.error('[previewInjector] Injection failed:', err.message);
      return next();
    }
  }

  next();
}
