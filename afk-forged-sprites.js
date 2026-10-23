/* ==========================================================================
 * afk-forged-sprites.js — 自製變身圖登錄（由 scripts/forge-morph.py 產生，請勿手改）
 *
 * 沒有專屬圖的變身、以及神話／天上／時空／聖衣卡，各自有一套由相近變身逐幀重新上色、加配件或階級光效的
 * 三方向動畫（assets/morphanim/<名稱>{,2,F}）。這裡把它們登錄成正式變身動畫，蓋過原本的借圖別名。
 * 須排在 afk-polys、afk-card-forms 之後。
 * ========================================================================== */
(function () {
  'use strict';
  var LIST = ["忍者", "侍", "大名", "姬武者", "陰陽師", "格利特", "伊詩蒂", "特羅斯", "喬", "拉曼斯", "安迪斯", "艾迪爾", "亞克騎士", "墮落的司祭", "歐姆裝甲兵", "生日慶祝妖精(近攻型)", "生日慶祝妖精(遠攻型)", "生日慶祝妖精(魔法型)", "闇黑死亡騎士", "雷霆死亡騎士", "黃金死亡騎士", "焚焰死亡騎士", "絲莉安", "神話・巴列斯", "神話・艾莉絲", "神話・吸血鬼", "神話・炎魔", "神話・黑暗巡守", "神話・黑暗法師", "神話・黑暗騎士", "神話・銀光巡守", "神話・銀光法師", "神話・銀光騎士", "神話・騎士范德", "神話・惡魔", "神話・黃金巡守", "神話・黃金法師", "神話・黃金騎士", "神話・白金巡守", "神話・白金法師", "神話・白金騎士", "神話・死亡", "神話・反王肯恩", "神話・烈焰的死亡騎士", "神話・莉絲安", "神話・焚焰死亡騎士", "神話・黃金死亡騎士", "神話・雷霆死亡騎士", "神話・闇黑死亡騎士", "神話・真夏納", "神話・伊詩蒂", "神話・格利特", "神話・特羅斯", "神話・喬", "神話・絲莉安", "天上・曙光聖騎", "天上・月羽神弓", "天上・熾光聖賢", "天上・天穹劍聖", "天上・雷霆天將", "天上・金輝守護", "天上・焚天戰神", "天上・夜幕天刃", "天上・天律裁決", "天上・星海魔導", "天上・雲端劍豪", "天上・天羽獵星", "天上・天影忍神", "天上・天命陰陽", "天上・曦光射手", "天上・天籟法師", "天上・天雷武士", "天上・天威大名", "天上・天弓姬武", "天上・蒼穹拳聖", "天上・天狼王", "時空・永劫騎士", "時空・裂星獵手", "時空・萬象先知", "時空・虛空劍帝", "時空・逆時雷霆", "時空・終焉守門", "時空・時砂暴君", "時空・輪迴劍鬼", "時空・次元裁判", "時空・混沌魔尊", "時空・時空劍豪", "時空・星界弓神", "時空・永夜忍皇", "時空・時之巫女", "白羊座聖衣", "金牛座聖衣", "雙子座聖衣", "巨蟹座聖衣", "獅子座聖衣", "處女座聖衣", "天秤座聖衣", "天蠍座聖衣", "射手座聖衣", "摩羯座聖衣", "水瓶座聖衣", "雙魚座聖衣"];
  if (typeof MORPH_BATTLE_ANIM === 'undefined' || typeof MORPH_ANIM_3DIR === 'undefined') return;
  LIST.forEach(function (name) {
    MORPH_BATTLE_ANIM.add(name); MORPH_ANIM_3DIR.add(name);
    if (typeof MORPH_BATTLE_ALIAS !== 'undefined') { MORPH_BATTLE_ALIAS[name] = name; if (/座聖衣$/.test(name)) MORPH_BATTLE_ALIAS['輪迴・' + name] = name; }
  });
  // 職業式變身（真夏納系的卡片）也優先用自製圖：在職業動畫判斷之前先接手
  var SET = new Set(LIST);
  if (typeof window._actorBattleForm === 'function') {
    var oABF = window._actorBattleForm;
    window._actorBattleForm = function (actor, allyGrp) {
      try {
        var pf = actor && (actor._setPoly || ((actor.buffs && actor.buffs.poly > 0 && actor.poly) ? actor.poly : null));
        if (pf && pf.classMorph && SET.has(pf.n)) { var m = pf.n, folder = m + _animDirSfx((actor._faceD != null) ? actor._faceD : 2, false);
          return { key: 'morph:' + folder, domKey: 'morph:' + m, base: 'assets/morphanim/' + encodeURIComponent(folder) + '/', wpn: null }; }
      } catch (e) {}
      return oABF.apply(this, arguments);
    };
  }
  window.__afkForgedSprites = LIST;
  console.log('[AFK-forged-sprites] 已登錄自製變身圖 ' + LIST.length + ' 種');
})();
