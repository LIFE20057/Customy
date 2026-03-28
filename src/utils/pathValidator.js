/**
 * pathValidator.js – Prevents path traversal attacks.
 * All file operations must call validatePath() before touching the filesystem.
 */

import path from 'path';
import fs from 'fs';

/**
 * Resolves `userPath` relative to `baseDir` and ensures the result
 * is still within `baseDir`. Throws if traversal is detected.
 * @param {string} baseDir  – Absolute trusted base directory
 * @param {string} userPath – User-supplied path (may be relative)
 * @returns {string} Resolved absolute safe path
 */
export function validatePath(baseDir, userPath) {
  // Resolve both to absolute paths
  const resolved = path.resolve(baseDir, userPath);
  const base = path.resolve(baseDir);

  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error(`Path traversal detected: "${userPath}" escapes base directory.`);
  }

  return resolved;
}

/**
 * Ensures `dir` exists, creating it recursively if needed.
 * @param {string} dir – Absolute path
 */
export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Returns a recursive file tree for the given directory.
 * @param {string} dir        – Absolute path to scan
 * @param {string} [basePath] – Prefix to strip from returned paths (for display)
 * @returns {Array<{name, path, type, children?}>}
 */
export function buildFileTree(dir, basePath = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter(e => !e.name.startsWith('.customy-versions')) // hide internal dirs
    .map(entry => {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        return {
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children: buildFileTree(fullPath, basePath)
        };
      }
      return {
        name: entry.name,
        path: relativePath,
        type: 'file',
        size: fs.statSync(fullPath).size
      };
    });
}
