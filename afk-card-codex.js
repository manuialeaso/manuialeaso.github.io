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
    // 收集加成（玩家 2026-10-23）：每張卡加 HP 等；收集一半、全部再加
    var stats = {}, hp = 0, add = function (k, v) { stats[k] = (stats[k] || 0) + v; };
    var PER = { mythic: { hp: 20 }, celestial: { hp: 40, extraDmg: 1 }, spacetime: { hp: 60, extraDmg: 1, extraHit: 1 } };
    var HALF = { mythic: 2, celestial: 3, spacetime: 5 }, FULL = { mythic: 3, celestial: 5, spacetime: 8 };
    TIERS.forEach(function (t) {
      var rows = a.catalog[t] || [], n = rows.filter(function (row) { return a.owned(row.id, p); }).length;
      Object.keys(PER[t]).forEach(function (k) { if (k === 'hp') hp += PER[t].hp * n; else add(k, PER[t][k] * n); });
      if (rows.length && n >= Math.ceil(rows.length / 2)) { add('extraDmg', HALF[t]); add('extraHit', HALF[t]); }
      if (rows.length && n >= rows.length) { add('extraDmg', FULL[t]); add('extraHit', FULL[t]); add('extraMp', FULL[t]); }
    });
    return { total: total, lit: lit, full: full, stars: stars, stats: stats, hp: hp };
  };
  if (window.__afkMaxAdd && window.__afkMaxAdd.add) window.__afkMaxAdd.add(function (p) { if (!enabled() || !p || !p.cardAscension) return; var b = bonusOf(p); if (b.hp) p.mhp = (p.mhp || 0) + b.hp; });
  if (typeof window.recomputeStats === 'function') {
    var oRe = window.recomputeStats;
    window.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = P(); if (p && p.d && enabled()) { var bo = bonusOf(p), b = bo.total; if (b) RES.forEach(function (k) { p.d[k] = (Number(p.d[k]) || 0) + b; }); Object.keys(bo.stats).forEach(function (k) { p.d[k] = (Number(p.d[k]) || 0) + bo.stats[k]; }); }
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
    var PC = window.AFK_POLY_CODEX, gold = PC ? PC.goldCount(p) : 5;
    if (gold < 5 && !b.lit) { box.innerHTML = '<h3>神話變身卡冊</h3><p class="afk-lore">卡冊的封扣仍緊閉著，似乎在等待金色的鑰匙。</p><p>變身收集冊的金卡登錄滿 5 種後開放查看（目前 ' + gold + '/5）。</p>'; host.appendChild(box); return; }
    var h = '<h3>變身卡冊</h3><p class="afk-lore">每一頁都封著一段傳說。翻開它的人，終將成為傳說的一部分。</p><p>取得高階變身卡會點亮卡冊；同一張再取得可升星（最多 7 星）。每顆星五種屬性抗性 +5，滿 7 星再 +10。</p>'
      + '<div>點亮 <b>' + b.lit + '</b>/' + all + '　總星數 <b>' + b.stars + '</b>　滿星 ' + b.full + '　目前加成：五種屬性抗性各 <b style="color:#86efac">+' + b.total + '</b>、最大 HP +' + b.hp + Object.keys(b.stats).map(function (k) { return '、' + ({ extraDmg: '額外傷害', extraHit: '額外命中', extraMp: '額外魔法點數' }[k] || k) + ' +' + b.stats[k]; }).join('') + '</div>'
      + '<p>收集加成：每張神話 HP +20；天上 HP +40、額外傷害 +1；時空 HP +60、額外傷害 +1、額外命中 +1。同一階收集一半、全部收集再各加額外傷害與命中（神話 +2／+3、天上 +3／+5、時空 +5／+8；全收另加同值額外魔法點數）。</p>';
    TIERS.forEach(function (t) {
      var rows = a.catalog[t] || [], lit = rows.filter(function (row) { return a.owned(row.id, p); }).length;
      h += '<h3 style="color:' + COLOR[t] + '">' + RULE_TXT[t] + '卡 <small style="color:#a39a8e;font-weight:normal">' + lit + '／' + rows.length + '</small></h3><div class="afk-cb-grid">';
      rows.forEach(function (row) {
        var on = a.owned(row.id, p), s = on ? Math.min(7, a.starsOf(row.id, p)) : 0, se = on && a.sealed && a.sealed(row.id, p);
        var nm = row.n.replace(/^[^・]+・/, ''), base = row.form && (row.form.cardVisualBase || row.prototype) || nm;
        h += '<div class="afk-cb-tile ' + t + (on ? '' : ' off') + '" title="' + esc(row.n + '\n' + (row.desc || '')) + '">'
          + (window.__afkFormThumb ? window.__afkFormThumb(base, on) : '')
          + '<b>' + esc(nm) + '</b><small class="st">' + (on ? starStr(s).replace(/☆/g, '<i>☆</i>') : '未點亮') + '</small>'
          + (se ? '<small style="color:#f87171">封印中</small>' : '') + '</div>';
      });
      h += '</div>';
    });
    // 聖衣（十二星座）：時空變身收集滿開放
    var zs = a.catalog.samsara || [];
    if (zs.length) {
      var st = a.status(p).tiers.filter(function (x) { return x.tier === 'samsara'; })[0];
      h += '<h3 style="color:#fcd34d">聖衣（十二星座）</h3><p class="afk-lore">當十四段時空都被收進卡冊，天上十二宮的星光便會降臨，化為披在身上的聖衣。</p>';
      if (!st || !st.unlocked) h += '<p>收集全部時空變身後開放（封印的也算）。</p>';
      if (st && st.unlocked) { var cd = a.samsaraCd ? a.samsaraCd(p) : 0, ft = Math.floor(((p.cardAscension && p.cardAscension.samsaraFight) || 0) / 600);
        h += '<p>缺點：沒回安全區（村莊）連續戰鬥 30 分鐘會解除變身，冷卻 30 分鐘，冷卻中不能變身聖衣。' + (cd > 0 ? '<b style="color:#f87171">冷卻中，剩 ' + Math.ceil(cd / 60000) + ' 分鐘</b>' : '目前連續戰鬥 ' + ft + '/30 分鐘') + '</p>'; }
      if (st && st.unlocked) {
        h += '<div class="afk-cb-grid">';
        zs.forEach(function (row) {
          var on = a.owned(row.id, p), se = on && a.sealed(row.id, p), nm = row.n.replace(/^[^・]+・/, '');
          h += '<div class="afk-cb-tile samsara' + (on ? '' : ' off') + '" title="' + esc(row.n + '\n特殊能力：' + (row.special || '') + '（解除封印後生效；副本內回到封印型態、沒有特殊能力）') + '">'
            + (window.__afkFormThumb ? window.__afkFormThumb(row.form && row.form.cardVisualBase || nm, on) : '')
            + '<b>' + esc(nm) + '</b><small style="color:' + (on ? (se ? '#fca5a5' : '#fde047') : '#7a7168') + '">' + (!on ? '未取得' : se ? '封印聖衣' : '已解除封印') + '</small></div>';
        });
        h += '</div>';
      }
    }
    box.innerHTML = h; host.appendChild(box);
  }

  // ── NPC 至幻者（燃柳村）──
  try {
    var town = DB.towns && DB.towns.town_gludio;
    if (town && Array.isArray(town.npcs) && !town.npcs.some(function (x) { return x.id === 'npc_zhihuan'; })) {
      town.npcs.push({ id: 'npc_zhihuan', n: '至幻者', title: '變身卡冊', type: 'cardcodex',
        d: '自稱見過世間一切形貌的幻術師。他收藏著變身卡冊，也能把卡片的魂影熔鑄成神話、天上、時空與聖衣之形。' });
    }
    if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED.npc_zhihuan) NPC_SPR_FIXED.npc_zhihuan = '902';
  } catch (e) {}
  function openNpc(host) {
    if (!host) return;
    // 遊戲本體不認得這種 NPC，會先放一張「系統建置中」；換成至幻者自己的內容
    Array.prototype.slice.call(host.children).forEach(function (c) { if (/系統建置中/.test(c.textContent || '')) c.remove(); });
    if (!host.querySelector('#afk-zhihuan-intro')) host.insertAdjacentHTML('afterbegin', '<p id="afk-zhihuan-intro" class="afk-lore">「世間每一種形貌，我都見過；你想借用哪一種？」——至幻者</p>');
    var a = A();
    try { if (window.AFK_POLY_CODEX) window.AFK_POLY_CODEX.render(host); } catch (e) {}
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
  var cbStyle = document.createElement('style');
  cbStyle.textContent = '.afk-cb-grid{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 12px}.afk-cb-tile .st{color:#fde047;letter-spacing:-1px}.afk-cb-tile .st i{font-style:normal;color:#5c554e}'
    + '.afk-cb-tile.mythic{border-color:#9a651c}.afk-cb-tile.celestial{border-color:#c6a85d}.afk-cb-tile.spacetime{border-color:#6856d5}.afk-cb-tile.samsara{border-color:#f59e0b;box-shadow:inset 0 0 8px rgba(245,158,11,.18)}'
    + '.afk-cb-tile.off{border-color:#3a2c24;box-shadow:none}.afk-cb-tile.off b{color:#6b645c}';
  document.head.appendChild(cbStyle);
  window.AFK_CARD_CODEX = { bonusOf: bonusOf, renderBook: renderBook, openNpc: openNpc };
  console.log('[AFK-card-codex] 已啟用：變身卡冊（點亮／升星）、燃柳村至幻者');
})();
