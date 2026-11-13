/* ============================================================================
 * afk-balance1101.js — 平衡調整（玩家 2026-11-01 17:27／17:36；經典模式一律不套用）
 *
 *   一、範圍魔法 3 秒冷卻（外掛開關 aoecd，預設開）：
 *       範圍魔法＝攻擊類、魔法傷害、打全體的法術（流星雨、冰雪暴、龍捲風、火風暴、雷霆風暴、極光雷電…）。
 *       施放成功後，同一個施法者 3 秒內不能再放同一招（玩家：攻擊技能、熱鍵、手動都算；傭兵：技能設定的攻擊技能）。
 *       冷卻中：玩家這次施法間隔空著（有熱鍵自動格時換別的法術）；傭兵改用普攻。
 *       迴響精通的連發、魔法精通（王族）的免費追加施放不受限，也不會讓冷卻重算。單體魔法、物理技能不受影響。
 *   一之二、粉碎能量 3 秒冷卻（玩家 2026-11-01 18:23「跟汙濁之水一樣獨立冷卻」；外掛開關 crushcd，預設開）：
 *       幻術師的「粉碎能量」放完後同一個施法者 3 秒內不能再放（跟範圍魔法同一套：玩家這次間隔空著／換熱鍵自動格，傭兵改普攻）。
 *   二、奇古獸的額外傷害不再乘魔法倍率（外掛開關 qiguflat，預設開）：
 *       原本（武器骰＋額外傷害＋魔法傷害）×魔法倍率（約 18 倍），物理用的「額外傷害」被放大十幾倍；
 *       改成（武器骰＋魔法傷害）×魔法倍率＋額外傷害，跟物理普攻一樣直接加上去。玩家與傭兵都一樣（核心補丁 79 呼叫這裡）。
 *   三、頭目的衝擊之暈必中（玩家 2026-11-01 18:23；外掛開關 bossstun，預設開）：
 *       頭目施放「衝擊之暈」（魔法型、附帶暈眩型、物理附加暈眩型都算；暗夢星迴、夢域頭目的群體衝擊之暈也算）
 *       不再看魔防、暈眩抵抗%——100% 暈眩；只有身上有「免疫暈眩」效果（裝備或遺物的免疫暈眩）才擋得住。玩家與傭兵都一樣。
 *   四、暈眩中受到的傷害 +15%（同上；外掛開關 stunvuln，預設開）：你與傭兵在暈眩狀態下受到的所有傷害 ×1.15。
 *   三、四經典模式都不套用。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) {
    T.register({ id: 'aoecd', name: '範圍魔法 3 秒冷卻', group: '遊戲玩法', seal: true,
      desc: '打全體的攻擊魔法（流星雨、冰雪暴、龍捲風…）放完後同一招 3 秒內不能再放；玩家與傭兵都套用，經典模式不套用' });
    T.register({ id: 'crushcd', name: '粉碎能量 3 秒冷卻', group: '遊戲玩法', seal: true,
      desc: '幻術師的「粉碎能量」放完後 3 秒內不能再放（獨立冷卻，跟汙濁之水一樣）；玩家與傭兵都套用，經典模式不套用' });
    T.register({ id: 'bossstun', name: '頭目的衝擊之暈必中', group: '遊戲玩法', seal: true,
      desc: '頭目的衝擊之暈不看魔防與暈眩抵抗，100% 暈眩；只有身上有免疫暈眩效果才擋得住。經典模式不套用' });
    T.register({ id: 'stunvuln', name: '暈眩中受到的傷害 +15%', group: '遊戲玩法', seal: true,
      desc: '你與傭兵在暈眩狀態下受到的傷害 +15%；經典模式不套用' });
    T.register({ id: 'qiguflat', name: '奇古獸額外傷害不乘魔法倍率', group: '遊戲玩法', seal: true,
      desc: '奇古獸普攻的「額外傷害」改成直接加上去（跟物理普攻一樣），不再跟魔法傷害一起乘魔法倍率；經典模式不套用' });
  }
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var classic = function (x) { var p = P(); return !!((x && x.classicMode) || (p && p.classicMode)); };
  var tk = function () { return (typeof state !== 'undefined' && state && Number(state.ticks)) || 0; };
  var EV = function (s) { try { return (0, eval)(s); } catch (e) { return undefined; } };

  // ── 一、範圍魔法冷卻 ──
  var AOE_CD = 30;   // 3 秒（tick＝0.1 秒）
  var aoeOn = function (x) { return (!T || T.enabled('aoecd')) && !classic(x); };
  var isAoe = function (sk) { return !!(sk && sk.type === 'atk' && sk.dmgType === 'magic' && sk.target === 'all'); };
  var CRUSH = 'sk_illu_crush';
  var isCrush = function (sk) { return !!(sk && DB.skills[CRUSH] === sk); };
  // 這一招對這個施法者有沒有 3 秒冷卻（範圍魔法看 aoecd、粉碎能量看 crushcd；經典模式都沒有）
  var cdOn = function (sk, x) {
    if (classic(x)) return false;
    if (isAoe(sk)) return !T || T.enabled('aoecd');
    if (isCrush(sk)) return !T || T.enabled('crushcd');
    return false;
  };
  var cds = new WeakMap();   // 施法者 → { 技能 id: 冷卻到期 tick }
  var mapOf = function (x) { var m = cds.get(x); if (!m) { m = Object.create(null); cds.set(x, m); } return m; };
  // 冷卻長度：範圍魔法在隱藏規則開著時是 3.5 秒（afk-hidden 的 __afkHiddenAoeCd），其餘 3 秒
  var cdLen = function (sk, x) { var h = W.__afkHiddenAoeCd, v = 0; try { v = typeof h === 'function' ? Number(h(sk, x)) || 0 : 0; } catch (e) {} return v > 0 ? v : AOE_CD; };
  var left = function (x, sid) {
    if (!x || !sid) return 0;
    var m = cds.get(x); if (!m || !m[sid]) return 0;
    var l = m[sid] - tk(); if (l > cdLen(DB.skills[sid], x) || l <= 0) { delete m[sid]; return 0; }   // 讀檔後 tick 重算：超過冷卻長度的視為過期
    return l;
  };
  // 這一次免冷卻（背神者本人、聖紋 E 回響 10%…；afk-arts、afk-sigil 掛在 __afkAoeCdFree）
  var lastFree = { x: null, sk: null, t: -1 };   // 最近一次免冷卻（熱鍵自動格讀這個，不再擲一次骰子）
  var cdFree = function (sk, x) { var f = W.__afkAoeCdFree, r = false; if (!isAoe(sk) || typeof f !== 'function') return false; try { r = !!f(sk, x); } catch (e) { r = false; } if (r) { lastFree.x = x; lastFree.sk = sk; lastFree.t = tk(); } return r; };
  var freeNow = function (x, sid) { return !!(sid && lastFree.x === x && lastFree.sk === DB.skills[sid] && lastFree.t === tk()); };
  var mark = function (x, sid) { if (x && sid) mapOf(x)[sid] = tk() + cdLen(DB.skills[sid], x); };

  // 玩家：castSkill
  if (typeof W.castSkill === 'function') {
    var oCast = W.castSkill;
    W.castSkill = function (skId) {
      var sk = DB.skills[skId], p = P();
      if (!p || !cdOn(sk, p)) return oCast.apply(this, arguments);
      var free = !!(EV('typeof _royalFreeCast !== "undefined" && _royalFreeCast') || EV('typeof _echoFree !== "undefined" && _echoFree'));
      if (!free && left(p, skId) > 0) return false;
      var r = oCast.apply(this, arguments);
      if (r && !free && !cdFree(sk, p)) mark(p, skId);
      return r;
    };
    try { (0, eval)('castSkill = window.castSkill'); } catch (e) {}
  }
  // 傭兵：技能回合的閘門
  if (typeof W.allyActWithSkillGate === 'function') {
    var oGate = W.allyActWithSkillGate;
    W.allyActWithSkillGate = function (ally, actFn) {
      var sid = ally && ally._atkSkill, sk = sid && DB.skills[sid];
      if (!cdOn(sk, ally)) return oGate.apply(this, arguments);
      if (left(ally, sid) > 0) {   // 冷卻中：這一回合普攻
        ally._atkSkill = '';
        try { return oGate.call(this, ally, actFn); } finally { ally._atkSkill = sid; }
      }
      var r = oGate.apply(this, arguments);
      if (r === true && !cdFree(sk, ally)) mark(ally, sid);
      return r;
    };
    try { (0, eval)('allyActWithSkillGate = window.allyActWithSkillGate'); } catch (e) {}
  }

  // ── 二、奇古獸額外傷害 ──
  var qOn = function (x) { return (!T || T.enabled('qiguflat')) && !classic(x); };
  W.__afkQiguFlat = function (raw, actor, wpn, target, ele) {
    try {
      if (!actor || !qOn(actor)) return raw;
      var d = actor.d || {}, ex = Math.max(0, Number(d.extraDmg) || 0); if (!ex) return raw;
      var B = W.AFK_RELIC_WEAPON_BRIDGE;
      var coef = B ? B.qiguCoef(actor, wpn, target, ele) : weaponMagicDamageCoef(d, wpn, target, ele);
      if (!(coef > 0)) return raw;
      return Math.max(0, raw - ex * coef + ex);
    } catch (e) { return raw; }
  };


  // ── 三、頭目的衝擊之暈必中 ──
  var SHOCK = '衝擊之暈';
  var shockOn = function (mob) { var p = P(); return !!(mob && mob.boss && p && !p.classicMode && (!T || T.enabled('bossstun'))); };
  var SLOTS = function () { return (typeof WEIGHT_COUNT_SLOTS !== 'undefined' && WEIGHT_COUNT_SLOTS) || ['wpn', 'offwpn', 'shield', 'helm', 'armor', 'shin', 'tshirt', 'cloak', 'gloves', 'boots', 'amulet', 'ear1', 'ear2', 'ring1', 'ring2', 'ring3', 'ring4', 'belt', 'eye', 'pet', 'doll']; };
  // 免疫暈眩：單件裝備就「免疫暈眩」（immStun，或單件暈眩抵抗 100%＝混沌頭盔、死亡之盾），或已經算進能力值的免疫（d.immStun）。
  //   多件抵抗加起來到 100% 不算免疫。遺物、技藝等的免疫暈眩由遺物防禦橋接在寫入暈眩時照樣擋下。
  var stunImmune = function (who) {
    if (!who) return false;
    try { if (W.__afkAbnForce && W.__afkAbnForce.scope()) return false; } catch (e) {}   // 次元裂縫／GD：強制異常（afk-abnforce），免疫不算
    if (who.immStun || (who.d && who.d.immStun)) return true;
    var eq = who.eq || {}, ks = SLOTS();
    for (var i = 0; i < ks.length; i++) { var e = eq[ks[i]], dd = e && DB.items[e.id]; if (dd && (dd.immStun || (Number(dd.stunResist) || 0) >= 100)) return true; }
    return false;
  };
  var shockDepth = 0;
  var inShock = function (fn) { shockDepth++; try { return fn(); } finally { shockDepth--; } };
  var BIG = 1e7;
  var boosted = function (sk) {   // 機率拉滿：(pbase − 魔防)/2 遠大於 100
    var c = {}; for (var k in sk) c[k] = sk[k];
    if (c.type === 'stun') c.pbase = BIG;
    if (c.sec && c.sec.type === 'stun') { var s2 = {}; for (var j in c.sec) s2[j] = c.sec[j]; s2.pbase = BIG; c.sec = s2; }
    return c;
  };
  var isShock = function (sk) { return !!(sk && sk.skn === SHOCK && (sk.type === 'stun' || (sk.sec && sk.sec.type === 'stun'))); };
  // 抵抗判定：衝擊之暈期間只看免疫
  if (typeof W.playerStatusResisted === 'function') {
    var oPSR = W.playerStatusResisted;
    W.playerStatusResisted = function (kind) { if (shockDepth > 0 && kind === 'stun') return stunImmune(P()); return oPSR.apply(this, arguments); };
    try { (0, eval)('playerStatusResisted = window.playerStatusResisted'); } catch (e) {}
  }
  if (typeof W.allyStatusResisted === 'function') {
    var oASR = W.allyStatusResisted;
    W.allyStatusResisted = function (ally, kind) { if (shockDepth > 0 && kind === 'stun') return stunImmune(ally); return oASR.apply(this, arguments); };
    try { (0, eval)('allyStatusResisted = window.allyStatusResisted'); } catch (e) {}
  }
  // 傭兵主要暈眩那條原本不看抵抗：免疫的直接擋下
  var wrapMagic = function (name, allyArg) {
    if (typeof W[name] !== 'function') return;
    var o = W[name];
    W[name] = function (mob, sk) {
      if (!isShock(sk) || !shockOn(mob)) return o.apply(this, arguments);
      var who = allyArg ? arguments[2] : P(), args = Array.prototype.slice.call(arguments);
      if (sk.type === 'stun' && stunImmune(who)) {
        try { if (typeof logCombat === 'function') logCombat('<span class="text-sky-300 font-bold">' + (allyArg ? ((who && who._allyName) || '傭兵') + ' 免疫' : '你免疫了') + '暈眩！</span>', 'magic'); } catch (e) {}
        return;
      }
      args[1] = boosted(sk);
      var self = this;
      return inShock(function () { return o.apply(self, args); });
    };
    try { (0, eval)(name + ' = window.' + name); } catch (e) {}
  };
  wrapMagic('applyMobMagic', false);
  wrapMagic('applyMobMagicToAlly', true);
  // 物理附加暈眩（衝擊之暈的「命中後機率暈眩」）：頭目的改成必中
  if (typeof W.enemyPhysicalAttack === 'function') {
    var oEPA = W.enemyPhysicalAttack;
    W.enemyPhysicalAttack = function (mob, idx, stunChance) {
      if (!(stunChance > 0) || !shockOn(mob)) return oEPA.apply(this, arguments);
      var args = Array.prototype.slice.call(arguments); args[2] = 1000;
      var self = this;
      return inShock(function () { return oEPA.apply(self, args); });
    };
    try { (0, eval)('enemyPhysicalAttack = window.enemyPhysicalAttack'); } catch (e) {}
  }
  // 給其他外掛（夢域頭目的群體衝擊之暈）：回傳「這個人擋不擋得住」；規則沒開回傳 null＝照原本判定
  W.__afkShockResist = function (who, mob) { return shockOn(mob) ? stunImmune(who) : null; };

  // ── 四、暈眩中受到的傷害 +15% ──
  var VULN = 1.15;
  var stunned = function (ent) { var st = ent && (ent.statuses || ent._statuses); return !!(st && st.stun > 0); };
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent) {
    var p = P(); if (!p || p.classicMode || (T && !T.enabled('stunvuln'))) return 1;
    if (!(ent === p || (p.allies || []).indexOf(ent) >= 0)) return 1;
    return stunned(ent) ? VULN : 1;
  });

  W.__afkBalance1101 = { AOE_CD: AOE_CD, cdLen: cdLen, isAoe: isAoe, isCrush: isCrush, cdOn: cdOn, aoeLeft: left, aoeOn: aoeOn, freeNow: freeNow, qOn: qOn, stunImmune: stunImmune, shockOn: shockOn, VULN: VULN };
})();
