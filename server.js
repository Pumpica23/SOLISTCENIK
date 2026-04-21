const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'Oli';
const ADMIN_PASS = process.env.ADMIN_PASS || 'izvOli123';
const allowedLangs = new Set(['slo', 'eng', 'ita', 'de']);
const rootDir = __dirname;

const mimeByExt = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseBasicAuth(req) {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');
  if (type !== 'Basic' || !token) return null;
  const decoded = Buffer.from(token, 'base64').toString('utf8');
  const index = decoded.indexOf(':');
  if (index === -1) return null;
  return { user: decoded.slice(0, index), pass: decoded.slice(index + 1) };
}

function getMenuPath(lang) {
  if (!allowedLangs.has(lang)) return null;
  return path.join(rootDir, `menu_${lang}.json`);
}

function safeStaticPath(urlPath) {
  const cleanPath = urlPath === '/' ? '/index.html' : urlPath;
  const resolved = path.normalize(path.join(rootDir, cleanPath));
  if (!resolved.startsWith(rootDir)) return null;
  return resolved;
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 2 * 1024 * 1024) {
      throw new Error('Payload too large');
    }
  }
  return body;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname.startsWith('/api/menu/')) {
    const lang = url.pathname.split('/').pop();
    const filePath = getMenuPath(lang);
    if (!filePath) return sendJson(res, 404, { error: 'Unknown language.' });
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(raw);
      return sendJson(res, 200, data);
    } catch {
      return sendJson(res, 500, { error: 'Could not read menu file.' });
    }
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/menu/')) {
    const lang = url.pathname.split('/').pop();
    const filePath = getMenuPath(lang);
    if (!filePath) return sendJson(res, 404, { error: 'Unknown language.' });

    const auth = parseBasicAuth(req);
    if (!auth || auth.user !== ADMIN_USER || auth.pass !== ADMIN_PASS) {
      return sendJson(res, 401, { error: 'Unauthorized.' });
    }

    try {
      const rawBody = await readBody(req);
      const payload = JSON.parse(rawBody || 'null');
      if (!Array.isArray(payload)) {
        return sendJson(res, 400, { error: 'Menu payload must be an array.' });
      }
      await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 500, { error: 'Could not write menu file.' });
    }
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    const staticPath = safeStaticPath(url.pathname);
    if (!staticPath) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    try {
      const data = await fs.readFile(staticPath);
      const ext = path.extname(staticPath).toLowerCase();
      const contentType = mimeByExt[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      return req.method === 'HEAD' ? res.end() : res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`SOLIST CMS running on http://localhost:${PORT}`);
});
