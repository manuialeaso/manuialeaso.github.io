/* ==========================================================================
 * afk-resist.js — 抗性新制（玩家 2026-10-21 指定；需要核心補丁 31）
 *
 * 火／水／風／地屬性抗性（你和傭兵受到屬性傷害時）——中間依兩端點等比例內插：
 *   抗性    0 → 受到的屬性傷害 +50%      抗性  50 → 正常
 *   抗性  100 → 減傷 20%   150 → 30%   200 → 40%   250 → 50%   300 → 60%   400 → 70%   500 → 80%
 *   抗性上限 500；超出的部分面板顯示成「500(+X)」：
 *   500(+100) → 85%   500(+200) → 90%   500(+300) → 99%
 *   500(+500) → 屬性傷害免疫，改當成物理傷害計算（一般攻擊照物理流程；魔法改吃無屬性抗性的物理減傷）
 *
 * 無屬性抗性：減少受到的物理傷害，在整個傷害公式算完、百分比減傷特效（上限 75%）之後才套用：
 *   每 1 點減少 1 點傷害（最多算 500 點），另外依門檻再減百分比：
 *   100 → 1%   200 → 3%   300 → 5%   400 → 7%   500 → 10%
 *   500(+100) → 15%   500(+200) → 20%   500(+300) → 25%   500(+400) → 30%   500(+500) → 減 20% 再減 20%（共 36%）
 *   無屬性魔法照舊吃原本的無屬性抗性折減。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('resist')) return;

  var CAP = 500, IMMUNE = 1000;
  var ELE_KEY = { fire: 'resFire', water: 'resWater', wind: 'resWind', earth: 'resEarth' };
  // [抗性, 受到傷害倍率]
  var PTS = [[0, 1.5], [50, 1.0], [100, 0.8], [150, 0.7], [200, 0.6], [250, 0.5], [300, 0.4], [400, 0.3], [500, 0.2], [600, 0.15], [700, 0.10], [800, 0.01]];
  var eleFactor = function (v) {
    v = Math.max(0, Number(v) || 0);
    if (v >= PTS[PTS.length - 1][0]) return PTS[PTS.length - 1][1];
    for (var i = 1; i < PTS.length; i++) {
      if (v <= PTS[i][0]) { var a = PTS[i - 1], b = PTS[i]; return a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]); }
    }
    return 1;
  };
  // 無屬性抗性的百分比部分 → 受到傷害倍率
  var nonePctMult = function (v) {
    v = Math.max(0, Number(v) || 0);
    if (v >= 1000) return 0.8 * 0.8;
    var tbl = [[900, 0.30], [800, 0.25], [700, 0.20], [600, 0.15], [500, 0.10], [400, 0.07], [300, 0.05], [200, 0.03], [100, 0.01]];
    for (var i = 0; i < tbl.length; i++) if (v >= tbl[i][0]) return 1 - tbl[i][1];
    return 1;
  };
  window.__afkEleFactor = eleFactor;
  window.__afkEleMult = function (d, ele, isPhys) {
    var key = ELE_KEY[ele]; if (!key || !d) return 1;
    var v = Number(d[key]) || 0;
    if (v >= IMMUNE) return isPhys ? 1 : nonePctMult(d.resNone);   // 屬性免疫：一般攻擊當純物理；魔法改吃物理減傷
    return eleFactor(v);
  };
  window.__afkNoneRes = function (d, dmg) {
    if (!(dmg > 0) || !d) return dmg;
    var v = Number(d.resNone) || 0; if (v <= 0) return dmg;
    var out = Math.floor(dmg * nonePctMult(v)) - Math.min(CAP, Math.floor(v));
    return Math.max(1, out);
  };

  // 能力面板：超過 500 顯示「500(+X)」
  if (typeof window._updateUIImpl === 'function') {
    var oUI = window._updateUIImpl;
    window._updateUIImpl = function () {
      var r = oUI.apply(this, arguments);
      try {
        var d = player && player.d; if (!d) return r;
        [['dt-resfire', 'resFire'], ['dt-reswater', 'resWater'], ['dt-reswind', 'resWind'], ['dt-researth', 'resEarth'], ['dt-resnone', 'resNone']].forEach(function (a) {
          var el = document.getElementById(a[0]), v = Math.round(d[a[1]] || 0); if (!el || v <= CAP) return;
          var t = CAP + '(+' + (v - CAP) + ')'; if (el.textContent !== t) el.textContent = t;
        });
      } catch (e) {}
      return r;
    };
  }

  console.log('[AFK-resist] 已啟用：屬性抗性查表（0＝+50%、500＝-80%、溢出 +500 免疫）、無屬性抗性減物理傷害');
})();
