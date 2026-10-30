/* ============================================================================
 * afk-junkquest.js — 古物學者的委託（玩家 2026-10-27：雜項素材不該只是打好玩的，改成有劇情的委託，
 *   分新手〔Lv60 以下〕／中階〔Lv60 以上〕／高階〔王裝〕三階）
 *
 * ‧雜項素材＝透視鏡匯入、原本只能精煉成魔法結晶體的素材（綠色布料、麵粉、各種靈魂…，約 200 種）。
 *   afk-ttmi-items 依掉落怪物的等級分成三階、只能打怪取得（洛依不賣）。
 * ‧奇岩「古物學者 塞勒斯」：
 *   1. 劇情委託：每階三章，依序完成；每章指定三種該階素材，交了就給一件該階裝備，並推進故事。
 *      新手篇隨時可做；中階篇要新手篇讀完＋Lv60；高階篇要中階篇讀完＋Lv80。
 *   2. 常駐委託：讀完該階劇情後開放，隨機指定該階素材（新手 2 種×10、中階 3 種×15、高階 3 種×25），
 *      交付得到一件該階隨機裝備（只抽自己職業能穿的）；可以換一張（每 5 分鐘一次）。
 * ‧獎勵裝備（都是透視鏡匯入的裝備）：新手＝普通裝備（價值不超過遊戲本身商店最貴的裝備）；
 *   中階＝價值到 50 萬的高階裝備（英雄系以下）；高階＝價值 50 萬以上的王裝（真冥皇、英雄系、巴拉卡斯飾品…）的「殘缺的」仿品（能力減半）。
 * ‧每階素材的說明後面會加上「古物學者委託・○○材料」，滑鼠指到就知道用途。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES, X = W.AFK_TTMI_ITEMS;
  if (T && T.register) T.register({ id: 'junkquest', name: '古物學者的委託', desc: '奇岩的古物學者用雜項素材換裝備，分新手／中階／高階三段劇情與常駐委託', group: '遊戲內容' });
  var on = function () { return (!T || T.enabled('junkquest')) && !!X && (!X.enabled || X.enabled()); };
  if (!X || typeof DB === 'undefined' || !DB.towns) return;
  var NPC = 'npc_junk_scholar', NAME = '古物學者 塞勒斯', TITLE = '雜項委託', TOWN = DB.towns.town_giran ? 'town_giran' : Object.keys(DB.towns)[0];
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var num = function (v) { return Number(v) || 0; };

  var TIER = [null,
    { n: '新手', lv: 0, story: 5, bounty: [2, 10], c: '#86efac' },
    { n: '中階', lv: 60, story: 10, bounty: [3, 15], c: '#7dd3fc' },
    { n: '高階', lv: 80, story: 20, bounty: [3, 25], c: '#fca5a5' }];
  var STORY = [null, {
    t: '新手篇・舊物的低語', ch: [
      ['學者的請託', '「旅人，你知道冒險者丟在路邊的破布、空瓶，其實都記著他們走過的路嗎？」塞勒斯推了推眼鏡。「我在寫一本《亞丁拾遺錄》，缺的正是這些沒人要的東西。替我撿一些回來吧。」'],
      ['帳本裡的名字', '塞勒斯把你帶回的東西一件件攤在桌上，從布料的纖維裡挑出一根金線。「這是古魯丁村裁縫的手法……三十年前她為一支遠征隊縫過披風，那支隊伍再也沒有回來。」他翻開一本泛黃的帳本，「再多帶一些，我想知道他們走到了哪裡。」'],
      ['第一份研究筆記', '「找到了。」塞勒斯指著地圖上一處被墨水塗掉的地方。「遠征隊最後一次補給，就在說話之島北邊的洞窟。」他把一件保存完好的裝備交給你，「這是他們留下的，現在它該屬於還在路上的人。」']
    ] }, {
    t: '中階篇・失落的工坊', ch: [
      ['熔爐的灰', '「遠征隊的鐵匠叫做巴爾多，」塞勒斯攤開一張燒焦的設計圖，「他在龍之谷附近有一座工坊，後來整座山谷被燒成了焦土。」他需要更深處的素材，才能拼湊出那座工坊的位置。'],
      ['工匠的印記', '每一件你帶回的素材上，都有一個被刻意磨掉的印記。塞勒斯用炭筆拓下來，拼成一枚完整的徽章——那不是鐵匠的記號，而是某個騎士團的紋章。「巴爾多不是普通的鐵匠。他在替誰打造武器？」'],
      ['重燃的爐火', '工坊的位置終於確定了，但裡面空無一物——除了一座仍有餘溫的熔爐。「有人在你之前來過，」塞勒斯低聲說，「而且帶走了最重要的東西。」他把從遺址找到的裝備交給你，「拿著它，接下來的路會更危險。」']
    ] }, {
    t: '高階篇・王者的遺骸', ch: [
      ['龍息的餘燼', '騎士團的紋章屬於一支早已除名的部隊：他們奉命討伐四大龍，全軍覆沒。「巴爾多替他們打造了能弒龍的武器，」塞勒斯的手在發抖，「如果那些武器還在，一定在龍的巢穴深處。」'],
      ['王座下的碎片', '你帶回的素材裡夾著一片黑色的鱗，鱗下刻著巴爾多的名字。塞勒斯沉默了很久。「他沒有死在工坊。他跟著騎士團進了巢穴，親手把武器交給了他們的王。」'],
      ['古物學者的答案', '《亞丁拾遺錄》的最後一頁，塞勒斯寫下了遠征隊每一個人的名字。「這些東西沒有人要，是因為大家都忘了它們從哪裡來。」他把最後一件裝備放在你手上，「記得它們的人還在，故事就沒有結束。」']
    ] }];

  // ── 素材分階 ──
  var tiers = null;
  var loadTiers = function () {
    if (tiers) return tiers;
    tiers = [null, [], [], []];
    (X.junk ? X.junk() : []).forEach(function (x) { if (DB.items[x.id] && tiers[x.tier]) tiers[x.tier].push(x.id); });
    for (var t = 1; t <= 3; t++) {
      tiers[t].sort();
      tiers[t].forEach(function (id) { var d = DB.items[id]; var tag = '【古物學者委託・' + TIER[t].n + '材料】'; if (d && String(d.d || '').indexOf(tag) < 0) d.d = (d.d ? d.d + '\n' : '') + tag + '奇岩的古物學者 塞勒斯收這個，交付後換裝備。'; });
    }
    return tiers;
  };
  // ── 獎勵裝備 ──
  var pools = null;
  var loadPools = function () {
    if (pools) return pools;
    var mx = X.gearMax ? X.gearMax() : 51800;
    pools = [null, [], [], []];
    (X.items || []).forEach(function (id) {
      var d = DB.items[id]; if (!d || d.gmOnly || d.ttmiRiftOnly || d.ttmiEvent || ['wpn', 'arm', 'acc'].indexOf(d.type) < 0) return;
      if (['pet', 'petwpn', 'petarm', 'doll'].indexOf(d.slot) >= 0) return;
      var v = num(d.p); pools[v <= mx ? 1 : v <= 500000 ? 2 : 3].push(id);
    });
    return pools;
  };
  // 高階獎勵＝「殘缺的」王裝（玩家 2026-10-27：真冥皇這些抽到的只能算弱化版）：能力數值全部減半，名稱前加「殘缺的」
  var KEEP_NUM = { p: 0, safe: 1, ttmiWeight: 1, ttmiSourceId: 1, gachaWeight: 1, weight: 1, lv: 1, minLv: 1, ttmiCost: 1, spd: 1, aspd: 1, atkSpd: 1, dollTier: 1 };
  var half = function (v) { return v > 0 ? Math.floor(v / 2) : -Math.floor(-v / 2); };
  var halfObj = function (o) { if (!o || typeof o !== 'object') return o; Object.keys(o).forEach(function (k) { if (typeof o[k] === 'number' && !KEEP_NUM[k]) o[k] = half(o[k]); else if (o[k] && typeof o[k] === 'object') halfObj(o[k]); }); return o; };
  var weakId = function (id) { return 'jq_weak_' + id; };
  var makeWeak = function (id) {
    var b = DB.items[id], wid = weakId(id); if (!b) return null; if (DB.items[wid]) return wid;
    var d = JSON.parse(JSON.stringify(b));
    Object.keys(d).forEach(function (k) { if (typeof d[k] === 'number' && !KEEP_NUM[k]) d[k] = half(d[k]); });
    ['ttmiConditional', 'ttmiPeriodic'].forEach(function (k) { if (d[k]) halfObj(d[k]); });
    d.p = Math.floor(num(b.p) / 2); d.n = '殘缺的 ' + b.n; d.jqWeakOf = id; d.gachaWeight = 0;
    d.d = (b.d ? b.d + '\n' : '') + '【殘缺】古物學者從遺跡拼湊回來的仿品，能力只有原品的一半。';
    delete d._spdFam;   // 攻速家族快取：改由下方複製的 WEAPON_TAGS 重新推得
    DB.items[wid] = d;
    try { if (typeof WEAPON_TAGS !== 'undefined' && WEAPON_TAGS[id] && !WEAPON_TAGS[wid]) WEAPON_TAGS[wid] = WEAPON_TAGS[id].slice(); } catch (e) {}   // 🔧 殘缺品沿用原品武器種類（否則黑暗妖精裝不上雙刀/鋼爪/單手劍、攻速家族也錯成雙手劍）
    try { if (typeof ITEM_WEIGHTS !== 'undefined' && ITEM_WEIGHTS[b.n] !== undefined && ITEM_WEIGHTS[d.n] === undefined) ITEM_WEIGHTS[d.n] = ITEM_WEIGHTS[b.n]; } catch (e) {}   // 重量表以名稱為鍵：殘缺品沿用原品重量
    return wid;
  };
  var canWear = function (d, p) { var r = String(d.req || 'all'); return r === 'all' || r.split(',').indexOf(p.cls) >= 0; };
  var rollGear = function (t) {
    var p = P(), list = loadPools()[t].filter(function (id) { return canWear(DB.items[id], p); });
    if (!list.length) list = loadPools()[t];
    var g = list.length ? list[Math.floor(Math.random() * list.length)] : null;
    return g && t === 3 ? makeWeak(g) : g;
  };

  // ── 進度 ──
  var st = function () {
    var p = P(); if (!p) return null;
    var s = p._afkJunkQ = p._afkJunkQ || {};
    s.story = s.story || { 1: 0, 2: 0, 3: 0 }; s.bounty = s.bounty || {}; s.done = s.done || { 1: 0, 2: 0, 3: 0 };
    return s;
  };
  var count = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (n, it) { return n + (it && it.id === id && !it.lock ? Math.max(1, Math.floor(num(it.cnt) || 1)) : 0); }, 0) : 0; };
  var take = function (id, k) {
    var p = P();
    for (var i = p.inv.length - 1; i >= 0 && k > 0; i--) {
      var it = p.inv[i]; if (!it || it.id !== id || it.lock) continue;
      var c = Math.max(1, Math.floor(num(it.cnt) || 1)), use = Math.min(c, k);
      k -= use; if (c - use <= 0) p.inv.splice(i, 1); else it.cnt = c - use;
    }
    return k <= 0;
  };
  var storyReq = function (t, c) {
    var list = loadTiers()[t]; if (!list.length) return [];
    var out = []; for (var k = 0; k < 3; k++) { var id = list[(c * 3 + k) % list.length]; if (out.indexOf(id) < 0) out.push(id); }
    return out.map(function (id) { return { id: id, cnt: TIER[t].story }; });
  };
  var unlocked = function (t) {
    var s = st(), p = P(); if (!s || !p) return false;
    if (t === 1) return true;
    return s.story[t - 1] >= 3 && num(p.lv) >= TIER[t].lv;
  };
  var newBounty = function (t) {
    var list = loadTiers()[t].slice(), k = Math.min(TIER[t].bounty[0], list.length), pick = [];
    while (pick.length < k) { var i = Math.floor(Math.random() * list.length); pick.push(list.splice(i, 1)[0]); }
    return { req: pick.map(function (id) { return { id: id, cnt: TIER[t].bounty[1] }; }), at: Date.now() };
  };
  var bounty = function (t) { var s = st(); if (!s.bounty[t] || !s.bounty[t].req || !s.bounty[t].req.every(function (q) { return DB.items[q.id]; })) s.bounty[t] = newBounty(t); return s.bounty[t]; };
  var enough = function (req) { return req.length > 0 && req.every(function (q) { return count(q.id) >= q.cnt; }); };
  var save = function () { try { if (typeof saveGame === 'function') saveGame(); } catch (e) {} };
  var refresh = function () { try { if (typeof renderTabs === 'function') renderTabs(true); if (typeof updateUI === 'function') updateUI(); } catch (e) {} };
  var payAndGive = function (req, t, why) {
    var p = P(), snap = p.inv.slice(), cnts = p.inv.map(function (x) { return x && x.cnt; });
    if (!req.every(function (q) { return take(q.id, q.cnt); })) { p.inv = snap; snap.forEach(function (x, j) { if (x) x.cnt = cnts[j]; }); return null; }
    var g = rollGear(t); if (!g) { p.inv = snap; snap.forEach(function (x, j) { if (x) x.cnt = cnts[j]; }); return null; }
    try { gainItem(g, 1, true, true); } catch (e) { p.inv = snap; return null; }
    sys('<span style="color:' + TIER[t].c + ';font-weight:700">【古物學者】</span>' + esc(why) + '：獲得 <b>' + esc(DB.items[g].n) + '</b>。');
    return g;
  };
  function turnStory(t) {
    var s = st(); if (!on() || !s || !unlocked(t)) return false;
    var c = s.story[t]; if (c >= 3) return false;
    var req = storyReq(t, c); if (!enough(req)) { sys('<span class="text-red-400">委託材料還不夠。</span>'); return false; }
    var g = payAndGive(req, t, STORY[t].t + '・第 ' + (c + 1) + ' 章「' + STORY[t].ch[c][0] + '」完成'); if (!g) return false;
    s.story[t] = c + 1;
    if (s.story[t] >= 3) sys('<span style="color:' + TIER[t].c + '">【古物學者】' + esc(STORY[t].t) + ' 讀完了。' + TIER[t].n + '常駐委託開放' + (t < 3 ? '；下一篇需要 Lv' + TIER[t + 1].lv + '。' : '。') + '</span>');
    save(); refresh(); redraw(); return true;
  }
  function turnBounty(t) {
    var s = st(); if (!on() || !s || s.story[t] < 3) return false;
    var b = bounty(t); if (!enough(b.req)) { sys('<span class="text-red-400">委託材料還不夠。</span>'); return false; }
    var g = payAndGive(b.req, t, TIER[t].n + '常駐委託交付'); if (!g) return false;
    s.done[t] = (s.done[t] || 0) + 1; s.bounty[t] = newBounty(t);
    save(); refresh(); redraw(); return true;
  }
  var REROLL_MS = 5 * 60 * 1000;
  function reroll(t) {
    var s = st(); if (!on() || !s || s.story[t] < 3) return false;
    var b = bounty(t); if (Date.now() - num(b.rerollAt) < REROLL_MS) { sys('<span class="text-slate-400">塞勒斯：「委託單不是天天都有新的，晚點再來看看。」</span>'); return false; }
    s.bounty[t] = newBounty(t); s.bounty[t].rerollAt = Date.now(); save(); redraw(); return true;
  }

  // ── 畫面 ──
  var view = 1;
  var whereFrom = function (id) {
    var out = []; try { Object.keys(MOB_DROPS).forEach(function (n) { if (out.length < 3 && (MOB_DROPS[n] || []).some(function (e) { return e[0] === id; })) out.push(n); }); } catch (e) {}
    return out;
  };
  var icon = function (id) { var d = DB.items[id], u = ''; try { u = getIconUrl(d); } catch (e) {} return '<div class="w-10 h-10 bg-slate-900 rounded border border-slate-600 flex items-center justify-center shrink-0 tip-host" data-tip-id="' + esc(id) + '"><img src="' + esc(u) + '" alt="" onerror="this.style.display=\'none\'" class="w-8 h-8 object-contain pointer-events-none"></div>'; };
  var reqList = function (req) {
    return '<div class="flex flex-col gap-2" style="margin:8px 0">' + req.map(function (q) {
      var h = count(q.id), ok = h >= q.cnt, from = whereFrom(q.id);
      return '<div class="flex items-center gap-3">' + icon(q.id) + '<div class="min-w-0"><div class="font-bold"><span class="' + (ok ? 'text-green-400' : 'text-red-400') + '">' + h.toLocaleString() + '</span>/' + q.cnt + ' ' + esc(DB.items[q.id].n) + '</div>'
        + '<div class="text-xs text-slate-400">' + (from.length ? '掉落：' + esc(from.join('、')) + (from.length >= 3 ? '…' : '') : '') + '</div></div></div>';
    }).join('') + '</div>';
  };
  var BOX = 'list-item bg-slate-800 rounded mb-3 border border-slate-700 p-3';
  function render(div) {
    if (!div) return; var s = st(), p = P(); if (!s || !p) return;
    loadTiers();
    var h = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
    for (var t = 1; t <= 3; t++) h += '<button class="btn" onclick="AFK_JUNKQ.view(' + t + ')"' + (view === t ? ' style="color:#fcd34d"' : '') + '>' + TIER[t].n + (t > 1 ? '（Lv' + TIER[t].lv + ' 以上）' : '（Lv60 以下）') + (unlocked(t) ? '' : ' 🔒') + '</button>';
    h += '</div>';
    var tv = view, tierList = tiers[tv];
    h += '<p class="text-slate-400 text-sm" style="margin-bottom:10px">雜項素材分三階，只能打怪取得（不能買）。劇情委託每章給一件' + TIER[tv].n + '裝備；讀完該篇後開放常駐委託，可以一直換。獎勵只抽你的職業能穿的。' + (tv === 3 ? '高階獎勵是「殘缺的」王裝仿品，能力只有原品的一半。' : '') + '</p>';
    if (!unlocked(tv)) {
      h += '<div class="' + BOX + '"><b>' + esc(STORY[tv].t) + '</b><p class="text-slate-400 text-sm" style="margin-top:6px">要先讀完' + TIER[tv - 1].n + '篇' + (num(p.lv) < TIER[tv].lv ? '，並達到 Lv' + TIER[tv].lv + '（目前 Lv' + num(p.lv) + '）' : '') + '。</p></div>';
    } else {
      var c = s.story[tv];
      if (c < 3) {
        var req = storyReq(tv, c), ok = enough(req);
        h += '<div class="' + BOX + '"><div class="text-amber-300 font-bold">' + esc(STORY[tv].t) + '　第 ' + (c + 1) + '／3 章「' + esc(STORY[tv].ch[c][0]) + '」</div>'
          + '<p class="text-sm" style="color:#e2d6bd;line-height:1.7;margin:8px 0">' + esc(STORY[tv].ch[c][1]) + '</p>' + reqList(req)
          + '<button class="btn bg-blue-700 hover:bg-blue-600 border-blue-500 py-2 px-5 font-bold" onclick="AFK_JUNKQ.story(' + tv + ')"' + (ok ? '' : ' disabled') + '>交付（獲得一件' + TIER[tv].n + '裝備）</button></div>';
      } else {
        var b = bounty(tv), okb = enough(b.req), wait = Math.max(0, REROLL_MS - (Date.now() - num(b.rerollAt)));
        h += '<div class="' + BOX + '"><div class="text-amber-300 font-bold">' + TIER[tv].n + '常駐委託　<span class="text-slate-400 text-sm">已完成 ' + num(s.done[tv]) + ' 次</span></div>'
          + '<p class="text-sm text-slate-400" style="margin:6px 0">' + esc(STORY[tv].t) + ' 已讀完。塞勒斯還在整理《亞丁拾遺錄》，需要更多同階的素材。</p>' + reqList(b.req)
          + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn bg-blue-700 hover:bg-blue-600 border-blue-500 py-2 px-5 font-bold" onclick="AFK_JUNKQ.bounty(' + tv + ')"' + (okb ? '' : ' disabled') + '>交付（隨機一件' + TIER[tv].n + '裝備）</button>'
          + '<button class="btn" onclick="AFK_JUNKQ.reroll(' + tv + ')"' + (wait ? ' disabled title="' + Math.ceil(wait / 60000) + ' 分鐘後可以換"' : '') + '>換一張委託' + (wait ? '（' + Math.ceil(wait / 60000) + ' 分）' : '') + '</button></div></div>';
      }
    }
    // 這一階的素材收集進度
    var have = tierList.filter(function (id) { return count(id) > 0; }).length;
    h += '<details class="' + BOX + '"><summary class="cursor-pointer font-bold">' + TIER[tv].n + '素材收集進度　<span class="text-slate-400 text-sm">' + have + '／' + tierList.length + ' 種</span></summary><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin-top:8px">'
      + tierList.map(function (id) { var n = count(id); return '<div class="flex items-center gap-2 text-sm" style="opacity:' + (n ? 1 : .55) + '">' + icon(id) + '<span class="min-w-0" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(DB.items[id].n) + ' <b class="' + (n ? 'text-green-400' : 'text-slate-500') + '">' + n.toLocaleString() + '</b></span></div>'; }).join('')
      + '</div></details>';
    div.innerHTML = h;
  }
  var redraw = function () { var c = document.getElementById('interaction-content'), nm = document.getElementById('interaction-npc-name'); if (c && nm && nm.innerText === NAME) render(c); };
  var open = function () { if (!on()) return; if (typeof openTownFloatWindow === 'function') openTownFloatWindow(NAME, TITLE, render); };

  // ── NPC ──
  var addNpc = function () { var town = DB.towns[TOWN]; if (!town) return; town.npcs = town.npcs || []; if (!town.npcs.some(function (x) { return x.id === NPC; })) town.npcs.push({ id: NPC, n: NAME, title: TITLE, type: 'shop', d: '戴著厚眼鏡的學者，正在寫一本記錄冒險者遺物的書。用雜項素材換裝備，還有一段沒說完的故事。' }); };
  var removeNpc = function () { var town = DB.towns[TOWN]; if (town && town.npcs) town.npcs = town.npcs.filter(function (x) { return x.id !== NPC; }); };
  if (on()) addNpc();
  if (typeof W.interactNPC === 'function') {
    var oI = W.interactNPC;
    W.interactNPC = function (id) { if (id === NPC) { if (on()) open(); return; } return oI.apply(this, arguments); };
  }
  if (T && typeof T.set === 'function') { var oSet = T.set; T.set = function (id) { var r = oSet.apply(this, arguments); if (id === 'junkquest' || id === 'ttmi-items') { if (on()) addNpc(); else removeNpc(); } return r; }; }
  try { loadTiers(); loadPools()[3].forEach(makeWeak); } catch (e) {}

  W.AFK_JUNKQ = { view: function (t) { view = Math.max(1, Math.min(3, Number(t) || 1)); redraw(); }, story: turnStory, bounty: turnBounty, reroll: reroll, open: open,
    tiers: function () { return loadTiers(); }, pools: function () { return loadPools(); }, storyReq: storyReq, state: st };
})();
