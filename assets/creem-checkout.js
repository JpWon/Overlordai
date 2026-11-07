/* Plans page -> Creem checkout.
 *
 * Before PAID_CHECKOUT_START (assets/founder-config.js) this does nothing: the plan buttons keep
 * their Founder Access links. From that moment the Subscription and Pro buttons ask our server
 * (/api/checkout) for a Creem checkout session and send the browser to it. The Creem key never
 * reaches the browser; the page only sends the player's Supabase session token.
 *
 * Testing before launch: on a preview deployment (not overlordai.co), add ?checkout=creem.
 *
 * Requires: founder-config.js, vendor/supabase-js.js, auth-config.js, auth.js
 */
(() => {
  const params = new URLSearchParams(location.search);
  const onProdHost = /(^|\.)overlordai\.co$/i.test(location.hostname);
  const TEST_KEY = 'ovr_creem_test';
  let testMode = false;
  try {
    if (!onProdHost && params.get('checkout') === 'creem') sessionStorage.setItem(TEST_KEY, '1');
    testMode = !onProdHost && sessionStorage.getItem(TEST_KEY) === '1';
  } catch (_) {}

  const start = Date.parse(window.PAID_CHECKOUT_START || '2026-11-16T05:00:00Z');
  if (!(testMode || Date.now() >= start)) return;

  const say = msg => {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('on');
    setTimeout(() => t.classList.remove('on'), 3200);
  };

  async function buy(plan, btn) {
    const auth = window.OverlordAuth;
    if (!auth || !auth.configured) { say('Checkout is unavailable right now. Please try again shortly.'); return; }
    const s = await auth.session();
    if (!s) {
      auth.setAfterAuth('/plans.html?buy=' + plan + (testMode ? '&checkout=creem' : ''));
      location.assign('login.html');
      return;
    }
    if (btn) { btn.setAttribute('aria-busy', 'true'); btn.style.pointerEvents = 'none'; }
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token },
        body: JSON.stringify({ plan })
      });
      const out = await r.json().catch(() => ({}));
      if (r.ok && out.checkout_url && /^https:\/\/([a-z0-9-]+\.)*creem\.io\//i.test(out.checkout_url)) {
        location.assign(out.checkout_url);
        return;
      }
      if (r.status === 401) {
        auth.setAfterAuth('/plans.html?buy=' + plan + (testMode ? '&checkout=creem' : ''));
        location.assign('login.html');
        return;
      }
      say(r.status === 403 ? 'Paid plans open after Founder Access ends.'
                           : 'Checkout couldn’t open. Please try again, or email support@overlordai.co.');
    } catch (_) {
      say('Checkout couldn’t open. Check your connection and try again.');
    } finally {
      if (btn) { btn.removeAttribute('aria-busy'); btn.style.pointerEvents = ''; }
    }
  }

  // Only the paid plan cards. The demo button and the Founder Access banner keep their links.
  document.querySelectorAll('.plans .plan__cta a[href]').forEach(a => {
    const m = /[?&]plan=(sub|pro)\b/.exec(a.getAttribute('href'));
    if (!m) return;
    a.addEventListener('click', e => { e.preventDefault(); buy(m[1], a); });
  });

  // Coming back from sign-in: carry straight on to checkout.
  const resume = params.get('buy');
  if (resume === 'sub' || resume === 'pro') {
    history.replaceState(null, '', location.pathname);
    const btn = document.querySelector('.plans .plan__cta a[href*="plan=' + resume + '"]');
    buy(resume, btn);
  }
})();
