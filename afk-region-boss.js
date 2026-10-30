/* ============================================================================
 * afk-region-boss.js — 地區霸主（玩家 2026-10-30：「每個地區有自己的地區特殊王，打倒會掉落道具」）
 *
 *   15 個地區各有一名霸主（銀騎士村、妖精森林、說話之島、燃柳村、古魯丁、肯特、風木、海音、奇岩、龍之谷、威頓、歐瑞、亞丁、傲慢之塔、拉斯塔巴德）。
 *   出現：角色 Lv15 以上，在該地區的野外／地監／傲慢之塔（城鎮、副本、時空裂痕、攻城、純 BOSS 房不出現）每次新出怪 1%；
 *         同一個地區 30 分鐘內只出一次，任何霸主離場後全部再等 5 分鐘；世界事件、克特、幽靈船進行中與離線補跑期間不出現。
 *   不追人：霸主守在出現的地圖 5 分鐘（只在那張圖計時），換地圖就回巢穴。
 *   強度：L＝地圖一般怪平均等級＋5（18～120），HP×(L÷65)^2.5×(1＋0.15×傭兵數)，傷害骰×L÷65、額外傷害×(L÷65)^1.3（同世界事件）。
 *   招式（每名霸主兩種）：
 *     召喚：每 45 秒，手下少於 2 名時叫 2 名；
 *     狂暴：HP 30% 以下一次，攻擊速度 ×1.5、造成的傷害 ×1.3；
 *     震地：每 30 秒全隊受到最大 HP 6% 的傷害；
 *     再生：每 10 秒回復最大 HP 2%；
 *     魔法屏障／物理屏障：每 40 秒張開 6 秒，該類傷害無效（幻術士「粉碎能量」打破魔法屏障、妖精「污濁之水」沖散物理屏障）。
 *   打倒：經驗、金幣 ×3、原型的掉落表、「地區霸主的寶箱」×1、該地區的「霸主的證明」×1（特殊收藏用）。
 *   席琳夢域鏡（afk-dreamboss）：出場全隊目前 HP 5%＋5 秒內每秒 3%；5% 機率「霸主群」——場上 5 隻都變成這名霸主（各自掉寶箱與證明，全倒才算打倒），全隊再受目前 HP 30%。
 *   外掛開關 regionboss（預設開）。
 * ========================================================================== */
(function () {
  'use strict';
  (function () {   // 世界事件狀態列：多個倒數改成上下排，不擠壓「冒險地圖」標題（玩家 2026-10-30 13:49）
    if (document.getElementById('afk-ev-badges-css')) return;
    var st = document.createElement('style'); st.id = 'afk-ev-badges-css';
    st.textContent = '#afk-ev-badges{display:inline-flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:1px;line-height:1.2;white-space:nowrap;font-size:13px;min-width:0}'
      + '#afk-ev-badges>span{margin-left:0!important}#afk-ev-badges:empty{display:none}'
      + '#map-view-panel>.panel-header>span:first-child{white-space:nowrap;min-width:0}';
    (document.head || document.documentElement).appendChild(st);
  })();
  var W = window, T = W.AFK_TOGGLES, L = W.__afkLore;
  if (T && T.register) T.register({ id: 'regionboss', name: '地區霸主', group: '遊戲內容',
    desc: '每個地區有自己的霸主：在該地區的野外與地監每次出怪 1% 現身（同地區 30 分鐘一次），守在原地 5 分鐘，打倒得寶箱與霸主的證明' });
  if (T && !T.enabled('regionboss')) return;
  if (!L || typeof DB === 'undefined' || !DB.mobs || typeof MAP_REGIONS === 'undefined') return;

  var RATE = 0.01, CD_MS = 30 * 60 * 1000, GAP_MS = 5 * 60 * 1000, DUR = 3000, LV_MIN = 15, REF = 65;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = L.esc, sys = L.sys, clog = L.clog;
  var IC = function (p) { return 'assets/icons/' + p + '.png'; };
  var mobIdByName = function (n) { for (var k in DB.mobs) if (DB.mobs[k] && DB.mobs[k].n === n && !DB.mobs[k].boss) return k; return null; };
  var protoOf = function (n) { var hit = null; for (var k in DB.mobs) if (DB.mobs[k] && DB.mobs[k].n === n) { hit = k; if (!DB.mobs[k].afkTtmi) break; } return hit; };

  // ── 十五名霸主（mech：summon／enrage／quake／regen／shieldM／shieldP）──
  var R = [
    { r: 'silverknight', n: '背誓的銀騎士 歐德', proto: '黑騎士', race: '黑騎士', e: 'none', mech: ['summon', 'enrage'], minion: '骷髏',
      lore: '曾經守衛銀騎士村的騎士。為了活下去向黑騎士團低頭，從此帶著亡者在村外遊蕩。', trophy: '背誓者的銀徽章', ti: 'items/法令軍王徽印' },
    { r: 'fairyforest', n: '腐化的卡司特之王', proto: '卡司特', race: '卡司特', e: 'earth', mech: ['regen', 'summon'], minion: '那魯加妖魔',
      lore: '喝了被汙染的泉水而巨大化的卡司特。妖精們說牠的根扎進了森林的傷口，只要還站著就會一直長回來。', trophy: '腐化的樹根', ti: 'items/污濁安特的樹枝' },
    { r: 'talkingisland', n: '蛛巢之母', proto: '阿勒尼亞', race: '蜘蛛', e: 'earth', mech: ['summon', 'quake'], minion: '楊果里恩',
      lore: '說話之島北方森林深處的巨大母蛛。牠產下的楊果里恩，就是島上蜘蛛越打越多的原因。', trophy: '母蛛的毒囊', ti: 'items/墮落之毒' },
    { r: 'burningwillow', n: '沉沒的海賊王 德雷克', proto: '德雷克', race: '不死', e: 'water', mech: ['quake', 'summon'], minion: '海賊骷髏',
      lore: '海賊島傳說裡沉了船的海賊王。滿月的夜裡，他會帶著船員爬上岸，用幽靈炮轟擊所有靠近寶藏的人。', trophy: '海賊王的金幣', ti: 'items/金幣' },
    { r: 'gludin', n: '古魯丁的守墓人', proto: '死神', race: '不死', e: 'earth', mech: ['summon', 'enrage'], minion: '食屍鬼',
      lore: '古魯丁墓園裡沒有人記得名字的守墓人。誰驚動了亡者，他就讓誰一起留下來。', trophy: '守墓人的鐮刀碎片', ti: 'items/墮落鐮刀' },
    { r: 'kent', n: '肯特草原的狂暴歐吉', proto: '歐吉', race: '歐吉', e: 'none', mech: ['enrage', 'quake'], minion: '歐吉',
      lore: '在肯特城外的草原上橫衝直撞的巨大歐吉。腳步一落，地面就跟著震動。', trophy: '狂暴歐吉的獠牙', ti: 'items/墮落之牙' },
    { r: 'windwood', n: '失控的實驗體「零號」', proto: '實驗變異怪(咆哮翼魔)', race: '惡魔', e: 'wind', mech: ['shieldP', 'summon'], minion: '秘密實驗室騎兵',
      lore: '魔族實驗室最早的作品，逃出來之後一直在風木沙漠遊蕩。外殼會張開一層擋住刀劍的屏障。', trophy: '零號的實驗核心', ti: 'items/瘴氣魔石' },
    { r: 'heine', n: '暴走的古代高崙', proto: '牛人高崙', race: '高崙', e: 'earth', mech: ['shieldM', 'quake'], minion: '高崙守護者(石頭)',
      lore: '海音一帶古王國留下的高崙。核心裡刻著拒絕魔法的咒文，暴走之後誰也停不下來。', trophy: '古代高崙的咒文核心', ti: 'items/高崙之心' },
    { r: 'giran', n: '奇岩叢林的虎王', proto: '森林老虎', race: '動物', e: 'water', mech: ['enrage', 'regen'], minion: '森林老虎',
      lore: '奇岩叢林最深處的老虎之王。獵人說牠的傷口一轉眼就會癒合，要一口氣打倒。', trophy: '虎王的毛皮', ti: 'items/奇美拉之皮(獅子)' },
    { r: 'dragonvalley', n: '龍之谷的古老飛龍', proto: '飛龍', race: '飛龍', e: 'wind', mech: ['quake', 'enrage'], minion: '思克巴',
      lore: '在龍之谷上空盤旋了幾百年的老飛龍。牠一落地，龍息就會掃過整片山谷。', trophy: '古老飛龍的鱗片', ti: 'items/飛龍的爪子' },
    { r: 'witon', n: '熔岩之心 阿西塔基奧', proto: '阿西塔基奧', race: '阿西塔基奧', e: 'fire', mech: ['quake', 'shieldP'], minion: '火蜥蜴',
      lore: '火龍窟熔岩裡長出來的阿西塔基奧之王。熔岩外殼擋得住刀劍，噴發時整個洞窟都在燃燒。', trophy: '熔岩之心', ti: 'items/不死鳥之心' },
    { r: 'oren', n: '歐瑞雪原的雪怪王', proto: '雪怪', race: '動物', e: 'water', mech: ['summon', 'quake'], minion: '雪怪',
      lore: '歐瑞雪原上最大的雪怪。牠一吼，雪崩就從山上滾下來，族群跟著衝下山。', trophy: '雪怪王的心臟', ti: 'items/雪怪之心' },
    { r: 'aden', n: '黃昏山脈的巨人王', proto: '古代巨人', race: '巨人', e: 'earth', mech: ['quake', 'enrage'], minion: null,
      lore: '古代巨人一族最後的王，守著黃昏山脈的山口。他每踏一步，山脈就跟著搖晃。', trophy: '巨人王的臂環', ti: 'items/戰士的印記(泰坦：岩石)' },
    { r: 'tower', n: '傲慢之塔的守門人', proto: '闇黑的騎士范德', race: '亞人', e: 'none', mech: ['shieldM', 'shieldP'], minion: null,
      lore: '傲慢之塔建成時就站在塔裡的守門人。他輪流張開兩種屏障，只讓懂得變換戰法的人通過。', trophy: '守門人的鑰匙', ti: 'items/古代鑰匙' },
    { r: 'rastabad', n: '叛亂的黑暗長老', proto: '長老．琪娜', race: '拉斯塔巴德', e: 'none', mech: ['shieldM', 'summon'], minion: '闇黑君王',
      lore: '想在長老會議之外另立君王的黑暗長老。他用黑魔法擋下咒文，命令冥法軍替他戰鬥。', trophy: '叛亂長老的印戒', ti: 'items/冥法軍王徽印' }
  ];
  var MECH_N = { summon: '召喚', enrage: '狂暴', quake: '震地', regen: '再生', shieldM: '魔法屏障', shieldP: '物理屏障' };
  var MECH_D = { summon: '每 45 秒，手下少於 2 名時叫 2 名', enrage: 'HP 30% 以下狂暴：攻擊速度 ×1.5、造成的傷害 ×1.3', quake: '每 30 秒全隊受到最大 HP 6% 的傷害',
    regen: '每 10 秒回復最大 HP 2%', shieldM: '每 40 秒張開 6 秒：魔法傷害無效（幻術士「粉碎能量」打破）', shieldP: '每 40 秒張開 6 秒：物理傷害無效（妖精「污濁之水」沖散）' };
  var regionLabel = {}; MAP_REGIONS.forEach(function (x) { regionLabel[x.key] = x.label; });
  var BY = {}, TTMI = {};
  try { ((W.AFK_TTMI_ITEMS && W.AFK_TTMI_ITEMS.items) || []).forEach(function (id) { TTMI[id] = 1; }); } catch (e) {}
  R.forEach(function (b) {
    b.id = 'afk_rb_' + b.r; b.label = regionLabel[b.r] || b.r; b.trophyId = 'afk_rb_tr_' + b.r;
    var pk = protoOf(b.proto), base = pk ? JSON.parse(JSON.stringify(DB.mobs[pk])) : {};
    ['n', 'afkTtmi', 'hard', 'img', 'boss', 'mag', 'mag2', 'mag3'].forEach(function (k) { delete base[k]; });
    L.addMob(b.id, Object.assign(base, { s: 'L', beh: '主動', lv: REF }, { n: b.n, boss: true, race: b.race, e: b.e, hp: 30000, ac: -65, mr: 90, exp: 5000, goldMin: 3000, goldMax: 7000,
      atkSpd: 1.6, dmg: [3, 40], db: 40, hit: 80, afkRb: b.r,
      mag: { skn: b.n.split(' ').pop() + '的重擊', cd: 70, chance: 0.4, dmg: [4, 60], db: 80, ele: b.e === 'none' ? 'none' : b.e, alwaysHit: true } }), b.proto);
    try { if (typeof MOB_DROPS !== 'undefined' && !MOB_DROPS[b.n] && MOB_DROPS[b.proto]) MOB_DROPS[b.n] = MOB_DROPS[b.proto].filter(function (x) { return !TTMI[x[0]] && !(DB.items[x[0]] && DB.items[x[0]].questItem); }).map(function (x) { return x.slice(); }); } catch (e) {}   // 只抄原作掉落（材料工坊等外掛道具有自己的掉落規則）
    L.addItem(b.trophyId, { n: b.trophy, type: 'misc', c: 'text-amber-200', img: IC(b.ti), p: 2000, afkRbTrophy: b.r,
      d: b.label + '的霸主「' + b.n + '」留下的證明。' + b.lore + '（特殊收藏：地區霸主）' });
    BY[b.r] = b;
  });

  // ── 寶箱 ──
  var BOX = 'afk_rb_box';
  L.addItem(BOX, { n: '地區霸主的寶箱', type: 'misc', eff: 'afk_rb_box', c: 'text-amber-300', img: IC('items/戰士的印記(亡命之徒)'), p: 0, afkRbBox: true,   /* eff：道具視窗才會出現「使用」按鈕（2026-10-30 修） */
    d: '打倒地區霸主得到的寶箱。打開隨機得到：魔法結晶體 20～40（55%）、金幣（霸主等級×1,000，10%）、祝福的 對盔甲施法的卷軸（20%）、祝福的 對武器施法的卷軸（10%）、龍之鑽石 ×3（5%）。' });
  var CRYSTAL = function () { try { return W.AFK_TTMI_ITEMS.resolve(7102); } catch (e) { return null; } };
  var rint = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  var openBox = function (it) {
    var p = P(); if (!p || !it) return;
    if ((Number(it.cnt) || 1) > 1) it.cnt = (Number(it.cnt) || 1) - 1; else p.inv.splice(p.inv.indexOf(it), 1);
    var r = Math.random(), got = '', lv = Number(it.rbLv) || Number(p.lv) || 30;
    if (r < 0.55 && CRYSTAL() && DB.items[CRYSTAL()]) { var n = rint(20, 40); gainItem(CRYSTAL(), n, true, true); got = DB.items[CRYSTAL()].n + ' ×' + n; }
    else if (r < 0.65) { var g = Math.min(120, lv) * 1000; p.gold = (Number(p.gold) || 0) + g; got = g.toLocaleString() + ' 金幣'; }
    else if (r < 0.85) { gainItem('scroll_armor_b', 1, true, true); got = DB.items.scroll_armor_b.n; }
    else if (r < 0.95) { gainItem('scroll_weapon_b', 1, true, true); got = DB.items.scroll_weapon_b.n; }
    else { var ok = false; try { ok = !!(W.pandoraAdjustSharedDiamonds(3) || {}).ok; } catch (e) {} if (ok) got = '龍之鑽石 ×3'; else { gainItem('scroll_weapon_b', 1, true, true); got = DB.items.scroll_weapon_b.n; } }
    sys('<span class="text-amber-300">打開地區霸主的寶箱：' + got + '</span>');
    try { renderTabs(); updateUI(); saveGame(); } catch (e) {}
  };
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (uid) {
      var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uid; });
      if (it && it.id === BOX && !it.lock) { openBox(it); try { var left = p.inv.find(function (x) { return x.uid === uid; }); if (left && typeof openModal === 'function') openModal(left, false); else if (typeof closeModal === 'function') closeModal(); } catch (e) {} return; }
      return oUse.apply(this, arguments);
    };
  }

  // ── 地圖、等級 ──
  var catOf = function (id) { if (typeof MAP_CATEGORIES === 'undefined') return null; for (var k in MAP_CATEGORIES) if ((MAP_CATEGORIES[k] || []).some(function (m) { return m.v === id; })) return k; return null; };
  var NO = { training: 1, dream_island: 1, barlog_room: 1, town_pride: 1 };
  var okMap = function (id) {
    if (W.__afkKurtHunt && W.__afkKurtHunt.okMap) return W.__afkKurtHunt.okMap(id);
    if (!id || id === 'rift_battle' || NO[id] || /^afk_|^dom_tower|^town_/.test(id)) return false;
    var c = catOf(id); if (c !== 'wild' && c !== 'dungeon' && c !== 'tower' && c !== 'pirate_island') return false;
    if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS.indexOf(id) >= 0) return false;
    if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[id]) return false;
    if (typeof ANTHARAS_AREA_BOSS !== 'undefined' && ANTHARAS_AREA_BOSS[id]) return false;
    if ((W.__afkNoOfflineMaps || []).indexOf(id) >= 0) return false;
    try { if (typeof isSiegeArea === 'function' && isSiegeArea(id)) return false; } catch (e) {}
    return !!(DB.maps[id] && DB.maps[id].length);
  };
  var regionOf = function (id) { try { var k = typeof mapRegionOf === 'function' ? mapRegionOf(id) : null; return k && BY[k] ? k : null; } catch (e) { return null; } };
  var mapLv = function (id) { var ls = (DB.maps[id] || []).map(function (k) { return DB.mobs[k]; }).filter(function (m) { return m && !m.boss; }).map(function (m) { return Number(m.lv) || 1; }); return ls.length ? Math.round(ls.reduce(function (a, b) { return a + b; }, 0) / ls.length) : 1; };
  var levelFor = function (id) { return Math.max(18, Math.min(120, mapLv(id) + 5)); };
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

  // ── 狀態（冷卻、紀錄存在角色上）──
  var act = null;
  var store = function () { var p = P(); if (!p) return { cd: {}, gap: 0, stats: {} }; if (!p.afkRb || typeof p.afkRb !== 'object') p.afkRb = { cd: {}, gap: 0, stats: {} }; p.afkRb.cd = p.afkRb.cd || {}; p.afkRb.stats = p.afkRb.stats || {}; return p.afkRb; };
  var stat = function (r) { var s = store().stats; return s[r] || (s[r] = { met: 0, kills: 0, first: 0 }); };
  var busy = function () {
    try { if (W.__afkWorldEvents && W.__afkWorldEvents.active && W.__afkWorldEvents.active()) return true; } catch (e) {}
    try { if (W.__afkKurtHunt && W.__afkKurtHunt.hunt && W.__afkKurtHunt.hunt()) return true; } catch (e) {}
    try { if (W.__afkGhostShip && W.__afkGhostShip.run && W.__afkGhostShip.run()) return true; } catch (e) {}
    try { if (typeof W.__afkOfflineNow === 'function' && W.__afkOfflineNow()) return true; } catch (e) {}
    return false;
  };
  var canTrigger = function (mapId) {
    var p = P(); if (!p || act || p.dead || (Number(p.lv) || 0) < LV_MIN || busy()) return null;
    if (!okMap(mapId)) return null;
    var r = regionOf(mapId); if (!r) return null;
    var s = store(); if (Date.now() < (Number(s.gap) || 0) || Date.now() < (Number(s.cd[r]) || 0)) return null;
    return r;
  };
  var onField = function (role) { return (mapState.mobs || []).map(function (m, i) { return [m, i]; }).filter(function (x) { var m = x[0]; return m && act && m._afkRb === act.r && !m._dead && m.curHp > 0 && (role === 'boss' ? m._rbBoss : role === 'minion' ? m._rbMinion : true); }); };
  var badge = function () {
    try {
      var el = document.getElementById('afk-rb-badge');
      if (!act) { if (el) el.remove(); return; }
      var host = document.getElementById('afk-ev-badges');
      if (!host) { var sa = document.getElementById('status-alerts'); if (!sa || !sa.parentNode) return; host = document.createElement('span'); host.id = 'afk-ev-badges'; host.className = 'text-sm'; host.style.cssText = 'font-weight:bold;font-variant-numeric:tabular-nums;white-space:nowrap'; sa.parentNode.insertBefore(host, sa.nextSibling); }
      if (!el) { el = document.createElement('span'); el.id = 'afk-rb-badge'; el.style.cssText = 'font-weight:bold;margin-left:6px;color:#fcd34d'; host.appendChild(el); }
      var s = Math.max(0, Math.ceil(act.left / 10)), mm = Math.floor(s / 60), ss = s % 60;
      var tx = '👑 ' + BY[act.r].label + '霸主 ' + (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss; if (el.textContent !== tx) el.textContent = tx;
    } catch (e) {}
  };
  var start = function (r, idx) {
    var b = BY[r], cur = mapState.current, Lv = levelFor(cur), p = P();
    var m = scale(DB.mobs[b.id], Lv, 1 + 0.15 * allyCount());
    var mob = L.boss.place(idx, m, { mobId: b.id, _afkRb: r, _rbBoss: true, _rbL: Lv });
    if (!mob) return false;
    // 霸主群（玩家 2026-10-30 19:09，只在席琳夢域鏡）：5% 機率場上 5 隻都變成這名霸主（各自掉寶箱與證明；全倒才算打倒）
    var DBS = W.__afkDreamBoss, swarm = 0;
    try {
      if (DBS && DBS.on && DBS.on() && Math.random() < DBS.SWARM) {
        (mapState.mobs || []).forEach(function (o, j) {
          if (j === idx || (o && !o._dead && (o.boss || o._afkFinal))) return;
          if (L.boss.place(j, scale(DB.mobs[b.id], Lv, 1 + 0.15 * allyCount()), { mobId: b.id, _afkRb: r, _rbBoss: true, _rbL: Lv, _rbSwarmCopy: true })) swarm++;
        });
        if (swarm) mob._rbSwarm = swarm;
      }
    } catch (e) { console.warn('[AFK-region-boss] swarm', e); }
    act = { r: r, map: cur, left: DUR, L: Lv, summonAt: tk() + 150, quakeAt: tk() + 300, regenAt: tk() + 100, shieldAt: tk() + 200, shieldKind: 0, enraged: false, swarm: swarm };
    store().cd[r] = Date.now() + CD_MS; store().gap = Date.now() + GAP_MS; stat(r).met++;
    try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(mob); } catch (e) {}
    try { if (!S().ff) renderMobs(); } catch (e) {}
    sys('<span class="font-bold" style="color:#fcd34d;text-shadow:0 0 8px #000">👑 ' + esc(b.label) + '的霸主「' + esc(b.n) + '」出現了！</span><span class="text-slate-300">（Lv' + Lv + '，' + b.mech.map(function (k) { return MECH_N[k]; }).join('、') + '；5 分鐘內打倒，換地圖它就回巢穴）</span>');
    if (swarm) sys('<span class="font-bold" style="color:#fcd34d;text-shadow:0 0 8px #000">👑 霸主群！場上 ' + (swarm + 1) + ' 隻都是「' + esc(b.n) + '」！</span>');
    badge();
    return true;
  };
  var end = function (why) {
    if (!act) return;
    var b = BY[act.r];
    onField().forEach(function (x) { if (why !== 'kill' || !x[0]._rbBoss) mapState.mobs[x[1]] = null; });
    try { if (!S().ff) renderMobs(); } catch (e) {}
    if (why === 'leave') sys('<span style="color:#fcd34d">👑 ' + esc(b.n) + ' 回到了巢穴。</span>');
    else if (why === 'time') sys('<span style="color:#fcd34d">👑 ' + esc(b.n) + ' 不再理會你們，回到了巢穴。</span>');
    else if (why === 'kill') sys('<span class="font-bold" style="color:#fcd34d">👑 ' + esc(b.label) + '的霸主「' + esc(b.n) + '」倒下了！</span>');
    store().gap = Date.now() + GAP_MS;
    act = null; badge();
  };
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      var r = oSpawn.apply(this, arguments);
      try {
        var m = mapState.mobs && mapState.mobs[idx];
        if (m && !m.boss && !m._afkWe && !m._afkKurt && !m._afkRb && !act) { var rg = canTrigger(mapState.current); if (rg && Math.random() < RATE) start(rg, idx); }   // 先看條件再擲骰（不在可出現的地圖就不消耗亂數）
      } catch (e) { console.warn('[AFK-region-boss] spawn', e); }
      return r;
    };
  }

  // ── 招式 ──
  var has = function (k) { return BY[act.r].mech.indexOf(k) >= 0; };
  var skills = function (m) {
    var t = tk(), b = BY[act.r];
    if (L.boss.halted(m)) { ['summonAt', 'quakeAt', 'regenAt', 'shieldAt'].forEach(function (k) { act[k]++; }); return; }
    if (has('enrage') && !act.enraged && m.curHp <= m.hp * 0.3) {
      act.enraged = true; m._rbEnraged = true; m.atkSpd = Math.max(0.3, (Number(m.atkSpd) || 1.6) / 1.5);
      clog('<span class="font-bold" style="color:#f87171">【狂暴】</span>' + esc(m.n) + ' 怒吼起來——攻擊速度 ×1.5、傷害 ×1.3！');
    }
    if (has('summon') && t >= act.summonAt) {
      act.summonAt = t + 450;
      var mid = b.minion && mobIdByName(b.minion);
      if (mid && onField('minion').length < 2) { var n = L.boss.summon(mid, 2, { _afkRb: act.r, _rbMinion: true }); if (n) clog('<span class="font-bold" style="color:#fcd34d">【召喚】</span>' + esc(m.n) + ' 叫來了 ' + n + ' 名' + esc(b.minion) + '。'); }
    }
    if (has('quake') && t >= act.quakeAt) {
      act.quakeAt = t + 300;
      L.boss.party().forEach(function (x) { if (!x || x.dead || x._downed) return; var mx = x === P() ? (x.mhp || 1) : (x.mhp || x.curHp || 1); L.boss.hurt(x, mx * 0.06); });
      clog('<span class="font-bold" style="color:#fb923c">【震地】</span>' + esc(m.n) + ' 重重踏地——全隊受到最大 HP 6% 的傷害。');
    }
    if (has('regen') && t >= act.regenAt) { act.regenAt = t + 100; if (m.curHp < m.hp) m.curHp = Math.min(m.hp, m.curHp + Math.ceil(m.hp * 0.02)); }
    if ((has('shieldM') || has('shieldP')) && t >= act.shieldAt) {
      act.shieldAt = t + 400;
      var kinds = ['shieldM', 'shieldP'].filter(has), k = kinds[act.shieldKind++ % kinds.length], magic = k === 'shieldM';
      m._reflectWall = { kind: magic ? 'magic' : 'phys', until: t + 60, block: true, afkRb: true };
      clog('<span class="font-bold" style="color:#a78bfa">【' + MECH_N[k] + '】</span>' + esc(m.n) + ' 張開了' + MECH_N[k] + '——6 秒內' + (magic ? '魔法' : '物理') + '傷害無效' + (magic ? '（幻術士的粉碎能量可以打破）' : '（妖精的污濁之水可以沖散）') + '。');
    }
  };
  var step = function () {
    if (!act) return;
    var p = P(); if (!p) return;
    if (mapState.current !== act.map) { end('leave'); return; }
    var bb = onField('boss')[0];
    if (!bb) { end('leave'); return; }
    act.left--;
    if (act.left <= 0) { end('time'); return; }
    skills(bb[0]);
    if (tk() % 10 === 0) badge();
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var t0 = tk(), r = oTick.apply(this, arguments); if (tk() !== t0) { try { step(); } catch (e) { console.warn('[AFK-region-boss] tick', e); } } return r; };
  }
  // 狂暴：造成的傷害 ×1.3
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { return mob && mob._rbEnraged && mob._afkRb ? 1.3 : 1; });
  // 屏障的戰鬥訊息改成「霸主的屏障」（核心 block 訊息寫死成「恐怖的面貌」）
  if (typeof W.reflectWallOnDamage === 'function') {
    var oRW = W.reflectWallOnDamage;
    W.reflectWallOnDamage = function (mob) {
      var w = mob && mob._reflectWall; if (!w || !w.afkRb || typeof W.logCombat !== 'function') return oRW.apply(this, arguments);
      var oLog = W.logCombat;
      W.logCombat = function (h, c) { return oLog.call(this, String(h).replace('【恐怖的面貌】', '【霸主的屏障】'), c); };
      try { return oRW.apply(this, arguments); } finally { W.logCombat = oLog; }
    };
  }
  // 擊殺
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState.mobs ? mapState.mobs[idx] : null, r = oKill.apply(this, arguments);
      try {
        if (m && m._dead && m._rbBoss && !m._rbPaid && act && m._afkRb === act.r) {
          m._rbPaid = true;
          var b = BY[act.r], st = stat(act.r), got = [];
          gainItem(BOX, 1, true, true); got.push(DB.items[BOX].n);
          try { var p = P(), bx = p && p.inv.filter(function (x) { return x && x.id === BOX; }).pop(); if (bx && !bx.rbLv) bx.rbLv = m._rbL; } catch (e) {}
          gainItem(b.trophyId, 1, true, true); got.push(b.trophy);
          st.kills++; if (!st.first) st.first = Date.now();
          sys('<span class="text-amber-300">' + esc(m.n) + ' 留下了：' + got.join('、') + '</span>');
          if (!onField('boss').length) end('kill');   // 霸主群：全部倒下才算打倒
        }
      } catch (e) { console.warn('[AFK-region-boss] kill', e); }
      return r;
    };
  }

  W.__afkRegionBoss = { LIST: R, BY: BY, RATE: RATE, CD_MS: CD_MS, GAP_MS: GAP_MS, DUR: DUR, LV_MIN: LV_MIN, BOX: BOX, MECH_N: MECH_N, MECH_D: MECH_D,
    active: function () { return act; }, canTrigger: canTrigger, regionOf: regionOf, okMap: okMap, levelFor: levelFor, stats: stat, store: store, step: step, end: end, openBox: openBox,
    start: function (r) { var ms = mapState.mobs || [], i; for (i = 0; i < ms.length; i++) if (!ms[i] || ms[i]._dead) break; if (i >= ms.length) for (i = 0; i < ms.length; i++) if (ms[i] && !ms[i].boss) break; if (i >= ms.length) return false; return start(r || regionOf(mapState.current), i); } };
  try { console.log('[AFK-region-boss] 已載入：地區霸主 ' + R.length + ' 名'); } catch (e) {}
})();
