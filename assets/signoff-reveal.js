/* Footer sign-off reveal — the homepage's plasma-matrix reveal, in one shared file so the effect
   is the same on every page. It starts when the sign-off scrolls into view (IntersectionObserver),
   once per page view: the English line first, the Latin line a beat after. The letters flicker
   through plasma colours, then cool to the sign-off's gold. prefers-reduced-motion: it just appears.
   (Lifted from index.html's inline "plasma-matrix reveal", scoped to .site-footer__signoff.) */
(function () {
  var root = document.querySelector('.site-footer__signoff');
  if (!root) return;
  var lines = Array.prototype.slice.call(root.querySelectorAll('.ln'));
  if (!lines.length) return;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) return;   // leave the lines as plain visible text

  var CSS = [
    '.site-footer__signoff{--plasma-a:#6d5cff;--plasma-b:#c86bff;--plasma-c:#4fd1ff;}',
    '.site-footer__signoff .ln{position:relative;overflow-x:clip;overflow-clip-margin:.4em;}',
    '.site-footer__signoff .ln .mx-word{display:inline-block;white-space:nowrap;}',
    '.site-footer__signoff .ln.mx-ready .mx-ch{display:inline-block;position:relative;opacity:0;transform:translateY(-.35em) scaleY(.4);}',
    '.site-footer__signoff .ln .mx-ch.on{opacity:1;transform:none;color:transparent;transition:opacity .18s ease, transform .35s cubic-bezier(.22,1,.36,1);}',
    '.site-footer__signoff .ln .mx-ch.on::after{content:attr(data-g);position:absolute;inset:0;text-align:center;color:var(--g, var(--plasma-a));text-shadow:0 0 .25em var(--g, var(--plasma-a)), 0 0 .6em rgba(109,92,255,.55);}',
    '.site-footer__signoff .ln .mx-ch.set{color:inherit;transition:color .45s ease, text-shadow .9s ease;text-shadow:0 0 .35em rgba(109,92,255,0);}',
    '.site-footer__signoff .ln .mx-ch.set::after{content:none;}',
    '.site-footer__signoff .ln .mx-ch.flash{text-shadow:0 0 .4em rgba(200,107,255,.85);}',
    '.site-footer__signoff .ln.mx-ready::before{content:"";position:absolute;top:-8%;bottom:-8%;left:0;width:22%;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(109,92,255,0) 10%,rgba(109,92,255,.35) 45%,rgba(79,209,255,.45) 55%,rgba(200,107,255,0) 90%,transparent);filter:blur(14px);mix-blend-mode:screen;opacity:0;transform:translateX(-120%);}',
    '.site-footer__signoff .ln.mx-run::before{animation:sgr-scan var(--mx-dur,1.6s) cubic-bezier(.45,0,.25,1) forwards;}',
    '@keyframes sgr-scan{0%{opacity:0;transform:translateX(-60%)}15%{opacity:1}85%{opacity:1}100%{opacity:0;transform:translateX(480%)}}'
  ].join('\n');
  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var GLYPHS = '0123456789#%&$+=<>/\\|*01';
  var PLASMA = ['var(--plasma-a)', 'var(--plasma-b)', 'var(--plasma-c)'];
  var pick = function (s) { return s[Math.floor(Math.random() * s.length)]; };

  function split(el) {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    var chars = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(part); return; }
            var word = document.createElement('span');
            word.className = 'mx-word'; word.setAttribute('aria-hidden', 'true');
            for (var i = 0; i < part.length; i++) {
              var s = document.createElement('span');
              s.className = 'mx-ch'; s.textContent = part[i];
              word.appendChild(s); chars.push(s);
            }
            frag.appendChild(word);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) { walk(n); }
      });
    })(el);
    el.classList.add('mx-ready');
    return chars;
  }

  function run(el, chars, slow) {
    var n = chars.length;
    slow = slow || 1;
    var step = Math.max(18, Math.min(55, 900 / n)) * slow;   // stagger between letters
    var hold = 260 * slow;                                   // how long each letter flickers
    var start = performance.now();
    var total = (n - 1) * step + hold + 220;
    el.style.setProperty('--mx-dur', (total / 1000).toFixed(2) + 's');
    el.classList.add('mx-run');
    var plan = chars.map(function (c, i) {
      return { c: c, on: i * step + Math.random() * 60 * slow, set: i * step + hold + Math.random() * 180 * slow, last: 0, done: false };
    });
    var tick = function (now) {
      var t = now - start, busy = false;
      plan.forEach(function (p) {
        if (p.done) return;
        busy = true;
        if (t < p.on) return;
        if (!p.c.classList.contains('on')) p.c.classList.add('on');
        if (t >= p.set) {
          p.c.classList.add('set', 'flash'); p.done = true;
          setTimeout(function () { p.c.classList.remove('flash'); }, 160);
        } else if (now - p.last > 55) {
          p.c.dataset.g = pick(GLYPHS); p.c.style.setProperty('--g', pick(PLASMA)); p.last = now;
        }
      });
      if (busy) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return total;                                            // ms until the last letter locks
  }

  // Split now, so the letters are already hidden before the footer is scrolled into view.
  var prepared = lines.map(function (el) {
    return { el: el, chars: split(el), slow: el.classList.contains('ln--latin') ? 1.4 : 1.3 };
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.disconnect();                                       // once per page view
      var main = prepared[0], latin = prepared[1];
      var t = run(main.el, main.chars, main.slow);
      if (latin) setTimeout(function () { run(latin.el, latin.chars, latin.slow); }, Math.round(t * 0.55));  // a beat after
    });
  }, { threshold: 0.5 });                                    // fires when the sign-off is about half in view
  io.observe(root);
})();
