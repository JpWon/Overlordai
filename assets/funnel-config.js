/* Google Ads conversion labels for the funnel (funnel-tracking.md §4 item 6). JP creates two conversion actions in
 * Google Ads (Goals > Conversions > New > Website > "Sign-up" and "Download click", count: One) and pastes each
 * one's label (the part after "AW-18496558698/" in its event snippet) here. Empty = no conversion is sent. */
window.OVERLORD_FUNNEL = { signUpLabel: "gD9SCNjOgLQdEOqs7PNE", downloadLabel: "2ziQCJnwiLQdEOqs7PNE",   // JP, 2026-11-07
  /* "Paid subscription" (2026-11-26): sent once per licence when checkout.html?paid=1 sees the server-confirmed
     paid entitlement. It replaces the old "Purchase" action, which counted visits to thanks.html (now the free demo). */
  purchaseLabel: "U18yCJ6j2L8dEOqs7PNE" };
