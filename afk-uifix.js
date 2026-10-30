/* ============================================================================
 * afk-uifix.js — 介面小修（玩家 2026-10-21 指定）
 *
 * ‧點左邊的地區選單切換地區時，優先飛到該地區的安全區域（村莊）；該地區沒有村莊才照原本（上次到過的地圖／第一張）
 * ‧換角色時清掉上一隻角色的戰鬥／系統日誌（2026-10-30）
 * ‧（NPC 對話框字體統一：哈瑪大師、奧拉奇里亞改放進遊戲本身的 NPC 對話框，見 afk-relicplus／afk-arts）
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('uifix')) return;

  // 收集冊剪影：不透明的 jpg 圖示（亞丁古物 ttmi）套 brightness(0) 會變成整格黑色方塊 → 改成暗灰（2026-10-30 QA）
  try {
    var st = document.createElement('style'); st.id = 'afk-uifix-css';
    st.textContent = 'img.card-silhouette[src*=".jpg"],img.card-silhouette[src*=".jpeg"]{filter:grayscale(1) brightness(.28) contrast(.9)!important;opacity:.7}'
      // 手機首頁／選角／創角：左上固定的「外掛」「電台」按鈕會蓋住標題與創角說明 → 窄螢幕往下讓出一排（2026-10-30 QA）
      + '@media (max-width:640px){#creation-screen{padding-top:46px!important}}';
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}

  // 換角色時清掉上一隻的戰鬥／系統日誌（2026-10-30 QA：切到別的角色還看得到上一隻的離線收益與掉落）
  if (typeof window.loadGame === 'function') {
    var oLoad = window.loadGame, lastSlot = null;
    window.loadGame = function () {
      try {
        var cur = typeof currentSlot !== 'undefined' ? String(currentSlot) : null;
        if (lastSlot !== null && cur !== lastSlot) ['combat-log', 'sys-log'].forEach(function (id) { var el = document.getElementById(id); if (el) el.innerHTML = ''; });
        lastSlot = cur;
      } catch (e) {}
      return oLoad.apply(this, arguments);
    };
    try { loadGame = window.loadGame; } catch (e) {}
  }

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
