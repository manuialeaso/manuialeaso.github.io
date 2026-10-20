/* ============================================================================
 * afk-dreamhell.js — 瘋狂席琳夢艷地獄模式（玩家 2026-10-21 指定）
 *
 * 開啟方式：跟席琳世界一樣，到席琳神殿向席琳祈禱（第三個選項）；開啟後套用到所有地圖。
 *   以「瘋狂的席琳世界」為底（開啟時會一併開啟瘋狂席琳），再加上以下規則。
 *
 * 怪物（攻城區、血盟敵人除外，與席琳世界相同）
 *   ‧全部處於「席琳的恩賜」狀態：HP 再 ×10（瘋狂 ×5 × 恩賜 ×10＝×50）
 *   ‧AC：一般怪 −20、頭目 −50（再加在瘋狂席琳之後），最低 −300
 *   ‧魔防：一般怪 +20、頭目 +50，最高 300
 *   ‧命中：基礎命中 ×3（瘋狂席琳是 ×2）
 *   ‧額外減傷：等級 ÷ 3 ＋ 15；迴避 +15
 *   ‧一般攻擊與技能傷害：一般怪 再 ×2、頭目 再 ×5（瘋狂席琳的 ×3 之外）；怪物施加的持續傷害 再 ×5
 *   ‧全部隨時處於狂暴狀態（同吉爾塔斯：命中與傷害 ×1.2）
 *   ‧一般怪出生時隨機免疫「物理」或「魔法」傷害 10 秒（血壁空間型免疫；持續傷害、寵物、召喚不受影響）
 *   ‧回血：頭目每秒回最大 HP 0.1%；一般怪原本有回血的每秒 +100，沒有的每秒 +500
 *   ‧出怪等待再 −3 秒（下限 0.5 秒）
 * 報酬
 *   ‧經驗 0、金幣 0；每殺一隻 0.1% 機率掉龍之鑽石（掉的時候一半是 1～499 隨機、一半是 500）
 *   ‧掉落機率 ×50（恩賜 ×10 × 5）；裝備掉落 100% 祝福；席琳結晶掉率 ×5
 *   ‧新掉落：夢艷結晶（一般怪 10%、頭目必掉 3 顆）、地獄精華（頭目必掉）、
 *            80 級以上的怪掉四屬性滅魔蔑視水晶（一般怪 1%、頭目必掉，隨機一種屬性）
 *   ‧被侵蝕的瘋狂安塔瑞斯（任何模式）：必掉 滅魔蔑視水晶(地)
 * 新道具（昇華支配材料）：夢艷結晶、地獄精華、滅魔蔑視水晶(地／水／風／火)、至暗星塵、夢域塵、境滅亡域鑰匙
 * 核心掛點：補丁 18（掉落 ×50、結晶 ×5、出怪 −3 秒、phys 免疫）；其餘包 applySherineBuff／killMob／tick／席琳祈禱介面。
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
    afk_dream_crystal: { n: '夢艷結晶', c: 'text-fuchsia-300', d: '夢艷地獄中凝結的妖豔結晶，昇華支配的材料。（夢艷地獄：一般怪隨機掉落、頭目必掉）' },
    afk_hell_essence: { n: '地獄精華', c: 'text-red-400', d: '夢艷地獄頭目體內淬鍊出的精華，昇華支配的材料；20 個可在哈瑪大師合成至暗星塵。（夢艷地獄頭目必掉）' },
    afk_contempt_earth: { n: '滅魔蔑視水晶(地)', c: 'text-amber-300', d: '蔑視一切魔力的大地水晶，昇華支配的材料。（被侵蝕的瘋狂安塔瑞斯、夢艷地獄 80 級以上的怪）' },
    afk_contempt_water: { n: '滅魔蔑視水晶(水)', c: 'text-sky-300', d: '蔑視一切魔力的水之水晶，昇華支配的材料。（被侵蝕的瘋狂法利昂、夢艷地獄 80 級以上的怪）' },
    afk_contempt_wind: { n: '滅魔蔑視水晶(風)', c: 'text-emerald-300', d: '蔑視一切魔力的風之水晶，昇華支配的材料。（被侵蝕的瘋狂林德拜爾、夢艷地獄 80 級以上的怪）' },
    afk_contempt_fire: { n: '滅魔蔑視水晶(火)', c: 'text-orange-400', d: '蔑視一切魔力的火之水晶，昇華支配的材料。（被侵蝕的瘋狂巴拉卡斯、夢艷地獄 80 級以上的怪）' },
    afk_dark_stardust: { n: '至暗星塵', c: 'text-violet-300', d: '以 20 個地獄精華合成（成功率 70%），昇華支配升級的材料。' },
    afk_dream_dust: { n: '夢域塵', c: 'text-pink-300', d: '暗夢星迴才會掉落的夢之塵，每顆使昇華支配成功率 +10%，一次最多 5 顆。' },
    afk_abyss_key: { n: '境滅亡域鑰匙', c: 'text-rose-400', d: '夢艷地獄難度四大龍副本必掉的鑰匙，昇華支配 +5 的材料。' }
  };
  var ICON = '';
  try { ICON = getIconUrl(DB.items.sherine_crystal); } catch (e) {}
  Object.keys(ITEMS).forEach(function (id) {
    if (DB.items[id]) return;
    var x = ITEMS[id];
    DB.items[id] = { n: x.n, type: 'etc', p: 0, c: x.c, noUse: true, gachaWeight: 0, d: x.d, img: ICON };
  });
  var CONTEMPT = ['afk_contempt_earth', 'afk_contempt_water', 'afk_contempt_wind', 'afk_contempt_fire'];

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
  function applyDream(m) {
    if (!m || m._dream || !m._sherine) return;
    var boss = !!m.boss;
    m._dream = true;
    // 恩賜狀態
    if (!m._grace) { m._grace = true; m.hp = Math.floor(m.hp * 10); }
    m.curHp = m.hp;
    m.ac = Math.max(-300, (m.ac || 0) - (boss ? 50 : 20));
    m.mr = Math.min(300, (m.mr || 0) + (boss ? 50 : 20));
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
    m.exp = 0; m.goldMin = 0; m.goldMax = 0; m.noGold = true;
    // 一般怪：出生 10 秒隨機免疫物理或魔法
    if (!boss) {
      var kind = Math.random() < 0.5 ? 'phys' : 'magic';
      m._reflectWall = { kind: kind, until: ((typeof state !== 'undefined' && state.ticks) || 0) + 100, block: true };
    }
    m._dreamRegen = boss ? 0 : (m.regenHp ? 100 : 500);
  }
  var oBuff = window.applySherineBuff;
  window.applySherineBuff = function (idx) {
    var r = oBuff.apply(this, arguments);
    try { if (dreamOn()) applyDream(mapState.mobs[idx]); } catch (e) {}
    return r;
  };
  // 恩賜每次刷新的 1%：夢艷地獄全部已是恩賜，不再重複 ×10
  if (typeof window.applySherineGrace === 'function') {
    var oGrace = window.applySherineGrace;
    window.applySherineGrace = function () { if (dreamOn()) return; return oGrace.apply(this, arguments); };
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
    var regen = function () {
      try {
        if (state.ticks % 10 === 0 && mapState && mapState.mobs) {
          for (var i = 0; i < mapState.mobs.length; i++) {
            var m = mapState.mobs[i];
            if (!m || !m._dream || m._dead || m.curHp <= 0 || m.curHp >= m.hp) continue;
            var add = m.boss ? Math.max(1, Math.floor(m.hp * 0.001)) : (m._dreamRegen || 0);
            m.curHp = Math.min(m.hp, m.curHp + add);
          }
        }
      } catch (e) {}
    };
  }

  // ── 擊殺：100% 祝福、龍鑽、新掉落 ──
  var addDia = function (n) { try { if (typeof window.pandoraAdjustSharedDiamonds === 'function') return !!(window.pandoraAdjustSharedDiamonds(n) || {}).ok; } catch (e) {} return false; };
  var oKill = window.killMob;
  window.killMob = function (idx) {
    var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null;
    var dream = !!(m && m._dream && !m._dead);
    var fb = (typeof _forceBless !== 'undefined') ? _forceBless : false;
    if (dream) { try { _forceBless = true; } catch (e) {} }
    var r;
    try { r = oKill.apply(this, arguments); }
    finally { if (dream) { try { _forceBless = fb; } catch (e) {} } }
    try {
      if (m && m._dead && !m._afkDreamPaid) {
        m._afkDreamPaid = true;
        if (m.n === '被侵蝕的瘋狂安塔瑞斯') gainItem('afk_contempt_earth', 1);
        if (dream) {
          var savedInfo = (typeof _lootMobInfo !== 'undefined') ? _lootMobInfo : null;
          try { _lootMobInfo = { n: m.n, lv: m.lv, boss: !!m.boss }; } catch (e) {}
          try {
            if (m.boss) { gainItem('afk_dream_crystal', 3); gainItem('afk_hell_essence', 1); }
            else if (Math.random() < 0.10) gainItem('afk_dream_crystal', 1);
            if ((m.lv || 0) >= 80 && (m.boss || Math.random() < 0.01)) gainItem(CONTEMPT[Math.floor(Math.random() * 4)], 1);
          } finally { try { _lootMobInfo = savedInfo; } catch (e) {} }
          if (Math.random() < 0.001) {
            var n = Math.random() < 0.5 ? 1 + Math.floor(Math.random() * 499) : 500;
            if (addDia(n) && typeof logSys === 'function') logSys('<span class="text-cyan-300 font-bold">💎 ' + m.n + ' 掉落了龍之鑽石 × ' + n + '！</span>');
          }
        }
      }
    } catch (e) {}
    return r;
  };

  // ── 席琳祈禱：第三個選項 ──
  var toggleDream = function () {
    if ((player.lv || 1) < 40) { logSys('<span class="text-red-400">等級未達 40，席琳對你的祈禱沒有回應。</span>'); return; }
    player.sherineDream = !player.sherineDream;
    if (player.sherineDream) { player.sherineMad = true; player.sherineWorld = false; }
    try { applySherineTheme(); } catch (e) {}
    logSys(player.sherineDream
      ? '<span class="c-sherine font-bold">【瘋狂席琳夢艷地獄】已開啟。</span><span class="text-fuchsia-300">妖豔的夢魘吞沒了世界……沒有經驗、沒有金幣，只有昇華支配的材料與無盡的試煉。</span>'
      : '<span class="text-slate-300">【瘋狂席琳夢艷地獄】已關閉，回到瘋狂的席琳世界。</span>');
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
        var on = dreamOn(), lvOk = (player.lv || 1) >= 40;
        var box = div.querySelector('.flex.flex-col.gap-3') || div;
        box.insertAdjacentHTML('beforeend',
          '<div id="afk-dream-card" class="bg-slate-950/80 border ' + (on ? 'border-fuchsia-500' : 'border-slate-700') + ' rounded p-3 text-sm leading-relaxed">'
          + '<div class="font-bold mb-1 ' + (on ? 'text-fuchsia-300' : 'text-fuchsia-200') + '">🌙 瘋狂席琳夢艷地獄：目前 ' + (on ? '<span class="text-fuchsia-300">開啟</span>' : '<span class="text-slate-400">關閉</span>') + '</div>'
          + '<div class="text-slate-200 text-xs">以瘋狂席琳為底：全部怪物處於恩賜狀態（HP 共 ×50）、隨時狂暴、AC/魔防再提高、命中 ×3、減傷與迴避 +15、傷害（一般怪 ×2／頭目 ×5）、持續傷害 ×5、會回血；'
          + '一般怪出生 10 秒隨機免疫物理或魔法。<span class="text-red-300">沒有經驗與金幣</span>，改為 0.1% 掉龍之鑽石；掉落 ×50、裝備必定祝福、席琳結晶 ×5，'
          + '並掉落<span class="text-fuchsia-300 font-bold">夢艷結晶</span>、<span class="text-red-300 font-bold">地獄精華</span>、<span class="text-amber-300 font-bold">滅魔蔑視水晶</span>（昇華支配材料）。</div></div>'
          + '<button type="button" class="btn py-3 text-base font-bold ' + (!lvOk ? 'bg-slate-600 border-slate-500 opacity-60 cursor-not-allowed' : (on ? 'bg-slate-700 hover:bg-slate-600 border-slate-500' : 'bg-fuchsia-950 hover:bg-fuchsia-900 border-fuchsia-600'))
          + '" ' + (!lvOk ? 'disabled' : '') + ' onclick="toggleSherineDream()">' + (!lvOk ? '等級不足（需 Lv40）' : (on ? '🙏 祈禱：關閉夢艷地獄' : '🌙 祈禱：開啟瘋狂席琳夢艷地獄')) + '</button>');
      } catch (e) {}
      return r;
    };
  }

  window.__afkDreamHell = { on: dreamOn, applyDream: applyDream, items: Object.keys(ITEMS) };
  console.log('[AFK-dreamhell] 已啟用：瘋狂席琳夢艷地獄模式（在席琳神殿開啟）');
})();
