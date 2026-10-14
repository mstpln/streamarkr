// Zero-dependency static file server for running Streamarkr locally.
// Usage: node server.mjs [port]   (default port 8787)
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const SHELL_FILES = new Set(['/index.html', '/manifest.webmanifest', '/sw.js', '/sw-manifest.json', '/src/styles/main.css']);

function isPublicAsset(requestPath) {
  return SHELL_FILES.has(requestPath)
    || /^\/dist\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.js$/.test(requestPath)
    || /^\/public\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|svg|ico|webp|jpg|jpeg|gif)$/.test(requestPath);
}

export function createAppServer({ projectRoot = root } = {}) {
  const absoluteRoot = path.resolve(projectRoot);
  return http.createServer(async (req, res) => {
    const fail = (status, message) => {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(message);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      fail(405, 'Method not allowed');
      return;
    }
    let reqPath;
    try {
      reqPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    } catch {
      fail(400, 'Bad request');
      return;
    }
    if (reqPath.includes('\\') || reqPath.includes('\0')
        || reqPath.split('/').some((part) => part === '.' || part === '..')) {
      fail(403, 'Forbidden');
      return;
    }
    if (reqPath === '/') reqPath = '/index.html';
    if (!isPublicAsset(reqPath)) {
      fail(403, 'Forbidden');
      return;
    }
    try {
      // Validate the real target too: a public-looking symlink must not reveal private files.
      const canonicalRoot = await fs.realpath(absoluteRoot);
      const filePath = await fs.realpath(path.join(absoluteRoot, reqPath));
      const relativePath = path.relative(canonicalRoot, filePath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)
          || !isPublicAsset('/' + relativePath.split(path.sep).join('/'))) {
        fail(403, 'Forbidden');
        return;
      }
      const data = await fs.readFile(filePath);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      fail(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500,
        error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'Not found' : 'Unable to serve asset');
    }
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const port = Number(process.argv[2]) || 8787;
  createAppServer().listen(port, '0.0.0.0', () => {
    console.log(`Streamarkr is running at http://localhost:${port}`);
    console.log('Press Ctrl+C to stop.');
  });
}
