/* ==========================================================================
 * afk-cloth-art.js — 輪迴十二星座聖衣的背飾（玩家 2026-10-23：12 星座都不同）
 *
 * 以「星座本身的象徵」原創設計（羊角、牛角、雙子披風、蟹螯、獅鬃、蓮華光輪、天秤、蠍尾、
 * 羽翼、山羊角與聖劍、水流冰晶、雙魚與玫瑰），不照抄任何作品的造型。
 * 座標：肩膀中點在 (0,0)，往上為負；1 單位 ≈ 角色身高的 1%。全部 SVG，不需下載圖檔。
 * 由 afk-card-forms 的 decorate 取用：window.AFK_CLOTH_ART.svg(zodiac)
 * ========================================================================== */
(function () {
  'use strict';
  var f = function (v) { return (Math.round(v * 10) / 10).toString(); };
  var GOLD = 'url(#ZZ-g)', GOLD2 = 'url(#ZZ-h)', LINE = '#6b3f08';
  var defs = function (extra) {
    return '<defs><linearGradient id="ZZ-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffbe6"/><stop offset=".45" stop-color="#f8cf55"/><stop offset="1" stop-color="#b9781a"/></linearGradient>'
      + '<linearGradient id="ZZ-h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#e2a92f"/></linearGradient>'
      + '<linearGradient id="ZZ-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf5"/><stop offset="1" stop-color="#d8d2c0"/></linearGradient>' + (extra || '') + '</defs>';
  };
  var mirror = function (inner) { return '<g>' + inner + '</g><g transform="scale(-1 1)">' + inner + '</g>'; };
  var path = function (d, fill, sw, extra) { return '<path d="' + d + '" fill="' + (fill || GOLD) + '" stroke="' + LINE + '" stroke-width="' + (sw || 1) + '" stroke-linejoin="round"' + (extra || '') + '/>'; };
  var line = function (d, w, c, extra) { return '<path d="' + d + '" fill="none" stroke="' + (c || GOLD) + '" stroke-width="' + w + '" stroke-linecap="round"' + (extra || '') + '/>'; };
  var thick = function (d, w) { return line(d, w + 2.4, LINE) + line(d, w, GOLD2); };
  // 披風：肩寬 a、下擺寬 b、長度 h，顏色 fill
  var cape = function (a, b, h, fill, trim) {
    var d = 'M' + f(-a) + ' -2 Q0 -8 ' + f(a) + ' -2 L' + f(b) + ' ' + f(h) + ' Q' + f(b * .5) + ' ' + f(h + 6) + ' 0 ' + f(h - 2) + ' Q' + f(-b * .5) + ' ' + f(h + 6) + ' ' + f(-b) + ' ' + f(h) + 'Z';
    return path(d, fill || 'url(#ZZ-c)', 1, ' opacity=".92"') + (trim === false ? '' : line('M' + f(-b) + ' ' + f(h) + ' Q' + f(-b * .5) + ' ' + f(h + 6) + ' 0 ' + f(h - 2) + ' Q' + f(b * .5) + ' ' + f(h + 6) + ' ' + f(b) + ' ' + f(h), 2.2, GOLD2));
  };
  var spiral = function (cx, cy, r0, turns, dir) {
    var pts = [], n = 40; for (var i = 0; i <= n; i++) { var t = i / n, a = dir * (t * turns * Math.PI * 2) - Math.PI / 2, r = r0 * (1 - t * .78); pts.push(f(cx + Math.cos(a) * r) + ' ' + f(cy + Math.sin(a) * r)); }
    return 'M' + pts.join(' L');
  };
  var feathers = function () {   // 射手座用的羽翼（單邊，往右）
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
  var ART = {
    // 白羊座：一對向外捲的羊角＋短披風
    aries: function () {
      return cape(16, 26, 30) + mirror(thick(spiral(30, -30, 20, 1.6, 1), 6) + path('M12 -20 Q18 -34 30 -50 L34 -44 Q22 -30 18 -16Z'));
    },
    // 金牛座：巨大的牛角往上彎＋厚重肩甲
    taurus: function () {
      return cape(20, 34, 40) + mirror(path('M14 -18 Q40 -22 62 -48 Q74 -64 70 -86 Q86 -62 76 -40 Q60 -14 20 -6Z') + path('M10 -8 Q28 -18 42 -4 Q30 4 12 2Z', GOLD2));
    },
    // 雙子座：一半白、一半深藍的長披風，頭後兩個重疊光環
    gemini: function () {
      return '<g class="cb-spin" style="transform-origin:0px -40px">' + '<circle cx="-11" cy="-40" r="20" fill="none" stroke="' + GOLD2 + '" stroke-width="3"/><circle cx="11" cy="-40" r="20" fill="none" stroke="#c7d2fe" stroke-width="3"/></g>'
        + path('M-20 -2 Q-10 -7 0 -6 L0 58 Q-18 64 -40 60Z', 'url(#ZZ-c)', 1, ' opacity=".92"') + path('M20 -2 Q10 -7 0 -6 L0 58 Q18 64 40 60Z', '#1e2a5a', 1, ' opacity=".92"') + line('M0 -6 L0 58', 2, GOLD2);
    },
    // 巨蟹座：兩支往上張開的蟹螯
    cancer: function () {
      return cape(16, 24, 26) + mirror(thick('M14 -6 Q34 -14 46 -34', 6) + path('M42 -30 Q38 -60 58 -72 Q54 -54 60 -42Z') + path('M48 -36 Q72 -48 80 -70 Q84 -46 60 -30Z', GOLD2));
    },
    // 獅子座：獅鬃般的放射光芒
    leo: function () {
      var out = '<g class="cb-spin" style="transform-origin:0px -30px">';
      for (var i = 0; i < 18; i++) { var a = i / 18 * Math.PI * 2, r1 = 18, r2 = i % 2 ? 40 : 54, w = .16;
        out += path('M' + f(Math.cos(a - w) * r1) + ' ' + f(-30 + Math.sin(a - w) * r1) + ' L' + f(Math.cos(a) * r2) + ' ' + f(-30 + Math.sin(a) * r2) + ' L' + f(Math.cos(a + w) * r1) + ' ' + f(-30 + Math.sin(a + w) * r1) + 'Z', i % 2 ? GOLD2 : GOLD, .8); }
      return cape(18, 30, 34, '#7c2d12') + out + '</g>';
    },
    // 處女座：蓮華光輪（八瓣）＋外圈光環
    virgo: function () {
      var out = '<circle cx="0" cy="-30" r="56" fill="none" stroke="' + GOLD2 + '" stroke-width="2" stroke-dasharray="3 5" class="cb-spin" style="transform-origin:0px -30px"/>';
      for (var i = 0; i < 8; i++) { var a = i * 45; out += '<g transform="rotate(' + a + ' 0 -30)">' + path('M0 -30 Q-12 -52 0 -72 Q12 -52 0 -30Z', i % 2 ? GOLD2 : GOLD, .8) + '</g>'; }
      return cape(16, 30, 44) + out + '<circle cx="0" cy="-30" r="9" fill="' + GOLD + '" stroke="' + LINE + '"/>';
    },
    // 天秤座：背後的天秤橫樑與兩個秤盤（會輕輕擺動）
    libra: function () {
      var pan = function (x) { return line('M' + x + ' -62 L' + (x - 12) + ' -34 M' + x + ' -62 L' + (x + 12) + ' -34', 1.2, LINE) + path('M' + (x - 16) + ' -34 Q' + x + ' -22 ' + (x + 16) + ' -34Z'); };
      return cape(18, 28, 36) + thick('M0 -8 L0 -66', 5) + '<g class="cb-sway" style="transform-origin:0px -64px">' + thick('M-74 -64 L74 -64', 4) + pan(-70) + pan(70) + '</g>'
        + path('M-7 -66 L0 -78 L7 -66 L0 -60Z');
    },
    // 天蠍座：越過肩膀高高翹起的蠍尾與毒針
    scorpio: function () {
      var out = '<g class="cb-tail" style="transform-origin:6px 6px">', pts = [[6, 6], [18, -6], [28, -22], [32, -40], [28, -58], [18, -72], [4, -80], [-10, -82]];
      pts.forEach(function (p, i) { var r = 9 - i * .7; out += '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="' + f(r) + '" ry="' + f(r * .82) + '" fill="' + (i % 2 ? GOLD2 : GOLD) + '" stroke="' + LINE + '"/>'; });
      out += path('M-14 -86 Q-30 -88 -34 -74 Q-26 -80 -12 -76Z', '#b91c1c');
      return cape(14, 24, 30, '#4c1d24') + out + '</g>';
    },
    // 射手座：黃金羽翼（會拍動）
    sagittarius: function () {
      return '<g transform="scale(.82)"><g class="cb-wr">' + feathers() + '</g></g><g transform="scale(-.82 .82)"><g class="cb-wl">' + feathers() + '</g></g>';
    },
    // 摩羯座：往後掠的山羊角＋背上的聖劍
    capricorn: function () {
      return cape(16, 26, 36) + path('M0 -100 L6 -80 L4 18 L0 26 L-4 18 L-6 -80Z', 'url(#ZZ-s)') + path('M-14 -28 L14 -28 L12 -22 L-12 -22Z')
        + mirror(path('M8 -30 Q30 -52 58 -40 Q74 -32 76 -12 Q64 -28 46 -30 Q28 -32 12 -20Z'));
    },
    // 水瓶座：從肩膀流下的水流披帶，頭上一枚冰晶
    aquarius: function () {
      var star = ''; for (var i = 0; i < 6; i++) star += '<g transform="rotate(' + (i * 60) + ' 0 -64)">' + line('M0 -64 L0 -82 M0 -76 L-5 -81 M0 -76 L5 -81', 2.4, '#e0f2fe') + '</g>';
      return '<g class="cb-wave">' + mirror(path('M10 -4 Q36 -10 44 12 Q50 34 36 56 Q54 40 58 14 Q56 -16 16 -14Z', 'url(#ZZ-w)', .9, ' opacity=".9"')) + '</g>'
        + cape(14, 22, 30, 'url(#ZZ-w)', false) + '<g class="cb-spin" style="transform-origin:0px -64px">' + star + '<circle cx="0" cy="-64" r="4" fill="#fff"/></g>';
    },
    // 雙魚座：繞著光環游動的兩條魚＋點點玫瑰
    pisces: function () {
      var fish = function (rot, col) { return '<g transform="rotate(' + rot + ' 0 -34)">' + path('M0 -86 Q16 -94 30 -86 Q16 -78 0 -86Z', col, .9) + path('M30 -86 L40 -94 L38 -86 L40 -78Z', col, .9) + '</g>'; };
      var rose = function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="4.2" fill="#e11d48" stroke="#7f1d1d" stroke-width=".8"/><circle cx="' + x + '" cy="' + y + '" r="1.8" fill="#fb7185"/>'; };
      return cape(16, 28, 38, '#f5f3ff') + '<circle cx="0" cy="-34" r="52" fill="none" stroke="' + GOLD2 + '" stroke-width="1.6"/>'
        + '<g class="cb-spin cb-slow" style="transform-origin:0px -34px">' + fish(0, GOLD) + fish(180, GOLD2) + '</g>' + rose(-40, -8) + rose(42, -14) + rose(-30, 30) + rose(34, 24) + rose(0, -88);
    }
  };
  var EXTRA = '<linearGradient id="ZZ-s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e5e7eb"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#9ca3af"/></linearGradient>'
    + '<linearGradient id="ZZ-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0f7ff"/><stop offset="1" stop-color="#38bdf8"/></linearGradient>';
  var cache = {};
  function svg(z) {
    if (!ART[z]) z = 'sagittarius';
    if (cache[z]) return cache[z];
    var id = 'cb' + z;
    var s = '<svg viewBox="-110 -120 220 190" data-zodiac="' + z + '" aria-hidden="true">' + defs(EXTRA) + ART[z]() + '</svg>';
    return (cache[z] = s.replace(/ZZ-/g, id + '-'));
  }
  // ── 點陣風格（試作：射手座）──
  // 把向量圖在角色的原始像素大小畫進 canvas，再做：硬邊透明、限制成遊戲裡的金色色盤＋有序抖色、1px 深色外框，
  // 讓背飾跟天堂原本的點陣角色同一種質感。斜 45 度視角用一點傾斜，翅膀外側往後上方收。
  var PAL_GOLD = [[34, 20, 6], [74, 46, 12], [116, 76, 20], [160, 112, 34], [204, 152, 56], [232, 196, 104], [252, 236, 184]];
  var PAL_SEAL = [[24, 24, 26], [48, 48, 52], [72, 72, 78], [98, 98, 104], [126, 126, 132], [152, 152, 158], [178, 178, 184]];
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function pixelize(ctx, w, h, pal) {
    var img = ctx.getImageData(0, 0, w, h), d = img.data, solid = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4; if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
      solid[y * w + x] = 1;
      var L = (d[i] * .3 + d[i + 1] * .55 + d[i + 2] * .15) / 255, t = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - .5) / (pal.length - 1);
      var k = Math.max(0, Math.min(pal.length - 1, Math.round((L * .92 + t) * (pal.length - 1))));
      d[i] = pal[k][0]; d[i + 1] = pal[k][1]; d[i + 2] = pal[k][2]; d[i + 3] = 255;
    }
    // 1px 外框
    for (var y2 = 0; y2 < h; y2++) for (var x2 = 0; x2 < w; x2++) {
      if (solid[y2 * w + x2]) continue;
      var near = (x2 > 0 && solid[y2 * w + x2 - 1]) || (x2 < w - 1 && solid[y2 * w + x2 + 1]) || (y2 > 0 && solid[(y2 - 1) * w + x2]) || (y2 < h - 1 && solid[(y2 + 1) * w + x2]);
      if (near) { var j = (y2 * w + x2) * 4; d[j] = pal[0][0]; d[j + 1] = pal[0][1]; d[j + 2] = pal[0][2]; d[j + 3] = 230; }
    }
    ctx.putImageData(img, 0, 0);
  }
  // 單邊翅膀（往右），肩膀在 (0,0)
  var WING_BOX = { x: -12, y: -110, w: 175, h: 175 };
  function wingSvg() {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + WING_BOX.x + ' ' + WING_BOX.y + ' ' + WING_BOX.w + ' ' + WING_BOX.h + '" width="' + WING_BOX.w + '" height="' + WING_BOX.h + '">' + defs('') + feathers() + '</svg>';
    return s.replace(/ZZ-/g, 'cbw-');
  }
  var rasterCache = {};
  // 回傳一個 canvas（右翅），size＝像素寬度；seal＝封印色
  function wingCanvas(size, seal, done) {
    size = Math.max(16, Math.round(size)); var key = size + (seal ? 's' : 'o');
    if (rasterCache[key] && rasterCache[key].ready) { done(rasterCache[key].c); return; }
    if (rasterCache[key]) { rasterCache[key].wait.push(done); return; }
    var c = document.createElement('canvas'); c.width = size; c.height = size;
    var entry = rasterCache[key] = { c: c, ready: false, wait: [done] }, im = new Image();
    im.onload = function () {
      var ctx = c.getContext('2d', { willReadFrequently: true }), sc = size / WING_BOX.w, ox = -WING_BOX.x * sc, oy = -WING_BOX.y * sc;
      // 斜 45 度：外側往後上方收（x 稍壓縮、往外越高）
      ctx.setTransform(.86 * sc, -.12 * sc, 0, .88 * sc, ox, oy);
      ctx.drawImage(im, WING_BOX.x, WING_BOX.y, WING_BOX.w, WING_BOX.h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      pixelize(ctx, size, size, seal ? PAL_SEAL : PAL_GOLD);
      entry.ready = true; entry.wait.forEach(function (fn) { try { fn(c); } catch (e) {} }); entry.wait = [];
    };
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(wingSvg());
  }
  var PIXEL = { sagittarius: true };   // 試作：先做射手座
  // 方框與肩膀的對應：viewBox 寬 220、高 190，肩膀在 (110,120)
  window.AFK_CLOTH_ART = { pixel: PIXEL, wingCanvas: wingCanvas, wingBox: WING_BOX, svg: svg, zodiacs: Object.keys(ART), box: { w: 220, h: 190, sx: 110, sy: 120 } };
})();
