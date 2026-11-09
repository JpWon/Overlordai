/* /roster, built from the live mapped-games list on every request (cached 10 minutes at the edge).
 * Same source and the same sums as assets/atlas-catalog.js, so the page lists every mapped game even
 * before (or without) JavaScript. If the list can't be read, the plain roster.html is served as it is. */
const fs = require('fs');
const path = require('path');

const KEY = 'sb_publishable_LEJ4On121RzEpDlCgiqm8w_cDc8BROJ';
const WORDING = 'New games mapped daily';

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function between(page, start, end, body) {
  const a = page.indexOf(start), b = page.indexOf(end);
  if (a === -1 || b === -1 || b < a) throw new Error('marker missing: ' + start);
  return page.slice(0, a + start.length) + '\n' + body + '\n' + page.slice(b);
}

async function titles(cfg) {
  const r = await fetch(cfg.catalog_url, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error('catalog unreadable');
  const games = new Set(Object.keys(cfg.bundled || {}));
  const pages = {};
  rows.forEach((row) => {
    if (!row.game_title) return;
    games.add(row.game_title);
    const p = (cfg.pages || {})[row.game_title] || (cfg.pages_by_app || {})[String(row.app_id || '')];
    if (p) pages[row.game_title] = p;
  });
  Object.keys(cfg.pages || {}).forEach((t) => { if (games.has(t)) pages[t] = cfg.pages[t]; });
  return { list: [...games].sort((a, b) => a.localeCompare(b)), pages };
}

module.exports = async (req, res) => {
  const page = fs.readFileSync(path.join(process.cwd(), 'roster.html'), 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'assets', 'atlas-catalog.json'), 'utf8'));
    const { list, pages } = await titles(cfg);
    let out = between(page, '<!-- roster-totals:start -->', '<!-- roster-totals:end -->',
      '<p class="totals" id="totals">' + WORDING + ' &middot; <strong>' + list.length + ' games</strong></p>');
    out = between(out, '<!-- roster-list:start -->', '<!-- roster-list:end -->',
      '<ul class="roster" id="roster">\n' + list.map((n) => '  <li><span class="name">' +
        (pages[n] ? '<a href="' + pages[n] + '">' + esc(n) + '</a>' : esc(n)) + '</span></li>').join('\n') + '\n</ul>');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.status(200).send(out);
  } catch (e) {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.status(200).send(page);
  }
};
