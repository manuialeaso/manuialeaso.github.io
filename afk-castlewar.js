/* ============================================================================
 * afk-castlewar.js — 血盟城堡擴張與統一天下（玩家 2026-10-21 指定）
 *
 * 城堡
 *   ‧七座城都能攻：原本的肯特、風木、海音之外，開放奇岩城、妖魔堡、侏儒城、亞丁城（沿用前三座的兩階段攻城：
 *     外門區打城門 → 內城打守護塔），各有自己的外門區、內城、城堡地圖與背景
 *   ‧打下來的城會一直留著（最多 7 座）；遊戲本身只記得「最近打下的那一座」當主城（城堡傳送、商店折扣照舊用它）
 * 收成（每小時，同模式共用）
 *   ‧3 座以上：每小時 500 萬金幣；5 座以上：再加每小時 100 龍之鑽石（可疊加）
 *   ‧7 座＝統一天下：每小時 100 龍之鑽石＋1,000 萬金幣＋100 席琳結晶
 * 宣戰
 *   ‧只有 1 座城：沒人對你宣戰；每多 1 座，對你宣戰的血盟 +2；統一天下：所有血盟都對你宣戰
 *   ‧宣戰中：殺敵對血盟的人不會變紅；狩獵時場上強制多 1 名敵對血盟 NPC（席琳夢域鏡也是：王＋敵對 NPC）
 *   ‧敵對 NPC 是王族時，5% 機率呼朋引伴：場上同時出滿 5 名敵對玩家（席琳夢域鏡：王＋4 名）
 *   ‧敵人越殺越強（累計擊殺數）：100 全身 +3、500 一次 2 人、1000 全身遺物 +0、1500 一次 3 人、2000 遺物 +5、
 *     3000 +10、4000 +15、5000 減傷 10%、6000 20%、7000 30%、8000 昇華支配 +0、9000 昇華支配 +5（＝跟你 1:1 的影子）
 *     做法：敵人的 HP、攻擊、防禦、命中、攻速按你本人的數值乘上強度比例（9000 以後 1:1），減傷用 HP 換算
 *     2026-10-26：基準改成「面板 ×2」——不看卡冊圖鑑、不吃變身效果（HP、一般攻擊傷害、命中、AC、魔防都 ×2）
 *   ‧強制宣戰（2026-10-26）：每 8 小時（真實時間）30% 機率，30 個 NPC 血盟裡隨機一個強制對你宣戰，持續 4 小時（不看持有幾座城）。
 *     期間狩獵每次出怪 5% 遇到該血盟的敵對玩家；用傳送控制戒指找王時必定再來 2 名。
 *     強制宣戰的敵對玩家強度＝目前地圖怪物的平均能力（等級、HP、攻擊、AC、魔防、命中）＋你的面板 ×0.3
 *   ‧擊殺數是「連續」的：你死亡就歸零（強度階段與投降進度一起重算）
 *   ‧統一天下：連續擊殺 1 萬名敵對 NPC → 全體血盟投降、宣戰結束；統一期間敵對 NPC 不掉任何東西，
 *     席琳夢域鏡中則照常有機會掉遺物
 * 2026-10-25 玩家指定
 *   ‧攻城難度隨持有城數遞增（2026-10-26 二改）：最多多三波守軍、每波 5 名——1 座城起門口一波、3 座起進內城一波、5 座起搶塔一波；
 *     攻城守軍（含內城）的傷害、命中各 +10%、受到的傷害 −10%（以 HP 換算）
 *   ‧離線掛機期間每跨過一次（UTC+8）凌晨 00:00，有 5% 機率隨機一座城被別的血盟攻下（2026-10-28；在線上跨過午夜不判定）
 *   ‧一萬人事件（統一後全伺服器宣戰）只會發生一次：投降、或統一被打破後就永久解除；之後再統一＝直接天下太平
 *   ‧統一天下中（或曾經統一過）：PVP 死亡噴裝不會噴到昇華支配 +5 遺物（含至高的支配）
 * 2026-10-30 20:43 玩家指定
 *   ‧收成照現實時間算（關掉遊戲也算），進遊戲馬上結算，一次最多補 7 天
 *   ‧攻城打輸：30 分鐘內帳號裡所有角色（16 格）都不能宣戰
 * 需要核心補丁 27（新城走舊制攻城、宣戰強制敵對 NPC 的掛點）。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('castlewar')) return;
  if (typeof SIEGE_CITY === 'undefined' || typeof CLAN_CASTLE_NAMES === 'undefined' || typeof window.clanSetCastle !== 'function') { console.warn('[AFK-castlewar] 找不到攻城／血盟系統，略過'); return; }

  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };

  // ── 四座新城 ──
  var NEW = {
    giran:        { name: '奇岩城', short: '奇岩',   tpl: 'kent',     hp: 1.2, bg: ['奇岩外門區', '奇岩內城', '奇岩城'] },
    orc_fortress: { name: '妖魔堡', short: '妖魔堡', tpl: 'windwood', hp: 1.2, bg: ['妖魔堡外門區', '妖魔堡內城', '妖魔堡'] },
    dwarf_castle: { name: '侏儒城', short: '侏儒城', tpl: 'kent',     hp: 1.3, bg: ['侏儒城外門區', '侏儒城內城', '侏儒城'] },
    aden:         { name: '亞丁城', short: '亞丁',   tpl: 'heine',    hp: 1.6, bg: ['亞丁外門區', '亞丁內城', '亞丁城'] }
  };
  var ALL_CITIES = ['kent', 'windwood', 'heine', 'giran', 'orc_fortress', 'dwarf_castle', 'aden'];
  var GATE_TPL = { kent: 'siege_gate_kent', windwood: 'siege_gate_ww', heine: 'siege_gate_heine' };
  var TOWER_TPL = { kent: 'siege_tower_kent', windwood: 'siege_tower_ww', heine: 'siege_tower_heine' };
  var pickTpl = function (map, key) { var ids = (DB.maps[SIEGE_CITY[key][map]] || []); return ids[0]; };
  try {
    Object.keys(NEW).forEach(function (key) {
      var C = NEW[key], tpl = SIEGE_CITY[C.tpl];
      var outer = key + '_outer', inner = key + '_inner', castle = 'town_' + key + '_castle';
      var gate = C.short + '城門', tower = C.short + '守護塔';
      if (key === 'dwarf_castle' || key === 'orc_fortress') { gate = C.name + '城門'; tower = C.name + '守護塔'; }
      SIEGE_CITY[key] = { key: key, name: C.name, outer: outer, outerName: C.bg[0], inner: inner, innerName: C.bg[1], castle: castle, castleName: C.name, gate: gate, tower: tower };
      CLAN_CASTLE_NAMES[key] = C.name;
      // 城門、守護塔：複製樣板城的，換名字、HP 加成
      var gT = DB.mobs[pickTpl('outer', C.tpl) || GATE_TPL[C.tpl]], tT = DB.mobs[pickTpl('inner', C.tpl) || TOWER_TPL[C.tpl]];
      if (gT && !DB.mobs['siege_gate_' + key]) { var g = JSON.parse(JSON.stringify(gT)); g.n = gate; g.hp = Math.round((g.hp || 10000) * C.hp); DB.mobs['siege_gate_' + key] = g; }
      if (tT && !DB.mobs['siege_tower_' + key]) { var t = JSON.parse(JSON.stringify(tT)); t.n = tower; t.hp = Math.round((t.hp || 15000) * C.hp); DB.mobs['siege_tower_' + key] = t; }
      DB.maps[outer] = ['siege_gate_' + key]; DB.maps[inner] = ['siege_tower_' + key];
      if (SIEGE_OUTER_INNER.indexOf(outer) < 0) SIEGE_OUTER_INNER.push(outer, inner);
      if (SIEGE_CASTLES.indexOf(castle) < 0) SIEGE_CASTLES.push(castle);
      // 背景
      try { C.bg.forEach(function (n) { AREA_1920.add(n); }); } catch (e) {}
      try { SPECIAL_AREA_BG[outer] = 'assets/area/1920x1080/' + C.bg[0] + '.jpg'; SPECIAL_AREA_BG[inner] = 'assets/area/1920x1080/' + C.bg[1] + '.jpg'; } catch (e) {}
      try { TOWN_BG_1920[castle] = C.bg[2]; } catch (e) {}
      // 城堡（安全區）：倉庫、傭兵公會、血盟
      if (!DB.towns[castle]) {
        DB.towns[castle] = { n: C.name, npcs: [
          { id: 'npc_wh_' + key, n: '城堡管家', title: '倉庫', type: 'warehouse', d: C.name + '的管家替你存放物品與金幣，存檔角色共用。' },
          { id: 'npc_ally_' + key + 'c', n: '傭兵公會', title: '協力', type: 'ally', d: '傭兵公會替你牽起命運的絲線，召喚其他存檔位的角色一起作戰。' },
          { id: 'npc_esti', n: '依詩蒂', title: '血盟', type: 'pledge', d: '依詩蒂低聲訴說著血盟的古老誓言，為你尋找以血為盟的夥伴。' },
          { id: 'npc_tros', n: '特羅斯', title: '血盟', type: 'pledge', d: '特羅斯握劍而立，為你尋找以血為盟的夥伴。' }
        ] };
      }
      // 魔物追蹤（玩家 2026-10-28：每座城堡都要有；同肯特奧貝勒、風木赫特、海音帝倫）
      var TRK = { giran: ['卡斯汀', '卡斯汀追著魔物留下的足跡走遍奇岩，花費金幣追蹤指定地區的特定魔物。'], aden: ['羅德瑞克', '羅德瑞克替亞丁王室偵察各地的魔物，花費金幣追蹤指定地區的特定魔物。'],
        orc_fortress: ['格魯卡', '格魯卡是妖魔堡的老斥候，嗅得出魔物的氣味，花費金幣追蹤指定地區的特定魔物。'], dwarf_castle: ['布倫丁', '布倫丁帶著侏儒的地圖與羅盤，花費金幣追蹤指定地區的特定魔物。'] };
      if (TRK[key] && DB.towns[castle] && !DB.towns[castle].npcs.some(function (x) { return x.id === 'npc_track_' + key; }))
        DB.towns[castle].npcs.push({ id: 'npc_track_' + key, n: TRK[key][0], title: '魔物追蹤', type: 'exchange', d: TRK[key][1] });
      try { if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED['npc_track_' + key]) NPC_SPR_FIXED['npc_track_' + key] = '1049'; } catch (e) {}
    });
    // 動畫：城門／守護塔沿用樣板城的動畫
    var get = function (n) { try { return (0, eval)(n); } catch (e) { return null; } };
    var names = get('MOB_ANIM_NAMES');
    Object.keys(NEW).forEach(function (key) {
      [['siege_gate_', 'outer'], ['siege_tower_', 'inner']].forEach(function (pr) {
        var mine = DB.mobs[pr[0] + key], src = DB.mobs[pickTpl(pr[1], NEW[key].tpl)];
        if (!mine || !src) return;
        if (!mine.img && src.img) mine.img = src.img;
        if (names && names.has && names.has(src.n) && typeof MOB_ANIM_ALIAS !== 'undefined') { MOB_ANIM_ALIAS[mine.n] = MOB_ANIM_ALIAS[src.n] || src.n; names.add(mine.n); }
      });
    });
    // 攻城選單：四座新城開放，走舊制流程
    window.__afkLegacyCastles = new Set(Object.keys(NEW));
    if (window.SiegeV2 && Array.isArray(SiegeV2.castles)) SiegeV2.castles.forEach(function (c) { if (NEW[c.id]) { c.enabled = true; c.legacy = true; } });
  } catch (e) { console.warn('[AFK-castlewar] 新城建立失敗', e); }

  // ── 共用資料（同模式所有角色共用；存在 localStorage）──
  var KEY = 'afk_castlewar_v1';
  var modeKey = function () { try { return (typeof clanModeKey === 'function') ? clanModeKey(P()) : (P() && P().classicMode ? 'classic' : 'normal'); } catch (e) { return 'normal'; } };
  var readAll = function () { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  var data = function () {
    var all = readAll(), k = modeKey(), d = all[k] || {};
    d.castles = Array.isArray(d.castles) ? d.castles.filter(function (c) { return ALL_CITIES.indexOf(c) >= 0; }) : [];
    d.kills = Math.max(0, Math.floor(Number(d.kills) || 0));
    d.warIds = Array.isArray(d.warIds) ? d.warIds : [];
    d.lastPay = Number(d.lastPay) || 0;
    d.surrendered = !!d.surrendered;
    d.everUnified = !!d.everUnified || d.castles.length >= 7;
    d.allWarDone = !!d.allWarDone || d.surrendered;
    d.lossDay = d.lossDay || '';
    return d;
  };
  var save = function (d) { try { var all = readAll(); all[modeKey()] = d; localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {} };
  // 已持有城堡＝我們的清單 ＋ 遊戲記錄的主城
  var held = function () {
    var d = data(), main = null;
    try { main = (typeof clanGetCastleCity === 'function') ? clanGetCastleCity(P()) : null; } catch (e) {}
    if (main && d.castles.indexOf(main) < 0) { d.castles.push(main); save(d); }
    return d.castles.slice();
  };
  var unified = function () { return held().length >= 7; };

  // 攻城獲勝：加進清單（不放棄原本的城）
  var oSet = window.clanSetCastle;
  window.clanSetCastle = function (city) {
    var r = oSet.apply(this, arguments);
    try {
      if (r && r.ok) {
        var d = data(); if (d.castles.indexOf(city) < 0 && d.castles.length < 7) d.castles.push(city);
        if (r.previous && d.castles.indexOf(r.previous) < 0 && d.castles.length < 7) d.castles.push(r.previous);
        save(d);
        var n = d.castles.length;
        if (n >= 7 && !d.everUnified) { d.everUnified = true; save(d); }
        if (n >= 7 && d.allWarDone) sys('<span class="text-yellow-300 font-bold">天下再度歸一。反賊早已投降，這一次沒有人再舉旗反抗。</span>');
        sys('<span class="text-yellow-300 font-bold">血盟的旗幟飄揚在 ' + n + ' 座城堡之上' + (n >= 7 ? '——天下歸一。' : '。') + '</span>' + (n >= 2 && n < 7 ? '（' + ((n - 1) * 2) + ' 個血盟向你宣戰）' : ''));
        if (r.previous && r.previous !== city) r.previous = null;   // 原本的城沒有放棄
        syncWar(true);
      }
    } catch (e) {}
    return r;
  };
  // 已持有的城不能再打
  if (typeof window.startSiege === 'function') {
    var oStart = window.startSiege;
    window.startSiege = function (faction, city) {
      try { if (city && held().indexOf(city) >= 0) { alert('你的血盟已經持有' + (SIEGE_CITY[city] ? SIEGE_CITY[city].name : '這座城') + '。'); return; } } catch (e) {}
      return oStart.apply(this, arguments);
    };
  }

  // 城堡（安全區）放進所屬地區的地圖清單：持有的每一座都看得到
  var REGION_OF = { kent: 'kent', windwood: 'windwood', heine: 'heine', giran: 'giran', aden: 'aden', orc_fortress: 'burningwillow', dwarf_castle: 'witon' }   // 妖魔堡在燃柳地區、侏儒城在威頓地區;
  if (typeof window.mapRegionOf === 'function') {
    var oRegion = window.mapRegionOf;
    window.mapRegionOf = function (v) { var r = oRegion.apply(this, arguments); return (r === 'orc_fortress' || r === 'dwarf_castle') ? REGION_OF[r] : r; };
  }
  if (typeof window.regionMapList === 'function') {
    var oList = window.regionMapList;
    window.regionMapList = function (rk) {
      var out = oList.apply(this, arguments);
      try {
        if (rk === 'siege' || !P()) return out;
        held().forEach(function (c) {
          var cfg = SIEGE_CITY[c]; if (!cfg || REGION_OF[c] !== rk) return;
          if (!out.some(function (m) { return m && m.v === cfg.castle; })) out = [{ v: cfg.castle, t: cfg.castleName }].concat(out);
        });
      } catch (e) {}
      return out;
    };
  }
  if (typeof window.getLastTown === 'function') {
    var oLast = window.getLastTown;
    window.getLastTown = function () {
      try { var t = P() && P().lastTownVisited, h = held(); if (t && h.some(function (c) { return SIEGE_CITY[c] && SIEGE_CITY[c].castle === t; })) return t; } catch (e) {}
      return oLast.apply(this, arguments);
    };
  }

  // ── 沒持有的城堡、空白地圖：送回村莊（玩家 2026-10-30 00:34 攻城回報）──
  //   地圖選單只列出持有的城堡；要去一座已經失去的城（例如離線跨午夜被打下、最後停留的村莊還是那座城）時，
  //   核心 changeMap 讀到的目的地是空字串，角色就卡在「沒有名字、沒有怪」的空白地圖。這裡在換圖前把目的地換成家鄉村莊，
  //   每秒也檢查一次：人在失去的城堡或空白地圖上（不在攻城中）就送回村莊。
  var castleTownOf = function (v) { for (var i = 0; i < ALL_CITIES.length; i++) { var c = SIEGE_CITY[ALL_CITIES[i]]; if (c && c.castle === v) return ALL_CITIES[i]; } return null; };
  var homeSafe = function () {
    var t = null; try { t = getHomeTown(); } catch (e) {}
    var c = castleTownOf(t); if (!t || (c && held().indexOf(c) < 0)) t = (typeof player !== 'undefined' && player && player.cls && typeof CLASS_HOME !== 'undefined' && CLASS_HOME[player.cls]) || 'town_talking';
    return t;
  };
  var badTarget = function (v) { if (!v) return true; var c = castleTownOf(v); return !!(c && held().indexOf(c) < 0); };
  if (typeof window.changeMap === 'function') {
    var oChange = window.changeMap;
    window.changeMap = function () {
      try {
        var sel = document.getElementById('map-select'), v = sel ? sel.value : '';
        if (P() && badTarget(v) && typeof setMapSelectors === 'function') {
          var home = homeSafe();
          if (home && home !== v) { setMapSelectors(home); if (castleTownOf(v)) sys('<span class="text-amber-300">血盟已經不再持有' + (SIEGE_CITY[castleTownOf(v)] ? SIEGE_CITY[castleTownOf(v)].castleName : '這座城堡') + '，改回村莊。</span>'); }
        }
      } catch (e) {}
      return oChange.apply(this, arguments);
    };
  }
  var watchLost = function () {
    try {
      var p = P(); if (!p || typeof mapState === 'undefined' || (p.siege && p.siege.active)) return;
      var cur = mapState.current, c = castleTownOf(cur);
      if (cur === '' || (c && held().indexOf(c) < 0)) {
        var home = homeSafe(); if (!home || home === cur) return;
        if (c) sys('<span class="text-amber-300 font-bold">血盟已經不再持有' + SIEGE_CITY[c].castleName + '，你被送回村莊。</span>');
        setMapSelectors(home); changeMap(true); try { updateUI(); saveGame(); } catch (e) {}
      }
    } catch (e) {}
  };
  setInterval(watchLost, 1000);
  window.__afkCastleTownOf = castleTownOf; window.__afkCastleWatch = watchLost;

  // ── 宣戰 ──
  var warTarget = function (d) {
    var n = held().length;
    if (n <= 1) return 0;
    if (n >= 7) return d.allWarDone ? 0 : Infinity;   // 一萬人事件只有第一次統一會發生
    return (n - 1) * 2;
  };
  var syncWar = function (force) {
    var p = P(); if (!p || typeof _clanWithLock !== 'function' || !(typeof clanGetModeInfo === 'function' && clanGetModeInfo(p))) return;
    var d = data(), want = warTarget(d), mode = modeKey();
    try { if (typeof npcClanEnsureWorld === 'function') npcClanEnsureWorld(p); } catch (e) {}
    var res = _clanWithLock(function (st) {
      var w = st.npcWorlds && st.npcWorlds[mode]; if (!w || !Array.isArray(w.clans)) return { commit: false };
      var clans = w.clans.filter(Boolean);
      var keep = d.warIds.filter(function (id) { return clans.some(function (c) { return c.id === id; }); });
      var pool = clans.filter(function (c) { return keep.indexOf(c.id) < 0; }).sort(function (a, b) { return (b.hatred || 0) - (a.hatred || 0) || String(a.id).localeCompare(String(b.id)); });
      var target = want === Infinity ? clans.length : Math.min(clans.length, want);
      while (keep.length > target) keep.pop();
      while (keep.length < target && pool.length) keep.push(pool.shift().id);
      var changed = false;
      clans.forEach(function (c) {
        var on = keep.indexOf(c.id) >= 0;
        if (on && !c.hostile) { c.hostile = true; c.known = true; changed = true; }
        if (!on && c.hostile && d.warIds.indexOf(c.id) >= 0) { c.hostile = false; changed = true; }
      });
      d.warIds = keep;
      return changed ? {} : { commit: false };
    });
    save(d);
    try { if (d.warIds.length) p.pvpOn = true; } catch (e) {}
    return res;
  };
  var warSet = function () { return new Set(data().warIds); };
  var isWarMob = function (m, ws) { return !!(m && m.trollPlayer && m._npcClanId && (ws || warSet()).has(m._npcClanId)); };
  // 殺敵對血盟的人不會變紅
  if (typeof window.npcClanKillIgnoresAlignment === 'function') {
    var oIgn = window.npcClanKillIgnoresAlignment;
    window.npcClanKillIgnoresAlignment = function (mob) { if (isWarMob(mob) || isForcedMob(mob)) return true; return oIgn.apply(this, arguments); };
  }

  // ── 強度階段 ──
  var TIERS = [
    [9000, 1.00, 0.30, '昇華支配 +5（你的影子）'], [8000, 0.93, 0.30, '昇華支配 +0'], [7000, 0.85, 0.30, '遺物 +15・減傷 30%'],
    [6000, 0.85, 0.20, '遺物 +15・減傷 20%'], [5000, 0.85, 0.10, '遺物 +15・減傷 10%'], [4000, 0.85, 0, '遺物 +15'],
    [3000, 0.75, 0, '遺物 +10'], [2000, 0.65, 0, '遺物 +5'], [1000, 0.55, 0, '遺物 +0'], [100, 0.40, 0, '全身 +3']
  ];
  var tierOf = function (k) { for (var i = 0; i < TIERS.length; i++) if (k >= TIERS[i][0]) return TIERS[i]; return null; };
  var groupSize = function (k) { return k >= 1500 ? 3 : (k >= 500 ? 2 : 1); };
  // 玩家 2026-10-26：敵對血盟改用「面板」當基準——不看變身卡冊、怪物卡冊、變身收集冊，也不吃變身效果，
  //   只看你脫掉變身、拿掉卡冊後的面板 ×2（HP、一般攻擊傷害、命中、AC、魔防都 ×2），再乘強度階段比例
  var panelCache = null;
  var panelOf = function () {
    var p = P(); if (!p) return null;
    var now = (S().ticks || 0);
    if (panelCache && panelCache.p === p && now - panelCache.t < 300) return panelCache.v;
    var v = null, save = player;
    try {
      var c = JSON.parse(JSON.stringify(p));
      c.poly = null; c.buffs = c.buffs || {}; c.buffs.poly = 0; c._setPoly = null;
      delete c.cardAscension; delete c.polyDex; c.cardDex = {}; c.allies = []; c.summonsV2 = [];
      var hadFlag = (typeof _recomputingAlly !== 'undefined') ? _recomputingAlly : false;
      player = c; try { _recomputingAlly = true; } catch (e) {}
      try { recomputeStats(); } finally { player = save; try { _recomputingAlly = hadFlag; } catch (e) {} }
      var d = c.d || {}, w = c.eq && c.eq.wpn, wd = w && DB.items[w.id];
      var die = wd ? ((Number(wd.dmgS) || 1) + 1) / 2 + (Number(w.en) || 0) : 2;
      var atk = die + Math.max(Number(d.meleeDmg) || 0, Number(d.rangedDmg) || 0) + (Number(d.extraDmg) || 0);
      v = { hp: c.mhp || p.mhp || 1000, hit: Math.max(1, atk), ac: Number(d.ac) || 0, mr: Number(d.mr) || 0, acc: Math.max(Number(d.meleeHit) || 0, Number(d.rangedHit) || 0) };
    } catch (e) { player = save; v = null; }
    panelCache = { p: p, t: now, v: v };
    return v;
  };
  var shadowScale = function (m, k) {
    var t = tierOf(k), p = P(); if (!t || !p || !p.d) return;
    var r = t[1], dr = t[2], d = p.d, pn = panelOf();
    var hit = pn ? pn.hit * 2 : Math.max(10, ((Number(d.meleeDmg) || 0) + 20) * 2);
    var hp = Math.round((pn ? pn.hp * 2 : (p.mhp || 1000)) * r / (1 - dr));
    m.hp = hp; m.curHp = hp;
    var e = Math.max(1, Math.round(hit * r));
    m.dmg = [1, Math.max(1, Math.round(e * 0.4))]; m.db = Math.max(0, Math.round(e * 0.8));
    m.lv = p.lv || m.lv || 1;
    m.ac = Math.round((pn ? pn.ac * 2 : (Number(d.ac) || 0)) * r);   // 2026-10-26：AC、魔防也 ×2
    m.mr = Math.round((pn ? pn.mr * 2 : (Number(d.mr) || 0)) * r);
    m.hit = Math.round((pn ? pn.acc * 2 : Math.max(Number(d.meleeHit) || 0, Number(d.rangedHit) || 0)) * r);
    try { var iv = (typeof playerAttackIntervalTicks === 'function') ? playerAttackIntervalTicks() / 10 : 1; m.atkSpd = Math.max(0.5, iv); } catch (e) {}
    m._afkShadow = t[3];
  };

  // ── 場上強制敵對 NPC ──
  var huntMap = function () {
    var ms = (typeof mapState !== 'undefined') ? mapState : null; if (!ms || !ms.current) return false;
    var c = String(ms.current);
    if (c.indexOf('town_') === 0 || c === 'rift_battle' || c.indexOf('siege') === 0) return false;
    if (typeof isSiegeArea === 'function' && isSiegeArea(c)) return false;
    if (typeof ANTHARAS_AREA_BOSS !== 'undefined' && ANTHARAS_AREA_BOSS[c]) return false;
    try { if (window.__afkDreamStar && window.__afkDreamStar.on()) return false; } catch (e) {}
    return true;
  };
  var live = function (m) { return m && !m._dead && m.curHp > 0; };
  var dream = function () { var p = P(); return !!(p && p.sherineDream && p.sherineMad); };
  var call = null;   // 呼朋引伴：{ map, need, filled }
  window.__afkHostileCall = function () { return forceNext > 0 || !!(call && typeof mapState !== 'undefined' && call.map === mapState.current && !call.filled); };
  var hostilesOnField = function (ws) { return mapState.mobs.filter(function (m) { return live(m) && isWarMob(m, ws); }).length; };
  var need = function () {
    var d = data(); if (!d.warIds.length || !huntMap()) return 0;
    if (window.__afkHostileCall()) return call.need;
    return groupSize(d.kills);
  };
  window.__afkWantHostile = function (idx) {
    try { if (forceNext > 0) return true; var n = need(); if (!n) return false; return hostilesOnField() < n; } catch (e) { return false; }
  };
  var forcedOpponent = function () {
    var f = forced(); if (!f) return null;
    var onF = mapState.mobs.filter(Boolean).map(function (m) { return m.n; });
    var sp = pvpCreateRandomOpponent(onF, { warEncounter: true, encounterClanIds: [f.clanId], enemyClanChance: 1 });
    if (!sp || !sp.clanId) return null;
    return { mobId: trollPickClassMob(sp.avatar), spawn: sp };
  };
  window.__afkForceTroll = function (idx, mobId) {
    try {
      if (forceNext > 0) { forceNext--; return forcedOpponent(); }
      if (forced() && huntMap() && !(DB.mobs[mobId] && DB.mobs[mobId].boss) && !(need() && hostilesOnField() < need()) && Math.random() < FW_MEET) return forcedOpponent();
      if (!window.__afkWantHostile(idx)) return null;
      var base = DB.mobs[mobId]; if (base && base.boss) return null;   // 王照出
      var onF = mapState.mobs.filter(Boolean).map(function (m) { return m.n; });
      var sp = pvpCreateRandomOpponent(onF, { warEncounter: true, encounterClanIds: data().warIds, enemyClanChance: 1 });
      if (!sp || !sp.clanId) return null;
      return { mobId: trollPickClassMob(sp.avatar), spawn: sp };
    } catch (e) { return null; }
  };
  if (typeof window.spawnMob === 'function') {
    var oSpawn = window.spawnMob;
    window.spawnMob = function (idx) {
      var r = oSpawn.apply(this, arguments);
      try {
        var m = mapState.mobs[idx];
        if (m && !m._afkWarDone && !isWarMob(m) && isForcedMob(m)) { m._afkWarDone = true; forcedScale(m); }
        // 傳送控制戒指找來的王：強制宣戰中必定再來 2 名敵對玩家
        if (m && m.boss && mapState._afkWarRing && !mapState._afkWarRingDone && forced() && huntMap()) {
          mapState._afkWarRingDone = true;
          setTimeout(function () {
            try {
              var slots = (typeof backSlotsActive === 'function' && backSlotsActive()) ? 5 : 3, made = 0;
              for (var i = 0; i < slots && made < 2; i++) { var x = mapState.mobs[i]; if (x && live(x) && (x.boss || x.trollPlayer)) continue; forceNext = 1; mapState.mobs[i] = null; spawnMob(i); if (mapState.mobs[i] && mapState.mobs[i].trollPlayer) made++; }
              forceNext = 0;
              if (made) sys('<span class="text-red-400 font-bold">王的咆哮引來了「' + (forced() || {}).name + '」的 ' + made + ' 名成員。</span>');
              if (!S().ff && typeof renderMobs === 'function') renderMobs();
            } catch (e) { forceNext = 0; }
          }, 0);
        }
        if (m && !m._afkWarDone && isWarMob(m)) {
          m._afkWarDone = true;
          var d = data();
          shadowScale(m, d.kills);
          // 王族：5% 呼朋引伴
          if ((m._pvpAvatar === '王子' || m._pvpAvatar === '公主') && !window.__afkHostileCall() && Math.random() < 0.05) {
            call = { map: mapState.current, need: dream() ? 4 : 5, filled: false };
            sys('<span class="text-red-400 font-bold">' + m.n + ' 吹響號角，敵對血盟的成員蜂擁而至。</span>');
            setTimeout(fillCall, 0);
          }
        }
        if (call && call.map === mapState.current && !call.filled && hostilesOnField() >= call.need) call.filled = true;
      } catch (e) {}
      return r;
    };
  }
  var fillCall = function () {
    try {
      if (!window.__afkHostileCall()) return;
      var ws = warSet(), slots = (typeof backSlotsActive === 'function' && backSlotsActive()) ? 5 : 3;
      for (var i = 0; i < slots; i++) {
        var m = mapState.mobs[i];
        if (m && live(m) && (m.boss || isWarMob(m, ws))) continue;
        if (hostilesOnField(ws) >= call.need) break;
        mapState.mobs[i] = null; spawnMob(i);
      }
      call.filled = true;
      if (!S().ff && typeof renderMobs === 'function') renderMobs();
    } catch (e) {}
  };

  // ── 強制宣戰（玩家 2026-10-26）──
  var FW_EVERY = 8 * 3600000, FW_DUR = 4 * 3600000, FW_RATE = 0.30, FW_MEET = 0.05;
  var forced = function () { var f = data().forced; return f && f.until > Date.now() ? f : null; };
  var forcedTick = function () {
    var p = P(); if (!p) return;
    var d = data(), now = Date.now(), changed = false;
    if (d.forced && d.forced.until <= now) { sys('<span class="text-slate-300">「' + (d.forced.name || '敵對血盟') + '」的宣戰期限已過，他們收兵回城了。</span>'); d.forced = null; changed = true; }
    if (!d.fwNext) { d.fwNext = now + FW_EVERY; changed = true; }
    else if (now >= d.fwNext) {
      var steps = Math.floor((now - d.fwNext) / FW_EVERY) + 1, start = d.fwNext + (steps - 1) * FW_EVERY;
      d.fwNext += steps * FW_EVERY; changed = true;
      if (!d.forced && now < start + FW_DUR && Math.random() < FW_RATE) {
        var w = null; try { w = npcClanGetWorld(p); } catch (e) {}
        var pool = (w && w.clans || []).filter(Boolean);
        if (pool.length) {
          var c = pool[Math.floor(Math.random() * pool.length)];
          d.forced = { clanId: c.id, name: c.name, until: start + FW_DUR };
          sys('<span class="text-red-400 font-bold">⚔ 血盟「' + c.name + '」撕毀和約，強制對你宣戰！（4 小時內狩獵 5% 遇到他們的成員；用傳送控制戒指找王必定引來 2 名）</span>');
          try { p.pvpOn = true; } catch (e) {}
        }
      }
    }
    if (changed) save(d);
  };
  var forceNext = 0;
  var avgOfMap = function () {
    var ids = (DB.maps && DB.maps[mapState.current]) || [], n = 0, a = { lv: 0, hp: 0, hit: 0, ac: 0, mr: 0, atk: 0 };
    ids.forEach(function (id) { var m = DB.mobs[id]; if (!m || m.boss || m.trollPlayer) return; n++; a.lv += Number(m.lv) || 1; a.hp += Number(m.hp) || 1; a.hit += Number(m.hit) || 0; a.ac += Number(m.ac) || 0; a.mr += Number(m.mr) || 0; var dd = m.dmg || [1, 1]; a.atk += (Number(dd[0]) || 1) * ((Number(dd[1]) || 1) + 1) / 2 + (Number(m.db) || 0); });
    if (!n) return { lv: (P() && P().lv) || 1, hp: 1000, hit: 20, ac: 0, mr: 0, atk: 20 };
    Object.keys(a).forEach(function (k) { a[k] /= n; });
    return a;
  };
  var forcedScale = function (m) {
    var a = avgOfMap(), pn = panelOf() || { hp: 0, hit: 0, ac: 0, mr: 0, acc: 0 };
    m.lv = Math.max(1, Math.round(a.lv));
    m.hp = m.curHp = Math.max(1, Math.round(a.hp + pn.hp * 0.3));
    var e = Math.max(1, Math.round(a.atk + pn.hit * 0.3));
    m.dmg = [1, Math.max(1, Math.round(e * 0.4))]; m.db = Math.max(0, Math.round(e * 0.8));
    m.ac = Math.round(a.ac + pn.ac * 0.3); m.mr = Math.round(a.mr + pn.mr * 0.3); m.hit = Math.round(a.hit + pn.acc * 0.3);
    m._afkForcedWar = true; m._afkShadow = '強制宣戰';
  };
  var isForcedMob = function (m) { var f = forced(); return !!(f && m && m.trollPlayer && m._npcClanId === f.clanId); };
  if (typeof window.doTeleport === 'function') {
    var oTpW = window.doTeleport;
    window.doTeleport = function (forceBoss) { var r = oTpW.apply(this, arguments); try { mapState._afkWarRing = !!forceBoss; mapState._afkWarRingDone = false; } catch (e) {} return r; };
  }

  // ── 擊殺：累計、投降；統一期間不掉落（席琳夢域鏡照常掉遺物）──
  if (typeof window.killMob === 'function') {
    var oKill = window.killMob;
    window.killMob = function (idx) {
      var m = mapState.mobs[idx], war = m && !m._dead && isWarMob(m);
      var r = oKill.apply(this, arguments);
      try {
        if (war && m._dead) {
          var d = data(); d.kills++;
          var t0 = tierOf(d.kills - 1), t1 = tierOf(d.kills);
          if (t1 && (!t0 || t0[0] !== t1[0])) sys('<span class="text-red-300 font-bold">敵對血盟磨利了刀鋒：' + t1[3] + '（你已斬殺 ' + d.kills + ' 名）</span>');
          if (d.kills === 500 || d.kills === 1500) sys('<span class="text-red-300 font-bold">敵對血盟不再單打獨鬥——此後一次 ' + groupSize(d.kills) + ' 人出擊。</span>');
          if (unified() && d.kills >= 10000 && !d.surrendered) {
            d.surrendered = true; d.allWarDone = true; save(d); syncWar(true);
            sys('<span class="text-yellow-300 font-bold">第一萬名敵人倒下時，各血盟的旗幟紛紛垂落——全伺服器向你投降，戰火平息。</span>');
          } else save(d);
        }
      } catch (e) {}
      return r;
    };
  }
  // 死亡：連續擊殺歸零（強度階段與投降進度都從頭算）
  if (typeof window.killPlayer === 'function') {
    var oKP = window.killPlayer;
    window.killPlayer = function () {
      var p = P(), was = !!(p && p.dead);
      var r = oKP.apply(this, arguments);
      try {
        if (p && p.dead && !was) {
          var d = data();
          if (d.kills > 0 && !d.surrendered) { var k = d.kills; d.kills = 0; save(d); sys('<span class="text-red-400">你倒下了。連斬 ' + k.toLocaleString() + ' 名敵對血盟的戰績，隨你的鮮血一同流盡。</span>'); }
        }
      } catch (e) {}
      return r;
    };
  }
  var noDrop = function (mob) { return unified() && isWarMob(mob); };
  if (typeof window.pledgeBonusDrop === 'function') {
    var oPB = window.pledgeBonusDrop;
    window.pledgeBonusDrop = function (mob) { if (noDrop(mob)) return null; return oPB.apply(this, arguments); };
  }
  if (typeof window.playerNpcRelicDrop === 'function') {
    var oPR = window.playerNpcRelicDrop;
    window.playerNpcRelicDrop = function (mob) { if (noDrop(mob) && !dream()) return; return oPR.apply(this, arguments); };
  }

  // ── 每小時收成 ──
  var INCOME_MAX_H = 168;
  var payIncome = function () {
    var p = P(); if (!p) return;
    var d = data(), n = held().length, now = Date.now();
    if (n < 3) { d.lastPay = now; save(d); return; }
    if (!d.lastPay) { d.lastPay = now; save(d); return; }
    var hrs = Math.floor((now - d.lastPay) / 3600000); if (hrs <= 0) return;
    hrs = Math.min(hrs, INCOME_MAX_H);   // 現實時間計算（關掉遊戲也算），一次最多補 7 天（玩家 2026-10-30 20:43）
    var gold = 0, dia = 0, cry = 0;
    if (n >= 7) { gold = 10000000; dia = 100; cry = 100; }
    else { if (n >= 3) gold += 5000000; if (n >= 5) dia += 100; }
    gold *= hrs; dia *= hrs; cry *= hrs;
    if (gold) p.gold = (p.gold || 0) + gold;
    if (dia) { try { window.pandoraAdjustSharedDiamonds(dia); } catch (e) {} }
    if (cry && DB.items.sherine_crystal) { try { gainItem('sherine_crystal', cry, true, true); } catch (e) {} }
    d.lastPay += hrs * 3600000; save(d);
    sys('<span class="text-yellow-300 font-bold">城堡的管家呈上了 ' + hrs + ' 小時的收成（' + n + ' 座城）：</span>' + [gold ? gold.toLocaleString() + ' 金幣' : '', dia ? dia + ' 龍之鑽石' : '', cry ? cry + ' 席琳結晶' : ''].filter(Boolean).join('、'));
    try { updateUI(); } catch (e) {}
  };

  var oTick = window.tick;
  window.tick = function () {
    var t0 = S().ticks;
    try { return oTick.apply(this, arguments); }
    finally {
      var t = S().ticks;
      if (t !== t0 && t % 100 === 0) { try { payIncome(); } catch (e) {} try { syncWar(false); } catch (e) {} try { forcedTick(); } catch (e) {} }
      if (t !== t0 && t % 10 === 0) { try { watchLose(); } catch (e) {} }
      if (call && (typeof mapState === 'undefined' || call.map !== mapState.current)) call = null;
    }
  };

  // 進遊戲時馬上結算離線期間的收成（不用等第一個 10 秒）
  if (typeof window.loadGame === 'function') {
    var oLoadInc = window.loadGame;
    window.loadGame = function () { var r = oLoadInc.apply(this, arguments); try { setTimeout(function () { try { payIncome(); } catch (e) {} }, 1500); } catch (e) {} return r; };
    try { loadGame = window.loadGame; } catch (e) {}
  }

  // ── 戰敗冷卻（玩家 2026-10-30 20:43）：攻城打輸後 30 分鐘內，帳號裡所有角色（16 格）都不能宣戰 ──
  var LOSE_KEY = 'afk_siege_lose_until', LOSE_MS = 30 * 60 * 1000, lastLoseEnd = 0;
  var loseUntil = function () { try { return Number(localStorage.getItem(LOSE_KEY)) || 0; } catch (e) { return 0; } };
  var loseLeft = function () { return Math.max(0, loseUntil() - Date.now()); };
  var loseText = function () { var m = Math.ceil(loseLeft() / 60000); return '戰敗後 30 分鐘內，帳號裡所有角色都不能宣戰（還要 ' + m + ' 分鐘）。'; };
  var watchLose = function () {   // 舊制攻城（endSiege）與肯特新制（SiegeV2.finish）都會把結果寫進 player.siege
    var p = P(), sg = p && p.siege; if (!sg || sg.active || sg.result !== 'lose') return;
    var end = Number(sg.endTime) || 0; if (!end || end === lastLoseEnd || Date.now() - end > 5000) { lastLoseEnd = end || lastLoseEnd; return; }
    lastLoseEnd = end;
    try { localStorage.setItem(LOSE_KEY, String(end + LOSE_MS)); } catch (e) {}
    sys('<span class="text-red-300 font-bold">攻城戰敗。</span><span class="text-slate-300">30 分鐘內，帳號裡所有角色都不能宣戰。</span>');
  };
  var lockGuard = function (fn, msgOnly) {
    return function () {
      if (loseLeft() > 0) { sys('<span class="text-amber-300">' + loseText() + '</span>'); try { if (typeof showToast === 'function') showToast(loseText()); } catch (e) {} return; }
      return fn.apply(this, arguments);
    };
  };
  ['startSiege', 'siegeV2BeginKent'].forEach(function (nm) { if (typeof window[nm] === 'function') window[nm] = lockGuard(window[nm]); });
  if (typeof window.endSiege === 'function') { var oEndS = window.endSiege; window.endSiege = function () { var r = oEndS.apply(this, arguments); try { watchLose(); } catch (e) {} return r; }; }
  window.__afkSiegeLose = { left: loseLeft, text: loseText, KEY: LOSE_KEY, MS: LOSE_MS, watch: watchLose };

  // ── 介面：攻城選單上方顯示城堡與宣戰狀態 ──
  var panel = function () {
    var d = data(), h = held(), n = h.length, t = tierOf(d.kills);
    var inc = n >= 7 ? '每小時 100 龍鑽＋1,000 萬金幣＋100 席琳結晶' : (n >= 5 ? '每小時 500 萬金幣＋100 龍鑽' : (n >= 3 ? '每小時 500 萬金幣' : '3 座以上才有收成'));
    var war = (n >= 7 && d.allWarDone) ? '天下太平，沒有血盟敢宣戰' : (d.warIds.length ? d.warIds.length + ' 個血盟對你宣戰' : (n <= 1 ? '只有 1 座城，沒人對你宣戰' : '—'));
    return '<div class="bg-slate-900/70 border border-amber-700/60 rounded p-3 text-sm text-slate-200 leading-relaxed">' +
      '<div class="afk-lore">「城牆會倒，旗幟會換；唯有統一天下的名字，會被刻進亞丁的歷史。」</div><div class="font-bold text-amber-200 mb-1">🏰 持有城堡 ' + n + '／7' + (n >= 7 ? '（' + unifyTitle() + '）' : '') + '</div>' +
      '<div>' + (h.map(function (c) { return SIEGE_CITY[c] ? SIEGE_CITY[c].name : c; }).join('、') || '尚未持有') + '</div>' +
      '<div class="mt-1">收成：' + inc + '</div>' +
      (loseLeft() > 0 ? '<div class="mt-1 text-red-300">⛔ ' + loseText() + '</div>' : '') +
      '<div>宣戰：' + war + '</div>' +
      (forced() ? '<div class="text-red-300">強制宣戰：「' + forced().name + '」（剩 ' + Math.max(1, Math.ceil((forced().until - Date.now()) / 60000)) + ' 分鐘；狩獵 5% 遇敵、傳送戒指找王必定 2 名）</div>' : '<div class="text-slate-400 text-xs">每 8 小時有 30% 機率被隨機一個血盟強制宣戰 4 小時。</div>') +
      '<div>攻城難度：多 ' + ((n >= 1 ? 1 : 0) + (n >= 3 ? 1 : 0) + (n >= 5 ? 1 : 0)) + ' 波守軍（每波 5 名；1 座城起門口、3 座起進內城、5 座起搶塔）；守軍傷害、命中 +' + (n * 10) + '%、受傷 −' + Math.min(70, n * 10) + '%。離線掛機期間每跨過一次午夜（台灣時間 00:00）有 5% 機率失去一座城。</div>' +
      '<div>已擊殺敵對血盟 ' + d.kills.toLocaleString() + ' 名（目前強度：' + (t ? t[3] : '一般') + '；一次 ' + groupSize(d.kills) + ' 人）' + (n >= 7 && !d.allWarDone ? '・連續擊殺 10,000 名後全體投降（死亡歸零；只有第一次統一會發生）' : '') + '</div></div>';
  };
  // ── 沒被你打下的城：由 NPC 血盟持有（玩家 2026-10-28：一開始城堡沒被攻打時也要顯示是哪個 NPC 血盟的）──
  //   核心只在你第一次攻城勝利後才分配肯特／風木／海音的持有者，其他四座城沒有；這裡補上：
  //   每座不是你的城，依目前存在的 NPC 血盟隨機指定一個持有者並記下來（血盟消失或你打下來就重新指定）。
  //   攻城畫面「守城血盟」就顯示它，攻城時也由它守城（核心原本的守城規則）。
  var worldCache = { at: 0, w: null };   // 攻城畫面 7 顆城堡各查一次守城血盟 → 同一秒內共用一次讀取（每次讀都要 parse 整份血盟資料，慢手機吃力）
  var worldNow = function (p) { var t = Date.now(); if (t - worldCache.at > 1000) { worldCache.at = t; try { worldCache.w = npcClanGetWorld(p || P()); } catch (e) { worldCache.w = null; } } return worldCache.w; };
  var npcOwnerOf = function (city, p) {
    var w = worldNow(p);
    var clans = (w && w.clans || []).filter(Boolean); if (!clans.length) return null;
    if (held().indexOf(city) >= 0) return null;
    var d = data(), own = d.npcOwners = (d.npcOwners && typeof d.npcOwners === 'object') ? d.npcOwners : {};
    var cur = own[city] && clans.filter(function (c) { return c.id === own[city]; })[0];
    if (cur) return cur;
    var used = {}; Object.keys(own).forEach(function (k) { if (k !== city) used[own[k]] = 1; });
    var pool = clans.filter(function (c) { return !used[c.id]; }); if (!pool.length) pool = clans;
    var pick = pool[Math.floor(Math.random() * pool.length)];
    own[city] = pick.id; save(d);
    return pick;
  };
  if (typeof window.npcClanCastleDefender === 'function') {
    var oDef = window.npcClanCastleDefender;
    window.npcClanCastleDefender = function (city, p) {
      try { if (held().indexOf(city) >= 0) return null; } catch (e) {}   // 你持有的城沒有 NPC 守城血盟
      var r = oDef.apply(this, arguments);
      if (r) return r;
      try { return npcOwnerOf(city, p); } catch (e) { return null; }
    };
  }
  window.__afkCastleNpcOwner = npcOwnerOf;
  if (typeof window.openSiegeSelect === 'function') {
    var oSel = window.openSiegeSelect;
    window.openSiegeSelect = function (faction, targetEl) {
      var r = oSel.apply(this, arguments);
      try {
        var el = targetEl || document.getElementById('interaction-content');
        var grid = el && el.querySelector('.siege-castle-grid');
        if (grid) {
          var box = document.createElement('div'); box.innerHTML = panel(); grid.parentNode.insertBefore(box.firstChild, grid);
          var h = held();
          grid.querySelectorAll('[data-castle]').forEach(function (b) {
            var c = b.getAttribute('data-castle');
            if (h.indexOf(c) >= 0) { b.disabled = true; b.removeAttribute('onclick'); b.classList.remove('is-open'); b.classList.add('is-locked'); var st = b.querySelector('.siege-castle-status'); if (st) st.textContent = '目前持有'; }
          });
          var note = el.querySelector('.border-t.border-slate-700'); if (note) note.textContent = '七座城都可以宣戰，最多持有 7 座；離線掛機期間每跨過一次午夜有 5% 機率失去一座（在線上不會）。持有越多城，攻城越難。3 座以上每小時有收成；持有 2 座以上會有血盟對你宣戰。';
        }
      } catch (e) {}
      return r;
    };
  }

  // 新城堡的魔物追蹤 NPC：用核心奧貝勒的追蹤畫面
  if (typeof window.interactNPC === 'function') {
    var oNpcTrk = window.interactNPC;
    window.interactNPC = function (npcId) {
      var r = oNpcTrk.apply(this, arguments);
      try { if (/^npc_track_/.test(String(npcId)) && typeof renderObelNPC === 'function') { var div = document.getElementById('interaction-content'); if (div) { renderObelNPC(div); var nm = ''; try { Object.keys(DB.towns).some(function (t) { return (DB.towns[t].npcs || []).some(function (x) { if (x.id === npcId) { nm = x.n; return true; } return false; }); }); } catch (e) {} if (nm) div.innerHTML = div.innerHTML.replace(/奧貝勒/g, nm); } } } catch (e) {}
      return r;
    };
  }
  // ── 統一天下的稱號：還沒全部投降＝「統一天下 肅清反賊中」，全部投降＝「統一天下」──
  var unifyTitle = function () { if (!unified()) return ''; return data().allWarDone ? '統一天下' : '統一天下 肅清反賊中'; };

  // ── 血盟等級上限 20（每級 +1 全屬性、+5 四屬性抗性，從 Lv.1 算起），血盟 Buff 乘上持有城堡數 ──
  var CLAN_MAX = 20;
  try {
    var EXTRA_COST = [1500000, 4500000, 7500000, 10500000, 13500000, 16500000, 19500000, 22500000, 25500000, 28500000];   // Lv10→11 要 150 萬，之後每級 +300 萬
    while (CLAN_LEVEL_COSTS.length < CLAN_MAX - 1) CLAN_LEVEL_COSTS.push(EXTRA_COST[CLAN_LEVEL_COSTS.length - 9] || 1000000);
    while (CLAN_BUFF_BY_LEVEL.length <= CLAN_MAX) CLAN_BUFF_BY_LEVEL.push(Object.assign({}, CLAN_BUFF_BY_LEVEL[10]));
  } catch (e) {}
  window.clanLevelInfo = function (xp) {
    xp = Math.max(0, Math.floor(Number(xp) || 0));
    var level = 1, spent = 0;
    for (var i = 0; i < CLAN_MAX - 1; i++) { if (xp - spent < CLAN_LEVEL_COSTS[i]) break; spent += CLAN_LEVEL_COSTS[i]; level++; }
    return { level: level, current: Math.max(0, xp - spent), next: level >= CLAN_MAX ? 0 : CLAN_LEVEL_COSTS[level - 1], total: xp };
  };
  var cache = { at: -1e9, lv: 1, k: 1 };
  var fresh = function () {   // 重算很頻繁：一秒內只讀一次存檔
    var now = Date.now(); if (now - cache.at < 1000) return cache;
    cache.at = now;
    try { var st = _clanReadState(); cache.lv = st ? window.clanLevelInfo(st.xp).level : 1; } catch (e) { cache.lv = 1; }
    try { cache.k = Math.max(1, held().length); } catch (e) { cache.k = 1; }
    return cache;
  };
  var BUFF_KEYS = ['hp', 'mp', 'extraDmg', 'extraHit', 'mr', 'magicDmg', 'hpR', 'mpR', 'ac'];
  var scaleBuff = function (b) {
    if (!b) return b;
    var c = fresh(), o = Object.assign({}, b), n = Math.max(1, c.lv);   // 從 Lv.1 起每級 +1 全屬性、+5 四屬性抗性
    BUFF_KEYS.forEach(function (key) { if (typeof o[key] === 'number') o[key] *= c.k; });
    o.allStat = n; o.res4 = n * 5; o.castleMult = c.k;
    return o;
  };
  if (typeof window.getClanBuffStats === 'function') {
    var oCB = window.getClanBuffStats;
    window.getClanBuffStats = function (p) { var b = oCB.apply(this, arguments); return b ? scaleBuff(b) : b; };
  }
  // 全屬性要在「屬性換算戰鬥數值」之前加進去：掛在 __afkAttrBoost（核心夾上限前呼叫）
  var oBoost = window.__afkAttrBoost;
  window.__afkAttrBoost = function (p, d) {
    try {
      var b = (typeof window.getClanBuffStats === 'function') ? window.getClanBuffStats(p) : null;
      if (b && (b.allStat || b.res4)) {
        var s = b.allStat || 0; d.str += s; d.dex += s; d.con += s; d.int += s; d.wis += s; d.cha += s;
        var r = b.res4 || 0; d.resFire += r; d.resWater += r; d.resEarth += r; d.resWind += r;
      }
    } catch (e) {}
    if (typeof oBoost === 'function') return oBoost.apply(this, arguments);
  };
  if (typeof window._clanBuffText === 'function') {
    var oBT = window._clanBuffText;
    window._clanBuffText = function (buff) {
      if (!buff) return oBT.apply(this, arguments);
      var b = buff.castleMult ? buff : scaleBuff(buff), t = oBT.call(this, b);
      if (b.allStat) t += '、全屬性 +' + b.allStat + '、火水風地抗性 +' + b.res4;
      if (b.castleMult > 1) t += '<div class="text-xs text-amber-300 mt-1">🏰 持有 ' + b.castleMult + ' 座城堡：Buff 數值 ×' + b.castleMult + '</div>';
      return t;
    };
  }
  if (typeof window.renderClanTab === 'function') {
    var oCT = window.renderClanTab;
    window.renderClanTab = function () {
      var r = oCT.apply(this, arguments);
      try {
        var div = document.getElementById('tab-clan'); if (!div) return r;
        var st = _clanReadState(), li = st ? window.clanLevelInfo(st.xp) : null;
        if (li) div.querySelectorAll('.text-cyan-200.font-bold').forEach(function (el) {
          if (!/^血盟 Lv\./.test(el.textContent)) return;
          el.textContent = '血盟 Lv.' + li.level + '／' + CLAN_MAX;
          var x = el.nextElementSibling; if (x) x.textContent = '經驗 ' + (li.level >= CLAN_MAX ? st.xp.toLocaleString() + '（最高等級）' : li.current.toLocaleString() + ' / ' + li.next.toLocaleString());
        });
        var title = unifyTitle(), h = held();
        div.querySelectorAll('.text-sm.text-slate-400.mt-1').forEach(function (el) {
          if (el.textContent.indexOf('城堡：') < 0) return;
          // 這格很窄，只放 2～3 個字：1 座顯示城名、多座顯示「N城」、七座「統一」；完整城名與稱號放在滑鼠提示
          var names = h.map(function (c) { return SIEGE_CITY[c] ? SIEGE_CITY[c].name : c; });
          var short = !h.length ? '' : (title ? '統一' : (h.length === 1 ? names[0] : h.length + '城'));
          var tip = h.length ? ('血盟持有 ' + h.length + ' 座城堡' + (title ? '（' + title + '）' : '') + '：' + names.join('、')) : '';
          var txt = short ? '<span class="' + (title ? 'text-yellow-300 font-bold' : 'text-amber-200 font-bold') + '" style="white-space:nowrap" title="' + tip + '">' + short + '</span>' : '';
          if (txt) el.innerHTML = el.innerHTML.replace(/城堡：[\s\S]*$/, '城堡：' + txt);
        });
        // 回城城堡選擇
        if (h.length) {
          var old = div.querySelector('#afk-castle-home'); if (old) old.remove();
          var hc = homeCity(), row = document.createElement('div');
          row.id = 'afk-castle-home'; row.className = 'mt-2 p-2 rounded border border-amber-700/60 bg-slate-900/70 text-sm text-slate-200 flex flex-wrap items-center gap-2';
          row.innerHTML = '<span class="text-amber-200 font-bold">🏰 回城地點</span><select class="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-100">' +
            h.map(function (c) { var nm = SIEGE_CITY[c] ? SIEGE_CITY[c].castleName : c; return '<option value="' + c + '"' + (c === hc ? ' selected' : '') + '>' + nm + '</option>'; }).join('') +
            '</select><span class="text-xs text-slate-400">按「回城」或 Ctrl+C 會回到這座城堡</span>';
          row.querySelector('select').onchange = function () { setHome(this.value); };
          var anchor = div.firstElementChild; if (anchor) anchor.appendChild(row); else div.appendChild(row);
        }
      } catch (e) {}
      return r;
    };
  }

  // ── 回城選城堡（玩家 2026-10-23）：持有多座時在血盟分頁選回城要回哪一座 ──
  var homeCity = function () {
    var h = held(), d = data(); if (!h.length) return null;
    if (d.home && h.indexOf(d.home) >= 0) return d.home;
    var main = null; try { main = castleOwnerCity(); } catch (e) {}
    return main && h.indexOf(main) >= 0 ? main : h[0];
  };
  var setHome = function (city) {
    var d = data(); if (held().indexOf(city) < 0) return false;
    d.home = city; save(d); titleCache.at = -1e9;
    sys('<span class="text-amber-200">此後歸鄉之路將通往' + (SIEGE_CITY[city] ? SIEGE_CITY[city].castleName : city) + '。</span>');
    return true;
  };
  var withHome = function (fn, self, args) {
    var c = null; try { c = homeCity(); } catch (e) {}
    var cfg = c && SIEGE_CITY[c], old = window.victoryCityCfg;
    if (!cfg || typeof old !== 'function') return fn.apply(self, args);
    window.victoryCityCfg = function () { return cfg; };
    try { return fn.apply(self, args); } finally { window.victoryCityCfg = old; }
  };
  ['returnToTown', 'returnToPledgeBase'].forEach(function (nm) {
    var o = window[nm]; if (typeof o !== 'function') return;
    window[nm] = function () { return withHome(o, this, arguments); };
  });
  // 徽章只放得下 2～3 字：王族「N城主」、其他「N城」，七座「統一」；完整城名放在滑鼠提示
  var badgeCache = { at: -1e9, n: 0 };   // 每個 tick 都會問：一秒內只讀一次
  window.__afkCastleBadge = function () {
    var p = P(); if (!p) return ''; var now = Date.now();
    if (now - badgeCache.at > 1000) { badgeCache.at = now; try { badgeCache.n = held().length; } catch (e) { badgeCache.n = 0; } }
    var n = badgeCache.n; if (!n) return '';
    if (n >= 7) return '統一';
    return n + '城' + (p.cls === 'royal' ? '主' : '');
  };
  var titleCache = { at: -1e9, t: '' };
  window.__afkCastleBadgeTitle = function () {
    var now = Date.now(); if (now - titleCache.at < 1000) return titleCache.t;
    titleCache.at = now; titleCache.t = badgeTitle(); return titleCache.t;
  };
  var badgeTitle = function () {
    var h = held(); if (!h.length) return '';
    var names = h.map(function (c) { return SIEGE_CITY[c] ? SIEGE_CITY[c].name : c; }).join('、'), hc = homeCity();
    return '血盟持有 ' + h.length + ' 座城堡' + (h.length >= 7 ? '（' + unifyTitle() + '）' : '') + '：' + names + '。回城：' + (SIEGE_CITY[hc] ? SIEGE_CITY[hc].castleName : '') + '。全商店 8 折、開放城堡';
  };


  // ════ 2026-10-25：攻城難度、每日失城、PVP 保護 ════
  // 玩家 2026-10-26（二）：額外守軍改成「最多三波、每波 5 名」，不再每座城多 5 波
  // 玩家 2026-10-26（三）：「每波多五人」＝原本進下一關要打的人數再 +5。打完這 5 名後不強制叫出城門／守護塔，
  //   而是回到原本的規則（每次重生 10% 機率出現），所以原本平均 10 名的關卡變成 15 名
  //   持有 1 座以上：門口多一波（外門區先擊退 5 名，城門才現身）
  //   持有 3 座以上：進去多一波（進內城先擊退 5 名，守護塔才現身）
  //   持有 5 座以上：搶塔多一波（守護塔出現後再擊退 5 名護塔守軍，塔才打得下來）
  var WAVE_SIZE = 5, SIEGE_STEP = 0.10, LOSS_RATE = 0.05, OFFLINE_GAP = 5 * 60000;   // 失城：5%，只在離線期間跨過的午夜判定（玩家 2026-10-28）
  var siegeHeld = function () { try { return held().length; } catch (e) { return 0; } };
  var wavePlan = function (n) { n = n == null ? siegeHeld() : n; return { gate: n >= 1 ? WAVE_SIZE : 0, enter: n >= 3 ? WAVE_SIZE : 0, tower: n >= 5 ? WAVE_SIZE : 0 }; };
  var waveNeed = function () { var w = wavePlan(); return w.gate + w.enter + w.tower; };
  var curSiege = function () { var p = P(); return p && p.siege && p.siege.active ? p.siege : null; };
  var areaNow = function () { try { var s = curSiege(), c = s && SIEGE_CITY[s.city]; if (!c || !mapState) return null; return mapState.current === c.outer ? 'outer' : mapState.current === c.inner ? 'inner' : null; } catch (e) { return null; } };
  var outerNow = function () { return areaNow() === 'outer'; };
  var sieged = function () { try { return typeof isSiegeArea === 'function' && isSiegeArea(mapState.current); } catch (e) { return false; } };
  var isBuilding = function (m) { return !!(m && m.siegeEnemy && m.boss && (m.race === '建築' || m.noAttack)); };   // 城門／守護塔
  var towerUp = function () { try { return (mapState.mobs || []).some(function (m) { return m && !m._dead && isBuilding(m); }); } catch (e) { return false; } };
  var stageOf = function (s) {   // 目前要累積的那一波（null＝沒有待擊退的守軍）
    var a = areaNow(); if (!s || !s._afkWave) return null;
    var w = s._afkWave;
    if (a === 'outer' && !s.gateKilled && w.gateKills < w.gate) return 'gate';
    if (a === 'inner' && !towerUp() && w.enterKills < w.enter) return 'enter';
    if (a === 'inner' && towerUp() && w.towerKills < w.tower) return 'tower';
    return null;
  };
  var STAGE_N = { gate: '門口', enter: '內城入口', tower: '守護塔前' };
  if (typeof window.startSiege === 'function') {
    var oStart2 = window.startSiege;
    window.startSiege = function (faction, city) {
      var r = oStart2.apply(this, arguments);
      try { var s = curSiege(); if (s && !s._afkWave) { var w = wavePlan(); s._afkWave = { gate: w.gate, enter: w.enter, tower: w.tower, gateKills: 0, enterKills: 0, towerKills: 0 }; s._afkNeed = waveNeed(); s._afkKills = 0; s._afkMult = 1 + SIEGE_STEP * siegeHeld();
        var waves = (w.gate ? 1 : 0) + (w.enter ? 1 : 0) + (w.tower ? 1 : 0);
        if (waves) sys('<span class="text-red-300 font-bold">你的血盟已持有 ' + siegeHeld() + ' 座城，各方勢力聯手守城：多 ' + waves + ' 波守軍（每波 ' + WAVE_SIZE + ' 名：' + [w.gate ? '門口' : '', w.enter ? '進內城' : '', w.tower ? '搶塔' : ''].filter(Boolean).join('、') + '，打完才回到原本的城門／守護塔出現規則）；守軍傷害、命中 +' + Math.round(SIEGE_STEP * siegeHeld() * 100) + '%、受到的傷害 −' + Math.min(70, Math.round(SIEGE_STEP * siegeHeld() * 100)) + '%。</span>'); } } catch (e) {}
      return r;
    };
  }
  if (typeof window.spawnMob === 'function') {
    var oSpawnS = window.spawnMob;
    window.spawnMob = function (idx) {
      var s = curSiege(), st = stageOf(s), block = st === 'gate' || st === 'enter';   // 門口／內城入口那一波沒打完：城門、守護塔先不出現
      if (block) { try { mapState.suppressSiegeBoss = true; mapState.forceBoss = false; } catch (e) {} }
      var r = oSpawnS.apply(this, arguments);
      try {
        if (block === false && s && st == null && areaNow() === 'inner' && s._afkWave && s._afkWave.enterKills >= s._afkWave.enter && mapState.suppressSiegeBoss && !towerUp()) mapState.suppressSiegeBoss = false;
        var m = mapState.mobs[idx];
        if (s && m && m.siegeEnemy && !m._afkSiegeX && sieged()) {
          m._afkSiegeX = true;
          try { siegeDefenderScale(m); } catch (e) {}
          var k = s._afkMult || 1, red = Math.min(0.7, k - 1);
          if (k > 1) {
            if (Array.isArray(m.dmg)) m.dmg = [m.dmg[0], Math.max(1, Math.round(m.dmg[1] * k))];
            m.db = Math.round((Number(m.db) || 0) * k);
            m.hit = Math.round((Number(m.hit) || 0) * k) + (m.hit ? 0 : Math.round(10 * (k - 1)));
            m.hp = Math.round((m.hp || 1) / (1 - red)); m.curHp = Math.round((m.curHp || m.hp) / (1 - red));
          }
        }
      } catch (e) {}
      return r;
    };
  }
  // ── 攻城守軍改看你的面板（玩家 2026-10-31 14:11：手機實測外門、內城各 4 秒就打完）──
  //   原本守軍跟城門／守護塔只看你的等級（HP 約 10～15×等級、城門 300×等級、守護塔 500×等級），後期一碰就倒。
  //   改成跟敵對血盟一樣看「脫掉變身、拿掉卡冊後的面板」：
  //   ‧守軍：面板 ×2 再 ×SIEGE_PANEL.r（HP、一般攻擊、命中、AC、魔防）
  //   ‧城門 HP＝面板 HP ×SIEGE_PANEL.gate、守護塔＝×SIEGE_PANEL.tower（只會變硬，不會比原本少）
  //   持有城數的 +10%／座、多波守軍照舊疊在上面。
  var SIEGE_PANEL = { r: 1.5, gate: 600, tower: 800 };
  //   人數：HP 再乘「隊伍人數÷8」（你＋傭兵；一人 ×0.125、8 人 ×1、16 人 ×2；守軍、城門、守護塔都一樣），一個人打不會被卡死
  var partyF = function () { var p = P(); var n = 1 + ((p && p.allies) || []).filter(function (a) { return a && !a._downed; }).length; return Math.max(0.125, Math.min(2, n / 8)); };
  if (typeof window.applySiegeEnemyScaling === 'function') {
    var oSiegeScale = window.applySiegeEnemyScaling;
    window.applySiegeEnemyScaling = function (mob) {
      var r = oSiegeScale.apply(this, arguments);
      try {
        var p = P(), pn = panelOf(); if (!mob || !p || !pn || p.classicMode) return r;
        var sg = mob.siege || {};
        if (sg.fixed) {
          var k = mob.race === '建築' && /守護塔/.test(String(mob.n || '')) ? SIEGE_PANEL.tower : SIEGE_PANEL.gate;
          var hp = Math.round(pn.hp * k * partyF()); if (hp > (mob.hp || 0)) { mob.hp = hp; mob.curHp = hp; }
        }
      } catch (e) {}
      return r;
    };
    try { (0, eval)('applySiegeEnemyScaling = window.applySiegeEnemyScaling'); } catch (e) {}
  }
  // 守軍（含扮成玩家的守軍）：生出來當下換成面板基準，之後才疊持有城數的 +10%／座（見上面的 spawnMob）
  var siegeDefenderScale = function (mob) {
    var p = P(), pn = panelOf(); if (!mob || !p || !pn || p.classicMode || isBuilding(mob) || mob.race === '建築') return;
    var rr = SIEGE_PANEL.r, e = Math.max(1, Math.round(pn.hit * 2 * rr));
    mob.hp = mob.curHp = Math.max(mob.hp || 1, Math.round(pn.hp * 2 * rr * partyF()));
    mob.dmg = [1, Math.max(1, Math.round(e * 0.4))]; mob.db = Math.max(Number(mob.db) || 0, Math.round(e * 0.8));
    mob.ac = Math.min(Number(mob.ac) || 0, Math.round(pn.ac * 2 * rr));
    mob.mr = Math.max(Number(mob.mr) || 0, Math.round(pn.mr * 2 * rr));
    mob.hit = Math.max(Number(mob.hit) || 0, Math.round(pn.acc * 2 * rr));
    mob._afkSiegePanel = true;
  };
  window.__afkSiegePanel = SIEGE_PANEL;

  // 搶塔那一波沒打完時，守護塔不是目標：自動改打護塔守軍（不然會一直打 1 HP 的塔）
  var shiftOffTower = function () {
    try {
      var cur = mapState.mobs[mapState.targetIdx];
      if (!cur || !isBuilding(cur) || stageOf(curSiege()) !== 'tower') return;
      var j = -1, born = Infinity;
      mapState.mobs.forEach(function (m, i) { if (m && !m._dead && m.curHp > 0 && !isBuilding(m) && (m._born || 0) < born) { born = m._born || 0; j = i; } });
      if (j >= 0) mapState.targetIdx = j;
    } catch (e) {}
  };
  if (typeof window.getTarget === 'function') {
    var oTgt = window.getTarget;
    window.getTarget = function () { shiftOffTower(); var t = oTgt.apply(this, arguments); if (t && isBuilding(t) && stageOf(curSiege()) === 'tower') { shiftOffTower(); t = oTgt.apply(this, arguments); } return t; };
  }
  if (typeof window.killMob === 'function') {
    var oKillS = window.killMob;
    window.killMob = function (idx) {
      var m = mapState.mobs[idx], s = curSiege(), st = stageOf(s);
      // 搶塔那一波還沒打完：守護塔撐著 1 HP 不倒
      if (st === 'tower' && m && !m._dead && isBuilding(m)) {
        var left = s._afkWave.tower - s._afkWave.towerKills;
        m.curHp = Math.max(1, Math.floor((m.hp || 1) * 0.05));
        shiftOffTower();
        if (!s._afkTowerMsgAt || (S().ticks || 0) - s._afkTowerMsgAt > 50) { s._afkTowerMsgAt = S().ticks || 0; sys('<span class="text-amber-300">護塔守軍拚死擋在塔前——再擊退 ' + left + ' 名才能攻下守護塔！</span>'); }
        return;
      }
      var cnt = !!(st && m && !m._dead && m.siegeEnemy && !isBuilding(m));
      var r = oKillS.apply(this, arguments);
      try {
        if (cnt && m._dead) {
          var w = s._afkWave, key = st + 'Kills'; w[key] = (w[key] || 0) + 1; s._afkKills = w.gateKills + w.enterKills + w.towerKills;
          if (w[key] >= w[st]) {
            sys('<span class="text-amber-300">擊退' + STAGE_N[st] + '的守軍。' + (st === 'gate' ? '城門隨時會出現。' : st === 'enter' ? '守護塔隨時會現身。' : '<b>守護塔失去了守護，現在可以攻下了！</b>') + '</span>');
            if (st !== 'tower') { try { mapState.suppressSiegeBoss = false; mapState.forceBoss = false; } catch (e) {} }   // 回到原本的出現機率
          }
        }
      } catch (e) {}
      return r;
    };
  }
  // 每天 00:00（UTC+8）隨機失去一座城
  var dayKey = function (t) { var d = new Date((t || Date.now()) + 8 * 3600000); return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate(); };
  var dayNum = function (t) { return Math.floor(((t || Date.now()) + 8 * 3600000) / 86400000); };
  var loseCastle = function (city) {
    var p = P(), d = data(), was = d.castles.length;
    if (d.npcOwners) delete d.npcOwners[city];   // 失去的城：之後重新指定攻下它的 NPC 血盟
    d.castles = d.castles.filter(function (c) { return c !== city; });
    var main = null; try { main = clanGetCastleCity(p); } catch (e) {}
    if (main === city) {
      var next = d.castles.length ? d.castles[d.castles.length - 1] : null;
      try { _clanWithLock(function (st) { var info = st.modes[modeKey()]; if (!info) return { commit: false }; info.castle = next; return {}; }); } catch (e) {}
      try { rememberCastleOwnerCity(next); } catch (e) {}
    }
    if (was >= 7 && d.everUnified && !d.allWarDone) { d.allWarDone = true; sys('<span class="text-slate-300">天下不再歸一，肅清反賊的一萬人之戰隨之落幕——這段歷史不會再重演。</span>'); }
    save(d);
    try { if (typeof window.castleGuardsOnCastleLost === 'function') window.castleGuardsOnCastleLost(city); } catch (e) {}
    sys('<span class="text-red-400 font-bold">🏴 夜半時分，' + (SIEGE_CITY[city] ? SIEGE_CITY[city].name : city) + '的城門被敵軍攻破——你的血盟失去了這座城。</span>');
  };
  var dailyLoss = function () {
    var p = P(); if (!p || !(typeof clanGetModeInfo === 'function' && clanGetModeInfo(p))) return;
    var d = data(), today = dayNum(), now = Date.now(), seen = Number(d.seenAt) || 0;
    // 玩家 2026-10-28：只有離線掛機（關掉網頁、或畫面停住超過 5 分鐘）期間跨過的午夜才判定；自己在線上跨過午夜不會失城
    var offline = seen > 0 && now - seen > OFFLINE_GAP;
    if (offline || !seen || now - seen > 60000) { d.seenAt = now; save(d); }
    if (!d.lossDay) { d.lossDay = today; save(d); return; }
    var days = today - Number(d.lossDay); if (!(days > 0)) return;
    var offDays = offline ? Math.max(0, Math.min(days, today - dayNum(seen))) : 0;
    d.lossDay = today; save(d);
    if (!offDays) return;
    if (curSiege()) { /* 攻城中先不動，下次檢查再結算 */ d.lossDay = today - days; d.seenAt = seen; save(d); return; }
    days = offDays;
    for (var i = 0; i < days; i++) { var h = held(); if (!h.length) break; if (Math.random() >= LOSS_RATE) continue; loseCastle(h[Math.floor(Math.random() * h.length)]); }   // 玩家 2026-10-28：離線期間跨過的每個午夜 5% 機率
    try { syncWar(true); badgeCache.at = -1e9; titleCache.at = -1e9; updateUI(); saveGame(); } catch (e) {}
  };
  var oTick2 = window.tick;
  window.tick = function () {
    var t0 = S().ticks;
    try { return oTick2.apply(this, arguments); }
    finally { var t = S().ticks; if (t !== t0 && t % 100 === 50) { try { dailyLoss(); } catch (e) {} } }
  };
  // PVP 死亡噴裝：統一中或曾經統一 → 昇華支配 +5 遺物（含至高的支配）不會噴
  var asc5 = function (it) { try { var m = /~a(\d)/.exec(String(it && it.id || '')); return !!(m && +m[1] >= 5); } catch (e) { return false; } };
  if (typeof window.pvpChaoticDeathItemLoss === 'function') {
    var oLoss = window.pvpChaoticDeathItemLoss;
    window.pvpChaoticDeathItemLoss = function () {
      var p = P(), guard = []; 
      try {
        if (p && (unified() || data().everUnified)) {
          Object.keys(p.eq || {}).forEach(function (k) { var it = p.eq[k]; if (it && asc5(it) && !it.lock) { it.lock = true; guard.push(it); } });
          (p.inv || []).forEach(function (it) { if (it && asc5(it) && !it.lock) { it.lock = true; guard.push(it); } });
        }
        return oLoss.apply(this, arguments);
      } finally { guard.forEach(function (it) { delete it.lock; }); }
    };
  }
  window.__afkSiegeRules = { waveNeed: waveNeed, wavePlan: wavePlan, stageOf: stageOf, dailyLoss: dailyLoss, loseCastle: loseCastle, dayNum: dayNum, asc5: asc5 };

  // ── 領地村莊 8 折（玩家 2026-10-28）：在你持有的城堡領地內的村莊（含城堡本身），買藥水、卷軸、食物再打 8 折（與攻城勝利的全店 8 折相乘）──
  var TERR = { kent: ['kent', 'silverknight', 'gludin', 'talkingisland'], windwood: ['windwood', 'fairyforest'], heine: ['heine'], giran: ['giran'],
    orc_fortress: ['burningwillow'], dwarf_castle: ['witon'], aden: ['aden', 'oren'] };
  var TERR_RATE = 0.8;
  var terrCity = function (town) {
    var reg = null; try { reg = typeof mapRegionOf === 'function' ? mapRegionOf(town || (mapState && mapState.current)) : null; } catch (e) {}
    if (!reg) return null; var h = held();
    for (var c in TERR) if (h.indexOf(c) >= 0 && TERR[c].indexOf(reg) >= 0) return c;
    return null;
  };
  var discountable = function (d) {
    if (!d) return false; var n = String(d.n || '');
    if (d.type === 'pot' || d.type === 'scroll' || /卷軸|捲軸/.test(n)) return true;
    return d.ttmiBuffFamily === 'food' || /料理|餅乾|麵包|蛋糕|湯|肉|魚|水果|果汁/.test(n) && d.type !== 'wpn' && d.type !== 'arm' && d.type !== 'acc';
  };
  var priceCtx = null;
  if (typeof window.shopPrice === 'function') {
    var oSP = window.shopPrice;
    window.shopPrice = function (base) {
      var v = oSP.apply(this, arguments);
      try { if (priceCtx && discountable(priceCtx) && terrCity()) v = Math.floor(v * TERR_RATE); } catch (e) {}
      return v;
    };
  }
  if (typeof window.buyItem === 'function') {
    var oBuyT = window.buyItem;
    window.buyItem = function (id) { var sv = priceCtx; priceCtx = DB.items[id] || null; try { return oBuyT.apply(this, arguments); } finally { priceCtx = sv; } };
  }
  if (typeof window.renderShopItems === 'function' && typeof window.getIconUrl === 'function') {
    var oRSI = window.renderShopItems, oIcon = window.getIconUrl, rendering = false;
    window.getIconUrl = function (d) { if (rendering) priceCtx = d || null; return oIcon.apply(this, arguments); };   // 商店清單逐項：先取圖示、再算價格 → 借這一步知道正在算哪件
    window.renderShopItems = function () {
      rendering = true; var sv = priceCtx;
      try { var r = oRSI.apply(this, arguments); } finally { rendering = false; priceCtx = sv; }
      try {
        var c = terrCity(), list = document.getElementById('shop-items-list');
        if (c && list && !list.querySelector('.afk-terr-note')) { var n = document.createElement('div'); n.className = 'afk-terr-note text-amber-300 text-sm mb-2'; n.textContent = '🏰 這裡是你持有的' + (SIEGE_CITY[c] ? SIEGE_CITY[c].name : c) + '領地：藥水、卷軸、食物再打 8 折（已算進價格）。'; list.insertBefore(n, list.firstChild); }
      } catch (e) {}
      return r;
    };
  }
  window.__afkCastleWar = { forced: forced, forcedTick: forcedTick, forcedScale: forcedScale, homeCity: homeCity, setHome: setHome, unifyTitle: unifyTitle, held: held, data: data, save: save, syncWar: syncWar, tierOf: tierOf, groupSize: groupSize, payIncome: payIncome, shadowScale: shadowScale, NEW: NEW, need: need, unified: unified,
    _setCall: function (c) { call = c; }, fillCall: fillCall };
  console.log('[AFK-castlewar] 已啟用：七城攻城、城堡收成、宣戰與統一天下');
})();
