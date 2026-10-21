/* ============================================================================
 * afk-corrupt.js — 三座侵蝕的龍副本：法利昂（水）、巴拉卡斯（火）、林德拜爾（風）（玩家 2026-10-21 指定）
 *
 * 照「侵蝕的安塔瑞斯巢穴」複製：同樣在威頓村 NPC 多魯嘉貝爾進入、同樣 4 區推進（入口→通道→深處→棲息地）、
 * 擊敗各區頭目自動深入、最終龍三段變身、通關回威頓村。入場限制完全相同：
 *   每個角色每天每座副本可通關 1 次（主戰與出戰傭兵都消耗；UTC+8 凌晨 12 點重置；失敗／離開不消耗）、
 *   區內禁止傳送、不能選地圖、禁止離線掛機（需核心補丁 23）。
 * 各副本的通關次數分開計算（安塔瑞斯通關不影響法利昂）。
 *
 * 額外效果（只有這三座新副本）：
 *   ‧房間效果：在副本內每秒受到該龍屬性傷害 100（吃對應屬性抗性；你與傭兵都會受到）
 *   ‧王的效果：場上有頭目時，每 20 秒對全隊施放三種治療減益之一，持續 10 秒：
 *       死亡藥水（喝治癒藥水變成扣血）、死亡治療（治癒魔法變成扣血）、減少治療（治癒效果減半）
 *
 * 掉落：比照安塔瑞斯（最終龍：一般掉落表去掉安塔瑞斯專屬材料，另加該龍的六階魔法娃娃 1%）。
 * 境滅亡域鑰匙：四座侵蝕龍副本都會掉（afk-dreamhell 的地圖清單由本檔補上）。
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
    fafurion: { dragon: '法利昂', ele: 'water', res: 'resWater', doll: 'doll_法利昂', color: '#38bdf8',
      minions: [['侵蝕的深淵水靈', '深淵水靈'], ['侵蝕的鯊魚', '鯊魚'], ['侵蝕的水元素守護者', '水元素守護者']],
      bosses: [['侵蝕的水精靈王', '水精靈王'], ['侵蝕的水靈之主', '水靈之主'], ['侵蝕的卡普', '冥法軍王海露拜']],
      skills: { breath: '寒冰噴吐', crack: '水龍漩渦', quake: '冰河衝擊' } },
    valakas: { dragon: '巴拉卡斯', ele: 'fire', res: 'resFire', doll: 'doll_巴拉卡斯', color: '#f97316',
      minions: [['侵蝕的火焰戰士', '暗黑火焰戰士'], ['侵蝕的火焰弓箭手', '暗黑火焰弓箭手'], ['侵蝕的熔岩高崙', '熔岩高崙']],
      bosses: [['侵蝕的阿西塔基奧', '火焰阿西塔基奧'], ['侵蝕的伊弗利特', '恐怖的伊弗利特'], ['侵蝕的火靈之主', '火靈之主']],
      skills: { breath: '烈焰噴吐', crack: '熔岩爆裂', quake: '火山震擊' } },
    lindvior: { dragon: '林德拜爾', ele: 'wind', res: 'resWind', doll: 'doll_林德拜爾', color: '#4ade80',
      minions: [['侵蝕的深淵風靈', '深淵風靈'], ['侵蝕的飛龍', '飛龍'], ['侵蝕的翼龍', '翼龍']],
      bosses: [['侵蝕的風精靈王', '風精靈王'], ['侵蝕的風靈之主', '風靈之主'], ['侵蝕的風之牙', '風之牙']],
      skills: { breath: '颶風噴吐', crack: '真空裂刃', quake: '龍捲衝擊' } }
  };
  var ELE_RES = { water: 'resWater', fire: 'resFire', wind: 'resWind', earth: 'resEarth' };
  var ELE_N = { water: '水', fire: '火', wind: '風', earth: '地' };

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
    var n1 = '被侵蝕的' + C.dragon, n2 = '被侵蝕的狂怒' + C.dragon, n3 = '被侵蝕的瘋狂' + C.dragon;
    mk(p + 'd3', 'ant_antharas_mad', n3, C.dragon);
    mk(p + 'd2', 'ant_antharas_fury', n2, C.dragon, { transformTo: p + 'd3', transformFxText: n2 + '陷入瘋狂', transformLogText: '陷入瘋狂，完全失去理智' });
    mk(p + 'd1', 'ant_antharas_eroded', n1, C.dragon, { transformTo: p + 'd2', transformFxText: n1 + '陷入狂怒', transformLogText: '受到黑龍之力更深的侵蝕而狂暴' });
    finals[key] = n3;
    // 地圖
    var maps = PARTS.map(function (part, i) { return 'cr_' + key + (i < 3 ? '_nest_' + (i + 1) : '_lair'); });
    areasOf[key] = maps;
    maps.forEach(function (mp, i) {
      allMaps.push(mp); keyOfMap[mp] = key;
      var nm = '侵蝕的' + C.dragon + PARTS[i];
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
      var fin = src('被侵蝕的瘋狂安塔瑞斯').filter(function (x) { return !/^mat_antharas_|^item_sealed_earth_eye$/.test(x[0]); });
      if (DB.items[C.doll]) fin.push([C.doll, 1]);
      MOB_DROPS[n3] = fin;
    }
  });
  // 動畫：借用現有怪物資料夾（共用 alias，並複製該資料夾在各動畫設定集合中的身分）
  try {
    var SETS = ['MOB_ANIM_NAMES', 'MOB_ANIM_BAKED_SHADOW', 'MOB_SHADOW_TINT', 'MOB_ANIM_BIG', 'MOB_ANIM_SMALL', 'MOB_ANIM_SPRITE_SHADOW', 'MOB_ANIM_WEAPON_FX', 'MOB_ANIM_WEAPON_FX2', 'MOB_ANIM_8DIR'];
    var OBJS = ['MOB_ANIM_SKILL_FX', 'MOB_YLIFT', 'MOB_ANIM_DEATH_FX', 'BOSS_ENTRANCE_FX'];
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
    if (S().antharas) { logSys('你已身在侵蝕的龍之巢穴之中。'); return; }
    if (typeof mercenaryRoleBattleBlocked === 'function' && mercenaryRoleBattleBlocked(areasOf[key][0])) return;
    if (player.statuses && (player.statuses.stone > 0 || player.statuses.paralyze > 0 || player.statuses.freeze > 0 || player.statuses.stun > 0 || player.statuses.sleep > 0)) {
      logSys('你目前無法行動（石化／麻痺／冰凍／暈眩），無法進入。'); return;
    }
    var used = withCtx(key, function () { return antharasPartyUsedToday(); });
    if (used.length) { logSys('<span class="text-amber-300">隊伍中的 ' + used.map(function (r) { return r.name; }).join('、') + ' 今日已通關侵蝕的' + C.dragon + '巢穴；請更換或解散已使用次數的傭兵後再進入（UTC+8 凌晨 12 點重置）。</span>'); return; }
    var s = S(); s.antharas = 1; s._antAdvance = false; s._afkDragon = key;
    logSys('<span class="font-bold" style="color:' + C.color + '">🐉 你踏入了侵蝕的' + C.dragon + '巢穴……</span><span class="text-amber-200"> 區內無法選擇地圖，也無法使用傳送術與瞬間移動卷軸；擊敗各區頭目將自動深入。巢穴裡瀰漫著' + ELE_N[C.ele] + '屬性的侵蝕之力（每秒受到屬性傷害）。</span>');
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
    return oKill.apply(this, arguments);
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
  var hurt = function (t, dmg) {
    dmg = Math.max(1, Math.floor(dmg));
    if (t === player) { player.hp -= dmg; if (player.hp <= 0 && typeof killPlayer === 'function') { killPlayer(); return true; } }
    else { t.curHp -= dmg; if (t.curHp <= 0) { t.curHp = 0; t._downed = true; t._reviveCd = 150; } }
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
  var effRes = function (t, ele) { var d = t.d || {}, v = d[ELE_RES[ele]] || 0, pct = (typeof effResistPct === 'function') ? effResistPct(v) : v; return Math.max(0, Math.min(1, 1 - pct / 100)); };
  var lastDeb = 0;
  var pulse = function () {
    if (!inMap() || player.dead) return;
    var s = S(), t = s.ticks || 0, key = cur(), C = DRAGONS[key];
    if (t % 10 === 0) {
      var died = false;
      team().forEach(function (x) { if (!died) { var dm = 100 * effRes(x, C.ele); if (dm >= 1) died = hurt(x, dm); } });
      if (died) return;
    }
    var boss = mapState.mobs.some(function (m) { return m && m.boss && !m._dead && m.curHp > 0; });
    if (boss && t - lastDeb >= 200) {
      lastDeb = t;
      var pick = DEB[Math.floor(Math.random() * DEB.length)];
      team().forEach(function (x) { var d = debuff.get(x) || {}; d[pick[0]] = t + 100; debuff.set(x, d); });
      try { if (!s.ff) logCombat('<span class="font-bold" style="color:' + C.color + '">【' + pick[1] + '】</span>侵蝕之龍的詛咒籠罩全隊：' + pick[2] + '（10 秒）！', 'enemy'); } catch (e) {}
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
      try { (mapState.mobs || []).forEach(function (m) { if (!m || !(m.afkCorrupt || /^被?侵蝕的/.test(m.n || ''))) return; var el = document.querySelector('.mob-target[data-uid="' + m.uid + '"]'); if (el) el.setAttribute('data-afk-corrupt', '1'); }); } catch (e) {}
      return r;
    };
  }

  // ── NPC 多魯嘉貝爾：三座新副本的入口 ──
  if (typeof window.renderDorugaBell === 'function') {
    var oNpc = window.renderDorugaBell;
    window.renderDorugaBell = function (div) {
      var r = oNpc.apply(this, arguments);
      try {
        var html = '<div class="border-t border-slate-700 pt-2 mt-2 space-y-2"><div class="font-bold text-fuchsia-300">其他被侵蝕的龍之巢穴</div>'
          + '<div class="text-xs text-slate-400">入場規則同安塔瑞斯（每座副本每日各一次）。巢穴內每秒受到該龍屬性傷害 100（吃屬性抗性）；頭目每 20 秒施放死亡藥水／死亡治療／減少治療其中之一。</div>';
        Object.keys(DRAGONS).forEach(function (key) {
          var C = DRAGONS[key], used = withCtx(key, function () { return antharasPartyUsedToday(); });
          html += '<button onclick="afkCorruptEnter(\'' + key + '\')" ' + (used.length ? 'disabled ' : '') + 'class="btn w-full font-bold py-2 rounded ' + (used.length ? 'bg-slate-700 border-slate-600 opacity-60 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 border-slate-500') + '" style="color:' + C.color + '">'
            + (used.length ? '今日已通關：侵蝕的' + C.dragon + '巢穴（' + used.map(function (x) { return x.name; }).join('、') + '）' : '🐉 進入侵蝕的' + C.dragon + '巢穴（' + ELE_N[C.ele] + '屬性）') + '</button>';
        });
        html += '</div>';
        var box = div.querySelector('.text-sm.space-y-3') || div;
        box.insertAdjacentHTML('beforeend', html);
      } catch (e) {}
      return r;
    };
  }

  window.__afkCorrupt = { DRAGONS: DRAGONS, areasOf: areasOf, finals: finals, cur: cur, debuff: function (t) { return debuff.get(t); }, pulse: pulse, withCtx: withCtx };
  console.log('[AFK-corrupt] 已啟用：侵蝕的法利昂／巴拉卡斯／林德拜爾巢穴');
})();
