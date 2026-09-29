#!/usr/bin/env python3
"""Overlord AI mark — a rooster head in profile.

Silhouette traced from the user's reference (119x211 head mass), then given, in order:
the beak, the jaw tuck, and now the ROOSTER COMB along the crown (rounded spikes leaning
back, from the third reference). One eye only, set on the side of the head so it reads as
looking sideways. Noise: fine grain + the reference's speckle — dark foxing on the paper,
pale flecks inside the ink. Exports opaque tiles and transparent versions.
"""
import json, math, random, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

sys.path.insert(0, "/home/eros/.hermes/cache/scratch")
from make_icon import PAPER, INK, SS, apply_grain   # palette + grain helper

TRACE = json.load(open("/home/eros/.hermes/cache/scratch/profile_trace.json"))
X0, Y0, X1, Y1 = TRACE["bbox"]
BW, BH = X1 - X0 + 1, Y1 - Y0 + 1

# --- the beak, in blot fractions (x: 0 = blot left edge, 1 = right; y: 0 top, 1 bottom) ---
BEAK = [(0.36, 0.340), (0.16, 0.345), (-0.06, 0.372), (-0.26, 0.418),   # ridge
        (-0.46, 0.482), (-0.64, 0.552), (-0.80, 0.628), (-0.88, 0.662),  # tip, drooping
        (-0.72, 0.640), (-0.52, 0.596), (-0.32, 0.556), (-0.12, 0.524),  # underside
        (0.08, 0.508), (0.36, 0.560)]
BEAK_TIP_F = 0.88                      # how far left of the blot's edge the beak reaches (x BW)

# --- the comb: rounded fingers leaning back, grafted onto the crown (y<0 is above it) ---
COMB = [(0.14, 0.145)]                 # front base, dipping into the brow
SPIKES = [(0.225, 0.075), (0.345, 0.130), (0.465, 0.155), (0.585, 0.110)]   # (x, height)
COMB_TOP_F = max(h for _, h in SPIKES)
COMB_END, VALLEY_Y = (0.70, 0.165), 0.012

# eye: ONE round eye, set on the side of the head just behind the beak base
EYE_CX_F, EYE_CY_F, EYE_R_F = 0.425, 0.395, 11.0 / BW

def tuck(pts):
    """tuck the jaw/cheek bulge under the beak, so the beak is the only protrusion and the
    lower face reads as one plane (the reference's own wavy edge kept everywhere else)"""
    fp, target = 0.70, X0 + 0.20 * BW
    out = []
    for (x, y) in pts:
        fy = (y - Y0) / BH
        w = 0.0
        if 0.48 < fy < 0.94:
            w = max(0.0, 1 - abs(fy - fp) / 0.23) ** 1.2
        if w > 0 and x < target:
            x = x + (target - x) * w * 0.78
        out.append((x, y))
    return out

# combined bounding box of head + beak + comb: the mark is scaled/centred on this
SX0 = X0 - BEAK_TIP_F * BW
SW = X1 - SX0
SY0 = Y0 - COMB_TOP_F * BH
SH = Y1 - SY0

def smooth_closed(pts, window=9, passes=3):
    n = len(pts)
    half = window // 2
    for _ in range(passes):
        pts = [(sum(pts[(i + k) % n][0] for k in range(-half, half + 1)) / window,
                sum(pts[(i + k) % n][1] for k in range(-half, half + 1)) / window) for i in range(n)]
    return pts

def resample(pts, m):
    """even spacing by arc length, so polygon drawing is smooth"""
    n = len(pts)
    seg = [math.dist(pts[i], pts[(i + 1) % n]) for i in range(n)]
    total = sum(seg)
    out, target, acc, i = [], 0.0, 0.0, 0
    step = total / m
    while len(out) < m and i < n:
        if acc + seg[i] >= target:
            t = (target - acc) / seg[i] if seg[i] else 0
            ax, ay = pts[i]; bx, by = pts[(i + 1) % n]
            out.append((ax + (bx - ax) * t, ay + (by - ay) * t))
            target += step
        else:
            acc += seg[i]; i += 1
    return out

def spline(pts, samples_per_seg=80):
    """Catmull-Rom through control points; clamped ends (open curve)"""
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(len(P) - 3):
        p0, p1, p2, p3 = P[i], P[i+1], P[i+2], P[i+3]
        for j in range(samples_per_seg):
            t = j / samples_per_seg
            t2, t3 = t*t, t*t*t
            out.append(tuple(0.5 * ((2*p1[k]) + (-p0[k] + p2[k]) * t +
                                    (2*p0[k] - 5*p1[k] + 4*p2[k] - p3[k]) * t2 +
                                    (-p0[k] + 3*p1[k] - 3*p2[k] + p3[k]) * t3) for k in (0, 1)))
    out.append(pts[-1])
    return out

def transform(size, fill=0.76, fit_w=0.90):
    """scale + centring for head+beak+comb, fitted inside the canvas on both axes"""
    W = size * SS
    scale = min((W * fill) / SH, (W * fit_w) / SW)
    cx, cy = W / 2, W / 2
    bcx, bcy = (SX0 + X1) / 2, (SY0 + Y1) / 2
    return scale, (lambda x: cx + (x - bcx) * scale), (lambda y: cy + (y - bcy) * scale)

def shape_points(size, fill=0.76, fit_w=0.90):
    pts = tuck(smooth_closed([tuple(p) for p in TRACE["contour"]], 5, 1))
    pts = smooth_closed(pts, 9, 2)
    pts = resample(pts, 700)
    scale, xf, yf = transform(size, fill, fit_w)
    return [(xf(x), yf(y)) for (x, y) in pts], scale, xf, yf

def beak_control(fat=1.0):
    """fat > 1 thickens the beak about its own midline (keeps the tip sharp) — an optical
    adjustment so the beak survives at 16-20 px, where the thin front would vanish"""
    if fat == 1.0:
        return [(X0 + bx * BW, Y0 + by * BH) for (bx, by) in BEAK]
    b0, t0 = BEAK[0][0], min(bx for (bx, _) in BEAK)          # base x .. tip x
    out = []
    for (bx, by) in BEAK:
        t = (b0 - bx) / (b0 - t0) if b0 != t0 else 0.0
        mid = 0.450 + (0.662 - 0.450) * t                      # beak midline at this point
        out.append((X0 + bx * BW, Y0 + (mid + (by - mid) * fat) * BH))
    return out

def comb_control(fat=1.0):
    """the comb outline: front base -> up over each rounded spike -> back base. Each spike is
    a rounded finger (a small plateau at the top) leaning back, like the reference.
    `fat` scales spike height for the small-size optical variant."""
    def P(fx, fy):
        return (X0 + fx * BW, Y0 + fy * BH * (fat if fy < 0 else 1.0))
    pts = [P(*COMB[0])]
    for i, (cx, h) in enumerate(SPIKES):
        pts += [P(cx - 0.036, -h * 0.42), P(cx - 0.026, -h * 0.88),
                P(cx - 0.010, -h), P(cx + 0.014, -h * 0.97),          # rounded finger top
                P(cx + 0.030, -h * 0.66), P(cx + 0.042, -h * 0.30)]
        nxt = SPIKES[i + 1][0] if i + 1 < len(SPIKES) else COMB_END[0]
        pts += [P((cx + nxt) / 2 + 0.012, VALLEY_Y)]                   # rounded valley
    pts.append(P(*COMB_END))
    # close the loop inside the crown, so the union is seamless
    pts += [P(COMB_END[0] - 0.06, 0.24), P(COMB[0][0] + 0.10, 0.24)]
    return pts

def transform_none(*a, **k):
    return None

def beak_points(size, fill=0.76, fit_w=0.90, fat=1.0):
    scale, xf, yf = transform(size, fill, fit_w)
    pts = spline(beak_control(fat), 90)
    return [(xf(x), yf(y)) for (x, y) in pts]

def comb_points(size, fill=0.76, fit_w=0.90, fat=1.0):
    scale, xf, yf = transform(size, fill, fit_w)
    ctrl = comb_control(fat)
    head, tail = ctrl[:-2], ctrl[-2:]          # spikes splined; closing run kept straight
    pts = spline(head, 40) + tail
    return [(xf(x), yf(y)) for (x, y) in pts]

def motif_mask(size, fill=0.76, fit_w=0.90, fat=1.0):
    """ONE eye, set on the side of the head — a single round hole, not two forward dots"""
    W = size * SS
    scale, xf, yf = transform(size, fill, fit_w)
    m = Image.new("L", (W, W), 0)
    cx, cy = xf(X0 + EYE_CX_F * BW), yf(Y0 + EYE_CY_F * BH)
    r = EYE_R_F * BW * scale * fat
    ImageDraw.Draw(m).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    return m

def alpha(size, fill=0.76, fit_w=0.90, hole=True, fat=1.0):
    W = size * SS
    pts, *_ = shape_points(size, fill, fit_w)
    m = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(m)
    d.polygon(pts, fill=255)                                          # the traced head
    d.polygon(beak_points(size, fill, fit_w, fat), fill=255)          # + the beak
    d.polygon(comb_points(size, fill, fit_w, fat), fill=255)          # + the comb
    m = m.filter(ImageFilter.GaussianBlur(0.8 * SS))                  # soft ink edge
    if hole:
        m = ImageChops.subtract(m, motif_mask(size, fill, fit_w, fat))
    return m

def speckle(size, seed=11, count=1500, rmax=5):
    """aged-paper speckle: irregular flecks at a fine and a blotchy scale. The count follows
    the area, so a 16 px icon doesn't get the same 1.5k dots as a 1024 master."""
    rnd = random.Random(seed)
    count = max(1, int(count * (size / (1024 * SS)) ** 2))
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    for _ in range(count):
        x, y = rnd.uniform(-10, size + 10), rnd.uniform(-10, size + 10)
        r = rnd.uniform(0.4, rmax) if rnd.random() > 0.08 else rnd.uniform(rmax, rmax * 3.5)
        d.ellipse([x - r, y - r, x + r, y + r], fill=rnd.randint(22, 105))
    return m.filter(ImageFilter.GaussianBlur(0.5))

def foxed(img, size, seed, strength):
    sp = speckle(size, seed).convert(img.mode)
    return ImageChops.subtract(img, sp.point(lambda v: v // strength))

def render(size, bg, fg, fill=0.76, noise=8, transparent=False, foxing=True):
    W = size * SS
    fat = 1.0 if size >= 20 else 1.5          # optical fix below 20 px: fatter beak, eye, comb
    a = alpha(size, fill, fat=fat)
    ink = apply_grain(Image.new("RGB", (W, W), fg), noise + 6)
    if foxing:
        # pale flecks inside the ink — the reference's own noise is light specks on the shape
        ink = ImageChops.add(ink, speckle(W, 11).convert("RGB").point(lambda v: v // 4))
    if transparent:
        out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
        out.paste(ink, (0, 0), a)
    else:
        base = apply_grain(Image.new("RGB", (W, W), bg), noise)
        if foxing:
            base = foxed(base, W, 5, 3)          # dark foxing on the paper
        out = Image.composite(ink, base, a).convert("RGBA")
    return out.resize((size, size), Image.LANCZOS)

if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    variants = {
        "tile":   dict(bg=PAPER, fg=INK, transparent=False),
        "dark":   dict(bg=INK,   fg=PAPER, transparent=False),
        "ink":    dict(bg=None,  fg=INK, transparent=True),
        "paper":  dict(bg=None,  fg=PAPER, transparent=True),
    }
    for name, kw in variants.items():
        render(1024, **kw).save(out / f"profile-{name}-1024.png")
        for s in (512, 256, 180, 128, 64, 48, 32, 16):
            render(s, **kw).save(out / f"profile-{name}-{s}.png")
    print("wrote profile-{tile,dark,ink,paper} at 1024 + 512,256,180,128,64,48,32,16")
