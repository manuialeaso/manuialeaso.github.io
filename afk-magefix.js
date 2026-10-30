/* ============================================================================
 * afk-magefix.js — 法師修補：體力回復術（玩家 2026-10-31 00:47；外掛開關 magefix，預設開）
 *
 *   體力回復術（sk_regen，全隊瞬間治癒）：
 *     ‧智力加成不封頂：原本 INT 80 以上的治癒骰數加成停在 +21（INT 每 5 點 +1 到 80 為止），現在照同一個斜率一路往上算。
 *     ‧另外每個受治療的成員再回復「目前 HP 的 5%」。
 *   溢出的部分照原本規則變成護盾（afk-rebirth-rules，上限最大 HP 40%）。經典模式不變。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'magefix', name: '法師修補（體力回復術）', group: '遊戲玩法', seal: true,
    desc: '體力回復術：智力的治癒加成不封頂，另外每個受治療的成員再回復目前 HP 的 5%' });
  var on = function () { try { return (!T || T.enabled('magefix')) && !!(player && player.cls && !player.classicMode); } catch (e) { return false; } };
  var capBonus = function (int) { return 10 + Math.floor((int - 25) / 5); };   // 核心：INT 26 以上＝10＋(INT−25)/5，最多 21
  if (typeof W.rollHealingSpell === 'function') {
    var oRoll = W.rollHealingSpell;
    W.rollHealingSpell = function (sk, dStats, caster, target) {
      var r = oRoll.apply(this, arguments);
      try {
        if (!on() || !sk || sk !== (DB.skills && DB.skills.sk_regen) || !(r > 0)) return r;
        var c = sk.classicHeal, int = Math.max(0, Math.floor(Number(dStats && dStats.int) || 0));
        if (c && int > 80) {
          var base = Math.floor(Number(c.baseDice) || 0), capped = base + 21, full = base + capBonus(int);
          if (full > capped) r = Math.floor(r * full / capped);   // 骰數照比例放大（期望值相同）
        }
        var cur = 0;
        try { cur = typeof healingSpellTargetHp === 'function' ? healingSpellTargetHp(target) : (target === player ? player.hp : (target && (target.curHp != null ? target.curHp : target.hp)) || 0); } catch (e) {}
        var fw = 1; try { if (typeof foulWaterHealMult === 'function') fw = foulWaterHealMult(target); } catch (e) {}   // 汙濁之水照樣減半
        r += Math.floor(Math.max(0, cur) * 0.05 * fw);
      } catch (e) {}
      return r;
    };
    try { rollHealingSpell = W.rollHealingSpell; } catch (e) {}
  }
  W.__afkMageFix = { capBonus: capBonus };
})();
