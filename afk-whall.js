/* ============================================================================
 * afk-whall.js — 倉庫：一鍵存入（目前分類）／一鍵取出（目前分類）（玩家 2026-10-21 指定）
 *
 * 原本的「一鍵存入」只會存「倉庫裡已經有完全相同（名字＋強化值＋詞綴）」的物品，倉庫是空的或物品詞綴不同時
 * 按了什麼都不會發生——看起來就像壞掉。這裡改成：
 *   ‧一鍵存入：把「目前分類／搜尋」下背包看得到的物品全部存入（鎖定、不可存入的除外）
 *   ‧一鍵取出：把「目前分類／搜尋」下倉庫看得到的物品全部取出
 *   ‧原本的規則保留為「存入相同物品」按鈕
 * 全部走核心的交易保護（whTxnSnapshot → 搬移 → whTxnCommit 一次），合併規則與核心 whDeposit/whWithdraw 相同。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('warehouse')) return;
  var need = ['loadWarehouse', 'whTxnSnapshot', 'whTxnCommit', 'renderWarehouseNPC', 'whMatchFilter', 'whMatchSearch', '_whSearchActive', 'whOneClickDeposit'];
  for (var i = 0; i < need.length; i++) if (typeof window[need[i]] !== 'function') { console.warn('[AFK-whall] 缺少 ' + need[i] + '，略過'); return; }

  var inTown = function () { return typeof mapState !== 'undefined' && mapState.current && String(mapState.current).indexOf('town_') === 0; };
  var shown = function (it) { return _whSearchActive() ? whMatchSearch(it) : whMatchFilter(it.id); };
  var clearJunk = function (it) { if (typeof _whClearJunkState === 'function') return _whClearJunkState(it); delete it.junk; delete it.junkSince; return it; };
  var absorb = function (stack, src, n) { stack.cnt = (stack.cnt || 1) + n; if (src && src.lock) { stack.lock = true; stack.junk = false; } };
  var index = function (arr) { var m = new Map(); arr.forEach(function (x) { if (x && !x.gw) { var k = itemSig(x); if (!m.has(k)) m.set(k, x); } }); return m; };
  var redraw = function () {
    try { renderTabs(true); updateUI(); } catch (e) {}
    try { renderWarehouseNPC(document.getElementById('interaction-content')); } catch (e) {}
  };

  window.whDepositShown = function () {
    if (!inTown()) { logSys('<span class="text-red-400">離開安全區後無法使用倉庫。</span>'); return; }
    var w = loadWarehouse(), snap = whTxnSnapshot(), cap = (typeof WH_MAX !== 'undefined') ? WH_MAX : 5000;
    var noStore = (typeof WH_NO_STORE !== 'undefined') ? WH_NO_STORE : [];
    var list = player.inv.filter(function (it) { return it && !it.lock && noStore.indexOf(it.id) < 0 && shown(it); });
    if (!list.length) { logSys('目前分類的背包沒有可存入的物品。'); return; }
    var idx = index(w.items), moved = 0, full = false, gone = new Set();
    list.forEach(function (it) {
      if (full) return;
      var stack = it.gw ? null : idx.get(itemSig(it));
      if (!stack && w.items.length >= cap) { full = true; return; }
      gone.add(it.uid);
      var n = it.cnt || 1;
      if (stack) absorb(stack, it, n);
      else { clearJunk(it); w.items.push(it); if (!it.gw) idx.set(itemSig(it), it); }
      moved++;
    });
    player.inv = player.inv.filter(function (it) { return !gone.has(it.uid); });
    if (!whTxnCommit(w, snap)) { redraw(); return; }
    redraw();
    logSys('<span class="text-cyan-300 font-bold">一鍵存入：已存入 ' + moved + ' 項物品' + (full ? '（倉庫已滿，部分未存入）' : '') + '。</span>');
  };

  window.whWithdrawShown = function () {
    if (!inTown()) { logSys('<span class="text-red-400">離開安全區後無法使用倉庫。</span>'); return; }
    var w = loadWarehouse(), snap = whTxnSnapshot();
    var list = w.items.filter(function (it) { return it && shown(it); });
    if (!list.length) { logSys('目前分類的倉庫沒有物品。'); return; }
    var idx = index(player.inv), uids = new Set(player.inv.map(function (x) { return x.uid; })), gone = new Set(), ids = [];
    list.forEach(function (it) {
      gone.add(it);
      if (!it.uid || uids.has(it.uid)) it.uid = uid();
      uids.add(it.uid);
      clearJunk(it);
      var stack = it.gw ? null : idx.get(itemSig(it));
      if (stack) absorb(stack, it, it.cnt || 1);
      else { player.inv.push(it); if (!it.gw) idx.set(itemSig(it), it); }
      ids.push(it.id);
    });
    w.items = w.items.filter(function (it) { return !gone.has(it); });
    if (!whTxnCommit(w, snap)) { redraw(); return; }
    var seen = {};
    ids.forEach(function (id) {
      if (seen[id]) return; seen[id] = 1;
      try { if (typeof registerEquipObtained === 'function') registerEquipObtained(id); if (typeof registerMiscObtained === 'function') registerMiscObtained(id); if (typeof registerRelicObtained === 'function') registerRelicObtained(id); } catch (e) {}
    });
    redraw();
    logSys('<span class="text-amber-300 font-bold">一鍵取出：已取出 ' + list.length + ' 項物品。</span>');
  };

  // 畫面：原本的「一鍵存入」改名「存入相同物品」，旁邊加兩顆新按鈕
  var oRender = window.renderWarehouseNPC;
  window.renderWarehouseNPC = function () {
    var r = oRender.apply(this, arguments);
    try {
      var root = document.getElementById('warehouse-window-content') || document.getElementById('interaction-content');
      var old = root && Array.prototype.find.call(root.querySelectorAll('button'), function (b) { return (b.getAttribute('onclick') || '').indexOf('whOneClickDeposit') === 0; });
      if (old && !root.querySelector('#afk-wh-in')) {
        old.textContent = '存入相同物品';
        var mk = function (id, txt, fn, bg, col, bd, tip) {
          var b = document.createElement('button'); b.id = id; b.type = 'button'; b.textContent = txt; b.title = tip;
          b.className = 'btn px-4 text-sm font-bold h-8 inline-flex items-center justify-center';
          b.style.cssText = 'background:' + bg + ';color:' + col + ';border-color:' + bd;
          b.addEventListener('click', fn); return b;
        };
        var bIn = mk('afk-wh-in', '一鍵存入', function () { window.whDepositShown(); }, 'linear-gradient(135deg,#0c4a5e,#0e7490)', '#a5f3fc', '#0891b2', '把目前分類（或搜尋結果）下背包裡的物品全部存入；鎖定物品不會存入');
        var bOut = mk('afk-wh-out', '一鍵取出', function () { window.whWithdrawShown(); }, 'linear-gradient(135deg,#6b2a10,#b3490e)', '#fed7aa', '#ea580c', '把目前分類（或搜尋結果）下倉庫裡的物品全部取出');
        old.parentNode.insertBefore(bIn, old); old.parentNode.insertBefore(bOut, old);
        old.classList.remove('ms-auto'); bIn.classList.add('ms-auto');
      }
    } catch (e) {}
    return r;
  };
  console.log('[AFK-whall] 已啟用：倉庫一鍵存入／一鍵取出（目前分類）');
})();
