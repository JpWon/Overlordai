#!/usr/bin/env python3
"""Overlord AI mark, variant B — the rooster head traced straight from the user's reference.

Everything (comb, beak, ruff) is in the traced outline; only the single side-set eye and the
noise are added. Same palette, same grain/foxing pipeline as the profile mark, so the two
variants can be compared like for like.
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

sys.path.insert(0, "/home/eros/.hermes/cache/scratch")
from make_icon import PAPER, INK, SS, apply_grain
from make_profile import smooth_closed, resample, speckle, foxed

T = json.load(open("/home/eros/.hermes/cache/scratch/rooster_trace.json"))
X0, Y0, X1, Y1 = T["bbox"]
BW, BH = X1 - X0 + 1, Y1 - Y0 + 1

# one eye, set on the side of the head just behind the beak base (bbox fractions)
EYE_CX_F, EYE_CY_F, EYE_R_F = 0.400, 0.395, 11.0 / BH

def transform(size, fill=0.80, fit_w=0.90):
    W = size * SS
    scale = min((W * fill) / BH, (W * fit_w) / BW)
    cx, cy = W / 2, W / 2
    bcx, bcy = (X0 + X1) / 2, (Y0 + Y1) / 2
    return scale, (lambda x: cx + (x - bcx) * scale), (lambda y: cy + (y - bcy) * scale)

def shape_points(size, fill=0.80, fit_w=0.90):
    pts = smooth_closed([tuple(p) for p in T["contour"]], 9, 4)   # round the comb tips
    pts = resample(pts, 900)
    scale, xf, yf = transform(size, fill, fit_w)
    return [(xf(x), yf(y)) for (x, y) in pts], scale, xf, yf

def eye_mask(size, fill=0.80, fit_w=0.90, fat=1.0):
    W = size * SS
    scale, xf, yf = transform(size, fill, fit_w)
    m = Image.new("L", (W, W), 0)
    cx, cy = xf(X0 + EYE_CX_F * BW), yf(Y0 + EYE_CY_F * BH)
    r = EYE_R_F * BH * scale * fat
    ImageDraw.Draw(m).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    return m

def alpha(size, fill=0.80, fit_w=0.90, fat=1.0):
    W = size * SS
    pts, *_ = shape_points(size, fill, fit_w)
    m = Image.new("L", (W, W), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(0.8 * SS))
    return ImageChops.subtract(m, eye_mask(size, fill, fit_w, fat))

def render(size, bg, fg, fill=0.80, noise=8, transparent=False, foxing=True):
    W = size * SS
    fat = 1.0 if size >= 20 else 1.5
    a = alpha(size, fill, fat=fat)
    ink = apply_grain(Image.new("RGB", (W, W), fg), noise + 6)
    if foxing:
        # the reference's own noise is a dense scatter of pale specks inside the shape
        ink = ImageChops.add(ink, speckle(W, 11, count=6000).convert("RGB").point(lambda v: v // 4))
    if transparent:
        out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
        out.paste(ink, (0, 0), a)
    else:
        base = apply_grain(Image.new("RGB", (W, W), bg), noise)
        if foxing:
            base = foxed(base, W, 5, 3)
        out = Image.composite(ink, base, a).convert("RGBA")
    return out.resize((size, size), Image.LANCZOS)

if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    variants = {
        "tile":  dict(bg=PAPER, fg=INK, transparent=False),
        "dark":  dict(bg=INK,   fg=PAPER, transparent=False),
        "ink":   dict(bg=None,  fg=INK, transparent=True),
        "paper": dict(bg=None,  fg=PAPER, transparent=True),
    }
    for name, kw in variants.items():
        render(1024, **kw).save(out / f"rooster-{name}-1024.png")
        for s in (512, 256, 180, 128, 64, 48, 32, 16):
            render(s, **kw).save(out / f"rooster-{name}-{s}.png")
    print("wrote rooster-{tile,dark,ink,paper} at 1024 + 512,256,180,128,64,48,32,16")
