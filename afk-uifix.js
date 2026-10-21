/* ============================================================================
 * afk-uifix.js — 介面小修（玩家 2026-10-21 指定）
 *
 * ‧點左邊的地區選單切換地區時，優先飛到該地區的安全區域（村莊）；該地區沒有村莊才照原本（上次到過的地圖／第一張）
 * ‧（NPC 對話框字體統一：哈瑪大師、奧拉奇里亞改放進遊戲本身的 NPC 對話框，見 afk-relicplus／afk-arts）
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('uifix')) return;

  if (typeof window.onMapCategoryChange === 'function' && typeof window.regionMapList === 'function') {
    var oCat = window.onMapCategoryChange;
    window.onMapCategoryChange = function () {
      try {
        var cat = document.getElementById('map-category').value;
        var list = regionMapList(cat);
        var ok = function (m) { return !(typeof mapOptDisabled === 'function' && mapOptDisabled(m)); };
        var town = list.find(function (m) { return String(m.v).indexOf('town_') === 0 && ok(m); });
        if (town) {
          if (typeof populateMapSelect === 'function') populateMapSelect(cat);
          document.getElementById('map-select').value = town.v;
          changeMap();
          return;
        }
      } catch (e) {}
      return oCat.apply(this, arguments);
    };
  }

  console.log('[AFK-uifix] 已啟用：切換地區優先到安全區');
})();
