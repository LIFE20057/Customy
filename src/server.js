/**
 * server.js – Customy CMS entry point.
 *
 * - HTTP server (always on PORT)
 * - Optional HTTPS server (on HTTPS_PORT) when cert + key exist
 * - Serves static frontend from /public
 * - Serves project sites from /site/:project at /preview/:project
 */

import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import https from 'https';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

import authRoutes from './routes/auth.js';
import apiRoutes  from './routes/api.js';
import { previewInjector } from './middleware/previewInjector.js';

const app  = express();
const PORT = parseInt(process.env.PORT  || '3000', 10);
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3443', 10);

// ─── Security middleware ───────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'https://unpkg.com'],
      styleSrc:   ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
      fontSrc:    ["'self'", 'fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:', 'blob:', 'https://images.unsplash.com'],
      frameSrc:   ["'self'"],
      connectSrc: ["'self'", 'https://unpkg.com']
    }
  }
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── HTTP → HTTPS redirect (if HTTPS is active) ───────────────────────────────
const certPath = process.env.CERT_PATH;
const keyPath  = process.env.KEY_PATH;
const httpsEnabled = certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath);

if (httpsEnabled) {
  app.use((req, res, next) => {
    if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.hostname}:${HTTPS_PORT}${req.url}`);
    }
    next();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api',  apiRoutes);

// Live preview: serve project files as static site
// GET /preview/:projectId/...  → SITE_DIR/:projectId/...
app.use('/preview/:projectId', previewInjector, (req, res, next) => {
  const siteDir = process.env.SITE_DIR || './site';
  const projectId = req.params.projectId;
  const staticPath = path.join(ROOT_DIR, siteDir, projectId);
  
  // If the injector already sent a response (HTML), express.static will just skip
  express.static(staticPath)(req, res, next);
});

// Serve the main SPA from /public
const publicPath = path.join(ROOT_DIR, 'public');
app.use(express.static(publicPath));

// SPA fallback – anything not matched returns index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

console.log(`📂 Serving static files from: ${publicPath}`);

// ─── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

// ─── Start servers ────────────────────────────────────────────────────────────
const httpServer = http.createServer(app);
httpServer.listen(PORT, () => {
  console.log(`🚀 Customy HTTP  → http://localhost:${PORT}`);
});

if (httpsEnabled) {
  const sslOptions = {
    cert: fs.readFileSync(certPath),
    key:  fs.readFileSync(keyPath)
  };
  const httpsServer = https.createServer(sslOptions, app);
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`🔒 Customy HTTPS → https://localhost:${HTTPS_PORT}`);
  });
} else {
  console.log('ℹ️  HTTPS not enabled (no certs found). Set CERT_PATH and KEY_PATH in .env to enable.');
}
