/* ============================================================================
 * afk-dropcap.js — 掉落種類下修（玩家 2026-10-29；需核心補丁 68）
 *   怪物掉落表（MOB_DROPS，含透視鏡匯入、時空裂痕的掉落）每次擊殺先全部擲一遍，擲中的再下修 30%：
 *     擲中 n 種 → 只給 round(n×0.7) 種（至少 1 種），隨機挑。例：頭目擲中 10 種 → 7 種；小怪擲中 3 種 → 2 種。
 *     必掉的（掉落表上本來就寫 100% 的，例如頭目必掉的材料、試煉道具）不算在內，照樣全給；
 *     靠席琳／夢域／隊伍倍率疊到 100% 以上的不算必掉，一樣要下修。
 *   其他掉落（卡片、萬能藥、遺物額外判定、副本專屬獎勵…）不受影響。
 *   （第一版是「一般怪 1～3 種、頭目 3～5 種」；玩家 2026-10-29 15:40 改成一律下修 30%。）
 *   席琳夢域鏡：下修 40%（擲中 10 種只給 6 種；玩家 2026-10-30 20:54）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'dropcap', name: '掉落種類下修 30%', group: '遊戲玩法',
    desc: '每次擊殺從怪物掉落表擲中的物品種類下修 30%（擲中 10 種只給 7 種、3 種給 2 種），席琳夢域鏡下修 40%；掉落表上本來就 100% 的必掉物品不算' });
  if (T && !T.enabled('dropcap')) return;
  var RATE = 0.7, DREAM_RATE = 0.6;
  var dream = function () { try { if (W.__afkDreamHell && W.__afkDreamHell.on) return !!W.__afkDreamHell.on(); return !!(player && player.sherineDream && player.sherineMad); } catch (e) { return false; } };
  W.__afkDropCap = function (bag, mob) {
    var must = [], rest = [];
    bag.forEach(function (x) { ((x.length > 2 ? x[2] : x[1] * 100) >= 100 ? must : rest).push(x[0]); });
    for (var i = rest.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
    var keep = rest.length ? Math.max(1, Math.round(rest.length * (dream() ? DREAM_RATE : RATE))) : 0;
    must.concat(rest.slice(0, keep)).forEach(function (id) { gainItem(id, 1); });
  };
  W.__afkDropCapInfo = { rate: RATE, dreamRate: DREAM_RATE };
})();
