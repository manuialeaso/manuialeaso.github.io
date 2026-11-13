/* ============================================================================
 * afk-dimrift.js — 次元裂縫（夢域鏡再往上一階的世界模式；設計稿 dimension-rift-design、rift-zodiac-plan、decisions-1107）
 *
 *   開放：二轉，而且打贏終焉第三階層。席琳神殿向席琳祈禱「踏進次元裂縫／退回夢域」（只能在村莊；免費）。
 *     裂縫疊在夢域鏡上：開啟時瘋狂席琳、夢域鏡一併保持開啟，夢域鏡的規則照套，再加下面的規則。
 *   地圖侵蝕（村莊以外的地圖）：每秒最大 HP 5%（真實傷害），扣血減免直接相減，超過 5% 的部分變回血；剩下的再乘百分比減免（負重、遠征刻印石）。
 *     AC 每秒 +5、魔防每秒 −5，最多 300；火水風地抗性每秒各 −5，最多 −500（GD之子的期待：每秒 ×2）；最低保留＝各來源相加（最多 325），或負重減免換算的比例，取高的。回村全部清除。
 *   光蝕：場上有頭目時每 30 秒全隊 +1 層（最多 20），每層最大 HP −1%、受到的治療 −2%；相消術卷軸清除（王不在場、≥10 層自動用）；回村、換地圖、倒下都不清。
 *     王的斬殺線：頭目在場時每 30 秒，HP 低於 10% 的隊員直接倒下。
 *   怪物：HP 再 ×1.5、傷害 ×1.3、命中 ×4/3（夢域鏡 ×3 → ×4）；頭目每秒多回 0.1%（合計 0.2%）；經驗 ×1.2。
 *   面板：近遠魔的傷害、命中、爆擊傷害、傷害減免、魔防、五屬性抗性、AC、最大 HP／MP 壓到 50%；取回力量最多 40%（最高 90%；GD之子的期待裡最多 75%）。負重 −5,000，每取回 5% 再 −500。
 *   造成的傷害 −30%（聖衣 EX、雅典娜的祝福、次元支配 之後抵銷）。
 *   掉落：龍之鑽石多 0.1%（合計 0.2%）、裂縫碎光、次元結晶、次元密奧卡、破碎星光塵埃、分裂的蔑視塵埃、星辰之核。
 *   window.__afkDimRiftOn() 回傳是否開著裂縫（afk-riftsupply、afk-mio、afk-goddess3 看這個）。
 *   還沒做（TODO）：副本、遠征新位階、聖衣碎裂／EX、次元支配、離線規則、裂縫裡的抗性上限 2000／1000、倒下上限分級、傭兵的面板減半。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'dimrift', name: '次元裂縫', group: '遊戲內容', seal: true, desc: '夢域鏡再往上一階的世界模式（二轉＋打贏終焉第三階層；席琳神殿切換）' });
  if (T && !T.enabled('dimrift')) return;
  if (typeof DB === 'undefined') return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var clog = function (h, c) { try { if (typeof logCombat === 'function' && !S().ff) logCombat(h, c || 'enemy'); } catch (e) {} };

  // ── 數值 ──
  var CARRY = { from: 3000, per: 1.5 };   // 負重前行：裂縫裡剩下的負重上限超過 3,000，每 1,000 造成的傷害 +1.5%
  var R = {
    hpPct: 5, acMax: 300, resMax: 500, eroStep: 5,   // 11-07 18:28：AC、魔防侵蝕上限 −500 → −300（火水風地抗性維持 −500）
    floorMax: 325,
    lightEvery: 300, lightMax: 20, lightHp: 1, lightHeal: 2, execPct: 10,
    mobHp: 1.5, mobDmg: 1.3, mobHit: 4 / 3, bossDmg: 1.3, bossHit: 4 / 3, bossRegen: 0.001, exp: 1.2, dmgOut: 0.7,
    weight: 5000, weightStep: 500
  };
  var REDUCE = [   // 扣血減免（每秒少扣的 %）
    ['織星者', 0.5, function (p) { return !!(p.afkStarWeaver || (p.titles && p.titles.indexOf && p.titles.indexOf('織星者') >= 0)); }],
    ['縫隙的守望者（二轉）', 0.5, function (p) { return Math.floor(p.rebirth || 0) >= 2; }],
    ['守護者之戒上半部', 0.5, function (p) { return guardAll(p, 3); }],
    ['庇護者之戒', 0.5, function (p) { return guardAll(p, 6); }],
    ['織羽手環', 0.5, function (p) { return weaveOn(p); }],
    ['之魂憶起', 0.5, function (p) { return !!(p.afkDimRift && p.afkDimRift.soulMem); }],
    ['太陽神凱布利', 0.5, function (p) { return !!(p.afkDimRift && p.afkDimRift.khepri); }],
    ['解放淵源全套', 1, function (p) { var o = mio(p); return !!(o && o.lb >= 22); }],
    ['代理之人', 1, function (p) { return !!(p.afkDimRift && p.afkDimRift.agent); }]
  ];
  var FLOOR = [   // 最低保留點數
    ['次元支配 +5', 100, function (p) { return !!(p.afkDimRift && p.afkDimRift.dimWpn5); }],
    ['庇護者之戒', 100, function (p) { return guardAll(p, 6); }],
    ['代理之人', 50, function (p) { return !!(p.afkDimRift && p.afkDimRift.agent); }],
    ['密奧起源', 50, function (p) { var o = mio(p); return !!(o && o.og >= 22); }],
    ['密奧創世', 25, function (p) { var o = mio(p); return !!(o && o.cr >= 22); }]
  ];
  var RECOVER = [   // 取回力量（%）
    ['取回繁星之力', function (p) { return Math.min(3, (p.afkDimRift && p.afkDimRift.stars) || 0) * 5; }],
    ['次元探險者', function (p) { return p.afkDimRift && (p.afkDimRift.rank || 0) >= 1 ? 5 : 0; }],
    ['遠征星途者', function (p) { return p.afkDimRift && ((p.afkDimRift.rank || 0) >= 2 || p.afkDimRift.starfarer) ? 5 : 0; }],
    ['之魂憶起＋太陽神凱布利', function (p) { return p.afkDimRift && p.afkDimRift.soulMem && p.afkDimRift.khepri ? 5 : 0; }],
    ['庇護者之戒', function (p) { return guardAll(p, 6) ? 5 : 0; }],
    ['占星者', function (p) { var o = mio(p); return o && o.ma >= 22 ? 5 : 0; }],
    ['織羽手環', function (p) { return weaveOn(p) ? 5 : 0; }]
  ];
  var mio = function (p) { try { return W.__afkMio && W.__afkMio.compute ? W.__afkMio.compute(p) : null; } catch (e) { return null; } };
  var guardAll = function (p, lv) { var g = p && p.afkGuard && p.afkGuard.k; if (!g) return false; var ks = Object.keys(g); return ks.length >= 5 && ks.every(function (k) { return (Number(g[k]) || 0) >= lv; }); };
  var weaveOn = function (p) { var id = W.__afkBracelet && W.__afkBracelet.WEAVE_ID, e = p && p.eq; if (!e || !id) return false; return Object.keys(e).some(function (k) { return e[k] && e[k].id === id; }); };

  // ── 物品 ──
  var IMG = 'assets/icons/items/';
  var ITEMS = {
    afk_rift_shard: { n: '裂縫碎光', img: IMG + '原石碎片.png', d: '次元裂縫的光凝成的碎片。進入無盡的裂縫需要 50 個，另需星辰之核 15 個與血龍鑽 500。' },
    afk_dim_crystal: { n: '次元結晶', img: IMG + '原石碎片.png', d: '次元裂縫每一隻怪都會留下的結晶。守護者之戒、席琳遺骸淬鍊、次元遺物都用得到。' },
    afk_star_dust: { n: '破碎星光塵埃', img: IMG + '原石碎片.png', d: '裂縫裡的星光碎屑。100 個加上血龍鑽 10，可在次元工匠合成「異化星塵」。' },
    afk_alien_dust: { n: '異化星塵', img: IMG + '原石碎片.png', d: '用來強化次元支配（縫天★）的星塵。' },
    afk_split_dust: { n: '分裂的蔑視塵埃', img: IMG + '原石碎片.png', d: '用來開啟幻聖紋的塵埃；在次元工匠支付 1,000 個與血龍鑽 100。' },
    afk_star_core: { n: '星辰之核', img: IMG + '原石碎片.png', d: '無盡的裂縫入場材料：15 個，另需裂縫碎光 50 個與血龍鑽 500，並先完成封印副本。' }
  };
  Object.keys(ITEMS).forEach(function (id) { var x = ITEMS[id]; if (!DB.items[id]) DB.items[id] = { n: x.n, type: 'etc', p: 0, gachaWeight: 0, weight: 0, noUse: true, noSell: true, c: 'text-cyan-300', img: x.img, d: x.d + '（次元裂縫限定掉落）' }; });
  var MIO_DIM = 'afk_mio_dim', CANCEL = 'afk_cancel_scroll';

  // ── 開關 ──
  var rec = function (p) { p = p || P(); if (!p) return {}; if (!p.afkDimRift || typeof p.afkDimRift !== 'object') p.afkDimRift = { on: false }; return p.afkDimRift; };
  var on = function () { var p = P(); if (p && typeof W.__afkGdRiftOn === 'function' && W.__afkGdRiftOn()) return true;   // GD之子的期待：裂痕裡強制套次元裂縫規則
    return !!(p && !p.classicMode && p.afkDimRift && p.afkDimRift.on && p.sherineDream && p.sherineMad); };
  W.__afkDimRiftOn = function () { return on(); };
  try { Object.defineProperty(W, '__afkG3Rift', { configurable: true, get: function () { return on(); }, set: function () {} }); } catch (e) {}
  var canOpen = function (p) { if (!p || p.classicMode) return '經典模式沒有次元裂縫。'; if (Math.floor(p.rebirth || 0) < 2) return '要完成二次轉生。'; if (!(p.afkFinalTier && p.afkFinalTier.t3 === 'win')) return '要打贏終焉第三階層。'; return ''; };
  var inTown = function () { var id = (typeof mapState !== 'undefined' && mapState) ? mapState.current : ''; return !!(id && (DB.towns && DB.towns[id] || /^town_/.test(id))); };
  function toggle() {
    var p = P(), r = rec(p); if (!p) return;
    if (!inTown()) { sys('<span class="text-amber-300">只能在村莊裡切換次元裂縫。</span>'); return; }
    if (!r.on) {
      var why = canOpen(p); if (why) { sys('<span class="text-amber-300">' + esc(why) + '</span>'); return; }
      p.sherineWorld = true; p.sherineMad = true; p.sherineDream = true;
      r.on = true; r.at = Date.now(); r.ever = 1;
      sys('<span class="font-bold" style="color:#67e8f9">🌀 你踏進了次元裂縫。縫隙的光一點一點落下來……</span>');
    } else { r.on = false; clearErosion(p, true); sys('<span style="color:#67e8f9">🌀 你退回了夢域。</span>'); }
    try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
    try { saveGame(); } catch (e) {}
  }

  // ── 席琳的祈禱介面 ──
  if (typeof W.renderSherinePray === 'function') {
    var oPray = W.renderSherinePray;
    W.renderSherinePray = function (div) {
      var r = oPray.apply(this, arguments);
      try {
        var p = P(); if (!p || p.classicMode || !div || div.querySelector('#afk-dimrift-card')) return r;
        var box = div.querySelector('.flex.flex-col.gap-3') || div, why = canOpen(p), isOn = on();
        box.insertAdjacentHTML('beforeend',
          '<div id="afk-dimrift-card" class="bg-slate-950/80 border border-cyan-800 rounded p-3 text-sm leading-relaxed">'
          + '<div class="font-bold mb-1 text-cyan-200">🌀 次元裂縫：' + (isOn ? '<span class="text-cyan-300">開啟中</span>' : '<span class="text-slate-400">關閉</span>') + '</div>'
          + '<div class="afk-lore">「縫的那一邊，還有別的天空。總有一天，得有人替我把它縫上。」——席琳</div>'
          + '<div class="text-slate-300 text-xs">比席琳夢域鏡更深的一層。所有地圖都會被縫隙的光侵蝕（回村清除）；頭目會留下光蝕；你的面板會被壓到五成，要靠各種成就取回。開放條件：完成二次轉生，並打贏終焉第三階層。</div></div>'
          + '<button type="button" id="afk-dimrift-btn" class="btn py-3 text-base font-bold ' + (why && !isOn ? 'bg-slate-700 border-slate-600 opacity-60 cursor-not-allowed' : 'bg-cyan-800 hover:bg-cyan-700') + '"' + (why && !isOn ? ' disabled title="' + esc(why) + '"' : '') + '>🌀 ' + (isOn ? '退回夢域' : '踏進次元裂縫') + (why && !isOn ? '（' + esc(why) + '）' : '') + '</button>');
        var b = div.querySelector('#afk-dimrift-btn'); if (b) b.onclick = function () { toggle(); try { W.renderSherinePray(div); } catch (e) {} };
      } catch (e) { console.warn('[AFK-dimrift] ui', e); }
      return r;
    };
    try { (0, eval)('renderSherinePray = window.renderSherinePray'); } catch (e) {}
  }

  // ── 侵蝕 ──
  var reduceSum = function (p) { return REDUCE.reduce(function (s, x) { return s + (x[2](p) ? x[1] : 0); }, 0); };
  var floorSum = function (p) { return Math.min(R.floorMax, FLOOR.reduce(function (s, x) { return s + (x[2](p) ? x[1] : 0); }, 0)); };
  var weightCut = function (p) { var d = p.d || {}, pct = Number(d.weightPct); if (!isFinite(pct)) return 0; return Math.max(0, Math.min(0.5, 0.5 * (1 - pct / 100))); };
  var pctCut = function (p) { var t = sealTier(p); return t ? [0, 0.05, 0.10, 0.15][t] : 0; };   // 刻印石徽記：侵蝕扣血 −5／−10／−15%
  var BASE = 0.5;   // 裂縫面板保留比例（Ping 11-11 12:37：50% → 60%；11-13 16:53：改回 50%）
  // 面板保留比例：GD之子的期待裡最多 75%，取回力量到 90% 也壓回 75%（Ping 11-12 17:30 80%；11-13 16:53 改 75%）
  var panelF = function (p) { var f = BASE + recoverPct(p) / 100; try { if (W.__afkGdRiftOn && W.__afkGdRiftOn()) f = Math.min(f, 0.75); } catch (e) {} return f; };
  var recoverPct = function (p) { return Math.min(40, RECOVER.reduce(function (s, x) { return s + (Number(x[1](p)) || 0); }, 0)); };
  function clearErosion(p, all) { var r = rec(p); r.ero = 0; if (all) { /* 光蝕不因回村清除 */ } }
  var members = function () { var p = P(), out = []; if (!p) return out; if (!p.dead) out.push(p); (p.allies || []).forEach(function (a) { if (a && !a._downed && (a.curHp || 0) > 0) out.push(a); }); return out; };
  var bossOnField = function () { return (mapState.mobs || []).some(function (m) { return m && m.boss && !m._dead && m.curHp > 0; }); };
  function erodeSecond() {
    var p = P(), r = rec(p); if (!p) return;
    if (inTown()) { if (r.ero) { r.ero = 0; r.resBack = 0; try { calcStats(); } catch (e) {} } return; }
    if (p.dead) return;
    if (typeof W.__afkErodePaused === 'function' && W.__afkErodePaused()) return;   // 九階以上娃娃的「縫光」
    // 扣血
    var net = R.hpPct - reduceSum(p);
    members().forEach(function (x) {
      var mx = x === p ? (rec(p).hp50 || Math.floor((p.mhp || 1) / (panelF(p)) * BASE)) : (x._dimBase ? Math.floor(x._dimBase.mhp * BASE) : (x.mhp || 1));
      if (net <= 0) { var heal = Math.floor(mx * (-net) / 100); if (heal > 0) { if (x === p) p.hp = Math.min(p.mhp, p.hp + heal); else x.curHp = Math.min(x.mhp || x.curHp, x.curHp + heal); } return; }
      var dmg = mx * net / 100 * (1 - weightCut(p)) * (1 - pctCut(p)) * (W.__afkErodeCuts || []).reduce(function (m, f) { try { return m * (1 - Math.max(0, Math.min(0.9, Number(f(p, x)) || 0))); } catch (e) { return m; } }, 1);   // 黃道星卡・水瓶、七階以上娃娃（堅壁、統御）
      if (x === p) W.__afkDrainHit = (Number(W.__afkDrainHit) || 0) + dmg;   // 聖十字之盾（禁衛軍）在裂縫只擋一部分：見 afk-castle-guards
      if (L && L.boss) L.boss.hurt(x, dmg);
    });
    // AC、魔防、抗性
    if ((r.ero || 0) < R.resMax) { var step = R.eroStep; try { if (W.__afkGdRiftOn && W.__afkGdRiftOn()) step *= 2; } catch (e) {} r.ero = Math.min(R.resMax, (r.ero || 0) + step); try { calcStats(); } catch (e) {} }   // Ping 11-13 14:29：每秒 AC +5、魔防 −5、四屬性 −5；GD之子的期待 ×2
  }
  var L = W.__afkLore;
  function lightSecond() {
    var p = P(), r = rec(p); if (!p) return;
    var t = tk(), boss = bossOnField();
    if (boss) {
      if (!r.lightAt || t >= r.lightAt) {
        if (r.lightAt) { r.light = Math.min(R.lightMax, (r.light || 0) + 1); clog('<span class="font-bold" style="color:#fde68a">【光蝕】</span>頭目的光落在全隊身上——光蝕 ' + r.light + ' 層（最大 HP −' + (r.light * R.lightHp) + '%、受到的治療 −' + (r.light * R.lightHeal) + '%）。'); try { calcStats(); } catch (e) {} }
        r.lightAt = t + R.lightEvery;
      }
      if (!r.execAt || t >= r.execAt) {
        if (r.execAt) members().forEach(function (x) { if (W.__afkExecImmune && W.__afkExecImmune(x)) return; var mx = x === p ? p.mhp : x.mhp, hp = x === p ? p.hp : x.curHp; if (mx > 0 && hp > 0 && hp < mx * R.execPct / 100) { if (x === p) { p.hp = 0; try { killPlayer(); } catch (e) {} } else { x.curHp = 0; x._downed = true; x._reviveCd = 150; } clog('<span class="font-bold" style="color:#f87171">【斬殺線】</span>' + esc(x === p ? '你' : (x._allyName || '傭兵')) + ' 的 HP 低於 10%，被頭目斬殺了！'); } });
        r.execAt = t + R.lightEvery;
      }
    } else {
      r.lightAt = 0; r.execAt = 0;
      if ((r.light || 0) >= 10 && !r.noAutoCancel && typeof questCountId === 'function' && questCountId(CANCEL) > 0) {
        try { questConsumeId(CANCEL, 1); r.light = 0; sys('<span style="color:#fde68a">自動使用相消術卷軸，清除了光蝕。</span>'); calcStats(); } catch (e) {}
      }
    }
  }
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var t0 = tk(), r = oTick.apply(this, arguments);
      try { if (on() && tk() !== t0 && tk() % 10 === 0) { var off = typeof W.__afkOfflineNow === 'function' && W.__afkOfflineNow(); if (!off) { erodeSecond(); lightSecond(); } bossRegen(); allyPanel(); sealDebuff(); } else if (!on() && tk() % 10 === 0) allyPanel(); } catch (e) { console.warn('[AFK-dimrift] tick', e); }
      return r;
    };
  }
  function bossRegen() { (mapState.mobs || []).forEach(function (m) { if (m && m.boss && m._dimRift && !m._dead && m.curHp > 0 && m.curHp < m.hp) m.curHp = Math.min(m.hp, m.curHp + Math.ceil(m.hp * R.bossRegen)); }); }
  // 相消術卷軸：手動使用也清光蝕
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (uid) {
      var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uid; });
      var r = oUse.apply(this, arguments);
      try { if (it && it.id === CANCEL && on() && rec(p).light) { rec(p).light = 0; sys('<span style="color:#fde68a">光蝕清除了。</span>'); calcStats(); } } catch (e) {}
      return r;
    };
  }
  // 受到的治療 −2%／層
  if (typeof W.foulWaterHealMult === 'function') {
    var oFoul = W.foulWaterHealMult;
    W.foulWaterHealMult = function (target) { var m = oFoul.apply(this, arguments); try { var p = P(); if (on() && p && (target === p || (p.allies || []).indexOf(target) >= 0)) m *= Math.max(0, 1 - (rec(p).light || 0) * R.lightHeal / 100 * (1 - lightCut(p))); } catch (e) {} return m; };
    try { (0, eval)('foulWaterHealMult = window.foulWaterHealMult'); } catch (e) {}
  }

  // ── 面板 ──
  var HALF = ['meleeDmg', 'meleeHit', 'meleeCritDmg', 'rangedDmg', 'rangedHit', 'rangedCritDmg', 'magicDmg', 'magicHit', 'magicCritDmg', 'extraDmg', 'extraHit', 'dr', 'mr', 'resNone', 'resFire', 'resWater', 'resWind', 'resEarth'];
  var RES4 = ['resFire', 'resWater', 'resWind', 'resEarth'];
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) {
    if (!on() || p !== P()) return;
    var f = panelF(p), light = (rec(p).light || 0) * R.lightHp / 100 * (1 - lightCut(p));
    rec(p).hp50 = Math.max(1, Math.floor((Number(p.mhp) || 1) * BASE));   // 侵蝕照「壓縮後（沒取回力量）的最大 HP」算（Ping 11-07 18:13）
    p.mhp = Math.max(1, Math.floor((Number(p.mhp) || 1) * f * (1 - light)));
    p.mmp = Math.max(0, Math.floor((Number(p.mmp) || 0) * f));
  });
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = P(); if (!on() || !p || !p.d) return r;
        var d = p.d, f = panelF(p);
        // 負重上限跟面板一起打折（Ping 11-07 17:33）；剩下的上限超過 3,000，每多 1,000 造成的傷害 +1.5%（負重前行）
        if (typeof d.weightCapacity === 'number' && d.weightCapacity > 0) {
          var lim = Math.max(1, Math.floor(d.weightCapacity * f)), pct = Math.floor((Number(d.equippedWeight) || 0) / lim * 100);
          var tier = pct <= 49 ? 0 : pct <= 81 ? 1 : pct <= 99 ? 2 : 3, old = d.loadTier || 0, sp = [1, 1, 2, 3];
          if (typeof d.aspd === 'number' && sp[old] !== sp[tier]) d.aspd = d.aspd / sp[old] * sp[tier];
          d.weightCapacity = lim; d.weightPct = pct; d.loadTier = tier;
          rec(p).carry = Math.max(0, Math.floor((lim - CARRY.from) / 1000)) * CARRY.per;
        }
        HALF.forEach(function (k) { if (typeof d[k] === 'number' && d[k] > 0) d[k] = Math.floor(d[k] * f); });
        if (typeof d.ac === 'number' && d.ac < 0) d.ac = Math.ceil(d.ac * f);
        // 侵蝕：AC 往上加（越高越差），魔防、抗性往下扣到最低保留
        var ero = Math.floor((rec(p).ero || 0) * (typeof W.__afkEroMult === 'function' ? (Number(W.__afkEroMult(p)) || 1) : 1));   // 龍息娃娃：侵蝕的下降打折
        if (ero) {
          var keep = floorSum(p), wc = weightCut(p);
          var eAc = Math.max(0,Math.min(ero, R.acMax)-(W.LineageSherine?.erosionBack(p)||0));
          d.ac = (d.ac || 0) + eAc;
          var cut = function (k) { var v = Number(d[k]) || 0; if (v <= 0) return; var floor = Math.max(keep, Math.floor(v * wc)); var low = Math.min(v, floor); d[k] = Math.max(low, v - eAc); };
          cut('mr'); var rb = Math.min(ero, rec(p).resBack || 0); RES4.forEach(function (k) { var v = Number(d[k]) || 0; var e2 = ero - rb, floor = Math.max(keep, Math.floor(v * wc)); var growthFloor = W.LineageGrowth ? W.LineageGrowth.pct(p, 'curse') : 0; d[k] = Math.max(Math.min(v,floor+growthFloor),v-e2); });
        }
      } catch (e) { console.warn('[AFK-dimrift] stats', e); }
      return r;
    };
  }
  // 負重：上限 −5,000，每取回 5% 再 −500（在核心算負重級距之前扣掉）
  var RC = W.AFK_RELIC_COMPANIONS;
  if (RC && typeof RC.equipmentCapacity === 'function') {
    var oCap = RC.equipmentCapacity;
    RC.equipmentCapacity = function (p, cap) { return oCap.apply(this, arguments); };   // 11-07 17:33 改成跟面板一起打折（見重算後的「負重前行」）
  }

  // ── 怪物 ──
  var mobIsOurs = function (m) { return m && !m._dimRift && !m.siegeEnemy && !m.pledgeEnemy && m.race !== '建築'; };
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      var r = oSpawn.apply(this, arguments);
      try {
        var m = mapState.mobs && mapState.mobs[idx];
        if (on() && !inTown() && mobIsOurs(m)) {
          m._dimRift = true;
          m.hp = Math.max(1, Math.round((m.hp || 1) * R.mobHp)); m.curHp = m.hp;
          if (m.hit) m.hit = Math.round(m.hit * (m.boss ? R.bossHit : R.mobHit));
          if (m.exp) m.exp = Math.round(m.exp * R.exp);
        }
      } catch (e) { console.warn('[AFK-dimrift] spawn', e); }
      return r;
    };
  }
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { return mob && mob._dimRift && on() ? (mob.boss ? R.bossDmg : R.mobDmg) : 1; });
  // 造成的傷害 −30%
  var hooked = false;
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return hooked;
    var o = C.damage; hooked = true;
    C.damage = function (actor, target, amount, opt) { try { if (on() && actor && !actor.mobId && target && target.mobId && amount > 0) amount = Math.max(1, Math.floor(amount * outMult())); } catch (e) {} return o.call(this, actor, target, amount, opt); };
    return true;
  };
  var outMult = function () { var p = P(), r = rec(p), k = R.dmgOut; if (r.clothEx) k += 0.15; if (r.athena) k += 0.15; if (r.dimWpn) k *= 1.3; else if (r.supWpn) k *= 0.9; var st = sealTier(p); if (st) k *= 1 + [0, 0.01, 0.03, 0.05][st]; if (r.carry) k *= 1 + r.carry / 100; return k; };
  if (!hookDamage()) { try { document.addEventListener('DOMContentLoaded', hookDamage); } catch (e) {} }

  // ── 掉落 ──
  var party = function () { var p = P(); return Math.min(16, 1 + ((p && p.allies) || []).filter(function (a) { return a && !a._downed; }).length); };
  var roll = function (r) { return Math.random() < r; };
  function drops(m) {
    var p = P(), got = [];
    var give = function (id, n) { if (!DB.items[id] || !(n > 0)) return; try { gainItem(id, n, true, true); } catch (e) {} got.push((DB.items[id].n || id) + (n > 1 ? ' ×' + n : '')); };
    give('afk_dim_crystal', 1);
    if (m.boss) give('afk_rift_shard', 3 + Math.floor(Math.random() * 3)); else if (roll(0.02)) give('afk_rift_shard', 1);
    if (roll(0.01)) give('afk_star_dust', 1);
    if (roll(0.01)) give('afk_split_dust', 1);
    if (roll(0.001)) give('afk_star_core', 1);
    if (roll((m.boss ? 0.002 : 0.00002) * party())) give(MIO_DIM, 1);
    if (roll(0.001)) { try { W.pandoraAdjustSharedDiamonds(1); got.push('龍之鑽石'); } catch (e) {} }
    var rare = got.filter(function (x) { return !/次元結晶|裂縫碎光/.test(x); });
    if (rare.length) sys('<span class="text-cyan-300">🌀 裂縫掉落：' + rare.map(esc).join('、') + '</span>');
  }
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState.mobs ? mapState.mobs[idx] : null, was = !!(m && m._dead);
      var r = oKill.apply(this, arguments);
      try { if (m && !was && m._dead && m._dimRift && on()) drops(m); } catch (e) { console.warn('[AFK-dimrift] drop', e); }
      return r;
    };
  }

  // ── 傭兵：面板壓到 50%、侵蝕（每秒照隊長的取回比例與侵蝕層數，從原本的數值重算） ──
  function allyPanel() {
    var p = P(); if (!p || !p.allies) return; var live = on(), f = panelF(p), ero = live ? (rec(p).ero || 0) : 0, keep = floorSum(p);
    p.allies.forEach(function (a) {
      if (!a || !a.d) return;
      if (!live) { if (a._dimBase) { var b0 = a._dimBase; a.mhp = b0.mhp; a.mmp = b0.mmp; Object.keys(b0.d).forEach(function (k) { a.d[k] = b0.d[k]; }); delete a._dimBase; } return; }
      if (!a._dimBase) { var bd = {}; HALF.concat(['ac']).forEach(function (k) { if (typeof a.d[k] === 'number') bd[k] = a.d[k]; }); a._dimBase = { mhp: a.mhp, mmp: a.mmp, d: bd }; }
      var b = a._dimBase, light = (rec(p).light || 0) * R.lightHp / 100 * (1 - lightCut(p));
      a.mhp = Math.max(1, Math.floor(b.mhp * f * (1 - light))); a.mmp = Math.floor((b.mmp || 0) * f);
      if (a.curHp > a.mhp) a.curHp = a.mhp; if (a.mp > a.mmp) a.mp = a.mmp;
      Object.keys(b.d).forEach(function (k) { var v = b.d[k]; if (k === 'ac') a.d.ac = (v < 0 ? Math.ceil(v * f) : v) + Math.max(0,Math.min(ero, R.acMax)-(W.LineageSherine?.erosionBack(a)||0)); else a.d[k] = v > 0 ? Math.floor(v * f) : v; });
      if (ero) ['mr'].concat(RES4).forEach(function (k) { var v = Number(a.d[k]) || 0; if (v <= 0) return; a.d[k] = Math.max(Math.min(v, keep), v - (k === 'mr' ? Math.max(0,Math.min(ero, R.acMax)-(W.LineageSherine?.erosionBack(a)||0)) : ero)); });
    });
  }

  // ── 遠征位階（裂縫）與刻印石徽記（decisions-1107 1.6） ──
  var DR_RANKS = [
    { n: '（尚未入階）' },
    { n: '次元探險者', cost: 1000, cur: 'exped', d: '取回力量 +5%' },
    { n: '遠征星途者', cost: 100, cur: 'rift', stone: 'afk_engrave_s1', d: '取回力量 +5%；上位者的遠征徽記變成「刻印石徽記・壹」' },
    { n: '次元探索者', cost: 300, cur: 'rift', stone: 'afk_engrave_s2', d: '刻印石徽記升為「貳」' },
    { n: '次元守護者', cost: 500, cur: 'rift', stone: 'afk_engrave_s3', d: '刻印石徽記升為「參」' }
  ];
  var SEAL = { erode: [0, 5, 10, 15], light: [0, 5, 10, 15], pot: [0, 10, 15, 20], debuff: [0, 5, 10, 15], seal: [0, 1, 3, 5], dmg: [0, 1, 3, 5] };
  ['壹', '貳', '參'].forEach(function (x, i) {
    var id = 'afk_engrave_s' + (i + 1), t = i + 1; if (DB.items[id]) return;
    DB.items[id] = { n: '刻印石徽記・' + x, type: 'acc', slot: 'engrave', req: 'all', safe: 0, p: 0, gachaWeight: 0, noTrade: true, noEnhance: true, noSell: true, c: 'text-cyan-300', img: 'assets/icons/items/靈魂之球.png', afkEngrave: 4, afkSeal: t,
      d: '上位者的遠征徽記在次元裂縫裡重新刻過的徽記（保留上位者徽記的效果）。次元裂縫裡：侵蝕扣血 −' + SEAL.erode[t] + '%、光蝕每層效果 −' + SEAL.light[t] + '%、藥水恢復量 +' + SEAL.pot[t] + '%、受到的異常狀態持續時間 −' + SEAL.debuff[t] + '%、封印戰受到的傷害 −' + SEAL.seal[t] + '%、造成的傷害 +' + SEAL.dmg[t] + '%。' };
  });
  var sealTier = function (p) { var e = p && p.eq && p.eq.engrave, d = e && DB.items[e.id]; return d && d.afkSeal ? d.afkSeal : 0; };
  var lightCut = function (p) { var t = sealTier(p); return t ? SEAL.light[t] / 100 : 0; };
  var exped = function (p) { return p && p.afkExped && typeof p.afkExped === 'object' ? p.afkExped : null; };
  var rankWhy = function (p) {
    var r = rec(p), cur = r.rank || 0, nx = DR_RANKS[cur + 1]; if (!nx) return '已經是最高位階';
    if (cur === 0) { var x = exped(p); if (!x || (x.rank || 0) < 4) return '要先升到遠征位階「上位者」'; if ((x.pts || 0) < nx.cost) return '遠征點數不夠（' + (x.pts || 0) + '／' + nx.cost + '）'; return ''; }
    if ((r.pts || 0) < nx.cost) return '裂縫點數不夠（' + (r.pts || 0) + '／' + nx.cost + '）'; return '';
  };
  var swapStone = function (p, to) {
    var e = p.eq || {}, inv = p.inv || [], from = ['afk_engrave_4', 'afk_engrave_s1', 'afk_engrave_s2'];
    if (e.engrave && from.indexOf(e.engrave.id) >= 0) { e.engrave.id = to; return true; }
    var it = inv.filter(function (x) { return x && from.indexOf(x.id) >= 0; })[0]; if (it) { it.id = to; return true; }
    try { gainItem(to, 1, true, true); } catch (e2) {} return true;
  };
  function rankUp() {
    var p = P(); if (!p) return; var why = rankWhy(p); if (why) { sys('<span class="text-amber-300">' + esc(why) + '</span>'); return; }
    var r = rec(p), cur = r.rank || 0, nx = DR_RANKS[cur + 1];
    if (nx.cur === 'exped') exped(p).pts -= nx.cost; else r.pts -= nx.cost;
    r.rank = cur + 1; if (r.rank >= 2) r.starfarer = true;
    if (nx.stone) swapStone(p, nx.stone);
    sys('<span class="font-bold" style="color:#67e8f9">🧭 遠征位階升為「' + nx.n + '」！</span>' + (nx.stone ? '<span class="text-cyan-200">' + esc(DB.items[nx.stone].n) + '。</span>' : ''));
    try { calcStats(); saveGame(); } catch (e) {}
  }
  // 刻印石徽記：藥水、異常持續、封印戰受傷
  if (typeof W.playerEquipPotionBonusPct === 'function') {
    var oPot = W.playerEquipPotionBonusPct;
    W.playerEquipPotionBonusPct = function () { var v = oPot.apply(this, arguments); try { var p = P(), t = sealTier(p); if (t && on()) v += SEAL.pot[t]; } catch (e) {} return v; };
    try { (0, eval)('playerEquipPotionBonusPct = window.playerEquipPotionBonusPct'); } catch (e) {}
  }
  var lastSt = {};
  function sealDebuff() {
    var p = P(), t = sealTier(p), st = p && p.statuses; if (!st || !t) return; var k0 = 1 - SEAL.debuff[t] / 100;
    Object.keys(st).forEach(function (k) { var v = Number(st[k]) || 0; if (v > 0 && v > (lastSt[k] || 0) + 1) { v = Math.max(1, Math.round(v * k0)); st[k] = v; } lastSt[k] = v; });
  }
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) { try { var p = P(), t = sealTier(p), R2 = W.__afkRiftDg && W.__afkRiftDg.run(); if (t && ent === p && R2 && R2.id === 'seal') return 1 - SEAL.seal[t] / 100; } catch (e) {} return 1; });

  // 聖十字之盾在裂縫擋的比例：30%；阿納金的號角 1／2／3 級 40／45／50%
  W.__afkCrossThrough = function () { if (!on()) return null; var p0 = P(), hl = p0 && p0.eq && p0.eq.horn ? (rec(p0).hornLv || 0) : 0; return 1 - [0.3, 0.4, 0.45, 0.5][Math.max(0, Math.min(3, hl))]; };
  W.__afkDimRift = { CARRY: CARRY, R: R, RANKS: DR_RANKS, rankUp: rankUp, rankWhy: rankWhy, sealTier: sealTier, allyPanel: allyPanel, REDUCE: REDUCE, FLOOR: FLOOR, RECOVER: RECOVER, on: on, open: on, canOpen: canOpen, toggle: toggle, rec: rec, reduceSum: reduceSum, floorSum: floorSum, recoverPct: recoverPct, weightCut: weightCut, erodeSecond: erodeSecond, lightSecond: lightSecond, drops: drops, outMult: outMult };
  try { console.log('[AFK-dimrift] 已載入：次元裂縫（世界規則）'); } catch (e) {}
})();
