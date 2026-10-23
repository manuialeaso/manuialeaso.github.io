/* ==========================================================================
 * afk-cloth-art.js — 十二星座聖衣的背飾（玩家 2026-10-23：12 星座都不同、要像私服的粗像素）
 *
 * 造型：以「星座本身的象徵」原創設計（羊角、牛角、雙子披風、蟹螯、獅鬃、蓮華光輪、天秤、蠍尾、
 *   羽翼、山羊角與聖劍、水流冰晶、雙魚與玫瑰），不照抄任何作品。
 * 畫法：先用向量畫好每一格動畫（phase 0～1），再在「角色像素大小 ÷ 3」的解析度點陣化：
 *   硬邊透明、明暗只留 5 階（保留原本的色相，白披風還是白、水流還是藍）、1 格深色外框，
 *   最後整條動畫幀排成一張圖，用 CSS steps() 一格一格播（跟角色 sprite 同樣的感覺）。
 * 座標：肩膀中點在 (0,0)，往上為負；1 單位 ≈ 角色身高的 1%。
 * 由 afk-card-forms 取用：window.AFK_CLOTH_ART.strip(zodiac, 寬, 高, 封印, callback)
 * ========================================================================== */
(function () {
  'use strict';
  var PX = function () { return window.__afkClothPx || 3; };   // 一個點放大幾倍（玩家選 3 倍）
  var f = function (v) { return (Math.round(v * 10) / 10).toString(); };
  var GOLD = 'url(#ZZ-g)', GOLD2 = 'url(#ZZ-h)', LINE = '#6b3f08';
  var MIN = 0;   // 點陣化時最細線寬（單位），每次產生時設定
  var defs = function () {
    return '<defs><linearGradient id="ZZ-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffbe6"/><stop offset=".45" stop-color="#f8cf55"/><stop offset="1" stop-color="#b9781a"/></linearGradient>'
      + '<linearGradient id="ZZ-h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#e2a92f"/></linearGradient>'
      + '<linearGradient id="ZZ-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf5"/><stop offset="1" stop-color="#cfc8b4"/></linearGradient>'
      + '<linearGradient id="ZZ-s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d1d5db"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#9ca3af"/></linearGradient>'
      + '<linearGradient id="ZZ-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0f7ff"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs>';
  };
  var mirror = function (inner) { return '<g>' + inner + '</g><g transform="scale(-1 1)">' + inner + '</g>'; };
  var path = function (d, fill, sw, extra) { return '<path d="' + d + '" fill="' + (fill || GOLD) + '" stroke="' + LINE + '" stroke-width="' + f(Math.max(sw || 1, MIN * .3)) + '" stroke-linejoin="round"' + (extra || '') + '/>'; };
  var line = function (d, w, c) { return '<path d="' + d + '" fill="none" stroke="' + (c || GOLD) + '" stroke-width="' + f(Math.max(w, MIN)) + '" stroke-linecap="round"/>'; };
  // 粗線：向量時是深色描邊＋金色芯；點陣化時外框交給 pixelize，只畫夠粗的金色
  var thick = function (d, w) { if (MIN) return line(d, Math.max(w * 1.3, MIN * 1.7), '#e8b545');   /* 水平／垂直線沒有高度，漸層會失效，用純色 */ return line(d, w + 2.4, LINE) + line(d, w, GOLD2); };
  var ring = function (cx, cy, r, w, c, dash) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + c + '" stroke-width="' + f(Math.max(w, MIN)) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'; };
  var rot = function (a, cx, cy) { return 'rotate(' + f(a) + ' ' + cx + ' ' + cy + ')'; };
  var wave = function (p) { return Math.sin(p * Math.PI * 2); };
  // 披風：肩寬 a、下擺寬 b、長度 h；下擺隨 phase 輕輕飄
  var cape = function (a, b, h, fill, p, trim) {
    var s = wave(p || 0) * 3;
    var d = 'M' + f(-a) + ' -2 Q0 -8 ' + f(a) + ' -2 L' + f(b + s) + ' ' + f(h) + ' Q' + f(b * .5) + ' ' + f(h + 6) + ' 0 ' + f(h - 2) + ' Q' + f(-b * .5) + ' ' + f(h + 6) + ' ' + f(-b + s) + ' ' + f(h) + 'Z';
    return path(d, fill || 'url(#ZZ-c)', 1) + (trim === false ? '' : line('M' + f(-b + s) + ' ' + f(h) + ' Q' + f(-b * .5) + ' ' + f(h + 6) + ' 0 ' + f(h - 2) + ' Q' + f(b * .5) + ' ' + f(h + 6) + ' ' + f(b + s) + ' ' + f(h), 2.2, GOLD2));
  };
  var spiral = function (cx, cy, r0, turns, dir) {
    var pts = [], n = 40; for (var i = 0; i <= n; i++) { var t = i / n, a = dir * (t * turns * Math.PI * 2) - Math.PI / 2, r = r0 * (1 - t * .78); pts.push(f(cx + Math.cos(a) * r) + ' ' + f(cy + Math.sin(a) * r)); }
    return 'M' + pts.join(' L');
  };
  var feathers = function () {   // 射手座的羽翼（單邊，往右，肩膀在原點）
    var P = function (t) { var u = 1 - t; return [2 * u * t * 34 + t * t * 78, 2 * u * t * -62 + t * t * -70]; }, out = '';
    var layer = function (n, lenA, lenB, angA, angB, w, grad, shift) {
      for (var i = n - 1; i >= 0; i--) {
        var t = shift + (1 - shift) * i / (n - 1), r = P(t), a = (angA + (angB - angA) * i / (n - 1)) * Math.PI / 180, len = lenA + (lenB - lenA) * i / (n - 1);
        var tx = r[0] + Math.cos(a) * len, ty = r[1] + Math.sin(a) * len, nx = -Math.sin(a) * w, ny = Math.cos(a) * w, mx = r[0] + Math.cos(a) * len * .55, my = r[1] + Math.sin(a) * len * .55;
        out += path('M' + f(r[0] - nx * .5) + ' ' + f(r[1] - ny * .5) + ' Q' + f(mx - nx) + ' ' + f(my - ny) + ' ' + f(tx - nx * .35) + ' ' + f(ty - ny * .35) + ' Q' + f(tx + Math.cos(a) * 3) + ' ' + f(ty + Math.sin(a) * 3) + ' ' + f(tx + nx * .35) + ' ' + f(ty + ny * .35) + ' Q' + f(mx + nx) + ' ' + f(my + ny) + ' ' + f(r[0] + nx * .5) + ' ' + f(r[1] + ny * .5) + 'Z', grad, .9);
      }
    };
    layer(11, 40, 88, 100, -22, 9.5, GOLD, .12); layer(8, 22, 38, 92, -5, 8, GOLD2, .08);
    return out + thick('M0 0 Q34 -62 78 -70', 4.5);
  };
  // 通用翼：翼骨（肩→腕）上排一列羽片；shape＝feather 羽毛／blade 刀刃／fin 魚鰭；layers＝[{n,lenA,lenB,angA,angB,w,fill,shift}]
  var wingOf = function (shape, layers, arm, armFill) {
    arm = arm || [34, -62, 78, -70];
    var P = function (t) { var u = 1 - t; return [2 * u * t * arm[0] + t * t * arm[2], 2 * u * t * arm[1] + t * t * arm[3]]; }, out = '';
    layers.forEach(function (L) {
      for (var i = L.n - 1; i >= 0; i--) {
        var k = L.n > 1 ? i / (L.n - 1) : 0, t = L.shift + (1 - L.shift) * k, r = P(t), a = (L.angA + (L.angB - L.angA) * k) * Math.PI / 180, len = L.lenA + (L.lenB - L.lenA) * k, w = L.w;
        var cx = Math.cos(a), sy = Math.sin(a), nx = -sy * w, ny = cx * w, tx = r[0] + cx * len, ty = r[1] + sy * len;
        var at = function (q, side) { return [r[0] + cx * len * q + nx * side, r[1] + sy * len * q + ny * side]; };
        var P2 = function (v) { return f(v[0]) + ' ' + f(v[1]); };
        var fill = typeof L.fill === 'function' ? L.fill(i) : L.fill;
        if (shape === 'blade') {   // 刀刃：窄根、直刃、尖端＋護手
          out += path('M' + P2(at(0, -.35)) + ' L' + P2(at(.78, -.55)) + ' L' + f(tx) + ' ' + f(ty) + ' L' + P2(at(.78, .55)) + ' L' + P2(at(0, .35)) + 'Z', fill, .9)
            + path('M' + P2(at(.08, -.75)) + ' L' + P2(at(.14, -.75)) + ' L' + P2(at(.14, .75)) + ' L' + P2(at(.08, .75)) + 'Z', GOLD2, .7);
        } else if (shape === 'fin') {   // 魚鰭：寬、圓弧尖、中間一條鰭骨
          out += path('M' + P2(at(0, -.4)) + ' Q' + P2(at(.55, -1.25)) + ' ' + P2(at(1, -.5)) + ' Q' + f(tx + cx * 4) + ' ' + f(ty + sy * 4) + ' ' + P2(at(1, .5)) + ' Q' + P2(at(.55, 1.25)) + ' ' + P2(at(0, .4)) + 'Z', fill, .9)
            + line('M' + f(r[0]) + ' ' + f(r[1]) + ' L' + f(tx) + ' ' + f(ty), 1.2, LINE);
        } else {   // 羽毛
          out += path('M' + P2(at(0, -.5)) + ' Q' + P2(at(.55, -1)) + ' ' + P2(at(1, -.35)) + ' Q' + f(tx + cx * 3) + ' ' + f(ty + sy * 3) + ' ' + P2(at(1, .35)) + ' Q' + P2(at(.55, 1)) + ' ' + P2(at(0, .5)) + 'Z', fill, .9);
        }
      }
    });
    var d = 'M0 0 Q' + arm[0] + ' ' + arm[1] + ' ' + arm[2] + ' ' + arm[3];
    return out + (armFill ? (MIN ? line(d, Math.max(5.8, MIN * 1.7), armFill) : line(d, 6.9, LINE) + line(d, 4.5, armFill)) : thick(d, 4.5));
  };
  var flapPair = function (p, right, left, amp, sc) {   // 左右一對、跟著 phase 拍動
    var a = -(amp || 10) * (1 - Math.cos(p * Math.PI * 2)) / 2; sc = sc || .82;
    return '<g transform="scale(' + sc + ') ' + rot(a, 0, 0) + '">' + right + '</g><g transform="scale(' + (-sc) + ' ' + sc + ') ' + rot(a, 0, 0) + '">' + (left || right) + '</g>';
  };
  // 每個星座：draw(p) 畫 phase p 那一格；frames 幀數、dur 一輪秒數
  var ART = {
    aries: { frames: 6, dur: 1.8, draw: function (p) {   // 白羊座：金色羽翼，翼根各一枚往外捲的羊角
      var wing = wingOf('feather', [{ n: 9, lenA: 38, lenB: 82, angA: 100, angB: -24, w: 9.5, fill: GOLD, shift: .12 }, { n: 6, lenA: 22, lenB: 34, angA: 92, angB: -4, w: 8, fill: GOLD2, shift: .08 }]);
      // 羊角移到頭頂兩側（不會被身體擋住）
      return flapPair(p, wing, null, 9, .8) + mirror(line(spiral(22, -58, 13, 1.5, 1), 7, '#efe6cc') + path('M6 -40 Q10 -54 20 -66 L25 -61 Q15 -50 12 -38Z', '#efe6cc'));   /* 象牙白羊角，跟金翼區隔 */
    } },
    taurus: { frames: 6, dur: 1.8, draw: function (p) {   // 金牛座：厚重的寬甲翼（大片金板），肩上一對往上彎的牛角
      var plates = wingOf('fin', [{ n: 5, lenA: 40, lenB: 76, angA: 98, angB: -20, w: 15, fill: function (i) { return i % 2 ? GOLD2 : GOLD; }, shift: .12 }]);
      // 牛角移到頭頂兩側往上彎
      return flapPair(p, plates, null, 5, .8) + mirror(path('M6 -42 Q24 -46 34 -62 Q40 -74 36 -90 Q50 -72 46 -56 Q38 -38 10 -34Z', '#f1e7cf', 1.2));   /* 象牙白牛角 */
    } },
    gemini: { frames: 8, dur: 2.4, draw: function (p) {   // 雙子座：一金一夜藍、左右不同色的雙生羽翼，頭後兩個互繞的光環
      var a = p * Math.PI * 2, dx = Math.cos(a) * 9, dy = Math.sin(a) * 2.5;
      var gold = wingOf('feather', [{ n: 9, lenA: 38, lenB: 82, angA: 100, angB: -24, w: 9.5, fill: GOLD, shift: .12 }, { n: 6, lenA: 22, lenB: 34, angA: 92, angB: -4, w: 8, fill: GOLD2, shift: .08 }]);
      var night = wingOf('feather', [{ n: 9, lenA: 38, lenB: 82, angA: 100, angB: -24, w: 9.5, fill: '#16204a', shift: .12 }, { n: 6, lenA: 22, lenB: 34, angA: 92, angB: -4, w: 8, fill: '#2e3f86', shift: .08 }], null, '#475a9e');
      return flapPair(p, gold, night, 9, .8) + ring(f(-dx), f(-44 - dy), 14, 3.5, GOLD2) + ring(f(dx), f(-44 + dy), 14, 3.5, '#3b4f9a');
    } },
    cancer: { frames: 6, dur: 1.6, draw: function (p) {   // 巨蟹座：橘金色的甲殼翼，翼尖一支會開合的蟹螯
      var o = (wave(p) + 1) * 4;
      var shell = wingOf('fin', [{ n: 5, lenA: 38, lenB: 66, angA: 100, angB: -10, w: 12, fill: function (i) { return i % 2 ? '#f59e0b' : GOLD; }, shift: .12 }]);
      var claw = '<g transform="' + rot(-o, 78, -70) + '">' + path('M74 -66 Q70 -96 90 -108 Q86 -90 92 -78Z') + '</g><g transform="' + rot(o, 78, -70) + '">' + path('M80 -72 Q104 -84 112 -106 Q116 -82 92 -66Z', GOLD2) + '</g>';
      return flapPair(p, shell + claw, null, 6, .74);
    } },
    leo: { frames: 6, dur: 1.5, draw: function (p) {   // 獅子座：火焰般尖羽的橘金羽翼，頭後一圈小獅鬃光芒
      var wing = wingOf('blade', [{ n: 9, lenA: 36, lenB: 84, angA: 100, angB: -24, w: 8, fill: function (i) { return i % 2 ? '#f97316' : GOLD; }, shift: .12 }]);
      var mane = '<g transform="' + rot(30 * p, 0, -36) + '">';
      for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2, r1 = 12, r2 = i % 2 ? 24 : 32, w = .22;
        mane += path('M' + f(Math.cos(a - w) * r1) + ' ' + f(-36 + Math.sin(a - w) * r1) + ' L' + f(Math.cos(a) * r2) + ' ' + f(-36 + Math.sin(a) * r2) + ' L' + f(Math.cos(a + w) * r1) + ' ' + f(-36 + Math.sin(a + w) * r1) + 'Z', i % 2 ? '#f97316' : GOLD, .8); }
      return mane + '</g>' + flapPair(p, wing, null, 9, .8);
    } },
    virgo: { frames: 6, dur: 2.4, draw: function (p) {   // 處女座：象牙白鑲金的羽翼，頭後一朵轉動的蓮華光輪
      var wing = wingOf('feather', [{ n: 9, lenA: 38, lenB: 82, angA: 100, angB: -24, w: 9.5, fill: 'url(#ZZ-c)', shift: .12 }, { n: 6, lenA: 22, lenB: 34, angA: 92, angB: -4, w: 8, fill: GOLD2, shift: .08 }]);
      var lotus = '<g transform="' + rot(45 * p, 0, -38) + '">';
      for (var i = 0; i < 8; i++) lotus += '<g transform="' + rot(i * 45, 0, -38) + '">' + path('M0 -38 Q-7 -50 0 -62 Q7 -50 0 -38Z', i % 2 ? GOLD2 : GOLD, .8) + '</g>';
      return flapPair(p, wing, null, 8, .8) + lotus + '</g><circle cx="0" cy="-38" r="6" fill="' + GOLD + '" stroke="' + LINE + '"/>';
    } },
    libra: { frames: 8, dur: 3.2, draw: function (p) {   // 天秤座：刃形羽翼，兩邊翼尖各吊一個擺動的秤盤
      var sw = 6 * wave(p);
      var pan = '<g transform="' + rot(sw, 78, -70) + '">' + line('M78 -70 L68 -40 M78 -70 L88 -40', 1.4, LINE) + path('M62 -40 Q78 -28 94 -40Z') + '</g>';
      var wing = wingOf('blade', [{ n: 8, lenA: 36, lenB: 76, angA: 100, angB: -20, w: 7.5, fill: function (i) { return i % 2 ? GOLD2 : GOLD; }, shift: .12 }]);
      return flapPair(p, wing + pan, null, 5, .8) + path('M-7 -40 L0 -54 L7 -40 L0 -34Z');
    } },
    scorpio: { frames: 8, dur: 2.4, draw: function (p) {   // 天蠍座：深紅與金交錯的節狀刃翼，背後翹起一條小蠍尾
      var wing = wingOf('blade', [{ n: 8, lenA: 38, lenB: 80, angA: 100, angB: -22, w: 7.5, fill: function (i) { return i % 2 ? '#991b1b' : GOLD; }, shift: .12 }]);
      // 蠍尾從背後越過頭頂高高翹起
      var tail = '<g transform="' + rot(6 * wave(p), 4, -20) + '">', pts = [[4, -20], [14, -34], [20, -50], [18, -66], [10, -80], [-2, -88], [-14, -90]];
      pts.forEach(function (q, i) { var r = 8 - i * .7; tail += '<ellipse cx="' + q[0] + '" cy="' + q[1] + '" rx="' + f(r) + '" ry="' + f(r * .82) + '" fill="' + (i % 2 ? GOLD2 : GOLD) + '" stroke="' + LINE + '"/>'; });
      tail += path('M-16 -94 Q-32 -96 -36 -82 Q-28 -88 -16 -84Z', '#b91c1c') + '</g>';
      return flapPair(p, wing, null, 8, .8) + tail;
    } },
    sagittarius: { frames: 6, dur: 1.6, draw: function (p) {   // 射手座：黃金羽翼（拍動）
      var a = -10 * (1 - Math.cos(p * Math.PI * 2)) / 2;
      return '<g transform="scale(.82) ' + rot(a, 0, 0) + '">' + feathers() + '</g><g transform="scale(-.82 .82) ' + rot(a, 0, 0) + '">' + feathers() + '</g>';
    } },
    capricorn: { frames: 6, dur: 1.8, draw: function (p) {   // 摩羯座：一片片聖劍排成的刃翼＋往後掠的大山羊角
      var blades = wingOf('blade', [{ n: 7, lenA: 44, lenB: 86, angA: 96, angB: -26, w: 7, fill: 'url(#ZZ-s)', shift: .15 }], [30, -52, 70, -62]);
      // 山羊角移到頭頂，往後掠
      return flapPair(p, blades, null, 6, .8) + mirror(path('M4 -44 Q18 -76 46 -78 Q66 -76 74 -56 Q58 -68 42 -66 Q24 -62 10 -38Z', '#7a4a22', 1.2));   /* 深褐山羊角，跟銀刃翼區隔 */
    } },
    aquarius: { frames: 8, dur: 2.4, draw: function (p) {   // 水瓶座：冰晶與水流化成的羽翼，羽尖結晶；頭上旋轉的冰晶
      var ice = wingOf('feather', [{ n: 9, lenA: 36, lenB: 80, angA: 102, angB: -22, w: 9, fill: 'url(#ZZ-w)', shift: .12 }, { n: 6, lenA: 20, lenB: 32, angA: 92, angB: -4, w: 7.5, fill: '#e0f7ff', shift: .08 }], null, '#bae6fd');
      var tips = ''; for (var i = 0; i < 5; i++) { var a = (-22 + i * 22) * Math.PI / 180, x = 78 + Math.cos(a) * 72, y = -70 + Math.sin(a) * 72; tips += path('M' + f(x) + ' ' + f(y - 6) + ' L' + f(x + 4) + ' ' + f(y) + ' L' + f(x) + ' ' + f(y + 6) + ' L' + f(x - 4) + ' ' + f(y) + 'Z', '#f0fbff', .8); }
      var star = ''; for (var j = 0; j < 6; j++) star += '<g transform="' + rot(j * 60, 0, -66) + '">' + line('M0 -66 L0 -80 M0 -75 L-4 -79 M0 -75 L4 -79', 2.4, '#e0f2fe') + '</g>';
      return flapPair(p, ice + tips, null, 7, .74) + '<g transform="' + rot(60 * p, 0, -66) + '">' + star + '<circle cx="0" cy="-66" r="3.5" fill="#fff"/></g>';
    } },
    pisces: { frames: 8, dur: 3.2, draw: function (p) {   // 雙魚座：珊瑚色的魚鰭翼（波動），鰭根綴玫瑰，兩條小魚繞著頭游
      var w = wave(p) * 4;
      var fins = wingOf('fin', [{ n: 5, lenA: 46, lenB: 80, angA: 96, angB: -18, w: 13, fill: function (i) { return i % 2 ? '#f9a8b8' : '#fb7185'; }, shift: .1 }], [30, -54, 70, -64 + w], GOLD2);
      var rose = function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="4.6" fill="#e11d48" stroke="#7f1d1d" stroke-width="1"/><circle cx="' + x + '" cy="' + y + '" r="2" fill="#fecdd3"/>'; };
      var fish = function (r, col) { return '<g transform="' + rot(r, 0, -40) + '">' + path('M0 -70 Q12 -76 22 -70 Q12 -64 0 -70Z', col, .9) + path('M22 -70 L30 -76 L28 -70 L30 -64Z', col, .9) + '</g>'; };
      return flapPair(p, fins + rose(30, -50) + rose(58, -62), null, 5, .78) + fish(180 * p, GOLD) + fish(180 * p + 180, GOLD2);
    } },
  };
  var BOX = { x: -110, y: -120, w: 220, h: 190 };   // 肩膀在方框內 (110,120)
  function frameSvg(z, p, minLine) {
    MIN = minLine || 0;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + BOX.x + ' ' + BOX.y + ' ' + BOX.w + ' ' + BOX.h + '" width="' + BOX.w + '" height="' + BOX.h + '">' + defs() + ART[z].draw(p) + '</svg>';
    MIN = 0;
    return s.replace(/ZZ-/g, 'cb' + z + '-');
  }
  // ── 點陣化：保留色相，明暗分 5 階；1 格深色外框；封印＝灰階偏暗 ──
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255; var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0;
    if (mx !== mn) { var d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    if (!s) { var v = Math.round(l * 255); return [v, v, v]; }
    var q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    var c = function (t) { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [Math.round(c(h + 1 / 3) * 255), Math.round(c(h) * 255), Math.round(c(h - 1 / 3) * 255)];
  }
  var BANDS = [[.32, .24], [.5, .4], [.66, .56], [.82, .72], [2, .9]];
  function pixelize(ctx, w, h, sealed) {
    var img = ctx.getImageData(0, 0, w, h), d = img.data, solid = new Uint8Array(w * h);
    for (var q = 0; q < w * h; q++) {
      var i = q * 4; if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
      solid[q] = 1;
      var hsl = rgb2hsl(d[i], d[i + 1], d[i + 2]), L = hsl[2], band = BANDS[BANDS.length - 1][1];
      for (var k = 0; k < BANDS.length; k++) if (L < BANDS[k][0]) { band = BANDS[k][1]; break; }
      var c = sealed ? hsl2rgb(0, 0, band * .78) : hsl2rgb(hsl[0], Math.min(.85, hsl[1]), band);
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    var oc = sealed ? [18, 18, 22] : [40, 20, 6];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var n = y * w + x; if (solid[n]) continue;
      if ((x > 0 && solid[n - 1]) || (x < w - 1 && solid[n + 1]) || (y > 0 && solid[n - w]) || (y < h - 1 && solid[n + w])) { var j = n * 4; d[j] = oc[0]; d[j + 1] = oc[1]; d[j + 2] = oc[2]; d[j + 3] = 235; }
    }
    ctx.putImageData(img, 0, 0);
  }
  var cache = {};
  // 產生整條動畫幀（橫排），回呼 {url, frames, dur, cw, ch}；w,h＝顯示像素大小
  function strip(z, w, h, sealed, done) {
    if (!ART[z]) z = 'sagittarius';
    var px = PX(), cw = Math.max(8, Math.round(w / px)), ch = Math.max(8, Math.round(h / px)), def = ART[z];
    var frames = sealed ? 1 : def.frames, key = z + '|' + cw + 'x' + ch + '|' + px + (sealed ? 's' : '');
    var e = cache[key];
    if (e && e.ready) { done(e.out); return; }
    if (e) { e.wait.push(done); return; }
    e = cache[key] = { ready: false, wait: [done] };
    var c = document.createElement('canvas'); c.width = cw * frames; c.height = ch;
    var ctx = c.getContext('2d', { willReadFrequently: true }), left = frames, unit = BOX.w / cw;   // 一格像素＝幾個單位
    var finish = function () {
      pixelize(ctx, c.width, c.height, sealed);
      var url = ''; try { url = c.toDataURL('image/png'); } catch (err) {}
      e.out = { url: url, frames: frames, dur: def.dur, cw: cw, ch: ch }; e.ready = true;
      e.wait.forEach(function (fn) { try { fn(e.out); } catch (err) {} }); e.wait = [];
    };
    for (var i = 0; i < frames; i++) (function (i) {
      var im = new Image();
      im.onload = function () {
        // 斜 45 度：整體稍微壓扁（往後倒的感覺）
        ctx.save(); ctx.translate(i * cw, ch * .06); ctx.scale(1, .94); ctx.drawImage(im, 0, 0, cw, ch); ctx.restore();
        if (--left === 0) finish();
      };
      im.onerror = function () { if (--left === 0) finish(); };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(frameSvg(z, i / frames, unit * 1.15));
    })(i);
  }
  window.AFK_CLOTH_ART = { strip: strip, frameSvg: frameSvg, zodiacs: Object.keys(ART), box: { w: BOX.w, h: BOX.h, sx: -BOX.x, sy: -BOX.y, syFrac: .06 + .94 * (-BOX.y / BOX.h) } };
})();
