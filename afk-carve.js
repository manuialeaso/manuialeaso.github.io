/* ============================================================================
 * afk-carve.js — 刻印與印記 第二版（玩家 2026-11-04 04:44 定案；設計稿 docs/engrave-design.md；外掛開關 carve，預設開；經典模式沒有）
 *
 *   NPC：歐瑞村莊 刻印師「邪迪克爾」。舊的「刻印」欄位已改名「遠征徽記」（afk-expedition 的 eq.engrave／afkEngrave），
 *   這裡全部改用 it.afkCarve，不會撞名。
 *
 *   一、孔位：武器（主手）、盔甲、頭盔、手套、長靴、斗篷，每件 1 孔，全身最多 6 個；同一種刻印全身最多算 2 個。
 *       it.afkCarve = { k: 刻印種類, lv: 1～5, dir: null｜'you'｜'kun'｜'mi', s: 0～5（印記等級，0＝還是刻印）}
 *       成長：空孔 → 刻印 Lv1～5（7 種挑一種）→ 選方向升成印記 Lv1～5（尤／鯤／彌）。升級一定成功。
 *   二、7 種刻印（Lv1～5）：血咒、暗棲、蝕毒、井泉、淚晶、記憶、龍煉（KINDS）。
 *       每級：材料 5／10／20／40／80（那種刻印自己的材料）＋金幣 10／20／30／40／50 萬。
 *   三、印記：原本刻印的效果 ×1.5（以 Lv5 為準），再加方向效果（DIRS）。
 *       每級（玩家 11-04 04:44 新表 SEAL_COST）：印記材料 100／200／300／500／800、原本的刻印材料 5000／5000／10000／10000／15000、
 *       龍之鑽石 5000／5000／10000／10000／15000、席琳結晶 10000／10000／15000／15000／20000、夢艷結晶 5000／5000／10000／10000／15000、金幣 1 億。
 *       龍之鑽石直接扣帳號的龍鑽（不走 afk-diacost，那邊會另外收等比例金幣）。
 *       勇氣之證、身體的印記本來是飾品：整件用掉，強化值不算（先用強化值低的）。
 *   四、套裝（6 孔裡同方向的印記孔數，等級不限）：3 格、6 格（SETS）。鯤 6 格另外：受到的異常狀態持續時間 −15%。
 *   五、蝕刻：攻擊技能、攻擊魔法命中時機率（彌之印記相加）讓目標下一次受到的傷害 ×1.5（彌 6 格 ×1.8）；
 *       不分來源都吃、吃掉就消失、同目標 1 層（再觸發只刷新）、最多存在 5 秒。
 *   六、轉移：付金幣把刻印移到同部位的另一件裝備，不會失敗、不掉等級。刻印 Lv × 10 萬；印記 Lv × 10 萬 × 3。
 *   七、取得：DROPS（地圖 key → 材料）。一般怪 0.3%（乘隊伍人數的掉寶倍率），頭目 20%（1～3 個）；
 *       印記材料只有頭目掉：勇氣之證 3%、身體的印記 2%、古代技能書 1%。
 *       兌換：刻印材料 10 個 → 其他種刻印材料 1 個，手續費 1 萬金幣。
 *   材料：背包不夠時用倉庫的（afk-matwh 開著才會；倉庫上鎖的不拿）。
 *   面板：能力分頁「異常狀態抵抗」加上鯤的抵抗；下面多一列「異常狀態持續時間 −N%」（粹煉之魂、上位者的刻印石、鯤 6 格一起算）。
 *   掛點：AFK_CARD_COMBAT.damage（afk-procfx dealt）、__afkTakenMods、afk-procfx taken／tick／kill、recomputeStats、__afkMaxAdd、
 *        castIntervalTicks（施放間隔）、AFK_RELIC_RUNTIME.castCost（MP 消耗）、rollHealingSpell、playerEquipPotionBonusPct、
 *        playerStatusResisted（異常狀態抵抗照核心「相加」的算法補上）、__afkHiddenAoeCd（範圍魔法冷卻長度）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'carve', name: '刻印師 邪迪克爾（刻印與印記）', group: '遊戲內容', seal: true,
    desc: '歐瑞村莊的刻印師邪迪克爾：武器、盔甲、頭盔、手套、長靴、斗篷各刻一個刻印，升到 Lv5 後升成尤／鯤／彌之印記，同方向 3 格、6 格有套裝效果' });
  if (T && !T.enabled('carve')) return;
  var K = W.__afkNpcKit, L = W.__afkLore, X = W.__afkProc;
  if (!K || !L || typeof DB === 'undefined' || !DB.items) { console.warn('[AFK-carve] 需要 afk-npc-kit、afk-lore-kit，略過'); return; }
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var on = function (p) { p = p || P(); return !!(p && !p.classicMode); };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = K.esc;
  var nm = function (id) { return (DB.items[id] || {}).n || id; };
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var f1 = function (n) { if (typeof n === 'string') return n; return (Math.round(Number(n || 0) * 10) / 10).toLocaleString(); };
  var rnd = function () { return api.roll(); };

  // ── 資料 ──
  var KINDS = [
    { k: 'curse', ch: '血咒', mat: 'ttmi_61', v: [4, 5, 6, 7, 8], d: function (a) { return '一般攻擊命中時 4% 機率讓目標「血咒」5 秒：受到的傷害 +' + f1(a) + '%'; } },
    { k: 'dark', ch: '暗棲', mat: 'ttmi_775', v: [1, 2, 3, 4, 5], d: function (a) { return '迴避 +' + f1(a); } },
    { k: 'venom', ch: '蝕毒', mat: 'ttmi_797', v: [2, 3, 4, 5, 6], d: function (a) { return '對中毒、流血、燃燒中的目標，造成的傷害 +' + f1(a) + '%'; } },
    { k: 'well', ch: '井泉', mat: 'ttmi_11447', v: [2, 4, 6, 8, 10], d: function (a) { return '攻擊魔法、攻擊技能的 MP 消耗 −' + f1(a) + '%'; } },
    { k: 'tear', ch: '淚晶', mat: 'ttmi_11448', v: [3, 6, 9, 12, 15], d: function (a) { return '受到的治療、藥水回復量 +' + f1(a) + '%'; } },
    { k: 'memory', ch: '記憶', mat: 'ttmi_11606', v: [1, 2, 3, 4, 5], d: function (a) { return '攻擊技能、攻擊魔法的施放間隔 −' + f1(a) + '%'; } },
    { k: 'dragon', ch: '龍煉', mat: 'ttmi_13636', v: [3, 6, 9, 12, 15], v2: [2, 4, 6, 8, 10], d: function (a, b) { return '火、水、風、地屬性抗性各 +' + f1(a) + '；對龍族的傷害 +' + f1(b) + '%'; } }
  ];
  var KB = {}; KINDS.forEach(function (x) { KB[x.k] = x; });
  var SEAL_X = 1.5;
  var DIRS = {
    you: { n: '尤', mat: 'ttmi_2443', c: '#fca5a5', dmg: [0.5, 1, 1.5, 2, 3], cd: [2, 4, 6, 8, 10],
      d: function (i) { return '造成的傷害 +' + f1(this.dmg[i]) + '%、爆擊傷害 +' + f1(this.cd[i]) + '%'; } },
    kun: { n: '鯤', mat: 'ttmi_2518', c: '#7dd3fc', cut: [0.5, 1, 1.5, 2, 3], abn: [1, 2, 3, 4, 5], hp: [1, 2, 3, 4, 5], reg: [2, 4, 6, 8, 10],
      d: function (i) { return '受到的傷害 −' + f1(this.cut[i]) + '%、異常狀態抵抗 +' + f1(this.abn[i]) + '%、最大 HP +' + f1(this.hp[i]) + '%、HP 自然恢復 +' + f1(this.reg[i]); } },
    mi: { n: '彌', mat: 'ttmi_14482', c: '#c4b5fd', sk: [0.6, 1.2, 1.8, 2.4, 3], etch: [2, 3, 4, 5, 6],
      d: function (i) { return '攻擊技能、攻擊魔法造成的傷害 +' + f1(this.sk[i]) + '%；命中時 ' + f1(this.etch[i]) + '% 機率「蝕刻」目標'; } }
  };
  var DIR_KEYS = ['you', 'kun', 'mi'];
  var SETS = {
    you: ['爆擊率 +3%', '尤之怒：每第 10 次一般攻擊必定爆擊，那一下傷害 ×2'],
    kun: ['異常狀態抵抗 +5%、受到的治療 +5%', '鯤之甲：單次受到超過最大 HP 30% 的傷害時，那一下傷害 −50%（冷卻 30 秒）；受到的異常狀態持續時間 −15%'],
    mi: ['攻擊技能、攻擊魔法的 MP 消耗 −10%', '彌之刻：蝕刻的倍率 ×1.5 → ×1.8，範圍魔法的 3 秒冷卻縮短 0.5 秒']
  };
  var ENG_COST = [[5, 100000], [10, 200000], [20, 300000], [40, 400000], [80, 500000]];
  var SEAL_COST = [
    { mark: 100, mat: 5000, dia: 5000, sc: 10000, dc: 5000, gold: 100000000 },
    { mark: 200, mat: 5000, dia: 5000, sc: 10000, dc: 5000, gold: 100000000 },
    { mark: 300, mat: 10000, dia: 10000, sc: 15000, dc: 10000, gold: 100000000 },
    { mark: 500, mat: 10000, dia: 10000, sc: 15000, dc: 10000, gold: 100000000 },
    { mark: 800, mat: 15000, dia: 15000, sc: 20000, dc: 15000, gold: 100000000 }
  ];
  var SC = 'sherine_crystal', DC = 'afk_dream_crystal';
  var EX = { n: 10, gold: 10000 };
  var MOVE = { lv: 100000, seal: 3 };
  var SLOTS = [['wpn', '武器'], ['armor', '盔甲'], ['helm', '頭盔'], ['gloves', '手套'], ['boots', '長靴'], ['cloak', '斗篷']];
  var SLOT_N = {}; SLOTS.forEach(function (s) { SLOT_N[s[0]] = s[1]; });
  var MAX_SAME = 2;
  var CURSE = { chance: 0.04, dur: 50 }, ETCH = { mult: 1.5, mult6: 1.8, dur: 50 }, FURY_N = 10, KUN_ARMOR = { hp: 0.3, cut: 0.5, cd: 300 }, KUN_DUR = 0.85, AOE_CUT = 5;
  var SET3 = { crit: 3, abn: 5, heal: 5, mp: 10 };

  // 材料說明：拿掉「系統尚未開放」那一行（afk-dropcut 寫的），改成實際用途
  KINDS.forEach(function (x) {
    var d = DB.items[x.mat]; if (!d) return;
    if (x.k === 'curse' && d.ttmiAction === 'box') { d.type = 'etc'; d.noUse = true; delete d.ttmiAction; delete d.eff; delete d.ttmiBoxCooldown; d.d = ''; }   // 原本是 22 小時開一次的箱子：改成刻印材料，免得被一鍵開箱開掉
    d.d = String(d.d || '').replace(/\n?【刻印】[^\n]*/g, '').replace(/^\n+/, '') + (d.d ? '\n' : '') + '【刻印】歐瑞村莊的刻印師邪迪克爾用它刻「' + x.ch + '」；10 個可以換 1 個其他種刻印材料。';
  });
  DIR_KEYS.forEach(function (k) {
    var d = DB.items[DIRS[k].mat]; if (!d) return;
    d.d = String(d.d || '').replace(/\n?【印記】[^\n]*/g, '') + '\n【印記】歐瑞村莊的刻印師邪迪克爾用它把刻印 Lv5 升成「' + DIRS[k].n + '之印記」' + (d.type === 'acc' ? '（整件用掉，強化值不算）' : '') + '。';
  });

  // ── 物品上的刻印 ──
  var cv = function (it) { var c = it && it.afkCarve; return (c && KB[c.k] && c.lv >= 1) ? c : null; };
  var sealed = function (c) { return !!(c && c.s > 0 && DIRS[c.dir]); };
  var label = function (c) { if (!c) return ''; var k = KB[c.k]; return sealed(c) ? DIRS[c.dir].n + '之印記 Lv' + c.s + '（' + k.ch + '）' : '刻印：' + k.ch + ' Lv' + c.lv; };
  var kindVal = function (c, which) { var k = KB[c.k], arr = which === 2 ? k.v2 : k.v; if (!arr) return 0; return sealed(c) ? arr[4] * SEAL_X : arr[Math.max(0, Math.min(4, c.lv - 1))]; };
  var slotOf = function (d) {
    if (!d) return null;
    if (d.type === 'wpn' && !d.isArrow) return 'wpn';
    if (d.type === 'arm' && SLOT_N[d.slot] && d.slot !== 'wpn') return d.slot;
    return null;
  };

  // ── 全身效果 ──
  var cache = { key: null, v: null };
  var NONE = { cnt: { you: 0, kun: 0, mi: 0 }, kind: {}, er: 0, res: 0, dragon: 0, curse: 0, venom: 0, mp: 0, heal: 0, pot: 0, cast: 0, dmg: 0, critDmg: 0, crit: 0,
    cut: 0, abn: 0, hp: 0, reg: 0, sk: 0, etch: 0, etchMult: ETCH.mult, fury: false, armor: false, dur: 0, aoe: 0 };
  var fx = function (p) {
    p = p || P(); if (!on(p) || !p.eq) return NONE;
    var key = SLOTS.map(function (s) { var it = p.eq[s[0]], c = cv(it); return c ? s[0] + c.k + c.lv + (c.dir || '') + (c.s || 0) : ''; }).join('|');
    if (cache.key === key && cache.p === p) return cache.v;
    var o = JSON.parse(JSON.stringify(NONE)), lists = {};
    SLOTS.forEach(function (s) {
      var c = cv(p.eq[s[0]]); if (!c) return;
      (lists[c.k] = lists[c.k] || []).push(c);
      if (sealed(c)) {
        o.cnt[c.dir]++;
        var D = DIRS[c.dir], i = c.s - 1;
        if (c.dir === 'you') { o.dmg += D.dmg[i]; o.critDmg += D.cd[i]; }
        else if (c.dir === 'kun') { o.cut += D.cut[i]; o.abn += D.abn[i]; o.hp += D.hp[i]; o.reg += D.reg[i]; }
        else { o.sk += D.sk[i]; o.etch += D.etch[i]; }
      }
    });
    Object.keys(lists).forEach(function (k) {
      var arr = lists[k].sort(function (a, b) { return kindVal(b) - kindVal(a); }).slice(0, MAX_SAME), a = 0, b = 0;   // 同一種最多算 2 個
      arr.forEach(function (c) { a += kindVal(c); b += kindVal(c, 2); });
      o.kind[k] = a;
      if (k === 'curse') o.curse = a; else if (k === 'dark') o.er = a; else if (k === 'venom') o.venom = a; else if (k === 'well') o.mp += a;
      else if (k === 'tear') { o.heal += a; o.pot += a; } else if (k === 'memory') o.cast = a; else if (k === 'dragon') { o.res = a; o.dragon = b; }
    });
    if (o.cnt.you >= 3) o.crit += SET3.crit;
    if (o.cnt.you >= 6) o.fury = true;
    if (o.cnt.kun >= 3) { o.abn += SET3.abn; o.heal += SET3.heal; }
    if (o.cnt.kun >= 6) { o.armor = true; o.dur = 1 - KUN_DUR; }
    if (o.cnt.mi >= 3) o.mp += SET3.mp;
    if (o.cnt.mi >= 6) { o.etchMult = ETCH.mult6; o.aoe = AOE_CUT; }
    o.mp = Math.min(90, o.mp);
    cache = { key: key, p: p, v: o };
    return o;
  };
  var bump = function () { cache.key = null; };

  // ── 能力值 ──
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = P(), f = p && p.d ? fx(p) : NONE;
        if (f !== NONE) {
          var d = p.d, n = function (k, v) { if (v) d[k] = (Number(d[k]) || 0) + v; };
          n('er', f.er); ['resFire', 'resWater', 'resWind', 'resEarth'].forEach(function (k) { n(k, f.res); });
          n('hpR', f.reg);
          ['meleeCrit', 'rangedCrit', 'magicCrit'].forEach(function (k) { n(k, f.crit); });
          ['meleeCritDmg', 'rangedCritDmg', 'magicCritDmg'].forEach(function (k) { n(k, f.critDmg); });
        }
      } catch (e) { console.warn('[AFK-carve] stats', e); }
      return r;
    };
    try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  }
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) { if (p !== P()) return; var f = fx(p); if (f.hp > 0) p.mhp = Math.round((Number(p.mhp) || 0) * (1 + f.hp / 100)); });
  // 施放間隔（攻擊用的那一條；輔助不動）
  if (typeof W.castIntervalTicks === 'function') {
    var oCI = W.castIntervalTicks;
    W.castIntervalTicks = function (p, support) {
      var v = oCI.apply(this, arguments);
      try { if (!support && p && p === P()) { var c = fx(p).cast; if (c > 0) v = Math.max(0.000001, v * (1 - c / 100)); } } catch (e) {}
      return v;
    };
    try { (0, eval)('castIntervalTicks = window.castIntervalTicks'); } catch (e) {}
  }
  // MP 消耗（攻擊技能、攻擊魔法）
  var hookCost = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R || typeof R.castCost !== 'function' || R.castCost._afkCarve) return;
    var o = R.castCost;
    R.castCost = function (actor, skill) {
      var v = o.apply(this, arguments);
      try { if (actor && actor === P() && skill && skill.type === 'atk' && v > 0 && v < Number.MAX_SAFE_INTEGER) { var m = fx(actor).mp; if (m > 0) v = Math.max(0, Math.ceil(v * (1 - m / 100))); } } catch (e) {}
      return v;
    };
    R.castCost._afkCarve = true;
  };
  hookCost(); W.addEventListener('load', hookCost);
  // 治療、藥水
  if (typeof W.rollHealingSpell === 'function') {
    var oHeal = W.rollHealingSpell;
    W.rollHealingSpell = function (sk, dS, caster, target) {
      var v = oHeal.apply(this, arguments);
      try { if (v > 0 && target && target === P()) { var h = fx(target).heal; if (h > 0) v = Math.floor(v * (1 + h / 100)); } } catch (e) {}
      return v;
    };
    try { (0, eval)('rollHealingSpell = window.rollHealingSpell'); } catch (e) {}
  }
  if (typeof W.playerEquipPotionBonusPct === 'function') {
    var oPot = W.playerEquipPotionBonusPct;
    W.playerEquipPotionBonusPct = function () { var v = oPot.apply(this, arguments); try { v += fx().pot; } catch (e) {} return v; };
    try { (0, eval)('playerEquipPotionBonusPct = window.playerEquipPotionBonusPct'); } catch (e) {}
  }
  // 範圍魔法冷卻：彌 6 格縮短 0.5 秒（afk-balance1101 讀 __afkHiddenAoeCd 當冷卻長度）
  (function () {
    var o = W.__afkHiddenAoeCd;
    W.__afkHiddenAoeCd = function (sk, x) {
      var v = 0; try { v = typeof o === 'function' ? Number(o(sk, x)) || 0 : 0; } catch (e) {}
      try {
        var B = W.__afkBalance1101, p = P();
        if (p && (x === p || x == null) && B && B.isAoe && B.isAoe(sk)) { var a = fx(p).aoe; if (a > 0) v = Math.max(1, (v > 0 ? v : B.AOE_CD) - a); }
      } catch (e) {}
      return v;
    };
  })();

  // ── 異常狀態抵抗：照核心「全身相加、最高 100%」的算法補上鯤的抵抗 ──
  var basePct = function (p, kind) {
    var immF = { freeze: 'immFreeze', stun: 'immStun', paralyze: 'immParalyze', sleep: 'immSleep', slow: 'immSlow', poison: 'immPoison', burn: 'immBurn', blind: 'immBlind' }[kind];
    var resF = { freeze: 'freezeResist', stun: 'stunResist', paralyze: 'paralyzeResist', sleep: 'sleepResist', slow: 'slowResist', poison: 'poisonResist' }[kind];
    var pct = 0, imm = false;
    try { (typeof WEIGHT_COUNT_SLOTS !== 'undefined' ? WEIGHT_COUNT_SLOTS : []).forEach(function (k) { var e = p.eq && p.eq[k], dd = e && DB.items[e.id]; if (!dd) return; if (immF && dd[immF]) imm = true; if (resF && dd[resF]) pct += Number(dd[resF]) || 0; if (dd.abnormalResist) pct += Number(dd.abnormalResist) || 0; }); } catch (e) {}
    if (kind === 'stun' && p.skills && p.skills.indexOf('sk_royal_kingguard') >= 0) pct += 20;
    return imm ? 100 : Math.min(100, pct);
  };
  if (typeof W.playerStatusResisted === 'function') {
    var oRes = W.playerStatusResisted;
    W.playerStatusResisted = function (kind) {
      var r = oRes.apply(this, arguments);
      if (r) return r;
      try {
        var p = P(), x = fx(p).abn; if (!(x > 0)) return r;
        var a = basePct(p, kind) / 100; if (a >= 1) return r;
        var q = (Math.min(1, a + x / 100) - a) / (1 - a);   // 原本沒擋下的那部分再擲一次，合起來＝相加
        if (rnd() < q) return true;
      } catch (e) {}
      return r;
    };
    try { (0, eval)('playerStatusResisted = window.playerStatusResisted'); } catch (e) {}
  }

  // ── 攻擊、受傷 ──
  var ctx = { sk: null };
  if (typeof W.castSkill === 'function') {
    var oCast = W.castSkill;
    W.castSkill = function (skId) {
      var prev = ctx.sk; ctx.sk = DB.skills[skId] || null;
      try { return oCast.apply(this, arguments); } finally { ctx.sk = prev; }
    };
    try { (0, eval)('castSkill = window.castSkill'); } catch (e) {}
  }
  var afflicted = function (m) {
    if (!m) return false;
    if (m.st && m.st.poison > 0) return true;
    if (m.bleeds && m.bleeds.length) return true;
    if (m._burstPoison && m._burstPoison.left > 0) return true;
    if (m._burnDot && m._burnDot.left > 0) return true;
    var s = m._afkStack; if (s && ((s.poison && s.poison.length) || (s.burn && s.burn.length))) return true;
    return false;
  };
  var isDragon = function (m) { return !!(m && (m.race === '龍' || m.race === '飛龍')); };
  var fury = { n: 0 };
  var stats = { curse: 0, etch: 0, etchEat: 0, fury: 0, armor: 0 };
  var popFx = function (key, text, color) { try { if (X) { X.pop('carve' + key, null, text, color); X.note('carve' + key, '<span style="color:' + color + '">【' + esc(text) + '】</span>'); } } catch (e) {} };
  var dealt = function (actor, target, v, opt) {
    var p = P(); if (!p || !on(p) || !target || target === p || !(v > 0)) return v;
    var t = tk();
    // 蝕刻、血咒：不分來源都算
    var e = target._afkEtch;
    if (e) { if (t <= e.until && t >= e.at) { v *= e.mult; target._afkEtch = null; stats.etchEat++; } else target._afkEtch = null; }
    var cu = target._afkCurse;
    if (cu) { if (t <= cu.until && t >= cu.at) v *= 1 + cu.pct / 100; else target._afkCurse = null; }
    if (actor !== p) return v;
    var f = fx(p); if (f === NONE) return v;
    var m = 1, pk = opt && opt.packet, skill = ctx.sk && ctx.sk.type === 'atk' && !pk;
    if (f.dmg) m *= 1 + f.dmg / 100;
    if (f.venom && afflicted(target)) m *= 1 + f.venom / 100;
    if (f.dragon && isDragon(target)) m *= 1 + f.dragon / 100;
    if (f.sk && skill) m *= 1 + f.sk / 100;
    if (pk && f.fury) {
      fury.n++;
      if (fury.n >= FURY_N) {
        fury.n = 0; stats.fury++;
        var cd = pk.ranged ? Number(p.d && p.d.rangedCritDmg) || 0 : Number(p.d && p.d.meleeCritDmg) || 0;
        m *= (pk.crit ? 1 : 1 + cd / 100) * 2;
        popFx('fury', '尤之怒', DIRS.you.c);
      }
    }
    v *= m;
    if (pk && f.curse && rnd() < CURSE.chance) { target._afkCurse = { at: t, until: t + CURSE.dur, pct: f.curse }; stats.curse++; popFx('curse', '血咒', '#f87171'); }
    if (skill && f.etch && rnd() < f.etch / 100) { target._afkEtch = { at: t, until: t + ETCH.dur, mult: f.etchMult }; stats.etch++; popFx('etch', '蝕刻', DIRS.mi.c); }
    return v;
  };
  if (X) {
    X.on('dealt', dealt);
    X.on('taken', function (ent, dmg) {
      var p = P(); if (!p || ent !== p || !(dmg > 0)) return dmg;
      var f = fx(p); if (!f.armor) return dmg;
      if (dmg > (p.mhp || 0) * KUN_ARMOR.hp && tk() >= (p._afkKunArmorAt || -1e9) + KUN_ARMOR.cd) { p._afkKunArmorAt = tk(); stats.armor++; popFx('armor', '鯤之甲', DIRS.kun.c); return dmg * KUN_ARMOR.cut; }
      if (tk() < (p._afkKunArmorAt || 0)) p._afkKunArmorAt = -1e9;   // 讀檔後 tick 重算
      return dmg;
    });
  }
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent) { var p = P(); if (!p || ent !== p) return 1; var c = fx(p).cut; return c > 0 ? 1 - c / 100 : 1; });

  // ── 異常狀態持續時間（每 tick 看新上身或被刷新的狀態，跟粹煉之魂同一套做法）──
  var DEBUFFS = ['stun', 'freeze', 'stone', 'poison', 'burn', 'scald', 'bleed', 'sleep', 'silence', 'paralyze', 'magicseal', 'armorBreak', 'slowAtk', 'bind',
    'blind', 'weaken', 'disease', 'potionFrost', 'foulWater', 'slow', 'broken', 'confuse', 'panic', 'terror', 'fragile', 'curse', 'decay', 'mrhalf'];
  var lastSt = { p: null, v: null };
  var durTick = function () {
    var p = P(); if (!p || !on(p)) return;
    var st = p.statuses, f = fx(p); if (!st || typeof st !== 'object' || !(f.dur > 0)) { lastSt.p = null; return; }
    var prev = lastSt.p === p ? lastSt.v : {}, now = {};
    DEBUFFS.forEach(function (k) { var v = Number(st[k]) || 0; if (v > 0 && v > (Number(prev[k]) || 0)) { v = Math.max(Number(prev[k]) || 0, Math.max(1, Math.round(v * (1 - f.dur)))); st[k] = v; } now[k] = v; });
    lastSt.p = p; lastSt.v = now;
  };
  if (X) X.on('tick', durTick);
  // 所有來源合計（面板用）：粹煉之魂、上位者的刻印石、鯤 6 格；各自乘上去
  var durParts = function (p) {
    var out = [];
    try { var SD = W.__afkSherineDream; if (SD && SD.soulRefined && !p.classicMode && SD.soulRefined(p)) out.push(['粹煉之魂', 1 - SD.SOUL_CUT]); } catch (e) {}
    try { var EP = W.__afkExpedition, r = EP && EP.stoneOf && EP.stoneOf(p); if (r && r.debuff && EP.slotOn(p)) out.push([nm('afk_engrave_4') || '上位者的刻印石', 1 - r.debuff]); } catch (e) {}
    var f = fx(p); if (f.dur > 0) out.push(['鯤 6 格', f.dur]);
    try { var GR = W.__afkGuardRing; if (GR && GR.durCut) { var gc = GR.durCut(p); if (gc > 0) out.push(['守護者之戒', gc]); } } catch (e) {}   // afk-guardring 自己縮短（跟其他來源一起最多 −70%）
    return out;
  };
  var durTotal = function (p) { var m = 1; durParts(p).forEach(function (x) { m *= 1 - x[1]; }); return (1 - m) * (typeof W.__afkDimPanelF === 'function' ? W.__afkDimPanelF(p) : 1); };   // 次元裂縫的面板壓制也打折

  // ── 面板 ──
  var paint = function () {
    var p = P(); if (!p) return;
    var a = document.getElementById('afk-abn-res'), er = document.getElementById('dt-er');
    var f = fx(p);
    if (a && f.abn > 0) { var base = 0; try { base = W.__afkOverflow && W.__afkOverflow.abnPct ? W.__afkOverflow.abnPct(p) : 0; } catch (e) {} var t = f1(Math.min(100, base + f.abn)) + '%'; if (a.textContent !== t) a.textContent = t; }
    var anchor = a ? a.parentNode : (er ? er.parentNode : null); if (!anchor || !anchor.parentNode) return;
    var el = document.getElementById('afk-abn-dur');
    if (!el) {
      var div = document.createElement('div'); div.id = 'afk-abn-dur-row';
      div.innerHTML = '<span>異常狀態持續時間</span><strong id="afk-abn-dur">0%</strong>';
      anchor.parentNode.insertBefore(div, anchor.nextSibling); el = document.getElementById('afk-abn-dur');
    }
    var row = el.parentNode; row.style.display = on(p) ? '' : 'none';
    var tot = durTotal(p), txt = tot > 0 ? '−' + f1(tot * 100) + '%' : '0%';
    if (el.textContent !== txt) el.textContent = txt;
    var parts = durParts(p), tit = parts.length ? '受到的負面狀態秒數縮短：' + parts.map(function (x) { return x[0] + ' −' + f1(x[1] * 100) + '%'; }).join('、') + '（各自相乘）' : '受到的負面狀態秒數縮短（鯤之印記 6 格、粹煉之魂等）';
    if (row.title !== tit) row.title = tit;
  };
  if (typeof W._updateUIImpl === 'function') {
    var oU = W._updateUIImpl;
    W._updateUIImpl = function () { var r = oU.apply(this, arguments); try { paint(); } catch (e) {} return r; };
    try { (0, eval)('_updateUIImpl = window._updateUIImpl'); } catch (e) {}
  }

  // ── 物品說明、簽章 ──
  if (typeof W.itemSig === 'function') {
    var oSig = W.itemSig;
    W.itemSig = function (it) { var s0 = oSig.apply(this, arguments), c = cv(it); return c ? s0 + '|CV' + c.k + c.lv + (c.dir || '') + (c.s || 0) : s0; };
    try { (0, eval)('itemSig = window.itemSig'); } catch (e) {}
  }
  var tipLine = function (it) { var c = cv(it); if (!c) return ''; var col = sealed(c) ? DIRS[c.dir].c : '#fdba74'; return '<span class="font-bold" style="color:' + col + '">【' + esc(label(c)) + '】</span>'; };
  if (typeof W.buildItemDescHTML === 'function') {
    var oDesc = W.buildItemDescHTML;
    W.buildItemDescHTML = function (it) {
      var h = oDesc.apply(this, arguments);
      try { var c = cv(it); if (c && on()) { var k = KB[c.k]; h = tipLine(it) + '<br><span class="text-slate-300 text-sm">' + esc(k.d(kindVal(c), kindVal(c, 2))) + (sealed(c) ? '；' + esc(DIRS[c.dir].d(c.s - 1)) : '') + '</span><br>' + h; } } catch (e) {}
      return h;
    };
    try { (0, eval)('buildItemDescHTML = window.buildItemDescHTML'); } catch (e) {}
  }
  (W.__afkAxLines = W.__afkAxLines || []).push(function (it) { return on() ? (tipLine(it) || null) : null; });

  // ── 材料：背包＋倉庫 ──
  var MW = function () { var m = W.__afkMatWh; return m && m.on && m.on() ? m : null; };
  var n1 = function (it) { return Math.max(1, Math.floor(Number(it && it.cnt) || 1)); };
  var bagHave = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (a, i) { return a + (i && i.id === id && !i.lock && !cv(i) ? n1(i) : 0); }, 0) : 0; };
  var dia = function () { try { return Math.max(0, Math.floor(Number(W.pandoraGetSharedDiamonds()) || 0)); } catch (e) { return 0; } };
  var have = function (id) {
    var p = P(); if (!p) return 0;
    if (id === 'gold') return Math.max(0, Math.floor(Number(p.gold) || 0));
    if (id === 'dia') return dia();
    var m = MW(); return bagHave(id) + (m ? m.wh(id) : 0);
  };
  var nameOf = function (id) { return id === 'gold' ? '金幣' : id === 'dia' ? '龍之鑽石' : nm(id); };
  var missOf = function (need) {
    var out = [];
    need.forEach(function (q) { var h = have(q[0]); if (h < q[1]) out.push(nameOf(q[0]) + '還差 ' + fmt(q[1] - h)); });
    return out.length ? out.join('、') + '。' : null;
  };
  var byEn = function (a, b) { return (Number(a.en) || 0) - (Number(b.en) || 0); };
  // 一次扣完（先背包、再倉庫；龍鑽最後扣；任何一步失敗就還原）。change() 在扣之後、存檔之前執行
  var pay = function (need, change) {
    var p = P(); if (!p) return '請先進入遊戲。';
    var miss = missOf(need); if (miss) return miss;
    var bagNeed = [], whNeed = [], gold = 0, d = 0;
    need.forEach(function (q) {
      if (q[0] === 'gold') gold += q[1]; else if (q[0] === 'dia') d += q[1];
      else { var b = Math.min(bagHave(q[0]), q[1]); if (b > 0) bagNeed.push([q[0], b]); if (q[1] - b > 0) whNeed.push([q[0], q[1] - b]); }
    });
    var w = null;
    if (whNeed.length) {
      if (!MW() || typeof loadWarehouse !== 'function' || typeof whTxnCommit !== 'function') return '倉庫現在拿不到材料，請先把材料放到背包。';
      w = loadWarehouse(); if (!w || !Array.isArray(w.items)) return '倉庫現在拿不到材料，請先把材料放到背包。';
      for (var i = 0; i < whNeed.length; i++) {
        var id = whNeed[i][0], left = whNeed[i][1];
        var rows = w.items.map(function (it, j) { return { it: it, j: j }; }).filter(function (x) { return x.it && x.it.id === id && !x.it.lock && !cv(x.it); }).sort(function (a, b) { return byEn(a.it, b.it); });
        var rm = [];
        rows.forEach(function (x) { if (left <= 0) return; var c = n1(x.it), u = Math.min(c, left); left -= u; if (c - u <= 0) rm.push(x.j); else x.it.cnt = c - u; });
        if (left > 0) return nameOf(id) + '還差 ' + fmt(left) + '。';
        rm.sort(function (a, b) { return b - a; }).forEach(function (j) { w.items.splice(j, 1); });
      }
    }
    var snap = typeof whTxnSnapshot === 'function' ? whTxnSnapshot() : { inv: JSON.parse(JSON.stringify(p.inv || [])), gold: p.gold };
    bagNeed.forEach(function (q) {
      var left = q[1];
      var rows = p.inv.filter(function (it) { return it && it.id === q[0] && !it.lock && !cv(it); }).sort(byEn);
      rows.forEach(function (it) { if (left <= 0) return; var c = n1(it), u = Math.min(c, left); left -= u; if (c - u <= 0) p.inv.splice(p.inv.indexOf(it), 1); else it.cnt = c - u; });
    });
    p.gold = Math.max(0, Math.floor(Number(p.gold) || 0) - gold);
    if (d > 0) { var r = null; try { r = W.pandoraAdjustSharedDiamonds(-d) || {}; } catch (e) { r = {}; } if (!r.ok) { p.inv = snap.inv; p.gold = snap.gold; return '龍之鑽石扣不下來，請稍後再試。'; } }
    var undo = null; try { undo = change(); } catch (e) { console.warn('[AFK-carve] change', e); }
    var ok = true;
    if (w) { try { ok = whTxnCommit(w, snap); } catch (e) { ok = false; } try { if (W.__afkMatWh && W.__afkMatWh.flush) W.__afkMatWh.flush(); } catch (e) {} }
    else { try { if (typeof saveGame === 'function') saveGame(); } catch (e) {} }
    if (!ok) {
      if (typeof undo === 'function') { try { undo(); } catch (e) {} }
      if (d > 0) { try { W.pandoraAdjustSharedDiamonds(d); } catch (e) {} }
      try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
      return '存檔失敗，這次沒有扣任何東西。';
    }
    return null;
  };

  // ── 選裝備 ──
  var uidOf = function () { return 'CV' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e9).toString(36); };
  var resolve = function (ref) {
    var p = P(); if (!p || !ref) return null;
    if (ref.indexOf('eq:') === 0) { var s = ref.slice(3); return SLOT_N[s] ? (p.eq[s] || null) : null; }
    var u = ref.slice(4), it = (p.inv || []).find(function (x) { return x && x.uid === u; });
    if (!it) return null;
    if (n1(it) > 1) { it.cnt = n1(it) - 1; var one = JSON.parse(JSON.stringify(it)); one.uid = uidOf(); one.cnt = 1; p.inv.push(one); it = one; }
    return it;
  };
  var kindCount = function (p, k, exceptSlot) { return SLOTS.filter(function (s) { if (s[0] === exceptSlot) return false; var c = cv(p.eq[s[0]]); return c && c.k === k; }).length; };
  var done = function (msg) {
    bump();
    try { if (msg && typeof logSys === 'function') logSys(msg); } catch (e) {}
    try { if (typeof recomputeStats === 'function') recomputeStats(); } catch (e) {}
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
  };
  var guard = function () { var p = P(); if (!p) return '請先進入遊戲。'; if (!on(p)) return '經典模式沒有刻印。'; return null; };

  // 下一步要付的東西：{ act, need, txt }
  var nextStep = function (it, arg) {
    var c = cv(it);
    if (!c) { var k = KB[arg]; if (!k) return { err: '請選一種刻印。' }; return { act: 'engrave', k: k, need: [[k.mat, ENG_COST[0][0]], ['gold', ENG_COST[0][1]]], to: 1 }; }
    var kk = KB[c.k];
    if (!sealed(c)) {
      if (c.lv < 5) return { act: 'up', need: [[kk.mat, ENG_COST[c.lv][0]], ['gold', ENG_COST[c.lv][1]]], to: c.lv + 1 };
      var D = DIRS[arg]; if (!D) return { err: '請選一個方向。' };
      var q = SEAL_COST[0]; return { act: 'seal', dir: arg, need: [[D.mat, q.mark], [kk.mat, q.mat], ['dia', q.dia], [SC, q.sc], [DC, q.dc], ['gold', q.gold]], to: 1 };
    }
    if (c.s >= 5) return { err: '已經升到最高了。' };
    var q2 = SEAL_COST[c.s], D2 = DIRS[c.dir];
    return { act: 'sealUp', need: [[D2.mat, q2.mark], [kk.mat, q2.mat], ['dia', q2.dia], [SC, q2.sc], [DC, q2.dc], ['gold', q2.gold]], to: c.s + 1 };
  };
  var ACT = {
    // 刻印、升級、升成印記：slot＝裝備欄位；arg＝刻印種類（空孔時）或方向（Lv5 時）
    up: function (slot, arg) {
      var g = guard(); if (g) return g;
      var p = P(); if (!SLOT_N[slot]) return '這個部位不能刻。';
      var it = p.eq[slot]; if (!it || !slotOf(DB.items[it.id])) return '這個部位沒有裝備。';
      var st = nextStep(it, arg); if (st.err) return st.err;
      if (st.act === 'engrave' && kindCount(p, st.k.k, slot) >= MAX_SAME) return '「' + st.k.ch + '」全身最多 2 個。';
      var before = it.afkCarve ? JSON.parse(JSON.stringify(it.afkCarve)) : null;
      var err = pay(st.need, function () {
        if (st.act === 'engrave') it.afkCarve = { k: st.k.k, lv: 1, dir: null, s: 0 };
        else if (st.act === 'up') it.afkCarve.lv = st.to;
        else if (st.act === 'seal') { it.afkCarve.dir = st.dir; it.afkCarve.s = 1; }
        else it.afkCarve.s = st.to;
        return function () { if (before) it.afkCarve = before; else delete it.afkCarve; };
      });
      if (err) return err;
      done('<span class="font-bold" style="color:#fdba74">邪迪克爾的刻刀落下——' + esc(SLOT_N[slot]) + '刻上了【' + esc(label(it.afkCarve)) + '】。</span>');
      return null;
    },
    fee: function (it) { var c = cv(it); if (!c) return 0; return sealed(c) ? c.s * MOVE.lv * MOVE.seal : c.lv * MOVE.lv; },
    // 轉移：from、to 是 'eq:欄位' 或 'inv:uid'，同部位
    move: function (fromRef, toRef) {
      var g = guard(); if (g) return g;
      var p = P(), src = resolve(fromRef), dst = toRef && toRef.indexOf('inv:') === 0 ? null : resolve(toRef);
      if (!src || !cv(src)) return '找不到要轉移的刻印。';
      var peek = dst || (function () { var u = String(toRef || '').slice(4); return (p.inv || []).find(function (x) { return x && x.uid === u; }); })();
      if (!peek) return '找不到要刻上去的裝備。';
      if (peek === src) return '要選另一件裝備。';
      var sd = slotOf(DB.items[src.id]), dd = slotOf(DB.items[peek.id]);
      if (!sd || sd !== dd) return '只能轉移到同部位的裝備。';
      if (cv(peek)) return '那件裝備已經有刻印了。';
      if (toRef.indexOf('eq:') === 0 && fromRef.indexOf('eq:') !== 0 && kindCount(p, src.afkCarve.k, toRef.slice(3)) >= MAX_SAME) return '「' + KB[src.afkCarve.k].ch + '」全身最多 2 個。';
      var fee = ACT.fee(src), c = src.afkCarve;
      dst = dst || resolve(toRef);
      var err = pay([['gold', fee]], function () { dst.afkCarve = c; delete src.afkCarve; return function () { src.afkCarve = c; delete dst.afkCarve; }; });
      if (err) return err;
      done('<span class="font-bold" style="color:#fdba74">【' + esc(label(c)) + '】轉移到' + esc(nm(dst.id)) + '。</span>');
      return null;
    },
    // 兌換：from 種材料 10×times → to 種 1×times，手續費 1 萬×times
    exchange: function (from, to, times) {
      var g = guard(); if (g) return g;
      var a = KB[from], b = KB[to]; times = Math.max(1, Math.floor(Number(times) || 1));
      if (!a || !b) return '請選要換的材料。'; if (a === b) return '要換成另一種材料。';
      var err = pay([[a.mat, EX.n * times], ['gold', EX.gold * times]], function () { try { gainItem(b.mat, times, true, true); } catch (e) {} return null; });
      if (err) return err;
      done('<span class="text-amber-200">' + esc(nm(a.mat)) + ' ×' + fmt(EX.n * times) + ' 換成 ' + esc(nm(b.mat)) + ' ×' + fmt(times) + '。</span>');
      return null;
    }
  };

  // ── 掉落 ──
  var range = function (pre, a, b) { var o = []; for (var i = a; i <= b; i++) o.push(pre + i); return o; };
  var DROPS = {
    curse: ['rastabad_cave2', 'rastabad_cave3', 'rastabad_gate', 'rastabad_beast', 'dark_magic_lab', 'necro_training'],
    dark: ['dark_elf_sanctuary', 'hidden_cave', 'elf_grave'],
    venom: ['desert', 'zone_33', 'hidden_antqueen', 'thebes_desert'],
    well: ['zone_37', 'zone_38', 'zone_39', 'zone_40', 'zone_41', 'ivory_yahee'],
    tear: ['pride_2_10', 'pride_11_20', 'pride_21_30'].concat(range('pride_f', 2, 30)),
    memory: ['oblivion_island', 'oblivion_travel'],
    dragon: ['dragon_valley', 'zone_28', 'zone_29', 'zone_30', 'zone_31']
  };
  var SEAL_DROPS = {
    you: { rate: 0.03, maps: ['antharas_nest_1', 'antharas_nest_2', 'antharas_nest_3', 'antharas_lair', 'afk_hardin_time'].concat(['fafurion', 'valakas', 'lindvior'].reduce(function (a, d) { return a.concat(['cr_' + d + '_nest_1', 'cr_' + d + '_nest_2', 'cr_' + d + '_nest_3', 'cr_' + d + '_lair']); }, [])) },
    kun: { rate: 0.02, maps: ['pride_41_50', 'pride_51_60', 'pride_61_70', 'pride_71_80', 'pride_81_90', 'pride_91_100'].concat(range('pride_f', 41, 100)) },
    mi: { rate: 0.01, maps: ['king_baranka_room', 'law_king_room', 'necro_king_room', 'assassin_king_room'], sherine: true }
  };
  var RATE = { mob: 0.003, boss: 0.20, bossMin: 1, bossMax: 3 };
  var MAP_ENG = {}, MAP_SEAL = {};
  Object.keys(DROPS).forEach(function (k) { DROPS[k].forEach(function (m) { (MAP_ENG[m] = MAP_ENG[m] || []).push(k); }); });
  Object.keys(SEAL_DROPS).forEach(function (k) { SEAL_DROPS[k].maps.forEach(function (m) { (MAP_SEAL[m] = MAP_SEAL[m] || []).push(k); }); });
  var MAP_N = { dark_elf_sanctuary: '黑暗妖精聖地', oblivion_island: '遺忘之島', oblivion_travel: '遺忘之島途中', hidden_antqueen: '巨蟻女皇棲息地' };   // 不在地圖選單裡的地方
  var mapName = function (v) { if (MAP_N[v]) return MAP_N[v]; try { for (var c in MAP_CATEGORIES) { var e = (MAP_CATEGORIES[c] || []).find(function (m) { return m.v === v; }); if (e) return e.t; } } catch (e) {} return null; };
  var onKill = function (m) {
    var p = P(); if (!on(p) || !m || m._afkCarveRoll || m._train || m.siegeEnemy || m.pledgeEnemy || m.siegeV2 || m._kbNoReward) return;
    m._afkCarveRoll = true;
    var cur = (typeof mapState !== 'undefined' && mapState && mapState.current) || '';
    var eng = MAP_ENG[cur], seal = MAP_SEAL[cur] || [];
    if (m.boss && m._sherine && seal.indexOf('mi') < 0) seal = seal.concat(['mi']);
    (eng || []).forEach(function (k) {
      var id = KB[k].mat; if (!DB.items[id]) return;
      if (m.boss) { if (rnd() < RATE.boss) { var n = RATE.bossMin + Math.floor(rnd() * (RATE.bossMax - RATE.bossMin + 1)); gainItem(id, n); } }
      else { var r = typeof partyDropRate === 'function' ? partyDropRate(RATE.mob) : RATE.mob; if (rnd() < r) gainItem(id, 1); }
    });
    if (m.boss) seal.forEach(function (k) { var id = DIRS[k].mat; if (DB.items[id] && rnd() < SEAL_DROPS[k].rate) gainItem(id, 1); });
  };
  if (X) X.on('kill', onKill);
  // 掉落查詢的取得方式
  (function () {
    var DX = W.AFK_DEX_EXTRA; if (!DX || !DX.acq) return;
    var names = function (list) { var seen = {}, out = []; list.forEach(function (v) { var n = mapName(v); if (n && !seen[n]) { seen[n] = 1; out.push(n); } }); return out; };
    KINDS.forEach(function (k) { var ns = names(DROPS[k.k]); if (ns.length) DX.acq(k.mat, ns.join('、') + '：一般怪 0.3%（乘隊伍人數）、頭目 20%（1～3 個）。也可以在歐瑞村莊的刻印師邪迪克爾用其他刻印材料 10 個換 1 個。'); });
    DX.acq(DIRS.you.mat, '四龍副本、哈汀的時空的頭目 3%。');
    DX.acq(DIRS.kun.mat, '傲慢之塔 41 樓以上各層的頭目 2%。');
    DX.acq(DIRS.mi.mat, '拉斯塔巴德的軍王之室、席琳世界的頭目 1%。');
  })();

  // ── NPC 與介面 ──
  var NPC_ID = 'npc_afk_xadikel', NPC_N = '邪迪克爾';
  L.addNpc('town_oren', { id: NPC_ID, n: NPC_N, title: '刻印師', type: 'carve', classicHide: true,
    d: '歐瑞村莊的刻印師邪迪克爾，能在武器與防具上刻下刻印，再把刻印升成尤、鯤、彌三種印記。' }, '920', [58, 76]);
  var ui = { slot: 'wpn', kind: 'curse', dir: 'you', exFrom: 'curse', exTo: 'dark', err: '', msg: '' };
  var CSS_ID = 'afk-carve-css';
  var css = function () {
    K.css(); if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style'); s.id = CSS_ID;
    s.textContent = '#afk-cv .cv-grid{display:grid;grid-template-columns:minmax(220px,1fr) 2fr;gap:12px;align-items:start}'
      + '@media (max-width:720px){#afk-cv .cv-grid{grid-template-columns:1fr}}'
      + '#afk-cv .cv-slot{display:flex;gap:8px;align-items:center;padding:6px 8px;border:1px solid #334155;border-radius:8px;background:#1e293b;margin-bottom:6px;cursor:pointer;width:100%;text-align:left;color:#e2e8f0}'
      + '#afk-cv .cv-slot.on{border-color:#f59e0b;background:#422006;box-shadow:inset 3px 0 0 #f59e0b}'
      + '#afk-cv .cv-slot .cv-sn{font-weight:700;color:#fde68a;min-width:2.6em}'
      + '#afk-cv .cv-slot .cv-it{font-size:12px;color:#94a3b8}#afk-cv .cv-slot .cv-c{font-size:13px;font-weight:700}'
      + '#afk-cv .cv-set{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}'
      + '#afk-cv .cv-set span{padding:3px 10px;border-radius:999px;border:1px solid #475569;background:#0f172a;font-weight:700;font-size:13px}'
      + '#afk-cv .cv-set span.lit{border-color:currentColor}'
      + '#afk-cv select{background:#0f172a;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:6px;font-size:13px}';
    document.head.appendChild(s);
  };
  var setTxt = function (p) { var f = fx(p); return DIR_KEYS.map(function (k) { return DIRS[k].n + ' ' + f.cnt[k] + '／6'; }).join('、'); };
  var reqHtml = function (need) { return need.map(function (q) { return K.reqTxt(have(q[0]), q[1], esc(nameOf(q[0]))); }).join('　'); };
  var curDesc = function (c) { var k = KB[c.k]; return esc(k.d(kindVal(c), kindVal(c, 2))) + (sealed(c) ? '；' + esc(DIRS[c.dir].d(c.s - 1)) : ''); };
  var html = function () {
    var p = P(), f = fx(p);
    var h = '<div class="ax-lore">「刻在裝備上的紋路，會一路陪著那件裝備。換裝備時，把刻印交給我搬過去就好。」</div>';
    h += K.matBar(KINDS.map(function (k) { return { img: K.iconUrl(DB.items[k.mat]), n: nm(k.mat), v: have(k.mat), tip: ' data-tip-id="' + k.mat + '"' }; })
      .concat(DIR_KEYS.map(function (k) { return { img: K.iconUrl(DB.items[DIRS[k].mat]), n: nm(DIRS[k].mat), v: have(DIRS[k].mat), tip: ' data-tip-id="' + DIRS[k].mat + '"' }; }))
      .concat([{ img: K.iconUrl(DB.items[SC]), n: nm(SC), v: have(SC) }, { img: K.iconUrl(DB.items[DC]), n: nm(DC), v: have(DC) }, { img: 'assets/icons/items/龍之鑽石.png', n: '龍之鑽石', v: have('dia') }]));
    h += '<div class="cv-set">' + DIR_KEYS.map(function (k) { var n = f.cnt[k]; return '<span class="' + (n >= 3 ? 'lit' : '') + '" style="color:' + (n >= 3 ? DIRS[k].c : '#94a3b8') + '">' + DIRS[k].n + ' ' + n + '／6</span>'; }).join('') + '</div>';
    var setLines = []; DIR_KEYS.forEach(function (k) { if (f.cnt[k] >= 3) setLines.push(DIRS[k].n + ' 3 格：' + SETS[k][0]); if (f.cnt[k] >= 6) setLines.push(DIRS[k].n + ' 6 格：' + SETS[k][1]); });
    if (setLines.length) h += '<div class="ax-note">' + setLines.map(esc).join('<br>') + '</div>';
    // 左：6 格
    var left = SLOTS.map(function (s) {
      var it = p.eq[s[0]], c = cv(it);
      return '<button type="button" class="cv-slot' + (ui.slot === s[0] ? ' on' : '') + '" data-cvs="' + s[0] + '">' + (it ? K.invIco(it, 'eq', true) : '') + '<div><div><span class="cv-sn">' + s[1] + '</span> '
        + (c ? '<span class="cv-c" style="color:' + (sealed(c) ? DIRS[c.dir].c : '#fdba74') + '">' + esc(label(c)) + '</span>' : '<span class="cv-it">（空孔）</span>') + '</div>'
        + '<div class="cv-it">' + (it ? esc(String(getItemFullNameSafe(it)).replace(/<[^>]+>/g, '')) : '沒有裝備') + '</div></div></button>';
    }).join('');
    // 右：升級、轉移
    var right = '', it = p.eq[ui.slot], c = cv(it);
    if (!it) right += '<div class="ax-note">這個部位沒有裝備。</div>';
    else {
      right += '<div class="ax-h">' + esc(SLOT_N[ui.slot]) + '：' + (c ? esc(label(c)) : '空孔') + '</div>';
      if (c) right += '<div class="ax-desc">' + curDesc(c) + '</div>';
      if (!c) {
        KINDS.forEach(function (k) {
          var st = nextStep(it, k.k), full = kindCount(p, k.k, ui.slot) >= MAX_SAME;
          right += K.rowHtml({ key: 'en-' + k.k, ico: K.itemIco(k.mat), name: '刻上「' + k.ch + '」', color: '#fdba74', desc: esc(k.d(k.v[0], k.v2 ? k.v2[0] : 0)) + '（Lv5：' + esc(k.d(k.v[4], k.v2 ? k.v2[4] : 0)) + '）',
            req: reqHtml(st.need), why: full ? '「' + k.ch + '」全身最多 2 個' : '', btns: [['up:' + k.k, '刻上', !missOf(st.need) && !full]] }, 'data-cv');
        });
      } else if (!sealed(c) && c.lv < 5) {
        var st = nextStep(it);
        right += K.rowHtml({ key: 'lv', ico: K.itemIco(KB[c.k].mat), name: KB[c.k].ch + ' Lv' + c.lv + ' → Lv' + st.to, color: '#fdba74', desc: esc(KB[c.k].d(KB[c.k].v[st.to - 1], KB[c.k].v2 ? KB[c.k].v2[st.to - 1] : 0)),
          req: reqHtml(st.need), btns: [['up:', '升到 Lv' + st.to, !missOf(st.need)]] }, 'data-cv');
      } else if (!sealed(c)) {
        DIR_KEYS.forEach(function (k) {
          var st2 = nextStep(it, k), D = DIRS[k];
          right += K.rowHtml({ key: 'dir-' + k, ico: K.itemIco(D.mat), name: '升成「' + D.n + '之印記」Lv1', color: D.c, desc: '原本的效果 ×1.5；' + esc(D.d(0)) + '<br>3 格：' + esc(SETS[k][0]) + '<br>6 格：' + esc(SETS[k][1]),
            req: reqHtml(st2.need), btns: [['up:' + k, '升成印記', !missOf(st2.need)]] }, 'data-cv');
        });
      } else if (c.s < 5) {
        var st3 = nextStep(it), D3 = DIRS[c.dir];
        right += K.rowHtml({ key: 'seal', ico: K.itemIco(D3.mat), name: D3.n + '之印記 Lv' + c.s + ' → Lv' + st3.to, color: D3.c, desc: esc(D3.d(st3.to - 1)),
          req: reqHtml(st3.need), btns: [['up:', '升到 Lv' + st3.to, !missOf(st3.need)]] }, 'data-cv');
      } else right += '<div class="ax-note">已經升到最高了。</div>';
      // 轉移
      var sd = slotOf(DB.items[it.id]);
      var cands = (p.inv || []).filter(function (x) { return x && !x.lock && slotOf(DB.items[x.id]) === sd && (c ? !cv(x) : !!cv(x)); }).slice(0, 30);
      right += '<div class="ax-h">轉移</div>';
      if (!cands.length) right += '<div class="ax-note">' + (c ? '背包裡沒有同部位、還沒刻印的裝備。' : '背包裡沒有同部位、有刻印的裝備。') + '</div>';
      cands.forEach(function (x) {
        var from = c ? 'eq:' + ui.slot : 'inv:' + x.uid, to = c ? 'inv:' + x.uid : 'eq:' + ui.slot, src = c ? it : x, fee = ACT.fee(src);
        right += K.rowHtml({ key: 'mv-' + x.uid, ico: K.invIco(x, 'inv'), name: c ? '移到這件：' + K.fullName(x) : '移到身上：【' + esc(label(cv(x))) + '】', color: '#e2e8f0', desc: c ? '' : K.fullName(x),
          req: K.reqTxt(have('gold'), fee, '金幣'), btns: [['mv:' + from + '>' + to, '轉移', have('gold') >= fee]] }, 'data-cv');
      });
    }
    h += '<div class="cv-grid"><div>' + left + '</div><div>' + right + '</div></div>';
    // 兌換
    var opt = function (cur) { return KINDS.map(function (k) { return '<option value="' + k.k + '"' + (k.k === cur ? ' selected' : '') + '>' + esc(nm(k.mat)) + '（' + fmt(have(k.mat)) + '）</option>'; }).join(''); };
    var a = KB[ui.exFrom] || KINDS[0];
    h += '<div class="ax-h">材料兌換</div>' + K.rowHtml({ key: 'ex', ico: K.itemIco(a.mat), name: '刻印材料 ' + EX.n + ' 個 → 其他種 1 個', color: '#fde68a',
      pick: '<select id="afk-cv-exf" aria-label="拿出去的材料">' + opt(ui.exFrom) + '</select> → <select id="afk-cv-ext" aria-label="換回來的材料">' + opt(ui.exTo) + '</select>',
      req: K.reqTxt(have(a.mat), EX.n, esc(nm(a.mat))) + '　' + K.reqTxt(have('gold'), EX.gold, '金幣'),
      btns: [['ex:1', '換 1 個', have(a.mat) >= EX.n && have('gold') >= EX.gold && ui.exFrom !== ui.exTo], ['ex:10', '換 10 個', have(a.mat) >= EX.n * 10 && have('gold') >= EX.gold * 10 && ui.exFrom !== ui.exTo]] }, 'data-cv');
    h += '<div class="ax-err">' + esc(ui.err) + '</div><div class="ax-msg">' + esc(ui.msg) + '</div>';
    return h;
  };
  var getItemFullNameSafe = function (it) { try { return getItemFullName(it); } catch (e) { return nm(it.id); } };
  var render = function (host) {
    var p = P(); if (!host) return;
    if (!p || !on(p)) { host.innerHTML = '<div class="ax-note">「刻刀今天不出鞘。」</div>'; return; }
    css(); K.repaint(host, html());
  };
  var bind = function (host) {
    host.addEventListener('click', function (ev) {
      var s = ev.target.closest('[data-cvs]'); if (s) { ui.slot = s.getAttribute('data-cvs'); ui.err = ''; ui.msg = ''; render(host); return; }
      var b = ev.target.closest('button[data-cv]'); if (!b || b.disabled) return;
      var a = b.getAttribute('data-cv'), err = null;
      if (a.indexOf('up:') === 0) err = ACT.up(ui.slot, a.slice(3) || undefined);
      else if (a.indexOf('mv:') === 0) { var q = a.slice(3).split('>'); err = ACT.move(q[0], q[1]); }
      else if (a.indexOf('ex:') === 0) err = ACT.exchange(ui.exFrom, ui.exTo, Number(a.slice(3)));
      ui.err = err || ''; ui.msg = err ? '' : '完成了。';
      render(host);
    });
    host.addEventListener('change', function (ev) {
      var id = ev.target.id, v = ev.target.value;
      if (id === 'afk-cv-exf') ui.exFrom = v; else if (id === 'afk-cv-ext') ui.exTo = v; else return;
      ui.err = ''; ui.msg = ''; render(host);
    });
  };
  var embed = function (div) {
    if (!div) return;
    var host = document.createElement('div'); host.className = 'afk-ax'; host.id = 'afk-cv';
    div.innerHTML = ''; div.appendChild(host);
    ui.err = ''; ui.msg = '';
    render(host); bind(host);
  };
  K.hookNpc(NPC_ID, NPC_N, '刻印師', embed);

  var api = W.__afkCarve = { NPC_ID: NPC_ID, KINDS: KINDS, KB: KB, DIRS: DIRS, SETS: SETS, ENG_COST: ENG_COST, SEAL_COST: SEAL_COST, EX: EX, MOVE: MOVE, SLOTS: SLOTS, DROPS: DROPS, SEAL_DROPS: SEAL_DROPS, RATE: RATE,
    CURSE: CURSE, ETCH: ETCH, FURY_N: FURY_N, KUN_ARMOR: KUN_ARMOR, KUN_DUR: KUN_DUR, SEAL_X: SEAL_X,
    fx: fx, bump: bump, cv: cv, label: label, kindVal: kindVal, act: ACT, nextStep: nextStep, have: have, durTotal: durTotal, durParts: durParts, durTick: durTick,
    onKill: onKill, dealt: dealt, ui: ui, embed: embed, render: render, paint: paint, mapName: mapName, stats: function () { return Object.assign({}, stats); }, ctx: ctx,
    roll: function () { return Math.random(); } };
  console.log('[AFK-carve] 已啟用：歐瑞村莊刻印師邪迪克爾（刻印與印記）');
})();
