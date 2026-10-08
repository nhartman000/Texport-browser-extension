"""Render the PNG icon set from the vector design in src/icons/icon.svg.
(The shapes are drawn with Pillow so no SVG renderer is needed.)   python3 tools/make_icons.py"""
import pathlib
from PIL import Image, ImageDraw

OUT = pathlib.Path(__file__).resolve().parents[1] / "src" / "icons"
for n in (16, 32, 48, 96, 128):
    S = 8
    k = n * S / 96                      # design grid is 96×96, see icon.svg
    im = Image.new("RGBA", (n * S, n * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    def R(x, y, w, h, r, c):
        d.rounded_rectangle([x * k, y * k, (x + w) * k, (y + h) * k], radius=r * k, fill=c)
    R(8, 8, 80, 80, 16, "#1f2937")
    R(22, 26, 52, 7, 3.5, "#9ca3af")
    R(22, 44, 52, 9, 3, "#f59e0b")
    R(22, 64, 38, 7, 3.5, "#9ca3af")
    d.polygon([(74 * k, 14 * k), (86 * k, 14 * k), (86 * k, 36 * k), (80 * k, 31 * k), (74 * k, 36 * k)], fill="#ef4444")
    im.resize((n, n), Image.LANCZOS).save(OUT / f"icon-{n}.png")
    print("wrote", OUT / f"icon-{n}.png")
