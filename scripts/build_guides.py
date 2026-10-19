#!/usr/bin/env python3
"""Build the /guides/ pages from guides/data/<game>/<slug>.json (lux-guides-handoff.md).

  python scripts/build_guides.py                 # validate + render + index + sitemap
  python scripts/build_guides.py --check         # validate only, exit 1 on any problem
  python scripts/build_guides.py --atlas DIR     # also check every atlas_ref exists in DIR/<app_id>.json

Each guide is one stuck point, sourced row by row from Overlord's Atlas. A guide that fails validation
is not rendered (and --check fails), so a bad JSON from Lux never reaches the live site.
"""
import argparse
import datetime as dt
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "guides", "data")
OUT = os.path.join(ROOT, "guides")
SITE = "https://www.overlordai.co"
SITEMAP = os.path.join(ROOT, "sitemap.xml")
SM_START, SM_END = "  <!-- guides:start (scripts/build_guides.py) -->", "  <!-- guides:end -->"

MIN_WORDS, MAX_WORDS = 300, 700
REF_RX = re.compile(r"^(loot|boss|npc|rooms|places)/[\w'-]+$|^youtube:[a-z_]+/\d+$")
SLUG_RX = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
# no invented stats or crowd claims (rule 2)
STAT_RX = re.compile(r"\d+\s?%|\b(most|many|few) (players|people|gamers)\b|\bstudies\b|\beveryone\b", re.I)
# the text never claims a person played or tested it (rule 3)
CLAIM_RX = re.compile(r"\b(I|we)\s+(beat|played|tested|tried|cleared|found|ran)\b|\bin my (run|playthrough)\b|"
                      r"\bLux\b|\bAI marketing\b", re.I)
REQUIRED = ("slug", "game", "game_title", "game_page", "store_url", "query", "title", "meta_desc", "published_at",
            "atlas", "intro", "steps", "outro")


def refs(x):
    return x if isinstance(x, list) else [x] if x else []


def words(g):
    text = " ".join([g["intro"], g["outro"]] + [s["heading"] + " " + s["text"] for s in g["steps"]])
    return len(re.findall(r"[\w'’-]+", text))


def validate(g, atlas_dir=None):
    bad = [f"missing {k}" for k in REQUIRED if not g.get(k)]
    if bad:
        return bad
    if not SLUG_RX.match(g["slug"]) or not SLUG_RX.match(g["game"]):
        bad.append("slug/game must be lowercase-hyphen")
    if not g["steps"]:
        bad.append("no steps")
    for i, s in enumerate(g["steps"], 1):
        r = refs(s.get("atlas_ref"))
        if not r:
            bad.append(f"step {i} has no atlas_ref")
        bad += [f"step {i}: bad ref {x!r}" for x in r if not REF_RX.match(x)]
        if not s.get("heading") or not s.get("text"):
            bad.append(f"step {i}: heading and text required")
    n = words(g)
    if not MIN_WORDS <= n <= MAX_WORDS:
        bad.append(f"{n} words (needs {MIN_WORDS}-{MAX_WORDS})")
    body = " ".join([g["title"], g["intro"], g["outro"]] + [s["heading"] + " " + s["text"] for s in g["steps"]])
    if STAT_RX.search(body):
        bad.append(f"stat or crowd claim: {STAT_RX.search(body).group(0)!r}")
    if CLAIM_RX.search(body):
        bad.append(f"first-person play claim or Lux sign-off: {CLAIM_RX.search(body).group(0)!r}")
    if re.search(r"https?://", body):
        bad.append("links belong in store_url / wiki_credits, not the text")
    if not g["store_url"].startswith(("https://store.steampowered.com/", "https://store.playstation.com/",
                                      "https://www.xbox.com/", "https://www.nintendo.com/")):
        bad.append("store_url must be the game's store page")
    for w in g.get("wiki_credits") or []:
        if not (w.get("name") and w.get("url", "").startswith("https://") and w.get("license")):
            bad.append("wiki credit needs name, https url and license")
    if any("BY-SA" in (w.get("license") or "") for w in g.get("wiki_credits") or []) and not g.get("license"):
        g["license"] = "CC BY-SA 4.0"
    if atlas_dir:
        bad += check_refs(g, atlas_dir)
    return bad


def check_refs(g, atlas_dir):
    path = os.path.join(atlas_dir, f"{g['atlas']['app_id']}.json")
    if not os.path.exists(path):
        return [f"no atlas copy at {path}"]
    a = json.load(open(path, encoding="utf-8"))
    if (a.get("source") or {}).get("redistribute") is False:
        return ["atlas source.redistribute is false"]
    ids = {f"{k}/{r.get(k + '_id')}" for k in ("loot", "boss", "npc") for r in a.get(k, [])}
    ids |= {f"rooms/{k}" for k in a.get("rooms", {})} | {f"places/{k}" for k in a.get("places", {})}
    yt_path = os.path.join(atlas_dir, f"{g['atlas']['app_id']}.youtube.json")
    yt = json.load(open(yt_path, encoding="utf-8"))["youtube"]["by_category"] if os.path.exists(yt_path) else {}
    out = []
    for r in [x for s in g["steps"] for x in refs(s.get("atlas_ref"))] + refs(g.get("intro_ref")) + \
            refs(g.get("outro_ref")):
        if r.startswith("youtube:"):
            cat, i = r[8:].split("/")
            if int(i) >= len((yt.get(cat) or {}).get("tips", [])):
                out.append(f"ref {r} not in the YouTube deep pass")
        elif r not in ids:
            out.append(f"ref {r} not in the atlas")
    return out


def esc(s):
    return html.escape(s, quote=True)


def url(g):
    return f"{SITE}/guides/{g['game']}/{g['slug']}.html"


HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<script src="/assets/consent.js"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','AW-18496558698');</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="robots" content="index,follow,max-snippet:-1">
<link rel="canonical" href="{canonical}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Overlord AI">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{site}/og-thumbnail.png">
<meta name="twitter:card" content="summary_large_image">
<script>document.documentElement.setAttribute('data-theme', localStorage.getItem('data-theme') || 'dark');</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Space+Grotesk:wght@400;500&family=Space+Mono&display=swap" rel="stylesheet">
<style>
  :root{{--accent:#6d5cff;--faint:#6E6E7C;}}
  [data-theme="light"]{{--bg:#ffffff;--text:#0a0a0a;--muted:#5f5f66;--line:rgba(0,0,0,.10);--panel:#f6f6f8;}}
  [data-theme="dark"]{{--bg:#000000;--text:#ffffff;--muted:#a3a3a3;--line:rgba(255,255,255,.12);--panel:#101014;}}
  *{{margin:0;padding:0;box-sizing:border-box;}}
  body{{background:var(--bg);color:var(--text);font-family:'Space Grotesk',sans-serif;-webkit-font-smoothing:antialiased;line-height:1.65;}}
  a{{color:inherit;text-decoration-color:var(--accent);text-underline-offset:3px;}}
  .bar{{display:flex;align-items:center;gap:10px;padding:16px 24px;border-bottom:1px solid var(--line);}}
  .bar a{{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:'Anton',sans-serif;letter-spacing:.04em;text-transform:uppercase;font-size:18px;}}
  .bar__mark{{width:32px;height:32px;background:currentColor;-webkit-mask:url('/assets/rooster-nav.svg') center/contain no-repeat;mask:url('/assets/rooster-nav.svg') center/contain no-repeat;}}
  main{{max-width:720px;margin:0 auto;padding:40px 16px 72px;}}
  .crumbs{{font-family:'Space Mono',monospace;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;}}
  .crumbs a{{text-decoration:none;}}
  h1{{font-family:'Anton',sans-serif;font-weight:400;font-size:clamp(34px,6vw,52px);line-height:1.05;letter-spacing:.01em;text-transform:uppercase;margin:14px 0 14px;}}
  .byline{{font-family:'Space Mono',monospace;font-size:12px;color:var(--muted);margin-bottom:28px;}}
  .intro{{font-size:19px;margin-bottom:32px;}}
  ol.steps{{list-style:none;counter-reset:s;}}
  ol.steps li{{counter-increment:s;padding:20px 0;border-top:1px solid var(--line);}}
  ol.steps h2{{font-size:20px;font-weight:500;margin-bottom:6px;}}
  ol.steps h2::before{{content:counter(s,decimal-leading-zero);font-family:'Space Mono',monospace;font-size:13px;color:var(--accent);margin-right:12px;vertical-align:2px;}}
  .see{{font-size:15px;color:var(--muted);margin-top:6px;}}
  .outro{{border-top:1px solid var(--line);padding-top:20px;}}
  .live{{margin-top:32px;padding:16px 18px;background:var(--panel);border:1px solid var(--line);border-radius:8px;font-size:16px;}}
  .sources{{margin-top:40px;font-size:13px;color:var(--muted);}}
  .sources h2{{font-family:'Space Mono',monospace;font-size:12px;font-weight:400;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;}}
  .sources p{{margin-bottom:4px;}}
  ul.list{{list-style:none;}}
  ul.list li{{padding:10px 0;border-top:1px solid var(--line);}}
  h2.game{{font-family:'Space Mono',monospace;font-size:13px;font-weight:400;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:32px 0 6px;}}
  footer{{border-top:1px solid var(--line);padding:24px 16px;font-size:13px;color:var(--muted);}}
  footer .in{{max-width:720px;margin:0 auto;display:flex;flex-wrap:wrap;gap:8px 18px;}}
  footer a{{text-decoration:none;}}
</style>
{jsonld}
</head>
<body>
<header class="bar"><a href="/"><span class="bar__mark" aria-hidden="true"></span>Overlord AI</a></header>
<main>
"""

FOOT = """</main>
<footer><div class="in">
  <span>&copy; 2026 Overlord AI</span>
  <a href="/">Home</a><a href="/plans.html">Plans</a><a href="/support.html">Support / FAQ</a>
  <a href="/terms.html">Terms</a><a href="/privacy.html">Privacy</a><a href="/contact.html">Contact</a>
  <a href="/guides/">Guides</a>
</div></footer>
</body>
</html>
"""


def page(g):
    canonical = url(g)
    ld = [{"@context": "https://schema.org", "@type": "Article", "headline": g["title"],
           "description": g["meta_desc"], "datePublished": g["published_at"],
           "dateModified": g.get("updated_at") or g["published_at"], "mainEntityOfPage": canonical,
           "author": {"@type": "Organization", "name": "Overlord AI", "url": SITE + "/"},
           "publisher": {"@type": "Organization", "name": "Overlord AI", "url": SITE + "/",
                         "logo": {"@type": "ImageObject", "url": SITE + "/icon-512.png"}},
           "about": {"@type": "VideoGame", "name": g["game_title"], "url": g["store_url"]},
           **({"license": "https://creativecommons.org/licenses/by-sa/4.0/"} if g.get("license") else {})},
          {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
              {"@type": "ListItem", "position": 1, "name": "Guides", "item": SITE + "/guides/"},
              {"@type": "ListItem", "position": 2, "name": g["title"], "item": canonical}]}]
    out = [HEAD.format(title=esc(g["title"]) + " | Overlord AI", desc=esc(g["meta_desc"]), canonical=canonical,
                       site=SITE, jsonld="\n".join(f'<script type="application/ld+json">{json.dumps(x)}</script>'
                                                   for x in ld))]
    out.append(f'<p class="crumbs"><a href="/guides/">Guides</a> / <a href="{esc(g["game_page"])}">'
               f'{esc(g["game_title"])}</a></p>')
    out.append(f"<h1>{esc(g['title'])}</h1>")
    d = dt.date.fromisoformat(g["published_at"])
    out.append(f'<p class="byline">Overlord AI · From Overlord\'s Atlas data · {d.day} {d:%b %Y}</p>')
    out.append(f'<p class="intro">{esc(g["intro"])}</p>')
    out.append('<ol class="steps">')
    for s in g["steps"]:
        see = (f'<p class="see">More: <a href="{esc(s["see"])}">the full route</a></p>' if s.get("see") else "")
        out.append(f"<li><h2>{esc(s['heading'])}</h2><p>{esc(s['text'])}</p>{see}</li>")
    out.append("</ol>")
    outro = esc(g["outro"])
    if g.get("outro_link"):
        outro += f' <a href="{esc(g["outro_link"])}">See every Shell.</a>' if "shell" in g["outro_link"] else \
            f' <a href="{esc(g["outro_link"])}">Read it here.</a>'
    out.append(f'<p class="outro">{outro}</p>')
    out.append(f'<p class="live">Stuck somewhere else in {esc(g["game_title"])}? Overlord is a live game guidebook '
               f'that can talk you through it while you play. <a href="{esc(g["game_page"])}">See how it works</a>.</p>')
    src = [f'<p>Facts on this page come from Overlord\'s Atlas for {esc(g["game_title"])} '
           f'(updated {esc(g["atlas"].get("updated", ""))}), written up in our own words.</p>']
    for y in g.get("youtube_credits") or []:
        src.append(f"<p>Tip credit: {esc(y['channel'])}, “{esc(y['title'])}” ({esc(y['timestamp'])}).</p>")
    for w in g.get("wiki_credits") or []:
        src.append(f'<p>Some facts from <a href="{esc(w["url"])}" rel="noopener">{esc(w["name"])}</a> '
                   f'({esc(w["license"])}).</p>')
    if g.get("license"):
        src.append('<p>This page is licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/" '
                   'rel="license noopener">CC BY-SA 4.0</a>.</p>')
    src.append(f'<p>Game: <a href="{esc(g["store_url"])}" rel="noopener">{esc(g["game_title"])} on its store page</a>.</p>')
    out.append('<section class="sources"><h2>Sources</h2>' + "".join(src) + "</section>")
    out.append(FOOT)
    return "\n".join(out)


def index(guides):
    out = [HEAD.format(title="Guides | Overlord AI", desc="Stuck points, boss fights and hidden items, from "
                       "Overlord's Atlas data.", canonical=SITE + "/guides/", site=SITE, jsonld="")]
    out.append('<p class="crumbs">Guides</p><h1>Guides</h1>')
    by = {}
    for g in guides:
        by.setdefault(g["game_title"], []).append(g)
    for game in sorted(by):
        out.append(f'<h2 class="game">{esc(game)}</h2><ul class="list">')
        for g in sorted(by[game], key=lambda x: x["title"]):
            out.append(f'<li><a href="/guides/{g["game"]}/{g["slug"]}.html">{esc(g["title"])}</a></li>')
        out.append("</ul>")
    out.append(FOOT)
    return "\n".join(out)


def sitemap(guides):
    xml = open(SITEMAP, encoding="utf-8").read()
    xml = re.sub(re.escape(SM_START) + r"[\s\S]*?" + re.escape(SM_END) + r"\n?", "", xml)
    block = [SM_START, f"  <url>\n    <loc>{SITE}/guides/</loc>\n    <changefreq>weekly</changefreq>\n"
                       f"    <priority>0.5</priority>\n  </url>"]
    for g in sorted(guides, key=lambda x: url(x)):
        block.append(f"  <url>\n    <loc>{url(g)}</loc>\n    <lastmod>{g.get('updated_at') or g['published_at']}"
                     f"</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>")
    block.append(SM_END)
    xml = xml.replace("</urlset>", "\n".join(block) + "\n</urlset>")
    open(SITEMAP, "w", encoding="utf-8", newline="\n").write(xml)


def load():
    out = []
    for game in sorted(os.listdir(DATA)) if os.path.isdir(DATA) else []:
        for f in sorted(os.listdir(os.path.join(DATA, game))):
            if f.endswith(".json"):
                p = os.path.join(DATA, game, f)
                g = json.load(open(p, encoding="utf-8"))
                if g.get("slug") + ".json" != f or g.get("game") != game:
                    g["_bad"] = [f"file name/folder must match slug/game ({p})"]
                g["_path"] = p
                out.append(g)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--atlas")
    a = ap.parse_args()
    guides, ok, failed = load(), [], False
    for g in guides:
        bad = g.pop("_bad", []) + validate(g, a.atlas)
        rel = os.path.relpath(g.pop("_path"), ROOT)
        if bad:
            failed = True
            print(f"FAIL {rel}: " + "; ".join(bad))
        else:
            print(f"ok   {rel} ({words(g)} words)")
            ok.append(g)
    if a.check:
        sys.exit(1 if failed else 0)
    keep = set()
    for g in ok:
        p = os.path.join(OUT, g["game"], g["slug"] + ".html")
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "w", encoding="utf-8", newline="\n").write(page(g))
        keep.add(os.path.normpath(p))
    # a guide whose JSON was deleted (taken down) loses its page
    for game in os.listdir(OUT):
        d = os.path.join(OUT, game)
        if game != "data" and os.path.isdir(d):
            for f in os.listdir(d):
                p = os.path.normpath(os.path.join(d, f))
                if f.endswith(".html") and p not in keep:
                    os.remove(p)
                    print(f"removed {os.path.relpath(p, ROOT)}")
    open(os.path.join(OUT, "index.html"), "w", encoding="utf-8", newline="\n").write(index(ok))
    sitemap(ok)
    print(f"built {len(ok)} guide page(s), index and sitemap")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
