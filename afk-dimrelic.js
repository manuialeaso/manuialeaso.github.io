/* ============================================================================
 * afk-dimrelic.js — 次元遺物（Ping 11-07 06:50、08:02）
 *
 *   180 件：武器 80（14 種武器）、防具 80（8 個部位 × 10）、飾品 20。名字、台詞取自次元裂縫裡出場的角色與怪物。
 *   製作：同部位（武器要同武器種類）的 +0 遺物 1 件＋次元結晶 500 → 自選一件同部位的次元遺物（席琳神殿「次元的鍛造師」）。
 *   基礎：武器大小傷 5／5、沒有武器特效；防具 AC 5；飾品 AC 2。不能強化（一般強化）、不能賣。
 *   次元強化：異化星塵 +1 20、+2 30、+3 40、+4 50、+5 100；成功率 100／80／60／40／100%；失敗不降級、不會壞、不扣材料。
 *   特效：+1、+2、+4 固定（每件不同的角色主題＋部位特性）；
 *         +3 隨機抽一套「套裝」：給套裝的名稱效果，同一套 3 件開「核心技能」、6 件開六件效果；
 *         +5 隨機抽一招同類（武器／防具／飾品）的「遺物絕技」，有冷卻、強度約曲線 100；同一套的 +5 有 9 件才開九件效果。
 *         倒影之鏡 1 個可以重抽 +3 的套裝或 +5 的遺物絕技。
 *   四龍專屬：四龍副本・裂縫的龍掉「次元時空・破」；倒影之鏡＋四龍的時空碎片進化成 斬 → 解 → 序。只在四龍副本裡有效果。
 *   效果只算你本人（傭兵身上沒有效果）。經典模式沒有；外掛開關 dimrelic。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, K = W.__afkNpcKit, L = W.__afkLore;
  if (T && T.register) T.register({ id: 'dimrelic', name: '次元遺物', group: '遊戲內容', desc: '180 件次元遺物（+3 套裝、+5 遺物絕技）與四龍專屬的次元時空武器' });
  if (T && !T.enabled('dimrelic')) return;
  if (typeof DB === 'undefined' || !DB.items || !K) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = K.esc, sys = function (h) { try { logSys(h); } catch (e) {} }, clog = function (h) { try { if (L && L.clog) L.clog(h); else logSys(h); } catch (e) {} };
  var mobs = function () { return (typeof mapState !== 'undefined' && mapState.mobs) || []; };
  var cnt = function (id) { return typeof questCountId === 'function' ? questCountId(id) : 0; };
  var take = function (id, n) { try { questConsumeId(id, n); return true; } catch (e) { return false; } };
  var IMG = 'assets/icons/items/', CRYSTAL = 'afk_dim_crystal', DUST = 'afk_alien_dust', STARDUST = 'afk_star_dust', BLOOD = 'afk_blood_dia', MIRROR = 'afk_rd_mirror', FRAG = 'afk_rd_dfrag', SCALE = 'afk_rd_scale';
  var COST = { craft: 500, en: [20, 30, 40, 50, 100], rate: [100, 80, 60, 40, 100], synth: { star: 100, blood: 10 }, reroll: 1 };

  // ── 角色（主題、台詞） ──
  var CH = [
    ['次元裂隙', 'rift', '「現在，她在看你。」'], ['縫口', 'rift', '「……還差一針。」'], ['無盡的守門者', 'rift', '「再往下，就沒有門了。」'], ['象牙塔的喬', 'rift', '「這扇門只能從外面開。」'],
    ['星蝕者 艾斯崔亞', 'crit', '「星星連成線的時候，就有人要分開。」'], ['墜星', 'crit', '「我們曾經也是光。」'], ['搜尋之光', 'crit', '「找到你了。」'], ['監視之眼', 'crit', '「看見了，就要裁決。」'],
    ['水之精靈 賽尼斯', 'heal', '「水會記得。」'], ['水龍 法利昂', 'heal', '「母親……被光切開了。」'], ['最早的那一點光', 'heal', '「我原本只是想照亮一點點地方。」'], ['八歲的阿斯泰', 'heal', '「這顆石頭是藍色的。」'],
    ['殷海薩', 'true', '「我需要。」'], ['反王 肯恩', 'true', '「我答應過要作證。」'], ['冥皇丹特斯', 'true', '「信仰是最後一縷光。」'], ['第二世的你', 'true', '「你又回來了。」'],
    ['墮光天使 阿納金', 'boss', '「號角吹了幾千年，我也累了。」'], ['天梯守衛', 'boss', '「天梯只往上。」'], ['地龍 安塔瑞斯', 'boss', '「大地不會忘記。」'], ['火龍 巴拉卡斯', 'boss', '「火會說真話。」'],
    ['時之蛀蟲', 'stack', '「咔嚓、咔嚓、咔嚓。」'], ['第一世的你', 'stack', '「……別回頭看天上的光。」'], ['長老會議', 'stack', '「我們投票決定了你的死。」'], ['呼喊者', 'stack', '「再大聲一點。」'],
    ['映照者 米菈', 'mirror', '「鏡子裡的你比較誠實。」'], ['你的倒影', 'mirror', '「我才是先站在這裡的那個。」'], ['守門影', 'mirror', '「窗外是冬至的夜。」'], ['風龍 林德拜爾', 'mirror', '「風從不停留。」'],
    ['熔岩挖掘者 博格', 'fire', '「再深一點，就是心臟。」'], ['燃燼的礦工', 'fire', '「鑽機不能停。」'], ['四大軍王', 'fire', '「王冠是燒紅的鐵。」'], ['黑暗大法師 哈汀', 'fire', '「你身上的時間是倒著流的。」'],
    ['深淵的大王烏賊', 'ink', '「（墨在水裡散開了）」'], ['斷掉的觸手', 'ink', '「（還在動）」'], ['亡靈船長', 'ink', '「這艘船不靠岸。」'], ['裂痕的窺視者', 'ink', '「我從縫裡看了你很久。」'],
    ['停擺之主 克羅諾斯塔', 'speed', '「時間是我停下來的。」'], ['鏽蝕的鐘匠', 'speed', '「這座鐘慢了一千年。」'], ['鐘擺守衛', 'speed', '「左、右、左、右。」'], ['伊娃的鎖鏈', 'speed', '「這不是我的水。」']
  ];
  // 主題：[ +1 小效果, +4 招牌 ] × [武器, 防具, 飾品]；每條 = [說明, 效果…]
  var TH = {
    rift: [[['對裂縫敵人傷害 +5%', ['out', 0.05, 'rift']], ['命中時 4% 機率「裂隙斬」：對全體敵人造成該次傷害 80%', ['aoe', 0.04, 0.8]]],
      [['侵蝕扣血每秒少 0.1%', ['erode', 0.1]], ['侵蝕扣血每秒再少 0.2%、侵蝕最低保留 +20', ['erode', 0.2], ['floor', 20]]],
      [['侵蝕最低保留 +10', ['floor', 10]], ['侵蝕最低保留 +30、對裂縫敵人傷害 +5%', ['floor', 30], ['out', 0.05, 'rift']]]],
    crit: [[['爆擊傷害 +10%', ['stat', 'critDmg', 10]], ['爆擊時 20% 機率讓下一擊傷害 ×2', ['critNext', 0.2, 2]]],
      [['HP 低於 30% 時受到的傷害 −6%', ['taken', 0.06, 'low30']], ['HP 低於 30% 時被打中，20% 機率回復 4% HP（10 秒冷卻）', ['hurtHeal', 0.2, 0.04, 10]]],
      [['爆擊率 +1%', ['stat', 'crit', 1]], ['爆擊傷害 +20%', ['stat', 'critDmg', 20]]]],
    heal: [[['吸血 2%', ['leech', 0.02]], ['吸血時得到 3 秒「潮汐」：受到的傷害 −8%', ['tide', 3, 0.08]]],
      [['受到的治療 +5%', ['healIn', 0.05]], ['每 10 秒回復 3% HP', ['regen', 0.03, 10]]],
      [['打倒怪物回復 2% HP', ['killHeal', 0.02]], ['全隊（含傭兵）每 10 秒回復 2% HP', ['regenParty', 0.02, 10]]]],
    true: [[['命中時追加 50 真實傷害', ['flat', 50]], ['每第 5 次攻擊傷害 ×2.5', ['everyN', 5, 2.5]]],
      [['受到的傷害 −2%', ['taken', 0.02, '']], ['單次受到超過最大 HP 20% 的傷害時，該次 −30%（20 秒冷卻）', ['bigHit', 0.2, 0.3, 20]]],
      [['命中時追加 30 真實傷害', ['flat', 30]], ['每次攻擊追加目標最大 HP 0.3% 的真實傷害（頭目 0.03%）', ['pctTrue', 0.003, 0.0003]]]],
    boss: [[['對頭目傷害 +4%', ['out', 0.04, 'boss']], ['頭目 HP 低於 50% 時對它傷害 +15%', ['out', 0.15, 'bossLow']]],
      [['受到頭目的傷害 −3%', ['taken', 0.03, 'boss']], ['受到頭目的傷害 −8%、魔防 +15', ['taken', 0.08, 'boss'], ['stat', 'mr', 15]]],
      [['對頭目傷害 +3%', ['out', 0.03, 'boss']], ['對頭目傷害 +5%、受到頭目的傷害 −6%', ['out', 0.05, 'boss'], ['taken', 0.06, 'boss']]]],
    stack: [[['同一隻目標每打 10 下傷害 +1%（最多 +10%）', ['same', 0.10]], ['同一目標的加成上限 +10%', ['same', 0.10]]],
      [['戰鬥中每 30 秒受到的傷害 −1%（最多 −8%，回村或倒下清除）', ['timeTaken', 0.08]], ['上面的上限再 −4%', ['timeTaken', 0.04]]],
      [['戰鬥中每分鐘造成的傷害 +1%（最多 +8%）', ['timeOut', 0.08]], ['上面的上限再 +8%', ['timeOut', 0.08]]]],
    mirror: [[['命中時 3% 機率複製該次傷害一次', ['copy', 0.03]], ['複製出的那一擊 50% 機率再複製一次', ['copyChain', 0.5]]],
      [['迴避 +3', ['stat', 'er', 3]], ['受到的傷害反彈 8%（真實傷害）', ['reflect', 0.08]]],
      [['受到的傷害反彈 3%', ['reflect', 0.03]], ['受到的傷害反彈 5%、受到的傷害 −5%', ['reflect', 0.05], ['taken', 0.05, '']]]],
    fire: [[['命中時 5% 機率點燃（每秒該次傷害 20%，5 秒）', ['burn', 0.05, 0.2, 5]], ['點燃最多疊 3 層', ['burnStack', 3]]],
      [['火屬性抗性 +40', ['stat', 'resFire', 40]], ['被攻擊時 10% 機率讓攻擊者燃燒（每秒最大 HP 0.3%，頭目 0.05%，5 秒）', ['thorn', 0.1, 0.003, 0.0005, 5]]],
      [['對燃燒中的目標傷害 +5%', ['out', 0.05, 'burn']], ['對燃燒中的目標傷害 +12%', ['out', 0.12, 'burn']]]],
    ink: [[['命中 +5', ['stat', 'hit', 5]], ['命中時 4% 機率「墨汁」：目標造成的傷害 −30%、5 秒', ['ink', 0.04, 5]]],
      [['魔防 +10', ['stat', 'mr', 10]], ['受到中了墨汁的敵人傷害時，再 −15%', ['inkTaken', 0.15]]],
      [['命中 +3', ['stat', 'hit', 3]], ['對有減益（墨汁、燃燒、暈眩）的目標傷害 +8%', ['out', 0.08, 'debuff']]]],
    speed: [[['每 20 秒下一擊傷害 ×2', ['cdHit', 20, 2]], ['上面那一擊改成 ×4，並暈眩目標 1 秒（頭目無效）', ['cdHit', 20, 2], ['cdStun', 1]]],
      [['暈眩、凍結的時間 −20%', ['cc', 0.2]], ['暈眩、凍結的時間再 −20%（含時間停止）', ['cc', 0.2]]],
      [['每 30 秒回復 5% MP', ['mp', 0.05, 30]], ['每 30 秒再回復 10% MP', ['mp', 0.10, 30]]]]
  };
  // 部位特性（+2）
  var WT = [['匕首', 6, '牙', ['對 HP 低於 30% 的目標傷害 +10%', ['out', 0.10, 'low30']]], ['單手劍', 6, '劍', ['傷害減免 +8', ['stat', 'dr', 8]]], ['雙手劍', 6, '大劍', ['造成的傷害 +4%', ['out', 0.04, '']]],
    ['武士刀', 6, '刃', ['爆擊傷害 +12%', ['stat', 'critDmg', 12]]], ['單手鈍器', 6, '錘', ['命中時 3% 機率暈眩目標 1 秒（頭目無效）', ['stun', 0.03, 1]]], ['雙手鈍器', 6, '巨錘', ['對頭目傷害 +5%', ['out', 0.05, 'boss']]],
    ['矛', 6, '長矛', ['一般攻擊波及另一個目標 30%', ['splash', 0.3]]], ['弓', 6, '弓', ['遠距離傷害 +6%', ['out', 0.06, 'ranged']]], ['魔杖', 6, '杖', ['魔法傷害 +6%', ['out', 0.06, 'magic']]],
    ['奇古獸', 6, '靈', ['魔法爆擊傷害 +15%', ['stat', 'magicCritDmg', 15]]], ['十字弓', 5, '弩', ['命中時 5% 機率再射一次', ['copy', 0.05]]], ['鋼爪', 5, '爪', ['吸血 2%', ['leech', 0.02]]],
    ['雙刀', 5, '雙刃', ['命中時 5% 機率追加一擊', ['copy', 0.05]]], ['鎖鏈劍', 5, '鎖鏈劍', ['對有減益的目標傷害 +6%', ['out', 0.06, 'debuff']]]];
  var AS = [['頭盔', 'helm', '面具', ['魔防 +10', ['stat', 'mr', 10]]], ['盔甲', 'armor', '甲殼', ['最大 HP +4%', ['stat', 'mhpPct', 4]]], ['內衣', 'tshirt', '內襯', ['五屬性抗性 +20', ['stat', 'res5', 20]]], ['斗篷', 'cloak', '羽翼', ['迴避 +2', ['stat', 'er', 2]]],
    ['手套', 'gloves', '手', ['命中 +4', ['stat', 'hit', 4]]], ['長靴', 'boots', '足', ['暈眩、凍結的時間 −10%', ['cc', 0.1]]], ['脛甲', 'shin', '脛骨', ['傷害減免 +6', ['stat', 'dr', 6]]], ['盾牌', 'shield', '鱗盾', ['受到的傷害 −3%', ['taken', 0.03, '']]]];
  var CS = [['戒指', 'ring', 6, '指環', ['造成的傷害 +2%', ['out', 0.02, '']]], ['項鍊', 'amulet', 5, '核心', ['最大 HP +3%', ['stat', 'mhpPct', 3]]], ['耳環', 'ear', 4, '耳語', ['魔防 +8', ['stat', 'mr', 8]]], ['腰帶', 'belt', 5, '束帶', ['受到的傷害 −2%', ['taken', 0.02, '']]]];
  var CATALOG_SLOT = { '匕首': '匕首', '單手劍': '單手劍', '雙手劍': '雙手劍', '武士刀': '武士刀', '單手鈍器': '單手鈍器', '雙手鈍器': '雙手鈍器', '矛': '矛', '弓': '弓', '魔杖': '魔杖', '奇古獸': '奇古獸', '十字弓': '十字弓', '鋼爪': '鋼爪', '雙刀': '雙刀', '鎖鏈劍': '鎖鏈劍', '頭盔': '頭盔', '盔甲': '盔甲', '內衣': '內衣', '斗篷': '斗篷', '手套': '手套', '長靴': '長靴', '脛甲': '脛甲', '盾牌': '盾牌|臂甲', '戒指': '戒指', '項鍊': '項鍊', '耳環': '耳環', '腰帶': '腰帶' };

  // ── 套裝（+3 抽） ──
  var SETS = [
    { k: 'rift', n: '裂隙行者', piece: ['對裂縫敵人傷害 +2%', ['out', 0.02, 'rift']], core: { n: '裂隙步', cd: 30, d: '每 30 秒侵蝕的 AC、魔防、抗性扣減 −150' }, six: ['侵蝕扣血每秒少 0.3%', ['erode', 0.3]], nine: ['取回力量 +5%', ['recover', 5]] },
    { k: 'eclipse', n: '星蝕', piece: ['爆擊傷害 +4%', ['stat', 'critDmg', 4]], core: { n: '星蝕', cd: 30, d: '每 30 秒下一次一般攻擊必定 ×2' }, six: ['爆擊率 +2%、爆擊傷害 +20%', ['stat', 'crit', 2], ['stat', 'critDmg', 20]], nine: ['爆擊打頭目時再 +15%', ['out', 0.15, 'bossCrit']] },
    { k: 'tide', n: '潮汐記憶', piece: ['受到的治療 +2%', ['healIn', 0.02]], core: { n: '潮汐', cd: 20, d: '每 20 秒回復 6% HP' }, six: ['每 5 秒回復 2% HP', ['regen', 0.02, 5]], nine: ['全隊受到的傷害 −8%', ['partyTaken', 0.08]] },
    { k: 'seam', n: '縫天', piece: ['命中時追加 20 真實傷害', ['flat', 20]], core: { n: '縫合', cd: 25, d: '每 25 秒對目標造成等於你最大 HP 100% 的真實傷害' }, six: ['每第 4 次攻擊傷害 ×2', ['everyN', 4, 2]], nine: ['受到的傷害 −8%', ['taken', 0.08, '']] },
    { k: 'fallen', n: '墜光', piece: ['對頭目傷害 +2%', ['out', 0.02, 'boss']], core: { n: '墜光', cd: 30, d: '每 30 秒光蝕 −2 層' }, six: ['對頭目傷害 +10%', ['out', 0.10, 'boss']], nine: ['受到頭目的傷害 −10%', ['taken', 0.10, 'boss']] },
    { k: 'endless', n: '無盡', piece: ['戰鬥中每分鐘造成的傷害 +0.5%（最多 +5%）', ['timeOut', 0.05]], core: { n: '無盡', cd: 60, d: '每 60 秒 15 秒內造成的傷害 +20%' }, six: ['戰鬥超過 2 分鐘後造成的傷害 +8%', ['long', 0.08]], nine: ['倒下時以 30% HP 站起（每 10 分鐘一次）', ['revive', 0.3, 600]] },
    { k: 'mirror', n: '倒影', piece: ['迴避 +1', ['stat', 'er', 1]], core: { n: '鏡返', cd: 20, d: '每 20 秒 3 秒內反彈 50% 受到的傷害' }, six: ['命中時 5% 機率複製該次傷害一次', ['copy', 0.05]], nine: ['受到傷害時 10% 機率完全迴避', ['dodge', 0.10]] },
    { k: 'ember', n: '燃燼', piece: ['火屬性抗性 +10', ['stat', 'resFire', 10]], core: { n: '燎原', cd: 15, d: '每 15 秒點燃全體敵人 5 秒（每秒你最近一擊 30%）' }, six: ['對燃燒中的目標傷害 +10%', ['out', 0.10, 'burn']], nine: ['燃燒傷害 ×2', ['burnX', 2]] },
    { k: 'ink', n: '深淵墨', piece: ['命中 +2', ['stat', 'hit', 2]], core: { n: '墨潮', cd: 20, d: '每 20 秒讓全體敵人中墨汁 5 秒（造成的傷害 −30%）' }, six: ['對有減益的目標傷害 +10%', ['out', 0.10, 'debuff']], nine: ['墨汁改為造成的傷害 −50%', ['inkX', 0.2]] },
    { k: 'pendulum', n: '鐘擺', piece: ['暈眩、凍結的時間 −5%', ['cc', 0.05]], core: { n: '停擺', cd: 30, d: '每 30 秒讓全體敵人暈眩 2 秒（頭目 0.5 秒）' }, six: ['每 20 秒下一擊傷害 ×3', ['cdHit', 20, 3]], nine: ['不會被暈眩、凍結（含時間停止）', ['cc', 1]] }
  ];
  var SETK = {}; SETS.forEach(function (s) { SETK[s.k] = s; });
  // ── 遺物絕技（+5 抽，同類） ──
  var ULT = {
    w: [{ k: 'collapse', n: '次元崩落', cd: 60, off: true, d: '每 60 秒，下一擊 ×12，同時對其他敵人造成那一擊的 50%' },
      { k: 'ladder', n: '斷羽天梯', cd: 45, off: true, d: '每 45 秒，接下來 5 擊各 ×3' },
      { k: 'stop', n: '時停', cd: 90, off: true, d: '每 90 秒讓全體敵人暈眩 3 秒（頭目 1 秒），8 秒內造成的傷害 +50%' },
      { k: 'tentacle', n: '深淵觸腕', cd: 40, off: true, d: '每 40 秒放出 8 道真實傷害，每道＝你最近一擊，隨機打在敵人身上' },
      { k: 'meteor', n: '星墜', cd: 75, off: true, d: '每 75 秒對全體敵人造成你最大 HP ×3 的真實傷害（頭目 ×1）' },
      { k: 'drill', n: '熔岩鑽頭', cd: 50, off: true, d: '每 50 秒讓目標燃燒 10 秒，每秒＝你最近一擊' }],
    a: [{ k: 'mirrorwall', n: '鏡面', cd: 60, d: '每 60 秒（有敵人時）4 秒內受到的傷害 −100%' },
      { k: 'song', n: '潮汐之歌', cd: 45, d: '每 45 秒（HP 低於 70% 時）全隊回復 40% HP' },
      { k: 'stitch', n: '縫合', cd: 120, d: 'HP 低於 30% 時自動回到 70%（120 秒冷卻）' },
      { k: 'nolight', n: '無光', cd: 60, d: '每 60 秒（有光蝕時）清除光蝕，6 秒內受到的傷害 −50%' },
      { k: 'death', n: '借來的死亡', cd: 300, d: '受到致命傷害時留下 1 HP、3 秒無敵（300 秒冷卻）' },
      { k: 'scale', n: '龍鱗', cd: 50, d: '每 50 秒（有敵人時）8 秒內受到的傷害 −40%、反彈 20%' }],
    c: [{ k: 'agent', n: '代理之人', cd: 120, off: true, d: '每 120 秒，15 秒內造成的傷害 +40%' },
      { k: 'horn', n: '號角', cd: 60, off: true, d: '每 60 秒，10 秒內全隊造成的傷害 +30%' },
      { k: 'stars', n: '群星', cd: 90, off: true, d: '每 90 秒，12 秒內爆擊的傷害再 ×1.5' },
      { k: 'sand', n: '時之沙', cd: 120, d: '每 120 秒（侵蝕超過 100 時）清除侵蝕的 AC、魔防、抗性扣減' }]
  };
  var ULTK = {}; ['w', 'a', 'c'].forEach(function (c) { ULT[c].forEach(function (u) { u.c = c; ULTK[u.k] = u; }); });

  // ── 物品 ──
  var CAT = {}; try { (W.AFK_RELIC_CATALOG || []).forEach(function (c) { (CAT[c.slot] = CAT[c.slot] || []).push(c); }); } catch (e) {}
  var nameToId = {}; Object.keys(DB.items).forEach(function (id) { var d = DB.items[id]; if (d && d.relic && d.n) nameToId[d.n] = nameToId[d.n] || id; });
  var templateOf = function (slotName) { var rx = new RegExp('^(' + CATALOG_SLOT[slotName] + ')$'), id = null; Object.keys(CAT).some(function (k) { if (!rx.test(k)) return false; return CAT[k].some(function (c) { var i = nameToId[c.name]; if (i && !DB.items[i].armguard) { id = i; return true; } return false; }); }); return id; };
  var reqUnion = function (slotName) { var rx = new RegExp('^(' + CATALOG_SLOT[slotName] + ')$'), set = {}, all = false; Object.keys(CAT).forEach(function (k) { if (!rx.test(k)) return; CAT[k].forEach(function (c) { var i = nameToId[c.name], q = i && DB.items[i].req; if (!q) return; if (q === 'all') all = true; else q.split(',').forEach(function (x) { set[x.trim()] = 1; }); }); }); return all ? 'all' : Object.keys(set).join(','); };
  var KEEP = ['type', 'slot', 'isBow', 'ranged', 'w2h', 'chainsword', 'qigu', 'isWand', 'req'];
  var LIST = [], BY = {};
  var mkItem = function (cat, slotName, idx, ch, part, p2) {
    var id = 'dimr_' + LIST.length, tpl = templateOf(slotName), base = tpl ? DB.items[tpl] : null, d = {};
    if (base) KEEP.forEach(function (k) { if (base[k] != null) d[k] = base[k]; });
    d.type = cat === 'w' ? 'wpn' : cat === 'a' ? 'arm' : 'acc';
    if (cat === 'w') { d.dmgS = 5; d.dmgL = 5; d.hit = 0; d.dmgBonus = 0; } else d.ac = cat === 'a' ? 5 : 2;
    if (cat !== 'w') d.req = 'all'; else d.req = reqUnion(slotName) || d.req || 'all';
    var th = TH[ch[1]][cat === 'w' ? 0 : cat === 'a' ? 1 : 2];
    d.n = ch[0] + '的' + part; d.p = 0; d.gachaWeight = 0; d.noEnhance = true; d.noSell = true; d.dimRelic = true; d.c = 'text-cyan-300'; d.weight = 0;
    d.img = (base && base.img) || IMG + '原石碎片.png';
    var row = { id: id, cat: cat, slotName: slotName, ch: ch, fx: [th[0], p2, null, th[1], null], tpl: tpl };
    d.d = '【次元遺物】' + ch[2] + '　' + ch[0] + '留在裂縫裡的' + part + '。\n+1：' + th[0][0] + '\n+2：' + p2[0] + '\n+3：隨機套裝\n+4：' + th[1][0] + '\n+5：隨機遺物絕技';
    DB.items[id] = d; LIST.push(row); BY[id] = row;
    try { if (tpl && typeof WEAPON_TAGS !== 'undefined' && WEAPON_TAGS[tpl]) WEAPON_TAGS[id] = WEAPON_TAGS[tpl].slice(); } catch (e) {}
    return row;
  };
  var ci = 0, nextCh = function (used) { for (var i = 0; i < CH.length; i++) { var c = CH[(ci + i) % CH.length]; if (!used[c[0]]) { ci = (ci + i + 1) % CH.length; used[c[0]] = 1; return c; } } return CH[(ci++) % CH.length]; };
  WT.forEach(function (w) { var used = {}; for (var i = 0; i < w[1]; i++) mkItem('w', w[0], i, nextCh(used), w[2], w[3]); });
  AS.forEach(function (a) { var used = {}; for (var i = 0; i < 10; i++) mkItem('a', a[0], i, nextCh(used), a[2], a[3]); });
  CS.forEach(function (c) { var used = {}; for (var i = 0; i < c[2]; i++) mkItem('c', c[0], i, nextCh(used), c[3], c[4]); });

  // 四龍專屬：次元時空・破／斬／解／序
  var DRG = ['破', '斬', '解', '序'], DRG_FX = [
    '對四大龍造成的傷害 +50%；無視龍之護甲',
    '對四大龍造成的傷害 +100%；無視龍之護甲；四龍房間傷害 −30%',
    '對四大龍造成的傷害 +150%；無視龍之護甲；四龍房間傷害 −50%；龍怒不會疊加',
    '對四大龍造成的傷害 +250%；無視龍之護甲；四龍房間傷害 −75%；龍怒不會疊加；每 30 秒對龍造成最大 HP 1% 的真實傷害'];
  var DRG_EVO = [null, { mirror: 3, frag: 30 }, { mirror: 5, frag: 60 }, { mirror: 10, frag: 100 }];
  var dragonTpl = templateOf('單手劍');
  DRG.forEach(function (x, i) {
    var id = 'dimr_dragon_' + i, b = dragonTpl ? DB.items[dragonTpl] : {}, d = { type: 'wpn', dmgS: 5, dmgL: 5, hit: 0, dmgBonus: 0, req: 'all', n: '次元時空・' + x, p: 0, gachaWeight: 0, noEnhance: true, noSell: true, dimRelic: true, dimDragon: i, c: 'text-fuchsia-300', weight: 0, img: b.img || IMG + '原石碎片.png' };
    d.d = '【次元遺物・四龍專屬】「龍的同意，是用時間換的。」只在四龍副本裡有效果：' + DRG_FX[i] + '。' + (i < 3 ? '\n用倒影之鏡 ×' + DRG_EVO[i + 1].mirror + '＋四龍的時空碎片 ×' + DRG_EVO[i + 1].frag + ' 進化成「次元時空・' + DRG[i + 1] + '」（次元的鍛造師）。' : '');
    DB.items[id] = d;
    try { if (dragonTpl && typeof WEAPON_TAGS !== 'undefined' && WEAPON_TAGS[dragonTpl]) WEAPON_TAGS[id] = WEAPON_TAGS[dragonTpl].slice(); } catch (e) {}
  });
  if (!DB.items[FRAG]) DB.items[FRAG] = { n: '四龍的時空碎片', type: 'etc', p: 0, gachaWeight: 0, weight: 0, noUse: true, noSell: true, c: 'text-fuchsia-300', img: IMG + '原石碎片.png', d: '四龍副本・裂縫的龍留下的時空碎片。用來把「次元時空」武器進化。（次元裂縫限定）' };

  // ── 幻聖紋（decisions-1107 1.8）：裝備中的聖紋在裂縫裡升成幻聖紋；原本的特效保留，再加一條新效果 ──
  var PHANTOM = { split: 1000, blood: 100 };
  var PH = {
    A: ['Ascend', '遠距離傷害 +6%', ['out', 0.06, 'ranged']], B: ['Bloom', '每 10 秒回復 2% HP', ['regen', 0.02, 10]], C: ['Crown', '對頭目傷害 +5%', ['out', 0.05, 'boss']],
    D: ['Doom', '對 HP 低於 30% 的目標傷害 +10%', ['out', 0.10, 'low30']], E: ['Eclipse', '爆擊傷害 +10%', ['stat', 'critDmg', 10]], F: ['Flame', '命中時 5% 機率點燃（每秒該次 20%，5 秒）', ['burn', 0.05, 0.2, 5]],
    G: ['Gate', '侵蝕扣血每秒少 0.1%', ['erode', 0.1]], H: ['Halo', '受到的治療 +8%', ['healIn', 0.08]], I: ['Ink', '命中時 4% 機率墨汁（目標傷害 −30%、5 秒）', ['ink', 0.04, 5]],
    J: ['Jade', '侵蝕最低保留 +15', ['floor', 15]], K: ['Keep', '受到的傷害 −3%', ['taken', 0.03, '']], L: ['Lumen', '對裂縫敵人傷害 +5%', ['out', 0.05, 'rift']],
    M: ['Mirage', '命中時 3% 機率複製該次傷害', ['copy', 0.03]], N: ['Night', '迴避 +3', ['stat', 'er', 3]], O: ['Oath', '全隊受到的傷害 −3%', ['partyTaken', 0.03]],
    P: ['Pierce', '命中時追加 40 真實傷害', ['flat', 40]], Q: ['Quake', '命中時 4% 機率對其他敵人造成該次 50%', ['aoe', 0.04, 0.5]], R: ['Rift', '對裂縫敵人傷害 +6%', ['out', 0.06, 'rift']],
    S: ['Star', '爆擊率 +1%', ['stat', 'crit', 1]], T: ['Tide', '吸血 1.5%', ['leech', 0.015]], U: ['Umbra', '受到頭目的傷害 −4%', ['taken', 0.04, 'boss']],
    V: ['Vow', '打倒怪物回復 2% HP', ['killHeal', 0.02]], W: ['Wing', '每第 6 次攻擊傷害 ×2', ['everyN', 6, 2]], X: ['Xeno', '每次攻擊追加目標最大 HP 0.2% 真實傷害（頭目 0.02%）', ['pctTrue', 0.002, 0.0002]],
    Y: ['Yield', '每 30 秒回復 8% MP', ['mp', 0.08, 30]], Z: ['Zenith', '每 20 秒下一擊傷害 ×2', ['cdHit', 20, 2]]
  };
  var sigilOf = function (p) { var e = p && p.eq && p.eq.sigil, m = e && /^afk_sigil_([A-Z])$/.exec(e.id); return m ? { it: e, L: m[1] } : null; };
  function phantomUp() { if (W.__afkCraftLock && W.__afkCraftLock.stop()) return;   // 暫停次元裂縫材料的製作（afk-craftlock）
    var p = P(), sg = sigilOf(p); if (!sg) { sys('<span class="text-amber-300">要先裝備聖紋。</span>'); return; } if (sg.it.phantom) return;
    if (!(W.__afkDimRiftOn && W.__afkDimRiftOn())) { sys('<span class="text-amber-300">要在次元裂縫裡才能升成幻聖紋。</span>'); return; }
    if (cnt('afk_split_dust') < PHANTOM.split || cnt(BLOOD) < PHANTOM.blood) { sys('<span class="text-amber-300">要分裂的蔑視塵埃 ' + PHANTOM.split + '＋血龍鑽 ' + PHANTOM.blood + '。</span>'); return; }
    take('afk_split_dust', PHANTOM.split); take(BLOOD, PHANTOM.blood); sg.it.phantom = 1;
    sys('<span class="font-bold" style="color:#c4b5fd">✦ 聖紋「' + sg.L + '」成了幻聖紋：多了「' + PH[sg.L][0] + '」——' + esc(PH[sg.L][1]) + '。</span>'); try { calcStats(); saveGame(); } catch (e) {}
  }

  // ── 身上的次元遺物 → 效果 ──
  var equipped = function (p) { var e = p && p.eq; if (!e) return []; return Object.keys(e).map(function (k) { return e[k]; }).filter(function (it) { return it && BY[it.id]; }); };
  var lv = function (it) { return Math.max(0, Math.min(5, Number(it.dimEn) || 0)); };
  var FX = null;
  var build = function (p) {
    var f = { out: [], taken: [], stat: {}, list: [], setN: {}, set9: {}, ults: [], cores: [] }, add = function (e) { f.list.push(e); };
    equipped(p).forEach(function (it) {
      var r = BY[it.id], n = lv(it);
      [0, 1, 3].forEach(function (i) { if (n >= i + 1) r.fx[i].slice(1).forEach(add); });
      if (n >= 3 && it.dimSet && SETK[it.dimSet]) { var s = SETK[it.dimSet]; s.piece.slice(1).forEach(add); f.setN[s.k] = (f.setN[s.k] || 0) + 1; if (n >= 5) f.set9[s.k] = (f.set9[s.k] || 0) + 1; }
      if (n >= 5 && it.dimUlt && ULTK[it.dimUlt]) f.ults.push(ULTK[it.dimUlt]);
    });
    var sg0 = sigilOf(p); if (sg0 && sg0.it.phantom && PH[sg0.L]) add(PH[sg0.L][2]);
    Object.keys(f.setN).forEach(function (k) { var s = SETK[k], c = f.setN[k]; if (c >= 3) f.cores.push(s.core); if (c >= 6) s.six.slice(1).forEach(add); if ((f.set9[k] || 0) >= 9) s.nine.slice(1).forEach(add); });
    var seenU = {}; f.ults = f.ults.filter(function (u) { if (seenU[u.k]) return false; seenU[u.k] = 1; return true; });
    var seenC = {}; f.cores = f.cores.filter(function (c) { if (seenC[c.n]) return false; seenC[c.n] = 1; return true; });
    f.sum = function (k) { return f.list.filter(function (e) { return e[0] === k; }); };
    f.v = function (k) { return f.sum(k).reduce(function (s, e) { return s + (Number(e[1]) || 0); }, 0); };
    return f;
  };
  var fx = function () { return FX || (FX = build(P())); };
  var dirty = function () { FX = null; };

  // ── 數值 ──
  var STATK = { critDmg: ['meleeCritDmg', 'rangedCritDmg', 'magicCritDmg'], crit: ['meleeCrit', 'rangedCrit', 'magicCrit'], hit: ['meleeHit', 'rangedHit', 'magicHit'], res5: ['resNone', 'resFire', 'resWater', 'resWind', 'resEarth'] };
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = P(); FX = build(p); if (!p || !p.d) return r; if (!p._allyName) { syncFlags(); syncSoul(); }
        FX.sum('stat').forEach(function (e) { if (e[1] === 'mhpPct') return; (STATK[e[1]] || [e[1]]).forEach(function (k) { p.d[k] = (Number(p.d[k]) || 0) + e[2]; }); });
        if (eDR) eDR[1] = Math.min(2, FX.v('erode')); if (eFL) eFL[1] = FX.v('floor');
      } catch (e) { console.warn('[AFK-dimrelic] stats', e); }
      return r;
    };
    try { (0, eval)('recomputeStats = window.recomputeStats'); } catch (e) {}
  }
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) { if (p !== P()) return; var pct = fx().sum('stat').filter(function (e) { return e[1] === 'mhpPct'; }).reduce(function (s, e) { return s + e[2]; }, 0); if (pct) p.mhp = Math.round(p.mhp * (1 + pct / 100)); });
  var DRm = W.__afkDimRift, eDR = null, eFL = null;
  if (DRm) {
    eDR = ['次元遺物', 0, function (p) { return p === P(); }]; DRm.REDUCE.push(eDR);
    eFL = ['次元遺物', 0, function (p) { return p === P(); }]; DRm.FLOOR.push(eFL);
    DRm.RECOVER.push(['次元遺物・裂隙行者', function (p) { return p === P() ? fx().v('recover') : 0; }]);
  }

  // ── 戰鬥狀態 ──
  var B = { hits: 0, lastHit: 0, tgt: null, same: 0, combatAt: 0, lastFight: 0, buffs: {}, cd: {}, next: [], tideUntil: 0, hurtCd: 0, bigCd: 0, reviveCd: 0 };
  var now = function () { return tk(); };
  var inRift = function () { try { return !!(W.__afkDimRiftOn && W.__afkDimRiftOn()); } catch (e) { return false; } };
  var hasDebuff = function (m) { var t = now(); return !!(m && ((m._dimInk || 0) > t || (m._dimBurn && m._dimBurn.until > t) || (m.st && ((m.st.stun || 0) > 0 || (m.st.freeze || 0) > 0)))); };
  var burning = function (m) { return !!(m && m._dimBurn && m._dimBurn.until > now()); };
  var condOk = function (c, m, opt, crit) {
    switch (c) {
      case '': return true; case 'rift': return inRift(); case 'boss': return !!(m && m.boss);
      case 'bossLow': return !!(m && m.boss && m.curHp < m.hp * 0.5); case 'low30': return !!(m && m.curHp < m.hp * 0.3);
      case 'burn': return burning(m); case 'debuff': return hasDebuff(m); case 'ranged': return opt && opt.kind === 'ranged'; case 'magic': return opt && opt.kind === 'magic';
      case 'bossCrit': return !!(m && m.boss && crit);
    } return false;
  };
  var hurtMob = function (m, v) {
    if (!m || m._dead || !(v > 0)) return; m.curHp -= Math.floor(v);
    if (m.curHp <= 0) { var i = mobs().indexOf(m); if (i >= 0) { m.curHp = 0; try { killMob(i); } catch (e) {} } }
  };
  var liveMobs = function () { return mobs().filter(function (m) { return m && !m._dead && m.curHp > 0 && !m.isAlly; }); };
  var buffOn = function (k) { return (B.buffs[k] || 0) > now(); };
  var dragonTier = function (p) { p = p || P(); var w = p && p.eq && p.eq.wpn, d = w && DB.items[w.id]; return d && d.dimDragon != null ? d.dimDragon : -1; };
  var inDragon = function () { try { var R = W.__afkRiftDg && W.__afkRiftDg.run(); if (R && R.id === 'dragons') return true; } catch (e) {} var s = S(); return !!s.antharas; };
  var isDragon = function (m) { return !!(m && /安塔瑞斯|法利昂|林德拜爾|巴拉卡斯/.test(m.n || '')); };
  W.__afkDimRelic = {
    LIST: LIST, BY: BY, SETS: SETS, ULT: ULT, fx: fx,
    dragonTier: function () { return inDragon() ? dragonTier() : -1; },
    roomCut: function () { var t = inDragon() ? dragonTier() : -1; return t >= 3 ? 0.75 : t === 2 ? 0.5 : t === 1 ? 0.3 : 0; },
    ignoreArmor: function () { return inDragon() && dragonTier() >= 0; },
    noFury: function () { return inDragon() && dragonTier() >= 2; }
  };

  // 造成的傷害
  var hooked = false;
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return hooked;
    var o = C.damage; hooked = true;
    C.damage = function (actor, target, amount, opt) {
      var p = P();
      try {
        if (p && actor === p && target && amount > 0 && !(opt && opt._dimNested)) {
          var f = fx(), crit = !!(opt && opt.packet && opt.packet.crit), normal = !!(opt && opt.packet), t = now(), mul = 1;
          B.lastFight = t; if (!B.combatAt) B.combatAt = t;
          f.sum('out').forEach(function (e) { if (condOk(e[2], target, opt, crit)) mul += e[1]; });
          // 越打越強
          if (B.tgt !== target) { B.tgt = target; B.same = Math.floor(B.same * (f.v('sameKeep') ? 0.5 : 0)); }
          B.same++; var sameCap = f.v('same'); if (sameCap) mul += Math.min(sameCap, Math.floor(B.same / 10) * 0.01);
          var mins = (t - B.combatAt) / 600, tOut = f.v('timeOut'); if (tOut) mul += Math.min(tOut, Math.floor(mins) * 0.01);
          if (f.v('long') && mins >= 2) mul += f.v('long');
          if (buffOn('agent')) mul += 0.4; if (buffOn('horn')) mul += 0.3; if (buffOn('stop')) mul += 0.5; if (buffOn('endless')) mul += 0.2;
          if (crit && buffOn('stars')) mul *= 1.5;
          // 四龍專屬
          var dt = dragonTier(p); if (dt >= 0 && inDragon() && isDragon(target)) mul += [0.5, 1, 1.5, 2.5][dt];
          if (normal) {
            B.hits++;
            if (f.sum('everyN').length) f.sum('everyN').forEach(function (e) { if (B.hits % e[1] === 0) mul *= e[2]; });
            f.sum('cdHit').forEach(function (e, i) { var key = 'cdh' + i; if (t >= (B.cd[key] || 0)) { B.cd[key] = t + e[1] * 10; mul *= e[2]; if (i === 0 && f.sum('cdStun').length && !target.boss) stunMob(target, 1); } });
            if (B.critNext) { mul *= B.critNext; B.critNext = 0; }
            if (B.next.length) mul *= B.next.shift();
            if (crit) f.sum('critNext').forEach(function (e) { if (Math.random() < e[1]) B.critNext = e[2]; });
          }
          amount = amount * mul;
          f.sum('flat').forEach(function (e) { amount += e[1]; });
          f.sum('pctTrue').forEach(function (e) { amount += (target.hp || 0) * (target.boss ? e[2] : e[1]); });
          B.lastHit = amount;
          // 命中後的觸發
          var after = amount;
          setTimeout(function () { try { onHit(p, target, after, opt, f); } catch (e) {} }, 0);
        }
      } catch (e) { console.warn('[AFK-dimrelic] out', e); }
      try { if (p && actor !== p && amount > 0 && buffOn('horn') && (p.allies || []).indexOf(actor) >= 0) amount *= 1.3; } catch (e) {}
      return o.call(this, actor, target, amount, opt);
    };
    return true;
  };
  var stunMob = function (m, sec) { try { var st = m.st || (m.st = {}); st.stun = Math.max(st.stun || 0, sec * 10); } catch (e) {} };
  function onHit(p, m, v, opt, f) {
    var t = now(), others = liveMobs().filter(function (x) { return x !== m; });
    if (B.collapse && opt && opt.packet) { B.collapse = 0; others.forEach(function (x) { hurtMob(x, v * 0.5); }); }
    f.sum('leech').forEach(function (e) { p.hp = Math.min(p.mhp, p.hp + Math.floor(v * e[1])); if (f.sum('tide').length) B.tideUntil = t + f.sum('tide')[0][1] * 10; });
    f.sum('aoe').forEach(function (e) { if (Math.random() < e[1]) { others.forEach(function (x) { hurtMob(x, v * e[2]); }); } });
    var chain = f.v('copyChain');
    f.sum('copy').forEach(function (e) { if (Math.random() < e[1]) { hurtMob(m, v); if (chain && Math.random() < chain) hurtMob(m, v); } });
    f.sum('stun').forEach(function (e) { if (!m.boss && Math.random() < e[1]) stunMob(m, e[2]); });
    f.sum('splash').forEach(function (e) { if (opt && opt.packet && others.length) hurtMob(others[0], v * e[1]); });
    var bx = f.v('burnX') || 1, stackMax = 1 + f.v('burnStack') - (f.sum('burnStack').length ? f.sum('burnStack').length : 0);
    f.sum('burn').forEach(function (e) { if (Math.random() < e[1]) { var b = m._dimBurn && m._dimBurn.until > t ? m._dimBurn : (m._dimBurn = { n: 0, per: 0, until: 0 }); b.n = Math.min(Math.max(1, stackMax), b.n + 1); b.per = Math.max(b.per, v * e[2] * bx); b.until = t + e[3] * 10; } });
    var inkX = f.v('inkX');
    f.sum('ink').forEach(function (e) { if (Math.random() < e[1]) { m._dimInk = t + e[2] * 10; m._dimInkK = 0.3 + inkX; } });
  }
  if (!hookDamage()) { try { document.addEventListener('DOMContentLoaded', hookDamage); } catch (e) {} }

  // 受到的傷害
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) {
    var p = P(); if (!p) return 1;
    if (ent !== p) { if (fx().v('partyTaken') && (p.allies || []).indexOf(ent) >= 0) return 1 - fx().v('partyTaken'); return 1; }
    var f = fx(), k = 1, t = now();
    f.sum('taken').forEach(function (e) { if (e[2] === '' || (e[2] === 'boss' && mob && mob.boss) || (e[2] === 'low30' && p.hp < p.mhp * 0.3)) k -= e[1]; });
    var tt = f.v('timeTaken'); if (tt && B.combatAt) k -= Math.min(tt, Math.floor((t - B.combatAt) / 300) * 0.01);
    if (B.tideUntil > t) k -= f.sum('tide').length ? f.sum('tide')[0][2] : 0;
    if (mob && (mob._dimInk || 0) > t) k -= (mob._dimInkK || 0.3) + f.v('inkTaken');
    if (f.v('partyTaken')) k -= f.v('partyTaken');
    if (buffOn('mirrorwall')) k = 0; if (buffOn('nolight')) k *= 0.5; if (buffOn('scale')) k *= 0.6; if (buffOn('invuln')) k = 0;
    if (f.v('dodge') && Math.random() < f.v('dodge')) k = 0;
    return Math.max(0, k);
  });
  var R = W.AFK_RELIC_RUNTIME;
  if (R && typeof R.incoming === 'function') {
    var oInc = R.incoming;
    R.incoming = function (target, damage, attacker, opts) {
      var out = oInc.apply(this, arguments);
      try {
        var p = P(); if (p && target === p && typeof out === 'number' && out > 0) {
          var f = fx(), t = now();
          if (f.sum('bigHit').length && out > p.mhp * 0.2 && t >= B.bigCd) { var bh = f.sum('bigHit')[0]; out *= 1 - bh[2]; B.bigCd = t + bh[3] * 10; }
          var refl = f.v('reflect') + (buffOn('scale') ? 0.2 : 0) + (buffOn('mirrorback') ? 0.5 : 0);
          if (attacker && attacker !== p && refl > 0 && attacker.curHp > 0 && !attacker.isAlly && mobs().indexOf(attacker) >= 0) hurtMob(attacker, out * refl);
          f.sum('thorn').forEach(function (e) { if (attacker && mobs().indexOf(attacker) >= 0 && Math.random() < e[1]) attacker._dimThorn = { until: t + e[4] * 10, pct: attacker.boss ? e[3] : e[2] }; });
          if (p.hp < p.mhp * 0.3 && t >= B.hurtCd) f.sum('hurtHeal').forEach(function (e) { if (Math.random() < e[1]) { p.hp = Math.min(p.mhp, p.hp + Math.floor(p.mhp * e[2])); B.hurtCd = t + e[3] * 10; } });
          if (out >= p.hp) {
            if (hasUlt('death') && ready('death')) { use('death'); out = Math.max(0, p.hp - 1); B.buffs.invuln = t + 30; clog(tag('借來的死亡') + '死亡被推遲了。'); }
            else if (f.sum('revive').length && t >= B.reviveCd) { var rv = f.sum('revive')[0]; B.reviveCd = t + rv[2] * 10; out = Math.max(0, p.hp - 1); setTimeout(function () { try { p.hp = Math.max(p.hp, Math.floor(p.mhp * rv[1])); } catch (e) {} }, 0); clog(tag('無盡') + '你又站了起來。'); }
          }
        }
      } catch (e) {}
      return out;
    };
  }
  if (typeof W.foulWaterHealMult === 'function') {
    var oFoul = W.foulWaterHealMult;
    W.foulWaterHealMult = function (target) { var m = oFoul.apply(this, arguments); try { if (target === P() && fx().v('healIn')) m *= 1 + fx().v('healIn'); } catch (e) {} return m; };
    try { (0, eval)('foulWaterHealMult = window.foulWaterHealMult'); } catch (e) {}
  }
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mobs()[idx], was = !!(m && m._dead), r = oKill.apply(this, arguments);
      try { var p = P(); if (p && m && !was && m._dead && !p.dead) { var kh = fx().v('killHeal'); if (kh) p.hp = Math.min(p.mhp, p.hp + Math.floor(p.mhp * kh)); dropDragon(m); var dr0 = drec(); if (dr0 && dr0.libEn && dr0.ero) { dr0.resBack = Math.min(dr0.ero, (dr0.resBack || 0) + 5 * dr0.libEn); } } } catch (e) {}
      return r;
    };
  }

  // ── 冷卻：核心技能、遺物絕技 ──
  var tag = function (s) { return '<span class="font-bold" style="color:#67e8f9">【' + s + '】</span>'; };
  var hasUlt = function (k) { return fx().ults.some(function (u) { return u.k === k; }); };
  var ready = function (k) { return now() >= (B.cd['u' + k] || 0); };
  var use = function (k, cd) { var u = ULTK[k]; B.cd['u' + k] = now() + (cd || (u && u.cd) || 60) * 10; };
  var party = function () { var p = P(); if (!p) return []; return [p].concat((p.allies || []).filter(function (a) { return a && !a._downed && a.curHp > 0; })); };
  var heal = function (x, pct) { if (x === P()) x.hp = Math.min(x.mhp, x.hp + Math.floor(x.mhp * pct)); else x.curHp = Math.min(x.mhp, (x.curHp || 0) + Math.floor(x.mhp * pct)); };
  var tgt = function () { try { var t = typeof getTarget === 'function' ? getTarget() : null; if (t && !t._dead && t.curHp > 0) return t; } catch (e) {} return liveMobs()[0]; };
  var drec = function () { try { return DRm && DRm.rec(P()); } catch (e) { return null; } };
  function castUlt(u) {
    var p = P(), t = now(), ms = liveMobs(), tg = tgt(), last = Math.max(1, B.lastHit || (p.d && p.d.meleeDmg) || 50);
    switch (u.k) {
      case 'collapse': if (!tg) return false; B.next.push(12); B.collapse = 1; break;
      case 'ladder': if (!tg) return false; B.next.push(3, 3, 3, 3, 3); break;
      case 'stop': if (!ms.length) return false; ms.forEach(function (m) { stunMob(m, m.boss ? 1 : 3); }); B.buffs.stop = t + 80; break;
      case 'tentacle': if (!ms.length) return false; for (var i = 0; i < 8; i++) hurtMob(ms[Math.floor(Math.random() * ms.length)], last); break;
      case 'meteor': if (!ms.length) return false; ms.forEach(function (m) { hurtMob(m, p.mhp * (m.boss ? 1 : 3)); }); break;
      case 'drill': if (!tg) return false; tg._dimBurn = { n: 1, per: last, until: t + 100 }; break;
      case 'mirrorwall': if (!ms.length) return false; B.buffs.mirrorwall = t + 40; break;
      case 'song': if (p.hp >= p.mhp * 0.7) return false; party().forEach(function (x) { heal(x, 0.4); }); break;
      case 'stitch': if (p.hp >= p.mhp * 0.3) return false; p.hp = Math.max(p.hp, Math.floor(p.mhp * 0.7)); break;
      case 'nolight': var r = drec(); if (!r || !(r.light > 0)) return false; r.light = 0; B.buffs.nolight = t + 60; try { calcStats(); } catch (e) {} break;
      case 'death': return false;
      case 'scale': if (!ms.length) return false; B.buffs.scale = t + 80; break;
      case 'agent': if (!ms.length) return false; B.buffs.agent = t + 150; break;
      case 'horn': if (!ms.length) return false; B.buffs.horn = t + 100; break;
      case 'stars': if (!ms.length) return false; B.buffs.stars = t + 120; break;
      case 'sand': var r2 = drec(); if (!r2 || !(r2.ero > 100)) return false; r2.ero = 0; try { calcStats(); } catch (e) {} break;
      default: return false;
    }
    use(u.k); clog(tag(u.n) + esc(u.d));
    return true;
  }
  function castCore(c) {
    var p = P(), t = now(), ms = liveMobs(), tg = tgt(), last = Math.max(1, B.lastHit || 50), key = 'c' + c.n;
    if (t < (B.cd[key] || 0)) return;
    var ok = true;
    switch (c.n) {
      case '裂隙步': var r = drec(); if (r && r.ero > 0) { r.ero = Math.max(0, r.ero - 150); /* Ping 11-13 14:41：−20 → −150（侵蝕改每秒 5 點後） */ try { calcStats(); } catch (e) {} } else ok = false; break;
      case '星蝕': if (tg) B.next.push(2); else ok = false; break;
      case '潮汐': if (p.hp < p.mhp) heal(p, 0.06); else ok = false; break;
      case '縫合': if (tg) hurtMob(tg, p.mhp); else ok = false; break;
      case '墜光': var r3 = drec(); if (r3 && r3.light > 0) { r3.light = Math.max(0, r3.light - 2); try { calcStats(); } catch (e) {} } else ok = false; break;
      case '無盡': if (ms.length) B.buffs.endless = t + 150; else ok = false; break;
      case '鏡返': if (ms.length) B.buffs.mirrorback = t + 30; else ok = false; break;
      case '燎原': if (ms.length) ms.forEach(function (m) { m._dimBurn = { n: 1, per: last * 0.3, until: t + 50 }; }); else ok = false; break;
      case '墨潮': if (ms.length) ms.forEach(function (m) { m._dimInk = t + 50; m._dimInkK = 0.3 + fx().v('inkX'); }); else ok = false; break;
      case '停擺': if (ms.length) ms.forEach(function (m) { stunMob(m, m.boss ? 0.5 : 2); }); else ok = false; break;
    }
    if (ok) B.cd[key] = t + c.cd * 10;
  }
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var t0 = tk(), r = oTick.apply(this, arguments);
      try {
        var p = P(), t = tk(); if (!p || t === t0) return r;
        if (p.dead || (typeof mapState !== 'undefined' && /^town/.test(mapState.current || ''))) { B.combatAt = 0; B.same = 0; B.tgt = null; }
        // 控制縮短
        var cc = Math.min(1, fx().v('cc')); if (cc && p.statuses) ['stun', 'freeze'].forEach(function (k) { if (p.statuses[k] > 0) { if (cc >= 1) p.statuses[k] = 0; else if (Math.random() < cc) p.statuses[k] = Math.max(0, p.statuses[k] - 1); } });
        if (t % 10 !== 0) return r;
        var f = fx(), sec = Math.floor(t / 10);
        if (p.dead) return r;
        if (!B.combatAt && liveMobs().length) B.combatAt = t;
        f.sum('regen').forEach(function (e) { if (sec % e[2] === 0) heal(p, e[1]); });
        f.sum('regenParty').forEach(function (e) { if (sec % e[2] === 0) party().forEach(function (x) { heal(x, e[1]); }); });
        f.sum('mp').forEach(function (e) { if (sec % e[2] === 0) p.mp = Math.min(p.mmp || 0, (p.mp || 0) + Math.floor((p.mmp || 0) * e[1])); });
        // 燃燒、反燒
        liveMobs().forEach(function (m) {
          if (m._dimBurn && m._dimBurn.until > t) hurtMob(m, m._dimBurn.per * (m._dimBurn.n || 1));
          if (m._dimThorn && m._dimThorn.until > t) hurtMob(m, (m.hp || 0) * m._dimThorn.pct);
        });
        // 四龍・序：每 30 秒龍 1% 真實
        if (dragonTier(p) >= 3 && inDragon() && sec % 30 === 0) liveMobs().filter(isDragon).forEach(function (m) { hurtMob(m, m.hp * 0.01); });
        if (!liveMobs().length && !f.ults.some(function (u) { return !u.off; })) return r;
        f.cores.forEach(castCore);
        f.ults.forEach(function (u) { if (ready(u.k)) castUlt(u); });
      } catch (e) { console.warn('[AFK-dimrelic] tick', e); }
      return r;
    };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }

  // ── 四龍掉落 ──
  function dropDragon(m) {
    try {
      var R2 = W.__afkRiftDg && W.__afkRiftDg.run(); if (!R2 || R2.id !== 'dragons' || !m._rdBoss) return;
      var n = 3 + Math.floor(Math.random() * 3); gainItem(FRAG, n, true, true);
      var got = '四龍的時空碎片 ×' + n;
      if (Math.random() < 0.1) { gainItem('dimr_dragon_0', 1, true, true); got += '、<b>' + esc(DB.items.dimr_dragon_0.n) + '</b>'; }
      sys('<span class="text-fuchsia-300">' + esc(m.n) + ' 留下了 ' + got + '。</span>');
    } catch (e) {}
  }

  // ── 次元支配（至高支配・封 武器解放）、縫天★、阿納金的號角 ──
  var LIB = { en: [10, 15, 20, 25, 50], rate: [100, 80, 60, 40, 100] };
  var WTYPES = WT.map(function (w) { return w[0]; });
  var wpnOf = function (p) { var w = p && p.eq && p.eq.wpn; return w && DB.items[w.id] ? w : null; };
  var isSup = function (it) { var d = it && DB.items[it.id]; return !!(d && d.type === 'wpn' && d.relicEvo != null); };
  var libMats = function () {
    var used = {}, out = {};
    WTYPES.forEach(function (t) { out[t] = inv().filter(function (x) { return x && !x.lock && !used[x.uid] && catalogSlot(x.id) === t; })[0] || null; if (out[t]) used[out[t].uid] = 1; });
    return out;
  };
  function liberate() {
    var p = P(), w = wpnOf(p); if (!w || !isSup(w)) { sys('<span class="text-amber-300">要先裝備「至高支配・封」的武器。</span>'); return; }
    if (w.dimLib) { sys('<span class="text-amber-300">已經是次元支配了。</span>'); return; }
    var m = libMats(), miss = WTYPES.filter(function (t) { return !m[t]; }); if (miss.length) { sys('<span class="text-amber-300">還缺 +0、未昇華的遺物：' + esc(miss.join('、')) + '。</span>'); return; }
    WTYPES.forEach(function (t) { var x = m[t], i = p.inv.indexOf(x); if (i >= 0) { if ((x.cnt || 1) > 1) x.cnt--; else p.inv.splice(i, 1); } });
    w.dimLib = 1; w.dimLibEn = 0;
    sys('<span class="font-bold" style="color:#67e8f9">✦ ' + esc(DB.items[w.id].n) + ' 掙開了封印——它成了「次元支配」。</span>'); syncFlags(); try { calcStats(); saveGame(); } catch (e) {}
  }
  function libEnhance() { if (W.__afkCraftLock && W.__afkCraftLock.stop()) return;   // 暫停次元裂縫材料的製作（afk-craftlock）
    var p = P(), w = wpnOf(p); if (!w || !w.dimLib) return; var n = w.dimLibEn || 0; if (n >= 5) return;
    var need = LIB.en[n]; if (cnt(DUST) < need) { sys('<span class="text-amber-300">異化星塵不夠（要 ' + need + '）。</span>'); return; }
    if (Math.random() * 100 >= LIB.rate[n]) { sys('<span class="text-amber-300">強化失敗了。（不降級、材料沒有被扣）</span>'); return; }
    take(DUST, need); w.dimLibEn = n + 1;
    sys('<span class="font-bold" style="color:#67e8f9">✦ 次元支配。縫天' + '★'.repeat(w.dimLibEn) + '</span>'); syncFlags(); try { calcStats(); saveGame(); } catch (e) {}
  }
  var HORN = { stone: 10, blood: 500, max: 3, block: [30, 40, 45, 50] };
  var STONES = ['afk_asc_stone_wpn', 'afk_asc_stone_arm', 'afk_asc_stone_acc'];
  var stoneCnt = function () { return STONES.reduce(function (s, id) { return s + cnt(id); }, 0); };
  var takeStones = function (n) { STONES.forEach(function (id) { var c = Math.min(n, cnt(id)); if (c > 0) { take(id, c); n -= c; } }); };
  function hornUp() { if (W.__afkCraftLock && W.__afkCraftLock.stop()) return;   // 暫停次元裂縫材料的製作（afk-craftlock）
    var p = P(), r = drec(); if (!p || !r) return; if (cnt('afk_anakin_horn') < 1 && !(p.eq && p.eq.horn)) { sys('<span class="text-amber-300">你還沒有阿納金的號角。</span>'); return; }
    var lvh = r.hornLv || 0; if (lvh >= HORN.max) return;
    if (stoneCnt() < HORN.stone || cnt(BLOOD) < HORN.blood) { sys('<span class="text-amber-300">要昇華支配強化石 ×' + HORN.stone + '＋血龍鑽 ' + HORN.blood + '。</span>'); return; }
    takeStones(HORN.stone); take(BLOOD, HORN.blood); r.hornLv = lvh + 1;
    sys('<span class="font-bold" style="color:#fde047">✦ 阿納金的號角 ' + r.hornLv + ' 級：次元裂縫裡聖十字之盾擋 ' + HORN.block[r.hornLv] + '%。</span>'); try { saveGame(); } catch (e) {}
  }
  function pickStone(k) { if (W.__afkCraftLock && W.__afkCraftLock.stop()) return;  if (cnt('afk_rd_pick') < 1 || STONES.indexOf(k) < 0) return; take('afk_rd_pick', 1); gainItem(k, 1, true, true); sys('<span style="color:#67e8f9">換到了 ' + esc(DB.items[k].n) + '。</span>'); }
  function syncFlags() { var p = P(), r = drec(); if (!p || !r) return; var w = wpnOf(p); r.dimWpn = !!(w && w.dimLib); r.athena = r.dimWpn; r.dimWpn5 = !!(w && w.dimLib && (w.dimLibEn || 0) >= 5); r.supWpn = !!(w && isSup(w) && !w.dimLib); r.libEn = w && w.dimLib ? (w.dimLibEn || 0) : 0; }

  // ── 裂縫淬鍊：席琳遺骸（夢域效果 ×1.2）、之魂憶起（decisions-1107 1.8） ──
  var SAND = 'afk_rd_sand', WATER = 'afk_rd_water';
  var REF = { remain: { water: 0, sand: 0, crystal: 100 }, soul: { sand: 30, water: 30 } };
  var SD = function () { return W.__afkSherineDream; };
  var remainsList = function () { var p = P(), sd = SD(); if (!p || !sd) return []; var out = []; Object.keys(p.eq || {}).forEach(function (k) { var e = p.eq[k], d = e && DB.items[e.id]; if (d && d.remains && e.id !== sd.SOUL && sd.isDream(e)) out.push({ it: e, eq: true }); }); (p.inv || []).forEach(function (e) { var d = e && DB.items[e.id]; if (d && d.remains && e.id !== sd.SOUL && sd.isDream(e) && !e.lock) out.push({ it: e, eq: false }); }); return out; };
  async function riftRefine(uid) { if (W.__afkCraftLock && W.__afkCraftLock.stop()) return;   // 暫停次元裂縫材料的製作（afk-craftlock）
    if(W.LineageSherineForge){try{return await W.LineageSherineForge.refine(uid);}catch(e){alert(e.message);return false;}}
    var x = remainsList().filter(function (r) { return r.it.uid === uid; })[0], c = REF.remain; if (!x || x.it.riftRef) return;
    if (cnt(WATER) < c.water || cnt(SAND) < c.sand || cnt(CRYSTAL) < c.crystal) { sys('<span class="text-amber-300">要席琳的水之記憶 ' + c.water + '、凝結的時之沙 ' + c.sand + '、次元結晶 ' + c.crystal + '。</span>'); return; }
    take(WATER, c.water); take(SAND, c.sand); take(CRYSTAL, c.crystal); x.it.riftRef = 1;
    sys('<span class="font-bold" style="color:#f87171">✦ ' + esc(DB.items[x.it.id].n) + ' 在裂縫裡被重新淬鍊了。</span>'); try { calcStats(); saveGame(); } catch (e) {}
  }
  var soulItem = function () { var p = P(), sd = SD(); var e = p && sd && p.eq && p.eq[sd.SOUL]; return e && sd.soulRefined && sd.soulRefined(p) ? e : null; };
  function soulMem() { if (W.__afkCraftLock && W.__afkCraftLock.stop()) return;   // 暫停次元裂縫材料的製作（afk-craftlock）
    var e = soulItem(), c = REF.soul; if (!e) { sys('<span class="text-amber-300">要裝著粹煉過的之魂。</span>'); return; } if (e.soulMem) return;
    if (cnt(SAND) < c.sand || cnt(WATER) < c.water) { sys('<span class="text-amber-300">要凝結的時之沙 ' + c.sand + '、席琳的水之記憶 ' + c.water + '。</span>'); return; }
    take(SAND, c.sand); take(WATER, c.water); e.soulMem = 1;
    sys('<span class="font-bold" style="color:#f87171">✦ 之魂想起來了。</span>'); syncSoul(); try { calcStats(); saveGame(); } catch (e2) {}
  }
  function syncSoul() { var r = drec(); if (!r) return; var e = soulItem(); r.soulMem = !!(e && e.soulMem); }

  // ── 阿納金的號角：裝備視窗第二頁「聖紋下面、之鱗上面」那一格（底圖本來就有框，核心沒有欄位；這裡在畫完裝備格後補一顆） ──
  (function () {
    var HID = 'afk_anakin_horn', d = DB.items[HID]; if (!d) return;
    d.type = 'acc'; d.slot = 'horn'; d.req = 'all'; d.ac = 0; d.noEnhance = true; d.noSell = true; d.noTrade = true; d.safe = 0;
    d.d = '墮光天使 阿納金第一次被擊倒第五形態時留下的號角。裝在裝備視窗第二頁「聖紋下面、之鱗上面」那一格。在「次元的鍛造師」強化（最多 3 級）：次元裂縫裡聖十字之盾擋下的侵蝕 30% → 40／45／50%。';
    try { if (typeof ITEM_WEIGHTS !== 'undefined' && ITEM_WEIGHTS[d.n] == null) ITEM_WEIGHTS[d.n] = 0; } catch (e) {}
    var owns = function (p) { return !!(p && ((p.eq && p.eq.horn) || (p.inv || []).some(function (x) { return x && x.id === HID; }))); };
    var paint = function (host) {
      var p = P(); if (!p || p.classicMode || !host || host.querySelector('.afk-horn-slot')) return;
      var page2 = Array.prototype.some.call(host.children, function (c) { return /left:\s*80\.1%/.test(c.style.cssText) && /top:\s*15\.81%/.test(c.style.cssText); });
      if (!page2 || !owns(p)) return;
      var item = p.eq.horn, data = item && DB.items[item.id], b = document.createElement('button');
      b.type = 'button'; b.className = 'equipment-visual-slot afk-horn-slot ' + (item ? 'is-filled' : 'is-empty');
      b.style.cssText = 'left:50%;top:42.77%;width:19.67%;height:8.82%;';
      if (item && data) {
        var img = document.createElement('img'); img.src = typeof getIconUrl === 'function' ? getIconUrl(data) : data.img; img.alt = data.n; img.draggable = false; b.appendChild(img);
        var e = document.createElement('span'); e.className = 'equipment-slot-equipped'; e.textContent = 'E'; e.setAttribute('aria-hidden', 'true'); b.appendChild(e);
        var lv0 = (drec() || {}).hornLv || 0; if (lv0) { var bg = document.createElement('span'); bg.className = 'equipment-slot-enhance'; bg.textContent = '+' + lv0; b.appendChild(bg); }
        b.classList.add('tip-host'); b.setAttribute('data-tip-uid', item.uid); b.setAttribute('data-tip-src', 'eq');
        b.onclick = function () { try { openModal(item, true, 'horn'); } catch (er) {} };
      } else { var lb = document.createElement('span'); lb.className = 'equipment-slot-lbl'; lb.textContent = '號角'; b.appendChild(lb); b.title = '阿納金的號角'; }
      host.appendChild(b);
    };
    var watch = function () {
      var host = document.getElementById('equipment-window-slots'); if (!host || host.__afkHorn) return !!host;
      host.__afkHorn = true; new MutationObserver(function () { paint(host); }).observe(host, { childList: true }); paint(host); return true;
    };
    if (!watch()) { var iv = setInterval(function () { if (watch()) clearInterval(iv); }, 1000); }
  })();

  // ── 鍛造師 ──
  var inv = function () { var p = P(); return (p && p.inv) || []; };
  var findUid = function (uid) { var p = P(); if (!p) return null; var a = inv().filter(function (x) { return x && x.uid === uid; })[0]; if (a) return a; var e = p.eq || {}; return Object.keys(e).map(function (k) { return e[k]; }).filter(function (x) { return x && x.uid === uid; })[0] || null; };
  var catalogSlot = function (id) { var d = DB.items[id]; if (!d || !d.relic || d.relicPlus != null || d.relicAsc != null) return null; var c = (W.AFK_RELIC_CATALOG || []).filter(function (x) { return x.name === d.n; })[0]; return c ? c.slot : null; };
  var mySlot = function (row) { return row.slotName === '盾牌' ? /^(盾牌|臂甲)$/ : new RegExp('^' + row.slotName + '$'); };
  var mats = function (uid) { var a = inv().filter(function (x) { return x && !x.lock && catalogSlot(x.id); }); return uid ? a.filter(function (x) { return x.uid === uid; })[0] : a; };
  var newInst = function (id) { var p = P(), before = inv().length; gainItem(id, 1, true, true); var it = inv()[inv().length - 1]; if (!it || it.id !== id) it = inv().filter(function (x) { return x && x.id === id && !x.dimEn && !x._dimNew; }).pop(); return it; };
  function craft(srcUid, dimId) { if (W.__afkCraftLock && W.__afkCraftLock.stop()) return;   // 暫停次元裂縫材料的製作（afk-craftlock）
    var src = mats(srcUid), row = BY[dimId]; if (!src || !row) return;
    var sl = catalogSlot(src.id); if (!mySlot(row).test(sl)) { sys('<span class="text-amber-300">部位不同，不能做成這一件。</span>'); return; }
    if (cnt(CRYSTAL) < COST.craft) { sys('<span class="text-amber-300">次元結晶不夠（要 ' + COST.craft + '）。</span>'); return; }
    take(CRYSTAL, COST.craft);
    var p = P(), i = p.inv.indexOf(src); if (i >= 0) { if ((src.cnt || 1) > 1) src.cnt--; else p.inv.splice(i, 1); }
    var it = newInst(dimId); if (it) { it.dimEn = 0; }
    sys('<span class="font-bold" style="color:#67e8f9">✦ ' + esc(DB.items[src.id].n) + ' 被裂縫的光吞了進去——出來的是「' + esc(DB.items[dimId].n) + '」。</span>');
    try { saveGame(); } catch (e) {}
  }
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  function enhance(uid) { if (W.__afkCraftLock && W.__afkCraftLock.stop()) return;   // 暫停次元裂縫材料的製作（afk-craftlock）
    var it = findUid(uid); if (!it || !BY[it.id]) return; var n = lv(it); if (n >= 5) return;
    var need = COST.en[n]; if (cnt(DUST) < need) { sys('<span class="text-amber-300">異化星塵不夠（要 ' + need + '）。</span>'); return; }
    if (Math.random() * 100 >= COST.rate[n]) { sys('<span class="text-amber-300">強化失敗了。（不降級、材料沒有被扣）</span>'); return; }
    take(DUST, need); it.dimEn = n + 1; try { if (W.__afkAcStamp) W.__afkAcStamp(it); } catch (e) {}
    var msg = '「' + esc(DB.items[it.id].n) + '」強化到 +' + it.dimEn + '。';
    if (it.dimEn === 3 && !it.dimSet) { it.dimSet = pick(SETS).k; msg += '套裝：<b>' + esc(SETK[it.dimSet].n) + '</b>。'; }
    if (it.dimEn === 5 && !it.dimUlt) { it.dimUlt = pick(ULT[BY[it.id].cat]).k; msg += '遺物絕技：<b>' + esc(ULTK[it.dimUlt].n) + '</b>。'; }
    sys('<span class="font-bold" style="color:#67e8f9">✦ ' + msg + '</span>'); try { calcStats(); saveGame(); } catch (e) {}
  }
  function reroll(uid, what) { if (W.__afkCraftLock && W.__afkCraftLock.stop()) return;   // 暫停次元裂縫材料的製作（afk-craftlock）
    var it = findUid(uid); if (!it || !BY[it.id]) return;
    if (cnt(MIRROR) < COST.reroll) { sys('<span class="text-amber-300">倒影之鏡不夠。</span>'); return; }
    if (what === 'set' && lv(it) >= 3) { take(MIRROR, 1); var o = it.dimSet; it.dimSet = pick(SETS.filter(function (s) { return s.k !== o; })).k; sys('<span style="color:#67e8f9">套裝重抽：<b>' + esc(SETK[it.dimSet].n) + '</b>。</span>'); }
    else if (what === 'ult' && lv(it) >= 5) { take(MIRROR, 1); var o2 = it.dimUlt; it.dimUlt = pick(ULT[BY[it.id].cat].filter(function (u) { return u.k !== o2; })).k; sys('<span style="color:#67e8f9">遺物絕技重抽：<b>' + esc(ULTK[it.dimUlt].n) + '</b>。</span>'); }
    try { calcStats(); saveGame(); } catch (e) {}
  }
  function synth(n) { if (W.__afkCraftLock && W.__afkCraftLock.stop()) return;   // 暫停次元裂縫材料的製作（afk-craftlock）
    n = Math.max(1, n | 0); var s = COST.synth;
    var can = Math.min(n, Math.floor(cnt(STARDUST) / s.star), Math.floor(cnt(BLOOD) / s.blood)); if (can < 1) { sys('<span class="text-amber-300">要破碎星光塵埃 ' + s.star + '＋血龍鑽 ' + s.blood + '。</span>'); return; }
    take(STARDUST, s.star * can); take(BLOOD, s.blood * can); gainItem(DUST, can, true, true);
    sys('<span style="color:#67e8f9">合成了異化星塵 ×' + can + '。</span>');
  }
  function evolveDragon(uid) { if (W.__afkCraftLock && W.__afkCraftLock.stop()) return;   // 暫停次元裂縫材料的製作（afk-craftlock）
    var it = findUid(uid), d = it && DB.items[it.id]; if (!d || d.dimDragon == null || d.dimDragon >= 3) return;
    var need = DRG_EVO[d.dimDragon + 1]; if (cnt(MIRROR) < need.mirror || cnt(FRAG) < need.frag) { sys('<span class="text-amber-300">要倒影之鏡 ×' + need.mirror + '＋四龍的時空碎片 ×' + need.frag + '。</span>'); return; }
    take(MIRROR, need.mirror); take(FRAG, need.frag); it.id = 'dimr_dragon_' + (d.dimDragon + 1); try { if (W.__afkAcStamp) W.__afkAcStamp(it); } catch (e) {}
    sys('<span class="font-bold" style="color:#f0abfc">✦ 次元時空進化成「' + esc(DB.items[it.id].n) + '」。</span>'); try { calcStats(); saveGame(); } catch (e) {}
  }
  var fxText = function (row, it) {
    var n = it ? lv(it) : 0, lines = [];
    [['+1', row.fx[0]], ['+2', row.fx[1]], ['+3', null], ['+4', row.fx[3]], ['+5', null]].forEach(function (x, i) {
      var on = n >= i + 1, txt;
      if (i === 2) txt = it && it.dimSet ? '套裝「' + SETK[it.dimSet].n + '」：' + SETK[it.dimSet].piece[0] : '隨機套裝';
      else if (i === 4) txt = it && it.dimUlt ? '遺物絕技「' + ULTK[it.dimUlt].n + '」：' + ULTK[it.dimUlt].d : '隨機遺物絕技';
      else txt = x[1][0];
      lines.push('<span style="color:' + (on ? '#a5f3fc' : '#64748b') + '">' + x[0] + '　' + esc(txt) + '</span>');
    });
    return lines.join('<br>');
  };
  var VIEW = { tab: 'mine', slot: '' };
  // 分頁：上排是次元遺物本身，下排是其他裂縫裝備
  var TABS = [
    ['次元遺物', [['mine', '我的次元遺物'], ['craft', '製作'], ['sets', '套裝與遺物絕技'], ['synth', '異化星塵']]],
    ['裂縫裝備', [['lib', '次元支配'], ['ref', '裂縫淬鍊'], ['phantom', '幻聖紋'], ['horn', '阿納金的號角'], ['dragon', '次元時空'], ['sherine', '席琳界約']]]
  ];
  var TAB_INFO = {
    mine: ['強化、重抽你身上與背包裡的次元遺物。', '強化用異化星塵，失敗不降級、不扣材料。+3 隨機得到一種套裝，+5 隨機得到一招遺物絕技；不喜歡可以用倒影之鏡重抽。', [DUST, MIRROR]],
    craft: ['把一件 +0 遺物丟進裂縫，換成同部位的次元遺物。', '① 先在清單裡選一件 +0、沒有昇華、沒上鎖的遺物　② 再選要做成哪一件。每件次元結晶 ' + COST.craft + '。', [CRYSTAL]],
    sets: ['次元遺物 +3 與 +5 會抽到的效果一覽。', '套裝看同一套的件數生效；遺物絕技每個部位類別各有一組可以抽。', []],
    synth: ['用破碎星光塵埃與血龍鑽合成強化用的異化星塵。', '', [STARDUST, BLOOD, DUST]],
    lib: ['把裝備中的「至高支配・封」武器解放成次元支配，再用縫天★強化。', '', [DUST]],
    ref: ['讓之魂與夢域淬鍊過的席琳遺骸，在次元裂縫裡更好用。', '', [SAND, WATER, CRYSTAL]],
    phantom: ['在次元裂縫裡，把裝備中的聖紋升成幻聖紋。', '', ['afk_split_dust', BLOOD]],
    horn: ['強化阿納金的號角，換自選的昇華支配強化石。', '', ['afk_anakin_horn', 'afk_rd_pick', BLOOD]],
    dragon: ['四龍副本・裂縫掉落的次元時空，在這裡進化。', '', [MIRROR, FRAG]],
    sherine: ['把舊系與新系的席琳遺骸混搭，締結新舊界約。', '材料與混搭規則可以展開下面的說明。', [CRYSTAL]]
  };
  var tabName = function (k) { var n = ''; TABS.forEach(function (g) { g[1].forEach(function (t) { if (t[0] === k) n = t[1]; }); }); return n; };
  var reqBtn = function (have, need, label) { return K.reqTxt(have, need, label); };
  var paint = function (div) {
    var box = div.querySelector('#afk-dimr'); if (!box) return; var p = P(); if (!p) return;
    var info = TAB_INFO[VIEW.tab] || TAB_INFO.mine;
    var h = '<p class="ax-lore">「裂縫裡的東西都記得自己是誰。」鍛造師的爐子裡沒有火，只有一道一直在呼吸的縫。</p>';
    h += TABS.map(function (g) { return '<div class="ax-filter" style="align-items:center"><span class="ax-where" style="min-width:4.5em">' + g[0] + '</span>' + g[1].map(function (t) { return '<button type="button" data-dr="tab:' + t[0] + '"' + (VIEW.tab === t[0] ? ' class="on"' : '') + '>' + t[1] + '</button>'; }).join('') + '</div>'; }).join('');
    h += '<div class="ax-h">' + esc(tabName(VIEW.tab)) + '</div><div class="ax-desc" style="margin-bottom:4px">' + esc(info[0]) + '</div>' + (info[1] ? '<div class="ax-note" style="margin-bottom:8px">' + esc(info[1]) + '</div>' : '');
    var ml = info[2].filter(function (id) { return DB.items[id]; });
    if (ml.length) h += '<div style="margin-bottom:10px">' + K.matBar(ml) + '</div>';
    if (VIEW.tab === 'sherine') { K.repaint(box,h);if(W.LineageSherineForge)W.LineageSherineForge.mount(box);return; }
    if (VIEW.tab === 'mine') {
      var eqd = equipped(p), mine = eqd.concat(inv().filter(function (x) { return x && BY[x.id]; }));
      if (!mine.length) h += '<div class="ax-row off"><div class="ax-main"><div class="ax-desc">你還沒有次元遺物。到「製作」分頁，用一件 +0 遺物＋次元結晶 ' + COST.craft + ' 做第一件。</div></div><div class="ax-act"><button type="button" data-dr="tab:craft">去製作</button></div></div>';
      mine.forEach(function (it) {
        var row = BY[it.id], n = lv(it), on = eqd.indexOf(it) >= 0, btns = [], req = '';
        if (n < 5) { btns.push(['en:' + it.uid, '強化 +' + (n + 1) + '（' + COST.rate[n] + '%）', cnt(DUST) >= COST.en[n]]); req = reqBtn(cnt(DUST), COST.en[n], '異化星塵'); }
        if (n >= 3) btns.push(['rs:' + it.uid, '重抽套裝', cnt(MIRROR) >= 1]);
        if (n >= 5) btns.push(['ru:' + it.uid, '重抽遺物絕技', cnt(MIRROR) >= 1]);
        h += K.rowHtml({ key: it.uid, ico: K.invIco(it, on ? 'eq' : 'inv'), name: esc(DB.items[it.id].n) + '　<span style="color:#fde68a">+' + n + '</span>' + (on ? '　<span style="color:#86efac;font-size:13px">裝備中</span>' : ''), color: '#67e8f9', desc: esc(row.slotName) + '・' + esc(row.ch[2]), note: fxText(row, it), req: req, btns: btns }, 'data-dr');
      });
      var f = fx(), sets = Object.keys(f.setN);
      if (sets.length || f.ults.length) h += '<div class="ax-h">現在生效</div><div class="ax-sel" style="display:block">' + (sets.length ? '<ul>' + sets.map(function (k) { var s = SETK[k], c = f.setN[k], c9 = f.set9[k] || 0; return '<li><b style="color:#67e8f9">' + esc(s.n) + '</b> ' + c + ' 件' + (c >= 3 ? '・核心「' + esc(s.core.n) + '」' : '') + (c >= 6 ? '・六件' : '') + (c9 >= 9 ? '・九件' : '') + '</li>'; }).join('') + '</ul>' : '') + (f.ults.length ? '<div class="ax-desc" style="margin-top:4px">遺物絕技：' + f.ults.map(function (u) { return esc(u.n); }).join('、') + '</div>' : '') + '</div>';
    } else if (VIEW.tab === 'craft') {
      var ms = mats();
      h += '<div class="ax-h" style="margin-top:4px">① 選一件 +0 遺物</div><div class="ax-list">';
      if (!ms.length) h += '<div class="ax-eq ax-where">背包裡沒有可以用的 +0、未昇華遺物（上鎖的不算）。</div>';
      ms.slice(0, 80).forEach(function (x) { h += '<div class="ax-eq' + (VIEW.src === x.uid ? ' on' : '') + '" data-dr="src:' + esc(x.uid) + '">' + K.invIco(x, 'inv', true) + '<div style="min-width:0"><div>' + K.fullName(x) + '</div><div class="ax-where">' + esc(catalogSlot(x.id)) + '</div></div></div>'; });
      if (ms.length > 80) h += '<div class="ax-eq ax-where">還有 ' + (ms.length - 80) + ' 件沒列出（先用掉或上鎖不用的）。</div>';
      h += '</div>';
      var s0 = VIEW.src && mats(VIEW.src);
      if (s0) {
        var sl0 = catalogSlot(s0.id);
        h += '<div class="ax-h">已選擇</div><div class="ax-sel">' + K.invIco(s0, 'inv') + '<div style="min-width:0"><div>' + K.fullName(s0) + '</div><div class="ax-where">' + esc(sl0) + '・製作後這件會消失</div></div></div>';
        h += '<div class="ax-h">② 要做成哪一件</div>';
        LIST.filter(function (r) { return mySlot(r).test(sl0); }).forEach(function (r) { h += K.rowHtml({ key: r.id, ico: K.itemIco(r.id), name: esc(DB.items[r.id].n), color: '#67e8f9', desc: esc(r.slotName) + '・' + esc(r.ch[2]), note: fxText(r, null), req: reqBtn(cnt(CRYSTAL), COST.craft, '次元結晶'), btns: [['mk:' + s0.uid + ':' + r.id, '製作', cnt(CRYSTAL) >= COST.craft]] }, 'data-dr'); });
      }
    } else if (VIEW.tab === 'sets') {
      h += '<div class="ax-h" style="margin-top:4px">套裝（+3 隨機一種）</div>';
      SETS.forEach(function (st) { h += K.rowHtml({ key: st.k, name: esc(st.n), color: '#67e8f9', desc: '每件：' + esc(st.piece[0]), note: '3 件・核心「' + esc(st.core.n) + '」：' + esc(st.core.d) + '<br>6 件：' + esc(st.six[0]) + '<br>9 件（都 +5）：' + esc(st.nine[0]), btns: [] }, 'data-dr'); });
      [['w', '武器'], ['a', '防具'], ['c', '飾品']].forEach(function (c) { h += '<div class="ax-h">遺物絕技・' + c[1] + '（+5 隨機一招）</div>' + ULT[c[0]].map(function (u) { return K.rowHtml({ key: u.k, name: esc(u.n), color: '#f0abfc', desc: esc(u.d), btns: [] }, 'data-dr'); }).join(''); });
    } else if (VIEW.tab === 'lib') {
      var w = wpnOf(p), mt = libMats();
      h += '<ul class="ax-note dr-ul"><li><b>解放材料</b>：14 種武器遺物各 1 件（+0、未昇華、背包裡沒上鎖的）；不用龍鑽、金幣，100% 成功；保留強化值、星數、雅典娜的祝福。</li><li><b>次元裂縫裡</b>：次元支配武器效果完整、對裂縫敵人傷害 +30%，並得到雅典娜的祝福（抵銷裂縫傷害懲罰 15%）；沒解放的至高支配・封武器效果打折（造成的傷害 −10%）。</li><li><b>縫天★</b>：異化星塵 ' + LIB.en.join('／') + '，成功率 ' + LIB.rate.join('／') + '%（失敗不降級、不扣材料）；每一顆星打倒怪物恢復 5 點五屬性抗性，★5 侵蝕最低保留 +100。</li></ul>';
      if (!w) h += K.rowHtml({ key: 'lib', name: '沒有裝備武器', color: '#94a3b8', desc: '先裝上「至高支配・封」武器再來。', off: true, btns: [] }, 'data-dr');
      else if (!isSup(w)) h += K.rowHtml({ key: 'lib', ico: K.invIco(w, 'eq'), name: K.fullName(w), desc: '裝備中的這把不是「至高支配・封」，不能解放。', off: true, btns: [] }, 'data-dr');
      else if (!w.dimLib) {
        h += '<div class="ax-h">解放材料（14 種武器遺物）</div><div class="ax-socks" style="margin-bottom:10px">' + WTYPES.map(function (t) { return '<span class="ax-sock ' + (mt[t] ? 'filled' : '') + '">' + (mt[t] ? '✓ ' : '✗ ') + esc(t) + '</span>'; }).join('') + '</div>';
        var nOk = WTYPES.filter(function (t) { return mt[t]; }).length;
        h += K.rowHtml({ key: 'lib', ico: K.invIco(w, 'eq'), name: K.fullName(w), color: '#fde047', desc: '至高支配・封 → 次元支配', req: K.reqTxt(nOk, WTYPES.length, '種武器遺物'), btns: [['lib:', '解放', nOk === WTYPES.length]] }, 'data-dr');
      } else {
        var ln = w.dimLibEn || 0;
        h += K.rowHtml({ key: 'lib', ico: K.invIco(w, 'eq'), name: K.fullName(w), color: '#67e8f9', desc: '次元支配　縫天 ' + ('★'.repeat(ln) || '（無星）') + ('☆'.repeat(5 - ln)), req: ln < 5 ? K.reqTxt(cnt(DUST), LIB.en[ln], '異化星塵') : '', note: ln < 5 ? '下一顆星成功率 ' + LIB.rate[ln] + '%' : '已經是 ★5', btns: ln < 5 ? [['len:', '縫天 ★' + (ln + 1), cnt(DUST) >= LIB.en[ln]]] : [] }, 'data-dr');
      }
    } else if (VIEW.tab === 'ref') {
      var c1 = REF.remain, c2 = REF.soul, se = soulItem();
      h += '<div class="ax-h" style="margin-top:4px">之魂憶起</div>' + K.rowHtml({ key: 'soul', ico: se ? K.invIco(se, 'eq') : '', name: se ? esc(DB.items[se.id].n) + (se.soulMem ? '　<span style="color:#86efac;font-size:13px">已憶起</span>' : '') : '要裝著粹煉過的之魂', color: '#f87171', desc: '次元裂縫裡：裁決之光的門檻 −5%（HP 低於 45% 才會被打到剩 1）、侵蝕扣血每秒少 0.5%；跟太陽神凱布利一起有時，取回力量 +5%。', req: se && !se.soulMem ? K.reqTxt(cnt(SAND), c2.sand, '時之沙') + '　' + K.reqTxt(cnt(WATER), c2.water, '水之記憶') : '', off: !se, btns: se && !se.soulMem ? [['soul:', '憶起', cnt(SAND) >= c2.sand && cnt(WATER) >= c2.water]] : [] }, 'data-dr');
      h += '<div class="ax-h">席琳遺骸的裂縫淬鍊</div><div class="ax-note" style="margin-bottom:8px">夢域淬鍊過的遺骸才能做。同一組某一段的件數都裂縫淬鍊過，那一段的夢域效果 ×1.2。</div>';
      var rl = remainsList(); if (!rl.length) h += K.rowHtml({ key: 'nr', name: '沒有夢域淬鍊過的遺骸', color: '#94a3b8', off: true, btns: [] }, 'data-dr');
      var refReq = K.reqTxt(cnt(CRYSTAL), c1.crystal, '次元結晶') + (c1.water ? '　' + K.reqTxt(cnt(WATER), c1.water, '水之記憶') : '') + (c1.sand ? '　' + K.reqTxt(cnt(SAND), c1.sand, '時之沙') : '');
      rl.forEach(function (x) { h += K.rowHtml({ key: x.it.uid, ico: K.invIco(x.it, x.eq ? 'eq' : 'inv'), name: K.fullName(x.it), color: '#f87171', desc: (x.eq ? '裝備中' : '背包') + (x.it.riftRef ? '・<span style="color:#86efac">已裂縫淬鍊</span>' : ''), req: x.it.riftRef ? '' : refReq, btns: x.it.riftRef ? [] : [['rr:' + x.it.uid, '裂縫淬鍊', cnt(WATER) >= c1.water && cnt(SAND) >= c1.sand && cnt(CRYSTAL) >= c1.crystal]] }, 'data-dr'); });
    } else if (VIEW.tab === 'phantom') {
      var sg = sigilOf(p);
      h += K.rowHtml({ key: 'ph', ico: sg ? K.invIco(sg.it, 'eq') : '', name: sg ? '聖紋「' + sg.L + '」' + (sg.it.phantom ? '　<span style="color:#86efac;font-size:13px">已是幻聖紋</span>' : '') : '沒有裝備聖紋', color: '#c4b5fd', desc: sg ? '升成幻聖紋「' + PH[sg.L][0] + '」：' + esc(PH[sg.L][1]) : '先在裝備視窗第二頁裝上聖紋。', note: '原本的特效保留，再多一條新效果；只在次元裂縫裡生效。', req: sg && !sg.it.phantom ? K.reqTxt(cnt('afk_split_dust'), PHANTOM.split, '分裂的蔑視塵埃') + '　' + K.reqTxt(cnt(BLOOD), PHANTOM.blood, '血龍鑽') : '', off: !sg, btns: sg && !sg.it.phantom ? [['ph:', '升成幻聖紋', cnt('afk_split_dust') >= PHANTOM.split && cnt(BLOOD) >= PHANTOM.blood]] : [] }, 'data-dr');
      h += '<div class="ax-h">各聖紋的幻聖紋效果</div><div class="dr-grid">' + Object.keys(PH).map(function (L) { return '<div class="dr-cell' + (sg && sg.L === L ? ' on' : '') + '"><b>' + L + '</b><span><i>' + esc(PH[L][0]) + '</i>' + esc(PH[L][1]) + '</span></div>'; }).join('') + '</div>';
    } else if (VIEW.tab === 'horn') {
      var hr = drec(), hl = (hr && hr.hornLv) || 0, hornHave = cnt('afk_anakin_horn') > 0 || !!(p.eq && p.eq.horn);
      h += '<ul class="ax-note dr-ul"><li>裝在裝備視窗第二頁「聖紋下面、之鱗上面」那一格才生效。</li><li>次元裂縫裡，聖十字之盾（聖十字禁衛軍）擋侵蝕：' + HORN.block.map(function (x, i) { return i ? i + ' 級 ' + x + '%' : '平常 ' + x + '%'; }).join('、') + '。</li><li>還沒有的話：墮光天使 阿納金第 5 形態第一次打倒時給。</li></ul>';
      h += K.rowHtml({ key: 'horn', ico: K.itemIco('afk_anakin_horn'), name: '阿納金的號角　' + hl + '／' + HORN.max + ' 級', color: '#fde047', desc: (p.eq && p.eq.horn) ? '裝備中' : cnt('afk_anakin_horn') ? '在背包裡（要裝上才生效）' : '還沒有', req: hl < HORN.max ? K.reqTxt(stoneCnt(), HORN.stone, '昇華支配強化石（三種都算）') + '　' + K.reqTxt(cnt(BLOOD), HORN.blood, '血龍鑽') : '', off: !hornHave, btns: hl < HORN.max ? [['horn:', '強化', hornHave && stoneCnt() >= HORN.stone && cnt(BLOOD) >= HORN.blood]] : [] }, 'data-dr');
      h += '<div class="ax-h">自選至高昇華支配強化石</div>';
      h += K.rowHtml({ key: 'pick', ico: K.itemIco('afk_rd_pick'), name: '換成一顆昇華支配強化石', color: '#67e8f9', desc: '持有 ' + cnt('afk_rd_pick') + ' 顆，選要換成哪一種。', btns: STONES.map(function (id) { return ['pk:' + id, ((DB.items[id] || {}).n || id).replace(/^.*強化石/, '強化石'), cnt('afk_rd_pick') > 0, (DB.items[id] || {}).n]; }) }, 'data-dr');
    } else if (VIEW.tab === 'dragon') {
      h += '<div class="ax-note" style="margin-bottom:8px">四龍副本・裂縫的龍會掉「' + esc(DB.items.dimr_dragon_0.n) + '」（10%）與四龍的時空碎片。只在四龍副本裡有效果。</div>';
      var mineD = inv().concat(equipped(p)).filter(function (x) { return x && DB.items[x.id] && DB.items[x.id].dimDragon != null; });
      h += '<div class="ax-h">我的四龍盟約</div>';
      if (!mineD.length) h += K.rowHtml({ key: 'nd', name: '還沒有', color: '#94a3b8', desc: '去四龍副本・裂縫打龍。', off: true, btns: [] }, 'data-dr');
      mineD.forEach(function (it) {
        var d = DB.items[it.id], nx = d.dimDragon < 3 ? DRG_EVO[d.dimDragon + 1] : null;
        h += K.rowHtml({ key: it.uid, ico: K.invIco(it, equipped(p).indexOf(it) >= 0 ? 'eq' : 'inv'), name: esc(d.n), color: '#f0abfc', desc: esc(DRG_FX[d.dimDragon]), req: nx ? K.reqTxt(cnt(MIRROR), nx.mirror, '倒影之鏡') + '　' + K.reqTxt(cnt(FRAG), nx.frag, '時空碎片') : '', note: nx ? '進化成「' + esc(DB.items['dimr_dragon_' + (d.dimDragon + 1)].n) + '」' : '已經是最高階', btns: nx ? [['dv:' + it.uid, '進化', cnt(MIRROR) >= nx.mirror && cnt(FRAG) >= nx.frag]] : [] }, 'data-dr');
      });
      h += '<div class="ax-h">四階一覽</div>';
      DRG.forEach(function (x, i) { h += K.rowHtml({ key: 'dg' + i, ico: K.itemIco('dimr_dragon_' + i, true), name: esc(DB.items['dimr_dragon_' + i].n), color: '#f0abfc', desc: esc(DRG_FX[i]), note: i ? '進化材料：倒影之鏡 ×' + DRG_EVO[i].mirror + '、四龍的時空碎片 ×' + DRG_EVO[i].frag : '四龍副本・裂縫的龍 10% 掉落', btns: [] }, 'data-dr'); });
    } else {
      var sy = COST.synth;
      h += K.rowHtml({ key: 'syn', ico: K.itemIco(DUST), name: '異化星塵', color: '#67e8f9', desc: '破碎星光塵埃 ' + sy.star + '＋血龍鑽 ' + sy.blood + ' → 異化星塵 1', req: reqBtn(cnt(STARDUST), sy.star, '破碎星光塵埃') + '　' + reqBtn(cnt(BLOOD), sy.blood, '血龍鑽'), btns: [['sy:1', '合成 1', cnt(STARDUST) >= sy.star && cnt(BLOOD) >= sy.blood], ['sy:10', '合成 10', cnt(STARDUST) >= sy.star * 10 && cnt(BLOOD) >= sy.blood * 10]] }, 'data-dr');
    }
    K.repaint(box, h);
  };
  var render = function (div) {
    if (!div) return; K.css();
    if (!document.getElementById('afk-dimr-css')) { var st = document.createElement('style'); st.id = 'afk-dimr-css'; st.textContent = '#afk-dimr .ax-filter button{cursor:pointer}#afk-dimr .ax-filter button.on{background:#854d0e!important;border-color:#f59e0b!important;color:#fef3c7!important;font-weight:700}#afk-dimr .ax-filter button:not(.on):hover{background:#334155}#afk-dimr .dr-ul{margin:0 0 10px;padding-left:18px}#afk-dimr .dr-ul li{margin:3px 0}#afk-dimr .dr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px}#afk-dimr .dr-cell{display:flex;gap:8px;align-items:flex-start;background:#1e293b;border:1px solid #334155;border-radius:6px;padding:6px 8px;font-size:12.5px;color:#cbd5e1}#afk-dimr .dr-cell.on{border-color:#a78bfa;background:#2e1065}#afk-dimr .dr-cell b{flex:0 0 1.4em;height:1.4em;border-radius:4px;background:#4c1d95;color:#ede9fe;text-align:center;line-height:1.4em}#afk-dimr .dr-cell i{font-style:normal;color:#c4b5fd;font-weight:700;margin-right:4px}'; document.head.appendChild(st); }
    div.innerHTML = '';
    var box = document.createElement('div'); box.className = 'afk-ax'; box.id = 'afk-dimr'; div.appendChild(box); paint(div);
    if (!div.__afkDimrBound) { div.__afkDimrBound = true; div.addEventListener('click', async function (ev) {
      var b = ev.target.closest('[data-dr]'); if (!b || b.disabled || !div.querySelector('#afk-dimr')) return; var k = (b.getAttribute('data-dr') || '').split(':');
      if (k[0] === 'tab') VIEW.tab = k[1]; else if (k[0] === 'src') VIEW.src = k[1]; else if (k[0] === 'mk') craft(k[1], k[2]); else if (k[0] === 'en') enhance(k[1]);
      else if (k[0] === 'rs') reroll(k[1], 'set'); else if (k[0] === 'ru') reroll(k[1], 'ult'); else if (k[0] === 'dv') evolveDragon(k[1]); else if (k[0] === 'sy') synth(+k[1]); else if (k[0] === 'lib') liberate(); else if (k[0] === 'len') libEnhance(); else if (k[0] === 'horn') hornUp(); else if (k[0] === 'pk') pickStone(k[1]); else if (k[0] === 'rr') await riftRefine(k[1]); else if (k[0] === 'soul') soulMem(); else if (k[0] === 'ph') phantomUp();
      paint(div);
    }); }
  };
  K.addNpc('town_sherine', { id: 'npc_afk_dimsmith', n: '次元的鍛造師', title: '次元遺物', type: 'quest', classicHide: true, d: '把遺物丟進裂縫裡重新鍛造的鍛造師。次元遺物的製作、強化、重抽都在這裡。' });
  K.hookNpc('npc_afk_dimsmith', '次元的鍛造師', '次元遺物', render);

  W.__afkDimRelic.craft = craft; W.__afkDimRelic.enhance = enhance; W.__afkDimRelic.reroll = reroll; W.__afkDimRelic.synth = synth; W.__afkDimRelic.evolveDragon = evolveDragon; W.__afkDimRelic.B = B; W.__afkDimRelic.build = build; W.__afkDimRelic.COST = COST; W.__afkDimRelic.liberate = liberate; W.__afkDimRelic.libEnhance = libEnhance; W.__afkDimRelic.hornUp = hornUp; W.__afkDimRelic.libMats = libMats;
  try { console.log('[AFK-dimrelic] 已載入：次元遺物 ' + LIST.length + ' 件'); } catch (e) {}
})();
