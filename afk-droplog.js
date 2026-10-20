/* ============================================================================
 * afk-droplog.js — 短暫卡頓後的「補跑」：擊殺與掉落訊息照常顯示
 *
 * 問題（原作者核心 js/03 gameLoop 的規則，原版與 pp771007 外掛版都一樣）：
 *   主迴圈每 100ms 跑一次。只要畫面卡住 ≥0.2 秒，就改走「補跑」把落後的時間追回來；
 *   補跑期間 state.ff = true，核心的 logCombat / logSys 一律不寫（防洗版）。
 *   追回時間 ≥3 秒的補跑，結束後會印一行「掛機期間獲得：…」彙整；
 *   但 **不到 3 秒的短補跑什麼都不印**。這段時間內被打死的怪：
 *     ‧經驗、金幣、掉落都有正常進背包（實測理論掉率與實際一致）
 *     ‧但畫面上怪就消失了，沒有「擊敗了…」，也沒有「…給你 …」
 *   → 玩家看到的就是「王／小怪是空的」「卡一下就好幾隻都不掉東西」。
 *   實測（8 人隊伍、一般地圖、前景）：約 10% 的擊殺發生在這種短補跑裡。
 *
 * 做法（不改核心）：
 *   前景時，補跑中的每次擊殺先記下怪名與掉落物；補跑結束時
 *     ‧短補跑（<3 秒，核心不印彙整）→ 依序補印「擊敗了…」與「…給你 …」，行首加 ⏩ 表示是卡頓後補上的
 *     ‧長補跑（≥3 秒）→ 核心已印「掛機期間獲得」彙整，不重複印
 *   背景分頁不記錄（回前景時一定是長補跑，由核心彙整）。
 *   只改「顯示」，不碰掉落機率、不碰背包內容。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('droplog')) return;
  if (typeof window.killMob !== 'function' || typeof window.gainItem !== 'function' || typeof window._ffFinishCatchup !== 'function') {
    try { console.warn('[AFK-droplog] 找不到核心函式，未啟用'); } catch (e) {}
    return;
  }

  var MAX_KILLS = 60;          // 單次短補跑最多補印幾隻（超過的只計數）
  var queue = [], overflow = 0, cur = null;
  var st = { replayedKills: 0, replayedItems: 0, droppedLong: 0, bursts: 0 };

  var recording = function () { return typeof state !== 'undefined' && state && state.ff && !document.hidden; };

  var oKill = window.killMob;
  window.killMob = function (idx) {
    if (!recording()) return oKill.apply(this, arguments);
    var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null;
    var alive = !!(m && !m._dead);
    var rec = alive ? { n: m.n, lv: m.lv, boss: !!m.boss, hide: !!(m.race === '建築' && m.noAutoTeleport), gains: [] } : null;
    var prev = cur; cur = rec;
    try { return oKill.apply(this, arguments); }
    finally {
      cur = prev;
      if (rec && m._dead) {   // 真的結算了（變身、安塔重試等提前 return 的不算）
        if (queue.length < MAX_KILLS) queue.push(rec); else overflow++;
      }
    }
  };

  var oGain = window.gainItem;
  window.gainItem = function (id, cnt, silent) {
    var r = oGain.apply(this, arguments);
    if (cur && r && !silent && typeof _lootMobInfo !== 'undefined' && _lootMobInfo) cur.gains.push(r);
    return r;
  };

  var esc = function (s) { return String(s == null ? '' : s); };
  var replay = function () {
    var list = queue, extra = overflow;
    queue = []; overflow = 0;
    if (!list.length) return;
    st.bursts++;
    for (var i = 0; i < list.length; i++) {
      var k = list[i];
      var mc = (typeof getMobColor === 'function') ? getMobColor(k.lv) : '';
      try {
        if (!k.hide) logCombat('<span class="text-slate-400" title="卡頓後補跑期間的擊殺">⏩</span> 擊敗了 <span class="' + mc + '">' + esc(k.n) + '</span>！', 'player-heavy', 'player');
        for (var j = 0; j < k.gains.length; j++) {
          var info = k.gains[j], d = (typeof DB !== 'undefined' && DB.items) ? DB.items[info.id] : null;
          var rare = d ? (d.relic ? 'relic' : (d.legend ? 'legend' : '')) : '';
          var nm = (typeof getItemFullName === 'function') ? getItemFullName(info) : (d ? d.n : info.id);
          var nameHtml = rare ? '<span class="sys-drop-rare sys-drop-' + rare + '">✦ ' + nm + '</span>' : '<span class="font-bold">' + nm + '</span>';
          logSys('<span class="sys-item-gain"><span class="text-slate-400">⏩</span> <span class="' + mc + '">' + esc(k.n) + '</span> 給你 ' + nameHtml + ' 。</span>', rare);
          st.replayedItems++;
        }
        st.replayedKills++;
      } catch (e) {}
    }
    if (extra > 0) { try { logSys('<span class="text-slate-400">⏩ 另有 ' + extra + ' 隻在補跑中被擊敗，掉落已放進背包。</span>'); } catch (e) {} }
  };

  var oFinish = window._ffFinishCatchup;
  window._ffFinishCatchup = function () {
    var acc = (typeof _ffAcc !== 'undefined') ? _ffAcc : null;
    var longOne = !!(acc && acc.ticks >= 30);   // 與核心同門檻：≥3 秒由核心印彙整
    var r = oFinish.apply(this, arguments);
    if (longOne) { if (queue.length || overflow) st.droppedLong++; queue = []; overflow = 0; }
    else replay();
    return r;
  };
  // 補跑中途切到背景：之後一定會變成長補跑，先清掉，避免背景期間佇列殘留
  document.addEventListener('visibilitychange', function () { if (document.hidden) { queue = []; overflow = 0; } });

  window.__afkDropReplay = { stats: function () { return Object.assign({ pending: queue.length }, st); } };
  console.log('[AFK-droplog] 已啟用：短暫卡頓補跑中的擊殺／掉落會補印到日誌');
})();
