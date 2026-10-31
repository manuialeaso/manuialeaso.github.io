/* ============================================================================
 * afk-rift2.js — 時空裂痕重做（玩家 2026-10-29 晚，設計稿 docs/runes-design.md 第三版）
 *
 * 一、時間改用遊戲時間（所有模式）：原本用電腦時鐘，分頁在背景補跑時一整批都算「現在」，
 *     怪物等級、頭目比例、傷害倍率會一口氣跳上去。現在每一下都換算成「開場後經過幾下遊戲時間」。
 * 二、席琳三模式（席琳／瘋狂席琳／夢域鏡席琳）的新規則：
 *   ‧一趟最長 80 分鐘；撐滿 80 分鐘＝完全通關，自動結算。
 *   ‧難度目標：撐到 60／70／80 分鐘，大約要曲線 60／70／80 的裝備（遺物 +10＋原版遺骸＋之魂／遺物 +15＋夢域遺骸／昇華支配 +2）。
 *     做法：20 分鐘後怪物 HP 隨時間成長；頭目出場 60 秒還沒倒就「時空暴走」，每秒對全隊造成真實傷害（越拖越重）；
 *           60 分鐘起全場每秒扣最大 HP（第二道壓力牆）。數字在 TUNE，用模擬工具對齊。
 *   ‧不吃任何掉寶加倍（兔腳、隊伍人數、席琳世界 ×3／×5…）；怪物專屬掉落表的遺物 ×10（0.0001% → 0.001%）。
 *     會變身的頭目只有最後一階會掉東西（核心原本就是這樣），所以整條只判定一次。
 *   ‧哀石系列：一般怪 1%、60 等以下頭目 10%、60 等以上頭目 25%、第 60 分鐘起頭目必掉；頭目另有 0.001% 掉該模式的失去光芒的符文石。
 *   ‧結算（取代原本的潘朵拉抽獎）：
 *       席琳：失去光芒的符文石（階段一）
 *       瘋狂：0～12 分隨機遺物 +5；12～76 分階段二；76 分以上或完全通關階段三
 *       夢域：0～12 分隨機遺物 +10；12～60 分階段二；60～76 分階段三；76 分以上或完全通關瘴骸·破材料（隨機一種）
 *   ‧完全通關另給：瘴氣魔石 100／骸骨魔石 50／破空石 10。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'rift2', name: '時空裂痕重做（席琳三模式）', group: '遊戲玩法',
    desc: '時空裂痕改用遊戲時間；席琳三模式一趟 80 分鐘、越後面越難（頭目 60 秒沒倒會暴走、60 分鐘起全場扣血），掉哀石系列與失去光芒的符文石，撐滿 80 分鐘給瘴骸·破材料' });
  var ON = !T || T.enabled('rift2');
  var RD = W.__afkRuneData;
  if (typeof W.enterRift !== 'function' || typeof W.spawnRiftMob !== 'function' || !RD) { console.warn('[AFK-rift2] 找不到時空裂痕，略過'); return; }
  var S = function () { return typeof state !== 'undefined' ? state : {}; };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var TUNE = W.__afkRift2Tune = W.__afkRift2Tune || {
    hpFrom: 20, hpRate: { sherine: 0.035, mad: 0.0525, dream: 0.0525 },   // 20 分鐘起怪物 HP ×e^(rate×(分鐘−20))；席琳模式 0.067 → 0.035（玩家 2026-10-29：王族＋7 名轉生傭兵、冥皇套 +15 要能撐滿 80 分鐘；實測原本 63～65 分被頭目暴走團滅）
    hpBase: { sherine: 1, mad: 1, dream: 0.15 },   // 各模式怪物 HP 的基本倍率（夢域鏡本身已經 ×50，用這個把三模式拉到同一條難度線）
    enrageSec: 60, enrageMulti: 90, enragePct: 0.05, enrageStep: 0.05, enrageEvery: 10,   // 頭目 60 秒沒倒：每秒全隊最大 HP 5%，每 10 秒再 +5%
    wallFrom: 60, wallBase: 0.004, wallStep: 0.0025,   // 60 分鐘起全場每秒扣 0.4% 最大 HP，每分鐘再 +0.25%
    clearMin: 80
  };
  var DROP = { mob: 0.01, bossLow: 0.10, bossHigh: 0.25, bossFrom: 60, box: 0.00001, relicX: 10,
    legend: 0.01, legendPct: 0.15, legendId: 'afk_rune_po_l' };   // 玩家 2026-10-29：席琳模式前 15% 時間（80 分的前 12 分）每次擊殺 1% 掉傳說符文「破」，給新手用；一趟最多一顆
  var SEG = { mad: [[12, 'relic5'], [76, 'box2'], [1e9, 'box3']], dream: [[12, 'relic10'], [60, 'box2'], [76, 'box3'], [1e9, 'fate']] };

  // ── 模式與時間 ──
  var modeNow = function () { var p = P(); if (!p || p.classicMode) return 'plain'; if (p.sherineMad && p.sherineDream) return 'dream'; if (p.sherineMad) return 'mad'; if (p.sherineWorld) return 'sherine'; return 'plain'; };
  var inRift = function () { return !!(S().riftRun && !S().dreamStar && mapState && mapState.current === 'rift_battle'); };   // 暗夢星迴不套用（2026-10-31：原本 HP ×0.15、時空暴走也套進去）
  var rule = function () { return ON && inRift() && S()._r2Mode && S()._r2Mode !== 'plain'; };
  var minutes = function () { var s = S(); return s._r2Start == null ? 0 : Math.max(0, ((s.ticks || 0) - s._r2Start) / 600); };
  var sync = function () {
    var s = S(); if (!s.riftRun || s._r2Start == null) return;
    var now = Date.now();
    s.riftStartMs = now - ((s.ticks || 0) - s._r2Start) * 100;
    if (s._r2BossDue != null) s.riftBossDue = now + (s._r2BossDue - (s.ticks || 0)) * 100;
  };
  var oEnter = W.enterRift;
  W.enterRift = function () {
    var r = oEnter.apply(this, arguments);
    var s = S();
    if (s.riftRun) { s._riftRunKey = s.riftStartMs; s._r2Start = s.ticks || 0; s._r2BossDue = s._r2Start + 3000; s._r2Mode = modeNow(); s._r2Clear = false; s._r2Wall = 0; s._r2Legend = false; sync(); }
    return r;
  };
  var oSpawn = W.spawnRiftMob;
  W.spawnRiftMob = function (idx) {
    sync();
    var s = S(), due0 = s.riftBossDue;
    var r = oSpawn.apply(this, arguments);
    if (s.riftBossDue !== due0 && s._r2Start != null) s._r2BossDue = (s.ticks || 0) + Math.round((s.riftBossDue - Date.now()) / 100);
    return r;
  };
  // 停留時間也用遊戲時間（riftEndRun 讀 Date.now()−riftStartMs）
  var oEnd = W.riftEndRun;
  W.riftEndRun = function () {
    var s = S(), p = P();
    if (!s.riftRun) return oEnd.apply(this, arguments);
    sync();
    var info = { mode: s.dreamStar ? 'plain' : (s._r2Mode || 'plain'), min: minutes(), clear: !!s._r2Clear };   // 暗夢星迴沒有裂痕獎勵
    var r = oEnd.apply(this, arguments);
    try { if (ON && p && info.mode !== 'plain') p.afkRift2Reward = info; } catch (e) {}
    s._r2Start = null; s._r2BossDue = null;
    return r;
  };

  // ── 難度 ──
  var hpMult = function (mode, m) { var rate = (TUNE.hpRate || {})[mode] || 0, base = (TUNE.hpBase || {})[mode] || 1; return base * (m > TUNE.hpFrom ? Math.exp(rate * (m - TUNE.hpFrom)) : 1); };
  var members = function () { var out = []; if (!player.dead) out.push(player); (player.allies || []).forEach(function (x) { if (x && !x._downed && (x.curHp || 0) > 0) out.push(x); }); return out; };
  var hurtAll = function (pct, why) {
    var dead = false;
    members().forEach(function (t) {
      if (dead) return;
      var dmg = Math.max(1, Math.floor((t.mhp || 1) * pct));
      if (typeof W.__afkTrueCut === 'function') dmg = W.__afkTrueCut(t, dmg);   // 符文「骸」
      if (t === player) { player.hp -= dmg; if (player.hp <= 0 && typeof killPlayer === 'function') { killPlayer(); dead = true; } }
      else { t.curHp -= dmg; if (t.curHp <= 0) { t.curHp = 0; t._downed = true; t._reviveCd = 150; } }
    });
    return dead;
  };
  var logC = function (h) { try { if (!S().ff) logCombat(h, 'enemy'); } catch (e) {} };
  var lastLog = {};
  var step = function () {
    var s = S(); if (!rule()) return;
    var m = minutes(), mode = s._r2Mode, t = s.ticks || 0;
    // 撐滿 80 分鐘：完全通關
    if (m >= TUNE.clearMin) {
      s._r2Clear = true;
      try { logSys('<span class="font-bold" style="color:#fde68a;">🌀 你在時空裂痕撐滿了 ' + TUNE.clearMin + ' 分鐘——裂痕在你面前閉合（完全通關）。</span>'); } catch (e) {}
      try { W.riftEndRun(); setMapSelectors('town_rift'); changeMap(true); saveGame(); } catch (e) { console.warn('[AFK-rift2] clear', e); }
      return;
    }
    // 新出場的怪：HP 隨時間成長（含變身後的下一階）
    var k = hpMult(mode, m);
    (mapState.mobs || []).forEach(function (x) {
      if (!x || x._r2 || x._dead) return;
      x._r2 = { born: t };
      if (k !== 1) { x.hp = Math.max(1, Math.floor(x.hp * k)); x.curHp = Math.max(1, Math.floor((x.curHp || x.hp) * k)); if (x.curHp > x.hp) x.curHp = x.hp; }
    });
    if (t % 10) return;
    // 頭目暴走
    var worst = 0, who = null;
    var bosses = (mapState.mobs || []).filter(function (x) { return x && x.boss && !x._dead && x.curHp > 0 && x._r2; });
    var sec = bosses.length >= 2 ? TUNE.enrageMulti : TUNE.enrageSec;   // 玩家 2026-10-29：同時好幾隻王在場時放寬到 90 秒
    bosses.forEach(function (x) {
      var age = (t - x._r2.born) / 10;
      if (age >= sec) { var e = TUNE.enragePct + TUNE.enrageStep * Math.floor((age - sec) / TUNE.enrageEvery); if (e > worst) { worst = e; who = x; } }
    });
    if (worst > 0) {
      if (lastLog.enrage !== who) { lastLog.enrage = who; logC('<span class="font-bold" style="color:#f472b6;">【時空暴走】</span>' + esc(who.n) + ' 拖得太久，扭曲的時空開始撕裂全隊（每秒最大 HP ' + Math.round(worst * 100) + '%，越拖越重）。'); }
      if (hurtAll(worst, '時空暴走')) return;
    }
    // 60 分鐘起：全場壓力牆
    if (m >= TUNE.wallFrom) {
      var w = TUNE.wallBase + TUNE.wallStep * Math.floor(m - TUNE.wallFrom);
      if (s._r2Wall !== Math.floor(m)) { s._r2Wall = Math.floor(m); logC('<span class="font-bold" style="color:#c084fc;">【裂痕崩塌】</span>時空正在崩落，全隊每秒失去最大 HP ' + (Math.round(w * 1000) / 10) + '%。'); }
      if (hurtAll(w, '裂痕崩塌')) return;
    }
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      sync();
      var r = oTick.apply(this, arguments);
      try { step(); } catch (e) { console.warn('[AFK-rift2] tick', e); }
      return r;
    };
  }

  // ── 掉落 ──
  W.__afkRiftDrop = function (itemId, pct, mob) {
    if (!rule()) return null;
    var d = DB.items[itemId];
    return d && d.relic ? pct * DROP.relicX : pct;   // 不吃任何加倍；遺物 ×10
  };
  ['partyDropRate', '__afkRelicDropMult'].forEach(function (fn) {
    if (typeof W[fn] !== 'function') return;
    var o = W[fn];
    W[fn] = function (x) { if (rule()) return fn === 'partyDropRate' ? x : 1; return o.apply(this, arguments); };
  });
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState.mobs ? mapState.mobs[idx] : null, on = rule(), mode = S()._r2Mode, mm = minutes();
      var r = oKill.apply(this, arguments);
      try {
        if (on && m && m._dead && !m._r2Paid) {
          m._r2Paid = true;
          var dust = RD.DUST[mode], lv = m.lv || 0;
          var rate = !m.boss ? DROP.mob : (mm >= DROP.bossFrom ? 1 : (lv >= 60 ? DROP.bossHigh : DROP.bossLow));
          if (dust && Math.random() < rate) gainItem(dust, 1, true, true);
          var stage = { sherine: 1, mad: 2, dream: 3 }[mode];
          var S0 = S();
          if (mode === 'sherine' && mm < TUNE.clearMin * DROP.legendPct && !S0._r2Legend && DB.items[DROP.legendId] && Math.random() < DROP.legend) {
            S0._r2Legend = true; gainItem(DROP.legendId, 1, true, true);
            try { logSys('<span class="text-amber-300 font-bold">✦ 傳說！' + esc(m.n) + ' 的殘影裡掉出了 ' + DB.items[DROP.legendId].n + '。</span>'); } catch (e) {}
          }
          if (m.boss && stage && Math.random() < DROP.box) { gainItem(RD.BOX[stage], 1, true, true); try { logSys('<span class="text-amber-300 font-bold">✦ 極稀有！' + esc(m.n) + ' 留下了 ' + DB.items[RD.BOX[stage]].n + '。</span>'); } catch (e) {} }
        }
      } catch (e) { console.warn('[AFK-rift2] drop', e); }
      return r;
    };
  }

  // ── 結算 ──
  var randomRelic = function (lv) {
    var R = W.__afkRelicPlus; if (!R) return null;
    var pool = Object.keys(DB.items).filter(function (id) { var d = DB.items[id]; return d && !/~/.test(id) && R.kindOk && R.kindOk(d); });
    if (!pool.length) return null;
    var base = pool[Math.floor(Math.random() * pool.length)], d = DB.items[base];
    var n = Math.min(lv, d.type === 'acc' ? 10 : 15), fx = null;
    if (n >= R.fxAt(base)) { var ds = R.donorsFor(base); fx = ds.length ? ds[Math.floor(Math.random() * ds.length)] : null; }
    var id = R.makeId(base, n, fx); if (!R.ensure(id)) return null; R.remember(id);
    return id;
  };
  var giveFate = function () { var k = ['sherine', 'mad', 'dream'][Math.floor(Math.random() * 3)], c = RD.CLEAR[k]; gainItem(c[0], c[1], true, true); return DB.items[c[0]].n + ' ×' + c[1]; };
  var reward = function (info) {
    var got = [], add = function (id, n) { if (!id || !DB.items[id]) return; gainItem(id, n || 1, true, true); got.push('<span class="' + (DB.items[id].c || '') + '">' + DB.items[id].n + '</span>' + ((n || 1) > 1 ? ' ×' + n : '')); };
    var m = info.min, mode = info.mode, kind = 'box1';
    if (mode === 'mad' || mode === 'dream') { var seg = SEG[mode], k = info.clear ? 1e9 - 1 : m; for (var i = 0; i < seg.length; i++) if (k < seg[i][0]) { kind = seg[i][1]; break; } }
    if (kind === 'relic5' || kind === 'relic10') add(randomRelic(kind === 'relic5' ? 5 : 10));
    else if (kind === 'fate') got.push(giveFate());
    else add(RD.BOX[Number(kind.slice(3))]);
    if (info.clear && RD.CLEAR[mode]) add(RD.CLEAR[mode][0], RD.CLEAR[mode][1]);
    return got;
  };
  if (typeof W.claimRiftReward === 'function') {
    var oClaim = W.claimRiftReward;
    W.claimRiftReward = function () {
      var p = P(), info = p && p.afkRift2Reward;
      if (!ON || !info || p.riftRewardMs == null) return oClaim.apply(this, arguments);
      var got = reward(info);
      p.riftRewardMs = null; p.afkRift2Reward = null;
      var MN = { sherine: '席琳', mad: '瘋狂席琳', dream: '夢域鏡席琳' };
      try { logSys('<span class="text-amber-300 font-bold">🎁 時空裂痕獎勵（' + MN[info.mode] + '模式，停留 ' + Math.floor(info.min) + ' 分' + (info.clear ? '，完全通關' : '') + '）：</span>' + (got.length ? got.join('、') : '這次什麼也沒有凝聚出來') + '。'); } catch (e) {}
      try { saveGame(); } catch (e) {}
      var c = document.getElementById('interaction-content'); if (c && typeof W.renderRiftEntrance === 'function') { c.innerHTML = ''; W.renderRiftEntrance(c); }
      try { updateUI(); } catch (e) {}
    };
  }
  if (typeof W.renderRiftEntrance === 'function') {
    var oRender = W.renderRiftEntrance;
    W.renderRiftEntrance = function (container) {
      var r = oRender.apply(this, arguments);
      try {
        if (!ON || !container) return r;
        var mode = modeNow(); if (mode === 'plain') return r;
        var MN = { sherine: '席琳', mad: '瘋狂席琳', dream: '夢域鏡席琳' };
        var rw = { sherine: '失去光芒的符文石（階段一）', mad: '0～12 分隨機遺物 +5；12～76 分失去光芒的符文石（階段二）；76 分以上或完全通關（階段三）', dream: '0～12 分隨機遺物 +10；12～60 分階段二；60～76 分階段三；76 分以上或完全通關：瘴骸·破材料（隨機一種）' }[mode];
        var cl = RD.CLEAR[mode];
        var div = document.createElement('div');
        div.className = 'bg-slate-900/70 border border-violet-700 rounded-lg p-3 text-sm leading-relaxed text-slate-200';
        div.innerHTML = '<div class="font-bold text-violet-300 mb-1">目前：' + MN[mode] + '模式（時空裂痕重做）</div>'
          + '<div>一趟最長 ' + TUNE.clearMin + ' 分鐘，撐滿就是<b>完全通關</b>（另給 ' + DB.items[cl[0]].n + ' ×' + cl[1] + '）。20 分鐘後怪物越來越硬；頭目出場 ' + TUNE.enrageSec + ' 秒（同時兩隻以上 ' + TUNE.enrageMulti + ' 秒）還沒倒會<b>時空暴走</b>；' + TUNE.wallFrom + ' 分鐘起全場每秒扣血。</div>'
          + '<div>掉落：' + DB.items[RD.DUST[mode]].n + '（一般怪 1%、60 等以下頭目 10%、60 等以上頭目 25%、第 60 分鐘起頭目必掉）；不吃任何掉寶加倍；遺物 0.001%。' + (mode === 'sherine' ? '前 ' + Math.round(TUNE.clearMin * DROP.legendPct) + ' 分鐘每次擊殺 ' + (DROP.legend * 100) + '% 掉傳說符文「破」（一趟最多一顆）。' : '') + '</div>'
          + '<div>結算：' + rw + '。</div>';
        (container.firstElementChild || container).appendChild(div);
      } catch (e) {}
      return r;
    };
  }
  W.__afkRift2 = { TUNE: TUNE, DROP: DROP, SEG: SEG, minutes: minutes, modeNow: modeNow, rule: rule, reward: reward, hpMult: hpMult };
  console.log('[AFK-rift2] 已啟用：時空裂痕改用遊戲時間' + (ON ? '＋席琳三模式新規則' : ''));
})();
