/* ============================================================================
 * afk-dreamhell.js — 瘋狂席琳＋席琳夢域鏡模式（玩家 2026-10-21 指定）
 *
 * 開啟方式：跟席琳世界一樣，到席琳神殿向席琳祈禱（第三個選項）；開啟後套用到所有地圖。
 *   以「瘋狂的席琳世界」為底（開啟時會一併開啟瘋狂席琳），再加上以下規則。
 *
 * 怪物（攻城區、血盟敵人除外，與席琳世界相同）
 *   ‧全部處於「席琳的恩賜」狀態：HP 再 ×10（瘋狂 ×5 × 恩賜 ×10＝×50）
 *   ‧AC：一般怪 −20、頭目 −50（再加在瘋狂席琳之後），最低 −300
 *   ‧魔防：一般怪 +20、頭目 +50，最高 500（2026-10-25；四龍最終龍每階 +50，第七階 850）
 *   ‧命中：基礎命中 ×3（瘋狂席琳是 ×2）
 *   ‧額外減傷：等級 ÷ 3 ＋ 15；迴避 +15
 *   ‧一般攻擊與技能傷害：一般怪 再 ×2、頭目 再 ×5（瘋狂席琳的 ×3 之外）；怪物施加的持續傷害 再 ×5
 *   ‧全部隨時處於狂暴狀態（同吉爾塔斯：命中與傷害 ×1.2）
 *   ‧一般怪出生時隨機免疫「物理」或「魔法」傷害 10 秒（血壁空間型免疫；持續傷害、寵物、召喚不受影響）
 *     小怪不反彈（玩家 2026-10-24 關閉）：60 級以上的夢域反射移除，一般怪自己的血壁空間在席琳夢域鏡也不反彈
 *   ‧回血：頭目每秒回最大 HP 0.1%；一般怪原本有回血的每秒 +100，沒有的每秒 +500
 *   ‧出怪等待再 −3 秒（下限 0.5 秒）
 *   ‧場上最多 3 隻；王出現時其他怪物離場，王在場時不再出怪（攻城區除外）
 *     2026-10-22：場上的王保持 1 隻；用傳送控制戒指找來的王一次出 3 隻同名王（每隻登場、每次變身都各打一次衝擊）。
 *     傲慢之塔（含支配者傲慢之塔）與時空裂痕不限制；副本（王房、四大龍副本）維持舊規則
 *     有轉生狀態者（2026-10-22）：解除限制，場上 5 隻、王在場照樣出小怪；
 *   ‧王登場（不論是否轉生；2026-10-24 起）：不論怎麼出現（自然出怪、傳送控制戒指、王房、變身成下一階都算）先對全隊
 *     （你＋傭兵＋寵物＋召喚物）造成最大 HP 10% 的真實傷害，每隻王（每一階）一次；傳送控制戒指引來的那一波改為 15%
 * 報酬
 *   ‧經驗 ×10、金幣 ×3（2026-10-28 改：原本經驗 0、金幣 0）；每殺一隻 0.1% 機率掉龍之鑽石（掉的時候一半是 1～499 隨機、一半是 500）
 *   ‧掉落機率 ×8（玩家 2026-10-29：原本 ×50）；裝備掉落 50% 祝福（2026-10-28 改：原本 100%）；席琳結晶掉率 ×5
 *   ‧新掉落：夢艷結晶（一般怪 10%、頭目必掉 3 顆）、地獄精華（頭目必掉）、
 *            80 級以上的頭目必掉四屬性滅魔蔑視水晶（隨機一種屬性）；一般怪固定 1% 掉滅魔蔑視水晶碎片（100 個合 1 顆）
 *   ‧白金卡全部收集滿：每殺一隻 0.05% 掉昇華支配強化石、0.1% 掉昇華支配碎片
 *   ‧被侵蝕的瘋狂安塔瑞斯（任何模式）：必掉 滅魔蔑視水晶(地)
 *   ‧四大龍副本任何怪：瘋狂席琳 0.01%、席琳夢域鏡 1% 掉境滅亡域鑰匙
 * 新道具（昇華支配材料）：夢艷結晶、地獄精華、滅魔蔑視水晶(地／水／風／火)、至暗星塵、夢域塵、境滅亡域鑰匙
 * 核心掛點：補丁 18（掉落 ×8、結晶 ×5、出怪 −3 秒、phys 免疫）；其餘包 applySherineBuff／killMob／tick／席琳祈禱介面。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('dreamhell')) return;
  if (typeof DB === 'undefined' || typeof window.applySherineBuff !== 'function' || typeof window.killMob !== 'function') {
    try { console.warn('[AFK-dreamhell] 找不到核心函式，未啟用'); } catch (e) {}
    return;
  }

  // ── 新道具 ──
  var ITEMS = {
    afk_dream_crystal: { n: '夢艷結晶', c: 'text-fuchsia-300', d: '惡夢裡開出的花，凝成一顆妖豔的結晶，摸起來仍是溫的。昇華支配的材料。（席琳夢域鏡：一般怪隨機掉落、頭目必掉）' },
    afk_hell_essence: { n: '地獄精華', c: 'text-red-400', d: '地獄之主心臟裡淬出的一滴精華，靠近時能聽見遙遠的哀嚎。昇華支配的材料；20 個可在哈瑪大師合成至暗星塵。（席琳夢域鏡頭目必掉）' },
    afk_contempt_earth: { n: '滅魔蔑視水晶(地)', c: 'text-amber-300', d: '吞下安塔瑞斯怒火的大地水晶，對一切魔力都不屑一顧。昇華支配的材料。（被侵蝕的瘋狂安塔瑞斯、席琳夢域鏡 80 級以上的頭目；碎片 100 個合成）' },
    afk_contempt_water: { n: '滅魔蔑視水晶(水)', c: 'text-sky-300', d: '凍住法利昂潮息的水之水晶，對一切魔力都不屑一顧。昇華支配的材料。（破滅的瘋狂法利昂、席琳夢域鏡 80 級以上的頭目；碎片 100 個合成）' },
    afk_contempt_wind: { n: '滅魔蔑視水晶(風)', c: 'text-emerald-300', d: '封著林德拜爾風暴的水晶，對一切魔力都不屑一顧。昇華支配的材料。（災厄的瘋狂林德拜爾、席琳夢域鏡 80 級以上的頭目；碎片 100 個合成）' },
    afk_contempt_fire: { n: '滅魔蔑視水晶(火)', c: 'text-orange-400', d: '燒著巴拉卡斯烈焰的水晶，對一切魔力都不屑一顧。昇華支配的材料。（深淵的瘋狂巴拉卡斯、席琳夢域鏡 80 級以上的頭目；碎片 100 個合成）' },
    afk_dark_stardust: { n: '至暗星塵', c: 'text-violet-300', d: '把地獄的精華壓碎、再壓碎，最後只剩比夜更暗的星塵。以 20 個地獄精華合成（成功率 70%），昇華支配升級的材料。' },
    afk_dream_dust: { n: '夢域塵', c: 'text-pink-300', d: '從暗夢星迴帶回的夢之塵，撒在爐火上，命運便會偏向你一點。每顆使昇華支配成功率 +10%，一次最多 5 顆。' },
    afk_abyss_key: { n: '境滅亡域鑰匙', c: 'text-rose-400', d: '刻著四大龍紋章的鑰匙，據說能打開「境界盡頭」的門。四大龍副本（侵蝕安塔瑞斯、破滅法利昂、災厄林德拜爾、深淵巴拉卡斯）掉落（瘋狂席琳 0.01%、席琳夢域鏡 1%；暗夢星迴頭目也會掉）。昇華支配 +5 的材料，暗夢星迴的多人模式製作中。' },
    afk_contempt_shard: { n: '滅魔蔑視水晶碎片', c: 'text-amber-200', d: '滅魔水晶崩落的碎屑，仍倔強地排斥著魔力。席琳夢域鏡的一般怪固定 1% 掉落。100 個可在哈瑪大師合成 1 顆指定屬性的滅魔蔑視水晶。' },
    afk_ts_contempt_earth: { n: '滅魔蔑視水晶(地)(時空)', c: 'text-amber-300', d: '被時空扭曲過的水晶，影子總是比本體慢半拍。暗夢星迴頭目掉落；集齊六種時空材料可開啟「時空裂痕-冥王域」。' },
    afk_ts_contempt_water: { n: '滅魔蔑視水晶(水)(時空)', c: 'text-sky-300', d: '被時空扭曲過的水晶，影子總是比本體慢半拍。暗夢星迴頭目掉落；集齊六種時空材料可開啟「時空裂痕-冥王域」。' },
    afk_ts_contempt_wind: { n: '滅魔蔑視水晶(風)(時空)', c: 'text-emerald-300', d: '被時空扭曲過的水晶，影子總是比本體慢半拍。暗夢星迴頭目掉落；集齊六種時空材料可開啟「時空裂痕-冥王域」。' },
    afk_ts_contempt_fire: { n: '滅魔蔑視水晶(火)(時空)', c: 'text-orange-400', d: '被時空扭曲過的水晶，影子總是比本體慢半拍。暗夢星迴頭目掉落；集齊六種時空材料可開啟「時空裂痕-冥王域」。' },
    afk_ts_dark_stardust: { n: '暗星塵(時空)', c: 'text-violet-300', d: '在裂隙裡逆著時間閃爍的星塵。暗夢星迴頭目掉落；集齊六種時空材料可開啟「時空裂痕-冥王域」。' },
    afk_ts_dream_dust: { n: '夢域塵(時空)', c: 'text-pink-300', d: '不屬於這個時代的夢之塵，觸碰時會短暫看見前世。暗夢星迴頭目掉落；集齊六種時空材料可開啟「時空裂痕-冥王域」。' },
    afk_cancel_scroll: { n: '相消術卷軸', c: 'text-emerald-300', d: '寫著古老相消咒文的卷軸，能讓任何聖光瞬間黯淡。哈瑪大師販售（10 龍鑽）。帶在身上時，暗夢星迴的頭目一張開聖結界就會自動使用 1 張把它打破。' },
    afk_asc_stone_wpn: { n: '昇華支配強化石(武器)', c: 'text-fuchsia-300', d: '浸透支配意志的強化石，能讓兵刃心甘情願地臣服。在哈瑪大師對遺物武器做昇華支配 +1～+5 時使用：不需要其他材料、必定成功。' },
    afk_asc_stone_arm: { n: '昇華支配強化石(防具)', c: 'text-fuchsia-300', d: '浸透支配意志的強化石，能讓鎧甲心甘情願地臣服。在哈瑪大師對遺物防具做昇華支配 +1～+5 時使用：不需要其他材料、必定成功。' },
    afk_asc_stone_acc: { n: '昇華支配強化石(飾品)', c: 'text-fuchsia-300', d: '浸透支配意志的強化石，能讓飾品心甘情願地臣服。在哈瑪大師對遺物飾品做昇華支配 +1～+5 時使用：不需要其他材料、必定成功。' },
    afk_asc_shard: { n: '昇華支配碎片', c: 'text-fuchsia-200', d: '強化石碎裂後殘留的意志，仍在尋找可以支配的東西。白金卡收集全滿後，席琳夢域鏡每殺一隻 0.1% 掉落。100 個可在哈瑪大師換一顆自選的昇華支配強化石。' }
  };
  Object.keys(ITEMS).forEach(function (id) {
    if (DB.items[id]) return;
    var x = ITEMS[id];
    DB.items[id] = { n: x.n, type: 'etc', p: 0, c: x.c, noUse: true, gachaWeight: 0, d: x.d, img: 'assets/icons/items/' + x.n + '.png' };   // 圖示：scratchpad mkicons.py 產生（缺圖時遊戲本身會退回預設圖）
  });
  var CONTEMPT = ['afk_contempt_earth', 'afk_contempt_water', 'afk_contempt_wind', 'afk_contempt_fire'];
  // 刻著四大龍紋章的鑰匙，據說能打開「境界盡頭」的門。四大龍副本（侵蝕安塔瑞斯、破滅法利昂、災厄林德拜爾、深淵巴拉卡斯）地圖（目前只有安塔瑞斯；法利昂／巴拉卡斯／林德拜爾做好後加進來）
  var CORRUPT_MAPS = ['antharas_nest_1', 'antharas_nest_2', 'antharas_nest_3', 'antharas_lair'];
  window.__afkCorruptDragonMaps = CORRUPT_MAPS;

  var dreamOn = function () { return !!(typeof player !== 'undefined' && player && player.sherineDream && player.sherineMad); };

  // ── 出怪時套用 ──
  var scaleAtk = function (o, k) {
    if (!o) return o;
    if (Array.isArray(o.dmg) && o.dmg.length >= 2) o.dmg = [Math.max(1, Math.round(o.dmg[0] * k)), o.dmg[1]];
    if (typeof o.db === 'number') o.db = Math.round(o.db * k);
    return o;
  };
  var scaleDot = function (sk, k) {
    if (!sk) return;
    if (typeof sk.d === 'number' && sk.type && /poison|burn|scald|bleed/.test(sk.type)) sk.d = Math.round(sk.d * k);
    if (sk.sec && typeof sk.sec.d === 'number') sk.sec.d = Math.round(sk.sec.d * k);
  };
  var ANT_STAGE = { ant_antharas_eroded: 1, ant_antharas_fury: 2, ant_antharas_mad: 3, ant_antharas_s4: 4, ant_antharas_s5: 5, ant_antharas_s6: 6, ant_antharas_s7: 7 };
  var stageByName = null;
  var dragonStage = function (m) {
    if (!m) return 0;
    if (!stageByName) {
      stageByName = {};
      Object.keys(DB.mobs).forEach(function (id) { var k = ANT_STAGE[id] || (function () { var mm = /^cr_[a-z]+_d([1-7])$/.exec(id); return mm ? Number(mm[1]) : 0; })(); if (k && DB.mobs[id] && DB.mobs[id].n) stageByName[DB.mobs[id].n] = k; });
    }
    return stageByName[m.n] || 0;
  };
  function applyDream(m) {
    if (!m || m._dream || !m._sherine) return;
    var boss = !!m.boss;
    m._dream = true;
    // 恩賜狀態
    if (!m._grace) { m._grace = true; m.hp = Math.floor(m.hp * 10); }
    m.curHp = m.hp;
    m.ac = Math.max(-300, (m.ac || 0) - (boss ? 50 : 20));
    m.mr = Math.min(500, (m.mr || 0) + (boss ? 50 : 20));   // 玩家 2026-10-25：魔防上限 300 → 500
    // 四龍／安塔瑞斯的七階最終龍：第 k 階魔防 = 500 + 50k（最後一階 850）
    var dk = dragonStage(m); if (dk) m.mr = 500 + 50 * dk;
    var baseHit = Number((DB.mobs[m.id] || {}).hit);
    m.hit = Math.floor((isFinite(baseHit) && baseHit > 0 ? baseHit : (m.hit || 0) / 2) * 3);
    m.dr = (m.dr || 0) + 15;
    m.er = (m.er || 0) + 15;
    // 傷害：複製後再改，避免動到 DB.mobs 共用的陣列與物件
    var k = boss ? 5 : 2;
    if (Array.isArray(m.dmg)) m.dmg = m.dmg.slice();
    scaleAtk(m, k);
    Object.keys(m).forEach(function (f) {
      if (/^mag\d*$/.test(f) && m[f] && typeof m[f] === 'object') {
        m[f] = JSON.parse(JSON.stringify(m[f]));
        scaleAtk(m[f], k);
        scaleDot(m[f], 5);
      }
    });
    if (m.onHitPoison && typeof m.onHitPoison === 'object') { m.onHitPoison = JSON.parse(JSON.stringify(m.onHitPoison)); if (typeof m.onHitPoison.d === 'number') m.onHitPoison.d = Math.round(m.onHitPoison.d * 5); }
    // 隨時狂暴（吉爾塔斯：命中與傷害 ×1.2）
    m.rageHpPct = 1.01; m.rageHitMult = Math.max(Number(m.rageHitMult) || 1, 1.2); m.rageDmgMult = Math.max(Number(m.rageDmgMult) || 1, 1.2);
    // 報酬
    // 玩家 2026-10-28：經驗 ×10、金幣 ×3（以怪物原本的數值為準）。瘋狂席琳已經把經驗、金幣各 ×10 → 經驗維持、金幣 ×0.3
    m.goldMin = Math.floor((Number(m.goldMin) || 0) * 0.3); m.goldMax = Math.floor((Number(m.goldMax) || 0) * 0.3);
    // 一般怪：出生 10 秒隨機免疫物理或魔法
    if (!boss) {
      var kind = Math.random() < 0.5 ? 'phys' : 'magic';
      m._reflectWall = { kind: kind, until: ((typeof state !== 'undefined' && state.ticks) || 0) + 100, block: true };
      // 60 級以上：同時反射另一類傷害（魔法免疫→物理反射；物理免疫→魔法反射）
      // （60 級以上小怪的夢域反射已於 2026-10-24 依玩家要求關閉）
    }
    m._dreamRegen = boss ? 0 : (m.regenHp ? 100 : 500);
  }
  var oBuff = window.applySherineBuff;
  window.applySherineBuff = function (idx) {
    var r = oBuff.apply(this, arguments);
    try { if (dreamOn()) applyDream(mapState.mobs[idx]); } catch (e) {}
    return r;
  };
  // 恩賜每次刷新的 1%：席琳夢域鏡全部已是恩賜，不再重複 ×10
  if (typeof window.applySherineGrace === 'function') {
    var oGrace = window.applySherineGrace;
    window.applySherineGrace = function () { if (dreamOn()) return; return oGrace.apply(this, arguments); };
  }

  // ── 場上怪物上限：最多 3 隻；有王的時候場上只有王（玩家 2026-10-21 指定）──
  var reborn = function () { try { return !!(player && player.rebirth > 0); } catch (e) { return false; } };
  // 王登場先給全隊一波真實傷害：最大 HP 10%；傳送控制戒指找來的王 15%
  //   玩家 2026-10-24：不分是否轉生，席琳夢域鏡的王每次登場都算（原本只有轉生者）
  var bossEntryBlast = function (nm, pct) {
    pct = pct || 0.1;
    try {
      var hit = [];
      if (!player.dead) {
        var d0 = Math.max(1, Math.floor((player.mhp || 1) * pct)); player.hp -= d0; hit.push('你 ' + d0);
        if (player.hp <= 0 && typeof killPlayer === 'function') killPlayer();
      }
      (player.allies || []).forEach(function (x) {
        if (!x || x._downed || !(x.curHp > 0)) return;
        var d = Math.max(1, Math.floor((x.mhp || x.curHp || 1) * pct)); x.curHp -= d; hit.push((x._allyName || '傭兵') + ' ' + d);
        if (x.curHp <= 0) { x.curHp = 0; x._downed = true; x._reviveCd = 150; }
      });
      // 寵物
      try {
        (typeof petsOutList === 'function' ? petsOutList() : []).forEach(function (pt) {
          if (!pt || pt._downed || !(pt.hp > 0)) return;
          var mh = typeof petMhpEff === 'function' ? petMhpEff(pt) : (pt.mhp || pt.hp);
          var d = Math.max(1, Math.floor(mh * pct)); pt.hp -= d; hit.push('寵物' + pt.form + ' ' + d);
          if (pt.hp <= 0 && typeof _petDown === 'function') _petDown(pt, nm.n + '降臨的衝擊');
        });
        if (typeof petMarkDirty === 'function') petMarkDirty();
      } catch (e) {}
      // 召喚物（召喚術／造屍術／屬性精靈）
      try {
        (player.summonsV2 || []).forEach(function (sm) {
          if (!sm || sm._downed || !(sm.hp > 0)) return;
          var d = Math.max(1, Math.floor((sm.mhp || sm.hp) * pct)); sm.hp -= d; hit.push('召喚' + sm.form + ' ' + d);
          if (sm.hp <= 0) { sm.hp = 0; sm._downed = true; sm._diedAt = Date.now(); }
        });
        if (!state.ff && typeof renderSummonPanel === 'function') renderSummonPanel();
      } catch (e) {}
      if (!state.ff) logCombat('<span class="text-fuchsia-300 font-bold">' + nm.n + ' 降臨的衝擊席捲全隊' + (pct > 0.1 ? '（被傳送控制戒指引來，怒意更盛）' : '') + '。</span>最大 HP ' + Math.round(pct * 100) + '% 真實傷害（' + hit.join('、') + '）', 'enemy');
    } catch (e) {}
  };
  // 不管用什麼方式出場（自然出怪、傳送控制戒指、王房、變身成下一階…），只要場上出現沒放過衝擊的王就放一次
  var scanBossEntry = function () {
    try {
      if (!dreamOn() || siege()) return;
      var ms = mapState.mobs || [], ring = !!mapState._afkRingBoss, any = false;
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (!m || !m.boss || m._dead || !(m.curHp > 0) || m._afkEntryBlast || m.race === '血盟' || m.race === '建築') continue;
        m._afkEntryBlast = true; any = true;
        // 時空裂痕裡頭目一半機率出場、很快就一隻接一隻：登場衝擊最多每 10 秒一次（2026-10-29 晚，裂痕有自己的暴走與崩塌）
        if (state.riftRun) { if ((state.ticks || 0) < (state._dhBlastCd || 0)) continue; state._dhBlastCd = (state.ticks || 0) + 100; }
        bossEntryBlast(m, ring ? 0.15 : 0.10);
      }
      if (any && ring) mapState._afkRingBoss = false;   // 戒指引來的那一波（可能 3 隻同時）都算 15%
    } catch (e) {}
  };
  if (typeof window.doMobTransform === 'function') {   // 變身當下就算登場（同一 tick 連續變身也每階各打一次）
    var oTf = window.doMobTransform;
    window.doMobTransform = function () { var r = oTf.apply(this, arguments); if (dreamOn()) scanBossEntry(); return r; };
  }
  if (typeof window.tick === 'function') {
    var oTickE = window.tick;
    window.tick = function () { var r = oTickE.apply(this, arguments); if (dreamOn()) scanBossEntry(); return r; };
  }
  if (typeof window.doTeleport === 'function') {   // 傳送控制戒指：記下「下一波王是戒指引來的」（換地圖或傳送沒戒指就清掉）
    var oTp = window.doTeleport;
    window.doTeleport = function (forceBoss) { var r = oTp.apply(this, arguments); try { mapState._afkRingBoss = !!forceBoss; } catch (e) {} return r; };
  }
  if (typeof window.changeMap === 'function') {
    var oCmR = window.changeMap;
    window.changeMap = function () { try { mapState._afkRingBoss = false; } catch (e) {} return oCmR.apply(this, arguments); };
  }
  var siege = function () { try { return typeof isSiegeArea === 'function' && isSiegeArea(mapState.current); } catch (e) { return false; } };
  // ── 場上規則（2026-10-22 改）──
  //   ‧傲慢之塔（舊 100 樓、支配者傲慢之塔）與時空裂痕（含暗夢星迴）：不限制，照一般出怪
  //   ‧副本（四軍王之室等王房、四大龍副本）：維持舊規則（未轉生：最多 3 隻、有王只剩王；轉生：5 格）
  //   ‧其他地區：場上的王保持 1 隻；用傳送控制戒指找來的王一次出 3 隻同名王
  //     未轉生：最多 3 隻、有王只剩王、王在場不再出怪；轉生：5 格、王在場照樣出小怪
  var curMap = function () { try { return String(mapState.current || ''); } catch (e) { return ''; } };
  var exemptArea = function () {
    var c = curMap();
    try { if (state.riftRun || state.dreamStar || state.prideClimb) return true; } catch (e) {}
    return c.indexOf('pride_') === 0 || c === 'town_pride' || c.indexOf('dom_tower_') === 0;
  };
  var instanceArea = function () {
    var c = curMap();
    try { if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[c]) return true; } catch (e) {}
    try { if (typeof ANTHARAS_AREA_BOSS !== 'undefined' && ANTHARAS_AREA_BOSS[c]) return true; } catch (e) {}
    try { if (state.antharas) return true; } catch (e) {}
    return false;
  };
  var noMultiBoss = false;   // 內部用：讓核心這一次出怪不能再抽到第二隻王
  if (typeof window.backSlotsActive === 'function') {
    var oBack = window.backSlotsActive;
    window.backSlotsActive = function () {
      if (noMultiBoss) return false;
      if (dreamOn() && !siege() && !reborn() && !exemptArea() && !(typeof window.__afkHostileCall === 'function' && window.__afkHostileCall())) return false;   // 敵對血盟呼朋引伴時開滿 5 格（afk-castlewar）
      return oBack.apply(this, arguments);
    };
  }
  if (typeof window.spawnMob === 'function') {
    var oSpawn = window.spawnMob;
    var live = function (m) { return m && !m._dead && m.curHp > 0; };
    var bossIdOf = function (m) { var ks = Object.keys(DB.mobs); for (var i = 0; i < ks.length; i++) { var b = DB.mobs[ks[i]]; if (b && b.boss && b.n === m.n) return ks[i]; } return null; };
    // 傳送控制戒指：同名王再補 2 隻（總共 3 隻）
    var cloneBoss = function (nm, idx) {
      var bid = bossIdOf(nm), base = bid && DB.mobs[bid]; if (!base) return 0;
      var ms = mapState.mobs, slots = backSlotsActive() ? 5 : 3, want = 2, made = 0, order = [];
      for (var j = 0; j < slots; j++) if (j !== idx && !live(ms[j])) order.push(j);
      for (var k = 0; k < slots; k++) if (k !== idx && live(ms[k]) && !ms[k].boss && !ms[k].trollPlayer && order.indexOf(k) < 0) order.push(k);
      for (var q = 0; q < order.length && made < want; q++) {
        var s = order[q], seq = 0;
        try { seq = ++_mobBornSeq; } catch (e) { seq = Date.now(); }
        ms[s] = Object.assign({}, base, { curHp: base.hp, uid: (typeof uid === 'function' ? uid() : 'c' + Math.random()), _born: seq, _bornMs: Date.now(), _magCd: {}, justHit: false, st: newMobStatus(), _afkRingTrio: true });   // 每隻各算一次衝擊（玩家 2026-10-22）
        try { applySherineBuff(s); } catch (e) {}
        try { if (ms[s].hard && typeof initHardSkin === 'function') initHardSkin(ms[s]); } catch (e) {}
        made++;
      }
      if (made) { try { logSys('<span class="text-fuchsia-300">戒指的符文一閃，' + (made + 1) + ' 隻' + nm.n + '自夢魘中同時現身。</span>'); } catch (e) {} if (!state.ff) { try { renderMobs(); } catch (e) {} } }
      return made;
    };
    var dualRoom = function () {   // 雙頭目祭壇（底比斯、提卡爾）：兩位神本來就要同時在場（玩家 2026-10-30：剛進場兩隻，之後只剩一隻）
      try { var kr = typeof KING_ROOMS !== 'undefined' && KING_ROOMS[curMap()]; return !!(kr && kr.dual); } catch (e) { return false; }
    };
    var oldRule = function (idx, args) {   // 副本：舊規則
      if (reborn()) { var r0 = oSpawn.apply(null, args); scanBossEntry(); return r0; }
      if (dualRoom() && (idx === 0 || idx === 1)) return oSpawn.apply(null, args);   // 祭壇的兩個頭目格不受「王在場不再出怪」限制
      if (typeof window.__afkWantHostile === 'function' && window.__afkWantHostile(idx)) return oSpawn.apply(null, args);
      var ms = mapState.mobs;
      if (ms.some(function (m, j) { return j !== idx && live(m) && m.boss; })) return;
      if (ms.filter(function (m, j) { return j !== idx && live(m); }).length >= 3) return;
      var r = oSpawn.apply(null, args); clearForBoss(idx); return r;
    };
    var clearForBoss = function (idx) {   // 未轉生：王出現時其他小怪離場
      var ms = mapState.mobs, nm = ms[idx];
      if (!nm || !nm.boss) return;
      var gone = 0;
      for (var j = 0; j < ms.length; j++) if (j !== idx && live(ms[j]) && !ms[j].boss && !ms[j].trollPlayer) { ms[j] = null; gone++; }
      if (gone) {
        if (mapState.targetIdx >= 0 && !ms[mapState.targetIdx]) mapState.targetIdx = idx;
        try { logSys('<span class="text-fuchsia-300">' + nm.n + ' 降臨，周遭的魔物畏懼地四散奔逃。（席琳夢域鏡：王在場時只有王）</span>'); } catch (e) {}
        if (!state.ff) { try { renderMobs(); } catch (e) {} }
      }
    };
    window.spawnMob = function (idx) {
      var args = arguments;
      if (!dreamOn() || siege()) return oSpawn.apply(this, args);
      if (exemptArea()) { var re = oSpawn.apply(this, args); if (reborn()) scanBossEntry(); return re; }
      if (instanceArea()) return oldRule(idx, args);
      var ms = mapState.mobs, ring = !!mapState.forceBoss;
      var bossLive = ms.some(function (m, j) { return j !== idx && live(m) && m.boss; });
      if (!reborn()) {
        if (typeof window.__afkWantHostile === 'function' && window.__afkWantHostile(idx)) return oSpawn.apply(this, args);   // 宣戰：王在場也會出敵對血盟 NPC（afk-castlewar）
        if (bossLive) return;                                                                   // 王在場：不再出怪
        if (ms.filter(function (m, j) { return j !== idx && live(m); }).length >= 3) return;
      }
      var r;
      if (bossLive && !ring) { noMultiBoss = true; try { r = oSpawn.apply(this, args); } finally { noMultiBoss = false; } }   // 王保持 1 隻
      else r = oSpawn.apply(this, args);
      var nm = ms[idx];
      if (nm && nm.boss && live(nm)) {
        if (!reborn()) clearForBoss(idx);
        if (ring) cloneBoss(nm, idx);
      }
      if (reborn()) scanBossEntry();
      return r;
    };
  }

  // ── 席琳夢域鏡的小怪不反彈（玩家 2026-10-24：就算 1 秒也會秒殺人 → 全部關閉）──
  //   60 級以上小怪原本的「夢域反射」已移除；一般怪自己放的血壁空間（非免疫型）在席琳夢域鏡也不反彈。
  //   隨機免疫（block 型）照舊；頭目的反彈不受影響。
  //   例外：傳送控制戒指的王出場時給其他怪物的 1 秒物理魔法反彈（afk-dreamboss，玩家 2026-10-30 19:09）照常反彈。
  if (typeof window.reflectWallOnDamage === 'function') {
    var oRW = window.reflectWallOnDamage;
    window.reflectWallOnDamage = function (mob) {
      var w = mob && mob._reflectWall;
      if (w && !w.block && !w.afkDb && !mob.boss && dreamOn()) {   // afkDb＝夢域鏡頭目強化：傳送控制戒指的王出場給的 1 秒反彈（玩家 2026-10-30 19:09 指定，照常反彈）
        mob._reflectWall = null;
        try { return oRW.apply(this, arguments); } finally { if (!mob._reflectWall) mob._reflectWall = w; }
      }
      return oRW.apply(this, arguments);
    };
  }

  // ── 出怪等待 −3 秒 ──
  window.__afkSpawnDelayAdj = function (delay) {
    if (!dreamOn()) return delay;
    try { if (typeof isSiegeArea === 'function' && isSiegeArea(mapState.current)) return delay; } catch (e) {}
    return Math.max(5, delay - 30);
  };

  // ── 回血：每秒一次 ──
  if (typeof window.tick === 'function') {
    var oTick = window.tick;
    window.tick = function () {
      try { return oTick.apply(this, arguments); }
      finally { regen(); }
    };
    var lastRegen = -1;
    var regen = function () {
      try {
        if (state.ticks === lastRegen) return;   // tick 提早返回（例如玩家倒地）時 ticks 不會前進 → 同一個 tick 只回一次血
        lastRegen = state.ticks;
        if (state.ticks % 10 === 0 && mapState && mapState.mobs) {
          for (var i = 0; i < mapState.mobs.length; i++) {
            var m = mapState.mobs[i];
            if (!m || !m._dream || m._dead || m.curHp <= 0 || m.curHp >= m.hp || m._noBossRegen) continue;   // 暗夢星迴試煉頭目不回血
            var add = m.boss ? Math.max(1, Math.floor(m.hp * 0.001)) : (m._dreamRegen || 0);
            m.curHp = Math.min(m.hp, m.curHp + add);
          }
        }
      } catch (e) {}
    };
  }

  // ── 席琳夢域鏡：所有王 5% 機率發動看破——這一下對玩家的傷害 ×2（任何傷害都算，只有一下；玩家 2026-10-24）──
  var insightDepth = 0;
  var snapTeam = function () { var a = [[player, player.hp]]; (player.allies || []).forEach(function (x) { if (x && !x._downed) a.push([x, x.curHp]); }); return a; };
  ['enemyPhysicalAttack', 'enemyAttackAlly', 'applyMobMagic', 'applyMobMagicToAlly'].forEach(function (fn) {
    var o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function (mob) {
      if (insightDepth > 0 || !mob || !mob.boss || !mob._dream || !dreamOn() || Math.random() >= 0.05) return o.apply(this, arguments);
      var snap = snapTeam(), r; insightDepth++;
      try { r = o.apply(this, arguments); } finally { insightDepth--; }
      try {
        var hitAny = false;
        snap.forEach(function (row) {
          var e = row[0], lost = row[1] - (e === player ? player.hp : e.curHp); if (!(lost > 0)) return;
          hitAny = true;
          if (e === player) { player.hp -= lost; if (player.hp <= 0 && typeof killPlayer === 'function') killPlayer(); }
          else { e.curHp -= lost; if (e.curHp <= 0) { e.curHp = 0; e._downed = true; e._reviveCd = 150; } }
        });
        if (hitAny && !state.ff) logCombat('<span class="font-bold" style="color:#f472b6;">【看破】</span>' + mob.n + ' 看穿了你們的破綻，這一擊的傷害加倍。', 'enemy');
      } catch (e) {}
      return r;
    };
  });

  // ── 擊殺：50% 祝福（2026-10-28：原本 100%）、龍鑽、新掉落 ──
  var dreamKill = 0;
  if (typeof window.rollAffixesNew === 'function') {
    var oRollD = window.rollAffixesNew;
    window.rollAffixesNew = function () { var r = oRollD.apply(this, arguments); try { if (dreamKill > 0 && r && r.bless !== true && r.bless !== 'cursed' && Math.random() < 0.5) r.bless = true; } catch (e) {} return r; };
  }
  var addDia = function (n) { try { if (typeof window.pandoraAdjustSharedDiamonds === 'function') return !!(window.pandoraAdjustSharedDiamonds(n) || {}).ok; } catch (e) {} return false; };
  var oKill = window.killMob;
  window.killMob = function (idx) {
    var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null;
    var dream = !!(m && m._dream && !m._dead);
    if (dream) dreamKill++;   // 每件裝備各自 50% 祝福
    var r;
    try { r = oKill.apply(this, arguments); }
    finally { if (dream) dreamKill--; }
    try {
      if (m && m._dead && !m._afkDreamPaid) {
        m._afkDreamPaid = true;
        if (m.n === (window.__afkAntFinal || '被侵蝕的瘋狂安塔瑞斯')) gainItem('afk_contempt_earth', 1);
        // 境滅亡域鑰匙：四大龍副本——瘋狂席琳 0.01%、席琳夢域鏡 1%（固定，不吃倍率）
        if (CORRUPT_MAPS.indexOf(mapState.current) >= 0 && m._sherineMad && Math.random() < (dream ? 0.01 : 0.0001)) {
          var keepInfo = (typeof _lootMobInfo !== 'undefined') ? _lootMobInfo : null;
          try { _lootMobInfo = { n: m.n, lv: m.lv, boss: !!m.boss }; } catch (e) {}
          try { gainItem('afk_abyss_key', 1); } finally { try { _lootMobInfo = keepInfo; } catch (e) {} }
        }
        if (dream) {
          var savedInfo = (typeof _lootMobInfo !== 'undefined') ? _lootMobInfo : null;
          try { _lootMobInfo = { n: m.n, lv: m.lv, boss: !!m.boss }; } catch (e) {}
          try {
            if (m.boss) { gainItem('afk_dream_crystal', 3); gainItem('afk_hell_essence', 1); }
            else if (Math.random() < 0.10) gainItem('afk_dream_crystal', 1);
            if (m.boss && (m.lv || 0) >= 80) gainItem(CONTEMPT[Math.floor(Math.random() * 4)], 1);
            if (!m.boss && Math.random() < 0.01) gainItem('afk_contempt_shard', 1);   // 一般怪：固定 1% 碎片（玩家 2026-10-21 改）
            if (window.__afkCardPlus && window.__afkCardPlus.platFull()) {   // 白金卡全滿
              if (Math.random() < 0.0005) gainItem(['afk_asc_stone_wpn', 'afk_asc_stone_arm', 'afk_asc_stone_acc'][Math.floor(Math.random() * 3)], 1);
              if (Math.random() < 0.001) gainItem('afk_asc_shard', 1);
            }
          } finally { try { _lootMobInfo = savedInfo; } catch (e) {} }
          if (Math.random() < 0.001) {
            var n = Math.random() < 0.5 ? 1 + Math.floor(Math.random() * 499) : 500;
            if (addDia(n) && typeof logSys === 'function') logSys('<span class="text-cyan-300 font-bold">' + m.n + ' 的殘骸裡散落著龍之鑽石 × ' + n + '。</span>');
          }
        }
      }
    } catch (e) {}
    return r;
  };

  // ── 席琳祈禱：第三個選項 ──
  var toggleDream = function () {
    if ((player.lv || 1) < 80) { logSys('<span class="text-red-400">你的力量尚淺（需 Lv80），席琳對你的祈禱置若罔聞。</span>'); return; }
    player.sherineDream = !player.sherineDream;
    if (player.sherineDream) { player.sherineMad = true; player.sherineWorld = false; }
    try { applySherineTheme(); } catch (e) {}
    logSys(player.sherineDream
      ? '<span class="c-sherine font-bold">席琳睜開了雙眼。</span><span class="text-fuchsia-300">妖豔的夢魘吞沒了世界——經驗 ×10、金幣 ×3，還有昇華支配的材料與無盡的試煉。（瘋狂席琳＋席琳夢域鏡已開啟）</span>'
      : '<span class="text-slate-300">夢魘退去，你回到瘋狂的席琳世界。（席琳夢域鏡已關閉）</span>');
    try { saveGame(); } catch (e) {}
    try { renderMobs(); } catch (e) {}
    var el = document.getElementById('interaction-content'); if (el) { try { renderSherinePray(el); } catch (e) {} }
  };
  window.toggleSherineDream = toggleDream;
  ['toggleSherineWorld', 'toggleSherineMad'].forEach(function (fn) {
    var o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () { var r = o.apply(this, arguments); try { if (!player.sherineMad) player.sherineDream = false; } catch (e) {} try { var el = document.getElementById('interaction-content'); if (el && document.getElementById('afk-dream-card')) renderSherinePray(el); } catch (e) {} return r; };
  });
  if (typeof window.renderSherinePray === 'function') {
    var oPray = window.renderSherinePray;
    window.renderSherinePray = function (div) {
      var r = oPray.apply(this, arguments);
      try {
        var on = dreamOn(), lvOk = (player.lv || 1) >= 80;
        var box = div.querySelector('.flex.flex-col.gap-3') || div;
        box.insertAdjacentHTML('beforeend',
          '<div id="afk-dream-card" class="bg-slate-950/80 border ' + (on ? 'border-fuchsia-500' : 'border-slate-700') + ' rounded p-3 text-sm leading-relaxed">'
          + '<div class="font-bold mb-1 ' + (on ? 'text-fuchsia-300' : 'text-fuchsia-200') + '">🌙 瘋狂席琳＋席琳夢域鏡：目前 ' + (on ? '<span class="text-fuchsia-300">開啟</span>' : '<span class="text-slate-400">關閉</span>') + '</div>'
          + '<div class="afk-lore">「再深一點……讓你的夢，也染上我的顏色。」——瘋狂的席琳</div><div class="text-slate-200 text-xs">以瘋狂席琳為底：全部怪物處於恩賜狀態（HP 共 ×50）、隨時狂暴、AC/魔防再提高、命中 ×3、減傷與迴避 +15、傷害（一般怪 ×2／頭目 ×5）、持續傷害 ×5、會回血；'
          + '一般怪出生 10 秒隨機免疫物理或魔法。經驗 ×10、金幣 ×3，每殺 0.1% 掉龍之鑽石；掉落 ×8、裝備 50% 祝福、席琳結晶 ×5，'
          + '並掉落<span class="text-fuchsia-300 font-bold">夢艷結晶</span>、<span class="text-red-300 font-bold">地獄精華</span>、<span class="text-amber-300 font-bold">滅魔蔑視水晶</span>與碎片（昇華支配材料）。</div></div>'
          + '<button type="button" class="btn py-3 text-base font-bold ' + (!lvOk ? 'bg-slate-600 border-slate-500 opacity-60 cursor-not-allowed' : (on ? 'bg-slate-700 hover:bg-slate-600 border-slate-500' : 'bg-fuchsia-950 hover:bg-fuchsia-900 border-fuchsia-600'))
          + '" ' + (!lvOk ? 'disabled' : '') + ' onclick="toggleSherineDream()">' + (!lvOk ? '等級不足（需 Lv80）' : (on ? '🙏 祈禱：關閉席琳夢域鏡' : '🌙 祈禱：開啟瘋狂席琳＋席琳夢域鏡')) + '</button>');
      } catch (e) {}
      return r;
    };
  }

  // ── 畫面主題：席琳夢域鏡改黑金色（玩家 2026-10-26；原本沿用瘋狂席琳的猩紅色）──
  (function () {
    var css = document.createElement('style'); css.id = 'afk-dream-theme';
    css.textContent =
      'body.sherine-dream,body.game-bg-dim.sherine-dream{background-image:linear-gradient(rgba(10,8,3,.9),rgba(2,2,1,.96)),url("assets/background/background.webp")}' +
      'body.sherine-dream #map-view-panel{border-color:#8a6a24!important;box-shadow:inset 0 0 0 1px rgba(14,10,3,.94),inset 0 0 10px rgba(138,106,36,.18),0 0 9px rgba(161,124,42,.45),0 8px 16px rgba(0,0,0,.65)}' +
      'body.sherine-dream .mob-target{background:#0f0b04;border-color:#8a6a24}' +
      'body.sherine-dream .mob-target.active{background:#2a1f08;border-color:#facc15;box-shadow:0 0 12px rgba(250,204,21,.5)}' +
      'body.sherine-dream .mob-target:hover:not(.active){background:#1c1507}' +
      'body.sherine-dream #battle-view.has-bg .mob-target,body.sherine-dream #battle-view.has-bg .mob-target.active{background:transparent!important;border-color:transparent!important;box-shadow:none}' +
      'body.sherine-dream #m-status .ms-sherine.ms-sherine-mad{color:#fde68a;text-shadow:0 0 7px rgba(234,179,8,.9)}';
    (document.head || document.documentElement).appendChild(css);
    var sync = function () { try { document.body.classList.toggle('sherine-dream', dreamOn() && document.body.classList.contains('sherine-mad')); } catch (e) {} };
    if (typeof window.applySherineTheme === 'function') { var oTheme = window.applySherineTheme; window.applySherineTheme = function () { var r = oTheme.apply(this, arguments); sync(); return r; }; }
    if (typeof window.returnToCharacterSelect === 'function') { var oRet = window.returnToCharacterSelect; window.returnToCharacterSelect = function () { var r = oRet.apply(this, arguments); try { document.body.classList.remove('sherine-dream'); } catch (e) {} return r; }; }
    if (typeof window.tick === 'function') { var oTT = window.tick; window.tick = function () { var r = oTT.apply(this, arguments); try { if ((state.ticks || 0) % 10 === 0) sync(); } catch (e) {} return r; }; }
  })();

  // ── 幻術士：席琳夢域鏡中幻覺（歐吉／巫妖／鑽石高崙）每打中一下，全隊（自己＋傭兵）各回復 30 MP（玩家 2026-10-28）──
  var ILLU_MP = 30, illuStat = { hits: 0 };
  if (typeof window.illuSummonTick === 'function') {
    var oIllu = window.illuSummonTick;
    window.illuSummonTick = function (owner) {
      if (!dreamOn()) return oIllu.apply(this, arguments);
      var hits = 0, cc = window.AFK_CARD_COMBAT, oDmg = cc && cc.damage, oLog = window.logCombat;
      if (cc && typeof oDmg === 'function') cc.damage = function () { hits++; return oDmg.apply(this, arguments); };
      else if (typeof oLog === 'function') window.logCombat = function (msg) { if (/【幻覺：[^】]*】<\/span>對 /.test(String(msg))) hits++; return oLog.apply(this, arguments); };
      var r;
      try { r = oIllu.apply(this, arguments); }
      finally {
        if (cc && oDmg) cc.damage = oDmg; if (window.logCombat !== oLog && oLog) window.logCombat = oLog;
        if (hits > 0) {
          illuStat.hits += hits;
          var add = ILLU_MP * hits;
          try {
            if (player && !player.dead) player.mp = Math.min(player.mmp || 0, (player.mp || 0) + add);
            (player.allies || []).forEach(function (a) { if (a && !a._downed) a.mp = Math.min(a.mmp || 0, (a.mp || 0) + add); });
          } catch (e) {}
        }
      }
      return r;
    };
  }
  window.__afkDreamHell = { on: dreamOn, applyDream: applyDream, items: Object.keys(ITEMS), illuStat: illuStat, illuMp: ILLU_MP };
  console.log('[AFK-dreamhell] 已啟用：瘋狂席琳＋席琳夢域鏡模式（在席琳神殿開啟）');
})();
