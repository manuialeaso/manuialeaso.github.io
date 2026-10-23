/* ==========================================================================
 * afk-polys.js — 變身補齊（資料來源：天堂透視鏡 www.ttmi.me 速度表．變身，玩家 2026-10-22 指定）
 *
 * 新增（攻擊速度、移動速度、施法速度、硬直都照透視鏡速度表；同名多等級的取最低等級那一列）：
 *   道具變身 Lv52：拉曼斯（近戰）、安迪斯（弓）、艾迪爾（魔杖）
 *   日出之國 Lv52：侍、陰陽師、大名、姬武者（弓）、忍者
 *   特殊死騎 Lv80：闇黑死亡騎士、雷霆死亡騎士、黃金死亡騎士、焚焰死亡騎士
 *   90 級卷軸 Lv90：格利特、特羅斯、伊詩蒂、喬、絲莉安（弓）
 *   其他（只能用變形控制戒指選）：墮落的司祭、歐姆裝甲兵、亞克騎士、生日慶祝妖精（近攻／遠攻／魔法）
 * 沒做：占星術（透視鏡不給讀取）、和服／旗袍／韓服等服裝變身（沒有攻擊速度）
 *
 * 速度表換算：攻＝每分鐘攻擊次數（依武器）；走＝每分鐘移動格數（→ 1440÷走）；
 *   有向施法＝每分鐘攻擊施法次數（→ 600÷值 tick）；硬＝受擊硬直秒數（→ ×10 tick，取單手劍欄）
 * 戰鬥動畫：死騎四種借用烈焰的死亡騎士、絲莉安借用莉絲安；其他沒有專屬圖的借用氣質相近的變身（見 BORROW），夏納穿真夏納的圖
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (typeof POLY_TIERS === 'undefined') { console.warn('[AFK-polys] 找不到變身表，略過'); return; }

  // 透視鏡 11 欄 → 遊戲武器家族
  var COLS = [['單手劍'], ['單手鈍器', '雙手鈍器'], ['弓', '十字弓'], ['單手矛', '雙手矛'], ['魔杖'], ['匕首'], ['雙手劍'], ['雙刀'], ['鋼爪', '奇古獸'], ['鎖鏈劍'], ['雙斧']];
  var form = function (n, lv, atk, walk, castDir, stunSec, extra) {
    var apm = {};
    atk.forEach(function (v, i) { if (v > 0) COLS[i].forEach(function (f) { apm[f] = v; }); });
    var o = { n: n, lv: lv, apm: apm, wlk: Math.max(6, Math.round(1440 / (walk || 90))), cast: castDir > 0 ? Math.round(600 / castDir * 10) / 10 : 12, stun: Math.max(1, Math.round(stunSec * 10)) };
    return Object.assign(o, extra || {});
  };
  var DK = [120, 96, 0, 110, 120, 130, 102, 120, 120, 110, 96];
  var LV52 = [
    form('拉曼斯', 52, [96, 84, 0, 96, 96, 102, 84, 96, 96, 0, 84], 90, 75, 0.58),
    form('安迪斯', 52, [0, 0, 75, 0, 0, 0, 0, 0, 0, 0, 0], 90, 75, 0.58),
    form('艾迪爾', 52, [0, 0, 0, 0, 96, 0, 0, 0, 0, 0, 0], 90, 90, 0.58),
    form('侍', 52, [96, 84, 0, 90, 0, 102, 84, 0, 0, 0, 96], 90, 65, 0.33),
    form('陰陽師', 52, [96, 84, 0, 0, 96, 102, 84, 0, 96, 0, 96], 90, 90, 0.33),
    form('大名', 52, [96, 84, 0, 90, 0, 102, 84, 0, 0, 0, 96], 90, 65, 0.33),
    form('姬武者', 52, [0, 0, 80, 0, 0, 0, 0, 0, 0, 0, 0], 90, 65, 0.42),
    form('忍者', 52, [96, 0, 0, 0, 0, 102, 0, 96, 96, 0, 0], 90, 51, 0.33)
  ];
  var LV80 = [
    form('闇黑死亡騎士', 80, DK, 90, 90, 0.25), form('雷霆死亡騎士', 80, DK, 90, 90, 0.25),
    form('黃金死亡騎士', 80, DK, 90, 90, 0.25), form('焚焰死亡騎士', 80, DK, 90, 90, 0.25),
    form('格利特', 90, [130, 102, 0, 0, 130, 144, 110, 120, 120, 0, 0], 90, 90, 0.21),
    form('特羅斯', 90, [130, 102, 0, 0, 120, 144, 110, 120, 120, 0, 0], 90, 90, 0.25),
    form('伊詩蒂', 90, [120, 96, 0, 0, 120, 130, 102, 110, 110, 0, 0], 90, 96, 0.25),
    form('喬', 90, [120, 96, 0, 0, 120, 130, 102, 110, 110, 0, 0], 90, 96, 0.25),
    form('絲莉安', 90, [0, 0, 96, 0, 0, 0, 0, 0, 0, 0, 0], 90, 90, 0.08)
  ];
  var CTRL = [
    form('墮落的司祭', 52, [72, 72, 55, 72, 72, 72, 60, 72, 72, 72, 72], 60, 60, 0.58, { controlOnly: true }),
    form('歐姆裝甲兵', 30, [32, 32, 0, 0, 32, 32, 32, 32, 32, 0, 32], 36, 30, 0.58, { controlOnly: true }),
    form('亞克騎士', 52, [65, 65, 60, 65, 65, 65, 65, 65, 65, 65, 65], 90, 60, 0.58, { controlOnly: true }),
    form('生日慶祝妖精(近攻型)', 52, [102, 90, 72, 80, 102, 110, 90, 102, 102, 80, 90], 96, 72, 0.25, { controlOnly: true }),
    form('生日慶祝妖精(遠攻型)', 52, [90, 80, 80, 72, 90, 96, 80, 90, 90, 72, 80], 84, 72, 0.25, { controlOnly: true }),
    form('生日慶祝妖精(魔法型)', 52, [90, 80, 72, 72, 90, 96, 80, 90, 90, 72, 80], 84, 80, 0.25, { controlOnly: true })
  ];
  // Collection requirements remain stable when the optional normal-form menu
  // is disabled. This is data only; inserting normal forms still obeys its switch.
  window.__afkPolyCatalog = LV52.concat(LV80, CTRL);
  if (T && !T.enabled('polys')) return;
  var exists = function (n) { return POLY_TIERS.some(function (t) { return t.forms.some(function (f) { return f.n === n; }); }); };
  var tierFor = function (lv) { for (var i = 0; i < POLY_TIERS.length; i++) if (lv >= POLY_TIERS[i].min && lv <= POLY_TIERS[i].max) return POLY_TIERS[i]; return POLY_TIERS[POLY_TIERS.length - 1]; };
  var added = [];
  LV52.concat(LV80).forEach(function (f) { if (exists(f.n)) return; tierFor(f.lv).forms.push(f); added.push(f.n); });
  try { CTRL.forEach(function (f) { if (CONTROL_ONLY_POLY_FORMS.some(function (x) { return x.n === f.n; })) return; f.c = 'text-pink-300'; CONTROL_ONLY_POLY_FORMS.push(f); added.push(f.n); }); } catch (e) {}
  try { ['安迪斯', '姬武者', '絲莉安'].forEach(function (n) { RANGED_POLY_FORMS.add(n); }); } catch (e) {}
  // 戰鬥動畫借用
  try {
    MORPH_BATTLE_ALIAS['闇黑死亡騎士'] = MORPH_BATTLE_ALIAS['雷霆死亡騎士'] = MORPH_BATTLE_ALIAS['黃金死亡騎士'] = MORPH_BATTLE_ALIAS['焚焰死亡騎士'] = '烈焰的死亡騎士';
    MORPH_BATTLE_ALIAS['絲莉安'] = '莉絲安';
  } catch (e) {}
  // 沒有專屬圖的形態：借用氣質相近的變身動畫（玩家 2026-10-24：沒有專屬變身圖的形態先找圖補上）
  //   日出之國＝刺客／黑騎／重甲領主／女弓手／法衣術士；90 級＝白金騎士、克特、賽尼斯、馬庫爾；
  //   長老三人＝長老／黑暗巡守／黑長者；生日慶祝妖精＝黃金套裝三型（近攻騎士、遠攻巡守、魔法法師）
  var BORROW = {
    '侍': '黑暗騎士', '大名': '騎士范德', '姬武者': '艾莉絲', '陰陽師': '西瑪',
    '格利特': '白金騎士', '特羅斯': '克特', '伊詩蒂': '賽尼斯', '喬': '馬庫爾',
    '拉曼斯': '長老', '安迪斯': '黑暗巡守', '艾迪爾': '黑長者',
    '亞克騎士': '黑騎士', '墮落的司祭': '卡士柏', '歐姆裝甲兵': '重裝歐姆',
    '生日慶祝妖精(近攻型)': '黃金騎士', '生日慶祝妖精(遠攻型)': '黃金巡守', '生日慶祝妖精(魔法型)': '黃金法師'
  };
  // 自製變身圖（scripts/forge-morph.py 以相近變身逐幀重新上色、加配件）：有自己的三方向資料夾，直接當成正式動畫
  var FORGED = { '忍者': '黑暗妖精刺客' };
  try { Object.keys(FORGED).forEach(function (n) { MORPH_BATTLE_ANIM.add(n); if (MORPH_ANIM_3DIR.has(FORGED[n])) MORPH_ANIM_3DIR.add(n); }); } catch (e) {}
  var borrowed = [];
  try { Object.keys(BORROW).forEach(function (n) { if (!MORPH_BATTLE_ALIAS[n] && MORPH_BATTLE_ANIM.has(BORROW[n])) { MORPH_BATTLE_ALIAS[n] = BORROW[n]; borrowed.push(n); } }); } catch (e) {}
  // 夏納：原本維持職業外觀，改穿真夏納的職業式變身圖（速度仍是夏納自己的）
  try {
    if (typeof window._actorBattleForm === 'function' && typeof TRUE_SHANNA_ANIM_SETS !== 'undefined') {
      var oABF = window._actorBattleForm;
      window._actorBattleForm = function (actor, allyGrp) {
        try {
          var pf = actor && (actor._setPoly || ((actor.buffs && actor.buffs.poly > 0 && actor.poly) ? actor.poly : null));
          if (pf && pf.n === '夏納' && actor.avatar && TRUE_SHANNA_ANIM_SETS[actor.avatar]) { var cf = _classForm(actor, !!allyGrp, '真夏納'); if (cf) return cf; }
        } catch (e) {}
        return oABF.apply(this, arguments);
      };
    }
  } catch (e) {}

  window.__afkPolys = { added: added, borrowed: borrowed, BORROW: BORROW, FORGED: FORGED };
  console.log('[AFK-polys] 已啟用：新增 ' + added.length + ' 種變身');
})();
