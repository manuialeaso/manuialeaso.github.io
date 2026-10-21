/* ============================================================================
 * afk-wcroster.js — 世界頻道常駐玩家 200 人＋收購 NPC 共用同一批名字（玩家 2026-10-21 指定）
 *
 * ‧一批 200 位「常駐玩家」：名字第一次開遊戲時隨機產生，之後存在這台電腦，同一批人會一直出現
 * ‧對話更連貫：三成的閒聊改成 2～3 人一來一往的對話（接在 afk-worldchat 的閒聊迴圈裡）（問路、問掉寶、組隊、收購、打招呼），
 *   用遊戲裡真的地圖、怪物、掉落物；之後還會接續前面的話題（「剛從 X 回來了…」）
 * ‧世界頻道發言時 75% 從常駐玩家裡挑人、25% 是路過的新面孔 → 同一批人會反覆出現，看起來像熱鬧的伺服器
 * ‧收購 NPC 也從這 100 人裡取名（同時在線的收購者不會撞名）→ 你在頻道看到的人，就是在村子裡收東西的人
 * ‧名字走核心同一套產生器，血盟歸屬／性向值以名字為 key，世界頻道、收購、野外遭遇看到的是同一個人
 * 跟著「世界頻道」開關（worldchat）。須排在 afk-buyerprice 之後（包它的 __afkWandererMake）。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T && !T.enabled('worldchat')) return;
  if (typeof window.pvpRandomNameWith !== 'function') return;

  var SIZE = 200;
  // 種子：第一次隨機產生、存在這台電腦（mulberry32）
  var seed = 0;
  try { seed = Number(localStorage.getItem('afk_wc_roster_seed')) || 0; if (!seed) { seed = (Math.floor(Math.random() * 0x7fffffff) | 1); localStorage.setItem('afk_wc_roster_seed', String(seed)); } } catch (e) { seed = 0x5eed1021; }
  var rnd = function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  var roster = [], seen = {};
  for (var g = 0; roster.length < SIZE && g < SIZE * 20; g++) {
    var n = window.pvpRandomNameWith(rnd);
    if (n && !seen[n]) { seen[n] = 1; roster.push(n); }
  }

  var forced = null;
  // 世界頻道：75% 常駐玩家
  if (typeof window._wcMakeName === 'function') {
    var oMake = window._wcMakeName;
    window._wcMakeName = function () {
      if (forced) { var f = forced; forced = null; return f; }
      if (roster.length && Math.random() < 0.75) return roster[Math.floor(Math.random() * roster.length)];
      return oMake.apply(this, arguments);
    };
  }

  // 收購 NPC：從常駐玩家取名（避開目前在線的其他收購者）
  var oWand = window.__afkWandererMake;
  var hash = function (s) { var h = 2166136261; s = String(s || ''); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  window.__afkWandererMake = function (b, h) {
    var r = (typeof oWand === 'function') ? oWand.apply(this, arguments) : undefined;
    try {
      if (b && roster.length) {
        var busy = {};
        try { (window.pandoraListWanderers ? window.pandoraListWanderers() : []).forEach(function (w) { if (w && w.name) busy[w.name] = 1; }); } catch (e) {}
        var start = hash(b.id) % roster.length;
        for (var k = 0; k < roster.length; k++) { var nm = roster[(start + k) % roster.length]; if (!busy[nm]) { b.name = nm; break; } }
      }
    } catch (e) {}
    return r;
  };

  // ── 連貫對話 ──
  var memo = Object.create(null);   // 名字 → { map, mob, item, at }
  var pickOne = function (a) { return a && a.length ? a[Math.floor(Math.random() * a.length)] : null; };
  var other = function (not) { for (var i = 0; i < 8; i++) { var n = pickOne(roster); if (n && not.indexOf(n) < 0) return n; } return null; };
  var facts = function () {
    var lv = 20 + Math.floor(Math.random() * 70);
    try { if (typeof player !== 'undefined' && player && player.lv && Math.random() < 0.5) lv = Math.min(95, Math.max(10, player.lv + Math.floor(Math.random() * 11) - 5)); } catch (e) {}
    var spot = null; try { spot = pickOne(_wcSpotsForLevel(lv)); } catch (e) {}
    var mobs = spot ? (DB.maps[spot.key] || []).map(function (k) { return DB.mobs[k]; }).filter(function (m) { return m && m.n && !m.trollPlayer && m.race !== '建築'; }) : [];
    var mob = pickOne(mobs.filter(function (m) { return !m.boss; })) || pickOne(mobs);
    var drops = (mob && typeof MOB_DROPS !== 'undefined' && MOB_DROPS[mob.n]) || [];
    var it = pickOne(drops.map(function (x) { return DB.items[x[0]]; }).filter(function (d) { return d && d.n && d.type !== 'etc'; })) || pickOne(drops.map(function (x) { return DB.items[x[0]]; }).filter(Boolean));
    return { lv: lv, map: spot ? spot.name : '妖魔森林', mob: mob ? mob.n : '妖魔', item: it ? it.n : '好東西' };
  };
  var THREADS = [
    [[0, '{map} 現在人多嗎？想去打 {mob}'], [1, '@{A} 剛從那邊回來，{mob} 不難打，記得多帶紅水'], [0, '感謝 @{B}，等等過去']],
    [[0, '有人打過 {mob} 嗎？會不會掉 {item}'], [1, '@{A} 會掉，但機率很低，我打一整晚才出一個'], [2, '我昨天連出兩個 XD 臉好而已'], [0, '酸了……']],
    [[0, '{lv} 等該去哪練？'], [1, '@{A} {map} 吧，{mob} 經驗不錯'], [2, '+1，{map} 很適合，順便撿 {item}']],
    [[0, '收 {item}，價錢好談'], [1, '@{A} 我倉庫好像有一個，等等密你'], [0, '好 等你 @{B}']],
    [[0, '組隊打 {mob}，缺一個補師'], [1, '@{A} 我妖精可以跟'], [0, '+1 集合在 {map} 入口']],
    [[0, '早安各位'], [1, '@{A} 早'], [2, '早～今天也要掛滿']],
    [[0, '{mob} 是不是改版變硬了？'], [1, '@{A} 沒感覺耶，你裝備是不是該升了'], [0, '……被看穿了']],
    [[0, '剛在 {map} 被 {mob} 圍毆死了，好痛'], [1, '@{A} 那邊要開範圍技啦'], [2, '我也死過三次，習慣就好']],
    [[0, '有人要一起去 {map} 嗎？'], [1, '@{A} 我 {lv} 等可以嗎'], [0, '可以啊，一起來']]
  ];
  var FOLLOW = [
    [[0, '從 {map} 回來了，{mob} 打了一堆，{item} 一個都沒掉'], [1, '@{A} 正常，那東西本來就難出']],
    [[0, '{map} 掛了一晚，終於出 {item} 了！'], [1, '@{A} 恭喜！請吃飯'], [2, '歐皇出現了']],
    [[0, '還在 {map} 打 {mob}……眼睛快閉上了'], [1, '@{A} 加油，撐住']]
  ];
  var canTalk = function () {
    try {
      if (document.hidden || localStorage.getItem('afk_world_mute') === '1') return false;
      var g = document.getElementById('game-screen'); if (!g || g.classList.contains('hidden')) return false;
      if (typeof player === 'undefined' || !player || !player.cls) return false;
      return !(typeof state !== 'undefined' && state && state.ff);
    } catch (e) { return false; }
  };
  var say = function (name, text) {
    try {
      forced = name; var id = _wcSpawnNpc(); forced = null;
      logWorld('<span class="wc-answer wc-idle-chat">' + _wcNameHtml(id) + '：' + _wcEsc(text) + '</span>');
    } catch (e) { forced = null; }
  };
  var runThread = function (turns, names, f) {
    var fill = function (t) { return t.replace(/\{A\}/g, names[0]).replace(/\{B\}/g, names[1] || '').replace(/\{map\}/g, f.map).replace(/\{mob\}/g, f.mob).replace(/\{item\}/g, f.item).replace(/\{lv\}/g, String(f.lv)); };
    var delay = 0;
    turns.forEach(function (tn) {
      var who = names[tn[0]]; if (!who) return;
      setTimeout(function () { if (!canTalk()) return; say(who, fill(tn[1])); }, delay);
      delay += 1100 + Math.floor(Math.random() * 1300);
    });
  };
  var postThread = function () {
    if (!roster.length) return false;
    var now = Date.now(), olds = Object.keys(memo).filter(function (n) { return now - memo[n].at > 120000 && now - memo[n].at < 3600000; });
    if (olds.length && Math.random() < 0.35) {
      var a0 = pickOne(olds), f0 = memo[a0]; delete memo[a0];
      var b0 = other([a0]); runThread(pickOne(FOLLOW), [a0, b0, other([a0, b0])], f0); return true;
    }
    var f = facts(), a = pickOne(roster), b = other([a]), c = other([a, b]);
    runThread(pickOne(THREADS), [a, b, c], f);
    memo[a] = { map: f.map, mob: f.mob, item: f.item, lv: f.lv, at: now };
    var keys = Object.keys(memo); if (keys.length > 40) delete memo[keys[0]];
    return true;
  };
  if (typeof window._wcPostIdleChat === 'function') {
    var oIdle = window._wcPostIdleChat;
    window._wcPostIdleChat = function () {
      try { if (canTalk() && Math.random() < 0.5 && postThread()) return; } catch (e) {}
      return oIdle.apply(this, arguments);
    };
  }

  window.__afkWcThread = function () { return canTalk() && postThread(); };
  window.__afkWcRoster = { list: function () { return roster.slice(); }, postThread: postThread, facts: facts, memo: memo };
  console.log('[AFK-wcroster] 已啟用：世界頻道常駐玩家 ' + roster.length + ' 人（收購 NPC 共用）');
})();
