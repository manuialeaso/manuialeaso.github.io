/* ============================================================================
 * afk-aden-quests.js — 亞丁的陰影（55～80 級任務）與亞丁 NPC 佐姆格（玩家 2026-10-26 指定；2026-10-27 延續到 80 級）
 *
 * 世界觀：反王肯恩被逐出亞丁後，與魔女賽尼斯、冥皇丹特斯暗中結盟，想奪回王座（接續「謀叛者的低語」）。
 * 亞丁 NPC「近衛隊長 雷歐」依序發五個任務（沿用試煉接取制：達等級接取 → 指定怪物 100% 掉任務道具 → 一次交付領獎；
 * 每個角色各接一次、要先完成前一個才能接下一個；完成後照試煉批次兌換的規則可以重複換裝備，祝福卷軸只有第一次給）；共六個任務：
 *   55 冰封的密函　　：冰之女王的宮殿　冰之女王禁衛兵（弓／矛）　凍結的密函 ×5　　→ 亞丁近衛頭盔
 *   60 元素的背叛　　：慾望洞穴三領域　水／火／風之守護者　　　　被污染的元素碎片 ×6 → 亞丁近衛手套
 *   65 日出之國的盟約：日出之國城墎　　嗚釜、鎌鼬、轆轤首、唐傘小僧 妖怪的盟約面具 ×5 → 亞丁近衛長靴
 *   70 魔族實驗室的交易：魔族實驗室2樓 三種實驗變異怪　　　　　變異的魔族核心 ×5　→ 亞丁近衛斗篷＋職業武器
 *   75 地獄的契約　　：支配者傲慢之塔5樓 地獄的魔法師、地獄的鋼鐵高崙 地獄的契約書殘頁 ×5 → 亞丁近衛盔甲
 *   80 風龍的密使　　：風龍棲息地　　　佩利克、菲爾菲爾、瑪依奴　　　　風龍的密令 ×6　　→ 亞丁王室勳章（項鍊）
 *   每個任務另送祝福的強化卷軸（盔甲或武器）
 * 亞丁近衛裝備：可用到 80 等，基礎數值不超過同部位遺物、沒有遺物特效；
 *   安定值 +9、最高 +9；只能在亞丁的「佐姆格」用祝福的強化卷軸強化（每次固定 +1，不會失敗；玩家 2026-10-26 改）
 *   五件套（頭盔、手套、長靴、斗篷、盔甲）：最大 HP +100、額外傷害 +1、額外命中 +1、魔防 +5
 *   六件套（再加王室勳章）：最大 HP 再 +100、五屬性抗性 +10、額外傷害／命中再 +1
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.items || !DB.towns || !DB.towns.town_aden || typeof TRIAL_Q === 'undefined') { console.warn('[AFK-aden-quests] 缺少任務系統，略過'); return; }
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var CLASSES = ['knight', 'mage', 'elf', 'dark', 'illusion', 'warrior', 'dragon', 'royal'];

  // ── 任務道具 ──
  var QI = {
    afk_aq_letter: { n: '凍結的密函', img: 'assets/icons/items/古老的交易文件.png', d: '被冰封在禁衛兵鎧甲夾層裡的密函，封蠟上壓著反王肯恩的紋章。' },
    afk_aq_shard: { n: '被污染的元素碎片', img: 'assets/icons/items/原石碎片.png', d: '元素守護者體內被黑魔法染黑的碎片，散發著與魔女賽尼斯相同的氣息。' },
    afk_aq_mask: { n: '妖怪的盟約面具', img: 'assets/icons/armors/影子面具.png', d: '日出之國妖怪們戴著的面具，內側刻著與亞丁叛黨締結的盟約。' },
    afk_aq_core: { n: '變異的魔族核心', img: 'assets/icons/items/炎魔之心.png', d: '魔族實驗室培養的變異核心，這是魔女賽尼斯拿來跟魔族交換的貨物。' },
    afk_aq_contract: { n: '地獄的契約書殘頁', img: 'assets/icons/items/妖魔搜索文件.png', d: '冥皇丹特斯與地獄簽下的契約書殘頁，字跡用黑色的血寫成。' },
    afk_aq_order: { n: '風龍的密令', img: 'assets/icons/items/古老的交易文件.png', d: '風龍棲息地的魔物隨身帶著的密令，蓋著風龍林德拜爾的爪印——叛黨連龍都借來了。' }
  };
  Object.keys(QI).forEach(function (id) { var x = QI[id]; if (!DB.items[id]) DB.items[id] = { n: x.n, type: 'etc', p: 0, c: 'text-sky-300', img: x.img, noUse: true, gachaWeight: 0, questItem: true, d: x.d + '（亞丁的陰影任務道具）' }; });

  // ── 亞丁近衛裝備 ──
  var ZOMG_TXT = '安定值 +9、最高 +9；只能在亞丁的佐姆格用祝福的強化卷軸強化。';
  var SET_TXT = '【亞丁近衛】五件套：最大 HP +100、額外傷害 +1、額外命中 +1、魔防 +5；六件套（含王室勳章）：最大 HP 再 +100、五屬性抗性 +10、額外傷害／命中再 +1。';
  var base = function (o) { return Object.assign({ type: 'arm', safe: 9, maxEn: 9, req: 'all', p: 50000, gachaWeight: 0, afkZomg: true, afkAdenSet: true, c: 'text-amber-200' }, o); };
  var ARMS = {
    arm_aden_helm: base({ n: '亞丁近衛頭盔', slot: 'helm', ac: 4, mr: 6, hpR: 3, img: 'assets/icons/armors/鋼鐵頭盔.png', d: '亞丁王室近衛的制式頭盔。AC 4、魔防 +6、HP 自然恢復 +3。' }),
    arm_aden_gloves: base({ n: '亞丁近衛手套', slot: 'gloves', ac: 3, extraHit: 2, img: 'assets/icons/armors/鋼鐵手套.png', d: '亞丁王室近衛的鋼鐵手套。AC 3、額外命中 +2。' }),
    arm_aden_boots: base({ n: '亞丁近衛長靴', slot: 'boots', ac: 3, er: 2, img: 'assets/icons/armors/鋼鐵長靴.png', d: '亞丁王室近衛的長靴。AC 3、遠距離迴避 +2。' }),
    arm_aden_cloak: base({ n: '亞丁近衛斗篷', slot: 'cloak', ac: 3, mr: 6, img: 'assets/icons/armors/龍騎士斗篷.png', d: '繡著亞丁王室徽章的斗篷。AC 3、魔防 +6。' }),
    arm_aden_armor: base({ n: '亞丁近衛盔甲', slot: 'armor', ac: 10, dr: 2, hpR: 4, img: 'assets/icons/armors/鋼鐵金屬盔甲.png', d: '亞丁王室近衛的全身鎧。AC 10、傷害減免 +2、HP 自然恢復 +4。' })
  };
  ARMS.acc_aden_medal = Object.assign({ type: 'acc', slot: 'amulet', safe: 9, maxEn: 9, req: 'all', p: 120000, gachaWeight: 0, afkZomg: true, afkAdenSet: true, c: 'text-amber-200', ac: 2, mr: 5, mhp: 50, img: 'assets/icons/accessories/守護項鍊.png', n: '亞丁王室勳章', d: '亞丁王室頒給近衛隊長的勳章，背面刻著「守護王座者」。AC 2、魔防 +5、最大 HP +50。' });
  var SET_IDS = Object.keys(ARMS);
  Object.keys(ARMS).forEach(function (id) { var d = ARMS[id]; d.d += ZOMG_TXT + SET_TXT; if (!DB.items[id]) DB.items[id] = d; });
  // 職業武器（70 級任務）：照同類武器複製型態欄位，再改數值
  var WPN = {
    wpn_aden_sword: { src: 'wpn_longsword', n: '亞丁近衛長劍', req: 'knight,royal,dragon', dmgS: 14, dmgL: 16, hit: 3, dmgBonus: 3, img: 'assets/icons/weapons/拉斯塔巴德長劍.png', txt: '小／大傷 14／16、命中 +3、額外傷害 +3' },
    wpn_aden_axe: { src: 'wpn_battleaxe', n: '亞丁近衛戰斧', req: 'warrior', dmgS: 22, dmgL: 22, hit: 2, dmgBonus: 3, img: 'assets/icons/weapons/戰斧.png', txt: '小／大傷 22／22、命中 +2、額外傷害 +3' },
    wpn_aden_bow: { src: 'wpn_elfbow', n: '亞丁近衛長弓', req: 'elf', dmgS: 4, dmgL: 4, hit: 3, dmgBonus: 3, img: 'assets/icons/weapons/拉斯塔巴德弓.png', txt: '小／大傷 4／4、命中 +3、額外傷害 +3' },
    wpn_aden_wand: { src: 'wpn_crystalwand', n: '亞丁近衛魔杖', req: 'mage,illusion', dmgS: 3, dmgL: 3, hit: 0, mdmg: 3, magicHit: 2, mpR: 5, img: 'assets/icons/weapons/光束強化魔杖.png', txt: '魔法傷害 +3、魔法命中 +2、MP 自然恢復 +5' },
    wpn_aden_dual: { src: 'wpn_dual_silver', n: '亞丁近衛雙刀', req: 'dark', dmgS: 15, dmgL: 12, hit: 3, dmgBonus: 3, img: 'assets/icons/weapons/幽暗雙刀.png', txt: '小／大傷 15／12、命中 +3、額外傷害 +3' }
  };
  var CLS_WPN = { knight: 'wpn_aden_sword', royal: 'wpn_aden_sword', dragon: 'wpn_aden_sword', warrior: 'wpn_aden_axe', elf: 'wpn_aden_bow', mage: 'wpn_aden_wand', illusion: 'wpn_aden_wand', dark: 'wpn_aden_dual' };
  Object.keys(WPN).forEach(function (id) {
    var w = WPN[id], s = DB.items[w.src]; if (DB.items[id] || !s) return;
    var d = JSON.parse(JSON.stringify(s));
    ['legend', 'relic', 'procSkill', 'procRate', 'p', 'd', 'mpR', 'mdmg', 'int', 'str', 'dex', 'con', 'wis', 'cha'].forEach(function (k) { delete d[k]; });
    Object.assign(d, { n: w.n, req: w.req, dmgS: w.dmgS, dmgL: w.dmgL, hit: w.hit, safe: 9, maxEn: 9, p: 80000, gachaWeight: 0, afkZomg: true, img: w.img, c: 'text-amber-200',
      d: '亞丁王室近衛的制式武器。' + w.txt + '。' + ZOMG_TXT });
    if (w.dmgBonus) d.dmgBonus = w.dmgBonus; if (w.mdmg) d.mdmg = w.mdmg; if (w.magicHit) d.magicHit = w.magicHit; if (w.mpR) d.mpR = w.mpR;
    DB.items[id] = d;
    try { if (typeof WEAPON_TAGS !== 'undefined' && WEAPON_TAGS[w.src] && !WEAPON_TAGS[id]) WEAPON_TAGS[id] = WEAPON_TAGS[w.src].slice ? WEAPON_TAGS[w.src].slice() : WEAPON_TAGS[w.src]; } catch (e) {}
  });

  // ── 六個任務（每個職業一份，共用任務道具）──
  var QUESTS = [
    { lv: 55, key: 'aden55', title: '冰封的密函', item: 'afk_aq_letter', need: 5, map: '冰之女王的宮殿', mobs: ['冰之女王禁衛兵(弓)', '冰之女王禁衛兵(矛)'], reward: ['arm_aden_helm'], scrolls: [['scroll_armor_b', 2]],
      story: '自從反王肯恩被逐出亞丁，城裡就不斷有人收到不署名的冰封密函。追查下來，送信的是冰之女王宮殿的禁衛兵——叛黨把信藏在他們的鎧甲夾層裡。去把那些密函帶回來。' },
    { lv: 60, key: 'aden60', title: '元素的背叛', item: 'afk_aq_shard', need: 6, map: '慾望洞穴（水／火／風之領域）', mobs: ['水之守護者', '火之守護者', '風之守護者'], reward: ['arm_aden_gloves'], scrolls: [['scroll_armor_b', 2]],
      story: '密函裡提到「元素已經聽命於魔女」。慾望洞穴的守護者向來中立，現在卻開始攻擊路過的冒險者。取回牠們體內被染黑的元素碎片，我要確認那是不是賽尼斯的黑魔法。' },
    { lv: 65, key: 'aden65', title: '日出之國的盟約', item: 'afk_aq_mask', need: 5, map: '日出之國城墎', mobs: ['嗚釜', '鎌鼬', '轆轤首', '唐傘小僧'], reward: ['arm_aden_boots'], scrolls: [['scroll_armor_b', 2]],
      story: '碎片上的黑魔法確實是賽尼斯的手筆。更糟的是，她還派使者渡海去了日出之國，向那裡的妖怪借兵。妖怪們戴著的面具，就是盟約的信物——把面具帶回來。' },
    { lv: 70, key: 'aden70', title: '魔族實驗室的交易', item: 'afk_aq_core', need: 5, map: '魔族實驗室2樓', mobs: ['實驗變異怪(咆哮翼魔)', '實驗變異怪(水晶惡魔)', '實驗變異怪(蝦蟹異魔)'], reward: ['arm_aden_cloak'], scrolls: [['scroll_weapon_b', 3]], clsWeapon: true,
      story: '日出之國的盟約只是開始。叛黨的軍資來自魔族——賽尼斯用魔族實驗室培養的變異核心換取黃金與傭兵。毀掉那些實驗變異怪，把核心帶回來當證據。這把近衛武器，你拿去用吧。' },
    { lv: 75, key: 'aden75', title: '地獄的契約', item: 'afk_aq_contract', need: 5, map: '支配者傲慢之塔5樓', mobs: ['地獄的魔法師', '地獄的鋼鐵高崙'], reward: ['arm_aden_armor'], scrolls: [['scroll_armor_b', 3], ['scroll_weapon_b', 2]],
      story: '下一條線索指向冥皇丹特斯：他在支配者傲慢之塔與地獄締約，要用死者的軍隊替肯恩打開王座。燒掉那些契約書，帶回殘頁。' },
    { lv: 80, key: 'aden80', title: '風龍的密使', item: 'afk_aq_order', need: 6, map: '風龍棲息地', mobs: ['佩利克', '菲爾菲爾', '瑪依奴'], reward: ['acc_aden_medal'], scrolls: [['scroll_armor_b', 3], ['scroll_weapon_b', 3]],
      story: '契約書燒掉了，但肯恩沒有停手。災厄守望者希爾芙帶來消息：風龍棲息地的魔物開始替叛黨送信——他們要向風龍林德拜爾借風暴的力量，從天上攻進亞丁。去把那些密令搶回來。這枚王室勳章是王座對你的承諾：等你查完這條線，亞丁的告密者伊菈會告訴你叛黨最後藏身的地方（謀叛者的低語）。' }
  ];
  QUESTS.forEach(function (q) {
    CLASSES.forEach(function (cls) {
      var k = q.key + '_' + cls; if (TRIAL_Q[k]) return;
      var rw = q.reward.slice(); if (q.clsWeapon && CLS_WPN[cls]) rw.push(CLS_WPN[cls]);
      TRIAL_Q[k] = { cls: cls, lv: q.lv, npc: '近衛隊長 雷歐', reqs: [[q.item, q.need]], rewards: rw, afkAden: q.key };
      try { (TRIAL_ITEM_Q[q.item] = TRIAL_ITEM_Q[q.item] || []).push(k); } catch (e) {}
    });
    try { if (typeof MOB_DROPS !== 'undefined') q.mobs.forEach(function (mn) { MOB_DROPS[mn] = MOB_DROPS[mn] || []; if (!MOB_DROPS[mn].some(function (x) { return x[0] === q.item; })) MOB_DROPS[mn].push([q.item, 1]); }); } catch (e) {}
    try { if (typeof WH_NO_STORE !== 'undefined' && WH_NO_STORE.indexOf(q.item) < 0) WH_NO_STORE.push(q.item); } catch (e) {}
    try { if (typeof TRIAL_ITEM_CLASS !== 'undefined') TRIAL_ITEM_CLASS[q.item] = CLASSES.slice(); } catch (e) {}   // 掉落閘：接取中且未集滿才掉
  });
  var keyOf = function (q, p) { return q.key + '_' + ((p || P() || {}).cls || ''); };
  var prevDone = function (i, p) { return i === 0 || trialQStateFor(p || P(), keyOf(QUESTS[i - 1], p)) === 2; };
  if (typeof W.trialQAccept === 'function') {
    var oAcc = W.trialQAccept;
    W.trialQAccept = function (key) {
      var i = QUESTS.findIndex(function (q) { return String(key || '').indexOf(q.key + '_') === 0; });
      if (i > 0 && !prevDone(i)) { sys('<span class="text-amber-300">近衛隊長 雷歐：先把「' + QUESTS[i - 1].title + '」的事辦完再說。</span>'); return; }
      return oAcc.apply(this, arguments);
    };
  }

  // 第一次完成另送祝福卷軸（試煉批次兌換只換裝備，不換卷軸）
  if (typeof W.trialQComplete === 'function') {
    var oDone = W.trialQComplete;
    W.trialQComplete = function (key) {
      var q = QUESTS.filter(function (x) { return String(key || '').indexOf(x.key + '_') === 0; })[0], before = q ? trialQState(key) : 0;
      var r = oDone.apply(this, arguments);
      try { if (q && before === 1 && trialQState(key) === 2) { q.scrolls.forEach(function (x) { gainItem(x[0], x[1], true, true); }); sys('<span class="text-amber-200">近衛隊長 雷歐另外交給你：' + q.scrolls.map(function (x) { return DB.items[x[0]].n + ' ×' + x[1]; }).join('、') + '。</span>'); saveGame(); } } catch (e) {}
      return r;
    };
  }
  // ── NPC ──
  var aden = DB.towns.town_aden; aden.npcs = aden.npcs || [];
  var NPCS = [
    { id: 'npc_aden_leo', n: '近衛隊長 雷歐', title: '任務', type: 'quest', pos: [26, 52], d: '亞丁王室近衛的隊長雷歐，正暗中追查反王肯恩復辟的陰謀。55～80 級的冒險者可以向他接取「亞丁的陰影」任務。' },
    { id: 'npc_zomg', n: '佐姆格', title: '強化', type: 'craft', pos: [58, 70], spr: '1768', d: '亞丁王室的老鐵匠佐姆格，近衛的裝備都出自他的手。只有他能用祝福的強化卷軸替亞丁近衛裝備強化（最高 +9，不會失敗）。' }
  ];
  NPCS.forEach(function (x) {
    if (!aden.npcs.some(function (n) { return n.id === x.id; })) aden.npcs.push({ id: x.id, n: x.n, title: x.title, type: x.type, d: x.d });
    try { if (typeof TOWN_NPC_POS_OVERRIDE !== 'undefined') (TOWN_NPC_POS_OVERRIDE.town_aden = TOWN_NPC_POS_OVERRIDE.town_aden || {})[x.id] = x.pos; } catch (e) {}
    try { if (x.spr && typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[x.id]) NPC_SPR_FIXED[x.id] = x.spr; } catch (e) {}
  });

  // 2026-11-01（玩家：劇情任務介面美化、標楷體放大）：跟其他劇情線用同一套卡片（afk-lore-kit 的 questUI）；讀不到就用舊版
  function renderLeoNew(div, p, U) {
    U.ensureCss();
    var rr = 'afkRenderLeo', n = QUESTS.length, have = function (id) { return typeof questCountId === 'function' ? questCountId(id) : 0; };
    var done = QUESTS.filter(function (q) { return trialQStateFor(p, keyOf(q, p)) === 2; }).length;
    var h = '<div class="alq" style="margin-top:0"><div class="alq-head"><span class="alq-title">📜 劇情「亞丁的陰影」</span><span class="alq-sum">已完成 ' + done + '／' + n + ' 章</span></div>'
      + '<div class="alq-intro">「反王肯恩還沒死心。他和魔女賽尼斯、冥皇丹特斯勾結，想奪回亞丁的王座。我需要能打的人替我追查線索。」</div>';
    QUESTS.forEach(function (q, i) {
      var k = keyOf(q, p), st = trialQStateFor(p, k), c = TRIAL_Q[k] || { reqs: [], rewards: [] }, reqs = c.reqs || [];
      var ok = reqs.every(function (r) { return have(r[0]) >= r[1]; });
      var s = st === 2 ? 'done' : !prevDone(i, p) ? 'lock' : (p.lv || 1) < q.lv ? 'lv' : st === 0 ? 'new' : ok ? 'ready' : 'active';
      var ext = (s === 'done' || s === 'ready' || s === 'active') ? U.extOf(k, rr) : { blocks: '', anc: {} };
      var reqH = reqs.map(function (r) { var d = DB.items[r[0]] || {}, hv = have(r[0]); return U.chip(r[0], d.n || r[0], 'text-sky-300', '<span class="' + (hv >= r[1] ? 'ok' : 'no') + '">' + Math.min(hv, r[1]) + '</span>/' + r[1]); }).join('');
      var rwH = (c.rewards || []).map(function (id) { var d = DB.items[id] || {}; return U.chip(id, d.n || id, U.colorOf(id), '', '', ext.anc[d.n] || ''); }).join('');
      var firstH = q.scrolls.map(function (x) { return U.chip(x[0], (DB.items[x[0]] || {}).n || x[0], U.colorOf(x[0]), '×' + x[1]); }).join('');
      var body = '<div class="alq-story">' + esc(q.story) + '</div><div class="alq-meta">地點：<b>' + esc(q.map) + '</b>（' + q.mobs.map(esc).join('、') + '）</div>'
        + U.row('需求：', reqH) + U.row('獎勵：', rwH) + U.row('首次另送：', firstH);
      h += '<div class="alq-ch s-' + s + '"><div class="alq-chh"><span class="alq-no">亞丁的陰影 ' + (i + 1) + '／' + n + '</span><span class="alq-cht">' + esc(q.title) + '</span><span class="alq-lv">Lv' + q.lv + '</span><span class="alq-badge s-' + (s === 'new' ? 'new' : s) + '">' + U.STN[s] + '</span></div>';
      if (s === 'done') h += '<details class="alq-more"><summary>回顧這一章</summary>' + body + '</details>' + (ext.blocks ? '<div class="alq-ext">' + ext.blocks + '</div>' : '');
      else {
        h += body + '<div class="alq-act">';
        if (s === 'lock') h += '<span class="alq-note">完成「' + esc(QUESTS[i - 1].title) + '」後才能接取。</span>';
        else if (s === 'lv') h += '<span class="alq-warn">需要等級 ' + q.lv + ' 以上才能接取此任務。</span>';
        else if (s === 'new') h += '<button class="btn bg-amber-800 hover:bg-amber-700 py-2 px-4 font-bold" onclick="trialQAccept(\'' + k + '\',\'' + rr + '\')">接取任務</button><span class="alq-note">接取後擊殺指定怪物 100% 掉落・無法存入倉庫</span>';
        else if (s === 'ready') h += '<button class="btn bg-emerald-800 hover:bg-emerald-700 py-2 px-4 font-bold" onclick="trialQComplete(\'' + k + '\',\'' + rr + '\')">交付任務（獲得全部獎勵）</button>';
        else h += '<span class="alq-warn">尚未備齊。</span><span class="alq-note">擊殺指定怪物必定掉落，集滿為止。</span>';
        h += '</div>' + (ext.blocks ? '<div class="alq-ext">' + ext.blocks + '</div>' : '');
      }
      h += '</div>';
    });
    if (done === n) h += '<div class="alq-outro">「謝謝你。亞丁有個叫伊菈的告密者，她知道肯恩藏身的密室（謀叛者的低語）入口——去找她吧。」</div>';
    div.innerHTML = h + '</div>';
  }
  function renderLeo(div) {
    var p = P(); if (!p || !div) return;
    var U = W.__afkLore && W.__afkLore.questUI;
    if (U) { try { renderLeoNew(div, p, U); return; } catch (e) { console.warn('[AFK-aden-quests] ui', e); } }
    var h = '<div class="text-sm space-y-2"><div class="text-slate-300">「反王肯恩還沒死心。他和魔女賽尼斯、冥皇丹特斯勾結，想奪回亞丁的王座。我需要能打的人替我追查線索。」</div>';
    QUESTS.forEach(function (q, i) {
      var k = keyOf(q, p), st = trialQStateFor(p, k);
      h += '<div class="p-2 rounded border border-slate-700 bg-slate-900/40"><div class="font-bold text-amber-300">亞丁的陰影 ' + (i + 1) + '／' + QUESTS.length + '・' + esc(q.title) + '（Lv' + q.lv + '）</div>';
      h += '<div class="text-xs text-slate-400 my-1">' + esc(q.story) + '</div><div class="text-xs text-slate-400 mb-1">首次完成另送：' + q.scrolls.map(function (x) { return (DB.items[x[0]] || {}).n + ' ×' + x[1]; }).join('、') + '</div><div class="text-xs text-slate-400 mb-1">地點：' + esc(q.map) + '（' + q.mobs.map(esc).join('、') + '）</div>';
      if (st !== 2 && !prevDone(i, p)) h += '<div class="text-xs text-slate-500">完成「' + esc(QUESTS[i - 1].title) + '」後才能接取。</div></div>';
      else h += (typeof trialQHTML === 'function' ? trialQHTML(k, 'afkRenderLeo').replace(/⚔️ \d+ 級試煉/, '任務進度').replace(/接取試煉任務/g, '接取任務').replace(/完成試煉（獲得全部獎勵）/g, '交付任務（獲得全部獎勵）').replace(/試煉/g, '任務') : '') + '</div>';
    });
    if (QUESTS.every(function (q) { return trialQStateFor(p, keyOf(q, p)) === 2; })) h += '<div class="text-xs text-fuchsia-300">「謝謝你。亞丁有個叫伊菈的告密者，她知道肯恩藏身的密室（謀叛者的低語）入口——去找她吧。」</div>';
    div.innerHTML = h + '</div>';
  }
  W.afkRenderLeo = renderLeo;

  // ── 佐姆格：祝福卷軸強化 ──
  var scrollFor = function (d) { return d && d.type === 'wpn' ? 'scroll_weapon_b' : 'scroll_armor_b'; };
  var MAXEN = 9;
  var listGear = function () {
    var p = P(), out = []; if (!p) return out;
    Object.keys(p.eq || {}).forEach(function (s) { var it = p.eq[s], d = it && DB.items[it.id]; if (d && d.afkZomg) out.push({ it: it, d: d, eq: true }); });
    (p.inv || []).forEach(function (it) { var d = it && DB.items[it.id]; if (d && d.afkZomg) out.push({ it: it, d: d, eq: false }); });
    return out;
  };
  var cntOf = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (s, i) { return s + (i && i.id === id && !i.lock ? Math.max(1, Number(i.cnt) || 1) : 0); }, 0) : 0; };
  function zomgEnhance(uid) {
    var p = P(); if (!p) return { ok: false, msg: '請先進入遊戲。' };
    var g = listGear().filter(function (x) { return x.it.uid === uid; })[0]; if (!g) return { ok: false, msg: '找不到這件裝備。' };
    var en = Number(g.it.en) || 0; if (en >= MAXEN) return { ok: false, msg: '已經是 +' + MAXEN + '（最高）。' };
    var sid = scrollFor(g.d); if (cntOf(sid) < 1) return { ok: false, msg: '沒有' + (DB.items[sid] || {}).n + '。' };
    questConsumeId(sid, 1);
    var add = 1;   // 佐姆格：每次固定 +1（玩家 2026-10-26：不要 1～3 亂數）
    g.it.en = Math.min(MAXEN, en + Math.max(1, add));
    try { if (g.eq && typeof calcStats === 'function') calcStats(); } catch (e) {}
    try { saveGame(); } catch (e) {}
    try { if (typeof renderTabs === 'function') renderTabs(true); updateUI(); } catch (e) {}
    var msg = '佐姆格用祝福的卷軸敲了幾下：' + g.d.n + ' +' + en + ' → +' + g.it.en + '。';
    sys('<span class="text-amber-200">' + esc(msg) + '</span>');
    return { ok: true, msg: msg, en: g.it.en };
  }
  function renderZomg(div) {
    var p = P(); if (!p || !div) return;
    var gs = listGear();
    var h = '<div class="text-sm space-y-2"><div class="text-slate-300">「近衛的裝備是我打的，別拿外面那些來路不明的卷軸亂敲。拿祝福的卷軸來，我保證不會壞。」</div>'
      + '<div class="text-xs text-slate-400">亞丁近衛裝備安定值 +9、最高 +9；每次消耗 1 張祝福的強化卷軸（武器用祝福武捲、防具用祝福防捲），每次固定 +1、不會失敗。持有：祝福的 對武器施法的卷軸 <b>' + cntOf('scroll_weapon_b') + '</b>｜祝福的 對盔甲施法的卷軸 <b>' + cntOf('scroll_armor_b') + '</b></div>';
    if (!gs.length) h += '<div class="text-xs text-slate-500">你身上沒有亞丁近衛裝備（向近衛隊長 雷歐接「亞丁的陰影」任務取得）。</div>';
    gs.forEach(function (g) {
      var en = Number(g.it.en) || 0, sid = scrollFor(g.d), can = en < MAXEN && cntOf(sid) > 0;
      h += '<div class="flex items-center gap-2 p-2 rounded border border-slate-700 bg-slate-900/40"><span class="flex-1"><b class="text-amber-200">+' + en + ' ' + esc(g.d.n) + '</b>' + (g.eq ? ' <small class="text-emerald-300">（裝備中）</small>' : '') + '</span>'
        + '<button class="btn py-1 px-3 font-bold" data-zomg="' + esc(g.it.uid) + '"' + (can ? '' : ' disabled') + '>' + (en >= MAXEN ? '已達 +9' : (g.d.type === 'wpn' ? '用祝福武捲強化' : '用祝福防捲強化')) + '</button></div>';
    });
    div.innerHTML = h + '</div>';
    div.onclick = function (e) { var b = e.target.closest('[data-zomg]'); if (!b || b.disabled) return; var r = zomgEnhance(b.getAttribute('data-zomg')); if (!r.ok) sys('<span class="text-red-400">' + esc(r.msg) + '</span>'); renderZomg(div); };
  }
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try {
        var div = document.getElementById('interaction-content');
        if (div && npcId === 'npc_aden_leo') { div.onclick = null; renderLeo(div); }
        else if (div && npcId === 'npc_zomg') renderZomg(div);
      } catch (e) { console.warn('[AFK-aden-quests] ui', e); }
      return r;
    };
  }
  // 一般的強化（卷軸、快速強化）不能用在亞丁近衛裝備上
  var isZ = function (uid) { try { var p = P(); var it = (p.inv || []).find(function (i) { return i.uid === uid; }) || Object.values(p.eq || {}).find(function (e) { return e && e.uid === uid; }); var d = it && DB.items[it.id]; return !!(d && d.afkZomg); } catch (e) { return false; } };
  var deny = function () { sys('<span class="text-amber-300">亞丁近衛裝備只能在亞丁的「佐姆格」用祝福的強化卷軸強化。</span>'); };
  ['showEnhanceOptions', 'doEnhance'].forEach(function (fn) {
    var o = W[fn]; if (typeof o !== 'function') return;
    W[fn] = function (uid) { if (isZ(uid)) { deny(); return false; } return o.apply(this, arguments); };
  });
  if (typeof W._qeCanSelect === 'function') { var oQe = W._qeCanSelect; W._qeCanSelect = function (d) { if (d && d.afkZomg) return false; return oQe.apply(this, arguments); }; }

  // ── 五件套 ──
  var setCount = function (p) { var n = 0; Object.keys((p && p.eq) || {}).forEach(function (s) { var it = p.eq[s]; if (it && SET_IDS.indexOf(it.id) >= 0) n++; }); return n; };
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) { var n = setCount(p); if (n >= 5) p.mhp = (p.mhp || 0) + 100; if (n >= 6) p.mhp = (p.mhp || 0) + 100; });
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () { var r = oRe.apply(this, arguments); try { var p = P(); if (p && p.d && setCount(p) >= 5) { p.d.extraDmg = (p.d.extraDmg || 0) + 1; p.d.extraHit = (p.d.extraHit || 0) + 1; p.d.mr = (p.d.mr || 0) + 5; if (setCount(p) >= 6) { p.d.extraDmg += 1; p.d.extraHit += 1; ['resFire', 'resWater', 'resWind', 'resEarth', 'resNone'].forEach(function (k) { p.d[k] = (p.d[k] || 0) + 10; }); } } } catch (e) {} return r; };
  }

  W.AFK_ADEN_QUESTS = { quests: QUESTS, keyOf: keyOf, setIds: SET_IDS, weapons: Object.keys(WPN), clsWeapon: CLS_WPN, enhance: zomgEnhance, renderLeo: renderLeo, renderZomg: renderZomg, setCount: setCount, maxEn: MAXEN };
  console.log('[AFK-aden-quests] 已啟用：亞丁的陰影 55～80 級任務、佐姆格祝福強化');
})();
