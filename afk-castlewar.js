/* ============================================================================
 * afk-castlewar.js — 血盟城堡擴張與統一伺服器（玩家 2026-10-21 指定）
 *
 * 城堡
 *   ‧七座城都能攻：原本的肯特、風木、海音之外，開放奇岩城、妖魔堡、侏儒城、亞丁城（沿用前三座的兩階段攻城：
 *     外門區打城門 → 內城打守護塔），各有自己的外門區、內城、城堡地圖與背景
 *   ‧打下來的城會一直留著（最多 7 座）；遊戲本身只記得「最近打下的那一座」當主城（城堡傳送、商店折扣照舊用它）
 * 收成（每小時，同模式共用）
 *   ‧3 座以上：每小時 500 萬天幣；5 座以上：再加每小時 100 龍之鑽石（可疊加）
 *   ‧7 座＝統一伺服器：每小時 100 龍之鑽石＋1,000 萬天幣＋100 席琳結晶
 * 宣戰
 *   ‧只有 1 座城：沒人對你宣戰；每多 1 座，對你宣戰的血盟 +2；統一伺服器：所有血盟都對你宣戰
 *   ‧宣戰中：殺敵對血盟的人不會變紅；狩獵時場上強制多 1 名敵對血盟 NPC（夢艷地獄也是：王＋敵對 NPC）
 *   ‧敵對 NPC 是王族時，5% 機率呼朋引伴：場上同時出滿 5 名敵對玩家（夢艷地獄：王＋4 名）
 *   ‧敵人越殺越強（累計擊殺數）：100 全身 +3、500 一次 2 人、1000 全身遺物 +0、1500 一次 3 人、2000 遺物 +5、
 *     3000 +10、4000 +15、5000 減傷 10%、6000 20%、7000 30%、8000 昇華支配 +0、9000 昇華支配 +5（＝跟你 1:1 的影子）
 *     做法：敵人的 HP、攻擊、防禦、命中、攻速按你本人的數值乘上強度比例（9000 以後 1:1），減傷用 HP 換算
 *   ‧統一伺服器：累計擊殺 1 萬名敵對 NPC → 全體血盟投降、宣戰結束；統一期間敵對 NPC 不掉任何東西，
 *     夢艷地獄中則照常有機會掉遺物
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
        sys('<span class="text-yellow-300 font-bold">🏰 血盟目前持有 ' + n + ' 座城堡' + (n >= 7 ? '——統一伺服器！' : '') + '</span>' + (n >= 2 && n < 7 ? '（對你宣戰的血盟：' + ((n - 1) * 2) + ' 個）' : ''));
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
  var REGION_OF = { kent: 'kent', windwood: 'windwood', heine: 'heine', giran: 'giran', aden: 'aden', orc_fortress: 'oren', dwarf_castle: 'dragonvalley' };
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

  // ── 宣戰 ──
  var warTarget = function (d) {
    var n = held().length;
    if (d.surrendered || n <= 1) return 0;
    if (n >= 7) return Infinity;
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
    window.npcClanKillIgnoresAlignment = function (mob) { if (isWarMob(mob)) return true; return oIgn.apply(this, arguments); };
  }

  // ── 強度階段 ──
  var TIERS = [
    [9000, 1.00, 0.30, '昇華支配 +5（你的影子）'], [8000, 0.93, 0.30, '昇華支配 +0'], [7000, 0.85, 0.30, '遺物 +15・減傷 30%'],
    [6000, 0.85, 0.20, '遺物 +15・減傷 20%'], [5000, 0.85, 0.10, '遺物 +15・減傷 10%'], [4000, 0.85, 0, '遺物 +15'],
    [3000, 0.75, 0, '遺物 +10'], [2000, 0.65, 0, '遺物 +5'], [1000, 0.55, 0, '遺物 +0'], [100, 0.40, 0, '全身 +3']
  ];
  var tierOf = function (k) { for (var i = 0; i < TIERS.length; i++) if (k >= TIERS[i][0]) return TIERS[i]; return null; };
  var groupSize = function (k) { return k >= 1500 ? 3 : (k >= 500 ? 2 : 1); };
  // 你本人的一般攻擊平均傷害（滾動平均）
  var avgHit = 0;
  if (typeof window.playerAttack === 'function') {
    var oPA = window.playerAttack;
    window.playerAttack = function () {
      var ms = (typeof mapState !== 'undefined' && mapState) ? mapState.mobs : [], snap = ms.map(function (m) { return m ? m.curHp : null; });
      var r = oPA.apply(this, arguments);
      try { var lost = 0; ms.forEach(function (m, i) { if (m && snap[i] != null) lost += Math.max(0, snap[i] - Math.max(0, m.curHp)); }); if (lost > 0) avgHit = avgHit ? avgHit * 0.9 + lost * 0.1 : lost; } catch (e) {}
      return r;
    };
  }
  var shadowScale = function (m, k) {
    var t = tierOf(k), p = P(); if (!t || !p || !p.d) return;
    var r = t[1], dr = t[2], d = p.d;
    var hit = avgHit || Math.max(10, ((Number(d.meleeDmg) || 0) + 20) * 2);
    var hp = Math.round((p.mhp || 1000) * r / (1 - dr));
    m.hp = hp; m.curHp = hp;
    var e = Math.max(1, Math.round(hit * r));
    m.dmg = [1, Math.max(1, Math.round(e * 0.4))]; m.db = Math.max(0, Math.round(e * 0.8));
    m.lv = p.lv || m.lv || 1;
    m.ac = Math.round((Number(d.ac) || 0) * r);
    m.mr = Math.round((Number(d.mr) || 0) * r);
    m.hit = Math.round(Math.max(Number(d.meleeHit) || 0, Number(d.rangedHit) || 0) * r);
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
  window.__afkHostileCall = function () { return !!(call && typeof mapState !== 'undefined' && call.map === mapState.current && !call.filled); };
  var hostilesOnField = function (ws) { return mapState.mobs.filter(function (m) { return live(m) && isWarMob(m, ws); }).length; };
  var need = function () {
    var d = data(); if (!d.warIds.length || !huntMap()) return 0;
    if (window.__afkHostileCall()) return call.need;
    return groupSize(d.kills);
  };
  window.__afkWantHostile = function (idx) {
    try { var n = need(); if (!n) return false; return hostilesOnField() < n; } catch (e) { return false; }
  };
  window.__afkForceTroll = function (idx, mobId) {
    try {
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
        if (m && !m._afkWarDone && isWarMob(m)) {
          m._afkWarDone = true;
          var d = data();
          shadowScale(m, d.kills);
          // 王族：5% 呼朋引伴
          if ((m._pvpAvatar === '王子' || m._pvpAvatar === '公主') && !window.__afkHostileCall() && Math.random() < 0.05) {
            call = { map: mapState.current, need: dream() ? 4 : 5, filled: false };
            sys('<span class="text-red-400 font-bold">📯 ' + m.n + ' 呼朋引伴！敵對血盟的成員蜂擁而至！</span>');
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

  // ── 擊殺：累計、投降；統一期間不掉落（夢艷地獄照常掉遺物）──
  if (typeof window.killMob === 'function') {
    var oKill = window.killMob;
    window.killMob = function (idx) {
      var m = mapState.mobs[idx], war = m && !m._dead && isWarMob(m);
      var r = oKill.apply(this, arguments);
      try {
        if (war && m._dead) {
          var d = data(); d.kills++;
          var t0 = tierOf(d.kills - 1), t1 = tierOf(d.kills);
          if (t1 && (!t0 || t0[0] !== t1[0])) sys('<span class="text-red-300 font-bold">⚔ 敵對血盟增援變強了：' + t1[3] + '（已擊殺 ' + d.kills + ' 名）</span>');
          if (d.kills === 500 || d.kills === 1500) sys('<span class="text-red-300 font-bold">⚔ 敵對血盟改為一次 ' + groupSize(d.kills) + ' 人出擊！</span>');
          if (unified() && d.kills >= 10000 && !d.surrendered) {
            d.surrendered = true; save(d); syncWar(true);
            sys('<span class="text-yellow-300 font-bold">👑 你擊敗了 10,000 名敵對血盟成員——全伺服器的血盟向你投降，宣戰結束！</span>');
          } else save(d);
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
  var payIncome = function () {
    var p = P(); if (!p) return;
    var d = data(), n = held().length, now = Date.now();
    if (n < 3) { d.lastPay = now; save(d); return; }
    if (!d.lastPay) { d.lastPay = now; save(d); return; }
    var hrs = Math.floor((now - d.lastPay) / 3600000); if (hrs <= 0) return;
    hrs = Math.min(hrs, 72);
    var gold = 0, dia = 0, cry = 0;
    if (n >= 7) { gold = 10000000; dia = 100; cry = 100; }
    else { if (n >= 3) gold += 5000000; if (n >= 5) dia += 100; }
    gold *= hrs; dia *= hrs; cry *= hrs;
    if (gold) p.gold = (p.gold || 0) + gold;
    if (dia) { try { window.pandoraAdjustSharedDiamonds(dia); } catch (e) {} }
    if (cry && DB.items.sherine_crystal) { try { gainItem('sherine_crystal', cry, true, true); } catch (e) {} }
    d.lastPay += hrs * 3600000; save(d);
    sys('<span class="text-yellow-300 font-bold">🏰 城堡收成（' + hrs + ' 小時・' + n + ' 座城）：</span>' + [gold ? gold.toLocaleString() + ' 天幣' : '', dia ? dia + ' 龍之鑽石' : '', cry ? cry + ' 席琳結晶' : ''].filter(Boolean).join('、'));
    try { updateUI(); } catch (e) {}
  };

  var oTick = window.tick;
  window.tick = function () {
    var t0 = S().ticks;
    try { return oTick.apply(this, arguments); }
    finally {
      var t = S().ticks;
      if (t !== t0 && t % 100 === 0) { try { payIncome(); } catch (e) {} try { syncWar(false); } catch (e) {} }
      if (call && (typeof mapState === 'undefined' || call.map !== mapState.current)) call = null;
    }
  };

  // ── 介面：攻城選單上方顯示城堡與宣戰狀態 ──
  var panel = function () {
    var d = data(), h = held(), n = h.length, t = tierOf(d.kills);
    var inc = n >= 7 ? '每小時 100 龍鑽＋1,000 萬天幣＋100 席琳結晶' : (n >= 5 ? '每小時 500 萬天幣＋100 龍鑽' : (n >= 3 ? '每小時 500 萬天幣' : '3 座以上才有收成'));
    var war = d.surrendered ? '全伺服器已投降，宣戰結束' : (d.warIds.length ? d.warIds.length + ' 個血盟對你宣戰' : (n <= 1 ? '只有 1 座城，沒人對你宣戰' : '—'));
    return '<div class="bg-slate-900/70 border border-amber-700/60 rounded p-3 text-sm text-slate-200 leading-relaxed">' +
      '<div class="font-bold text-amber-200 mb-1">🏰 持有城堡 ' + n + '／7' + (n >= 7 ? '（統一伺服器）' : '') + '</div>' +
      '<div>' + (h.map(function (c) { return SIEGE_CITY[c] ? SIEGE_CITY[c].name : c; }).join('、') || '尚未持有') + '</div>' +
      '<div class="mt-1">收成：' + inc + '</div>' +
      '<div>宣戰：' + war + '</div>' +
      '<div>已擊殺敵對血盟 ' + d.kills.toLocaleString() + ' 名（目前強度：' + (t ? t[3] : '一般') + '；一次 ' + groupSize(d.kills) + ' 人）' + (n >= 7 && !d.surrendered ? '・擊殺 10,000 名後全體投降' : '') + '</div></div>';
  };
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
          var note = el.querySelector('.border-t.border-slate-700'); if (note) note.textContent = '七座城都可以宣戰，打下的城會一直持有（最多 7 座）。3 座以上每小時有收成；持有 2 座以上會有血盟對你宣戰。';
        }
      } catch (e) {}
      return r;
    };
  }

  window.__afkCastleWar = { held: held, data: data, save: save, syncWar: syncWar, tierOf: tierOf, groupSize: groupSize, payIncome: payIncome, shadowScale: shadowScale, NEW: NEW, need: need, unified: unified,
    _setCall: function (c) { call = c; }, fillCall: fillCall };
  console.log('[AFK-castlewar] 已啟用：七城攻城、城堡收成、宣戰與統一伺服器');
})();
