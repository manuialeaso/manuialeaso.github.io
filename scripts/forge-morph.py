# -*- coding: utf-8 -*-
"""自製變身圖：以現有變身動畫為骨架，逐幀重新上色並加上配件（頭巾、披巾等），輸出成新的三方向變身資料夾。
用法：python3 scripts/forge-morph.py <配方名> [輸出根目錄]
已完成的資料夾會覆寫（可重跑）。"""
import sys, os, colorsys, shutil
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'morphanim')

def hsl(px):
    r, g, b, a = px
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return h * 360, s, l, a

def rgb(h, s, l, a):
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360, max(0, min(1, l)), max(0, min(1, s)))
    return (round(r * 255), round(g * 255), round(b * 255), a)

def bbox_top(im):
    w, h = im.size; px = im.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 40: return y
    return 0

def head_span(im, y, top):
    """頭部那一段：以頭頂 3 列的中心為準，只取跟它相連、左右各最多 4 格的不透明像素（避免連到舉起的手臂或武器）。"""
    w, _ = im.size; px = im.load()
    xs = [x for yy in range(top, min(top + 3, y + 1)) for x in range(w) if px[x, yy][3] > 40]
    if not xs: return None
    cx = round(sum(xs) / len(xs))
    if px[cx, y][3] <= 40: return None
    a = b = cx
    while a - 1 >= 0 and cx - (a - 1) <= 4 and px[a - 1, y][3] > 40: a -= 1
    while b + 1 < w and (b + 1) - cx <= 4 and px[b + 1, y][3] > 40: b += 1
    return (a, b)

# ── 配方 ──
def ninja(im, side, fi, act=''):
    """忍者：黑藍忍裝、裹布手臂、黑頭巾，紅色額帶與飄動的紅披巾。"""
    im = im.copy(); px = im.load(); w, h = im.size
    top = bbox_top(im); head_bottom = top + 9
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] < 10: continue
            H, S, L, A = hsl(p)
            if y <= head_bottom and L > 0.5:                      # 白髮 → 黑頭巾
                px[x, y] = rgb(230, 0.25, 0.10 + (L - 0.5) * 0.35, A)
            elif (H >= 320 or H < 12) and S > 0.25:               # 紅褲 → 深靛忍裝
                px[x, y] = rgb(228, 0.35, L * 0.55, A)
            elif 12 <= H < 50 and S > 0.15 and L > 0.25:          # 膚色手臂、皮件 → 裹布
                px[x, y] = rgb(220, 0.12, 0.12 + L * 0.35, A)
    if act == 'death': return im                              # 倒地時頭不在最上方，不畫配件
    # 額帶：頭部第 4 列
    band = top + 4
    sp = head_span(im, band, top)
    red, red_d = (196, 30, 45, 255), (128, 16, 30, 255)
    if sp:
        for x in range(sp[0], sp[1] + 1): px[x, band] = red
        # 披巾：從頭側往背後飄（side=-1 往左、+1 往右、0 往下），每 3 幀擺動一次
        sx = sp[0] if side < 0 else sp[1]
        wave = (fi // 3) % 2
        for i in range(1, 9):
            x = sx + side * i if side else (sp[0] + sp[1]) // 2 + (wave if i > 4 else 0)
            y = band + (i // 3 if side else i) + (wave if i > 5 and side else 0)
            for dy in (0, 1):
                if 0 <= x < w and 0 <= y + dy < h: px[x, y + dy] = red if dy == 0 else red_d
    return im

RECIPES = {
    '忍者': {'base': '黑暗妖精刺客', 'fn': ninja, 'side': {'': -1, '2': 1, 'F': 0}},
}

def forge(name, out_root=ROOT):
    rc = RECIPES[name]
    for sfx, side in rc['side'].items():
        src = os.path.join(ROOT, rc['base'] + sfx); dst = os.path.join(out_root, name + sfx)
        os.makedirs(dst, exist_ok=True)
        n = 0
        for f in sorted(os.listdir(src)):
            if not f.endswith('.png'): continue
            if '_s_' in f:                                       # 影子照抄
                shutil.copyfile(os.path.join(src, f), os.path.join(dst, f)); continue
            fi = int(f.rsplit('_', 1)[1].split('.')[0])
            im = Image.open(os.path.join(src, f)).convert('RGBA')
            rc['fn'](im, side, fi, f.rsplit('_', 1)[0]).save(os.path.join(dst, f), optimize=True); n += 1
        print(name + sfx, n, 'frames')

if __name__ == '__main__':
    forge(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else ROOT)
