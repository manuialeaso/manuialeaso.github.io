/* ============================================================================
 * afk-buyerprice.js — 收購 NPC 新規則（玩家 2026-10-20 指定）
 *
 * 玩家 2026-10-24：收購 NPC 一律在「1～原定價」之間亂數出價；賣給商人（含自動賣出、一鍵賣出）才是固定價。
 *   龍鑽收購另外也收遺物（+0）：1～500 顆（500＝商人收 +0 遺物的固定價）。
 * 金幣收購（「收」）——以下是各類的上限（原定價），實際出價 1～上限
 *   ‧可強化裝備：低於安定值 200 萬；剛好安定值 500 萬；安定值以上每 +1 再加 500 萬
 *       例：精靈鏈甲(安定 6) +0～+5＝200 萬、+6＝500 萬、+8＝1500 萬；飾品(安定 0) +0＝500 萬、+1＝1000 萬
 *     金幣收購最高只收到 +9（+10 以上改由龍鑽收購）
 *   ‧不能強化的東西（材料、藥水、7 級以下法術書…）維持原本定價：物品基本價 × 1～50 倍
 *   ‧卡片、8 級以上法術書不再用金幣收（改龍鑽）
 * 龍鑽收購（「鑽收」）收四類（實際出價 1～上限）：
 *   ‧8 級以上法術書：上限 8 級 50、9 級 100、10 級 300 顆
 *   ‧+10 以上裝備：+10＝100 顆，之後每 +1 再加 10 顆（只挑強化上限 ≥10 的裝備，飾品上限 +5 不會出現）
 *   ‧怪物卡片：普卡 100、銀卡 500、金卡 1000 顆
 *   ‧遺物（+0、實際掉得到的）：500 顆
 * 每位收購者停留 1 小時（原本 2 小時）＝收購物品每小時換一輪。
 * 物品池依 AFK_ROTATION 的 6 區塊切開，每 4 小時換一批想收的東西。
 * 「身上強化值比要求高也能賣、照要求的價格算」由既有的 afk-buyercompat 負責（確認視窗會寫清楚）。
 *
 * 掛點：核心補丁 14 的 window.__afkWandererMake(buyer, helpers)，只在叫賣者「剛生成」時改寫一次；
 *   已在場的叫賣者不變。隨機數用核心的種子亂數（helpers.rand），多開分頁結果一致。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('buyerprice')) return;

  var LIFE_MS = 60 * 60 * 1000;
  var M = 10000;
  var GOLD_LOW = 200 * M, GOLD_SAFE = 500 * M, GOLD_STEP = 500 * M;
  var BOOK_RANGE = { 8: [10, 50], 9: [50, 100], 10: [200, 300] };
  var CARD_REWARD = { p: 100, s: 500, g: 1000 };
  var RELIC_TOP = 500;   // 遺物 +0 的商人收購價（afk-relicsell：+0＝500、每 +1 多 100）

  var D = function (id) { return (typeof DB !== 'undefined' && DB.items) ? DB.items[id] : null; };
  var isCard = function (d) { return !!(d && d.eff === 'card'); };
  var bookTier = function (d) {
    if (!d || d.type !== 'skillbk' || !d.sk || typeof DB === 'undefined' || !DB.skills || !DB.skills[d.sk]) return 0;
    return Math.floor(Number(DB.skills[d.sk].tier) || 0);
  };
  var capOf = function (d) { try { return enhanceCap(d); } catch (e) { return 10; } };

  // 規則本身（也給測試／小百科用）
  function goldPriceFor(d, en, safe) {
    en = Math.max(0, Math.floor(Number(en) || 0));
    if (en < safe) return GOLD_LOW;
    return GOLD_SAFE + (en - safe) * GOLD_STEP;
  }
  function diamondEquipReward(en) { return 100 + Math.max(0, en - 10) * 10; }

  // 實際掉得到的物品（避免收根本拿不到的東西）
  var _obtainable = null;
  function obtainable() {
    if (_obtainable) return _obtainable;
    var set = new Set();
    var add = function (tbl) { if (!tbl) return; Object.keys(tbl).forEach(function (k) { (tbl[k] || []).forEach(function (e) { var id = Array.isArray(e) ? e[0] : e; if (id) set.add(id); }); }); };
    try { add(MOB_DROPS); } catch (e) {}
    try { add(DARK_WEAPON_DROPS); } catch (e) {}
    try { add(DARK_CRYSTAL_DROPS); } catch (e) {}
    try { add(DRAGON_DROPS); } catch (e) {}
    try { add(WARRIOR_DROPS); } catch (e) {}
    try { add(MEM_DROPS); } catch (e) {}
    Object.keys(DB.items).forEach(function (id) { var d = DB.items[id]; if (d && Number(d.gachaWeight) > 0) set.add(id); });
    _obtainable = set;
    return set;
  }

  var pools = null;
  function buildPools(h) {
    if (pools) return pools;
    var ob = obtainable();
    var gold = [], book = [], equip = [], relic = [], card = { p: [], s: [], g: [] };
    Object.keys(DB.items).forEach(function (id) {
      var d = DB.items[id];
      if (d && d.n && d.relic && !d.gmOnly && id.indexOf('~') < 0 && !d.isArrow && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') && ['pet', 'petwpn', 'petarm', 'doll'].indexOf(d.slot) < 0 && ob.has(id)) { relic.push(id); return; }
      if (!d || !d.n || d.relic) return;
      var w = Math.floor(Number(d.gachaWeight) || 0);
      if (isCard(d)) { var k = (id.match(/^card_([psg])_/) || [])[1]; if (k) card[k].push(id); return; }
      var bt = bookTier(d);
      if (bt >= 8) { if (ob.has(id)) book.push(id); return; }
      if (w >= 1 && w <= 80) gold.push(id);
      if (h.isEnhanceable(d) && capOf(d) >= 10 && w >= 1 && w <= 80) equip.push(id);
    });
    pools = { gold: gold, book: book, equip: equip, card: card, relic: relic };
    return pools;
  }

  function inBlock(list) {
    var R = window.AFK_ROTATION;
    if (!R) return list;
    var b = R.block();
    var sub = list.filter(function (id) { return R.bucketOf(id) === b; });
    return sub.length ? sub : list;
  }
  function pickWeighted(list, rnd) {
    var tot = 0, i;
    for (i = 0; i < list.length; i++) tot += Math.max(1, Number(D(list[i]).gachaWeight) || 1);
    var r = rnd * tot;
    for (i = 0; i < list.length; i++) { r -= Math.max(1, Number(D(list[i]).gachaWeight) || 1); if (r < 0) return list[i]; }
    return list[list.length - 1];
  }
  function pickUniform(list, rnd) { return list[Math.min(list.length - 1, Math.floor(rnd * list.length))]; }

  function makeGold(b, h) {
    var p = buildPools(h);
    var id = pickWeighted(inBlock(p.gold), h.rand('afk-bp-gold-item'));
    if (!id) return false;
    var d = D(id);
    b.itemId = id;
    b.weight = Math.max(1, Math.min(80, Math.floor(Number(d.gachaWeight) || 10)));
    if (h.isEnhanceable(d)) {
      var safe = h.safeValue(d);
      var max = Math.min(safe + 3, capOf(d), 9);
      b.en = Math.floor(h.rand('afk-bp-gold-en') * (max + 1));
      b.price = 1 + Math.floor(h.rand('afk-bp-gold-rnd') * goldPriceFor(d, b.en, safe));   // 玩家 2026-10-24：1～原定價亂數
    } else {
      b.en = null;
      var base = Math.max(1, Math.floor(Number(d.p) || 1));
      b.price = 1 + Math.floor(h.rand('afk-bp-gold-price') * base * 50);   // 原版定價方式
    }
    delete b.reward;
    return true;
  }

  function makeDiamond(b, h) {
    var p = buildPools(h);
    var roll = h.rand('afk-bp-dia-kind');
    var kind = roll < 0.30 ? 'book' : roll < 0.60 ? 'equip' : roll < 0.85 ? 'card' : 'relic';
    if (kind === 'relic' && !p.relic.length) kind = 'card';
    if (kind === 'book' && !p.book.length) kind = 'equip';
    if (kind === 'equip' && !p.equip.length) kind = 'card';
    var id, d;
    if (kind === 'book') {
      id = pickUniform(p.book, h.rand('afk-bp-book'));   // 法術書只有十幾本，不再依區塊切
      d = D(id);
      var r = BOOK_RANGE[Math.min(10, bookTier(d))] || BOOK_RANGE[8];
      b.en = null;
      b.reward = 1 + Math.floor(h.rand('afk-bp-book-r') * r[1]);   // 1～該級上限
    } else if (kind === 'equip') {
      id = pickWeighted(inBlock(p.equip), h.rand('afk-bp-equip'));
      d = D(id);
      var top = Math.min(13, capOf(d));
      var x = h.rand('afk-bp-equip-en');
      b.en = 10 + Math.floor(x * x * (top - 10 + 1));   // 越高越少見
      b.reward = 1 + Math.floor(h.rand('afk-bp-equip-r') * diamondEquipReward(b.en));
    } else if (kind === 'relic') {
      id = pickWeighted(inBlock(p.relic), h.rand('afk-bp-relic'));
      d = D(id);
      b.en = null;
      b.reward = 1 + Math.floor(h.rand('afk-bp-relic-r') * RELIC_TOP);   // +0 遺物：1～500（商人固定價）
    } else {
      var t = h.rand('afk-bp-card-tier');
      var key = t < 0.70 ? 'p' : t < 0.95 ? 's' : 'g';
      var list = p.card[key].length ? p.card[key] : p.card.p;
      if (!list.length) return false;
      id = pickUniform(inBlock(list), h.rand('afk-bp-card'));
      key = (id.match(/^card_([psg])_/) || [])[1] || 'p';
      d = D(id);
      b.en = null;
      b.reward = 1 + Math.floor(h.rand('afk-bp-card-r') * CARD_REWARD[key]);
    }
    b.itemId = id;
    b.weight = Math.max(1, Math.min(10, Math.floor(Number(d.gachaWeight) || 10)));
    delete b.price;
    return true;
  }

  window.__afkWandererMake = function (b, h) {
    if (!b || !h || typeof DB === 'undefined' || !DB.items) return;
    var ok = b.currency === 'gold' ? makeGold(b, h) : makeDiamond(b, h);
    if (!ok) return;   // 池子空了 → 保留原版內容
    b.expiresAt = (Number(b.spawnedAt) || Date.now()) + LIFE_MS;
  };

  window.__afkBuyerPrice = { RELIC_TOP: RELIC_TOP, CARD_REWARD: CARD_REWARD, goldPriceFor: goldPriceFor, diamondEquipReward: diamondEquipReward, pools: function () { return pools; } };
  console.log('[AFK-buyerprice] 已啟用：收購 NPC 新定價（1～原定價亂數；+10／8 級書／卡片／遺物收龍鑽、每小時換一輪）');
})();
