/* ============================================================================
 * afk-gptart-icons.js — GPT新美術：裝備圖示光影修補（玩家 2026-10-30 16:27；跟「GPT新美術」同一個開關 art-v3）
 *
 *   玩家提供的「裝備圖示光影修補」42 批：837 張 64×64 WebP，對應 1,087 個原圖路徑（同一張原圖的別名共用一張新圖）。
 *   只收錄「原圖跟交付包的參考原圖逐像素相同」的路徑（1,087／1,087 全部相同），新圖放 assets/icons/gpt/eqNNN.webp。
 *   做法：圖示網址產生的地方（getIconUrl）與 <img> 設定網址的當下，把對照表裡的原圖換成新圖；
 *         開關關掉＝立刻換回原圖（下次重畫就生效）。原圖保留，不刪。
 *   這支要在其他外掛之前載入（有些外掛載入時就會先算圖示網址）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, M = W.AFK_GPT_ICONS;
  // 「GPT新美術」總開關（外掛 afk-art-v3 也用同一個 id；先登錄的為準，兩邊內容相同）
  if (T && T.register) {
    T.register({ id: 'art-v3', name: 'GPT新美術', group: '遊戲介面',
      desc: 'GPT 重新繪製的美術：神話、天上、時空與十二聖衣的變身動畫，29 隻新怪物的專屬動畫，以及 837 件裝備圖示的光影修補（只換外觀，不影響能力與存檔）。' });
  }
  if (!M || typeof HTMLImageElement === 'undefined') return;
  var on = function () { return !T || T.enabled('art-v3'); };
  var hits = 0;
  var map = function (u) {
    if (typeof u !== 'string' || u.indexOf('icons/') < 0 || !on()) return u;
    var q = '', qi = u.search(/[?#]/); if (qi >= 0) { q = u.slice(qi); u = u.slice(0, qi); }
    var raw = u, p = u;
    if (p.indexOf('%') >= 0) { try { p = decodeURIComponent(p); } catch (e) { return raw + q; } }
    var at = p.indexOf('assets/icons/'); if (at < 0 || p.slice(-4) !== '.png') return raw + q;
    var rest = p.slice(at + 13, -4), sl = rest.indexOf('/'); if (sl < 0) return raw + q;
    var g = M[rest.slice(0, sl)], id = g && g[rest.slice(sl + 1)]; if (!id) return raw + q;
    hits++;
    return p.slice(0, at) + 'assets/icons/gpt/eq' + id + '.webp' + q;
  };
  if (typeof W.getIconUrl === 'function') {
    var oIcon = W.getIconUrl;
    W.getIconUrl = function () { return map(oIcon.apply(this, arguments)); };
  }
  try {
    var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (d && d.set && d.configurable) Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true, enumerable: d.enumerable, get: d.get, set: function (v) { d.set.call(this, map(v)); }
    });
  } catch (e) {}
  try {
    var oSA = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (n, v) {
      if ((n === 'src' || n === 'SRC') && this instanceof HTMLImageElement) v = map(v);
      return oSA.call(this, n, v);
    };
  } catch (e) {}
  W.__afkGptIcons = { map: map, count: function () { var n = 0; Object.keys(M).forEach(function (k) { n += Object.keys(M[k]).length; }); return n; }, hits: function () { return hits; } };
})();
