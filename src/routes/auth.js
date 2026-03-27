/**
 * auth.js routes – Login endpoint only.
 * POST /auth/login  → returns signed JWT
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/login', authLimiter, (req, res) => {
  const { username, password } = req.body;

  const validUser = process.env.ADMIN_USER || 'admin';
  const validPass = process.env.ADMIN_PASS || 'changeme';

  if (username !== validUser || password !== validPass) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const token = jwt.sign(
    { username, role: 'admin' },
    process.env.AUTH_SECRET || 'dev-secret-change-me',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  res.json({ token, username, role: 'admin' });
});

export default router;
