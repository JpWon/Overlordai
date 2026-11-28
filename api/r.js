/* /r/<slug>: a branded link for a creator, answered with a 302 to their affiliate URL.
 * No page is rendered. vercel.json sends /r/<slug> (and /r/<slug>/) here as ?__slug=<slug>.
 *
 * 302, never 301: these destinations change, and a browser keeps a 301 for good.
 * Any query string on the branded link is carried to the destination (UTMs survive).
 * A slug that is not in the map goes to the home page, not a 404.
 *
 * TO ADD A CREATOR: one line in REDIRECTS.
 *   slug (lower case, as it appears after /r/)  :  the full destination URL
 */
const REDIRECTS = {
  asianrobot: 'https://www.creem.io/affiliate?code=AFFKJ2J4KCDZ',
};

const HOME = 'https://overlordai.co/';
const SLUG_PARAM = '__slug';

/* The slug as the map spells it: lower case, no slashes, no spaces. */
function clean(slug) {
  let s = Array.isArray(slug) ? slug[0] : slug;
  try { s = decodeURIComponent(String(s || '')); } catch (e) { s = String(s || ''); }
  return s.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
}

/* Where a branded link goes. `search` is the visitor's own query string ("?utm_source=x" or "").
 * Only URLs written in REDIRECTS are ever used as a destination; the visitor's query can add
 * parameters to it but can never replace one the destination already has (the affiliate code). */
function target(slug, search) {
  const dest = REDIRECTS[clean(slug)];
  if (!dest) return HOME;
  const extra = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  extra.delete(SLUG_PARAM);
  if (![...extra.keys()].length) return dest;
  const url = new URL(dest);
  for (const [k, v] of extra) {
    if (!url.searchParams.has(k)) url.searchParams.append(k, v);
  }
  return url.toString();
}

module.exports = (req, res) => {
  const raw = String(req.url || '');
  const q = raw.indexOf('?');
  const search = q === -1 ? '' : raw.slice(q);
  const slug = (req.query && req.query[SLUG_PARAM]) || new URLSearchParams(search.slice(1)).get(SLUG_PARAM) || '';
  res.statusCode = 302;
  res.setHeader('Location', target(slug, search));
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end();
};

module.exports.target = target;
module.exports.REDIRECTS = REDIRECTS;
module.exports.HOME = HOME;
