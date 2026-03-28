/**
 * rateLimit.js – Express rate limiters.
 * Separate limits for auth endpoints (stricter) and API endpoints.
 */

import rateLimit from 'express-rate-limit';

/** Strict limiter for /auth routes to prevent brute-force */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

/** General API limiter */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Slow down your requests.' }
});

/** Stricter limiter for AI chat endpoint (costly per call) */
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI chat rate limit exceeded. Please wait a moment.' }
});
