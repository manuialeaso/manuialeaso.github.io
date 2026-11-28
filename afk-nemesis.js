/* afk-nemesis.js — 遺物「涅默西斯的符石劍」（Ping 11-15 15:20／15:23）
 *   單手劍，大小傷 18／33；所有能拿單手劍的職業都能用。掉落：次元裂縫「四龍副本・裂縫」通關時擲一次 1%。
 *   攻擊特殊功能（每階都有）：對龍系傷害 +50%；目標身上有四屬性弱點時再 +15%。
 *   符石爆裂：一般攻擊命中時 5／8／10／15／20% 機率，（力量＋智力）×2／3／4／5／6 魔法傷害（無屬性）。
 *   +10 起封印鎖鏈：被符石炸到的目標 3 秒內受到的傷害 +10%。
 *   昇華支配：泰坦覺醒，每 30 秒下一次命中的一般攻擊傷害 ×3；昇華支配 +5：每 20 秒、×5，並同時打到其他所有敵人。
 *   魔劍士拿：上面所有數值 ×1.15（冷卻秒數不變）。
 * ========================================================================== */
(function (W) {
  'use strict';
  if (typeof DB === 'undefined' || !DB.items) return;
  var KEY = 'relic_nemesis_runesword', NAME = '涅默西斯的符石劍';
  var N = function (x) { return Number(x) || 0; };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var tk = function () { try { return N(state.ticks); } catch (e) { return 0; } };
  var G = function () { return W.LineageGrowth; };
  var C = function () { return W.AFK_CARD_COMBAT; };
  var log = function (h) { try { if (typeof logCombat === 'function' && !(typeof state !== 'undefined' && state.ff)) logCombat(h, 'player-special'); } catch (e) {} };
  var tag = function (t, c) { return '<span class="font-bold" style="color:' + c + '">【' + t + '】</span>'; };
  var STAGE_N = ['本體', '+5', '+10', '昇華支配', '昇華支配 +5'];
  var BURST_P = [5, 8, 10, 15, 20], BURST_K = [2, 3, 4, 5, 6];
  var tier = function (n, a) { return a != null ? (a >= 5 ? 4 : 3) : n >= 10 ? 2 : n >= 5 ? 1 : 0; };
  var LORE = '封印在古代兵器駐紮地的泰坦之劍，劍身的符石還在等待甦醒。單手劍。';
  var fxText = function (s) {
    var t = ['對龍系怪物造成的傷害 +50%；目標身上有火、水、風、地屬性弱點時再 +15%',
      '符石爆裂：一般攻擊命中時 ' + BURST_P[s] + '% 機率，對目標造成（力量＋智力）×' + BURST_K[s] + ' 的魔法傷害（無屬性）'];
    if (s >= 2) t.push('封印鎖鏈：被符石炸到的目標 3 秒內受到的傷害 +10%');
    if (s === 3) t.push('泰坦覺醒：每 30 秒一次，下一次命中的一般攻擊傷害 ×3');
    if (s === 4) t.push('泰坦覺醒：每 20 秒一次，下一次命中的一般攻擊傷害 ×5，並同時打到其他所有敵人');
    t.push('魔劍士使用時，以上數值 ×1.15');
    return t.join('；');
  };
  var base = { n: NAME, type: 'wpn', relic: true, noEnhance: true, dmgS: 18, dmgL: 33, hit: 12, dmgBonus: 14, req: 'royal,knight,elf,mage,dark,dragon', p: 10000, gachaWeight: 0,
    nemesisSword: true, noRiftRelic: true, img: 'assets/icons/newzones/涅默西斯的符石劍.webp', d: '【遺物】' + LORE + ' 〔' + STAGE_N[0] + '〕' + fxText(0) + '。' };
  if (!DB.items[KEY]) DB.items[KEY] = base;
  try { if (typeof WEAPON_TAGS !== 'undefined' && !WEAPON_TAGS[KEY]) WEAPON_TAGS[KEY] = ['單手劍']; } catch (e) {}
  try {
    if (typeof RELIC_CAT_ITEMS !== 'undefined' && typeof equipCatKey === 'function') { var ck = equipCatKey(KEY, DB.items[KEY]); if (ck && RELIC_CAT_ITEMS[ck] && RELIC_CAT_ITEMS[ck].indexOf(KEY) < 0) { RELIC_CAT_ITEMS[ck].push(KEY); RELIC_ITEM_CAT[KEY] = ck; } }
  } catch (e) {}

  // 合成／昇華後的說明
  var hookTier = function () {
    var o = W.__afkRelicTier; if (typeof o !== 'function' || o.__afkNemesis) return false;
    var f = function (d, b, n, asc) { var r = o.apply(this, arguments); try { if (d && b && b.nemesisSword) { var s = tier(N(n), asc); d.nemesisSword = true; d.d = '【遺物】' + LORE + ' 〔' + STAGE_N[s] + '〕' + fxText(s) + '。'; } } catch (e) {} return r; };
    f.__afkNemesis = true; W.__afkRelicTier = f; return true;
  };
  if (!hookTier()) W.addEventListener('load', hookTier);

  // 誰拿著、第幾階、魔劍士倍率
  var stageOf = function (e) {
    try { var w = e && e.eq && e.eq.wpn, d = w && DB.items[w.id]; if (!d || !d.nemesisSword) return -1; return tier(N(d.relicPlus), d.relicAsc != null ? N(d.relicAsc) : null); } catch (er) { return -1; }
  };
  var rk = function (e) { return e && e.cls === 'runeblade' ? 1.15 : 1; };
  var LB = function () { return W.LineageBloodline; };
  var DRAGON4 = /安塔瑞斯|法利昂|林德拜爾|巴拉卡斯/;
  var isDragon = function (m) { try { if (LB() && LB().isDragon) return LB().isDragon(m); } catch (e) {} return !!(m && (DRAGON4.test(m.n || '') || /^(龍|飛龍|龍龜)$/.test(m.race || ''))); };
  var WEAK = ['fireVulnerability', 'waterVulnerability', 'windVulnerability', 'earthVulnerability'];
  var hasWeak = function (m) { try { if (LB() && LB().hasWeak) return LB().hasWeak(m); var api = W.AFK_RELIC_RUNTIME && W.AFK_RELIC_RUNTIME.api; return !!(m && api && api.hasStatus && WEAK.some(function (k) { return api.hasStatus(m, k); })); } catch (e) { return false; } };
  var inParty = function (e) { var p = P(); return !!(e && p && (e === p || (p.allies || []).indexOf(e) >= 0)); };
  var SEAL = new WeakMap();   // 目標 → { until, k }

  // 龍系、屬性弱點、封印鎖鏈：造成的傷害
  var hookDmg = function () {
    var c = C(); if (!c || typeof c.damage !== 'function' || c.__afkNemesis) return; var o = c.damage;
    c.damage = function (actor, target, amount, opt) {
      var r = o.apply(this, arguments);
      try {
        if (r > 0 && target && inParty(actor)) {
          var s = stageOf(actor), m = 1;
          if (s >= 0) { var k = rk(actor); if (isDragon(target)) m += 0.5 * k; if (hasWeak(target)) m += 0.15 * k; }
          var sl = SEAL.get(target); if (sl && sl.until > tk()) m += 0.10 * sl.k;
          if (m !== 1) r = Math.floor(r * m);
        }
      } catch (e) {}
      return r;
    };
    c.__afkNemesis = true;
  };
  hookDmg(); W.addEventListener('load', hookDmg);

  // 符石爆裂、泰坦覺醒：一般攻擊命中
  var TITAN = new WeakMap(), busy = false;
  var foes = function () { try { return (mapState.mobs || []).filter(function (m) { return m && !m._dead && m.curHp > 0 && !m._isAlly && !m._allyName && m.race !== '建築'; }); } catch (e) { return []; } };
  var hookEv = function () {
    var g = G(); if (!g || typeof g.event !== 'function' || g.__afkNemesis) return; var o = g.event;
    g.event = function (name, c) {
      var a = c && c.actor, s = -1, normal = false, k = 1;
      try {
        normal = c && c.target && !c.generated && ['normal', 'auto'].indexOf(c.origin || 'normal') >= 0;
        s = (name === 'beforeHit' || name === 'afterHit') && normal && inParty(a) ? stageOf(a) : -1; k = rk(a);
        // 泰坦覺醒：冷卻好了 → 這一下傷害 ×3／×5
        if (name === 'beforeHit' && s >= 3 && !busy) {
          var ts = TITAN.get(a) || { next: 0 }; TITAN.set(a, ts);
          if (tk() >= ts.next) { var mult = (s === 4 ? 5 : 3) * k; ts.next = tk() + (s === 4 ? 200 : 300); ts.fire = { mult: mult, aoe: s === 4 }; c.damage = N(c.damage) * mult; }
        }
      } catch (e) {}
      var r = o.apply(this, arguments);
      try {
        if (name === 'afterHit' && s >= 0 && !busy && N(c.damage) > 0) {
          busy = true;
          try {
            var ts2 = TITAN.get(a);
            if (ts2 && ts2.fire) {
              var f = ts2.fire; ts2.fire = null;
              if (f.aoe) foes().forEach(function (m) { if (m !== c.target) g.secondaryHit(a, m, Math.floor(N(c.damage)), 'phys'); });
              log(tag('泰坦覺醒', '#fbbf24') + (a === P() ? '你' : (a._allyName || '隊友')) + '的符石劍甦醒——傷害 ×' + (Math.round(f.mult * 100) / 100) + (f.aoe ? '，震碎周圍所有敵人' : '') + '！');
            }
            if (Math.random() * 100 < BURST_P[s] * k && c.target.curHp > 0 && !c.target._dead) {
              var d = a.d || {}, v = (N(d.str) + N(d.int)) * BURST_K[s] * k;
              if (v > 0) g.secondaryHit(a, c.target, Math.floor(v), 'magic');
              if (s >= 2) SEAL.set(c.target, { until: tk() + 30, k: k });
            }
          } finally { busy = false; }
        }
      } catch (e) { busy = false; }
      return r;
    };
    g.__afkNemesis = true;
  };
  hookEv(); W.addEventListener('load', hookEv);

  // 掉落：四龍副本・裂縫通關時擲一次 1%
  var hookDrop = function () {
    var R = W.__afkRiftDg, d = R && R.BYID && R.BYID.dragons; if (!d || typeof d.reward !== 'function' || d.reward.__afkNemesis) return !!d;
    var o = d.reward;
    // 11-28 Ping：符石劍比照頭目遺物——拿到時必定帶遠古系詞條（遠古／永恆／不朽／太初）＋屬性五階（火水風地）。
    //   夢域鏡的遺物詞條只套用在打怪掉落；這把是通關結算直接給的，原本走不到詞條判定，拿到的都是白板。已拿到的不補。
    var R = function (k) { try { return typeof lootRng === 'function' ? lootRng(k) : Math.random(); } catch (e) { return Math.random(); } };
    var grant = function () {
      var ANC = [true, 'eternal', 'immortal', 'primordial'], ELE = ['fr', 'wa', 'wi', 'ea'];
      var oA = W.__afkRelicAffix;
      W.__afkRelicAffix = function (d, id) {
        if (id === KEY) return { bless: false, anc: ANC[Math.min(3, Math.floor(R('nemanc') * 4))], attr: ELE[Math.min(3, Math.floor(R('nemattr') * 4))] + '5' };
        return typeof oA === 'function' ? oA.apply(this, arguments) : null;
      };
      try { gainItem(KEY, 1, true, false); } finally { if (oA === undefined) delete W.__afkRelicAffix; else W.__afkRelicAffix = oA; }
    };
    var f = function () { var got = o.apply(this, arguments) || []; try { if (Math.random() < 0.01 && typeof gainItem === 'function') { grant(); got = got.concat([NAME]); } } catch (e) {} return got; };
    f.__afkNemesis = true; d.reward = f; return true;
  };
  if (!hookDrop()) W.addEventListener('load', hookDrop);

  var dexReg = function () { var X = W.AFK_DEX_EXTRA; if (X && X.acq && !X.acquire[KEY]) X.acq(KEY, '次元裂縫「四龍副本・裂縫」：通關時偶爾出現（每次通關只有一次機會）。'); };
  if (document.readyState === 'complete') setTimeout(dexReg, 0); else W.addEventListener('load', dexReg);
  W.__afkNemesis = { KEY: KEY, stageOf: stageOf, fxText: fxText };
})(window);
