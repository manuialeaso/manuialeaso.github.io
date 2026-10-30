/* ============================================================================
 * afk-savelite.js — 存檔減負（玩家 2026-10-30 18:10「每 5 秒自動存檔有用嗎？會卡吧」；外掛開關 savelite，預設開）
 *
 *   查到的事實（10-30 存檔，王族 Lv100＋7 傭兵，桌機）：
 *   - 核心的定時自動存檔是每 5 分鐘一次；但「每殺一隻頭目就整份存一次」（js/05 killMob），
 *     刷王房頭目 5 秒重生 → 最快每 5 秒一次全量存檔。
 *   - 一次存檔 50～100 ms（手機約 3～5 倍）：存檔前的角色檢查 _roleSaveAllowed 約 24 ms（每次都把磁碟上
 *     整份存檔解壓＋驗簽＋JSON.parse 一遍，只為了比對角色指紋，而且一次存檔問兩次）、序列化 12 ms、簽章 12 ms、
 *     「存檔即時壓縮」開著時再加約 40 ms。
 *
 *   做法（兩件）：
 *   一、角色檢查快取：記住「磁碟上那份存檔的原始字串 → 角色指紋」。磁碟內容沒變（同一個字串）就直接用記住的指紋；
 *       自己剛存進去的、背景壓縮換成壓縮版的，都直接更新記錄；任何別的寫入（還原備份、別的外掛、別的分頁）→ 字串不同 → 照原本重讀。
 *       判斷結果跟原本完全一樣，只是不用每次重讀。
 *   二、頭目擊殺存檔節流：殺頭目觸發的存檔，距離上一次存檔不到 30 秒就先記著，30 秒到了再補存一次。
 *       關頁、切到背景、回城、換地圖、手動存檔、5 分鐘定時存檔都照樣立刻存；最壞情況（瀏覽器當掉）少存最多 30 秒。
 *   關掉開關＝完全原本的行為。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'savelite', name: '存檔減負', group: '系統與其他',
    desc: '打頭目觸發的自動存檔最多 30 秒一次（關頁、切背景、回城、定時存檔照樣立刻存）；存檔前的角色檢查不再每次重讀整份存檔，減少卡頓' });
  var on = function () { return !T || T.enabled('savelite'); };
  var GAP = 30000;
  if (typeof W.saveGame !== 'function' || typeof W._roleSaveAllowed !== 'function' || typeof W._lsSet !== 'function') return;
  var KEY = function () { return 'lineage_idle_save_' + currentSlot; };
  var st = { saves: 0, skipped: 0, cacheHit: 0, cacheMiss: 0 };

  // ── 一、角色檢查快取 ──
  var cache = null, inSave = 0, saveFp = '', inWorker = 0;
  var oLsSet = W._lsSet;
  W._lsSet = function (k, v) {
    var r = oLsSet.apply(this, arguments);
    try {
      if (typeof k === 'string' && k.indexOf('lineage_idle_save_') === 0) {
        if (r && inSave && saveFp && k === KEY()) cache = { key: k, raw: v, fp: saveFp };          // 自己剛存的：指紋就是目前角色
        else if (r && inWorker && cache && cache.key === k) cache.raw = v;                            // 背景壓縮把同一份換成壓縮版（核心已確認磁碟沒被別人改過）
        else if (cache && cache.key === k) cache = null;                                             // 其他任何寫入：作廢
      }
    } catch (e) { cache = null; }
    return r;
  };
  try { _lsSet = W._lsSet; } catch (e) {}
  var oSetRaw = W._lzSetStoredRaw;
  if (typeof oSetRaw === 'function') { W._lzSetStoredRaw = function () { cache = null; var w = inSave; inSave = 0; try { return oSetRaw.apply(this, arguments); } finally { inSave = w; cache = null; } }; }
  var oGetW = W._getLzWorker;
  if (typeof oGetW === 'function') {
    W._getLzWorker = function () {
      var w = oGetW.apply(this, arguments);
      try {
        if (w && !w.__afkSaveLite && typeof w.onmessage === 'function') {
          var om = w.onmessage; w.__afkSaveLite = true;
          w.onmessage = function () { inWorker++; try { return om.apply(this, arguments); } finally { inWorker--; } };
        }
      } catch (e) {}
      return w;
    };
  }
  var storedFp = function (slot) {
    var k = 'lineage_idle_save_' + slot, raw = _lsGet(k);
    if (cache && cache.key === k && cache.raw === raw) { st.cacheHit++; return cache.fp; }
    st.cacheMiss++;
    var sp = _roleReadSavePlayer(slot), fp = sp ? _roleFingerprint(sp) : null;
    cache = { key: k, raw: raw, fp: fp };
    return fp;
  };
  var oAllowed = W._roleSaveAllowed;
  W._roleSaveAllowed = function () {
    if (!on() || typeof _roleReadSavePlayer !== 'function' || typeof _roleFingerprint !== 'function' || typeof ROLE_DELETED_GUARD_KEY === 'undefined') return oAllowed.apply(this, arguments);
    var fp = _roleFingerprint(player);
    if (!fp) return false;
    var guards = _roleReadObject(ROLE_DELETED_GUARD_KEY), sfp = storedFp(currentSlot);
    if (guards[fp] && sfp !== fp) return false;   // 同核心：已刪除名單只擋不在這格的角色
    return !sfp || sfp === fp;
  };
  try { _roleSaveAllowed = W._roleSaveAllowed; } catch (e) {}

  // ── 二、頭目擊殺存檔節流 ──
  var inKill = 0, lastSave = 0, pending = false, pendSlot = null;
  var oKill = W.killMob;
  if (typeof oKill === 'function') {
    W.killMob = function () { inKill++; try { return oKill.apply(this, arguments); } finally { inKill--; } };
    try { killMob = W.killMob; } catch (e) {}
  }
  var oSave = W.saveGame;
  W.saveGame = function () {
    var now = Date.now();
    if (on() && inKill && !W.__fb5CloseFlush && now - lastSave < GAP) { pending = true; pendSlot = currentSlot; st.skipped++; return true; }
    inSave++; try { saveFp = (typeof _roleFingerprint === 'function' && player) ? _roleFingerprint(player) : ''; } catch (e) { saveFp = ''; }
    var r;
    try { r = oSave.apply(this, arguments); } finally { inSave--; if (!inSave) saveFp = ''; }
    if (r) { lastSave = Date.now(); pending = false; st.saves++; }
    return r;
  };
  try { saveGame = W.saveGame; } catch (e) {}
  var flushTick = function () {
    try {
      if (!pending) return;
      if (pendSlot !== currentSlot || !player || !player.cls) { pending = false; return; }
      if (Date.now() - lastSave < GAP || player.dead) return;
      pending = false; W.saveGame();
    } catch (e) {}
  };
  setInterval(flushTick, 1000);
  W.__afkSaveLite = { GAP: GAP, tick: flushTick, stats: function () { return { saves: st.saves, skipped: st.skipped, cacheHit: st.cacheHit, cacheMiss: st.cacheMiss, pending: pending }; }, _cache: function () { return cache; } };
})();
