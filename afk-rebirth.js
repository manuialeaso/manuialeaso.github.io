/* ============================================================================
 * afk-rebirth.js — 輪迴轉生（玩家 2026-10-21 指定）
 *
 * 條件：Lv100、集齊六種時空材料；每個角色可轉生一次。入口＝時空裂痕入口的「時空裂痕-冥王域」（afk-dreamstar.js），
 *   進入時提醒「輪迴開始」，轉生後傳送回說話之島。
 * 轉生後：
 *   ‧所有屬性（基礎、配點、萬能藥）保留；屬性上限提升到 200
 *     （配點上限 60 → 200；屬性效果上限 100 → 200，100 以上的效果依 80→100 那段的成長幅度往上延伸）
 *   ‧等級回到 1（遊戲最低等級是 1）、經驗歸零；技能、裝備、背包都保留
 *   ‧裝備不限職業（等同對這個角色開啟「去除裝備職業限制」）
 *   ‧所有武器都可以雙持：主手已有武器時，再裝一把任何武器（包含兩把弓）就會放到副手，副手會追加一次攻擊
 *   ‧面板能力 +50：近距離傷害／命中、遠距離傷害／命中、魔法傷害／命中、額外魔法點數、
 *     四屬性抗性、MR、迴避各 +50，AC −50
 * 核心掛點：補丁 20（屬性上限、配點上限）；其餘包 recomputeStats／lookupStep／雙持判定。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('rebirth')) return;
  if (typeof window.recomputeStats !== 'function') { console.warn('[AFK-rebirth] 找不到 recomputeStats，略過'); return; }

  var reborn = function () { return !!(typeof player !== 'undefined' && player && player.rebirth > 0); };
  window.__afkAttrCap = function () { return reborn() ? 200 : 100; };
  window.__afkAllocCap = function () { return reborn() ? 200 : 60; };

  // 屬性效果表：100 以上依 80→100 的斜率延伸
  if (typeof window.lookupStep === 'function') {
    var oLook = window.lookupStep;
    window.lookupStep = function (val, table, def) {
      if (!(val > 100) || !reborn()) return oLook.apply(this, arguments);
      var v100 = oLook(100, table, def), v80 = oLook(80, table, def);
      if (typeof v100 !== 'number' || typeof v80 !== 'number') return v100;
      return v100 + Math.floor((v100 - v80) / 20 * (val - 100));
    };
  }

  // 面板 +50
  var oRe = window.recomputeStats;
  window.recomputeStats = function () {
    var r = oRe.apply(this, arguments);
    try {
      if (reborn() && player.d) {
        var d = player.d;
        ['meleeDmg', 'meleeHit', 'rangedDmg', 'rangedHit', 'magicDmg', 'magicHit', 'extraMp', 'resFire', 'resWater', 'resWind', 'resEarth', 'mr', 'er']
          .forEach(function (k) { d[k] = (Number(d[k]) || 0) + 50; });
        d.ac = (Number(d.ac) || 0) - 50;
      }
    } catch (e) {}
    return r;
  };

  // 雙持：任何武器
  if (typeof window.warriorDualWieldWpnOk === 'function') {
    var oWpnOk = window.warriorDualWieldWpnOk;
    window.warriorDualWieldWpnOk = function (id) {
      if (reborn()) { var d = id && DB.items[id]; return !!(d && d.type === 'wpn' && !d.isArrow); }
      return oWpnOk.apply(this, arguments);
    };
  }
  if (typeof window.dualWieldOffhandOk === 'function') {
    var oOffOk = window.dualWieldOffhandOk;
    window.dualWieldOffhandOk = function () { if (reborn()) return !!(player.eq && player.eq.wpn); return oOffOk.apply(this, arguments); };
  }

  // 轉生
  window.doRebirth = function (force) {
    if (!player) return { ok: false, msg: '請先進入遊戲。' };
    if (reborn()) return { ok: false, msg: '這個角色已經輪迴轉生過了。' };
    if ((player.lv || 1) < 100) return { ok: false, msg: '需要 Lv100 才能輪迴轉生。' };
    var go = function () {
      player.rebirth = 1;
      player.lv = 1; player.exp = 0;
      try { calcStats(); } catch (e) {}
      player.hp = player.mhp; player.mp = player.mmp;
      try { logSys('<span class="c-sherine font-bold">♻️ 輪迴轉生！</span><span class="text-fuchsia-200">你回到了 Lv1，但保留了全部屬性；屬性上限提升到 200、裝備不限職業、所有武器都能雙持，面板能力 +50。</span>'); } catch (e) {}
      try { updateUI(); renderTabs(true); saveGame(); } catch (e) {}
    };
    if (force) { go(); return { ok: true }; }
    var msg = '輪迴轉生後等級回到 1、經驗歸零（屬性、技能、裝備、背包都保留）。\n換來：屬性上限 200、裝備不限職業、所有武器可雙持、面板能力 +50。\n每個角色只能轉生一次，確定嗎？';
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '輪迴轉生', message: msg, okText: '轉生', cancelText: '取消', danger: true, onOk: go });
    else if (confirm(msg)) go();
    return { ok: true, pending: true };
  };
  window.__afkRebirth = { reborn: reborn };
  console.log('[AFK-rebirth] 已啟用：輪迴轉生');
})();
