/* ============================================================================
 * afk-autoreload.js — 長時間掛機：定時自動重新整理（預設開啟，每 4 小時）
 *
 * 為什麼：量測顯示遊戲自身的記憶體已有上限（afk-perf 的 perf-mem），但瀏覽器自己的圖片解碼快取、
 *   繪圖快取等會隨著走過的地圖／看過的怪物種類增加；這些由瀏覽器管理，記憶體吃緊時才會釋放。
 *   掛 24～72 小時的玩家，唯一能「全部歸零」的方式是重新整理頁面。
 *
 * 流程：
 *   1. 頁面開啟滿 N 小時（預設 4，可用 localStorage「afk_autoreload_hours」改成 1～48）後，每分鐘檢查一次是否安全：
 *      在遊戲中、角色沒死、沒在補跑、沒在時空裂痕／傲慢之塔攀登／遺忘之島／安塔瑞斯／攻城，
 *      沒有開著物品視窗、沒有輸入框在打字，且玩家 3 分鐘內沒有操作（不打斷正在操作的人）。
 *      不安全就等下一分鐘再看，不會強制。
 *   2. 存檔 → 在 sessionStorage 記下「要自動回到第幾格角色」→ 重新整理。
 *      （核心在 beforeunload/pagehide 也會立即存檔並註銷分頁登記，不會被「同角色多開」保護擋下。）
 *   3. 頁面載入後讀到記號（10 分鐘內有效、用過即刪）→ 自動進入同一格角色，地圖由存檔還原；
 *      重新整理那幾秒的掛機由既有的背景補跑／離線結算接手。系統日誌留一行說明。
 * 在首頁、選角畫面時到期：直接重新整理，不自動進角色（原本就不在遊戲中）。
 *
 * 2026-10-28（玩家：打一打突然跳回開始畫面又跳回打怪）：
 *   ‧畫面開著、有人在看的時候，要 30 分鐘沒操作才自動重整（原本 3 分鐘，看戰鬥不按東西也算閒置）；
 *     切到背景／其他分頁時維持 3 分鐘。
 *   ‧重整後到回到角色之前，蓋一層「更新中」的全黑畫面，不再閃出開始遊戲畫面。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('autoreload')) return;

  var FLAG = 'afk_autoreload_resume';
  var hours = 4;   // 預設 4 小時（2026-10-20 玩家指定：兼顧 8GB 電腦與常換地圖的掛法）
  try { var hr = localStorage.getItem('afk_autoreload_hours'); var h = Number(hr); if (hr !== null && h >= 0.001 && h <= 48) hours = h; } catch (e) {}
  var DUE_MS = hours * 3600 * 1000;
  var IDLE_MS = 3 * 60 * 1000, IDLE_VISIBLE_MS = 30 * 60 * 1000;   // 背景 3 分鐘；畫面開著 30 分鐘
  try { var imr = localStorage.getItem('afk_autoreload_idle_ms'); var im = Number(imr); if (imr !== null && imr !== '' && im >= 0 && im < IDLE_MS) IDLE_MS = im; } catch (e) {}   // ⚠ 未設定時 Number(null)=0，必須先排除 null   // 測試用：縮短閒置判定
  var startedAt = Date.now(), lastInput = Date.now();   // 開頁就算一次操作：剛重整完不會馬上又重整

  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function () { lastInput = Date.now(); }, { capture: true, passive: true });
  });

  var inGame = function () {
    var gs = document.getElementById('game-screen');
    return !!(gs && !gs.classList.contains('hidden') && typeof player !== 'undefined' && player && player.cls && typeof state !== 'undefined' && state.running);
  };
  var whyUnsafe = function () {
    var visible = !(document.visibilityState === 'hidden' || document.hidden);
    var idleNeed = visible ? Math.max(IDLE_MS, IDLE_VISIBLE_MS) : IDLE_MS;
    try { var ivr = localStorage.getItem('afk_autoreload_idle_ms'); if (ivr !== null && ivr !== '') idleNeed = IDLE_MS; } catch (e) {}   // 測試用：設了閒置時間就照設定
    if (Date.now() - lastInput < idleNeed) return visible ? '畫面開著，玩家 30 分鐘內有操作' : '玩家 3 分鐘內有操作';
    var a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return '輸入框使用中';
    var modal = document.getElementById('item-modal'); if (modal && !modal.classList.contains('hidden')) return '物品視窗開著';
    if (!inGame()) return '';   // 不在遊戲中：可以直接重新整理
    if (player.dead) return '角色死亡中';
    if (state.ff || (typeof catchupActive === 'function' && catchupActive())) return '補跑中';
    if (state.riftRun) return '時空裂痕進行中';
    if (state.prideClimb) return '傲慢之塔攀登中';
    if (state.oblivion) return '遺忘之島旅程中';
    if (state.antharas) return '安塔瑞斯巢穴挑戰中';
    // 11-28 Ping：四龍進度只存在執行中的狀態，重整就會消失；人在龍穴地圖就不重整，不看會消失的進度紀錄
    try { var mp = mapState.current; if (mp && ((typeof ANTHARAS_AREA_BOSS !== 'undefined' && ANTHARAS_AREA_BOSS[mp]) || /^antharas_/.test(mp))) return '人在龍穴地圖'; } catch (e) {}
    // 11-28 Ping：自動遠征進行中（含兩項之間的切換）不重整
    try { var ex = window.LineageActivities && LineageActivities.round(); if (ex && /^(running|between|starting)$/.test(ex.status)) return '自動遠征進行中'; } catch (e) {}
    if (player.siege && player.siege.active) return '攻城進行中';
    return '';
  };

  var lastWhy = '';
  // 2026-10-29（玩家：掛機時會自動更新）：有新版本時要不要自動重整，改由外掛開關「有新版本時自動更新」（autoupdate，預設關）決定；
  //   關著時只顯示更新提示，等滿定時重整的時間才會重整。
  var updDue = function () { return !!window.__afkUpdateDue && !!(T && T.enabled('autoupdate')); };
  var tick = function () {
    if (Date.now() - startedAt < DUE_MS && !updDue()) return;   // 有新版本（afk-update）→ 下一個安全時機就重整
    var why = whyUnsafe();
    if (why) { if (why !== lastWhy) { lastWhy = why; try { console.log('[AFK-autoreload] 已到 ' + hours + ' 小時，延後重新整理：' + why); } catch (e) {} } return; }
    var resume = null;
    if (inGame()) {
      try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
      resume = { slot: currentSlot, at: Date.now(), hours: hours, update: updDue() };
    }
    try { if (resume) sessionStorage.setItem(FLAG, JSON.stringify(resume)); } catch (e) {}
    location.reload();
  };
  var CHECK_MS = 60 * 1000;
  try { var cmr = localStorage.getItem('afk_autoreload_check_ms'); var cm = Number(cmr); if (cmr !== null && cm >= 1000 && cm < CHECK_MS) CHECK_MS = cm; } catch (e) {}   // 測試用：縮短檢查間隔
  setInterval(tick, CHECK_MS);

  // ── 重新整理後：自動回到同一格角色 ──
  var resumeRaw = null;
  try { resumeRaw = sessionStorage.getItem(FLAG); sessionStorage.removeItem(FLAG); } catch (e) {}
  var cover = null;
  var hideCover = function () { if (cover) { try { cover.remove(); } catch (e) {} cover = null; } };
  var showCover = function (upd) {
    try {
      cover = document.createElement('div'); cover.id = 'afk-reload-cover';
      cover.style.cssText = 'position:fixed;inset:0;z-index:2147483600;background:#05070b;color:#a39a8e;display:flex;align-items:center;justify-content:center;font:15px/1.6 system-ui,sans-serif;text-align:center;padding:16px';
      cover.textContent = upd ? '🔄 已更新到最新版本，正在回到你的角色…' : '🔄 正在清理記憶體，馬上回到你的角色…';
      (document.body || document.documentElement).appendChild(cover);
      setTimeout(hideCover, 20000);   // 保險：最多 20 秒
    } catch (e) {}
  };
  if (resumeRaw) {
    var info = null; try { info = JSON.parse(resumeRaw); } catch (e) {}
    if (info && info.slot && Date.now() - info.at < 10 * 60 * 1000) {
      if (document.body) showCover(info.update); else document.addEventListener('DOMContentLoaded', function () { if (!cover) showCover(info.update); });
      var tries = 0;
      var enter = function () {
        tries++;
        var ready = typeof loadGame === 'function' && typeof slotSummary === 'function' && document.readyState === 'complete';
        if (!ready) { if (tries < 60) setTimeout(enter, 500); else hideCover(); return; }
        try {
          if (!slotSummary(info.slot)) { hideCover(); return; }   // 該格已沒有角色（例如被刪除）→ 留在首頁
          currentSlot = info.slot;
          loadGame();
          setTimeout(hideCover, 600);
          setTimeout(function () {
            try { if (typeof logSys === 'function') logSys('<span class="text-slate-400">🔄 ' + (info.update ? '已更新到最新版本' : '已自動重新整理（每 ' + info.hours + ' 小時清理一次瀏覽器記憶體）') + '，並回到原本的角色繼續掛機。</span>'); } catch (e) {}
          }, 1500);
        } catch (e) { hideCover(); try { console.warn('[AFK-autoreload] 自動進入角色失敗：', e); } catch (e2) {} }
      };
      setTimeout(enter, 800);
    }
  }

  window.__afkAutoReload = {
    status: function () { var left = Math.max(0, DUE_MS - (Date.now() - startedAt)); return { 每幾小時: hours, 距離到期分鐘: Math.round(left / 60000), 目前不能重整的原因: whyUnsafe() || '（無）', 上次操作秒前: lastInput ? Math.round((Date.now() - lastInput) / 1000) : null, 閒置門檻秒: IDLE_MS / 1000 }; },
    setHours: function (h) { h = Number(h); if (!(h >= 1 && h <= 48)) return '請輸入 1～48'; try { localStorage.setItem('afk_autoreload_hours', String(h)); } catch (e) {} return '已設為每 ' + h + ' 小時（重新整理後生效）'; }
  };
  console.log('[AFK-autoreload] 已啟用：每 ' + hours + ' 小時在安全時機自動重新整理並回到原角色');
})();
