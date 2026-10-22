/* ==========================================================================
 * afk-stun.js — 鈍擊改為真正的暈眩，連暈 10 秒進入完全停擺（玩家 2026-10-21 指定）
 *   ‧單手鈍器的鈍擊（玩家與傭兵）：命中後目標暈眩 1 秒，暈眩中 100% 無法行動（攻擊、施法都不行）
 *   ‧頭目依序判定：50% 完全免疫 → 沒免疫時 50% 機率時間減半 → 再 50% 機率時間再減 30%
 *   ‧任何怪物連續暈眩 10 秒 → 進入 15 秒「完全停擺」：不行動、不自然回血、不放自動技能，
 *     連副本的固定定時技能（例如四龍副本的龍鱗反射、60 秒回滿、詛咒）也停止。停擺結束後重新計算連暈
 *   ‧停擺判定給其他模組用：window.__afkHalted(m)
 * 必須排在所有包 tick 的模組之後（最外層），才能擋住各來源的回血。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('stunfix')) { window.__afkHalted = function () { return false; }; return; }
  if (typeof window.tick !== 'function') { console.warn('[AFK-stun] 找不到 tick，略過'); return; }

  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var RUN_NEED = 100, HALT = 150, BLUNT = 10;   // 單位 tick（0.1 秒）
  var clog = function (h) { try { if (!S().ff && typeof logCombat === 'function') logCombat(h, 'magic'); } catch (e) {} };
  var nm = function (m) { try { return '<span class="' + getMobColor(m.lv) + '">' + m.n + '</span>'; } catch (e) { return m.n; } };

  var halted = function (m) { return !!(m && m._afkHaltUntil && (S().ticks || 0) < m._afkHaltUntil); };
  window.__afkHalted = halted;

  // 鈍擊命中 → 暈眩（頭目有抗性）
  var bluntStun = function (m) {
    if (!m.st && typeof newMobStatus === 'function') m.st = newMobStatus();
    if (!m.st) return;
    var dur = (typeof window.__afkBluntTicks === 'function' && window.__afkBluntTicks()) || BLUNT;   // 遺物強化可延長鈍擊（afk-relicfx）
    if (m.boss) {
      if (Math.random() < 0.5) return;               // 50% 免疫
      if (Math.random() < 0.5) dur *= 0.5;          // 50% 時間 -50%
      if (Math.random() < 0.5) dur *= 0.7;          // 50% 時間 -30%
      dur = Math.max(1, Math.round(dur));
    }
    if ((m.st.stun || 0) < dur) m.st.stun = dur;
  };

  var snap = [];
  var oTick = window.tick;
  window.tick = function () {
    var s = S(), t0 = s.ticks, mobs = (typeof mapState !== 'undefined' && mapState && mapState.mobs) || [];
    snap.length = 0;
    for (var i = 0; i < mobs.length; i++) {
      var m = mobs[i]; if (!m) continue;
      if (halted(m)) {
        snap.push([m, m.curHp]);
        if (m.regenHp && m._afkRegenSave == null) { m._afkRegenSave = m.regenHp; m.regenHp = 0; }
        if (!m.st && typeof newMobStatus === 'function') m.st = newMobStatus();
        if (m.st) m.st.stun = Math.max(m.st.stun || 0, m._afkHaltUntil - (t0 || 0));
      }
    }
    try { return oTick.apply(this, arguments); }
    finally {
      try {
        var t = s.ticks;
        // 停擺中：任何來源的回血都擋掉（只會因受傷而下降）
        for (var j = 0; j < snap.length; j++) { var a = snap[j]; if (a[0].curHp > a[1] && a[0].curHp > 0) a[0].curHp = a[1]; }
        if (t !== t0) {
          mobs = (typeof mapState !== 'undefined' && mapState && mapState.mobs) || [];
          for (var k = 0; k < mobs.length; k++) {
            var m2 = mobs[k]; if (!m2 || m2._dead || !(m2.curHp > 0)) continue;
            if (m2._bluntShow && m2._bluntShow !== m2._afkBluntSeen) { m2._afkBluntSeen = m2._bluntShow; if (!halted(m2)) bluntStun(m2); }
            if (halted(m2)) continue;
            if (m2._afkHaltUntil) {   // 停擺剛結束
              m2._afkHaltUntil = 0; m2._afkStunRun = 0;
              if (m2._afkRegenSave != null) { m2.regenHp = m2._afkRegenSave; m2._afkRegenSave = null; }
              if (m2.st) m2.st.stun = 0;
              continue;
            }
            if (m2.st && m2.st.stun > 0) {
              m2._afkStunRun = (m2._afkStunRun || 0) + 1;
              if (m2._afkStunRun >= RUN_NEED) {
                m2._afkHaltUntil = t + HALT; m2._afkStunRun = 0; m2.st.stun = HALT;
                clog('💫 ' + nm(m2) + ' 連續暈眩 10 秒，陷入 <span class="text-yellow-300 font-bold">完全停擺</span>（15 秒：無法行動、不回血、不放任何技能）！');
              }
            } else m2._afkStunRun = 0;
          }
        }
      } catch (e) {}
    }
  };

  console.log('[AFK-stun] 已啟用：鈍擊暈眩、頭目抗性、連暈 10 秒完全停擺');
})();
