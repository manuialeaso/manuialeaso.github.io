# -*- coding: utf-8 -*-
"""
build-load-4pages.py — 選角畫面底圖：把「1 2」兩顆頁碼圈擴成「1 2 3 4」四顆（腳本產生，可重跑）

來源：public/assets/login/load.png（640×480，原版美術）
輸出：public/assets/login/load-4p.png（原檔不動）
      .scratch/load-4p-compare.png（原圖與新圖並排放大，人工檢查用）

幾何（實測原圖像素）：兩顆圈中心 x=307、340（間距 33）、y=287；整組裝飾 = 左箭頭＋圈1＋接頭＋圈2＋右箭頭。
四顆圈保持同一個中點 323.5 → 圈心 274、307、340、373：原本兩顆圈「位置不變」，只在兩側各補一顆，
左右箭頭各往外移 33px。重複單位 B = x 307..340（圈右半＋接頭＋下一圈左半），直接複製原圖像素，
不重畫任何裝飾。

數字：先把原圖兩顆圈裡的「1」「2」以周圍紋理補掉（OpenCV inpaint），再貼回：
  圈①＝原圖的「1」字形、圈②＝原圖的「2」字形（原汁原味的像素），圈③④＝以相近的斜體襯線字
  依原字形的大小／顏色／暗邊重新產生。
可重跑：輸出存在且來源與本腳本都沒變就跳過（--force 強制重建）。建置日誌：.scratch/build-load-4pages.log
"""
import hashlib, json, os, sys, time
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public/assets/login/load.png')
OUT = os.path.join(ROOT, 'public/assets/login/load-4p.png')
SCRATCH = os.path.join(ROOT, '.scratch'); os.makedirs(SCRATCH, exist_ok=True)
LOG = os.path.join(SCRATCH, 'build-load-4pages.log')
STAMP = os.path.join(SCRATCH, 'load-4p.build.json')   # 建置標記放 .scratch（不進網站）
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerifCondensed-Italic.ttf'   # 一般字重：原圖的 1、2 筆畫偏細

def log(msg):
    line = time.strftime('%Y-%m-%d %H:%M:%S ') + msg
    print(line)
    with open(LOG, 'a', encoding='utf-8-sig' if not os.path.exists(LOG) else 'utf-8') as f: f.write(line + '\n')

def sha(path):
    return hashlib.sha1(open(path, 'rb').read()).hexdigest()[:12]

C1, C2, CY, STEP = 307, 340, 287, 33          # 原圖兩顆圈的圈心與間距
DIGIT_R = 9                                    # 數字所在的圈內半徑（不含金屬外框）

def digit_mask(img, cx, cy):
    """圈內比背景亮的像素＝數字（雕刻字比深色圈底亮）"""
    g = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.int32)
    yy, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]]
    inside = (xx - cx) ** 2 + (yy - cy) ** 2 <= DIGIT_R ** 2
    base = np.median(g[inside])
    m = inside & (g > base + 22)
    m = cv2.dilate(m.astype(np.uint8), np.ones((2, 2), np.uint8)) > 0
    return m & inside

def main():
    force = '--force' in sys.argv
    key = {'src': sha(SRC), 'script': sha(__file__)}
    if not force and os.path.exists(OUT) and os.path.exists(STAMP):
        try:
            if json.load(open(STAMP)) == key:
                log('跳過：load-4p.png 已是最新（來源與腳本皆未變）'); return
        except Exception: pass
    log('開始建置 load-4p.png')
    orig = np.array(Image.open(SRC).convert('RGB'))

    # 1) 取出原本的「1」「2」字形（含像素與遮罩），再把兩顆圈的字補掉
    glyphs = {}
    clean = orig.copy()
    for d, cx in (('1', C1), ('2', C2)):
        m = digit_mask(orig, cx, CY)
        ys, xs = np.nonzero(m)
        glyphs[d] = {'mask': m, 'dx': xs - cx, 'dy': ys - CY, 'px': orig[ys, xs].copy()}
        clean = cv2.inpaint(clean, (m * 255).astype(np.uint8), 3, cv2.INPAINT_TELEA)
        log(f'字形「{d}」：{len(xs)} 像素，平均色 {orig[ys, xs].mean(axis=0).round(0).tolist()}')

    # 2) 重組裝飾：左右各外移一個 STEP，中間補兩個重複單位 B
    out = clean.copy()
    lum = cv2.cvtColor(clean, cv2.COLOR_RGB2GRAY)
    def paste(x0, x1, y0, y1, dx, solid_to=301):   # 把 clean 的 [x0,x1)×[y0,y1) 平移 dx 貼到 out
        ys = min(y1, solid_to)
        out[y0:ys, x0 + dx:x1 + dx] = clean[y0:ys, x0:x1]                 # 上半：整塊複製
        if y1 > ys:                                                       # 底部幾列：只複製夠亮的花飾像素
            src = clean[ys:y1, x0:x1]; m = lum[ys:y1, x0:x1] > 70
            dst = out[ys:y1, x0 + dx:x1 + dx]; dst[m] = src[m]
    # 先貼外側（箭頭），再貼圈，讓圈蓋在箭頭尾端上（與原圖疊放順序相同）
    paste(245, 292, 270, 301, -STEP)          # 左箭頭＋花飾  → 212..259
    paste(355, 401, 270, 301, +STEP)          # 右箭頭＋花飾  → 388..434
    paste(292, 307, 268, 308, -STEP)          # 最左圈的左半  → 259..274
    paste(C1, C2, 268, 308, -STEP)            # 單位 B → 274..307（新圈①右半＋接頭＋圈②左半）
    paste(C1, C2, 268, 308, 0)                # 單位 B 原位（圈②右半＋接頭＋圈③左半）
    paste(C1, C2, 268, 308, +STEP)            # 單位 B → 340..373
    paste(340, 355, 268, 308, +STEP)          # 最右圈的右半  → 373..388

    # 3) 寫回數字：①② 用原字形像素，③④ 依原字形風格產生
    centers = [C1 - STEP, C1, C2, C2 + STEP]
    def put_glyph(g, cx):
        out[CY + g['dy'], cx + g['dx']] = g['px']
    put_glyph(glyphs['1'], centers[0])
    put_glyph(glyphs['2'], centers[1])
    ref = glyphs['2']
    h = int(ref['dy'].max() - ref['dy'].min() + 1)
    col = ref['px'].astype(np.float32)
    hi = np.percentile(col, 92, axis=0); lo = np.percentile(col, 30, axis=0)
    base_bg = clean[CY - 3:CY + 4, C2 - 3:C2 + 4].reshape(-1, 3).mean(axis=0)
    for d, cx in (('3', centers[2]), ('4', centers[3])):
        S = 8                                                    # 超取樣後縮小，邊緣才會柔順
        font = ImageFont.truetype(FONT, int(h * S * 1.36))
        canvas = Image.new('L', (h * S * 3, h * S * 3), 0)
        ImageDraw.Draw(canvas).text((h * S, h * S * 0.6), d, font=font, fill=255)
        canvas = canvas.filter(ImageFilter.MaxFilter(5))                    # 筆畫略加粗（約 0.3px），貼近原字的雕刻線寬
        bb = canvas.getbbox(); canvas = canvas.crop(bb)
        tw = max(1, round(canvas.width / canvas.height * h))
        a = np.array(canvas.resize((tw, h), Image.LANCZOS)).astype(np.float32) / 255.0
        # 雕刻感：上亮下暗的漸層＋外側一圈淡暗邊
        grad = np.linspace(1.0, 0.0, h)[:, None]
        color = lo[None, None, :] + (hi - lo)[None, None, :] * grad[..., None]
        shadow = np.array(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))).astype(np.float32) / 255.0
        y0 = int(CY + ref['dy'].min()); x0 = int(cx - tw // 2 + 1)
        region = out[y0:y0 + h, x0:x0 + tw].astype(np.float32)
        region = region * (1 - shadow[..., None] * 0.25)                       # 暗邊
        region = region * (1 - a[..., None]) + color * a[..., None]             # 字身
        out[y0:y0 + h, x0:x0 + tw] = np.clip(region, 0, 255).astype(np.uint8)
        log(f'產生字形「{d}」：{tw}×{h}px @ 圈心 x={cx}')

    Image.fromarray(out).save(OUT, optimize=True)
    json.dump(key, open(STAMP, 'w'))
    # 4) 並排對照圖（放大 5 倍）
    crop = lambda a: Image.fromarray(a[262:316, 200:446]).resize((246 * 5, 54 * 5), Image.NEAREST)
    cmp_ = Image.new('RGB', (246 * 5, 54 * 5 * 2 + 10), (60, 0, 0))
    cmp_.paste(crop(orig), (0, 0)); cmp_.paste(crop(out), (0, 54 * 5 + 10))
    cmp_.save(os.path.join(SCRATCH, 'load-4p-compare.png'))
    log(f'完成：{os.path.relpath(OUT, ROOT)}（{os.path.getsize(OUT)//1024} KB），對照圖 .scratch/load-4p-compare.png')

if __name__ == '__main__':
    main()
