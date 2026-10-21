/* ============================================================================
 * afk-worldchat.js — 世界頻道擴充（玩家 2026-10-20 指定）
 *
 * ‧對話內容：原有的閒聊 107 句＋互嗆 301 組，再加上擴充資料（afk-worldchat-data1～3.js）
 *   約 1,000 句：網咖時事、攻城嗆聲、打寶衝裝、冷笑話諧音梗、迷因亂唱、老玩家講古；
 *   每一區塊都有單句、兩人一來一往、連續小故事、原創歪歌。
 * ‧6 區塊輪替：AFK_ROTATION（每 4 小時隨機換一區塊、抽滿 3 次後重新抽）；
 *   原有的句子平均分進 6 個區塊，跟著一起輪替。
 * ‧對話量：平均每分鐘約 15 句（原本每分鐘 1～3 句）。最近說過的句子 150 句內不重複。
 * ‧收購 NPC 每分鐘說 3 句（只有目前在場的收購者會講，內容帶他要收的東西／價格／地點）。
 * ‧關閉世界頻道（外掛面板「世界頻道靜音」或頻道輸入列旁的按鈕）：
 *   閒聊全部停止、世界頻道內容收起，只留上方置頂的兩行收購訊息。
 * ‧效能：每 4 秒左右寫一行，日誌最多保留 60 行（核心上限），分頁在背景或補跑時不產生。
 * ========================================================================== */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  var DATA = window.AFK_WC_DATA || [];
  var R = window.AFK_ROTATION;
  if (T && !T.enabled('worldchat')) return;
  if (!R || DATA.length < 6 || typeof window.logWorld !== 'function' || typeof window._wcSpawnNpc !== 'function' || typeof window._wcNameHtml !== 'function') {
    try { console.warn('[AFK-worldchat] 缺少資料或核心函式，未啟用'); } catch (e) {}
    return;
  }

  var MUTE_KEY = 'afk_world_mute';
  var muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}

  // ── 把原有內容平均分進 6 區塊 ──
  var CORE_LINES = [], CORE_PAIRS = [];
  try { if (typeof WC_CHAT_LINES !== 'undefined' && Array.isArray(WC_CHAT_LINES)) CORE_LINES = WC_CHAT_LINES.slice(); } catch (e) {}
  try { if (typeof WC_TRASH_TALK_PAIRS !== 'undefined' && Array.isArray(WC_TRASH_TALK_PAIRS)) CORE_PAIRS = WC_TRASH_TALK_PAIRS.slice(); } catch (e) {}
  var blocks = DATA.map(function (b, i) {
    return {
      name: b.name,
      lines: (b.lines || []).concat(CORE_LINES.filter(function (_, k) { return k % 6 === i; })),
      pairs: (b.pairs || []).concat(CORE_PAIRS.filter(function (_, k) { return k % 6 === i; })),
      stories: b.stories || [],
      songs: b.songs || []
    };
  });

  var esc = function (s) { try { return _wcEsc(s); } catch (e) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); } };
  var recent = [], RECENT_MAX = 150;
  var fresh = function (list, keyFn) {
    var pool = list.filter(function (x) { return recent.indexOf(keyFn(x)) < 0; });
    if (!pool.length) pool = list;
    var x = pool[Math.floor(Math.random() * pool.length)];
    recent.push(keyFn(x)); if (recent.length > RECENT_MAX) recent.shift();
    return x;
  };
  var canTalk = function () {
    if (muted || document.hidden) return false;
    var g = document.getElementById('game-screen');
    if (!g || g.classList.contains('hidden')) return false;
    if (typeof player === 'undefined' || !player || !player.cls) return false;
    if (typeof state !== 'undefined' && state && state.ff) return false;
    return true;
  };
  var say = function (id, text, extra) {
    logWorld('<span class="wc-answer wc-idle-chat' + (extra ? ' ' + extra : '') + '">' + _wcNameHtml(id) + '：' + esc(text) + '</span>');
  };
  var later = function (ms, fn) { setTimeout(function () { if (canTalk()) fn(); }, ms); };

  // ── 一則「事件」：單句／一來一往／小故事／歪歌 ──
  var postEvent = function () {
    // 三成改成 afk-wcroster 的連貫對話（常駐玩家一來一往，用遊戲裡真的地圖／怪物／掉落）
    try { if (typeof window.__afkWcThread === 'function' && Math.random() < 0.3 && window.__afkWcThread()) return; } catch (e) {}
    var b = blocks[R.block()] || blocks[0];
    var r = Math.random();
    if (r < 0.58 && b.lines.length) {
      say(_wcSpawnNpc(), fresh(b.lines, function (x) { return x; }));
    } else if (r < 0.80 && b.pairs.length) {
      var p = fresh(b.pairs, function (x) { return x[0]; });
      var a = _wcSpawnNpc(), c = _wcSpawnNpc();
      for (var g = 0; g < 6 && c === a; g++) c = _wcSpawnNpc();
      say(a, p[0]);
      later(1200 + Math.random() * 1500, function () { say(c, p[1]); });
    } else if (r < 0.88 && b.stories.length) {
      var s = fresh(b.stories, function (x) { return x[0]; });
      var who = _wcSpawnNpc();
      s.forEach(function (line, k) { if (k === 0) say(who, line); else later(k * (2200 + Math.random() * 800), function () { say(who, line); }); });
    } else if (b.songs.length) {
      say(_wcSpawnNpc(), fresh(b.songs, function (x) { return x; }), 'afk-wc-song');
    } else if (b.lines.length) {
      say(_wcSpawnNpc(), fresh(b.lines, function (x) { return x; }));
    }
  };
  // 平均每則事件約 1.45 句 → 間隔 4～7.5 秒（平均 5.75 秒）≈ 每分鐘 15 句
  var loop = function () {
    try { if (canTalk()) postEvent(); } catch (e) {}
    setTimeout(loop, 4000 + Math.random() * 3500);
  };

  // ── 收購 NPC 閒聊：每分鐘 3 句 ──
  var BUYER_LINES = {
    gold: [
      '還在收 {item}，{price} 金幣現金交易，人在 {town}。',
      '{item} 有的快來 {town}，{price} 金幣不囉嗦。',
      '收 {item}，價錢是 {price}，比黑市實在多了。',
      '剛剛有人問我收不收別的，不收，我只要 {item}。',
      '{town} 這裡人好多，有 {item} 的直接點我名字。',
      '強化值比我要的高也可以賣喔，只是我照 {item} 的價格算。',
      '再一下我就要走了，{item} 有的把握時間。',
      '{price} 金幣收 {item}，這價格你在別處找不到。',
      '有人說我收太貴？貴的是 {item}，不是我。',
      '等了半小時還沒人賣 {item}，大家是捨不得嗎？'
    ],
    diamond: [
      '鑽收 {item}，{price}，人在 {town}，意者密。',
      '{item} 用 {price} 收，龍鑽直接給，不拖拖拉拉。',
      '還是在找 {item}，有的人快來 {town}。',
      '龍鑽我多的是，{item} 我缺的是。',
      '{price} 收 {item}，這個價錢可以搜好幾次遺物了。',
      '剛剛有人拿假的來，我只收真的 {item}。',
      '強化值比我要的高也收，不過照 {item} 的價格給。',
      '再等一下我就收攤了，{item} 有的快。',
      '有人問我為什麼要 {item}？收藏啦，不要問。',
      '{town} 的朋友們，{item} 換 {price}，划算吧？'
    ]
  };
  var buyerName = function (w) {
    try { return pvpNameHtml(w.name, w.alignmentValue || 0, 'font-bold'); } catch (e) { return '<span class="font-bold">' + esc(w.name) + '</span>'; }
  };
  var postBuyer = function () {
    if (!canTalk() || typeof window.pandoraListWanderers !== 'function') return;
    var list = [];
    try { list = (window.pandoraListWanderers() || []).filter(function (w) { return w && !w.broadcastStopped && !w.dismissed; }); } catch (e) {}
    if (!list.length) return;
    var w = list[Math.floor(Math.random() * list.length)];
    var d = DB.items[w.itemId]; if (!d) return;
    var gold = w.currency === 'gold';
    var item = (w.en == null ? '' : '+' + w.en + ' ') + d.n;
    var price = gold ? (Math.max(1, Math.floor(Number(w.price) || 1))).toLocaleString() : ('龍之鑽石 ' + Math.max(1, Math.floor(Number(w.reward) || 1)) + ' 顆');
    var town = (DB.towns && DB.towns[w.townId]) ? DB.towns[w.townId].n : w.townId;
    var t = fresh(BUYER_LINES[gold ? 'gold' : 'diamond'], function (x) { return x; })
      .replace(/\{item\}/g, item).replace(/\{price\}/g, price).replace(/\{town\}/g, town);
    logWorld('<span class="wc-answer wc-idle-chat afk-wc-buyer"><button type="button" class="wander-broadcast-name" onclick="openWanderingShoutMenu(\'' + esc(w.id) + '\',event)">' + buyerName(w) + '</button>：' + esc(t) + '</span>');
  };
  var buyerLoop = function () {
    try { postBuyer(); } catch (e) {}
    setTimeout(buyerLoop, 14000 + Math.random() * 12000);   // 平均 20 秒一句＝每分鐘 3 句
  };

  // ── 停掉核心原本「每分鐘 1～3 句＋三成互嗆」，改由這裡統一出（避免重複又失控） ──
  window._wcCanIdleChat = function () { return false; };

  // ── 靜音：只留置頂的收購兩行 ──
  var STYLE_ID = 'afk-wc-mute-style';
  var applyMute = function () {
    document.documentElement.classList.toggle('afk-wc-muted', muted);
    var btn = document.getElementById('afk-wc-mute-btn');
    if (btn) { btn.textContent = muted ? '🔈 開啟頻道' : '🔇 關閉頻道'; btn.title = muted ? '恢復世界頻道閒聊' : '關閉世界頻道閒聊，只保留置頂的收購訊息'; }
  };
  window.afkWorldMute = function (on) {
    muted = (on == null) ? !muted : !!on;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
    applyMute();
    return muted;
  };
  var setupUi = function () {
    if (!document.getElementById(STYLE_ID)) {
      var st = document.createElement('style'); st.id = STYLE_ID;
      st.textContent = 'html.afk-wc-muted #world-log{display:none!important}'
        + 'html.afk-wc-muted #world-input-row > :not(#afk-wc-mute-btn){display:none!important}'
        + '#afk-wc-mute-btn{flex:0 0 auto;padding:2px 8px;margin-right:6px;font-size:12px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:#cbd5e1;cursor:pointer;white-space:nowrap}'
        + '.afk-wc-song{font-style:italic}';
      document.head.appendChild(st);
    }
    var row = document.getElementById('world-input-row');
    if (row && !document.getElementById('afk-wc-mute-btn')) {
      var btn = document.createElement('button');
      btn.type = 'button'; btn.id = 'afk-wc-mute-btn';
      btn.onclick = function () { window.afkWorldMute(); };
      row.insertBefore(btn, row.firstChild);
    }
    applyMute();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupUi); else setupUi();

  setTimeout(loop, 3000);
  setTimeout(buyerLoop, 8000);

  var total = blocks.reduce(function (s, b) { return s + b.lines.length + b.pairs.length * 2 + b.stories.reduce(function (t, x) { return t + x.length; }, 0) + b.songs.length; }, 0);
  window.__afkWorldChat = {
    total: total,
    blocks: function () { return blocks.map(function (b) { return { name: b.name, lines: b.lines.length, pairs: b.pairs.length, stories: b.stories.length, songs: b.songs.length }; }); },
    now: function () { var i = R.info(); return { 區塊: blocks[i.block].name, 本輪順序: i.order.map(function (k) { return blocks[k].name; }), 下次換區塊: new Date(i.nextChangeAt).toLocaleString() }; },
    postEvent: postEvent, postBuyer: postBuyer
  };
  console.log('[AFK-worldchat] 已啟用：世界頻道共 ' + total + ' 句，目前區塊「' + blocks[R.block()].name + '」');
})();
