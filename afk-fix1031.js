/* ============================================================================
 * afk-fix1031.js — 實測回報修正（玩家 2026-10-31 02:50；外掛開關 fix1031，預設開）
 *
 *   一、裝備函式容錯：equipItem 收到「物品 id 字串」或還沒建立資料的 +N 遺物衍生 id（例：xxx~r15）時，
 *       原本直接讀不到資料而出錯（Cannot read properties of undefined (reading 'type')）。
 *       現在：字串 → 找背包裡同 id 的那件；衍生 id 先補建資料；還是找不到就提示、不出錯。
 *   二、換地圖提示：抵達野外／地監／副本時，戰鬥日誌多一行「抵達 ○○」，看得出已經離開村莊。
 *   三、遺物收集冊：+N、昇華、詞綴重洗後的遺物（id 帶 ~ 的衍生物品）也登錄成原本那件遺物；
 *       開收集冊前先把背包、身上、倉庫的遺物補登錄（任何方式拿到的都算）。
 *   四、無法裝備的原因（2026-10-31 03:43）：有等級限制的裝備（亞丁古物的 Lv.45 巴拉卡斯的魅惑等 40 件）原本只寫「無法裝備」，
 *       現在背包標籤、物品視窗、按鈕都寫出「Lv.45 才能裝備（目前 Lv.36）」，物品效果也列出限制等級（核心補丁 77 呼叫這裡）。
 *   五、暗夢星迴（2026-10-31 04:24：花 1000 顆龜裂之核進去，23 秒就離開，領取獎勵是空的）：
 *       ‧暗夢星迴本來就沒有停留獎勵（只有擊倒夢境者的投影才有掉落）；離開時改寫清楚，不再叫你去入口「領取獎勵」。
 *       ‧在暗夢星迴裡換地圖、換地區、撤離，先跳確認視窗（離開沒有獎勵、龜裂之核不退還），避免誤觸。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'fix1031', name: '修正：遺物裝備、換地圖提示、遺物收集冊', group: '系統與其他', seal: true,
    desc: '+N 遺物用指令裝備不再出錯；抵達戰鬥地圖時戰鬥日誌提示；+N／昇華遺物也算進遺物收集冊，開冊時補登錄' });
  var on = function () { return !T || T.enabled('fix1031'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var rebind = function (name, fn) { W[name] = fn; try { (0, eval)(name + ' = window.' + name); } catch (e) {} };
  var baseId = function (id) { return String(id || '').split('~')[0]; };

  // ── 一、裝備函式容錯 ──
  var resolveItem = function (it) {
    var p = P(); if (!p) return it;
    if (typeof it === 'string') {
      var id = it;
      it = (p.inv || []).find(function (x) { return x && x.id === id; }) || null;
      if (!it) return null;
    }
    if (it && it.id && !DB.items[it.id] && String(it.id).indexOf('~') >= 0) {
      try { if (W.__afkRelicData && W.__afkRelicData.ensure) W.__afkRelicData.ensure(it.id); } catch (e) {}
    }
    return it;
  };
  if (typeof W.equipItem === 'function') {
    var oEquip = W.equipItem;
    rebind('equipItem', function (item) {
      if (!on()) return oEquip.apply(this, arguments);
      var it = resolveItem(item);
      if (!it || !it.id || !DB.items[it.id]) {
        try { logSys('<span class="text-amber-300">找不到這件物品（' + String((item && item.id) || item || '') + '），無法裝備。</span>'); } catch (e) {}
        return;
      }
      var args = Array.prototype.slice.call(arguments); args[0] = it;
      return oEquip.apply(this, args);
    });
  }

  // ── 五、暗夢星迴：離開確認 ──
  var leaveOk = false;
  var inDream = function () { try { return !!(state.dreamStar && state.riftRun); } catch (e) { return false; } };
  var askLeave = function (go) {
    var run = function () { leaveOk = true; try { go(); } finally { leaveOk = false; } };
    var stay = function () { try { if (typeof syncMapSelectors === 'function') syncMapSelectors(); } catch (e) {} };
    var msg = '暗夢星迴沒有停留獎勵——只有擊倒夢境者的投影才會留下掉落。\n現在離開，這次的 1000 顆龜裂之核不會退還。\n\n確定要離開嗎？';
    if (W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '離開暗夢星迴？', message: msg, okText: '離開', cancelText: '留下來', danger: true, onOk: run, onCancel: stay, onDismiss: stay });
    else if (W.confirm(msg)) run(); else stay();
  };
  if (typeof W.riftEvacuate === 'function') {
    var oEvac = W.riftEvacuate;
    rebind('riftEvacuate', function () {
      var self = this, args = arguments;
      if (on() && !leaveOk && inDream()) { askLeave(function () { return oEvac.apply(self, args); }); return; }
      return oEvac.apply(this, arguments);
    });
  }
  if (typeof W.riftEndRun === 'function') {
    var oEnd = W.riftEndRun;
    rebind('riftEndRun', function () {
      if (!on() || !inDream()) return oEnd.apply(this, arguments);
      var t0 = Date.now() - (Number(state.riftStartMs) || Date.now()), oLog = W.logSys, r;
      if (typeof oLog === 'function') W.logSys = function (h) { if (/你離開了時空裂痕|你自夢境中醒轉/.test(String(h))) return; return oLog.apply(this, arguments); };
      try { r = oEnd.apply(this, arguments); } finally { if (typeof oLog === 'function') W.logSys = oLog; }
      try {
        var tm = typeof fmtPrideTime === 'function' ? fmtPrideTime(Math.max(0, t0)) : '';
        logSys('<span class="font-bold" style="color:#c4b5fd;">🌀 你離開了暗夢星迴' + (tm ? '（停留 ' + tm + '）' : '') + '。星迴試煉沒有停留獎勵，只有擊倒夢境者的投影才會留下掉落。</span>');
      } catch (e) {}
      return r;
    });
  }

  // ── 二、換地圖提示 ──
  if (typeof W.changeMap === 'function') {
    var oChange = W.changeMap;
    rebind('changeMap', function (force) {
      var self = this, args = arguments;
      if (on() && !force && !leaveOk && inDream()) {
        var tgt = (document.getElementById('map-select') || {}).value;
        if (tgt && tgt !== mapState.current) { askLeave(function () { return oChange.apply(self, args); }); return; }
      }
      var before = (typeof mapState !== 'undefined' && mapState.current) || '';
      var r = oChange.apply(this, arguments);
      try {
        var cur = (typeof mapState !== 'undefined' && mapState.current) || '';
        if (on() && cur && cur !== before && !/^town_/.test(cur) && !(typeof state !== 'undefined' && state.ff) && typeof logCombat === 'function') {
          var nm = (typeof mapDisplayName === 'function' && mapDisplayName(cur)) || cur;
          logCombat('<span class="text-sky-300 font-bold">—— 抵達 ' + nm + ' ——</span>', 'system');
        }
      } catch (e) {}
      return r;
    });
  }

  // ── 三、遺物收集冊 ──
  var dexReg = function (i) {
    var p = P(); if (!p || !i || !i.id || typeof RELIC_ITEM_CAT === 'undefined') return false;
    var b = baseId(i.id); if (b === i.id || !RELIC_ITEM_CAT[b]) return false;
    if (!p.relicDex) p.relicDex = {};
    if (p.relicDex[b]) return false;
    p.relicDex[b] = true; return true;
  };
  if (typeof W.registerRelicObtained === 'function') {
    var oReg = W.registerRelicObtained;
    rebind('registerRelicObtained', function (id) {
      var r = oReg.apply(this, arguments);
      try { if (on() && dexReg({ id: id }) && typeof saveRelicDex === 'function') saveRelicDex(); } catch (e) {}
      return r;
    });
  }
  var scanDerived = function (warehouse) {
    var p = P(); if (!p) return;
    var changed = false, reg = function (i) { if (dexReg(i)) changed = true; };
    (p.inv || []).forEach(reg);
    if (p.eq) Object.keys(p.eq).forEach(function (k) { reg(p.eq[k]); });
    try { var w = warehouse || (typeof loadWarehouse === 'function' ? loadWarehouse() : null); if (w && Array.isArray(w.items)) w.items.forEach(reg); } catch (e) {}
    if (changed && typeof saveRelicDex === 'function') saveRelicDex();
  };
  if (typeof W.ensureRelicDex === 'function') {
    var oEnsure = W.ensureRelicDex;
    rebind('ensureRelicDex', function (warehouse) {
      var r = oEnsure.apply(this, arguments);
      try { if (on()) scanDerived(warehouse); } catch (e) {}
      return r;
    });
  }
  if (typeof W.openRelicBook === 'function') {
    var oOpen = W.openRelicBook;
    rebind('openRelicBook', function () {
      try { if (on() && typeof ensureRelicDex === 'function') ensureRelicDex(); } catch (e) {}
      return oOpen.apply(this, arguments);
    });
  }

  // ── 四、無法裝備的原因 ──
  var lvRange = function (d) { return d ? { min: Number(d.ttmiMinLevel) || 0, max: Number(d.ttmiMaxLevel) || 0 } : { min: 0, max: 0 }; };
  var lvText = function (r) { return (r.min ? 'Lv.' + r.min + ' 以上' : '') + (r.min && r.max ? '、' : '') + (r.max ? 'Lv.' + r.max + ' 以下' : ''); };
  W.__afkEquipReqText = function (d) { var r = lvRange(d); return (r.min || r.max) ? '限制等級：' + lvText(r) : ''; };
  W.__afkEquipWhy = function (item, short) {
    try {
      var p = P(), d = item && DB.items[item.id]; if (!p || !d) return '';
      var r = lvRange(d), lv = Number(p.lv) || 0;
      if ((r.min && lv < r.min) || (r.max && lv > r.max)) {
        if (short) return r.min && lv < r.min ? 'Lv.' + r.min + ' 才能裝備' : 'Lv.' + r.max + ' 以下才能裝備';
        return '限制等級 ' + lvText(r) + '（目前 Lv.' + lv + '）';
      }
      if (!d.reqAvatar && typeof d.req === 'string' && d.req !== 'all' && d.req.split(',').indexOf(p.cls) < 0) return '職業不符';
    } catch (e) {}
    return '';
  };

  W.__afkFix1031 = { resolveItem: resolveItem, baseId: baseId, scanDerived: scanDerived };
})();
