# -*- coding: utf-8 -*-
"""
新套裝部件圖示產生器（afk-sets.js 用）——用專案既有圖示改色，不抓外部圖片。
可重跑：已存在的輸出會跳過（加 --force 重做）；日誌寫到 logs/gen-set-icons.log。
用法：python3 scripts/gen-set-icons.py [--force]
"""
import colorsys, os, sys, datetime
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'assets', 'icons')
FORCE = '--force' in sys.argv
LOG = os.path.join(ROOT, 'logs', 'gen-set-icons.log')
os.makedirs(os.path.dirname(LOG), exist_ok=True)

# (輸出資料夾, 新名稱, 來源資料夾, 來源名稱, 目標色相°（整張染成這個色相）, 飽和倍率, 亮度倍率)
JOBS = [
    # 反王（王族·金紅）← 死亡騎士
    ('armors', '反王頭盔', 'armors', '死亡騎士頭盔', 45, 1.3, 1.15),
    ('armors', '反王盔甲', 'armors', '死亡騎士盔甲', 45, 1.3, 1.15),
    ('armors', '反王手套', 'armors', '死亡騎士手套', 45, 1.3, 1.15),
    ('armors', '反王長靴', 'armors', '死亡騎士長靴', 45, 1.3, 1.15),
    # 賽尼斯（法師·紫）← 法師套裝
    ('armors', '賽尼斯頭箍', 'armors', '法師之帽', 270, 1.4, 1.05),
    ('armors', '賽尼斯斗篷', 'armors', '法師長袍', 270, 1.4, 1.05),
    ('armors', '賽尼斯手套', 'armors', '鋼鐵手套', 270, 1.6, 1.0),
    ('armors', '賽尼斯長靴', 'armors', '皮長靴', 270, 1.6, 1.0),
    # 火焰之影（橘紅）← 混沌／死亡
    ('armors', '火焰之影襯衫', 'armors', '皮背心', 15, 1.8, 1.1),
    ('armors', '火焰之影頭盔', 'armors', '混沌頭盔', 15, 1.8, 1.1),
    ('armors', '火焰之影盔甲', 'armors', '死亡盔甲', 15, 1.8, 1.1),
    ('armors', '火焰之影斗篷', 'armors', '死亡斗篷', 15, 1.8, 1.1),
    ('armors', '火焰之影長靴', 'armors', '鋼鐵長靴', 15, 1.8, 1.1),
    ('armors', '火焰之影手套', 'armors', '混沌手套', 15, 1.8, 1.1),
    ('accessories', '火焰之影戒指', 'accessories', '力量戒指', 15, 1.8, 1.1),
    ('accessories', '火焰之影項鍊', 'accessories', '力量項鍊', 15, 1.8, 1.1),
    # 泡水（水藍）
    ('armors', '泡水的頭具', 'armors', '鋼鐵頭盔', 200, 1.5, 1.05),
    ('armors', '泡水的斗篷', 'armors', '歐西斯斗篷', 200, 1.5, 1.05),
    ('armors', '泡水的盔甲', 'armors', '鋼鐵金屬盔甲', 200, 1.5, 1.05),
    ('armors', '泡水的手套', 'armors', '鋼鐵手套', 200, 1.5, 1.05),
    ('armors', '泡水的靴子', 'armors', '鋼鐵長靴', 200, 1.5, 1.05),
    ('armors', '泡水的帽子', 'armors', '皮帽子', 200, 1.5, 1.05),
    ('armors', '泡水的頭巾', 'armors', '銀釘皮帽', 200, 1.5, 1.05),
    # 暴走的變異（毒綠）← 惡魔
    ('armors', '暴走的變異披風', 'armors', '死亡斗篷', 110, 1.5, 1.0),
    ('armors', '暴走的變異頭盔', 'armors', '惡魔頭盔', 110, 1.5, 1.0),
    ('armors', '暴走的變異手套', 'armors', '惡魔手套', 110, 1.5, 1.0),
    ('armors', '暴走的變異盔甲', 'armors', '惡魔盔甲', 110, 1.5, 1.0),
    ('armors', '暴走的變異長靴', 'armors', '惡魔長靴', 110, 1.5, 1.0),
    # 屍魂（灰紫）← 骷髏
    ('armors', '屍魂頭盔', 'armors', '骷髏頭盔', 250, 0.9, 0.85),
    ('armors', '屍魂手套', 'armors', '死亡手套', 250, 0.9, 0.85),
    ('armors', '屍魂靴子', 'armors', '鋼鐵長靴', 250, 0.9, 0.85),
    ('armors', '屍魂盔甲', 'armors', '骷髏盔甲', 250, 0.9, 0.85),
    ('armors', '屍魂披風', 'armors', '死亡斗篷', 250, 0.9, 0.85),
    # 營養滿分（金）← 守護飾品
    ('accessories', '營養滿分金戒指', 'accessories', '力量戒指', 45, 1.6, 1.25),
    ('accessories', '營養滿分金項鍊', 'accessories', '守護項鍊', 45, 1.6, 1.25),
    ('accessories', '營養滿分金腰帶', 'accessories', '守護皮帶', 45, 1.6, 1.25),
    # 懷念的（舊照片褐）← 原版
    ('armors', '懷念的骷髏頭盔', 'armors', '骷髏頭盔', 30, 0.5, 1.0),
    ('armors', '懷念的骷髏盔甲', 'armors', '骷髏盔甲', 30, 0.5, 1.0),
    ('armors', '懷念的骷髏盾牌', 'armors', '骷髏盾牌', 30, 0.5, 1.0),
    ('armors', '懷念的侏儒鐵盔', 'armors', '侏儒鐵盔', 30, 0.5, 1.0),
    ('armors', '懷念的侏儒斗篷', 'armors', '侏儒斗篷', 30, 0.5, 1.0),
    ('armors', '懷念的侏儒圓盾', 'armors', '侏儒圓盾', 30, 0.5, 1.0),
    ('armors', '懷念的歐西斯頭盔', 'armors', '歐西斯頭盔', 30, 0.5, 1.0),
    ('armors', '懷念的歐西斯環甲', 'armors', '歐西斯環甲', 30, 0.5, 1.0),
    ('armors', '懷念的歐西斯斗篷', 'armors', '歐西斯斗篷', 30, 0.5, 1.0),
    ('armors', '懷念的阿克海盾牌', 'armors', '鋼鐵盾牌', 30, 0.5, 1.0),
    # 火焰之影素材（橘紅）← 既有首級／骨頭
    ('items', '火焰之影首級', 'items', '混沌首級', 15, 1.8, 1.1),
    ('items', '火焰之影肋骨', 'items', '不死族的骨頭', 15, 1.8, 1.1),
    ('items', '火焰之影脊椎', 'items', '安塔瑞斯之骨', 15, 1.8, 1.1),
    ('items', '火焰之影骨翼', 'items', '巴拉卡斯之骨', 15, 1.8, 1.1),
    ('items', '火焰之影指甲', 'items', '林德拜爾之骨', 15, 1.8, 1.1),
    ('items', '火焰之影尾巴', 'items', '法利昂之骨', 15, 1.8, 1.1),
]

def shift(img, deg, sat, val):
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    d = deg / 360.0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hh = d
            s = min(1.0, s * sat if s > 0.05 else s + (0.25 * (sat - 1) if sat > 1 else 0))
            v = min(1.0, v * val)
            r2, g2, b2 = colorsys.hsv_to_rgb(hh, s, v)
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return img

def main():
    made = skipped = missing = 0
    with open(LOG, 'a', encoding='utf-8-sig') as log:
        log.write('\n== %s ==\n' % datetime.datetime.now().isoformat(timespec='seconds'))
        for out_dir, name, src_dir, src, deg, sat, val in JOBS:
            dst = os.path.join(A, out_dir, name + '.png')
            srcp = os.path.join(A, src_dir, src + '.png')
            if os.path.exists(dst) and not FORCE:
                skipped += 1; log.write('skip  %s\n' % dst); continue
            if not os.path.exists(srcp):
                missing += 1; log.write('MISS  %s（來源 %s 不存在）\n' % (name, srcp)); print('來源不存在：', srcp); continue
            shift(Image.open(srcp), deg, sat, val).save(dst)
            made += 1; log.write('made  %s ← %s\n' % (dst, srcp))
        log.write('made=%d skipped=%d missing=%d\n' % (made, skipped, missing))
    print('完成：新產生 %d、略過 %d、來源缺 %d（日誌 %s）' % (made, skipped, missing, LOG))

if __name__ == '__main__':
    main()
