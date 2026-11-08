"""Export a generated plate PNG to full and 960 px WebP, and print sizes.

Usage: python -I export-plate.py <source.png> <out_dir> <name>
  writes <out_dir>/<name>.webp and <out_dir>/<name>-960.webp (quality 80, method 6)
"""
import os
import sys

from PIL import Image

if len(sys.argv) != 4:
    sys.exit(__doc__)
src, out_dir, name = sys.argv[1:]
img = Image.open(src).convert("RGB")
w, h = img.size
targets = [(f"{name}.webp", img), (f"{name}-960.webp", img.resize((960, round(h * 960 / w)), Image.LANCZOS))]
for fname, im in targets:
    path = os.path.join(out_dir, fname)
    im.save(path, "WEBP", quality=80, method=6)
    print(f"{path}  {im.size[0]}x{im.size[1]}  {os.path.getsize(path) // 1024} KB")
