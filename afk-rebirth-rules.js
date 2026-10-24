/* ==========================================================================
 * afk-rebirth-rules.js — 轉生後的規則補充與聖衣、魔法武器（玩家 2026-10-24 指定）
 *
 * 轉生後（各角色自己）
 *   ‧傷害型法術的消耗：(技能基礎 MP ＋ SP 超過 50 時再 +50) × 3（玩家 2026-10-24 從 ×5 改 ×3）。例：80 MP → (80+50)×3＝390；
 *     補助、增益、給敵人上狀態的魔法照原價
 *   ‧INT 提供的 SP 不再封頂 33：至少 (INT＋35)÷3（INT 200 → 78）
 *   ‧HP 自然恢復改為每 3 秒一次
 *   ‧治療溢出 → 護盾（上限＝最大 HP 20%），先擋傷害，能防暴斃
 * 敗者榮光（隊長轉生後，全隊光環）
 *   ‧所有武器都有擦傷：本來沒命中的一般攻擊改成擦傷，傷害 50%
 *   ‧屬性抗性滿（免疫）時，原本轉成物理的那份傷害減半，而且這一半改成回復 HP（＝不受傷，反而回血）
 * 聖衣變身：造成的傷害 50% 轉成全隊回復（每 3 秒一次）
 * 魔法武器：發動時 20% 機率傷害加倍
 * 騎士・百般武藝
 *   ‧對每個敵人的第一擊，武器骰改用最大值 ×10 計算（跟神話變身的首擊加成各算各的）
 *   ‧穿雙子座聖衣：改成對每個敵人的前五擊傷害 ×30
 *   ‧穿金牛座聖衣：AC −100、魔防 +100、五屬性抗性 +100、傷害減免 +10
 * 須排在 afk-arts、afk-card-combat、afk-resist、afk-rebirth 之後。
 * ========================================================================== */
(function () {
  'use strict';
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var tk = function () { return (typeof state !== 'undefined' && state) ? (state.ticks || 0) : 0; };
  var reborn = function (p) { return !!(p && p.rebirth > 0); };
  var isLeader = function (e) { return e === P() && !(typeof _recomputingAlly !== 'undefined' && _recomputingAlly); };
  var hpOf = function (e) { return isLeader(e) ? e.hp : (e.curHp != null ? e.curHp : e.hp); };
  var setHp = function (e, v) { if (isLeader(e)) e.hp = v; else if (e.curHp != null) e.curHp = v; else e.hp = v; };
  var alive = function (e) { return !!e && !e._downed && !(isLeader(e) && e.dead) && (hpOf(e) || 0) > 0; };
  var party = function () { var p = P(); if (!p) return []; return [p].concat((p.allies || []).filter(function (a) { return a && !a._downed && (a.curHp || 0) > 0; })); };
  var zodiacOf = function (e) { var f = e && e.poly; if (!f || f.cardAscensionTier !== 'samsara' || !(e.buffs && e.buffs.poly > 0)) return null; var m = /^(..座)/.exec(f.n || ''); return m ? m[1] : null; };
  var gloryOn = function () { return reborn(P()); };
  var RES5 = ['resFire', 'resWater', 'resWind', 'resEarth', 'resNone'];
  var ELE_KEY = { fire: 'resFire', water: 'resWater', wind: 'resWind', earth: 'resEarth' };

  // ── 護盾 ──
  var shieldCap = function (e) { return Math.floor((Number(e.mhp) || 0) * 0.2); };
  var addShield = function (e, over) {
    if (!e || !reborn(e) || !(over > 0)) return;
    e._afkShield = Math.min(shieldCap(e), (Number(e._afkShield) || 0) + Math.floor(over));
  };
  var healWithShield = function (e, v) {   // 回血；溢出的部分變護盾
    if (!e || !(v > 0) || !alive(e)) return;
    var h = hpOf(e) || 0, mx = Number(e.mhp) || h, nv = h + Math.floor(v);
    if (nv > mx) { addShield(e, nv - mx); nv = mx; }
    setHp(e, nv);
  };
  var anyShield = function () { return party().some(function (e) { return (e._afkShield || 0) > 0; }); };
  // 治療魔法：先記下目標溢出量
  if (typeof window.rollHealingSpell === 'function') {
    var oRHS = window.rollHealingSpell;
    window.rollHealingSpell = function (sk, dStats, caster, target) {
      var v = oRHS.apply(this, arguments);
      try { if (target && v > 0 && reborn(target)) { var h = hpOf(target) || 0, mx = Number(target.mhp) || h; if (h + v > mx) addShield(target, h + v - mx); } } catch (e) {}
      return v;
    };
  }
  // 藥水
  if (typeof window.potionHealBase === 'function') {
    var oPHB = window.potionHealBase;
    window.potionHealBase = function (d, owner) {
      var v = oPHB.apply(this, arguments);
      try { if (owner && v > 0 && reborn(owner)) { var h = hpOf(owner) || 0, mx = Number(owner.mhp) || h; if (h + v > mx) addShield(owner, h + v - mx); } } catch (e) {}
      return v;
    };
  }

  // ── 受到傷害：護盾吸收、敗者榮光的免疫轉回血 ──
  var depth = 0, pend = false;
  var snapParty = function () { return party().map(function (e) { return [e, hpOf(e) || 0]; }); };
  var resOf = function (e, ele) { var k = ELE_KEY[ele]; return k && e.d ? Number(e.d[k]) || 0 : 0; };
  var settle = function (snap, mob) {
    var glory = gloryOn(), ele = mob && mob.e && mob.e !== 'none' ? mob.e : null;
    snap.forEach(function (row) {
      var e = row[0], lost = row[1] - (hpOf(e) || 0); if (!(lost > 0)) return;
      var back = 0;
      if (glory && ele && resOf(e, ele) >= 1000) back = Math.floor(lost * 1.5);          // 轉成物理的那份減半，再改成回血
      else { var sh = Number(e._afkShield) || 0; if (sh > 0) { var use = Math.min(sh, lost); e._afkShield = sh - use; back = use; } }
      if (!(back > 0)) return;
      var nv = Math.min(Number(e.mhp) || Infinity, (hpOf(e) || 0) + back);
      setHp(e, nv);
      if (!isLeader(e) && nv > 0 && e._downed) { e._downed = false; e._reviveCd = 0; }
    });
    var p = P();
    if (pend) { pend = false; if (p && p.hp <= 0 && !p.dead) window.killPlayer(); }
  };
  var needed = function () { return gloryOn() || anyShield(); };
  var wrapTaken = function (name) {
    var o = window[name]; if (typeof o !== 'function') return;
    window[name] = function (mob) {
      if (depth > 0 || !P() || !needed()) return o.apply(this, arguments);
      var snap = snapParty(), r; depth++; pend = false;
      try { r = o.apply(this, arguments); }
      finally { depth--; try { settle(snap, mob); } catch (e) { if (pend) { pend = false; window.killPlayer(); } } }
      return r;
    };
  };
  ['enemyPhysicalAttack', 'enemyAttackAlly', 'applyMobMagic', 'applyMobMagicToAlly', 'reflectWallOnDamage'].forEach(wrapTaken);
  if (typeof window.killPlayer === 'function') {
    var oKill = window.killPlayer;
    window.killPlayer = function () {
      try { var p = P(); if (p && !p.dead && depth > 0 && needed()) { pend = true; return; } } catch (e) {}
      return oKill.apply(this, arguments);
    };
  }

  // ── 血壁空間反彈：傷害減半 ──
  if (typeof window.reflectWallOnDamage === 'function') {
    var oRW = window.reflectWallOnDamage;
    window.reflectWallOnDamage = function (mob, dmg) {
      var a = Array.prototype.slice.call(arguments);
      try { var w = mob && mob._reflectWall; if (w && !w.block && tk() <= (w.until || 0) && dmg > 0) a[1] = Math.max(1, Math.floor(dmg * 0.5)); } catch (e) {}
      return oRW.apply(this, a);
    };
  }

  // ── 敗者榮光：沒命中改擦傷 ──
  if (typeof window.getPhysicalDmg === 'function') {
    var oPD = window.getPhysicalDmg;
    window.getPhysicalDmg = function () {
      var res = oPD.apply(this, arguments);
      try {
        if (res && !res.hit && gloryOn() && !arguments[10]) {
          var a = Array.prototype.slice.call(arguments); a[9] = true; res = oPD.apply(this, a);
        }
      } catch (e) {}
      return res;
    };
  }
  if (typeof window.allyStrikeRoll === 'function') {
    var oASR = window.allyStrikeRoll;
    window.allyStrikeRoll = function (ally, t, opts) {
      var res = oASR.apply(this, arguments);
      try {
        if (res && !res.hit && gloryOn()) {
          var r2 = oASR.call(this, ally, t, Object.assign({}, opts || {}, { forceHit: true, noHeavy: true }));
          if (r2 && r2.hit) { r2.dmg = Math.max(1, Math.floor(r2.dmg * 0.5)); r2.crit = false; r2.graze = true; res = r2; }
        }
      } catch (e) {}
      return res;
    };
  }

  // 傷害型法術：把技能表的 MP 換成帶標記的數字（算術照常），讓 getMpCost 認得出來；補助、減益魔法不帶標記
  var isDmgSpell = function (sk) { return !!(sk && sk.type === 'atk' && sk.dmgType === 'magic' && (sk.dmgDice || sk.multiDmg || sk.dmg || sk.valDice || sk.fixedDmg || sk.dmgPct)); };
  try { Object.keys(DB.skills).forEach(function (k) { var sk = DB.skills[k]; if (isDmgSpell(sk) && Number(sk.mp) > 0 && !(sk.mp && sk.mp._afkDmg)) { var o = Object(Number(sk.mp)); o._afkDmg = true; sk.mp = o; } }); } catch (e) {}
  // ── 轉生面板：魔法消耗、SP、回血間隔；金牛座聖衣的騎士 ──
  if (typeof window.recomputeStats === 'function') {
    var oRe = window.recomputeStats;
    window.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = P(); if (!p || !p.d || !reborn(p)) return r;
        var d = p.d;
        var floorSp = Math.floor(((Number(d.int) || 0) + 35) / 3);
        if ((Number(d.intSp) || 0) < floorSp) d.intSp = floorSp;
        var og = d.getMpCost;
        if (typeof og === 'function' && !og._afkReborn) {
          var w = function (mp, tier) {
            var b = Number(mp) || 0; if (!(b > 0) || !(mp && mp._afkDmg)) return og.apply(this, arguments);   // 只有傷害型法術才算
            var sp = (Number(d.intSp) || 0) + (Number(d.itemSp) || 0);
            return Math.round(og.call(this, b + (sp > 50 ? 50 : 0), tier) * 3);
          };
          w._afkReborn = true; d.getMpCost = w;
        }
        d.hpRegenFaster = Math.max(Number(d.hpRegenFaster) || 0, 13);   // 16 秒 − 13 秒＝每 3 秒
        if (p.cls === 'knight' && p.rebirthArt === 'w_arms' && zodiacOf(p) === '金牛座') {
          d.ac = (Number(d.ac) || 0) - 100; d.mr = (Number(d.mr) || 0) + 100; d.dr = (Number(d.dr) || 0) + 10;
          RES5.forEach(function (k) { d[k] = (Number(d[k]) || 0) + 100; });
        }
      } catch (e) {}
      return r;
    };
  }

  // ── 造成傷害（變身卡結算口）：百般武藝首擊、魔法武器加倍、聖衣補血、敵對血盟的爆發量 ──
  var wpnDouble = false;
  if (typeof window.weaponSpellProc === 'function') {
    var oWSP = window.weaponSpellProc;
    window.weaponSpellProc = function () {
      var prev = wpnDouble; wpnDouble = Math.random() < 0.2;
      try { return oWSP.apply(this, arguments); } finally { wpnDouble = prev; }
    };
  }
  var firsts = typeof WeakMap === 'function' ? new WeakMap() : null;
  var hitCount = function (actor, target) {
    if (!firsts || !actor || !target || typeof target !== 'object') return 99;
    var m = firsts.get(actor); if (!m) { m = new WeakMap(); firsts.set(actor, m); }
    var c = m.get(target) || 0; m.set(target, c + 1); return c;
  };
  var diceMax = function (e) { var it = e && e.eq && e.eq.wpn, d = it && DB.items[it.id]; return d ? Math.max(Number(d.dmgS) || 0, Number(d.dmgL) || 0) : 0; };
  var cardExtra = 0;   // 這一擊裡「變身卡系統」多加的傷害（敵對血盟換算強度時扣掉）
  var C = window.AFK_CARD_COMBAT;
  if (C && typeof C.damage === 'function') {
    var oD = C.damage;
    C.damage = function (actor, target, amount, opt) {
      opt = opt || {};
      try {
        if (amount > 0 && actor && target && !opt.dotCapped && !opt.inherited) {
          if (actor.cls === 'knight' && reborn(actor) && actor.rebirthArt === 'w_arms') {
            var c = hitCount(actor, target);
            if (zodiacOf(actor) === '雙子座') { if (c < 5) amount = amount * 30; }
            else if (c === 0) { var mx = diceMax(actor); if (mx > 0) amount = amount + mx * 10 - Math.ceil(mx / 2); }
          }
          if (wpnDouble && actor === P()) amount = amount * 2;
        }
      } catch (e) {}
      var r = oD.call(this, actor, target, amount, opt);
      try {
        if (actor === P() && r > amount) cardExtra += r - amount;
        if (r > 0 && actor && zodiacOf(actor) && tk() >= (actor._afkClothHealAt || 0)) {
          actor._afkClothHealAt = tk() + 30;
          var v = Math.floor(r * 0.5);
          party().forEach(function (e) { healWithShield(e, v); });
        }
      } catch (e) {}
      return r;
    };
  }
  window.__afkCardExtra = { take: function () { var v = cardExtra; cardExtra = 0; return v; }, reset: function () { cardExtra = 0; } };

  // ── 妖精・污濁之水（玩家 2026-10-24）：中了污濁之水的頭目，同時染上全部魔法系負面狀態 ──
  //   緩速術、木乃伊的詛咒（石化）、壞物術、疾病術、弱化術、闇盲咒術、魔法消除、魔法封印；持續時間照各自的法術
  var FOUL = [['slow', 'sk_slow'], ['stone', 'sk_mummy_curse'], ['broken', 'sk_break'], ['disease', 'sk_disease'], ['weaken', 'sk_weaken'], ['blind', 'sk_dark_blind'], ['mrhalf', 'sk_elf_magicerase'], ['vacuum', 'sk_seal']];
  var foulSnap = function () { var ms = (typeof mapState !== 'undefined' && mapState.mobs) || []; return ms.map(function (m) { return m && m.st ? (m.st.muddywater || 0) : 0; }); };
  var foulApply = function (before) {
    var ms = (typeof mapState !== 'undefined' && mapState.mobs) || [], base = (DB.skills.sk_elf_muddywater && DB.skills.sk_elf_muddywater.status && DB.skills.sk_elf_muddywater.status.dur) || 32;
    ms.forEach(function (m, i) {
      if (!m || !m.st || m._dead || !((m.st.muddywater || 0) > (before[i] || 0))) return;
      var ratio = m.st.muddywater / base;
      FOUL.forEach(function (x) {
        var sk = DB.skills[x[1]], st = sk && sk.status; if (!st) return;
        var v = Math.round((st.dur || 10) * ratio); if ((m.st[x[0]] || 0) < v) m.st[x[0]] = v;
        if (x[0] === 'blind' && st.hit) m.st.blindVal = Math.max(m.st.blindVal || 0, st.hit);
      });
      try { if (typeof logCombat === 'function' && !(typeof state !== 'undefined' && state.ff)) logCombat('<span class="font-bold" style="color:#7dd3fc;">【污濁之水】</span>濁流滲進 ' + m.n + ' 的每一道傷口——緩速、石化、損壞、疾病、弱化、目盲、魔抗減半、魔法封印一併纏上。', 'magic'); } catch (e) {}
    });
  };
  ['castSkill', 'allyCastMagic'].forEach(function (fn) {
    var o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () {
      var skId = fn === 'castSkill' ? arguments[0] : (arguments[1] && (arguments[1].id || arguments[1]));
      var isFoul = skId === 'sk_elf_muddywater' || (arguments[1] && arguments[1] === DB.skills.sk_elf_muddywater);
      if (!isFoul) return o.apply(this, arguments);
      var b = foulSnap(), r = o.apply(this, arguments);
      try { foulApply(b); } catch (e) {}
      return r;
    };
  });

  window.__afkRebirthRules = { addShield: addShield, healWithShield: healWithShield, gloryOn: gloryOn, zodiacOf: zodiacOf, shieldCap: shieldCap, foulApply: foulApply, FOUL: FOUL };
  console.log('[AFK-rebirth-rules] 已啟用：轉生魔法消耗與 SP、溢補護盾、敗者榮光、聖衣補血、魔法武器加倍、百般武藝首擊');
})();
