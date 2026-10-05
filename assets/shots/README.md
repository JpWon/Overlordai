# Carousel assets — section 3, the ring

All six panes in `index.html`'s `CARDS` array are live as of 2026-10-05.

| # | Pane | Kind | Source |
|---|------|------|--------|
| 1 | Dashboard demo | `video` + `poster` | `assets/reels/dashboard-demo.mp4` |
| 2 | Divine Prayer | `embed` | `assets/hud/prayer-hud.html` |
| 3 | GPS Radar | `embed` | `assets/hud/gps-card.html` |
| 4 | Combo Card | `embed` | `assets/hud/combo-card.html` |
| 5 | Loot Card | `embed` | `assets/hud/loot-card.html` |
| 6 | NPC Interaction | `embed` | `assets/hud/npc-card.html` |

## Swapping a pane for a real screenshot or clip

Edit that pane's one object in `CARDS` (near the bottom of `index.html`). The lightbox reads
the same fields, so nothing else needs touching.

```js
// a still
{tag:'Screenshot', title:'Control', dur:'', img:'assets/shots/control-01.jpg', art:'<gradient>'},

// a clip — poster shows on the card face, the clip plays in the lightbox
{tag:'Video', title:'Wukong', dur:'0:38',
 video:'assets/reels/wukong-01.mp4', poster:'assets/reels/wukong-01-poster.jpg',
 ratio:'1462/816', art:'<gradient>'},                 // ratio = the clip's own shape, no letterbox bars
```

- `art` is the gradient **fallback layer**: a pane looks finished before its file exists, and a
  pane whose file 404s simply keeps its gradient. Never delete it.
- The card itself is 16:10; `ratio` only affects the lightbox frame.
- Clips: cut to the app window and add `-movflags +faststart` (ffmpeg notes live in the
  `overlord-site` skill). Poster at a representative moment.
- Recommended for stills: 1600x1000, JPG or WebP, under ~400 KB each.

## The live panels (`assets/hud/`)

Each panel is self-contained, **transparent** (no background of its own, so the carousel's
gradient shows through), sized 900×560, and built from the shipping app in
`~/Pantocrator/OverLord-AI/psyche/OverlordApp/` rather than designed from scratch.

Every panel exposes `window.__hud = { beats, pin(name), resume(), state() }`, honours
`?beat=<name>` for deterministic screenshots, and respects `prefers-reduced-motion`. None of
them make a network request or touch storage — they run inside a sandboxed iframe.

Verified on the live origin: pane 3 drives 34 beats over the real
`guides/controls/black_myth_wukong_combos.json` data, pane 4 reports `loot`, pane 5 reports
`dialogue`, pane 2 exposes 2 beats, and the page throws no JS errors.
