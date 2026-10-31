/* ============================================================================
 * afk-lostshard.js — 失去光輝的碎片（玩家 2026-10-26 指定）
 *
 * 遺物強化、昇華支配（升級與強化）、至高的支配進化用到的每一種材料，都有一種對應的
 * 「失去光輝的○○碎片」，只在席琳夢域鏡掉落：
 *   ‧一般怪物 1% 機率掉 1 個（隨機一種）；頭目必掉 5 個（每個隨機一種）
 *   ‧最終頭目決戰中不掉
 * 燃柳村 哈瑪大師：碎片 100 個＋龍之鑽石 500＋席琳結晶 1,000 顆 → 換 1 個該材料
 * 席琳結晶本身是兌換費用，不另做碎片；高階套裝（四大古代龍鱗盔甲、真．冥皇裝備）是裝備不是材料，也不做碎片。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.items) return;
  var MATS = ['afk_dream_crystal', 'afk_hell_essence', 'afk_contempt_earth', 'afk_contempt_water', 'afk_contempt_wind', 'afk_contempt_fire',
    'afk_dark_stardust', 'afk_abyss_key', 'afk_dream_dust', 'afk_asc_stone_wpn', 'afk_asc_stone_arm', 'afk_asc_stone_acc',
    'afk_ts_contempt_earth', 'afk_ts_contempt_water', 'afk_ts_contempt_wind', 'afk_ts_contempt_fire', 'afk_ts_dark_stardust', 'afk_ts_dream_dust']
    .filter(function (id) { return !!DB.items[id]; });
  var PER = 100, DIA = 500, CRYSTAL = 'sherine_crystal', CRY = 1000, NORMAL_RATE = 0.01, BOSS_N = 5;
  var sid = function (mat) { return 'afk_lost_' + mat.replace(/^afk_/, ''); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };

  MATS.forEach(function (m) {
    var d = DB.items[m], id = sid(m); if (DB.items[id]) return;
    var img = ''; try { img = getIconUrl(d); } catch (e) {}
    DB.items[id] = { n: '失去光輝的' + d.n + '碎片', type: 'etc', p: 0, c: 'text-slate-400', img: img, noUse: true, gachaWeight: 0,
      d: '光輝早已褪去的' + d.n + '殘片，只在席琳夢域鏡的深處找得到。收集 ' + PER + ' 個，帶著龍之鑽石 ' + DIA + ' 與席琳結晶 ' + CRY.toLocaleString() + ' 顆，請燃柳村的哈瑪大師重新熔鑄成 1 個' + d.n + '。' };
  });

  var cnt = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (s, i) { return s + (i && i.id === id && !i.lock ? Math.max(1, Math.floor(Number(i.cnt) || 1)) : 0); }, 0) : 0; };
  function take(id, k) {
    var p = P();
    for (var i = p.inv.length - 1; i >= 0 && k > 0; i--) {
      var it = p.inv[i]; if (!it || it.id !== id || it.lock) continue;
      var c = Math.max(1, Math.floor(Number(it.cnt) || 1)), u = Math.min(c, k);
      k -= u; if (c - u <= 0) p.inv.splice(i, 1); else it.cnt = c - u;
    }
    return k <= 0;
  }
  var diamonds = function () { try { return Math.max(0, Math.floor(Number(W.pandoraGetSharedDiamonds()) || 0)); } catch (e) { return 0; } };
  var adjustDia = function (v) { try { var r = W.pandoraAdjustSharedDiamonds(v) || {}; return !!r.ok; } catch (e) { return false; } };
  var saveOk = function () { try { return typeof saveGame === 'function' && saveGame() === true; } catch (e) { return false; } };

  // ── 兌換 ──
  function exchange(mat, times) {
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    if (MATS.indexOf(mat) < 0) return { ok: false, msg: '這種材料不能兌換。' };
    if (typeof state !== 'undefined' && state && state.ff) return { ok: false, msg: '補跑中，請稍候再試。' };
    var id = sid(mat), nm = DB.items[mat].n;
    times = Math.max(1, Math.floor(Number(times) || 1));
    times = Math.min(times, Math.floor(cnt(id) / PER), Math.floor(diamonds() / DIA), Math.floor(cnt(CRYSTAL) / CRY));
    if (times < 1) {
      var miss = [];
      if (cnt(id) < PER) miss.push(DB.items[id].n + ' ' + cnt(id) + '/' + PER);
      if (diamonds() < DIA) miss.push('龍之鑽石 ' + DIA);
      if (cnt(CRYSTAL) < CRY) miss.push('席琳結晶 ' + cnt(CRYSTAL) + '/' + CRY);
      return { ok: false, msg: '材料不足：' + miss.join('、') };
    }
    var snap = p.inv.slice(), cs = p.inv.map(function (x) { return x && x.cnt; });
    var undo = function () { p.inv = snap; snap.forEach(function (x, j) { if (x) x.cnt = cs[j]; }); };
    if (!adjustDia(-DIA * times)) return { ok: false, msg: '龍之鑽石不足。' };
    if (!take(id, PER * times) || !take(CRYSTAL, CRY * times)) { undo(); adjustDia(DIA * times); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
    gainItem(mat, times, true, true);
    if (!saveOk()) { undo(); adjustDia(DIA * times); try { saveGame(); } catch (e) {} return { ok: false, msg: '存檔失敗，什麼都沒有改變。' }; }
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    var msg = '哈瑪大師把 ' + (PER * times) + ' 個失去光輝的碎片重新熔鑄，得到 ' + nm + ' × ' + times + '。';
    sys('<span class="text-amber-200">' + esc(msg) + '</span>');
    return { ok: true, msg: msg, times: times };
  }

  // ── 掉落（席琳夢域鏡）──
  function rollOne() { return sid(MATS[Math.floor(Math.random() * MATS.length)]); }
  if (typeof W.killMob === 'function' && MATS.length) {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null;
      var r = oKill.apply(this, arguments);
      try {
        if (m && m._dead && !m._afkLostPaid && P()) {
          m._afkLostPaid = true;
          var dream = !!(m._dream || (player.sherineDream && player.sherineMad));
          if (dream && !(typeof state !== 'undefined' && state._afkFinal) && !(m.race === '建築' && m.noAutoTeleport) && !m._dreamStar) {   // 2026-10-31：傲慢之塔的樓梯／遺忘之島傳送門、暗夢星迴頭目不掉
            var k = m.boss ? BOSS_N : (Math.random() < NORMAL_RATE ? 1 : 0), got = {};
            for (var i = 0; i < k; i++) { var id = rollOne(); got[id] = (got[id] || 0) + 1; }
            Object.keys(got).forEach(function (id) { gainItem(id, got[id], true); });
            if (m.boss && k) sys('<span class="text-slate-300">' + esc(m.n) + ' 的殘骸裡散落著 ' + k + ' 片失去光輝的碎片。</span>');
          }
        }
      } catch (e) { console.warn('[AFK-lostshard] drop', e); }
      return r;
    };
  }

  // ── 哈瑪大師：兌換區 ──
  function panel() {
    var dia = diamonds(), cry = cnt(CRYSTAL), payOk = dia >= DIA && cry >= CRY;
    var ready = MATS.filter(function (m) { return cnt(sid(m)) >= PER; }).length, open = isOpen();
    var h = '<section id="afk-lost-panel" class="afk-lost' + (open ? '' : ' closed') + '">'
      + '<h3><span>失去光輝的碎片・重新熔鑄</span>' + (ready ? '<em class="afk-lost-ready">可熔鑄 ' + ready + ' 種</em>' : '') + '<button type="button" class="afk-lost-toggle" data-lost-toggle="1" aria-expanded="' + (open ? 'true' : 'false') + '">' + (open ? '收起 ▴' : '展開 ▾') + '</button></h3>'
      + '<div class="afk-lost-body">'
      + '<p class="afk-lost-rule">每次熔鑄：碎片 <b>' + PER + '</b> 個＋龍之鑽石 <b>' + DIA + '</b>＋席琳結晶 <b>' + CRY.toLocaleString() + '</b> 顆 → 該材料 1 個。碎片只在席琳夢域鏡掉落（一般怪物 1%、頭目必掉 ' + BOSS_N + ' 個）。</p>'
      + '<div class="afk-lost-bal"><span>龍之鑽石 <b' + (dia >= DIA ? '' : ' class="afk-lost-low"') + '>' + dia.toLocaleString() + '</b></span><span>席琳結晶 <b' + (cry >= CRY ? '' : ' class="afk-lost-low"') + '>' + cry.toLocaleString() + '</b></span></div>'
      + '<div class="afk-lost-grid">';
    MATS.forEach(function (m) {
      var n = cnt(sid(m)), can = n >= PER && payOk, pct = Math.min(100, Math.round(n / PER * 100)), times = Math.floor(n / PER);
      var all = Math.min(times, Math.floor(dia / DIA), Math.floor(cry / CRY));   // 一次全部熔鑄（受龍鑽、席琳結晶限制）
      h += '<div class="afk-lost-card' + (n >= PER ? ' ready' : '') + '">'
        + '<div class="afk-lost-nm">' + esc(DB.items[m].n) + '</div>'
        + '<div class="afk-lost-bar"><i style="width:' + pct + '%"></i></div>'
        + '<div class="afk-lost-cnt">碎片 <b>' + n.toLocaleString() + '</b> / ' + PER + (times ? '<em>可熔鑄 ' + times.toLocaleString() + ' 次</em>' : '') + '</div>'
        + '<div class="afk-lost-btns"><button type="button" class="btn" data-lost="' + m + '" data-n="1"' + (can ? '' : ' disabled') + '>熔鑄 1</button>'
        + '<button type="button" class="btn" data-lost="' + m + '" data-n="' + Math.max(2, all) + '"' + (all >= 2 ? '' : ' disabled') + '>全部熔鑄' + (all >= 2 ? ' ×' + all.toLocaleString() : '') + '</button></div></div>';
    });
    return h + '</div></div></section>';
  }
  // 展開／收起（玩家 2026-10-27：放在哈瑪大師最上面，加一顆小按鈕切換；記在這台瀏覽器）
  var OPEN_KEY = 'afk_lost_open';
  var isOpen = function () { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch (e) { return false; } };
  function draw() {
    var host = document.getElementById('interaction-content'); if (!host) return;
    var old = document.getElementById('afk-lost-panel'); var wrap = document.createElement('div'); wrap.innerHTML = panel();
    if (old) old.replaceWith(wrap.firstChild); else host.insertBefore(wrap.firstChild, host.firstChild);   // 放最上面
    var pn = document.getElementById('afk-lost-panel');
    pn.onclick = function (e) {
      if (e.target.closest('[data-lost-toggle]')) { try { localStorage.setItem(OPEN_KEY, isOpen() ? '0' : '1'); } catch (er) {} draw(); return; }
      var b = e.target.closest('[data-lost]'); if (!b || b.disabled) return;
      var mat = b.getAttribute('data-lost'), n = Number(b.getAttribute('data-n')) || 1;
      var go = function () { var r = exchange(mat, n); if (!r.ok) sys('<span class="text-red-400">' + esc(r.msg) + '</span>'); draw(); };
      if (n > 1 && W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '全部熔鑄', message: '熔鑄 ' + DB.items[mat].n + ' × ' + n + '\n消耗：碎片 ' + (PER * n).toLocaleString() + '、龍之鑽石 ' + (DIA * n).toLocaleString() + '、席琳結晶 ' + (CRY * n).toLocaleString() + '。', okText: '熔鑄', cancelText: '取消', onOk: go });
      else go();
    };
  }
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) { var r = oNpc.apply(this, arguments); if (npcId === 'npc_hama') { try { draw(); } catch (e) { console.warn('[AFK-lostshard] ui', e); } } return r; };
  }
  W.AFK_LOSTSHARD = { mats: MATS, shardId: sid, exchange: exchange, per: PER, dia: DIA, crystal: CRY, normalRate: NORMAL_RATE, bossN: BOSS_N, draw: draw };
  console.log('[AFK-lostshard] 已啟用：失去光輝的碎片 ' + MATS.length + ' 種（席琳夢域鏡掉落，哈瑪大師熔鑄）');
})();
