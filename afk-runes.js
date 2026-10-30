/* ============================================================================
 * afk-runes.js — 符文師佐爾頓（說話之島）：星蝕·解符文孔、鑲嵌／拆下符文、哀石兌換（玩家 2026-10-29 晚）
 *
 * 原本叫「蝕刻」，跟無屬性印記的「蝕刻」撞名，改名「星蝕·解」，並從艾格尼絲那裡獨立出來交給符文師。
 * 符文孔（it.sockets：陣列長度＝開了幾孔，內容是符文 id 或 null）：
 *   武器 3 孔：第一孔「墜蝕·解」同一組原版席琳遺骸 8 套（8 部位各 8 件）；第二孔「刻解·骸」同一組夢域遺骸 8 套
 *              （2026-10-30 20:54 起這兩孔只有鑲嵌符文的功能，不再讓刻上的套裝算滿 5 件；開過的孔不能改刻）
 *              第三孔「瘴骸·破」解命石 1
 *   防具 2 孔（盔甲、盾、頭盔、斗篷、手套、長靴、脛甲、T恤）：第一孔夢域遺骸 5 套（8 部位各 5 件，不限套裝組）、第二孔回夢水晶 3
 *   戒指、項鍊、耳環 1 孔：哀石結晶 5
 *   腰帶 3 孔：每孔解命石 1（三孔都是瘴骸·破等級）
 * 鑲嵌：武器＝攻擊、套裝、職業；防具＝減傷、藥水、寵物；飾品與腰帶＝補助。
 *   費用：階段一 哀石水晶 5、階段二 哀石精華 10、階段三 哀石結晶 20。同一件不能鑲兩顆同名符文。
 * 拆下：哀石 500，符文完整取回。
 * 合成（2026-10-29）：同階段符文 3 顆＋哀石結晶 10 → 隨機一顆高一階（階段一→二、二→三）。
 * 兌換：哀石塵埃／哀石碎片／哀石 各 150 → 哀石水晶／哀石精華／哀石結晶；瘴氣魔石 1,000＋骸骨魔石 500＋破空石 100 → 解命石。
 * 升星（2026-10-30 20:54）：★1 哀石結晶 50、★2 解命石 10、★3 兩顆同名 ★2；鑲著的可以直接升。資料在 afk-runedata（STAR_*）。
 * 效果在 afk-runefx。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'runes', name: '符文師佐爾頓（星蝕·解與符文石）', group: '遊戲玩法',
    desc: '說話之島的符文師佐爾頓：武器、防具、飾品、腰帶開星蝕·解符文孔，鑲嵌或拆下符文石，哀石兌換與解命石' });
  if (T && !T.enabled('runes')) return;
  var K = W.__afkNpcKit, SD = W.__afkSherineDream, RD = W.__afkRuneData;
  if (!K || !SD || !RD || !DB || !DB.items) { console.warn('[AFK-runes] 需要 afk-npc-kit、afk-sherine-dream、afk-runedata，略過'); return; }

  var NPC_ID = 'npc_zoldon', NPC_N = '佐爾頓';
  var NAMES = SD.SOCKET_NAMES, PER = SD.ETCH_PER;
  var GROUPS = Object.keys(SD.DN);   // 12 組原版名稱
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = K.esc;
  var uid = function () { return 'RN' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e9).toString(36); };
  var sets = function (p, seteff) { return Math.floor(SD.etchReady(p, seteff) / PER); };
  var ARMOR_SLOTS = { armor: 1, shield: 1, helm: 1, cloak: 1, gloves: 1, boots: 1, shin: 1, tshirt: 1 };
  var kindOf = function (d) {
    if (!d || d.gmOnly) return null;
    if (d.type === 'wpn' && !d.isArrow) return 'weapon';
    if (d.slot === 'belt') return 'belt';
    if (d.slot === 'ring' || d.slot === 'ear' || d.slot === 'amulet') return 'acc';
    if (d.type === 'arm' && ARMOR_SLOTS[d.slot]) return 'armor';
    return null;
  };
  var KINDS = {
    weapon: { n: '武器', max: 3, cats: RD.SLOT_CATS.weapon, names: NAMES },
    armor: { n: '防具', max: 2, cats: RD.SLOT_CATS.armor, names: [NAMES[0], NAMES[1]] },
    acc: { n: '飾品', max: 1, cats: RD.SLOT_CATS.acc, names: [NAMES[0]] },
    belt: { n: '腰帶', max: 3, cats: RD.SLOT_CATS.acc, names: [NAMES[2], NAMES[2], NAMES[2]] }
  };
  var COST = { armor1: 5, armor2: 3, acc: 5, fate: 1, reverie: 'afk_reverie_crystal' };
  var PARTS = SD.PARTS;
  var have = K.have, take = K.take;
  var nm = function (id) { return (DB.items[id] || {}).n || id; };
  var EQ_N = { wpn: '主手', offwpn: '副手', shield: '盾牌', armor: '盔甲', helm: '頭盔', cloak: '斗篷', tshirt: 'T恤', gloves: '手套', boots: '長靴', shin: '脛甲', amulet: '項鍊', belt: '腰帶', ring1: '戒指1', ring2: '戒指2', ring3: '戒指3', ring4: '戒指4', ear1: '耳環1', ear2: '耳環2' };

  // 夢域遺骸（不限組）每個部位持有數
  var dreamPart = function (p, id) { return (p.inv || []).filter(function (it) { return it && it.id === id && SD.isDream(it) && !it.lock; }).reduce(function (n, it) { return n + (Number(it.cnt) || 1); }, 0); };
  var dreamAnySets = function (p) { return Math.min.apply(Math, PARTS.map(function (id) { return dreamPart(p, id); })); };
  var dreamAnyTake = function (p, per) {
    PARTS.forEach(function (id) {
      var need = per;
      var stacks = p.inv.filter(function (it) { return it && it.id === id && SD.isDream(it) && !it.lock; }).sort(function (a, b) { return (Number(b.cnt) || 1) - (Number(a.cnt) || 1); });
      stacks.forEach(function (it) { if (need <= 0) return; var q = Math.min(need, Number(it.cnt) || 1); it.cnt = (Number(it.cnt) || 1) - q; need -= q; if (it.cnt <= 0) p.inv.splice(p.inv.indexOf(it), 1); });
    });
  };

  // ── 選擇裝備 ──
  var ui = { filter: 'all', sel: '', q: '', more: 0, g1: '', g2: '', slot: 0, rune: '', rm: 0, err: '', msg: '' }, PAGE = 60;
  var candidates = function () {
    var p = P(), out = []; if (!p) return out;
    Object.keys(p.eq || {}).forEach(function (k) { var it = p.eq[k], d = it && DB.items[it.id], kd = kindOf(d); if (kd && !it.lock) out.push({ ref: 'eq:' + k, it: kd === 'weapon' ? SD.migrate(it) : it, kind: kd, where: '裝備中・' + (EQ_N[k] || k) }); });
    (p.inv || []).forEach(function (it) { var d = it && DB.items[it.id], kd = kindOf(d); if (kd && !it.lock) out.push({ ref: 'inv:' + it.uid, it: kd === 'weapon' ? SD.migrate(it) : it, kind: kd, where: '背包' + ((Number(it.cnt) || 1) > 1 ? ' ×' + it.cnt : '') }); });
    var rank = function (c) { return (c.ref === 'eq:wpn' ? 100 : 0) + (c.ref.indexOf('eq:') === 0 ? 10 : 0) + (c.it.sockets || []).length; };
    return out.map(function (c, i) { c._i = i; return c; }).sort(function (a, b) { return (rank(b) - rank(a)) || (a._i - b._i); });
  };
  var plain = function (it) { try { return getItemFullName(it).replace(/<[^>]+>/g, ''); } catch (e) { return nm(it.id); } };
  var find = function (ref) { var c = candidates(); for (var i = 0; i < c.length; i++) if (c[i].ref === ref) return c[i]; return null; };
  var selOf = function () { return find(ui.sel); };
  var lastRef = '';
  var resolve = function (ref) {
    var p = P(); if (!p || !ref) return null;
    if (ref.indexOf('eq:') === 0) { lastRef = ref; return p.eq[ref.slice(3)] || null; }
    var u = ref.slice(4), it = p.inv.find(function (x) { return x && x.uid === u; });
    if (!it) return null;
    if ((Number(it.cnt) || 1) > 1) { it.cnt = (Number(it.cnt) || 1) - 1; var one = JSON.parse(JSON.stringify(it)); one.uid = uid(); one.cnt = 1; p.inv.push(one); it = one; }
    lastRef = 'inv:' + it.uid;
    return it;
  };
  var full = function (it) { try { return getItemFullName(it); } catch (e) { return esc(nm(it.id)); } };
  var done = function (msg) {
    try { if (W.__afkRuneFx) W.__afkRuneFx.bump(); } catch (e) {}
    try { logSys(msg); } catch (e) {}
    try { if (typeof recomputeStats === 'function') recomputeStats(); else calcStats(); } catch (e) {}
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    try { saveGame(); } catch (e) {} try { updateUI(); } catch (e) {}
  };
  var socks = function (it) { if (!Array.isArray(it.sockets)) it.sockets = []; return it.sockets; };

  // ── 動作（回傳錯誤訊息，成功回傳 null）──
  var ACT = {
    open1: function (ref, g) {
      var p = P(); if (!p) return '請先進入遊戲。';
      if (GROUPS.indexOf(g) < 0) return '請選一組席琳套裝。';
      var c = find(ref); if (!c || c.kind !== 'weapon') return '先選一把武器。';
      if (c.it.etch) return '第一孔已經開了。';
      if (sets(p, g) < 1) return '需要「' + g + '」席琳遺骸 8 套（八個部位各 ' + PER + ' 件，未上鎖）。';
      var it = resolve(ref); if (!it) return '找不到這把武器。';
      SD.migrate(it); SD.etchTake(p, g);
      var re = !!it.etch; it.etch = g; it._starV = 1;
      if (socks(it).length < 1) it.sockets.push(null);
      done('<span class="c-sherine font-bold">' + NPC_N + '把 8 套「' + esc(g) + '」席琳遺骸碾成星屑，' + (re ? '重新刻進' : '鑿開了') + '武器的第一個符文孔「' + NAMES[0] + '」</span>→ ' + full(it) + '。');
      return null;
    },
    open2: function (ref, g) {
      var p = P(); if (!p) return '請先進入遊戲。';
      if (GROUPS.indexOf(g) < 0) return '請選一組夢域席琳套裝。';
      var c = find(ref); if (!c || c.kind !== 'weapon') return '先選一把武器。';
      if (!c.it.etch) return '要先開第一孔「' + NAMES[0] + '」。';
      var se = g + '夢';
      if (c.it.etchD) return '第二孔已經開了。';
      if (sets(p, se) < 1) return '需要夢域「' + SD.DN[g] + '」席琳遺骸 8 套（八個部位各 ' + PER + ' 件，未上鎖）。';
      var it = resolve(ref); if (!it) return '找不到這把武器。';
      SD.migrate(it); SD.etchTake(p, se);
      var re = !!it.etchD; it.etchD = se; it._starV = 1;
      while (socks(it).length < 2) it.sockets.push(null);
      done('<span class="c-sherine-dream font-bold">夢域的遺骸在' + NPC_N + '手裡發出紅光，' + (re ? '重新刻進' : '鑿開了') + '第二個符文孔「' + NAMES[1] + '」</span>→ ' + full(it) + '。');
      return null;
    },
    // 其餘的孔：武器第三孔、防具兩孔、飾品一孔、腰帶三孔
    open: function (ref) {
      var p = P(); if (!p) return '請先進入遊戲。';
      var c = find(ref); if (!c) return '先選一件裝備。';
      var n = (c.it.sockets || []).length, kd = c.kind, K2 = KINDS[kd];
      if (n >= K2.max) return '孔已經全部打開了。';
      var pay = null, label = '';
      if (kd === 'weapon') {
        if (n < 2) return '武器要先開第一、二孔（用席琳遺骸刻上套裝）。';
        if (have(RD.FATE.id) < COST.fate) return '需要解命石 1。';
        pay = function () { take(RD.FATE.id, COST.fate); }; label = '第三孔「' + NAMES[2] + '」';
      } else if (kd === 'armor') {
        if (n === 0) { if (dreamAnySets(p) < COST.armor1) return '需要夢域遺骸 ' + COST.armor1 + ' 套（八個部位各 ' + COST.armor1 + ' 件，不限套裝組，未上鎖）。'; pay = function () { dreamAnyTake(p, COST.armor1); }; label = '第一孔「' + NAMES[0] + '」'; }
        else { if (have(COST.reverie) < COST.armor2) return '需要回夢水晶 ' + COST.armor2 + '。'; pay = function () { take(COST.reverie, COST.armor2); }; label = '第二孔「' + NAMES[1] + '」'; }
      } else if (kd === 'acc') {
        if (have(RD.CUR[3]) < COST.acc) return '需要哀石結晶 ' + COST.acc + '。';
        pay = function () { take(RD.CUR[3], COST.acc); }; label = '符文孔「' + NAMES[0] + '」';
      } else if (kd === 'belt') {
        if (have(RD.FATE.id) < COST.fate) return '需要解命石 1。';
        pay = function () { take(RD.FATE.id, COST.fate); }; label = '第 ' + (n + 1) + ' 孔「' + NAMES[2] + '」';
      }
      var it = resolve(ref); if (!it) return '找不到這件裝備。';
      pay(); socks(it).push(null);
      done('<span class="text-violet-300 font-bold">' + NPC_N + '替 ' + full(it) + ' 鑿開了' + label + '。</span>');
      return null;
    },
    inlay: function (ref, idx, runeId) {
      var p = P(); if (!p) return '請先進入遊戲。';
      var c = find(ref); if (!c) return '先選一件裝備。';
      var r = RD.byId[runeId]; if (!r) return '請選一顆符文。';
      var s = c.it.sockets || [];
      if (!(idx >= 0 && idx < s.length)) return '這個孔還沒打開。';
      if (s[idx]) return '這個孔已經有符文了，要先拆下來。';
      if (KINDS[c.kind].cats.indexOf(r.cat) < 0) return KINDS[c.kind].n + '只能鑲' + KINDS[c.kind].cats.map(function (k) { return RD.CAT_N[k]; }).join('、') + '類的符文。';
      if (s.some(function (x) { var q = x && RD.byId[x]; return q && q.nk === r.nk; })) return '同一件裝備不能鑲兩顆同名符文。';   // 不同星數也算同名
      if (r.unique) { var eqd = Object.keys(p.eq || {}).some(function (k) { var e = p.eq[k]; return e && e !== c.it && Array.isArray(e.sockets) && e.sockets.indexOf(runeId) >= 0; }); if (eqd) return nm(runeId) + '全身只能裝一顆（身上已經有了）。'; }
      if (have(runeId) < 1) return '背包裡沒有' + nm(runeId) + '（上鎖的不算）。';
      var cur = RD.CUR[r.stage], cost = RD.INLAY[r.stage];
      if (have(cur) < cost) return '需要' + nm(cur) + ' ' + cost + '。';
      var it = resolve(ref); if (!it) return '找不到這件裝備。';
      take(runeId, 1); take(cur, cost);
      socks(it)[idx] = runeId;
      done('<span class="' + RD.STAGE_C[r.stage] + ' font-bold">' + NPC_N + '把' + nm(runeId) + '嵌進了 ' + full(it) + ' 的第 ' + (idx + 1) + ' 孔。</span>');
      return null;
    },
    remove: function (ref, idx) {
      var p = P(); if (!p) return '請先進入遊戲。';
      var c = find(ref); if (!c) return '先選一件裝備。';
      var s = c.it.sockets || [], rid = s[idx];
      if (!rid) return '這個孔沒有符文。';
      if (have(RD.REMOVE[0]) < RD.REMOVE[1]) return '需要' + nm(RD.REMOVE[0]) + ' ' + RD.REMOVE[1] + '。';
      var it = resolve(ref); if (!it) return '找不到這件裝備。';
      take(RD.REMOVE[0], RD.REMOVE[1]);
      it.sockets[idx] = null;
      gainItem(rid, 1, true, true);
      done('<span class="text-slate-200">' + NPC_N + '小心地把' + nm(rid) + '從 ' + full(it) + ' 撬了下來，完好無缺。</span>');
      return null;
    },
    exchange: function (from, all) {
      var to = RD.EXCHANGE[from]; if (!to) return '不能兌換這個。';
      var n = Math.floor(have(from) / RD.EX_RATE); if (!all) n = Math.min(1, n);
      if (n < 1) return '需要' + nm(from) + ' ' + RD.EX_RATE + ' 個。';
      take(from, n * RD.EX_RATE); gainItem(to, n, true, true);
      done('<span class="text-sky-200">' + NPC_N + '把 ' + (n * RD.EX_RATE).toLocaleString() + ' 個' + nm(from) + '凝成了 ' + n + ' 個' + nm(to) + '。</span>');
      return null;
    },
    legend: function (id) {
      var need = (RD.LEGEND || {})[id]; if (!need) return '不能兌換這個。';
      var miss = Object.keys(need).filter(function (k) { return have(k) < need[k]; });
      if (miss.length) return '材料不足：' + miss.map(function (k) { return nm(k) + ' ' + have(k) + '/' + need[k]; }).join('、');
      Object.keys(need).forEach(function (k) { take(k, need[k]); });
      gainItem(id, 1, true, true);
      done('<span class="text-amber-300 font-bold">' + NPC_N + '把解命石與哀石結晶熔進同一塊石頭——' + nm(id) + '亮了起來。</span>');
      return null;
    },
    // 合成：同階段 3 顆（先用數量最多的，盡量保留只有一顆的）＋哀石結晶 10 → 高一階隨機一顆
    combine: function (stage) {
      var CB = RD.COMBINE; stage = Number(stage);
      if (!CB || CB.from.indexOf(stage) < 0) return '這個階段不能合成。';
      var pool = RD.list.filter(function (r) { return r.stage === stage && !r.unique; });
      var cnt = pool.map(function (r) { return { id: r.id, n: have(r.id) }; }).filter(function (x) { return x.n > 0; });
      var tot = cnt.reduce(function (a, x) { return a + x.n; }, 0);
      if (tot < CB.n) return '需要' + RD.STAGE_N[stage] + '的符文 ' + CB.n + ' 顆（背包裡未上鎖的有 ' + tot + ' 顆）。';
      if (have(CB.cost[0]) < CB.cost[1]) return '需要' + nm(CB.cost[0]) + ' ' + CB.cost[1] + '。';
      var used = [];
      for (var i = 0; i < CB.n; i++) { cnt.sort(function (a, b) { return b.n - a.n; }); cnt[0].n--; used.push(cnt[0].id); }
      used.forEach(function (id) { take(id, 1); }); take(CB.cost[0], CB.cost[1]);
      var up = RD.list.filter(function (r) { return r.stage === stage + 1 && !r.unique; }), got = up[Math.floor(Math.random() * up.length)];
      gainItem(got.id, 1, true, true);
      done('<span class="' + RD.STAGE_C[got.stage] + ' font-bold">' + NPC_N + '把 ' + used.map(nm).join('、') + ' 熔在一起——' + nm(got.id) + '亮了起來。</span>');
      return got.id;
    },
    // 升星（玩家 2026-10-30 20:54）：loc＝'inv:<符文id>'（背包）或 'sock:<裝備ref>:<孔>'（鑲著的直接升）
    star: function (loc) {
      var p = P(); if (!p) return '請先進入遊戲。';
      var m = /^sock:(.+):(\d+)$/.exec(String(loc || '')), rid = null, idx = -1;
      if (m) { var c = find(m[1]); if (!c) return '找不到這件裝備。'; idx = Number(m[2]); rid = (c.it.sockets || [])[idx]; if (!rid) return '這個孔沒有符文。'; }
      else if (String(loc || '').indexOf('inv:') === 0) { rid = String(loc).slice(4); if (have(rid) < 1) return '背包裡沒有' + nm(rid) + '（上鎖的不算）。'; }
      var r = rid && RD.byId[rid]; if (!r) return '請選一顆符文。';
      var base = r.base ? RD.byId[r.base] : r, cur = Number(r.star) || 0;
      if (!RD.starOk(base)) return RD.WIP_STAR[base.key] ? nm(base.id) + '的效果還在製作中，做好後開放升星。' : nm(base.id) + '不能升星。';
      if (cur >= 3) return '已經是 ★3 了。';
      var next = RD.starId(base.id, cur + 1);
      if (cur < 2) {
        var cost = RD.STAR_COST[cur + 1], miss = Object.keys(cost).filter(function (k) { return have(k) < cost[k]; });
        if (miss.length) return '材料不足：' + miss.map(function (k) { return nm(k) + ' ' + have(k) + '/' + cost[k]; }).join('、');
        Object.keys(cost).forEach(function (k) { take(k, cost[k]); });
      } else {
        if (have(rid) < (m ? 1 : 2)) return '★3 要兩顆同名 ★2 合成：背包裡還需要一顆' + nm(rid) + '（未上鎖）。';
        take(rid, 1);   // 合成用掉的另一顆
      }
      if (m) { var it = resolve(m[1]); if (!it) return '找不到這件裝備。'; socks(it)[idx] = next; }
      else { take(rid, 1); gainItem(next, 1, true, true); }
      done('<span class="' + RD.STAGE_C[r.stage] + ' font-bold">' + NPC_N + '在' + nm(rid) + '上刻下新的星紋——' + nm(next) + '。</span>' + (m ? '（鑲著直接升星）' : ''));
      return null;
    },
    fate: function () {
      var need = RD.FATE.need, miss = Object.keys(need).filter(function (id) { return have(id) < need[id]; });
      if (miss.length) return '材料不足：' + miss.map(function (id) { return nm(id) + ' ' + have(id) + '/' + need[id]; }).join('、');
      Object.keys(need).forEach(function (id) { take(id, need[id]); });
      gainItem(RD.FATE.id, 1, true, true);
      done('<span class="text-yellow-300 font-bold">三種魔石在' + NPC_N + '的刻刀下合而為一——解命石。</span>');
      return null;
    }
  };

  // ── 物品簽章、說明 ──
  var sockText = function (it) {
    var d = DB.items[it.id], kd = kindOf(d); if (!kd || !Array.isArray(it.sockets) || !it.sockets.length) return '';
    var names = KINDS[kd].names;
    return it.sockets.map(function (rid, i) { var r = rid && RD.byId[rid]; return '<span class="' + (r ? RD.STAGE_C[r.stage] : 'text-slate-400') + '">' + names[i] + '：' + (r ? esc(nm(rid)) : '（空）') + '</span>'; }).join('、');
  };
  if (typeof W.itemSig === 'function') { var oSig = W.itemSig; W.itemSig = function (it) { var s0 = oSig.apply(this, arguments); return (it && Array.isArray(it.sockets) && it.sockets.length) ? s0 + '|RS' + it.sockets.map(function (x) { return x || '-'; }).join(',') : s0; }; }
  if (typeof W.buildItemDescHTML === 'function') {
    var oDesc = W.buildItemDescHTML;
    W.buildItemDescHTML = function (it) {
      var h = oDesc.apply(this, arguments);
      try {
        var t = it && sockText(it);
        if (t) {
          var rs = it.sockets.filter(Boolean).map(function (rid) { var r = RD.byId[rid]; return r ? '<span class="' + RD.STAGE_C[r.stage] + '">' + esc(nm(rid)) + '</span>：' + esc(r.d) : ''; }).filter(Boolean);
          var ws = W.__afkRuneFx && W.__afkRuneFx.wordsOf ? W.__afkRuneFx.wordsOf(it) : [];
          h = '<span class="text-violet-300 font-bold">◇ 符文孔：</span>' + t + '<br>' + (rs.length ? '<span class="text-slate-300 text-sm">' + rs.join('<br>') + '</span><br>' : '')
            + (ws.length ? '<span class="text-amber-300 text-sm">' + ws.map(function (w) { return '符文之語「' + esc(w.n) + '」：' + esc(w.d); }).join('<br>') + '</span><br>' : '') + h;
        }
      } catch (e) {}
      return h;
    };
  }
  (W.__afkAxLines = W.__afkAxLines || []).push(function (it) { var t = it && sockText(it); return t ? '<span class="text-violet-300">符文孔：</span>' + t : null; });

  // ── 面板 ──
  var sockChips = function (c) {
    var it = c.it, n = (it.sockets || []).length, K2 = KINDS[c.kind];
    return '<div class="ax-socks">' + K2.names.map(function (name, i) {
      if (i >= n) return '<span class="ax-sock' + (c.kind === 'weapon' && i === 2 ? ' lock' : '') + '">◇ ' + name + '（未開）</span>';
      var rid = it.sockets[i], extra = '';   // 2026-10-30：孔只鑲符文，不再顯示刻上的套裝組
      return '<span class="ax-sock ' + (rid ? 'filled' : 'open') + '">' + (rid ? '◆ ' : '○ ') + name + extra + (rid ? '：' + esc(nm(rid)) : '（空）') + '</span>';
    }).join('') + '</div>';
  };
  var groupSelect = function (id, dream, cur) {
    var p = P();
    var opts = GROUPS.map(function (g) { var n = sets(p, dream ? g + '夢' : g); return { g: g, n: n, t: (dream ? SD.DN[g] + '（夢域・' + g + '）' : g) + '　可做 ' + n + ' 次' }; }).sort(function (a, b) { return b.n - a.n; });
    if (!cur || !opts.some(function (o) { return o.g === cur; })) cur = opts[0] && opts[0].n > 0 ? opts[0].g : (opts[0] || {}).g;
    return { cur: cur, html: '<select id="' + id + '" aria-label="選擇套裝">' + opts.map(function (o) { return '<option value="' + o.g + '"' + (o.g === cur ? ' selected' : '') + '>' + esc(o.t) + '</option>'; }).join('') + '</select>' };
  };
  var remIco = function () { return K.icoTag(K.iconUrl(DB.items.rem_heart || DB.items.rem_claw), '', false); };
  var FILTERS = { all: '全部', weapon: '武器', armor: '防具', acc: '飾品', belt: '腰帶' };
  var render = function (box) {
    var p = P(); if (!box || !p) return;
    var x = selOf(); if (!x) ui.sel = '';
    var h = '<p class="ax-lore">「星辰墜落時會在大地刻下傷痕，席琳的遺骸也一樣。把它們交給我，我替你的裝備鑿出能容納星蝕的孔，再把符文嵌進去。」——符文師 ' + NPC_N + '</p>'
      + K.matBar([RD.CUR[1], RD.CUR[2], RD.CUR[3], RD.REMOVE[0], RD.FATE.id, COST.reverie])
      + '<div class="ax-h">① 選擇裝備</div>'
      + '<div class="ax-filter">' + Object.keys(FILTERS).map(function (k) { return '<button type="button" data-zof="' + k + '"' + (ui.filter === k ? ' class="on"' : '') + '>' + FILTERS[k] + '</button>'; }).join('')
      + '<input id="afk-zo-q" type="search" placeholder="搜尋裝備名稱" aria-label="搜尋裝備名稱" value="' + esc(ui.q) + '" style="flex:1 1 140px;min-width:120px;background:#0f172a;color:#fff;border:1px solid #475569;border-radius:6px;padding:4px 8px;font-size:13px"></div>';
    var q = String(ui.q || '').trim(), all = candidates().filter(function (c) { return (ui.filter === 'all' || c.kind === ui.filter) && (!q || plain(c.it).indexOf(q) >= 0); });
    var lim = PAGE * (1 + ui.more), list = all.slice(0, lim);
    h += '<div class="ax-list">' + (list.length ? list.map(function (c) {
      var n = (c.it.sockets || []).length, f = (c.it.sockets || []).filter(Boolean).length;
      return '<div class="ax-eq' + (c.ref === ui.sel ? ' on' : '') + '" data-zosel="' + esc(c.ref) + '">' + K.invIco(c.it, c.ref.indexOf('eq:') === 0 ? 'eq' : 'inv')
        + '<div style="min-width:0"><div>' + K.fullName(c.it) + '</div><div class="ax-where">' + esc(c.where) + '・' + KINDS[c.kind].n + (n ? '　・符文孔 ' + n + '／' + KINDS[c.kind].max + (f ? '（已鑲 ' + f + '）' : '') : '') + '</div></div></div>';
    }).join('') + (all.length > lim ? '<div class="ax-eq ax-where" data-zomore="1" style="justify-content:center;color:#fde68a">還有 ' + (all.length - lim).toLocaleString() + ' 件，點這裡多顯示 ' + PAGE + ' 件，或用搜尋縮小範圍</div>' : '') : '<div class="ax-eq ax-where">沒有可以開孔的裝備（上鎖的不會列出）。</div>') + '</div>';
    if (x) {
      var ws = W.__afkRuneFx && W.__afkRuneFx.wordsOf ? W.__afkRuneFx.wordsOf(x.it) : [];
      h += '<div class="ax-h">已選擇</div><div class="ax-sel">' + K.invIco(x.it, x.ref.indexOf('eq:') === 0 ? 'eq' : 'inv') + '<div style="min-width:0"><div>' + K.fullName(x.it) + '</div><div class="ax-where">' + esc(x.where) + '・' + KINDS[x.kind].n + '（可鑲：' + KINDS[x.kind].cats.map(function (k) { return RD.CAT_N[k]; }).join('、') + '）</div>'
        + sockChips(x) + (ws.length ? '<div class="ax-note" style="color:#fcd34d">符文之語：' + ws.map(function (w) { return '「' + esc(w.n) + '」' + esc(w.d); }).join('；') + '</div>' : '')
        + (x.kind === 'weapon' && x.ref !== 'eq:wpn' ? '<div class="ax-note">武器要裝在主手，符文才會生效。</div>' : '') + '</div></div>';
    }
    h += '<div class="ax-err">' + esc(ui.err) + '</div><div class="ax-msg">' + ui.msg + '</div>';
    h += '<div class="ax-h">② 開孔與鑲嵌</div>';
    var noSel = '先在上面選一件裝備', it = x && x.it, n = it ? (it.sockets || []).length : 0;
    if (!x || x.kind === 'weapon') {
      var s1 = groupSelect('afk-zo-g1', false, ui.g1); ui.g1 = s1.cur;
      var s2 = groupSelect('afk-zo-g2', true, ui.g2); ui.g2 = s2.cur;
      var have1 = sets(p, ui.g1), have2 = sets(p, ui.g2 + '夢');
      h += K.rowHtml({ key: 'open1', ico: remIco(), name: '武器第一孔「' + NAMES[0] + '」', color: '#4ade80',
        desc: '消耗同一組原版席琳遺骸 8 套（爪、眼、血、肉、心、骨、牙、鱗各 ' + PER + ' 件），鑿開第一個符文孔（只用來鑲嵌符文）。',
        req: K.reqTxt(have1, 1, '套 × 8（' + esc(ui.g1) + '）'), why: !x ? noSel : (it.etch ? '已經開了' : ''),
        pick: s1.html, btns: [['open1', '開孔', have1 >= 1 && !(it && it.etch)]] }, 'data-zo');
      h += K.rowHtml({ key: 'open2', ico: remIco(), name: '武器第二孔「' + NAMES[1] + '」', color: '#fb7185',
        desc: '要先開第一孔。消耗同一組夢域席琳遺骸 8 套，鑿開第二個符文孔（只用來鑲嵌符文）。',
        req: K.reqTxt(have2, 1, '套 × 8（夢域' + esc(SD.DN[ui.g2] || '') + '）'), why: !x ? noSel : !it.etch ? '要先開第一孔「' + NAMES[0] + '」' : (it.etchD ? '已經開了' : ''), off: !!(x && !it.etch),
        pick: s2.html, btns: [['open2', '開孔', have2 >= 1 && !(it && it.etchD)]] }, 'data-zo');
      h += K.rowHtml({ key: 'open3', ico: K.itemIco(RD.FATE.id), name: '武器第三孔「' + NAMES[2] + '」', color: '#facc15',
        desc: '要先開第一、二孔。解命石 1 顆鑿開最後一個孔。',
        req: K.reqTxt(have(RD.FATE.id), 1, '解命石'), why: !x ? noSel : n < 2 ? '要先開第一、二孔' : n >= 3 ? '已經打開了' : '', off: !!(x && n < 2), btns: [['open', '開孔', have(RD.FATE.id) >= 1]] }, 'data-zo');
    } else if (x.kind === 'armor') {
      var ds = dreamAnySets(p);
      h += K.rowHtml({ key: 'armor', ico: n === 0 ? remIco() : K.itemIco(COST.reverie), name: n === 0 ? '防具第一孔「' + NAMES[0] + '」' : '防具第二孔「' + NAMES[1] + '」', color: '#c4b5fd',
        desc: '第一孔：夢域遺骸 ' + COST.armor1 + ' 套（八個部位各 ' + COST.armor1 + ' 件，不限套裝組）；第二孔：回夢水晶 ' + COST.armor2 + ' 個。防具的孔不會刻上套裝，只用來鑲減傷、藥水、寵物類符文。',
        req: n === 0 ? K.reqTxt(ds, COST.armor1, '套夢域遺骸') : K.reqTxt(have(COST.reverie), COST.armor2, '回夢水晶'), why: n >= 2 ? '兩個孔都打開了' : '',
        btns: [['open', '開孔', n === 0 ? ds >= COST.armor1 : have(COST.reverie) >= COST.armor2]] }, 'data-zo');
    } else if (x.kind === 'acc') {
      h += K.rowHtml({ key: 'acc', ico: K.itemIco(RD.CUR[3]), name: '飾品符文孔「' + NAMES[0] + '」', color: '#fda4af', desc: '戒指、項鍊、耳環各 1 孔，哀石結晶 ' + COST.acc + ' 個。只能鑲補助類符文。',
        req: K.reqTxt(have(RD.CUR[3]), COST.acc, '哀石結晶'), why: n >= 1 ? '已經打開了' : '', btns: [['open', '開孔', have(RD.CUR[3]) >= COST.acc]] }, 'data-zo');
    } else if (x.kind === 'belt') {
      h += K.rowHtml({ key: 'belt', ico: K.itemIco(RD.FATE.id), name: '腰帶第 ' + Math.min(3, n + 1) + ' 孔「' + NAMES[2] + '」', color: '#facc15', desc: '腰帶 3 孔，每孔解命石 1 顆（三孔都是瘴骸·破等級）。只能鑲補助類符文。',
        req: K.reqTxt(have(RD.FATE.id), 1, '解命石'), why: n >= 3 ? '三個孔都打開了' : '', btns: [['open', '開孔', have(RD.FATE.id) >= 1]] }, 'data-zo');
    }
    // 鑲嵌
    var empties = it ? (it.sockets || []).map(function (r, i) { return r ? -1 : i; }).filter(function (i) { return i >= 0; }) : [];
    if (empties.indexOf(ui.slot) < 0) ui.slot = empties.length ? empties[0] : 0;
    var cats = x ? KINDS[x.kind].cats : [];
    var owned = Object.keys(RD.byId).map(function (k) { return RD.byId[k]; }).filter(function (r) { return (!x || cats.indexOf(r.cat) >= 0) && have(r.id) > 0; });   // 含升星過的
    if (!owned.some(function (r) { return r.id === ui.rune; })) ui.rune = owned.length ? owned[0].id : '';
    var rr = RD.byId[ui.rune], cur = rr ? RD.CUR[rr.stage] : RD.CUR[1], cost = rr ? RD.INLAY[rr.stage] : 0;
    var pick = '<select id="afk-zo-slot" aria-label="鑲在第幾孔">' + (empties.length ? empties.map(function (i) { return '<option value="' + i + '"' + (i === ui.slot ? ' selected' : '') + '>第 ' + (i + 1) + ' 孔</option>'; }).join('') : '<option value="">沒有空孔</option>') + '</select>'
      + '<select id="afk-zo-rune" aria-label="選擇符文">' + (owned.length ? owned.map(function (r) { return '<option value="' + r.id + '"' + (r.id === ui.rune ? ' selected' : '') + '>' + esc(nm(r.id)) + '（' + RD.STAGE_N[r.stage] + '・' + RD.CAT_N[r.cat] + '）×' + have(r.id) + '</option>'; }).join('') : '<option value="">沒有可鑲的符文</option>') + '</select>';
    h += K.rowHtml({ key: 'inlay', ico: rr ? K.itemIco(rr.id) : K.icoTag('', '', false), name: '鑲嵌符文', color: '#a78bfa',
      desc: (rr ? '<b>' + esc(nm(rr.id)) + '</b>：' + esc(rr.d) + '<br>' : '') + '費用：階段一 哀石水晶 5、階段二 哀石精華 10、階段三 哀石結晶 20、傳說 哀石結晶 40。同一件裝備不能鑲兩顆同名符文；同名符文全身最多算 2 顆（傳說符文全身只能 1 顆）。',
      req: rr ? K.reqTxt(have(cur), cost, nm(cur)) : '', why: !x ? noSel : !(it.sockets || []).length ? '這件還沒有開孔' : !empties.length ? '沒有空孔（要先拆下符文）' : !owned.length ? '背包裡沒有能鑲在' + KINDS[x.kind].n + '的符文' : '',
      pick: pick, btns: [['inlay', '鑲嵌', !!rr && have(cur) >= cost]] }, 'data-zo');
    // 拆下
    var filled = it ? (it.sockets || []).map(function (r, i) { return r ? i : -1; }).filter(function (i) { return i >= 0; }) : [];
    if (filled.indexOf(ui.rm) < 0) ui.rm = filled.length ? filled[0] : 0;
    h += K.rowHtml({ key: 'remove', ico: K.itemIco(RD.REMOVE[0]), name: '拆下符文', color: '#5eead4', desc: '哀石 ' + RD.REMOVE[1] + ' 個，把符文完整拆下來放回背包。',
      req: K.reqTxt(have(RD.REMOVE[0]), RD.REMOVE[1], nm(RD.REMOVE[0])), why: !x ? noSel : !filled.length ? '這件沒有鑲符文' : '',
      pick: '<select id="afk-zo-rm" aria-label="拆下第幾孔">' + (filled.length ? filled.map(function (i) { return '<option value="' + i + '"' + (i === ui.rm ? ' selected' : '') + '>第 ' + (i + 1) + ' 孔：' + esc(nm(it.sockets[i])) + '</option>'; }).join('') : '<option value="">—</option>') + '</select>',
      btns: [['remove', '拆下', have(RD.REMOVE[0]) >= RD.REMOVE[1]]] }, 'data-zo');
    // 兌換
    h += '<div class="ax-h">③ 兌換</div>';
    Object.keys(RD.EXCHANGE).forEach(function (from) {
      var to = RD.EXCHANGE[from], hv = have(from);
      h += K.rowHtml({ key: 'ex-' + from, ico: K.itemIco(to), name: nm(to), color: '#bae6fd', desc: nm(from) + ' ' + RD.EX_RATE + ' 個換 1 個。' + (DB.items[from] ? '（' + esc(String(DB.items[from].d).replace(/。.*$/, '')) + '）' : ''),
        req: K.reqTxt(hv, RD.EX_RATE, nm(from)), btns: [['ex1:' + from, '換 1 個', hv >= RD.EX_RATE], ['exAll:' + from, '全部換', hv >= RD.EX_RATE]] }, 'data-zo');
    });
    var need = RD.FATE.need, okF = Object.keys(need).every(function (id) { return have(id) >= need[id]; });
    h += K.rowHtml({ key: 'fate', ico: K.itemIco(RD.FATE.id), name: '解命石', color: '#facc15', desc: '瘴氣魔石、骸骨魔石、破空石合成。解命石打開瘴骸·破等級的孔（武器第三孔、腰帶三孔）。',
      req: Object.keys(need).map(function (id) { return K.reqTxt(have(id), need[id], nm(id)); }).join('　'), btns: [['fate', '合成', okF]] }, 'data-zo');
    if (RD.COMBINE) RD.COMBINE.from.forEach(function (st) {
      var CB = RD.COMBINE, tot = RD.list.filter(function (r) { return r.stage === st && !r.unique; }).reduce(function (a, r) { return a + have(r.id); }, 0);
      h += K.rowHtml({ key: 'cb-' + st, ico: K.itemIco(RD.BOX[st + 1] || RD.BOX[st]), name: '合成：' + RD.STAGE_N[st] + ' → ' + RD.STAGE_N[st + 1], color: '#c4b5fd',
        desc: RD.STAGE_N[st] + '的符文任意 ' + CB.n + ' 顆＋' + nm(CB.cost[0]) + ' ' + CB.cost[1] + ' → 隨機一顆' + RD.STAGE_N[st + 1] + '的符文。先用掉數量最多的（重複的），盡量留下只有一顆的。',
        req: K.reqTxt(tot, CB.n, RD.STAGE_N[st] + '符文') + '　' + K.reqTxt(have(CB.cost[0]), CB.cost[1], nm(CB.cost[0])), btns: [['cb:' + st, '合成', tot >= CB.n && have(CB.cost[0]) >= CB.cost[1]]] }, 'data-zo');
    });
    Object.keys(RD.LEGEND || {}).forEach(function (id) {
      var nd = RD.LEGEND[id], ok = Object.keys(nd).every(function (k) { return have(k) >= nd[k]; }), r = RD.byId[id];
      h += K.rowHtml({ key: 'lg-' + id, ico: K.itemIco(id), name: nm(id), color: '#fcd34d', desc: '傳說符文：' + esc(r ? r.d : ''),
        req: Object.keys(nd).map(function (k) { return K.reqTxt(have(k), nd[k], nm(k)); }).join('　'), btns: [['lg:' + id, '兌換', ok]] }, 'data-zo');
    });
    // 升星
    h += '<div class="ax-h">④ 符文升星</div>';
    var stars = [], seenInv = {};
    (p.inv || []).forEach(function (q) { var r = q && !q.lock && RD.byId[q.id]; if (!r || seenInv[q.id]) return; var bs = r.base ? RD.byId[r.base] : r; if (!RD.starOk(bs) || (r.star || 0) >= 3) return; seenInv[q.id] = 1; stars.push({ loc: 'inv:' + q.id, r: r, bs: bs, where: '背包 ×' + have(q.id) }); });
    candidates().forEach(function (c) { (c.it.sockets || []).forEach(function (rid, i) { var r = rid && RD.byId[rid]; if (!r) return; var bs = r.base ? RD.byId[r.base] : r; if (!RD.starOk(bs) || (r.star || 0) >= 3) return; stars.push({ loc: 'sock:' + c.ref + ':' + i, r: r, bs: bs, where: c.where + '・' + plain(c.it) + ' 第 ' + (i + 1) + ' 孔' }); }); });
    if (!stars.length) h += '<div class="ax-note">背包和裝備上沒有可以升星的符文。</div>';
    stars.slice(0, 40).forEach(function (x) {
      var cur = Number(x.r.star) || 0, nx = cur + 1, cost = RD.STAR_COST[nx], req, ok;
      if (cost) { req = Object.keys(cost).map(function (k) { return K.reqTxt(have(k), cost[k], nm(k)); }).join('　'); ok = Object.keys(cost).every(function (k) { return have(k) >= cost[k]; }); }
      else { var need3 = x.loc.indexOf('inv:') === 0 ? 2 : 1, h3 = have(x.r.id); req = K.reqTxt(h3, need3, nm(x.r.id) + '（背包）'); ok = h3 >= need3; }
      h += K.rowHtml({ key: 'st-' + x.loc, ico: K.itemIco(x.r.id), name: nm(x.r.id) + ' → ' + RD.STARS[nx], color: '#fde68a',
        desc: esc(x.where) + '<br>' + esc(RD.STAR_TXT[x.bs.key][nx - 1]) + (nx === 3 ? '（兩顆同名 ★2 合成一顆）' : ''), req: req, btns: [['st:' + x.loc, '升星', ok]] }, 'data-zo');
    });
    if (stars.length > 40) h += '<div class="ax-note">還有 ' + (stars.length - 40) + ' 顆，先升上面的。</div>';
    h += '<div class="ax-note">★1 哀石結晶 50、★2 解命石 10、★3 兩顆同名 ★2 合成。魂、傳說符文不能升星。鑲著的符文可以直接升星（★3 另一顆要在背包）。符文之語不跟星數。</div>';
    // 職業符文：指定技能
    var FX = W.__afkRuneFx, cr = FX && FX.classRune ? FX.classRune(p) : null, rs = FX && FX.skillsOf ? FX.skillsOf(p) : { main: '', cd: '' };
    var mySk = (p.skills || []).filter(function (id) { return DB.skills[id] && !DB.skills[id].passive; });
    var opt = function (cur) { return '<option value="">（不指定）</option>' + mySk.map(function (id) { return '<option value="' + esc(id) + '"' + (id === cur ? ' selected' : '') + '>' + esc(DB.skills[id].n) + '</option>'; }).join(''); };
    h += '<div class="ax-h">⑤ 職業符文：指定技能</div>'
      + '<div class="ax-note">' + (cr ? '主手鑲著<b>' + esc(nm(cr.id)) + '</b>：' : '主手武器鑲上自己職業的職業符文才有效。') + '傷害格＝職業符文的技能（增益到期自動重放、攻擊每 8 秒自動施放），也是專精、極意、王道的指定技能；冷卻格＝覺醒的指定技能。</div>'
      + '<div class="ax-filter"><label style="font-size:13px">傷害格 <select id="afk-zo-skm" aria-label="傷害格">' + opt(rs.main) + '</select></label>'
      + '<label style="font-size:13px">冷卻格 <select id="afk-zo-skc" aria-label="冷卻格">' + opt(rs.cd) + '</select></label></div>';
    h += '<div class="ax-note">只用背包裡未上鎖的材料。武器的符文只在主手生效；防具、飾品、腰帶裝備在身上就生效。</div>';
    K.repaint(box, h, '.ax-list');
  };
  var bind = function (host) {
    host.addEventListener('click', function (ev) {
      var f = ev.target.closest('[data-zof]'); if (f) { ui.filter = f.getAttribute('data-zof'); ui.more = 0; ui.err = ''; render(host); return; }
      if (ev.target.closest('[data-zomore]')) { ui.more++; render(host); return; }
      var s = ev.target.closest('[data-zosel]'); if (s) { ui.sel = s.getAttribute('data-zosel'); ui.err = ''; ui.msg = ''; render(host); return; }
      var b = ev.target.closest('button[data-zo]'); if (!b || b.disabled) return;
      var a = b.getAttribute('data-zo'), err = null; lastRef = '';
      if (a === 'open1') err = ACT.open1(ui.sel, ui.g1);
      else if (a === 'open2') err = ACT.open2(ui.sel, ui.g2);
      else if (a === 'open') err = ACT.open(ui.sel);
      else if (a === 'inlay') err = ACT.inlay(ui.sel, Number(ui.slot), ui.rune);
      else if (a === 'remove') err = ACT.remove(ui.sel, Number(ui.rm));
      else if (a === 'fate') err = ACT.fate();
      else if (a.indexOf('st:') === 0) err = ACT.star(a.slice(3));
      else if (a.indexOf('lg:') === 0) err = ACT.legend(a.slice(3));
      else if (a.indexOf('cb:') === 0) { err = ACT.combine(a.slice(3)); if (err && RD.byId[err]) err = null; }
      else if (a.indexOf('ex1:') === 0) err = ACT.exchange(a.slice(4), false);
      else if (a.indexOf('exAll:') === 0) err = ACT.exchange(a.slice(6), true);
      ui.err = err || ''; ui.msg = err ? '' : '完成了。';
      if (!err && lastRef) ui.sel = lastRef;
      render(host);
    });
    host.addEventListener('change', function (ev) {
      var id = ev.target.id, v = ev.target.value;
      if (id === 'afk-zo-skm' || id === 'afk-zo-skc') { var pp = P(), FXs = W.__afkRuneFx; if (pp && FXs && FXs.skillsOf) { FXs.skillsOf(pp)[id === 'afk-zo-skm' ? 'main' : 'cd'] = v; try { saveGame(); } catch (e) {} } render(host); return; }
      if (id === 'afk-zo-g1') ui.g1 = v; else if (id === 'afk-zo-g2') ui.g2 = v; else if (id === 'afk-zo-slot') ui.slot = Number(v); else if (id === 'afk-zo-rune') ui.rune = v; else if (id === 'afk-zo-rm') ui.rm = Number(v); else return;
      render(host);
    });
    var t = 0;
    host.addEventListener('input', function (ev) {
      if (ev.target.id !== 'afk-zo-q') return;
      ui.q = ev.target.value; ui.more = 0; clearTimeout(t);
      t = setTimeout(function () { render(host); var q = host.querySelector('#afk-zo-q'); if (q) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (e) {} } }, 250);
    });
  };
  var embed = function (div) {
    if (!div) return; K.css();
    var host = document.createElement('div'); host.className = 'afk-ax'; host.id = 'afk-zo-embed';
    div.innerHTML = ''; div.appendChild(host);
    ui.err = ''; ui.msg = '';
    if (!ui.sel) { var p = P(); if (p && p.eq && kindOf(p.eq.wpn && DB.items[p.eq.wpn.id]) === 'weapon') ui.sel = 'eq:wpn'; }
    render(host); bind(host);
  };
  K.addNpc('town_talking', { id: NPC_ID, n: NPC_N, title: '符文師', type: 'runesmith',
    d: '流浪到說話之島的符文師佐爾頓，能替武器、防具、飾品、腰帶鑿出「星蝕·解」符文孔，鑲嵌、拆下符文石，也能替符文升星。' });
  K.hookNpc(NPC_ID, NPC_N, '符文師', embed);
  W.__afkRunes = { NPC_ID: NPC_ID, act: ACT, ui: ui, embed: embed, render: render, candidates: candidates, kindOf: kindOf, KINDS: KINDS, COST: COST };
  console.log('[AFK-runes] 已啟用：說話之島符文師佐爾頓（星蝕·解、符文石）');
})();
