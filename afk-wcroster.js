/* ============================================================================
 * afk-wcroster.js — 世界頻道常駐玩家 100 人＋收購 NPC 共用同一批名字（玩家 2026-10-21 指定）
 *
 * ‧固定一批 100 位「常駐玩家」（名字用固定種子產生，每次開遊戲、每台電腦都一樣）
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

  var SIZE = 100;
  // 固定種子（mulberry32）：同一份名單，跨存檔、跨裝置一致
  var seed = 0x5eed1021;
  var rnd = function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  var roster = [], seen = {};
  for (var g = 0; roster.length < SIZE && g < SIZE * 20; g++) {
    var n = window.pvpRandomNameWith(rnd);
    if (n && !seen[n]) { seen[n] = 1; roster.push(n); }
  }

  // 世界頻道：75% 常駐玩家
  if (typeof window._wcMakeName === 'function') {
    var oMake = window._wcMakeName;
    window._wcMakeName = function () {
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

  window.__afkWcRoster = { list: function () { return roster.slice(); } };
  console.log('[AFK-wcroster] 已啟用：世界頻道常駐玩家 ' + roster.length + ' 人（收購 NPC 共用）');
})();
