/* ==========================================================================
 * afk-card-codex.js — 變身卡冊與燃柳村 NPC「至幻者」（玩家 2026-10-23 指定）
 *
 * 卡冊＝神話／天上／時空變身的圖鑑（參照天堂 M／W：收集與點亮分開）
 *   ‧第一次取得某張高階變身卡＝點亮卡冊（同時永久解鎖變身）
 *   ‧之後每再取得一次同一張＝升 1 星，最多 7 星（同一款共要取得 8 次）；滿星後再取得才返還鑽石卡
 *   ‧每顆星：五種屬性抗性（火、水、風、地、無屬性）各 +5；滿 7 星再額外 +10（一張滿星共 +45）
 *   ‧天上自選碎片：10 枚換 1 張天上卡自選，可用來點亮或升星天上卡
 * 至幻者（燃柳村）：高階變身卡合成、碎片兌換、卡冊查看都在這裡
 * 資料存在 player.cardAscension.copies（afk-card-ascension 管理）；舊存檔已解鎖的卡視為 0 星
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  var A = function () { return window.AFK_CARD_ASCENSION; };
  var enabled = function () { return !!A() && (!T || T.enabled('card-ascension')); };
  if (!A()) { console.warn('[AFK-card-codex] 找不到高階變身卡系統，略過'); return; }
  var TIERS = ['mythic', 'celestial', 'spacetime'];
  var RES = ['resFire', 'resWater', 'resWind', 'resEarth', 'resNone'];
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // 卡冊加成：每星五抗 +5，滿 7 星再 +10
  var bonusOf = function (p) {
    var a = A(); if (!a || !p) return { total: 0, lit: 0, full: 0, stars: 0 };
    var total = 0, lit = 0, full = 0, stars = 0;
    TIERS.forEach(function (t) { (a.catalog[t] || []).forEach(function (row) {
      if (!a.owned(row.id, p)) return;
      lit++; var s = Math.min(7, a.starsOf(row.id, p)); stars += s;
      total += s * 5 + (s >= 7 ? 10 : 0); if (s >= 7) full++;
    }); });
    return { total: total, lit: lit, full: full, stars: stars };
  };
  if (typeof window.recomputeStats === 'function') {
    var oRe = window.recomputeStats;
    window.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = P(); if (p && p.d && enabled()) { var b = bonusOf(p).total; if (b) RES.forEach(function (k) { p.d[k] = (Number(p.d[k]) || 0) + b; }); }
      } catch (e) {}
      return r;
    };
  }
  // ── 卡冊畫面 ──
  var RULE_TXT = { mythic: '神話', celestial: '天上', spacetime: '時空' };
  var COLOR = { mythic: '#fb923c', celestial: '#fde68a', spacetime: '#c4b5fd' };
  var starStr = function (n) { var s = ''; for (var i = 0; i < 7; i++) s += i < n ? '★' : '☆'; return s; };
  function renderBook(host) {
    if (!host || !enabled()) return;
    var p = P(); if (!p) return;
    var old = host.querySelector('#afk-codex'); if (old) old.remove();
    var a = A(), b = bonusOf(p), all = 0; TIERS.forEach(function (t) { all += (a.catalog[t] || []).length; });
    var box = document.createElement('section'); box.id = 'afk-codex'; box.className = 'afk-ca-panel';
    var h = '<h3>變身卡冊</h3><p>取得高階變身卡會點亮卡冊；同一張再取得可升星（最多 7 星）。每顆星五種屬性抗性 +5，滿 7 星再 +10。</p>'
      + '<div>點亮 <b>' + b.lit + '</b>/' + all + '　總星數 <b>' + b.stars + '</b>　滿星 ' + b.full + '　目前加成：五種屬性抗性各 <b style="color:#86efac">+' + b.total + '</b></div>';
    TIERS.forEach(function (t) {
      h += '<h3 style="color:' + COLOR[t] + '">' + RULE_TXT[t] + '卡</h3>';
      (a.catalog[t] || []).forEach(function (row) {
        var on = a.owned(row.id, p), s = on ? Math.min(7, a.starsOf(row.id, p)) : 0;
        h += '<div class="afk-ca-tier" style="opacity:' + (on ? 1 : .55) + '"><strong>' + esc(row.n) + '</strong><span style="color:' + (on ? '#fde047' : '#64748b') + '">' + (on ? starStr(s) : '未點亮') + '</span><small>' + (on ? (s >= 7 ? '已滿星（+45）' : '再取得 ' + (7 - s) + ' 次滿星；目前 +' + (s * 5)) : esc(row.desc || '')) + '</small></div>';
      });
    });
    box.innerHTML = h; host.appendChild(box);
  }

  // ── NPC 至幻者（燃柳村）──
  try {
    var town = DB.towns && DB.towns.town_gludio;
    if (town && Array.isArray(town.npcs) && !town.npcs.some(function (x) { return x.id === 'npc_zhihuan'; })) {
      town.npcs.push({ id: 'npc_zhihuan', n: '至幻者', title: '變身卡冊', type: 'cardcodex',
        d: '把多餘的鑽石卡交給至幻者，合成神話、天上與時空變身卡，並在卡冊上點亮與升星。' });
    }
    if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED.npc_zhihuan) NPC_SPR_FIXED.npc_zhihuan = '902';
  } catch (e) {}
  function openNpc(host) {
    if (!host) return;
    var a = A();
    try { if (typeof a.renderSynth === 'function') a.renderSynth(host); } catch (e) {}
    var acts = document.createElement('div'); acts.className = 'afk-ca-actions'; acts.id = 'afk-codex-actions';
    var p = P(), choice = p && (p.inv || []).find(function (i) { return i && i.id === 'afk_card_celestial_choice' && !i.lock; });
    if (choice) { var cb = document.createElement('button'); cb.type = 'button'; cb.className = 'btn'; cb.textContent = '使用天上卡自選（點亮／升星）'; cb.onclick = function () { a.openChoice(choice.uid); }; acts.appendChild(cb); }
    if (acts.children.length) host.appendChild(acts);
    renderBook(host);
  }
  if (typeof window.interactNPC === 'function') {
    var oNpc = window.interactNPC;
    window.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      if (enabled() && npcId === 'npc_zhihuan') { try { openNpc(document.getElementById('interaction-content')); } catch (e) { console.warn('[AFK-card-codex]', e); } }
      return r;
    };
  }
  window.AFK_CARD_CODEX = { bonusOf: bonusOf, renderBook: renderBook, openNpc: openNpc };
  console.log('[AFK-card-codex] 已啟用：變身卡冊（點亮／升星）、燃柳村至幻者');
})();
