# -*- coding: utf-8 -*-
"""自製變身圖（玩家 2026-10-24：沒有專屬圖的變身、以及神話／天上／時空／聖衣卡，全部做出自己的模樣）

做法：拿相近的三方向變身動畫當骨架，逐幀重新上色（依色相／飽和／亮度分區換色），再加配件或階級光效，
輸出成新的三方向資料夾 assets/morphanim/<名稱>{,2,F}。影子照抄。可重跑（直接覆寫）。

用法：
  python3 scripts/forge-morph.py all            # 全部：先做基礎形態，再做卡片的階級版本，最後產生 afk-forged-sprites.js
  python3 scripts/forge-morph.py base 忍者      # 只做指定的基礎形態
  python3 scripts/forge-morph.py card 天上・天影忍神
"""
import sys, os, json, colorsys, shutil, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.dirname(HERE)
ROOT = os.path.join(WORK, 'assets', 'morphanim')
DIRS = ['', '2', 'F']
SIDE = {'': -1, '2': 1, 'F': 0}          # 背後方向：資料夾「」朝右上→背在左；「2」朝左上→背在右；「F」背對鏡頭

# ───────────────────────── 色彩工具 ─────────────────────────
def to_hsl(p):
    r, g, b, a = p
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return h * 360, s, l, a

def from_hsl(h, s, l, a):
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360, max(0, min(1, l)), max(0, min(1, s)))
    return (round(r * 255), round(g * 255), round(b * 255), a)

def in_hue(h, rng):
    lo, hi = rng
    return (lo <= h <= hi) if lo <= hi else (h >= lo or h <= hi)

def remap(im, rules):
    """rules：[{h:(lo,hi)|None, s:(lo,hi), l:(lo,hi), to:(H, S, Lmul, Ladd)}]，第一條符合的生效；H/S 為 None 表示保留。"""
    px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] < 10: continue
            H, S, L, A = to_hsl(p)
            for r in rules:
                if r.get('h') and not in_hue(H, r['h']): continue
                if 's' in r and not (r['s'][0] <= S <= r['s'][1]): continue
                if 'l' in r and not (r['l'][0] <= L <= r['l'][1]): continue
                th, ts, lm, la = r['to']
                px[x, y] = from_hsl(H if th is None else th, S if ts is None else ts, L * lm + la, A)
                break
    return im

def outline_pts(im):
    px = im.load(); w, h = im.size; out = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 40: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h or px[nx, ny][3] < 40: out.append((x, y)); break
    return out

def top_row(im):
    px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 40: return y
    return 0

def head_center(im, top):
    px = im.load(); w, h = im.size
    xs = [x for yy in range(top, min(h, top + 3)) for x in range(w) if px[x, yy][3] > 40]
    return round(sum(xs) / len(xs)) if xs else w // 2

def head_span(im, y, top):
    """頭部那一段：以頭頂 3 列的中心為準，只取跟它相連、左右各最多 4 格的不透明像素（避免連到舉起的手臂或武器）。"""
    w, h = im.size; px = im.load()
    cx = head_center(im, top)
    if not (0 <= cx < w and 0 <= y < h) or px[cx, y][3] <= 40: return None
    a = b = cx
    while a - 1 >= 0 and cx - (a - 1) <= 4 and px[a - 1, y][3] > 40: a -= 1
    while b + 1 < w and (b + 1) - cx <= 4 and px[b + 1, y][3] > 40: b += 1
    return (a, b)

def put(im, x, y, c):
    w, h = im.size
    if 0 <= x < w and 0 <= y < h: im.load()[x, y] = c

# ───────────────────────── 配件與光效 ─────────────────────────
def headband_scarf(im, side, fi, act, red=(196, 30, 45, 255), red_d=(128, 16, 30, 255)):
    if act.startswith('death'): return
    top = top_row(im); band = top + 4
    sp = head_span(im, band, top)
    if not sp: return
    for x in range(sp[0], sp[1] + 1): put(im, x, band, red)
    sx = sp[0] if side < 0 else sp[1]; wave = (fi // 3) % 2
    for i in range(1, 9):
        x = sx + side * i if side else (sp[0] + sp[1]) // 2 + (wave if i > 4 else 0)
        y = band + (i // 3 if side else i) + (wave if i > 5 and side else 0)
        put(im, x, y, red); put(im, x, y + 1, red_d)

def halo(im, act, color=(255, 240, 184, 255), glow=(255, 214, 120, 160)):
    if act.startswith('death'): return
    top = top_row(im); cx = head_center(im, top); y = top - 4
    for dx in range(-4, 5):
        dy = 0 if abs(dx) < 3 else (1 if abs(dx) == 3 else 2)
        put(im, cx + dx, y + dy, color)
        if abs(dx) < 4: put(im, cx + dx, y - 1 + (0 if abs(dx) < 3 else 1), glow)

def stars(im, fi, color, n=4):
    """時空：身邊幾顆閃爍的星點（位置依幀固定、每 2 幀換一組）。"""
    bb = im.getbbox()
    if not bb: return
    x0, y0, x1, y1 = bb; seed = (fi // 2) * 7919 + 17
    for k in range(n):
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        x = x0 - 4 + seed % max(1, (x1 - x0 + 8)); seed = (seed * 1103515245 + 12345) & 0x7fffffff
        y = y0 + seed % max(1, (y1 - y0))
        dim = color[:3] + (150,)
        put(im, x, y, color); put(im, x + 1, y, dim); put(im, x - 1, y, dim); put(im, x, y - 1, dim); put(im, x, y + 1, dim)

# ───────────────────────── 基礎形態配方 ─────────────────────────
G = (0, 0.25)          # 低飽和（灰、白、黑）
def R(h=None, s=(0, 1), l=(0, 1), to=(None, None, 1, 0)): return {'h': h, 's': s, 'l': l, 'to': to}

def ninja_fn(im, side, fi, act):
    top = top_row(im); px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] < 10: continue
            H, S, L, A = to_hsl(p)
            if y <= top + 9 and L > 0.5 and not act.startswith('death'): px[x, y] = from_hsl(230, 0.25, 0.10 + (L - 0.5) * 0.35, A)
            elif (H >= 320 or H < 12) and S > 0.25: px[x, y] = from_hsl(228, 0.35, L * 0.55, A)
            elif 12 <= H < 50 and S > 0.15 and L > 0.25: px[x, y] = from_hsl(220, 0.12, 0.12 + L * 0.35, A)
    headband_scarf(im, side, fi, act)
    return im

def DK(hue, sat, metal):   # 死亡騎士四色：烈焰的橘色火焰換色、銀甲換金屬色
    return [R(h=(5, 55), s=(0.3, 1), to=(hue, sat, 1.0, 0)), R(s=G, to=metal)]

BASES = {
    '忍者':   {'base': '黑暗妖精刺客', 'fn': ninja_fn, 'note': '深靛忍裝、黑頭巾、紅額帶與披巾'},
    '侍':     {'base': '黑暗騎士', 'rules': [R(s=G, l=(0.04, 0.42), to=(356, 0.62, 1.25, 0.02)), R(s=G, l=(0.42, 0.72), to=(40, 0.35, 0.9, 0))], 'note': '朱漆鎧甲、古金飾邊'},
    '大名':   {'base': '騎士范德', 'rules': [R(h=(20, 65), s=(0.15, 1), l=(0, 0.45), to=(230, 0.22, 0.55, 0.02)), R(h=(20, 65), s=(0.15, 1), l=(0.45, 1), to=(46, 0.75, 1, 0)), R(s=G, to=(352, 0.55, 1, 0))], 'note': '黑漆大鎧、金色前立、紅色綁繩'},
    '姬武者': {'base': '艾莉絲', 'rules': [R(h=(30, 70), s=(0.25, 1), l=(0.3, 1), to=(230, 0.2, 0.25, 0.08)), R(s=(0, 0.45), l=(0, 0.3), to=(352, 0.68, 1.7, 0.08))], 'note': '黑髮、緋紅巫女裝'},
    '陰陽師': {'base': '西瑪', 'rules': [R(s=(0, 0.35), l=(0, 0.32), to=(45, 0.12, 1.25, 0.55)), R(h=(20, 75), s=(0.1, 1), l=(0.4, 1), to=(275, 0.5, 0.75, 0))], 'note': '白色狩衣、紫色袴'},
    '格利特': {'base': '白金騎士', 'rules': [R(s=(0, 0.35), l=(0, 0.32), to=(222, 0.45, 1.4, 0.06))], 'note': '藏青鎧甲、金色飾邊'},
    '伊詩蒂': {'base': '賽尼斯', 'rules': [R(s=G, l=(0.08, 0.85), to=(285, 0.42, 1, 0))], 'note': '紫色星術袍'},
    '特羅斯': {'base': '克特', 'rules': [R(h=(25, 65), s=(0.2, 1), to=(222, 0.65, 0.95, 0)), R(s=G, l=(0.25, 0.6), to=(220, 0.25, 1, 0))], 'note': '白甲、王家藍飾'},
    '喬':     {'base': '馬庫爾', 'rules': [R(s=(0, 0.4), l=(0, 0.3), to=(140, 0.38, 1.6, 0.04)), R(h=(180, 260), s=(0.1, 1), to=(46, 0.6, 1, 0))], 'note': '墨綠法袍、金邊'},
    '拉曼斯': {'base': '長老', 'rules': [R(h=(10, 65), s=(0.2, 1), to=(355, 0.6, 0.9, 0))], 'note': '緋紅長老袍'},
    '安迪斯': {'base': '黑暗巡守', 'rules': [R(s=G, l=(0.05, 0.75), to=(105, 0.35, 1.15, 0.02))], 'note': '林綠獵裝'},
    '艾迪爾': {'base': '黑長者', 'rules': [R(s=(0, 0.4), l=(0, 0.3), to=(210, 0.45, 1.5, 0.05)), R(h=(60, 180), s=(0.08, 1), to=(200, 0.1, 1.3, 0.1))], 'note': '冰藍長袍'},
    '亞克騎士': {'base': '黑騎士', 'rules': [R(s=G, l=(0, 0.5), to=(26, 0.55, 1.6, 0.08))], 'note': '青銅重甲'},
    '墮落的司祭': {'base': '卡士柏', 'rules': [R(s=(0, 0.4), l=(0, 0.3), to=(290, 0.35, 1.3, 0.03)), R(h=(300, 30), s=(0.1, 1), to=(95, 0.5, 1, 0))], 'note': '紫黑法衣、腐綠下襬'},
    '歐姆裝甲兵': {'base': '重裝歐姆', 'rules': [R(s=G, to=(18, 0.45, 1.1, 0.02))], 'note': '鏽色裝甲'},
    '生日慶祝妖精(近攻型)': {'base': '黃金騎士', 'rules': [R(h=(20, 70), s=(0.2, 1), to=(330, 0.65, 1.05, 0.03)), R(s=G, l=(0, 0.4), to=(175, 0.45, 1.6, 0.06))], 'note': '粉紅與湖綠的慶典鎧'},
    '生日慶祝妖精(遠攻型)': {'base': '黃金巡守', 'rules': [R(h=(15, 70), s=(0.12, 1), to=(175, 0.5, 1.05, 0)), R(s=G, l=(0, 0.4), to=(330, 0.55, 1.5, 0.06))], 'note': '湖綠獵裝、粉紅飾帶'},
    '生日慶祝妖精(魔法型)': {'base': '黃金法師', 'rules': [R(h=(15, 75), s=(0.08, 1), to=(325, 0.5, 1, 0)), R(s=G, l=(0, 0.35), to=(270, 0.45, 1.5, 0.05))], 'note': '粉紅慶典法袍'},
    '闇黑死亡騎士': {'base': '烈焰的死亡騎士', 'rules': DK(275, 0.75, (260, 0.15, 0.45, 0)), 'note': '紫焰、黑鐵'},
    '雷霆死亡騎士': {'base': '烈焰的死亡騎士', 'rules': DK(195, 0.9, (210, 0.25, 1, 0)), 'note': '青色雷光、鋼藍甲'},
    '黃金死亡騎士': {'base': '烈焰的死亡騎士', 'rules': DK(47, 0.85, (45, 0.5, 1, 0)), 'note': '金焰、金甲'},
    '焚焰死亡騎士': {'base': '烈焰的死亡騎士', 'rules': DK(355, 0.85, (0, 0.2, 0.6, 0)), 'note': '赤焰、焦黑甲'},
    '絲莉安': {'base': '莉絲安', 'rules': [R(h=(250, 345), s=(0.12, 1), to=(200, None, 1, 0))], 'note': '天藍禮裙'},
}

# ───────────────────────── 原作怪物圖匯入 ─────────────────────────
# 玩家 2026-10-24：「只是色違版本，沒有特色」→ 改用遊戲裡現成、但還沒當過變身的原作怪物／NPC 動畫（assets/anim）。
#   怪物圖只有一個方向（面向畫面左下）：資料夾「2」放原圖，「」「F」左右翻轉成面向右方（玩家在左、怪在右）。
#   武器揮動層（_w）是疊加發光特效，不併入本體；太高的（頭目）等比縮到 120px 以內。
ANIM = os.path.join(WORK, 'assets', 'anim')
IMPORT = {
    '忍者': '魔族暗殺團', '侍': '天狗', '大名': '艾爾摩將軍', '姬武者': '朱利安', '陰陽師': '白面金毛九尾狐・玉藻',
    '格利特': '闇影格立特', '伊詩蒂': '依詩蒂', '特羅斯': '特羅斯王子', '喬': '喬',
    '拉曼斯': '長老．拉曼斯', '安迪斯': '長老．安迪斯', '艾迪爾': '長老．艾迪爾',
    '亞克騎士': '魂騎士', '墮落的司祭': '墮落的司祭(一階)', '歐姆裝甲兵': '歐姆裝甲兵',
    '生日慶祝妖精(近攻型)': '月之精靈歐薇', '生日慶祝妖精(遠攻型)': '歐薇', '生日慶祝妖精(魔法型)': '風精靈王',
    '闇黑死亡騎士': '暗黑黑騎士', '雷霆死亡騎士': '拉斯塔巴德近衛隊隊長', '黃金死亡騎士': '闇黑的騎士范德', '焚焰死亡騎士': '血騎士',
    '絲莉安': '冷酷的艾莉絲',
}
CARD_IMPORT = {
    # 天上
    '天上・曙光聖騎': '底比斯 賀洛斯', '天上・月羽神弓': '月光朱利安', '天上・熾光聖賢': '長老．泰瑪斯', '天上・天穹劍聖': '黑暗復仇者',
    '天上・雷霆天將': '黑暗精靈使', '天上・金輝守護': '底比斯 阿努比斯', '天上・焚天戰神': '火焰之影親衛隊(巴風特)', '天上・夜幕天刃': '黑暗棲林者',
    '天上・天律裁決': '黑暗妖精將軍', '天上・星海魔導': '暗黑思克巴女皇', '天上・雲端劍豪': '卡瑞', '天上・天羽獵星': '黑暗妖精殘兵(弓)',
    '天上・天影忍神': '黑暗妖精盜賊', '天上・天命陰陽': '長老．琪娜', '天上・曦光射手': '黑暗妖精巡守', '天上・天籟法師': '長老．巴洛斯',
    '天上・天雷武士': '黑騎士搜索隊', '天上・天威大名': '受詛咒的艾爾摩將軍', '天上・天弓姬武': '暗黑火焰弓箭手', '天上・蒼穹拳聖': '長老．巴陸德',
    '天上・天狼王': '暗黑萊肯',
    # 時空
    '時空・永劫騎士': '闇黑君王', '時空・裂星獵手': '法令軍王蕾雅', '時空・萬象先知': '冥法軍王海露拜', '時空・虛空劍帝': '暗殺軍王史雷佛',
    '時空・逆時雷霆': '深淵之主', '時空・終焉守門': '特提斯', '時空・時砂暴君': '伊弗利特', '時空・輪迴劍鬼': '死神',
    '時空・次元裁判': '西斯', '時空・混沌魔尊': '混沌', '時空・時空劍豪': '邪惡的鐮刀死神', '時空・星界弓神': '冰之女王',
    '時空・永夜忍皇': '哈汀之影', '時空・時之巫女': '魔女賽尼斯',
    # 聖衣：背後會展開星座翼，一律挑人形、本身沒有翅膀的（玩家 2026-10-24）
    '白羊座聖衣': '長老．巴塔斯', '金牛座聖衣': '鋼鐵阿頓', '雙子座聖衣': '喚獸師', '巨蟹座聖衣': '夢幻之島鎧甲守衛',
    '獅子座聖衣': '魔獸軍王巴蘭卡', '處女座聖衣': '依詩蒂公主', '天秤座聖衣': '血色術士', '天蠍座聖衣': '黑暗妖精殘兵(雙手劍)',
    '射手座聖衣': '黑暗妖精警衛(十字弓)', '摩羯座聖衣': '巴風特', '水瓶座聖衣': '長老隨從', '雙魚座聖衣': '黑暗妖精魔法學徒',
}
MAX_H = 120

def import_anim(name, src_name, fn=None):
    src = os.path.join(ANIM, src_name)
    if not os.path.isdir(src): raise SystemExit('找不到原作動畫：' + src)
    files = [f for f in os.listdir(src) if f.endswith('.png')]
    body = sorted(f for f in files if not frame_info(f)[0].endswith(('_s', '_w')) and 'effect' not in f)
    hs = [Image.open(os.path.join(src, f)).getbbox() for f in body if f.startswith('idle_')]
    hmax = max([b[3] - b[1] for b in hs if b] or [1])
    sc = min(1.0, MAX_H / hmax)
    def fit(im):
        return im if sc >= 1 else im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.BOX)
    dsts = {sfx: os.path.join(ROOT, name + sfx) for sfx in DIRS}
    for d in dsts.values(): shutil.rmtree(d, ignore_errors=True); os.makedirs(d, exist_ok=True)   # 先清空，免得留下舊骨架的幀
    n = 0
    for f in body:
        act, fi = frame_info(f)
        im = Image.open(os.path.join(src, f)).convert('RGBA')
        im = fit(im)
        for sfx, d in dsts.items():
            fr = im if sfx == '2' else im.transpose(Image.FLIP_LEFT_RIGHT)
            fr = fn(fr.copy(), SIDE[sfx], fi, act) if fn else fr
            save_png(fr, os.path.join(d, f))
        sf = os.path.join(src, act + '_s_' + str(fi) + '.png')
        if os.path.exists(sf):
            sh = fit(Image.open(sf).convert('RGBA'))
            for sfx, d in dsts.items(): (sh if sfx == '2' else sh.transpose(Image.FLIP_LEFT_RIGHT)).save(os.path.join(d, act + '_s_' + str(fi) + '.png'), optimize=True)
        n += 1
    return n

def light_tier_fn(tier, name):
    """原作圖的階級光效：只描邊、加光環或星點，不改本體顏色（聖衣例外：灰白部分淡淡鍍金）。"""
    zh = next((v for k, v in ZODIAC_HUE.items() if name.startswith(k)), 45)
    def fx(im, side, fi, act):
        px = im.load()
        if tier == 'samsara':
            w, h = im.size
            for y in range(h):
                for x in range(w):
                    p = px[x, y]
                    if p[3] < 10: continue
                    H, S, L, A = to_hsl(p)
                    if S < 0.3: px[x, y] = from_hsl(44, 0.3 + S, L * 0.9 + 0.06, A)
        col = {'mythic': None, 'celestial': (255, 236, 170, 255), 'spacetime': (156, 234, 255, 255), 'samsara': (255, 228, 140, 255)}[tier]
        for x, y in outline_pts(im):
            put(im, x, y, col or from_hsl(38, 0.9, 0.42 + to_hsl(px[x, y])[2] * 0.35, 255))
        if tier == 'celestial': halo(im, act)
        if tier == 'spacetime' and not act.startswith('death'): stars(im, fi, (225, 245, 255, 255))
        if tier == 'samsara' and not act.startswith('death'): stars(im, fi, from_hsl(zh, 0.9, 0.7, 255), 3)
        return im
    return fx

# ───────────────────────── 卡片階級 ─────────────────────────
ZODIAC_HUE = {'白羊': 5, '金牛': 120, '雙子': 200, '巨蟹': 185, '獅子': 30, '處女': 300, '天秤': 160, '天蠍': 340, '射手': 15, '摩羯': 260, '水瓶': 195, '雙魚': 220}

def tier_fn(tier, name):
    def mythic(im, side, fi, act):      # 神話：金焰描邊、色彩更飽滿
        remap(im, [R(s=(0.25, 1), to=(None, None, 1.05, 0.02))])
        px = im.load()
        for x, y in outline_pts(im):
            L = to_hsl(px[x, y])[2]; put(im, x, y, from_hsl(38, 0.9, 0.42 + L * 0.35, 255))
        return im
    def celestial(im, side, fi, act):   # 天上：整體提亮偏白金、淡金描邊、頭頂光環
        px = im.load(); w, h = im.size
        for y in range(h):
            for x in range(w):
                p = px[x, y]
                if p[3] < 10: continue
                H, S, L, A = to_hsl(p)
                px[x, y] = from_hsl(H + ((48 - H + 540) % 360 - 180) * 0.35, S * 0.55 + 0.12, L + (1 - L) * 0.28, A)
        for x, y in outline_pts(im): put(im, x, y, (255, 236, 170, 255))
        halo(im, act)
        return im
    def spacetime(im, side, fi, act):   # 時空：色相收進青～紫、青色描邊、身邊星點
        px = im.load(); w, h = im.size
        for y in range(h):
            for x in range(w):
                p = px[x, y]
                if p[3] < 10: continue
                H, S, L, A = to_hsl(p)
                px[x, y] = from_hsl(190 + (H / 360) * 95, max(S, 0.35) if L > 0.12 else S, L * 0.9 + 0.03, A)
        for x, y in outline_pts(im): put(im, x, y, (156, 234, 255, 255))
        if not act.startswith('death'): stars(im, fi, (225, 245, 255, 255))
        return im
    def samsara(im, side, fi, act):     # 聖衣：金色聖衣（灰白與金系全部換成金屬金），其餘換成該星座的代表色
        zh = next((v for k, v in ZODIAC_HUE.items() if name.startswith(k)), 45)
        px = im.load(); w, h = im.size
        for y in range(h):
            for x in range(w):
                p = px[x, y]
                if p[3] < 10: continue
                H, S, L, A = to_hsl(p)
                if S < 0.3 or (20 <= H <= 65): px[x, y] = from_hsl(44 + (L - 0.5) * 12, 0.78, 0.14 + L * 0.8, A)
                else: px[x, y] = from_hsl(zh, max(S, 0.55), L, A)
        for x, y in outline_pts(im): put(im, x, y, (255, 228, 140, 255))
        return im
    return {'mythic': mythic, 'celestial': celestial, 'spacetime': spacetime, 'samsara': samsara}[tier]

# ───────────────────────── 輸出 ─────────────────────────
def frame_info(f):
    act, idx = f[:-4].rsplit('_', 1)
    return act, int(idx)

def save_png(im, path):
    try: im.quantize(colors=255, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)
    except Exception: im.save(path, optimize=True)

def build(name, base, fn):
    n = 0
    for sfx in DIRS:
        src = os.path.join(ROOT, base + sfx); dst = os.path.join(ROOT, name + sfx)
        if not os.path.isdir(src): raise SystemExit('找不到骨架資料夾：' + src)
        shutil.rmtree(dst, ignore_errors=True); os.makedirs(dst, exist_ok=True)
        for f in sorted(os.listdir(src)):
            if not f.endswith('.png'): continue
            act, fi = frame_info(f)
            if act.endswith('_s'):                                   # 影子照抄
                shutil.copyfile(os.path.join(src, f), os.path.join(dst, f)); continue
            im = Image.open(os.path.join(src, f)).convert('RGBA')
            save_png(fn(im, SIDE[sfx], fi, act), os.path.join(dst, f)); n += 1
    return n

def build_base(name):
    if name in IMPORT: return import_anim(name, IMPORT[name])
    rc = BASES[name]
    fn = rc.get('fn') or (lambda im, side, fi, act, r=rc['rules']: remap(im, r))
    return build(name, rc['base'], fn)

# 職業式變身（真夏納）沒有固定的變身圖：卡片版改用相近的變身當骨架（戰場上由 afk-forged-sprites 優先採用）
SKELETON_OVERRIDE = {'神話・真夏納': '白金法師', '天上・熾光聖賢': '白金法師', '時空・萬象先知': '白金法師', '白羊座聖衣': '銀光騎士'}

def card_skeleton(row):
    if row['name'] in SKELETON_OVERRIDE: return SKELETON_OVERRIDE[row['name']]
    return row['proto'] if row['proto'] in BASES else row['alias']

def build_card(row):
    if row['name'] in CARD_IMPORT: return import_anim(row['name'], CARD_IMPORT[row['name']], light_tier_fn(row['tier'], row['name']))
    skel = card_skeleton(row)
    if skel in IMPORT or row['tier'] == 'mythic': return build(row['name'], skel, light_tier_fn(row['tier'], row['name']))   # 神話：原圖＋金焰描邊
    return build(row['name'], skel, tier_fn(row['tier'], row['name']))

def write_plugin(made):
    js = os.path.join(WORK, 'afk-forged-sprites.js')
    open(js, 'w', encoding='utf-8').write(
        "/* ==========================================================================\n"
        " * afk-forged-sprites.js — 自製變身圖登錄（由 scripts/forge-morph.py 產生，請勿手改）\n"
        " *\n"
        " * 沒有專屬圖的變身、以及神話／天上／時空／聖衣卡，各自有一套由相近變身逐幀重新上色、加配件或階級光效的\n"
        " * 三方向動畫（assets/morphanim/<名稱>{,2,F}）。這裡把它們登錄成正式變身動畫，蓋過原本的借圖別名。\n"
        " * 須排在 afk-polys、afk-card-forms 之後。\n"
        " * ========================================================================== */\n"
        "(function () {\n  'use strict';\n"
        "  var LIST = " + json.dumps(made, ensure_ascii=False) + ";\n"
        "  if (typeof MORPH_BATTLE_ANIM === 'undefined' || typeof MORPH_ANIM_3DIR === 'undefined') return;\n"
        "  LIST.forEach(function (name) {\n"
        "    MORPH_BATTLE_ANIM.add(name); MORPH_ANIM_3DIR.add(name);\n"
        "    if (typeof MORPH_BATTLE_ALIAS !== 'undefined') { MORPH_BATTLE_ALIAS[name] = name; if (/座聖衣$/.test(name)) MORPH_BATTLE_ALIAS['輪迴・' + name] = name; }\n"
        "  });\n"
        "  // 職業式變身（真夏納系的卡片）也優先用自製圖：在職業動畫判斷之前先接手\n"
        "  var SET = new Set(LIST);\n"
        "  if (typeof window._actorBattleForm === 'function') {\n"
        "    var oABF = window._actorBattleForm;\n"
        "    window._actorBattleForm = function (actor, allyGrp) {\n"
        "      try {\n"
        "        var pf = actor && (actor._setPoly || ((actor.buffs && actor.buffs.poly > 0 && actor.poly) ? actor.poly : null));\n"
        "        if (pf && pf.classMorph && SET.has(pf.n)) { var m = pf.n, folder = m + _animDirSfx((actor._faceD != null) ? actor._faceD : 2, false);\n"
        "          return { key: 'morph:' + folder, domKey: 'morph:' + m, base: 'assets/morphanim/' + encodeURIComponent(folder) + '/', wpn: null }; }\n"
        "      } catch (e) {}\n"
        "      return oABF.apply(this, arguments);\n"
        "    };\n"
        "  }\n"
        "  window.__afkForgedSprites = LIST;\n"
        "  console.log('[AFK-forged-sprites] 已登錄自製變身圖 ' + LIST.length + ' 種');\n"
        "})();\n")
    print('wrote', js)

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'all'
    cards = json.load(open(os.path.join(HERE, 'forge-cards.json'), encoding='utf-8'))
    t0 = time.time(); made = []
    if cmd in ('all', 'base'):
        for nm in (sys.argv[2:] if cmd == 'base' and len(sys.argv) > 2 else list(BASES)):
            print('base', nm, build_base(nm), 'frames', flush=True); made.append(nm)
    if cmd in ('all', 'card'):
        want = set(sys.argv[2:]) if cmd == 'card' and len(sys.argv) > 2 else None
        for row in cards:
            if want and row['name'] not in want: continue
            print('card', row['name'], '←', CARD_IMPORT.get(row['name']) or card_skeleton(row), build_card(row), 'frames', flush=True); made.append(row['name'])
    if cmd == 'all': write_plugin(made)
    print('done in %.0fs' % (time.time() - t0))

if __name__ == '__main__':
    main()
