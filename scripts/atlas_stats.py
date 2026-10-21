#!/usr/bin/env python3
"""Write the static "mapped so far" text from the same source the live pages read.

Atlas backlog #5 (2026-10-08). Every number is counted, never typed by hand, so marketing can't drift
from what the app has. One source for everything: assets/atlas-catalog.json (bundled maps, the
popularity ranking, footer rules, page links) + Supabase atlas_catalog, the same sums
assets/atlas-catalog.js does in the browser. This script writes the no-JavaScript fallback:

    index.html   <!-- atlas-stats:start/end -->      the homepage footer stats (counts only)
    roster.html  <!-- roster-totals:start/end -->    the roster totals
                 <!-- roster-list:start/end -->      every mapped game

    python3 scripts/atlas_stats.py                        # live catalog; ~/.cache/psyche/atlas if offline
    python3 scripts/atlas_stats.py --atlas-dir DIR --dry-run

Offline, only atlases a customer actually gets are counted (source.redistribute = false is left out).
Nothing is deployed: review the diff, then commit and push as usual.
"""
from __future__ import annotations

import argparse
import glob
import html
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CATALOG = os.path.join(ROOT, "assets", "atlas-catalog.json")
KEY = "sb_publishable_LEJ4On121RzEpDlCgiqm8w_cDc8BROJ"
START, END = "<!-- atlas-stats:start -->", "<!-- atlas-stats:end -->"


def rows_live(cfg: dict) -> list:
    req = urllib.request.Request(cfg["catalog_url"], headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
    if not isinstance(data, list) or not data:
        raise ValueError("empty catalog")
    return data


def rows_local(folder: str) -> list:
    out = []
    for path in sorted(glob.glob(os.path.join(folder, "*.json"))):
        try:
            with open(path, encoding="utf-8") as fh:
                d = json.load(fh)
        except (OSError, ValueError):
            continue
        if not isinstance(d, dict) or not d.get("rooms") or (d.get("source") or {}).get("redistribute") is False:
            continue
        title = d.get("game") or ("Control" if os.path.basename(path) == "870780.json" else "")
        if title:
            out.append({"game_title": title, "counts": {"rooms": len(d.get("rooms") or {}),
                                                        "loot": len(d.get("loot") or []),
                                                        "boss": len(d.get("boss") or [])}})
    return out


def tally(cfg: dict, rows: list, local: bool = False) -> dict:
    """Same sums as assets/atlas-catalog.js: bundled maps + catalog rows, per game and in total."""
    games = {} if local else {t: dict(rooms=b.get("rooms", 0), loot=b.get("loot", 0), boss=b.get("boss", 0))
                              for t, b in (cfg.get("bundled") or {}).items()}
    for row in rows:
        t = row.get("game_title")
        if not t:
            continue
        c, g = row.get("counts") or {}, games.setdefault(t, {"rooms": 0, "loot": 0, "boss": 0})
        for k in ("rooms", "loot", "boss"):
            g[k] += c.get(k, 0)
    titles = sorted(games, key=str.lower)
    totals = {k: sum(games[t][k] for t in titles) for k in ("rooms", "loot", "boss")}
    never = set(cfg.get("footer_never") or [])
    footer = [t for t in cfg.get("popularity") or [] if t in games and t not in never][:cfg.get("footer_top", 4)]
    return {"games": games, "titles": titles, "totals": totals, "footer": footer}


def strip(t: dict) -> str:
    """The stats span inside the footer's Game Co-Pilots line."""
    n, s = len(t["titles"]), t["totals"]
    return (f'{START}\n        <span class="atlas-stats"><strong>{n} game{"s" if n != 1 else ""}</strong>'
            f' &middot; {s["rooms"]:,} areas &middot; {s["loot"]:,} items &middot; {s["boss"]:,} bosses</span>\n        {END}')


def roster_totals(t: dict) -> str:
    n, s = len(t["titles"]), t["totals"]
    return (f'<p class="totals" id="totals">Mapped so far: <strong>{n} games</strong> &middot; {s["rooms"]:,} areas '
            f'&middot; {s["loot"]:,} items &middot; {s["boss"]:,} bosses.</p>')


def roster_list(cfg: dict, t: dict) -> str:
    pages, out = cfg.get("pages") or {}, ['<ul class="roster" id="roster">']
    for x in t["titles"]:
        g, name = t["games"][x], html.escape(x)
        label = f'<a href="{pages[x]}">{name}</a>' if x in pages else name
        out.append(f'  <li><span class="name">{label}</span><span class="n">{g["rooms"]:,} areas &middot; '
                   f'{g["loot"]:,} items &middot; {g["boss"]:,} bosses</span></li>')
    return "\n".join(out + ["</ul>"])


def put(page: str, start: str, end: str, body: str, keep_markers: bool = True) -> str:
    if start not in page:
        raise ValueError(f"no {start} marker")
    new = body if not keep_markers else f"{start}\n{body}\n{end}"
    return re.sub(re.escape(start) + r".*?" + re.escape(end), lambda _m: new, page, flags=re.S)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--atlas-dir", default=os.path.expanduser("~/.cache/psyche/atlas"))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    cfg = json.load(open(CATALOG, encoding="utf-8"))
    try:
        t = tally(cfg, rows_live(cfg))
    except Exception as e:
        print(f"live catalog unreadable ({e}); counting local atlases", file=sys.stderr)
        t = tally(cfg, rows_local(a.atlas_dir), local=True)
    if not t["titles"]:
        print("no shareable atlases found; pages left alone", file=sys.stderr)
        return 1
    index_p, roster_p = os.path.join(ROOT, "index.html"), os.path.join(ROOT, "roster.html")
    index = put(open(index_p, encoding="utf-8").read(), START, END, strip(t), keep_markers=False)
    roster = open(roster_p, encoding="utf-8").read()
    roster = put(roster, "<!-- roster-totals:start -->", "<!-- roster-totals:end -->", roster_totals(t))
    roster = put(roster, "<!-- roster-list:start -->", "<!-- roster-list:end -->", roster_list(cfg, t))
    print(re.sub(r"<[^>]+>", "", strip(t)).strip())
    print(f"roster: {len(t['titles'])} games: {', '.join(t['titles'])}")
    if not a.dry_run:
        for p, text in ((index_p, index), (roster_p, roster)):
            with open(p, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
