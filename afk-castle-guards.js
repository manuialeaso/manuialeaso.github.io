/* ==========================================================================
 * afk-castle-guards.js — 七城護衛與亞丁「聖十字近衛」（玩家 2026-10-24 指定）
 *
 * 1. 持有幾座城就能招幾座城的部隊：原本只認「主城」（最近打下的那座），現在改認血盟持有的全部城堡
 *    （afk-castlewar 的 held 清單）。任一座城的護衛隊長都能切換到其他持有城的部隊來招募。
 * 2. 四座新城各有自己的部隊（借用現有八方向圖）：
 *      奇岩城＝黃金之鷹（黃金龍圖）｜妖魔堡＝妖魔傭兵（妖魔巡守圖）｜侏儒城＝鐵斧護衛（巨大牛人圖）｜亞丁城＝亞丁白虎衛（真‧虎男圖）
 * 3. 統一七城後，亞丁城可招「聖十字近衛」：能力＝七支部隊相加（HP、DPS、AC、魔防、減傷相加，命中取最高），
 *    另有 5% 迴避、5% 魔法抗性；不受盟主魅力限制，最多 8 名。
 *    一次招滿 8 名可「融合」成一名融合體：HP、傷害、減傷、抗性、AC、魔防、迴避直接 ×8，
 *    碰到上限為止（魔防 1000、AC −200、迴避 80%、抗性 90%）。
 * 4. 城池會一直留在手上，所以「宣戰其他城堡」不再遣散護衛；只有失去該部隊所屬的城才會失效。
 * 只覆寫 js/31 的全域函式，不動核心檔。
 * ========================================================================== */
(function () {
  'use strict';
  if (typeof CASTLE_GUARD_BOOK === 'undefined' || typeof window.castleGuardSync !== 'function' || typeof window.guardDerive !== 'function') { console.warn('[AFK-castle-guards] 找不到城堡護衛系統，略過'); return; }

  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var CW = function () { return window.__afkCastleWar || null; };
  var held = function () {
    try { var c = CW(); if (c && c.held) return c.held(); } catch (e) {}
    var m = null; try { m = clanGetCastleCity(P()); } catch (e) {}
    return m ? [m] : [];
  };
  var unified = function () { return held().length >= 7; };
  var ELITE_MAX = 8, FUSE_N = 8;
  var CAP = { mr: 1000, ac: -200, eva: 0.80, res: 0.90 };
  var BASE_KEYS = ['kent', 'windwood', 'heine', 'giran', 'orc_fortress', 'dwarf_castle', 'aden'];

  // ── 部隊規格 ──
  var orig = { kent: 1, windwood: 1, heine: 1 };
  CASTLE_GUARD_BOOK.kent.gfx = '藍色鯊魚'; CASTLE_GUARD_BOOK.windwood.gfx = '暴風之刃'; CASTLE_GUARD_BOOK.heine.gfx = '毒蛇之牙';
  CASTLE_GUARD_BOOK.kent.captain = '肯特守衛隊長'; CASTLE_GUARD_BOOK.windwood.captain = '風木傭兵隊長'; CASTLE_GUARD_BOOK.heine.captain = '海音神官隊長';
  Object.assign(CASTLE_GUARD_BOOK, {
    giran: { form: '黃金之鷹', gfx: '黃金龍', city: 'giran', label: '奇岩', captain: '奇岩騎士團長',
      hpPerLv: 11, dpsRatio: 0.65, aspdSec: 0.6, hitBonus: 36, acBase: -12, acLvDiv: 4, mrBase: 20, mrLvDiv: 3, aggroWeight: 3, threat: 2,
      d: '奇岩騎士團長麾下的黃金之鷹：振翼掠過戰場的游擊手，出手精準、命中最高。' },
    orc_fortress: { form: '妖魔傭兵', gfx: '妖魔巡守', city: 'orc_fortress', label: '妖魔堡', captain: '妖魔堡督軍',
      hpPerLv: 18, dpsRatio: 0.45, aspdSec: 1.1, hitBonus: 28, acBase: -8, acLvDiv: 4, mrBase: 10, mrLvDiv: 5, aggroWeight: 6, threat: 6,
      d: '妖魔堡督軍以金幣買來的妖魔傭兵：皮糙肉厚、最會吸引仇恨的肉盾。' },
    dwarf_castle: { form: '鐵斧護衛', gfx: '巨大牛人', city: 'dwarf_castle', label: '侏儒城', captain: '侏儒城鐵衛長',
      hpPerLv: 15, dpsRatio: 0.55, aspdSec: 0.9, hitBonus: 30, acBase: -18, acLvDiv: 3, mrBase: 12, mrLvDiv: 4, aggroWeight: 5, threat: 4,
      d: '侏儒城鐵衛長親手鍛造重甲的鐵斧護衛：AC 最硬的重裝前排。' },
    aden: { form: '亞丁白虎衛', gfx: '真‧虎男', city: 'aden', label: '亞丁', captain: '亞丁禁衛長',
      hpPerLv: 14, dpsRatio: 0.65, aspdSec: 0.8, hitBonus: 34, acBase: -14, acLvDiv: 4, mrBase: 25, mrLvDiv: 3, aggroWeight: 4, threat: 3,
      d: '亞丁禁衛長豢養的白虎衛：王都的精銳，攻守與魔防都屬上乘。' },
    aden_elite: { form: '聖十字近衛', gfx: '毒蛇之牙', city: 'aden_elite', home: 'aden', label: '亞丁', captain: '亞丁禁衛長', elite: true,
      hpPerLv: 0, dpsRatio: 0, aspdSec: 0.5, hitBonus: 0, acBase: 0, acLvDiv: 4, mrBase: 0, mrLvDiv: 4, aggroWeight: 6, threat: 6,
      d: '七城旗幟同時升起之日，亞丁王座下的聖十字近衛才肯向一位君主屈膝。七支部隊的武藝集於一身。' },
    aden_fused: { form: '聖十字近衛·融合', gfx: '毒蛇之牙', city: 'aden_elite', home: 'aden', label: '亞丁', captain: '亞丁禁衛長', elite: true, fused: true,
      hpPerLv: 0, dpsRatio: 0, aspdSec: 0.5, hitBonus: 0, acBase: 0, acLvDiv: 4, mrBase: 0, mrLvDiv: 4, aggroWeight: 10, threat: 10,
      d: '八名近衛以聖十字之誓合為一體，八人的血肉與鋼鐵，凝成一具不倒的身軀。' }
  });
  BASE_KEYS.forEach(function (k) { CASTLE_GUARD_BOOK.aden_elite.hpPerLv += CASTLE_GUARD_BOOK[k].hpPerLv; });
  CASTLE_GUARD_BOOK.aden_fused.hpPerLv = CASTLE_GUARD_BOOK.aden_elite.hpPerLv * FUSE_N;

  var specOfRoster = function (r) {
    if (!r) return null;
    if (r.city === 'aden_elite') return r.fused ? CASTLE_GUARD_BOOK.aden_fused : CASTLE_GUARD_BOOK.aden_elite;
    return CASTLE_GUARD_BOOK[r.city] || null;
  };
  var homeOf = function (spec) { return spec.home || spec.city; };

  // ── 數值：近衛＝七支部隊相加；融合體再 ×8（碰上限為止）──
  var oDerive = window.guardDerive;
  var eliteDerive = function (lv, fused) {
    var dps = 0, ac = 0, mr = 0, dr = 0, hit = 0;
    BASE_KEYS.forEach(function (k) {
      var sp = CASTLE_GUARD_BOOK[k], d = oDerive({ form: sp.form, lv: lv });
      dps += (d.flat + (d.dice + 1) / 2) / sp.aspdSec;
      ac += d.ac; mr += d.mr; dr += d.dr; hit = Math.max(hit, d.hit);
    });
    var m = fused ? FUSE_N : 1, perHit = dps * 0.5 * m;
    var flat = Math.max(0, Math.round(perHit * 0.55)), dice = Math.max(1, Math.round((perHit - flat) * 2));
    return {
      flat: flat, dice: dice, aspd: 5, hit: hit,
      ac: Math.max(CAP.ac, ac * m), dr: dr * m, mr: Math.min(CAP.mr, mr * m),
      eva: Math.min(CAP.eva, 0.05 * m), res: Math.min(CAP.res, 0.05 * m),
      aggroWeight: fused ? 10 : 6
    };
  };
  window.guardDerive = function (g) {
    var sp = g && _guardSpecForForm(g.form);
    if (sp && sp.elite) return eliteDerive(Math.max(1, g.lv || 1), !!sp.fused);
    return oDerive.apply(this, arguments);
  };
  var hpOf = function (spec, lv) { return spec.hpPerLv * Math.max(1, lv); };

  // ── 名冊：持有該部隊所屬的城就有效 ──
  window.castleGuardRosterActive = function () {
    var p = P(); if (!p) return null;
    var info = (typeof clanGetModeInfo === 'function') ? clanGetModeInfo(p) : null;
    if (!info || !info.guards) return null;
    var spec = specOfRoster(info.guards); if (!spec) return null;
    if (held().indexOf(homeOf(spec)) < 0) return null;
    if (spec.elite && !unified()) return null;
    return info.guards;
  };
  var followOf = function (r) {
    if (!r) return 0;
    var spec = specOfRoster(r); if (!spec) return 0;
    if (spec.elite) return r.fused ? 1 : Math.max(0, Math.min(ELITE_MAX, r.count || 0));
    return Math.max(0, Math.min(r.count || 0, castleGuardCapacity()));
  };
  window.castleGuardFollowCount = function () { return followOf(castleGuardRosterActive()); };

  window.castleGuardSync = function (force) {
    var p = P(); if (!p) return;
    var r = castleGuardRosterActive(), spec = specOfRoster(r), want = followOf(r);
    if (!p.guardsV2) p.guardsV2 = [];
    var list = p.guardsV2;
    if (!want || !spec) { if (list.length) { p.guardsV2 = []; if (force) renderGuardPanel(true); } return; }
    if (list.length && list[0].form !== spec.form) { p.guardsV2 = []; list = p.guardsV2; }
    var lvNow = Math.max(1, p.lv || 1);
    list.forEach(function (s) { s.lv = lvNow; s.formGfx = spec.gfx; });
    if (list.length < want) {
      var pre = spec.fused ? 'adenfu_' : (spec.elite ? 'adenel_' : '');
      for (var i = list.length; i < want; i++) { var mhp = hpOf(spec, lvNow); list.push({ uid: pre + uid(), form: spec.form, formGfx: spec.gfx, city: spec.city, lv: lvNow, hp: mhp, mhp: mhp, _atkCd: 5 + i * 3 }); }
      if (force) renderGuardPanel(true);
    } else if (list.length > want) { p.guardsV2 = list.slice(0, want); if (force) renderGuardPanel(true); }
    p.guardsV2.forEach(function (s) { var mx = hpOf(spec, s.lv); if (s.mhp !== mx) { var ratio = s.mhp ? s.hp / s.mhp : 1; s.mhp = mx; if (!s._downed) s.hp = Math.max(1, Math.round(mx * ratio)); } });
  };

  // 宣戰其他城堡不再遣散（城池會留著）
  window.castleGuardsOnSiegeDeclared = function () {};

  // ── 迴避／抗性（只有近衛有）──
  var oEnemyAtk = window.enemyAttackGuard;
  if (typeof oEnemyAtk === 'function') window.enemyAttackGuard = function (mob, s) {
    try {
      var d = s && !s._downed && guardDerive(s);
      if (d && d.eva && mob && mob.curHp > 0 && Math.random() < d.eva) {
        if (typeof _mobAnimTrigger === 'function') _mobAnimTrigger(mob, 'attack');
        logCombat('<span class="' + getMobColor(mob.lv) + '">' + mob.n + '</span> 的攻擊被 <span class="text-amber-300">' + s.form + '</span> 以聖十字盾架開了。', 'miss', 'enemy');
        return;
      }
    } catch (e) {}
    return oEnemyAtk.apply(this, arguments);
  };
  var oMobMagic = window.applyMobMagicToGuard;
  if (typeof oMobMagic === 'function') window.applyMobMagicToGuard = function (mob, sk, s) {
    var d = null; try { d = s && guardDerive(s); } catch (e) {}
    if (!d || !d.res) return oMobMagic.apply(this, arguments);
    var had = Object.prototype.hasOwnProperty.call(window, 'teamDmgReduceMult'), t = window.teamDmgReduceMult;
    window.teamDmgReduceMult = function () { return (typeof t === 'function' ? t.apply(this, arguments) : 1) * (1 - d.res); };
    try { return oMobMagic.apply(this, arguments); } finally { if (had) window.teamDmgReduceMult = t; else delete window.teamDmgReduceMult; }
  };

  // ── 招募 ──
  var writeRoster = function (fn) {
    if (typeof _clanWithLock !== 'function') return { ok: false, error: '血盟系統未就緒。' };
    var mode = (typeof clanModeKey === 'function') ? clanModeKey(P()) : 'normal';
    return _clanWithLock(function (st) { var info = st.modes[mode]; if (!info) return { commit: false, error: '你尚未加入血盟。' }; return fn(info) || {}; });
  };
  var red = function (t) { logSys('<span class="text-red-400">' + t + '</span>'); };
  var refresh = function (key) { try { saveGame(); } catch (e) {} castleGuardSync(true); try { updateUI(); } catch (e) {} var el = document.getElementById('interaction-content'); if (el && el.dataset.afkGuard) renderCastleGuard(el, key); };
  var canHire = function (spec) {
    if (!held().length) { red('攻城獲勝（擁有城堡）期間才能招募城堡護衛。'); return false; }
    if (held().indexOf(homeOf(spec)) < 0) { red('你的血盟並未持有' + spec.label + '城，無法招募' + spec.form + '。'); return false; }
    if (spec.elite && !unified()) { red('聖十字近衛只向統一七城的君主效忠。'); return false; }
    return true;
  };
  window.hireCastleGuard = function (key, n) {
    var spec = CASTLE_GUARD_BOOK[key]; var p = P();
    if (!spec || !p || spec.fused || !canHire(spec)) return;
    var cap = spec.elite ? ELITE_MAX : castleGuardCapacity();
    if (cap <= 0) { red('盟主魅力不足（需魅力 15 以上才能攜帶 1 名護衛）。'); return; }
    var cur = castleGuardRosterActive();
    var curCount = (cur && cur.city === spec.city && !cur.fused) ? (cur.count || 0) : 0;
    n = Math.max(1, Math.min(n || 1, cap - curCount));
    if (curCount >= cap) { logSys('<span class="text-amber-300">已達可攜帶上限（' + cap + ' 名）。</span>'); return; }
    var cost = CASTLE_GUARD_COST * n;
    if ((p.gold || 0) < cost) { red('金幣不足，招募 ' + n + ' 名' + spec.form + '需要 ' + cost.toLocaleString() + ' 金幣。'); return; }
    var res = writeRoster(function (info) {
      var g = info.guards && info.guards.city === spec.city && !info.guards.fused ? info.guards : null;
      var c = g ? (g.count || 0) : 0;
      if (c + n > cap) return { commit: false, error: 'full' };
      info.guards = { city: spec.city, count: c + n, hiredAt: (g && g.hiredAt) || Date.now() };
      return { count: info.guards.count };
    });
    if (!res.ok) { if (res.error && res.error !== 'full') red(res.error); return; }
    p.gold -= cost;
    logSys('<span class="text-emerald-300 font-bold">' + spec.captain + '派出了 ' + n + ' 名' + spec.form + '（現有 ' + res.count + ' 名·' + spec.label + '）。</span>同盟同模式的角色都將獲得其跟隨。');
    refresh(key);
  };
  // 一口氣招滿 8 名近衛並融合（已招的近衛也算數，只補差額）
  window.fuseAdenGuards = function () {
    var spec = CASTLE_GUARD_BOOK.aden_elite, p = P();
    if (!p || !canHire(spec)) return;
    var cur = castleGuardRosterActive();
    if (cur && cur.city === 'aden_elite' && cur.fused) { logSys('<span class="text-amber-300">近衛已經融合。</span>'); return; }
    var have = (cur && cur.city === 'aden_elite') ? (cur.count || 0) : 0;
    var need = FUSE_N - have, cost = CASTLE_GUARD_COST * Math.max(0, need);
    if ((p.gold || 0) < cost) { red('金幣不足，補滿 8 名近衛還需要 ' + cost.toLocaleString() + ' 金幣。'); return; }
    var res = writeRoster(function (info) { info.guards = { city: 'aden_elite', count: FUSE_N, fused: true, hiredAt: Date.now() }; return {}; });
    if (!res.ok) { if (res.error) red(res.error); return; }
    p.gold -= cost; p.guardsV2 = [];
    logSys('<span class="text-amber-300 font-bold">八名聖十字近衛舉劍立誓，身影在聖光中重疊——融合體誕生了。</span>');
    refresh('aden_elite');
  };
  window.disbandCastleGuards = function (key) {
    var res = writeRoster(function (info) { if (!info.guards) return { commit: false }; info.guards = null; return {}; });
    if (res.ok) logSys('<span class="text-slate-300">已遣散城堡護衛。</span>');
    var p = P(); if (p) p.guardsV2 = [];
    refresh(key);
  };

  // ── 招募視窗：可切換到任何持有城的部隊 ──
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  window.renderCastleGuard = function (div, key) {
    if (!div) return;
    if (typeof _activePanel !== 'undefined') _activePanel = null;
    var spec = CASTLE_GUARD_BOOK[key]; if (!spec || spec.fused) spec = CASTLE_GUARD_BOOK[key = 'aden_elite'];
    div.dataset.afkGuard = key;
    var p = P(), h = held(), uni = h.length >= 7;
    var tabs = BASE_KEYS.concat(['aden_elite']).map(function (k) {
      var sp = CASTLE_GUARD_BOOK[k], own = sp.elite ? uni : h.indexOf(k) >= 0;
      var on = k === key;
      return '<button onclick="renderCastleGuard(document.getElementById(\'interaction-content\'),\'' + k + '\')" class="btn px-2 py-1 text-xs ' + (on ? 'bg-amber-800 border-amber-500 text-amber-100' : own ? '' : 'opacity-50') + '" title="' + (own ? '可招募' : (sp.elite ? '需統一七城' : '未持有此城')) + '">' + (sp.elite ? '✠ 近衛' : sp.label) + '</button>';
    }).join('');
    var r = castleGuardRosterActive(), rs = specOfRoster(r);
    var lv = Math.max(1, (p && p.lv) || 1);
    var d = guardDerive({ form: spec.form, lv: lv });
    var line = function (sp, dd) {
      return 'Lv.' + lv + '　HP ' + hpOf(sp, lv).toLocaleString() + '　攻 1D' + dd.dice + '+' + dd.flat + '／' + (dd.aspd / 10) + 's　AC ' + dd.ac + '　魔防 ' + dd.mr + '　減傷 ' + dd.dr
        + (dd.eva ? '　迴避 ' + Math.round(dd.eva * 100) + '%　抗性 ' + Math.round(dd.res * 100) + '%' : '');
    };
    var html = '<div class="flex flex-col gap-2 p-1">'
      + '<div class="flex flex-wrap gap-1">' + tabs + '</div>'
      + '<div class="afk-lore">' + esc(spec.d) + '</div>'
      + '<div class="text-slate-300 text-xs">' + line(spec, d) + '</div>';
    if (spec.elite) {
      var f = CASTLE_GUARD_BOOK.aden_fused, fd = guardDerive({ form: f.form, lv: lv });
      html += '<div class="text-amber-200 text-xs">融合體：' + line(f, fd) + '</div>'
        + '<div class="text-slate-400 text-xs">能力＝七城部隊相加；不受盟主魅力限制，最多 ' + ELITE_MAX + ' 名。招滿 8 名可融合成一名，HP、傷害、減傷、抗性、AC、魔防、迴避 ×8（上限：魔防 1000、AC −200、迴避 80%、抗性 90%）。</div>';
    } else {
      html += '<div class="text-slate-400 text-xs">死亡 30 秒自動歸隊（不耗卷軸）。可攜帶＝盟主魅力 ÷ 15（最多 ' + CASTLE_GUARD_MAX + ' 名·目前 ' + castleGuardCapacity() + ' 名）；每名 ' + (CASTLE_GUARD_COST / 10000) + ' 萬金幣。</div>';
    }
    if (rs) html += '<div class="bg-slate-800/70 border border-cyan-700 rounded p-2 text-sm flex items-center justify-between gap-2"><span class="text-cyan-300 font-bold">目前部隊：' + rs.form + (rs.fused ? '' : ' ×' + followOf(r)) + '（' + rs.label + '）</span>'
      + '<button onclick="disbandCastleGuards(\'' + key + '\')" class="btn px-3 py-1 text-xs bg-red-900 hover:bg-red-800 border-red-600 text-red-200 font-bold">遣散全部</button></div>';
    var ok = spec.elite ? uni : h.indexOf(key) >= 0;
    if (!ok) {
      html += '<div class="bg-slate-800/70 border border-slate-600 rounded p-3 text-sm text-amber-300">' + (spec.elite ? '統一七座城堡後，亞丁禁衛長才會交出聖十字近衛的指揮權（目前 ' + h.length + '/7）。' : '血盟持有【' + spec.label + '城】時才能招募此部隊。') + '</div>';
    } else {
      var same = r && r.city === spec.city;
      var cap = spec.elite ? ELITE_MAX : castleGuardCapacity();
      var cnt = same && !r.fused ? (r.count || 0) : (same && r.fused ? ELITE_MAX : 0);
      var gold = (p && p.gold) || 0;
      var dis = cap <= 0 || cnt >= cap || gold < CASTLE_GUARD_COST;
      var lab = cap <= 0 ? '盟主魅力不足' : cnt >= cap ? '已達上限（' + cap + '）' : gold < CASTLE_GUARD_COST ? '金幣不足' : '招募 1 名（' + (CASTLE_GUARD_COST / 10000) + ' 萬金幣）';
      var btn = function (on, cls, click, text) { return '<button ' + (on ? '' : 'disabled') + ' onclick="' + click + '" class="btn w-full py-2 text-sm font-bold ' + (on ? cls : 'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed') + '">' + text + '</button>'; };
      if (r && !same) html += '<div class="text-amber-300 text-xs">招募' + spec.form + '會取代目前的' + rs.form + '。</div>';
      html += btn(!dis, 'bg-emerald-800 hover:bg-emerald-700 border-emerald-600 text-emerald-100', "hireCastleGuard('" + key + "',1)", lab);
      if (spec.elite) {
        var need = FUSE_N - (same && !r.fused ? cnt : (same ? FUSE_N : 0)), fc = need * CASTLE_GUARD_COST;
        var fused = same && r.fused;
        html += btn(!fused && gold >= fc, 'bg-amber-800 hover:bg-amber-700 border-amber-500 text-amber-100', 'fuseAdenGuards()', fused ? '已融合' : '一口氣招滿 8 名並融合（' + (fc / 10000) + ' 萬金幣）');
      }
    }
    div.innerHTML = html + '</div>';
  };

  // ── 四座新城的護衛隊長 NPC ──
  var NPC = { npc_giran_guard: 'giran', npc_orc_fortress_guard: 'orc_fortress', npc_dwarf_castle_guard: 'dwarf_castle', npc_aden_guard: 'aden' };
  try {
    Object.keys(NPC).forEach(function (id) {
      var k = NPC[id], sp = CASTLE_GUARD_BOOK[k], town = DB.towns['town_' + k + '_castle'];
      if (!town || town.npcs.some(function (n) { return n.id === id; })) return;
      town.npcs.splice(2, 0, { id: id, n: sp.captain, title: '城堡護衛', type: 'castleguard', d: sp.d + (k === 'aden' ? '統一七城之後，他也替你召集聖十字近衛。' : '') });
    });
  } catch (e) {}
  if (typeof window.interactNPC === 'function') {
    var oNpc = window.interactNPC;
    window.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      if (NPC[npcId]) { try { renderCastleGuard(document.getElementById('interaction-content'), NPC[npcId] === 'aden' && unified() ? 'aden_elite' : NPC[npcId]); } catch (e) {} }
      return r;
    };
  }

  // ── 近衛外觀：金白聖光；融合體放大 ──
  try {
    var st = document.createElement('style'); st.id = 'afk-castle-guards-css';
    st.textContent = '[data-pet^="adenel_"] .pet-body,[data-pet^="adenfu_"] .pet-body{filter:sepia(.55) saturate(2) hue-rotate(-10deg) brightness(1.18) drop-shadow(0 0 3px rgba(255,214,130,.85))}'
      + '[data-pet^="adenfu_"]{transform:translate(-50%,-100%) scale(1.45)!important;transform-origin:50% 100%}';
    document.head.appendChild(st);
  } catch (e) {}

  window.__afkCastleGuards = { held: held, unified: unified, specOfRoster: specOfRoster, eliteDerive: eliteDerive, followOf: followOf, CAP: CAP };
  try { castleGuardSync(true); } catch (e) {}
  console.log('[AFK-castle-guards] 已啟用：七城護衛、聖十字近衛與融合');
})();
