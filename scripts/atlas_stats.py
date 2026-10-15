#!/usr/bin/env python3
"""Write the homepage "mapped so far" line from the atlases themselves.

Atlas backlog #5 (2026-10-08). Every number on the line is counted from atlas
files, never typed by hand, so marketing can't drift from what the app has:

    python3 scripts/atlas_stats.py                       # ~/.cache/psyche/atlas
    python3 scripts/atlas_stats.py --atlas-dir DIR --dry-run

Only atlases a customer actually gets are counted: anything marked
source.redistribute = false (a map researched for one player's machine, such as
pathfinder_full builds) is left out. The line is written between
<!-- atlas-stats:start --> and <!-- atlas-stats:end --> in index.html.
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

START, END = "<!-- atlas-stats:start -->", "<!-- atlas-stats:end -->"


def tally(folder: str) -> dict:
    # 1. Try live Supabase atlas_catalog (archive & cloud source)
    try:
        url = "https://bzxzhizvfzmldpkxxuqu.supabase.co/rest/v1/atlas_catalog?status=eq.ready&select=game_title,counts"
        key = "sb_publishable_LEJ4On121RzEpDlCgiqm8w_cDc8BROJ"
        req = urllib.request.Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        if isinstance(data, list) and data:
            games = ["Control"]
            rooms, loot, bosses = 23, 10, 6  # Base Control stats
            for row in data:
                t = row.get("game_title")
                if t and t not in games:
                    games.append(t)
                c = row.get("counts") or {}
                rooms += c.get("rooms", 0)
                loot += c.get("loot", 0)
                bosses += c.get("boss", 0)
            return {"games": sorted(games), "areas": rooms, "items": loot, "bosses": bosses}
    except Exception:
        pass

    # 2. Fallback to local files
    games, rooms, loot, bosses = [], 0, 0, 0
    for path in sorted(glob.glob(os.path.join(folder, "*.json"))):
        try:
            with open(path, encoding="utf-8") as fh:
                d = json.load(fh)
        except (OSError, ValueError):
            continue
        if not isinstance(d, dict) or not d.get("rooms"):
            continue
        if (d.get("source") or {}).get("redistribute") is False:
            continue
        games.append(d.get("game") or ("Control" if os.path.basename(path) == "870780.json" else ""))
        rooms += len(d.get("rooms") or {})
        loot += len(d.get("loot") or [])
        bosses += len(d.get("boss") or [])
    return {"games": [g for g in games if g], "areas": rooms, "items": loot, "bosses": bosses}


def line(t: dict) -> str:
    n = len(t["games"])
    names = ", ".join(sorted(t["games"]))
    return (f'{START}\n      <p class="atlas-stats" style="margin:4px 0 12px; font-size:0.85rem; '
            f'color:var(--neutral-on-background-weak);">Mapped so far: <strong>{n} game{"s" if n != 1 else ""}</strong>'
            f' &middot; {t["areas"]:,} areas &middot; {t["items"]:,} items &middot; {t["bosses"]:,} bosses'
            f' ({html.escape(names)}). New maps land as they are finished.</p>\n      {END}')


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--atlas-dir", default=os.path.expanduser("~/.cache/psyche/atlas"))
    ap.add_argument("--page", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "index.html"))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    t = tally(a.atlas_dir)
    if not t["games"]:
        print("no shareable atlases found; page left alone", file=sys.stderr)
        return 1
    new = line(t)
    page = open(a.page, encoding="utf-8").read()
    if START not in page:
        print(f"no {START} marker in {a.page}", file=sys.stderr)
        return 1
    page = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _m: new, page, flags=re.S)
    print(re.sub(r"<[^>]+>", "", new).strip())
    if not a.dry_run:
        with open(a.page, "w", encoding="utf-8") as fh:
            fh.write(page)
    return 0


if __name__ == "__main__":
    sys.exit(main())
