/* ============================================================================
 * afk-fix1031.js — 實測回報修正（玩家 2026-10-31 02:50；外掛開關 fix1031，預設開）
 *
 *   一、裝備函式容錯：equipItem 收到「物品 id 字串」或還沒建立資料的 +N 遺物衍生 id（例：xxx~r15）時，
 *       原本直接讀不到資料而出錯（Cannot read properties of undefined (reading 'type')）。
 *       現在：字串 → 找背包裡同 id 的那件；衍生 id 先補建資料；還是找不到就提示、不出錯。
 *   二、換地圖提示：抵達野外／地監／副本時，戰鬥日誌多一行「抵達 ○○」，看得出已經離開村莊。
 *   三、遺物收集冊：+N、昇華、詞綴重洗後的遺物（id 帶 ~ 的衍生物品）也登錄成原本那件遺物；
 *       開收集冊前先把背包、身上、倉庫的遺物補登錄（任何方式拿到的都算）。
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

  // ── 二、換地圖提示 ──
  if (typeof W.changeMap === 'function') {
    var oChange = W.changeMap;
    rebind('changeMap', function () {
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

  W.__afkFix1031 = { resolveItem: resolveItem, baseId: baseId, scanDerived: scanDerived };
})();
