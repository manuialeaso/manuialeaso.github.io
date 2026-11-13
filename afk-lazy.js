/* ============================================================================
 * afk-lazy.js — 用到才載入（Ping 11-13 20:28／22:05：做成分頁區塊，點了那個區塊才打開）
 *
 *   目前：小百科（afk-game-guide.js＋afk-wiki.js，約 750KB）開遊戲時不載入，點「📚 小百科」或其他地方連到小百科時才載入。
 *   ‧網址：index.html 裡的 window.__AFK_LAZY_SRC（stamp-code-versions 會一起更新 ?v=）。
 *   ‧載入前先放同樣位置的按鈕；真正的小百科載入後自己的按鈕會略過（同 id），API 換成真的。
 *   ‧獨立頁（?view=wiki）直接載入。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, SRC = W.__AFK_LAZY_SRC || {};
  var loading = {};
  var loadOne = function (url) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = url; s.async = false;
      s.onload = function () { res(); }; s.onerror = function () { rej(new Error('載入失敗：' + url)); };
      document.body.appendChild(s);
    });
  };
  var load = function (name) {
    if (loading[name]) return loading[name];
    var list = SRC[name] || [];
    loading[name] = list.reduce(function (p, u) { return p.then(function () { return loadOne(u); }); }, Promise.resolve());
    loading[name].catch(function (e) { loading[name] = null; try { if (typeof logSys === 'function') logSys('<span class="text-red-400">' + e.message + '，請重新整理再試一次。</span>'); } catch (e2) {} });
    return loading[name];
  };

  // ── 小百科 ──
  var isStandalone = function () { try { return new URLSearchParams(location.search).get('view') === 'wiki'; } catch (e) { return false; } };
  var stub = null;
  var real = function () { return W.AFK_WIKI_API && W.AFK_WIKI_API !== stub ? W.AFK_WIKI_API : null; };
  var withWiki = function (fn, btn) {
    var r = real(); if (r) { fn(r); return; }
    var old = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = '📚 載入中…'; }
    load('wiki').then(function () { return new Promise(function (r) { setTimeout(r, 0); }); }).then(function () { if (btn) { btn.disabled = false; btn.textContent = old; } var r2 = real(); if (r2) fn(r2); }, function () { if (btn) { btn.disabled = false; btn.textContent = old; } });
  };
  stub = W.AFK_WIKI_API = {
    lazy: true,
    goto: function (opts) { withWiki(function (r) { r.goto(opts || {}); }); },
    close: function () {}, isOpen: function () { return false; },
    searchHits: function () { return []; }, searchReady: function () { return false; },
    searchHitsAsync: function (q, n, cb) { withWiki(function (r) { if (r.searchHitsAsync) r.searchHitsAsync(q, n, cb); else if (cb) cb(r.searchHits ? r.searchHits(q, n) : []); }); },
    warmSearch: function () { withWiki(function (r) { if (r.warmSearch) r.warmSearch(); }); }
  };
  var openWiki = function (e) { withWiki(function (r) { r.goto({}); }, e && e.currentTarget); };
  var injectButtons = function () {
    var menu = document.getElementById('main-menu');
    if (menu && !document.getElementById('m-wiki-open')) {
      var row = document.createElement('div'); row.className = 'm-wiki-entry-row';
      var b = document.createElement('button'); b.id = 'm-wiki-open'; b.type = 'button';
      b.className = 'btn text-xl py-4 bg-indigo-700 hover:bg-indigo-600 border-indigo-500 m-wiki-entry-main'; b.textContent = '📚 小百科';
      b.addEventListener('click', openWiki);
      var nt = document.createElement('button'); nt.id = 'm-wiki-newtab'; nt.type = 'button';
      nt.className = 'btn py-4 bg-indigo-700 hover:bg-indigo-600 border-indigo-500 m-wiki-entry-newtab'; nt.textContent = '↗';
      nt.title = '在新分頁開啟小百科'; nt.setAttribute('aria-label', '在新分頁開啟小百科');
      nt.addEventListener('click', function () { window.open(location.href.split('?')[0].split('#')[0] + '?view=wiki', '_blank'); });
      row.appendChild(b); row.appendChild(nt); menu.appendChild(row);
      // 這兩顆按鈕的排版本來由小百科的樣式表給，載入前先補最少的樣式
      if (!document.getElementById('afk-lazy-css')) { var st = document.createElement('style'); st.id = 'afk-lazy-css'; st.textContent = '.m-wiki-entry-row{display:flex;gap:8px}.m-wiki-entry-main{flex:1}.m-wiki-entry-newtab{width:56px}'; document.head.appendChild(st); }
    }
    var panel = document.getElementById('tab-automation');
    if (panel && !document.getElementById('m-afk-nav-wiki')) {
      var row2 = document.getElementById('m-afk-navrow');
      if (!row2) {
        row2 = document.createElement('div'); row2.id = 'm-afk-navrow'; row2.className = 'bg-slate-800 p-3 rounded-lg border border-slate-700';
        row2.innerHTML = '<div class="text-sm text-amber-400 mb-2 border-b border-slate-700 pb-1 font-bold">🔌 外掛</div><div id="m-afk-navrow-btns" style="display:flex;gap:8px;"></div>';
        panel.appendChild(row2);
      }
      var b2 = document.createElement('button'); b2.id = 'm-afk-nav-wiki'; b2.type = 'button';
      b2.className = 'btn py-2 text-sm bg-slate-700 hover:bg-slate-600 border-slate-500'; b2.style.flex = '1'; b2.textContent = '📚 小百科';
      b2.addEventListener('click', openWiki);
      row2.querySelector('#m-afk-navrow-btns').appendChild(b2);
    }
  };
  var ready = function (fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); };
  ready(function () { if (isStandalone()) load('wiki'); else injectButtons(); });

  W.__afkLazy = { load: load, SRC: SRC };
})();
