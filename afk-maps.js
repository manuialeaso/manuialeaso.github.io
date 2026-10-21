/* ==========================================================================
 * afk-maps.js — 地圖補齊（資料來源：天堂透視鏡 www.ttmi.me 地點怪物清單，玩家 2026-10-22 指定）
 *
 * 37 張新地圖（清單與怪物見 data/ttmi-maps.json → afk-maps-data.js），依所在地區放進地圖選單：
 *   亞丁：亞丁地區、風龍棲息地　龍之谷：龍之谷地監7樓　奇岩：強盜出沒地、獨眼巨人出沒地、闇龍的傷痕、密林地帶
 *   古魯丁：墓園、海底隧道、死亡廢墟、亡者之墓　海音：高崙研究所
 *   歐瑞：侏儒部落、冰之女王的宮殿、象牙塔(火焰之影)、暗影神殿1~3樓
 *   說話之島：北島、妖魔部落、蜘蛛森林、黑騎士前哨基地
 *   風木：荒地、修練地監1~4樓、慾望洞穴、水／火／地／風之領域、炎魔房間、魔族實驗室1~2樓
 *   燃柳（海賊島）：船舶之墓、地底湖
 * 怪物：
 *   ‧遊戲已有的同名怪物直接沿用（數值、動畫、掉落都不變）
 *   ‧沒有的怪物用「外型相近的既有怪物」當樣板：借用它的動畫與掉落，數值依等級比例換算
 *   ‧透視鏡的等級是重製版的；每張地圖用一個係數換成本作的等級帶（例如死亡廢墟、說話之島北邊維持原作低等級區）
 *   ‧首領：透視鏡標為首領的，數值另外加強
 * 透視鏡上沒有列怪物的地點（魔法師研究所、伊娃神殿、奇怪的村落、妖魔內城、隱藏之港、天空之園、屍魂塔等）沒有加。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('maps')) return;
  var DATA = window.__AFK_TTMI_MAPS;
  if (!DATA || typeof DB === 'undefined' || typeof MAP_CATEGORIES === 'undefined' || typeof MAP_REGIONS === 'undefined') { console.warn('[AFK-maps] 缺資料，略過'); return; }

  // 新怪物 → 樣板（既有怪物名）
  var TPL = {
    '蜥蜴': '邪惡蜥蜴', '森林老虎': '冰原老虎', '蜥蜴人劍士': '蜥蜴人', '蜥蜴人戰士': '蜥蜴人', '蜥蜴人魔法師': '邪惡蜥蜴', '卡爾克': '獨眼巨人',
    '毒殺人蜂': '夢幻之島殺人蜂', '佩利克': '格利芬', '菲爾菲爾': '哈維', '泥龍(風)': '大地荒龍', '荒龍(風)': '大地荒龍', '藍哈維': '哈維', '瑪依奴': '蜥蜴人',
    '風龍的謝托雷': '飛龍', '風龍的守護者': '翼龍', '瑪依奴夏門': '邪惡蜥蜴', '恐怖的林德拜爾': '林德拜爾',
    '地龍的莫妮亞': '莫妮亞', '泥龍(地)': '大地荒龍', '荒龍(地)': '大地荒龍', '地龍的精英兵': '巨人戰士', '恐怖的安塔瑞斯': '安塔瑞斯',
    '強盜狙擊手': '強盜', '強盜(刀)': '強盜', '強盜(釘錘)': '強盜', '強盜游擊隊長': '強盜',
    '艾多倫': '巨人', '安普': '安普長老', '深淵之花': '爆彈花', '深紅飛龍': '飛龍',
    '邪惡的夏洛伯': '夏洛伯', '優卡': '提卡爾艾庫尤卡(藍)', '米卡': '提卡爾艾庫尤卡(白)', '邪惡的楊果里恩': '變種楊果里恩', '卡伊拉': '提卡爾艾庫卡伊拉(藍)', '布萊德': '提卡爾艾庫巴拉', '艾托': '提卡爾艾庫艾托',
    '士兵的怨靈': '鬼魂', '怨靈(男)': '鬼魂', '怨靈(女)': '紅鬼魂', '哈蒙將軍的怨靈': '象牙塔惡靈',
    '亡者的監督官': '死神', '黑騎士隊長': '暗黑黑騎士',
    '怪手(高崙研究所)': '怪手', '牛人高崙': '鋼鐵高崙', '高崙守護者(石頭)': '石頭高崙', '高崙守護者(紅)': '熔岩高崙', '高崙守護者(藍)': '冰石高崙', '高崙守護者(黃)': '鋼鐵高崙', '泰坦高崙': '恐怖的鋼鐵高崙',
    '精銳 侏儒弓手': '侏儒戰士', '精銳 侏儒劍士': '侏儒戰士', '精銳 侏儒槍兵': '侏儒戰士', '精銳 侏儒斧頭兵': '侏儒戰士', '精銳 侏儒咒術師': '侏儒', '精銳 侏儒將軍': '侏儒戰士',
    '冰之女王禁衛兵(弓)': '冰人', '冰之女王禁衛兵(矛)': '冰人', '冷冽的 冰人': '冰人', '冷冽的 冰石高崙': '冰石高崙', '冷冽的 毒蠍': '毒蠍',
    '活鎧甲(劍)': '活鎧甲', '活鎧甲(盾牌)': '活鎧甲', '閃電球': '象牙塔閃電球', '果凍怪': '象牙塔果凍怪',
    '混沌的司祭(槍兵)': '混沌的司祭(野獸)', '混沌的司祭(空兵)': '混沌的司祭(飛翼)', '混沌的司祭(騎兵)': '混沌的司祭(野獸)',
    '死亡的司祭(小惡魔)': '死亡的司祭(思克巴)', '死亡的司祭(巴列斯)': '死亡的司祭(巴風特)', '死亡的司祭(惡魔)': '死亡的司祭(巴風特)',
    '火焰之影親衛兵(小惡魔)': '火焰之影親衛隊(巴風特)', '火焰之影親衛兵(巴列斯)': '火焰之影親衛隊(巴風特)', '火焰之影親衛兵(巴風特)': '火焰之影親衛隊(巴風特)', '火焰之影親衛兵(思克巴)': '火焰之影親衛隊(巴風特)',
    '火焰之影親衛兵(惡魔)': '火焰之影親衛隊(巴風特)', '火焰之影親衛兵(槍兵)': '混沌的司祭(野獸)', '火焰之影親衛兵(空兵)': '混沌的司祭(飛翼)', '火焰之影親衛兵(騎兵)': '混沌的司祭(野獸)', '火焰之影': '象牙塔炎魔之影',
    '侏儒弓手': '侏儒', '侏儒劍士': '侏儒戰士', '侏儒槍兵': '侏儒戰士', '侏儒咒術師': '侏儒', '遊走的幽靈(紅)': '紅鬼魂', '遊走的幽靈(綠)': '鬼魂',
    '妖魔槍兵': '妖魔鬥士', '長者': '長老', '阿勒尼亞': '夏洛伯', '叛徒 長者': '長老', '精英黑騎士': '暗黑黑騎士',
    '邪惡的高崙': '熔岩高崙', '翼魔': '象牙塔翼魔', '邪惡的食人妖精': '食人妖精', '邪惡的食人妖精首領': '食人妖精王', '邪惡的黑騎士': '暗黑黑騎士', '漆黑的食人妖精': '食人妖精',
    '漆黑的地獄犬': '恐怖的地獄犬', '安普法師': '巫師', '漆黑的食人妖精王': '食人妖精王', '尿尿小童': '小惡魔', '奇美拉爾德': '奇美拉',
    '土之守護者': '地元素守護者', '水之守護者': '水元素守護者', '火之守護者': '火元素守護者', '風之守護者': '風元素守護者',
    '小狄高': '水靈之主', '狄高': '深淵水靈', '小安加斯': '火靈之主', '安加斯': '深淵火靈', '諾納': '深淵地靈', '小巴薩斯': '風靈之主', '巴薩斯': '深淵風靈', '炎魔': '炎魔的分身',
    '惡魔實驗體(黑暗安特)': '污染的安特', '惡魔實驗體(熔岩高崙)': '熔岩高崙', '惡魔實驗體(食腐獸)': '食腐獸', '惡魔實驗體(魔狼)': '魔狼', '惡魔實驗體(史萊姆)': '象牙塔果凍怪',
    '惡魔實驗體(深淵之花)': '爆彈花', '惡魔實驗體(提卡爾 薩德泥偶)': '提卡爾薩德泥偶', '惡魔實驗體(深淵火靈)': '深淵火靈', '惡魔實驗體(小惡魔)': '小惡魔',
    '秘密實驗室警備隊(槍兵)': '拉斯塔巴德近衛隊', '秘密實驗室警備隊(空兵)': '混沌的司祭(飛翼)', '秘密實驗室騎兵': '魂騎士',
    '變異海星': '海星', '變異蜥蜴': '邪惡蜥蜴', '變異觸鬚人': '穴居人', '實驗變異怪(咆哮翼魔)': '象牙塔翼魔', '實驗變異怪(水晶惡魔)': '象牙塔惡魔之影', '實驗變異怪(蝦蟹異魔)': '蟹人', '可疑的魔族史勒夫': '暗殺軍王史雷佛',
    '惡靈召喚物': '鬼魂', '深海殭屍': '人形殭屍', '深海穴居人': '穴居人', '隱藏的深海穴居人': '穴居人', '深海食屍鬼': '食屍鬼', '深海巨大鱷魚': '巨大鱷魚',
    '船舶之墓殭屍(男)': '人形殭屍', '船舶之墓殭屍(女)': '人形殭屍', '惡靈': '象牙塔惡靈', '隱藏的半魚人': '人魚',
    '地底蟹人': '蟹人', '地底巨王蟲': '巨蟻', '地底蜥蜴人': '蜥蜴人', '地底蛇蠍': '毒蠍', '地底魔蠍': '毒蠍', '地底多眼怪': '多眼怪', '地底巨王龜': '龍龜', '地底伊萊克頓': '伊萊克頓', '騎士哈達': '魂騎士', '須曼': '深淵之主'
  };
  var byName = {};   // 名稱 → 第一個非攻城／血盟的 DB id
  Object.keys(DB.mobs).forEach(function (id) { var m = DB.mobs[id]; if (!m || m.siegeEnemy || m.pledgeEnemy) return; if (!byName[m.n]) byName[m.n] = id; });
  var round = function (x) { return Math.max(1, Math.round(x)); };
  var made = 0, missingTpl = [];
  var animCopy = function (n, t) {
    try {
      var target = (MOB_ANIM_ALIAS && MOB_ANIM_ALIAS[t]) || t;
      MOB_ANIM_ALIAS[n] = target;
      [MOB_ANIM_NAMES, MOB_ANIM_BAKED_SHADOW, MOB_SHADOW_TINT, MOB_ANIM_BIG, MOB_ANIM_SMALL, MOB_ANIM_SPRITE_SHADOW, MOB_ANIM_WEAPON_FX, MOB_ANIM_WEAPON_FX2, MOB_ANIM_8DIR].forEach(function (S) { try { if (S && S.has(t)) S.add(n); } catch (e) {} });
      [MOB_YLIFT, MOB_ANIM_DEATH_FX, MOB_ANIM_SKILL_FX].forEach(function (O) { try { if (O && O[t] != null && O[n] == null) O[n] = O[t]; } catch (e) {} });
    } catch (e) {}
  };
  var scaleMag = function (g, f) { if (!g) return g; var o = JSON.parse(JSON.stringify(g)); if (o.db != null) o.db = round(o.db * f); return o; };
  var newMob = function (name, lv, boss) {
    var tName = TPL[name], tid = tName && byName[tName], t = tid && DB.mobs[tid];
    if (!t) { missingTpl.push(name); return null; }
    var f = lv / Math.max(1, t.lv || 1), g = Math.pow(f, 1.6);
    var m = JSON.parse(JSON.stringify(t));
    delete m.img; m.n = name; m.lv = lv;
    m.hp = round((t.hp || 10) * g); m.exp = round((t.exp || 1) * g);
    m.goldMin = round((t.goldMin || 1) * f); m.goldMax = round((t.goldMax || 2) * f);
    m.db = round((t.db || 0) * f); m.hit = round((t.hit || 0) + (lv - (t.lv || 1)));
    m.ac = Math.round((t.ac || 0) - (lv - (t.lv || 1)) * 0.6); m.mr = Math.min(100, Math.max(0, Math.round((t.mr || 0) + (lv - (t.lv || 1)) * 0.5)));
    if (m.mag) m.mag = scaleMag(m.mag, f); if (m.mag2) m.mag2 = scaleMag(m.mag2, f);
    if (boss && !t.boss) { m.boss = true; m.hard = true; m.hp *= 6; m.exp *= 6; m.goldMin *= 5; m.goldMax *= 5; }
    if (!boss && t.boss) { m.boss = false; m.hard = false; m.hp = round(m.hp / 6); m.exp = round(m.exp / 6); }
    m.afkTtmi = true;
    var id = 'afk_ttmi_' + (++made);
    DB.mobs[id] = m; byName[name] = id;
    animCopy(name, tName);
    // 掉落：沿用樣板
    try { if (MOB_DROPS[tName] && !MOB_DROPS[name]) MOB_DROPS[name] = MOB_DROPS[tName].map(function (x) { return x.slice(); }); } catch (e) {}
    return id;
  };

  var REG = {}; MAP_REGIONS.forEach(function (r) { REG[r.key] = r; });
  var addedMaps = [];
  Object.keys(DATA).forEach(function (mapId) {
    if (mapId[0] === '_' || DB.maps[mapId]) return;
    var info = DATA[mapId], k = info.k || 1, ids = [];
    info.mobs.forEach(function (row) {
      var name = row[0], boss = !!row[2], id = byName[name];
      if (!id) id = newMob(name, round(row[1] * k), boss);
      if (id && ids.indexOf(id) < 0) ids.push(id);
    });
    if (!ids.length) return;
    DB.maps[mapId] = ids;
    var entry = { v: mapId, t: info.t, c: '#93c5fd' };
    (MAP_CATEGORIES[info.cat === 'dungeon' ? 'dungeon' : 'wild']).push(entry);
    if (REG[info.region]) REG[info.region].maps.push({ v: mapId, t: info.t });
    try { if (info.bg) SPECIAL_AREA_BG[mapId] = 'assets/area/' + info.bg + '.jpg'; } catch (e) {}
    addedMaps.push(info.t);
  });
  // 變異實驗體搬到魔族實驗室 2 樓（afk-sets 原本暫放在黑魔法研究室）
  try { if (DB.maps.demon_lab_2 && DB.maps.dark_magic_lab) DB.maps.dark_magic_lab = DB.maps.dark_magic_lab.filter(function (id) { return id !== 'afk_boss_mutant'; }); } catch (e) {}
  // 火焰之影（暗影神殿 3 樓首領）掉火焰之影素材
  try { [['afk_mat_yh_head', 20], ['afk_mat_yh_tail', 20], ['afk_mat_yh_spine', 30], ['afk_mat_yh_wing', 50], ['afk_mat_yh_nail', 50]].forEach(function (r) { if (!DB.items[r[0]]) return; var a = MOB_DROPS['火焰之影'] = MOB_DROPS['火焰之影'] || []; if (!a.some(function (x) { return x[0] === r[0]; })) a.push(r); }); } catch (e) {}

  window.__afkMaps = { maps: addedMaps, newMobs: made, missingTpl: missingTpl };
  if (missingTpl.length) console.warn('[AFK-maps] 找不到樣板：', missingTpl.join('、'));
  console.log('[AFK-maps] 已啟用：新增 ' + addedMaps.length + ' 張地圖、' + made + ' 種怪物');
})();
