/* ============================================================================
 * afk-ancient.js — 古代藥水系列＋席琳夢域鏡補血 ×1.5（玩家 2026-10-25 指定；2026-10-28 由 ×3 降為 ×1.5）
 *
 * 古代藥水（天堂透視鏡：古代體力恢復劑系列；本作補量依原作 ×10）
 *   古代體力恢復劑       100～160   2,000 金幣
 *   古代強力體力恢復劑   160～480   6,000 金幣
 *   古代終極體力恢復劑   480～540   20,000 金幣
 *   另有 30／45／300 瓶裝的藥水包（開啟得到藥水）
 *   商店：所有賣白色藥水的商人；喝藥水的下拉選單也能選（傭兵、寵物共用隊長的設定）
 *
 * 席琳夢域鏡：所有治癒藥水的「基礎補量」×1.5（面板「藥水恢復量」旁顯示）
 *   例：古代終極 480～540 → 720～810；之後才算體質／娃娃加成、轉生 ×3、命運迴響等，最後才是四龍的死亡藥水
 * ========================================================================== */
(function () {
  'use strict';
  if (typeof DB === 'undefined' || !DB.items) return;
  var POTS = [
    ['potion_heal_anc1', '古代體力恢復劑', 100, 160, 2000, 'text-rose-300', '古代體力恢復劑.png', '古代人以失傳的鍊金術調配的治癒藥水，玻璃瓶上刻著已經沒人讀得懂的文字。'],
    ['potion_heal_anc2', '古代強力體力恢復劑', 160, 480, 6000, 'text-amber-300', '古代強力體力恢復劑.png', '古代戰士出征前一定會帶上的濃縮藥劑，喝下時能聽見遠方戰鼓的回音。'],
    ['potion_heal_anc3', '古代終極體力恢復劑', 480, 540, 20000, 'text-sky-200', '古代終極體力恢復劑.png', '據說是殷海薩的神官為聖戰調製的秘藥。瓶底沉著一點點不會溶解的光。']
  ];
  POTS.forEach(function (x) {
    if (DB.items[x[0]]) return;
    DB.items[x[0]] = { n: x[1], type: 'pot', req: 'all', p: x[4], c: x[5], val: Math.round((x[2] + x[3]) / 2), valMin: x[2], valMax: x[3], gachaWeight: 0,
      img: 'assets/icons/items/' + x[6], d: x[7] + '恢復 ' + x[2] + '～' + x[3] + ' 點體力（天堂透視鏡：古代體力恢復劑系列）。席琳夢域鏡中基礎補量 ×1.5。' };
  });
  var PACKS = [['potion_anc_pack2_30', 'potion_heal_anc2', 30], ['potion_anc_pack3_30', 'potion_heal_anc3', 30], ['potion_anc_pack2_45', 'potion_heal_anc2', 45], ['potion_anc_pack3_45', 'potion_heal_anc3', 45], ['potion_anc_pack2_300', 'potion_heal_anc2', 300], ['potion_anc_pack3_300', 'potion_heal_anc3', 300]];
  PACKS.forEach(function (x) {
    var t = DB.items[x[1]]; if (!t || DB.items[x[0]]) return;
    DB.items[x[0]] = { n: t.n + x[2] + '個包', type: 'etc', p: Math.round(t.p * x[2] * 0.95), c: t.c, gachaWeight: 0, eff: 'afk_pack', afkPack: { id: x[1], n: x[2] }, img: t.img,
      d: '用皮繩捆好的一包' + t.n + '。開啟能獲得' + t.n + ' ' + x[2] + ' 個。' };
  });
  if (typeof window.useItem === 'function') {
    var oUse = window.useItem;
    window.useItem = function (u) {
      try {
        var it = (player.inv || []).find(function (i) { return i && i.uid === u; }), d = it && DB.items[it.id];
        if (d && d.afkPack && DB.items[d.afkPack.id]) {
          it.cnt = (it.cnt || 1) - 1;
          if (it.cnt <= 0) player.inv = player.inv.filter(function (i) { return i.uid !== u; });
          gainItem(d.afkPack.id, d.afkPack.n, true, true);
          logSys('你解開了' + d.n + '，得到 ' + DB.items[d.afkPack.id].n + ' ×' + d.afkPack.n + '。');
          try { if (typeof closeModal === 'function') closeModal(); renderTabs(); updateUI(); saveGame(); } catch (e) {}
          return;
        }
      } catch (e) {}
      return oUse.apply(this, arguments);
    };
  }
  // 商店：賣白色藥水的商人一起賣古代藥水與藥水包
  if (typeof window.getShopItemsForNpc === 'function') {
    var oShop = window.getShopItemsForNpc;
    window.getShopItemsForNpc = function () {
      var r = oShop.apply(this, arguments);
      try { if (r && r.indexOf('potion_ult') >= 0) { var add = POTS.map(function (x) { return x[0]; }).concat(PACKS.map(function (x) { return x[0]; })).filter(function (id) { return DB.items[id] && r.indexOf(id) < 0; }); var at = r.indexOf('potion_ult') + 1; r = r.slice(0, at).concat(add, r.slice(at)); } } catch (e) {}
      return r;
    };
  }
  // 喝藥水的下拉選單
  try {
    var sel = document.getElementById('set-pot');
    if (sel) POTS.forEach(function (x) { if (sel.querySelector('option[value="' + x[0] + '"]')) return; var o = document.createElement('option'); o.value = x[0]; o.textContent = x[1]; o.className = x[5]; sel.appendChild(o); });
  } catch (e) {}

  // ── 席琳夢域鏡：治癒藥水基礎補量 ×1.5 ──
  var dreamOn = function () { try { return !!(player && player.sherineDream && player.sherineMad); } catch (e) { return false; } };
  var DREAM_POT = 1.5;
  if (typeof window.potionHealBase === 'function') {
    var oPHB = window.potionHealBase;
    window.potionHealBase = function () { var v = oPHB.apply(this, arguments); return dreamOn() ? Math.floor(v * DREAM_POT) : v; };
  }
  if (typeof window._updateUIImpl === 'function') {
    var oUI = window._updateUIImpl;
    window._updateUIImpl = function () {
      var r = oUI.apply(this, arguments);
      try {
        var el = document.getElementById('dt-potion'); if (!el) return r;
        var base = (player.rebirth > 0 ? 3 : 1) * (dreamOn() ? DREAM_POT : 1);
        if (base > 1) { var t = String(el.textContent).replace(/\s*·.*$/, '') + ' · 基礎 ×' + base + (dreamOn() ? '（夢域）' : ''); if (el.textContent !== t) el.textContent = t; }
      } catch (e) {}
      return r;
    };
  }
  window.__afkAncient = { POTS: POTS.map(function (x) { return x[0]; }), PACKS: PACKS.map(function (x) { return x[0]; }), DREAM_POT: DREAM_POT };
  console.log('[AFK-ancient] 已啟用：古代藥水系列、席琳夢域鏡藥水 ×1.5');
})();
