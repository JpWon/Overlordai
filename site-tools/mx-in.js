/* Plasma-matrix fade-in for the recorded card loops (messaging.md §7.10, JP 2026-11-08: every card
   "just materializes through ... that matrix fade-in, and then when it restarts, just restart the matrix
   fade-in again"). The same look as index.html's reveal: .mxf (opacity + unblur + a soft-edged mask wipe
   left to right, cubic-bezier(.45,0,.25,1)), the .mx plasma scan band, and plasma glyphs flickering at
   the wipe front (index.html's GLYPHS / --plasma-a/b/c). Repo-only (site-tools/ is in .vercelignore).

   Time-driven, so it records both live (mxIn/mxOut play on rAF) and frame by frame (mxAt(t) per frame).
     const fx = MX.attach(el, glyphRect?)   // el starts hidden; glyphRect = the card's box (defaults to el)
     await fx.in(ms)  /  await fx.out(ms)   // live
     fx.at(t, ms)                           // deterministic: state at t ms into a fade-in of ms
*/
(function () {
  const GLYPHS = '0123456789#%&$+=<>/\\|*01';
  const PLASMA = ['#6d5cff', '#c86bff', '#4fd1ff'];
  function bez(p1x, p1y, p2x, p2y) {            // CSS cubic-bezier(p1x,p1y,p2x,p2y) as a function of x
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
  const WIPE = bez(.45, 0, .25, 1), EASE = bez(.25, .1, .25, 1);
  // deterministic per-cell randomness (frame-by-frame renders must not depend on Math.random timing)
  const rnd = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  function attach(el, glyphRect) {
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:2147483646;mix-blend-mode:screen';
    const band = document.createElement('div');
    band.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483645;mix-blend-mode:screen;filter:blur(14px);opacity:0;' +
      'background:linear-gradient(90deg,transparent,rgba(109,92,255,0) 10%,rgba(109,92,255,.35) 45%,rgba(79,209,255,.45) 55%,rgba(200,107,255,0) 90%,transparent)';
    document.body.append(band, cv);
    const box = () => (typeof glyphRect === 'function' ? glyphRect() : (glyphRect || el.getBoundingClientRect()));
    const MASK = 'linear-gradient(90deg,#000 0 40%,transparent 60% 100%)';
    function hidden() {
      el.style.transition = 'none'; el.style.opacity = '0'; el.style.filter = 'blur(5px)';
      el.style.webkitMaskImage = el.style.maskImage = MASK;
      el.style.webkitMaskSize = el.style.maskSize = '260% 100%';
      el.style.webkitMaskPosition = el.style.maskPosition = '100% 0';
      clear();
    }
    function clear() { const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); band.style.opacity = '0'; }
    function shown() {
      el.style.opacity = '1'; el.style.filter = 'none';
      el.style.webkitMaskImage = el.style.maskImage = 'none';
      clear();
    }
    /* state at t ms into a fade-in lasting ms (site timings scaled: opacity .6/1.4, blur 1.0/1.4, wipe 1.4/1.4) */
    function at(t, ms) {
      ms = ms || 1400;
      if (t >= ms) { shown(); return; }
      const k = ms / 1400;
      const op = EASE(Math.min(1, t / (600 * k))), bl = EASE(Math.min(1, t / (1000 * k))), wp = WIPE(Math.min(1, t / ms));
      el.style.transition = 'none';
      el.style.opacity = op.toFixed(3);
      el.style.filter = `blur(${(5 * (1 - bl)).toFixed(2)}px)`;
      // the soft wipe runs across the CARD's box (glyphRect): .mxf's 2.6x mask with its 40-60% soft edge,
      // i.e. an edge from -0.3W to +1.3W of the card, 0.52W soft; drawn in px on the whole element
      const r = box(), W = r.width, H = r.height;
      const er = el.getBoundingClientRect();
      const edge = r.left + W * (1.3 - 1.6 * (1 - wp));
      const ex = edge - er.left, soft = W * .26;
      const m = `linear-gradient(90deg,#000 0 ${(ex - soft).toFixed(1)}px,transparent ${(ex + soft).toFixed(1)}px 100%)`;
      el.style.webkitMaskImage = el.style.maskImage = m;
      el.style.webkitMaskSize = el.style.maskSize = '100% 100%';
      el.style.webkitMaskPosition = el.style.maskPosition = '0 0';
      // plasma scan band (index.html .mx::before / @keyframes mx-scan)
      const p = t / ms;
      const bop = p < .15 ? p / .15 : (p > .85 ? (1 - p) / .15 : 1);
      band.style.left = (edge - W * .22) + 'px'; band.style.top = (r.top - H * .08) + 'px';
      band.style.width = (W * .22) + 'px'; band.style.height = (H * 1.16) + 'px';
      band.style.opacity = (Math.max(0, bop) * .9).toFixed(3);
      // glyph shimmer at the wipe front, over the card's box only
      const dpr = window.devicePixelRatio || 1;
      if (cv.width !== Math.round(innerWidth * dpr)) { cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
        cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; }
      const c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, innerWidth, innerHeight);
      const cell = Math.max(9, Math.round(W / 34)), fade = Math.min(1, (ms - t) / (ms * .25));
      c.font = `700 ${Math.round(cell * 1.05)}px "Space Mono", ui-monospace, monospace`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const flick = Math.floor(t / 55);
      for (let x = r.left + cell / 2; x < r.left + W; x += cell) {
        const d = edge - x;                                   // >0: already revealed side
        if (d < -cell * 1.5 || d > W * .16) continue;
        const near = d < 0 ? 1 + d / (cell * 1.5) : 1 - d / (W * .16);
        for (let y = r.top + cell / 2; y < r.top + H; y += cell) {
          const ci = Math.round(x / cell), cj = Math.round(y / cell);
          if (rnd(ci * 7 + flick, cj) > .5 * near + .06) continue;
          const g = GLYPHS[Math.floor(rnd(ci + flick * 3, cj * 5) * GLYPHS.length)];
          const col = PLASMA[Math.floor(rnd(ci, cj + flick) * 3)];
          c.globalAlpha = Math.max(0, Math.min(1, near)) * fade;
          c.fillStyle = col; c.shadowColor = col; c.shadowBlur = cell * .6;
          c.fillText(g, x, y);
        }
      }
      c.globalAlpha = 1;
    }
    const play = (ms, fn) => new Promise((res) => {
      const t0 = performance.now();
      const tick = (now) => { const t = now - t0; fn(t); if (t < ms) requestAnimationFrame(tick); else res(); };
      requestAnimationFrame(tick);
    });
    function outAt(t, ms) {                                   // a short dissolve before the loop restarts
      const q = EASE(Math.min(1, t / ms));
      el.style.transition = 'none'; el.style.webkitMaskImage = el.style.maskImage = 'none';
      el.style.opacity = (1 - q).toFixed(3); el.style.filter = `blur(${(4 * q).toFixed(2)}px)`;
    }
    hidden();
    return {
      hidden, shown, at, outAt,
      in: (ms = 1400) => play(ms, (t) => at(t, ms)).then(shown),
      out: (ms = 300) => play(ms, (t) => outAt(t, ms)).then(() => { el.style.opacity = '0'; }),
    };
  }
  window.MX = { attach };
})();
