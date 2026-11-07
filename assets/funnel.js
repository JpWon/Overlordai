/* Funnel tracking, website side (JP, 2026-11-07; spec: C:\JP\master\funnel-tracking.md).
 *
 * One identifier: before sign-up a random anonymous id (first-party cookie "ovr_aid"); at
 * sign-up it is carried onto the account (user_metadata.anon_id) together with the FIRST
 * TOUCH (UTM, ad click id, affiliate ref, promo code, landing page). The back end stores both
 * on the account and copies the first touch onto every later funnel row.
 *
 * Site events go to the back end's public.log_funnel_event() (Supabase RPC, anon key + the
 * player's JWT when signed in: the user id is taken from the JWT on the server, never from
 * here). If that function is not there yet, events are dropped silently: the site never breaks.
 *
 * Consent: the anonymous id and the first touch are only STORED when the visitor's cookie
 * choice allows it (same rule as assets/consent.js). Without it, events are still counted,
 * but with no id that could follow the visitor. Google Ads conversions are queued with gtag(),
 * which consent.js only loads when allowed, so they respect the same choice.
 *
 * Loaded on every page by assets/consent.js. Public API: window.OverlordFunnel.
 */
(function () {
  'use strict';
  if (window.OverlordFunnel) return;

  /* ---- Google Ads conversion actions (JP creates them in Google Ads, then pastes each label).
     Empty label = that conversion is not sent. send_to = AW-18496558698/<label>. */
  var ADS = { id: 'AW-18496558698', labels: { sign_up: '', download_click: '' } };

  var SB = window.OVERLORD_SUPABASE || {
    url: 'https://bzxzhizvfzmldpkxxuqu.supabase.co',
    anonKey: 'sb_publishable_LEJ4On121RzEpDlCgiqm8w_cDc8BROJ'
  };
  var AID = 'ovr_aid', FT = 'ovr_ft', YEAR = 365 * 864e5;
  var FT_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
                 'gclid', 'gbraid', 'wbraid', 'rdt_cid', 'ref', 'via', 'promo', 'code'];
  var SITE_EVENTS = { visit: 1, download_click: 1, checkout_started: 1, referred_by: 1 };

  var isProdHost = /(^|\.)overlordai\.co$/i.test(location.hostname);
  var mode = isProdHost ? 'live' : 'test';

  function allowed() {
    try { return typeof window.ovrConsentAllows === 'function' ? window.ovrConsentAllows() : false; }
    catch (e) { return false; }
  }
  function getCookie(k) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + k + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(k, v) {
    try {
      document.cookie = k + '=' + encodeURIComponent(v) + '; Max-Age=' + Math.floor(YEAR / 1000) +
        '; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    } catch (e) {}
  }
  function rid() {
    var b = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach(function (_, i) { b[i] = Math.random() * 256; });
    return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  var clip = function (v, n) { return v == null ? null : String(v).slice(0, n || 200); };

  /* The anonymous id: created once, kept a year, only with consent. */
  function anonId() {
    if (!allowed()) return null;
    var id = getCookie(AID);
    if (!/^[0-9a-f]{32}$/.test(id || '')) { id = rid(); setCookie(AID, id); }
    return id;
  }

  /* What this page's URL says about where the visitor came from. */
  function touchFromUrl() {
    var q = new URLSearchParams(location.search), t = {}, any = false;
    FT_KEYS.forEach(function (k) { var v = q.get(k); if (v) { t[k] = clip(v, 120); any = true; } });
    if (t.code && !t.promo) t.promo = t.code;
    delete t.code;
    var ref = '';
    try { ref = document.referrer && new URL(document.referrer).hostname !== location.hostname ? document.referrer : ''; } catch (e) {}
    if (ref) { t.referrer = clip(ref, 300); any = true; }
    t.landing = clip(location.pathname, 200);
    t.at = new Date().toISOString();
    return { touch: t, any: any };
  }

  /* First touch: the first visit's sources, never overwritten. Also kept for the session
     without consent (sessionStorage), so a sign-up in the same visit still gets its source. */
  function firstTouch() {
    var stored = null;
    try { stored = JSON.parse(getCookie(FT) || sessionStorage.getItem(FT) || 'null'); } catch (e) {}
    if (stored && typeof stored === 'object') return stored;
    var t = touchFromUrl().touch;
    try { sessionStorage.setItem(FT, JSON.stringify(t)); } catch (e) {}
    if (allowed()) setCookie(FT, JSON.stringify(t));
    return t;
  }

  function osOf(href) {
    if (/\.exe(\?|$)/i.test(href)) return 'windows';
    if (/\.deb(\?|$)/i.test(href)) return 'linux';
    var ua = navigator.userAgent || '';
    return /Windows/i.test(ua) ? 'windows' : /Linux|X11/i.test(ua) ? 'linux' : /Mac/i.test(ua) ? 'mac' : 'other';
  }
  function versionOf(href) { var m = /\/download\/v?([0-9][0-9.]*)\//.exec(href || ''); return m ? m[1] : null; }

  async function token() {
    try {
      var a = window.OverlordAuth;
      var s = a && a.configured ? await a.session() : null;
      return s && s.access_token ? s.access_token : null;
    } catch (e) { return null; }
  }

  /* Send one event. keepalive lets a download click finish sending as the page changes. */
  async function track(event, props) {
    if (!SITE_EVENTS[event]) return;
    var body = {
      p_event: event,
      p_anon_id: anonId(),
      p_props: Object.assign({ path: clip(location.pathname), mode: mode }, props || {}),
      p_first_touch: firstTouch()
    };
    var jwt = await token();
    try {
      await fetch(SB.url.replace(/\/$/, '') + '/rest/v1/rpc/log_funnel_event', {
        method: 'POST', keepalive: true,
        headers: { apikey: SB.anonKey, Authorization: 'Bearer ' + (jwt || SB.anonKey), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) { /* never break the page */ }
  }

  function adsConversion(kind, extra) {
    var label = ADS.labels[kind];
    if (!label || typeof window.gtag !== 'function') return;
    window.gtag('event', 'conversion', Object.assign({ send_to: ADS.id + '/' + label }, extra || {}));
  }

  /* What a new account should carry (auth.js reads this at sign-up). */
  function accountFields() {
    var f = { first_touch: firstTouch() };
    var id = anonId(); if (id) f.anon_id = id;
    return f;
  }

  /* Sign-up happened (signup page, or a brand-new Google/Apple account): the Google Ads
     conversion only. The funnel's sign_up ROW is written by the back end when Supabase creates
     the account (the one source of truth), so a sign-up is never counted twice. */
  var SIGNED_UP = 'ovr_signup_sent';
  function signedUp(userId) {
    try { if (userId && localStorage.getItem(SIGNED_UP) === userId) return; if (userId) localStorage.setItem(SIGNED_UP, userId); } catch (e) {}
    adsConversion('sign_up');
  }

  /* ---- automatic events ---- */
  firstTouch();
  // visit: once per browser session
  try {
    if (!sessionStorage.getItem('ovr_visit')) { sessionStorage.setItem('ovr_visit', '1'); track('visit'); }
  } catch (e) { track('visit'); }
  // a referral or promo on this URL, even on a later visit, is worth its own row
  (function () { var t = touchFromUrl().touch; if (t.ref || t.via || t.promo) track('referred_by', { ref: t.ref || t.via || null, promo: t.promo || null }); })();

  // download_click: any link to an installer on our GitHub releases, wherever it is on the site
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href*="/releases/download/"]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var props = { os: osOf(href), app_version: versionOf(href) };
    adsConversion('download_click');
    track('download_click', props);
  }, true);

  window.OverlordFunnel = { track: track, signedUp: signedUp, accountFields: accountFields, firstTouch: firstTouch, anonId: anonId, mode: mode };
})();
