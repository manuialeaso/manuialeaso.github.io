/* ==========================================================================
 * afk-sets.js — 套裝補齊（資料來源：天堂透視鏡 www.ttmi.me 套裝頁＋各部件頁，玩家 2026-10-22 指定）
 *
 * 新增套裝（部件數值、套裝效果、取得方式照透視鏡；中文名轉繁體）：
 *   反王套裝（王族）    反王頭盔／盔甲／手套／長靴     → 防禦-7、力量+1、敏捷+1、近距離攻擊+2、MP 回復+6、變身反王肯恩（80 級速度）
 *   賽尼斯套裝（法師）  賽尼斯頭箍／斗篷／手套／長靴   → 智力+2、MP+100、MP 回復+18、變身賽尼斯（移動特化）
 *     取得：新首領「反王肯恩」Lv75、「賽尼斯(首領)」Lv72（傲慢之塔 41~60 樓）；兩隻互掉對方的部分部件（照透視鏡）
 *   火焰之影套裝（8 件）襯衫／頭盔／盔甲／斗篷／長靴／手套／戒指／項鍊 → 全屬性+1、HP+100、MP+100、HP/MP 回復+15、防禦-8
 *     取得：炎魔謁見所的炎魔鐵匠製作（靈魂石碎片＋火焰之影素材＋混沌／死亡裝備，配方照透視鏡）；
 *           火焰之影素材由象牙塔 4~8 樓的怪物掉落
 *   泡水套裝（頭具／帽子／頭巾三種，共用斗篷／盔甲／手套／靴子）
 *     頭具：防禦-10、HP+100、火屬性抗性+10　帽子：敏捷+1、遠距離攻擊+1、遠距離命中+2　頭巾：MR+5、MP+50、魔法傷害+1
 *     取得：原作是釣魚／河豚；本作沒有釣魚，改由海音、伊娃王國、海賊島的水邊怪物掉落
 *   暴走的變異套裝（5 件）→ 防禦-12、HP+50、MP+30、力量／敏捷／智力+2、四屬性抗性+30（部件本身也有能力）
 *     取得：新首領「變異實驗體」Lv89（黑魔法研究室，對應原作魔族實驗室 2 樓）
 *   屍魂套裝（5 件）→ 防禦-20、HP+150、MP+70、MR+25、傷害減免+15、全屬性+1
 *     取得：原作是屍魂塔分解；本作改由不死系首領掉落
 *   營養滿分套裝（活動）金戒指／金腰帶／金項鍊 → 防禦-3、體質／精神／魅力+1、MR+10、HP+20、MP+10、HP 回復+5、MP 回復+3
 *   懷念的骷髏／侏儒／歐西斯套裝（活動）：部件數值同原版；套裝效果 MP 回復+4／HP 回復+6／防禦-5；在原版的掉落處以 1/5 機率掉
 *   飾品套裝（活動）：慈愛、奇蹟、希望、幸運、熱情、真實、11 週年白／黑／紅、修練者（效果照透視鏡）
 *   活動類（營養滿分、飾品套裝）：所有首領 0.05% 掉落其中一件
 * 未做：妖精套裝（透視鏡沒列部件）、修好的飾品（只有水中呼吸，本作用不到）
 * 需要核心補丁 34（套裝變身掛點）；圖示由 scripts/gen-set-icons.py 用既有圖示改色產生
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('sets')) return;
  if (typeof DB === 'undefined' || !DB.items || typeof MOB_DROPS === 'undefined') { console.warn('[AFK-sets] 找不到資料庫，略過'); return; }

  // ── 部件 ──
  var I = {};   // id → 定義
  var add = function (id, o) { o.gachaWeight = 0; if (o.safe == null) o.safe = 4; if (!o.req) o.req = 'all'; I[id] = o; if (!DB.items[id]) DB.items[id] = o; return id; };
  var arm = function (slot) { return { type: 'arm', slot: slot }; };
  var mk = function (id, n, slot, ac, extra, set, d) {
    var isAcc = slot === 'ring' || slot === 'amulet' || slot === 'belt' || slot === 'ear';
    var o = Object.assign({ n: n, type: isAcc ? 'acc' : 'arm', slot: slot, ac: ac, p: 20000 }, extra || {});
    o.set = set; o.d = (d ? d + '　' : '') + '【' + SETNAME[set] + '】';
    return add(id, o);
  };
  var SETNAME = {
    kenrauhel: '反王套裝', cerenis: '賽尼斯套裝', yahee: '火焰之影套裝', wet: '泡水套裝', mutation: '暴走的變異套裝', sihon: '屍魂套裝',
    vigor: '營養滿分套裝', old_bone: '懷念的骷髏套裝', old_gnome: '懷念的侏儒套裝', old_oasis: '懷念的歐西斯套裝',
    love: '慈愛飾品', miracle: '奇蹟飾品', hope: '希望飾品', luck: '幸運飾品', passion: '熱情飾品', truth: '真實飾品',
    w11: '11週年白色飾品', b11: '11週年黑色飾品', r11: '11週年紅色飾品', trainee: '修練者套裝'
  };
  // 反王（王族）
  mk('afk_set_kr_helm', '反王頭盔', 'helm', 3, { req: 'royal', p: 60000, legend: true }, 'kenrauhel', '反王肯恩的頭盔。');
  mk('afk_set_kr_armor', '反王盔甲', 'armor', 8, { req: 'royal', p: 150000, legend: true }, 'kenrauhel', '反王肯恩的盔甲。');
  mk('afk_set_kr_gloves', '反王手套', 'gloves', 2, { req: 'royal', p: 40000, legend: true }, 'kenrauhel', '反王肯恩的手套。');
  mk('afk_set_kr_boots', '反王長靴', 'boots', 3, { req: 'royal', p: 50000, legend: true }, 'kenrauhel', '反王肯恩的長靴。');
  // 賽尼斯（法師）
  mk('afk_set_ce_circlet', '賽尼斯頭箍', 'helm', 3, { req: 'mage', p: 60000, legend: true }, 'cerenis', '魔女賽尼斯的頭箍。');
  mk('afk_set_ce_robe', '賽尼斯斗篷', 'armor', 5, { req: 'mage', p: 120000, legend: true }, 'cerenis', '魔女賽尼斯的長袍。');
  mk('afk_set_ce_gloves', '賽尼斯手套', 'gloves', 1, { req: 'mage', p: 40000, legend: true }, 'cerenis', '魔女賽尼斯的手套。');
  mk('afk_set_ce_boots', '賽尼斯長靴', 'boots', 2, { req: 'mage', p: 50000, legend: true }, 'cerenis', '魔女賽尼斯的長靴。');
  // 火焰之影（製作）
  var YH = { safe: 0, p: 100000, legend: true, noTrade: true };
  mk('afk_set_yh_shirt', '火焰之影襯衫', 'tshirt', 0, YH, 'yahee', '炎魔鐵匠以火焰之影的遺骸鍛造。');
  mk('afk_set_yh_helm', '火焰之影頭盔', 'helm', 0, YH, 'yahee', '炎魔鐵匠以火焰之影的遺骸鍛造。');
  mk('afk_set_yh_armor', '火焰之影盔甲', 'armor', 0, YH, 'yahee', '炎魔鐵匠以火焰之影的遺骸鍛造。');
  mk('afk_set_yh_cloak', '火焰之影斗篷', 'cloak', 0, YH, 'yahee', '炎魔鐵匠以火焰之影的遺骸鍛造。');
  mk('afk_set_yh_boots', '火焰之影長靴', 'boots', 0, YH, 'yahee', '炎魔鐵匠以火焰之影的遺骸鍛造。');
  mk('afk_set_yh_gloves', '火焰之影手套', 'gloves', 0, YH, 'yahee', '炎魔鐵匠以火焰之影的遺骸鍛造。');
  mk('afk_set_yh_ring', '火焰之影戒指', 'ring', 0, YH, 'yahee', '炎魔鐵匠以火焰之影的遺骸鍛造。');
  mk('afk_set_yh_amulet', '火焰之影項鍊', 'amulet', 0, YH, 'yahee', '炎魔鐵匠以火焰之影的遺骸鍛造。');
  // 火焰之影素材
  var MAT = function (id, n) { add(id, { n: n, type: 'etc', p: 100, c: 'text-orange-300', noUse: true, safe: 0, d: '火焰之影的遺骸。炎魔鐵匠的製作材料。' }); };
  MAT('afk_mat_yh_head', '火焰之影首級'); MAT('afk_mat_yh_rib', '火焰之影肋骨'); MAT('afk_mat_yh_spine', '火焰之影脊椎');
  MAT('afk_mat_yh_wing', '火焰之影骨翼'); MAT('afk_mat_yh_nail', '火焰之影指甲'); MAT('afk_mat_yh_tail', '火焰之影尾巴');
  // 泡水
  mk('afk_set_wet_headgear', '泡水的頭具', 'helm', 2, { p: 8000 }, 'wet', '泡過水的頭具。搭配泡水的斗篷、盔甲、手套、靴子。');
  mk('afk_set_wet_hat', '泡水的帽子', 'helm', 1, { p: 8000 }, 'wet', '泡過水的帽子。搭配泡水的斗篷、盔甲、手套、靴子。');
  mk('afk_set_wet_hood', '泡水的頭巾', 'helm', 1, { p: 8000 }, 'wet', '泡過水的頭巾。搭配泡水的斗篷、盔甲、手套、靴子。');
  mk('afk_set_wet_cloak', '泡水的斗篷', 'cloak', 2, { p: 8000 }, 'wet');
  mk('afk_set_wet_armor', '泡水的盔甲', 'armor', 4, { p: 12000 }, 'wet');
  mk('afk_set_wet_gloves', '泡水的手套', 'gloves', 1, { p: 6000 }, 'wet');
  mk('afk_set_wet_boots', '泡水的靴子', 'boots', 2, { p: 6000 }, 'wet');
  // 暴走的變異（部件本身也有能力）
  mk('afk_set_mu_cloak', '暴走的變異披風', 'cloak', 3, { mhp: 40, mmp: 20, mr: 2, p: 90000, legend: true }, 'mutation', '變異實驗體身上剝下的披風。');
  mk('afk_set_mu_helm', '暴走的變異頭盔', 'helm', 4, { mmp: 25, mpR: 2, mr: 3, p: 90000, legend: true }, 'mutation', '變異實驗體身上剝下的頭盔。');
  mk('afk_set_mu_gloves', '暴走的變異手套', 'gloves', 2, { str: 1, dr: 1, p: 90000, legend: true }, 'mutation', '變異實驗體身上剝下的手套。');
  mk('afk_set_mu_armor', '暴走的變異盔甲', 'armor', 7, { hpR: 10, mpR: 10, p: 150000, legend: true }, 'mutation', '變異實驗體身上剝下的盔甲。');
  mk('afk_set_mu_boots', '暴走的變異長靴', 'boots', 3, { hpR: 3, mr: 1, p: 90000, legend: true }, 'mutation', '變異實驗體身上剝下的長靴。');
  // 屍魂
  mk('afk_set_sh_helm', '屍魂頭盔', 'helm', 5, { p: 120000, legend: true }, 'sihon', '屍魂塔深處的遺物。');
  mk('afk_set_sh_gloves', '屍魂手套', 'gloves', 3, { p: 120000, legend: true }, 'sihon', '屍魂塔深處的遺物。');
  mk('afk_set_sh_boots', '屍魂靴子', 'boots', 3, { p: 120000, legend: true }, 'sihon', '屍魂塔深處的遺物。');
  mk('afk_set_sh_armor', '屍魂盔甲', 'armor', 8, { p: 200000, legend: true }, 'sihon', '屍魂塔深處的遺物。');
  mk('afk_set_sh_cloak', '屍魂披風', 'cloak', 1, { p: 120000, legend: true }, 'sihon', '屍魂塔深處的遺物。');
  // 營養滿分（活動）
  mk('afk_set_vg_ring', '營養滿分金戒指', 'ring', 0, { safe: 0, p: 5000 }, 'vigor', '活動「營養滿分，天堂出奇蛋」的獎品。');
  mk('afk_set_vg_belt', '營養滿分金腰帶', 'belt', 0, { safe: 0, p: 5000 }, 'vigor', '活動「營養滿分，天堂出奇蛋」的獎品。');
  mk('afk_set_vg_amulet', '營養滿分金項鍊', 'amulet', 0, { safe: 0, p: 5000 }, 'vigor', '活動「營養滿分，天堂出奇蛋」的獎品。');
  // 懷念的（活動）：數值抄原版
  var OLD = [['hlm_bone', 'afk_set_old_bone_helm', '懷念的骷髏頭盔', 'old_bone'], ['amr_bone', 'afk_set_old_bone_armor', '懷念的骷髏盔甲', 'old_bone'], ['shd_bone', 'afk_set_old_bone_shield', '懷念的骷髏盾牌', 'old_bone'],
             ['hlm_gnome', 'afk_set_old_gnome_helm', '懷念的侏儒鐵盔', 'old_gnome'], ['arm_86', 'afk_set_old_gnome_cloak', '懷念的侏儒斗篷', 'old_gnome'], ['shd_gnome', 'afk_set_old_gnome_shield', '懷念的侏儒圓盾', 'old_gnome'],
             ['hlm_oasis', 'afk_set_old_oasis_helm', '懷念的歐西斯頭盔', 'old_oasis'], ['amr_oasis', 'afk_set_old_oasis_armor', '懷念的歐西斯環甲', 'old_oasis'], ['clk_oasis', 'afk_set_old_oasis_cloak', '懷念的歐西斯斗篷', 'old_oasis'], ['arm_104', 'afk_set_old_oasis_shield', '懷念的阿克海盾牌', 'old_oasis']];
  OLD.forEach(function (r) {
    var src = DB.items[r[0]]; if (!src) return;
    var o = Object.assign({}, src); delete o.set; delete o.img; o.n = r[2]; o.p = Math.max(1000, (src.p || 0) * 2);
    o.d = '活動紀念品，和原版一樣耐用。　【' + SETNAME[r[3]] + '】'; o.set = r[3]; add(r[1], o);
  });
  // 飾品套裝（活動）
  var ACC = [['love', [['afk_acc_love_amulet', '慈愛項鍊', 'amulet'], ['afk_acc_love_ring', '勇氣戒指', 'ring']]],
             ['miracle', [['afk_acc_miracle_amulet', '奇蹟項鍊', 'amulet'], ['afk_acc_miracle_ring', '奇蹟戒指', 'ring']]],
             ['hope', [['afk_acc_hope_amulet', '希望項鍊', 'amulet'], ['afk_acc_hope_ring', '幸運戒指', 'ring']]],
             ['luck', [['afk_acc_luck_amulet', '幸運項鍊', 'amulet'], ['afk_acc_luck_ring', '希望戒指', 'ring']]],
             ['passion', [['afk_acc_passion_amulet', '熱情項鍊', 'amulet'], ['afk_acc_passion_ring', '熱情戒指', 'ring']]],
             ['truth', [['afk_acc_truth_amulet', '真實項鍊', 'amulet'], ['afk_acc_truth_ring', '真實戒指', 'ring']]],
             ['w11', [['afk_acc_w11_amulet', '11週年白色項鍊', 'amulet']]], ['b11', [['afk_acc_b11_amulet', '11週年黑色項鍊', 'amulet']]], ['r11', [['afk_acc_r11_amulet', '11週年紅色項鍊', 'amulet']]],
             ['trainee', [['afk_acc_tr_amulet', '修練者的項鍊', 'amulet'], ['afk_acc_tr_ring', '修練者的戒指', 'ring'], ['afk_acc_tr_belt', '修練者的腰帶', 'belt']]]];
  ACC.forEach(function (g) { g[1].forEach(function (r) { mk(r[0], r[1], r[2], 0, { safe: 0, p: 3000 }, g[0], '活動紀念飾品。'); }); });
  mk('afk_acc_11_earring', '11週年紀念耳環', 'ear', 0, { safe: 0, p: 3000 }, 'w11', '活動紀念飾品，可搭配 11 週年白／黑／紅色項鍊。');
  // 圖示：沒有專屬圖的飾品用同類既有圖
  var ICON_FALLBACK = { amulet: 'assets/icons/accessories/守護項鍊.png', ring: 'assets/icons/accessories/力量戒指.png', belt: 'assets/icons/accessories/守護皮帶.png', ear: 'assets/icons/accessories/守護項鍊.png' };
  ['love', 'miracle', 'hope', 'luck', 'passion', 'truth', 'w11', 'b11', 'r11', 'trainee'].forEach(function (s) { Object.keys(I).forEach(function (id) { var d = I[id]; if (d.set === s && !d.img) d.img = ICON_FALLBACK[d.slot]; }); });

  // DB.sets（介面用的反向標記）
  var nextSet = Object.keys(DB.sets || {}).length;
  Object.keys(SETNAME).forEach(function (s) {
    var items = Object.keys(I).filter(function (id) { return I[id].set === s; });
    if (items.length) DB.sets['set_afk_' + s] = { n: SETNAME[s], items: items };
  });

  // ── 套裝計件與效果 ──
  var count = function (p) {
    var c = {}, seen = {};
    try { for (var k in p.eq) { var e = p.eq[k]; if (!e || k === 'wpn' || k === 'offwpn') continue; if (seen[e.id]) continue; seen[e.id] = 1; var d = DB.items[e.id]; if (d && d.set && I[e.id]) c[d.set] = (c[d.set] || 0) + 1; } } catch (e) {}
    if (window.AFK_RELIC_GM) window.AFK_RELIC_GM.pluginSets(p,c,seen);
    var has = function (id) { return !!seen[id]; };
    var wet4 = has('afk_set_wet_cloak') && has('afk_set_wet_armor') && has('afk_set_wet_gloves') && has('afk_set_wet_boots');
    return {
      c: c, has: has,
      kr: (c.kenrauhel || 0) >= 4, ce: (c.cerenis || 0) >= 4, yh: (c.yahee || 0) >= 8, mu: (c.mutation || 0) >= 5, sh: (c.sihon || 0) >= 5, vg: (c.vigor || 0) >= 3,
      wetHead: wet4 && has('afk_set_wet_headgear'), wetHat: wet4 && has('afk_set_wet_hat'), wetHood: wet4 && has('afk_set_wet_hood'),
      oldBone: (c.old_bone || 0) >= 3, oldGnome: (c.old_gnome || 0) >= 3, oldOasis: (c.old_oasis || 0) >= 4,
      love: (c.love || 0) >= 2, miracle: (c.miracle || 0) >= 2, hope: (c.hope || 0) >= 2, luck: (c.luck || 0) >= 2, passion: (c.passion || 0) >= 2, truth: (c.truth || 0) >= 2,
      w11: has('afk_acc_w11_amulet') && has('afk_acc_11_earring'), b11: has('afk_acc_b11_amulet') && has('afk_acc_11_earring'), r11: has('afk_acc_r11_amulet') && has('afk_acc_11_earring'),
      trainee: (c.trainee || 0) >= 3
    };
  };
  // 屬性類：要在屬性換算戰鬥數值之前加（掛 __afkAttrBoost，核心夾上限前呼叫）
  var oBoost = window.__afkAttrBoost;
  window.__afkAttrBoost = function (p, d) {
    try {
      var s = count(p);
      var all = function (n) { d.str += n; d.dex += n; d.con += n; d.int += n; d.wis += n; d.cha += n; };
      if (s.kr) { d.str += 1; d.dex += 1; }
      if (s.ce) d.int += 2;
      if (s.yh) all(1);
      if (s.wetHat) d.dex += 1;
      if (s.mu) { d.str += 2; d.dex += 2; d.int += 2; }
      if (s.sh) all(1);
      if (s.vg) { d.con += 1; d.wis += 1; d.cha += 1; }
    } catch (e) {}
    if (typeof oBoost === 'function') return oBoost.apply(this, arguments);
  };
  // 其他效果與套裝變身：核心補丁 34 在「套裝變身清除之後」呼叫
  var findForm = function (n) { try { var f = findPolyForm(n); return f ? makePolyState(f.form, f.color) : null; } catch (e) { return null; } };
  window.__afkSetLate = function (p, setCheck, d) {
    var s = count(p);
    if (s.kr) { d.ac -= 7; d.meleeDmg += 2; d.mpR += 6; var f1 = findForm('反王肯恩'); if (f1) p._setPoly = f1; }
    if (s.ce) { p.mmp += 100; d.mpR += 18; var f2 = findForm('賽尼斯'); if (f2) { f2.wlk = Math.max(8, Math.round((f2.wlk || 16) * 0.75)); f2.n = '賽尼斯'; p._setPoly = f2; } }
    if (s.yh) { d.ac -= 8; p.mhp += 100; p.mmp += 100; d.hpR += 15; d.mpR += 15; }
    if (s.wetHead) { d.ac -= 10; p.mhp += 100; d.resFire += 10; }
    if (s.wetHat) { d.rangedDmg += 1; d.rangedHit += 2; }
    if (s.wetHood) { d.mr += 5; p.mmp += 50; d.magicDmg += 1; }
    if (s.mu) { d.ac -= 12; p.mhp += 50; p.mmp += 30; d.resFire += 30; d.resWater += 30; d.resEarth += 30; d.resWind += 30; }
    if (s.sh) { d.ac -= 20; p.mhp += 150; p.mmp += 70; d.mr += 25; d.dr += 15; }
    if (s.vg) { d.ac -= 3; d.mr += 10; p.mhp += 20; p.mmp += 10; d.hpR += 5; d.mpR += 3; }
    if (s.oldBone) d.mpR += 4;
    if (s.oldGnome) d.hpR += 6;
    if (s.oldOasis) d.ac -= 5;
    if (s.love) { d.hpR += 2; d.mpR += 2; }
    if (s.miracle) { p.mhp += 15; p.mmp += 10; }
    if (s.hope) p.mmp += 5;
    if (s.luck) p.mmp += 10;
    if (s.passion) p.mhp += 10;
    if (s.truth) p.mhp += 15;
    if (s.w11) { d.magicDmg += 1; p.mmp += 33; d.mpR += 2; }
    if (s.b11) { p.mhp += 55; d.hpR += 5; }
    if (s.r11) { d.extraHit += 2; d.extraDmg += 2; }
    if (s.trainee) { d.hpR += 4; d.mpR += 1; }
  };
  // 套裝說明（物品說明裡顯示）
  var SET_TXT = {
    kenrauhel: '4 件：防禦-7、力量+1、敏捷+1、近距離攻擊+2、MP 回復+6、變身反王肯恩（80 級速度）',
    cerenis: '4 件：智力+2、MP+100、MP 回復+18、變身賽尼斯（移動特化）',
    yahee: '8 件：全屬性+1、HP+100、MP+100、HP／MP 回復+15、防禦-8',
    wet: '斗篷＋盔甲＋手套＋靴子，再配頭具：防禦-10、HP+100、火抗+10／配帽子：敏捷+1、遠距離攻擊+1、遠距離命中+2／配頭巾：MR+5、MP+50、魔法傷害+1',
    mutation: '5 件：防禦-12、HP+50、MP+30、力量／敏捷／智力+2、四屬性抗性+30',
    sihon: '5 件：防禦-20、HP+150、MP+70、MR+25、傷害減免+15、全屬性+1',
    vigor: '3 件：防禦-3、體質／精神／魅力+1、MR+10、HP+20、MP+10、HP 回復+5、MP 回復+3',
    old_bone: '3 件：MP 回復+4', old_gnome: '3 件：HP 回復+6', old_oasis: '4 件：防禦-5',
    love: '2 件：HP／MP 回復+2', miracle: '2 件：HP+15、MP+10', hope: '2 件：MP+5', luck: '2 件：MP+10', passion: '2 件：HP+10', truth: '2 件：HP+15',
    w11: '項鍊＋紀念耳環：魔法傷害+1、MP+33、MP 回復+2', b11: '項鍊＋紀念耳環：HP+55、HP 回復+5', r11: '項鍊＋紀念耳環：額外命中+2、額外傷害+2',
    trainee: '3 件：HP 回復+4、MP 回復+1'
  };
  Object.keys(I).forEach(function (id) { var d = I[id]; if (d.set && SET_TXT[d.set] && d.d && d.d.indexOf('件') < 0) d.d += SET_TXT[d.set]; });
  try { var e11 = DB.items.afk_acc_11_earring; if (e11) e11.d = '活動紀念飾品。【11週年飾品】配白色項鍊：魔法傷害+1、MP+33、MP 回復+2／黑色：HP+55、HP 回復+5／紅色：額外命中+2、額外傷害+2'; } catch (e) {}

  // ── 新首領 ──
  var MOBS = {
    afk_boss_kenrauhel: { n: '反王肯恩', lv: 75, s: 'S', beh: '主動', race: '人形', boss: true, hard: true, e: 'none', hp: 14000, ac: -78, mr: 50, exp: 5626, goldMin: 8000, goldMax: 16000,
      atkSpd: 1, dmg: [3, 40], db: 45, hit: 90, regenHp: 300, regenEvery: 50, seeInsight: true,
      mag: { skn: '劍氣斬', cd: 60, chance: 0.3, dmg: [4, 40], db: 80, ele: 'none', alwaysHit: true } },
    afk_boss_cerenis: { n: '賽尼斯(首領)', lv: 72, s: 'S', beh: '主動', race: '人形', boss: true, hard: true, e: 'none', hp: 9000, ac: -60, mr: 90, exp: 5200, goldMin: 8000, goldMax: 16000,
      atkSpd: 1.2, dmg: [2, 30], db: 30, hit: 70,
      mag: { skn: '流星雨', cd: 60, chance: 0.35, dmg: [5, 40], db: 100, ele: 'fire', alwaysHit: true },
      mag2: { skn: '冰雪颶風', cd: 90, dmg: [4, 40], db: 90, ele: 'water', alwaysHit: true, sec: { type: 'freeze', pbase: 120 } } },
    afk_boss_mutant: { n: '變異實驗體', lv: 89, s: 'L', beh: '主動', race: '魔族', boss: true, hard: true, e: 'none', hp: 40000, ac: -85, mr: 80, exp: 9000, goldMin: 15000, goldMax: 30000,
      atkSpd: 1, dmg: [4, 45], db: 80, hit: 110,
      mag: { skn: '暴走毒液', cd: 70, chance: 0.3, dmg: [5, 50], db: 150, ele: 'earth', alwaysHit: true, sec: { type: 'poison', pbase: 150 } } }
  };
  Object.keys(MOBS).forEach(function (id) { if (!DB.mobs[id]) DB.mobs[id] = MOBS[id]; });
  // 出沒：反王肯恩／賽尼斯 → 傲慢之塔 41~60 樓；變異實驗體 → 黑魔法研究室
  var spawnAt = function (map, id) { try { if (DB.maps[map] && DB.maps[map].indexOf(id) < 0) DB.maps[map].push(id); } catch (e) {} };
  spawnAt('pride_41_50', 'afk_boss_kenrauhel'); spawnAt('pride_51_60', 'afk_boss_kenrauhel');
  spawnAt('pride_41_50', 'afk_boss_cerenis'); spawnAt('pride_51_60', 'afk_boss_cerenis');
  spawnAt('dark_magic_lab', 'afk_boss_mutant');
  // 動畫：借用既有素材（反王肯恩＝王子、賽尼斯＝女法師、變異實驗體＝象牙塔奇美拉）
  try {
    var ALIAS = { '反王肯恩': '特羅斯王子', '賽尼斯(首領)': '賽尼斯', '變異實驗體': '象牙塔奇美拉' };   // 借用既有動畫怪（它們再指向 玩家王子／玩家女法師 資料夾）
    Object.keys(ALIAS).forEach(function (n) {
      var t = ALIAS[n];
      MOB_ANIM_ALIAS[n] = (MOB_ANIM_ALIAS && MOB_ANIM_ALIAS[t]) || t;
      [MOB_ANIM_NAMES, MOB_ANIM_BAKED_SHADOW, MOB_SHADOW_TINT, MOB_ANIM_BIG, MOB_ANIM_SMALL, MOB_ANIM_SPRITE_SHADOW, MOB_ANIM_WEAPON_FX, MOB_ANIM_WEAPON_FX2, MOB_ANIM_8DIR].forEach(function (S) { try { if (S && S.has(t)) S.add(n); } catch (e) {} });
      [MOB_YLIFT, MOB_ANIM_DEATH_FX].forEach(function (O) { try { if (O && O[t] != null && O[n] == null) O[n] = O[t]; } catch (e) {} });
    });
  } catch (e) {}

  // ── 掉落（%）──
  var drop = function (mob, id, pct) { if (!DB.items[id]) return; var a = MOB_DROPS[mob] = MOB_DROPS[mob] || []; if (!a.some(function (x) { return x[0] === id; })) a.push([id, pct]); };
  var byName = function (n) { for (var k in DB.items) if (DB.items[k].n === n) return k; return null; };
  // 反王肯恩（照透視鏡 19 項：有對應的物品才放）
  [['wpn_siruge', 5], ['arm_59', 3], ['blt_body', 2], ['arm_87', 5], ['glv_glove', 10], ['arm_45', 2], ['arm_46', 2], ['arm_47', 2], ['amu_str', 0.5], ['acc_121', 0.5], ['arm_108', 5], ['tsh_tshirt', 5], ['arm_90', 10],
   ['afk_set_kr_helm', 3], ['afk_set_kr_armor', 2], ['afk_set_kr_boots', 3], ['afk_set_ce_boots', 3]].forEach(function (r) { drop('反王肯恩', r[0], r[1]); });
  ['技術書(衝擊之暈)', '技術書(增幅防禦)', '技術書(尖刺盔甲)'].forEach(function (n) { var id = byName(n); if (id) drop('反王肯恩', id, 1); });
  // 賽尼斯（首領）
  [['afk_set_ce_circlet', 3], ['afk_set_ce_robe', 2], ['afk_set_ce_gloves', 3], ['afk_set_kr_gloves', 3], ['hlm_mage', 10], ['amr_magerobe', 10], ['amu_int', 0.5], ['arm_87', 5]].forEach(function (r) { drop('賽尼斯(首領)', r[0], r[1]); });
  // 變異實驗體
  [['afk_set_mu_cloak', 2], ['afk_set_mu_helm', 2], ['afk_set_mu_gloves', 2], ['afk_set_mu_armor', 1], ['afk_set_mu_boots', 2]].forEach(function (r) { drop('變異實驗體', r[0], r[1]); });
  // 火焰之影素材：象牙塔 4~8 樓
  var mobsOf = function (maps) { var out = []; maps.forEach(function (m) { (DB.maps[m] || []).forEach(function (id) { var x = DB.mobs[id]; if (x && out.indexOf(x.n) < 0) out.push(x.n); }); }); return out; };
  mobsOf(['zone_37', 'zone_38', 'zone_39', 'zone_40', 'zone_41']).forEach(function (n) {
    drop(n, 'afk_mat_yh_rib', 2); drop(n, 'afk_mat_yh_wing', 1.5); drop(n, 'afk_mat_yh_nail', 1); drop(n, 'afk_mat_yh_spine', 0.3);
  });
  ['象牙塔炎魔之影', '火焰之影親衛隊(巴風特)', '炎魔的分身'].forEach(function (n) { drop(n, 'afk_mat_yh_head', 3); drop(n, 'afk_mat_yh_tail', 3); drop(n, 'afk_mat_yh_spine', 5); });
  // 泡水：水邊怪物
  var WET = ['afk_set_wet_headgear', 'afk_set_wet_hat', 'afk_set_wet_hood', 'afk_set_wet_cloak', 'afk_set_wet_armor', 'afk_set_wet_gloves', 'afk_set_wet_boots'];
  mobsOf(['eva_kingdom', 'pirate_dungeon']).concat(['鱷魚', '巨大鱷魚', '蜥蜴人', '高等蜥蜴人', '藍尾蜥蜴']).forEach(function (n) { WET.forEach(function (id) { drop(n, id, 0.3); }); });
  // 屍魂：不死系首領
  var SH = ['afk_set_sh_helm', 'afk_set_sh_gloves', 'afk_set_sh_boots', 'afk_set_sh_armor', 'afk_set_sh_cloak'];
  ['不滅的巫妖', '恐怖的吸血鬼', '不死的木乃伊王', '死亡', '邪惡的鐮刀死神'].forEach(function (n) { SH.forEach(function (id) { drop(n, id, 0.5); }); });
  // 懷念的：在原版掉落處以 1/5 機率掉
  var OLDMAP = {}; OLD.forEach(function (r) { OLDMAP[r[0]] = r[1]; });
  Object.keys(MOB_DROPS).forEach(function (mob) {
    var arr = MOB_DROPS[mob]; if (!Array.isArray(arr)) return;
    arr.slice().forEach(function (x) { var nid = OLDMAP[x[0]]; if (nid) drop(mob, nid, Math.max(0.001, x[1] / 5)); });
  });
  // 活動品：所有首領 0.05% 掉其中一件
  var EVENT = Object.keys(I).filter(function (id) { var s = I[id].set; return s === 'vigor' || ['love', 'miracle', 'hope', 'luck', 'passion', 'truth', 'w11', 'b11', 'r11', 'trainee'].indexOf(s) >= 0; });
  if (typeof window.killMob === 'function') {
    var oKill = window.killMob;
    window.killMob = function (idx) {
      var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null;
      var boss = !!(m && m.boss && !m._dead && !m.siegeEnemy && !m._dreamStar && m.race !== '建築');   // 暗夢星迴只給固定掉落
      var r = oKill.apply(this, arguments);
      try { if (boss && m._dead && !m._afkEventDrop) { m._afkEventDrop = true; if (Math.random() < 0.0005) { var id = EVENT[Math.floor(Math.random() * EVENT.length)]; gainItem(id, 1); } } } catch (e) {}
      return r;
    };
  }

  // ── 火焰之影：炎魔鐵匠製作（配方照透視鏡）──
  try {
    var R = CRAFT_RECIPES.npc_flame_smith = CRAFT_RECIPES.npc_flame_smith || [];
    var S = 'mat_soulstone_shard';
    [['afk_set_yh_shirt', [[S, 100], ['afk_mat_yh_rib', 50], ['amr_chaos', 1]]],
     ['afk_set_yh_helm', [[S, 25000], ['afk_mat_yh_head', 1], ['mat_chaos_head', 1]]],
     ['afk_set_yh_armor', [[S, 200], ['afk_mat_yh_spine', 5], ['amr_death', 1]]],
     ['afk_set_yh_cloak', [[S, 400], ['afk_mat_yh_wing', 50], ['clk_death', 1]]],
     ['afk_set_yh_boots', [[S, 5000], ['afk_mat_yh_nail', 40], ['glv_chaos', 1]]],
     ['afk_set_yh_gloves', [[S, 2000], ['afk_mat_yh_nail', 20], ['glv_death', 1]]],
     ['afk_set_yh_ring', [[S, 7500], ['afk_mat_yh_nail', 10], ['clk_chaos', 1]]],
     ['afk_set_yh_amulet', [[S, 10000], ['afk_mat_yh_tail', 1], ['clk_chaos', 1]]]].forEach(function (r) {
      if (R.some(function (x) { return x.result === r[0]; })) return;
      R.push({ result: r[0], req: r[1].filter(function (q) { return DB.items[q[0]]; }).map(function (q) { return { id: q[0], cnt: q[1] }; }) });
    });
  } catch (e) {}

  window.__afkSets = { count: count, items: I, SETNAME: SETNAME };
  console.log('[AFK-sets] 已啟用：補齊 ' + Object.keys(SETNAME).length + ' 組套裝、' + Object.keys(I).length + ' 件物品、3 隻首領');
})();
