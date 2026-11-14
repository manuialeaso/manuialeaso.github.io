/* ============================================================================
 * afk-mercparagon.js — 傭兵也累積巔峰經驗（Ping 11-14 13:17：蘑菇秘境的經驗會算進巔峰，但隊伍傭兵沒吃到）
 *
 *   原本：擊殺時只有你自己的巔峰經驗會增加（LineageGrowth.gainXP），傭兵只拿一般經驗，滿等後就什麼都沒有。
 *   現在：每隻沒倒地的傭兵，照跟你同一套算法（怪物經驗 × 組隊加成 × 娃娃經驗加成 × 該傭兵自己的倍率）
 *         累積巔峰經驗；傭兵結算經驗時（回村刷新、解雇）一起記進待領，該角色下次載入或回村時加進他的巔峰。
 *   ‧巔峰本來的條件照舊：該角色要 1 轉 Lv100 以上才會累積。
 *   ‧蘑菇秘境的加強（經驗 ×5、×2）是乘在怪物經驗上，所以傭兵的巔峰也吃得到。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'mercparagon', name: '傭兵累積巔峰經驗', group: '遊戲玩法', desc: '隊伍傭兵擊殺時也累積巔峰經驗，結算時記給該角色' });
  if (T && !T.enabled('mercparagon')) return;
  var N = function (x) { return Number(x) || 0; };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var KEY = 'afk_merc_paragon_v1';
  var readQ = function () { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  var writeQ = function (q) { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch (e) {} };
  var idOf = function (slot, seed) { return String(slot) + '|' + String(seed || ''); };

  // ── 累積：擊殺時 ──
  var gainFor = function (a, mob) {
    if (!a || a._downed || N(a.rebirth) < 1 || N(a.lv) < 100 || a.classicMode) return 0;
    var v = N(mob.exp);
    try { v *= 1 + N(partyExpBonusPct()) / 100; } catch (e) {}
    try { v *= 1 + N(dollFieldVal('expBonus')) / 100; } catch (e) {}
    try { if (typeof W.__afkTtmiExpMult === 'function') v *= N(W.__afkTtmiExpMult(a)) || 1; } catch (e) {}
    try { if (typeof W.__afkExpShare === 'function') v *= N(W.__afkExpShare(a)) || 1; } catch (e) {}
    return Math.floor(v);
  };
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = typeof mapState !== 'undefined' && mapState.mobs ? mapState.mobs[idx] : null, was = !!(m && m._dead);
      var r = oKill.apply(this, arguments);
      try {
        var p = P();
        if (m && !was && m._dead && p && !p.classicMode && N(m.exp) > 0) (p.allies || []).forEach(function (a) { var g = gainFor(a, m); if (g > 0) a._pgGained = N(a._pgGained) + g; });
      } catch (e) {}
      return r;
    };
  }

  // ── 結算：跟一般經驗同時（回村刷新、解雇）記進待領 ──
  var bank = function (a) {
    if (!a || !(N(a._pgGained) > 0)) return;
    var q = readQ(), k = idOf(a._slot, a.enSeed); q[k] = N(q[k]) + Math.floor(N(a._pgGained)); writeQ(q); a._pgGained = 0;
  };
  ['_settleAllyExp', '_settleAllyExpDirect'].forEach(function (fn) {
    if (typeof W[fn] !== 'function') return;
    var o = W[fn];
    W[fn] = function (ally) { try { bank(ally); } catch (e) {} return o.apply(this, arguments); };
    try { (0, eval)(fn + ' = window.' + fn); } catch (e) {}
  });

  // ── 領取：該角色載入或回村時 ──
  var claim = function () {
    var p = P(); if (!p || p.classicMode || typeof currentSlot === 'undefined' || currentSlot == null) return;
    var q = readQ(), k = idOf(currentSlot, p.enSeed), v = Math.floor(N(q[k])); if (!(v > 0)) return;
    var G = W.LineageGrowth; if (!G || typeof G.gainXP !== 'function') return;
    delete q[k]; writeQ(q);
    try { G.gainXP(v); if (typeof logSys === 'function') logSys('<span class="text-emerald-300">當傭兵期間累積的巔峰經驗 ' + v.toLocaleString() + ' 已領取。</span>'); } catch (e) { q = readQ(); q[k] = N(q[k]) + v; writeQ(q); }
  };
  if (typeof W.loadGame === 'function') { var oLoad = W.loadGame; W.loadGame = function () { var r = oLoad.apply(this, arguments); setTimeout(claim, 500); return r; }; }
  if (typeof W.mercExpClaimPending === 'function') { var oClaim = W.mercExpClaimPending; W.mercExpClaimPending = function () { var r = oClaim.apply(this, arguments); try { claim(); } catch (e) {} return r; }; try { (0, eval)('mercExpClaimPending = window.mercExpClaimPending'); } catch (e) {} }

  W.__afkMercParagon = { claim: claim, bank: bank, gainFor: gainFor, KEY: KEY };
})();
