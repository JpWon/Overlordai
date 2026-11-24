"""Build assets/search-index.json for the header search (JP 2026-11-24).

Only pages listed in sitemap.xml are indexed, so noindex pages (checkout,
dashboard, lux, ...) never show up in search. Every FAQ question
(<details class="faq__item">) becomes its own result.

Run after adding or changing a page or guide:
    /c/Python315/python.exe site-tools/build-search-index.py
"""
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://www.overlordai.co/"

GAME_PAGES = {"wukong", "eldenring", "soulslike", "sekiro", "liesofp",
              "mortalshell2", "crimsondesert", "phantombladezero", "roster", "featured"}
HELP_PAGES = {"support", "contact", "fair-play", "refunds", "privacy", "terms", "eula", "login"}


def clean(s):
    s = re.sub(r"<script\b.*?</script>|<style\b.*?</style>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def meta(page, name):
    m = re.search(r'<meta\s+name="%s"\s+content="([^"]*)"' % name, page, re.I)
    return html.unescape(m.group(1)).strip() if m else ""


def title_of(page):
    m = re.search(r"<title>(.*?)</title>", page, re.S | re.I)
    t = clean(m.group(1)) if m else ""
    short = re.sub(r"^Overlord AI\s*[—|-]\s*", "", t)
    short = re.sub(r"\s*[|—-]\s*Overlord AI\b.*$", "", short).strip()
    return short or t


def file_for(url):
    path = url.replace(SITE, "").split("#")[0]
    if path in ("", "/"):
        path = "index.html"
    elif path.endswith("/"):
        path += "index.html"
    elif not path.endswith(".html"):
        path += ".html"
    return path


def kind_of(path):
    stem = os.path.splitext(os.path.basename(path))[0]
    if path.startswith("guides/"):
        return "Guide"
    if stem in GAME_PAGES:
        return "Game"
    if stem in HELP_PAGES:
        return "Help"
    return "Page"


def main():
    with open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8") as f:
        urls = re.findall(r"<loc>([^<]+)</loc>", f.read())
    out = []
    for url in urls:
        path = file_for(url)
        full = os.path.join(ROOT, path)
        if not os.path.exists(full):
            print("skip (no file):", url)
            continue
        with open(full, encoding="utf-8") as f:
            page = f.read()
        body = page.split("<body", 1)[-1]
        body = re.sub(r"<nav\b.*?</nav>|<footer\b.*?</footer>", " ", body, flags=re.S | re.I)
        body = re.sub(r'<div class="navbar-drawer".*?</nav>', " ", body, flags=re.S | re.I)
        heads = [clean(h) for h in re.findall(r"<h[1-3][^>]*>(.*?)</h[1-3]>", body, re.S | re.I)]
        href = "/" + (path[:-len("index.html")] if path.endswith("index.html") else path)
        game = ""
        if path.startswith("guides/") and path.count("/") == 2:
            game = path.split("/")[1].replace("-", " ").title()
            game = re.sub(r"\b(Ii|Iii|Iv)\b", lambda m: m.group(1).upper(), game)
        out.append({
            "t": title_of(page),
            "d": meta(page, "description"),
            "u": href,
            "k": kind_of(path),
            "g": game,
            "h": " · ".join(h for h in heads if h)[:600],
            "x": clean(body)[:3000],
        })
        for q, a in re.findall(r'<details class="faq__item"><summary>(.*?)</summary>(.*?)</details>',
                               body, re.S | re.I):
            q, a = clean(q), clean(a)
            out.append({"t": q, "d": a[:180] + ("…" if len(a) > 180 else ""),
                        "u": href + "#q=" + re.sub(r"[^a-z0-9]+", "-", q.lower()).strip("-"),
                        "k": "Help", "g": "", "h": "", "x": a})
    dest = os.path.join(ROOT, "assets", "search-index.json")
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("wrote", len(out), "entries ->", os.path.relpath(dest, ROOT))


if __name__ == "__main__":
    main()
