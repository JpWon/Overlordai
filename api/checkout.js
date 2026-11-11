/* POST /api/checkout   { plan: "sub" | "pro" }   Authorization: Bearer <Supabase access token>
 * -> 200 { checkout_url }   (the page then sends the browser there)
 *
 * Creates a Creem checkout session server-side. It never grants access: the back end's
 * Creem webhook does that from the completed checkout / subscription events.
 */
const c = require('./_creem');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return c.send(res, 405, { error: 'method_not_allowed' }); }

  // Founder Access: production refuses paid checkout until the start time (preview and test-mode demo hosts are open for testing).
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const isDemoTest = /^[a-z0-9-]+\.vercel\.app$/i.test(host) && String(process.env.CREEM_MODE || '').toLowerCase() === 'test';
  if (process.env.VERCEL_ENV === 'production' && !isDemoTest && !c.paidCheckoutOpen()) {
    return c.send(res, 403, { error: 'founder_access' });
  }

  const reqBody = c.readBody(req);
  let user = await c.supabaseUser(c.bearer(req));
  if (!user && isDemoTest) {
    // Demo host in test mode: allow direct checkout testing without OAuth redirect loop
    user = {
      id: 'bc58ef73-a80b-5fc4-a781-4bddee4fe7b3',
      email: (typeof reqBody.email === 'string' && reqBody.email.includes('@')) ? reqBody.email.trim() : 'info@overlordai.co'
    };
  }
  if (!user) return c.send(res, 401, { error: 'sign_in_required' });

  const { plan } = reqBody;
  const def = c.PLANS[plan];
  if (!def) return c.send(res, 400, { error: 'unknown_plan' });
  const productId = process.env[def.env] || def.fallback;
  if (!productId || !process.env.CREEM_API_KEY) return c.send(res, 503, { error: 'not_configured' });

  const body = {
    product_id: productId,
    request_id: c.uuid(),
    units: 1,
    success_url: `${c.siteOrigin(req)}/checkout.html?plan=${plan}&checkout=creem&paid=1`,
    metadata: { user_id: user.id, plan_id: def.plan_id, source: 'overlordai.co' }
  };
  if (user.email) body.customer = { email: user.email };

  const r = await c.creem('POST', '/v1/checkouts', body);
  if (!r.ok || !r.data || !c.isCreemUrl(r.data.checkout_url)) {
    console.error('creem checkout failed', r.status, r.data && (r.data.message || r.data.error));
    return c.send(res, 502, { error: 'checkout_unavailable' });
  }
  const normalizedUrl = String(r.data.checkout_url).replace(/^https:\/\/creem\.io\//i, 'https://www.creem.io/');
  return c.send(res, 200, { checkout_url: normalizedUrl, checkout_id: r.data.id });
};
