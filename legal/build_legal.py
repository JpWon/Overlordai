#!/usr/bin/env python3
"""Assemble the legal pages from legal/_skeleton.html (the site chrome + the .lg stylesheet) and
the per-document content fragments. The chrome lives in ONE file: edit it in the skeleton, never
in a generated page, or EULA / Privacy / Terms drift apart.

  python3 legal/build_legal.py                 # rebuild eula, privacy, terms, refunds, contact
  python3 legal/build_legal.py eula            # rebuild one
"""
import html
import json
import sys
from pathlib import Path

S = Path(__file__).resolve().parent
ROOT = S.parent
DOCS = ("eula", "privacy", "terms", "refunds", "contact")
MARKER = "<!-- CONTENT -->"
SITE = "https://www.overlordai.co"

# Each page's OWN head (2026-10-13 SEO audit: the skeleton carried support.html's
# title, description, canonical and FAQ, so all three canonicalized to support
# and Google indexed none of them). Descriptions <= 155 chars, titles <= 60.
PAGE_META = {
    "privacy": ("Privacy Policy \u2014 Overlord AI",
                "What Overlord AI collects, what stays on your machine, and how screen reads and voice data "
                "are handled. Plain-language privacy policy."),
    "terms": ("Terms of Service \u2014 Overlord AI",
              "Terms of service for Overlord AI, the live voice co-pilot for single-player games on "
              "Windows and Linux."),
    "eula": ("End-User Licence Agreement \u2014 Overlord AI",
             "End-user licence agreement for the Overlord AI desktop app on Windows and Linux."),
    "refunds": ("Refund Policy \u2014 Overlord AI",
                "Full refund within 3 days of your first payment. How to cancel, how to ask for a refund "
                "through Paddle, and your legal rights."),
    "contact": ("Contact \u2014 Overlord AI",
                "Contact Overlord AI (Primus Enterprises LLC): support email, billing and refunds, privacy "
                "requests and our business address."),
}


def fill_head(skel: str, name: str) -> str:
    """The skeleton's {{...}} head tokens -> this page's title, description and URL."""
    title, desc = PAGE_META[name]
    assert len(title) <= 60 and len(desc) <= 155, f"{name}: title {len(title)} / description {len(desc)}"
    url = f"{SITE}/{name}.html"
    out = (skel.replace("{{TITLE_JSON}}", json.dumps(title))
               .replace("{{DESCRIPTION_JSON}}", json.dumps(desc))
               .replace("{{TITLE}}", html.escape(title, quote=True))
               .replace("{{DESCRIPTION}}", html.escape(desc, quote=True))
               .replace("{{URL}}", url))
    assert "{{" not in out.split(MARKER)[0], f"{name}: an unfilled head token is left"
    return out


def build(name: str) -> tuple[Path, int]:
    frag = (S / f"{name}.content.html").read_text(encoding="utf-8")
    skel = (S / "_skeleton.html").read_text(encoding="utf-8")
    assert skel.count(MARKER) == 1, "skeleton marker missing or duplicated"
    assert "<!-- CONTENT -->" not in frag, f"{name}.content.html must not contain the marker"
    out = fill_head(skel, name).replace(MARKER, frag.rstrip() + "\n")
    dst = ROOT / f"{name}.html"
    dst.write_text(out, encoding="utf-8")
    return dst, len(out)


if __name__ == "__main__":
    wanted = sys.argv[1:] or list(DOCS)
    for n in wanted:
        assert n in DOCS, f"unknown document {n}"
        p, size = build(n)
        print(f"{p.name}: {size} bytes")
