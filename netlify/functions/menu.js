const fs = require('fs/promises');
const path = require('path');
const { connectLambda: connectNetlifyLambda, getStore: getNetlifyStore } = require('@netlify/blobs');

const LANGS = new Set(['slo', 'eng', 'ita', 'de']);
const STORE_NAME = 'solist-menus';
const DEFAULT_CMS_USERNAME = 'Oli';
const DEFAULT_CMS_PASSWORD = 'izvOli123';

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(data)
  };
}

function getHeader(headers, name) {
  const wanted = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === wanted);
  return entry ? entry[1] : '';
}

function isAuthorized(headers, cmsUsername, cmsPassword) {
  const header = getHeader(headers, 'authorization');
  const prefix = 'Basic ';
  if (!header.startsWith(prefix)) return false;

  const decoded = Buffer.from(header.slice(prefix.length), 'base64').toString('utf-8');
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) return false;

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  return username === cmsUsername && password === cmsPassword;
}

function getLang(event) {
  const queryLang = event.queryStringParameters && event.queryStringParameters.lang;
  if (queryLang) return queryLang;

  const pathMatch = (event.path || '').match(/\/api\/menu\/([a-z]+)$/);
  return pathMatch ? pathMatch[1] : null;
}

async function readSeedMenu(lang) {
  const fileName = `menu_${lang}.json`;
  const candidates = [
    path.join(process.cwd(), fileName),
    path.join(__dirname, fileName),
    path.join(__dirname, '..', '..', fileName)
  ];

  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf-8');
      return JSON.parse(raw);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  throw new Error(`Seed menu file not found for ${lang}`);
}

function createMenuHandler(options = {}) {
  const getStore = options.getStore || (() => getNetlifyStore(STORE_NAME));
  const connectLambda = options.connectLambda || (options.getStore ? async () => {} : connectNetlifyLambda);
  const loadSeedMenu = options.readSeedMenu || readSeedMenu;
  const cmsUsername = options.cmsUsername || process.env.CMS_USERNAME || DEFAULT_CMS_USERNAME;
  const cmsPassword = options.cmsPassword || process.env.CMS_PASSWORD || DEFAULT_CMS_PASSWORD;

  return async function handler(event) {
    await connectLambda(event);

    const lang = getLang(event);
    if (!LANGS.has(lang)) {
      return jsonResponse(404, { error: 'Unsupported language' });
    }

    const store = getStore();

    if (event.httpMethod === 'GET') {
      const savedMenu = await store.get(lang, { type: 'json', consistency: 'strong' });
      const menu = savedMenu || await loadSeedMenu(lang);
      return jsonResponse(200, menu);
    }

    if (event.httpMethod === 'POST') {
      if (!isAuthorized(event.headers, cmsUsername, cmsPassword)) {
        return jsonResponse(401, { error: 'Unauthorized' });
      }

      let parsed;
      try {
        parsed = event.body ? JSON.parse(event.body) : null;
      } catch {
        return jsonResponse(400, { error: 'Invalid JSON' });
      }

      if (!Array.isArray(parsed)) {
        return jsonResponse(400, { error: 'Menu payload must be an array' });
      }

      await store.setJSON(lang, parsed);
      return jsonResponse(200, { ok: true });
    }

    return jsonResponse(405, { error: 'Method not allowed' });
  };
}

exports.createMenuHandler = createMenuHandler;
exports.handler = createMenuHandler();
