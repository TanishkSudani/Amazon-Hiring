/**
 * Amazon Client System — Backend Node.js Server
 * Built with native Node.js HTTP & File System modules (Zero external dependencies).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// MIME types for static asset serving
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ─── BACKEND REST API ENDPOINTS ────────────────────────────────
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'Amazon Shift Automation Backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime())
    }));
    return;
  }

  if (pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      system: 'Amazon Client System & Shift Automation',
      version: '61.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      activePortals: ['hiring.amazon.ca', 'hiring.amazon.com', 'amazon.jobs']
    }));
    return;
  }

  // ─── FRONTEND STATIC FILE SERVING ──────────────────────────────
  if (pathname === '/' || pathname === '/index.html') {
    pathname = '/login.html';
  }

  const filePath = path.join(FRONTEND_DIR, pathname);

  // Security: Prevent directory traversal
  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(`<h2>404 Not Found</h2><p>Resource not found at ${pathname}</p><p><a href="/login.html">Return to Login</a></p>`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Amazon Client System Backend Server Active!`);
    console.log(`📡 URL: http://localhost:${PORT}/login.html`);
    console.log(`⚙️  API: http://localhost:${PORT}/api/health`);
    console.log(`📂 Frontend Root: ${FRONTEND_DIR}`);
    console.log(`====================================================`);
  });
}

module.exports = server;
