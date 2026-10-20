/* ============================================================================
 * afk-dreamstar.js — 暗夢星迴（單機版，玩家 2026-10-21 指定）
 *
 * 進入：時空裂痕入口多一顆「🌌 暗夢星迴」按鈕（同樣消耗 1 顆龜裂之核）。
 *   ‧只出頭目，一次一隻（中央格），打倒後才出下一隻
 *   ‧頭目一律顯示為「裂縫夢境者投影」，外觀隨機抽一隻頭目
 *   ‧頭目套用瘋狂席琳夢艷地獄的頭目狀態（不需要另外開夢艷地獄）
 *   ‧單機版不吃夢艷地獄的掉落倍率；不記時空裂痕排名、不給裂痕停留獎勵
 *
 * 頭目時間軸（以該頭目出生時起算）
 *   每 15 秒  魔法相消術：隨機一名角色（你或傭兵）的增益全部被驅散
 *   每 30 秒  衝擊之暈：隨機一名角色暈眩（受魔防影響）
 *   每 30 秒  聖結界（自己）：10 秒內免疫一切直接傷害與持續傷害；你或傭兵施放「魔法相消術」可立即打破
 *   每 45 秒  血壁空間：3 秒內隨機反射 近距離／遠距離／魔法 傷害
 *   每 1 分   堅固防禦：15 秒傷害減免提升
 *   每 3 分   幻術・全幻覺：30 秒內頭目傷害 ×1.5
 *   每 5 分   鏡反射：10 秒內反射魔法傷害
 *   每 6 分   疼痛歡愉：10 秒內反射物理傷害
 *   7 分起    四屬性風暴：每秒對全隊每人造成 地／水／火／風 各 100（共 400）傷害
 *   10 分     四大究極魔法：連續 4 發，每發造成每人最大 HP 20% 傷害
 *   15 分     自爆：全隊死亡
 *
 * 掉落（固定機率，不受任何倍率影響；頭目原本的掉落、金幣、經驗全部沒有）
 *   ‧50%   隨機一個昇華支配材料（夢艷結晶／地獄精華／四屬性滅魔蔑視水晶／至暗星塵，少數機率境滅亡域鑰匙）
 *   ‧1%    隨機一件「+0 ○○昇華支配」遺物
 *   ‧0.1%  夢域塵
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
    sys('<span class="font-bold" style="color:#c084fc;">🌌 時空的夢境裂開了——' + NAME + '（' + base.n + ' 的投影）降臨！</span>');
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
      if (t.curHp <= 0) { t.curHp = 0; t._downed = true; t._reviveCd = 150; log('<span class="text-amber-400 font-bold">協力傭兵 ' + t._allyName + ' 被' + why + '擊倒了！</span>'); }
    }
    return false;
  };
  var dispel = function (m, t) {
    if (t === player) { try { applyMobMagic(m, { type: 'dispel', skn: '魔法相消術' }); } catch (e) {} return; }
    var kept = {};
    for (var k in (t.buffs || {})) { var d = DB.skills[k]; if (k === 'poly' || (d && d.summon)) kept[k] = t.buffs[k]; }
    t.buffs = kept;
    log('<span class="text-fuchsia-300">' + NAME + '</span> 施放魔法相消術，驅散了 ' + nameOf(t) + ' 身上的增益狀態！');
  };
  var stun = function (m, t) {
    var sk = { type: 'stun', pbase: 250, skn: '衝擊之暈' };
    try { if (t === player) applyMobMagic(m, sk); else applyMobMagicToAlly(m, sk, t); } catch (e) {}
  };

  // ── 聖結界：免疫直接傷害（包 reflectWallOnDamage，所有直擊點都會經過）與持續傷害（包 __afkDotCap）──
  var holy = function (m) { return !!(m && m._dsHolyUntil && (S().ticks || 0) <= m._dsHolyUntil); };
  var oRW = window.reflectWallOnDamage;
  if (typeof oRW === 'function') {
    window.reflectWallOnDamage = function (mob, dmg) {
      if (holy(mob) && dmg > 0 && !mob._dead) {
        mob.curHp = Math.min(mob.hp, mob.curHp + dmg);
        var now = Date.now();
        if (!mob._dsHolyLog || now - mob._dsHolyLog >= 1000) { mob._dsHolyLog = now; log(tag('聖結界', '#fde68a') + NAME + ' 的聖結界擋下了所有傷害！（需要魔法相消術打破）'); }
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
      log(tag('魔法相消術', '#86efac') + '聖結界被打破了！' + NAME + ' 再次可以受到傷害。');
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
      if (m._dsIllu && t > m._dsIllu) { m._dsIllu = 0; m.rageDmgMult = m._dsRage; log(NAME + ' 的全幻覺消散了。'); }
      if (every(age, 15)) dispel(m, pick());
      if (every(age, 30)) {
        stun(m, pick());
        m._dsHolyUntil = t + 10 * SEC;
        log(tag('聖結界', '#fde68a') + NAME + ' 張開了聖結界，10 秒內免疫一切傷害！（魔法相消術可打破）');
      }
      if (every(age, 45)) {
        var k = ['melee', 'ranged', 'magic'][Math.floor(Math.random() * 3)];
        m._reflectWall = { kind: k, until: t + 3 * SEC };
        log(tag('血壁空間', '#f87171') + NAME + ' 3 秒內反射' + { melee: '近距離', ranged: '遠距離', magic: '魔法' }[k] + '傷害！');
      }
      if (every(age, 60)) { try { applyMobMagic(m, { type: 'self_buff', buffKind: 'guard', skn: '堅固防禦', drBase: 10, dr50: 12, drStep: 2 }); } catch (e) {} }
      if (every(age, 180)) { m._dsIllu = t + 30 * SEC; m.rageDmgMult = m._dsRage * 1.5; log(tag('幻術・全幻覺', '#a78bfa') + NAME + ' 化身全幻覺，30 秒內傷害 ×1.5！'); }
      if (every(age, 300)) { m._reflectWall = { kind: 'magic', until: t + 10 * SEC }; log(tag('鏡反射', '#93c5fd') + NAME + ' 10 秒內反射魔法傷害！'); }
      if (every(age, 360)) { m._reflectWall = { kind: 'phys', until: t + 10 * SEC }; log(tag('疼痛歡愉', '#fca5a5') + NAME + ' 10 秒內反射物理傷害！'); }
      if (age >= 420 * SEC && age % SEC === 0) {
        var dead = false;
        members().forEach(function (x) { if (!dead) dead = hurt(x, 400, '四屬性風暴'); });
        if (age % (10 * SEC) === 0) log(tag('四屬性風暴', '#fb923c') + '地、水、火、風四道洪流不斷沖刷全隊（每秒每人 400 傷害）！');
        if (dead) return;
      }
      if (age >= 600 * SEC && age <= 603 * SEC && age % SEC === 0) {
        var nm = ['隕石流星', '冰雪颶風', '雷霆風暴', '大地屏障崩裂'][(age - 600 * SEC) / SEC];
        log(tag('究極魔法・' + nm, '#f472b6') + NAME + ' 施放究極魔法！全隊受到最大 HP 20% 的傷害！');
        var dd = false;
        members().forEach(function (x) { if (!dd) dd = hurt(x, (x.mhp || x.hp || x.curHp || 1) * 0.2, '究極魔法'); });
        if (dd) return;
      }
      if (age >= 900 * SEC) {
        sys('<span class="text-red-500 font-bold">💥 ' + NAME + ' 自爆了！夢境崩塌，全隊無一倖存……</span>');
        (player.allies || []).forEach(function (x) { if (x && !x._downed) { x.curHp = 0; x._downed = true; x._reviveCd = 150; } });
        m.curHp = 0; m._dsBlast = true;
        player.hp = 0; if (typeof killPlayer === 'function') killPlayer();
        return;
      }
    }
  };
  var oTick = window.tick;
  window.tick = function () {
    try { return oTick.apply(this, arguments); }
    finally { try { timeline(); } catch (e) { console.warn('[AFK-dreamstar] timeline', e); } }
  };

  // ── 擊殺：只給固定掉落 ──
  var MATS = [['afk_dream_crystal', 30], ['afk_hell_essence', 20], ['afk_contempt_earth', 10], ['afk_contempt_water', 10], ['afk_contempt_wind', 10], ['afk_contempt_fire', 10], ['afk_dark_stardust', 8], ['afk_abyss_key', 2]];
  var pickW = function (arr) { var tot = 0; arr.forEach(function (x) { tot += x[1]; }); var r = Math.random() * tot; for (var i = 0; i < arr.length; i++) { r -= arr[i][1]; if (r < 0) return arr[i][0]; } return arr[arr.length - 1][0]; };
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
        if (Math.random() < 0.5) { var mat = pickW(MATS); if (DB.items[mat]) { gainItem(mat, 1); got.push(DB.items[mat].n); } }
        if (Math.random() < 0.01) { var rid = randomAscRelic(); if (rid) { gainItem(rid, 1); got.push((typeof getItemFullName === 'function' ? getItemFullName({ id: rid }) : DB.items[rid].n)); } }
        if (Math.random() < 0.001 && DB.items.afk_dream_dust) { gainItem('afk_dream_dust', 1); got.push(DB.items.afk_dream_dust.n); }
        sys('<span class="font-bold" style="color:#c084fc;">🌌 ' + NAME + ' 消散了。</span>' + (got.length ? '<span class="text-fuchsia-200">獲得：' + got.join('、') + '</span>' : '<span class="text-slate-400">這次什麼也沒留下。</span>'));
      } finally { try { _lootMobInfo = info; } catch (e) {} }
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
    if (ds) { player.riftRewardMs = keep; S().dreamStar = false; sys('<span class="text-fuchsia-300">🌌 你離開了暗夢星迴。</span>'); }
    return r;
  };

  // ── 入口 ──
  window.enterDreamStar = function () {
    if ((player.lv || 1) < 40) { sys('<span class="text-red-400">等級未達 40，無法進入暗夢星迴。</span>'); return; }
    S().dreamStar = true;
    try { window.enterRift(); } finally { if (!S().riftRun) S().dreamStar = false; }
    if (S().dreamStar) sys('<span class="font-bold" style="color:#c084fc;">🌌 你潛入了暗夢星迴……只有夢境者的投影在等著你。（15 分鐘內必須擊倒，否則它會自爆）</span>');
  };
  if (typeof window.renderRiftEntrance === 'function') {
    var oEnt = window.renderRiftEntrance;
    window.renderRiftEntrance = function (container) {
      var r = oEnt.apply(this, arguments);
      try {
        var box = container && container.querySelector('button[onclick="enterRift()"]');
        if (box && !container.querySelector('#afk-ds-btn')) {
          box.insertAdjacentHTML('afterend',
            '<button id="afk-ds-btn" onclick="enterDreamStar()" class="btn w-full py-4 text-xl font-bold bg-fuchsia-950 hover:bg-fuchsia-900 border border-fuchsia-500 text-white shadow-lg">🌌 進入暗夢星迴（單機）</button>'
            + '<div class="text-xs text-fuchsia-200 leading-relaxed bg-slate-950/70 border border-fuchsia-800/60 rounded p-2">消耗 1 顆龜裂之核。只出現「裂縫夢境者投影」頭目，一次一隻；會相消、暈眩、聖結界（要用魔法相消術打破）、血壁空間、鏡反射、疼痛歡愉，7 分起四屬性風暴、10 分四大究極魔法、15 分自爆。'
            + '掉落：50% 昇華支配材料、1% 昇華支配遺物、0.1% 夢域塵。不記排名、不給裂痕獎勵。</div>');
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
          var el = document.querySelector('.mob-target[data-uid="' + m.uid + '"] .mob-name > span');
          if (!el) return;
          el.textContent = m._dsName + (holy(m) ? '【聖結界】' : '');
          el.title = m._dsName + '（' + m.n + ' 的投影）';
        });
      } catch (e) {}
      return r;
    };
  }

  window.__afkDreamStar = { on: on, pool: pool, randomAscRelic: randomAscRelic, timeline: timeline, NAME: NAME };
  console.log('[AFK-dreamstar] 已啟用：暗夢星迴（單機版）');
})();
