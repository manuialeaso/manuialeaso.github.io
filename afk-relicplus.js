/* ============================================================================
 * afk-relicplus.js — 遺物合成（武器／防具 +1～+15、飾品 +1～+5；燃柳村 NPC「哈瑪大師」，玩家 2026-10-20／21 指定）
 *
 * 合成規則
 *   ‧+1～+10：同款同強化值合成高一級。武器／防具 2 個：做出 +1～+6 每次 500 龍鑽＋5,000 萬，
 *     +7～+10 每高一級再多 100 龍鑽＋1,000 萬（+10＝900／9,000 萬）
 *   ‧原作者強化上限 +5 的道具（戒指、耳環、項鍊、腰帶…）：最高 +5；每級 3 個同級、龍鑽與金幣 ×3、席琳結晶 500 顆
 *   ‧+11～+15：只用一個，每次 50,000 龍鑽，成功率 10%，失敗不會消失；+15 顯示「可升級：材料未知」（進化另外規劃）
 *   ‧只看背包（不含倉庫、不含穿在身上的）；上鎖的不列入
 * 每一級的能力
 *   ‧武器：每 +1 大小傷 +1；每 +3 原本的白字能力各 +1
 *   ‧防具／飾品：每 +1 AC-1、MR+1；每 +3 ER+1；每 +5 傷害減免 +1
 *   ‧共通：每 +5 遺物特效 +5%（機率型；「一擊必殺」這類小數機率不加）；匕首／單手矛出血每秒比例同樣 +5%
 *          HP／MP 自然恢復每 +1 多 1（本身 ≥50 的多 10）
 *          主屬性強化（百變的透明內衣）每 +5 再 +1；火焰化解（火熱愛意）+5 每 5 秒、+10 完全免疫
 *   ‧+10 第二詞綴：隨機抽一件同部位的其他遺物，繼承它的特效（只加原本沒有的欄位）；抽到本身沒有特效的 → 四屬性抗性 +10
 *   ‧幸運暴走兔腳：兩邊耳環可以各戴一個，遺物掉落判定 ×2 → ×4
 *   ‧+10 以上：中毒必定觸發；匕首／單手矛出血每一下必中、最多 20 層，疊滿 20 層時持續 30 秒（核心補丁 17）
 *   ‧持續傷害上限（全遊戲）：中毒＋出血對同一隻怪，每秒最多扣牠最大 HP 的 1%（window.__afkDotCap）
 *
 * 做法（不改核心戰鬥程式）
 *   +N 遺物是一個「衍生物品」：id＝原遺物 id + "~r" + N（+10 以上再加 "~" + 特效來源 id），
 *   在 DB.items 以「不可列舉」的屬性註冊——所有 DB.items[id] 查詢都拿得到（戰鬥、能力、tooltip 全部照常運作），
 *   但遍歷 DB.items 的地方（黑市、收購、遺物布告欄、圖鑑索引…）看不到它，不會被抽進任何池子。
 *   武器標籤（匕首／矛…）也照原遺物註冊，出血、圖鑑分類跟原遺物一樣。
 *   註冊時機：啟動時（記錄＋掃描所有存檔／倉庫）、讀檔與招募傭兵之前、每次合成成功當下。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('relicplus')) return;
  if (typeof DB === 'undefined' || !DB.items || typeof isRelic !== 'function') { try { console.warn('[AFK-relicplus] 找不到物品資料，未啟用'); } catch (e) {} return; }

  var MAX = 15;
  var REG_KEY = 'afk_relicplus_ids';
  var ID_RE = /relic_[a-z0-9_]+~r\d{1,2}(?:~relic_[a-z0-9_]+)?(?:~a\d)?(?:~e\d)?/g;
  var WHITE = ['hit', 'dmgBonus', 'bowHit', 'bowDmg', 'magicHit', 'mdmg', 'extraDmg', 'str', 'dex', 'con', 'int', 'wis', 'cha', 'mr', 'dr', 'extraMp'];   // 武器每 +3 各 +1（HP/MP 恢復另有規則）
  var RATE_TOP = /^(comboRate|pierceChance|procRateBase|dblStrikeRate|missGrazeRate|heavyRatePct|windSpellProcRate|procFireSkillRate|procPoisonRate)$/;
  // +10 繼承特效時「不算特效」的欄位（基本數值、武器型態、說明文字…）
  var NOT_FX = new Set(['n', 'type', 'slot', 'relic', 'noEnhance', 'dmgS', 'dmgL', 'hit', 'dmgBonus', 'req', 'p', 'gachaWeight', 'd', 'c', 'img',
    'isBow', 'ranged', 'rapidfire', 'rapidMax', 'isWand', 'qigu', 'chainsword', 'oneHand', 'w2h', 'isArrow', 'noConsume', 'eff', 'comboRate', 'ele',
    'extraMp', 'str', 'dex', 'con', 'int', 'wis', 'cha', 'mr', 'mdmg', 'mpR', 'hpR', 'mhp', 'mmp', 'dr', 'magicHit', 'relicRole', 'h', 'classicOk',
    'maxLv', 'noBleed', 'tag', 'bowHit', 'bowDmg', 'extraDmg', 'relicBase', 'relicPlus', 'relicFx', 'relicBleedBonus', 'safe', 'maxEn',
    'ac', 'er', 'resFire', 'resWater', 'resWind', 'resEarth', 'weight', 'fireNullifyTicks', 'armguard', 'cls']);
  var RES4 = ['resFire', 'resWater', 'resWind', 'resEarth'];
  var hasEffect = function (b) { return Object.keys(b).some(function (f) { return !NOT_FX.has(f); }); };
  var KIND_OK = function (d) { return !!(d && isRelic(d) && !d.isArrow && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') && ['pet', 'petwpn', 'petarm', 'doll'].indexOf(d.slot) < 0); };
  // 戒指／耳環／項鍊／腰帶等強化上限 +5 的飾品：最高 +5，沒有 +10 繼承特效
  //   判斷依原作者的強化上限（enhanceCap）：上限 +5 的道具都算這一類
  var maxOf = function (base) { var d = DB.items[base]; if (!d) return 15; var cap = 15; try { cap = enhanceCap(d); } catch (e) { cap = d.type === 'acc' ? 5 : 15; } return cap <= 5 ? 5 : 15; };

  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var parseId = function (id) {
    var m = /^(relic_[a-z0-9_]+)~r(\d{1,2})(?:~(relic_[a-z0-9_]+))?(?:~a(\d))?(?:~e(\d))?$/.exec(String(id || ''));
    if (!m) return null;
    return { base: m[1], n: Math.min(MAX, parseInt(m[2], 10)), fx: m[3] || null, asc: m[4] != null ? Math.min(5, parseInt(m[4], 10)) : null, evo: m[5] != null ? parseInt(m[5], 10) : null };
  };
  var baseOf = function (id) { var p = parseId(id); return p ? p.base : id; };
  var levelOf = function (id) { var p = parseId(id); return p ? p.n : 0; };
  var fxOf = function (id) { var p = parseId(id); return p ? p.fx : null; };
  var ascOf = function (id) { var p = parseId(id); return p ? p.asc : null; };
  var evoOf = function (id) { var p = parseId(id); return p ? p.evo : null; };
  var makeId = function (base, n, fx, asc, evo) { return n <= 0 ? base : base + '~r' + n + (fx ? '~' + fx : '') + (asc != null ? '~a' + asc : '') + (evo != null && asc === 5 ? '~e' + evo : ''); };
  // 至高的支配（昇華支配 +5 進化）：8 種特效，9＝司祭苦行套裝（全部 8 種）
  var EVO = [null, '克特套裝', '死亡騎士套裝', '惡魔套裝', '四大軍王套裝', '真．冥皇套裝', '全能力 +30', '面板能力 +50', '四屬性抗性 +100', '全部八種特效'];
  var catOf = function (id) { try { return equipCatKey(id, DB.items[id]); } catch (e) { return null; } };

  // ── 衍生物品定義 ──
  function buildDef(base, n, fx, asc, evo) {
    var b = DB.items[base];
    var d = clone(b);
    d.relicBase = base; d.relicPlus = n; d.relicFx = fx || null; d.relicAsc = (asc != null) ? asc : null; d.relicEvo = (evo != null && asc === 5) ? evo : null;
    d.gachaWeight = 0;
    try { d.img = getIconUrl(b); } catch (e) {}
    var r = Math.floor(n / 5) * 5, k3 = Math.floor(n / 3), k5 = Math.floor(n / 5);
    if (b.type === 'wpn') {
      // 武器：每 +1 大小傷 +1；每 +3 白字各 +1
      d.dmgS = (Number(b.dmgS) || 0) + n;
      d.dmgL = (Number(b.dmgL) || 0) + n;
      if (k3) WHITE.forEach(function (f) { if (typeof b[f] === 'number' && b[f] !== 0) d[f] = b[f] + k3; });
    } else {
      // 防具／飾品：每 +1 AC-1、MR+1；每 +3 ER+1；每 +5 傷害減免+1
      d.ac = (Number(b.ac) || 0) - n;
      d.mr = (Number(b.mr) || 0) + n;
      if (k3) d.er = (Number(b.er) || 0) + k3;
      if (k5) d.dr = (Number(b.dr) || 0) + k5;
    }
    // HP／MP 自然恢復：每 +1 多 +1；本身 ≥50 的每 +1 多 +10
    ['hpR', 'mpR'].forEach(function (f) { if (typeof b[f] === 'number' && b[f] > 0) d[f] = b[f] + n * (b[f] >= 50 ? 10 : 1); });
    if (k5) {
      {
        // 每 +5：遺物特效 +5%（沒有特效的遺物這一步沒有東西可加）
        Object.keys(b).forEach(function (f) {
          var v = b[f];
          if (typeof v === 'number' && RATE_TOP.test(f)) d[f] = Math.min(100, v + r);
          else if (v && typeof v === 'object' && !Array.isArray(v) && /^proc/.test(f)) {
            if (typeof v.rate === 'number') d[f].rate = Math.min(100, v.rate + r);
            else if (typeof v.pct === 'number') d[f].pct = Math.min(100, v.pct + r);
          }
        });
        // 特殊效果：每 +5 強化一級
        if (b.highestAttrPlus) d.highestAttrPlus = 1 + k5;                 // 主屬性 +1 → +2 → +3 → +4
        if (b.fireNullify) d.fireNullifyTicks = n >= 10 ? 1 : 50;          // 火焰化解每 10 秒 → +5 每 5 秒 → +10 完全免疫
      }
      try { if (b.type === 'wpn' && typeof weaponHasBleed === 'function' && weaponHasBleed(base)) d.relicBleedBonus = r; } catch (e) {}
    }
    var fxName = '';
    if (fx && DB.items[fx]) {
      // +10 第二詞綴：繼承抽到的遺物特效；抽到「本身沒有特效」的遺物 → 改給四屬性抗性 +10
      var donor = DB.items[fx];
      var copied = 0;
      if (hasEffect(donor)) Object.keys(donor).forEach(function (f) { if (!NOT_FX.has(f) && !(f in b)) { d[f] = clone(donor[f]); copied++; } });
      // 抽到沒有特效的遺物，或抽到的特效跟本身完全重複（例如兩把都只有出血）→ 改給四屬性抗性 +10，避免「繼承了卻什麼都沒有」
      if (!copied) { RES4.forEach(function (f) { d[f] = (Number(d[f]) || 0) + 10; }); d.relicFxRes = true; }
      fxName = donor.n;
    }
    // +10 以上：中毒必定觸發（出血必中與 20 層由核心補丁 17 依 relicPlus 判斷）
    if (n >= 10) {
      Object.keys(d).forEach(function (f) { var v = d[f]; if (v && typeof v === 'object' && /^procPoison$/.test(f) && typeof v.rate === 'number') v.rate = 100; });
      if (typeof d.procPoisonRate === 'number') d.procPoisonRate = 100;
    }
    // 昇華支配：每 +1（玩家 2026-10-21 規格）
    if (asc != null && asc > 0) {
      var A = asc;
      if (b.type === 'wpn') {
        d.dmgS += 10 * A; d.dmgL += 10 * A;
        WHITE.forEach(function (f) { if (typeof b[f] === 'number' && b[f] !== 0) d[f] = (Number(d[f]) || 0) + 5 * A; });
      } else {
        if (b.type === 'arm') { d.hpR = (Number(d.hpR) || 0) + 50 * A; d.mpR = (Number(d.mpR) || 0) + 50 * A; }
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (f) { d[f] = (Number(d[f]) || 0) + A; });
        d.er = (Number(d.er) || 0) + A; d.ac = (Number(d.ac) || 0) - A; d.mr = (Number(d.mr) || 0) + A; d.dr = (Number(d.dr) || 0) + A;
        RES4.forEach(function (f) { d[f] = (Number(d[f]) || 0) + 10 * A; });
      }
    }
    d.d = (b.d || '') + ' 〔遺物合成 +' + n + '〕' + (asc != null ? '〔昇華支配 +' + asc + '〕' : '') + (fxName ? (d.relicFxRes ? '〔第二詞綴：抽到「' + fxName + '」（無特效）→ 四屬性抗性 +10〕' : '〔第二詞綴：繼承「' + fxName + '」的特效〕') : '') + (asc != null && asc >= 5 ? (d.relicEvo != null ? '〔至高的支配：' + EVO[d.relicEvo] + '〕' : '〔可進化：至高的支配〕') : '');
    return d;
  }
  function ensure(id) {
    if (DB.items[id]) return true;
    var p = parseId(id);
    if (!p || !KIND_OK(DB.items[p.base]) || p.n > maxOf(p.base)) return false;
    if (p.asc != null && p.n !== maxOf(p.base)) return false;
    if (p.evo != null && (p.asc !== 5 || p.evo < 1 || p.evo > 9)) return false;
    if (p.fx && !DB.items[p.fx]) p.fx = null;
    var def = buildDef(p.base, p.n, p.fx, p.asc, p.evo);
    Object.defineProperty(DB.items, id, { value: def, writable: true, configurable: true, enumerable: false });
    try {
      if (typeof WEAPON_TAGS !== 'undefined' && WEAPON_TAGS[p.base] && !WEAPON_TAGS[id])
        Object.defineProperty(WEAPON_TAGS, id, { value: WEAPON_TAGS[p.base], writable: true, configurable: true, enumerable: false });
    } catch (e) {}
    return true;
  }
  var registry = function () { try { var a = JSON.parse(localStorage.getItem(REG_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  var remember = function (id) {
    var a = registry(); if (a.indexOf(id) >= 0) return;
    a.push(id); try { localStorage.setItem(REG_KEY, JSON.stringify(a.slice(-2000))); } catch (e) {}
  };
  var scanText = function (s) { if (!s || s.indexOf('~r') < 0) return; var m = String(s).match(ID_RE); if (m) m.forEach(function (id) { if (ensure(id)) remember(id); }); };
  var scanKey = function (key) {
    try { scanText(localStorage.getItem(key)); } catch (e) {}
    try { var raw = (typeof _lzGet === 'function') ? _lzGet(key) : null; if (raw) { var u = _saveUnwrap(raw); scanText(u && u.ok !== false && u.payload ? u.payload : raw); } } catch (e) {}
  };
  var scanAll = function () {
    registry().forEach(ensure);
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/lineage|wh|warehouse/i.test(k)) scanKey(k); } } catch (e) {}
  };
  scanAll();
  // 讀檔／招募傭兵／載入倉庫之前再補一次（匯入其他電腦的存檔時用得到）
  ['loadGame', 'toggleAlly'].forEach(function (fn) {
    var o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () { try { scanAll(); } catch (e) {} return o.apply(this, arguments); };
  });
  if (typeof window.loadWarehouse === 'function') {
    var oWh = window.loadWarehouse;
    window.loadWarehouse = function () { var w = oWh.apply(this, arguments); try { (w && w.items || []).forEach(function (it) { if (it && it.id && it.id.indexOf('~r') > 0) ensure(it.id); }); } catch (e) {} return w; };
  }
  // 名稱前加 +N
  if (typeof window.getItemFullName === 'function') {
    var oName = window.getItemFullName;
    window.getItemFullName = function (item) {
      var s = oName.apply(this, arguments);
      try {
        var d = item && DB.items[item.id];
        if (d && d.relicPlus) {
          var i = s.lastIndexOf('>' + d.n);
          if (i >= 0) {
            if (d.relicEvo != null) s = s.slice(0, i + 1) + d.n + '至高的支配【' + EVO[d.relicEvo] + '】' + s.slice(i + 1 + d.n.length);
            else if (d.relicAsc != null) s = s.slice(0, i + 1) + '+' + d.relicAsc + ' ' + d.n + '昇華支配' + s.slice(i + 1 + d.n.length);   // +15 → 「+0 XXX昇華支配」…最高「+5 XXX昇華支配」
            else s = s.slice(0, i + 1) + '+' + d.relicPlus + ' ' + s.slice(i + 1);
          }
        }
      } catch (e) {}
      return s;
    };
  }

  // ── 成本 ──
  var CRYSTAL = 'sherine_crystal';
  function costOf(target, base) {   // 做出 +target 的成本
    var c;
    if (target <= 6) c = { dia: 500, gold: 50000000, merge: true, rate: 1 };
    else if (target <= 10) c = { dia: 500 + 100 * (target - 6), gold: 50000000 + 10000000 * (target - 6), merge: true, rate: 1 };
    else c = { dia: 50000, gold: 0, merge: false, rate: 0.10 };
    c.need = c.merge ? 2 : 1; c.crystal = 0;
    // 上限 +5 的飾品（戒指、耳環、項鍊、腰帶…）：每次要 3 個同款同強化值、龍鑽與金幣 ×3，另外消耗席琳結晶 500 顆
    //   例：+0→+1＝3 個 +0、1,500 龍鑽、1.5 億金幣、席琳結晶 500 顆
    if (base && maxOf(base) <= 5) { c.need = 3; c.dia *= 3; c.gold *= 3; c.crystal = 500; }
    return c;
  }
  var crystals = function () { var p = P(); return p ? (p.inv || []).reduce(function (s, i) { return s + (i && i.id === CRYSTAL && !i.lock ? Math.max(1, Math.floor(Number(i.cnt) || 1)) : 0); }, 0) : 0; };
  function takeCrystals(k) {   // 回傳還原函式；不夠回 null
    var p = P(); if (crystals() < k) return null;
    var snap = p.inv.slice(), cnts = p.inv.map(function (x) { return x && x.cnt; });
    for (var i = p.inv.length - 1; i >= 0 && k > 0; i--) {
      var it = p.inv[i]; if (!it || it.id !== CRYSTAL || it.lock) continue;
      var c = Math.max(1, Math.floor(Number(it.cnt) || 1)), use = Math.min(c, k);
      k -= use; if (c - use <= 0) p.inv.splice(i, 1); else it.cnt = c - use;
    }
    return function () { p.inv = snap; snap.forEach(function (x, j) { if (x) x.cnt = cnts[j]; }); };
  }
  function donorsFor(base) {
    var ck = catOf(base), b = DB.items[base];
    return Object.keys(DB.items).filter(function (id) {
      var d = DB.items[id];
      return id !== base && !!d && isRelic(d) && d.type === b.type && catOf(id) === ck;   // 同部位所有遺物都可能抽到（沒有特效的 → 四屬性抗性 +10）
    });
  }

  // ── 背包資料 ──
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var affixScore = function (it) { return (it.bless ? 1 : 0) + (it.anc ? 1 : 0) + (it.attr ? 1 : 0) + (it.attrMagic ? 1 + (Number(it.attrMagicStar) || 1) : 0); };
  function groups() {
    var p = P(); if (!p) return [];
    var map = {};
    (p.inv || []).forEach(function (it) {
      if (!it || it.lock || !it.id) return;
      var base = baseOf(it.id), d = DB.items[base];
      if (!KIND_OK(d)) return;
      var n = levelOf(it.id), asc = ascOf(it.id), evo = evoOf(it.id), key = base + '|' + n + '|' + (fxOf(it.id) || '') + '|' + (asc != null ? asc : '') + '|' + (evo != null ? evo : '');
      var g = map[key] || (map[key] = { key: key, base: base, n: n, fx: fxOf(it.id), asc: asc, evo: evo, cnt: 0, stacks: [] });
      g.cnt += Math.max(1, Math.floor(Number(it.cnt) || 1)); g.stacks.push(it);
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return ((b.asc != null ? b.asc + 1 : 0) - (a.asc != null ? a.asc + 1 : 0)) || (b.n - a.n) || ((DB.items[a.base].n || '') < (DB.items[b.base].n || '') ? -1 : 1); });
  }
  var diamonds = function () { try { return Math.max(0, Math.floor(Number(window.pandoraGetSharedDiamonds()) || 0)); } catch (e) { return 0; } };
  var gold = function () { var p = P(); return p ? Math.max(0, Math.floor(Number(p.gold) || 0)) : 0; };

  // 從某組拿走 k 件，回傳拿到的件（附詞綴）與還原函式
  function take(g, k) {
    var p = P(), got = [], snap = p.inv.slice(), cnts = p.inv.map(function (x) { return x && x.cnt; });
    var stacks = g.stacks.slice().sort(function (a, b) { return affixScore(b) - affixScore(a); });
    for (var i = 0; i < stacks.length && got.length < k; i++) {
      var it = stacks[i];
      while (got.length < k && Math.max(1, Math.floor(Number(it.cnt) || 1)) > 0 && p.inv.indexOf(it) >= 0) {
        got.push({ bless: it.bless || false, anc: it.anc || false, attr: it.attr || false, attrMagic: it.attrMagic || null, attrMagicStar: it.attrMagicStar || null });
        var c = Math.max(1, Math.floor(Number(it.cnt) || 1)) - 1;
        if (c <= 0) { p.inv.splice(p.inv.indexOf(it), 1); break; } else it.cnt = c;
      }
    }
    return { got: got, restore: function () { p.inv = snap; snap.forEach(function (x, i) { if (x) x.cnt = cnts[i]; }); } };
  }
  function pushResult(id, aff) {
    var p = P();
    p.inv.push({ id: id, uid: (typeof uid === 'function' ? uid() : String(Math.random()).slice(2)), cnt: 1, en: 0,
      bless: aff.bless || false, anc: aff.anc || false, attr: aff.attr || false, seteff: false, lock: false, junk: false });
    if (aff.attrMagic) { var last = p.inv[p.inv.length - 1]; last.attrMagic = aff.attrMagic; last.attrMagicStar = aff.attrMagicStar || 1; }   // 屬性魔法與星數一起繼承
  }
  var saveOk = function () { try { return typeof saveGame === 'function' && saveGame() === true; } catch (e) { return false; } };
  var adjustDia = function (delta) { try { var r = window.pandoraAdjustSharedDiamonds(delta) || {}; return r.ok ? { ok: true } : { ok: false, error: r.error || '龍之鑽石不足。' }; } catch (e) { return { ok: false, error: '龍之鑽石系統未就緒。' }; } };

  // 執行一次合成／強化；回傳 { ok, success, msg }
  function upgrade(key) {
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    if (typeof state !== 'undefined' && state && state.ff) return { ok: false, msg: '補跑中，請稍候再試。' };
    var g = groups().filter(function (x) { return x.key === key; })[0];
    if (!g) return { ok: false, msg: '找不到這個遺物，可能已經被移動。' };
    var mx = maxOf(g.base);
    if (g.n >= mx) return { ok: false, msg: '已經是 +' + mx + '（最高）。' };
    var target = g.n + 1, c = costOf(target, g.base);
    if (g.cnt < c.need) return { ok: false, msg: '需要 ' + c.need + ' 個相同的 ' + (g.n ? '+' + g.n : '+0') + '。' };
    if (c.crystal && crystals() < c.crystal) return { ok: false, msg: '席琳結晶不足（需要 ' + c.crystal + ' 顆）。' };
    if (diamonds() < c.dia) return { ok: false, msg: '龍之鑽石不足（需要 ' + c.dia.toLocaleString() + '）。' };
    if (gold() < c.gold) return { ok: false, msg: '金幣不足（需要 ' + c.gold.toLocaleString() + '）。' };
    var fx = g.fx;
    if (target === 10 && !fx && mx >= 10) { var ds = donorsFor(g.base); fx = ds.length ? ds[Math.floor(Math.random() * ds.length)] : null; }
    var newId = makeId(g.base, target, fx);
    if (!ensure(newId)) return { ok: false, msg: '無法建立 +' + target + ' 的資料。' };

    var pay = adjustDia(-c.dia); if (!pay.ok) return { ok: false, msg: pay.error };
    var gold0 = p.gold; p.gold = gold0 - c.gold;
    var undoCrystal = null;
    if (c.crystal) { undoCrystal = takeCrystals(c.crystal); if (!undoCrystal) { p.gold = gold0; adjustDia(c.dia); return { ok: false, msg: '席琳結晶不足。' }; } }
    var success = c.merge ? true : (Math.random() < c.rate);
    var tk = null;
    if (success) {
      tk = take(g, c.need);
      if (tk.got.length < c.need) { tk.restore(); if (undoCrystal) undoCrystal(); p.gold = gold0; adjustDia(c.dia); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
      var best = tk.got.sort(function (a, b) { return affixScore(b) - affixScore(a); })[0];
      pushResult(newId, best);
      remember(newId);
    }
    if (!saveOk()) {
      if (tk) { tk.restore(); }
      if (undoCrystal) undoCrystal();
      p.gold = gold0; adjustDia(c.dia);
      try { saveGame(); } catch (e) {}
      return { ok: false, msg: '存檔失敗，什麼都沒有改變（龍鑽與金幣已退回）。' };
    }
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    var nm = (DB.items[g.base] || {}).n;
    var msg = success
      ? '🔨 遺物合成成功：' + nm + ' +' + target + (target === 10 && fx ? '，繼承了「' + DB.items[fx].n + '」的特效' : '') + '。'
      : '🔨 遺物強化失敗：' + nm + ' 仍是 +' + g.n + '（遺物沒有消失）。';
    try { logSys('<span class="' + (success ? 'text-amber-300 font-bold' : 'text-slate-300') + '">' + msg + '</span>'); } catch (e) {}
    return { ok: true, success: success, msg: msg, id: success ? newId : null };
  }


  // ── 昇華支配（+15 之後；飾品為 +5 之後）──────────────────────────────
  //   +15 → 昇華支配 +0：10 萬龍鑽、席琳結晶 1 萬、夢艷結晶 500、地獄精華 100、四屬性滅魔蔑視水晶各 5、
  //                     四大古代龍鱗盔甲各 1、真．冥皇套裝（名稱以「真．冥皇」開頭的裝備）各 1；成功率 100%
  //   +0→+1～+3→+4：四屬性滅魔蔑視水晶各 20、至暗星塵 5；成功率 100%／50%／30%／10%
  //   +4→+5：至暗星塵 50、境滅亡域鑰匙 1；成功率 100%
  //   夢域塵：每顆成功率 +10%，一次最多 5 顆。失敗時材料消耗、遺物不會消失。
  var CONTEMPT = ['afk_contempt_earth', 'afk_contempt_water', 'afk_contempt_wind', 'afk_contempt_fire'];
  var DRAGON_ARMORS = ['古代地龍鱗盔甲', '古代水龍鱗盔甲', '古代火龍鱗盔甲', '古代風龍鱗盔甲'];
  var mingNames = null;
  function mingSet() {
    if (mingNames) return mingNames;
    var seen = {};
    Object.keys(DB.items).forEach(function (id) { var d = DB.items[id]; if (d && /^真．冥皇/.test(d.n || '') && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') && !d.relic) seen[d.n] = 1; });
    mingNames = Object.keys(seen);
    return mingNames;
  }
  function ascCost(A) {
    var c = { dia: 0, items: {}, equip: [], rate: 1 };
    if (A === 0) {
      c.dia = 100000;
      c.items = { sherine_crystal: 10000, afk_dream_crystal: 500, afk_hell_essence: 100 };
      CONTEMPT.forEach(function (id) { c.items[id] = 5; });
      c.equip = DRAGON_ARMORS.concat(mingSet());
    } else if (A <= 4) {
      CONTEMPT.forEach(function (id) { c.items[id] = 20; });
      c.items.afk_dark_stardust = 5;
      c.rate = [1, 0.5, 0.3, 0.1][A - 1];
    } else {
      c.items = { afk_dark_stardust: 50, afk_abyss_key: 1 };
    }
    return c;
  }
  var DUST = 'afk_dream_dust';
  var invCnt = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (s2, i) { return s2 + (i && i.id === id && !i.lock ? Math.max(1, Math.floor(Number(i.cnt) || 1)) : 0); }, 0) : 0; };
  var nameCnt = function (nm) { var p = P(); return p ? (p.inv || []).filter(function (i) { return i && !i.lock && DB.items[i.id] && DB.items[i.id].n === nm; }).length : 0; };
  function snapInv() { var p = P(), snap = p.inv.slice(), cnts = p.inv.map(function (x) { return x && x.cnt; }); return function () { p.inv = snap; snap.forEach(function (x, j) { if (x) x.cnt = cnts[j]; }); }; }
  function takeId(id, k) {
    var p = P();
    for (var i = p.inv.length - 1; i >= 0 && k > 0; i--) {
      var it = p.inv[i]; if (!it || it.id !== id || it.lock) continue;
      var c2 = Math.max(1, Math.floor(Number(it.cnt) || 1)), use = Math.min(c2, k);
      k -= use; if (c2 - use <= 0) p.inv.splice(i, 1); else it.cnt = c2 - use;
    }
    return k <= 0;
  }
  function takeName(nm) {   // 同名裝備拿走 1 件：先拿沒詞綴、強化值低的
    var p = P();
    var cand = p.inv.filter(function (i) { return i && !i.lock && DB.items[i.id] && DB.items[i.id].n === nm; })
      .sort(function (a, b) { return (affixScore(a) - affixScore(b)) || ((Number(a.en) || 0) - (Number(b.en) || 0)); });
    if (!cand.length) return false;
    var it = cand[0], c2 = Math.max(1, Math.floor(Number(it.cnt) || 1));
    if (c2 > 1) it.cnt = c2 - 1; else p.inv.splice(p.inv.indexOf(it), 1);
    return true;
  }
  function ascMissing(c) {
    var miss = [];
    if (c.dia && diamonds() < c.dia) miss.push('龍之鑽石 ' + c.dia.toLocaleString());
    Object.keys(c.items).forEach(function (id) { var h = invCnt(id); if (h < c.items[id]) miss.push(((DB.items[id] || {}).n || id) + ' ' + h + '/' + c.items[id]); });
    c.equip.forEach(function (nm) { if (nameCnt(nm) < 1) miss.push(nm); });
    return miss;
  }
  var dustUse = 0, stoneUse = false;
  var STONE = { wpn: 'afk_asc_stone_wpn', arm: 'afk_asc_stone_arm', acc: 'afk_asc_stone_acc' };
  var stoneOf = function (base) { var d = DB.items[base]; return d ? STONE[d.type] : null; };
  function ascend(key, dust, useStone) {
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    if (typeof state !== 'undefined' && state && state.ff) return { ok: false, msg: '補跑中，請稍候再試。' };
    var g = groups().filter(function (x) { return x.key === key; })[0];
    if (!g) return { ok: false, msg: '找不到這個遺物。' };
    if (g.n !== maxOf(g.base)) return { ok: false, msg: '需要先強化到 +' + maxOf(g.base) + '。' };
    var A = g.asc == null ? 0 : g.asc + 1;
    if (A > 5) return { ok: false, msg: '已經是昇華支配 +5（最高）。' };
    var c = ascCost(A), miss;
    if (useStone) {
      if (A < 1) return { ok: false, msg: '昇華支配強化石只能用在昇華支配 +1～+5。' };
      var sid = stoneOf(g.base); if (!sid) return { ok: false, msg: '找不到對應的強化石。' };
      c = { dia: 0, items: {}, equip: [], rate: 1 }; c.items[sid] = 1; dust = 0;
    }
    miss = ascMissing(c);
    dust = Math.max(0, Math.min(5, Math.floor(Number(dust) || 0), invCnt(DUST)));
    if (miss.length) return { ok: false, msg: '材料不足：' + miss.join('、') };
    var newId = makeId(g.base, g.n, g.fx, A);
    if (!ensure(newId)) return { ok: false, msg: '無法建立昇華支配資料。' };
    if (c.dia) { var pay = adjustDia(-c.dia); if (!pay.ok) return { ok: false, msg: pay.error }; }
    var undo = snapInv();
    var okTake = Object.keys(c.items).every(function (id) { return takeId(id, c.items[id]); })
      && c.equip.every(function (nm) { return takeName(nm); })
      && (!dust || takeId(DUST, dust));
    if (!okTake) { undo(); if (c.dia) adjustDia(c.dia); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
    var rate = Math.min(1, c.rate + 0.10 * dust);
    var success = Math.random() < rate;
    if (success) {
      var tk = take(g, 1);
      if (tk.got.length < 1) { undo(); if (c.dia) adjustDia(c.dia); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
      pushResult(newId, tk.got[0]);
      remember(newId);
    }
    if (!saveOk()) { undo(); if (c.dia) adjustDia(c.dia); try { saveGame(); } catch (e) {} return { ok: false, msg: '存檔失敗，什麼都沒有改變。' }; }
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
    var nm = (DB.items[g.base] || {}).n;
    var msg = success ? '✨ 昇華支配成功：+' + A + ' ' + nm + '昇華支配' + (useStone ? '（使用昇華支配強化石）' : (dust ? '（使用夢域塵 ' + dust + ' 顆）' : '')) + '！'
                      : '昇華支配失敗：' + nm + ' 維持原樣，材料已消耗（成功率 ' + Math.round(rate * 100) + '%）。';
    try { logSys('<span class="' + (success ? 'text-fuchsia-300 font-bold' : 'text-slate-300') + '">' + msg + '</span>'); } catch (e) {}
    return { ok: true, success: success, msg: msg, rate: rate, id: success ? newId : null };
  }
  // 至暗星塵：地獄精華 20 個合成 1 個，成功率 70%
  function craftStardust(times) {
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    times = Math.max(1, Math.floor(Number(times) || 1));
    times = Math.min(times, Math.floor(invCnt('afk_hell_essence') / 20));
    if (times < 1) return { ok: false, msg: '地獄精華不足 20 個。' };
    var undo = snapInv();
    if (!takeId('afk_hell_essence', 20 * times)) { undo(); return { ok: false, msg: '背包資料變動。' }; }
    var ok = 0; for (var i = 0; i < times; i++) if (Math.random() < 0.7) ok++;
    if (ok) gainItem('afk_dark_stardust', ok, true, true);
    if (!saveOk()) { undo(); try { saveGame(); } catch (e) {} return { ok: false, msg: '存檔失敗，什麼都沒有改變。' }; }
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    var msg = '哈瑪大師熔煉了 ' + (20 * times) + ' 個地獄精華：成功 ' + ok + ' 次、失敗 ' + (times - ok) + ' 次，獲得至暗星塵 × ' + ok + '。';
    try { logSys('<span class="text-violet-300">' + msg + '</span>'); } catch (e) {}
    return { ok: true, made: ok, tries: times, msg: msg };
  }


  // ── 至高的支配：昇華支配 +5 進化（材料＝六種時空材料各 1，100% 成功）──
  var TS_MATS = ['afk_ts_contempt_earth', 'afk_ts_contempt_water', 'afk_ts_contempt_wind', 'afk_ts_contempt_fire', 'afk_ts_dark_stardust', 'afk_ts_dream_dust'];
  var EVO_MAX_EQUIP = 6;
  var equippedEvo = function (who) {
    var out = []; var eq = (who || P() || {}).eq || {};
    Object.keys(eq).forEach(function (k) { var e = eq[k]; var d = e && DB.items[e.id]; if (d && d.relicEvo != null) out.push(d.relicEvo); });
    return out;
  };
  function evolve(key) {
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    if (typeof state !== 'undefined' && state && state.ff) return { ok: false, msg: '補跑中，請稍候再試。' };
    var g = groups().filter(function (x) { return x.key === key; })[0];
    if (!g) return { ok: false, msg: '找不到這個遺物。' };
    if (g.asc !== 5 || g.evo != null) return { ok: false, msg: '只有「+5 昇華支配」才能進化。' };
    var miss = TS_MATS.filter(function (id) { return invCnt(id) < 1; });
    if (miss.length) return { ok: false, msg: '材料不足：' + miss.map(function (id) { return (DB.items[id] || {}).n || id; }).join('、') };
    var bd = DB.items[g.base], evo;
    if (bd && bd.set === 'priest') evo = 9;   // 司祭苦行套裝：直接擁有全部八種
    else {
      var have = {}; equippedEvo(p).forEach(function (e) { have[e] = 1; });
      (p.inv || []).forEach(function (it) { var d = it && DB.items[it.id]; if (d && d.relicEvo != null) have[d.relicEvo] = 1; });
      var pool = [1, 2, 3, 4, 5, 6, 7, 8].filter(function (e) { return !have[e]; });
      if (!pool.length) pool = [1, 2, 3, 4, 5, 6, 7, 8];
      evo = pool[Math.floor(Math.random() * pool.length)];
    }
    var newId = makeId(g.base, g.n, g.fx, 5, evo);
    if (!ensure(newId)) return { ok: false, msg: '無法建立至高的支配資料。' };
    var undo = snapInv();
    if (!TS_MATS.every(function (id) { return takeId(id, 1); })) { undo(); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
    var tk = take(g, 1);
    if (tk.got.length < 1) { undo(); return { ok: false, msg: '背包資料變動，什麼都沒有改變。' }; }
    pushResult(newId, tk.got[0]); remember(newId);
    if (!saveOk()) { undo(); try { saveGame(); } catch (e) {} return { ok: false, msg: '存檔失敗，什麼都沒有改變。' }; }
    try { if (typeof renderTabs === 'function') renderTabs(true); updateUI(); } catch (e) {}
    var msg = '🌟 進化成功：' + bd.n + '至高的支配【' + EVO[evo] + '】！';
    try { logSys('<span class="text-yellow-300 font-bold">' + msg + '</span>'); } catch (e) {}
    return { ok: true, id: newId, evo: evo, msg: msg };
  }
  // 特效套用（核心補丁 24 的兩個掛點＋重算後）
  var evoSet = function (p) {
    var s2 = {}; equippedEvo(p).forEach(function (e) { if (e === 9) [1, 2, 3, 4, 5, 6, 7, 8].forEach(function (x) { s2[x] = 1; }); else s2[e] = 1; });
    return s2;
  };
  window.__afkSetBoost = function (p, setCheck) {
    var e = evoSet(p);
    if (e[1]) setCheck.kurt = Math.max(setCheck.kurt || 0, 4);
    if (e[2]) setCheck.dk = Math.max(setCheck.dk || 0, 4);
    if (e[3]) setCheck.demon = Math.max(setCheck.demon || 0, 4);
    if (e[4]) setCheck.kinglord = Math.max(setCheck.kinglord || 0, 4);
    if (e[5]) setCheck.emperor = Math.max(setCheck.emperor || 0, 5);
  };
  window.__afkAttrBoost = function (p, d) {
    if (!evoSet(p)[6]) return;
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (f) { d[f] = (Number(d[f]) || 0) + 30; });
  };
  if (typeof window.recomputeStats === 'function') {
    var oRecomp = window.recomputeStats;
    window.recomputeStats = function () {
      var r = oRecomp.apply(this, arguments);
      try {
        var p = P(), e = p && evoSet(p);
        if (e && p.d) {
          if (e[7]) { ['meleeDmg', 'meleeHit', 'rangedDmg', 'rangedHit', 'magicDmg', 'magicHit', 'extraMp', 'resFire', 'resWater', 'resWind', 'resEarth', 'mr', 'er'].forEach(function (k) { p.d[k] = (Number(p.d[k]) || 0) + 50; }); p.d.ac = (Number(p.d.ac) || 0) - 50; }
          if (e[8]) RES4.forEach(function (k) { p.d[k] = (Number(p.d[k]) || 0) + 100; });
        }
      } catch (e2) {}
      return r;
    };
  }
  // 最多同時裝備 6 件至高的支配
  if (typeof window.equipItem === 'function') {
    var oEquip = window.equipItem;
    window.equipItem = function (item) {
      var d = item && DB.items[item.id];
      if (d && d.relicEvo != null && equippedEvo().length >= EVO_MAX_EQUIP) {
        try { logSys('<span class="text-amber-300">至高的支配最多同時裝備 ' + EVO_MAX_EQUIP + ' 件，請先卸下一件。</span>'); } catch (e) {}
        return;
      }
      return oEquip.apply(this, arguments);
    };
  }
  // 至暗支配：裝滿 6 件 → 席琳的永生（免疫死亡一次，冷卻 30 秒）
  var immortalAt = 0;
  if (typeof window.killPlayer === 'function') {
    var oKillP = window.killPlayer;
    window.killPlayer = function () {
      try {
        var t = (typeof state !== 'undefined' && state) ? state.ticks : 0;
        if (equippedEvo().length >= EVO_MAX_EQUIP && t >= immortalAt && !player.dead) {
          immortalAt = t + 300;
          player.hp = Math.max(1, player.hp > 0 ? player.hp : 1);
          try { logCombat('<span class="text-yellow-300 font-bold">【至暗支配・席琳的永生】</span>席琳的力量讓你免於死亡！（30 秒後可再次觸發）', 'heal'); } catch (e) {}
          try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
          return;
        }
      } catch (e) {}
      return oKillP.apply(this, arguments);
    };
  }

  // 滅魔蔑視水晶碎片 100 → 指定屬性水晶 1；昇華支配碎片 100 → 自選強化石 1；相消術卷軸 10 龍鑽 1 張
  function exchange(kind, arg, times) {
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    if (typeof state !== 'undefined' && state && state.ff) return { ok: false, msg: '補跑中，請稍候再試。' };
    times = Math.max(1, Math.floor(Number(times) || 1));
    var from, to, per, nmTo;
    if (kind === 'shard') { from = 'afk_contempt_shard'; per = 100; to = 'afk_contempt_' + arg; }
    else if (kind === 'ascshard') { from = 'afk_asc_shard'; per = 100; to = STONE[arg]; }
    else if (kind === 'cancel') {
      var cost = 10 * times;
      if (diamonds() < cost) return { ok: false, msg: '龍之鑽石不足 ' + cost + '。' };
      var pay = adjustDia(-cost); if (!pay.ok) return { ok: false, msg: pay.error };
      gainItem('afk_cancel_scroll', times, true, true);
      if (!saveOk()) { try { saveGame(); } catch (e) {} }
      try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
      var m0 = '向哈瑪大師買了相消術卷軸 × ' + times + '（' + cost + ' 龍鑽）。';
      try { logSys('<span class="text-emerald-300">' + m0 + '</span>'); } catch (e) {}
      return { ok: true, msg: m0 };
    } else return { ok: false, msg: '未知的兌換。' };
    if (!DB.items[to]) return { ok: false, msg: '找不到兌換目標。' };
    times = Math.min(times, Math.floor(invCnt(from) / per));
    if (times < 1) return { ok: false, msg: (DB.items[from] || {}).n + '不足 ' + per + ' 個。' };
    var undo = snapInv();
    if (!takeId(from, per * times)) { undo(); return { ok: false, msg: '背包資料變動。' }; }
    gainItem(to, times, true, true);
    if (!saveOk()) { undo(); try { saveGame(); } catch (e) {} return { ok: false, msg: '存檔失敗，什麼都沒有改變。' }; }
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    nmTo = DB.items[to].n;
    var msg = '哈瑪大師用 ' + (per * times) + ' 個' + DB.items[from].n + '換成了 ' + nmTo + ' × ' + times + '。';
    try { logSys('<span class="text-fuchsia-300">' + msg + '</span>'); } catch (e) {}
    return { ok: true, msg: msg };
  }

  // ── +15 以上遺物武器的屬性卷軸（只有哈瑪大師可以；裝備在武器欄的那一把）────────────
  //   規則沿用碧恩：每張 7%、同屬性升階、第 5 階同屬性卷軸 1% 附加／重抽魔法；遺物免強化值門檻、原本有觸發特效的也能附加魔法。
  //   昇華支配的遺物魔法最高 5 星（一般 3 星）；5 星時轉換成新魔法（見 __afkAttr5）。
  function relicWpnForAttr() {
    var p = P(); var it = p && p.eq && p.eq.wpn; var d = it && DB.items[it.id];
    if (!d || !d.relicPlus || d.type !== 'wpn' || d.relicPlus < 15) return null;
    return it;
  }
  function hamaAttr(ele) {
    var it = relicWpnForAttr(); if (!it) return { ok: false, msg: '請先在武器欄裝備 +15 以上的遺物武器。' };
    if (typeof doBianAttr !== 'function') return { ok: false, msg: '找不到屬性卷軸功能。' };
    var d = DB.items[it.id];
    var oRel = window.isRelic, oTrig = window.weaponHasBaseTriggeredSkill, oRender = window.renderBianAttr;
    window.isRelic = function (x) { return x === d ? false : oRel.apply(this, arguments); };
    window.weaponHasBaseTriggeredSkill = function (x) { return x === d ? false : oTrig.apply(this, arguments); };
    window.renderBianAttr = function () {};
    try { doBianAttr('wpn', ele); } finally { window.isRelic = oRel; window.weaponHasBaseTriggeredSkill = oTrig; window.renderBianAttr = oRender; }
    return { ok: true };
  }
  var ATTR5 = {
    fire: { n: '爆炎流星雨', sk: ['sk_meteor'] },
    water: { n: '寒冬冰雪暴', sk: ['sk_fire_storm', 'sk_blizzard'] },
    wind: { n: '靈魂風暴', sk: ['sk_thunder_storm', 'sk_tornado'] },
    earth: { n: '陷陣岩崩', sk: ['sk_earthquake', 'sk_blaze'] }   // 遊戲裡沒有「炎爆術」，以烈炎術代替
  };
  window.__afkAttr5 = function (target, inst, wpn, proc) {
    if (Math.random() * 100 >= 25) return;   // 5% × 5 星
    var cfg = ATTR5[proc.ele]; if (!cfg) return;
    try { logCombat('<span class="font-bold" style="color:#f0abfc;text-shadow:0 0 6px #a21caf">【' + cfg.n + '】</span>昇華支配之力爆發！', 'player-special'); } catch (e) {}
    var prev = window.__afkSpellMult; window.__afkSpellMult = 1.5;
    try {
      for (var k = 0; k < 3; k++) cfg.sk.forEach(function (skId) {
        var sk = DB.skills[skId]; if (!sk) return;
        var alive = mapState.mobs.filter(function (m) { return m && m.curHp > 0 && !m._dead; });
        if (!alive.length) return;
        if (sk.target === 'all') procFreeMagicSkill(alive[0], skId, 0, false, wpn);
        else alive.forEach(function (m) { procFreeMagicSkill(m, skId, 0, true, wpn); });
      });
    } finally { window.__afkSpellMult = prev; }
  };

  // ── 能力預覽 ──
  function statLine(d, base) {
    var b = DB.items[base], out = b.type === 'wpn' ? ['大小傷 ' + d.dmgS + '/' + d.dmgL] : ['AC ' + (d.ac || 0) + '、MR ' + (d.mr || 0)];
    ['er', 'dr', 'hpR', 'mpR'].forEach(function (f) { if ((d[f] || 0) !== (b[f] || 0)) out.push(f + ' ' + (b[f] || 0) + '→' + d[f]); });
    if ((d.resFire || 0) !== (b.resFire || 0) && !d.relicFxRes) out.push('四屬性抗性 +' + ((d.resFire || 0) - (b.resFire || 0)));
    if (d.highestAttrPlus && d.highestAttrPlus !== b.highestAttrPlus && d.highestAttrPlus !== true) out.push('主屬性強化 +' + d.highestAttrPlus);
    if (d.fireNullifyTicks) out.push(d.fireNullifyTicks <= 1 ? '火焰化解：完全免疫' : '火焰化解每 ' + d.fireNullifyTicks / 10 + ' 秒');
    if (b.type === 'wpn') WHITE.forEach(function (f) { if (typeof b[f] === 'number' && b[f] !== 0 && d[f] !== b[f]) out.push(f + ' ' + b[f] + '→' + d[f]); });
    Object.keys(b).forEach(function (f) {
      var v = b[f];
      if (typeof v === 'number' && RATE_TOP.test(f) && d[f] !== v) out.push(f + ' ' + v + '%→' + d[f] + '%');
      else if (v && typeof v === 'object' && /^proc/.test(f)) {
        if (typeof v.rate === 'number' && d[f].rate !== v.rate) out.push(f + ' ' + v.rate + '%→' + d[f].rate + '%');
        else if (typeof v.pct === 'number' && d[f].pct !== v.pct) out.push(f + ' ' + v.pct + '%→' + d[f].pct + '%');
      }
    });
    if (d.relicBleedBonus) out.push('出血 20%→' + (20 + d.relicBleedBonus) + '%');
    return out.join('、');
  }
  var LABEL = { er: 'ER', dr: '傷害減免', hpR: 'HP恢復', mpR: 'MP恢復', hit: '近距命中', dmgBonus: '近距傷害', bowHit: '遠距命中', bowDmg: '遠距傷害', magicHit: '魔法命中', mdmg: '魔法傷害', extraDmg: '額外傷害',
    str: '力量', dex: '敏捷', con: '體質', int: '智力', wis: '精神', cha: '魅力', mr: '魔防', dr: '傷害減免', hpR: 'HP恢復', mpR: 'MP恢復', extraMp: '額外魔力',
    comboRate: '連擊', pierceChance: '穿透', procRateBase: '觸發技能', procPoison: '中毒', procStatusSkill: '異常', procBonusDmg: '額外傷害', procBurn: '灼燒', procPoisonPct: '劇毒' };
  var pretty = function (s) { return s.replace(/([a-zA-Z]+)(?= )/g, function (k) { return LABEL[k] || k; }); };

  // ── 視窗 ──
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var layer = null;
  function css() {
    if (document.getElementById('rp-css')) return;
    var st = document.createElement('style'); st.id = 'rp-css';
    st.textContent = [
      '.rp-open{display:block;width:100%;margin:0 0 12px;padding:9px 12px;border:1px solid #b45309;border-radius:9px;background:linear-gradient(135deg,#3b2105,#6b3a0a);color:#fde68a;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}',
      '.rp-open:hover{filter:brightness(1.15)}',
      '#rp-modal{position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:9700;background:rgba(2,6,23,.72);display:none;align-items:center;justify-content:center;padding:14px}',
      '.rp-box{width:min(760px,96vw);max-height:min(88vh,860px);display:flex;flex-direction:column;background:#0b1220;border:2px solid #b45309;border-radius:14px;overflow:hidden;color:#e2e8f0;box-shadow:0 22px 60px rgba(0,0,0,.75)}',
      '.rp-head{display:flex;align-items:center;gap:10px;padding:11px 14px;background:#1c1206;border-bottom:1px solid #78350f;font-weight:800;color:#fcd34d}',
      '.rp-head .rp-bal{margin-left:auto;font-weight:600;font-size:13px;color:#e2e8f0}',
      '.rp-x{border:0;background:#334155;color:#e2e8f0;border-radius:6px;padding:2px 10px;cursor:pointer;font-size:16px}',
      '.rp-rule{padding:8px 14px;font-size:12px;color:#94a3b8;border-bottom:1px solid #1e293b;line-height:1.6}',
      '.rp-list{overflow-y:auto;padding:8px 10px;flex:1}',
      '.rp-row{display:flex;gap:10px;align-items:center;padding:8px;border:1px solid #1e293b;border-radius:9px;margin-bottom:6px;background:#0f172a}',
      '.rp-row img{width:36px;height:36px;image-rendering:pixelated;flex:0 0 auto}',
      '.rp-mid{flex:1;min-width:0}.rp-nm{font-weight:800;color:#67e8f9}.rp-sub{font-size:12px;color:#94a3b8;margin-top:2px}',
      '.rp-go{flex:0 0 auto;padding:6px 10px;border-radius:8px;border:1px solid #b45309;background:#78350f;color:#fef3c7;font-weight:800;cursor:pointer;font-size:13px;white-space:nowrap}',
      '.rp-go[disabled]{opacity:.45;cursor:not-allowed}',
      '.rp-empty{padding:30px;text-align:center;color:#64748b}',
      '.rp-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 14px;border-bottom:1px solid #1e293b;font-size:12px;color:#cbd5e1}',
      '.rp-tools button,.rp-tools select{font:inherit;padding:4px 10px;border-radius:7px;border:1px solid #6d28d9;background:#2e1065;color:#ede9fe;cursor:pointer}',
      '.rp-tools button[disabled]{opacity:.45;cursor:not-allowed}',
      '.rp-asc{border-color:#a21caf!important;background:#4a044e!important;color:#fae8ff!important}',
      '.rp-miss{color:#fca5a5}',
      '#rp-modal.rp-embed{position:static;inset:auto;background:none;padding:0;z-index:auto;display:block}',
      '.rp-embed .rp-box{width:100%;max-height:none;border:0;border-radius:0;box-shadow:none;background:transparent;font-size:14px}',
      '.rp-embed .rp-head{background:transparent;border-bottom:1px solid #334155;padding:4px 2px 8px;font-size:15px}',
      '.rp-embed .rp-x{display:none}',
      '.rp-embed .rp-rule{font-size:14px;color:#cbd5e1;padding:8px 2px}',
      '.rp-embed .rp-tools{font-size:14px;padding:8px 2px}',
      '.rp-embed .rp-sub{font-size:13px}.rp-embed .rp-nm{font-size:15px}',
      '.rp-embed .rp-list{overflow:visible;padding:8px 0}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function build() {
    css();
    var m = document.createElement('div'); m.id = 'rp-modal';
    m.innerHTML = '<div class="rp-box"><div class="rp-head">🔨 哈瑪大師・遺物強化<span class="rp-bal" id="rp-bal"></span><button class="rp-x" type="button" id="rp-x">✕</button></div>'
      + '<div class="rp-rule">兩個同款同強化值合成高一級：做出 +1～+6 每次 500 鑽＋5,000 萬；+7～+10 每級再多 100 鑽＋1,000 萬。+11～+15 單件強化：每次 5 萬鑽、成功率 10%，失敗不會消失。'
      + '<br>武器：每 +1 大小傷 +1、每 +3 白字各 +1。防具／飾品：每 +1 AC-1 與 MR+1、每 +3 ER+1、每 +5 傷害減免+1。'
      + '<br>共通：每 +5 遺物特效 +5%；HP／MP 恢復每 +1 多 1（本身 ≥50 的多 10）；+10 獲得第二詞綴：隨機抽一件同部位遺物繼承它的特效，抽到沒有特效的則改為四屬性抗性 +10。'
      + '<br>戒指、耳環、項鍊、腰帶最高 +5，每級要 3 個同級遺物、龍鑽與金幣 ×3，另需席琳結晶 500 顆。'
      + '<br>滿級（+15／飾品 +5）之後可以昇華支配 +0～+5：武器每 +1 大小傷 +10、白字 +5；防具每 +1 HP/MP 恢復 +50、六屬性 +1、ER/AC/MR/減傷 +1、四屬性抗性 +10（飾品沒有 HP/MP 恢復）。只計算背包裡未上鎖的遺物與材料。</div>'
      + '<div class="rp-tools" id="rp-tools"></div>'
      + '<div class="rp-list" id="rp-list"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    document.getElementById('rp-x').onclick = close;
    document.getElementById('rp-list').addEventListener('click', function (e) {
      var b = e.target.closest('.rp-go'); if (!b || b.disabled) return;
      if (b.classList.contains('rp-evo')) askEvo(b.getAttribute('data-k'));
      else if (b.classList.contains('rp-asc')) askAsc(b.getAttribute('data-k')); else ask(b.getAttribute('data-k'));
    });
    document.getElementById('rp-tools').addEventListener('click', function (e) {
      var ab = e.target.closest('[data-attr]');
      if (ab && !ab.disabled) { var ar = hamaAttr(ab.getAttribute('data-attr')); if (!ar.ok) { try { logSys('<span class="text-red-400">' + esc(ar.msg) + '</span>'); } catch (e3) {} } render(); return; }
      var xb = e.target.closest('[data-ex]');
      if (xb && !xb.disabled) { var xr = exchange(xb.getAttribute('data-ex'), xb.getAttribute('data-arg'), Number(xb.getAttribute('data-n')) || 1); if (!xr.ok) { try { logSys('<span class="text-red-400">' + esc(xr.msg) + '</span>'); } catch (e4) {} } render(); return; }
      var b = e.target.closest('[data-craft]'); if (!b || b.disabled) return;
      var r = craftStardust(Number(b.getAttribute('data-craft'))); if (!r.ok) { try { logSys('<span class="text-red-400">' + esc(r.msg) + '</span>'); } catch (e2) {} } render();
    });
    document.getElementById('rp-tools').addEventListener('change', function (e) { if (e.target.id === 'rp-dust') { dustUse = Number(e.target.value) || 0; render(); } if (e.target.id === 'rp-stone') { stoneUse = !!e.target.checked; render(); } });
  }
  function render() {
    var bal = document.getElementById('rp-bal'); if (bal) bal.textContent = '龍鑽 ' + diamonds().toLocaleString() + '｜金幣 ' + gold().toLocaleString();
    var tools = document.getElementById('rp-tools');
    if (tools) {
      var ess = invCnt('afk_hell_essence'), dustHave = invCnt(DUST);
      if (dustUse > Math.min(5, dustHave)) dustUse = Math.min(5, dustHave);
      var opts = ''; for (var di = 0; di <= Math.min(5, dustHave); di++) opts += '<option value="' + di + '"' + (di === dustUse ? ' selected' : '') + '>' + di + '</option>';
      tools.innerHTML = '至暗星塵 <b>' + invCnt('afk_dark_stardust') + '</b>｜地獄精華 <b>' + ess + '</b>'
        + '<button type="button" data-craft="1"' + (ess >= 20 ? '' : ' disabled') + '>合成星塵 ×1（20 精華・70%）</button>'
        + '<button type="button" data-craft="10"' + (ess >= 200 ? '' : ' disabled') + '>×10</button>'
        + attrPanel()
        + '<span style="margin-left:auto">昇華支配使用夢域塵（每顆 +10%，持有 ' + dustHave + '）</span><select id="rp-dust">' + opts + '</select>'
        + '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="rp-stone"' + (stoneUse ? ' checked' : '') + '>改用昇華支配強化石（武 ' + invCnt(STONE.wpn) + '／防 ' + invCnt(STONE.arm) + '／飾 ' + invCnt(STONE.acc) + '）</label>'
        + '<div style="flex-basis:100%;display:flex;flex-wrap:wrap;gap:8px;align-items:center">'
        + '<span>蔑視水晶碎片 <b>' + invCnt('afk_contempt_shard') + '</b>（100 合 1）</span>'
        + [['earth', '地'], ['water', '水'], ['wind', '風'], ['fire', '火']].map(function (x) { return '<button type="button" data-ex="shard" data-arg="' + x[0] + '"' + (invCnt('afk_contempt_shard') >= 100 ? '' : ' disabled') + '>' + x[1] + '</button>'; }).join('')
        + '<span>｜昇華支配碎片 <b>' + invCnt('afk_asc_shard') + '</b>（100 換 1 顆強化石）</span>'
        + [['wpn', '武器'], ['arm', '防具'], ['acc', '飾品']].map(function (x) { return '<button type="button" data-ex="ascshard" data-arg="' + x[0] + '"' + (invCnt('afk_asc_shard') >= 100 ? '' : ' disabled') + '>' + x[1] + '</button>'; }).join('')
        + '<span>｜相消術卷軸 <b>' + invCnt('afk_cancel_scroll') + '</b>（每張 10 鑽）</span>'
        + [1, 10, 100].map(function (n) { return '<button type="button" data-ex="cancel" data-n="' + n + '"' + (diamonds() >= 10 * n ? '' : ' disabled') + '>買 ' + n + '</button>'; }).join('')
        + '</div>';
    }
    var list = document.getElementById('rp-list'); if (!list) return;
    var gs = groups();
    if (!gs.length) { list.innerHTML = '<div class="rp-empty">背包裡沒有可以合成的武器遺物。</div>'; return; }
    list.innerHTML = gs.map(function (g) {
      var bd = DB.items[g.base], cur = DB.items[makeId(g.base, g.n, g.fx, g.asc)] || bd;
      var mx = maxOf(g.base), t = g.n + 1, c = t <= mx ? costOf(t, g.base) : null, btn, ascTxt = '';
      if (!c) {
        var A = g.asc == null ? 0 : g.asc + 1;
        if (A > 5 && g.evo != null) btn = '<button class="rp-go" disabled>至高的支配<br><span style="font-weight:600;font-size:11px">' + esc(EVO[g.evo]) + '</span></button>';
        else if (A > 5) {
          var evMiss = TS_MATS.filter(function (id) { return invCnt(id) < 1; });
          btn = '<button class="rp-go rp-evo" type="button" data-k="' + esc(g.key) + '"' + (evMiss.length ? ' disabled' : '') + '>進化<br><span style="font-weight:600;font-size:11px">至高的支配 100%</span></button>';
          ascTxt = '<div class="rp-sub" style="color:#fde047">進化：隨機獲得一種至高的支配特效（克特／死亡騎士／惡魔／四大軍王／真．冥皇套裝、全能力 +30、面板能力 +50、四屬性抗性 +100，不跟你已有的重複）' + (bd.set === 'priest' ? '；司祭苦行套裝直接擁有全部八種' : '') + '</div>'
            + '<div class="rp-sub">需要：' + TS_MATS.map(function (id) { var h = invCnt(id); return '<span class="' + (h ? '' : 'rp-miss') + '">' + esc((DB.items[id] || {}).n || id) + ' ' + h + '/1</span>'; }).join('、') + '</div>';
        }
        else {
          var ac = ascCost(A), rate = Math.min(1, ac.rate + 0.1 * dustUse);
          if (stoneUse && A >= 1 && stoneOf(g.base)) { ac = { dia: 0, items: {}, equip: [], rate: 1 }; ac.items[stoneOf(g.base)] = 1; rate = 1; }
          var miss = ascMissing(ac);
          btn = '<button class="rp-go rp-asc" type="button" data-k="' + esc(g.key) + '"' + (miss.length ? ' disabled' : '') + '>昇華支配 +' + A + '<br><span style="font-weight:600;font-size:11px">成功率 ' + Math.round(rate * 100) + '%</span></button>';
          var need = [];
          if (ac.dia) need.push('龍鑽 ' + ac.dia.toLocaleString());
          Object.keys(ac.items).forEach(function (id) { var h = invCnt(id), ok = h >= ac.items[id]; need.push('<span class="' + (ok ? '' : 'rp-miss') + '">' + esc((DB.items[id] || {}).n || id) + ' ' + h + '/' + ac.items[id] + '</span>'); });
          ac.equip.forEach(function (nm) { need.push('<span class="' + (nameCnt(nm) ? '' : 'rp-miss') + '">' + esc(nm) + '</span>'); });
          var nd2 = buildDef(g.base, g.n, g.fx, A);
          ascTxt = '<div class="rp-sub" style="color:#f0abfc">昇華支配 +' + A + '：' + esc(pretty(statLine(nd2, g.base))) + '</div><div class="rp-sub">需要：' + need.join('、') + '</div>';
        }
      } else {
        var enough = g.cnt >= c.need && diamonds() >= c.dia && gold() >= c.gold && (!c.crystal || crystals() >= c.crystal);
        btn = '<button class="rp-go" type="button" data-k="' + esc(g.key) + '"' + (enough ? '' : ' disabled') + '>'
          + (c.merge ? '合成 +' + t : '強化 +' + t + '（10%）') + '<br><span style="font-weight:600;font-size:11px">' + c.dia.toLocaleString() + ' 鑽' + (c.gold ? '＋' + (c.gold / 10000).toLocaleString() + ' 萬' : '') + (c.crystal ? '＋結晶 ' + c.crystal : '') + (c.need > 2 ? '（' + c.need + ' 個）' : '') + '</span></button>';
      }
      var nextTxt = '';
      if (c) { var nid = makeId(g.base, t, g.fx); var nd = DB.items[nid] || buildDef(g.base, t, g.fx); nextTxt = '下一級：' + pretty(statLine(nd, g.base)) + (t === 10 && !g.fx && mx >= 10 ? '、獲得第二詞綴（隨機同部位遺物特效）' : ''); }
      var img = ''; try { img = getIconUrl(bd); } catch (e) {}
      return '<div class="rp-row"><img src="' + esc(img) + '" alt="" onerror="this.style.visibility=\'hidden\'">'
        + '<div class="rp-mid"><div class="rp-nm">' + (g.asc != null ? '+' + g.asc + ' ' + esc(bd.n) + '昇華支配' : (g.n ? '+' + g.n + ' ' : '') + esc(bd.n)) + ' <span style="color:#94a3b8;font-weight:600">× ' + g.cnt + '</span></div>'
        + '<div class="rp-sub">目前：' + pretty(statLine(cur, g.base)) + (g.fx && DB.items[g.fx] ? (cur.relicFxRes ? '、第二詞綴：四屬性抗性 +10' : '、第二詞綴：「' + esc(DB.items[g.fx].n) + '」特效') : '') + '</div>'
        + (nextTxt ? '<div class="rp-sub" style="color:#fcd34d">' + esc(nextTxt) + '</div>' : '') + ascTxt + '</div>' + btn + '</div>';
    }).join('');
  }
  function ask(key) {
    var g = groups().filter(function (x) { return x.key === key; })[0]; if (!g) return render();
    var t = g.n + 1, c = costOf(t, g.base), nm = DB.items[g.base].n;
    var msg = c.merge
      ? '用 ' + c.need + ' 個 ' + (g.n ? '+' + g.n + ' ' : '') + nm + ' 合成 +' + t + '，花費 ' + c.dia.toLocaleString() + ' 龍鑽＋' + c.gold.toLocaleString() + ' 金幣' + (c.crystal ? '＋席琳結晶 ' + c.crystal + ' 顆' : '') + '。' + (t === 10 ? '\n+10 會隨機繼承一種同部位遺物的特效。' : '')
      : '強化 +' + g.n + ' ' + nm + ' → +' + t + '，花費 ' + c.dia.toLocaleString() + ' 龍鑽，成功率 10%。\n失敗時龍鑽會扣掉，遺物不會消失。';
    var go = function () { var r = upgrade(key); render(); if (!r.ok) { try { logSys('<span class="text-red-400">' + esc(r.msg) + '</span>'); } catch (e) {} } };
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '遺物合成', message: msg, okText: '確定', cancelText: '取消', onOk: go });
    else if (confirm(msg)) go();
  }
  function attrPanel() {
    var it = relicWpnForAttr();
    if (!it) return '<span style="color:#64748b">（屬性卷軸：在武器欄裝備 +15 以上的遺物武器即可使用）</span>';
    var cur = (typeof getAttrAffix === 'function') ? getAttrAffix(it.attr) : null, mg = (typeof getAttrMagicProc === 'function') ? getAttrMagicProc(it) : null;
    var cnt = function (id) { return invCnt(id); };
    var html = '<span>屬性：' + (cur ? esc(cur.n) + '（第' + cur.tier + '階）' : '無') + (mg ? '　魔法：' + '★'.repeat(mg.star) + ' ' + esc((DB.skills[mg.skId] || {}).n || mg.skId) : '') + '</span>';
    ['fire', 'water', 'wind', 'earth'].forEach(function (e) {
      var sc = (typeof ATTR_SCROLLS !== 'undefined') ? ATTR_SCROLLS[e] : null; if (!sc) return;
      html += '<button type="button" data-attr="' + e + '"' + (cnt(sc.id) ? '' : ' disabled') + '>' + esc(sc.n.replace('武器強化卷軸', '')) + ' ' + cnt(sc.id) + '</button>';
    });
    return html;
  }
  function askEvo(key) {
    var g = groups().filter(function (x) { return x.key === key; })[0]; if (!g) return render();
    var nm = DB.items[g.base].n;
    var msg = '把「+5 ' + nm + '昇華支配」進化為「' + nm + '至高的支配」，成功率 100%。\n消耗六種時空材料各 1 個，隨機獲得一種至高的支配特效。\n裝滿 6 件至高的支配：發動「至暗支配・席琳的永生」（免疫死亡一次，冷卻 30 秒）。';
    var go = function () { var r = evolve(key); render(); if (!r.ok) { try { logSys('<span class="text-red-400">' + esc(r.msg) + '</span>'); } catch (e) {} } };
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '至高的支配', message: msg, okText: '進化', cancelText: '取消', onOk: go });
    else if (confirm(msg)) go();
  }
  function askAsc(key) {
    var g = groups().filter(function (x) { return x.key === key; })[0]; if (!g) return render();
    var A = g.asc == null ? 0 : g.asc + 1, c = ascCost(A), rate = Math.min(1, c.rate + 0.1 * dustUse), nm = DB.items[g.base].n;
    var st = stoneUse && A >= 1 && stoneOf(g.base);
    if (st) { c = { dia: 0, items: {}, equip: [], rate: 1 }; rate = 1; }
    var msg = (A === 0 ? '把 +' + g.n + ' ' + nm + ' 昇華為「+0 ' + nm + '昇華支配」' : '強化為「+' + A + ' ' + nm + '昇華支配」') + '，成功率 ' + Math.round(rate * 100) + '%'
      + (st ? '（使用 1 顆' + DB.items[stoneOf(g.base)].n + '，不需要其他材料）' : (dustUse ? '（使用夢域塵 ' + dustUse + ' 顆）' : '')) + '。\n會消耗清單上的全部材料' + (c.equip.length ? '（包含四大古代龍鱗盔甲與真．冥皇套裝各 1 件）' : '') + '；失敗時材料消耗、遺物不會消失。';
    var go = function () { var r = ascend(key, dustUse, !!st); render(); if (!r.ok) { try { logSys('<span class="text-red-400">' + esc(r.msg) + '</span>'); } catch (e) {} } };
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '昇華支配', message: msg, okText: '確定', cancelText: '取消', danger: true, onOk: go });
    else if (confirm(msg)) go();
  }
  function open() {
    if (!P()) return;
    if (!document.getElementById('rp-modal')) build();
    var mm = document.getElementById('rp-modal');
    if (mm.classList.contains('rp-embed')) { mm.classList.remove('rp-embed'); document.body.appendChild(mm); }
    mm.style.display = 'flex';
    render();
    layer = (window.AFK_UI && AFK_UI.openLayer) ? AFK_UI.openLayer(doClose) : null;
  }
  function close() {
    var mm = document.getElementById('rp-modal');
    if (mm && mm.classList.contains('rp-embed')) { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); return; }
    if (layer && window.AFK_UI) AFK_UI.closeLayer(layer); else doClose();
  }
  // 從燃柳村 NPC 進來：放進遊戲本身的 NPC 對話框（標題、關閉鈕、字體與其他 NPC 一致）
  function embed(div) {
    if (!P() || !div) return;
    if (!document.getElementById('rp-modal')) build();
    var mm = document.getElementById('rp-modal');
    mm.classList.add('rp-embed'); div.innerHTML = ''; div.appendChild(mm); mm.style.display = 'block';
    render();
  }
  function doClose() { layer = null; var m = document.getElementById('rp-modal'); if (m) m.style.display = 'none'; }

  // 入口：遺物收集冊頁首（放在「整理重複遺物」旁）＋自動化分頁的外掛列
  if (typeof window.renderRelicBook === 'function') {
    var oBook = window.renderRelicBook;
    window.renderRelicBook = function () {
      var r = oBook.apply(this, arguments);
      try {
        var host = document.getElementById('relic-book-body');
        if (host && !host.querySelector('#rp-open')) {
          css();
          var b = document.createElement('button'); b.id = 'rp-open'; b.type = 'button'; b.className = 'rp-open'; b.textContent = '🔨 遺物合成（+1～+15）';
          b.addEventListener('click', open); host.insertBefore(b, host.firstChild);
        }
      } catch (e) {}
      return r;
    };
  }
  // 燃柳村 NPC「哈瑪大師」：點了直接打開遺物強化視窗
  try {
    var town = DB.towns && DB.towns.town_gludio;
    if (town && Array.isArray(town.npcs) && !town.npcs.some(function (x) { return x.id === 'npc_hama'; })) {
      town.npcs.push({ id: 'npc_hama', n: '哈瑪大師', title: '遺物強化', type: 'relicsmith',
        d: '鑽研古老遺物數十年的工匠大師，能把同款遺物熔鑄合一，喚醒沉睡其中的力量。武器與防具最高 +15，戒指、耳環等飾品最高 +5。' });
    }
    if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED.npc_hama) NPC_SPR_FIXED.npc_hama = '1768';   // 矮人鐵匠外型（與火焰鐵匠同款）
  } catch (e) {}
  if (typeof window.interactNPC === 'function') {
    var oNpc = window.interactNPC;
    window.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      if (npcId === 'npc_hama') { try { embed(document.getElementById('interaction-content')); } catch (e) {} }
      return r;
    };
  }

  var navTimer = setInterval(function () {
    var row = document.getElementById('m-afk-navrow');
    if (!row) return;
    if (!document.getElementById('m-afk-nav-relicplus')) {
      var b = document.createElement('button'); b.id = 'm-afk-nav-relicplus'; b.type = 'button';
      b.className = 'btn py-2 text-sm bg-slate-700 hover:bg-slate-600 border-slate-500'; b.style.width = '100%'; b.style.marginTop = '8px';
      b.textContent = '🔨 遺物合成'; b.addEventListener('click', open); row.appendChild(b);
    }
    clearInterval(navTimer);
  }, 2000);

  // ── +10 以上遺物的出血：疊滿 20 層時，所有層持續 30 秒 ──
  if (typeof window.applyBleed === 'function') {
    var oBleed = window.applyBleed;
    window.applyBleed = function (m, hitDmg, maxLayers) {
      var r = oBleed.apply(this, arguments);
      try { if (maxLayers >= 20 && m && m.bleeds && m.bleeds.length >= 20) m.bleeds.forEach(function (b) { if (b.ticksLeft < 300) b.ticksLeft = 300; }); } catch (e) {}
      return r;
    };
  }
  // ── 持續傷害上限：中毒＋出血對同一隻怪，每秒最多扣牠最大 HP 的 1%（核心補丁 17 呼叫；玩家 2026-10-21 選定）──
  window.__afkDotCap = function (m, dmg) {
    try {
      if (!m || !(dmg > 0)) return dmg;
      var sec = Math.floor(((typeof state !== 'undefined' && state && state.ticks) || 0) / 10);
      if (m._dotSec !== sec) { m._dotSec = sec; m._dotUsed = 0; }
      var cap = Math.max(1, Math.floor((Number(m.hp) || Number(m.curHp) || 0) * 0.01));
      var allow = Math.max(0, Math.min(dmg, cap - (m._dotUsed || 0)));
      m._dotUsed = (m._dotUsed || 0) + allow;
      return allow;
    } catch (e) { return dmg; }
  };

  // 幸運暴走兔腳：可以戴兩個，遺物掉落判定 ×2 → 兩個 ×4（核心補丁 16 讀這個函式）
  window.__afkRelicDropMult = function () {
    try {
      if (typeof player === 'undefined' || !player || player._allyName || (typeof _recomputingAlly !== 'undefined' && _recomputingAlly) || !player.eq) return 1;
      var c = 0; for (var k in player.eq) { var it = player.eq[k], d = it && DB.items[it.id]; if (d && d.relicDropX2) c++; }
      return c ? Math.pow(2, c) : 1;
    } catch (e) { return 1; }
  };

  window.__afkRelicPlus = { hamaAttr: hamaAttr, ascend: ascend, ascCost: ascCost, craftStardust: craftStardust, open: open, upgrade: upgrade, groups: groups, ensure: ensure, exchange: exchange, embed: embed, evolve: evolve, equippedEvo: equippedEvo, EVO: EVO, buildDef: buildDef, costOf: costOf, donorsFor: donorsFor, makeId: makeId };
  console.log('[AFK-relicplus] 已啟用：遺物合成（武器 +1～+15）');
})();
