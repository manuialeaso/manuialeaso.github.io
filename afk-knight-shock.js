/* ============================================================================
 * afk-knight-shock.js — 騎士「衝擊之暈」全範圍版（玩家 2026-10-26 指定）
 *
 * 限定：騎士、已轉生（rebirth > 0）。玩家與傭兵騎士都適用。
 *   ‧主目標照原本一擊（武器骰＋近距離傷害＋近距離爆擊＋技能 +10），之後畫面中其他敵人也各吃一擊：
 *     每個目標各自擲命中、爆擊（走同一套物理公式：近距離傷害、近距離命中、近距離爆擊率、爆擊傷害都算）
 *   ‧力量：每點力量 +1 傷害（主目標與範圍目標都加）
 *   ‧敏捷：暈眩率 = 10% + 敏捷 × 0.5%（最高 60%），暈眩命中加值 = 敏捷 ÷ 10（對抗魔防判定）
 *     主目標原本已擲 10%，再補擲「敏捷那一段」，總機率與範圍目標相同
 *   ‧頭目也能被暈（各自判定抵抗）
 *   ‧場上只有一隻怪（玩家 2026-10-31 01:56）：這一下衝擊之暈的傷害 +50%，並附加黑暗妖精「破壞盔甲」（8 秒），
 *     同時那隻怪 AC +100（8 秒，共用 afk-mech1031 的 AC 減益）
 * ========================================================================== */
(function () {
  'use strict';
  var __T = window.AFK_TOGGLES;
  if (__T && __T.register) __T.register({ id: 'knightshock', name: '轉生騎士衝擊之暈打全畫面', desc: '轉生騎士的衝擊之暈打畫面上全部的怪，力量加傷害、敏捷加暈眩率，頭目也會暈', group: '遊戲玩法' });
  if (__T && !__T.enabled('knightshock')) { console.log('[AFK] 外掛開關「轉生騎士衝擊之暈打全畫面」已關閉'); return; }
  var W = window, SK = 'sk_shock_stun';
  var MS = function () { return (typeof mapState !== 'undefined' && mapState) ? mapState : null; };
  var ok = function (p) { return !!(p && p.cls === 'knight' && p.rebirth > 0); };
  var stat = function (p, k) { return Math.max(0, Math.floor(Number(p && p.d && p.d[k]) || 0)); };
  var stunP = function (p) { return Math.min(0.6, 0.1 + stat(p, 'dex') * 0.005); };
  var hitOff = function (p, wpn) { return Math.floor(stat(p, 'dex') / 10) + ((wpn && wpn.stunHitBonus && !wpn.isBow) ? Math.round(wpn.stunHitBonus / 5) : 0); };
  var C = function () { return W.AFK_CARD_COMBAT; };
  var hurt = function (actor, m, v) {
    v = Math.max(1, Math.floor(v));
    var c = C(); if (c) v = c.damage(actor, m, v, { kind: c.physicalKind ? c.physicalKind(actor) : 'phys' });
    m.curHp -= v; if (typeof mobWake === 'function') try { mobWake(m); } catch (e) {}
    return v;
  };
  var reap = function () {
    var ms = MS(); if (!ms || typeof killMob !== 'function') return;
    ms.mobs.filter(function (m) { return m && m.curHp <= 0 && !m._dead; }).map(function (m) { return m.uid; }).forEach(function (uid) {
      var i = ms.mobs.findIndex(function (m) { return m && m.uid === uid && m.curHp <= 0 && !m._dead; });
      if (i !== -1) { try { killMob(i); } catch (e) {} }
    });
  };
  var stun = function (m, p, wpn, chance) {
    if (!m || m._dead || !(m.curHp > 0) || !(Math.random() < chance)) return;
    var sk = DB.skills[SK]; if (typeof applyMobStatus === 'function') applyMobStatus(m, { kind: 'stun', pbase: sk.stun, dur: 6, hitOff: hitOff(p, wpn) }, sk.n);
  };
  var clog = function (h) { try { if (!(state && state.ff) && typeof logCombat === 'function') logCombat(h, 'skill'); } catch (e) {} };
  var nm = function (m) { try { return '<span class="' + getMobColor(m.lv) + '">' + m.n + '</span>'; } catch (e) { return m.n; } };

  // strike(m) → {hit, dmg, crit}；actor 是誰就用誰的近距離數值
  var sweep = function (actor, main, wpn, strike) {
    var ms = MS(); if (!ms) return;
    var sk = DB.skills[SK], str = stat(actor, 'str'), p = stunP(actor), extraP = Math.max(0, p - (sk.stunChance || 0.1)), parts = [];
    if (main && main.curHp > 0 && !main._dead) {   // 主目標：補力量傷害與敏捷暈眩率
      if (str > 0) hurt(actor, main, str);
      if (main.curHp > 0) stun(main, actor, wpn, extraP / Math.max(0.0001, 1 - (sk.stunChance || 0.1)));
    }
    ms.mobs.slice().forEach(function (m) {
      if (!m || m === main || m._dead || !(m.curHp > 0)) return;
      var r = strike(m); if (!r || !r.hit) return;
      var v = hurt(actor, m, (r.dmg || 0) + (sk.skillAddDmg || 0) + str);
      parts.push(nm(m) + ' ' + v + (r.crit ? '(爆)' : ''));
      stun(m, actor, wpn, p);
    });
    if (parts.length) clog('<span style="font-weight:700;color:#7dd3fc">衝擊之暈</span>的震波擴散到全畫面：' + parts.join('、') + '。');
  };

  // ── 單體加成：場上只有一隻怪 ──
  var single = function (main) {
    var ms = MS(); if (!ms || !main) return false;
    var alive = ms.mobs.filter(function (m) { return m && !m._dead && m.curHp > 0; });
    return alive.length === 1 && alive[0] === main && !(W.__afkMech1031 && !W.__afkMech1031.on());
  };
  var soloBonus = function (actor, main, hp0) {
    if (!main || main._dead || !(main.curHp > 0)) return;
    var dealt = hp0 - main.curHp; if (!(dealt > 0)) return;
    var v = hurt(actor, main, dealt * 0.5);
    if (!main.st && typeof newMobStatus === 'function') main.st = newMobStatus();
    if (main.st) main.st.armorbreak = Math.max(main.st.armorbreak || 0, 80);
    if (typeof W.__afkAcDebuff === 'function') W.__afkAcDebuff(main, 'kshock', 100, 80);
    clog('<span style="font-weight:700;color:#7dd3fc">衝擊之暈</span>集中在 ' + nm(main) + ' 身上：追加 ' + v + ' 點傷害，並撕裂護甲（破壞盔甲、AC +100，8 秒）。');
  };

  if (typeof W.castSkill === 'function') {
    var oCast = W.castSkill;
    W.castSkill = function (skId) {
      if (skId !== SK || typeof player === 'undefined' || !ok(player)) return oCast.apply(this, arguments);
      var main = typeof getTarget === 'function' ? getTarget() : null, solo = single(main), hp0 = main ? main.curHp : 0;
      var r = oCast.apply(this, arguments);
      try {
        if (r && !player.dead) {
          var wi = player.eq && player.eq.wpn, wpn = wi ? DB.items[wi.id] : null;
          sweep(player, main, wpn, function (m) { var dice = wpn ? (m.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2; return getPhysicalDmg(dice, m, wpn, null); });
          if (solo) soloBonus(player, main, hp0);
          reap();
        }
      } catch (e) { console.warn('[AFK-knight-shock]', e); }
      return r;
    };
  }
  if (typeof W.allyCastPhysicalSkill === 'function') {
    var oAlly = W.allyCastPhysicalSkill;
    W.allyCastPhysicalSkill = function (ally, sk) {
      if (!sk || sk !== DB.skills[SK] || !ok(ally)) return oAlly.apply(this, arguments);
      var main = typeof getTarget === 'function' ? getTarget() : null, solo = single(main), hp0 = main ? main.curHp : 0;
      var r = oAlly.apply(this, arguments);
      if (r) {
        var sv = player; player = ally;   // 異常命中以傭兵自己判定（與核心傭兵技能一致）
        try {
          var wi = ally.eq && ally.eq.wpn, wpn = wi ? DB.items[wi.id] : null;
          sweep(ally, main, wpn, function (m) { return allyStrikeRoll(ally, m, {}); });
          if (solo) soloBonus(ally, main, hp0);
        } catch (e) { console.warn('[AFK-knight-shock]', e); }
        finally { player = sv; }
        reap();   // 換回主玩家後才結算擊殺（經驗、掉落歸隊伍）
      }
      return r;
    };
  }
  W.AFK_KNIGHT_SHOCK = { stunChance: stunP, single: single, soloBonus: soloBonus };
  console.log('[AFK-knight-shock] 已啟用：轉生騎士的衝擊之暈打全畫面（力量加傷害、敏捷加暈眩率，頭目也會暈）');
})();
