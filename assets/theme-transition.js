/* Plasma-matrix theme transition (JP 2026-11-17): clicking the sun/moon toggle materializes the new
   theme across the whole page through the same plasma-matrix fade-in as the recorded cards
   (site-tools/mx-in.js, JP: "that transition is the transition I'm looking for"): opacity in over
   600 ms, unblur from 5px over 1000 ms, a soft 2.6x mask wipe (40-60% edge) left to right on
   cubic-bezier(.45,0,.25,1) over 1400 ms, the blurred plasma scan band riding the edge, and glowing
   plasma digits flickering at the wipe front. The last 20% of the digit trail cools to the footer
   sign-off's gold leaf (JP 2026-11-17).

   How: each page keeps its own toggle handler. This file catches the click first (capture phase)
   and replays it inside document.startViewTransition(), so the page's handler flips data-theme and
   the new theme is revealed over a snapshot of the old one. The band + digits sit in one fixed
   layer with its own view-transition-name, drawn live on top.
   No View Transitions support, or prefers-reduced-motion: the click goes straight through and the
   page switches exactly as it did before. */
(function () {
  const doc = document, root = doc.documentElement;
  if (typeof doc.startViewTransition !== 'function') return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const MS = 1400;                                    // mx-in.js default fade-in
  const GLYPHS = '0123456789#%&$+=<>/\\|*01';
  const PLASMA = ['#6d5cff', '#c86bff', '#4fd1ff'];
  const GOLD_DARK = ['#D4A24E', '#f0c870', '#b8862e'];      // --naples-gold + leaf highlight/shade
  const GOLD_LIGHT = ['#8a5a1a', '#a8742a', '#6f5a30'];     // the sign-off's light-theme golds
  const MASK = 'linear-gradient(90deg,#000 0 40%,transparent 60% 100%)';

  const css = doc.createElement('style');
  css.textContent =
    '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal;}' +
    'html.ovr-vt::view-transition-new(root){' +
      '-webkit-mask-image:' + MASK + ';mask-image:' + MASK + ';' +
      '-webkit-mask-size:260% 100%;mask-size:260% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;' +
      'animation:ovr-vt-wipe ' + MS + 'ms cubic-bezier(.45,0,.25,1) both,' +
                'ovr-vt-op 600ms ease both,ovr-vt-blur 1000ms ease both;}' +
    '@keyframes ovr-vt-wipe{from{-webkit-mask-position:100% 0;mask-position:100% 0}to{-webkit-mask-position:0 0;mask-position:0 0}}' +
    '@keyframes ovr-vt-op{from{opacity:0}to{opacity:1}}' +
    '@keyframes ovr-vt-blur{from{filter:blur(5px)}to{filter:blur(0)}}' +
    '::view-transition-group(ovr-plasma){animation:none;z-index:2;}' +
    '::view-transition-old(ovr-plasma){display:none;}' +
    '::view-transition-new(ovr-plasma){animation:none;}' +
    'html.ovr-vt-dark::view-transition-new(ovr-plasma){mix-blend-mode:screen;}' +
    /* the page's own colour fades would make the new side start from the old colours: hold them */
    'html.ovr-vt,html.ovr-vt *,html.ovr-vt *::before,html.ovr-vt *::after{transition-duration:0s!important;transition-delay:0s!important;}' +
    '#ovr-plasma-front{position:fixed;inset:0;pointer-events:none;z-index:2147483646;view-transition-name:ovr-plasma;overflow:hidden;}' +
    '#ovr-plasma-front canvas{position:absolute;inset:0;width:100%;height:100%;}' +
    '#ovr-plasma-front i{position:absolute;top:-8%;height:116%;left:0;filter:blur(14px);opacity:0;will-change:transform,opacity;' +
      'background:linear-gradient(90deg,transparent,rgba(109,92,255,0) 10%,rgba(109,92,255,.35) 45%,rgba(79,209,255,.45) 55%,rgba(200,107,255,0) 90%,transparent);}';
  doc.head.appendChild(css);

  function bez(p1x, p1y, p2x, p2y) {                  // CSS cubic-bezier as a function of x
    const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
    const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
    const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
    const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= (X(t) - x) / d; }
      return Y(Math.min(1, Math.max(0, t)));
    };
  }
  const WIPE = bez(.45, 0, .25, 1);
  const rnd = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  let running = false, replaying = false;

  function front(toDark) {
    const wrap = doc.createElement('div'); wrap.id = 'ovr-plasma-front';
    const band = doc.createElement('i');
    const cv = doc.createElement('canvas');
    wrap.append(band, cv); doc.body.appendChild(wrap);
    const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    band.style.width = (W * .22) + 'px';
    const cell = Math.max(13, Math.min(22, Math.round(W / 88)));
    const trail = W * .16, ahead = cell * 1.5, goldFrom = trail * .8;   // last 20% of the trail = gold
    const GOLD = toDark ? GOLD_DARK : GOLD_LIGHT;
    const lift = toDark ? 1 : .85;
    c.font = '700 ' + Math.round(cell * 1.05) + 'px "Space Mono",ui-monospace,monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const t0 = performance.now();
    let raf = 0;
    function draw(now) {
      const t = Math.min(MS, now - t0), p = t / MS, wp = WIPE(p);
      const edge = W * (1.3 - 1.6 * (1 - wp));        // the mask's soft-edge centre (mx-in.js)
      // scan band (index.html .mx::before / @keyframes mx-scan)
      const bop = p < .15 ? p / .15 : (p > .85 ? (1 - p) / .15 : 1);
      band.style.transform = 'translateX(' + (edge - W * .22).toFixed(1) + 'px)';
      band.style.opacity = (Math.max(0, bop) * .9).toFixed(3);
      // digits: densest on the edge, thinning back along the trail, the trail's tail in gold leaf
      c.clearRect(0, 0, W, H);
      const fade = Math.min(1, (MS - t) / (MS * .25)), flick = Math.floor(t / 55);
      for (let x = cell / 2; x < W; x += cell) {
        const d = edge - x;                           // >0: already revealed side
        if (d < -ahead || d > trail) continue;
        const near = d < 0 ? 1 + d / ahead : 1 - d / trail;
        const gold = d > goldFrom;
        for (let y = cell / 2; y < H; y += cell) {
          const ci = Math.round(x / cell), cj = Math.round(y / cell);
          if (rnd(ci * 7 + flick, cj) > .5 * near + (gold ? .22 : .06)) continue;
          const g = GLYPHS[Math.floor(rnd(ci + flick * 3, cj * 5) * GLYPHS.length)];
          const pal = gold ? GOLD : PLASMA;
          const col = pal[Math.floor(rnd(ci, cj + flick) * 3)];
          c.globalAlpha = Math.max(0, Math.min(1, gold ? .4 + near * 3 : near)) * fade * lift;
          c.fillStyle = col; c.shadowColor = col; c.shadowBlur = cell * (gold ? .8 : .6);
          c.fillText(g, x, y);
        }
      }
      c.globalAlpha = 1;
      if (now - t0 < MS) raf = requestAnimationFrame(draw);
    }
    draw(t0);
    return () => { cancelAnimationFrame(raf); wrap.remove(); };
  }

  doc.addEventListener('click', (ev) => {
    if (replaying) return;                            // our own replay: let the page's handler run
    const t = ev.target.closest && ev.target.closest('#celestial-toggle');
    if (!t || reduced.matches) return;
    ev.stopImmediatePropagation(); ev.preventDefault();
    if (running) return;
    running = true;
    const toDark = root.getAttribute('data-theme') !== 'dark';
    const stop = front(toDark);
    root.classList.add('ovr-vt'); root.classList.toggle('ovr-vt-dark', toDark);
    let vt;
    try {
      vt = doc.startViewTransition(() => {
        replaying = true;
        try { t.click(); } finally { replaying = false; }
      });
    } catch (_) {
      replaying = true; try { t.click(); } finally { replaying = false; }
    }
    const done = () => { stop(); root.classList.remove('ovr-vt', 'ovr-vt-dark'); running = false; };
    if (vt && vt.finished) vt.finished.then(done, done); else done();
  }, true);
})();
