// Frozen original logging section from afk-perf.js. Test fixture only.
// Full source SHA256: 553e7900b3ef3d745184fe233319f30e81eab4abbe7360e281181de40206f1e2
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
      // ⑦ perf-render：前景改成每 0.2 秒寫一次（原本每一幀）→ 日誌區的排版／重繪次數少約 12 倍，看起來一樣即時
      if (document.hidden) setTimeout(flushAll, 250);
      else if (on('perf-render')) setTimeout(function () { requestAnimationFrame(flushAll); }, 200);
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

})();
