/* ============================================================================
 * afk-riftdungeons.js — 次元裂縫的副本（dimension-rift-design 4.1～4.7、rift-zodiac-plan 第五節 A～E、decisions-1107 1.7 入場）
 *
 *   入口：席琳神殿「裂縫之門」。要開著次元裂縫（afk-dimrift）；副本裡照樣套裂縫的世界規則（侵蝕、光蝕、面板壓到五成、怪物倍率、掉落）。
 *   三段（取回的力量）：第一段 0%：哈汀・裂縫、謀叛・裂縫、時光・裂縫、A 沉默的鐘樓、B 倒影迴廊
 *                       第二段 20%：四龍・裂縫、C 燃燼礦坑、D 漂流的墓船
 *                       第三段 40%：墮光天使 阿納金（五形態）、E 星墜的祭壇、封印戰「裂縫之中」、無盡的裂縫
 *   入場一律血龍鑽（decisions-1107 1.7）；A～E 的入場、所有頭目 HP 是暫定，之後用三份存檔模擬再調。
 *   隊伍倍率：HP ×（1＋0.25×活著的傭兵數）。每個副本最後頭目每天第一次給裂縫點數 10（每天最多 60）。
 *   「第二輪」：倒影迴廊的位置交換、星線距離、齒輪站位、增益全消、魔法屏障擋光柱、四龍的我方 NPC、時光副本的影子走位。
 *   經典模式沒有；外掛開關 riftdungeons。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, L = W.__afkLore, K = W.__afkNpcKit, DR = W.__afkDimRift;
  if (T && T.register) T.register({ id: 'riftdungeons', name: '次元裂縫的副本', group: '遊戲內容', desc: '席琳神殿 裂縫之門：哈汀、謀叛、時光、四龍、阿納金、封印戰、無盡的裂縫與五個新副本（要開著次元裂縫）' });
  if (T && !T.enabled('riftdungeons')) return;
  if (!L || !K || !DR || typeof DB === 'undefined' || !DB.maps) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = L.esc, sys = L.sys, clog = L.clog;
  var dayKey = function () { return Math.floor((Date.now() + 8 * 3600000) / 86400000); };
  var weekKey = function () { return Math.floor((dayKey() + 3) / 7); };   // 週一 00:00 換週
  var mobs = function () { return (typeof mapState !== 'undefined' && mapState.mobs) || []; };
  var MAP = 'afk_riftdg', TOWN = 'town_sherine', DOOM_TOWN = 'town_behemoth', backTown = TOWN, NPC_ID = 'npc_afk_riftgate', NPC_N = '裂縫之門';
  var IMG = 'assets/icons/items/', BLOOD = 'afk_blood_dia', REF = 65;
  var R = { allyHp: 0.25, pts: 10, ptsDay: 60, mobHpK: 0.3, riftHp: 1.5, mobRef: 125000, bossRef: 30000, hpT: { hardin: 1.3, treason: 1, past: 8, clock: 90, mirror: 220, dragons: 68, ship: 53, anakin1: 8, anakin2: 6, anakin3: 5, anakin4: 3.5, anakin5: 2.2, altar: 68, seal: 1.3, endless: 1 } };   // hpT：11-07 依畢業存檔（面板 90%）校到目標通關時間：一般 3～5 分、四龍與阿納金 8～10 分、每週 15 分   // 11-07：HP 改用固定基準（不吃借來外觀的怪物原本 HP）

  // ── 材料 ──
  var MAT = {
    afk_rd_sand: ['凝結的時之沙', '哈汀、謀叛、時光副本裂縫版留下的沙。時光副本的門票，也用在席琳遺骸淬鍊、之魂憶起。'],
    afk_rd_water: ['席琳的水之記憶', '謀叛、時光副本裡偶爾撿到的水滴，裡面有席琳的記憶。席琳遺骸淬鍊、之魂憶起用得到。'],
    afk_rd_scale: ['侵蝕龍鱗', '四龍副本・裂縫的龍身上剝下的鱗。守護者之戒完整 ★ 用得到。'],
    afk_rd_feather: ['焦黑的光羽', '傲慢之塔 91～100 樓的裂縫怪物、墮光天使身上落下的羽毛。10 片可以召喚墮光天使 阿納金。'],
    afk_rd_echo: ['號角的殘音', '阿納金第 3～5 形態留下的聲音。用途之後開放。'],
    afk_rd_thread: ['天空的縫線', '封印戰與無盡的裂縫留下的線。守護者之戒完整 ★3 用得到。'],
    afk_rd_remnant: ['殷海薩的殘光', '封印戰、無盡的裂縫深處留下的光。用途之後開放。'],
    afk_rd_pick: ['自選至高昇華支配強化石', '在席琳神殿「次元的鍛造師」換成任一種昇華支配強化石（武器／防具／飾品）。'],
    afk_rd_mirror: ['倒影之鏡', '倒影迴廊的鏡子。之後用來替裝備重新抽一條附加能力。'],
    afk_rd_ember: ['熾燼原石', '燃燼礦坑的鑽機挖出來的原石。用途之後開放。'],
    afk_rd_ink: ['深淵墨晶', '深淵的大王烏賊的墨凝成的晶體。用途之後開放。'],
    afk_rd_neptune: ['海神的鱗片', '漂流的墓船深處撿到的鱗片。之後給龍之護甲類強化用。'],
    afk_rd_eclipse: ['星蝕之核', '星墜的祭壇的星蝕者留下的核。創世密奧卡、黃道星卡之後的強化材料。'],
    afk_rd_hmark: ['哈汀的魔法印記', '哈汀的時空・裂縫留下的印記。用途之後開放。'],
    afk_anakin_horn: ['阿納金的號角', '墮光天使 阿納金第一次被擊倒第五形態時留下的號角。裝在裝備視窗第二頁「聖紋下面、之鱗上面」那一格；在「次元的鍛造師」強化，提高次元裂縫裡聖十字之盾擋下的侵蝕。']
  };
  Object.keys(MAT).forEach(function (id) { var x = MAT[id]; if (!DB.items[id]) DB.items[id] = { n: x[0], type: 'etc', p: 0, gachaWeight: 0, weight: 0, noUse: true, noSell: true, c: 'text-cyan-300', img: IMG + '原石碎片.png', d: x[1] + '（次元裂縫限定）' }; });
  var cnt = function (id) { return typeof questCountId === 'function' ? questCountId(id) : 0; };
  var take = function (id, n) { try { questConsumeId(id, n); return true; } catch (e) { return false; } };
  var give = function (id, n) { if (n > 0 && DB.items[id]) { gainItem(id, n, true, true); return (DB.items[id].n || id) + (n > 1 ? ' ×' + n : ''); } return ''; };
  var rr = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  var nm = function (id) { return (DB.items[id] && DB.items[id].n) || id; };

  // ── 頭目的外觀：從現有怪物借（名字比對），找不到就用備用 ──
  L.addMob('afk_rd_base', { n: '裂縫的影子', lv: REF, s: 'L', beh: '主動', boss: true, race: '裂縫', e: 'none', hp: 30000, ac: -70, mr: 100, exp: 8000, goldMin: 5000, goldMax: 9000, atkSpd: 1.6, dmg: [3, 45], db: 45, hit: 85,
    mag: { skn: '裂縫的碎光', cd: 70, chance: 0.4, dmg: [4, 60], db: 80, ele: 'none', alwaysHit: true } }, '闇黑的騎士范德');
  var baseCache = {};
  var findBase = function (re) {
    if (baseCache[re]) return baseCache[re];
    var rx = new RegExp(re), id = Object.keys(DB.mobs).filter(function (k) { var m = DB.mobs[k]; return m && m.n && rx.test(m.n) && m.hp > 0; }).sort(function (a, b) { return (DB.mobs[b].boss ? 1 : 0) - (DB.mobs[a].boss ? 1 : 0); })[0] || 'afk_rd_base';
    return (baseCache[re] = id);
  };
  var scale = function (base, Lv, hpMult) {
    var k = Lv / REF, m = JSON.parse(JSON.stringify(base));
    m.lv = Lv; m.hp = Math.max(1, Math.round((base.hp || 1000) * Math.pow(k, 2.5) * (hpMult || 1)));
    if (Array.isArray(base.dmg)) m.dmg = [base.dmg[0], Math.max(2, Math.round(base.dmg[1] * k))];
    m.db = Math.round((base.db || 0) * Math.pow(k, 1.3)); m.hit = Math.round((base.hit || 0) * k * 4 / 3);
    m.exp = Math.round((base.exp || 0) * k * k * 1.2); m.goldMin = Math.round((base.goldMin || 0) * k); m.goldMax = Math.round((base.goldMax || 0) * k);
    return m;
  };
  var POOL = function (maps) { var a = []; (maps || ['pride_91_100']).forEach(function (mp) { (DB.maps[mp] || []).forEach(function (id) { var m = DB.mobs[id]; if (m && !m.boss) a.push(id); }); }); return a.length ? a : ['afk_rd_base']; };

  // ── 共用機制 ──
  var party = function () { return L.boss.party(); };
  var hpOf = function (x) { return x === P() ? x.hp : x.curHp; };
  var setHp = function (x, v) { if (x === P()) x.hp = v; else x.curHp = v; };
  var mhp = function (x) { return x.mhp || 1; };
  var status = function (x, k, t) { try { var B = W.AFK_RELIC_DEFENSE_BRIDGE; if (B && B.setStatus) B.setStatus(x, k, t, null); else (x.statuses || (x.statuses = {}))[k] = t; } catch (e) {} };
  var who = function (x) { return x === P() ? '你' : (x._allyName || x.name || '傭兵'); };
  var allPct = function (pct, label) { party().forEach(function (x) { L.boss.hurt(x, mhp(x) * pct); }); if (label) clog(label); };
  var every = function (M, key, sec, t) { if (!M[key]) M[key] = t + sec * 10; if (t >= M[key]) { M[key] = t + sec * 10; return true; } return false; };
  var alive = function (f) { return mobs().filter(function (x) { return x && !x._dead && x.curHp > 0 && (!f || f(x)); }); };
  var bossOf = function () { return alive(function (x) { return x._rdBoss; })[0]; };
  var heal = function (pct) { party().forEach(function (x) { setHp(x, Math.min(mhp(x), Math.floor(hpOf(x) + mhp(x) * pct))); }); };
  var execute = function (th, back, label) { party().forEach(function (x) { if (hpOf(x) < mhp(x) * th) { setHp(x, 1); (function (y) { setTimeout(function () { try { if (run && !y.dead) setHp(y, Math.max(hpOf(y), Math.floor(mhp(y) * back))); } catch (e) {} }, 1000); })(x); } }); if (label) clog(label); };
  var tag = function (c, s) { return '<span class="font-bold" style="color:' + c + '">【' + s + '】</span>'; };
  // 增益全消：清掉身上的增益（變身、72 分鐘以上的長效增益不算）
  var dispel = function (label, list) { (list || party()).forEach(function (x) { var b = x && x.buffs; if (!b) return; Object.keys(b).forEach(function (k) { if (k !== 'poly' && typeof b[k] === 'number' && b[k] > 0 && b[k] < 43200) b[k] = 0; }); }); try { calcStats(); } catch (e) {} if (label) clog(label); };
  var barrier = function (x) { var b = x && x.buffs; return !!(b && ((b.sk_magic_shield || 0) > 0 || (b.sk_abs_barrier || 0) > 0)); };
  var MELEE = { knight: 1, dark: 1, dragon: 1, warrior: 1, royal: 1 };
  var front = function (x) { return !!(x && MELEE[x.cls]); };
  // 四龍・裂縫的房間傷害（每秒，侵蝕、光蝕另外算）：物理 1,000（扣傷害減免）＋真實 1,000＋魔法 1,000（照魔防）＋該龍屬性 1,000（照屬性抗性）＋最大 HP 1%
  var DRAGON_ELE = { '安塔瑞斯': 'earth', '法利昂': 'water', '林德拜爾': 'wind', '巴拉卡斯': 'fire' };
  var ROOM = { phys: 1000, tru: 1000, mag: 1000, ele: 1000, pct: 0.01 };
  var roomDmg = function (run) {
    var ele = DRAGON_ELE[run.pick] || 'none';
    party().forEach(function (x) {
      var d = x.d || x, ph = Math.max(0, ROOM.phys - (Number(d.dr) || 0));
      var mg = ROOM.mag * (typeof mrMult === 'function' ? mrMult(Math.max(0, Number(d.mr) || 0)) : 1);
      var el = ROOM.ele * (1 - (typeof magicAttrDefense === 'function' ? magicAttrDefense(x, ele) : 0));
      var cut = 1 - ((W.__afkDimRelic && W.__afkDimRelic.roomCut()) || 0); L.boss.hurt(x, (ph + mg + el) * cut, false); L.boss.hurt(x, (ROOM.tru + mhp(x) * ROOM.pct) * cut);
    });
  };
  // 封印戰：四龍守四角（第一段會被墜落物打，不能治療，倒下就失去那一項）
  var DRAGONS = [['ant', '安塔瑞斯', '全隊受到的傷害 −10%'], ['fa', '法利昂', '受到的治療 +20%'], ['val', '巴拉卡斯', '造成的傷害 +10%'], ['lin', '林德拜爾', '裁決之光的傷害 −50%']];
  var dragonOn = function (k) { return !!(run && run.dragons && run.dragons[k] > 0); };
  var judge = function (x, back) { var cur = hpOf(x), th = 0.5 - (P() && P().afkDimRift && P().afkDimRift.soulMem ? 0.05 : 0); if (cur >= mhp(x) * th) return; var to = dragonOn('lin') ? Math.max(1, Math.floor(cur - (cur - 1) / 2)) : 1; setHp(x, to); setTimeout(function () { try { if (run) setHp(x, Math.max(hpOf(x), Math.floor(mhp(x) * back))); } catch (e) {} }, 1000); };

  // ── 副本表 ──
  // stage：{ n 名稱, waves 一般波數, pool 怪物地圖, per 每波隻數, dur 秒（時間到就叫頭目／timed 撐滿就過）, boss:{ n, re, hp 絕對值或 hpX 倍率, lv, adds, mech(run,b,t,M), dmgIn(run,b,amt,kind,M) } }
  var D = [];
  var def = function (o) { o.per = o.per || 'day'; o.limit = o.limit || 1; D.push(o); return o; };

  def({ id: 'hardin', n: '哈汀的時空・裂縫', tier: 1, fee: { blood: 100 }, min: 25, lore: '1～6 波魔界怪，封印儀式要在 90 秒內打斷 4 條伊娃的鎖鏈；7～12 波賽尼斯加入，每 15 秒全隊回 5%。哈汀 HP 30% 合上禁書：60 秒不受傷、全隊每秒 −1%，撐過就通關。',
    stages: [
      { n: '魔界的波', waves: 6, boss: { n: '伊娃的鎖鏈', re: '鎖鏈|守衛', hpX: 3, adds: 3, addN: '伊娃的鎖鏈', ritual: 90, mech: function (run, b, t, M) { if (!M.t0) M.t0 = t; if (t - M.t0 > 900) fail('封印儀式完成了——你沒能打斷伊娃的鎖鏈。'); } } },
      { n: '賽尼斯加入', waves: 6, onTick: function (run, t, M) { if (every(M, 'senis', 15, t)) { heal(0.05); clog('<span class="text-sky-300">賽尼斯的水流過全隊（回復 5%）。</span>'); } },
        boss: { n: '黑暗大法師 哈汀', re: '哈汀', hpX: 14, final: true,
          mech: function (run, b, t, M) {
            if (every(M, 'senis', 15, t)) heal(0.05);
            if (!M.book && b.curHp <= b.hp * 0.3) { M.book = t + 600; clog(tag('#a78bfa', '合上禁書') + '哈汀不再受傷——撐過 60 秒「禁書的反噬」。'); }
            if (M.book) { if (t % 10 === 0) allPct(0.01); if (t >= M.book) { b.curHp = 0; b._rdForce = true; } }
          },
          dmgIn: function (run, b, amt, kind, M) { return M.book && !b._rdForce ? 0 : amt; } } }
    ],
    reward: function (r) { return [give('afk_rd_sand', rr(1, 2)), give('afk_rift_shard', rr(20, 40)), give('afk_rd_hmark', 2)]; } });

  def({ id: 'treason', n: '謀叛者的低語・裂縫', tier: 1, fee: { blood: 500 }, min: 30, needClear: 'hardin', lore: '八長老 → 四大軍王 → 丹特斯與肯恩。賽尼斯每 15 秒全隊回 5%。肯恩 HP 20%「作證」：60 秒裡每 10 秒三道光柱，各打最大 HP 40%；最後光落在肯恩身上。',
    stages: [
      { n: '八長老', waves: 2, boss: { n: '長老會議', re: '長老', hpX: 4, adds: 3, addN: '長老' } },
      { n: '四大軍王', waves: 2, boss: { n: '軍王', re: '軍王|將軍', hpX: 5, adds: 3, addN: '軍王' } },
      { n: '冥皇與反王', waves: 1, boss: { n: '反王 肯恩', re: '肯恩|反王', hpX: 16, final: true, adds: 1, addN: '冥皇丹特斯', addRe: '丹特斯',
        mech: function (run, b, t, M) {
          if (every(M, 'senis', 15, t)) heal(0.05);
          if (!M.wit && b.curHp <= b.hp * 0.2) { M.wit = t + 600; clog(tag('#fde047', '作證') + '肯恩舉起了手——裁決之光要落下了（撐 60 秒）。'); }
          if (M.wit) { if (every(M, 'pillar', 10, t)) { var blk = 0; party().sort(function () { return Math.random() - 0.5; }).slice(0, 3).forEach(function (x) { if (barrier(x) && !blk) { blk = 1; return; } L.boss.hurt(x, mhp(x) * 0.4); }); clog(tag('#fde047', '光柱') + '三道光柱落下。' + (blk ? '<span class="text-sky-300">（魔法屏障擋下了一道）</span>' : '')); }
            if (t >= M.wit) { clog('<span class="text-amber-200">最後一道光落在肯恩身上。他沒有躲。</span>'); b.curHp = 0; b._rdForce = true; } }
        }, dmgIn: function (run, b, amt, kind, M) { return M.wit && !b._rdForce ? 0 : amt; } } }
    ],
    reward: function () { return [give('sherine_crystal', rr(40, 80)), Math.random() < 0.3 ? give('afk_asc_shard', rr(2, 4)) : '', give('afk_rd_sand', rr(1, 2)), Math.random() < 0.05 ? give('afk_rd_water', 1) : '']; } });

  def({ id: 'past', n: '回到過去的時光・裂縫', tier: 1, fee: { blood: 1000, items: [['afk_rd_sand', 5]] }, min: 30, needClear: 'treason', meter: true, lore: '時間線穩定度 100% → 0% 就失敗。艾爾摩礦坑（金線每 45 秒，有相消術卷軸會自動讓它縮回，沒有就 −25%）、紅獅王的冬至夜（號角：30 秒全隊每秒 −2%）、反王之夜（窺視者每 40 秒詠唱，8 秒內打掉 3% 否則 −20%；第 9 分鐘起傷害 ×2）。蛀蟲、呼喊者活著每隻每秒 −0.5%，有人倒下 −5%。',
    stages: [
      { n: '艾爾摩礦坑', waves: 4, onTick: function (run, t, M) { if (every(M, 'gold', 45, t)) { if (cnt('afk_cancel_scroll') > 0) { take('afk_cancel_scroll', 1); clog('<span class="text-emerald-300">金線碰到相消的光，縮了回去（用掉相消術卷軸 1）。</span>'); } else { run.meter -= 25; clog(tag('#fde047', '金線') + '金線碰到了阿斯泰——穩定度 −25%。'); } } },
        boss: { n: '搜尋之光', re: '光|天使', hp: 1e7 } },
      { n: '紅獅王的冬至夜', waves: 3, onTick: function (run, t, M) { if (!M.horn) M.horn = t + 3600; if (t >= M.horn && !M.hornEnd) { M.hornEnd = t + 300; clog(tag('#fde047', '號角') + '聖光滿溢，30 秒全隊每秒 −2%。'); } if (M.hornEnd && t < M.hornEnd && t % 10 === 0) allPct(0.02);
          if (every(M, 'shadow', 60, t)) { summonRd(findBase('影'), 1, { _rd: true, _dimRift: true, _rdShadow: t + 150, n: '走向窗邊的影子', noAutoTeleport: true }); clog(tag('#a78bfa', '影子') + '一道影子往窗邊走——15 秒內打倒牠！'); }
          alive(function (x) { return x._rdShadow && t >= x._rdShadow; }).forEach(function (x) { x.curHp = 0; x._dead = true; run.meter -= 15; clog('<span class="text-red-400">影子走到了窗邊——穩定度 −15%。</span>'); }); },
        boss: { n: '守門影', re: '影', hp: 1.5e7 } },
      { n: '反王之夜', waves: 3, boss: { n: '裂痕的窺視者', re: '窺視|眼', hp: 4.5e7, final: true,
        mech: function (run, b, t, M) {
          if (!M.t0) M.t0 = t;
          if (every(M, 'chant', 40, t)) { M.chant = t + 80; M.mark = b.curHp; clog(tag('#a78bfa', '詠唱') + '8 秒內打掉牠 3%！'); }
          if (M.chant && t >= M.chant) { if (M.mark - b.curHp < b.hp * 0.03) { run.meter -= 20; clog('<span class="text-red-400">詠唱完成——穩定度 −20%。</span>'); } M.chant = 0; }
          if (every(M, 'disp', 20, t)) { dispel(tag('#93c5fd', '黑夜') + '全隊的增益被抹去，目盲 5 秒。'); party().forEach(function (x) { status(x, 'blind', 50); }); }
          if (every(M, 'call', 15, t)) summonRd(findBase('呼喊|亡靈|幽靈'), 2, { _rd: true, _dimRift: true, _rdWorm: true, noAutoTeleport: true });
        }, dmgOut: function (run, b, M) { return M.t0 && tk() - M.t0 > 5400 ? 2 : 1; } } }
    ],
    meterTick: function (run, t) { if (t % 10 === 0) run.meter -= 0.5 * alive(function (x) { return x._rdWorm; }).length; },
    reward: function (r) { return [give('afk_rd_sand', rr(3, 5) + (r.meter >= 80 ? 2 : 0)), Math.random() < 0.2 ? give('afk_rd_water', 1) : '', give('afk_rift_shard', rr(30, 50)), give('afk_dream_crystal', 30)]; } });

  def({ id: 'clock', n: 'A 沉默的鐘樓', tier: 1, fee: { blood: 200 }, min: 20, limit: 2, lore: '10 層，每層打倒鐘擺守衛拿鑰匙上樓；第 5 層鏽蝕的鐘匠、第 10 層停擺之主 克羅諾斯塔（每 60 秒敲鐘，全隊時間停止 2 秒）。剩下的時間越多寶箱越好（>10 分、>5 分、其他）。',
    stages: (function () { var a = []; for (var i = 1; i <= 10; i++) a.push({ n: '第 ' + i + ' 層', waves: 1, per: 3, boss: i === 10 ? { n: '停擺之主 克羅諾斯塔', re: '時|鐘|守護', hpX: 14, final: true, mech: function (run, b, t, M) {
        if (!M.bell) M.bell = t + 600;
        if (!M.gear && t >= M.bell - 50) { M.gear = 1; M.safe = false; summonRd('afk_rd_base', 1, { _rd: true, _dimRift: true, _rdGear: true, n: '發光的齒輪', hp: Math.max(1000, Math.floor(b.hp * 0.004)), noAutoTeleport: true }); clog(tag('#fde047', '齒輪') + '發光的齒輪轉起來了——5 秒內打倒它，鐘聲就停不住你們。'); }
        if (t >= M.bell) { M.bell = t + 600; M.gear = 0; alive(function (x) { return x._rdGear; }).forEach(function (x) { x.curHp = 0; x._dead = true; }); if (M.safe) clog('<span class="text-emerald-300">鐘響了，但齒輪的光護住了全隊。</span>'); else { party().forEach(function (x) { status(x, 'stun', 20); }); clog(tag('#93c5fd', '敲鐘') + '時間停止了 2 秒。'); } }
      } }
      : { n: i === 5 ? '鏽蝕的鐘匠' : '鐘擺守衛', re: '機械|人偶|守衛', hpX: i === 5 ? 6 : 2 } }); return a; })(),
    onKill: function (r, m) { if (m._rdGear && r.M) { r.M.safe = true; clog('<span class="text-emerald-300">齒輪的光亮了起來。</span>'); } },
    reward: function (r) { var left = (r.until - Date.now()) / 60000, g = left > 10 ? 3 : left > 5 ? 2 : 1; return [give('afk_dim_crystal', 20 * g), give('afk_rift_shard', 15 * g), g >= 3 && Math.random() < 0.2 ? give('afk_mio_dim', 1) : '']; } });

  def({ id: 'mirror', n: 'B 倒影迴廊', tier: 1, fee: { blood: 300 }, min: 15, lore: '3 個房間，敵人是你隊伍的倒影（你們裂縫面板的 70%）。最後的映照者 米菈：倒影活著時她受到的傷害 −50%。',
    stages: [1, 2, 3].map(function (i) { return { n: '第 ' + i + ' 房', waves: 0, mirror: true, boss: i === 3 ? { n: '映照者 米菈', re: '鏡|映', hpX: 12, final: true, mirrorAdds: true,
      mech: function (run, b, t, M) { if (!every(M, 'swap', 25, t)) return; var ms = alive(function (x) { return x._rdMirror; }); if (!ms.length) return; var m = ms[Math.floor(Math.random() * ms.length)], x = m._rdOf === 'p' ? P() : (P().allies || [])[m._rdOf]; if (!x || hpOf(x) <= 0) return; var rx = hpOf(x) / mhp(x), rm = m.curHp / m.hp; setHp(x, Math.max(1, Math.floor(mhp(x) * rm))); m.curHp = Math.max(1, Math.floor(m.hp * rx)); clog(tag('#c4b5fd', '映照') + who(x) + '和自己的倒影交換了位置（HP 比例對調）。'); },
      dmgIn: function (run, b, amt) { return alive(function (x) { return x._rdMirror; }).length ? amt * 0.5 : amt; } } : null }; }),
    reward: function () { return [give('afk_rd_mirror', 1), give('afk_dim_crystal', 30)]; } });

  def({ id: 'dragons', n: '四龍副本・裂縫', tier: 2, fee: { blood: 500 }, min: 40, pick: [['安塔瑞斯', '安塔瑞斯'], ['法利昂', '法利昂'], ['林德拜爾', '林德拜爾'], ['巴拉卡斯', '巴拉卡斯']], onTick: null, lore: '每座龍每天 1 次。整場房間每秒造成物理 1,000、真實 1,000、魔法 1,000、該龍屬性 1,000（各自照減傷、魔防、屬性抗性算）與最大 HP 1%；龍之護甲每 40 秒 10 秒，每一下先扣 5,000；每 4 分鐘沒打倒「龍怒」傷害 +20%。',
    stages: [
      { n: '巢穴前段', waves: 3, onTick: function (run, t) { if (t % 10 === 0) roomDmg(run); } },
      { n: '巢穴深處', waves: 2, onTick: function (run, t) { if (t % 10 === 0 && !bossOf()) roomDmg(run); }, boss: { n: '', re: '', hpX: 30, final: true, dragon: true,
        mech: function (run, b, t, M) { if (t % 10 === 0) roomDmg(run); if (every(M, 'armor', 40, t)) { M.armor = t + 100; clog(tag('#fb923c', '龍之護甲') + '10 秒內每一下先扣 5,000。'); } if (every(M, 'fury', 240, t) && !(W.__afkDimRelic && W.__afkDimRelic.noFury())) { M.fury = (M.fury || 0) + 1; clog(tag('#f87171', '龍怒') + '傷害 +' + (M.fury * 20) + '%'); } },
        dmgIn: function (run, b, amt, kind, M) { return (M.armor || 0) > tk() && !(W.__afkDimRelic && W.__afkDimRelic.ignoreArmor()) ? Math.max(0, amt - 5000) : amt; }, dmgOut: function (run, b, M) { return 1 + 0.2 * (M.fury || 0); } } }
    ],
    reward: function () { return [give('afk_rd_scale', rr(3, 5)), Math.random() < 0.02 ? give('afk_abyss_key', 1) : '', give('afk_rift_shard', 50)]; } });

  def({ id: 'mine', n: 'C 燃燼礦坑', tier: 2, fee: { blood: 500 }, min: 11, lore: '保護裂縫鑽機 10 分鐘，怪物每 30 秒一波（共 20 波）。鑽機 HP 歸零就失敗；第 10、20 波熔岩挖掘者 博格會直接打鑽機。鑽機每撐 1 分鐘產出 1 個熾燼原石。',
    stages: [{ n: '鑽機', timed: 600, spawnEvery: 30, per: 3, waveBoss: { 10: 1, 20: 1 }, boss: { n: '熔岩挖掘者 博格', re: '挖掘|礦|岩', hpX: 6 } }],
    onStart: function (r) { r.drill = 100; r.ore = 0; },
    drillTick: function (r, t) { if (t % 10) return; var n = alive().length, bo = alive(function (x) { return x._rdBoss; }).length; r.drill -= n * 0.08 + bo * 1; if (t % 600 === 0 && t > r.t0) r.ore++; if (r.drill <= 0) fail('裂縫鑽機被打壞了。'); },
    reward: function (r) { return [give('afk_rd_ember', Math.max(1, r.ore)), give('afk_dim_crystal', 30)]; } });

  def({ id: 'ship', n: 'D 漂流的墓船', tier: 2, fee: { blood: 500 }, min: 25, lore: '三艘船依序登船，每艘船有船長。最後的深淵的大王烏賊：8 條觸手全部打斷前本體不受傷；每 30 秒墨潮，全隊命中 −50% 5 秒（目盲）。',
    stages: [
      { n: '第一艘船', waves: 2, pool: ['zone_04', 'zone_05'], boss: { n: '亡靈船長', re: '船長|海賊', hpX: 5 } },
      { n: '第二艘船', waves: 2, pool: ['zone_04', 'zone_05'], boss: { n: '溺死的船長', re: '船長|海賊', hpX: 6 } },
      { n: '船底的巢', waves: 1, boss: { n: '深淵的大王烏賊', re: '烏賊|章魚|海', hpX: 20, final: true, adds: 4, addN: '觸手', tentacles: 8,
        mech: function (run, b, t, M) { if (M.cut == null) M.cut = 0; if (every(M, 'ink', 30, t)) { party().forEach(function (x) { status(x, 'blind', 50); }); clog(tag('#64748b', '墨潮') + '全隊命中 −50%（5 秒）。'); } if (M.cut < 8 && !alive(function (x) { return x._rdAdd; }).length) { summonRd(findBase('觸手|烏賊|章魚'), Math.min(4, 8 - M.cut), { _rd: true, _dimRift: true, _rdAdd: true, _rdTent: true, n: '觸手', noAutoTeleport: true }); } },
        dmgIn: function (run, b, amt, kind, M) { return (M.cut || 0) < 8 ? 0 : amt; } } }
    ],
    onKill: function (r, m) { if (m._rdTent && r.M) { r.M.cut = (r.M.cut || 0) + 1; clog('<span class="text-sky-300">打斷了第 ' + r.M.cut + '／8 條觸手。</span>'); } },
    reward: function () { return [give('afk_rd_ink', rr(2, 4)), Math.random() < 0.3 ? give('afk_rd_neptune', 1) : '', give('afk_dim_crystal', 30)]; } });

  var ANA = [6e7, 8e7, 1e8, 1.3e8, 1.6e8];
  def({ id: 'anakin', n: '墮光天使 阿納金', tier: 3, fee: { blood: 500, items: [['afk_rd_feather', 10]] }, min: 12, pick: [['1', '第 1 形態 號角'], ['2', '第 2 形態 神諭'], ['3', '第 3 形態 光翼'], ['4', '第 4 形態 天梯'], ['5', '第 5 形態 沉默']], pickChain: true,
    lore: '傲慢之塔頂「斷裂的天梯」。每形態每天 1 次，要先打倒前一形態。每 20 秒「擋」6 秒（受傷 −80%）。號角：每 30 秒全隊沉默 3 秒。神諭：每 20 秒光羽雨 3 人各 15%。光翼：HP 70%／40% 飛起 10 秒。天梯：每 60 秒 3 名天梯守衛，活著時他受傷 −50%。沉默：HP 30% 停手 30 秒，30 秒內打掉 10%，不然全隊斬殺。',
    stages: [{ n: '斷裂的天梯', waves: 0, boss: { n: '墮光天使 阿納金', re: '天使|阿納金', hpAbs: function (r) { return ANA[(+r.pick || 1) - 1]; }, final: true,
      mech: function (run, b, t, M) {
        var f = +run.pick || 1, cd = f === 5 ? 0.6 : 1;
        if (M.artF !== f) { M.artF = f; anakinArt(f); }
        if (every(M, 'block', 20, t)) { M.block = t + 60; clog(tag('#fde047', '擋') + '6 秒內受傷 −80%。'); }
        if ((f === 1 || f === 5) && every(M, 'sil', 30 * cd, t)) { party().forEach(function (x) { status(x, 'silence', 30); }); dispel(tag('#93c5fd', '號角') + '全隊沉默 3 秒，增益全部消失。'); }
        if ((f === 2 || f === 5) && every(M, 'rain', 20 * cd, t)) { party().sort(function () { return Math.random() - 0.5; }).slice(0, 3).forEach(function (x) { L.boss.hurt(x, mhp(x) * 0.15); }); clog(tag('#fde047', '光羽雨') + '三個人被光羽打中。'); }
        if (f === 3 || f === 5) [0.7, 0.4].forEach(function (th) { if (!M['fly' + th] && b.curHp <= b.hp * th) { M['fly' + th] = 1; M.fly = t + 100; clog(tag('#fde047', '光翼') + '阿納金飛了起來，10 秒打不到。'); } });
        if ((f === 4 || f === 5) && every(M, 'guard', 60 * cd, t)) { summonRd(findBase('天使|守衛'), 3, { _rd: true, _dimRift: true, _rdAdd: true, n: '天梯守衛', noAutoTeleport: true }); clog(tag('#fde047', '天梯') + '三名天梯守衛降下。'); }
        if (f === 5 && !M.stop && b.curHp <= b.hp * 0.3) { M.stop = t + 300; M.mark = b.curHp; clog(tag('#f87171', '沉默') + '阿納金停手了——30 秒內打掉他 10%！'); }
        if (M.stop && t >= M.stop) { if (M.mark - b.curHp < b.hp * 0.1) execute(0.6, 0.7, tag('#f87171', '斬殺') + 'HP 低於 60% 的人剩 1。'); M.stop = 0; M.stopDone = 1; }
      },
      dmgIn: function (run, b, amt, kind, M) { var t = tk(); if ((M.fly || 0) > t) return 0; if ((M.block || 0) > t) amt *= 0.2; if (alive(function (x) { return x._rdAdd; }).length) amt *= 0.5; return amt; } } }],
    reward: function (r) { var f = +r.pick || 1, a = [give('afk_rd_feather', rr(10, 20)), give('afk_rift_shard', rr(50, 100)), Math.random() < 0.05 ? give('afk_rd_pick', 1) : '']; if (f >= 3 && f <= 4 && Math.random() < 0.2) a.push(give('afk_rd_echo', 1)); if (f === 5) { a.push(give('afk_rd_echo', rr(1, 2))); var s = store(); if (!s.horn) { s.horn = Date.now(); a.push(give('afk_anakin_horn', 1)); } } return a; } });

  def({ id: 'altar', n: 'E 星墜的祭壇', tier: 3, per: 'week', fee: { blood: 1000 }, min: 30, lore: '每週 1 次。四座墜星各自免疫一種傷害（近、遠、魔，最後一座只吃真實以外的全部）；星蝕者 艾斯崔亞每 45 秒星線（兩個人各受到最大 HP 50%）；HP 20% 狂暴隕石雨，站在墜星殘骸裡減傷 70%。',
    stages: [
      { n: '墜星', waves: 0, boss: { n: '墜星', re: '星|石像', hpX: 6, adds: 3, addN: '墜星', stars: true, dmgIn: function (run, b, amt, kind) { return amt; } } },
      { n: '星蝕者', waves: 0, boss: { n: '星蝕者 艾斯崔亞', re: '星|女神|天使', hpX: 40, final: true,
        mech: function (run, b, t, M) { if (every(M, 'line', 45, t)) { var two = party().sort(function () { return Math.random() - 0.5; }).slice(0, 2); if (two.length === 2) { var k = front(two[0]) && front(two[1]) ? 0.5 : (front(two[0]) || front(two[1])) ? 0.1 : 0; if (k) two.forEach(function (x) { L.boss.hurt(x, mhp(x) * k); }); clog(tag('#a78bfa', '星線') + who(two[0]) + '和' + who(two[1]) + '被星線連住' + (k === 0.5 ? '——兩個人都站在前排，太近了，各受到最大 HP 50%。' : k ? '——一前一後，各受到最大 HP 10%。' : '——兩個人都在後排，距離夠遠。')); } } if (b.curHp <= b.hp * 0.2 && every(M, 'meteor', 3, t)) allPct(0.1 * 0.3); } } }
    ],
    reward: function () { return [give('afk_rd_eclipse', rr(1, 2)), give('afk_mio_dim', 1), give('afk_dim_crystal', 100)]; } });

  def({ id: 'seal', n: '封印戰「裂縫之中」', tier: 3, per: 'week', fee: { blood: 1500, items: [['afk_abyss_key', 1]] }, min: 30, needClear: 'anakin5', lore: '每週 1 次，三段。被鑿穿的天空（墜落的天使）→ 裂縫之中（第一世、第二世的你；監視之眼每 10 秒裁決之光：HP 低於 50% 剩 1，1 秒內補回 60%；你本人不吃）→ 封印（殷海薩：每 45 秒吸走增益、回 1%；HP 75／50／25% 縫合 3 個縫口，20 秒內打掉，沒打掉每個回 5%；HP 10% 光核 30 秒內打掉＝封印成功，不然回到 15%）。',
    stages: [
      { n: '被鑿穿的天空', waves: 6, pool: ['pride_91_100'], onTick: function (run, t, M) { if (!every(M, 'fall', 10, t)) return; var ks = DRAGONS.filter(function (d) { return run.dragons[d[0]] > 0; }); if (!ks.length) return; var d = ks[Math.floor(Math.random() * ks.length)]; run.dragons[d[0]] -= rr(12, 25); if (run.dragons[d[0]] <= 0) clog('<span class="text-red-400">' + d[1] + ' 被墜落的天使壓垮了——失去「' + d[2] + '」。</span>'); } },
      { n: '裂縫之中', waves: 0, boss: { n: '第二世的你', re: '騎士|戰士', hpX: 16, adds: 1, addN: '第一世的你', mech: function (run, b, t, M) {
        if (every(M, 'eyes', 20, t)) summonRd(findBase('眼'), 2, { _rd: true, _dimRift: true, _rdAdd: true, _rdEye: true, n: '監視之眼', noAutoTeleport: true });
        if (every(M, 'eye', 10, t) && alive(function (x) { return x._rdEye; }).length) { party().forEach(function (x) { if (x !== P()) judge(x, 0.6); }); clog(tag('#fde047', '裁決之光') + '監視之眼的光落下（死亡是不會被裁決的——你本人不受影響）。'); }
      } } },
      { n: '封印', waves: 0, boss: { n: '殷海薩', re: '殷海薩|女神', hp: 6e8, final: true,
        mech: function (run, b, t, M) {
          if (every(M, 'need', 45, t)) { b.curHp = Math.min(b.hp, b.curHp + Math.floor(b.hp * 0.01)); dispel(tag('#fde047', '我需要') + '殷海薩吸走了全隊的增益，回復 1%。'); }
          [0.75, 0.5, 0.25].forEach(function (th) { if (!M['st' + th] && b.curHp <= b.hp * th) { M['st' + th] = 1; M.stitch = t + 200; summonRd('afk_rd_base', 3, { _rd: true, _dimRift: true, _rdAdd: true, _rdStitch: true, n: '縫口', hp: Math.floor(b.hp * 0.02), noAutoTeleport: true }); clog(tag('#a78bfa', '縫合') + '3 個縫口出現了——20 秒內打掉！'); } });
          if (M.stitch && t >= M.stitch) { var left = alive(function (x) { return x._rdStitch; }); left.forEach(function (x) { x.curHp = 0; x._dead = true; }); if (left.length) { b.curHp = Math.min(b.hp, b.curHp + Math.floor(b.hp * 0.05 * left.length)); clog('<span class="text-red-400">沒打掉的縫口讓她回復了 ' + (5 * left.length) + '%。</span>'); } M.stitch = 0; }
          if (!M.core && b.curHp <= b.hp * 0.1) { M.core = t + 300; summonRd('afk_rd_base', 1, { _rd: true, _dimRift: true, _rdAdd: true, _rdCore: true, n: '最早的那一點光', hp: Math.floor(b.hp * 0.03), noAutoTeleport: true }); clog(tag('#fde047', '光核') + '30 秒內打掉「最早的那一點光」！'); }
          if (M.core && t >= M.core) { if (alive(function (x) { return x._rdCore; }).length) { alive(function (x) { return x._rdCore; }).forEach(function (x) { x.curHp = 0; x._dead = true; }); b.curHp = Math.floor(b.hp * 0.15); M.core = 0; clog('<span class="text-red-400">光核沒被打掉——殷海薩回到 15%。</span>'); } }
        },
        dmgIn: function (run, b, amt, kind, M) {   // 光核在場時，打在殷海薩身上的傷害轉到光核（隊友常常鎖定頭目，不轉的話光核幾乎打不到）
          if (!M.core) return amt;
          var c = alive(function (x) { return x._rdCore; })[0];
          if (c && amt > 0) { c.curHp -= amt; if (c.curHp <= 0) { c.curHp = 0; try { killMob(mapState.mobs.indexOf(c)); } catch (e) {} } }
          return 0; } } }
    ],
    onStart: function (r) { r.dragons = { ant: 100, fa: 100, val: 100, lin: 100 }; r.mirBuff = 0; clog('<span class="text-amber-200">四龍守住了四角：' + DRAGONS.map(function (d) { return d[1] + '（' + d[2] + '）'; }).join('、') + '。</span>'); },
    onKill: function (r, m) { if (r.si === 1 && (m._rdBoss || (m._rdAdd && !m._rdEye))) { r.mirBuff += 0.1; clog('<span class="text-emerald-300">收回了' + esc(m.n) + '——全隊造成的傷害 +' + Math.round(r.mirBuff * 100) + '%。</span>'); } if (m._rdCore) { var b = bossOf(); if (b) { b.curHp = 0; b._rdForce = true; clog('<span class="text-yellow-200 font-bold">最早的那一點光熄滅了。天空被縫上了。</span>'); } } },
    reward: function (r) { var s = store(), a = []; if (!s.sealFirst) { s.sealFirst = Date.now(); a.push(give('afk_rd_remnant', 1), give('afk_rd_thread', 10)); a.push('稱號「代理之人」'); try { var dr = DR.rec(P()); dr.agent = true; } catch (e) {} } a.push(give('afk_rd_thread', rr(3, 5)), Math.random() < 0.1 ? give('afk_rd_remnant', 1) : '', give('afk_rift_shard', 200)); return a; } });

  def({ id: 'endless', n: '無盡的裂縫', tier: 3, fee: { blood: 500, items: [['afk_star_core', 15], ['afk_rift_shard', 50]] }, min: 0, limit: 2, needClear: 'seal', endless: true, lore: '沒有時間上限，每 5 分鐘一層，每層最後一隻頭目。怪物 HP、傷害 ×（1＋0.15×層數）。你倒下或自己撤離就結束，記最高層數。每層頭目碎光 10＋層數；第 5 層起每層 5% 天空的縫線；第 10 層起每隻頭目 0.5% 殷海薩的殘光。',
    stages: [], reward: function (r) { var s = store(); s.best = Math.max(s.best || 0, r.floor || 0); return ['最高到第 ' + (r.floor || 0) + ' 層（紀錄 ' + s.best + '）']; } });
  def({ id: 'doom', n: '屠龍者的劍塚', npc: 'doom', tier: 0, noRift: true, fee: {}, min: 15, lore: '只有修習「絕望屠龍者」的龍騎士能進入（一轉後、席琳夢域鏡）。三段：劍塚的亡者 → 斷劍的龍騎士 → 握劍的回憶。最後的頭目每 15 秒「龍之咆哮」全隊受到最大 HP 10%；HP 50% 召喚兩把「不肯放下的劍」，劍還在時他受到的傷害 −50%。通關後就能在絕望屠龍者下拿起武器（拿著武器時一般攻擊的倍率從 ×10 變 ×5）。',
    stages: [
      { n: '劍塚的亡者', waves: 3, pool: ['dragon_valley'] },
      { n: '斷劍的龍騎士', waves: 2, pool: ['dragon_valley'], boss: { n: '斷劍的龍騎士', re: '龍騎士|騎士', hpX: 6 } },
      { n: '握劍的回憶', waves: 0, boss: { n: '握劍的回憶', re: '龍騎士|騎士', hpX: 14, final: true,
        mech: function (run, b, t, M) { if (every(M, 'roar', 15, t)) allPct(0.1, tag('#f87171', '龍之咆哮') + '全隊受到最大 HP 10%。'); if (!M.sw && b.curHp <= b.hp * 0.5) { M.sw = 1; summonRd(findBase('劍|騎士'), 2, { _rd: true, _rdAdd: true, n: '不肯放下的劍', noAutoTeleport: true }); clog(tag('#fde047', '劍') + '兩把劍從塚裡站了起來。'); } },
        dmgIn: function (run, b, amt) { return alive(function (x) { return x._rdAdd; }).length ? amt * 0.5 : amt; } } }
    ],
    reward: function () { var p = P(), a = []; if (!p.afkDoomWield) { p.afkDoomWield = Date.now(); a.push('「握劍」：絕望屠龍者也能裝備武器了'); } a.push(give('afk_dream_crystal', 50)); return a; } });
  var BYID = {}; D.forEach(function (d) { BYID[d.id] = d; });

  // ── 記錄 ──
  var store = function (p) { p = p || P(); if (!p) return {}; var s = p.afkRiftDg && typeof p.afkRiftDg === 'object' ? p.afkRiftDg : (p.afkRiftDg = {}); s.c = s.c || {}; s.clear = s.clear || {}; return s; };
  var useKey = function (d, pick) { return d.id + (pick && !d.pickChain ? ':' + pick : ''); };
  var used = function (d, pick) { var s = store(), k = useKey(d, pick) + (d.pickChain ? ':' + pick : ''), c = s.c[k], now = d.per === 'week' ? weekKey() : dayKey(); return c && c.at === now ? c.n : 0; };
  var mark = function (d, pick) { var s = store(), k = useKey(d, pick) + (d.pickChain ? ':' + pick : ''), now = d.per === 'week' ? weekKey() : dayKey(); var c = s.c[k]; if (!c || c.at !== now) c = s.c[k] = { at: now, n: 0 }; c.n++; };
  var tierNeed = function (d) { return d.tier === 3 ? 40 : d.tier === 2 ? 20 : 0; };
  var feeTxt = function (d) { var a = []; if (d.fee.blood) a.push('血龍鑽 ' + d.fee.blood.toLocaleString()); (d.fee.items || []).forEach(function (x) { a.push(nm(x[0]) + ' ×' + x[1]); }); return a.join('＋'); };
  var canEnter = function (d, pick) {
    var p = P(); if (!p) return '請先進入遊戲。'; if (p.classicMode) return '經典模式沒有。';
    if (d.id === 'doom') { if (p.cls !== 'dragon' || p.rebirthArt !== 'k_doom') return '只有修習絕望屠龍者的龍騎士能進入。'; if (!(Math.floor(p.rebirth || 0) >= 1)) return '一轉後才能進入。'; if (!(p.sherineDream && p.sherineMad)) return '要在席琳夢域鏡。'; if (p.afkDoomWield) return '你已經握回了劍。'; }
    else { if (!DR.on()) return '要先在席琳那裡打開次元裂縫。'; if (DR.recoverPct(p) < tierNeed(d)) return '要取回 ' + tierNeed(d) + '% 以上的力量。'; }
    var s = store(p); if (d.needClear && !s.clear[d.needClear]) return '要先通關「' + (d.needClear === 'anakin5' ? '阿納金第 5 形態' : BYID[d.needClear].n) + '」。';
    if (d.pickChain && +pick > 1 && !s.clear['anakin' + (+pick - 1)]) return '要先打倒前一個形態。';
    if (used(d, pick) >= d.limit) return d.per === 'week' ? '這週已經挑戰過了。' : '今天的次數用完了。';
    if (d.fee.blood && cnt(BLOOD) < d.fee.blood) return '血龍鑽不夠。';
    var lack = (d.fee.items || []).filter(function (x) { return cnt(x[0]) < x[1]; })[0]; if (lack) return nm(lack[0]) + '不夠。';
    var st = S(); if (st.riftRun || st._afkFinal || st.antharas || st.prideClimb) return '你正身在其他副本之中。';
    if (d.id === 'doom') { if (typeof mapState !== 'undefined' && mapState.current !== DOOM_TOWN) return '要在貝希摩斯（劍塚的守墓人在那裡）。'; }   // Ping 11-12：守墓人搬到龍騎士出生地
    else if (typeof mapState !== 'undefined' && mapState.current !== TOWN) return '要在席琳神殿。';
    return '';
  };

  // ── 地圖 ──
  DB.maps[MAP] = (DB.maps.pride_91_100 || []).slice(0, 1);
  try { W.__afkNoOfflineMaps = (W.__afkNoOfflineMaps || []).concat([MAP]); } catch (e) {}
  try { SPECIAL_AREA_BG[MAP] = 'assets/area/地監深層.jpg'; } catch (e) {}
  try { if (typeof SANCTUARY_MAP_NAMES !== 'undefined') SANCTUARY_MAP_NAMES[MAP] = '次元裂縫'; } catch (e) {}

  var run = null, lastMap = null, leaving = 0;
  var allyN = function () { var p = P(); return p ? (p.allies || []).filter(function (a) { return a && !a._downed; }).length : 0; };
  var endlessStage = function (f) { return { n: '第 ' + f + ' 層', dur: 300, per: 4, boss: { n: '第 ' + f + ' 層的守門者', re: '守護|騎士|惡魔', hpX: 8, final: false } }; };
  var curStage = function () { return run.D.endless ? endlessStage(run.floor) : run.D.stages[run.si]; };
  var enter = function (id, pick) {
    var d = BYID[id], p = P(); if (!d) return; var why = canEnter(d, pick); if (why) { sys('<span class="text-amber-300">' + esc(NPC_N) + '：' + esc(why) + '</span>'); return; }
    if (d.fee.blood) take(BLOOD, d.fee.blood); (d.fee.items || []).forEach(function (x) { take(x[0], x[1]); });
    mark(d, pick);
    try { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); } catch (e) {}
    mapState.current = MAP; p.lastBattleMap = MAP;
    mapState.mobs = [null, null, null, null, null]; mapState.spawnAt = [null, null, null, null, null]; mapState.targetIdx = -1; mapState.forceBoss = false;
    run = { id: id, D: d, pick: pick, si: 0, wave: 0, pending: true, t0: tk(), st0: tk(), until: d.min ? Date.now() + d.min * 60000 : 0, lv: Math.max(80, Math.min(130, (Number(p.lv) || 100) + 5 * d.tier)), meter: 100, floor: 1, M: {}, SM: {}, deaths: 0 };
    if (d.onStart) d.onStart(run);
    backTown = id === 'doom' ? DOOM_TOWN : TOWN;
    try { SPECIAL_AREA_BG[MAP] = 'assets/area/1920x1080/rift_' + id + '.jpg'; } catch (e) {}   // 11-12：每個副本自己的背景（GPT）
    lastMap = MAP;
    sys('<span class="font-bold" style="color:#67e8f9">🌀 你走進了「' + esc(d.n) + (pick && d.pick ? '・' + esc((d.pick.filter(function (x) { return x[0] === pick; })[0] || [])[1] || pick) : '') + '」。</span>');
    try {
      var mapPanel = document.getElementById('town-view').parentElement;
      document.getElementById('battle-view').classList.remove('hidden'); document.getElementById('combat-log-panel').classList.remove('hidden');
      document.getElementById('town-view').classList.add('hidden'); document.getElementById('town-view').classList.remove('flex'); mapPanel.classList.remove('flex-1', 'overflow-hidden');
    } catch (e) {}
    try { if (typeof applyAreaBackground === 'function') applyAreaBackground(); } catch (e) {}
    try { renderMobs(); syncMapSelectors(); updateUI(); renderTabs(true); saveGame(); } catch (e) {}
  };
  var leave = function (msg) {
    run = null; leaving = Date.now(); if (msg) sys(msg);
    setTimeout(function () { try { if (mapState.current === MAP && run === null) { setMapSelectors(backTown); changeMap(true); try { saveGame(); } catch (e) {} } } catch (e) {} }, 1500);
  };
  function fail(msg) { if (!run) return; var r = run; if (r.D.endless) { finish(true); return; } leave('<span class="text-red-400">' + esc(msg) + '——挑戰失敗。</span>'); }
  var points = function () { var p = P(), dr = DR.rec(p), dk = dayKey(); if (dr.ptsDay !== dk) { dr.ptsDay = dk; dr.ptsToday = 0; } var key = 'pf_' + run.id + (run.pick || ''); dr.ptsSeen = dr.ptsSeen || {}; if (dr.ptsSeen[key] === dk || dr.ptsToday >= R.ptsDay) return ''; dr.ptsSeen[key] = dk; var g = Math.min(R.pts, R.ptsDay - dr.ptsToday); dr.ptsToday += g; dr.pts = (dr.pts || 0) + g; return '裂縫點數 +' + g; };
  function finish(endless) {
    var r = run, d = r.D, s = store(), got;
    if (!endless) s.clear[d.id + (d.pickChain ? r.pick : '')] = s.clear[d.id] = Date.now();
    got = (d.reward(r) || []).filter(Boolean); var pt = d.noRift ? '' : endless ? (r.floor > 1 ? points() : '') : points(); if (pt) got.push(pt);
    leave('<span class="text-cyan-200 font-bold">🏆 「' + esc(d.n) + '」' + (endless ? '結束' : '通關') + '。</span><span class="text-amber-200">得到：' + (got.length ? got.map(esc).join('、') : '—') + '</span>');
  }
  // 機制叫出來的怪：HP 不吃夢域鏡倍率；有給 hp 就照給的，沒給就用頭目最大 HP 的 0.5%（沒頭目時用一般怪的基準）
  var summonRd = function (id, n, extra) {
    var ms = mapState.mobs, before = ms.slice(), got = L.boss.summon(id, n, extra);
    var b = (typeof bossOf === 'function') ? bossOf() : null;
    var hp = extra && extra.hp ? extra.hp : b ? b.hp * 0.005 : R.mobRef * Math.pow(((run && run.lv) || 100) / REF, 2.5) * R.mobHpK * ((run && hpTOf(run)) || 1);
    ms.forEach(function (m, i) { if (m && !m._dead && m !== before[i]) { m.hp = m.curHp = Math.max(1, Math.round(hp)); } });
    return got;
  };
  var hpTOf = function (r) { return R.hpT[r.D.id + (r.D.pickChain ? r.pick : '')] || R.hpT[r.D.id] || 1; };
  var place = function (idx, baseId, Lv, hpMult, extra, absHp) {
    var b = DB.mobs[baseId] || DB.mobs.afk_rd_base, m = scale(b, Lv, hpMult);
    m.hp = Math.max(1, Math.round((extra && extra._rdBoss || extra && extra._rdAdd ? R.bossRef : R.mobRef) * Math.pow(Lv / REF, 2.5) * (hpMult || 1)));
    if (absHp) m.hp = Math.round(absHp);
    var tk2 = run && !(extra && extra._rdMirror) && hpTOf(run); if (tk2) m.hp = Math.round(m.hp * tk2);
    var mob = L.boss.place(idx, m, Object.assign({ mobId: baseId, _rd: true, _dimRift: !(run && run.D.noRift), noAutoTeleport: true, noCharm: true }, extra || {}));
    if (extra && extra.n) { mob.n = extra.n; try { if (b.n && b.n !== extra.n) { L.aliasAnim(extra.n, b.n); if (b.img && !mob.img) mob.img = b.img; } } catch (e) {} }   // 11-11：改名的頭目沿用原型的動畫（原本找不到圖，顯示成深色方塊）
    if (mob) { mob.hp = mob.curHp = m.hp; }   // HP 用這裡算好的（不再乘夢域鏡的怪物倍率；攻擊、命中等其他倍率照舊）
    return mob;
  };
  var endlessK = function () { return run.D.endless ? 1 + 0.15 * run.floor : 1; };
  var spawnWave = function () {
    var st = curStage(), d = run.D, hpk = (1 + R.allyHp * allyN()) * (d.noRift ? 1 : R.riftHp) * endlessK(), lv = d.noRift ? Math.max(60, Number(P().lv) || 80) : run.lv;
    run.pending = false;
    var bossTime = st.boss && (st.dur ? (tk() - run.st0) >= st.dur * 10 : run.wave >= (st.waves || 0));
    if (st.timed) bossTime = st.waveBoss && st.waveBoss[run.wave + 1];
    if (st.mirror && !st.boss) { mirrorWave(lv, hpk); return; }
    if (bossTime && st.boss) {
      var bd = st.boss, re = bd.dragon ? run.pick : bd.re, baseId = re ? findBase(re) : 'afk_rd_base';
      var abs = typeof bd.hpAbs === 'function' ? bd.hpAbs(run) : bd.hp, n = bd.dragon ? (DB.mobs[baseId] ? DB.mobs[baseId].n : run.pick) : bd.n;
      var m = place(2, baseId, lv + 5, (bd.hpX || 10) * hpk, { _rdBoss: true, _rdFinal: !!bd.final, boss: true, n: n }, abs ? abs * (1 + R.allyHp * allyN()) * endlessK() : 0);
      run.M = {}; run.bd = bd;
      if (bd.adds) { var aBase = bd.addRe ? findBase(bd.addRe) : baseId; for (var i = 0; i < bd.adds; i++) { var a = place([1, 3, 0, 4][i], aBase, lv, (bd.tentacles ? 1.5 : (bd.hpX || 10) * 0.4) * hpk, { _rdAdd: true, _rdTent: !!bd.tentacles, n: bd.addN || n }); a.boss = false; } }
      if (bd.mirrorAdds) mirrorWave(lv, hpk, true);
      if (bd.stars) { var ks = [['melee', '近距離'], ['ranged', '遠距離'], ['magic', '魔法'], ['all', '真實傷害以外']]; [m].concat(alive(function (x) { return x._rdAdd; })).forEach(function (x, i) { x._rdStar = ks[i][0]; x.n = '墜星（免疫' + ks[i][1] + '）'; }); }
      clog('<span class="font-bold" style="color:#67e8f9">【' + esc(st.n) + '】</span>' + esc(m.n) + ' 現身了。', 'enemy');
      try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(m); } catch (e) {}
      if (st.timed) run.wave++;
    } else {
      var pool = POOL(st.pool), per = st.per || 4, free = [0, 1, 2, 3, 4].filter(function (i) { var x = mobs()[i]; return !x || x._dead || x.curHp <= 0; });
      for (var j = 0; j < per && j < free.length; j++) { var id = pool[Math.floor(Math.random() * pool.length)]; place(free[j], id, lv, R.mobHpK * hpk, d.id === 'past' ? { _rdWorm: true } : {}); }
      run.wave++;
    }
    try { if (!S().ff) renderMobs(); } catch (e) {}
  };
  var mirrorWave = function (lv, hpk, skipBoss) {
    var p = P(), list = [p].concat((p.allies || []).filter(Boolean)).slice(0, skipBoss ? 2 : 4), slots = skipBoss ? [1, 3] : [0, 1, 3, 4];
    list.forEach(function (x, i) {
      var mh = Math.max(1000, Math.round((x.mhp || 1000) * 0.7 * 15 * (hpk / R.riftHp))), dmg = Math.max(20, Math.round(((x.d && (x.d.meleeDmg || x.d.dmg)) || 60) * 0.7));
      var m = place(slots[i], findBase('騎士|戰士'), lv, 1, { _rdMirror: true, _rdOf: x === p ? 'p' : (p.allies || []).indexOf(x), _rdAdd: !!skipBoss, n: (x === p ? '你' : (x._allyName || x.name || '傭兵')) + '的倒影', boss: false }, mh);
      m.dmg = [1, dmg];
    });
    if (!skipBoss) run.wave++;
  };
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      if (mapState.current === MAP) { if (!mobs()[idx] || mobs()[idx]._dead) mobs()[idx] = null; if (run && run.pending && idx === 0) spawnWave(); return; }
      return oSpawn.apply(this, arguments);
    };
  }
  var nextStage = function () {
    var d = run.D;
    if (d.endless) { var f = run.floor, a = []; a.push(give('afk_rift_shard', 10 + f)); if (f >= 5 && Math.random() < 0.05) a.push(give('afk_rd_thread', 1)); if (f >= 10 && Math.random() < 0.005) a.push(give('afk_rd_remnant', 1)); run.floor++; sys('<span style="color:#67e8f9">第 ' + f + ' 層的守門者倒下了（' + a.filter(Boolean).map(esc).join('、') + '）。第 ' + run.floor + ' 層。</span>'); }
    else if (run.si + 1 >= d.stages.length) { finish(); return false; }
    else { run.si++; sys('<span style="color:#67e8f9">「' + esc(d.stages[run.si].n) + '」</span>'); }
    run.wave = 0; run.st0 = tk(); run.SM = {}; run.M = {}; run.bd = null; return true;
  };
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mobs()[idx], was = !!(m && m._dead), r = oKill.apply(this, arguments);
      try {
        if (m && !was && m._dead && m._rd && run && mapState.current === MAP) {
          if (run.D.onKill) run.D.onKill(run, m);
          if (m._rdBoss && !(run.bd && run.bd.stars)) alive(function (x) { return x._rd; }).forEach(function (x) { x.curHp = 0; x._dead = true; });
          var st = curStage();
          if (!st.timed && !alive(function (x) { return x._rd; }).length) {
            if (run.bd || (!st.boss && run.wave >= (st.waves || 0) && !st.dur) || (st.mirror && !st.boss)) { if (nextStage() === false) return r; }
            run.pending = true;
          }
        }
      } catch (e) { console.warn('[AFK-riftdg] kill', e); }
      return r;
    };
  }

  // ── 機制、傷害 ──
  var hooked = false;
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return hooked;
    var o = C.damage; hooked = true;
    C.damage = function (actor, target, amount, opt) {
      try {
        if (run && target && target._rd && amount > 0) {
          var bd = run.bd;
          if (target._rdBoss && bd && bd.dmgIn) amount = bd.dmgIn(run, target, amount, opt && opt.kind, run.M);
          if (dragonOn('val')) amount *= 1.1;
          if (run.mirBuff) amount *= 1 + run.mirBuff;
          if (target._rdStar) { var k = opt && opt.kind; if (target._rdStar === k) amount = 0; else if (target._rdStar === 'all' && !(opt && opt.trueDmg)) amount *= 0.2; }
        }
      } catch (e) {}
      return o.call(this, actor, target, Math.max(0, Math.floor(amount)), opt);
    };
    return true;
  };
  if (!hookDamage()) { try { document.addEventListener('DOMContentLoaded', hookDamage); } catch (e) {} }
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { if (!mob || !mob._rd || !run) return 1; var k = endlessK(); if (dragonOn('ant')) k *= 0.9; if (mob._rdBoss && run.bd && run.bd.dmgOut) k *= run.bd.dmgOut(run, mob, run.M); return k; });
  if (typeof W.foulWaterHealMult === 'function') {
    var oFoul = W.foulWaterHealMult;
    W.foulWaterHealMult = function () { var m = oFoul.apply(this, arguments); try { if (dragonOn('fa') && mapState.current === MAP) m *= 1.2; } catch (e) {} return m; };
    try { (0, eval)('foulWaterHealMult = window.foulWaterHealMult'); } catch (e) {}
  }
  // 紅獅王的冬至夜不能用相消（−30%）
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (uid) { var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uid; }), r = oUse.apply(this, arguments); try { if (it && it.id === 'afk_cancel_scroll' && run && run.id === 'past' && run.si === 1) { run.meter -= 30; clog('<span class="text-red-400">在聖光滿溢的夜裡用了相消——光暗了下來，穩定度 −30%。</span>'); } } catch (e) {} return r; };
  }
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var t0 = tk(), r = oTick.apply(this, arguments);
      try {
        var cur = mapState.current; if (cur !== lastMap) { if (lastMap === MAP && run) run = null; lastMap = cur; }
        if (!run && cur === MAP && Date.now() - leaving > 3000) leave('<span class="text-amber-300">裂縫闔上了，你回到了席琳神殿。</span>');
        var t = tk();
        var p = P();
        if (run && cur === MAP && p && p.dead) { if (run.D.endless) finish(true); else leave('<span class="text-red-400">你在裂縫裡倒下了，這次挑戰失敗。</span>'); return r; }
        if (run && cur === MAP && t !== t0) {
          var d = run.D, st = curStage();
          if (run.until && Date.now() > run.until) { leave('<span class="text-red-400">時間到，裂縫闔上了——挑戰失敗。</span>'); return r; }
          if (st.timed) { if (t - run.st0 >= st.timed * 10) { finish(); return r; } if (every(run.SM, 'spawn', st.spawnEvery, t) || run.wave === 0 && run.pending) { run.pending = true; spawnWave(); } }
          else { if (!run.pending && !alive(function (x) { return x._rd; }).length) run.pending = true; if (st.dur && run.pending === false && (t - run.st0) >= st.dur * 10 && !run.bd && !alive(function (x) { return x._rdBoss; }).length) run.pending = true; }
          if (st.onTick) st.onTick(run, t, run.SM);
          if (d.drillTick) d.drillTick(run, t);
          if (d.meterTick) d.meterTick(run, t);
          if (d.meter) { var downs = party().length; if (run._pc != null && downs < run._pc) run.meter -= 5 * (run._pc - downs); run._pc = downs; if (run.meter <= 0) { fail('時間線崩塌了'); return r; } }
          var b = bossOf(); if (b && run.bd && run.bd.mech && !L.boss.halted(b)) run.bd.mech(run, b, t, run.M);
          if (b && b._rdForce && b.curHp <= 0) { var idx = mobs().indexOf(b); b.curHp = 0; try { killMob(idx); } catch (e) {} }
        }
      } catch (e) { console.warn('[AFK-riftdg] tick', e); }
      return r;
    };
    try { (0, eval)('tick = window.tick'); } catch (e) {}
  }

  // ── 光羽：傲慢之塔 91～100 的裂縫怪 1% ──
  if (typeof W.killMob === 'function') {
    var oKill2 = W.killMob;
    W.killMob = function (idx) { var m = mobs()[idx], was = !!(m && m._dead), r = oKill2.apply(this, arguments); try { if (m && !was && m._dead && m._dimRift && !m._rd && mapState.current === 'pride_91_100' && Math.random() < 0.01) { give('afk_rd_feather', 1); sys('<span class="text-cyan-200">撿到了焦黑的光羽。</span>'); } } catch (e) {} return r; };
  }

  // ── 裂縫之門 ──
  var TIERS = [[1, '第一段（剛進裂縫）'], [2, '第二段（取回 20% 以上）'], [3, '第三段（取回 40%）']];
  var paintDoom = function (div) {
    var box = div.querySelector('#afk-rd-doom'); if (!box) return; var p = P(); if (!p) return; var d = BYID.doom, why = canEnter(d);
    K.repaint(box, K.rowHtml({ key: 'doom', name: esc(d.n) + (p.afkDoomWield ? '　<span style="color:#86efac">✓ 已握回劍</span>' : ''), color: '#f87171', desc: esc(d.lore), note: '每天 1 次　時限 15 分鐘', why: why, btns: [['go:doom:', '進入', !why]] }, 'data-rd'));
  };
  var paint = function (div) {
    if (div.querySelector('#afk-rd-doom')) return paintDoom(div);
    var box = div.querySelector('#afk-rd-gate'); if (!box) return; var p = P(); if (!p) return;
    var h = '<div class="ax-note">取回的力量：' + DR.recoverPct(p) + '%　血龍鑽：' + cnt(BLOOD).toLocaleString() + (DR.on() ? '' : '　<span class="no">次元裂縫沒有打開</span>') + '</div>';
    if (DR.RANKS) { var rk = DR.rec(p).rank || 0, nx = DR.RANKS[rk + 1], rw = DR.rankWhy(p); h += K.rowHtml({ key: 'drank', name: '遠征位階（裂縫）：' + DR.RANKS[rk].n, color: '#67e8f9', desc: nx ? '下一階「' + nx.n + '」：' + (nx.cur === 'exped' ? '遠征點數 ' : '裂縫點數 ') + nx.cost + '。' + nx.d : '已經是最高位階。', note: '裂縫點數 ' + (DR.rec(p).pts || 0) + '（每個副本最後頭目每天第一次 10 點，一天最多 60）', why: nx ? rw : '', btns: nx ? [['rank:', '升階', !rw]] : [] }, 'data-rd'); }
    TIERS.forEach(function (tr) {
      h += '<div class="ax-h" style="margin-top:8px">' + tr[1] + '</div>';
      D.filter(function (d) { return d.tier === tr[0] && !d.npc; }).forEach(function (d) {
        var picks = d.pick || [['', '']], s = store(p);
        picks.forEach(function (pk) {
          var why = canEnter(d, pk[0] || undefined), cap = d.limit - used(d, pk[0] || undefined);
          h += K.rowHtml({ key: d.id + pk[0], name: esc(d.n) + (pk[1] ? '・' + esc(pk[1]) : '') + (s.clear[d.id + (d.pickChain ? pk[0] : '')] ? '　<span style="color:#86efac">✓</span>' : ''), color: '#67e8f9', desc: pk === picks[0] ? esc(d.lore) : '', note: '入場：' + esc(feeTxt(d)) + '　' + (d.per === 'week' ? '本週' : '今天') + '剩 ' + Math.max(0, cap) + ' 次' + (d.min ? '　時限 ' + d.min + ' 分鐘' : '') + (d.endless && s.best ? '　最高第 ' + s.best + ' 層' : ''), why: why, btns: [['go:' + d.id + ':' + pk[0], '進入', !why]] }, 'data-rd');
        });
      });
    });
    K.repaint(box, h);
  };
  var render = function (div) {
    if (!div) return; K.css();
    div.innerHTML = '<div class="afk-ax"><div class="ax-lore">那道縫在神殿的角落裡呼吸。「這扇門只能從外面開。」有人在門框上刻過這行字，又被劃掉了一半。</div></div>';
    var box = document.createElement('div'); box.className = 'afk-ax'; box.id = 'afk-rd-gate'; div.appendChild(box); paint(div);
    if (!div.__afkRdBound) { div.__afkRdBound = true; div.addEventListener('click', function (ev) { var b = ev.target.closest('button[data-rd]'); if (!b || b.disabled || !(div.querySelector('#afk-rd-gate') || div.querySelector('#afk-rd-doom'))) return; var k = (b.getAttribute('data-rd') || '').split(':'); if (k[0] === 'go') enter(k[1], k[2] || undefined); else if (k[0] === 'rank') DR.rankUp(); paint(div); }); }
  };
  K.addNpc(TOWN, { id: NPC_ID, n: NPC_N, title: '次元裂縫', type: 'quest', classicHide: true, d: '神殿角落一道會呼吸的縫。次元裂縫打開時，從這裡進入裂縫的副本。' });
  // Ping 11-12：裂縫之門是一道傳送門，不是人（assets/npc/rift_gate：石框裡旋轉的紫藍裂縫，12 格）
  try { if (typeof NPC_SPR !== 'undefined' && !NPC_SPR.rift_gate) NPC_SPR.rift_gate = { g: 'rift_gate', f: 12, shadow: false }; if (typeof NPC_SPR_FIXED !== 'undefined') NPC_SPR_FIXED[NPC_ID] = 'rift_gate'; } catch (e) {}
  K.hookNpc(NPC_ID, NPC_N, '次元裂縫', render);
  var renderDoom = function (div) {
    if (!div) return; K.css();
    div.innerHTML = '<div class="afk-ax"><div class="ax-lore">「我們放下劍，是因為劍再也砍不動龍了。」守墓的老龍騎士看著你空著的手，「可是你不一樣。」</div></div>';
    var box = document.createElement('div'); box.className = 'afk-ax'; box.id = 'afk-rd-doom'; div.appendChild(box); paintDoom(div);
    if (!div.__afkRdBound) { div.__afkRdBound = true; div.addEventListener('click', function (ev) { var b = ev.target.closest('button[data-rd]'); if (!b || b.disabled) return; var k = (b.getAttribute('data-rd') || '').split(':'); if (k[0] === 'go') enter(k[1], k[2] || undefined); paint(div); }); }
  };
  K.addNpc(DOOM_TOWN, { id: 'npc_afk_doomgrave', n: '劍塚的守墓人', title: '龍騎士', type: 'quest', classicHide: true, d: '在貝希摩斯村外守著一座劍塚的老龍騎士。' });
  K.hookNpc('npc_afk_doomgrave', '劍塚的守墓人', '龍騎士', renderDoom);

  function growthCanShortcut(before) {
    if(!run||!before||run.id!==before.id||run.si!==before.si||run.wave!==before.wave||run.D.endless)return false;
    var stage=curStage();return !!(run.si+1<run.D.stages.length&&!stage.boss&&!stage.timed&&!stage.dur&&!stage.mirror&&!run.bd);
  }
  function growthShortcut(before) {
    if(!growthCanShortcut(before))return false;
    // Do not use nextStage: that path can grant guardian/floor completion rewards.
    run.si++;run.wave=0;run.st0=tk();run.SM={};run.M={};run.bd=null;run.pending=true;
    mapState.mobs=[null,null,null,null,null];mapState.targetIdx=-1;return true;
  }
  function growthCheckpoint(){if(!run)return null;var copy=Object.assign({},run);delete copy.D;delete copy.bd;return JSON.parse(JSON.stringify(copy));}
  function growthRestore(q){if(!q||!BYID[q.id])throw Error('副本進度不相容');run=Object.assign({},q,{D:BYID[q.id]});var stage=curStage();run.bd=mobs().some(function(m){return m&&m._rdBoss&&!m._dead;})?stage.boss:null;lastMap=MAP;}
  (W.LineageAbsoluteDamageGates=W.LineageAbsoluteDamageGates||[]).push(function(a,b,n,k){
    if(!run||!b||!b._rd)return n;var M=run.M||{};
    if(b._rdStar===k||b._rdBoss&&(M.book&&!b._rdForce||M.wit&&!b._rdForce||M.cut!=null&&M.cut<8||M.core||(M.fly||0)>tk()))return 0;
    return n;
  });
  W.__afkRiftDg = { growthCanShortcut:growthCanShortcut,growthShortcut:growthShortcut,growthCheckpoint:growthCheckpoint,growthRestore:growthRestore, D: D, BYID: BYID, R: R, canEnter: canEnter, enter: enter, run: function () { return run; }, store: store, MAP: MAP, findBase: findBase, nextStage: nextStage };
  try { console.log('[AFK-riftdg] 已載入：次元裂縫的副本 ' + D.length + ' 個'); } catch (e) {}

  // ── 11-12（Ping）：GPT 重繪的次元裂縫頭目與小怪、黃道十二宮、守護者之戒的王上線（assets/anim/<名字>/idle、attack、skill、hurt、death）──
  //   這些名字原本借別的怪的圖（MOB_ANIM_ALIAS）；改成用自己的資料夾，並把借來的方向、武器層、陰影設定拿掉（那些是原本那隻怪的圖才有的）。
  //   320 的大畫布給 mob-anim-big（跟頭目一樣的高度上限）。阿納金五個形態各一套：號角用本體，神諭／光翼／天梯／沉默各自一個資料夾。
  var GPT_ART = ["伊娃的鎖鏈", "反王 肯恩", "搜尋之光", "守門影", "裂痕的窺視者", "鐘擺守衛", "鏽蝕的鐘匠", "停擺之主 克羅諾斯塔", "映照者 米菈", "熔岩挖掘者 博格", "墮光天使 阿納金", "墜星", "星蝕者 艾斯崔亞", "第二世的你", "殷海薩", "斷劍的龍騎士", "握劍的回憶", "衝角的牧者 伊芙蕾", "磐石的公牛 葛倫", "鏡雙子 莉亞與莉歐", "鏡雙子 莉歐", "潮甲的守衛 卡斯", "金鬃獅王 雷恩", "靜謐的祈禱者 瑟芙", "衡量者 艾斯特", "毒尾的刺客 薩迦", "星矢的獵手 奧瑞", "斷罪的山羊 卡普", "寒泉的侍者 阿克亞", "雙鰭的歌姬 菲絲", "魚形分身", "滿月的歐文", "巴爾森的鎧甲", "海音的深淵歌姬", "沒有影子的人", "黑暗之星", "裂縫的影子", "走向窗邊的影子", "時之蛀蟲", "呼喊者", "發光的齒輪", "天梯守衛", "監視之眼", "縫口", "最早的那一點光", "觸手", "不肯放下的劍", "白羊宮的星衛", "金牛宮的星衛", "雙子宮的星衛", "巨蟹宮的星衛", "獅子宮的星衛", "處女宮的星衛", "天秤宮的星衛", "天蠍宮的星衛", "射手宮的星衛", "摩羯宮的星衛", "水瓶宮的星衛", "雙魚宮的星衛"];
  var GPT_BIG = ["停擺之主 克羅諾斯塔", "熔岩挖掘者 博格", "墮光天使 阿納金", "星蝕者 艾斯崔亞", "殷海薩", "握劍的回憶", "衝角的牧者 伊芙蕾", "磐石的公牛 葛倫", "鏡雙子 莉亞與莉歐", "鏡雙子 莉歐", "潮甲的守衛 卡斯", "金鬃獅王 雷恩", "靜謐的祈禱者 瑟芙", "衡量者 艾斯特", "毒尾的刺客 薩迦", "星矢的獵手 奧瑞", "斷罪的山羊 卡普", "寒泉的侍者 阿克亞", "雙鰭的歌姬 菲絲", "滿月的歐文", "巴爾森的鎧甲", "海音的深淵歌姬", "沒有影子的人", "黑暗之星"];
  var GG = function (n) { try { return (0, eval)(n); } catch (e) { return null; } };
  var clearCache = function (n) { try { var c = GG('_mobAnimCache'); if (c) delete c[n]; } catch (e) {} };
  var gptArt = function () {
    var names = GG('MOB_ANIM_NAMES'), alias = GG('MOB_ANIM_ALIAS'); if (!names || !names.add) return;
    var drop = ['MOB_ANIM_8DIR', 'MOB_ANIM_WEAPON_FX', 'MOB_ANIM_WEAPON_FX2', 'MOB_ANIM_BAKED_SHADOW', 'MOB_ANIM_SPRITE_SHADOW', 'MOB_SHADOW_TINT', 'MOB_ANIM_SMALL'].map(GG);
    var ylift = GG('MOB_YLIFT'), bigS = GG('MOB_ANIM_BIG');
    GPT_ART.forEach(function (n) {
      if (n === '墮光天使 阿納金' && alias && alias[n] && /^墮光天使 阿納金・/.test(alias[n])) { names.add(n); return; }   // 形態換圖中，別蓋掉
      names.add(n); if (alias && alias[n]) { delete alias[n]; clearCache(n); }
      drop.forEach(function (st) { if (st && st.delete) st.delete(n); });
      if (ylift && ylift[n] != null) delete ylift[n];
      if (bigS && bigS.add && GPT_BIG.indexOf(n) >= 0) bigS.add(n);
    });
  };
  var anakinArt = function (f) {
    var alias = GG('MOB_ANIM_ALIAS'), n = '墮光天使 阿納金', to = { 2: '神諭', 3: '光翼', 4: '天梯', 5: '沉默' }[f];
    if (!alias) return;
    if (to) alias[n] = n + '・' + to; else delete alias[n];
    clearCache(n);
  };
  W.__afkGptArt = { names: GPT_ART, apply: gptArt, anakin: anakinArt };
  gptArt(); W.addEventListener('load', function () { gptArt(); setTimeout(gptArt, 2000); });
})();
