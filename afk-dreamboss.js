/* ============================================================================
 * afk-dreamboss.js — 夢域鏡頭目強化（玩家 2026-10-30 19:09；外掛開關 dreamboss，預設開；只在席琳夢域鏡）
 *
 *   「全隊」＝你、傭兵、出戰寵物、召喚物、城堡護衛。出場傷害與流血都是「目前 HP」的百分比（不會因此倒下）。
 *   一、出場：
 *     ‧傳送控制戒指找到的王（傳送時持有戒指、下一隻必定是王的那一隻）：全隊目前 HP 30%；之後每 5 秒 10%，持續 15 秒；
 *       場上其他怪物得到 1 秒的物理＋魔法反彈（核心補丁 73：血壁 kind 'all'）。
 *     ‧副本王（軍王之室、純頭目房、四大龍巢穴、謀叛者的低語、哈汀的時空、異界祭壇、闇龍／火焰之影、時空裂痕、暗夢星迴、排名攀登）：
 *       全隊目前 HP 20%；之後每 5 秒 5%，持續 15 秒。最終決戰席琳另有自己的機制，不套用。
 *     ‧其他正常出場的王：全隊目前 HP 10%；之後每 5 秒 5%，持續 15 秒。
 *     ‧地區霸主：全隊目前 HP 5%；之後 5 秒內每秒 3%。另有 5% 機率叫出霸主群（afk-region-boss：場上 5 隻都變成霸主），
 *       這時再追加全隊目前 HP 30%。
 *     同一類出場 3 秒內只算一次（雙頭目祭壇兩位神一起出場＝一次）。
 *   二、副本王的招式（只在副本裡、王還在場時）：
 *     ‧群體衝擊之暈：每 20 秒，你與所有傭兵暈眩 2 秒（照常判定暈眩抵抗）。
 *     ‧相消術：每 30 秒，驅散你與所有傭兵的增益（保留變身、迷魅、誘捕、召喚，跟原本的集體相消一樣）。
 *     ‧疼痛的歡愉：每 20 秒對隨機一名角色（你或傭兵）施放 10 秒：那名角色打這隻王的傷害，50% 反彈給他自己（物理、魔法都算）。
 *     ‧吸魔：每 30 秒吸走你與所有傭兵最大 MP 的 5%。
 *     ‧蝕抗：每 45 秒，你與所有傭兵的五屬性抗性（火、水、風、地、無）−50，最多 −300；離開副本或王都倒下就恢復。
 *   三、副本侵蝕（玩家 2026-10-30 21:46）：夢域鏡的副本裡，你與傭兵每秒失去最大 HP 與最大 MP 的 1%；每過 1 分鐘再 +1%
 *       （0～60 秒每秒 1%、60～120 秒每秒 2%……），離開副本就停。四龍副本原本的副本傷害照舊另外算。
 *       一轉女神（還沒轉生、Lv100 第一次打席琳）也算；時空裂痕、傲慢之塔攀登不算。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'dreamboss', name: '夢域鏡頭目強化', group: '遊戲玩法', seal: true,
    desc: '席琳夢域鏡裡：頭目出場對全隊造成目前 HP 的傷害並持續流血（傳送控制戒指找到的王 30%、副本王 20%、一般 10%、地區霸主 5%）；副本王會放群體衝擊之暈、相消術、疼痛的歡愉，並吸魔、削五屬性抗性' });
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var dream = function () { var p = P(); if (!p || p.classicMode) return false; try { if (W.__afkDreamHell && W.__afkDreamHell.on) return !!W.__afkDreamHell.on(); } catch (e) {} return !!(p.sherineDream && p.sherineMad); };
  var on = function () { return (!T || T.enabled('dreamboss')) && dream(); };
  var log = function (h) { try { if (!S().ff && typeof logCombat === 'function') logCombat(h, 'enemy'); } catch (e) {} };
  var tag = function (t, c) { return '<span class="font-bold" style="color:' + c + '">【' + t + '】</span>'; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var ENTRY = {   // pct＝出場；dot＝[間隔 tick, 次數, 每次 pct]
    ring:    { pct: 0.30, dot: [50, 3, 0.10], n: '傳送控制戒指的王' },
    dungeon: { pct: 0.20, dot: [50, 3, 0.05], n: '副本王' },
    normal:  { pct: 0.10, dot: [50, 3, 0.05], n: '頭目' },
    region:  { pct: 0.05, dot: [10, 5, 0.03], n: '地區霸主' }
  };
  var SWARM = 0.05, SWARM_PCT = 0.30, ENTRY_CD = 30;
  var SK = { stun: 200, stunDur: 20, cancel: 300, pain: 200, painDur: 100, painRf: 0.5, mp: 300, mpPct: 0.05, res: 450, resStep: 50, resMax: 300 };
  var RES_KEYS = ['resFire', 'resWater', 'resWind', 'resEarth', 'resNone'];

  // ── 全隊（含寵物、召喚物、城堡護衛）──
  var everyone = function () {
    var p = P(), out = []; if (!p || p.dead) return out;
    out.push({ o: p, get: function () { return p.hp; }, set: function (v) { p.hp = v; } });
    (p.allies || []).forEach(function (a) { if (a && !a._downed && (a.curHp || 0) > 0) out.push({ o: a, get: function () { return a.curHp; }, set: function (v) { a.curHp = v; } }); });
    var hpEnt = function (x) { if (x && !x._downed && (x.hp || 0) > 0) out.push({ o: x, get: function () { return x.hp; }, set: function (v) { x.hp = v; } }); };
    try { if (typeof petsOutList === 'function') petsOutList().forEach(hpEnt); } catch (e) {}
    (p.summonsV2 || []).forEach(hpEnt);
    (p.guardsV2 || []).forEach(hpEnt);
    return out;
  };
  var chars = function () { var p = P(); if (!p || p.dead) return []; return [p].concat((p.allies || []).filter(function (a) { return a && !a._downed && (a.curHp || 0) > 0; })); };
  var pctCur = function (pct) {   // 目前 HP 的百分比，不會因此倒下
    var n = 0;
    everyone().forEach(function (e) { var cur = Number(e.get()) || 0, d = Math.floor(cur * pct); if (d >= cur) d = cur - 1; if (d > 0) { e.set(cur - d); n++; } });
    try { if (!S().ff && typeof updateUI === 'function') updateUI(); } catch (e) {}
    return n;
  };

  // ── 副本判定 ──
  var PLUGIN_DG = { afk_traitor_whisper: 1, afk_hardin_time: 1, afk_giltas_altar: 1, afk_flame_depth: 1, afk_halpas_nest: 1 };
  var inDungeon = function () {
    var key = (typeof mapState !== 'undefined' && mapState.current) || '';
    if (PLUGIN_DG[key]) return true;
    try { var C = W.AFK_CARD_COMBAT; if (C && C.inDungeon && C.inDungeon()) return true; } catch (e) {}
    return false;
  };

  // ── 傳送控制戒指的王：生怪當下 forceBoss 還在 → 標記 ──
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      var fb = !!(typeof mapState !== 'undefined' && mapState.forceBoss), before = fb && mapState.mobs ? mapState.mobs.slice() : null;
      var r = oSpawn.apply(this, arguments);
      try { if (fb) (mapState.mobs || []).forEach(function (m, i) { if (m && m !== before[i] && m.boss) m._dbRing = true; }); } catch (e) {}   // 帶隨從一起出來的王（例：西瑪 ×3）都算
      return r;
    };
  }

  // ── 出場與流血 ──
  var dots = [], lastEntry = {};
  var classify = function (m) {
    if (!m || m._afkFinal || m._afkApostle) return null;
    if (m._rbBoss) return m._rbSwarmCopy ? null : 'region';
    if (!m.boss) return null;
    if (m._dbRing) return 'ring';
    if (inDungeon()) return 'dungeon';
    return 'normal';
  };
  var entrance = function (m, kind) {
    var e = ENTRY[kind], t = tk();
    if (lastEntry[kind] != null && t - lastEntry[kind] < ENTRY_CD && t >= lastEntry[kind]) return;
    lastEntry[kind] = t;
    pctCur(e.pct);
    log(tag(e.n + '出場', '#f43f5e') + esc(m.n) + ' 的威壓席捲全場——全隊受到目前 HP ' + Math.round(e.pct * 100) + '% 的傷害，並持續流血。');
    dots.push({ left: e.dot[1], next: t + e.dot[0], iv: e.dot[0], pct: e.dot[2], map: mapState.current, n: e.n });
    if (kind === 'ring') {
      var cnt = 0;
      (mapState.mobs || []).forEach(function (o) {
        if (!o || o === m || o._dead || !(o.curHp > 0)) return;
        var w = o._reflectWall; if (w && w.block && t <= (w.until || 0)) return;   // 已經有免疫屏障的不蓋掉
        o._reflectWall = { kind: 'all', until: t + 10, afkDb: true }; cnt++;
      });
      if (cnt) log(tag('反彈', '#a78bfa') + '場上其他 ' + cnt + ' 隻怪物得到 1 秒的物理與魔法反彈。');
    }
    if (kind === 'region' && m._rbSwarm) {
      pctCur(SWARM_PCT);
      log(tag('霸主群', '#fcd34d') + '霸主們齊聲咆哮——全隊再受到目前 HP ' + Math.round(SWARM_PCT * 100) + '% 的傷害！');
    }
  };
  var tickDots = function () {
    var t = tk(), cur = mapState.current;
    for (var i = dots.length - 1; i >= 0; i--) {
      var d = dots[i];
      if (d.map !== cur) { dots.splice(i, 1); continue; }   // 換地圖就停
      if (t < d.next) continue;
      pctCur(d.pct); d.left--; d.next = t + d.iv;
      if (d.left <= 0) dots.splice(i, 1);
    }
  };

  // ── 副本王的招式 ──
  var keepBuff = function (k) { var skd = DB.skills[k]; return k === 'sk_charm' || k === 'taming' || k === 'poly' || !!(skd && skd.summon); };
  var setSt = function (who, key, n, mob) { var B = W.AFK_RELIC_DEFENSE_BRIDGE; if (B && B.setStatus) B.setStatus(who, key, n, mob); else { who.statuses = who.statuses || {}; who.statuses[key] = n; } };
  var massStun = function (m) {
    var p = P(), hit = 0;
    chars().forEach(function (c) {
      var res = false;
      try { res = c === p ? (typeof playerStatusResisted === 'function' && playerStatusResisted('stun', m)) : (typeof allyStatusResisted === 'function' && allyStatusResisted(c, 'stun', m)); } catch (e) {}
      if (!res) { setSt(c, 'stun', SK.stunDur, m); hit++; }
    });
    log(tag('群體衝擊之暈', '#f97316') + esc(m.n) + ' 重擊大地——' + hit + ' 名角色暈眩了 ' + (SK.stunDur / 10) + ' 秒。');
  };
  var cancel = function (m) {
    var p = P();
    chars().forEach(function (c) {
      if (!c.buffs) return;
      var kept = {}; for (var k in c.buffs) if (keepBuff(k)) kept[k] = c.buffs[k];
      c.buffs = kept;
      try { if (c === p) { if (typeof calcStats === 'function') calcStats(); } else if (typeof _allyLevelRecompute === 'function') _allyLevelRecompute(c); } catch (e) {}
    });
    log(tag('相消術', '#38bdf8') + esc(m.n) + ' 施放相消術，驅散了全隊的增益狀態！');
    try { if (!S().ff && typeof updateUI === 'function') updateUI(); } catch (e) {}
  };
  var nameOf = function (c) { return c === P() ? '你' : '協力·' + (c._allyName || '傭兵'); };
  var pain = function (m) {
    var cs = chars(); if (!cs.length) return;
    var c = cs[Math.floor(Math.random() * cs.length)];
    m._dbPain = { who: c, until: tk() + SK.painDur };
    log(tag('疼痛的歡愉', '#e879f9') + esc(m.n) + ' 對' + nameOf(c) + '施放疼痛的歡愉——10 秒內' + nameOf(c) + '打它的傷害 50% 會反彈回去！');
  };
  var drainMp = function (m) {
    var sum = 0;
    chars().forEach(function (c) { var mx = Number(c.mmp) || 0, cur = Number(c.mp) || 0, d = Math.min(cur, Math.floor(mx * SK.mpPct)); if (d > 0) { c.mp = cur - d; sum += d; } });
    log(tag('吸魔', '#818cf8') + esc(m.n) + ' 吸走了全隊最大 MP 的 5%（共 ' + sum + ' 點）。');
  };
  var resCut = 0, resMap = null, resIdle = 0;
  var applyResPlayer = function () { try { if (typeof recomputeStats === 'function') recomputeStats(); else if (typeof calcStats === 'function') calcStats(); } catch (e) {} };
  var shredRes = function (m) {
    if (resCut >= SK.resMax) return;
    resCut = Math.min(SK.resMax, resCut + SK.resStep); resMap = mapState.current;
    applyResPlayer(); syncAllyRes();
    log(tag('蝕抗', '#94a3b8') + esc(m.n) + ' 侵蝕了全隊的五屬性抗性 −' + SK.resStep + '（目前 −' + resCut + '，最多 −' + SK.resMax + '）。');
  };
  var clearRes = function () { if (!resCut) return; resCut = 0; resMap = null; applyResPlayer(); syncAllyRes(); };
  var syncAllyRes = function () {
    var p = P(); if (!p) return;
    (p.allies || []).forEach(function (a) {
      if (!a || !a.d) return;
      var ap = a._afkDbRes;
      if (!ap || ap.d !== a.d || ap.rn !== a._recompN) ap = { amt: 0 };   // 能力重建過＝之前扣的已經不在了
      var want = resCut, diff = want - ap.amt;
      if (diff) RES_KEYS.forEach(function (k) { a.d[k] = (Number(a.d[k]) || 0) - diff; });
      a._afkDbRes = { amt: want, d: a.d, rn: a._recompN };
    });
  };
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try { var p = P(); if (p && p.d && resCut > 0) RES_KEYS.forEach(function (k) { p.d[k] = (Number(p.d[k]) || 0) - resCut; }); } catch (e) {}
      return r;
    };
    try { recomputeStats = W.recomputeStats; } catch (e) {}
  }
  var bossSkills = function (m) {
    var t = tk(), s = m._dbSk;
    if (!s) s = m._dbSk = { stun: t + 80, cancel: t + 150, pain: t + 50, mp: t + SK.mp, res: t + SK.res };
    if (W.__afkHalted && W.__afkHalted(m)) { for (var k in s) s[k]++; return; }   // 被暈／凍住時招式往後延
    if (t >= s.stun) { s.stun = t + SK.stun; massStun(m); }
    if (t >= s.cancel) { s.cancel = t + SK.cancel; cancel(m); }
    if (t >= s.pain) { s.pain = t + SK.pain; pain(m); }
    if (t >= s.mp) { s.mp = t + SK.mp; drainMp(m); }
    if (t >= s.res) { s.res = t + SK.res; shredRes(m); }
  };

  // 疼痛的歡愉：那名角色打這隻王的傷害（最後結算之後）50% 反彈給他自己
  var painLogAt = 0;
  var hookPain = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.__afkDreamBoss) return;
    var oD = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var r = oD.apply(this, arguments);
      try {
        var pn = target && target._dbPain;
        if (pn && r > 0 && actor && actor === pn.who && tk() <= pn.until && !(opt && opt.origin === 'reflection') && on()) {
          var d = Math.max(1, Math.floor(r * SK.painRf)), L = W.__afkLore;
          if (L && L.boss && L.boss.hurt) L.boss.hurt(actor, d);
          else if (actor === P()) { actor.hp -= d; if (actor.hp <= 0 && typeof killPlayer === 'function') killPlayer(); }
          else { actor.curHp -= d; if (actor.curHp <= 0) { actor.curHp = 0; actor._downed = true; actor._reviveCd = 150; } }
          var now = Date.now(); if (now - painLogAt > 1000) { painLogAt = now; log(tag('疼痛的歡愉', '#e879f9') + nameOf(actor) + '的攻擊被反彈了 ' + d + ' 點傷害。'); }
        }
      } catch (e) {}
      return r;
    };
    C.__afkDreamBoss = true;
  };
  hookPain();

  // ── 副本侵蝕 ──
  var DRAIN = { base: 0.01, step: 0.01, per: 600 }, drain = { map: null, t0: 0, lv: 0 };
  var FINAL_MAP = 'afk_final_sea';
  var drainZone = function () {
    var key = (typeof mapState !== 'undefined' && mapState.current) || '';
    if (key === FINAL_MAP) return !!(S()._afkFinal && S()._afkFinalNovice);   // 一轉女神
    if (key === 'rift_battle' || S().prideClimb) return false;
    return inDungeon();
  };
  var drainStep = function () {
    var key = mapState.current, t = tk();
    if (!drainZone()) { drain.map = null; return; }
    if (drain.map !== key) { drain.map = key; drain.t0 = t; drain.lv = 0; return; }
    var el = t - drain.t0; if (el <= 0 || el % 10 !== 0) return;
    var lv = Math.floor(el / DRAIN.per), pct = DRAIN.base + DRAIN.step * lv, p = P();
    if (lv !== drain.lv || el === 10) { drain.lv = lv; log(tag('副本侵蝕', '#a855f7') + '夢域在副本裡蔓延——全隊每秒失去最大 HP 與 MP 的 ' + Math.round(pct * 100) + '%（每過 1 分鐘 +1%）。'); }
    chars().forEach(function (c) {
      var mh = Number(c === p ? c.mhp : c.mhp) || 0, mm = Number(c.mmp) || 0;
      if (mm > 0) c.mp = Math.max(0, (Number(c.mp) || 0) - Math.floor(mm * pct));
      var d = Math.max(1, Math.floor(mh * pct));
      if (c === p) { p.hp -= d; if (p.hp <= 0 && !p.dead && typeof killPlayer === 'function') killPlayer(); }
      else { c.curHp = (Number(c.curHp) || 0) - d; if (c.curHp <= 0) { c.curHp = 0; c._downed = true; c._reviveCd = 150; } }
    });
    try { if (!S().ff && typeof updateUI === 'function') updateUI(); } catch (e) {}
  };

  // ── 每個 tick ──
  var lastMap = null;
  var step = function () {
    var cur = (typeof mapState !== 'undefined' && mapState.current) || '';
    if (cur !== lastMap) { lastMap = cur; dots.length = 0; lastEntry = {}; }
    if (!on()) { dots.length = 0; clearRes(); drain.map = null; return; }
    drainStep();
    var dgBossAlive = false;
    (mapState.mobs || []).forEach(function (m) {
      if (!m || m._dead || !(m.curHp > 0)) return;
      if (!m._dbSeen) { m._dbSeen = true; var k = classify(m); m._dbKind = k; if (k) entrance(m, k); }
      if (m._dbKind === 'dungeon') { dgBossAlive = true; bossSkills(m); }
    });
    tickDots();
    if (resCut) {
      if (resMap !== cur) clearRes();
      else if (!dgBossAlive) { if (++resIdle >= 50) { resIdle = 0; clearRes(); } }
      else { resIdle = 0; if (tk() % 10 === 0) syncAllyRes(); }
    }
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var t0 = tk(), r = oTick.apply(this, arguments); if (tk() !== t0) { try { step(); } catch (e) { console.warn('[AFK-dreamboss] tick', e); } } return r; };
  }

  W.__afkDreamBoss = { on: on, ENTRY: ENTRY, SWARM: SWARM, SWARM_PCT: SWARM_PCT, SK: SK, step: step, everyone: everyone, pctCur: pctCur, inDungeon: inDungeon, classify: classify,
    resCut: function () { return resCut; }, dots: function () { return dots.slice(); }, _reset: function () { dots.length = 0; lastEntry = {}; clearRes(); drain.map = null; }, DRAIN: DRAIN, drainZone: drainZone };
})();
