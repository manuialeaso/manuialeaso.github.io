/* ==========================================================================
 * afk-ringany.js — 控制戒指不用裝備（玩家 2026-10-22 指定）
 *   召喚控制戒指、傳送控制戒指、變形控制戒指：裝備中、放在背包、或存在倉庫（同模式共用倉庫）都會生效。
 *   傭兵的召喚術也吃得到（看你的背包／倉庫）。
 *   倉庫內容只在需要時讀，且 3 秒內重複查詢用快取（倉庫有變動時會自動清掉快取）。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('ringany')) return;

  var cache = { at: 0, key: '', raw: '' };
  var whRaw = function () {
    try {
      var k = (typeof whKey === 'function') ? whKey() : null; if (!k) return '';
      var now = Date.now();
      if (cache.key === k && now - cache.at < 3000) return cache.raw;
      var raw = (typeof _lzGet === 'function') ? _lzGet(k) : localStorage.getItem(k);
      cache = { at: now, key: k, raw: raw || '' };
      return cache.raw;
    } catch (e) { return ''; }
  };
  var inWh = function (id) { var r = whRaw(); return !!r && r.indexOf('"' + id + '"') >= 0; };
  var inInv = function (id) { try { return !!(player && player.inv && player.inv.some(function (i) { return i && i.id === id && (i.cnt || 0) > 0; })); } catch (e) { return false; } };
  var has = function (id) { return inInv(id) || inWh(id); };
  window.__afkRingHas = has;

  // 倉庫有存取時清快取
  ['whDeposit', 'whWithdraw', 'whDepositAll', 'whWithdrawAll', 'saveWarehouse', '_whWrite'].forEach(function (fn) {
    var o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () { cache.at = 0; try { return o.apply(this, arguments); } finally { cache.at = 0; } };
  });

  if (typeof window.hasPolyRing === 'function') {
    var oPoly = window.hasPolyRing;
    window.hasPolyRing = function () { return oPoly.apply(this, arguments) || has('acc_117'); };
  }
  if (typeof window.hasTeleportRing === 'function') {
    var oTp = window.hasTeleportRing;
    window.hasTeleportRing = function () { return oTp.apply(this, arguments) || has('acc_116'); };
  }
  if (typeof window.hasSummonCtrlRing === 'function') {
    var oSum = window.hasSummonCtrlRing;
    window.hasSummonCtrlRing = function () { return oSum.apply(this, arguments) || has('acc_summon_ctrl'); };
  }
  // 物品說明補一句
  try {
    ['acc_116', 'acc_117', 'acc_summon_ctrl'].forEach(function (id) { var d = DB.items[id]; if (d && d.d && d.d.indexOf('不用裝備') < 0) d.d += '（不用裝備：放在背包或倉庫就有效果）'; });
  } catch (e) {}

  console.log('[AFK-ringany] 已啟用：召喚／傳送／變形控制戒指放背包或倉庫即生效');
})();
