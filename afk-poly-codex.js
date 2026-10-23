/* ==========================================================================
 * afk-poly-codex.js — 變身收集冊（玩家 2026-10-23 指定；參考天堂 M／R／奧丁的變身收藏）
 *
 * 收集對象：變形卷軸與變形控制戒指選得到的所有一般變身（含天堂透視鏡補的變身）
 * 三階：普通 → 銀 → 金；同一款要先登錄普通才會掉銀、登錄銀才會掉金。每個角色各自計算（player.polyDex）
 * 取得：
 *   ‧有同名怪物的變身：打倒該怪物時掉落
 *   ‧沒有同名怪物的變身（拉曼斯、侍、各種死亡騎士…）：打倒等級相差 5 級以內的怪物時，隨機抽一種、機率減半
 *   ‧機率：普通 0.3%、銀 0.1%、金 0.03%，乘上隊伍人數（你＋傭兵，最多 ×16）
 *   ‧掉到「下一階」直接登錄；同階或更低階的會變成卡片道具（金卡可拿去合成神話）
 * 持有效果（每階累加，最基礎的能力）：
 *   ‧每個變身每登錄一階：最大 HP +10，另外依變身輪一項：命中、額外傷害、魔防、HP 恢復、MP 恢復、防禦、遠距迴避、額外魔法點數 各 +1
 *   ‧系列（依變形卷軸的等級分組、控制戒指變身另成一組）全部登錄普通：HP +50、MP +30；全部銀：防禦 +2、魔防 +2；
 *     全部金：額外傷害、額外命中、額外魔法點數各 +2
 * 金卡登錄滿 5 種 → 開放查看神話變身卡冊（afk-card-codex）
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'poly-codex', name: '變身收集冊', desc: '打怪掉變身卡（普通／銀／金），登錄後永久加能力；金卡可合成神話變身。', group: '遊戲玩法', parent: 'card-ascension' });
  var enabled = function () { return !T || T.enabled('poly-codex'); };
  if (typeof POLY_TIERS === 'undefined' || typeof DB === 'undefined' || typeof window.killMob !== 'function') { console.warn('[AFK-poly-codex] 缺少變身或戰鬥資料，略過'); return; }

  var TIER_N = ['普通', '銀', '金'], TIER_IMG = ['assets/icons/items/普卡.png', 'assets/icons/items/銀卡.png', 'assets/icons/items/金卡.png'];
  var TIER_C = ['c-card-common', 'c-card-silver', 'c-card-gold'], RATE = [0.003, 0.001, 0.0003];
  var STATS = [['extraHit', '額外命中'], ['extraDmg', '額外傷害'], ['mr', '魔法防禦'], ['hpR', 'HP 自然恢復'], ['mpR', 'MP 自然恢復'], ['ac', '防禦'], ['er', '遠距離迴避'], ['extraMp', '額外魔法點數']];
  var hex = function (s) { return Array.from(s).map(function (c) { return c.codePointAt(0).toString(16); }).join('_'); };
  var itemId = function (name, t) { return 'afk_pcard_' + hex(name) + '_' + t; };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };

  // ── 收集名單與系列 ──
  var forms = [], byName = Object.create(null), series = [];
  POLY_TIERS.forEach(function (t, i) {
    var sr = { key: 's' + i, n: '變身 Lv' + t.min + (t.max >= 999 ? '+' : '～' + t.max), forms: [] }; series.push(sr);
    t.forms.forEach(function (f) { if (!f || byName[f.n]) return; var x = { n: f.n, lv: Number(f.lv) || 1, series: sr.key }; byName[f.n] = x; forms.push(x); sr.forms.push(f.n); });
  });
  var ctrl = { key: 'ctrl', n: '控制戒指變身', forms: [] }; series.push(ctrl);
  (typeof CONTROL_ONLY_POLY_FORMS !== 'undefined' ? CONTROL_ONLY_POLY_FORMS : []).concat(window.__afkPolyCatalog || []).forEach(function (f) {
    if (!f || byName[f.n]) return; var x = { n: f.n, lv: Number(f.lv) || 1, series: 'ctrl' }; byName[f.n] = x; forms.push(x); ctrl.forms.push(f.n);
  });
  if (!ctrl.forms.length) series.pop();
  forms.forEach(function (f, i) { f.stat = STATS[i % STATS.length]; });

  // 變身 ↔ 怪物
  var mobNames = Object.create(null);
  Object.keys(DB.mobs).forEach(function (k) { var m = DB.mobs[k]; if (m && m.n && !m.siegeEnemy && !m.pledgeEnemy && !m.trollPlayer) mobNames[m.n] = true; });
  forms.forEach(function (f) { f.hasMob = !!mobNames[f.n]; });
  var noMob = forms.filter(function (f) { return !f.hasMob; });

  // ── 卡片道具 ──
  forms.forEach(function (f) {
    for (var t = 1; t <= 3; t++) {
      var id = itemId(f.n, t);
      if (!DB.items[id]) DB.items[id] = { n: f.n + ' 變身' + TIER_N[t - 1] + '卡', type: 'misc', eff: 'afk_pcard', pcardTier: t, pcardForm: f.n, c: TIER_C[t - 1], img: TIER_IMG[t - 1], p: 0, gachaWeight: 0,
        d: ['薄薄一張，映著「' + f.n + '」模糊的身影。', '銀邊卡面上，「' + f.n + '」的輪廓清晰了起來。', '鍍金的卡面裡，「' + f.n + '」彷彿隨時會走出來。'][t - 1] + '使用後在變身收集冊登錄' + TIER_N[t - 1] + '階（要先登錄前一階）。' + (t === 3 ? '多出來的金卡可在燃柳村至幻者合成神話變身卡。' : '') };
      try { if (typeof MISC_BOOK_EXCLUDED !== 'undefined') MISC_BOOK_EXCLUDED[id] = true; } catch (e) {}
    }
  });

  // ── 資料 ──
  var dex = function (p) { p = p || P(); if (!p) return {}; if (!p.polyDex || typeof p.polyDex !== 'object' || Array.isArray(p.polyDex)) p.polyDex = {}; return p.polyDex; };
  var tierOf = function (name, p) { var v = Math.floor(Number(dex(p)[name]) || 0); return Math.max(0, Math.min(3, v)); };
  var goldCount = function (p) { var d = dex(p), n = 0; forms.forEach(function (f) { if ((d[f.n] || 0) >= 3) n++; }); return n; };
  var log = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var recalc = function () { try { if (typeof calcStats === 'function') calcStats(); } catch (e) {} };

  function register(name, t, quiet) {
    var p = P(); if (!p || !byName[name]) return false;
    if (tierOf(name, p) !== t - 1) return false;
    dex(p)[name] = t; recalc();
    if (!quiet) log('<span class="text-pink-300 font-bold">🃏 變身收集冊登錄「' + name + '」' + TIER_N[t - 1] + '卡！</span>' + (t === 3 && goldCount(p) === 5 ? '<span class="text-amber-300">（金卡滿 5 種，開放查看神話變身卡冊）</span>' : ''));
    return true;
  }
  // 使用卡片道具
  if (typeof window.useItem === 'function') {
    var oUse = window.useItem;
    window.useItem = function (uid) {
      var p = P(), it = p && (p.inv || []).find(function (i) { return i && i.uid === uid; }), d = it && DB.items[it.id];
      if (!d || d.eff !== 'afk_pcard') return oUse.apply(this, arguments);
      if (!enabled()) return;
      var cur = tierOf(d.pcardForm, p);
      if (d.pcardTier <= cur) { log('「' + d.pcardForm + '」已登錄' + TIER_N[cur - 1] + '階，這張卡可留著當合成材料。'); return; }
      if (d.pcardTier > cur + 1) { log('要先登錄「' + d.pcardForm + '」的' + TIER_N[cur] + '卡。'); return; }
      if (register(d.pcardForm, d.pcardTier)) {
        it.cnt = (Math.max(1, Math.floor(Number(it.cnt) || 1))) - 1;
        if (it.cnt <= 0) p.inv = p.inv.filter(function (x) { return x !== it; });
        try { if (typeof updateUI === 'function') updateUI(); if (typeof saveGame === 'function') saveGame(); } catch (e) {}
      }
    };
  }

  // ── 掉落 ──
  var partyMult = function () { var p = P(); if (!p) return 1; var n = 1 + (p.allies || []).filter(function (a) { return a && !a._downed; }).length; return Math.min(16, n); };
  function rollFor(f, mult) {
    var p = P(), cur = tierOf(f.n, p); var t = cur + 1;
    var goldDup = cur >= 3; if (goldDup) t = 3;   // 金卡登錄後仍會掉金卡（合成神話的材料）
    if (Math.random() >= RATE[t - 1] * mult) return;
    if (!goldDup && register(f.n, t)) return;
    try { if (typeof gainItem === 'function') gainItem(itemId(f.n, t), 1, true, true); } catch (e) {}
    log('<span class="text-pink-200">🃏 得到「' + f.n + ' 變身' + TIER_N[t - 1] + '卡」。</span>');
  }
  var oKill = window.killMob;
  window.killMob = function (idx) {
    var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null, was = !!(m && !m._dead);
    var r = oKill.apply(this, arguments);
    try {
      if (was && m._dead && enabled() && P() && !m.siegeEnemy && !m.pledgeEnemy && !m.trollPlayer && m.race !== '建築') {
        var pm = partyMult();
        if (byName[m.n] && byName[m.n].hasMob) rollFor(byName[m.n], pm);
        var lv = Number(m.lv) || 0, near = noMob.filter(function (f) { return Math.abs(f.lv - lv) <= 5; });
        if (near.length) rollFor(near[Math.floor(Math.random() * near.length)], pm * 0.5);
      }
    } catch (e) {}
    return r;
  };

  // ── 能力 ──
  function totals(p) {
    var out = { hp: 0, mp: 0, stats: {} }, d = dex(p);
    forms.forEach(function (f) { var t = Math.min(3, d[f.n] || 0); if (!t) return; out.hp += 10 * t; var k = f.stat[0]; out.stats[k] = (out.stats[k] || 0) + (k === 'ac' ? -t : t); });
    series.forEach(function (sr) {
      if (!sr.forms.length) return;
      var minT = 3; sr.forms.forEach(function (n) { minT = Math.min(minT, d[n] || 0); });
      if (minT >= 1) { out.hp += 50; out.mp += 30; }
      if (minT >= 2) { out.stats.ac = (out.stats.ac || 0) - 2; out.stats.mr = (out.stats.mr || 0) + 2; }
      if (minT >= 3) ['extraDmg', 'extraHit', 'extraMp'].forEach(function (k) { out.stats[k] = (out.stats[k] || 0) + 2; });
    });
    return out;
  }
  if (typeof window.recomputeStats === 'function') {
    var oRe = window.recomputeStats;
    window.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try { var p = P(); if (p && p.d && enabled()) { var t = totals(p); Object.keys(t.stats).forEach(function (k) { p.d[k] = (Number(p.d[k]) || 0) + t.stats[k]; }); } } catch (e) {}
      return r;
    };
  }
  if (window.__afkMaxAdd && window.__afkMaxAdd.add) window.__afkMaxAdd.add(function (p) {
    if (!enabled() || !p || !p.polyDex) return; var t = totals(p); p.mhp = (p.mhp || 0) + t.hp; p.mmp = (p.mmp || 0) + t.mp;
  });

  // ── 畫面（至幻者）──
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function render(host) {
    if (!host || !enabled()) return; var p = P(); if (!p) return;
    var old = host.querySelector('#afk-poly-codex'); if (old) old.remove();
    var d = dex(p), t = totals(p), reg = [0, 0, 0];
    forms.forEach(function (f) { var v = d[f.n] || 0; for (var i = 0; i < v; i++) reg[i]++; });
    var box = document.createElement('section'); box.id = 'afk-poly-codex'; box.className = 'afk-ca-panel';
    var statTxt = Object.keys(t.stats).map(function (k) { var nm = (STATS.find(function (s) { return s[0] === k; }) || [k, k])[1]; var v = t.stats[k]; return nm + ' ' + (k === 'ac' ? '+' + (-v) : (v > 0 ? '+' : '') + v); });
    var h = '<h3>變身收集冊</h3><p class="afk-lore">倒下的魔物會留下一縷形貌。收集它們，有一天你也能借用那份力量。</p><p>打怪會掉落變身卡，同一款依普通 → 銀 → 金登錄。金卡登錄 5 種後開放神話變身卡冊。</p>'
      + '<div>普通 <b>' + reg[0] + '</b>／銀 <b>' + reg[1] + '</b>／金 <b>' + reg[2] + '</b>（共 ' + forms.length + ' 種）</div>'
      + '<div style="color:#86efac">目前加成：最大 HP +' + t.hp + '、最大 MP +' + t.mp + (statTxt.length ? '、' + statTxt.join('、') : '') + '</div>';
    series.forEach(function (sr) {
      var minT = 3; sr.forms.forEach(function (n) { minT = Math.min(minT, d[n] || 0); });
      h += '<details' + (sr.forms.some(function (n) { return d[n]; }) ? ' open' : '') + '><summary><b>' + esc(sr.n) + '</b>　系列：' + (minT >= 3 ? '全金' : minT >= 2 ? '全銀' : minT >= 1 ? '全普通' : '未完成') + '</summary><div class="afk-pc-grid">';
      sr.forms.forEach(function (n) {
        var v = d[n] || 0, f = byName[n];
        h += '<span class="afk-pc-cell" style="opacity:' + (v ? 1 : .5) + ';color:' + ['#94a3b8', '#e2e8f0', '#cbd5e1', '#fde047'][v] + '" title="' + esc(f.stat[1]) + ' +' + v + '、HP +' + (10 * v) + '">' + esc(n) + ' ' + (v ? TIER_N[v - 1] : '—') + '</span>';
      });
      h += '</div></details>';
    });
    h += '<p>系列加成：全部普通 HP +50、MP +30；全部銀 防禦 +2、魔防 +2；全部金 額外傷害、命中、魔法點數各 +2。</p>';
    box.innerHTML = h; host.appendChild(box);
  }
  var st = document.createElement('style'); st.textContent = '.afk-pc-grid{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}.afk-pc-cell{font-size:12px;border:1px solid #334155;border-radius:6px;padding:2px 6px}#afk-poly-codex details{margin:6px 0}#afk-poly-codex summary{cursor:pointer}';
  document.head.appendChild(st);

  window.AFK_POLY_CODEX = { forms: forms, series: series, itemId: itemId, tierOf: tierOf, goldCount: goldCount, register: register, totals: totals, render: render, rollFor: rollFor, partyMult: partyMult, enabled: enabled };
  console.log('[AFK-poly-codex] 已啟用：變身收集冊 ' + forms.length + ' 種（' + noMob.length + ' 種由同等級怪物掉落）');
})();
