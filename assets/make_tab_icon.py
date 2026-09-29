#!/usr/bin/env python3
"""Generate the tab icon (`favicon.svg`) from the tile mark.

The tab icon is the bare head on a transparent ground: WHITE by default (dark
tab bars) and ink when the browser reports a light scheme, via a
`prefers-color-scheme` media query inside the SVG. That query reads the
browser/OS appearance — which is what the tab strip follows — so it is not
wired to the site's own theme toggle.

Source of the silhouette is `assets/rooster-tile.svg` (the full-detail trace,
the same shape the .ico and PNG ladder still use). Nothing is hand-edited in
`favicon.svg`; change this file and re-run it.

    python3 assets/make_tab_icon.py
"""
import re
import sys
from pathlib import Path

S = Path(__file__).resolve().parent.parent
TILE = S / "assets" / "rooster-tile.svg"
OUT = S / "favicon.svg"
WHITE, INK = "#ffffff", "#1c1a17"
MARGIN = 0.06                    # breathing room on every side, as a fraction of the tile
VIEW = 1024.0

src = TILE.read_text(encoding="utf-8")
mask = re.search(r'<mask id="hole".*?</mask>', src, re.S).group(0)
d = re.search(r'<path d="([^"]+)"[^>]*?/>', src, re.S).group(1)

# Scale/centre from the path's own bbox rather than guessing: a generator's
# coordinates are in viewBox units, and the mark does not fill the tile.
nums = re.findall(r"-?\d+\.?\d*", d)
xs = [float(nums[i]) for i in range(0, len(nums) - 1, 2)]
ys = [float(nums[i]) for i in range(1, len(nums), 2)]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
box = VIEW * (1 - 2 * MARGIN)
scale = min(box / (x1 - x0), box / (y1 - y0))
tx = VIEW / 2 - scale * (x0 + x1) / 2
ty = VIEW / 2 - scale * (y0 + y1) / 2

# assert the transformed mark sits inside the viewBox before writing the file
sx0, sy0, sx1, sy1 = x0 * scale + tx, y0 * scale + ty, x1 * scale + tx, y1 * scale + ty
if not (0 <= sx0 and sx1 <= VIEW and 0 <= sy0 and sy1 <= VIEW):
    sys.exit(f"transformed bbox escapes the viewBox: {sx0:.1f},{sy0:.1f} {sx1:.1f},{sy1:.1f}")

OUT.write_text(f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Overlord AI">
  <defs>
    {mask}
    <style>
      /* Dark tab bars: white head on nothing. Light tab bars: the inverse.
         The media query reads the browser/OS scheme, which is what the tab
         strip itself follows — not the page's own theme toggle. */
      .ovr-head {{ fill: {WHITE}; }}
      @media (prefers-color-scheme: light) {{ .ovr-head {{ fill: {INK}; }} }}
    </style>
  </defs>
  <g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.4f})">
    <path class="ovr-head" d="{d}" fill="{WHITE}" fill-rule="nonzero" mask="url(#hole)"/>
  </g>
</svg>
""", encoding="utf-8")
print(f"favicon.svg written — scale {scale:.4f}, translate {tx:.2f},{ty:.2f}, "
      f"bbox {sx0:.1f},{sy0:.1f} {sx1:.1f},{sy1:.1f}")
