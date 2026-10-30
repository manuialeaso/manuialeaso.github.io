/* ============================================================================
 * afk-special-collection.js — 收藏面板第 6 本「特殊收藏」（玩家 2026-10-30）
 *
 *   把散在各處的紀錄集中在一本：
 *     🌍 世界事件：克特的追殺令、五個世界事件、幽靈船（遇到、打倒次數）
 *     👑 地區霸主：十五個地區的霸主（打倒次數、霸主的證明）
 *     📜 劇情：主線與支線劇情（紅獅之誓、知識與背叛、闇龍的低語…）、職業專屬劇情、亞丁的陰影（目前職業的進度）
 *     📋 任務：各等級的職業試煉（目前職業）
 *     🏹 冒險者等級：魔物獵人模式（冒險者等級、完成的委託、冒險者套裝）
 *   只讀現有紀錄，不改任何數值；目前不給收藏加成。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var stOf = function (p, key) { try { return typeof trialQStateFor === 'function' ? trialQStateFor(p, key) : ((p.trialQ || {})[key] || 0); } catch (e) { return 0; } };
  var CLS_N = { royal: '王族', knight: '騎士', mage: '法師', elf: '妖精', dark: '黑暗妖精', dragon: '龍騎士', illusion: '幻術士', warrior: '戰士' };

  // ── 各區資料 ──
  var worldRows = function (p) {
    var rows = [];
    var K = W.__afkKurtHunt;
    if (K) { var ks = p.afkKurtStats || {}; rows.push({ icon: '⚔', n: '克特的追殺令', met: ks.met || 0, kills: ks.kills || 0 }); }
    var E = W.__afkWorldEvents;
    if (E) { var es = (p.afkWe && p.afkWe.stats) || {}; E.IDS.forEach(function (id) { var e = E.EV[id], s = es[id] || {}; rows.push({ icon: e.badge.split(' ')[0], n: e.n, met: s.met || 0, kills: s.kills || 0 }); }); }
    var G = W.__afkGhostShip;
    if (G) { var gs = p.afkGs || {}; rows.push({ icon: '⛵', n: '幽靈船出航', met: gs.rides || 0, kills: gs.captains || 0, killN: '幽靈船長' }); }
    return rows;
  };
  var bossRows = function (p) {
    var B = W.__afkRegionBoss; if (!B) return [];
    var st = (p.afkRb && p.afkRb.stats) || {};
    return B.LIST.map(function (b) { var s = st[b.r] || {}; return { b: b, met: s.met || 0, kills: s.kills || 0, first: s.first || 0 }; });
  };
  var storyGroups = function (p) {
    var out = [], L = W.__afkLore;
    if (L && L.lines) Object.keys(L.lines).forEach(function (id) {
      var line = L.lines[id];
      out.push({ n: '劇情「' + line.name + '」', host: line.hostN, ch: line.chapters.map(function (c, i) { return { lv: c.lv, t: c.title, done: stOf(p, L.keyOf(line, i, p.cls)) === 2 }; }) });
    });
    var S = W.AFK_CLASS_SAGA;
    if (S && S.saga && S.saga[p.cls]) out.push({ n: CLS_N[p.cls] + '專屬劇情「' + S.saga[p.cls].arc + '」', host: S.saga[p.cls].hostN,
      ch: S.chapters.filter(function (q) { return q.cls === p.cls; }).map(function (q) { return { lv: q.lv, t: q.title, done: stOf(p, q.key) === 2 }; }) });
    var A = W.AFK_ADEN_QUESTS;
    if (A && A.quests) out.push({ n: '亞丁的陰影', host: '近衛隊長 雷歐', ch: A.quests.map(function (q) { return { lv: q.lv, t: q.title, done: stOf(p, A.keyOf(q, p)) === 2 }; }) });
    return out;
  };
  var questRows = function (p) {
    if (typeof TRIAL_Q === 'undefined') return [];
    return Object.keys(TRIAL_Q).filter(function (k) { var q = TRIAL_Q[k]; return q && q.cls === p.cls && !q.afkLore && !q.afkSaga && !q.afkAden; })
      .map(function (k) { var q = TRIAL_Q[k]; return { lv: q.lv, npc: q.npc, rw: (q.rewards || []).map(function (id) { return DB.items[id] ? DB.items[id].n : id; }).join('、'), done: stOf(p, k) === 2, on: stOf(p, k) === 1 }; })
      .sort(function (a, b) { return a.lv - b.lv; });
  };

  // ── 畫面 ──
  var bar = function (a, b) { var pc = b ? Math.round(a / b * 100) : 0; return '<span class="afk-sc-cnt">' + a + '／' + b + '</span><span class="afk-sc-bar"><i style="width:' + pc + '%"></i></span>'; };
  var sec = function (icon, title, a, b, body, open) { return '<details class="afk-sc-sec"' + (open ? ' open' : '') + '><summary><b>' + icon + ' ' + title + '</b>' + bar(a, b) + '</summary><div class="afk-sc-body">' + body + '</div></details>'; };
  var render = function (body) {
    var p = P(); if (!p) { body.innerHTML = '<p class="text-slate-300">請先進入遊戲。</p>'; return; }
    var h = '<p class="afk-sc-note">各種挑戰、劇情與任務的紀錄。劇情與任務顯示目前角色（' + esc(CLS_N[p.cls] || p.cls) + '）的進度。</p>';
    // 世界事件
    var wr = worldRows(p);
    h += sec('🌍', '世界事件', wr.filter(function (r) { return r.kills > 0; }).length, wr.length,
      wr.length ? '<div class="afk-sc-grid">' + wr.map(function (r) { return '<div class="afk-sc-tile' + (r.kills ? ' got' : r.met ? ' met' : '') + '"><div class="afk-sc-ic">' + esc(r.icon) + '</div><b>' + esc(r.n) + '</b><small>遇到 ' + r.met + ' 次・' + (r.killN ? '打倒' + esc(r.killN) + ' ' : '打倒 ') + r.kills + ' 次</small></div>'; }).join('') + '</div>' : '<p class="afk-sc-note">世界事件目前都關閉中。</p>', true);
    // 地區霸主
    var br = bossRows(p);
    h += sec('👑', '地區霸主', br.filter(function (r) { return r.kills > 0; }).length, br.length,
      br.length ? '<div class="afk-sc-grid">' + br.map(function (r) {
        var tr = DB.items[r.b.trophyId];
        return '<div class="afk-sc-tile' + (r.kills ? ' got' : r.met ? ' met' : '') + '" title="' + esc(r.b.lore) + '"><img alt="" loading="lazy" src="' + esc(tr ? tr.img : '') + '"><b>' + esc(r.b.label) + '</b><small>' + esc(r.kills || r.met ? r.b.n : '？？？') + '</small><small>' + (r.kills ? '打倒 ' + r.kills + ' 次・' + esc(r.b.trophy) : r.met ? '遇到 ' + r.met + ' 次・尚未打倒' : '尚未遇到') + '</small></div>';
      }).join('') + '</div><p class="afk-sc-note">地區霸主在各地區的野外與地監隨機現身（Lv' + W.__afkRegionBoss.LV_MIN + ' 以上）。</p>' : '<p class="afk-sc-note">「地區霸主」目前關閉中。</p>');
    // 劇情
    var sg = storyGroups(p), sd = 0, sn = 0;
    sg.forEach(function (g) { g.ch.forEach(function (c) { sn++; if (c.done) sd++; }); });
    h += sec('📜', '劇情', sd, sn, sg.map(function (g) {
      var d = g.ch.filter(function (c) { return c.done; }).length;
      return '<div class="afk-sc-line"><div class="afk-sc-lh"><b>' + esc(g.n) + '</b><span>' + esc(g.host || '') + '・' + d + '／' + g.ch.length + ' 章</span></div><ol>'
        + g.ch.map(function (c) { return '<li class="' + (c.done ? 'done' : '') + '">' + (c.done ? '✔ ' : '・') + 'Lv' + c.lv + ' ' + esc(c.done ? c.t : c.t) + '</li>'; }).join('') + '</ol></div>';
    }).join(''));
    // 任務
    var qr = questRows(p);
    h += sec('📋', '任務（職業試煉）', qr.filter(function (q) { return q.done; }).length, qr.length,
      '<ol class="afk-sc-q">' + qr.map(function (q) { return '<li class="' + (q.done ? 'done' : '') + '">' + (q.done ? '✔' : q.on ? '…' : '・') + ' Lv' + q.lv + ' 試煉（' + esc(q.npc) + '）<small>' + esc(q.rw) + '</small></li>'; }).join('') + '</ol>');
    // 冒險者等級
    var HU = W.__afkHunter;
    if (!HU) h += sec('🏹', '冒險者等級', 0, 0, '<p class="afk-sc-note">「魔物獵人模式」目前關閉中。</p>');
    else if (p.classicMode) h += sec('🏹', '冒險者等級', 0, 0, '<p class="afk-sc-note">經典模式不開放冒險者公會。</p>');
    else {
      var hs = HU.store(p), ri = HU.rankIdx(p), R = HU.RANKS, own = function (id) { return (p.inv || []).some(function (x) { return x && x.id === id; }) || Object.keys(p.eq || {}).some(function (k) { return p.eq[k] && p.eq[k].id === id; }); };
      var setGot = HU.SET.filter(function (x) { return own(x.id); }).length;
      h += sec('🏹', '冒險者等級', ri, R.length - 1,
        '<div class="afk-sc-grid">' + R.map(function (r, i) { return '<div class="afk-sc-tile' + (i <= ri ? ' got' : '') + '"><div class="afk-sc-ic" style="color:' + r[2] + ';font-weight:900">' + r[0] + '</div><b>' + r[0] + ' 級</b><small>' + r[1].toLocaleString() + ' 點</small></div>'; }).join('') + '</div>'
        + '<p class="afk-sc-note">目前 ' + R[ri][0] + ' 級・冒險點數 ' + (hs.pts || 0).toLocaleString() + '・完成委託 ' + (hs.done || 0) + ' 個（討伐 ' + ((hs.kinds || {}).kill || 0) + '、霸主 ' + ((hs.kinds || {}).rb || 0) + '、世界事件 ' + ((hs.kinds || {}).we || 0) + '）・冒險者套裝 ' + setGot + '／' + HU.SET.length + ' 件</p>'
        + '<p class="afk-sc-note">冒險者公會的接待員在說話之島、奇岩、亞丁、歐瑞。</p>');
    }
    body.innerHTML = h;
  };

  // ── 完成度（給終焉第三階層的入場資格用：隊伍每個角色的特殊收藏要滿，玩家 2026-10-30 19:09）──
  //   每一區「分子＝分母」才算滿；分母是 0 的區（外掛關著、經典模式）不算。p 可以是傭兵的來源存檔（_roleReadSavePlayer）。
  var progress = function (p) {
    var out = [];
    if (!p || !p.cls) return out;
    var wr = worldRows(p); out.push({ k: 'world', n: '世界事件', a: wr.filter(function (r) { return r.kills > 0; }).length, b: wr.length });
    var br = bossRows(p); out.push({ k: 'boss', n: '地區霸主', a: br.filter(function (r) { return r.kills > 0; }).length, b: br.length });
    var sd = 0, sn = 0; storyGroups(p).forEach(function (g) { g.ch.forEach(function (c) { sn++; if (c.done) sd++; }); }); out.push({ k: 'story', n: '劇情', a: sd, b: sn });
    var qr = questRows(p); out.push({ k: 'quest', n: '任務', a: qr.filter(function (q) { return q.done; }).length, b: qr.length });
    var HU = W.__afkHunter;
    if (HU && !p.classicMode) { try { out.push({ k: 'hunter', n: '冒險者等級', a: HU.rankIdx(p), b: HU.RANKS.length - 1 }); } catch (e) {} }
    return out;
  };
  var full = function (p) { var pr = progress(p); return pr.length > 0 && pr.every(function (x) { return !x.b || x.a >= x.b; }); };
  W.__afkSpecialCollection = { progress: progress, full: full };

  var css = document.createElement('style');
  css.textContent = '.afk-sc-sec{border:1px solid #4e3526;border-radius:.4rem;background:#1b1a20;margin-bottom:10px}'
    + '.afk-sc-sec>summary{cursor:pointer;display:flex;align-items:center;gap:10px;padding:10px 12px;color:#fde68a;font-size:16px;list-style:none}'
    + '.afk-sc-sec>summary::-webkit-details-marker{display:none}.afk-sc-sec>summary b{flex:1}'
    + '.afk-sc-cnt{font-size:13px;color:#cbd5e1;font-variant-numeric:tabular-nums}.afk-sc-bar{width:80px;height:6px;border-radius:3px;background:#334155;overflow:hidden}.afk-sc-bar i{display:block;height:100%;background:#f59e0b}'
    + '.afk-sc-body{padding:4px 12px 12px}.afk-sc-note{font-size:13px;color:#a39a8e;margin:4px 0 10px}'
    + '.afk-sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:8px}'
    + '.afk-sc-tile{border:1px solid #3f3a36;border-radius:.3rem;padding:8px;background:#211f26;opacity:.55;text-align:center}.afk-sc-tile.met{opacity:.8}.afk-sc-tile.got{opacity:1;border-color:#c9a03a;box-shadow:inset 0 0 8px rgba(234,179,8,.18)}'
    + '.afk-sc-tile img{width:36px;height:36px;margin:0 auto 4px;image-rendering:pixelated}.afk-sc-tile:not(.got) img{filter:grayscale(1)}.afk-sc-ic{font-size:22px;line-height:1.2}'
    + '.afk-sc-tile b{display:block;font-size:13px;color:#ece6dc}.afk-sc-tile small{display:block;font-size:11.5px;color:#a39a8e;line-height:1.35}.afk-sc-tile.got small{color:#fde68a}'
    + '.afk-sc-line{margin-bottom:10px}.afk-sc-lh{display:flex;justify-content:space-between;gap:8px;color:#ece6dc;font-size:14px}.afk-sc-lh span{color:#a39a8e;font-size:12.5px}'
    + '.afk-sc-line ol,.afk-sc-q{margin:4px 0 0;padding:0;list-style:none;font-size:13px;color:#8a8278}.afk-sc-line li.done,.afk-sc-q li.done{color:#86efac}'
    + '.afk-sc-q li{padding:3px 0;border-bottom:1px solid #2a2730}.afk-sc-q small{display:block;color:#a39a8e;font-size:11.5px;margin-left:1.2em}';
  document.head.appendChild(css);

  W.collectionOpenSpecial = function () {
    try { if (typeof closeCollectionPanel === 'function') closeCollectionPanel(); } catch (e) {}
    var ov = document.getElementById('afk-special-book');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'afk-special-book';
      ov.className = 'fixed inset-0 bg-black/70 flex items-center justify-center p-4'; ov.style.zIndex = '9600';
      ov.innerHTML = '<div class="w-full max-w-4xl flex flex-col bg-slate-900/95 rounded-2xl border-2 border-amber-700/60 overflow-hidden" style="max-height:calc(100dvh - 32px)">'
        + '<div class="flex items-center justify-between px-5 py-3 border-b border-slate-700 bg-gradient-to-b from-[#3a2a12] to-[#1e160b]"><h2 class="text-2xl font-bold text-amber-200">🏆 特殊收藏</h2>'
        + '<button type="button" class="btn px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border-slate-500 text-slate-200 font-bold" data-close>✕</button></div>'
        + '<div data-body class="p-4 overflow-y-auto" style="overscroll-behavior:contain"></div></div>';
      var close = function () { ov.remove(); if (_h && W.AFK_NAV) { try { AFK_NAV.pop(_h); } catch (e) {} } _h = null; };
      ov.addEventListener('click', function (e) { if (e.target === ov || e.target.hasAttribute('data-close')) close(); });
      document.body.appendChild(ov);
      var _h = null;
      try { if (W.AFK_NAV && AFK_NAV.push) _h = AFK_NAV.push(function () { _h = null; ov.remove(); }); } catch (e) {}
    }
    var body = ov.querySelector('[data-body]');
    try { render(body); } catch (e) { body.innerHTML = '<p>特殊收藏載入失敗。</p>'; console.warn('[AFK-special-collection]', e); }
  };
  var addBtn = function () {
    try {
      var cp = document.querySelector('#collection-panel .flex.flex-col.gap-3');
      if (cp && !document.getElementById('afk-coll-special')) {
        var bt = document.createElement('button'); bt.id = 'afk-coll-special'; bt.type = 'button'; bt.className = 'btn py-5 text-xl font-bold';
        bt.style.cssText = 'background: linear-gradient(135deg, #451a03, #b45309); color: #fef3c7; border-color: #f59e0b;';
        bt.textContent = '🏆 特殊收藏'; bt.onclick = function () { W.collectionOpenSpecial(); };
        cp.appendChild(bt);
      }
    } catch (e) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBtn); else addBtn();
  W.AFK_SPECIAL_COLLECTION = { render: render, worldRows: worldRows, bossRows: bossRows, storyGroups: storyGroups, questRows: questRows };
})();
