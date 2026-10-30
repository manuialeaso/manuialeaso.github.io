/* ============================================================================
 * afk-giltas.js — 吉爾塔斯副本「異界祭壇」（玩家 2026-10-26 指定）
 *
 * 鑰匙
 *   ‧受詛咒的黑暗妖精聖地「吉爾塔斯」（上半身）必掉：次元時空鑰匙碎片(上)
 *   ‧謀叛者的低語「冥皇丹特斯」必掉：次元時空鑰匙碎片(下)
 *   ‧長老會議廳 NPC「次元裂隙」：碎片(上)＋(下) 組成「次元時空鑰匙」；交出鑰匙進入異界祭壇（只在席琳夢域鏡開啟；每個角色每天通關一次）
 *   ‧崩壞的長老會議廳「真‧死亡騎士 冥皇丹特斯」：沒有的話必掉「信仰的寶珠」（帶在身上＝全隊免疫致死圓形結界）
 * 流程（三層，打完一層才進下一層；中途離開要重來，鑰匙不退）
 *   第一層・異界的守門者：底比斯 賀洛斯、底比斯 阿努比斯、提卡爾杰弗雷庫(雄)、提卡爾杰弗雷庫(雌)
 *   第二層・半身吉爾塔斯：只用一種顏色的反擊屏障
 *   第三層・真‧吉爾塔斯：HP 約七階龍再多一點；四色反擊屏障輪替＋致死圓形結界
 *   反擊屏障（玩家：先試 5 秒）：每 10 秒張開一次、持續 5 秒
 *     黑＝不反彈；紅＝反彈近距離，結束後火紅流星雨；綠＝反彈遠距離，結束後綠色毒氣；金＝反彈魔法，結束後金色沙塵暴
 *   致死圓形結界：每 45 秒展開，4 秒後全隊死亡；身上有「信仰的寶珠」就擋下
 *   席琳夢域鏡：第二、三層 HP 跟四龍最終龍一樣打 6 折
 * 獎勵（真‧吉爾塔斯）
 *   ‧真‧吉爾塔斯之劍（唯一武器，昇華支配等級）：1%
 *   ‧支配者吉爾塔斯 變身卡（時空級，唯一）：1%
 *   ‧席琳結晶 50～100、昇華支配碎片 2～5
 * ========================================================================== */
(function () {
  'use strict';
  var __T = window.AFK_TOGGLES;
  if (__T && __T.register) __T.register({ id: 'giltas', name: '異界祭壇（吉爾塔斯副本）', desc: '只在席琳夢域鏡：長老會議廳的次元裂隙，用次元時空鑰匙進入異界祭壇挑戰吉爾塔斯', group: '遊戲玩法' });
  if (__T && !__T.enabled('giltas')) { console.log('[AFK] 外掛開關「異界祭壇」已關閉'); return; }
  var W = window;
  if (typeof DB === 'undefined' || !DB.mobs || !DB.items || !DB.maps) return;
  var MAP = 'afk_giltas_altar', NAME = '異界祭壇', TOWN = 'town_elder_council', NPC_ID = 'npc_afk_gt_rift';
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var sys = function (h) { try { if (typeof logSys === 'function' && !S().ff) logSys(h); } catch (e) {} };
  var clog = function (h, c) { try { if (typeof logCombat === 'function' && !S().ff) logCombat(h, c || 'enemy'); } catch (e) {} };
  var dreamOn = function () { var p = P(); return !!(p && p.sherineDream && p.sherineMad); };
  var dayKey = function () { return Math.floor((Date.now() + 8 * 3600000) / 86400000); };
  var cntOf = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (s, i) { return s + (i && i.id === id && !i.lock ? Math.max(1, Number(i.cnt) || 1) : 0); }, 0) : 0; };
  var take = function (id, n) {
    var p = P(); if (!p || cntOf(id) < n) return false;
    for (var i = p.inv.length - 1; i >= 0 && n > 0; i--) { var it = p.inv[i]; if (!it || it.id !== id || it.lock) continue; var c = Math.max(1, Number(it.cnt) || 1), q = Math.min(c, n); n -= q; if (c - q > 0) it.cnt = c - q; else p.inv.splice(i, 1); }
    try { if (typeof resetCatchupGainItemIndex === 'function') resetCatchupGainItemIndex(); } catch (e) {}
    return true;
  };

  // ── 道具 ──
  var ITEMS = {
    afk_gt_frag_up: { n: '次元時空鑰匙碎片(上)', c: 'text-cyan-300', img: 'assets/icons/items/時空裂痕碎片.png', d: '從上半身的吉爾塔斯身上剝落的鑰匙上半截。和碎片(下)一起帶到長老會議廳的「次元裂隙」，就能組成次元時空鑰匙。' },
    afk_gt_frag_down: { n: '次元時空鑰匙碎片(下)', c: 'text-cyan-300', img: 'assets/icons/items/時空裂痕碎片.png', d: '冥皇丹特斯在謀叛的密室裡藏著的鑰匙下半截。和碎片(上)一起帶到長老會議廳的「次元裂隙」，就能組成次元時空鑰匙。' },
    afk_gt_key: { n: '次元時空鑰匙', c: 'text-fuchsia-300', img: 'assets/icons/items/古代鑰匙.png', d: '兩截碎片合而為一的鑰匙，能打開通往異界祭壇的門。在長老會議廳的「次元裂隙」使用。' },
    afk_gt_orb: { n: '信仰的寶珠', c: 'text-yellow-200', img: 'assets/icons/items/神秘水晶球.png', d: '真‧死亡騎士冥皇丹特斯至死緊握的寶珠，裡面封著一縷不滅的信仰。帶在身上，真‧吉爾塔斯的致死圓形結界就傷不了你和你的隊伍。' }
  };
  Object.keys(ITEMS).forEach(function (id) {
    if (DB.items[id]) return;
    var x = ITEMS[id];
    DB.items[id] = { n: x.n, type: 'etc', c: x.c, img: x.img, d: x.d, p: 0, gachaWeight: 0, noUse: true, weight: 0 };
    try { if (typeof MISC_BOOK_EXCLUDED !== 'undefined') MISC_BOOK_EXCLUDED[id] = true; } catch (e) {}
  });

  // ── 怪物 ──
  var sg = DB.mobs.sanct_giltas || { n: '吉爾塔斯', lv: 99, s: 'L', beh: '主動', race: '異界生物', boss: true, hard: true, e: 'none', hp: 440000, ac: -99, mr: 300, atkSpd: 2, dmg: [5, 158], db: 403, hit: 132 };
  var half = clone(sg);
  Object.assign(half, { n: '半身吉爾塔斯', lv: 99, hp: 300000, exp: 9000, goldMin: 50000, goldMax: 150000, afkGt: 2 });
  delete half.mag2; delete half.mag3; delete half.mag4;
  var trueG = clone(sg);
  Object.assign(trueG, { n: '真‧吉爾塔斯', lv: 100, hp: 632000, ac: -110, mr: 300, dmg: [5, 170], db: 440, hit: 140, exp: 30000, goldMin: 200000, goldMax: 500000, afkGt: 3 });
  delete trueG.mag2; delete trueG.mag3; delete trueG.mag4;
  DB.mobs.afk_gt_half = half; DB.mobs.afk_gt_true = trueG;
  var FOLLOW = ['thebes_horus', 'thebes_anubis', 'tikal_boss_m', 'tikal_boss_f'].filter(function (id) { return !!DB.mobs[id]; });
  DB.maps[MAP] = FOLLOW.concat(['afk_gt_half', 'afk_gt_true']);
  var LAYERS = [
    { n: '第一層・異界的守門者', ids: FOLLOW, conc: 2, msg: '時空的裂縫裡走出四道身影——底比斯與提卡爾的守護者擋在祭壇前。' },
    { n: '第二層・半身吉爾塔斯', ids: ['afk_gt_half'], conc: 1, msg: '祭壇上浮現吉爾塔斯的上半身，牠的眼睛在裂縫的另一頭盯著你。' },
    { n: '第三層・真‧吉爾塔斯', ids: ['afk_gt_true'], conc: 1, msg: '裂縫徹底撕開。奪回全部力量的吉爾塔斯，以完整的身軀踏上了祭壇。' }
  ];
  // 動畫、頭像：沿用聖地吉爾塔斯
  try {
    var get = function (n) { try { return (0, eval)(n); } catch (e) { return null; } };
    var SETS = ['MOB_ANIM_NAMES', 'MOB_ANIM_BAKED_SHADOW', 'MOB_SHADOW_TINT', 'MOB_ANIM_BIG', 'MOB_ANIM_SMALL', 'MOB_ANIM_SPRITE_SHADOW', 'MOB_ANIM_WEAPON_FX', 'MOB_ANIM_WEAPON_FX2', 'MOB_ANIM_8DIR'].map(get);
    var OBJS = ['MOB_ANIM_SKILL_FX', 'MOB_YLIFT', 'MOB_ANIM_DEATH_FX', 'BOSS_ENTRANCE_FX', 'MOB_HURT_SFX', 'MOB_KILL_SFX', 'MOB_ATTACK_SFX'].map(get);
    var names = get('MOB_ANIM_NAMES');
    ['半身吉爾塔斯', '真‧吉爾塔斯'].forEach(function (n) {
      var src = '吉爾塔斯', target = (typeof MOB_ANIM_ALIAS !== 'undefined' && MOB_ANIM_ALIAS[src]) || src;
      if (!names || !names.has(src)) return;
      if (typeof MOB_ANIM_ALIAS !== 'undefined') MOB_ANIM_ALIAS[n] = target;
      SETS.forEach(function (s) { if (s && s.has && s.has(src)) s.add(n); });
      OBJS.forEach(function (o) { if (o && o[src] != null && o[n] == null) o[n] = o[src]; });
    });
    [half, trueG].forEach(function (m) { if (!m.img) m.img = sg.img || 'assets/icons/monsters/吉爾塔斯.png'; });
  } catch (e) { console.warn('[AFK-giltas] 動畫', e); }
  // 屏障後招（全體魔法）
  var SPELL = {
    red: { skn: '火紅流星雨', dmg: [10, 160], db: 600, ele: 'fire', alwaysHit: true },
    green: { skn: '綠色毒氣', dmg: [10, 140], db: 500, ele: 'wind', alwaysHit: true, sec: { type: 'poison', pbase: 400, d: 400, tick: 2, dur: 10 } },
    gold: { skn: '金色沙塵暴', dmg: [10, 160], db: 600, ele: 'earth', alwaysHit: true }
  };
  try { if (typeof MOB_PARTY_AOE_SKILLS !== 'undefined' && MOB_PARTY_AOE_SKILLS.add) Object.keys(SPELL).forEach(function (k) { MOB_PARTY_AOE_SKILLS.add(SPELL[k].skn); }); } catch (e) {}
  var COLOR = { black: { n: '黑', kind: null, css: '#a3a3a3' }, red: { n: '紅', kind: 'melee', css: '#f87171' }, green: { n: '綠', kind: 'ranged', css: '#4ade80' }, gold: { n: '金', kind: 'magic', css: '#facc15' } };
  var BAR_EVERY = 100, BAR_DUR = 50, DEATH_EVERY = 450, DEATH_DELAY = 40;   // tick（0.1 秒）

  // ── 地圖（不在選單，只能由次元裂隙進入）──
  try { window.__afkNoOfflineMaps = (window.__afkNoOfflineMaps || []).concat([MAP]); } catch (e) {}
  try { SPECIAL_AREA_BG[MAP] = 'assets/area/1920x1080/時空裂痕戰場.jpg'; } catch (e) {}
  try { if (typeof MAP_DESC !== 'undefined' && !MAP_DESC[MAP]) MAP_DESC[MAP] = '時空裂縫盡頭的祭壇，吉爾塔斯在此奪回全部的力量。'; } catch (e) {}
  try { if (typeof SANCTUARY_MAP_NAMES !== 'undefined') SANCTUARY_MAP_NAMES[MAP] = NAME; } catch (e) {}

  var clearedToday = function () { var p = P(); return !!(p && p._afkGtDay === dayKey()); };
  var hasOrb = function () { return cntOf('afk_gt_orb') > 0; };
  var run = null;
  var enter = function () {
    var p = P(); if (!p) return false;
    if (!dreamOn()) { sys('<span class="text-amber-300">裂隙另一頭一片死寂——異界祭壇只在席琳夢域鏡開啟。</span>'); return false; }
    if (clearedToday()) { sys('<span class="text-amber-300">今天已經打倒過真‧吉爾塔斯了，裂隙要到明天（每天 00:00（台灣時間））才會再次張開。</span>'); return false; }
    if (typeof mercenaryRoleBattleBlocked === 'function' && mercenaryRoleBattleBlocked(MAP)) return false;
    if (!take('afk_gt_key', 1)) { sys('<span class="text-red-400">沒有次元時空鑰匙。</span>'); return false; }
    sys('<span class="text-fuchsia-300 font-bold">你把次元時空鑰匙插進裂隙，門的另一頭是' + NAME + '。</span>');
    try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
    try { if (typeof closeWarehouseWindow === 'function') closeWarehouseWindow(); } catch (e) {}
    try { if (typeof saveSiegeBossHp === 'function') saveSiegeBossHp(); } catch (e) {}
    mapState.current = MAP; p.lastBattleMap = MAP;
    mapState.mobs = [null, null, null, null, null]; mapState.spawnAt = [null, null, null, null, null];
    mapState.targetIdx = -1; mapState.forceBoss = false;
    S()._kbRespawnAt = null; S()._kbVictory = false;
    run = null; lastMap = MAP;
    try { if (typeof _vfxClearAll === 'function') _vfxClearAll(); } catch (e) {}
    try { if (typeof auditReset === 'function') auditReset(); } catch (e) {}
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
  var combine = function () {
    if (cntOf('afk_gt_frag_up') < 1 || cntOf('afk_gt_frag_down') < 1) { sys('<span class="text-red-400">需要次元時空鑰匙碎片(上)與(下)各 1 個。</span>'); return false; }
    take('afk_gt_frag_up', 1); take('afk_gt_frag_down', 1);
    gainItem('afk_gt_key', 1, true);
    sys('<span class="text-fuchsia-300">兩截碎片在裂隙的光裡接合——你得到了次元時空鑰匙。</span>');
    try { renderTabs(true); saveGame(); } catch (e) {}
    return true;
  };

  // ── 長老會議廳 NPC：次元裂隙 ──
  try {
    var town = DB.towns && DB.towns[TOWN];
    if (town && Array.isArray(town.npcs) && !town.npcs.some(function (x) { return x.id === NPC_ID; }))
      town.npcs.push({ id: NPC_ID, n: '次元裂隙', title: '異界祭壇', type: 'craft', d: '長老會議廳角落裂開的一道時空縫隙，另一頭隱約傳來吉爾塔斯的低吼。湊齊次元時空鑰匙，就能穿過它前往異界祭壇。' });
    if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[NPC_ID]) NPC_SPR_FIXED[NPC_ID] = '6690';
  } catch (e) {}
  var render = function (div) {
    var up = cntOf('afk_gt_frag_up'), dn = cntOf('afk_gt_frag_down'), key = cntOf('afk_gt_key'), orb = hasOrb(), done = clearedToday();
    var row = function (t, ok) { return '<div>' + (ok ? '<span class="text-emerald-300">✔</span>' : '<span class="text-slate-500">✘</span>') + ' ' + t + '</div>'; };
    div.innerHTML = '<div class="text-sm space-y-2">'
      + '<div class="text-slate-300">裂縫的另一頭，吉爾塔斯正一點一點奪回失去的身軀。要阻止牠，就得用兩截鑰匙打開這道門。</div>'
      + row('次元時空鑰匙碎片(上) ×' + up + '（受詛咒的黑暗妖精聖地・吉爾塔斯）', up > 0)
      + row('次元時空鑰匙碎片(下) ×' + dn + '（謀叛者的低語・冥皇丹特斯）', dn > 0)
      + row('次元時空鑰匙 ×' + key, key > 0)
      + row('信仰的寶珠（崩壞的長老會議廳・真‧死亡騎士 冥皇丹特斯）：' + (orb ? '持有，全隊免疫致死圓形結界' : '沒有——致死圓形結界會讓全隊陣亡'), orb)
      + row('身在席琳夢域鏡（異界祭壇只在席琳夢域鏡開啟）', dreamOn())
      + row('今日' + (done ? '已通關（明天再來）' : '尚未通關'), !done)
      + '<div class="text-xs text-slate-400">三層：異界的守門者 → 半身吉爾塔斯 → 真‧吉爾塔斯。反擊屏障每 10 秒張開 5 秒：紅＝彈近距離、綠＝彈遠距離、金＝彈魔法、黑＝不彈，結束後放對應的全體魔法。中途離開要重來，鑰匙不退。</div>'
      + '<button type="button" class="btn w-full" data-gt="combine"' + (up > 0 && dn > 0 ? '' : ' disabled') + '>組成次元時空鑰匙</button>'
      + '<button type="button" class="btn w-full mt-1" data-gt="enter"' + (key > 0 && !done && dreamOn() ? '' : ' disabled') + '>進入' + NAME + '（消耗 1 把鑰匙）</button></div>';
    div.onclick = function (e) {
      var b = e.target.closest('[data-gt]'); if (!b || b.disabled) return;
      if (b.getAttribute('data-gt') === 'combine') { combine(); render(div); } else enter();
    };
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try { var div = document.getElementById('interaction-content'); if (div && npcId === NPC_ID) render(div); } catch (e) { console.warn('[AFK-giltas] ui', e); }
      return r;
    };
  }

  // ── 三層推進 ──
  var lastMap = null;
  var startLayer = function (i) {
    var L = LAYERS[i]; run = { layer: i, queue: L.ids.slice(), killed: 0, need: L.ids.length };
    sys('<span class="font-bold" style="color:#c084fc">【' + NAME + '】' + L.n + '</span>　' + L.msg);
  };
  var watchMap = function () { var cur = (typeof mapState !== 'undefined') ? mapState.current : null; if (cur !== lastMap) { if (cur === MAP || lastMap === MAP) run = null; lastMap = cur; } };
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      if (typeof mapState === 'undefined' || mapState.current !== MAP) return oSpawn.apply(this, arguments);
      if (!run) startLayer(0);
      if (run.layer >= 1 && idx !== 1) { if (!mapState.mobs[idx] || mapState.mobs[idx]._dead) mapState.mobs[idx] = null; return; }   // 吉爾塔斯體型大：只站中央
      if (run.done || !run.queue.length) { if (!mapState.mobs[idx] || mapState.mobs[idx]._dead) mapState.mobs[idx] = null; return; }
      var alive = (mapState.mobs || []).filter(function (m) { return m && !m._dead && m.curHp > 0; }).length;
      if (alive >= LAYERS[run.layer].conc) { if (!mapState.mobs[idx] || mapState.mobs[idx]._dead) mapState.mobs[idx] = null; return; }
      var id = run.queue.shift(), b = DB.mobs[id]; if (!b) return;
      mapState.mobs[idx] = Object.assign({}, b, { curHp: b.hp, uid: uid(), _born: ++_mobBornSeq, _bornMs: Date.now(), _magCd: {}, justHit: false, st: newMobStatus(), _afkGtLayer: run.layer + 1 });
      var m = mapState.mobs[idx];
      try { if (typeof applySherineBuff === 'function') applySherineBuff(idx); } catch (e) {}
      if (m.afkGt && dreamOn()) { m.hp = Math.max(1, Math.round(m.hp * 0.6)); m.curHp = m.hp; }   // 席琳夢域鏡：跟四龍最終龍一樣 6 折
      if (m.afkGt === 2) m._afkGtColor = ['red', 'green', 'gold'][Math.floor(Math.random() * 3)];
      try { if (m.hard && typeof initHardSkin === 'function') initHardSkin(m); } catch (e) {}
      try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(m); } catch (e) {}
      try { if (!S().ff) renderMobs(); } catch (e) {}
    };
  }

  // ── 反擊屏障、致死圓形結界 ──
  var partyAlive = function () { var p = P(); return [p].concat(((p && p.allies) || []).filter(function (a) { return a && !a._downed && (a.curHp || 0) > 0; })); };
  var deathCircle = function (m) {
    if (hasOrb()) { clog('<span class="font-bold" style="color:#fde68a">【信仰的寶珠】</span>寶珠綻放出溫暖的光，致死圓形結界在光裡碎成灰燼。', 'player'); return; }
    clog('<span class="font-bold" style="color:#ef4444;text-shadow:0 0 8px #7f1d1d">【致死圓形結界】</span>' + m.n + ' 的結界收攏——沒有信仰庇護的人全數倒下。');
    var p = P();
    (p.allies || []).forEach(function (a) { if (a && !a._downed && (a.curHp || 0) > 0) { a.curHp = 0; a._downed = true; a._reviveCd = 150; } });
    if (!p.dead) { p.hp = 0; try { if (typeof killPlayer === 'function') killPlayer(); } catch (e) {} }
  };
  var gtTick = function () {
    if (typeof mapState === 'undefined' || mapState.current !== MAP || !P() || P().dead) return;
    if (!dreamOn()) { sys('<span class="text-amber-300">離開了席琳夢域鏡，異界祭壇的裂縫在你身後闔上。</span>'); setMapSelectors(TOWN); changeMap(true); return; }
    var t = tk();
    (mapState.mobs || []).forEach(function (m) {
      if (!m || m._dead || !(m.curHp > 0) || !m.afkGt) return;
      if (m._gtBorn == null) { m._gtBorn = t; m._gtBarAt = t; m._gtDeathAt = t; }
      if (window.__afkHalted && window.__afkHalted(m)) { m._gtBarAt++; m._gtDeathAt++; if (m._gtDeathPend) m._gtDeathPend++; return; }   // 連暈停擺：計時暫停
      var bar = m._gtBar;
      if (bar && t >= bar.end) {
        m._gtBar = null; if (m._reflectWall && m._reflectWall.afkGt) m._reflectWall = null;
        if (SPELL[bar.color] && typeof castMobMagic === 'function') { try { castMobMagic(m, SPELL[bar.color]); } catch (e) {} }
      }
      if (!m._gtBar && t - m._gtBarAt >= BAR_EVERY) {
        m._gtBarAt = t;
        var c = m.afkGt === 2 ? m._afkGtColor : ['black', 'red', 'green', 'gold'][Math.floor(Math.random() * 4)], C = COLOR[c];
        m._gtBar = { color: c, end: t + BAR_DUR };
        if (C.kind) m._reflectWall = { kind: C.kind, until: t + BAR_DUR, afkGt: true };
        clog('<span class="font-bold" style="color:' + C.css + '">【' + C.n + '色反擊屏障】</span>' + m.n + (C.kind ? ' 張開屏障（5 秒）：' + { melee: '近距離', ranged: '遠距離', magic: '魔法' }[C.kind] + '攻擊會被反彈，結束時施放' + SPELL[c].skn + '。' : ' 張開黑色屏障（5 秒）：不反彈，放心攻擊。'));
      }
      if (m.afkGt === 3) {
        if (m._gtDeathPend && t >= m._gtDeathPend) { m._gtDeathPend = 0; deathCircle(m); }
        else if (!m._gtDeathPend && t - m._gtDeathAt >= DEATH_EVERY) {
          m._gtDeathAt = t; m._gtDeathPend = t + DEATH_DELAY;
          clog('<span class="font-bold" style="color:#ef4444">【致死圓形結界】</span>' + m.n + ' 腳下展開血紅的圓陣——4 秒後，圓陣裡的一切都會死去。' + (hasOrb() ? '（信仰的寶珠微微發燙）' : ''));
        }
      }
    });
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      try { watchMap(); } catch (e) {}
      var t0 = tk(), r = oTick.apply(this, arguments);
      if (tk() !== t0) { try { gtTick(); } catch (e) { console.warn('[AFK-giltas] tick', e); } }
      return r;
    };
  }
  // 反彈訊息改叫「反擊屏障」
  if (typeof W.reflectWallOnDamage === 'function') {
    var oRefl = W.reflectWallOnDamage;
    W.reflectWallOnDamage = function (mob) {
      if (!mob || !mob._reflectWall || !mob._reflectWall.afkGt || typeof W.logCombat !== 'function') return oRefl.apply(this, arguments);
      var oLog = W.logCombat;
      W.logCombat = function (h) { if (typeof h === 'string') arguments[0] = h.replace('【血壁空間】', '【反擊屏障】'); return oLog.apply(this, arguments); };
      try { return oRefl.apply(this, arguments); } finally { W.logCombat = oLog; }
    };
  }

  // ── 掉落：鑰匙碎片、寶珠、層數推進、獎勵 ──
  var REWARD_RATE = { sword: 0.01, card: 0.01 };   // 玩家 2026-10-26：20% → 1%
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null, cur = mapState && mapState.current;
      var r = oKill.apply(this, arguments);
      try {
        if (m && m._dead && !m._afkGtPaid && P()) {
          if (m.n === '吉爾塔斯' && cur === 'cursed_dark_elf_sanctuary') { m._afkGtPaid = true; gainItem('afk_gt_frag_up', 1, true); sys('<span class="text-cyan-300">吉爾塔斯消散時掉下了半截鑰匙——次元時空鑰匙碎片(上)。</span>'); }
          else if (m.n === '冥皇丹特斯' && m.afkTraitor) { m._afkGtPaid = true; gainItem('afk_gt_frag_down', 1, true); sys('<span class="text-cyan-300">冥皇丹特斯的懷裡滾出半截鑰匙——次元時空鑰匙碎片(下)。</span>'); }
          else if (cur === 'collapsed_elder_council_hall' && /冥皇丹特斯/.test(m.n || '') && !m.afkTraitor && !hasOrb()) { m._afkGtPaid = true; gainItem('afk_gt_orb', 1, true); sys('<span class="text-yellow-200 font-bold">真‧死亡騎士冥皇丹特斯鬆開了手，一顆發著微光的寶珠滾到你腳邊——信仰的寶珠。</span>'); }
        }
      } catch (e) { console.warn('[AFK-giltas] drop', e); }
      try {
        if (m && m._dead && m._afkGtLayer && !m._afkGtCounted && run && !run.done && cur === MAP) {
          m._afkGtCounted = true; run.killed++;
          if (run.killed >= run.need) {
            if (run.layer + 1 < LAYERS.length) { sys('<span class="text-emerald-300">' + LAYERS[run.layer].n.split('・')[0] + '肅清完畢，裂縫又撕開了一些。</span>'); startLayer(run.layer + 1); }
            else { run = { done: true, layer: LAYERS.length - 1, queue: [], killed: 0, need: 0 }; victory(); }
          }
        }
      } catch (e) { console.warn('[AFK-giltas] layer', e); }
      return r;
    };
  }
  var victory = function () {
    var p = P(); p._afkGtDay = dayKey();
    var got = [];
    var c = 50 + Math.floor(Math.random() * 51); if (DB.items.sherine_crystal) { gainItem('sherine_crystal', c, true); got.push('席琳結晶 ×' + c); }
    if (DB.items.afk_asc_shard) { var k = 2 + Math.floor(Math.random() * 4); gainItem('afk_asc_shard', k, true); got.push('昇華支配碎片 ×' + k); }
    if (Math.random() < REWARD_RATE.sword) { var sid = rollSword(); if (sid) { gainItem(sid, 1, true); got.push('<span class="text-yellow-300 font-bold">' + DB.items[sid].n + '</span>'); } }
    var card = cardRow && cardRow.itemId;
    if (card && DB.items[card] && Math.random() < REWARD_RATE.card) { gainItem(card, 1, true); got.push('<span class="text-cyan-200 font-bold">' + DB.items[card].n + '</span>'); }
    sys('<span class="text-yellow-300 font-bold">🏆 真‧吉爾塔斯倒在祭壇上，時空的裂縫緩緩闔起。裂縫闔起前，你聽見夢的深處傳來四聲龍吟——被喚醒的四龍，正替她們的母親守著最後一道門。</span>你得到了：' + got.join('、') + '。今天的異界祭壇已通關。');
    setTimeout(function () { try { if (mapState.current === MAP) { setMapSelectors(TOWN); changeMap(true); try { saveGame(); } catch (e) {} } } catch (e) {} }, 1500);
  };

  // ════ 真‧吉爾塔斯之劍（唯一武器）════
  //   昇華支配 +0 等級：大小傷 60／66（最強的昇華支配 +0 武器是 55／60），命中 +15、額外傷害 +15
  //   五個遺物詞條：取得時從遺物武器裡隨機抽 5 把，繼承它們的特效（同第二詞綴規則；沒有新特效的給四屬性抗性 +3）
  //   特效：每次攻擊 65% 施放一種全體魔法（流星雨／金色沙塵暴／綠毒霧）；80% 重擊、重擊傷害 ×2；命中暈眩 3 秒；切割 100%；
  //         流血、灼熱、中毒各疊一層（最多 5 層）
  var SWORD = 'wpn_gt_sword';
  var NOT_FX = new Set(['n', 'type', 'slot', 'relic', 'noEnhance', 'dmgS', 'dmgL', 'hit', 'dmgBonus', 'req', 'p', 'gachaWeight', 'd', 'c', 'img',
    'isBow', 'ranged', 'rapidfire', 'rapidMax', 'isWand', 'qigu', 'chainsword', 'oneHand', 'w2h', 'isArrow', 'noConsume', 'eff', 'comboRate', 'ele',
    'extraMp', 'str', 'dex', 'con', 'int', 'wis', 'cha', 'mr', 'mdmg', 'mpR', 'hpR', 'mhp', 'mmp', 'dr', 'magicHit', 'relicRole', 'h', 'classicOk',
    'maxLv', 'noBleed', 'tag', 'bowHit', 'bowDmg', 'extraDmg', 'relicBase', 'relicPlus', 'relicFx', 'relicBleedBonus', 'safe', 'maxEn',
    'ac', 'er', 'resFire', 'resWater', 'resWind', 'resEarth', 'weight', 'fireNullifyTicks', 'armguard', 'cls',
    'relicCatalogId', 'relicStage', 'relicRuntime', 'relicLore', 'relicAsc', 'relicEvo', 'relicFxRes', 'noAscUp', 'gmOnly', 'heavyMult', 'legend', 'spd']);
  var BASE = { n: '真‧吉爾塔斯之劍', type: 'wpn', w2h: true, dmgS: 60, dmgL: 66, hit: 15, dmgBonus: 15, spd: 1, req: 'royal,knight,mage,elf,dark,illusion,dragon,warrior', safe: 0, p: 0, gachaWeight: 0, noEnhance: true, noTrade: true,
    eff: 'cleave', heavyMult: 2, ignHardSkin: true, afkGtSword: true, c: 'text-yellow-300', img: 'assets/icons/weapons/吉爾塔斯之劍.png',
    d: '真‧吉爾塔斯奪回全身時握在手中的劍——世上只有這一把（唯一，昇華支配等級，無法強化）。每次攻擊 65% 施放一種全體魔法：火紅流星雨（吃近距離傷害）、金色沙塵暴（吃魔法傷害）、綠色毒霧（吃遠距離傷害）；重擊率 80%、重擊傷害 ×2；命中時暈眩 3 秒、切割必定觸發，並疊加流血、灼熱、中毒各一層（最多 5 層）。' };
  if (!DB.items[SWORD]) DB.items[SWORD] = clone(BASE);
  var TAGS = ['雙手劍'];
  try { if (typeof WEAPON_TAGS !== 'undefined' && !WEAPON_TAGS[SWORD]) WEAPON_TAGS[SWORD] = TAGS; } catch (e) {}
  var donorPool = null;
  var donors = function () {
    if (donorPool) return donorPool;
    donorPool = Object.keys(DB.items).filter(function (id) { var d = DB.items[id]; return d && d.relic && d.type === 'wpn' && !d.gmOnly && id.indexOf('~') < 0 && /^(relic_|wpn_)[a-z0-9_]+$/.test(id); });
    return donorPool;
  };
  var ID_RE = /wpn_gt_sword(?:~(?:relic_|wpn_)[a-z0-9_]+){5}/g;
  var buildSword = function (fx) {
    var d = clone(BASE), names = [], res = 0;
    fx.forEach(function (id) {
      var src = (window.AFK_RELIC_RUNTIME && window.AFK_RELIC_RUNTIME.originalBase && window.AFK_RELIC_RUNTIME.originalBase(id)) || DB.items[id];
      if (!src) return; var copied = 0;
      Object.keys(src).forEach(function (f) { if (!NOT_FX.has(f) && !(f in d)) { d[f] = clone(src[f]); copied++; } });
      if (!copied) res += 3;
      names.push(src.n + (copied ? '' : '（無新特效→四抗 +3）'));
    });
    if (res) ['resFire', 'resWater', 'resWind', 'resEarth'].forEach(function (f) { d[f] = (Number(d[f]) || 0) + res; });
    d.afkGtFx = fx.slice();
    d.d = BASE.d + ' 〔遺物詞條：' + names.join('、') + '〕';
    return d;
  };
  var ensureSword = function (id) {
    if (DB.items[id]) return true;
    var parts = String(id).split('~'); if (parts[0] !== SWORD || parts.length !== 6) return false;
    var fx = parts.slice(1); if (!fx.every(function (x) { return !!DB.items[x]; })) return false;
    Object.defineProperty(DB.items, id, { value: buildSword(fx), writable: true, configurable: true, enumerable: false });
    try { if (typeof WEAPON_TAGS !== 'undefined' && !WEAPON_TAGS[id]) Object.defineProperty(WEAPON_TAGS, id, { value: TAGS, writable: true, configurable: true, enumerable: false }); } catch (e) {}
    return true;
  };
  var rollSword = function () {
    var pool = donors().slice(), fx = [];
    while (fx.length < 5 && pool.length) fx.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    if (fx.length < 5) return null;
    var id = SWORD + '~' + fx.join('~'); ensureSword(id); return DB.items[id] ? id : null;
  };
  var isSword = function (id) { return !!id && String(id).indexOf(SWORD) === 0 && !!(DB.items[id] && DB.items[id].afkGtSword); };
  // 讀檔、招募傭兵、倉庫：先把衍生劍註冊好（不然會被當成不明道具清掉）
  var scanText = function (s) { if (!s || String(s).indexOf(SWORD + '~') < 0) return; var m = String(s).match(ID_RE); if (m) m.forEach(ensureSword); };
  var scanKey = function (key) {
    try { scanText(localStorage.getItem(key)); } catch (e) {}
    try { if (typeof _lsGet === 'function') scanText(_lsGet(key)); } catch (e) {}
    try { var raw = (typeof _lzGet === 'function') ? _lzGet(key) : null; if (raw) { var u = _saveUnwrap(raw); scanText(u && u.ok !== false && u.payload ? u.payload : raw); } } catch (e) {}
  };
  var scanAll = function () { try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/lineage|wh|warehouse/i.test(k)) scanKey(k); } } catch (e) {} };
  var ensureItems = function (items) { (items || []).forEach(function (it) { if (it && it.id && String(it.id).indexOf(SWORD + '~') === 0) ensureSword(it.id); }); };
  var ensureActor = function (a) { if (!a) return; [a].concat(a.allies || []).forEach(function (p) { if (!p) return; ensureItems(p.inv); ensureItems(Object.keys(p.eq || {}).map(function (k) { return p.eq[k]; })); }); };
  scanAll();
  ['loadGame', 'toggleAlly'].forEach(function (fn) {
    var o = W[fn]; if (typeof o !== 'function') return;
    W[fn] = function () { try { scanAll(); if (typeof currentSlot !== 'undefined') scanKey('lineage_idle_save_' + currentSlot); ensureActor(P()); } catch (e) {} return o.apply(this, arguments); };
  });
  if (typeof W.loadWarehouse === 'function') { var oWh = W.loadWarehouse; W.loadWarehouse = function () { var w = oWh.apply(this, arguments); try { ensureItems(w && w.items); } catch (e) {} return w; }; }
  if (typeof W.purgeOrphanItems === 'function') { var oPurge = W.purgeOrphanItems; W.purgeOrphanItems = function (wh) { try { ensureActor(P()); ensureItems(wh && wh.items); } catch (e) {} return oPurge.apply(this, arguments); }; }

  // 80% 重擊（玩家：getPhysicalDmg 的 forceHeavy；傭兵：allyStrikeRoll 的 opts.forceHeavy）
  if (typeof W.getPhysicalDmg === 'function') {
    var oPD = W.getPhysicalDmg;
    W.getPhysicalDmg = function (dice, target, wpn, arrow, forceHeavy, forceHit, forceLand, forceCrit, wpnInst, forceGraze, probe) {
      var a = Array.prototype.slice.call(arguments);
      if (wpn && wpn.afkGtSword && !forceHeavy && !forceHit && !forceLand && !forceGraze && !probe && Math.random() < 0.8) { while (a.length < 5) a.push(undefined); a[4] = true; }
      return oPD.apply(this, a);
    };
  }
  if (typeof W.allyStrikeRoll === 'function') {
    var oAS = W.allyStrikeRoll;
    W.allyStrikeRoll = function (ally, t, opts) {
      var a = Array.prototype.slice.call(arguments);
      try { var w = ally && ally.eq && ally.eq.wpn && DB.items[ally.eq.wpn.id]; if (w && w.afkGtSword) { var o2 = opts || {}; if (!o2.forceHeavy && !o2.forceHit && !o2.noHeavy && Math.random() < 0.8) { while (a.length < 3) a.push(undefined); a[2] = Object.assign({}, o2, { forceHeavy: true }); } } } catch (e) {}
      return oAS.apply(this, a);
    };
  }
  // 命中後：暈眩 3 秒、流血／灼熱／中毒各一層（最多 5 層）、切割、65% 全體魔法
  var C = function () { return W.AFK_CARD_COMBAT; };
  var hurt = function (actor, m, v) { v = Math.max(1, Math.floor(v)); var c = C(); if (c) v = c.damage(actor, m, v, { kind: 'true' }); m.curHp -= v; return v; };
  var reap = function () {
    var ms = mapState; if (!ms || typeof killMob !== 'function') return;
    ms.mobs.filter(function (m) { return m && m.curHp <= 0 && !m._dead; }).map(function (m) { return m.uid; }).forEach(function (u) {
      var i = ms.mobs.findIndex(function (m) { return m && m.uid === u && m.curHp <= 0 && !m._dead; }); if (i !== -1) { try { killMob(i); } catch (e) {} }
    });
  };
  var resist = function (m, actor) { return typeof W.__afkDebuffResist !== 'function' || W.__afkDebuffResist(m, actor); };
  var stacks = function (t, lost, actor) {
    var src = actor === P() ? 'player' : (typeof _dpsAllySrc === 'function' ? _dpsAllySrc(actor) : 'player');
    try { if (typeof applyBleed === 'function') applyBleed(t, lost, 5, false, src); } catch (e) {}
    if (!t.st && typeof newMobStatus === 'function') t.st = newMobStatus();
    var unit = Math.max(1, Math.floor(lost * 0.05));
    if (t.st && resist(t, actor)) {   // 中毒：一層一層疊（最多 5 層）
      t.st.poisonStacks = Math.min(5, (t.st.poison > 0 ? (t.st.poisonStacks || 0) : 0) + 1); t.st.poisonCap = 5;
      t.st.poisonUnit = Math.max(t.st.poisonUnit || 0, unit);
      t.st.poisonDmg = t.st.poisonUnit * t.st.poisonStacks;
      t.st.poison = Math.max(t.st.poison || 0, 100); t.st.poisonTick = Math.min(t.st.poisonTick || 30, 10); t.st.poisonSrc = src;
    }
    if (resist(t, actor)) {   // 灼熱：同上
      var b = t._burnDot && t._burnDot.left > 0 ? t._burnDot : null, n = Math.min(5, ((b && b.afkGtN) || 0) + 1), u = Math.max(((b && b.afkGtU) || 0), unit);
      t._burnDot = { left: 60, dmg: u * n, tick: 10, afkGtN: n, afkGtU: u };
    }
  };
  var SPELLS = [
    { n: '火紅流星雨', css: '#f87171', stat: 'meleeDmg', mr: false },
    { n: '金色沙塵暴', css: '#facc15', stat: 'magicDmg', mr: true },
    { n: '綠色毒霧', css: '#4ade80', stat: 'rangedDmg', mr: false, poison: true }
  ];
  var castSpell = function (actor) {
    var sp = SPELLS[Math.floor(Math.random() * SPELLS.length)], d = actor.d || {}, tot = 0, n = 0;
    (mapState.mobs || []).slice().forEach(function (m) {
      if (!m || m._dead || !(m.curHp > 0)) return;
      var v = (typeof roll === 'function' ? roll(4, 50) : 100) + Math.max(0, Number(d[sp.stat]) || 0) * 3;
      if (sp.mr) v *= (typeof mrMult === 'function' ? mrMult(m.mr || 0) : 1); else v = Math.max(1, v - (m.dr || 0));
      tot += hurt(actor, m, v); n++;
      if (sp.poison && m.curHp > 0) stacks(m, v, actor);
    });
    if (n) clog('<span class="font-bold" style="color:' + sp.css + '">【' + sp.n + '】</span>' + (actor === P() ? '你' : (actor._allyName || '傭兵')) + '的真‧吉爾塔斯之劍迸發異界之力，' + n + ' 個敵人共受到 ' + Math.floor(tot).toLocaleString() + ' 點傷害。', 'player');
  };
  var after = function (actor, t, hp0) {
    var w = actor && actor.eq && actor.eq.wpn && DB.items[actor.eq.wpn.id]; if (!w || !w.afkGtSword) return;
    var lost = t ? hp0 - Math.max(0, t.curHp) : 0;
    if (t && lost > 0 && !t._dead && t.curHp > 0) {
      var sv = player; if (actor !== P()) player = actor;
      try { if (typeof applyMobStatus === 'function') applyMobStatus(t, { kind: 'stun', dur: 3 }, '真‧吉爾塔斯之劍'); } catch (e) {}
      finally { player = sv; }
      stacks(t, lost, actor);
    }
    if (actor === P()) { if (!(actor.statuses.cleave > 0)) { actor.statuses.cleave = 20; try { calcStats(); } catch (e) {} } else actor.statuses.cleave = Math.max(actor.statuses.cleave, 20); }
    else actor._cleaveTicks = Math.max(actor._cleaveTicks || 0, 20);
    if (Math.random() < 0.65) castSpell(actor);
  };
  var wrapAtk = function (name, actorOf) {
    var o = W[name]; if (typeof o !== 'function') return;
    W[name] = function () {
      var actor = actorOf.apply(null, arguments), w = actor && actor.eq && actor.eq.wpn && DB.items[actor.eq.wpn.id];
      if (!w || !w.afkGtSword) return o.apply(this, arguments);
      var t = typeof getTarget === 'function' ? getTarget() : null, hp0 = t ? t.curHp : 0;
      var r = o.apply(this, arguments);
      try { after(actor, t, hp0); reap(); } catch (e) { console.warn('[AFK-giltas] sword', e); }
      return r;
    };
  };
  wrapAtk('playerAttack', function () { return P(); });
  wrapAtk('allyAttackOnce', function (a) { return a; });

  // ════ 支配者吉爾塔斯 變身卡（時空級，唯一）════
  //   效果同時空變身；裝備真‧吉爾塔斯之劍時另有：六項能力 +75、五屬性抗性 +300、最終減傷 +300
  var cardRow = null, CARD_ID = 'spacetime_giltas';
  try {
    var A = W.AFK_CARD_ASCENSION, F = W.AFK_CARD_FORMS;
    if (A && A.registerCatalog && F) {
      var base = (F.catalog.spacetime || []).filter(function (r) { return r.id === 'spacetime_knight'; })[0] || (F.catalog.spacetime || [])[0];
      var form = base ? clone(base.form) : { lv: 80, wlk: 16, cast: 7, stun: 2 };
      delete form.classMorph; form.n = '時空・支配者吉爾塔斯'; form.c = 'afk-card-spacetime'; form.cardMonster = '吉爾塔斯'; form.cardVisualBase = '吉爾塔斯';
      var lore = '奪回全身的異界霸主。卡裡封著的不只是牠的形貌，還有牠握劍時的那份支配。';
      var sp = '異界霸主（必須裝備真‧吉爾塔斯之劍）：六項能力各 +75、五屬性抗性各 +300、最終減傷 +300';
      A.registerCatalog({ spacetime: [{ id: CARD_ID, n: '時空・支配者吉爾塔斯', form: form, prototype: '吉爾塔斯', role: '異界霸主', lore: lore, unique: true, bonus: {}, special: sp,
        desc: lore + ' ' + (F.description ? F.description('spacetime') : '') + ' 唯一卡：只在異界祭壇掉落，不會從時空合成或碎片指定取得。特殊能力「' + sp + '」。' }] });
      cardRow = (A.catalog.spacetime || []).filter(function (r) { return r.id === CARD_ID; })[0] || null;
    }
  } catch (e) { console.warn('[AFK-giltas] card', e); }
  var dominion = function (p) {
    try {
      var f = p && p.poly; if (!f || f.cardAscensionId !== CARD_ID || !(p.buffs && p.buffs.poly > 0)) return false;
      var c = C(); if (c && c.active && !c.active(p)) return false;
      var w = p.eq && p.eq.wpn; return !!(w && isSword(w.id));
    } catch (e) { return false; }
  };
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = player; if (!p || !p.d || !dominion(p)) return r;
        ['resFire', 'resWater', 'resWind', 'resEarth', 'resNone'].forEach(function (k) { p.d[k] = (Number(p.d[k]) || 0) + 300; });
        p.d.finalDR = (Number(p.d.finalDR) || 0) + 300;
      } catch (e) {}
      return r;
    };
  }
  // 六項能力 +75：跟時空變身的 +50 走同一個早期掛點（才會影響傷害、HP 等衍生數值）
  var oldAttr = W.__afkAttrBoost;
  W.__afkAttrBoost = function (actor, d) { try { if (d && dominion(actor)) ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (k) { d[k] = (Number(d[k]) || 0) + 75; }); } catch (e) {} if (oldAttr) return oldAttr.apply(this, arguments); };
  var hookFinal = function () {
    var c = C(); if (!c || typeof c.finalDR !== 'function' || c._afkGtFinal) return;
    var o = c.finalDR; c._afkGtFinal = true;
    c.finalDR = function (actor) { var v = o.apply(this, arguments); return (Number(v) || 0) + (dominion(actor) ? 300 : 0); };
  };
  hookFinal(); W.addEventListener('load', hookFinal);

  W.AFK_GILTAS = { map: MAP, name: NAME, npc: NPC_ID, layers: LAYERS, enter: enter, combine: combine, run: function () { return run; }, startLayer: startLayer,
    rollSword: rollSword, ensureSword: ensureSword, isSword: isSword, cardId: CARD_ID, card: function () { return cardRow; }, dominion: dominion, rates: REWARD_RATE,
    timing: { barEvery: BAR_EVERY, barDur: BAR_DUR, deathEvery: DEATH_EVERY, deathDelay: DEATH_DELAY }, items: Object.keys(ITEMS), render: render };
  console.log('[AFK-giltas] 已啟用：吉爾塔斯副本「異界祭壇」（長老會議廳・次元裂隙）');
})();
