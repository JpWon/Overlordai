import http from 'node:http';

// ---- config (all via env, nothing hardcoded) ----
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || 'Overlord AI <onboarding@resend.dev>';
const WAITLIST_TO = process.env.WAITLIST_TO || 'info@overlordai.co';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const WAITLIST_TABLE = process.env.WAITLIST_TABLE || 'waitlist';
const WAITLIST_EMAIL_COLUMN = process.env.WAITLIST_EMAIL_COLUMN || 'email';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, obj) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    return json(res, 200, {
      ok: true,
      service: 'overlord-waitlist-api',
      configured: { resend: !!RESEND_API_KEY, supabase: !!(SUPABASE_URL && SUPABASE_ANON_KEY) },
    });
  }
  if (req.method === 'POST' && req.url === '/api/waitlist') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed = {};
    try { parsed = JSON.parse(body || '{}'); } catch { parsed = {}; }

    const email = String(parsed.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return json(res, 400, { ok: false, error: 'valid email required' });
    }

    const out = { ok: true, email, stored: 'skipped', mailed: 'skipped' };

    // 1) write the signup into Supabase
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${WAITLIST_TABLE}`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ [WAITLIST_EMAIL_COLUMN]: email }),
        });
        out.stored = r.ok ? 'ok' : `error ${r.status}`;
      } catch (e) {
        out.stored = `error ${e.message}`;
      }
    }

    // 2) email the signup to the owner
    if (RESEND_API_KEY) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: [WAITLIST_TO],
            subject: 'Overlord AI — new waitlist signup',
            text: `New waitlist signup: ${email}`,
          }),
        });
        out.mailed = r.ok ? 'ok' : `error ${r.status}`;
      } catch (e) {
        out.mailed = `error ${e.message}`;
      }
    }

    return json(res, 200, out);
  }
  return json(res, 404, { ok: false, error: 'not found' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`overlord-waitlist-api listening on :${PORT}`));
