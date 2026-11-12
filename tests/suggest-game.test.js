// node --test tests/suggest-game.test.js   (Node 18+; no dependencies)
// "Suggest a game" (JP 2026-11-12): validation, abuse limits, and the promise that a suggestion only ever
// writes public.game_suggestions through submit_game_suggestion, never an Atlas build request.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const s = require('../api/_suggest');
const NOW = 1_800_000_000_000;
const ok = (body) => s.validateSuggestion(body, { now: NOW });

test('a plain title is enough', () => {
  const v = ok({ title: '  Some   Invented  Game ' });
  assert.deepEqual(v, { ok: true, value: { title: 'Some Invented Game', steam_url: null, note: null, source: 'web' } });
});

test('title is required, at most 120 chars, no HTML, not a link', () => {
  assert.equal(ok({}).error, 'title_required');
  assert.equal(ok({ title: '   ' }).error, 'title_required');
  assert.equal(ok({ title: 'x'.repeat(120) }).ok, true);
  assert.equal(ok({ title: 'x'.repeat(121) }).error, 'title_too_long');
  assert.equal(ok({ title: '<script>alert(1)</script>' }).error, 'no_html');
  assert.equal(ok({ title: 'Game <b>bold</b>' }).error, 'no_html');
  assert.equal(ok({ title: 'https://example.com/spam' }).error, 'title_is_link');
  assert.equal(ok({ title: 'I <3 this game' }).ok, true);            // a heart is not a tag
  assert.equal(ok({ title: 42 }).error, 'invalid_title');
});

test('Steam links are normalised to store.steampowered.com/app/<id>/', () => {
  const cases = {
    'https://store.steampowered.com/app/1234567/Some_Game/': 'https://store.steampowered.com/app/1234567/',
    'store.steampowered.com/app/99': 'https://store.steampowered.com/app/99/',
    'http://store.steampowered.com/app/42?utm_source=x': 'https://store.steampowered.com/app/42/',
    'https://www.store.steampowered.com/app/7/#reviews': 'https://store.steampowered.com/app/7/'
  };
  for (const [raw, want] of Object.entries(cases)) {
    assert.equal(ok({ title: 'T', steam_url: raw }).value.steam_url, want, raw);
  }
  for (const bad of ['https://steamcommunity.com/app/42', 'https://store.steampowered.com.evil.io/app/42',
                     'https://store.steampowered.com/sub/42', 'https://store.steampowered.com/app/abc',
                     'javascript:alert(1)', 'https://store.steampowered.com/app/0']) {
    assert.equal(ok({ title: 'T', steam_url: bad }).error, 'invalid_steam_url', bad);
  }
  assert.equal(ok({ title: 'T', steam_url: '   ' }).value.steam_url, null);
});

test('note is optional, at most 500 chars, no HTML', () => {
  assert.equal(ok({ title: 'T', note: 'n'.repeat(500) }).ok, true);
  assert.equal(ok({ title: 'T', note: 'n'.repeat(501) }).error, 'note_too_long');
  assert.equal(ok({ title: 'T', note: 'hi <img src=x onerror=1>' }).error, 'no_html');
  assert.equal(ok({ title: 'T', note: 'line one\r\n\r\n\r\n\r\nline two' }).value.note, 'line one\n\nline two');
  assert.equal(ok({ title: 'T', note: 'a\u0000b' }).value.note, 'ab');                 // control chars dropped
});

test('source is web or app only', () => {
  assert.equal(ok({ title: 'T', source: 'app' }).value.source, 'app');
  assert.equal(ok({ title: 'T', source: 'atlas' }).error, 'invalid_source');
});

test('honeypot and too-fast forms are thanked and dropped', () => {
  assert.deepEqual(ok({ title: 'T', website: 'http://spam' }), { ok: true, bot: true });
  assert.deepEqual(ok({ title: 'T', t: NOW - 300 }), { ok: true, bot: true });
  assert.equal(ok({ title: 'T', t: NOW - 5000 }).bot, undefined);
});

test('origin check: our pages, previews, localhost and no-origin callers pass', () => {
  for (const o of [undefined, 'https://www.overlordai.co', 'https://overlordai.co', 'https://overlordai-abc.vercel.app', 'http://localhost:3000']) {
    assert.equal(s.originAllowed(o), true, String(o));
  }
  for (const o of ['https://evil.example', 'https://overlordai.co.evil.example', 'null']) {
    assert.equal(s.originAllowed(o), false, o);
  }
});

test('the IP is hashed with a salt, never stored raw', () => {
  const k = s.ipKey('203.0.113.9', 'salt');
  assert.match(k, /^ip:[0-9a-f]{40}$/);
  assert.ok(!k.includes('203.0.113.9'));
  assert.notEqual(k, s.ipKey('203.0.113.9', 'other-salt'));
  assert.equal(s.clientIp({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } }), '203.0.113.9');
});

test('memory limiter: 5 per window per key', () => {
  const allow = s.makeMemoryLimiter(5, 1000);
  for (let i = 0; i < 5; i++) assert.equal(allow('a', 0), true);
  assert.equal(allow('a', 10), false);
  assert.equal(allow('b', 10), true);
  assert.equal(allow('a', 1001), true);
});

// ---- the route, end to end with a fake Supabase -------------------------------------------------------

function fakeRes() {
  return { statusCode: 0, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = JSON.parse(b); } };
}

async function callRoute(body, { headers = {}, rpc = { ok: true, id: 'x' }, env = {} } = {}) {
  const saved = { ...process.env };
  Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test', SUGGEST_IP_SALT: 'pepper' }, env);
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => rpc };
  };
  delete require.cache[require.resolve('../api/suggest-game')];
  const route = require('../api/suggest-game');
  const res = fakeRes();
  try {
    await route({ method: 'POST', headers: { 'x-forwarded-for': '198.51.100.' + Math.floor(Math.random() * 250), ...headers }, body }, res);
  } finally {
    global.fetch = realFetch;
    process.env = saved;
  }
  return { res, calls };
}

test('route stores a valid suggestion through submit_game_suggestion only', async () => {
  const { res, calls } = await callRoute({ title: 'Invented Game', steam_url: 'store.steampowered.com/app/123', note: 'pls' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/rest\/v1\/rpc\/submit_game_suggestion$/);
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.p_title, 'Invented Game');
  assert.equal(sent.p_steam_url, 'https://store.steampowered.com/app/123/');
  assert.equal(sent.p_source, 'web');
  assert.equal(sent.p_user_id, null);
  assert.match(sent.p_keys[0], /^ip:[0-9a-f]{40}$/);
  assert.equal(calls[0].init.headers.apikey, 'sb_secret_test');
  assert.equal(calls[0].init.headers.Authorization, undefined);   // new-style secret key goes in apikey only
});

test('route: invalid input never reaches Supabase', async () => {
  const { res, calls } = await callRoute({ title: '' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.field, 'title');
  assert.equal(calls.length, 0);
});

test('route: honeypot is a silent 200 with no write', async () => {
  const { res, calls } = await callRoute({ title: 'T', website: 'x' });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 0);
});

test('route: foreign origin is refused', async () => {
  const { res, calls } = await callRoute({ title: 'T' }, { headers: { origin: 'https://evil.example' } });
  assert.equal(res.statusCode, 403);
  assert.equal(calls.length, 0);
});

test('route: database rate limit becomes 429', async () => {
  const { res } = await callRoute({ title: 'T' }, { rpc: { ok: false, error: 'rate_limited' } });
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error, 'rate_limited');
});

test('route: no service key -> 503, nothing sent', async () => {
  const { res, calls } = await callRoute({ title: 'T' }, { env: { SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SERVICE_KEY: '' } });
  assert.equal(res.statusCode, 503);
  assert.equal(calls.length, 0);
});

test('route: a signed-in token is checked with Supabase and only the verified id is sent', async () => {
  const saved = { ...process.env };
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJlegacy.jwt.key';
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/auth/v1/user')) return { ok: true, status: 200, json: async () => ({ id: '00000000-0000-4000-8000-000000000001' }) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  delete require.cache[require.resolve('../api/suggest-game')];
  const route = require('../api/suggest-game');
  const res = fakeRes();
  try {
    await route({ method: 'POST', headers: { authorization: 'Bearer player-token', 'x-forwarded-for': '192.0.2.77' },
                  body: { title: 'T', user_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' } }, res);
  } finally { global.fetch = realFetch; process.env = saved; }
  assert.equal(res.statusCode, 200);
  const rpc = calls.find((c) => c.url.includes('/rpc/'));
  assert.equal(JSON.parse(rpc.init.body).p_user_id, '00000000-0000-4000-8000-000000000001');
  assert.equal(rpc.init.headers.Authorization, 'Bearer eyJlegacy.jwt.key');   // legacy JWT key also as bearer
});

test('a suggestion never queues an Atlas build', () => {
  for (const f of ['api/_suggest.js', 'api/suggest-game.js', 'suggest.html']) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(!/request_atlas|atlas_requests/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), f);
  }
});
