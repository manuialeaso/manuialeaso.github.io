/* ============================================================================
 * afk-rotation.js — 世界頻道／收購 NPC 共用的「6 區塊輪替」時鐘（基礎設施，不列開關）
 *
 * 玩家規格（2026-10-20）：內容切成 6 個區塊；每 4 小時隨機換一個區塊，抽過的不重複；
 *   抽滿 3 次（12 小時）後 6 個區塊全部放回去重新抽。
 * 做法：完全由時間決定（決定論），同一時刻所有分頁、重新整理前後都是同一區塊，不必存檔。
 *   cycle  = floor(現在 / 12 小時)       → 以 cycle 當種子把 [0..5] 洗牌
 *   period = floor(現在 / 4 小時) % 3     → 取洗牌結果的第 period 個
 * 用法：AFK_ROTATION.block() → 0～5；AFK_ROTATION.info() → 除錯資訊
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_ROTATION) return;
  var PERIOD_MS = 4 * 3600 * 1000, PER_CYCLE = 3, BLOCKS = 6;
  // 以時間軸為準的偏移：讓換區塊的時間落在台灣時間 00/04/08/12/16/20 點
  var OFFSET_MS = 8 * 3600 * 1000;
  var hash = function (n) {   // 32-bit 整數雜湊（mulberry32 一步）
    var t = (n + 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  var order = function (cycle) {
    var a = [0, 1, 2, 3, 4, 5];
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(hash(cycle * 31 + i) * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  var at = function (now) {
    var p = Math.floor(((now == null ? Date.now() : now) + OFFSET_MS) / PERIOD_MS);
    var cycle = Math.floor(p / PER_CYCLE);
    var o = order(cycle);
    return { block: o[p % PER_CYCLE], cycle: cycle, step: p % PER_CYCLE, order: o.slice(0, PER_CYCLE),
             nextChangeAt: (p + 1) * PERIOD_MS - OFFSET_MS };
  };
  window.AFK_ROTATION = {
    BLOCKS: BLOCKS,
    block: function (now) { return at(now).block; },
    info: at,
    // 物品 id → 0～5（穩定雜湊），讓物品池也能依區塊切成 6 份
    bucketOf: function (key) { var h = 2166136261; key = String(key); for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % BLOCKS; }
  };
})();
