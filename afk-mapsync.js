/* ============================================================================
 * afk-mapsync.js — 地圖下拉選單自我校正（不改任何回城/出發規則）
 *
 * 問題（玩家回報，2026-10-20）：回城／出發後，「地區」下拉偶爾顯示成清單第一項（銀騎士村），
 *   「地圖」下拉也停在該地區的第一項，與實際所在地圖不符。實測抓到的狀態：
 *     目前地圖 town_talking、所屬地區 talkingisland，但左選單 = silverknight（第一個選項）。
 *   核心 setMapSelectors 在重建選項後會立刻設回正確值；在測試瀏覽器以真實按鈕隨機操作 60 步、
 *   含重新整理，皆重現不出來 → 推測與玩家瀏覽器環境有關（如重新整理／分頁休眠喚醒時的表單狀態還原）。
 *
 * 作法（不論成因都有效）：
 *   ・每秒比對一次：兩個下拉的值 ≠ 目前地圖（mapState.current 與其所屬地區）→ 呼叫核心 syncMapSelectors() 校正。
 *   ・玩家正在操作下拉（取得焦點）時不動；下拉被核心刻意隱藏的模式（傲慢之塔攀登、遺忘之島、
 *     時空裂痕、隱藏狩獵區、安塔瑞斯巢穴）不動；補跑期間不動。
 *   ・「回城／出發／載入角色」之後各補一次即時校正（不用等一秒）。
 *   ・診斷：記下最近 8 次「左選單被改值／選項被重建」的時間與呼叫來源；真的校正時印在主控台
 *     （console.warn [AFK-mapsync]），之後要追根究柢可直接看。
 * 成本：每秒讀兩個 select 的 value＋一次 mapRegionOf 查表，不寫 DOM（不一致時才寫）。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('mapsync')) return;
  if (typeof window.syncMapSelectors !== 'function' || typeof window.mapRegionOf !== 'function') return;

  var trail = [];
  var note = function (what) {
    var st = '';
    try { st = (new Error().stack || '').split('\n').slice(2, 6).map(function (s) { return s.trim(); }).join(' ← '); } catch (e) {}
    trail.push(new Date().toLocaleTimeString() + ' ' + what + '  ' + st);
    if (trail.length > 8) trail.shift();
  };

  // 診斷：攔左選單的 value / selectedIndex 寫入與選項重建（只記錄，不改行為）
  var hookCat = function () {
    var c = document.getElementById('map-category');
    if (!c || c.__afkMapsync) return;
    c.__afkMapsync = true;
    try {
      var dv = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
      Object.defineProperty(c, 'value', { configurable: true, get: function () { return dv.get.call(this); }, set: function (v) { dv.set.call(this, v); note('左選單.value=' + v); } });
      var di = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
      Object.defineProperty(c, 'selectedIndex', { configurable: true, get: function () { return di.get.call(this); }, set: function (v) { di.set.call(this, v); note('左選單.selectedIndex=' + v); } });
      new MutationObserver(function () { trail.push(new Date().toLocaleTimeString() + ' 左選單選項被重建（' + c.options.length + ' 項，目前=' + c.value + '）'); if (trail.length > 8) trail.shift(); }).observe(c, { childList: true });
    } catch (e) {}
  };

  var hiddenMode = function () {
    var c = document.getElementById('map-category'), s = document.getElementById('map-select');
    return !c || !s || c.classList.contains('hidden') || s.classList.contains('hidden');
  };
  var check = function (reason) {
    try {
      if (typeof player === 'undefined' || !player || !player.cls || typeof mapState === 'undefined' || !mapState.current) return;
      if (typeof state !== 'undefined' && state.ff) return;
      if (typeof catchupActive === 'function' && catchupActive()) return;
      var gs = document.getElementById('game-screen'); if (!gs || gs.classList.contains('hidden')) return;
      if (hiddenMode()) return;
      var c = document.getElementById('map-category'), s = document.getElementById('map-select');
      var a = document.activeElement; if (a === c || a === s) return;   // 玩家正在選，不打擾
      var cur = mapState.current, exp = mapRegionOf(cur);
      if (!exp) return;   // 不在任何地區的特殊圖：交給核心既有的顯示邏輯
      if (c.value === exp && s.value === cur) return;
      console.warn('[AFK-mapsync] 下拉與所在地不一致，已校正（' + reason + '）：左=' + c.value + ' 右=' + s.value + ' → 地區=' + exp + ' 地圖=' + cur + '\n最近的選單變動：\n' + trail.join('\n'));
      syncMapSelectors();
    } catch (e) {}
  };

  hookCat();
  setInterval(function () { hookCat(); check('定期檢查'); }, 1000);
  ['returnToTown', 'departToLastBattle', 'loadGame'].forEach(function (fn) {
    var orig = window[fn];
    if (typeof orig !== 'function') return;
    window[fn] = function () {
      var r = orig.apply(this, arguments);
      setTimeout(function () { check(fn + ' 之後'); }, 0);
      setTimeout(function () { check(fn + ' 之後 0.5 秒'); }, 500);
      return r;
    };
  });
  window.__afkMapsyncTrail = function () { return trail.slice(); };
  console.log('[AFK-mapsync] 地圖下拉自我校正已啟用');
})();
