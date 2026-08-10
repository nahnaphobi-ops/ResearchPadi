"""Clean hero cutout: remove studio green (incl. pockets), protect the subject."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src" / "assets" / "hero-grad.png"
OUT_OPAQUE = ROOT / "src" / "assets" / "hero-grad-clean.png"
OUT_TRANSPARENT = ROOT / "src" / "assets" / "hero-grad-transparent.png"

BG = (37, 99, 235, 255)
KEY = (197, 206, 189)


def near_key(r: int, g: int, b: int, threshold: float = 50.0) -> bool:
    d = ((r - KEY[0]) ** 2 + (g - KEY[1]) ** 2 + (b - KEY[2]) ** 2) ** 0.5
    greenish = g >= r - 14 and g >= b - 10 and g > 115
    return d <= threshold and greenish


def in_face_core(x: int, y: int, w: int, h: int) -> bool:
    """Tight ellipse over face/neck — never punch holes here."""
    cx, cy = w * 0.50, h * 0.36
    rx, ry = w * 0.18, h * 0.18
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0


def build_bg_mask(img: Image.Image) -> Image.Image:
    w, h = img.size
    px = img.load()
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    q: deque[tuple[int, int]] = deque()

    def paint(x: int, y: int) -> None:
        if mp[x, y]:
            return
        mp[x, y] = 255
        q.append((x, y))

    # 1) Edge flood fill through studio green
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, _ = px[x, y]
            if near_key(r, g, b, 60):
                paint(x, y)
    for y in range(h):
        for x in (0, w - 1):
            r, g, b, _ = px[x, y]
            if near_key(r, g, b, 60):
                paint(x, y)

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h or mp[nx, ny]:
                continue
            if in_face_core(nx, ny, w, h):
                continue
            r, g, b, _ = px[nx, ny]
            if near_key(r, g, b, 62):
                paint(nx, ny)

    # 2) Remove enclosed green pockets outside the face core
    #    (e.g. background trapped between hair curls / tassel)
    for y in range(h):
        for x in range(w):
            if mp[x, y] or in_face_core(x, y, w, h):
                continue
            r, g, b, _ = px[x, y]
            if near_key(r, g, b, 40):
                paint(x, y)

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h or mp[nx, ny]:
                continue
            if in_face_core(nx, ny, w, h):
                continue
            r, g, b, _ = px[nx, ny]
            if near_key(r, g, b, 48):
                paint(nx, ny)

    mask = mask.filter(ImageFilter.GaussianBlur(radius=1.0))
    return mask


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    w, h = src.size
    bg_mask = build_bg_mask(src)
    mp = bg_mask.load()
    sp = src.load()

    transparent = Image.new("RGBA", (w, h))
    tp = transparent.load()

    for y in range(h):
        for x in range(w):
            r, g, b, _ = sp[x, y]
            m = mp[x, y] / 255.0
            a = int(round(255 * (1.0 - m)))
            if a < 8:
                tp[x, y] = (0, 0, 0, 0)
            else:
                if a < 230 and g > r + 4 and g > b + 4:
                    g = int(r * 0.4 + b * 0.35 + g * 0.25)
                tp[x, y] = (r, g, b, a)

    opaque = Image.alpha_composite(Image.new("RGBA", (w, h), BG), transparent)
    opaque.save(OUT_OPAQUE, optimize=True)
    transparent.save(OUT_TRANSPARENT, optimize=True)

    face_blue = green_left = samples = 0
    op = opaque.load()
    for y in range(int(h * 0.18), int(h * 0.45), 2):
        for x in range(int(w * 0.35), int(w * 0.65), 2):
            r, g, b, _ = op[x, y]
            samples += 1
            if abs(r - 37) < 20 and abs(g - 99) < 30 and abs(b - 235) < 20:
                face_blue += 1
            if near_key(r, g, b, 35):
                green_left += 1

    # residual green anywhere
    residual = 0
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            r, g, b, _ = op[x, y]
            if near_key(r, g, b, 30):
                residual += 1

    print(f"Wrote {OUT_OPAQUE}")
    print(f"Wrote {OUT_TRANSPARENT}")
    print(f"Face brand-blue: {face_blue}/{samples}")
    print(f"Face residual green: {green_left}/{samples}")
    print(f"Global residual green samples: {residual}")


if __name__ == "__main__":
    main()
