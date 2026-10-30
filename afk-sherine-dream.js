/* ============================================================================
 * afk-sherine-dream.js — 夢域席琳遺骸與「之魂」（玩家 2026-10-28 晚；外掛開關 sherinedream，預設開）
 *
 * 一、夢域遺骸：席琳夢域鏡的世界裡，席琳神殿「伊奧」可以把一件遺骸「夢域淬鍊」
 *      （席琳結晶 ×50＋夢艷結晶 ×10），部位與套裝不變，名字換成夢域的套裝名、改成瘋狂席琳的紅字。
 *      夢域遺骸跟原版算同一組件數；某一段門檻（2／3／5）若「夢域遺骸」的件數也達到，那一段改用夢域的強化效果。
 *      資料上 seteff＝組名＋「夢」（例如「紅獅夢」），slice(0,2) 仍是組名，核心的計件、顯示都照舊。
 * 二、之魂（第 9 格遺骸，rem_soul）：瘋狂席琳模式的謀叛者的低語裡每隻頭目 5% 掉落（2026-10-29 起只在瘋狂席琳，夢域鏡不掉）。
 *      2026-10-30 17:45 起：名字就叫「之魂」、不算任何套裝的件數；沒粹煉前看似沒有效果（說明：好像還需要些什麼）；
 *      伊奧「之魂粹煉」（席琳結晶 500＋夢艷結晶 500，不限世界）後才有效：所有席琳套裝需要的件數少 1（2／3／5 → 1／2／4），原版與夢域版都吃得到。
 *      伊奧不兌換之魂；裝備視窗第二頁右上角（核心補丁 65）與裝備分頁都多一格。
 * 夢域效果的數值見 DREAM 表；只動數值的部分在 recomputeStats 之後加上，攻擊／受傷的倍率走 AFK_CARD_COMBAT.damage 與 __afkTakenMods。
 * 須排在 afk-relic-gm、afk-card-combat、afk-affix-plus、afk-traitor、afk-dreamhell 之後、afk-caps 之前。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'sherinedream', name: '夢域席琳遺骸與之魂', group: '遊戲玩法',
    desc: '席琳夢域鏡裡可把席琳遺骸夢域淬鍊（紅字、效果大幅強化）；瘋狂席琳的謀叛者的低語頭目 5% 掉「之魂」' });
  if (T && !T.enabled('sherinedream')) return;
  if (typeof SHERINE_REMAINS === 'undefined' || typeof SHERINE_SET_TEXT === 'undefined' || !DB || !DB.items) { console.warn('[AFK-sherine-dream] 找不到席琳遺骸，略過'); return; }

  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var dreamOn = function () { var p = P(); return !!(p && p.sherineDream && p.sherineMad && !p.classicMode); };
  var SOUL = 'rem_soul', COST = { crystal: 50, dream: 10 }, SOUL_COST = { crystal: 500, dream: 500 }, SOUL_RATE = 0.05;   // 之魂粹煉：席琳結晶 500＋夢艷結晶 500（玩家 2026-10-30 17:45）

  // ── 夢域套裝名 ──
  var DN = { '紅獅': '血獅', '白鳥': '冥鴉', '鐵衛': '冥鐵', '麗人': '魅姬', '疾風': '狂嵐', '月光': '血月', '學徒': '祭司', '魔女': '夢魔', '暗影': '深淵', '幻覺': '迷夢', '龍血': '龍裔', '狂怒': '癲狂' };
  var isDream = function (it) { return !!(it && typeof it.seteff === 'string' && it.seteff.length >= 3 && it.seteff.charAt(it.seteff.length - 1) === '夢'); };
  var grp = function (it) { return it && it.seteff ? String(it.seteff).slice(0, 2) : null; };

  // ── 夢域效果（文字＋實作）：s＝面板數值（在原版之上再加），out＝造成傷害倍率（kind：all／melee／ranged／magic／phys），taken＝受到傷害倍率，leech＝物理吸血 ──
  var DREAM = {
    '紅獅': { 2: { t: '額外傷害 +50、額外魔法點數 +30', s: { extraDmg: 45, extraMp: 27 } }, 3: { t: '傷害減免 +50', s: { dr: 40 } }, 5: { t: '最終傷害 +30%（普攻與技能皆適用）', out: { all: 1.30 / 1.10 } } },
    '白鳥': { 2: { t: '額外命中 +50', s: { extraHit: 45 } }, 3: { t: '魅力 +30', s: { cha: 20 } }, 5: { t: '一般攻擊命中時使目標「脆弱」，受到的傷害 +30%', out: { all: 1.18 } } },
    '鐵衛': { 2: { t: 'AC −30、傷害減免 +30', s: { ac: -27, dr: 25 } }, 3: { t: '受到傷害減少 30%', taken: 0.875 }, 5: { t: '嘲諷，受嘲諷目標的一般攻擊傷害 −30%；另外受到的傷害再 −15%', taken: 0.85 } },
    '麗人': { 2: { t: '近距離傷害 +30、近距離命中 +30', s: { meleeDmg: 27, meleeHit: 27 } }, 3: { t: '近距離爆擊率 +15%、近距離爆擊傷害 +30%', s: { meleeCrit: 12, meleeCritDmg: 30 } }, 5: { t: '裝備近距離武器時，攻擊效率 +50%（近距離傷害 ×1.25）', out: { melee: 1.25 } } },
    '疾風': { 2: { t: '遠距離傷害 +30、遠距離命中 +30', s: { rangedDmg: 27, rangedHit: 27 } }, 3: { t: '遠距離爆擊率 +15%、遠距離爆擊傷害 +30%', s: { rangedCrit: 12, rangedCritDmg: 30 } }, 5: { t: '連射傷害 100%（遠距離傷害 ×1.3）', out: { ranged: 1.3 } } },
    '月光': { 2: { t: '額外傷害 +20、額外命中 +30', s: { extraDmg: 18, extraHit: 27 } }, 3: { t: 'ER +20、MR +100', s: { er: 15, mr: 90 } }, 5: { t: '造成傷害時使目標「碎裂」，傷害 ×1.15', out: { all: 1.15 } } },
    '學徒': { 2: { t: 'MP 自然恢復 +50、額外魔法點數 +60', s: { mpR: 45, extraMp: 54 } }, 3: { t: '魔法爆擊率 +15%', s: { magicCrit: 12 } }, 5: { t: 'MP 低於 30% 時技能耗魔減半；魔法傷害 ×1.2', out: { magic: 1.2 } } },
    '魔女': { 2: { t: '魔法傷害 +30', s: { magicDmg: 27 } }, 3: { t: '四屬性抗性 +100、額外魔法點數 +50', s: { resFire: 90, resWater: 90, resWind: 90, resEarth: 90, extraMp: 45 } }, 5: { t: '共鳴冰雪暴；魔法傷害 ×1.3', out: { magic: 1.3 } } },
    '暗影': { 2: { t: '額外傷害 +70', s: { extraDmg: 63 } }, 3: { t: '雙擊機率提升；近距離爆擊率 +10%', s: { meleeCrit: 10 } }, 5: { t: '雙擊傷害大幅提升（近距離傷害 ×1.3）', out: { melee: 1.3 } } },
    '幻覺': { 2: { t: '觸發魔法回 MP；魔法傷害 +20', s: { magicDmg: 20 } }, 3: { t: '輔助技能耗魔減半；額外魔法點數 +50', s: { extraMp: 50 } }, 5: { t: '觸發魔法追加傷害；魔法傷害 ×1.3', out: { magic: 1.3 } } },
    '龍血': { 2: { t: '造成物理傷害時恢復 5% 傷害的 HP', leech: 0.04 }, 3: { t: '龍裔：受到的傷害 −20%', taken: 0.8 }, 5: { t: '消耗 HP 的技能傷害提升；造成傷害 ×1.25', out: { all: 1.25 } } },
    '狂怒': { 2: { t: '負重上限 +500、最大 HP +5000', hp: 5000 }, 3: { t: '最大 HP +50%', hpPct: 1.5 / 1.2 }, 5: { t: 'HP 越低越強；造成傷害 ×1.15、受到傷害 ×0.88', out: { all: 1.15 }, taken: 0.88 } }
  };

  // ── 之魂 ──
  var srcIcon = (DB.items.rem_heart && DB.items.rem_heart.img) || 'assets/icons/items/靈魂之球.png';
  DB.items[SOUL] = { n: '之魂', type: 'acc', slot: SOUL, remains: true, noEnhance: true, noJunk: true, req: 'all', safe: 0, p: 0, gachaWeight: 0, img: srcIcon,
    d: '【席琳遺骸】謀叛者臨死前被瘋狂的席琳奪走的魂魄，凝成一顆仍在低語的遺骸。裝備於遺骸欄的第 9 格。' };
  // 玩家 2026-10-30 17:45：名字就叫「之魂」（不帶套裝詞）；不算任何套裝的件數；沒粹煉前看似沒有效果，
  //   到伊奧那裡「之魂粹煉」（席琳結晶 500＋夢艷結晶 500）後才發揮：所有席琳套裝需要的件數少 1。
  //   內部仍保留一個套裝詞（核心的遺骸欄需要），只是不顯示、不計件；粹煉過＝夢域版（seteff 結尾「夢」），之前用舊價淬鍊過的照樣算粹煉過。
  var SOUL_GROUP = function () { return (typeof SHERINE_EFFECTS !== 'undefined' && SHERINE_EFFECTS[0]) || '紅獅'; };
  if (!SHERINE_REMAINS.some(function (r) { return r.id === SOUL; })) SHERINE_REMAINS.push({ id: SOUL, n: '之魂', eqSlot: null, soul: true });
  var withoutSoul = function (fn) {   // 伊奧兌換與菈克希絲拆分不碰之魂
    var i = SHERINE_REMAINS.findIndex(function (r) { return r.id === SOUL; }), row = i >= 0 ? SHERINE_REMAINS.splice(i, 1)[0] : null;
    try { return fn(); } finally { if (row) SHERINE_REMAINS.push(row); }
  };
  ['renderIoExchange', 'doIoExchange'].forEach(function (k) {
    var o = W[k]; if (typeof o !== 'function') return;
    W[k] = function () { var self = this, args = arguments; return withoutSoul(function () { return o.apply(self, args); }); };
  });

  // 件數少 1：核心計件後（AFK_RELIC_GM.sherine 掛點）給每一組有件數的 +1
  var soulOn = function (p) { var e = p && p.eq && p.eq[SOUL]; return !!(e && e.seteff && isDream(e)); };   // 粹煉過才有效
  // 件數減免：之魂 1 ＋ 符文「魂」1（afk-runefx 的 W.__afkRuneSetCut，2026-10-29 晚：可以疊加），全身最多 −2
  var setCut = function (p) { var n = soulOn(p) ? 1 : 0; try { if (typeof W.__afkRuneSetCut === 'function') n += W.__afkRuneSetCut(p) || 0; } catch (e) {} return Math.min(2, n); };
  if (W.AFK_RELIC_GM && typeof W.AFK_RELIC_GM.sherine === 'function') {
    var oSh = W.AFK_RELIC_GM.sherine;
    W.AFK_RELIC_GM.sherine = function (p, c) {
      var r = oSh.apply(this, arguments);
      try { var se = p && p.eq && p.eq[SOUL], sg = se && se.seteff ? grp(se) : null; if (sg && c[sg] > 0) { c[sg] -= 1; if (c[sg] <= 0) delete c[sg]; } } catch (e) {}   // 之魂本身不算件數
      try { var cut = setCut(p); if (cut) Object.keys(c).forEach(function (g) { if (c[g] > 0) c[g] += cut; }); } catch (e) {}
      return r;
    };
  }

  // ── 夢域效果的計算 ──
  var dreamTiers = function (p) {
    var dc = {}, out = {};
    SHERINE_REMAINS.forEach(function (r) { if (r.id === SOUL) return; var e = p.eq && p.eq[r.id]; if (e && isDream(e)) { var g = grp(e); dc[g] = (dc[g] || 0) + 1; } });   // 之魂不算夢域件數
    var cut = setCut(p);
    Object.keys(dc).forEach(function (g) { var n = dc[g] + cut, tot = (p._sherineSetCnt && p._sherineSetCnt[g]) || 0; out[g] = [2, 3, 5].filter(function (t) { return n >= t && tot >= t; }); });
    return out;
  };
  var add = function (d, k, v) { d[k] = (Number(d[k]) || 0) + v; };
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = (typeof player !== 'undefined') ? player : null; if (!p || !p.d) return r;
        var tiers = dreamTiers(p), d = p.d, fx = { out: { all: 1, melee: 1, ranged: 1, magic: 1 }, taken: 1, leech: 0 }, any = false;
        Object.keys(tiers).forEach(function (g) {
          (tiers[g] || []).forEach(function (t) {
            var e = DREAM[g] && DREAM[g][t]; if (!e) return; any = true;
            if (e.s) Object.keys(e.s).forEach(function (k) { add(d, k, e.s[k]); });
            if (e.out) Object.keys(e.out).forEach(function (k) { fx.out[k] *= e.out[k]; });
            if (e.taken) fx.taken *= e.taken;
            if (e.leech) fx.leech += e.leech;
            // 最大 HP（癲狂）改在核心「夾 HP 之前」的掛點加（見下方 __afkMaxAdd）：
            //   原本在重算之後才加，核心已經先把 HP 夾到沒有夢域加成的上限 → 每重算一次 HP 就被砍掉（玩家 2026-10-29 22:19：穿癲狂＋冥鐵在村莊異常掉血）
          });
        });
        p._sdreamFx = any ? fx : null;
        if (any) { if (p === W.player || p === player) { if (p.hp > p.mhp) p.hp = p.mhp; } if (p.curHp > p.mhp) p.curHp = p.mhp; }
      } catch (e) { console.warn('[AFK-sherine-dream] recompute', e); }
      return r;
    };
  }
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) {
    try {
      if (!p || p !== ((typeof player !== 'undefined') ? player : null)) return;
      var tiers = dreamTiers(p);
      Object.keys(tiers).forEach(function (g) {
        (tiers[g] || []).forEach(function (t) {
          var e = DREAM[g] && DREAM[g][t]; if (!e) return;
          if (e.hp) p.mhp = (p.mhp || 0) + e.hp;
          if (e.hpPct) p.mhp = Math.floor((p.mhp || 0) * e.hpPct);
        });
      });
    } catch (e) { console.warn('[AFK-sherine-dream] maxhp', e); }
  });
  // 造成傷害
  var KIND = { melee: 'melee', phys: 'melee', physical: 'melee', ranged: 'ranged', magic: 'magic', mag: 'magic' };
  var C = W.AFK_CARD_COMBAT;
  if (C && typeof C.damage === 'function') {
    var oDmg = C.damage;
    C.damage = function (actor, target, amount, opt) {   // 先乘倍率再交給內層
      var k = null;
      try {
        var fx = actor && actor._sdreamFx;
        if (fx && amount > 0 && !(opt && (opt.kind === 'true' || opt.kind === 'dot')) && target && !target.cls) {
          k = KIND[(opt && opt.kind) || ''] || null;
          amount = Math.max(1, Math.floor(amount * fx.out.all * (k ? fx.out[k] : 1)));
        } else fx = null;
      } catch (e) { fx = null; }
      var v = oDmg.call(this, actor, target, amount, opt);
      try {
        if (fx && fx.leech > 0 && v > 0 && (k === 'melee' || k === 'ranged')) {
          var p = P(), h = Math.floor(v * fx.leech);
          if (h > 0) { if (actor === p) p.hp = Math.min(p.mhp, (p.hp || 0) + h); else if (!actor._downed) actor.curHp = Math.min(actor.mhp, (actor.curHp || 0) + h); }
        }
      } catch (e) {}
      return v;
    };
  }
  // 受到傷害
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent) { var fx = ent && ent._sdreamFx; return fx ? fx.taken : 1; });

  // ── 顯示：紅字、夢域套裝名、說明 ──
  try {
    var st = document.createElement('style'); st.id = 'afk-sherine-dream-css';
    st.textContent = '.c-sherine-dream{color:#fb7185!important;text-shadow:0 0 6px rgba(244,63,94,.65);animation:sherineDreamName 2.2s ease-in-out infinite}'
      + '@keyframes sherineDreamName{0%,100%{text-shadow:0 0 4px rgba(244,63,94,.5)}50%{text-shadow:0 0 10px rgba(251,113,133,.95)}}';
    document.head.appendChild(st);
  } catch (e) {}
  if (typeof W.getItemColor === 'function') { var oCol = W.getItemColor; W.getItemColor = function (it) { if (isDream(it)) return 'c-sherine-dream'; return oCol.apply(this, arguments); }; }
  if (typeof W.getItemFullName === 'function') {
    var oName = W.getItemFullName;
    W.getItemFullName = function (it) { if (it && it.id === SOUL) return '之魂'; var s = oName.apply(this, arguments); try { if (isDream(it)) { var g = grp(it); if (DN[g]) s = String(s).replace(g + DB.items[it.id].n, DN[g] + DB.items[it.id].n); } } catch (e) {} return s; };
  }
  var tierText = function (g) { var o = DREAM[g]; return [2, 3, 5].map(function (t) { return t + ' 件：' + o[t].t; }); };
  if (typeof W.buildItemDescHTML === 'function') {
    var oDesc = W.buildItemDescHTML;
    W.buildItemDescHTML = function (it) {
      var h = oDesc.apply(this, arguments);
      try {
        if (it && it.id === SOUL) {   // 之魂：不顯示套裝詞與套裝效果
          return '<span class="text-slate-300">' + esc(DB.items[SOUL].d) + '</span><br>'
            + (isDream(it) ? '<span class="c-sherine-dream font-bold">✦ 之魂粹煉：所有席琳套裝需要的件數 −1</span>'
              : '<span class="text-slate-400 italic">看似沒有任何效果……但好像還需要些什麼。</span>');
        }
        if (isDream(it)) {
          var g = grp(it);
          h = '<span class="c-sherine-dream font-bold">✦ 夢域套裝：' + esc(DN[g] || g) + '（' + esc(g) + '的夢域淬鍊）</span><br>'
            + tierText(g).map(function (t) { return '<span class="text-rose-200">・' + esc(t) + '</span>'; }).join('<br>')
            + '<br><span class="text-slate-400 text-sm">跟原版「' + esc(g) + '」算同一組；某段門檻的夢域遺骸件數也達到時，該段改用上面的夢域效果。</span>'
            + '<br>' + h.replace(/^<span class="c-sherine font-bold">✦ 席琳套裝效果：[^<]*<\/span><br>(<span class="text-green-200">[^<]*<\/span>(<br>)?)*/, '');
        }
      } catch (e) {}
      return h;
    };
  }

  // ── 伊奧：夢域淬鍊 ──
  var listRemains = function (p) {
    var out = [];
    SHERINE_REMAINS.forEach(function (r) { var e = p.eq && p.eq[r.id]; if (e && e.seteff && !isDream(e)) out.push({ where: 'eq', key: r.id, it: e }); });
    (p.inv || []).forEach(function (it) { var d = DB.items[it.id]; if (d && d.remains && it.seteff && !isDream(it) && !it.lock) out.push({ where: 'inv', key: it.uid, it: it }); });
    return out;
  };
  var have = function (id) { try { return typeof questCountId === 'function' ? questCountId(id) : 0; } catch (e) { return 0; } };
  var take = function (id, n) { if (typeof questConsumeId === 'function') questConsumeId(id, n); };
  W.afkSherineRefine = function (where, key) {
    var p = P(); if (!p) return;
    var peek = where === 'eq' ? p.eq[key] : p.inv.find(function (x) { return x.uid === key; });
    var isSoul = !!(peek && peek.id === SOUL), cost = isSoul ? SOUL_COST : COST;
    if (!isSoul && !dreamOn()) { logSys('<span class="text-red-400">只有在席琳夢域鏡的世界裡才能夢域淬鍊。</span>'); return; }
    if (have('sherine_crystal') < cost.crystal || have('afk_dream_crystal') < cost.dream) { logSys('<span class="text-red-400 font-bold">材料不足：需要席琳結晶 ×' + cost.crystal + '、夢艷結晶 ×' + cost.dream + '。</span>'); return; }
    var it = null;
    if (where === 'eq') it = p.eq[key];
    else {
      var src = p.inv.find(function (x) { return x.uid === key; });
      if (src && (src.cnt || 1) > 1) { src.cnt -= 1; it = JSON.parse(JSON.stringify(src)); it.cnt = 1; it.uid = (typeof uid === 'function') ? uid() : String(Date.now()); p.inv.push(it); }
      else it = src;
    }
    if (!it || !it.seteff || isDream(it)) return;
    take('sherine_crystal', cost.crystal); take('afk_dream_crystal', cost.dream);
    it.seteff = grp(it) + '夢';
    try { logSys(isSoul ? '<span class="c-sherine-dream font-bold">✦ 之魂粹煉</span>：魂魄低語的聲音忽然清晰了起來——所有席琳套裝需要的件數 −1。（消耗 席琳結晶 ×' + cost.crystal + '、夢艷結晶 ×' + cost.dream + '）'
      : '<span class="c-sherine-dream font-bold">✦ 夢域淬鍊</span>：' + getItemFullName(it) + ' 在席琳的夢裡甦醒了。（消耗 席琳結晶 ×' + cost.crystal + '、夢艷結晶 ×' + cost.dream + '）'); } catch (e) {}
    try { if (typeof calcStats === 'function') calcStats(); renderTabs(); updateUI(); saveGame(); } catch (e) {}
    var c = document.getElementById('interaction-content'); if (c && typeof W.renderIoExchange === 'function') W.renderIoExchange(c);
  };
  if (typeof W.renderIoExchange === 'function') {
    var oIo = W.renderIoExchange;
    W.renderIoExchange = function (div) {
      var r = oIo.apply(this, arguments);
      try {
        var p = P(); if (!p || !div) return r;
        var h = '<div class="p-2 mt-2 border-t border-rose-900">'
          + '<div class="c-sherine-dream font-bold text-lg mb-1">✦ 夢域淬鍊</div>'
          + '<div class="text-slate-400 text-xs mb-2">伊奧：「在夢的最深處，遺骸會想起自己原本的模樣。」——席琳夢域鏡的世界裡，可把遺骸淬鍊成夢域版：部位與套裝不變，名字與效果換成夢域版（紅字）。每件消耗 <span class="c-sherine">席琳結晶 ×' + COST.crystal + '</span>＋<span class="text-fuchsia-300">夢艷結晶 ×' + COST.dream + '</span>（持有 ' + have('sherine_crystal').toLocaleString() + '／' + have('afk_dream_crystal').toLocaleString() + '）。</div>';
        var rows = listRemains(p).filter(function (x) { return dreamOn() || x.it.id === SOUL; });   // 之魂粹煉不限世界
        if (!dreamOn()) h += '<div class="text-rose-300 text-sm">現在不是席琳夢域鏡的世界，只能做之魂粹煉。</div>';
        {
          if (!rows.length) h += '<div class="text-slate-500 text-sm">沒有可以淬鍊的遺骸。</div>';
          rows.slice(0, 40).forEach(function (x) {
            var soul = x.it.id === SOUL;
            h += '<div class="flex items-center justify-between bg-slate-800 rounded mb-1 border border-slate-700 px-3 py-2"><span>' + getItemFullName(x.it) + (x.where === 'eq' ? '<span class="text-slate-400 text-xs">（裝備中）</span>' : '') + (soul ? '<span class="text-slate-400 text-xs">（席琳結晶 ×' + SOUL_COST.crystal + '＋夢艷結晶 ×' + SOUL_COST.dream + '）</span>' : '') + '</span>'
              + '<button type="button" class="btn bg-rose-950 hover:bg-rose-900 border-rose-700 py-1 px-4 font-bold" onclick="afkSherineRefine(\'' + x.where + '\',\'' + esc(x.key) + '\')"><span class="c-sherine-dream">' + (soul ? '之魂粹煉' : '淬鍊') + '</span></button></div>';
          });
        }
        h += '</div>';
        var box = div.querySelector('.p-2') || div; box.insertAdjacentHTML('beforeend', h);
      } catch (e) { console.warn('[AFK-sherine-dream] io', e); }
      return r;
    };
  }

  // ── 之魂掉落：謀叛者的低語裡每隻頭目 5% ──
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null;
      var inMap = typeof mapState !== 'undefined' && mapState.current === 'afk_traitor_whisper';
      var r = oKill.apply(this, arguments);
      try {
        var mk = (W.AFK_TRAITOR && W.AFK_TRAITOR.modeKey) ? W.AFK_TRAITOR.modeKey() : '';
        if (m && m._dead && (m.boss || m.afkTraitor) && inMap && mk === 'mad' && !m._afkSoulRolled && P()) {   // 只在瘋狂席琳（夢域鏡不算；玩家 2026-10-29）
          m._afkSoulRolled = true;
          if (Math.random() < SOUL_RATE) {
            var g = SOUL_GROUP();   // 不帶套裝詞：固定一個內部詞綴，掉到的之魂可以疊在一起
            if (typeof gainSherineRemains === 'function') gainSherineRemains(SOUL, g, true);
            logSys('<span class="c-sherine-dream font-bold">✦✦ ' + esc(m.n) + ' 的魂魄被席琳攫走，落下了「之魂」！✦✦</span>');
          }
        }
      } catch (e) { console.warn('[AFK-sherine-dream] soul', e); }
      return r;
    };
  }

  // ── 星蝕·解（玩家 2026-10-29 晚；原名「蝕刻」，跟無屬性印記的「蝕刻」撞名所以改名）──
  //   武器的三個符文孔，在說話之島的符文師佐爾頓開（介面在 afk-runes.js）：
  //     第一孔「墜蝕·解」：消耗同一組原版席琳遺骸 8 套（8 個部位各 8 件）→ 刻上那一組，主手時該組算滿 5 件
  //     第二孔「刻解·骸」：要先開第一孔；消耗同一組夢域遺骸 8 套 → 刻上那一組夢域，主手時該組算滿 5 件且 2／3／5 段都是夢域效果
  //     第三孔「瘴骸·破」：鎖定中
  //   資料：it.etch＝第一孔的組名、it.etchD＝第二孔的組名＋「夢」、it.sockets＝已開的孔（陣列長度＝開了幾個，內容留給符文石）
  var ETCH_PER = 8, SOCKET_NAMES = ['墜蝕·解', '刻解·骸', '瘴骸·破'], SOCKET_MAX_OPEN = 2;
  var PARTS = ['rem_claw', 'rem_eye', 'rem_blood', 'rem_flesh', 'rem_heart', 'rem_bone', 'rem_fang', 'rem_scale'];
  var invCount = function (p, id, seteff) { return (p.inv || []).filter(function (it) { return it && it.id === id && it.seteff === seteff && !it.lock; }).reduce(function (n, it) { return n + (it.cnt || 1); }, 0); };
  var etchReady = function (p, seteff) { return Math.min.apply(Math, PARTS.map(function (id) { return invCount(p, id, seteff); })); };
  var etchTake = function (p, seteff) {
    PARTS.forEach(function (id) {
      var need = ETCH_PER;
      for (var j = p.inv.length - 1; j >= 0 && need > 0; j--) { var it = p.inv[j]; if (!it || it.id !== id || it.seteff !== seteff || it.lock) continue; var q = Math.min(need, it.cnt || 1); it.cnt = (it.cnt || 1) - q; need -= q; if (it.cnt <= 0) p.inv.splice(j, 1); }
    });
  };
  var etchName = function (e) { if (!e) return ''; var g = String(e).slice(0, 2); return e.length > 2 ? (DN[g] || g) + '（夢域）' : g; };
  // 舊資料（蝕刻時代：etch 可能是夢域、sockets 一次給 3 個）→ 新格式
  var migrate = function (it) {
    if (!it || !it.etch || it._starV) return it;
    it._starV = 1;
    if (String(it.etch).length > 2) { it.etchD = it.etch; it.etch = String(it.etch).slice(0, 2); }
    var n = it.etchD ? 2 : 1, old = Array.isArray(it.sockets) ? it.sockets : [];
    it.sockets = old.slice(0, n); while (it.sockets.length < n) it.sockets.push(null);
    return it;
  };
  var mainW = function (p) { var w = p && p.eq && p.eq.wpn; return w ? migrate(w) : null; };
  var mainEtch = function (p) { var w = mainW(p); return w && w.etch ? w.etch : null; };
  // 計件：刻上的組算滿 5 件
  if (W.AFK_RELIC_GM && typeof W.AFK_RELIC_GM.sherine === 'function') {
    var oSh2 = W.AFK_RELIC_GM.sherine;
    W.AFK_RELIC_GM.sherine = function (p, c) {
      var r = oSh2.apply(this, arguments);
      try { var w = mainW(p); if (w) [w.etch, w.etchD].forEach(function (e) { if (!e) return; var g = String(e).slice(0, 2); c[g] = Math.max(c[g] || 0, 5); }); } catch (er) {}
      return r;
    };
  }
  var oTiers = dreamTiers;
  dreamTiers = function (p) {
    var out = oTiers(p);
    try { var w = mainW(p); if (w && w.etchD) out[String(w.etchD).slice(0, 2)] = [2, 3, 5]; } catch (er) {}
    return out;
  };
  // 物品簽章帶上星蝕（不會跟一般的同款武器疊在一起）
  if (typeof W.itemSig === 'function') { var oSig = W.itemSig; W.itemSig = function (it) { var s0 = oSig.apply(this, arguments); return (it && (it.etch || it.etchD)) ? s0 + '|ET' + (it.etch || '') + '/' + (it.etchD || '') + '/' + ((it.sockets || []).length) : s0; }; }
  var starText = function (it) {
    migrate(it);
    var parts = [];
    if (it.etch) parts.push('「' + SOCKET_NAMES[0] + '」' + esc(etchName(it.etch)));
    if (it.etchD) parts.push('「' + SOCKET_NAMES[1] + '」' + esc(etchName(it.etchD)));
    return parts.join('、');
  };
  if (typeof W.buildItemDescHTML === 'function') {
    var oDesc2 = W.buildItemDescHTML;
    W.buildItemDescHTML = function (it) {
      var h = oDesc2.apply(this, arguments);
      try { if (it && (it.etch || it.etchD)) h = '<span class="' + (it.etchD ? 'c-sherine-dream' : 'c-sherine') + ' font-bold">✠ 星蝕·解：' + starText(it) + '</span><br><span class="text-slate-300 text-sm">裝在主手時，刻上的套裝直接算滿 5 件' + (it.etchD ? '（夢域的那一組 2／3／5 段都是夢域效果）' : '') + '。</span><br>' + h; } catch (e) {}
      return h;
    };
  }
  (W.__afkAxLines = W.__afkAxLines || []).push(function (it) { return it && (it.etch || it.etchD) ? '<span class="' + (it.etchD ? 'c-sherine-dream' : 'c-sherine') + '">星蝕·解：' + starText(it) + '</span>' : null; });

  W.__afkSherineDream = { SOUL: SOUL, SOUL_COST: SOUL_COST, soulOn: soulOn, ETCH_PER: ETCH_PER, SOCKET_NAMES: SOCKET_NAMES, SOCKET_MAX_OPEN: SOCKET_MAX_OPEN, PARTS: PARTS, etchReady: etchReady, etchTake: etchTake, etchName: etchName, migrate: migrate, mainEtch: mainEtch, DREAM: DREAM, DN: DN, isDream: isDream, dreamTiers: dreamTiers, soulOn: soulOn, setCut: setCut, COST: COST, SOUL: SOUL, SOUL_RATE: SOUL_RATE };
  console.log('[AFK-sherine-dream] 已載入：夢域席琳遺骸與之魂');
})();
