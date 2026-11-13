/* ============================================================================
 * afk-antisl.js — 防 SL（存檔→試→讀回）與帳號血盟編號（Ping 11-12 10:23、10:32；設計稿 anticheat-design 第十六節）
 *
 *   一、結果先定好：玩家「點按鈕」那一刻用到的亂數，改成 角色種子＋動作種類＋第幾次 算出來（p._fate 記次數）。
 *       讀回舊檔再按一次，結果一模一樣；按完只要用到亂數，立刻存檔再顯示結果（先存檔再揭曉）。
 *   二、讀舊檔＝重：規則在 merged/integrity-core.js（存檔序號 p._saveSeq，js/13 每次存檔 +1）。
 *   三、女神挑戰紀錄點：進女神戰前存一份；打輸可以「回到挑戰前」，打贏作廢，中斷下次進角色時可回。
 *   四、道具身分證：遺物、次元遺物、至高的支配、GM 道具同一個編號同時出現在兩處 → 複本標記 afkDup（merged/anticheat 封印）。
 *   五、帳號血盟編號：每個瀏覽器固定一個；每次存檔把這台裝置帳本的摘要寫進 p._acct，匯入時由 integrity-core 合併。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return typeof state !== 'undefined' ? state : null; };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var slotKey = function (n) { return 'lineage_idle_save_' + n; };
  var IC = function () { return W.LineageIntegrityCore; };
  var ident = function (p) { try { var q = Object.assign({}, p); q.enSeed = IC().seed(p); return IC().identity(q); } catch (e) { return ''; } };
  var rnd = function (n) { var a = new Uint8Array(n), s = ''; try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < n; i++) a[i] = (Date.now() * (i + 7)) & 255; } for (var j = 0; j < n; j++) s += 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.charAt(a[j] % 32); return s; };
  var decodeP = function (raw) { try { var v = W.LineageSaveBridge.decode(raw).value; return v && v.p ? v.p : null; } catch (e) { return null; } };

  // ── 五、帳號血盟編號＋帳本摘要 ──
  var ACC = 'lineage_account_v1';
  var account = function () {
    var a = null; try { a = JSON.parse(localStorage.getItem(ACC) || 'null'); } catch (e) {}
    if (!a || typeof a.id !== 'string' || !/^C[A-Z0-9]{8}$/.test(a.id)) { a = { id: 'C' + rnd(8), at: Date.now() }; try { localStorage.setItem(ACC, JSON.stringify(a)); } catch (e) {} }
    return a;
  };
  W.__afkAccount = { id: function () { return account().id; } };
  var mirror = null;
  var refresh = function () { try { if (W.LineageIntegrityStore) W.LineageIntegrityStore.read().then(function (s) { mirror = s && s.ledger; }).catch(function () {}); } catch (e) {} };
  refresh(); setInterval(refresh, 30000);
  var stampAcct = function (p) {
    if (!p || !mirror) return;
    var seq = {}, n = 0;
    if (mirror.seq) Object.keys(mirror.seq).forEach(function (k) { if (n < 300) { seq[k] = Number(mirror.seq[k]) || 0; n++; } });
    p._acct = { id: account().id, seq: seq, retired: Object.keys(mirror.retired || {}).slice(0, 300) };
  };

  // 共用資料（倉庫、寵物、龍鑽、血盟、魂魄簿、收集冊）的變動紀錄：合併還原時判斷哪一邊比較新（merged/save-gate LineageSharedChain）
  var chainAt = 0, chainTimer = null;
  var chainNow = function () { if (!P()) return; chainAt = Date.now(); try { if (W.LineageSharedChain) W.LineageSharedChain.record(); } catch (e) {} };   // 只在遊戲中記（選角畫面不寫任何東西）
  // 存檔很頻繁（倉庫批次搬移每件都存一次）→ 最多 5 秒算一次，最後一次一定會算到
  var chainRec = function () { if (Date.now() - chainAt >= 5000) { chainNow(); return; } if (!chainTimer) chainTimer = setTimeout(function () { chainTimer = null; chainNow(); }, 5000); };
  setTimeout(chainNow, 3000); setInterval(chainRec, 30000);
  // 合併還原之後：告訴玩家哪幾格換了、哪幾格保留
  try {
    var mr = sessionStorage.getItem('lineage_merge_report');
    if (mr) {
      sessionStorage.removeItem('lineage_merge_report');
      var R0 = JSON.parse(mr), lines = [];
      if (R0.replaced.length) lines.push('換成備份：' + R0.replaced.join('、'));
      if (R0.kept.length) lines.push('保留這台：' + R0.kept.join('、'));
      if (R0.added.length) lines.push('新加入：' + R0.added.join('、'));
      if (R0.skipped.length) lines.push('略過：' + R0.skipped.join('、'));
      var SN = { backup: '用備份的（備份是接著這台動下去的）', same: '兩邊一樣', 'device-newer': '保留這台的（這台比較新）', both: '兩台都有變動，你選了保留這台的', 'both-backup': '兩台都有變動，你選了用備份的' };
      var sh = R0.shared && typeof R0.shared === 'object' ? R0.shared : {};
      Object.keys(sh).forEach(function (k) { lines.push(k + '：' + (SN[sh[k]] || '保留這台的')); });
      if (R0.mode === 'replace') lines.push('倉庫、寵物、血盟、收集冊等共用資料：全部換成備份的'); else lines.push('收集冊：兩邊合起來');
      setTimeout(function () { var msg = '合併還原完成\n\n' + lines.join('\n'); if (W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '合併還原完成', message: lines.join('\n'), okText: '知道了', cancelText: '關閉' }); else alert(msg); }, 2000);
    }
  } catch (e) {}

  // 存檔掛點：寫帳本摘要；回到挑戰前進行中不准存（避免把現在的進度又蓋回去）
  var restoring = false;
  if (typeof W.saveGame === 'function' && !W.saveGame.__afkAntiSL) {
    var oSave = W.saveGame;
    W.saveGame = function () {
      if (restoring) return false;
      try { stampAcct(P()); } catch (e) {}
      try {   // 11-13：每台裝置存到第幾次＋存檔時間（合併還原判斷哪一邊是接著玩下去的，merged/save-gate roleRel）
        var p0 = P(), LD = W.LineageDevice;
        if (p0 && LD) { var dm = (p0._devSeq && typeof p0._devSeq === 'object') ? p0._devSeq : (p0._devSeq = {}); dm[LD.id()] = (Number(p0._saveSeq) || 0) + 1; p0._savedAt = Date.now(); }
      } catch (e) {}
      chainRec();
      return oSave.apply(this, arguments);
    };
    W.saveGame.__afkAntiSL = true;
    try { (0, eval)('saveGame = window.saveGame'); } catch (e) {}
  }

  // ── 一、結果先定好（點按鈕那一刻的亂數）──
  var orig = Math.random, ctx = null;
  // 道具編號（uid）不需要、也不能跟著「結果先定好」：編號要每次都不一樣，避免讀回紀錄點後同一個編號出現第二次
  if (typeof W.uid === 'function' && !W.uid.__afkAntiSL) {
    W.uid = function () { var r = Math.random === fateRandom ? orig : Math.random; return r().toString(36).substr(2, 9); };
    W.uid.__afkAntiSL = true;
    try { (0, eval)('uid = window.uid'); } catch (e) {}
  }
  var sf = function (s) { try { if (typeof _seededFloat === 'function') return _seededFloat(s); } catch (e) {} return orig(); };
  var draw = function (key) {
    var p = P(); if (!p) return orig();
    var f = p._fate && typeof p._fate === 'object' ? p._fate : (p._fate = {});
    var n = f[key] | 0; f[key] = n + 1; ctx.used = true;
    return sf((p.enSeed || 'nseed') + '|fate|' + key + '|' + n);
  };
  var fateRandom = function () {
    if (ctx && (W.event === undefined || W.event === ctx.evt)) return draw(ctx.key);
    return ((ctx && ctx.prev) || orig).apply(Math, arguments);
  };
  // 動作種類：被點到的按鈕的 id、data-*、onclick（數字、像道具編號的亂碼去掉），沒有就用按鈕文字
  var norm = function (v) { return String(v || '').replace(/\b(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]{7,}\b/gi, '#').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim(); };
  var keyOf = function (t) {
    var el = t && t.closest ? t.closest('button,a,[onclick],[role="button"],input[type=button],input[type=submit],label') : null;
    if (!el) el = t && t.nodeType === 1 ? t : null;
    if (!el) return 'c|?';
    var parts = [el.tagName];
    if (el.id) parts.push('#' + norm(el.id));
    for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; if (/^data-|^onclick$/.test(a.name)) parts.push(a.name + '=' + norm(a.value)); }
    if (parts.length <= 2) parts.push('t=' + norm(el.textContent).slice(0, 16));
    return 'c|' + parts.join('|').slice(0, 96);
  };
  var onCap = function (e) {
    if (!e.isTrusted || !P()) return;
    var s = S(); if (!s || !s.running || s.ff) return;
    ctx = { evt: e, key: keyOf(e.target), used: false, prev: Math.random === fateRandom ? orig : Math.random };
    Math.random = fateRandom;
    setTimeout(function () { if (ctx && ctx.evt === e) end(); }, 0);
  };
  var end = function () {
    var c = ctx; ctx = null;
    if (Math.random === fateRandom) Math.random = (c && c.prev) || orig;
    return c;
  };
  var onBub = function (e) {
    if (!ctx || ctx.evt !== e) return;
    var c = end();
    if (c && c.used) { var s = S(); if (s && s.running && !s.ff) { try { W.saveGame(); } catch (er) {} } }   // 先存檔再揭曉
  };
  ['click', 'dblclick'].forEach(function (t) { W.addEventListener(t, onCap, true); W.addEventListener(t, onBub, false); });
  W.__afkClickFate = { keyOf: keyOf, active: function () { return !!ctx; }, draw: function (k) { var o = ctx; ctx = { key: k, used: false }; try { return draw(k); } finally { ctx = o; } } };

  // ── 三、女神挑戰紀錄點 ──
  var CK = 'lineage_goddess_ckpt_v1';
  var ckRead = function () { try { var m = JSON.parse(localStorage.getItem(CK) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; } };
  // 紀錄點的存檔本體放 IndexedDB（角色存檔可能很大，localStorage 放不下）；localStorage 只放摘要
  var IDBN = 'lineage-goddess-ckpt';
  var idb = function () { return new Promise(function (res, rej) { var r = indexedDB.open(IDBN, 1); r.onupgradeneeded = function () { r.result.createObjectStore('ckpt'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); };
  var idbOp = function (mode, fn) { return idb().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction('ckpt', mode), q = fn(t.objectStore('ckpt')), out; if (q) q.onsuccess = function () { out = q.result; }; t.oncomplete = function () { res(out); }; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error || Error('紀錄點寫入中止')); }; }); }); };
  var rawPut = function (k, v) { return idbOp('readwrite', function (st) { return st.put(v, k); }); };
  var rawGet = function (k) { return idbOp('readonly', function (st) { return st.get(k); }); };
  var rawDel = function (k) { return idbOp('readwrite', function (st) { return st.delete(k); }).catch(function () {}); };
  var ckWrite = function (m) { try { localStorage.setItem(CK, JSON.stringify(m)); return true; } catch (e) { sys('<span class="text-red-400">挑戰前紀錄點存不下（瀏覽器空間不足），這一場不能回到挑戰前。</span>'); return false; } };
  var FIGHTS = {
    first: { n: '最終決戰（一轉女神）', won: function (p) { var r = p.afkFinal; return !!(r && r.result === 'win' && !r.pending); } },
    second: { n: '二轉決戰', won: function (p) { var r = p.afkFinal2; return !!(r && r.result === 'win' && !r.pending); } },
    solo: { n: '單人試煉', won: function (p) { var r = p.afkFinal2 && p.afkFinal2.solo; return !!(r && r.result === 'win' && !r.pending); } },
    tier2: { n: '終焉第二階層', won: function (p) { return !!(p.afkFinalTier && p.afkFinalTier.t2 === 'win'); } },
    tier3: { n: '終焉第三階層', won: function (p) { return !!(p.afkFinalTier && p.afkFinalTier.t3 === 'win'); } }
  };
  var cand = null;
  var prep = function (fight) {
    var p = P(), s = S(); if (!p || !s || s._afkFinal) return;
    try { W.saveGame(); } catch (e) {}
    var raw = null; try { raw = localStorage.getItem(slotKey(currentSlot)); } catch (e) {}
    if (!raw) return;
    cand = { slot: currentSlot, fight: fight, at: Date.now(), raw: raw, seq: Number(p._saveSeq) || 0, ident: ident(p), name: p.name || '', rb: Number(p.rebirth) || 0 };
  };
  var wrapEnter = function (fn, fightOf) {
    var o = W[fn]; if (typeof o !== 'function' || o.__afkCk) return;
    W[fn] = function () { try { prep(fightOf.apply(null, arguments)); } catch (e) {} return o.apply(this, arguments); };
    W[fn].__afkCk = true;
  };
  var wrapAll = function () {
    wrapEnter('afkFinalEnter', function () { return 'first'; });
    wrapEnter('afkFinalEnter2', function () { return 'second'; });
    wrapEnter('afkFinalSolo', function () { return 'solo'; });
    wrapEnter('afkFinalTierEnter', function (t) { return Number(t) === 3 ? 'tier3' : 'tier2'; });
  };
  wrapAll(); W.addEventListener('load', wrapAll);
  // 進場那一刻（一轉、二轉、單人、終焉都會呼叫 enterOblivionMap(死亡之海)）就把紀錄點定下來
  var activate = function () {
    var s = S(); if (!cand || !s || cand.slot !== currentSlot) return;
    var c0 = cand; cand = null;
    var k = String(c0.slot), meta = { slot: c0.slot, fight: c0.fight, at: c0.at, seq: c0.seq, ident: c0.ident, name: c0.name, rb: c0.rb, active: true, bytes: c0.raw.length };
    var m = ckRead(); m[k] = meta; ckWrite(m);   // 摘要先寫（同步），本體寫 IndexedDB
    rawPut(k, c0.raw).then(function () { sys('<span class="text-sky-300">已存下「挑戰前紀錄點」：這一場' + FIGHTS[meta.fight].n + '打輸的話，可以回到進場前重新挑戰。</span>'); })
      .catch(function (e) { var m2 = ckRead(); delete m2[k]; ckWrite(m2); sys('<span class="text-red-400">挑戰前紀錄點存不下（' + (e && e.message || e) + '），這一場不能回到挑戰前。</span>'); });
  };
  var wrapOb = function () {
    var o = W.enterOblivionMap; if (typeof o !== 'function' || o.__afkCk) return;
    W.enterOblivionMap = function (map) { try { var FB = W.__afkFinalBoss; if (cand && FB && map === FB.MAP) activate(); } catch (e) {} return o.apply(this, arguments); };
    W.enterOblivionMap.__afkCk = true;
    try { (0, eval)('enterOblivionMap = window.enterOblivionMap'); } catch (e) {}
  };
  wrapOb(); W.addEventListener('load', wrapOb);

  var offered = {};
  var watch = function () {
    var p = P(), s = S(); if (!p || !s || typeof currentSlot === 'undefined') return;
    var m = ckRead(), k = String(currentSlot), ck = m[k];
    if (cand && Date.now() - cand.at > 10 * 60 * 1000) cand = null;
    if (!ck || !ck.active || s._afkFinal) return;
    if (ck.ident && ck.ident !== ident(p)) return;
    var F = FIGHTS[ck.fight]; if (!F) return;
    // Ping 11-12 21:10：挑戰完已經轉生（輸了也能轉生）→ 紀錄點一定要作廢，不然每次登入都問「回到挑戰前」，按下去會退回轉生前
    if (ck.rb == null) { rbOf(k, ck); return; }
    if ((Number(p.rebirth) || 0) > ck.rb) { delete m[k]; ckWrite(m); rawDel(k); sys('<span class="text-slate-400">你已經轉生，' + F.n + '的挑戰前紀錄點已作廢。</span>'); return; }
    if (F.won(p)) { delete m[k]; ckWrite(m); rawDel(k); sys('<span class="text-amber-300">打贏了！' + F.n + '的挑戰前紀錄點已作廢。</span>'); return; }
    if (!ck.lost) { ck.lost = Date.now(); ckWrite(m); }
    if (!offered[k]) { offered[k] = 1; offer(ck); }
  };
  // 舊的紀錄點沒記轉生次數：從紀錄點存檔本體讀出來補上（讀不到就當作 0 轉）
  var rbBusy = {};
  var rbOf = function (k, ck) {
    if (rbBusy[k]) return; rbBusy[k] = 1;
    rawGet(k).then(function (raw) {
      var rb = 0;
      try { var txt = String(raw || ''); if (txt.slice(0, 4) === 'LZ1:' && W.LZString) txt = LZString.decompressFromUTF16(txt.slice(4)); if (/^SIG\d:/.test(txt) && typeof _saveUnwrap === 'function') txt = _saveUnwrap(txt).payload; var o = JSON.parse(txt); var pl = o && (o.player || o); rb = Number(pl && pl.rebirth) || 0; } catch (e) { rb = 0; }
      var m = ckRead(); if (m[k]) { m[k].rb = rb; ckWrite(m); }
    }).catch(function () { var m = ckRead(); if (m[k]) { m[k].rb = 0; ckWrite(m); } }).then(function () { rbBusy[k] = 0; });
  };
  setInterval(watch, 700);
  var offer = function (ck) {
    var F = FIGHTS[ck.fight] || { n: '女神戰' };
    sys('<span class="text-fuchsia-300 font-bold">' + F.n + '沒有打贏。</span><button class="btn px-2 py-0.5 ml-1 bg-fuchsia-900 border-fuchsia-500 text-fuchsia-100 text-xs" onclick="__afkGoddessCkpt.restore()">回到挑戰前</button><button class="btn px-2 py-0.5 ml-1 bg-slate-800 border-slate-600 text-slate-300 text-xs" onclick="__afkGoddessCkpt.drop()">放棄紀錄點</button>');
    var msg = F.n + '沒有打贏。\n\n要回到挑戰前嗎？角色會回到進場前的樣子，可以重新挑戰；進場之後拿到的經驗、道具也會一起回到進場前。\n\n（之後也可以按系統訊息裡的「回到挑戰前」。）';
    if (W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '回到挑戰前', message: msg, okText: '回到挑戰前', cancelText: '先不要', onOk: restore });
  };
  var drop = function () {
    var m = ckRead(), k = String(currentSlot); if (!m[k]) return;
    if (!confirm('放棄這一場的挑戰前紀錄點？放棄後就不能回到挑戰前了。')) return;
    delete m[k]; ckWrite(m); rawDel(k); sys('<span class="text-slate-400">已放棄挑戰前紀錄點。</span>');
  };
  var busy = false;
  var restore = async function () {
    if (busy) return; var p = P(), s = S(); if (!p || !s) return;
    var m = ckRead(), k = String(currentSlot), ck = m[k];
    if (!ck) { alert('沒有可以回去的挑戰前紀錄點。'); return; }
    var raw = null; try { raw = await rawGet(k); } catch (e) {}
    if (!raw) { alert('挑戰前紀錄點的存檔不見了（瀏覽器資料可能被清掉），不能回到挑戰前。'); return; }
    if (s._afkFinal) { alert('戰鬥還在進行中，打完才能回到挑戰前。'); return; }
    if (ck.ident && ck.ident !== ident(p)) { alert('這個紀錄點不是目前這個角色的。'); return; }
    var F = FIGHTS[ck.fight]; if (F && F.won(p)) { delete m[k]; ckWrite(m); rawDel(k); alert('這一場已經打贏了，紀錄點已作廢。'); return; }
    var key = slotKey(currentSlot), slot = currentSlot;
    busy = true; restoring = true;
    try {
      s.running = false; try { if (typeof stopGameTimers === 'function') stopGameTimers(); } catch (e) {}
      var cur = localStorage.getItem(key);
      var change = { key: key, before: cur, after: raw, reason: 'GODDESS_CHECKPOINT' };
      var run = function () { return W.LineageRecovery.transact(localStorage, [change], function (snap) { return W.LineageBackups.save(Object.assign({}, snap, { slot: slot }), 'goddess-checkpoint'); }, { integrity: 'checkpoint', canWrite: function () { return true; } }); };
      await (navigator.locks ? navigator.locks.request('lineage-merged-save-write', { mode: 'exclusive' }, run) : run());
      var m2 = ckRead(); delete m2[k]; ckWrite(m2); await rawDel(k);
      try { sessionStorage.setItem('afk_autoreload_resume', JSON.stringify({ slot: slot, at: Date.now(), hours: 0, update: false })); } catch (e) {}
      try { sessionStorage.setItem('afk_ckpt_restored', String(slot)); } catch (e) {}
      location.reload();
    } catch (e) {
      restoring = false; busy = false;
      alert('回到挑戰前失敗：' + (e && e.message || e) + '\n\n遊戲沒有被修改，請重新整理後再試。');
    }
  };
  try { var rs = sessionStorage.getItem('afk_ckpt_restored'); if (rs) { sessionStorage.removeItem('afk_ckpt_restored'); setTimeout(function () { sys('<span class="text-sky-300 font-bold">已回到挑戰前，可以重新挑戰。</span>'); }, 4000); } } catch (e) {}
  W.__afkGoddessCkpt = { restore: restore, drop: drop, read: ckRead, FIGHTS: FIGHTS, cand: function () { return cand; }, watch: watch };

  // ── 四、道具身分證 ──
  var OWN = 'lineage_uid_owner_v1';
  var guarded = function (it) {
    var d = it && DB.items[it.id]; if (!d || !it.uid) return false;
    return !!(d.relic || d.relicBase || d.dimRelic || d.dimDragon != null || d.relicEvo != null || d.gmOnly || String(it.id) === '99999' || String(it.id) === '99998');
  };
  var itemsOf = function (p) { var out = []; (p.inv || []).forEach(function (it) { if (it) out.push(it); }); Object.keys(p.eq || {}).forEach(function (k) { if (p.eq[k] && typeof p.eq[k] === 'object') out.push(p.eq[k]); }); return out; };
  var scanUids = function () {
    var p = P(); if (!p || typeof DB === 'undefined') return null;
    var locs = {}, objs = {};
    var add = function (it, loc, live) { if (!guarded(it)) return; var L = locs[it.uid] || (locs[it.uid] = []); if (L.indexOf(loc) < 0) L.push(loc); if (live) (objs[it.uid] = objs[it.uid] || []).push({ loc: loc, it: it }); };
    var me = 'r:' + ident(p);
    itemsOf(p).forEach(function (it) { add(it, me, true); });
    for (var n = 1; n <= 40; n++) {
      if (n === Number(currentSlot)) continue;
      var raw = null; try { raw = localStorage.getItem(slotKey(n)); } catch (e) {}
      if (!raw) continue;
      var q = decodeP(raw); if (!q || !q.cls) continue;
      var loc = 'r:' + ident(q); if (loc === me) continue;
      itemsOf(q).forEach(function (it) { add(it, loc, false); });
    }
    var wh = null; try { wh = typeof loadWarehouse === 'function' ? loadWarehouse() : null; } catch (e) {}
    if (wh && Array.isArray(wh.items)) wh.items.forEach(function (it) { if (it) add(it, 'wh', true); });
    var own = {}; try { own = JSON.parse(localStorage.getItem(OWN) || '{}') || {}; } catch (e) {}
    var IMP = 'lineage_uid_imported_v1', imported = {}; try { imported = JSON.parse(localStorage.getItem(IMP) || '{}') || {}; } catch (e) {}
    var flagged = 0, whDirty = false;
    Object.keys(locs).forEach(function (uid) {
      var L = locs[uid];
      if (L.length === 1) { own[uid] = L[0]; return; }
      // 剛從別台搬進來（匯入、合併還原）的角色身上那件是正本：它是被帶過來的；這台倉庫裡留下的是舊複本
      var imp = L.filter(function (l) { return l.indexOf('r:') === 0 && imported[l.slice(2)]; })[0];
      var owner = imp || (L.indexOf(own[uid]) >= 0 ? own[uid] : (L.indexOf('wh') >= 0 ? 'wh' : L[0]));
      own[uid] = owner;
      (objs[uid] || []).forEach(function (o) { if (o.loc !== owner && !o.it.afkDup) { o.it.afkDup = true; flagged++; if (o.loc === 'wh') whDirty = true; } });
    });
    var keys = Object.keys(own); if (keys.length > 5000) keys.slice(0, keys.length - 5000).forEach(function (k) { delete own[k]; });
    try { localStorage.setItem(OWN, JSON.stringify(own)); } catch (e) {}
    try { localStorage.removeItem(IMP); } catch (e) {}   // 搬進來的優先只用在搬進來後的第一次掃描
    if (whDirty) { try { if (typeof saveWarehouse === 'function') saveWarehouse(wh); } catch (e) {} }
    if (flagged) { sys('<span class="text-red-400 font-bold">發現 ' + flagged + ' 件遺物同時出現在兩個地方（複製品），複本已封印。</span>'); try { W.saveGame(); } catch (e) {} }
    return { flagged: flagged, dup: Object.keys(locs).filter(function (u) { return locs[u].length > 1; }).length };
  };
  var lastScanSlot = null;
  setInterval(function () { var p = P(), s = S(); if (!p || !s || !s.running || s.ff) return; if (lastScanSlot !== currentSlot) { lastScanSlot = currentSlot; setTimeout(scanUids, 3000); } }, 2000);
  setInterval(function () { var s = S(); if (P() && s && s.running && !s.ff) scanUids(); }, 5 * 60 * 1000);
  W.__afkUidGuard = { scan: scanUids, guarded: guarded };
})();
