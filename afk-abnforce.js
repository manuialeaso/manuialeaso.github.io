/* ============================================================================
 * afk-abnforce.js — 次元裂縫、GD之子的期待：敵人的異常狀態是「強制」的（隱藏規則，Ping 2026-11-13 17:31／17:40）
 *
 *   範圍：次元裂縫裡（不在村莊）以及 GD之子的期待裡，所有敵人（王與小怪）對你和傭兵施加的負面狀態。女神戰不算。經典模式沒有。
 *   ‧強制：裝備、娃娃的「免疫○○」不再生效；異常狀態抵抗最多只算 80%（抵抗中了就不會上身）。
 *   ‧上身後照「異常狀態持續時間」縮短（你本來就有；傭兵在這裡用他自己的來源算）。
 *   ‧每次上身有 5% 機率「持續時間的減少」算 2 倍：例如持續時間 −80% → 那一次 −160%，等於沒上身。
 *   做法：最外層包 playerStatusResisted／allyStatusResisted（核心的抵抗判定）、afk-balance1101 的衝擊之暈免疫在範圍內不算、AFK_RELIC_DEFENSE_BRIDGE.setStatus（副本機制直接上狀態的路徑），
 *         每 tick 看新上身或被刷新的狀態再做 5% 判定（跟 afk-carve 的持續時間同一套做法，這支載入在它們後面）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'abnforce', name: '次元裂縫／GD 的強制異常', group: '遊戲玩法', desc: '次元裂縫與 GD之子的期待裡，敵人的異常狀態無視免疫、抵抗最多 80%；5% 機率持續時間的減少加倍' });
  if (T && !T.enabled('abnforce')) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var CAP = 80, DOUBLE = 0.05;
  var DEBUFFS = ['stun', 'freeze', 'stone', 'poison', 'burn', 'scald', 'bleed', 'sleep', 'silence', 'paralyze', 'magicseal', 'armorBreak', 'slowAtk', 'bind',
    'blind', 'weaken', 'disease', 'potionFrost', 'foulWater', 'slow', 'broken', 'confuse', 'panic', 'terror', 'fragile', 'curse', 'decay', 'mrhalf'];
  var inTown = function () { try { return !!(DB.towns && DB.towns[mapState.current]) || String(mapState.current || '').indexOf('town_') === 0; } catch (e) { return false; } };
  var scope = function () {
    var p = P(); if (!p || p.classicMode) return false;
    try { var FB = W.__afkFinalBoss; if (FB && mapState.current === FB.MAP) return false; } catch (e) {}
    try { if (W.__afkGdRiftOn && W.__afkGdRiftOn()) return true; } catch (e) {}
    try { return !!(W.__afkDimRift && W.__afkDimRift.on() && !inTown()); } catch (e) { return false; }
  };
  var party = function () { var p = P(); if (!p) return []; return [p].concat((p.allies || []).filter(function (a) { return a && !a._downed; })); };
  var isOurs = function (x) { var p = P(); return !!(x && p && (x === p || (p.allies || []).indexOf(x) >= 0)); };
  var RESF = { freeze: 'freezeResist', stun: 'stunResist', paralyze: 'paralyzeResist', sleep: 'sleepResist', slow: 'slowResist', poison: 'poisonResist' };
  // 抵抗＝全身的異常狀態抵抗＋該種類的抵抗（＋王者加護、鯤），不算免疫，最多 80%
  var resistOf = function (x, kind) {
    var r = 0, f = kind && RESF[kind];
    try { (typeof WEIGHT_COUNT_SLOTS !== 'undefined' ? WEIGHT_COUNT_SLOTS : []).forEach(function (k) { var e = x.eq && x.eq[k], dd = e && DB.items[e.id]; if (!dd) return; r += N(dd.abnormalResist); if (f) r += N(dd[f]); }); } catch (e) {}
    if (kind === 'stun' && x.skills && x.skills.indexOf('sk_royal_kingguard') >= 0) r += 20;
    try { if (x === P() && W.__afkCarve && W.__afkCarve.fx) r += N(W.__afkCarve.fx(x).abn); } catch (e) {}
    return Math.min(CAP, Math.max(0, r));
  };
  var durOf = function (x) { try { return W.__afkCarve && W.__afkCarve.durTotal ? Math.max(0, Math.min(0.95, N(W.__afkCarve.durTotal(x)))) : 0; } catch (e) { return 0; } };
  var say = function (x, h) { try { if (typeof logCombat === 'function' && !(typeof state !== 'undefined' && state.ff)) logCombat(h, 'magic'); } catch (e) {} };
  var who = function (x) { return x === P() ? '你' : (x._allyName || x.name || '隊友'); };

  // ── 核心的抵抗判定（最外層）：範圍內只看抵抗（最多 80%），免疫不算 ──
  var hookRes = function () {
    ['playerStatusResisted', 'allyStatusResisted'].forEach(function (fn) {
      var o = W[fn]; if (typeof o !== 'function' || o.__afkForce) return;
      var f = fn === 'playerStatusResisted'
        ? function (kind) { if (!scope()) return o.apply(this, arguments); return Math.random() * 100 < resistOf(P(), kind); }
        : function (ally, kind) { if (!scope()) return o.apply(this, arguments); return Math.random() * 100 < resistOf(ally, kind); };
      f.__afkForce = true; W[fn] = f;
      try { (0, eval)(fn + ' = window.' + fn); } catch (e) {}
    });
  };
  hookRes(); W.addEventListener('load', hookRes);

  // ── 副本機制直接上的狀態：先判抵抗（最多 80%）──
  var hookSet = function () {
    var B = W.AFK_RELIC_DEFENSE_BRIDGE; if (!B || typeof B.setStatus !== 'function' || B.__afkForce) return;
    var o = B.setStatus;
    B.setStatus = function (actor, key, ticks, attacker) {
      try {
        if (N(ticks) > 0 && isOurs(actor) && DEBUFFS.indexOf(key) >= 0 && scope()) {
          var r = resistOf(actor, key), st = actor.statuses || actor._statuses || actor.st || (actor.statuses = {});
          if (r > 0 && Math.random() * 100 < r) { say(actor, '<span class="text-sky-300 font-bold">' + who(actor) + '抵抗了這次異常狀態。</span>'); return N(st[key]); }
          var out = o.apply(this, arguments);
          if (N(st[key]) < N(ticks)) st[key] = Math.max(1, Math.round(N(ticks)));   // 強制：遺物、技藝的免疫不算
          return N(st[key]);
        }
      } catch (e) {}
      return o.apply(this, arguments);
    };
    B.__afkForce = true;
  };
  hookSet(); W.addEventListener('load', hookSet);

  // ── 上身後：傭兵的持續時間縮短；5% 機率減少加倍 ──
  var last = new WeakMap();
  var tick = function () {
    if (!scope()) return;
    party().forEach(function (x) {
      var st = x.statuses || x._statuses; if (!st || typeof st !== 'object') return;
      var prev = last.get(x) || {}, now = {}, D = durOf(x), isP = x === P();
      DEBUFFS.forEach(function (k) {
        var v = N(st[k]), pv = N(prev[k]);
        if (v > 0 && v > pv) {
          // 你的持續時間縮短已經由各來源套過；傭兵在這裡套
          var orig = isP ? (D < 1 ? v / (1 - D) : v) : v;
          if (!isP && D > 0) v = Math.max(1, Math.round(orig * (1 - D)));
          if (D > 0 && Math.random() < DOUBLE) {
            var left = orig * (1 - 2 * D);
            if (left <= 0) { v = 0; say(x, '<span class="text-emerald-300 font-bold">' + who(x) + '身上的異常狀態一上身就消散了。</span>'); }
            else v = Math.max(1, Math.min(v, Math.round(left)));
          }
          if (v !== N(st[k])) st[k] = v;
        }
        now[k] = v;
      });
      last.set(x, now);
    });
  };
  var bind = function () { var X = W.__afkProc; if (X && X.on && !bind.done) { X.on('tick', tick); bind.done = true; } };
  bind(); W.addEventListener('load', bind);

  W.__afkAbnForce = { scope: scope, resistOf: resistOf, durOf: durOf, CAP: CAP, DOUBLE: DOUBLE };
})();
