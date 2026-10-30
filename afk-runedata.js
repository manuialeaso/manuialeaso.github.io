/* ============================================================================
 * afk-runedata.js — 符文石與時空裂痕新材料的資料（玩家 2026-10-29 晚，設計稿 docs/runes-design.md 第三版）
 *
 * 不是開關：只登錄物品與資料表，給 afk-runes（佐爾頓：開孔、鑲嵌、兌換）與 afk-rift2（時空裂痕）使用。
 *   ‧32 顆符文（三階段：一＝補助、藥水；二＝減傷、寵物；三＝攻擊、套裝、職業）；2026-10-30 21:46 裂、牙、職業符文與相關符文之語做好
 *   ‧失去光芒的符文石（階段一／二／三）：打開隨機給該階段一顆符文
 *   ‧哀石塵埃／哀石碎片／哀石（時空裂痕席琳／瘋狂席琳／夢域鏡掉落）→ 各 150 換 1 顆 哀石水晶／哀石精華／哀石結晶
 *   ‧瘴氣魔石／骸骨魔石／破空石（時空裂痕完全通關）→ 1,000＋500＋100 換 1 顆解命石（開瘴骸·破等級的孔）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.items) return;
  var IMG = function (n) { return 'assets/icons/items/' + n + '.png'; };
  var STAGE_C = { 1: 'text-slate-200', 2: 'text-sky-300', 3: 'text-rose-400', 4: 'text-amber-300' };
  var STAGE_N = { 1: '階段一', 2: '階段二', 3: '階段三', 4: '傳說' };
  // 單符文效果（數字在 afk-runes 實作；這裡是說明文字）
  var RUNES = [
    ['hui', '穗', 1, 'aid', '材料掉落 +15%（全身最多算 2 顆）'],
    ['feng', '豐', 1, 'aid', '金幣 +25%、經驗 +10%（最多 2 顆）'],
    ['xun', '尋', 1, 'aid', '遺物掉落判定 +25%（最多 2 顆，跟幸運暴走兔腳相乘；時空裂痕裡不算）'],
    ['shi', '拾', 1, 'aid', '夢域專屬材料 +25%：夢域塵、回夢香塵、闇龍的抵抗者碎片、之魂（最多 2 顆）'],
    ['quan', '泉', 1, 'potion', '藥水回復量 +25%（最多 2 顆）'],
    ['shun', '瞬', 1, 'potion', '藥水冷卻 −25%（最多 2 顆）'],
    ['ni', '逆', 1, 'potion', '不受「死亡藥水」影響：喝治癒藥水照樣補血'],
    ['yin', '飲', 1, 'potion', '一次喝三罐：扣 3 瓶、回復 ×3，冷卻不變'],
    ['dun', '盾', 2, 'guard', '受到的物理傷害 −6%（最多 2 顆）'],
    ['zhao', '罩', 2, 'guard', '受到的魔法傷害 −6%（最多 2 顆）'],
    ['jing', '淨', 2, 'guard', '受到的屬性傷害 −8%（最多 2 顆）'],
    ['hai', '骸', 2, 'guard', '受到的真實傷害 −10%（最多 2 顆）'],
    ['zong', '鬃', 2, 'pet', '寵物基本屬性 +15%（最多 2 顆）'],
    ['ya', '牙', 2, 'pet', '寵物多學 1 個技能（其他寵物的攻擊魔法，每隻寵物固定；最多 2 顆）'],
    ['qi', '契', 2, 'pet', '寵物繼承主人面板 30% → 40%（兩顆 50%）'],
    ['meng', '夢', 3, 'set', '夢域席琳套裝的百分比效果 +20%（只放大多出來的部分）'],
    ['yan', '魘', 3, 'set', '夢域席琳套裝的能力加成（力量、命中、魔防這類固定數值）×1.5'],
    ['hun', '魂', 3, 'set', '席琳套裝需要的件數 −1，可以跟之魂疊加（最少 1 件）'],
    ['ming', '冥', 3, 'set', '夢域套裝的吸血 ×1.5，受到的傷害 −5%'],
    ['lei', '雷', 3, 'attack', '魔法二次傷害：魔法命中後 20% 機率再打 50%'],
    ['lie', '裂', 3, 'attack', '符文的二次傷害（雷、極意）可以爆擊，照魔法爆擊率與爆擊傷害算（沒有這顆時二次傷害一律不爆擊）'],
    ['jian', '濺', 3, 'attack', '濺射 A：爆擊率不用滿 80%，爆擊時濺射 20% 給其他敵人（從主目標扣）'],
    ['po', '破', 3, 'attack', '無視目標 20% 的減傷與防禦'],
    ['zhan', '斬', 3, 'attack', '對頭目傷害 +15%'],
    ['shi_k', '誓', 3, 'class', '騎士：在佐爾頓指定一個技能（傷害格）——增益技能到期就自動重放（常駐），攻擊技能每 8 秒自動施放一次（照常扣 MP）；職業不符沒有效果'],
    ['ye', '葉', 3, 'class', '妖精：在佐爾頓指定一個技能（傷害格）——增益技能到期就自動重放（常駐），攻擊技能每 8 秒自動施放一次（照常扣 MP）；職業不符沒有效果'],
    ['zhi', '識', 3, 'class', '法師：在佐爾頓指定一個技能（傷害格）——增益技能到期就自動重放（常駐），攻擊技能每 8 秒自動施放一次（照常扣 MP）；職業不符沒有效果'],
    ['ying', '影', 3, 'class', '黑暗妖精：在佐爾頓指定一個技能（傷害格）——增益技能到期就自動重放（常駐），攻擊技能每 8 秒自動施放一次（照常扣 MP）；職業不符沒有效果'],
    ['guan', '冠', 3, 'class', '王族：在佐爾頓指定一個技能（傷害格）——增益技能到期就自動重放（常駐），攻擊技能每 8 秒自動施放一次（照常扣 MP）；職業不符沒有效果'],
    ['lin', '鱗', 3, 'class', '龍騎士：在佐爾頓指定一個技能（傷害格）——增益技能到期就自動重放（常駐），攻擊技能每 8 秒自動施放一次（照常扣 MP）；職業不符沒有效果'],
    ['huan', '幻', 3, 'class', '幻術士：在佐爾頓指定一個技能（傷害格）——增益技能到期就自動重放（常駐），攻擊技能每 8 秒自動施放一次（照常扣 MP）；職業不符沒有效果'],
    ['nu', '怒', 3, 'class', '戰士：在佐爾頓指定一個技能（傷害格）——增益技能到期就自動重放（常駐），攻擊技能每 8 秒自動施放一次（照常扣 MP）；職業不符沒有效果'],
    // 傳說（玩家 2026-10-29）：跟攻擊類的「破」同字，物品名稱加「（傳說）」區分；只能鑲在飾品、腰帶，全身只能裝一顆
    ['po_l', '破', 4, 'aid', '吸收 MP：一般攻擊或攻擊魔法命中時，回復 MP＝面板的近距離傷害／遠距離傷害／魔法傷害（看這一擊是哪一種）×100%，冷卻 3 秒。全身只能裝一顆；另外造成的傷害 +5%（平衡點數）']
  ];
  var UNIQUE = { po_l: true };
  var CLASS_OF = { shi_k: 'knight', ye: 'elf', zhi: 'mage', ying: 'dark', guan: 'royal', lin: 'dragon', huan: 'illusion', nu: 'warrior' };
  var CAT_N = { aid: '補助', potion: '藥水', guard: '減傷', pet: '寵物', set: '套裝', attack: '攻擊', 'class': '職業' };
  var SLOT_CATS = { weapon: ['attack', 'set', 'class'], armor: ['guard', 'potion', 'pet'], acc: ['aid'] };
  var list = RUNES.map(function (r) { return { id: 'afk_rune_' + r[0], key: r[0], ch: r[1], stage: r[2], cat: r[3], d: r[4], cls: CLASS_OF[r[0]] || null, unique: !!UNIQUE[r[0]], nk: UNIQUE[r[0]] ? r[0] : r[1] }; });   // nk：計數用的鍵（傳說的破跟攻擊的破分開算）
  var byId = {}; list.forEach(function (r) { byId[r.id] = r; });
  // 符文之語：照孔的順序比對（'職'＝任一顆職業符文）。武器：相鄰兩孔（1→2、2→3）或三孔；防具：同一件的 1→2 孔。
  //   三符文之語成立時，裡面包含的兩符文之語不另外算；同名符文之語全身最多算 2 次。
  var WORDS = [
    ['bulwark', '壁壘', 'armor', '盾罩', '物理、魔法傷害再各 −3%'],
    ['pure', '無垢', 'armor', '淨骸', '屬性、真實傷害再各 −5%'],
    ['sanct', '聖域', 'armor', '罩逆', '「減少治療」的效果減半'],
    ['uncurse', '解咒', 'armor', '逆淨', '也不受「死亡治療」影響'],
    ['nectar', '甘露', 'armor', '泉飲', '一次喝三罐只扣 2 瓶'],
    ['spring', '湧泉', 'armor', '瞬泉', '每次喝藥水 20% 機率不進冷卻'],
    ['beastking', '獸王', 'armor', '鬃牙', '寵物技能觸發率 +30%'],
    ['bond', '同心', 'armor', '契鬃', '寵物受到的傷害 −30%'],
    ['shatter', '碎陣', 'weapon', '濺破', '濺射 B：爆擊率不用滿 80%，濺射 35%（取代 A），從主目標扣'],
    ['thunder', '雷裂', 'weapon', '雷裂', '魔法二次傷害的機率 20% → 35%'],
    ['regicide', '弒王', 'weapon', '斬破', '對頭目傷害再 +10%'],
    ['nightmare', '夢魘', 'weapon', '夢魘', '夢域套裝百分比效果再 +10%'],
    ['pact', '冥契', 'weapon', '魂冥', '夢域套裝的吸血再 ×1.3'],
    ['dreamhunt', '獵夢', 'weapon', '夢斬', '對夢域的敵人傷害 +15%'],
    ['mastery', '專精', 'weapon', '職斬', '指定技能（傷害格）的傷害 +30%'],
    ['awaken', '覺醒', 'weapon', '職裂', '指定技能（冷卻格）的冷卻 −30%'],
    ['skyfall', '天崩', 'weapon', '濺破裂', '濺射 C：爆擊率滿 80% 時濺射 50%，主目標不扣'],
    ['judgment', '雷霆審判', 'weapon', '雷裂斬', '魔法二次傷害改成 100% 傷害'],
    ['eternal', '永夢', 'weapon', '夢魘魂', '夢域套裝效果再 +15%'],
    ['grace', '席琳的眷顧', 'weapon', '魂冥夢', '夢域套裝吸血 ×2，受到的傷害再 −5%'],
    ['dragonslay', '屠龍', 'weapon', '斬破濺', '對四龍（含各階型態）傷害 +25%'],
    ['zenith', '極意', 'weapon', '職雷裂', '指定技能也會觸發二次傷害'],
    ['kingsway', '王道', 'weapon', '職斬破', '指定技能傷害 +50%，無視 20% 減傷'],
    ['styx', '冥河', 'weapon', '冥斬裂', '擊殺時回復 3% 最大 HP'],
    // 2026-10-29 玩家：補助、藥水、減傷、寵物、套裝都要有三符文連線。防具的連線＝盔甲→頭盔→斗篷→手套→長靴→脛甲→T恤→盾（臂甲）的孔排成一列，
    //   飾品的連線＝戒指 1～4→耳環 1～2→項鍊→腰帶 1～3 的孔排成一列；連續三個孔照順序就成立（可以跨裝備），同名連線全身算一次。
    ['harvest', '豐饒', 'accline', '穗豐尋', '材料、金幣、遺物掉落再各 +10%'],
    ['gleaner', '拾光', 'accline', '尋拾豐', '夢域專屬材料再 +20%、經驗再 +10%'],
    ['lifespring', '生生不息', 'armorline', '泉瞬飲', '藥水回復量再 +25%'],
    ['phoenix', '不死藥', 'armorline', '逆泉瞬', '喝治癒藥水時另外回復最大 HP 3%'],
    ['vajra', '金剛', 'armorline', '盾罩淨', '物理、魔法、屬性傷害再各 −4%'],
    ['adamant', '不壞', 'armorline', '骸淨盾', '真實傷害再 −8%'],
    ['menagerie', '萬獸', 'armorline', '鬃契牙', '寵物能力再 +15%、繼承主人面板再 +5%'],
    ['soulreturn', '魂歸', 'weapon', '魂冥魘', '夢域套裝吸血再 ×1.3、受到的傷害再 −5%']
  ].map(function (w) { return { id: w[0], n: w[1], where: w[2], seq: w[3].split(''), d: w[4] }; });
  var ITEMS = {};
  list.forEach(function (r) {
    ITEMS[r.id] = { n: r.ch + '之符文' + (r.stage === 4 ? '（傳說）' : ''), c: STAGE_C[r.stage], img: IMG('符文(' + r.ch + ')'),
      d: '【符文石・' + STAGE_N[r.stage] + '・' + CAT_N[r.cat] + '】' + r.d + '。在說話之島的符文師佐爾頓那裡鑲進' + (r.cat === 'aid' ? '飾品或腰帶' : (SLOT_CATS.armor.indexOf(r.cat) >= 0 ? '防具' : '武器')) + '的星蝕·解孔。' };
  });
  list.forEach(function (r) { if (r.stage === 4) ITEMS[r.id].d += '取得：說話之島的符文師佐爾頓用解命石 1＋哀石結晶 30 換取；或在時空裂痕（席琳模式）前 12 分鐘，每次擊殺 1% 掉落（一趟最多一顆）。鑲嵌費哀石結晶 40。'; });
  // ── 升星（玩家 2026-10-30 20:54，設計稿 docs/rune-stars-design.md）──
  //   ★1 哀石結晶 50、★2 解命石 10、★3 兩顆同名 ★2 合成；階段一每星 +5 個百分點、階段二 +3、階段三見下表；
  //   魂、傳說符文不能升星；效果還在製作中的（裂、牙、八顆職業符文）等本體做好再開放。符文之語不跟星數。
  //   每顆星是獨立的物品：afk_rune_<key>_s1～s3（背包疊放、孔裡記錄都照舊），byId 帶 star／base。
  var NO_STAR = { hun: 1, po_l: 1 }, WIP_STAR = {};   // 2026-10-30 21:46：裂、牙、職業符文做好了，開放升星
  var STAR_TXT = {
    hui: ['材料掉落 +20%', '材料掉落 +25%', '材料掉落 +30%'],
    feng: ['金幣 +30%、經驗 +15%', '金幣 +35%、經驗 +20%', '金幣 +40%、經驗 +25%'],
    xun: ['遺物掉落判定 +30%', '遺物掉落判定 +35%', '遺物掉落判定 +40%'],
    shi: ['夢域專屬材料 +30%', '夢域專屬材料 +35%', '夢域專屬材料 +40%'],
    quan: ['藥水回復量 +30%', '藥水回復量 +35%', '藥水回復量 +40%'],
    shun: ['每次喝藥水 30% 不進冷卻', '35% 不進冷卻', '40% 不進冷卻'],
    ni: ['另外「減少治療」的效果 −5%', '「減少治療」的效果 −10%', '「減少治療」的效果 −15%'],
    yin: ['5% 機率一次喝四罐', '10% 機率一次喝四罐', '15% 機率一次喝五罐，另有 1% 機率一次喝十罐'],
    dun: ['受到的物理傷害 −9%', '−12%', '−15%'], zhao: ['受到的魔法傷害 −9%', '−12%', '−15%'],
    jing: ['受到的屬性傷害 −11%', '−14%', '−17%'], hai: ['受到的真實傷害 −13%', '−16%', '−19%'],
    zong: ['寵物基本屬性 +18%', '+21%', '+24%'], qi: ['寵物繼承主人面板再 +3%', '再 +6%', '再 +9%'],
    meng: ['夢域套裝百分比效果 +25%', '+30%', '+40%'], yan: ['夢域套裝的固定數值 ×1.6', '×1.7', '×1.8'],
    ming: ['夢域套裝吸血 ×1.6、受到的傷害 −6%', '吸血 ×1.7、受到的傷害 −7%', '吸血 ×2.0、受到的傷害 −8%'],
    lei: ['魔法二次傷害機率 25%', '機率 30%', '機率 30%，二次傷害改成 60%'],
    jian: ['濺射 25%', '濺射 30%', '濺射 35%，主目標只扣一半'],
    po: ['無視目標 25% 的減傷與防禦', '無視 30%', '無視 35%，另外造成的傷害 +5%'],
    zhan: ['對頭目傷害 +18%', '+21%', '+25%，頭目 HP 50% 以下再 +5%'],
    lie: ['二次傷害的爆擊傷害 +10%', '+20%', '+30%，二次傷害的爆擊率 +10%'],
    ya: ['寵物技能觸發率 +3%', '+6%', '+9%'],
    shi_k: ['攻擊型每 7 秒施放；增益型重放的 MP −30%', '攻擊型每 6 秒；增益型 MP −60%', '攻擊型每 5 秒、指定技能傷害 +20%；增益型不耗 MP，而且也套用到全部傭兵'],
    ye: ['攻擊型每 7 秒施放；增益型重放的 MP −30%', '攻擊型每 6 秒；增益型 MP −60%', '攻擊型每 5 秒、指定技能傷害 +20%；增益型不耗 MP，而且也套用到全部傭兵'],
    zhi: ['攻擊型每 7 秒施放；增益型重放的 MP −30%', '攻擊型每 6 秒；增益型 MP −60%', '攻擊型每 5 秒、指定技能傷害 +20%；增益型不耗 MP，而且也套用到全部傭兵'],
    ying: ['攻擊型每 7 秒施放；增益型重放的 MP −30%', '攻擊型每 6 秒；增益型 MP −60%', '攻擊型每 5 秒、指定技能傷害 +20%；增益型不耗 MP，而且也套用到全部傭兵'],
    guan: ['攻擊型每 7 秒施放；增益型重放的 MP −30%', '攻擊型每 6 秒；增益型 MP −60%', '攻擊型每 5 秒、指定技能傷害 +20%；增益型不耗 MP，而且也套用到全部傭兵'],
    lin: ['攻擊型每 7 秒施放；增益型重放的 MP −30%', '攻擊型每 6 秒；增益型 MP −60%', '攻擊型每 5 秒、指定技能傷害 +20%；增益型不耗 MP，而且也套用到全部傭兵'],
    huan: ['攻擊型每 7 秒施放；增益型重放的 MP −30%', '攻擊型每 6 秒；增益型 MP −60%', '攻擊型每 5 秒、指定技能傷害 +20%；增益型不耗 MP，而且也套用到全部傭兵'],
    nu: ['攻擊型每 7 秒施放；增益型重放的 MP −30%', '攻擊型每 6 秒；增益型 MP −60%', '攻擊型每 5 秒、指定技能傷害 +20%；增益型不耗 MP，而且也套用到全部傭兵']
  };
  var STAR_COST = { 1: { afk_lament_gem: 50 }, 2: { afk_fate_unlock: 10 } };   // ★3＝兩顆同名 ★2
  var starOk = function (r) { return !!(r && !r.star && !r.unique && !NO_STAR[r.key] && !WIP_STAR[r.key] && STAR_TXT[r.key]); };
  var starId = function (baseId, n) { return n > 0 ? baseId + '_s' + n : baseId; };
  var STARS = ['', '★1', '★2', '★3'];
  list.forEach(function (r) {
    if (!starOk(r)) return;
    for (var n = 1; n <= 3; n++) {
      var id = starId(r.id, n);
      byId[id] = Object.assign({}, r, { id: id, star: n, base: r.id });
      ITEMS[id] = { n: r.ch + '之符文 ' + STARS[n], c: STAGE_C[r.stage], img: IMG('符文(' + r.ch + ')'),
        d: '【符文石・' + STAGE_N[r.stage] + '・' + CAT_N[r.cat] + '・' + STARS[n] + '】' + STAR_TXT[r.key][n - 1] + '（原本：' + r.d + '）。'
          + '升星：★1 哀石結晶 50、★2 解命石 10、★3 兩顆同名 ★2 合成（說話之島的符文師佐爾頓）。符文之語不跟星數。' };
    }
  });
  var BOX = { 1: 'afk_runebox_1', 2: 'afk_runebox_2', 3: 'afk_runebox_3' };
  var SRC = { 1: '時空裂痕（席琳模式）', 2: '時空裂痕（瘋狂席琳模式）', 3: '時空裂痕（夢域鏡席琳模式）' };
  [1, 2, 3].forEach(function (s) {
    ITEMS[BOX[s]] = { n: '失去光芒的符文石（' + STAGE_N[s] + '）', c: STAGE_C[s], img: IMG('失去光芒的符文石(階段' + s + ')'), eff: 'afk_runebox', stage: s,
      d: '黯淡無光的符文石，握在手裡才微微發熱。使用後' + ({ 1: '（消耗魔法結晶體 100 個）', 2: '（消耗魔法結晶體 150 個）', 3: '' })[s] + '隨機變成一顆' + STAGE_N[s] + '的符文（' + list.filter(function (r) { return r.stage === s; }).map(function (r) { return r.ch; }).join('、') + '）。' + SRC[s] + '的結算獎勵。' };
  });
  var LAMENT = {
    afk_lament_dust: ['哀石塵埃', 'text-slate-300', '席琳的嘆息落進時空裂縫後凝成的細砂。時空裂痕（席琳模式）：一般怪 1%、60 等以下頭目 10%、60 等以上頭目 25%、第 60 分鐘起頭目必掉。'],
    afk_lament_shard: ['哀石碎片', 'text-violet-300', '瘋狂中的席琳咬碎的悲傷，邊緣還帶著尖銳的怒意。時空裂痕（瘋狂席琳模式）：一般怪 1%、60 等以下頭目 10%、60 等以上頭目 25%、第 60 分鐘起頭目必掉。'],
    afk_lament_stone: ['哀石', 'text-teal-300', '在夢域深處完整成形的悲傷，握久了會聽見遠方的潮聲。時空裂痕（夢域鏡席琳模式）：一般怪 1%、60 等以下頭目 10%、60 等以上頭目 25%、第 60 分鐘起頭目必掉。500 個可以請佐爾頓把一顆符文完整拆下來。'],
    afk_lament_crystal: ['哀石水晶', 'text-sky-200', '一百五十粒塵埃壓成的透明結晶，能讓第一階段的符文安穩嵌進孔裡。佐爾頓：哀石塵埃 150 個換 1 個。鑲入階段一符文每次 5 個。'],
    afk_lament_essence: ['哀石精華', 'text-violet-300', '從碎片裡淬出的精華，第二階段的符文要靠它才肯停留。佐爾頓：哀石碎片 150 個換 1 個。鑲入階段二符文每次 10 個。'],
    afk_lament_gem: ['哀石結晶', 'text-rose-300', '悲傷凝到極致的結晶，連第三階段的符文也鎖得住。佐爾頓：哀石 150 個換 1 個。鑲入階段三符文每次 20 個；戒指、項鍊、耳環開孔 5 個。'],
    afk_miasma_stone: ['瘴氣魔石', 'text-lime-300', '裂痕崩塌時噴出的瘴氣，被時間壓成了石頭。時空裂痕（席琳模式）撐滿 80 分鐘完全通關的獎勵。解命石的材料。'],
    afk_bone_stone: ['骸骨魔石', 'text-stone-200', '被時空碾碎的骸骨，在瘋狂的裂痕裡重新凝結而成。時空裂痕（瘋狂席琳模式）撐滿 80 分鐘完全通關的獎勵。解命石的材料。'],
    afk_void_stone: ['破空石', 'text-cyan-300', '只有撐過夢域崩塌的人，才撿得到這塊能劃開空間的石頭。時空裂痕（夢域鏡席琳模式）撐滿 80 分鐘完全通關的獎勵。解命石的材料。'],
    afk_fate_unlock: ['解命石', 'text-yellow-300', '三種魔石熔成的鑰匙，能解開被命運鎖住的最後一個孔。佐爾頓：瘴氣魔石 1,000、骸骨魔石 500、破空石 100 換 1 個。用來打開瘴骸·破等級的符文孔（武器第三孔、腰帶三孔）。']
  };
  var LIMG = { afk_lament_dust: '哀石塵埃', afk_lament_shard: '哀石碎片', afk_lament_stone: '哀石', afk_lament_crystal: '哀石水晶', afk_lament_essence: '哀石精華', afk_lament_gem: '哀石結晶', afk_miasma_stone: '瘴氣魔石', afk_bone_stone: '骸骨魔石', afk_void_stone: '破空石', afk_fate_unlock: '解命石' };
  Object.keys(LAMENT).forEach(function (id) { var x = LAMENT[id]; ITEMS[id] = { n: x[0], c: x[1], img: IMG(LIMG[id]), d: x[2] }; });
  Object.keys(ITEMS).forEach(function (id) {
    if (DB.items[id]) return;
    var x = ITEMS[id];
    DB.items[id] = { n: x.n, type: 'etc', p: 0, c: x.c, img: x.img, noUse: !x.eff, gachaWeight: 0, d: x.d };
    if (x.eff) { DB.items[id].eff = x.eff; DB.items[id].runeStage = x.stage; }
    try { if (typeof miscCatKey === 'function' && typeof MISC_CAT_ITEMS !== 'undefined') { var k = miscCatKey(id, DB.items[id]); if (k && MISC_CAT_ITEMS[k] && !MISC_ITEM_CAT[id]) { MISC_CAT_ITEMS[k].push(id); MISC_ITEM_CAT[id] = k; if (typeof OBTAINABLE_MISC !== 'undefined') OBTAINABLE_MISC[id] = true; } } } catch (e) {}
  });
  // 失去光芒的符文石：使用＝打開
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  // 玩家 2026-10-29 16:24：解開失去光芒的符文石要魔法結晶體——階段一 100 個、階段二 150 個、階段三不用
  var OPEN_COST = { 1: 100, 2: 150, 3: 0 };
  var crystalId = function () { var X = W.AFK_TTMI_ITEMS, id = X && X.resolve ? X.resolve(7102) : null; if (id && DB.items[id]) return id; return Object.keys(DB.items).find(function (k) { return DB.items[k] && DB.items[k].n === '魔法結晶體'; }) || null; };
  var haveOf = function (p, id) { return (p.inv || []).filter(function (x) { return x && x.id === id && !x.lock; }).reduce(function (n, x) { return n + (Number(x.cnt) || 1); }, 0); };
  var takeOf = function (p, id, n) { (p.inv || []).filter(function (x) { return x && x.id === id && !x.lock; }).forEach(function (x) { if (n <= 0) return; var c = Number(x.cnt) || 1, k = Math.min(c, n); n -= k; if (c - k > 0) x.cnt = c - k; else p.inv.splice(p.inv.indexOf(x), 1); }); };
  // 玩家 2026-10-29 20:38：魔法結晶體不夠時，自動用背包＋倉庫的結晶體，還不夠就用背包＋倉庫裡能提煉的材料（材料工坊的提煉配方）先做出來
  var whHave = function (id) { try { return typeof whCountId === 'function' ? whCountId(id) : 0; } catch (e) { return 0; } };
  var allHave = function (p, id) { return haveOf(p, id) + whHave(id); };
  var takeAll = function (p, id, n) {   // 背包優先、再扣倉庫
    var a = Math.min(n, haveOf(p, id)); if (a > 0) takeOf(p, id, a); n -= a;
    if (n > 0) { try { if (typeof whConsumeId === 'function') n -= whConsumeId(id, n); } catch (e) {} }
    return n <= 0;
  };
  var refinePlan = function (p, cid, short) {
    var X = W.AFK_TTMI_ITEMS, rs = (X && X.recipes) || [], rows = [];
    rs.forEach(function (r) {
      if (r.result !== cid || r.ttmiRecipeKind !== 'refine') return;
      var mat = r.req.filter(function (q) { return q.id !== 'gold'; })[0], g = r.req.filter(function (q) { return q.id === 'gold'; })[0];
      if (!mat || !DB.items[mat.id]) return;
      var have = allHave(p, mat.id), y = Math.max(1, r.yield || 1), times = Math.floor(have / mat.cnt);
      if (times > 0) rows.push({ mat: mat.id, per: mat.cnt, gold: g ? g.cnt : 0, y: y, times: times });
    });
    rows.sort(function (a, b) { return (a.gold / a.y) - (b.gold / b.y) || b.times - a.times; });   // 每個結晶體的金幣最少的先用
    var plan = [], gold = Number(p.gold) || 0, got = 0, cost = 0;
    rows.forEach(function (r) {
      if (got >= short) return;
      var k = Math.min(r.times, Math.ceil((short - got) / r.y));
      if (r.gold > 0) k = Math.min(k, Math.floor((gold - cost) / r.gold));
      if (k <= 0) return;
      plan.push({ mat: r.mat, n: k * r.per, times: k, gold: k * r.gold, y: k * r.y }); got += k * r.y; cost += k * r.gold;
    });
    return { plan: plan, got: got, gold: cost };
  };
  var openBox = function (it) {
    var p = P(), d = DB.items[it.id], s = d.runeStage;
    var cost = OPEN_COST[s] || 0, cid = cost ? crystalId() : null;
    if (cost && cid) {
      var have = allHave(p, cid), made = null;
      if (have < cost) {
        var pl = refinePlan(p, cid, cost - have);
        if (have + pl.got < cost) {
          try { logSys('<span class="text-red-400">解開' + d.n + '需要魔法結晶體 ' + cost + ' 個（背包＋倉庫未上鎖的有 ' + have + ' 個'
            + (pl.got ? '，用背包＋倉庫的材料最多還能提煉 ' + pl.got + ' 個' : '，背包＋倉庫也沒有能提煉的材料') + '）。</span>'); } catch (e) {}
          return null;
        }
        pl.plan.forEach(function (x) { takeAll(p, x.mat, x.n); });
        p.gold = (Number(p.gold) || 0) - pl.gold;
        gainItem(cid, pl.got, true, true);
        made = pl;
      }
      takeAll(p, cid, cost);
      if (made) { try { logSys('<span class="text-cyan-300">魔法結晶體不夠，先自動提煉了 ' + made.got + ' 個：' + made.plan.map(function (x) { return (DB.items[x.mat] || {}).n + ' ×' + x.n.toLocaleString(); }).join('、') + (made.gold ? '，金幣 ' + made.gold.toLocaleString() : '') + '（背包優先，再用倉庫）。</span>'); } catch (e) {} }
    }
    var pool = list.filter(function (r) { return r.stage === s; });
    var r = pool[Math.floor(Math.random() * pool.length)];
    if ((Number(it.cnt) || 1) > 1) it.cnt = (Number(it.cnt) || 1) - 1; else p.inv.splice(p.inv.indexOf(it), 1);
    gainItem(r.id, 1, true, true);
    try { logSys('<span class="' + STAGE_C[s] + ' font-bold">符文石重新亮了起來：' + DB.items[r.id].n + '。</span>'); } catch (e) {}
    try { if (typeof renderTabs === 'function') renderTabs(); saveGame(); } catch (e) {}
    return r.id;
  };
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (uid) {
      var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uid; }), d = it && DB.items[it.id];
      if (d && d.eff === 'afk_runebox') { if (it.lock) return; openBox(it); try { if (typeof closeModal === 'function') { var left = p.inv.find(function (x) { return x.uid === uid; }); if (left && typeof openModal === 'function') openModal(left, false); else closeModal(); } } catch (e) {} return; }
      return oUse.apply(this, arguments);
    };
  }
  W.__afkRuneData = { list: list, byId: byId, WORDS: WORDS, CAT_N: CAT_N, SLOT_CATS: SLOT_CATS, STAGE_N: STAGE_N, STAGE_C: STAGE_C, BOX: BOX, CLASS_OF: CLASS_OF,
    DUST: { sherine: 'afk_lament_dust', mad: 'afk_lament_shard', dream: 'afk_lament_stone' },
    CUR: { 1: 'afk_lament_crystal', 2: 'afk_lament_essence', 3: 'afk_lament_gem', 4: 'afk_lament_gem' },
    EXCHANGE: { afk_lament_dust: 'afk_lament_crystal', afk_lament_shard: 'afk_lament_essence', afk_lament_stone: 'afk_lament_gem' }, EX_RATE: 150,
    FATE: { id: 'afk_fate_unlock', need: { afk_miasma_stone: 1000, afk_bone_stone: 500, afk_void_stone: 100 } },
    CLEAR: { sherine: ['afk_miasma_stone', 100], mad: ['afk_bone_stone', 50], dream: ['afk_void_stone', 10] },
    INLAY: { 1: 5, 2: 10, 3: 20, 4: 40 },
    // 傳說符文（暫定）：佐爾頓用解命石 1＋哀石結晶 30 換一顆；鑲嵌費哀石結晶 40
    LEGEND: { 'afk_rune_po_l': { afk_fate_unlock: 1, afk_lament_gem: 30 } },
    // 平衡點數（玩家 2026-10-29：太強就壓縮傷害、太弱就追加傷害）：鑲著這顆符文時，造成的傷害 ×(1＋點數×1%)；0＝不調整
    // 佐爾頓合成（玩家 2026-10-29）：同階段符文 3 顆＋哀石結晶 10 → 隨機一顆高一階的符文。只開放 階段一→二、階段二→三（傳說不從合成出）
    COMBINE: { n: 3, cost: ['afk_lament_gem', 10], from: [1, 2] },
    STAR_TXT: STAR_TXT, STAR_COST: STAR_COST, NO_STAR: NO_STAR, WIP_STAR: WIP_STAR, starOk: starOk, starId: starId, STARS: STARS,
    BAL: { po_l: 5 }, OPEN_COST: OPEN_COST, REMOVE: ['afk_lament_stone', 500], openBox: openBox, refinePlan: refinePlan };
})();
