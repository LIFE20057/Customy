/**
 * fileService.js – Safe file system operations.
 *
 * All writes automatically snapshot the project first.
 * All paths are validated via pathValidator to prevent traversal attacks.
 */

import fs from 'fs';
import path from 'path';
import { validatePath, buildFileTree, ensureDir } from '../utils/pathValidator.js';
import { createSnapshot } from './versionService.js';

/**
 * Returns the resolved project directory.
 * @param {string} projectId
 * @returns {string} Absolute path
 */
export function getProjectDir(projectId) {
  const siteDir = path.resolve(process.env.SITE_DIR || './site');
  return validatePath(siteDir, projectId);
}

/**
 * Reads a file inside a project.
 * @param {string} projectId
 * @param {string} filePath – Relative path within project
 * @returns {string} File contents (UTF-8)
 */
export function readFile(projectId, filePath) {
  const projectDir = getProjectDir(projectId);
  const safe = validatePath(projectDir, filePath);
  return fs.readFileSync(safe, 'utf-8');
}

/**
 * Writes a file inside a project (creates dirs as needed).
 * Snapshots the project first unless skipSnapshot is true.
 * @param {string}  projectId
 * @param {string}  filePath
 * @param {string}  content
 * @param {boolean} [skipSnapshot=false]
 */
export async function writeFile(projectId, filePath, content, skipSnapshot = false) {
  const projectDir = getProjectDir(projectId);
  const safe = validatePath(projectDir, filePath);

  if (!skipSnapshot) {
    await createSnapshot(projectDir, `before-edit-${path.basename(filePath)}`);
  }

  ensureDir(path.dirname(safe));
  fs.writeFileSync(safe, content, 'utf-8');
}

/**
 * Deletes a file inside a project.
 * @param {string} projectId
 * @param {string} filePath
 */
export async function deleteFile(projectId, filePath) {
  const projectDir = getProjectDir(projectId);
  const safe = validatePath(projectDir, filePath);

  await createSnapshot(projectDir, `before-delete-${path.basename(filePath)}`);
  fs.unlinkSync(safe);
}

/**
 * Returns the recursive file tree for a project.
 * @param {string} projectId
 */
export function getFileTree(projectId) {
  const projectDir = getProjectDir(projectId);
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project "${projectId}" does not exist.`);
  }
  return buildFileTree(projectDir, projectDir);
}

/**
 * Applies a batch of AI-generated FileActions to the project.
 * A single snapshot is taken before any action is applied.
 *
 * Supported actions: create_file, update_file, delete_file, refactor_file
 *
 * @param {string}      projectId
 * @param {FileAction[]} actions
 * @returns {string[]} List of applied action descriptions
 */
export async function applyActions(projectId, actions) {
  const projectDir = getProjectDir(projectId);

  // Single snapshot for the whole batch
  await createSnapshot(projectDir, 'ai-batch');

  const results = [];
  for (const action of actions) {
    const { type, path: filePath, content } = action;
    const safe = validatePath(projectDir, filePath);

    switch (type) {
      case 'create_file':
      case 'update_file':
      case 'refactor_file': {
        ensureDir(path.dirname(safe));
        fs.writeFileSync(safe, content ?? '', 'utf-8');
        results.push(`${type}: ${filePath}`);
        break;
      }
      case 'delete_file': {
        if (fs.existsSync(safe)) {
          fs.unlinkSync(safe);
          results.push(`delete_file: ${filePath}`);
        }
        break;
      }
      default:
        results.push(`unknown_action: ${type} – skipped`);
    }
  }
  return results;
}
