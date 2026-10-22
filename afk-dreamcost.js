/* ==========================================================================
 * afk-dreamcost.js — 夢艷地獄的代價（玩家 2026-10-22 指定）；開關沿用 dreamhell
 *
 * 一、夢艷地獄（不論是否轉生、任何地區）
 *   ‧一般怪死亡：不扣血（2026-10-23 移除）
 *   ‧王死亡：全隊受到當前 HP 10% 真實傷害，並吸走你與傭兵當前 MP 的 10%
 *
 * 二、轉生後進入夢艷地獄
 *   ‧所有技能的 MP／HP 消耗 ×2（你與傭兵都一樣）
 *   ‧復活與召喚的代價（返生術 MP、召喚術／造屍術／召喚屬性精靈 MP、復活卷軸張數）再 ×2，
 *     例：召喚術 80 MP → 技能 ×2 → 復活 ×2 ＝ 320 MP；復活卷軸 1 張 → 2 張
 *     對象：傭兵、寵物、召喚物（你自己的原地復活不算）（城堡護衛是時間到自動復活，不用道具或法術，不受影響）
 *   ‧這場戰鬥（進入這張地圖後）累積死亡次數（傭兵、寵物、召喚物、城堡護衛倒下都算）：
 *       20 次 → 復活代價再 ×2；50、60、80、100 次各再 ×2（卷軸 2→4→8→16→32→64 張）
 *       100 次起：每次復活後 10 秒內不能再復活（寵物不受此冷卻）；冷卻結束時死亡次數歸零重算
 *     換地圖、離開夢艷地獄、或你自己倒下（＝這場戰鬥結束）都歸零；你自己的原地復活照原本規則，不受倍率影響
 *   ‧用復活卷軸復活（你與傭兵）：HP 100% 復活，但吸走當前 MP 10%（寵物照原本規則）
 *
 * 三、寵物 MP 自然恢復：改吃你自己的面板「MP 恢復」（比寵物原本的高就用你的，寵物裝備加成照加；任何地區都有效）
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('dreamhell')) return;
  if (typeof DB === 'undefined' || typeof window.killMob !== 'function') return;

  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var dreamOn = function () { try { return !!(player && player.sherineDream && player.sherineMad); } catch (e) { return false; } };
  var reborn = function () { try { return !!(player && player.rebirth > 0); } catch (e) { return false; } };
  var active = function () { return dreamOn() && reborn(); };
  var clog = function (h, k) { try { if (!S().ff) logCombat(h, k || 'enemy'); } catch (e) {} };

  // ── 全隊扣 HP（真實傷害）──
  var teamHit = function (pct, why) {
    var hit = [];
    try {
      if (!player.dead) {
        var d0 = Math.floor(Math.max(0, player.hp || 0) * pct); if (d0 > 0) { player.hp -= d0; hit.push('你 ' + d0); }
        if (player.hp <= 0 && typeof killPlayer === 'function') killPlayer();
      }
      (player.allies || []).forEach(function (x) {
        if (!x || x._downed || !(x.curHp > 0)) return;
        var d = Math.floor(Math.max(0, x.curHp || 0) * pct); if (d <= 0) return; x.curHp -= d; hit.push((x._allyName || '傭兵') + ' ' + d);
        if (x.curHp <= 0) { x.curHp = 0; x._downed = true; x._reviveCd = 150; }
      });
      try {
        (typeof petsOutList === 'function' ? petsOutList() : []).forEach(function (pt) {
          if (!pt || pt._downed || !(pt.hp > 0)) return;
          var mh = typeof petMhpEff === 'function' ? petMhpEff(pt) : (pt.mhp || pt.hp);
          var d = Math.floor(Math.max(0, pt.hp || 0) * pct); if (d <= 0) return; pt.hp -= d; hit.push('寵物' + pt.form + ' ' + d);
          if (pt.hp <= 0 && typeof _petDown === 'function') _petDown(pt, why);
        });
        if (typeof petMarkDirty === 'function') petMarkDirty();
      } catch (e) {}
      try {
        (player.summonsV2 || []).forEach(function (sm) {
          if (!sm || sm._downed || !(sm.hp > 0)) return;
          var d = Math.floor(Math.max(0, sm.hp || 0) * pct); if (d <= 0) return; sm.hp -= d; hit.push('召喚' + sm.form + ' ' + d);
          if (sm.hp <= 0) { sm.hp = 0; sm._downed = true; sm._diedAt = Date.now(); }
        });
      } catch (e) {}
    } catch (e) {}
    return hit;
  };

  // ── 一、怪物死亡的代價 ──
  var oKill = window.killMob;
  window.killMob = function (idx) {
    var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null;
    var was = !!(m && !m._dead);
    var r = oKill.apply(this, arguments);
    try {
      if (was && m._dead && dreamOn() && m.race !== '建築') {
        if (m.boss) {
          var hit = teamHit(0.10, m.n + '的死亡詛咒'), mp = [];
          var d0 = Math.floor((player.mp || 0) * 0.1); if (d0 > 0 && !player.dead) { player.mp -= d0; mp.push('你 ' + d0); }
          (player.allies || []).forEach(function (x) { if (!x || x._downed) return; var d = Math.floor((x.mp || 0) * 0.1); if (d > 0) { x.mp -= d; mp.push((x._allyName || '傭兵') + ' ' + d); } });
          clog('<span class="text-fuchsia-300 font-bold">🌙 ' + m.n + ' 倒下時的死亡詛咒！</span>全隊當前 HP 10% 真實傷害（' + hit.join('、') + '）' + (mp.length ? '，並吸走 MP 10%（' + mp.join('、') + '）' : ''));
        }   // 一般怪死亡不再扣血（玩家 2026-10-23：高手打低等區反而被自己炸死）
      }
    } catch (e) {}
    return r;
  };

  // ── 二、轉生夢艷：死亡次數與倍率 ──
  var deaths = 0, mapAt = null, cdUntil = 0, STEPS = [20, 50, 60, 80, 100];
  var reviveMult = function () { var k = 1; STEPS.forEach(function (s) { if (deaths >= s) k *= 2; }); return 2 * k; };
  var onCd = function () { return deaths >= 100 && (S().ticks || 0) < cdUntil; };
  var setCd = function () { if (deaths >= 100) cdUntil = (S().ticks || 0) + 100; };
  var countDeath = function (who) {
    if (!active()) return;
    deaths++;
    if (STEPS.indexOf(deaths) >= 0) {
      clog('<span class="text-red-400 font-bold">💀 這場戰鬥已累積倒下 ' + deaths + ' 次！</span>復活與召喚的代價提升為 ×' + reviveMult() + '（復活卷軸 ' + reviveMult() + ' 張）' + (deaths >= 100 ? '，每次復活後 10 秒內不能再復活（寵物除外）' : '') + '。', 'enemy');
    }
  };
  var resetIfMoved = function () {
    var c = (typeof mapState !== 'undefined' && mapState) ? mapState.current : null;
    if (c !== mapAt || !active()) { if (deaths) deaths = 0; mapAt = c; cdUntil = 0; }
  };

  if (typeof window.killPlayer === 'function') {
    var oKP = window.killPlayer;
    window.killPlayer = function () { var was = !player.dead; var r = oKP.apply(this, arguments); if (was && player.dead && active() && deaths) { deaths = 0; cdUntil = 0; applyCost(); } return r; };   // 你倒下＝這場戰鬥結束，次數歸零
  }
  // 傭兵、寵物、召喚物、城堡護衛倒下：每 tick 比對
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
  var scanDowns = function () {
    if (!seen) return;
    var all = [].concat(player.allies || [], player.summonsV2 || [], player.guardsV2 || []);
    try { all = all.concat(typeof petsOutList === 'function' ? petsOutList() : []); } catch (e) {}
    all.forEach(function (x) {
      if (!x) return;
      if (x._downed) { if (!seen.has(x)) { seen.add(x); countDeath(); } }
      else if (seen.has(x)) seen.delete(x);
    });
  };

  // 技能 MP／HP 消耗：轉生夢艷中直接把技能表的消耗加倍（離開就還原）
  var REVIVE_SK = { sk_resurrection: 1, sk_summon: 1, sk_zombie: 1, sk_elf_summon: 1, sk_elf_summon2: 1 };
  var base = null, applied = 0;   // applied＝目前套用中的復活倍率（0＝沒套用）
  var applyCost = function () {
    var want = active() ? reviveMult() : 0;
    if (want === applied) return;
    if (!base) { base = {}; Object.keys(DB.skills).forEach(function (k) { var s = DB.skills[k]; if (s && (s.mp || s.hpCost)) base[k] = { mp: s.mp, hp: s.hpCost }; }); }
    Object.keys(base).forEach(function (k) {
      var s = DB.skills[k], b = base[k]; if (!s) return;
      var mul = want ? 2 * (REVIVE_SK[k] ? want : 1) : 1;
      if (b.mp) s.mp = b.mp * mul;
      if (b.hp) s.hpCost = b.hp * mul;
    });
    applied = want;
  };
  window.__afkDreamCost = { deaths: function () { return deaths; }, mult: reviveMult, setDeaths: function (n) { deaths = n; applyCost(); }, active: active, applyCost: applyCost };

  if (typeof window.tick === 'function') {
    var oTick = window.tick;
    window.tick = function () {
      try { return oTick.apply(this, arguments); } finally { try {
        resetIfMoved();
        if (active()) scanDowns();
        if (cdUntil && (S().ticks || 0) >= cdUntil) {   // 10 秒復活冷卻結束 → 死亡次數歸零重算
          cdUntil = 0; deaths = 0;
          clog('<span class="text-emerald-300">夢艷地獄：復活冷卻結束，累積死亡次數歸零重新計算。</span>', 'system');
        }
        applyCost();
      } catch (e) {} }
    };
  }

  // 復活卷軸張數 ×倍率：不夠就當作沒有卷軸；夠的話原本扣 1 張，之後補扣其餘
  var scrollCount = function () { return (player.inv || []).reduce(function (s, i) { return s + (i && i.id === 'scroll_revive' ? (i.cnt || 0) : 0); }, 0); };
  var takeScrolls = function (n) {
    for (var i = 0; i < (player.inv || []).length && n > 0; i++) {
      var it = player.inv[i]; if (!it || it.id !== 'scroll_revive') continue;
      var t = Math.min(n, it.cnt || 0); it.cnt -= t; n -= t;
    }
    player.inv = player.inv.filter(function (i) { return !(i && i.id === 'scroll_revive' && !(i.cnt > 0)); });
  };
  var withScrolls = function (fn, opt) {
    return function () {
      if (!active()) return fn.apply(this, arguments);
      if (opt && opt.cd && onCd()) {
        if (opt.say) clog('<span class="text-slate-400">夢艷地獄：復活冷卻中（還要 ' + Math.ceil((cdUntil - (S().ticks || 0)) / 10) + ' 秒）。</span>', 'system');
        return false;
      }
      var need = reviveMult(), have = scrollCount(), hidden = [];
      if (have < need) { (player.inv || []).forEach(function (i) { if (i && i.id === 'scroll_revive') { i.id = '__afk_hidden_scroll'; hidden.push(i); } }); }
      var mp0 = player.mp, r;
      try { r = fn.apply(this, arguments); }
      finally { hidden.forEach(function (i) { i.id = 'scroll_revive'; }); }
      var used = hidden.length ? 0 : have - scrollCount();
      if (used > 0) takeScrolls(used * (need - 1));
      if (opt && opt.cd && (used > 0 || player.mp < mp0)) setCd();
      return r;
    };
  };
  if (typeof window.reviveMercenary === 'function') window.reviveMercenary = withScrolls(window.reviveMercenary, { cd: true, say: true });
  if (typeof window.tryAutoReviveMercScroll === 'function') window.tryAutoReviveMercScroll = withScrolls(window.tryAutoReviveMercScroll, { cd: true });
  if (typeof window.petRevive === 'function') window.petRevive = withScrolls(window.petRevive);
  if (typeof window.petsTick === 'function') window.petsTick = withScrolls(window.petsTick);

  // 100 次起：召喚術等也算復活，冷卻中不能施放
  ['castSkillInner', 'manualCast'].forEach(function (fnName) {
    var o = window[fnName]; if (typeof o !== 'function') return;
    window[fnName] = function (skId) {
      if (active() && REVIVE_SK[skId] && skId !== 'sk_resurrection' && onCd()) return false;
      var mp0 = player.mp, r = o.apply(this, arguments);
      if (active() && REVIVE_SK[skId] && skId !== 'sk_resurrection' && player.mp < mp0) setCd();
      return r;
    };
  });

  // 復活卷軸：HP 100%，吸走當前 MP 10%（你與傭兵）
  if (typeof window.reviveInPlace === 'function') {
    var oRIP = window.reviveInPlace;
    window.reviveInPlace = function () {
      var wasDead = player.dead, sc0 = scrollCount(), mp0 = player.mp;
      // 你自己的返生術：只吃技能 ×2，不吃復活倍率
      var rk = DB.skills.sk_resurrection, keep = rk && rk.mp, r;
      if (rk && applied && base && base.sk_resurrection) rk.mp = base.sk_resurrection.mp * 2;
      try { r = oRIP.apply(this, arguments); } finally { if (rk && keep != null) rk.mp = keep; }
      try {
        if (active() && wasDead && !player.dead && scrollCount() < sc0) {
          player.hp = player.mhp; var d = Math.floor((player.mp || 0) * 0.1); player.mp -= d;
          clog('<span class="text-yellow-300">復活卷軸（夢艷）：HP 全滿，代價是吸走 ' + d + ' MP。</span>', 'heal');
          try { updateUI(); } catch (e) {}
        }
      } catch (e) {}
      return r;
    };
  }
  if (typeof window._reviveAllyDone === 'function') {
    var oRAD = window._reviveAllyDone;
    window._reviveAllyDone = function (ally, via) {
      var r = oRAD.apply(this, arguments);
      try {
        if (active() && ally && String(via || '').indexOf('復活卷軸') >= 0) {
          ally.curHp = ally.mhp || ally.curHp; var d = Math.floor((ally.mp || 0) * 0.1); ally.mp -= d;
        }
      } catch (e) {}
      return r;
    };
  }

  // ── 三、寵物 MP 恢復吃你的面板 ──
  var petHooked = false;
  var petRegenHook = function () {
    if (petHooked || typeof window.petDerive !== 'function') return;
    petHooked = true;
    var oPD = window.petDerive;
    window.petDerive = function (p) {
      var d = oPD.apply(this, arguments);
      try {
        if (d && p && typeof PET_BOOK !== 'undefined' && PET_BOOK[p.form]) {
          var own = PET_BOOK[p.form].mpReg || 0, mine = Math.floor(Number(player && player.d && player.d.mpR) || 0);
          if (mine > own) d.mpRegBonus = (d.mpRegBonus || 0) + (mine - own);
        }
      } catch (e) {}
      return d;
    };
  };
  petRegenHook(); setTimeout(petRegenHook, 0);


  // ── 反射傷害歸給真正出手的人（玩家 2026-10-22 回報：傭兵打的也全反彈給玩家）──
  //   有些傭兵出手的路徑（借用玩家的施法／觸發函式）呼叫反射時沒帶傭兵 → 一律算到你頭上。
  //   傭兵回合中（核心 _dpsAllyTurn）反射沒指定對象時，改給正在行動的那名傭兵。
  var curAlly = null;
  if (typeof window.processAllyStatusTick === 'function') {
    var oPAS = window.processAllyStatusTick;
    window.processAllyStatusTick = function (ally) { curAlly = ally || null; return oPAS.apply(this, arguments); };
  }
  if (typeof window.reflectWallOnDamage === 'function') {
    var oRWD = window.reflectWallOnDamage;
    window.reflectWallOnDamage = function (mob, dmg, kind, ally) {
      try {
        if (!ally && curAlly && !curAlly._downed && typeof _dpsAllyTurn !== 'undefined' && _dpsAllyTurn) {
          var a = Array.prototype.slice.call(arguments); a[3] = curAlly; return oRWD.apply(this, a);
        }
      } catch (e) {}
      return oRWD.apply(this, arguments);
    };
  }

  console.log('[AFK-dreamcost] 已啟用：夢艷地獄死亡詛咒、轉生夢艷技能與復活代價、寵物 MP 恢復吃玩家面板');
})();
