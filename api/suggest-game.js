/* POST /api/suggest-game   { title, steam_url?, note?, source?, website (honeypot), t (form load time) }
 *   optional Authorization: Bearer <Supabase access token>  -> the suggestion carries the player's user_id
 * -> 200 { ok: true }                         stored (or a duplicate / a bot, answered the same way)
 *    400 { ok: false, field, error }          the page explains which field
 *    403 { ok: false, error: 'bad_origin' }   posted from someone else's page
 *    413 { ok: false, error: 'too_large' }
 *    429 { ok: false, error: 'rate_limited' | 'busy' }
 *    503 { ok: false, error: 'not_configured' | 'unavailable' }
 *
 * "Suggest a game" (JP 2026-11-12): a suggestion is a note on JP's review list (public.game_suggestions,
 * status 'new'). It never queues an Atlas build: nothing here calls request_atlas or writes atlas_requests.
 */
const s = require('./_suggest');

const allow = s.makeMemoryLimiter(5, 10 * 60 * 1000);

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return s.send(res, 405, { ok: false, error: 'method_not_allowed' }); }
  if (!s.originAllowed(req.headers.origin)) return s.send(res, 403, { ok: false, error: 'bad_origin' });
  if (Number(req.headers['content-length'] || 0) > s.LIMITS.body) return s.send(res, 413, { ok: false, error: 'too_large' });

  const body = s.readBody(req);
  if (body === null) return s.send(res, 413, { ok: false, error: 'too_large' });

  const v = s.validateSuggestion(body);
  if (!v.ok) return s.send(res, 400, { ok: false, field: v.field, error: v.error });
  if (v.bot) return s.send(res, 200, { ok: true });

  const ipk = s.ipKey(s.clientIp(req), s.ipSalt());
  if (!allow(ipk)) return s.send(res, 429, { ok: false, error: 'rate_limited' });
  if (!s.serviceKey()) return s.send(res, 503, { ok: false, error: 'not_configured' });

  const userId = await s.supabaseUserId(s.bearer(req));
  const out = await s.submitToSupabase(v.value, userId, [ipk]);
  if (out.ok) return s.send(res, 200, { ok: true });
  if (out.error === 'rate_limited' || out.error === 'busy') return s.send(res, 429, { ok: false, error: out.error });
  if (/^invalid_/.test(out.error || '')) return s.send(res, 400, { ok: false, error: out.error });
  return s.send(res, 503, { ok: false, error: out.error || 'unavailable' });
};
