/* ==========================================================================
 * afk-hitstun.js — 受擊硬直：理念加強＋平衡（玩家 2026-10-22 指定）
 *
 * 原本設計（天堂職業硬直）：被「直接命中」（物理／魔法，不含持續傷害）→ 下一次動作延後一段時間，
 * 長短依職業與變身而定；每個動作週期最多吃一次，避免被圍毆時完全鎖死。
 *
 * 加強（讓所有「動作」都一致吃硬直，像原作一樣）：
 *   ‧主手一般攻擊（原本就有）
 *   ‧副手攻擊（原本不受影響）→ 各自的週期各吃一次
 *   ‧自動施放的攻擊技能／攻擊魔法（原本不受影響）→ 冷卻延後，每次施放後才能再吃
 *   ‧傭兵：原本就是「下一次行動（攻擊或施法）」延後，保留
 * 平衡（目前環境攻速很快、王與群怪打得很密）：
 *   ‧每次硬直最多延後「該動作間隔的 40%」→ 被一直打時動作頻率最低約剩 71%，
 *     不會再出現攻速越快的角色被打到攻擊速度砍半的情況；攻速慢的角色照原本秒數吃滿
 *   ‧傭兵同樣套 40% 上限（需要核心補丁 33）
 *   ‧裝備的「硬直減免」照舊先扣
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('hitstun')) return;
  if (typeof window.applyPlayerHitstun !== 'function') { console.warn('[AFK-hitstun] 找不到 applyPlayerHitstun，略過'); return; }

  var CAP = 0.4;
  var S = function () { return (typeof state !== 'undefined' && state) ? state : null; };
  var capped = function (hs, interval) { return (interval > 0) ? Math.min(hs, interval * CAP) : hs; };

  window.applyPlayerHitstun = function () {
    var s = S(); if (!s || !player || player.dead) return;
    var hs = (player.d && player.d.hitstun) || 0;
    if (hs <= 0) return;
    // 主手
    if (!s._pStunCycle) {
      var iv = 0; try { iv = playerAttackIntervalTicks(true); } catch (e) {}
      s.pDmgTick = (s.pDmgTick || 0) - capped(hs, iv);
      s._pStunCycle = true;
    }
    // 副手（有裝副手武器時）
    if (!s._afkOffStun) {
      var ov = 0; try { ov = (typeof playerOffhandIntervalTicks === 'function') ? playerOffhandIntervalTicks(true) : 0; } catch (e) {}
      if (ov > 0) { s.pOffDmgTick = (Number(s.pOffDmgTick) || 0) - capped(hs, ov); s._afkOffStun = true; }
    }
    // 攻擊技能／攻擊魔法的自動施放
    if (!s._afkCastStun && player.cds) {
      var cv = 0; try { cv = (typeof castIntervalTicks === 'function') ? castIntervalTicks(player, false) : 0; } catch (e) {}
      player.cds.atkSk = Math.max(0, Number(player.cds.atkSk) || 0) + capped(hs, cv);
      s._afkCastStun = true;
    }
  };
  if (typeof window.dualWieldOffhandAttack === 'function') {
    var oOff = window.dualWieldOffhandAttack;
    window.dualWieldOffhandAttack = function () { var s = S(); if (s) s._afkOffStun = false; return oOff.apply(this, arguments); };
  }
  if (typeof window.castSkill === 'function') {
    var oCast = window.castSkill;
    window.castSkill = function () { var r = oCast.apply(this, arguments); if (r) { var s = S(); if (s) s._afkCastStun = false; } return r; };
  }
  // 傭兵：同樣最多延後行動間隔的 40%（核心補丁 33 呼叫）
  window.__afkHitstunFor = function (ally) {
    var hs = (ally && ally.d && ally.d.hitstun) || 0; if (hs <= 0) return 0;
    var iv = 0; try { iv = allyAttackIntervalTicks(ally, ally.statuses || {}); } catch (e) {}
    return capped(hs, iv);
  };

  window.__afkHitstun = { CAP: CAP };
  console.log('[AFK-hitstun] 已啟用：主手／副手／攻擊施法一致吃硬直，每次最多延後動作間隔的 40%');
})();
