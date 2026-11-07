/* ============================================================================
 * afk-evolve.js — 職業進化（第一批：召喚、寵物、爆發流派＋王族「意志」；設計稿 skill-evolution-design 第四版、evolution-batch1、decisions-1107）
 *
 *   NPC：席琳神殿 技藝導師 薇爾娜（跟技能強化同一位，頁面下方多一段「職業進化」）。
 *   三段（照順序，選了流派就不能換）：
 *     一：本人 1 轉以上；交出同職業 0 轉 Lv100 的存檔 → 選流派，拿第一段效果。
 *     二：本人 2 轉；交出同職業 1 轉 Lv100 的存檔 → 第二段效果＋第二段光環。
 *     三：本人 2 轉、而且打贏終焉第三階層；交出同職業 2 轉 Lv100 的存檔 → 第三段效果＋第三段光環。
 *   交出的存檔會被刪除（兩次確認，第二次要打字輸入角色名）；交過的角色（enSeed）記在帳號上，不能再交一次。
 *   傭兵：不能進化；隊長（你）的光環會分享給傭兵。
 *   這一版做的是「數值類」效果（召喚物／寵物的 HP 與傷害、爆擊傷害、對低血頭目的加成、光環）；
 *     需要改核心機制的（召喚隻數、寵物出戰上限、繼承面板、召喚物替你施法、幼龍、全職業增益技能…）列在 TODO，第二輪再做。
 *   經典模式沒有；外掛開關 evolve。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (W.AFK_TOGGLES && W.AFK_TOGGLES.register) W.AFK_TOGGLES.register({ id: 'evolve', name: '職業進化', desc: '席琳神殿 技藝導師 薇爾娜：交出同職業存檔，三段進化（流派、光環）', group: '成長', def: true });
  if (W.AFK_TOGGLES && !W.AFK_TOGGLES.enabled('evolve')) return;
  if (typeof DB === 'undefined') return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var NPC_ID = 'npc_afk_skillup', USED_KEY = 'afk_evo_used_v1';
  var CLS_N = { knight: '騎士', mage: '法師', elf: '妖精', dark: '黑暗妖精', illusion: '幻術士', dragon: '龍騎士', warrior: '戰士', royal: '王族' };

  // ── 流派（數值已含混合 ×1.2）──
  //   comp：玩家自己的同伴（pet／summon／spirit）最大 HP、直接傷害 +%（累計）
  //   crit：玩家自己的爆擊傷害 +點（%）；lowBoss：對 HP 低於 30% 的頭目，爆擊傷害再 +點
  //   team：隊伍（不含你）的直接傷害 +%（爆擊傷害加成以期望值換算：爆擊率 30%）
  //   selfCut：你給隊伍的精準目標、呼喚盟友效果 −%（影之君主的代價）
  //   aura：[二段, 三段] 光環；aura 物件 { dmg（全隊造成傷害 +%）, crit（全隊爆擊傷害 +點）, comp（全隊召喚物、寵物傷害 +%）, compTaken（召喚物、寵物受到的傷害 −%）, exSelf（不含你） }
  var AURA_SUMMON = [{ comp: 10 }, { compTaken: 15 }], AURA_SUMMON_X = [{ comp: 12 }, { compTaken: 18 }];
  var AURA_BURST = [{ dmg: 5 }, { crit: 10 }], AURA_BURST_X = [{ dmg: 6 }, { crit: 12 }];
  var S = {
    mage_minion: { cls: 'mage', n: '眷屬之主', type: '召喚・本職（召喚精通）', st: [
      { comp: [{ k: ['summon'], hp: 20, dmg: 20 }], t: '召喚術、造屍術的眷屬 HP、傷害 +20%' },
      { comp: [{ k: ['summon'], hp: 10, dmg: 10 }], t: '眷屬 HP、傷害再 +10%；召喚術多召 1 隻' },
      { comp: [{ k: ['summon'], hp: 30, dmg: 30 }], t: '眷屬繼承你的力量：HP、傷害再 +30%；眷屬每一下 20% 機率替你施法（再打一次同樣的傷害）' }], aura: AURA_SUMMON },
    mage_spirit: { cls: 'mage', n: '精靈使', type: '召喚・混合（借妖精，強化召喚效果）', st: [
      { comp: [{ k: ['summon'], dmg: 48 }], t: '眷屬傷害 +48%（含屬性附加 24%）' },
      { comp: [{ k: ['summon'], dmg: 18 }], t: '眷屬傷害再 +18%；眷屬每一下 15% 機率放出同屬性的全體法術（其他敵人各受 50%）' },
      { comp: [{ k: ['summon'], hp: 36, dmg: 36 }], t: '眷屬繼承你的力量：HP、傷害再 +36%' }], aura: AURA_SUMMON_X },
    elf_king: { cls: 'elf', n: '精靈王的契約', type: '召喚・本職（精靈精通）', st: [
      { comp: [{ k: ['spirit'], hp: 20, dmg: 20 }], t: '精靈王 HP、傷害 +20%' },
      { comp: [{ k: ['spirit'], dmg: 15 }], t: '精靈王傷害再 +15%；召喚屬性精靈時多召一隻' },
      { comp: [{ k: ['spirit'], hp: 30, dmg: 30 }], t: '精靈王繼承你的力量：HP、傷害再 +30%' }], aura: AURA_SUMMON },
    illu_legion: { cls: 'illusion', n: '幻象軍團', type: '召喚・本職（幻術精通）', st: [
      { comp: [{ k: ['summon'], dmg: 20 }], t: '幻象傷害 +20%' },
      { comp: [{ k: ['summon'], hp: 20, dmg: 15 }], t: '幻象 HP +20%、傷害再 +15%；召喚時多召 1 隻' },
      { comp: [{ k: ['summon'], hp: 30, dmg: 30 }], t: '幻象繼承你的智力：HP、傷害再 +30%' }], aura: AURA_SUMMON },
    dragon_brood: { cls: 'dragon', n: '龍之眷屬', type: '召喚・混合（借法師召喚）', st: [
      { comp: [{ k: ['summon', 'pet'], hp: 12, dmg: 24 }], t: '你的召喚物、寵物傷害 +24%、HP +12%；幼龍跟著你，每 15 秒吐息一次（全體敵人各受你最近一擊的 100%）' },
      { comp: [{ k: ['summon', 'pet'], dmg: 18 }], t: '傷害再 +18%' },
      { comp: [{ k: ['summon', 'pet'], hp: 36, dmg: 36 }], t: '繼承你的力量：HP、傷害再 +36%' }], aura: AURA_SUMMON_X },
    warrior_cry: { cls: 'warrior', n: '戰吼統帥', type: '召喚・混合（借王族號令，作用在傭兵與城堡護衛）', st: [
      { team: 12, t: '傭兵、城堡護衛造成的傷害 +12%' },
      { team: 12, t: '戰吼：傭兵、護衛造成的傷害再 +12%' },
      { team: 12, t: '傭兵、護衛造成的傷害再 +12%；傭兵不吃次元裂縫的斬殺線，受到致命傷害時撐住 1 HP（每人 60 秒一次）' }], aura: AURA_SUMMON_X },
    royal_pet: { cls: 'royal', n: '王者的夥伴', type: '寵物・本職（夥伴精通）', st: [
      { comp: [{ k: ['pet'], hp: 20, dmg: 20 }], t: '出戰寵物 HP、傷害 +20%' },
      { comp: [{ k: ['pet'], hp: 10, dmg: 15 }], t: '寵物 HP +10%、傷害再 +15%；寵物出戰上限 +1' },
      { comp: [{ k: ['pet'], hp: 30, dmg: 30 }], t: '寵物繼承你的力量：HP、傷害再 +30%' }], aura: AURA_SUMMON },
    illu_beast: { cls: 'illusion', n: '幻獸使', type: '寵物・混合（借王族夥伴）', st: [
      { comp: [{ k: ['pet'], hp: 24, dmg: 24 }], t: '出戰寵物傷害、HP +24%' },
      { comp: [{ k: ['pet'], dmg: 12 }], t: '寵物傷害再 +12%；寵物每一下 10% 機率讓目標混亂 3 秒（頭目無效）' },
      { comp: [{ k: ['pet'], hp: 36, dmg: 36 }], t: '寵物繼承你的智力：HP、傷害再 +36%' }], aura: AURA_SUMMON_X },
    royal_morale: { cls: 'royal', n: '士氣爆發', type: '爆發・本職（血盟精通）——只給隊伍，你本人吃不到', st: [
      { team: 5, comp: [{ k: ['pet', 'summon', 'spirit'], dmg: 5 }], t: '隊伍（不含你）爆擊傷害 +15%（換算傷害 +5%）' },
      { team: 6, comp: [{ k: ['pet', 'summon', 'spirit'], dmg: 6 }], t: '士氣高昂：隊伍攻擊速度、爆擊率提升（換算傷害 +6%）' },
      { teamLow: 10, t: '頭目 HP 低於 30% 時，隊伍爆擊傷害再 +30%（換算傷害 +10%）' }], aura: [{ dmg: 5, exSelf: true }, { crit: 10, exSelf: true }] },
    royal_shadow: { cls: 'royal', n: '影之君主', type: '爆發・混合（借黑暗妖精）——自己爆發，給隊伍的變少', st: [
      { crit: 18, selfCut: 50, t: '你的爆擊傷害 +18%；代價：呼喚盟友讓傭兵補的那一下 −50%' },
      { crit: 12, t: '你的爆擊傷害再 +12%；施放勇猛意志後接下來 3 次一般攻擊必定爆擊' },
      { lowBoss: 36, t: '頭目 HP 低於 30% 時，你的爆擊傷害再 +36%' }], aura: AURA_BURST_X },
    royal_will: { cls: 'royal', n: '意志', type: '混合・只有隊長能用（減傷、爆發、治療的單人短時間型）', st: [
      { taken: 6, t: '受到的傷害 −6%；自身增益持續時間 +24%；學會全職業的增益技能（含幻覺、覺醒）' },
      { buffMult: 50, taken: 6, t: '自身增益的數值 ×1.5；受到的傷害再 −6%' },
      { buffMult: 50, crit: 36, t: '自身增益的數值 ×2；爆擊傷害 +36%' }], aura: [{ dmg: 6, selfOnly: true }, { crit: 12, selfOnly: true }] },
    dark_fatal: { cls: 'dark', n: '致命一擊', type: '爆發・本職（爆擊精通）', st: [
      { crit: 15, t: '爆擊傷害 +15%' },
      { crit: 15, t: '爆擊傷害再 +15%；會心一擊之後的攻擊技冷卻 −30%' },
      { lowBoss: 30, t: '頭目 HP 低於 30% 時，爆擊傷害再 +30%' }], aura: AURA_BURST },
    knight_wall: { cls: 'knight', n: '不動的城壁', type: '防禦・本職（防禦精通）', st: [
      { taken: 8, t: '受到的傷害 −8%' },
      { taken: 6, allyTaken: 6, t: '受到的傷害再 −6%；傭兵受到的傷害 −6%' },
      { bossTaken: 10, t: '受到頭目的傷害再 −10%' }], aura: [{ compTaken: 10 }, { dmg: 4 }] },
    knight_holy: { cls: 'knight', n: '聖騎士', type: '隊伍・混合（借王族號令）', st: [
      { team: 8, t: '傭兵造成的傷害 +8%' },
      { team: 8, taken: 4, t: '傭兵造成的傷害再 +8%；你受到的傷害 −4%' },
      { lowBoss: 30, t: '頭目 HP 低於 30% 時，你的爆擊傷害再 +30%' }], aura: AURA_BURST },
    warrior_berserk: { cls: 'warrior', n: '狂戰', type: '爆發・本職（狂怒精通）', st: [
      { crit: 15, t: '爆擊傷害 +15%' },
      { crit: 15, lowSelf: 10, t: '爆擊傷害再 +15%；HP 低於 50% 時造成的傷害 +10%' },
      { lowBoss: 30, t: '頭目 HP 低於 30% 時，爆擊傷害再 +30%' }], aura: AURA_BURST },
    mage_dragon: { cls: 'mage', n: '龍語者', type: '爆發・混合（借龍騎士）', st: [
      { mcrit: 18, t: '攻擊魔法爆擊傷害 +18%' },
      { mcrit: 18, t: '攻擊魔法爆擊傷害再 +18%；龍語：攻擊魔法 15% 機率再唱一次（50% 傷害）' },
      { mcrit: 36, t: '攻擊魔法爆擊傷害再 +36%' }], aura: AURA_BURST_X },
    illu_blade: { cls: 'illusion', n: '幻刃', type: '爆發・混合（借黑暗妖精）', st: [
      { crit: 18, critRate: 6, t: '爆擊率 +6%、爆擊傷害 +18%' },
      { crit: 12, t: '爆擊傷害再 +12%；施放疼痛的歡愉後接下來 3 次一般攻擊必定爆擊' },
      { lowBoss: 36, t: '頭目 HP 低於 30% 時，爆擊傷害再 +36%' }], aura: AURA_BURST_X }
  };
  var TODO_OLD = '第二輪：召喚隻數 +1、寵物出戰上限 +1、多召一隻精靈、召喚物替你施法、幼龍、幻惑、戰吼撐住斬殺、會心一擊冷卻、龍語、勇猛意志後必爆、疼痛的歡愉後必爆、意志學會全職業增益技能。騎士、戰士本職等其他流派也在第二輪。';

  var TODO = '數值都是暫定，之後用存檔實測再調。';
  var rec = function (p) { p = p || P(); if (!p) return null; if (!p.afkEvo || typeof p.afkEvo !== 'object') p.afkEvo = { school: '', stage: 0 }; return p.afkEvo; };
  var stageOf = function (p) { var r = p && p.afkEvo; return r && S[r.school] ? Math.max(0, Math.min(3, r.stage | 0)) : 0; };
  var schoolOf = function (p) { var r = p && p.afkEvo; return r && S[r.school] ? S[r.school] : null; };
  var sum = function (p, key) { var sc = schoolOf(p), n = stageOf(p), v = 0; if (!sc) return 0; for (var i = 0; i < n; i++) v += Number(sc.st[i][key]) || 0; return v; };
  var compBonus = function (p, kind) { var sc = schoolOf(p), n = stageOf(p), hp = 0, dmg = 0; if (!sc) return { hp: 0, dmg: 0 }; for (var i = 0; i < n; i++) (sc.st[i].comp || []).forEach(function (c) { if (c.k.indexOf(kind) >= 0) { hp += c.hp || 0; dmg += c.dmg || 0; } }); return { hp: hp, dmg: dmg }; };
  var auraOf = function (p) { var sc = schoolOf(p), n = stageOf(p), a = []; if (!sc || !sc.aura) return a; if (n >= 2) a.push(sc.aura[0]); if (n >= 3) a.push(sc.aura[1]); return a; };
  var classic = function (p) { return !!(p && p.classicMode); };
  var leader = function () { var p = P(); return p && !classic(p) ? p : null; };

  // ── 數值：玩家自己（爆擊傷害、爆擊率、受到傷害、增益）──
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = leader(); if (p && p.d && stageOf(p)) {
          var c = sum(p, 'crit'), mc = sum(p, 'mcrit'), cr = sum(p, 'critRate');
          auraOf(p).forEach(function (a) { if (a.crit && !a.exSelf) c += a.crit; });
          if (c) { p.d.meleeCritDmg = (p.d.meleeCritDmg || 0) + c; p.d.rangedCritDmg = (p.d.rangedCritDmg || 0) + c; p.d.magicCritDmg = (p.d.magicCritDmg || 0) + c; }
          if (mc) p.d.magicCritDmg = (p.d.magicCritDmg || 0) + mc;
          if (cr) { p.d.meleeCrit = (p.d.meleeCrit || 0) + cr; p.d.rangedCrit = (p.d.rangedCrit || 0) + cr; p.d.magicCrit = (p.d.magicCrit || 0) + cr; }
          scaleBuffs(p);
        }
      } catch (e) { console.warn('[AFK-evolve] stats', e); }
      return r;
    };
  }
  // 意志：自身增益數值 ×1.5／×2（做法同技能強化：身上有效的職業增益技能，數值欄位再加一份）
  var BUFF_KEYS = ['meleeDmg', 'meleeHit', 'rangedDmg', 'rangedHit', 'extraDmg', 'extraHit', 'magicDmg', 'er', 'mpR', 'dr'];
  function scaleBuffs(p) {
    var m = sum(p, 'buffMult') / 100; if (!m) return;
    var d = p.d, b = p.buffs || {};
    Object.keys(b).forEach(function (sid) {
      if (!(b[sid] > 0)) return; var sk = DB.skills[sid]; if (!sk || !sk.d || sk.type === 'atk') return;
      BUFF_KEYS.forEach(function (key) { var v = Number(sk.d[key]) || 0; if (v) d[key] = (Number(d[key]) || 0) + Math.round(v * m); });
      if (sk.d.ac) d.ac = (Number(d.ac) || 0) - Math.round(sk.d.ac * m);
    });
  }

  // ── 同伴（寵物、召喚物、精靈）：HP、傷害 ──
  var R = W.AFK_RELIC_RUNTIME;
  if (R && typeof R.dispatch === 'function') {
    var oDis = R.dispatch;
    R.dispatch = function (event, c) {
      var r = oDis.apply(this, arguments);
      try {
        if (event === 'onCompanionStats' && c) {
          var p = leader(); if (p && stageOf(p)) {
            var kind = c.companionKind || 'summon';
            if (c.owner === p) { var b = compBonus(p, kind); if (b.hp) c.maxHpMult = (c.maxHpMult || 1) * (1 + b.hp / 100); if (b.dmg) c.directDamageMult = (c.directDamageMult || 1) * (1 + b.dmg / 100); }
            auraOf(p).forEach(function (a) { if (a.comp && !a.selfOnly) c.directDamageMult = (c.directDamageMult || 1) * (1 + a.comp / 100); });
          }
        }
      } catch (e) {}
      return r;
    };
  }

  // ── 造成的傷害：隊伍加成、對低血頭目的爆擊、光環 ──
  var isAlly = function (p, a) { return !!(p && a && a !== p && (p.allies || []).indexOf(a) >= 0); };
  var lowBoss = function (t) { return !!(t && t.boss && (t.curHp || 0) < (t.hp || t.mhp || 1) * 0.3); };
  var critRatio = function (a, kind, add) { var d = (a && a.d) || {}, cd = Number(kind === 'magic' ? d.magicCritDmg : kind === 'ranged' ? d.rangedCritDmg : d.meleeCritDmg) || 50; return (1 + (cd + add) / 100) / (1 + cd / 100); };
  function outgoing(actor, target, amount, opt) {
    var p = leader(); if (!p || !stageOf(p) || !(amount > 0)) return amount;
    var mine = actor === p, ally = isAlly(p, actor), pk = opt && opt.packet, crit = !!(pk && pk.crit), kind = opt && opt.kind;
    if (mine) {
      var lb = sum(p, 'lowBoss'); if (lb && crit && lowBoss(target)) amount *= critRatio(p, kind, lb);
      var ls = sum(p, 'lowSelf'); if (ls && p.hp < p.mhp * 0.5) amount *= 1 + ls / 100;
      if (pk && !crit && (p._evoForceCrit || 0) > 0) { p._evoForceCrit--; amount *= 1 + (Number((p.d || {})[kind === 'ranged' ? 'rangedCritDmg' : 'meleeCritDmg']) || 50) / 100; }
      EV.last = amount; EV.lastT = target;
    }
    if (ally) {
      var tm = sum(p, 'team'); if (tm) amount *= 1 + tm / 100;
      var tl = sum(p, 'teamLow'); if (tl && lowBoss(target)) amount *= 1 + tl / 100;
    }
    auraOf(p).forEach(function (a) {
      if (!a.dmg) return;
      if (a.selfOnly && !mine) return;
      if (a.exSelf && mine) return;
      if (mine || ally) amount *= 1 + a.dmg / 100;
    });
    return amount;
  }
  var hooked = false;
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return hooked;
    var o = C.damage; hooked = true;
    C.damage = function (actor, target, amount, opt) { try { amount = Math.max(1, Math.floor(outgoing(actor, target, amount, opt || {}))); } catch (e) {} return o.call(this, actor, target, amount, opt); };
    return true;
  };
  if (!hookDamage()) { try { document.addEventListener('DOMContentLoaded', hookDamage); } catch (e) {} }
  // 影之君主：呼喚盟友讓傭兵補的那一下 ×0.5
  var inCall = false;
  if (typeof W.castSkill === 'function') {
    var oCast = W.castSkill;
    W.castSkill = function (skId) { var sk = DB.skills[skId]; if (!sk || !sk.callAllies) return oCast.apply(this, arguments); inCall = true; try { return oCast.apply(this, arguments); } finally { inCall = false; } };
  }
  if (typeof W.allyAttackOnce === 'function') {
    var oAo = W.allyAttackOnce;
    W.allyAttackOnce = function () {
      var p = leader(), cut = p ? sum(p, 'selfCut') : 0, C = W.AFK_CARD_COMBAT, o = C && C.damage;
      if (!cut || !inCall || !o) return oAo.apply(this, arguments);
      C.damage = function (a, t, n, opt) { return o.call(this, a, t, Math.max(1, Math.floor(n * (1 - cut / 100))), opt); };
      try { return oAo.apply(this, arguments); } finally { C.damage = o; }
    };
  }
  // 受到的傷害（意志第二段 −12%；召喚物、寵物光環）
  var RI = R && R.incoming;
  if (R && typeof RI === 'function') {
    R.incoming = function (target, damage, attacker, opts) {
      var out = RI.apply(this, arguments);
      try {
        var p = leader(); if (p && stageOf(p) && typeof out === 'number') {
          if (target === p) { var tk = sum(p, 'taken'); if (tk) out = out * (1 - tk / 100); var bt = sum(p, 'bossTaken'); if (bt && attacker && attacker.boss) out = out * (1 - bt / 100); }
          else if (isAlly(p, target)) { var at = sum(p, 'allyTaken'); if (at) out = out * (1 - at / 100); if (has(p, 'warrior_cry', 3) && out >= (target.curHp || 0) && tkNow() >= (target._evoHold || 0)) { target._evoHold = tkNow() + 600; out = Math.max(0, (target.curHp || 1) - 1); } }
          else if (target && !isAlly(p, target) && target !== p) { auraOf(p).forEach(function (a) { if (a.compTaken) out = out * (1 - a.compTaken / 100); }); }
        }
      } catch (e) {}
      return out;
    };
  }

  // ── 第二輪：召喚、寵物、施法、必爆、增益 ──
  var EV = { last: 0 };
  var tkNow = function () { return (typeof state !== 'undefined' && state && state.ticks) || 0; };
  var has = function (p, school, st) { return !!(p && p.afkEvo && p.afkEvo.school === school && stageOf(p) >= st); };
  if (typeof W._sumCountFor === 'function') {
    var oCnt = W._sumCountFor;
    W._sumCountFor = function (name, owner) { var n = oCnt.apply(this, arguments); try { var p = leader(), o = owner || P(); if (n > 0 && o === p && (has(p, 'mage_minion', 2) || has(p, 'illu_legion', 2))) n += 1; } catch (e) {} return n; };
    try { (0, eval)('_sumCountFor = window._sumCountFor'); } catch (e) {}
  }
  if (typeof W.summonV2CastFor === 'function') {
    var oSum = W.summonV2CastFor;
    W.summonV2CastFor = function (skId) {
      var r = oSum.apply(this, arguments);
      try { var p = leader(); if (r && p && /^sk_elf_summon/.test(skId) && has(p, 'elf_king', 2) && p.summonsV2 && p.summonsV2.length === 1) { var c = JSON.parse(JSON.stringify(p.summonsV2[0])); c.uid = (typeof uid === 'function' ? uid() : 'evo' + Date.now()); c._atkCd = 8; p.summonsV2.push(c); } } catch (e) {}
      return r;
    };
    try { (0, eval)('summonV2CastFor = window.summonV2CastFor'); } catch (e) {}
  }
  var RCo = W.AFK_RELIC_COMPANIONS;
  if (RCo && typeof RCo.petSlots === 'function') { var oSlots = RCo.petSlots; RCo.petSlots = function (base) { var v = oSlots.apply(this, arguments); try { if (has(leader(), 'royal_pet', 2)) v += 1; } catch (e) {} return v; }; }
  var liveMobs = function () { return ((typeof mapState !== 'undefined' && mapState.mobs) || []).filter(function (m) { return m && !m._dead && m.curHp > 0; }); };
  var hurtMob = function (m, v) { if (!m || m._dead || !(v > 0)) return; m.curHp -= Math.floor(v); if (m.curHp <= 0) { var i = mapState.mobs.indexOf(m); if (i >= 0) { m.curHp = 0; try { killMob(i); } catch (e) {} } } };
  var isSummon = function (p, a) { return !!(p && a && (p.summonsV2 || []).indexOf(a) >= 0); };
  var isPet = function (p, a) { try { return !!(p && a && typeof petsOutList === 'function' && petsOutList().indexOf(a) >= 0); } catch (e) { return false; } };
  var hook2 = false;
  var hookDamage2 = function () {
    var C = W.AFK_CARD_COMBAT; if (hook2 || !C || typeof C.damage !== 'function') return hook2;
    var o = C.damage; hook2 = true;
    C.damage = function (actor, target, amount, opt) {
      var v = o.apply(this, arguments);
      try {
        var p = leader(); if (p && target && v > 0 && !(opt && opt._evoNested)) {
          var summ = isSummon(p, actor), pet = !summ && isPet(p, actor), mine = actor === p;
          if (summ && has(p, 'mage_minion', 3) && Math.random() < 0.2) setTimeout(function () { hurtMob(target, v); }, 0);
          if (summ && has(p, 'mage_spirit', 2) && Math.random() < 0.15) setTimeout(function () { liveMobs().filter(function (m) { return m !== target; }).forEach(function (m) { hurtMob(m, v * 0.5); }); }, 0);
          if (pet && has(p, 'illu_beast', 2) && !target.boss && Math.random() < 0.1) { var st = target.st || (target.st = {}); st.confuse = Math.max(st.confuse || 0, 30); }
          if (mine && opt && opt.kind === 'magic' && !opt.packet && has(p, 'mage_dragon', 2) && Math.random() < 0.15) setTimeout(function () { hurtMob(target, v * 0.5); }, 0);
        }
      } catch (e) {}
      return v;
    };
    return true;
  };
  if (!hookDamage2()) { try { document.addEventListener('DOMContentLoaded', hookDamage2); } catch (e) {} }
  // 必爆、會心一擊冷卻、增益持續時間
  if (typeof W.castSkill === 'function') {
    var oCast2 = W.castSkill;
    W.castSkill = function (skId) {
      var p = leader(), sk = DB.skills[skId], before = p && p.buffs ? (p.buffs[skId] || 0) : 0;
      var r = oCast2.apply(this, arguments);
      try {
        if (p && sk) {
          if (skId === 'sk_royal_bravewill' && has(p, 'royal_shadow', 2) && (p.buffs[skId] || 0) > before) p._evoForceCrit = 3;
          if (skId === 'sk_illu_pain' && has(p, 'illu_blade', 2) && (p.buffs[skId] || 0) > before) p._evoForceCrit = 3;
          if (skId === 'sk_dark_crit' && has(p, 'dark_fatal', 2) && p.cds && p.cds.atkSk > 0) p.cds.atkSk = Math.floor(p.cds.atkSk * 0.7);
          if (sk.type === 'buff' && !sk.summon && has(p, 'royal_will', 1)) { var now = p.buffs[skId] || 0; if (now > before) p.buffs[skId] = before + Math.round((now - before) * 1.24); }
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('castSkill = window.castSkill'); } catch (e) {}
  }
  // 意志：學會全職業的增益技能（裝備給的技能每次重算都會重建，這裡跟著加回去）
  var WILL_SKIP = /^sk_helm_/;
  var willSkills = null;
  var willList = function () { if (willSkills) return willSkills; willSkills = Object.keys(DB.skills).filter(function (k) { var s = DB.skills[k]; return s && s.type === 'buff' && !s.summon && !WILL_SKIP.test(k); }); return willSkills; };
  if (typeof W.recomputeStats === 'function') {
    var oRe2 = W.recomputeStats;
    W.recomputeStats = function () {
      var p0 = P(), isLeader = p0 && !p0._allyName && !(typeof _recomputingAlly !== 'undefined' && _recomputingAlly);
      if (isLeader && has(p0, 'royal_will', 1)) { p0.grantedSkills = p0.grantedSkills || []; }
      var r = oRe2.apply(this, arguments);
      try {
        var p = P(); if (p && isLeader && has(p, 'royal_will', 1)) { p.grantedSkills = p.grantedSkills || []; willList().forEach(function (k) { if ((p.skills || []).indexOf(k) < 0) { p.grantedSkills.push(k); p.skills.push(k); } }); }
      } catch (e) {}
      return r;
    };
  }
  // 幼龍：每 15 秒吐息
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var t0 = tkNow(), r = oTick.apply(this, arguments);
      try { var p = leader(), t = tkNow(); if (p && t !== t0 && t % 150 === 0 && has(p, 'dragon_brood', 1) && !p.dead && EV.last > 0) { var ms = liveMobs().filter(function (m) { return !m.isAlly; }); if (ms.length) { ms.forEach(function (m) { hurtMob(m, EV.last); }); try { logCombat('<span class="text-orange-300">【幼龍的吐息】</span>火焰掃過了全場。', 'magic', 'summon'); } catch (e) {} } } } catch (e) {}
      return r;
    };
  }
  W.__afkExecImmune = function (x) { var p = leader(); return !!(p && x && x !== p && has(p, 'warrior_cry', 3) && isAlly(p, x)); };

  // ── 交出存檔 ──
  var usedList = function () { try { return JSON.parse(localStorage.getItem(USED_KEY) || '[]') || []; } catch (e) { return []; } };
  var markUsed = function (seed) { var a = usedList(); if (seed && a.indexOf(seed) < 0) a.push(seed); try { localStorage.setItem(USED_KEY, JSON.stringify(a)); } catch (e) {} };
  var slotMax = function () { return typeof SAVE_SLOT_MAX !== 'undefined' ? SAVE_SLOT_MAX : 16; };
  var readSlot = function (n) { try { return typeof _roleReadSavePlayer === 'function' ? _roleReadSavePlayer(n) : null; } catch (e) { return null; } };
  var needRebirth = function (stage) { return stage - 1; };   // 第 N 段要交 (N−1) 轉的存檔
  var candidates = function (p, stage) {
    var out = [], used = usedList();
    for (var n = 1; n <= slotMax(); n++) {
      if (n === currentSlot) continue;
      var q = readSlot(n); if (!q || q.cls !== p.cls) continue;
      var why = '';
      if ((q.lv || 1) < 100) why = '要 Lv100';
      else if (Math.floor(q.rebirth || 0) !== needRebirth(stage)) why = '要 ' + needRebirth(stage) + ' 轉';
      else if (!!q.classicMode !== !!p.classicMode) why = '模式不同';
      else if (q.enSeed && used.indexOf(q.enSeed) >= 0) why = '已經交過';
      out.push({ slot: n, q: q, why: why });
    }
    return out;
  };
  var gate = function (p, stage) {
    if (classic(p)) return '經典模式沒有職業進化。';
    var rb = Math.floor(p.rebirth || 0);
    if (stage === 1 && rb < 1) return '要先轉生一次。';
    if (stage === 2 && rb < 2) return '第二段要二轉。';
    if (stage === 3 && (rb < 2 || !(p.afkFinalTier && p.afkFinalTier.t3 === 'win'))) return '第三段要二轉，而且本人打贏終焉第三階層（次元裂縫資格）。';
    return '';
  };
  function deleteSlot(n) {
    var old = readSlot(n), fp = (typeof _roleFingerprint === 'function') ? _roleFingerprint(old) : '';
    if (fp && typeof _roleMarkDeleted === 'function' && !_roleMarkDeleted(fp)) return false;
    try { if (typeof petReleaseSlotAssignments === 'function') petReleaseSlotAssignments(n); } catch (e) {}
    try { if (typeof mercLedgerPurgeSlot === 'function') mercLedgerPurgeSlot(n); } catch (e) {}
    try { if (typeof antharasForgetRoleClear === 'function') antharasForgetRoleClear(old, n); } catch (e) {}
    _lsRemove('lineage_idle_save_' + n); _lsRemove('lineage_idle_save_' + n + '_bak');
    try { if (typeof clanOnRoleDeleted === 'function') clanOnRoleDeleted(old); } catch (e) {}
    return !_lsGet('lineage_idle_save_' + n);
  }
  function evolve(slot, schoolId) {
    var p = P(), r = rec(p); if (!p) return;
    var stage = stageOf(p) + 1; if (stage > 3) return;
    var why = gate(p, stage); if (why) { sys('<span class="text-amber-300">' + esc(why) + '</span>'); return; }
    if (stage === 1) { if (!S[schoolId] || S[schoolId].cls !== p.cls) { sys('<span class="text-amber-300">請先選一個流派。</span>'); return; } }
    var c = candidates(p, stage).filter(function (x) { return x.slot === slot && !x.why; })[0];
    if (!c) { sys('<span class="text-amber-300">這個存檔不能交出。</span>'); return; }
    var q = c.q, nm = q.name || '未命名', sc = stage === 1 ? S[schoolId] : schoolOf(p);
    if (!confirm('職業進化第 ' + stage + ' 段：' + sc.n + '\n\n要交出存檔 ' + slot + '：' + CLS_N[q.cls] + ' Lv' + q.lv + '（' + Math.floor(q.rebirth || 0) + ' 轉）「' + nm + '」。\n這個角色會被永久刪除。' + (stage === 1 ? '\n流派選了以後不能換。' : '') + '\n\n確定嗎？')) return;
    var typed = prompt('請輸入要交出的角色名稱「' + nm + '」確認：', '');
    if (typed === null) return;
    if (typed.trim() !== nm) { alert('角色名稱不正確，已取消。'); return; }
    if (typeof _roleOtherActiveSessions === 'function' && _roleOtherActiveSessions().length) { alert('偵測到其他遊戲分頁，已取消。請先關閉其他角色。'); return; }
    if (!deleteSlot(slot)) { alert('刪除存檔失敗，已取消。'); return; }
    markUsed(q.enSeed);
    if (stage === 1) r.school = schoolId;
    r.stage = stage; r.at = Date.now();
    try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
    try { saveGame(); } catch (e) {}
    sys('<span class="text-fuchsia-300 font-bold">✦ 職業進化第 ' + stage + ' 段：' + esc(sc.n) + '。</span><span class="text-slate-300">' + esc(sc.st[stage - 1].t) + '</span>');
  }

  // ── 介面（薇爾娜頁面下方）──
  var CSS = [
    '.aev{color:#e2e8f0;font-size:14px;line-height:1.65}',
    '.aev .ev-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;background:linear-gradient(135deg,rgba(134,25,143,.3),rgba(15,23,42,.6));border:1px solid rgba(232,121,249,.35)}',
    '.aev .ev-head b{color:#f5d0fe;font-size:16px}.aev .ev-head small{color:#e9d5ff}',
    '.aev .ev-dots{display:flex;gap:4px}.aev .ev-dots i{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:12px;font-weight:bold;background:#1e293b;border:2px solid #334155;color:#64748b}',
    '.aev .ev-dots i.on{background:#a21caf;border-color:#f0abfc;color:#fff}',
    '.aev .ev-intro{margin:8px 0;padding:8px 10px;border-radius:8px;background:rgba(30,41,59,.7);color:#cbd5e1;font-size:13px}',
    '.aev .ev-h{margin:12px 0 6px;color:#fde68a;font-weight:bold;font-size:15px}',
    '.aev .ev-sc{display:block;margin:8px 0;padding:10px 12px;border:1px solid #334155;border-radius:10px;background:rgba(15,23,42,.7);cursor:pointer}',
    '.aev .ev-sc.on{border-color:#e879f9;box-shadow:0 0 10px rgba(232,121,249,.4);background:linear-gradient(180deg,rgba(112,26,117,.25),rgba(15,23,42,.7))}',
    '.aev .ev-sc .nm{display:flex;justify-content:space-between;align-items:center;gap:6px}.aev .ev-sc .nm b{color:#fde68a;font-size:15px}',
    '.aev .tag{font-size:11px;padding:1px 8px;border-radius:999px;background:#1e293b;color:#cbd5e1;border:1px solid #334155;white-space:nowrap}',
    '.aev .tag.main{border-color:#ca8a04;color:#fde68a}.aev .tag.mix{border-color:#a855f7;color:#e9d5ff}',
    '.aev .ev-type{font-size:12px;color:#94a3b8;margin:2px 0 4px}',
    '.aev .ev-st{display:flex;gap:8px;padding:3px 0;color:#cbd5e1}.aev .ev-st i{flex:none;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;font-weight:bold;background:#1e293b;border:1px solid #475569;color:#94a3b8;margin-top:2px}',
    '.aev .ev-st.on{color:#f8fafc}.aev .ev-st.on i{background:#a21caf;border-color:#f0abfc;color:#fff}',
    '.aev .ev-aura{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.aev .ev-aura span{font-size:12px;padding:2px 8px;border-radius:6px;background:rgba(88,28,135,.35);border:1px solid #7e22ce;color:#e9d5ff}',
    '.aev .ev-next{margin-top:12px;padding:10px 12px;border:1px dashed #a855f7;border-radius:10px;background:rgba(59,7,100,.2)}',
    '.aev .ev-why{color:#fca5a5;margin-top:4px}',
    '.aev .ev-sl{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:6px 0;padding:6px 8px;border-radius:8px;background:#0f172a;border:1px solid #1e293b}',
    '#town-interaction-container .aev .ev-btn,.aev .ev-btn{padding:6px 12px!important;border-radius:8px!important;background:linear-gradient(180deg,#c026d3,#86198f)!important;color:#fff!important;border:1px solid #f0abfc!important;font-weight:bold;font-size:13px;white-space:nowrap}',
    '.aev .muted{color:#94a3b8}'
  ].join('');
  var pick = '';
  var ROM = ['', '一', '二', '三'];
  var tagOf = function (x) { return /本職/.test(x.type) ? '<span class="tag main">本職</span>' : /混合/.test(x.type) ? '<span class="tag mix">混合</span>' : ''; };
  var stList = function (x, n) { return x.st.map(function (s, i) { return '<div class="ev-st' + (i < n ? ' on' : '') + '"><i>' + (i < n ? '✓' : ROM[i + 1]) + '</i><span>' + esc(s.t) + '</span></div>'; }).join(''); };
  var auraHtml = function (x) { var au = x.aura || []; return au.length ? '<div class="ev-aura"><span>二段光環：' + esc(auraTxt(au[0])) + '</span><span>三段光環：' + esc(auraTxt(au[1])) + '</span></div>' : ''; };
  function render(div) {
    var p = P(); if (!p || !div) return;
    if (!document.getElementById('aev-css')) { var st = document.createElement('style'); st.id = 'aev-css'; st.textContent = CSS; document.head.appendChild(st); }
    var host = div.querySelector('#afk-su-pane-evo') || div;
    var box = host.querySelector('#aev') || document.createElement('div'); box.id = 'aev'; box.className = 'aev';
    var n = stageOf(p), sc = schoolOf(p);
    var h = '<div class="ev-head"><div><b>✦ 職業進化</b><br><small>' + (sc ? esc(sc.n) + '・第 ' + n + '／3 段' : '尚未選擇流派') + '</small></div><div class="ev-dots">' + [1, 2, 3].map(function (i) { return '<i class="' + (n >= i ? 'on' : '') + '">' + (n >= i ? '✓' : ROM[i]) + '</i>'; }).join('') + '</div></div>';
    if (classic(p)) { box.innerHTML = h + '<div class="ev-intro">經典模式沒有職業進化。</div>'; if (!box.parentNode) host.appendChild(box); return; }
    h += '<div class="ev-intro">交出同職業 Lv100 的存檔，讓這個角色走上一條流派：第一段交 0 轉、第二段交 1 轉、第三段交 2 轉。<b style="color:#fca5a5">交出的存檔會被刪除，流派選了以後不能換。</b>傭兵不能進化，但吃得到你的光環。</div>';
    if (sc) {
      h += '<div class="ev-h">你的流派</div><div class="ev-sc on" style="cursor:default"><div class="nm"><b>' + esc(sc.n) + '</b>' + tagOf(sc) + '</div><div class="ev-type">' + esc(sc.type) + '</div>' + stList(sc, n) + auraHtml(sc) + '</div>';
    } else {
      var mine = Object.keys(S).filter(function (k) { return S[k].cls === p.cls; });
      h += '<div class="ev-h">選擇流派（' + CLS_N[p.cls] + '）</div>';
      if (!mine.length) h += '<div class="ev-intro">' + CLS_N[p.cls] + '的流派之後開放。</div>';
      mine.forEach(function (k) { var x = S[k]; h += '<label class="ev-sc' + (pick === k ? ' on' : '') + '" data-aev-pick="' + k + '"><div class="nm"><b>' + (pick === k ? '◉ ' : '○ ') + esc(x.n) + '</b>' + tagOf(x) + '</div><div class="ev-type">' + esc(x.type) + '</div>' + stList(x, 0) + auraHtml(x) + '</label>'; });
    }
    if (n < 3 && (sc || Object.keys(S).some(function (k) { return S[k].cls === p.cls; }))) {
      var stage = n + 1, why = gate(p, stage);
      h += '<div class="ev-next"><b style="color:#f5d0fe">下一步：第 ' + stage + ' 段</b><div class="muted">交出同職業 ' + needRebirth(stage) + ' 轉、Lv100 的存檔' + (stage === 1 ? '，並先在上面選好流派' : '') + '。</div>';
      if (why) h += '<div class="ev-why">' + esc(why) + '</div>';
      else {
        var cs = candidates(p, stage);
        if (!cs.length) h += '<div class="muted" style="margin-top:4px">目前沒有可以交出的同職業存檔。</div>';
        cs.forEach(function (c) { h += '<div class="ev-sl"><span>存檔 ' + c.slot + '：' + esc(c.q.name || '未命名') + '　Lv' + c.q.lv + '・' + Math.floor(c.q.rebirth || 0) + ' 轉</span>' + (c.why ? '<span class="muted">' + esc(c.why) + '</span>' : '<button type="button" class="ev-btn" data-aev-slot="' + c.slot + '"' + (stage === 1 && !pick ? ' disabled style="opacity:.5"' : '') + '>交出並進化</button>') + '</div>'; });
      }
      h += '</div>';
    }
    box.innerHTML = h;
    if (!box.parentNode) host.appendChild(box);
    box.onclick = function (e) {
      var a = e.target.closest('[data-aev-pick]'); if (a) { pick = a.getAttribute('data-aev-pick'); render(div); return; }
      var b = e.target.closest('[data-aev-slot]'); if (b && !b.disabled) { evolve(Number(b.getAttribute('data-aev-slot')), pick); render(div); }
    };
  }
  function auraTxt(a) { if (!a) return ''; var t = []; if (a.dmg) t.push('造成的傷害 +' + a.dmg + '%'); if (a.crit) t.push('爆擊傷害 +' + a.crit + '%'); if (a.comp) t.push('召喚物、寵物傷害 +' + a.comp + '%'); if (a.compTaken) t.push('召喚物、寵物受到的傷害 −' + a.compTaken + '%'); return (a.selfOnly ? '你自己' : a.exSelf ? '全隊（不含你）' : '全隊') + t.join('、'); }
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) { var r = oNpc.apply(this, arguments); if (npcId === NPC_ID) { try { render(document.getElementById('interaction-content')); } catch (e) { console.warn('[AFK-evolve] ui', e); } } return r; };
  }

  W.__afkEvolve = { S: S, TODO: TODO, stageOf: stageOf, schoolOf: schoolOf, sum: sum, compBonus: compBonus, auraOf: auraOf, candidates: candidates, gate: gate, evolve: evolve, render: render, outgoing: outgoing };
  console.log('[AFK-evolve] 已啟用：職業進化（第一批 14 流派）');
})();
