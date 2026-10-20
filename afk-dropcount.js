/* ============================================================================
 * afk-dropcount.js — 統計分頁「本圖掉落物品」顯示本次實際打到幾個（×N）
 *
 * 玩家需求（2026-10-20）：系統記錄只留 50 行、很快被洗掉沒關係；
 *   在統計分頁（DPS 那一區）的「掉落物」檢視，用本圖掉落清單直接標上打到的數量，持續累加，
 *   離開地圖就清除。例：BOSS 房列出所有掉落，打到一個就顯示 ×1。
 *
 * 做法：
 *   ‧killMob 結算期間，用核心的掉落統計掛點 auditTrackGain 逐筆記下「哪隻怪 → 哪個物品 × 幾個」
 *     （補跑／背景期間也算，跟背包同步；只有真正進背包的才會呼叫這個掛點）
 *   ‧核心 auditReset（換地圖、進傲慢之塔樓層／遺忘之島／時空裂痕、按「重置」）時一併清除
 *   ‧取代核心 renderAuditDrops 的畫面：版面相同，每個物品後面加 ×N（有打到才顯示），
 *     怪名旁加擊殺數；不在掉落表上的額外掉落（碎片、卡片、萬能藥…）列在「其他掉落」
 *   統計分頁開著時核心每 2 秒重繪一次，數字會自己往上加。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('dropcount')) return;
  if (typeof window.killMob !== 'function' || typeof window.auditTrackGain !== 'function' ||
      typeof window.auditReset !== 'function' || typeof window.renderAuditDrops !== 'function') {
    try { console.warn('[AFK-dropcount] 找不到核心函式，未啟用'); } catch (e) {}
    return;
  }

  var got = {};     // 怪名 → { 物品id: 數量 }
  var kills = {};   // 怪名 → 擊殺數
  var since = Date.now();
  var cur = null;

  var oKill = window.killMob;
  window.killMob = function (idx) {
    var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null;
    var name = (m && !m._dead) ? m.n : null;
    var prev = cur; cur = name;
    try { return oKill.apply(this, arguments); }
    finally {
      cur = prev;
      if (name && m._dead) kills[name] = (kills[name] || 0) + 1;   // 真的結算才算（變身中間階不算）
    }
  };

  var oAudit = window.auditTrackGain;
  window.auditTrackGain = function (res) {
    try {
      if (cur && res && res.id) {
        var g = got[cur] || (got[cur] = {});
        g[res.id] = (g[res.id] || 0) + (Number(res.cnt) || 1);
      }
    } catch (e) {}
    return oAudit.apply(this, arguments);
  };

  var oReset = window.auditReset;
  window.auditReset = function () { got = {}; kills = {}; since = Date.now(); return oReset.apply(this, arguments); };

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var itemColor = function (id) { try { return getItemColor({ id: id }); } catch (e) { return ''; } };
  var badge = function (n) { return n > 0 ? ' <b class="text-green-400">×' + n.toLocaleString() + '</b>' : ''; };
  var sumOver = function (names) {
    var out = {}, k = 0;
    names.forEach(function (n) {
      k += kills[n] || 0;
      var g = got[n]; if (!g) return;
      for (var id in g) out[id] = (out[id] || 0) + g[id];
    });
    return { items: out, kills: k };
  };
  var otherHtml = function (items, listed) {
    var ids = Object.keys(items).filter(function (id) { return listed.indexOf(id) === -1 && DB.items[id]; })
      .sort(function (a, b) { return items[b] - items[a]; });
    if (!ids.length) return '';
    return '<div class="text-xs leading-relaxed mt-1"><span class="text-slate-500">其他掉落：</span>'
      + ids.map(function (id) { return '<span class="' + itemColor(id) + '">' + esc(DB.items[id].n) + '</span>' + badge(items[id]); }).join('、') + '</div>';
  };

  window.renderAuditDrops = function (el) {
    var pool = (typeof DB !== 'undefined' && DB.maps && typeof mapState !== 'undefined') ? (DB.maps[mapState.current] || null) : null;
    var body = '', used = {};
    if (!pool || !pool.length) {
      body = '<div class="text-slate-500 text-sm">目前地圖沒有怪物掉落資料。</div>';
    } else {
      var sorted = pool.slice().sort(function (a, b) { return ((DB.mobs[a] && DB.mobs[a].lv) || 0) - ((DB.mobs[b] && DB.mobs[b].lv) || 0); });
      body = sorted.map(function (mid) {
        var mob = DB.mobs[mid]; if (!mob) return '';
        var drops = _auditMobDrops(mob.n);
        var names = [mob.n];
        // 變身鏈（玉藻→九尾→殺生石）：後續階併入鏈根顯示，數量也一併加總
        var seen = {}; seen[mid] = 1; var t = mob.transformTo;
        while (t && DB.mobs[t] && !seen[t]) {
          seen[t] = 1; names.push(DB.mobs[t].n);
          _auditMobDrops(DB.mobs[t].n).forEach(function (id) { if (drops.indexOf(id) === -1) drops.push(id); });
          t = DB.mobs[t].transformTo;
        }
        names.forEach(function (n) { used[n] = 1; });
        var s = sumOver(names);
        var dropHtml = drops.length
          ? drops.map(function (id) { return '<span class="' + itemColor(id) + '">' + esc(DB.items[id].n) + '</span>' + badge(s.items[id] || 0); }).join('、')
          : '<span class="text-slate-500">（無掉落物）</span>';
        var nameCls = mob.boss ? 'text-orange-400' : getMobColor(mob.lv);
        return '<div class="bg-slate-800/60 rounded p-2">'
          + '<div class="font-bold ' + nameCls + ' mb-1">' + (mob.boss ? '👑 ' : '') + esc(mob.n) + ' <span class="text-slate-500 text-xs">Lv.' + mob.lv + '</span>'
          + (s.kills ? ' <span class="text-slate-300 text-xs font-normal">擊殺 <b class="text-green-400">' + s.kills.toLocaleString() + '</b></span>' : '') + '</div>'
          + '<div class="text-xs leading-relaxed">' + dropHtml + '</div>'
          + otherHtml(s.items, drops)
          + '</div>';
      }).join('');
    }
    // 不在本圖出怪清單裡的擊殺（頭目事件、白目玩家等）
    var extra = Object.keys(kills).filter(function (n) { return !used[n]; });
    if (extra.length) {
      body += extra.map(function (n) {
        var s = sumOver([n]);
        return '<div class="bg-slate-800/40 rounded p-2"><div class="font-bold text-slate-300 mb-1">' + esc(n)
          + ' <span class="text-slate-300 text-xs font-normal">擊殺 <b class="text-green-400">' + s.kills.toLocaleString() + '</b></span></div>'
          + (otherHtml(s.items, []) || '<div class="text-xs text-slate-500">（沒有掉落）</div>') + '</div>';
      }).join('');
    }
    var mins = Math.max(0, (Date.now() - since) / 60000);
    el.innerHTML = '<div class="flex flex-col gap-3 text-sm">'
      + '<div class="flex items-center justify-between">'
      + '<span class="text-purple-300 font-bold text-base">本圖掉落物品</span>'
      + '<div class="flex items-center gap-2">'
      + '<button onclick="toggleAuditView()" class="btn px-3 py-1 text-xs bg-indigo-900 border-indigo-600 text-indigo-200 font-bold">統計表</button>'
      + '<button onclick="auditReset()" class="btn px-3 py-1 text-xs bg-slate-700 border-slate-500 text-slate-200">重置</button>'
      + '</div></div>'
      + '<div class="text-slate-400 text-xs">目前地圖出沒的怪物與其掉落物品；<b class="text-green-400">×數字</b>＝本次在這張圖實際打到的數量（已觀測 ' + mins.toFixed(1) + ' 分鐘，離開地圖自動清除）。</div>'
      + body + '</div>';
  };

  window.__afkDropCount = { data: function () { return { kills: kills, got: got }; } };
  console.log('[AFK-dropcount] 已啟用：統計分頁的本圖掉落物品會標上實際打到的數量');
})();
