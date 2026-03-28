/**
 * fileController.js – REST handlers for file operations inside a project.
 */

import path from 'path';
import { readFile, writeFile, deleteFile, getFileTree } from '../services/fileService.js';
import { listSnapshots, restoreSnapshot } from '../services/versionService.js';
import { getProjectDir } from '../services/fileService.js';

/** GET /api/projects/:id/files  – returns file tree */
export async function listFiles(req, res) {
  try {
    const tree = getFileTree(req.params.id);
    res.json({ tree });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

/** GET /api/projects/:id/files/*  – read a file */
export async function getFile(req, res) {
  try {
    const filePath = req.params[0];
    const content = readFile(req.params.id, filePath);
    res.json({ path: filePath, content });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

/** POST /api/projects/:id/files/*  – write/create a file */
export async function putFile(req, res) {
  try {
    const filePath = req.params[0];
    const { content = '' } = req.body;
    await writeFile(req.params.id, filePath, content);
    res.json({ message: `File "${filePath}" saved.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** DELETE /api/projects/:id/files/*  – delete a file */
export async function removeFile(req, res) {
  try {
    const filePath = req.params[0];
    await deleteFile(req.params.id, filePath);
    res.json({ message: `File "${filePath}" deleted.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** GET /api/projects/:id/versions  – list snapshots */
export async function listVersions(req, res) {
  try {
    const projectDir = getProjectDir(req.params.id);
    const snapshots = listSnapshots(projectDir);
    res.json({ snapshots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/** POST /api/projects/:id/rollback/:version  – restore a snapshot */
export async function rollback(req, res) {
  try {
    const projectDir = getProjectDir(req.params.id);
    await restoreSnapshot(projectDir, req.params.version);
    res.json({ message: `Rolled back to snapshot "${req.params.version}".` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
