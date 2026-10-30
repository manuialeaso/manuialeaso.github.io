/* ============================================================================
 * afk-arrowsmith.js — 箭矢工匠「門蘇」（歐瑞村莊；玩家 2026-10-30 16:27；外掛開關 arrowsmith，預設開；經典模式看不到）
 *
 *   屬性箭矢（火／水／風／地，每種都用對應的「X之淨化石」）：
 *     X靈的箭              ＝ 淨化石 50＋金幣 50 萬                → 1,000 支
 *     X靈的黃金箭          ＝ 淨化石 50＋黃金 50＋金幣 100 萬        → 500 支
 *     X靈的奧裡哈魯根箭    ＝ 淨化石 50＋奧里哈魯根 50＋金幣 100 萬  → 500 支
 *     X靈的黑色米索莉箭    ＝ 淨化石 50＋黑色米索莉 50＋金幣 100 萬  → 500 支（原作已有的道具）
 *   箭矢袋（一袋 10,000 支，0.7 組材料）：
 *     X靈的箭袋            ＝（淨化石 50＋50 萬）×7       ＝ 淨化石 350＋金幣 350 萬
 *     X靈的黃金箭袋…       ＝（淨化石 50＋材料 50＋100 萬）×14 ＝ 淨化石 700＋材料 700＋金幣 1,400 萬
 *   箭的數值：X靈的箭 傷害 8／7；黃金 9／9；奧裡哈魯根 12／12（對不死追加）；黑色米索莉 11／15；全部命中時追加該屬性傷害 +3（同原作的屬性箭）。
 *   幸運的箭：只能打怪掉落（門蘇不做）。
 *   箭的消耗順序：裝備中的箭 → 背包裡「同一種」箭 → 打開同一種箭的箭矢袋（自動，一次 10,000 支）→ 背包裡其他箭（核心）→ 自動購買銀箭（核心，有勾才會）。
 *   箭矢袋也可以手動打開。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, L = W.__afkLore;
  if (T && T.register) T.register({ id: 'arrowsmith', name: '箭矢工匠 門蘇（歐瑞村莊）', group: '遊戲內容',
    desc: '用屬性淨化石製作屬性箭矢與一萬支的箭矢袋；箭用完時自動打開同一種箭的箭矢袋' });
  var on = function () { return !T || T.enabled('arrowsmith'); };
  if (!L || typeof DB === 'undefined' || !DB.items || !DB.towns) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = L.esc, sys = L.sys;

  var ELE = [['fire', '火', 'ttmi_14526'], ['water', '水', 'ttmi_14527'], ['wind', '風', 'ttmi_14528'], ['earth', '地', 'ttmi_14529']];
  var BM = { water: 'ttmi_14118', wind: 'ttmi_14119', earth: 'ttmi_14120', fire: 'ttmi_14121' };   // 原作已有的屬性黑色米索莉箭
  var icon = function (id, fb) { var d = DB.items[id]; try { return d ? (d.img || getIconUrl(d)) : fb; } catch (e) { return fb; } };
  var TIERS = [
    { k: 'plain', label: '屬性箭', n: '靈的箭', dmgS: 8, dmgL: 7, mat: null, out: 1000, gold: 500000, stones: 50, bagMul: 7, img: 'assets/icons/weapons/銀箭.png' },
    { k: 'gold', label: '屬性黃金箭', n: '靈的黃金箭', dmgS: 9, dmgL: 9, mat: 'ttmi_1041', out: 500, gold: 1000000, stones: 50, matCnt: 50, bagMul: 14, imgFrom: 'ttmi_1368' },
    { k: 'ori', label: '屬性奧裡哈魯根箭', n: '靈的奧裡哈魯根箭', dmgS: 12, dmgL: 12, unBonus: true, mat: 'new_item_173', out: 500, gold: 1000000, stones: 50, matCnt: 50, bagMul: 14, imgFrom: 'ttmi_1375' },
    { k: 'bm', label: '屬性黑色米索莉箭', n: '靈的黑色米索莉箭', mat: 'mat_black_mithril', out: 500, gold: 1000000, stones: 50, matCnt: 50, bagMul: 14, existing: true }
  ];
  var BAG_CNT = 10000, BAG_IMG = 'assets/icons/weapons/改造便利箭筒.png';
  var arrowId = function (t, ele) { return t.existing ? BM[ele] : 'afk_arw_' + (t.k === 'plain' ? '' : t.k + '_') + ele; };
  var bagId = function (t, ele) { return 'afk_arwbag_' + t.k + '_' + ele; };
  var BAG_OF = {}, ARROW_BAG = {};
  ELE.forEach(function (e) {
    TIERS.forEach(function (t) {
      var aid = arrowId(t, e[0]);
      if (!t.existing) {
        L.addItem(aid, { n: e[1] + t.n, type: 'wpn', isArrow: true, dmgS: t.dmgS, dmgL: t.dmgL, hit: 0, safe: 0, noEnhance: true, req: 'all', p: t.k === 'plain' ? 50 : 100,
          unBonus: !!t.unBonus || undefined, onHitEleDmg: { ele: e[0], dmg: 3, rate: 100 }, c: 'text-sky-200', img: t.img || icon(t.imgFrom, 'assets/icons/weapons/箭.png'),
          d: '箭矢工匠門蘇用' + DB.items[e[2]].n + '做的箭。命中時追加' + e[1] + '屬性傷害 +3' + (t.unBonus ? '，對不死系追加傷害' : '') + '。' });
        try { if (typeof ITEM_WEIGHTS !== 'undefined' && ITEM_WEIGHTS[e[1] + t.n] == null) ITEM_WEIGHTS[e[1] + t.n] = 0.05; } catch (er) {}
      }
      var bid = bagId(t, e[0]), an = DB.items[aid] ? DB.items[aid].n : e[1] + t.n;
      L.addItem(bid, { n: an + '袋', type: 'misc', eff: 'afk_arrowbag', afkArrowBag: aid, p: 0, req: 'all', c: 'text-sky-300', img: BAG_IMG,
        d: '裝著 ' + BAG_CNT.toLocaleString() + ' 支「' + an + '」的箭矢袋。打開（使用）就會拿到箭；身上的' + an + '用完時也會自動打開。' });
      try { if (typeof ITEM_WEIGHTS !== 'undefined' && ITEM_WEIGHTS[an + '袋'] == null) ITEM_WEIGHTS[an + '袋'] = 20; } catch (er) {}
      BAG_OF[bid] = aid; ARROW_BAG[aid] = bid;
    });
  });

  // ── 背包工具 ──
  var have = function (id) { var p = P(); if (!p) return 0; if (id === 'gold') return Number(p.gold) || 0; return (p.inv || []).reduce(function (s, it) { return s + (it && it.id === id && !it.lock ? (Number(it.cnt) || 1) : 0); }, 0); };
  var take = function (id, n) {
    var p = P(); if (id === 'gold') { p.gold -= n; return; }
    for (var i = p.inv.length - 1; i >= 0 && n > 0; i--) {
      var it = p.inv[i]; if (!it || it.id !== id || it.lock) continue;
      var c = Number(it.cnt) || 1, use = Math.min(c, n); n -= use;
      if (c - use > 0) it.cnt = c - use; else p.inv.splice(i, 1);
    }
  };
  // 一筆配方（N 次）的需求
  var needOf = function (t, ele, kind, times) {
    var mul = kind === 'bag' ? t.bagMul : 1, stone = ELE.filter(function (e) { return e[0] === ele; })[0][2], out = [];
    out.push([stone, t.stones * mul * times]);
    if (t.mat) out.push([t.mat, t.matCnt * mul * times]);
    out.push(['gold', t.gold * mul * times]);
    return out;
  };
  var canMake = function (t, ele, kind) { var n = Infinity; needOf(t, ele, kind, 1).forEach(function (q) { n = Math.min(n, Math.floor(have(q[0]) / q[1])); }); return Math.max(0, n === Infinity ? 0 : n); };
  var make = function (tk, ele, kind, times) {
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲' };
    if (!on()) return { ok: false, msg: '門蘇今天不開工' };
    if (p.classicMode) return { ok: false, msg: '經典模式不開放' };
    var t = TIERS.filter(function (x) { return x.k === tk; })[0]; if (!t || !ARROW_BAG[arrowId(t, ele)]) return { ok: false, msg: '沒有這種箭' };
    times = Math.max(1, Math.floor(Number(times) || 1));
    var need = needOf(t, ele, kind, times), lack = need.filter(function (q) { return have(q[0]) < q[1]; })[0];
    if (lack) return { ok: false, msg: (lack[0] === 'gold' ? '金幣' : (DB.items[lack[0]] || {}).n) + '不足（要 ' + lack[1].toLocaleString() + '，身上 ' + have(lack[0]).toLocaleString() + '）' };
    need.forEach(function (q) { take(q[0], q[1]); });
    var aid = arrowId(t, ele), got = kind === 'bag' ? bagId(t, ele) : aid, cnt = kind === 'bag' ? times : t.out * times;
    gainItem(got, cnt, true, true);
    sys('<span class="text-sky-300">門蘇替你做好了「' + esc(DB.items[got].n) + '」×' + cnt.toLocaleString() + '。</span>');
    try { renderTabs(); updateUI(); saveGame(); } catch (e) {}
    return { ok: true, id: got, cnt: cnt };
  };

  // ── 箭矢袋：手動打開、箭用完自動打開 ──
  var openBag = function (it, silent) {
    var p = P(), aid = it && BAG_OF[it.id]; if (!p || !aid) return false;
    if ((Number(it.cnt) || 1) > 1) it.cnt = (Number(it.cnt) || 1) - 1; else p.inv.splice(p.inv.indexOf(it), 1);
    gainItem(aid, BAG_CNT, true, true);
    if (!silent) sys('<span class="text-sky-300">打開「' + esc(DB.items[it.id] ? DB.items[it.id].n : '箭矢袋') + '」：' + esc(DB.items[aid].n) + ' ×' + BAG_CNT.toLocaleString() + '。</span>');
    return true;
  };
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (uid) {
      var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uid; });
      if (it && BAG_OF[it.id] && !it.lock) {
        openBag(it);
        try { renderTabs(); updateUI(); saveGame(); if (typeof closeModal === 'function') closeModal(); } catch (e) {}
        return;
      }
      return oUse.apply(this, arguments);
    };
  }
  var stats = { refillSame: 0, bagOpened: 0 };
  if (typeof W.consumeArrow === 'function') {
    var oArrow = W.consumeArrow;
    W.consumeArrow = function () {
      var p = P();
      try {
        if (p && p.eq) {
          var cur = p.eq.arrow;
          if (cur && cur.cnt > 0) p._afkLastArrow = cur.id;
          else if (p._afkLastArrow) {
            var last = p._afkLastArrow;
            var same = (p.inv || []).find(function (x) { return x && x.id === last && !x.lock; });   // 1) 背包裡同一種箭
            if (same) { equipItem(same); stats.refillSame++; }
            else if (on() && ARROW_BAG[last]) {                                                       // 2) 同一種箭的箭矢袋
              var bag = (p.inv || []).find(function (x) { return x && x.id === ARROW_BAG[last] && !x.lock; });
              if (bag && openBag(bag, true)) {
                var fresh = p.inv.find(function (x) { return x && x.id === last; });
                if (fresh) { equipItem(fresh); stats.bagOpened++; if (typeof logSys === 'function') logSys('<span class="text-sky-300">箭用完了，自動打開「' + esc(DB.items[bag.id] ? DB.items[bag.id].n : '箭矢袋') + '」補上 ' + BAG_CNT.toLocaleString() + ' 支。</span>'); }
              }
            }
          }
        }
      } catch (e) {}
      return oArrow.apply(this, arguments);   // 3) 其他箭、自動購買：照核心
    };
  }

  // ── NPC 門蘇（歐瑞村莊）──
  var NPC_ID = 'npc_afk_mensu', NPC_N = '門蘇';
  L.addNpc('town_oren', { id: NPC_ID, n: NPC_N, title: '箭矢工匠', type: 'quest', classicHide: true,
    d: '歐瑞村莊的箭矢工匠，能把屬性淨化石鍛進箭頭裡，也替遠行的弓手把箭整袋裝好。' }, '1768', [16, 46]);
  var ui = { ele: 'fire' };
  var fmt = function (n) { return Number(n).toLocaleString(); };
  var render = function (div) {
    var p = P(); if (!p || !div) return;
    if (p.classicMode || !on()) { div.innerHTML = '<div class="text-sm text-slate-300">「抱歉，我的工房今天不開。」</div>'; return; }
    var e = ELE.filter(function (x) { return x[0] === ui.ele; })[0];
    var hh = '<div class="text-sm space-y-2" id="afk-mensu">'
      + '<div class="text-slate-300">「淨化石的力量鍛進箭頭，射出去就帶著元素。一千支一批；要整袋的話，一袋一萬支，算你七折。幸運的箭？那個我做不出來，只能從怪物身上找。」</div>'
      + '<div class="flex flex-wrap gap-2">' + ELE.map(function (x) { return '<button type="button" class="btn px-3 py-1 text-sm' + (x[0] === ui.ele ? ' font-bold' : '') + '" style="' + (x[0] === ui.ele ? 'outline:2px solid #38bdf8' : '') + '" data-ms="ele:' + x[0] + '">' + x[1] + '（' + esc(DB.items[x[2]].n) + ' ' + fmt(have(x[2])) + '）</button>'; }).join('') + '</div>';
    TIERS.forEach(function (t) {
      var aid = arrowId(t, e[0]), ad = DB.items[aid]; if (!ad) return;
      ['arrow', 'bag'].forEach(function (kind) {
        var need = needOf(t, e[0], kind, 1), n = canMake(t, e[0], kind), outN = kind === 'bag' ? '1 袋（' + fmt(BAG_CNT) + ' 支）' : fmt(t.out) + ' 支';
        var nm = kind === 'bag' ? DB.items[bagId(t, e[0])].n : ad.n;
        hh += '<div class="p-2 rounded border ' + (kind === 'bag' ? 'border-sky-800' : 'border-slate-700') + ' flex items-center justify-between gap-2"><span><img src="' + esc(kind === 'bag' ? BAG_IMG : (ad.img || icon(aid, ''))) + '" style="width:28px;height:28px;display:inline-block;vertical-align:middle;margin-right:6px"><b>' + esc(nm) + '</b> → ' + outN
          + '<br><small class="text-slate-400">' + need.map(function (q) { var ok = have(q[0]) >= q[1]; return '<span style="color:' + (ok ? '#cbd5e1' : '#fca5a5') + '">' + (q[0] === 'gold' ? '金幣' : esc((DB.items[q[0]] || {}).n || q[0])) + ' ' + fmt(q[1]) + '</span>'; }).join('、')
          + (kind === 'arrow' ? '・傷害 ' + ad.dmgS + '／' + ad.dmgL + '、' + e[1] + '屬性 +3' : '') + '</small></span>'
          + '<span style="white-space:nowrap;flex-shrink:0"><button type="button" class="btn px-2 py-1 text-xs"' + (n < 1 ? ' disabled' : '') + ' data-ms="make:' + t.k + ':' + kind + ':1">製作</button>'
          + ' <button type="button" class="btn px-2 py-1 text-xs"' + (n < 2 ? ' disabled' : '') + ' data-ms="make:' + t.k + ':' + kind + ':' + n + '">全部（' + n + '）</button></span></div>';
      });
    });
    hh += '<div class="text-xs text-slate-400">箭用完時的順序：裝備中的箭 → 背包裡同一種箭 → 自動打開同一種箭的箭矢袋 → 背包裡其他的箭 → 自動購買銀箭（有勾才會）。</div>';
    div.innerHTML = hh + '</div>';
    div.onclick = function (ev) {
      var b = ev.target.closest('[data-ms]'); if (!b || b.disabled) return;
      var v = b.getAttribute('data-ms').split(':');
      if (v[0] === 'ele') ui.ele = v[1];
      else if (v[0] === 'make') { var r = make(v[1], ui.ele, v[2], Number(v[3])); if (!r.ok) sys('<span class="text-amber-300">' + esc(r.msg) + '</span>'); }
      render(div);
    };
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try { if (npcId === NPC_ID) { var div = document.getElementById('interaction-content'); if (div) { div.onclick = null; render(div); } } } catch (e) { console.warn('[AFK-arrowsmith] ui', e); }
      return r;
    };
  }
  W.__afkArrowSmith = { ELE: ELE, TIERS: TIERS, BAG_CNT: BAG_CNT, NPC_ID: NPC_ID, arrowId: arrowId, bagId: bagId, needOf: needOf, make: make, have: have, openBag: openBag, render: render, stats: function () { return Object.assign({}, stats); } };
})();
