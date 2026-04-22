const assert = require('assert');
const { once } = require('events');
const fs = require('fs/promises');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('node:test');

const LANGS = ['slo', 'eng', 'ita', 'de'];

function freePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function waitForServer(child, port) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/menu/slo`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error('server did not start');
}

async function startFixtureServer() {
  const repoRoot = path.join(__dirname, '..');
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'solist-menu-'));
  await fs.copyFile(path.join(repoRoot, 'server.js'), path.join(tempDir, 'server.js'));

  for (const lang of LANGS) {
    await fs.writeFile(
      path.join(tempDir, `menu_${lang}.json`),
      JSON.stringify([{ category: `${lang} initial`, items: [] }], null, 2) + '\n',
      'utf-8'
    );
  }

  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: tempDir,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.resume();
  child.stderr.resume();

  await waitForServer(child, port);

  async function stop() {
    if (child.exitCode === null) {
      child.kill();
      await once(child, 'exit');
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  return { port, tempDir, stop };
}

function readSseMessages(port, lang, count) {
  return new Promise((resolve, reject) => {
    const received = [];
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error(`timed out waiting for ${count} SSE messages`));
    }, 5000);
    const req = http.get(`http://127.0.0.1:${port}/api/stream/${lang}`, (res) => {
      res.setEncoding('utf-8');
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk;
        const messages = buffer.split('\n\n');
        buffer = messages.pop();
        for (const message of messages) {
          const dataLine = message.split('\n').find((line) => line.startsWith('data: '));
          if (!dataLine) continue;
          received.push(JSON.parse(dataLine.slice('data: '.length)));
        }
        if (received.length >= count) {
          clearTimeout(timeout);
          req.destroy();
          resolve(received);
        }
      });
    });
    req.on('error', (error) => {
      if (error.code !== 'ECONNRESET') {
        clearTimeout(timeout);
        reject(error);
      }
    });
  });
}

test('GET reloads menu changes made on disk while server is running', async () => {
  const server = await startFixtureServer();
  try {
    const nextMenu = [{ category: 'slo changed on disk', items: [] }];
    await fs.writeFile(
      path.join(server.tempDir, 'menu_slo.json'),
      JSON.stringify(nextMenu, null, 2) + '\n',
      'utf-8'
    );

    const response = await fetch(`http://127.0.0.1:${server.port}/api/menu/slo`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), nextMenu);
  } finally {
    await server.stop();
  }
});

test('stream subscribers receive menu changes made on disk', async () => {
  const server = await startFixtureServer();
  try {
    const messages = readSseMessages(server.port, 'eng', 2);
    const nextMenu = [{ category: 'eng changed on disk', items: [] }];
    await fs.writeFile(
      path.join(server.tempDir, 'menu_eng.json'),
      JSON.stringify(nextMenu, null, 2) + '\n',
      'utf-8'
    );

    assert.deepEqual(await messages, [[{ category: 'eng initial', items: [] }], nextMenu]);
  } finally {
    await server.stop();
  }
});
