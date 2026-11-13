/* ============================================================================
 * afk-overflow.js — 命中／迴避溢出（玩家 2026-11-03 21:57；開關 overflow，掛在夢域鏡模式底下；經典模式不套用）
 *
 * 能力上限（afk-caps，跟著夢域鏡模式）：命中判定值最多 15（＝80%）、迴避率最多 80%（迴避 200）。
 * 超過上限的部分不再白費：
 *   ‧命中溢出：你與傭兵打怪時，判定值（等級＋命中（近／遠距離＋額外）−怪等級＋怪的防禦）超過 15 的部分，
 *     每 50 點 → 每次打中多 5 點真實傷害（加在這一擊最後，不吃怪的減傷），沒有上限。
 *     溢出＝max(0, 判定值 − 15)；加傷＝floor(溢出 ÷ 50) × 5。
 *     「每次打中」：一般攻擊、連擊、反擊、居合、副手、魔擊等物理結算（AFK_CARD_COMBAT.damage 的 kind＝melee／ranged／phys），
 *     穿透的副目標（inherited）不算；魔法、持續傷害不算。
 *   ‧迴避溢出：你與傭兵的迴避（面板 ER，不含泰坦子彈的臨時迴避）超過 200 的部分，每 50 點 → 最終減傷 +5（最後才扣的固定減傷），沒有上限。
 *     走 AFK_CARD_COMBAT.finalDR（afk-arts 受傷掛點最後扣；同聖衣、吉爾塔斯的最終減傷）。
 * 面板：能力分頁「迴避率」旁多兩列「命中溢出」（對目前目標）與「迴避溢出」。小百科「戰鬥」分頁有說明。
 * 要排在 afk-caps、afk-card-combat、afk-giltas 之後（包最外層）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'overflow', name: '命中／迴避溢出', group: '遊戲玩法', parent: 'dreamhell', seal: true,
    desc: '命中超過上限的部分每 50 點，每次打中多 5 點真實傷害；迴避超過上限（迴避率 80%）的部分每 50 點，最終減傷 +5' });
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var on = function () { var p = P(); return !!(p && !p.classicMode && !W.__afkTestNoOverflow && (!T || T.enabled('overflow')) && W.__afkHitHv); };   // __afkTestNoOverflow：只給測試用
  var STEP = 50, GAIN = 5;
  var num = function (v) { return Number(v) || 0; };
  var member = function (a) { var p = P(); if (!p || !a) return false; if (a === p) return true; return (p.allies || []).indexOf(a) >= 0; };
  var rangedOf = function (a) { var e = a && a.eq && a.eq.wpn, d = e && DB.items[e.id]; return !!(d && (d.isBow || d.ranged)); };
  // 面板命中：近／遠距離命中＋額外命中（面板上那個數字）
  var panelHit = function (a, ranged) { var d = a && a.d; if (!d) return 0; if (ranged == null) ranged = rangedOf(a); return num(ranged ? d.rangedHit : d.meleeHit) + num(d.extraHit); };
  var rawHit = function (a, t, ranged) {
    if (!a || !t) return 0;
    var p = P(), h = panelHit(a, ranged), st = a.statuses;
    if (a === p) h += num(a._skillHitBonus);
    if (st) { if (st.weaken > 0) h -= 2; if (st.disease > 0) h -= 4; if (st.blind > 0) h -= 6; }
    var ac = 0; try { ac = typeof mobEffAC === 'function' ? mobEffAC(t, a === p ? undefined : a) : num(t.ac); } catch (e) { ac = num(t.ac); }
    return num(a.lv || 1) + h - num(t.lv) + ac;
  };
  var hitOver = function (a, t, ranged) { var cap = W.__afkHitHv; if (!cap) return 0; return Math.max(0, Math.floor(rawHit(a, t, ranged) - cap)); };
  var hitBonus = function (a, t, ranged) { return Math.floor(hitOver(a, t, ranged) / STEP) * GAIN; };
  var ER_CAP = function () { var c = W.__afkEvadeCap; if (!c) return 0; return c <= 50 ? c : 50 + (c - 50) * 5; };   // effResistPct 反推：80% ＝ 迴避 200
  var erOver = function (a) { var c = ER_CAP(); if (!c || !a || !a.d) return 0; return Math.max(0, Math.floor(num(a.d.er) - c)); };
  var erBonus = function (a) { return Math.floor(erOver(a) / STEP) * GAIN; };
  var PHYS = { melee: 1, ranged: 1, phys: 1 };

  var hooked = false;
  var hook = function () {
    var C = W.AFK_CARD_COMBAT; if (!C || hooked) return;
    hooked = true;
    if (typeof C.damage === 'function') {
      var oD = C.damage;
      C.damage = function (actor, target, amount, opt) {
        var v = oD.apply(this, arguments);
        try {
          if (v > 0 && opt && PHYS[opt.kind] && !opt.inherited && target && target !== P() && target.curHp != null && on() && member(actor)) {
            var b = hitBonus(actor, target, opt.kind === 'ranged' ? true : (opt.kind === 'melee' ? false : null));
            if (b > 0) v = Number(v) + b;
          }
        } catch (e) {}
        return v;
      };
    }
    if (typeof C.finalDR === 'function') {
      var oF = C.finalDR;
      C.finalDR = function (actor) {
        var v = num(oF.apply(this, arguments));
        try { if (on() && member(actor)) v += erBonus(actor); } catch (e) {}
        return v;
      };
    }
  };
  hook();

  // ── 能力面板 ──
  var curTarget = function () { try { var t = mapState.mobs[mapState.targetIdx]; return t && !t._dead ? t : null; } catch (e) { return null; } };
  var row = function (id, label, anchorRow, before) {
    var el = document.getElementById(id); if (el) return el;
    if (!anchorRow || !anchorRow.parentNode) return null;
    var div = document.createElement('div'); div.id = id + '-row';
    div.innerHTML = '<span>' + label + '</span><strong id="' + id + '">0</strong>';
    anchorRow.parentNode.insertBefore(div, before ? anchorRow : anchorRow.nextSibling);
    return document.getElementById(id);
  };
  var paint = function () {
    var p = P(), erEl = document.getElementById('dt-er'); if (!erEl) return;
    var erRow = erEl.parentNode, show = !!(p && on());
    var h = row('afk-ovf-hit', '命中溢出', erRow, true), e = row('afk-ovf-er', '迴避溢出', erRow, false);
    [h, e].forEach(function (x) { if (x && x.parentNode) x.parentNode.style.display = show ? '' : 'none'; });
    if (!show) return;
    var t = curTarget(), ranged = rangedOf(p);
    var ho = t ? hitOver(p, t, ranged) : Math.max(0, Math.floor(num(p.lv) + panelHit(p, ranged) - num(p.lv) - W.__afkHitHv));
    var hb = Math.floor(ho / STEP) * GAIN;
    var ht = '+' + hb + ' 真實傷害', htit = (t ? '對目前目標（' + t.n + '）' : '對同等級、防禦 0 的怪') + '：命中超過上限 ' + ho + ' 點；每 50 點，每次打中多 5 點真實傷害';
    if (h && h.textContent !== ht) h.textContent = ht;
    if (h && h.parentNode.title !== htit) h.parentNode.title = htit;
    var eo = erOver(p), eb = Math.floor(eo / STEP) * GAIN, et = '+' + eb + ' 最終減傷', etit = '迴避超過 ' + ER_CAP() + '（迴避率 80%）的部分 ' + eo + ' 點；每 50 點，最終減傷 +5';
    if (e && e.textContent !== et) e.textContent = et;
    if (e && e.parentNode.title !== etit) e.parentNode.title = etit;
  };
  // 面板：異常狀態抵抗（玩家 2026-11-03 22:55；全身裝備的通用抵抗相加，最高 100%，跟遊戲判定同一套算法）
  var abnPct = function (p) {
    var pct = 0;
    try { (typeof WEIGHT_COUNT_SLOTS !== 'undefined' ? WEIGHT_COUNT_SLOTS : []).forEach(function (k) { var e = p.eq && p.eq[k]; var dd = e && DB.items[e.id]; if (dd && dd.abnormalResist) pct += Number(dd.abnormalResist) || 0; }); } catch (e) {}
    pct = Math.min(100, pct);
    try { if (typeof W.__afkDimPanelF === 'function') pct = Math.floor(pct * W.__afkDimPanelF(p)); } catch (e) {}   // 次元裂縫的面板壓制
    return pct;
  };
  var paintAbn = function () {
    var p = P(), erEl = document.getElementById('dt-er'); if (!p || !erEl) return;
    var a = row('afk-abn-res', '異常狀態抵抗', erEl.parentNode, false); if (!a) return;
    var t = abnPct(p) + '%';
    if (a.textContent !== t) a.textContent = t;
    var tit = '冰凍、暈眩、麻痺、睡眠、緩速、中毒、燒傷、弱化等負面狀態都有機會抵抗；全身裝備相加，最高 100%（個別狀態的抵抗另外加上去）';
    if (a.parentNode.title !== tit) a.parentNode.title = tit;
  };
  if (typeof W._updateUIImpl === 'function') {
    var oU = W._updateUIImpl;
    W._updateUIImpl = function () { var r = oU.apply(this, arguments); try { paint(); } catch (e) {} try { paintAbn(); } catch (e) {} return r; };
    try { (0, eval)('_updateUIImpl = window._updateUIImpl'); } catch (e) {}
  }
  W.__afkOverflow = { on: on, rawHit: rawHit, hitOver: hitOver, hitBonus: hitBonus, erOver: erOver, erBonus: erBonus, panelHit: panelHit, ER_CAP: ER_CAP, STEP: STEP, GAIN: GAIN, paint: paint, abnPct: abnPct, paintAbn: paintAbn };
})();
