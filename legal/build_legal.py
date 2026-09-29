#!/usr/bin/env python3
"""Assemble the legal pages from legal/_skeleton.html (the site chrome + the .lg stylesheet) and
the per-document content fragments. The chrome lives in ONE file: edit it in the skeleton, never
in a generated page, or EULA / Privacy / Terms drift apart.

  python3 legal/build_legal.py                 # rebuild eula.html, privacy.html, terms.html
  python3 legal/build_legal.py eula            # rebuild one
"""
import sys
from pathlib import Path

S = Path(__file__).resolve().parent
ROOT = S.parent
DOCS = ("eula", "privacy", "terms")
MARKER = "<!-- CONTENT -->"


def build(name: str) -> tuple[Path, int]:
    frag = (S / f"{name}.content.html").read_text(encoding="utf-8")
    skel = (S / "_skeleton.html").read_text(encoding="utf-8")
    assert skel.count(MARKER) == 1, "skeleton marker missing or duplicated"
    assert "<!-- CONTENT -->" not in frag, f"{name}.content.html must not contain the marker"
    out = skel.replace(MARKER, frag.rstrip() + "\n")
    dst = ROOT / f"{name}.html"
    dst.write_text(out, encoding="utf-8")
    return dst, len(out)


if __name__ == "__main__":
    wanted = sys.argv[1:] or list(DOCS)
    for n in wanted:
        assert n in DOCS, f"unknown document {n}"
        p, size = build(n)
        print(f"{p.name}: {size} bytes")
