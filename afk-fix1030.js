/* ============================================================================
 * afk-fix1030.js — 2026-10-30 第二輪實玩 QA 的修正（外掛開關 fix1030，預設開）
 *
 *   一、攻城塔／城門 0 血卻沒結算（玩家回報「打死卻沒辦法解除攻城狀態」）：
 *       最後一擊跟你倒下同時發生（反彈把你打死）時，核心先 return、沒呼叫 killMob；你倒下期間 tick 也不跑，
 *       回村後存下的塔血是 0，又被當成「沒有紀錄」滿血重生。→ 每個 tick 檢查：攻城建築 0 血就照常結算
 *       （你活著＝killMob；你倒下＝直接算攻破）。另外任何 0 血卻沒死的怪（遺物特效的追加傷害沒呼叫 killMob）也補結算。
 *   二、時空裂痕：入口視窗進場後關掉；已經在裂痕裡不能再按一次重開（原本會再扣龜裂之核、計時歸零）。
 *       裂痕裡不再抽到「白目玩家」樣板怪（沒套名字與外觀，圖示 404）。
 *   三、最終決戰：進場後關掉席琳的對話視窗（手機會整個蓋住戰鬥畫面與復活鈕）；不印「遺忘之島途中」；
 *       中途重新整理被留在死亡之海時送回村莊；改名後的「席琳夢境／幻影／伴身 死亡女神 席琳」沿用本來的動畫與圖示。
 *   四、手機寬度關掉「手機版面」時，村莊的日誌會蓋住地圖與 NPC → 進遊戲時提示可以一鍵開回來。
 *   五、攻城戰敗 30 分鐘鎖住期間，攻城選單的宣戰按鈕直接停用並寫明原因。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'fix1030', name: '修正：攻城 0 血結算、裂痕／最終決戰視窗', group: '系統與其他', seal: true,
    desc: '攻城塔或城門 0 血卻沒結算、時空裂痕重複進場、最終決戰視窗蓋住畫面、中途重新整理留在死亡之海等問題的修正' });
  if (T && !T.enabled('fix1030')) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var closeNpc = function () { try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {} };

  // ── 一、0 血結算 ──
  var sweep = function () {
    var p = P(); if (!p || typeof mapState === 'undefined' || !mapState.mobs) return;
    var sg = p.siege;
    mapState.mobs.forEach(function (m, i) {
      if (!m || m._dead || !(m.curHp <= 0) || m._afkNoSweep) return;
      if (!p.dead) { try { killMob(i); } catch (e) {} return; }
      if (sg && sg.active && m.siegeEnemy && typeof siegeCityCfg === 'function') {   // 你倒下時：建築直接算攻破
        var c = siegeCityCfg(); m._dead = true; mapState.mobs[i] = null;
        if (m.n === c.tower && !sg.towerKilled) { sg.towerKilled = true; try { endSiege('win'); } catch (e) {} }
        else if (m.n === c.gate && !sg.gateKilled) { sg.gateKilled = true; sys('🏰 <span class="text-yellow-300 font-bold">' + c.gate + '已被攻破！</span>' + c.innerName + '已開啟。'); }
      }
    });
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var t0 = S().ticks, r = oTick.apply(this, arguments); try { if (!S().ff && (S().ticks !== t0 || (P() && P().dead))) sweep(); } catch (e) {} return r; };
  }
  // 存下的塔／城門血量是 0 → 不要當成沒有紀錄（核心只在 >0 時沿用）：直接算攻破
  if (typeof W.saveSiegeBossHp === 'function') {
    var oSave = W.saveSiegeBossHp;
    W.saveSiegeBossHp = function () { try { sweep(); } catch (e) {} return oSave.apply(this, arguments); };
  }

  // ── 二、時空裂痕 ──
  if (typeof W.enterRift === 'function') {
    var oRift = W.enterRift;
    W.enterRift = function () {
      if (S().riftRun) { sys('<span class="text-amber-300">你已經在時空裂痕裡了。</span>'); closeNpc(); return; }
      var r = oRift.apply(this, arguments);
      if (S().riftRun) closeNpc();
      return r;
    };
    try { enterRift = W.enterRift; } catch (e) {}
  }
  if (typeof W.pickRiftMob === 'function') {
    var oPick = W.pickRiftMob;
    W.pickRiftMob = function () {
      for (var k = 0; k < 12; k++) { var id = oPick.apply(this, arguments), m = id && DB.mobs[id]; if (!m || !(m.trollPlayer || m.race === '玩家')) return id; }
      return null;
    };
    try { pickRiftMob = W.pickRiftMob; } catch (e) {}
  }

  // ── 三、最終決戰 ──
  var FB = W.__afkFinalBoss;
  if (typeof W.afkFinalEnter === 'function') {
    var oFE = W.afkFinalEnter;
    W.afkFinalEnter = function () {
      var oLog = W.logSys, r;
      if (typeof oLog === 'function') W.logSys = function (h) { if (String(h).indexOf('遺忘之島途中') >= 0) return; return oLog.apply(this, arguments); };
      try { r = oFE.apply(this, arguments); } finally { if (typeof oLog === 'function') W.logSys = oLog; }
      if (S()._afkFinal) closeNpc();
      return r;
    };
  }
  if (typeof W.loadGame === 'function') {
    var oLoad = W.loadGame;
    W.loadGame = function () {
      var r = oLoad.apply(this, arguments);
      setTimeout(function () {
        try {
          var map = FB && FB.MAP;
          if (map && P() && typeof mapState !== 'undefined' && mapState.current === map && !S()._afkFinal) {
            var home = typeof getHomeTown === 'function' ? getHomeTown() : 'town_silver_knight';
            setMapSelectors(home); changeMap(true);
            sys('<span class="text-slate-300">死亡之海的門已經關上了，你被送回了村莊。</span>');
          }
        } catch (e) {}
      }, 2500);
      return r;
    };
    try { loadGame = W.loadGame; } catch (e) {}
  }
  try {   // 改名後的頭目沿用本來的動畫與圖示
    if (FB && FB.TIER && typeof MOB_ANIM_ALIAS !== 'undefined') {
      var get = function (n) { try { return (0, eval)(n); } catch (e) { return null; } };
      var SETS = ['MOB_ANIM_NAMES', 'MOB_ANIM_BAKED_SHADOW', 'MOB_SHADOW_TINT', 'MOB_ANIM_BIG', 'MOB_ANIM_SMALL', 'MOB_ANIM_SPRITE_SHADOW', 'MOB_ANIM_WEAPON_FX', 'MOB_ANIM_WEAPON_FX2', 'MOB_ANIM_8DIR'].map(get);
      var OBJS = ['MOB_ANIM_SKILL_FX', 'MOB_YLIFT', 'MOB_ANIM_DEATH_FX', 'BOSS_ENTRANCE_FX', 'MOB_HURT_SFX', 'MOB_KILL_SFX', 'MOB_ATTACK_SFX'].map(get);
      var src = FB.BOSS_NAME;
      Object.keys(FB.TIER).forEach(function (k) {
        var nm = FB.TIER[k].n + ' ' + src;
        if (MOB_ANIM_ALIAS[src] && !MOB_ANIM_ALIAS[nm]) MOB_ANIM_ALIAS[nm] = MOB_ANIM_ALIAS[src];
        SETS.forEach(function (s) { if (s && s.has && s.has(src)) s.add(nm); });
        OBJS.forEach(function (o) { if (o && o[src] != null && o[nm] == null) o[nm] = o[src]; });
      });
    }
  } catch (e) {}

  // ── 四、手機寬度關掉手機版面 ──
  var mobileHint = false;
  var hint = function () {
    try {
      if (mobileHint || !T || T.enabled('mobile') || W.innerWidth > 640) return;
      var gs = document.getElementById('game-screen'); if (!gs || gs.classList.contains('hidden')) return;
      mobileHint = true;
      var d = document.createElement('div'); d.id = 'afk-mobile-hint';
      d.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:#1e293b;border:1px solid #38bdf8;border-radius:10px;padding:10px 12px;color:#e2e8f0;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.6)';
      d.innerHTML = '目前的畫面寬度建議開啟「手機版面」，否則村莊的日誌會蓋住地圖與 NPC。<div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end"><button type="button" data-x="no" style="padding:6px 12px;border-radius:8px;background:#334155;color:#e2e8f0;border:0">先不要</button><button type="button" data-x="yes" style="padding:6px 12px;border-radius:8px;background:#0ea5e9;color:#04263a;font-weight:700;border:0">開啟並重新整理</button></div>';
      d.addEventListener('click', function (e) { var b = e.target.closest('[data-x]'); if (!b) return; if (b.getAttribute('data-x') === 'yes') { try { T.set('mobile', true); if (typeof saveGame === 'function') saveGame(); } catch (er) {} location.reload(); } else d.remove(); });
      document.body.appendChild(d);
    } catch (e) {}
  };
  setInterval(hint, 3000);

  // ── 五、戰敗鎖住期間停用宣戰按鈕 ──
  if (typeof W.openSiegeSelect === 'function') {
    var oOSS = W.openSiegeSelect;
    W.openSiegeSelect = function () {
      var r = oOSS.apply(this, arguments);
      try {
        var L = W.__afkSiegeLose; if (!L || !(L.left() > 0)) return r;
        setTimeout(function () {
          document.querySelectorAll('button[onclick*="startSiege"],button[onclick*="openPreparation"],button[onclick*="siegeV2"],[data-siege-city]').forEach(function (b) { b.disabled = true; b.style.opacity = '.5'; b.title = L.text(); });
          var host = document.getElementById('interaction-content') || document.body, n = document.getElementById('afk-siege-lock-note');
          if (!n && host) { n = document.createElement('div'); n.id = 'afk-siege-lock-note'; n.className = 'text-red-300 text-sm font-bold p-2'; n.textContent = '⛔ ' + L.text(); host.insertBefore(n, host.firstChild); }
        }, 0);
      } catch (e) {}
      return r;
    };
  }
  W.__afkFix1030 = { sweep: sweep };
})();
