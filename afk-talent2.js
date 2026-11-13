/* ============================================================================
 * afk-talent2.js — 第二套天賦「極意」（Ping 2026-11-13 03:54／04:26 定案；設計稿 docs/talent2-design.md）
 *
 *   開放：巔峰 500 等以後，每 3 等 1 點（巔峰點數另外算，不共用）。極意本體 135 點＋融會升星 35 點＝170 點（巔峰 1010 等拿滿）。
 *   點法照第一套天賦：六系選三系依序點；A／B 5 顆×1 點、N1／N2 5 顆×2 點、N3 3 顆×3 點、K 1 顆×5 點；三系 K 都點了才能點融會（3 點），
 *   融會可升星 ★1／★2／★3（10／10／15 點），效果 ×1.2／×1.8／×2，★3 另外最終傷害 +2%。點了就鎖定，洗點 50,000 血龍鑽。
 *   紀錄：player.afkTal2 = { o: [系…], n: ['crit.A.1', …], j: -1（沒點融會）／0（☆）／1～3（★） }。只有你自己（天賦本來就只有玩家）。
 *   效果的掛點與近似做法見 docs/formulas.md「極意」。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'talent2', name: '第二套天賦「極意」', group: '遊戲玩法', desc: '巔峰 500 等開放的第二套天賦（六系選三、融會 20 種組合、可升星）' });
  if (T && !T.enabled('talent2')) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var G = function () { return W.LineageGrowth; };
  var now = function () { return Date.now(); };

  // ── 樹的資料 ──
  var SEC = [['A', 5, 1], ['B', 5, 1], ['N1', 5, 2], ['N2', 5, 2], ['N3', 3, 3], ['K', 1, 5]];
  var SECNAME = { A: 'A', B: 'B', N1: 'N1', N2: 'N2', N3: 'N3', K: '核心' };
  var STAR_COST = [3, 10, 10, 15], STAR_MULT = [1, 1.2, 1.8, 2];
  var five = function (a, b) { return [a, a, a, a, b]; };
  var DIRS = {
    crit: { name: '斷罪', sub: '爆擊', color: '#e05252', A: five({ critRate: .3 }, { critRate: 1, critDmg: 5 }), B: five({ critDmg: 2 }, { critDmg: 2 }), N1: { critIgnore: 1 }, N2: { critDmg: 3 },
      N3: [{ critRate: 1 }, { critDmg: 6 }, { critHeal: .5 }], K: { critK: 1 }, kName: '斷罪', kText: '連續 3 次爆擊後，下一次一般攻擊必定是強力一擊（傷害 ×1.5，再加爆擊傷害 +50%）；冷卻 6 秒' },
    chase: { name: '連環', sub: '追擊', color: '#f08a3c', A: five({ aspd: .5 }, { aspd: 2 }), B: five({ chase: .3 }, { chase: 1 }), N1: { chaseDmg: 3 }, N2: { aspd: 1 },
      N3: [{ chase: 1 }, { chaseDmg: 5 }, { chaseMp: 1 }], K: { chaseK: 1 }, kName: '連環', kText: '每第 10 次一般攻擊，必定追擊 2 次' },
    dot: { name: '蝕骨', sub: '持續傷害', color: '#62b85a', A: five({ dot: 1 }, { dot: 3 }), B: five({ debuffDur: 2 }, { debuffDur: 2 }), N1: { vsDebuff: 1 }, N2: { dot: 2 },
      N3: [{ debuffHit: 2 }, { dot: 5 }, { dotSpread: 1 }], K: { dotK: 1 }, kName: '蝕骨', kText: '目標身上每有 1 種負面狀態，你對它的傷害 +3%，最多 +15%' },
    boss: { name: '征王', sub: '頭目', color: '#d9a441', A: five({ boss: .5 }, { boss: 2 }), B: five({ bossDef: .3 }, { bossDef: 1 }), N1: { bossCrit: .5 }, N2: { boss: 1 },
      N3: [{ bossLow: 5 }, { bossSkillDef: 3 }, { bossIgnore: 2 }], K: { bossK: 1 }, kName: '征王', kText: '10 秒內對同一隻頭目命中 20 次，接下來 10 秒你對它的傷害 +10%；冷卻 20 秒' },
    guard: { name: '壁壘', sub: '防守', color: '#7d8fa8', A: five({ finalDef: .2 }, { finalDef: 1 }), B: five({ hp: 1 }, { hp: 3 }), N1: { shield: 2 }, N2: { aoeDef: 1 },
      N3: [{ critDef: 5 }, { dotDef: 5 }, { lowDef: 5 }], K: { guardK: 1 }, kName: '壁壘', kText: '單次受到超過最大 HP 30% 的傷害時，那一下減半；冷卻 20 秒' },
    time: { name: '時律', sub: '冷卻', color: '#6cc6d9', A: five({ cdr: .2 }, { cdr: 1 }), B: five({ mpCut: .5 }, { mpCut: 2 }), N1: { buffDur: 2 }, N2: { castSpd: 1 },
      N3: [{ classCd: 3 }, { dragonCd: 3 }, { cdReset: 2 }], K: { timeK: 1 }, kName: '時律', kText: '每施放 5 次流派技能，下一次不進冷卻（大絕除外）' }
  };
  var ORDER = ['crit', 'chase', 'dot', 'boss', 'guard', 'time'];
  var LABEL = {
    critRate: ['爆擊率', ' 百分點'], critDmg: ['爆擊傷害', '%'], critIgnore: ['爆擊時無視目標傷害減免', '%'], critHeal: ['爆擊時回復最大 HP', '%（每秒最多 1 次）'],
    aspd: ['攻擊速度', '%'], chase: ['追擊機率', '%'], chaseDmg: ['追擊、連擊造成的傷害', '%'], chaseMp: ['追擊命中回 MP', ''],
    dot: ['中毒、流血、燃燒傷害', '%'], debuffDur: ['你施加的負面狀態持續時間', '%'], vsDebuff: ['對有負面狀態的目標傷害', '%'], debuffHit: ['負面狀態命中', '%'], dotSpread: ['目標死亡時，身上的中毒、流血傳給最近一隻怪', ''],
    boss: ['對頭目傷害', '%'], bossDef: ['受到頭目傷害', '%', true], bossCrit: ['對頭目爆擊傷害', '%'], bossLow: ['頭目 HP < 30% 時傷害', '%'], bossSkillDef: ['受到頭目的魔法傷害', '%', true], bossIgnore: ['對頭目無視傷害減免', '%'],
    finalDef: ['最終減傷', '%'], hp: ['HP 上限', '%'], shield: ['自己產生的護盾量', '%'], aoeDef: ['受到的魔法（範圍）傷害', '%', true], critDef: ['受到的爆擊傷害', '%', true], dotDef: ['受到的持續傷害', '%', true], lowDef: ['HP < 30% 時減傷', '%'],
    cdr: ['施法冷卻', '%', true], mpCut: ['MP 消耗', '%', true], buffDur: ['自己施放的增益持續時間', '%'], castSpd: ['施法速度', '%'], classCd: ['流派技能冷卻', '%', true], dragonCd: ['龍語絕技冷卻', '%', true], cdReset: ['施放流派技能後重置該技能冷卻的機率', '%']
  };
  var COMBO = {
    'crit+chase+dot': ['腥風', '爆擊或追擊命中時，10% 機率讓目標的中毒、流血立刻多跳一次', { gore: 10 }],
    'crit+chase+boss': ['弒王', '對頭目的追擊，傷害 +20%（必定爆擊的近似）', { kingChase: 20 }],
    'crit+chase+guard': ['刃舞', '每次爆擊或追擊，受到的傷害 −1%（5 秒，最多 10 層）', { bladeDance: 1 }],
    'crit+chase+time': ['疾刃', '每次爆擊，所有流派技能冷卻 −0.2 秒（每秒最多 1 次，大絕除外）', { swift: .2 }],
    'crit+dot+boss': ['剮刑', '對中毒或流血的頭目，爆擊傷害 +20%', { flay: 20 }],
    'crit+dot+guard': ['毒甲', '受到攻擊時 10% 機率讓攻擊者中毒（每秒你攻擊力 30%，5 秒）', { venomArmor: 30 }],
    'crit+dot+time': ['瘟咒', '施放技能後 5 秒內，爆擊讓目標的負面狀態延長 1 秒（同一目標最多 +5 秒）', { plague: 1 }],
    'crit+boss+guard': ['王威', '對頭目爆擊時，得到最大 HP 2% 護盾（每 3 秒最多 1 次）', { majesty: 2 }],
    'crit+boss+time': ['處決', '頭目 HP < 30% 時，爆擊傷害 +20%、技能冷卻 −5%', { execute: 20 }],
    'crit+guard+time': ['逆刃', '受到傷害後 3 秒內，爆擊傷害 +10%（爆擊率 +10% 的近似）', { riposte: 10 }],
    'chase+dot+boss': ['群蝕', '追擊命中頭目時疊 1 層：受到你的傷害 +1%（10 秒，最多 10 層）', { swarm: 1 }],
    'chase+dot+guard': ['纏絲', '追擊命中時，回復那一下傷害 2% 的 HP', { silk: 2 }],
    'chase+dot+time': ['連咒', '追擊命中有負面狀態的目標時，5% 機率重置一個流派技能的冷卻（大絕除外）', { chainCurse: 5 }],
    'chase+boss+guard': ['不退', '對頭目每次追擊，受到頭目的傷害 −1%（5 秒，最多 10 層）', { stand: 1 }],
    'chase+boss+time': ['急襲', '對頭目的追擊機率 +5%', { raid: 5 }],
    'chase+guard+time': ['迴旋', '追擊命中時，得到最大 HP 1% 護盾（每秒最多 1 次）', { whirl: 1 }],
    'dot+boss+guard': ['毒王', '頭目身上每有 1 種負面狀態，你受到它的傷害 −2%（最多 −10%）', { venomKing: 2 }],
    'dot+boss+time': ['衰亡', '你對頭目施加的負面狀態持續時間 +20%', { decay: 20 }],
    'dot+guard+time': ['毒霧', '每 10 秒，全部敵人中毒（每秒你攻擊力 20%，5 秒）', { miasma: 20 }],
    'boss+guard+time': ['君臨', '頭目戰開始後 30 秒內，造成的傷害 +15%、受到的傷害 −10%', { reign: 15 }]
  };
  var comboKey = function (o) { return o.slice().sort(function (a, b) { return ORDER.indexOf(a) - ORDER.indexOf(b); }).join('+'); };

  // ── 規則 ──
  var parse = function (id) { var m = /^(\w+)\.(A|B|N1|N2|N3|K)\.(\d)$/.exec(id || ''); if (!m || !DIRS[m[1]]) return null; var s = SEC.filter(function (x) { return x[0] === m[2]; })[0]; if (+m[3] < 1 || +m[3] > s[1]) return null; return { d: m[1], s: m[2], i: +m[3], cost: s[2] }; };
  var fresh = function () { return { o: [], n: [], j: -1 }; };
  var data = function (p) { p = p || P(); if (!p) return null; var t = p.afkTal2; if (!t || typeof t !== 'object' || !Array.isArray(t.o) || !Array.isArray(t.n)) t = p.afkTal2 = fresh(); if (t.j == null) t.j = -1; return t; };
  var complete = function (t, d, s) { var n = SEC.filter(function (x) { return x[0] === s; })[0][1]; for (var i = 1; i <= n; i++) if (t.n.indexOf(d + '.' + s + '.' + i) < 0) return false; return true; };
  var spent = function (t) { var s = 0; t.n.forEach(function (id) { var x = parse(id); s += x ? x.cost : 0; }); for (var k = 0; k <= t.j; k++) s += STAR_COST[k]; return s; };
  var paragonLv = function (p) { try { var g = G() && G().read(p); return g ? N(g.paragon.level) : 0; } catch (e) { return 0; } };
  var pool = function (p) { return Math.max(0, Math.floor((paragonLv(p) - 500) / 3)); };
  var MAXPTS = 170;
  var earned = function (p) { return Math.min(MAXPTS, pool(p)); };
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
  var eff = function (p) {
    p = p || P(); if (!p || p !== P() || p.classicMode) return {};
    var t = data(p); if (!t || !t.n.length) return {};
    var s = t.n.join(',') + '|' + t.j + '|' + t.o.join(','); if (s === sig) return cache;
    var e = {}; t.n.forEach(function (id) { var v = nodeEff(id); for (var k in v) e[k] = (e[k] || 0) + v[k]; });
    if (t.j >= 0 && allK(t)) { var c = COMBO[comboKey(t.o)]; if (c) { var m = STAR_MULT[t.j]; for (var k2 in c[2]) e[k2] = (e[k2] || 0) + c[2][k2] * m; } if (t.j >= 3) e.finalDmg = (e.finalDmg || 0) + 2; }
    sig = s; cache = e; return e;
  };
  var E = function (k, p) { return N(eff(p)[k]); };

  // ── 操作（點了就鎖定）──
  var save = function () { try { if (typeof saveGame === 'function') saveGame(); } catch (e) {} try { if (typeof recomputeStats === 'function') recomputeStats(); } catch (e) {} };
  var addNode = function (id) {
    var p = P(), t = data(p); if (!p || !t) throw Error('沒有角色');
    if (paragonLv(p) < 500) throw Error('巔峰 500 等開放');
    var x = parse(id); if (!x || !canAdd(t, id)) throw Error('還沒滿足前置節點');
    if (spent(t) + x.cost > earned(p)) throw Error('極意點數不夠');
    if (t.o.indexOf(x.d) < 0) t.o.push(x.d); t.n.push(id); sig = ''; save();
  };
  var starUp = function () {
    var p = P(), t = data(p); if (!allK(t)) throw Error('三系的核心都點了才能點融會'); if (t.j >= 3) throw Error('融會已經 ★3');
    var c = STAR_COST[t.j + 1]; if (spent(t) + c > earned(p)) throw Error('極意點數不夠（需要 ' + c + ' 點）');
    t.j++; sig = ''; save();
  };
  var wash = function () {
    var p = P(), t = data(p); if (!t.n.length && t.j < 0) throw Error('極意還沒有配點');
    var g = G(); if (!g) throw Error('目前不能洗點');
    return g.transaction('極意洗點', function () { g.spendBlood(g.WASH || 50000); p.afkTal2 = fresh(); sig = ''; });
  };

  // ── 文字 ──
  var fmtEff = function (e) { return Object.keys(e).map(function (k) { var L = LABEL[k]; if (!L) return ''; if (!L[1] && k !== 'chaseMp') return L[0]; return L[0] + ' ' + (L[2] ? '−' : '+') + e[k] + L[1]; }).filter(Boolean).join('、'); };
  var nodeText = function (id) { var x = parse(id); if (!x) return ''; if (x.s === 'K') return DIRS[x.d].kName + '：' + DIRS[x.d].kText; return fmtEff(nodeEff(id)); };

  // ── 畫面（「天賦・巔峰」多一個分頁）──
  var view = { dir: 'crit' };
  // 星圖（跟天賦一樣一圈；共用 LineageGrowthViews.constellation）
  var xState = function (t, pts, used, op, id) { var x = parse(id); if (!x) return 'locked'; if (t.n.indexOf(id) >= 0) return 'lit'; return op && canAdd(t, id) && used + x.cost <= pts ? 'available' : 'locked'; };
  var xReason = function (st) { return st === 'lit' ? '已點亮' : st === 'available' ? '可點亮 · 點擊圓點配置' : '需先完成前置節點，或點數不夠；每系完成核心後才能選下一系（最多三系）。'; };
  var xInspect = function (id) {
    var p = P(), t = data(p); if (!p || !t) return ''; var x = parse(id); if (!x) return ''; var D = DIRS[x.d], st = xState(t, earned(p), spent(t), paragonLv(P()) >= 500, id);
    return '<span class="growth-eyebrow">' + D.name + ' · ' + (x.s === 'K' ? '核心' : x.s + ' · ' + x.i) + '</span><div class="growth-insignia" style="--branch:' + D.color + '"><span class="growth-emblem" style="background-image:url(assets/ui/growth-v5/tal2/tal2_icon_' + x.d + '.webp)"></span></div><h3>' + D.name + ' · ' + (x.s === 'K' ? '核心 K' : x.s + ' 節點 ' + x.i) + '</h3><p class="growth-effect">' + esc(nodeText(id)) + '</p><div class="growth-detail-cost"><span>點亮消耗</span><b>' + x.cost + ' 點</b></div><p class="growth-state ' + st + '">' + xReason(st) + '</p><div class="growth-inspect-rule">A／B 每顆 1 點、N1／N2 每顆 2 點<br>N3 每顆 3 點、核心 5 點<br>A → N1 · B → N2<br>四組全滿 → N3 → 核心<br>每系 44 點 · 三系核心後點融會</div>';
  };
  var xTree = function (t, pts, used, op) {
    var V = W.LineageGrowthViews; if (!V || !V.constellation) return '';
    return V.constellation({ cmd: 'ext:t2|', dirs: ORDER.map(function (d) { return { k: d, name: DIRS[d].name, sub: DIRS[d].sub, color: DIRS[d].color, icon: 'assets/ui/growth-v5/tal2/tal2_icon_' + d + '.webp', bg: 'assets/ui/growth-v5/tal2/tal2_bg_' + d + '.webp' }; }), dir: view.dir, order: t.o,
      costs: { A: SEC[0][2], B: SEC[1][2], N1: SEC[2][2], N2: SEC[3][2], N3: SEC[4][2], K: SEC[5][2] }, state: function (id) { return xState(t, pts, used, op, id); }, desc: nodeText, inspect: xInspect, selected: view.sel,
      coreLabel: function (d) { return DIRS[d].kName + ' · 核心 ' + SEC[5][2] + ' 點'; } });
  };
  var render = function () {
    var p = P(), t = data(p); if (!p || !t) return '';
    var lv = paragonLv(p), pts = earned(p), used = spent(t), open = lv >= 500;
    var h = '<div class="growth-heading"><div><span class="growth-eyebrow">MASTERY</span><h3>極意</h3></div><div class="growth-balance"><b>' + Math.max(0, pts - used) + '</b><span>可用極意點<small>已配置 ' + used + ' / ' + pts + '（最多 ' + MAXPTS + '）</small></span></div></div>';
    h += '<p class="t2-note">' + (open ? '巔峰 500 等以後每 3 等得到 1 點（目前 P' + lv + '）。六系選三系依序點滿；三系核心都點了可以點「融會」，再升星。點了就鎖定，洗點 50,000 血龍鑽。' : '巔峰 500 等開放（目前 P' + lv + '）。') + '</p>';
    h += xTree(t, pts, used, paragonLv(P()) >= 500);
    var ck = t.o.length === 3 ? COMBO[comboKey(t.o)] : null;
    h += '<div class="t2-fuse"><span class="growth-eyebrow">FUSION</span><b>融會' + (ck ? '・' + esc(ck[0]) : '') + (t.j >= 0 ? ' ' + (t.j ? '★'.repeat(t.j) : '☆') : '') + '</b>';
    if (!ck) h += '<small>選滿三系後才知道是哪一種融會（六系選三共 20 種）。</small>';
    else {
      h += '<small>' + esc(ck[1]) + '</small><small>倍率：☆ ×1、★1 ×1.2、★2 ×1.8、★3 ×2（★3 另外最終傷害 +2%）；目前 ' + (t.j >= 0 ? '×' + STAR_MULT[t.j] : '未點') + '</small>';
      var next = t.j + 1, can2 = allK(t) && next <= 3 && used + STAR_COST[next] <= pts;
      if (next <= 3) h += '<button type="button" class="growth-primary" data-growth="ext:t2|star|1" ' + (can2 ? '' : 'disabled') + '>' + (next === 0 ? '點亮融會（3 點）' : '升到 ★' + next + '（' + STAR_COST[next] + ' 點）') + '</button>';
    }
    h += '</div>';
    h += '<div class="growth-bottom"><p class="growth-note">極意點數跟巔峰點數分開算。之後的第三套天賦「匣之」在融會 ★3 後開啟。</p><div class="growth-actions"><button type="button" class="growth-primary" data-growth="ext:t2|wash|1">洗點（50,000 血龍鑽）</button></div></div>';
    return h;
  };
  var click = function (cmd, arg) {
    if (cmd === 'dir') { view.dir = arg; view.sel = arg + '.A.1'; return; }
    if (cmd === 'node') { view.sel = arg; var p0 = P(), t0 = data(p0); if (xState(t0, earned(p0), spent(t0), paragonLv(P()) >= 500, arg) === 'available') addNode(arg); return; }
    if (cmd === 'star') { starUp(); return; }
    if (cmd === 'wash') { if (!confirm('花 50,000 血龍鑽洗掉極意目前的全部點數？\n點數會全部退還，讓你重新配一次。')) return; return wash(); }
  };
  (W.LineageGrowthExtraTabs = W.LineageGrowthExtraTabs || {}).t2 = { name: '極意', order: 3, visible: function () { var p = P(); return !!(p && !p.classicMode && N(p.rebirth) >= 1); }, view: render, click: click, inspect: xInspect };

  // ════════ 效果 ════════
  var ticks = function () { return (typeof state !== 'undefined' && state) ? N(state.ticks) : 0; };
  var st = function (p) { return p._afkT2s || (p._afkT2s = { crits: 0, critK: 0, critKcd: 0, heal: 0, hits: 0, bossHits: [], bossBuff: null, bossKcd: 0, guardKcd: 0, casts: 0, dance: [], stand: [], swarm: {}, hurtAt: 0, shieldAt: 0, whirlAt: 0, swiftAt: 0, castAt: 0, fight: null, miasma: 0 }); };
  var hasDebuffN = function (t) {
    var n = 0, s = t && t.st; if (s) for (var k in s) { if (/^(poisonTick|poisonDmg|poisonStacks|poisonUnit|blindVal)$/.test(k)) continue; if (N(s[k]) > 0) n++; }
    if (t && t.bleeds && t.bleeds.length) n++;
    return n;
  };
  var hasDot = function (t) { return !!(t && ((t.st && N(t.st.poison) > 0) || (t.bleeds && t.bleeds.length))); };
  var mhp = function (p) { return Math.max(1, N(p.mhp)); };
  var shieldOf = function (p, ratio, src) { try { var R = W.AFK_RELIC_RUNTIME; if (R && R.api && R.api.shield) R.api.shield(p, mhp(p) * ratio, { source: src, owner: p, duration: 6 }); } catch (e) {} };
  var stack = function (arr, ms, max) { var t = now(); while (arr.length && arr[0] < t) arr.shift(); arr.push(t + ms); while (arr.length > max) arr.shift(); };
  var live = function (arr) { var t = now(); while (arr.length && arr[0] < t) arr.shift(); return arr.length; };
  var cdShift = function (p, sec, skipUlt) { try { var cp = p.classPath, cds = cp && cp.cooldowns; if (!cds) return; for (var k in cds) { if (skipUlt && k === 'ult') continue; cds[k] = N(cds[k]) - sec * 1000; } } catch (e) {} };

  // 能力（重算時）
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) {
    var e = eff(p); if (!e || !p.d) return; var d = p.d;
    var cr = N(e.critRate); if (cr) { d.meleeCrit = N(d.meleeCrit) + cr; d.rangedCrit = N(d.rangedCrit) + cr; d.magicCrit = N(d.magicCrit) + cr; }
    var cd = N(e.critDmg) + N(e.critIgnore); if (cd) ['melee', 'ranged', 'magic'].forEach(function (k) { d[k + 'CritDmg'] = N(d[k + 'CritDmg']) + cd; });
    if (e.hp) p.mhp = Math.floor(N(p.mhp) * (1 + e.hp / 100));
  });

  // 攻速、施法速度、冷卻
  if (typeof W.playerAttackIntervalTicks === 'function') {
    var oItv = W.playerAttackIntervalTicks;
    W.playerAttackIntervalTicks = function () { var v = oItv.apply(this, arguments); try { var a = E('aspd'); if (a && v > 0) v = v / (1 + a / 100); } catch (e) {} return v; };
  }
  if (typeof W.getAutoCastInterval === 'function') {
    var oCast = W.getAutoCastInterval;
    W.getAutoCastInterval = function (actor) { var v = oCast.apply(this, arguments); try { if (actor === P() && v > 0) { var m = (1 - E('castSpd') / 100) * (1 - E('cdr') / 100); if (m < 1) v = v * m; } } catch (e) {} return v; };
  }
  var oCdr = W.__afkCdrMult;
  W.__afkCdrMult = function (p, s) {
    var m = typeof oCdr === 'function' ? oCdr.apply(this, arguments) : 1;
    try {
      if (p !== P() || !s || s.type === '大絕') return m;
      var e = eff(p), S = st(p); m *= 1 - N(e.cdr) / 100;
      m *= 1 - (s.type === '龍魔法' ? N(e.dragonCd) : N(e.classCd)) / 100;
      if (e.execute) { var tg = null; try { tg = (mapState.mobs || []).filter(function (x) { return x && x.boss && x.curHp > 0; })[0]; } catch (er) {} if (tg && tg.curHp / Math.max(1, N(tg.hp || tg.mhp)) < .3) m *= 1 - 5 * (e.execute / 20) / 100; }
      S.castAt = now();
      if (e.timeK) { S.casts++; if (S.casts > 5) { S.casts = 0; return 0.001; } }
      if (e.cdReset && Math.random() * 100 < e.cdReset) return 0.001;
    } catch (er) {}
    return m;
  };

  // MP 消耗、增益持續時間（成長事件）
  var hookEvent = function () {
    var g = G(); if (!g || g.__afkT2) return; var o = g.event;
    g.event = function (name, c) {
      var r = o.apply(this, arguments);
      try {
        var p = c && c.actor; if (!p || p !== P()) return r; var e = eff(p);
        if (name === 'beforeCast' && e.mpCut && c.mpCost > 0) c.mpCost *= Math.max(0, 1 - e.mpCut / 100);
        if (name === 'onCast' && c.success && c.skill && c.skill.type === 'buff' && e.buffDur && p.buffs && p.buffs[c.skillId] > 0) p.buffs[c.skillId] = Math.floor(p.buffs[c.skillId] * (1 + e.buffDur / 100));
        if (name === 'beforeHit' && c.target) {
          var t = c.target, add = 0, S = st(p);
          if (c.critical) {
            if (t.boss && e.bossCrit) add += e.bossCrit;
            if (t.boss && e.flay && hasDot(t)) add += e.flay;
            if (t.boss && e.execute && t.curHp / Math.max(1, N(t.hp || t.mhp)) < .3) add += e.execute;
            if (e.riposte && now() - S.hurtAt < 3000) add += e.riposte;
          }
          if (S.critK > 0 && e.critK) { S.critK = 0; add += 50; c.damage *= 1.5; }
          if (add) c.damage *= 1 + add / 100;
        }
        if (name === 'afterHit' && c.target) afterHit(p, c, e);
      } catch (er) {}
      return r;
    };
    g.__afkT2 = true;
  };
  hookEvent(); W.addEventListener('load', hookEvent);

  var chasing = function () { return !!W.__afkChasing; };
  var afterHit = function (p, c, e) {
    var S = st(p), t = c.target, crit = !!c.critical, ch = chasing();
    if (crit) {
      if (e.critHeal && now() - S.heal >= 1000) { S.heal = now(); p.hp = Math.min(mhp(p), N(p.hp) + Math.floor(mhp(p) * e.critHeal / 100)); }
      if (e.critK && now() >= S.critKcd) { S.crits++; if (S.crits >= 3) { S.crits = 0; S.critK = 1; S.critKcd = now() + 6000; } }
      if (e.swift && now() - S.swiftAt >= 1000) { S.swiftAt = now(); cdShift(p, e.swift, true); }
      if (e.majesty && t.boss && now() - S.shieldAt >= 3000) { S.shieldAt = now(); shieldOf(p, e.majesty / 100, 'talent2-majesty'); }
      if (e.plague && now() - S.castAt < 5000 && t.st) { var ext = Math.min(50, N(t._afkT2Plague) + 10 * e.plague) - N(t._afkT2Plague); if (ext > 0) { t._afkT2Plague = N(t._afkT2Plague) + ext; for (var k in t.st) if (!/^(poisonTick|poisonDmg|poisonStacks|poisonUnit|blindVal)$/.test(k) && N(t.st[k]) > 0) t.st[k] += ext; } }
    } else S.crits = 0;
    if (crit || ch) {
      if (e.bladeDance) stack(S.dance, 5000, 10);
      if (e.gore && Math.random() * 100 < e.gore && hasDot(t)) { var dmg = N(t.st && t.st.poison > 0 ? t.st.poisonDmg : 0); (t.bleeds || []).forEach(function (b) { dmg += N(b.dmg); }); if (dmg > 0 && G()) G().secondaryHit(p, t, dmg, 'magic'); }
    }
    if (ch) {
      if (e.chaseMp) p.mp = Math.min(N(p.mmp), N(p.mp) + e.chaseMp);
      if (e.silk) p.hp = Math.min(mhp(p), N(p.hp) + Math.floor(N(c.actualDamage || c.damage) * e.silk / 100));
      if (e.whirl && now() - S.whirlAt >= 1000) { S.whirlAt = now(); shieldOf(p, e.whirl / 100, 'talent2-whirl'); }
      if (t.boss && e.stand) stack(S.stand, 5000, 10);
      if (t.boss && e.swarm) { var sw = t._afkT2Swarm || (t._afkT2Swarm = []); stack(sw, 10000, 10); }
      if (e.chainCurse && hasDebuffN(t) && Math.random() * 100 < e.chainCurse) cdShift(p, 9999, true);
    }
    if (t.boss && e.bossK && now() >= S.bossKcd) { S.bossHits = S.bossHits.filter(function (x) { return x.t === t && now() - x.at < 10000; }); S.bossHits.push({ t: t, at: now() }); if (S.bossHits.length >= 20) { S.bossHits = []; S.bossBuff = { t: t, until: now() + 10000 }; S.bossKcd = now() + 20000; } }
    if (e.chaseK) { S.hits++; }
  };

  // 造成的傷害
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || typeof C.damage !== 'function' || C.__afkT2) return;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var r = o.apply(this, arguments);
      try {
        var p = P(); if (!(r > 0) || !p || actor !== p || !target) return r;
        var e = eff(p); if (!e || !Object.keys(e).length) return r;
        var S = st(p), kind = (opt && opt.kind) || '', add = 0;
        if (kind === 'dot' && e.dot) add += e.dot;
        var nd = 0; if ((e.vsDebuff || e.dotK) && (nd = hasDebuffN(target))) { add += N(e.vsDebuff); if (e.dotK) add += Math.min(15, 3 * nd); }
        if (target.boss) {
          add += N(e.boss) + N(e.bossIgnore);
          if (e.bossLow && target.curHp / Math.max(1, N(target.hp || target.mhp)) < .3) add += e.bossLow;
          if (S.bossBuff && S.bossBuff.t === target && S.bossBuff.until > now()) add += 10;
          if (chasing() && e.kingChase) add += e.kingChase;
          if (target._afkT2Swarm) add += live(target._afkT2Swarm) * N(e.swarm || 1);
          if (e.reign) { var f = S.fight; if (!f || f.t !== target) f = S.fight = { t: target, at: now() }; if (now() - f.at < 30000) add += e.reign; }
        }
        if (chasing()) add += N(e.chaseDmg);
        var m = (1 + add / 100) * (1 + N(e.finalDmg) / 100);
        if (m !== 1) r = Math.max(1, Math.floor(r * m));
      } catch (er) {}
      return r;
    };
    C.__afkT2 = true;
  };
  hookDamage(); W.addEventListener('load', hookDamage);

  // 受到的傷害
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob, kind) {
    var p = P(); if (!p || ent !== p) return 1; var e = eff(p); if (!e || !Object.keys(e).length) return 1;
    var S = st(p), cut = 0;
    if (mob && mob.boss) { cut += N(e.bossDef); if (kind === 'magic') cut += N(e.bossSkillDef); cut += live(S.stand) * N(e.stand); if (e.venomKing) cut += Math.min(5, hasDebuffN(mob)) * e.venomKing; if (e.reign && S.fight && S.fight.t === mob && now() - S.fight.at < 30000) cut += e.reign * 10 / 15; }
    if (kind === 'magic') cut += N(e.aoeDef); else if (kind === 'dot') cut += N(e.dotDef);
    if (N(p.hp) / mhp(p) < .3) cut += N(e.lowDef);
    cut += live(S.dance) * N(e.bladeDance);
    return Math.max(0, 1 - cut / 100);
  });
  var hookTaken = function () {
    var o = W.__afkTaken; if (typeof o !== 'function' || W.__afkT2Taken) return; W.__afkT2Taken = true;
    W.__afkTaken = function (ent, dmg, mob) {
      var v = o.apply(this, arguments);
      try {
        var p = P(); if (!(v > 0) || ent !== p) return v; var e = eff(p), S = st(p);
        S.hurtAt = now();
        if (e.finalDef) v = Math.floor(v * (1 - e.finalDef / 100));
        if (e.guardK && v > mhp(p) * .3 && now() >= S.guardKcd) { S.guardKcd = now() + 20000; v = Math.floor(v / 2); }
        if (e.venomArmor && mob && mob.curHp > 0 && Math.random() < .1 && typeof applyMobStatus === 'function') { var atk = Math.max(1, N(p.d && (p.d.meleeDmg || p.d.magicDmg))) * e.venomArmor / 100; applyMobStatus(mob, { kind: 'poison', dur: 50, dmg: Math.floor(atk), tick: 10, force: true }, '毒甲'); }
      } catch (er) {}
      return v;
    };
  };
  hookTaken(); W.addEventListener('load', hookTaken);

  // 護盾量
  var hookShield = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R || !R.api || typeof R.api.shield !== 'function' || R.api.__afkT2) return;
    var o = R.api.shield; R.api.shield = function (actor, amount, opt) { try { var p = P(), x; if (actor === p && (x = E('shield'))) amount = amount * (1 + x / 100); } catch (e) {} return o.call(this, actor, amount, opt); }; R.api.__afkT2 = true;
  };
  hookShield(); W.addEventListener('load', hookShield);

  // 負面狀態：持續時間、命中、衰亡
  if (typeof W.applyMobStatus === 'function') {
    var oSt = W.applyMobStatus;
    W.applyMobStatus = function (m, s) {
      try {
        var p = P(), e = p && eff(p);
        if (e && s && typeof s === 'object' && (e.debuffDur || e.debuffHit || (e.decay && m && m.boss))) {
          var mul = 1 + (N(e.debuffDur) + (m && m.boss ? N(e.decay) : 0)) / 100, s2 = Object.assign({}, s);
          if (s2.dur) s2.dur = Math.round(s2.dur * mul);
          if (e.debuffHit) s2.hitOff = N(s2.hitOff) + e.debuffHit * .2;
          arguments[1] = s2;
        }
      } catch (er) {}
      return oSt.apply(this, arguments);
    };
  }

  // 目標死亡：毒、流血傳給最近一隻
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (i) {
      try {
        var p = P(), e = p && eff(p), t = mapState.mobs[i];
        if (e && e.dotSpread && t && hasDot(t)) {
          var o2 = (mapState.mobs || []).filter(function (x) { return x && x !== t && x.curHp > 0 && !x._dead; })[0];
          if (o2) { o2.st = o2.st || newMobStatus(); if (t.st && t.st.poison > 0) { o2.st.poison = Math.max(N(o2.st.poison), t.st.poison); o2.st.poisonDmg = Math.max(N(o2.st.poisonDmg), N(t.st.poisonDmg)); } if (t.bleeds && t.bleeds.length) o2.bleeds = (o2.bleeds || []).concat(t.bleeds.map(function (b) { return Object.assign({}, b); })); }
        }
      } catch (er) {}
      return oKill.apply(this, arguments);
    };
  }

  // 追擊（跟巔峰的追擊共用「正在追擊」旗標，追擊出來的那一下不會再追擊）
  if (typeof W.playerAttack === 'function') {
    var oAtk = W.playerAttack;
    W.playerAttack = function () {
      var r = oAtk.apply(this, arguments);
      try {
        var p = P(); if (!p || p.dead || W.__afkChasing) return r; var e = eff(p), S = st(p);
        var times = 0, chance = N(e.chase);
        try { var tg = (mapState.mobs || []).filter(function (x) { return x && x.boss && x.curHp > 0; })[0]; if (tg && e.raid) chance += e.raid; } catch (er) {}
        if (chance && Math.random() * 100 < chance) times = 1;
        if (e.chaseK && S.hits >= 10) { S.hits = 0; times = 2; }
        for (var i = 0; i < times; i++) { W.__afkChasing = true; try { oAtk.apply(this, arguments); } finally { W.__afkChasing = false; } }
      } catch (er) { W.__afkChasing = false; }
      return r;
    };
  }

  // 毒霧：每 10 秒全部敵人中毒
  setInterval(function () {
    try { var p = P(); if (!p || p.dead || typeof state === 'undefined' || !state.running) return; var e = eff(p); if (!e.miasma) return;
      var atk = Math.max(1, N(p.d && (p.d.meleeDmg || p.d.magicDmg))) * e.miasma / 100;
      (mapState.mobs || []).forEach(function (m) { if (m && m.curHp > 0 && !m._dead && typeof applyMobStatus === 'function') applyMobStatus(m, { kind: 'poison', dur: 50, dmg: Math.floor(atk), tick: 10, force: true }, '毒霧'); });
    } catch (er) {}
  }, 10000);

  // 受到的爆擊傷害（afk-enemyx 讀；敵人會爆擊了，Ping 11-13 13:39）
  W.__afkEnemyCritDef = function (ent) { return ent && ent === P() ? E('critDef', ent) : 0; };
  W.LineageTalent2 = { DIRS: DIRS, COMBO: COMBO, data: data, eff: eff, spent: spent, earned: earned, pool: pool, canAdd: canAdd, addNode: addNode, starUp: starUp, wash: wash, comboKey: comboKey, nodeText: nodeText, MAXPTS: MAXPTS };
})();
