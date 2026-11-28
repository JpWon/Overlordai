// node --test tests/affiliate-redirect.test.js   (Node 18+; no dependencies)
// /r/<slug> (JP 2026-11-28): a branded creator link answered with a 302 to the affiliate URL.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const r = require('../api/r');
const CREEM = 'https://www.creem.io/affiliate?code=AFFKJ2J4KCDZ';

function call(url, query) {
  const out = { headers: {}, body: undefined, ended: false };
  const res = {
    setHeader(k, v) { out.headers[k.toLowerCase()] = v; },
    end(b) { out.body = b; out.ended = true; },
  };
  r({ url, query }, res);
  out.status = res.statusCode;
  return out;
}

test('the first creator goes to the exact affiliate URL', () => {
  assert.equal(r.target('asianrobot', ''), CREEM);
});

test('the slug is matched in any case and with a trailing slash', () => {
  for (const s of ['AsianRobot', 'ASIANROBOT', 'asianrobot/', '/asianrobot', ' asianrobot ', 'asianrobot%2F']) {
    assert.equal(r.target(s, ''), CREEM, s);
  }
});

test('the visitor\'s query string is carried through', () => {
  assert.equal(r.target('asianrobot', '?utm_source=youtube'), CREEM + '&utm_source=youtube');
  assert.equal(r.target('asianrobot', '?utm_source=youtube&utm_campaign=pbz%20run'),
    CREEM + '&utm_source=youtube&utm_campaign=pbz+run');
});

test('a visitor can add parameters but never replace the affiliate code', () => {
  assert.equal(r.target('asianrobot', '?code=SOMEONE_ELSE&utm_source=x'), CREEM + '&utm_source=x');
});

test('an unknown or empty slug goes home, never anywhere a visitor names', () => {
  for (const s of ['nobody', '', undefined, 'https://evil.example/', '//evil.example', '../admin', '%ZZ']) {
    assert.equal(r.target(s, '?next=https://evil.example/'), r.HOME, String(s));
  }
  assert.equal(r.HOME, 'https://overlordai.co/');
});

test('the function answers 302 with no body, and is never cached', () => {
  const a = call('/api/r?__slug=asianrobot', { __slug: 'asianrobot' });
  assert.equal(a.status, 302);
  assert.equal(a.headers.location, CREEM);
  assert.equal(a.headers['cache-control'], 'no-store, max-age=0');
  assert.equal(a.ended, true);
  assert.equal(a.body, undefined);
  const b = call('/api/r?__slug=asianrobot&utm_source=youtube', { __slug: 'asianrobot', utm_source: 'youtube' });
  assert.equal(b.status, 302);
  assert.equal(b.headers.location, CREEM + '&utm_source=youtube');
  const c = call('/api/r?__slug=nobody', undefined);            // no parsed query: read it from the URL
  assert.equal(c.status, 302);
  assert.equal(c.headers.location, 'https://overlordai.co/');
  assert.equal(call('/api/r', {}).headers.location, 'https://overlordai.co/');
});

test('every destination in the map is a full https URL and every slug is lower case', () => {
  for (const [slug, dest] of Object.entries(r.REDIRECTS)) {
    assert.equal(slug, slug.toLowerCase());
    assert.match(slug, /^[a-z0-9][a-z0-9_-]*$/);
    assert.equal(new URL(dest).protocol, 'https:');
  }
});

test('vercel.json sends /r/<slug>, /r/<slug>/ and /r to the function', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const by = Object.fromEntries(cfg.rewrites.map((x) => [x.source, x.destination]));
  assert.equal(by['/r/:slug'], '/api/r?__slug=:slug');
  assert.equal(by['/r/:slug/'], '/api/r?__slug=:slug');
  assert.equal(by['/r'], '/api/r');
});
