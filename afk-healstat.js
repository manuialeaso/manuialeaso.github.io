/* ==========================================================================
 * afk-healstat.js — 恢復統計與 HP 恢復量面板（玩家 2026-10-22 指定）
 *
 * 一、本圖效率統計：DPS 統計下面多一區「恢復統計」——玩家、每個傭兵、寵物、召喚物各自的每秒恢復 HP
 *     （自然恢復、藥水、治癒魔法、吸血等所有來源；每 0.1 秒比對 HP 的增加量。復活那一下不算）
 *     換地圖／按重置一起歸零。
 * 二、角色面板「HP恢復量」改成完整算式：1~體質上限 ＋ 裝備恢復量，× 技藝等倍率，每 N 秒一次
 *     例：1~105+1 ×3／16秒
 * ========================================================================== */
(function () {
  'use strict';
  var REC = { player: 0, allies: {}, pet: 0, summon: 0 };
  var reset = function () { REC = { player: 0, allies: {}, pet: 0, summon: 0 }; };
  if (typeof window._dpsReset === 'function') {
    var oR = window._dpsReset;
    window._dpsReset = function () { var r = oR.apply(this, arguments); reset(); return r; };
  }
  var keyOf = function (a) { return a._slot != null ? String(a._slot) : (a._allyName || '?'); };
  var snapshot = function () {
    var o = { p: (player && !player.dead) ? player.hp : null, a: [], pet: [], sm: [] };
    (player.allies || []).forEach(function (a) { if (a) o.a.push([a, a._downed ? null : a.curHp]); });
    try { (typeof petsOutList === 'function' ? petsOutList() : []).forEach(function (x) { if (x) o.pet.push([x, x._downed ? null : x.hp]); }); } catch (e) {}
    (player.summonsV2 || []).forEach(function (x) { if (x) o.sm.push([x, x._downed ? null : x.hp]); });
    return o;
  };
  var gain = function (before, now) { return (before != null && now != null && now > before) ? now - before : 0; };
  if (typeof window.tick === 'function') {
    var oTick = window.tick;
    window.tick = function () {
      var s0 = null; try { if (typeof player !== 'undefined' && player) s0 = snapshot(); } catch (e) {}
      try { return oTick.apply(this, arguments); }
      finally {
        try {
          if (s0) {
            if (!player.dead) REC.player += gain(s0.p, player.hp);
            s0.a.forEach(function (x) { var a = x[0]; if (!a._downed) { var k = keyOf(a); REC.allies[k] = (REC.allies[k] || 0) + gain(x[1], a.curHp); } });
            s0.pet.forEach(function (x) { if (!x[0]._downed) REC.pet += gain(x[1], x[0].hp); });
            s0.sm.forEach(function (x) { if (!x[0]._downed) REC.summon += gain(x[1], x[0].hp); });
          }
        } catch (e) {}
      }
    };
  }

  // 統計頁：插在 DPS 統計後面
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var render = function () {
    var el = document.getElementById('tab-audit'); if (!el || el.classList.contains('hidden')) return;
    if (typeof _auditView !== 'undefined' && _auditView === 'drops') return;
    var box = el.firstElementChild; if (!box) return;
    var old = document.getElementById('afk-healstat'); if (old) old.remove();
    var secs = Math.max(0.001, (Date.now() - ((typeof _audit !== 'undefined' && _audit.start) || Date.now())) / 1000);
    var rows = [{ n: '玩家', v: REC.player / secs, c: '#34d399' }];
    (player.allies || []).forEach(function (a) { if (a) rows.push({ n: '傭兵·' + (a._allyName || '傭兵'), v: (REC.allies[keyOf(a)] || 0) / secs, c: '#a3e635' }); });
    if (REC.pet > 0) rows.push({ n: '夥伴', v: REC.pet / secs, c: '#4ade80' });
    if (REC.summon > 0) rows.push({ n: '召喚', v: REC.summon / secs, c: '#5eead4' });
    var mx = Math.max(1, Math.max.apply(null, rows.map(function (r) { return r.v; })));
    var html = rows.map(function (r) {
      var pct = Math.max(2, Math.round(r.v / mx * 100));
      return '<div class="flex items-center gap-2"><span class="shrink-0 text-slate-300 text-xs" style="width:88px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + esc(r.n) + '">' + esc(r.n) + '</span>'
        + '<div class="flex-1 bg-slate-900 rounded h-4 overflow-hidden"><div style="width:' + pct + '%;height:100%;background:' + r.c + ';transition:width .3s;"></div></div>'
        + '<span class="shrink-0 font-bold text-right text-xs" style="width:60px;color:' + r.c + ';">' + Math.round(r.v).toLocaleString() + '</span></div>';
    }).join('');
    var sec = document.createElement('div');
    sec.id = 'afk-healstat'; sec.className = 'border-t border-slate-700 pt-2';
    sec.innerHTML = '<div class="text-emerald-300 font-bold mb-2">恢復統計 <span class="text-slate-500 text-xs font-normal">（本圖每秒恢復 HP·自然恢復、藥水、治癒、吸血都算）</span></div><div class="flex flex-col gap-1.5">' + html + '</div>';
    // 找到 DPS 統計那一區，插在後面
    var kids = Array.prototype.slice.call(box.children), dps = null;
    kids.forEach(function (k) { if (!dps && k.textContent && k.textContent.indexOf('DPS 統計') >= 0) dps = k; });
    if (dps && dps.nextSibling) box.insertBefore(sec, dps.nextSibling); else box.appendChild(sec);
  };
  if (typeof window.renderAuditTab === 'function') {
    var oRA = window.renderAuditTab;
    window.renderAuditTab = function () { var r = oRA.apply(this, arguments); try { render(); } catch (e) {} return r; };
  }

  // 面板：HP恢復量 完整算式
  var regenText = function () {
    var d = player && player.d; if (!d) return null;
    var mx = Number(d.hpRegenMax) || 0, add = Math.floor(Number(d.hpR) || 0);
    var mult = 1; try { if (window.__afkArts && typeof window.__afkArts.healMult === 'function') mult = window.__afkArts.healMult(player, true) || 1; } catch (e) {}
    var iv = Math.max(30, 160 - 10 * (Number(d.hpRegenFaster) || 0));
    if (player.buffs && (player.buffs.sk_heal_energy_storm || 0) > 0) iv = Math.min(iv, (DB.skills.sk_heal_energy_storm && DB.skills.sk_heal_energy_storm.hpRegenIv) || 30);
    var t = (mx > 0 ? '1~' + mx : '0') + (add ? (add > 0 ? '+' : '') + add : '');
    if (mult !== 1) t += ' ×' + (Math.round(mult * 100) / 100);
    t += '／' + (iv / 10) + '秒';
    if (player.buffs && (player.buffs.sk_berserk || 0) > 0) t += '（狂暴中停止）';
    return t;
  };
  if (typeof window._updateUIImpl === 'function') {
    var oU = window._updateUIImpl;
    window._updateUIImpl = function () {
      var r = oU.apply(this, arguments);
      try { var el = document.getElementById('dt-hpr'); if (el) { var t = regenText(); if (t && el.innerText !== t) { el.innerText = t; el.title = '每次自然恢復：1~體質上限 隨機＋裝備 HP 恢復量，再乘技藝等倍率'; } } } catch (e) {}
      return r;
    };
  }
  window.__afkHealStat = { rec: function () { return REC; }, regenText: regenText, render: render };
  console.log('[AFK-healstat] 已啟用：恢復統計、HP 恢復量完整算式');
})();
