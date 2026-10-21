/* ==========================================================================
 * afk-relicfx.js — 遺物特效隨強化成長（玩家 2026-10-22「遺物特殊效果清單」）
 *
 * 規則來源：玩家提供的《遺物特殊效果清單》。遺物的能力是「依物品代碼即時算出來」的，
 * 所以本來就持有的 +5／+10／昇華支配遺物，讀檔後一樣拿到新特效，不用重新合成。
 *
 * 共通
 *   ‧+10 以上：中毒、出血 100% 命中；出血、中毒最多疊 50 層；持續時間照原本（出血 8 秒、中毒 10 秒），
 *     清單有寫的照清單（取消舊版「疊滿 20 層持續 30 秒」）
 *   ‧昇華支配每 +1 的基本成長（武器大小傷 +10、白字 +5；防具／飾品全屬性 +1 等）由 afk-relicplus 處理
 * 個別遺物：下表 TIERS，依 +5（n≥5）、+10（n≥10）、昇華支配（asc≥0）、昇華支配 +5（asc≥5）分段套用。
 *   能直接對應既有欄位的就改欄位（機率、倍率、加值）；其餘新效果由本檔的命中／受擊掛點處理（需要核心補丁 35）。
 * 清單上「昇華支配」那格是空白的遺物（例如變種蛇女的詭異鱗片）＝只有基本成長。
 * 清單第 122 行以後（地精靈王的抗拒起）沒有寫個別強化內容，只有共通規則。
 * 本檔要排在 afk-relicplus 之前（它啟動時就會建立 +N 遺物的資料）。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('relicfx')) return;

  var R4 = function (d, v) { ['resFire', 'resWater', 'resWind', 'resEarth'].forEach(function (f) { d[f] = (Number(d[f]) || 0) + v; }); };
  var bleedPct = function (d, pct) { d.relicBleedBonus = Math.max(0, pct - 20); };   // 核心出血每秒 20% ＋ relicBleedBonus
  var fx = function (d) { return d.rfx || (d.rfx = { hit: [], dmg: {} }); };
  var hit = function (d, o) { fx(d).hit.push(o); };

  // 每件遺物：function (d, n, asc)；d＝衍生定義（可改）、n＝強化值、asc＝昇華支配等級（null＝沒有）
  var A = function (asc) { return asc != null; }, A5 = function (asc) { return asc != null && asc >= 5; };
  var TIERS = {
    relic_shadow_stinger: function (d, n, asc) {   // 來自陰影的刺劍
      if (d.procInstakill) d.procInstakill.hpBelow = n >= 10 ? 0.20 : (n >= 5 ? 0.15 : 0.10);
      if (A5(asc)) hit(d, { t: 'bleed', rate: 100, all: true, layers: 10, pct: 1.0, dur: 150 });
      else if (A(asc)) hit(d, { t: 'bleed', rate: 50, all: true, layers: 8, pct: 0.5 });
    },
    relic_thorn_needle: function (d, n, asc) {   // 刺針
      if (d.raceBonus) d.raceBonus.mult = A5(asc) ? 10 : A(asc) ? 8 : n >= 10 ? 5 : n >= 5 ? 4 : 3;
      if (A5(asc)) hit(d, { t: 'extra', rate: 100, all: true, mult: 0.5 });
      else if (A(asc)) hit(d, { t: 'extra', rate: 50, all: true, mult: 1 });
    },
    relic_killerbee_sting: function (d, n, asc) {   // 殺人蜂的尾刺（加速突擊原本 +30）
      fx(d).dmg.hasteAdd = n >= 10 ? 20 : n >= 5 ? 10 : 0;
      if (A5(asc)) { hit(d, { t: 'poison', rate: 100, pct: 5.0, dur: 50 }); hit(d, { t: 'extra', rate: 100, mult: 0.2 }); }
      else if (A(asc)) { hit(d, { t: 'poison', rate: 100, pct: 2.0, dur: 100 }); hit(d, { t: 'extra', rate: 100, mult: 0.5 }); }
    },
    relic_scorpion_sting: function (d, n, asc) {   // 毒蠍的尾刺
      if (d.procInstakill) d.procInstakill.p = n >= 10 ? 0.20 : n >= 5 ? 0.10 : 0.01;
      if (A(asc)) { hit(d, { t: 'poison', rate: 100, pct: 5.0, dur: 50 }); hit(d, { t: 'bleed', rate: 100, layers: 10, pct: 5.0, dur: 30, full: true }); }
      if (A5(asc)) hit(d, { t: 'castAuto', rate: 100, mult: 1.5 });
    },
    relic_mage_dagger: function (d, n, asc) {   // 法師的護身短刀
      if (d.castOnHurt) d.castOnHurt.rate = n >= 10 ? 30 : n >= 5 ? 25 : 20;
      if (A5(asc)) fx(d).castEvery = 50; else if (A(asc)) fx(d).castEvery = 150;
    },
    relic_kaira_fang: function (d, n, asc) {   // 艾庫卡伊拉的毒牙
      if (d.procPoison) d.procPoison.rate = A(asc) ? 100 : n >= 10 ? 100 : n >= 5 ? 10 : 3;   // +10 以上中毒本來就必中
      d.poisonedBonusDmg = n >= 10 ? 100 : n >= 5 ? 50 : 15;
      if (A5(asc)) { fx(d).dmg.vsPoison = 0.2; fx(d).dmg.vsBleed = 0.2; }
      else if (A(asc)) { fx(d).dmg.vsPoison = 0.1; fx(d).dmg.vsBleed = 0.1; }
    },
    relic_blood_ritual_dagger: function (d, n, asc) {   // 血祭儀式短刀
      if (n >= 5) bleedPct(d, n >= 10 ? 40 : 30);
      if (A5(asc)) { bleedPct(d, 100); hit(d, { t: 'bleed', rate: 100, layers: 10, pct: 1.0, forever: true }); fx(d).dmg.vsBleed = 0.2; }
      else if (A(asc)) { bleedPct(d, 100); hit(d, { t: 'bleed', rate: 100, layers: 10, pct: 1.0, dur: 100 }); fx(d).dmg.vsBleed = 0.1; }
    },
    relic_mutant_lamia_scale: function (d, n, asc) {   // 變種蛇女的詭異鱗片（昇華支配：清單未寫）
      fx(d).dmg.unDice = n >= 10 ? [2, 50] : n >= 5 ? [1, 30] : null;
      if (d.procStatusSkill) d.procStatusSkill.rate = n >= 10 ? 10 : n >= 5 ? 5 : 1;
      if (n >= 5) { var L = n >= 10 ? 10 : 5; hit(d, { t: 'poisonStack', rate: 100, max: L }); hit(d, { t: 'bleed', rate: 100, layers: 1, pct: 0.2, dur: 80, cap: L }); }
    },
    relic_shark_teeth: function (d, n, asc) {   // 鯊魚的千刃牙
      fx(d).dmg.unDice = n >= 10 ? [2, 50] : n >= 5 ? [1, 30] : null;
      if (n >= 5) hit(d, { t: 'bleed', rate: 100, layers: 1, pct: 0.2, dur: 80, cap: n >= 10 ? 10 : 5, forever: A5(asc) });
      if (A5(asc)) fx(d).dmg.weak = { ele: 'water', mult: 3 }; else if (A(asc)) fx(d).dmg.weak = { ele: 'water', mult: 2 };
    },
    relic_avenger_crossbow: function (d, n, asc) {   // 復仇者的十字弩弓
      if (n >= 10) { d.rapidfire = 100; d.rapidCount = 5; d.rapidArrowPct = 50; } else if (n >= 5) { d.rapidCount = 5; }
      if (A5(asc)) { hit(d, { t: 'bleed', rate: 100, layers: 3, pct: 0.2, dur: 80 }); hit(d, { t: 'poisonStack', rate: 100, max: 3, add: 3 }); hit(d, { t: 'cast', rate: 20, skId: 'sk_vampire' }); }
      else if (A(asc)) { hit(d, { t: 'bleed', rate: 100, layers: 1, pct: 0.2, dur: 80 }); hit(d, { t: 'poisonStack', rate: 100, max: 1 }); hit(d, { t: 'cast', rate: 5, skId: 'sk_vampire' }); }
    },
    relic_ghoul_fang: function (d, n, asc) {   // 兇殘惡鬼的毒牙
      if (d.eleBonusDmg) d.eleBonusDmg.add = n >= 10 ? 100 : n >= 5 ? 50 : 10;
      if (n >= 5) hit(d, { t: 'poisonStack', rate: 100, max: n >= 10 ? 3 : 1 });
      if (A(asc)) { fx(d).dmg.eleMult = { ele: 'wind', mult: A5(asc) ? 3 : 2 }; fx(d).counter = { always: true, count: 1 }; }
    },
    relic_harvey_claw: function (d, n, asc) {   // 哈維的吸血爪
      d.vampPct = A5(asc) ? 0.30 : n >= 10 ? 0.15 : n >= 5 ? 0.10 : 0.05;
      d.procRateBase = A(asc) ? 100 : n >= 10 ? 10 : n >= 5 ? 5 : 3;
      if (A5(asc)) hit(d, { t: 'cast', rate: 100, skId: 'sk_vampire', count: 2, ignoreMr: true });   // 武器本身再觸發 1 次＝共 3 次
    },
    relic_earthshatter_sword: function (d, n, asc) {   // 大地碎裂劍
      if (n >= 10) R4(d, 10); else if (n >= 5) R4(d, 5);
      if (A5(asc)) hit(d, { t: 'cast', rate: 50, skId: 'sk_rock_prison', label: '陷陣岩崩' });
      else if (A(asc)) hit(d, { t: 'cast', rate: 25, skId: 'sk_rock_prison', label: '陷陣岩崩' });
    },
    relic_sparto_shard: function (d, n, asc) {   // 殘暴骸骨的破片
      if (n >= 10) R4(d, 10); else if (n >= 5) R4(d, 5);
      if (A(asc)) { fx(d).dmg.unDice = [5, 50]; d.hasteStrike = true; fx(d).dmg.hasteAdd = 70; fx(d).noCounter = true; if (A5(asc)) { fx(d).dmg.mult = 2; fx(d).keepHaste = true; } }
    },
    relic_ashwarrior_flamesword: function (d, n, asc) {   // 灰燼戰士的火焰長劍
      if (d.onHitEleDmg) { if (n >= 10) { d.onHitEleDmg.rate = 10; d.onHitEleDmg.dmg = 200; } else if (n >= 5) { d.onHitEleDmg.rate = 5; d.onHitEleDmg.dmg = 100; } }
      if (A5(asc)) { fx(d).dmg.weak = { ele: 'fire', mult: 3 }; d.meleeCrit = (Number(d.meleeCrit) || 0) + 15; fx(d).counter = { always: true, count: 1 }; }
      else if (A(asc)) { fx(d).dmg.weak = { ele: 'fire', mult: 2 }; fx(d).counter = { always: true, count: 1 }; }
    },
    relic_icefield_pick: function (d, n, asc) {   // 冰原十字鎬
      if (d.procStatusSkill) d.procStatusSkill.rate = n >= 10 ? 10 : n >= 5 ? 5 : 1;
      if (n >= 5) hit(d, { t: 'status', rate: n >= 10 ? 10 : 5, kind: 'slow', dur: 6 });
      if (A5(asc)) hit(d, { t: 'cast', rate: 30, skId: 'sk_blizzard' }); else if (A(asc)) hit(d, { t: 'cast', rate: 15, skId: 'sk_blizzard' });
    },
    relic_husky_bone: function (d, n, asc) {   // 哈士奇的骨棒
      var v = A(asc) ? 30 : n >= 10 ? 15 : n >= 5 ? 10 : 6;
      d.partnerHit = { '哈士奇': v };
      if (n >= 5) d.partnerDmg = { '哈士奇': v };
      if (A5(asc)) { d.petHitAll = (Number(d.petHitAll) || 0) + 30; d.petDmgAll = (Number(d.petDmgAll) || 0) + 30; }
    },
    relic_summoner_whip: function (d, n, asc) {   // 喚獸師的訓練鞭
      if (n >= 10 || A(asc)) { d.petDmgAll = 30; d.petHitAll = 30; d.summonDmg = 30; d.summonHit = 30; }
      else if (n >= 5) { d.petDmgAll = 16; d.petHitAll = 13; d.summonDmg = 13; d.summonHit = 16; }
      if (A(asc)) { d.petDmgAll += 30; d.petHitAll += 30; d.summonDmg += 30; d.summonHit += 30; }
      if (A5(asc)) { fx(d).dmg.heavyMax = 2; d.petDmgMult = 2; }
    },
    relic_gremlin_club: function (d, n, asc) {   // 地靈的木棍
      if (n >= 10) R4(d, 10); else if (n >= 5) R4(d, 5);
      if (d.procStatusSkill) d.procStatusSkill.rate = A5(asc) ? 50 : A(asc) ? 10 : 1;
    },
    relic_strong_femur: function (d, n, asc) {   // 強韌的大腿骨
      if (d.procInstakill) d.procInstakill.p = n >= 10 ? 0.6 : n >= 5 ? 0.4 : 0.2;
      if (A(asc)) { R4(d, A5(asc) ? 50 : 20); d.con = (Number(d.con) || 0) + 20; d.mhp = (Number(d.mhp) || 0) + 1000; fx(d).deathSave = true; }
    },
    relic_dark_metal_club: function (d, n, asc) {   // 暗黑的金屬棍棒
      if (d.eleBonusDmg) d.eleBonusDmg.add = n >= 10 ? 100 : n >= 5 ? 50 : 10;
      if (A5(asc)) { hit(d, { t: 'cast', rate: 30, skId: 'sk_elf_muddywater' }); hit(d, { t: 'status', rate: 30, kind: 'slow', dur: 8, label: '風之枷鎖' }); }
      else if (A(asc)) hit(d, { t: 'cast', rate: 15, skId: 'sk_elf_muddywater' });
    },
    relic_hellfire_hammer: function (d, n, asc) {   // 業火鍛造鎚
      if (n >= 5) hit(d, { t: 'flat', rate: A5(asc) ? 55 : n >= 10 ? 35 : 15, dmg: 100, ele: 'fire' });
      if (A(asc)) fx(d).dmg.heavyMax = A5(asc) ? 2 : 1;
    },
    relic_healer_wand: function (d, n, asc) {   // 治癒者的恢復魔棒
      if (n >= 10) { d.mpR = 100; R4(d, 20); } else if (n >= 5) { d.mpR = 50; R4(d, 10); }
      if (A(asc)) hit(d, { t: 'groupHeal', rate: 100, count: 2, spring: A5(asc), cd: 30 });
    },
    relic_lava_fists: function (d, n, asc) {   // 熔岩灼燒的雙拳
      fx(d).dmg.unDice = n >= 10 ? [3, 20] : n >= 5 ? [2, 20] : null;
      if (d.procBurn) d.procBurn.dmg = A(asc) ? 500 : n >= 10 ? 100 : n >= 5 ? 50 : 20;
      if (A(asc)) { fx(d).fixedAspd = 0.5; fx(d).selfBurn = 100; }
      if (A5(asc)) hit(d, { t: 'status', rate: 100, kind: 'muddywater', dur: 10, label: '回血降低' });
    },
    relic_ash_fist: function (d, n, asc) {   // 燃燒殆盡的灰燼之拳
      d.atkSpdPct = n >= 10 ? 80 : n >= 5 ? 50 : 30;
      if (n >= 5 && !A5(asc)) hit(d, { t: 'flat', rate: n >= 10 ? 25 : 15, dmg: 50, ele: 'fire' });
      if (A(asc)) { fx(d).fixedAspd = 0.5; hit(d, { t: 'burn', rate: 100, dmg: 500, forever: true }); if (!A5(asc)) fx(d).selfBurn = 200; }
      if (A5(asc)) hit(d, { t: 'flat', rate: 100, dmg: 100, ele: 'fire' });
    },
    relic_minotaur_flail: function (d, n, asc) {   // 牛頭人的流星鎚（清單：+5 攻速 -50%、+10 -100%）
      if (n >= 10) d.atkSpdPct = (Number(d.atkSpdPct) || 0) - 100; else if (n >= 5) d.atkSpdPct = (Number(d.atkSpdPct) || 0) - 50;
      if (A(asc)) hit(d, { t: 'status', rate: A5(asc) ? 15 : 5, kind: 'stun', dur: 1, label: '鈍擊' });
    },
    relic_werewolf_mace: function (d, n, asc) {   // 狼人的釘錘
      d.str = n >= 10 ? 10 : n >= 5 ? 5 : 1;
      if (A5(asc)) hit(d, { t: 'bleed', rate: 100, layers: 1, pct: 0.5, forever: true });
      else if (A(asc)) hit(d, { t: 'bleed', rate: 100, layers: 5, pct: 0.2, dur: 80 });
    },
    relic_monkey_staff: function (d, n, asc) {   // 猴子的金箍棒
      if (n >= 5) fx(d).dmg.heavyRolls = n >= 10 ? 3 : 2;
      if (n >= 5) fx(d).dmg.lv5Add = n >= 10 ? 10 : 5;
      if (A(asc)) { fx(d).dmg.heavyMax = 1; fx(d).dmg.lvAdd = A5(asc) ? 20 : 10; }
      if (A5(asc)) hit(d, { t: 'trueRand', rate: 100, min: 1, max: 999 });
    },
    relic_teo_hammer: function (d, n, asc) {   // 薩德提歐的玩具鎚
      if (n >= 10) { d.atkSpdPct = 100; fx(d).dmg.weak = { ele: 'wind', mult: 1.5 }; } else if (n >= 5) { d.atkSpdPct = 50; fx(d).dmg.weak = { ele: 'wind', mult: 1.2 }; }
      if (A(asc)) { fx(d).trueDice = [d.dmgS, d.dmgL]; d.dmgS = 1; d.dmgL = 1; }
    },
    relic_executor_axe: function (d, n, asc) {   // 處刑人的護身斧
      if (n >= 5 && d.procHealFlat) { d.procHealFlat.rate = 5; d.procHealFlat.hp = 200; }
      if (n >= 5) fx(d).counter = { rate: n >= 10 ? 100 : 50, count: 1 };
      if (A5(asc)) fx(d).counter = { rate: 100, count: 5, trueDmg: true };
      else if (A(asc)) fx(d).counter = { rate: 100, count: 3, inc: 0.5 };
    },
    relic_medusa_stinger: function (d, n, asc) {   // 蛇妖的無慈悲尾刺
      if (n >= 5) hit(d, { t: 'cast', rate: 100, skId: 'sk_mummy_curse', cd: 30 });
      if (n >= 10) fx(d).stoneKillHeal = 200;
      if (A(asc)) { d.comboRate = Math.max(Number(d.comboRate) || 0, 30); d.cleaveOnHeavy = true; }
      if (A5(asc)) fx(d).killSessho = true;
    },
    relic_aruba_haste: function (d, n, asc) {   // 阿魯巴的加速棍棒
      d.atkSpdPct = n >= 10 ? 100 : n >= 5 ? 50 : 20;
      if (n >= 5) hit(d, { t: 'cast', rate: n >= 10 ? 25 : 15, skId: 'sk_slow' });
      if (A(asc)) fx(d).dmg.heavyMax = 1;
      if (A5(asc)) fx(d).selfBuffs = ['sk_berserk', 'sk_greater_haste'];
    },
    relic_mandra_spirit: function (d, n, asc) {   // 曼陀羅之靈
      if (n >= 10) { d.int = 10; d.mpR = 40; d.extraMp = 30; } else if (n >= 5) { d.int = 5; d.mpR = 25; d.extraMp = 15; }
      if (A(asc)) { if (d.procInstakill) d.procInstakill.p = 0.15; d.magicCrit = (Number(d.magicCrit) || 0) + 5; d.qiguIgnoreMr = true; }
    },
    relic_ska_soul: function (d, n, asc) {   // 阿茲特獻祭亡靈
      if (n >= 10) { if (d.procInstakill) d.procInstakill.p = 0.5; d.con = -20; d.int = 20; d.mpR = 20; d.extraMp = 50; }
      else if (n >= 5) { if (d.procInstakill) d.procInstakill.p = 0.15; d.con = -10; d.int = 10; d.mpR = 20; d.extraMp = 25; }
      if (A(asc)) d.eff = d.eff || 'magicstrike';
      if (A5(asc)) d.magicCrit = (Number(d.magicCrit) || 0) + 5;
    },
    relic_jack_sling: function (d, n, asc) {   // 傑克的彈弓
      if (n >= 10) { d.rapidfire = 100; d.atkSpdPct = 100; fx(d).dmg.giantDice = [5, 20]; } else if (n >= 5) { d.rapidfire = 90; d.atkSpdPct = 50; fx(d).dmg.giantDice = [2, 20]; }
      if (A5(asc)) { d.rapidfire = 100; d.rapidCount = 5; d.rapidFixed = true; d.rapidArrowPct = 50; d.rapidTrue = true; }
      else if (A(asc)) { d.rapidfire = 100; d.rapidCount = 3; d.rapidFixed = true; d.rapidArrowPct = 40; }
    }
  };
  window.__afkRelicTier = function (d, b, n, asc) {
    var f = TIERS[d.relicBase]; if (!f) return;
    try { f(d, n, asc); } catch (e) { console.warn('[AFK-relicfx]', d.relicBase, e); }
    if (d.rfx) d.d = (d.d || '') + rfxText(d);
  };
  var rfxText = function (d) {
    var r = d.rfx, s = [];
    (r.hit || []).forEach(function (h) {
      var p = h.rate < 100 ? h.rate + '% ' : '';
      if (h.t === 'bleed') s.push(p + (h.all ? '全體' : '') + '出血 ' + h.layers + ' 層（每秒 ' + Math.round(h.pct * 100) + '%' + (h.forever ? '，直到死亡' : h.dur ? '，' + h.dur / 10 + ' 秒' : '') + '）');
      else if (h.t === 'poison') s.push(p + '中毒（每秒 ' + Math.round(h.pct * 100) + '%，' + h.dur / 10 + ' 秒）');
      else if (h.t === 'poisonStack') s.push('中毒可疊 ' + h.max + ' 層');
      else if (h.t === 'extra') s.push(p + (h.all ? '全體' : '') + '追加一次攻擊（' + Math.round(h.mult * 100) + '% 傷害）');
      else if (h.t === 'cast') s.push(p + '觸發' + (h.label || ((DB.skills[h.skId] || {}).n || h.skId)) + (h.count ? ' ×' + (h.count + 1) : ''));
      else if (h.t === 'castAuto') s.push('追加免費施放自動攻擊法術（×' + h.mult + '）');
      else if (h.t === 'flat') s.push(p + '追加 ' + h.dmg + ' 點火焰傷害');
      else if (h.t === 'burn') s.push('灼燒每秒 ' + h.dmg + (h.forever ? '（直到死亡）' : ''));
      else if (h.t === 'status') s.push(p + (h.label || h.kind));
      else if (h.t === 'trueRand') s.push('千變萬化：追加 1～999 真實傷害');
      else if (h.t === 'groupHeal') s.push('攻擊時團體治癒 ×2（' + h.count + ' 次）' + (h.spring ? '＋生命之泉' : ''));
    });
    var g = r.dmg || {};
    if (g.weak) s.push('對弱點' + ({ water: '水', fire: '火', wind: '風', earth: '地' })[g.weak.ele] + '屬性的敵人傷害 ×' + g.weak.mult);
    if (g.eleMult) s.push('對' + ({ water: '水', fire: '火', wind: '風', earth: '地' })[g.eleMult.ele] + '屬性敵人傷害 ×' + g.eleMult.mult);
    if (g.vsBleed) s.push('對出血目標傷害 +' + Math.round(g.vsBleed * 100) + '%');
    if (g.vsPoison) s.push('對中毒目標傷害 +' + Math.round(g.vsPoison * 100) + '%');
    if (g.heavyMax) s.push('重擊必發' + (g.heavyMax > 1 ? '，最大傷害 ×' + g.heavyMax : ''));
    if (g.mult) s.push('一般攻擊傷害 ×' + g.mult);
    if (g.lvAdd) s.push('每 1 級傷害 +' + g.lvAdd);
    if (r.counter) s.push('反擊 ' + (r.counter.always ? '100%' : r.counter.rate + '%') + (r.counter.count > 1 ? '，連續 ' + r.counter.count + ' 次' : '') + (r.counter.trueDmg ? '（真實傷害）' : ''));
    if (r.castEvery) s.push('每 ' + r.castEvery / 10 + ' 秒觸發護身反擊');
    if (r.fixedAspd) s.push('攻擊間隔固定 ' + r.fixedAspd + ' 秒' + (r.selfBurn ? '，自身每秒受 ' + r.selfBurn + ' 火焰傷害' : ''));
    if (r.deathSave) s.push('免疫一次致死攻擊');
    if (r.trueDice) s.push('武器傷害改為真實傷害');
    if (r.selfBuffs) s.push('對自己施放狂暴術＋強力加速術');
    if (r.killSessho) s.push('對殺生石 100% 秒殺');
    if (r.stoneKillHeal) s.push('斬殺石化敵人時全隊恢復 200 HP');
    return s.length ? '〔強化特效：' + s.join('／') + '〕' : '';
  };

  // ── 共通：+10 以上出血最多 50 層、持續時間照原本 ──
  if (typeof window.applyBleed === 'function') {
    var oBleed = window.applyBleed;
    window.applyBleed = function (m, hitDmg, maxLayers) { if (maxLayers === 20) arguments[2] = 50; return oBleed.apply(this, arguments); };
  }

  // ── 執行期 ──
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var wpnOf = function (actor) { try { var e = actor && actor.eq && actor.eq.wpn; return e ? DB.items[e.id] : null; } catch (e) { return null; } };
  var weakTo = function (ele, m) { try { return typeof elementCounterMult === 'function' && elementCounterMult(ele, m.e) > 1; } catch (e) { return false; } };
  var isPlayer = function (a) { return a && typeof player !== 'undefined' && (a === player) && !a._allyName; };
  var addBleed = function (m, unit, layers, dur, forever, cap) {
    m.bleeds = m.bleeds || []; m._bleedCap = Math.max(m._bleedCap || 0, cap || 50);
    for (var i = 0; i < layers; i++) { while (m.bleeds.length >= m._bleedCap) m.bleeds.shift(); m.bleeds.push({ dmg: Math.max(1, unit), ticksLeft: forever ? 1e9 : (dur || 80) }); }
  };
  var alive = function () { return (mapState.mobs || []).filter(function (m) { return m && m.curHp > 0 && !m._dead; }); };
  var cds = {};
  var pre = function (actor, t, dmg, wpn) {
    var r = wpn && wpn.rfx; if (!r || !t) return dmg;
    var g = r.dmg || {};
    try {
      if (g.unDice && (t.un || t.isWolf)) dmg += Math.max(0, roll(g.unDice[0], g.unDice[1]) - 10);
      if (g.giantDice && t.race === '巨人') dmg += Math.max(0, roll(g.giantDice[0], g.giantDice[1]) - 10);
      if (g.hasteAdd && actor.buffs && actor.buffs.haste > 0) dmg += g.hasteAdd;
      if (g.lvAdd) dmg += (actor.lv || 1) * g.lvAdd; else if (g.lv5Add) dmg += Math.floor((actor.lv || 1) / 5) * g.lv5Add;
      if (g.heavyMax) dmg = Math.max(dmg, Math.floor(((t.s === 'L' ? wpn.dmgL : wpn.dmgS) || 1) * g.heavyMax + (wpn.dmgBonus || 0)));
      if (g.weak && weakTo(g.weak.ele, t)) dmg = Math.floor(dmg * g.weak.mult);
      if (g.eleMult && t.e === g.eleMult.ele) dmg = Math.floor(dmg * g.eleMult.mult);
      if (g.vsBleed && t.bleeds && t.bleeds.length) dmg = Math.floor(dmg * (1 + g.vsBleed));
      if (g.vsPoison && t.st && t.st.poison > 0) dmg = Math.floor(dmg * (1 + g.vsPoison));
      if (g.mult) dmg = Math.floor(dmg * g.mult);
      if (r.keepHaste && actor.buffs) actor._afkHasteKeep = actor.buffs.haste;
    } catch (e) {}
    return dmg;
  };
  var log = function (h) { try { if (!S().ff) logCombat(h, 'player-special'); } catch (e) {} };
  var post = function (actor, t, dmg, wpn) {
    var r = wpn && wpn.rfx; if (!r || !t) return;
    var who = isPlayer(actor) ? '' : (actor._allyName ? '協力·' + actor._allyName + '·' : '');
    try {
      if (r.keepHaste && actor._afkHasteKeep > 0) { actor.buffs.haste = actor._afkHasteKeep; actor._afkHasteKeep = 0; }
      if (r.trueDice) { var td = roll(1, Math.max(1, t.s === 'L' ? r.trueDice[1] : r.trueDice[0])); t.curHp -= td; }
      (r.hit || []).forEach(function (h) {
        if (Math.random() * 100 >= h.rate) return;
        if (h.cd) { var k = (actor.uid || actor._allyName || 'p') + h.t + h.skId; if ((cds[k] || 0) > S().ticks) return; cds[k] = S().ticks + h.cd; }
        var targets = h.all ? alive() : [t];
        if (h.t === 'bleed') targets.forEach(function (m) { if (m.curHp > 0) addBleed(m, Math.floor(dmg * h.pct), h.layers, h.dur, h.forever, h.cap); });
        else if (h.t === 'poison') { if (!t.st) t.st = newMobStatus(); t.st.poison = h.dur; t.st.poisonTick = 10; t.st.poisonStacks = 1; t.st.poisonUnit = t.st.poisonDmg = Math.max(1, Math.floor(dmg * h.pct)); }
        else if (h.t === 'poisonStack') { if (!t.st) t.st = newMobStatus(); var unit = Math.max(1, t.st.poisonUnit || Math.floor(dmg * 0.2)); var st = Math.min(Math.max(h.max, 50), Math.min(h.max, (t.st.poisonStacks || 0) + (h.add || 1))); t.st.poisonStacks = st; t.st.poisonUnit = unit; t.st.poisonDmg = unit * st; t.st.poison = Math.max(t.st.poison || 0, 100); t.st.poisonTick = t.st.poisonTick || 10; }
        else if (h.t === 'extra') targets.forEach(function (m) { if (m.curHp > 0) { var x = Math.max(1, Math.floor(dmg * h.mult)); m.curHp -= x; try { mobWake(m); } catch (e) {} } });
        else if (h.t === 'flat') { var fd = Math.max(1, Math.floor(h.dmg * (typeof elementCounterMult === 'function' ? elementCounterMult(h.ele, t.e) : 1))); t.curHp -= fd; t.justHit = h.ele; }
        else if (h.t === 'burn') t._burnDot = { left: h.forever ? 1e9 : 60, dmg: h.dmg, tick: 10 };
        else if (h.t === 'status') { if (!t.st) t.st = newMobStatus(); if (!(t.boss && (h.kind === 'stun'))) t.st[h.kind] = Math.max(t.st[h.kind] || 0, (h.dur || 3) * 10); }
        else if (h.t === 'trueRand') t.curHp -= roll(1, h.max);
        else if (h.t === 'cast' && isPlayer(actor) && typeof procFreeMagicSkill === 'function') {
          for (var c = 0; c < 1 + (h.count || 0); c++) if (t.curHp > 0) procFreeMagicSkill(t, h.skId, 0, false, wpn);
        }
        else if (h.t === 'castAuto' && isPlayer(actor) && typeof procFreeMagicSkill === 'function') {
          var el = document.getElementById('sel-atk-skill'), sk = el && el.value; if (sk && DB.skills[sk] && DB.skills[sk].dmgType !== 'physical' && t.curHp > 0) procFreeMagicSkill(t, sk, 0, false, wpn);
        }
        else if (h.t === 'groupHeal') {
          var team = [player].concat((player.allies || []).filter(function (a) { return a && !a._downed; }));
          for (var gh = 0; gh < h.count; gh++) team.forEach(function (a) { var mh = a.mhp || 1, amt = Math.floor(mh * 0.05 * 2) + (h.spring ? Math.floor(mh * 0.05) : 0); if (a === player) player.hp = Math.min(player.mhp, player.hp + amt); else a.curHp = Math.min(a.mhp || 1, (a.curHp || 0) + amt); });
        }
      });
      if (r.stoneKillHeal && t.curHp <= 0 && t.st && t.st.stone > 0) { player.hp = Math.min(player.mhp, player.hp + r.stoneKillHeal); (player.allies || []).forEach(function (a) { if (a && !a._downed) a.curHp = Math.min(a.mhp || 1, (a.curHp || 0) + r.stoneKillHeal); }); }
      if (r.killSessho && t.curHp > 0 && /殺生石/.test(t.n || '')) t.curHp = 0;
    } catch (e) {}
  };
  window.__afkRelicDmg = function (actor, t, dmg, wpn) { return pre(actor, t, dmg, wpn); };
  window.__afkRelicHit = function (actor, t, dmg, wpn) { post(actor, t, dmg, wpn); };
  // 一般攻擊結束後：被追加傷害打死的怪補結算
  var settle = function () { try { (mapState.mobs || []).forEach(function (m, i) { if (m && !m._dead && m.curHp <= 0) killMob(i); }); } catch (e) {} };
  ['playerAttack', 'allyAttackOnce'].forEach(function (fn) {
    var o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () { var r = o.apply(this, arguments); settle(); return r; };
  });

  // 受擊：反擊加強、死亡免疫一次
  if (typeof window.procCounter === 'function') {
    var oCounter = window.procCounter, inCounter = false;
    window.procCounter = function (t) {
      var w = wpnOf(player), c = w && w.rfx && w.rfx.counter;
      if (w && w.rfx && w.rfx.noCounter) return;
      S()._afkCountered = true;
      if (!c || inCounter) return oCounter.apply(this, arguments);
      inCounter = true;
      try {
        for (var i = 0; i < (c.count || 1); i++) {
          if (!t || t.curHp <= 0) break;
          var hp0 = t.curHp; oCounter.call(this, t);
          var dealt = hp0 - t.curHp;
          if (t.curHp > 0 && dealt > 0) { if (c.inc) t.curHp -= Math.floor(dealt * c.inc * i); }
        }
      } finally { inCounter = false; }
    };
  }
  if (typeof window.enemyPhysicalAttack === 'function') {
    var oEPA = window.enemyPhysicalAttack;
    window.enemyPhysicalAttack = function (mob) {
      var w = wpnOf(player), r = w && w.rfx, hp0 = player.hp;
      S()._afkCountered = false;
      var res = oEPA.apply(this, arguments);
      try {
        if (r && r.counter && player.hp < hp0 && mob && mob.curHp > 0 && !S()._afkCountered && (r.counter.always || Math.random() * 100 < (r.counter.rate || 0))) window.procCounter(mob);
      } catch (e) {}
      return res;
    };
  }
  if (typeof window.killPlayer === 'function') {
    var oKP = window.killPlayer;
    window.killPlayer = function () {
      try {
        var w = wpnOf(player);
        if (w && w.rfx && w.rfx.deathSave && !player._afkDeathSaved) { player._afkDeathSaved = true; player.hp = 1; player.dead = false; logCombat('<span class="text-yellow-300 font-bold">【強韌的大腿骨】</span>你撐過了致命的一擊！（回村後重置）', 'heal'); return; }
      } catch (e) {}
      return oKP.apply(this, arguments);
    };
  }
  if (typeof window.changeMap === 'function') {
    var oCM = window.changeMap;
    window.changeMap = function () { try { if (player) player._afkDeathSaved = false; } catch (e) {} return oCM.apply(this, arguments); };
  }
  // 固定攻速／自身灼燒／定時護身反擊／自我增益
  if (typeof window.playerAttackIntervalTicks === 'function') {
    var oIv = window.playerAttackIntervalTicks;
    window.playerAttackIntervalTicks = function () { var w = wpnOf(player); if (w && w.rfx && w.rfx.fixedAspd) return Math.max(1, w.rfx.fixedAspd * 10); return oIv.apply(this, arguments); };
  }
  var oTick = window.tick;
  if (typeof oTick === 'function') window.tick = function () {
    var t0 = S().ticks, r = oTick.apply(this, arguments);
    try {
      var t = S().ticks; if (t === t0 || !player || player.dead || (mapState.current || '').indexOf('town_') === 0) return r;
      var w = wpnOf(player), x = w && w.rfx; if (!x) return r;
      if (x.selfBurn && t % 10 === 0) { player.hp -= x.selfBurn; if (player.hp <= 0) { player.hp = 0; killPlayer(); return r; } }
      if (x.castEvery && t % x.castEvery === 0 && typeof _relicOnHurtCast === 'function' && w.castOnHurt) { var keep = w.castOnHurt.rate; w.castOnHurt.rate = 100; try { _relicOnHurtCast(null); } finally { w.castOnHurt.rate = keep; } }
      if (x.selfBuffs && t % 50 === 0) x.selfBuffs.forEach(function (sk) { var s = DB.skills[sk]; if (s && !(player.buffs[sk] > 0)) { player.buffs[sk] = s.dur || 600; if (s.haste) player.buffs.haste = Math.max(player.buffs.haste || 0, s.dur || 600); } });
      if (x.selfBuffs && t % 50 === 0) try { calcStats(); } catch (e) {}
    } catch (e) {}
    return r;
  };

  window.__afkRelicFx = { TIERS: TIERS };
  console.log('[AFK-relicfx] 已啟用：' + Object.keys(TIERS).length + ' 件遺物的強化特效');
})();
