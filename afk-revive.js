/* ============================================================================
 * afk-revive.js — 復活規則（玩家 2026-10-30 20:43；外掛開關 revivefix，預設開）
 *
 *   一、復活卷軸讓自己原地復活：HP 100%（原本 1～200）。返生術照原本。
 *       （夢域鏡轉生後「吸走 MP 10%」的代價照 afk-dreamcost。）
 *   二、席琳夢域鏡：自己原地復活（返生術、復活卷軸）同一張地圖最多 3 次；換地圖重算（重新整理不重算）。用完只能回村復活。
 *   經典模式不套用。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'revivefix', name: '復活規則（卷軸 HP 100%、夢域鏡自己復活 3 次）', group: '遊戲玩法', seal: true,
    desc: '復活卷軸讓自己原地復活時 HP 回滿；席琳夢域鏡裡同一張地圖最多自己原地復活 3 次（換地圖重算）' });
  var on = function () { try { return (!T || T.enabled('revivefix')) && !!(player && player.cls && !player.classicMode); } catch (e) { return false; } };
  var dream = function () { try { if (W.__afkDreamHell && W.__afkDreamHell.on) return !!W.__afkDreamHell.on(); return !!(player.sherineDream && player.sherineMad); } catch (e) { return false; } };
  var LIMIT = 3;
  // 次數記在角色身上（存進存檔）：重新整理不會重算，換地圖才重算（2026-10-30 QA：原本重新整理就又有 3 次）
  var cur = function () { var p = player, m = (typeof mapState !== 'undefined' && mapState.current) || ''; var rec = p._afkRevive; if (!rec || typeof rec !== 'object') rec = p._afkRevive = { map: m, n: 0 }; if (rec.map !== m) { rec.map = m; rec.n = 0; } return rec; };
  var blocked = function () { return on() && dream() && cur().n >= LIMIT; };
  var scrolls = function () { return (player.inv || []).reduce(function (s, i) { return s + (i && i.id === 'scroll_revive' ? (Number(i.cnt) || 0) : 0); }, 0); };
  if (typeof W.reviveInPlace === 'function') {
    var oRIP = W.reviveInPlace;
    W.reviveInPlace = function () {
      if (blocked()) {
        try { if (player.dead && typeof logSys === 'function') logSys('<span class="text-red-400">席琳夢域鏡裡，這張地圖你已經自己復活 ' + LIMIT + ' 次了——只能回村復活。</span>'); } catch (e) {}
        return;
      }
      var wasDead = player.dead, sc0 = scrolls(), r = oRIP.apply(this, arguments);
      try {
        if (on() && wasDead && !player.dead) {
          if (dream()) { cur().n++; if (typeof logSys === 'function') logSys('<span class="text-amber-300">夢域鏡自己復活：這張地圖已用 ' + cur().n + '／' + LIMIT + ' 次。</span>'); }
          if (scrolls() < sc0 && player.hp < player.mhp) { player.hp = player.mhp; try { updateUI(); } catch (e) {} }   // 復活卷軸：HP 回滿
        }
      } catch (e) {}
      return r;
    };
    try { reviveInPlace = W.reviveInPlace; } catch (e) {}
  }
  if (typeof W.updateReviveInPlaceBtn === 'function') {
    var oBtn = W.updateReviveInPlaceBtn;
    W.updateReviveInPlaceBtn = function () {
      var r = oBtn.apply(this, arguments);
      try { if (blocked()) { var b = document.getElementById('btn-revive-inplace'); if (b) b.classList.add('hidden'); } } catch (e) {}
      return r;
    };
    try { updateReviveInPlaceBtn = W.updateReviveInPlaceBtn; } catch (e) {}
  }
  W.__afkRevive = { LIMIT: LIMIT, used: function () { return cur().n; }, blocked: blocked, _reset: function () { try { player._afkRevive = null; } catch (e) {} } };
})();
