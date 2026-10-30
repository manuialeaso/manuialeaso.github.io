/* ============================================================================
 * afk-world-events.js — 世界事件（追殺型）第二批（玩家 2026-10-29 21:07；跟「克特的追殺令」同一套規則）
 *
 *   共通：角色 Lv30 以上、在野外／地監／傲慢之塔／海賊島（副本、城鎮、時空裂痕、攻城、純 BOSS 房不出現），
 *         每次新出怪 5% 判定；每種事件各自冷卻 15 分鐘，任何一個世界事件（含克特）結束後全部再等 15 分鐘（2026-10-30 14:22 起，原 10 分鐘）。
 *         同一時間只會有一個世界事件。離線補跑期間不觸發。
 *         強度跟著地圖等級：L＝地圖一般怪平均等級＋8（18～115），HP×(L÷65)^2.5×(1＋0.15×傭兵數)，傷害骰×L÷65、額外傷害×(L÷65)^1.3。
 *         持續 10 分鐘（只在可出現的地圖計時），換地圖 20～40 秒後追來（HP 不回滿）；被追殺的人全部倒下＝失敗（照一般死亡）。
 *         打倒頭目：經驗、金幣 ×3、原型頭目的掉落表、世界事件的戰利品袋 ×1（打開隨機：魔法結晶體、祝福的卷軸、龍之鑽石）。
 *         事件期間，事件的怪 70% 優先攻擊被追殺的人。
 *   一、魔女賽尼斯「血的誓約詛咒」（隊伍裡有騎士）：她不近身，帶著 2 個「詛咒的媒介」。媒介活著時，每分鐘最大 HP −5%（最多 −40%，騎士與全隊都算）；
 *       媒介全部打倒＝詛咒解除（最大 HP 回來）。每 30 秒冰凍一名騎士 3 秒；媒介沒了，每 2 分鐘再叫 2 個。
 *   二、暗殺軍王史雷佛「暗殺軍團的刺殺令」（隊伍裡有黑暗妖精）：出場與每次隱身結束後的第一擊傷害 ×2.5；每 30 秒隱身 5 秒（打不到）；
 *       暗殺毒刃（中毒）；HP 低於 50% 遁走，要換地圖他才會再追來（只遁走一次）。
 *   三、魔族的獵龍隊（隊伍裡有龍騎士）：獵龍隊長＋3 名獵龍隊員。隊長活著時隊員受到的傷害 −80%；
 *       每 20 秒「獵龍號令」：5 秒內全隊對龍騎士的傷害 +50%。打倒隊長＝成功，隊員四散。
 *   四、反王肯恩「篡位者的懸賞」（你的血盟有城堡）：篡位者的刺客頭目＋2 名刺客，追殺城主（你）。
 *       每 45 秒「懸賞令」：標記你 5 秒，結束時受到最大 HP 30% 的傷害；5 秒內打掉頭目 5% HP 可以打斷。打倒頭目另得懸賞金（L×2,000 金幣）。
 *   五、冰之女王「寒冬」（玩家 2026-10-29 21:36；不挑職業，整隊都算）：冰之女王帶 2 名侍女。女王活著時「寒冬」籠罩：
 *       你的攻擊速度 −20%、傭兵與寵物的傷害 −20%；侍女還活著時加重成 −40%。每 10 秒凍傷（全隊各受最大 HP 2%，侍女活著 4%），
 *       每 30 秒冰封一名隊員 3 秒；侍女全倒後每 2 分鐘再叫 2 名。打倒女王＝寒冬結束。
 *   外掛開關：每個事件各一個（預設開）。
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
  var EV = {
    senis: { tog: 'wesenis', n: '魔女賽尼斯「血的誓約詛咒」', who: 'knight', whoN: '騎士', badge: '☠ 血的誓約詛咒', color: '#93c5fd',
      desc: '隊伍裡有騎士時，野外／地監／傲慢之塔每次出怪 5% 被魔女賽尼斯的詛咒追上 10 分鐘：詛咒的媒介活著時每分鐘最大 HP −5%，打倒媒介才解除' },
    slayer: { tog: 'weslayer', n: '暗殺軍王史雷佛「暗殺軍團的刺殺令」', who: 'dark', whoN: '黑暗妖精', badge: '🗡 暗殺軍團的刺殺令', color: '#c4b5fd',
      desc: '隊伍裡有黑暗妖精時，每次出怪 5% 被暗殺軍王史雷佛追殺 10 分鐘：隱身、偷襲、中毒，HP 一半會遁走、換地圖再來' },
    dragon: { tog: 'wedragon', n: '魔族的獵龍隊', who: 'dragon', whoN: '龍騎士', badge: '🐉 魔族的獵龍隊', color: '#fdba74',
      desc: '隊伍裡有龍騎士時，每次出怪 5% 被火焰之影的獵龍隊（隊長＋3 名隊員）追殺 10 分鐘：隊長活著時隊員很硬，要先打掉隊長' },
    kenn: { tog: 'wekenn', n: '反王肯恩「篡位者的懸賞」', who: 'lord', whoN: '城主', badge: '👑 篡位者的懸賞', color: '#fca5a5',
      desc: '你的血盟有城堡時，每次出怪 5% 被反王肯恩派來的刺客追殺 10 分鐘：懸賞令標記城主，打倒刺客頭目另得懸賞金' },
    winter: { tog: 'wewinter', n: '冰之女王「寒冬」', who: 'all', whoN: '全隊', badge: '❄ 寒冬', color: '#7dd3fc',
      desc: '不挑職業，每次出怪 5% 冰之女王帶著侍女降下寒冬 10 分鐘：全隊攻擊變慢、每 10 秒凍傷，先打倒侍女能減輕，打倒女王寒冬就結束' }
  };
  var IDS = Object.keys(EV);
  IDS.forEach(function (id) { var e = EV[id]; if (T && T.register) T.register({ id: e.tog, name: '世界事件：' + e.n, group: '遊戲內容', desc: e.desc }); });
  var on = function (id) { return !T || T.enabled(EV[id].tog); };
  if (!IDS.some(on)) return;
  if (!L || typeof DB === 'undefined' || !DB.mobs) return;

  var RATE = 0.05, CD_MS = 15 * 60 * 1000, GAP_MS = 15 * 60 * 1000,   /* 共用冷卻：玩家 2026-10-30 14:22 由 10 分鐘改 15 分鐘 */ DUR = 6000, LV_MIN = 30, REF = 65;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = L.esc, sys = L.sys, clog = L.clog;
  var rint = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  var IC = function (p) { return 'assets/icons/' + p + '.png'; };

  // ── 頭目與手下（數值以 Lv65 為準，實際依地圖等級縮放）──
  var mk = function (id, def, anim, from) {
    var base = from && DB.mobs[from] ? JSON.parse(JSON.stringify(DB.mobs[from])) : {};
    ['n', 'afkTtmi', 'hard', 'img'].forEach(function (k) { delete base[k]; });
    return L.addMob(id, Object.assign(base, { s: 'L', beh: '主動', lv: REF }, def), anim);
  };
  mk('afk_we_senis', { n: '魔女賽尼斯（血的誓約）', boss: true, race: '人形', e: 'water', hp: 26000, ac: -60, mr: 90, exp: 5200, goldMin: 4000, goldMax: 9000, atkSpd: 2.5, dmg: [2, 25], db: 30, hit: 70, afkWe: 'senis',
    mag: { skn: '誓約的冰雪颶風', cd: 90, dmg: [4, 40], db: 120, ele: 'water', alwaysHit: true, sec: { type: 'freeze', pbase: 100 } },
    mag2: { skn: '血的誓約', cd: 60, chance: 0.5, dmg: [3, 50], db: 140, ele: 'none', alwaysHit: true } }, '魔女賽尼斯');
  mk('afk_we_medium', { n: '詛咒的媒介', race: '不死', e: 'none', hp: 2600, ac: -40, mr: 60, exp: 400, atkSpd: 30, dmg: [1, 2], db: 0, hit: 0, afkWe: 'senis', weMedium: true }, '受詛咒的艾爾摩法師');
  mk('afk_we_slayer', { n: '暗殺軍王史雷佛（刺殺令）', boss: true, race: '拉斯塔巴德', e: 'none', hp: 24000, ac: -71, mr: 75, exp: 3722, goldMin: 1250, goldMax: 4000, atkSpd: 1, dmg: [3, 41], db: 62, hit: 89, afkWe: 'slayer',
    mag: { skn: '放射斬', cd: 50, chance: 0.2, dmg: [4, 114], db: 230, ele: 'none', alwaysHit: true },
    mag2: { skn: '暗殺毒刃', cd: 80, chance: 0.5, type: 'poison', pbase: 250, d: 40, tick: 3, dur: 12 } }, '暗殺軍王史雷佛', 'de_king_slayer');
  mk('afk_we_huntcap', { n: '魔族獵龍隊長', boss: true, race: '不死', e: 'fire', hp: 16000, ac: -70, mr: 100, exp: 4226, goldMin: 1500, goldMax: 3000, atkSpd: 1.5, dmg: [3, 68], db: 52, hit: 84, afkWe: 'dragon',
    mag: { skn: '地裂術', cd: 70, dmg: [4, 100], db: 52, ele: 'earth', alwaysHit: true } }, '火焰之影親衛隊(巴風特)', 'flameshadow_guard_baphomet');
  mk('afk_we_hunter', { n: '魔族獵龍隊員', race: '不死', e: 'fire', hp: 5000, ac: -66, mr: 97, exp: 1200, atkSpd: 2, dmg: [3, 60], db: 45, hit: 78, afkWe: 'dragon', weMinion: true,
    mag: { skn: '地裂術', cd: 70, dmg: [4, 80], db: 45, ele: 'earth', alwaysHit: true } }, '火焰之影親衛兵(小惡魔)', 'afk_ttmi_72');
  mk('afk_we_kenncap', { n: '篡位者的刺客頭目', boss: true, race: '人形', e: 'none', hp: 22000, ac: -78, mr: 50, exp: 5000, goldMin: 3000, goldMax: 6000, atkSpd: 1, dmg: [3, 40], db: 45, hit: 90, afkWe: 'kenn',
    mag: { skn: '劍氣斬', cd: 60, chance: 0.3, dmg: [4, 40], db: 80, ele: 'none', alwaysHit: true } }, '暗殺軍王史雷佛');
  mk('afk_we_assassin', { n: '篡位者的刺客', race: '人形', e: 'none', hp: 4000, ac: -58, mr: 70, exp: 900, atkSpd: 1.6, dmg: [2, 60], db: 38, hit: 70, afkWe: 'kenn', weMinion: true }, '魔族暗殺團', 'demon_assassin');
  mk('afk_we_icequeen', { n: '冰之女王（寒冬）', boss: true, race: '精靈', e: 'water', hp: 28000, ac: -65, mr: 110, exp: 5600, goldMin: 4000, goldMax: 9000, atkSpd: 2, dmg: [3, 30], db: 35, hit: 75, afkWe: 'winter',
    mag: { skn: '寒冬的暴風雪', cd: 80, dmg: [4, 45], db: 110, ele: 'water', alwaysHit: true },
    mag2: { skn: '冰之女王的吐息', cd: 120, chance: 0.5, dmg: [3, 40], db: 90, ele: 'water', alwaysHit: true, sec: { type: 'freeze', pbase: 100 } } }, '冰之女王', 'ice_queen');
  mk('afk_we_icemaid', { n: '冰之女王的侍女（寒冬）', race: '精靈', e: 'water', hp: 4500, ac: -55, mr: 80, exp: 900, atkSpd: 2, dmg: [2, 40], db: 25, hit: 65, afkWe: 'winter', weMinion: true, weMaid: true,
    mag: { skn: '冰錐', cd: 60, chance: 0.4, dmg: [3, 30], db: 40, ele: 'water', alwaysHit: true } }, '冰之女王侍女', 'ice_maid');
  try { MOB_PARTY_AOE_SKILLS.add('誓約的冰雪颶風'); MOB_PARTY_AOE_SKILLS.add('寒冬的暴風雪'); } catch (e) {}
  var BOSS = { senis: 'afk_we_senis', slayer: 'afk_we_slayer', dragon: 'afk_we_huntcap', kenn: 'afk_we_kenncap', winter: 'afk_we_icequeen' };
  var MINIONS = { senis: [['afk_we_medium', 2]], slayer: [], dragon: [['afk_we_hunter', 3]], kenn: [['afk_we_assassin', 2]], winter: [['afk_we_icemaid', 2]] };
  try {
    var TTMI = {}; ((W.AFK_TTMI_ITEMS && W.AFK_TTMI_ITEMS.items) || []).forEach(function (id) { TTMI[id] = 1; });
    var cp = function (to, from) { if (typeof MOB_DROPS !== 'undefined' && !MOB_DROPS[to] && MOB_DROPS[from]) MOB_DROPS[to] = MOB_DROPS[from].filter(function (x) { return !TTMI[x[0]]; }).map(function (x) { return x.slice(); }); };
    cp('魔女賽尼斯（血的誓約）', '賽尼斯(首領)'); cp('暗殺軍王史雷佛（刺殺令）', '暗殺軍王史雷佛'); cp('魔族獵龍隊長', '火焰之影親衛隊(巴風特)'); cp('篡位者的刺客頭目', '反王肯恩'); cp('冰之女王（寒冬）', '冰之女王');
  } catch (e) {}

  // ── 戰利品袋 ──
  var BAG = 'afk_we_bag';
  L.addItem(BAG, { n: '世界事件的戰利品袋', type: 'misc', eff: 'afk_we_bag', c: 'text-amber-300', img: IC('items/戰士的印記(亡命之徒)'), p: 0, afkWeBag: true,   /* eff：道具視窗才會出現「使用」按鈕（2026-10-30 修） */
    d: '打倒世界事件頭目得到的袋子。打開隨機得到：魔法結晶體 30～60（60%）、祝福的 對盔甲施法的卷軸（20%）、祝福的 對武器施法的卷軸（15%）、龍之鑽石 ×5（5%）。' });
  var CRYSTAL = function () { try { return W.AFK_TTMI_ITEMS.resolve(7102); } catch (e) { return null; } };
  var openBag = function (it) {
    var p = P(); if (!p || !it) return;
    if ((Number(it.cnt) || 1) > 1) it.cnt = (Number(it.cnt) || 1) - 1; else p.inv.splice(p.inv.indexOf(it), 1);
    var r = Math.random(), got = '';
    if (r < 0.6 && CRYSTAL() && DB.items[CRYSTAL()]) { var n = rint(30, 60); gainItem(CRYSTAL(), n, true, true); got = DB.items[CRYSTAL()].n + ' ×' + n; }
    else if (r < 0.8) { gainItem('scroll_armor_b', 1, true, true); got = DB.items.scroll_armor_b.n; }
    else if (r < 0.95) { gainItem('scroll_weapon_b', 1, true, true); got = DB.items.scroll_weapon_b.n; }
    else { var ok = false; try { ok = !!(W.pandoraAdjustSharedDiamonds(5) || {}).ok; } catch (e) {} if (ok) got = '龍之鑽石 ×5'; else { gainItem('scroll_weapon_b', 1, true, true); got = DB.items.scroll_weapon_b.n; } }
    sys('<span class="text-amber-300">打開世界事件的戰利品袋：' + got + '</span>');
    try { renderTabs(); updateUI(); saveGame(); } catch (e) {}
  };
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (uid) {
      var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uid; });
      if (it && it.id === BAG && !it.lock) { openBag(it); try { var left = p.inv.find(function (x) { return x.uid === uid; }); if (left && typeof openModal === 'function') openModal(left, false); else if (typeof closeModal === 'function') closeModal(); } catch (e) {} return; }
      return oUse.apply(this, arguments);
    };
  }

  // ── 地圖、等級（同克特）──
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
  var mapLv = function (id) { var ls = (DB.maps[id] || []).map(function (k) { return DB.mobs[k]; }).filter(function (m) { return m && !m.boss; }).map(function (m) { return Number(m.lv) || 1; }); return ls.length ? Math.round(ls.reduce(function (a, b) { return a + b; }, 0) / ls.length) : 1; };
  var levelFor = function (id) { return Math.max(18, Math.min(115, mapLv(id) + 8)); };
  var scale = function (base, Lv, hpMult) {
    var k = Lv / REF, m = JSON.parse(JSON.stringify(base));
    m.lv = Lv; m.hp = Math.max(1, Math.round(base.hp * Math.pow(k, 2.5) * (hpMult || 1)));
    if (Array.isArray(base.dmg)) m.dmg = [base.dmg[0], Math.max(2, Math.round(base.dmg[1] * k))];
    m.db = Math.max(0, Math.round((base.db || 0) * Math.pow(k, 1.3))); m.hit = Math.round((base.hit || 0) * k); m.ac = Math.round((base.ac || 0) * k); m.mr = Math.round((base.mr || 0) * k);
    ['mag', 'mag2', 'mag3'].forEach(function (f) { var s = m[f]; if (!s) return; if (Array.isArray(s.dmg)) { s.dmg = [s.dmg[0], Math.max(2, Math.round(s.dmg[1] * k))]; s.db = Math.round((s.db || 0) * Math.pow(k, 1.3)); } if (s.d) s.d = Math.max(1, Math.round(s.d * Math.pow(k, 1.3))); });
    m.exp = Math.round((base.exp || 0) * k * k * 3); m.goldMin = Math.round((base.goldMin || 0) * k * 3); m.goldMax = Math.round((base.goldMax || 0) * k * 3);
    return m;
  };

  // ── 隊伍 ──
  var catching = function () { try { return typeof W.__afkOfflineNow === 'function' && !!W.__afkOfflineNow(); } catch (e) { return false; } };
  var lordCity = function () { try { return typeof castleOwnerCity === 'function' ? castleOwnerCity() : null; } catch (e) { return null; } };
  var targets = function (id, alive) {
    var p = P(); if (!p) return [];
    var who = EV[id].who, out = [];
    if (who === 'lord') { if (lordCity() && (!alive || !p.dead)) out.push(p); return out; }
    if ((who === 'all' || p.cls === who) && (!alive || !p.dead)) out.push(p);
    (p.allies || []).forEach(function (a) { if (a && (who === 'all' || a.cls === who) && (!alive || (!a._downed && (a.curHp || 0) > 0))) out.push(a); });
    return out;
  };
  var allyCount = function () { var p = P(); return p ? (p.allies || []).filter(Boolean).length : 0; };
  var nameOf = function (t) { return t === P() ? '你' : esc(t._allyName || t.name || '傭兵'); };
  var party = function () { return L.boss.party(); };

  // ── 事件狀態（不存檔；冷卻存在角色上）──
  var act = null;
  var store = function () { var p = P(); if (!p) return {}; if (!p.afkWe || typeof p.afkWe !== 'object') p.afkWe = { cd: {}, gap: 0, stats: {} }; p.afkWe.cd = p.afkWe.cd || {}; p.afkWe.stats = p.afkWe.stats || {}; return p.afkWe; };
  var stat = function (id) { var s = store().stats; return s[id] || (s[id] = { met: 0, kills: 0, fails: 0, escapes: 0 }); };
  var onField = function (role) { return (mapState.mobs || []).map(function (m, i) { return [m, i]; }).filter(function (x) { var m = x[0]; return m && act && m._afkWe === act.id && !m._dead && m.curHp > 0 && (role === 'boss' ? m._weBoss : role ? m['_we' + role] : true); }); };
  var freeSlot = function (replace) {
    var ms = mapState.mobs || [], i;
    for (i = 0; i < ms.length; i++) if (!ms[i] || ms[i]._dead) return i;
    if (replace) for (i = 0; i < ms.length; i++) if (ms[i] && !ms[i].boss && !ms[i]._afkWe && !ms[i]._afkKurt) return i;
    return -1;
  };
  var placeOne = function (id, Lv, extra, replace) {
    var i = freeSlot(replace); if (i < 0) return null;
    var base = DB.mobs[id], m = scale(base, Lv, base.boss ? 1 + 0.15 * allyCount() : 1);
    return L.boss.place(i, m, Object.assign({ mobId: id, _afkWe: base.afkWe, _weL: Lv }, extra || {}));
  };
  var placeMinions = function (id, Lv) {
    var n = 0; (MINIONS[id] || []).forEach(function (x) { for (var k = 0; k < x[1]; k++) { var m = placeOne(x[0], Lv, { _weMinion: !!DB.mobs[x[0]].weMinion, _weMedium: !!DB.mobs[x[0]].weMedium, _weMaid: !!DB.mobs[x[0]].weMaid }, false); if (m) n++; } });
    return n;
  };
  var placeGroup = function (Lv, frac, idx) {
    var b;
    if (idx != null && idx >= 0) { var base = DB.mobs[BOSS[act.id]]; b = L.boss.place(idx, scale(base, Lv, 1 + 0.15 * allyCount()), { mobId: BOSS[act.id], _afkWe: act.id, _weL: Lv, _weBoss: true }); }
    else b = placeOne(BOSS[act.id], Lv, { _weBoss: true }, true);
    if (!b) return null;
    if (frac != null) b.curHp = Math.max(1, Math.round(b.hp * frac));
    placeMinions(act.id, Lv);
    try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(b); } catch (e) {}
    try { if (!S().ff) renderMobs(); } catch (e) {}
    return b;
  };
  var badge = function () {
    try {
      var el = document.getElementById('afk-we-badge');
      if (!act) { if (el) el.remove(); return; }
      var host = (function () {   // 世界事件的狀態列共用容器：放在 #status-alerts 旁邊，不放裡面（核心每個 tick 都會改寫 #status-alerts 的文字，把徽章洗掉又加回 → 那一排一直抖；玩家 2026-10-29 22:37）
        var h = document.getElementById('afk-ev-badges'); if (h) return h;
        var sa = document.getElementById('status-alerts'); if (!sa || !sa.parentNode) return null;
        h = document.createElement('span'); h.id = 'afk-ev-badges'; h.className = 'text-sm'; h.style.cssText = 'font-weight:bold;font-variant-numeric:tabular-nums;white-space:nowrap';
        sa.parentNode.insertBefore(h, sa.nextSibling); return h;
      })(); if (!host) return;
      if (!el) { el = document.createElement('span'); el.id = 'afk-we-badge'; el.style.cssText = 'font-weight:bold;margin-left:6px'; host.appendChild(el); }
      var s = Math.max(0, Math.ceil(act.left / 10)), mm = Math.floor(s / 60), ss = s % 60;
      el.style.color = EV[act.id].color; var tx = EV[act.id].badge + ' ' + (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss; if (el.textContent !== tx) el.textContent = tx;
    } catch (e) {}
  };
  var chillMult = function () { return act && act.id === 'winter' && act.chill > 0 ? (act.chill >= 2 ? 0.6 : 0.8) : 1; };
  var curseApply = function () { try { if (typeof recomputeStats === 'function') recomputeStats(); var p = P(); if (p && p.hp > p.mhp) p.hp = p.mhp; } catch (e) {} };
  var end = function (why) {
    if (!act) return;
    var id = act.id, st = stat(id), hadCurse = act.curse > 0 || act.chill > 0;
    onField().forEach(function (x) { if (why !== 'kill' || !x[0]._weBoss) mapState.mobs[x[1]] = null; });
    try { if (!S().ff) renderMobs(); } catch (e) {}
    var msg = {
      senis: { kill: '魔女賽尼斯的身影碎成了冰屑——誓約騎士的詛咒，這一次被你斬斷了。', fail: '賽尼斯輕聲笑了：「誓約，就是要流盡最後一滴血。」她消失在霧裡。', time: '十分鐘過去，賽尼斯的詛咒慢慢散去了。' },
      slayer: { kill: '暗殺軍王史雷佛倒下了，刺殺令在火光裡燒成灰。', fail: '史雷佛收起短刀：「叛徒，就該是這個下場。」', time: '史雷佛的氣息消失了——他還會再來。' },
      dragon: { kill: '獵龍隊長倒下，剩下的隊員四散逃走。', fail: '獵龍隊帶著勝利的號角離開了。', time: '獵龍隊吹響撤退的號角，消失在地平線。' },
      kenn: { kill: '刺客頭目倒下了，你從他懷裡搜出反王親筆的懸賞令。', fail: '刺客們帶著你的消息回去領賞了。', time: '刺客們沒等到機會，退回了陰影裡。' },
      winter: { kill: '冰之女王碎成了滿地冰晶，寒冬退去，陽光照了下來。', fail: '冰之女王俯視著凍僵的隊伍：「在永恆的冬天裡安睡吧。」', time: '風雪漸漸停了，冰之女王回到了她的城堡。' }
    }[id];
    if (why === 'kill') st.kills++; else if (why === 'fail') st.fails++; else st.escapes++;
    sys('<span class="font-bold" style="color:' + EV[id].color + '">' + EV[id].badge.split(' ')[0] + ' ' + (msg[why] || msg.time) + '</span>');
    store().gap = Date.now() + GAP_MS;
    act = null; badge();
    if (hadCurse) curseApply();
  };
  var start = function (id, idx) {
    var p = P(), cur = mapState.current, Lv = levelFor(cur);
    act = { id: id, left: DUR, map: cur, wait: 0, hpFrac: 1, L: Lv, fled: false, curse: 0, curseAt: tk() + 600, freezeAt: tk() + 300, stealthAt: tk() + 300, callAt: tk() + 200, markAt: tk() + 450, mark: null, mediumAt: tk() + 1200, ambush: true, chill: 0, frostAt: tk() + 100, maidAt: tk() + 1200 };
    store().cd[id] = Date.now() + CD_MS; store().gap = Date.now() + GAP_MS;
    stat(id).met++;
    var intro = {
      senis: '☠ 冰冷的霧氣湧了上來——魔女賽尼斯找到了誓約騎士的後代。血的誓約詛咒！',
      slayer: '🗡 一把短刀從背後抵住了黑暗妖精的喉嚨——暗殺軍團的刺殺令已經發出！',
      dragon: '🐉 地平線上響起號角——火焰之影的獵龍隊盯上了龍騎士！',
      kenn: '👑 「城主的頭，值一座城。」——反王肯恩派來的刺客找上門了！',
      winter: '❄ 氣溫驟降，風雪從四面八方捲來——冰之女王降臨，寒冬開始了！'
    }[id];
    placeGroup(Lv, null, idx);
    sys('<span class="font-bold" style="color:' + EV[id].color + ';text-shadow:0 0 8px #000">' + intro + '</span><span class="text-slate-300">（Lv' + Lv + '，10 分鐘內換地圖也會追來）</span>');
    badge();
  };
  var kurtBusy = function () { try { return !!(W.__afkKurtHunt && W.__afkKurtHunt.hunt && W.__afkKurtHunt.hunt()); } catch (e) { return false; } };
  var canTrigger = function (id) {
    var p = P(); if (!p || act || p.dead || !on(id)) return false;
    if ((Number(p.lv) || 0) < LV_MIN || kurtBusy() || catching()) return false;
    try { if (W.__afkRegionBoss && W.__afkRegionBoss.active()) return false; } catch (e) {}   // 地區霸主在場時不疊世界事件
    var s = store(); if (Date.now() < (Number(s.gap) || 0) || Date.now() < (Number(s.cd[id]) || 0)) return false;
    if (!targets(id, false).length) return false;
    return okMap(mapState.current);
  };
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      var r = oSpawn.apply(this, arguments);
      try {
        var m = mapState.mobs && mapState.mobs[idx];
        if (m && !m.boss && !m._afkWe && !m._afkKurt && !act) {
          var ok = IDS.filter(canTrigger);
          if (ok.length && Math.random() < RATE) start(ok[Math.floor(Math.random() * ok.length)], idx);
        }
      } catch (e) { console.warn('[AFK-world-events] spawn', e); }
      return r;
    };
  }

  // ── 技能 ──
  var freeze = function (mob, t, skn) {
    var sk = { skn: skn, type: 'freeze', pbase: 200, alwaysHit: true };
    try { if (t === P()) applyMobMagic(mob, sk); else if (typeof applyMobMagicToAlly === 'function') applyMobMagicToAlly(mob, sk, t); } catch (e) {}
  };
  var skills = function (b) {
    var t = tk(), id = act.id;
    if (L.boss.halted(b)) { ['curseAt', 'freezeAt', 'stealthAt', 'callAt', 'markAt', 'mediumAt', 'frostAt', 'maidAt'].forEach(function (k) { act[k]++; }); if (act.mark) act.mark.end++; return; }
    var frac = b.curHp / Math.max(1, b.hp);
    if (id === 'senis') {
      var meds = onField('Medium');
      if (!meds.length && act.curse > 0) { act.curse = 0; curseApply(); clog('<span class="font-bold" style="color:#86efac">【詛咒的媒介】</span>媒介全部碎裂——血的誓約詛咒解除了（最大 HP 恢復）。', 'player'); }
      if (meds.length && t >= act.curseAt) { act.curseAt = t + 600; if (act.curse < 8) { act.curse++; curseApply(); clog('<span class="font-bold" style="color:#93c5fd">【血的誓約詛咒】</span>媒介發出低語——全隊最大 HP −' + (act.curse * 5) + '%（打倒詛咒的媒介才能解除）。'); } }
      if (!meds.length && t >= act.mediumAt) { act.mediumAt = t + 1200; var n = placeMinions('senis', act.L); if (n) clog('<span class="font-bold" style="color:#93c5fd">【詛咒的媒介】</span>賽尼斯又召喚了 ' + n + ' 個詛咒的媒介。'); }
      if (t >= act.freezeAt) { act.freezeAt = t + 300; var ks = targets('senis', true); if (ks.length) { var k = ks[Math.floor(Math.random() * ks.length)]; freeze(b, k, '誓約的冰封'); clog('<span class="font-bold" style="color:#93c5fd">【誓約的冰封】</span>賽尼斯指向 ' + nameOf(k) + '——冰封 3 秒。'); } }
    } else if (id === 'slayer') {
      if (!act.fled && frac <= 0.5) {
        act.fled = true; act.hpFrac = frac;
        onField().forEach(function (x) { mapState.mobs[x[1]] = null; });
        try { if (!S().ff) renderMobs(); } catch (e) {}
        clog('<span class="font-bold" style="color:#c4b5fd">【遁走】</span>史雷佛化成一道黑影消失了——換一張地圖，他會再追上來。');
        return;
      }
      if (t >= act.stealthAt && !(b._weStealth > t)) { act.stealthAt = t + 300; b._weStealth = t + 50; clog('<span class="font-bold" style="color:#c4b5fd">【隱身】</span>史雷佛融進了陰影——5 秒內打不到他，接下來的第一擊會很痛。'); }
      if (b._weStealth && t >= b._weStealth) { b._weStealth = 0; act.ambush = true; }
    } else if (id === 'dragon') {
      if (t >= act.callAt) { act.callAt = t + 200; act.callUntil = t + 50; clog('<span class="font-bold" style="color:#fdba74">【獵龍號令】</span>隊長吹響號角——5 秒內獵龍隊對龍騎士的傷害 +50%！'); }
    } else if (id === 'winter') {
      var maids = onField('Maid'), lvl = maids.length ? 2 : 1;
      if (act.chill !== lvl) { var was = act.chill; act.chill = lvl; curseApply(); if (was === 2 && lvl === 1) clog('<span class="font-bold" style="color:#86efac">【寒冬】</span>侍女倒下了，風雪變小了一些（攻擊速度 −20%、凍傷 2%）。', 'player'); }
      if (t >= act.frostAt) {
        act.frostAt = t + 100;
        party().forEach(function (m) { if (!m || m.dead || m._downed) return; var mx = m === P() ? (m.mhp || 1) : (m.mhp || m.curHp || 1); L.boss.hurt(m, mx * 0.02 * lvl); });
        if (t % 300 < 100) clog('<span class="font-bold" style="color:#7dd3fc">【凍傷】</span>寒風割過皮膚——全隊受到最大 HP ' + (2 * lvl) + '% 的傷害。');
      }
      if (t >= act.freezeAt) { act.freezeAt = t + 300; var all = targets('winter', true); if (all.length) { var k2 = all[Math.floor(Math.random() * all.length)]; freeze(b, k2, '女王的冰封'); clog('<span class="font-bold" style="color:#7dd3fc">【女王的冰封】</span>冰之女王指向 ' + nameOf(k2) + '——冰封 3 秒。'); } }
      if (!maids.length && t >= act.maidAt) { act.maidAt = t + 1200; var n2 = placeMinions('winter', act.L); if (n2) clog('<span class="font-bold" style="color:#7dd3fc">【寒冬】</span>冰之女王又喚來了 ' + n2 + ' 名侍女——風雪變大了。'); }
      else if (maids.length) act.maidAt = Math.max(act.maidAt, t + 1200);
    } else if (id === 'kenn') {
      if (act.mark && t >= act.mark.end) {
        var mk2 = act.mark; act.mark = null; var p = P();
        if (mk2.hp0 - b.curHp >= b.hp * 0.05) clog('<span class="font-bold" style="color:#86efac">【懸賞令】</span>猛攻逼退了刺客頭目——懸賞令被打斷！', 'player');
        else if (p && !p.dead) { clog('<span class="font-bold" style="color:#ef4444">【懸賞令】</span>刺客頭目的刀落下——你受到重創！'); L.boss.hurt(p, (p.mhp || 1) * 0.3); }
      } else if (!act.mark && t >= act.markAt) {
        act.markAt = t + 450; act.mark = { end: t + 50, hp0: b.curHp };
        clog('<span class="font-bold" style="color:#ef4444">【懸賞令】</span>刺客頭目盯上了城主：「你的頭值一座城。」（5 秒內打掉他 5% HP 可以打斷）');
      }
    }
  };
  // 詛咒：最大 HP（玩家走最大值掛點；傭兵直接壓住目前 HP）
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) {
    if (act && act.id === 'senis' && act.curse > 0) p.mhp = Math.max(1, Math.round((p.mhp || 0) * (1 - 0.05 * act.curse)));
    // 寒冬：攻擊間隔 ÷0.8（−20%）／÷0.6（侍女活著，−40%）
    if (act && act.id === 'winter' && act.chill > 0 && p.d) { var f = 1 / chillMult(); if (p.d.aspd > 0) p.d.aspd *= f; if (p.d.aspdOff > 0) p.d.aspdOff *= f; }
  });
  var step = function () {
    var p = P(); if (!p || !act) return;
    if (!targets(act.id, true).length) { end('fail'); return; }
    var cur = mapState.current;
    if (!okMap(cur)) { badge(); return; }
    act.left--;
    if (act.left <= 0) { end('time'); return; }
    if (act.id === 'senis' && act.curse > 0) { var f2 = 1 - 0.05 * act.curse; (p.allies || []).forEach(function (a) { if (a && !a._downed && a.mhp && a.curHp > a.mhp * f2) a.curHp = Math.floor(a.mhp * f2); }); }
    var b = onField('boss')[0];
    if (b) { act.hpFrac = b[0].curHp / Math.max(1, b[0].hp); act.map = cur; skills(b[0]); }
    else if (act.map !== cur) { act.map = cur; act.wait = tk() + rint(200, 400); sys('<span style="color:' + EV[act.id].color + '">' + EV[act.id].badge.split(' ')[0] + ' 他們正在追過來……</span>'); }
    else if (act.wait && tk() >= act.wait) {
      act.wait = 0; act.fled = act.id === 'slayer' ? act.fled : false;
      var nb = placeGroup(levelFor(cur), act.hpFrac);
      if (nb) { act.L = nb._weL; act.ambush = true; clog('<span class="font-bold" style="color:' + EV[act.id].color + '">' + EV[act.id].badge.split(' ')[0] + ' 追上來了！</span>'); }
    }
    if (tk() % 10 === 0) badge();
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var t0 = tk(), r = oTick.apply(this, arguments); if (tk() !== t0) { try { step(); } catch (e) { console.warn('[AFK-world-events] tick', e); } } return r; };
  }
  // 70% 優先攻擊被追殺的人
  if (typeof W.enemyAttackChooseVictim === 'function') {
    var oChoose = W.enemyAttackChooseVictim;
    W.enemyAttackChooseVictim = function (mob, idx) {
      try {
        if (mob && mob._afkWe && act && mob._afkWe === act.id && !mob._weMedium && Math.random() < 0.7) {
          var ts = targets(act.id, true);
          if (ts.length) {
            var t = ts[Math.floor(Math.random() * ts.length)];
            try { if (typeof playMobAttack === 'function') playMobAttack(mob); } catch (e) {}
            if (t === P()) { enemyPhysicalAttack(mob, idx, 0, null, null, true); return; }
            enemyAttackAlly(mob, t, true); return;
          }
        }
      } catch (e) {}
      return oChoose.apply(this, arguments);
    };
  }
  // 受到的傷害：偷襲 ×2.5（史雷佛）、獵龍號令（對龍騎士 ×1.5）
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) {
    if (!mob || !mob._afkWe || !act || mob._afkWe !== act.id || !ent) return 1;
    if (act.id === 'slayer' && mob._weBoss && act.ambush) { act.ambush = false; return 2.5; }
    if (act.id === 'dragon' && ent.cls === 'dragon' && tk() < (act.callUntil || 0)) return 1.5;
    return 1;
  });
  // 打出去的傷害：史雷佛隱身＝0、獵龍隊長活著時隊員 −80%
  var mod = function (target, v) {
    if (!target || !target._afkWe || !act || target._afkWe !== act.id) return v;
    if (act.id === 'slayer' && target._weBoss && target._weStealth > tk()) return 0;
    if (act.id === 'dragon' && target._weMinion && onField('boss').length) return v * 0.2;
    return v;
  };
  var hooked = false;
  var hookDmg = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return; hooked = true;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var v = o.apply(this, arguments);
      try {
        if (v > 0 && target && target._afkWe) { var w = mod(target, v); if (w !== v) v = Math.floor(w); }
        if (v > 0 && actor && act && act.id === 'winter' && act.chill > 0 && actor !== P() && !actor._afkWe && target && !target.cls) { var w2 = Math.floor(v * chillMult()); if (w2 !== v) v = w2; }   // 寒冬：傭兵、寵物、召喚物打怪 −20%／−40%
      } catch (e) {}
      return v;
    };
  };
  hookDmg(); W.addEventListener('load', hookDmg);
  // 擊殺
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState.mobs ? mapState.mobs[idx] : null, r = oKill.apply(this, arguments);
      try {
        if (m && m._dead && m._weBoss && !m._wePaid && act && m._afkWe === act.id) {
          m._wePaid = true;
          var got = [];
          gainItem(BAG, 1, true, true); got.push(DB.items[BAG].n);
          if (act.id === 'kenn') { var g = (m._weL || 30) * 2000, p = P(); p.gold = (Number(p.gold) || 0) + g; got.push('懸賞金 ' + g.toLocaleString() + ' 金幣'); }
          sys('<span class="text-amber-300">' + esc(m.n) + ' 留下了：' + got.join('、') + '</span>');
          end('kill');
        }
      } catch (e) { console.warn('[AFK-world-events] kill', e); }
      return r;
    };
  }

  W.__afkWorldEvents = { EV: EV, IDS: IDS, RATE: RATE, CD_MS: CD_MS, GAP_MS: GAP_MS, DUR: DUR, LV_MIN: LV_MIN, BAG: BAG,
    active: function () { return act; }, start: function (id) { var i = freeSlot(true); if (i < 0) return false; start(id, i); return true; }, end: end, step: step,
    canTrigger: canTrigger, targets: targets, okMap: okMap, levelFor: levelFor, stats: stat, openBag: openBag, mod: mod, chillMult: chillMult, scale: scale };
})();
