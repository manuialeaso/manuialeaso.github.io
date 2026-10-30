/* ============================================================================
 * afk-bossrules.js — 頭目開場規則（玩家 2026-10-30 22:21；外掛開關 bossrules，預設開）
 *
 *   一、開場保護：進入要消耗鑰匙或道具的頭目房／副本（軍王之室、純頭目房、四龍巢穴、謀叛者的低語、哈汀的時空、異界祭壇、
 *       闇龍、時空裂痕、暗夢星迴、最終決戰）的前 2 秒，你與傭兵無敵（受到的傷害全部退回、不會倒下），
 *       避免一進場就被異常秒殺。夢域鏡的出場衝擊等全體傷害延到保護結束後才發動。
 *   二、場上同時兩隻以上的王：只有最早出場的那一隻會放「全隊扣 % 血」的招式（夢域鏡王登場的衝擊、夢域鏡頭目出場傷害與流血），
 *       第二、第三隻不放。例外：你是二轉角色、或是用傳送控制戒指找來的王。
 *   三、煙霧（玩家 2026-10-31 00:47；一般、席琳、瘋狂、夢域鏡都算，經典模式不算）：軍王之室、四龍、謀叛者的低語、哈汀的時空、異界祭壇、
 *       闇龍、時空裂痕、暗夢星迴、最終決戰——場上有王時每 80 秒放一次，必中，你與傭兵所有命中 −50%，3 秒。
 *       王被暈眩（或冰凍、石化等不能行動）時放不出來，等能動了再放。
 *   四、蝕抗（同上）：軍王之室、四龍、時空裂痕、暗夢星迴、最終決戰（含一轉女神）——進場超過 10 分鐘起，
 *       每 30 秒吸走你與傭兵的四屬性抗性（火、水、風、地）各 50，最多 500；離開就恢復。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'bossrules', name: '頭目開場規則（開場 2 秒無敵、多王只有第一隻放全體 % 傷害）', group: '遊戲玩法', seal: true,
    desc: '進入要消耗鑰匙或道具的頭目房、副本時前 2 秒無敵；場上同時兩隻以上的王時，只有最早出場的那隻會放全隊扣 % 血的招式（二轉角色、傳送控制戒指的王例外）；副本的王每 80 秒放煙霧（命中 −50% 3 秒），打超過 10 分鐘開始吸四屬性抗性' });
  var on = function () { try { return (!T || T.enabled('bossrules')) && !!(player && player.cls && !player.classicMode); } catch (e) { return false; } };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };

  // ── 一、開場保護 ──
  var GRACE = 20, PLUGIN_DG = { afk_traitor_whisper: 1, afk_hardin_time: 1, afk_giltas_altar: 1, afk_flame_depth: 1, afk_halpas_nest: 1, afk_final_sea: 1, rift_battle: 1 };
  var keyMap = function (key) {
    if (!key || /^town_/.test(key)) return false;
    if (PLUGIN_DG[key]) return true;
    if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[key]) return true;
    if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS.indexOf(key) >= 0) return true;
    if (typeof ANTHARAS_AREA_BOSS !== 'undefined' && ANTHARAS_AREA_BOSS[key]) return true;
    return !!S().dreamStar;
  };
  var until = -1, lastMap = null;
  var graceOn = function () { return until > 0 && on() && tk() <= until; };
  W.__afkGraceOn = graceOn;
  var snap = function () { var p = P(); if (!p) return null; return { p: p.hp, a: (p.allies || []).map(function (a) { return a ? [a, a.curHp, !!a._downed] : null; }) }; };
  var restore = function (s) {
    var p = P(); if (!p || !s) return;
    if ((p.hp || 0) < s.p) p.hp = s.p;
    s.a.forEach(function (x) { if (!x) return; var a = x[0]; if ((a.curHp || 0) < x[1]) a.curHp = x[1]; if (!x[2] && a._downed && a.curHp > 0) { a._downed = false; a._reviveCd = 0; } });
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var cur = (typeof mapState !== 'undefined' && mapState.current) || '';
      if (cur !== lastMap) { lastMap = cur; if (on() && keyMap(cur)) { until = tk() + GRACE; try { if (!S().ff && typeof logCombat === 'function') logCombat('<span class="text-sky-300 font-bold">【開場保護】</span>2 秒內你與傭兵不會受到傷害。', 'magic'); } catch (e) {} } }
      var g = graceOn(), s0 = g ? snap() : null;
      try { return oTick.apply(this, arguments); }
      finally { if (g) { try { restore(s0); } catch (e) {} } }
    };
  }
  var installKill = function () {
    var oKill = W.killPlayer; if (typeof oKill !== 'function' || oKill.__afkGrace) return;
    W.killPlayer = function () {
      try { var p = P(); if (p && graceOn() && (p.hp || 0) <= 0) { p.hp = Math.max(1, Math.floor((p.mhp || 1) * 0.5)); return; } } catch (e) {}
      return oKill.apply(this, arguments);
    };
    W.killPlayer.__afkGrace = true;
  };
  if (document.readyState === 'complete') setTimeout(installKill, 60); else W.addEventListener('load', function () { setTimeout(installKill, 60); });   // 在城堡護衛（禁衛軍代死）之後包，最外層先擋

  // ── 二、多王：只有第一隻放全體 % 傷害 ──
  W.__afkBossRankOk = function (m) {
    if (!on() || !m) return true;
    var p = P(); if (p && (p.rebirth || 0) >= 2) return true;
    if (m._dbRing || (typeof mapState !== 'undefined' && mapState._afkRingBoss)) return true;
    var bs = ((typeof mapState !== 'undefined' && mapState.mobs) || []).filter(function (x) { return x && x.boss && !x._dead && x.curHp > 0 && x.race !== '血盟' && x.race !== '建築'; });
    if (bs.length < 2) return true;
    bs.sort(function (a, b) { return (Number(a._born) || 0) - (Number(b._born) || 0); });
    return bs[0] === m;
  };
  // ── 三、煙霧 ──
  var DRAGON_MAP = { antaras_lair: 1, fafurion_lair: 1, valakas_lair: 1 };
  var KING4 = { king_baranka_room: 1, law_king_room: 1, necro_king_room: 1, assassin_king_room: 1 };   // 軍王之室（底比斯、提卡爾不算）
  var isKing = function (k) { return !!KING4[k]; };
  var isDragon = function (k) { return !!DRAGON_MAP[k] || (typeof ANTHARAS_AREA_BOSS !== 'undefined' && !!ANTHARAS_AREA_BOSS[k]); };
  var SMOKE_PLUGIN = { afk_traitor_whisper: 1, afk_hardin_time: 1, afk_giltas_altar: 1, afk_halpas_nest: 1 };
  var smokeZone = function (k) { return isKing(k) || isDragon(k) || !!SMOKE_PLUGIN[k] || k === 'rift_battle' || k === 'afk_final_sea' || !!S().dreamStar; };
  var resZone = function (k) { return isKing(k) || isDragon(k) || k === 'rift_battle' || k === 'afk_final_sea' || !!S().dreamStar; };
  var SMOKE = { iv: 800, dur: 30, k: 0.5 }, HITS = ['meleeHit', 'rangedHit', 'magicHit'];
  var RES = { after: 6000, iv: 300, step: 50, max: 500 }, RES4 = ['resFire', 'resWater', 'resWind', 'resEarth'];
  var zone = { map: null, t0: 0, smokeAt: 0, resAt: 0, res: 0 };
  var chars = function () { var p = P(); if (!p || p.dead) return []; return [p].concat((p.allies || []).filter(function (a) { return a && !a._downed && (a.curHp || 0) > 0; })); };
  var smokeOn = function (x) { return !!(x && x._afkSmoke2 && tk() <= x._afkSmoke2); };
  var recompute = function () { try { if (typeof recomputeStats === 'function') recomputeStats(); } catch (e) {} };
  var castSmoke = function (m) {
    var until = tk() + SMOKE.dur;
    chars().forEach(function (x) {
      if (x._afkSmokeUntil && tk() <= x._afkSmokeUntil) return;   // 一轉女神自己的煙霧還在：不重複算
      x._afkSmoke2 = until;
      if (x === P()) return;
      if (x.d && !(x._afkSmoke2Save && x._afkSmoke2Save.d === x.d)) { var sv = { d: x.d }; HITS.forEach(function (k) { sv[k] = Number(x.d[k]) || 0; x.d[k] = sv[k] > 0 ? Math.floor(sv[k] * (1 - SMOKE.k)) : sv[k]; }); x._afkSmoke2Save = sv; }
    });
    recompute();
    try { if (!S().ff && typeof logCombat === 'function') logCombat('<span class="font-bold" style="color:#94a3b8">【煙霧】</span>' + (m && m.n ? m.n : '頭目') + ' 吐出濃煙——你與傭兵所有命中 −50%（3 秒）。', 'enemy'); } catch (e) {}
  };
  var smokeEnd = function () {
    var p = P(); if (!p) return;
    if (p._afkSmoke2 && tk() > p._afkSmoke2) { p._afkSmoke2 = 0; recompute(); }
    (p.allies || []).forEach(function (x) { if (!x || !x._afkSmoke2Save || smokeOn(x)) return; var sv = x._afkSmoke2Save; x._afkSmoke2Save = null; x._afkSmoke2 = 0; if (x.d === sv.d) HITS.forEach(function (k) { x.d[k] = sv[k]; }); });
  };
  var applyResAlly = function () {
    var p = P(); if (!p) return;
    (p.allies || []).forEach(function (a) {
      if (!a || !a.d) return;
      var ap = a._afkRes4; if (!ap || ap.d !== a.d || ap.rn !== a._recompN) ap = { amt: 0 };
      var diff = zone.res - ap.amt; if (diff) RES4.forEach(function (k) { a.d[k] = (Number(a.d[k]) || 0) - diff; });
      a._afkRes4 = { amt: zone.res, d: a.d, rn: a._recompN };
    });
  };
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = P(); if (p && p.d) {
          if (smokeOn(p)) HITS.forEach(function (k) { var v = Number(p.d[k]) || 0; if (v > 0) p.d[k] = Math.floor(v * (1 - SMOKE.k)); });
          if (zone.res > 0) RES4.forEach(function (k) { p.d[k] = (Number(p.d[k]) || 0) - zone.res; });
        }
      } catch (e) {}
      return r;
    };
    try { recomputeStats = W.recomputeStats; } catch (e) {}
  }
  var halted = function (m) { try { if (W.__afkHalted && W.__afkHalted(m)) return true; var st = m && m.st; return !!(st && (st.stun > 0 || st.freeze > 0 || st.stone > 0 || st.sleep > 0 || st.paralyze > 0)); } catch (e) { return false; } };
  var zoneStep = function () {
    var key = (typeof mapState !== 'undefined' && mapState.current) || '', t = tk();
    if (zone.map !== key) {
      var hadRes = zone.res > 0;
      zone = { map: key, t0: t, smokeAt: t + SMOKE.iv, resAt: t + RES.after, res: 0 };
      if (hadRes) { recompute(); applyResAlly(); }
    }
    smokeEnd();
    if (!on() && zone.res > 0) { zone.res = 0; recompute(); applyResAlly(); }
    if (!on() || graceOn()) { zone.smokeAt++; zone.resAt++; return; }
    var finalNovice = key === 'afk_final_sea' && !!S()._afkFinalNovice;   // 一轉女神本來就有 60 秒的煙霧（10 秒），不再疊這一個
    if (smokeZone(key) && !finalNovice && t >= zone.smokeAt) {
      var bs = ((typeof mapState !== 'undefined' && mapState.mobs) || []).filter(function (x) { return x && x.boss && !x._dead && x.curHp > 0; });
      var caster = bs.filter(function (x) { return !halted(x); })[0];
      if (caster) { zone.smokeAt = t + SMOKE.iv; castSmoke(caster); }
      else zone.smokeAt = t + 10;   // 沒有王、或王都被暈住：等一下再試
    }
    if (resZone(key) && t >= zone.resAt && zone.res < RES.max) {
      zone.resAt = t + RES.iv; zone.res = Math.min(RES.max, zone.res + RES.step);
      recompute(); applyResAlly();
      try { if (!S().ff && typeof logCombat === 'function') logCombat('<span class="font-bold" style="color:#94a3b8">【蝕抗】</span>戰鬥拖太久，四屬性抗性被吸走了 ' + RES.step + '（目前 −' + zone.res + '，最多 −' + RES.max + '）。', 'enemy'); } catch (e) {}
    } else if (zone.res > 0 && t % 10 === 0) applyResAlly();
  };
  if (typeof W.tick === 'function') {
    var oTick2 = W.tick;
    W.tick = function () { var t0 = tk(), r = oTick2.apply(this, arguments); if (tk() !== t0) { try { zoneStep(); } catch (e) {} } return r; };
  }

  W.__afkBossRules = { zoneStep: zoneStep, zone: function () { return zone; }, SMOKE: SMOKE, RES: RES, smokeZone: smokeZone, resZone: resZone, GRACE: GRACE, keyMap: keyMap, graceOn: graceOn, until: function () { return until; }, _set: function (t) { until = t; } };
})();
