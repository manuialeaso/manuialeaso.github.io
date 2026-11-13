/* ============================================================================
 * afk-arts.js — 轉生技藝（玩家 2026-10-21 指定）
 *
 * ‧轉生後到燃柳村找 奧拉奇里亞（女性 NPC）免費學習；每個職業兩種技藝「二選一」（可回來免費改選）
 * ‧技藝效果見下方 ARTS 的說明文字；實作細節與近似處寫在 docs/rebirth-arts.md
 * ‧免死：席琳的永生、不屈命運、絕望身軀三者各自獨立；其他免死（命運迴響的「每場戰鬥免死一次」）共用一個 30 秒冷卻
 * ‧傭兵：轉生後招傭兵得到「同袍戰陣」：上場人數每 4 人全隊普攻多 1 次（上限 5 次，16 人＝5 次），
 *   這些追加攻擊不觸發任何特效，傷害＝武器最大值；（2026-11-02 起：16 人減半改成同一門技藝的人數懲罰——同一門第 3 人起全部 −15%、第 4 人起再 −20%，16 人滿隊加倍，只扣技藝倍率）
 * 掛點：只包 window 上的函式（傷害用前後 HP 差補算），不改核心檔。須排在 afk-relicplus、afk-corrupt、afk-dreamstar、afk-rebirth 之後。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('arts')) return;
  if (typeof window.recomputeStats !== 'function') { console.warn('[AFK-arts] 找不到 recomputeStats，略過'); return; }

  // 2026-11-02 02:56（玩家）：幻刃 ×2（減傷 15%、吸血 2%）、織命 ×2（吸血 2%）、四元素主宰一般攻擊 ×8、殷海薩一般攻擊 ×5；16 人減半改成同一門技藝的人數懲罰（artPen）
  // 2026-10-28 八職業平衡（冷門職業加強，數值集中在這裡）：騎士傷害 ×3、幻刃 ×5、織命 ×4、四元素主宰 ×15、殷海薩 ×17、魔血 +50%；
  //   （第二輪 2026-10-29 的新數值見 docs/class-balance.md）減傷：萬兵之道 30%、魔血咒者 20%、幻刃術士 30%；吸血：萬兵之道／魔血咒者／幻術士兩門 5%、時流暗殺者 1%（2026-10-28 晚 3% → 1%）。依據見 docs/class-balance.md
  var W = window; W.__afkArtTune = W.__afkArtTune || { knight: 3.5, arms: 2.5, sorc: 3.5, life: 3.5, illuPhantom: 7, ruler: 7, god: 4, ein: 6, classOut: { mage: 1 }, classPet: { mage: 1.2 }, dmag: 2.5, fuse: 4.5, minionMage: 0.8, athAttr: 2, athMag: 50, fafPanel: 0.5, fafAxe: 0.7, kdark: 3, kdoom: 0.3, dtime: 1.6, armsDr: 0.3, timeDr: 0, darkDr: 0.2, sorcDr: 0.15, leech: 0.05, illuLeech: 0.02, timeLeech: 0.01 };
  // 職業平衡係數（2026-10-29）：該職業的魔法基礎傷害與召喚物／夥伴傷害再乘上這個倍率（取整）；法師 ×0.72
  var clsOfStats = function (d) { try { if (typeof player !== 'undefined' && player && player.d === d) return player.cls; var a = (player && player.allies || []).find(function (x) { return x && x.d === d; }); return a ? a.cls : null; } catch (e) { return null; } };
  var classK = function (cls) { var t = W.__afkArtTune.classOut; return (cls && t && t[cls]) || 1; };
  // Ping 11-13 02:25：法師魔法基礎 ×0.72 → ×1；召喚物、夥伴 ×0.72 → ×1.2
  var classPetK = function (cls) { var t = W.__afkArtTune.classPet; return (cls && t && t[cls]) || classK(cls); };
  if (typeof W.magicBaseDamage === 'function') {
    var oMBD = W.magicBaseDamage;
    W.magicBaseDamage = function (rolled, dStats) { var v = oMBD.apply(this, arguments); try { var k = classK(clsOfStats(dStats)); if (k !== 1 && v > 0) v = Math.max(1, Math.floor(v * k)); } catch (e) {} return v; };
  }
  // 法師面板分給寵物、召喚物（Ping 11-13 03:02／03:11 換算定案）：s＝你自己是法師 60%（隊長）、法師傭兵 30%
  //   每次攻擊 +s×(魔法傷害＋額外傷害＋力量＋智力)；命中 +s×(魔法命中＋敏捷)；爆擊率 s×魔法爆擊%，爆擊 ×(1＋s×魔法爆擊傷害%)；
  //   寵物最大 HP +s×體質×10；寵物 MP 恢復 +s×精神÷10；魅力不算。
  var PANEL_LEAD = 0.6, PANEL_ALLY = 0.3;
  var panelS = function (owner) { if (!owner || owner.cls !== 'mage' || owner.classicMode) return 0; var p = (typeof player !== 'undefined') ? player : null; return owner === p ? PANEL_LEAD : PANEL_ALLY; };
  var N0 = function (x) { return Number(x) || 0; };
  var panelHit = function (owner, v) {
    var k = panelS(owner); if (!k) return v; var d = owner.d || {};
    v += k * (N0(d.magicDmg) + N0(d.extraDmg) + N0(d.str) + N0(d.int));
    if (Math.random() * 100 < k * N0(d.magicCrit)) v *= 1 + k * N0(d.magicCritDmg) / 100;
    return Math.max(1, Math.floor(v));
  };
  var panelHitBonus = function (owner) { var k = panelS(owner), d = (owner && owner.d) || {}; return k ? Math.floor(k * (N0(d.magicHit) + N0(d.dex))) : 0; };
  var wrapFn = function (name, mk) { if (typeof W[name] !== 'function' || W[name]._afkPanel) return; var f = mk(W[name]); f._afkPanel = true; W[name] = f; try { (0, eval)(name + ' = window.' + name); } catch (e) {} };
  wrapFn('petDerive', function (o) { return function () { var r = o.apply(this, arguments); try { var pl = P(); if (r && panelS(pl)) { var d = pl.d || {}, k = panelS(pl); r.hit = (r.hit || 0) + panelHitBonus(pl); r.mpRegBonus = (r.mpRegBonus || 0) + Math.floor(k * N0(d.wis) / 10); } } catch (e) {} return r; }; });
  wrapFn('petMhpEff', function (o) { return function () { var v = o.apply(this, arguments); try { var pl = P(), k = panelS(pl); if (k) v += Math.floor(k * N0(pl.d && pl.d.con) * 10); } catch (e) {} return v; }; });
  ['_sumDerive', '_zmbDerive'].forEach(function (fn) { wrapFn(fn, function (o) { return function (x, owner) { var r = o.apply(this, arguments); try { var ow = owner || P(); if (r && panelS(ow)) r = Object.assign({}, r, { hit: (r.hit || 0) + panelHitBonus(ow) }); } catch (e) {} return r; }; }); });
  var hookCompanion = function () {   // 召喚術（v2）、寵物等夥伴的傷害走 AFK_RELIC_RUNTIME.companionDamage
    var R = W.AFK_RELIC_RUNTIME; if (!R || typeof R.companionDamage !== 'function' || R.companionDamage._afkCls) return;
    var o = R.companionDamage;
    R.companionDamage = function (owner, s, t, dmg) { var v = o.apply(this, arguments); try { if (v > 0) v = panelHit(owner, v); } catch (e) {} try { var k = classPetK(owner && owner.cls); if (k !== 1 && v > 0) v = Math.max(1, Math.floor(v * k)); } catch (e) {} return v; };
    R.companionDamage._afkCls = true;
  };
  try { hookCompanion(); document.addEventListener('DOMContentLoaded', hookCompanion); } catch (e) {}
  if (typeof W.summonDamageMult === 'function') {
    var oSDM = W.summonDamageMult;
    W.summonDamageMult = function (sm, owner) { var v = oSDM.apply(this, arguments); try { var k = classPetK(owner && owner.cls); if (k !== 1) v = v * k; } catch (e) {} return v; };
  }
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var P = function () { return (typeof player !== 'undefined' && player) ? player : null; };
  var tk = function () { return S().ticks || 0; };
  var MS = function () { return (typeof mapState !== 'undefined' && mapState) ? mapState : null; };
  var log = function (h, c) { try { if (!S().ff && typeof logCombat === 'function') logCombat(h, c || 'player-special'); } catch (e) {} };
  var tag = function (n, c) { return '<span class="font-bold" style="color:' + (c || '#f0abfc') + ';text-shadow:0 0 6px ' + (c || '#a21caf') + '">【' + n + '】</span>'; };
  var nm = function (p) { return p === P() ? '你' : (p._allyName || '傭兵'); };

  // ── 技藝資料 ──
  // 傳說句（玩家 2026-10-23：文字要有意境），顯示在效果說明前面
  var ARTS_LORE = {"r_sword": "亞丁王族代代相傳的劍誓：以血起誓，以血還血。劍刃每飲一次敵人的血，持劍者的意志便更熾烈一分。", "r_rally": "王者振臂一呼，血盟的旗幟便在戰場上揚起，所有同伴的刀鋒都指向同一個方向。", "w_fate": "命運越是將他推向死亡，他的劍便迴響得越響亮。倒下又站起，正是騎士的宿命。", "w_arms": "歷經百戰的騎士，早已把每一種兵器都練成了自己的手臂；連屠龍劍的鋒芒，也在他手中重現。", "m_shilen": "受死亡女神席琳垂青的術士。從冥界召回的僕從早已死過一次，再也不知何謂死亡。", "m_atheist": "不再向殷海薩、也不再向任何神祇祈禱的法師。他只相信自己掌中的魔力——連諸神都得為此付出代價。", "e_einhasad": "受光明女神殷海薩祝福的妖精，跟隨她的屬性精靈化為元素之神。", "e_ruler": "以一己之身統御地、水、火、風的妖精。世界樹下的四大精靈，都聽從她的號令。", "d_time": "沐浴於時之流的暗殺者。你眨一次眼，他的刀已落下兩次。", "d_magic": "以魔力為血的黑暗妖精，每一道咒文都會在回音中再響一次。", "i_sorc": "把幻象磨成利刃的幻術士，真與假的界線在他手中消失。", "i_life": "將傷痛編織成生命的幻術士，越是受傷，越是頑強。", "k_dark": "向闇之龍獻上血肉的龍騎士。血契換來足以焚盡一切的力量，也讓自己的血一點一點流乾。", "k_doom": "捨棄兵刃、只以絕望為武器的龍騎士，在夢的盡頭等著屠龍。", "n_fafurion": "狂戰士的斧刃上沒有退路。他把自己的血也算進了這場殺戮，越痛，砍得越深。", "n_heine": "世代守望海音的戰士，日夜面向深海。他守著這片土地，也等著水龍法利昂浮出海面的那一天。"};
  var ARTS = {
    r_sword:     { cls: 'royal',    n: '血誓王劍',   d: '勇猛意志的發動率提升到 50%（傷害 ×1.5 不變），發動時同時施放吸血鬼之吻（效果 ×2）。一般攻擊吸取 30% 傷害轉為 HP；一般攻擊追加 1 次。' },
    r_rally:     { cls: 'royal',    n: '王者號令',   d: '你每次一般攻擊，自己追加 1 次，寵物與召喚物各追加 1 次攻擊。號令之下，全隊（玩家、傭兵、寵物、召喚物、護衛）受到的物理傷害 −50%（可與聖結界疊加，合計上限 75%，屬性傷害不算）。發號令的王者本人在所有減傷算完後再 −50%。' },
    w_fate:      { cls: 'knight',   n: '命運迴響',   d: '造成的傷害 ×4.5。所有回復 +100%、HP 自然恢復 ×10 且每 4 秒一次、HP +5000、傷害減免 +50、五種屬性抗性 +200；每 5 秒一次，受到的傷害減半（真傷、物理、魔法、屬性都算）。HP<50% 觸發不屈命運：HP 全滿、效果 ×2；HP<30% 觸發絕望身軀：HP 全滿、效果 ×3，並獲得每場戰鬥一次的免死。騎士挺身在前：敵人優先攻擊你，你額外減傷 10%，之後再扣 500 點最終減傷（真實減傷）。身為傭兵時，代為承受其他傭兵受到的攻擊與魔法傷害 50%（王的 10% 真實傷害不轉；最多扛到自己剩 1 HP）。領域：對頭目的傷害 +10%。' },
    w_arms:      { cls: 'knight',   n: '萬兵之道',   d: '造成的傷害 ×3.5。百戰之軀：受到的傷害 −30%，一般攻擊造成傷害的 5% 轉為 HP。破甲：無視目標的硬皮。龍的一擊（屠龍劍的力量）：一般攻擊 80% 機率對全場敵人造成 3D(力量)+30 必中固定傷害。粉身碎骨：目標沒有硬皮時，重擊傷害 ×2。致命創傷：命中後目標 5 秒內受到的物理傷害 +20%；近距離命中 +50。首擊：對每個敵人的第一擊，武器骰改用最大值 ×10（跟神話變身的首擊加成各算各的）；穿雙子座聖衣時，首擊變成前五擊傷害 ×30；穿金牛座聖衣 AC −100、魔防 +100、五屬性抗性 +100、傷害減免 +10。領域：一般攻擊傷害 +15%。' },
    m_shilen:    { cls: 'mage',     n: '席琳眷屬',   d: '召喚術數量上限 20；寵物與召喚物的命中、魔防、每次攻擊的傷害、每次受擊的減免都 +(WIS+INT)×0.8，而且不會死亡（HP 最低 1）。召滿 20 隻時融合成一隻融合魔獸（傷害 ×4.5），每 3 秒隨機施放雷霆風暴／龍捲風／極光雷電／燃燒的火球（傷害照法師魔法計算）。領域：在席琳夢域鏡造成的傷害 +15%；寵物與召喚物的傷害 +15%。' },
    m_atheist:   { cls: 'mage',     n: '背神者',   d: '背神狀態中：魔法傷害 +50、魔法命中 +100，每 5 秒自動施放一次屬性魔法武器效果（四屬性輪流，威力 ×2，不耗 MP；傭兵 10 秒一次、效果 ×0.8）。進入戰鬥 1 分鐘時否定諸神：所有敵人扣最大 HP 20%（死亡女神席琳只扣 5%），之後陷入虛弱（回到一般狀態、可以攻擊），5 分鐘後再次進入背神狀態。領域：魔法傷害 +30%；自己施放時 MP 消耗 +50%，範圍攻擊魔法沒有 3 秒冷卻。' },
    e_einhasad:  { cls: 'elf',      n: '殷海薩眷屬', d: '寵物、召喚物與屬性精靈的命中、魔防、每次攻擊的傷害、每次受擊的減免都 +(WIS+INT)×1.2，而且不會死亡（HP 最低 1）；屬性精靈化為元素神：傷害與 HP ×5。殷海薩的光芒：一般攻擊傷害 ×7。領域：寵物與召喚物的傷害 +25%。' },
    e_ruler:     { cls: 'elf',      n: '四元素主宰',     d: '自動學會四種屬性的精靈魔法（換掉這門技藝也不會遺忘，只是不同屬性的不能施放）；四元素融合：全部精靈魔法增益加總 ×3 常駐。HP<50% 觸發不屈命運（HP 全滿）。面板能力 +50、近／遠／魔法爆擊 +15%；每次一般攻擊以近戰＋遠攻＋魔法三種一起計算，再受四元素加持（傷害 ×8）。' },
    d_time:      { cls: 'dark',     n: '時流暗殺者',     d: '會心一擊的 HP／MP 消耗減半；一般攻擊再多算 1.6 倍必定爆擊的傷害（傷害 ×2.6）。爆擊傷害 +50%、近距離爆擊率 +50%。HP<30% 觸發絕望身軀（HP 全滿）。一般攻擊造成傷害的 1% 轉為 HP。' },
    d_magic:     { cls: 'dark',     n: '魔血咒者',     d: '學會十階魔法；施放攻擊魔法後，咒文的回音會免費再施放一次，每次額外 +(WIS+INT)×1.5 傷害。MP 自然恢復 ×6、MP 恢復 +50、MP +500；黑暗妖精魔法 MP 消耗減半。HP<30% 時自動施放一輪四屬性五階五星魔法（每場戰鬥一次）。魔血護身：造成的傷害 +250%、受到的傷害 −20%，造成傷害的 5% 轉為 HP。' },
    i_sorc:      { cls: 'illusion', n: '幻刃術士',     d: '所有傷害 ×4.5；攻擊速度提升到每秒 2 次。幻象替身：受到的傷害 −15%，造成傷害的 2% 轉為 HP。領域：自己以外的隊友、寵物、守護者受到的傷害 −10%。' },
    i_life:      { cls: 'illusion', n: '織命術士',     d: '受到傷害的 50% 轉為治療（等於只受一半傷害）；治療減益效果減半，汙濁之水完全無效。生命之線：所有傷害 ×4.5，造成傷害的 2% 轉為 HP。領域：受到的治療、對隊友施放的治療 +25%。' },
    k_dark:      { cls: 'dragon',   n: '闇龍血契', d: '所有傷害 ×4，對四大龍再 +50%。血契的代價：每秒損失 100 HP（真實傷害，不會因此死亡）、受到的治療 −50%、四屬性抗性 −50。' },
    k_doom:      { cls: 'dragon',   n: '絕望屠龍者', d: '所有傷害 +30%。不能裝備武器。每秒攻擊一次，每一擊傷害 ×10；每次攻擊附加四屬性真實傷害各 100（對四大龍 1000）。吸血 100%、受到的治療 +500%、HP −1000。HP<50% 不屈命運：屬性傷害變 200；HP<30% 絕望身軀：變 500。暗夢星迴（單人）中效果 ×2、減傷 50%，不屈命運時四屬性抗性 +100、絕望身軀時 +200。' },
    n_fafurion:  { cls: 'warrior',   n: '血怒狂斧',   d: '狂戰士之道：整體基礎傷害 +50%；面板的近／遠距離與魔法的傷害、命中、額外傷害、額外命中都 ×1.5，近距離爆擊傷害 +100%（近距離爆擊率不變）；五種屬性抗性 +100、魔防 +100，但 AC +200（變差）。裝備斧系（鈍器）武器時，一般攻擊在左右手各一擊之外再追加一輪左右手（第二輪傷害 70%）。一般攻擊造成傷害的 5% 吸血。戰鬥開始後陷入「王的狂暴」：傷害、近距離命中 +20%，但每 10 秒失去最大 HP 20%（最低剩 1）；HP 自然恢復與喝藥水完全無效（吸血、別人的治療魔法照常）。' },
    n_heine:     { cls: 'warrior',   n: '海音守望者', d: '在海音地區：一般攻擊 50% 機率即死（頭目也算）、傷害 +100%、追加 1 次攻擊；HP 自然恢復 ×5、AC −1000、魔防 +1000。對法利昂：每秒攻擊一次、每一擊傷害 ×10、追加 5 次攻擊；吸血 30% 治療全隊（5 秒一次）；受到法利昂的傷害 −90%。敵人優先攻擊你，你額外減傷 10%。' }
  };
  var SAVES = { w_fate: { fate: 1, desp: 1 }, e_ruler: { fate: 1 }, d_time: { desp: 1 }, k_doom: { fate: 1, desp: 1 } };
  var ATTR5 = [['sk_meteor'], ['sk_fire_storm', 'sk_blizzard'], ['sk_thunder_storm', 'sk_tornado'], ['sk_earthquake', 'sk_blaze']];
  var FUSE_SK = ['sk_thunder_storm', 'sk_tornado', 'sk_aurora', 'sk_fireball'];

  var rawArt = function (p) { if (!p || !(p.rebirth > 0)) return null; var a = p.rebirthArt; return (a && ARTS[a] && ARTS[a].cls === p.cls) ? a : null; };
  // 同一門技藝全隊最多 ART_CAP 人生效（玩家 2026-10-28：不能整隊疊同一門強勢技藝）；順序：你 → 傭兵（招募順序）
  var ART_CAP = 4, capT = -1, capOk = null, capSeen = null, capMe = null;
  var artAllowed = function (p) {
    if (recompAlly() && capOk) return capOk.has(p) || !capSeen.has(p);   // 重算傭兵能力時 player 會暫時換成那名傭兵，沿用隊長視角的結果
    var me = P(); if (!me) return true;
    var party = [me].concat(me.allies || []);
    var t = tk();
    if (t !== capT || !capOk || capMe !== me || capSeen.size !== party.length || (!capSeen.has(p) && party.indexOf(p) >= 0)) {
      capT = t; capMe = me; capOk = new Set(); capSeen = new Set(party); var n = {};
      party.forEach(function (x) { var a = x && rawArt(x); if (!a) return; n[a] = (n[a] || 0) + 1; if (n[a] <= ART_CAP) capOk.add(x); });
    }
    if (capOk.has(p)) return true;
    return !capSeen.has(p);   // 不在隊伍裡（例如招募前的預覽）不受限
  };
  var art = function (p) { var a = rawArt(p); return a && artAllowed(p) ? a : null; };
  var recompAlly = function () { return typeof _recomputingAlly !== 'undefined' && _recomputingAlly; };
  var isAllyObj = function (p) { return !!p && (p._slot !== undefined || (p === P() && recompAlly())); };
  var partyN = 1;
  // 2026-11-02 02:56（玩家）：16 人時傭兵技藝減半拿掉，改成「同一門技藝的人數懲罰」（見 artPen）；F 保留給其他地方用，固定 1
  var F = function (p) { return 1; };
  // 同一門技藝的人數懲罰（只扣技藝的傷害倍率）：同一門 2 人以內不扣；第 3 人起這門技藝的人全部 −15%；第 4 人起再 −20%（合計 −35%）；16 人滿隊時加倍（−30%／−70%）
  var PEN3 = 0.15, PEN4 = 0.20;
  var artPen = function (p) {
    var a = art(p); if (!a) return 0;
    var me = P(); if (!me) return 0;
    var n = [me].concat(me.allies || []).filter(function (x) { return x && art(x) === a; }).length;
    var pen = (n >= 3 ? PEN3 : 0) + (n >= 4 ? PEN4 : 0);
    if (partyN >= 16) pen *= 2;
    return Math.min(0.9, pen);
  };
  var hpOf = function (p) { return p === P() && !recompAlly() ? p.hp : p.curHp; };
  var setHp = function (p, v) { if (p === P() && !recompAlly()) p.hp = v; else p.curHp = v; };
  var heal = function (p, v) { if (!(v > 0) || !p) return; var h = hpOf(p) || 0; setHp(p, Math.min(p.mhp || h, h + Math.floor(v))); };
  var dreamOn = function () { try { return !!(window.__afkDreamStar && window.__afkDreamStar.on()); } catch (e) { return false; } };
  var inHeine = function () { try { var m = MS(); return !!(m && typeof mapRegionOf === 'function' && mapRegionOf(m.current) === 'heine'); } catch (e) { return false; } };
  var isFaf = function (m) { return !!m && (/法利昂/.test(m.n || '') || (S().antharas && S()._afkDragon === 'fafurion')); };
  var isDragon = function (m) { return !!m && (/安塔瑞斯|法利昂|巴拉卡斯|林德拜爾/.test(m.n || '') || !!S().antharas); };
  // 兇亂滅斧（玩家 2026-10-26）
  var AXE_TAGS = ['單手鈍器', '雙手鈍器'];
  var axeOf = function (p) { var e = p && p.eq && p.eq.wpn, d = e && DB.items[e.id]; if (!d) return false; var tg = (typeof getWeaponTags === 'function') ? getWeaponTags(e.id) : []; return AXE_TAGS.some(function (x) { return tg.indexOf(x) >= 0; }) || /斧/.test(d.n || ''); };
  var ragey = function (p) { return art(p) === 'n_fafurion' && inBattle(); };
  var leaderReborn = function () { var p = P(); return !!(p && p.rebirth > 0); };
  var kings = function () { if (!leaderReborn()) return 0; return Math.min(5, Math.floor(partyN / 4) + (partyN >= 16 ? 1 : 0)); };
  var aliveAllies = function () { var p = P(); return ((p && p.allies) || []).filter(function (a) { return a && !a._downed && (a.curHp || 0) > 0; }); };
  var anyArt = function (id) { var p = P(); if (!p) return null; if (!p.dead && art(p) === id) return p; return aliveAllies().find(function (a) { return art(a) === id; }) || null; };

  // ── 戰鬥：連續有活怪＝同一場；換地圖或 5 秒沒有怪＝離開戰鬥 ──
  var B = { id: 0, start: 0, last: -1e9, map: null };
  var battleTick = function () {
    var ms = MS(); if (!ms) return;
    var t = tk(), alive = (ms.mobs || []).some(function (m) { return m && !m._dead && m.curHp > 0; });
    if (alive) { if (ms.current !== B.map || t - B.last > 50) { B.id++; B.start = t; B.map = ms.current; } B.last = t; }
  };
  var inBattle = function () { var ms = MS(); return !!ms && tk() - B.last <= 50 && B.map === ms.current; };

  // 每個角色：本場戰鬥狀態（換場重置）＋跨戰鬥狀態
  var ST = new WeakMap();
  var st = function (p) {
    var s = ST.get(p);
    if (!s) { s = { bid: B.id, mode: 1, fate: false, desp: false, imm: false, lowCast: false, shieldAt: -1e9, cdAt: 0, athOff: 0, athSince: null, athFired: false, dreamAt: null, sig: '', lsAt: -1e9 }; ST.set(p, s); }
    if (s.bid !== B.id) { s.bid = B.id; s.mode = 1; s.fate = s.desp = s.imm = s.lowCast = s.athFired = false; s.athSince = null; }
    return s;
  };
  var refresh = function (p) {
    try {
      if (p === P() && !recompAlly()) { if (typeof calcStats === 'function') calcStats(); }
      else if (typeof _allyLevelRecompute === 'function') _allyLevelRecompute(p);
    } catch (e) {}
  };
  var athActive = function (p) { return art(p) === 'm_atheist' && tk() >= st(p).athOff; };
  var doomDead = function () { return false; };   // 玩家 2026-10-27：命定絕望者移除「暗夢星迴戰鬥 5 分鐘後死亡」

  // ── 免死：不屈命運（HP<50%）→ 絕望身軀（HP<30%）→ 命運迴響的每場免死（共用冷卻 30 秒）──
  var trySaves = function (p, lethal) {
    var a = art(p); if (!a) return false;
    if (!lethal && (p._afkSelfCostUntil || 0) > Date.now()) return false;   // 大絕自己扣的 HP 不觸發不屈命運、絕望身軀（真的要死時照常）
    var sv = SAVES[a], s = st(p), hp = hpOf(p) || 0, mx = p.mhp || 1;
    if (sv && sv.fate && !s.fate && hp < mx * 0.5) {
      s.fate = true; s.mode = Math.max(s.mode, 2); refresh(p); setHp(p, p.mhp);
      log(tag('不屈命運', '#fbbf24') + nm(p) + '的命運拒絕在此終結——生命重新灌滿全身。');
      return true;
    }
    if (sv && sv.desp && !s.desp && hp < mx * 0.3) {
      s.desp = true; s.mode = 3; refresh(p); setHp(p, p.mhp);
      log(tag('絕望身軀', '#f87171') + nm(p) + '自絕望的深淵中站起——生命重新灌滿全身。');
      return true;
    }
    if (lethal && a === 'w_fate' && s.desp && !s.imm && tk() >= (s.cdAt || 0)) {
      s.imm = true; s.cdAt = tk() + 300; setHp(p, 1);
      log(tag('命運迴響', '#fbbf24') + nm(p) + '咬牙撐住了致命的一擊。（每場戰鬥一次）');
      return true;
    }
    return false;
  };

  // ── 能力 ──
  var RES4 = ['resFire', 'resWater', 'resWind', 'resEarth'];
  var PANEL = ['meleeDmg', 'meleeHit', 'rangedDmg', 'rangedHit', 'magicDmg', 'magicHit', 'extraMp', 'resFire', 'resWater', 'resWind', 'resEarth', 'mr', 'er'];
  // 只把「原本沒學會」的技能記成授予：核心每次重算會先把授予清單從技能裡移除，
  //   舊寫法把已學會的（例如污濁之水）也記成授予 → 換掉主宰者後那些技能永久消失（玩家 2026-10-25 回報）
  var grant = function (p, ids) { p.grantedSkills = p.grantedSkills || []; p.skills = p.skills || []; ids.forEach(function (k) { if (!DB.skills[k]) return; if (p.skills.indexOf(k) >= 0) return; p.grantedSkills.push(k); p.skills.push(k); }); };
  // 修復：已轉生的妖精，補回自己屬性的精靈魔法（被上面的舊寫法吃掉的技能）
  var ownEleSkills = function (p) { if (!p || p.cls !== 'elf' || !(p.rebirth > 0) || !p.elfEle) return []; return Object.keys(DB.skills).filter(function (k) { var x = DB.skills[k]; return x && x.reqE && x.reqEle === p.elfEle && !x.procOnly; }); };
  var repairEle = function (p) { try { p.skills = p.skills || []; ownEleSkills(p).forEach(function (k) { if (p.skills.indexOf(k) < 0 && (p.grantedSkills || []).indexOf(k) < 0) p.skills.push(k); }); } catch (e) {} };
  if (typeof window.buildAlly === 'function') { var oBA = window.buildAlly; window.buildAlly = function () { var a = oBA.apply(this, arguments); if (a) repairEle(a); return a; }; }
  var elfEleSkills = null, elfFuse = null, mage10 = null;
  var scanSkills = function () {
    if (elfEleSkills) return;
    elfEleSkills = []; elfFuse = {}; mage10 = [];
    Object.keys(DB.skills).forEach(function (k) {
      var s = DB.skills[k]; if (!s) return;
      if (s.reqE && s.reqEle) { elfEleSkills.push(k); if (s.type === 'buff' && s.d) for (var f in s.d) if (typeof s.d[f] === 'number') elfFuse[f] = (elfFuse[f] || 0) + s.d[f] * 3; }
      if (s.reqM && s.tier === 10) mage10.push(k);
    });
  };
  var add = function (d, k, v) { d[k] = (Number(d[k]) || 0) + v; };
  var oRe = window.recomputeStats;
  window.recomputeStats = function () {
    var r = oRe.apply(this, arguments);
    try {
      var p = P(); if (p && !p._afkEleRepair1 && p.cls === 'elf' && p.rebirth > 0 && p.elfEle) { p._afkEleRepair1 = true; repairEle(p); }
      // 主宰者學過的全屬性魔法永久留在技能表（玩家 2026-10-25）：換掉主宰者後不會遺忘，只是屬性不符時不能施放（核心的屬性檢查會把它反灰）
      if (p && Array.isArray(p._afkRulerLearned)) { p.skills = p.skills || []; p._afkRulerLearned.forEach(function (k) { if (DB.skills[k] && p.skills.indexOf(k) < 0) p.skills.push(k); }); }
      var a = art(p); if (!a || !p.d) return r;
      var d = p.d, f = F(p), s = st(p);
      if (a === 'm_atheist' && typeof d.getMpCost === 'function' && !d.getMpCost._afkAth) {   // 背神者：MP 消耗 +50%（2026-11-02）
        var oG = d.getMpCost; d.getMpCost = function () { var c = oG.apply(this, arguments); return c > 0 ? Math.ceil(c * (1 + DOMAIN.athMp * F(P()))) : c; }; d.getMpCost._afkAth = true;
      }
      if (a === 'w_arms') add(d, 'meleeHit', 50 * f);
      else if (a === 'w_fate') {   // 命運迴響（玩家 2026-10-22）：HP 自然恢復每 4 秒一次、減傷 +50、五種屬性抗性 +200
        d.hpRegenFaster = Math.max(Number(d.hpRegenFaster) || 0, 12);
        add(d, 'dr', 50 * f); RES4.concat(['resNone']).forEach(function (k) { add(d, k, 200 * f); });
      }
      else if (a === 'm_atheist' && athActive(p)) { add(d, 'magicDmg', W.__afkArtTune.athMag * f); add(d, 'magicHit', 100 * f); }
      else if (a === 'e_ruler') {
        scanSkills();
        p._afkRulerLearned = p._afkRulerLearned || [];
        p.grantedSkills = p.grantedSkills || []; p.skills = p.skills || [];
        elfEleSkills.forEach(function (k) {
          if (!DB.skills[k] || DB.skills[k].procOnly) return;
          if (p._afkRulerLearned.indexOf(k) < 0) p._afkRulerLearned.push(k);
          if (p.skills.indexOf(k) < 0) p.skills.push(k);
          if (p.grantedSkills.indexOf(k) < 0) p.grantedSkills.push(k);   // 主宰者期間：不論屬性都能施放
        });
        PANEL.forEach(function (k) { add(d, k, 50 * f); });
        ['meleeCrit', 'rangedCrit', 'magicCrit'].forEach(function (k) { add(d, k, 15 * f); });
        for (var k in elfFuse) add(d, k, Math.round(elfFuse[k] * f));
      }
      else if (a === 'd_time') { add(d, 'meleeCrit', 50 * f); add(d, 'meleeCritDmg', 50 * f); add(d, 'rangedCritDmg', 50 * f); }
      else if (a === 'd_magic') { scanSkills(); grant(p, mage10); add(d, 'mpR', 50 * f); }
      else if (a === 'k_dark') RES4.forEach(function (k) { add(d, k, -50 * f); });
      else if (a === 'k_doom') {
        if (dreamOn()) { var rb = (s.fate ? 100 : 0) + (s.desp ? 200 : 0); if (rb) RES4.forEach(function (k) { add(d, k, rb * f); }); }
      }
      else if (a === 'n_heine' && inHeine()) { add(d, 'ac', -1000 * f); add(d, 'mr', 1000 * f); }
      else if (a === 'n_fafurion') {   // 兇亂滅斧：面板 ×2（近距離爆擊率不變），爆傷 +100%，抗性 +100、MR +100、AC +200
        ['meleeDmg', 'meleeHit', 'rangedDmg', 'rangedHit', 'magicDmg', 'magicHit', 'extraDmg', 'extraHit'].forEach(function (k) { var v = Number(d[k]) || 0; if (v > 0) d[k] = Math.round(v * (1 + W.__afkArtTune.fafPanel * f)); });
        add(d, 'meleeCritDmg', 100 * f);
        RES4.concat(['resNone']).forEach(function (k) { add(d, k, 100 * f); });
        add(d, 'mr', 100 * f); add(d, 'ac', 200);
        if (ragey(p)) { var mh = Number(d.meleeHit) || 0; if (mh > 0) d.meleeHit = Math.round(mh * (1 + 0.2 * f)); }   // 王的狂暴：近距離命中 +20%
      }
    } catch (e) {}
    return r;
  };
  // HP／MP 上限加成：走核心補丁 29（夾 HP 之前加進上限）
  if (window.__afkMaxAdd && window.__afkMaxAdd.add) window.__afkMaxAdd.add(function (p) {
    var a = art(p); if (!a) return;
    var f = F(p), s = st(p);
    if (a === 'w_fate') p.mhp = (p.mhp || 0) + Math.round(5000 * s.mode * f);
    else if (a === 'd_magic') p.mmp = (p.mmp || 0) + Math.round(500 * f);
    else if (a === 'k_doom') p.mhp = Math.max(1, (p.mhp || 0) - 1000);
  });
  // 狀態改變（命運階段、無神狀態、進出海音、暗夢星迴、16 人）→ 重算
  var sigOf = function (p) { var s = st(p); return [s.mode, s.fate, s.desp, athActive(p), inHeine(), dreamOn(), partyN >= 16, ragey(p)].join(); };

  // ── 治療倍率 ──
  var healMult = function (p, regen) {
    var a = art(p); if (!a) return 1;
    var f = F(p), s = st(p);
    if (a === 'w_fate') return 1 + (regen ? 9 : 1) * s.mode * f;   // 自然恢復 ×10（不屈／絕望再 ×2／×3），其他回復 +100%
    if (a === 'k_doom') return 1 + 5 * f;
    if (a === 'k_dark') return 1 - 0.5 * f;
    if (a === 'n_heine' && regen && inHeine()) return 1 + 4 * f;
    if (a === 'n_fafurion' && regen) return 0;   // 兇亂滅斧：沒有 HP 自然恢復
    if (a === 'i_life' && !regen) return 1 + DOMAIN.life * f;   // 織命術士：受到的治療 +25%（2026-11-02）
    return 1;
  };
  if (typeof window.rollHealingSpell === 'function') {
    var oRoll = window.rollHealingSpell;
    window.rollHealingSpell = function (sk, dS, caster, target) { var v = oRoll.apply(this, arguments); try { if (v > 0) { var m = healMult(target, false); if (caster && caster !== target && art(caster) === 'i_life') m *= 1 + DOMAIN.life * F(caster); if (m !== 1) v = Math.floor(v * m); } } catch (e) {} return v; };
  }
  if (typeof window.foulWaterHealMult === 'function') {
    var oFw = window.foulWaterHealMult;
    window.foulWaterHealMult = function (t) {
      var m = oFw.apply(this, arguments);
      try {
        if (m < 1 && art(t) === 'i_life') {
          var stt = (t === P()) ? t.statuses : (t.statuses || t._statuses);
          if (stt && (stt.foulWater || 0) > 0) m = m / 0.5;   // 汙濁之水無效
          m = 1 - (1 - Math.min(1, m)) * (1 - 0.5 * F(t));    // 其他治療減益減半
        }
      } catch (e) {}
      return m;
    };
  }
  var potLogAt = -1e9;
  var potNote = function (p) { if (tk() - potLogAt < 300) return; potLogAt = tk(); log(tag('血怒狂斧', '#ef4444') + nm(p) + '的血在沸騰，藥水灌下去也毫無作用。', 'enemy'); };
  // 自然恢復掛點（遺物同伴模組；玩家、傭兵共用）：兇亂滅斧不回血
  var hookRegen = function () {
    var R = window.AFK_RELIC_COMPANIONS; if (!R || typeof R.regenAmount !== 'function' || R._afkArtsRegen) return;
    var o = R.regenAmount; R._afkArtsRegen = true;
    R.regenAmount = function (owner, value, kind) { if (kind === 'hp' && art(owner) === 'n_fafurion') return 0; return o.apply(this, arguments); };
  };
  hookRegen(); window.addEventListener('load', hookRegen);
  var HEAL_POT = function (id) { return !!id && (id.indexOf('potion_heal') >= 0 || id === 'potion_strong' || id === 'potion_ult' || id === 'new_item_141'); };
  if (typeof window.useItem === 'function') {
    var oUse = window.useItem;
    window.useItem = function (u) {
      var p = P(); if (!p || !art(p)) return oUse.apply(this, arguments);
      var it = (p.inv || []).find(function (i) { return i.uid === u; });
      if (!it || !HEAL_POT(it.id)) return oUse.apply(this, arguments);
      if (art(p) === 'n_fafurion') { potNote(p); return; }   // 兇亂滅斧：藥水無效（不消耗）
      var h0 = p.hp, r = oUse.apply(this, arguments), g = p.hp - h0;
      try { if (g > 0) { var m = healMult(p, false); if (m !== 1) p.hp = Math.max(1, Math.min(p.mhp, h0 + Math.floor(g * m))); } } catch (e) {}
      return r;
    };
  }
  if (typeof window.allyTryPotion === 'function') {
    var oAp = window.allyTryPotion;
    window.allyTryPotion = function (ally) {
      if (!art(ally)) return oAp.apply(this, arguments);
      if (art(ally) === 'n_fafurion') return;   // 兇亂滅斧：藥水無效（不喝）
      var h0 = ally.curHp, r = oAp.apply(this, arguments), g = (ally.curHp || 0) - h0;
      try { if (g > 0) { var m = healMult(ally, false); if (m !== 1) ally.curHp = Math.max(1, Math.min(ally.mhp, h0 + Math.floor(g * m))); } } catch (e) {}
      return r;
    };
  }
  if (typeof window._regenHP === 'function') {
    var oRH = window._regenHP;
    window._regenHP = function () {
      var p = P(); if (!p || !art(p)) return oRH.apply(this, arguments);
      var h0 = p.hp, r = oRH.apply(this, arguments), g = p.hp - h0;
      try { if (g > 0) { var m = healMult(p, true); if (m !== 1) p.hp = Math.max(1, Math.min(p.mhp, h0 + Math.floor(g * m))); } } catch (e) {}
      return r;
    };
  }
  if (typeof window._regenMP === 'function') {
    var oRM = window._regenMP;
    window._regenMP = function () {
      var p = P(); if (!p || art(p) !== 'd_magic') return oRM.apply(this, arguments);
      var m0 = p.mp, r = oRM.apply(this, arguments), g = p.mp - m0;
      try { if (g > 0) p.mp = Math.min(p.mmp, m0 + Math.floor(g * (1 + 5 * F(p)))); } catch (e) {}
      return r;
    };
  }

  // ── 受到傷害：前後 HP 差補算減傷 ──
  var active = false;   // 隊伍裡有人學了技藝、或四大天王生效
  var dmgDepth = 0, pendingKill = false;
  var partySnap = function () {
    var out = [], p = P();
    out.push([p, p.hp, 'player']);
    (p.allies || []).forEach(function (a) { if (a && !a._downed) out.push([a, a.curHp, 'ally']); });
    try { (typeof petsOutList === 'function' ? petsOutList() : []).forEach(function (x) { if (x && !x._downed) out.push([x, x.hp, 'pet']); }); } catch (e) {}
    try { (p.summonsV2 || []).forEach(function (x) { if (x && !x._downed) out.push([x, x.hp, 'summon']); }); } catch (e) {}
    try { (p.allies || []).forEach(function (a) { var x = a && !a._downed && a.summon; if (x && (x.mhp || 0) > 0 && !x._downed && (x.hp || 0) > 0 && minionArtOf(a)) out.push([x, x.hp, 'summon', a]); }); } catch (e) {}
    try { (typeof guardAliveList === 'function' ? guardAliveList() : []).forEach(function (x) { out.push([x, x.hp, 'guard']); }); } catch (e) {}
    return out;
  };
  // 席琳／殷海薩眷屬：看「召喚物的主人」學的技藝（玩家 2026-10-25：傭兵的眷屬原本完全沒有效果）
  var minionArtOf = function (owner) { var a = art(owner); return (a === 'm_shilen' || a === 'e_einhasad') ? a : null; };
  var minionBonusOf = function (owner) { var d = (owner && owner.d) || {}; return Math.floor(((Number(d.wis) || 0) + (Number(d.int) || 0)) * (art(owner) === 'm_shilen' ? W.__afkArtTune.minionMage : 1.2) * F(owner)); };
  var minionGuard = function () { return minionArtOf(P()); };
  var minionBonus = function () { return minionBonusOf(P()); };
  var takenMult = function (ent, et, mob, kind) {
    var m = 1, rally = anyArt('r_rally'), sorc = anyArt('i_sorc');
    if (rally && kind === 'phys') m *= 1 - 0.5 * F(rally);
    if (sorc && sorc !== ent) m *= 1 - DOMAIN.sorcAura * F(sorc);   // 幻刃術士：自己以外的隊友、寵物、守護者受到的傷害 −10%
    if (et !== 'player' && et !== 'ally') return m;
    var a = art(ent); if (!a) return m;
    var f = F(ent);
    if (a === 'r_rally') m *= 1 - 0.5 * f;
    if (a === 'w_fate' || a === 'n_heine') m *= 1 - 0.1 * f;
    if (a === 'w_fate') { var s = st(ent); if (tk() - s.shieldAt >= 50 / s.mode) { s.shieldAt = tk(); m *= 1 - 0.5 * f; } }
    if (a === 'i_life') m *= 1 - 0.5 * f;
    if (a === 'w_arms') m *= 1 - W.__afkArtTune.armsDr * f;
    if (a === 'd_time') m *= 1 - W.__afkArtTune.timeDr * f;
    if (a === 'd_magic') m *= 1 - W.__afkArtTune.darkDr * f;
    if (a === 'i_sorc') m *= 1 - W.__afkArtTune.sorcDr * f;
    if (a === 'n_heine' && isFaf(mob)) m *= 1 - 0.9 * f;
    if (a === 'k_doom' && dreamOn()) m *= 1 - 0.5 * f;
    return m;
  };
  // 最終減傷（玩家 2026-10-23）：公式減傷、聖結界、傷害減免、技藝減傷都算完，最後被打的數值再扣（真實減傷）
  //   來源：輪迴聖衣（afk-card-combat）、命運迴響精通 500
  var finalDR = function (ent, et) {
    if (et !== 'player' && et !== 'ally') return 0;
    var v = 0, C = window.AFK_CARD_COMBAT;
    try { if (C && C.finalDR) v += C.finalDR(ent) || 0; } catch (e) {}
    if (art(ent) === 'w_fate') v += Math.round(500 * F(ent));
    return v;
  };
  var finalOn = function () { var p = P(); if (!p) return false; if (finalDR(p, 'player') > 0) return true; return (p.allies || []).some(function (a) { return a && finalDR(a, 'ally') > 0; }); };
  // 2026-10-26 核心補丁 46：玩家、傭兵受到的一般攻擊與魔法，在扣血「之前」就套技藝減傷、白羊座抵銷、最終減傷（不再事後補血）
  // pre＝受傷掛點其他來源的減傷倍率（夢域遺骸、龍的傷痕、席琳模式…）；2026-10-29：所有百分比減傷相乘後最多減 75%（倍率不低於 0.25），之後才扣最終減傷（可扣到 0）
  var DR_FLOOR = 0.25;
  window.__afkArtsTaken = function (e, dmg, mob, kind, pre) {
    if (!(dmg > 0) || !P()) return dmg;
    var et = e === P() ? 'player' : 'ally';
    var C = window.AFK_CARD_COMBAT;
    if (C && C.finalBlock && C.finalBlock(e)) return 0;   // 白羊座：完全抵銷
    var mult = (pre == null ? 1 : pre) * (active ? takenMult(e, et, mob, kind === 'magic' ? 'magic' : 'phys') : 1);
    if (mult < DR_FLOOR) mult = DR_FLOOR;
    var v = dmg * mult;
    var fdr = finalDR(e, et); if (fdr > 0) v -= Math.min(v, fdr);
    if (v < dmg && art(e) === 'i_life' && Math.random() < 0.1) log(tag('織命術士', '#a78bfa') + nm(e) + '把傷害化為生命之力。', 'heal');
    if (et === 'ally' && v > 0) v -= fateShare(e, v);
    return v;
  };
  // 命運迴響（傭兵）代為承受（玩家 2026-10-26）：其他傭兵受到的一般攻擊／魔法傷害，50% 改由這位騎士承受。
  //   只轉移敵人攻擊與魔法（走受傷掛點的傷害）；王的 10% 真實傷害、地形與詛咒等直接扣血都不轉。
  //   騎士本身有 10% 減傷；騎士最多扣到剩 1 HP，扛不下的部分留在原本的傭兵身上。
  var lastShareLog = -1e9;
  var fateShare = function (e, v) {
    var g = null;
    aliveAllies().forEach(function (a) { if (a !== e && art(a) === 'w_fate' && (!g || (a.curHp || 0) > (g.curHp || 0))) g = a; });
    if (!g) return 0;
    var part = Math.floor(v * 0.5), cost = Math.ceil(part * 0.9), room = Math.max(0, (g.curHp || 0) - 1);
    if (cost > room) { part = Math.floor(room / 0.9); cost = Math.min(room, Math.ceil(part * 0.9)); }
    if (!(part > 0)) return 0;
    g.curHp -= cost;
    if (tk() - lastShareLog >= 100) { lastShareLog = tk(); log(tag('命運迴響', '#fbbf24') + nm(g) + '替' + nm(e) + '擋下了 ' + part + ' 點傷害。'); }
    return part;
  };
  var PRE = { enemyPhysicalAttack: 1, enemyAttackAlly: 1, applyMobMagic: 1, applyMobMagicToAlly: 1 };
  var afterTaken = function (snap, mob, kind, pre) {
    var p = P();
    snap.forEach(function (row) {
      var e = row[0], h0 = row[1], et = row[2], own = row[3] || p, g = minionArtOf(own), gb = g ? minionBonusOf(own) : 0;
      var hNow = et === 'player' ? e.hp : (et === 'ally' ? e.curHp : e.hp);
      var lost = (h0 || 0) - (hNow || 0); if (!(lost > 0)) return;
      var hooked = pre && (et === 'player' || et === 'ally');   // 已在扣血前處理過
      var mult = (active && !hooked) ? takenMult(e, et, mob, kind) : 1, back = Math.floor(lost * (1 - mult));
      var C = window.AFK_CARD_COMBAT;
      if (hooked) {}
      else if (C && C.finalBlock && (et === 'player' || et === 'ally') && C.finalBlock(e)) back = lost;   // 白羊座：完全抵銷
      else { var fdr = finalDR(e, et); if (fdr > 0) back += Math.min(lost - back, fdr); }
      if ((et === 'pet' || et === 'summon') && g) back += Math.min(lost - back, gb);
      if (back > 0) {
        if (et === 'player') e.hp += back;
        else if (et === 'ally') { e.curHp += back; if (e.curHp > 0 && e._downed) { e._downed = false; e._reviveCd = 0; } }
        else { e.hp += back; if (e.hp > 0 && e._downed) { e._downed = false; e._reviveCd = 0; delete e._diedAt; } }
        if (art(e) === 'i_life' && Math.random() < 0.1) log(tag('織命術士', '#a78bfa') + nm(e) + '把傷害化為生命之力。', 'heal');
      }
      if ((et === 'pet' || et === 'summon') && g && (e.hp || 0) <= 0) { e.hp = 1; e._downed = false; e._reviveCd = 0; delete e._diedAt; }
      if (et === 'ally') {
        if ((e.curHp || 0) <= 0) { if (trySaves(e, true)) { e._downed = false; e._reviveCd = 0; if (e.curHp <= 0) e.curHp = 1; } }
        else trySaves(e, false);
      }
    });
    if (p.hp > 0) { pendingKill = false; if (!p.dead) trySaves(p, false); }
    else if (pendingKill) { pendingKill = false; window.killPlayer(); }
  };
  var wrapTaken = function (name, kind) {
    var o = window[name]; if (typeof o !== 'function') return;
    window[name] = function (mob) {
      if (dmgDepth > 0 || !P() || !(active || finalOn())) return o.apply(this, arguments);
      var snap = partySnap(), r; dmgDepth++; pendingKill = false;
      try { r = o.apply(this, arguments); }
      finally { dmgDepth--; try { afterTaken(snap, mob, kind, !!(PRE[name] && window.__afkTakenPatched)); } catch (e) { if (pendingKill) { pendingKill = false; window.killPlayer(); } } }
      return r;
    };
  };
  [['enemyPhysicalAttack', 'phys'], ['enemyAttackAlly', 'phys'], ['enemyAttackPet', 'phys'], ['enemyAttackSummon', 'phys'], ['enemyAttackGuard', 'phys'],
   ['applyMobMagic', 'magic'], ['applyMobMagicToAlly', 'magic'], ['applyMobMagicToPet', 'magic'], ['applyMobMagicToSummon', 'magic'], ['applyMobMagicToGuard', 'magic']]
    .forEach(function (x) { wrapTaken(x[0], x[1]); });
  // 血壁空間／反擊屏障的反彈傷害也是「受到的傷害」：一樣吃技藝減傷（呼喊夥伴的物理 −50% 等）與最終減傷（玩家 2026-10-24：王族呼喊夥伴打林德拜爾被反彈秒殺）
  if (typeof window.reflectWallOnDamage === 'function') {
    var oRefl = window.reflectWallOnDamage;
    window.reflectWallOnDamage = function (mob, dmg, kind) {
      if (dmgDepth > 0 || !P() || !(active || finalOn())) return oRefl.apply(this, arguments);
      var snap = partySnap(), r; dmgDepth++; pendingKill = false;
      try { r = oRefl.apply(this, arguments); }
      finally { dmgDepth--; try { afterTaken(snap, mob, kind === 'magic' ? 'magic' : 'phys'); } catch (e) { if (pendingKill) { pendingKill = false; window.killPlayer(); } } }
      return r;
    };
  }

  if (typeof window.killPlayer === 'function') {
    var oKill = window.killPlayer;
    window.killPlayer = function () {
      try {
        var p = P();
        if (p && !p.dead) {
          if (dmgDepth > 0 && (active || finalOn())) { pendingKill = true; return; }   // 等減傷補算完再決定
          if (art(p)) {
            if (doomDead(p)) { p.hp = 1; return; }                       // 命定絕望者：暗夢星迴 5 分鐘後鎖 1 HP
            if (trySaves(p, true) && p.hp > 0) return;
          }
        }
      } catch (e) {}
      return oKill.apply(this, arguments);
    };
  }

  // 嘲諷：命運迴響／海音守護者是敵人優先攻擊的目標
  if (typeof window.ironGuardTauntTarget === 'function') {
    var oTaunt = window.ironGuardTauntTarget;
    window.ironGuardTauntTarget = function (m) {
      var r = oTaunt.apply(this, arguments);
      if (r || !active) return r;
      try {
        var p = P(), c = [];
        if (!p.dead && p.hp > 0 && (art(p) === 'w_fate' || art(p) === 'n_heine')) c.push(p);
        aliveAllies().forEach(function (a) { var x = art(a); if (x === 'w_fate' || x === 'n_heine') c.push(a); });
        if (c.length) return c[Math.floor(Math.random() * c.length)];
      } catch (e) {}
      return r;
    };
  }

  // ── 造成傷害：前後怪物 HP 差補算 ──
  var outDepth = 0, CTX = null;
  var mobSnap = function () { var ms = MS(); return ((ms && ms.mobs) || []).filter(function (m) { return m && !m._dead && m.curHp > 0; }).map(function (m) { return [m, m.curHp]; }); };
  var reap = function () {
    var ms = MS(); if (!ms || typeof killMob !== 'function') return;
    ms.mobs.filter(function (m) { return m && m.curHp <= 0 && !m._dead; }).map(function (m) { return m.uid; }).forEach(function (uid) {
      var i = ms.mobs.findIndex(function (m) { return m && m.uid === uid && m.curHp <= 0 && !m._dead; });
      if (i !== -1) { try { killMob(i); } catch (e) {} }
    });
  };
  var hurtMob = function (m, v, owner) { if (!(v > 0) || !m || m._dead) return; var amount=Math.floor(v);if(window.AFK_CARD_COMBAT)amount=window.AFK_CARD_COMBAT.damage(owner||window.AFK_CARD_COMBAT.currentActor(),m,amount,{kind:'true'});m.curHp -= amount; /* card-combat:arts-settle */ m.justHit = 'magic'; try { if (typeof mobWake === 'function') mobWake(m); } catch (e) {} };
  var quiet = function (fn) { outDepth++; try { fn(); } catch (e) {} finally { outDepth--; } };
  // 攻速提到 0.1 秒（面板顯示）：實際 1 秒一擊、傷害 ×10
  var fast = function (p, t) {
    var a = art(p);
    if (a === 'k_doom') return { t: 10, mult: (p && p.afkDoomWield && p.eq && p.eq.wpn) ? 5 : 10, show: 1 };   // 屠龍者的劍塚通關後可以拿武器：拿著時 ×5（Ping 11-07）
    if (a === 'n_heine' && isFaf(t || (typeof getTarget === 'function' ? getTarget() : null))) return { t: 10, mult: 10, show: 1 };
    if (a === 'i_sorc') return { t: 5, mult: 1, show: 5, min: true };
    return null;
  };
  var wpnMax = function (p) { var e = p.eq && p.eq.wpn, d = e && DB.items[e.id]; if (!d) return 2; return Math.max(Number(d.dmgS) || 0, Number(d.dmgL) || 0) + (Number(e.en) || 0); };
  var lastLeech = -1e9;
  // ── 技藝的領域強化（玩家 2026-11-02 15:20 定）──
  //   萬兵之道：一般攻擊 +15%；命運迴響：對頭目 +10%；殷海薩眷屬：召喚物與寵物 +25%；
  //   席琳眷屬：在夢域鏡造成的傷害 +15%、召喚物與寵物 +10%；背神者：魔法傷害 +30%（MP 消耗 +50%、範圍魔法 3 秒冷卻取消，只有自己）
  //   織命術士：治療 +25%；幻刃術士：自己以外的隊友、寵物、守護者受到的傷害 −10%
  var mirrorOn = function () { try { return !!(W.__afkDreamHell && W.__afkDreamHell.on()); } catch (e) { return false; } };   // 席琳夢域鏡
  var DOMAIN = W.__afkArtDomain = {
    arms: 0.15, fate: 0.10, ein: 0.25, shilenDream: 0.15, shilenMinion: 0.15, athMag: 0.30, athMp: 0.5, life: 0.25, sorcAura: 0.10,
    out: function (a, f, kind, m) {
      var v = 0;
      if (a === 'w_arms' && kind === 'atk') v += DOMAIN.arms;
      if (a === 'w_fate' && m && m.boss) v += DOMAIN.fate;
      if (a === 'm_shilen' && mirrorOn()) v += DOMAIN.shilenDream;
      if (a === 'm_atheist' && kind === 'mag') v += DOMAIN.athMag;
      return v * f;
    },
    minion: function (g, owner) { var f = F(owner); return (g === 'e_einhasad' ? DOMAIN.ein : g === 'm_shilen' ? DOMAIN.shilenMinion + (mirrorOn() ? DOMAIN.shilenDream : 0) : 0) * f; }
  };
  // 背神者（只有你自己）：範圍攻擊魔法沒有 3 秒冷卻（afk-balance1101 問這裡）
  (function () {
    var o = W.__afkAoeCdFree;
    W.__afkAoeCdFree = function (sk, x) { try { if (o && o(sk, x)) return true; } catch (e) {} return !!(x && x === P() && art(x) === 'm_atheist'); };
  })();
  var afterOut = function (actor, kind, snap, ent) {
    var a = art(actor), f = F(actor), normal = kind === 'atk', p = P();
    var hits = [], total = 0, prim = null, pl = 0;
    snap.forEach(function (x) { var lost = x[1] - Math.max(0, x[0].curHp); if (lost > 0) { hits.push([x[0], lost]); if (lost > pl) { pl = lost; prim = x[0]; } } });
    if (!hits.length) return;
    var fs = normal ? fast(actor, prim) : null, braved = false, primTotal = 0;
    if (normal && a === 'r_sword' && actor.buffs && actor.buffs.sk_royal_bravewill > 0 && Math.random() < 0.375 * f) braved = true;
    var pen = artPen(actor);
    hits.forEach(function (h) {
      var m = h[0], lost = h[1], mult = 1, extra = 0, mArt = 1;
      if (normal && actor.cls === 'knight') mult *= 2;   // 騎士一般攻擊傷害 ×2（玩家 2026-10-22）
      mArt = mult;
      if (kind === 'sum') {
        var g = minionArtOf(actor);
        if (g) { mult *= 1 + DOMAIN.minion(g, actor); extra += minionBonusOf(actor); if (g === 'e_einhasad' && ent && (ent.skId === 'sk_elf_summon' || ent.skId === 'sk_elf_summon2')) mult *= 1 + W.__afkArtTune.god * F(actor); if (ent && ent._afkFuse) mult *= W.__afkArtTune.fuse; }   // 融合魔獸傷害 ×5（玩家 2026-10-27：×20→×10；2026-10-28：→×5）
      } else if (a) {
        if (a === 'k_doom') mult *= 1 + W.__afkArtTune.kdoom * f;
        if (a === 'k_dark') { mult *= 1 + W.__afkArtTune.kdark * f; if (isDragon(m)) mult *= 1 + 0.5 * f; }
        if (a === 'i_sorc') mult *= 1 + W.__afkArtTune.sorc * f;
        if (a === 'i_life') mult *= 1 + W.__afkArtTune.life * f;
        if (a === 'd_magic') mult *= 1 + W.__afkArtTune.dmag * f;
        if (a === 'w_arms' || a === 'w_fate') mult *= 1 + (a === 'w_arms' ? (W.__afkArtTune.arms != null ? W.__afkArtTune.arms : 2.5) : W.__afkArtTune.knight) * f;   // 2026-11-02 16:41：萬兵之道 ×4.5 → ×3.5（命運迴響照舊 ×4.5）
        mult *= 1 + DOMAIN.out(a, f, kind, m);   // 技藝的領域強化（玩家 2026-11-02 15:20）   // 萬兵之道、命運迴響：傷害倍率（2026-10-28 平衡：×2 → ×3）
        if (a === 'n_heine' && inHeine()) mult *= (1 + f) * (normal ? 1 + f : 1);
        if (a === 'n_fafurion') {   // 兇亂滅斧：基礎傷害 +50%、王的狂暴 +20%、斧系一般攻擊多一輪左右手（×2）
          mult *= 1 + 0.5 * f;
          if (ragey(actor)) mult *= 1 + 0.2 * f;
          if (normal && axeOf(actor)) mult *= 1 + W.__afkArtTune.fafAxe * f;
        }
        if (normal) {
          if (fs && fs.mult > 1) mult *= 1 + (fs.mult - 1) * f;
          if (a === 'd_time') mult *= 1 + W.__afkArtTune.dtime * f;
          if (a === 'e_ruler') mult *= 1 + W.__afkArtTune.ruler * f;
          if (a === 'e_einhasad') mult *= 1 + W.__afkArtTune.ein * f;
          if (a === 'n_heine' && isFaf(m)) mult *= 1 + 5 * f;
          if (braved && m === prim) mult *= 1.5;
        }
        if (a === 'd_magic' && kind === 'mag') extra += Math.floor(((Number(actor.d.wis) || 0) + (Number(actor.d.int) || 0)) * 1.5 * f * (isAllyObj(actor) ? 0.5 : 1));
      }
      if (pen > 0 && a && kind !== 'sum' && mult > mArt) { var part = mult / mArt; mult = mArt * Math.max(1, part * (1 - pen)); }   // 同一門技藝人數懲罰
      if (normal && (m._afkWound || 0) > tk()) mult *= 1.2;   // 致命創傷（任何隊員的物理攻擊）
      var plus = Math.floor(lost * (mult - 1) + extra);
      if (plus > 0) { hurtMob(m, plus, actor) /* card-combat:arts-extra */; total += plus; }
      if (m === prim) primTotal = lost + Math.max(0, plus);
      total += lost;
    });
    if (normal && fs && actor !== p) actor._afkFastAt = tk();
    if (normal && prim) {
      if (a === 'w_arms') { prim._afkWound = tk() + 50; if (Math.random() * 100 < 80 * f) dragonStrike(actor); }
      if (a === 'k_doom' && !prim._dead) {
        var s = st(actor), per = s.desp ? 500 : (s.fate ? 200 : 100);
        if (isDragon(prim)) per *= 10;
        if (dreamOn()) per *= 2;
        var el = Math.floor(per * 4 * (fs ? fs.mult : 1) * f); hurtMob(prim, el, actor) /* card-combat:arts-element */; total += el;
      }
      var k = kings();
      if (k > 0) { var kv = wpnMax(actor) * k * 5; hurtMob(prim, kv, actor) /* card-combat:arts-flat */; }   // 玩家 2026-10-24：四大天王傷害 ×5
      if (a && actor.cls === 'royal' && prim.curHp > 0 && !prim._dead) hurtMob(prim, pl, actor) /* card-combat:arts-royal */;   // 王族技藝：一般攻擊追加 1 次（同主目標那一擊的傷害）
      if (a === 'n_heine' && inHeine() && prim.curHp > 0 && Math.random() < 0.5 * f) { prim.curHp = 0; log(tag('海音守望者', '#38bdf8') + nm(actor) + '喚來海音的潮聲，' + (prim.n || '敵人') + ' 被一擊吞沒。'); }
      if (a === 'n_fafurion' && normal) {   // 兇亂滅斧：一般攻擊傷害 5% 吸血（玩家 2026-10-28：移除全畫面波及傷害）
        heal(actor, total * 0.05 * f);
      }
      if (a === 'r_sword') heal(actor, total * 0.3 * f);
      { var T2 = W.__afkArtTune, lv = (a === 'd_time' && normal) ? T2.timeLeech : (a === 'w_arms' && normal) || a === 'd_magic' ? T2.leech : (a === 'i_sorc' || a === 'i_life') ? (T2.illuLeech != null ? T2.illuLeech : T2.leech) : 0; if (lv > 0) heal(actor, total * lv * f); }   // 2026-10-28 平衡：冷門技藝的吸血
      if (a === 'k_doom') heal(actor, total * f);
      if (a === 'n_heine' && isFaf(prim) && tk() - lastLeech >= 50) {
        lastLeech = tk(); var hv = total * 0.3 * f;
        heal(p, hv); aliveAllies().forEach(function (x) { heal(x, hv); });
      }
      if (braved && actor === p && typeof procFreeMagicSkill === 'function' && prim.curHp > 0) {
        quiet(function () { var pv = window.__afkSpellMult; window.__afkSpellMult = 2; try { procFreeMagicSkill(prim, 'sk_vampire', 0, false, null); } finally { window.__afkSpellMult = pv; } });
      }
      if (a === 'r_rally') rallyMinions();
    }
    reap();
  };
  // 龍的一擊（屠龍劍特效）：全場敵人 3D(力量)+30 必中固定傷害
  var dragonStrike = function (actor) {
    var ms = MS(); if (!ms) return;
    var str = Math.max(1, Math.floor((actor.d && actor.d.str) || 1)), r3 = function () { return 1 + Math.floor(Math.random() * str); };
    log(tag('龍的一擊', '#fca5a5') + nm(actor) + '劍中的龍魂咆哮而出，衝擊貫穿了所有敵人。');
    ms.mobs.forEach(function (m) { if (m && m.curHp > 0 && !m._dead) hurtMob(m, (r3() + r3() + r3() + 30) * (1 + F(actor)) * (typeof fragileMult === 'function' ? fragileMult(m) : 1), actor) /* card-combat:arts-dragon */; });   // 百般武藝傷害 ×2
  };
  var rallyMinions = function () {
    var p = P(), t = (typeof getTarget === 'function') ? getTarget() : null; if (!t || t.curHp <= 0) return;
    try {
      (p.summonsV2 || []).forEach(function (s) {
        if (!s || s._downed || t.curHp <= 0) return;
        if (s.skId === 'sk_elf_summon' || s.skId === 'sk_elf_summon2') window.spiritAttackOnce(s, t);
        else window.summonV2AttackOnce(s, _sumDeriveAny(s), t);
      });
      (typeof petsOutList === 'function' ? petsOutList() : []).forEach(function (x) { if (x && !x._downed && x.hp > 0 && t.curHp > 0) window.petAttackOnce(x, petDerive(x), t); });
    } catch (e) {}
  };
  var wrapOut = function (name, kind, actorOf) {
    var o = window[name]; if (typeof o !== 'function') return;
    window[name] = function () {
      if (outDepth > 0 || !active) return o.apply(this, arguments);
      var actor = actorOf.apply(null, arguments); if (!actor) return o.apply(this, arguments);
      if (kind !== 'sum' && !art(actor) && !(kind === 'atk' && kings() > 0) && !(kind === 'atk' && anyArt('w_arms')) && !(kind === 'atk' && actor.cls === 'knight')) return o.apply(this, arguments);
      if (kind === 'sum' && !minionArtOf(actor)) return o.apply(this, arguments);
      var snap = mobSnap(), r, prev = CTX; outDepth++; CTX = { actor: actor, kind: kind };
      try { r = o.apply(this, arguments); }
      finally { outDepth--; CTX = prev; try { afterOut(actor, kind, snap, arguments[0]); } catch (e) {} }
      return r;
    };
  };
  var me = function () { return P(); };
  // 命定絕望者在暗夢星迴 5 分鐘後倒下的傭兵：復活會立刻再倒（技藝代價），所以不讓復活卷軸／返生術白白浪費（玩家 2026-10-27）
  var doomMsgAt = 0;
  var doomNote = function (ally) {
    var now = Date.now(); if (now - doomMsgAt < 5000) return; doomMsgAt = now;
    try { logSys('<span class="text-amber-300">' + nm(ally) + ' 的技藝「絕望屠龍者」在暗夢星迴戰鬥 5 分鐘後命運斷絕，離開暗夢星迴前無法復活（不消耗復活卷軸／返生術）。</span>'); } catch (e) {}
  };
  if (typeof window.reviveMercenary === 'function') {
    var oRevM = window.reviveMercenary;
    window.reviveMercenary = function (slotN) {
      var p = P(), a = p && (p.allies || []).find(function (x) { return x && String(x._slot) === String(slotN); });
      if (a && a._downed && doomDead(a)) { doomNote(a); return; }
      return oRevM.apply(this, arguments);
    };
  }
  if (typeof window.tryAutoReviveMercScroll === 'function') {
    var oAutoRev = window.tryAutoReviveMercScroll;
    window.tryAutoReviveMercScroll = function (ally) { if (ally && ally._downed && doomDead(ally)) return false; return oAutoRev.apply(this, arguments); };
  }
  // 無神論者：無法一般攻擊；命定絕望者在暗夢星迴 5 分鐘後也不能攻擊
  var oPA = window.playerAttack;
  window.playerAttack = function () { var p = P(); if (p && doomDead(p)) return;   /* 背神者可以一般攻擊（Ping 11-13 03:02） */ return oPA.apply(this, arguments); };
  var oAA = window.allyAttackOnce;
  window.allyAttackOnce = function (ally) { if (ally && doomDead(ally)) return; return oAA.apply(this, arguments); };
  wrapOut('playerAttack', 'atk', me);
  wrapOut('dualWieldOffhandAttack', 'atk', me);
  wrapOut('allyAttackOnce', 'atk', function (a) { return a; });
  wrapOut('procFreeMagicSkill', 'mag', me);
  wrapOut('allyCastMagic', 'mag', function (a) { return a; });
  var sumOwner = function (owner) { var p = P(); if (!owner || owner === p) return p; return (p && (p.allies || []).indexOf(owner) >= 0) ? owner : null; };
  wrapOut('summonV2AttackOnce', 'sum', function (s, d, t, owner) { return sumOwner(owner); });
  // 屬性精靈另走 spiritAttackOnce（核心 js/23）：原本沒包到 → 殷海薩眷屬的元素神傷害 ×5、(WIS+INT)×1.2 追加都沒生效（玩家 2026-10-25 回報）
  wrapOut('spiritAttackOnce', 'sum', function (s, t, owner) { return sumOwner(owner); });
  // 傭兵的屬性精靈：殷海薩眷屬 → 元素神 HP ×5（11-02 起 16 人不再減半）
  if (typeof window._mercSummonAttachEntity === 'function') {
    var oMSA = window._mercSummonAttachEntity;
    window._mercSummonAttachEntity = function (sm, owner) {
      var r = oMSA.apply(this, arguments);
      try { if (r && owner && art(owner) === 'e_einhasad' && (r.skId === 'sk_elf_summon' || r.skId === 'sk_elf_summon2') && r.mhp > 0) { var k = 1 + 4 * F(owner); r.mhp = Math.round(r.mhp * k); r.hp = Math.round((r.hp || 0) * k); r._afkGod = 1; } } catch (e) {}
      return r;
    };
  }
  wrapOut('spiritAttackOnce', 'sum', function (s, t, owner) { return (!owner || owner === P()) ? P() : null; });
  wrapOut('petAttackOnce', 'sum', me);

  // 沐時者：會心一擊不耗 HP／MP（HP 不到一半也能放）；浴魔者：黑暗妖精魔法不耗 MP
  var freeCost = function (p, a, skId, self, args) {
    var sk = DB.skills[skId] || {}, hp0 = p.hp, mp0 = p.mp, dc = a === 'd_time' && sk.darkCrit, r;
    try { r = oCast.apply(self, args); }
    finally {
      try {   // 2026-10-29：消耗減免上限 50% → 改成退回一半（原本全免）
        if (dc && !p.dead) { if (p.hp < hp0) p.hp += Math.floor((hp0 - p.hp) / 2); if (p.mp < mp0) p.mp += Math.floor((mp0 - p.mp) / 2); }
        if (a === 'd_magic' && sk.reqD && p.mp < mp0) p.mp += Math.floor((mp0 - p.mp) / 2);
      } catch (e) {}
    }
    return r;
  };
  if (typeof window.allyDarkCrit === 'function') {   // 傭兵版會心一擊：只扣 MP → 沐時者不扣
    var oADC = window.allyDarkCrit;
    window.allyDarkCrit = function (ally) { var mp0 = ally && ally.mp, r = oADC.apply(this, arguments); try { if (ally && art(ally) === 'd_time' && ally.mp < mp0) ally.mp += Math.floor((mp0 - ally.mp) / 2); } catch (e) {} return r; };
  }
  // castSkill：浴魔者自動再施放＋黑暗妖精魔法不耗 MP；沐時者會心一擊不耗 HP/MP
  if (typeof window.castSkill === 'function') {
    var oCast = window.castSkill;
    window.castSkill = function (skId) {
      var p = P(), a = art(p);
      if (p && outDepth > 0 && (a === 'd_time' || a === 'd_magic')) return freeCost(p, a, skId, this, arguments);   // 巢狀呼叫（例如自動施法在其他效果裡）也要不耗 HP／MP
      if (!p || !a || outDepth > 0) return oCast.apply(this, arguments);
      var sk = DB.skills[skId] || {}, snap = mobSnap(), r;
      outDepth++; CTX = { actor: p, kind: 'mag' };
      try { r = freeCost(p, a, skId, this, arguments); }
      finally {
        outDepth--; CTX = null;
        try {
          afterOut(p, 'mag', snap);
          if (a === 'd_magic' && sk.type === 'atk' && sk.dmgType === 'magic' && typeof procFreeMagicSkill === 'function') {
            var t = (typeof getTarget === 'function') ? getTarget() : null;
            if (t && t.curHp > 0) { var s2 = mobSnap(); quiet(function () { procFreeMagicSkill(t, skId, 0, false, null); }); afterOut(p, 'mag', s2); }
          }
        } catch (e) {}
      }
      return r;
    };
  }

  // 攻擊間隔
  if (typeof window.playerAttackIntervalTicks === 'function') {
    var oIv = window.playerAttackIntervalTicks;
    window.playerAttackIntervalTicks = function (inc) {
      var r = oIv.apply(this, arguments);
      try { var fs = fast(P()); if (fs) { if (inc === false) return fs.show; return fs.min ? Math.min(r, fs.t) : fs.t; } } catch (e) {}
      return r;
    };
  }
  // 百般武藝：切菜（無視硬皮）、粉身碎骨（無硬皮時重擊 ×2）
  if (typeof window.mobHardSkin === 'function') {
    var oHS = window.mobHardSkin;
    window.mobHardSkin = function (m) { if (CTX && art(CTX.actor) === 'w_arms') return 0; return oHS.apply(this, arguments); };
  }
  if (typeof window.getPhysicalDmg === 'function') {
    var oPD = window.getPhysicalDmg;
    window.getPhysicalDmg = function (dice, target) {
      var res = oPD.apply(this, arguments);
      try { if (CTX && art(CTX.actor) === 'w_arms' && res && res.heavy && res.dmg > 0 && !(target && target.hardSkin > 0)) res.dmg = Math.floor(res.dmg * (1 + F(CTX.actor))); } catch (e) {}
      return res;
    };
  }
  // 命定絕望者：不能裝備武器
  if (typeof window.equipItem === 'function') {
    var oEq = window.equipItem;
    window.equipItem = function (item) {
      try { var d = item && DB.items[item.id]; if (d && d.type === 'wpn' && art(P()) === 'k_doom' && !P().afkDoomWield) { logSys('<span class="text-amber-300">絕望屠龍者的雙手已不再握劍。</span>'); return; } } catch (e) {}
      return oEq.apply(this, arguments);
    };
  }
  var stripWeapons = function (p) { try { if (typeof unequipItem !== 'function' || !p.eq) return; if (p.eq.offwpn) unequipItem('offwpn'); if (p.eq.wpn) unequipItem('wpn'); } catch (e) {} };

  // 席琳眷屬：召喚術上限 20、召滿融合；殷海薩眷屬：屬性精靈 HP ×5
  if (typeof window._sumCountFor === 'function') {
    var oCnt = window._sumCountFor;
    window._sumCountFor = function (name, owner) { var c = oCnt.apply(this, arguments); try { if (c > 0 && art(owner || P()) === 'm_shilen') return 20; } catch (e) {} return c; };
  }
  if (typeof window.summonV2CastFor === 'function') {
    var oSC = window.summonV2CastFor;
    window.summonV2CastFor = function (skId) {
      var r = oSC.apply(this, arguments);
      try {
        var p = P(), a = art(p), L = p.summonsV2 || [];
        if (r && a === 'm_shilen' && skId === 'sk_summon' && L.length >= 20) {
          var hp = 0; L.forEach(function (s) { hp += s.mhp || s.hp || 0; });
          var one = Object.assign({}, L[0], { hp: hp, mhp: hp, _afkFuse: L.length, _atkCd: 5 });
          p.summonsV2 = [one];
          log(tag('融合魔獸', '#c084fc') + L.length + ' 隻' + (one.form || '召喚物') + '的血肉交纏，化為一頭融合魔獸。');
          try { if (typeof renderSummonPanel === 'function') renderSummonPanel(true); } catch (e) {}
        }
        if (r && a === 'e_einhasad' && (skId === 'sk_elf_summon' || skId === 'sk_elf_summon2')) {
          L.forEach(function (s) { s.hp = (s.hp || 0) * 5; s.mhp = (s.mhp || 0) * 5; s._afkGod = 1; });
          log(tag('元素神', '#fde047') + '殷海薩的光芒落下，精靈升格為元素神。');
        }
      } catch (e) {}
      return r;
    };
  }

  // 席琳／殷海薩眷屬：寵物與召喚物命中、魔防 +(WIS+INT)×1.2
  var derDepth = 0;
  ['_sumDeriveAny', '_sumDerive', 'petDerive'].forEach(function (fn) {
    var o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () {
      if (derDepth > 0) return o.apply(this, arguments);   // _sumDeriveAny 內部再叫 _sumDerive：只加一次
      var r; derDepth++; try { r = o.apply(this, arguments); } finally { derDepth--; }
      try {
        var own = fn === 'petDerive' ? P() : (sumOwner(arguments[1]) || P());
        if (r && typeof r === 'object' && minionArtOf(own)) { var b = minionBonusOf(own); r = Object.assign({}, r, { hit: (Number(r.hit) || 0) + b, mr: (Number(r.mr) || 0) + b }); }
      } catch (e) {}
      return r;
    };
  });
  // 傭兵自然回血：有回血能力的技藝或精通 → 每次回血算兩次
  var REGEN_ARTS = { w_fate: 1, n_heine: 1, k_doom: 1, i_life: 1 }, REGEN_MAS = ['k_tough', 'k_dragonblood'];
  var allyRegenTwice = function (a) {
    if (!a || a._downed || (a.curHp || 0) <= 0 || (a.curHp || 0) >= (a.mhp || 0)) return;
    var ok = REGEN_ARTS[art(a)] || REGEN_MAS.some(function (m) { return typeof _afkM === 'function' ? _afkM(a, m) : a.mastery === m; });
    if (!ok) return;
    var iv = (a.buffs && (a.buffs.sk_heal_energy_storm || 0) > 0) ? 30 : (art(a) === 'w_fate' ? 40 : 160);
    if (tk() % iv !== 0) return;
    var mx = (a.d && a.d.hpRegenMax) || 0, v = Math.max(1, (mx > 0 ? 1 + Math.floor(Math.random() * mx) : 0) + ((a.d && a.d.hpR) || 0));
    heal(a, v * healMult(a, true));
  };

  // 屬性魔法武器效果（昇華支配的五階五星：每種屬性 3 次）。無神論者、浴魔者用；玩家走正式施法，傭兵用簡化公式、效果減半
  var ELE_ORDER = [0, 1, 2, 3];
  var castAttr5 = function (actor, mult, eles) {
    var ms = MS(); if (!ms) return;
    if (actor === P() && !recompAlly()) {
      quiet(function () {
        var pv = window.__afkSpellMult; window.__afkSpellMult = 1.5 * mult;
        try {
          eles.forEach(function (ei) { for (var k = 0; k < 3; k++) ATTR5[ei].forEach(function (skId) {
            var sk = DB.skills[skId]; if (!sk) return;
            var alive = ms.mobs.filter(function (m) { return m && m.curHp > 0 && !m._dead; }); if (!alive.length) return;
            if (sk.target === 'all') procFreeMagicSkill(alive[0], skId, 0, false, null);
            else alive.forEach(function (m) { procFreeMagicSkill(m, skId, 0, true, null); });
          }); });
        } finally { window.__afkSpellMult = pv; }
      });
    } else {
      var d = actor.d || {}, base = ((Number(d.int) || 0) + (Number(d.wis) || 0) + (Number(d.magicDmg) || 0)) * 8 * 1.5 * mult * 0.8 * F(actor) * classK(actor.cls);   /* 傭兵：0.5→0.8（Ping 11-13 03:02） */
      ms.mobs.forEach(function (m) { if (m && m.curHp > 0 && !m._dead) hurtMob(m, base * 3 * eles.length * (typeof mrMult === 'function' ? mrMult(m.mr || 0) : 1), actor) /* card-combat:arts-ally-spell */; });
    }
    reap();
  };

  // ── 每 tick ──
  var actorTick = function (p, isLeader) {
    var a = art(p); if (!a) return;
    var s = st(p), t = tk();
    // 暗夢星迴計時（命定絕望者）
    if (a === 'k_doom') {
      if (dreamOn()) { if (s.dreamAt == null) s.dreamAt = t; } else s.dreamAt = null;
      if (doomDead(p)) {
        if (isLeader) { if (p.hp > 1) p.hp = 1; }
        else { p.curHp = 0; p._downed = true; p._reviveCd = Math.max(p._reviveCd || 0, 150); }
        if (!s.doomLog) { s.doomLog = 1; log(tag('絕望屠龍者', '#f87171') + nm(p) + '的命運在此斷絕……（離開暗夢星迴方能復原）', 'enemy'); }
      } else s.doomLog = 0;
      if (isLeader && !p.afkDoomWield && p.eq && (p.eq.wpn || p.eq.offwpn) && !S().ff) stripWeapons(p);
    }
    if (!isLeader && (p._downed || (p.curHp || 0) <= 0)) {
      if ((p._reviveCd || 0) >= 149 && !doomDead(p) && trySaves(p, true)) { p._downed = false; p._reviveCd = 0; if (p.curHp <= 0) p.curHp = 1; }
      return;
    }
    if (isLeader && p.dead) return;
    // 低血量觸發（持續傷害、房間傷害也算）
    trySaves(p, false);
    // 狀態改變 → 重算
    if (t % 10 === 0) { var sg = sigOf(p); if (sg !== s.sig) { var first = !s.sig; s.sig = sg; if (!first) refresh(p); } }
    // 闇龍追隨者：每秒 −100 HP（真實傷害，不會因此死亡）
    if (a === 'k_dark' && t % 10 === 0 && inBattle()) setHp(p, Math.max(1, (hpOf(p) || 0) - 100));
    // 兇亂滅斧：戰鬥開始進入王的狂暴；每 10 秒失去最大 HP 20%（真實傷害，最低剩 1；玩家 2026-10-26：10%→20%）
    if (a === 'n_fafurion' && inBattle()) {
      if (s.furyB !== B.id) { s.furyB = B.id; s.furyAt = t; log(tag('血怒狂斧', '#ef4444') + nm(p) + '陷入王的狂暴——傷害與命中提升，生命卻一點一點燒盡。', 'enemy'); }
      else if (t - s.furyAt >= 100) { s.furyAt = t; setHp(p, Math.max(1, (hpOf(p) || 0) - Math.floor((p.mhp || 0) * 0.2))); }
    }
    // 無神論者
    if (a === 'm_atheist' && inBattle()) {
      if (athActive(p)) {
        if (s.athSince == null || s.athSince < B.start) s.athSince = Math.max(B.start, s.athOff);
        if (t % (isLeader ? 50 : 100) === 0) { s.athEle = ((s.athEle || 0) + 1) % 4; castAttr5(p, W.__afkArtTune.athAttr, [s.athEle]); }
        if (!s.athFired && t - s.athSince >= 600) {
          s.athFired = true;
          var ms = MS();
          (ms.mobs || []).forEach(function (m) { if (m && m.curHp > 0 && !m._dead) hurtMob(m, (m.hp || m.curHp) * (m._afkFinal ? 0.05 : 0.2), p) /* card-combat:arts-timed */ /* 席琳只扣 5%（玩家 2026-10-28 晚） */; });
          log(tag('背神者', '#e879f9') + nm(p) + '否定了諸神——敵人失去兩成生命（席琳只有半成），代價是之後 5 分鐘的虛弱。');
          s.athOff = t + 3000; s.athSince = null; reap(); refresh(p);
        }
      }
    }
    // 浴魔者：HP<30% 自動施放一輪四屬性五階五星魔法（每場一次）
    if (a === 'd_magic' && !s.lowCast && inBattle() && (hpOf(p) || 0) < (p.mhp || 1) * 0.3) { s.lowCast = true; log(tag('魔血咒者', '#818cf8') + nm(p) + '在瀕死之際，地水火風四道咒文同時迸發。'); castAttr5(p, 1, ELE_ORDER); }
    // 傭兵攻速上限
    if (!isLeader) { var fs = fast(p); if (fs) { var gone = p._afkFastAt == null ? fs.t : t - p._afkFastAt, cdv = Math.max(1, fs.t - gone); p._atkCd = fs.min ? Math.min(Number(p._atkCd) || cdv, cdv) : cdv; } }   // 幻刃術士（min）：只把冷卻壓到上限，原本比較快的不再被拉慢（2026-11-02 修）
  };
  var oTick = window.tick;
  window.tick = function () {
    var t0 = tk();
    try { return oTick.apply(this, arguments); }
    finally {
      if (tk() !== t0) {
        try {
          var p = P();
          if (p) {
            partyN = 1 + ((p.allies || []).length);
            active = !!(art(p) || kings() > 0 || (p.allies || []).some(function (a) { return a && art(a); }));
            (p.allies || []).forEach(allyRegenTwice);
            if (active) {
              battleTick();
              actorTick(p, true);
              (p.allies || []).forEach(function (a) { if (a) actorTick(a, false); });
              // 席琳眷屬融合魔獸：每 3 秒隨機施放一種魔法（法師公式）
              if (art(p) === 'm_shilen' && tk() % 30 === 0 && (p.summonsV2 || []).some(function (s) { return s && s._afkFuse && !s._downed; })) {
                var tg = (typeof getTarget === 'function') ? getTarget() : null;
                if (tg && tg.curHp > 0) quiet(function () { procFreeMagicSkill(tg, FUSE_SK[Math.floor(Math.random() * FUSE_SK.length)], 0, false, null); });
                reap();
              }
            }
          }
        } catch (e) {}
      }
    }
  };

  // ── NPC 奧拉奇里亞（燃柳村）──
  var NPC_ID = 'npc_orachilia';
  try {
    var town = DB.towns && DB.towns.town_gludio;
    if (town && Array.isArray(town.npcs) && !town.npcs.some(function (x) { return x.id === NPC_ID; })) {
      town.npcs.push({ id: NPC_ID, n: '奧拉奇里亞', title: '轉生技藝', type: 'rebirtharts',
        d: '光龍奧拉奇里亞化成人形的模樣。她看過無數次輪迴，只為走過冥王域、重新開始的人傳授失落的技藝——每種職業兩門，只能擇一修習。' });
    }
    if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[NPC_ID]) NPC_SPR_FIXED[NPC_ID] = '949';
  } catch (e) {}
  var css = function () {
    if (document.getElementById('afk-arts-css')) return;
    var s = document.createElement('style'); s.id = 'afk-arts-css';
    s.textContent = '#afk-arts-modal{position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:9000;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:16px}' +
      '#afk-arts-modal .box{background:#1e1b2e;border:1px solid #7c3aed;border-radius:10px;max-width:640px;width:100%;max-height:calc((100dvh - var(--orig-bar-h,0px)) * .9);overflow:auto;padding:16px;color:#e9d5ff}' +
      '#afk-arts-modal h3{font-size:18px;font-weight:bold;color:#f0abfc;margin:0 0 8px}' +
      '#afk-arts-modal .card{border:1px solid #4c1d95;border-radius:8px;padding:10px;margin:10px 0;background:#2a2342}' +
      '#afk-arts-modal .card.on{border-color:#facc15;box-shadow:0 0 8px #a16207}' +
      '#afk-arts-modal .card b{color:#fde68a;font-size:15px}#afk-arts-modal .card p{font-size:13px;line-height:1.6;margin:6px 0}' +
      '#afk-arts-modal button{padding:6px 14px;border-radius:6px;background:#6d28d9;color:#fff;border:1px solid #a78bfa}' +
      '#afk-arts-modal button[disabled]{opacity:.5}#afk-arts-modal .note{font-size:12px;color:#c4b5fd}' +
      '.afk-arts-embed{color:#e2e8f0;font-size:14px;line-height:1.7}.afk-arts-embed p{margin:6px 0}' +
      '.afk-arts-embed .note{color:#cbd5e1;font-size:14px}' +
      '.afk-arts-embed .card{border:1px solid #334155;border-radius:8px;padding:10px 12px;margin:10px 0;background:rgba(15,23,42,.6)}' +
      '.afk-arts-embed .card.on{border-color:#facc15;box-shadow:0 0 8px rgba(161,98,7,.6)}' +
      '.afk-arts-embed .card b{color:#fde68a;font-size:15px}' +
      '.afk-arts-embed button{padding:6px 14px;border-radius:6px;background:#6d28d9;color:#fff;border:1px solid #a78bfa;font-size:14px;font-weight:bold}' +
      '.afk-arts-embed button[disabled]{opacity:.5}';
    document.head.appendChild(s);
  };
  var layer = null;
  var render = function () { renderInto(document.querySelector('#afk-arts-modal .box')); };
  var renderInto = function (box) {
    if (!box) return;
    var embedded = !!box.closest('.afk-arts-embed');
    var p = P(), h = embedded ? '' : '<h3>✨ 奧拉奇里亞・轉生技藝</h3>';
    if (!p || !(p.rebirth > 0)) h += '<p class="afk-lore">「你的靈魂還沒走過冥王域。等你在輪迴中重生，再來找我吧。」</p>';
    else {
      h += '<p class="afk-lore">「輪迴洗去了你的等級，卻洗不去刻在靈魂上的技藝。選吧，孩子。」</p><p class="note">每個職業兩門技藝，只能修習其中一門（不收費，可以回來改選）。同一門技藝全隊最多 4 人生效（你優先，再依傭兵招募順序），第 5 人起沒有技藝效果。</p>';
      Object.keys(ARTS).forEach(function (id) {
        var A = ARTS[id]; if (A.cls !== p.cls) return;
        var on = p.rebirthArt === id;
        h += '<div class="card' + (on ? ' on' : '') + '"><b>' + A.n + (on ? '（修習中）' : '') + '</b>' + (ARTS_LORE[id] ? '<p class="afk-lore">' + ARTS_LORE[id] + '</p>' : '') + '<p>' + A.d + '</p>' +
          '<button type="button" data-art="' + id + '"' + (on ? ' disabled' : '') + '>' + (on ? '已修習' : '修習這門技藝') + '</button></div>';
      });
      var k = kings();
      h += '<p class="note">同袍戰陣：目前上場 ' + partyN + ' 人，全隊一般攻擊追加 ' + k + ' 次（每 4 人 +1，16 人＝5 次）。' + '同一門技藝 3 人起這門的技藝傷害 −15%、4 人 −35%' + (partyN >= 16 ? '；現在 16 人上場，加倍為 −30%／−70%。' : '（16 人上場時加倍）。') + '</p>';
    }
    // 🧪 開發測試按鈕已關閉（玩家 2026-10-27）；window.afkDevRebirthAll 保留給測試腳本用
    if (!embedded) h += '<div style="text-align:right"><button type="button" data-close="1">關閉</button></div>';
    box.innerHTML = h;
  };
  var learn = function (id) {
    var p = P(); if (!p || !(p.rebirth > 0) || !ARTS[id] || ARTS[id].cls !== p.cls) return { ok: false, msg: '無法修習。' };
    p.rebirthArt = id;
    if (id === 'k_doom' && !p.afkDoomWield) stripWeapons(p);
    try { calcStats(); } catch (e) {}
    try { logSys('<span class="text-fuchsia-300 font-bold">奧拉奇里亞將「' + ARTS[id].n + '」刻進了你的靈魂。</span>'); } catch (e) {}
    try { if (typeof saveGame === 'function') saveGame(); if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    active = true;
    return { ok: true };
  };
  // 放進遊戲本身的 NPC 對話框（標題、關閉鈕、字體與其他 NPC 一致）
  var embed = function (div) {
    if (!div) return; css();
    div.innerHTML = '<div id="afk-arts-embed" class="afk-arts-embed"><div class="box"></div></div>';
    var host = div.querySelector('#afk-arts-embed');
    host.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.close) { if (typeof closeNpcInteraction === 'function') closeNpcInteraction(); return; }
      if (b.dataset.art) { learn(b.dataset.art); renderInto(host.querySelector('.box')); }
      if (b.dataset.dev) {
        var go = function () { var r = window.afkDevRebirthAll(); renderInto(host.querySelector('.box')); if (r && r.ok) logSys('已處理：' + r.slots.join('、')); };
        var msg = '會把帳號裡所有角色改成轉生、Lv150、屬性 200、五屬性抗性 +100、全變身開啟，並發給 GM 專屬裝備，直接寫進存檔（無法復原）。確定嗎？';
        if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '開發測試', message: msg, okText: '執行', cancelText: '取消', danger: true, onOk: go });
        else if (confirm(msg)) go();
      }
    });
    renderInto(host.querySelector('.box'));
  };
  // ── 開發測試：帳號裡所有角色一鍵轉生滿等（玩家 2026-10-21 要求，用來測試技藝）──
  //   轉生（保留 Lv100 的 HP／MP）、Lv150、六項屬性（基礎＋配點＋萬能藥）都到 200；面板 +50 是轉生本身的效果。
  var ATTRS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  var maxOut = function (p) {
    p.base = p.base || {}; p.alloc = p.alloc || {}; p.panacea = p.panacea || {};
    ATTRS.forEach(function (k) { var other = (Number(p.alloc[k]) || 0) + (Number(p.panacea[k]) || 0); p.base[k] = Math.max(0, 200 - other); });
  };
  var keepOf = function (p) {   // 同一身裝備在 Lv100 與 Lv1 的 HP／MP 差
    var lv = p.lv, k = { hp: 0, mp: 0 };
    p.rebirthHpKeep = 0; p.rebirthMpKeep = 0;
    p.lv = 100; recomputeStats(); var h100 = p.mhp, m100 = p.mmp;
    p.lv = 1; recomputeStats(); k.hp = Math.max(0, Math.round(h100 - p.mhp)); k.mp = Math.max(0, Math.round(m100 - p.mmp));
    p.lv = lv; return k;
  };
  // 玩家 2026-10-24：測試再加——五屬性抗性 +100（afk-rebirth 的 devResist）、全變身開啟、GM 專屬裝備
  var devForms = function (p) {
    var A = window.AFK_CARD_ASCENSION; if (!A || !A.catalog) return;
    var s = p.cardAscension && typeof p.cardAscension === 'object' ? p.cardAscension : (p.cardAscension = { v: 1 });
    ['owned', 'failures', 'attempts', 'unlocked', 'sealed', 'bonus'].forEach(function (k) { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; });
    Object.keys(A.catalog).forEach(function (t) { s.unlocked[t] = true; (A.catalog[t] || []).forEach(function (r) { s.owned[r.id] = true; delete s.sealed[r.id]; }); });
    try { var PC = window.AFK_POLY_CODEX; if (PC && PC.forms) { p.polyDex = p.polyDex || {}; PC.forms.forEach(function (f) { p.polyDex[f.n] = 3; }); } } catch (e) {}
  };
  var devDex = function (me) {
    try { var F = window.AFK_CARD_FORMS, ns = F && F.monsterNames ? F.monsterNames() : []; me.cardDex = me.cardDex || {}; ns.forEach(function (n) { if (!(Number(me.cardDex[n]) >= 10000)) me.cardDex[n] = 10000; }); me.cardDexV = 2; } catch (e) {}
  };
  var devGM = function (p) {
    p.inv = p.inv || [];
    ['99999', '99998'].forEach(function (id) { if (DB.items[id] && !p.inv.some(function (x) { return x && x.id === id; }) && !Object.keys(p.eq || {}).some(function (k) { return p.eq[k] && p.eq[k].id === id; })) p.inv.push({ id: id, uid: uid(), cnt: 1, en: 0 }); });
  };
  var devOne = function (p) {
    if (!(p.rebirth > 0)) { var k = keepOf(p); p.rebirth = 1; p.rebirthHpKeep = k.hp; p.rebirthMpKeep = k.mp; }
    maxOut(p); p.lv = 150; p.exp = 0; p.devResist = 100;
    devForms(p); devGM(p);
    recomputeStats(); p.hp = p.mhp; p.mp = p.mmp;
  };
  window.afkDevRebirthAll = function () {
    var me = P(); if (!me) return { ok: false, msg: '請先進入遊戲。' };
    var done = [], max = (typeof SAVE_SLOT_MAX !== 'undefined') ? SAVE_SLOT_MAX : 16;
    for (var n = 1; n <= max; n++) {
      if (String(n) === String(currentSlot)) continue;
      var key = 'lineage_idle_save_' + n, raw = _lzGet(key); if (!raw) continue;
      var u = _saveUnwrap(raw); if (!u || !u.payload) continue;
      var data; try { data = JSON.parse(u.payload); } catch (e) { continue; }
      var p = data && data.p; if (!p || !p.cls) continue;
      p.cardDex = me.cardDex; p.equipDex = me.equipDex; p.miscDex = me.miscDex;
      var save = player; player = p; _recomputingAlly = true;
      try { devOne(p); } catch (e) { console.warn('[AFK-arts] 轉生失敗 slot ' + n, e); }
      finally { _recomputingAlly = false; player = save; delete p.cardDex; delete p.equipDex; delete p.miscDex; delete p.relicDex; }
      _lzSet(key, _saveWrap(JSON.stringify(data)));
      done.push(n + ':' + (p.name || p.cls));
    }
    devDex(me); devOne(me); try { calcStats(); me.hp = me.mhp; me.mp = me.mmp; updateUI(); renderTabs(true); saveGame(); } catch (e) {}
    done.push(currentSlot + ':' + (me.name || me.cls));
    try { logSys('<span class="text-fuchsia-300 font-bold">🧪 測試：' + done.length + ' 個角色已轉生、Lv150、六項屬性 200、五屬性抗性 +100、全變身開啟，並取得 GM 專屬裝備。</span>'); } catch (e) {}
    return { ok: true, slots: done };
  };

  var doClose = function () { layer = null; var m = document.getElementById('afk-arts-modal'); if (m) m.style.display = 'none'; };
  var open = function () {
    css();
    var m = document.getElementById('afk-arts-modal');
    if (!m) {
      m = document.createElement('div'); m.id = 'afk-arts-modal'; m.innerHTML = '<div class="box"></div>'; document.body.appendChild(m);
      m.addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (ev.target === m || (b && b.dataset.close)) { if (layer && window.AFK_UI) AFK_UI.closeLayer(layer); else doClose(); return; }
        if (b && b.dataset.art) { learn(b.dataset.art); render(); }
      });
    }
    m.style.display = 'flex'; render();
    layer = (window.AFK_UI && AFK_UI.openLayer) ? AFK_UI.openLayer(doClose) : null;
  };
  if (typeof window.interactNPC === 'function') {
    var oNpc = window.interactNPC;
    window.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      if (npcId === NPC_ID) { try { embed(document.getElementById('interaction-content')); } catch (e) {} try { if (window.__afkRebirthFixMount) window.__afkRebirthFixMount(document.getElementById('interaction-content')); } catch (e) {} }
      return r;
    };
  }

  window.__afkArts = { artPen: artPen, ARTS: ARTS, LORE: ARTS_LORE, art: art, learn: learn, open: open, st: st, kings: kings, trySaves: trySaves, healMult: healMult, takenMult: takenMult, finalDR: finalDR,
    battle: function () { return B; }, partyN: function () { return partyN; }, _setParty: function (n) { partyN = n; }, _setActive: function (v) { active = v; }, isActive: function () { return active; } };
  // 衝擊之暈：命中時額外 500 真實傷害（玩家 2026-10-22；原本 +10，加在傷害計算之後＝不吃防禦）
  try { var ss = DB.skills.sk_shock_stun; if (ss && !ss._afk500) { ss.skillAddDmg = (ss.skillAddDmg || 0) + 500; ss._afk500 = true; } } catch (e) {}
  console.log('[AFK-arts] 已啟用：轉生技藝（奧拉奇里亞）');
})();
