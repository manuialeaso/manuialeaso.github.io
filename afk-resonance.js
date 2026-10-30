/* ============================================================================
 * afk-resonance.js — 共鳴調整（玩家 2026-10-30 17:45；外掛開關 resonancenerf，預設開）
 *
 *   魔杖「共鳴」（一般攻擊 智力/60 機率免費發一支光箭，命中回 MP＝傷害/10，共鳴精通 /5）：
 *   光箭傷害 −50%；回 MP 用減半後的傷害算，所以回魔也 −50%。玩家與傭兵都一樣。經典模式不改（照原作）。
 *   作用點：核心補丁 72 在共鳴光箭的最終倍率之後呼叫 window.__afkResoMult(施放者)。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'resonancenerf', name: '共鳴調整（傷害與回魔 −50%）', group: '遊戲玩法',
    desc: '魔杖共鳴觸發的光箭傷害 −50%，回 MP 也跟著 −50%（玩家與傭兵；經典模式照原作）' });
  var MULT = 0.5;
  W.__afkResoMult = function (who) {
    if (T && !T.enabled('resonancenerf')) return 1;
    try { if (who && who.classicMode) return 1; } catch (e) {}
    return MULT;
  };
  W.__afkResonance = { MULT: MULT };
})();
