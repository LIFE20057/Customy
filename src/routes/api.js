/**
 * api.js – All protected API routes.
 * Requires JWT via authMiddleware on all routes.
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { apiLimiter, chatLimiter } from '../middleware/rateLimit.js';

import {
  listProjects,
  createProject,
  getProject,
  deleteProject
} from '../controllers/projectController.js';

import {
  listFiles,
  getFile,
  putFile,
  removeFile,
  listVersions,
  rollback
} from '../controllers/fileController.js';

import { handleChat } from '../controllers/aiController.js';

const router = Router();

// Apply auth to all API routes
router.use(authMiddleware);
router.use(apiLimiter);

// ─── Projects ────────────────────────────────────────────────────────────────
router.get('/projects',         listProjects);
router.post('/projects',        createProject);
router.get('/projects/:id',     getProject);
router.delete('/projects/:id',  deleteProject);

// ─── Files ───────────────────────────────────────────────────────────────────
router.get('/projects/:id/files',        listFiles);
router.get('/projects/:id/files/*',      getFile);
router.post('/projects/:id/files/*',     putFile);
router.delete('/projects/:id/files/*',   removeFile);

// ─── Versioning ───────────────────────────────────────────────────────────────
router.get('/projects/:id/versions',              listVersions);
router.post('/projects/:id/rollback/:version',    rollback);

// ─── AI Chat (SSE, stricter rate limit) ─────────────────────────────────────
router.post('/projects/:id/chat', chatLimiter, handleChat);

export default router;
