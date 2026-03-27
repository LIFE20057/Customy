/**
 * projectController.js – Project management.
 * Projects = top-level folders under SITE_DIR.
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { validatePath, ensureDir } from '../utils/pathValidator.js';

function getSiteDir() {
  return path.resolve(process.env.SITE_DIR || './site');
}

/**
 * GET /api/projects
 * Lists all project folders.
 */
export async function listProjects(req, res) {
  try {
    const siteDir = getSiteDir();
    ensureDir(siteDir);

    const entries = fs.readdirSync(siteDir, { withFileTypes: true })
      .filter(e => e.isDirectory());

    const projects = entries.map(dir => {
      const metaPath = path.join(siteDir, dir.name, 'project.json');
      let meta = { name: dir.name, description: '' };
      try { meta = { ...meta, ...JSON.parse(fs.readFileSync(metaPath, 'utf-8')) }; } catch {}
      return { id: dir.name, ...meta };
    });

    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/projects
 * Creates a new project folder with project.json.
 * Body: { name, description? }
 */
export async function createProject(req, res) {
  try {
    const { name, description = '' } = req.body;
    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'Project name must contain only letters, numbers, hyphens, underscores.' });
    }

    const siteDir = getSiteDir();
    const projectDir = validatePath(siteDir, name);

    if (fs.existsSync(projectDir)) {
      return res.status(409).json({ error: `Project "${name}" already exists.` });
    }

    ensureDir(projectDir);

    const meta = {
      id: uuidv4(),
      name,
      description,
      created: new Date().toISOString(),
      chatHistory: []
    };
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(meta, null, 2), 'utf-8');

    // Bootstrap with a minimal index.html
    fs.writeFileSync(path.join(projectDir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0f172a; color: #e2e8f0; }
    .card { text-align: center; padding: 3rem; background: #1e293b; border-radius: 1rem; }
    h1 { font-size: 2.5rem; margin: 0 0 1rem; color: #7c3aed; }
    p { color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${name}</h1>
    <p>Your new Customy project. Start chatting to build your website!</p>
  </div>
</body>
</html>`, 'utf-8');

    res.status(201).json({ project: { id: name, ...meta } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/projects/:id
 */
export async function deleteProject(req, res) {
  try {
    const { id } = req.params;
    const siteDir = getSiteDir();
    const projectDir = validatePath(siteDir, id);

    if (!fs.existsSync(projectDir)) {
      return res.status(404).json({ error: `Project "${id}" not found.` });
    }

    fs.rmSync(projectDir, { recursive: true, force: true });
    res.json({ message: `Project "${id}" deleted.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/projects/:id
 * Returns project metadata.
 */
export async function getProject(req, res) {
  try {
    const { id } = req.params;
    const siteDir = getSiteDir();
    const projectDir = validatePath(siteDir, id);
    const metaPath = path.join(projectDir, 'project.json');

    if (!fs.existsSync(metaPath)) {
      return res.status(404).json({ error: `Project "${id}" not found.` });
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    res.json({ project: meta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
