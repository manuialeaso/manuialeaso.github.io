/* ============================================================================
 * afk-shroomboost.js — 蘑菇秘境的加強（Ping 11-13 21:39／21:45）
 *
 *   ‧加強：花 50,000 龍鑽，今天蘑菇秘境的經驗 ×5。
 *   ‧史詩加強：花 50,000 血龍鑽，今天蘑菇秘境的經驗 ×2（Ping 11-14 05:08 由 ×10 改 ×3、13:17 再改 ×2）。
 *   ‧兩個可以一起買，相乘（×10）。每個角色各自算，一天各能買一次，台灣時間 00:00 重置（跟秘境的 30 分鐘同一天）。
 *   ‧做法：merged/activities 的秘境蘑菇 exp 是 getter，這裡再包一層乘上倍率（出生時決定）。
 *   ‧畫面：成長面板的蘑菇秘境頁，標題下面多兩顆按鈕（按兩次確認）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'shroomboost', name: '蘑菇秘境加強', group: '遊戲內容', desc: '蘑菇秘境：花 5 萬龍鑽經驗 ×5、花 5 萬血龍鑽經驗 ×2，當天有效，可以疊加' });
  if (T && !T.enabled('shroomboost')) return;
  var MOB = 'growth_mushroom_1000', COST = 50000;
  var KINDS = {
    dia: { n: '加強', cur: '龍鑽', mult: 5 },
    blood: { n: '史詩加強', cur: '血龍鑽', mult: 2 }
  };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var dayKey = function () { try { return W.LineageGrowthCore.dayKey(Date.now()); } catch (e) { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); } };
  var rec = function (p) { p = p || P(); if (!p) return {}; var r = p.afkShroomBoost; if (!r || r.day !== dayKey()) r = p.afkShroomBoost = { day: dayKey() }; return r; };
  var mult = function (p) { p = p || P(); if (!p || p.classicMode) return 1; var r = rec(p), m = 1; if (r.dia) m *= KINDS.dia.mult; if (r.blood) m *= KINDS.blood.mult; return m; };
  var log = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };

  // ── 經驗 ──
  var hookExp = function () {
    var d = typeof DB !== 'undefined' && DB.mobs && DB.mobs[MOB]; if (!d || hookExp.done) return false;
    var desc = Object.getOwnPropertyDescriptor(d, 'exp'), get = desc && desc.get, plain = desc && !desc.get ? desc.value : null;
    Object.defineProperty(d, 'exp', { enumerable: true, configurable: true, get: function () { var b = get ? N(get.call(d)) : N(plain); return Math.round(b * mult()); }, set: function () {} });
    hookExp.done = true; return true;
  };
  if (!hookExp()) W.addEventListener('load', hookExp);

  // ── 購買 ──
  var buy = function (k) {
    var p = P(), K = KINDS[k]; if (!p || !K) return { ok: false, msg: '請先進入遊戲。' };
    if (p.classicMode) return { ok: false, msg: '經典模式沒有這個功能。' };
    var r = rec(p); if (r[k]) return { ok: false, msg: '今天已經買過' + K.n + '了。' };
    if (k === 'dia') {
      var have = 0; try { have = N(W.pandoraGetSharedDiamonds()); } catch (e) {}
      if (have < COST) return { ok: false, msg: '龍鑽不足，需要 ' + COST.toLocaleString() + '。' };
      var res = {}; try { res = W.pandoraAdjustSharedDiamonds(-COST) || {}; } catch (e) { res = { ok: false }; }
      if (!res.ok) return { ok: false, msg: res.error || '龍鑽扣款失敗。' };
      r.dia = true;
    } else {
      var G = W.LineageGrowth; if (!G) return { ok: false, msg: '成長系統未就緒。' };
      if (G.blood() < COST) return { ok: false, msg: '血龍鑽不足，需要 ' + COST.toLocaleString() + '。' };
      try { G.transaction('蘑菇秘境・史詩加強', function () { G.spendBlood(COST); rec(p).blood = true; }); } catch (e) { return { ok: false, msg: e.message || '血龍鑽扣款失敗。' }; }
    }
    try { if (typeof saveGame === 'function') saveGame(); } catch (e) {}
    log('<span class="text-amber-300 font-bold">蘑菇秘境・' + K.n + '：今天秘境裡的經驗 ×' + K.mult + '（目前合計 ×' + mult(p) + '，午夜重置）。</span>');
    return { ok: true };
  };

  // ── 畫面：成長面板的蘑菇秘境頁 ──
  var arm = null;
  var block = function () {
    var p = P(), r = rec(p), m = mult(p);
    var btn = function (k) {
      var K = KINDS[k], done = !!r[k], armed = arm && arm.k === k && Date.now() - arm.t < 4000;
      return '<button type="button" class="btn" data-shroom-buy="' + k + '"' + (done ? ' disabled' : '') + ' style="padding:6px 10px;margin:4px 6px 0 0">'
        + (done ? K.n + '（今天已啟用 ×' + K.mult + '）' : armed ? '再按一次：花 ' + COST.toLocaleString() + ' ' + K.cur : K.n + '：花 ' + COST.toLocaleString() + ' ' + K.cur + '，經驗 ×' + K.mult) + '</button>';
    };
    return '<div id="afk-shroom-boost" style="margin:6px 0 10px;padding:8px 10px;border:1px solid #6b5a35;border-radius:6px;background:#1a1712">'
      + '<div style="color:#fde68a;font-weight:700">秘境加強（今天有效，台灣時間 00:00 重置）</div>'
      + '<div style="font-size:13px;color:#e2e8f0;margin-top:2px">兩個可以一起買，經驗相乘。今天目前：<b style="color:#86efac">×' + m + '</b></div>'
      + btn('dia') + btn('blood') + '</div>';
  };
  var paint = function () {
    var ban = document.querySelector('.growth-banner--mushroom'); if (!ban) return;
    var old = document.getElementById('afk-shroom-boost'), h = block();
    if (old) { if (old.__h !== h) { old.outerHTML = h; var n = document.getElementById('afk-shroom-boost'); if (n) n.__h = h; } return; }
    ban.insertAdjacentHTML('afterend', h); var n2 = document.getElementById('afk-shroom-boost'); if (n2) n2.__h = h;
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-shroom-buy]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var k = b.getAttribute('data-shroom-buy');
    if (!(arm && arm.k === k && Date.now() - arm.t < 4000)) { arm = { k: k, t: Date.now() }; paint(); setTimeout(paint, 4100); return; }
    arm = null; var res = buy(k); if (!res.ok) log('<span class="text-red-400">' + res.msg + '</span>'); paint();
  }, true);
  // 只盯成長面板（#growth-overlay）裡的變化，不盯整頁
  var watched = null;
  var watch = function () {
    var ov = document.getElementById('growth-overlay'); if (!ov || ov === watched) return; watched = ov;
    try { new MutationObserver(function () { if (ov.querySelector('.growth-banner--mushroom') && !document.getElementById('afk-shroom-boost')) paint(); }).observe(ov, { childList: true, subtree: true }); } catch (e) {}
    paint();
  };
  try { new MutationObserver(watch).observe(document.body, { childList: true }); } catch (e) {}
  watch();

  W.__afkShroomBoost = { KINDS: KINDS, COST: COST, mult: mult, buy: buy, rec: rec, paint: paint };
})();
