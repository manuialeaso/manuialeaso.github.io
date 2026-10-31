/* ==========================================================================
 * afk-castle-guards.js — 七城護衛與亞丁「聖十字近衛」（玩家 2026-10-24 指定）
 *
 * 2026-10-26 改：持有的每座城各自一種部隊、可以混著上場（最多 5 種），全部合計上限＝盟主魅力 ÷ 15（最多 4 名）；
 *   七城統一後可改帶聖十字近衛（上限 3 名）或 1 名聖十字禁衛軍——只有禁衛軍有聖十字之盾；帶近衛／禁衛軍時不帶其他城堡護衛。
 * 1. 持有幾座城就能招幾座城的部隊：原本只認「主城」（最近打下的那座），現在改認血盟持有的全部城堡
 *    （afk-castlewar 的 held 清單）。任一座城的護衛隊長都能切換到其他持有城的部隊來招募。
 * 2. 四座新城各有自己的部隊（借用現有八方向圖）：
 *      奇岩城＝黃金之鷹（黃金龍圖）｜妖魔堡＝妖魔傭兵（妖魔巡守圖）｜侏儒城＝鐵斧護衛（巨大牛人圖）｜亞丁城＝亞丁白虎衛（真‧虎男圖）
 * 3. 統一七城後，亞丁城可招「聖十字近衛」：能力＝七支部隊相加（HP、DPS、AC、魔防、減傷相加，命中取最高），
 *    另有 5% 迴避、5% 魔法抗性；不受盟主魅力限制，最多 8 名。
 *    2026-10-26 玩家指定：聖十字近衛一名＝七座城各一名守衛的數值合併成一隻；
 *    「聖十字禁衛軍」＝這樣的一隻再 ×3（湊滿 3 名近衛融合）：HP、傷害、減傷、抗性、AC、魔防、迴避 ×3，
 *    上限：魔防 1000、AC −200（禁衛軍是給新手減傷、增加團隊傷害用的，AC 鎖在 −200）、迴避 80%、抗性 90%。
 *    融合體專屬「聖十字之盾」：你（玩家）受到的傷害優先由融合體承擔，融合體承受的量 ×2（本來 50 → 融合體扣 100）；
 *    融合體倒下時多出來的部分才由你承受；倒下 30 秒後自動歸隊。
 * 4. 城池會一直留在手上，所以「宣戰其他城堡」不再遣散護衛；只有失去該部隊所屬的城才會失效。
 * 只覆寫 js/31 的全域函式，不動核心檔。
 * ========================================================================== */
(function () {
  'use strict';
  if (typeof CASTLE_GUARD_BOOK === 'undefined' || typeof window.castleGuardSync !== 'function' || typeof window.guardDerive !== 'function') { console.warn('[AFK-castle-guards] 找不到城堡護衛系統，略過'); return; }

  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var CW = function () { return window.__afkCastleWar || null; };
  var held = function () {
    try { var c = CW(); if (c && c.held) return c.held(); } catch (e) {}
    var m = null; try { m = clanGetCastleCity(P()); } catch (e) {}
    return m ? [m] : [];
  };
  var unified = function () { return held().length >= 7; };
  var ELITE_MAX = 8, FUSE_N = 3;   // 玩家 2026-10-26：七城合併的一隻 ×3＝聖十字禁衛軍
  var CAP = { mr: 1000, ac: -200, acFused: -200, eva: 0.80, res: 0.90 };
  var BASE_KEYS = ['kent', 'windwood', 'heine', 'giran', 'orc_fortress', 'dwarf_castle', 'aden'];

  // ── 部隊規格 ──
  var orig = { kent: 1, windwood: 1, heine: 1 };
  CASTLE_GUARD_BOOK.kent.gfx = '藍色鯊魚'; CASTLE_GUARD_BOOK.windwood.gfx = '暴風之刃'; CASTLE_GUARD_BOOK.heine.gfx = '毒蛇之牙';
  CASTLE_GUARD_BOOK.kent.captain = '肯特守衛隊長'; CASTLE_GUARD_BOOK.windwood.captain = '風木傭兵隊長'; CASTLE_GUARD_BOOK.heine.captain = '海音神官隊長'; CASTLE_GUARD_BOOK.heine.d = '海音神官隊長麾下的毒蛇之牙部隊：攻守均衡（魔法防禦與迴避兼具），神官出身，戰鬥中每 5 秒替 HP 最低的隊友施放治癒（最大 HP 8%）。';
  Object.assign(CASTLE_GUARD_BOOK, {
    giran: { form: '黃金之鷹', gfx: '黃金龍', city: 'giran', label: '奇岩', captain: '奇岩騎士團長',
      hpPerLv: 11, dpsRatio: 0.65, aspdSec: 0.6, hitBonus: 36, acBase: -12, acLvDiv: 4, mrBase: 20, mrLvDiv: 3, aggroWeight: 3, threat: 2,
      d: '奇岩騎士團長麾下的黃金之鷹：振翼掠過戰場的游擊手，出手精準、命中最高。' },
    orc_fortress: { form: '妖魔傭兵', gfx: '妖魔巡守', city: 'orc_fortress', label: '妖魔堡', captain: '妖魔堡督軍',
      hpPerLv: 18, dpsRatio: 0.45, aspdSec: 1.1, hitBonus: 28, acBase: -8, acLvDiv: 4, mrBase: 10, mrLvDiv: 5, aggroWeight: 6, threat: 6,
      d: '妖魔堡督軍以金幣買來的妖魔傭兵：皮糙肉厚、最會吸引仇恨的肉盾。' },
    dwarf_castle: { form: '鐵斧護衛', gfx: '巨大牛人', city: 'dwarf_castle', label: '侏儒城', captain: '侏儒城鐵衛長',
      hpPerLv: 15, dpsRatio: 0.55, aspdSec: 0.9, hitBonus: 30, acBase: -18, acLvDiv: 3, mrBase: 12, mrLvDiv: 4, aggroWeight: 5, threat: 4,
      d: '侏儒城鐵衛長親手鍛造重甲的鐵斧護衛：AC 最硬的重裝前排。' },
    aden: { form: '亞丁白虎衛', gfx: '真‧虎男', city: 'aden', label: '亞丁', captain: '亞丁禁衛長',
      hpPerLv: 14, dpsRatio: 0.65, aspdSec: 0.8, hitBonus: 34, acBase: -14, acLvDiv: 4, mrBase: 25, mrLvDiv: 3, aggroWeight: 4, threat: 3,
      d: '亞丁禁衛長豢養的白虎衛：王都的精銳，攻守與魔防都屬上乘。' },
    aden_elite: { form: '聖十字近衛', gfx: '毒蛇之牙', city: 'aden_elite', home: 'aden', label: '亞丁', captain: '亞丁禁衛長', elite: true,
      hpPerLv: 0, dpsRatio: 0, aspdSec: 0.5, hitBonus: 0, acBase: 0, acLvDiv: 4, mrBase: 0, mrLvDiv: 4, aggroWeight: 6, threat: 6,
      d: '七城旗幟同時升起之日，亞丁王座下的聖十字近衛才肯向一位君主屈膝。七支部隊的武藝集於一身。' },
    aden_fused: { form: '聖十字禁衛軍', gfx: '毒蛇之牙', city: 'aden_elite', home: 'aden', label: '亞丁', captain: '亞丁禁衛長', elite: true, fused: true,
      hpPerLv: 0, dpsRatio: 0, aspdSec: 0.5, hitBonus: 0, acBase: 0, acLvDiv: 4, mrBase: 0, mrLvDiv: 4, aggroWeight: 10, threat: 10,
      d: '三名近衛以聖十字之誓合為一體——七城的武藝再疊三重，成為聖十字禁衛軍；它會擋在君主身前，替你承受一切傷害（承受的量加倍），每 5 秒以聖十字之光讓全隊恢復最大 HP 5%。' }
  });
  BASE_KEYS.forEach(function (k) { CASTLE_GUARD_BOOK.aden_elite.hpPerLv += CASTLE_GUARD_BOOK[k].hpPerLv; });
  CASTLE_GUARD_BOOK.aden_fused.hpPerLv = CASTLE_GUARD_BOOK.aden_elite.hpPerLv * FUSE_N;

  var specOfRoster = function (r) {
    if (!r) return null;
    if (r.city === 'aden_elite') return r.fused ? CASTLE_GUARD_BOOK.aden_fused : CASTLE_GUARD_BOOK.aden_elite;
    return CASTLE_GUARD_BOOK[r.city] || null;
  };
  var homeOf = function (spec) { return spec.home || spec.city; };

  // ── 數值：近衛＝七支部隊各一名合併；禁衛軍再 ×3（碰上限為止）──
  var oDerive = window.guardDerive;
  var eliteDerive = function (lv, fused) {
    var dps = 0, ac = 0, mr = 0, dr = 0, hit = 0;
    BASE_KEYS.forEach(function (k) {
      var sp = CASTLE_GUARD_BOOK[k], d = oDerive({ form: sp.form, lv: lv });
      dps += (d.flat + (d.dice + 1) / 2) / sp.aspdSec;
      ac += d.ac; mr += d.mr; dr += d.dr; hit = Math.max(hit, d.hit);
    });
    var m = fused ? FUSE_N : 1, perHit = dps * 0.5 * m;
    var flat = Math.max(0, Math.round(perHit * 0.55)), dice = Math.max(1, Math.round((perHit - flat) * 2));
    return {
      flat: flat, dice: dice, aspd: 5, hit: hit,
      ac: Math.max(fused ? CAP.acFused : CAP.ac, ac * m), dr: dr * m, mr: Math.min(CAP.mr, mr * m),
      eva: Math.min(CAP.eva, 0.05 * m), res: Math.min(CAP.res, 0.05 * m),
      aggroWeight: fused ? 10 : 6
    };
  };
  window.guardDerive = function (g) {
    var sp = g && _guardSpecForForm(g.form);
    if (sp && sp.elite) return eliteDerive(Math.max(1, g.lv || 1), !!sp.fused);
    return oDerive.apply(this, arguments);
  };
  var hpOf = function (spec, lv) { return spec.hpPerLv * Math.max(1, lv); };

  // 沒有血盟（或讀不到盟主）時，你自己就是城主：攜帶上限改看你自己的魅力（玩家 2026-10-24：沒血盟招不到、看不到護衛）
  var oCap = window.castleGuardCapacity, oCha = window.castleGuardLeaderCha;
  // 2026-11-01（謀叛者的低語實測）：盟主魅力每次都要找盟主＝把 16 個存檔位全部解壓掃一遍（核心只快取 3 秒），
  //   護衛每拍都會問上限 → 4 分鐘掃 134 次。盟主魅力不太會變，記 30 秒（換角色、換模式就重問）。
  var chaCache = null;
  window.castleGuardLeaderCha = function () {
    var p0 = P(), key = p0 ? (currentSlot + ':' + (typeof clanModeKey === 'function' ? clanModeKey(p0) : '')) : '', now = Date.now();
    if (chaCache && chaCache.key === key && now - chaCache.t < 30000) return chaCache.v;
    var v0 = chaLive.apply(this, arguments); chaCache = { key: key, t: now, v: v0 }; return v0;
  };
  var chaLive = function () {
    var v = 0; try { v = typeof oCha === 'function' ? oCha.apply(this, arguments) : 0; } catch (e) { v = 0; }
    if (v > 0) return v;
    var p = P(); if (!p) return 0;
    return Math.max(0, Math.floor((p.d && Number(p.d.cha)) || Number(p.cha) || 0));
  };
  window.castleGuardCapacity = function () {
    return Math.max(0, Math.min(CASTLE_GUARD_MAX, Math.floor(castleGuardLeaderCha() / 15)));
  };

  // ── 名冊（2026-10-26 改）：每座持有的城各自一種部隊，可以混著上場（最多 5 種）；總數上限＝盟主魅力 ÷ 15（最多 4 名）
  //   七城統一後可改帶聖十字近衛（上限 3 名）或聖十字禁衛軍（只有 1 名；只有禁衛軍有聖十字之盾）——帶近衛／禁衛軍時不帶其他城堡護衛
  var MAX_TYPES = 5;
  var squadsOf = function (info) {   // [{key, count, at}]，依招募先後
    var out = [], q = info && info.squads || {};
    Object.keys(q).forEach(function (k) { var x = q[k]; if (x && CASTLE_GUARD_BOOK[k] && !CASTLE_GUARD_BOOK[k].elite && (x.count || 0) > 0) out.push({ key: k, count: x.count, at: x.at || 0 }); });
    return out.sort(function (a, b) { return a.at - b.at; });
  };
  var activeSquads = function () {
    var p = P(); if (!p) return [];
    var info = rosterInfo(p), h = held(), cap = castleGuardCapacity(), out = [];
    var e = info && info.elite;
    if (e && unified() && ((e.count || 0) > 0 || e.fused)) return [e.fused ? { spec: CASTLE_GUARD_BOOK.aden_fused, key: 'aden_fused', count: 1 } : { spec: CASTLE_GUARD_BOOK.aden_elite, key: 'aden_elite', count: Math.max(1, Math.min(FUSE_N, e.count || 0)) }];
    var left = cap;
    squadsOf(info).forEach(function (x) { if (out.length < MAX_TYPES && left > 0 && h.indexOf(x.key) >= 0) { var c = Math.min(left, x.count); left -= c; out.push({ spec: CASTLE_GUARD_BOOK[x.key], key: x.key, count: c }); } });
    return out.filter(function (x) { return x.count > 0; });
  };
  window.castleGuardRosterActive = function () {
    var a = activeSquads(); if (!a.length) return null;
    return { city: a[0].spec.city, count: a.reduce(function (n, x) { return n + x.count; }, 0), multi: a.map(function (x) { return x.key + ':' + x.count; }).join(',') };
  };
  var followOf = function () { return activeSquads().reduce(function (n, x) { return n + x.count; }, 0); };
  window.castleGuardFollowCount = function () { return followOf(); };

  window.castleGuardSync = function (force) {
    var p = P(); if (!p) return;
    var want = activeSquads(), lvNow = Math.max(1, p.lv || 1), old = p.guardsV2 || [], next = [], changed = false;
    want.forEach(function (x) {
      var sp = x.spec, mine = old.filter(function (g) { return g && g.form === sp.form; });
      for (var i = 0; i < x.count; i++) {
        var g = mine[i];
        if (!g) { var mhp = hpOf(sp, lvNow); g = { uid: (sp.fused ? 'adenfu_' : (sp.elite ? 'adenel_' : '')) + uid(), form: sp.form, formGfx: sp.gfx, city: sp.city, lv: lvNow, hp: mhp, mhp: mhp, _atkCd: 5 + next.length * 3 }; changed = true; }
        g.lv = lvNow; g.formGfx = sp.gfx;
        var mx = hpOf(sp, g.lv); if (g.mhp !== mx) { var ratio = g.mhp ? g.hp / g.mhp : 1; g.mhp = mx; if (!g._downed) g.hp = Math.max(1, Math.round(mx * ratio)); }
        next.push(g);
      }
    });
    if (next.length !== old.length || next.some(function (g, i) { return g !== old[i]; })) changed = true;
    p.guardsV2 = next;
    if (changed && force) renderGuardPanel(true);
  };

  // 核心在「血盟城堡歸屬」重算時，只要名冊城市 ≠ 血盟那一座城就清空護衛（舊版一個血盟只有一座城）。
  //   七城攻城後持有多座城、或沒有血盟時，這會讓剛招來的護衛立刻消失（玩家 2026-10-24：對話顯示招募了，實際沒出現）。
  //   改成：名冊仍有效（castleGuardRosterActive 已檢查持有城池）就保留。
  if (typeof window._castleOwnerApply === 'function') {
    var oOwner = window._castleOwnerApply;
    window._castleOwnerApply = function (city) {
      var p = P(), keep = p && p.guardsV2 && p.guardsV2.length && castleGuardRosterActive() ? p.guardsV2 : null;
      var r = oOwner.apply(this, arguments);
      if (keep && p && (!p.guardsV2 || !p.guardsV2.length)) p.guardsV2 = keep;
      return r;
    };
  }

  // ── 融合體專屬：聖十字之盾（玩家 2026-10-24）──
  //   你受到的傷害優先由融合體承擔，融合體承受 ×2；融合體倒下時，剩下沒擋住的部分才由你承受。
  var shaken = function (g) { try { return !!(typeof window.__afkGuardShaken === 'function' && window.__afkGuardShaken(g)); } catch (e) { return false; } };   // 隱藏規則「撼動」（afk-hidden）
  var coverGuard = function () {
    var p = P(); if (!p || p.dead) return null;
    var list = p.guardsV2 || [];
    for (var i = 0; i < list.length; i++) { var g = list[i]; if (g && !g._downed && (g.hp || 0) > 0 && g.form === CASTLE_GUARD_BOOK.aden_fused.form && !shaken(g)) return g; }
    return null;
  };
  // 玩家 2026-10-25：一開始只包了怪物普攻／魔法／反彈，百分比傷害、持續傷害、夢域代價都還是扣在玩家身上。
  //   改成以「每個遊戲 tick」為單位：tick 前後玩家 HP 的淨損失全部改由融合體承擔（×2），
  //   在所有外掛都載入之後才包在最外層，確保任何來源的傷害都算進去。
  var coverDepth = 0, coverPend = false, oKillCover = null, DRAIN_THROUGH = 0.5;
  var coverSettle = function (h0) {
    var p = P(), g = coverGuard(); if (!p || !g) return;
    var lost = Math.min(h0, p.mhp || h0) - (p.hp || 0); if (!(lost > 0)) return;   // 2026-10-29：最大 HP 下降造成的「夾回上限」不算受傷（不讓禁衛軍白白代扣）
    // 2026-10-31 12:53：夢域鏡「副本侵蝕」只擋一半——這一拍侵蝕扣你的量有 50% 直接扣在你身上，其餘才由融合體承擔
    var dr = Number(window.__afkDrainHit) || 0, through = 0; window.__afkDrainHit = 0;
    if (dr > 0) { through = Math.min(lost, Math.ceil(dr * DRAIN_THROUGH)); lost -= through; }
    if (!(lost > 0)) { p.hp = h0 - through; return; }
    var take = lost * 2, left = 0;
    if (take >= g.hp) { left = Math.ceil((take - g.hp) / 2); g.hp = 0; try { _guardDown(g); } catch (e) { g._downed = true; g._reviveAt = Date.now() + 30000; } }
    else g.hp -= take;
    p.hp = h0 - left - through;
    try { renderGuardPanel(); } catch (e) {}
  };
  var coverRun = function (o, self, args) {
    var p = P();
    if (coverDepth > 0 || !p || p.dead || !coverGuard()) return o.apply(self, args);
    var h0 = p.hp || 0, r; coverDepth++; coverPend = false; window.__afkDrainHit = 0;
    try { r = o.apply(self, args); }
    finally {
      coverDepth--;
      try { coverSettle(h0); } catch (e) {}
      if (coverPend) { coverPend = false; if ((p.hp || 0) <= 0 && !p.dead && oKillCover) oKillCover(); }
    }
    return r;
  };
  var installCover = function () {
    if (window.__afkGuardCoverOn) return; window.__afkGuardCoverOn = true;
    ['tick', 'useItem'].forEach(function (name) {
      var o = window[name]; if (typeof o !== 'function') return;
      window[name] = function () { return coverRun(o, this, arguments); };
    });
    oKillCover = window.killPlayer;
    if (typeof oKillCover === 'function') window.killPlayer = function () {
      if (coverDepth > 0 && coverGuard()) { coverPend = true; return; }
      return oKillCover.apply(this, arguments);
    };
    // ── 禁衛軍代死（玩家 2026-10-30 20:43）：你受到致命傷害時，一名亞丁禁衛軍（聖十字近衛／禁衛軍）代替你倒下一次；
    //    禁衛軍都已倒下就沒有效果。你的 HP 回到這一拍開始時的量（至少 1）。聖十字之盾還在擋時先讓它擋。
    var lastHp = 0, oTickHp = window.tick;
    if (typeof oTickHp === 'function') window.tick = function () { var p = P(); if (p && !p.dead) lastHp = p.hp || 0; return oTickHp.apply(this, arguments); };
    var oKillSac = window.killPlayer;
    if (typeof oKillSac === 'function') window.killPlayer = function () {
      try {
        var p = P();
        if (p && !p.dead && (p.hp || 0) <= 0 && !(coverDepth > 0 && coverGuard()) && !window.__afkForceDeath) {   // __afkForceDeath：劇情必死（暗夢星迴 15 分鐘自爆）不代死
          var g = (p.guardsV2 || []).filter(function (x) { return x && x.city === 'aden_elite' && !x._downed && (x.hp || 0) > 0 && !shaken(x); }).sort(function (a, b) { return (b.hp || 0) - (a.hp || 0); })[0];
          if (g) {
            g.hp = 0; try { _guardDown(g); } catch (e) { g._downed = true; g._reviveAt = Date.now() + 30000; }
            p.hp = Math.max(1, Math.min(p.mhp || 1, lastHp > 0 ? lastHp : Math.floor((p.mhp || 1) * 0.3)));
            try { logCombat('<span class="font-bold" style="color:#fcd34d">【禁衛軍代死】</span>' + g.form + ' 撲上來替你擋下了致命一擊，倒了下去。', 'magic', 'summon'); } catch (e) {}
            try { renderGuardPanel(true); updateUI(); } catch (e) {}
            return;
          }
        }
      } catch (e) {}
      return oKillSac.apply(this, arguments);
    };
  };
  if (document.readyState === 'complete') setTimeout(installCover, 0); else window.addEventListener('load', function () { setTimeout(installCover, 0); });

  // 宣戰其他城堡不再遣散（城池會留著）
  window.castleGuardsOnSiegeDeclared = function () {};

  // ── 迴避／抗性（只有近衛有）──
  var oEnemyAtk = window.enemyAttackGuard;
  if (typeof oEnemyAtk === 'function') window.enemyAttackGuard = function (mob, s) {
    try {
      var d = s && !s._downed && guardDerive(s);
      if (d && d.eva && mob && mob.curHp > 0 && Math.random() < d.eva) {
        if (typeof _mobAnimTrigger === 'function') _mobAnimTrigger(mob, 'attack');
        logCombat('<span class="' + getMobColor(mob.lv) + '">' + mob.n + '</span> 的攻擊被 <span class="text-amber-300">' + s.form + '</span> 以聖十字盾架開了。', 'miss', 'enemy');
        return;
      }
    } catch (e) {}
    return oEnemyAtk.apply(this, arguments);
  };
  var oMobMagic = window.applyMobMagicToGuard;
  if (typeof oMobMagic === 'function') window.applyMobMagicToGuard = function (mob, sk, s) {
    var d = null; try { d = s && guardDerive(s); } catch (e) {}
    if (!d || !d.res) return oMobMagic.apply(this, arguments);
    var had = Object.prototype.hasOwnProperty.call(window, 'teamDmgReduceMult'), t = window.teamDmgReduceMult;
    window.teamDmgReduceMult = function () { return (typeof t === 'function' ? t.apply(this, arguments) : 1) * (1 - d.res); };
    try { return oMobMagic.apply(this, arguments); } finally { if (had) window.teamDmgReduceMult = t; else delete window.teamDmgReduceMult; }
  };

  // ── 招募 ──
  var LKEY = 'afk_castle_guards_v1';
  var modeOf = function () { try { return (typeof clanModeKey === 'function') ? clanModeKey(P()) : 'normal'; } catch (e) { return 'normal'; } };
  var localAll = function () { try { return JSON.parse(localStorage.getItem(LKEY) || '{}') || {}; } catch (e) { return {}; } };
  var clanInfo = function (p) { try { return (typeof clanGetModeInfo === 'function') ? clanGetModeInfo(p) : null; } catch (e) { return null; } };
  // 名冊一律存本機（同模式、所有角色共用）。血盟共用狀態的核心整理器只認肯特／風木／海音、最多 4 名，
  //   奇岩以後的部隊、聖十字近衛（8 名、融合）寫進去會被整理掉 → 對話顯示招募成功、實際卻沒有護衛（玩家 2026-10-24）。
  //   舊存檔放在血盟裡的名冊：本機還沒有時照樣讀得到。
  var normInfo = function (info) {
    info = info || {};
    var out = { squads: {}, elite: null };
    if (info.squads && typeof info.squads === 'object') Object.keys(info.squads).forEach(function (k) { var x = info.squads[k]; if (x && CASTLE_GUARD_BOOK[k] && (x.count || 0) > 0) out.squads[k] = { count: Math.floor(x.count), at: x.at || 0 }; });
    if (info.elite && typeof info.elite === 'object') out.elite = { count: Math.max(0, Math.min(FUSE_N, Math.floor(info.elite.count || 0))), fused: !!info.elite.fused };
    var g = info.guards;   // 舊格式：一次只有一種部隊
    if (g && g.city) {
      if (g.city === 'aden_elite') { if (!out.elite) out.elite = { count: g.fused ? FUSE_N : Math.min(FUSE_N, g.count || 0), fused: !!g.fused }; }
      else if (CASTLE_GUARD_BOOK[g.city] && !out.squads[g.city]) out.squads[g.city] = { count: g.count || 0, at: g.hiredAt || 0 };
    }
    return out;
  };
  var rosterInfo = function (p) {
    var all = localAll(), m = modeOf();
    if (Object.prototype.hasOwnProperty.call(all, m)) return normInfo(all[m]);
    var c = clanInfo(p); return normInfo(c && c.guards ? { guards: c.guards } : null);
  };
  var writeRoster = function (fn) {
    var all = localAll(), m = modeOf(), info = JSON.parse(JSON.stringify(rosterInfo(P())));
    var r = fn(info) || {};
    if (r.commit === false) return { ok: false, error: r.error };
    all[m] = info;
    try { localStorage.setItem(LKEY, JSON.stringify(all)); } catch (e) { return { ok: false, error: '名冊寫入失敗。' }; }
    return Object.assign({ ok: true }, r);
  };
  var red = function (t) { logSys('<span class="text-red-400">' + t + '</span>'); };
  var refresh = function (key) { try { saveGame(); } catch (e) {} castleGuardSync(true); try { updateUI(); } catch (e) {} var el = document.getElementById('interaction-content'); if (el && el.dataset.afkGuard) renderCastleGuard(el, key); };
  var canHire = function (spec) {
    if (!held().length) { red('攻城獲勝（擁有城堡）期間才能招募城堡護衛。'); return false; }
    if (held().indexOf(homeOf(spec)) < 0) { red('你的血盟並未持有' + spec.label + '城，無法招募' + spec.form + '。'); return false; }
    if (spec.elite && !unified()) { red('聖十字近衛只向統一七城的君主效忠。'); return false; }
    return true;
  };
  window.hireCastleGuard = function (key, n) {
    var spec = CASTLE_GUARD_BOOK[key]; var p = P();
    if (!spec || !p || spec.fused || !canHire(spec)) return;
    n = Math.max(1, n || 1);
    var info = rosterInfo(p), cost = CASTLE_GUARD_COST * n;
    if (spec.elite) {
      var e = info.elite || { count: 0, fused: false };
      if (e.fused) { red('聖十字禁衛軍已經融合；要改帶近衛請先遣散禁衛軍。'); return; }
      if ((e.count || 0) + n > FUSE_N) { logSys('<span class="text-amber-300">聖十字近衛最多帶 ' + FUSE_N + ' 名。</span>'); return; }
    } else {
      var cap = castleGuardCapacity();
      if (cap <= 0) { red('盟主魅力不足（需魅力 15 以上才能攜帶 1 名護衛）。'); return; }
      var total = squadsOf(info).filter(function (x) { return held().indexOf(x.key) >= 0; }).reduce(function (t, x) { return t + x.count; }, 0);
      if (info.elite) total = 0;   // 帶著近衛／禁衛軍時，改招城堡護衛會取代
      if (!info.squads[key] && squadsOf(info).filter(function (x) { return held().indexOf(x.key) >= 0; }).length >= MAX_TYPES) { red('最多同時帶 ' + MAX_TYPES + ' 種城堡護衛；請先遣散其中一種。'); return; }
      if (total + n > cap) { logSys('<span class="text-amber-300">城堡護衛已達可攜帶上限（全部合計 ' + cap + ' 名）；請先遣散一些再招。</span>'); return; }
    }
    if ((p.gold || 0) < cost) { red('金幣不足，招募 ' + n + ' 名' + spec.form + '需要 ' + cost.toLocaleString() + ' 金幣。'); return; }
    var res = writeRoster(function (i) {
      if (spec.elite) { i.squads = {}; i.elite = { count: ((i.elite && i.elite.count) || 0) + n, fused: false }; return { count: i.elite.count }; }
      i.elite = null;
      var x = i.squads[key] || { count: 0, at: Date.now() }; x.count += n; i.squads[key] = x; return { count: x.count };
    });
    if (!res.ok) { if (res.error) red(res.error); return; }
    p.gold -= cost;
    logSys('<span class="text-emerald-300 font-bold">' + spec.captain + '派出了 ' + n + ' 名' + spec.form + '（現有 ' + res.count + ' 名·' + spec.label + '）。</span>同盟同模式的角色都將獲得其跟隨。');
    refresh(key);
  };
  // 湊滿 3 名近衛並融合成聖十字禁衛軍（已招的近衛也算數，只補差額）
  window.fuseAdenGuards = function () {
    var spec = CASTLE_GUARD_BOOK.aden_elite, p = P();
    if (!p || !canHire(spec)) return;
    var e = rosterInfo(p).elite || { count: 0 };
    if (e.fused) { logSys('<span class="text-amber-300">近衛早已合而為一。</span>'); return; }
    var need = FUSE_N - (e.count || 0), cost = CASTLE_GUARD_COST * Math.max(0, need);
    if ((p.gold || 0) < cost) { red('金幣不足，補滿 ' + FUSE_N + ' 名近衛還需要 ' + cost.toLocaleString() + ' 金幣。'); return; }
    var res = writeRoster(function (i) { i.squads = {}; i.elite = { count: FUSE_N, fused: true }; return {}; });
    if (!res.ok) { if (res.error) red(res.error); return; }
    p.gold -= cost;
    logSys('<span class="text-amber-300 font-bold">三名聖十字近衛舉劍立誓，身影在聖光中重疊——聖十字禁衛軍誕生了。它將以身為盾，替你承受傷害（承受的量 ×2）。</span>');
    refresh('aden_elite');
  };
  window.disbandCastleGuards = function (key) {
    var all = key === '*';
    var res = writeRoster(function (i) {
      if (all) { i.squads = {}; i.elite = null; return {}; }
      if (key === 'aden_elite' || key === 'aden_fused') { if (!i.elite) return { commit: false }; i.elite = null; return {}; }
      if (!i.squads[key]) return { commit: false }; delete i.squads[key]; return {};
    });
    if (res.ok) logSys('<span class="text-slate-300">' + (all ? '護衛們收起兵刃，返回了各自的城堡。' : (CASTLE_GUARD_BOOK[key] ? CASTLE_GUARD_BOOK[key].form : '護衛') + '收起兵刃，返回了城堡。') + '</span>');
    refresh(all ? 'aden_elite' : key);
  };

  // ── 招募視窗：可切換到任何持有城的部隊 ──
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  window.renderCastleGuard = function (div, key) {
    if (!div) return;
    if (typeof _activePanel !== 'undefined') _activePanel = null;
    var spec = CASTLE_GUARD_BOOK[key]; if (!spec || spec.fused) spec = CASTLE_GUARD_BOOK[key = 'aden_elite'];
    div.dataset.afkGuard = key;
    var p = P(), h = held(), uni = h.length >= 7;
    var tabs = BASE_KEYS.concat(['aden_elite']).map(function (k) {
      var sp = CASTLE_GUARD_BOOK[k], own = sp.elite ? uni : h.indexOf(k) >= 0;
      var on = k === key;
      return '<button onclick="renderCastleGuard(document.getElementById(\'interaction-content\'),\'' + k + '\')" class="btn px-2 py-1 text-xs ' + (on ? 'bg-amber-800 border-amber-500 text-amber-100' : own ? '' : 'opacity-50') + '" title="' + (own ? '可招募' : (sp.elite ? '需統一七城' : '未持有此城')) + '">' + (sp.elite ? '✠ 近衛' : sp.label) + '</button>';
    }).join('');
    var info = rosterInfo(p), act = activeSquads();
    var lv = Math.max(1, (p && p.lv) || 1);
    var d = guardDerive({ form: spec.form, lv: lv });
    var line = function (sp, dd) {
      return 'Lv.' + lv + '　HP ' + hpOf(sp, lv).toLocaleString() + '　攻 1D' + dd.dice + '+' + dd.flat + '／' + (dd.aspd / 10) + 's　AC ' + dd.ac + '　魔防 ' + dd.mr + '　減傷 ' + dd.dr
        + (dd.eva ? '　迴避 ' + Math.round(dd.eva * 100) + '%　抗性 ' + Math.round(dd.res * 100) + '%' : '');
    };
    var html = '<div class="flex flex-col gap-2 p-1">'
      + '<div class="flex flex-wrap gap-1">' + tabs + '</div>'
      + '<div class="afk-lore">' + esc(spec.d) + '</div>'
      + '<div class="text-slate-300 text-xs">' + line(spec, d) + '</div>';
    if (spec.elite) {
      var f = CASTLE_GUARD_BOOK.aden_fused, fd = guardDerive({ form: f.form, lv: lv });
      html += '<div class="text-amber-200 text-xs">聖十字禁衛軍：' + line(f, fd) + '</div>'
        + '<div class="text-slate-400 text-xs">需持有七座城。一名聖十字近衛＝七座城各一名守衛合併成一隻，上限 ' + FUSE_N + ' 名；或 ' + FUSE_N + ' 名融合成 1 名「聖十字禁衛軍」（只有 1 名）：HP、傷害、減傷、抗性、AC、魔防、迴避 ×3（上限：魔防 1000、AC −200、迴避 80%、抗性 90%）。'
        + '<b class="text-amber-200">只有禁衛軍有「聖十字之盾」</b>：你受到的傷害改由禁衛軍承擔，承受的量 ×2（本來 50 → 禁衛軍扣 100）；禁衛軍倒下時多出來的部分才算你的。帶近衛或禁衛軍時不能同時帶其他城堡護衛（招募會取代目前的部隊）。</div>';
    } else {
      html += '<div class="text-slate-400 text-xs">持有幾座城就能混帶幾種城堡護衛（最多 ' + MAX_TYPES + ' 種）；全部合計可攜帶＝盟主魅力 ÷ 15（沒有血盟時看你自己的魅力；最多 ' + CASTLE_GUARD_MAX + ' 名·目前 ' + castleGuardCapacity() + ' 名）；每名 ' + (CASTLE_GUARD_COST / 10000) + ' 萬金幣。死亡 30 秒自動歸隊（不耗卷軸）。</div>';
    }
    if (act.length) html += '<div class="bg-slate-800/70 border border-cyan-700 rounded p-2 text-sm flex flex-col gap-1"><div class="flex items-center justify-between gap-2"><span class="text-cyan-300 font-bold">目前上場（' + act.filter(function (x) { return !x.spec.elite; }).length + '／' + MAX_TYPES + ' 種）</span>'
      + '<button onclick="disbandCastleGuards(\'*\')" class="btn px-3 py-1 text-xs bg-red-900 hover:bg-red-800 border-red-600 text-red-200 font-bold">遣散全部</button></div>'
      + act.map(function (x) { return '<div class="flex items-center justify-between gap-2 text-xs"><span>' + x.spec.form + ' ×' + x.count + '（' + x.spec.label + '）</span><button onclick="disbandCastleGuards(\'' + x.key + '\')" class="btn px-2 py-0.5 text-xs bg-slate-700 border-slate-500">遣散</button></div>'; }).join('') + '</div>';
    var ok = spec.elite ? uni : h.indexOf(key) >= 0;
    if (!ok) {
      html += '<div class="bg-slate-800/70 border border-slate-600 rounded p-3 text-sm text-amber-300">' + (spec.elite ? '統一七座城堡後，亞丁禁衛長才會交出聖十字近衛的指揮權（目前 ' + h.length + '/7）。' : '血盟持有【' + spec.label + '城】時才能招募此部隊。') + '</div>';
    } else {
      var gold = (p && p.gold) || 0;
      var btn = function (on, cls, click, text) { return '<button ' + (on ? '' : 'disabled') + ' onclick="' + click + '" class="btn w-full py-2 text-sm font-bold ' + (on ? cls : 'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed') + '">' + text + '</button>'; };
      if (spec.elite) {
        var e = info.elite || { count: 0, fused: false }, ec = e.fused ? 0 : (e.count || 0);
        if (!info.elite && squadsOf(info).length) html += '<div class="text-amber-300 text-xs">招募聖十字近衛會取代目前的城堡護衛。</div>';
        html += btn(!e.fused && ec < FUSE_N && gold >= CASTLE_GUARD_COST, 'bg-emerald-800 hover:bg-emerald-700 border-emerald-600 text-emerald-100', "hireCastleGuard('aden_elite',1)", e.fused ? '已融合成禁衛軍' : ec >= FUSE_N ? '近衛已滿（' + FUSE_N + '）' : '招募 1 名聖十字近衛（' + (CASTLE_GUARD_COST / 10000) + ' 萬金幣；目前 ' + ec + '／' + FUSE_N + '）');
        var fc = Math.max(0, FUSE_N - ec) * CASTLE_GUARD_COST;
        html += btn(!e.fused && gold >= fc, 'bg-amber-800 hover:bg-amber-700 border-amber-500 text-amber-100', 'fuseAdenGuards()', e.fused ? '已融合' : '湊滿 ' + FUSE_N + ' 名並融合成聖十字禁衛軍（' + (fc / 10000) + ' 萬金幣）');
      } else {
        var cap = castleGuardCapacity(), eliteOn = !!(info.elite && uni);
        var tot = eliteOn ? 0 : squadsOf(info).filter(function (x) { return h.indexOf(x.key) >= 0; }).reduce(function (t, x) { return t + x.count; }, 0);
        var types = squadsOf(info).filter(function (x) { return h.indexOf(x.key) >= 0; }).length, full = !eliteOn && !info.squads[key] && types >= MAX_TYPES;
        var dis = cap <= 0 || tot >= cap || gold < CASTLE_GUARD_COST || full;
        if (eliteOn) html += '<div class="text-amber-300 text-xs">招募城堡護衛會取代目前的聖十字近衛／禁衛軍。</div>';
        var lab = cap <= 0 ? '盟主魅力不足' : full ? '已帶滿 ' + MAX_TYPES + ' 種護衛' : tot >= cap ? '已達上限（全部合計 ' + cap + ' 名）' : gold < CASTLE_GUARD_COST ? '金幣不足' : '招募 1 名' + spec.form + '（' + (CASTLE_GUARD_COST / 10000) + ' 萬金幣；目前合計 ' + tot + '／' + cap + '）';
        html += btn(!dis, 'bg-emerald-800 hover:bg-emerald-700 border-emerald-600 text-emerald-100', "hireCastleGuard('" + key + "',1)", lab);
      }
    }
    div.innerHTML = html + '</div>';
  };

  // ── 四座新城的護衛隊長 NPC ──
  var NPC = { npc_giran_guard: 'giran', npc_orc_fortress_guard: 'orc_fortress', npc_dwarf_castle_guard: 'dwarf_castle', npc_aden_guard: 'aden' };
  try {
    Object.keys(NPC).forEach(function (id) {
      var k = NPC[id], sp = CASTLE_GUARD_BOOK[k], town = DB.towns['town_' + k + '_castle'];
      if (!town || town.npcs.some(function (n) { return n.id === id; })) return;
      town.npcs.splice(2, 0, { id: id, n: sp.captain, title: '城堡護衛', type: 'castleguard', d: sp.d + (k === 'aden' ? '統一七城之後，他也替你召集聖十字近衛。' : '') });
    });
  } catch (e) {}
  if (typeof window.interactNPC === 'function') {
    var oNpc = window.interactNPC;
    window.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      if (NPC[npcId]) { try { renderCastleGuard(document.getElementById('interaction-content'), NPC[npcId] === 'aden' && unified() ? 'aden_elite' : NPC[npcId]); } catch (e) {} }
      return r;
    };
  }

  // ── 近衛外觀：金白聖光；融合體比玩家略大 ──
  try {
    var st = document.createElement('style'); st.id = 'afk-castle-guards-css';
    st.textContent = '[data-pet^="adenel_"] .pet-body,[data-pet^="adenfu_"] .pet-body{filter:sepia(.55) saturate(2) hue-rotate(-10deg) brightness(1.18) drop-shadow(0 0 3px rgba(255,214,130,.85))}'
      + '[data-pet^="adenfu_"]{transform:translate(-50%,-100%) scale(.92)!important;transform-origin:50% 100%}'   /* 玩家 2026-10-28：原本 ×1.45 太大，改成比玩家大一點 */;
    document.head.appendChild(st);
  } catch (e) {}

  // ── 補血（玩家 2026-10-28）：海音的毒蛇之牙是神官部隊、聖十字禁衛軍以聖光守護全隊 ──
  //   毒蛇之牙：每 5 秒對隊伍裡 HP 比例最低的一人施放治癒，恢復最大 HP 8%（至少 Lv×10）
  //   聖十字禁衛軍：每 5 秒「聖十字之光」，全隊（你、傭兵、城堡護衛）恢復最大 HP 5%
  var HEAL = { heine: { every: 50, pct: 0.08 }, fused: { every: 50, pct: 0.05 } };
  var healTargets = function () {
    var p = P(), out = [];
    if (!p || p.dead) return out;
    out.push({ o: p, get: function () { return p.hp; }, set: function (v) { p.hp = v; }, max: p.mhp, n: '你' });
    (p.allies || []).forEach(function (a) { if (a && !a._downed && (a.curHp || 0) > 0) out.push({ o: a, get: function () { return a.curHp; }, set: function (v) { a.curHp = v; }, max: a.mhp, n: a._allyName || a.name || '傭兵' }); });
    (p.guardsV2 || []).forEach(function (g) { if (g && !g._downed && (g.hp || 0) > 0) out.push({ o: g, get: function () { return g.hp; }, set: function (v) { g.hp = v; }, max: g.mhp, n: g.form }); });
    return out.filter(function (t) { return t.max > 0; });
  };
  var healOne = function (t, amt) { var h = t.get() || 0; if (h >= t.max) return 0; var v = Math.min(t.max, h + Math.floor(amt)); t.set(v); return v - h; };
  var lastHealLog = 0;
  var guardHeals = function () {
    var p = P(); if (!p || p.dead) return;
    if (typeof _petInWild === 'function' && !_petInWild()) return;
    (p.guardsV2 || []).forEach(function (g) {
      if (!g || g._downed || !((g.hp || 0) > 0) || shaken(g)) return;
      var kind = g.form === '毒蛇之牙' ? 'heine' : (g.form === '聖十字禁衛軍' ? 'fused' : null);
      if (!kind) return;
      g._healCd = (g._healCd == null ? 20 : g._healCd) - 1;
      if (g._healCd > 0) return;
      g._healCd = HEAL[kind].every;
      var ts = healTargets(); if (!ts.length) return;
      var got = 0, who = '';
      if (kind === 'heine') {
        var low = ts.filter(function (t) { return t.get() < t.max; }).sort(function (a, b) { return a.get() / a.max - b.get() / b.max; })[0];
        if (!low) return;
        got = healOne(low, Math.max(low.max * HEAL.heine.pct, (g.lv || 1) * 10)); who = low.n;
      } else {
        ts.forEach(function (t) { got += healOne(t, t.max * HEAL.fused.pct); }); who = '全隊';
      }
      if (got > 0 && Date.now() - lastHealLog > 4000) {
        lastHealLog = Date.now();
        try { logCombat('<span class="text-cyan-300">' + g.form + '</span> ' + (kind === 'heine' ? '施放治癒術，' + who + '恢復了 ' + Math.round(got) + ' 點 HP。' : '舉起聖十字，聖光灑落，全隊共恢復 ' + Math.round(got) + ' 點 HP。'), 'heal', 'summon'); } catch (e) {}
      }
    });
  };
  if (typeof window.castleGuardTick === 'function') {
    var oCGT = window.castleGuardTick;
    window.castleGuardTick = function () { var r = oCGT.apply(this, arguments); try { guardHeals(); } catch (e) {} return r; };
  }

  // 撼動：謀叛者的低語裡亞丁禁衛軍不攻擊
  if (typeof window.guardAttackOnce === 'function') { var oGAO = window.guardAttackOnce; window.guardAttackOnce = function (s) { if (shaken(s)) return; return oGAO.apply(this, arguments); }; }
  window.__afkCastleGuards = { activeSquads: activeSquads, rosterInfo: rosterInfo, coverGuard: function () { return coverGuard(); }, coverSettle: function (h0) { return coverSettle(h0); }, DRAIN_THROUGH: DRAIN_THROUGH, held: held, unified: unified, specOfRoster: specOfRoster, eliteDerive: eliteDerive, followOf: followOf, CAP: CAP };
  try { castleGuardSync(true); } catch (e) {}
  console.log('[AFK-castle-guards] 已啟用：七城護衛、聖十字近衛與融合');
})();
