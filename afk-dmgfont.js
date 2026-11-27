/* ============================================================================
 * afk-dmgfont.js — 🔤 傷害字體（玩家 2026-11-05；外掛開關 dmgfont，預設開；經典模式沒有）
 *
 *   潘朵拉黑市多一個分頁「🔤 字體販賣所」：用龍之鑽石買傷害字體，買一次全帳號共用，隨時可換回「經典」。
 *   只換「你這邊打出去的傷害」——遊戲裡所有飄字都畫在怪物身上（你、傭兵、召喚物打出去的），所以整層換；
 *   「未命中」維持原樣。每款只收錄數字與少數字（爆擊、重擊、億、萬…），字型檔 1～4 KB（assets/fonts/dmg/，皆 OFL 授權）。
 *   第一批 8 款＋泡泡彩虹（Ping 定：每款 500 萬龍鑽）。第二批 8 款（11-12）：漫畫爆擊、機甲終端、墨韻武俠、元素共鳴、王者金字、街機連段、霓虹賽博、暗黑分級。加新款＝在 FONTS 加一筆（id、名稱、說明、價格、字型檔、CSS）。
 *   繁星、泡泡彩虹：數字改用中文單位（1億 2345萬）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'dmgfont', name: '傷害字體（潘朵拉黑市・字體販賣所）', group: '介面', def: true, seal: true,
    desc: '潘朵拉黑市多一個「字體販賣所」分頁，用龍之鑽石買傷害數字的字體；關掉一律用經典字體' });
  var on = function () { return !T || T.enabled('dmgfont'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var el = function (id) { return document.getElementById(id); };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var LS = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };

  var DIR = 'assets/fonts/dmg/';
  var SEL = function (id) { return 'body.dmgf-' + id + ' #vfx-layer .vfx-dmg:not(.vfx-miss),.dmgf-pv.dmgf-' + id + ' .vfx-dmg'; };
  var CRIT = function (id) { return 'body.dmgf-' + id + ' #vfx-layer .vfx-dmg.vfx-crit .vfx-dmg-value,.dmgf-pv.dmgf-' + id + ' .vfx-dmg.vfx-crit .vfx-dmg-value'; };
  var CC = function (id) { return 'body.dmgf-' + id + ' #vfx-layer .vfx-dmg.vfx-critical .vfx-dmg-value,.dmgf-pv.dmgf-' + id + ' .vfx-dmg.vfx-critical .vfx-dmg-value'; };   // 只有爆擊（不含重擊）
  var TAG = function (id, col) { return 'body.dmgf-' + id + ' #vfx-layer .vfx-dmg .vfx-dmg-tag,.dmgf-pv.dmgf-' + id + ' .vfx-dmg .vfx-dmg-tag{-webkit-text-fill-color:' + col + '!important;color:' + col + '!important}'; };
  // 11-27 Ping：漸層不再直接畫在數字外框，改記在 --dmgf-ink，由字本體那層（.vfx-dmg-ink）畫；光暈記在 --dmgf-glow，由底下那層（.vfx-dmg-glow）用文字陰影畫。
  //   原本每款都用 filter:drop-shadow 疊光暈，每個數字每一幀都要重算；實測 70 個數字同時飄時 14 幀 → 51 幀。
  var GRAD = function (g) { return '--dmgf-ink:' + g + ';-webkit-text-fill-color:transparent!important;color:transparent!important;'; };
  var INK = function (t) { return '<i class="vfx-dmg-glow">' + t + '</i><span class="vfx-dmg-ink">' + t + '</span>'; };
  // 每一款：id、n 名稱、d 說明、price 龍鑽、fam 字型、css(sel, crit) 回傳這款的樣式
  var FONTS = [
    { id: 'honey', n: '蜜糖彈跳', d: '圓胖的糖果字，奶黃、橘、蜜桃粉三色漸層，彈出來再往上飄；爆擊變粉紫藍漸層、抖一下。', price: 5000000, fam: 'honey', css: function (s, c) {
      return s + '{font-family:"afkdmg-honey",sans-serif!important;' + GRAD('linear-gradient(#fffbd1,#ffd54f 35%,#ff9a3c 65%,#ff6f91)') + '-webkit-text-stroke:0!important;text-shadow:none!important;--dmgf-glow:1px 0 0 #4e2a0c,-1px 0 0 #4e2a0c,0 1px 0 #4e2a0c,0 -1px 0 #4e2a0c,0 2px 0 #4e2a0c,0 0 2px #000;animation-name:dmgfPop!important}'
        + c + '{' + GRAD('linear-gradient(#ffe4f7,#f472b6 35%,#c026d3 65%,#818cf8)') + 'animation:dmgfShake .35s ease-out}' + TAG('honey', '#fde68a'); } },
    { id: 'pixel', n: '古都像素', d: '像素字分成白、青、粉、黃四段色帶，粗黑框，直直往上升；爆擊變金橘紅色帶。', price: 5000000, fam: 'pixel', css: function (s, c) {
      return s + '{font-family:"afkdmg-pixel",monospace!important;' + GRAD('linear-gradient(#ffffff 0 28%,#7df9ff 28% 52%,#ff7ad9 52% 76%,#ffe66b 76%)') + '-webkit-text-stroke:2px #000!important;text-shadow:none!important;--dmgf-glow:2px 2px 0 #000;-webkit-font-smoothing:none;animation-name:dmgfRise!important;animation-timing-function:linear!important}'
        + c + '{' + GRAD('linear-gradient(#fff8b0 0 28%,#ffd000 28% 52%,#ff8a00 52% 76%,#ff3d6e 76%)') + '}' + TAG('pixel', '#ffe600'); } },
    { id: 'crystal', n: '水晶之章', d: '冰晶白、淡藍、薰衣草紫、粉紅的漸層字，帶淡藍光，往下掉再小彈兩下；爆擊是金黃到粉紅。', price: 5000000, fam: 'crystal', css: function (s, c) {
      return s + '{font-family:"afkdmg-crystal",monospace!important;font-size:calc(15px + var(--vfx-font-bonus,0px))!important;' + GRAD('linear-gradient(170deg,#ffffff,#bae6fd 35%,#a5b4fc 65%,#f0abfc)') + '-webkit-text-stroke:1px #1e3a8a!important;text-shadow:none!important;--dmgf-glow:0 0 4px #7dd3fc,2px 2px 0 #10204a;animation:dmgfDrop 1.05s ease-out forwards!important}'
        + 'body.dmgf-crystal #vfx-layer .vfx-dmg.vfx-crit,.dmgf-pv.dmgf-crystal .vfx-dmg.vfx-crit{font-size:calc(22px + var(--vfx-font-bonus,0px))!important}'
        + c + '{' + GRAD('linear-gradient(170deg,#fffbe0,#fde68a 35%,#fbbf24 65%,#f472b6)') + '--dmgf-glow:0 0 6px #facc15}' + TAG('crystal', '#fde68a'); } },
    { id: 'horde', n: '部落榮光', d: '金黃、橘、珊瑚紅漸層的奇幻襯線字，往上飄、微微偏一邊；爆擊變橘紅紫漸層，先爆大再縮回。', price: 5000000, fam: 'horde', css: function (s, c) {
      return s + '{font-family:"afkdmg-horde",serif!important;' + GRAD('linear-gradient(#fff3b0,#ffd100 40%,#ff9f1c 70%,#ff5d73)') + '-webkit-text-stroke:0!important;text-shadow:none!important;--dmgf-glow:1px 0 0 #000,-1px 0 0 #000,0 1px 0 #000,0 -1px 0 #000,0 2px 2px #000;animation-name:dmgfDrift!important}'   // 這款字很細，描邊會蓋掉漸層 → 用陰影描黑邊
        + 'body.dmgf-horde #vfx-layer .vfx-dmg.vfx-crit,.dmgf-pv.dmgf-horde .vfx-dmg.vfx-crit{animation:dmgfBurst 1.05s ease-out forwards!important}'
        + c + '{' + GRAD('linear-gradient(#ffe0a3,#ff8a00 40%,#ff3d7f 75%,#c026d3)') + '}' + TAG('horde', '#ffb020'); } },
    { id: 'inferno', n: '地獄烈焰', d: '熔岩金、橘、深紅、暗紫漸層的碑文字，慢慢往上飄；爆擊冒出橘色火光、會閃。', price: 5000000, fam: 'inferno', css: function (s, c) {
      return s + '{font-family:"afkdmg-inferno",serif!important;' + GRAD('linear-gradient(#ffe08a,#ff7b2e 35%,#e11d48 70%,#7e22ce)') + '-webkit-text-stroke:0!important;text-shadow:none!important;--dmgf-glow:1px 0 0 #000,-1px 0 0 #000,0 1px 0 #000,0 -1px 0 #000,0 2px 3px #000;letter-spacing:1px}'
        + c + '{' + GRAD('linear-gradient(#fff4b8,#ffb020 35%,#ff4d00 65%,#ff2a6d)') + '--dmgf-glow:0 0 6px #ff4d00,0 0 12px #ff2200;animation:dmgfFlicker .18s steps(2) 5}' + TAG('inferno', '#ffb020'); } },
    { id: 'stellar', n: '恆星', d: '白、淡紫、天藍、粉紅漸層的襯線字，罩著紫色光暈，旁邊閃著星光；爆擊光暈更亮。', price: 5000000, fam: 'stellar', css: function (s, c) {
      return s + '{font-family:"afkdmg-stellar",serif!important;' + GRAD('linear-gradient(160deg,#ffffff,#e9d5ff 30%,#a5b4fc 60%,#f9a8d4)') + '-webkit-text-stroke:0!important;text-shadow:none!important;--dmgf-glow:0 0 1px #fff,0 0 4px #a855f7,0 2px 2px #2e1065}'
        + s + '::before,' + s + '::after{content:"✦";position:absolute;font-family:sans-serif;color:#fff;-webkit-text-fill-color:#fff;text-shadow:0 0 6px #e9d5ff;pointer-events:none;animation:dmgfTwinkle .5s ease-in-out infinite alternate}'
        + s + '::before{left:-8px;top:-6px;font-size:.5em}' + s + '::after{right:-8px;bottom:-2px;font-size:.4em;animation-delay:.25s}'
        + c + '{' + GRAD('linear-gradient(160deg,#ffffff,#f5d0fe 25%,#e879f9 55%,#818cf8 85%)') + '--dmgf-glow:0 0 2px #fff,0 0 6px #e879f9,0 0 10px #9333ea}' + TAG('stellar', '#f5d0fe'); } },
    { id: 'nova', n: '新星世界', d: '粉紅到淡紫藍的漸層圓體字，白色描邊發光。', price: 5000000, fam: 'nova', css: function (s, c) {
      return s + '{font-family:"afkdmg-nova",sans-serif!important;' + GRAD('linear-gradient(170deg,#ff5fd2 10%,#d18bff 50%,#9cc8ff 90%)') + '-webkit-text-stroke:1.5px #fff!important;text-shadow:none!important;--dmgf-glow:0 0 3px #f0abfc,0 1px 1px #4c1d95}'
        + c + '{' + GRAD('linear-gradient(170deg,#ff2fc1,#b26bff 50%,#6fb2ff)') + '--dmgf-glow:0 0 5px #fff}' + TAG('nova', '#fff0fb'); } },
    { id: 'starry', n: '繁星', d: '紫藍漸層的粗字，數字用中文單位（1億 2345萬），旁邊閃著金色星光。', price: 5000000, fam: 'starry', zh: true, css: function (s, c) {
      return s + '{font-family:"afkdmg-starry",sans-serif!important;' + GRAD('linear-gradient(100deg,#4338ca,#7c3aed 35%,#d946ef 65%,#3b82f6)') + '-webkit-text-stroke:1.5px #fff!important;text-shadow:none!important;--dmgf-glow:0 0 2px #c4b5fd,0 2px 1px #1e1b4b}'
        + s + '::before,' + s + '::after{content:"✦";position:absolute;font-family:sans-serif;color:#fde68a;-webkit-text-fill-color:#fde68a;-webkit-text-stroke:0;pointer-events:none;animation:dmgfTwinkle .45s ease-in-out infinite alternate}'
        + s + '::before{left:-4px;top:-6px;font-size:.5em}' + s + '::after{right:-6px;top:30%;font-size:.4em;animation-delay:.2s}'
        + c + '{' + GRAD('linear-gradient(100deg,#6d28d9,#c026d3 45%,#2563eb)') + '}' + TAG('starry', '#fde68a'); } },
    { id: 'rainbow', n: '泡泡彩虹', d: '粉嫩的彩虹漸層圓體字，像肥皂泡一樣閃著流光；數字用中文單位（1億 2345萬）。', price: 5000000, fam: 'nova', zh: true, css: function (s, c) {
      return s + '{font-family:"afkdmg-nova",sans-serif!important;' + GRAD('linear-gradient(100deg,#ffb3d9,#fff3a8 20%,#b8ffd9 40%,#a8e8ff 60%,#d9b8ff 80%,#ffb3d9)') + '--dmgf-ink-size:200% 100%;-webkit-text-stroke:1.5px rgba(255,255,255,.95)!important;text-shadow:none!important;--dmgf-glow:0 0 3px #fff,0 0 6px #e9d5ff,0 1px 1px #6b21a8;animation-name:dmgfPop!important}'
        + s + '::before{content:"✦";position:absolute;left:-10px;top:-4px;font-size:.55em;font-family:sans-serif;color:#fff;-webkit-text-fill-color:#fff;-webkit-text-stroke:0;text-shadow:0 0 6px #fbcfe8;pointer-events:none;animation:dmgfTwinkle .4s ease-in-out infinite alternate}'
        + c + '{' + GRAD('linear-gradient(100deg,#ff8fc8,#ffe96b 20%,#7dffbf 40%,#7fd8ff 60%,#c49bff 80%,#ff8fc8)') + '--dmgf-ink-size:200% 100%;animation:dmgfShimmer 1s linear infinite}'
        + TAG('rainbow', '#fff0fb'); } },
    // ── 第二批（Ping 11-12 19:17）：只取風格、不搬原版，字型皆 OFL ──
    { id: 'comic', two: true, n: '漫畫爆擊', d: '美式漫畫的粗體字，檸檬黃到橘的漸層、粗黑框、微微歪斜，砰一下彈出；爆擊變粉紅到洋紅、後面爆出放射狀的對話框。', price: 5000000, fam: 'comic', css: function (s, c) {
      return s + '{font-family:"afkdmg-comic",sans-serif!important;' + GRAD('linear-gradient(#fffbb0,#ffe100 40%,#ffa600 75%,#ff6b35)') + '-webkit-text-stroke:0!important;text-shadow:none!important;--dmgf-glow:1px 0 0 #000,-1px 0 0 #000,0 1px 0 #000,0 -1px 0 #000,1px 1px 0 #000,3px 3px 0 #000;letter-spacing:1px;animation-name:dmgfComic!important}'
        + 'body.dmgf-comic #vfx-layer .vfx-dmg.vfx-critical,.dmgf-pv.dmgf-comic .vfx-dmg.vfx-critical{padding:12px 26px;background:radial-gradient(ellipse closest-side,#fff 0 62%,#000 64% 70%,transparent 72%),repeating-conic-gradient(#ffd600cc 0 6deg,transparent 6deg 18deg)!important;background-size:100% 100%,100% 100%!important;-webkit-background-clip:border-box!important;background-clip:border-box!important;border-radius:50%;--dmgf-glow:none}'
        + CC('comic') + '{' + GRAD('linear-gradient(#ffb3d1,#ff2d55 45%,#d6006b 75%,#8b5cf6)') + '-webkit-text-stroke:0!important;--dmgf-glow:1px 0 0 #000,-1px 0 0 #000,0 1px 0 #000,0 -1px 0 #000,2px 2px 0 #000}' + TAG('comic', '#ff2d55'); } },
    { id: 'mecha', two: true, n: '機甲終端', d: '白到冰藍漸層的科技字，從側邊滑出、帶一點殘影；分三級漸層：重擊黃橘、爆擊橘粉、超大爆擊紅紫。', price: 5000000, fam: 'mecha', css: function (s, c) {
      return s + '{font-family:"afkdmg-mecha",sans-serif!important;' + GRAD('linear-gradient(#ffffff,#e2e8f0 40%,#7dd3fc 75%,#a5b4fc)') + '-webkit-text-stroke:0!important;text-shadow:none!important;--dmgf-glow:1px 1px 0 #000,-3px 0 2px #38bdf855;letter-spacing:1px;animation-name:dmgfSlide!important}'
        + 'body.dmgf-mecha #vfx-layer .vfx-dmg.vfx-heavy .vfx-dmg-value,.dmgf-pv.dmgf-mecha .vfx-dmg.vfx-heavy .vfx-dmg-value' + '{' + GRAD('linear-gradient(#fef9c3,#facc15 45%,#f97316)') + '}'
        + CC('mecha') + '{' + GRAD('linear-gradient(#fed7aa,#fb923c 45%,#f43f5e 85%)') + '}'
        + 'body.dmgf-mecha #vfx-layer .vfx-dmg.vfx-critical.dmgf-t3 .vfx-dmg-value,.dmgf-pv.dmgf-mecha .vfx-dmg.vfx-critical.dmgf-t3 .vfx-dmg-value' + '{' + GRAD('linear-gradient(#fecaca,#ef4444 45%,#a21caf 85%)') + '--dmgf-glow:0 0 6px #ef4444}' + TAG('mecha', '#e2e8f0'); } },
    { id: 'ink', two: true, n: '墨韻武俠', d: '毛筆寫的數字，淡紫、紫藤暈到青碧的彩墨，墨邊描黑，暈開後散去；爆擊變朱紅到深紅，旁邊蓋一個「爆」字印章。', price: 5000000, fam: 'ink', css: function (s, c) {
      return s + '{font-family:"afkdmg-ink",serif!important;' + GRAD('linear-gradient(160deg,#c4b5fd,#a78bfa 30%,#5eead4 70%,#e7e5e4)') + '-webkit-text-stroke:0!important;text-shadow:none!important;--dmgf-glow:1px 0 0 #1c1917,-1px 0 0 #1c1917,0 1px 0 #1c1917,0 -1px 0 #1c1917,0 0 4px #000;animation-name:dmgfInk!important}'
        + CC('ink') + '{' + GRAD('linear-gradient(160deg,#f87171,#dc2626 40%,#991b1b 75%,#7c2d12)') + '}'
        + 'body.dmgf-ink #vfx-layer .vfx-dmg.vfx-critical::after,.dmgf-pv.dmgf-ink .vfx-dmg.vfx-critical::after{content:"爆";position:absolute;right:-24px;top:-6px;font-family:"afkdmg-ink",serif;font-size:.55em;line-height:1;color:#fff;-webkit-text-fill-color:#fff;background:#b91c1c;padding:3px;border-radius:3px;transform:rotate(12deg);text-shadow:none;box-shadow:0 0 0 2px #7f1d1d}'
        + 'body.dmgf-ink #vfx-layer .vfx-dmg.vfx-critical .vfx-dmg-tag,.dmgf-pv.dmgf-ink .vfx-dmg.vfx-critical .vfx-dmg-tag{display:none}' + TAG('ink', '#44403c'); } },
    { id: 'element', two: true, n: '元素共鳴', d: '圓胖的粗體字，漸層顏色跟著屬性走：火（金橘紅）、水（冰藍靛）、風（嫩綠青）、地（金黃琥珀）、魔法（粉紫藍）、無屬性（白銀紫）；爆擊外圈發白光。', price: 5000000, fam: 'element', css: function (s, c) {
      var E = { fire: '#ffe08a,#ff8a3d 45%,#ff3d3d', water: '#e0f7ff,#38bdf8 45%,#6366f1', wind: '#eaffd0,#4ade80 45%,#14b8a6', earth: '#fff3b0,#facc15 45%,#d97706', magic: '#fbcfe8,#c084fc 45%,#6366f1', normal: '#ffffff,#e2e8f0 45%,#c4b5fd' };
      var t = s + '{font-family:"afkdmg-element",sans-serif!important;-webkit-text-stroke:2px #1e1b2e!important;text-shadow:none!important;--dmgf-glow:0 2px 0 #1e1b2e;animation-name:dmgfPop!important}';
      Object.keys(E).forEach(function (k) { t += 'body.dmgf-element #vfx-layer .vfx-dmg.dmgf-e-' + k + ',body.dmgf-element #vfx-layer .vfx-dmg.dmgf-e-' + k + ' .vfx-dmg-value,.dmgf-pv.dmgf-element .vfx-dmg.dmgf-e-' + k + ',.dmgf-pv.dmgf-element .vfx-dmg.dmgf-e-' + k + ' .vfx-dmg-value{' + GRAD('linear-gradient(' + E[k] + ')') + '}'; });
      return t + c + '{--dmgf-glow:0 0 4px #fff,0 0 8px #fff8}' + TAG('element', '#fff'); } },
    { id: 'royal', two: true, n: '王者金字', d: '超粗的金屬字，香檳金、琥珀、玫瑰粉到淡紫的漸層，重重落下、震一下；爆擊變得巨大，後面炸開一圈金光。', price: 5000000, fam: 'royal', css: function (s, c) {
      return s + '{font-family:"afkdmg-royal",sans-serif!important;' + GRAD('linear-gradient(#fffbea,#fde68a 25%,#f59e0b 50%,#f472b6 78%,#a78bfa)') + '-webkit-text-stroke:1.5px #3b2300!important;text-shadow:none!important;--dmgf-glow:0 2px 1px #000;animation-name:dmgfSlam!important}'
        + 'body.dmgf-royal #vfx-layer .vfx-dmg.vfx-critical,.dmgf-pv.dmgf-royal .vfx-dmg.vfx-critical{font-size:calc(40px + var(--vfx-font-bonus,0px))!important;--dmgf-glow:0 0 10px #fbbf24,0 0 3px #fff7}'
        + c + '{' + GRAD('linear-gradient(#ffffff,#fef08a 20%,#fb923c 45%,#f43f5e 70%,#8b5cf6)') + '}' + TAG('royal', '#fde68a'); } },
    { id: 'arcade', two: true, n: '街機連段', d: '方正的街機字，白、黃、橘紅到桃紅的漸層，紅黑雙層框；連續打中會在下面數「12 HITS」；爆擊變黃到青的漸層。', price: 5000000, fam: 'arcade', css: function (s, c) {
      return s + '{font-family:"afkdmg-arcade",sans-serif!important;' + GRAD('linear-gradient(#ffffff,#ffe14d 40%,#ff6b6b 70%,#ff3cac)') + '-webkit-text-stroke:1.5px #b91c1c!important;text-shadow:none!important;--dmgf-glow:2px 2px 0 #000,-1px -1px 0 #000;animation-name:dmgfRise!important}'
        + c + '{' + GRAD('linear-gradient(#fff8b0,#ffe600 40%,#7cff6b 70%,#00e5ff)') + '}'
        + '.dmgf-hits{display:none}body.dmgf-arcade #vfx-layer .dmgf-hits,.dmgf-pv.dmgf-arcade .dmgf-hits{display:block;font-size:.5em;color:#ffe600;-webkit-text-fill-color:#ffe600;-webkit-text-stroke:1px #000;letter-spacing:1px;text-align:center}' + TAG('arcade', '#ffe600'); } },
    { id: 'neon', two: true, n: '霓虹賽博', d: '霓虹燈字，青、藍紫到粉紫的漸層，有一點故障般的抖動；爆擊變粉紫到青的漸層、會閃。', price: 5000000, fam: 'neon', css: function (s, c) {
      return s + '{font-family:"afkdmg-neon",sans-serif!important;' + GRAD('linear-gradient(100deg,#e0fbff,#67e8f9 35%,#a78bfa 70%,#f0abfc)') + '-webkit-text-stroke:0!important;text-shadow:none!important;--dmgf-glow:0 0 2px #fff,0 0 6px #22d3ee,0 0 10px #a855f7;animation-name:dmgfGlitch!important}'
        + c + '{' + GRAD('linear-gradient(100deg,#ffffff,#f0abfc 30%,#e879f9 60%,#22d3ee)') + '--dmgf-glow:0 0 2px #fff,0 0 8px #e879f9,0 0 16px #d946ef;animation:dmgfFlicker .14s steps(2) 6}' + TAG('neon', '#a5f3fc'); } },
    { id: 'tier', two: true, n: '暗黑分級', d: '碑文體字，用漸層顏色分傷害等級：一般銀白、重擊天藍到靛、爆擊金黃到琥珀、超大爆擊橘到紅。', price: 5000000, fam: 'inferno', css: function (s, c) {
      return s + '{font-family:"afkdmg-inferno",serif!important;' + GRAD('linear-gradient(#ffffff,#e0e7ff 50%,#c7d2fe)') + '-webkit-text-stroke:0!important;text-shadow:none!important;--dmgf-glow:1px 0 0 #000,-1px 0 0 #000,0 1px 0 #000,0 -1px 0 #000,0 2px 3px #000;letter-spacing:1px}'
        + 'body.dmgf-tier #vfx-layer .vfx-dmg.vfx-heavy .vfx-dmg-value,.dmgf-pv.dmgf-tier .vfx-dmg.vfx-heavy .vfx-dmg-value' + '{' + GRAD('linear-gradient(#dbeafe,#60a5fa 45%,#6366f1)') + '}'
        + CC('tier') + '{' + GRAD('linear-gradient(#fef9c3,#facc15 45%,#f59e0b)') + '}'
        + 'body.dmgf-tier #vfx-layer .vfx-dmg.vfx-critical.dmgf-t3 .vfx-dmg-value,.dmgf-pv.dmgf-tier .vfx-dmg.vfx-critical.dmgf-t3 .vfx-dmg-value' + '{' + GRAD('linear-gradient(#fed7aa,#fb923c 45%,#ef4444)') + '--dmgf-glow:0 0 8px #ea580c}' + TAG('tier', '#e7e5e4'); } }
  ];
  var FBY = {}; FONTS.forEach(function (f) { FBY[f.id] = f; });

  // ── 擁有／使用（全帳號共用：存在 localStorage，跟龍之鑽石一樣不分角色） ──
  var K_OWN = 'afk_dmgfont_own', K_USE = 'afk_dmgfont_use';
  function owned() { try { var a = JSON.parse(LS(K_OWN) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function isOwned(id) { return owned().indexOf(id) >= 0; }
  function using() { var u = LS(K_USE) || ''; return FBY[u] && isOwned(u) ? u : ''; }
  function classic() { var p = P(); return !!(p && p.classicMode); }
  function apply() {
    var b = document.body; if (!b) return;
    FONTS.forEach(function (f) { b.classList.remove('dmgf-' + f.id); });
    var u = on() && !classic() ? using() : '';
    if (u) { css(); b.classList.add('dmgf-' + u); }
  }
  function diaReady() { return typeof W.pandoraGetSharedDiamonds === 'function' && typeof W.pandoraAdjustSharedDiamonds === 'function'; }
  function dia() { try { return Math.max(0, Math.floor(Number(W.pandoraGetSharedDiamonds()) || 0)); } catch (e) { return 0; } }
  function buy(id) {
    var f = FBY[id]; if (!f) return '沒有這款字體。';
    if (isOwned(id)) return '你已經有這款了。';
    if (!diaReady()) return '龍之鑽石帳戶還沒準備好，稍後再試。';
    if (dia() < f.price) return '龍之鑽石不夠（要 ' + fmt(f.price) + ' 顆）。';
    var r = null; try { r = W.pandoraAdjustSharedDiamonds(-f.price) || {}; } catch (e) { r = {}; }
    if (!r.ok) return '扣款失敗，沒有買成。';
    var a = owned(); a.push(id); LS(K_OWN, JSON.stringify(a));
    LS(K_USE, id); apply();
    return '';
  }

  // ── 樣式 ──
  function css() {
    if (el('afk-dmgfont-css')) return;
    var s = document.createElement('style'); s.id = 'afk-dmgfont-css';
    var t = FONTS.map(function (f) { return '@font-face{font-family:"afkdmg-' + f.fam + '";src:url("' + DIR + f.fam + '.woff2?v=1") format("woff2");font-display:swap}'; }).join('');
    t += '@keyframes dmgfPop{0%{transform:translate(-50%,-50%) scale(.35);opacity:0}14%{transform:translate(-50%,-55%) scale(1.25);opacity:1}28%{transform:translate(-50%,-55%) scale(1)}100%{transform:translate(-50%,calc(-180% - 34px)) scale(1);opacity:0}}'
      + '@keyframes dmgfRise{0%{transform:translate(-50%,-50%);opacity:1}75%{opacity:1}100%{transform:translate(-50%,calc(-200% - 34px));opacity:0}}'
      + '@keyframes dmgfDrop{0%{transform:translate(-50%,-150%);opacity:0}18%{transform:translate(-50%,-50%);opacity:1}30%{transform:translate(-50%,-80%)}42%{transform:translate(-50%,-50%)}52%{transform:translate(-50%,-62%)}62%{transform:translate(-50%,-50%)}85%{opacity:1}100%{transform:translate(-50%,calc(-50% - 34px));opacity:0}}'
      + '@keyframes dmgfDrift{0%{transform:translate(-50%,-50%);opacity:1}70%{opacity:1}100%{transform:translate(-20%,calc(-190% - 34px));opacity:0}}'
      + '@keyframes dmgfBurst{0%{transform:translate(-50%,-50%) scale(2.2);opacity:.2}12%{transform:translate(-50%,-50%) scale(1);opacity:1}70%{opacity:1}100%{transform:translate(-30%,calc(-170% - 34px)) scale(1);opacity:0}}'
      + '@keyframes dmgfShake{0%,100%{transform:none}25%{transform:translateX(-3px) rotate(-4deg)}75%{transform:translateX(3px) rotate(4deg)}}'
      + '@keyframes dmgfComic{0%{transform:translate(-50%,-50%) scale(.2) rotate(-12deg);opacity:0}12%{transform:translate(-50%,-55%) scale(1.3) rotate(-6deg);opacity:1}24%{transform:translate(-50%,-55%) scale(1) rotate(-6deg)}100%{transform:translate(10%,calc(-170% - 34px)) scale(1) rotate(-6deg);opacity:0}}'
      + '@keyframes dmgfSlide{0%{transform:translate(-130%,-50%);opacity:0}14%{transform:translate(-50%,-50%);opacity:1}75%{opacity:1}100%{transform:translate(-50%,calc(-160% - 34px));opacity:0}}'
      + '@keyframes dmgfInk{0%{transform:translate(-50%,-50%) scale(1.25);opacity:0;filter:blur(3px)}18%{transform:translate(-50%,-50%) scale(1);opacity:1;filter:blur(0)}70%{opacity:1;filter:blur(0)}100%{transform:translate(-50%,calc(-110% - 34px)) scale(1.15);opacity:0;filter:blur(4px)}}'
      + '@keyframes dmgfSlam{0%{transform:translate(-50%,-190%) scale(1.6);opacity:0}16%{transform:translate(-50%,-50%) scale(1);opacity:1}22%{transform:translate(-46%,-50%)}28%{transform:translate(-54%,-50%)}34%{transform:translate(-50%,-50%)}75%{opacity:1}100%{transform:translate(-50%,calc(-130% - 34px));opacity:0}}'
      + '@keyframes dmgfGlitch{0%{transform:translate(-50%,-50%);opacity:0}8%{transform:translate(-46%,-50%) skewX(-12deg);opacity:1}14%{transform:translate(-54%,-52%) skewX(10deg)}20%{transform:translate(-50%,-55%) skewX(0)}80%{opacity:1}100%{transform:translate(-50%,calc(-170% - 34px));opacity:0}}'
      + '@keyframes dmgfFlicker{50%{opacity:.55}}@keyframes dmgfShimmer{from{background-position:0 0}to{background-position:200% 0}}'
      + '@keyframes dmgfTwinkle{from{opacity:.25;transform:scale(.6)}to{opacity:1;transform:scale(1.15)}}'
      + '@media (prefers-reduced-motion:reduce){[class*="dmgf-"] .vfx-dmg::before,[class*="dmgf-"] .vfx-dmg::after{animation:none!important}}'
      // 預覽：不飄、不消失
      + '.dmgf-pv{position:relative;height:64px;border-radius:8px;background:linear-gradient(#1e3a5f,#0f172a);display:flex;align-items:center;justify-content:center;gap:22px;overflow:hidden}'
      + '.dmgf-pv .vfx-dmg{position:relative!important;left:auto!important;top:auto!important;transform:none!important;animation:none!important;opacity:1!important}'
      + '.dmgf-pv .vfx-dmg.vfx-crit .vfx-dmg-value{animation:none!important}'
      + '[class*="dmgf-"] .vfx-dmg .vfx-dmg-value{position:relative}'
      + '[class*="dmgf-"] .vfx-dmg .vfx-dmg-ink{position:relative;display:inline-block;background:var(--dmgf-ink,none);background-size:var(--dmgf-ink-size,auto);background-position:inherit;-webkit-background-clip:text;background-clip:text}'
      + '[class*="dmgf-"] .vfx-dmg .vfx-dmg-glow{display:block!important;position:absolute;left:0;top:0;font-style:normal;white-space:nowrap;pointer-events:none;background:none;-webkit-text-fill-color:transparent;color:transparent;-webkit-text-stroke:0;text-shadow:var(--dmgf-glow,none)}'
      + '[class*="dmgf-"] .vfx-dmg .vfx-dmg-tag,[class*="dmgf-"] .vfx-dmg .dmgf-hits{text-shadow:var(--dmgf-glow,none)}'
      + '.dmgf-shop{padding:4px 2px;display:flex;flex-direction:column;gap:8px}'
      + '.dmgf-card{border:1px solid #6b21a8;border-radius:10px;background:#0f0a1acc;padding:8px}'
      + '.dmgf-card.on{border-color:#facc15;box-shadow:0 0 0 1px #facc15}'
      + '.dmgf-row{display:flex;align-items:center;gap:8px;margin-top:6px}.dmgf-row .nm{flex:1;min-width:0}.dmgf-row .nm b{color:#f5d0fe;font-size:15px}.dmgf-row .nm span{display:block;font-size:12px;color:#cbd5e1;line-height:1.4}'
      + '.dmgf-row button{min-width:84px;min-height:36px;border-radius:7px;border:1px solid #a855f7;background:#581c87;color:#fdf4ff;font-weight:800;cursor:pointer;padding:0 8px}'
      + '.dmgf-row button.use{background:#14532d;border-color:#22c55e}.dmgf-row button[disabled]{opacity:.45;cursor:not-allowed}'
      + '.dmgf-top{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#e9d5ff}.dmgf-msg{min-height:18px;font-size:12.5px;color:#fde68a}'
      + '.afk-pd-tabs{display:flex;gap:6px;justify-content:center;margin:4px 0 6px;flex-shrink:0}.afk-pd-tabs button{padding:6px 14px;border-radius:6px;border:1px solid #6b21a8;background:#1e1b2e;color:#d8b4fe;font-weight:700;font-size:14px}'
      + '.afk-bd-tabs button[aria-pressed="true"]{background:#7e22ce;color:#fff;border-color:#c084fc}';
    FONTS.forEach(function (f) { t += f.css(SEL(f.id), CRIT(f.id)); });
    s.textContent = t; document.head.appendChild(s);
  }

  // ── 繁星：中文單位 ──
  function zhNum(n) {
    n = Math.floor(Number(n) || 0);
    if (n >= 1e8) { var a = Math.floor(n / 1e8), b = Math.floor((n % 1e8) / 1e4); return a + '億' + (b ? ' ' + b + '萬' : ''); }
    if (n >= 1e4) { var c = Math.floor(n / 1e4), d = n % 1e4; return c + '萬' + (d ? ' ' + d : ''); }
    return String(n);
  }
  var avg = 0, hits = 0, lastHit = 0;   // 爆擊分級用的近期平均傷害；街機連段的連擊數
  function hookNumber() {
    if (typeof W._vfxNumber !== 'function' || W._vfxNumber._afkDmgf) return typeof W._vfxNumber === 'function';
    var o = W._vfxNumber;
    var nw = function (x, y, dmg, ele, big) {
      var r = o.apply(this, arguments);
      if (!r || ele === 'shield') return r;
      try {
        var cu = using(), u = !!(cu && FBY[cu].zh && document.body.classList.contains('dmgf-' + cu));
        if (cu && FBY[cu].two && ele !== 'miss' && typeof dmg === 'number') {   // 第二批：屬性顏色、爆擊分級、連擊數
          r.classList.add('dmgf-e-' + (ele && /^(fire|water|wind|earth|magic)$/.test(ele) ? ele : 'normal'));
          if (big === 'crit' && avg > 0 && dmg >= avg * 2.5) r.classList.add('dmgf-t3');
          avg = avg ? avg * 0.95 + dmg * 0.05 : dmg;
          if (cu === 'arcade') {
            var nowT = Date.now();
            hits = nowT - lastHit < 1500 ? hits + 1 : 1;
            lastHit = nowT;
            if (hits >= 2) {
              var hs = r.dmCombo || (r.dmCombo = document.createElement('span'));
              hs.className = 'dmgf-hits';
              hs.textContent = hits + ' HITS';
              r.appendChild(hs);
            }
          }
        }   // 用中文單位的字體（繁星、泡泡彩虹）
        if (u && ele !== 'miss' && typeof dmg === 'number' && dmg >= 1e4) {
          r.dmValue.data = zhNum(dmg);
        }
      } catch (e) {}
      return r;
    };
    nw._afkDmgf = true;
    W._vfxNumber = nw;
    try { (0, eval)('_vfxNumber = window._vfxNumber'); } catch (e) {}
    return true;
  }

  // ── 黑市分頁（跟 afk-blooddia 的「商品／血龍鑽兌換」同一排；沒有那排就自己放一排） ──
  var tab = 'market', msg = '';
  function pv(id, extra) {
    var c = id ? ' dmgf-' + id : '';
    var zh = id && FBY[id] && FBY[id].zh, big = zh ? '1億 2345萬' : '123456', nrm = zh ? '2萬 3456' : '23456';
    var two = id && FBY[id] && FBY[id].two;   // 第二批：多一個重擊、顯示屬性顏色／爆擊分級／連擊數
    if (two) return '<div class="dmgf-pv' + c + '"' + (extra || '') + '><div class="vfx-dmg dmgf-e-fire" style="font-size:20px;color:#ff7a45">' + INK(nrm) + (id === 'arcade' ? '<span class="dmgf-hits">7 HITS</span>' : '') + '</div><div class="vfx-dmg vfx-crit vfx-heavy dmgf-e-water" style="font-size:26px;color:#ffd54f"><span class="vfx-dmg-tag">重擊</span><span class="vfx-dmg-value">' + INK('58210') + '</span></div><div class="vfx-dmg vfx-crit vfx-critical dmgf-t3 dmgf-e-wind" style="font-size:32px;color:#ff3b30"><span class="vfx-dmg-tag">爆擊</span><span class="vfx-dmg-value">' + INK(big) + '</span></div></div>';
    return '<div class="dmgf-pv' + c + '"' + (extra || '') + '><div class="vfx-dmg" style="font-size:20px;color:#f1f5f9">' + INK(nrm) + '</div><div class="vfx-dmg vfx-crit vfx-critical" style="font-size:32px;color:#ff3b30"><span class="vfx-dmg-tag">爆擊</span><span class="vfx-dmg-value">' + INK(big) + '</span></div></div>';
  }
  function shopHtml() {
    var u = using();
    var h = '<div class="dmgf-shop"><div class="dmgf-top"><span>🔤 字體販賣所・只換你打出去的傷害數字</span><span>💎 ' + (diaReady() ? fmt(dia()) : '—') + '</span></div>';
    h += '<div class="dmgf-msg" id="dmgf-msg">' + esc(msg) + '</div>';
    h += '<div class="dmgf-card' + (u ? '' : ' on') + '">' + pv('') + '<div class="dmgf-row"><div class="nm"><b>經典</b><span>遊戲原本的傷害字體，永遠免費。</span></div><button type="button" class="use" data-dmgf="use:"' + (u ? '' : ' disabled') + '>' + (u ? '換回' : '使用中') + '</button></div></div>';
    FONTS.forEach(function (f) {
      var own = isOwned(f.id), cur = u === f.id;
      h += '<div class="dmgf-card' + (cur ? ' on' : '') + '">' + pv(f.id) + '<div class="dmgf-row"><div class="nm"><b>' + esc(f.n) + '</b><span>' + esc(f.d) + '</span></div>'
        + (own ? '<button type="button" class="use" data-dmgf="use:' + f.id + '"' + (cur ? ' disabled' : '') + '>' + (cur ? '使用中' : '使用') + '</button>'
          : '<button type="button" data-dmgf="buy:' + f.id + '"' + (diaReady() && dia() >= f.price ? '' : ' disabled') + '>💎 ' + fmt(f.price) + '</button>') + '</div></div>';
    });
    return h + '<div class="gh-sm" style="font-size:11.5px;color:#94a3b8">買一次全帳號共用（所有角色都能用）。「未命中」維持原樣。</div></div>';
  }
  function decorate(div) {
    if (!div || !on() || classic()) return;
    var panel = div.querySelector('.pandora-market-panel'); if (!panel) return;
    css();
    var title = panel.querySelector('.pandora-market-title');
    var tabs = panel.querySelector('.afk-bd-tabs');
    if (!tabs) {
      tabs = document.createElement('div'); tabs.className = 'afk-bd-tabs afk-pd-tabs'; tabs.setAttribute('role', 'tablist');
      tabs.innerHTML = '<button type="button" role="tab" data-pdt="market" aria-pressed="' + (tab === 'market') + '">商品</button>';
      if (title && title.nextSibling) panel.insertBefore(tabs, title.nextSibling); else panel.insertBefore(tabs, panel.firstChild);
    }
    // 11-16：「交易所」改由 afk-trade 提供（寄賣攤，掛在 afk-blooddia 的分頁列），這裡不再放「準備中」的空分頁
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('data-pdt', 'font'); b.textContent = '字體販賣所';
    tabs.appendChild(b);
    tabs.addEventListener('click', function (ev) {   // 按到血龍鑽那邊的分頁 → 我們退回「不是字體頁」
      var t = ev.target.closest('[data-bdtab],[data-pdt]'); if (!t) return;
      if (t.hasAttribute('data-bdtab')) { tab = 'market'; return; }
      ev.stopPropagation(); tab = t.getAttribute('data-pdt'); msg = ''; rerender(div);
    }, true);
    if (tab === 'font') {
      Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      Array.prototype.forEach.call(panel.children, function (c) { if (c !== title && c !== tabs) c.style.display = 'none'; });
      var box = document.createElement('div'); box.innerHTML = shopHtml(); var pg = box.firstChild; panel.appendChild(pg);
      pg.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-dmgf]'); if (!t || t.disabled) return;
        var a = t.getAttribute('data-dmgf').split(':');
        if (a[0] === 'buy') {
          var f = FBY[a[1]];
          if (!t.hasAttribute('data-sure')) { t.setAttribute('data-sure', '1'); t.textContent = '確定購買？'; msg = '再按一次確定，花 ' + fmt(f.price) + ' 顆龍之鑽石買「' + f.n + '」。'; var m = el('dmgf-msg'); if (m) m.textContent = msg; return; }
          var e = buy(a[1]); msg = e || ('買好了「' + f.n + '」，已經換上。'); return rerender(div);
        }
        if (a[0] === 'use') { LS(K_USE, a[1] || ''); apply(); msg = a[1] ? '換上「' + FBY[a[1]].n + '」。' : '換回經典字體。'; rerender(div); }
      });
    } else { b.setAttribute('aria-pressed', 'false'); }
  }
  function rerender(div) { try { W.pandoraRenderMarket(div); } catch (e) { console.warn('[AFK-dmgfont]', e); } }
  function hookMarket() {
    if (typeof W.pandoraRenderMarket !== 'function') return false;
    if (W.pandoraRenderMarket._afkDmgf) return true;
    var o = W.pandoraRenderMarket;
    var nw = function (div) { var r = o.apply(this, arguments); try { decorate(div); } catch (e) { console.warn('[AFK-dmgfont] 黑市分頁', e); } return r; };
    nw._afkDmgf = true;
    W.pandoraRenderMarket = nw;
    try { (0, eval)('pandoraRenderMarket = window.pandoraRenderMarket'); } catch (e) {}
    return true;
  }

  W.__afkDmgFont = { FONTS: FONTS, owned: owned, using: using, buy: buy, apply: apply, zhNum: zhNum, on: on, pv: pv };
  if (!on()) return;
  var tries = 0;
  (function boot() {
    var a = hookNumber(), b = hookMarket();
    if (a && b) return;
    if (++tries < 40) setTimeout(boot, 500);
  })();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  if (typeof W.loadGame === 'function' && !W.loadGame._afkDmgf) {
    var oLoad = W.loadGame;
    W.loadGame = function () { var r = oLoad.apply(this, arguments); setTimeout(function () { try { apply(); } catch (e) {} }, 300); return r; };
    W.loadGame._afkDmgf = true;
  }
  setInterval(function () { try { var b = document.body, u = using(); if (u && !classic() && !b.classList.contains('dmgf-' + u)) apply(); } catch (e) {} }, 5000);
  console.log('[AFK-dmgfont] 已啟用：傷害字體 ' + FONTS.length + ' 款');
})();
