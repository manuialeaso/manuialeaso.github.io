/* ============================================================================
 * afk-bossrules.js — 頭目開場規則（玩家 2026-10-30 22:21；外掛開關 bossrules，預設開）
 *
 *   一、開場保護：進入要消耗鑰匙或道具的頭目房／副本（軍王之室、純頭目房、四龍巢穴、謀叛者的低語、哈汀的時空、異界祭壇、
 *       火焰之影／闇龍、時空裂痕、暗夢星迴、最終決戰）的前 2 秒，你與傭兵無敵（受到的傷害全部退回、不會倒下），
 *       避免一進場就被異常秒殺。夢域鏡的出場衝擊等全體傷害延到保護結束後才發動。
 *   二、場上同時兩隻以上的王：只有最早出場的那一隻會放「全隊扣 % 血」的招式（夢域鏡王登場的衝擊、夢域鏡頭目出場傷害與流血），
 *       第二、第三隻不放。例外：你是二轉角色、或是用傳送控制戒指找來的王。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'bossrules', name: '頭目開場規則（開場 2 秒無敵、多王只有第一隻放全體 % 傷害）', group: '遊戲玩法', seal: true,
    desc: '進入要消耗鑰匙或道具的頭目房、副本時前 2 秒無敵；場上同時兩隻以上的王時，只有最早出場的那隻會放全隊扣 % 血的招式（二轉角色、傳送控制戒指的王例外）' });
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
  W.__afkBossRules = { GRACE: GRACE, keyMap: keyMap, graceOn: graceOn, until: function () { return until; }, _set: function (t) { until = t; } };
})();
