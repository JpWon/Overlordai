/* Site search (JP 2026-11-24): the magnifying glass in the header replaces the cart.
   Opens a search panel over the page; results come from /assets/search-index.json,
   which site-tools/build-search-index.py builds from the pages in sitemap.xml.
   Shortcuts: "/" or Ctrl+K opens, Esc closes, arrows + Enter pick a result. */
(function () {
  'use strict';
  var INDEX_URL = '/assets/search-index.json';
  var index = null, loading = null, overlay, input, list, items = [], active = -1, lastFocus;

  var css = '' +
    '.ss-overlay{position:fixed;inset:0;z-index:5000;display:none;align-items:flex-start;justify-content:center;' +
      'padding:12vh 16px 16px;background:rgba(0,0,0,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}' +
    '.ss-overlay.is-open{display:flex;}' +
    '.ss-box{width:100%;max-width:640px;max-height:76vh;display:flex;flex-direction:column;overflow:hidden;' +
      'background:var(--page-background,#000);color:var(--neutral-on-background-strong,#fff);' +
      'border:1px solid var(--neutral-alpha-medium,rgba(255,255,255,.26));border-radius:14px;' +
      'box-shadow:0 24px 80px rgba(0,0,0,.5);font-family:inherit;cursor:auto;}' +
    '.ss-field{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--neutral-alpha-weak,rgba(255,255,255,.12));}' +
    '.ss-field svg{flex:none;opacity:.7;}' +
    '.ss-input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:inherit;font:inherit;font-size:17px;}' +
    '.ss-input::placeholder{color:var(--neutral-on-background-weak,#a3a3a3);}' +
    '.ss-close{flex:none;background:transparent;border:1px solid var(--neutral-alpha-medium,rgba(255,255,255,.26));' +
      'color:var(--neutral-on-background-weak,#a3a3a3);border-radius:6px;font:inherit;font-size:12px;padding:3px 7px;cursor:pointer;}' +
    '.ss-list{list-style:none;margin:0;padding:6px;overflow-y:auto;}' +
    '.ss-head{padding:10px 10px 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--neutral-on-background-weak,#a3a3a3);}' +
    '.ss-item a{display:block;padding:10px 12px;border-radius:9px;color:inherit;text-decoration:none;}' +
    '.ss-item.is-active a,.ss-item a:hover{background:var(--neutral-alpha-weak,rgba(255,255,255,.12));}' +
    '.ss-row{display:flex;align-items:baseline;gap:8px;}' +
    '.ss-kind{flex:none;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:5px;' +
      'border:1px solid var(--neutral-alpha-medium,rgba(255,255,255,.26));color:var(--neutral-on-background-weak,#a3a3a3);}' +
    '.ss-title{font-size:15px;font-weight:600;line-height:1.3;}' +
    '.ss-desc{margin-top:3px;font-size:13px;line-height:1.45;color:var(--neutral-on-background-weak,#a3a3a3);' +
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
    '.ss-empty{padding:18px 14px;font-size:14px;color:var(--neutral-on-background-weak,#a3a3a3);}' +
    '.ss-empty a{color:inherit;text-decoration:underline;}' +
    '.ss-title mark,.ss-desc mark{background:transparent;color:inherit;text-decoration:underline;text-underline-offset:3px;}' +
    '@media (max-width:600px){.ss-overlay{padding-top:10px;}.ss-box{max-height:calc(100vh - 20px);}}';

  var QUICK = [
    { t: 'All guides', d: 'Boss fights, questlines and hidden items, game by game.', u: '/guides/', k: 'Guide' },
    { t: 'Support & FAQ', d: 'The free demo, platforms, cancelling, and the questions people ask most.', u: '/support.html', k: 'Help' },
    { t: 'The Roster', d: 'Every game Overlord has mapped so far.', u: '/roster.html', k: 'Game' }
  ];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function mark(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) {
      if (t.length < 2) return;
      out = out.replace(new RegExp('(^|[^a-z0-9])(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '$1<mark>$2</mark>');
    });
    return out;
  }

  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) {
      var sitemap = fetch('/sitemap.xml', { cache: 'no-cache' }).then(function (r) { return r.text(); }).catch(function () { return ''; });
      loading = Promise.all([fetch(INDEX_URL, { cache: 'no-cache' }).then(function (r) { return r.json(); }), sitemap]).then(function (res) {
        var rows = res[0], known = {};
        rows.forEach(function (r) { known[r.u] = 1; });
        // Guides Lux publishes after the last index build: titled from the address until the next rebuild.
        (res[1].match(/<loc>[^<]+<\/loc>/g) || []).forEach(function (loc) {
          var m = /\/guides\/([a-z0-9-]+)\/([a-z0-9-]+)\.html</.exec(loc);
          if (!m || known['/guides/' + m[1] + '/' + m[2] + '.html']) return;
          var cap = function (s) { return s.replace(/-/g, ' ').replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }).replace(/\b(Ii|Iii|Iv)\b/g, function (x) { return x.toUpperCase(); }); };
          rows.push({ t: cap(m[2]), d: cap(m[1]) + ' guide', u: '/guides/' + m[1] + '/' + m[2] + '.html', k: 'Guide', g: cap(m[1]), h: '', x: '' });
        });
        index = rows.map(function (r) {
          r._t = ' ' + norm(r.t) + ' '; r._g = ' ' + norm(r.g) + ' '; r._d = ' ' + norm(r.d) + ' ';
          r._h = ' ' + norm(r.h) + ' '; r._x = ' ' + norm(r.x) + ' ';
          return r;
        });
        return index;
      }).catch(function () { loading = null; return []; });
    }
    return loading;
  }

  function score(r, terms, phrase) {
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var w = ' ' + terms[i], s = 0;
      if (r._t.indexOf(w + ' ') > -1) s = 12; else if (r._t.indexOf(w) > -1) s = 9;
      else if (r._g.indexOf(w) > -1) s = 8;
      else if (r._h.indexOf(w) > -1) s = 5;
      else if (r._d.indexOf(w) > -1) s = 4;
      else if (r._x.indexOf(w) > -1) s = 1;
      if (!s) return 0;           // every word has to be found somewhere
      total += s;
    }
    if (terms.length > 1 && r._t.indexOf(' ' + phrase) > -1) total += 10;
    if (r.k === 'Guide' && r.u !== '/guides/') total += 1;
    return total;
  }

  function render(q) {
    var terms = norm(q).split(' ').filter(Boolean);
    items = []; active = -1;
    if (!terms.length) {
      list.innerHTML = '<li class="ss-head">Popular</li>' + QUICK.map(row.bind(null, [])).join('');
      items = Array.prototype.slice.call(list.querySelectorAll('.ss-item'));
      return;
    }
    load().then(function (rows) {
      if (norm(input.value) !== terms.join(' ')) return;   // a newer keystroke won
      var phrase = terms.join(' ');
      var hits = rows.map(function (r) { return { r: r, s: score(r, terms, phrase) }; })
        .filter(function (h) { return h.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, 12);
      if (!hits.length) {
        list.innerHTML = '<li class="ss-empty">Nothing on the site for “' + esc(q.trim()) + '” yet. ' +
          'Overlord researches any game the first time you play it, and you can <a href="/suggest">suggest a game</a> for us to map next.</li>';
        return;
      }
      list.innerHTML = hits.map(function (h) { return row(terms, h.r); }).join('');
      items = Array.prototype.slice.call(list.querySelectorAll('.ss-item'));
      setActive(0);
    });
  }

  function row(terms, r) {
    return '<li class="ss-item" role="option"><a href="' + esc(r.u) + '">' +
      '<div class="ss-row"><span class="ss-kind">' + esc(r.k) + '</span><span class="ss-title">' + mark(r.t, terms) + '</span></div>' +
      (r.d ? '<div class="ss-desc">' + mark(r.d, terms) + '</div>' : '') + '</a></li>';
  }

  function setActive(i) {
    if (!items.length) return;
    if (active > -1 && items[active]) items[active].classList.remove('is-active');
    active = (i + items.length) % items.length;
    items[active].classList.add('is-active');
    items[active].scrollIntoView({ block: 'nearest' });
  }

  function build() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    overlay = document.createElement('div');
    overlay.className = 'ss-overlay';
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Search the site');
    overlay.innerHTML = '<div class="ss-box">' +
      '<div class="ss-field"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>' +
      '<input class="ss-input" type="search" placeholder="Search games, guides and help" aria-label="Search" autocomplete="off" spellcheck="false">' +
      '<button type="button" class="ss-close" aria-label="Close search">Esc</button></div>' +
      '<ul class="ss-list" role="listbox"></ul></div>';
    document.body.appendChild(overlay);
    input = overlay.querySelector('.ss-input');
    list = overlay.querySelector('.ss-list');
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.ss-close').addEventListener('click', close);
    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter' && items[active]) { e.preventDefault(); items[active].querySelector('a').click(); }
    });
    list.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (a && a.pathname === location.pathname && a.hash) { close(); setTimeout(openFaqFromHash, 0); }
    });
  }

  function open() {
    if (!overlay) build();
    lastFocus = document.activeElement;
    overlay.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    input.value = ''; render('');
    load();
    setTimeout(function () { input.focus(); }, 0);
  }
  function close() {
    if (!overlay || !overlay.classList.contains('is-open')) return;
    overlay.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // FAQ deep links from search results: /support.html#q=how-do-i-cancel opens that question.
  function openFaqFromHash() {
    var m = /^#q=([a-z0-9-]+)$/.exec(location.hash);
    if (!m) return;
    var all = document.querySelectorAll('details.faq__item');
    for (var i = 0; i < all.length; i++) {
      var s = all[i].querySelector('summary');
      if (s && norm(s.textContent).replace(/ /g, '-') === m[1]) {
        all[i].open = true;
        all[i].scrollIntoView({ block: 'center' });
        return;
      }
    }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-site-search]');
    if (b) { e.preventDefault(); open(); }
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (e.key === 'Escape') { close(); return; }
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); open(); return; }
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); open(); }
  });
  window.addEventListener('hashchange', openFaqFromHash);
  window.addEventListener('load', function () { setTimeout(openFaqFromHash, 60); });   // after fonts/layout settle
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openFaqFromHash); else openFaqFromHash();
})();
