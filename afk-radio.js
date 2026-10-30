/* ============================================================================
 * afk-radio.js — 📻 電台：登入畫面的音樂可以自選（玩家 2026-10-30 17:00；外掛開關 radio，預設開）
 *
 *   位置：首頁左上角「🎚️ 外掛」按鈕旁邊（跟它一樣，只在首頁／選角顯示，進遊戲就藏起來）。
 *   選項：原本的登入音樂（預設）／電台歌曲（玩家 2026-10-30 17:24 提供的音檔 → assets/bgm/radio_title.mp3，
 *         原檔是 AAC，轉成 128 kbps MP3，1 分 52 秒、1.8 MB）。選擇存在這台電腦的瀏覽器裡。
 *   播放交給遊戲本身的背景音樂系統：登入畫面（標題）換成這首，循環播放、淡入淡出、音量與「背景音樂」開關都照原本設定；
 *   進創角或進遊戲就換回遊戲的曲子。
 *   （17:00 版本原本用 YouTube 嵌入播放器，17:24 改用玩家提供的音檔，不再連 YouTube。）
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'radio', name: '電台（登入畫面音樂自選）', group: '遊戲介面',
    desc: '首頁「外掛」按鈕旁的電台：登入畫面要聽原本的音樂，還是電台歌曲' });
  var on = function () { return !T || T.enabled('radio'); };
  var SCENE = 'afk_radio', FILE = 'radio_title', KEY = 'afk_radio_choice';
  var CH = [{ id: 'orig', n: '原本的登入音樂', ic: '🎵' }, { id: 'song', n: '電台歌曲', ic: '📻' }];
  var choice = function () { try { var v = localStorage.getItem(KEY); return (v === 'song' || v === 'yt') ? 'song' : 'orig'; } catch (e) { return 'orig'; } };   // 'yt'＝17:00 版本存的選擇，沿用
  var setChoice = function (v) { try { localStorage.setItem(KEY, v); } catch (e) {} };
  var cfgOn = function () { try { return !(typeof _bgmCfg !== 'undefined' && _bgmCfg && _bgmCfg.on === false); } catch (e) { return true; } };
  var inGame = function () { var gs = document.getElementById('game-screen'); return !!(gs && !gs.classList.contains('hidden')); };
  var standalone = function () { try { return !!new URLSearchParams(location.search).get('view'); } catch (e) { return false; } };

  // ── 登記曲目，讓核心的背景音樂系統來播 ──
  try {
    if (typeof BGM_TRACKS !== 'undefined' && BGM_TRACKS) BGM_TRACKS[SCENE] = FILE;   // 核心初始化時會一起預解析網址
    if (typeof _bgmInited !== 'undefined' && _bgmInited && typeof _bgmResolve === 'function') _bgmResolve(SCENE, FILE);
  } catch (e) {}
  var oDetect = W._bgmDetectScene;
  if (typeof oDetect === 'function') {
    W._bgmDetectScene = function () {
      var s = oDetect.apply(this, arguments);
      return (s === 'title' && on() && choice() === 'song') ? SCENE : s;
    };
  }
  var refresh = function () { try { if (typeof _bgmUrl !== 'undefined' && !_bgmUrl[SCENE] && typeof _bgmResolve === 'function') _bgmResolve(SCENE, FILE); _bgmScene = null; if (typeof _bgmTick === 'function') _bgmTick(); } catch (e) {} };

  // ── 按鈕與選單（外掛按鈕旁邊）──
  var css = function () {
    if (document.getElementById('afk-radio-css')) return;
    var st = document.createElement('style'); st.id = 'afk-radio-css';
    st.textContent = '#afk-radio-btn{position:fixed;z-index:100001;background:rgba(15,23,42,.92);border:1px solid #64748b;color:#e2e8f0;border-radius:8px;padding:4px 9px;font-size:14px;font-weight:700;line-height:1.35;cursor:pointer}'
      + '#afk-radio-menu{position:fixed;z-index:100002;background:#0f172a;border:1px solid #475569;border-radius:8px;padding:6px;min-width:220px;box-shadow:0 8px 24px rgba(0,0,0,.5)}'
      + '#afk-radio-menu button{display:block;width:100%;text-align:left;padding:6px 8px;border-radius:6px;color:#e2e8f0;font-size:14px;background:transparent;border:0;cursor:pointer}'
      + '#afk-radio-menu button:hover{background:#1e293b}#afk-radio-menu button.on{background:#1d4ed8}'
      + '#afk-radio-menu small{display:block;color:#94a3b8;font-size:11px;padding:4px 8px 0}';
    document.head.appendChild(st);
  };
  var closeMenu = function () { var m = document.getElementById('afk-radio-menu'); if (m && m.parentNode) m.parentNode.removeChild(m); };
  var pick = function (v) { setChoice(v === 'song' ? 'song' : 'orig'); closeMenu(); refresh(); };
  var openMenu = function (btn) {
    css(); if (document.getElementById('afk-radio-menu')) { closeMenu(); return; }
    var m = document.createElement('div'); m.id = 'afk-radio-menu';
    var cur = choice(), r = btn.getBoundingClientRect();
    m.style.left = r.left + 'px'; m.style.top = (r.bottom + 4) + 'px';
    m.innerHTML = CH.map(function (c) { return '<button type="button" data-v="' + c.id + '" class="' + (c.id === cur ? 'on' : '') + '">' + c.ic + ' ' + c.n + (c.id === cur ? '　✓' : '') + '</button>'; }).join('')
      + '<small>只在登入畫面播放；音量跟「背景音樂」設定一樣。' + (cfgOn() ? '' : '<br>（背景音樂目前關著，兩種都不會播）') + '</small>';
    m.addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) pick(b.getAttribute('data-v')); });
    document.body.appendChild(m);
    setTimeout(function () { document.addEventListener('click', function off(e) { if (!e.target.closest('#afk-radio-menu,#afk-radio-btn')) { closeMenu(); document.removeEventListener('click', off, true); } }, true); }, 0);
  };
  var placeBtn = function () {
    var b = document.getElementById('afk-radio-btn');
    if (!on()) { if (b && b.parentNode) b.parentNode.removeChild(b); return; }
    if (!document.body) return;
    if (!b) { css(); b = document.createElement('button'); b.id = 'afk-radio-btn'; b.type = 'button'; b.textContent = '📻 電台'; b.title = '登入畫面的音樂'; b.addEventListener('click', function () { openMenu(b); }); document.body.appendChild(b); }
    var e = document.getElementById('afk-toggles-entry');
    var hide = inGame() || standalone() || (e && e.style.display === 'none');
    b.style.display = hide ? 'none' : '';
    if (hide) { closeMenu(); return; }
    if (e) { var r = e.getBoundingClientRect(); b.style.left = (r.right + 6) + 'px'; b.style.top = r.top + 'px'; }
    else { b.style.left = '90px'; b.style.top = '6px'; }
  };
  var boot = function () { placeBtn(); setInterval(function () { if (!document.hidden) placeBtn(); }, 1000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  W.__afkRadio = { SCENE: SCENE, FILE: FILE, choice: choice, pick: pick, sync: placeBtn };
})();
