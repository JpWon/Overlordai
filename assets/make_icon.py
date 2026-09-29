#!/usr/bin/env python3
"""Overlord AI mark — a symmetric Rorschach blot in the reference's palette.

Reference style (sampled from the user's image): matte paper #E7E5E2, flat warm ink
#1C1A17, a two-dot bar cut out of the silhouette. Asked-for differences: the blot is
bilaterally symmetric like a Rorschach test card, and ink and paper carry grain
rather than being flat fills.

Deterministic: same seed -> same mark.
"""
import math, random, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

PAPER = (231, 229, 226)   # #E7E5E2
INK   = (28, 26, 23)      # #1C1A17
SS    = 4                 # supersample factor for edge quality

def smooth(values, passes=2):
    v = list(values)
    for _ in range(passes):
        v = [(v[max(0, i-1)] + 2*v[i] + v[min(len(v)-1, i+1)]) / 4 for i in range(len(v))]
    return v

def ctrl_curve(ctrl, s):
    """cosine-eased interpolation through control points"""
    for k in range(len(ctrl) - 1):
        x0, y0 = ctrl[k]; x1, y1 = ctrl[k + 1]
        if x0 <= s <= x1:
            t = (s - x0) / (x1 - x0)
            return y0 + (y1 - y0) * ((1 - math.cos(math.pi * t)) / 2)
    return ctrl[-1][1]

def catmull(pts, samples_per_seg=90):
    """Catmull-Rom through the control points -> a clean deliberate curve, not ripple"""
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(len(P) - 3):
        p0, p1, p2, p3 = P[i], P[i+1], P[i+2], P[i+3]
        for j in range(samples_per_seg):
            t = j / samples_per_seg
            t2, t3 = t*t, t*t*t
            out.append(tuple(
                0.5 * ((2*p1[k]) + (-p0[k] + p2[k]) * t +
                       (2*p0[k] - 5*p1[k] + 4*p2[k] - p3[k]) * t2 +
                       (-p0[k] + 3*p1[k] - 3*p2[k] + p3[k]) * t3) for k in (0, 1)))
    out.append(pts[-1])
    return out

def half_profile():
    """right-hand edge of the mask, as (x = fraction of max half-width, y = 0 top .. 1 chin).
    Deliberate lobes — crown, temple, brow, cheek, jaw — the way an inked mask reads,
    rather than random ripple which just looks torn."""
    return [(0.00, 0.000), (0.22, 0.004), (0.46, 0.030), (0.64, 0.105),
            (0.58, 0.240), (0.72, 0.345), (0.66, 0.480),
            (0.72, 0.600), (0.56, 0.745), (0.32, 0.880), (0.00, 1.000)]

def blot_alpha(size, seed=7, scale=0.74, halfw_frac=0.225):
    """smooth anti-aliased alpha of the symmetric blot — a soft ink edge instead of a
    blurred-then-thresholded mask (thresholding jitter is what looks like noise)"""
    W = size * SS
    cx = W / 2
    bh = W * scale
    top = (W - bh) / 2
    halfw = W * halfw_frac
    prof = catmull(half_profile(), samples_per_seg=110)
    right = [(cx + x * halfw, top + y * bh) for (x, y) in prof]

    m = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(m)
    d.polygon(right + [(2*cx - x, y) for (x, y) in reversed(right)], fill=255)

    # No internal cut-outs: a solid inked silhouette. The Rorschach read comes from the
    # bilateral symmetry, and a bolder shape survives being drawn at 16px.
    return m.filter(ImageFilter.GaussianBlur(0.9 * SS))

def apply_grain(img, sigma, strength=4):
    """signed mottling. effect_noise is centred on 128 and ImageChops' `scale` divides
    the whole sum, so split the noise into positive/negative parts and divide each."""
    n = Image.effect_noise(img.size, sigma).convert("L")
    pos = n.point(lambda v: max(0, v - 128) // strength).convert(img.mode)
    neg = n.point(lambda v: max(0, 128 - v) // strength).convert(img.mode)
    return ImageChops.subtract(ImageChops.add(img, pos), neg)

def motif(size):
    """two dots joined by a bar, cut out of the silhouette"""
    W = size
    m = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(m)
    r, gap, y = W * 0.034, W * 0.088, W * 0.400
    d.ellipse([W/2 - gap - r, y - r, W/2 - gap + r, y + r], fill=255)
    d.ellipse([W/2 + gap - r, y - r, W/2 + gap + r, y + r], fill=255)
    d.rounded_rectangle([W/2 - gap, y - r*0.26, W/2 + gap, y + r*0.26], radius=r*0.26, fill=255)
    return m

def render(size, bg, fg, seed=7, noise=8, scale=0.74, halfw_frac=0.225):
    W = size * SS
    base = apply_grain(Image.new("RGB", (W, W), bg), noise)
    alpha = ImageChops.subtract(blot_alpha(size, seed, scale, halfw_frac), motif(W))
    ink = apply_grain(Image.new("RGB", (W, W), fg), noise + 6)
    return Image.composite(ink, base, alpha).resize((size, size), Image.LANCZOS)

if __name__ == "__main__":
    outdir = sys.argv[1] if len(sys.argv) > 1 else "."
    for name, bg, fg in (("light", PAPER, INK), ("dark", INK, PAPER)):
        big = render(1024, bg, fg, seed=7)
        big.save(f"{outdir}/mark-{name}-1024.png")
        for s in (512, 256, 180, 128, 64, 48, 32, 16):
            big.resize((s, s), Image.LANCZOS).save(f"{outdir}/mark-{name}-{s}.png")
    print("wrote mark-light/mark-dark: 1024, 512, 256, 180, 128, 64, 48, 32, 16")
