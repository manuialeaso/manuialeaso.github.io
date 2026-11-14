/* ============================================================================
 * afk-mapboss.js — 地圖王、副本王（設計稿 rift-zodiac-plan 第六節；Ping 11-07 05:18「全部製作」）
 *
 *   地圖王（野外）：在那張地圖打倒 300 隻一般怪後出現；倒下後要再打 300 隻。離開地圖時牠會回去，回來就再出現。
 *   副本王（地監）：進入那一層、待滿 10 分鐘（遊戲時間）後出現；倒下後 30 分鐘（現實時間）才會再出現。
 *   Ping 11-14 18:46：同一隻王的地圖累計打倒 3000 隻（野外）／累計待超過 100 分鐘（地監，現實時間）之後，改成
 *     在那張地圖每打倒 100 隻一般怪骰一次：野外 1%、地監 0.5%，不保證出現；不吃任何速度、隊伍、模式加成。
 *   等級＝那張地圖一般怪的最高等級 +5；HP＝同等級地區霸主的 1.5 倍（再 ×(1＋0.15×傭兵數)）。
 *   每隻王兩種招式（見 MECH_D）；打倒得到原型怪的掉落、經驗與金幣 ×3、「王之徽章」×1（收集 30 個換地圖王卡片：之後設計）。
 *   設計稿裡的「獨眼巨人地區」「黑龍的傷痕」「盜賊地區」「沉船之墓」遊戲裡沒有這幾張圖，改放到最接近的地圖；大王烏賊留給次元裂縫副本 D。
 *   次元裂縫的裂縫版（多一個機制、掉次元密奧卡）跟裂縫本體一起做。
 *   經典模式沒有；外掛開關 mapboss。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, L = W.__afkLore;
  if (T && T.register) T.register({ id: 'mapboss', name: '地圖王、副本王', group: '遊戲內容', desc: '野外打倒 300 隻怪出現地圖王；地監待滿 10 分鐘出現副本王（倒下 30 分鐘重生）；累計 3000 隻／100 分鐘之後改成每 100 隻怪骰一次（1%／0.5%）；掉王之徽章' });
  if (T && !T.enabled('mapboss')) return;
  if (!L || typeof DB === 'undefined' || !DB.mobs || !DB.maps) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = L.esc, sys = L.sys, clog = L.clog;
  var REF = 65, KILLS = 300, DUNGEON_WAIT = 6000, RESPAWN_MS = 30 * 60 * 1000, DUR_MAX = 18000;
  var LATE_FIELD = 3000, LATE_DG_MS = 100 * 60 * 1000, ROLL_EVERY = 100, ROLL_RATE = { field: 0.01, dungeon: 0.005 };

  // ── 名單 ── type: field／dungeon；mech 兩個；proto＝外觀與掉落來源；minion＝手下
  var K = [
    { id: 'gorun', type: 'field', maps: ['talking_island'], n: '島嶼的老樹精 哥倫', proto: '石頭高崙', minion: '地靈', race: '植物', e: 'earth', mech: ['summon', 'regen'], lore: '說話之島最老的一棵樹。牠先讓小樹精出來擋路，教冒險者要先清掉小怪。' },
    { id: 'dela', type: 'field', maps: ['zone_01'], n: '墮落的樹妖 黛菈', proto: '卡司特王', minion: '那魯加妖魔', race: '植物', e: 'earth', mech: ['root', 'summon'], lore: '被妖魔森林的汙泥染黑的樹妖，藤蔓會把人纏在原地。' },
    { id: 'sarna', type: 'field', maps: ['elf_forest'], n: '叢林的巨蟒 薩爾納', proto: '蛇女', minion: '萊肯', race: '動物', e: 'earth', mech: ['root', 'poison'], lore: '從奇岩叢林游進妖魔森林的巨蟒，纏住獵物之後慢慢注毒。' },
    { id: 'odi', type: 'field', maps: ['gludio'], n: '叛逃的騎士 歐迪', proto: '黑騎士搜索隊', minion: '骷髏', race: '人類', e: 'none', mech: ['block', 'enrage'], lore: '從古魯丁守備隊叛逃的騎士，盾牌擋下一半的刀劍。' },
    { id: 'kajie', type: 'field', maps: ['windwood'], n: '沙塵的盜賊王 卡傑', proto: '哈維', minion: '蜥蜴人', race: '人類', e: 'wind', mech: ['ambush', 'steal'], lore: '風木一帶的盜賊王。消失在沙塵裡，再從背後出手。' },
    { id: 'kentgen', type: 'field', maps: ['kent'], n: '肯特的斷劍將軍', proto: '長老', minion: '侏儒戰士', race: '人類', e: 'none', mech: ['summon', 'adds'], lore: '肯特城破時沒有撤退的將軍。衛兵還站著，他就不會倒。' },
    { id: 'scar', type: 'field', maps: ['giran'], n: '盜賊團長 刀疤', proto: '強盜頭目', minion: '強盜', race: '人類', e: 'none', mech: ['steal', 'summon'], lore: '奇岩外圍的盜賊團長。會順手摸走一名隊員的金幣，打倒他才拿得回來。' },
    { id: 'melo', type: 'field', maps: ['heine'], n: '潮汐的女巫 梅洛', proto: '蛇女', minion: '鱷魚', race: '亞人', e: 'water', mech: ['quake', 'shieldM'], lore: '海音沼澤的女巫，每隔一陣子就掀起水柱。' },
    { id: 'polly', type: 'field', maps: ['zone_02'], n: '獨眼巨人之王 波利', proto: '獨眼巨人', minion: '冰原狼人', race: '巨人', e: 'earth', mech: ['ambush', 'enrage'], lore: '從奇岩深山走到歐瑞的獨眼巨人之王，投出的巨石能砸倒一名戰士。' },
    { id: 'fenris', type: 'field', maps: ['zone_03'], n: '雪原的冰狼王 芬里斯', proto: '冰原老虎', minion: '冰原狼人', race: '動物', e: 'water', mech: ['summon', 'adds'], lore: '歐瑞雪原的冰狼王，狼群全倒之前，牠不會正面迎戰。' },
    { id: 'saka', type: 'field', maps: ['desert'], n: '流沙的蠍王 薩卡', proto: '毒蠍', minion: '毒蠍', race: '動物', e: 'earth', mech: ['invuln', 'poison'], lore: '沙漠流沙下的蠍王，鑽進沙裡時刀槍不入，出來時一尾巴就是劇毒。' },
    { id: 'karan', type: 'field', maps: ['zone_04', 'zone_05'], n: '不散的戰魂 卡蘭', proto: '艾爾摩將軍', minion: '艾爾摩士兵', race: '不死', e: 'none', mech: ['revive', 'summon'], lore: '艾爾摩激戰地上不肯散去的戰魂，第一次倒下時會再站起來。' },
    { id: 'wag', type: 'field', maps: ['silver_knight'], n: '銀色的狼人 瓦格', proto: '萊肯', minion: '狼人', race: '狼人', e: 'none', mech: ['enrage', 'regen'], lore: '銀騎士村外的狼人頭目，傷口一轉眼就會癒合。' },
    { id: 'red', type: 'field', maps: ['pirate_wild'], n: '海賊船長 黑鬍子雷德', proto: '高等蜥蜴人', minion: '狂暴蜥蜴人', race: '人類', e: 'fire', mech: ['quake', 'steal'], lore: '海賊島的船長，開砲轟得整片海灘都在冒煙。' },
    { id: 'isfi', type: 'field', maps: ['eva_kingdom'], n: '深海的守護者 伊斯菲', proto: '奎斯坦修', minion: '人魚', race: '亞人', e: 'water', mech: ['regen', 'shieldP'], lore: '伊娃王國的守護者，在水裡會一直回復。' },
    { id: 'sphinx', type: 'field', maps: ['thebes_desert'], n: '沙暴的獅身人面', proto: '底比斯 斯芬克斯(黑)', minion: '底比斯 尖碑石奴', race: '底比斯', e: 'earth', mech: ['shieldM', 'shieldP'], lore: '底比斯沙漠的守謎者，輪流張開兩種屏障，答錯的人寸步難行。' },
    { id: 'kuku', type: 'field', maps: ['tikal_area'], n: '羽蛇的祭司 庫庫', proto: '提卡爾艾庫艾托', minion: '提卡爾艾庫阿茲特', race: '提卡爾', e: 'wind', mech: ['invuln', 'summon'], lore: '提卡爾神廟的祭司，祭壇燃起時誰也傷不了他。' },
    { id: 'ronin', type: 'field', maps: ['sunrise_castle'], n: '無名的落武者', proto: '鎌鼬長兄', minion: '嗚釜', race: '妖怪', e: 'none', mech: ['ambush', 'block'], lore: '日出之國城墎裡的落武者。拔刀的那一瞬間，就是最大 HP 的四成。' },
    { id: 'drake', type: 'field', maps: ['dragon_valley'], n: '黑鱗的幼龍', proto: '幼龍', minion: '思克巴', race: '龍', e: 'fire', mech: ['quake', 'enrage'], lore: '龍之谷深處孵出的黑鱗幼龍，吐息一掃就是一整排。' },
    // 副本王
    { id: 'spiderq', type: 'dungeon', maps: ['zone_07'], n: '地底的蜘蛛女王', proto: '楊果里恩', minion: '楊果里恩', race: '蜘蛛', e: 'earth', mech: ['root', 'summon'], lore: '古魯丁地監的蜘蛛女王，蛛網會把人黏在原地。' },
    { id: 'keeper', type: 'dungeon', maps: ['zone_14'], n: '被遺忘的守墓人', proto: '骷髏斧手', minion: '骷髏', race: '不死', e: 'none', mech: ['summon', 'revive'], lore: '說話之島地監最深處的守墓人，一直在召回骷髏。' },
    { id: 'one', type: 'dungeon', maps: ['zone_17'], n: '夢魘的幼龍 歐涅', proto: '幼龍', minion: '那魯加妖魔', race: '龍', e: 'none', mech: ['root', 'enrage'], lore: '眠龍洞穴裡做惡夢的幼龍，會讓一名隊員沉睡。' },
    { id: 'warden', type: 'dungeon', maps: ['zone_21'], n: '奇岩的監獄長', proto: '黑暗精靈', minion: '地獄犬', race: '黑暗妖精', e: 'none', mech: ['curse', 'block'], lore: '奇岩地監的監獄長，鎖鏈會讓整隊一起痛。' },
    { id: 'pharaoh', type: 'dungeon', maps: ['zone_25'], n: '法老的影子', proto: '食人妖精王', minion: '食人妖精', race: '不死', e: 'earth', mech: ['curse', 'summon'], lore: '沙漠地監裡的法老殘影，詛咒讓生命一點一點流走。' },
    { id: 'bone', type: 'dungeon', maps: ['zone_31'], n: '龍骨的守衛', proto: '阿魯巴', minion: '思克巴', race: '不死', e: 'fire', mech: ['shieldP', 'quake'], lore: '龍之谷地監最深處的骨盾守衛。' },
    { id: 'antguard', type: 'dungeon', maps: ['zone_33'], n: '巨蟻的近衛長', proto: '巨大強化白螞蟻', minion: '巨大突擊螞蟻', race: '昆蟲', e: 'earth', mech: ['adds', 'summon'], lore: '螞蟻洞窟的近衛長，兵蟻還活著時幾乎打不動。' },
    { id: 'rat', type: 'dungeon', maps: ['zone_36'], n: '下水道的毒鼠王', proto: '鼠人', minion: '鼠人', race: '動物', e: 'none', mech: ['poison', 'summon'], lore: '地下通道的毒鼠王，毒會一層一層疊上去。' },
    { id: 'golem', type: 'dungeon', maps: ['zone_41'], n: '失控的魔導人偶', proto: '活鎧甲', minion: '影魔', race: '高崙', e: 'none', mech: ['shieldM', 'shieldP'], lore: '象牙塔 8 樓失控的魔導人偶，在物理與魔法護盾之間切換。' },
    { id: 'watcher', type: 'dungeon', maps: ['rastabad_cave3'], n: '暗影的監視者', proto: '黑暗精靈使', minion: '黑暗妖精殘兵(劍)', race: '黑暗妖精', e: 'none', mech: ['ambush', 'curse'], lore: '拉斯塔巴德地下洞穴的監視者，從暗處出手。' },
    // 玩家 11-11：每張圖都要有特殊頭目（第二批，所有還沒有頭目的一般地圖、地監各樓層）
    { id: 'recruit', type: 'field', maps: ['training'], n: '修練場的教官人偶', proto: '妖魔弓箭手', minion: '妖魔', race: '妖魔', e: 'fire', mech: ['summon', 'regen'], lore: '新兵修練場角落那具會自己動的教官人偶。打得太慢它會一直叫助手上場。', add1111: true },
    { id: 'spartoi', type: 'field', maps: ['silent_outer'], n: '沉默的骨兵長', proto: '史巴托', minion: '歐熊', race: '不死', e: 'earth', mech: ['revive', 'summon'], lore: '沉默洞穴外徘徊的骨兵隊長，倒下一次還會把骨頭拼回去。', add1111: true },
    { id: 'hermit', type: 'field', maps: ['hidden_cave'], n: '洞穴的隱遁王 薩爾瓦', proto: '烈炎獸', minion: '黑暗精靈使', race: '地獄犬', e: 'fire', mech: ['ambush', 'enrage'], lore: '大洞穴隱遁者村莊外的獸王，從岩縫裡撲出來咬人。', add1111: true },
    { id: 'giantking', type: 'dungeon', maps: ['giant_tomb'], n: '巨人墓的守陵王', proto: '巨大墳墓守護者', minion: '墳墓守護者騎士', race: '墳墓守護者', e: 'fire', mech: ['shieldP', 'summon'], lore: '古代巨人之墓最後一道門的守衛，石甲擋得住刀劍。', add1111: true },
    { id: 'crystal', type: 'dungeon', maps: ['crystal_cave1'], n: '水晶洞的鋼心巨像', proto: '鋼鐵高崙', minion: '冰原老虎', race: '高崙', e: 'earth', mech: ['block', 'regen'], lore: '被水晶養大的鋼鐵高崙，碎裂的地方會長出新的晶體。', add1111: true },
    { id: 'ghoulking', type: 'dungeon', maps: ['zone_06'], n: '腐土的食屍鬼王 格魯', proto: '食屍鬼', minion: '史巴托', race: '不死', e: 'earth', mech: ['poison', 'summon'], lore: '古魯丁地監淺層的食屍鬼王，爪子上的腐土會讓傷口潰爛。', add1111: true },
    { id: 'elder13', type: 'dungeon', maps: ['zone_13'], n: '地監的老長老 歐巴', proto: '長老', minion: '石頭高崙', race: '長老', e: 'none', mech: ['shieldM', 'curse'], lore: '說話之島地監裡最老的長老，咒語一念傷口就難以癒合。', add1111: true },
    { id: 'pan', type: 'dungeon', maps: ['zone_15'], n: '污染的森林之主 潘恩', proto: '污染的潘', minion: '妖魔鬥士', race: '潘', e: 'fire', mech: ['root', 'regen'], lore: '眠龍洞穴入口那頭被汙染的潘，笛聲會讓人動彈不得。', add1111: true },
    { id: 'dudama', type: 'dungeon', maps: ['zone_16'], n: '都達瑪拉的大族長', proto: '都達瑪拉妖魔', minion: '羅孚妖魔', race: '妖魔', e: 'fire', mech: ['summon', 'adds'], lore: '統領眠龍洞穴二樓三個妖魔部族的大族長。手下還在，牠就躲在後面。', add1111: true },
    { id: 'crypt18', type: 'dungeon', maps: ['zone_18'], n: '奇岩墓穴的屍骨將', proto: '史巴托', minion: '食屍鬼', race: '不死', e: 'earth', mech: ['revive', 'block'], lore: '奇岩地監一樓的骨將，舉著殘破的盾擋下一半的攻擊。', add1111: true },
    { id: 'lykan', type: 'dungeon', maps: ['zone_19'], n: '月下的狼人頭目 萊卡', proto: '萊肯', minion: '歐熊', race: '狼人', e: 'wind', mech: ['enrage', 'ambush'], lore: '奇岩地監二樓的狼人頭目，聞到血就發狂。', add1111: true },
    { id: 'kastel', type: 'dungeon', maps: ['zone_20'], n: '卡司特的掘地將軍', proto: '卡司特', minion: '妖魔殭屍', race: '卡司特', e: 'earth', mech: ['quake', 'summon'], lore: '在奇岩地監三樓挖洞的卡司特將軍，一跺腳整層都在晃。', add1111: true },
    { id: 'shelob', type: 'dungeon', maps: ['zone_22'], n: '沙下的毒蛛 夏洛', proto: '夏洛伯', minion: '骷髏弓箭手', race: '蜘蛛', e: 'earth', mech: ['poison', 'root'], lore: '沙漠地監一樓的毒蛛，蛛絲黏住就跑不掉。', add1111: true },
    { id: 'ogre23', type: 'dungeon', maps: ['zone_23'], n: '沙窟的食人妖精隊長', proto: '食人妖精', minion: '食屍鬼', race: '食人妖精', e: 'fire', mech: ['enrage', 'steal'], lore: '沙漠地監二樓的食人妖精隊長，什麼都要搶，連金幣也不放過。', add1111: true },
    { id: 'ogre24', type: 'dungeon', maps: ['zone_24'], n: '沙窟的食人妖精祭司', proto: '食人妖精', minion: '史巴托', race: '食人妖精', e: 'fire', mech: ['curse', 'regen'], lore: '沙漠地監三樓替法老守門的祭司。', add1111: true },
    { id: 'skelwar', type: 'dungeon', maps: ['zone_26'], n: '龍谷的骷髏劍聖', proto: '骷髏鬥士', minion: '骷髏神射手', race: '不死', e: 'earth', mech: ['block', 'revive'], lore: '龍之谷地監入口的骷髏劍聖，生前是屠龍隊的一員。', add1111: true },
    { id: 'monia', type: 'dungeon', maps: ['zone_27'], n: '織網的莫妮亞女王', proto: '莫妮亞', minion: '骷髏鬥士', race: '蜘蛛', e: 'earth', mech: ['root', 'poison'], lore: '龍之谷地監二樓的蜘蛛女王，整層都是她的網。', add1111: true },
    { id: 'aruba', type: 'dungeon', maps: ['zone_28'], n: '阿魯巴的巨人首領', proto: '阿魯巴', minion: '莫妮亞', race: '巨人', e: 'earth', mech: ['quake', 'enrage'], lore: '龍之谷地監三樓的巨人首領，一拳能把岩壁打穿。', add1111: true },
    { id: 'scuba', type: 'dungeon', maps: ['zone_29'], n: '思克巴的戰爭母后', proto: '思克巴', minion: '阿魯巴', race: '思克巴', e: 'earth', mech: ['summon', 'adds'], lore: '龍之谷地監四樓的思克巴母后，產下的戰士會擋在她前面。', add1111: true },
    { id: 'scubaq', type: 'dungeon', maps: ['zone_30'], n: '龍谷深處的思克巴女帝', proto: '思克巴女皇', minion: '思克巴', race: '思克巴', e: 'earth', mech: ['summon', 'shieldM'], lore: '龍之谷地監最深處自封女帝的思克巴，周圍有魔法屏障守護。', add1111: true },
    { id: 'whiteant', type: 'dungeon', maps: ['zone_32'], n: '白蟻巢的工兵長', proto: '巨大白螞蟻', minion: '白螞蟻群', race: '昆蟲', e: 'water', mech: ['summon', 'regen'], lore: '螞蟻洞窟一樓的工兵長，只要巢還在牠就一直補兵。', add1111: true },
    { id: 'naga', type: 'dungeon', maps: ['zone_34'], n: '地下水道的蛇女祭司', proto: '蛇女', minion: '鼠人', race: '蛇女', e: 'water', mech: ['curse', 'shieldM'], lore: '地下通道一樓的蛇女祭司，對著水道唸著聽不懂的咒文。', add1111: true },
    { id: 'eyes', type: 'dungeon', maps: ['zone_35'], n: '千眼的監視者 歐庫', proto: '多眼怪', minion: '蛇女', race: '眼魔', e: 'wind', mech: ['root', 'invuln'], lore: '地下通道二樓的多眼怪首領，每一隻眼睛都在看著你。', add1111: true },
    { id: 'armor37', type: 'dungeon', maps: ['zone_37'], n: '象牙塔的守門巨像', proto: '鋼鐵高崙', minion: '活鎧甲', race: '高崙', e: 'earth', mech: ['shieldP', 'block'], lore: '象牙塔四樓的守門巨像，魔法師把它當成最後一道牆。', add1111: true },
    { id: 'armor38', type: 'dungeon', maps: ['zone_38'], n: '象牙塔的空殼騎士', proto: '活鎧甲', minion: '密密', race: '魔法生物', e: 'earth', mech: ['block', 'revive'], lore: '象牙塔五樓的空殼鎧甲，裡面早就沒有人了，卻還在巡邏。', add1111: true },
    { id: 'reaper', type: 'dungeon', maps: ['zone_39'], n: '象牙塔的收魂者', proto: '死神', minion: '紅鬼魂', race: '不死', e: 'earth', mech: ['curse', 'ambush'], lore: '象牙塔六樓的死神，悄悄出現在你背後收走靈魂。', add1111: true },
    { id: 'wraith', type: 'dungeon', maps: ['zone_40'], n: '象牙塔的哀泣亡靈', proto: '紅鬼魂', minion: '鬼魂', race: '不死', e: 'earth', mech: ['invuln', 'poison'], lore: '象牙塔七樓的亡靈，哭聲裡帶著讓人窒息的寒氣。', add1111: true },
    { id: 'ohm1', type: 'dungeon', maps: ['rastabad_cave1'], n: '狂暴的歐姆統領', proto: '狂暴的歐姆裝甲兵', minion: '歐姆裝甲兵', race: '歐姆', e: 'water', mech: ['enrage', 'shieldP'], lore: '拉斯塔巴德地下洞穴一樓的歐姆統領，盔甲厚到刀劍砍不進去。', add1111: true },
    { id: 'remnant', type: 'dungeon', maps: ['rastabad_cave2'], n: '殘兵的指揮官 薩恩', proto: '黑暗妖精殘兵(雙手劍)', minion: '黑暗妖精殘兵(法師)', race: '黑暗妖精', e: 'none', mech: ['summon', 'adds'], lore: '拉斯塔巴德地下洞穴二樓收攏殘兵的指揮官。', add1111: true },
    { id: 'gate', type: 'field', maps: ['rastabad_gate'], n: '正門的鐵壁將軍', proto: '黑暗妖精將軍', minion: '黑暗妖精警衛(矛)', race: '黑暗妖精', e: 'none', mech: ['block', 'summon'], lore: '拉斯塔巴德正門的守將，沒有他的允許誰也進不去。', add1111: true },
    { id: 'tamer', type: 'field', maps: ['rastabad_beast'], n: '受詛咒的馴獸王', proto: '受詛咒的馴獸師', minion: '拉斯塔巴德馴獸師', race: '拉斯塔巴德', e: 'fire', mech: ['summon', 'enrage'], lore: '魔獸訓練場的馴獸王，被自己養的魔獸反咬後受了詛咒。', add1111: true },
    { id: 'bast', type: 'dungeon', maps: ['thebes_pyramid'], n: '金字塔的守墓神官', proto: '底比斯 巴斯(紅)', minion: '底比斯 阿努斯(黑)', race: '底比斯', e: 'none', mech: ['curse', 'revive'], lore: '金字塔內部守護法老長眠的神官，死了也會從棺材裡爬起來。', add1111: true },
    { id: 'sadtio', type: 'field', maps: ['tikal_deep'], n: '神廟深處的血祭司', proto: '提卡爾薩德提歐(黃)', minion: '提卡爾薩德司卡(紅)', race: '提卡爾', e: 'none', mech: ['regen', 'shieldM'], lore: '提卡爾神廟深處主持血祭的祭司，祭壇的血會讓他恢復。', add1111: true },
    { id: 'elemlab', type: 'dungeon', maps: ['dark_magic_lab'], n: '失控的四元素核心', proto: '地元素守護者', minion: '水元素守護者', race: '元素', e: 'earth', mech: ['shieldM', 'shieldP'], lore: '黑魔法研究室裡失控的元素核心，輪流張開不同的屏障。', add1111: true },
    { id: 'necro', type: 'dungeon', maps: ['necro_training'], n: '冥法軍的教頭', proto: '重裝歐姆戰士', minion: '血騎士', race: '歐姆', e: 'earth', mech: ['enrage', 'block'], lore: '冥法軍訓練場的教頭，專門把新兵打到站不起來。', add1111: true },
    { id: 'bandit', type: 'field', maps: ['bandit_area'], n: '強盜的游擊頭子 巴洛', proto: '強盜游擊隊長', minion: '強盜狙擊手', race: '強盜', e: 'none', mech: ['steal', 'ambush'], lore: '強盜出沒地真正的頭子，打完就跑，搶完再回來。', add1111: true },
    { id: 'tiger', type: 'field', maps: ['cyclops_area'], n: '森林的白虎王 塔加', proto: '森林老虎', minion: '獨眼巨人', race: '動物', e: 'water', mech: ['ambush', 'enrage'], lore: '獨眼巨人出沒地的虎王，連獨眼巨人都怕牠。', add1111: true },
    { id: 'scarbeast', type: 'field', maps: ['dark_dragon_scar'], n: '闇龍傷痕的異界獸', proto: '特提斯', minion: '食腐獸', race: '異界生物', e: 'none', mech: ['poison', 'regen'], lore: '從闇龍的傷痕裂縫鑽出來的異界獸，傷口會自己癒合。', add1111: true },
    { id: 'lizardk', type: 'field', maps: ['giran_jungle'], n: '密林的蜥蜴王 戈札', proto: '蜥蜴', minion: '艾托', race: '邪惡蜥蜴', e: 'water', mech: ['root', 'poison'], lore: '密林地帶的蜥蜴王，舌頭一捲就把人拖進沼澤。', add1111: true },
    { id: 'handy', type: 'field', maps: ['underworld_path'], n: '海底隧道的怪手', proto: '怪手', minion: '人形殭屍', race: '魔法生物', e: 'wind', mech: ['root', 'summon'], lore: '海底隧道裡從牆上伸出來的大怪手，抓住誰就不放。', add1111: true },
    { id: 'dwarfgen', type: 'field', maps: ['oren_dwarf_village'], n: '侏儒部落的大將軍', proto: '精銳 侏儒將軍', minion: '精銳 侏儒咒術師', race: '侏儒', e: 'earth', mech: ['summon', 'adds'], lore: '侏儒部落的大將軍，躲在咒術師和斧頭兵後面發號施令。', add1111: true },
    { id: 'jelly', type: 'dungeon', maps: ['ivory_yahee'], n: '火焰之影的果凍王', proto: '果凍怪', minion: '閃電球', race: '史萊姆', e: 'wind', mech: ['regen', 'invuln'], lore: '象牙塔火焰之影裡越長越大的果凍王，打不死就會一直變大。', add1111: true },
    { id: 'lykan2', type: 'field', maps: ['ti_north'], n: '北島的狼群首領', proto: '萊肯', minion: '侏儒咒術師', race: '狼人', e: 'wind', mech: ['summon', 'enrage'], lore: '北島的狼人首領，帶著狼群在雪地裡繞圈。', add1111: true },
    { id: 'orcelder', type: 'field', maps: ['ti_orc_village'], n: '妖魔部落的大長者', proto: '長者', minion: '妖魔槍兵', race: '長老', e: 'none', mech: ['curse', 'summon'], lore: '說話之島妖魔部落的大長者，部落的戰士都聽他的。', add1111: true },
    { id: 'griffin', type: 'field', maps: ['windwood_wasteland'], n: '荒地的格利芬王', proto: '格利芬', minion: '蜥蜴人', race: '格利芬', e: 'wind', mech: ['ambush', 'quake'], lore: '風木荒地上空盤旋的格利芬王，俯衝下來就是一陣狂風。', add1111: true },
    { id: 'wingdemon', type: 'dungeon', maps: ['training_dg1'], n: '修練地監的翼魔教官', proto: '翼魔', minion: '邪惡的高崙', race: '惡魔', e: 'wind', mech: ['ambush', 'shieldP'], lore: '修練地監一樓的翼魔教官，專門找落單的冒險者。', add1111: true },
    { id: 'ogrechief', type: 'dungeon', maps: ['training_dg2'], n: '邪惡的食人妖精大首領', proto: '邪惡的食人妖精首領', minion: '邪惡的食人妖精', race: '食人妖精', e: 'fire', mech: ['enrage', 'summon'], lore: '修練地監二樓的食人妖精大首領。', add1111: true },
    { id: 'desire', type: 'dungeon', maps: ['desire_cave'], n: '慾望洞穴的四元之主', proto: '土之守護者', minion: '水之守護者', race: '元素', e: 'earth', mech: ['shieldM', 'regen'], lore: '慾望洞穴深處四元素的主人，會實現人心底的慾望，代價是你的命。', add1111: true },
    { id: 'lab', type: 'dungeon', maps: ['demon_lab_1'], n: '魔族實驗室的試作兵器', proto: '秘密實驗室騎兵', minion: '秘密實驗室警備隊(槍兵)', race: '拉斯塔巴德', e: 'earth', mech: ['block', 'revive'], lore: '魔族實驗室做出來的試作兵器，壞掉一次還能自己重新啟動。', add1111: true },
    { id: 'kraken', type: 'field', maps: ['ship_grave'], n: '大王烏賊', proto: '隱藏的半魚人', minion: '惡靈', race: '水生物', e: 'water', mech: ['root', 'adds'], lore: '船舶之墓下的大王烏賊，觸手把沉船一艘一艘拖進海底。', add1111: true },
  ];
  var MECH_N = { summon: '召喚', enrage: '狂暴', quake: '震地', regen: '再生', shieldM: '魔法屏障', shieldP: '物理屏障', root: '纏繞', block: '格擋', ambush: '伏擊', adds: '護衛', steal: '偷竊', revive: '不散', poison: '疊毒', invuln: '遁形', curse: '詛咒' };
  var MECH_D = {
    summon: '每 45 秒，手下少於 2 名時叫 2 名', enrage: 'HP 30% 以下：攻擊速度 ×1.5、造成的傷害 ×1.3', quake: '每 30 秒全隊受到最大 HP 6% 的傷害', regen: '每 10 秒回復最大 HP 2%',
    shieldM: '每 40 秒張開 6 秒：魔法傷害無效', shieldP: '每 40 秒張開 6 秒：物理傷害無效', root: '每 25 秒讓隊伍裡一個人暈眩 3 秒', block: '一般攻擊打牠時 50% 被格擋（傷害減半）',
    ambush: '每 25 秒消失 3 秒，接著對一名隊員造成最大 HP 30% 的傷害', adds: '手下還活著時，受到的傷害 −50%', steal: '每 60 秒偷走你身上 2% 的金幣（最多 100 萬），打倒牠全部拿回',
    revive: '第一次倒下時以 30% HP 站起來', poison: '每 10 秒全隊疊 1 層毒（每層每秒最大 HP 0.3%，最多 10 層），打倒牠就解除', invuln: '每 30 秒遁形 3 秒，期間不受傷害', curse: '每 20 秒全隊受到最大 HP 8% 的傷害'
  };

  // ── 怪物資料 ──
  var protoOf = function (n) { var hit = null; for (var k in DB.mobs) if (DB.mobs[k] && DB.mobs[k].n === n) { hit = k; if (!DB.mobs[k].afkTtmi) break; } return hit; };
  var mobIdByName = function (n) { for (var k in DB.mobs) if (DB.mobs[k] && DB.mobs[k].n === n && !DB.mobs[k].boss) return k; return null; };
  var BADGE = 'afk_mb_badge', BYMAP = {}, BY = {};
  L.addItem(BADGE, { n: '王之徽章', type: 'misc', c: 'text-amber-300', img: 'assets/icons/items/法令軍王徽印.png', p: 0, noSell: true,
    d: '打倒地圖王、副本王得到的徽章。在「收藏 → 怪物」卡片收集冊的王者分頁可以換卡片：30 個換普卡、300 個換銀卡（只能換打倒過的王）。' });
  // 玩家 11-11 13:58：79 隻都有自己的圖了（assets/anim/<名稱>/idle、attack、hurt、death），不再借原型怪的動畫；裂縫版（名稱加「（裂縫）」）共用同一套
  var GETG = function (n) { try { return (0, eval)(n); } catch (e) { return null; } };
  var ownArt = function (b) {
    try {
      var names = GETG('MOB_ANIM_NAMES'), alias = GETG('MOB_ANIM_ALIAS'); if (!names) return;
      names.add(b.n); names.add(b.n + '（裂縫）');
      if (alias) { delete alias[b.n]; alias[b.n + '（裂縫）'] = b.n; }
      var pk = protoOf(b.proto); if (pk && DB.mobs[pk] && DB.mobs[pk].img && !DB.mobs[b.mobId].img) DB.mobs[b.mobId].img = DB.mobs[pk].img;   // 圖鑑小圖照舊用原型怪的
    } catch (e) {}
  };
  K.forEach(function (b) {
    b.mobId = 'afk_mb_' + b.id;
    var pk = protoOf(b.proto), base = pk ? JSON.parse(JSON.stringify(DB.mobs[pk])) : {};
    ['n', 'afkTtmi', 'hard', 'img', 'boss', 'mag', 'mag2', 'mag3', 'transformTo'].forEach(function (k) { delete base[k]; });
    L.addMob(b.mobId, Object.assign(base, { s: 'L', beh: '主動', lv: REF }, { n: b.n, boss: true, race: b.race, e: b.e, hp: 30000, ac: -65, mr: 90, exp: 5000, goldMin: 3000, goldMax: 7000,
      atkSpd: 1.6, dmg: [3, 40], db: 40, hit: 80, afkMb: b.id,
      mag: { skn: b.n.split(' ').pop() + '的重擊', cd: 70, chance: 0.4, dmg: [4, 60], db: 80, ele: b.e, alwaysHit: true } }));
    ownArt(b);
    try { if (typeof MOB_DROPS !== 'undefined' && !MOB_DROPS[b.n] && MOB_DROPS[b.proto]) MOB_DROPS[b.n] = MOB_DROPS[b.proto].filter(function (x) { return !(DB.items[x[0]] && DB.items[x[0]].questItem); }).map(function (x) { return x.slice(); }); } catch (e) {}
    b.maps.forEach(function (m) { BYMAP[m] = b; });
    BY[b.id] = b;
  });
  var mapMaxLv = function (id) { var ls = (DB.maps[id] || []).map(function (k) { return DB.mobs[k]; }).filter(function (m) { return m && !m.boss; }).map(function (m) { return Number(m.lv) || 1; }); return ls.length ? Math.max.apply(null, ls) : 30; };
  var scale = function (base, Lv, hpMult) {
    var k = Lv / REF, m = JSON.parse(JSON.stringify(base));
    m.lv = Lv; m.hp = Math.max(1, Math.round(base.hp * Math.pow(k, 2.5) * (hpMult || 1)));
    if (Array.isArray(base.dmg)) m.dmg = [base.dmg[0], Math.max(2, Math.round(base.dmg[1] * k))];
    m.db = Math.max(0, Math.round((base.db || 0) * Math.pow(k, 1.3))); m.hit = Math.round((base.hit || 0) * k); m.ac = Math.round((base.ac || 0) * k); m.mr = Math.round((base.mr || 0) * k);
    ['mag', 'mag2'].forEach(function (f) { var s = m[f]; if (!s) return; if (Array.isArray(s.dmg)) { s.dmg = [s.dmg[0], Math.max(2, Math.round(s.dmg[1] * k))]; s.db = Math.round((s.db || 0) * Math.pow(k, 1.3)); } });
    m.exp = Math.round((base.exp || 0) * k * k * 3); m.goldMin = Math.round((base.goldMin || 0) * k * 3); m.goldMax = Math.round((base.goldMax || 0) * k * 3);
    return m;
  };
  var allyCount = function () { var p = P(); return p ? (p.allies || []).filter(Boolean).length : 0; };

  // ── 狀態 ──
  var act = null;
  var store = function () { var p = P(); if (!p) return { kills: {}, next: {}, stats: {} }; var s = p.afkMb && typeof p.afkMb === 'object' ? p.afkMb : (p.afkMb = {}); s.kills = s.kills || {}; s.next = s.next || {}; s.stats = s.stats || {}; return s; };
  var stat = function (id) { var s = store().stats; return s[id] || (s[id] = { met: 0, kills: 0 }); };
  var classic = function () { var p = P(); return !!(p && p.classicMode); };
  var busy = function () {
    try { if (W.__afkWorldEvents && W.__afkWorldEvents.active && W.__afkWorldEvents.active()) return true; } catch (e) {}
    try { if (W.__afkRegionBoss && W.__afkRegionBoss.active && W.__afkRegionBoss.active()) return true; } catch (e) {}
    try { if (typeof W.__afkOfflineNow === 'function' && W.__afkOfflineNow()) return true; } catch (e) {}
    var s = S(); return !!(s.riftRun || s._afkFinal || s.antharas || s.prideClimb);
  };
  var onField = function (role) { return (mapState.mobs || []).map(function (m, i) { return [m, i]; }).filter(function (x) { var m = x[0]; return m && act && m._afkMb === act.id && !m._dead && m.curHp > 0 && (role === 'boss' ? m._mbBoss : role === 'minion' ? m._mbMinion : true); }); };
  var has = function (k) { return act && (BY[act.id].mech.indexOf(k) >= 0 || act.extra === k); };
  var ALL_MECH = ['summon', 'enrage', 'quake', 'regen', 'shieldM', 'shieldP', 'root', 'block', 'ambush', 'adds', 'poison', 'invuln', 'curse'];
  var riftOn = function () { try { return !!(W.__afkDimRiftOn && W.__afkDimRiftOn()); } catch (e) { return false; } };
  var slotFor = function () { var ms = mapState.mobs || [], i; for (i = 0; i < ms.length; i++) if (!ms[i] || ms[i]._dead) return i; for (i = 0; i < ms.length; i++) if (ms[i] && !ms[i].boss) return i; return -1; };
  var start = function (b) {
    var idx = slotFor(); if (idx < 0) return false;
    var Lv = Math.max(10, Math.min(130, mapMaxLv(mapState.current) + 5));
    var m = scale(DB.mobs[b.mobId], Lv, 1.5 * (1 + 0.15 * allyCount()));
    var rf = riftOn(); if (rf) { m.hp = Math.round(m.hp * 1.5); if (m.hit) m.hit = Math.round(m.hit * 4 / 3); }
    var mob = L.boss.place(idx, m, { mobId: b.mobId, _afkMb: b.id, _mbBoss: true, _mbL: Lv, _dimRift: rf });
    if (!mob) return false;
    var t = tk();
    act = { id: b.id, map: mapState.current, born: t, summonAt: t + 150, quakeAt: t + 300, regenAt: t + 100, shieldAt: t + 200, shieldKind: 0, rootAt: t + 250, ambushAt: t + 250, stealAt: t + 600, poisonAt: t + 100, invulnAt: t + 300, curseAt: t + 200, layers: 0, stolen: 0, revived: false, enraged: false };
    if (rf) { var pool = ALL_MECH.filter(function (k) { return b.mech.indexOf(k) < 0; }); act.extra = pool[Math.floor(Math.random() * pool.length)]; mob.n = mob.n + '（裂縫）'; }
    stat(b.id).met++;
    try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(mob); } catch (e) {}
    try { if (!S().ff) renderMobs(); } catch (e) {}
    sys('<span class="font-bold" style="color:#fcd34d;text-shadow:0 0 8px #000">👑 ' + (b.type === 'field' ? '地圖王' : '副本王') + '「' + esc(b.n) + '」出現了！</span><span class="text-slate-300">（Lv' + Lv + '，' + b.mech.concat(act.extra ? [act.extra] : []).map(function (k) { return MECH_N[k]; }).join('、') + (act.extra ? '；次元裂縫：多了一種機制' : '') + '）</span>');
    return true;
  };
  var giveBack = function () { var p = P(); if (p && act && act.stolen > 0) { p.gold = (Number(p.gold) || 0) + act.stolen; sys('<span class="text-amber-200">拿回被偷走的金幣 ' + act.stolen.toLocaleString() + '。</span>'); act.stolen = 0; } };
  var end = function (why) {
    if (!act) return;
    var b = BY[act.id];
    onField().forEach(function (x) { if (why !== 'kill' || !x[0]._mbBoss) mapState.mobs[x[1]] = null; });
    try { if (!S().ff) renderMobs(); } catch (e) {}
    if (why === 'kill') giveBack();
    if (why === 'leave') { sys('<span style="color:#fcd34d">👑 ' + esc(b.n) + ' 回到了巢穴。</span>'); if (late(b)) lateRec().lucky[b.id] = 1; else if (b.type === 'field') store().kills[b.id] = KILLS; }
    if (why === 'time') sys('<span style="color:#fcd34d">👑 ' + esc(b.n) + ' 不再理會你們，回到了巢穴。</span>');
    act = null;
  };

  // 野外：打倒一般怪計數
  // 累計（野外：打倒數；地監：待的毫秒數）、機率階段的計數與「骰中了」
  var lateRec = function () { var s = store(); s.life = s.life || {}; s.roll = s.roll || {}; s.lucky = s.lucky || {}; return s; };
  var late = function (b) { var v = lateRec().life[b.id] || 0; return b.type === 'field' ? v >= LATE_FIELD : v >= LATE_DG_MS; };
  var countKill = function (m) {
    if (!m || m.boss || m._afkMb || classic()) return;
    var b = BYMAP[mapState.current]; if (!b) return;
    var s = lateRec();
    if (late(b)) {
      if (!act && !s.lucky[b.id]) { s.roll[b.id] = (s.roll[b.id] || 0) + 1; if (s.roll[b.id] >= ROLL_EVERY) { s.roll[b.id] = 0; if (Math.random() < ROLL_RATE[b.type]) s.lucky[b.id] = 1; } }
      if (b.type === 'field') s.life[b.id] = (s.life[b.id] || 0) + 1;
      return;
    }
    if (b.type !== 'field') return;
    s.life[b.id] = (s.life[b.id] || 0) + 1;
    s.kills[b.id] = Math.min(KILLS, (s.kills[b.id] || 0) + 1);
  };
  var tryStart = function () {
    if (act || classic() || busy()) return;
    var p = P(); if (!p || p.dead) return;
    var b = BYMAP[mapState.current]; if (!b) return;
    var s = lateRec();
    if (late(b)) { if (s.lucky[b.id] && start(b)) s.lucky[b.id] = 0; return; }
    if (b.type === 'field') { if ((s.kills[b.id] || 0) >= KILLS && start(b)) s.kills[b.id] = 0; return; }
    if (Date.now() < (s.next[b.id] || 0)) return;
    if (S()._mbEnterMap !== mapState.current) { S()._mbEnterMap = mapState.current; S()._mbEnterAt = tk(); return; }
    if (tk() - (S()._mbEnterAt || 0) >= DUNGEON_WAIT) start(b);
  };

  // ── 招式 ──
  var party = function () { return L.boss.party().filter(function (x) { return x && !x.dead && !x._downed; }); };
  var mhpOf = function (x) { return x === P() ? (x.mhp || 1) : (x.mhp || x.curHp || 1); };
  var stun = function (x, ticks) { try { var B = W.AFK_RELIC_DEFENSE_BRIDGE; if (B && B.setStatus) B.setStatus(x, 'stun', ticks, null); else if (x.statuses) x.statuses.stun = ticks; } catch (e) {} };
  var skills = function (m) {
    var t = tk(), b = BY[act.id];
    if (L.boss.halted(m)) { ['summonAt', 'quakeAt', 'regenAt', 'shieldAt', 'rootAt', 'ambushAt', 'stealAt', 'poisonAt', 'invulnAt', 'curseAt'].forEach(function (k) { act[k]++; }); return; }
    if (has('enrage') && !act.enraged && m.curHp <= m.hp * 0.3) { act.enraged = true; m._mbEnraged = true; m.atkSpd = Math.max(0.3, (Number(m.atkSpd) || 1.6) / 1.5); clog('<span class="font-bold" style="color:#f87171">【狂暴】</span>' + esc(m.n) + ' 怒吼起來——攻擊速度 ×1.5、傷害 ×1.3！'); }
    if (has('summon') && t >= act.summonAt) { act.summonAt = t + 450; var mid = mobIdByName(b.minion); if (mid && onField('minion').length < 2) { var n = L.boss.summon(mid, 2, { _afkMb: act.id, _mbMinion: true }); if (n) clog('<span class="font-bold" style="color:#fcd34d">【召喚】</span>' + esc(m.n) + ' 叫來了 ' + n + ' 名' + esc(b.minion) + '。'); } }
    if (has('quake') && t >= act.quakeAt) { act.quakeAt = t + 300; party().forEach(function (x) { L.boss.hurt(x, mhpOf(x) * 0.06); }); clog('<span class="font-bold" style="color:#fb923c">【震地】</span>' + esc(m.n) + '——全隊受到最大 HP 6% 的傷害。'); }
    if (has('curse') && t >= act.curseAt) { act.curseAt = t + 200; party().forEach(function (x) { L.boss.hurt(x, mhpOf(x) * 0.08); }); clog('<span class="font-bold" style="color:#c084fc">【詛咒】</span>' + esc(m.n) + '——全隊受到最大 HP 8% 的傷害。'); }
    if (has('regen') && t >= act.regenAt) { act.regenAt = t + 100; if (m.curHp < m.hp) m.curHp = Math.min(m.hp, m.curHp + Math.ceil(m.hp * 0.02)); }
    if ((has('shieldM') || has('shieldP')) && t >= act.shieldAt) {
      act.shieldAt = t + 400; var kinds = ['shieldM', 'shieldP'].filter(has), k = kinds[act.shieldKind++ % kinds.length], magic = k === 'shieldM';
      m._reflectWall = { kind: magic ? 'magic' : 'phys', until: t + 60, block: true, afkRb: true };
      clog('<span class="font-bold" style="color:#a78bfa">【' + MECH_N[k] + '】</span>' + esc(m.n) + ' 張開了' + MECH_N[k] + '——6 秒內' + (magic ? '魔法' : '物理') + '傷害無效。');
    }
    if (has('root') && t >= act.rootAt) { act.rootAt = t + 250; var ps = party(), v = ps[Math.floor(Math.random() * ps.length)]; if (v) { stun(v, 30); clog('<span class="font-bold" style="color:#86efac">【纏繞】</span>' + esc(m.n) + ' 困住了 ' + esc(v === P() ? '你' : (v._allyName || '傭兵')) + '（3 秒）。'); } }
    if (has('ambush')) {
      if (!act.hideUntil && t >= act.ambushAt) { act.hideUntil = t + 30; clog('<span class="font-bold" style="color:#94a3b8">【伏擊】</span>' + esc(m.n) + ' 消失了……'); }
      else if (act.hideUntil && t >= act.hideUntil) { act.hideUntil = 0; act.ambushAt = t + 250; var ps2 = party(), v2 = ps2[Math.floor(Math.random() * ps2.length)]; if (v2) { L.boss.hurt(v2, mhpOf(v2) * 0.3); clog('<span class="font-bold" style="color:#f87171">【伏擊】</span>' + esc(m.n) + ' 從背後出手——' + esc(v2 === P() ? '你' : (v2._allyName || '傭兵')) + ' 受到最大 HP 30% 的傷害！'); } }
    }
    if (has('steal') && t >= act.stealAt) { act.stealAt = t + 600; var p = P(), g = Math.min(1000000, Math.floor((Number(p.gold) || 0) * 0.02)); if (g > 0) { p.gold -= g; act.stolen += g; clog('<span class="font-bold" style="color:#fcd34d">【偷竊】</span>' + esc(m.n) + ' 摸走了 ' + g.toLocaleString() + ' 金幣（打倒牠就拿得回來）。'); } }
    if (has('poison')) {
      if (t >= act.poisonAt) { act.poisonAt = t + 100; act.layers = Math.min(10, act.layers + 1); }
      if (act.layers && t % 10 === 0) party().forEach(function (x) { L.boss.hurt(x, mhpOf(x) * 0.003 * act.layers); });
    }
    if (has('invuln') && t >= act.invulnAt) { act.invulnAt = t + 300; act.invulnUntil = t + 30; clog('<span class="font-bold" style="color:#94a3b8">【遁形】</span>' + esc(m.n) + ' 遁形了——3 秒內不受傷害。'); }
  };
  var stayAt = 0, stayMap = '';
  var step = function () {
    // 地監累計停留（現實時間，不吃加速）
    try { var sb = BYMAP[mapState.current], nw = Date.now(); if (sb && sb.type === 'dungeon' && !classic()) { if (stayMap === mapState.current && stayAt) { var lr = lateRec(); lr.life[sb.id] = (lr.life[sb.id] || 0) + Math.min(5000, Math.max(0, nw - stayAt)); } stayMap = mapState.current; stayAt = nw; } else { stayMap = ''; stayAt = 0; } } catch (e) {}
    if (!act) { if (tk() % 10 === 0) tryStart(); return; }
    if (mapState.current !== act.map) { end('leave'); return; }
    var bb = onField('boss')[0]; if (!bb) { end('leave'); return; }
    if (tk() - act.born > DUR_MAX) { end('time'); return; }
    skills(bb[0]);
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var t0 = tk(), r = oTick.apply(this, arguments); if (tk() !== t0) { try { step(); } catch (e) { console.warn('[AFK-mapboss] tick', e); } } return r; };
  }
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { return mob && mob._mbEnraged && mob._afkMb ? 1.3 : 1; });
  // 對王造成的傷害：格擋、護衛、遁形、伏擊中
  var hooked = false;
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return hooked;
    var o = C.damage; hooked = true;
    C.damage = function (actor, target, amount, opt) {
      try {
        if (target && target._mbBoss && act && target._afkMb === act.id && amount > 0) {
          var t = tk();
          if ((act.invulnUntil || 0) > t || (act.hideUntil || 0) > t) amount = 1;
          else {
            if (has('block') && opt && opt.packet && Math.random() < 0.5) amount = amount * 0.5;
            if (has('adds') && onField('minion').length) amount = amount * 0.5;
          }
        }
      } catch (e) {}
      return o.call(this, actor, target, Math.max(1, Math.floor(amount)), opt);
    };
    return true;
  };
  if (!hookDamage()) { try { document.addEventListener('DOMContentLoaded', hookDamage); } catch (e) {} }
  // 擊殺
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState.mobs ? mapState.mobs[idx] : null, wasDead = !!(m && m._dead);
      if (m && !wasDead && m._mbBoss && act && m._afkMb === act.id && has('revive') && !act.revived) {
        act.revived = true; m.curHp = Math.ceil(m.hp * 0.3);
        clog('<span class="font-bold" style="color:#fcd34d">【不散】</span>' + esc(m.n) + ' 又站了起來！'); return;
      }
      var r = oKill.apply(this, arguments);
      try {
        if (m && !wasDead) countKill(m);
        if (m && m._dead && m._mbBoss && !m._mbPaid && act && m._afkMb === act.id) {
          m._mbPaid = true; var b = BY[act.id];
          gainItem(BADGE, 1, true, true); stat(act.id).kills++;
          if (b.type === 'dungeon') store().next[b.id] = Date.now() + RESPAWN_MS;
          sys('<span class="font-bold" style="color:#fcd34d">👑 ' + esc(b.n) + ' 倒下了！</span><span class="text-amber-300">得到 王之徽章 ×1</span>');
          try { if (W.__afkBossCardKill) W.__afkBossCardKill(b, m); } catch (e2) {}   // 王者卡冊（afk-bosscard.js）
          end('kill');
        }
      } catch (e) { console.warn('[AFK-mapboss] kill', e); }
      return r;
    };
  }

  (W.LineageAbsoluteDamageGates=W.LineageAbsoluteDamageGates||[]).push(function(a,t,n){return t&&t._mbBoss&&act&&t._afkMb===act.id&&((act.invulnUntil||0)>tk()||(act.hideUntil||0)>tk())?0:n;});
  W.__afkMapBoss = { LIST: K, BY: BY, BYMAP: BYMAP, MECH_N: MECH_N, MECH_D: MECH_D, KILLS: KILLS, active: function () { return act; }, store: store, stats: stat, start: function (id) { var b = BY[id]; return b ? start(b) : false; }, end: end, step: step };
  try { console.log('[AFK-mapboss] 已載入：地圖王 ' + K.filter(function (x) { return x.type === 'field'; }).length + ' 隻、副本王 ' + K.filter(function (x) { return x.type === 'dungeon'; }).length + ' 隻'); } catch (e) {}
})();
