#!/usr/bin/env python3
"""Whole-subject binary mask via rembg. white(255)=subject, black(0)=background.
Mirrors deck-imagery/create-mask.py. Usage: python mask.py <in.png> <out.png>"""
import sys
from rembg import remove
from PIL import Image

inp, outp = sys.argv[1], sys.argv[2]
img = Image.open(inp).convert("RGBA")
res = remove(img)
alpha = res.split()[3]
mask = alpha.point(lambda p: 255 if p > 128 else 0).convert("L")
mask.save(outp)
print(f"mask saved {outp} {mask.size}")
