/* Funnel events (C:\JP\master\funnel-tracking.md, JP 2026-11-07): the site's part.
 *
 * - One random anonymous id per browser (first-party: localStorage + a first-party cookie), only where tracking is
 *   allowed (assets/consent.js: outside Europe unless Reject / GPC; in Europe only after Accept).
 * - First touch: the FIRST visit's UTM source / medium / campaign / content / term, ?ref= (affiliate or the /lux
 *   door), promo code, Google click id (gclid) and landing page, kept on this browser and sent with every event;
 *   the server stores it on the account at sign-up (funnel_site), so later payments still credit it.
 * - Events: visit (each page; the server keeps one a day), download_click (the installer links), sign_up (the first
 *   time a brand-new account is signed in here; the server checks it is new and logs it once), referred_by (a first
 *   visit that came with ?ref= / a promo code), and checkout_started (OverlordFunnel.track, for the checkout page).
 * - Google Ads conversions for sign_up and download_click (labels in assets/funnel-config.js; none set = none sent),
 *   through the consent-gated gtag queue.
 * Nothing here reads the screen, the game or anything personal; it never blocks the page.
 */
(function () {
  "use strict";
  var ADS_ID = "AW-18496558698";
  var A_KEY = "ovl_anon", T_KEY = "ovl_touch", SU_KEY = "ovl_signup_sent:";

  function allowed() {
    try { return typeof window.ovrTrackingAllowed === "function" ? !!window.ovrTrackingAllowed() : false; }
    catch (e) { return false; }
  }
  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
    return null;
  }
  function cookie(k, v) {
    try {
      if (v === undefined) {
        var m = document.cookie.match(new RegExp("(?:^|; )" + k + "=([^;]*)"));
        return m ? decodeURIComponent(m[1]) : null;
      }
      document.cookie = k + "=" + encodeURIComponent(v) + "; Max-Age=31536000; Path=/; SameSite=Lax; Secure";
    } catch (e) { /* no cookies: localStorage still works */ }
    return null;
  }
  function newId() {
    var b = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(b) : b.forEach(function (_, i) { b[i] = Math.random() * 256; });
    return btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function anonId() {
    var id = ls(A_KEY) || cookie(A_KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) id = newId();
    ls(A_KEY, id); cookie(A_KEY, id);
    return id;
  }
  function firstTouch() {
    var have = ls(T_KEY);
    if (have) { try { return { touch: JSON.parse(have), first: false }; } catch (e) { /* rebuilt below */ } }
    var q = new URLSearchParams(location.search), t = { landing: location.pathname };
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid"].forEach(function (k) {
      if (q.get(k)) t[k] = q.get(k).slice(0, 200);
    });
    var ref = q.get("ref") || q.get("via") || ls("ovl_ref");          // ?ref=, Rewardful's ?via=, the /lux door
    if (ref) t.ref = String(ref).slice(0, 80);
    var promo = q.get("promo") || q.get("code");
    if (promo) t.promo = String(promo).slice(0, 40);
    if (document.referrer && document.referrer.indexOf(location.host) === -1) t.referrer = document.referrer.slice(0, 300);
    ls(T_KEY, JSON.stringify(t));
    return { touch: t, first: true };
  }
  function cfg() { return window.OVERLORD_SUPABASE || {}; }
  function token() {
    try {
      var a = window.OverlordAuth;
      if (a && a.session) return a.session().then(function (s) { return s ? { jwt: s.access_token, uid: s.user && s.user.id } : null; });
    } catch (e) { /* signed-out pages */ }
    return Promise.resolve(null);
  }
  function send(event, props, who) {
    var c = cfg();
    if (!c.url || !c.anonKey) return Promise.resolve(null);
    var body = JSON.stringify({ p_event: event, p_anon_id: anonId(), p_touch: firstTouch().touch, p_props: props || {} });
    return fetch(c.url.replace(/\/$/, "") + "/rest/v1/rpc/funnel_site", {
      method: "POST", keepalive: true, body: body,
      headers: { apikey: c.anonKey, Authorization: "Bearer " + ((who && who.jwt) || c.anonKey), "Content-Type": "application/json" }
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function conversion(kind) {
    var labels = window.OVERLORD_FUNNEL || {};
    var label = kind === "sign_up" ? labels.signUpLabel : labels.downloadLabel;
    if (!label || typeof window.gtag !== "function") return;
    window.gtag("event", "conversion", { send_to: ADS_ID + "/" + label });
  }
  function track(event, props) {
    if (!allowed()) return Promise.resolve(null);
    return token().then(function (who) { return send(event, props, who); });
  }

  function onDownload(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href*="/releases/download/"]') : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    var os = /\.exe($|\?)/i.test(href) ? "windows" : (/\.deb($|\?)/i.test(href) ? "linux" : "other");
    var v = (href.match(/\/v?(\d+\.\d+\.\d+[^/]*)\//) || [])[1] || "";
    track("download_click", { os: os, version: v });
    conversion("download_click");
  }
  function signUpCheck() {
    return token().then(function (who) {
      if (!who || !who.uid || ls(SU_KEY + who.uid)) return;
      return send("sign_up", {}, who).then(function (r) {
        if (!r) return;
        ls(SU_KEY + who.uid, "1");                       // logged, or this account is not new: never ask again here
        if (r.logged) conversion("sign_up");
      });
    });
  }

  function boot() {
    if (!allowed()) return;
    var ft = firstTouch();
    token().then(function (who) {
      send("visit", { path: location.pathname }, who);
      if (ft.first && (ft.touch.ref || ft.touch.promo)) send("referred_by", { ref: ft.touch.ref, promo: ft.touch.promo }, who);
    });
    signUpCheck();
    try { if (window.OverlordAuth && window.OverlordAuth.onChange) window.OverlordAuth.onChange(function (s) { if (s) signUpCheck(); }); }
    catch (e) { /* no auth on this page */ }
    document.addEventListener("click", onDownload, true);
  }

  window.OverlordFunnel = { track: track, anonId: function () { return allowed() ? anonId() : null; } };
  if (!window.OVERLORD_SUPABASE) {                        // pages without the sign-in scripts still know where to send
    var s = document.createElement("script");
    s.src = "/assets/auth-config.js";
    s.onload = boot;
    (document.head || document.documentElement).appendChild(s);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
