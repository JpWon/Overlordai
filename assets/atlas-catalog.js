/* The mapped-games list, one source for the homepage strip and /roster (assets/atlas-catalog.json +
   Supabase atlas_catalog). scripts/atlas_stats.py does the same sums in Python for the static fallback. */
(function() {
  var KEY = 'sb_publishable_LEJ4On121RzEpDlCgiqm8w_cDc8BROJ';

  function load() {
    return fetch('/assets/atlas-catalog.json').then(function(r) { return r.json(); }).then(function(cfg) {
      return fetch(cfg.catalog_url, { headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY } })
        .then(function(r) { return r.json(); })
        .then(function(rows) {
          if (!Array.isArray(rows)) throw new Error('catalog unreadable');
          var games = {};
          Object.keys(cfg.bundled || {}).forEach(function(t) {
            var b = cfg.bundled[t];
            games[t] = { rooms: b.rooms || 0, loot: b.loot || 0, boss: b.boss || 0 };
          });
          rows.forEach(function(row) {
            if (!row.game_title) return;
            var c = row.counts || {}, g = games[row.game_title] || (games[row.game_title] = { rooms: 0, loot: 0, boss: 0 });
            g.rooms += (c.rooms || 0); g.loot += (c.loot || 0); g.boss += (c.boss || 0);
          });
          var titles = Object.keys(games).sort(function(a, b) { return a.localeCompare(b); });
          var totals = { games: titles.length, rooms: 0, loot: 0, boss: 0 };
          titles.forEach(function(t) { totals.rooms += games[t].rooms; totals.loot += games[t].loot; totals.boss += games[t].boss; });
          var never = cfg.footer_never || [];
          var footer = (cfg.popularity || []).filter(function(t) { return games[t] && never.indexOf(t) === -1; })
            .slice(0, cfg.footer_top || 4);
          var short = function(t) { return (cfg.short || {})[t] || t; };
          return { games: games, titles: titles, totals: totals, footer: footer, short: short, pages: cfg.pages || {} };
        });
    });
  }

  function joinAnd(names) {
    return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }

  /* The homepage strip: total count from every mapped game, names from the biggest titles only. */
  function stripHTML(a) {
    var esc = function(s) { return String(s).replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    return 'Mapped so far: <strong>' + a.totals.games + ' games</strong> &middot; ' + a.totals.rooms.toLocaleString() +
      ' areas &middot; ' + a.totals.loot.toLocaleString() + ' items &middot; ' + a.totals.boss.toLocaleString() +
      ' bosses, including ' + esc(joinAnd(a.footer.map(a.short))) + '. New maps land as they are finished.' +
      ' <a href="/roster" class="atlas-roster-link" style="color:inherit; text-decoration:underline; white-space:nowrap;">See the full roster &rarr;</a>';
  }

  window.OverlordAtlas = { load: load, stripHTML: stripHTML };
})();
