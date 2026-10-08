"""白い背景の人物写真から背景を抜いた PNG を作る（外周から白い領域を塗りつぶす方式）。
使い方: python tools/cutout.py 入力.png 出力.png
"""
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.int16)
h, w, _ = a.shape
# 背景候補：明るくて色味の少ない画素
bright = a.min(axis=2)
chroma = a.max(axis=2) - a.min(axis=2)
cand = (bright > 214) & (chroma < 22)

bg = np.zeros((h, w), bool)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if cand[y, x]:
            bg[y, x] = True
            q.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if cand[y, x] and not bg[y, x]:
            bg[y, x] = True
            q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True
            q.append((ny, nx))

alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8))
# 縁をなじませる（少し内側に縮めてからぼかす）
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.6))
out = im.copy()
out.putalpha(alpha)
out.save(dst)
print(f'saved {dst} ({w}x{h}), background {bg.mean() * 100:.1f}%')
