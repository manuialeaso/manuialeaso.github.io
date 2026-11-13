/* ============================================================================
 * afk-relicevo.js — 沒有進階特效的遺物：補上 +5／+10／昇華支配／昇華支配 +5 的效果（Ping 11-13 21:36：全部做、數字稍微調強、寵物加強）
 *   設計稿：Projects claude/relic-noevo-plan.md（第二版）。效果引擎、文字、掛點都在 afk-bossrelic.js（addEvo）。
 *   主題：寵物、召喚、治療、減傷、屬性；其餘的武器走「增傷組合」、防具飾品走「補助組合」。本體（+0）不變。
 *   每項效果的數字是 [本體, +5, +10, 昇華支配, 昇華支配 +5]；0＝那一階還沒有。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'relicevo', name: '遺物進階特效（補齊）', group: '遊戲內容', desc: '原本沒有進階特效的遺物，+5／+10／昇華支配／昇華支配 +5 各加一層效果' });
  if (T && !T.enabled('relicevo')) return;
  var B = W.__afkBossRelic; if (!B || !B.addEvo || typeof DB === 'undefined') return;
  var K = {"pet":["relic_tamer_petarm","relic_imp_fang","relic_hellhound_chain","relic_shepherd_boots","relic_collie_fur","relic_doberman_fang","relic_cat_paw","relic_fox_scarf"],"sum":["relic_croc_soul","relic_dream_mushroom_soul","relic_dream_flamesoul","relic_mini_darkelf","relic_zombie_shin","relic_beholder_gaze","relic_giantant_antenna"],"heal":["relic_doro_vitality","relic_troll_regen_ring","relic_crescent_earring","relic_kasta_hump","relic_black_gale","relic_bear_vitality","relic_bandit_token","relic_mermaid_tear","relic_mana_spring_boots","relic_evilchest_relic","relic_paper_cloak","relic_wither_amulet","relic_dark_manaball","relic_orin_ring","relic_lizard_scale","relic_cyclops_dollsuit"],"dr":["relic_troll_belly","relic_slave_shirt","relic_arrowfur_cloak","relic_ohm_heavyarmor","relic_dragonturtle_shell","relic_giant_clubfrag","relic_ogre_mawashi","relic_panda_eyes","relic_dullahan_ember","relic_yeti_foot","relic_bear_fur","relic_darkspirit_shroud","relic_red_wraith","relic_bat_wing","relic_bara_wing","relic_frost_stone_shield","relic_dwarf_chainmail","relic_metalshell_shin","relic_gatekeeper_boots","relic_soldierant_carapace","relic_heavy_belt","relic_ska_armguard","relic_teo_footprint","relic_remnant_barrier","relic_wisp_thought","relic_ohm_hidepants","relic_sr_aooni_shirt","relic_blackmane_coat"],"ele":["relic_earth_barrier","relic_water_barrier","relic_fire_barrier","relic_wind_barrier","relic_azt_prism","relic_soldier_medal","relic_sr_kappa_plate","relic_sr_kettle_lid","relic_sr_old_umbrella","relic_maid_gift","relic_fireegg_orb","relic_burning_love","relic_deepfish_skin","relic_caveman_webbing","relic_thunder_crown","relic_scarab_shin","relic_seawater_shirt","relic_pirate_bandana"],"wpn":["relic_goblin_blade","relic_gladiator_scimitar","relic_orc_nail","relic_orc_cleaver","relic_hobgoblin_grinder","relic_orc_butcher","relic_venom_fang","relic_parrot_beak","relic_pirate_scimitar","relic_whirlwind_xbow","relic_modded_crossbow","relic_handy_quiver","relic_yuka_quiver","relic_bk_lance","relic_powder_arrow","relic_elmore_greatsword"],"arm":["relic_mushroom_cap","relic_gnomeearth_tshirt","relic_wolf_shawl","relic_dwarf_sheet","relic_bear_fishbone","relic_eye_crystal","relic_monsterhand_skin","relic_croc_tshirt","relic_orcmage_cloth","relic_roach_shell","relic_ungoliant_plate","relic_darkremnant_boots","relic_wornout_underwear","relic_blackmage_pants","relic_shapeshifter_underwear","relic_charm_heart","relic_lycan_swiftlegs","relic_redscorpion_ring","relic_griffin_feather","relic_rabbit_foot","relic_drake_pawprint","relic_sr_neck_scarf","relic_sr_akaoni_pants"],"info":{"relic_doro_vitality":"hp","relic_troll_regen_ring":"hp","relic_crescent_earring":"hp","relic_kasta_hump":"hp","relic_black_gale":"hp","relic_bear_vitality":"hp","relic_bandit_token":"hp","relic_mermaid_tear":"mp","relic_mana_spring_boots":"mp","relic_evilchest_relic":"mp","relic_paper_cloak":"mp","relic_wither_amulet":"mp","relic_dark_manaball":"mp","relic_orin_ring":"mp","relic_lizard_scale":"mp","relic_cyclops_dollsuit":"mp","relic_troll_belly":"phys","relic_slave_shirt":"phys","relic_arrowfur_cloak":"phys","relic_ohm_heavyarmor":"phys","relic_dragonturtle_shell":"phys","relic_giant_clubfrag":"phys","relic_ogre_mawashi":"phys","relic_panda_eyes":"phys","relic_dullahan_ember":"magic","relic_yeti_foot":"phys","relic_bear_fur":"magic","relic_darkspirit_shroud":"magic","relic_red_wraith":"magic","relic_bat_wing":"magic","relic_bara_wing":"magic","relic_frost_stone_shield":"magic","relic_dwarf_chainmail":"phys","relic_metalshell_shin":"phys","relic_gatekeeper_boots":"phys","relic_soldierant_carapace":"phys","relic_heavy_belt":"phys","relic_ska_armguard":"phys","relic_teo_footprint":"phys","relic_remnant_barrier":"magic","relic_wisp_thought":"magic","relic_ohm_hidepants":"magic","relic_sr_aooni_shirt":"phys","relic_blackmane_coat":"phys","relic_earth_barrier":"earth","relic_water_barrier":"water","relic_fire_barrier":"fire","relic_wind_barrier":"wind","relic_azt_prism":"all","relic_soldier_medal":"all","relic_sr_kappa_plate":"all","relic_sr_kettle_lid":"fire,water","relic_sr_old_umbrella":"water","relic_maid_gift":"water","relic_fireegg_orb":"fire","relic_burning_love":"fire","relic_deepfish_skin":"water,wind","relic_caveman_webbing":"water","relic_thunder_crown":"wind","relic_scarab_shin":"earth","relic_seawater_shirt":"fire","relic_pirate_bandana":"water","relic_goblin_blade":"atk","relic_gladiator_scimitar":"atk","relic_orc_nail":"atk","relic_orc_cleaver":"atk","relic_hobgoblin_grinder":"atk","relic_orc_butcher":"atk","relic_venom_fang":"atk","relic_parrot_beak":"atk","relic_pirate_scimitar":"atk","relic_whirlwind_xbow":"atk","relic_modded_crossbow":"atk","relic_handy_quiver":"atk","relic_yuka_quiver":"atk","relic_bk_lance":"atk","relic_powder_arrow":"atk","relic_elmore_greatsword":"atk"}};
  var EN = { fire: '火', water: '水', wind: '風', earth: '地', all: '四種' };
  var RESK = { fire: 'resFire', water: 'resWater', wind: 'resWind', earth: 'resEarth' };
  var MAP = {};
  var put = function (k, fx) { MAP[k] = { fx: fx }; };

  // ── 一、寵物（馴養）──
  var PET = function (extra) {
    return [
      ['petOnly', { p: [0, 15, 20, 30, 40] }], ['petPanel', { p: [0, 10, 15, 20, 30] }],
      ['petTaken', { p: [0, 0, 20, 25, 30] }], ['petHp', { p: [0, 0, 30, 40, 50] }], ['petHeal', { t: [0, 0, 8, 8, 6], p: [0, 0, 2, 3, 4] }],
      ['petBreak', { c: [0, 0, 0, 15, 25], p: [0, 0, 0, 15, 20] }], ['petPoison', { c: [0, 0, 0, 20, 30], p: [0, 0, 0, 2, 3] }],
      ['petCast', { t: [0, 0, 0, 0, 6], p: [0, 0, 0, 0, 40] }], ['petAura', { p: [0, 0, 0, 0, 6] }], ['petRevive', { t: [0, 0, 0, 0, 15], cd: [0, 0, 0, 0, 60] }]
    ].concat(extra || []);
  };
  var PETX = {
    relic_tamer_petarm: [['petTaken', { p: [0, 10, 10, 10, 10] }], ['petHp', { p: [0, 20, 20, 20, 20] }]],
    relic_imp_fang: [['petPoison', { c: [0, 10, 10, 10, 10], p: [0, 1, 1, 1, 1] }]],
    relic_hellhound_chain: [['petBreak', { c: [0, 10, 10, 10, 10], p: [0, 10, 10, 10, 10] }]],
    relic_shepherd_boots: [['guard', { p: [0, 2, 3, 4, 6] }]],
    relic_collie_fur: [['petHeal', { t: [0, 8, 8, 8, 6], p: [0, 1, 1, 1, 1] }]],
    relic_doberman_fang: [['petOnly', { p: [0, 10, 10, 10, 10] }]],
    relic_cat_paw: [['petTaken', { p: [0, 10, 10, 10, 10] }]],
    relic_fox_scarf: [['gold', { p: [0, 5, 6, 8, 10] }]]
  };
  K.pet.forEach(function (k) { put(k, PET(PETX[k])); });

  // ── 二、召喚（喚靈）──
  var SNAME = { relic_croc_soul: '鱷魚之影', relic_dream_mushroom_soul: '蘑菇之影', relic_dream_flamesoul: '火炎之影', relic_mini_darkelf: '闇精靈之影', relic_zombie_shin: '殭屍', relic_beholder_gaze: '眼魔之影', relic_giantant_antenna: '兵蟻' };
  var SUMX = {
    relic_croc_soul: [['splash', { c: [0, 0, 10, 12, 15], p: [0, 0, 30, 40, 50] }]],
    relic_dream_mushroom_soul: [['poison', { c: [0, 0, 10, 10, 10], p: [0, 0, 3, 3, 3], k: [0, 0, 3, 3, 5] }]],
    relic_dream_flamesoul: [['pulse', { name: '火炎爆發', t: [0, 0, 8, 8, 6], p: [0, 0, 40, 60, 80] }]],
    relic_mini_darkelf: [['blind', { c: [0, 0, 10, 12, 15], p: [0, 0, 20, 25, 30] }]],
    relic_zombie_shin: [['summon', { name: '殭屍', p: [0, 0, 20, 30, 40] }]],
    relic_beholder_gaze: [['pulse', { name: '凝視', t: [0, 0, 6, 6, 5], p: [0, 0, 30, 40, 60] }]],
    relic_giantant_antenna: [['double', { c: [0, 0, 6, 8, 10] }]]
  };
  K.sum.forEach(function (k) {
    put(k, [['summonDmg', { p: [0, 15, 20, 30, 40] }], ['summon', { name: SNAME[k] || '影子', p: [0, 0, 30, 50, 80] }],
      ['poison', { c: [0, 0, 0, 15, 25], p: [0, 0, 0, 3, 4], k: [0, 0, 0, 3, 5] }], ['teamDmg', { p: [0, 0, 0, 0, 5] }]].concat(SUMX[k] || []));
  });

  // ── 三、治療（再生）──
  K.heal.forEach(function (k) {
    if (K.info[k] === 'mp') put(k, [['mpRegen', { p: [0, 1.5, 2.5, 3, 5] }], ['healRecv', { p: [0, 0, 0, 10, 15] }], ['mpRescue', { th: [0, 0, 0, 0, 30], p: [0, 0, 0, 0, 30], cd: [0, 0, 0, 0, 60] }]]);
    else put(k, [['healRecv', { p: [0, 10, 15, 20, 30] }], ['regen', { p: [0, 1, 2, 2.5, 4] }], ['regenLow', { on: [0, 0, 0, 1, 1] }], ['overShield', { p: [0, 0, 0, 0, 12] }]]);
  });

  // ── 四、減傷（堅守）──
  K.dr.forEach(function (k) {
    put(k, [['stat', { k: 'dr', label: '傷害減免', n: [0, 3, 5, 6, 8] }], [K.info[k] === 'magic' ? 'magicCut' : 'physCut', { p: [0, 0, 6, 8, 10] }],
      ['bigHitCut', { th: 20, p: [0, 0, 0, 35, 40] }], ['lowHpCut', { th: 30, p: [0, 0, 0, 0, 15] }]]);
  });

  // ── 五、屬性（元素）──
  K.ele.forEach(function (k) {
    var els = String(K.info[k]).split(','), fx = [];
    if (els[0] === 'all') fx.push(['stat', { k: 'res4', label: '火、水、風、地屬性抗性各', n: [0, 6, 12, 20, 35] }]);
    else els.forEach(function (e) { fx.push(['stat', { k: RESK[e], label: EN[e] + '屬性抗性', n: [0, 12, 25, 40, 70] }]); });
    els.forEach(function (e) {
      fx.push(['eleCut', { e: e, en: EN[e], p: [0, 0, 10, 15, 20] }]);
      fx.push(['eleAbsorb', { e: e, en: EN[e], c: [0, 0, 0, 15, 25], p: [0, 0, 0, 50, 60] }]);
    });
    put(k, fx);
  });

  // ── 六、其餘：武器＝增傷組合，防具飾品＝補助組合 ──
  K.wpn.forEach(function (k) {
    put(k, [[K.info[k] === 'magic' ? 'magicDmg' : 'atk', { p: [0, 8, 12, 18, 25] }], ['double', { c: [0, 0, 6, 10, 15] }], ['hunt', { p: [0, 0, 0, 15, 25] }], ['ambush', { p: [0, 0, 0, 0, 100] }]]);
  });
  K.arm.forEach(function (k) {
    put(k, [['teamDmg', { p: [0, 2, 3, 4, 6] }], ['guard', { p: [0, 0, 3, 4, 6] }], ['regen', { p: [0, 0, 0, 1, 2] }], ['lowHpTeam', { p: [0, 0, 0, 0, 3] }]]);
  });

  B.addEvo(MAP);
  W.__afkRelicEvo = { MAP: MAP, K: K };
})();
