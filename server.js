const http = require('http');
const fs = require('fs/promises');
const fscb = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const LANGS = new Set(['slo', 'eng', 'ita', 'de']);
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const menus = {};
const clientsByLang = new Map();
const menuWatchers = new Map();

function menuPath(lang) {
  return path.join(ROOT, `menu_${lang}.json`);
}

async function loadMenus() {
  for (const lang of LANGS) {
    await loadMenu(lang);
  }
}

async function loadMenu(lang) {
  const raw = await fs.readFile(menuPath(lang), 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`menu_${lang}.json must contain an array`);
  }
  menus[lang] = parsed;
  return parsed;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function broadcast(lang, data) {
  const clients = clientsByLang.get(lang) || [];
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach((res) => res.write(payload));
}

function startMenuWatchers() {
  for (const lang of LANGS) {
    const filePath = menuPath(lang);
    let reloadTimer = null;

    const watcher = fscb.watch(filePath, () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(async () => {
        try {
          const updatedMenu = await loadMenu(lang);
          broadcast(lang, updatedMenu);
        } catch (error) {
          console.error(`Failed to reload ${path.basename(filePath)}`, error);
        }
      }, 75);
    });

    watcher.on('error', (error) => {
      console.error(`File watcher error for ${path.basename(filePath)}`, error);
    });

    menuWatchers.set(lang, watcher);
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

async function serveStatic(reqPath, res) {
  const relativePath = reqPath === '/' ? '/index.html' : reqPath;
  const decoded = decodeURIComponent(relativePath);
  const safePath = path.normalize(decoded).replace(/^\.+[\\/]/, '');
  const absolutePath = path.join(ROOT, safePath);

  if (!absolutePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(absolutePath);
    if (stat.isDirectory()) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
    const headers = { 'Content-Type': contentType };
    if (ext === '.json') {
      headers['Cache-Control'] = 'no-store';
    }
    res.writeHead(200, headers);
    fscb.createReadStream(absolutePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathMatch = url.pathname.match(/^\/api\/(menu|stream)\/([a-z]+)$/);

  if (pathMatch) {
    const type = pathMatch[1];
    const lang = pathMatch[2];

    if (!LANGS.has(lang)) {
      sendJson(res, 404, { error: 'Unsupported language' });
      return;
    }

    if (type === 'menu' && req.method === 'GET') {
      try {
        const menu = await loadMenu(lang);
        sendJson(res, 200, menu);
      } catch (error) {
        console.error(`Failed to load menu_${lang}.json`, error);
        sendJson(res, 500, { error: 'Failed to load menu' });
      }
      return;
    }

    if (type === 'menu' && req.method === 'POST') {
      try {
        const parsed = await parseBody(req);
        if (!Array.isArray(parsed)) {
          sendJson(res, 400, { error: 'Menu payload must be an array' });
          return;
        }
        menus[lang] = parsed;
        await fs.writeFile(menuPath(lang), JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
        broadcast(lang, menus[lang]);
        sendJson(res, 200, { ok: true });
      } catch (error) {
        sendJson(res, 400, { error: error.message || 'Invalid request body' });
      }
      return;
    }

    if (type === 'stream' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });

      const clients = clientsByLang.get(lang) || [];
      clients.push(res);
      clientsByLang.set(lang, clients);

      res.write(`data: ${JSON.stringify(menus[lang])}\n\n`);

      req.on('close', () => {
        const current = clientsByLang.get(lang) || [];
        clientsByLang.set(lang, current.filter((client) => client !== res));
      });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  await serveStatic(url.pathname, res);
});

loadMenus()
  .then(() => {
    startMenuWatchers();
    server.listen(PORT, () => {
      console.log(`SOLIST CMS server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
  });
