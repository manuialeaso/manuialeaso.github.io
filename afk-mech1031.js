/* ============================================================================
 * afk-mech1031.js — 戰鬥機制調整（玩家 2026-10-31 01:56；開關併入「瘋狂席琳＋席琳夢域鏡模式」，經典模式不套用）
 *
 *   一、深蝕：王身上的中毒或出血疊滿層數後，持續疊滿 30 秒就發動「深蝕」——之後每 5 秒，王的火、水、風、地抗性
 *       與魔防各 −10，最多各 −200。層數掉下來就停（已扣的保留到王倒下），重新疊滿再從 30 秒算起。
 *       「疊滿」：出血＝層數到達這一段出血的上限；中毒＝層數到達上限（一般中毒只有 1 層，中毒中就算滿；遺物毒照遺物的上限）。
 *   二、戰士左右手都拿鈍器：造成的暈眩時間 ×1.5。
 *   三、妖精拿弓：幻影——角色造成的傷害計算兩次（持續傷害、反彈不算）。
 *   四、王暈眩破綻：王進入暈眩（含完全停擺）時，15 秒內 AC +200、受到的物理傷害 +150%、受到的傷害全部算爆擊
 *       （物理用攻擊者的近距離／遠距離爆擊傷害；已經爆擊的不重複算；魔法照攻擊者魔法爆擊傷害換算成「每一下都爆擊」的期望值）。
 *       破綻結束後，下一次新的暈眩才會再觸發。
 *   （騎士衝擊之暈單體加成在 afk-knight-shock.js；共用這裡的 AC 減益 W.__afkAcDebuff）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'mech1031', name: '戰鬥機制調整（深蝕、雙鈍器、弓的幻影、王暈眩破綻）', group: '遊戲玩法', seal: true,
    desc: '中毒／出血疊滿 30 秒後深蝕王的抗性與魔防；戰士雙鈍器暈眩 ×1.5；妖精拿弓傷害算兩次；王暈眩時 15 秒 AC +200、受物理 +150%、全部爆擊' });
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var on = function () { if (W.__afkTestNoMech) return false; try { return (!T || T.enabled('mech1031')) && !!(P() && !P().classicMode); } catch (e) { return false; } };
  var mobs = function () { return (typeof mapState !== 'undefined' && mapState && mapState.mobs) || []; };
  var live = function (m) { return !!(m && !m._dead && m.curHp > 0); };
  var clog = function (h) { try { if (!S().ff && typeof logCombat === 'function') logCombat(h, 'magic'); } catch (e) {} };
  var nm = function (m) { try { return '<span class="' + getMobColor(m.lv) + '">' + m.n + '</span>'; } catch (e) { return m.n; } };
  var tag = function (t, c) { return '<span class="font-bold" style="color:' + c + '">【' + t + '】</span>'; };
  var item = function (inst) { return inst && typeof DB !== 'undefined' ? DB.items[inst.id] : null; };
  var tags = function (inst) { try { return inst && typeof getWeaponTags === 'function' ? getWeaponTags(inst.id) : []; } catch (e) { return []; } };

  // ── AC 減益（同一隻怪可同時有多個來源，各自計時）──
  var acDebuff = function (m, key, amt, ticks) {
    if (!m) return;
    var b = m._afkAcDb || (m._afkAcDb = {}), cur = b[key];
    if (cur) { cur.until = Math.max(cur.until, tk() + ticks); return; }
    b[key] = { amt: amt, until: tk() + ticks };
    m.ac = (Number(m.ac) || 0) + amt;
  };
  var acStep = function (m) {
    var b = m && m._afkAcDb; if (!b) return;
    Object.keys(b).forEach(function (k) { if (tk() > b[k].until) { m.ac = (Number(m.ac) || 0) - b[k].amt; delete b[k]; } });
  };
  W.__afkAcDebuff = acDebuff;

  // ── 一、深蝕 ──
  var DS = { wait: 300, iv: 50, step: 10, max: 200 }, RES4 = ['resFire', 'resWater', 'resWind', 'resEarth'];
  var full = function (m) {
    var st = m.st || {};
    if (m.bleeds && m.bleeds.length > 0 && m.bleeds.length >= Math.max(1, m._bleedCap || 5)) return true;
    if ((st.poison || 0) > 0 && (st.poisonStacks || 0) >= Math.max(1, st.poisonCap || 1)) return true;
    return false;
  };
  var deepStep = function (m, t) {
    var st = m.st; if (st && !((st.poison || 0) > 0)) st.poisonCap = 0;
    if (!m.boss) return;
    if (!full(m)) { m._afkDsFull = 0; return; }
    if (!m._afkDsFull) { m._afkDsFull = t; return; }
    if (t - m._afkDsFull < DS.wait) return;
    var cut = m._afkDsCut || 0; if (cut >= DS.max) return;
    if (m._afkDsNext && t < m._afkDsNext) return;
    m._afkDsNext = t + DS.iv;
    var add = Math.min(DS.step, DS.max - cut);
    RES4.forEach(function (k) { m[k] = (Number(m[k]) || 0) - add; });
    var mr = Number(m.mr) || 0, mrCut = Math.min(add, Math.max(0, mr)); m.mr = mr - mrCut;
    m._afkDsCut = cut + add; m._afkDsMr = (m._afkDsMr || 0) + mrCut;
    if (cut === 0) clog(tag('深蝕', '#a3e635') + '毒血滲進 ' + nm(m) + ' 的骨髓——每 5 秒四屬性抗性與魔防各 −' + DS.step + '（最多 −' + DS.max + '）。');
    else if (m._afkDsCut >= DS.max) clog(tag('深蝕', '#a3e635') + nm(m) + ' 的四屬性抗性與魔防已被侵蝕 −' + DS.max + '。');
  };

  // ── 二、戰士雙鈍器：暈眩 ×1.5 ──
  var BLUNT = /鈍器/;
  var dualBlunt = function (a) {
    if (!a || a.cls !== 'warrior' || !a.eq || !a.eq.wpn || !a.eq.offwpn) return false;
    return tags(a.eq.wpn).some(function (x) { return BLUNT.test(x); }) && tags(a.eq.offwpn).some(function (x) { return BLUNT.test(x); });
  };
  var lastHit = function (m) { var h = m && m._afkHitBy; return h && tk() - h.t <= 1 ? h.a : null; };
  var stunScale = function (list) {   // list＝[[怪, tick 前的暈眩]]；這一拍新上的暈眩（比自然遞減多）且最後打它的是雙鈍器戰士 → ×1.5
    for (var k = 0; k < list.length; k++) {
      var a = list[k][0], s0 = list[k][1], s1 = a.st ? (a.st.stun || 0) : 0;
      if (s1 > Math.max(0, s0 - 1) && live(a) && !(W.__afkHalted && W.__afkHalted(a)) && dualBlunt(lastHit(a))) a.st.stun = Math.round(s1 * 1.5);
    }
  };

  // ── 三、妖精拿弓：幻影 ──
  var bowElf = function (a) { var d = a && a.cls === 'elf' && a.eq && item(a.eq.wpn); return !!(d && (d.isBow || (tags(a.eq.wpn) || []).indexOf('弓') >= 0)); };
  var phantomLog = new WeakMap();

  // ── 四、王暈眩破綻 ──
  var BR = { dur: 150, ac: 200, phys: 2.5 };
  var breached = function (m) { return !!(m && m._afkBreachUntil && tk() <= m._afkBreachUntil); };
  var breachStep = function (m, t) {
    var stun = !!(m.st && m.st.stun > 0) || !!(W.__afkHalted && W.__afkHalted(m));
    if (!m.boss) return;
    if (!stun) { m._afkBreachSeen = false; return; }
    if (m._afkBreachSeen || breached(m)) return;
    m._afkBreachSeen = true; m._afkBreachUntil = t + BR.dur;
    acDebuff(m, 'breach', BR.ac, BR.dur);
    clog(tag('破綻', '#fbbf24') + nm(m) + ' 被暈住露出破綻——15 秒內 AC +200、受到的物理傷害 +150%、所有傷害都算爆擊！');
  };
  var critMult = function (actor, target, kind, c) {
    var d = (actor && actor.d) || {};
    if (kind === 'melee' || kind === 'ranged' || kind === 'phys') {
      if (c && c.t === target && c.at === tk()) return 1;   // 這一下本來就爆擊（進傷害掛點前先記下：afk-caps 會把爆擊標記用掉）
      return 1 + Math.max(0, Number(kind === 'ranged' ? d.rangedCritDmg : d.meleeCritDmg) || 0) / 100;
    }
    if (kind === 'magic') {
      var m = 1 + Math.max(0, Number(d.magicCritDmg) || 0) / 100, p = Math.min(0.8, Math.max(0, Number(d.magicCrit) || 0) / 100);
      return m / (1 + p * (m - 1));   // 原本只有 p 的機率爆擊 → 換算成每一下都爆擊
    }
    return 1;
  };

  // ── 傷害掛點（排在其他卡片／符文倍率之外）──
  var C = W.AFK_CARD_COMBAT, inner = false;
  var reflected = function (o) { return !!(o && (o.reflection || o.redirected || o.origin === 'reflection' || o.origin === 'self' || o.origin === 'redirect')); };
  if (C && typeof C.damage === 'function') {
    var oDmg = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var crit0 = actor && actor._afkCrit;
      var v = oDmg.apply(this, arguments);
      try {
        if (!on() || inner || !(v > 0) || !actor || !actor.cls || !target || reflected(opt)) return v;
        var kind = opt && opt.kind;
        target._afkHitBy = { a: actor, t: tk() };
        if (kind === 'dot') return v;
        if (breached(target)) {
          if (kind === 'melee' || kind === 'ranged' || kind === 'phys') v *= BR.phys;
          v *= critMult(actor, target, kind, crit0);
        }
        if (bowElf(actor)) {
          v *= 2;
          var lt = phantomLog.get(actor) || -1e9;
          if (tk() - lt >= 100) { phantomLog.set(actor, tk()); clog(tag('幻影', '#67e8f9') + (actor === P() ? '你' : (actor._allyName || '妖精')) + ' 的幻影隨弓齊射——造成的傷害計算兩次。'); }
        }
        v = Math.floor(v);
      } catch (e) {}
      return v;
    };
  }

  // ── 每個 tick：深蝕、破綻、AC 減益到期、雙鈍器延長暈眩 ──
  var snap = [];
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var t0 = tk(), ms = mobs();
      snap.length = 0;
      if (on()) for (var i = 0; i < ms.length; i++) { var m = ms[i]; if (m && m.st) snap.push([m, m.st.stun || 0]); }
      var r = oTick.apply(this, arguments);
      try {
        var t = tk(); if (t === t0) return r;
        ms = mobs();
        for (var j = 0; j < ms.length; j++) { var x = ms[j]; if (x) acStep(x); }
        if (!on()) return r;
        stunScale(snap);
        for (var n = 0; n < ms.length; n++) { var b = ms[n]; if (!live(b)) continue; deepStep(b, t); breachStep(b, t); }
      } catch (e) {}
      return r;
    };
  }

  W.__afkMech1031 = { on: on, full: full, dualBlunt: dualBlunt, bowElf: bowElf, breached: breached, critMult: critMult, DS: DS, BR: BR,
    _deep: deepStep, _breach: breachStep, _stunScale: stunScale, _acStep: acStep, _inner: function (v) { inner = !!v; } };
})();
