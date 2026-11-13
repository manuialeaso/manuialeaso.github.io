/* ============================================================================
 * afk-talent3.js — 第三套天賦「匣之」＋匣之聖衣、血魔聖衣、鐵聖衣的數值（Ping 2026-11-13 04:26～12:41 定案；設計稿 docs/talent3-design.md）
 *
 *   開放：極意的融會 ★3。點數跟極意同一條來源（巔峰 500 等以後每 3 等 1 點），極意 170 點之後接著算，最多 500 點（巔峰 2510 等拿滿）。
 *   點法照極意：六系選三系；A／B 5 顆×3 點、N1／N2 5 顆×7 點、N3 3 顆×10 點、K 24 點（一系 154 點）；融會 3 點＋升星 10／10／15 點。
 *   效果只在「穿著聖衣」（聖衣變身中、不是碎裂）時有效。紀錄：player.afkTal3 = { o, n, j }。只有你自己。
 *
 *   聖衣數值（穿著那件；跟原本的神聖衣比）：
 *     神聖衣（原本）六項能力 +100、五屬性抗性 +300、爆擊傷害 +120%
 *     血魔聖衣 +110／+300／+130%，真實傷害 +5%；鐵聖衣 +110／+350／+120%，真實減傷 +5%（換法在 merged/cloth-progression）
 *     匣之聖衣（開啟匣之後，神聖衣、血魔、鐵聖衣都升上去）+150／+400／+200%，真實傷害 +10%、真實減傷 +10%
 *     真實傷害、真實減傷跟巔峰那兩項相加，各自最多 25%。
 *   近似做法見 docs/formulas.md「匣之」。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'talent3', name: '第三套天賦「匣之」與匣之聖衣', group: '遊戲玩法', desc: '極意融會 ★3 後開放的第三套天賦（全部強化聖衣），以及匣之聖衣、血魔聖衣、鐵聖衣的數值' });
  if (T && !T.enabled('talent3')) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var G = function () { return W.LineageGrowth; };
  var now = function () { return Date.now(); };
  var T2 = function () { return W.LineageTalent2; };

  // ── 聖衣 ──
  var CA = function () { return W.AFK_CARD_ASCENSION; };
  var clothOn = function (p) { var s = p && p.cardAscension; return s && s.clothOn ? s.clothOn : null; };
  var clothRec = function (p, id) { var s = p && p.cardAscension; return s && s.cloth && s.cloth[id] || null; };
  var wearing = function (p) {   // 聖衣變身中（不是碎裂、沒有封印）
    try { var A = CA(); if (!A || !p || p.classicMode) return false; var r = A.active(p); if (!r || r.tier !== 'samsara') return false; if (A.sealed && A.sealed(r.id, p)) return false; var c = clothRec(p, r.id); return !(c && (c.broken || c.recoveryPending)); } catch (e) { return false; }
  };
  var opened = function (p) { try { var t = T2() && T2().data(p); return !!(t && t.j >= 3); } catch (e) { return false; } };
  // 穿著那件聖衣的等級：casket（匣之）／blood／iron／divine／null
  var clothTier = function (p) {
    var id = clothOn(p); if (!id) return null; var c = clothRec(p, id); if (!c || !c.ex) return null;
    if (opened(p)) return 'casket'; return c.special === 'blood' ? 'blood' : c.special === 'iron' ? 'iron' : 'divine';
  };
  var TIER = { divine: { st: 100, res: 300, cd: 120, td: 0, tf: 0 }, blood: { st: 110, res: 300, cd: 130, td: 5, tf: 0 }, iron: { st: 110, res: 350, cd: 120, td: 0, tf: 5 }, casket: { st: 150, res: 400, cd: 200, td: 10, tf: 10 } };

  // ── 樹的資料 ──
  var SEC = [['A', 5, 3], ['B', 5, 3], ['N1', 5, 7], ['N2', 5, 7], ['N3', 3, 10], ['K', 1, 24]];
  var SECNAME = { A: 'A', B: 'B', N1: 'N1', N2: 'N2', N3: 'N3', K: '核心' };
  var STAR_COST = [3, 10, 10, 15], STAR_MULT = [1, 1.2, 1.8, 2], MAXPTS = 500, BEFORE = 170;
  var five = function (a, b) { return [a, a, a, a, b]; };
  var DIRS = {
    glory: { name: '星輝', sub: '基本加成', color: '#f5e6b8', A: five({ st: 2 }, { st: 5 }), B: five({ res: 10 }, { res: 25 }), N1: { ccd: 4 }, N2: { hp: 1 },
      N3: [{ st: 10 }, { clothPct: 10 }, { morphHeal: 10 }], K: { clothPct: 30 }, kName: '群星', kText: '聖衣的六項能力、五屬性抗性、爆擊傷害 ×1.3' },
    zodiac: { name: '星座', sub: '星座能力', color: '#7fa7ff', A: five({ zodV: 1 }, { zodV: 3 }), B: { zodV: 5 }, N1: { zodV: 3 }, N2: { zodV: 2 },
      N3: [{ zodV: 10 }, { zodAlly: 1 }, { zodMp: 2 }], K: { zodV: 50 }, kName: '星宿', kText: '星座能力造成的額外效果 ×1.5' },
    soul: { name: '星魂', sub: '續航', color: '#7fe0c4', A: five({ hpR: 2 }, { hpR: 6 }), B: five({ mpR: 2 }, { mpR: 6 }), N1: { leech: .3 }, N2: { healRecv: 2 },
      N3: [{ lowHeal: 20 }, { castMp: 1 }, { killHeal: 2 }], K: { soulK: 1 }, kName: '不滅星魂', kText: '受到致命傷害時保住 1 HP，並無敵 3 秒；120 秒一次' },
    burst: { name: '星爆', sub: '輸出', color: '#ffb35c', A: five({ dmg: .5 }, { dmg: 2 }), B: five({ crit: .3 }, { crit: 1 }), N1: { skillDmg: 2 }, N2: { atkDmg: 2 },
      N3: [{ morphDmg: 15 }, { starburst: 5 }, { ignore: 3 }], K: { burstK: 1 }, kName: '星爆', kText: '每 20 秒，下一次一般攻擊對全部敵人造成 300% 傷害' },
    sanct: { name: '聖域', sub: '防守', color: '#cfe3ff', A: five({ dr: .3 }, { dr: 1 }), B: five({ hp: 1 }, { hp: 3 }), N1: { shield: 3 }, N2: { critDef: 2 },
      N3: [{ lowDr: 10 }, { statusRes: 5 }, { shieldTick: 5 }], K: { sanctK: 8 }, kName: '聖域', kText: '全隊受到的傷害 −8%' },
    end: { name: '終焉', sub: '頭目、升星', color: '#ff7a6b', A: five({ boss: .5 }, { boss: 2 }), B: five({ bossDef: .3 }, { bossDef: 1 }), N1: { starAll: 20 }, N2: { starPct: 1 },
      N3: [{ starMat: 1 }, { bossHalf: 8 }, { finalDr: 5 }], K: { starPlus: 1 }, kName: '終焉', kText: '升星的效果多算 1 星' }
  };
  var ORDER = ['glory', 'zodiac', 'soul', 'burst', 'sanct', 'end'];
  var LABEL = {
    st: ['聖衣的六項能力', ''], res: ['聖衣的五屬性抗性', ''], ccd: ['聖衣的爆擊傷害', '%'], hp: ['HP 上限', '%'], clothPct: ['聖衣的三項基本效果', '%'], morphHeal: ['變身時全隊回 HP', '%'],
    zodV: ['星座能力造成的額外效果', '%'], zodAlly: ['星座能力觸發時，傭兵也各回 1% HP', ''], zodMp: ['星座能力觸發時回 MP', '%'],
    hpR: ['HP 自然恢復', '%'], mpR: ['MP 自然恢復', '%'], leech: ['傷害轉換 HP', '%'], healRecv: ['受到的治療', '%'], lowHeal: ['HP 首次 < 30% 時回 HP（60 秒一次）', '%'], castMp: ['施放技能回 MP', '%'], killHeal: ['擊殺回 HP', '%'],
    dmg: ['造成的傷害', '%'], crit: ['爆擊率', ' 百分點'], skillDmg: ['技能傷害', '%'], atkDmg: ['一般攻擊傷害', '%'], morphDmg: ['變身後 10 秒內傷害', '%'], starburst: ['爆擊時星爆（全部敵人 100% 傷害）的機率', '%'], ignore: ['無視目標傷害減免', '%'],
    dr: ['受到的傷害', '%', true], shield: ['自己產生的護盾量', '%'], critDef: ['受到的爆擊傷害', '%', true], lowDr: ['HP < 30% 時受到的傷害', '%', true], statusRes: ['受到的持續傷害', '%', true], shieldTick: ['每 30 秒得到最大 HP 護盾', '%'],
    boss: ['對頭目傷害', '%'], bossDef: ['受到頭目傷害', '%', true], starAll: ['升星效果套用到所有頭目', '%'], starPct: ['每星的效果', '%'], starMat: ['（升星材料少 1 片：尚未開放，先改為每星效果 +1%）', ''], bossHalf: ['頭目 HP < 50% 時傷害', '%'], finalDr: ['最終頭目戰受到的傷害', '%', true]
  };
  var COMBO = {
    'glory+zodiac+soul': ['星海', '星座能力觸發時，回復 3% 最大 HP', { cHealZ: 3 }],
    'glory+zodiac+burst': ['群星', '星座能力觸發後，下一擊傷害 +30%', { cNextZ: 30 }],
    'glory+zodiac+sanct': ['星盾', '星座能力觸發時，得到最大 HP 5% 護盾', { cShieldZ: 5 }],
    'glory+zodiac+end': ['宿命', '對頭目時，星座能力造成的額外效果 +20%', { cZodBoss: 20 }],
    'glory+soul+burst': ['燃魂', 'HP 高於 80% 時，造成的傷害 +10%', { cHighHp: 10 }],
    'glory+soul+sanct': ['不朽', 'HP 低於 50% 時，HP 自然恢復 +100%', { cLowRegen: 100 }],
    'glory+soul+end': ['長征', '頭目戰每經過 10 秒，傷害 +2%（最多 +20%）', { cMarch: 2 }],
    'glory+burst+sanct': ['光甲', '爆擊時 5% 機率得到最大 HP 3% 護盾', { cLightArmor: 3 }],
    'glory+burst+end': ['王殺', '對頭目的爆擊傷害 +20%', { cKingCrit: 20 }],
    'glory+sanct+end': ['金身', '受到頭目的傷害 −8%', { cGold: 8 }],
    'zodiac+soul+burst': ['星血', '星座能力觸發後 10 秒，造成傷害的 3% 轉為 HP', { cStarBlood: 3 }],
    'zodiac+soul+sanct': ['庇護', '星座能力觸發時，全隊回 5% HP', { cShelter: 5 }],
    'zodiac+soul+end': ['星辰不滅', '「不滅星魂」觸發後 5 秒內，傷害 +30%', { cUndying: 30 }],
    'zodiac+burst+sanct': ['星環', '星座能力觸發時，全部敵人受到 100% 傷害', { cRing: 100 }],
    'zodiac+burst+end': ['審判之星', '對頭目時，星座能力造成的額外效果 +50%（觸發機率 +5% 的近似）', { cZodBoss: 50 }],
    'zodiac+sanct+end': ['守宮', '頭目戰中，星座能力造成的額外效果 +30%（持續時間 +30% 的近似）', { cZodBoss: 30 }],
    'soul+burst+sanct': ['戰魂', '每次擊殺，5 秒內傷害 +5%（最多 +20%）', { cWarSoul: 5 }],
    'soul+burst+end': ['嗜王', '對頭目造成傷害的 2% 轉為 HP', { cBossLeech: 2 }],
    'soul+sanct+end': ['長城', '頭目戰中，每 15 秒回 5% HP', { cWall: 5 }],
    'burst+sanct+end': ['天譴', '每 20 秒，對頭目打出一次 500% 傷害', { cWrath: 500 }]
  };
  var comboKey = function (o) { return o.slice().sort(function (a, b) { return ORDER.indexOf(a) - ORDER.indexOf(b); }).join('+'); };

  // ── 規則（同極意）──
  var parse = function (id) { var m = /^(\w+)\.(A|B|N1|N2|N3|K)\.(\d)$/.exec(id || ''); if (!m || !DIRS[m[1]]) return null; var s = SEC.filter(function (x) { return x[0] === m[2]; })[0]; if (+m[3] < 1 || +m[3] > s[1]) return null; return { d: m[1], s: m[2], i: +m[3], cost: s[2] }; };
  var fresh = function () { return { o: [], n: [], j: -1 }; };
  var data = function (p) { p = p || P(); if (!p) return null; var t = p.afkTal3; if (!t || typeof t !== 'object' || !Array.isArray(t.o) || !Array.isArray(t.n)) t = p.afkTal3 = fresh(); if (t.j == null) t.j = -1; return t; };
  var complete = function (t, d, s) { var n = SEC.filter(function (x) { return x[0] === s; })[0][1]; for (var i = 1; i <= n; i++) if (t.n.indexOf(d + '.' + s + '.' + i) < 0) return false; return true; };
  var spent = function (t) { var s = 0; t.n.forEach(function (id) { var x = parse(id); s += x ? x.cost : 0; }); for (var k = 0; k <= t.j; k++) s += STAR_COST[k]; return s; };
  var earned = function (p) { try { return opened(p) ? Math.max(0, Math.min(MAXPTS, T2().pool(p) - BEFORE)) : 0; } catch (e) { return 0; } };
  var canAdd = function (t, id) {
    var x = parse(id); if (!x || t.n.indexOf(id) >= 0) return false;
    var pos = t.o.indexOf(x.d);
    if (pos < 0) { if (t.o.length >= 3 || (t.o.length && !complete(t, t.o[t.o.length - 1], 'K'))) return false; }
    else if (t.o.slice(0, pos).some(function (d) { return !complete(t, d, 'K'); })) return false;
    if (x.i > 1 && t.n.indexOf(x.d + '.' + x.s + '.' + (x.i - 1)) < 0) return false;
    var pre = { N1: ['A'], N2: ['B'], N3: ['A', 'B', 'N1', 'N2'], K: ['N3'] }[x.s] || [];
    return pre.every(function (s) { return complete(t, x.d, s); });
  };
  var allK = function (t) { return t.o.length === 3 && t.o.every(function (d) { return complete(t, d, 'K'); }); };
  var nodeEff = function (id) { var x = parse(id); if (!x) return {}; var def = DIRS[x.d][x.s]; if (Array.isArray(def)) return def[x.i - 1] || {}; return def; };
  var sig = '', cache = {};
  var effAll = function (p) {
    var t = data(p); if (!t || !t.n.length) return {};
    var s = t.n.join(',') + '|' + t.j + '|' + t.o.join(','); if (s === sig) return cache;
    var e = {}; t.n.forEach(function (id) { var v = nodeEff(id); for (var k in v) e[k] = (e[k] || 0) + v[k]; });
    if (e.starMat) { e.starPct = (e.starPct || 0) + e.starMat; delete e.starMat; }
    if (t.j >= 0 && allK(t)) { var c = COMBO[comboKey(t.o)]; if (c) { var m = STAR_MULT[t.j]; for (var k2 in c[2]) e[k2] = (e[k2] || 0) + c[2][k2] * m; } if (t.j >= 3) e.finalDmg = (e.finalDmg || 0) + 2; }
    sig = s; cache = e; return e;
  };
  // 實際生效：要開放、你自己、穿著聖衣
  var eff = function (p) { p = p || P(); if (!p || p !== P() || p.classicMode || !opened(p) || !wearing(p)) return {}; return effAll(p); };
  var E = function (k, p) { return N(eff(p)[k]); };

  // ── 操作 ──
  var save = function () { try { if (typeof saveGame === 'function') saveGame(); } catch (e) {} try { if (typeof recomputeStats === 'function') recomputeStats(); } catch (e) {} };
  var addNode = function (id) {
    var p = P(), t = data(p); if (!p || !t) throw Error('沒有角色'); if (!opened(p)) throw Error('極意的融會 ★3 開放');
    var x = parse(id); if (!x || !canAdd(t, id)) throw Error('還沒滿足前置節點'); if (spent(t) + x.cost > earned(p)) throw Error('匣之點數不夠');
    if (t.o.indexOf(x.d) < 0) t.o.push(x.d); t.n.push(id); sig = ''; save();
  };
  var starUp = function () { var p = P(), t = data(p); if (!allK(t)) throw Error('三系的核心都點了才能點融會'); if (t.j >= 3) throw Error('融會已經 ★3'); var c = STAR_COST[t.j + 1]; if (spent(t) + c > earned(p)) throw Error('匣之點數不夠（需要 ' + c + ' 點）'); t.j++; sig = ''; save(); };
  var wash = function () { var p = P(), t = data(p); if (!t.n.length && t.j < 0) throw Error('匣之還沒有配點'); var g = G(); if (!g) throw Error('目前不能洗點'); return g.transaction('匣之洗點', function () { g.spendBlood(g.WASH || 50000); p.afkTal3 = fresh(); sig = ''; }); };

  // ── 畫面 ──
  var fmtEff = function (e) { return Object.keys(e).map(function (k) { var L = LABEL[k]; if (!L) return ''; if (k === 'zodAlly') return L[0]; if (k === 'starMat') return '每星的效果 +1%'; return L[0] + ' ' + (L[2] ? '−' : '+') + e[k] + L[1]; }).filter(Boolean).join('、'); };
  var nodeText = function (id) { var x = parse(id); if (!x) return ''; if (x.s === 'K') return DIRS[x.d].kName + '：' + DIRS[x.d].kText; return fmtEff(nodeEff(id)); };
  var view = { dir: 'glory' };
  var TIERNAME = { divine: '神聖衣', blood: '血魔聖衣', iron: '鐵聖衣', casket: '匣之聖衣' };
  // 星圖（跟天賦一樣一圈；共用 LineageGrowthViews.constellation）
  var xState = function (t, pts, used, op, id) { var x = parse(id); if (!x) return 'locked'; if (t.n.indexOf(id) >= 0) return 'lit'; return op && canAdd(t, id) && used + x.cost <= pts ? 'available' : 'locked'; };
  var xReason = function (st) { return st === 'lit' ? '已點亮' : st === 'available' ? '可點亮 · 點擊圓點配置' : '需先完成前置節點，或點數不夠；每系完成核心後才能選下一系（最多三系）。'; };
  var xInspect = function (id) {
    var p = P(), t = data(p); if (!p || !t) return ''; var x = parse(id); if (!x) return ''; var D = DIRS[x.d], st = xState(t, earned(p), spent(t), opened(P()), id);
    return '<span class="growth-eyebrow">' + D.name + ' · ' + (x.s === 'K' ? '核心' : x.s + ' · ' + x.i) + '</span><div class="growth-insignia" style="--branch:' + D.color + '"><span class="growth-emblem" style="background-image:url(assets/ui/growth-v5/tal3/tal3_icon_' + x.d + '.webp)"></span></div><h3>' + D.name + ' · ' + (x.s === 'K' ? '核心 K' : x.s + ' 節點 ' + x.i) + '</h3><p class="growth-effect">' + esc(nodeText(id)) + '</p><div class="growth-detail-cost"><span>點亮消耗</span><b>' + x.cost + ' 點</b></div><p class="growth-state ' + st + '">' + xReason(st) + '</p><div class="growth-inspect-rule">A／B 每顆 3 點、N1／N2 每顆 7 點<br>N3 每顆 10 點、核心 24 點<br>A → N1 · B → N2<br>四組全滿 → N3 → 核心<br>每系 154 點 · 三系核心後點融會<br>效果只在聖衣變身中有效</div>';
  };
  var xTree = function (t, pts, used, op) {
    var V = W.LineageGrowthViews; if (!V || !V.constellation) return '';
    return V.constellation({ cmd: 'ext:t3|', dirs: ORDER.map(function (d) { return { k: d, name: DIRS[d].name, sub: DIRS[d].sub, color: DIRS[d].color, icon: 'assets/ui/growth-v5/tal3/tal3_icon_' + d + '.webp', bg: 'assets/ui/growth-v5/tal3/tal3_bg_' + d + '.webp' }; }), dir: view.dir, order: t.o,
      costs: { A: SEC[0][2], B: SEC[1][2], N1: SEC[2][2], N2: SEC[3][2], N3: SEC[4][2], K: SEC[5][2] }, state: function (id) { return xState(t, pts, used, op, id); }, desc: nodeText, inspect: xInspect, selected: view.sel,
      coreLabel: function (d) { return DIRS[d].kName + ' · 核心 ' + SEC[5][2] + ' 點'; } });
  };
  var render = function () {
    var p = P(), t = data(p); if (!p || !t) return '';
    var op = opened(p), pts = earned(p), used = spent(t), tier = clothTier(p), w = wearing(p);
    var h = '<div class="growth-heading"><div><span class="growth-eyebrow">CASKET</span><h3>匣之</h3></div><div class="growth-balance"><b>' + Math.max(0, pts - used) + '</b><span>可用匣之點<small>已配置 ' + used + ' / ' + pts + '（最多 ' + MAXPTS + '）</small></span></div></div>';
    h += '<p class="t2-note">' + (op ? '極意 170 點之後，巔峰每 3 等再得到 1 點。全部效果只在穿著聖衣（聖衣變身中）時有效。' : '極意的融會升到 ★3 後開放。') + '</p>';
    var TV = TIER[tier || 'divine'];
    h += '<div class="t2-fuse"><span class="growth-eyebrow">SAINT CLOTH</span><b>' + (tier ? TIERNAME[tier] : '目前穿的不是神聖衣') + (w ? '' : '（現在沒有聖衣變身，效果不生效）') + '</b><small>' + (tier ? '六項能力 +' + TV.st + '、五屬性抗性 +' + TV.res + '、爆擊傷害 +' + TV.cd + '%' + (TV.td ? '、真實傷害 +' + TV.td + '%' : '') + (TV.tf ? '、真實減傷 +' + TV.tf + '%' : '') : '神聖衣、血魔聖衣、鐵聖衣在開啟匣之後會升成匣之聖衣：六項能力 +150、五屬性抗性 +400、爆擊傷害 +200%、真實傷害 +10%、真實減傷 +10%。') + '</small></div>';
    h += xTree(t, pts, used, opened(P()));
    var ck = t.o.length === 3 ? COMBO[comboKey(t.o)] : null;
    h += '<div class="t2-fuse"><span class="growth-eyebrow">FUSION</span><b>融會' + (ck ? '・' + esc(ck[0]) : '') + (t.j >= 0 ? ' ' + (t.j ? '★'.repeat(t.j) : '☆') : '') + '</b>';
    if (!ck) h += '<small>選滿三系後才知道是哪一種融會（六系選三共 20 種）。</small>';
    else { h += '<small>' + esc(ck[1]) + '</small><small>倍率：☆ ×1、★1 ×1.2、★2 ×1.8、★3 ×2（★3 另外最終傷害 +2%）；目前 ' + (t.j >= 0 ? '×' + STAR_MULT[t.j] : '未點') + '</small>'; var nx = t.j + 1, c2 = allK(t) && nx <= 3 && used + STAR_COST[nx] <= pts; if (nx <= 3) h += '<button type="button" class="growth-primary" data-growth="ext:t3|star|1" ' + (c2 ? '' : 'disabled') + '>' + (nx === 0 ? '點亮融會（3 點）' : '升到 ★' + nx + '（' + STAR_COST[nx] + ' 點）') + '</button>'; }
    h += '</div><div class="growth-bottom"><p class="growth-note">匣之跟極意用同一條點數來源，但分開配點、分開洗點。</p><div class="growth-actions"><button type="button" class="growth-primary" data-growth="ext:t3|wash|1">洗點（50,000 血龍鑽）</button></div></div>';
    return h;
  };
  var click = function (cmd, arg) { if (cmd === 'dir') { view.dir = arg; view.sel = arg + '.A.1'; return; } if (cmd === 'node') { view.sel = arg; var p0 = P(), t0 = data(p0); if (xState(t0, earned(p0), spent(t0), opened(P()), arg) === 'available') addNode(arg); return; } if (cmd === 'star') { starUp(); return; } if (cmd === 'wash') { if (!confirm('花 50,000 血龍鑽洗掉匣之目前的全部點數？\n點數會全部退還，讓你重新配一次。')) return; return wash(); } };
  (W.LineageGrowthExtraTabs = W.LineageGrowthExtraTabs || {}).t3 = { name: '匣之', order: 4, visible: function () { var p = P(); return !!(p && !p.classicMode && opened(p)); }, view: render, click: click, inspect: xInspect };

  // ════════ 聖衣數值 ════════
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = P(), tier = p && !p.classicMode && clothTier(p); if (!tier || !p.d) return r;
        var base = TIER.divine, tg = TIER[tier], e = eff(p), pct = 1 + N(e.clothPct) / 100;
        var dSt = tg.st * pct - base.st + N(e.st), dRes = tg.res * pct - base.res + N(e.res), dCd = tg.cd * pct - base.cd + N(e.ccd);
        if (dSt) ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (k) { if (typeof p.d[k] === 'number') p.d[k] += Math.round(dSt); });
        if (dRes) ['resNone', 'resFire', 'resWater', 'resWind', 'resEarth'].forEach(function (k) { p.d[k] = (p.d[k] || 0) + Math.round(dRes); });
        if (dCd) ['meleeCritDmg', 'rangedCritDmg', 'magicCritDmg'].forEach(function (k) { p.d[k] = (p.d[k] || 0) + dCd; });
        if (e.crit) { p.d.meleeCrit = N(p.d.meleeCrit) + e.crit; p.d.rangedCrit = N(p.d.rangedCrit) + e.crit; p.d.magicCrit = N(p.d.magicCrit) + e.crit; }
        var hp = N(e.hp); if (hp) p.mhp = Math.floor(N(p.mhp) * (1 + hp / 100));
        if (e.hpR) p.d.hpR = N(p.d.hpR) * (1 + e.hpR / 100);
        if (e.mpR) p.d.mpR = N(p.d.mpR) * (1 + e.mpR / 100);
      } catch (er) {}
      return r;
    };
  }
  // 真實傷害、真實減傷（跟巔峰相加，各自最多 25%）
  var hookPct = function () {
    var g = G(); if (!g || g.__afkT3Pct) return; var o = g.pct;
    g.pct = function (p, k) { var v = o.apply(this, arguments); try { if ((k === 'trueDamage' || k === 'trueDefense') && p && p === P() && wearing(p)) { var tier = clothTier(p); if (tier) { var add = k === 'trueDamage' ? TIER[tier].td : TIER[tier].tf; if (add) v = Math.min(25, N(v) + add); } } } catch (e) {} return v; };
    g.__afkT3Pct = true;
  };
  hookPct(); W.addEventListener('load', hookPct);

  // ════════ 天賦效果 ════════
  var st = function (p) { return p._afkT3s || (p._afkT3s = { lowHealAt: 0, soulAt: 0, invulnUntil: 0, undyingUntil: 0, nextZ: 0, starBloodUntil: 0, burstAt: 0, burstArm: false, morphAt: 0, lastCloth: null, shieldAt: 0, war: [], fight: null, wallAt: 0, wrathAt: 0, kills: 0 }); };
  var mhp = function (p) { return Math.max(1, N(p.mhp)); };
  var shieldOf = function (p, ratio, src) { try { var R = W.AFK_RELIC_RUNTIME; if (R && R.api && R.api.shield) R.api.shield(p, mhp(p) * ratio, { source: src, owner: p, duration: 8 }); } catch (e) {} };
  var heal = function (a, ratio) { try { if (a === P()) a.hp = Math.min(mhp(a), N(a.hp) + Math.floor(mhp(a) * ratio)); else if (a && !a._downed && a.mhp) a.curHp = Math.min(N(a.mhp), N(a.curHp) + Math.floor(N(a.mhp) * ratio)); } catch (e) {} };
  var allies = function (p) { return (p.allies || []).filter(function (a) { return a && !a._downed; }); };
  var bossNow = function () { try { return (mapState.mobs || []).filter(function (x) { return x && x.boss && x.curHp > 0 && !x._dead; })[0] || null; } catch (e) { return null; } };
  var stars = function (p) { var id = clothOn(p), s = p.cardAscension; return id && s && s.clothStars ? N(s.clothStars[id]) : 0; };
  var finalMob = function (m) { return !!(m && (m._afkFinal || m._afkApostle)); };
  var casting = 0, attacking = 0;

  // 星座能力觸發（造成的傷害比原本多出來的部分）
  var zodiacTrig = function (p, target, extra, e) {
    var S = st(p);
    if (e.zodMp) p.mp = Math.min(N(p.mmp), N(p.mp) + Math.floor(N(p.mmp) * e.zodMp / 100));
    if (e.zodAlly) allies(p).forEach(function (a) { heal(a, .01); });
    if (e.cHealZ) heal(p, e.cHealZ / 100);
    if (e.cNextZ) S.nextZ = e.cNextZ;
    if (e.cShieldZ) shieldOf(p, e.cShieldZ / 100, 'talent3-starshield');
    if (e.cStarBlood) S.starBloodUntil = now() + 10000;
    if (e.cShelter) { heal(p, e.cShelter / 100); allies(p).forEach(function (a) { heal(a, e.cShelter / 100); }); }
    if (e.cRing && G()) { var amt = Math.floor(extra * e.cRing / 100); if (amt > 0) (mapState.mobs || []).slice().forEach(function (m) { if (m && m !== target && m.curHp > 0 && !m._dead) G().secondaryHit(p, m, amt, 'magic'); }); }
  };

  // 星座能力（afk-card-combat 的獅子、天蠍、水瓶、雙子這類改變這一下傷害的）觸發時呼叫：多出來的部分 ×(1＋zodV%)
  W.__afkZodiacProc = function (actor, target, base, v, z) {
    try { var p = P(); if (!p || actor !== p) return v; var e = eff(p); if (!Object.keys(e).length) return v;
      var zv = N(e.zodV) + (target && target.boss ? N(e.cZodBoss) : 0); if (zv && v > base) v = base + (v - base) * (1 + zv / 100);
      zodiacTrig(p, target, Math.max(0, v - base), e); } catch (er) {}
    return v;
  };
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.__afkT3) return;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var p = P(), e = (p && actor === p) ? eff(p) : null, active = e && Object.keys(e).length;
      var r = o.apply(this, arguments);
      try {
        if (!active || !(r > 0) || !target) return r;
        var S = st(p), add = 0;
        add += N(e.dmg) + N(e.ignore);
        if (casting || ((opt && opt.kind) === 'magic')) add += N(e.skillDmg); else if (attacking) add += N(e.atkDmg);
        if (e.morphDmg && now() - S.morphAt < 10000) add += e.morphDmg;
        if (S.nextZ) { add += S.nextZ; S.nextZ = 0; }
        if (e.cHighHp && N(p.hp) / mhp(p) > .8) add += e.cHighHp;
        if (e.cUndying && now() < S.undyingUntil) add += e.cUndying;
        add += Math.min(20, S.war.filter(function (t) { return t > now(); }).length * N(e.cWarSoul));
        if (target.boss) {
          add += N(e.boss);
          if (e.bossHalf && target.curHp / Math.max(1, N(target.hp)) < .5) add += e.bossHalf;
          var sc = stars(p) + N(e.starPlus), per = 10 + N(e.starPct);
          if (sc && !finalMob(target) && e.starAll) add += sc * per * Math.min(100, e.starAll) / 100;
          if (sc && finalMob(target) && (e.starPct || e.starPlus)) add += N(e.starPlus) * per + stars(p) * N(e.starPct);
          if (e.cMarch) { var f = S.fight; if (!f || f.t !== target) f = S.fight = { t: target, at: now() }; add += Math.min(20, Math.floor((now() - f.at) / 10000) * e.cMarch); }
        }
        if (add) r = Math.max(1, Math.floor(r * (1 + add / 100)));
        if (e.finalDmg) r = Math.floor(r * (1 + e.finalDmg / 100));
        var lee = N(e.leech) + (now() < S.starBloodUntil ? N(e.cStarBlood) : 0) + (target.boss ? N(e.cBossLeech) : 0);
        if (lee && !p.dead) p.hp = Math.min(mhp(p), N(p.hp) + Math.floor(r * lee / 100));
      } catch (er) {}
      return r;
    };
    C.__afkT3 = true;
  };
  hookDamage(); W.addEventListener('load', hookDamage);

  // 一般攻擊、施法旗標；星爆 K；施法回 MP
  if (typeof W.playerAttack === 'function') { var oAtk = W.playerAttack; W.playerAttack = function () { attacking++; try { var p = P(), e = p && eff(p); if (e && e.burstK && now() >= st(p).burstAt) { st(p).burstAt = now() + 20000; st(p).burstArm = true; } return oAtk.apply(this, arguments); } finally { attacking--; } }; }
  if (typeof W.castSkill === 'function') { var oCast = W.castSkill; W.castSkill = function () { casting++; try { return oCast.apply(this, arguments); } finally { casting--; } }; }
  var hookEvent = function () {
    var g = G(); if (!g || g.__afkT3Ev) return; var o = g.event;
    g.event = function (name, c) {
      var r = o.apply(this, arguments);
      try {
        var p = P(); if (!p || !c) return r;
        if (name === 'beforeHeal' && (c.recipient || c.actor) === p) { var hr = E('healRecv', p); if (hr && c.amount > 0) c.amount *= 1 + hr / 100; return r; }
        if (c.actor !== p) return r; var e = eff(p); if (!Object.keys(e).length) return r; var S = st(p), t = c.target;
        if (name === 'onCast' && c.success && e.castMp) p.mp = Math.min(N(p.mmp), N(p.mp) + Math.floor(N(p.mmp) * e.castMp / 100));
        if (name === 'beforeHit' && t && c.critical && t.boss && e.cKingCrit) c.damage *= 1 + e.cKingCrit / 100;
        if (name === 'afterHit' && t) {
          var dmg = N(c.actualDamage || c.damage);
          if (c.critical && e.starburst && Math.random() * 100 < e.starburst && G()) (mapState.mobs || []).slice().forEach(function (m) { if (m && m !== t && m.curHp > 0 && !m._dead) G().secondaryHit(p, m, dmg, 'magic'); });
          if (c.critical && e.cLightArmor && Math.random() < .05) shieldOf(p, e.cLightArmor / 100, 'talent3-lightarmor');
          if (S.burstArm && G()) { S.burstArm = false; (mapState.mobs || []).slice().forEach(function (m) { if (m && m.curHp > 0 && !m._dead) G().secondaryHit(p, m, dmg * 3, 'magic'); }); }
        }
      } catch (er) {}
      return r;
    };
    g.__afkT3Ev = true;
  };
  hookEvent(); W.addEventListener('load', hookEvent);

  // 受到的傷害
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob, kind) {
    var p = P(); if (!p || !ent) return 1; var e = eff(p); if (!Object.keys(e).length) return 1;
    var cut = 0; if (e.sanctK) cut += e.sanctK;   // 聖域 K：全隊
    if (ent === p) {
      cut += N(e.dr); if (!mob) cut += N(e.statusRes);
      if (N(p.hp) / mhp(p) < .3) cut += N(e.lowDr);
      if (mob && mob.boss) { cut += N(e.bossDef) + N(e.cGold); if (finalMob(mob)) cut += N(e.finalDr); }
    }
    return Math.max(0, 1 - cut / 100);
  });
  var oCrit = W.__afkEnemyCritDef;
  W.__afkEnemyCritDef = function (ent) { var v = typeof oCrit === 'function' ? N(oCrit(ent)) : 0; try { if (ent === P()) v += E('critDef', ent); } catch (e) {} return v; };
  var hookTaken = function () {
    var o = W.__afkTaken; if (typeof o !== 'function' || W.__afkT3Taken) return; W.__afkT3Taken = true;
    W.__afkTaken = function (ent) {
      var v = o.apply(this, arguments);
      try {
        var p = P(); if (!(v > 0) || ent !== p) return v; var e = eff(p); if (!Object.keys(e).length) return v; var S = st(p);
        if (now() < S.invulnUntil) return 0;
        var hp = N(p.hp);
        if (e.soulK && v >= hp && now() >= S.soulAt) { S.soulAt = now() + 120000; S.invulnUntil = now() + 3000; if (e.cUndying) S.undyingUntil = now() + 5000; v = Math.max(0, hp - 1); try { logCombat('<span class="font-bold" style="color:#7fe0c4">【不滅星魂】</span>你撐住了致命的一擊。', 'heal'); } catch (er) {} }
        if (e.lowHeal && (hp - v) / mhp(p) < .3 && now() >= S.lowHealAt) { S.lowHealAt = now() + 60000; setTimeout(function () { heal(p, e.lowHeal / 100); }, 0); }
      } catch (er) {}
      return v;
    };
  };
  hookTaken(); W.addEventListener('load', hookTaken);

  // 護盾量
  var hookShield = function () { var R = W.AFK_RELIC_RUNTIME; if (!R || !R.api || typeof R.api.shield !== 'function' || R.api.__afkT3) return; var o = R.api.shield; R.api.shield = function (actor, amount, opt) { try { var x; if (actor === P() && (x = E('shield'))) amount = amount * (1 + x / 100); } catch (e) {} return o.call(this, actor, amount, opt); }; R.api.__afkT3 = true; };
  hookShield(); W.addEventListener('load', hookShield);

  // 擊殺：回 HP、戰魂
  if (typeof W.killMob === 'function') { var oKill = W.killMob; W.killMob = function (i) { try { var p = P(), e = p && eff(p); if (e && Object.keys(e).length) { if (e.killHeal) heal(p, e.killHeal / 100); if (e.cWarSoul) { var S = st(p); S.war = S.war.filter(function (t) { return t > now(); }); S.war.push(now() + 5000); } } } catch (er) {} return oKill.apply(this, arguments); }; }

  // 每秒：變身偵測（變身瞬間全隊回 HP、變身後 10 秒）、每 30 秒護盾、不朽、長城、天譴
  setInterval(function () {
    try {
      var p = P(); if (!p || p.dead || typeof state === 'undefined' || !state.running) return; var S = st(p), w = wearing(p), cur = w ? clothOn(p) : null;
      if (cur && cur !== S.lastCloth) { S.morphAt = now(); var e0 = eff(p); if (e0.morphHeal) { heal(p, e0.morphHeal / 100); allies(p).forEach(function (a) { heal(a, e0.morphHeal / 100); }); } }
      S.lastCloth = cur; if (!w) return; var e = eff(p); if (!Object.keys(e).length) return;
      if (e.shieldTick && now() - S.shieldAt >= 30000) { S.shieldAt = now(); shieldOf(p, e.shieldTick / 100, 'talent3-sanct'); }
      if (e.cLowRegen && N(p.hp) / mhp(p) < .5) p.hp = Math.min(mhp(p), N(p.hp) + Math.floor(N(p.d && p.d.hpR) * e.cLowRegen / 100));
      var b = bossNow();
      if (b && e.cWall && now() - S.wallAt >= 15000) { S.wallAt = now(); heal(p, e.cWall / 100); }
      if (b && e.cWrath && now() - S.wrathAt >= 20000 && G()) { S.wrathAt = now(); var atk = Math.max(1, N(p.d && (p.d.meleeDmg || p.d.magicDmg || p.d.rangedDmg))) * 10; G().secondaryHit(p, b, Math.floor(atk * e.cWrath / 100), 'magic'); }
    } catch (er) {}
  }, 1000);

  W.LineageTalent3 = { DIRS: DIRS, COMBO: COMBO, data: data, eff: eff, effAll: effAll, spent: spent, earned: earned, opened: opened, wearing: wearing, clothTier: clothTier, TIER: TIER, canAdd: canAdd, addNode: addNode, starUp: starUp, wash: wash, comboKey: comboKey, nodeText: nodeText, MAXPTS: MAXPTS };
})();
