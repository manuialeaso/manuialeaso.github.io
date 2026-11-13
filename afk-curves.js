/* ============================================================================
 * afk-curves.js — 抗性曲線統一（玩家 2026-10-26 審查建議 8）
 *
 * 原本三套各寫各的：魔防（mrMult 分段算式）、屬性抗性（effResistPct：50 以下 1:1、以上每 5 點 +1%）、
 * 席琳夢域鏡的抗性新制（afk-resist 自己的端點表）。現在全部改成「一份表＋同一個內插函式」：
 *   AFK_CURVES.lerp(表, 值)：在相鄰兩個端點之間等比例內插；低於第一點取第一點、高於最後一點取最後一點
 *   AFK_CURVES.MR        魔防 → 魔法傷害通過率（數值與原本分段算式相同）
 *   AFK_CURVES.ELE_PCT   屬性抗性 → 有效減免 %（原本 50 以上每 5 點取整 +1%，改成連續；300 起 100%）
 *   AFK_CURVES.ELE_DREAM 席琳夢域鏡屬性抗性 → 受到傷害倍率（afk-resist 使用）
 *   AFK_CURVES.NONE_DREAM 席琳夢域鏡無屬性抗性門檻 → 受到傷害倍率（afk-resist 使用；門檻制，用 step）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var lerp = function (pts, x) {
    x = Number(x) || 0;
    if (x <= pts[0][0]) return pts[0][1];
    for (var i = 1; i < pts.length; i++) if (x <= pts[i][0]) { var a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
    return pts[pts.length - 1][1];
  };
  var step = function (pts, x) { x = Number(x) || 0; var v = pts[0][1]; for (var i = 0; i < pts.length; i++) if (x >= pts[i][0]) v = pts[i][1]; return v; };
  var C = W.AFK_CURVES = {
    lerp: lerp, step: step,
    MR: [[0, 1], [100, 0.5], [200, 0.4], [400, 0.25], [600, 0.13], [800, 0.05], [1000, 0.01]],
    ELE_PCT: [[0, 0], [50, 50], [300, 100]],
    ELE_DREAM: [[0, 1.5], [50, 1.0], [100, 0.8], [150, 0.7], [200, 0.6], [250, 0.5], [300, 0.4], [400, 0.3], [500, 0.2], [600, 0.15], [700, 0.10], [800, 0.01]],
    NONE_DREAM: [[0, 1], [100, 0.99], [200, 0.97], [300, 0.95], [400, 0.93], [500, 0.90], [600, 0.85], [700, 0.80], [800, 0.75], [900, 0.70], [1000, 0.64]]
  };
  W.mrMult = function (mr) { return lerp(C.MR, Math.max(0, Number(mr) || 0)); };
  // 我方受到的魔法傷害（Ping 11-13 22:05）：魔防 2000 才剩 1%（原本 1000）；怪物的魔防照舊用 MR
  C.MR_TAKEN = C.MR.map(function (pt) { return [pt[0] * 2, pt[1]]; });
  W.mrMultTaken = function (mr) { return lerp(C.MR_TAKEN, Math.max(0, Number(mr) || 0)); };
  W.effResistPct = function (v) { return lerp(C.ELE_PCT, Math.max(0, Number(v) || 0)); };
  console.log('[AFK-curves] 已啟用：魔防／屬性抗性曲線統一（一份表、一個內插函式）');
})();
