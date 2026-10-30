/* ============================================================================
 * afk-fate.js — 隱藏規則「命運」（玩家 2026-10-30 14:55；外掛開關 fate，放在「隱藏規則」，預設開）
 *
 *   隊伍＝你＋所有傭兵（依隊伍順序：你第 1 位，傭兵照名單順序）。經典模式不套用。
 *   一、同職業超過 3 位：該職業每一位造成的傷害下降——第 1～3 位 −10%、第 4 位 −20%、第 5 位起 −40%（5 位封頂）。
 *       （= 3 位以內共同的 10%＋第 4 位單獨 10%＋第 5 位單獨再 20%）
 *   二、王族＋騎士：隊伍裡有王族時，騎士超過 3 位反過來是增傷——第 1～3 位 +10%、第 4 位 +20%、第 5 位起 +40%；
 *       第 4 位騎士：全隊受到的傷害 −10%；第 5 位騎士：再 −5%（合計 −15%）。
 *   三、隊伍裡沒有王族（隊伍 5 人以上才算——你＋4 名以上傭兵；玩家 2026-10-30 18:10，原本帶 1 名傭兵就算）：
 *       全隊造成的傷害 −20%、受到的傷害 +20%、AC +50（變差）、魔防 −50、
 *       掉落機率 ×0.4（掉落種類下修到 40%）。
 *   作用點：造成的傷害＝卡片戰鬥的最後結算（AFK_CARD_COMBAT.damage，玩家、傭兵、召喚物都經過這裡，含終焉）；
 *           受到的傷害＝核心受擊（AFK_RELIC_RUNTIME.incoming）＋外掛頭目的機制傷害（__afkIncomingMod：世界事件、霸主、幽靈船、終焉…）；
 *           AC／魔防：玩家在重算能力後加上，傭兵每秒校正一次；掉落：partyDropRate。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'fate', name: '命運', group: '隱藏規則', desc: '隊伍的組成會左右戰局（隱藏條件）。' });
  var on = function () { if (W.__afkTestNoFate) return false; return !T || T.enabled('fate'); };   // 測試瀏覽器預設關（只有 test-fate 打開）
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var tk = function () { try { return Number(state.ticks) || 0; } catch (e) { return 0; } };
  var CLASS_STEP = [0.10, 0.10, 0.10, 0.20, 0.40];   // 第 1～5 位（之後同第 5 位）
  var KNIGHT_GUARD = [0.10, 0.05];                     // 第 4、5 位騎士給全隊的減傷
  var NO_ROYAL = { out: 0.8, inc: 1.2, ac: 50, mr: -50, drop: 0.4, min: 5 };   // min：隊伍至少幾人才算（玩家 2026-10-30 18:10：5 人以上）

  // ── 計算（每個 tick、隊伍不變就重用）──
  var cache = { key: '', v: null };
  var compute = function () {
    var p = P(); if (!p || !on() || p.classicMode) return null;
    var allies = (p.allies || []).filter(Boolean), members = [p].concat(allies);
    var key = tk() + '|' + members.map(function (m) { return (m._slot || 'p') + ':' + m.cls; }).join(',');
    if (cache.key === key) return cache.v;
    var hasRoyal = members.some(function (m) { return m.cls === 'royal'; }), party = members.length >= NO_ROYAL.min;
    var out = new Map(), byCls = {};
    members.forEach(function (m) { (byCls[m.cls] = byCls[m.cls] || []).push(m); out.set(m, 1); });
    var knights = 0;
    Object.keys(byCls).forEach(function (c) {
      var g = byCls[c]; if (g.length <= 3) return;
      var bonus = c === 'knight' && hasRoyal;
      if (bonus) knights = g.length;
      g.forEach(function (m, i) { var s = CLASS_STEP[Math.min(i, CLASS_STEP.length - 1)]; out.set(m, bonus ? 1 + s : 1 - s); });
    });
    var inc = 1, guard = 0;
    if (knights >= 4) guard += KNIGHT_GUARD[0];
    if (knights >= 5) guard += KNIGHT_GUARD[1];
    inc *= (1 - guard);
    var noRoyal = party && !hasRoyal;
    if (noRoyal) { members.forEach(function (m) { out.set(m, out.get(m) * NO_ROYAL.out); }); inc *= NO_ROYAL.inc; }
    var v = { out: out, inc: inc, guard: guard, noRoyal: noRoyal, ac: noRoyal ? NO_ROYAL.ac : 0, mr: noRoyal ? NO_ROYAL.mr : 0, drop: noRoyal ? NO_ROYAL.drop : 1, members: members };
    cache = { key: key, v: v };
    return v;
  };
  var outMult = function (actor) { var v = compute(); if (!v || !actor) return 1; var m = v.out.get(actor); return m == null ? 1 : m; };
  var isMember = function (ent) { var v = compute(); return !!(v && ent && v.out.has(ent)); };
  var incMult = function (ent) { var v = compute(); return (v && isMember(ent)) ? v.inc : 1; };

  // ── 造成的傷害 ──
  var hookOut = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.__afkFate) return;   // 旗標放在物件上：別的外掛之後再包一層也不會重複套用
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var r = o.apply(this, arguments);
      try { if (r > 0 && on() && actor && !isMember(target)) { var m = outMult(actor); if (m !== 1) r = Math.max(1, Math.floor(r * m)); } } catch (e) {}
      return r;
    };
    C.__afkFate = true;
  };
  // ── 受到的傷害 ──
  var hookIn = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R || typeof R.incoming !== 'function' || R.__afkFate) return;
    var o = R.incoming;
    R.incoming = function (actor, amount) {
      var r = o.apply(this, arguments);
      try { if (r > 0 && on()) { var m = incMult(actor); if (m !== 1) r = Math.max(1, Math.floor(r * m)); } } catch (e) {}
      return r;
    };
    R.__afkFate = true;
  };
  var prevInc = W.__afkIncomingMod;
  W.__afkIncomingMod = function (t, dmg) {
    if (typeof prevInc === 'function') dmg = prevInc(t, dmg);
    try { if (dmg > 0 && on()) { var m = incMult(t); if (m !== 1) dmg = dmg * m; } } catch (e) {}
    return dmg;
  };
  hookOut(); hookIn(); W.addEventListener('load', function () { hookOut(); hookIn(); });

  // ── AC／魔防 ──
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try { var p = P(), v = compute(); if (p && p.d && v && (v.ac || v.mr)) { p.d.ac = (Number(p.d.ac) || 0) + v.ac; p.d.mr = Math.max(0, (Number(p.d.mr) || 0) + v.mr); } } catch (e) {}
      return r;
    };
  }
  var syncAllies = function () {
    var p = P(); if (!p) return;
    var v = compute(), want = { ac: v ? v.ac : 0, mr: v ? v.mr : 0 };
    (p.allies || []).forEach(function (a) {
      if (!a || !a.d) return;
      var ap = a._afkFate;
      if (!ap || ap.d !== a.d || ap.rn !== a._recompN) ap = { ac: 0, mr: 0 };   // 能力重建過＝之前加的已經不在了
      var dac = want.ac - ap.ac, dmr = want.mr - ap.mr;
      if (dmr < 0) dmr = -Math.min(-dmr, Math.max(0, Number(a.d.mr) || 0));   // 魔防不扣到負數
      if (dac) a.d.ac = (Number(a.d.ac) || 0) + dac;
      if (dmr) a.d.mr = (Number(a.d.mr) || 0) + dmr;
      a._afkFate = { ac: ap.ac + dac, mr: ap.mr + dmr, d: a.d, rn: a._recompN };
    });
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var r = oTick.apply(this, arguments); try { if (tk() % 10 === 0) syncAllies(); } catch (e) {} return r; };
  }
  // ── 掉落 ──
  if (typeof W.partyDropRate === 'function') {
    var oDrop = W.partyDropRate;
    W.partyDropRate = function (rate) { var r = oDrop.apply(this, arguments); try { var v = compute(); if (v && v.drop !== 1) r = r * v.drop; } catch (e) {} return r; };
  }

  W.__afkFate = { compute: compute, outMult: outMult, incMult: incMult, syncAllies: syncAllies, CLASS_STEP: CLASS_STEP, KNIGHT_GUARD: KNIGHT_GUARD, NO_ROYAL: NO_ROYAL,
    _reset: function () { cache = { key: '', v: null }; } };
})();
