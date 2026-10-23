/* ============================================================================
 * afk-arts.js — 轉生技藝（玩家 2026-10-21 指定）
 *
 * ‧轉生後到燃柳村找 奧拉奇里亞（女性 NPC）免費學習；每個職業兩種技藝「二選一」（可回來免費改選）
 * ‧技藝效果見下方 ARTS 的說明文字；實作細節與近似處寫在 docs/rebirth-arts.md
 * ‧免死：席琳的永生、不屈命運、絕望身軀三者各自獨立；其他免死（命運迴響的「每場戰鬥免死一次」）共用一個 30 秒冷卻
 * ‧傭兵：轉生後招傭兵得到「四大天王」：上場人數每 4 人全隊普攻多 1 次（上限 5 次，16 人＝5 次），
 *   這些追加攻擊不觸發任何特效，傷害＝武器最大值；16 人上場時傭兵的技藝效果減半
 * 掛點：只包 window 上的函式（傷害用前後 HP 差補算），不改核心檔。須排在 afk-relicplus、afk-corrupt、afk-dreamstar、afk-rebirth 之後。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('arts')) return;
  if (typeof window.recomputeStats !== 'function') { console.warn('[AFK-arts] 找不到 recomputeStats，略過'); return; }

  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var P = function () { return (typeof player !== 'undefined' && player) ? player : null; };
  var tk = function () { return S().ticks || 0; };
  var MS = function () { return (typeof mapState !== 'undefined' && mapState) ? mapState : null; };
  var log = function (h, c) { try { if (!S().ff && typeof logCombat === 'function') logCombat(h, c || 'player-special'); } catch (e) {} };
  var tag = function (n, c) { return '<span class="font-bold" style="color:' + (c || '#f0abfc') + ';text-shadow:0 0 6px ' + (c || '#a21caf') + '">【' + n + '】</span>'; };
  var nm = function (p) { return p === P() ? '你' : (p._allyName || '傭兵'); };

  // ── 技藝資料 ──
  // 傳說句（玩家 2026-10-23：文字要有意境），顯示在效果說明前面
  var ARTS_LORE = {"r_sword": "以血為誓的王族劍術。劍刃每飲一次血，意志便更熾烈一分。", "r_rally": "王者一聲呼喊，戰場上所有同伴的刀鋒都指向同一個方向。", "w_fate": "命運越是將他推向死亡，他的劍便迴響得越響亮。", "w_arms": "歷經百戰的騎士，早已把每一種兵器都練成了自己的手臂。", "m_shilen": "受死亡女神席林垂青的術士，召來的僕從不知何謂死亡。", "m_atheist": "不再向任何神祇祈禱的法師，只信自己掌中的魔力。", "e_einhasad": "受殷海薩祝福的妖精，精靈在她身旁化為元素之神。", "e_ruler": "以一己之身統御四大元素的妖精，自然本身都聽從她的號令。", "d_time": "沐浴於時之流的暗殺者。你眨一次眼，祂的刀已落下兩次。", "d_magic": "以魔力為血的黑暗妖精，每一道咒文都會在回音中再響一次。", "i_sorc": "把幻象磨成利刃的術士，真與假的界線在祂手中消失。", "i_life": "將傷痛編織成生命的術士，越是受傷，越是頑強。", "k_dark": "向闇之龍獻上血肉的龍騎士，換來足以焚盡一切的力量。", "k_doom": "捨棄兵刃、只以絕望為武器的龍騎士，在夢的盡頭等著屠龍。", "n_fafurion": "生來就為了終結水龍法利昂的戰士，潮聲裡聽得見他的戰吼。", "n_heine": "誓死守護海音之地的戰士，只要站在這片土地上，便無人能越過他。"};
  var ARTS = {
    r_sword:     { cls: 'royal',    n: '魔劍技藝',   d: '勇猛意志發動率提升到 50%（傷害 ×1.5 不變），發動時同時施放吸血鬼之吻（效果 ×2）；一般攻擊吸取 30% 傷害轉為 HP。' },
    r_rally:     { cls: 'royal',    n: '呼喊夥伴',   d: '你每次一般攻擊，寵物與召喚物各追加一次攻擊。全隊（玩家、傭兵、寵物、召喚物、護衛）受到的物理傷害 −50%（可與聖結界疊加，合計上限 75%，屬性傷害不算）。持有者本人在所有減傷算完後再 −50%。' },
    w_fate:      { cls: 'knight',   n: '命運迴響',   d: '造成的傷害 ×2。所有回復 +100%、HP 自然恢復 ×10 且每 4 秒一次、HP +5000、傷害減免 +50、五種屬性抗性 +200；每 5 秒一次受到的傷害減半（真傷、物理、魔法、屬性都算）。HP<50% 觸發不屈命運：HP 全滿、效果 ×2；HP<30% 觸發絕望身軀：HP 全滿、效果 ×3，並獲得每場戰鬥一次的免死。敵人優先攻擊你，你額外減傷 10%，之後再扣 500 點最終減傷（真實減傷）。' },
    w_arms:      { cls: 'knight',   n: '百般武藝',   d: '造成的傷害 ×2。切菜：無視目標硬皮。龍的一擊（屠龍劍特效）：一般攻擊 80% 機率對全場敵人造成 3D(力量)+30 必中固定傷害。粉身碎骨：目標沒有硬皮時，重擊傷害 ×2。致命創傷：命中後目標 5 秒內受到的物理傷害 +20%；近距離命中 +50。' },
    m_shilen:    { cls: 'mage',     n: '席林眷屬',   d: '召喚術數量上限 20；寵物與召喚物命中、魔防、每次攻擊的傷害、每次受擊的減免都 +(WIS+INT)×1.2，且不會死亡（HP 最低 1）。召滿 20 隻時融合成一隻融合魔獸（傷害 ×20），每 3 秒隨機施放雷霆風暴／龍捲風／極光雷電／燃燒的火球（法師公式）。' },
    m_atheist:   { cls: 'mage',     n: '無神論者',   d: '狀態中：無法一般攻擊、魔法傷害與命中 +100，每 5 秒自動施放一次屬性魔法武器效果（四屬性輪流，威力 ×3，不耗 MP；傭兵 10 秒一次、效果減半）。進入戰鬥 1 分鐘時，所有敵人扣最大 HP 20%，之後陷入虛弱（回到一般狀態、可以攻擊），5 分鐘後再次進入無神狀態。' },
    e_einhasad:  { cls: 'elf',      n: '殷海薩眷屬', d: '同席林眷屬（攻擊與減傷追加、不死），且屬性精靈化為元素神：傷害與 HP ×5。' },
    e_ruler:     { cls: 'elf',      n: '主宰者',     d: '自動學會四種屬性的精靈魔法；「融合」：全部精靈魔法增益加總 ×3 常駐。HP<50% 觸發不屈命運（HP 全滿）。面板能力 +50、近／遠／魔法爆擊 +15%；每次一般攻擊以近戰＋遠攻＋魔法三種一起計算（傷害 ×3）。' },
    d_time:      { cls: 'dark',     n: '沐時者',     d: '會心一擊不消耗 HP／MP；一般攻擊多算一次必定爆擊的傷害。爆擊傷害 +50%、近距離爆擊率 +50%。HP<30% 觸發絕望身軀（HP 全滿）。' },
    d_magic:     { cls: 'dark',     n: '浴魔者',     d: '學會十階魔法；施放攻擊魔法後自動免費再施放一次，每次額外 +(WIS+INT)×1.5 傷害。MP 自然恢復 ×6、MP 恢復 +50、MP +500；黑暗妖精魔法不耗 MP。HP<30% 時自動施放一輪四屬性五階五星魔法（每場戰鬥一次）。' },
    i_sorc:      { cls: 'illusion', n: '妖術師',     d: '所有傷害 ×2（幻術精通效果加倍）；攻擊速度提升到每秒 2 次。' },
    i_life:      { cls: 'illusion', n: '命術者',     d: '受到傷害的 50% 轉為治療（等於只受一半傷害）；治療減益效果減半，汙濁之水完全無效。' },
    k_dark:      { cls: 'dragon',   n: '闇龍追隨者', d: '所有傷害 ×3，對四大龍再 +50%。代價：每秒損失 100 HP（真實傷害，不會因此死亡）、受到的治療 −50%、四屬性抗性 −50。' },
    k_doom:      { cls: 'dragon',   n: '命定絕望者', d: '不能裝備武器。攻擊速度 0.1 秒（實際 1 秒一擊、傷害 ×10）；每次攻擊附加四屬性真實傷害各 100（對四大龍 1000）。吸血 100%、受到的治療 +500%、HP −1000。HP<50% 不屈命運：屬性傷害變 200；HP<30% 絕望身軀：變 500。暗夢星迴（單人）中效果 ×2、減傷 50%，不屈命運時四屬性抗性 +100、絕望身軀時 +200；但戰鬥 5 分鐘後死亡（玩家改為 HP 鎖 1、不能攻擊），離開才恢復。' },
    n_fafurion:  { cls: 'warrior',   n: '破滅法利昂', d: '對法利昂：攻擊速度 0.1 秒（實際 1 秒一擊、傷害 ×10）、追加 5 次攻擊；吸血 30% 治療全隊（5 秒一次）；受到法利昂的傷害 −90%。' },
    n_heine:     { cls: 'warrior',   n: '海音守護者', d: '在海音地區：一般攻擊 50% 機率即死（頭目也算）、傷害 +100%、追加 1 次攻擊；HP 自然恢復 ×5、AC −1000、MR +1000。敵人優先攻擊你，你額外減傷 10%。' }
  };
  var SAVES = { w_fate: { fate: 1, desp: 1 }, e_ruler: { fate: 1 }, d_time: { desp: 1 }, k_doom: { fate: 1, desp: 1 } };
  var ATTR5 = [['sk_meteor'], ['sk_fire_storm', 'sk_blizzard'], ['sk_thunder_storm', 'sk_tornado'], ['sk_earthquake', 'sk_blaze']];
  var FUSE_SK = ['sk_thunder_storm', 'sk_tornado', 'sk_aurora', 'sk_fireball'];

  var art = function (p) { if (!p || !(p.rebirth > 0)) return null; var a = p.rebirthArt; return (a && ARTS[a] && ARTS[a].cls === p.cls) ? a : null; };
  var recompAlly = function () { return typeof _recomputingAlly !== 'undefined' && _recomputingAlly; };
  var isAllyObj = function (p) { return !!p && (p._slot !== undefined || (p === P() && recompAlly())); };
  var partyN = 1;
  var F = function (p) { return (isAllyObj(p) && partyN >= 16) ? 0.5 : 1; };
  var hpOf = function (p) { return p === P() && !recompAlly() ? p.hp : p.curHp; };
  var setHp = function (p, v) { if (p === P() && !recompAlly()) p.hp = v; else p.curHp = v; };
  var heal = function (p, v) { if (!(v > 0) || !p) return; var h = hpOf(p) || 0; setHp(p, Math.min(p.mhp || h, h + Math.floor(v))); };
  var dreamOn = function () { try { return !!(window.__afkDreamStar && window.__afkDreamStar.on()); } catch (e) { return false; } };
  var inHeine = function () { try { var m = MS(); return !!(m && typeof mapRegionOf === 'function' && mapRegionOf(m.current) === 'heine'); } catch (e) { return false; } };
  var isFaf = function (m) { return !!m && (/法利昂/.test(m.n || '') || (S().antharas && S()._afkDragon === 'fafurion')); };
  var isDragon = function (m) { return !!m && (/安塔瑞斯|法利昂|巴拉卡斯|林德拜爾/.test(m.n || '') || !!S().antharas); };
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
  var doomDead = function (p) { if (art(p) !== 'k_doom' || !dreamOn()) return false; var s = st(p); return s.dreamAt != null && tk() - s.dreamAt >= 3000; };

  // ── 免死：不屈命運（HP<50%）→ 絕望身軀（HP<30%）→ 命運迴響的每場免死（共用冷卻 30 秒）──
  var trySaves = function (p, lethal) {
    var a = art(p); if (!a) return false;
    var sv = SAVES[a], s = st(p), hp = hpOf(p) || 0, mx = p.mhp || 1;
    if (sv && sv.fate && !s.fate && hp < mx * 0.5) {
      s.fate = true; s.mode = Math.max(s.mode, 2); refresh(p); setHp(p, p.mhp);
      log(tag('不屈命運', '#fbbf24') + nm(p) + '的命運不容在此終結——HP 全滿！');
      return true;
    }
    if (sv && sv.desp && !s.desp && hp < mx * 0.3) {
      s.desp = true; s.mode = 3; refresh(p); setHp(p, p.mhp);
      log(tag('絕望身軀', '#f87171') + nm(p) + '從絕望中站起——HP 全滿！');
      return true;
    }
    if (lethal && a === 'w_fate' && s.desp && !s.imm && tk() >= (s.cdAt || 0)) {
      s.imm = true; s.cdAt = tk() + 300; setHp(p, 1);
      log(tag('命運迴響', '#fbbf24') + nm(p) + '硬撐住了致命一擊！（本場戰鬥一次）');
      return true;
    }
    return false;
  };

  // ── 能力 ──
  var RES4 = ['resFire', 'resWater', 'resWind', 'resEarth'];
  var PANEL = ['meleeDmg', 'meleeHit', 'rangedDmg', 'rangedHit', 'magicDmg', 'magicHit', 'extraMp', 'resFire', 'resWater', 'resWind', 'resEarth', 'mr', 'er'];
  var grant = function (p, ids) { p.grantedSkills = p.grantedSkills || []; p.skills = p.skills || []; ids.forEach(function (k) { if (!DB.skills[k]) return; if (p.grantedSkills.indexOf(k) < 0) p.grantedSkills.push(k); if (p.skills.indexOf(k) < 0) p.skills.push(k); }); };
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
      var p = P(), a = art(p); if (!a || !p.d) return r;
      var d = p.d, f = F(p), s = st(p);
      if (a === 'w_arms') add(d, 'meleeHit', 50 * f);
      else if (a === 'w_fate') {   // 命運迴響（玩家 2026-10-22）：HP 自然恢復每 4 秒一次、減傷 +50、五種屬性抗性 +200
        d.hpRegenFaster = Math.max(Number(d.hpRegenFaster) || 0, 12);
        add(d, 'dr', 50 * f); RES4.concat(['resNone']).forEach(function (k) { add(d, k, 200 * f); });
      }
      else if (a === 'm_atheist' && athActive(p)) { add(d, 'magicDmg', 100 * f); add(d, 'magicHit', 100 * f); }
      else if (a === 'e_ruler') {
        scanSkills(); grant(p, elfEleSkills);
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
  var sigOf = function (p) { var s = st(p); return [s.mode, s.fate, s.desp, athActive(p), inHeine(), dreamOn(), partyN >= 16].join(); };

  // ── 治療倍率 ──
  var healMult = function (p, regen) {
    var a = art(p); if (!a) return 1;
    var f = F(p), s = st(p);
    if (a === 'w_fate') return 1 + (regen ? 9 : 1) * s.mode * f;   // 自然恢復 ×10（不屈／絕望再 ×2／×3），其他回復 +100%
    if (a === 'k_doom') return 1 + 5 * f;
    if (a === 'k_dark') return 1 - 0.5 * f;
    if (a === 'n_heine' && regen && inHeine()) return 1 + 4 * f;
    return 1;
  };
  if (typeof window.rollHealingSpell === 'function') {
    var oRoll = window.rollHealingSpell;
    window.rollHealingSpell = function (sk, dS, caster, target) { var v = oRoll.apply(this, arguments); try { if (v > 0) { var m = healMult(target, false); if (m !== 1) v = Math.floor(v * m); } } catch (e) {} return v; };
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
  var HEAL_POT = function (id) { return !!id && (id.indexOf('potion_heal') >= 0 || id === 'potion_strong' || id === 'potion_ult' || id === 'new_item_141'); };
  if (typeof window.useItem === 'function') {
    var oUse = window.useItem;
    window.useItem = function (u) {
      var p = P(); if (!p || !art(p)) return oUse.apply(this, arguments);
      var it = (p.inv || []).find(function (i) { return i.uid === u; });
      if (!it || !HEAL_POT(it.id)) return oUse.apply(this, arguments);
      var h0 = p.hp, r = oUse.apply(this, arguments), g = p.hp - h0;
      try { if (g > 0) { var m = healMult(p, false); if (m !== 1) p.hp = Math.max(1, Math.min(p.mhp, h0 + Math.floor(g * m))); } } catch (e) {}
      return r;
    };
  }
  if (typeof window.allyTryPotion === 'function') {
    var oAp = window.allyTryPotion;
    window.allyTryPotion = function (ally) {
      if (!art(ally)) return oAp.apply(this, arguments);
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
    try { (typeof guardAliveList === 'function' ? guardAliveList() : []).forEach(function (x) { out.push([x, x.hp, 'guard']); }); } catch (e) {}
    return out;
  };
  var minionGuard = function () { var a = art(P()); return (a === 'm_shilen' || a === 'e_einhasad') ? a : null; };
  var minionBonus = function () { var p = P(), d = p.d || {}; return Math.floor(((Number(d.wis) || 0) + (Number(d.int) || 0)) * 1.2); };
  var takenMult = function (ent, et, mob, kind) {
    var m = 1, rally = anyArt('r_rally');
    if (rally && kind === 'phys') m *= 1 - 0.5 * F(rally);
    if (et !== 'player' && et !== 'ally') return m;
    var a = art(ent); if (!a) return m;
    var f = F(ent);
    if (a === 'r_rally') m *= 1 - 0.5 * f;
    if (a === 'w_fate' || a === 'n_heine') m *= 1 - 0.1 * f;
    if (a === 'w_fate') { var s = st(ent); if (tk() - s.shieldAt >= 50 / s.mode) { s.shieldAt = tk(); m *= 1 - 0.5 * f; } }
    if (a === 'i_life') m *= 1 - 0.5 * f;
    if (a === 'n_fafurion' && isFaf(mob)) m *= 1 - 0.9 * f;
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
  var afterTaken = function (snap, mob, kind) {
    var p = P(), g = minionGuard(), gb = g ? minionBonus() : 0;
    snap.forEach(function (row) {
      var e = row[0], h0 = row[1], et = row[2];
      var hNow = et === 'player' ? e.hp : (et === 'ally' ? e.curHp : e.hp);
      var lost = (h0 || 0) - (hNow || 0); if (!(lost > 0)) return;
      var mult = active ? takenMult(e, et, mob, kind) : 1, back = Math.floor(lost * (1 - mult));
      var C = window.AFK_CARD_COMBAT;
      if (C && C.finalBlock && (et === 'player' || et === 'ally') && C.finalBlock(e)) back = lost;   // 白羊座：完全抵銷
      else { var fdr = finalDR(e, et); if (fdr > 0) back += Math.min(lost - back, fdr); }
      if ((et === 'pet' || et === 'summon') && g) back += Math.min(lost - back, gb);
      if (back > 0) {
        if (et === 'player') e.hp += back;
        else if (et === 'ally') { e.curHp += back; if (e.curHp > 0 && e._downed) { e._downed = false; e._reviveCd = 0; } }
        else { e.hp += back; if (e.hp > 0 && e._downed) { e._downed = false; e._reviveCd = 0; delete e._diedAt; } }
        if (art(e) === 'i_life' && Math.random() < 0.1) log(tag('命術者', '#a78bfa') + nm(e) + '把傷害化為生命之力。', 'heal');
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
      finally { dmgDepth--; try { afterTaken(snap, mob, kind); } catch (e) { if (pendingKill) { pendingKill = false; window.killPlayer(); } } }
      return r;
    };
  };
  [['enemyPhysicalAttack', 'phys'], ['enemyAttackAlly', 'phys'], ['enemyAttackPet', 'phys'], ['enemyAttackSummon', 'phys'], ['enemyAttackGuard', 'phys'],
   ['applyMobMagic', 'magic'], ['applyMobMagicToAlly', 'magic'], ['applyMobMagicToPet', 'magic'], ['applyMobMagicToSummon', 'magic'], ['applyMobMagicToGuard', 'magic']]
    .forEach(function (x) { wrapTaken(x[0], x[1]); });

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
    if (a === 'k_doom') return { t: 10, mult: 10, show: 1 };
    if (a === 'n_fafurion' && isFaf(t || (typeof getTarget === 'function' ? getTarget() : null))) return { t: 10, mult: 10, show: 1 };
    if (a === 'i_sorc') return { t: 5, mult: 1, show: 5, min: true };
    return null;
  };
  var wpnMax = function (p) { var e = p.eq && p.eq.wpn, d = e && DB.items[e.id]; if (!d) return 2; return Math.max(Number(d.dmgS) || 0, Number(d.dmgL) || 0) + (Number(e.en) || 0); };
  var lastLeech = -1e9;
  var afterOut = function (actor, kind, snap, ent) {
    var a = art(actor), f = F(actor), normal = kind === 'atk', p = P();
    var hits = [], total = 0, prim = null, pl = 0;
    snap.forEach(function (x) { var lost = x[1] - Math.max(0, x[0].curHp); if (lost > 0) { hits.push([x[0], lost]); if (lost > pl) { pl = lost; prim = x[0]; } } });
    if (!hits.length) return;
    var fs = normal ? fast(actor, prim) : null, braved = false;
    if (normal && a === 'r_sword' && actor.buffs && actor.buffs.sk_royal_bravewill > 0 && Math.random() < 0.375 * f) braved = true;
    hits.forEach(function (h) {
      var m = h[0], lost = h[1], mult = 1, extra = 0;
      if (normal && actor.cls === 'knight') mult *= 2;   // 騎士一般攻擊傷害 ×2（玩家 2026-10-22）
      if (kind === 'sum') {
        var g = minionGuard();
        if (g) { extra += minionBonus(); if (g === 'e_einhasad' && ent && (ent.skId === 'sk_elf_summon' || ent.skId === 'sk_elf_summon2')) mult *= 5; if (ent && ent._afkFuse) mult *= ent._afkFuse; }
      } else if (a) {
        if (a === 'k_dark') { mult *= 1 + 2 * f; if (isDragon(m)) mult *= 1 + 0.5 * f; }
        if (a === 'i_sorc') mult *= 1 + f;
        if (a === 'w_arms' || a === 'w_fate') mult *= 1 + f;   // 百般武藝、命運迴響：傷害 ×2（玩家 2026-10-22）
        if (a === 'n_heine' && inHeine()) mult *= (1 + f) * (normal ? 1 + f : 1);
        if (normal) {
          if (fs && fs.mult > 1) mult *= 1 + (fs.mult - 1) * f;
          if (a === 'e_ruler' || a === 'd_time') mult *= 1 + 2 * f;
          if (a === 'n_fafurion' && isFaf(m)) mult *= 1 + 5 * f;
          if (braved && m === prim) mult *= 1.5;
        }
        if (a === 'd_magic' && kind === 'mag') extra += Math.floor(((Number(actor.d.wis) || 0) + (Number(actor.d.int) || 0)) * 1.5 * f * (isAllyObj(actor) ? 0.5 : 1));
      }
      if (normal && (m._afkWound || 0) > tk()) mult *= 1.2;   // 致命創傷（任何隊員的物理攻擊）
      var plus = Math.floor(lost * (mult - 1) + extra);
      if (plus > 0) { hurtMob(m, plus, actor) /* card-combat:arts-extra */; total += plus; }
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
      if (k > 0) { var kv = wpnMax(actor) * k; hurtMob(prim, kv, actor) /* card-combat:arts-flat */; }
      if (a === 'n_heine' && inHeine() && prim.curHp > 0 && Math.random() < 0.5 * f) { prim.curHp = 0; log(tag('海音守護者', '#38bdf8') + nm(actor) + '以守護者之力一擊抹殺了 ' + (prim.n || '敵人') + '！'); }
      if (a === 'r_sword') heal(actor, total * 0.3 * f);
      if (a === 'k_doom') heal(actor, total * f);
      if (a === 'n_fafurion' && isFaf(prim) && tk() - lastLeech >= 50) {
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
    log(tag('龍的一擊', '#fca5a5') + nm(actor) + '的劍中龍魂咆哮，衝擊貫穿了所有敵人！');
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
      if (kind === 'sum' && !minionGuard()) return o.apply(this, arguments);
      var snap = mobSnap(), r, prev = CTX; outDepth++; CTX = { actor: actor, kind: kind };
      try { r = o.apply(this, arguments); }
      finally { outDepth--; CTX = prev; try { afterOut(actor, kind, snap, arguments[0]); } catch (e) {} }
      return r;
    };
  };
  var me = function () { return P(); };
  // 無神論者：無法一般攻擊；命定絕望者在暗夢星迴 5 分鐘後也不能攻擊
  var oPA = window.playerAttack;
  window.playerAttack = function () { var p = P(); if (p && (athActive(p) || doomDead(p))) return; return oPA.apply(this, arguments); };
  var oAA = window.allyAttackOnce;
  window.allyAttackOnce = function (ally) { if (ally && (athActive(ally) || doomDead(ally))) return; return oAA.apply(this, arguments); };
  wrapOut('playerAttack', 'atk', me);
  wrapOut('dualWieldOffhandAttack', 'atk', me);
  wrapOut('allyAttackOnce', 'atk', function (a) { return a; });
  wrapOut('procFreeMagicSkill', 'mag', me);
  wrapOut('allyCastMagic', 'mag', function (a) { return a; });
  wrapOut('summonV2AttackOnce', 'sum', function (s, d, t, owner) { return (!owner || owner === P()) ? P() : null; });
  wrapOut('spiritAttackOnce', 'sum', function (s, t, owner) { return (!owner || owner === P()) ? P() : null; });
  wrapOut('petAttackOnce', 'sum', me);

  // 沐時者：會心一擊不耗 HP／MP（HP 不到一半也能放）；浴魔者：黑暗妖精魔法不耗 MP
  var freeCost = function (p, a, skId, self, args) {
    var sk = DB.skills[skId] || {}, hp0 = p.hp, mp0 = p.mp, dc = a === 'd_time' && sk.darkCrit, r;
    if (dc && p.mp > 0 && p.hp <= p.mhp * 0.5) p.hp = p.mhp;   // 核心要求 HP>50% 才放（因為要扣一半）；不扣血就不需要這個門檻
    try { r = oCast.apply(self, args); }
    finally {
      try {
        if (dc && !p.dead) { p.hp = hp0; if (p.mp < mp0) p.mp = mp0; }
        if (a === 'd_magic' && sk.reqD && p.mp < mp0) p.mp = mp0;
      } catch (e) {}
    }
    return r;
  };
  if (typeof window.allyDarkCrit === 'function') {   // 傭兵版會心一擊：只扣 MP → 沐時者不扣
    var oADC = window.allyDarkCrit;
    window.allyDarkCrit = function (ally) { var mp0 = ally && ally.mp, r = oADC.apply(this, arguments); try { if (ally && art(ally) === 'd_time' && ally.mp < mp0) ally.mp = mp0; } catch (e) {} return r; };
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
      try { var d = item && DB.items[item.id]; if (d && d.type === 'wpn' && art(P()) === 'k_doom') { logSys('<span class="text-amber-300">命定絕望者不能裝備武器。</span>'); return; } } catch (e) {}
      return oEq.apply(this, arguments);
    };
  }
  var stripWeapons = function (p) { try { if (typeof unequipItem !== 'function' || !p.eq) return; if (p.eq.offwpn) unequipItem('offwpn'); if (p.eq.wpn) unequipItem('wpn'); } catch (e) {} };

  // 席林眷屬：召喚術上限 20、召滿融合；殷海薩眷屬：屬性精靈 HP ×5
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
          log(tag('融合魔獸', '#c084fc') + L.length + ' 隻 ' + (one.form || '召喚物') + ' 融合成一隻融合魔獸！');
          try { if (typeof renderSummonPanel === 'function') renderSummonPanel(true); } catch (e) {}
        }
        if (r && a === 'e_einhasad' && (skId === 'sk_elf_summon' || skId === 'sk_elf_summon2')) {
          L.forEach(function (s) { s.hp = (s.hp || 0) * 5; s.mhp = (s.mhp || 0) * 5; s._afkGod = 1; });
          log(tag('元素神', '#fde047') + '殷海薩的祝福讓精靈化為元素神！');
        }
      } catch (e) {}
      return r;
    };
  }

  // 席林／殷海薩眷屬：寵物與召喚物命中、魔防 +(WIS+INT)×1.2
  ['_sumDeriveAny', 'petDerive'].forEach(function (fn) {
    var o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () {
      var r = o.apply(this, arguments);
      try { if (r && typeof r === 'object' && minionGuard()) { var b = minionBonus(); r = Object.assign({}, r, { hit: (Number(r.hit) || 0) + b, mr: (Number(r.mr) || 0) + b }); } } catch (e) {}
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
      var d = actor.d || {}, base = ((Number(d.int) || 0) + (Number(d.wis) || 0) + (Number(d.magicDmg) || 0)) * 8 * 1.5 * mult * 0.5 * F(actor);
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
        if (!s.doomLog) { s.doomLog = 1; log(tag('命定絕望者', '#f87171') + nm(p) + '的命運在此終結……（離開暗夢星迴才會恢復）', 'enemy'); }
      } else s.doomLog = 0;
      if (isLeader && p.eq && (p.eq.wpn || p.eq.offwpn) && !S().ff) stripWeapons(p);
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
    // 無神論者
    if (a === 'm_atheist' && inBattle()) {
      if (athActive(p)) {
        if (s.athSince == null || s.athSince < B.start) s.athSince = Math.max(B.start, s.athOff);
        if (t % (isLeader ? 50 : 100) === 0) { s.athEle = ((s.athEle || 0) + 1) % 4; castAttr5(p, 3, [s.athEle]); }
        if (!s.athFired && t - s.athSince >= 600) {
          s.athFired = true;
          var ms = MS();
          (ms.mobs || []).forEach(function (m) { if (m && m.curHp > 0 && !m._dead) hurtMob(m, (m.hp || m.curHp) * 0.2, p) /* card-combat:arts-timed */; });
          log(tag('無神論者', '#e879f9') + nm(p) + '否定了神——所有敵人失去 20% 生命！之後陷入虛弱（5 分鐘）。');
          s.athOff = t + 3000; s.athSince = null; reap(); refresh(p);
        }
      }
    }
    // 浴魔者：HP<30% 自動施放一輪四屬性五階五星魔法（每場一次）
    if (a === 'd_magic' && !s.lowCast && inBattle() && (hpOf(p) || 0) < (p.mhp || 1) * 0.3) { s.lowCast = true; log(tag('浴魔者', '#818cf8') + nm(p) + '在瀕死中釋放了四屬性魔法！'); castAttr5(p, 1, ELE_ORDER); }
    // 傭兵攻速上限
    if (!isLeader) { var fs = fast(p); if (fs) { var gone = p._afkFastAt == null ? fs.t : t - p._afkFastAt; p._atkCd = Math.max(1, fs.t - gone); } }
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
              // 席林眷屬融合魔獸：每 3 秒隨機施放一種魔法（法師公式）
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
        d: '看過無數次輪迴的女祭司。只為走過冥王域、重新開始的人傳授失落的技藝——每種職業兩門，只能擇一修習。' });
    }
    if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[NPC_ID]) NPC_SPR_FIXED[NPC_ID] = '949';
  } catch (e) {}
  var css = function () {
    if (document.getElementById('afk-arts-css')) return;
    var s = document.createElement('style'); s.id = 'afk-arts-css';
    s.textContent = '#afk-arts-modal{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:16px}' +
      '#afk-arts-modal .box{background:#1e1b2e;border:1px solid #7c3aed;border-radius:10px;max-width:640px;width:100%;max-height:90vh;overflow:auto;padding:16px;color:#e9d5ff}' +
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
      h += '<p class="afk-lore">「輪迴洗去了你的等級，卻洗不去刻在靈魂上的技藝。選吧，孩子。」</p><p class="note">每個職業兩門技藝，只能修習其中一門（不收費，可以回來改選）。</p>';
      Object.keys(ARTS).forEach(function (id) {
        var A = ARTS[id]; if (A.cls !== p.cls) return;
        var on = p.rebirthArt === id;
        h += '<div class="card' + (on ? ' on' : '') + '"><b>' + A.n + (on ? '（修習中）' : '') + '</b>' + (ARTS_LORE[id] ? '<p class="afk-lore">' + ARTS_LORE[id] + '</p>' : '') + '<p>' + A.d + '</p>' +
          '<button type="button" data-art="' + id + '"' + (on ? ' disabled' : '') + '>' + (on ? '已修習' : '修習這門技藝') + '</button></div>';
      });
      var k = kings();
      h += '<p class="note">四大天王：目前上場 ' + partyN + ' 人，全隊一般攻擊追加 ' + k + ' 次（每 4 人 +1，16 人＝5 次）。' + (partyN >= 16 ? '16 人上場：傭兵的技藝效果減半。' : '') + '</p>';
    }
    h += '<div class="card"><b>🧪 開發測試</b><p>把帳號裡所有角色（每個存檔位）一次變成：已轉生（保留 Lv100 的 HP／MP）、Lv150、六項屬性 200（面板 +50 是轉生效果）。會直接改寫存檔，建議先匯出備份。</p>' +
      '<button type="button" data-dev="1">全部角色轉生滿等</button></div>';
    if (!embedded) h += '<div style="text-align:right"><button type="button" data-close="1">關閉</button></div>';
    box.innerHTML = h;
  };
  var learn = function (id) {
    var p = P(); if (!p || !(p.rebirth > 0) || !ARTS[id] || ARTS[id].cls !== p.cls) return { ok: false, msg: '無法修習。' };
    p.rebirthArt = id;
    if (id === 'k_doom') stripWeapons(p);
    try { calcStats(); } catch (e) {}
    try { logSys('<span class="text-fuchsia-300 font-bold">✨ 你向奧拉奇里亞學會了「' + ARTS[id].n + '」。</span>'); } catch (e) {}
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
        var msg = '會把帳號裡所有角色改成轉生、Lv150、屬性 200，直接寫進存檔（無法復原）。確定嗎？';
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
  var devOne = function (p) {
    if (!(p.rebirth > 0)) { var k = keepOf(p); p.rebirth = 1; p.rebirthHpKeep = k.hp; p.rebirthMpKeep = k.mp; }
    maxOut(p); p.lv = 150; p.exp = 0;
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
    devOne(me); try { calcStats(); me.hp = me.mhp; me.mp = me.mmp; updateUI(); renderTabs(true); saveGame(); } catch (e) {}
    done.push(currentSlot + ':' + (me.name || me.cls));
    try { logSys('<span class="text-fuchsia-300 font-bold">🧪 測試：' + done.length + ' 個角色已轉生、Lv150、六項屬性 200。</span>'); } catch (e) {}
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
      if (npcId === NPC_ID) { try { embed(document.getElementById('interaction-content')); } catch (e) {} }
      return r;
    };
  }

  window.__afkArts = { ARTS: ARTS, LORE: ARTS_LORE, art: art, learn: learn, open: open, st: st, kings: kings, trySaves: trySaves, healMult: healMult, takenMult: takenMult, finalDR: finalDR,
    battle: function () { return B; }, partyN: function () { return partyN; }, _setParty: function (n) { partyN = n; }, _setActive: function (v) { active = v; }, isActive: function () { return active; } };
  // 衝擊之暈：命中時額外 500 真實傷害（玩家 2026-10-22；原本 +10，加在傷害計算之後＝不吃防禦）
  try { var ss = DB.skills.sk_shock_stun; if (ss && !ss._afk500) { ss.skillAddDmg = (ss.skillAddDmg || 0) + 500; ss._afk500 = true; } } catch (e) {}
  console.log('[AFK-arts] 已啟用：轉生技藝（奧拉奇里亞）');
})();
