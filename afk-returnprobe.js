/* ==========================================================================
 * afk-returnprobe.js — 回城卡頓偵測（玩家 2026-10-23 回報：戰鬥 5 分鐘以上回城會卡 1～2 秒）
 *
 * 只在「回城／返回據點」那一下啟動，量 3 秒就停：
 *   ‧畫面最長停頓（requestAnimationFrame 間隔）與長任務
 *   ‧這 3 秒內主要函式各花多少 JS 時間
 *   ‧記憶體（JS heap）與畫面元件數，前後對比 → 看是不是記憶體釋放（GC）
 * 停頓超過 300ms 才在系統訊息印一行，最近 5 筆存在本機（window.__afkReturnProbe.list()）。
 * 平常不做任何事，不影響效能。
 * ========================================================================== */
(function () {
  'use strict';
  var KEY = 'afk_return_probe_v1';
  var NAMES = ['changeMap', 'calcStats', 'recomputeStats', 'updateUI', '_updateUIImpl', 'renderTabs', 'renderTownNPCs', 'renderTownNPCMap',
    'saveGame', '_dpsReset', 'renderAuditTab', 'applyAreaBackground', 'setMapSelectors', 'clanScanRoles', '_clanReadState', 'tick',
    'renderMobs', '_allySpritesApply', '_playerMorphApply', 'petRosterSave', 'logSys', 'renderInventory', 'renderBattleField', 'flushTickRender'];
  var running = false;
  var heap = function () { try { return performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null; } catch (e) { return null; } };
  var load = function () { try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; } };
  var keep = function (r) { try { var a = load(); a.unshift(r); localStorage.setItem(KEY, JSON.stringify(a.slice(0, 5))); } catch (e) {} };
  function probe(label, fn, self, args) {
    if (running) return fn.apply(self, args);
    running = true;
    var t0 = performance.now(), h0 = heap(), d0 = document.getElementsByTagName('*').length, img0 = document.images.length;
    var times = {}, restore = [], gaps = [], longs = [], last = t0, stop = false, po = null;
    NAMES.forEach(function (n) {
      var o = window[n]; if (typeof o !== 'function') return;
      var w = function () { var s = performance.now(); try { return o.apply(this, arguments); } finally { var x = times[n] || (times[n] = [0, 0]); x[0]++; x[1] += performance.now() - s; } };
      window[n] = w; restore.push([n, o, w]);
    });
    try { po = new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { longs.push(Math.round(e.duration)); }); }); po.observe({ entryTypes: ['longtask'] }); } catch (e) { po = null; }
    var raf = function () { var n = performance.now(); gaps.push(n - last); last = n; if (!stop) requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    var r, js0 = performance.now();
    try { r = fn.apply(self, args); }
    finally {
      var js = performance.now() - js0;
      setTimeout(function () {
        stop = true; if (po) try { po.disconnect(); } catch (e) {}
        restore.forEach(function (x) { if (window[x[0]] === x[2]) window[x[0]] = x[1]; });   // 期間別人又包過就不動
        running = false;
        var maxGap = gaps.length ? Math.round(Math.max.apply(null, gaps)) : 0, h1 = heap();
        var top = Object.keys(times).map(function (k) { return [k, times[k][0], Math.round(times[k][1])]; }).filter(function (x) { return x[2] >= 5; }).sort(function (a, b) { return b[2] - a[2]; }).slice(0, 8);
        var res = { at: new Date().toISOString(), label: label, map: (typeof mapState !== 'undefined' && mapState.current) || '', js: Math.round(js), maxGap: maxGap,
          longs: longs.slice(0, 8), heap: [h0, h1], dom: [d0, document.getElementsByTagName('*').length], img: [img0, document.images.length], top: top,
          allies: (typeof player !== 'undefined' && player && player.allies || []).length, hidden: document.hidden };
        keep(res); window.__afkReturnProbe.last = res;
        if (maxGap >= 300 || res.js >= 300 || longs.some(function (x) { return x >= 300; })) {
          try {
            logSys('<span class="text-amber-300">⏱ 回城卡頓偵測：畫面最長停頓 ' + maxGap + 'ms、指令本身 ' + res.js + 'ms'
              + (longs.length ? '、長任務 ' + longs.join('/') + 'ms' : '')
              + '、記憶體 ' + h0 + '→' + h1 + 'MB、畫面元件 ' + d0 + '→' + res.dom[1]
              + (top.length ? '；耗時：' + top.map(function (x) { return x[0] + ' ' + x[2] + 'ms×' + x[1]; }).join('、') : '') + '</span>');
          } catch (e) {}
        }
      }, 3000);
    }
    return r;
  }
  ['returnToTown', 'returnToPledgeBase'].forEach(function (n) {
    var o = window[n]; if (typeof o !== 'function') return;
    window[n] = function () { return probe(n, o, this, arguments); };
  });
  window.__afkReturnProbe = { list: load, last: null, text: function () { return JSON.stringify(load()); } };
  console.log('[AFK-returnprobe] 已啟用：回城卡頓偵測');
})();
