/* ============================================================================
 * afk-redguard.js — 避免紅人持續追殺（玩家 2026-10-29；外掛開關 redguard，預設開）
 *
 *   席琳神殿多一位 NPC「女神嘆息信徒 京」：花 10 顆龍之鑽石 或 100 萬金幣，
 *     ‧正義值（性向值）歸 0；
 *     ‧現在追殺你的紅人（被殺後記仇、嗆聲、密語尋仇加上的追殺名單）全部散去；等著尋仇的密語也一併作廢；
 *     ‧追殺永久解除：之後不會再有新的紅人追殺（記仇、嗆聲、密語尋仇、世界頻道記仇、白目玩家都不會加進追殺名單）。保護新手。
 *       （第一版是 24 小時；玩家 2026-10-29 17:43 改成永久。player.afkRedGuardUntil＝永久時是 Number.MAX_SAFE_INTEGER）
 *   不影響：自己打開的 PVP 模式（野外隨機遇到其他玩家）、血盟宣戰、攻城。
 *   不改核心：包 pvpMarkForChase（不加進名單）與 spawnMob（保護期間出怪前把追殺名單清掉，世界頻道記仇、白目玩家等其他來源也算）；
 *   追殺名單 player.trollPlayers、密語 player.pvpKillWhispers 是核心欄位。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'redguard', name: '避免紅人持續追殺（女神嘆息信徒 京）', group: '遊戲玩法',
    desc: '席琳神殿的「女神嘆息信徒 京」：花 10 龍之鑽石或 100 萬金幣，正義值歸 0、追殺你的紅人全部散去，而且追殺永久解除' });
  if (T && !T.enabled('redguard')) return;
  var K = W.__afkNpcKit; if (!K || typeof DB === 'undefined' || !DB.towns) return;
  var NPC_ID = 'npc_kyo_sigh', NPC_N = '女神嘆息信徒 京', TITLE = '淨化', TOWN = 'town_sherine';
  var COST = { dia: 10, gold: 1000000 }, H = 3600 * 1000, FOREVER = Number.MAX_SAFE_INTEGER;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = K.esc;
  var chasers = function (p) { return (p.trollPlayers || []).filter(function (t) { return t && (t.pvpRevenge || t.noExpire || t.until > Date.now()); }); };
  var protectedUntil = function (p) { return Number(p && p.afkRedGuardUntil) || 0; };
  var isProtected = function (p) { return protectedUntil(p) > Date.now(); };
  var dia = function () { try { return Math.floor(Number(W.pandoraGetSharedDiamonds()) || 0); } catch (e) { return 0; } };
  var say = function (h) { try { logSys(h); } catch (e) {} };

  // 保護期間不加進追殺名單
  if (typeof W.pvpMarkForChase === 'function') {
    var oMark = W.pvpMarkForChase;
    W.pvpMarkForChase = function (entry) {
      var p = P();
      if (p && isProtected(p)) { try { if (entry && entry.n && typeof pvpReleaseAlignLock === 'function' && !(p.trollPlayers || []).some(function (t) { return t && t.n === entry.n; })) pvpReleaseAlignLock(entry.n); } catch (e) {} return; }
      return oMark.apply(this, arguments);
    };
  }

  // 保護期間：出怪前把追殺名單清掉（世界頻道記仇、白目玩家等其他地方加進來的也算）
  var sweep = function (p) {
    var gone = chasers(p).map(function (t) { return t.n; }); if (!gone.length) return 0;
    p.trollPlayers = (p.trollPlayers || []).filter(function (t) { return t && gone.indexOf(t.n) < 0; });
    gone.forEach(function (n) { try { if (typeof pvpReleaseAlignLock === 'function') pvpReleaseAlignLock(n); } catch (e) {} });
    return gone.length;
  };
  if (typeof W.spawnMob === 'function') {
    var oSpawn = W.spawnMob;
    W.spawnMob = function () { try { var p = P(); if (p && isProtected(p) && p.trollPlayers && p.trollPlayers.length) sweep(p); } catch (e) {} return oSpawn.apply(this, arguments); };
  }

  var purify = function (pay) {
    var p = P(); if (!p) return '請先進入遊戲。';
    if (pay === 'dia') {
      if (typeof W.pandoraAdjustSharedDiamonds !== 'function') return '龍之鑽石帳戶暫時無法使用。';
      if (dia() < COST.dia) return '龍之鑽石不夠（需要 ' + COST.dia + '，目前 ' + dia() + '）。';
      var r = {}; try { r = W.pandoraAdjustSharedDiamonds(-COST.dia) || {}; } catch (e) {}
      if (!r.ok) return '龍之鑽石扣款失敗。';
    } else {
      if ((Number(p.gold) || 0) < COST.gold) return '金幣不夠（需要 ' + COST.gold.toLocaleString() + '）。';
      p.gold -= COST.gold;
    }
    var before = Number(p.alignmentValue) || 0;
    p.alignmentValue = 0;
    var gone = chasers(p).map(function (t) { return t.n; });
    sweep(p);
    // 場上正在追殺的紅人離場
    try { (mapState.mobs || []).forEach(function (m, i) { if (m && m.trollPlayer && gone.indexOf(m.n) >= 0) mapState.mobs[i] = null; }); } catch (e) {}
    // 等著尋仇的密語作廢
    (p.pvpKillWhispers || []).forEach(function (w) { if (w) { w.awaitingRevenge = false; w.revengeCount = 99; w.expiresAt = Date.now(); w.nextCheckAt = 0; } });
    p.afkRedGuardUntil = FOREVER;
    say('<span class="font-bold" style="color:#f9a8d4">🕊 ' + NPC_N + '為你向女神祈禱：正義值 ' + before.toLocaleString() + ' → 0' + (gone.length ? '，追殺你的 ' + gone.length + ' 名紅人散去了' : '') + '；追殺永久解除，之後不會再被紅人追殺。</span>');
    try { if (typeof renderPvpTab === 'function') renderPvpTab(); } catch (e) {}
    try { renderMobs(); } catch (e) {} try { updateUI(); } catch (e) {} try { saveGame(); } catch (e) {}
    return null;
  };

  // ── 消除宣戰（玩家 2026-11-06 21:59：誰都可以用）──
  //   七城宣戰（持有城堡數帶來的宣戰）的血盟全部撤回；一直到你的城數再變動為止（打回、攻下新城或又失城都會失效）。
  //   每個宣戰中的血盟 100 龍之鑽石或 1,000 萬金幣。不影響每週守城戰、強制宣戰、你自己主動宣戰；連續擊殺數不動。
  var WAR_COST = { dia: 100, gold: 10000000 };
  var CWa = function () { return W.__afkCastleWar || null; };
  // Ping 11-13 22:26：只有一座城卻被 30 個血盟宣戰（殺了他們的人、仇恨滿 50 就會「對方宣戰」，不是城堡帶來的）→ 消除宣戰改成「所有對你宣戰的 NPC 血盟」都算；強制宣戰那一個不算
  var mode = function () { try { return typeof clanModeKey === 'function' ? clanModeKey(P()) : (P() && P().classicMode ? 'classic' : 'normal'); } catch (e) { return 'normal'; } };
  var world = function (st) { if (!st || !st.npcWorlds) return null; var w = st.npcWorlds[mode()]; if (w && Array.isArray(w.clans)) return w; var ks = Object.keys(st.npcWorlds); for (var i = 0; i < ks.length; i++) { var x = st.npcWorlds[ks[i]]; if (x && Array.isArray(x.clans) && x.clans.some(function (c) { return c && c.hostile; })) return x; } return null; };
  var forcedId = function () { try { var c = CWa(), f = c && c.data().forced; return f && f.until > Date.now() ? f.clanId : null; } catch (e) { return null; } };
  var hostileIds = function () {
    var ids = [];
    try {
      var c = CWa(); if (c) (c.data().warIds || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
      var st = typeof _clanReadState === 'function' ? _clanReadState() : null;
      var w = world(st), fid = forcedId();
      if (w) w.clans.forEach(function (cl) { if (cl && cl.hostile && cl.id !== fid && ids.indexOf(cl.id) < 0) ids.push(cl.id); });
    } catch (e) {}
    return ids;
  };
  var warN = function () { return hostileIds().length; };
  var truceOn = function () { try { var c = CWa(); if (!c) return false; var d = c.data(); return !!(d.truceN && d.truceN === c.held().length); } catch (e) { return false; } };
  var endWar = function (pay) {
    var p = P(), c = CWa(); if (!p || !c) return '請先進入遊戲。';
    var d = c.data(), ids = hostileIds(), n = ids.length;
    if (!n) return '目前沒有血盟對你宣戰。';
    if (pay === 'dia') {
      var need = n * WAR_COST.dia;
      if (typeof W.pandoraAdjustSharedDiamonds !== 'function') return '龍之鑽石帳戶暫時無法使用。';
      if (dia() < need) return '龍之鑽石不夠（需要 ' + need.toLocaleString() + '，目前 ' + dia().toLocaleString() + '）。';
      var r = {}; try { r = W.pandoraAdjustSharedDiamonds(-need) || {}; } catch (e) {}
      if (!r.ok) return '龍之鑽石扣款失敗。';
    } else {
      var g = n * WAR_COST.gold;
      if ((Number(p.gold) || 0) < g) return '金幣不夠（需要 ' + g.toLocaleString() + '）。';
      p.gold -= g;
    }
    if ((d.warIds || []).length) { d.truceN = c.held().length; }
    c.save(d);
    try { c.syncWar(true); } catch (e) {}
    // 其他對你宣戰的血盟（仇恨帶來的）：撤回宣戰、仇恨歸零
    try {
      if (typeof _clanWithLock === 'function') _clanWithLock(function (st) {
        var w = world(st), ch = false; if (!w) return { commit: false };
        w.clans.forEach(function (cl) { if (cl && ids.indexOf(cl.id) >= 0 && cl.hostile) { cl.hostile = false; cl.hatred = 0; cl.counterWarChance = 0; if (cl.mercy && cl.mercy.pending) cl.mercy = null; ch = true; } });
        return ch ? {} : { commit: false };
      });
    } catch (e) {}
    try { (mapState.mobs || []).forEach(function (m, i) { if (m && m.trollPlayer && m._npcClanId && ids.indexOf(m._npcClanId) >= 0 && !m._afkForcedWar) mapState.mobs[i] = null; }); } catch (e) {}
    say('<span class="font-bold" style="color:#f9a8d4">🕊 ' + NPC_N + '為你向女神祈禱：' + n + ' 個血盟撤回了對你的宣戰。</span>');
    try { renderMobs(); } catch (e) {} try { updateUI(); } catch (e) {} try { saveGame(); } catch (e) {}
    return null;
  };

  var ui = { err: '' };
  var render = function (host) {
    var p = P(); if (!p) { host.innerHTML = '<div class="ax-note">請先進入遊戲。</div>'; return; }
    var cs = chasers(p), left = protectedUntil(p) - Date.now(), al = Number(p.alignmentValue) || 0;
    var h = '<div class="ax-h">女神嘆息信徒 京</div>'
      + '<div class="ax-note">「女神為每一個被追趕的人嘆息……讓我替你把那些仇恨洗去吧。」</div>'
      + '<div class="ax-note">目前正義值：<b style="color:' + (typeof pvpAlignmentColor === 'function' ? pvpAlignmentColor(al) : '#fff') + '">' + al.toLocaleString() + '</b>　追殺你的紅人：<b>' + cs.length + '</b> 名'
      + (cs.length ? '（' + cs.slice(0, 6).map(function (t) { return esc(t.n); }).join('、') + (cs.length > 6 ? '…' : '') + '）' : '')
      + (protectedUntil(p) >= FOREVER ? '<br><b style="color:#86efac">追殺已永久解除</b>（已經淨化過；再淨化一次只會把正義值歸 0）' : left > 0 ? '<br>保護中：還有 ' + Math.floor(left / H) + ' 小時 ' + Math.floor((left % H) / 60000) + ' 分不會被追殺' : '') + '</div>';
    if (ui.err) h += '<div class="ax-note" style="color:#fca5a5">' + esc(ui.err) + '</div>';
    var desc = '正義值歸 0；追殺你的紅人全部散去、等著尋仇的密語作廢；追殺永久解除，之後不會再被紅人追殺（記仇、嗆聲、密語尋仇、世界頻道記仇都不會加進追殺名單）。自己打開的 PVP 模式、血盟宣戰、攻城不受影響。';
    h += K.rowHtml({ key: 'dia', ico: '', name: '用龍之鑽石淨化', color: '#f9a8d4', desc: desc, req: K.reqTxt(dia(), COST.dia, '龍之鑽石'), btns: [['dia', '淨化', dia() >= COST.dia]] }, 'data-rg');
    h += K.rowHtml({ key: 'gold', ico: '', name: '用金幣淨化', color: '#fde68a', desc: '同上。', req: K.reqTxt(Number(p.gold) || 0, COST.gold, '金幣'), btns: [['gold', '淨化', (Number(p.gold) || 0) >= COST.gold]] }, 'data-rg');
    if (CWa()) {
      var wn = warN(), nd = wn * WAR_COST.dia, ng = wn * WAR_COST.gold;
      var wdesc = '目前對你宣戰的血盟：<b>' + wn + '</b> 個' + (truceOn() ? '（城堡帶來的宣戰<b style="color:#86efac">停戰中</b>，城堡數不變就不會再來）' : '') + '。' +
        '<br>消除後這些血盟全部撤回宣戰、仇恨歸零：城堡帶來的宣戰一直到你持有的城堡數再變動為止；因為你殺了他們的人而宣戰的，之後再殺他們的人仇恨又會累積。每個血盟 ' + WAR_COST.dia + ' 龍之鑽石或 ' + WAR_COST.gold.toLocaleString() + ' 金幣。每週五的守城戰、強制宣戰不在這裡。';
      h += K.rowHtml({ key: 'wdia', ico: '', name: '消除宣戰（龍之鑽石）', color: '#fca5a5', desc: wdesc, req: wn ? K.reqTxt(dia(), nd, '龍之鑽石') : '沒有宣戰中的血盟', btns: [['wdia', '消除', wn > 0 && dia() >= nd]] }, 'data-rg');
      h += K.rowHtml({ key: 'wgold', ico: '', name: '消除宣戰（金幣）', color: '#fde68a', desc: '同上。', req: wn ? K.reqTxt(Number(p.gold) || 0, ng, '金幣') : '沒有宣戰中的血盟', btns: [['wgold', '消除', wn > 0 && (Number(p.gold) || 0) >= ng]] }, 'data-rg');
    }
    K.repaint(host, h);
  };
  var embed = function (div) {
    if (!div) return; K.css();
    var host = document.createElement('div'); host.className = 'afk-ax'; host.id = 'afk-rg-embed';
    div.innerHTML = ''; div.appendChild(host); ui.err = '';
    host.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-rg]'); if (!b || b.disabled) return;
      var pay = b.getAttribute('data-rg'), p = P();
      if (pay === 'wdia' || pay === 'wgold') {
        var wn = warN(), cost = pay === 'wdia' ? (wn * WAR_COST.dia).toLocaleString() + ' 顆龍之鑽石' : (wn * WAR_COST.gold).toLocaleString() + ' 金幣';
        if (typeof confirm === 'function' && !confirm('確定要花 ' + cost + '，讓 ' + wn + ' 個血盟撤回宣戰嗎？\n城堡數一變動（打回、攻下新城或又失城）就會失效。')) return;
        ui.err = endWar(pay === 'wdia' ? 'dia' : 'gold') || ''; render(host); return;
      }
      var msg = '確定要花 ' + (pay === 'dia' ? COST.dia + ' 顆龍之鑽石' : COST.gold.toLocaleString() + ' 金幣') + '，讓正義值歸 0、解除紅人追殺嗎？' + (p && Number(p.alignmentValue) > 0 ? '\n（你現在是正義，正義值也會歸 0。）' : '');
      if (typeof confirm === 'function' && !confirm(msg)) return;
      ui.err = purify(pay) || ''; render(host);
    });
    render(host);
  };
  K.addNpc(TOWN, { id: NPC_ID, n: NPC_N, title: TITLE, type: 'quest',
    d: '在席琳神殿為女神的嘆息祈禱的信徒京。花 10 顆龍之鑽石或 100 萬金幣，替你把正義值洗回 0、讓追殺你的紅人散去，而且追殺永久解除；也能替你向對你宣戰的血盟求和。' });
  K.hookNpc(NPC_ID, NPC_N, TITLE, embed);
  W.__afkRedGuard = { endWar: endWar, warN: warN, truceOn: truceOn, NPC_ID: NPC_ID, COST: COST, FOREVER: FOREVER, purify: purify, chasers: chasers, isProtected: isProtected };
})();
