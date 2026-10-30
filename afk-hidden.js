/* ============================================================================
 * afk-hidden.js — 隱藏條件（玩家 2026-10-29）
 *
 *   一、謀叛三人組：隊伍剛好三個人＝王子、男騎士、男法師（王族、騎士、法師各一，三人都是男性角色），
 *       在「謀叛者的低語」裡：對該副本造成的傷害 +50%、受到該副本的傷害 −50%。多一個人、少一個人或有女性角色都不算。
 *   二、王族之敵：男性的王族、騎士、法師，對傲慢之塔（含支配者傲慢之塔）的「反王肯恩」「賽尼斯(首領)」造成的傷害 +10%。
 *   三、騎士的負重（玩家 2026-10-29 21:07）：騎士（你或騎士傭兵）每 10 秒一次，物理攻擊的基礎傷害加上「負重上限 ×0.05」（加在卡片倍率等之前）。
 *   四、撼動（玩家 2026-10-30 20:43）：帶著亞丁禁衛軍（聖十字近衛／聖十字禁衛軍）進「謀叛者的低語」，禁衛軍沒有作用——不攻擊、不補血、不代扣傷害、不代死。
 *   五、不動怒威（同上）：謀叛者的低語裡的反王肯恩、魔女賽尼斯，HP 第一次掉到 50% 以下時發動：5 秒內造成的傷害 +50%、受到的傷害 −50%。
 *   都不寫在任何說明裡（小百科只寫「有隱藏條件」）。
 *   開關：隱藏規則全部合併成一個開關 hiddenbonus「隱藏規則」（玩家 2026-10-30：以後新的隱藏規則也放進來；命運 afk-fate 也看這個開關）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'hiddenbonus', name: '隱藏規則', group: '隱藏規則',
    desc: '隊伍的組成、職業與性別、帶進副本的部隊……都可能左右戰局（內容不公開）。' });
  if (T && !T.enabled('hiddenbonus')) return;
  var KNIGHT_LOAD = 0.05, KNIGHT_CD = 100;
  var TRAITOR_MAP = 'afk_traitor_whisper', TRIO = ['royal', 'knight', 'mage'], FOES = { '反王肯恩': 1, '賽尼斯(首領)': 1 };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var male = function (a) { var v = String(a && a.avatar || ''); return v === '王子' || v.charAt(0) === '男'; };
  var trio = function () {
    var p = P(); if (!p) return false;
    var party = [p].concat(p.allies || []).filter(Boolean);
    if (party.length !== 3 || !party.every(male)) return false;
    var cls = party.map(function (a) { return a.cls; }).sort();
    return cls.join(',') === TRIO.slice().sort().join(',');
  };
  var inTraitor = function () { return typeof mapState !== 'undefined' && mapState && mapState.current === TRAITOR_MAP; };
  var isMember = function (a) { var p = P(); return !!(p && a && (a === p || (p.allies || []).indexOf(a) >= 0)); };
  var kingFoe = function (actor, target) {
    if (!actor || !target || !FOES[target.n] || !male(actor) || TRIO.indexOf(actor.cls) < 0) return false;
    var m = typeof mapState !== 'undefined' && mapState ? String(mapState.current || '') : '';
    return m.indexOf('pride') === 0 || !!(typeof state !== 'undefined' && state && state.prideClimb);
  };
  var hooked = false;   // 只包一次（之後別的外掛再包 C.damage，外層就沒有旗標了）
  var hook = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function' || C.damage.__afkHidden) return; hooked = true;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      try {   // 騎士的負重：每 10 秒一次，基礎傷害 + 負重上限×0.05
        var kd = opt && opt.kind;
        if (amount > 0 && actor && actor.cls === 'knight' && isMember(actor) && (kd === 'melee' || kd === 'ranged')) {
          var t = (typeof state !== 'undefined' && state) ? Number(state.ticks) || 0 : 0;
          if (!W.__afkTestNoKnightLoad && t >= (Number(actor._afkLoadAt) || 0)) {
            var cap = Number(actor.d && actor.d.weightCapacity) || 0, add = Math.floor(cap * KNIGHT_LOAD);
            if (add > 0) { actor._afkLoadAt = t + KNIGHT_CD; arguments[2] = amount + add; }
          }
        }
      } catch (e) {}
      var v = o.apply(this, arguments);
      try {
        if (v > 0 && isMember(actor)) {
          if (inTraitor() && trio()) v = Math.floor(v * 1.5);
          if (kingFoe(actor, target)) v = Math.floor(v * 1.1);
        }
        if (v > 0 && wrath(target)) v = Math.floor(v * 0.5);   // 不動怒威：受到的傷害 −50%
      } catch (e) {}
      return v;
    };
    C.damage.__afkHidden = true;
  };
  hook(); W.addEventListener('load', hook);
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { return (mob && isMember(ent) && inTraitor() && trio()) ? 0.5 : 1; });
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { return wrath(mob) ? 1.5 : 1; });   // 不動怒威：造成的傷害 +50%

  // ── 撼動：謀叛者的低語裡亞丁禁衛軍沒有作用（afk-castle-guards 問這個）──
  W.__afkGuardShaken = function (g) { return !!(g && g.city === 'aden_elite' && inTraitor()); };
  // ── 不動怒威 ──
  var WRATH = { '反王肯恩(謀叛)': 1, '魔女賽尼斯(謀叛)': 1 }, WRATH_T = 50;
  var tk = function () { return (typeof state !== 'undefined' && state) ? Number(state.ticks) || 0 : 0; };
  function wrath(m) { return !!(m && m._afkWrathUntil && tk() <= m._afkWrathUntil); }
  var shakeLog = false;
  var step = function () {
    if (!inTraitor()) { shakeLog = false; return; }
    var p = P(); if (!p) return;
    if (!shakeLog && (p.guardsV2 || []).some(function (g) { return g && g.city === 'aden_elite'; })) {
      shakeLog = true;
      try { if (typeof logCombat === 'function') logCombat('<span class="font-bold" style="color:#94a3b8">【撼動】</span>亞丁禁衛軍望著謀叛者的旗幟，遲遲沒有舉起武器……', 'magic'); } catch (e) {}
    }
    (mapState.mobs || []).forEach(function (m) {
      if (!m || m._dead || !WRATH[m.n] || m._afkWrathDone || !(m.curHp > 0) || m.curHp > (m.hp || 0) * 0.5) return;
      m._afkWrathDone = true; m._afkWrathUntil = tk() + WRATH_T;
      try { if (typeof logCombat === 'function') logCombat('<span class="font-bold" style="color:#f97316">【不動怒威】</span>' + m.n + ' 的怒氣化成了鎧甲——5 秒內造成的傷害 +50%、受到的傷害 −50%！', 'enemy'); } catch (e) {}
    });
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var t0 = tk(), r = oTick.apply(this, arguments); if (tk() !== t0) { try { step(); } catch (e) {} } return r; };
  }
  W.__afkHidden = { trio: trio, male: male, kingFoe: kingFoe, KNIGHT_LOAD: KNIGHT_LOAD, KNIGHT_CD: KNIGHT_CD, wrath: wrath, step: step, WRATH: WRATH };
})();
