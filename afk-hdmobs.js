/* ============================================================================
 * afk-hdmobs.js — GPT新美術：新怪物專屬動畫（寫實復古版，29 隻；玩家 2026-10-30 15:40 提供；開關併入「GPT新美術」art-v3，預設開）
 *
 *   這 29 隻原本借用現有怪物的圖（庫傑＝強盜頭目、歐林＝玩家男法師…，見 docs/gpt-art-brief.md），
 *   現在改用自己的動畫：assets/anim/<怪物名稱>/ idle_0～11、attack_0～7、skill_0～7（施法角色）、hurt_0～3、death_0～11。
 *   做法：拿掉借圖別名（MOB_ANIM_ALIAS），並把從借圖那隻複製過來的設定（影子、8 方向、武器層、技能特效、位置微調…）一起拿掉，
 *         讓核心直接去讀自己的資料夾。關掉開關＝換回借圖（不用重新整理）。
 *   壓縮：1,124 張 PNG 原本 6.0 MB → 無損重壓 5.5 MB（像素完全一樣）；檢視用 GIF、圖集與製作腳本不放進遊戲。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  // 開關：併入「GPT新美術」（art-v3，玩家 2026-10-30 16:27），由 afk-gptart-icons／afk-art-v3 登錄
  var NAMES = ['通緝犯 庫傑', '大魔法師 歐林', '黑翼賽尼斯', '失控的巴風特', '大魔法師 哈汀', '火焰之影（真身）', '闇龍 哈爾巴斯',
    '幽靈船長', '船舶之墓的溺死者', '溺死的水手', '詛咒的媒介', '魔族獵龍隊長', '魔族獵龍隊員', '篡位者的刺客頭目',
    '背誓的銀騎士 歐德', '腐化的卡司特之王', '蛛巢之母', '沉沒的海賊王 德雷克', '古魯丁的守墓人', '肯特草原的狂暴歐吉',
    '失控的實驗體「零號」', '暴走的古代高崙', '奇岩叢林的虎王', '龍之谷的古老飛龍', '熔岩之心 阿西塔基奧', '歐瑞雪原的雪怪王',
    '黃昏山脈的巨人王', '傲慢之塔的守門人', '叛亂的黑暗長老'];
  var SKILL = { '大魔法師 歐林': 1, '黑翼賽尼斯': 1, '失控的巴風特': 1, '大魔法師 哈汀': 1, '火焰之影（真身）': 1, '闇龍 哈爾巴斯': 1,
    '幽靈船長': 1, '魔族獵龍隊長': 1, '篡位者的刺客頭目': 1, '叛亂的黑暗長老': 1 };
  var SETS = ['MOB_ANIM_BAKED_SHADOW', 'MOB_SHADOW_TINT', 'MOB_ANIM_BIG', 'MOB_ANIM_SMALL', 'MOB_ANIM_SPRITE_SHADOW', 'MOB_ANIM_WEAPON_FX', 'MOB_ANIM_WEAPON_FX2', 'MOB_ANIM_8DIR'];
  var OBJS = ['MOB_ANIM_SKILL_FX', 'MOB_YLIFT', 'MOB_ANIM_DEATH_FX'];   // 音效（受擊、擊殺、攻擊）與登場特效保留借圖那隻的
  var GET = function (n) { try { return (0, eval)(n); } catch (e) { return undefined; } };   // const／let 宣告的全域不在 window 上
  var saved = null;   // 借圖時的設定，關掉開關時還原
  var dropCache = function (n) { try { var c = GET('_mobAnimCache'); if (c) delete c[n]; } catch (e) {} };
  var apply = function () {
    if (saved) return;
    var alias = GET('MOB_ANIM_ALIAS'), names = GET('MOB_ANIM_NAMES'); if (!alias || !names) return;
    saved = {};
    NAMES.forEach(function (n) {
      var s = saved[n] = { alias: alias[n], had: names.has(n), sets: [], objs: {} };
      delete alias[n]; names.add(n);
      SETS.forEach(function (k) { var o = GET(k); if (o && o.has && o.has(n)) { o.delete(n); s.sets.push(k); } });
      OBJS.forEach(function (k) { var o = GET(k); if (o && o[n] != null) { s.objs[k] = o[n]; delete o[n]; } });
      dropCache(n);
    });
  };
  var restore = function () {
    if (!saved) return;
    var alias = GET('MOB_ANIM_ALIAS'), names = GET('MOB_ANIM_NAMES');
    Object.keys(saved).forEach(function (n) {
      var s = saved[n];
      if (alias && s.alias != null) alias[n] = s.alias;
      if (names && !s.had) names.delete(n);
      s.sets.forEach(function (k) { var o = GET(k); if (o && o.add) o.add(n); });
      Object.keys(s.objs).forEach(function (k) { var o = GET(k); if (o) o[n] = s.objs[k]; });
      dropCache(n);
    });
    saved = null;
  };
  var on = function () { return !T || T.enabled('art-v3'); };
  var sync = function () { if (on()) apply(); else restore(); try { if (typeof renderMobs === 'function' && typeof state !== 'undefined' && !state.ff) renderMobs(); } catch (e) {} };
  sync();
  if (T && typeof T.set === 'function') {
    var oSet = T.set;
    T.set = function (id) { var r = oSet.apply(this, arguments); if (id === 'art-v3') sync(); return r; };
  }
  W.__afkHdMobs = { NAMES: NAMES, SKILL: SKILL, applied: function () { return !!saved; }, apply: apply, restore: restore };
})();
