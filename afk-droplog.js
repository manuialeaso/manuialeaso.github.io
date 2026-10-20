/* ============================================================================
 * afk-droplog.js — 補跑期間的擊殺／掉落記錄與背包同步（只改顯示）
 *
 * 問題（原作者核心 js/03 gameLoop 的規則，原版與 pp771007 外掛版都一樣）：
 *   主迴圈每 100ms 跑一次；畫面卡住 ≥0.2 秒、或分頁在背景，就改走「補跑」追回進度。
 *   補跑期間 state.ff = true，核心的 logCombat / logSys 一律不寫。結果：
 *     ‧不到 3 秒的補跑：什麼都不印 → 掉落進了背包，記錄裡卻沒有
 *     ‧3 秒以上的補跑：只印一行「掛機期間獲得」，而且是「補跑前後背包相減」，
 *       中途被自動賣掉／用掉的、或疊在同一格的，彙整裡會少算或不見
 *
 * 做法（不改核心、不碰掉落機率與背包內容）：
 *   補跑中（前景或背景）每次 killMob 結算時，把「這次擊殺本來要寫的每一則日誌」原樣攔下暫存
 *   （擊敗了…／…給你…／攜帶物掉落／遺物／卡片登錄／席琳結晶…全部，用核心自己產生的文字），
 *   並以核心的掉落統計掛點 auditTrackGain 逐筆累計「真正進背包的東西」。
 *   補跑結束時：
 *     ‧逐筆補印暫存的日誌（行首 ⏩ 表示是補跑期間發生的），短補跑全部補印；
 *       長補跑只補印最近 15 隻（日誌本身也只留 50～150 行），更早的併入彙整
 *     ‧長補跑：核心那行「掛機期間獲得」（背包相減）換成逐筆累計的準確彙整
 *   暫存有上限（最近 150 隻），背景掛幾小時也不會一直長。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('droplog')) return;
  if (typeof window.killMob !== 'function' || typeof window._ffFinishCatchup !== 'function' ||
      typeof window.logSys !== 'function' || typeof window.logCombat !== 'function' || typeof window.auditTrackGain !== 'function') {
    try { console.warn('[AFK-droplog] 找不到核心函式，未啟用'); } catch (e) {}
    return;
  }

  var KEEP = 150;          // 暫存最近幾隻的完整日誌
  var REPLAY_LONG = 15;    // 長補跑時補印最近幾隻（日誌一般只留 50 行，留空間給彙整）
  var kills = [];          // { msgs: [[kind, args]] }
  var total = 0;           // 本段補跑擊殺總數
  var byMob = {};          // 怪名 → 隻數
  var gains = {};          // 物品 id → 數量（逐筆累計，真正進背包的）
  var cur = null;          // 正在結算的那隻
  var swapping = false;    // 核心收尾時，替換它的「背包相減」彙整行
  var st = { bursts: 0, replayedKills: 0, replayedMsgs: 0, longBursts: 0 };

  var inFF = function () { return typeof state !== 'undefined' && state && state.ff; };
  var reset = function () { kills = []; total = 0; byMob = {}; gains = {}; };

  // ── 擊殺：補跑中才記錄 ──
  var oKill = window.killMob;
  window.killMob = function (idx) {
    if (!inFF()) return oKill.apply(this, arguments);
    var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null;
    var rec = (m && !m._dead) ? { n: m.n, msgs: [] } : null;
    var prev = cur; cur = rec;
    try { return oKill.apply(this, arguments); }
    finally {
      cur = prev;
      if (rec && m._dead) {   // 真的結算了（變身／安塔重試等提前 return 的不算）
        total++; byMob[rec.n] = (byMob[rec.n] || 0) + 1;
        if (rec.msgs.length) { kills.push(rec); if (kills.length > KEEP) kills.shift(); }
      }
    }
  };

  // ── 日誌：結算中被核心擋掉的訊息原樣暫存 ──
  var oSys = window.logSys, oCom = window.logCombat;
  window.logSys = function (msg) {
    if (swapping && /掛機期間獲得：/.test(String(msg))) return;   // 由下方準確彙整取代
    if (cur && inFF()) { cur.msgs.push(['sys', Array.prototype.slice.call(arguments)]); return; }
    return oSys.apply(this, arguments);
  };
  window.logCombat = function (msg) {
    if (cur && inFF()) { cur.msgs.push(['com', Array.prototype.slice.call(arguments)]); return; }
    return oCom.apply(this, arguments);
  };

  // ── 背包：核心掉落統計掛點（gainItem 與攜帶物直推都會呼叫）──
  var oAudit = window.auditTrackGain;
  window.auditTrackGain = function (res) {
    try { if (cur && inFF() && res && res.id) gains[res.id] = (gains[res.id] || 0) + (Number(res.cnt) || 1); } catch (e) {}
    return oAudit.apply(this, arguments);
  };

  var MARK = '<span class="text-slate-400" title="卡頓或背景補跑期間發生">⏩</span> ';
  var replay = function (list) {
    for (var i = 0; i < list.length; i++) {
      var ms = list[i].msgs;
      for (var j = 0; j < ms.length; j++) {
        var a = ms[j][1].slice(); a[0] = MARK + a[0];
        try { (ms[j][0] === 'sys' ? window.logSys : window.logCombat).apply(window, a); st.replayedMsgs++; } catch (e) {}
      }
      st.replayedKills++;
    }
  };
  var summary = function () {
    var ids = Object.keys(gains);
    var mobs = Object.keys(byMob).sort(function (a, b) { return byMob[b] - byMob[a]; });
    var color = function (id) { try { return getItemColor({ id: id, en: 0 }); } catch (e) { return ''; } };
    var name = function (id) { return (DB.items[id] && DB.items[id].n) || id; };
    var txt = '<span class="sys-item-gain">⏩ 補跑期間擊敗 ' + total + ' 隻'
      + (mobs.length ? '（' + mobs.slice(0, 6).map(function (n) { return n + ' ×' + byMob[n]; }).join('、') + (mobs.length > 6 ? '…' : '') + '）' : '')
      + (ids.length ? '，掉落：' + ids.sort(function (a, b) { return gains[b] - gains[a]; })
          .map(function (id) { return '<span class="' + color(id) + ' font-bold">' + name(id) + ' ×' + gains[id] + '</span>'; }).join('、')
        : '，沒有掉落') + '。</span>';
    window.logSys(txt);
  };

  var oFinish = window._ffFinishCatchup;
  window._ffFinishCatchup = function () {
    var acc = (typeof _ffAcc !== 'undefined') ? _ffAcc : null;
    var longOne = !!(acc && acc.ticks >= 30);   // 與核心同門檻：≥3 秒核心會印彙整
    var list = kills, n = total, hadGains = Object.keys(gains).length > 0;
    if (n > 0) {
      st.bursts++;
      if (longOne) {
        st.longBursts++;
        var recent = list.slice(-REPLAY_LONG);
        if (n > recent.length) { try { window.logSys('<span class="text-slate-400">⏩ 補跑期間共擊敗 ' + n + ' 隻，以下補上最近 ' + recent.length + ' 隻的記錄，全部掉落見最後的彙整。</span>'); } catch (e) {} }
        replay(recent);
      } else {
        replay(list);
      }
    }
    swapping = longOne && n > 0;
    var r;
    try { r = oFinish.apply(this, arguments); }
    finally {
      swapping = false;
      if (longOne && n > 0) { try { summary(); } catch (e) {} }
      reset();
    }
    return r;
  };

  window.__afkDropReplay = { stats: function () { return Object.assign({ pendingKills: total, kept: kills.length }, st); } };
  console.log('[AFK-droplog] 已啟用：補跑期間的擊殺／掉落記錄會補上，與背包同步');
})();
