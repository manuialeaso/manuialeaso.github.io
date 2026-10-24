/* ============================================================================
 * afk-relicsell.js — 遺物：夢艷地獄詞條、商人收購、昇華支配分解（玩家 2026-10-21 指定）
 *
 * ‧瘋狂席琳夢艷地獄中打到的遺物（武器／防具／飾品）：
 *     遠古系詞條＋屬性五階 同時出現 0.1%；單獨遠古系詞條 1%、單獨屬性五階 1%；
 *     頭目掉的遺物必定同時帶遠古系詞條＋屬性五階。
 *     屬性只能存在於武器（遊戲讀檔會清掉防具／飾品上的屬性），所以防具／飾品只會拿到遠古系詞條。
 * ‧商人收遺物（販賣、自動賣出、一鍵賣出）：改付龍之鑽石，固定價 +0＝500，每 +1 多 100，最高算到 +15（2000）；昇華支配遺物以 +15 計。
 *   （安全區的龍鑽收購 NPC 也收 +0 遺物，出價 1～500 亂數，見 afk-buyerprice）
 * ‧昇華支配遺物（+0～+5）可以分解：換 1 顆自選的昇華支配強化石（武器／防具／飾品）。
 * 須排在 afk-relicaffix、afk-relicplus、afk-dreamhell 之後。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('relicplus')) return;

  var ANC = [true, 'eternal', 'immortal', 'primordial'];
  var ELE = ['fr', 'wa', 'wi', 'ea'];
  var dream = function () { return !!(typeof player !== 'undefined' && player && player.sherineDream && player.sherineMad); };
  var R = function (k) { try { return (typeof lootRng === 'function') ? lootRng(k) : Math.random(); } catch (e) { return Math.random(); } };
  var pick = function (a, r) { return a[Math.min(a.length - 1, Math.floor(r * a.length))]; };

  // ── 夢艷地獄：遺物詞條 ──
  var oAff = window.__afkRelicAffix;
  window.__afkRelicAffix = function (d, id) {
    var base = (typeof oAff === 'function') ? oAff.apply(this, arguments) : null;
    try {
      if (!dream() || !d || !d.relic || d.isArrow || (d.type !== 'wpn' && d.type !== 'arm' && d.type !== 'acc')) return base;
      var info = (typeof _lootMobInfo !== 'undefined') ? _lootMobInfo : null;
      if (!info) return base;   // 只算打怪掉的
      var both = !!info.boss || R('drelicab') < 0.001;
      var anc = both || R('drelica') < 0.01, attr = both || R('drelicx') < 0.01;
      if (!anc && !attr) return base;
      var out = base ? { bless: base.bless, anc: base.anc, attr: base.attr } : { bless: false, anc: false, attr: false };
      if (anc) out.anc = pick(ANC, R('drelicat'));
      if (attr && d.type === 'wpn') out.attr = pick(ELE, R('drelicxe')) + '5';
      return out;
    } catch (e) { return base; }
  };

  // ── 商人收購：龍之鑽石 ──
  var isRelicD = function (d) { return !!d && (d.relic || (typeof isRelic === 'function' && isRelic(d))); };
  var relicPrice = function (d) {
    var lv = (d.relicAsc != null) ? 15 : Math.max(0, Math.min(15, Number(d.relicPlus) || 0));
    return 500 + 100 * lv;
  };
  var addDia = function (n) {
    try { var r = window.pandoraAdjustSharedDiamonds(n) || {}; return !!r.ok; } catch (e) { return false; }
  };
  if (typeof window.sellItem === 'function') {
    var oSell = window.sellItem;
    window.sellItem = function (uid, count) {
      var it = player.inv.find(function (i) { return i.uid === uid; }), d = it && DB.items[it.id];
      if (!it || it.lock || !isRelicD(d) || (d.type !== 'wpn' && d.type !== 'arm' && d.type !== 'acc')) return oSell.apply(this, arguments);
      var n = Math.max(1, Math.min(count || 1, it.cnt || 1)), got = n * relicPrice(d);
      if (!addDia(got)) { logSys('<span class="text-red-400">龍之鑽石帳戶暫時無法寫入，沒有賣出。</span>'); return; }
      var wasGrant = !!d.grantSkills;
      it.cnt = (it.cnt || 1) - n;
      if (it.cnt <= 0) { player.inv = player.inv.filter(function (i) { return i.uid !== uid; }); try { closeModal(); } catch (e) {} }
      else { try { openModal(it, false); } catch (e) {} }
      logSys('商人收下了 ' + n + ' 個' + d.n + '，付給你 <span class="text-cyan-300 font-bold">' + got + ' 龍之鑽石</span>。');
      try { renderTabs(); updateUI(); if (wasGrant) { calcStats(); renderSkillSelects(); } saveGame(); } catch (e) {}
    };
  }

  // ── 自動賣出／一鍵賣出：遺物同樣付龍之鑽石（固定價；玩家 2026-10-24「商人收遺物是指快速賣出」）──
  var selling = false;
  var relicEq = function (d) { return isRelicD(d) && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc'); };
  if (typeof window.getSellPrice === 'function') {
    var oPrice = window.getSellPrice;
    window.getSellPrice = function (item) {
      if (selling && relicEq(item && DB.items[item.id])) return 0;
      return oPrice.apply(this, arguments);
    };
  }
  if (typeof window.autoSellJunk === 'function') {
    var oAuto = window.autoSellJunk;
    window.autoSellJunk = function (manual) {
      var before = {}, held = [];
      (player && player.inv || []).forEach(function (i) { var d = i && DB.items[i.id]; if (i && i.junk && !i.lock && relicEq(d)) before[i.uid] = { cnt: i.cnt || 1, p: relicPrice(d), it: i }; });
      if (!Object.keys(before).length) return oAuto.apply(this, arguments);
      if (typeof window.pandoraAdjustSharedDiamonds !== 'function') {   // 龍鑽帳戶不在：這輪先不賣遺物，免得白白賣掉
        Object.keys(before).forEach(function (u) { held.push(before[u].it); before[u].it.junk = false; });
        try { return oAuto.apply(this, arguments); } finally { held.forEach(function (i) { i.junk = true; }); }
      }
      selling = true;
      var r;
      try { r = oAuto.apply(this, arguments); } finally { selling = false; }
      var left = {}; (player.inv || []).forEach(function (i) { if (i && before[i.uid]) left[i.uid] = i.cnt || 0; });
      var dia = 0, n = 0;
      Object.keys(before).forEach(function (u) { var sold = before[u].cnt - (left[u] != null ? left[u] : 0); if (sold > 0) { dia += sold * before[u].p; n += sold; } });
      if (dia > 0) {
        if (addDia(dia)) logSys('<span class="text-cyan-300">' + (manual ? '一鍵賣出' : '系統自動賣出') + '的 ' + n + ' 個遺物改付龍之鑽石：<span class="font-bold">' + dia + '</span> 顆。</span>');
        else logSys('<span class="text-red-400">龍之鑽石帳戶暫時無法寫入，' + n + ' 個遺物的 ' + dia + ' 顆龍鑽沒有入帳。</span>');
      }
      return r;
    };
  }

  // ── 昇華支配遺物分解 ──
  var STONES = [['afk_asc_stone_wpn', '武器'], ['afk_asc_stone_arm', '防具'], ['afk_asc_stone_acc', '飾品']];
  window.afkAscDecompose = function (uid, stone) {
    var it = player.inv.find(function (i) { return i.uid === uid; }), d = it && DB.items[it.id];
    if (!it || !d || d.relicAsc == null) return { ok: false, msg: '只有昇華支配遺物可以分解。' };
    if (it.lock) return { ok: false, msg: '鎖定的物品不能分解。' };
    if (!STONES.some(function (s) { return s[0] === stone; }) || !DB.items[stone]) return { ok: false, msg: '請選擇要換的強化石。' };
    if (typeof state !== 'undefined' && state && state.ff) return { ok: false, msg: '補跑中，請稍候再試。' };
    it.cnt = (it.cnt || 1) - 1;
    if (it.cnt <= 0) player.inv = player.inv.filter(function (i) { return i.uid !== uid; });
    gainItem(stone, 1, true, true);
    logSys('<span class="text-fuchsia-300 font-bold">' + (typeof getItemFullName === 'function' ? getItemFullName(it) : d.n) + ' 在熔爐中瓦解，凝成了一顆' + DB.items[stone].n + '。</span>');
    try { closeModal(); renderTabs(true); updateUI(); saveGame(); } catch (e) {}
    return { ok: true };
  };
  if (typeof window.openModal === 'function') {
    var oModal = window.openModal;
    window.openModal = function (item, isEq) {
      var r = oModal.apply(this, arguments);
      try {
        var d = item && DB.items[item.id], box = document.getElementById('modal-actions');
        if (!d || !box || isEq || item.lock) return r;
        if (isRelicD(d) && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc')) {
          var p = relicPrice(d);
          box.querySelectorAll('button').forEach(function (b) {
            var oc = b.getAttribute('onclick') || '';
            if (oc.indexOf('sellItem(') === 0) b.textContent = (b.textContent.indexOf('全部') >= 0 ? '全部賣出' : '販賣') + '（' + p + ' 龍鑽／個）';
          });
        }
        if (d.relicAsc != null) {
          STONES.forEach(function (s) {
            if (!DB.items[s[0]]) return;
            var b = document.createElement('button');
            b.className = 'btn border-fuchsia-700 bg-fuchsia-950 hover:bg-fuchsia-900 text-fuchsia-200 py-2 text-sm font-bold';
            b.textContent = '分解→強化石(' + s[1] + ')';
            b.addEventListener('click', function () { var res = window.afkAscDecompose(item.uid, s[0]); if (!res.ok) logSys('<span class="text-amber-300">' + res.msg + '</span>'); });
            box.appendChild(b);
          });
        }
      } catch (e) {}
      return r;
    };
  }
  window.__afkRelicSell = { price: function (id) { return relicPrice(DB.items[id]); } };
  console.log('[AFK-relicsell] 已啟用：夢艷地獄遺物詞條、商人收遺物、昇華支配分解');
})();
