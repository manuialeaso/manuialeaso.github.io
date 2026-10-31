/* ============================================================================
 * afk-hotbar.js — 道具熱鍵列 F5～F8（玩家 2026-10-27 指定）
 *
 * ‧左欄最底下一塊天堂風格的熱鍵面板：四格，F5～F8
 * ‧任何背包裡的東西都能放：藥水、勇水、綠水、變形卷軸、卷軸、裝備……（每格記物品 id，疊放的數量會跟著顯示）
 * ‧點空格＝選要放什麼；點已放的格子＝使用（裝備類＝穿上／卸下切換）；右鍵或長按＝重新選擇；🔒 鎖住時不能改
 * ‧鍵盤 F5～F8 同樣觸發（打字中、按住 Ctrl／Alt 時不攔，瀏覽器的 Ctrl+F5 照常）
 * ‧每個角色各自記住（player._afkHotbar）
 * ‧魔法也能放（玩家 2026-10-30 22:21）：格子記 'sk:<技能 id>'，按下去＝施放（手動技能走 manualCast，其他走 castSkill，MP、冷卻照原本）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'hotbar', name: '道具熱鍵列 F5～F8', desc: '左欄最底下四格熱鍵，任何道具、裝備、魔法都能放，鍵盤 F5～F8 可用', group: '遊戲介面' });
  var on = function () { return !T || T.enabled('hotbar'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var KEYS = ['F5', 'F6', 'F7', 'F8'], N = 4;
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };

  // ── 樣式（原創的暗金屬框，仿天堂熱鍵列的排法）──
  var css = function () {
    if (document.getElementById('afk-hotbar-css')) return;
    var st = document.createElement('style'); st.id = 'afk-hotbar-css';
    st.textContent = [
      '#afk-hotbar{position:relative;border-radius:6px;padding:6px 8px 8px;background:linear-gradient(180deg,#2b2a30 0%,#1b1a1f 60%,#121115 100%);border:2px solid transparent;',
      'background-clip:padding-box;box-shadow:inset 0 0 0 1px rgba(0,0,0,.8),inset 0 1px rgba(220,177,116,.12),0 6px 14px rgba(0,0,0,.55);user-select:none}',
      '#afk-hotbar::before{content:"";position:absolute;inset:-2px;border-radius:7px;z-index:-1;background:linear-gradient(135deg,#6b4a2e,#95633f 25%,#3a2a22 50%,#8a5a3a 75%,#4a3024)}',
      '#afk-hotbar .hb-top{display:flex;align-items:center;justify-content:space-between;height:22px;margin-bottom:6px}',
      '#afk-hotbar .hb-emblem{width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#f1d9a8,#8a5a2a 55%,#3a2415);box-shadow:0 0 0 1px #000,inset 0 0 4px #000;position:relative}',
      '#afk-hotbar .hb-emblem::after{content:"";position:absolute;left:7px;top:7px;width:8px;height:8px;border-radius:50%;background:radial-gradient(circle at 40% 40%,#fff4,#7a1b1b 40%,#2a0606);box-shadow:0 0 4px #b91c1c}',
      '#afk-hotbar .hb-title{flex:1;text-align:center;font-size:12px;letter-spacing:2px;color:#d9c08c;text-shadow:1px 1px 0 #000}',
      '#afk-hotbar .hb-lock{width:22px;height:22px;border-radius:4px;border:1px solid #5b4632;background:linear-gradient(180deg,#3a3238,#1d1a1f);color:#cbb58a;font-size:12px;line-height:20px;text-align:center;cursor:pointer}',
      '#afk-hotbar .hb-moon{width:22px;height:22px;border-radius:4px;border:1px solid #5b4632;background:linear-gradient(180deg,#3a3238,#1d1a1f);font-size:12px;line-height:20px;text-align:center;cursor:pointer}',
      '#afk-hotbar .hb-lock.on{color:#f87171;border-color:#7f1d1d;box-shadow:0 0 6px #7f1d1d inset}',
      '#afk-hotbar .hb-row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}',
      '#afk-hotbar .hb-names{display:none}#afk-hotbar.hb-mobile{flex:0 0 auto;margin:0 2px}#afk-hotbar.hb-mobile .hb-row,#afk-hotbar.hb-mobile .hb-names{grid-template-columns:repeat(4,minmax(0,68px));justify-content:center;gap:10px 14px}',
      // 手機：熱鍵固定在下方導覽列上面、不被蓋住（玩家 2026-10-27：有非官方橫幅時名字被導覽列遮住）——戰鬥畫面讓出高度（最少 130px），熱鍵本身不縮
      '#col-center.hb-host{flex:1 1 0!important;min-height:0!important}#col-center.hb-host>#map-view-panel{flex:1 1 0!important;min-height:0!important}#col-center.hb-host #battle-view{flex:0 1 auto!important;min-height:130px!important}#afk-hotbar.hb-mobile .hb-top{height:18px;margin-bottom:3px}',
      // 手機橫拿（高度 ≤520px，玩家 2026-10-31 14:11：熱鍵面板蓋住地圖列和戰場）：熱鍵縮成一列——左邊月亮／鎖、右邊四格 40px，不顯示標題與名字
      '@media (orientation:landscape) and (max-height:520px){#afk-hotbar.hb-mobile{display:flex;align-items:center;justify-content:center;gap:10px;padding:3px 8px}#afk-hotbar.hb-mobile .hb-top{height:auto;margin:0;gap:4px;flex-direction:column}#afk-hotbar.hb-mobile .hb-title,#afk-hotbar.hb-mobile .hb-names{display:none!important}#afk-hotbar.hb-mobile .hb-row{grid-template-columns:repeat(4,40px);gap:8px}#col-center.hb-host #battle-view{min-height:110px!important}}',
      '#afk-hotbar.hb-mobile .hb-names{display:grid;margin-top:4px}#afk-hotbar.hb-mobile .hb-names span{font-size:11px;line-height:1.25;color:#cbb58a;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:1px 1px 0 #000}',
      '#afk-hotbar .hb-slot{position:relative;aspect-ratio:1/1;border-radius:4px;background:linear-gradient(180deg,#141318,#0b0a0d);border:1px solid #3b3238;box-shadow:inset 0 0 0 1px #000,inset 0 2px 6px rgba(0,0,0,.9);cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center}',
      '#afk-hotbar .hb-slot:hover{border-color:#a67c52}',
      '#afk-hotbar .hb-slot.empty .hb-key{position:static;font-size:16px;color:#4b4650;text-shadow:none}',
      '#afk-hotbar .hb-slot img{width:72%;height:72%;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 1px 1px #000)}',
      '#afk-hotbar .hb-slot.none img{filter:grayscale(1) brightness(.4)}',
      '#afk-hotbar .hb-slot.worn{box-shadow:inset 0 0 0 1px #000,inset 0 0 0 2px #22c55e66}',
      '#afk-hotbar .hb-key{position:absolute;left:3px;top:1px;font-size:10px;color:#cbb58a;text-shadow:1px 1px 0 #000;font-weight:700}',
      '#afk-hotbar .hb-cnt{position:absolute;right:3px;bottom:1px;font-size:11px;color:#fde68a;text-shadow:1px 1px 0 #000;font-weight:700}',
      '#afk-hotbar .hb-slot.flash{animation:afkHbFlash .25s}',
      '@keyframes afkHbFlash{0%{box-shadow:inset 0 0 0 2px #fde68a}100%{box-shadow:inset 0 0 0 1px #000}}',
      '#afk-hotbar-pick{position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:9900;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:12px}',
      '#afk-hotbar-pick .box{width:min(560px,100%);max-height:min(calc((100dvh - var(--orig-bar-h,0px)) * .85),640px);display:flex;flex-direction:column;background:#1b1a1f;border:1px solid #805839;border-radius:8px;box-shadow:0 10px 30px #000}',
      '#afk-hotbar-pick .hd{padding:10px 14px;border-bottom:1px solid #805839;font-weight:700;color:#ddd8d2;display:flex;align-items:center;gap:8px}',
      '#afk-hotbar-pick .hd input{flex:1;background:#0f0e12;border:1px solid #3b3238;border-radius:4px;color:#e5e7eb;padding:4px 8px;font-size:13px}',
      '#afk-hotbar-pick .ls{overflow:auto;padding:6px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}',
      '#afk-hotbar-pick .it{display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid #3b3238;border-radius:4px;background:#121115;cursor:pointer;font-size:12px;color:#e5e7eb;min-width:0}',
      '#afk-hotbar-pick .it:hover{border-color:#a67c52;background:#1f1b22}',
      '#afk-hotbar-pick .it img{width:28px;height:28px;object-fit:contain;image-rendering:pixelated;flex:none}',
      '#afk-hotbar-pick .it span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#afk-hotbar-pick .grp{grid-column:1/-1;font-size:12px;color:#d9c08c;padding:4px 2px 0;border-bottom:1px solid #3b3238}',
      '#afk-hotbar-pick .ft{padding:8px 14px;border-top:1px solid #805839;display:flex;gap:8px;justify-content:flex-end}',
      '#afk-hotbar-pick .ft button{padding:4px 12px;border-radius:4px;border:1px solid #805839;background:#2b2a30;color:#ddd8d2;cursor:pointer}'
    ].join('\n');
    document.head.appendChild(st);
  };

  // ── 資料 ──
  var bar = function () { var p = P(); if (!p) return null; if (!Array.isArray(p._afkHotbar) || p._afkHotbar.length !== N) p._afkHotbar = [null, null, null, null]; return p._afkHotbar; };
  var locked = function () { var p = P(); return !!(p && p._afkHotbarLock); };
  var findInv = function (id) { var p = P(); if (!p) return null; var list = (p.inv || []).filter(function (i) { return i && i.id === id; }); if (!list.length) return null; list.sort(function (a, b) { return (b.cnt || 1) - (a.cnt || 1); }); return list[0]; };
  var countOf = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (s, i) { return s + ((i && i.id === id) ? (i.cnt || 1) : 0); }, 0) : 0; };
  var wornSlot = function (id) { var p = P(); if (!p || !p.eq) return null; for (var k in p.eq) if (p.eq[k] && p.eq[k].id === id) return k; return null; };
  var isEquip = function (d) { return !!d && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc'); };
  var skOf = function (id) { return (typeof id === 'string' && id.indexOf('sk:') === 0) ? (DB.skills[id.slice(3)] || null) : null; };
  var learned = function (skId) { var p = P(); return !!(p && (p.skills || []).indexOf(skId) >= 0); };
  var skIcon = function (sk) { try { return getIconUrl(sk, true); } catch (e) { return ''; } };
  var castable = function (id) { var sk = DB.skills[id]; return !!(sk && sk.type !== 'passive' && !sk.passive && sk.n); };

  // ── 觸發 ──
  var fire = function (i) {
    if (!on()) return;
    var p = P(), b = bar(); if (!p || !b) return;
    var id = b[i]; if (!id) { pick(i); return; }
    var sk = skOf(id);
    if (sk) {   // 魔法
      var skId = id.slice(3);
      if (!learned(skId)) { sys('<span class="text-slate-400">還沒學會 ' + esc(sk.n) + '。</span>'); return; }
      var el0 = document.querySelector('#afk-hotbar .hb-slot[data-i="' + i + '"]'); if (el0) { el0.classList.remove('flash'); void el0.offsetWidth; el0.classList.add('flash'); }
      try { if (sk.type === 'manual') manualCast(skId); else if (typeof castSkill === 'function' && !castSkill(skId)) sys('<span class="text-slate-400">' + esc(sk.n) + ' 現在無法施放（MP、冷卻或目標）。</span>'); } catch (e) { console.warn('[AFK-hotbar]', e); }
      try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
      schedule(); return;
    }
    var d = DB.items[id]; if (!d) { b[i] = null; render(); return; }
    var el = document.querySelector('#afk-hotbar .hb-slot[data-i="' + i + '"]'); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    if (isEquip(d)) {
      var ws = wornSlot(id);
      if (ws) { try { unequipItem(ws); } catch (e) {} }
      else { var it = findInv(id); if (!it) { sys('<span class="text-slate-400">背包裡沒有 ' + esc(d.n) + '。</span>'); return; } try { equipItem(it); } catch (e) {} }
      try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    } else {
      var it2 = findInv(id); if (!it2) { sys('<span class="text-slate-400">背包裡沒有 ' + esc(d.n) + '。</span>'); return; }
      try { useItem(it2.uid, false, true); } catch (e) { console.warn('[AFK-hotbar]', e); }
    }
    schedule();
  };

  // ── 選擇要放什麼 ──
  var layer = null;
  var closePick = function () { var m = document.getElementById('afk-hotbar-pick'); if (m) m.remove(); if (layer && W.AFK_UI && AFK_UI.closeLayer) { var l = layer; layer = null; try { AFK_UI.closeLayer(l); } catch (e) {} } layer = null; };
  var groupOf = function (d) { if (d.type === 'wpn') return '武器'; if (d.type === 'arm') return '防具'; if (d.type === 'acc') return '飾品'; if (d.type === 'pot') return '藥水'; if (d.type === 'scroll') return '卷軸'; if (d.type === 'skillbk') return '技能書'; return '道具'; };
  var ORDER = ['魔法', '藥水', '卷軸', '道具', '武器', '防具', '飾品', '技能書'];
  var pick = function (i) {
    if (locked()) { sys('<span class="text-amber-300">熱鍵列已鎖住，先解鎖再改。</span>'); return; }
    var p = P(); if (!p) return; css(); closePick();
    var m = document.createElement('div'); m.id = 'afk-hotbar-pick';
    m.innerHTML = '<div class="box"><div class="hd">F' + (5 + i) + ' 要放什麼？<input type="text" placeholder="輸入名稱篩選"></div><div class="ls"></div><div class="ft"><button type="button" data-clear="1">清空這格</button><button type="button" data-close="1">取消</button></div></div>';
    document.body.appendChild(m);
    var ls = m.querySelector('.ls'), inp = m.querySelector('input');
    var build = function (q) {
      q = (q || '').trim().toLowerCase();
      var seen = {}, rows = [];
      (p.inv || []).forEach(function (it) { if (!it || !it.id || seen[it.id]) return; var d = DB.items[it.id]; if (!d) return; seen[it.id] = 1; if (q && String(d.n).toLowerCase().indexOf(q) < 0) return; rows.push({ id: it.id, d: d, g: groupOf(d), cnt: countOf(it.id) }); });
      if (p.eq) Object.keys(p.eq).forEach(function (k) { var it = p.eq[k]; if (!it || !it.id || seen[it.id]) return; var d = DB.items[it.id]; if (!d) return; seen[it.id] = 1; if (q && String(d.n).toLowerCase().indexOf(q) < 0) return; rows.push({ id: it.id, d: d, g: groupOf(d), cnt: 0, worn: true }); });
      (p.skills || []).forEach(function (sid) { if (!castable(sid)) return; var sk = DB.skills[sid]; if (q && String(sk.n).toLowerCase().indexOf(q) < 0) return; rows.push({ id: 'sk:' + sid, d: sk, g: '魔法', sk: true }); });
      rows.sort(function (a, b) { return (ORDER.indexOf(a.g) - ORDER.indexOf(b.g)) || String(a.d.n).localeCompare(String(b.d.n), 'zh-Hant'); });
      var h = '', last = null;
      rows.forEach(function (r) {
        if (r.g !== last) { last = r.g; h += '<div class="grp">' + r.g + '</div>'; }
        h += '<div class="it" data-id="' + esc(r.id) + '" title="' + esc(r.d.n) + '"><img src="' + esc(r.sk ? skIcon(r.d) : getIconUrl(r.d)) + '" alt="" onerror="this.style.visibility=\'hidden\'"><span>' + esc(r.d.n) + (r.worn ? '（裝備中）' : (r.cnt > 1 ? ' ×' + r.cnt : '')) + '</span></div>';
      });
      ls.innerHTML = h || '<div class="grp">背包裡沒有東西</div>';
    };
    build('');
    inp.addEventListener('input', function () { build(inp.value); });
    m.addEventListener('click', function (ev) {
      if (ev.target === m || ev.target.closest('[data-close]')) { closePick(); return; }
      if (ev.target.closest('[data-clear]')) { bar()[i] = null; closePick(); render(); save(); return; }
      var it = ev.target.closest('.it'); if (!it) return;
      var id = it.getAttribute('data-id'); var b = bar();
      for (var k = 0; k < N; k++) if (k !== i && b[k] === id) b[k] = null;   // 同一樣東西只放一格
      b[i] = id; closePick(); render(); save();
      sys('<span class="text-emerald-300">F' + (5 + i) + ' 設為 ' + esc((skOf(id) || DB.items[id] || {}).n || id) + '。</span>');
    });
    layer = (W.AFK_UI && AFK_UI.openLayer) ? AFK_UI.openLayer(closePick) : null;
    try { inp.focus(); } catch (e) {}
  };
  var save = function () { try { if (typeof saveGame === 'function') saveGame(); } catch (e) {} };

  // ── 畫面 ──
  var MQ = '(max-width: 768px), (max-height: 520px) and (pointer: coarse)';
  var mobileGeom = function () { try { return document.body.classList.contains('m-mobile') && W.matchMedia(MQ).matches; } catch (e) { return false; } };
  var lastHtml = '';
  var render = function () {
    var host = document.getElementById('afk-hotbar'); var p = P();
    if (!on() || !p) { if (host) host.style.display = 'none'; return; }
    if (!host) {
      var col = document.getElementById('col-left'); if (!col) return; css();
      host = document.createElement('div'); host.id = 'afk-hotbar'; col.appendChild(host);
      host.addEventListener('click', function (ev) {
        if (ev.target.closest('.hb-lock')) { var cp = P(); if (!cp) return; cp._afkHotbarLock = !cp._afkHotbarLock; render(); save(); return; }   // 用「現在」的角色（玩家 2026-10-27：換角色後鎖頭按了沒反應＝改到上一個角色身上）
        var s = ev.target.closest('.hb-slot'); if (!s) return; fire(Number(s.getAttribute('data-i')));
      });
      host.addEventListener('contextmenu', function (ev) { var s = ev.target.closest('.hb-slot'); if (!s) return; ev.preventDefault(); pick(Number(s.getAttribute('data-i'))); });
      var pressT = null, pressI = -1;
      host.addEventListener('touchstart', function (ev) { var s = ev.target.closest('.hb-slot'); if (!s) return; pressI = Number(s.getAttribute('data-i')); pressT = setTimeout(function () { pressT = null; pick(pressI); }, 550); }, { passive: true });
      ['touchend', 'touchmove', 'touchcancel'].forEach(function (t) { host.addEventListener(t, function () { if (pressT) { clearTimeout(pressT); pressT = null; } }, { passive: true }); });
    }
    host.style.display = '';
    // 手機（玩家 2026-10-27）：放到戰鬥畫面正下方那塊空白，戰鬥時一眼看到藥水等道具還剩多少；桌機照舊在左欄最底下
    var want = mobileGeom() ? document.getElementById('col-center') : document.getElementById('col-left');
    if (want && host.parentElement !== want) { want.appendChild(host); host.classList.toggle('hb-mobile', want.id === 'col-center'); }
    try { var cc = document.getElementById('col-center'); if (cc) cc.classList.toggle('hb-host', host.parentElement === cc); } catch (e) {}
    var b = bar(), lk = locked();
    var h = '<div class="hb-top">' + (W.AFK_SCREEN ? '<div class="hb-moon" title="掛機模式：螢幕常亮＋全黑省電畫面，遊戲照常 100% 戰鬥（點兩下螢幕回來）" onclick="window.AFK_SCREEN&&AFK_SCREEN.start()">🌙</div>' : '<div style="width:22px"></div>') + '<div class="hb-title">熱 鍵</div><div class="hb-lock' + (lk ? ' on' : '') + '" title="' + (lk ? '已鎖住：熱鍵照常可以按，但不能換內容（右鍵／長按無效）。點一下解鎖，沒有其他條件。' : '未鎖：右鍵或長按格子可以換內容。點一下鎖住，避免誤改。') + '">' + (lk ? '🔒' : '🔓') + '</div></div><div class="hb-row">';
    for (var i = 0; i < N; i++) {
      var id = b[i], skd = skOf(id);
      if (skd) {
        var lr = learned(id.slice(3)), mpc = 0; try { mpc = P().d && P().d.getMpCost ? P().d.getMpCost(skd.mp || 0, skd.tier) : (skd.mp || 0); } catch (e) { mpc = skd.mp || 0; }
        h += '<div class="hb-slot' + (lr ? '' : ' none') + '" data-i="' + i + '" title="' + esc(skd.n) + '（魔法' + (mpc ? '，MP ' + mpc : '') + '）"><span class="hb-key">F' + (5 + i) + '</span><img src="' + esc(skIcon(skd)) + '" alt="" onerror="this.style.visibility=\'hidden\'">' + (mpc ? '<span class="hb-cnt">' + mpc + '</span>' : '') + '</div>';
        continue;
      }
      var d = id ? DB.items[id] : null;
      if (!d) { h += '<div class="hb-slot empty" data-i="' + i + '" title="點一下放東西"><span class="hb-key">F' + (5 + i) + '</span></div>'; continue; }
      var cnt = countOf(id), ws = wornSlot(id), none = !cnt && !ws;
      h += '<div class="hb-slot' + (none ? ' none' : '') + (ws ? ' worn' : '') + '" data-i="' + i + '" title="' + esc(d.n) + (ws ? '（裝備中，按一下卸下）' : (isEquip(d) ? '（按一下裝備）' : '')) + '"><span class="hb-key">F' + (5 + i) + '</span><img src="' + esc(getIconUrl(d)) + '" alt="" onerror="this.style.visibility=\'hidden\'">' + (isEquip(d) ? '' : '<span class="hb-cnt">' + cnt + '</span>') + '</div>';
    }
    h += '</div><div class="hb-names">' + b.map(function (id) { var dd = id && (skOf(id) || DB.items[id]); return '<span>' + (dd ? esc(dd.n) : '') + '</span>'; }).join('') + '</div>';
    if (h !== lastHtml) { host.innerHTML = h; lastHtml = h; }
  };
  var pending = false;
  var schedule = function () { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; try { render(); } catch (e) {} }); };
  ['renderTabs', 'updateUI', 'loadGame'].forEach(function (fn) { var o = W[fn]; if (typeof o !== 'function') return; W[fn] = function () { var r = o.apply(this, arguments); schedule(); return r; }; });

  // ── 鍵盤 ──
  document.addEventListener('keydown', function (e) {
    if (!on()) return;
    var i = KEYS.indexOf(e.key); if (i < 0) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var gs = document.getElementById('game-screen'); if (!gs || gs.classList.contains('hidden') || !P()) return;
    var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    e.preventDefault(); fire(i);
  }, true);

  W.addEventListener('resize', schedule);
  W.AFK_HOTBAR = { fire: fire, pick: pick, render: render, bar: bar };
  schedule();
  console.log('[AFK-hotbar] 已啟用：道具熱鍵列 F5～F8');
})();
