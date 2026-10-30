/* ============================================================================
 * afk-rebirth.js — 輪迴轉生（玩家 2026-10-21 指定）
 *
 * 條件：Lv100、集齊六種時空材料；每個角色可轉生一次。入口＝時空裂痕入口的「時空裂痕-冥王域」（afk-dreamstar.js），
 *   進入時提醒「輪迴開始」，轉生後傳送回說話之島。
 * 轉生後：
 *   ‧自動擁有該職業全部四種精通
 *   ‧所有屬性（基礎、配點、萬能藥）保留；屬性上限提升到 200
 *     （配點上限 60 → 200；屬性效果上限 100 → 200，100 以上的效果依 80→100 那段的成長幅度往上延伸）
 *   ‧等級回到 1（遊戲最低等級是 1）、經驗歸零，但保留 Lv100 時的等級 HP／MP；等級上限提升到 150；技能、裝備、背包都保留
 *   ‧傭兵：任何職業都能帶 7 名；轉生後可帶 15 名（連自己 16 人）
 *   ‧裝備不限職業（等同對這個角色開啟「去除裝備職業限制」）
 *   ‧（2026-10-28 移除：所有武器都可以雙持）
 *   ‧面板能力 +50：近距離傷害／命中、遠距離傷害／命中、魔法傷害／命中、額外魔法點數、
 *     四屬性抗性、MR、迴避各 +50，AC −50
 * 核心掛點：補丁 20（屬性上限、配點上限）；其餘包 recomputeStats／lookupStep／雙持判定。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('rebirth')) return;
  if (typeof window.recomputeStats !== 'function') { console.warn('[AFK-rebirth] 找不到 recomputeStats，略過'); return; }

  var reborn = function () { return !!(typeof player !== 'undefined' && player && player.rebirth > 0); };
  // 「增加 300%」依指定例子定義為原補量的三倍：5～80 → 15～240。
  // 只倍率化藥水本體；體質、裝備加成與原冷卻仍由各使用路徑結算。
  function potionMultiplier(actor) { return actor && actor.rebirth > 0 ? 3 : 1; }
  if (typeof window.potionHealBase === 'function') {
    var originalPotionHealBase = window.potionHealBase;
    window.potionHealBase = function (def, actor) {
      return originalPotionHealBase.call(this, def) * potionMultiplier(actor || (typeof player !== 'undefined' ? player : null));
    };
  }
  window.__afkAttrCap = function () { return reborn() ? 200 : 100; };
  window.__afkAllocCap = function () { return reborn() ? 200 : 60; };

  // 屬性效果表：100 以上依 80→100 的斜率延伸
  if (typeof window.lookupStep === 'function') {
    var oLook = window.lookupStep;
    window.lookupStep = function (val, table, def) {
      if (!(val > 100) || !reborn()) return oLook.apply(this, arguments);
      var v100 = oLook(100, table, def), v80 = oLook(80, table, def);
      if (typeof v100 !== 'number' || typeof v80 !== 'number') return v100;
      return v100 + Math.floor((v100 - v80) / 20 * (val - 100));
    };
  }

  // 用 if 分段寫的表（爆擊率、藥水加成）不經過 lookupStep，另外套同一條延伸公式（玩家 2026-10-24：100 以上都要照延伸算）
  ['getStrMeleeCrit', 'getDexRangedCrit', 'getIntMagicCrit', 'getConPotionPct'].forEach(function (fn) {
    var o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function (v) {
      if (!(v > 100) || !reborn()) return o.apply(this, arguments);
      var a = o.call(this, 100), b = o.call(this, 80);
      return a + Math.floor((a - b) / 20 * (v - 100));
    };
  });

  // 超過屬性上限的部分（裝備、Buff、血盟等其他來源）仍算進「攻擊」與「魔法」公式：
  // 核心在夾上限前呼叫 __afkAttrBoost → 這裡記下夾之前的值；近戰／遠程／魔法的傷害、命中、爆擊、額外魔法點數改用夾之前的值查表
  var oBoostR = window.__afkAttrBoost;
  window.__afkAttrBoost = function (p, d) {
    var r; if (typeof oBoostR === 'function') r = oBoostR.apply(this, arguments);
    try { d._raw = { str: d.str, dex: d.dex, int: d.int, con: d.con, wis: d.wis, cha: d.cha }; } catch (e) {}
    return r;
  };
  var useRaw = function (fn, key) {
    var o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function (v) {
      try { var d = player && player.d, raw = d && d._raw && d._raw[key]; if (raw > v && v === d[key] && v >= window.__afkAttrCap()) return o.call(this, raw); } catch (e) {}
      return o.apply(this, arguments);
    };
  };
  [['getStrMeleeDmg', 'str'], ['getStrMeleeHit', 'str'], ['getStrMeleeCrit', 'str'], ['getDexRangedDmg', 'dex'], ['getDexRangedHit', 'dex'], ['getDexRangedCrit', 'dex'],
   ['getIntMagicDmg', 'int'], ['getIntMagicHit', 'int'], ['getIntMagicCrit', 'int'], ['getIntExtraMp', 'int']].forEach(function (a) { useRaw(a[0], a[1]); });

  // 能力面板：屬性超過上限時顯示「200(+XXX)」（超出的部分仍算進攻擊與魔法公式）
  if (typeof window._updateUIImpl === 'function') {
    var oUI = window._updateUIImpl;
    window._updateUIImpl = function () {
      var r = oUI.apply(this, arguments);
      try {
        var d = player && player.d, raw = d && d._raw, cap = window.__afkAttrCap();
        if (raw && reborn() && !(typeof _respec !== 'undefined' && _respec)) ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (k) {
          var el = document.getElementById('dt-' + k); if (!el) return;
          var over = (raw[k] || 0) - cap;
          if (over > 0 && d[k] >= cap) { var t = cap + '(+' + over + ')'; if (el.textContent !== t) el.textContent = t; }
        });
      } catch (e) {}
      return r;
    };
  }

  // 面板 +50
  var oRe = window.recomputeStats;
  window.recomputeStats = function () {
    var r = oRe.apply(this, arguments);
    try {
      if (reborn() && player.d) {
        var d = player.d;
        ['meleeDmg', 'meleeHit', 'rangedDmg', 'rangedHit', 'magicDmg', 'magicHit', 'extraMp', 'resFire', 'resWater', 'resWind', 'resEarth', 'mr', 'er']
          .forEach(function (k) { d[k] = (Number(d[k]) || 0) + 50; });
        d.ac = (Number(d.ac) || 0) - 50;
        if (player.devResist > 0) ['resFire', 'resWater', 'resWind', 'resEarth', 'resNone'].forEach(function (k) { d[k] = (Number(d[k]) || 0) + player.devResist; });   // 開發測試：五屬性抗性
        // 魔法公式用的 SP：面板 +50 額外魔法點數要算進道具 SP；INT 超過 100 的成長不再被原版的 33 封頂吃掉
        //   （原版 INT 100＝35 點只取 33；轉生後 INT 每多出的點照延伸曲線往上加）
        d.itemSp = (Number(d.itemSp) || 0) + 50;
        try { var rawInt = Math.max(0, getIntExtraMp(d.int)); if (rawInt > 35) d.intSp = 33 + (rawInt - 35); } catch (e) {}
      }
    } catch (e) {}
    return r;
  };

  // 轉生時保留 Lv100 的等級 HP／MP（之後升級再往上加）：核心補丁 29 在重算裡「夾 HP 之前」呼叫，
  //   直接加進上限，HP／MP 不會被夾到比較低的上限
  var maxAdds = [];
  window.__afkMaxAdd = function (p) { for (var i = 0; i < maxAdds.length; i++) maxAdds[i](p); };
  window.__afkMaxAdd.add = function (fn) { maxAdds.push(fn); };
  window.__afkMaxAdd.add(function (p) {
    if (!p || !(p.rebirth > 0)) return;
    if (p.rebirthHpKeep) p.mhp = (Number(p.mhp) || 0) + p.rebirthHpKeep;
    if (p.rebirthMpKeep) p.mmp = (Number(p.mmp) || 0) + p.rebirthMpKeep;
  });

  // 轉生：自動擁有該職業全部四種精通（核心補丁 25 把 p.mastery === 'x' 的比較改走 _afkM）
  window._afkM = function (p, id) {
    if (!p) return false;
    if (p.mastery === id) return true;
    try { return !!(p.rebirth > 0 && typeof MASTERY_DATA !== 'undefined' && MASTERY_DATA[p.cls] && MASTERY_DATA[p.cls].list[id]); } catch (e) { return false; }
  };
  if (typeof window.hasMastery === 'function') window.hasMastery = function (id) { return window._afkM(player, id); };
  if (typeof window.allyHasMastery === 'function') window.allyHasMastery = function (ally, id) { return window._afkM(ally, id); };

  // 等級上限：轉生後 150（Lv100 以上每級需求依 Lv99 需求每級 +10% 遞增）
  window.__afkLvCap = function (p) { return (p && p.rebirth > 0) ? 150 : 100; };
  // 滿等不再擁有經驗值（玩家 2026-10-30 20:43）：升級判定之後，到達等級上限就把經驗歸零（經典模式不變）
  if (typeof window.checkLvUp === 'function') {
    var oLvUp = window.checkLvUp;
    window.checkLvUp = function () {
      var r = oLvUp.apply(this, arguments);
      try { var p = player; if (p && p.cls && !p.classicMode && (p.lv || 1) >= window.__afkLvCap(p) && p.exp > 0) p.exp = 0; } catch (e) {}
      return r;
    };
  }
  if (typeof window.getExpReq === 'function') {
    var oReq = window.getExpReq;
    window.getExpReq = function (lv) {
      if (lv >= 100 && lv < 150) {   // 只有轉生角色到得了 100 以上（傭兵升級也走這裡）
        var b = oReq(99); return isFinite(b) ? Math.floor(b * (1 + 0.1 * (lv - 99))) : b; }
      return oReq.apply(this, arguments);
    };
  }
  if (typeof window.getExpGainMult === 'function') {
    var oGain = window.getExpGainMult;
    window.getExpGainMult = function (lv) { if (lv >= 100 && lv < 150) return 1; return oGain.apply(this, arguments); };   // 只有轉生角色到得了 100 以上
  }
  // 傭兵：任何職業都能帶 7 名；轉生後 15 名（連自己 16 人上場）
  if (typeof window.allyActiveCap === 'function') window.allyActiveCap = function () { return reborn() ? 15 : 7; };

  // 雙持：玩家 2026-10-28 移除「轉生後任何武器都能雙持」——照原本的職業規則（戰士雙斧等）。
  //   已經用轉生雙持拿在副手、照原規則不能拿的武器：讀檔／重算時自動卸回背包。
  var dropIllegalOff = function () {
    try {
      var p = player; if (!p || !p.eq || !p.eq.offwpn) return;
      var ok = typeof window.dualWieldOffhandOk === 'function' ? window.dualWieldOffhandOk() : false;
      var wOk = typeof window.warriorDualWieldWpnOk === 'function' ? window.warriorDualWieldWpnOk(p.eq.offwpn.id) : false;
      if (ok && wOk) return;
      if (typeof unequipItem === 'function') { unequipItem('offwpn'); logSys('<span class="text-amber-300">轉生不再能任意雙持：副手武器已卸下放回背包。</span>'); }
    } catch (e) {}
  };
  if (typeof window.loadGame === 'function') { var oLoadDW = window.loadGame; window.loadGame = function () { var r = oLoadDW.apply(this, arguments); setTimeout(dropIllegalOff, 0); return r; }; }

  // 轉生
  window.doRebirth = function (force) {
    if (!player) return { ok: false, msg: '請先進入遊戲。' };
    if (reborn()) return { ok: false, msg: '這個角色已經輪迴轉生過了。' };
    if ((player.lv || 1) < 100) return { ok: false, msg: '需要 Lv100 才能輪迴轉生。' };
    var go = function () {
      // 先量 Lv100 與 Lv1 的 HP／MP 差（同一身裝備），轉生後保留這段等級成長
      var hp100 = 0, mp100 = 0, hp1 = 0, mp1 = 0;
      try { player.rebirthHpKeep = 0; player.rebirthMpKeep = 0; player.lv = 100; calcStats(); hp100 = player.mhp; mp100 = player.mmp; player.lv = 1; calcStats(); hp1 = player.mhp; mp1 = player.mmp; } catch (e) {}
      player.rebirth = 1;
      player.rebirthHpKeep = Math.max(0, Math.round(hp100 - hp1));
      player.rebirthMpKeep = Math.max(0, Math.round(mp100 - mp1));
      player.lv = 1; player.exp = 0;
      try { calcStats(); } catch (e) {}
      player.hp = player.mhp; player.mp = player.mmp;
      try { logSys('<span class="c-sherine font-bold">輪迴已畢。</span><span class="text-fuchsia-200">你走過了死與生的邊界，再啟新生——回到 Lv1，保留全部屬性；屬性上限提升至 200、裝備不限職業、面板能力 +50，治療藥水的基礎補量變為 3 倍。</span>'); } catch (e) {}
      try { updateUI(); renderTabs(true); saveGame(); } catch (e) {}
    };
    if (force) { go(); return { ok: true }; }
    var msg = '輪迴轉生後等級回到 1、經驗歸零（屬性、技能、裝備、背包都保留）。\n獲得：屬性上限 200、裝備不限職業、面板能力 +50；治療藥水基礎補量變為 3 倍（例如 5～80 → 15～240）。\n每個角色只能轉生一次，確定嗎？';
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '輪迴轉生', message: msg, okText: '轉生', cancelText: '取消', danger: true, onOk: go });
    else if (confirm(msg)) go();
    return { ok: true, pending: true };
  };
  // 轉生後的治癒魔法：額外強制回復最大 HP 的 20%（全體治癒類 10%）
  var HEAL_SK = ['sk_heal1', 'sk_heal_mid', 'sk_heal2', 'sk_full_heal', 'sk_regen', 'sk_elf_lifespring', 'sk_elf_lifebless'];
  if (typeof window.rollHealingSpell === 'function') {
    var oRoll = window.rollHealingSpell;
    window.rollHealingSpell = function (sk, dS, caster, target) {
      var v = oRoll.apply(this, arguments);
      try {
        if (v > 0 && caster && caster.rebirth > 0 && sk && HEAL_SK.some(function (id) { return DB.skills[id] === sk; })) {
          var mx = (typeof healingSpellTargetMhp === 'function') ? healingSpellTargetMhp(target) : (target && target.mhp) || 0;
          v += Math.floor((Number(mx) || 0) * (sk.groupHeal ? 0.10 : 0.20));
        }
      } catch (e) {}
      return v;
    };
  }
  // 精通之道（漢）：轉生後顯示「刻苦修行完全精通」（四種精通全部生效，不必再選）
  if (typeof window.renderHanNPC === 'function') {
    var oHan = window.renderHanNPC;
    window.renderHanNPC = function (div) {
      if (!reborn() || !div || typeof MASTERY_DATA === 'undefined' || !MASTERY_DATA[player.cls]) return oHan.apply(this, arguments);
      var md = MASTERY_DATA[player.cls];
      var cards = Object.keys(md.list).map(function (k) {
        var m = md.list[k];
        return '<div class="bg-slate-800/70 border-2 border-yellow-500/70 rounded p-3 text-left"><div class="font-bold text-yellow-300">★ ' + m.n + '</div><div class="text-xs text-slate-300 mt-1 leading-relaxed">' + (m.d || m.msg || '') + '</div></div>';
      }).join('');
      div.innerHTML = '<div class="flex flex-col gap-3 p-2 items-center">'
        + '<div class="text-amber-200 font-bold text-lg tracking-widest">—— 精 通 之 道 ——</div>'
        + '<div class="text-sm text-slate-300">目前精通：<span class="text-yellow-300 font-bold">刻苦修行完全精通</span></div>'
        + '<div class="text-slate-400 text-xs">漢：走過輪迴的人，已經把四條路都走完了。四種精通同時生效，不必再選。</div>'
        + '<div class="grid gap-2 w-full max-w-[560px]" style="grid-template-columns:1fr 1fr;">' + cards + '</div></div>';
    };
  }
  // 裝備圖（嵌入式裝備面板）：雙持時在左右兩格標「主手／副手」，滑過顯示名稱（玩家 2026-10-27：看不出左右手各拿什麼）
  (function () {
    var tag = function () {
      try {
        var host = document.getElementById('equipment-window-slots'); if (!host || typeof player === 'undefined' || !player || !player.eq) return;
        var w = player.eq.wpn, o = player.eq.offwpn;
        [[w, '主手'], [o, '副手']].forEach(function (x) {
          if (!x[0] || !o) return;
          var el = host.querySelector('[data-tip-uid="' + x[0].uid + '"]'); if (!el || el.querySelector('.afk-hand-tag')) return;
          var t = document.createElement('span'); t.className = 'afk-hand-tag'; t.textContent = x[1]; el.appendChild(t);
          var d = DB.items[x[0].id]; if (d) el.setAttribute('aria-label', x[1] + '：' + d.n);
        });
      } catch (e) {}
    };
    var st = document.createElement('style');
    st.textContent = '.afk-hand-tag{position:absolute;z-index:10;left:50%;top:-1px;transform:translate(-50%,-60%);padding:0 4px;font-size:10px;line-height:14px;border-radius:3px;background:#211e22;border:1px solid #a97a50;color:#e8c48a;white-space:nowrap;pointer-events:none}';
    var root = document.head || document.documentElement; if (root && root.appendChild) root.appendChild(st);
    var hook = function () {
      var host = document.getElementById && document.getElementById('equipment-window-slots'); if (!host || typeof MutationObserver === 'undefined') return false;
      new MutationObserver(tag).observe(host, { childList: true }); tag(); return true;
    };
    try { if (!hook() && document.addEventListener) document.addEventListener('DOMContentLoaded', hook); } catch (e) {}
  })();
  window.__afkRebirth = { reborn: reborn, potionMultiplier: potionMultiplier };
  console.log('[AFK-rebirth] 已啟用：輪迴轉生');
})();
