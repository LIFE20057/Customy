/**
 * auth.js – JWT authentication middleware.
 * Attaches decoded user payload to req.user on success.
 */

import jwt from 'jsonwebtoken';

export function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized – no token provided.' });
  }

  try {
    req.user = jwt.verify(token, process.env.AUTH_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized – invalid or expired token.' });
  }
}
