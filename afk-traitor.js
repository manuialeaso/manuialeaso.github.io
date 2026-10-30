/* ============================================================================
 * afk-traitor.js — 亞丁城副本「謀叛者的低語」（玩家 2026-10-26 指定）
 *
 * 開放條件（2026-10-28 改）：完成 80 級的亞丁的陰影或本職業 80 級專屬劇情，或持有亞丁城＋統一七座城堡；到亞丁城鎮或亞丁城（城堡內）找「伊菈（告密者）」進入。
 *   一般／席琳的世界／瘋狂席琳也開放，敵人依模式弱化（HP ×0.25／0.3／0.5、傷害 ×0.4／0.5／0.6，席琳夢域鏡是完整版）；主謀的席琳結晶依模式 2～5／5～10／10～20／20～40，昇華支配碎片只在席琳夢域鏡。
 * （原本：席琳夢域鏡中、持有亞丁城＋統一七座城堡才能進入）
 *   地圖下拉選單不再列出這張圖。人在副本裡時條件消失（失城）就被送回亞丁。
 * 出沒：
 *   ‧主謀三人（技能重新設計）
 *       冥皇丹特斯　　：用黑暗妖精聖地「真‧死亡騎士 冥皇丹特斯」的模組，數值弱化（HP 15 萬→11 萬、AC −120→−100、魔防 200→150…）
 *       反王肯恩(謀叛)：強化版（傲慢之塔 41～60 樓那隻只有 HP 1.4 萬）
 *       魔女賽尼斯(謀叛)：強化版（借用魔女賽尼斯的動畫）
 *     肯恩與賽尼斯都比傲慢之塔（含支配者傲慢之塔頂樓「邪惡的鐮刀死神(支配)」：Lv89、HP 7.7 萬、AC −85、魔防 85）強
 *   ‧追隨者：四大軍王（史雷佛、巴蘭卡、蕾雅、海露拜）＋八位長老（琪娜、艾迪爾、巴塔斯、巴洛斯、泰瑪斯、安迪斯、拉曼斯、巴陸德），
 *     直接沿用原本的怪物資料，能力值與技能都不改
 *   ‧三層（玩家 2026-10-26 二）：第一層八位長老 → 第二層四大軍王 → 第三層丹特斯＋肯恩＋賽尼斯。
 *     每層的頭目各出一次、打完全部才進下一層（同時在場：一、二層最多 2 隻，第三層 3 隻一起出）；
 *     第三層打完＝通關，回到亞丁城堡（持有亞丁城時；2026-10-30 起，原本回亞丁城鎮；沒有城的人仍回亞丁城鎮）。中途離開就重來。這張圖禁止離線掛機。
 * 掉落（主謀三人另外掉）：席琳結晶 20～40 顆；30% 昇華支配碎片 1～3 個
 * ========================================================================== */
(function () {
  'use strict';
  var __T = window.AFK_TOGGLES;
  if (__T && __T.register) __T.register({ id: 'traitor', name: '謀叛者的低語', desc: '亞丁的副本（冥皇丹特斯、反王肯恩、魔女賽尼斯）：完成 80 級的亞丁的陰影或職業專屬劇情、或持有亞丁城＋統一七城後，找伊菈進入；各模式都開放，一般／席琳／瘋狂席琳模式依序弱化', group: '遊戲玩法' });
  if (__T && !__T.enabled('traitor')) { console.log('[AFK] 外掛開關「謀叛者的低語」已關閉'); return; }
  var W = window;
  if (typeof DB === 'undefined' || !DB.mobs || !DB.maps || typeof MAP_REGIONS === 'undefined') return;
  var MAP = 'afk_traitor_whisper', NAME = '謀叛者的低語';
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  // ── 主謀三人 ──
  var sd = DB.mobs.sanct_dantes;
  var dantes = sd ? clone(sd) : { s: 'S', beh: '主動', race: '不死', un: true, boss: true, hard: true, e: 'none', atkSpd: 0.3, dmg: [2, 40] };
  Object.assign(dantes, { n: '冥皇丹特斯', lv: 95, hp: 110000, ac: -100, mr: 150, hit: 120, db: 30, atkSpd: 0.3, exp: 9000, goldMin: 50000, goldMax: 150000,
    rageHpPct: 0.3, rageHitMult: 1.15, rageDmgMult: 1.15, afkTraitor: true });
  dantes.mag = { skn: '冥皇之吻', cd: 80, chance: 0.25, dmg: [5, 100], db: 80, ele: 'none', alwaysHit: true, vampFull: true };
  dantes.mag2 = { skn: '冥界震裂', cd: 160, dmg: [5, 100], db: 300, ele: 'none', alwaysHit: true };
  dantes.mag3 = { skn: '死亡騎士的威壓', cd: 150, dmg: [3, 80], db: 150, ele: 'none', alwaysHit: true, sec: { type: 'stun', pbase: 200 } };
  delete dantes.mag4; delete dantes.mag5;

  var ken = { n: '反王肯恩(謀叛)', lv: 96, s: 'S', beh: '主動', race: '人形', boss: true, hard: true, e: 'none', hp: 300000, ac: -110, mr: 150, exp: 20000, goldMin: 100000, goldMax: 200000,
    atkSpd: 0.8, dmg: [5, 60], db: 120, hit: 145, regenHp: 1500, regenEvery: 50, seeInsight: true, rageHpPct: 0.3, rageHitMult: 1.2, rageDmgMult: 1.2, afkTraitor: true,
    mag: { skn: '叛王劍氣', cd: 50, chance: 0.5, dmg: [8, 60], db: 250, ele: 'none', alwaysHit: true, sec: { type: 'stun', pbase: 120 } },
    mag2: { skn: '謀叛者的號令', cd: 140, dmg: [6, 60], db: 300, ele: 'none', alwaysHit: true },
    mag3: { skn: '王權崩毀', type: 'armor_break', cd: 160, dur: 10, pct: 50 },
    mag4: { skn: '不屈的王氣', type: 'self_buff', buffKind: 'guard', cd: 200, drBase: 15, dr50: 15, drStep: 3 } };
  var senis = { n: '魔女賽尼斯(謀叛)', lv: 96, s: 'S', beh: '主動', race: '人形', boss: true, hard: true, e: 'none', hp: 260000, ac: -100, mr: 200, exp: 20000, goldMin: 100000, goldMax: 200000,
    atkSpd: 1.0, dmg: [4, 45], db: 80, hit: 140, rageHpPct: 0.3, rageHitMult: 1.2, rageDmgMult: 1.2, afkTraitor: true,
    mag: { skn: '魔女的黑暗雷擊', cd: 40, chance: 0.6, dmg: [8, 70], db: 200, ele: 'wind', alwaysHit: true },
    mag2: { skn: '墮落流星', cd: 120, dmg: [8, 60], db: 350, ele: 'fire', alwaysHit: true },
    mag3: { skn: '沉默詛咒', type: 'silence', cd: 150, pbase: 200 },
    mag4: { skn: '冰獄颶風', cd: 180, dmg: [6, 60], db: 250, ele: 'water', alwaysHit: true, sec: { type: 'freeze', pbase: 150 } },
    mag5: { skn: '魔女的再生', type: 'self_heal', cd: 300, healDice: [8000, 12000] } };
  var MAIN = { afk_traitor_dantes: dantes, afk_traitor_ken: ken, afk_traitor_senis: senis };
  Object.keys(MAIN).forEach(function (id) { if (!DB.mobs[id]) DB.mobs[id] = MAIN[id]; });
  try { if (typeof MOB_PARTY_AOE_SKILLS !== 'undefined' && MOB_PARTY_AOE_SKILLS.add) ['冥界震裂', '死亡騎士的威壓', '謀叛者的號令', '墮落流星', '冰獄颶風'].forEach(function (n) { MOB_PARTY_AOE_SKILLS.add(n); }); } catch (e) {}

  // 動畫：丹特斯用聖地那隻、肯恩沿用傲慢之塔肯恩的借用動畫、賽尼斯(謀叛)借用魔女賽尼斯
  try {
    var ALIAS = { '冥皇丹特斯': '真‧死亡騎士 冥皇丹特斯', '反王肯恩(謀叛)': '反王肯恩', '魔女賽尼斯(謀叛)': '魔女賽尼斯' };
    var get = function (n) { try { return (0, eval)(n); } catch (e) { return null; } };
    var SETS = ['MOB_ANIM_NAMES', 'MOB_ANIM_BAKED_SHADOW', 'MOB_SHADOW_TINT', 'MOB_ANIM_BIG', 'MOB_ANIM_SMALL', 'MOB_ANIM_SPRITE_SHADOW', 'MOB_ANIM_WEAPON_FX', 'MOB_ANIM_WEAPON_FX2', 'MOB_ANIM_8DIR'].map(get);
    var OBJS = ['MOB_ANIM_SKILL_FX', 'MOB_YLIFT', 'MOB_ANIM_DEATH_FX', 'BOSS_ENTRANCE_FX', 'MOB_HURT_SFX', 'MOB_KILL_SFX', 'MOB_ATTACK_SFX'].map(get);
    var names = get('MOB_ANIM_NAMES');
    Object.keys(ALIAS).forEach(function (n) {
      var src = ALIAS[n], target = (typeof MOB_ANIM_ALIAS !== 'undefined' && MOB_ANIM_ALIAS[src]) || src;
      if (!names || !names.has(src)) return;
      MOB_ANIM_ALIAS[n] = target;
      SETS.forEach(function (s) { if (s && s.has && s.has(src)) s.add(n); });
      OBJS.forEach(function (o) { if (o && o[src] != null && o[n] == null) o[n] = o[src]; });
    });
    var icon = { '冥皇丹特斯': 'assets/icons/monsters/真‧死亡騎士 冥皇丹特斯.png', '魔女賽尼斯(謀叛)': 'assets/icons/monsters/魔女賽尼斯.png' };
    Object.keys(MAIN).forEach(function (id) { var m = DB.mobs[id]; if (m && !m.img && icon[m.n]) m.img = icon[m.n]; });
  } catch (e) { console.warn('[AFK-traitor] 動畫', e); }

  // ── 地圖 ──
  var FOLLOW = ['de_king_slayer', 'de_king_baranka', 'de_king_laia', 'de_king_heruby',
    'de_elder_kina', 'de_elder_adiel', 'de_elder_batas', 'de_elder_balos', 'de_elder_taimas', 'de_elder_andis', 'de_elder_ramas', 'de_elder_balud'].filter(function (id) { return !!DB.mobs[id]; });
  var pool = FOLLOW.concat(Object.keys(MAIN));
  DB.maps[MAP] = pool;
  var KINGS = FOLLOW.filter(function (id) { return /^de_king_/.test(id); }), ELDERS = FOLLOW.filter(function (id) { return /^de_elder_/.test(id); });
  var LAYERS = [
    { n: '第一層・長老們的密議', ids: ELDERS, conc: 2, msg: '八位長老在燭光下低聲交談，察覺到你的瞬間同時轉過頭來。' },
    { n: '第二層・四大軍王的誓約', ids: KINGS, conc: 2, msg: '四大軍王拔出兵刃，誓言為冥皇守住這扇門。' },
    { n: '第三層・謀叛者的王座', ids: ['afk_traitor_dantes', 'afk_traitor_ken', 'afk_traitor_senis'], conc: 3, msg: '反王肯恩從王座上站起，魔女賽尼斯的低語與冥皇丹特斯的笑聲在密室裡迴盪。' }
  ];
  try { window.__afkNoOfflineMaps = (window.__afkNoOfflineMaps || []).concat([MAP]); } catch (e) {}
  var entry = { v: MAP, t: NAME, c: '#c084fc', afkTraitor: true };
  try { if (MAP_CATEGORIES && MAP_CATEGORIES.dungeon && !MAP_CATEGORIES.dungeon.some(function (m) { return m.v === MAP; })) MAP_CATEGORIES.dungeon.push(entry); } catch (e) {}
  var reg = MAP_REGIONS.filter(function (r) { return r.key === 'aden'; })[0];
  if (reg && !reg.maps.some(function (m) { return m.v === MAP; })) reg.maps.push({ v: MAP, t: NAME });
  try { SPECIAL_AREA_BG[MAP] = 'assets/area/1920x1080/崩壞的長老會議廳.jpg'; } catch (e) {}
  try { if (typeof MAP_DESC !== 'undefined' && !MAP_DESC[MAP]) MAP_DESC[MAP] = '亞丁城地底的密室裡，反王肯恩、魔女賽尼斯與冥皇丹特斯正低聲謀劃奪回王座。'; } catch (e) {}

  var ownsAden = function () {
    try { var cw = W.__afkCastleWar; if (cw && typeof cw.held === 'function') return cw.held().indexOf('aden') >= 0; } catch (e) {}
    try { return typeof clanGetCastleCity === 'function' && clanGetCastleCity(P()) === 'aden'; } catch (e) {}
    return false;
  };
  var heldN = function () { try { var cw = W.__afkCastleWar; return (cw && typeof cw.held === 'function') ? cw.held().length : 0; } catch (e) { return 0; } };
  var dreamOn = function () { var p = P(); return !!(p && p.sherineDream && p.sherineMad); };
  // 玩家 2026-10-28：80 級的職業任務會帶到這裡 → 一般／席琳的世界／瘋狂席琳也開放（依模式弱化）；
  //   進入條件：完成 80 級的「亞丁的陰影」或本職業 80 級專屬劇情，或持有亞丁城＋統一七城
  var questOk = function () { var p = P(); if (!p || typeof trialQStateFor !== 'function') return false; return trialQStateFor(p, 'aden80_' + p.cls) === 2 || trialQStateFor(p, 'saga80_' + p.cls) === 2; };
  var castleOk = function () { return ownsAden() && heldN() >= 7; };
  var unlocked = function () { var p = P(); return !!p && !p.classicMode && (questOk() || castleOk()); };
  // 依模式弱化（以席琳夢域鏡為完整版；各模式本身的怪物強化照舊套用）
  var modeKey = function () { var p = P(); if (!p) return 'normal'; return (p.sherineMad && p.sherineDream) ? 'dream' : p.sherineMad ? 'mad' : p.sherineWorld ? 'sherine' : 'normal'; };
  // 玩家 2026-10-28 晚：一般與席琳的世界再調低（一般模式的主謀 HP 跟傲慢之塔頂樓頭目同一個量級）
  var WEAK = { normal: { hp: 0.25, dmg: 0.4, n: '一般' }, sherine: { hp: 0.3, dmg: 0.5, n: '席琳的世界' }, mad: { hp: 0.5, dmg: 0.6, n: '瘋狂席琳' }, dream: { hp: 1, dmg: 1, n: '席琳夢域鏡' } };
  var MODE_HP = { normal: 1, sherine: 3, mad: 5, dream: 50 };   // 各模式本身的怪物 HP 倍率（席琳的世界 ×3、瘋狂席琳 ×5、夢域鏡再 ×10）
  var weaken = function (m) {
    var w = WEAK[modeKey()]; if (!m || !w || (w.hp >= 1 && w.dmg >= 1)) return;
    m.hp = Math.max(1, Math.round((m.hp || 1) * w.hp)); m.curHp = m.hp;
    var sc = function (o) { if (o && typeof o.db === 'number') o.db = Math.round(o.db * w.dmg); if (o && Array.isArray(o.dmg) && o.dmg.length === 2) o.dmg = [o.dmg[0], Math.max(1, Math.round(o.dmg[1] * w.dmg))]; };
    sc(m); Object.keys(m).forEach(function (f) { if (/^mag\d*$/.test(f) && m[f] && typeof m[f] === 'object') { m[f] = JSON.parse(JSON.stringify(m[f])); sc(m[f]); } });
    if (m.regenHp) m.regenHp = Math.round(m.regenHp * w.hp);
  };
  // 只能經由伊菈進入：下拉選單平常不列出；人在副本裡（或正由伊菈帶進去）才列出，切換地圖才不會出錯
  var entering = false;
  var listed = function () { return entering || (typeof mapState !== 'undefined' && mapState.current === MAP); };
  if (typeof W.regionMapList === 'function') {
    var oList = W.regionMapList;
    W.regionMapList = function () { var r = oList.apply(this, arguments); return (Array.isArray(r) && !listed()) ? r.filter(function (m) { return m && m.v !== MAP; }) : r; };
  }
  if (typeof W.mapOptDisabled === 'function') {
    var oDis = W.mapOptDisabled;
    W.mapOptDisabled = function (m) { if (m && m.v === MAP && !listed()) return true; return oDis.apply(this, arguments); };
  }
  // ── NPC 伊菈（告密者）：亞丁城（城堡內）──
  var NPC_ID = 'npc_traitor_ira', NPC_ID2 = 'npc_traitor_ira_town', CASTLE_TOWN = 'town_aden_castle';
  try {
    var ct = DB.towns && DB.towns[CASTLE_TOWN];
    if (ct) {
      ct.npcs = ct.npcs || [];
      if (!ct.npcs.some(function (n) { return n.id === NPC_ID; })) ct.npcs.push({ id: NPC_ID, n: '伊菈', title: '告密者', type: 'craft', d: '總是躲在城堡廊柱陰影裡的女子。她自稱曾是魔女賽尼斯的侍女，知道通往亞丁城地底密室的路。她說自己是為了亞丁才背叛主人。' });
      if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[NPC_ID]) NPC_SPR_FIXED[NPC_ID] = '914';   // 女性外型（同威頓村米米素材，異城不撞臉）
      if (typeof TOWN_NPC_POS_OVERRIDE !== 'undefined') (TOWN_NPC_POS_OVERRIDE[CASTLE_TOWN] = TOWN_NPC_POS_OVERRIDE[CASTLE_TOWN] || {})[NPC_ID] = [72, 58];
    }
    // 玩家 2026-10-28：完成 80 級任務的人不一定持有亞丁城 → 亞丁城鎮也有伊菈
    var at = DB.towns && DB.towns.town_aden;
    if (at && !(at.npcs || []).some(function (n) { return n.id === NPC_ID2; })) {
      at.npcs = at.npcs || [];
      at.npcs.push({ id: NPC_ID2, n: '伊菈', title: '告密者', type: 'craft', d: '總是躲在廊柱陰影裡的女子。她自稱曾是魔女賽尼斯的侍女，知道亞丁地底密室的入口。' });
      if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[NPC_ID2]) NPC_SPR_FIXED[NPC_ID2] = '914';
      if (typeof TOWN_NPC_POS_OVERRIDE !== 'undefined') (TOWN_NPC_POS_OVERRIDE.town_aden = TOWN_NPC_POS_OVERRIDE.town_aden || {})[NPC_ID2] = [52, 40];
    }
  } catch (e) { console.warn('[AFK-traitor] npc', e); }
  var clearDest = function () {   // 通關後回哪裡：持有亞丁城＝亞丁城堡（城堡安全區只有持有的血盟能待）；否則亞丁城鎮
    try { if (ownsAden() && DB.towns && DB.towns[CASTLE_TOWN]) return CASTLE_TOWN; } catch (e) {}
    return 'town_aden';
  };
  var enterDungeon = function () {
    if (!unlocked()) return false;
    entering = true;
    try { setMapSelectors(MAP); changeMap(true); } finally { entering = false; }
    try { var c = document.getElementById('town-interaction-container'); if (c) { c.classList.add('hidden'); c.classList.remove('flex'); } } catch (e) {}
    return true;
  };
  var renderIra = function (div) {
    var a = ownsAden(), n = heldN(), q = questOk(), ok = unlocked(), w = WEAK[modeKey()];
    var row = function (t, done) { return '<div>' + (done ? '<span class="text-emerald-300">✔</span>' : '<span class="text-slate-500">✘</span>') + ' ' + t + '</div>'; };
    div.innerHTML = '<div class="text-sm space-y-2">'
      + '<div class="text-slate-300">「噓……小聲點。反王肯恩還活著，他和賽尼斯大人、冥皇丹特斯就躲在這座城的地底下。'
      + (ok ? '你查到的已經夠多了，我帶你去密室的入口。」' : '等你查清楚亞丁的陰影，我再把密室的路告訴你。」') + '</div>'
      + '<div class="text-xs text-slate-400">進入條件（符合其中一項）</div>'
      + row('完成 80 級的「亞丁的陰影」或本職業 80 級專屬劇情', q)
      + row('持有亞丁城＋統一七座城堡（目前 ' + n + '／7' + (a ? '、持有亞丁城' : '') + '）', a && n >= 7)
      + '<div class="text-xs text-slate-400">目前模式：' + w.n + (w.hp < 1 ? '（敵人 HP ×' + w.hp + '、傷害 ×' + w.dmg + '；席琳夢域鏡是完整版）' : '（完整版）') + '</div>'
      + '<div class="text-xs text-slate-400">三層：八位長老 → 四大軍王 → 冥皇丹特斯＋反王肯恩(謀叛)＋魔女賽尼斯(謀叛)。中途離開要重來，禁止離線掛機。</div>'
      + '<button type="button" class="btn w-full mt-2" data-ira-enter="1"' + (ok ? '' : ' disabled') + '>潛入「' + NAME + '」</button></div>';
    div.onclick = function (e) {
      var b = e.target.closest('[data-ira-enter]'); if (!b || b.disabled) return;
      if (!enterDungeon()) sysMsg('<span class="text-amber-300">伊菈搖了搖頭：「條件還不夠。」</span>');
    };
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try { var div = document.getElementById('interaction-content'); if (div && (npcId === NPC_ID || npcId === NPC_ID2)) renderIra(div); } catch (e) { console.warn('[AFK-traitor] ui', e); }
      return r;
    };
  }
  // 城被打下時人在裡面：送回亞丁
  if (typeof W.tick === 'function') {
    var oTick = W.tick, last = 0;
    W.tick = function () {
      try { watchMap(); } catch (e) {}
      var r = oTick.apply(this, arguments);
      try {
        var t = Number(S().ticks) || 0;
        if (t - last >= 50 && typeof mapState !== 'undefined' && mapState.current === MAP && P()) {
          last = t;
          if (!unlocked()) { setMapSelectors('town_aden'); changeMap(true); if (typeof logSys === 'function') logSys('<span class="text-amber-300">' + (ownsAden() ? '天下不再歸一，' : '亞丁城易主，') + '密室的門在你身後關上了。你回到了亞丁。</span>'); }
        }
      } catch (e) {}
      return r;
    };
  }

  // ── 三層推進 ──
  var run = null;   // { layer, queue, killed, need }
  var sysMsg = function (h) { try { if (typeof logSys === 'function' && !S().ff) logSys(h); } catch (e) {} };
  var startLayer = function (i) {
    var L = LAYERS[i]; run = { layer: i, queue: L.ids.slice(), killed: 0, need: L.ids.length };
    sysMsg('<span class="font-bold" style="color:#c084fc">【謀叛者的低語】' + L.n + '</span>　' + L.msg + '（' + L.ids.length + ' 名，全部擊倒才能深入）');
  };
  var resetRun = function () { run = null; };
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      if (typeof mapState === 'undefined' || mapState.current !== MAP) return oSpawn.apply(this, arguments);
      if (!run) startLayer(0);
      if (run.done) { if (!mapState.mobs[idx] || mapState.mobs[idx]._dead) mapState.mobs[idx] = null; return; }
      var alive = (mapState.mobs || []).filter(function (m) { return m && !m._dead && m.curHp > 0; }).length;
      if (!run.queue.length || alive >= LAYERS[run.layer].conc) { if (!mapState.mobs[idx] || mapState.mobs[idx]._dead) mapState.mobs[idx] = null; return; }
      var id = run.queue.shift(), b = DB.mobs[id]; if (!b) return;
      mapState.mobs[idx] = Object.assign({}, b, { curHp: b.hp, uid: uid(), _born: ++_mobBornSeq, _bornMs: Date.now(), _magCd: {}, justHit: false, st: newMobStatus(), _afkTrLayer: run.layer + 1 });
      try { if (typeof applySherineBuff === 'function') applySherineBuff(idx); } catch (e) {}
      try { weaken(mapState.mobs[idx]); } catch (e) {}
      try { if (mapState.mobs[idx].hard && typeof initHardSkin === 'function') initHardSkin(mapState.mobs[idx]); } catch (e) {}
      try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(mapState.mobs[idx]); } catch (e) {}
      try { if (!S().ff) renderMobs(); } catch (e) {}
    };
  }
  var lastMap = null;
  var watchMap = function () { var cur = (typeof mapState !== 'undefined') ? mapState.current : null; if (cur !== lastMap) { if (cur === MAP || lastMap === MAP) resetRun(); lastMap = cur; } };

  // ── 主謀掉落 ──
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null;
      var r = oKill.apply(this, arguments);
      try {
        if (m && m._dead && m.afkTraitor && !m._afkTrPaid && P()) {
          m._afkTrPaid = true;
          var CR = { dream: [20, 40], mad: [10, 20], sherine: [5, 10], normal: [2, 5] }[modeKey()] || [2, 5];   // 依模式弱化
          var c = CR[0] + Math.floor(Math.random() * (CR[1] - CR[0] + 1)); gainItem('sherine_crystal', c, true);
          var extra = '';
          if (modeKey() === 'dream' && DB.items.afk_asc_shard && Math.random() < 0.3) { var k = 1 + Math.floor(Math.random() * 3); gainItem('afk_asc_shard', k, true); extra = '、昇華支配碎片 × ' + k; }
          if (typeof logSys === 'function') logSys('<span class="text-fuchsia-300">' + m.n + ' 倒下了，留下席琳結晶 × ' + c + extra + '。</span>');
        }
      } catch (e) { console.warn('[AFK-traitor] drop', e); }
      try {
        if (m && m._dead && m._afkTrLayer && !m._afkTrCounted && run && !run.done && mapState.current === MAP) {
          m._afkTrCounted = true; run.killed++;
          if (run.killed >= run.need) {
            if (run.layer + 1 < LAYERS.length) { var nx = run.layer + 1; sysMsg('<span class="text-emerald-300">' + LAYERS[run.layer].n.split('・')[0] + '肅清完畢，你推開通往更深處的門。</span>'); startLayer(nx); }
            else {
              run = { done: true, layer: LAYERS.length - 1, queue: [], killed: 0, need: 0 };
              var backTo = clearDest();   // 玩家 2026-10-30 17:24：打完回亞丁城堡（持有亞丁城時；沒有城的人照城堡規則回亞丁城鎮）
              sysMsg('<span class="text-yellow-300 font-bold">🏆 謀叛者全數伏誅！亞丁的王座保住了。</span>你帶著戰果回到' + (backTo === CASTLE_TOWN ? '亞丁城堡' : '亞丁') + '。');
              setTimeout(function () { try { if (mapState.current === MAP) { setMapSelectors(backTo); changeMap(true); try { saveGame(); } catch (e) {} } } catch (e) {} }, 1500);
            }
          }
        }
      } catch (e) { console.warn('[AFK-traitor] layer', e); }
      return r;
    };
  }

  W.AFK_TRAITOR = { weak: WEAK, modeHp: MODE_HP, modeKey: modeKey, map: MAP, name: NAME, ownsAden: ownsAden, clearDest: clearDest, castleTown: CASTLE_TOWN, unlocked: unlocked, npc: NPC_ID, enter: enterDungeon, renderIra: renderIra, main: Object.keys(MAIN), followers: FOLLOW, pool: pool, layers: LAYERS, run: function () { return run; }, startLayer: startLayer };
  console.log('[AFK-traitor] 已啟用：亞丁城副本「謀叛者的低語」（持有亞丁城＋統一七城，經由亞丁城的伊菈進入）');
})();
