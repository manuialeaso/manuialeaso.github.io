/* ==========================================================================
 * afk-cloth-art.js — 輪迴十二星座聖衣的背飾（玩家 2026-10-23：12 星座都不同、要像私服的粗像素）
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
  // 每個星座：draw(p) 畫 phase p 那一格；frames 幀數、dur 一輪秒數
  var ART = {
    aries: { frames: 6, dur: 1.8, draw: function (p) {   // 白羊座：一對往外捲的羊角＋短披風
      return cape(16, 26, 30, null, p) + mirror(thick(spiral(30, -30, 20, 1.6, 1), 6) + path('M12 -20 Q18 -34 30 -50 L34 -44 Q22 -30 18 -16Z'));
    } },
    taurus: { frames: 6, dur: 1.8, draw: function (p) {   // 金牛座：往上彎的巨大牛角＋厚重肩甲
      return cape(20, 34, 40, null, p) + mirror(path('M14 -18 Q40 -22 62 -48 Q74 -64 70 -86 Q86 -62 76 -40 Q60 -14 20 -6Z') + path('M10 -8 Q28 -18 42 -4 Q30 4 12 2Z', GOLD2));
    } },
    gemini: { frames: 8, dur: 2.4, draw: function (p) {   // 雙子座：一白一深藍的披風，頭後兩個互繞的光環
      var a = p * Math.PI * 2, dx = Math.cos(a) * 11, dy = Math.sin(a) * 3, s = wave(p) * 3;
      return ring(f(-dx), f(-40 - dy), 20, 4, GOLD2) + ring(f(dx), f(-40 + dy), 20, 4, '#93a5f5')
        + path('M-20 -2 Q-10 -7 0 -6 L0 58 Q-18 64 ' + f(-40 + s) + ' 60Z', 'url(#ZZ-c)', 1) + path('M20 -2 Q10 -7 0 -6 L0 58 Q18 64 ' + f(40 + s) + ' 60Z', '#1e2a5a', 1) + line('M0 -6 L0 58', 2, GOLD2);
    } },
    cancer: { frames: 6, dur: 1.6, draw: function (p) {   // 巨蟹座：兩支往上張開的蟹螯（開合）
      var o = (wave(p) + 1) * 4;
      var claw = thick('M14 -6 Q34 -14 46 -34', 6) + '<g transform="' + rot(-o, 46, -34) + '">' + path('M42 -30 Q38 -60 58 -72 Q54 -54 60 -42Z') + '</g><g transform="' + rot(o, 46, -34) + '">' + path('M48 -36 Q72 -48 80 -70 Q84 -46 60 -30Z', GOLD2) + '</g>';
      return cape(16, 24, 26, null, p) + mirror(claw);
    } },
    leo: { frames: 6, dur: 1.5, draw: function (p) {   // 獅子座：獅鬃般的放射光芒（慢轉）
      var out = '<g transform="' + rot(20 * p, 0, -30) + '">';
      for (var i = 0; i < 18; i++) { var a = i / 18 * Math.PI * 2, r1 = 18, r2 = i % 2 ? 40 : 54, w = .16;
        out += path('M' + f(Math.cos(a - w) * r1) + ' ' + f(-30 + Math.sin(a - w) * r1) + ' L' + f(Math.cos(a) * r2) + ' ' + f(-30 + Math.sin(a) * r2) + ' L' + f(Math.cos(a + w) * r1) + ' ' + f(-30 + Math.sin(a + w) * r1) + 'Z', i % 2 ? GOLD2 : GOLD, .8); }
      return cape(18, 30, 34, '#8a2e12', p) + out + '</g>';
    } },
    virgo: { frames: 6, dur: 2.4, draw: function (p) {   // 處女座：八瓣蓮華光輪＋外圈光環（光輪緩緩轉）
      var out = '<g transform="' + rot(45 * p, 0, -30) + '">' + ring(0, -30, 56, 2, GOLD2, '6 10');
      for (var i = 0; i < 8; i++) out += '<g transform="' + rot(i * 45, 0, -30) + '">' + path('M0 -30 Q-12 -52 0 -72 Q12 -52 0 -30Z', i % 2 ? GOLD2 : GOLD, .8) + '</g>';
      return cape(16, 30, 44, null, p) + out + '</g><circle cx="0" cy="-30" r="9" fill="' + GOLD + '" stroke="' + LINE + '"/>';
    } },
    libra: { frames: 8, dur: 3.2, draw: function (p) {   // 天秤座：背後的天秤，左右擺
      var pan = function (x) { return line('M' + x + ' -62 L' + (x - 12) + ' -34 M' + x + ' -62 L' + (x + 12) + ' -34', 1.2, LINE) + path('M' + (x - 16) + ' -34 Q' + x + ' -22 ' + (x + 16) + ' -34Z'); };
      return cape(18, 28, 36, null, p) + thick('M0 -8 L0 -66', 5) + '<g transform="' + rot(5 * wave(p), 0, -64) + '">' + thick('M-74 -64 L74 -64', 4) + pan(-70) + pan(70) + '</g>'
        + path('M-7 -66 L0 -78 L7 -66 L0 -60Z');
    } },
    scorpio: { frames: 8, dur: 2.4, draw: function (p) {   // 天蠍座：越過肩膀翹起的蠍尾與毒針（擺動）
      var out = '<g transform="' + rot(6 * wave(p), 6, 6) + '">', pts = [[6, 6], [18, -6], [28, -22], [32, -40], [28, -58], [18, -72], [4, -80], [-10, -82]];
      pts.forEach(function (q, i) { var r = 9 - i * .7; out += '<ellipse cx="' + q[0] + '" cy="' + q[1] + '" rx="' + f(r) + '" ry="' + f(r * .82) + '" fill="' + (i % 2 ? GOLD2 : GOLD) + '" stroke="' + LINE + '"/>'; });
      out += path('M-14 -86 Q-30 -88 -34 -74 Q-26 -80 -12 -76Z', '#b91c1c');
      return cape(14, 24, 30, '#4c1d24', p) + out + '</g>';
    } },
    sagittarius: { frames: 6, dur: 1.6, draw: function (p) {   // 射手座：黃金羽翼（拍動）
      var a = -10 * (1 - Math.cos(p * Math.PI * 2)) / 2;
      return '<g transform="scale(.82) ' + rot(a, 0, 0) + '">' + feathers() + '</g><g transform="scale(-.82 .82) ' + rot(a, 0, 0) + '">' + feathers() + '</g>';
    } },
    capricorn: { frames: 6, dur: 1.8, draw: function (p) {   // 摩羯座：往後掠的山羊角＋背上的聖劍
      return cape(16, 26, 36, null, p) + path('M0 -100 L6 -80 L4 18 L0 26 L-4 18 L-6 -80Z', 'url(#ZZ-s)') + path('M-14 -28 L14 -28 L12 -22 L-12 -22Z')
        + mirror(path('M8 -30 Q30 -52 58 -40 Q74 -32 76 -12 Q64 -28 46 -30 Q28 -32 12 -20Z'));
    } },
    aquarius: { frames: 8, dur: 2.4, draw: function (p) {   // 水瓶座：肩上流下的水流披帶（起伏），頭上旋轉的冰晶
      var y = f(wave(p) * 3), star = '';
      for (var i = 0; i < 6; i++) star += '<g transform="' + rot(i * 60, 0, -64) + '">' + line('M0 -64 L0 -82 M0 -76 L-5 -81 M0 -76 L5 -81', 2.4, '#e0f2fe') + '</g>';
      return '<g transform="translate(0 ' + y + ')">' + mirror(path('M10 -4 Q36 -10 44 12 Q50 34 36 56 Q54 40 58 14 Q56 -16 16 -14Z', 'url(#ZZ-w)', .9)) + '</g>'
        + cape(14, 22, 30, 'url(#ZZ-w)', p, false) + '<g transform="' + rot(60 * p, 0, -64) + '">' + star + '<circle cx="0" cy="-64" r="4" fill="#fff"/></g>';
    } },
    pisces: { frames: 8, dur: 3.2, draw: function (p) {   // 雙魚座：繞著光環游動的兩條魚＋點點玫瑰
      var fish = function (r, col) { return '<g transform="' + rot(r, 0, -34) + '">' + path('M0 -86 Q16 -94 30 -86 Q16 -78 0 -86Z', col, .9) + path('M30 -86 L40 -94 L38 -86 L40 -78Z', col, .9) + '</g>'; };
      var rose = function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="4.6" fill="#e11d48" stroke="#7f1d1d" stroke-width="1"/><circle cx="' + x + '" cy="' + y + '" r="2" fill="#fb7185"/>'; };
      return cape(16, 28, 38, '#f5f3ff', p) + ring(0, -34, 52, 1.6, GOLD2) + fish(180 * p, GOLD) + fish(180 * p + 180, GOLD2)
        + rose(-40, -8) + rose(42, -14) + rose(-30, 30) + rose(34, 24) + rose(0, -88);
    } }
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
