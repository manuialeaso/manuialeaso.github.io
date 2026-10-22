/* ============================================================================
 * afk-corrupt.js — 三座龍副本：破滅法利昂（水）、深淵巴拉卡斯（火）、災厄林德拜爾（風）（玩家 2026-10-21 指定；
 *   四大龍副本＝侵蝕安塔瑞斯、破滅法利昂、災厄林德拜爾、深淵巴拉卡斯）
 *
 * 照「侵蝕的安塔瑞斯巢穴」複製：同樣在威頓村 NPC 多魯嘉貝爾進入、同樣 4 區推進（入口→通道→深處→棲息地）、
 * 擊敗各區頭目自動深入、最終龍七階變身、通關回威頓村。入場限制完全相同：
 *   每個角色每天每座副本可通關 1 次（主戰與出戰傭兵都消耗；UTC+8 凌晨 12 點重置；失敗／離開不消耗）、
 *   區內禁止傳送、不能選地圖、禁止離線掛機（需核心補丁 23）。
 * 各副本的通關次數分開計算（安塔瑞斯通關不影響法利昂）。
 *
 * 額外效果（只有這三座新副本）：
 *   ‧四龍房間效果：每秒 500 真實傷害＋500 對應屬性傷害（屬性部分受抗性影響；玩家與傭兵皆受影響）
 *   ‧王的效果：場上有頭目時，每 20 秒對全隊施放三種治療減益之一，持續 10 秒：
 *       死亡藥水（喝治癒藥水變成扣血）、死亡治療（治癒魔法變成扣血）、減少治療（治癒效果減半）
 *
 * 掉落：比照安塔瑞斯；最終龍的安塔瑞斯材料換成該龍自己的八種龍專屬材料（同掉率），另加該龍的六階魔法娃娃 1%。
 *   四座最終龍（含安塔瑞斯）另外：隨機一隻怪的白金卡 0.001%（×隊伍人數、吃兔腳）、鑽白金幻化 0.01%。
 * 境滅亡域鑰匙：四大龍副本都會掉（afk-dreamhell 的地圖清單由本檔補上）。
 * 外觀：借用遊戲現有的龍與元素怪動畫，畫面上加暗紫色「侵蝕」光暈；背景圖由 scratchpad mkbg.py 產生。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('corrupt')) return;
  if (typeof DB === 'undefined' || typeof ANTHARAS_AREA_BOSS === 'undefined' || typeof window.antharasOnBossKill !== 'function' || typeof window.enterOblivionMap !== 'function') {
    console.warn('[AFK-corrupt] 找不到安塔瑞斯副本，略過'); return;
  }

  var PARTS = ['巢穴入口', '巢穴通道', '巢穴深處', '棲息地'];
  var DRAGONS = {
    fafurion: { pre: '破滅', dragon: '法利昂', ele: 'water', res: 'resWater', doll: 'doll_法利昂', color: '#38bdf8',
      minions: [['破滅的深淵水靈', '深淵水靈'], ['破滅的鯊魚', '鯊魚'], ['破滅的水元素守護者', '水元素守護者']],
      bosses: [['破滅的水精靈王', '水精靈王'], ['破滅的水靈之主', '水靈之主'], ['破滅的卡普', '冥法軍王海露拜']],
      skills: { breath: '寒冰噴吐', crack: '水龍漩渦', quake: '冰河衝擊' } },
    valakas: { pre: '深淵', dragon: '巴拉卡斯', ele: 'fire', res: 'resFire', doll: 'doll_巴拉卡斯', color: '#f97316',
      minions: [['深淵的火焰戰士', '暗黑火焰戰士'], ['深淵的火焰弓箭手', '暗黑火焰弓箭手'], ['深淵的熔岩高崙', '熔岩高崙']],
      bosses: [['深淵的阿西塔基奧', '火焰阿西塔基奧'], ['深淵的伊弗利特', '恐怖的伊弗利特'], ['深淵的火靈之主', '火靈之主']],
      skills: { breath: '烈焰噴吐', crack: '熔岩爆裂', quake: '火山震擊' } },
    lindvior: { pre: '災厄', dragon: '林德拜爾', ele: 'wind', res: 'resWind', doll: 'doll_林德拜爾', color: '#4ade80',
      minions: [['災厄的深淵風靈', '深淵風靈'], ['災厄的飛龍', '飛龍'], ['災厄的翼龍', '翼龍']],
      bosses: [['災厄的風精靈王', '風精靈王'], ['災厄的風靈之主', '風靈之主'], ['災厄的風之牙', '風之牙']],
      skills: { breath: '颶風噴吐', crack: '真空裂刃', quake: '龍捲衝擊' } }
  };
  var ELE_RES = { water: 'resWater', fire: 'resFire', wind: 'resWind', earth: 'resEarth' };
  var ELE_N = { water: '水', fire: '火', wind: '風', earth: '地' };

  // ── 龍專屬材料（三龍各八種，比照安塔瑞斯）──
  var MAT = { scale: '鱗', bone: '骨', claw: '爪', blood: '血', flesh: '肉', fang: '牙', eye: '眼', heart: '心' };
  Object.keys(DRAGONS).forEach(function (key) {
    var C = DRAGONS[key];
    Object.keys(MAT).forEach(function (part) {
      var id = 'mat_' + key + '_' + part; if (DB.items[id]) return;
      var a = DB.items['mat_antharas_' + part] || {};
      DB.items[id] = { n: C.dragon + '之' + MAT[part], type: 'etc', p: a.p || 1000, c: 'text-amber-300', noUse: true, gachaWeight: 0,
        img: 'assets/icons/items/' + C.dragon + '之' + MAT[part] + '.png',
        d: '取自' + C.pre + '的' + C.dragon + '的龍之素材（' + MAT[part] + '），仍殘留古龍氣息。可在材料工坊提煉，亦可作為已開放配方的材料。' };
    });
  });

  // ── 怪物 ──
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var reSkill = function (m, sk, ele) {
    Object.keys(m).forEach(function (f) {
      if (!/^mag\d*$/.test(f) || !m[f] || typeof m[f] !== 'object') return;
      var g = m[f];
      if (g.ele === 'earth') g.ele = ele;
      if (g.skn === '劇毒噴吐') g.skn = sk.breath;
      else if (g.skn === '地裂術' || g.skn === '地面震裂') g.skn = sk.crack;
      else if (g.skn === '屬性噴吐') g.skn = sk.breath;
      else if (g.skn === '礦石投擲') g.skn = sk.quake;
    });
  };
  var aliasPairs = [], allMaps = [], finals = {}, areasOf = {}, keyOfMap = {};
  // 龍的變身：基本 → 狂怒 → 發瘋 → 癲狂 → 墮落 → 滅塵 → 時空（玩家 2026-10-21 指定；新加的階段每階 HP +10%、傷害 +1%）
  var STAGES = ['狂怒', '發瘋', '癲狂', '墮落', '滅塵', '時空'];
  var grow = function (m) {
    m.hp = Math.round((m.hp || 1) * 1.1); m.lv = (m.lv || 95) + 1;
    if (m.db != null) m.db = Math.round(m.db * 1.01);
    if (Array.isArray(m.dmg)) m.dmg = [m.dmg[0], Math.max(1, Math.round(m.dmg[1] * 1.01))];
    Object.keys(m).forEach(function (f) { if (/^mag\d*$/.test(f) && m[f] && typeof m[f] === 'object' && m[f].db != null) m[f].db = Math.round(m[f].db * 1.01); });
  };
  var chainUp = function (ids, names) {   // ids[0..6]：把七階串成變身鏈
    ids.forEach(function (id, i) {
      var m = DB.mobs[id]; if (!m) return;
      m.n = names[i]; m._afkDragonStage = i + 1;
      if (i < ids.length - 1) { m.transformTo = ids[i + 1]; m.transformHpPct = 0.01; m.transformFxText = names[i] + '陷入' + STAGES[i]; m.transformLogText = '的力量再度暴走，化為「' + STAGES[i] + '」型態'; }
      else { delete m.transformTo; delete m.transformHpPct; delete m.transformFxText; delete m.transformLogText; }
    });
  };
  var extend = function (ids, names, fromIdx) {   // 從第 fromIdx 階往後複製並成長
    for (var i = fromIdx; i < 7; i++) { if (DB.mobs[ids[i]]) continue; var m = clone(DB.mobs[ids[i - 1]]); m.n = names[i]; grow(m); DB.mobs[ids[i]] = m; }
  };
  Object.keys(DRAGONS).forEach(function (key) {
    var C = DRAGONS[key], ids = {};
    var mk = function (id, tpl, n, anim, extra) {
      var b = DB.mobs[tpl]; if (!b) return null;
      var m = clone(b); m.n = n; m.e = C.ele; reSkill(m, C.skills, C.ele);
      if (extra) Object.keys(extra).forEach(function (k) { m[k] = extra[k]; });
      m.afkCorrupt = key;
      DB.mobs[id] = m; ids[id] = 1;
      if (anim) aliasPairs.push([n, anim]);
      return id;
    };
    var p = 'cr_' + key + '_';
    mk(p + 'm1', 'ant_kama_nan', C.minions[0][0], C.minions[0][1]);
    mk(p + 'm2', 'ant_kama_flame', C.minions[1][0], C.minions[1][1]);
    mk(p + 'm3', 'ant_earth_wild_dragon', C.minions[2][0], C.minions[2][1]);
    mk(p + 'b1', 'ant_kama_flame_king', C.bosses[0][0], C.bosses[0][1]);
    mk(p + 'b2', 'ant_kama_nan_king', C.bosses[1][0], C.bosses[1][1]);
    mk(p + 'b3', 'ant_kama_king', C.bosses[2][0], C.bosses[2][1]);
    var dn = [C.pre + '的' + C.dragon].concat(STAGES.map(function (st) { return C.pre + '的' + st + C.dragon; }));
    var di = [1, 2, 3, 4, 5, 6, 7].map(function (i) { return p + 'd' + i; });
    mk(di[0], 'ant_antharas_eroded', dn[0], C.dragon);
    mk(di[1], 'ant_antharas_fury', dn[1], C.dragon);
    mk(di[2], 'ant_antharas_mad', dn[2], C.dragon);
    extend(di, dn, 3);
    dn.slice(3).forEach(function (n) { aliasPairs.push([n, C.dragon]); });
    chainUp(di, dn);
    var n3 = dn[6];
    finals[key] = n3;
    // 地圖
    var maps = PARTS.map(function (part, i) { return 'cr_' + key + (i < 3 ? '_nest_' + (i + 1) : '_lair'); });
    areasOf[key] = maps;
    maps.forEach(function (mp, i) {
      allMaps.push(mp); keyOfMap[mp] = key;
      var nm = C.pre + '的' + C.dragon + PARTS[i];
      ANTHARAS_AREA_NAMES[mp] = nm;
      ANTHARAS_AREA_BOSS[mp] = [p + 'b1', p + 'b2', p + 'b3', p + 'd1'][i];
      DB.maps[mp] = i < 2 ? [p + 'm1', p + 'm2'] : (i === 2 ? [p + 'm1', p + 'm2', p + 'm3'] : [p + 'm3']);
      try { if (typeof AREA_1920 !== 'undefined') AREA_1920.add(nm); } catch (e) {}
      try { if (typeof HUNT_BGM !== 'undefined') HUNT_BGM[mp] = ['music128', 'music130', 'music130', 'music133'][i]; } catch (e) {}
    });
    // 掉落：比照安塔瑞斯
    if (typeof MOB_DROPS !== 'undefined') {
      var src = function (n) { return (MOB_DROPS[n] || []).map(function (x) { return x.slice(); }); };
      MOB_DROPS[C.minions[0][0]] = src('喀瑪南'); MOB_DROPS[C.minions[1][0]] = src('喀瑪焰'); MOB_DROPS[C.minions[2][0]] = src('大地荒龍');
      MOB_DROPS[C.bosses[0][0]] = src('喀瑪焰王'); MOB_DROPS[C.bosses[1][0]] = src('喀瑪南王'); MOB_DROPS[C.bosses[2][0]] = src('喀瑪王');
      // 龍專屬材料：比照安塔瑞斯八種（鱗／骨／爪／血／肉／牙／眼／心），同樣掉率；之後做該龍的特殊裝備
      var fin = src('被侵蝕的瘋狂安塔瑞斯').filter(function (x) { return x[0] !== 'item_sealed_earth_eye'; }).map(function (x) {
        var m = /^mat_antharas_(\w+)$/.exec(x[0]); return m ? ['mat_' + key + '_' + m[1], x[1]] : x;
      });
      if (DB.items[C.doll]) fin.push([C.doll, 1]);
      MOB_DROPS[n3] = fin;
    }
  });
  // ── 侵蝕安塔瑞斯也改成七階（核心補丁 30 讓通關判定認新的最終階名字）──
  try {
    var AOLD = '被侵蝕的瘋狂安塔瑞斯';
    var an = ['被侵蝕的安塔瑞斯'].concat(STAGES.map(function (st) { return '被侵蝕的' + st + '安塔瑞斯'; }));
    var ai = ['ant_antharas_eroded', 'ant_antharas_fury', 'ant_antharas_mad', 'ant_antharas_s4', 'ant_antharas_s5', 'ant_antharas_s6', 'ant_antharas_s7'];
    if (DB.mobs.ant_antharas_mad) {
      DB.mobs.ant_antharas_mad.n = an[2];
      extend(ai, an, 3);
      chainUp(ai, an);
      window.__afkAntFinal = an[6];
      if (typeof MOB_DROPS !== 'undefined' && MOB_DROPS[AOLD]) { MOB_DROPS[an[6]] = MOB_DROPS[AOLD]; delete MOB_DROPS[AOLD]; }
      an.slice(2).forEach(function (n) { aliasPairs.push([n, AOLD]); });
      try { if (typeof CARD_DROP_ALIAS !== 'undefined') { delete CARD_DROP_ALIAS[AOLD]; CARD_DROP_ALIAS[an[6]] = an[0]; } } catch (e) {}
    }
  } catch (e) { console.warn('[AFK-corrupt] 安塔瑞斯七階', e); }

  // ── 卡片：小怪與王比照侵蝕安塔瑞斯（各副本自成一個收集地區；龍的三段變身只有第一段有卡，打倒最終段掉第一段的卡）──
  try {
    if (typeof CARD_REGIONS !== 'undefined' && typeof CARD_MOB_INFO !== 'undefined') {
      var RSTAT = { fafurion: 'resWater', valakas: 'resFire', lindvior: 'resWind' };
      Object.keys(DRAGONS).forEach(function (key) {
        var C = DRAGONS[key], rk = 'cr_' + key, maps = areasOf[key];
        if (!CARD_REGIONS.some(function (r) { return r.key === rk; })) CARD_REGIONS.push({ key: rk, name: C.pre + C.dragon + '巢穴', stat: RSTAT[key], vals: [1, 2, 3, 4, 5], maps: maps });
        var names = [];
        var reg = function (id, mk) {
          var mob = DB.mobs[id]; if (!mob) return; var n = mob.n;
          if (names.indexOf(n) < 0) names.push(n);
          if (!CARD_MOB_INFO[n]) CARD_MOB_INFO[n] = { id: id, mob: mob };
          (CARD_MOB_REGIONS[n] = CARD_MOB_REGIONS[n] || []); if (CARD_MOB_REGIONS[n].indexOf(rk) < 0) CARD_MOB_REGIONS[n].push(rk);
          (CARD_MOB_MAPS[n] = CARD_MOB_MAPS[n] || []); if (CARD_MOB_MAPS[n].indexOf(mk) < 0) CARD_MOB_MAPS[n].push(mk);
        };
        var p = 'cr_' + key + '_';
        reg(p + 'm1', maps[0]); reg(p + 'm2', maps[0]); reg(p + 'm3', maps[2]);
        reg(p + 'b1', maps[0]); reg(p + 'b2', maps[1]); reg(p + 'b3', maps[2]); reg(p + 'd1', maps[3]);
        try { if (typeof _CARD_MAP_NAMES !== 'undefined') maps.forEach(function (mk) { _CARD_MAP_NAMES[mk] = ANTHARAS_AREA_NAMES[mk]; }); } catch (e) {}
        names.sort(function (a, b) { return (CARD_MOB_INFO[a].mob.lv || 0) - (CARD_MOB_INFO[b].mob.lv || 0); });
        CARD_REGION_MOBS[rk] = names;
        if (typeof CARD_DROP_ALIAS !== 'undefined') CARD_DROP_ALIAS[finals[key]] = DB.mobs[p + 'd1'].n;
        names.forEach(function (n) {
          CARD_TIERS.forEach(function (ct) {
            var id = cardId(n, ct.t); if (DB.items[id]) return;
            DB.items[id] = { n: n + ' 的' + ct.sfx, type: 'misc', eff: 'card', cardTier: ct.t, cardMob: n, c: ct.col, img: ct.img, p: ct.price, gachaWeight: ct.weight,
              d: '怪物卡片。使用以在卡片收集冊中登錄「' + n + '」（' + ct.sfx + '效果）。' };
          });
        });
      });
    }
  } catch (e) { console.warn('[AFK-corrupt] 卡片', e); }

  // 動畫：借用現有怪物資料夾（共用 alias，並複製該資料夾在各動畫設定集合中的身分）
  try {
    var SETS = ['MOB_ANIM_NAMES', 'MOB_ANIM_BAKED_SHADOW', 'MOB_SHADOW_TINT', 'MOB_ANIM_BIG', 'MOB_ANIM_SMALL', 'MOB_ANIM_SPRITE_SHADOW', 'MOB_ANIM_WEAPON_FX', 'MOB_ANIM_WEAPON_FX2', 'MOB_ANIM_8DIR'];
    var OBJS = ['MOB_ANIM_SKILL_FX', 'MOB_YLIFT', 'MOB_ANIM_DEATH_FX', 'BOSS_ENTRANCE_FX', 'MOB_HURT_SFX', 'MOB_KILL_SFX', 'MOB_ATTACK_SFX'];
    var get = function (n) { try { return (0, eval)(n); } catch (e) { return null; } };   // 全域 const 需用間接 eval 取得
    var setObjs = SETS.map(get), objObjs = OBJS.map(get), names = get('MOB_ANIM_NAMES');
    aliasPairs.forEach(function (pr) {
      var n = pr[0], target = (typeof MOB_ANIM_ALIAS !== 'undefined' && MOB_ANIM_ALIAS[pr[1]]) || pr[1];
      if (!names || !names.has(pr[1])) return;   // 目標沒有動畫 → 用怪物圖示
      MOB_ANIM_ALIAS[n] = target;
      setObjs.forEach(function (s) { if (s && s.has && s.has(pr[1])) s.add(n); });
      objObjs.forEach(function (o) { if (o && o[pr[1]] != null && o[n] == null) o[n] = o[pr[1]]; });
    });
  } catch (e) { console.warn('[AFK-corrupt] 動畫 alias', e); }

  // 境滅亡域鑰匙、離線禁止
  try { if (Array.isArray(window.__afkCorruptDragonMaps)) allMaps.forEach(function (m) { if (window.__afkCorruptDragonMaps.indexOf(m) < 0) window.__afkCorruptDragonMaps.push(m); }); } catch (e) {}
  window.__afkNoOfflineMaps = (window.__afkNoOfflineMaps || []).concat(allMaps);

  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var cur = function () { var s = S(); return (s.antharas && s._afkDragon && DRAGONS[s._afkDragon]) ? s._afkDragon : null; };
  var inMap = function () { var k = cur(); return k && keyOfMap[mapState.current] === k; };

  // ── 每日次數：各副本分開（借用安塔瑞斯的整套機制，切換「目前副本」的存放鍵）──
  var ctx = null;   // 正在處理哪一座（入場檢查／NPC 畫面／結算）
  var withCtx = function (k, fn) { var o = ctx; ctx = k; try { return fn(); } finally { ctx = o; } };
  var oRef = window.antharasRoleRef;
  window.antharasRoleRef = function (role) {
    var r = oRef.apply(this, arguments);
    if (r && ctx) r.savedDay = Math.max(0, Math.floor(Number(role && role['afkClearDay_' + ctx]) || 0));
    return r;
  };
  var oKey = window.antharasRoleClearKey;
  window.antharasRoleClearKey = function () { var k = oKey.apply(this, arguments); return ctx ? k + '__' + ctx : k; };
  var oClaim = window.antharasClaimDailyClear;
  window.antharasClaimDailyClear = function () {
    if (!ctx) return oClaim.apply(this, arguments);
    var roles = [player].concat((player.allies || []).filter(Boolean));
    var keep = roles.map(function (r) { return r.antharasClearDay; });
    var res = oClaim.apply(this, arguments);
    var today = (typeof antharasDayKey === 'function') ? antharasDayKey() : 0;
    roles.forEach(function (r, i) { if (res && res.ok) r['afkClearDay_' + ctx] = today; r.antharasClearDay = keep[i]; });
    return res;
  };

  // ── 入場 ──
  window.afkCorruptEnter = function (key) {
    var C = DRAGONS[key]; if (!C) return;
    if (S().antharas) { logSys('你已身在龍之巢穴之中。'); return; }
    if (typeof mercenaryRoleBattleBlocked === 'function' && mercenaryRoleBattleBlocked(areasOf[key][0])) return;
    if (player.statuses && (player.statuses.stone > 0 || player.statuses.paralyze > 0 || player.statuses.freeze > 0 || player.statuses.stun > 0 || player.statuses.sleep > 0)) {
      logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法進入。'); return;
    }
    var used = withCtx(key, function () { return antharasPartyUsedToday(); });
    if (used.length) { logSys('<span class="text-amber-300">隊伍中的 ' + used.map(function (r) { return r.name; }).join('、') + ' 今日已通關' + C.pre + '的' + C.dragon + '巢穴；請更換或解散已使用次數的傭兵後再進入（UTC+8 凌晨 12 點重置）。</span>'); return; }
    var s = S(); s.antharas = 1; s._antAdvance = false; s._afkDragon = key;
    logSys('<span class="font-bold" style="color:' + C.color + '">🐉 你踏入了' + C.pre + '的' + C.dragon + '巢穴……</span><span class="text-amber-200"> 區內無法選擇地圖，也無法使用傳送術與瞬間移動卷軸；擊敗各區頭目將自動深入。巢穴裡瀰漫著' + ELE_N[C.ele] + '屬性的侵蝕之力（每秒受到屬性傷害）。</span>');
    enterOblivionMap(areasOf[key][0]);
    try { if (!document.getElementById('item-modal').classList.contains('hidden')) closeModal(); } catch (e) {}
    try { updateUI(); saveGame(); } catch (e) {}
  };

  // ── 推進與通關 ──
  var oBossKill = window.antharasOnBossKill;
  window.antharasOnBossKill = function (bossName) {
    var key = cur(); if (!key) return oBossKill.apply(this, arguments);
    var C = DRAGONS[key], s = S();
    if (bossName === finals[key]) {
      s.antharas = 0; s._antAdvance = false; s._afkDragon = null;
      logSys('<span class="font-bold" style="color:' + C.color + '">🏆 你擊敗了' + finals[key] + '，淨化了巢穴！</span>主戰角色與本次出戰傭兵的今日通關次數均已消耗，自動返回威頓村。');
      setMapSelectors('town_witon'); changeMap(true);
      if (!s.ff) saveGame();
      return;
    }
    var next = Math.min(4, (s.antharas || 1) + 1); s.antharas = next;
    var mp = areasOf[key][next - 1];
    logSys('<span class="font-bold" style="color:' + C.color + '">🐉 頭目倒下，你繼續深入——' + ANTHARAS_AREA_NAMES[mp] + '。</span>');
    enterOblivionMap(mp);
    if (!s.ff) saveGame();
  };
  var oKill = window.killMob;
  window.killMob = function (idx) {
    var key = cur(), m = mapState.mobs[idx];
    if (key && m && !m._dead && m.n === finals[key] && !(m.transformTo) && mapState.current === areasOf[key][3]) {
      var res = withCtx(key, function () { return antharasClaimDailyClear(); });
      if (!res.ok) {
        if (res.storageError) { m.curHp = 1; logSys('<span class="text-red-400 font-bold">通關紀錄暫時無法寫入，頭目恢復 1 HP；請再次攻擊重試。</span>'); return; }
        m._dead = true; m.curHp = 0;
        var s = S(); s.antharas = 0; s._antAdvance = false; s._afkDragon = null;
        logSys('<span class="text-amber-300 font-bold">' + ((res.names || []).join('、') || '隊伍中的角色') + ' 今日已完成過這座副本，本次不重複結算通關與掉落。</span>');
        setMapSelectors('town_witon'); changeMap(true); try { saveGame(); } catch (e) {}
        return;
      }
    }
    var r = oKill.apply(this, arguments);
    try { if (m && m._dead && !m._afkCrCard && FINAL_ALL.indexOf(m.n) >= 0) { m._afkCrCard = true; finalBonus(m); } } catch (e) {}
    // 滅魔蔑視水晶：各龍最終王必掉對應屬性（侵蝕安塔瑞斯＝地，由 afk-dreamhell 處理）
    try { if (m && m._dead && !m._afkCrCry) { var fk = Object.keys(finals).find(function (k) { return finals[k] === m.n; }); if (fk) { m._afkCrCry = true; var cid = 'afk_contempt_' + DRAGONS[fk].ele; if (DB.items[cid]) gainItem(cid, 1); } } } catch (e) {}
    return r;
  };
  // 四大龍副本最終王（含安塔瑞斯）：隨機一隻怪的白金卡 0.001%（×隊伍人數、吃幸運爆走兔腳）、鑽白金幻化 0.01%
  var FINAL_ALL = [window.__afkAntFinal || '被侵蝕的瘋狂安塔瑞斯'].concat(Object.keys(finals).map(function (k) { return finals[k]; }));
  var finalBonus = function (m) {
    var rx = (typeof window.__afkRelicDropMult === 'function') ? window.__afkRelicDropMult() : 1;
    var rate = (typeof partyDropRate === 'function') ? partyDropRate(0.00001 * rx) : 0.00001 * rx;
    if (typeof CARD_MOB_INFO !== 'undefined' && Math.random() < rate) {
      var names = Object.keys(CARD_MOB_INFO), nm = names[Math.floor(Math.random() * names.length)];
      if (typeof acquireCard === 'function') acquireCard(nm, 4, 1);
    }
    if (DB.items.afk_card_pick && Math.random() < 0.0001) {
      gainItem('afk_card_pick', 1);
      try { logSys('<span class="c-card-diamond font-bold">💎 ' + m.n + ' 掉落了鑽白金幻化！</span>'); } catch (e) {}
    }
  };
  // 棲息地：中央＝最終龍、其餘＝第三種小怪（同安塔瑞斯棲息地）
  var oSpawn = window.spawnMob;
  window.spawnMob = function (idx) {
    var key = cur();
    if (!key || mapState.current !== areasOf[key][3]) return oSpawn.apply(this, arguments);
    var id = idx === 1 ? ANTHARAS_AREA_BOSS[mapState.current] : 'cr_' + key + '_m3';
    if (idx === 1 && mapState.mobs.some(function (x) { return x && x.boss && !x._dead; })) return;
    var b = DB.mobs[id]; if (!b) return;
    mapState.mobs[idx] = { ...b, curHp: b.hp, uid: uid(), _born: ++_mobBornSeq, _bornMs: Date.now(), _magCd: {}, justHit: false, st: newMobStatus() };
    applySherineBuff(idx);
    if (b.hard) initHardSkin(mapState.mobs[idx]);
    if (b.boss && typeof vfxBossEntrance === 'function') { try { vfxBossEntrance(mapState.mobs[idx]); } catch (e) {} }
    if (!S().ff) renderMobs();
  };
  // 離開／死亡時清掉「目前副本」
  ['changeMap', 'killPlayer'].forEach(function (fn) {
    var o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () { var r = o.apply(this, arguments); try { if (!S().antharas) S()._afkDragon = null; } catch (e) {} return r; };
  });

  // ── 治療減益（王施放）──
  var debuff = new WeakMap();   // 角色 → { pot, heal, half }（到期 tick）
  var has = function (t, k) { var d = t && debuff.get(t); return !!(d && d[k] > (S().ticks || 0)); };
  var DEB = [['pot', '死亡藥水', '喝治癒藥水會變成扣血'], ['heal', '死亡治療', '治癒魔法會變成扣血'], ['half', '減少治療', '受到的治癒效果減半']];
  var team = function () { var a = []; if (!player.dead) a.push(player); (player.allies || []).forEach(function (x) { if (x && !x._downed && (x.curHp || 0) > 0) a.push(x); }); return a; };
  var hurt = function (t, dmg, opts) {
    if (!t || (t === player ? player.dead || player.hp <= 0 : t._downed || t.curHp <= 0)) return false;
    dmg = Math.max(0, Math.floor(dmg));
    var R = window.AFK_RELIC_RUNTIME;
    var context = Object.assign({ kind: 'dot', dotKind: 'healing-reversal', origin: 'healing-reversal', direct: false, main: false }, opts || {});
    if (R) dmg = R.incoming(t, dmg, context.attacker || null, context);
    if (t === player) player.hp -= dmg; else t.curHp -= dmg;
    if (R) R.afterIncoming(t, dmg, context.attacker || null, context);
    if (t === player) { if (player.hp <= 0 && typeof killPlayer === 'function') { killPlayer(); return true; } }
    else if (t.curHp <= 0) { t.curHp = 0; t._downed = true; t._reviveCd = 150; }
    return false;
  };
  if (typeof window.foulWaterHealMult === 'function') {
    var oFw = window.foulWaterHealMult;
    window.foulWaterHealMult = function (t) { var m = oFw.apply(this, arguments); return has(t, 'half') ? m * 0.5 : m; };
  }
  if (typeof window.rollHealingSpell === 'function') {
    var oRoll = window.rollHealingSpell;
    window.rollHealingSpell = function (sk, dStats, caster, target) {
      var v = oRoll.apply(this, arguments);
      if (v > 0 && has(target, 'heal')) { hurt(target, v); try { if (!S().ff) logCombat('<span class="text-red-400 font-bold">【死亡治療】</span>治癒魔法反噬，造成 ' + Math.floor(v) + ' 點傷害！', 'enemy'); } catch (e) {} return 0; }
      return v;
    };
  }
  var HEAL_POT = function (id) { return !!id && (id.indexOf('potion_heal') >= 0 || id === 'potion_strong' || id === 'potion_ult' || id === 'new_item_141'); };
  var oUse = window.useItem;
  window.useItem = function (u) {
    var it = has(player, 'pot') ? player.inv.find(function (i) { return i.uid === u; }) : null;
    if (!it || !HEAL_POT(it.id)) return oUse.apply(this, arguments);
    var h0 = player.hp, r = oUse.apply(this, arguments), gain = player.hp - h0;
    if (gain > 0) { player.hp = h0; hurt(player, gain); try { if (!S().ff) logCombat('<span class="text-red-400 font-bold">【死亡藥水】</span>藥水變成了毒藥，你受到 ' + Math.floor(gain) + ' 點傷害！', 'enemy'); } catch (e) {} }
    return r;
  };
  if (typeof window.allyTryPotion === 'function') {
    var oAp = window.allyTryPotion;
    window.allyTryPotion = function (ally) {
      if (!has(ally, 'pot')) return oAp.apply(this, arguments);
      var h0 = ally.curHp, r = oAp.apply(this, arguments), gain = (ally.curHp || 0) - h0;
      if (gain > 0) { ally.curHp = h0; hurt(ally, gain); }
      return r;
    };
  }

  // ── 每秒：房間屬性傷害；每 20 秒：王施放治療減益 ──
  var effRes = function (t, ele) { if (window.__afkEleMult) return window.__afkEleMult(t.d || {}, ele, false); var d = t.d || {}, v = d[ELE_RES[ele]] || 0, pct = (typeof effResistPct === 'function') ? effResistPct(v) : v; return Math.max(0, Math.min(1, 1 - pct / 100)); };
  var lastDeb = 0;
  // ── 四大龍副本（含侵蝕安塔瑞斯）共通：房間傷害、龍的反射／回血／鎖血／吸取（玩家 2026-10-21 指定）──
  var inAny = function () { try { return !!(S().antharas && typeof ANTHARAS_AREA_BOSS !== 'undefined' && ANTHARAS_AREA_BOSS[mapState.current]); } catch (e) { return false; } };
  var dragonEle = function () { var k = cur(); return k ? DRAGONS[k].ele : 'earth'; };
  var dlog = function (h) { try { if (!S().ff) logCombat(h, 'enemy'); } catch (e) {} };
  var drain = function (m) {
    team().forEach(function (x) {
      if (x === player) { player.hp = Math.max(1, player.hp - Math.floor((player.mhp || 0) * 0.2)); player.mp = Math.max(0, player.mp - Math.floor((player.mmp || 0) * 0.8)); }
      else { x.curHp = Math.max(1, (x.curHp || 0) - Math.floor((x.mhp || 0) * 0.2)); x.mp = Math.max(0, (x.mp || 0) - Math.floor((x.mmp || 0) * 0.8)); }
    });
    dlog('<span class="font-bold" style="color:#c084fc">【龍魂吸取】</span>' + m.n + ' 倒下前吸走了全隊 20% 的 HP 與 80% 的 MP！');
  };
  var startLock = function (m) {
    if (m._afkLockUntil) return;
    m._afkLockUntil = (S().ticks || 0) + 100; m.curHp = 1;
    dlog('<span class="font-bold" style="color:#f87171">【不滅龍心】</span>' + m.n + ' 承受了致命一擊，以 1 點 HP 硬撐 10 秒！');
  };
  var dragonTick = function () {
    var t = S().ticks || 0;
    (mapState.mobs || []).forEach(function (m, idx) {
      if (!m || m._dead || !m._afkDragonStage) return;
      if (m._afkBornT == null) { m._afkBornT = t; m._afkRefAt = t; }
      if (m._afkLockUntil) {
        if (t < m._afkLockUntil) { if (!(m.curHp >= 1)) m.curHp = 1; return; }
        if (!m._afkLockDone) {
          m._afkLockDone = true; drain(m);
          if (m.transformTo && DB.mobs[m.transformTo]) doMobTransform(idx);
          else { m.curHp = 0; killMob(idx); }
        }
        return;
      }
      if (window.__afkHalted && window.__afkHalted(m)) { m._afkRefAt = t; m._afkBornT++; return; }   // 連暈停擺：不回血、不反射、不放定時技（60 秒計時也暫停）
      if (!m._afkHealed && t - m._afkBornT >= 600 && m.curHp > 0 && m.curHp < m.hp) {
        m._afkHealed = true; m.curHp = m.hp;
        dlog('<span class="font-bold" style="color:#4ade80">【龍之再生】</span>60 秒內沒能擊倒 ' + m.n + '，牠的 HP 回滿了！');
      }
      if (t - m._afkRefAt >= 50) {
        m._afkRefAt = t;
        var kind = Math.random() < 0.5 ? 'phys' : 'magic';
        m._reflectWall = { kind: kind, until: t + 20 };
        dlog('<span class="font-bold" style="color:#fb7185">【龍鱗反射】</span>' + m.n + ' 張開了' + (kind === 'phys' ? '物理' : '魔法') + '反射（2 秒）！');
      }
    });
  };
  if (typeof window.doMobTransform === 'function') {
    var oTrans = window.doMobTransform;
    window.doMobTransform = function (idx) {
      var m = mapState.mobs[idx];
      if (m && m._afkDragonStage && !m._afkLockDone && inAny()) { startLock(m); return; }
      return oTrans.apply(this, arguments);
    };
  }
  var oKillD = window.killMob;
  window.killMob = function (idx) {
    var m = mapState.mobs[idx];
    if (m && !m._dead && m._afkDragonStage && !m._afkLockDone && inAny()) { if (m.transformTo) { startLock(m); m.curHp = 1; return; } startLock(m); m.curHp = 1; return; }
    return oKillD.apply(this, arguments);
  };
  var pulse = function () {
    if (inAny() && !player.dead) {
      var t0 = S().ticks || 0;
      try { dragonTick(); } catch (e) {}
      if (t0 % 10 === 0) {
        var ele = dragonEle(), died0 = false;
        team().forEach(function (x) { if (!died0) died0 = hurt(x, 500 + 500 * effRes(x, ele), { dotKind: 'environment', origin: 'dragon-aura', element: ele }); });   // 500 真實傷害＋500 屬性傷害（吃屬性抗性），仍先經護盾與免死判定
        if (died0) return;
      }
    }
    if (!inMap() || player.dead) return;
    var s = S(), t = s.ticks || 0, key = cur(), C = DRAGONS[key];
    var boss = mapState.mobs.some(function (m) { return m && m.boss && !m._dead && m.curHp > 0 && !(window.__afkHalted && window.__afkHalted(m)); });
    if (boss && t - lastDeb >= 200) {
      lastDeb = t;
      var pick = DEB[Math.floor(Math.random() * DEB.length)];
      team().forEach(function (x) { var d = debuff.get(x) || {}; d[pick[0]] = t + 100; debuff.set(x, d); });
      try { if (!s.ff) logCombat('<span class="font-bold" style="color:' + C.color + '">【' + pick[1] + '】</span>' + C.pre + '之龍的詛咒籠罩全隊：' + pick[2] + '（10 秒）！', 'enemy'); } catch (e) {}
    }
    if (!boss) lastDeb = t - 100;   // 王一出現 10 秒後施放第一次
  };
  var oTick = window.tick;
  window.tick = function () { var t0 = S().ticks; try { return oTick.apply(this, arguments); } finally { if (S().ticks !== t0) { try { pulse(); } catch (e) {} } } };   // 暫停／倒地時 tick 不前進就不跑

  // ── 畫面：侵蝕光暈 ──
  try { var st = document.createElement('style'); st.textContent = '.mob-target[data-afk-corrupt] .mob-img-inner img{filter:drop-shadow(0 0 6px #7e22ce) drop-shadow(0 0 2px #a855f7) saturate(.8)}'; document.head.appendChild(st); } catch (e) {}
  if (typeof window._renderMobsImpl === 'function') {
    var oR = window._renderMobsImpl;
    window._renderMobsImpl = function () {
      var r = oR.apply(this, arguments);
      try { (mapState.mobs || []).forEach(function (m) { if (!m || !(m.afkCorrupt || /^(被?侵蝕|破滅|深淵|災厄)的/.test(m.n || ''))) return; var el = document.querySelector('.mob-target[data-uid="' + m.uid + '"]'); if (el) el.setAttribute('data-afk-corrupt', '1'); }); } catch (e) {}
      return r;
    };
  }

  // ── NPC 多魯嘉貝爾：三座新副本的入口 ──
  if (typeof window.renderDorugaBell === 'function') {
    var oNpc = window.renderDorugaBell;
    window.renderDorugaBell = function (div) {
      var r = oNpc.apply(this, arguments);
      try {
        var html = '<div class="border-t border-slate-700 pt-2 mt-2 space-y-2"><div class="font-bold text-fuchsia-300">其他龍之巢穴</div>'
          + '<div class="text-xs text-slate-400">每座副本每日可通關一次；巢穴每秒造成 500 真實傷害與 500 龍屬性傷害（屬性部分可用抗性減免），頭目每 20 秒隨機施放死亡藥水、死亡治療或減少治療。</div>';
        Object.keys(DRAGONS).forEach(function (key) {
          var C = DRAGONS[key], used = withCtx(key, function () { return antharasPartyUsedToday(); });
          html += '<button onclick="afkCorruptEnter(\'' + key + '\')" ' + (used.length ? 'disabled ' : '') + 'class="btn w-full font-bold py-2 rounded ' + (used.length ? 'bg-slate-700 border-slate-600 opacity-60 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 border-slate-500') + '" style="color:' + C.color + '">'
            + (used.length ? '今日已通關：' + C.pre + '的' + C.dragon + '巢穴（' + used.map(function (x) { return x.name; }).join('、') + '）' : '🐉 進入' + C.pre + '的' + C.dragon + '巢穴（' + ELE_N[C.ele] + '屬性）') + '</button>';
        });
        html += '</div>';
        var box = div.querySelector('.text-sm.space-y-3') || div;
        box.insertAdjacentHTML('beforeend', html);
      } catch (e) {}
      return r;
    };
  }

  // ── 萊利的輔佐官：四龍材料都能換積分；積分抽遺物／換昇華支配強化石／抽昇華支配遺物；夢艷地獄中傳家之寶必帶遠古系詞條 ──
  try {
    if (typeof ANT_POINT_VALUES !== 'undefined') {
      Object.keys(ANT_POINT_VALUES).slice().forEach(function (id) {
        var m = /^mat_antharas_(\w+)$/.exec(id); if (!m) return;
        Object.keys(DRAGONS).forEach(function (key) { var nid = 'mat_' + key + '_' + m[1]; if (DB.items[nid] && !ANT_POINT_VALUES[nid]) ANT_POINT_VALUES[nid] = ANT_POINT_VALUES[id]; });
      });
    }
  } catch (e) {}
  var ptsSet = function (v) { _lzSet(_antPointsKey(), String(Math.max(0, Math.floor(v)))); };
  var rileyRefresh = function () { try { saveGame(); updateUI(); renderTabs(true); } catch (e) {} var c = document.getElementById('interaction-content'); if (c && typeof renderRileyAide === 'function') renderRileyAide(c); };
  var dreamOnR = function () { return !!(player && player.sherineDream && player.sherineMad); };
  var ANC = [true, 'eternal', 'immortal', 'primordial'];
  var withAnc = function (fn) {   // 夢艷地獄：這次拿到的裝備強制帶遠古系詞條
    if (!dreamOnR()) return fn();
    var before = {}; player.inv.forEach(function (i) { before[i.uid] = i.cnt || 1; });
    var r = fn();
    try {
      player.inv.slice().forEach(function (it) {
        var d = DB.items[it.id]; if (!d || (d.type !== 'wpn' && d.type !== 'arm' && d.type !== 'acc') || d.isArrow) return;
        var was = before[it.uid] || 0, now = it.cnt || 1; if (now <= was || it.anc) return;
        var anc = ANC[Math.floor(Math.random() * ANC.length)];
        if (was === 0 && now === 1) { it.anc = anc; return; }
        it.cnt = was; var nu = Object.assign({}, it, { uid: uid(), cnt: now - was, anc: anc }); player.inv.push(nu);
      });
    } catch (e) {}
    return r;
  };
  if (typeof window.antHeirloomOpen === 'function') {
    var oHeir = window.antHeirloomOpen;
    window.antHeirloomOpen = function () { var self = this, args = arguments; return withAnc(function () { return oHeir.apply(self, args); }); };
  }
  window.afkRileyBuy = function (kind, arg) {
    var pts = antPointsGet();
    var cost = { relic: 1000, stone: 500, asc: 5000 }[kind];
    if (!cost) return;
    if (pts < cost) { logSys('<span class="text-red-400">積分不足（需要 ' + cost + ' 分）。</span>'); return; }
    var got = null;
    withAnc(function () {
      if (kind === 'relic') {
        var pool = (typeof allRelicIds === 'function') ? allRelicIds() : []; if (!pool.length) return;
        got = pool[Math.floor(Math.random() * pool.length)]; gainItem(got, 1, true);
      } else if (kind === 'stone') {
        got = { wpn: 'afk_asc_stone_wpn', arm: 'afk_asc_stone_arm', acc: 'afk_asc_stone_acc' }[arg]; if (!got || !DB.items[got]) { got = null; return; } gainItem(got, 1, true, true);
      } else if (kind === 'asc') {
        got = (window.__afkDreamStar && window.__afkDreamStar.randomAscRelic) ? window.__afkDreamStar.randomAscRelic() : null;
        if (got) gainItem(got, 1, true, true);
      }
    });
    if (!got) { logSys('<span class="text-red-400">兌換失敗，積分沒有扣除。</span>'); return; }
    ptsSet(pts - cost);
    logSys('<span class="text-yellow-300 font-bold">📦 萊利的輔佐官：</span>花費 ' + cost + ' 積分，獲得 <span class="text-amber-200">' + ((DB.items[got] || {}).n || got) + '</span>！');
    rileyRefresh();
  };
  if (typeof window.renderRileyAide === 'function') {
    var oRiley = window.renderRileyAide;
    window.renderRileyAide = function (div) {
      var r = oRiley.apply(this, arguments);
      try {
        var pts = antPointsGet();
        var b = function (on, label, js) { return '<button onclick="' + js + '" ' + (on ? '' : 'disabled') + ' class="btn font-bold py-2 rounded ' + (on ? 'bg-amber-800 hover:bg-amber-700 border-amber-500' : 'bg-slate-700 border-slate-600 opacity-60') + '">' + label + '</button>'; };
        var box = document.createElement('div');
        box.className = 'text-sm space-y-2 mt-3 border-t border-slate-700 pt-3';
        box.innerHTML = '<div class="text-amber-300 font-bold">積分兌換</div>'
          + '<div class="grid grid-cols-1 gap-2">'
          + b(pts >= 1000, '🏺 1,000 積分：抽一件遺物', "afkRileyBuy('relic')")
          + '<div class="grid grid-cols-3 gap-2">' + b(pts >= 500, '500：強化石(武器)', "afkRileyBuy('stone','wpn')") + b(pts >= 500, '500：強化石(防具)', "afkRileyBuy('stone','arm')") + b(pts >= 500, '500：強化石(飾品)', "afkRileyBuy('stone','acc')") + '</div>'
          + b(pts >= 5000, '👑 5,000 積分：抽一件昇華支配遺物', "afkRileyBuy('asc')")
          + '</div>'
          + '<div class="text-xs text-slate-400">四大龍副本的龍材料（安塔瑞斯、法利昂、巴拉卡斯、林德拜爾）都能換積分，分數相同。'
          + (dreamOnR() ? '<span class="text-fuchsia-300">夢艷地獄中：傳家之寶與這裡換到的裝備一定帶遠古系詞條。</span>' : '在夢艷地獄中換到的裝備一定帶遠古系詞條。') + '</div>';
        (div.firstElementChild || div).appendChild(box);
      } catch (e) {}
      return r;
    };
  }

  window.__afkCorrupt = { DRAGONS: DRAGONS, areasOf: areasOf, finals: finals, cur: cur, debuff: function (t) { return debuff.get(t); }, pulse: pulse, withCtx: withCtx };
  console.log('[AFK-corrupt] 已啟用：破滅法利昂／深淵巴拉卡斯／災厄林德拜爾巢穴');
})();
