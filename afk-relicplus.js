/* ============================================================================
 * afk-relicplus.js — 遺物合成（武器遺物 +1～+15，玩家 2026-10-20 指定）
 *
 * 合成規則
 *   ‧+1～+10：兩個「同款、同強化值」的遺物合成一個高一級的
 *       做出 +1～+6：每次 500 龍鑽＋5,000 萬金幣
 *       做出 +7～+10：每高一級再多 100 龍鑽＋1,000 萬（+7＝600／6,000 萬 … +10＝900／9,000 萬）
 *   ‧+11～+15：只用一個，每次 50,000 龍鑽，成功率 10%，失敗遺物不會消失
 *   ‧+15 上限（之後的「進化」另外規劃）
 *   ‧目前只開放武器遺物；只看背包（不含倉庫、不含穿在身上的）；上鎖的不列入
 * 每一級的能力
 *   ‧每 +1：武器大小傷各 +1
 *   ‧每 +3：原本有的白字能力（近距命中、近距傷害、屬性點…）各 +1
 *   ‧每 +5：原本遺物特效的機率 +5%（中毒、觸發技能、連擊…；匕首／單手矛的出血每秒比例也 +5%）
 *       ※「一擊必殺」這類以小數表示的極低機率不加
 *   ‧+10：從同類武器（同一個圖鑑分類，例如匕首）的其他遺物，隨機繼承一種特效（只加原本沒有的欄位）
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
  var ID_RE = /relic_[a-z0-9_]+~r\d{1,2}(?:~relic_[a-z0-9_]+)?/g;
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
  var maxOf = function (base) { var d = DB.items[base]; return (d && d.type === 'acc') ? 5 : 15; };

  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var parseId = function (id) {
    var m = /^(relic_[a-z0-9_]+)~r(\d{1,2})(?:~(relic_[a-z0-9_]+))?$/.exec(String(id || ''));
    if (!m) return null;
    return { base: m[1], n: Math.min(MAX, parseInt(m[2], 10)), fx: m[3] || null };
  };
  var baseOf = function (id) { var p = parseId(id); return p ? p.base : id; };
  var levelOf = function (id) { var p = parseId(id); return p ? p.n : 0; };
  var fxOf = function (id) { var p = parseId(id); return p ? p.fx : null; };
  var makeId = function (base, n, fx) { return n <= 0 ? base : base + '~r' + n + (fx ? '~' + fx : ''); };
  var catOf = function (id) { try { return equipCatKey(id, DB.items[id]); } catch (e) { return null; } };

  // ── 衍生物品定義 ──
  function buildDef(base, n, fx) {
    var b = DB.items[base];
    var d = clone(b);
    d.relicBase = base; d.relicPlus = n; d.relicFx = fx || null;
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
      if (hasEffect(b)) {
        // 每 +5：遺物特效 +5%
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
        if (b.fireNullify) d.fireNullifyTicks = 50;                         // 火焰化解每 10 秒 → 每 5 秒
      } else {
        // 沒有特效的遺物：每 +5 四屬性抗性 +10
        RES4.forEach(function (f) { d[f] = (Number(b[f]) || 0) + 10 * k5; });
      }
      try { if (b.type === 'wpn' && typeof weaponHasBleed === 'function' && weaponHasBleed(base)) d.relicBleedBonus = r; } catch (e) {}
    }
    var fxName = '';
    if (fx && DB.items[fx]) {
      var donor = DB.items[fx];
      Object.keys(donor).forEach(function (f) { if (!NOT_FX.has(f) && !(f in b)) d[f] = clone(donor[f]); });
      fxName = donor.n;
    }
    d.d = (b.d || '') + ' 〔遺物合成 +' + n + '〕' + (fxName ? '〔繼承「' + fxName + '」的特效〕' : '');
    return d;
  }
  function ensure(id) {
    if (DB.items[id]) return true;
    var p = parseId(id);
    if (!p || !KIND_OK(DB.items[p.base]) || p.n > maxOf(p.base)) return false;
    if (p.fx && !DB.items[p.fx]) p.fx = null;
    var def = buildDef(p.base, p.n, p.fx);
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
        if (d && d.relicPlus) { var i = s.lastIndexOf('>' + d.n); if (i >= 0) s = s.slice(0, i + 1) + '+' + d.relicPlus + ' ' + s.slice(i + 1); }
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
      if (id === base || !d || !isRelic(d) || d.type !== b.type || catOf(id) !== ck) return false;
      return Object.keys(d).some(function (f) { return !NOT_FX.has(f) && !(f in b); });
    });
  }

  // ── 背包資料 ──
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var affixScore = function (it) { return (it.bless ? 1 : 0) + (it.anc ? 1 : 0) + (it.attr ? 1 : 0); };
  function groups() {
    var p = P(); if (!p) return [];
    var map = {};
    (p.inv || []).forEach(function (it) {
      if (!it || it.lock || !it.id) return;
      var base = baseOf(it.id), d = DB.items[base];
      if (!KIND_OK(d)) return;
      var n = levelOf(it.id), key = base + '|' + n + '|' + (fxOf(it.id) || '');
      var g = map[key] || (map[key] = { key: key, base: base, n: n, fx: fxOf(it.id), cnt: 0, stacks: [] });
      g.cnt += Math.max(1, Math.floor(Number(it.cnt) || 1)); g.stacks.push(it);
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return (b.n - a.n) || ((DB.items[a.base].n || '') < (DB.items[b.base].n || '') ? -1 : 1); });
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
        got.push({ bless: it.bless || false, anc: it.anc || false, attr: it.attr || false });
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

  // ── 能力預覽 ──
  function statLine(d, base) {
    var b = DB.items[base], out = b.type === 'wpn' ? ['大小傷 ' + d.dmgS + '/' + d.dmgL] : ['AC ' + (d.ac || 0) + '、MR ' + (d.mr || 0)];
    ['er', 'dr', 'hpR', 'mpR'].forEach(function (f) { if ((d[f] || 0) !== (b[f] || 0)) out.push(f + ' ' + (b[f] || 0) + '→' + d[f]); });
    if ((d.resFire || 0) !== (b.resFire || 0)) out.push('四屬性抗性 +' + ((d.resFire || 0) - (b.resFire || 0)));
    if (d.highestAttrPlus && d.highestAttrPlus !== b.highestAttrPlus && d.highestAttrPlus !== true) out.push('主屬性強化 +' + d.highestAttrPlus);
    if (d.fireNullifyTicks) out.push('火焰化解每 ' + d.fireNullifyTicks / 10 + ' 秒');
    WHITE.forEach(function (f) { if (typeof b[f] === 'number' && b[f] !== 0 && d[f] !== b[f]) out.push(f + ' ' + b[f] + '→' + d[f]); });
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
      '.rp-empty{padding:30px;text-align:center;color:#64748b}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function build() {
    css();
    var m = document.createElement('div'); m.id = 'rp-modal';
    m.innerHTML = '<div class="rp-box"><div class="rp-head">🔨 遺物合成<span class="rp-bal" id="rp-bal"></span><button class="rp-x" type="button" id="rp-x">✕</button></div>'
      + '<div class="rp-rule">兩個同款同強化值合成高一級：做出 +1～+6 每次 500 鑽＋5,000 萬；+7～+10 每級再多 100 鑽＋1,000 萬。+11～+15 單件強化：每次 5 萬鑽、成功率 10%，失敗不會消失。'
      + '<br>武器：每 +1 大小傷 +1、每 +3 白字各 +1。防具／飾品：每 +1 AC-1 與 MR+1、每 +3 ER+1、每 +5 傷害減免+1。'
      + '<br>共通：每 +5 遺物特效 +5%（沒有特效的改為四屬性抗性 +10）；HP／MP 恢復每 +1 多 1（本身 ≥50 的多 10）；+10 隨機繼承同部位遺物的一種特效。'
      + '<br>戒指、耳環、項鍊、腰帶最高 +5，每級要 3 個同級遺物、龍鑽與金幣 ×3，另需席琳結晶 500 顆。只計算背包裡未上鎖的遺物。</div>'
      + '<div class="rp-list" id="rp-list"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    document.getElementById('rp-x').onclick = close;
    document.getElementById('rp-list').addEventListener('click', function (e) {
      var b = e.target.closest('.rp-go'); if (!b || b.disabled) return;
      ask(b.getAttribute('data-k'));
    });
  }
  function render() {
    var bal = document.getElementById('rp-bal'); if (bal) bal.textContent = '龍鑽 ' + diamonds().toLocaleString() + '｜金幣 ' + gold().toLocaleString();
    var list = document.getElementById('rp-list'); if (!list) return;
    var gs = groups();
    if (!gs.length) { list.innerHTML = '<div class="rp-empty">背包裡沒有可以合成的武器遺物。</div>'; return; }
    list.innerHTML = gs.map(function (g) {
      var bd = DB.items[g.base], cur = DB.items[makeId(g.base, g.n, g.fx)] || bd;
      var mx = maxOf(g.base), t = g.n + 1, c = t <= mx ? costOf(t, g.base) : null, btn;
      if (!c) btn = '<button class="rp-go" disabled>已滿級 +' + mx + '</button>';
      else {
        var enough = g.cnt >= c.need && diamonds() >= c.dia && gold() >= c.gold && (!c.crystal || crystals() >= c.crystal);
        btn = '<button class="rp-go" type="button" data-k="' + esc(g.key) + '"' + (enough ? '' : ' disabled') + '>'
          + (c.merge ? '合成 +' + t : '強化 +' + t + '（10%）') + '<br><span style="font-weight:600;font-size:11px">' + c.dia.toLocaleString() + ' 鑽' + (c.gold ? '＋' + (c.gold / 10000).toLocaleString() + ' 萬' : '') + (c.crystal ? '＋結晶 ' + c.crystal : '') + (c.need > 2 ? '（' + c.need + ' 個）' : '') + '</span></button>';
      }
      var nextTxt = '';
      if (c) { var nid = makeId(g.base, t, g.fx); var nd = DB.items[nid] || buildDef(g.base, t, g.fx); nextTxt = '下一級：' + pretty(statLine(nd, g.base)) + (t === 10 && !g.fx && mx >= 10 ? '、隨機繼承同部位遺物特效' : ''); }
      var img = ''; try { img = getIconUrl(bd); } catch (e) {}
      return '<div class="rp-row"><img src="' + esc(img) + '" alt="" onerror="this.style.visibility=\'hidden\'">'
        + '<div class="rp-mid"><div class="rp-nm">' + (g.n ? '+' + g.n + ' ' : '') + esc(bd.n) + ' <span style="color:#94a3b8;font-weight:600">× ' + g.cnt + '</span></div>'
        + '<div class="rp-sub">目前：' + pretty(statLine(cur, g.base)) + (g.fx && DB.items[g.fx] ? '、已繼承「' + esc(DB.items[g.fx].n) + '」特效' : '') + '</div>'
        + (nextTxt ? '<div class="rp-sub" style="color:#fcd34d">' + esc(nextTxt) + '</div>' : '') + '</div>' + btn + '</div>';
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
  function open() {
    if (!P()) return;
    if (!document.getElementById('rp-modal')) build();
    document.getElementById('rp-modal').style.display = 'flex';
    render();
    layer = (window.AFK_UI && AFK_UI.openLayer) ? AFK_UI.openLayer(doClose) : null;
  }
  function close() { if (layer && window.AFK_UI) AFK_UI.closeLayer(layer); else doClose(); }
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

  // 幸運暴走兔腳：可以戴兩個，遺物掉落判定 ×2 → 兩個 ×4（核心補丁 16 讀這個函式）
  window.__afkRelicDropMult = function () {
    try {
      if (typeof player === 'undefined' || !player || player._allyName || (typeof _recomputingAlly !== 'undefined' && _recomputingAlly) || !player.eq) return 1;
      var c = 0; for (var k in player.eq) { var it = player.eq[k], d = it && DB.items[it.id]; if (d && d.relicDropX2) c++; }
      return c ? Math.pow(2, c) : 1;
    } catch (e) { return 1; }
  };

  window.__afkRelicPlus = { open: open, upgrade: upgrade, groups: groups, ensure: ensure, buildDef: buildDef, costOf: costOf, donorsFor: donorsFor, makeId: makeId };
  console.log('[AFK-relicplus] 已啟用：遺物合成（武器 +1～+15）');
})();
