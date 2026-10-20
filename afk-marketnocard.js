/* ============================================================================
 * afk-marketnocard.js — 潘朵拉黑市不再隨機上架怪物卡片（玩家 2026-10-20 指定）
 *
 * 卡片改由龍鑽收購 NPC 高價收（普 100／銀 500／金 1000 鑽），黑市若還能用金幣買卡就變成無限套利，
 * 所以黑市隨機輪換不再出卡片。保留：
 *   ‧玩家自己掛的「收購單」（指定卡片也可以，命中照常上架）
 *   ‧金幣收購／龍鑽收購 NPC
 * 做法：只在黑市上架（_pandoraStock）期間，把抽獎的「排除卡片」參數強制打開；
 *   血盟野外掉寶等其他用到同一抽獎函式的地方不受影響。
 *   已經在架上的卡片（不是收購單）會在下一次檢查時換成別的商品。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('marketnocard')) return;
  if (typeof window._pandoraStock !== 'function' || typeof window.getWeightedGachaResult !== 'function' || typeof window.refreshPandoraMarket !== 'function') {
    try { console.warn('[AFK-marketnocard] 找不到黑市函式，未啟用'); } catch (e) {}
    return;
  }
  var stocking = 0;
  var oGacha = window.getWeightedGachaResult;
  window.getWeightedGachaResult = function (doubleNonRare, excludeCards) {
    if (stocking > 0) return oGacha.call(this, doubleNonRare, true);
    return oGacha.apply(this, arguments);
  };
  var oStock = window._pandoraStock;
  window._pandoraStock = function () {
    stocking++;
    try { return oStock.apply(this, arguments); } finally { stocking--; }
  };
  var isCardSlot = function (s) { return !!(s && !s.buyOrder && DB.items[s.id] && DB.items[s.id].eff === 'card'); };
  var sweep = function () {
    try {
      var m = (typeof player !== 'undefined' && player) ? player.pandoraMarket2 : null;
      if (!m || !Array.isArray(m.slots)) return false;
      var nowT = (typeof state !== 'undefined' && state) ? (state.ticks || 0) : 0;
      var n = 0;
      for (var i = 0; i < m.slots.length; i++) if (isCardSlot(m.slots[i])) { m.slots[i] = window._pandoraStock(nowT, m, i); n++; }
      return n > 0;
    } catch (e) { return false; }
  };
  var oRefresh = window.refreshPandoraMarket;
  window.refreshPandoraMarket = function () {
    var r = oRefresh.apply(this, arguments);
    if (sweep()) { try { renderSyslogPandora(); } catch (e) {} r = true; }
    return r;
  };
  console.log('[AFK-marketnocard] 已啟用：黑市隨機輪換不再上架卡片（收購單與收購 NPC 照常）');
})();
