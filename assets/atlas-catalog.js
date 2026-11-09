/* The mapped-games list, one source for the homepage strip and /roster. */
(function() {
  var KEY = 'sb_publishable_LEJ4On121RzEpDlCgiqm8w_cDc8BROJ';

  function load() {
    return fetch('/assets/atlas-catalog.json').then(function(r) { return r.json(); }).then(function(cfg) {
      return fetch(cfg.catalog_url, { headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY } })
        .then(function(r) { return r.json(); })
        .then(function(rows) {
          if (!Array.isArray(rows)) throw new Error('catalog unreadable');
          var games = {}, appOf = {}, apps = {};
          Object.keys(cfg.bundled || {}).forEach(function(t) {
            var b = cfg.bundled[t];
            games[t] = { rooms: b.rooms || 0, loot: b.loot || 0, boss: b.boss || 0 };
          });
          rows.forEach(function(row) {
            if (!row.game_title) return;
            if (row.app_id) { appOf[row.game_title] = String(row.app_id); apps[String(row.app_id)] = row.game_title; }
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
          var byApp = cfg.pages_by_app || {}, pages = {};
          titles.forEach(function(t) {
            var p = (cfg.pages || {})[t] || byApp[appOf[t]];
            if (p) pages[t] = p;
          });
          var hasApp = function(id) { return Object.prototype.hasOwnProperty.call(apps, String(id)); };
          return { games: games, titles: titles, totals: totals, footer: footer, short: short, pages: pages,
                   hasApp: hasApp };
        });
    });
  }

  /* The homepage footer stats, inside the Live Guidebook line: the live count from the mapped-games list. */
  function stripHTML(a) {
    return 'New games mapped daily (<strong>' + a.totals.games + '</strong>)';
  }

  window.OverlordAtlas = { load: load, stripHTML: stripHTML };
})();
