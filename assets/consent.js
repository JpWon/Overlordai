/* Cookie consent (2026-10-16).
 *
 * The site's three cookie-setting tags - Google Ads (gtag.js), the Reddit Ads
 * pixel and Rewardful (partner referrals) - no longer load from the page. Each
 * page keeps its own queued calls (gtag(...), rdt(...), rewardful(...)); this
 * file loads the three scripts once consent allows, and they replay the queue.
 *
 *   EU / EEA / UK / Switzerland (by the browser's time zone): nothing loads until
 *     the visitor presses Accept on the banner.
 *   Everyone else: loads as before, unless the visitor chose Reject under
 *     "Cookie settings" or the browser sends Global Privacy Control.
 *
 * Vercel Web Analytics sets no cookies and is not gated. The choice is kept in
 * localStorage ("ovr-consent-v1": "granted" | "denied").
 */
(function () {
  "use strict";
  var KEY = "ovr-consent-v1";
  var GTAG_ID = "AW-18496558698";
  var RW_KEY = "f1219f";
  var loaded = false;

  // Queues, so page code can call these before (or without) the real scripts.
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window._rwq = "rewardful";
  window.rewardful = window.rewardful || function () { (window.rewardful.q = window.rewardful.q || []).push(arguments); };
  if (!window.rdt) {
    var p = window.rdt = function () { p.sendEvent ? p.sendEvent.apply(p, arguments) : p.callQueue.push(arguments); };
    p.callQueue = [];
  }

  function stored() {
    try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; }
  }
  function store(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* private window: the choice lasts this page */ }
  }

  var EU_ZONES = /^(Europe\/|Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)$|Asia\/(Nicosia|Famagusta)$|Africa\/Ceuta$|Arctic\/Longyearbyen$)/;
  function inEurope() {
    try { return EU_ZONES.test(Intl.DateTimeFormat().resolvedOptions().timeZone || ""); } catch (e) { return false; }
  }
  function gpc() { return navigator.globalPrivacyControl === true; }

  function addScript(src, attrs) {
    var s = document.createElement("script");
    s.async = true; s.src = src;
    for (var k in attrs) s.setAttribute(k, attrs[k]);
    (document.head || document.documentElement).appendChild(s);
  }
  function loadTrackers() {
    if (loaded) return;
    loaded = true;
    addScript("https://www.googletagmanager.com/gtag/js?id=" + GTAG_ID, {});
    addScript("https://www.redditstatic.com/ads/pixel.js", {});
    addScript("https://r.wdfl.co/rw.js", { "data-rewardful": RW_KEY });
  }

  // ---- the banner ----------------------------------------------------------
  var CSS = ".ovr-cc{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:640px;margin:0 auto;" +
    "background:#0f1117;color:#e9e9ef;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:16px 18px;" +
    "box-shadow:0 10px 40px rgba(0,0,0,.45);font:14px/1.55 'Space Grotesk',system-ui,-apple-system,Segoe UI,sans-serif}" +
    ".ovr-cc p{margin:0 0 12px}.ovr-cc a{color:#b9a8ff;text-decoration:underline}" +
    ".ovr-cc__row{display:flex;gap:10px;flex-wrap:wrap}" +
    ".ovr-cc button{flex:1 1 140px;min-height:40px;border-radius:8px;border:1px solid rgba(255,255,255,.3);" +
    "background:transparent;color:inherit;font:600 13px/1 inherit;letter-spacing:.04em;cursor:pointer}" +
    ".ovr-cc button:hover{border-color:#b9a8ff}.ovr-cc button:focus-visible{outline:2px solid #b9a8ff;outline-offset:2px}" +
    ".ovr-cc-link{background:none;border:0;padding:0;color:inherit;font:inherit;cursor:pointer;text-decoration:none}" +
    ".ovr-cc-link:hover{color:var(--accent,#b9a8ff)}";

  function showBanner() {
    if (document.getElementById("ovrCookieBanner")) return;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    var box = document.createElement("div");
    box.className = "ovr-cc"; box.id = "ovrCookieBanner";
    box.setAttribute("role", "dialog"); box.setAttribute("aria-live", "polite"); box.setAttribute("aria-label", "Cookie choices");
    box.innerHTML = "<p>We'd like to use cookies to measure our ads (Google Ads, Reddit Ads) and to credit partners who " +
      "refer you (Rewardful). The site works the same either way. <a href=\"privacy.html#s8\">Privacy Policy</a></p>" +
      "<div class=\"ovr-cc__row\"><button type=\"button\" data-c=\"denied\">Reject</button>" +
      "<button type=\"button\" data-c=\"granted\">Accept</button></div>";
    box.addEventListener("click", function (e) {
      var v = e.target && e.target.getAttribute && e.target.getAttribute("data-c");
      if (!v) return;
      store(v);
      box.remove();
      if (v === "granted") loadTrackers();
      else if (loaded) location.reload();   // scripts already running: a reload stops them
    });
    document.body.appendChild(box);
  }

  function addSettingsLink() {
    var rows = document.querySelectorAll(".site-footer .legal, .site-footer__links");
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].querySelector(".ovr-cc-link")) continue;
      var b = document.createElement("button");
      b.type = "button"; b.className = "ovr-cc-link"; b.textContent = "Cookie settings";
      b.addEventListener("click", showBanner);
      rows[i].appendChild(b);
    }
  }

  window.ovrCookieSettings = showBanner;

  var choice = stored();
  var europe = inEurope();
  if (choice === "granted" || (!choice && !europe && !gpc())) loadTrackers();

  function onReady() {
    addSettingsLink();
    if (!choice && europe) showBanner();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();
})();
