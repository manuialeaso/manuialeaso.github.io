/* ============================================================================
 * afk-finalboss.js — 世界最終頭目：死亡女神 席琳（玩家 2026-10-25 指定）
 *
 * 世界觀
 *   席琳是光之女神殷海薩與破壞之神格蘭肯的長女，原本掌管「水」。她被逐出天界後與格蘭肯生下六龍，
 *   率子女反抗失敗，被封印在虛空；之後獻出力量平息炎魔叛亂而沉睡。她造出「死亡的世界」，讓萬物死後都歸於她。
 *   沉沒神殿＝天堂 W「席琳聖所」裡的「寂靜的水面」（席琳的內心世界）之下。
 *   本作的「瘋狂席琳」「席琳夢域鏡」「暗夢星迴」「冥王域」都是她的夢與她的國度；
 *   最終決戰就在夢的最底層——死亡之海下的沉沒神殿。
 *
 * 挑戰條件
 *   ‧世界必須是席琳夢域鏡；在席琳神殿向席琳祈禱的視窗下方出現入口
 *   ‧Lv100 以上（已轉生的角色不看等級）；每個角色只能挑戰一次（進場就算用掉；中途重新整理、回村、倒下都算輸）
 *   ‧區內不能傳送；20 分鐘內沒打倒，席琳發動「萬物歸於死」，挑戰失敗
 *
 * 結果
 *   ‧打倒：通關，得到「勝者的榮耀」光環
 *       全能力 +50（2026-11-03 加）、五屬性抗性 +100、AC −50、魔防 +50、受到一般攻擊時 10% 閃避、傷害減免 +10（轉生的面板 +50 另外照算）
 *       轉生時六大主屬性傳承：打倒當下的六大主屬性（含裝備），轉生後變成 Lv1 的基礎屬性（上限 200）
 *   ‧失敗：得到「絕望轉生者」光環——升級的 HP 成長改以體質 200 計算（只有這一項）
 *   ‧兩種結果都會開放冥王域的輪迴轉生
 *   ‧2026-10-25 修正：打倒＝當場點亮卡冊裡全部神話＋天上變身；失敗（絕望轉生者）＝轉生時送一件隨機「解除封印」聖衣
 *     （已經轉生過的角色也能挑戰一次：光環照給，聖衣當場送）
 *   ‧時空裂痕-冥王域：沒有挑戰過最終頭目不能輪迴轉生
 *
 * 初次輪迴（2026-10-29）：還沒轉生的人挑戰第一階層時，HP、防禦／抗性、傷害照 FB.novice 打折（見下方 FB.novice）
 * 戰鬥（以「16 人、轉生、全身昇華支配＋5、時空變身」為基準，約 10～15 分鐘）
 *   ‧動態血量（玩家 2026-10-28：不強制練滿 16 隻）：席琳與使徒的 HP ×（進場時隊伍人數 ÷ 16），最少 1 人份；次元突破者的單人試煉除外
 *   ‧頭目：HP 4.5 億（2026-10-29 前 3.5 億）、AC −100、減傷 40、魔防 500、四屬性抗性 400；一般攻擊 10D50＋200、每 2 秒；另有冥海之潮（冰凍）、亡者之槍
 *   ‧第一段（HP 100～75%）水之女神的殘影：每 20 秒「潮汐之嘆」全隊最大 HP 5%；每 30 秒「沉沒之鎖」隨機一人暈眩
 *   ‧第二段（75～50%）死亡的權柄：每 60 秒召喚「冥界的使徒」（HP 800 萬，場上最多 2 名），每名存活的使徒讓席琳受到的傷害 −15%；
 *       每 25 秒「死亡的權柄」隨機一人失去當前 HP 25%
 *   ‧第三段（50～25%）被放逐者之怒：傷害 ×1.5；每 15 秒「死亡宣告」隨機一人最大 HP 30%；每 40 秒「冥河氾濫」全隊最大 HP 10%
 *   ‧第四段（25%～）終焉：每 10 秒「席琳的擁抱」全隊最大 HP 7%，每名存活的使徒讓席琳回復最大 HP 0.3%；每 45 秒召喚使徒
 *   ‧20 分鐘：萬物歸於死（全滅＝失敗）
 *   2026-10-29 加難度（玩家：任何組合都要打 10 分鐘以上）：
 *   ‧HP 3.5 億 → 4.5 億
 *   ‧沉眠之海（時間封印）：75%／50%／25%／倒下 各有最早時間 2:30／5:00／7:30／10:00；（2026-10-31 14:11：最後一道「倒下 10:00」拿掉——打到 0 就算贏、當場離開，不用等封印結束）提早打到門檻時席琳沉入海底，
 *     HP 停在門檻、不受傷害，期間每 5 秒「沉沒的歌聲」全隊最大 HP 3%，時間到才浮上來
 *   ‧席琳的凝視（全程）：每 35 秒，全隊造成的傷害 −30%，持續 8 秒；開戰滿 5 分鐘起改成 −40%、持續 8 秒（玩家 2026-10-29 晚）
 *   ‧死亡之潮（第 3 段起）：每 25 秒，全隊每秒失去最大 HP 2%，持續 5 秒
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('dreamhell')) return;
  if (typeof DB === 'undefined' || !DB.mobs || typeof window.enterOblivionMap !== 'function' || typeof window.spawnMob !== 'function') { console.warn('[AFK-finalboss] 缺少核心函式，略過'); return; }

  var MAP = 'afk_final_sea', MAP_NAME = '死亡之海・席琳的沉沒神殿';
  var BOSS_ID = 'afk_final_shilen', ADD_ID = 'afk_final_apostle';
  var BOSS_NAME = '死亡女神 席琳', ADD_NAME = '冥界的使徒';
  var FB = { hp: 450000000, addHp: 8000000, addMax: 2, ac: -100, dr: 40, mr: 500, res: 400, atk: [10, 50], db: 200, hit: 250, spd: 2, limit: 1200,
    tide: 0.05, mark: 0.30, scepter: 0.25, flood: 0.10, embrace: 0.07, addDr: 0.15, addHeal: 0.003, rage: 1.5,
    // 2026-10-29 加難度：沉眠之海（時間封印）＋席琳的凝視＋死亡之潮
    gates: [[0.75, 150], [0.50, 300], [0.25, 450], [0, 600]], sealTide: 0.03, gaze: 0.30, gazeSec: 8, gazeEvery: 35, gazeLateAt: 300, gazeLate: 0.40, gazeLateSec: 8, waveEvery: 25, wavePct: 0.02, waveSec: 5 };
  FB.base = 16;
  // 2026-10-29（玩家：Lv100 第一次轉生打女神太強）：還沒轉生的人挑戰第一階層＝「初次輪迴」版本
  //   HP ×hp、AC／減傷／魔防／四屬性抗性 ×def、席琳方所有傷害 ×dmg（時間封印、凝視、死亡之潮照舊）
  // 2026-11-01 19:16（玩家：用 10/30 存檔測，要打超過 10 分鐘；隊伍遺物武器、防具 +5 約五成通關、+10 約八成，其餘一半暴斃一半打不完）：
  //   0.06／0.6／0.5 時 8 人 +0 遺物 8 分鐘就打完、沒人倒 → HP ×0.52、防禦照原版、傷害 ×0.87；侵蝕改成固定每秒 1%（afk-dreamboss）
  // 2026-11-01 22:22（玩家：+5 改成八成能過，不然只是在噁心人）：HP ×0.51、傷害 ×0.86——10 場 +5 贏 8（17.8～19.7 分）、現有 +0 贏 6
  FB.novice = { hp: 0.51, def: 1, dmg: 0.86 };
  FB.chainTicks = 30;   // 沉沒之鎖：必定暈眩 3 秒
  FB.blessHp = 1000000;   // 一轉女神：玩家巴黎的祝福（11-11 22:15）
  // 冥界的使徒倒下時自爆：全隊失去最大 HP 的這個比例（Ping 11-13 16:37：一轉 5%、二轉一階段 10%、二階段 15%、三階段 20%；單人試煉不爆）
  FB.blast = { r1: 0.05, r2a: 0.10, r2b: 0.15, r2c: 0.20 };
  window.__afkFinalCfg = FB;
  // 動態血量：隊伍人數（你＋還站著的傭兵）÷ 16，最多 1 倍
  var partyN = function () { try { return 1 + (player.allies || []).filter(function (a) { return a && !a._downed; }).length; } catch (e) { return 1; } };
  var hpScale = function (n) { n = Math.max(1, Math.floor(Number(n) || 1)); return Math.min(1, n / FB.base); };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var SEC = 10;
  var dreamOn = function () { try { return !!(player && player.sherineDream && player.sherineMad); } catch (e) { return false; } };
  var log = function (h) { try { if (!S().ff && typeof logCombat === 'function') logCombat(h, 'enemy'); } catch (e) {} };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var tag = function (t, c) { return '<span class="font-bold" style="color:' + (c || '#7dd3fc') + ';">【' + t + '】</span>'; };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  // ── 怪物與地圖 ──
  if (DB.mobs.ice_queen && !DB.mobs[BOSS_ID]) {
    var b = clone(DB.mobs.ice_queen);
    b.n = BOSS_NAME; b.lv = 120; b.boss = true; b.e = 'water'; b.race = '神族';
    b.exp = 0; b.goldMin = 0; b.goldMax = 0; b.noGold = true;
    b.mag = { skn: '冥海之潮', cd: 60, chance: 0.4, dmg: [12, 150], db: 300, ele: 'water', alwaysHit: true, sec: { type: 'freeze', pbase: 200 } };
    b.mag3 = { skn: '亡者之槍', cd: 40, dmg: [4, 600], db: 300, ele: 'water', alwaysHit: true };
    DB.mobs[BOSS_ID] = b;
  }
  if (DB.mobs.nm_033 && !DB.mobs[ADD_ID]) {
    var a = clone(DB.mobs.nm_033);
    a.n = ADD_NAME; a.lv = 110; a.boss = false; a.exp = 0; a.goldMin = 0; a.goldMax = 0; a.noGold = true; a.hp = 3000000;
    DB.mobs[ADD_ID] = a;
  }
  try { DB.maps[MAP] = [ADD_ID]; } catch (e) {}
  try { if (typeof ANTHARAS_AREA_NAMES !== 'undefined') ANTHARAS_AREA_NAMES[MAP] = MAP_NAME; } catch (e) {}
  try { if (typeof HUNT_BGM !== 'undefined') HUNT_BGM[MAP] = 'music133'; } catch (e) {}
  window.__afkNoOfflineMaps = (window.__afkNoOfflineMaps || []).concat([MAP]);
  // 動畫：席琳、使徒用專屬動畫（11-11 23:56 起；之前借冰之女王、死神）
  try {
    var get = function (n) { try { return (0, eval)(n); } catch (e) { return null; } };
    var names = get('MOB_ANIM_NAMES');
    var SETS = ['MOB_ANIM_NAMES', 'MOB_ANIM_BAKED_SHADOW', 'MOB_SHADOW_TINT', 'MOB_ANIM_BIG', 'MOB_ANIM_SMALL', 'MOB_ANIM_SPRITE_SHADOW', 'MOB_ANIM_WEAPON_FX', 'MOB_ANIM_WEAPON_FX2', 'MOB_ANIM_8DIR'].map(get);
    var OBJS = ['MOB_ANIM_SKILL_FX', 'MOB_YLIFT', 'MOB_ANIM_DEATH_FX', 'BOSS_ENTRANCE_FX', 'MOB_HURT_SFX', 'MOB_KILL_SFX', 'MOB_ATTACK_SFX'].map(get);
    // 11-11 23:56（Ping）：席琳、使徒換成 GPT 重繪的專屬動畫（assets/anim/死亡女神 席琳、assets/anim/冥界的使徒）；
    //   大小、音效、登場與死亡特效照舊借冰之女王／死神（方向、陰影、武器層這些跟圖有關的不借）
    var SAFE = { MOB_ANIM_BIG: 1, MOB_ANIM_SMALL: 1 };
    [[BOSS_NAME, '冰之女王'], [ADD_NAME, '死神']].forEach(function (pr) {
      if (!names || !names.add) return;
      names.add(pr[0]); if (typeof MOB_ANIM_ALIAS !== 'undefined') delete MOB_ANIM_ALIAS[pr[0]];
      ['MOB_ANIM_NAMES', 'MOB_ANIM_BAKED_SHADOW', 'MOB_SHADOW_TINT', 'MOB_ANIM_BIG', 'MOB_ANIM_SMALL', 'MOB_ANIM_SPRITE_SHADOW', 'MOB_ANIM_WEAPON_FX', 'MOB_ANIM_WEAPON_FX2', 'MOB_ANIM_8DIR'].forEach(function (k, i) { var st = SETS[i]; if (st && st.has && SAFE[k] && st.has(pr[1])) st.add(pr[0]); });
      OBJS.forEach(function (o, i) { if (i === 1) return; if (o && o[pr[1]] != null && o[pr[0]] == null) o[pr[0]] = o[pr[1]]; });   // 不借 MOB_YLIFT（是冰之女王的圖用的高度修正）
    });
    // 各階層的名字（席琳夢境／席琳幻影／席琳伴身＋名字）也用同一套圖
    try { ['席琳夢境', '席琳幻影', '席琳伴身'].forEach(function (tn) { var nm = tn + ' ' + BOSS_NAME; if (names && names.add) names.add(nm); if (typeof MOB_ANIM_ALIAS !== 'undefined') { if (tn === '席琳夢境') MOB_ANIM_ALIAS[nm] = BOSS_NAME; else delete MOB_ANIM_ALIAS[nm]; }   /* 11-12：幻影、伴身有自己的換色版（assets/anim/席琳幻影 死亡女神 席琳、席琳伴身 死亡女神 席琳；施法沿用本體） */ SETS.forEach(function (st) { if (st && st.has && st.has(BOSS_NAME)) st.add(nm); }); OBJS.forEach(function (o, i) { if (i === 1) return; if (o && o[BOSS_NAME] != null && o[nm] == null) o[nm] = o[BOSS_NAME]; }); }); } catch (e) {}
  } catch (e) {}

  // ── 狀態 ──
  var rec = function (p) { p = p || player; return p && p.afkFinal && typeof p.afkFinal === 'object' ? p.afkFinal : null; };
  var won = function (p) { var r = rec(p); return !!(r && r.result === 'win' && !r.pending); };
  var lost = function (p) { var r = rec(p); return !!(r && r.result === 'lose' && !r.pending); };
  var on = function () { return !!(S()._afkFinal && mapState && mapState.current === MAP); };
  // 2026-10-26 二轉：'first'＝第一次決戰；'second'＝二轉決戰（席琳方傷害 +5%）；'solo'＝次元突破者單人重打（席琳方傷害 −100%、防禦與抗性 −50%）
  var mode = function () { return S()._afkFinalMode || 'first'; };
  // 2026-10-29 晚：終焉三階層——'first'＝第一階層「席琳夢境」、'tier2'＝第二階層「席琳幻影」（HP、傷害 ×1.25）、'tier3'＝第三階層「席琳伴身」（×1.5625，只能挑戰一次）
  // 2026-11-04 03:14（玩家）：第二階層的席琳 HP 再 ×0.70（hpK；傷害照 ×1.25，使徒 HP 照 ×1.25）→ 席琳 HP 合計 ×0.875
  var TIER = { first: { n: '席琳夢境', k: 1 }, tier2: { n: '席琳幻影', k: 1.25, hpK: 0.70 }, tier3: { n: '席琳伴身', k: 1.30 } };
  var tierK = function () { var t = TIER[mode()]; return t ? t.k : 1; };
  var tierHpK = function () { var t = TIER[mode()]; return t ? t.k * (t.hpK || 1) : 1; };   // 只用在席琳本人的 HP
  var novice = function () { return mode() === 'first' && !!S()._afkFinalNovice; };
  var modeMult = function () { var m = mode(); return m === 'solo' ? 0 : m === 'second' ? 1.05 : tierK() * (novice() ? noviceDmg() : 1); };
  // 初次輪迴的傷害也看人數（玩家 2026-10-29：8 人也要打得過）：×(0.5＋0.5×人數÷16)；16 人＝FB.novice.dmg、8 人 ×0.75、4 人 ×0.625
  var noviceDmg = function () { var sc = Math.min(1, Math.max(0, Number(S()._afkFinalScale) || 1)); return FB.novice.dmg * (0.5 + 0.5 * sc); };
  (window.__afkTakenMods = window.__afkTakenMods || []).push(function (ent, mob) { return (on() && mob && (mob._afkFinal || mob._afkApostle)) ? modeMult() : 1; });
  var bossOf = function () { return (mapState.mobs || []).filter(function (m) { return m && m._afkFinal && !m._dead && m.curHp > 0; })[0] || null; };
  var addsAlive = function () { return (mapState.mobs || []).filter(function (m) { return m && m._afkApostle && !m._dead && m.curHp > 0; }).length; };
  var members = function () { var out = []; if (!player.dead) out.push(player); (player.allies || []).forEach(function (x) { if (x && !x._downed && (x.curHp || 0) > 0) out.push(x); }); return out; };
  var nameOf = function (t) { return t === player ? '你' : '協力·' + (t._allyName || '傭兵'); };
  var hurt = function (t, dmg, why) {
    var mm = modeMult(); if (!(mm > 0)) return false;
    dmg = Math.max(1, Math.floor(dmg * mm));
    if (window.__afkPetTank) { dmg = window.__afkPetTank.split(t, dmg); if (!(dmg > 0)) return false; }   // 寵物頑強抵抗：出戰寵物分擔（afk-pettank.js）
    if (typeof window.__afkTrueCut === 'function') dmg = window.__afkTrueCut(t, dmg);   // 符文「骸」：真實傷害減免
    if (typeof window.__afkIncomingMod === 'function') { try { dmg = Math.max(1, Math.floor(window.__afkIncomingMod(t, dmg))); } catch (e) {} }   // 隱藏規則「命運」等：受到的傷害（afk-fate.js）
    if (typeof window.__afkFbHurtMod === 'function') { try { dmg = window.__afkFbHurtMod(t, dmg, why); } catch (e) {} if (!(dmg > 0)) return false; }   // 魔物獵人：S 級冒險者的減傷與護盾（afk-hunter.js）
    if (t === player) { player.hp -= dmg; if (player.hp <= 0 && typeof killPlayer === 'function') { killPlayer(); return true; } }
    else { t.curHp -= dmg; if (t.curHp <= 0) { t.curHp = 0; t._downed = true; t._reviveCd = 150; log('<span class="text-amber-400 font-bold">協力傭兵 ' + (t._allyName || '') + ' 被' + why + '擊倒。</span>'); } }
    return false;
  };
  var blastKey = function () { var md = mode(); if (md === 'first') return novice() ? 'r1' : 'r2a'; return { second: 'r2a', tier2: 'r2b', tier3: 'r2c' }[md] || null; };
  var blast = function (m) {
    var k = blastKey(), pct = k && FB.blast[k]; if (!pct || !player || player.dead) return;
    log(tag('亡者自爆', '#f43f5e') + ADD_NAME + '倒下時炸開了冥界的魂火，全隊失去最大 HP ' + Math.round(pct * 100) + '%。');
    var mm = modeMult(); pctAll(mm > 0 ? pct / mm : pct, '亡者自爆');   // hurt 會再乘模式倍率，這裡先除掉，實際就是上面寫的比例
  };
  var pctAll = function (pct, why) { var dead = false; members().forEach(function (x) { if (!dead) dead = hurt(x, (x.mhp || 1) * pct, why); }); return dead; };
  var pick = function () { var t = members(); return t.length ? t[Math.floor(Math.random() * t.length)] : null; };

  // ── 出怪：中央格只出席琳一次；其他格不自然出怪（使徒由席琳召喚）──
  var oSpawn = window.spawnMob;
  window.spawnMob = function (idx) {
    if (!on()) return oSpawn.apply(this, arguments);
    if (idx !== 1 || S()._afkFinalSpawned) return;
    var base = DB.mobs[BOSS_ID]; if (!base) return;
    var m = Object.assign(clone(base), { curHp: base.hp, uid: uid(), _born: ++_mobBornSeq, _bornMs: Date.now(), _magCd: {}, justHit: false, st: newMobStatus() });
    mapState.mobs[idx] = m;
    try { applySherineBuff(idx); } catch (e) {}
    m = mapState.mobs[idx];
    m._afkFinal = true; m._fbBorn = S().ticks || 0; m._fbPhase = 1;
    var n = partyN(); S()._afkFinalParty = n; S()._afkFinalScale = mode() === 'solo' ? 1 : hpScale(n);   // 單人試煉本來就是一個人打（席琳不出手），維持原本血量
    S()._afkFinalNovice = mode() === 'first' && !(player.rebirth > 0);
    var nv = novice() ? FB.novice : { hp: 1, def: 1 };
    m.hp = m.curHp = Math.round(FB.hp * S()._afkFinalScale * tierHpK() * nv.hp); m.ac = Math.round(FB.ac * nv.def); m.dr = FB.dr * nv.def; m.mr = Math.round(FB.mr * nv.def); m.hard = false; m.hardSkin = 0;
    ['resFire', 'resWater', 'resWind', 'resEarth'].forEach(function (k) { m[k] = Math.round(FB.res * nv.def); });
    // 11-11 22:15（Ping）：一轉女神 AC 再 −50（−100 → −150）；玩家巴黎獻上祝福，HP 再 +1,000,000
    if (novice()) { m.ac -= 50; m.hp += FB.blessHp; m.curHp = m.hp; }
    m.dmg = FB.atk.slice(); m.db = FB.db; m.hit = FB.hit; m.atkSpd = FB.spd;
    m._noBossRegen = true; m.regenHp = 0; m._dreamRegen = 0; m.exp = 0; m.goldMin = 0; m.goldMax = 0; m.noGold = true;
    m._fbRage = m.rageDmgMult || 1;
    if (TIER[mode()]) m.n = TIER[mode()].n + ' ' + BOSS_NAME;
    if (mode() === 'solo') { m.ac = Math.round(FB.ac * 0.5); m.dr = FB.dr * 0.5; m.mr = FB.mr * 0.5; ['resFire', 'resWater', 'resWind', 'resEarth'].forEach(function (k) { m[k] = FB.res * 0.5; }); }
    S()._afkFinalSpawned = true;
    if (novice()) sys('<span class="font-bold" style="color:#fde68a">✨ 由於 玩家巴黎 獻上祝福，女神血量微微增加。</span>');
    if (novice()) sys('<span class="text-cyan-200">初次輪迴：席琳還沒認真看待你——她的 HP 只有平常的一半左右，造成的傷害也比較低（隊伍人數越少，她的傷害越低）。</span>');
    if (S()._afkFinalScale < 1) sys('<span class="text-cyan-200">隊伍 ' + S()._afkFinalParty + ' 人：席琳的 HP 調整為 ' + m.hp.toLocaleString() + '（' + S()._afkFinalParty + '／' + FB.base + '），冥界的使徒同比例。</span>');
    // Ping 11-13 16:27：穿著異常檢查封印的 S 級道具時，女神多喊一句（只是台詞，戰鬥照常）
    try { if (window.__afkAcSealedOn && window.__afkAcSealedOn(player) > 0) setTimeout(function () { sys('<span class="font-bold" style="color:#e879f9;">' + BOSS_NAME + '：</span><span class="afk-lore">「非正規之人啊……」</span>'); }, 0); } catch (e) {}
    sys('<span class="font-bold" style="color:#7dd3fc;">死亡之海的水面倒映著無數亡者的臉。沉沒神殿的最深處，' + BOSS_NAME + '緩緩睜開了眼睛。</span><span class="afk-lore">「孩子……你終於走到夢的盡頭了。……你也是被送來的嗎？」</span>');
    if (typeof vfxBossEntrance === 'function') { try { vfxBossEntrance(m); } catch (e) {} }
    if (!S().ff) { try { renderMobs(); } catch (e) {} }
  };
  var summon = function (n) {
    var base = DB.mobs[ADD_ID]; if (!base) return 0;
    n = Math.max(0, Math.min(n, FB.addMax - addsAlive()));   // 場上最多 2 名使徒
    var k = 0;
    for (var i = 0; i < mapState.mobs.length && k < n; i++) {
      var x = mapState.mobs[i]; if (x && !x._dead && x.curHp > 0) continue;
      var m = Object.assign(clone(base), { curHp: base.hp, uid: uid(), _born: ++_mobBornSeq, _bornMs: Date.now(), _magCd: {}, justHit: false, st: newMobStatus() });
      mapState.mobs[i] = m;
      try { applySherineBuff(i); } catch (e) {}
      m = mapState.mobs[i]; m._afkApostle = true; m.hp = m.curHp = Math.round(FB.addHp * (S()._afkFinalScale || 1) * tierK() * (novice() ? FB.novice.hp : 1)); m.exp = 0; m.noGold = true;
      k++;
    }
    if (k && !S().ff) { try { renderMobs(); } catch (e) {} }
    return k;
  };

  // ── 沉眠之海：每道門檻有最早時間；還沒到時間，HP 停在門檻（window.__afkFbNoGate 可關，給平衡測試用）──
  var ageOf = function (m) { var t = S().ticks || 0; return Math.max(0, t - (m && Number.isFinite(m._fbBorn) ? m._fbBorn : t)); };
  // 倒數與逾時判定使用同一組戰鬥 ticks，不額外啟動計時器、不寫入存檔。
  var clockState = function () {
    if (!on() || !player || player.dead) return null;
    var m = bossOf(), limit = Math.max(0, Number(FB.limit) || 0);
    var left = Math.max(0, Math.ceil(limit - (m ? ageOf(m) / SEC : 0)));
    var labels = { first: '女神夢境', tier2: '女神幻影', tier3: '女神伴身', second: '二轉決戰', solo: '單人試煉' };
    return { seconds: left, text: String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0'),
      label: labels[mode()] || '女神決戰', waiting: !m, tone: left <= 60 ? 'danger' : left <= 180 ? 'warning' : 'normal' };
  };
  var renderClock = function () {
    var clock = document.getElementById('afk-final-clock'), data = clockState();
    if (!data) { if (clock && !clock.hidden) clock.hidden = true; return; }
    if (S().ff || document.hidden) return;
    var host = document.getElementById('map-adventure-heading'); if (!host) return;
    if (!clock) {
      clock = document.createElement('span'); clock.id = 'afk-final-clock'; clock.className = 'afk-final-clock';
      clock.setAttribute('role', 'timer'); clock.setAttribute('aria-live', 'off');
      clock.innerHTML = '<span class="afk-final-clock-label"></span><strong></strong><small></small>';
      host.appendChild(clock);
    }
    if (clock.parentElement !== host) host.appendChild(clock);
    if (clock.hidden) clock.hidden = false;
    var key = data.label + ':' + data.text + ':' + data.waiting;
    if (clock.dataset.value === key) return;
    clock.dataset.value = key; clock.dataset.tone = data.tone;
    clock.querySelector('.afk-final-clock-label').textContent = data.label;
    clock.querySelector('strong').textContent = data.text;
    clock.querySelector('small').textContent = data.waiting ? '待開戰' : '剩餘';
    clock.setAttribute('aria-label', data.label + '，剩餘 ' + data.text + (data.waiting ? '，等待女神登場' : ''));
  };
  document.addEventListener('visibilitychange', function () { if (!document.hidden) renderClock(); });
  var gateOf = function (m) {
    if (window.__afkFbNoGate || mode() === 'solo') return null;
    var age = ageOf(m);
    for (var i = 0; i < FB.gates.length; i++) { var g = FB.gates[i]; if (!(g[0] > 0)) continue; if (age < g[1] * SEC) return g; }   // 最後一道（倒下）不再等：打到 0 就算贏、當場離開（玩家 2026-10-31 14:11）
    return null;
  };
  var seal = function (m, g) {
    if (m._fbSealGate === g[1]) return;
    m._fbSealGate = g[1];
    var left = Math.max(0, Math.ceil((g[1] * SEC - ageOf(m)) / SEC));
    log(tag('沉眠之海', '#0ea5e9') + BOSS_NAME + '沉入海底，傷害無法觸及她（' + left + ' 秒後浮上來）。海底傳來沉沒的歌聲……');
  };
  (window.LineageAbsoluteDamageGates = window.LineageAbsoluteDamageGates || []).push(function(actor,target,amount){
    if(target&&target._afkFinal){var g=gateOf(target);if(g){var floorHp=Math.max(1,Math.ceil(target.hp*g[0]));amount=Math.min(amount,Math.max(0,target.curHp-floorHp));if(!amount)seal(target,g);}}return amount;
  });
  // ── 傷害：存活的使徒讓席琳受到的傷害 −20%／名 ──
  var hooked = false;
  var hookDamage = function () {
    var C = window.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return;
    hooked = true;
    var oD = C.damage;
    C.damage = function (actor, target, amount) {
      var r = oD.apply(this, arguments);
      try { if (r > 0 && target && (target._afkFinal || target._afkApostle) && typeof window.__afkFbOutMod === 'function') r = Math.max(1, Math.floor(window.__afkFbOutMod(actor, target, r))); } catch (e) {}   // 魔物獵人：S 級冒險者攻擊 +10%（在封印門檻判斷之前）
      try { if (target && target._afkFinal && r > 0) { var n = addsAlive(); if (n) r = Math.max(1, Math.floor(r * Math.pow(1 - FB.addDr, n))); } } catch (e) {}
      try {
        if (target && (target._afkFinal || target._afkApostle) && r > 0 && on() && (S()._afkGazeUntil || 0) > (S().ticks || 0)) { var gzp = S()._afkGazePct || FB.gaze; if (typeof window.__afkFbGazeMod === 'function') { try { gzp = window.__afkFbGazeMod(actor, gzp); } catch (e) {} } r = Math.max(1, Math.floor(r * (1 - gzp))); }
        if (target && target._afkFinal && r > 0) { var g = gateOf(target); if (g) { var floorHp = Math.max(1, Math.ceil(target.hp * g[0])); if (target.curHp - r < floorHp) { r = Math.max(0, target.curHp - floorHp); seal(target, g); } } }
      } catch (e) {}
      return r;
    };
  };

  // ── 煙霧：全隊命中 −50%（玩家重算時套；傭兵直接改面板、時間到換回）──
  var SMOKE = { every: 60, sec: 10, k: 0.5 }, HITS = ['meleeHit', 'rangedHit', 'magicHit'];
  var smokeOn = function (x) { return !!(x && x._afkSmokeUntil && (S().ticks || 0) <= x._afkSmokeUntil); };
  var smoke = function () {
    var until = (S().ticks || 0) + SMOKE.sec * SEC;
    members().forEach(function (x) {
      x._afkSmokeUntil = until;
      if (x === player) return;
      if (x.d && !(x._afkSmokeSave && x._afkSmokeSave.d === x.d)) { var sv = { d: x.d }; HITS.forEach(function (k) { sv[k] = Number(x.d[k]) || 0; x.d[k] = sv[k] > 0 ? Math.floor(sv[k] * (1 - SMOKE.k)) : sv[k]; }); x._afkSmokeSave = sv; }
    });
    try { recomputeStats(); } catch (e) {}
    log(tag('煙霧', '#94a3b8') + BOSS_NAME + '吐出灰色的煙霧籠罩神殿——全隊所有命中 −' + Math.round(SMOKE.k * 100) + '%（' + SMOKE.sec + ' 秒）。');
  };
  var smokeTick = function () {
    var t = S().ticks || 0;
    if (player && player._afkSmokeUntil && t > player._afkSmokeUntil) { player._afkSmokeUntil = 0; try { recomputeStats(); } catch (e) {} }
    (player && player.allies || []).forEach(function (x) {
      if (!x || !x._afkSmokeSave || smokeOn(x)) return;
      var sv = x._afkSmokeSave; x._afkSmokeSave = null; x._afkSmokeUntil = 0;
      if (x.d === sv.d) HITS.forEach(function (k) { x.d[k] = sv[k]; });   // 面板重建過＝已經是原本的了
    });
  };
  if (typeof window.recomputeStats === 'function') {
    var oReSm = window.recomputeStats;
    window.recomputeStats = function () {
      var r = oReSm.apply(this, arguments);
      try { if (player && player.d && smokeOn(player)) HITS.forEach(function (k) { var v = Number(player.d[k]) || 0; if (v > 0) player.d[k] = Math.floor(v * (1 - SMOKE.k)); }); } catch (e) {}
      return r;
    };
  }

  // ── 時間軸 ──
  var every = function (age, sec) { return age > 0 && age % (sec * SEC) === 0; };
  var phaseName = ['', '水之女神的殘影', '死亡的權柄', '被放逐者之怒', '終焉'];
  var timeline = function () {
    try { smokeTick(); } catch (e) {}
    if (!on() || player.dead) return;
    hookDamage();
    var m = bossOf(); if (!m) return;
    var t = S().ticks || 0, age = ageOf(m);
    var gt = gateOf(m);
    if (gt) { var fh = Math.max(1, Math.ceil(m.hp * gt[0])); if (m.curHp < fh) { m.curHp = fh; seal(m, gt); } }
    var sealed = gt && m._fbSealGate === gt[1] && m.curHp <= Math.max(1, Math.ceil(m.hp * gt[0]));
    if (sealed && every(age, 5)) { if (pctAll(FB.sealTide, '沉沒的歌聲')) return; }
    if (every(age, FB.gazeEvery)) {
      var late = age >= FB.gazeLateAt * SEC, gp = late ? FB.gazeLate : FB.gaze, gs = late ? FB.gazeLateSec : FB.gazeSec;
      S()._afkGazeUntil = t + gs * SEC; S()._afkGazePct = gp;
      log(tag('席琳的凝視', '#e879f9') + (late ? '死亡女神的目光變得更冷、更沉，' : '死亡女神的目光掃過神殿，') + '所有人的手都沉重起來（造成的傷害 −' + Math.round(gp * 100) + '%，' + gs + ' 秒）。');
    }
    // 煙霧（玩家 2026-10-30 20:43，一轉女神＝初次輪迴）：每 1 分鐘，100% 命中，全隊所有命中 −50%，10 秒
    if (novice() && every(age, SMOKE.every)) smoke();   // 一轉女神＝還沒轉生、Lv100 第一次打席琳（初次輪迴）；第一階層（通往二轉）不放（玩家 2026-10-30 21:46）
    var pct = m.curHp / (m.hp || 1);
    var ph = pct > 0.75 ? 1 : pct > 0.5 ? 2 : pct > 0.25 ? 3 : 4;
    if (ph > (m._fbPhase || 1)) {
      m._fbPhase = ph; m._fbPhaseAt = age;
      var line = ['', '', '「死亡是我僅剩的東西了。」', '「被放逐的，是我；被遺忘的，也是我。現在輪到你們了。」', '「回去吧……別再往下沉了。」'][ph];
      sys('<span class="font-bold" style="color:#7dd3fc;">' + tag('第' + ph + '段・' + phaseName[ph], '#7dd3fc') + line + '</span>');
      if (ph === 2) summon(2);
      if (ph === 3) m.rageDmgMult = (m._fbRage || 1) * FB.rage;
    }
    var pa = age - (m._fbPhaseAt || 0);
    if (ph === 1) {
      if (every(age, 20)) { log(tag('潮汐之嘆', '#38bdf8') + '冰冷的潮水漫過腳踝，全隊失去最大 HP ' + Math.round(FB.tide * 100) + '%。'); if (pctAll(FB.tide, '潮汐之嘆')) return; }
      if (every(age, 30)) { var s1 = pick(); if (s1) { log(tag('沉沒之鎖', '#38bdf8') + '水底伸出的鎖鏈纏住了' + nameOf(s1) + '。'); try { var B1 = window.AFK_RELIC_DEFENSE_BRIDGE; if (B1 && B1.setStatus) B1.setStatus(s1, 'stun', FB.chainTicks, m); else if (s1.statuses) s1.statuses.stun = FB.chainTicks; } catch (e) {} /* 11-11 22:15：必中（原本走魔防判定，魔防 250 以上永遠不會中） */ } }
    } else if (ph === 2) {
      if (every(pa, 60)) { var k2 = summon(2); if (k2) log(tag('亡者之潮', '#a78bfa') + BOSS_NAME + '自海底喚起 ' + k2 + ' 名' + ADD_NAME + '。（每名存活的使徒讓席琳受到的傷害 −15%）'); }
      if (every(pa, 25)) { var s2 = pick(); if (s2) { log(tag('死亡的權柄', '#a78bfa') + BOSS_NAME + '指向' + nameOf(s2) + '，奪走其現有生命的 ' + Math.round(FB.scepter * 100) + '%。'); if (hurt(s2, (s2 === player ? player.hp : s2.curHp) * FB.scepter, '死亡的權柄')) return; } }
    } else if (ph === 3) {
      if (every(pa, FB.waveEvery)) { m._fbWaveUntil = age + FB.waveSec * SEC; log(tag('死亡之潮', '#f43f5e') + '黑色的潮水湧進神殿，全隊每秒失去最大 HP ' + Math.round(FB.wavePct * 100) + '%（' + FB.waveSec + ' 秒）。'); }
      if (every(pa, 15)) { var s3 = pick(); if (s3) { log(tag('死亡宣告', '#f43f5e') + nameOf(s3) + ' 的名字被刻上冥河的石碑，受到最大 HP ' + Math.round(FB.mark * 100) + '% 的傷害。'); if (hurt(s3, (s3.mhp || 1) * FB.mark, '死亡宣告')) return; } }
      if (every(pa, 40)) { log(tag('冥河氾濫', '#f43f5e') + '冥河的水灌進神殿，全隊失去最大 HP ' + Math.round(FB.flood * 100) + '%。'); if (pctAll(FB.flood, '冥河氾濫')) return; }
      if (every(pa, 60)) summon(2);
    } else {
      if (every(pa, FB.waveEvery)) { m._fbWaveUntil = age + FB.waveSec * SEC; log(tag('死亡之潮', '#f43f5e') + '黑色的潮水湧進神殿，全隊每秒失去最大 HP ' + Math.round(FB.wavePct * 100) + '%（' + FB.waveSec + ' 秒）。'); }
      if (every(pa, 10)) {
        var n4 = addsAlive();
        log(tag('席琳的擁抱', '#e879f9') + '死亡女神張開雙臂，全隊失去最大 HP ' + Math.round(FB.embrace * 100) + '%' + (n4 ? '；' + n4 + ' 名使徒的魂火流回她的身體' : '') + '。');
        if (n4) m.curHp = Math.min(m.hp, m.curHp + Math.floor(m.hp * FB.addHeal * n4));
        if (pctAll(FB.embrace, '席琳的擁抱')) return;
      }
      if (every(pa, 45)) summon(2);
    }
    if ((m._fbWaveUntil || 0) > age && age % SEC === 0) { if (pctAll(FB.wavePct, '死亡之潮')) return; }
    if (age >= FB.limit * SEC) {
      sys('<span class="text-red-500 font-bold">' + tag('萬物歸於死', '#ef4444') + '席琳闔上雙眼，死亡之海吞沒了神殿裡的一切生命。</span>');
      (player.allies || []).forEach(function (x) { if (x && !x._downed) { x.curHp = 0; x._downed = true; x._reviveCd = 150; } });
      finish('lose', '時間耗盡');
    }
  };

  // ── 結算 ──
  var PANEL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  var samsaraGift = function (p) {
    try {
      var A = window.AFK_CARD_ASCENSION; if (!A || !A.catalog || !A.catalog.samsara || !A.catalog.samsara.length) return null;
      var ca = p.cardAscension || (p.cardAscension = { v: 1 }); ['owned', 'sealed', 'unlocked'].forEach(function (k) { ca[k] = ca[k] || {}; });
      var pool = A.catalog.samsara.filter(function (r) { return !(ca.owned[r.id] && !ca.sealed[r.id]); });
      if (!pool.length) pool = A.catalog.samsara;
      var r = pool[Math.floor(Math.random() * pool.length)];
      ca.owned[r.id] = true; delete ca.sealed[r.id]; ca.copies = ca.copies || {}; ca.copies[r.id] = Math.max(2, ca.copies[r.id] || 0);
      return r.form && r.form.n || r.id;
    } catch (e) { return null; }
  };
  // 勝者的榮耀：點亮卡冊裡全部神話與天上變身（沒點亮的設為 0 星；已點亮的星數不動）
  var lightCodex = function (p) {
    try {
      var A = window.AFK_CARD_ASCENSION; if (!A || !A.catalog) return 0;
      var ca = p.cardAscension || (p.cardAscension = { v: 1 }); ['owned', 'sealed', 'unlocked', 'copies'].forEach(function (k) { ca[k] = ca[k] || {}; });
      var n = 0;
      ['mythic', 'celestial'].forEach(function (t) { (A.catalog[t] || []).forEach(function (r) { if (ca.owned[r.id]) return; ca.owned[r.id] = true; ca.copies[r.id] = 1; n++; }); });
      ca.unlocked.mythic = true; ca.unlocked.celestial = true;
      return n;
    } catch (e) { return 0; }
  };
  var finish = function (result, why) {
    var s = S(); if (!s._afkFinal) return;
    var md = mode();
    if (md === 'tier2' || md === 'tier3') {
      s._afkFinal = false; s._afkFinalSpawned = false; s._afkFinalNovice = false; s.antharas = 0; s._antAdvance = false; s._afkFinalMode = null;
      renderClock();
      try { if (window.__afkFinalTiers) window.__afkFinalTiers.finish(md, result, why); } catch (e) { console.warn('[AFK-finalboss] 終焉階層結算', e); }
      try { if (!player.dead) { setMapSelectors(typeof getLastTown === 'function' ? getLastTown() : 'town_aden'); changeMap(true); } } catch (e) {}
      try { calcStats(); updateUI(); saveGame(); } catch (e) {}
      return;
    }
    if (md !== 'first') {
      s._afkFinal = false; s._afkFinalSpawned = false; s._afkFinalNovice = false; s.antharas = 0; s._antAdvance = false; s._afkFinalMode = null;
      renderClock();
      try { if (window.__afkRebirth2) window.__afkRebirth2.finish(md, result, why); } catch (e) { console.warn('[AFK-finalboss] 二轉結算', e); }
      try { if (!player.dead) { setMapSelectors(typeof getLastTown === 'function' ? getLastTown() : 'town_aden'); changeMap(true); } } catch (e) {}
      try { calcStats(); updateUI(); saveGame(); } catch (e) {}
      return;
    }
    var r = rec() || {};
    r.result = result; r.pending = false; r.at = Date.now(); r.why = why || '';
    if (result === 'win') { r.panel = {}; PANEL.forEach(function (k) { r.panel[k] = Math.floor((player.d && player.d[k]) || 0); }); }
    player.afkFinal = r;
    s._afkFinal = false; s._afkFinalSpawned = false; s._afkFinalNovice = false; s.antharas = 0; s._antAdvance = false;
    renderClock();
    var gift = null;
    // 2026-10-25 玩家指定：勝者的榮耀＝當場點亮神話＋天上全部卡冊；聖衣只給絕望轉生者（轉生時送，已轉生者當場送）
    var lit = -1;
    if (result === 'win' && !r.codexLit) { lit = lightCodex(player); r.codexLit = true; r.gifted = true; }
    if (player.rebirth > 0) { r.rebirthApplied = true; if (result !== 'win' && !r.gifted) { gift = samsaraGift(player); r.gifted = true; } }   // 已轉生：光環照給，不再套轉生傳承
    if (result === 'win') {
      sys('<span class="font-bold" style="color:#fde047;">🏆 ' + BOSS_NAME + '的身影化作千萬滴海水落下。</span><span class="afk-lore">「……原來，還有人願意走到這裡。去吧，回到生者的世界……別回頭看天上的光。」</span>'
        + '<span class="text-amber-200">通關！得到光環「勝者的榮耀」：全能力 +50、五屬性抗性 +100、AC −50、魔防 +50、受到一般攻擊 10% 閃避、傷害減免 +10。' + (player.rebirth > 0 ? '' : '時空裂痕-冥王域的輪迴已向你敞開（轉生時六大主屬性會傳承）。') + '</span>');
    } else {
      sys('<span class="font-bold text-slate-200">你倒在沉沒神殿冰冷的石階上（' + (why || '挑戰失敗') + '）。</span><span class="afk-lore">「別害怕。絕望，也是一種重生的方式。」</span>'
        + '<span class="text-fuchsia-200">得到光環「絕望轉生者」：升級時的 HP 成長以體質 200 計算。' + (player.rebirth > 0 ? '' : '時空裂痕-冥王域的輪迴已向你敞開。') + '</span>');
    }
    if (lit >= 0) sys('<span class="text-amber-300 font-bold">勝者的榮耀照亮了卡冊：神話與天上變身全部點亮（新點亮 ' + lit + ' 張）。</span>');
    if (gift) sys('<span class="text-amber-300 font-bold">席琳留下了一件解除封印的聖衣：' + gift + '。</span>');
    try { if (!player.dead) { setMapSelectors(typeof getLastTown === 'function' ? getLastTown() : 'town_aden'); changeMap(true); } } catch (e) {}
    try { calcStats(); updateUI(); saveGame(); } catch (e) {}
  };
  // 沉眠之海：時間還沒到，任何路徑打到 0 都不算倒下（停在門檻）
  if (typeof window.killMob === 'function') {
    var oKM = window.killMob;
    window.killMob = function (idx) {
      try {
        var m = mapState.mobs && mapState.mobs[idx];
        if (m && m._afkFinal && on()) { var g = gateOf(m); if (g) { m.curHp = Math.max(1, Math.ceil(m.hp * g[0])); m._dead = false; seal(m, g); return; } }
      } catch (e) {}
      var ap = mapState.mobs && mapState.mobs[idx], apWas = !!(ap && ap._afkApostle && !ap._dead);
      var res = oKM.apply(this, arguments);
      try { if (apWas && ap._dead && on()) blast(ap); } catch (e) { console.warn('[AFK-finalboss] blast', e); }
      return res;
    };
  }
  var oBossKill = window.antharasOnBossKill;
  if (typeof oBossKill === 'function') window.antharasOnBossKill = function (bossName) {
    if (S()._afkFinal && (bossName === BOSS_NAME || / 死亡女神 席琳$/.test(String(bossName || '')))) { finish('win'); return; }
    if (S()._afkFinal) return;   // 使徒不是頭目，不會走到這裡
    return oBossKill.apply(this, arguments);
  };
  var oTick = window.tick;
  window.tick = function () {
    var t0 = S().ticks;
    try { return oTick.apply(this, arguments); }
    finally {
      try {
        var s = S();
        if (s._afkFinal && (player.dead || mapState.current !== MAP)) finish('lose', player.dead ? '倒下' : '離開神殿');
        else if (S().ticks !== t0) timeline();
        var r2 = player && player.afkFinal2; if (r2 && r2.pending && !s._afkFinal && window.__afkRebirth2) { window.__afkRebirth2.finish('second', 'lose', '中途離開'); try { calcStats(); saveGame(); } catch (e) {} }
        var r = rec(); if (r && r.pending && !s._afkFinal) { player.afkFinal.pending = false; player.afkFinal.result = 'lose'; player.afkFinal.why = '中途離開'; sys('<span class="text-slate-300">與席琳的決戰中途中斷，視為挑戰失敗：得到光環「絕望轉生者」。</span>'); try { calcStats(); saveGame(); } catch (e) {} }
      } catch (e) { console.warn('[AFK-finalboss] tick', e); }
      try { renderClock(); } catch (e) { console.warn('[AFK-finalboss] countdown', e); }
    }
  };

  // ── 入口 ──
  window.afkFinalEnter = function () {
    if (!player) return;
    if (!dreamOn()) { sys('<span class="text-red-400">只有在席琳夢域鏡的世界裡，才能走進死亡之海。</span>'); return; }
    if (rec()) { sys('<span class="text-slate-300">你已經面對過死亡女神了。每個靈魂只有一次機會。</span>'); return; }
    if (!(player.rebirth > 0) && (player.lv || 1) < 100) { sys('<span class="text-red-400">需要 Lv100 才能踏進死亡之海（已轉生的角色不受限）。</span>'); return; }
    if (S().antharas || S().riftRun || S().prideClimb) { sys('<span class="text-amber-300">你正身在其他副本之中。</span>'); return; }
    var go = function () {
      player.afkFinal = { result: 'lose', pending: true, at: Date.now() };   // 進場就算用掉這次機會（中途重新整理＝失敗）
      var s = S(); s._afkFinal = true; s._afkFinalSpawned = false; s.antharas = 1; s._antAdvance = false; s._afkFinalMode = 'first';
      try { saveGame(); } catch (e) {}
      sys('<span class="font-bold" style="color:#7dd3fc;">你沉入死亡之海。水壓碾過胸口，四周是無數睜著眼睛的亡者——' + MAP_NAME + '到了。</span><span class="text-amber-200">區內無法傳送；20 分鐘內打倒死亡女神，否則萬物歸於死。</span>');
      enterOblivionMap(MAP);
      renderClock();
      try { if (!document.getElementById('item-modal').classList.contains('hidden')) closeModal(); } catch (e) {}
      try { updateUI(); } catch (e) {}
    };
    var msg = '⚠ 最終決戰：死亡女神 席琳\n\n每個角色只能挑戰一次——進場就算用掉，倒下、回村或中途重新整理都算失敗。\n打倒：光環「勝者的榮耀」（轉生時六大主屬性傳承），當場點亮神話＋天上全部卡冊。\n失敗：光環「絕望轉生者」，轉生時送一件解除封印的聖衣。\n兩種結果都會開放冥王域的輪迴轉生。\n\n確定要進入嗎？';
    if (window.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '最終決戰', message: msg, okText: '沉入死亡之海', cancelText: '再準備一下', danger: true, onOk: go });
    else if (confirm(msg)) go();
  };

  // 二轉／單人重打的進場（條件與紀錄由 afk-rebirth2 處理）
  var startMode = function (md, line) {
    var s = S(); s._afkFinal = true; s._afkFinalSpawned = false; s.antharas = 1; s._antAdvance = false; s._afkFinalMode = md;
    try { saveGame(); } catch (e) {}
    sys(line);
    enterOblivionMap(MAP);
    renderClock();
    try { if (!document.getElementById('item-modal').classList.contains('hidden')) closeModal(); } catch (e) {}
    try { updateUI(); } catch (e) {}
  };

  // ── Ping 11-12 03:45：女神挑戰（最終決戰／一轉女神、二轉決戰、單人試煉、終焉階層）從席琳祈禱視窗搬到席琳神殿的新 NPC「死亡女神 席琳」──
  //   其他外掛（afk-finaltiers）把自己的卡片推進 window.__afkGoddessCards；面板打開或重畫時依序畫出來。
  var GODDESS_NPC = 'npc_afk_goddess', GODDESS_T = '女神挑戰';
  window.__afkGoddessCards = window.__afkGoddessCards || [];
  var renderGoddess = function (div) {
    if (!div) return;
    div.innerHTML = '<div class="p-4 flex flex-col gap-3"><div class="flex gap-3 items-center"><img src="assets/ui/afk_final_shilen_portrait.webp" alt="" style="width:96px;height:96px;object-fit:cover;border-radius:8px;border:1px solid #155e75;flex:none">'
      + '<div class="afk-lore">「孩子……你終於走到夢的盡頭了。回去吧……別再往下沉了。」</div></div></div>';
    var box = div.firstChild;
    window.__afkGoddessCards.forEach(function (fn) { try { fn(box); } catch (e) { console.warn('[AFK-finalboss] goddess card', e); } });
  };
  window.renderGoddessPanel = renderGoddess;
  window.__afkRepaintGoddess = function () { try { var el = document.getElementById('interaction-content'); if (el && el.querySelector('#afk-final-card')) renderGoddess(el); } catch (e) {} };
  try {
    var KG = window.__afkNpcKit;
    if (KG) {
      KG.addNpc('town_sherine', { id: GODDESS_NPC, n: BOSS_NAME, title: GODDESS_T, type: 'quest', classicHide: true, d: '沉在死亡之海底下的水之女神。一轉女神、二轉決戰、單人試煉、終焉階層都從她這裡進入。' });
      if (typeof NPC_SPR !== 'undefined' && !NPC_SPR.shilen_goddess) NPC_SPR.shilen_goddess = { g: 'shilen_goddess', f: 12, shadow: false };
      if (typeof NPC_SPR_FIXED !== 'undefined') NPC_SPR_FIXED[GODDESS_NPC] = 'shilen_goddess';
      try { if (typeof TOWN_NPC_POS_OVERRIDE !== 'undefined') (TOWN_NPC_POS_OVERRIDE.town_sherine = TOWN_NPC_POS_OVERRIDE.town_sherine || {})[GODDESS_NPC] = [60, 40]; } catch (e) {}
      KG.hookNpc(GODDESS_NPC, BOSS_NAME, GODDESS_T, renderGoddess);
    }
  } catch (e) { console.warn('[AFK-finalboss] goddess npc', e); }
  // 最終決戰卡
  {
    window.__afkGoddessCards.unshift(function (box) {
      var r;
      {
        var rr = rec(), ok = dreamOn() && !rr && ((player.rebirth > 0) || (player.lv || 1) >= 100);
        var st = rr ? (rr.result === 'win' && !rr.pending ? '<span class="text-amber-300">已通關（勝者的榮耀）</span>' : '<span class="text-fuchsia-300">已挑戰（絕望轉生者）</span>') : (dreamOn() ? '<span class="text-sky-300">可挑戰一次</span>' : '<span class="text-slate-400">需在席琳夢域鏡中</span>');
        box.insertAdjacentHTML('beforeend',
          '<div id="afk-final-card" class="bg-slate-950/80 border border-sky-700 rounded p-3 text-sm leading-relaxed">'
          + '<div class="font-bold mb-1 text-sky-300">🌊 最終決戰：' + BOSS_NAME + '（' + st + '）</div>'
          + '<div class="afk-lore">「你在夢裡殺過的每一個，都會回到我身邊。那麼你呢？」</div>'
          + '<div class="text-slate-200 text-xs"><span class="afk-lore">殷海薩的神諭：「那一半的她要掀起第二次諸神之戰。沉下去，斬斷源頭。」</span><br>夢的最底層是死亡之海。席琳——殷海薩被放逐的長女、六龍之母、魔族追隨的女神、死亡世界的主人——在沉沒神殿等著你。'
          + '每個角色只能挑戰一次；打倒得到「勝者的榮耀」，失敗得到「絕望轉生者」。<b>沒有挑戰過，冥王域不會為你開啟輪迴。</b></div></div>'
          + '<button type="button" class="btn py-3 text-base font-bold ' + (ok ? 'bg-sky-950 hover:bg-sky-900 border-sky-500' : 'bg-slate-700 border-slate-600 opacity-60 cursor-not-allowed') + '" ' + (ok ? '' : 'disabled') + ' onclick="afkFinalEnter()">'
          + (rr ? '已面對過死亡女神' : (!dreamOn() ? '需在席琳夢域鏡中' : (ok ? '🌊 沉入死亡之海（最終決戰）' : '需要 Lv100'))) + '</button>');
        if (window.__afkRebirth2 && window.__afkRebirth2.card) box.insertAdjacentHTML('beforeend', window.__afkRebirth2.card());
      }
      return r;
    });
  }

  // ── 冥王域：沒挑戰過不能輪迴；轉生時套用光環 ──
  var oHades = window.enterHades;
  if (typeof oHades === 'function') {
    window.enterHades = function () {
      var r = rec();
      if (!(player.rebirth > 0) && (!r || r.pending)) { sys('<span class="text-red-400">冥王域的門扉後傳來低語：「先去見我。」——沒有挑戰過最終頭目「' + BOSS_NAME + '」，無法輪迴轉生。（席琳神殿・席琳夢域鏡）</span>'); return; }
      return oHades.apply(this, arguments);
    };
    window.unlockHades = window.enterHades;
  }
  var oReb = window.doRebirth;
  if (typeof oReb === 'function') {
    window.doRebirth = function () {
      var before = player && player.rebirth || 0, r = oReb.apply(this, arguments);
      try { if (!(before > 0) && player.rebirth > 0) applyRebirthGift(); } catch (e) { console.warn('[AFK-finalboss] 轉生', e); }
      return r;
    };
    // 確認視窗的 go() 在稍後執行：用 rebirth 值變化偵測
    var lastReb = null, lastP = null;
    var watch = function () { try { if (!player || !player.cls) return; var v = player.rebirth || 0; if (lastP === player && lastReb === 0 && v > 0) applyRebirthGift(); lastReb = v; lastP = player; } catch (e) {} };
    setInterval(watch, 500);
  }
  function applyRebirthGift() {
    var r = rec(); if (!r || r.rebirthApplied) return;
    r.rebirthApplied = true;
    if (r.result === 'win' && r.panel && player.base && player.alloc) {
      var pn = player.panacea || {};
      PANEL.forEach(function (k) {
        var rfd = (player._afkRebirthRefund && Number(player._afkRebirthRefund[k])) || 0;   // 轉生收回的升級點數不算進來（不然傳承會把收回的補回去）
        var want = Math.min(200, Math.floor(r.panel[k] || 0)), cur = (player.base[k] || 0) + (player.alloc[k] || 0) + (pn[k] || 0) + rfd;
        if (want > cur) player.base[k] = (player.base[k] || 0) + (want - cur);
      });
      sys('<span class="text-amber-200 font-bold">勝者的榮耀：打倒席琳時的六大主屬性傳承到了新生的身軀。</span>');
    }
    if (r.result !== 'win' && !r.gifted) { var g = samsaraGift(player); r.gifted = true; if (g) sys('<span class="text-amber-300 font-bold">冥王域的盡頭，席琳留下的聖衣在等你：' + g + '（解除封印）。</span>'); }
    try { calcStats(); player.hp = player.mhp; player.mp = player.mmp; updateUI(); saveGame(); } catch (e) {}
  }

  // ── 光環 ──
  if (typeof window.recomputeStats === 'function') {
    var oRe = window.recomputeStats;
    window.recomputeStats = function () {
      var desp = lost() && player && player.rebirth > 0;
      despairOn = !!desp;
      var r;
      try { r = oRe.apply(this, arguments); } finally { despairOn = false; }
      try {
        if (won() && player && player.d) {
          var d = player.d;
          ['resFire', 'resWater', 'resWind', 'resEarth', 'resNone'].forEach(function (k) { d[k] = (Number(d[k]) || 0) + 100; });
          d.ac = (Number(d.ac) || 0) - 50; d.mr = (Number(d.mr) || 0) + 50; d.dr = (Number(d.dr) || 0) + 10;
        }
      } catch (e) {}
      return r;
    };
  }
  // 勝者的榮耀：全能力 +50（力量、敏捷、體質、智力、精神、魅力；玩家 2026-11-03 確認）——掛在核心「屬性換算戰鬥數值」之前，HP、傷害、命中都吃得到；跟轉生的面板 +50 分開算
  var WIN_ATTR = 50;
  var oBoostW = window.__afkAttrBoost;
  window.__afkAttrBoost = function (p, d) {
    try { if (p && d && p === player && !p.classicMode && won(p)) ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (k) { d[k] = (Number(d[k]) || 0) + WIN_ATTR; }); } catch (e) {}
    if (typeof oBoostW === 'function') return oBoostW.apply(this, arguments);
  };
  // 絕望轉生者：HP 成長以體質 200 計（體質 100 以上依 80→100 的成長延伸）
  var despairOn = false;
  if (typeof window.getConGrowth === 'function') {
    var oCG = window.getConGrowth;
    window.getConGrowth = function (con, cls) {
      if (!despairOn) return oCG.apply(this, arguments);
      var a = oCG.call(this, 100, cls), b2 = oCG.call(this, 80, cls);
      return Math.max(oCG.apply(this, arguments), a + (a - b2) / 20 * 100);
    };
  }
  // 勝者的榮耀：受到一般攻擊 10% 閃避
  if (typeof window.enemyPhysicalAttack === 'function') {
    var oEPA = window.enemyPhysicalAttack;
    window.enemyPhysicalAttack = function (mob) {
      if (won() && !player.dead && Math.random() < 0.10) {
        log('<span class="font-bold" style="color:#fde047;">【勝者的榮耀】</span>你輕身避開了 ' + ((mob && mob.n) || '敵人') + ' 的攻擊。');
        return;
      }
      return oEPA.apply(this, arguments);
    };
  }

  window.__afkFinalBoss = { TIER: TIER, tierK: tierK, tierHpK: tierHpK, mode: mode, startMode: startMode, dreamOn: dreamOn, MAP: MAP, BOSS_NAME: BOSS_NAME, ADD_NAME: ADD_NAME, cfg: FB, hpScale: hpScale, partyN: partyN, rec: rec, won: won, lost: lost, on: on, finish: finish, timeline: timeline, summon: summon, applyRebirthGift: applyRebirthGift, clockState: clockState, renderClock: renderClock };
  console.log('[AFK-finalboss] 已啟用：最終頭目 死亡女神 席琳（死亡之海・席琳的沉沒神殿）');
})();
