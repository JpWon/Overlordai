/* POST /api/portal   Authorization: Bearer <Supabase access token>
 * -> 200 { url }  Creem customer portal (cancel, update card, invoices)
 * -> 404 { error: "no_subscription" } when this account has never bought through Creem
 *
 * The Creem customer id comes from the back end's mapping (RPC my_creem_customer_id, run as
 * the signed-in player). Until that exists, it falls back to looking the customer up in Creem
 * by the player's verified Supabase email, the same email the checkout pre-fills.
 */
const c = require('./_creem');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return c.send(res, 405, { error: 'method_not_allowed' }); }
  if (!process.env.CREEM_API_KEY) return c.send(res, 503, { error: 'not_configured' });

  const token = c.bearer(req);
  const user = await c.supabaseUser(token);
  if (!user) return c.send(res, 401, { error: 'sign_in_required' });

  let customerId = null;
  const mapped = await c.supabaseRpc(token, 'my_creem_customer_id');
  if (mapped.ok && typeof mapped.data === 'string' && mapped.data) customerId = mapped.data;

  if (!customerId && user.email) {
    const r = await c.creem('GET', `/v1/customers?email=${encodeURIComponent(user.email)}`);
    if (r.ok && r.data && r.data.id) customerId = r.data.id;
  }
  if (!customerId) return c.send(res, 404, { error: 'no_subscription' });

  const r = await c.creem('POST', '/v1/customers/billing', { customer_id: customerId });
  const url = r.data && r.data.customer_portal_link;
  if (!r.ok || !c.isCreemUrl(url)) {
    console.error('creem portal failed', r.status, r.data && (r.data.message || r.data.error));
    return c.send(res, 502, { error: 'portal_unavailable' });
  }
  return c.send(res, 200, { url });
};
