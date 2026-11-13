/* ============================================================================
 * afk-bossrelic.js — 王者遺物（地圖王、副本王專屬遺物 79 件；設計稿 claude/boss-relic-design.md，Ping 11-13 19:35／20:28 定案）
 *
 *   ‧一隻王一件，掉落率跟其他遺物一樣（MOB_DROPS[王的名字] 0.01%，走核心的掉落流程，吃一樣的掉落倍率）；不跟王者卡冊連動。
 *   ‧部位底子（傷害、命中、AC…）＝現有同部位遺物的平均（11-13 量的，見 BASE）；遺物合成、昇華支配、詞綴照 afk-relicplus 共通規則。
 *   ‧特效分 5 階：本體（+0）／+5／+10／昇華支配／昇華支配 +5（tier()，跟現有 250 件同一套切法）。
 *       百分比 ×1／1.25／1.5／2.4／3.5；機率 ×1／1.2／1.4／1.8／2.2（最多 100%）；間隔、冷卻 ÷1／1.1／1.2／1.4／1.6；疊層 +0／0／1／2／3。
 *   ‧武器另有「王者之威」造成的傷害 +N%（MIGHT_BASE，各部位不同；木人場對齊現有同部位遺物用）。
 *   ‧保命效果（短暫無敵、保住 1 HP、站起來）：同一個人身上同時只算一件（階段最高的那件）。
 *   ‧掛點：afk-procfx 的 dealt／taken／tick／kill／death；__afkRelicTier（buildDef 時寫入階段）；
 *         金幣 dollFieldVal('goldBonus')、經驗 __afkTtmiExpMult。
 *   ‧內部：觸發型（命中時 c%）同一個人同一種效果 0.5 秒內最多一次。
 *   ‧圖示：GPT 圖到之前先借同部位遺物的圖。經典模式沒有效果。外掛開關 bossrelic。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'bossrelic', name: '王者遺物', group: '遊戲內容', desc: '79 隻地圖王、副本王各掉一件專屬遺物' });
  if (T && !T.enabled('bossrelic')) return;
  if (typeof DB === 'undefined' || !DB.items) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var X = function () { return W.__afkProc; };
  var tk = function () { try { return Number(state.ticks) || 0; } catch (e) { return 0; } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RATE = 0.0001;

  // ── 部位底子（11-13 現有遺物同部位平均，四捨五入）與職業、武器種類 ──
  var BASE = {
    sword1: { type: 'wpn', tags: ['單手劍'], req: 'royal,knight,elf,mage,dark,dragon', s: { dmgS: 7, dmgL: 8, hit: 11, dmgBonus: 11 }, img: 'relic_goblin_blade', cat: '單手劍' },
    dagger: { type: 'wpn', tags: ['匕首'], req: 'royal,knight,elf,mage,dark', s: { dmgS: 6, dmgL: 6, hit: 11, dmgBonus: 9 }, img: 'relic_doberman_fang', cat: '匕首' },
    wand: { type: 'wpn', isWand: true, ignHardSkin: true, req: 'royal,knight,elf,mage,illusion', s: { dmgS: 6, dmgL: 6, hit: 11, dmgBonus: 11, extraMp: 3 }, img: 'relic_zombie_shin', cat: '魔杖' },
    blunt2: { type: 'wpn', w2h: true, eff: 'crush', ignHardSkin: true, tags: ['雙手鈍器'], req: 'royal,knight,elf,illusion,dragon,warrior', s: { dmgS: 21, dmgL: 23, hit: 11, dmgBonus: 12 }, img: 'relic_golem_fist', cat: '雙手鈍器' },
    chainsword: { type: 'wpn', w2h: true, chainsword: true, eff: 'combo', ignHardSkin: true, weakExpose: true, req: 'dragon', s: { dmgS: 23, dmgL: 21, hit: 15, dmgBonus: 15, comboRate: 20 }, img: 'relic_starfish_arm', cat: '鎖鏈劍' },
    spear: { type: 'wpn', w2h: true, eff: 'pierce', pierceChance: 100, ignHardSkin: true, tags: ['矛'], req: 'royal,knight,warrior', s: { dmgS: 13, dmgL: 14, hit: 13, dmgBonus: 12, mhp: 9 }, img: 'relic_executor_skewer', cat: '矛' },
    bow: { type: 'wpn', w2h: true, isBow: true, ranged: true, ignHardSkin: true, req: 'royal,knight,elf,mage,illusion', s: { dmgS: 3, dmgL: 3, hit: 13, dmgBonus: 12, rapidfire: 70 }, img: 'relic_orcarcher_bow', cat: '弓' },
    claw: { type: 'wpn', w2h: true, eff: 'combo', ignHardSkin: true, tags: ['鋼爪'], req: 'dark', s: { dmgS: 17, dmgL: 15, hit: 11, dmgBonus: 12, comboRate: 40 }, img: 'relic_spider_claw', cat: '鋼爪' },
    dual: { type: 'wpn', w2h: true, eff: 'combo', ignHardSkin: true, tags: ['雙刀'], req: 'dark', s: { dmgS: 15, dmgL: 11, hit: 14, dmgBonus: 14, comboRate: 30 }, img: 'relic_elastic_rib', cat: '雙刀' },
    katana: { type: 'wpn', tags: ['單手劍', '武士刀'], req: 'royal,knight,elf,dark,dragon', s: { dmgS: 15, dmgL: 13, hit: 16, dmgBonus: 15 }, img: 'relic_darkelf_grindblade', cat: '武士刀' },
    sword2: { type: 'wpn', w2h: true, eff: 'cleave', tags: ['雙手劍'], req: 'royal,knight,dragon', s: { dmgS: 22, dmgL: 24, hit: 13, dmgBonus: 16 }, img: 'relic_venom_fang', cat: '雙手劍' },
    shield: { type: 'arm', slot: 'shield', req: 'royal,knight,elf,mage,dark,dragon,illusion', s: { ac: 5, mr: 4, dr: 3, mhp: 7, block: 12 }, img: 'relic_orc_lid', cat: '盾牌' },
    armor: { type: 'arm', slot: 'armor', req: 'all', s: { ac: 10, mr: 4, dr: 2 }, img: 'relic_wolf_shawl', cat: '盔甲' },
    cloak: { type: 'arm', slot: 'cloak', req: 'all', s: { ac: 6, mr: 5, er: 2, dr: 1 }, img: 'relic_dwarf_sheet', cat: '斗篷' },
    helm: { type: 'arm', slot: 'helm', req: 'all', s: { ac: 5, mr: 5 }, img: 'relic_mushroom_cap', cat: '頭盔' },
    gloves: { type: 'arm', slot: 'gloves', req: 'all', s: { ac: 5 }, img: 'relic_monsterhand_skin', cat: '手套' },
    boots: { type: 'arm', slot: 'boots', req: 'all', s: { ac: 7, er: 2, mmp: 8, mpR: 1 }, img: 'relic_shepherd_boots', cat: '長靴' },
    shin: { type: 'arm', slot: 'shin', req: 'all', s: { ac: 3, mr: 1 }, img: 'relic_orc_loincloth', cat: '脛甲' },
    amulet: { type: 'acc', slot: 'amulet', req: 'all', s: { mr: 1, er: 1, mmp: 4 }, img: 'relic_ghoul_bracelet', cat: '項鍊' },
    ear: { type: 'acc', slot: 'ear', req: 'all', s: { ac: 1, hpR: 4 }, img: 'relic_bear_fishbone', cat: '耳環' },
    ring: { type: 'acc', slot: 'ring', req: 'all', s: { mr: 1, mhp: 8, hpR: 2, mpR: 2 }, img: 'relic_mermaid_tear', cat: '戒指' },
    belt: { type: 'acc', slot: 'belt', req: 'all', s: { ac: 1, hpR: 2 }, img: 'relic_ohm_shackle', cat: '腰帶' }
  };

  // ── 79 件：[王的代號, 部位, 遺物名, 說明, 特效…]；特效 [種類, +0 的數值] ──
  var LIST = [
    ['gorun', 'shield', '老樹精的年輪盾', '老樹精哥倫掉下的一圈年輪，年年長出新的嫩芽。', ['regen', { p: 1 }], ['summon', { name: '小樹精', p: 30 }], ['share', { p: 4 }]],
    ['dela', 'chainsword', '黛菈的蔓刺鞭', '墮落樹妖的藤蔓編成的鞭子，倒刺會緊緊纏住獵物。', ['entangle', { c: 10, p: 15 }], ['vsMarked', { p: 15 }]],
    ['sarna', 'armor', '巨蟒的蛻皮甲', '巨蟒薩爾納蛻下的皮，鱗片之間還滲著毒液。', ['magicCut', { p: 5 }], ['thorn', { c: 20, p: 5 }]],
    ['odi', 'sword1', '叛騎士的斷誓劍', '歐迪背棄誓言那天折斷的劍，斷口反而更鋒利。', ['block', { c: 6 }], ['blockNext', { p: 50 }]],
    ['kajie', 'dagger', '盜賊王的沙暗匕首', '卡傑藏在沙塵裡出手的匕首，見光之前一切就結束了。', ['stealth', { t: 15, p: 150 }], ['gold', { p: 10 }]],
    ['kentgen', 'amulet', '斷劍將軍的軍令章', '肯特將軍至死別在胸前的軍令章，部下見到它便不會退。', ['allyDmg', { p: 10 }], ['lowHpTeam', { p: 3 }]],
    ['scar', 'dual', '刀疤的雙刃', '盜賊團長刀疤的一對短刃，一刀見血、一刀奪財。', ['mpSteal', { c: 15, n: 5 }], ['double', { c: 10 }]],
    ['melo', 'wand', '潮汐女巫的珠杖', '梅洛以海潮淬鍊的珠杖，咒文一出便捲起水柱。', ['splash', { c: 15, p: 40 }], ['magicCut', { p: 5 }]],
    ['polly', 'gloves', '巨人王的投石臂甲', '獨眼巨人之王投擲巨石時穿的臂甲，越遠越有勁。', ['ranged', { p: 8 }], ['berserk', { p: 15 }]],
    ['fenris', 'cloak', '冰狼王的毛皮斗篷', '芬里斯的毛皮，披上的人身邊總跟著一頭冰狼。', ['summon', { name: '冰狼', p: 30 }], ['res', { k: 'resWater', n: 20 }]],
    ['saka', 'spear', '蠍王的尾鉤', '蠍王薩卡的尾鉤，毒液一層疊過一層。', ['poison', { c: 15, p: 2, k: 3 }], ['invuln', { th: 30, d: 2, cd: 120 }]],
    ['karan', 'ring', '戰魂的不滅戒', '不散的戰魂卡蘭留下的戒指，倒下的人還會再握緊武器。', ['lastStand', { cd: 180, p: 20 }]],
    ['wag', 'claw', '銀狼人的利爪', '銀色狼人瓦格的爪子，專挑虛弱的獵物下手。', ['hunt', { p: 12 }], ['lifesteal', { p: 2 }]],
    ['red', 'bow', '黑鬍子的燧發短銃', '海賊船長雷德的短銃，必要時整艘船的砲口都會跟著開火。', ['pulse', { name: '砲擊', t: 8, p: 60 }], ['gold', { p: 10 }]],
    ['isfi', 'armor', '深海守護者的鱗甲', '伊斯菲在深海守了千年的鱗甲，潮水會替穿的人療傷。', ['physCut', { p: 5 }], ['regen', { p: 1 }]],
    ['sphinx', 'ear', '獅身人面的謎之耳環', '答不出謎題的人，攻擊都會原封不動地回到自己身上。', ['guard', { p: 3 }], ['reflect', { c: 15, p: 30 }]],
    ['kuku', 'helm', '羽蛇祭司的羽冠', '庫庫祭祀羽蛇時戴的羽冠，羽毛裡藏著神的庇護。', ['magicDmg', { p: 8 }], ['invuln', { th: 30, d: 2, cd: 120 }]],
    ['ronin', 'katana', '落武者的居合刀', '無名落武者的佩刀，收刀的那一瞬間才看得見刀光。', ['iai', { t: 6, p: 250 }], ['block', { c: 6 }]],
    ['drake', 'amulet', '黑鱗幼龍的逆鱗', '黑鱗幼龍喉下唯一倒長的鱗片，碰到便噴出龍息。', ['pulse', { name: '龍息', t: 8, p: 60 }], ['res', { k: 'resFire', n: 20 }]],
    ['recruit', 'amulet', '教官人偶的訓練徽章', '修練場教官人偶胸口的徽章，戴著它練功事半功倍。', ['exp', { p: 5 }], ['regen', { p: 1 }]],
    ['spartoi', 'shield', '骨兵長的骨盾', '沉默的骨兵長用同袍骸骨拼成的盾，敲一下骷髏兵就會站起來。', ['summon', { name: '骷髏兵', p: 30 }], ['block', { c: 6 }]],
    ['hermit', 'amulet', '隱遁王的地獄犬項圈', '薩爾瓦養的地獄犬戴的項圈，聞到血味的那一刻最兇。', ['petDmg', { p: 10 }], ['ambush', { p: 100 }]],
    ['gate', 'shield', '鐵壁將軍的塔盾', '正門的鐵壁將軍扛了一輩子的塔盾，再大的王也撞不開。', ['block', { c: 6 }], ['bossCut', { p: 5 }]],
    ['tamer', 'chainsword', '馴獸王的皮鞭', '受詛咒的馴獸王的皮鞭，鞭聲一響百獸發狂。', ['allyDmg', { p: 10 }], ['berserk', { p: 15 }]],
    ['sadtio', 'dagger', '血祭司的獻祭短刃', '神廟深處的血祭司用來獻祭的短刃，刺下去的血都歸持有者。', ['lifesteal', { p: 2 }], ['magicCut', { p: 5 }]],
    ['bandit', 'boots', '游擊頭子的輕靴', '巴洛打了就跑的輕靴，總能搶在對手前面出手。', ['ambush', { p: 100 }], ['atk', { p: 6 }]],
    ['tiger', 'ear', '白虎王的牙飾', '森林白虎王塔加的獠牙，受傷越重越兇猛。', ['melee', { p: 8 }], ['berserk', { p: 15 }]],
    ['scarbeast', 'ring', '異界獸的變異核', '闇龍傷痕裡長出的異界獸核心，還在一下一下地跳動。', ['poison', { c: 15, p: 2, k: 3 }], ['regen', { p: 1 }]],
    ['lizardk', 'shin', '蜥蜴王的鱗片護腿', '密林蜥蜴王戈札的鱗片，刀槍法術都難以穿透。', ['guard', { p: 3 }], ['magicCut', { p: 3 }]],
    ['handy', 'gloves', '怪手的吸盤手套', '海底隧道怪手的吸盤，抓住就不放，還會招來觸手。', ['entangle', { c: 10, p: 15 }], ['summon', { name: '觸手', p: 30 }]],
    ['dwarfgen', 'blunt2', '侏儒大將軍的戰旗', '侏儒大將軍插在陣前的戰旗，人越多旗越重。', ['perAlly', { p: 2 }], ['teamDmg', { p: 4 }]],
    ['lykan2', 'helm', '狼群首領的頭骨盔', '北島狼群首領的頭骨，戴上它狼群便認你為王。', ['summon', { name: '狼群', p: 30 }], ['berserk', { p: 15 }]],
    ['orcelder', 'wand', '大長者的骨杖', '妖魔部落大長者的骨杖，敲地一下詛咒與戰士一起現身。', ['curse', { c: 10, p: 10 }], ['summon', { name: '妖魔戰士', p: 30 }]],
    ['griffin', 'bow', '格利芬王的翼羽弓', '荒地格利芬王的翼羽製成的弓，第一箭總是最狠。', ['ambush', { p: 100 }], ['pulse', { name: '俯衝', t: 8, p: 60 }]],
    ['kraken', 'belt', '大王烏賊的墨囊', '大王烏賊的墨囊，被打中時一團墨就噴了出去。', ['ink', { c: 15, p: 25 }], ['summon', { name: '觸手', p: 30 }]],
    ['spiderq', 'cloak', '蜘蛛女王的絲網斗篷', '地底蜘蛛女王的絲網，碰到的人手腳都慢了下來。', ['web', { c: 15, p: 15 }], ['summon', { name: '小蜘蛛', p: 30 }]],
    ['keeper', 'amulet', '守墓人的提燈', '被遺忘的守墓人提著的燈，燈火不滅，守墓人也不會倒下。', ['summon', { name: '骷髏', p: 30 }], ['lastStand', { cd: 180, p: 20 }]],
    ['one', 'ear', '夢魘幼龍的眠鱗', '歐涅身上的鱗片，看久了就會沉沉睡去。', ['control', { c: 5, d: 3, name: '睡眠' }], ['berserk', { p: 15 }]],
    ['warden', 'chainsword', '監獄長的鎖鍊', '奇岩監獄長的鎖鍊，鎖上的囚犯再也逃不掉。', ['curse', { c: 10, p: 10 }], ['block', { c: 6 }]],
    ['pharaoh', 'helm', '法老的黃金面具', '法老的影子留下的面具，面具下的眼睛仍在詛咒盜墓者。', ['curse', { c: 10, p: 10 }], ['summon', { name: '木乃伊', p: 30 }]],
    ['bone', 'armor', '龍骨守衛的骨甲', '龍骨守衛的肋骨鎧甲，受擊時會震起一陣地鳴。', ['shield', { t: 15, p: 5 }], ['reflect', { c: 15, p: 30 }]],
    ['antguard', 'gloves', '近衛長的甲殼護手', '巨蟻近衛長的甲殼，兵蟻聽到它的聲音就會趕來。', ['summon', { name: '兵蟻', p: 30 }], ['physCut', { p: 5 }]],
    ['rat', 'dagger', '毒鼠王的鼠牙', '下水道毒鼠王的門牙，咬過的傷口永遠不會乾淨。', ['poison', { c: 15, p: 2, k: 5 }], ['hunt', { p: 12 }]],
    ['golem', 'ring', '魔導人偶的核心', '失控魔導人偶的動力核心，同時擋得住劍與魔法。', ['guard', { p: 3 }], ['magicDmg', { p: 8 }]],
    ['watcher', 'cloak', '監視者的暗影披風', '暗影監視者的披風，藏身其中，出手前沒人看得見。', ['ambush', { p: 100 }], ['blind', { c: 10, p: 20 }]],
    ['giantking', 'shield', '守陵王的墓碑盾', '巨人墓守陵王以墓碑改成的盾，亡魂還在碑後守著。', ['shield', { t: 15, p: 5 }], ['summon', { name: '巨人亡魂', p: 30 }]],
    ['crystal', 'amulet', '鋼心巨像的水晶心', '水晶洞鋼心巨像胸中的水晶，溫潤的光會慢慢治好傷口。', ['block', { c: 6 }], ['regen', { p: 1 }]],
    ['ghoulking', 'claw', '食屍鬼王的腐爪', '格魯腐爛的爪子，撕開的傷口會爛下去，吃掉的生命會回來。', ['poison', { c: 15, p: 2, k: 3 }], ['killHp', { p: 2 }]],
    ['elder13', 'ear', '老長老的智慧耳環', '地監老長老歐巴的耳環，聽得見咒文，也擋得住咒文。', ['shield', { t: 15, p: 5 }], ['curse', { c: 10, p: 10 }]],
    ['pan', 'wand', '潘恩的污染笛', '污染的森林之主潘恩的笛子，笛聲讓藤蔓纏上敵人。', ['entangle', { c: 10, p: 15 }], ['regen', { p: 1 }]],
    ['dudama', 'blunt2', '大族長的戰斧', '都達瑪拉大族長的戰斧，舉起來全族都會跟著衝。', ['summon', { name: '妖魔戰士', p: 30 }], ['perAlly', { p: 2 }]],
    ['crypt18', 'sword1', '屍骨將的骨刃', '奇岩墓穴屍骨將的骨刃，握著它的人倒下後還能再站起來。', ['block', { c: 6 }], ['revive', { cd: 240, h: 20 }]],
    ['lykan', 'amulet', '萊卡的月牙項鍊', '狼人頭目萊卡的項鍊，月牙形的獠牙專咬殘血的獵物。', ['hunt', { p: 12 }], ['ambush', { p: 100 }]],
    ['kastel', 'belt', '掘地將軍的礦工腰帶', '卡司特掘地將軍的腰帶，一拍地面就震得到處都是土石。', ['pulse', { name: '地震', t: 8, p: 60 }], ['summon', { name: '卡司特', p: 30 }]],
    ['shelob', 'ring', '毒蛛的毒腺', '沙下毒蛛夏洛的毒腺，毒液一沾上就動彈不得。', ['poison', { c: 15, p: 2, k: 3 }], ['entangle', { c: 10, p: 15 }]],
    ['ogre23', 'ring', '食人妖精隊長的鐵指環', '食人妖精隊長的鐵指環，打得越凶搶得越多。', ['berserk', { p: 15 }], ['gold', { p: 10 }]],
    ['ogre24', 'belt', '食人妖精祭司的骨鈴', '食人妖精祭司的骨鈴，鈴聲是詛咒也是祝福。', ['curse', { c: 10, p: 10 }], ['regen', { p: 1 }]],
    ['skelwar', 'sword2', '骷髏劍聖的古劍', '龍谷骷髏劍聖的古劍，擋下一劍就還一劍，倒下了也會再站起來。', ['block', { c: 6 }], ['blockNext', { p: 50 }], ['revive', { cd: 240, h: 20 }]],
    ['monia', 'gloves', '莫妮亞的毒絲手套', '織網的莫妮亞女王用毒絲織的手套。', ['entangle', { c: 10, p: 15 }], ['poison', { c: 15, p: 2, k: 3 }]],
    ['aruba', 'blunt2', '巨人首領的戰錘', '阿魯巴巨人首領的戰錘，砸下去整片地都在搖。', ['pulse', { name: '地震', t: 8, p: 60 }], ['berserk', { p: 15 }]],
    ['scuba', 'cloak', '戰爭母后的翅膜', '思克巴戰爭母后的翅膜，振翅一次全軍都跟著衝。', ['summon', { name: '思克巴', p: 30 }], ['teamDmg', { p: 4 }]],
    ['scubaq', 'helm', '思克巴女帝的冠冕', '龍谷深處思克巴女帝的冠冕，護著女帝，也護著她的僕從。', ['shield', { t: 15, p: 5 }], ['allyDmg', { p: 10 }]],
    ['whiteant', 'belt', '工兵長的蟻酸瓶', '白蟻巢工兵長的蟻酸瓶，潑上去的盔甲會慢慢溶掉。', ['curse', { c: 10, p: 10, name: '酸蝕' }], ['summon', { name: '工兵蟻', p: 30 }]],
    ['naga', 'wand', '蛇女祭司的蛇杖', '地下水道蛇女祭司的蛇杖，咒文繞著杖身盤成一道盾。', ['curse', { c: 10, p: 10 }], ['shield', { t: 15, p: 5 }]],
    ['eyes', 'ear', '千眼的凝視之眼', '歐庫千隻眼睛裡的一隻，被它盯上的會變成石頭。', ['control', { c: 5, d: 3, name: '石化' }], ['invuln', { th: 30, d: 2, cd: 120 }]],
    ['armor37', 'shield', '守門巨像的石臂甲', '象牙塔守門巨像的石臂，什麼都擋得下來。', ['shield', { t: 15, p: 5 }], ['block', { c: 6 }]],
    ['armor38', 'armor', '空殼騎士的鎧甲', '象牙塔空殼騎士的鎧甲，裡面空無一人，卻永遠不會倒。', ['block', { c: 6 }], ['revive', { cd: 240, h: 20 }]],
    ['reaper', 'spear', '收魂者的鐮刀', '象牙塔收魂者的鐮刀，每收走一個魂就多一分力。', ['killMp', { p: 3 }], ['ambush', { p: 100 }]],
    ['wraith', 'amulet', '哀泣亡靈的淚滴', '象牙塔哀泣亡靈的眼淚，冰冷得連死亡都碰不到。', ['invuln', { th: 30, d: 2, cd: 120 }], ['poison', { c: 15, p: 2, k: 3 }]],
    ['ohm1', 'gloves', '歐姆統領的狂戰護腕', '狂暴的歐姆統領的護腕，越痛打得越狠。', ['berserk', { p: 15 }], ['shield', { t: 15, p: 5 }]],
    ['remnant', 'amulet', '薩恩的指揮官徽章', '殘兵指揮官薩恩的徽章，殘兵們還在等它的號令。', ['allyDmg', { p: 10 }], ['summon', { name: '殘兵', p: 30 }]],
    ['bast', 'wand', '守墓神官的權杖', '金字塔守墓神官的權杖，詛咒入侵者，也喚醒倒下的守墓人。', ['curse', { c: 10, p: 10 }], ['revive', { cd: 240, h: 20 }]],
    ['elemlab', 'ring', '四元素核心碎片', '失控的四元素核心崩下的碎片，四種力量互相抵消。', ['res4', { n: 10 }], ['shield', { t: 15, p: 5 }]],
    ['necro', 'spear', '教頭的雙刃戟', '冥法軍教頭的雙刃戟，攻守一體。', ['berserk', { p: 15 }], ['block', { c: 6 }]],
    ['jelly', 'belt', '果凍王的黏液', '火焰之影果凍王的黏液，傷口沾上就慢慢合起來。', ['regen', { p: 1 }], ['invuln', { th: 30, d: 2, cd: 120 }]],
    ['wingdemon', 'boots', '翼魔教官的蝠翼靴', '修練地監翼魔教官的靴子，從高處撲下的第一擊最致命。', ['ambush', { p: 100 }], ['shield', { t: 15, p: 5 }]],
    ['ogrechief', 'ear', '大首領的獸牙耳環', '邪惡的食人妖精大首領的耳環，戴上它小弟們都會來幫忙。', ['berserk', { p: 15 }], ['summon', { name: '食人妖精', p: 30 }]],
    ['desire', 'wand', '四元之主的元素球', '慾望洞穴四元之主的元素球，四種元素輪流守護持有者。', ['magicDmg', { p: 8 }], ['shield', { t: 15, p: 5 }], ['regen', { p: 1 }]],
    ['lab', 'gloves', '試作兵器的機械臂', '魔族實驗室試作兵器的機械臂，壞了也會自己重新啟動。', ['block', { c: 6 }], ['revive', { cd: 240, h: 20 }]]
  ];

  // ── 分階 ──
  var tier = function (n, a) { return a != null ? (a >= 5 ? 4 : 3) : n >= 10 ? 2 : n >= 5 ? 1 : 0; };
  var STAGE_N = ['本體', '+5', '+10', '昇華支配', '昇華支配 +5'];
  var MP = [1, 1.25, 1.5, 2.4, 3.5], MC = [1, 1.2, 1.4, 1.8, 2.2], MT = [1, 1.1, 1.2, 1.4, 1.6], MK = [0, 0, 1, 2, 3], MD = [1, 1.15, 1.3, 1.6, 2];
  var r1 = function (x) { return Math.round(x * 10) / 10; };
  var val = function (o, s) {
    var v = {};
    Object.keys(o).forEach(function (k) {
      var x = o[k];
      if (typeof x !== 'number') { v[k] = x; return; }
      if (k === 'p' || k === 'n' || k === 'h') v[k] = r1(x * MP[s]);
      else if (k === 'c') v[k] = Math.min(100, Math.round(x * MC[s]));
      else if (k === 't' || k === 'cd') v[k] = r1(x / MT[s]);
      else if (k === 'k') v[k] = x + MK[s];
      else if (k === 'd') v[k] = r1(x * MD[s]);
      else v[k] = x;
    });
    return v;
  };
  var SAVES = { invuln: 1, lastStand: 1, revive: 1 };
  var TXT = {
    regen: function (v) { return '每 10 秒恢復最大 HP ' + v.p + '%'; },
    summon: function (v) { return '召喚「' + v.name + '」協戰：戰鬥中每 3 秒攻擊目標一次，造成你近 5 秒每秒傷害 ' + v.p + '%'; },
    share: function (v) { return '受到的傷害 −' + v.p + '%（召喚物分擔）'; },
    entangle: function (v) { return '攻擊命中時 ' + v.c + '% 纏繞目標 5 秒：目標造成的傷害 −' + v.p + '%'; },
    web: function (v) { return '受到攻擊時 ' + v.c + '% 用絲網纏住攻擊者 5 秒：它造成的傷害 −' + v.p + '%'; },
    vsMarked: function (v) { return '對被纏繞、詛咒、中毒的目標傷害 +' + v.p + '%'; },
    curse: function (v) { return '攻擊命中時 ' + v.c + '% ' + (v.name || '詛咒') + '目標 8 秒：目標受到的傷害 +' + v.p + '%'; },
    thorn: function (v) { return '受到近距離攻擊時 ' + v.c + '% 讓攻擊者中毒 5 秒，每秒受到你近 5 秒每秒傷害 ' + v.p + '%'; },
    poison: function (v) { return '攻擊命中時 ' + v.c + '% 讓目標中毒一層（最多 ' + v.k + ' 層，8 秒），每層每秒造成你近 5 秒每秒傷害 ' + v.p + '%'; },
    block: function (v) { return '受到物理攻擊時 ' + v.c + '% 格擋（這一下不受傷害）'; },
    blockNext: function (v) { return '格擋之後，下一次攻擊傷害 +' + v.p + '%'; },
    stealth: function (v) { return '每 ' + v.t + ' 秒隱身一次，下一次攻擊傷害 +' + v.p + '%'; },
    gold: function (v) { return '打倒怪物得到的金幣 +' + v.p + '%'; },
    exp: function (v) { return '得到的經驗值 +' + v.p + '%'; },
    allyDmg: function (v) { return '傭兵、寵物、召喚物造成的傷害 +' + v.p + '%'; },
    petDmg: function (v) { return '寵物、召喚物造成的傷害 +' + v.p + '%'; },
    lowHpTeam: function (v) { return '你的 HP 每少 25%，全隊受到的傷害 −' + v.p + '%（最多 3 段）'; },
    mpSteal: function (v) { return '攻擊命中時 ' + v.c + '% 吸取 ' + Math.round(v.n) + ' 點 MP'; },
    double: function (v) { return '近距離、遠距離攻擊命中時 ' + v.c + '% 再追加一次同樣的傷害'; },
    splash: function (v) { return '魔法命中時 ' + v.c + '% 捲起水柱，其他敵人各受到這次傷害 ' + v.p + '%'; },
    magicCut: function (v) { return '受到的魔法傷害 −' + v.p + '%'; },
    physCut: function (v) { return '受到的物理傷害 −' + v.p + '%'; },
    guard: function (v) { return '受到的物理、魔法傷害各 −' + v.p + '%'; },
    ranged: function (v) { return '遠距離攻擊傷害 +' + v.p + '%'; },
    melee: function (v) { return '近距離攻擊傷害 +' + v.p + '%'; },
    atk: function (v) { return '近距離、遠距離攻擊傷害 +' + v.p + '%'; },
    magicDmg: function (v) { return '魔法傷害 +' + v.p + '%'; },
    berserk: function (v) { return '狂暴：HP 低於 50% 時造成的傷害 +' + v.p + '%'; },
    hunt: function (v) { return '對 HP 低於 50% 的目標傷害 +' + v.p + '%'; },
    lifesteal: function (v) { return '造成傷害的 ' + v.p + '% 轉為自己的 HP'; },
    pulse: function (v) { return '戰鬥中每 ' + v.t + ' 秒' + v.name + '一次，對全部敵人造成你近 5 秒每秒傷害 ' + v.p + '%'; },
    reflect: function (v) { return '受到攻擊時 ' + v.c + '% 把這次傷害的 ' + v.p + '% 反彈給攻擊者'; },
    iai: function (v) { return '居合：每 ' + v.t + ' 秒，下一次近距離攻擊傷害 +' + v.p + '%'; },
    control: function (v) { return '攻擊命中時 ' + v.c + '% 讓目標' + v.name + ' ' + v.d + ' 秒（期間它造成的傷害歸零；頭目無效）'; },
    blind: function (v) { return '攻擊命中時 ' + v.c + '% 致盲目標 5 秒：它的攻擊 ' + v.p + '% 落空'; },
    ink: function (v) { return '受到攻擊時 ' + v.c + '% 噴墨，攻擊者 5 秒內的攻擊 ' + v.p + '% 落空'; },
    shield: function (v) { return '戰鬥中每 ' + v.t + ' 秒得到最大 HP ' + v.p + '% 的護盾（不疊加；只有你自己）'; },
    killHp: function (v) { return '打倒怪物時恢復最大 HP ' + v.p + '%'; },
    killMp: function (v) { return '打倒怪物時恢復最大 MP ' + v.p + '%'; },
    teamDmg: function (v) { return '全隊造成的傷害 +' + v.p + '%'; },
    ambush: function (v) { return '伏擊：對每個目標的第一次攻擊傷害 +' + v.p + '%'; },
    perAlly: function (v) { return '隊伍裡每有一名傭兵，造成的傷害 +' + v.p + '%'; },
    bossCut: function (v) { return '受到頭目的傷害 −' + v.p + '%'; },
    res: function (v) { return ({ resWater: '水', resFire: '火', resWind: '風', resEarth: '地' })[v.k] + '屬性抗性 +' + Math.round(v.n); },
    res4: function (v) { return '火、水、風、地屬性抗性各 +' + Math.round(v.n); },
    invuln: function (v) { return '保命：HP 低於 ' + v.th + '% 時無敵 ' + v.d + ' 秒（冷卻 ' + Math.round(v.cd) + ' 秒）'; },
    lastStand: function (v) { return '保命：受到致命傷害時保住 1 HP（冷卻 ' + Math.round(v.cd) + ' 秒），之後 10 秒造成的傷害 +' + v.p + '%（傭兵穿戴時沒有效果）'; },
    revive: function (v) { return '保命：倒下時以最大 HP ' + v.h + '% 站起來（冷卻 ' + Math.round(v.cd) + ' 秒；傭兵穿戴時沒有效果）'; }
  };
  // 武器另有「王者之威」：造成的傷害 +N%（各部位不同，11-13 木人場〔冥皇丹特斯〕對齊現有同部位遺物；×1／1.1／1.2／1.4／1.6）
  var MIGHT_BASE = { sword1: 0, dagger: 0, katana: 12, sword2: 12, spear: 10, blunt2: 30, bow: 15, wand: 15, claw: 15, dual: 15, chainsword: 15 };
  var MIGHT_K = [1, 1.1, 1.2, 1.4, 1.6];
  var might = function (row, s) { var b = MIGHT_BASE[row[1]]; return b ? Math.round(b * MIGHT_K[s]) : 0; };
  var isWpnRow = function (row) { return BASE[row[1]].type === 'wpn'; };
  var fxText = function (row, s) { return (might(row, s) ? '王者之威：造成的傷害 +' + might(row, s) + '%；' : '') + row.slice(4).map(function (e) { return TXT[e[0]](val(e[1], s)); }).join('；'); };

  // ── 物品 ──
  var BY = {}, KEYS = [];
  var boss = function (id) { try { return W.__afkMapBoss && W.__afkMapBoss.BY[id]; } catch (e) { return null; } };
  var imgOf = function (k) { try { return getIconUrl(DB.items[k]); } catch (e) { return ''; } };
  LIST.forEach(function (row) {
    var key = 'relic_boss_' + row[0], B = BASE[row[1]];
    var d = { n: row[2], type: B.type, relic: true, noEnhance: true, req: B.req, p: 10000, gachaWeight: 0, bossRelicKey: key, bossRelic: 0 };
    if (B.slot) d.slot = B.slot;
    ['isBow', 'ranged', 'w2h', 'chainsword', 'isWand', 'eff', 'ignHardSkin', 'weakExpose', 'pierceChance'].forEach(function (f) { if (B[f]) d[f] = B[f]; });
    Object.keys(B.s).forEach(function (f) { d[f] = B.s[f]; });
    row.slice(4).forEach(function (e) { if (e[0] === 'res') d[e[1].k] = (d[e[1].k] || 0) + e[1].n; if (e[0] === 'res4') ['resFire', 'resWater', 'resWind', 'resEarth'].forEach(function (f) { d[f] = (d[f] || 0) + e[1].n; }); });
    d.d = '【遺物】' + row[3] + ' 〔王者遺物・' + STAGE_N[0] + '〕' + fxText(row, 0) + '。';
    try { var src = DB.items[B.img]; if (src && src.img) d.img = src.img; } catch (e) {}
    if (!DB.items[key]) DB.items[key] = d;
    try { if (B.tags && typeof WEAPON_TAGS !== 'undefined' && !WEAPON_TAGS[key]) WEAPON_TAGS[key] = B.tags.slice(); } catch (e) {}
    BY[key] = row; KEYS.push(key);
  });
  // 圖示：GPT 圖到之前借同部位遺物的圖
  try {
    if (typeof getIconUrl === 'function' && !getIconUrl.__afkBossRelic) {
      var oIcon = getIconUrl;
      var nIcon = function (d) { if (d && d.bossRelicKey && !d.img && BASE[BY[d.bossRelicKey][1]]) { var k = BASE[BY[d.bossRelicKey][1]].img; if (DB.items[k]) return oIcon.call(this, DB.items[k]); } return oIcon.apply(this, arguments); };
      nIcon.__afkBossRelic = true; W.getIconUrl = nIcon; try { (0, eval)('getIconUrl = window.getIconUrl'); } catch (e) {}
    }
  } catch (e) {}
  // 遺物收集冊：它的索引在載入時就建好了，這裡把 79 件補進去
  try {
    if (typeof RELIC_CAT_ITEMS !== 'undefined' && typeof equipCatKey === 'function') KEYS.forEach(function (k) {
      var ck = equipCatKey(k, DB.items[k]); if (!ck || !RELIC_CAT_ITEMS[ck] || RELIC_CAT_ITEMS[ck].indexOf(k) >= 0) return;
      RELIC_CAT_ITEMS[ck].push(k); RELIC_ITEM_CAT[k] = ck;
    });
  } catch (e) {}
  // 掉落：跟一般遺物同一條路（MOB_DROPS[王的名字]）
  var addDrops = function () {
    if (typeof MOB_DROPS === 'undefined' || !W.__afkMapBoss) return false;
    LIST.forEach(function (row) {
      var b = boss(row[0]); if (!b) return; var key = 'relic_boss_' + row[0], l = MOB_DROPS[b.n] = MOB_DROPS[b.n] || [];
      if (!l.some(function (x) { return x[0] === key; })) l.push([key, RATE]);
    });
    return true;
  };
  if (!addDrops()) W.addEventListener('load', addDrops);

  // ── 遺物合成／昇華：寫入階段與該階的說明 ──
  var hookTier = function () {
    var o = W.__afkRelicTier; if (typeof o !== 'function' || o.__afkBossRelic) return false;
    var f = function (d, b, n, asc) {
      var r = o.apply(this, arguments);
      try {
        if (d && b && b.bossRelicKey && BY[b.bossRelicKey]) {
          var s = tier(n, asc), row = BY[b.bossRelicKey];
          d.bossRelicKey = b.bossRelicKey; d.bossRelic = s;
          row.slice(4).forEach(function (e) {
            if (e[0] === 'res') d[e[1].k] = N(d[e[1].k]) - e[1].n + Math.round(val(e[1], s).n);
            if (e[0] === 'res4') ['resFire', 'resWater', 'resWind', 'resEarth'].forEach(function (k) { d[k] = N(d[k]) - e[1].n + Math.round(val(e[1], s).n); });
          });
          d.d = '【遺物】' + row[3] + ' 〔王者遺物・' + STAGE_N[s] + '〕' + fxText(row, s) + '。';
        }
      } catch (e) {}
      return r;
    };
    f.__afkBossRelic = true; W.__afkRelicTier = f; return true;
  };
  if (!hookTier()) W.addEventListener('load', hookTier);

  // ════════ 效果 ════════
  var on = function () { var p = P(); return !!(p && !p.classicMode); };
  var party = function () { var p = P(); if (!p) return []; return [p].concat((p.allies || []).filter(function (a) { return a && !a._downed && !a.dead; })); };
  var isPlayer = function (x) { return x && x === P(); };
  var isAlly = function (x) { var p = P(); return !!(x && p && x !== p && (p.allies || []).indexOf(x) >= 0); };
  var hpOf = function (x) { return isPlayer(x) ? N(x.hp) : N(x.curHp); };
  var mhpOf = function (x) { return Math.max(1, N(x.mhp)); };
  var heal = function (x, n) { n = Math.floor(n); if (!(n > 0)) return; if (isPlayer(x)) x.hp = Math.min(x.mhp, N(x.hp) + n); else if (N(x.curHp) > 0) x.curHp = Math.min(mhpOf(x), N(x.curHp) + n); };
  // 近 5 秒每秒傷害（自己直接造成的傷害，不含王者遺物自己的追加傷害）：召喚、砲擊、中毒、反刺都用它算
  var DPS = new WeakMap();
  var dpsAdd = function (x, v) { var t = Math.floor(tk() / 10), o = DPS.get(x); if (!o) { o = { b: [0, 0, 0, 0, 0, 0], t: t }; DPS.set(x, o); } if (t !== o.t) { for (var i = o.t + 1; i <= t && i - o.t <= 6; i++) o.b[i % 6] = 0; o.t = t; } o.b[t % 6] += v; };
  var panel = function (x) { var o = DPS.get(x); if (!o) return 0; var t = Math.floor(tk() / 10); if (t - o.t >= 6) return 0; var sum = 0; for (var i = 1; i <= 5; i++) { if (t - i < o.t - 5 || t - i > o.t) continue; sum += o.b[(t - i + 6) % 6]; } return sum / 5; };
  var alive = function (m) { return m && !m._dead && N(m.curHp) > 0; };
  var mobs = function () { try { return (mapState.mobs || []).filter(alive); } catch (e) { return []; } };
  var target = function () { try { var t = typeof getTarget === 'function' ? getTarget() : null; return alive(t) ? t : mobs()[0] || null; } catch (e) { return null; } };
  var hit = function (m, n) { var x = X(); return x && n > 0 && alive(m) ? x.hitMob(m, n) : 0; };

  // 身上的王者遺物 → 各種效果（同一種相加；保命只取階段最高的一件）
  var CACHE = new WeakMap(), GEN = 0;
  // 換裝、重算能力時清掉快取（同一刻內換裝也立刻生效）
  var hookGen = function () {
    ['calcStats', 'recomputeStats'].forEach(function (fn) {
      var o = W[fn]; if (typeof o !== 'function' || o.__afkBossRelicGen) return;
      var f = function () { GEN++; return o.apply(this, arguments); }; f.__afkBossRelicGen = true; W[fn] = f;
      try { (0, eval)(fn + ' = window.' + fn); } catch (e) {}
    });
  };
  hookGen(); W.addEventListener('load', hookGen);
  var fx = function (x) {
    if (!x || !x.eq) return null;
    var t = tk() + ':' + GEN, c = CACHE.get(x); if (c && c.t === t) return c.v;
    var v = { has: false }, save = null;
    Object.keys(x.eq).forEach(function (slot) {
      var it = x.eq[slot], d = it && DB.items[it.id]; if (!d || !d.bossRelicKey || !BY[d.bossRelicKey]) return;
      if (slot === 'wpn2' || /^rem_|^doll|^mio/.test(slot)) return;
      var s = Math.max(0, Math.min(4, N(d.bossRelic))), row = BY[d.bossRelicKey];
      if (slot === 'wpn' && might(row, s)) { v.has = true; v.might = N(v.might) + might(row, s); }
      row.slice(4).forEach(function (e) {
        var k = e[0], o = val(e[1], s); v.has = true;
        if (SAVES[k]) { if (!save || s > save.s) save = { k: k, s: s, o: o, key: d.bossRelicKey }; return; }
        if (k === 'summon' || k === 'pulse') { (v[k] = v[k] || []).push(o); return; }
        var cur = v[k];
        if (!cur) { v[k] = Object.assign({}, o); return; }
        if (o.p != null) cur.p = r1(N(cur.p) + o.p);
        if (o.c != null) cur.c = Math.min(100, r1(N(cur.c) + o.c));
        if (o.n != null && k === 'mpSteal') cur.n += o.n;
        if (o.k != null) cur.k = Math.max(cur.k, o.k);
        if (o.t != null) cur.t = Math.min(cur.t, o.t);
        if (o.d != null) cur.d = Math.max(cur.d, o.d);
      });
    });
    if (save) v.save = save;
    CACHE.set(x, { t: t, v: v.has ? v : null }); return v.has ? v : null;
  };
  // 每人的計時器、冷卻
  var ST = new WeakMap();
  var st = function (x) { var s = ST.get(x); if (!s) { s = { icd: {}, stealthAt: -1e9, iaiAt: -1e9, saveCd: -1e9, invUntil: 0, lsUntil: 0, blockReady: false, shieldAt: -1e9, regenAt: 0, sumAt: 0, pulseAt: {} }; ST.set(x, s); } return s; };
  var proc = function (x, key, c) { var s = st(x), t = tk(); if ((s.icd[key] || -1e9) > t - 5) return false; if (Math.random() * 100 >= c) return false; s.icd[key] = t; return true; };
  // 怪物身上的標記
  var MK_ = new WeakMap();
  var mk = function (m) { var o = MK_.get(m); if (!o) { o = { dots: [] }; MK_.set(m, o); } return o; };
  var marked = function (m) { var o = MK_.get(m), t = tk(); return !!(o && ((o.ent || 0) > t || (o.curse || 0) > t || o.dots.some(function (d) { return d.until > t; }))); };
  var note = function (key, h) { try { var x = X(); if (x) x.note('br_' + key, h); } catch (e) {} };
  var popFx = function (key, txt) { try { var x = X(); if (x) x.pop('br_' + key, '', txt, '#fcd34d'); } catch (e) {} };

  var teamSum = function (k) { var n = 0; party().forEach(function (a) { var f = fx(a); if (f && f[k]) n += N(f[k].p); }); return n; };

  // ── 造成傷害 ──
  var dealt = function (actor, tgt, v, opt) {
    if (!on() || !(v > 0) || !tgt || !actor || typeof actor !== 'object') return v;
    var p = P(), kind = opt && opt.kind, main = kind === 'melee' || kind === 'ranged' || kind === 'magic', t = tk();
    var mine = isPlayer(actor) || isAlly(actor);
    if (mine) dpsAdd(actor, v);
    var pf = fx(p), mult = 1;
    if (!mine) {   // 寵物、召喚物
      if (pf) { if (pf.allyDmg) mult += pf.allyDmg.p / 100; if (pf.petDmg) mult += pf.petDmg.p / 100; }
      return mult !== 1 ? v * mult : v;
    }
    if (isAlly(actor) && pf && pf.allyDmg) mult += pf.allyDmg.p / 100;
    var team = teamSum('teamDmg'); if (team) mult += team / 100;
    var f = fx(actor);
    if (!f) return mult !== 1 ? v * mult : v;
    var s = st(actor), add = N(f.might);
    if (f.ranged && kind === 'ranged') add += f.ranged.p;
    if (f.melee && kind === 'melee') add += f.melee.p;
    if (f.atk && (kind === 'melee' || kind === 'ranged')) add += f.atk.p;
    if (f.magicDmg && kind === 'magic') add += f.magicDmg.p;
    if (f.berserk && hpOf(actor) < mhpOf(actor) * 0.5) add += f.berserk.p;
    if (f.hunt && N(tgt.curHp) < N(tgt.hp) * 0.5) add += f.hunt.p;
    if (f.vsMarked && marked(tgt)) add += f.vsMarked.p;
    if (f.perAlly && p) add += f.perAlly.p * Math.min(15, (p.allies || []).filter(function (a) { return a && !a._downed; }).length);
    if (s.lsUntil > t && s.lsP) add += s.lsP;
    if (main) {
      if (f.stealth && t - s.stealthAt >= f.stealth.t * 10) { add += f.stealth.p; s.stealthAt = t; popFx('st', '隱身'); }
      if (f.iai && kind === 'melee' && t - s.iaiAt >= f.iai.t * 10) { add += f.iai.p; s.iaiAt = t; popFx('iai', '居合'); }
      if (f.blockNext && s.blockReady) { add += f.blockNext.p; s.blockReady = false; }
      if (f.ambush) { var o = mk(tgt); o.amb = o.amb || []; if (o.amb.indexOf(actor) < 0) { o.amb.push(actor); add += f.ambush.p; } }
    }
    mult += add / 100; v = v * mult;
    if (!main) return v;
    // 命中時的觸發
    var o2 = mk(tgt);
    if (f.entangle && proc(actor, 'ent', f.entangle.c)) { o2.ent = t + 50; o2.entP = Math.max(o2.ent > t ? N(o2.entP) : 0, f.entangle.p); }
    if (f.curse && proc(actor, 'cur', f.curse.c)) { o2.curse = t + 80; o2.curseP = Math.max(N(o2.curseP), f.curse.p); }
    if (f.blind && proc(actor, 'bli', f.blind.c)) { o2.blind = t + 50; o2.blindP = Math.max(N(o2.blindP), f.blind.p); }
    if (f.control && !tgt.boss && proc(actor, 'ctl', f.control.c)) { o2.ctl = t + Math.round(f.control.d * 10); }
    if (f.poison && proc(actor, 'poi', f.poison.c)) {
      var mine2 = o2.dots.filter(function (d) { return d.src === actor && d.k === 'poi' && d.until > t; });
      if (mine2.length < f.poison.k) o2.dots.push({ src: actor, k: 'poi', until: t + 80, per: panel(actor) * f.poison.p / 100 });
      else { mine2.sort(function (a, b) { return a.until - b.until; }); mine2[0].until = t + 80; }
    }
    if (f.mpSteal && isPlayer(actor) && proc(actor, 'mps', f.mpSteal.c)) actor.mp = Math.min(N(actor.mmp), N(actor.mp) + Math.round(f.mpSteal.n));
    if (f.lifesteal) heal(actor, v * f.lifesteal.p / 100);
    if (f.double && (kind === 'melee' || kind === 'ranged') && proc(actor, 'dbl', f.double.c)) { var dv = Math.floor(v); setTimeout(function () { hit(tgt, dv); }, 0); }
    if (f.splash && kind === 'magic' && proc(actor, 'spl', f.splash.c)) { var sv = v * f.splash.p / 100; setTimeout(function () { mobs().forEach(function (m) { if (m !== tgt) hit(m, sv); }); }, 0); }
    return v;
  };

  // ── 受到傷害 ──
  var taken = function (ent, dmg, mob, kind) {
    if (!on() || !(dmg > 0) || !ent) return dmg;
    if (!isPlayer(ent) && !isAlly(ent)) return dmg;
    var t = tk(), s = st(ent), p = P();
    if (s.invUntil > t) return 0;
    var raw = dmg;
    if (mob) {
      var o = MK_.get(mob);
      if (o) {
        if ((o.ctl || 0) > t) return 0;
        if ((o.blind || 0) > t && Math.random() * 100 < o.blindP) return 0;
        if ((o.ink || 0) > t && Math.random() * 100 < o.inkP) return 0;
        if ((o.ent || 0) > t) dmg *= 1 - Math.min(60, N(o.entP)) / 100;
        if ((o.web || 0) > t) dmg *= 1 - Math.min(60, N(o.webP)) / 100;
      }
    }
    // 全隊：你的 HP 每少 25%
    var pf = fx(p);
    if (pf && pf.lowHpTeam) { var steps = Math.min(3, Math.floor((1 - hpOf(p) / mhpOf(p)) * 4 + 1e-9)); if (steps > 0) dmg *= 1 - pf.lowHpTeam.p * steps / 100; }
    var f = fx(ent);
    if (!f) return dmg;
    if (f.block && kind === 'phys' && proc(ent, 'blk', f.block.c)) { s.blockReady = true; popFx('blk', '格擋'); return 0; }
    var cut = 0;
    if (f.share) cut += f.share.p;
    if (f.guard) cut += f.guard.p;
    if (f.physCut && kind === 'phys') cut += f.physCut.p;
    if (f.magicCut && kind === 'magic') cut += f.magicCut.p;
    if (f.bossCut && mob && mob.boss) cut += f.bossCut.p;
    if (cut) dmg *= 1 - Math.min(50, cut) / 100;
    if (mob && alive(mob)) {
      var om = mk(mob);
      if (f.thorn && kind === 'phys' && proc(ent, 'thn', f.thorn.c)) om.dots.push({ src: ent, k: 'thn', until: t + 50, per: panel(ent) * f.thorn.p / 100 });
      if (f.reflect && proc(ent, 'ref', f.reflect.c)) { var rv = raw * f.reflect.p / 100; setTimeout(function () { hit(mob, rv); }, 0); }
      if (f.ink && proc(ent, 'ink', f.ink.c)) { om.ink = t + 50; om.inkP = Math.max(N(om.inkP), f.ink.p); }
      if (f.web && proc(ent, 'web', f.web.c)) { om.web = t + 50; om.webP = Math.max(N(om.webP), f.web.p); }
    }
    return dmg;
  };

  // ── 每一刻 ──
  var DOT_MOBS = new Set();
  var tick = function () {
    if (!on()) return;
    var t = tk(), fight = false; try { fight = X().inCombat(); } catch (e) {}
    party().forEach(function (a) {
      var f = fx(a); if (!f) return; var s = st(a);
      if (f.regen && t - s.regenAt >= 100) { s.regenAt = t; if (hpOf(a) > 0) heal(a, mhpOf(a) * f.regen.p / 100); }
      if (f.save && f.save.k === 'invuln' && hpOf(a) > 0 && hpOf(a) < mhpOf(a) * f.save.o.th / 100 && t - s.saveCd >= f.save.o.cd * 10) {
        s.saveCd = t; s.invUntil = t + Math.round(f.save.o.d * 10); popFx('inv' + (isPlayer(a) ? 'p' : 'a'), '無敵');
        note('inv', '<span class="text-amber-300 font-bold">【王者遺物】' + esc(isPlayer(a) ? '你' : (a._allyName || '隊友')) + '短暫無敵 ' + f.save.o.d + ' 秒。</span>');
      }
      if (!fight) return;
      if (f.summon && t - s.sumAt >= 30) {
        s.sumAt = t; var tg = target(), pv = panel(a);
        if (tg && pv > 0) f.summon.forEach(function (o) { hit(tg, pv * o.p / 100); });
      }
      if (f.pulse) f.pulse.forEach(function (o, i) {
        var at = s.pulseAt[i] || 0; if (t - at < o.t * 10) return; s.pulseAt[i] = t;
        var pv = panel(a); if (pv > 0) { mobs().forEach(function (m) { hit(m, pv * o.p / 100); }); popFx('pl' + i, o.name); }
      });
      if (f.shield && isPlayer(a) && t - s.shieldAt >= f.shield.t * 10) {
        s.shieldAt = t; try { var cap = mhpOf(a) * f.shield.p / 100; X().shield.add(cap, cap); } catch (e) {}
      }
    });
    // 中毒每秒
    if (t % 10 === 0) mobs().forEach(function (m) {
      var o = MK_.get(m); if (!o || !o.dots.length) return;
      o.dots = o.dots.filter(function (d) { return d.until > t; });
      var sum = 0; o.dots.forEach(function (d) { sum += d.per; });
      if (sum > 0) hit(m, sum);
    });
  };

  // ── 打倒怪物、保命 ──
  var kill = function () {
    if (!on()) return; var p = P(), f = fx(p); if (!f) return;
    if (f.killHp) heal(p, mhpOf(p) * f.killHp.p / 100);
    if (f.killMp && N(p.mmp) > 0) p.mp = Math.min(N(p.mmp), N(p.mp) + Math.floor(N(p.mmp) * f.killMp.p / 100));
  };
  var death = function () {
    if (!on()) return false; var p = P(), f = fx(p); if (!f || !f.save) return false;
    var s = st(p), t = tk(), sv = f.save;
    if (sv.k === 'invuln' || t - s.saveCd < sv.o.cd * 10) return false;
    s.saveCd = t;
    if (sv.k === 'lastStand') { p.hp = 1; s.lsUntil = t + 100; s.lsP = sv.o.p; s.invUntil = t + 5; popFx('ls', '不滅'); note('ls', '<span class="text-amber-300 font-bold">【王者遺物】你撐住了最後一口氣！</span>'); return true; }
    if (sv.k === 'revive') { p.hp = Math.max(1, Math.floor(mhpOf(p) * sv.o.h / 100)); s.invUntil = t + 5; popFx('rv', '再起'); note('rv', '<span class="text-amber-300 font-bold">【王者遺物】你重新站了起來！</span>'); return true; }
    return false;
  };
  var bind = function () {
    var x = X(); if (!x || bind.done) return; bind.done = true;
    x.on('dealt', dealt); x.on('taken', taken); x.on('tick', tick); x.on('kill', kill); x.on('death', death);
  };
  bind(); W.addEventListener('load', bind);

  // ── 金幣、經驗 ──
  var hookEco = function () {
    if (typeof W.dollFieldVal === 'function' && !W.dollFieldVal.__afkBossRelic) {
      var oD = W.dollFieldVal;
      var nD = function (field) { var r = oD.apply(this, arguments); try { if (field === 'goldBonus' && on()) { var f = fx(P()); if (f && f.gold) r = N(r) + f.gold.p; } } catch (e) {} return r; };
      nD.__afkBossRelic = true; W.dollFieldVal = nD; try { (0, eval)('dollFieldVal = window.dollFieldVal'); } catch (e) {}
    }
    var oE = W.__afkTtmiExpMult;
    if (!(oE && oE.__afkBossRelic)) {
      var nE = function (a) { var r = typeof oE === 'function' ? N(oE.apply(this, arguments)) || 1 : 1; try { if (on()) { var f = fx(P()); if (f && f.exp) r *= 1 + f.exp.p / 100; } } catch (e) {} return r; };
      nE.__afkBossRelic = true; W.__afkTtmiExpMult = nE;
    }
  };
  hookEco(); W.addEventListener('load', hookEco);

  W.__afkBossRelic = { _death: death, _taken: taken, _dealt: dealt, LIST: LIST, BASE: BASE, BY: BY, KEYS: KEYS, tier: tier, val: val, fx: fx, text: fxText, STAGE_N: STAGE_N, TXT: TXT, RATE: RATE };
})();
