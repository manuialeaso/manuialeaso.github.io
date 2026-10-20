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
 *      ・正在看武器／防具／道具其中一頁 → 核心照常重建，但「逐列建立」只走訪該頁類型的物品
 *        （呼叫期間給背包陣列掛一個只走訪該類的 forEach，try/finally 移除；查數量／篩選等仍讀完整背包）
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
      var inv = player.inv;
      var only = INV_TABS[vis] ? vis : '';   // 背包三頁之一＝只建該類；裝備/技能頁＝背包三頁都不建
      for (var t in INV_TABS) dirty[t] = (t !== only);
      dirty.equip = dirty.skill = false;   // 裝備/技能兩頁每次都由核心一併重建（節點少、便宜）
      // ⚠️ 不替換 player.inv：快速強化表頭用 player.inv.find 查祝福卷數量（卷軸在道具類）、快速廢品用 filter——
      //    換成「只有該類」的陣列會讓它們讀到 0。改為只在這次呼叫期間，給真正的背包陣列掛一個自己的 forEach，
      //    只走訪該類物品（核心 renderTabs 內「逐列建立」是唯一的 player.inv.forEach）；find/filter/some/map/length 全是完整背包。
      var keep = function (i) { return !!only && tabOfItem(i) === only; };
      Object.defineProperty(inv, 'forEach', { configurable: true, enumerable: false, writable: true,
        value: function (fn, thisArg) { for (var k = 0; k < this.length; k++) { var it = this[k]; if (keep(it)) fn.call(thisArg, it, k, this); } } });
      inCall = true;
      try { return origTabs.call(this, force); }
      finally { delete inv.forEach; inCall = false; }
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

  // ──────────────────────────────────────────────────────────────────────
  // ③ 內容相同就不寫入（innerText / textContent）
  //    量測（8 人隊伍＠BOSS 房）：能力分頁每秒被重繪 40 次以上——核心 updateUI 每個 tick 把 50 多個
  //    欄位用 innerText 重寫，renderStatusEffects 每 tick 1~2 次重設 #dt-buffs 的 innerHTML，
  //    「值沒變」也照寫。對同值的 innerText/innerHTML 賦值，瀏覽器仍會丟掉舊節點、建新節點 → 排版＋重繪。
  //    這裡在 setter 前比對「畫面上現有內容」：完全相同才跳過（結果的 DOM 一模一樣，只是不重建）。
  //    保守條件：innerText/textContent 只在「目前恰好是一個文字節點且字串相同」時跳過（含換行的值不跳過）——
  //    此時元素內沒有任何子元素，不會有事件監聽或狀態被保留的副作用。
  // ──────────────────────────────────────────────────────────────────────
  if (on('perf-dom')) {
    var hookText = function (proto, prop) {
      var d = Object.getOwnPropertyDescriptor(proto, prop);
      if (!d || !d.set) return;
      Object.defineProperty(proto, prop, {
        configurable: true, enumerable: d.enumerable, get: d.get,
        set: function (v) {
          if (typeof v !== 'string' && typeof v !== 'number') return d.set.call(this, v);
          var s = String(v), fc = this.firstChild;
          if (s.indexOf('\n') < 0 && fc && fc === this.lastChild && fc.nodeType === 3 && fc.data === s) return;   // 同值：跳過
          return d.set.call(this, v);
        }
      });
    };
    hookText(HTMLElement.prototype, 'innerText');
    hookText(Node.prototype, 'textContent');
    // innerHTML 刻意不攔：「重寫 HTML 後再對新按鈕 addEventListener」的寫法，跳過重寫會讓舊按鈕被掛兩次監聽。
    //   實測 BOSS 房 innerHTML 同值跳過每秒僅約 1 次（效益可忽略），#dt-buffs 另以下方暫存比對處理。
  }

  // ③-b 狀態欄 #dt-buffs：核心每 tick 用 innerHTML 重寫，之後 afk-trackinfo 再往裡面補幾格（所以畫面內容
  //     永遠不等於核心寫入的字串，上面的同值判斷攔不到）。改為：整條包裝鏈（核心＋trackinfo＋battlebuffs）
  //     先畫到一個隱藏的暫存節點，跟畫面上的比對，有差才把內容換上去。必須在所有外掛都包好之後才裝
  //     （window load 之後），本層才會是最外層。
  if (on('perf-dom')) {
    var installBuffStage = function () {
      var orig = window.renderStatusEffects;
      if (typeof orig !== 'function' || orig.__afkPerfStage) return;
      var staged = function () {
        var real = document.getElementById('dt-buffs');
        if ((typeof state !== 'undefined' && state.ff) || !real || !real.parentNode) return orig.apply(this, arguments);
        var stage = real.cloneNode(false), r;
        stage.style.display = 'none';
        real.id = 'dt-buffs__live';
        real.parentNode.insertBefore(stage, real);
        try { r = orig.apply(this, arguments); }
        finally {
          stage.remove(); real.id = 'dt-buffs';
          if (stage.innerHTML !== real.innerHTML) { var frag = document.createDocumentFragment(); while (stage.firstChild) frag.appendChild(stage.firstChild); real.replaceChildren(frag); }
        }
        return r;
      };
      staged.__afkPerfStage = true;
      window.renderStatusEffects = staged;
    };
    if (document.readyState === 'complete') setTimeout(installBuffStage, 0);
    else window.addEventListener('load', function () { setTimeout(installBuffStage, 0); });
  }

  // ──────────────────────────────────────────────────────────────────────
  // ④ 動畫圖片快取改以「記憶體大小」設上限（長時間掛機記憶體爆炸的主因）
  //    量測（8 人隊伍，每 20 秒換一張地圖、20 分鐘）：算圖行程 730→1,578MB。JS 只有 30～100MB 且持平，
  //    增加的全是動畫圖片：怪物動畫快取核心以「種類數」設限（48 種＋八方向 96 組），不管每組多大——
  //    大型頭目一組就數十 MB，實測快取內圖片解碼後估計達 860MB＋282MB；職業／變身快取完全沒有上限。
  //    做法：每 10 秒估算各快取項目的解碼大小（寬×高×4）；畫面上正在顯示的（含同一隻怪／寵物／隊員的
  //    其他朝向）一律保護；其餘依「最近使用時間」由舊到新淘汰，直到總量 ≤ 預算。被淘汰的項目再出現時，
  //    核心會照原本流程重新載入（讀瀏覽器快取，看到的只是第一次出現時那半秒靜態圖）。
  // ──────────────────────────────────────────────────────────────────────
  if (on('perf-mem')) {
    var BUDGET = 192 * 1048576;   // 不在畫面上的動畫圖片，最多保留這麼多（解碼後估計）
    var GET = {
      mob: function () { return typeof _mobAnimCache !== 'undefined' ? _mobAnimCache : null; },
      mob8: function () { return typeof _mob8Cache !== 'undefined' ? _mob8Cache : null; },
      morph: function () { return typeof _morphBattleCache !== 'undefined' ? _morphBattleCache : null; },
      pet8: function () { return typeof _pet8Cache !== 'undefined' ? _pet8Cache : null; },
      spell: function () { return typeof _spellFxCache !== 'undefined' ? _spellFxCache : null; },
      death: function () { return typeof _deathFxCache !== 'undefined' ? _deathFxCache : null; }
    };
    var sizeMemo = new WeakMap(), lastUsed = new Map(), memStats = { evicted: 0, evictedMB: 0, keptMB: 0, protectedMB: 0, runs: 0 };
    var imagesOf = function (v, out, depth) {
      if (!v || depth > 6) return out;
      if (v instanceof HTMLImageElement) { out.push(v); return out; }
      if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) imagesOf(v[i], out, depth + 1); return out; }
      if (typeof v === 'object') for (var k in v) imagesOf(v[k], out, depth + 1);
      return out;
    };
    var bytesOf = function (v, imgs) {
      if (sizeMemo.has(v)) return sizeMemo.get(v);
      var b = 0; for (var i = 0; i < imgs.length; i++) b += (imgs[i].naturalWidth || 0) * (imgs[i].naturalHeight || 0) * 4;
      var allDone = imgs.every(function (im) { return im.complete; });
      if (allDone) sizeMemo.set(v, b);   // 還在載入的下一輪再算
      return b;
    };
    var groupOf = function (key) { var s = String(key), i = s.lastIndexOf('#'); return i > 0 ? s.slice(0, i) : s; };
    var trimMem = function () {
      try {
        if (typeof state !== 'undefined' && state.ff) return;
        var now = Date.now(), srcs = new Set();
        for (var i = 0; i < document.images.length; i++) srcs.add(document.images[i].src);
        var entries = [], used = new Set();
        for (var cn in GET) {
          var c = GET[cn](); if (!c) continue;
          for (var key in c) {
            var v = c[key]; if (!v || v === 'probing' || typeof v !== 'object') continue;
            var imgs = imagesOf(v, [], 0); if (!imgs.length) continue;
            var id = cn + '|' + key;
            if (!lastUsed.has(id)) lastUsed.set(id, now);
            for (var j = 0; j < imgs.length; j++) if (srcs.has(imgs[j].src)) { used.add(cn + '|' + groupOf(key)); break; }
            entries.push({ cn: cn, key: key, id: id, c: c, bytes: bytesOf(v, imgs) });
          }
        }
        var total = 0, prot = 0, free = [];
        for (var e = 0; e < entries.length; e++) {
          var en = entries[e];
          if (used.has(en.cn + '|' + groupOf(en.key))) { lastUsed.set(en.id, now); prot += en.bytes; }
          else { total += en.bytes; free.push(en); }
        }
        if (total > BUDGET) {
          free.sort(function (a, b) { return lastUsed.get(a.id) - lastUsed.get(b.id); });
          for (var f = 0; f < free.length && total > BUDGET; f++) {
            var x = free[f];
            if (x.c[x.key] === undefined || x.c[x.key] === 'probing') continue;
            delete x.c[x.key]; lastUsed.delete(x.id);
            total -= x.bytes; memStats.evicted++; memStats.evictedMB += x.bytes / 1048576;
          }
        }
        memStats.keptMB = Math.round(total / 1048576); memStats.protectedMB = Math.round(prot / 1048576); memStats.runs++;
        if (lastUsed.size > 4000) lastUsed.forEach(function (t, k) { if (now - t > 3600000) lastUsed.delete(k); });
      } catch (e) {}
    };
    setInterval(trimMem, 10000);
    window.__afkPerfMem = function () { return { 預算MB: BUDGET / 1048576, 畫面中MB: memStats.protectedMB, 保留MB: memStats.keptMB, 已淘汰組數: memStats.evicted, 已淘汰MB: Math.round(memStats.evictedMB) }; };
  }

  console.log('[AFK-perf] 已啟用：' + [on('perf-log') ? '日誌批次寫入' : '', on('perf-tabs') ? '背包分頁按需重建' : '', on('perf-dom') ? '同值不重寫' : '', on('perf-mem') ? '動畫快取記憶體上限' : ''].filter(Boolean).join('、'));
})();
