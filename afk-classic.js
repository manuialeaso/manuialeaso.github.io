/* ============================================================================
 * afk-classic.js — 經典模式補正：體驗最初的天堂（玩家 2026-10-26 指定）
 *
 * 只對「經典模式」角色生效（player.classicMode）。
 * 一、256K 撥接上網：在狩獵地圖每 60 秒擲 3 次骰，各 5%：
 *     斷線　　：角色與怪物全部停止 10 秒，沒有任何傷害
 *     LAG　　 ：角色 10 秒不能動（不能攻擊、施法、喝水），怪物照打
 *     怪中BUG ：畫面上隨機一隻怪 10 秒無敵（打不掉血、打不死）
 * 二、不死系：所有頭目都算不死系；起死回生術可以殺死任何不死系（頭目也算）
 * 三、古魯丁地監 1～7 樓：只能從 1 樓一路往上打（2～7 樓不能直接選）
 *     每次出怪 5% 出「往上的階梯」（打掉就上樓）、5% 出首領；階梯與首領同時只會有一個
 *     打到 7 樓後回村：古魯丁村莊出現 NPC「歐林」，賣一張對武器施法的卷軸、一張對盔甲施法的卷軸；一出發狩獵歐林就消失
 * 四、只有黑暗妖精之前的版本：經典模式只能創王族、騎士、妖精、法師；其餘職業封印
 * 五～六、影子打法／歐林房定怪／無敵狗／開服夜爆機
 * 七、時代：第一部（等級上限 50、只開放當時的地圖）；席琳神殿「席琳的女祭司」選黑妖三部曲
 *     光與影（黑暗妖精）→ 天與地（拉斯塔巴德入侵、古代物品商人）→ 生與死（拉斯塔巴德正門等）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.mobs || !DB.maps) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var on = function () { var p = P(); return !!(p && p.classicMode); };
  // 256K 撥接那一類 BUG 只在第一部；進入黑妖三部曲之後網路穩定了，全部關閉
  var bugsOn = function () { return on() && era() === 0; };
  var sys = function (h) { try { if (typeof logSys === 'function' && !S().ff) logSys(h); } catch (e) {} };
  var hunting = function () { try { var c = mapState && mapState.current; return !!c && String(c).indexOf('town_') !== 0; } catch (e) { return false; } };

  // ── 一、256K 撥接 ──
  var NET = { every: 600, rate: 0.05, dur: 100 };
  var net = { dc: 0, lagUntil: 0, lastRoll: null, shadowUntil: 0, orinUntil: 0, dogUid: null, dogUntil: 0 };
  var banner = function (txt) {
    var el = document.getElementById('afk-classic-net');
    if (!txt) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'afk-classic-net'; el.style.cssText = 'position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:9800;padding:10px 18px;border:1px solid #64748b;border-radius:6px;background:rgba(15,23,42,.92);color:#e2e8f0;font-size:15px;font-weight:700;pointer-events:none;text-shadow:0 1px 2px #000'; document.body.appendChild(el); }
    el.textContent = txt;
  };
  var lagging = function () { return bugsOn() && tk() < net.lagUntil; };
  var bugged = function (m) { return !!(m && m._afkBugUntil && tk() < m._afkBugUntil); };
  var rollNet = function () {
    var t = tk(); if (net.lastRoll == null) net.lastRoll = t;
    if (t - net.lastRoll < NET.every) return;
    net.lastRoll = t;
    if (Math.random() < NET.rate) {
      if (Math.random() < 0.5) { net.shadowUntil = t + NET.dur; sys('<span class="text-sky-300 font-bold">👤 影子打法！</span>撥接斷線、怪物還在打你留在原地的影子——10 秒內怪物打不到你，你照樣能攻擊。'); }
      else { net.dc = NET.dur; sys('<span class="text-slate-300 font-bold">📞 嘟——嘟——撥接斷線了……</span>角色與怪物全部停止 10 秒。'); }
    }
    if (Math.random() < NET.rate) { net.lagUntil = t + NET.dur; sys('<span class="text-amber-300 font-bold">🐢 LAG 了！</span>角色 10 秒動不了（不能攻擊、施法、喝水），怪物照打。'); }
    if (Math.random() < NET.rate) {
      var alive = (mapState.mobs || []).filter(function (m) { return m && !m._dead && m.curHp > 0; });
      if (alive.length) { var m = alive[Math.floor(Math.random() * alive.length)]; m._afkBugUntil = t + NET.dur; m._afkBugHp = m.curHp; sys('<span class="text-fuchsia-300 font-bold">🐛 怪中 BUG！</span>' + m.n + ' 卡在牆裡，10 秒內打不掉血。'); }
    }
    if (Math.random() < NET.rate) rollDog(t);   // 無敵狗
    if (floorOf(mapState.current) >= 0 && Math.random() < NET.rate) { net.orinUntil = t + NET.dur; sys('<span class="text-yellow-300 font-bold">🚪 歐林房定怪！</span>把怪引進房間，牠們卡在門口發呆——10 秒內怪物打不到你。'); }
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () {
      var c = bugsOn() && hunting() && P() && !P().dead;
      if (c && net.dc > 0) {   // 斷線：整個戰場停住（不跑這一 tick）
        net.dc--; banner((net.crash ? '💥 開服夜爆機！19 台伺服器 × 4,000 人擠爆了……排隊重連中（' : '📞 連線中斷……重新連線中（') + Math.ceil(net.dc / 10) + ' 秒）');
        if (net.dc <= 0 && net.crash) { net.crash = false; banner(null); sys('<span class="text-emerald-300">伺服器重開完成，終於連上了。歡迎來到天堂。</span>'); return; }
        if (net.dc <= 0) { banner(null); sys('<span class="text-emerald-300">重新連線成功。</span>'); }
        return;
      }
      var snap = [];
      if (c) (mapState.mobs || []).forEach(function (m) { if (bugged(m)) snap.push([m, m.curHp]); });
      var r = oTick.apply(this, arguments);
      try {
        snap.forEach(function (x) { if (x[0].curHp < x[1]) x[0].curHp = x[1]; });
        if (c) { launchNight(); rollNet(); var t2 = tk(); banner(lagging() ? '🐢 LAG……（' + Math.ceil((net.lagUntil - t2) / 10) + ' 秒）' : (t2 < net.shadowUntil ? '👤 影子打法中（' + Math.ceil((net.shadowUntil - t2) / 10) + ' 秒）' : (t2 < net.orinUntil ? '🚪 歐林房定怪中（' + Math.ceil((net.orinUntil - t2) / 10) + ' 秒）' : null))); }
        else if (net.dc <= 0) banner(null);
      } catch (e) {}
      return r;
    };
  }
  // LAG：擋玩家的攻擊、施法、喝水
  ['playerAttack', 'castSkill'].forEach(function (fn) {
    var o = W[fn]; if (typeof o !== 'function') return;
    W[fn] = function () { if (lagging()) return false; return o.apply(this, arguments); };
  });
  if (typeof W.useItem === 'function') {
    var oUse = W.useItem;
    W.useItem = function (u) {
      if (lagging()) { var p = P(), it = p && (p.inv || []).find(function (i) { return i.uid === u; }), d = it && DB.items[it.id]; if (d && (d.type === 'pot' || d.type === 'potion' || /potion/.test(it.id))) return false; }
      return oUse.apply(this, arguments);
    };
  }
  // 怪中 BUG：打不死
  if (typeof W.killMob === 'function') {
    var oKill = W.killMob;
    W.killMob = function (idx) {
      var m = mapState && mapState.mobs ? mapState.mobs[idx] : null;
      if (bugsOn() && m && !m._dead && bugged(m)) { m.curHp = Math.max(1, m._afkBugHp || 1); return; }
      return oKill.apply(this, arguments);
    };
  }

  // ── 二、不死系：頭目都算不死系；起死回生術可殺頭目 ──
  if (typeof W.mobHasTag === 'function') {
    var oTag = W.mobHasTag;
    W.mobHasTag = function (m, tag) { if (tag === 'undead' && on() && m && m.boss) return true; return oTag.apply(this, arguments); };
  }
  if (typeof W.tryInstakill === 'function') {
    var oIK = W.tryInstakill;
    W.tryInstakill = function (m, ik, skillName, idx, deferKill) {
      if (!(on() && m && m.boss && ik && ik.tag === 'undead')) return oIK.apply(this, arguments);
      if (typeof ik.p === 'number') { if (Math.random() >= ik.p) return false; }
      else if (typeof abnormalMagicHit === 'function' && !abnormalMagicHit(m, ik.cap)) return false;
      try { logCombat(skillName + ' 使 <span class="' + getMobColor(m.lv) + '">' + m.n + '</span> 化為塵土！（不死系頭目）', 'player-special'); } catch (e) {}
      m.curHp = 0;
      if (!deferKill) killMob(idx);
      return true;
    };
  }

  // ── 三、古魯丁地監 1～7 樓 ──
  var FLOORS = ['zone_06', 'zone_07', 'zone_08', 'zone_09', 'zone_10', 'zone_11', 'zone_12'];
  var STAIRS = 'afk_gd_stairs';
  if (!DB.mobs[STAIRS]) {
    var st0 = DB.mobs.pride_stairs ? JSON.parse(JSON.stringify(DB.mobs.pride_stairs)) : { lv: 1, s: 'L', beh: '被動', race: '建築', boss: true, noAutoTeleport: true, e: 'none', hp: 1, ac: 10, mr: 0, exp: 0, goldMin: 0, goldMax: 0, atkSpd: 60, dmg: [1, 1], db: 0, hit: 0 };
    st0.n = '往上的階梯'; st0.afkGdStairs = true; st0.boss = false; st0.noAutoTeleport = true; st0.race = '建築';
    DB.mobs[STAIRS] = st0;
    try { if (typeof MOB_ANIM_ALIAS !== 'undefined' && !MOB_ANIM_ALIAS['往上的階梯']) MOB_ANIM_ALIAS['往上的階梯'] = '往上層的樓梯'; } catch (e) {}
  }
  var floorOf = function (map) { return FLOORS.indexOf(map); };
  var climbing = false;
  if (typeof W.mapOptDisabled === 'function') {
    var oDis = W.mapOptDisabled;
    W.mapOptDisabled = function (m) {
      if (m && on() && !climbing) { var f = floorOf(m.v); if (f >= 1 && !(mapState && mapState.current === m.v)) return true; }   // 2～7 樓只能爬上去
      return oDis.apply(this, arguments);
    };
  }
  var special = function () { return (mapState.mobs || []).some(function (m) { return m && !m._dead && m.curHp > 0 && (m.boss || m.afkGdStairs); }); };
  var mkMob = function (id) { var b = DB.mobs[id]; return Object.assign({}, b, { curHp: b.hp, uid: uid(), _born: ++_mobBornSeq, _bornMs: Date.now(), _magCd: {}, justHit: false, st: newMobStatus() }); };
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function (idx) {
      var f = on() && mapState ? floorOf(mapState.current) : -1;
      if (f < 0) return oSpawn.apply(this, arguments);
      var pool = DB.maps[mapState.current] || [], bosses = pool.filter(function (id) { return DB.mobs[id] && DB.mobs[id].boss; }), normal = pool.filter(function (id) { return DB.mobs[id] && !DB.mobs[id].boss; });
      var r = Math.random(), want = special() ? null : (r < 0.05 && f < FLOORS.length - 1 ? 'stairs' : (r < 0.10 && bosses.length ? 'boss' : null));
      if (want === 'stairs') { mapState.mobs[idx] = mkMob(STAIRS); try { if (!S().ff) renderMobs(); } catch (e) {} return; }
      if (want === 'boss') { mapState.forceBoss = true; return oSpawn.apply(this, arguments); }
      mapState.forceBoss = false;
      var res = oSpawn.apply(this, arguments);
      var m = mapState.mobs[idx];
      if (m && m.boss && normal.length) {   // 不是這次的 5%：原本機率生出來的首領改成一般怪
        mapState.mobs[idx] = mkMob(normal[Math.floor(Math.random() * normal.length)]);
        try { if (typeof applySherineBuff === 'function') applySherineBuff(idx); } catch (e) {}
        try { if (!S().ff) renderMobs(); } catch (e) {}
      }
      return res;
    };
  }
  var goFloor = function (f) {
    climbing = true;
    try { setMapSelectors(FLOORS[f]); changeMap(true); } finally { climbing = false; }
  };
  if (typeof W.killMob === 'function') {
    var oKill2 = W.killMob;
    W.killMob = function (idx) {
      var m = mapState && mapState.mobs ? mapState.mobs[idx] : null;
      if (m && m.afkGdStairs && !m._dead) {
        var f = floorOf(mapState.current);
        m._dead = true; m.curHp = 0; mapState.mobs[idx] = null;
        if (f >= 0 && f < FLOORS.length - 1) {
          sys('<span class="text-amber-300 font-bold">你找到了往上的階梯，前往古魯丁地監 ' + (f + 2) + ' 樓。</span>');
          setTimeout(function () { try { if (mapState.current === FLOORS[f]) goFloor(f + 1); } catch (e) {} }, 300);
        }
        return;
      }
      return oKill2.apply(this, arguments);
    };
  }

  // 7 樓 → 回村：古魯丁村莊出現歐林；出發狩獵就消失
  var ORIN = 'npc_afk_classic_orin', SHOP = { scroll_weapon: 1, scroll_armor: 1 };
  var orinOn = function () { var p = P(); return !!(p && p._afkOrin); };
  var syncOrin = function () {
    try {
      var town = DB.towns.town_gludin; if (!town) return;
      var has = town.npcs.some(function (n) { return n.id === ORIN; });
      if (orinOn() && !has) town.npcs.push({ id: ORIN, n: '歐林', title: '神秘商人', type: 'craft', d: '剛從古魯丁地監深處回來的冒險者才遇得到的商人。他壓低聲音說：「別聲張，這兩張卷軸是我從 7 樓帶出來的。」' });
      if (!orinOn() && has) town.npcs = town.npcs.filter(function (n) { return n.id !== ORIN; });
    } catch (e) {}
  };
  try { if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[ORIN]) NPC_SPR_FIXED[ORIN] = '1254'; } catch (e) {}
  if (typeof W.changeMap === 'function') {
    var oChange = W.changeMap;
    W.changeMap = function () {
      var from = mapState && mapState.current;
      try {
        var sel = document.getElementById('map-select'), tgt = sel && sel.value;
        if (on() && from && tgt !== from && (!tgt || sealedMap(tgt))) {   // 這個時代還沒有的地方（含 NPC 直接傳送）
          if (typeof syncMapSelectors === 'function') syncMapSelectors();
          sys('<span class="text-red-400">經典世界的這個時代還沒有那個地方。</span>');
          return false;
        }
      } catch (e) {}
      var r = oChange.apply(this, arguments);
      try {
        var p = P(), to = mapState && mapState.current;
        if (p && on() && to !== from) {
          if (to === 'zone_12') p._afkGd7 = true;
          if (to && String(to).indexOf('town_') === 0) {
            if (p._afkGd7) { p._afkGd7 = false; p._afkOrin = { scroll_weapon: 1, scroll_armor: 1 }; sys('<span class="text-yellow-300">從古魯丁地監 7 樓平安歸來——聽說古魯丁村莊來了一位叫「歐林」的商人。</span>'); }
          } else if (p._afkOrin) { p._afkOrin = null; sys('<span class="text-slate-400">你出發了，古魯丁村莊的歐林也不見了蹤影。</span>'); }
        }
      } catch (e) {}
      syncOrin(); syncAncient();
      return r;
    };
  }
  var renderOrin = function (div) {
    var p = P(), st = (p && p._afkOrin) || {};
    var row = function (id) {
      var d = DB.items[id] || {}, left = st[id] || 0, price = Math.max(1, Number(d.p) || 0);
      return '<div class="flex items-center justify-between gap-2"><span>' + (d.n || id) + '（剩 ' + left + ' 張・' + price.toLocaleString() + ' 金幣）</span><button type="button" class="btn" data-orin="' + id + '"' + (left > 0 ? '' : ' disabled') + '>購買</button></div>';
    };
    div.innerHTML = '<div class="text-sm space-y-2"><div class="text-slate-300">「別聲張，這兩張卷軸是我從 7 樓帶出來的。你一出發，我就得走了。」</div>' + Object.keys(SHOP).map(row).join('') + '</div>';
    div.onclick = function (e) {
      var b = e.target.closest('[data-orin]'); if (!b || b.disabled || !p || !p._afkOrin) return;
      var id = b.getAttribute('data-orin'), d = DB.items[id] || {}, price = Math.max(1, Number(d.p) || 0);
      if ((p._afkOrin[id] || 0) < 1) return;
      if ((p.gold || 0) < price) { sys('<span class="text-red-400">金幣不足。</span>'); return; }
      p.gold -= price; p._afkOrin[id]--; gainItem(id, 1, true);
      sys('<span class="text-amber-200">向歐林買了一張' + d.n + '。</span>');
      try { updateUI(); renderTabs(true); saveGame(); } catch (e2) {}
      renderOrin(div);
    };
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try { var div = document.getElementById('interaction-content'); if (div && npcId === ORIN) renderOrin(div); if (div && npcId === 'npc_afk_trilogy') renderTrilogy(div); if (div && npcId === ANC) renderAncient(div);  } catch (e) {}
      return r;
    };
  }
  if (typeof W.loadGame === 'function') { var oLoad = W.loadGame; W.loadGame = function () { var r = oLoad.apply(this, arguments); try { if (pendingConvert) { var _tri = pendingConvert === 2; pendingConvert = false; convertToClassic(_tri); } syncProxy(); syncOrin(); syncAncient(); migrateAll(); sealAll(P()); } catch (e) {} return r; }; }

  // ── 四、只有黑暗妖精之前的版本：職業封印 ──
  var OPEN = { royal: 1, knight: 1, elf: 1, mage: 1 };
  var openCls = function (c) { return !!OPEN[c] || (c === 'dark' && trilogyUnlocked()); };
  var SEAL_ALL = ['dark', 'illusionist', 'Dknight', 'warrior'];
  var sealBtns = function () { return SEAL_ALL.filter(function (k) { return !(k === 'dark' && trilogyUnlocked()); }); };
  var classicChecked = function () { var el = document.getElementById('create-classic-toggle'); return !!(el && el.checked); };
  var paintSeal = function () {
    var c = classicChecked();
    SEAL_ALL.forEach(function (k) { var b = document.getElementById('btn-class-base-' + k); if (!b) return; if (sealBtns().indexOf(k) < 0) { b.style.opacity = ''; b.style.filter = ''; b.title = b.getAttribute('data-afk-title') || b.title; return; } b.style.opacity = c ? '.3' : ''; b.style.filter = c ? 'grayscale(1)' : ''; b.title = c ? '經典模式：黑暗妖精之後的職業尚未登場（封印）' : (b.getAttribute('data-afk-title') || b.title); });
  };
  try { SEAL_ALL.forEach(function (k) { var b = document.getElementById('btn-class-base-' + k); if (b) b.setAttribute('data-afk-title', b.title); }); } catch (e) {}
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'create-classic-toggle') { paintSeal(); if (classicChecked() && typeof curCreate !== 'undefined' && curCreate.cls && !openCls(curCreate.cls) && typeof selectClass === 'function') selectClass('m_royal'); } });
  if (typeof W.selectClassBase === 'function') {
    var oSel = W.selectClassBase;
    W.selectClassBase = function (base) { if (classicChecked() && sealBtns().indexOf(base) >= 0) { alert(trilogyUnlocked() ? '經典模式只有王族、騎士、妖精、法師、黑暗妖精。' : '經典模式一開始是序章，只有王族、騎士、妖精、法師。要有經典角色在席琳神殿進入黑妖三部曲，才能創黑暗妖精。'); return; } return oSel.apply(this, arguments); };
  }
  if (typeof W.startGame === 'function') {
    var oStart = W.startGame;
    W.startGame = function () { if (classicChecked() && typeof curCreate !== 'undefined' && curCreate.cls && !openCls(curCreate.cls)) { alert('經典模式目前的時代不能創這個職業。'); return; } var r = oStart.apply(this, arguments); try { syncProxy(); } catch (e) {} return r; };
  }
  if (typeof W.showCreation === 'function') { var oShow = W.showCreation; W.showCreation = function () { var r = oShow.apply(this, arguments); paintSeal(); return r; }; }


  // ── 五、開服夜爆機：經典角色第一次出門狩獵，伺服器直接爆掉 30 秒 ──
  var launchNight = function () {
    var p = P(); if (!p || p._afkLaunched) return;
    p._afkLaunched = true; net.dc = 300; net.crash = true;
    sys('<span class="text-red-300 font-bold">💥 開服當晚，伺服器爆了！</span>19 台伺服器、每台 4,000 人同時湧入——排隊重連 30 秒。');
  };

  // ── 六、無敵狗：一直下「停留」把寵物卡住，10 秒不會死（沒有寵物就換一位傭兵）──
  var rollDog = function (t) {
    var pets = [];
    try { if (typeof petsOutList === 'function') pets = petsOutList().filter(function (x) { return x && (x.hp || 0) > 0; }); } catch (e) {}
    if (pets.length) { var d = pets[Math.floor(Math.random() * pets.length)]; net.dogUid = 'pet:' + d.uid; net.dogUntil = t + NET.dur; sys('<span class="text-orange-300 font-bold">🐕 無敵狗！</span>你一直對 ' + (d.name || d.form) + ' 下「停留」，牠卡住了——10 秒內不會受傷。'); return; }
    var al = ((P() && P().allies) || []).filter(function (a) { return a && (a.curHp || 0) > 0; });
    if (al.length) { var a = al[Math.floor(Math.random() * al.length)]; net.dogUid = 'ally:' + (a._allyName || a.n || ''); net.dogUntil = t + NET.dur; sys('<span class="text-orange-300 font-bold">🐕 無敵狗！</span>' + (a._allyName || '傭兵') + ' 被你卡在原地——10 秒內不會受傷。'); }
  };
  var dogOn = function (key) { return bugsOn() && net.dogUid === key && tk() < net.dogUntil; };
  if (typeof W.petDevotionGuardOn === 'function') {
    var oGuard = W.petDevotionGuardOn;
    W.petDevotionGuardOn = function (pt) { if (pt && dogOn('pet:' + pt.uid)) return true; return oGuard.apply(this, arguments); };
  }
  var mobsIdle = function () { var t = tk(); return bugsOn() && hunting() && (t < net.shadowUntil || t < net.orinUntil); };
  var oTaken = W.__afkTaken;
  W.__afkTaken = function (ent, dmg) {
    var v = typeof oTaken === 'function' ? oTaken.apply(this, arguments) : dmg;
    try {
      if (on() && ent) {
        var p = P(), isAlly = ent !== p && !!ent._allyName;
        if ((ent === p || isAlly) && mobsIdle()) return 0;
        if (isAlly && dogOn('ally:' + ent._allyName)) return 0;
      }
    } catch (e) {}
    return v;
  };

  // ── 七、時代：序章（1998～2003）／黑妖三部曲（光與影＋天與地＋生與死，2003～2004 韓版）──
  // 每個角色自己的時代：一開始都是序章；在席琳神殿問「席琳的女祭司」要不要進入黑妖三部曲（單行道）。
  // 只要有一個經典角色進入過三部曲，帳號就能創黑暗妖精；黑暗妖精一出生就在三部曲。
  var TRI_KEY = 'afk_classic_trilogy';
  try { var _old = Number(localStorage.getItem('afk_classic_era')); if (_old >= 1) localStorage.setItem(TRI_KEY, '1'); localStorage.removeItem('afk_classic_era'); } catch (e) {}
  var trilogyUnlocked = function () { try { return localStorage.getItem(TRI_KEY) === '1'; } catch (e) { return false; } };
  var era = function (p) { p = p || P(); return (p && (p.cls === 'dark' || p._afkEra >= 1)) ? 1 : 0; };
  var setEra = function (n, p) { p = p || P(); if (!p) return; p._afkEra = n >= 1 ? 1 : 0; if (n >= 1) { try { localStorage.setItem(TRI_KEY, '1'); } catch (e) {} } };
  var CHAPTERS = [
    { n: '光與影（빛과 그림자）', kr: '2003-08-06', tw: '2003-11', d: '黑暗妖精登場；故鄉沉默洞穴；夢幻之島；傲慢之塔 11～50 樓；鋼爪爆擊、雙刀雙擊' },
    { n: '天與地（하늘과 땅）', kr: '2004-05-27', tw: '2004-07', d: '拉斯塔巴德從地道入侵古魯丁周邊；地下洞穴 1～3 樓；古代物品商人；傲慢之塔到 100 樓' },
    { n: '生與死（생과 사）', kr: '2004-12-16', tw: '2005-02', d: '人類反攻：拉斯塔巴德正門、歐姆的大洞穴、魔獸訓練場、黑魔法研究室、古代巨人之墓、魔獸君王之室；法師高階魔法開放' }
  ];
  var ERAS = [
    { key: 'part1', n: '序章', kr: '1998～2003', tw: '2000～2003', lvCap: 50, maps: [],
      d: '說話之島到亞丁的 12 個章節（傲慢之塔 1～10 樓）；王族、騎士、妖精、法師四個職業；256K 撥接的各種 BUG。' },
    { key: 'trilogy', n: '黑妖三部曲', kr: '2003～2004', tw: '2003-11～2005-02', lvCap: 80,
      maps: ['town_silent', 'silent_outer', 'dream_island', 'pride_11_20', 'pride_21_30', 'pride_31_40', 'pride_41_50',
        'rastabad_cave1', 'rastabad_cave2', 'rastabad_cave3', 'pride_51_60', 'pride_61_70', 'pride_71_80', 'pride_81_90', 'pride_91_100',
        'rastabad_gate', 'hidden_cave', 'rastabad_beast', 'dark_magic_lab', 'giant_tomb', 'king_baranka_room'],
      d: CHAPTERS.map(function (c) { return c.n + '：' + c.d; }).join('。') + '。撥接那一類 BUG 全部消失。' }
  ];
  var eraDef = function (n) { return ERAS[n == null ? era() : n] || { lvCap: 50, maps: [] }; };

  // 等級上限：序章 50；已經超過的舊角色維持現有等級（不倒扣）
  var oCap = W.__afkLvCap;
  W.__afkLvCap = function (p) {
    var base = typeof oCap === 'function' ? oCap(p) : 100;
    var cp = P();
    if (!(cp && cp.classicMode) || !p) return base;
    var cap = eraDef().lvCap || 50;
    if ((p.lv || 1) > cap && !(p._afkGrandLv >= p.lv)) p._afkGrandLv = p.lv;   // 補丁上線前就超過上限的角色：鎖在目前等級
    return Math.min(base, Math.max(cap, p._afkGrandLv || 0));
  };

  // 地圖：只開放當時已經存在的地方
  var PART1 = ('town_silver_knight silver_knight training town_elf zone_01 zone_15 zone_16 zone_17 town_talking talking_island_port talking_island zone_13 zone_14 ' +
    'town_gludio elf_forest town_gludin gludio zone_06 zone_07 zone_08 zone_09 zone_10 zone_11 zone_12 kent ' +
    'windwood desert zone_22 zone_23 zone_24 zone_25 zone_32 zone_33 town_heine heine mirror_forest zone_34 zone_35 zone_36 eva_kingdom fafurion_lair ' +
    'town_giran giran zone_18 zone_19 zone_20 zone_21 dragon_valley zone_26 zone_27 zone_28 zone_29 zone_30 zone_31 antaras_lair ' +
    'town_witon fire_dragon valakas_lair town_oren zone_02 zone_03 zone_04 zone_05 town_ivory_tower zone_37 zone_38 zone_39 zone_40 zone_41 crystal_cave1 crystal_cave2 crystal_cave3 ' +
    'town_aden twilight_mt town_pride pride_2_10 town_sherine').split(' ');   // 傲慢之塔 1～10 樓：韓版 2003 年初第 12 章「亞丁」、台版 2003/04「亞丁王國」就開了
  var allowedSet = function () { var o = {}; PART1.forEach(function (k) { o[k] = 1; }); if (era() >= 1) (eraDef(1).maps || []).forEach(function (k) { o[k] = 1; }); return o; };
  var regionKeys = null;
  var staticMaps = function () { if (regionKeys) return regionKeys; regionKeys = {}; try { MAP_REGIONS.forEach(function (r) { r.maps.forEach(function (m) { regionKeys[m.v] = 1; }); }); } catch (e) {} return regionKeys; };
  var sealedMap = function (v) { if (!on() || !v) return false; if (!staticMaps()[v]) return false; return !allowedSet()[v]; };   // 只管選單上的固定地圖；攻城動態地圖不受限
  if (typeof W.regionMapList === 'function') {
    var oRML = W.regionMapList;
    W.regionMapList = function () {
      var list = oRML.apply(this, arguments);
      if (!on()) return list;
      var cur = mapState && mapState.current;
      return list.filter(function (m) { return !sealedMap(m.v) || m.v === cur; }).map(function (m) { if (m.v === 'town_sherine' && m.classicHide) { m = Object.assign({}, m); delete m.classicHide; } return m; });
    };
  }
  if (typeof W.mapOptDisabled === 'function') {
    var oDis2 = W.mapOptDisabled;
    W.mapOptDisabled = function (m) {
      if (m && on()) {
        if (m.v === 'town_sherine') return false;   // 經典模式也能進席琳神殿（只有女祭司，選三部曲）
        if (sealedMap(m.v) && !(mapState && mapState.current === m.v)) return true;
      }
      return oDis2.apply(this, arguments);
    };
  }
  // 席琳神殿：經典模式只見「席琳的女祭司」（席琳與伊奧不出現）
  try {
    var ts = DB.towns.town_sherine;
    ts.npcs.forEach(function (n) { if (n.id !== 'npc_afk_trilogy') n.classicHide = true; });
    if (!ts.npcs.some(function (n) { return n.id === 'npc_afk_trilogy'; }))
      ts.npcs.push({ id: 'npc_afk_trilogy', n: '席琳的女祭司', title: '黑妖三部曲', type: 'craft', classicOnly: true, d: '來自未來時代、侍奉死亡女神 席琳的黑暗妖精祭司。她問：「要進入黑妖的三部曲嗎？」' });
    if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED.npc_afk_trilogy) NPC_SPR_FIXED.npc_afk_trilogy = NPC_SPR_FIXED.npc_sherine || '914';
  } catch (e) {}


  // 女祭司：要進入黑妖的三部曲嗎？（每個角色自己決定，進入後不能回到序章）
  var renderTrilogy = function (div) {
    var p = P(), cur = era(p);
    var chap = '<div class="text-xs space-y-1">' + CHAPTERS.map(function (c) { return '<div class="p-2 rounded border border-slate-600"><b>' + c.n + '</b><div class="text-slate-400">韓版 ' + c.kr + '・台版 ' + c.tw + '</div><div class="text-slate-300">' + c.d + '</div></div>'; }).join('') + '</div>';
    div.innerHTML = '<div class="text-sm space-y-2">' + (cur >= 1
      ? '<div class="text-amber-300">「你已經走在黑妖三部曲的時代裡了。」</div>' + chap
      : '<div class="text-slate-300">「要進入黑妖的三部曲嗎？光與影、天與地、生與死會一起到來——黑暗妖精、拉斯塔巴德、傲慢之塔到 100 樓、等級上限 80。<b class=\"text-red-300\">進去之後就回不到序章了。</b>」</div>' + chap +
        '<button type="button" class="btn w-full" data-tri="1">進入黑妖三部曲</button>') + '</div>';
    div.onclick = function (ev) {
      if (!ev.target.closest('[data-tri]') || era(p) >= 1) return;
      if (!confirm('要進入黑妖的三部曲嗎？\n進入後這個角色就回不到序章。')) return;
      setEra(1, p); regionKeys = null;
      net.dc = 0; net.crash = false; net.lagUntil = 0; net.shadowUntil = 0; net.orinUntil = 0; net.dogUntil = 0; banner(null);
      sys('<span class="text-violet-300 font-bold">🌘 你進入了黑妖三部曲的時代。</span>' + ERAS[1].d + '帳號從此可以創黑暗妖精。');
      try { syncAncient(); rebuildMapCategoryOptions(); setMapSelectors(mapState.current); calcStats(); saveGame(); } catch (e) {}
      renderTrilogy(div);
    };
  };

  // 天與地：拉斯塔巴德入侵古魯丁周邊（出怪 10% 換成拉斯塔巴德的部隊）
  if (typeof W.spawnMob === 'function') {
    var oSpawn2 = W.spawnMob;
    W.spawnMob = function (idx) {
      var r = oSpawn2.apply(this, arguments);
      try {
        if (on() && era() >= 1 && mapState.current === 'gludio' && Math.random() < 0.10) {
          var pool = (DB.maps.rastabad_cave1 || []).filter(function (id) { return DB.mobs[id] && !DB.mobs[id].boss; });
          var m0 = mapState.mobs[idx];
          if (pool.length && m0 && !m0.boss) {
            var m = mkMob(pool[Math.floor(Math.random() * pool.length)]); m._afkRasta = true; mapState.mobs[idx] = m;
            if (!S().ff) { sys('<span class="text-red-300">⚔️ 拉斯塔巴德的部隊從地道冒出來了：' + m.n + '</span>'); try { renderMobs(); } catch (e) {} }
          }
        }
      } catch (e) {}
      return r;
    };
  }

  // 天與地：古代物品商人（古魯丁、歐瑞、亞丁）：每天 3 把隨機武器，強化值 -2～+7
  var ANC = 'npc_afk_classic_ancient', ANC_TOWNS = ['town_gludin', 'town_oren', 'town_aden'];
  var ancOn = function () { return on() && era() >= 1; };
  var syncAncient = function () {
    ANC_TOWNS.forEach(function (tk2) {
      try {
        var town = DB.towns[tk2]; if (!town) return;
        var has = town.npcs.some(function (n) { return n.id === ANC; });
        if (ancOn() && !has) town.npcs.push({ id: ANC, n: '古代物品商人', title: '古代武器', type: 'craft', classicOnly: true, d: '從廢墟裡挖出古代武器的商人。每把的強化值都不一樣，從 -2 到 +7——買之前看清楚。' });
        if (!ancOn() && has) town.npcs = town.npcs.filter(function (n) { return n.id !== ANC; });
      } catch (e) {}
    });
  };
  try { if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[ANC]) NPC_SPR_FIXED[ANC] = '1254'; } catch (e) {}
  var wpnPool = null;
  var ancPool = function () {
    if (wpnPool) return wpnPool;
    wpnPool = Object.keys(DB.items).filter(function (id) { var d = DB.items[id]; return d && d.type === 'wpn' && !d.relic && !d.unique && !d.noEnhance && !/^relic_|^afk_|_hidden/.test(id) && (d.p || 0) >= 500 && (d.p || 0) <= 300000; });
    return wpnPool;
  };
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  var ancStock = function (town) {
    var p = P(); if (!p) return [];
    if (!p._afkAnc || p._afkAnc.day !== today()) p._afkAnc = { day: today(), stock: {} };
    if (!p._afkAnc.stock[town]) {
      var pool = ancPool(), st = [];
      for (var i = 0; i < 3 && pool.length; i++) {
        var id = pool[Math.floor(Math.random() * pool.length)], en = Math.floor(Math.random() * 10) - 2, d = DB.items[id];
        st.push({ id: id, en: en, price: Math.max(100, Math.floor((d.p || 1000) * (en > 0 ? 1 + en * 0.6 : 1))), sold: false });
      }
      p._afkAnc.stock[town] = st;
    }
    return p._afkAnc.stock[town];
  };
  var renderAncient = function (div) {
    var p = P(), town = mapState.current, st = ancStock(town);
    var nm2 = function (x) { var d = DB.items[x.id] || {}; return (x.en > 0 ? '+' + x.en + ' ' : (x.en < 0 ? x.en + ' ' : '')) + (d.n || x.id); };
    div.innerHTML = '<div class="text-sm space-y-2"><div class="text-slate-300">「都是從拉斯塔巴德的廢墟裡挖出來的。好壞看運氣，一天只有三把。」</div>' +
      st.map(function (x, i) { return '<div class="flex items-center justify-between gap-2"><span class="' + (x.en < 0 ? 'text-red-300' : (x.en >= 5 ? 'text-amber-300' : '')) + '">' + nm2(x) + '（' + x.price.toLocaleString() + ' 金幣）</span><button type="button" class="btn" data-anc="' + i + '"' + (x.sold ? ' disabled' : '') + '>' + (x.sold ? '已售出' : '購買') + '</button></div>'; }).join('') + '</div>';
    div.onclick = function (e) {
      var b = e.target.closest('[data-anc]'); if (!b || b.disabled) return;
      var x = st[Number(b.getAttribute('data-anc'))]; if (!x || x.sold) return;
      if ((p.gold || 0) < x.price) { sys('<span class="text-red-400">金幣不足。</span>'); return; }
      var had = {}; p.inv.forEach(function (i) { had[i.uid] = 1; });
      p.gold -= x.price; x.sold = true; gainItem(x.id, 1, true, true);
      var it = p.inv.find(function (i) { return i.id === x.id && !had[i.uid]; }); if (it) it.en = x.en;
      sys('<span class="text-amber-200">向古代物品商人買了 ' + nm2(x) + '。</span>');
      try { updateUI(); renderTabs(true); saveGame(); } catch (e2) {}
      renderAncient(div);
    };
  };


  // 光與影之後：鋼爪隨機爆擊、雙刀雙擊（天堂原本的設計，跟黑暗妖精一起登場）
  W.__afkClassicDE = function () { return on() && era() >= 1; };
  if (typeof W.filterClassicEffLabels === 'function') {
    var oEff = W.filterClassicEffLabels;
    W.filterClassicEffLabels = function (effArr) {
      var r = oEff.apply(this, arguments);
      try { if (W.__afkClassicDE() && Array.isArray(effArr)) effArr.forEach(function (e) { if (typeof e === 'string' && e.indexOf('雙刃') === 0 && r.indexOf(e) < 0) r.push(e); }); } catch (e2) {}
      return r;
    };
  }


  // ── 八、原版經驗、死亡與掉落（天堂原版／L1J 反推的官服數值；只對經典模式）──
  // 經驗值表：Lv1～48 用原版表（約 Lv⁴ 曲線＋45～48 級之牆），Lv49 起每級 36,065,092；65 起 ×2、70 ×4、75 ×8、79 ×16、80 起 ×32
  var EXP_ORIG = (typeof EXP_T !== 'undefined' && EXP_T.length >= 50) ? EXP_T.slice(0, 50) : null;
  var LV49 = 36065092;
  var expMul = function (lv) { return lv >= 80 ? 32 : lv >= 79 ? 16 : lv >= 75 ? 8 : lv >= 70 ? 4 : lv >= 65 ? 2 : 1; };
  var classicReq = function (lv) { if (lv >= 100) return Infinity; if (lv < 49) return EXP_ORIG[lv] || Infinity; return LV49 * expMul(lv); };
  var oReq = W.getExpReq;
  if (EXP_ORIG && typeof oReq === 'function') {
    W.getExpReq = function (lv) { return on() ? classicReq(lv) : oReq.apply(this, arguments); };
    if (typeof W.petExpReq === 'function') W.petExpReq = function (lv) { return Math.max(1, Math.floor(oReq(lv) / 10)); };   // 寵物照舊表
  }
  // 換表：保留當級進度百分比（玩家與傭兵各換一次）
  var migrateExp = function (x) {
    if (!x || x._afkExpOrig || !EXP_ORIG) return;
    var lv = x.lv || 1, a = oReq(lv), b = classicReq(lv);
    if (isFinite(a) && isFinite(b) && a > 0) x.exp = Math.min(b - 1, Math.floor((x.exp || 0) / a * b));
    x._afkExpOrig = 1;
  };
  var migrateAll = function () { var p = P(); if (!p || !p.classicMode) return; migrateExp(p); (p.allies || []).forEach(migrateExp); };

  // 組隊經驗：依等級²分配（每位隊員拿 自己Lv² ÷ 全隊Lv²總和），每多一位隊員 +4%，隊伍有王族再 +5.9%
  W.__afkExpShare = function (x) {
    var p = P(); if (!(p && p.classicMode) || !x) return 1;
    var mem = [p].concat(GiranPartyView.combatAllies(p).filter(function (a) { return a && !a._downed; }));
    if (mem.length <= 1) return 1;
    var sum = mem.reduce(function (s2, m) { var l = m.lv || 1; return s2 + l * l; }, 0), l2 = (x.lv || 1) * (x.lv || 1);
    return sum > 0 ? l2 / sum : 1;
  };
  // 小數累積（玩家 2026-11-01 06:06：Lv1 四人隊掛 12 小時，有人卡在 1～2 級）：原版依等級²分配，低等隊員每隻只分到 0.x 點，
  //   核心取整數後永遠是 0——先升級的人分得更多、落後的人一點都拿不到。改成把小數記在角色身上，累積滿 1 點就給（期望值跟原版一樣）。
  //   核心補丁：scripts/apply-core-patches.mjs patchClassicExpCarry。
  W.__afkExpCarry = function (x, raw) {
    raw = Number(raw) || 0; if (!(raw > 0)) return 0;
    if (!on() || !x) return Math.floor(raw);
    var t = raw + (Number(x._afkExpFrac) || 0), n = Math.floor(t);
    x._afkExpFrac = Math.round((t - n) * 1e6) / 1e6;
    return n;
  };
  if (typeof W.partyExpBonusPct === 'function') {
    var oPEB = W.partyExpBonusPct;
    W.partyExpBonusPct = function () {
      var p = P(); if (!(p && p.classicMode)) return oPEB.apply(this, arguments);
      var al = GiranPartyView.combatAllies(p).filter(function (a) { return a && !a._downed; });
      if (!al.length) return 0;
      return al.length * 4 + ((p.cls === 'royal' || al.some(function (a) { return a.cls === 'royal'; })) ? 5.9 : 0);
    };
  }
  // 掉寶、掉錢不再乘隊伍人數（原版沒有這種倍率）
  if (typeof W.partyRewardMult === 'function') { var oPRM = W.partyRewardMult; W.partyRewardMult = function () { return on() ? 1 : oPRM.apply(this, arguments); }; }
  // 金幣：一般怪 100% 掉；數量照原版同級範圍（下限 0.13L²＋1.16L、上限 0.20L²＋1.84L＋13）
  W.__afkGoldRate = function () { return on() ? 1 : 0.7; };
  if (typeof W.monsterGoldRange === 'function') {
    var oGold = W.monsterGoldRange;
    W.monsterGoldRange = function (mob) {
      if (!on() || !mob || (mob.boss && Number(mob.goldMin) > 0 && Number(mob.goldMax) >= Number(mob.goldMin))) return oGold.apply(this, arguments);
      var L = Math.max(1, Number(mob.lv) || 1), lo = Math.max(1, Math.round(0.13 * L * L + 1.16 * L)), hi = Math.max(lo, Math.round(0.20 * L * L + 1.84 * L + 13));
      if (mob.hard && !mob.boss) { lo = Math.round(lo * 1.25); hi = Math.round(hi * 1.25); }
      return { min: lo, max: hi };
    };
  }

  // 死亡：Lv10 以下不扣；11～44 扣 10%；45 9%、46 8%、47 7%、48 6%、49 起 5%（65 起依需求倍數折算）；會掉等級。夢幻之島不扣
  var deathPct = function (lv) { if (lv <= 10) return 0; if (lv <= 44) return 0.10; if (lv <= 48) return 0.10 - (lv - 44) * 0.01; return 0.05 / expMul(lv); };
  var noPenaltyMap = function () { try { return mapState.current === 'dream_island'; } catch (e) { return false; } };
  W.__afkClassicDeath = function (p) {
    if (!p || noPenaltyMap()) return 0;
    var lv0 = p.lv || 1, loss = Math.floor(classicReq(lv0) * deathPct(lv0)); if (!(loss > 0) || !isFinite(loss)) return 0;
    var before = p.exp || 0; p.exp = before - loss;
    var down = 0;
    while (p.exp < 0 && (p.lv || 1) > 1) {
      if (p.lv >= 50) p._afkBonusDebt = (p._afkBonusDebt || 0) + 1;   // 50 級以上掉一級：之後重新升回這一級不再給加點
      p.lv--; down++; p.exp += classicReq(p.lv);
    }
    if (p.exp < 0) p.exp = 0;
    if (down) {
      try { calcStats(); } catch (e) {}
      sys('<span class="text-red-400 font-bold">💀 經驗值不夠扣，你掉到了 Lv.' + p.lv + '！</span>');
    }
    return loss;
  };
  if (typeof W.checkLvUp === 'function') {
    var oLvUp = W.checkLvUp;
    W.checkLvUp = function () {
      var p = P(), lv0 = p && p.lv;
      var r = oLvUp.apply(this, arguments);
      try {
        if (p && p._afkBonusDebt > 0 && p.lv > lv0) {
          var gained = 0; for (var l = lv0 + 1; l <= p.lv; l++) if (l >= 50) gained++;
          var take = Math.min(p._afkBonusDebt, gained, p.bonus || 0);
          if (take > 0) { p.bonus -= take; p._afkBonusDebt -= take; }
        }
      } catch (e) {}
      return r;
    };
  }
  // 聖使阿卡塔買回經驗：原版神官價——Lv45 以下 Lv²×100、以上 Lv²×200，正義值 0 以上半價
  W.__afkBuybackCost = function (r) {
    var lv = (r && r.lv) || 1, p = P();
    if (!(p && p.classicMode)) return lv * lv * 1000;
    var c = lv * lv * (lv < 45 ? 100 : 200);
    if ((Number(p.alignmentValue) || 0) >= 0) c = Math.floor(c / 2);
    return Math.max(1, c);
  };
  // 死亡掉物品：依正義值（原版公式），每次死亡判定一次；越邪惡掉越多件，穿在身上的也會掉
  var dropRate = function (law) {   // 千分率
    var rate = Math.floor(((law + 32768) / 1000 - 65) * 4);
    if (rate >= 0) return 0;
    rate = -rate; if (law < 0) rate *= 2;
    return rate;
  };
  var dropCount = function (law) { var n = law <= -30000 ? 4 : law <= -20000 ? 3 : law <= -10000 ? 2 : 1; return 1 + Math.floor(Math.random() * n); };
  if (typeof W.pvpChaoticDeathItemLoss === 'function') {
    var oLoss = W.pvpChaoticDeathItemLoss;
    W.pvpChaoticDeathItemLoss = function () {
      var p = P();
      if (!(p && p.classicMode)) return oLoss.apply(this, arguments);
      try { if (typeof isSiegeArea === 'function' && isSiegeArea(mapState.current)) return; } catch (e) {}
      if (noPenaltyMap()) return;
      var law = Math.max(-32768, Math.min(32767, Math.round(Number(p.alignmentValue) || 0)));
      if (Math.floor(Math.random() * 1000) + 1 > dropRate(law)) return;
      var n = dropCount(law), keep = p.alignmentValue, R = Math.random;
      for (var i = 0; i < n; i++) {
        var first = true;
        Math.random = function () { if (first) { first = false; return 0; } return R(); };   // 借用原本的「掉一件並記錄」流程
        p.alignmentValue = -20000;
        try { oLoss.apply(this, arguments); } catch (e) {} finally { Math.random = R; p.alignmentValue = keep; }
      }
    };
  }


  // ── 九、一般角色轉經典（不可逆）：選角畫面勾「轉為經典模式」再按進入遊戲，確認兩次 ──
  // 轉換：等級壓到這個時代的上限（序章 50、三部曲 80）、經驗歸零；六大屬性全部 18；
  //       可分配點數＝等級 − 50；萬能藥歸零重喝；轉生、精通、傭兵、血盟、席琳的世界都不跟過去。裝備、背包保留。
  var convertToClassic = function (toTrilogy) {
    var p = P(); if (!p || p.classicMode) return false;
    p._afkEra = (toTrilogy && trilogyUnlocked()) ? 1 : 0;
    (p.allies || []).forEach(function (a) { try { snapshotMercPrefs(a); var m = _settleAllyExp(a, 'dismiss'); if (m) sys(m); } catch (e) {} });
    p.allies = [];
    try { syncMercenaryEmploymentRegistry(true); } catch (e) {}
    p._afkPreClassic = { at: Date.now(), lv: p.lv, rebirth: p.rebirth || 0, base: p.base, alloc: p.alloc, panacea: p.panacea, panaceaUsed: p.panaceaUsed || 0, mastery: p.mastery || null };
    p.sherineWorld = false; p.sherineMad = false; p.sherineDream = false;
    p.bloodPledge = null;
    p.classicMode = true; syncProxy();
    p.rebirth = 0; delete p._afkGrandLv;
    p.mastery = null; p.masteryQuest = null;
    var cap = eraDef().lvCap || 50;
    p.lv = Math.max(1, Math.min(p.lv || 1, cap)); p.exp = 0; p._afkExpOrig = 1;
    p.base = { str: 18, dex: 18, con: 18, int: 18, wis: 18, cha: 18 };
    p.alloc = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    var back = panaceaBack(p);
    p.panacea = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }; p.panaceaUsed = 0;
    p.bonus = Math.max(0, p.lv - 50);
    p.rebirthHpKeep = 0; p.rebirthMpKeep = 0; p._afkPanaceaBack = 1; p._afkClassicMig = CLASSIC_MIG;
    p._afkBonusDebt = 0;
    try { sealAll(p); } catch (e) {}
    try { if (typeof clanSyncCurrentPlayer === 'function') clanSyncCurrentPlayer(); } catch (e) {}
    try { calcStats(); p.hp = p.mhp; p.mp = p.mmp; } catch (e) {}
    if (back) sys('<span class="text-violet-300">喝過的萬能藥 ' + back + ' 瓶已退回背包，可以重新喝（經典模式最多 5 瓶）。</span>');
    sys('<span class="text-violet-300 font-bold">🕰️ 你回到了天堂最初的時代：Lv.' + p.lv + '、六大屬性全部 18，還有 ' + p.bonus + ' 點可以分配。這個角色從此是經典模式，永遠不能轉回來。</span>');
    try { saveGame(); } catch (e) {}
    return true;
  };
  // 選角畫面：勾選框
  var CONV_ID = 'afk-classic-convert';
  var selSlotPlayer = function () { try { return typeof _roleReadSavePlayer === 'function' && typeof _loadSelectedSlot !== 'undefined' ? _roleReadSavePlayer(_loadSelectedSlot) : null; } catch (e) { return null; } };
  var paintConv = function () {
    var panel = document.getElementById('load-action-panel'); if (!panel) return;
    var box = document.getElementById(CONV_ID + '-wrap');
    if (!box) {
      box = document.createElement('label'); box.id = CONV_ID + '-wrap';
      box.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;color:#fca5a5;cursor:pointer;padding:4px 2px';
      box.innerHTML = '<input type="checkbox" id="' + CONV_ID + '"> 轉為經典模式進入（不可逆）';
      var enter = document.getElementById('load-btn-enter');
      panel.insertBefore(box, enter || panel.firstChild);
    }
    var sp = selSlotPlayer(), show = !!(sp && !sp.classicMode);
    box.style.display = show ? 'flex' : 'none';
    if (!show) { var cb = document.getElementById(CONV_ID); if (cb) cb.checked = false; }
  };
  ['renderLoadSelect', 'updateLoadInfo'].forEach(function (fn) {
    var o = W[fn]; if (typeof o !== 'function') return;
    W[fn] = function () { var r = o.apply(this, arguments); try { paintConv(); } catch (e) {} return r; };
  });
  var pendingConvert = false;
  if (typeof W.loadEnterSelected === 'function') {
    var oEnter = W.loadEnterSelected;
    W.loadEnterSelected = function () {
      var cb = document.getElementById(CONV_ID), sp = selSlotPlayer();
      if (cb && cb.checked && sp && !sp.classicMode) {
        var nm = sp.name || '這個角色', tri = false;
        if (trilogyUnlocked()) tri = confirm('帳號已經開啟黑妖三部曲。\n要讓「' + nm + '」直接進入黑妖三部曲嗎？\n（確定＝三部曲，等級上限 80；取消＝序章，等級上限 50）');
        var cap = tri ? 80 : 50;
        if (!confirm('確定要把「' + nm + '」（Lv.' + sp.lv + '）轉為經典模式？\n\n‧等級變成 ' + Math.min(sp.lv || 1, cap) + '、六大屬性全部 18，' + Math.max(0, Math.min(sp.lv || 1, cap) - 50) + ' 點可分配，萬能藥重喝\n‧轉生、精通、傭兵、血盟、席琳的世界不會跟過去\n‧裝備保留，但只剩武器大小傷、防具 AC 與強化值，其他效果封印\n\n轉換後永遠不能轉回一般模式。')) return;
        if (!confirm('最後確認：真的要把「' + nm + '」轉為經典模式嗎？這個動作無法復原。')) return;
        pendingConvert = tri ? 2 : 1;
      }
      return oEnter.apply(this, arguments);
    };
  }

  // ── 十一、聖使阿卡塔贖回裝備：經典模式一次一件，冷卻現實時間 12 小時 ──
  var REDEEM_CD = 12 * 3600 * 1000;
  var redeemLeft = function () { var p = P(); return p && p.classicMode ? Math.max(0, (p._afkRedeemAt || 0) + REDEEM_CD - Date.now()) : 0; };
  var fmtLeft = function (ms) { var m = Math.ceil(ms / 60000); return Math.floor(m / 60) + ' 小時 ' + (m % 60) + ' 分'; };
  if (typeof W.arkataRedeemItem === 'function') {
    var oRedeem = W.arkataRedeemItem;
    W.arkataRedeemItem = function () {
      var p = P(), left = redeemLeft();
      if (left > 0) { sys('<span class="text-red-400">聖使阿卡塔還在恢復聖力：' + fmtLeft(left) + '後才能再贖回一件。</span>'); return; }
      var n0 = (p && Array.isArray(p.pvpLostItems)) ? p.pvpLostItems.length : 0;
      var r = oRedeem.apply(this, arguments);
      try { if (p && p.classicMode && Array.isArray(p.pvpLostItems) && p.pvpLostItems.length < n0 && (p.inv || []).length) { p._afkRedeemAt = Date.now(); saveGame(); var h = document.getElementById('interaction-content'); if (h) renderArkataBuyback(h); } } catch (e) {}
      return r;
    };
  }
  if (typeof W.renderArkataBuyback === 'function') {
    var oRAB = W.renderArkataBuyback;
    W.renderArkataBuyback = function (el) {
      var r = oRAB.apply(this, arguments);
      try { var p = P(); if (el && p && p.classicMode) { var d = document.createElement('div'); d.className = 'text-xs mt-2 ' + (redeemLeft() > 0 ? 'text-red-300' : 'text-emerald-300'); d.textContent = redeemLeft() > 0 ? '經典模式：裝備贖回冷卻中（還要 ' + fmtLeft(redeemLeft()) + '）。每次只能贖回一件，冷卻 12 小時。' : '經典模式：裝備贖回每次只能一件，贖回後冷卻現實時間 12 小時。'; el.appendChild(d); } } catch (e) {}
      return r;
    };
  }


  // ── 十二、經典模式＝很正常的天堂：魔改部分全部封印 ──
  var CORE = W.__afkClassicCore || {};
  var HP_CONVERTED = 0.15;
  // 能力值：角色本身＝基礎＋配點＋萬能藥（最多 5 瓶），單項最高 35；其他直接加能力值的效果全部封印
  var STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'], STAT_MAX = 35, ELIXIR_MAX = 5;
  var shrink = function (parts, allowed) {   // 按比例縮到總和 ≤ allowed（最大餘數法）
    var tot = 0; STAT_KEYS.forEach(function (k) { tot += parts[k]; });
    if (tot <= allowed) return parts;
    var out = {}, rem = [], used = 0;
    STAT_KEYS.forEach(function (k) { var v = parts[k] * allowed / tot; out[k] = Math.floor(v); used += out[k]; rem.push([v - out[k], k]); });
    rem.sort(function (x, y) { return y[0] - x[0]; });
    for (var i = 0; used < allowed && i < rem.length; i++, used++) out[rem[i][1]]++;
    return out;
  };
  var ownStats = function (p) {
    var b = p.base || {}, a = p.alloc || {}, pn = p.panacea || {}, elix = {};
    STAT_KEYS.forEach(function (k) { elix[k] = Math.max(0, Number(pn[k]) || 0); });
    elix = shrink(elix, ELIXIR_MAX);
    var out = {}; STAT_KEYS.forEach(function (k) { out[k] = Math.max(1, Math.min(STAT_MAX, (Number(b[k]) || 0) + (Number(a[k]) || 0) + elix[k])); });
    return out;
  };
  W.__afkOwnStats = function (p, d) {
    if (!(p && p.classicMode) || p !== P()) return;
    var o = ownStats(p); STAT_KEYS.forEach(function (k) { d[k] = o[k]; });
  };
  if (typeof W.__afkAttrBoost === 'function') {
    var oBoost = W.__afkAttrBoost;
    W.__afkAttrBoost = function (p) { if (p && p.classicMode && p === P()) return; return oBoost.apply(this, arguments); };
  }
  var oAllocCap = W.__afkAllocCap;
  W.__afkAllocCap = function () { if (on()) return STAT_MAX; return typeof oAllocCap === 'function' ? oAllocCap.apply(this, arguments) : 60; };
  // 萬能藥：經典模式最多 5 瓶、單項 35 以上不能喝（一次只喝一瓶）
  var elixirBlocked = function (d) {
    var p = P(); if (!(p && p.classicMode) || !d || d.eff !== 'panacea') return false;
    if ((p.panaceaUsed || 0) >= ELIXIR_MAX) { sys('<span class="text-red-400">經典模式萬能藥每個角色最多只能喝 5 瓶。</span>'); return true; }
    try { if (naturalStat(d.pstat) >= STAT_MAX) { sys('<span class="text-red-400">這項能力值已經 35，萬能藥沒有效果。</span>'); return true; } } catch (e) {}
    return false;
  };
  var defOfUid = function (u) { var p = P(), it = p && (p.inv || []).find(function (i) { return i.uid === u; }); return it ? DB.items[it.id] : null; };
  if (typeof W.useItem === 'function') { var oUse2 = W.useItem; W.useItem = function (u) { if (elixirBlocked(defOfUid(u))) return; return oUse2.apply(this, arguments); }; }
  if (typeof W.batchUseItem === 'function') {
    var oBatch = W.batchUseItem;
    W.batchUseItem = function (u) { var d = defOfUid(u); if (on() && d && d.eff === 'panacea') { if (!elixirBlocked(d)) W.useItem(u); return; } return oBatch.apply(this, arguments); };
  }

  // 裝備：只剩武器大小傷害、防具 AC、強化值（強化給的傷害／AC／魔防照算）；其他屬性、特效、詞條、套裝全部封印
  var KEEP = {};
  ('n type p gachaWeight req d safe slot ac c img ttmiSourceId ttmiWeight noEnhance dmgS dmgL spd relic w2h legend ranged isBow isWand isArrow isThrowing oneHand maxEn ' +
   'noSell noJunk noTrade unique reqAvatar strictAvatar ttmiMinLevel ttmiMaxLevel classicOk animFam _spdFam remains mrPerEn dollTier ttmiTags batchUse noConsume').split(' ').forEach(function (k) { KEEP[k] = 1; });
  var isEquipDef = function (d) { return !!(d && typeof d === 'object' && (d.type === 'wpn' || d.slot)); };
  var sealCache = {};
  // 遺物、傳說裝備（非原版）：武器大小傷 ×0.5；命中、傷害等面板數值 ×0.3；AC（含強化）×0.3 在能力值計算時處理
  var SPECIAL_STATS = ['meleeDmg', 'meleeHit', 'rangedDmg', 'rangedHit', 'dmgBonus', 'hit', 'extraDmg', 'extraHit', 'mdmg', 'magicHit', 'er', 'dr'];
  var isSpecial = function (d) { return !!(d && (d.relic || d.legend)); };
  var stripDef = function (id, d) {
    var c = sealCache[id]; if (c && c.__src === d) return c;
    c = {}; for (var k in KEEP) if (k in d) c[k] = d[k];
    if (isSpecial(d)) {
      if (c.dmgS) c.dmgS = Math.max(1, Math.floor(c.dmgS * 0.5)); if (c.dmgL) c.dmgL = Math.max(1, Math.floor(c.dmgL * 0.5));
      SPECIAL_STATS.forEach(function (f) { if (typeof d[f] === 'number' && d[f]) c[f] = Math.trunc(d[f] * 0.3); });
    }
    Object.defineProperty(c, '__src', { value: d }); Object.defineProperty(c, '__sealed', { value: true });
    sealCache[id] = c; return c;
  };
  // 代理只在「目前角色是經典模式」時掛上（一般角色讀 DB.items 零負擔）；換角色時切換
  var RAW = DB.items, PROXY = null;
  try {
    PROXY = new Proxy(RAW, { get: function (t, k) {
      var v = t[k];
      if (k === '__afkSealProxy') return true;
      if (typeof k !== 'string' || !isEquipDef(v)) return v;
      return stripDef(k, v);
    } });
  } catch (e) { console.warn('[AFK-classic] 裝備封印代理失敗', e); }
  var syncProxy = function () { var p = P(); var want = !!(p && p.classicMode && PROXY); if (want && DB.items !== PROXY) { sealCache = {}; DB.items = PROXY; } else if (!want && DB.items !== RAW) DB.items = RAW; };
  // 物品身上的祝福、遠古、屬性、套裝、願望等附加值：搬進 _afkSeal（封印，不刪）
  var SEAL_FIELDS = ['bless', 'anc', 'attr', 'attrMagic', 'attrMagicStar', 'seteff', 'gw', 'affixes'];
  var sealItem = function (it) {
    if (!it || !it.id) return;
    var d = RAW && RAW[it.id]; if (!isEquipDef(d)) return;
    SEAL_FIELDS.forEach(function (f) { if (it[f]) { it._afkSeal = it._afkSeal || {}; it._afkSeal[f] = it[f]; it[f] = (f === 'bless' ? false : (f === 'attr' ? false : null)); } });
  };
  var sealAll = function (p) {
    if (!(p && p.classicMode)) return;
    if (p.eq) Object.keys(p.eq).forEach(function (k) { sealItem(p.eq[k]); });
    (p.inv || []).forEach(sealItem);
  };
  // 能力值計算：經典角色只走原版計算（外掛疊上去的加成：卡冊、遺物、套裝、轉生、抗性……全部不算）
  if (typeof W.recomputeStats === 'function') {
    var oRecalc = W.recomputeStats;
    W.recomputeStats = function () {
      var p = P();
      if (p && p.classicMode && typeof CORE.recomputeStats === 'function') {
        try { if (p.eq) Object.keys(p.eq).forEach(function (k) { sealItem(p.eq[k]); }); } catch (e) {}
        var self = this, args = arguments;
        // 遺物／傳說裝備的 AC（含強化）只算 3 成：先算一次「拿掉這些裝備」的 AC，再算完整的，差額 ×0.3
        var spSlots = p.eq ? Object.keys(p.eq).filter(function (k) { var it = p.eq[k]; return it && isSpecial(RAW[it.id]); }) : [];
        var acBase = null;
        if (spSlots.length) {
          var keep = {}; spSlots.forEach(function (k) { keep[k] = p.eq[k]; p.eq[k] = null; });
          try { CORE.recomputeStats.apply(self, args); acBase = p.d.ac; } catch (e) {} finally { spSlots.forEach(function (k) { p.eq[k] = keep[k]; }); }
        }
        var r = CORE.recomputeStats.apply(self, args);
        try {
          if (acBase != null) p.d.ac = Math.round(acBase + (p.d.ac - acBase) * 0.3);
          if (p._afkPreClassic && !(p._afkClassicMig >= 1)) { p.mhp = Math.max(1, Math.floor(p.mhp * HP_CONVERTED)); if (p.hp > p.mhp) p.hp = p.mhp; }   // 一般模式轉來的角色：HP ×0.15
        } catch (e) {}
        return r;
      }
      return oRecalc.apply(this, arguments);
    };
  }
  // 變身：只用原版變身表（最高 Lv80）；變身卡指定、套裝變身都不算
  if (typeof W.__afkPolyOverride === 'function') {
    var oPoly = W.__afkPolyOverride;
    W.__afkPolyOverride = function (p) { if (p && p.classicMode) return false; return oPoly.apply(this, arguments); };
  }
  // 外掛加的 NPC：經典模式一律灰掉、不能用
  var OWN_NPC = { npc_afk_trilogy: 1, npc_afk_classic_orin: 1, npc_afk_classic_ancient: 1 };
  var BASIC_NPC = /^(npc_wh_|npc_ally_|npc_esti$|npc_tros$)/;   // 城堡的倉庫、傭兵、血盟（攻城、亞丁城照常）
  var modNpc = function (id) { return !!(CORE.npcIds && id && !CORE.npcIds[id] && !OWN_NPC[id] && !BASIC_NPC.test(id)); };
  if (typeof W.interactNPC === 'function') {
    var oNpc2 = W.interactNPC;
    W.interactNPC = function (npcId) {
      if (on() && modNpc(npcId)) { sys('<span class="text-slate-400">經典模式沒有這個功能（已封印）。</span>'); return; }
      return oNpc2.apply(this, arguments);
    };
  }
  if (typeof W.renderTownNPCMap === 'function') {
    var oTown = W.renderTownNPCMap;
    W.renderTownNPCMap = function (townId) {
      var r = oTown.apply(this, arguments);
      try {
        if (on()) {
          var names = {}; ((DB.towns[townId] && DB.towns[townId].npcs) || []).forEach(function (n) { if (modNpc(n.id)) names[n.n + '|' + n.title] = 1; });
          document.querySelectorAll('#town-npc-map .town-npc').forEach(function (el) {
            var nm = el.querySelector('.tn-name'), tt = el.querySelector('.tn-title');
            if (nm && names[nm.textContent + '|' + (tt ? tt.textContent : '')]) { el.style.filter = 'grayscale(1)'; el.style.opacity = '.45'; el.title = '經典模式沒有這個功能（已封印）'; if (tt) tt.textContent = '已封印'; }
          });
        }
      } catch (e) {}
      return r;
    };
  }


  // 經典模式：畫面上最多 3 隻怪（後排兩格不開）
  if (typeof W.backSlotsActive === 'function') { var oBack = W.backSlotsActive; W.backSlotsActive = function () { return on() ? false : oBack.apply(this, arguments); }; }


  // ── 十三、法術依黑橘當年鎖住：生與死（2005/02）才開放的法師高階魔法；騎士技能（2005/08 以後才有）整個時代都沒有 ──
  var LIFE_SPELLS = ['sk_berserk', 'sk_holy_dash', 'sk_fire_prison', 'sk_thunder_storm', 'sk_sleep_mist', 'sk_holy_barrier', 'sk_abs_barrier', 'sk_soul_up', 'sk_blizzard_storm'];
  var knightOnly = function (sk) { return !!(sk && sk.reqK && !sk.reqM && !sk.reqE && !sk.reqRoy && !sk.reqD && !sk.reqI && !sk.reqDk && !sk.reqW); };
  var skillLocked = function (id) {
    if (!on() || !id) return false;
    var sk = DB.skills[id]; if (!sk) return false;
    if (era() < 1 && LIFE_SPELLS.indexOf(id) >= 0) return true;
    return knightOnly(sk);
  };
  var skIdOf = function (sk) { if (!sk) return null; if (typeof sk === 'string') return sk; for (var k in DB.skills) if (DB.skills[k] === sk) return k; return null; };
  var lockMsg = function (id) { var sk = DB.skills[id] || {}; return '<span class="text-slate-400">經典模式這個時代還沒有「' + (sk.n || id) + '」。</span>'; };
  if (typeof W.castSkill === 'function') {
    var oCast3 = W.castSkill;
    W.castSkill = function (skId) { if (skillLocked(skId)) return false; return oCast3.apply(this, arguments); };
  }
  ['allyCastMagic', 'allyCastNonDamage', 'allyCastPhysicalSkill', 'allyCastCrush', 'allyCastFixedStatus', 'allyCastSlaughter', 'allyCastMpDmg', 'allyCastConvert'].forEach(function (fn) {
    var o = W[fn]; if (typeof o !== 'function') return;
    W[fn] = function (ally, sk) { if (on() && skillLocked(skIdOf(sk))) return false; return o.apply(this, arguments); };
  });
  if (typeof W.allySkillElementOk === 'function') {
    var oElOk = W.allySkillElementOk;
    W.allySkillElementOk = function (ally, sid) { if (skillLocked(sid)) return false; return oElOk.apply(this, arguments); };
  }
  if (typeof W.useItem === 'function') {
    var oUse3 = W.useItem;
    W.useItem = function (u) { var d = defOfUid(u); if (d && d.type === 'skillbk' && skillLocked(d.sk)) { sys(lockMsg(d.sk)); return; } return oUse3.apply(this, arguments); };
  }

  // ── 十四、物品依時代：經典模式打怪不會掉當年還沒有的東西 ──
  // 遺物、傳說、遠方（ttmi）物品、魔法娃娃、席琳遺骸、外掛新增物品；黑暗妖精的鋼爪、雙刀、十字弓要「光與影」以後才掉
  var itemOutOfEra = function (id) {
    var d = RAW && RAW[id]; if (!d) return false;
    if (d.relic || d.legend || d.ttmiSourceId || d.doll || d.dollTier || /^(relic_|ttmi_|afk_|doll_|rem_)/.test(id) || /~/.test(id)) return true;
    if (/魔法娃娃|龍之鑽石|屬性.*卷軸|席琳/.test(d.n || '')) return true;
    if (era() < 1) { try { var tg = getWeaponTags(id) || []; if (tg.indexOf('鋼爪') >= 0 || tg.indexOf('雙刀') >= 0 || tg.indexOf('十字弓') >= 0) return true; } catch (e) {} if (/黑暗精靈水晶|黑魔石/.test(d.n || '')) return true; }
    return false;
  };
  var inKill = 0;
  if (typeof W.killMob === 'function') {
    var oKill4 = W.killMob;
    W.killMob = function () { inKill++; try { return oKill4.apply(this, arguments); } finally { inKill--; } };
  }
  if (typeof W.gainItem === 'function') {
    var oGain = W.gainItem;
    W.gainItem = function (id) { if (inKill > 0 && on() && itemOutOfEra(id)) return null; return oGain.apply(this, arguments); };
  }


  // ── 十五、商店依時代：當年還沒有的東西不賣（遺物、魔法娃娃、遠方物品、鎖住的技能書；序章不賣黑妖武器）──
  var shopBlocked = function (id) {
    if (!on()) return false;
    var d = RAW && RAW[id]; if (!d) return false;
    if (itemOutOfEra(id)) return true;
    if (d.type === 'skillbk' && d.sk && skillLocked(d.sk)) return true;
    return false;
  };
  if (typeof W.getShopItemsForNpc === 'function') {
    var oShop = W.getShopItemsForNpc;
    W.getShopItemsForNpc = function () { var list = oShop.apply(this, arguments); return on() ? list.filter(function (id) { return !shopBlocked(id); }) : list; };
  }
  if (typeof W.buyItem === 'function') {
    var oBuy = W.buyItem;
    W.buyItem = function (id) { if (shopBlocked(id)) { sys('<span class="text-slate-400">經典模式這個時代還沒有這樣東西。</span>'); return; } return oBuy.apply(this, arguments); };
  }

  // ── 給小百科／掉落查詢用（不看目前角色，回答「經典模式的哪個時代」）（玩家 2026-10-28）──
  //   mapEra(v)：0＝序章起、1＝黑妖三部曲才開放、-1＝經典模式進不去、null＝不受時代限制（攻城等動態地圖）
  //   itemEra(id)：0＝經典照常會掉、1＝黑妖三部曲才會掉（黑妖武器、黑暗精靈水晶、黑魔石）、-1＝經典不會掉（遺物、魔法娃娃、新增物品…）
  var mapEra = function (v) {
    if (!v) return null;
    if (PART1.indexOf(v) >= 0) return 0;
    if ((ERAS[1].maps || []).indexOf(v) >= 0) return 1;
    return staticMaps()[v] ? -1 : null;
  };
  var itemEra = function (id) {
    var d = RAW && RAW[id]; if (!d) return -1;
    if (d.card || d.cardTier || /card/.test(String(d.eff || ''))) return -1;   // 經典模式不掉卡片（玩家 2026-10-28）
    if (d.relic || d.legend || d.ttmiSourceId || d.doll || d.dollTier || /^(relic_|ttmi_|afk_|doll_|rem_)/.test(id) || /~/.test(id)) return -1;
    if (/魔法娃娃|龍之鑽石|屬性.*卷軸|席琳/.test(d.n || '')) return -1;
    try { var tg = getWeaponTags(id) || []; if (tg.indexOf('鋼爪') >= 0 || tg.indexOf('雙刀') >= 0 || tg.indexOf('十字弓') >= 0) return 1; } catch (e) {}
    if (/黑暗精靈水晶|黑魔石/.test(d.n || '')) return 1;
    return 0;
  };
  var ERA_TXT = { '0': '序章起', '1': '黑妖三部曲起', '-1': '經典沒有' };
  W.AFK_CLASSIC = { mapEra: mapEra, itemEra: itemEra, eraText: function (n) { return ERA_TXT[String(n)] || ''; }, shopBlocked: shopBlocked, trilogyUnlocked: trilogyUnlocked, CHAPTERS: CHAPTERS, skillLocked: skillLocked, itemOutOfEra: itemOutOfEra, ownStats: ownStats, convertToClassic: convertToClassic, redeemLeft: redeemLeft, classicReq: classicReq, deathPct: deathPct, dropRate: dropRate, migrateAll: migrateAll, rollDog: rollDog, era: era, setEra: setEra, ERAS: ERAS, part1: PART1, sealedMap: sealedMap, openCls: openCls, ancStock: ancStock, syncAncient: syncAncient, net: net, NET: NET, lagging: lagging, bugged: bugged, floors: FLOORS, stairs: STAIRS, orin: ORIN, syncOrin: syncOrin, open: OPEN, rollNet: rollNet, goFloor: goFloor };

  // ── 十六、（Ping 11-28 18:03）一般模式轉來的經典角色：轉生紀錄全部消除 ──
  //   等級＝這個時代的最高等級（序章 50／三部曲 80）、經驗歸零；六大屬性回到 18、配點全部退回重新分配（可分配＝等級−50）；
  //   喝過的萬能藥全部退回背包；精通、轉生保留的 HP／MP 都不算，HP／MP 照經典的算法重算。每個角色只做一次。
  var CLASSIC_MIG = 1;
  var NUM = function (x) { return Number(x) || 0; };
  function panaceaBack(p, extra) {
    var n = 0;
    STAT_KEYS.forEach(function (k) {
      var c = Math.max(0, Math.floor(NUM(p.panacea && p.panacea[k]) + NUM(extra && extra[k])));
      if (c > 0 && typeof gainItem === 'function' && RAW && RAW['panacea_' + k]) { try { gainItem('panacea_' + k, c, true, false); n += c; } catch (e) {} }
    });
    return n;
  }
  var migrate = function () {
    var p = P(); if (!p || !p.classicMode || p._afkClassicMig >= CLASSIC_MIG || !state.running) return;
    var conv = !!(p._afkPreClassic || NUM(p.rebirth) > 0 || p._afkGrandLv);
    if (!conv) { p._afkClassicMig = CLASSIC_MIG; return; }
    var pre = p._afkPreClassic || {}, cap = eraDef(era(p)).lvCap || 50;
    var back = panaceaBack(p, p._afkPanaceaBack ? null : pre.panacea);
    p.rebirth = 0; delete p._afkGrandLv; p.rebirthHpKeep = 0; p.rebirthMpKeep = 0;
    p.mastery = null; p.masteryQuest = null;
    p.lv = cap; p.exp = 0;
    p.base = { str: 18, dex: 18, con: 18, int: 18, wis: 18, cha: 18 };
    p.alloc = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    p.panacea = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }; p.panaceaUsed = 0;
    p.bonus = Math.max(0, cap - 50); p._afkBonusDebt = 0;
    p._afkPanaceaBack = 1; p._afkClassicMig = CLASSIC_MIG;
    try { calcStats(); p.hp = p.mhp; p.mp = p.mmp; updateUI(); } catch (e) {}
    sys('<span class="text-violet-300 font-bold">🕰️ 經典模式整理：轉生紀錄已消除，等級 ' + cap + '，六大屬性回到 18，' + p.bonus + ' 點可以重新分配' + (back ? '；喝過的萬能藥 ' + back + ' 瓶已退回背包' : '') + '。HP／MP 照經典的算法重算。</span>');
    try { saveGame(); } catch (e) {}
  };
  setInterval(function () { try { migrate(); } catch (e) {} }, 2000);
  // 精通：經典角色只算自己學的那一個（轉生送的四種精通不算）
  if (typeof W._afkM === 'function') {
    var oM = W._afkM;
    W._afkM = function (p, id) { if (p && p.classicMode) return p.mastery === id; return oM.apply(this, arguments); };
    try { (0, eval)('_afkM = window._afkM'); } catch (e) {}
  }
  // 上限加成（轉生保留 HP／MP、各種外掛的 HP／MP 加成）：經典角色一律不算
  if (typeof W.__afkMaxAdd === 'function') {
    var oMax = W.__afkMaxAdd, adds = oMax.add;
    W.__afkMaxAdd = function (p) { if (p && p.classicMode) return; return oMax.apply(this, arguments); };
    W.__afkMaxAdd.add = adds;
  }
  // 總閘：經典角色把「新增的玩法、內容、劇情、成長、隱藏規則、平衡調整」全部當成關閉；
  //   錯誤修正、效能、介面、存檔、自動化與便利功能照常。以後新增的玩法開關預設也一樣不會漏到經典。
  var GATE_GROUPS = { '遊戲內容': 1, '遊戲玩法': 1, '劇情': 1, '成長': 1, '隱藏規則': 1, '遊戲平衡': 1 };
  var CLASSIC_KEEP = {};
  ('offline offlinenodeath offlinechase newbiepvp castlewar maps corrupt traditional wpnfix magefix stunfix autosupply autocancel hotcast ' +
   'retrial attrbatch cursebatch trackmaps bosstrack matwh redguard').split(' ').forEach(function (k) { CLASSIC_KEEP[k] = 1; });
  var TG = W.AFK_TOGGLES;
  if (TG && typeof TG.enabled === 'function' && typeof TG.list === 'function') {
    var oEnabled = TG.enabled, groupOf = {}, known = 0;
    var group = function (id) {
      if (!groupOf[id]) { try { var L = TG.list(); if (L.length !== known) { known = L.length; L.forEach(function (x) { groupOf[x.id] = x.group; }); } } catch (e) {} if (!groupOf[id]) groupOf[id] = ''; }
      return groupOf[id];
    };
    TG.enabled = function (id) {
      var r = oEnabled.apply(this, arguments);
      if (!r || CLASSIC_KEEP[id]) return r;
      var p = P(); if (!(p && p.classicMode)) return r;
      return GATE_GROUPS[group(id)] ? false : r;
    };
  }
  console.log('[AFK-classic] 已啟用：經典模式補正（256K 撥接、不死系頭目、古魯丁地監攀爬、歐林、職業封印）');
})();
