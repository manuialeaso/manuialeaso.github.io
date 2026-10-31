/* ============================================================================
 * afk-dup-frames.js — 重複動畫幀改指向同一張圖（玩家 2026-10-30：網站再壓小）
 *
 * 動畫樹裡內容一模一樣的幀，公開版只留一張（清單：afk-dup-frames-data.js，由 scripts/build-dup-frames.py 產生）。
 * 這裡在圖片網址設定的當下（img.src、setAttribute('src')、new Image().src）把被拿掉的那張改成留下來的那張；
 * 萬一有圖從別的路徑（例如 innerHTML 直接寫 <img src>）載入失敗，再補一次改指向。
 * 畫面完全不變；同一張圖也只需要下載一次。第 0 格（*_0.png）一律保留，所以縮圖、圖鑑不受影響。
 * 2026-10-31（#161）：公開版另外把第 1 格以後的幀換成 WebP 無損（afk-webp-frames-data.js 開著時，網址 *_N.png → *_N.webp；
 *   載入失敗退回 PNG）。開發版（perf）是關的，照讀 PNG。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, M = W.AFK_DUP_FRAMES || { F: [], D: {} }, WEBP = !!(W.AFK_WEBP_FRAMES && W.AFK_WEBP_FRAMES.on);
  if (typeof HTMLImageElement === 'undefined') return;
  var F = M.F, D = M.D, fIdx = null, cache = Object.create(null), hits = 0;
  var folderMap = function (dir) {
    if (!fIdx) { fIdx = Object.create(null); for (var i = 0; i < F.length; i++) fIdx[F[i]] = i; }
    var i2 = fIdx[dir]; if (i2 === undefined) return null;
    var m = cache[i2];
    if (!m) {
      m = cache[i2] = Object.create(null);
      var s = D[i2]; if (s) s.split(';').forEach(function (e) { var k = e.indexOf('>'); m[e.slice(0, k)] = e.slice(k + 1); });
    }
    return m;
  };
  var RE_TREE = /(?:^|\/)(assets\/(?:anim|classanim|morphanim)\/|art-v3\/frames\/)/;
  // 公開版：動畫樹第 1 格以後的幀改讀 .webp（無損，像素完全相同；scripts/build-webp-frames.py，玩家 2026-10-31 #161）
  var RE_WEBP = /_[1-9]\d*\.png(?=[?#]|$)/;
  var toWebp = function (v) {
    if (!WEBP || typeof v !== 'string' || !RE_WEBP.test(v)) return v;
    var p = v; try { if (v.indexOf('%') >= 0) p = decodeURIComponent(v); } catch (e) {}
    if (!RE_TREE.test(p)) return v;
    return v.replace(RE_WEBP, function (x) { return x.slice(0, -4) + '.webp'; });
  };
  var map = function (v) { return toWebp(dupMap(v)); };
  var dupMap = function (v) {
    if (typeof v !== 'string' || v.length < 12) return v;
    if (v.indexOf('anim') < 0 && v.indexOf('art-v3') < 0) return v;
    if (!/_[1-9]\d*\.png(?:[?#]|$)/.test(v)) return v;   // 只有「第 1 格以後」的幀可能被合併
    var q = '', qi = v.search(/[?#]/); if (qi >= 0) { q = v.slice(qi); v = v.slice(0, qi); }
    var raw = v, enc = v.indexOf('%') >= 0, p;
    try { p = enc ? decodeURIComponent(v) : v; } catch (e) { return raw + q; }
    var m = RE_TREE.exec(p); if (!m) return raw + q;
    var at = m.index + (m[0].charAt(0) === '/' ? 1 : 0), head = p.slice(0, at), rel = p.slice(at);
    var slash = rel.lastIndexOf('/'), dir = rel.slice(0, slash), name = rel.slice(slash + 1, -4);
    var fm = folderMap(dir); if (!fm) return raw + q;
    var t = fm[name]; if (!t) return raw + q;
    var out;
    if (t.charAt(0) === '=') out = dir + '/' + t.slice(1);
    else if (t.indexOf('/') > 0) { var k = t.indexOf('/'); out = F[+t.slice(0, k)] + '/' + t.slice(k + 1); }
    else out = dir + '/' + name.replace(/\d+$/, '') + t;
    out += '.png'; hits++;
    if (enc) out = out.split('/').map(encodeURIComponent).join('/');
    return (enc ? encodeURI(head) : head) + out + q;
  };
  // 1) img.src／new Image().src
  var d = null;
  try {
    d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (d && d.set && d.configurable) Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (v) { d.set.call(this, map(v)); }
    });
  } catch (e) {}
  // 2) setAttribute('src', …)
  try {
    var oSA = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (n, v) {
      if ((n === 'src' || n === 'SRC') && this instanceof HTMLImageElement) v = map(v);
      return oSA.call(this, n, v);
    };
  } catch (e) {}
  // 3) 保險：<img> 載入失敗而且是被拿掉的那張 → 改指向留下來的那張
  //    WebP 那張載入失敗（對照表漏了的新幀）→ 退回原本的 PNG，只退一次
  document.addEventListener('error', function (e) {
    var t = e.target; if (!t || t.tagName !== 'IMG') return;
    var s = t.getAttribute('src');
    if (WEBP && typeof s === 'string' && /_[1-9]\d*\.webp(?=[?#]|$)/.test(s) && !t.__afkPngBack) {
      t.__afkPngBack = true; var back = s.replace(/\.webp(?=[?#]|$)/, '.png');
      if (d && d.set) d.set.call(t, back); else t.setAttribute('data-afk', '1');
      return;
    }
    var m2 = map(s); if (m2 && m2 !== s) t.src = m2;
  }, true);
  W.__afkDupSrc = map; W.__afkWebpOn = function () { return WEBP; };
  W.__afkDupStats = function () { return { folders: F.length, hits: hits }; };
})();
