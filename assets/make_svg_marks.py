#!/usr/bin/env python3
"""Emit either mark as SVG: crisp at any size, true transparency, optional paper tile,
fine grain + speckle as turbulence clipped inside the mark.

Usage: make_svg_marks.py <outdir> [rooster|profile]
Geometry comes from the generator module, so vector and PNG can never drift apart.
"""
import sys
from pathlib import Path

VARIANT = sys.argv[2] if len(sys.argv) > 2 else "rooster"
sys.path.insert(0, "/home/eros/.hermes/cache/scratch")
mod = __import__("make_rooster" if VARIANT == "rooster" else "make_profile")

PAPER, INK = "#e7e5e2", "#1c1a17"
V = 1024

def signed_area(pts):
    a = 0.0
    for i in range(len(pts)):
        x0, y0 = pts[i]; x1, y1 = pts[(i + 1) % len(pts)]
        a += x0 * y1 - x1 * y0
    return a / 2

def geometry():
    SZ = V / mod.SS                      # generators work supersampled; ask for V units
    subs = [mod.shape_points(SZ)[0]]     # the traced outline
    if VARIANT == "profile":             # + the grafted beak and comb
        subs += [mod.beak_points(SZ), mod.comb_points(SZ)]
    # subpaths only union under fill-rule:nonzero if they wind the same way
    ref = signed_area(subs[0]) > 0
    subs = [s if (signed_area(s) > 0) == ref else s[::-1] for s in subs]
    d = " ".join("M" + " L".join(f"{x:.2f},{y:.2f}" for (x, y) in s) + " Z" for s in subs)
    scale, xf, yf = mod.transform(SZ)
    unit = mod.BH if VARIANT == "rooster" else mod.BW
    cx, cy = xf(mod.X0 + mod.EYE_CX_F * mod.BW), yf(mod.Y0 + mod.EYE_CY_F * mod.BH)
    r = mod.EYE_R_F * unit * scale
    return d, cx, cy, r

def svg(mark_colour, tile=None, grain=True):
    d, cx, cy, r = geometry()
    mask = (f'<mask id="hole" maskUnits="userSpaceOnUse" x="0" y="0" width="{V}" height="{V}">'
            f'<rect width="{V}" height="{V}" fill="#fff"/>'
            f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="#000"/></mask>')
    filt = (f'<filter id="aged" x="0" y="0" width="100%" height="100%">'
            f'<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>'
            f'<feColorMatrix in="n" type="saturate" values="0" result="g"/>'
            f'<feComponentTransfer in="g" result="s">'
            f'<feFuncA type="linear" slope="0.13" intercept="0"/></feComponentTransfer>'
            f'<feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="23" result="b"/>'
            f'<feColorMatrix in="b" type="saturate" values="0" result="b2"/>'
            f'<feComponentTransfer in="b2" result="b3">'
            f'<feFuncA type="discrete" tableValues="0 0 0 0.10 0 0 0 0 0.07 0"/></feComponentTransfer>'
            f'<feMerge result="allnoise"><feMergeNode in="s"/><feMergeNode in="b3"/></feMerge>'
            f'<feComposite in="allnoise" in2="SourceGraphic" operator="in" result="clipped"/>'
            f'<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="clipped"/></feMerge>'
            f'</filter>') if grain else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {V} {V}" width="{V}" height="{V}" '
            f'role="img" aria-label="Overlord AI">\n  <defs>{mask}{filt}</defs>\n'
            + (f'  <rect width="{V}" height="{V}" fill="{tile}"/>\n' if tile else '')
            + f'  <path d="{d}" fill="{mark_colour}" fill-rule="nonzero" mask="url(#hole)"'
            + (' filter="url(#aged)"' if grain else '') + '/>\n</svg>\n')

if __name__ == "__main__":
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    stem = "rooster" if VARIANT == "rooster" else "profile"
    (out / f"{stem}-ink.svg").write_text(svg(INK))
    (out / f"{stem}-paper.svg").write_text(svg(PAPER))
    (out / "favicon.svg").write_text(svg(INK, tile=PAPER))
    print(f"wrote {stem}-ink.svg, {stem}-paper.svg, favicon.svg")
