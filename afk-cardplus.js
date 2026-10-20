/* ============================================================================
 * afk-cardplus.js — 白金卡／鑽石卡、圖鑑全滿夢艷 ×3、鑽白金幻化（玩家 2026-10-21 指定）
 *
 * 卡片新增兩階（在金卡之上）：
 *   ‧白金卡：瘋狂席琳（含夢艷地獄）中掉落；鑽石卡：只有瘋狂席琳夢艷地獄掉落
 *   ‧掉落率沿用卡片「每高一階 ÷10」的舊規則：普 0.1%、銀 0.01%、金 0.001%、白金 0.0001%、鑽石 0.00001%
 *     只乘隊伍人數（最高 ×8），不吃席琳／夢艷地獄的掉落倍率
 *   ‧地區完成加成「往上一階」：照該地區原本每一階的增加幅度再加（例：AC 1/2/3 → 白金 4、鑽石 5；HP 3/5/10 → 15、20）
 *   ‧圖鑑積分：白金 = 1000、鑽石 = 10000（沿用原本的共用圖鑑桶，只增不減，跨角色共用）
 *   ‧取得白金／鑽石卡：該怪還沒到這一階 → 自動登錄；已經到了 → 實體卡進背包
 *
 * 圖鑑全滿 ×3（只在瘋狂席琳夢艷地獄、只算你本人）：
 *   ‧裝備收集冊所有部位全收集、道具收集冊所有類別全收集 → 各自的完成加成 ×3
 *   ‧卡片：全部怪物都到白金卡 → 卡片地區加成 ×3
 *   ‧白金卡全滿另外解鎖夢艷地獄的昇華支配強化石／碎片掉落（在 afk-dreamhell.js）
 *
 * 鑽白金幻化（暗夢星迴 0.01%）：使用後自選任一隻怪，獲得牠的鑽石卡。
 * 核心掛點：補丁 20（卡片冊顯示五階）；其餘包 rollCardDrops／acquireCard／useCardItem／cardDexTier／cardRegionTier／各圖鑑加成函式／useItem。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('cardplus')) return;
  if (typeof CARD_TIERS === 'undefined' || typeof CARD_MOB_INFO === 'undefined' || typeof window.acquireCard !== 'function') {
    console.warn('[AFK-cardplus] 找不到卡片系統，略過'); return;
  }

  // ── 新階級 ──
  var PLUS = [
    { t: 4, key: 'w', sfx: '白金卡', col: 'c-card-plat', img: 'assets/icons/items/白金卡.png', price: 100000, weight: 0, score: 1000, rate: 0.000001 },
    { t: 5, key: 'd', sfx: '鑽石卡', col: 'c-card-diamond', img: 'assets/icons/items/鑽石卡.png', price: 1000000, weight: 0, score: 10000, rate: 0.0000001 }
  ];
  PLUS.forEach(function (x) { if (!CARD_TIERS[x.t - 1]) CARD_TIERS.push({ t: x.t, key: x.key, sfx: x.sfx, col: x.col, img: x.img, price: x.price, weight: x.weight }); });
  try {
    var st = document.createElement('style');
    st.textContent = '.c-card-plat{color:#e2e8f0;text-shadow:0 0 7px #94a3b8}.c-card-diamond{color:#67e8f9;text-shadow:0 0 8px #06b6d4}';
    document.head.appendChild(st);
  } catch (e) {}
  Object.keys(CARD_MOB_INFO).forEach(function (nm) {
    PLUS.forEach(function (x) {
      var id = cardId(nm, x.t);
      if (DB.items[id]) return;
      DB.items[id] = { n: nm + ' 的' + x.sfx, type: 'misc', eff: 'card', cardTier: x.t, cardMob: nm, c: x.col, img: x.img, p: x.price, gachaWeight: 0,
        d: '怪物卡片。使用以在卡片收集冊中登錄「' + nm + '」（' + x.sfx + '效果）。' };
    });
  });
  // 地區完成加成往上一階
  CARD_REGIONS.forEach(function (r) {
    if (!r.vals || r.vals.length !== 3) return;
    var step = (r.vals[2] - r.vals[1]) || 1;
    r.vals.push(r.vals[2] + step, r.vals[2] + 2 * step);
  });

  // ── 階級判定 ──
  var SCORE = { 4: 1000, 5: 10000 };
  var oTier = window.cardDexTier;
  window.cardDexTier = function (name) {
    var s = (player && player.cardDex && player.cardDex[name]) || 0;
    if (s >= 10000) return 5;
    if (s >= 1000) return 4;
    return oTier.apply(this, arguments);
  };
  window.cardRegionTier = function (key) {
    var names = CARD_REGION_MOBS[key]; if (!names || !names.length) return 0;
    var minT = 5;
    for (var i = 0; i < names.length; i++) { var t = cardDexTier(names[i]); if (t < minT) minT = t; if (minT === 0) return 0; }
    return minT;
  };
  var platCache = { at: 0, v: false };
  var platFull = function () {
    var now = Date.now();
    if (now - platCache.at < 2000) return platCache.v;
    var names = Object.keys(CARD_MOB_INFO), ok = names.length > 0;
    for (var i = 0; i < names.length && ok; i++) if (cardDexTier(names[i]) < 4) ok = false;
    platCache = { at: now, v: ok };
    return ok;
  };
  var bump = function () { platCache.at = 0; };
  var setScore = function (name, t) {
    if (!player.cardDex) player.cardDex = {};
    if ((player.cardDex[name] || 0) < SCORE[t]) player.cardDex[name] = SCORE[t];
    bump();
    try { saveCardDex(); } catch (e) {}
    try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
    try { if (typeof _cardBookOpen !== 'undefined' && _cardBookOpen && typeof renderCardBook === 'function') renderCardBook(); } catch (e) {}
  };

  // ── 取得／使用 ──
  var oAcq = window.acquireCard;
  window.acquireCard = function (name, tier, count) {
    if (tier < 4) return oAcq.apply(this, arguments);
    count = Math.max(1, count || 1);
    if (!DB.items[cardId(name, tier)]) return;
    if (cardDexTier(name) >= tier) { gainItem(cardId(name, tier), count); return; }
    setScore(name, tier);
    if (count > 1) gainItem(cardId(name, tier), count - 1);
    var ct = CARD_TIERS[tier - 1];
    try { logSys('<span class="' + ct.col + ' font-bold">🎴 自動登錄「' + name + '」（' + ct.sfx + '）！</span>'); } catch (e) {}
  };
  var oUse = window.useCardItem;
  window.useCardItem = function (item) {
    var d = DB.items[item.id];
    if (!d || !(d.cardTier >= 4)) return oUse.apply(this, arguments);
    var nm = d.cardMob, ct = CARD_TIERS[d.cardTier - 1];
    if (cardDexTier(nm) >= d.cardTier) { logSys('<span class="' + ct.col + ' font-bold">「' + nm + '」</span><span class="text-slate-400"> 已經登錄到' + ct.sfx + '（或更高），無法使用。</span>'); try { closeModal(); } catch (e) {} return; }
    var c = Math.max(1, Math.floor(Number(item.cnt) || 1));
    if (c > 1) item.cnt = c - 1; else player.inv = player.inv.filter(function (i) { return i.uid !== item.uid; });
    setScore(nm, d.cardTier);
    logSys('<span class="' + ct.col + ' font-bold">卡片收集冊登錄了「' + nm + '」（' + ct.sfx + '）！</span>');
    try { renderTabs(true); updateUI(); saveGame(); closeModal(); } catch (e) {}
  };

  // ── 掉落 ──
  var oRoll = window.rollCardDrops;
  window.rollCardDrops = function (mob) {
    var r = oRoll.apply(this, arguments);
    try {
      if (!mob || !mob._sherineMad || mob.race === '血盟' || mob.race === '建築' || mob.transformTo) return r;
      var nm = (typeof CARD_DROP_ALIAS !== 'undefined' && CARD_DROP_ALIAS[mob.n]) || mob.n;
      if (!CARD_MOB_INFO[nm]) return r;
      var pool = (typeof CARD_CHAIN_BY_FINAL !== 'undefined' && CARD_CHAIN_BY_FINAL[nm]) || null;
      if (mob._dream) _cardDropRoll(nm, 5, PLUS[1].rate, pool);
      _cardDropRoll(nm, 4, PLUS[0].rate, pool);
    } catch (e) {}
    return r;
  };

  // ── 圖鑑全滿：夢艷地獄 ×3 ──
  var dreamOn = function () { return !!(window.__afkDreamHell && window.__afkDreamHell.on()); };
  var equipFull = function () { try { return EQUIP_CATEGORIES.every(function (c) { return equipCatComplete(c.key); }); } catch (e) { return false; } };
  var miscFull = function () { try { return MISC_CATEGORIES.every(function (c) { return miscCatComplete(c.key); }); } catch (e) { return false; } };
  var snap = function (o) { var s = {}; for (var k in o) { if (typeof o[k] === 'number') s[k] = o[k]; } return s; };
  var triple = function (fnName, full, resets) {
    var orig = window[fnName]; if (typeof orig !== 'function') return;
    window[fnName] = function (p, d) {
      if (!(p === player && d && dreamOn() && full())) return orig.apply(this, arguments);
      resets.forEach(function (rz) { (rz[0] === 'p' ? p : d)[rz[1]] = 0; });
      var bp = snap(p), bd = snap(d);
      var r = orig.apply(this, arguments);
      [[p, bp], [d, bd]].forEach(function (pair) {
        var o = pair[0], b = pair[1];
        for (var k in o) { if (typeof o[k] !== 'number') continue; var delta = o[k] - (b[k] || 0); if (delta) o[k] += 2 * delta; }
      });
      return r;
    };
  };
  triple('cardCollectionBonus', platFull, [['d', '_cardWeightBonus']]);
  triple('equipCollectionBonus', equipFull, [['d', '_equipWeightBonus'], ['p', '_equipPetHit']]);
  triple('miscCollectionBonus', miscFull, [['d', '_miscWeightBonus'], ['p', '_miscPotionBonus']]);

  // ── 鑽白金幻化 ──
  DB.items.afk_card_pick = DB.items.afk_card_pick || { n: '鑽白金幻化', type: 'misc', eff: 'afk_card_pick', c: 'c-card-diamond', img: PLUS[1].img, p: 0, gachaWeight: 0,
    d: '暗夢星迴頭目 0.01% 掉落。使用後可以自選任一隻怪物，獲得牠的鑽石卡（未登錄會自動登錄到鑽石卡）。' };
  var pickLayer = null;
  var closePick = function () { var m = document.getElementById('afk-cardpick'); if (m) m.remove(); if (pickLayer && window.AFK_UI) { try { AFK_UI.closeLayer(pickLayer); } catch (e) {} } pickLayer = null; };
  var openPick = function (uid) {
    closePick();
    var names = Object.keys(CARD_MOB_INFO).sort(function (a, b) { return (CARD_MOB_INFO[a].mob.lv || 0) - (CARD_MOB_INFO[b].mob.lv || 0); });
    var m = document.createElement('div'); m.id = 'afk-cardpick';
    m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(2,6,23,.75);display:flex;align-items:center;justify-content:center';
    m.innerHTML = '<div style="background:#0f172a;border:1px solid #0891b2;border-radius:12px;width:min(560px,94vw);max-height:84vh;display:flex;flex-direction:column;color:#e2e8f0">'
      + '<div style="padding:12px 14px;font-weight:700;color:#67e8f9;display:flex;justify-content:space-between">💎 鑽白金幻化：選一隻怪物獲得鑽石卡<button type="button" id="afk-cp-x" style="color:#94a3b8">✕</button></div>'
      + '<input id="afk-cp-q" placeholder="搜尋怪物名稱" style="margin:0 14px 8px;padding:6px 10px;border-radius:8px;border:1px solid #334155;background:#020617;color:#e2e8f0">'
      + '<div id="afk-cp-list" style="overflow:auto;padding:0 14px 14px;display:flex;flex-wrap:wrap;gap:6px"></div></div>';
    document.body.appendChild(m);
    var list = m.querySelector('#afk-cp-list');
    var draw = function (q) {
      list.innerHTML = names.filter(function (n) { return !q || n.indexOf(q) >= 0; }).slice(0, 400).map(function (n) {
        var t = cardDexTier(n);
        return '<button type="button" data-n="' + n.replace(/"/g, '&quot;') + '" style="padding:4px 8px;border-radius:7px;border:1px solid #155e75;background:#083344;font-size:12px">' + n + ' <span style="color:#94a3b8">Lv' + (CARD_MOB_INFO[n].mob.lv || '?') + (t ? '・' + CARD_TIERS[t - 1].sfx : '') + '</span></button>';
      }).join('') || '<div style="color:#64748b">找不到</div>';
    };
    draw('');
    m.querySelector('#afk-cp-q').addEventListener('input', function (e) { draw(e.target.value.trim()); });
    m.querySelector('#afk-cp-x').onclick = closePick;
    m.addEventListener('click', function (e) { if (e.target === m) closePick(); });
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-n]'); if (!b) return;
      var nm = b.getAttribute('data-n');
      var go = function () { pickCard(uid, nm); closePick(); };
      var msg = '用鑽白金幻化換取「' + nm + ' 的鑽石卡」？';
      if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '鑽白金幻化', message: msg, okText: '確定', cancelText: '取消', onOk: go });
      else if (confirm(msg)) go();
    });
    pickLayer = (window.AFK_UI && AFK_UI.openLayer) ? AFK_UI.openLayer(closePick) : null;
  };
  var pickCard = function (uid, nm) {
    var it = player.inv.find(function (i) { return i.uid === uid; });
    if (!it || it.id !== 'afk_card_pick' || !CARD_MOB_INFO[nm]) return false;
    var c = Math.max(1, Math.floor(Number(it.cnt) || 1));
    if (c > 1) it.cnt = c - 1; else player.inv = player.inv.filter(function (i) { return i.uid !== uid; });
    acquireCard(nm, 5, 1);
    try { logSys('<span class="c-card-diamond font-bold">💎 鑽白金幻化成了「' + nm + ' 的鑽石卡」！</span>'); } catch (e) {}
    try { renderTabs(true); updateUI(); saveGame(); } catch (e) {}
    return true;
  };
  var oUseItem = window.useItem;
  window.useItem = function (u, silent) {
    var it = (player && player.inv) ? player.inv.find(function (i) { return i.uid === u; }) : null;
    if (it && it.id === 'afk_card_pick') { if (!silent) { try { closeModal(); } catch (e) {} openPick(u); } return; }
    return oUseItem.apply(this, arguments);
  };

  window.__afkCardPlus = { platFull: platFull, equipFull: equipFull, miscFull: miscFull, pickCard: pickCard, openPick: openPick, bump: bump };
  console.log('[AFK-cardplus] 已啟用：白金／鑽石卡、圖鑑全滿夢艷 ×3、鑽白金幻化');
})();
