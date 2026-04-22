const assert = require('assert');
const test = require('node:test');

const { createMenuHandler } = require('../netlify/functions/menu');

function event(method, lang, body, headers = {}) {
  return {
    httpMethod: method,
    queryStringParameters: { lang },
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  };
}

function basic(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function createStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    async get(key, options) {
      assert.deepEqual(options, { type: 'json', consistency: 'strong' });
      return data.has(key) ? data.get(key) : null;
    },
    async setJSON(key, value) {
      data.set(key, value);
      return { modified: true, etag: `${key}-etag` };
    },
    snapshot() {
      return Object.fromEntries(data.entries());
    }
  };
}

test('GET returns blob menu when it exists', async () => {
  const store = createStore({ slo: [{ category: 'Blob menu', items: [] }] });
  const handler = createMenuHandler({
    getStore: () => store,
    readSeedMenu: async () => [{ category: 'Seed menu', items: [] }]
  });

  const response = await handler(event('GET', 'slo'));

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.deepEqual(JSON.parse(response.body), [{ category: 'Blob menu', items: [] }]);
});

test('GET falls back to seed JSON before the first CMS save', async () => {
  const store = createStore();
  const handler = createMenuHandler({
    getStore: () => store,
    readSeedMenu: async () => [{ category: 'Seed menu', items: [] }]
  });

  const response = await handler(event('GET', 'eng'));

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), [{ category: 'Seed menu', items: [] }]);
});

test('POST requires valid CMS credentials', async () => {
  const store = createStore();
  const handler = createMenuHandler({
    getStore: () => store,
    readSeedMenu: async () => [],
    cmsUsername: 'Oli',
    cmsPassword: 'secret'
  });

  const response = await handler(event('POST', 'ita', [], { authorization: basic('Oli', 'wrong') }));

  assert.equal(response.statusCode, 401);
  assert.deepEqual(store.snapshot(), {});
});

test('POST stores menu JSON for later refreshes', async () => {
  const store = createStore();
  const handler = createMenuHandler({
    getStore: () => store,
    readSeedMenu: async () => [],
    cmsUsername: 'Oli',
    cmsPassword: 'secret'
  });
  const menu = [{ category: 'Saved menu', items: [{ title: 'Espresso', price: '1.50 EUR' }] }];

  const save = await handler(event('POST', 'de', menu, { authorization: basic('Oli', 'secret') }));
  const refresh = await handler(event('GET', 'de'));

  assert.equal(save.statusCode, 200);
  assert.deepEqual(JSON.parse(save.body), { ok: true });
  assert.deepEqual(JSON.parse(refresh.body), menu);
});

test('rejects unsupported languages and invalid menu payloads', async () => {
  const handler = createMenuHandler({
    getStore: () => createStore(),
    readSeedMenu: async () => [],
    cmsUsername: 'Oli',
    cmsPassword: 'secret'
  });

  const badLang = await handler(event('GET', 'fr'));
  const badPayload = await handler(event('POST', 'slo', { category: 'Not an array' }, { authorization: basic('Oli', 'secret') }));

  assert.equal(badLang.statusCode, 404);
  assert.equal(badPayload.statusCode, 400);
});
