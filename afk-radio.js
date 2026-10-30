/* ============================================================================
 * afk-radio.js — 📻 電台：登入畫面的音樂可以自選（玩家 2026-10-30 17:00；外掛開關 radio，預設開）
 *
 *   位置：首頁左上角「🎚️ 外掛」按鈕旁邊（跟它一樣，只在首頁／選角顯示，進遊戲就藏起來）。
 *   選項：原本的登入音樂（預設）／YouTube 的那首歌（玩家指定 L1kfiXB7nFM）。選擇存在這台電腦的瀏覽器裡。
 *   YouTube：用 YouTube 官方嵌入播放器播放（歌曲本身不放進網站、不下載）。依 YouTube 嵌入規定，播放器必須看得到、
 *            高度至少 200px → 登入畫面左下角放一個小播放器（可以按 ✕ 換回原本的音樂）。
 *            這首歌不允許嵌入或無法播放時，自動換回原本的音樂並提示。
 *   只在登入畫面（標題）播放；進創角或進遊戲就停，遊戲音樂照舊。音量跟遊戲的「背景音樂」設定一樣；背景音樂關著就不播。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'radio', name: '電台（登入畫面音樂自選）', group: '遊戲介面',
    desc: '首頁「外掛」按鈕旁的電台：登入畫面要聽原本的音樂，還是 YouTube 的歌（用 YouTube 官方播放器）' });
  var on = function () { return !T || T.enabled('radio'); };
  var VID = 'L1kfiXB7nFM', KEY = 'afk_radio_choice';
  var CH = [{ id: 'orig', n: '原本的登入音樂', ic: '🎵' }, { id: 'yt', n: 'YouTube 歌曲', ic: '▶' }];
  var choice = function () { try { return localStorage.getItem(KEY) === 'yt' ? 'yt' : 'orig'; } catch (e) { return 'orig'; } };
  var setChoice = function (v) { try { localStorage.setItem(KEY, v); } catch (e) {} };
  var title = '';   // YouTube 播放器讀到的歌名
  var cfgOn = function () { try { return !(typeof _bgmCfg !== 'undefined' && _bgmCfg && _bgmCfg.on === false); } catch (e) { return true; } };
  var vol = function () { try { return Math.max(0, Math.min(100, Number(_bgmCfg.vol))); } catch (e) { return 35; } };
  var inGame = function () { var gs = document.getElementById('game-screen'); return !!(gs && !gs.classList.contains('hidden')); };
  var standalone = function () { try { return !!new URLSearchParams(location.search).get('view'); } catch (e) { return false; } };

  // ── 跟核心背景音樂協調：選了 YouTube 時，登入畫面不放原本的曲子 ──
  var oDetect = W._bgmDetectScene;
  var wantYt = function () { return on() && choice() === 'yt' && cfgOn(); };
  var isTitle = function () { try { return oDetect && oDetect() === 'title'; } catch (e) { return false; } };
  if (typeof oDetect === 'function') {
    W._bgmDetectScene = function () {
      var s = oDetect.apply(this, arguments);
      if (s === 'title' && wantYt() && !failed) return 'afk_radio';   // 沒有對應音檔 → 核心不會播；切走前先把原本的停掉（見 sync）
      return s;
    };
  }

  // ── YouTube 播放器 ──
  var player = null, apiLoading = false, apiReady = false, failed = false, box = null;
  var loadApi = function (cb) {
    if (apiReady && W.YT && W.YT.Player) { cb(); return; }
    var prev = W.onYouTubeIframeAPIReady;
    W.onYouTubeIframeAPIReady = function () { apiReady = true; try { if (typeof prev === 'function') prev(); } catch (e) {} cb(); };
    if (apiLoading) return; apiLoading = true;
    var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = function () { fail('連不上 YouTube'); };
    document.head.appendChild(s);
  };
  var css = function () {
    if (document.getElementById('afk-radio-css')) return;
    var st = document.createElement('style'); st.id = 'afk-radio-css';
    st.textContent = '#afk-radio-btn{position:fixed;z-index:100001;background:rgba(15,23,42,.92);border:1px solid #64748b;color:#e2e8f0;border-radius:8px;padding:4px 9px;font-size:14px;font-weight:700;line-height:1.35;cursor:pointer}'
      + '#afk-radio-menu{position:fixed;z-index:100002;background:#0f172a;border:1px solid #475569;border-radius:8px;padding:6px;min-width:220px;box-shadow:0 8px 24px rgba(0,0,0,.5)}'
      + '#afk-radio-menu button{display:block;width:100%;text-align:left;padding:6px 8px;border-radius:6px;color:#e2e8f0;font-size:14px;background:transparent;border:0;cursor:pointer}'
      + '#afk-radio-menu button:hover{background:#1e293b}#afk-radio-menu button.on{background:#1d4ed8}'
      + '#afk-radio-menu small{display:block;color:#94a3b8;font-size:11px;padding:4px 8px 0}'
      + '#afk-radio-box{position:fixed;left:8px;bottom:8px;z-index:100000;width:356px;max-width:calc(100vw - 16px);background:#020617;border:1px solid #475569;border-radius:8px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.6)}'
      + '#afk-radio-box .hd{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:3px 8px;font-size:12px;color:#cbd5e1;background:#0f172a}'
      + '#afk-radio-box .hd span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#afk-radio-box .hd button{color:#e2e8f0;background:transparent;border:0;font-size:14px;cursor:pointer}'
      + '#afk-radio-box .pl{width:100%;aspect-ratio:16/9;min-height:200px}#afk-radio-box iframe{width:100%;height:100%;display:block}';
    document.head.appendChild(st);
  };
  var showBox = function () {
    css();
    if (box) return box;
    box = document.createElement('div'); box.id = 'afk-radio-box';
    box.innerHTML = '<div class="hd"><span id="afk-radio-title">📻 電台：載入中…</span><button type="button" title="換回原本的登入音樂" data-r="close">✕</button></div><div class="pl"><div id="afk-radio-yt"></div></div>';
    box.addEventListener('click', function (e) { var b = e.target.closest('[data-r="close"]'); if (b) pick('orig'); });
    document.body.appendChild(box);
    return box;
  };
  var setTitle = function () { var el = document.getElementById('afk-radio-title'); if (el) el.textContent = '📻 電台：' + (title || 'YouTube'); };
  var stopYt = function () {
    try { if (player && player.destroy) player.destroy(); } catch (e) {}
    player = null;
    if (box && box.parentNode) box.parentNode.removeChild(box); box = null;
  };
  var fail = function (why) {
    failed = true; stopYt();
    try { if (typeof _bgmScene !== 'undefined') _bgmScene = null; if (typeof _bgmTick === 'function') _bgmTick(); } catch (e) {}
    toast('📻 這首歌現在沒辦法播放（' + why + '），先換回原本的登入音樂。');
  };
  var startYt = function () {
    showBox();
    if (player) return;
    loadApi(function () {
      if (player || !box) return;
      try {
        player = new W.YT.Player('afk-radio-yt', {
          host: 'https://www.youtube-nocookie.com', videoId: VID, width: '100%', height: '100%',
          playerVars: { autoplay: 1, loop: 1, playlist: VID, playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: function (e) { try { e.target.setVolume(vol()); e.target.playVideo(); var d = e.target.getVideoData && e.target.getVideoData(); if (d && d.title) title = d.title; setTitle(); } catch (er) {} },
            onStateChange: function (e) { try { var d = e.target.getVideoData && e.target.getVideoData(); if (d && d.title && d.title !== title) { title = d.title; setTitle(); } } catch (er) {} },
            onError: function (e) { var c = e && e.data; fail(c === 101 || c === 150 ? '作者不允許在其他網站播放' : c === 100 ? '影片不存在或已刪除' : '錯誤 ' + c); }
          }
        });
      } catch (e) { fail('播放器建立失敗'); }
    });
  };
  // ── 每 0.5 秒同步：該不該放、原本的曲子要不要停 ──
  var sync = function () {
    var should = wantYt() && !failed && !inGame() && !standalone() && isTitle();
    if (should) {
      try { if (typeof _bgmScene !== 'undefined' && _bgmScene === 'title' && typeof _bgmStopAll === 'function') { _bgmStopAll(); _bgmScene = 'afk_radio'; } } catch (e) {}
      startYt();
      try { if (player && player.setVolume) player.setVolume(vol()); } catch (e) {}
    } else if (player || box) stopYt();
    placeBtn();
  };

  // ── 按鈕與選單（外掛按鈕旁邊）──
  var toast = function (msg) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:100003;background:#0f172a;border:1px solid #f59e0b;color:#fde68a;padding:8px 12px;border-radius:8px;font-size:13px;max-width:90vw';
    document.body.appendChild(t); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 5000);
  };
  var closeMenu = function () { var m = document.getElementById('afk-radio-menu'); if (m && m.parentNode) m.parentNode.removeChild(m); };
  var pick = function (v) {
    setChoice(v); failed = false; closeMenu();
    if (v === 'orig') { stopYt(); try { _bgmScene = null; _bgmTick(); } catch (e) {} }
    sync();
  };
  var openMenu = function (btn) {
    css(); if (document.getElementById('afk-radio-menu')) { closeMenu(); return; }
    var m = document.createElement('div'); m.id = 'afk-radio-menu';
    var cur = choice(), r = btn.getBoundingClientRect();
    m.style.left = r.left + 'px'; m.style.top = (r.bottom + 4) + 'px';
    m.innerHTML = CH.map(function (c) { return '<button type="button" data-v="' + c.id + '" class="' + (c.id === cur ? 'on' : '') + '">' + c.ic + ' ' + (c.id === 'yt' && title ? 'YouTube：' + title.replace(/[<>&"]/g, '') : c.n) + (c.id === cur ? '　✓' : '') + '</button>'; }).join('')
      + '<small>只在登入畫面播放；音量跟「背景音樂」設定一樣。YouTube 的歌用官方播放器，會在左下角顯示小視窗。' + (cfgOn() ? '' : '<br>（背景音樂目前關著，兩種都不會播）') + '</small>';
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
  var boot = function () { placeBtn(); sync(); setInterval(function () { if (!document.hidden) sync(); }, 500); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  W.__afkRadio = { VID: VID, choice: choice, pick: pick, sync: sync, state: function () { return { player: !!player, box: !!box, failed: failed, title: title }; } };
})();
