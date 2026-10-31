/* ============================================================================
 * afk-class-saga.js — 八職業專屬劇情任務（55～80 級，第二部）（玩家 2026-10-27 指定）
 *
 * 每個職業各有一條六章的專屬故事線（55／60／65／70／75／80 級），由該職業原本的試煉導師發派：
 *   王族：說話之島 甘特「王冠的重量」　　騎士：威頓村 馬沙「誓約之劍」
 *   法師：象牙塔 塔拉斯「象牙塔的真理」　妖精：妖精森林 迷幻森林之母「世界樹的低語」
 *   黑暗妖精：沉默洞穴 布魯迪卡「沉默的刀鋒」　幻術士：希培利亞 希蓮恩「裂痕的歸鄉」
 *   戰士：海音 多文「斧與血」　　　　　　龍騎士：貝希摩斯 普洛凱爾「龍之血誓」
 * 規則（沿用試煉接取制）：達等級向導師接取 → 指定怪物 100% 掉章節道具（只有接取中、未集滿才掉；不能存倉庫）
 *   → 一次交付。每章每個角色只能完成一次，要先完成前一章。
 * 獎勵：每章第一次完成給經驗（該章等級升級所需經驗的 15%）與祝福的強化卷軸；第六章另給職業專屬「傳承腰帶」。
 * 與「亞丁的陰影」（近衛隊長 雷歐，全職業共用）各自獨立，可以同時進行。
 * 世界觀分頁的「八職業的現況」與「主要人物的現況」讀這裡的資料（window.AFK_CLASS_SAGA）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.items || typeof TRIAL_Q === 'undefined' || typeof W.trialQAccept !== 'function') { console.warn('[AFK-class-saga] 缺少試煉系統，略過'); return; }
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var IC = function (n) { return 'assets/icons/items/' + n + '.png'; };

  // ── 八條故事線 ──
  // ch：[等級, 章名, 道具 id, 道具名, 圖示, 數量, 地點, [怪物…], 故事, 道具說明]
  var SAGA = {
    royal: { host: 'npc_gunter', hostN: '甘特', town: '說話之島', arc: '王冠的重量',
      now: '亞丁王室最後的血脈。肯恩奪位那夜被忠臣帶出王城，在說話之島由老騎士甘特撫養長大；王子與公主隱姓埋名，召集騎士、妖精、法師組成血盟，誓言奪回亞丁。如今肯恩被逐出王城，但王座仍空著——七城的封臣各懷鬼胎，誰才是真正的王，還沒有定論。',
      end: '你戴上的不是王冠，而是七城的信任。甘特把先王的腰帶交給你：「王的力量不在劍上，在跟隨你的人身上。」',
      belt: { id: 'blt_saga_royal', n: '王者的傳承腰帶', img: 'assets/icons/accessories/光明靈魂腰帶.png', st: { cha: 2, mhp: 60, mmp: 30, mr: 5, ac: 2, extraHit: 1 }, txt: '魅力 +2、最大 HP +60、最大 MP +30、魔防 +5、額外命中 +1' },
      ch: [
        [55, '散落的王印', 'afk_cs_r1', '亞丁王印碎片', '原石碎片', 5, '侏儒部落', ['精銳 侏儒將軍', '精銳 侏儒咒術師'],
          '肯恩奪位那夜，先王把王印敲碎，交給七名忠臣各自帶走。其中一人逃往歐瑞時在侏儒部落遇伏——碎片被侏儒將軍當成戰利品收進了寶庫。把碎片拿回來，那是你的身分證明。', '先王親手敲碎的王印碎片，斷面還留著王室的金紋。'],
        [60, '背誓者', 'afk_cs_r2', '背誓者的封臣戒', '喚獸師戒指', 5, '暗影神殿3樓', ['火焰之影親衛兵(巴風特)', '火焰之影親衛兵(惡魔)'],
          '王印碎片上沾著封臣家族的封蠟。當年七城的封臣裡，有人收了肯恩的金子；他們的子孫為了掩蓋這段過去，把靈魂賣給了炎魔，成了暗影神殿的親衛兵。拿回他們的封臣戒，讓背誓的名字重見天日。', '刻著封臣家徽的戒指，內側被炎魔的火燒得焦黑。'],
        [65, '古王國的守衛', 'afk_cs_r3', '王室守衛的核心', '召喚球之核', 4, '高崙研究所', ['高崙守護者(石頭)', '高崙守護者(黃)'],
          '亞丁建國時，古王國留下一批守護王族的高崙。肯恩的術士把它們搬進研究所改造成叛軍的兵器——但核心深處還記得王族的血。打倒它們、取回核心，讓守衛回到真正的主人手上。', '王室守衛高崙的核心，碰到王族的手會微微發熱。'],
        [70, '王座下的影子', 'afk_cs_r4', '影子議會的名冊', '密封的情報書', 5, '支配者傲慢之塔2樓', ['不幸的思克巴', '不幸的多眼怪'],
          '傲慢之塔裡有一個「影子議會」，替肯恩挑選下一批封臣，名冊就藏在侍奉他們的魔物身上。只要拿到名冊，七城裡誰會在攻城戰背後捅你一刀，就一清二楚。', '用暗語寫成的名冊，列著七城裡願意替肯恩開城門的人。'],
        [75, '艾爾摩的軍旗', 'afk_cs_r5', '艾爾摩軍旗殘片', '封印的歷史書第5頁', 5, '支配者傲慢之塔6樓', ['不死的艾爾摩兵士', '不死的艾爾摩將軍'],
          '肯恩本名阿斯泰，是艾爾摩人。他的私兵是一支早已死去的艾爾摩軍團，被賽尼斯的黑魔法困在傲慢之塔裡永不安息。燒掉他們的軍旗，叛王就少了最後一支忠心的軍隊。', '艾爾摩軍團的軍旗殘片，上面的紋章和肯恩的封蠟一模一樣。'],
        [80, '王者的證明', 'afk_cs_r6', '傲慢之冠的碎片', '昇華支配碎片', 6, '支配者傲慢之塔10樓', ['傲慢的阿斯摩太'],
          '傲慢之塔的頂端，阿斯摩太守著一頂「傲慢之冠」——戴上它的人能讓所有人臣服。肯恩想要它，七城的封臣也想要它。打碎它，讓天下知道：亞丁的王不需要靠詛咒來統治。', '傲慢之冠的碎片。即使碎了，仍在低聲要你跪下。']
      ] },
    knight: { host: 'npc_masha', hostN: '馬沙', town: '威頓村', arc: '誓約之劍',
      now: '亞丁的騎士團在拉斯塔巴德戰役後四散，紅騎士團只剩下零星的老兵。騎士們效忠的不是哪一位王，而是自己立下的誓約；有人投靠王族的血盟，有人在威頓村跟著馬沙重新鍛劍，也有人在黑暗裡成了黑騎士。',
      end: '黑騎士團長倒下前說：「我們立的是同一個誓。」馬沙把他的腰帶交給你：「記住他——那是你差一點成為的樣子。」',
      belt: { id: 'blt_saga_knight', n: '騎士的傳承腰帶', img: 'assets/icons/accessories/重戰士的鏈鎖腰帶.png', st: { str: 2, con: 1, mhp: 100, ac: 3, dr: 1, meleeDmg: 1 }, txt: '力量 +2、體質 +1、最大 HP +100、AC 3、傷害減免 +1、近距離傷害 +1' },
      ch: [
        [55, '褪色的徽記', 'afk_cs_k1', '褪色的騎士團徽', '戰士的印記(泰坦：岩石)', 5, '暗影神殿1樓', ['混沌的司祭(騎兵)', '混沌的司祭(槍兵)'],
          '拉斯塔巴德戰役後，一隊紅騎士團的斥候在暗影神殿失蹤。最近有人看到混沌的司祭騎著馬、胸前別著紅騎士團的徽記——他們被洗腦了。把徽記帶回來，讓馬沙替他們立碑。', '紅騎士團的徽記，紅漆褪成了灰色。'],
        [60, '范德的誓言', 'afk_cs_k2', '范德的誓約書殘頁', '封印的歷史書第2頁', 5, '傲慢之塔91~100樓', ['騎士范德', '艾莉絲'],
          '騎士范德曾是亞丁最強的騎士。為了救回被詛咒的艾莉絲，他向黑暗低頭，把自己的誓約書撕成碎片。找回殘頁，你才會明白騎士的誓言為什麼會被打破。', '范德親筆寫下的誓約，最後一行被血塗掉了。'],
        [65, '熔掉的劍', 'afk_cs_k3', '被熔掉的騎士劍', '磨刀石', 5, '日出之國城墎', ['憤怒的嗚釜'],
          '叛黨把騎士團陣亡者的劍賣到海外，日出之國的嗚釜拿它們熔成了自己的鍋身。騎士的劍不該變成妖怪的鍋子——把還沒熔透的劍身帶回來。', '半熔的劍身，劍格上還刻著主人的名字。'],
        [70, '近衛的墓碑', 'afk_cs_k4', '近衛的名牌', '死亡騎士之書', 5, '支配者傲慢之塔4樓', ['死亡的骷髏近衛兵', '死亡的史巴托'],
          '肯恩奪位那夜戰死的王室近衛，屍骨被運進支配者傲慢之塔，成了不死的近衛兵。他們仍在站崗，守著一個早已不存在的王。取回他們的名牌，讓他們安息。', '王室近衛的銅名牌，背面寫著「至死守護」。'],
        [75, '夢魘騎行', 'afk_cs_k5', '夢魘的韁繩', '格利芬羽毛', 5, '支配者傲慢之塔3樓', ['恐怖的夢魘', '恐怖的地獄犬(支配)'],
          '黑騎士團騎的不是馬，是夢魘。只要搶下牠們的韁繩，黑騎士在戰場上就再也追不上你。', '用黑髮編成的韁繩，握著它會聽見馬蹄聲。'],
        [80, '黑騎士團長', 'afk_cs_k6', '黑騎士團長的徽記', '暗殺軍王徽印', 6, '支配者傲慢之塔8樓', ['黑暗的黑騎士'],
          '黑騎士團的團長曾是紅騎士團的副團長——范德的副手。他和你立過一樣的誓，只是選了另一條路。去面對他吧，這是騎士之間的事。', '黑騎士團長的徽記，裡層還留著紅騎士團的紋章。']
      ] },
    mage: { host: 'npc_taras', hostN: '塔拉斯', town: '象牙塔', arc: '象牙塔的真理',
      now: '象牙塔是魔法的最高學府，也是禁忌知識的倉庫。拉斯塔巴德戰役後，塔裡有一批學者偷偷研究黑魔法，被逐出塔外，成了冥法軍與叛黨的術士；塔拉斯則留在塔裡，想在禁忌之前找到真正的「真理」。',
      end: '「真理不在書上，在你選擇不去用的那些咒文裡。」塔拉斯把賢者的腰帶繫在你身上。',
      belt: { id: 'blt_saga_mage', n: '賢者的傳承腰帶', img: 'assets/icons/accessories/光明精神腰帶.png', st: { int: 2, mmp: 100, mpR: 3, mr: 8, mdmg: 1 }, txt: '智力 +2、最大 MP +100、MP 自然恢復 +3、魔防 +8、魔法傷害 +1' },
      ch: [
        [55, '沙下的咒文', 'afk_cs_m1', '古代咒文石板', '封印的歷史書第1頁', 5, '底比斯 金字塔內部', ['底比斯 阿努斯', '底比斯 阿努斯(黑)'],
          '時空裂痕打開後，被逐出象牙塔的學者第一個去的地方就是底比斯——那裡的咒文比亞丁的歷史還古老。阿努斯守著刻有咒文的石板，先一步拿回來，別讓叛徒讀懂。', '刻滿古代文字的石板，有幾行被人用亞丁語寫了註解。'],
        [60, '司祭的禁書', 'afk_cs_m2', '死亡司祭的禁書頁', '受詛咒的精靈書', 5, '暗影神殿2樓', ['死亡的司祭(巴列斯)', '死亡的司祭(惡魔)'],
          '石板上的註解出自一位象牙塔的老教授——他現在穿著死亡司祭的袍子，在暗影神殿替炎魔召喚惡魔。他的禁書頁記著召喚的方法，必須收回來燒掉。', '用人皮裝訂的禁書頁，字會在你移開視線時偷偷改變。'],
        [65, '被偷走的核心', 'afk_cs_m3', '象牙塔魔法核心', '召喚球碎片', 5, '高崙研究所', ['高崙守護者(紅)', '高崙守護者(藍)'],
          '高崙研究所的守護者用的是象牙塔失竊的魔法核心。偷走它們的人想造一支不會背叛的軍隊——可是核心原本是用來守護學生的。', '刻著象牙塔塔徽的核心，還在重複播放課堂上的咒文。'],
        [70, '歪曲的魔力', 'afk_cs_m4', '歪曲的魔力結晶', '元素石', 5, '支配者傲慢之塔1樓', ['歪曲的梅杜莎', '歪曲的奇美拉'],
          '支配者傲慢之塔的第一層，空間本身就是歪的。叛逃的學者在這裡實驗「把魔力扭轉成詛咒」，梅杜莎與奇美拉就是失敗的作品。拿回結晶，塔拉斯要找出逆轉的方法。', '在掌心裡不停旋轉的結晶，周圍的光線都被拉彎了。'],
        [75, '艾爾摩的咒術師', 'afk_cs_m5', '艾爾摩咒術師的法典', '甘地妖魔魔法書', 5, '支配者傲慢之塔6樓', ['不死的艾爾摩魔法師'],
          '肯恩身邊最可怕的不是軍隊，而是那群死後仍在施法的艾爾摩咒術師——魔女賽尼斯逃離哈汀之後，就是跟著他們學艾爾摩的咒術。收回他們的法典，賽尼斯就失去了第二個老師。', '艾爾摩咒術師的法典，扉頁上有賽尼斯年輕時的簽名。'],
        [80, '傲慢的真理', 'afk_cs_m6', '真理之頁', '封印的歷史書第8頁', 6, '支配者傲慢之塔10樓', ['傲慢的阿西塔基奧', '傲慢的思克巴女皇'],
          '叛逃學者們最後的目標，是傲慢之塔頂端那本「真理之書」：讀完它，就能改寫世界的規則。書已經被撕散，頁子落在塔頂魔物的手裡。在他們拼回去之前，把每一頁都帶回來。', '真理之書的一頁。讀過的人說，上面寫的是「你」。']
      ] },
    elf: { host: 'npc_mother', hostN: '迷幻森林之母', town: '妖精森林', arc: '世界樹的低語',
      now: '妖精是殷海薩誕生的神聖種族，守護著妖精森林與世界樹。哈爾巴斯甦醒後想奪取生命之樹，四大元素也因此躁動；迷幻森林之母察覺世界樹在枯萎，派出能與精靈對話的妖精四處尋找原因。',
      end: '世界樹長出了新芽。迷幻森林之母把精靈編的腰帶交給你：「風會記得你的名字。」',
      belt: { id: 'blt_saga_elf', n: '精靈的傳承腰帶', img: 'assets/icons/accessories/精氣流動的腰帶.png', st: { dex: 2, mhp: 40, mmp: 40, mpR: 2, er: 2, rangedDmg: 1 }, txt: '敏捷 +2、最大 HP／MP +40、MP 自然恢復 +2、遠距離迴避 +2、遠距離傷害 +1' },
      ch: [
        [55, '枯萎的露水', 'afk_cs_e1', '枯竭的生命之露', '水龍鱗', 5, '提卡爾神廟地區深處', ['提卡爾薩德司卡(紫)', '提卡爾薩德司卡(紅)'],
          '世界樹的根喝不到露水了。精靈們說，有人在時空裂痕另一頭的提卡爾神廟，把生命之露截了下來供奉給庫庫爾坎。把枯竭的露水帶回來，迷幻森林之母要看看它是怎麼被抽乾的。', '一滴乾掉的露水，裡面還困著微小的光。'],
        [60, '精靈王的淚', 'afk_cs_e2', '精靈王的淚滴', '品質藍寶石', 4, '傲慢之塔91~100樓', ['土精靈王', '水精靈王', '風精靈王', '火精靈王'],
          '四大精靈王被肯恩的術士用鎖鏈困在傲慢之塔的頂層，被迫替叛黨看守。它們在哭——精靈王的淚滴能讓迷幻森林之母聽見它們想說的話。', '精靈王的淚滴，靠近耳邊能聽見遙遠的元素在呼喊。'],
        [65, '渡海的種子', 'afk_cs_e3', '被奪走的世界樹種子', '光明的鱗片', 5, '日出之國東之地', ['河童', '鎌鼬長兄'],
          '精靈王說：世界樹的種子被偷運到海的另一邊。日出之國的河童與鎌鼬把它們當成寶物藏在河底與風裡。種子一旦在異國發芽，世界樹就會分出另一個不認得殷海薩的分身。', '還沒發芽的世界樹種子，在手心裡輕輕跳動。'],
        [70, '歪曲的森林', 'afk_cs_e4', '歪曲的樹皮', '格利芬羽毛', 5, '支配者傲慢之塔1樓', ['歪曲的楊果里恩', '歪曲的亞力安'],
          '其中一顆種子被帶進了支配者傲慢之塔，長成一片歪曲的森林。住在裡面的楊果里恩和亞力安都被樹的痛苦感染了。剝下歪曲的樹皮，讓迷幻森林之母找出解藥。', '扭曲的樹皮，年輪是倒著長的。'],
        [75, '被污染的獸魂', 'afk_cs_e5', '被污染的獸魂', '墮落之牙', 5, '支配者傲慢之塔7樓', ['殘忍的萊肯', '殘忍的冰原老虎'],
          '歪曲的森林在吸走森林裡野獸的靈魂，萊肯與冰原老虎都變得殘忍。把被污染的獸魂帶回妖精森林，讓世界樹替它們淨化。', '在小瓶裡打轉的獸魂，眼睛還是紅的。'],
        [80, '風之古樹', 'afk_cs_e6', '風之古樹的種子', '林德拜爾之鱗', 6, '風龍棲息地', ['泥龍(風)', '毒殺人蜂'],
          '最後一顆種子落在風龍棲息地，長成了「風之古樹」，林德拜爾的眷屬正用它的力量呼喚風暴。拿回古樹結出的種子——這是世界樹最後一個流落在外的孩子。', '風之古樹的種子，握著它會聞到雨的味道。']
      ] },
    dark: { host: 'npc_brudica', hostN: '布魯迪卡', town: '沉默洞穴', arc: '沉默的刀鋒',
      now: '黑暗妖精背離殷海薩追隨格蘭肯，以拉斯塔巴德為都。冥皇丹特斯被肯恩蠱惑、拿族人的靈魂獻祭吉爾塔斯之後，族人分裂成兩派：一派仍效忠化為死亡騎士的丹特斯，一派躲進沉默洞穴，跟著布魯迪卡用刀鋒替族人討回公道。',
      end: '冥皇的密令全被你燒掉了。布魯迪卡沉默了很久，才把影刃的腰帶遞給你：「刀鋒是用來保護族人的，不是用來獻祭的。」',
      belt: { id: 'blt_saga_dark', n: '影刃的傳承腰帶', img: 'assets/icons/accessories/黑暗腰帶.png', st: { dex: 2, str: 1, mhp: 60, ac: 2, extraDmg: 1, extraHit: 1 }, txt: '敏捷 +2、力量 +1、最大 HP +60、AC 2、額外傷害 +1、額外命中 +1' },
      ch: [
        [55, '司祭的耳語', 'afk_cs_d1', '混沌司祭的耳語石', '三級黑魔石', 5, '暗影神殿2樓', ['死亡的司祭(思克巴)', '死亡的司祭(小惡魔)'],
          '暗影神殿的司祭裡，有一半曾經是拉斯塔巴德的黑暗妖精。他們身上帶著耳語石，用來接收冥皇的命令。拿回耳語石，我們就能聽到丹特斯在說什麼。', '冰冷的黑石，貼在耳邊會聽到某人的低語。'],
        [60, '炎魔的親衛', 'afk_cs_d2', '親衛兵的黑紋章', '火焰之影肋骨', 5, '暗影神殿3樓', ['火焰之影親衛兵(槍兵)', '火焰之影親衛兵(思克巴)'],
          '耳語石說：冥皇把一批族人賣給炎魔當親衛兵，換取火焰之影的庇護。他們胸口烙著黑紋章——割下來，那是他們被賣掉的證據。', '烙進皮肉的黑紋章，上面同時有冥皇與炎魔的印記。'],
        [65, '斷首者的紙符', 'afk_cs_d3', '斷首者的紙符', '傲慢之塔傳送符(61F)', 5, '日出之國城墎', ['轆轤首', '唐傘小僧'],
          '冥皇的密使渡海去了日出之國，請那裡的妖怪替他暗殺亞丁的血盟盟主。轆轤首和唐傘小僧身上貼著寫有目標名字的紙符——把名單拿回來，提醒那些人。', '寫著亞丁血盟盟主名字的紙符，有幾個名字已經被劃掉了。'],
        [70, '天狗的刀', 'afk_cs_d4', '天狗的短刀', '墮落鐮刀', 5, '日出之國西之地', ['天狗', '鵺'],
          '接下暗殺委託的是日出之國的天狗。他們的刀快得連黑暗妖精都看不清——奪下他們的刀，看看是誰教他們用拉斯塔巴德的刀法。', '天狗的短刀，刀柄纏的是拉斯塔巴德的黑布。'],
        [75, '地獄的灰燼', 'afk_cs_d5', '地獄靈魂的灰燼', '火焰之影骨翼', 5, '支配者傲慢之塔5樓', ['地獄的靈魂', '地獄的靈魂(大型)'],
          '被獻祭給吉爾塔斯的族人靈魂，並沒有消失——它們被丹特斯帶進支配者傲慢之塔，困成地獄的靈魂。收回它們的灰燼，布魯迪卡要替族人辦一場遲來的葬禮。', '溫熱的灰燼，裡面偶爾閃過一張熟悉的臉。'],
        [80, '冥皇的密令', 'afk_cs_d6', '冥皇的密令', '丹特斯的召書', 6, '支配者傲慢之塔8樓', ['黑暗的思克巴女皇', '黑暗的火焰戰士'],
          '丹特斯的最後一道密令：召集所有仍效忠他的族人，在亞丁攻城戰那天從地底打開城門。密令在支配者傲慢之塔的魔物手上傳遞——在它送到之前，全部截下來。', '用冥皇的血封印的密令，打開會聞到死亡的味道。']
      ] },
    illusion: { host: 'npc_shenien', hostN: '希蓮恩', town: '希培利亞村莊', arc: '裂痕的歸鄉',
      now: '幻術士的祖先是追隨席琳、離開魔界的魔族，躲在時空裂痕裡生活。吉爾塔斯撕開裂痕之後，他們的浮空島出現在亞丁上空，族人在希培利亞落腳。如今席琳在虛空中甦醒，幻術士們不知道該回應祖先的女神，還是守住新的家園。',
      end: '浮空島的錨石全數歸位。希蓮恩笑著說：「我們回不去了——這裡就是故鄉。」她把幻夢的腰帶交給你。',
      belt: { id: 'blt_saga_illusion', n: '幻夢的傳承腰帶', img: 'assets/icons/accessories/靈魂腰帶.png', st: { int: 1, wis: 1, mmp: 80, mr: 5, mdmg: 1, magicHit: 1 }, txt: '智力 +1、精神 +1、最大 MP +80、魔防 +5、魔法傷害 +1、魔法命中 +1' },
      ch: [
        [55, '時間的砂', 'afk_cs_i1', '時空之砂', '時空裂痕碎片', 5, '底比斯 金字塔內部', ['底比斯 巴斯', '底比斯 巴斯(紅)'],
          '浮空島開始下沉了。支撐它的時間之力來自裂痕另一頭的底比斯，可是有人在金字塔裡把時空之砂截走了。巴斯守著那些砂，把它們帶回來。', '在指縫間倒流的砂，落下去之前會先回到你手上。'],
        [60, '破碎的幻象鏡', 'afk_cs_i2', '破碎的幻象鏡', '品質鑽石', 5, '修練地監4樓', ['漆黑的食人妖精王', '漆黑的地獄犬'],
          '截走時空之砂的，是一個用幻術偽裝成族人的叛徒。他把族裡的幻象鏡打碎，藏進修練地監餵給漆黑的魔物。把碎片找回來，鏡子會照出他的真面目。', '幻象鏡的碎片，照出來的永遠不是你。'],
        [65, '妖怪的幻燈', 'afk_cs_i3', '妖怪的幻燈', '畢克斯的羽毛', 5, '日出之國城墎', ['嗚釜', '鎌鼬'],
          '鏡子照出來的叛徒，正在日出之國向妖怪學習「幻燈」——一種能把夢變成真的妖術。妖怪們提著的燈，就是他的教材。', '妖怪提著的紙燈，燈影裡會走出小小的人。'],
        [70, '魔族的同胞', 'afk_cs_i4', '被改造的魔族之血', '炎魔之心', 5, '魔族實驗室2樓', ['變異海星', '變異觸鬚人'],
          '叛徒的真正雇主是魔族實驗室。那些變異魔物體內流著和幻術士一樣的血——他們是沒能逃進裂痕的同胞，被抓去做實驗。取回他們的血，希蓮恩要替他們找到回家的路。', '一小瓶紫色的血，和你的血放在一起會互相呼應。'],
        [75, '阿葛妮的幻夢', 'afk_cs_i5', '阿葛妮的幻夢', '冰之女王之心', 5, '支配者傲慢之塔3樓', ['恐怖的阿葛妮', '恐怖的伊弗利特(支配)'],
          '實驗室的主人是夢的魔物阿葛妮。她把被抓去的同胞困在幻夢裡，替席琳織出一場給全亞丁的夢。打碎她的幻夢，讓那些人醒過來。', '阿葛妮的幻夢碎片，看著它就會想睡。'],
        [80, '浮空島的錨石', 'afk_cs_i6', '浮空島的錨石', '四級黑魔石', 6, '支配者傲慢之塔9樓', ['不滅的骷髏弓箭手', '不滅的骷髏戰士'],
          '浮空島的六顆錨石被叛徒拆走，藏在支配者傲慢之塔守衛森嚴的樓層。只要錨石歸位，浮空島就不會再被時空裂痕拉回去——族人終於可以選擇自己的故鄉。', '浮空島的錨石，離開島太久會慢慢浮起來。']
      ] },
    warrior: { host: 'npc_duwen', hostN: '多文', town: '海音', arc: '斧與血',
      now: '戰士是不靠神祇、不靠魔法，只靠一把斧頭與自己的血肉戰鬥的人。他們大多出身海音一帶的傭兵與水手，跟著老戰士多文守著海岸線——因為水龍法利昂甦醒之後，海音是第一個會被淹沒的城市。',
      end: '利維坦的鱗堆在多文面前，他大笑著把狂戰的腰帶丟給你：「海還在，城也還在。下一次，換法利昂本人。」',
      belt: { id: 'blt_saga_warrior', n: '狂戰的傳承腰帶', img: 'assets/icons/accessories/掠奪者的染血腰帶.png', st: { str: 2, con: 1, mhp: 150, hpR: 3, meleeDmg: 1 }, txt: '力量 +2、體質 +1、最大 HP +150、HP 自然恢復 +3、近距離傷害 +1' },
      ch: [
        [55, '冰原的戰吼', 'afk_cs_w1', '凍結的戰吼', '冰之女王之心', 5, '冰之女王的宮殿', ['冷冽的 冰人', '冷冽的 冰石高崙'],
          '北方的老戰士說，冰之女王的宮殿裡凍著一聲上古戰士的戰吼——聽過它的人，再也不會害怕。冰人和冰石高崙把它鎖在身體裡。敲碎牠們，把戰吼帶回海音。', '一塊冰，裡面封著一聲吼叫，靠近會震得手發麻。'],
        [60, '大地之怒', 'afk_cs_w2', '大地之怒', '原石碎片', 5, '地之領域', ['土之守護者'],
          '戰吼喚醒了你體內的血，但還不夠——你需要大地的重量。慾望洞穴的地之領域裡，土之守護者被黑魔法激怒了。把牠們的怒氣變成你的。', '一塊不斷發熱的石頭，拿著它腳下會穩得像生了根。'],
        [65, '鬼的獠牙', 'afk_cs_w3', '鬼的獠牙', '安塔瑞斯之牙', 5, '日出之國西之地', ['赤鬼', '青鬼'],
          '多文年輕時在日出之國跟赤鬼、青鬼打過一場。他說，鬼的獠牙是世上最硬的東西——海音的城牆缺一批能擋住海嘯的釘樁。', '粗得像手臂的獠牙，敲起來像在敲鐵。'],
        [70, '阿修羅的碎臂', 'afk_cs_w4', '阿修羅的碎臂', '安塔瑞斯之骨', 5, '日出之國北之地', ['阿修羅像', '天狗'],
          '鬼們說，牠們的力量來自北之地的阿修羅像——一尊有六條手臂、永不停止戰鬥的神像。打碎它的手臂，戰士才配得上被稱作「不會停下的人」。', '石像的斷臂，指節還在慢慢握緊。'],
        [75, '烈炎之心', 'afk_cs_w5', '烈炎之心', '巴拉卡斯之心', 5, '支配者傲慢之塔7樓', ['殘忍的烈炎獸', '殘忍的阿西塔基奧'],
          '要對抗法利昂的海水，你需要火。支配者傲慢之塔的烈炎獸和阿西塔基奧，心臟燒得比熔爐還旺。挖出來，多文要拿它們鍛一把不怕水的斧頭。', '還在跳動的火紅心臟，周圍的空氣都在扭曲。'],
        [80, '利維坦的鱗', 'afk_cs_w6', '利維坦的鱗', '法利昂之鱗', 6, '支配者傲慢之塔10樓', ['傲慢的利維坦'],
          '法利昂的先鋒已經上岸了——傲慢之塔頂端的利維坦，是水龍放在陸地上的眼睛。剝下牠的鱗，讓法利昂知道：海音有一群不會退的人。', '比盾牌還大的鱗片，帶著深海的冰冷。']
      ] },
    dragon: { host: 'npc_procel', hostN: '普洛凱爾', town: '貝希摩斯', arc: '龍之血誓',
      now: '龍騎士是光龍奧拉奇里亞的龍人族後裔，受席琳之託守護生命之樹，住在古老巨獸貝希摩斯的背上。闇龍哈爾巴斯甦醒、想奪走生命之樹，龍騎士們夾在「守護」與「血脈」之間——他們身上流著的龍血，正是哈爾巴斯想喚醒的東西。',
      end: '闇龍的契約骨片全數粉碎。普洛凱爾在奧拉奇里亞的雕像前替你繫上龍血的腰帶：「你的血屬於你自己，不屬於任何一條龍。」',
      belt: { id: 'blt_saga_dragon', n: '龍血的傳承腰帶', img: 'assets/icons/accessories/火焰環繞的腰帶.png', st: { str: 1, con: 1, int: 1, mhp: 100, mr: 5, resFire: 5, resWater: 5, resWind: 5, resEarth: 5 }, txt: '力量／體質／智力 +1、最大 HP +100、魔防 +5、四屬性抗性 +5' },
      ch: [
        [55, '被吸走的龍血', 'afk_cs_g1', '被吸走的龍血', '巴拉卡斯之血', 5, '傲慢之塔81~90樓', ['馬昆斯吸血鬼', '恐怖的殭屍王'],
          '幾名年輕的龍騎士在傲慢之塔失蹤，找到時身上的龍血已經被吸乾。馬昆斯吸血鬼把龍血當成美酒收藏——把它們拿回來，普洛凱爾要知道是誰在收購龍血。', '一小瓶金紅色的血，搖晃時會發出低沉的龍吟。'],
        [60, '幼龍的逆鱗', 'afk_cs_g2', '幼龍的逆鱗', '火龍鱗', 5, '慾望洞穴（水／火／風之領域）', ['小狄高', '小安加斯', '小巴薩斯'],
          '收購龍血的人在慾望洞穴養了三條元素幼龍，用龍騎士的血餵大牠們。幼龍的逆鱗會記住餵養者的氣味——拿回來，我們就能追到他。', '幼龍喉下的逆鱗，上面沾著龍騎士的血。'],
        [65, '鵺的雷羽', 'afk_cs_g3', '鵺的雷羽', '畢克斯的羽毛', 5, '日出之國西之地', ['鵺'],
          '逆鱗上的氣味一路通往日出之國。那裡的鵺是一種混了龍血的妖怪——有人在海的另一邊大量製造半龍。拔下牠們的雷羽，證明這件事。', '帶著電光的羽毛，一碰就麻。'],
        [70, '被改造的龍族之血', 'afk_cs_g4', '被改造的龍族之血', '安塔瑞斯之血', 5, '魔族實驗室2樓', ['變異蜥蜴'],
          '造半龍的地方就是魔族實驗室。變異蜥蜴體內流著被改造過的龍族之血——那是從你的族人身上抽出來的。', '混濁的血，裡面有一片小小的龍鱗在游動。'],
        [75, '墮落龍的心核', 'afk_cs_g5', '墮落龍的心核', '安塔瑞斯之心', 5, '支配者傲慢之塔5樓', ['地獄的幼龍', '地獄的骨龍'],
          '實驗的成果被送進支配者傲慢之塔，在地獄的火裡孵成了墮落的龍。牠們只聽一個聲音——哈爾巴斯。挖出牠們的心核，別讓闇龍多一支軍隊。', '漆黑的心核，裡面有一隻眼睛在看你。'],
        [80, '闇龍的契約', 'afk_cs_g6', '闇龍的契約骨片', '林德拜爾之骨', 6, '支配者傲慢之塔9樓', ['不滅的骷髏騎士', '不滅的骷髏近衛兵'],
          '幕後的人終於現身：他和哈爾巴斯立下契約，用龍騎士的血換取不死。他的骷髏騎士團身上嵌著契約的骨片——全部打碎，契約就不成立。', '刻著闇龍文字的骨片，碎掉時會發出一聲嘆息。']
      ] }
  };
  var ORDER = ['royal', 'knight', 'mage', 'elf', 'dark', 'illusion', 'warrior', 'dragon'];
  var CLS_N = { royal: '王族', knight: '騎士', mage: '法師', elf: '妖精', dark: '黑暗妖精', illusion: '幻術士', warrior: '戰士', dragon: '龍騎士' };

  // ── 主要人物的現況（世界觀分頁用）──
  var FIGURES = [
    ['死亡女神 席琳', '被殷海薩放逐、封印在虛空中的水之女神。如今她正在甦醒：怒意滲進現世成了「瘋狂席琳」，她的夢成了「席琳夢域鏡」，本尊沉在死亡之海的神殿深處。'],
    ['闇龍 哈爾巴斯', '失去生命靈魂、流落魔界的六龍之一。已經甦醒，想奪取生命之樹讓自己復活，並喚醒其他四龍替母親復仇；暗中和人立下契約，用龍騎士的血換取不死。'],
    ['四龍（安塔瑞斯、法利昂、巴拉卡斯、林德拜爾）', '被哈爾巴斯喚醒，在各自的巢穴中保有母親的再生之力。法利昂的先鋒已經上岸，林德拜爾的眷屬替叛黨送信。'],
    ['光龍 奧拉奇里亞', '化成人形隱居在燃柳村，看過無數次輪迴，只把失落的技藝傳給重生的人；她的龍人族後裔就是龍騎士。'],
    ['反王 肯恩（阿斯泰）', '艾爾摩人，曾奪下亞丁王座，如今被逐出王城。他退守傲慢之塔，又潛回亞丁城地底的密室，與賽尼斯、丹特斯結盟圖謀復辟；私兵是一支不死的艾爾摩軍團。'],
    ['魔女 賽尼斯', '肯恩的盟友，水之精靈；原是大魔法師哈汀沒有正式拜師的弟子，說話之島事件裡被哈汀當成封印巴風特的活祭品，倖存後成為魔女。用黑魔法污染元素守護者、拿魔族實驗室的變異核心換取黃金與傭兵，是叛黨的軍需官。'],
    ['冥皇 丹特斯', '拉斯塔巴德的黑暗妖精之王。受肯恩蠱惑、拿族人的靈魂獻祭吉爾塔斯，自己依契約化為死亡騎士；仍在暗中召集效忠他的族人。'],
    ['異界的統治者 吉爾塔斯', '穿過混沌之塔降臨的異界魔王，降臨時撕開了時空裂痕。'],
    ['騎士 范德與艾莉絲', '范德曾是亞丁最強的騎士，為了救被詛咒的艾莉絲向黑暗低頭；兩人如今都困在傲慢之塔的高層。'],
    ['近衛隊長 雷歐', '亞丁王室近衛的隊長，在亞丁城追查肯恩復辟的陰謀，發派「亞丁的陰影」任務。'],
    ['告密者 伊菈', '亞丁的告密者，自稱曾是魔女賽尼斯的侍女，知道肯恩密室（謀叛者的低語）的入口。'],
    ['古物學者 塞勒斯', '奇岩的古物學者，收集從怪物身上掉下的雜項素材，從中拼湊被遺忘的歷史。']
  ];

  // ── 道具、腰帶、試煉登錄 ──
  var CH = [];   // 平面清單：{cls, i, lv, title, item, need, map, mobs, story, key}
  ORDER.forEach(function (cls) {
    var s = SAGA[cls];
    s.ch.forEach(function (c, i) {
      var q = { cls: cls, i: i, lv: c[0], title: c[1], item: c[2], itemN: c[3], icon: c[4], need: c[5], map: c[6], mobs: c[7], story: c[8], key: 'saga' + c[0] + '_' + cls };
      CH.push(q);
      if (!DB.items[q.item]) DB.items[q.item] = { n: q.itemN, type: 'etc', p: 0, c: 'text-amber-300', img: IC(q.icon), noUse: true, noSell: true, gachaWeight: 0, questItem: true, d: c[9] + '（' + CLS_N[cls] + '專屬劇情「' + s.arc + '」第 ' + (i + 1) + ' 章任務道具）' };
      var rw = i === 5 ? [s.belt.id] : [];
      if (!TRIAL_Q[q.key]) TRIAL_Q[q.key] = { cls: cls, lv: q.lv, npc: s.hostN, reqs: [[q.item, q.need]], rewards: rw, afkSaga: 1 };
      try { var L = (TRIAL_ITEM_Q[q.item] = TRIAL_ITEM_Q[q.item] || []); if (L.indexOf(q.key) < 0) L.push(q.key); } catch (e) {}
      try { if (typeof TRIAL_ITEM_CLASS !== 'undefined') TRIAL_ITEM_CLASS[q.item] = [cls]; } catch (e) {}
      try { if (typeof WH_NO_STORE !== 'undefined' && WH_NO_STORE.indexOf(q.item) < 0) WH_NO_STORE.push(q.item); } catch (e) {}
      try { if (typeof MOB_DROPS !== 'undefined') q.mobs.forEach(function (mn) { MOB_DROPS[mn] = MOB_DROPS[mn] || []; if (!MOB_DROPS[mn].some(function (x) { return x[0] === q.item; })) MOB_DROPS[mn].push([q.item, 1]); }); } catch (e) {}
    });
    var b = s.belt;
    if (!DB.items[b.id]) DB.items[b.id] = Object.assign({ n: b.n, type: 'acc', slot: 'belt', req: cls, safe: 0, p: 100000, gachaWeight: 0, legend: true, ac: 0, img: b.img, noTrade: true,
      d: CLS_N[cls] + '專屬劇情「' + s.arc + '」的最終獎勵。' + b.txt + '。' }, b.st);
  });
  var byKey = {}; CH.forEach(function (q) { byKey[q.key] = q; });
  var sagaOf = function (key) { return byKey[String(key || '')] || null; };
  var chOf = function (cls) { return CH.filter(function (q) { return q.cls === cls; }); };
  var stOf = function (p, q) { return (typeof trialQStateFor === 'function' ? trialQStateFor(p, q.key) : ((p.trialQ || {})[q.key] || 0)); };
  var prevDone = function (p, q) { return q.i === 0 || stOf(p, chOf(q.cls)[q.i - 1]) === 2; };
  var expOf = function (q) { try { var r = getExpReq(q.lv); return isFinite(r) ? Math.floor(r * 0.15) : 0; } catch (e) { return 0; } };
  var scrollsOf = function (q) { return q.i === 5 ? [['scroll_weapon_b', 2], ['scroll_armor_b', 2]] : (q.i % 2 === 0 ? [['scroll_armor_b', 1]] : [['scroll_weapon_b', 1]]); };

  // 掉落閘：只有接取中、未集滿才掉（不吃試煉批次兌換的「持續掉落」；本線每章只做一次）
  // （試煉批次兌換 afk-retrial 在 DOMContentLoaded 才包 trialItemActive，這裡排在它之後包，才會是最外層）
  var installGate = function () {
    if (typeof W.trialItemActive !== 'function' || W.trialItemActive.__afkSaga) return;
    var oAct = W.trialItemActive;
    W.trialItemActive = function (id) {
      var ks = (typeof TRIAL_ITEM_Q !== 'undefined' && TRIAL_ITEM_Q[id]) || [];
      var mine = ks.filter(function (k) { return byKey[k]; });
      if (mine.length && mine.length === ks.length) {
        var p = P(); if (!p) return false;
        return mine.some(function (k) { var q = byKey[k]; return p.cls === q.cls && stOf(p, q) === 1 && (typeof questCountId === 'function' ? questCountId(id) : 0) < q.need; });
      }
      return oAct.apply(this, arguments);
    };
    W.trialItemActive.__afkSaga = true;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installGate); else installGate();
  // 接取：要先完成前一章
  var oAcc = W.trialQAccept;
  W.trialQAccept = function (key) {
    var q = sagaOf(key), p = P();
    if (q && p && !prevDone(p, q)) { sys('<span class="text-amber-300">' + esc(SAGA[q.cls].hostN) + '：先把「' + esc(chOf(q.cls)[q.i - 1].title) + '」的事辦完。</span>'); return; }
    return oAcc.apply(this, arguments);
  };
  // 交付：第一次完成另給經驗與祝福卷軸
  if (typeof W.trialQComplete === 'function') {
    var oDone = W.trialQComplete;
    W.trialQComplete = function (key) {
      var q = sagaOf(key), p = P(), before = q && p ? stOf(p, q) : 0;
      var r = oDone.apply(this, arguments);
      try {
        if (q && p && before === 1 && stOf(p, q) === 2) {
          var xp = expOf(q), sc = scrollsOf(q);
          if (xp > 0) { p.exp = (p.exp || 0) + xp; if (typeof checkLvUp === 'function') checkLvUp(); }
          sc.forEach(function (x) { gainItem(x[0], x[1], true, true); });
          sys('<span class="text-amber-200">' + esc(SAGA[q.cls].hostN) + '：「' + esc(q.title) + '」完成。另外獲得 ' + (xp > 0 ? '經驗 ' + xp.toLocaleString() + '、' : '') + sc.map(function (x) { return DB.items[x[0]].n + ' ×' + x[1]; }).join('、') + '。</span>');
          if (q.i === 5) sys('<span class="c-legend font-bold">「' + esc(SAGA[q.cls].arc) + '」完結。</span><span class="text-amber-200">' + esc(SAGA[q.cls].end) + '</span>');
          if (typeof updateUI === 'function') updateUI();
          saveGame();
        }
      } catch (e) {}
      return r;
    };
  }

  // ── 導師對話：在原本的試煉畫面下面接上第二部 ──
  //   介面（玩家 2026-11-01）：貼近原本製作／試煉面板（深色卡片、圖示框、需求數量綠／紅）、劇情文字用標楷體並放大；只改呈現，判斷與按鈕不變。
  var lastArgs = null;
  var KAI = '"DFKai-SB","BiauKai","標楷體","Kaiti TC","STKaiti","KaiTi","TW-Kai","AR PL UKai TW",serif';
  var ensureCss = function () {
    if (document.getElementById('afk-saga-css')) return;
    var st = document.createElement('style'); st.id = 'afk-saga-css';
    st.textContent = [
      '.asg{margin-top:12px;padding:12px 12px 4px;border:1px solid #6b4e36;border-radius:6px;background-image:linear-gradient(180deg,rgba(74,54,40,.45),rgba(40,39,48,0) 120px);box-shadow:inset 0 1px rgba(222,176,112,.12)}',
      '.asg-head{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;padding:0 2px 9px;margin-bottom:10px;border-bottom:1px solid #594638}',
      '.asg-title{font-family:' + KAI + ';font-size:23px;font-weight:bold;line-height:1.3;color:#e7d2a7;letter-spacing:.06em;text-shadow:1px 1px 0 #000,0 0 6px rgba(177,132,84,.35)}',
      '.asg-tsub{font-size:13px;font-weight:bold;color:#a8998a;white-space:nowrap}',
      '.asg-sum{margin-left:auto;font-size:13px;font-weight:bold;color:#cdb991;padding:2px 10px;border:1px solid #6e5845;border-radius:999px;background:#1d1b20;white-space:nowrap}',
      '.asg-intro{font-family:' + KAI + ';font-size:17px;line-height:1.8;color:#dcd0bb;padding:8px 12px;margin-bottom:10px;border-left:3px solid #8d6846;border-radius:0 4px 4px 0;background:rgba(0,0,0,.2)}',
      '.asg-ch{margin-bottom:10px;padding:12px 14px;border:1px solid #514138;border-radius:6px;background-image:linear-gradient(180deg,#2e2c35,#222027);box-shadow:inset 3px 0 0 var(--asg-acc,#8d6846),inset 0 1px rgba(222,176,112,.06)}',
      '.asg-ch.s-done{--asg-acc:#3f8a5f}.asg-ch.s-ready{--asg-acc:#34d399;border-color:#2f6b4a}.asg-ch.s-active{--asg-acc:#d4943f}.asg-ch.s-lock{--asg-acc:#4b4540}.asg-ch.s-lv{--asg-acc:#9b2c2c}',
      '.asg-ch.s-lock .asg-cht{color:#a59a8c}.asg-ch.s-lock .asg-story{color:#b3a999}',
      '.asg-chh{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px}',
      '.asg-no{font-size:12.5px;font-weight:bold;color:#e7d2a7;padding:1px 8px;border:1px solid #8d6846;border-radius:3px;background:linear-gradient(180deg,#3a2e27,#211d20);white-space:nowrap}',
      '.asg-cht{font-family:' + KAI + ';font-size:21px;font-weight:bold;line-height:1.35;color:#f1d9a6;text-shadow:1px 1px 0 #000}',
      '.asg-lv{font-size:13px;font-weight:bold;color:#a8998a;white-space:nowrap}',
      '.asg-badge{margin-left:auto;font-size:13px;font-weight:bold;padding:2px 10px;border:1px solid;border-radius:999px;white-space:nowrap}',
      '.asg-badge.s-done{color:#7ee2a8;border-color:#2f6b4a;background:rgba(16,64,40,.5)}',
      '.asg-badge.s-ready{color:#bbf7d0;border-color:#34d399;background:rgba(6,95,70,.55);box-shadow:0 0 8px rgba(52,211,153,.35)}',
      '.asg-badge.s-active{color:#fcd38a;border-color:#a8742f;background:rgba(120,72,20,.4)}',
      '.asg-badge.s-new{color:#e7d2a7;border-color:#8d6846;background:rgba(80,58,40,.4)}',
      '.asg-badge.s-lock{color:#9c958c;border-color:#4b4540;background:rgba(30,29,33,.7)}',
      '.asg-badge.s-lv{color:#fca5a5;border-color:#7f1d1d;background:rgba(80,20,20,.4)}',
      '.asg-story{font-family:' + KAI + ';font-size:17px;line-height:1.85;color:#ddd3c3;margin:8px 0 8px}',
      '.asg-meta{font-size:13.5px;line-height:1.6;color:#a8998a;margin-bottom:4px}',
      '.asg-meta b{color:#cdb991;font-weight:bold}',
      '.asg-row{display:flex;align-items:flex-start;gap:8px;margin-top:8px}',
      '.asg-lab{flex:0 0 auto;font-size:14px;color:#a8998a;line-height:40px;white-space:nowrap}',
      '.asg-items{display:flex;flex-wrap:wrap;gap:6px 16px;min-width:0}',
      '.asg-it{display:flex;align-items:center;gap:8px;min-width:0}',
      '.asg-ic{width:40px;height:40px;flex:0 0 40px;display:flex;align-items:center;justify-content:center;background:#17161a;border:1px solid #6e5845;border-radius:4px;box-shadow:inset 0 0 0 1px #0d0c0f}',
      '.asg-ic img{width:34px;height:34px;object-fit:contain;pointer-events:none}',
      '.asg-ic.exp{font-size:12px;font-weight:900;color:#facc15;letter-spacing:.02em;text-shadow:1px 1px 0 #000}',
      '.asg-itx{display:flex;flex-direction:column;min-width:0;line-height:1.3}',
      '.asg-in{font-size:15px;font-weight:bold}',
      '.asg-cnt{font-size:13.5px;font-weight:bold;color:#cfc6b8}',
      '.asg-cnt .ok{color:#4ade80}.asg-cnt .no{color:#f87171}',
      '.asg-sub{font-size:12px;color:#8f877d;font-weight:normal}',
      '.asg-act{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-top:12px;padding-top:10px;border-top:1px dashed #4a3c32}',
      '.asg-act .btn{font-size:15px}',
      '.asg-act .btn:disabled{opacity:.45;cursor:not-allowed}',
      '.asg-note{font-size:13.5px;line-height:1.6;color:#8f877d}',
      '.asg-warn{font-size:13.5px;line-height:1.6;color:#f87171}',
      '.asg-more{margin-top:6px}',
      '.asg-more>summary{cursor:pointer;list-style:none;display:inline-block;font-size:13px;color:#a8998a;padding:1px 0;user-select:none}',
      '.asg-more>summary::-webkit-details-marker{display:none}',
      '.asg-more>summary::before{content:"▸ ";color:#8d6846}.asg-more[open]>summary::before{content:"▾ "}',
      '.asg-more>summary:hover{color:#e7d2a7}',
      '.asg-outro{font-family:' + KAI + ';font-size:17px;line-height:1.85;color:#f0c4f5;padding:10px 12px;margin-bottom:10px;border:1px solid #6b3f6e;border-radius:6px;background:rgba(60,24,64,.25)}',
      '@media (max-width:640px){.asg{padding:10px 8px 2px}.asg-title{font-size:21px}.asg-ch{padding:10px 10px}.asg-cht{font-size:19px}.asg-story,.asg-intro,.asg-outro{font-size:16px;line-height:1.75}.asg-ic{width:36px;height:36px;flex-basis:36px}.asg-ic img{width:30px;height:30px}.asg-lab{line-height:36px}.asg-items{gap:6px 12px}.asg-badge{margin-left:0}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  };
  var iconOf = function (id, d) { d = d || DB.items[id]; if (!d) return ''; try { return typeof getIconUrl === 'function' ? getIconUrl(d) : (d.img || ''); } catch (e) { return d.img || ''; } };
  var colorOf = function (id) { try { return typeof getItemColor === 'function' ? getItemColor({ id: id }) : 'text-sky-300'; } catch (e) { return 'text-sky-300'; } };
  var chip = function (id, name, cls, cnt, sub) {
    var known = !!DB.items[id];
    return '<div class="asg-it"><div class="asg-ic' + (id === 'exp' ? ' exp">EXP' : (known ? ' tip-host" data-tip-id="' + esc(id) + '">' : '">') + (iconOf(id) ? '<img src="' + esc(iconOf(id)) + '" onerror="this.style.display=\'none\'" alt="">' : '')) + '</div>'
      + '<div class="asg-itx"><span class="asg-in ' + cls + '">' + esc(name) + '</span>' + (cnt ? '<span class="asg-cnt">' + cnt + '</span>' : '') + (sub ? '<span class="asg-sub">' + esc(sub) + '</span>' : '') + '</div></div>';
  };
  var row = function (lab, inner) { return inner ? '<div class="asg-row"><span class="asg-lab">' + lab + '</span><div class="asg-items">' + inner + '</div></div>' : ''; };
  var STN = { done: '已完成', ready: '可交付', active: '進行中', 'new': '未接取', lock: '未解鎖', lv: '等級不足' };
  function sectionHTML(p) {
    var s = SAGA[p.cls]; if (!s) return '';
    ensureCss();
    var chs = chOf(p.cls), done = chs.filter(function (q) { return stOf(p, q) === 2; }).length;
    var h = '<div class="asg"><div class="asg-head"><span class="asg-title">📜 第二部・' + esc(s.arc) + '</span><span class="asg-tsub">（55～80 級專屬劇情）</span><span class="asg-sum">已完成 ' + done + '／' + chs.length + ' 章</span></div>'
      + '<div class="asg-intro">' + esc(s.now) + '</div>';
    chs.forEach(function (q) {
      var st = stOf(p, q), have = typeof questCountId === 'function' ? questCountId(q.item) : 0;
      var k = st === 2 ? 'done' : !prevDone(p, q) ? 'lock' : (p.lv || 1) < q.lv ? 'lv' : st === 0 ? 'new' : have >= q.need ? 'ready' : 'active';
      var rw = chip('exp', '經驗', 'text-yellow-300', expOf(q).toLocaleString())
        + scrollsOf(q).map(function (x) { return chip(x[0], (DB.items[x[0]] || {}).n, colorOf(x[0]), '×' + x[1]); }).join('')
        + (q.i === 5 ? chip(s.belt.id, s.belt.n, colorOf(s.belt.id), '', s.belt.txt) : '');
      var body = '<div class="asg-story">' + esc(q.story) + '</div>'
        + '<div class="asg-meta">地點：<b>' + esc(q.map) + '</b>（' + q.mobs.map(esc).join('、') + '）</div>'
        + row('需求：', chip(q.item, q.itemN, 'text-amber-200', '<span class="' + (have >= q.need ? 'ok' : 'no') + '">' + Math.min(have, q.need) + '</span>/' + q.need))
        + row('獎勵：', rw);
      h += '<div class="asg-ch s-' + k + '"><div class="asg-chh"><span class="asg-no">第 ' + (q.i + 1) + ' 章</span><span class="asg-cht">' + esc(q.title) + '</span><span class="asg-lv">Lv' + q.lv + '</span><span class="asg-badge s-' + k + '">' + STN[k] + '</span></div>';
      if (k === 'done') { h += '<details class="asg-more"><summary>回顧這一章</summary>' + body + '</details></div>'; return; }
      h += body + '<div class="asg-act">';
      if (k === 'lock') h += '<span class="asg-note">完成「' + esc(chs[q.i - 1].title) + '」後才能接取。</span>';
      else if (k === 'lv') h += '<span class="asg-warn">需要等級 ' + q.lv + ' 以上。</span>';
      else if (k === 'new') h += '<button class="btn bg-amber-800 hover:bg-amber-700 py-2 px-4 font-bold" onclick="trialQAccept(\'' + q.key + '\',\'afkSagaRedraw\')">接取</button>';
      else h += '<button class="btn bg-emerald-800 hover:bg-emerald-700 py-2 px-4 font-bold" onclick="trialQComplete(\'' + q.key + '\',\'afkSagaRedraw\')"' + (have >= q.need ? '' : ' disabled') + '>交付</button>' + (have >= q.need ? '' : '<span class="asg-note">（擊殺指定怪物必定掉落，集滿為止）</span>');
      h += '</div></div>';
    });
    if (done === chs.length) h += '<div class="asg-outro">' + esc(s.end) + '</div>';
    return h + '</div>';
  }
  function appendSection() {
    var p = P(), div = document.getElementById('interaction-content'); if (!p || !div) return;
    var old = div.querySelector('.afk-saga-sec'); if (old) old.remove();
    var box = document.createElement('div'); box.className = 'afk-saga-sec'; box.innerHTML = sectionHTML(p); div.appendChild(box);
  }
  W.afkSagaRedraw = function () { if (lastArgs && typeof W.interactNPC === 'function') W.interactNPC.apply(null, lastArgs); else appendSection(); };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try { var p = P(), s = p && SAGA[p.cls]; if (s && npcId === s.host && (p.lv || 1) >= 50) { lastArgs = Array.prototype.slice.call(arguments); appendSection(); } } catch (e) { console.warn('[AFK-class-saga] ui', e); }
      return r;
    };
  }

  W.AFK_CLASS_SAGA = { saga: SAGA, order: ORDER, clsName: CLS_N, chapters: CH, figures: FIGURES, keyOf: function (lv, cls) { return 'saga' + lv + '_' + cls; }, section: sectionHTML };
  console.log('[AFK-class-saga] 已啟用：八職業 55～80 級專屬劇情（共 ' + CH.length + ' 章）');
})();
