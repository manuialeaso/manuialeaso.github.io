/* ============================================================================
 * afk-dreamstar.js — 暗夢星迴（單機版，玩家 2026-10-21 指定）
 *
 * 進入：時空裂痕入口多一組「🌌 暗夢星迴」按鈕。
 *   ‧單人模式：消耗 1000 顆龜裂之核
 *   ‧多人模式：消耗 1 把境滅亡域鑰匙（連線功能尚未製作，按鈕先標示製作中）
 *   ‧只出一隻頭目（中央格），打倒就結束、回到時空裂痕入口（同四龍副本）；名字上方標示「裂縫夢境者投影」，外觀與名稱沿用抽到的那隻頭目
 *   ‧頭目套用瘋狂席琳夢艷地獄的頭目狀態（不需要另外開夢艷地獄）；單機版不吃夢艷地獄的掉落倍率
 *   ‧不記時空裂痕排名、不給裂痕停留獎勵
 *
 * 頭目時間軸（以該頭目出生時起算）
 *   每 15 秒  魔法相消術：隨機一名角色（你或傭兵）的增益全部被驅散
 *   每 30 秒  衝擊之暈：隨機一名角色暈眩（受魔防影響）
 *   每 30 秒  聖結界（自己）：免疫一切直接傷害與持續傷害，一直持續到被魔法相消術打破
 *             （你或傭兵施放魔法相消術；或身上有相消術卷軸時自動使用 1 張）
 *   每 45 秒  血壁空間：3 秒內隨機反射 近距離／遠距離／魔法 傷害
 *   每 1 分   堅固防禦：15 秒傷害減免提升
 *   第 3 分   幻術・全幻覺：30 秒內頭目傷害 ×1.5（只放這一次）
 *   第 5 分   鏡反射：10 秒內反射魔法傷害（只放這一次）
 *   第 6 分   疼痛歡愉：10 秒內反射物理傷害（只放這一次）
 *   7 分起    四屬性風暴：每秒對全隊每人造成 地／水／火／風 各 100 傷害，各自吃對應屬性抗性
 *   10 分     四大究極魔法：連續 4 發（火／水／風／地），每發最大 HP 20%、吃對應屬性抗性，但每發至少最大 HP 10%
 *   15 分     自爆：全隊死亡
 *
 * 掉落（固定機率，不受任何倍率影響；頭目原本的掉落、金幣、經驗全部沒有）
 *   ‧100%  六種時空材料其中一種：滅魔蔑視水晶(地/水/風/火)(時空)、暗星塵(時空)、夢域塵(時空)
 *   ‧100%  龍之鑽石 5000
 *   ‧50%   三個隨機昇華支配材料
 *   ‧0.01% 鑽白金幻化（可自選任一隻怪的鑽石卡）
 *   集齊六種時空材料＋Lv100：時空裂痕入口可進入「時空裂痕-冥王域」＝輪迴轉生（等級回 1、回到說話之島）
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('dreamstar')) return;
  if (typeof DB === 'undefined' || typeof window.spawnRiftMob !== 'function' || typeof window.enterRift !== 'function' || typeof window.killMob !== 'function') {
    console.warn('[AFK-dreamstar] 找不到時空裂痕函式，略過'); return;
  }

  var NAME = '裂縫夢境者投影';
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var on = function () { var s = S(); return !!(s.dreamStar && s.riftRun); };
  var log = function (h) { try { if (!S().ff && typeof logCombat === 'function') logCombat(h, 'enemy'); } catch (e) {} };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var tag = function (t, c) { return '<span class="font-bold" style="color:' + (c || '#c084fc') + ';">【' + t + '】</span>'; };

  // ── 頭目池：所有頭目（排除攻城／血盟／建築／卡瑞／變身中後段）──
  var bossPool = null;
  var pool = function () {
    if (bossPool) return bossPool;
    var stages = {};
    Object.keys(DB.mobs).forEach(function (k) { var t = DB.mobs[k] && DB.mobs[k].transformTo; if (t) stages[t] = 1; });
    bossPool = Object.keys(DB.mobs).filter(function (id) {
      var m = DB.mobs[id];
      return m && m.boss && typeof m.lv === 'number' && !m.siegeEnemy && !m.pledgeEnemy && m.race !== '建築' && id !== 'kari' && !stages[id] && !m.trollPlayer;
    });
    return bossPool;
  };

  // ── 出怪：只在中央格、場上沒有活著的怪時才出一隻頭目 ──
  var oSpawn = window.spawnRiftMob;
  window.spawnRiftMob = function (idx) {
    if (!on()) return oSpawn.apply(this, arguments);
    if (idx !== 1) return;
    if (mapState.mobs.some(function (m) { return m && !m._dead && m.curHp > 0; })) return;
    var ids = pool(); if (!ids.length) return;
    var id = ids[Math.floor(Math.random() * ids.length)], base = DB.mobs[id];
    var m = { ...base, curHp: base.hp, uid: uid(), _born: ++_mobBornSeq, _magCd: {}, justHit: false, st: newMobStatus() };
    mapState.mobs[idx] = m;
    var keep = { w: player.sherineWorld, mad: player.sherineMad, dream: player.sherineDream };
    try {
      player.sherineMad = true; player.sherineDream = true;
      applySherineBuff(idx);
      if (window.__afkDreamHell && !m._dream) window.__afkDreamHell.applyDream(m);
    } finally { player.sherineWorld = keep.w; player.sherineMad = keep.mad; player.sherineDream = keep.dream; }
    if (m.hard && typeof initHardSkin === 'function') initHardSkin(m);
    m._dreamStar = true; m._dsName = NAME; m._dsBorn = S().ticks || 0; m._dsRage = m.rageDmgMult || 1;
    m.exp = 0; m.goldMin = 0; m.goldMax = 0; m.noGold = true;
    sys('<span class="font-bold" style="color:#c084fc;">夢境的裂縫無聲張開，' + NAME + '——' + base.n + '的投影——自星屑中走出。</span>');
    if (typeof vfxBossEntrance === 'function') { try { vfxBossEntrance(m); } catch (e) {} }
    if (!S().ff) { try { renderMobs(); } catch (e) {} }
  };

  // ── 角色清單：你＋存活傭兵 ──
  var members = function () {
    var a = [];
    if (!player.dead) a.push(player);
    (player.allies || []).forEach(function (x) { if (x && !x._downed && (x.curHp || 0) > 0) a.push(x); });
    return a;
  };
  var nameOf = function (t) { return t === player ? '你' : '協力·' + (t._allyName || '傭兵'); };
  var hurt = function (t, dmg, why) {
    dmg = Math.max(1, Math.floor(dmg));
    if (t === player) {
      player.hp -= dmg;
      if (player.hp <= 0 && typeof killPlayer === 'function') { killPlayer(); return true; }
    } else {
      t.curHp -= dmg;
      if (t.curHp <= 0) { t.curHp = 0; t._downed = true; t._reviveCd = 150; log('<span class="text-amber-400 font-bold">協力傭兵 ' + t._allyName + ' 被' + why + '擊倒。</span>'); }
    }
    return false;
  };
  var dispel = function (m, t) {
    if (t === player) { try { applyMobMagic(m, { type: 'dispel', skn: '魔法相消術' }); } catch (e) {} return; }
    var kept = {};
    for (var k in (t.buffs || {})) { var d = DB.skills[k]; if (k === 'poly' || (d && d.summon)) kept[k] = t.buffs[k]; }
    t.buffs = kept;
    log('<span class="text-fuchsia-300">' + NAME + '</span> 低誦相消之咒，' + nameOf(t) + ' 身上的祝福盡數剝落。');
  };
  var stun = function (m, t) {
    var sk = { type: 'stun', pbase: 250, skn: '衝擊之暈' };
    try { if (t === player) applyMobMagic(m, sk); else applyMobMagicToAlly(m, sk, t); } catch (e) {}
  };

  var effRes = function (t, ele) {
    if (window.__afkEleMult) return window.__afkEleMult(t.d || {}, ele, false);   // 抗性新制（afk-resist）
    var d = t.d || {}, v = { fire: d.resFire, water: d.resWater, wind: d.resWind, earth: d.resEarth }[ele] || 0;
    var pct = (typeof effResistPct === 'function') ? effResistPct(v) : v;
    return Math.max(0, Math.min(1, 1 - pct / 100));
  };
  var invCnt = function (id) { return (player.inv || []).reduce(function (s2, i) { return s2 + (i && i.id === id ? Math.max(1, Math.floor(Number(i.cnt) || 1)) : 0); }, 0); };
  var takeN = function (id, k) {
    for (var i = player.inv.length - 1; i >= 0 && k > 0; i--) {
      var it = player.inv[i]; if (!it || it.id !== id || it.lock) continue;
      var c = Math.max(1, Math.floor(Number(it.cnt) || 1)), use = Math.min(c, k);
      k -= use; if (c - use <= 0) player.inv.splice(i, 1); else it.cnt = c - use;
    }
    return k <= 0;
  };

  // ── 聖結界：免疫直接傷害（包 reflectWallOnDamage，所有直擊點都會經過）與持續傷害（包 __afkDotCap）──
  var holy = function (m) { return !!(m && m._dsHolyUntil && (S().ticks || 0) <= m._dsHolyUntil); };
  window.__afkDsHoly = holy;   // 給 afk-relic-runtime 的持續傷害上限用（它會在載入後換掉 __afkDotCap）
  var oRW = window.reflectWallOnDamage;
  if (typeof oRW === 'function') {
    window.reflectWallOnDamage = function (mob, dmg) {
      if (holy(mob) && dmg > 0 && !mob._dead) {
        mob.curHp = Math.min(mob.hp, mob.curHp + dmg);
        var now = Date.now();
        if (!mob._dsHolyLog || now - mob._dsHolyLog >= 1000) { mob._dsHolyLog = now; log(tag('聖結界', '#fde68a') + NAME + ' 的聖結界吞沒了一切攻擊。（唯有魔法相消術能破）'); }
        return;
      }
      return oRW.apply(this, arguments);
    };
  }
  var oCap = window.__afkDotCap;
  window.__afkDotCap = function (m, dmg) { if (holy(m)) return 0; return typeof oCap === 'function' ? oCap.apply(this, arguments) : dmg; };
  var holyMob = function () { return (mapState.mobs || []).filter(function (m) { return m && m._dreamStar && holy(m); })[0] || null; };
  var CANCEL_MARK = 'foulWater';   // 只有魔法相消術的解除清單含汙濁之水
  var oHas = window.teamHasCurableStatus;
  if (typeof oHas === 'function') window.teamHasCurableStatus = function (kinds) {
    if (on() && kinds && kinds.indexOf(CANCEL_MARK) >= 0 && holyMob()) return true;
    return oHas.apply(this, arguments);
  };
  var oClean = window.teamCleanseOne;
  if (typeof oClean === 'function') window.teamCleanseOne = function (kinds) {
    var hm = on() && kinds && kinds.indexOf(CANCEL_MARK) >= 0 ? holyMob() : null;
    if (hm) {
      hm._dsHolyUntil = 0;
      log(tag('魔法相消術', '#86efac') + '聖結界應聲碎裂，' + NAME + ' 再度暴露於刀鋒之下。');
      return player;
    }
    return oClean.apply(this, arguments);
  };

  // ── 時間軸：每 tick 檢查一次 ──
  var SEC = 10;
  var every = function (age, sec) { return age > 0 && age % (sec * SEC) === 0; };
  var timeline = function () {
    if (!on() || player.dead) return;
    var t = S().ticks || 0;
    for (var i = 0; i < mapState.mobs.length; i++) {
      var m = mapState.mobs[i];
      if (!m || !m._dreamStar || m._dead || m.curHp <= 0) continue;
      var age = t - (m._dsBorn || t);
      var team = members(); if (!team.length) return;
      var pick = function () { return team[Math.floor(Math.random() * team.length)]; };
      if (m._dsIllu && t > m._dsIllu) { m._dsIllu = 0; m.rageDmgMult = m._dsRage; log(NAME + ' 的幻影褪去，回歸本相。'); }
      if (every(age, 15)) dispel(m, pick());
      if (every(age, 30)) {
        stun(m, pick());
        if (!holy(m)) {
          m._dsHolyUntil = Infinity;
          log(tag('聖結界', '#fde68a') + NAME + ' 張開聖結界，刀劍與咒文皆不得近身。（唯有魔法相消術能破）');
          if (invCnt('afk_cancel_scroll') > 0 && takeN('afk_cancel_scroll', 1)) {
            m._dsHolyUntil = 0;
            log(tag('相消術卷軸', '#86efac') + '你撕開一張相消術卷軸，聖結界應聲碎裂。（剩 ' + invCnt('afk_cancel_scroll') + ' 張）');
            try { if (typeof renderTabs === 'function' && !S().ff) renderTabs(true); } catch (e) {}
          }
        }
      }
      if (every(age, 45)) {
        var k = ['melee', 'ranged', 'magic'][Math.floor(Math.random() * 3)];
        m._reflectWall = { kind: k, until: t + 3 * SEC };
        log(tag('血壁空間', '#f87171') + NAME + ' 周身血壁湧動，3 秒內' + { melee: '近距離', ranged: '遠距離', magic: '魔法' }[k] + '傷害將原路折返。');
      }
      if (every(age, 60)) { try { applyMobMagic(m, { type: 'self_buff', buffKind: 'guard', skn: '堅固防禦', drBase: 10, dr50: 12, drStep: 2 }); } catch (e) {} }
      if (age === 180 * SEC) { m._dsIllu = t + 30 * SEC; m.rageDmgMult = m._dsRage * 1.5; log(tag('幻術・全幻覺', '#a78bfa') + NAME + ' 化作千重幻影，30 秒內傷害 ×1.5。'); }
      if (age === 300 * SEC) { m._reflectWall = { kind: 'magic', until: t + 10 * SEC }; log(tag('鏡反射', '#93c5fd') + NAME + ' 立起鏡面，10 秒內咒文將映回施術者。'); }
      if (age === 360 * SEC) { m._reflectWall = { kind: 'phys', until: t + 10 * SEC }; log(tag('疼痛歡愉', '#fca5a5') + NAME + ' 沉醉於痛楚之中，10 秒內刀劍之傷將反噬其主。'); }
      if (age >= 420 * SEC && age % SEC === 0) {
        var dead = false;
        members().forEach(function (x) {
          if (dead) return;
          var dm = ['earth', 'water', 'fire', 'wind'].reduce(function (a, e) { return a + 100 * effRes(x, e); }, 0);
          if (dm >= 1) dead = hurt(x, dm, '四屬性風暴');
        });
        if (age % (10 * SEC) === 0) log(tag('四屬性風暴', '#fb923c') + '地、水、火、風四道洪流席捲全隊（每秒各 100，受屬性抗性減免）。');
        if (dead) return;
      }
      if (age >= 600 * SEC && age <= 603 * SEC && age % SEC === 0) {
        var k4 = (age - 600 * SEC) / SEC, nm = ['流星雨', '冰雪颶風', '雷霆風暴', '大地崩裂'][k4], ele = ['fire', 'water', 'wind', 'earth'][k4];
        log(tag('究極魔法・' + nm, '#f472b6') + NAME + ' 詠唱禁忌的究極魔法，全隊受到最大 HP 20% 的傷害（受屬性抗性減免，至少 10%）。');
        var dd = false;
        members().forEach(function (x) { if (dd) return; var mh = x.mhp || x.hp || x.curHp || 1; dd = hurt(x, Math.max(mh * 0.1, mh * 0.2 * effRes(x, ele)), '究極魔法'); });
        if (dd) return;
      }
      if (age >= 900 * SEC) {
        sys('<span class="text-red-500 font-bold">' + NAME + ' 的身軀化為光焰炸裂，夢境隨之崩塌——無人生還。</span>');
        (player.allies || []).forEach(function (x) { if (x && !x._downed) { x.curHp = 0; x._downed = true; x._reviveCd = 150; } });
        m.curHp = 0; m._dsBlast = true;
        player.hp = 0; if (typeof killPlayer === 'function') killPlayer();
        return;
      }
    }
  };
  var oTick = window.tick;
  window.tick = function () {
    var t0 = S().ticks;
    try { return oTick.apply(this, arguments); }
    finally { if (S().ticks !== t0) { try { timeline(); } catch (e) { console.warn('[AFK-dreamstar] timeline', e); } } }   // tick 提早返回（暫停／倒地）時不跑時間軸
  };

  // ── 擊殺：只給固定掉落 ──
  var TS = ['afk_ts_contempt_earth', 'afk_ts_contempt_water', 'afk_ts_contempt_wind', 'afk_ts_contempt_fire', 'afk_ts_dark_stardust', 'afk_ts_dream_dust'];
  var MATS = [['afk_dream_crystal', 30], ['afk_hell_essence', 20], ['afk_contempt_earth', 8], ['afk_contempt_water', 8], ['afk_contempt_wind', 8], ['afk_contempt_fire', 8], ['afk_dark_stardust', 8], ['afk_dream_dust', 4], ['afk_abyss_key', 2]];
  var pickW = function (arr) { var tot = 0; arr.forEach(function (x) { tot += x[1]; }); var r = Math.random() * tot; for (var i = 0; i < arr.length; i++) { r -= arr[i][1]; if (r < 0) return arr[i][0]; } return arr[arr.length - 1][0]; };
  var addDia = function (n) { try { if (typeof window.pandoraAdjustSharedDiamonds === 'function') return !!(window.pandoraAdjustSharedDiamonds(n) || {}).ok; } catch (e) {} return false; };
  // （舊規格的 1% 昇華支配遺物已依 2026-10-21 新規格移除；relicBases/randomAscRelic 保留給測試與日後使用）
  var relicBases = function () {
    return Object.keys(DB.items).filter(function (id) {
      var d = DB.items[id];
      return d && typeof isRelic === 'function' && isRelic(d) && !d.relicPlus && !d.isArrow && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') && ['pet', 'petwpn', 'petarm', 'doll'].indexOf(d.slot) < 0;
    });
  };
  var randomAscRelic = function () {
    var RP = window.__afkRelicPlus; if (!RP) return null;
    var bases = relicBases();
    for (var tries = 0; tries < 20 && bases.length; tries++) {
      var b = bases[Math.floor(Math.random() * bases.length)];
      var cap = 15; try { cap = enhanceCap(DB.items[b]) <= 5 ? 5 : 15; } catch (e) { cap = DB.items[b].type === 'acc' ? 5 : 15; }
      var id = RP.makeId(b, cap, null, 0);
      if (RP.ensure(id)) return id;
    }
    return null;
  };
  var oKill = window.killMob;
  window.killMob = function (idx) {
    var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null;
    if (!m || !m._dreamStar || m._dead) return oKill.apply(this, arguments);
    m._afkDreamPaid = true;                // 單機版不吃夢艷地獄的額外掉落
    var gI = window.gainItem, aC = window.acquireCard;
    window.gainItem = function () { return false; };
    if (typeof aC === 'function') window.acquireCard = function () { return false; };
    var r;
    try { r = oKill.apply(this, arguments); }
    finally { window.gainItem = gI; if (typeof aC === 'function') window.acquireCard = aC; }
    if (m._dead && !m._dsPaid && !m._dsBlast) {
      m._dsPaid = true;
      var info = (typeof _lootMobInfo !== 'undefined') ? _lootMobInfo : null;
      try { _lootMobInfo = { n: NAME, lv: m.lv, boss: true }; } catch (e) {}
      try {
        var got = [];
        var ts = TS[Math.floor(Math.random() * TS.length)];
        if (DB.items[ts]) { gainItem(ts, 1); got.push(DB.items[ts].n); }
        if (addDia(5000)) got.push('龍之鑽石 5000');
        if (Math.random() < 0.5) { for (var q = 0; q < 3; q++) { var mat = pickW(MATS); if (DB.items[mat]) { gainItem(mat, 1); got.push(DB.items[mat].n); } } }
        if (Math.random() < 0.0001 && DB.items.afk_card_pick) { gainItem('afk_card_pick', 1); got.push(DB.items.afk_card_pick.n); }
        sys('<span class="font-bold" style="color:#c084fc;">' + NAME + ' 化作星屑散去。</span>' + (got.length ? '<span class="text-fuchsia-200">它遺下了：' + got.join('、') + '</span>' : '<span class="text-slate-400">夢境什麼也沒有留下。</span>'));
      } finally { try { _lootMobInfo = info; } catch (e) {} }
      // 跟四龍副本一樣：打倒一隻頭目就結束，回到時空裂痕入口（擊殺流程跑完再走，避免在怪物迴圈中途換圖）
      setTimeout(function () {
        try {
          if (!S().dreamStar || !S().riftRun) return;
          riftEndRun(); setMapSelectors('town_rift'); changeMap(true); saveGame();
        } catch (e) { console.warn('[AFK-dreamstar] 離開', e); }
      }, 300);
    }
    return r;
  };

  // ── 離開：不記排名、不給裂痕獎勵 ──
  var oRecord = window.riftRecord;
  if (typeof oRecord === 'function') window.riftRecord = function () { if (S().dreamStar) return; return oRecord.apply(this, arguments); };
  var oEnd = window.riftEndRun;
  window.riftEndRun = function () {
    var ds = !!(S().dreamStar && S().riftRun);
    var keep = player.riftRewardMs;
    var r = oEnd.apply(this, arguments);
    if (ds) { player.riftRewardMs = keep; S().dreamStar = false; sys('<span class="text-fuchsia-300">你自夢境中醒轉，離開了暗夢星迴。</span>'); }
    return r;
  };

  // ── 入口：單人 1000 顆龜裂之核；多人要境滅亡域鑰匙（連線尚未製作）──
  var SOLO_CORES = 1000;
  window.enterDreamStar = function (mode) {
    if (mode === 'multi') { sys('<span class="text-amber-300">境滅亡域的門扉尚未開啟（多人模式製作中），目前只能獨自入夢。</span>'); return; }
    if ((player.lv || 1) < 40) { sys('<span class="text-red-400">你的力量尚淺（需 Lv40），夢境拒你於門外。</span>'); return; }
    if (player.riftRewardMs != null) { sys('<span class="text-amber-300">請先在時空裂痕入口領取獎勵，再踏入暗夢星迴。</span>'); return; }
    var have = invCnt('mat_crack_core');
    if (have < SOLO_CORES) { sys('<span class="text-red-400">入夢需要 ' + SOLO_CORES + ' 顆龜裂之核（你只有 ' + have + ' 顆）。</span>'); return; }
    var p = player, snap = p.inv.slice(), cnts = p.inv.map(function (x) { return x && x.cnt; });
    takeN('mat_crack_core', SOLO_CORES - 1);   // 剩下 1 顆由 enterRift 自己扣
    S().dreamStar = true;
    try { window.enterRift(); } finally {
      if (!S().riftRun) { S().dreamStar = false; p.inv = snap; snap.forEach(function (x, j2) { if (x) x.cnt = cnts[j2]; }); }
    }
    if (S().dreamStar) sys('<span class="font-bold" style="color:#c084fc;">' + SOLO_CORES + ' 顆龜裂之核在掌中碎裂，你沉入暗夢星迴。夢境者的投影已在等候——十五分鐘內未能擊倒，它將與夢境一同崩毀。</span>');
  };
  var hasAllTS = function () { return TS.every(function (id) { return invCnt(id) > 0; }); };
  // 冥王域＝輪迴轉生：集齊六種時空材料、Lv100 才能進入；進去後輪迴開始 → 等級回 1、回到說話之島（轉生內容見 afk-rebirth.js）
  window.enterHades = function () {
    if (!hasAllTS()) { sys('<span class="text-red-400">六種時空材料未齊，冥王域的大門紋絲不動。</span>'); return; }
    if (player.rebirth > 0) { sys('<span class="text-slate-300">你已走過一次輪迴，冥王域不再回應你的呼喚。</span>'); return; }
    if ((player.lv || 1) < 100) { sys('<span class="text-red-400">冥王域只接納 Lv100 的靈魂（你目前 Lv' + (player.lv || 1) + '）。</span>'); return; }
    if (S().riftRun) { sys('<span class="text-amber-300">你仍身在時空裂痕之中，先離開才能走向冥王域。</span>'); return; }
    var go = function () {
      player.hadesUnlocked = true;
      var r = (typeof window.doRebirth === 'function') ? window.doRebirth(true) : { ok: false, msg: '輪迴轉生未啟用。' };
      if (!r || !r.ok) { sys('<span class="text-red-400">' + ((r && r.msg) || '輪迴失敗') + '</span>'); return; }
      sys('<span class="font-bold" style="color:#fda4af;">冥王域吞沒了你半生的修為。黑暗退去時，你在說話之島的海風中重新睜開雙眼。</span>');
      try { setMapSelectors('town_talking'); changeMap(true); } catch (e) {}
      try { saveGame(); } catch (e) {}
    };
    var msg = '⚰️ 輪迴開始\n\n進入冥王域就會輪迴轉生：等級回到 1、經驗歸零，並傳送回說話之島。\n屬性、技能、裝備、背包都保留；換來屬性上限 200、裝備不限職業、所有武器可雙持、面板能力 +50。\n每個角色只能輪迴一次，確定要進入嗎？';
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '⚰️ 輪迴開始', message: msg, okText: '進入冥王域', cancelText: '取消', danger: true, onOk: go });
    else if (confirm(msg)) go();
  };
  window.unlockHades = window.enterHades;   // 舊名稱相容
  if (typeof window.renderRiftEntrance === 'function') {
    var oEnt = window.renderRiftEntrance;
    window.renderRiftEntrance = function (container) {
      var r = oEnt.apply(this, arguments);
      try {
        var box = container && container.querySelector('button[onclick="enterRift()"]');
        if (box && !container.querySelector('#afk-ds-box')) {
          var cores = invCnt('mat_crack_core'), keys = invCnt('afk_abyss_key');
          var tsHave = TS.filter(function (id) { return invCnt(id) > 0; }).length;
          box.insertAdjacentHTML('afterend',
            '<div id="afk-ds-box" class="flex flex-col gap-2">'
            + '<button id="afk-ds-btn" onclick="enterDreamStar()" class="btn w-full py-4 text-xl font-bold ' + (cores >= SOLO_CORES ? 'bg-fuchsia-950 hover:bg-fuchsia-900 border-fuchsia-500' : 'bg-slate-700 border-slate-500 opacity-70') + ' border text-white shadow-lg">🌌 暗夢星迴・單人（龜裂之核 ' + cores.toLocaleString() + '／' + SOLO_CORES + '）</button>'
            + '<button id="afk-ds-multi" onclick="enterDreamStar(\'multi\')" class="btn w-full py-2 font-bold bg-slate-800 border border-slate-600 text-slate-300">👥 暗夢星迴・多人（境滅亡域鑰匙 ' + keys + '）— 製作中</button>'
            + '<div class="text-xs text-fuchsia-200 leading-relaxed bg-slate-950/70 border border-fuchsia-800/60 rounded p-2"><div class="afk-lore">碎裂的夢境裡，強者的投影一遍又一遍重演著最後一戰。</div>只出現頭目（名字上方標示「裂縫夢境者投影」），一次一隻；會相消、暈眩、聖結界（要魔法相消術或相消術卷軸打破）、血壁空間、堅固防禦，第 3／5／6 分各放一次全幻覺／鏡反射／疼痛歡愉，7 分起四屬性風暴、10 分四大究極魔法、15 分自爆。'
            + '每隻必掉一種時空材料＋5000 龍鑽，50% 再掉三個昇華材料，0.01% 鑽白金幻化。不記排名、不給裂痕獎勵。</div>'
            + (player.rebirth > 0
              ? '<button id="afk-hades-btn" disabled class="btn w-full py-3 font-bold bg-rose-950 border border-rose-700 text-rose-200 opacity-80">⚰️ 時空裂痕-冥王域（已輪迴轉生）</button>'
              : '<button id="afk-hades-btn" onclick="enterHades()" ' + (tsHave >= 6 ? '' : 'disabled ') + 'class="btn w-full py-3 font-bold ' + (tsHave >= 6 ? 'bg-rose-900 hover:bg-rose-800 border-rose-500' : 'bg-slate-800 border-slate-600 opacity-60') + ' border text-white">⚰️ 進入時空裂痕-冥王域・輪迴轉生（時空材料 ' + tsHave + '／6 種，需 Lv100）</button>')
            + '</div>');
        }
      } catch (e) {}
      return r;
    };
  }

  // ── 顯示名稱：畫面上改成「裂縫夢境者投影」，並標示聖結界 ──
  if (typeof window._renderMobsImpl === 'function') {
    var oRender = window._renderMobsImpl;
    window._renderMobsImpl = function () {
      var r = oRender.apply(this, arguments);
      try {
        (mapState.mobs || []).forEach(function (m) {
          if (!m || !m._dsName) return;
          var nmEl = document.querySelector('.mob-target[data-uid="' + m.uid + '"] .mob-name');
          if (!nmEl) return;
          var tg = nmEl.previousElementSibling;
          if (!tg || !tg.classList.contains('afk-ds-tag')) { tg = document.createElement('div'); tg.className = 'afk-ds-tag text-[11px] font-bold text-center'; tg.style.color = '#c084fc'; nmEl.parentNode.insertBefore(tg, nmEl); }
          tg.textContent = m._dsName + (holy(m) ? '【聖結界】' : '');
        });
      } catch (e) {}
      return r;
    };
  }

  window.__afkDreamStar = { on: on, pool: pool, randomAscRelic: randomAscRelic, timeline: timeline, NAME: NAME };
  console.log('[AFK-dreamstar] 已啟用：暗夢星迴（單機版）');
})();
