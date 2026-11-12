/* Shared logic for POST /api/suggest-game ("Suggest a game", JP 2026-11-12). Files starting with "_" are not
 * routes on Vercel. Pure functions first (tested by tests/suggest-game.test.js with `node --test`), then the
 * two network calls.
 *
 * JP: "Suggestions go to a list I review; they never queue a build on their own." So this file writes ONE
 * thing: a row in public.game_suggestions through public.submit_game_suggestion() (migration
 * 20261112120000_game_suggestions.sql in JpWon/Overlord). It never touches atlas_requests or request_atlas.
 *
 * Env (Vercel, server-side only; never sent to the browser):
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)   required; without it the route answers 503
 *   SUGGEST_IP_SALT                                        optional salt for the IP hash (falls back to a
 *                                                          hash of the service key, so raw IPs are never stored)
 *   SUPABASE_URL / SUPABASE_ANON_KEY                       optional; default to the public values in
 *                                                          assets/auth-config.js (anon key only checks a
 *                                                          signed-in player's token)
 */
const crypto = require('crypto');

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://bzxzhizvfzmldpkxxuqu.supabase.co').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_LEJ4On121RzEpDlCgiqm8w_cDc8BROJ';

const LIMITS = { title: 120, note: 500, body: 4096, minFillMs: 1500 };
const SOURCES = ['web', 'app'];

// Anything that looks like a tag (<b>, </p>, <!--, <?php). A bare "<3" or "a < b" is fine.
const HTML_RE = /<[A-Za-z!/?]/;
// Control characters except tab/newline (a note may have line breaks).
const CTRL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const STEAM_RE = /^(?:https?:\/\/)?(?:www\.)?store\.steampowered\.com\/app\/(\d{1,10})(?:[/?#][^\s<>"']*)?$/i;

function clean(s) {
  return String(s == null ? '' : s).replace(CTRL_RE, '').trim();
}

/* A Steam store link -> "https://store.steampowered.com/app/<id>/" (slug, query and tracking dropped), or
   null when it is not a store.steampowered.com/app/<id> link. */
function normalizeSteamUrl(raw) {
  const s = clean(raw);
  const m = STEAM_RE.exec(s);
  if (!m || Number(m[1]) <= 0) return null;
  return `https://store.steampowered.com/app/${Number(m[1])}/`;
}

/* Validates a submission. Returns { ok: true, value: {title, steam_url, note, source} } or
   { ok: false, field, error } with an error code the page turns into words. A filled honeypot or a form sent
   faster than a person can type comes back as { ok: true, bot: true }: the caller answers "thanks" and
   stores nothing, so a bot learns nothing. */
function validateSuggestion(body, opts = {}) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const now = opts.now == null ? Date.now() : opts.now;

  if (clean(b.website) || clean(b.company)) return { ok: true, bot: true };     // honeypot fields
  const t0 = Number(b.t);
  if (Number.isFinite(t0) && t0 > 0 && now - t0 >= 0 && now - t0 < LIMITS.minFillMs) return { ok: true, bot: true };

  for (const f of ['title', 'steam_url', 'note', 'source']) {
    if (b[f] != null && typeof b[f] !== 'string') return { ok: false, field: f, error: 'invalid_' + f };
  }

  const title = clean(b.title).replace(/\s+/g, ' ');
  if (!title) return { ok: false, field: 'title', error: 'title_required' };
  if ([...title].length > LIMITS.title) return { ok: false, field: 'title', error: 'title_too_long' };
  if (HTML_RE.test(title)) return { ok: false, field: 'title', error: 'no_html' };
  if (/https?:\/\//i.test(title)) return { ok: false, field: 'title', error: 'title_is_link' };

  let steam_url = null;
  if (clean(b.steam_url)) {
    steam_url = normalizeSteamUrl(b.steam_url);
    if (!steam_url) return { ok: false, field: 'steam_url', error: 'invalid_steam_url' };
  }

  const noteRaw = clean(b.note).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n');
  const note = noteRaw || null;
  if (note && [...note].length > LIMITS.note) return { ok: false, field: 'note', error: 'note_too_long' };
  if (note && HTML_RE.test(note)) return { ok: false, field: 'note', error: 'no_html' };

  const source = clean(b.source || 'web').toLowerCase();
  if (!SOURCES.includes(source)) return { ok: false, field: 'source', error: 'invalid_source' };

  return { ok: true, value: { title, steam_url, note, source } };
}

/* The caller's IP as Vercel reports it (first hop of x-forwarded-for). */
function clientIp(req) {
  const h = req.headers || {};
  const xff = String(h['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || String(h['x-real-ip'] || '').trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
}

/* Salted SHA-256: the throttle table holds this, never the IP. */
function ipKey(ip, salt) {
  return 'ip:' + crypto.createHash('sha256').update(`${salt}|${ip}`).digest('hex').slice(0, 40);
}

/* Browser submissions must come from our own pages; a request with no Origin (the desktop app, curl) is
   left to the rate limits. */
function originAllowed(origin) {
  if (!origin) return true;
  try {
    const h = new URL(origin).hostname;
    return /(^|\.)overlordai\.co$/i.test(h) || /^[a-z0-9-]+\.vercel\.app$/i.test(h) || /^(localhost|127\.0\.0\.1)$/.test(h);
  } catch (_) { return false; }
}

/* A first, per-instance limiter (a warm Vercel instance only; the database limit is the real one). */
function makeMemoryLimiter(max = 5, windowMs = 10 * 60 * 1000) {
  const hits = new Map();
  return function allow(key, now = Date.now()) {
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) { hits.set(key, recent); return false; }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}

function serviceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
}

function ipSalt() {
  const s = process.env.SUGGEST_IP_SALT;
  if (s) return s;
  const k = serviceKey();
  return k ? crypto.createHash('sha256').update('suggest-salt|' + k).digest('hex') : 'overlord-suggest';
}

/* The signed-in player's id, checked with Supabase (never taken from the request body). */
async function supabaseUserId(token, fetchImpl = fetch) {
  if (!token) return null;
  try {
    const r = await fetchImpl(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && typeof u.id === 'string' ? u.id : null;
  } catch (_) { return null; }
}

/* Calls public.submit_game_suggestion with the service key. Returns the function's jsonb, or
   { ok: false, error: 'unavailable' } when the database cannot be reached. */
async function submitToSupabase(value, userId, keys, fetchImpl = fetch) {
  const key = serviceKey();
  if (!key) return { ok: false, error: 'not_configured' };
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  try {
    const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/submit_game_suggestion`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_title: value.title, p_steam_url: value.steam_url, p_note: value.note,
        p_source: value.source, p_user_id: userId || null, p_keys: keys
      })
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error('submit_game_suggestion failed', r.status, errText, 'key prefix:', (key || '').slice(0, 8), 'len:', (key || '').length);
      return { ok: false, error: 'unavailable' };
    }
    const data = await r.json();
    return data && typeof data === 'object' ? data : { ok: false, error: 'unavailable' };
  } catch (e) {
    console.error('submit_game_suggestion error', e && e.message);
    return { ok: false, error: 'unavailable' };
  }
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length > LIMITS.body) return null;
  try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; }
}

function bearer(req) {
  const m = /^Bearer\s+(.+)$/i.exec((req.headers && req.headers.authorization) || '');
  return m ? m[1].trim() : null;
}

module.exports = {
  LIMITS, validateSuggestion, normalizeSteamUrl, clientIp, ipKey, originAllowed, makeMemoryLimiter,
  serviceKey, ipSalt, supabaseUserId, submitToSupabase, send, readBody, bearer
};
