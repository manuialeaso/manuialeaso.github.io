/* ============================================================================
 * afk-guardring.js — 守護者之戒（設計稿 docs/guardian-ring-design.md 第三版，以第十三節「第三版定案」為準；
 *   外掛開關 guardring，預設開；經典模式完全沒有；轉生後才顯示、才生效）
 *
 *   一、一顆石頭、五個騎士各自的進度（p.afkGuard.k[騎士] = 0～6：0 沒有、1～3 上半部 ★1～★3、4～6 完整 ★1～★3）。
 *       同時只配戴一個「主誓約」（p.afkGuard.main）；第一次選免費，之後換主誓約 1 億金幣、只能在村莊。
 *       宙斯的光／闇（p.afkGuard.zeus＝'light'｜'dark'）免費切換，只能在村莊。
 *   二、效果（數值都在下面的表）：主誓約那一枚的專屬效果＋共通部分（3.6）＋騎士之印共鳴（第四節）。
 *       ★1、★2＝★3 的 50%、80%（冷卻、間隔不打折）。
 *       庇護者之戒（五個都金印）：主誓約完整 ★3＋其他四個騎士上半部 ★3 的專屬效果（月光的歐文形態不帶入；宙斯照目前的面）；
 *         守護者光環（只在次元裂縫難度）：五屬性抗性被侵蝕最多扣到 500（面板本來就不到 500 的照面板）。
 *       隱藏規則「守護傳承」（只寫在 docs/formulas.md）：職業是騎士、配戴任何一枚 → 戒指全部效果 ×1.5（冷卻、間隔、代價不乘），得到稱號。
 *   三、裝備格：裝備視窗第二頁、密奧正上方（核心補丁「守護者格」）。p.eq.guard 是不存進存檔、不被 for…in 掃到的唯讀屬性，
 *       只讓「掃 WEIGHT_COUNT_SLOTS 的地方」（異常狀態抵抗、負重）與裝備格看得到；其他數值都在 recomputeStats 之後直接加。
 *   四、滿月共用計時（W.__afkFullMoon）：現實時間每 24 分鐘有 4 分鐘滿月，戰鬥畫面左上角顯示月亮。
 *   五、五個騎士副本：劇情任務做完才開；只有席琳夢域鏡每天 3 次，次元裂縫難度每天 1 次（裂縫未開放時灰色）。
 *       3 波小怪＋1 王，限時 15 分鐘，打倒王才結束；換角色／重新整理接回（p.afkGuard.run，比照星途遠征）。
 *   六、可替換的表：TOKENS（專屬信物：原道具 id → 夢域鏡＋原名；原道具從所有掉落表拿掉）、BOSS_LINES（頭目台詞）、QUESTS（劇情對話）。
 *   七、材料掉落：四龍眼淚只在四龍副本（夢域鏡）的小怪掉、原本會掉的怪改成不掉；次元結晶與裂縫材料掛在 __afkDimRiftOn()。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'guardring', name: '守護者之戒', group: '遊戲內容', seal: true,
    desc: '轉生後在海音找伊席蘿蒂：五名騎士各自的劇情與副本，收集材料升級守護者之戒，配戴一枚當主誓約' });
  if (T && !T.enabled('guardring')) return;
  if (typeof DB === 'undefined' || !DB.items || !DB.mobs) return;
  var L = W.__afkLore, K = W.__afkNpcKit, X = W.__afkProc;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var clog = function (h, c) { try { if (typeof logCombat === 'function' && !S().ff) logCombat(h, c || 'enemy'); } catch (e) {} };
  var tk = function () { return Number(S().ticks) || 0; };
  var rnd = function () { return api.roll(); };
  var fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var dayKey = function () { return Math.floor((api.now() + 8 * 3600000) / 86400000); };
  var inTown = function () { try { return /^town_/.test(mapState.current || ''); } catch (e) { return false; } };
  var mobs = function () { return (typeof mapState !== 'undefined' && mapState.mobs) || []; };
  var hiddenOn = function () { return !T || T.enabled('hiddenbonus'); };

  // ═══════════════════════════ 一、騎士與數值 ═══════════════════════════
  var KEYS = ['moon', 'steel', 'swan', 'shadow', 'magic'];
  var KN = {
    moon:   { n: '月光騎士 絲莉安', s: '絲莉安', short: '月光', ele: 'wind',  c: '#a5b4fc', set: '月光', town: 'town_gludin',       ring: 'guardring-art/moon-96.png', big: 'guardring-art/moon-256.png' },
    steel:  { n: '鋼鐵騎士 阿頓',   s: '阿頓',   short: '鋼鐵', ele: 'fire',  c: '#fca5a5', set: '鐵衛', town: 'town_witon',        ring: 'guardring-art/steel-96.png', big: 'guardring-art/steel-256.png' },
    swan:   { n: '天鵝騎士 伊席蘿蒂', s: '伊席蘿蒂', short: '天鵝', ele: 'water', c: '#7dd3fc', set: '白鳥', town: 'town_heine',  ring: 'guardring-art/swan-96.png', big: 'guardring-art/swan-256.png' },
    shadow: { n: '影子騎士 克里斯特', s: '克里斯特', short: '影子', ele: 'earth', c: '#c4b5fd', set: '暗影', town: 'town_silent', ring: 'guardring-art/shadow-96.png', big: 'guardring-art/shadow-256.png' },
    magic:  { n: '魔法騎士 宙斯',   s: '宙斯',   short: '魔法', ele: 'all',   c: '#fde68a', set: null,   town: 'town_ivory_tower',  ring: 'guardring-art/magic-96.png', big: 'guardring-art/magic-256.png' }
  };
  var ART = { final: 'guardring-art/final-96.png', finalBig: 'guardring-art/final-256.png', stone: 'assets/icons/accessories/守護者的戒指.png' };   // 戒指圖：scripts/build-guardring-icons.py
  var ELES = ['fire', 'water', 'wind', 'earth'], ELE_N = { fire: '火', water: '水', wind: '風', earth: '地' };
  // 專屬效果：[上半部 ★3, 完整 ★3]（★1、★2 照比例）
  var VAL = {
    moon:   { abn: [5, 10], resNone: [10, 20], cleanse: [15, 25], owen: [1, 2] },
    steel:  { dr: [10, 20], mhp: [800, 1500], weight: [1000, 2000], iron: [20, 30], rcd: [10, 20] },
    swan:   { healIn: [15, 25], waterTrue: [40, 80], song: [3, 5], pet: [20, 40], petTaken: [10, 20] },
    shadow: { durX: [5, 10], er: [8, 12], vsAbn: [3, 5], shadowStep: [1, 1] },
    magic:  { regen: [50, 100], res5: [30, 60], magTaken: [10, 20], mhp: [300, 600], mmp: [300, 600] }
  };
  var CD = { cleanse: [20, 15], song: [30, 20], shadowStep: [10, 5] };   // 秒，不打折
  var OWEN = { every: 5, cost: 10 };   // 歐文：每 5 秒回血；代價：你造成的傷害 −10%（不打折、不乘守護傳承）
  var ZEUS = { light: { regen: [50, 100], magTaken: [5, 5] }, dark: { magDmg: [5, 10], mpCost: [10, 15], healCut: 10 } };
  // 玩家 2026-11-05 12:38：上半部 ★1／★2＝上半部 ★3 的 50%／80%；完整 ★1／★2＝上半部 ★3 ＋（完整 ★3 − 上半部 ★3）× 33%／67%
  var r1 = function (v) { return v >= 10 ? Math.round(v) : Math.round(v * 10) / 10; };
  var STAR_SCALE = [0.5, 0.8, 1], FULL_STEP = [0.33, 0.67, 1];
  var stepVal = function (pair, s) { return s <= 3 ? pair[0] * STAR_SCALE[s - 1] : pair[0] + (pair[1] - pair[0]) * FULL_STEP[s - 4]; };
  // 冷卻／間隔：上半部不打折（上半部 ★3 的值）；完整 ★1／★2 照同樣比例往完整 ★3 內插，取整到秒時往短的取
  var stepCd = function (pair, s) { return s <= 3 ? pair[0] : Math.floor(pair[0] + (pair[1] - pair[0]) * FULL_STEP[s - 4] + 1e-9); };
  // 共通部分（3.6）：第 1～6 階段
  //   照 3.6 表的上半部 ★3、完整 ★3；其他四星跟專屬效果同一套（上半部 50%／80%、完整 33%／67% 內插；玩家 2026-11-05 13:51）
  var COMMON = { abn: [0, 0, 20, 0, 0, 30], dur: [0, 0, 12, 0, 0, 20], pet: [0, 0, 35, 0, 0, 60], weight: [0, 0, 1200, 0, 0, 2000], mhp: [0, 0, 1000, 0, 0, 1800] };
  Object.keys(COMMON).forEach(function (f) { var c = COMMON[f]; [1, 2, 4, 5].forEach(function (s) { c[s - 1] = r1(stepVal([c[2], c[5]], s)); }); });
  // 騎士之印（第四節）：[印數, 銀, 金]
  var RESO = {
    2: { silver: { abn: 5 }, gold: { abn: 10 } },
    3: { silver: { dur: 5 }, gold: { dur: 8 } },
    4: { silver: { pet: 10, weight: 500 }, gold: { pet: 20, weight: 1000 } },
    5: { silver: { guard: 40, cd: 180, mercs: false }, gold: { guard: 60, cd: 120, mercs: true } }
  };
  var GUARD = { hpPct: 25, dur: 5 };   // 五騎士的守護：HP 第一次低於 25%，5 秒
  var CAPS = { abn: 100, overStep: 10, overGain: 2, overMax: 10, durMax: 70, auraFloor: 500 };
  var CC = ['stun', 'freeze', 'stone', 'paralyze', 'sleep'];
  var DEBUFFS = ['stun', 'freeze', 'stone', 'poison', 'burn', 'scald', 'bleed', 'sleep', 'silence', 'paralyze', 'magicseal', 'armorBreak', 'slowAtk', 'bind',
    'blind', 'weaken', 'disease', 'potionFrost', 'foulWater', 'slow', 'broken', 'confuse', 'panic', 'terror', 'fragile', 'curse', 'decay', 'mrhalf'];
  var half = function (s) { return s >= 4 ? 1 : 0; };
  var star = function (s) { return s >= 4 ? s - 3 : s; };
  var stageN = function (s) { return !s ? '未取得' : (s <= 3 ? '上半部 ★' + s : '完整 ★' + (s - 3)); };
  var markOf = function (s) { return s >= 6 ? 'gold' : s >= 3 ? 'silver' : null; };
  // 某騎士某階段的專屬效果（未乘守護傳承）
  var valOf = function (k, s, opt) {
    opt = opt || {}; if (!(s > 0) || !VAL[k]) return null;
    var o = {};
    Object.keys(VAL[k]).forEach(function (f) { o[f] = r1(stepVal(VAL[k][f], s)); });
    if (o.cleanse != null) o.cleanseCd = stepCd(CD.cleanse, s);
    if (o.song != null) o.songCd = stepCd(CD.song, s);
    if (o.shadowStep != null) o.shadowCd = stepCd(CD.shadowStep, s);
    if (k === 'moon' && opt.noOwen) delete o.owen;
    if (k === 'magic' && opt.face !== 'none') {
      var face = opt.face === 'dark' ? 'dark' : 'light';
      if (face === 'light') { o.regen += r1(stepVal(ZEUS.light.regen, s)); o.magTaken += r1(stepVal(ZEUS.light.magTaken, s)); }
      else { o.magDmg = r1(stepVal(ZEUS.dark.magDmg, s)); o.mpCost = r1(stepVal(ZEUS.dark.mpCost, s)); o.healCut = ZEUS.dark.healCut; }
    }
    return o;
  };
  var txtOf = function (k, o) {
    if (!o) return [];
    var t = [];
    if (k === 'moon') {
      t.push('異常狀態抵抗 +' + o.abn + '%', '無屬性抗性 +' + o.resNone, '月光庇護：被暈眩、冰凍、石化、麻痺、睡眠時 ' + o.cleanse + '% 機率立刻解除（冷卻 ' + o.cleanseCd + ' 秒）');
      if (o.owen != null) t.push('歐文：滿月時切換成歐文，全隊（你、傭兵、寵物、召喚物）每 ' + OWEN.every + ' 秒回最大 HP ' + o.owen + '%；這段時間你造成的傷害 −' + OWEN.cost + '%');
    } else if (k === 'steel') {
      t.push('傷害減免 +' + o.dr, '最大 HP +' + fmt(o.mhp), '負重 +' + fmt(o.weight), '鋼鐵之軀：暈眩、麻痺、冰凍、石化期間受到的傷害 −' + o.iron + '%', '遠距離爆擊傷害 +' + o.rcd + '%');
    } else if (k === 'swan') {
      t.push('受到的治療 +' + o.healIn + '%', '對弱點是水屬性的怪，每次打中額外 ' + o.waterTrue + ' 點真實傷害', '天鵝之歌：每 ' + o.songCd + ' 秒，全隊各清除 1 個異常狀態，並回最大 HP ' + o.song + '%',
        '寵物與召喚物傷害、命中 +' + o.pet, '寵物與召喚物受到的傷害 −' + o.petTaken + '%');
    } else if (k === 'shadow') {
      t.push('異常狀態持續時間 −' + o.durX + '%', '迴避 +' + o.er, '影遁：迴避成功時，下一個上身的異常狀態無效（冷卻 ' + o.shadowCd + ' 秒）', '對處於異常狀態的目標，造成的傷害 +' + o.vsAbn + '%');
    } else if (k === 'magic') {
      t.push('HP、MP 自然恢復量與每罐治癒藥水 +' + o.regen, '火、水、風、地、無屬性抗性各 +' + o.res5, '受到的魔法傷害 −' + o.magTaken + '%', '最大 HP、MP 各 +' + fmt(o.mhp));
      if (o.magDmg != null) t.push('黑暗之星：魔法傷害 +' + o.magDmg + '%、攻擊魔法 MP 消耗 −' + o.mpCost + '%、受到的治療 −' + o.healCut + '%');
    }
    return t;
  };

  // ═══════════════════════════ 二、道具 ═══════════════════════════
  var addItem = function (id, def) { if (!DB.items[id]) DB.items[id] = Object.assign({ type: 'etc', p: 0, gachaWeight: 0, noJunk: true, noSell: true, noUse: true, weight: 0 }, def); try { if (typeof ITEM_WEIGHTS !== 'undefined' && ITEM_WEIGHTS[DB.items[id].n] == null) ITEM_WEIGHTS[DB.items[id].n] = 0; } catch (e) {} return DB.items[id]; };
  var IMG = function (f) { return 'assets/icons/items/' + f + '.png'; };
  var M = {
    emblem: 'afk_guard_emblem', shard: 'afk_guard_shard', dim: 'afk_guard_dimcrystal',
    oath: { fire: 'afk_guard_oath_fire', water: 'afk_guard_oath_water', wind: 'afk_guard_oath_wind', earth: 'afk_guard_oath_earth' },
    tear: { earth: 'ttmi_9636', fire: 'ttmi_9637', water: 'ttmi_9638', wind: 'ttmi_9639' },
    contempt: { fire: 'afk_contempt_fire', water: 'afk_contempt_water', wind: 'afk_contempt_wind', earth: 'afk_contempt_earth' },
    dream: 'afk_dream_crystal', key: 'afk_abyss_key'
  };
  // 裂縫材料：次元裂縫（docs/dimension-rift-design.md）還沒做；先用這幾個 id，裂縫做好時換成它的 id 即可（已經有的道具不會被覆蓋）
  var RIFT = { glim: 'afk_guard_rift_glim', memory: 'afk_guard_rift_memory', thread: 'afk_guard_rift_thread', sand: 'afk_guard_rift_sand', scale: 'afk_guard_rift_scale' };
  addItem(M.emblem, { n: '褪色的誓約紋章', c: 'text-amber-200', img: IMG('冥法軍團印記'), d: '五名騎士按在守護者之石上的誓約，褪了色仍看得出紅獅的紋樣。騎士副本的王掉落；升級守護者之戒的上半部要用。' });
  addItem(M.shard, { n: '斷誓的環片', c: 'text-slate-200', img: IMG('原石碎片'), d: '從裂縫裡撿回來的戒環碎片。升級守護者之戒的完整版要用。' });
  addItem(M.dim, { n: '次元結晶', c: 'text-sky-300', img: IMG('召喚球碎片'), d: '次元裂縫裡凝成的結晶。升級守護者之戒（上半部 ★3）要用。' });
  ELES.forEach(function (e) { addItem(M.oath[e], { n: '龍誓結晶(' + ELE_N[e] + ')', c: 'text-orange-200', img: IMG('哀石結晶'), d: '四龍副本・次元裂縫的最終龍留下的結晶。升級守護者之戒的完整版要用。' }); });
  addItem(RIFT.glim, { n: '裂縫碎光', c: 'text-sky-200', img: IMG('光明的鱗片'), d: '次元裂縫裡的碎光。' });
  addItem(RIFT.memory, { n: '席琳的水之記憶', c: 'text-cyan-200', img: IMG('人魚之鱗'), d: '次元裂縫裡席琳留下的記憶。' });
  addItem(RIFT.thread, { n: '天空的縫線', c: 'text-indigo-200', img: IMG('封印的妖怪之魂'), d: '縫補天空用的線。' });
  addItem(RIFT.sand, { n: '凝結的時之沙', c: 'text-yellow-200', img: IMG('冰之結晶'), d: '凝住的時間。' });
  addItem(RIFT.scale, { n: '侵蝕龍鱗', c: 'text-purple-300', img: IMG('地龍鱗'), d: '被侵蝕的龍鱗。' });
  // 專屬信物（第十三節：從目前會掉落的道具挑，新做「夢域鏡 ＋原名」；原道具從所有掉落表拿掉、古物學者的常駐委託不再抽它）
  //   2026-11-05 同事調查的首選（尚待玩家確認，可替換）：原道具留在 AFK_TTMI_ITEMS.junk() 清單裡（劇情委託靠排序位置），只是不掉、不抽
  var TOKENS = {
    moon:   { base: 'ttmi_14564', n: '夢域鏡 圓月寶珠' },
    steel:  { base: 'ttmi_11479', n: '夢域鏡 火神之槌' },
    swan:   { base: 'ttmi_9643',  n: '夢域鏡 古老水珍珠' },
    shadow: { base: 'ttmi_4319',  n: '夢域鏡 闇之氣息' },
    magic:  { base: 'ttmi_7090',  n: '夢域鏡 占星術師的符咒' }
  };
  var tokenId = function (k) { return 'afk_guard_token_' + k; };
  var syncTokens = function () {
    KEYS.forEach(function (k) {
      var t = TOKENS[k], b = t.base && DB.items[t.base], id = tokenId(k), d = DB.items[id] || addItem(id, {});
      d.n = t.n || (b ? '夢域鏡 ' + b.n : '夢域鏡 信物');
      d.c = 'text-fuchsia-300'; d.img = (b && b.img) || IMG('光明的鱗片');
      d.d = KN[k].s + '的試煉（夢域鏡）裡，王必掉的信物；次元裂縫難度不掉。升級' + KN[k].short + '守護者之戒的上半部要用。';
    });
  };
  syncTokens();
  // 戒指（只顯示在裝備格，不會出現在背包）
  var ringId = function (k) { return 'afk_guard_ring_' + k; };
  KEYS.forEach(function (k) {
    DB.items[ringId(k)] = DB.items[ringId(k)] || { n: KN[k].short + '守護者之戒', type: 'acc', slot: 'guard', req: 'all', safe: 0, p: 0, gachaWeight: 0, noEnhance: true, noTrade: true, noSell: true, noJunk: true,
      weight: 0, c: 'c-legend', img: KN[k].ring, afkGuard: k, d: KN[k].n + '的守護者之戒。' };
    try { if (typeof ITEM_WEIGHTS !== 'undefined') ITEM_WEIGHTS[DB.items[ringId(k)].n] = 0; } catch (e) {}
  });
  try { if (typeof WEIGHT_COUNT_SLOTS !== 'undefined' && WEIGHT_COUNT_SLOTS.indexOf('guard') < 0) WEIGHT_COUNT_SLOTS.push('guard'); } catch (e) {}

  // 材料：上半部（第八節＋第十三節）、完整
  var REFINE_PART = { heart: 'rem_heart', eye: 'rem_eye', scale: 'rem_scale', blood: 'rem_blood', bone: 'rem_bone' };
  var COST = {
    up: [
      { emblem: 30, token: 10,  refine: { heart: 5, eye: 5, scale: 20 },  contempt: 3, dream: 5000, dim: 0,    key: 1, dia: 10000 },
      { emblem: 40, token: 20, refine: { heart: 8, eye: 8, blood: 20 },  contempt: 5, dream: 8000, dim: 0,    key: 3, dia: 15000 },
      { emblem: 60, token: 30, refine: { heart: 10, eye: 10, bone: 30 }, contempt: 8, dream: 0,    dim: 1000, key: 5, dia: 20000 }
    ],
    full: [
      { shard: 10, oath: 20, scale: 10, tear: 500, rift: { glim: 300 },  sand: 0, dia: 30000 },
      { shard: 15, oath: 30, scale: 15, tear: 500, rift: { memory: 1 },  sand: 5, dia: 50000 },
      { shard: 25, oath: 50, scale: 25, tear: 500, rift: { thread: 2 },  sand: 0, dia: 100000 }
    ],
    change: 100000000
  };
  var DREAM_SET = { '月光': '血月', '白鳥': '冥鴉', '鐵衛': '冥鐵', '暗影': '深淵' };
  // 淬鍊材料（席琳遺骸夢域淬鍊過的「血月之心」這類）：背包裡、沒上鎖、夢域淬鍊過、指定套裝的指定部位
  var refineName = function (set, part) { return (DREAM_SET[set] || set) + (DB.items[REFINE_PART[part]] || {}).n; };
  var refineList = function (set, part) {
    var p = P(); if (!p) return [];
    var want = set + '夢', id = REFINE_PART[part];
    return (p.inv || []).filter(function (it) { return it && it.id === id && !it.lock && it.seteff === want; });
  };
  var refineCount = function (set, part) { return refineList(set, part).reduce(function (s, it) { return s + Math.max(1, Number(it.cnt) || 1); }, 0); };
  var refineTake = function (set, part, n) {
    var p = P(), list = refineList(set, part);
    for (var i = 0; i < list.length && n > 0; i++) { var it = list[i], c = Math.max(1, Number(it.cnt) || 1), u = Math.min(c, n); n -= u; if (c - u <= 0) p.inv.splice(p.inv.indexOf(it), 1); else it.cnt = c - u; }
    return n <= 0;
  };
  var have = function (id) { try { return typeof questCountId === 'function' ? questCountId(id) : 0; } catch (e) { return 0; } };
  var haveWh = function (id) { try { return typeof whCountId === 'function' ? whCountId(id) : 0; } catch (e) { return 0; } };
  var take = function (id, n) { if (!(n > 0)) return; if (typeof questConsumeId === 'function') questConsumeId(id, n); };
  var c4 = function (n) { return Math.ceil(n / 4); };
  // 下一星需要的材料：[{ kind:'item'|'refine'|'dia', id, set, part, n, label }]
  var needOf = function (k, s) {
    var out = [], add = function (o) { if (o.n > 0) out.push(o); };
    if (s >= 6) return out;
    var ele = KN[k].ele, magic = k === 'magic';
    if (s < 3) {
      var c = COST.up[s];
      add({ id: M.emblem, n: c.emblem }); add({ id: tokenId(k), n: c.token });
      if (magic) {
        ['moon', 'steel', 'swan', 'shadow'].forEach(function (o) { Object.keys(c.refine).forEach(function (part) { add({ kind: 'refine', set: KN[o].set, part: part, n: c4(c.refine[part]) }); }); });
        ELES.forEach(function (e) { add({ id: M.contempt[e], n: Math.ceil(c.contempt / 2) }); });
        add({ id: M.key, n: c.key });
      } else {
        Object.keys(c.refine).forEach(function (part) { add({ kind: 'refine', set: KN[k].set, part: part, n: c.refine[part] }); });
        add({ id: M.contempt[ele], n: c.contempt });
      }
      add({ id: M.dream, n: c.dream }); add({ id: M.dim, n: c.dim });
      add({ kind: 'dia', n: c.dia });
    } else {
      var f = COST.full[s - 3];
      add({ id: M.shard, n: f.shard });
      if (magic) { ELES.forEach(function (e) { add({ id: M.oath[e], n: c4(f.oath) }); add({ id: M.tear[e], n: c4(f.tear) }); }); add({ id: RIFT.sand, n: f.sand }); }
      else { add({ id: M.oath[ele], n: f.oath }); add({ id: M.tear[ele], n: f.tear }); }
      add({ id: RIFT.scale, n: f.scale });
      Object.keys(f.rift).forEach(function (rk) { add({ id: RIFT[rk], n: f.rift[rk] * (k === 'swan' && rk === 'memory' ? 2 : 1) }); });
      add({ kind: 'dia', n: f.dia });
    }
    return out;
  };
  var needHave = function (x) {
    if (x.kind === 'refine') return refineCount(x.set, x.part);
    if (x.kind === 'dia') { var DC = W.__afkDiaCost; return DC && !DC.check(x.n) ? x.n : 0; }
    return have(x.id);
  };
  var needLabel = function (x) {
    if (x.kind === 'refine') return refineName(x.set, x.part) + '（夢域淬鍊）';
    if (x.kind === 'dia') { var DC = W.__afkDiaCost; return DC ? DC.txt(x.n) : '龍之鑽石 ' + fmt(x.n); }
    return (DB.items[x.id] || {}).n || x.id;
  };

  // ═══════════════════════════ 三、狀態 ═══════════════════════════
  var store = function (p) {
    p = p || P(); if (!p) return null;
    var g = p.afkGuard;
    if (!g || typeof g !== 'object') g = p.afkGuard = {};
    if (!g.k || typeof g.k !== 'object') g.k = {};
    if (!g.q || typeof g.q !== 'object') g.q = {};
    if (g.zeus !== 'dark') g.zeus = 'light';
    if (g.day !== dayKey()) { g.day = dayKey(); g.used = {}; }
    if (!g.used || typeof g.used !== 'object') g.used = {};
    return g;
  };
  var stageOf = function (p, k) { var g = p && p.afkGuard; return g && g.k ? Math.max(0, Math.min(6, Math.floor(Number(g.k[k]) || 0))) : 0; };
  var sysOn = function (p) { return !!(p && !p.classicMode && (Number(p.rebirth) || 0) > 0); };
  var mainOf = function (p) { var g = p && p.afkGuard; var k = g && g.main; return (k && KN[k] && stageOf(p, k) > 0) ? k : null; };
  var legacy = function (p) { return !!(p && hiddenOn() && sysOn(p) && p.cls === 'knight' && mainOf(p)); };
  var shelter = function (p) { return !!(p && mainOf(p) && KEYS.every(function (k) { return stageOf(p, k) >= 6; })); };
  var marks = function (p) { var n = 0, g = 0; KEYS.forEach(function (k) { var m = markOf(stageOf(p, k)); if (m) n++; if (m === 'gold') g++; }); return { n: n, gold: g }; };
  var riftOn = function () { try { return typeof W.__afkDimRiftOn === 'function' && !!W.__afkDimRiftOn(); } catch (e) { return false; } };
  var dreamOn = function (p) { p = p || P(); return !!(p && !p.classicMode && p.sherineDream && p.sherineMad); };

  // 全部效果（已乘守護傳承）
  var ZERO = function () { return { abn: 0, dur: 0, durX: 0, durR: 0, pet: 0, weight: 0, mhp: 0, mmp: 0, dr: 0, er: 0, resNone: 0, res5: 0, regen: 0, rcd: 0, healIn: 0, healCut: 0,
    waterTrue: 0, petTaken: 0, magTaken: 0, iron: 0, vsAbn: 0, magDmg: 0, mpCost: 0, cleanse: null, song: null, shadow: null, owen: null, guard: null }; };
  var compute = function (p) {
    var E = ZERO(); E.on = false;
    if (!p || !sysOn(p)) return E;
    var main = mainOf(p); if (!main) return E;
    var s = stageOf(p, main), g = store(p), face = g.zeus;
    E.on = true; E.main = main; E.stage = s; E.legacy = legacy(p); E.mult = E.legacy ? 1.5 : 1; E.shelter = shelter(p);
    var addV = function (k, o) {
      if (!o) return;
      ['abn', 'pet', 'weight', 'mhp', 'mmp', 'dr', 'er', 'resNone', 'res5', 'regen', 'rcd', 'healIn', 'waterTrue', 'petTaken', 'magTaken', 'iron', 'vsAbn', 'magDmg', 'mpCost'].forEach(function (f) { if (o[f]) E[f] += o[f]; });
      if (o.durX) E.durX = Math.round((1 - (1 - E.durX / 100) * (1 - o.durX / 100)) * 10000) / 100;
      if (o.healCut) E.healCut += o.healCut;
      if (o.cleanse) E.cleanse = { ch: o.cleanse, cd: o.cleanseCd };
      if (o.song) E.song = { pct: o.song, cd: o.songCd };
      if (o.shadowStep) E.shadow = { cd: o.shadowCd };
      if (o.owen) E.owen = { pct: o.owen };
    };
    addV(main, valOf(main, s, { face: face }));
    if (E.shelter) KEYS.forEach(function (k) { if (k !== main) addV(k, valOf(k, 3, { face: face, noOwen: true })); });
    var i = s - 1;
    E.abn += COMMON.abn[i]; E.dur = COMMON.dur[i]; E.pet += COMMON.pet[i]; E.weight += COMMON.weight[i]; E.mhp += COMMON.mhp[i];
    var mk = marks(p); E.marks = mk;
    [2, 3, 4, 5].forEach(function (n) {
      if (mk.n < n) return;
      var R = mk.gold >= n ? RESO[n].gold : RESO[n].silver;
      if (R.abn) E.abn += R.abn; if (R.dur) E.durR = R.dur; if (R.pet) E.pet += R.pet; if (R.weight) E.weight += R.weight;
      if (R.guard) E.guard = { red: R.guard, cd: R.cd, mercs: R.mercs, gold: mk.gold >= n };
    });
    var x15 = function (v) { return Math.round(v * 1.5 * 10) / 10; };
    if (E.legacy) {
      ['abn', 'dur', 'durX', 'durR', 'pet', 'weight', 'mhp', 'mmp', 'dr', 'er', 'resNone', 'res5', 'regen', 'rcd', 'healIn', 'waterTrue', 'petTaken', 'magTaken', 'iron', 'vsAbn', 'magDmg', 'mpCost'].forEach(function (f) { E[f] = x15(E[f]); });
      if (E.cleanse) E.cleanse.ch = x15(E.cleanse.ch); if (E.song) E.song.pct = x15(E.song.pct); if (E.owen) E.owen.pct = x15(E.owen.pct); if (E.guard) E.guard.red = x15(E.guard.red);
    }
    ['durX', 'magTaken', 'petTaken', 'iron', 'mpCost'].forEach(function (f) { E[f] = Math.min(90, E[f]); });
    if (E.guard) E.guard.red = Math.min(90, E.guard.red);
    if (E.cleanse) E.cleanse.ch = Math.min(100, E.cleanse.ch);
    E.aura = E.shelter && riftOn();
    return E;
  };
  var cache = { p: null, v: null, at: -1 };
  var cur = function () { var p = P(); if (!cache.v || cache.p !== p || cache.at !== tk()) cache = { p: p, v: compute(p), at: tk() }; return cache.v; };
  var refresh = function () { cache.v = null; try { if (typeof recomputeStats === 'function' && P()) recomputeStats(); } catch (e) {} };

  // ── 裝備格（唯讀屬性：不存檔、for…in 掃不到）──
  var VIRT = {}; KEYS.forEach(function (k) { VIRT[k] = { id: ringId(k), uid: 'afk-guard-' + k, en: 0, cnt: 1 }; });
  var slotOn = function (p) { return !!(p && sysOn(p) && (!T || T.enabled('guardring'))); };
  W.__afkGuardSlotOn = slotOn;
  var ensureSlot = function (p) {
    if (!p || !p.eq || typeof p.eq !== 'object') return;
    var d = Object.getOwnPropertyDescriptor(p.eq, 'guard');
    if (d && d.get && d.get.__afkGuard) return;
    if (d && !d.configurable) return;
    try {
      delete p.eq.guard;
      var getter = function () { var q = P(); if (q && q.eq !== this) q = null; var who = q || p; if (!slotOn(who)) return null; var k = mainOf(who); return k ? VIRT[k] : null; };
      getter.__afkGuard = true;
      Object.defineProperty(p.eq, 'guard', { get: getter, set: function () {}, enumerable: false, configurable: true });
    } catch (e) {}
  };
  // 異常狀態抵抗、負重放在戒指上（核心掃 WEIGHT_COUNT_SLOTS）
  var syncRing = function (p) {
    var E = compute(p), mk = E.marks || { n: 0, gold: 0 };
    KEYS.forEach(function (k) {
      var d = DB.items[ringId(k)]; if (!d) return;
      var on = E.on && E.main === k;
      d.abnormalResist = on ? E.abn : 0; d.weightCap = on ? E.weight : 0;
      d.img = on && E.shelter ? ART.final : KN[k].ring;   // 庇護者之戒：換成第六張圖
      d.d = KN[k].n + '的守護者之戒。' + (on ? '【主誓約：' + KN[k].short + ' ' + stageN(E.stage) + '】【騎士之印：金 ' + mk.gold + '、銀 ' + (mk.n - mk.gold) + '】' : '');
    });
    return E;
  };

  // ═══════════════════════════ 四、數值掛點 ═══════════════════════════
  var RES4 = ['resFire', 'resWater', 'resWind', 'resEarth'];
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var p = P();
      try { if (p) { ensureSlot(p); syncRing(p); } cache.v = null; } catch (e) {}
      var r = oRe.apply(this, arguments);
      try {
        if (p && p.d && slotOn(p)) {
          var E = cur(), d = p.d; if (E.on) {
            d.dr = (Number(d.dr) || 0) + E.dr; d.er = (Number(d.er) || 0) + E.er;
            RES4.forEach(function (k) { d[k] = (Number(d[k]) || 0) + E.res5; });
            d.resNone = (Number(d.resNone) || 0) + E.res5 + E.resNone;
            d.hpR = (Number(d.hpR) || 0) + E.regen; d.mpR = (Number(d.mpR) || 0) + E.regen;
            d.rangedCritDmg = (Number(d.rangedCritDmg) || 0) + E.rcd;
          }
        }
      } catch (e) { console.warn('[AFK-guardring] stats', e); }
      return r;
    };
    try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  }
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) { if (!p || p !== P() || !slotOn(p)) return; var E = cur(); if (!E.on) return; if (E.mhp) p.mhp = (Number(p.mhp) || 0) + E.mhp; if (E.mmp) p.mmp = (Number(p.mmp) || 0) + E.mmp; });
  // 寵物、召喚物
  var petAdd = function (r) { var p = P(); if (!p || !slotOn(p) || !r) return r; var E = cur(); if (E.on && E.pet) { r.dmg = (r.dmg || 0) + E.pet; r.hit = (r.hit || 0) + E.pet; } return r; };
  if (typeof W.petGearBonus === 'function') {
    var oPG = W.petGearBonus;
    W.petGearBonus = function () { var r = oPG.apply(this, arguments); try { r = petAdd(r); } catch (e) {} return r; };
    try { (0, eval)('petGearBonus = window.petGearBonus'); } catch (e) {}
  }
  if (typeof W.summonGearBonus === 'function') {
    var oSG = W.summonGearBonus;
    W.summonGearBonus = function (owner) { var r = oSG.apply(this, arguments); try { if (!owner || owner === P()) r = petAdd(r); } catch (e) {} return r; };
    try { (0, eval)('summonGearBonus = window.summonGearBonus'); } catch (e) {}
  }
  // 受到的治療（治療魔法、治癒藥水）
  var healPct = function () { var E = cur(); return E.on ? E.healIn - E.healCut : 0; };
  if (typeof W.rollHealingSpell === 'function') {
    var oHeal = W.rollHealingSpell;
    W.rollHealingSpell = function (sk, dS, caster, target) {
      var v = oHeal.apply(this, arguments);
      try { if (v > 0 && target && target === P() && slotOn(target)) { var h = healPct(); if (h) v = Math.max(1, Math.floor(v * (1 + h / 100))); } } catch (e) {}
      return v;
    };
    try { (0, eval)('rollHealingSpell = window.rollHealingSpell'); } catch (e) {}
  }
  if (typeof W.playerEquipPotionBonusPct === 'function') {
    var oPot = W.playerEquipPotionBonusPct;
    W.playerEquipPotionBonusPct = function () { var v = oPot.apply(this, arguments); try { var p = P(); if (p && slotOn(p)) v += healPct(); } catch (e) {} return v; };
    try { (0, eval)('playerEquipPotionBonusPct = window.playerEquipPotionBonusPct'); } catch (e) {}
  }
  // 攻擊魔法的 MP 消耗（黑暗之星）
  var hookCost = function () {
    var R = W.AFK_RELIC_RUNTIME; if (!R || typeof R.castCost !== 'function' || R.castCost._afkGuard || R._afkGuardCost) return; R._afkGuardCost = true;
    var o = R.castCost;
    R.castCost = function (actor, skill) {
      var v = o.apply(this, arguments);
      try { if (actor && actor === P() && slotOn(actor) && skill && skill.type === 'atk' && v > 0 && v < Number.MAX_SAFE_INTEGER) { var m = cur().mpCost; if (m > 0) v = Math.max(0, Math.ceil(v * (1 - m / 100))); } } catch (e) {}
      return v;
    };
    Object.keys(o).forEach(function (f) { R.castCost[f] = o[f]; });   // 其他外掛（afk-carve）認自己的旗標，load 時才不會再包一層
    R.castCost._afkGuard = true;
  };
  hookCost(); W.addEventListener('load', hookCost);
  // 寵物、召喚物受到的傷害
  var hookComp = function () {
    var R = W.AFK_RELIC_COMPANIONS; if (!R || typeof R.incoming !== 'function' || R.incoming._afkGuard || R._afkGuardIn) return; R._afkGuardIn = true;
    var o = R.incoming;
    R.incoming = function (ent, dmg) {
      var v = o.apply(this, arguments);
      try { var p = P(); if (p && ent && ent !== p && (p.allies || []).indexOf(ent) < 0 && slotOn(p) && v > 0) { var c = cur().petTaken; if (c > 0) v = Math.max(1, Math.floor(v * (1 - c / 100))); } } catch (e) {}
      return v;
    };
    Object.keys(o).forEach(function (f) { R.incoming[f] = o[f]; });
    R.incoming._afkGuard = true;
  };
  hookComp(); W.addEventListener('load', hookComp);
  // 受到的傷害（核心合併）：魔法、鋼鐵之軀、五騎士的守護
  var ccOn = function (st) { if (!st) return false; for (var i = 0; i < CC.length; i++) if ((Number(st[CC[i]]) || 0) > 0) return true; return false; };
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob, kind) {
    var p = P(); if (!p || !slotOn(p)) return 1;
    var E = cur(); if (!E.on) return 1;
    var m = 1;
    if (ent === p) {
      if (kind === 'magic' && E.magTaken) m *= 1 - E.magTaken / 100;
      if (E.iron && ccOn(p.statuses)) m *= 1 - E.iron / 100;
      if (E.guard && tk() < (Number(p._gdGuardUntil) || 0)) m *= 1 - E.guard.red / 100;
    } else if ((p.allies || []).indexOf(ent) >= 0) {
      if (E.guard && E.guard.mercs && tk() < (Number(ent._gdGuardUntil) || 0)) m *= 1 - E.guard.red / 100;
    }
    return m;
  });

  // ── 滿月（共用計時）──
  var MOON = { cycle: 24 * 60000, full: 4 * 60000 };
  var fullMoon = function () { var t = api.now() % MOON.cycle; return t >= 0 && t < MOON.full; };
  var moonLeft = function () { var t = api.now() % MOON.cycle; return fullMoon() ? MOON.full - t : MOON.cycle - t; };
  if (!W.__afkFullMoon) W.__afkFullMoon = { on: fullMoon, left: moonLeft, MOON: MOON };
  var owenOn = function (p) { var E = cur(); return !!(E.on && E.owen && fullMoon() && p && !p.dead); };

  var fire = function (key, label, color) {
    if (!X) return; var E = cur();
    X.pop('gd' + key, KN[E.main] ? KN[E.main].ring : '', label, color || '#fde68a');
    X.note('gd' + key, '<span style="color:' + (color || '#fde68a') + '">💍【' + esc(label) + '】</span>');
  };
  var isPartyMember = function (a) { var p = P(); return !!(p && a && (a === p || (p.allies || []).indexOf(a) >= 0)); };
  var stOf = function (e) { var p = P(); return e === p ? p.statuses : (e.statuses || e._statuses); };
  var clearOne = function (e) { var st = stOf(e); if (!st) return false; for (var i = 0; i < DEBUFFS.length; i++) { if ((Number(st[DEBUFFS[i]]) || 0) > 0) { st[DEBUFFS[i]] = 0; return true; } } return false; };
  var clearAll = function (e) { var st = stOf(e); if (!st) return; DEBUFFS.forEach(function (k) { if ((Number(st[k]) || 0) > 0) st[k] = 0; }); };
  var healE = function (e, pct) {
    var p = P(); if (!e || !(pct > 0)) return;
    if (e === p) { if (!p.dead) p.hp = Math.min(p.mhp, (p.hp || 0) + Math.floor((p.mhp || 0) * pct / 100)); return; }
    if (e._downed || !(e.curHp > 0)) return;
    e.curHp = Math.min(e.mhp, e.curHp + Math.floor((e.mhp || 0) * pct / 100));
  };
  var petsOut = function () { try { return typeof petsOutList === 'function' ? petsOutList() : []; } catch (e) { return []; } };
  var sumsOut = function () { try { return typeof summonV2List === 'function' ? summonV2List() : []; } catch (e) { return []; } };
  // 持續時間：我們這一份（共通、影子騎士、共鳴、抵抗溢出），跟其他來源一起最多 −70%
  var rawAbn = function (p) { var s = 0; try { (typeof WEIGHT_COUNT_SLOTS !== 'undefined' ? WEIGHT_COUNT_SLOTS : []).forEach(function (k) { var e = p.eq && p.eq[k], dd = e && DB.items[e.id]; if (dd && dd.abnormalResist) s += Number(dd.abnormalResist) || 0; }); } catch (e) {} return s; };
  var overDur = function (p) { var o = Math.max(0, rawAbn(p) - CAPS.abn); return Math.min(CAPS.overMax, Math.floor(o / CAPS.overStep) * CAPS.overGain); };
  var _inOther = false;
  var otherDurMult = function (p) { var m = 1; if (_inOther) return m; _inOther = true; try { var C = W.__afkCarve; if (C && C.durParts) C.durParts(p).forEach(function (x) { if (x[0] !== '守護者之戒') m *= 1 - x[1]; }); } catch (e) {} _inOther = false; return m; };
  var durCut = function (p) {
    if (_inOther) return 0;   // 刻印那邊算「其他來源」時回頭問我們：不算自己，免得互相呼叫到堆疊爆掉
    p = p || P(); var E = cur(); if (!p || !E.on) return 0;
    var mine = (1 - E.dur / 100) * (1 - E.durX / 100) * (1 - E.durR / 100) * (1 - overDur(p) / 100);
    var floor = (1 - CAPS.durMax / 100) / Math.max(0.0001, otherDurMult(p));
    return Math.max(0, 1 - Math.max(mine, Math.min(1, floor)));
  };
  var lastSt = { p: null, v: null };
  var durTick = function (p, E) {
    var st = p.statuses; if (!st || typeof st !== 'object') { lastSt.p = null; return; }
    var prev = lastSt.p === p ? lastSt.v : {}, now = {}, cut = E.on ? durCut(p) : 0;
    DEBUFFS.forEach(function (k) {
      var v = Number(st[k]) || 0;
      if (v > 0 && v > (Number(prev[k]) || 0)) {
        // 月光庇護：暈眩、冰凍、石化、麻痺、睡眠剛上身時
        if (E.cleanse && CC.indexOf(k) >= 0 && tk() >= (Number(p._gdCleanseAt) || 0) && rnd() < E.cleanse.ch / 100) { p._gdCleanseAt = tk() + E.cleanse.cd * 10; st[k] = 0; v = 0; fire('cleanse', '月光庇護', '#a5b4fc'); }
        else if (cut > 0) { v = Math.max(Number(prev[k]) || 0, Math.max(1, Math.round(v * (1 - cut)))); st[k] = v; }
      }
      now[k] = v;
    });
    lastSt.p = p; lastSt.v = now;
  };
  var guardTick = function (e, E, t) {
    var hp = e === P() ? e.hp : e.curHp, ratio = (Number(hp) || 0) / Math.max(1, Number(e.mhp) || 1), below = ratio < GUARD.hpPct / 100;
    if (below && !e._gdBelow && t >= (Number(e._gdGuardAt) || 0) && hp > 0) {
      e._gdGuardAt = t + E.guard.cd * 10; e._gdGuardUntil = t + GUARD.dur * 10; clearAll(e);
      fire('guard', E.guard.gold ? '王的五騎士' : '五騎士的守護', '#fcd34d');
    }
    e._gdBelow = below;
  };
  var swan = { next: 0 }, owen = { next: 0 };
  if (X) {
    X.on('tick', function () {
      var p = P(); if (!p || !slotOn(p)) return;
      ensureSlot(p);
      var E = cur(), t = tk();
      durTick(p, E);
      if (!E.on || p.dead) return;
      if (E.guard) { guardTick(p, E, t); if (E.guard.mercs) (p.allies || []).forEach(function (a) { if (a && !a._downed) guardTick(a, E, t); }); }
      if (E.song && X.inCombat()) {
        if (t >= swan.next || swan.next - t > E.song.cd * 10) {
          swan.next = t + E.song.cd * 10;
          [p].concat((p.allies || []).filter(function (a) { return a && !a._downed; })).forEach(function (e) { clearOne(e); healE(e, E.song.pct); });
          fire('song', '天鵝之歌', '#7dd3fc');
        }
      }
      if (owenOn(p)) {
        if (t >= owen.next || owen.next - t > OWEN.every * 10) {
          owen.next = t + OWEN.every * 10;
          [p].concat((p.allies || []).filter(function (a) { return a && !a._downed; })).forEach(function (e) { healE(e, E.owen.pct); });
          petsOut().forEach(function (pt) { try { if (pt.hp > 0) pt.hp = Math.min(typeof petMhpEff === 'function' ? petMhpEff(pt) : (pt.mhp || pt.hp), pt.hp + Math.floor((typeof petMhpEff === 'function' ? petMhpEff(pt) : (pt.mhp || 0)) * E.owen.pct / 100)); } catch (e) {} });
          sumsOut().forEach(function (s) { if (s && s.hp > 0 && s.mhp) s.hp = Math.min(s.mhp, s.hp + Math.floor(s.mhp * E.owen.pct / 100)); });
          if (X.inCombat()) fire('owen', '歐文', '#e0e7ff');
        }
      }
    });
    // 造成的傷害：歐文的代價、黑暗之星、對異常狀態的目標、水屬性弱點的真實傷害
    X.on('dealt', function (actor, target, v, opt) {
      var p = P(); if (!p || actor !== p || !slotOn(p) || !target || target === p) return v;
      var E = cur(); if (!E.on) return v;
      var m = 1;
      if (owenOn(p)) m *= 1 - OWEN.cost / 100;
      if (E.magDmg && opt.kind === 'magic') m *= 1 + E.magDmg / 100;
      if (E.vsAbn && target.st) { for (var i = 0; i < DEBUFFS.length; i++) if ((Number(target.st[DEBUFFS[i]]) || 0) > 0) { m *= 1 + E.vsAbn / 100; break; } }
      v = v * m;
      if (E.waterTrue && !opt.inherited && typeof isElementCounter === 'function') { try { if (target.e && isElementCounter('water', target.e)) v += E.waterTrue; } catch (e) {} }
      return v;
    });
    // 影遁
    X.on('evade', function () { var p = P(); if (!p || !slotOn(p)) return; var E = cur(); if (E.shadow && tk() >= (Number(p._gdShadowAt) || 0)) { p._gdShadowAt = tk() + E.shadow.cd * 10; p._gdShadowReady = true; fire('shadow', '影遁', '#c4b5fd'); } });
    X.on('resist', function () { var p = P(); if (p && p._gdShadowReady && slotOn(p) && cur().shadow) { p._gdShadowReady = false; return true; } return false; });
    // 宙斯：每罐治癒藥水 +N
    X.on('potion', function () { var p = P(); if (!p || !slotOn(p)) return; var E = cur(); if (E.on && E.regen > 0 && p.hp > 0) p.hp = Math.min(p.mhp, p.hp + Math.floor(E.regen)); });
  }

  // 守護者光環：次元裂縫的侵蝕最多把五屬性抗性扣到 500（面板本來就不到 500 的照面板）。給次元裂縫的侵蝕呼叫。
  var resFloor = function (p, eroded, panel) {
    p = p || P(); eroded = Number(eroded) || 0; panel = Number(panel) || 0;
    if (!p || !slotOn(p) || !cur().aura) return eroded;
    return Math.max(eroded, Math.min(panel, CAPS.auraFloor));
  };
  W.__afkGuardResFloor = resFloor;

  // ═══════════════════════════ 五、配戴、升級 ═══════════════════════════
  var save = function () { try { if (typeof saveGame === 'function' && P()) saveGame(); } catch (e) {} };
  var after = function () { refresh(); try { if (typeof updateUI === 'function') updateUI(); if (typeof refreshEquipmentWindow === 'function') refreshEquipmentWindow(); } catch (e) {} save(); };
  var canUp = function (p, k) {
    if (!sysOn(p)) return '轉生後才能使用。';
    var s = stageOf(p, k); if (s >= 6) return '已經升到最高。';
    if (s < 3 && !questDone(p, k)) return '先完成' + KN[k].s + '的劇情。';
    if (s >= 3 && !riftOn() && !api.testRift) return '完整版要等次元裂縫開放。';
    var miss = needOf(k, s).filter(function (x) { return needHave(x) < x.n; });
    if (miss.length) return '材料不夠：' + miss.map(function (x) { return needLabel(x) + ' 還差 ' + fmt(x.n - needHave(x)); }).join('、');
    return null;
  };
  var upgrade = function (k) {
    var p = P(); if (!p || !KN[k]) return false;
    var why = canUp(p, k); if (why) { sys('<span class="text-amber-300">' + esc(why) + '</span>'); return false; }
    var s = stageOf(p, k), need = needOf(k, s), DC = W.__afkDiaCost;
    if (W.__afkCraftLock && W.__afkCraftLock.stop(need)) return false;   // 暫停次元裂縫材料的製作
    var dia = need.filter(function (x) { return x.kind === 'dia'; })[0];
    if (dia && DC && !DC.pay(dia.n)) { sys('<span class="text-amber-300">龍之鑽石暫時無法扣除，沒有升級。</span>'); return false; }
    need.forEach(function (x) { if (x.kind === 'refine') refineTake(x.set, x.part, x.n); else if (x.kind !== 'dia') take(x.id, x.n); });
    var g = store(p); g.k[k] = s + 1;
    if (!g.main) g.main = k;
    sys('<span class="c-legend font-bold">💍 ' + esc(KN[k].short) + '守護者之戒升到' + stageN(s + 1) + '。</span>' + (markOf(s + 1) && markOf(s + 1) !== markOf(s) ? '（得到' + (markOf(s + 1) === 'gold' ? '金' : '銀') + '印）' : ''));
    if (shelter(p) && !g.shelterAt) { g.shelterAt = api.now(); sys('<span class="c-legend font-bold">💍 五枚守護者之戒都是金印——守護者之戒成為「庇護者之戒」。</span>'); }
    after(); return true;
  };
  var canWear = function (p, k) {
    if (!sysOn(p)) return '轉生後才能使用。';
    if (!(stageOf(p, k) > 0)) return '還沒有這一枚。';
    var g = store(p); if (g.main === k) return '已經配戴中。';
    if (!inTown()) return '只能在村莊更換。';
    if (g.main && mainOf(p) && (Number(p.gold) || 0) < COST.change) return '更換主誓約要金幣 ' + fmt(COST.change) + '。';
    return null;
  };
  var wear = function (k) {
    var p = P(); if (!p || !KN[k]) return false;
    var why = canWear(p, k); if (why) { sys('<span class="text-amber-300">' + esc(why) + '</span>'); return false; }
    var g = store(p);
    if (g.main && mainOf(p)) p.gold = Math.max(0, (Number(p.gold) || 0) - COST.change);
    g.main = k;
    sys('<span class="c-legend font-bold">💍 主誓約換成' + esc(KN[k].n) + '。</span>');
    after(); return true;
  };
  var setFace = function (face) {
    var p = P(); if (!p || !sysOn(p)) return false;
    if (!inTown()) { sys('<span class="text-amber-300">只能在村莊切換。</span>'); return false; }
    var g = store(p); g.zeus = face === 'dark' ? 'dark' : 'light';
    sys('<span class="font-bold" style="color:#fde68a">宙斯的戒指轉向了' + (g.zeus === 'dark' ? '「黑暗之星」' : '「幸運之子」') + '。</span>');
    after(); return true;
  };

  // ═══════════════════════════ 六、劇情任務（骨架；對話是佔位，小說寫好再換）═══════════════════════════
  // s：0 還沒接、1 進行中（打怪）、2 回報 → 完成（副本開啟）
  //   NPC（小說 54a～54e 的線索人物；own＝新做的 NPC，否則接在遊戲原本的 NPC 後面一個分頁）。對話先照小說寫的暫定版，小說審完再換。
  var QUESTS = {
    moon:   { npc: 'npc_afk_guard_moon', own: true, n: '老船夫', t: '碼頭', mob: ['風元素守護者', '深淵風靈'], need: 30,
      talk: ['「絲莉安？那孩子每個月有一夜不見人影。他托我收著一樣東西——船燈裡那片月之羽。」', '「風裡最近不太平靜。你替我把那些東西打散，我就把燈打開給你看。」', '「羽毛在發光……今晚是滿月。去吧，她在夢的那一邊等你。」'] },
    steel:  { npc: 'npc_masha', own: false, n: '馬沙', t: '鐵匠', mob: ['暗黑黑騎士', '血騎士'], need: 30,
      talk: ['「巴爾森的盾，我替阿頓保管了十六年。邊緣的鐵是我包的。」', '「黑騎士又在路上晃了。先替我清掉他們，我再告訴你那面盾的事。」', '「盾在，他就在——阿頓一直這麼說。去夢裡把那副鎧甲帶回來吧。」'] },
    swan:   { npc: 'npc_afk_guard_swan', own: true, n: '乳母諾娜', t: '燈塔', mob: ['深淵水靈', '水元素守護者'], need: 30,
      talk: ['「伊席蘿蒂出生那一夜，海在唱歌。我抱著她，在燈塔下聽了一整夜。」', '「那首歌又響起來了，水裡的東西都醒了。替我讓牠們安靜下來。」', '「歌聲在夢裡最清楚。陪她去聽完那首歌吧。」'] },
    shadow: { npc: 'npc_brudica', own: false, n: '布魯迪卡', t: '試煉', mob: ['影魔', '黑暗妖精盜賊'], need: 30,
      talk: ['「克里斯特？他只失手過一次。那一夜的事，他到現在都不肯說。」', '「洞裡的影子越來越多了。替我把牠們揪出來。」', '「他追的那個人，在夢裡等著。這一次，換你陪他追上去。」'] },
    magic:  { npc: 'npc_taras', own: false, n: '塔拉斯', t: '試煉', mob: ['象牙塔黑魔法師', '象牙塔黑長者'], need: 30,
      talk: ['「宙斯在七樓的鏡室待過整整一年。出來的時候，他把鏡子蓋上了。」', '「塔裡的黑魔法師又多了。先替我清一清。」', '「鏡子裡的那一個，還在等他——去見見黑暗之星吧。」'] }
  };
  var qOf = function (p, k) { var g = store(p); var q = g && g.q[k]; if (!q || typeof q !== 'object') q = g.q[k] = { s: 0, n: 0 }; return q; };
  var questDone = function (p, k) { return !!(p && p.afkGuard && p.afkGuard.q && p.afkGuard.q[k] && p.afkGuard.q[k].s >= 3); };
  var redLionDone = function (p) {
    try { var line = L && L.lines && L.lines.redlion; if (!line || typeof trialQStateFor !== 'function') return true; return trialQStateFor(p, L.keyOf(line, line.chapters.length - 1, p.cls)) === 2; } catch (e) { return true; }
  };
  var questWhy = function (p, k) {
    if (!sysOn(p)) return '轉生後才能接。';
    if (!redLionDone(p)) return '先完成劇情「紅獅之誓」。';
    return null;
  };
  var questStep = function (k) {
    var p = P(); if (!p || !QUESTS[k]) return false;
    var q = qOf(p, k), Q = QUESTS[k];
    if (q.s === 0) { var why = questWhy(p, k); if (why) { sys('<span class="text-amber-300">' + esc(why) + '</span>'); return false; } q.s = 1; q.n = 0; }
    else if (q.s === 1) { if (q.n < Q.need) return false; q.s = 3; sys('<span class="c-legend font-bold">💍 ' + esc(KN[k].s) + '的副本開啟了。到海音的' + esc(estiName()) + '那裡進入。</span>'); }
    else return false;
    save(); return true;
  };
  if (X) X.on('kill', function (m) {
    var p = P(); if (!p || !slotOn(p) || !m || m._gdQ) return; m._gdQ = true;
    KEYS.forEach(function (k) { var q = p.afkGuard && p.afkGuard.q && p.afkGuard.q[k]; if (q && q.s === 1 && QUESTS[k].mob.indexOf(m.n) >= 0 && q.n < QUESTS[k].need) { q.n++; if (q.n === QUESTS[k].need) sys('<span class="text-amber-200">' + esc(KN[k].s) + '交代的事辦完了，回去找' + esc(QUESTS[k].n) + '。</span>'); } });
  });

  // ═══════════════════════════ 七、騎士副本 ═══════════════════════════
  var DG = { daily: { dream: 3, rift: 1 }, waves: 3, perWave: 8, step: 0.10, timeMs: 15 * 60 * 1000, bossHp: 2, home: 'town_heine' };
  var mapOf = function (k) { return 'afk_guard_dg_' + k; };
  var keyOfMap = {}; KEYS.forEach(function (k) { keyOfMap[mapOf(k)] = k; });
  // 王的名字、外觀（借遊戲現有的動畫）、小怪
  var DGK = {
    moon:   { map: '月光的另一半', boss: '滿月的歐文', anim: '月之精靈歐薇', animId: 'siege_ovi', mobs: ['深淵風靈', '風元素守護者'] },
    steel:  { map: '鐵匠鋪的盾',   boss: '巴爾森的鎧甲', anim: '象牙塔活鎧甲', animId: 'iv_armor', mobs: ['暗黑黑騎士', '血騎士'] },
    swan:   { map: '海音的深淵',   boss: '海音的深淵歌姬', anim: '人魚', animId: 'mermaid', mobs: ['深淵水靈', '水元素守護者'] },
    shadow: { map: '失手的那一夜', boss: '沒有影子的人', anim: '魔族暗殺團', animId: 'demon_assassin', mobs: ['影魔', '黑暗妖精盜賊'] },
    magic:  { map: '象牙塔頂',     boss: '黑暗之星', anim: '象牙塔黑魔法師', animId: 'iv_blackmage', mobs: ['象牙塔黑長者', '象牙塔惡靈'] }
  };
  // 頭目台詞（2026-11-05 同事寫的版本，可替換）：登場｜半血｜四分之一｜倒下
  var BOSS_LINES = {
    moon:   { open: '你守了他十六年，卻從來不敢看我一眼。', half: '滿月照得到的地方，你都躲不開我。', quarter: '我也想守著他……用我自己的方式！', death: '……原來，拿不起劍的那一半，也在守著他。' },
    steel:  { open: '鐵匠的兒子，拿得起父親的盾嗎？', half: '（鎧甲裡傳出低語）……盾，舉得太低了。', quarter: '快走……趁我……還認得你……', death: '……好，這面盾，交給你了。' },
    swan:   { open: '公主，海底的王在等你回來唱完那首歌。', half: '聽見了嗎？浪聲在替我和聲。', quarter: '這首歌……為什麼你也會唱？', death: '這首歌……原來是為了守住岸上的人。' },
    shadow: { open: '影子是殺不死影子的。', half: '那一夜，你的刀慢了半步。', quarter: '我不是逃了。我一直在等你。', death: '……你終於追上來了。' },
    magic:  { open: '幸運之子，你把運氣都花在別人身上了。', half: '光的那一半，教不會你這一招。', quarter: '看清楚——這就是你不敢走完的路。', death: '去吧……光跟闇，本來就是同一顆星。' }
  };
  var linesReg = {};
  var regLines = function () {
    var BL = W.__afkBossLines; if (!BL || typeof BL.add !== 'function') return false;
    KEYS.forEach(function (k) { var n = DGK[k].boss; if (linesReg[n] === BOSS_LINES[k]) return; try { BL.add(n, BOSS_LINES[k]); linesReg[n] = BOSS_LINES[k]; } catch (e) {} });
    return true;
  };
  var sayLine = function (m, kind) {
    if (regLines()) return;   // 全遊戲的頭目台詞系統接手
    var k = m && m._gdKey, ln = k && BOSS_LINES[k] && BOSS_LINES[k][kind]; if (!ln) return;
    clog('<span class="font-bold" style="color:' + KN[k].c + '">' + esc(m.n) + '：</span><span style="color:' + KN[k].c + '">「' + esc(ln) + '」</span>', 'enemy');
  };
  KEYS.forEach(function (k) {
    var mp = mapOf(k);
    try { if (L && L.aliasAnim && !L.aliasAnim(DGK[k].boss, DGK[k].anim)) { var am = DB.mobs[DGK[k].animId]; if (am && am.n) L.aliasAnim(DGK[k].boss, am.n); } } catch (e) {}   // afk-knightnames 把歐薇改名成歐文：舊名的動畫條目還在，先用舊名
    var first = Object.keys(DB.mobs).filter(function (id) { return DB.mobs[id] && DB.mobs[id].n === DGK[k].mobs[0]; })[0];
    DB.maps[mp] = first ? [first] : [];
    try { if (typeof SPECIAL_AREA_BG !== 'undefined') SPECIAL_AREA_BG[mp] = 'assets/area/地監深層.jpg'; } catch (e) {}
    try { if (typeof MAP_DESC !== 'undefined' && !MAP_DESC[mp]) MAP_DESC[mp] = KN[k].n + '的試煉。'; } catch (e) {}
    try { if (typeof SANCTUARY_MAP_NAMES !== 'undefined') SANCTUARY_MAP_NAMES[mp] = '守護者的試煉：' + DGK[k].map; } catch (e) {}
  });
  try { W.__afkNoOfflineMaps = (W.__afkNoOfflineMaps || []).concat(KEYS.map(mapOf)); } catch (e) {}
  // 數值：照你的等級找最接近的地監頭目／一般怪當底，換上這個騎士的名字和屬性
  var dungeonMaps = function () { try { return ((MAP_CATEGORIES || {}).dungeon || []).map(function (m) { return m.v; }); } catch (e) { return []; } };
  var POOL = null;
  var pools = function () {
    if (POOL) return POOL;
    POOL = { boss: [], mob: [] }; var seen = {};
    dungeonMaps().forEach(function (v) { (DB.maps[v] || []).forEach(function (id) { var m = DB.mobs[id]; if (!m || seen[id] || m.afkTtmi || m.questOnly || m.race === '建築') return; seen[id] = 1; (m.boss ? POOL.boss : POOL.mob).push(id); }); });
    return POOL;
  };
  var nearest = function (list, lv) { var best = null, bd = 1e9; list.forEach(function (id) { var d = Math.abs((Number(DB.mobs[id].lv) || 1) - lv); if (d < bd) { bd = d; best = id; } }); return best; };
  var idByName = function (n) { for (var id in DB.mobs) if (DB.mobs[id] && DB.mobs[id].n === n) return id; return null; };
  var ELE_MOB = { wind: 'wind', fire: 'fire', water: 'water', earth: 'earth', all: null };
  var tpl = function (k, boss) {
    var p = P(), lv = Math.min(120, Math.max(30, Number(p && p.lv) || 1)), pl = pools();
    var ref = nearest(boss ? pl.boss : pl.mob, lv); if (!ref) return null;
    var o = JSON.parse(JSON.stringify(DB.mobs[ref]));
    var name = boss ? DGK[k].boss : DGK[k].mobs[Math.floor(rnd() * DGK[k].mobs.length) % DGK[k].mobs.length];
    o.n = name; if (ELE_MOB[KN[k].ele]) o.e = ELE_MOB[KN[k].ele];
    delete o.transformTo; delete o.transformHpPct;
    var src = boss ? (DB.mobs[DGK[k].animId] ? DGK[k].animId : idByName(DGK[k].anim)) : idByName(name);
    if (src && DB.mobs[src].img) o.img = DB.mobs[src].img;
    return { base: o, id: boss ? ref : (src || ref) };
  };
  var run = null, lastMap = null, leaving = false;
  var runOf = function (p) { var g = p && p.afkGuard; return g && g.run && typeof g.run === 'object' ? g.run : null; };
  var usedOf = function (p, k, mode) { var g = store(p); var u = g.used[k] = g.used[k] || {}; return Number(u[mode]) || 0; };
  var canEnter = function (k, mode) {
    var p = P(); mode = mode || 'dream';
    if (!p) return '請先進入遊戲。';
    if (!sysOn(p)) return '轉生後才能進入。';
    if (!questDone(p, k)) return '先完成' + KN[k].s + '的劇情。';
    if (mode === 'rift') { if (!riftOn()) return '次元裂縫尚未開放。'; }
    else if (!dreamOn(p)) return '只有在席琳夢域鏡的世界才能進入。';
    if (usedOf(p, k, mode) >= DG.daily[mode]) return '今天的 ' + DG.daily[mode] + ' 次已經用完，明天再來。';
    if (run && !run.done) return '已經在試煉裡了。';
    return null;
  };
  var showBattle = function () {
    try {
      var mapPanel = document.getElementById('town-view').parentElement;
      document.getElementById('battle-view').classList.remove('hidden');
      document.getElementById('combat-log-panel').classList.remove('hidden');
      document.getElementById('town-view').classList.add('hidden');
      document.getElementById('town-view').classList.remove('flex');
      mapPanel.classList.remove('flex-1', 'overflow-hidden');
    } catch (e) {}
  };
  var enter = function (k, mode) {
    mode = mode || 'dream';
    var p = P(), why = canEnter(k, mode); if (why) { sys('<span class="text-amber-300">' + esc(why) + '</span>'); return false; }
    if (typeof mercenaryRoleBattleBlocked === 'function' && mercenaryRoleBattleBlocked(mapOf(k))) return false;
    try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
    closeView();
    var g = store(p); g.used[k] = g.used[k] || {}; g.used[k][mode] = usedOf(p, k, mode) + 1;
    var MP = mapOf(k);
    mapState.current = MP; p.lastBattleMap = MP;
    mapState.mobs = [null, null, null, null, null]; mapState.spawnAt = [null, null, null, null, null];
    mapState.targetIdx = -1; mapState.forceBoss = false;
    run = { k: k, mode: mode, wave: 1, killed: 0, spawned: 0, boss: false, done: false, until: api.now() + DG.timeMs };
    g.run = run; lastMap = MP;
    sys('<span class="font-bold" style="color:' + KN[k].c + '">💍 你踏進了' + esc(KN[k].s) + '的試煉「' + esc(DGK[k].map) + '」。（今天第 ' + usedOf(p, k, mode) + '／' + DG.daily[mode] + ' 次）</span>');
    try { if (typeof _vfxClearAll === 'function') _vfxClearAll(); } catch (e) {}
    showBattle();
    try { if (typeof applyAreaBackground === 'function') applyAreaBackground(); } catch (e) {}
    try { renderMobs(); syncMapSelectors(); updateUI(); renderTabs(true); } catch (e) {}
    save();
    return true;
  };
  var leave = function (msg) {
    var t0 = run; run = null;
    try { var ps = P(); if (ps && ps.afkGuard) delete ps.afkGuard.run; } catch (e) {}
    if (msg) sys(msg);
    setTimeout(function () { try { if (keyOfMap[mapState.current] && run === null) { setMapSelectors(DG.home); changeMap(true); save(); } } catch (e) {} }, 1500);
    return t0;
  };
  var victory = function (m) {
    var p = P(), k = run.k, mode = run.mode, got = [];
    var mult = 1; try { mult = typeof partyRewardMult === 'function' ? Math.max(1, Number(partyRewardMult()) || 1) : 1; } catch (e) {}
    var em = 3 + Math.floor(rnd() * 3) % 3 + (mode === 'rift' ? 1 : 0); em = Math.max(1, Math.floor(em * mult));
    gainItem(M.emblem, em, true, true); got.push(DB.items[M.emblem].n + ' ×' + em);
    if (mode !== 'rift') { gainItem(tokenId(k), 1, true, true); got.push(DB.items[tokenId(k)].n + ' ×1'); }   // 玩家 11-11 14:13：次元裂縫不掉「夢域鏡 ○○」信物
    if (mode === 'rift') { gainItem(M.shard, 1, true, true); got.push(DB.items[M.shard].n + ' ×1'); }
    var g = store(p); g.clears = g.clears || {}; g.clears[k] = (Number(g.clears[k]) || 0) + 1;
    run.done = true;
    leave('<span class="text-yellow-300 font-bold">🏆 ' + esc(KN[k].s) + '的試煉通過了。你得到：' + got.join('、') + '。</span>');
  };
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      var cur0 = mapState.current, k = keyOfMap[cur0];
      if (!k) return oSpawn.apply(this, arguments);
      var keep = function () { if (!mapState.mobs[idx] || mapState.mobs[idx]._dead) mapState.mobs[idx] = null; };
      if (!run || run.done || run.k !== k || !L || !L.boss) return keep();
      if (mapState.mobs[idx] && !mapState.mobs[idx]._dead) return;
      var mult = 1 + DG.step * (run.wave - 1);
      if (run.wave <= DG.waves) {
        if (run.spawned >= DG.perWave) return keep();
        var t = tpl(k, false); if (!t) return keep();
        var m = L.boss.place(idx, t.base, { mobId: t.id, _gdRun: true, _gdKey: k, noAutoTeleport: true, noCharm: true });
        m.hp = Math.max(1, Math.round(m.hp * mult)); m.curHp = m.hp;
        if (Array.isArray(m.dmg)) m.dmg = [m.dmg[0], Math.max(2, Math.round(m.dmg[1] * mult))];
        run.spawned++;
      } else {
        if (idx !== 1 || !run.boss) return keep();
        var tb = tpl(k, true); if (!tb) return keep();
        var b = L.boss.place(idx, tb.base, { mobId: tb.id, boss: true, _gdRun: true, _gdBoss: true, _gdKey: k, noAutoTeleport: true, noCharm: true });
        b.hp = Math.max(1, Math.round(b.hp * DG.bossHp * mult)); b.curHp = b.hp;
        run.boss = false;
        clog('<span class="font-bold" style="color:' + KN[k].c + '">【' + esc(DGK[k].map) + '】</span>' + esc(b.n) + ' 出現了。', 'enemy');
        sayLine(b, 'open');
        try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(b); } catch (e) {}
      }
      try { if (!S().ff) renderMobs(); } catch (e) {}
    };
    try { (0, eval)('spawnMob = window.spawnMob'); } catch (e) {}
  }
  if (X) X.on('kill', function (m) {
    try {
      if (!m || !m._gdRun || m._gdDone || !run || run.done || keyOfMap[mapState.current] !== run.k) return;
      m._gdDone = true;
      if (m._gdBoss) { sayLine(m, 'death'); victory(m); return; }
      run.killed++;
      if (run.killed >= DG.perWave) {
        run.wave++; run.killed = 0; run.spawned = 0;
        if (run.wave > DG.waves) { run.boss = true; sys('<span style="color:' + KN[run.k].c + '">試煉的盡頭，有人在等你。</span>'); }
        else sys('<span style="color:' + KN[run.k].c + '">第 ' + run.wave + '／' + DG.waves + ' 波。</span>');
      }
    } catch (e) { console.warn('[AFK-guardring] kill', e); }
  });
  if (X) X.on('tick', function () {
    try {
      var cur0 = mapState.current, pc = P();
      if (cur0 !== lastMap) { if (keyOfMap[lastMap] && run) run = null; lastMap = cur0; }
      if (run && pc && runOf(pc) !== run) run = null;   // 換了角色
      var k = keyOfMap[cur0];
      if (!run && k && pc && !pc.dead) {   // 換角色回來、重新整理：接回存著的那一趟
        var sr = runOf(pc);
        if (sr && !sr.done && sr.k === k && Number(sr.until) > api.now() && Number(sr.wave) >= 1) {
          run = sr;
          var alive = mobs().filter(function (x) { return x && x._gdRun && !x._dead; });
          if (run.wave <= DG.waves) run.spawned = run.killed + alive.filter(function (x) { return !x._gdBoss; }).length;
          else run.boss = !alive.some(function (x) { return x._gdBoss; });
        } else if (!leaving) { leaving = true; leave('<span class="text-amber-300">試煉已經結束，你回到了海音。</span>'); setTimeout(function () { leaving = false; }, 2000); }
      }
      if (!run || !k || run.done) return;
      var alive2 = mobs().filter(function (x) { return x && x._gdRun && !x._dead; });
      if (run.wave > DG.waves) {
        var b = alive2.filter(function (x) { return x._gdBoss; })[0];
        if (!b && !run.boss) run.boss = true;   // 王沒倒下就不見了 → 重新出現
        if (b && b.hp > 0) {
          if (!b._gdHalf && b.curHp <= b.hp * 0.5) { b._gdHalf = true; sayLine(b, 'half'); }
          if (!b._gdQuarter && b.curHp <= b.hp * 0.25) { b._gdQuarter = true; sayLine(b, 'quarter'); }
        }
      } else run.spawned = Math.min(run.spawned, run.killed + alive2.length);   // 小怪沒倒下就不見了 → 補回來
      if (pc && pc.dead) leave('<span class="text-red-400">你在試煉裡倒下了，這次失敗。</span>');
      else if (api.now() > run.until) leave('<span class="text-red-400">時間到，試煉失敗。</span>');
    } catch (e) {}
  });

  // ═══════════════════════════ 八、掉落 ═══════════════════════════
  // 四龍副本的地圖 → 屬性
  var DRAGON_ELE = function (mp) { if (!mp) return null; if (/^antharas_/.test(mp)) return 'earth'; if (/^cr_fafurion_/.test(mp)) return 'water'; if (/^cr_valakas_/.test(mp)) return 'fire'; if (/^cr_lindvior_/.test(mp)) return 'wind'; return null; };
  var DROP = { tear: 0.55, dimBoss: 3, dimMob: 0.10, shardBoss: 0.05, shardFinal: [1, 2], oathFinal: [2, 4], oathMob: 0.005 };
  var mats = function () { return W.__afkGuardMats || null; };   // afk-guardmats 已經負責四龍眼淚（11-05 先上線）→ 這裡不再重複處理
  var removed = function () { var o = {}; if (!mats()) ELES.forEach(function (e) { o[M.tear[e]] = 1; }); KEYS.forEach(function (k) { if (TOKENS[k].base) o[TOKENS[k].base] = 1; }); return o; };
  var prevDF = W.__afkDropListFilter;
  W.__afkDropListFilter = function (mob, list) {
    if (typeof prevDF === 'function') list = prevDF(mob, list) || list;
    try { if (!list || !list.length) return list; var R = removed(); if (!list.some(function (x) { return x && R[x[0]]; })) return list; return list.filter(function (x) { return !(x && R[x[0]]); }); } catch (e) { return list; }
  };
  // 古物學者的常駐委託不抽這些（劇情委託的排序清單不動）
  var prevSkip = W.__afkBountySkip;
  W.__afkBountySkip = function (id) { try { if (typeof prevSkip === 'function' && prevSkip(id)) return true; } catch (e) {} return !!removed()[id]; };
  W.addEventListener('load', function () { try { regLines(); } catch (e) {} });
  var randIn = function (a) { return a[0] + Math.floor(rnd() * (a[1] - a[0] + 1)) % (a[1] - a[0] + 1); };
  var give = function (id, n, m) { if (!(n > 0)) return; gainItem(id, n, true, true); sys('<span class="text-amber-200">' + esc(m.n) + ' 留下了 ' + esc((DB.items[id] || {}).n || id) + ' ×' + n + '。</span>'); };
  if (X) X.on('kill', function (m) {
    var p = P(); if (!p || !slotOn(p) || !m || m._gdDrop || m._train || m.siegeEnemy) return; m._gdDrop = true;
    var ele = DRAGON_ELE(mapState.current);
    try {
      if (!mats() && ele && dreamOn(p) && !m.boss && rnd() < DROP.tear) give(M.tear[ele], 1, m);   // 四龍眼淚：四龍副本的小怪（夢域鏡）
      if (riftOn()) {
        if (m.boss) give(M.dim, DROP.dimBoss, m); else if (rnd() < DROP.dimMob) give(M.dim, 1, m);   // 次元結晶：比照夢艷結晶
        if (ele) {
          var final = !!m._afkDragonStage;
          if (final) { give(M.shard, randIn(DROP.shardFinal), m); give(M.oath[ele], randIn(DROP.oathFinal), m); }
          else if (m.boss) { if (rnd() < DROP.shardBoss) give(M.shard, 1, m); }
          else if (rnd() < DROP.oathMob) give(M.oath[ele], 1, m);
        }
      }
    } catch (e) { console.warn('[AFK-guardring] drop', e); }
  });

  // ═══════════════════════════ 九、介面 ═══════════════════════════
  var estiName = function () { try { var n = (DB.towns.town_heine.npcs || []).filter(function (x) { return x.id === 'npc_esti'; })[0]; return (n && n.n) || '伊席蘿蒂'; } catch (e) { return '伊席蘿蒂'; } };
  var CSS = '.afk-gd{color:#e7e5e4;font-size:13px;line-height:1.55}'
    + '.afk-gd .gd-hd{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #6b5a3a;border-radius:10px;background:linear-gradient(135deg,rgba(120,90,30,.35),rgba(24,22,30,.9) 60%)}'
    + '.afk-gd .gd-hd b{font-size:16px;color:#f5d28a;letter-spacing:1px}.afk-gd .gd-hd small{display:block;color:#a8a29e;font-size:12px}'
    + '.afk-gd .gd-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-top:8px}'
    + '.afk-gd .gd-k{position:relative;display:flex;flex-direction:column;align-items:center;padding:6px 2px;border:1px solid #3f3a46;border-radius:8px;background:rgba(24,22,30,.85);cursor:pointer;color:inherit;font:inherit;min-width:0}'
    + '.afk-gd .gd-k img{width:56px;height:56px;object-fit:contain}.afk-gd .gd-k span{font-size:11px;white-space:nowrap}.afk-gd .gd-k i{font-style:normal;font-size:10px;color:#fde68a}'
    + '.afk-gd .gd-k.sel{border-color:#f5d28a;box-shadow:0 0 0 1px #f5d28a inset}.afk-gd .gd-k.main{background:rgba(68,52,24,.6)}.afk-gd .gd-k u{position:absolute;top:2px;right:4px;text-decoration:none;font-size:10px}'
    + '.afk-gd .gd-card{margin-top:8px;padding:10px;border:1px solid #6b5a3a;border-radius:10px;background:rgba(20,18,26,.92)}'
    + '.afk-gd .gd-sec{margin-top:10px;font-weight:bold;color:#e7d2a7}'
    + '.afk-gd ul{margin:4px 0 0 18px;list-style:disc}.afk-gd .muted{color:#a8a29e;font-size:12px}'
    + '.afk-gd .need{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.afk-gd .need span{padding:1px 7px;border-radius:99px;font-size:11px;background:rgba(127,29,29,.45);color:#fecaca}.afk-gd .need span.ok{background:rgba(20,83,45,.5);color:#bbf7d0}'
    + '.afk-gd .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center}'
    + '.afk-gd button.gb{padding:6px 12px!important;border-radius:8px!important;font-weight:bold;font-size:13px;border:1px solid #fcd34d!important;background:linear-gradient(#b45309,#78350f)!important;color:#fffbeb!important;cursor:pointer;opacity:1!important}'
    + '.afk-gd button.gb[disabled]{border-color:#3f3a46!important;background:#1c1a22!important;color:#57534e!important;cursor:not-allowed}'
    + '.afk-gd .why{color:#fca5a5;font-size:12px}'
    + '#afk-gd-ov{position:fixed;inset:0;z-index:10040;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;padding:12px}'
    + '#afk-gd-ov .afk-gd{width:min(720px,100%);max-height:min(92vh,100%);overflow-y:auto;background:#17151d;border:1px solid #8b6d3a;border-radius:14px;padding:12px}'
    + '#afk-gd-moon{position:absolute;left:8px;bottom:8px;z-index:6;font-size:22px;line-height:1;filter:drop-shadow(0 0 6px #fef3c7);pointer-events:auto;cursor:default}'
    + '@media (max-width:480px){.afk-gd .gd-k img{width:44px;height:44px}}';
  var css = function () { if (document.getElementById('afk-gd-css')) return; var st = document.createElement('style'); st.id = 'afk-gd-css'; st.textContent = CSS; document.head.appendChild(st); };
  var ui = { sel: null };
  var stars = function (s) { var h = s >= 4 ? 3 : s, f = s >= 4 ? s - 3 : 0, o = ''; for (var i = 1; i <= 3; i++) o += i <= f ? '★' : (i <= h ? '☆' : '·'); return o; };
  var html = function (p, mode) {
    var g = store(p), E = compute(p), mk = marks(p), main = mainOf(p);
    var sel = ui.sel && KN[ui.sel] ? ui.sel : (main || 'moon'); ui.sel = sel;
    var npc = mode === 'npc';
    var hdImg = E.shelter ? ART.finalBig : main ? KN[main].big : ART.stone;
    var h = '<div class="gd-hd"><img src="' + esc(hdImg) + '" style="width:64px;height:64px;object-fit:contain"><div><b>守護者之誓</b><small>'
      + (main ? '主誓約：' + esc(KN[main].n) + '（' + stageN(stageOf(p, main)) + '）' : '還沒有配戴守護者之戒') + (E.shelter ? '　<span class="c-legend">庇護者之戒</span>' : '') + (E.legacy ? '　<span style="color:#fcd34d">守護傳承</span>' : '') + '</small></div></div>';
    h += '<div class="gd-row">' + KEYS.map(function (k) {
      var s = stageOf(p, k), m = markOf(s);
      return '<button type="button" class="gd-k' + (k === sel ? ' sel' : '') + (k === main ? ' main' : '') + '" data-gd="sel:' + k + '"><img src="' + esc(KN[k].ring) + '"' + (s ? '' : ' style="filter:grayscale(1);opacity:.45"') + '>'
        + '<span style="color:' + KN[k].c + '">' + KN[k].short + '</span><i>' + stars(s) + '</i>' + (m ? '<u style="color:' + (m === 'gold' ? '#fcd34d' : '#e5e7eb') + '">' + (m === 'gold' ? '金' : '銀') + '</u>' : '') + '</button>';
    }).join('') + '</div>';
    var s = stageOf(p, sel), q = qOf(p, sel), Q = QUESTS[sel];
    h += '<div class="gd-card"><div style="font-size:15px;font-weight:bold;color:' + KN[sel].c + '">' + esc(KN[sel].n) + '　<span class="muted">' + stageN(s) + '</span></div>';
    var cv = valOf(sel, s || 1, { face: g.zeus }), nv = s < 6 ? valOf(sel, s + 1, { face: g.zeus }) : null;
    h += '<div class="gd-sec">' + (s ? '目前' : '上半部 ★1') + '</div><ul>' + txtOf(sel, cv).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (s && nv) h += '<div class="gd-sec">下一星（' + stageN(s + 1) + '）</div><ul>' + txtOf(sel, nv).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    h += '<div class="muted" style="margin-top:4px">每一枚另有共通效果：異常狀態抵抗 +' + COMMON.abn[Math.max(0, (s || 1) - 1)] + '%、異常狀態持續時間 −' + COMMON.dur[Math.max(0, (s || 1) - 1)] + '%、寵物與召喚物傷害／命中 +' + COMMON.pet[Math.max(0, (s || 1) - 1)] + '、負重 +' + fmt(COMMON.weight[Math.max(0, (s || 1) - 1)]) + '、最大 HP +' + fmt(COMMON.mhp[Math.max(0, (s || 1) - 1)]) + '（只算配戴中的那一枚）</div>';
    // 劇情
    if (!questDone(p, sel)) {
      var qs = q.s === 0 ? '還沒開始：到' + esc((DB.towns[KN[sel].town] || {}).n || '') + '找' + esc(Q.n) + '。' : '進行中：打倒' + esc(Q.mob.join('、')) + ' ' + q.n + '／' + Q.need + '，再回去找' + esc(Q.n) + '。';
      h += '<div class="gd-sec">劇情</div><div>' + qs + '</div>';
    }
    // 下一星材料
    if (s < 6) {
      var need = needOf(sel, s);
      h += '<div class="gd-sec">升到' + stageN(s + 1) + '要的材料</div><div class="need">' + need.map(function (x) {
        var hv = needHave(x), wh = x.kind ? 0 : haveWh(x.id);
        return '<span class="' + (hv >= x.n ? 'ok' : '') + '">' + esc(needLabel(x)) + (x.kind === 'dia' ? '' : ' ' + fmt(hv) + '／' + fmt(x.n) + (wh ? '（倉庫 ' + fmt(wh) + '）' : '')) + '</span>';
      }).join('') + '</div>';
    }
    if (npc) {
      var why = canUp(p, sel), we = canWear(p, sel);
      h += '<div class="acts"><button class="gb" data-gd="up:' + sel + '"' + (why ? ' disabled' : '') + '>升級</button>'
        + (stageOf(p, sel) > 0 && main !== sel ? '<button class="gb" data-gd="wear:' + sel + '"' + (we ? ' disabled' : '') + '>配戴' + (main ? '（金幣 ' + fmt(COST.change) + '）' : '') + '</button>' : '')
        + ['dream', 'rift'].map(function (md) { var w = canEnter(sel, md); return '<button class="gb" data-gd="enter:' + sel + ':' + md + '"' + (w ? ' disabled title="' + esc(w) + '"' : '') + '>進入試煉' + (md === 'rift' ? '（次元裂縫）' : '') + '（' + Math.max(0, DG.daily[md] - usedOf(p, sel, md)) + '／' + DG.daily[md] + '）</button>'; }).join('')
        + '</div>' + (why && stageOf(p, sel) < 6 ? '<div class="why">' + esc(why) + '</div>' : '') + (we && stageOf(p, sel) > 0 && main !== sel ? '<div class="why">' + esc(we) + '</div>' : '');
    }
    h += '</div>';
    // 下方：宙斯、共鳴、庇護者
    h += '<div class="gd-card">';
    if (stageOf(p, 'magic') > 0) h += '<div>宙斯的戒指：<b style="color:#fde68a">' + (g.zeus === 'dark' ? '黑暗之星' : '幸運之子') + '</b>' + (npc ? '　<button class="gb" data-gd="face:' + (g.zeus === 'dark' ? 'light' : 'dark') + '"' + (inTown() ? '' : ' disabled') + '>切換成' + (g.zeus === 'dark' ? '幸運之子' : '黑暗之星') + '</button>' : '') + '</div>';
    h += '<div style="margin-top:6px">騎士之印：金 ' + mk.gold + '、銀 ' + (mk.n - mk.gold) + '</div><ul>' + [2, 3, 4, 5].map(function (n) {
      var on = mk.n >= n, gold = mk.gold >= n, R = RESO[n][gold ? 'gold' : 'silver'];
      var t = R.abn ? '異常狀態抵抗 +' + R.abn + '%' : R.dur ? '異常狀態持續時間 −' + R.dur + '%' : R.pet ? '寵物與召喚物傷害／命中 +' + R.pet + '、負重 +' + fmt(R.weight)
        : (gold ? '王的五騎士' : '五騎士的守護') + '：HP 第一次低於 ' + GUARD.hpPct + '% 時解除身上所有異常狀態，' + GUARD.dur + ' 秒內受到的傷害 −' + R.guard + '%（冷卻 ' + R.cd + ' 秒）' + (R.mercs ? '；傭兵也各有一次' : '');
      return '<li style="' + (on ? '' : 'color:#78716c') + '">' + n + ' 印：' + esc(t) + '</li>';
    }).join('') + '</ul>';
    var gn = KEYS.filter(function (k) { return stageOf(p, k) >= 6; }).length;
    h += '<div style="margin-top:6px">庇護者之戒：金印 ' + gn + '／5' + (E.shelter ? '（已達成）' : '') + '</div><div class="muted">五枚都是金印時，主誓約的完整 ★3 之外，再得到其他四名騎士上半部 ★3 的專屬效果（月光的歐文形態除外）；在次元裂縫裡，五種屬性抗性被侵蝕時最多扣到 500。</div>';
    h += '<div class="muted" style="margin-top:4px">' + (W.__afkFullMoon && W.__afkFullMoon.on() ? '🌕 現在是滿月（還有 ' + Math.ceil(moonLeft() / 60000) + ' 分鐘）' : '🌙 離下一次滿月還有 ' + Math.ceil(moonLeft() / 60000) + ' 分鐘') + '</div>';
    if (!npc) h += '<div class="muted" style="margin-top:4px">升級、配戴要到海音找' + esc(estiName()) + '。</div>';
    h += '</div>';
    return h;
  };
  var bind = function (box, mode, rerender) {
    box.querySelectorAll('[data-gd]').forEach(function (b) {
      b.onclick = function (ev) {
        ev.stopPropagation();
        var a = b.getAttribute('data-gd').split(':');
        if (a[0] === 'sel') ui.sel = a[1];
        else if (mode === 'npc' && a[0] === 'up') upgrade(a[1]);
        else if (mode === 'npc' && a[0] === 'wear') wear(a[1]);
        else if (mode === 'npc' && a[0] === 'face') setFace(a[1]);
        else if (mode === 'npc' && a[0] === 'enter') { enter(a[1], a[2]); return; }
        else if (a[0] === 'q') { questStep(a[1]); }
        else if (a[0] === 'close') { closeView(); return; }
        rerender();
      };
    });
  };
  var renderInto = function (box, mode) {
    var p = P(); if (!p || !box) return;
    css();
    if (!sysOn(p)) { box.innerHTML = '<div class="afk-gd"><div class="muted">轉生後才能使用守護者之戒。</div></div>'; return; }
    box.innerHTML = '<div class="afk-gd">' + html(p, mode) + (mode === 'view' ? '<div class="acts"><button class="gb" data-gd="close">關閉</button></div>' : '') + '</div>';
    bind(box, mode, function () { renderInto(box, mode); });
  };
  // 唯讀檢視（角色資訊、裝備格）
  var closeView = function () { var o = document.getElementById('afk-gd-ov'); if (o) o.remove(); };
  var openView = function () {
    var p = P(); if (!slotOn(p)) return;
    closeView();
    var ov = document.createElement('div'); ov.id = 'afk-gd-ov';
    ov.addEventListener('click', function (e) { if (e.target === ov) closeView(); });
    document.body.appendChild(ov); renderInto(ov, 'view');
  };
  W.__afkGuardSlotClick = function () { openView(); };
  // 條列式裝備分頁點戒指：開面板（不開物品視窗）；戒指不能卸下
  var isRing = function (it) { return !!(it && typeof it.id === 'string' && it.id.indexOf('afk_guard_ring_') === 0); };
  if (typeof W.openModal === 'function') {
    var oModal = W.openModal;
    W.openModal = function (item) { if (isRing(item) && slotOn(P())) { openView(); return; } return oModal.apply(this, arguments); };
    try { (0, eval)('openModal = window.openModal'); } catch (e) {}
  }
  if (typeof W.unequipItem === 'function') {
    var oUneq = W.unequipItem;
    W.unequipItem = function (slot) { if (slot === 'guard') return; return oUneq.apply(this, arguments); };
    try { (0, eval)('unequipItem = window.unequipItem'); } catch (e) {}
  }
  // 劇情對話（佔位）
  var questHtml = function (k) {
    var p = P(), q = qOf(p, k), Q = QUESTS[k], why = q.s === 0 ? questWhy(p, k) : null;
    var line = q.s === 0 ? Q.talk[0] + Q.talk[1] : q.s === 1 ? (q.n >= Q.need ? Q.talk[2] : Q.talk[1]) : Q.talk[2];
    var h = '<div class="gd-card" id="afk-gd-q-' + k + '"><div class="gd-sec" style="margin-top:0">' + esc(Q.t) + ' ' + esc(Q.n) + '</div><div style="color:#e7d2a7">' + esc(line) + '</div>';
    if (q.s === 0) h += '<div class="acts"><button class="gb" data-gd="q:' + k + '"' + (why ? ' disabled' : '') + '>答應' + esc(Q.n) + '</button></div>' + (why ? '<div class="why">' + esc(why) + '</div>' : '');
    else if (q.s === 1) h += '<div>打倒' + esc(Q.mob.join('、')) + '：' + q.n + '／' + Q.need + '</div><div class="acts"><button class="gb" data-gd="q:' + k + '"' + (q.n >= Q.need ? '' : ' disabled') + '>回報</button></div>';
    else h += '<div class="muted">副本已經開啟：到海音找' + esc(estiName()) + '進入試煉。</div>';
    return h + '</div>';
  };
  // 騎士 NPC（伊席蘿蒂用 npc_esti）
  if (K) KEYS.forEach(function (k) {
    var Q = QUESTS[k]; if (!Q.own) return;
    K.addNpc(KN[k].town, { id: Q.npc, n: Q.n, title: Q.t, type: 'quest', classicHide: true, d: Q.t + ' ' + Q.n + '。' }, null);
    K.hookNpc(Q.npc, Q.n, Q.t, function (div) {
      if (!div) return; css();
      var p = P();
      if (!sysOn(p)) { div.innerHTML = '<div class="afk-gd"><div class="muted">「……你還不是我要等的人。」</div></div>'; return; }
      var paint = function () { div.innerHTML = '<div class="afk-gd">' + questHtml(k) + '</div>'; bind(div, 'quest', paint); };
      paint();
    });
  });
  // 伊席蘿蒂（npc_esti）：海音的那一位多一個「守護者之誓」分頁；沒有血盟資格的轉生角色也看得到她（只有這個分頁）
  var origVis = typeof W.clanNpcVisible === 'function' ? W.clanNpcVisible : null;
  var extraEsti = function (npcId, townId) {
    var p = P(); if (npcId !== 'npc_esti' || townId !== 'town_heine' || !slotOn(p)) return false;
    try { return !(origVis && origVis.call(W, npcId, townId)); } catch (e) { return true; }
  };
  if (origVis) {
    W.clanNpcVisible = function (npcId, townId) { var r = origVis.apply(this, arguments); if (r) return r; try { if (extraEsti(npcId, townId)) return true; } catch (e) {} return r; };
    try { (0, eval)('clanNpcVisible = window.clanNpcVisible'); } catch (e) {}
  }
  if (typeof W.clanNpcDisplayName === 'function') {
    var oDN = W.clanNpcDisplayName;
    W.clanNpcDisplayName = function () { try { if (mapState.current === 'town_heine' && extraEsti('npc_esti', 'town_heine')) return estiName(); } catch (e) {} return oDN.apply(this, arguments); };
    try { (0, eval)('clanNpcDisplayName = window.clanNpcDisplayName'); } catch (e) {}
  }
  try { var NR = W.__afkNpcTabs && W.__afkNpcTabs.RULES; if (NR && !NR.some(function (r) { return r[1] === 'guardoath'; })) NR.push(['#afk-guard-oath', 'guardoath', '守護者之誓'], ['.afk-gd-qtab', 'gdquest', '守護者']); } catch (e) {}
  var QNPC = {}; KEYS.forEach(function (k) { if (!QUESTS[k].own) QNPC[QUESTS[k].npc] = k; });
  // 布魯迪卡發布影子騎士的守護者任務 → 所有職業都看得到他（玩家 2026-11-06）；黑暗妖精試煉仍只有黑妖能接（核心會對其他職業回「外人不得參與」）
  try { var ts = DB.towns && DB.towns.town_silent; (ts && ts.npcs || []).forEach(function (n) { if (n && n.id === 'npc_brudica') delete n.darkOnly; }); } catch (e) {}
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId, townId) {
      var extra = false; try { extra = extraEsti(npcId, townId || (mapState && mapState.current)); } catch (e) {}
      var r = oNpc.apply(this, arguments);
      try {
        if (npcId === 'npc_esti' && (townId || mapState.current) === 'town_heine' && slotOn(P())) {
          var div = document.getElementById('interaction-content'); if (!div) return r;
          if (extra) { div.innerHTML = ''; var nm = document.getElementById('interaction-npc-name'); if (nm) nm.innerText = estiName(); var tt = document.getElementById('interaction-npc-title'); if (tt) tt.innerText = '[天鵝騎士]'; }
          var box = div.querySelector('#afk-guard-oath'); if (!box) { box = document.createElement('div'); box.id = 'afk-guard-oath'; div.appendChild(box); }
          renderInto(box, 'npc');
        }
        var qk = QNPC[npcId];
        if (qk && sysOn(P()) && (!questDone(P(), qk) || qOf(P(), qk).s)) {   // 遊戲原本的 NPC：接一個「守護者」分頁
          var div2 = document.getElementById('interaction-content');
          if (div2) {
            var host = div2.querySelector('#afk-gd-qhost-' + qk); if (!host) { host = document.createElement('div'); host.id = 'afk-gd-qhost-' + qk; host.className = 'afk-gd afk-gd-qtab'; div2.appendChild(host); }
            css(); var paintQ = function () { host.innerHTML = questHtml(qk); bind(host, 'quest', paintQ); }; paintQ();
          }
        }
      } catch (e) { console.warn('[AFK-guardring] npc', e); }
      return r;
    };
    try { (0, eval)('interactNPC = window.interactNPC'); } catch (e) {}
  }
  // 能力分頁：「守護者之誓」查看鈕＋滿月月亮
  var paintInfo = function () {
    var p = P(), er = document.getElementById('dt-er'); if (!er) return;
    var row = document.getElementById('afk-gd-info-row');
    if (!row) {
      row = document.createElement('div'); row.id = 'afk-gd-info-row';
      row.innerHTML = '<span>守護者之誓</span><strong><button type="button" id="afk-gd-info" style="padding:0 8px;border:1px solid #a16207;border-radius:6px;background:#422006;color:#fde68a;font-size:12px">查看</button></strong>';
      var anchor = er.parentNode; if (!anchor || !anchor.parentNode) return;
      anchor.parentNode.appendChild(row);
      row.querySelector('#afk-gd-info').onclick = function () { openView(); };
    }
    var show = slotOn(p);
    if (row.style.display !== (show ? '' : 'none')) row.style.display = show ? '' : 'none';
  };
  var paintMoon = function () {
    var p = P(), bv = document.getElementById('battle-view'); if (!bv) return;
    var el = document.getElementById('afk-gd-moon'), show = !!(slotOn(p) && fullMoon());
    if (!show) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'afk-gd-moon'; el.textContent = '🌕'; if (getComputedStyle(bv).position === 'static') bv.style.position = 'relative'; bv.appendChild(el); css(); }
    var t = '滿月：還有 ' + Math.ceil(moonLeft() / 60000) + ' 分鐘'; if (el.title !== t) el.title = t;
  };
  if (typeof W._updateUIImpl === 'function') {
    var oU = W._updateUIImpl;
    W._updateUIImpl = function () { var r = oU.apply(this, arguments); try { paintInfo(); } catch (e) {} try { paintMoon(); } catch (e) {} return r; };
    try { (0, eval)('_updateUIImpl = window._updateUIImpl'); } catch (e) {}
  }
  setInterval(function () { try { if (!S().ff) paintMoon(); } catch (e) {} }, 5000);

  function growthRestore(q){
    if(!q){run=null;lastMap=mapState.current;return;}
    if(!KN[q.k]||!['dream','rift'].includes(q.mode)||q.done||!(q.until>api.now())||!Number.isInteger(q.wave)||q.wave<1||q.wave>DG.waves+1||mapState.current!==mapOf(q.k))throw Error('守護者試煉已逾時或進度不相容，請結束本輪');
    run=JSON.parse(JSON.stringify(q));store(P()).run=run;lastMap=mapOf(q.k);leaving=false;
  }
  var api = W.__afkGuardRing = {
    growthCheckpoint:function(){return run&&!run.done?JSON.parse(JSON.stringify(run)):null;},growthRestore:growthRestore,
    KEYS: KEYS, KN: KN, VAL: VAL, CD: CD, OWEN: OWEN, ZEUS: ZEUS, COMMON: COMMON, RESO: RESO, GUARD: GUARD, CAPS: CAPS, COST: COST, M: M, RIFT: RIFT, TOKENS: TOKENS, BOSS_LINES: BOSS_LINES, QUESTS: QUESTS, DG: DG, DGK: DGK, DROP: DROP,
    MOON: MOON, ART: ART, stepVal: stepVal, stepCd: stepCd, DREAM_SET: DREAM_SET, REFINE_PART: REFINE_PART,
    store: store, stageOf: stageOf, mainOf: mainOf, sysOn: sysOn, slotOn: slotOn, legacy: legacy, shelter: shelter, marks: marks, valOf: valOf, txtOf: txtOf, compute: compute, cur: cur, refresh: refresh,
    ensureSlot: ensureSlot, syncRing: syncRing, durCut: durCut, overDur: overDur, resFloor: resFloor, fullMoon: fullMoon, moonLeft: moonLeft,
    needOf: needOf, needHave: needHave, needLabel: needLabel, refineName: refineName, refineCount: refineCount, canUp: canUp, upgrade: upgrade, canWear: canWear, wear: wear, setFace: setFace,
    questDone: questDone, questStep: questStep, qOf: qOf, mapOf: mapOf, canEnter: canEnter, enter: enter, leave: leave, run: function () { return run; }, tokenId: tokenId, ringId: ringId, syncTokens: syncTokens,
    removed: removed, regLines: regLines, openView: openView, closeView: closeView, renderInto: renderInto, estiName: estiName, stageN: stageN,
    roll: function () { return Math.random(); }, now: function () { return Date.now(); }, testRift: false
  };
})();
