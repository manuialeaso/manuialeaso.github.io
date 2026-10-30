/* ============================================================================
 * afk-kurt-hunt.js — 世界事件「克特的追殺令」＋克特技能組（玩家 2026-10-29；企劃 docs/lore-expansion-plan.md 第 6 節）
 *
 *   觸發：隊伍裡有王族（玩家本人或任何一名傭兵）、角色 Lv30 以上、在可出現的地圖（野外、地監、傲慢之塔、海賊島）；
 *         每次新出怪判定 5%，觸發後冷卻 15 分鐘。離線補跑期間不觸發。
 *   不出現：城鎮、副本（含支配者傲慢之塔、四龍巢穴、軍王之室、謀叛者的低語、吉爾塔斯祭壇、最終決戰…）、時空裂痕、攻城、純 BOSS 房、
 *           新兵修練場、夢幻之島。
 *   追殺：事件持續 10 分鐘（只在可出現的地圖裡計時）。換地圖時克特 20～40 秒後追到；HP 保留不回滿。
 *   結束：打倒克特／10 分鐘到（克特離開）／王族倒下（克特離開，算失敗）。王族倒下照一般死亡。
 *   強度：L＝地圖一般怪平均等級＋8（18～115）；HP＝基準×(L÷65)^2.5×(1＋0.15×傭兵數)、傷害骰×L÷65、額外傷害×(L÷65)^1.3、命中／AC／魔防×L÷65。
 *   技能：王血追獵（70% 優先打王族、對王族傷害 +30%）、盾擊、極道落雷、賽尼斯的黑魔法鎧（魔法傷害 −40%；HP 30% 碎裂、物理傷害 +20%）、
 *         黑騎士召集（HP 70%、40% 各 2 名黑騎士）、斬首宣告（每 45 秒標記王族 5 秒，結束時王族最大 HP 25%；5 秒內打掉克特 5% HP 可打斷）。
 *   港口／黑騎士前哨的克特（一般型態）：一樣有王血追獵、黑魔法鎧、黑騎士召集（沒有斬首宣告）。
 *   獎勵：經驗、金幣 ×3；黑騎士團的追殺令 必掉 1；封印的克特套裝箱子 10%／25%／50%（L<40／40～79／80+）；克特頭盔、盔甲、長靴、手套 各 2%。
 *         追殺令交給說話之島 甘特：10 張 → 紅獅王的守護（30 分鐘受到克特的傷害 −30%）；50 張 → 克特的牛角頭盔（王族專用頭盔）。
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
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'kurthunt', name: '世界事件：克特的追殺令', group: '遊戲內容',
    desc: '隊伍裡有王族、Lv30 以上時，野外／地監／傲慢之塔每次出怪 5% 被黑騎士隊長克特追殺 10 分鐘（冷卻 15 分鐘）；強度跟著地圖等級，副本裡不出現' });
  if (T && !T.enabled('kurthunt')) return;
  if (typeof DB === 'undefined' || !DB.mobs || !DB.mobs.kurt) return;

  var RATE = 0.05, CD_MS = 15 * 60 * 1000, DUR = 6000, LV_MIN = 30;   // DUR：tick（0.1 秒）＝10 分鐘
  var TUNE = W.__afkKurtTune = W.__afkKurtTune || { lvAdd: 8, dmgMult: 1, royalMult: 1.3 };
  var MARK_EVERY = 450, MARK_DELAY = 50, SUMMON_AT = [0.7, 0.4];
  var ORDER = 'afk_kurt_order', SCROLL = 'afk_kurt_guard', HELM = 'afk_kurt_helm';
  var BOX = 'ttmi_13986', GEAR = ['hlm_kurt', 'amr_kurt', 'arm_97', 'arm_101'];
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var clog = function (h, c) { try { if (typeof logCombat === 'function' && !S().ff) logCombat(h, c || 'enemy'); } catch (e) {} };
  var rint = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };

  // ── 道具 ──
  var ITEMS = {};
  ITEMS[ORDER] = { n: '黑騎士團的追殺令', type: 'etc', c: 'text-red-300', img: 'assets/icons/items/法令軍團印記.png', noUse: true, p: 0,
    d: '黑騎士隊長克特隨身帶著的追殺令，上面寫滿亞丁王族的名字。交給說話之島的甘特：10 張換「紅獅王的守護」、50 張換「克特的牛角頭盔」。' };
  ITEMS[SCROLL] = { n: '紅獅王的守護', type: 'misc', eff: 'afk_kurt_guard', c: 'text-amber-300', img: 'assets/icons/items/古代的卷軸.png', p: 0,   /* eff：道具視窗才會出現「使用」按鈕（2026-10-30 修） */
    d: '杜克‧德比的紅獅紋章封在卷軸裡。使用後 30 分鐘內，全隊受到黑騎士隊長克特的傷害 −30%。' };
  ITEMS[HELM] = { n: '克特的牛角頭盔', type: 'arm', slot: 'helm', c: 'text-red-300', img: 'assets/icons/armors/克特頭盔.png', p: 0, req: 'royal',
    ac: 5, mhp: 100, mr: 10, extraDmg: 1, safe: 4,
    d: '克特那頂白色牛角頭盔的仿品，被追殺過的王族才有資格戴上。王族專用：AC 5、最大 HP +100、魔防 +10、額外傷害 +1。' };
  Object.keys(ITEMS).forEach(function (id) {
    if (DB.items[id]) return;
    var x = ITEMS[id], d = { gachaWeight: 0, weight: 0 };
    Object.keys(x).forEach(function (k) { d[k] = x[k]; });
    if (id === ORDER) { d.noSell = true; d.questItem = true; }
    DB.items[id] = d;
  });

  // ── 地圖 ──
  var catOf = function (id) {
    if (typeof MAP_CATEGORIES === 'undefined') return null;
    for (var k in MAP_CATEGORIES) if ((MAP_CATEGORIES[k] || []).some(function (m) { return m.v === id; })) return k;
    return null;
  };
  var NO = { training: 1, dream_island: 1, barlog_room: 1, town_pride: 1 };
  var okMap = function (id) {
    if (!id || id === 'rift_battle' || NO[id] || /^afk_|^dom_tower|^town_/.test(id)) return false;
    var c = catOf(id); if (c !== 'wild' && c !== 'dungeon' && c !== 'tower' && c !== 'pirate_island') return false;
    if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS.indexOf(id) >= 0) return false;
    if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS[id]) return false;
    if (typeof ANTHARAS_AREA_BOSS !== 'undefined' && ANTHARAS_AREA_BOSS[id]) return false;
    if ((W.__afkNoOfflineMaps || []).indexOf(id) >= 0) return false;
    try { if (typeof isSiegeArea === 'function' && isSiegeArea(id)) return false; } catch (e) {}
    return !!(DB.maps[id] && DB.maps[id].length);
  };
  var mapLv = function (id) {
    var ls = (DB.maps[id] || []).map(function (k) { return DB.mobs[k]; }).filter(function (m) { return m && !m.boss; }).map(function (m) { return Number(m.lv) || 1; });
    return ls.length ? Math.round(ls.reduce(function (a, b) { return a + b; }, 0) / ls.length) : 1;
  };
  var levelFor = function (id) { return Math.max(18, Math.min(115, mapLv(id) + TUNE.lvAdd)); };

  // ── 隊伍 ──
  var royals = function (alive) {
    var p = P(); if (!p) return [];
    var out = [];
    if (p.cls === 'royal' && (!alive || !p.dead)) out.push(p);
    (p.allies || []).forEach(function (a) { if (a && a.cls === 'royal' && (!alive || (!a._downed && (a.curHp || 0) > 0))) out.push(a); });
    return out;
  };
  var allyCount = function () { var p = P(); return p ? (p.allies || []).filter(Boolean).length : 0; };
  var catching = function () { try { return typeof W.__afkOfflineNow === 'function' && !!W.__afkOfflineNow(); } catch (e) { return false; } };   // 離線補跑、背景分頁補跑時不觸發

  // ── 造出克特 ──
  var scaleMob = function (base, L, ref, hpMult) {
    var k = L / ref, m = JSON.parse(JSON.stringify(base));
    m.lv = L;
    m.hp = Math.max(1, Math.round(base.hp * Math.pow(k, 2.5) * (hpMult || 1)));
    if (Array.isArray(base.dmg)) m.dmg = [base.dmg[0], Math.max(2, Math.round(base.dmg[1] * k))];
    m.db = Math.max(0, Math.round((base.db || 0) * Math.pow(k, 1.3)));
    m.hit = Math.round((base.hit || 0) * k);
    m.ac = Math.round((base.ac || 0) * k);
    m.mr = Math.round((base.mr || 0) * k);
    ['mag', 'mag2', 'mag3'].forEach(function (f) { var s = m[f]; if (s && Array.isArray(s.dmg)) { s.dmg = [s.dmg[0], Math.max(2, Math.round(s.dmg[1] * k))]; s.db = Math.round((s.db || 0) * Math.pow(k, 1.3)); } });
    return m;
  };
  var place = function (idx, obj) {
    mapState.mobs[idx] = Object.assign(obj, { curHp: obj.hp, uid: uid(), _born: ++_mobBornSeq, _bornMs: Date.now(), _magCd: {}, justHit: false, st: newMobStatus() });
    try { if (typeof applySherineBuff === 'function') applySherineBuff(idx); } catch (e) {}
    var m = mapState.mobs[idx];
    try { if (m.hard && typeof initHardSkin === 'function') initHardSkin(m); } catch (e) {}
    return m;
  };
  var buildKurt = function (L) {
    var base = DB.mobs.kurt, m = scaleMob(base, L, base.lv || 65, 1 + 0.15 * allyCount());
    m.mobId = 'kurt'; m.hit += 10;
    m.exp = Math.round((base.exp || 0) * Math.pow(L / (base.lv || 65), 2) * 3);
    m.goldMin = Math.round((base.goldMin || 0) * (L / (base.lv || 65)) * 3); m.goldMax = Math.round((base.goldMax || 0) * (L / (base.lv || 65)) * 3);
    if (TUNE.dmgMult !== 1) { if (Array.isArray(m.dmg)) m.dmg = [m.dmg[0], Math.max(2, Math.round(m.dmg[1] * TUNE.dmgMult))]; m.db = Math.round(m.db * TUNE.dmgMult); ['mag', 'mag2', 'mag3'].forEach(function (f) { var s = m[f]; if (s && Array.isArray(s.dmg)) { s.dmg = [s.dmg[0], Math.max(2, Math.round(s.dmg[1] * TUNE.dmgMult))]; s.db = Math.round((s.db || 0) * TUNE.dmgMult); } }); }
    m._afkKurt = 'hunt'; m._kurtL = L; m.beh = '主動';
    return m;
  };

  // ── 事件狀態（不存檔：重新整理＝追殺結束；冷卻存在角色上） ──
  var hunt = null;
  var kurtOnField = function () { return (mapState.mobs || []).map(function (m, i) { return [m, i]; }).filter(function (x) { return x[0] && x[0]._afkKurt === 'hunt' && !x[0]._dead && x[0].curHp > 0; })[0] || null; };
  var freeSlot = function () {
    var ms = mapState.mobs || [], i;
    for (i = 0; i < ms.length; i++) if (!ms[i] || ms[i]._dead) return i;
    for (i = 0; i < ms.length; i++) if (ms[i] && !ms[i].boss && !ms[i]._afkKurt) return i;
    return -1;
  };
  var badge = function () {
    try {
      var el = document.getElementById('afk-kurt-badge');
      if (!hunt) { if (el) el.remove(); return; }
      var host = (function () {   // 世界事件的狀態列共用容器：放在 #status-alerts 旁邊，不放裡面（核心每個 tick 都會改寫 #status-alerts 的文字，把徽章洗掉又加回 → 那一排一直抖；玩家 2026-10-29 22:37）
        var h = document.getElementById('afk-ev-badges'); if (h) return h;
        var sa = document.getElementById('status-alerts'); if (!sa || !sa.parentNode) return null;
        h = document.createElement('span'); h.id = 'afk-ev-badges'; h.className = 'text-sm'; h.style.cssText = 'font-weight:bold;font-variant-numeric:tabular-nums;white-space:nowrap';
        sa.parentNode.insertBefore(h, sa.nextSibling); return h;
      })(); if (!host) return;
      if (!el) { el = document.createElement('span'); el.id = 'afk-kurt-badge'; el.style.cssText = 'color:#fca5a5;font-weight:bold;margin-left:6px'; host.appendChild(el); }
      var s = Math.max(0, Math.ceil(hunt.left / 10)), mm = Math.floor(s / 60), ss = s % 60;
      var tx = '⚔ 克特追殺中 ' + (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss; if (el.textContent !== tx) el.textContent = tx;
    } catch (e) {}
  };
  var stats = function () { var p = P(); if (!p) return {}; var s = p.afkKurtStats || (p.afkKurtStats = { met: 0, kills: 0, fails: 0, escapes: 0 }); return s; };
  var end = function (why) {
    if (!hunt) return;
    var f = kurtOnField();
    if (f && why !== 'kill') { mapState.mobs[f[1]] = null; try { if (!S().ff) renderMobs(); } catch (e) {} }
    var st = stats();
    if (why === 'kill') { st.kills = (st.kills || 0) + 1; sys('<span class="font-bold" style="color:#fde68a">⚔ 黑騎士隊長克特倒下了——這一次，王族的血沒有斷。</span>'); }
    else if (why === 'royal') { st.fails = (st.fails || 0) + 1; sys('<span class="font-bold" style="color:#f87171">⚔ 克特收劍：「王族的血，到此為止。」他消失在黑騎士團的陣列之後。</span>'); }
    else { st.escapes = (st.escapes || 0) + 1; sys('<span class="font-bold" style="color:#fca5a5">⚔ 十分鐘過去，克特冷笑一聲離開了：「下一次，你不會這麼幸運。」</span>'); }
    hunt = null; badge();
    try { var pp = P(); if (pp) { if (!pp.afkWe || typeof pp.afkWe !== 'object') pp.afkWe = { cd: {}, gap: 0, stats: {} }; pp.afkWe.gap = Date.now() + ((W.__afkWorldEvents && W.__afkWorldEvents.GAP_MS) || 15 * 60 * 1000); } } catch (e) {}   // 共用冷卻 15 分鐘（玩家 2026-10-30 14:22，原 10 分鐘）
  };
  var start = function (idx) {
    var p = P(), cur = mapState.current, L = levelFor(cur);
    var m = place(idx, buildKurt(L));
    hunt = { left: DUR, map: cur, wait: 0, hpFrac: 1, L: L, summoned: 0, markAt: tk() + MARK_EVERY, mark: null };
    p.afkKurtCd = Date.now() + CD_MS;
    stats().met = (stats().met || 0) + 1;
    sys('<span class="font-bold" style="color:#ef4444;text-shadow:0 0 8px #7f1d1d">⚔ 黑騎士隊長克特嗅到了王族的血——追殺令已發出！</span><span class="text-slate-300">（Lv' + L + '，10 分鐘內換地圖也會追來；打倒他、撐過 10 分鐘，或王族倒下才會結束）</span>');
    try { if (typeof vfxBossEntrance === 'function' && !S().ff) vfxBossEntrance(m); } catch (e) {}
    badge();
    return m;
  };
  var canTrigger = function () {
    var p = P(); if (!p || hunt || p.dead) return false;
    if ((Number(p.lv) || 0) < LV_MIN) return false;
    if (!royals(false).length) return false;
    if (Date.now() < (Number(p.afkKurtCd) || 0)) return false;
    try { if (W.__afkWorldEvents && W.__afkWorldEvents.active()) return false; if (p.afkWe && Date.now() < (Number(p.afkWe.gap) || 0)) return false; } catch (e) {}   // 世界事件同時只有一個；任何事件結束後全部等 10 分鐘（afk-world-events）
    if (catching()) return false;
    return okMap(mapState.current);
  };

  // ── 出怪：判定觸發 ──
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      var r = oSpawn.apply(this, arguments);
      try {
        var m = mapState.mobs && mapState.mobs[idx];
        if (m && !m.boss && !m._afkKurt && canTrigger() && Math.random() < RATE) { start(idx); try { if (!S().ff) renderMobs(); } catch (e) {} }
      } catch (e) { console.warn('[AFK-kurt-hunt] spawn', e); }
      return r;
    };
  }

  // ── 每 tick：追殺計時、跨圖追蹤、技能 ──
  var hurt = function (t, dmg) {
    var p = P(); if (!t || !(dmg > 0)) return;
    if (typeof W.__afkTrueCut === 'function') dmg = W.__afkTrueCut(t, dmg);
    if (t === p) { p.hp -= dmg; if (p.hp <= 0 && !p.dead) { try { killPlayer(); } catch (e) {} } }
    else { t.curHp -= dmg; if (t.curHp <= 0) { t.curHp = 0; t._downed = true; t._reviveCd = 150; } }
  };
  var nameOf = function (t) { var p = P(); return t === p ? '你' : (t._allyName || t.name || '王族傭兵'); };
  var summon = function (kurt, n) {
    var base = DB.mobs.b_knight; if (!base) return;
    var L = Math.max(10, (kurt._kurtL || kurt.lv || 30) - 10), got = 0;
    for (var i = 0; i < n; i++) {
      var ms = mapState.mobs, j = -1;
      for (var q = 0; q < ms.length; q++) if (!ms[q] || ms[q]._dead) { j = q; break; }
      if (j < 0) break;
      var b = scaleMob(base, L, base.lv || 16, 1); b.mobId = 'b_knight'; b.beh = '主動'; b._afkKurtMinion = true; b.exp = Math.round((base.exp || 0) * L / (base.lv || 16));
      place(j, b); got++;
    }
    if (got) clog('<span class="font-bold" style="color:#f87171">【黑騎士召集】</span>克特舉起長劍——' + got + ' 名黑騎士從陰影裡走了出來。');
  };
  var skills = function (kurt) {
    var t = tk(), hunting = kurt._afkKurt === 'hunt', ref = hunting ? hunt : kurt._kurtState || (kurt._kurtState = { summoned: 0 });
    if (W.__afkHalted && W.__afkHalted(kurt)) { if (hunting && hunt.markAt) hunt.markAt++; if (hunting && hunt.mark) hunt.mark.end++; return; }
    var frac = kurt.curHp / Math.max(1, kurt.hp);
    // 黑魔法鎧碎裂
    if (!kurt._armorBroken && frac <= 0.3) { kurt._armorBroken = true; clog('<span class="font-bold" style="color:#fbbf24">【賽尼斯的黑魔法鎧】</span>克特的白色鎧甲裂開了——黑魔法的光從裂縫裡洩了出來（魔法打得進去了，物理傷害 +20%）。', 'player'); }
    // 黑騎士召集
    while (ref.summoned < SUMMON_AT.length && frac <= SUMMON_AT[ref.summoned]) { ref.summoned++; summon(kurt, 2); }
    if (!hunting) return;
    // 斬首宣告
    if (hunt.mark && t >= hunt.mark.end) {
      var mk = hunt.mark; hunt.mark = null;
      if (mk.hp0 - kurt.curHp >= kurt.hp * 0.05) clog('<span class="font-bold" style="color:#86efac">【斬首宣告】</span>猛攻逼得克特收回了劍——斬首宣告被打斷！', 'player');
      else if (mk.tgt && (mk.tgt === P() ? !P().dead : !mk.tgt._downed)) {
        var dmg = Math.floor((mk.tgt.mhp || mk.tgt.hp || 1) * 0.25);
        clog('<span class="font-bold" style="color:#ef4444">【斬首宣告】</span>克特的劍落下——' + esc(nameOf(mk.tgt)) + ' 受到重創！');
        hurt(mk.tgt, dmg);
      }
    } else if (!hunt.mark && t >= hunt.markAt) {
      hunt.markAt = t + MARK_EVERY;
      var rs = royals(true);
      if (rs.length) { var tg = rs[0]; hunt.mark = { tgt: tg, end: t + MARK_DELAY, hp0: kurt.curHp }; clog('<span class="font-bold" style="color:#ef4444">【斬首宣告】</span>克特的劍指向 ' + esc(nameOf(tg)) + '：「亞丁王族的血——」（5 秒內打掉克特 5% HP 可以打斷）'); }
    }
  };
  var step = function () {
    var p = P(); if (!p || !hunt) return;
    if (!royals(true).length) { end('royal'); return; }
    var cur = mapState.current;
    if (!okMap(cur)) { badge(); return; }   // 城鎮、副本裡暫停
    hunt.left--;
    if (hunt.left <= 0) { end('time'); return; }
    var f = kurtOnField();
    if (f) { hunt.hpFrac = f[0].curHp / Math.max(1, f[0].hp); hunt.map = cur; skills(f[0]); }
    else if (hunt.map !== cur) {
      hunt.map = cur; hunt.wait = tk() + rint(200, 400);
      sys('<span style="color:#fca5a5">⚔ 遠處傳來馬蹄聲——克特正在追過來。</span>');
    } else if (hunt.wait && tk() >= hunt.wait) {
      var i = freeSlot();
      if (i >= 0) {
        hunt.wait = 0;
        var m = place(i, buildKurt(levelFor(cur)));
        m.curHp = Math.max(1, Math.round(m.hp * hunt.hpFrac)); hunt.L = m._kurtL;
        clog('<span class="font-bold" style="color:#ef4444">⚔ 克特追上來了！</span>');
        try { if (!S().ff) renderMobs(); } catch (e) {}
      }
    }
    if (tk() % 10 === 0) badge();
  };
  var stepNormal = function () {
    (mapState.mobs || []).forEach(function (m) { if (m && !m._dead && m.curHp > 0 && m.n === '克特' && !m._afkKurt) m._afkKurt = 'field'; if (m && m._afkKurt === 'field' && !m._dead && m.curHp > 0) skills(m); });
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var t0 = tk(), r = oTick.apply(this, arguments);
      if (tk() !== t0) { try { step(); stepNormal(); } catch (e) { console.warn('[AFK-kurt-hunt] tick', e); } }
      return r;
    };
  }

  // ── 王血追獵：70% 優先打王族 ──
  if (typeof W.enemyAttackChooseVictim === 'function') {
    var oChoose = W.enemyAttackChooseVictim;
    W.enemyAttackChooseVictim = function (mob, idx) {
      try {
        if (mob && mob._afkKurt && Math.random() < 0.7) {
          var p = P(), rs = royals(true);
          if (rs.length) {
            var t = rs[Math.floor(Math.random() * rs.length)];
            try { if (typeof playMobAttack === 'function') playMobAttack(mob); } catch (e) {}
            if (t === p) { enemyPhysicalAttack(mob, idx, 0, null, null, true); return; }
            enemyAttackAlly(mob, t, true); return;
          }
        }
      } catch (e) {}
      return oChoose.apply(this, arguments);
    };
  }
  // 對王族傷害 +30%；紅獅王的守護 −30%
  (W.__afkTakenMods = W.__afkTakenMods || []).push(function (ent, mob) {
    if (!mob || !mob._afkKurt || !ent) return 1;
    var m = ent.cls === 'royal' ? TUNE.royalMult : 1, p = P();
    if (p && Date.now() < (Number(p.afkKurtGuardUntil) || 0)) m *= 0.7;
    return m;
  });
  // 賽尼斯的黑魔法鎧
  var hooked = false;
  var hookDmg = function () {
    var C = W.AFK_CARD_COMBAT; if (hooked || !C || typeof C.damage !== 'function') return; hooked = true;
    var o = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var v = o.apply(this, arguments);
      try {
        if (v > 0 && target && target._afkKurt) {
          var kind = opt && opt.kind;
          if (!target._armorBroken) { if (kind === 'magic') v = Math.floor(v * 0.6); }
          else if (kind === 'melee' || kind === 'ranged') v = Math.floor(v * 1.2);
        }
      } catch (e) {}
      return v;
    };
  };
  hookDmg(); W.addEventListener('load', hookDmg);

  // ── 擊殺：獎勵 ──
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState.mobs ? mapState.mobs[idx] : null;
      var r = oKill.apply(this, arguments);
      try {
        if (m && m._dead && m._afkKurt === 'hunt' && !m._kurtPaid) {
          m._kurtPaid = true;
          var L = m._kurtL || 30, got = [];
          gainItem(ORDER, 1, true, true); got.push(DB.items[ORDER].n);
          var br = L < 40 ? 0.10 : L < 80 ? 0.25 : 0.5;
          if (DB.items[BOX] && Math.random() < br) { gainItem(BOX, 1, true, true); got.push(DB.items[BOX].n); }
          GEAR.forEach(function (id) { if (DB.items[id] && Math.random() < 0.02) { gainItem(id, 1, true, true); got.push(DB.items[id].n); } });
          sys('<span class="text-amber-300">克特留下了：' + got.join('、') + '</span>');
          end('kill');
        }
      } catch (e) { console.warn('[AFK-kurt-hunt] kill', e); }
      return r;
    };
  }

  // ── 紅獅王的守護（使用） ──
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (uid) {
      var p = P(), it = p && (p.inv || []).find(function (x) { return x && x.uid === uid; });
      if (it && it.id === SCROLL && !it.lock) {
        if ((Number(it.cnt) || 1) > 1) it.cnt = (Number(it.cnt) || 1) - 1; else p.inv.splice(p.inv.indexOf(it), 1);
        p.afkKurtGuardUntil = Date.now() + 30 * 60 * 1000;
        sys('<span class="text-amber-300 font-bold">紅獅紋章亮了起來——30 分鐘內，全隊受到克特的傷害 −30%。</span>');
        try { renderTabs(); updateUI(); saveGame(); } catch (e) {}
        try { if (typeof closeModal === 'function') closeModal(); } catch (e) {}
        return;
      }
      return oUse.apply(this, arguments);
    };
  }

  // ── 甘特：追殺令兌換 ──
  var cnt = function (id) { var p = P(); return p ? (p.inv || []).filter(function (x) { return x && x.id === id && !x.lock; }).reduce(function (n, x) { return n + (Number(x.cnt) || 1); }, 0) : 0; };
  var take = function (id, n) { var p = P(); (p.inv || []).filter(function (x) { return x && x.id === id && !x.lock; }).forEach(function (x) { if (n <= 0) return; var c = Number(x.cnt) || 1, q = Math.min(c, n); n -= q; if (c - q > 0) x.cnt = c - q; else p.inv.splice(p.inv.indexOf(x), 1); }); };
  var EXCH = { scroll: [10, SCROLL], helm: [50, HELM] };
  var exchange = function (k) {
    var x = EXCH[k]; if (!x) return '不能兌換。';
    if (cnt(ORDER) < x[0]) return '需要黑騎士團的追殺令 ' + x[0] + ' 張（目前 ' + cnt(ORDER) + ' 張）。';
    take(ORDER, x[0]); gainItem(x[1], 1, true, true);
    sys('<span class="text-amber-300">甘特收下了 ' + x[0] + ' 張追殺令，交給你「' + DB.items[x[1]].n + '」。</span>');
    try { renderTabs(); saveGame(); } catch (e) {}
    return null;
  };
  var gunterHtml = function () {
    var n = cnt(ORDER), st = stats(), p = P();
    var cd = p ? Math.max(0, (Number(p.afkKurtCd) || 0) - Date.now()) : 0;
    return '<div id="afk-kurt-gunter" class="mt-3 p-2 rounded border border-red-900 bg-slate-900/60 text-sm">'
      + '<div class="font-bold text-red-300">⚔ 克特的追殺令</div>'
      + '<div class="text-slate-300 text-xs mt-1">「克特那傢伙還在追殺王族的血脈……把他身上的追殺令帶回來，我替你換點東西。」</div>'
      + '<div class="text-xs text-slate-400 mt-1">持有追殺令 ' + n + ' 張｜遇到 ' + (st.met || 0) + ' 次、打倒 ' + (st.kills || 0) + ' 次、王族倒下 ' + (st.fails || 0) + ' 次'
      + (hunt ? '｜<span class="text-red-300">追殺中</span>' : cd ? '｜冷卻還有 ' + Math.ceil(cd / 60000) + ' 分鐘' : '') + '</div>'
      + '<div class="flex gap-2 mt-2"><button type="button" class="btn flex-1 text-xs" data-kurt="scroll"' + (n >= 10 ? '' : ' disabled') + '>10 張 → 紅獅王的守護</button>'
      + '<button type="button" class="btn flex-1 text-xs" data-kurt="helm"' + (n >= 50 ? '' : ' disabled') + '>50 張 → 克特的牛角頭盔</button></div></div>';
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try {
        if (npcId === 'npc_gunter') {
          var div = document.getElementById('interaction-content'); if (!div) return r;
          var old = div.querySelector('#afk-kurt-gunter'); if (old) old.remove();
          var box = document.createElement('div'); box.innerHTML = gunterHtml(); div.appendChild(box.firstChild);
          if (!div.__afkKurtBound) {
            div.__afkKurtBound = true;
            div.addEventListener('click', function (ev) {
              var b = ev.target.closest('#afk-kurt-gunter [data-kurt]'); if (!b || b.disabled) return;
              var err = exchange(b.getAttribute('data-kurt')); if (err) sys('<span class="text-red-400">' + esc(err) + '</span>');
              var cur = div.querySelector('#afk-kurt-gunter'); if (cur) { var nb = document.createElement('div'); nb.innerHTML = gunterHtml(); cur.replaceWith(nb.firstChild); }
            });
          }
        }
      } catch (e) { console.warn('[AFK-kurt-hunt] gunter', e); }
      return r;
    };
  }

  W.__afkKurtHunt = { RATE: RATE, CD_MS: CD_MS, DUR: DUR, LV_MIN: LV_MIN, okMap: okMap, levelFor: levelFor, mapLv: mapLv, buildKurt: buildKurt, royals: royals,
    hunt: function () { return hunt; }, start: start, end: end, canTrigger: canTrigger, exchange: exchange, step: step, stats: stats, ORDER: ORDER, SCROLL: SCROLL, HELM: HELM };
})();
