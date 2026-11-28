/* ============================================================================
 * afk-synccompress.js — 存檔即時壓縮（11-17 起預設開，可在 🎚️ 介面 取消）
 *
 * 為什麼需要:上游 commit d8e583539(2026-07-11)把 _lzSet 從「同步壓縮」改成
 *   「先寫原文、背景 Worker 事後壓」以避免大存檔壓縮卡主線。立意雖好,卻引進一個空窗:
 *   存檔到「Worker 壓完」之間,頁面若被登出/重整/關閉 → Worker 連同還沒壓的工作一起被殺
 *   → 那格永遠留在「未壓縮原文」(比壓縮版大 ~10 倍)。
 *   手機 PWA 每次登出(存檔後 ~32ms 就 location.reload)、多開狂存,都會讓「當前活躍存檔格」
 *   卡在原文 → localStorage 迅速爆滿 → setItem 失敗 → 角色/倉庫資料消失(已有玩家中獎)。
 *
 * 做法:開啟後把 _lzSet 的「網頁路徑」換回作者 d8e583539 之前的同步壓縮——存檔當下就壓成
 *   LZ1 再寫入,沒有非同步空窗;不論登出/關頁/多開,存進去的一定是壓縮版。
 *   關閉(預設)時完全透明放行上游原版(非同步)行為,一個 byte 都不改。
 *
 * 取捨:開啟後每次存檔會當場壓一次(桌機約 17~92ms、手機大存檔可達 ~425ms),故預設關,
 *   讓有「爆滿/存檔消失」困擾的重度或多開玩家自行開啟(在「檢查存檔大小」看到很多「未壓縮」時)。
 *   打包版(window.fableStore=檔案存檔·不受 localStorage 配額限制)不插手。
 *
 * 掛接:在 index.html </body> 前、afk-toggles 之後、任何會存檔的外掛之前載入(緊接 afk-lzcache)。
 * ========================================================================== */
(function () {
  'use strict';

  if (window.AFK_TOGGLES) AFK_TOGGLES.register({
    id: 'synccompress', name: '存檔即時壓縮', group: '系統與其他', def: true,
    desc: '避免存檔爆掉害角色或倉庫消失；代價是存檔時多花一點時間（建議開著）'
  });
  // 玩家 11-17：改成全部強制開一次——舊的「關」設定清掉一次（之後玩家在 🎚️ 介面 自己取消勾選才會關）
  try { if (!localStorage.getItem('afk_synccompress_on1117')) { if (window.AFK_TOGGLES && AFK_TOGGLES.set) AFK_TOGGLES.set('synccompress', true); else localStorage.removeItem('afk_toggle_synccompress'); localStorage.setItem('afk_synccompress_on1117', '1'); } } catch (e) {}

  if (typeof _lzSet !== 'function' || typeof LZString === 'undefined' || typeof LZString.compressToUTF16 !== 'function') {
    console.warn('[AFK-synccompress] 找不到 _lzSet / LZString，停用（遊戲照常運作）。');
    return;
  }
  if (_lzSet.__afkSync) { console.log('[AFK-synccompress] hooks OK'); return; }   // 冪等:重複載入不疊包

  var _orig = _lzSet;

  // ── 11-28（Ping 15:50 同意）：一般自動存檔改成背景壓縮 ──
  //   只限「目前角色的存檔」、畫面開著、不是關頁／切背景的最後存檔。做法跟原本的空窗問題不同：
  //   不先寫原文；磁碟上保留上一份壓縮存檔，背景壓好才換上去（所以不會留下未壓縮的大存檔）。
  //   壓好時若磁碟已被別的寫入換掉（別的分頁、還原備份、職業變更、之後又存了一次）就放棄這份。
  //   代價（Ping 已接受）：剛存完零點幾秒內頁面當掉，這一次不算；正常關頁、切背景、登出都會當場重存。
  var CSRC = LZString._compress.toString(), USRC = LZString.compressToUTF16.toString();   // 在 afk-fastlz 換掉之前記下原版（Worker 用，輸出逐位元相同）
  var bgW = null, bgBad = false, bgSeq = 0, pend = {};
  var slotKey = function () { return typeof currentSlot !== 'undefined' ? 'lineage_idle_save_' + currentSlot : ''; };
  var revOf = function (k) { try { return (_lzWorkerRev && _lzWorkerRev[k]) || 0; } catch (e) { return 0; } };
  var bump = function (k) { try { _lzWorkerRev[k] = (_lzWorkerRev[k] || 0) + 1; return _lzWorkerRev[k]; } catch (e) { return 0; } };
  var writePacked = function (k, job, packed) {
    if (pend[k] !== job) return false;
    delete pend[k];
    if (revOf(k) !== job.rev || rawGet(k) !== job.disk) return false;   // 期間有別的寫入 → 放棄（不能蓋掉比較新的資料）
    var ok = _lsSet(k, packed);
    if (!ok) ok = _lsSet(k, job.json);
    try { if (ok && job.fp && window.__afkSaveLite && __afkSaveLite.adopt) __afkSaveLite.adopt(k, rawGet(k), job.fp); } catch (e) {}
    return ok;
  };
  var syncFinish = function (k) {   // Worker 壞掉或要關頁：當場壓完寫入
    var job = pend[k]; if (!job) return;
    var packed = null; try { packed = 'LZ1:' + LZString.compressToUTF16(job.json); } catch (e) { packed = null; }
    if (packed == null) packed = job.json;
    writePacked(k, job, packed);
  };
  var worker = function () {
    if (bgW || bgBad) return bgW;
    try {
      var src = 'var f=String.fromCharCode,LZString={};\nLZString._compress=' + CSRC + ';\nLZString.compressToUTF16=' + USRC + ';\n'
        + 'self.onmessage=function(e){var d=e.data;try{self.postMessage({id:d.id,packed:"LZ1:"+LZString.compressToUTF16(d.value)});}catch(err){self.postMessage({id:d.id,error:true});}};';
      bgW = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      bgW.onmessage = function (e) {
        var d = e.data || {}; var k = null; for (var x in pend) if (pend[x].id === d.id) k = x;
        if (k == null) return;
        if (d.error || typeof d.packed !== 'string') { syncFinish(k); return; }
        writePacked(k, pend[k], d.packed);
      };
      bgW.onerror = function () { bgBad = true; try { bgW.terminate(); } catch (e) {} bgW = null; Object.keys(pend).forEach(syncFinish); };
    } catch (e) { bgBad = true; bgW = null; }
    return bgW;
  };
  var flushAll = function () { Object.keys(pend).forEach(function (k) { if (pend[k] && revOf(k) === pend[k].rev) syncFinish(k); else delete pend[k]; }); };
  window.addEventListener('pagehide', flushAll); window.addEventListener('beforeunload', flushAll);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flushAll(); });
  var bgOk = function (key, jsonStr) {
    if (!window.AFK_TOGGLES || !AFK_TOGGLES.enabled('synccompress') || window.fableStore) return false;
    if (key !== slotKey() || window.__fb5CloseFlush || document.hidden || typeof jsonStr !== 'string' || jsonStr.length < 100000) return false;
    var disk = rawGet(key); if (disk == null || disk.slice(0, 4) !== 'LZ1:') return false;   // 第一次存、或磁碟上不是壓縮版：照舊當場存
    return worker() ? disk : false;
  };
  // 讀到排隊中的那一格（例如存完馬上讀回檢查）：先當場壓完寫入再讀，讀到的一定是剛存的
  var rawGet = _lsGet;
  _lsGet = function (k) { if (pend[k]) syncFinish(k); return rawGet.apply(this, arguments); };
  try { window._lsGet = _lsGet; } catch (e) {}
  window.__afkBgSave = { pending: function () { return Object.keys(pend).length; }, flush: flushAll, broken: function () { return bgBad; } };

  var _syncLzSet = function (key, jsonStr) {
    // 開關關 / 讀不到開關中樞 / 打包版 → 完全用回上游原版(非同步)行為,不改任何 byte
    if (!window.AFK_TOGGLES || !AFK_TOGGLES.enabled('synccompress') || window.fableStore) return _orig(key, jsonStr);
    var disk = bgOk(key, jsonStr);
    if (disk) {
      var fp = ''; try { fp = (typeof _roleFingerprint === 'function' && player) ? _roleFingerprint(player) : ''; } catch (e) {}
      var job = { id: ++bgSeq, rev: bump(key), json: jsonStr, disk: disk, fp: fp };
      pend[key] = job;
      try { bgW.postMessage({ id: job.id, value: jsonStr }); return true; } catch (e) { delete pend[key]; }
    }
    if (pend[key]) delete pend[key];   // 這次當場存：之前排隊的背景結果作廢
    // 同步壓縮(還原作者 d8e583539 之前的版本):存檔當下就壓成 LZ1,無非同步空窗
    try { if (typeof _lzWorkerRev !== 'undefined' && _lzWorkerRev) _lzWorkerRev[key] = (_lzWorkerRev[key] || 0) + 1; } catch (e) {}   // 讓任何在途的舊 Worker 結果失效(rev 不符→其 onmessage 放棄),不會回頭用舊原文蓋掉我們剛壓好的版本
    var packed = null;
    try { packed = 'LZ1:' + LZString.compressToUTF16(jsonStr); } catch (e) { packed = null; }
    if (packed != null && _lsSet(key, packed)) return true;
    if (_lsSet(key, jsonStr)) return true;   // 壓縮或寫入失敗 → 退原文(與作者原版 fallback 一致)
    if (typeof logSys === 'function') logSys('<span class="text-red-400 font-bold">⚠ 儲存空間不足，存檔可能未完整寫入。</span>');
    return false;
  };
  _syncLzSet.__afkSync = true;
  _lzSet = _syncLzSet;   // 覆寫全域:核心 saveGame/saveWarehouse/血盟… 呼叫的 _lzSet 都會指到這裡

  console.log('[AFK-synccompress] hooks OK');
})();
