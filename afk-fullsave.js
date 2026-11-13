/* ============================================================================
 * afk-fullsave.js — 完整資料備份與還原(本機檔案·零後端)
 *
 * 解決什麼:核心 exportSave/importSave 一次只搬「一格角色」,而倉庫/寵物/收集冊/血盟
 *   是附在該格匯出檔裡的快照,匯入還要逐項 confirm。16 格角色要來回 16 次
 *   (afk-reissueid 的警語就是叫玩家每隻各匯一次)。這裡一次搬完整台的遊戲資料。
 *   方案與取捨見 docs/save-transfer.md「方案①」。
 *
 * 🚨 整包搬,不挑 key——連白名單都不要:
 *   一度寫成「只搬 lineage_idle_/fb5_/afk_/dograce_ 前綴」,已否決。任何形式的清單都要跟著
 *   上游走,作者哪天新增一個 key 我們不會知道,漏搬是**安靜失效**(玩家搬完、玩一陣子才發現
 *   東西不見,而且查不出來)。正確性論證很硬:B 變成 A 的完整複本,A 跑得動 B 就跑得動。
 *   → 匯出 localStorage 全部 key,還原時把現有的全部清掉再原樣寫回。新增功能自動涵蓋,零維護。
 *
 * 還原的安全設計(每一條都是「弄壞玩家存檔」的防線):
 *   ① 備份只用**文字建議**(確認框裡提醒「先按上面的匯出」),刻意不做「強制自動下載一份」——
 *      瀏覽器擋下載、玩家按取消、手機存到哪都偵測不到,download() 回 true 只代表「觸發了動作」,
 *      拿它當前置條件是假保證,只換來多兩個對話框。
 *      也刻意不做記憶體快照回滾:整包 localStorage 讀進 JS 是 UTF-16、體積 ×2,加上新包本身,
 *      在 iOS 上等於自找記憶體壓力。
 *   ② 寫入前只驗「這是不是我們自己產生的檔、有沒有缺角」——format / schema / keyCount /
 *      每個值都是字串,**全是本檔自己寫進去的欄位**,驗不過一個字都不寫。
 *      🚨 絕不檢查 keys 裡裝什麼(有沒有角色存檔、key 叫什麼):認得內容就是對上游存檔格式
 *      做假設,作者改個名字就會把所有合法備份檔擋在門外,而且是在玩家換裝置時才爆。
 *   ③ clear() 全清再原樣寫回(配額峰值最低);中途寫失敗立刻停手並明講要用備份檔救回來。
 *      在途的背景壓縮不會來搗亂:worker 回來時會比對 _lsGet(key) 是不是它記得的原值
 *      (js/00-data.js:136),clear 過或已被新值覆蓋都對不上 → 自己 return 不寫。
 *   ④ 寫入一律走 _lzSetStoredRaw(原值原樣直寫+bump rev 讓在途壓縮失效)。
 *      不可用 _lzSet:它先寫明文再背景壓縮,明文可能當場撐爆 5MB 配額。
 *   ⑤ 入口在首頁設定選單(afk-storage,掛在 #main-menu)→ 天然只有主選單開得到,
 *      不會發生「遊戲中還原完,記憶體裡的舊 player 又被 saveGame 寫回去」。
 *
 * 🔑 轉移碼(2026-08-01 加·子開關 fullsavecode):同一包資料改用「六碼」搬,免存檔案。
 *   A 按「產生轉移碼」→ 整包上傳到 Litterbox → 拿它回傳的六碼;B 輸入六碼 → 抓回來 → 走上面同一條還原流程。
 *   打包/驗證/寫入完全共用,轉移碼只是換一個「把那包交出去」的管道。
 *
 *   為什麼是 Litterbox(catbox.moe 的暫存版):比較過 Pixeldrain / Catbox / Uguu / Filebin /
 *   file.io / JSONBin,**只有它兩半都在瀏覽器裡通、而且 `file://` 也通**(實機驗過)。
 *     - Pixeldrain / JSONBin:要 API 金鑰 → 金鑰得放進公開 repo,等於把帳號送人
 *     - Catbox(永久版) / Uguu:上傳或下載沒有 CORS 標頭 → 瀏覽器讀不到回應,拿不到網址
 *     - Filebin:上傳可以、**下載不行**——它看 User-Agent,瀏覽器一律拿到導頁 HTML 而不是檔案
 *   詳細比較與實測數字見 docs/save-transfer.md。
 *
 *   🚨 這條路會把玩家整包資料送到第三方主機,所以:
 *     ① 面板文字要講明「暫存在網路上、24 小時後自動刪除」——這是玩家決定按不按的依據。
 *     ② 獨立子開關,關掉只剩檔案那半(它是本機、零依賴的保底,永遠不能被雲端取代)。
 *     ③ 對方掛掉/沒網路時訊息要把玩家導回檔案那半,不要只說「失敗」。
 *
 *   ⚠️ 碼是伺服器給的小寫英數六碼(如 `4wz0fn`)、**大小寫敏感**(`4WZ0FN` → 404)。
 *     跨裝置是「看著 A 的螢幕在 B 上打字」,`0`/`o`、`1`/`l` 一定有人看錯 → 輸入端自動轉小寫、
 *     去空白,找不到時明講可能是看錯了。**絕不可自動把 o 換成 0 再試一次**:那可能抓到
 *     別人的存檔並覆蓋玩家進度。沒機密性歸沒機密性,還原到別人的存檔是災難。
 *
 * 優雅降級:缺 _lzSetStoredRaw / AFK_SETTINGS 就 console.warn 後安靜停用。
 * ========================================================================== */
(function () {
  'use strict';
  var VER = ((document.currentScript && /[?&]v=([\w]+)/.exec(document.currentScript.src)) || [])[1] || '';   // 錯誤訊息附版本，分辨手機是否還在跑舊版

  if (window.AFK_TOGGLES) AFK_TOGGLES.register({
    id: 'fullsave', parent: 'storage', name: '完整資料備份與還原', group: '系統與其他', def: true,
    desc: '把整台裝置的遊戲資料存成一個檔案，換手機時一次搬完，也可以傳給作者查問題'
  });
  function on() { try { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('fullsave'); } catch (e) { return true; } }

  if (window.AFK_TOGGLES) AFK_TOGGLES.register({
    id: 'fullsavecode', parent: 'fullsave', name: '用轉移碼搬家', group: '系統與其他', def: true,
    desc: '用六碼把資料搬到另一台裝置；資料會暫存在網路上，24 小時後自動刪除'
  });
  function codeOn() { try { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled('fullsavecode'); } catch (e) { return true; } }

  if (typeof window._lzSetStoredRaw !== 'function') {
    try { console.warn('[AFK-fullsave] 缺核心 _lzSetStoredRaw,完整資料備份與還原停用。'); } catch (e) {}
    return;
  }

  var FORMAT = 'idle-lineage-full';
  var SCHEMA = 1;

  function lsKeys() {
    var out = [];
    for (var k in localStorage) { if (Object.prototype.hasOwnProperty.call(localStorage, k)) out.push(k); }
    return out;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function stamp() {
    var d = new Date(), p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  // 檔案裡只有三個「我們自己寫的」欄位:format(認得是不是我們的檔)、exportedAt(給玩家確認)、
  // keyCount(檔案有沒有被截斷)。keys 內容一律原封不動,不解析、不認識、不判斷。
  // 11-11：角色存檔、倉庫若是沒壓縮的明文（一格可達 180 萬字），打包時先壓縮——檔案小很多，手機也寫得進去（遊戲讀取本來就會自動解壓）
  function packVal(k, v) {
    if (typeof LZString === 'undefined' || typeof v !== 'string' || v.length < 20000 || v.slice(0, 4) === 'LZ1:') return v;
    if (!/^lineage_idle_save(?:_\d+)?$/.test(k) && !/^lineage_idle_warehouse(?:_[a-z]+)*$/.test(k)) return v;
    try { var z = 'LZ1:' + LZString.compressToUTF16(v); return LZString.decompressFromUTF16(z.slice(4)) === v ? z : v; } catch (e) { return v; }
  }
  function buildPack() {
    var keys = {}, n = 0;
    lsKeys().forEach(function (k) { if (k === 'lineage_growth_transaction_backup_v1') return; var v = localStorage.getItem(k); if (v != null) { keys[k] = packVal(k, v); n++; } });   // 11-11：舊版交易備份（約 5MB）不打包
    return { format: FORMAT, schema: SCHEMA, exportedAt: new Date().toISOString(), keyCount: n, keys: keys };
  }

  // 🔁 與核心 exportSave(js/13:558)同一套,不要自己另立一種:showSaveFilePicker 可用就用
  //    (Chrome/Edge,含 Android → 跳出「選存到哪」),AbortError=玩家自己取消、不算失敗,
  //    其他錯或不支援(iOS Safari / Firefox)才退回 <a download>。
  //    ⚠️ 少了這段兩個匯出的手感就不一致——玩家實測:核心那顆會跳選擇位置,我們這顆直接下載。
  //    讓玩家自己挑位置順便繞開「Android 存到下載資料夾變 0 byte」的情形。
  function download(text, fname) {
    if (typeof window.showSaveFilePicker === 'function') {
      return window.showSaveFilePicker({
        suggestedName: fname,
        types: [{ description: '備份檔', accept: { 'application/json': ['.json'] } }]
      }).then(function (handle) {
        return handle.createWritable().then(function (w) {
          return w.write(text).then(function () { return w.close(); }).then(function () { return 'saved'; });
        });
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return 'cancel';   // 玩家自己按取消,不是失敗
        return downloadFallback(text, fname);                // 其他錯(權限/沙箱)→ 照舊下載
      });
    }
    return Promise.resolve(downloadFallback(text, fname));
  }
  function downloadFallback(text, fname) {
    try {
      var blob = new Blob([text], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return 'saved';
    } catch (e) { return 'fail'; }
  }

  function doExport() {
    var fname = 'idle-lineage-backup-' + stamp() + '.json';
    var text;
    try { text = JSON.stringify(buildPack()); }
    catch (e) { note('❌ 打包失敗：' + (e && e.message || e), true); return Promise.resolve(null); }
    return download(text, fname).then(function (r) {
      if (r === 'cancel') return null;
      if (r !== 'saved') { note('❌ 存檔失敗（瀏覽器可能擋住了下載）。', true); return null; }
      return { fname: fname };
    });
  }

  // ── 轉移碼(同一包資料,換一個交出去的管道) ────────────────────
  var LB_UPLOAD = 'https://litterbox.catbox.moe/resources/internals/api.php';
  var LB_FILE   = 'https://litter.catbox.moe/';
  var LB_EXPIRY = '24h';        // 1h/12h/24h/72h。選 24h:玩家常常上傳完跑去做別的事,1 小時真的會過期
  var CODE_RE   = /^[a-z0-9]{6}$/;

  // 回傳的是 https://litter.catbox.moe/4wz0fn.json → 取出中間那六碼
  function codeFromUrl(url) {
    var m = String(url || '').trim().match(/([a-z0-9]{6})\.json\s*$/i);
    return m ? m[1].toLowerCase() : '';
  }
  // 玩家可能打成大寫、前後帶空白;整串網址貼進來也一併吃掉(不寫在提示裡,但別讓他走進死路)
  function normalizeCode(s) {
    var t = String(s || '').trim().toLowerCase();
    if (t.indexOf('/') >= 0) t = t.slice(t.lastIndexOf('/') + 1);
    return t.replace(/\.json$/, '').trim();
  }

  function uploadPack() {
    var text;
    try { text = JSON.stringify(buildPack()); }
    catch (e) { return Promise.reject(new Error('打包失敗：' + (e && e.message || e))); }
    var fd = new FormData();
    fd.append('reqtype', 'fileupload');
    fd.append('time', LB_EXPIRY);
    fd.append('fileToUpload', new Blob([text], { type: 'application/json' }), 'save.json');
    // 11-11：轉移服務偶爾回 5xx（暫時忙不過來）→ 隔 2 秒、5 秒各自動重試一次
    var tryUp = function (left) {
      return fetch(LB_UPLOAD, { method: 'POST', body: fd }).then(function (r) {
        if (!r.ok) {
          if (r.status >= 500 && left > 0) return new Promise(function (ok) { setTimeout(ok, left === 2 ? 2000 : 5000); }).then(function () { return tryUp(left - 1); });
          throw new Error('上傳失敗（' + r.status + (r.status >= 500 ? '，轉移服務那邊暫時出問題，等幾分鐘再試' : '') + '）');
        }
        return r.text();
      });
    };
    return tryUp(2).then(function (url) {
      var code = codeFromUrl(url);
      if (!code) throw new Error('上傳結果看不懂');
      return code;
    });
  }

  function downloadByCode(code) {
    return fetch(LB_FILE + code + '.json', { cache: 'no-store' }).then(function (r) {
      if (r.status === 404) throw new Error('NOTFOUND');
      if (!r.ok) throw new Error('讀取失敗（' + r.status + '）');
      return r.text();
    });
  }

  // ── 還原 ───────────────────────────────────────────────────
  // 只驗「是不是我們自己產生的檔、完不完整」——format / schema / keyCount 全是本檔自己寫進去的欄位。
  // 🚨 絕不檢查 keys 裡面裝什麼(有沒有角色存檔、key 叫什麼名字):那是對上游存檔格式的假設,
  //    作者哪天改名,所有合法備份檔都會被拒收,而且是在玩家換裝置時才炸。
  function validate(text) {
    var d;
    try { d = JSON.parse(String(text || "").replace(/^\ufeff/, "")); } catch (e) { d = null; }   // 容許 UTF-8 BOM
    // 空檔也走這條(Android 下載到「下載」資料夾有變成 0 byte 的情形)→ 訊息要涵蓋,不然玩家只會以為自己選錯檔
    if (!d || typeof d !== 'object' || d.format !== FORMAT) return { ok: false, err: '這不是備份檔，或檔案是空的。請選你用「📤 匯出備份」存出來的檔案。' };
    if (!(d.schema <= SCHEMA)) return { ok: false, err: '這個備份檔是比較新的版本存的，請先更新遊戲再還原。' };
    var keys = d.keys;
    if (!keys || typeof keys !== 'object' || Array.isArray(keys)) return { ok: false, err: '備份檔不完整，請重新匯出一份。' };
    var names = Object.keys(keys);
    if (!names.length || (d.keyCount != null && d.keyCount !== names.length)) return { ok: false, err: '備份檔不完整，請重新匯出一份。' };
    for (var i = 0; i < names.length; i++) if (typeof keys[names[i]] !== 'string') return { ok: false, err: '備份檔不完整，請重新匯出一份。' };
    return { ok: true, pack: d };
  }

  // 實際寫入:整個清空再原樣寫回。中途失敗立刻停手,回報寫到第幾個。
  function applyPack(pack) {
    var names = Object.keys(pack.keys);
    try { localStorage.clear(); }
    catch (e) { return { ok: false, done: 0, err: '清除舊資料時失敗：' + (e && e.message || e) }; }
    for (var i = 0; i < names.length; i++) {
      var k = names[i], okw = false;
      try { okw = _lzSetStoredRaw(k, pack.keys[k]) !== false; } catch (e) { okw = false; }
      if (!okw) return { ok: false, err: '儲存空間不足' };
    }
    return { ok: true, done: names.length };
  }

  function startRestore() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onerror = function () { note('❌ 讀取檔案失敗。', true); };
      reader.onload = function () {
        var v = validate(String(reader.result || ''));
        if (!v.ok) { note('❌ ' + v.err, true); return; }
        confirmAndApply(v);
      };
      reader.readAsText(f);
    };
    input.click();
  }

  function confirmAndApply(v) {
    var pack = v.pack, when = pack.exportedAt || '?';
    try { when = new Date(pack.exportedAt).toLocaleString('zh-TW'); } catch (e) {}
    // 「先關掉其他分頁」不是客套話:還原同一個角色的舊備份時,核心的 _roleSaveAllowed(js/13:426)
    // 因為角色指紋一樣而放行,開著的分頁每 5 秒就把還原的內容蓋回去,而且畫面照樣顯示還原成功。
    // ⚠️ AFK_UI.confirm 會把 message 先 esc() 再把 \n 換成 <br>(afk-ui.js) → 塞 HTML 標籤會被當文字印出來,
    //    要條列只能用純文字編號。
    var G = window.LineageSaveGate;
    // 11-13：這台已經有角色 → 先問「整台換成備份」還是「合併」；合併時分不出新舊的角色、兩台都動過的共用資料讓玩家選
    if (window.LineageBoot && G && G.mergePreview) {
      G.mergePreview(pack).then(function (pv) {
        if (!pv || !pv.deviceHas) { ask('備份檔：' + when + '\n\n1. 請確認已關閉其他遊戲分頁。\n2. 這台裝置原本的紀錄將被覆蓋。', function () { runApply(pack); }); return; }
        chooseMode(pack, pv, when);
      }).catch(function () { ask('備份檔：' + when + '\n\n1. 請確認已關閉其他遊戲分頁。\n2. 這台裝置原本的紀錄將被覆蓋。', function () { runApply(pack); }); });
      return;
    }
    ask('備份檔：' + when + '\n\n1. 請確認已關閉其他遊戲分頁。\n2. 這台裝置原本的紀錄將被覆蓋。',
      function () { runApply(pack); });
  }

  // ── 11-13：選擇還原方式（整台換成備份／合併）＋分岔角色逐一選 ──
  var CLSN = { royal: '王族', knight: '騎士', elf: '妖精', mage: '法師', dark: '黑暗妖精', dragon: '龍騎士', illusion: '幻術士', warrior: '戰士' };
  function fmtAt(t) { if (!t) return '不明（舊存檔）'; try { var d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); } catch (e) { return '不明'; } }
  function sumTxt(x) { return x ? (CLSN[x.cls] || x.cls || '') + ' Lv' + x.lv + '・' + x.rb + ' 轉' : ''; }
  function nm(x) { return x && x.name ? x.name : '（未命名）'; }
  function modal(html, bind) {
    var old = document.getElementById('m-fsv-choose'); if (old) old.remove();
    var o = document.createElement('div'); o.id = 'm-fsv-choose';
    o.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(2,6,23,.82);display:flex;align-items:center;justify-content:center;padding:12px';
    o.innerHTML = '<div style="background:#0f172a;border:1px solid #334155;border-radius:14px;max-width:560px;width:100%;max-height:92vh;overflow-y:auto;padding:16px;color:#e2e8f0;font-size:14px;line-height:1.6">' + html + '</div>';
    document.body.appendChild(o);
    var close = function () { o.remove(); };
    o.addEventListener('click', function (e) { var b = e.target.closest('[data-fsv]'); if (!b) return; bind(b.getAttribute('data-fsv'), o, close); });
    return o;
  }
  var BTN = 'display:block;width:100%;text-align:left;margin:8px 0;padding:10px 12px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#e2e8f0;font-size:14px';
  function chooseMode(pack, pv, when) {
    var div = pv.roles.filter(function (r) { return r.rel === 'diverged'; });
    var h = '<div style="font-size:17px;font-weight:bold;color:#fde68a;margin-bottom:4px">這台裝置已經有角色</div>'
      + '<div style="color:#94a3b8;font-size:12px">備份檔：' + esc(when) + '。不管選哪一個，這台目前的資料都會先自動備份一份。請先關閉其他遊戲分頁。</div>'
      + '<button type="button" data-fsv="replace" style="' + BTN + ';border-color:#ca8a04;background:linear-gradient(180deg,rgba(113,63,18,.45),#1e293b)"><b style="color:#fde68a">📲 整台換成這份備份</b>（換裝置建議用這個）<br><span style="color:#cbd5e1;font-size:13px">角色、倉庫、寵物、血盟、龍之鑽石、收集冊全部換成備份的內容。這台獨有的角色會不見'
      + (pv.deviceOnly ? '（這台有 ' + pv.deviceOnly + ' 個角色備份裡沒有）' : '') + '。</span></button>'
      + '<button type="button" data-fsv="merge" style="' + BTN + '"><b style="color:#c4b5fd">🔀 合併</b><br><span style="color:#cbd5e1;font-size:13px">每個角色各自比較，看得出哪邊是接著玩下去的就用那邊；分不出來的' + (div.length ? '（' + div.length + ' 個）' : '') + '讓你選。'
      + (pv.shared.length ? '兩台都動過的「' + esc(pv.shared.join('、')) + '」也讓你選。' : '') + '</span></button>'
      + '<button type="button" data-fsv="cancel" style="' + BTN + ';text-align:center;color:#94a3b8">取消</button>';
    modal(h, function (a, o, close) {
      if (a === 'cancel') { close(); return; }
      if (a === 'replace') { close(); runApply(pack, { mode: 'replace' }); return; }
      if (a === 'merge') { if (!div.length && !pv.shared.length) { close(); runApply(pack, { mode: 'merge' }); return; } pickRoles(pack, pv, div); }
    });
  }
  function pickRoles(pack, pv, div) {
    var pick = {}, shared = 'device';
    div.forEach(function (r) { pick[r.id] = (r.bak.at || 0) >= (r.dev.at || 0) ? 'backup' : 'device'; });
    var card = function (r, side) {
      var x = side === 'backup' ? r.bak : r.dev, on = pick[r.id] === side;
      return '<button type="button" data-fsv="p|' + r.id + '|' + side + '" style="flex:1;text-align:left;padding:8px 10px;border-radius:10px;border:1px solid ' + (on ? '#a78bfa' : '#334155') + ';background:' + (on ? 'rgba(76,29,149,.45)' : '#1e293b') + ';color:#e2e8f0;font-size:13px">'
        + (on ? '◉ ' : '○ ') + '<b>' + (side === 'backup' ? '備份的' : '這台的') + '</b><br>' + esc(sumTxt(x)) + '<br><span style="color:#94a3b8">最後存檔：' + esc(fmtAt(x.at)) + '</span></button>';
    };
    var draw = function (o) {
      var h = '<div style="font-size:17px;font-weight:bold;color:#fde68a">要留哪一邊？</div><div style="color:#94a3b8;font-size:12px;margin-bottom:6px">這些角色兩台都各自玩過，分不出哪一邊比較新，請自己選。沒選到的那一邊會被蓋掉（還原前會自動備份）。</div>';
      div.forEach(function (r) { h += '<div style="margin:10px 0 4px;color:#c4b5fd;font-weight:bold">第 ' + r.slot + ' 格「' + esc(nm(r.dev)) + '」</div><div style="display:flex;gap:8px">' + card(r, 'device') + card(r, 'backup') + '</div>'; });
      if (pv.shared.length) {
        var sb = function (side, label) { var on = shared === side; return '<button type="button" data-fsv="s|' + side + '" style="flex:1;padding:8px 10px;border-radius:10px;border:1px solid ' + (on ? '#a78bfa' : '#334155') + ';background:' + (on ? 'rgba(76,29,149,.45)' : '#1e293b') + ';color:#e2e8f0;font-size:13px">' + (on ? '◉ ' : '○ ') + label + '</button>'; };
        h += '<div style="margin:12px 0 4px;color:#c4b5fd;font-weight:bold">' + esc(pv.shared.join('、')) + '</div><div style="color:#94a3b8;font-size:12px">兩台都有變動，選一邊：</div><div style="display:flex;gap:8px;margin-top:4px">' + sb('device', '這台的') + sb('backup', '備份的') + '</div>';
      }
      h += '<div style="display:flex;gap:8px;margin-top:14px"><button type="button" data-fsv="back" style="flex:1;padding:10px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#cbd5e1">返回</button><button type="button" data-fsv="go" style="flex:2;padding:10px;border-radius:10px;border:1px solid #a78bfa;background:linear-gradient(180deg,#7c3aed,#5b21b6);color:#fff;font-weight:bold">照這樣合併</button></div>';
      o.firstChild.innerHTML = h;
    };
    var o = modal('', function (a, o2, close) {
      if (a === 'back') { close(); chooseMode(pack, pv, ''); return; }
      if (a === 'go') { close(); runApply(pack, { mode: 'merge', pick: pick, shared: shared }); return; }
      var t = a.split('|'); if (t[0] === 'p') pick[t[1]] = t[2]; else if (t[0] === 's') shared = t[1]; draw(o2);
    });
    draw(o);
  }

  function runApply(pack, opt) {
    // Unified build: file and transfer-code restores share the same verified, reversible transaction.
    if (window.LineageBoot) {
      if (!window.LineageSaveGate) { note('存檔保護工具尚未載入，請重新開啟合併版。', true); return; }
      note('正在備份目前資料並還原…');
      window.LineageSaveGate.restoreFull(pack, opt).then(function () {
        note('✅ 已還原，操作前資料已保留，重新載入中…');
        setTimeout(function () { location.reload(); }, 900);
      }).catch(function (e) { note('❌ 還原未完成：' + String(e.message || '').replace(/。$/, '') + (e.causeCode ? '（' + ({ QuotaExceededError: '這台裝置的瀏覽器空間不夠', 22: '這台裝置的瀏覽器空間不夠', VERIFY: '寫入後讀回不一致', CONFLICT: '還原時資料被其他分頁改動' }[e.causeCode] || e.causeCode) + (e.failKey ? '；卡在 ' + e.failKey + '，' + Math.round((e.failSize || 0) / 1024) + 'K 字' : '') + (e.used ? '；目前已用 ' + Math.round(e.used / 1024) + 'K 字' : '') + '）' : '') + '。' + (VER ? '（程式版本 ' + VER.slice(0, 6) + '）' : '') + '可到「存檔與修復」查看操作前備份。', true); });
      return;
    }
    note('還原中…請不要關掉頁面。');
    var r = applyPack(pack);
    if (!r.ok) {
      note('❌ 還原沒有完成（' + r.err + '）。這台裝置的資料現在是不完整的，請重新匯入一次備份檔，或改用空間比較夠的裝置。', true);
      return;
    }
    note('✅ 已還原，重新載入中…');
    setTimeout(function () { try { location.reload(); } catch (e) {} }, 900);
  }

  function ask(message, onOk) {
    if (window.AFK_UI && AFK_UI.confirm) {
      AFK_UI.confirm({ title: '⚠️ 還原完整資料備份', message: message, align: 'left', okText: '我了解，繼續', cancelText: '取消', danger: true, onOk: onOk });
    } else if (window.confirm(message)) { onOk(); }
  }

  // ── 面板 ───────────────────────────────────────────────────
  var _layer = null;
  function note(html, bad) {
    var el = document.getElementById('m-fsv-note');
    if (!el) return;
    el.className = bad ? 'fsv-note fsv-bad' : 'fsv-note';
    el.innerHTML = esc(html).replace(/\n/g, '<br>');
  }
  // 文案只留玩家用得到的:容量、項目數、內部名詞對他們沒有任何幫助,寫了只會讓人不看。
  function renderBody() {
    // 玩家最常見的「存檔不見了」是清快取／換手機／瀏覽器自己回收資料——這句是叫他現在就去按匯出，不是純提醒
    return '<div class="fsv-warn">進度只存在這台裝置的瀏覽器裡，清除瀏覽器資料或換手機就會不見，記得定期匯出備份留一份。</div>'
      + '<div class="fsv-desc">把全部角色的進度存成一個檔案，換手機時一次搬完，也可以傳給作者查問題。</div>'
      + '<div class="fsv-btns">'
      + '<button id="m-fsv-exp" class="fsv-b fsv-go">📤 匯出備份</button>'
      + '<button id="m-fsv-imp" class="fsv-b fsv-danger">📥 還原備份</button>'
      + '</div>'
      + (codeOn() ? ('<div class="fsv-sep">或用轉移碼，不存檔案</div>'
        + '<div class="fsv-desc">在這台按「產生轉移碼」，到另一台輸入那六碼就搬過去了；資料暫存在網路上，24 小時後自動刪除。</div>'
        + '<div class="fsv-btns">'
        + '<button id="m-fsv-gen" class="fsv-b fsv-go">🔑 產生轉移碼</button>'
        + '<div id="m-fsv-codebox" class="fsv-codebox"><span id="m-fsv-code" class="fsv-code"></span>'
        + '<button id="m-fsv-copy" class="fsv-b fsv-mini">📋 複製</button></div>'
        + '<div class="fsv-row"><input id="m-fsv-in" class="fsv-input" maxlength="64" autocomplete="off" '
        + 'autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="輸入六碼">'
        + '<button id="m-fsv-use" class="fsv-b fsv-danger fsv-mini">搬過來</button></div>'
        + '</div>') : '')
      + '<div id="m-fsv-note" class="fsv-note"></div>';
  }

  // 產生轉移碼:上傳整包 → 顯示六碼 + 複製鈕
  // fetch 直接拋 TypeError＝連線根本沒建立(不是伺服器回錯)。最常見的是 DNS 過濾/廣告封鎖把
  //   catbox 整個域名擋掉 —— 那時瀏覽器只給一句 "Failed to fetch",玩家不會聯想到是自己開的 DNS
  //   (2026-08-05 玩家實測 AdGuard DNS 會擋,關掉就通)。
  function netErrMsg(e) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return '沒有網路連線。';
    if (e instanceof TypeError) return '連不上轉移服務，你的 DNS 或廣告封鎖可能把它擋掉了。';
    return null;
  }

  function doGenerate() {
    var btn = document.getElementById('m-fsv-gen');
    if (btn) { btn.disabled = true; btn.textContent = '上傳中…'; }
    note('上傳中…請不要關掉頁面。');
    uploadPack().then(function (code) {
      var box = document.getElementById('m-fsv-codebox'), el = document.getElementById('m-fsv-code');
      if (el) el.textContent = code;
      if (box) box.classList.add('show');
      note('✅ 到另一台裝置輸入這六碼就搬過去了（24 小時內有效）。');
    }).catch(function (e) {
      // 丟出來的 Error 自己就寫清楚是哪一步壞了(上傳失敗（500）/打包失敗：…)→ 直接用,不要再包一層
      note('❌ ' + (netErrMsg(e) || ((e && e.message || '產生轉移碼失敗') + '。'))
        + '\n可以改用上面的「匯出備份」存成檔案再自己傳過去。', true);
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = '🔑 產生轉移碼'; }
    });
  }

  // 輸入轉移碼:抓回來 → 走與檔案還原完全相同的驗證與確認流程
  function doUseCode() {
    var input = document.getElementById('m-fsv-in');
    var code = normalizeCode(input && input.value);
    if (!CODE_RE.test(code)) { note('❌ 請輸入六碼（英文小寫或數字）。', true); return; }
    var btn = document.getElementById('m-fsv-use');
    if (btn) btn.disabled = true;
    note('讀取中…');
    downloadByCode(code).then(function (text) {
      var v = validate(text);
      if (!v.ok) { note('❌ ' + v.err, true); return; }
      note('');
      confirmAndApply(v);
    }).catch(function (e) {
      // 🚨 只講「可能看錯」,不要自己拿相近字元重試——那可能抓到別人的存檔並覆蓋玩家進度
      if (e && e.message === 'NOTFOUND') note('❌ 找不到這組轉移碼。可能是打錯了（注意 0 和 o、1 和 l），或是已經超過 24 小時。', true);
      else note('❌ ' + (netErrMsg(e) || ((e && e.message || '讀取失敗') + '。'))
        + '\n可以改請對方用「匯出備份」存成檔案傳給你。', true);
    }).then(function () { if (btn) btn.disabled = false; });
  }
  function openModal() {
    if (!on()) return;
    buildModal();
    if (_layer) return;
    var m = document.getElementById('m-fsv-modal'); if (!m) return;
    document.getElementById('m-fsv-body').innerHTML = renderBody();
    var e1 = document.getElementById('m-fsv-exp');
    if (e1) e1.addEventListener('click', function () {
      doExport().then(function (b) { if (b) note('✅ 已匯出：' + b.fname); });
    });
    var e2 = document.getElementById('m-fsv-imp');
    if (e2) e2.addEventListener('click', startRestore);
    var e3 = document.getElementById('m-fsv-gen');
    if (e3) e3.addEventListener('click', doGenerate);
    var e4 = document.getElementById('m-fsv-copy');
    if (e4) e4.addEventListener('click', function () {
      var t = (document.getElementById('m-fsv-code') || {}).textContent || '';
      if (!t) return;
      var done = function () { note('✅ 已複製轉移碼 ' + t + '。'); };
      // navigator.clipboard 在 file:// 與部分手機瀏覽器不存在/被擋 → 退回選取整段讓玩家自己複製
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(done).catch(function () { selectCode(); });
      } else selectCode();
    });
    var e5 = document.getElementById('m-fsv-use');
    if (e5) e5.addEventListener('click', doUseCode);
    var e6 = document.getElementById('m-fsv-in');
    if (e6) e6.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') doUseCode(); });
    m.classList.add('open');
    _layer = window.AFK_UI ? AFK_UI.openLayer(hideModal) : null;
  }
  // 複製 API 不能用時的保底:把六碼選起來,玩家長按/Ctrl+C 就能自己複製
  function selectCode() {
    var el = document.getElementById('m-fsv-code');
    if (!el) return;
    try {
      var r = document.createRange(); r.selectNodeContents(el);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      note('請長按（或按 Ctrl+C）複製選取的六碼。');
    } catch (e) { note('請手動抄下上面的六碼。'); }
  }
  function hideModal() { var m = document.getElementById('m-fsv-modal'); if (m) m.classList.remove('open'); _layer = null; }
  function closeModal() { if (_layer && window.AFK_UI) AFK_UI.closeLayer(_layer); else hideModal(); }

  function buildModal() {
    injectCSS();
    if (document.getElementById('m-fsv-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'm-fsv-modal';
    modal.innerHTML = '<div id="m-fsv-card">'
      + '<div id="m-fsv-head"><span id="m-fsv-title">💾 完整資料備份與還原</span><button id="m-fsv-close" title="關閉">✕</button></div>'
      + '<div id="m-fsv-body"></div></div>';
    document.body.appendChild(modal);
    document.getElementById('m-fsv-close').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  }

  // Tailwind 是預建置的(動態拼沒出現過的 class 會安靜失效)→ 一律用自己的具名 class
  function injectCSS() {
    if (document.getElementById('m-fsv-style')) return;
    var s = document.createElement('style'); s.id = 'm-fsv-style';
    s.textContent = [
      '#m-fsv-modal{display:none;position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:1000;background:rgba(2,6,23,.82);align-items:flex-start;justify-content:center;padding:24px 12px;font-family:system-ui,"Segoe UI",sans-serif;}',
      '#m-fsv-modal.open{display:flex;}',
      '#m-fsv-card{background:#0f172a;border:1px solid #334155;border-radius:12px;max-width:520px;width:100%;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.6);}',
      '#m-fsv-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #334155;}',
      '#m-fsv-title{color:#fcd34d;font-weight:700;}',
      '#m-fsv-close{color:#94a3b8;background:none;border:0;font-size:18px;cursor:pointer;padding:2px 6px;}',
      '#m-fsv-body{padding:14px;overflow:auto;color:#e2e8f0;font-size:13px;line-height:1.7;}',
      '.fsv-sum{margin-bottom:6px;}',
      '.fsv-desc{color:#94a3b8;font-size:12px;margin-bottom:12px;}',
      '.fsv-btns{display:flex;flex-direction:column;gap:8px;}',
      '.fsv-b{border-radius:8px;padding:10px 12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid transparent;}',
      '.fsv-go{background:#0e7490;border-color:#0891b2;color:#cffafe;}',
      '.fsv-go:hover{background:#0891b2;}',
      '.fsv-danger{background:#7f1d1d;border-color:#b91c1c;color:#fecaca;}',
      '.fsv-danger:hover{background:#991b1b;}',
      '.fsv-sep{margin:16px 0 8px;padding-top:12px;border-top:1px solid #334155;color:#94a3b8;font-size:12px;}',
      '.fsv-mini{padding:8px 12px;font-size:13px;flex:0 0 auto;}',
      '.fsv-row{display:flex;gap:8px;}',
      // 六碼是「看著另一台螢幕打字」用的 → 等寬字＋拉開字距，讓 0/o、1/l 分得出來
      '.fsv-input{flex:1 1 auto;min-width:0;background:#020617;border:1px solid #475569;border-radius:8px;color:#e2e8f0;padding:10px 12px;font-size:18px;font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.18em;text-align:center;}',
      '.fsv-input:focus{outline:none;border-color:#0891b2;}',
      '.fsv-codebox{display:none;align-items:center;gap:10px;justify-content:center;background:#020617;border:1px solid #475569;border-radius:8px;padding:10px;}',
      '.fsv-codebox.show{display:flex;}',
      '.fsv-code{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:.22em;color:#fcd34d;user-select:all;}',
      '.fsv-note{margin-top:10px;font-size:12.5px;color:#a7f3d0;min-height:1em;}',
      '.fsv-note.fsv-bad{color:#fca5a5;}',
      '.fsv-warn{margin:0 0 12px;padding:8px 10px;border:1px solid #78350f;background:rgba(120,53,15,.28);border-radius:8px;color:#fcd34d;font-size:12px;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  function init() {
    window.AFK_SETTINGS = window.AFK_SETTINGS || { _items: [], add: function (it) { this._items.push(it); } };
    AFK_SETTINGS.add({ label: '💾 完整資料備份與還原', onClick: openModal });
    try { console.log('[AFK-fullsave] hooks OK'); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
