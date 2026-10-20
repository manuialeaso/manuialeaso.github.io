/* ============================================================================
 * afk-perf.js — 卡頓修正（量測驅動；核心不動，全部以覆寫全域函式完成）
 *
 * 基準量測（8 人隊伍＠底比斯歐西里斯祭壇，背包 2,662 件，2 分鐘 ×3 輪中位數）：
 *   CPU 91%、FPS 37、長任務 118 次／合計凍結 19 秒。CPU profile 前兩名可修的熱點：
 *
 * ① perf-log 日誌批次寫入（logCombat 單一函式佔全部 CPU 取樣 19%）
 *    核心每則訊息都做：insertAdjacentHTML → 裁剪 → scrollTop = scrollHeight（＝強制同步排版）。
 *    8 人打雙王每秒數十則 → 每秒數十次強制排版。改為：呼叫當下就把 HTML 組好（來源/顏色/過濾分類
 *    跟原版完全一樣，_combatSrc 等情境在呼叫時就取值），放進佇列；每一幀合併成「一次插入＋一次裁剪
 *    ＋一次捲動」。佇列長度以該日誌的保留上限封頂（背景分頁 rAF 不跑時也不會無限長）。
 *    戰鬥／系統／世界頻道三個日誌都適用。系統日誌的「稀有掉落未讀點」仍在呼叫當下立即處理。
 *
 * ② perf-tabs 背包分頁只建看得到的那一頁
 *    核心 renderTabs 每次背包有變動（撿物、扣箭、賣物…）就把 裝備／武器／防具／道具／技能 五頁全部
 *    砍掉重建；大背包＝每次 2.6 萬個 DOM 節點，其中八成在看不到的分頁裡。改為：
 *      ・五頁都沒在顯示 → 不重建，記下「待更新」
 *      ・正在看武器／防具／道具其中一頁 → 只把「該頁類型的物品」交給核心重建（呼叫期間暫時把
 *        player.inv 換成過濾後的陣列，try/finally 保證還原；物品物件是同一批參照，點擊/雙擊照舊）
 *      ・正在看裝備／技能頁 → 照常重建這兩頁，背包三頁標記待更新
 *    切換到被標記的分頁時（switchTab）立刻強制重建，畫面跟原版一致。
 *
 * 安全閥：兩項各自可在外掛面板關掉（父項 perf 關掉＝兩項都退回原版行為）。
 * 載入順序：必須在 afk-toast（包 logSys）與 afk-itemsearch（包 renderTabs）之前，
 *          讓它們包住的是本檔的版本、行為疊加不打架。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('perf')) return;
  var on = function (id) { return !T || T.enabled(id); };

  // ──────────────────────────────────────────────────────────────────────
  // ① 日誌批次寫入
  // ──────────────────────────────────────────────────────────────────────
  if (on('perf-log') && typeof window.logCombat === 'function' && typeof window.logSys === 'function') {
    var queues = {};          // elementId → { html: [], locked: fn, max: fn }
    var scheduled = false;

    var flushOne = function (id) {
      var q = queues[id];
      if (!q || !q.html.length) return;
      var el = document.getElementById(id);
      var batch = q.html; q.html = [];
      if (!el) return;
      var max = q.max();
      if (batch.length > max) batch = batch.slice(batch.length - max);   // 一幀內超過上限：只插最後 max 則（舊的插了也會馬上被裁）
      el.insertAdjacentHTML('beforeend', batch.join(''));
      var extra = el.children.length - max;
      while (extra-- > 0 && el.children.length > 1) el.removeChild(el.firstChild);
      if (!q.locked()) el.scrollTop = el.scrollHeight;                     // 整批只排版一次
    };
    var flushAll = function () {
      scheduled = false;
      for (var id in queues) { try { flushOne(id); } catch (e) {} }
    };
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      // 前景：下一幀寫入。背景分頁 rAF 會停 → 退回 timer（瀏覽器會節流到約每秒一次，佇列有上限不怕堆）
      if (document.hidden) setTimeout(flushAll, 250);
      else requestAnimationFrame(flushAll);
    };
    var enqueue = function (id, html, locked, max) {
      var q = queues[id] || (queues[id] = { html: [], locked: locked, max: max });
      q.html.push(html);
      var cap = max();
      if (q.html.length > cap) q.html.splice(0, q.html.length - cap);
      schedule();
    };
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !scheduled) { scheduled = true; requestAnimationFrame(flushAll); } });

    // 與核心 js/01 logCombat 同一套分類（顏色 class／左色條／來源），只改「寫入 DOM 的時機」
    var COLOR = {
      'player': ['text-blue-300', 'log-cat-attack'], 'player-heavy': ['text-yellow-300 font-bold', 'log-cat-attack'],
      'player-crit': ['crit-hit', 'log-cat-attack'], 'player-special': ['text-orange-300', 'log-cat-attack'],
      'player-graze': ['text-blue-200/80', 'log-cat-attack'], 'skill': ['text-purple-300', 'log-cat-skill'],
      'enemy': ['text-red-400', 'log-cat-enemy'], 'dot': ['text-green-300', 'log-cat-dot'],
      'magic': ['text-cyan-300', ''], 'heal': ['text-green-300', ''], 'miss': ['text-slate-200', ''],
      'dodge': ['text-slate-200', ''], 'evade': ['text-teal-300', '']
    };
    var combatLocked = function () { return typeof _combatLogLocked !== 'undefined' && _combatLogLocked; };
    var combatMax = function () { return combatLocked() ? COMBAT_LOG_MAX_LOCKED : COMBAT_LOG_MAX; };
    var sysLocked = function () { return typeof _sysLogLocked !== 'undefined' && _sysLogLocked; };
    var sysMax = function () { return sysLocked() ? SYS_LOG_MAX_LOCKED : SYS_LOG_MAX; };
    var worldLocked = function () { return typeof _worldLogLocked !== 'undefined' && _worldLogLocked; };
    var worldMax = function () { return worldLocked() ? WORLD_LOG_MAX_LOCKED : WORLD_LOG_MAX; };

    var perfLogCombat = function (msg, type, src) {
      if (type === undefined) type = 'player';
      if (state.ff) return;   // 補跑期間不洗版（同核心）
      var c = COLOR[type] || ['text-white', ''];
      var _src = src || (typeof _combatSrc !== 'undefined' && _combatSrc) || (type === 'enemy' ? 'enemy' : 'player');
      enqueue('combat-log', '<div class="log-entry ' + c[0] + ' ' + c[1] + '" data-src="' + _src + '">' + msg + '</div>', combatLocked, combatMax);
    };
    var perfLogSys = function (msg, rare) {
      if (state.ff) return;
      if (!document.getElementById('sys-log')) return;
      enqueue('sys-log', '<div class="log-entry text-slate-100">' + msg + '</div>', sysLocked, sysMax);
      if (typeof _logTab !== 'undefined' && _logTab !== 'sys' && (rare === 'legend' || rare === 'relic')) {   // 未讀點：立即處理（同核心）
        var d = document.getElementById('logtab-dot-sys');
        if (d) { d.classList.remove('hidden', 'logtab-dot-legend', 'logtab-dot-relic'); d.classList.add('logtab-dot-' + rare); }
      }
    };
    var perfLogWorld = function (msg, cls) {
      if (state.ff) return;
      if (!document.getElementById('world-log')) return;
      enqueue('world-log', '<div class="log-entry ' + (cls || '') + '">' + msg + '</div>', worldLocked, worldMax);
    };
    perfLogCombat.__afkPerf = perfLogSys.__afkPerf = perfLogWorld.__afkPerf = true;
    window.logCombat = perfLogCombat;
    window.logSys = perfLogSys;
    if (typeof window.logWorld === 'function') window.logWorld = perfLogWorld;
    // 供除錯/測試：立刻把佇列寫進 DOM
    window.__afkPerfFlushLogs = flushAll;
  }

  // ──────────────────────────────────────────────────────────────────────
  // ② 背包分頁只建看得到的那一頁
  // ──────────────────────────────────────────────────────────────────────
  if (on('perf-tabs') && typeof window.renderTabs === 'function' && typeof window.switchTab === 'function') {
    var INV_TABS = { weapons: 1, armors: 1, items: 1 };
    var ALL_TABS = ['equip', 'weapons', 'armors', 'items', 'skill'];
    var dirty = { equip: false, weapons: false, armors: false, items: false, skill: false };
    var origTabs = window.renderTabs;
    var inCall = false;

    var visibleTab = function () {
      for (var k = 0; k < ALL_TABS.length; k++) {
        var el = document.getElementById('tab-' + ALL_TABS[k]);
        if (el && !el.classList.contains('hidden')) return ALL_TABS[k];
      }
      return null;
    };
    var tabOfItem = function (i) {   // 與核心 renderTabs 的分流規則一致：wpn→武器；arm/acc→防具；其餘→道具
      var d = DB.items[i.id];
      if (!d) return null;
      if (d.type === 'wpn') return 'weapons';
      if (d.type === 'arm' || d.type === 'acc') return 'armors';
      return 'items';
    };

    var perfRenderTabs = function (force) {
      // 重入（核心內部再呼叫）或補跑期間：交給原版處理
      if (inCall || state.ff || (typeof catchupActive === 'function' && catchupActive())) return origTabs.apply(this, arguments);
      var vis = visibleTab();
      if (!vis) {   // 五頁都沒在顯示：全部記為待更新，不重建
        for (var k in dirty) dirty[k] = true;
        return;
      }
      var fullInv = player.inv;
      var only = INV_TABS[vis] ? vis : '';   // 背包三頁之一＝只建該類；裝備/技能頁＝背包三頁都不建
      var sub = fullInv.filter(function (i) { return only && tabOfItem(i) === only; });
      for (var t in INV_TABS) dirty[t] = (t !== only);
      dirty.equip = dirty.skill = false;   // 裝備/技能兩頁每次都由核心一併重建（節點少、便宜）
      inCall = true;
      player.inv = sub;
      try { return origTabs.call(this, force); }
      finally { player.inv = fullInv; inCall = false; }
    };
    perfRenderTabs.__afkPerf = true;
    window.renderTabs = perfRenderTabs;

    var origSwitch = window.switchTab;
    window.switchTab = function (t, btn) {
      var r = origSwitch.apply(this, arguments);
      try { if (dirty[t]) { dirty[t] = false; window.renderTabs(true); } } catch (e) {}   // 走 window.renderTabs＝外層外掛（搜尋過濾）一起套用
      return r;
    };
    window.__afkPerfTabsDirty = function () { return Object.assign({}, dirty); };
  }

  console.log('[AFK-perf] 已啟用：' + [on('perf-log') ? '日誌批次寫入' : '', on('perf-tabs') ? '背包分頁按需重建' : ''].filter(Boolean).join('、'));
})();
