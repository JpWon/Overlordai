/* Shared helpers for the Creem endpoints (files starting with "_" are not routes on Vercel).
 *
 * Secrets live only in Vercel env vars. Nothing here is sent to the browser except the
 * checkout / portal URL Creem returns.
 *
 *   CREEM_API_KEY           Creem API key (test key in Preview now; live key in Production on JP's go)
 *   CREEM_MODE              "test" | "live"  -> test-api.creem.io | api.creem.io   (default "test")
 *   CREEM_PRODUCT_SUB       Creem product id for Subscription, monthly ($14.99)
 *   CREEM_PRODUCT_PRO       Creem product id for Pro, monthly ($39.99)
 *   PAID_CHECKOUT_START     optional ISO time; default 2026-11-16T05:00:00Z (midnight ET, Nov 16)
 *   SUPABASE_URL / SUPABASE_ANON_KEY   optional; default to the public values in assets/auth-config.js
 */
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bzxzhizvfzmldpkxxuqu.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_LEJ4On121RzEpDlCgiqm8w_cDc8BROJ';
const DEFAULT_START = '2026-11-16T05:00:00Z';

const PLANS = {
  sub: { env: 'CREEM_PRODUCT_SUB', plan_id: 'standard' },
  pro: { env: 'CREEM_PRODUCT_PRO', plan_id: 'pro' }
};

function creemBase() {
  return String(process.env.CREEM_MODE || 'test').toLowerCase() === 'live'
    ? 'https://api.creem.io'
    : 'https://test-api.creem.io';
}

function paidCheckoutOpen(now = Date.now()) {
  const start = Date.parse(process.env.PAID_CHECKOUT_START || DEFAULT_START);
  return Number.isFinite(start) ? now >= start : false;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

/* The player's identity comes from Supabase, never from the request body. */
async function supabaseUser(token) {
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

/* Calls a Postgres function as the signed-in player (RLS / auth.uid() apply). */
async function supabaseRpc(token, fn, args = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  if (!r.ok) return { ok: false, status: r.status };
  return { ok: true, data: await r.json() };
}

async function creem(method, path, body) {
  const key = process.env.CREEM_API_KEY;
  if (!key) return { ok: false, status: 503, error: 'not_configured' };
  const r = await fetch(creemBase() + path, {
    method,
    headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await r.json(); } catch (_) { /* empty body */ }
  return { ok: r.ok, status: r.status, data };
}

/* Where Creem sends the buyer back. Production is always www.overlordai.co; a preview
   deployment returns to itself so the test can run before launch. */
function siteOrigin(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  if (/^[a-z0-9-]+\.vercel\.app$/i.test(host) && String(process.env.CREEM_MODE || 'test').toLowerCase() === 'test') {
    return `https://${host}`;
  }
  if (process.env.VERCEL_ENV === 'production') return 'https://www.overlordai.co';
  if (/^[a-z0-9-]+\.vercel\.app$/i.test(host) || /(^|\.)overlordai\.co$/i.test(host)) return `https://${host}`;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
  return 'https://www.overlordai.co';
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; }
}

const isCreemUrl = u => {
  try { const h = new URL(u).hostname; return /(^|\.)creem\.io$/i.test(h); } catch (_) { return false; }
};

module.exports = {
  PLANS, creem, creemBase, paidCheckoutOpen, send, bearer, supabaseUser, supabaseRpc,
  siteOrigin, readBody, isCreemUrl, uuid: () => crypto.randomUUID()
};
