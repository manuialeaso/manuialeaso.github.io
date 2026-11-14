/* ============================================================================
 * afk-starroad.js — 副本「星途遠征」與「星辰藥水」（玩家 2026-11-02 18:08 提出、18:24 確認；外掛開關 starroad，預設開；經典模式沒有）
 *
 *   入口：席琳神殿的 NPC「喬斯達」。一般／瘋狂席琳／夢域鏡三個世界每天各 5 次（進場就算一次，每天 0 點重置；2026-11-04 改成分開算）。
 *   次元裂縫開著時是第四個世界「取回繁星之力」（11-13）：每天 1 次、血龍鑽 1,000（11-15 從 500 調高）；頭目吃 afk-dimrift 的裂縫倍率；通關 afkDimRift.stars +1（最多 3＝取回力量 15%）；星辰藥水上限 30。
 *   內容：10 波，每波 1 隻頭目，從「地監頭目＋地區霸主」裡隨機抽（照你的等級挑：等級 ±15 的地監頭目；地區霸主調到你的等級）。
 *         第 w 波 HP 與傷害 ×(1 ＋ 0.1 ×(w − 1))。時限 15 分鐘；你倒下、時間到或離開＝失敗。傭兵可以一起進。
 *   獎勵：打贏 10 波 → 星辰藥水 ×1；副本裡每隻頭目 1% 再掉 1 罐（頭目原本的掉落照舊）。
 *   星辰藥水：使用後得到 1 點升級點數（自己分配）。每個世界各自的使用上限：
 *     一般（含一般席琳）50 罐、瘋狂席琳 80 罐、席琳夢域鏡 110 罐（各自算，合計 240）。
 *     用掉的點數在回憶蠟燭重置配點時會一起算進可重配點數。
 *   跟原本的「純白的萬能藥」（做萬能藥的原料）是不同的道具。
 *   進場費（2026-11-03）：席琳夢域鏡龍鑽 10,000（11-15，其他世界 1,000）；一般世界（含一般席琳）每個角色前 30 次只收金幣 500 萬＋席琳結晶 100（player.afkStar.disc 計數）；之後與其他世界照 afk-diacost。
 *     材料背包不夠時從倉庫補（afk-matwh）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, L = W.__afkLore, K = W.__afkNpcKit;
  if (T && T.register) T.register({ id: 'starroad', name: '星途遠征（副本）與星辰藥水', group: '遊戲內容', seal: true,
    desc: '席琳神殿的喬斯達：三個世界每天各 5 次、10 波頭目的副本。通關得到星辰藥水（升級點數 +1；一般 50、瘋狂席琳 80、夢域鏡 110 罐，各自計算）' });
  if (T && !T.enabled('starroad')) return;
  if (!L || !K || typeof DB === 'undefined' || !DB.maps) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var esc = L.esc, sys = L.sys, clog = L.clog;
  var dayKey = function () { return Math.floor((Date.now() + 8 * 3600000) / 86400000); };
  var mobs = function () { return (typeof mapState !== 'undefined' && mapState.mobs) || []; };

  var CFG = { daily: 5, waves: 10, step: 0.10, dropRate: 0.01, timeMs: 15 * 60 * 1000, lvWin: 15, cap: { normal: 50, mad: 80, dream: 110, rift: 30 }, riftDaily: 1, riftBlood: 1000, dreamDia: 10000, starsMax: 3 };   // Ping 11-15：夢域鏡進場龍鑽 10,000、取回繁星之力血龍鑽 1,000   // Ping 11-13 17:07：次元裂縫世界「取回繁星之力」每天 1 次、通關取回力量 +5%（最多 3 次）、星辰藥水上限 30
  var WORLD_N = { normal: '一般', mad: '瘋狂席琳', dream: '席琳夢域鏡', rift: '次元裂縫' };
  var NPC_ID = 'npc_afk_josda', NPC_N = '喬斯達', NPC_T = '星途嚮導', TOWN = 'town_sherine';
  var MAP = 'afk_starroad', MAP_N = '星途遠征';
  var ITEM = 'afk_star_elixir';

  // ── 道具 ──
  L.addItem(ITEM, { n: '星辰藥水', type: 'misc', eff: 'afk_star_elixir', c: 'text-sky-200', img: 'assets/icons/items/afk_star_elixir.png', p: 0, noTrade: true, afkStarElixir: true,
    d: '星途遠征的盡頭凝結出的藥水，泛著星光的藍。喝下後得到 1 點升級點數，可以自由分配。每個世界能喝的數量不同：一般 ' + CFG.cap.normal + ' 罐、瘋狂席琳 ' + CFG.cap.mad + ' 罐、席琳夢域鏡 ' + CFG.cap.dream + ' 罐、次元裂縫 ' + CFG.cap.rift + ' 罐（各自計算）。' });

  // ── 存檔 ──
  var store = function (p) {
    p = p || P(); if (!p) return { day: 0, used: 0, clears: 0, runs: 0, pts: {} };
    if (!p.afkStar || typeof p.afkStar !== 'object') p.afkStar = { day: 0, used: 0, clears: 0, runs: 0, pts: {} };
    if (!p.afkStar.pts || typeof p.afkStar.pts !== 'object') p.afkStar.pts = {};
    if (p.afkStar.day !== dayKey()) { p.afkStar.day = dayKey(); p.afkStar.used = 0; p.afkStar.usedW = {}; }
    if (!p.afkStar.usedW || typeof p.afkStar.usedW !== 'object') p.afkStar.usedW = {};
    return p.afkStar;
  };
  // 每天 5 次，一般／瘋狂席琳／夢域鏡三個世界分開算（玩家 2026-11-04 11:41：一天最多 15 次）
  var usedToday = function (p) { p = p || P(); var s = store(p); return Number(s.usedW[worldOf(p)]) || 0; };
  var riftOn = function () { try { return !!(W.__afkDimRift && W.__afkDimRift.on()); } catch (e) { return false; } };
  var dailyOf = function (w) { return w === 'rift' ? CFG.riftDaily : CFG.daily; };
  var worldOf = function (p) { p = p || P(); if (!p) return 'normal'; if (riftOn()) return 'rift'; if (p.sherineDream && p.sherineMad) return 'dream'; if (p.sherineMad) return 'mad'; return 'normal'; };
  // 玩家 2026-11-02 19:23：面板上已經有兩項能力的基本值（出生＋配點＋萬能藥）到 200，星辰藥水就不再掉
  var STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  var natural = function (p, k) { return (Number((p.base || {})[k]) || 0) + (Number((p.alloc || {})[k]) || 0) + (Number((p.panacea || {})[k]) || 0); };
  var noDrop = function (p) { p = p || P(); if (!p) return false; return STATS.filter(function (k) { return natural(p, k) >= 200; }).length >= 2; };
  var ptsTotal = function (p) { var s = store(p).pts; return (Number(s.normal) || 0) + (Number(s.mad) || 0) + (Number(s.dream) || 0) + (Number(s.rift) || 0); };

  // ── 星辰藥水：+1 升級點數 ──
  var drink = function (it) {
    var p = P(); if (!p || !it) return false;
    if (p.classicMode) { sys('<span class="text-amber-300">經典模式不能使用。</span>'); return false; }
    var w = worldOf(p), s = store(p), used = Number(s.pts[w]) || 0;
    if (used >= CFG.cap[w]) { sys('<span class="text-amber-300">在' + WORLD_N[w] + '的世界已經喝滿 ' + CFG.cap[w] + ' 罐了。</span>'); return false; }
    if ((Number(it.cnt) || 1) > 1) it.cnt = (Number(it.cnt) || 1) - 1; else p.inv.splice(p.inv.indexOf(it), 1);
    s.pts[w] = used + 1; p.bonus = (Number(p.bonus) || 0) + 1;
    sys('<span class="text-sky-200 font-bold">你喝下星辰藥水，星光流進全身——升級點數 +1。</span>（' + WORLD_N[w] + '：' + s.pts[w] + '／' + CFG.cap[w] + '）');
    try { calcStats(); renderTabs(); updateUI(); saveGame(); } catch (e) {}
    return true;
  };
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (uid) {
      var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uid; });
      if (it && it.id === ITEM && !it.lock) { drink(it); try { var left = p.inv.find(function (x) { return x.uid === uid; }); if (left && typeof openModal === 'function') openModal(left, false); else if (typeof closeModal === 'function') closeModal(); } catch (e) {} return; }
      return oUse.apply(this, arguments);
    };
    try { (0, eval)('useItem = window.useItem'); } catch (e) {}
  }
  // 回憶蠟燭：可重配點數加上喝過的藥水
  if (typeof W.startRespec === 'function') {
    var oRs = W.startRespec;
    W.startRespec = function () {
      var r = oRs.apply(this, arguments);
      try { var n = ptsTotal(P()); if (n > 0) (0, eval)('if (_respec && !_respec.afkStar) { _respec.pts += ' + n + '; _respec.afkStar = true; }'); } catch (e) {}
      return r;
    };
    try { (0, eval)('startRespec = window.startRespec'); } catch (e) {}
  }

  // ── 頭目名單 ──
  var dungeonMaps = function () { try { return ((MAP_CATEGORIES || {}).dungeon || []).map(function (m) { return m.v; }); } catch (e) { return []; } };
  var DPOOL = null;
  var dungeonBosses = function () {
    if (DPOOL) return DPOOL;
    var seen = {}; DPOOL = [];
    dungeonMaps().forEach(function (v) { (DB.maps[v] || []).forEach(function (id) { var m = DB.mobs[id]; if (m && m.boss && !seen[id] && !m.afkTtmi && !m.questOnly) { seen[id] = 1; DPOOL.push(id); } }); });
    return DPOOL;
  };
  var REF = 65;
  var scaleRb = function (base, Lv) {   // 照 afk-region-boss 的公式
    var k = Lv / REF, m = JSON.parse(JSON.stringify(base));
    m.lv = Lv; m.hp = Math.max(1, Math.round(base.hp * Math.pow(k, 2.5)));
    if (Array.isArray(base.dmg)) m.dmg = [base.dmg[0], Math.max(2, Math.round(base.dmg[1] * k))];
    m.db = Math.max(0, Math.round((base.db || 0) * Math.pow(k, 1.3))); m.hit = Math.round((base.hit || 0) * k); m.ac = Math.round((base.ac || 0) * k); m.mr = Math.round((base.mr || 0) * k);
    ['mag', 'mag2'].forEach(function (f) { var s = m[f]; if (!s) return; if (Array.isArray(s.dmg)) { s.dmg = [s.dmg[0], Math.max(2, Math.round(s.dmg[1] * k))]; s.db = Math.round((s.db || 0) * Math.pow(k, 1.3)); } });
    return m;
  };
  var pickBoss = function (p) {
    var lv = Math.min(120, Math.max(18, Number(p.lv) || 1)), RB = W.__afkRegionBoss;
    var dl = dungeonBosses().filter(function (id) { var x = Number(DB.mobs[id].lv) || 1; return Math.abs(x - lv) <= CFG.lvWin; });
    if (dl.length < 4) dl = dungeonBosses().slice().sort(function (a, b) { return Math.abs((DB.mobs[a].lv || 1) - lv) - Math.abs((DB.mobs[b].lv || 1) - lv); }).slice(0, 6);
    var rl = RB && RB.LIST ? RB.LIST.map(function (b) { return b.id; }).filter(function (id) { return !!DB.mobs[id]; }) : [];
    var all = dl.map(function (id) { return { id: id, rb: false }; }).concat(rl.map(function (id) { return { id: id, rb: true }; }));
    if (!all.length) return null;
    var c = all[Math.floor(Math.random() * all.length)];
    return { id: c.id, base: c.rb ? scaleRb(DB.mobs[c.id], lv) : DB.mobs[c.id] };
  };

  // ── 地圖 ──
  DB.maps[MAP] = dungeonBosses().slice(0, 1);
  try { W.__afkNoOfflineMaps = (W.__afkNoOfflineMaps || []).concat([MAP]); } catch (e) {}
  try { SPECIAL_AREA_BG[MAP] = 'assets/area/地監深層.jpg'; } catch (e) {}
  try { if (typeof MAP_DESC !== 'undefined' && !MAP_DESC[MAP]) MAP_DESC[MAP] = '喬斯達打開的星之通道。十道星門後面，各站著一名從各地召來的頭目。'; } catch (e) {}
  try { if (typeof SANCTUARY_MAP_NAMES !== 'undefined') SANCTUARY_MAP_NAMES[MAP] = MAP_N; } catch (e) {}

  var run = null, lastMap = null, leaving = false;
  // 2026-11-03：一般世界（含一般席琳）每個角色前 DISC.n 次進場只收金幣 500 萬＋席琳結晶 100（不收龍鑽）；之後照原價
  var DISC = { n: 30, gold: 5000000, crystal: 100 };
  var discLeft = function (p) { p = p || P(); if (!p || worldOf(p) !== 'normal') return 0; return Math.max(0, DISC.n - (Number(store(p).disc) || 0)); };
  var costOf = function (p) {
    var DC = W.__afkDiaCost, noFee = !!W.__afkTestNoFee;
    if (worldOf(p) === 'rift') return { disc: false, dia: 0, gold: 0, crystal: 0, dream: 0, blood: noFee ? 0 : CFG.riftBlood };   // 裂縫裡的花費一律用血龍鑽
    if (discLeft(p) > 0) return { disc: true, dia: 0, gold: noFee ? 0 : DISC.gold, crystal: noFee ? 0 : DISC.crystal, dream: 0 };
    return { disc: false, dia: DC ? (worldOf(p) === 'dream' ? CFG.dreamDia : DC.COST.starroad) : 0, gold: 0, crystal: (DC && !noFee) ? DC.COST.starroadCrystal : 0, dream: (DC && !noFee && worldOf(p) === 'dream') ? DREAM_CRY : 0 };
  };
  var costTxt = function (c) {
    var DC = W.__afkDiaCost, a = [];
    if (c.dia && DC) a.push(DC.txt(c.dia));
    if (c.gold) a.push('金幣 ' + c.gold.toLocaleString());
    if (c.crystal) a.push('席琳結晶 ' + c.crystal.toLocaleString());
    if (c.dream) a.push('夢艷結晶 ' + c.dream.toLocaleString());
    if (c.blood) a.push('血龍鑽 ' + c.blood.toLocaleString());
    return a.join('＋') || '免費';
  };
  var canEnter = function () {
    var p = P(); if (!p) return '請先進入遊戲。';
    if (p.classicMode) return '經典模式沒有星途遠征。';
    var dl = dailyOf(worldOf(p)); if (usedToday(p) >= dl) return '在' + WORLD_N[worldOf(p)] + '的世界，今天的 ' + dl + ' 次已經用完，明天再來。';
    var DC = W.__afkDiaCost, c = costOf(p), miss = null;
    var add = function (t) { miss = (miss ? miss + '；' : '') + t; };
    if (c.dia && DC) miss = DC.check(c.dia);
    var g = Math.floor(Number(p.gold) || 0); if (c.gold && g < c.gold) add('金幣還差 ' + (c.gold - g).toLocaleString() + '（需要 ' + c.gold.toLocaleString() + '）');
    var cr = cnt('sherine_crystal'); if (cr < c.crystal) add('席琳結晶還差 ' + (c.crystal - cr).toLocaleString() + '（需要 ' + c.crystal.toLocaleString() + '）');
    var bh = cnt('afk_blood_dia'); if (bh < (c.blood || 0)) add('血龍鑽還差 ' + (c.blood - bh).toLocaleString() + '（需要 ' + c.blood.toLocaleString() + '）');
    var dh = cnt('afk_dream_crystal'); if (dh < c.dream) add('夢艷結晶還差 ' + (c.dream - dh).toLocaleString() + '（需要 ' + c.dream.toLocaleString() + '）');
    if (miss) return '進場要' + costTxt(c) + '：' + miss + '。';
    return null;
  };
  var DREAM_CRY = 1000;
  var MW = function () { var m = W.__afkMatWh; return m && m.on() ? m : null; };
  // 持有數＝背包＋倉庫（倉庫補足開關 matwh）；扣的時候背包不夠先從倉庫拿
  var cnt = function (id) { var m = MW(); if (m) return m.total(id); var p = P(); return p ? (p.inv || []).reduce(function (a, i) { return a + (i && i.id === id && !i.lock ? Math.max(1, Math.floor(Number(i.cnt) || 1)) : 0); }, 0) : 0; };
  var takeId = function (id, n) { if (!(n > 0)) return true; var m = MW(); if (m && !m.pull(id, n)) return false; var p = P(); for (var j = p.inv.length - 1; j >= 0 && n > 0; j--) { var it = p.inv[j]; if (!it || it.id !== id || it.lock) continue; var c = Math.max(1, Math.floor(Number(it.cnt) || 1)), u = Math.min(c, n); n -= u; if (c - u <= 0) p.inv.splice(j, 1); else it.cnt = c - u; } return n <= 0; };
  var crys = function () { return cnt('sherine_crystal'); };
  var matTxt = function (id) { var m = MW(); return m ? m.txt(id) : cnt(id).toLocaleString(); };
  var enter = function () {
    var p = P(), why = canEnter(); if (why) { sys('<span class="text-amber-300">' + esc(NPC_N) + '：' + esc(why) + '</span>'); return false; }
    if (typeof mercenaryRoleBattleBlocked === 'function' && mercenaryRoleBattleBlocked(MAP)) return false;
    try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
    try { if (typeof closeWarehouseWindow === 'function') closeWarehouseWindow(); } catch (e) {}
    try { if (typeof saveSiegeBossHp === 'function') saveSiegeBossHp(); } catch (e) {}
    var c = costOf(p), DCx = W.__afkDiaCost;
    if (!takeId('sherine_crystal', c.crystal) || !takeId('afk_dream_crystal', c.dream) || !takeId('afk_blood_dia', c.blood || 0)) { sys('<span class="text-amber-300">倉庫暫時無法取出材料，沒有進場。</span>'); return false; }
    if (c.dia && DCx && !DCx.pay(c.dia)) { if (c.crystal) gainItem('sherine_crystal', c.crystal, true, true); if (c.dream) gainItem('afk_dream_crystal', c.dream, true, true); sys('<span class="text-amber-300">龍之鑽石帳戶暫時無法寫入，沒有進場。</span>'); return false; }
    if (c.gold) p.gold = Math.max(0, Math.floor(Number(p.gold) || 0) - c.gold);
    if (c.disc) store(p).disc = (Number(store(p).disc) || 0) + 1;
    var s = store(p); s.runW = worldOf(p); s.used++; s.usedW[worldOf(p)] = (Number(s.usedW[worldOf(p)]) || 0) + 1; s.runs = (Number(s.runs) || 0) + 1;
    mapState.current = MAP; p.lastBattleMap = MAP;
    mapState.mobs = [null, null, null, null, null]; mapState.spawnAt = [null, null, null, null, null];
    mapState.targetIdx = -1; mapState.forceBoss = false;
    run = { wave: 1, pending: true, done: false, until: Date.now() + CFG.timeMs };
    s.run = run;   // 存進角色：換角色再回來、重新整理都接得上（玩家 2026-11-05「打星圖切去看其他角色，再回來就停住」）
    lastMap = MAP;
    sys('<span class="font-bold" style="color:#7dd3fc">喬斯達揮動星盤，你踏上了星之通道——第 1／' + CFG.waves + ' 道星門。（今天第 ' + usedToday(p) + '／' + dailyOf(worldOf(p)) + ' 次）</span>');
    try { if (typeof _vfxClearAll === 'function') _vfxClearAll(); } catch (e) {}
    try {
      var mapPanel = document.getElementById('town-view').parentElement;
      document.getElementById('battle-view').classList.remove('hidden');
      document.getElementById('combat-log-panel').classList.remove('hidden');
      document.getElementById('town-view').classList.add('hidden');
      document.getElementById('town-view').classList.remove('flex');
      mapPanel.classList.remove('flex-1', 'overflow-hidden');
    } catch (e) {}
    try { if (typeof applyAreaBackground === 'function') applyAreaBackground(); } catch (e) {}
    try { renderMobs(); syncMapSelectors(); updateUI(); renderTabs(true); saveGame(); } catch (e) {}
    return true;
  };
  var leave = function (msg) {
    var t0 = run; run = null;
    try { var ps = P(); if (ps && ps.afkStar) delete ps.afkStar.run; } catch (e) {}
    if (msg) sys(msg);
    setTimeout(function () { try { if (mapState.current === MAP && run === null) { setMapSelectors(TOWN); changeMap(true); try { saveGame(); } catch (e) {} } } catch (e) {} }, 1500);
    return t0;
  };
  var victory = function () {
    var p = P(), s = store(p);
    s.clears = (Number(s.clears) || 0) + 1;
    if (s.runW === 'rift') { var dr = p.afkDimRift || (p.afkDimRift = {}); if ((Number(dr.stars) || 0) < CFG.starsMax) { dr.stars = (Number(dr.stars) || 0) + 1; sys('<span class="font-bold" style="color:#f0abfc">✨ 取回繁星之力（' + dr.stars + '／' + CFG.starsMax + '）：星光回到你身上，次元裂縫裡的取回力量 +5%。</span>'); try { calcStats(); } catch (e) {} } }
    if (noDrop(p)) { leave('<span class="text-yellow-300 font-bold">🏆 第 ' + CFG.waves + ' 道星門關上了。</span>喬斯達看了看你：「你的身體已經裝不下更多星光了。」（兩項能力的基本值已經到 200，不再給星辰藥水）'); return; }
    gainItem(ITEM, 1, true, true);
    leave('<span class="text-yellow-300 font-bold">🏆 第 ' + CFG.waves + ' 道星門關上了。喬斯達的星盤亮起：你得到星辰藥水 ×1。</span>');
  };

  // ── 出怪：一次一隻頭目（中間那格）──
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      if (mapState.current === MAP) {
        var keep = function () { if (!mapState.mobs[idx] || mapState.mobs[idx]._dead) mapState.mobs[idx] = null; };
        if (!run || run.done || !run.pending || idx !== 1) return keep();
        var p = P(), pk = p && pickBoss(p); if (!pk) return keep();
        var m = L.boss.place(idx, pk.base, { mobId: pk.id, _starRun: true, _starWave: run.wave, noAutoTeleport: true, noCharm: true });   // 勾「迴避頭目」不會用瞬移卷軸把星門頭目甩掉（甩掉就等不到下一道門）
        var mult = 1 + CFG.step * (run.wave - 1);
        m.hp = Math.max(1, Math.round(m.hp * mult)); m.curHp = m.hp;
        if (Array.isArray(m.dmg)) m.dmg = [m.dmg[0], Math.max(2, Math.round(m.dmg[1] * mult))];
        m.db = Math.round((Number(m.db) || 0) * mult);
        run.pending = false;
        clog('<span class="font-bold" style="color:#7dd3fc">【星門 ' + run.wave + '／' + CFG.waves + '】</span>' + esc(m.n) + ' 從星門裡走了出來。', 'enemy');
        try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(m); } catch (e) {}
        try { if (!S().ff) renderMobs(); } catch (e) {}
        return;
      }
      return oSpawn.apply(this, arguments);
    };
  }
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mobs()[idx];
      var r = oKill.apply(this, arguments);
      try {
        if (m && m._dead && m._starRun && !m._starDone && run && mapState.current === MAP) {
          m._starDone = true;
          if (!noDrop() && Math.random() < CFG.dropRate) { gainItem(ITEM, 1, true, true); sys('<span class="text-sky-200 font-bold">' + esc(m.n) + ' 身上掉出了星辰藥水！</span>'); }
          if (run.wave >= CFG.waves) { run.done = true; victory(); }
          else { run.wave++; run.pending = true; sys('<span style="color:#7dd3fc">第 ' + run.wave + '／' + CFG.waves + ' 道星門打開了。</span>'); }
        }
      } catch (e) { console.warn('[AFK-starroad] kill', e); }
      return r;
    };
  }
  // ── 時限、倒下、離開 ──
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var r = oTick.apply(this, arguments);
      try {
        var cur = mapState.current;
        if (cur !== lastMap) { if (lastMap === MAP && run) run = null; lastMap = cur; }
        var pc = P();
        if (run && pc && pc.afkStar && pc.afkStar.run !== run) run = null;   // 換了角色：這趟是別的角色的
        if (!run && cur === MAP && pc && !pc.dead) {   // 在星之通道裡卻沒有進行中的這一趟（換角色回來、重新整理）→ 接回存著的那一趟，沒有就送回村莊
          var sr = pc.afkStar && pc.afkStar.run;
          if (sr && !sr.done && Number(sr.until) > Date.now() && Number(sr.wave) >= 1) { run = sr; run.pending = !mobs().some(function (x) { return x && x._starRun && !x._dead; }); }
          else if (!leaving) { leaving = true; leave('<span class="text-amber-300">星之通道已經關閉，你回到了席琳神殿。</span>'); setTimeout(function () { leaving = false; }, 2000); }
        }
        if (run && cur === MAP && !run.done && !run.pending && !mobs().some(function (x) { return x && x._starRun && !x._dead; })) run.pending = true;   // 頭目沒有倒下就不見了（被甩掉、被清場）→ 同一道門重新開
        if (run && cur === MAP && !run.done) {
          var p = P();
          if (p && p.dead) leave('<span class="text-red-400">你在星之通道裡倒下了，這次遠征失敗。</span>');
          else if (Date.now() > run.until) leave('<span class="text-red-400">星之通道開始崩塌——時間到，這次遠征失敗。</span>');
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }

  // ── 喬斯達 ──
  var paint = function (div) {
    var box = div.querySelector('#afk-star-josda'); if (!box) return;
    var p = P(); if (!p) return;
    var s = store(p), why = canEnter(), w = worldOf(p);
    var h = '<div class="ax-h">星途遠征</div><div class="ax-note" style="color:#bae6fd">「我的力量有限——在' + ({ normal: '這個世界', mad: '瘋狂席琳的世界', dream: '席琳夢域鏡', rift: '次元裂縫' }[w]) + '，我只能為你開啟 ' + CFG.cap[w] + ' 次星門。」（已開啟 ' + (Number(s.pts[w]) || 0) + ' 次）</div>'
      + '<div class="ax-note">穿過 ' + CFG.waves + ' 道星門，每道門後是一名頭目（地監頭目或地區霸主，照你的等級挑選；越後面越強）。打贏 ' + CFG.waves + ' 道門得到星辰藥水 ×1，副本裡每名頭目另有 1% 掉 1 罐。有兩項能力的基本值（出生＋配點＋萬能藥）到 200 之後就不再掉。'
      + '一般、瘋狂席琳、夢域鏡三個世界每天各 ' + CFG.daily + ' 次，次元裂縫每天 ' + CFG.riftDaily + ' 次（進場就算），時限 15 分鐘；倒下、時間到或離開就失敗。傭兵可以一起進。</div>'
      + (w === 'rift' ? '<div class="ax-note" style="color:#f0abfc">次元裂縫：「取回繁星之力」——頭目照次元裂縫的強度。通關一次，次元裂縫裡的取回力量 +5%，最多 ' + CFG.starsMax + ' 次（目前 ' + Math.min(CFG.starsMax, Number(p.afkDimRift && p.afkDimRift.stars) || 0) + '／' + CFG.starsMax + '）；拿滿後只有一般報酬。</div>' : '')
      + '<div class="ax-note">今天（' + WORLD_N[w] + '）：' + usedToday(p) + '／' + CFG.daily + ' 次　通關 ' + (Number(s.clears) || 0) + ' 次</div>'
      + '<div class="ax-note">進場費用：' + costTxt(costOf(p)) + (w === 'normal' ? '（一般世界前 ' + DISC.n + ' 次只要金幣 ' + DISC.gold.toLocaleString() + '＋席琳結晶 ' + DISC.crystal + '，還剩 ' + discLeft(p) + ' 次）' : '') + '　持有席琳結晶 ' + matTxt('sherine_crystal') + (w === 'dream' ? '、夢艷結晶 ' + matTxt('afk_dream_crystal') : '') + '</div>'
      + '<div class="ax-note">星辰藥水（升級點數 +1）已喝：一般 ' + (Number(s.pts.normal) || 0) + '／' + CFG.cap.normal + '、瘋狂席琳 ' + (Number(s.pts.mad) || 0) + '／' + CFG.cap.mad + '、席琳夢域鏡 ' + (Number(s.pts.dream) || 0) + '／' + CFG.cap.dream + '、次元裂縫 ' + (Number(s.pts.rift) || 0) + '／' + CFG.cap.rift + '（你現在的世界：' + WORLD_N[w] + '）</div>';
    h += K.rowHtml({ key: 'enter', name: '進入星途遠征', color: '#bae6fd', desc: '今天在這個世界還剩 ' + Math.max(0, dailyOf(w) - usedToday(p)) + ' 次。', why: why || '', btns: [['enter', '進入', !why]] }, 'data-star');
    K.repaint(box, h);
  };
  var render = function (div) {
    if (!div) return; K.css();
    div.innerHTML = '<div class="afk-ax"><div class="ax-lore">「星星排成的路，盡頭總有值得帶回來的東西。」</div></div>';
    var box = document.createElement('div'); box.className = 'afk-ax'; box.id = 'afk-star-josda'; div.appendChild(box);
    paint(div);
    if (!div.__afkStarBound) {
      div.__afkStarBound = true;
      div.addEventListener('click', function (ev) { var b = ev.target.closest('button[data-star]'); if (!b || b.disabled || !div.querySelector('#afk-star-josda')) return; if (b.getAttribute('data-star') === 'enter') enter(); });
    }
  };
  K.addNpc(TOWN, { id: NPC_ID, n: NPC_N, title: NPC_T, type: 'quest', d: '帶著星盤的旅人喬斯達，能打開通往各地頭目的星之通道——副本「星途遠征」。' });
  K.hookNpc(NPC_ID, NPC_N, NPC_T, render);

  W.__afkStarRoad = { CFG: CFG, noDrop: noDrop, MAP: MAP, ITEM: ITEM, NPC_ID: NPC_ID, store: store, worldOf: worldOf, usedToday: usedToday, ptsTotal: ptsTotal, drink: drink, enter: enter, canEnter: canEnter,
    DISC: DISC, discLeft: discLeft, dailyOf: dailyOf, costOf: costOf, run: function () { return run; }, pickBoss: pickBoss, dungeonBosses: dungeonBosses, render: render };
})();
