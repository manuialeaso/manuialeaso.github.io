/* ============================================================================
 * afk-stackdot.js — 可疊層的中毒／灼燒（玩家 2026-10-21 指定）
 *
 * 核心的中毒、灼燒每隻怪同時只能有一個；遺物規格需要「中毒疊 N 層」「灼燒疊 N 層」，
 * 所以另做一套跟出血一樣「一層一筆」的機制，跟核心原本的中毒／灼燒並存、互不影響。
 *
 * 規則（docs/relic-ascension-spec.md）：
 *   ‧上限 20 層；規格有寫「疊 N 層」才能疊，沒寫的永遠只有 1 層（呼叫時不給層數＝1 層）
 *   ‧滿層後再施加：移除最舊的一層、補上新的一層（同出血）
 *   ‧每秒結算一次，所有層加總；同樣受「持續傷害每秒最多扣最大 HP 1%」的上限（__afkDotCap）
 *
 * 給其他外掛呼叫：
 *   window.__afkStackDot.apply(mob, 'poison' | 'burn', 每秒傷害, 持續秒數, 最多幾層, 施加者)
 *   window.__afkStackDot.layers(mob, 'poison')   // 目前層數
 * ========================================================================== */
(function () {
  'use strict';
  var MAX = 20;
  var NAME = { poison: '中毒', burn: '灼燒' };
  var apply = function (m, kind, dps, durSec, maxLayers, src) {
    if (!m || m._dead || !NAME[kind] || !(dps > 0)) return 0;
    var cap = Math.max(1, Math.min(MAX, Math.floor(Number(maxLayers) || 1)));
    var st = m._afkStack || (m._afkStack = {});
    var arr = st[kind] || (st[kind] = []);
    st[kind + 'Cap'] = Math.max(cap, st[kind + 'Cap'] || 0);   // 多來源共用：取曾出現過的最高上限（同出血）
    while (arr.length >= st[kind + 'Cap']) arr.shift();
    arr.push({ dps: Math.max(1, Math.floor(dps)), ticksLeft: Math.max(1, Math.round((Number(durSec) || 8) * 10)) });
    st[kind + 'Src'] = src || 'player';
    return arr.length;
  };
  var layers = function (m, kind) { return (m && m._afkStack && m._afkStack[kind]) ? m._afkStack[kind].length : 0; };
  var process = function (m, i) {
    var st = m && m._afkStack; if (!st) return false;
    var t = (typeof state !== 'undefined' && state) ? state.ticks : 0;
    for (var kind in NAME) {
      var arr = st[kind]; if (!arr || !arr.length) continue;
      var sum = 0;
      for (var k = arr.length - 1; k >= 0; k--) { arr[k].ticksLeft--; if (t % 10 === 0) sum += arr[k].dps; if (arr[k].ticksLeft <= 0) arr.splice(k, 1); }
      if (!arr.length) st[kind + 'Cap'] = 0;
      if (sum > 0) {
        if (typeof window.__afkDotCap === 'function') sum = window.__afkDotCap(m, sum);
        if (sum > 0) {
          if(window.AFK_CARD_COMBAT)sum=window.AFK_CARD_COMBAT.damage(window.AFK_CARD_COMBAT.sourceActor(st[kind + 'Src']),m,sum,{kind:'dot',dotCapped:true}); m.curHp -= sum; m.justHit /* card-combat:stack-dot */ = kind === 'burn' ? 'fire' : 'magic';
          try { mobWake(m); } catch (e) {}
          try { if (typeof _dpsCreditDot === 'function') _dpsCreditDot(st[kind + 'Src'], sum); } catch (e) {}
          try { if (!state.ff) logCombat('<span class="' + getMobColor(m.lv) + '">' + m.n + '</span> 受到' + NAME[kind] + '傷害 ' + sum + ' 點（' + (arr.length || 1) + ' 層）。', 'dot'); } catch (e) {}
          if (m.curHp <= 0) { killMob(i); return true; }
        }
      }
    }
    return false;
  };
  if (typeof window.processMobStatusTick === 'function') {
    var oProc = window.processMobStatusTick;
    window.processMobStatusTick = function (m, i) {
      var dead = oProc.apply(this, arguments);
      if (dead) return dead;
      try { return process(m, i) || false; } catch (e) { return false; }
    };
  }
  window.__afkStackDot = { apply: apply, layers: layers, MAX: MAX };
  console.log('[AFK-stackdot] 已啟用：可疊層中毒／灼燒（上限 20 層）');
})();
