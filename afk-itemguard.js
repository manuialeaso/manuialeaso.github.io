/* ============================================================================
 * afk-itemguard.js — 🛡 物品保護：依詞條鎖定「不能賣」「不能存倉庫」（玩家 2026-10-29）
 *
 * 玩家：快速廢品、倉庫可以篩選詞條，鎖定哪些可以賣、可以放倉庫，哪些不行；自動販賣一起翻新——快速廢品有的功能，自動販賣跟倉庫都要有。
 *
 *   ‧詞條清單（三邊共用，window.__afkItemGuard.AFFIX／has）：
 *       祝福的（任一階）、昇華的祝福、至高的祝福、屬性、遠古系（任一）、永恆、不朽、太初、覺醒的、創世的、
 *       不屈者意志、龍的印記、龍的傷痕、神樹者的讚禮、闇龍的抵抗者、套裝效果、傳說、遺物、符文孔、已鑲符文、箭矢與箭矢袋
 *       （箭矢與箭矢袋：預設勾「不能賣」「不能存」，2026-10-30 20:43）
 *     另外各有一個「強化 +N 以上」。
 *   ‧保護設定記在角色上（player.itemGuard），三欄各自勾：
 *       自動廢品（2026-10-29 15:40）：自動販賣開著時，有這個詞條（或強化 +N 以下）的就自動標成廢品，照自動販賣的等待秒數賣；不能賣的優先、個別例外「永遠保留」優先
 *       不能賣：手動販賣、快速廢品勾選、標成廢品、自動販賣（含預覽）、一鍵賣出都會跳過
 *       不能存：單件存入、一鍵存入、條件存入、存入目前顯示、批次存入都會跳過
 *     預設都不勾（不改變原本行為）。
 *   ‧打開的地方：快速廢品條件列、自動販賣規則視窗、倉庫的條件存入列，都有「🛡 物品保護」按鈕。
 *   ‧自動販賣另外補上快速廢品的「部位」：裝備可以只賣勾選的部位（預設全部勾）。
 *   ‧倉庫條件存入的「詞條」改成完整清單（原本只有祝福、屬性、遠古三個）。
 *
 * 不改核心：只包 window 上的函式；批次存入（afk-whbatch）與條件存入（afk-whfilter）呼叫 __afkItemGuard.blocked。
 * 擋法：要擋的物品在那一次操作期間暫時當成「鎖定」（核心本來就跳過鎖定物品），操作結束立刻還原；存檔時不會把暫時鎖寫進去。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'itemguard', name: '物品保護（依詞條不能賣／不能存）', group: '遊戲介面',
    desc: '依詞條（祝福、遠古系、龍紋、套裝、傳說、遺物、符文孔…）或強化值，設定哪些物品不能賣、不能存倉庫；自動販賣也能只賣指定部位' });
  if (T && !T.enabled('itemguard')) return;
  if (typeof DB === 'undefined' || !DB.items) return;

  var AFFIX = [
    ['bless', '祝福的（任一階）', '#fcd34d'], ['bless2', '昇華的祝福', '#fbbf24'], ['bless3', '至高的祝福', '#fde047'], ['attr', '屬性', '#7dd3fc'],
    ['anc', '遠古系（任一）', '#c4b5fd'], ['eternal', '永恆', '#a5b4fc'], ['immortal', '不朽', '#f0abfc'], ['primordial', '太初', '#fda4af'], ['anc2', '覺醒的（遠古系二階）', '#c4b5fd'], ['anc3', '創世的（遠古系三階）', '#ddd6fe'],
    ['will', '不屈者意志', '#fda4af'], ['dmark', '龍的印記', '#fcd34d'], ['dscar', '龍的傷痕', '#fcd34d'], ['tree', '神樹者的讚禮', '#86efac'], ['dres', '闇龍的抵抗者', '#c4b5fd'],
    ['set', '套裝效果', '#5eead4'], ['legend', '傳說', '#fb923c'], ['relic', '遺物', '#facc15'], ['socket', '符文孔', '#a78bfa'], ['rune', '已鑲符文', '#e9d5ff'], ['arrow', '箭矢與箭矢袋', '#fde68a']
  ];
  var has = function (i, k) {
    if (!i) return false;
    var d = DB.items[i.id] || {};
    switch (k) {
      case 'bless': return i.bless === true;
      case 'bless2': return i.bless === true && Number(i.blessLv) === 2;
      case 'bless3': return i.bless === true && Number(i.blessLv) === 3;
      case 'attr': return !!i.attr;
      case 'anc': return !!i.anc;
      case 'eternal': case 'immortal': case 'primordial': return i.anc === k;
      case 'anc2': return !!i.anc && Number(i.ancLv) === 2;
      case 'anc3': return !!i.anc && Number(i.ancLv) === 3;
      case 'will': case 'dmark': case 'dscar': case 'tree': case 'dres': return !!i[k];
      case 'set': return !!i.seteff;
      case 'legend': return !!d.legend;
      case 'relic': return !!(d.relic || (typeof isRelic === 'function' && isRelic(d)));
      case 'socket': return Array.isArray(i.sockets) && i.sockets.length > 0;
      case 'rune': return Array.isArray(i.sockets) && i.sockets.some(Boolean);
      case 'arrow': return !!(d.isArrow || d.eff === 'afk_arrowbag' || /^afk_arw/.test(String(i.id)));
    }
    return false;
  };
  var NAME = {}; AFFIX.forEach(function (a) { NAME[a[0]] = a[1]; });
  var P = function () { return (typeof player !== 'undefined' && player && Array.isArray(player.inv)) ? player : null; };
  var cfg = function () {
    var p = P(); if (!p) return { sell: {}, store: {}, junk: {}, sellEn: -1, storeEn: -1, junkEn: -1 };
    var g = p.itemGuard || (p.itemGuard = {});
    if (!g.sell || typeof g.sell !== 'object') g.sell = {};
    if (!g.store || typeof g.store !== 'object') g.store = {};
    if (!g.junk || typeof g.junk !== 'object') g.junk = {};   // 自動廢品（2026-10-29 15:40）：有這個詞條就自動標成廢品（不能賣的優先）
    if (g.sellEn == null) g.sellEn = -1; if (g.storeEn == null) g.storeEn = -1; if (g.junkEn == null) g.junkEn = -1;
    if (!g.arrowInit) { g.arrowInit = 1; g.sell.arrow = true; g.store.arrow = true; }   // 箭矢與箭矢袋：預設不能賣、不能（批次）存（玩家 2026-10-30 20:43；可以在 🛡 物品保護取消）
    return g;
  };
  // 為什麼被擋（字串）；沒擋＝''
  var why = function (i, kind) {
    if (!i || !DB.items[i.id]) return '';
    var g = cfg(), set = kind === 'store' ? g.store : kind === 'junk' ? g.junk : g.sell, en = Number(kind === 'store' ? g.storeEn : kind === 'junk' ? g.junkEn : g.sellEn);
    for (var n = 0; n < AFFIX.length; n++) { var k = AFFIX[n][0]; if (set[k] && has(i, k)) return NAME[k]; }
    var d = DB.items[i.id];
    if (en >= 0 && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') && (kind === 'junk' ? (Number(i.en) || 0) <= en : (Number(i.en) || 0) >= en)) return (kind === 'junk' ? '+' + en + ' 以下' : '+' + en + ' 以上');
    return '';
  };
  var blocked = function (i, kind) { return !!why(i, kind); };
  var count = function (kind) { var g = cfg(), set = kind === 'store' ? g.store : kind === 'junk' ? g.junk : g.sell; return Object.keys(set).filter(function (k) { return set[k]; }).length + (Number(kind === 'store' ? g.storeEn : kind === 'junk' ? g.junkEn : g.sellEn) >= 0 ? 1 : 0); };
  // 自動廢品：有勾的詞條、沒被「不能賣」擋、不是鎖定／不可賣／玩家手動取消過的
  var autoJunk = function (i) { var d = i && DB.items[i.id]; return !!(d && !i.lock && !d.noSell && !d.noJunk && !i._userKeep && !blocked(i, 'sell') && why(i, 'junk')); };

  // ── 暫時鎖定：操作期間把要擋的物品當成鎖定（核心各處本來就跳過鎖定物品），結束還原 ──
  var tmp = [];
  var lockOn = function (kind, list) {
    (list || (P() ? P().inv : [])).forEach(function (i) { if (i && !i.lock && blocked(i, kind)) { i.lock = true; i._igTmp = 1; if (kind === 'sell' && i.junk) { i._igJunk = 1; } tmp.push(i); } });
  };
  var unTmp = function (i) { if (i && i._igTmp) { i.lock = false; delete i._igTmp; } if (i && i._igJunk) delete i._igJunk; };
  // 交易失敗時核心會用深拷貝還原背包（whTxnRestore）→ 物件換了一批，所以結束時也掃一次現在的背包
  var lockOff = function () { var a = tmp; tmp = []; a.forEach(unTmp); var p = P(); if (p) p.inv.forEach(unTmp); };
  var guarded = function (kind, fn, listFn) {
    return function () {
      if (tmp.length) return fn.apply(this, arguments);   // 巢狀呼叫：外層已經鎖了
      lockOn(kind, listFn ? listFn() : null);
      try { return fn.apply(this, arguments); } finally { lockOff(); }
    };
  };
  // 存檔時不把暫時鎖寫進去
  if (typeof W.saveGame === 'function') {
    var oSave = W.saveGame;
    W.saveGame = function () {
      if (!tmp.length) return oSave.apply(this, arguments);
      var p = P(), a = (p ? p.inv : []).filter(function (i) { return i && i._igTmp; }).concat(tmp);
      a.forEach(function (i) { if (i._igTmp) { i.lock = false; delete i._igTmp; i._igRe = 1; } });
      try { return oSave.apply(this, arguments); } finally { a.forEach(function (i) { if (i._igRe) { delete i._igRe; i.lock = true; i._igTmp = 1; } }); }
    };
  }

  // ── 販賣 ──
  var say = function (h) { try { logSys(h); } catch (e) {} };
  if (typeof W.sellItem === 'function') {
    var oSell = W.sellItem;
    W.sellItem = function (uid) {
      var p = P(), it = p && p.inv.find(function (x) { return x.uid === uid; }), w = it && why(it, 'sell');
      if (w) { say('<span class="text-amber-300">🛡 物品保護：這件有「' + w + '」，設定成不能賣（要賣請先到 🛡 物品保護 取消勾選）。</span>'); return; }
      return oSell.apply(this, arguments);
    };
  }
  if (typeof W._qjCanSelect === 'function') {
    var oCan = W._qjCanSelect;
    W._qjCanSelect = function (d, i) { return oCan.apply(this, arguments) && !blocked(i, 'sell'); };
  }
  if (typeof W.toggleJunk === 'function') {
    var oTJ = W.toggleJunk;
    W.toggleJunk = function (uid) {
      var p = P(), it = p && p.inv.find(function (x) { return x.uid === uid; }), w = it && !it.junk && why(it, 'sell');
      if (w) { say('<span class="text-amber-300">🛡 物品保護：這件有「' + w + '」，設定成不能賣，不能標成廢品。</span>'); return; }
      return oTJ.apply(this, arguments);
    };
  }
  if (typeof W._autoSellDecision === 'function') {
    var oDec = W._autoSellDecision;
    W._autoSellDecision = function (i, r) {
      if (blocked(i, 'sell')) return { sell: false };
      var rr = r || (typeof getAutoSellRules === 'function' ? getAutoSellRules() : null), d = i && DB.items[i.id];
      if (rr && rr.overrides && rr.overrides[i.id] !== 'keep' && autoJunk(i)) return { sell: true, qty: Number(i.cnt) || 1 };
      if (rr && rr.parts && d && typeof _asEquipType === 'function' && _asEquipType(d)) {
        var ck = ''; try { ck = equipCatKey(i.id, d); } catch (e) {}
        if (ck && rr.parts[ck] === false) return { sell: false };
      }
      return oDec.apply(this, arguments);
    };
  }
  if (typeof W.autoSellJunk === 'function') W.autoSellJunk = guarded('sell', W.autoSellJunk);
  // 被保護的物品身上的廢品標記清掉（設定改了之後、或之前就標著的）
  var clearJunk = function () { var p = P(); if (!p) return 0; var n = 0; p.inv.forEach(function (i) { if (i.junk && blocked(i, 'sell')) { i.junk = false; delete i.junkSince; delete i._autoSellQty; i._ruleJunk = false; n++; } }); return n; };

  // ── 倉庫 ──
  if (typeof W.whDeposit === 'function') {
    var oDep = W.whDeposit;
    W.whDeposit = function (uid) {
      var p = P(), it = p && p.inv.find(function (x) { return x.uid === uid; }), w = it && why(it, 'store');
      if (w === '箭矢與箭矢袋') w = '';   // 箭矢：只擋批次存入，單件自己存照常
      if (w) { say('<span class="text-amber-300">🛡 物品保護：這件有「' + w + '」，設定成不能存倉庫。</span>'); return; }
      return oDep.apply(this, arguments);
    };
  }
  ['whOneClickDeposit', 'whDepositShown'].forEach(function (fn) { if (typeof W[fn] === 'function') W[fn] = guarded('store', W[fn]); });

  // ── 自動販賣規則視窗：部位（比照快速廢品）＋物品保護按鈕 ──
  var CATS = (typeof EQUIP_CATEGORIES !== 'undefined') ? EQUIP_CATEGORIES.filter(function (c) { return c.key !== 'pet' && c.key !== 'doll'; }) : [];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  if (typeof W.openAutoSellRules === 'function') {
    var oOpen = W.openAutoSellRules;
    W.openAutoSellRules = function () {
      var r0 = oOpen.apply(this, arguments);
      try {
        var box = document.querySelector('#autosell-rule-modal .as-box'), secs = box && box.querySelectorAll('.as-sec');
        if (box && secs && secs.length >= 2 && !document.getElementById('as-ig-sec')) {
          var r = getAutoSellRules(), parts = r.parts || {};
          var groups = {}; CATS.forEach(function (c) { (groups[c.group] = groups[c.group] || []).push(c); });
          var html = '<div class="as-title">部位（比照快速廢品）與物品保護</div>'
            + '<div class="as-help">裝備只會賣勾選的部位（上面的武器／防具／飾品還是要先打開）。</div>'
            + Object.keys(groups).map(function (g) {
              return '<div style="margin:4px 0"><b style="color:#fbbf24">' + esc(g) + '</b>　<button type="button" data-ig-all="' + esc(g) + '" style="font-size:12px">全選</button> <button type="button" data-ig-none="' + esc(g) + '" style="font-size:12px">全不選</button><div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:2px">'
                + groups[g].map(function (c) { return '<label style="white-space:nowrap"><input type="checkbox" class="as-ig-part" data-g="' + esc(g) + '" data-cat="' + esc(c.key) + '"' + (parts[c.key] === false ? '' : ' checked') + '> ' + esc(c.name) + '</label>'; }).join('') + '</div></div>';
            }).join('')
            + '<div class="as-row" style="margin-top:8px"><button type="button" id="as-ig-open">🛡 物品保護（不能賣 ' + count('sell') + ' 項）</button><span class="as-muted">依詞條／強化值設定不能賣的物品，手動販賣與快速廢品也一起擋。</span></div>';
          var sec = document.createElement('div'); sec.className = 'as-sec'; sec.id = 'as-ig-sec'; sec.innerHTML = html;
          secs[1].parentNode.insertBefore(sec, secs[1].nextSibling);
          sec.addEventListener('click', function (ev) {
            var a = ev.target.closest('[data-ig-all],[data-ig-none]');
            if (a) { var g = a.getAttribute('data-ig-all') || a.getAttribute('data-ig-none'), on = a.hasAttribute('data-ig-all'); sec.querySelectorAll('.as-ig-part').forEach(function (x) { if (x.getAttribute('data-g') === g) x.checked = on; }); return; }
            if (ev.target.closest('#as-ig-open')) openGuard();
          });
        }
      } catch (e) { console.warn('[AFK-itemguard] autosell ui', e); }
      return r0;
    };
  }
  if (typeof W._readAutoSellForm === 'function') {
    var oRead = W._readAutoSellForm;
    W._readAutoSellForm = function () {
      var r = oRead.apply(this, arguments);
      try {
        var xs = document.querySelectorAll('#autosell-rule-modal .as-ig-part');
        if (r && xs.length) { var parts = {}; xs.forEach(function (x) { if (!x.checked) parts[x.getAttribute('data-cat')] = false; }); r.parts = parts; }
      } catch (e) {}
      return r;
    };
  }

  // ── 保護設定視窗 ──
  var openGuard = function () {
    var old = document.getElementById('afk-ig-modal'); if (old) { if (old.__close) old.__close(); else old.remove(); }
    var g = cfg();
    var ov = document.createElement('div'); ov.id = 'afk-ig-modal';
    ov.style.cssText = 'position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:10070;background:#020617aa;display:flex;align-items:center;justify-content:center;color:#e2e8f0';
    var enSel = function (kind, v) {
      var s = '<select data-ig-en="' + kind + '" style="background:#0f172a;border:1px solid #475569;border-radius:4px;color:#e2e8f0;padding:2px 4px"><option value="-1"' + (v < 0 ? ' selected' : '') + '>不限</option>';
      for (var k = (kind === 'junk' ? 0 : 1); k <= 15; k++) s += '<option value="' + k + '"' + (v === k ? ' selected' : '') + '>+' + k + (kind === 'junk' ? ' 以下' : ' 以上') + '</option>';
      return s + '</select>';
    };
    var rows = AFFIX.map(function (a) {
      return '<tr><td style="padding:3px 8px;color:' + a[2] + '">' + esc(a[1]) + '</td>'
        + '<td style="text-align:center"><input type="checkbox" data-ig="sell" data-k="' + a[0] + '"' + (g.sell[a[0]] ? ' checked' : '') + ' aria-label="' + esc(a[1]) + ' 不能賣"></td>'
        + '<td style="text-align:center"><input type="checkbox" data-ig="store" data-k="' + a[0] + '"' + (g.store[a[0]] ? ' checked' : '') + ' aria-label="' + esc(a[1]) + ' 不能存"></td>'
        + '<td style="text-align:center"><input type="checkbox" data-ig="junk" data-k="' + a[0] + '"' + (g.junk[a[0]] ? ' checked' : '') + ' aria-label="' + esc(a[1]) + ' 自動廢品"></td></tr>';
    }).join('');
    ov.innerHTML = '<div role="dialog" aria-modal="true" aria-label="物品保護" style="width:min(520px,94vw);max-height:calc((100dvh - var(--orig-bar-h,0px)) * .92);overflow:auto;background:#172033;border:2px solid #b7791f;border-radius:14px;padding:16px;box-shadow:0 18px 60px #000">'
      + '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:20px;color:#fde68a">🛡 物品保護</b><button type="button" data-ig-close style="background:#334155;border:1px solid #64748b;border-radius:6px;padding:4px 12px;color:#fff">關閉</button></div>'
      + '<div style="color:#94a3b8;font-size:13px;margin:6px 0 8px">打勾＝有這個詞條的物品「不能賣」（手動販賣、快速廢品、自動販賣、一鍵賣出都跳過）／「不能存」（各種存入倉庫都跳過）／「自動廢品」（自動販賣開著時，有這個詞條的就自動標成廢品、照自動販賣的等待秒數賣掉；不能賣的優先）。只要符合其中一項就算。設定跟著角色存檔。</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="color:#fbbf24"><th style="text-align:left;padding:3px 8px">詞條</th><th>不能賣</th><th>不能存</th><th>自動廢品</th></tr></thead><tbody>' + rows
      + '<tr><td style="padding:6px 8px">強化值（武器、防具、飾品）</td><td style="text-align:center">' + enSel('sell', Number(g.sellEn)) + '</td><td style="text-align:center">' + enSel('store', Number(g.storeEn)) + '</td><td style="text-align:center">' + enSel('junk', Number(g.junkEn)) + '</td></tr></tbody></table>'
      + '<div id="afk-ig-sum" style="margin-top:8px;color:#fcd34d;font-size:13px"></div></div>';
    document.body.appendChild(ov);
    var sum = function () {
      var p = P(), s = 0, t = 0, j = 0; if (p) p.inv.forEach(function (i) { if (blocked(i, 'sell')) s++; if (blocked(i, 'store')) t++; if (autoJunk(i)) j++; });
      var el = ov.querySelector('#afk-ig-sum'); if (el) el.textContent = '背包裡目前：不能賣 ' + s + ' 件、不能存 ' + t + ' 件、自動廢品 ' + j + ' 件' + (p && p.autoSellOn === false ? '（自動販賣目前是停止的，自動廢品不會標）' : '') + '。';
    };
    var changed = function () {
      var n = clearJunk(); sum();
      try { if (typeof applyAutoSellRules === 'function') applyAutoSellRules(); } catch (e) {}   // 自動廢品立刻標上
      try { renderTabs(true); } catch (e) {}
      try { var b = document.getElementById('as-ig-open'); if (b) b.textContent = '🛡 物品保護（不能賣 ' + count('sell') + ' 項）'; } catch (e) {}
      try { if (document.getElementById('interaction-content') && document.querySelector('#afk-whfilter')) W.renderWarehouseNPC(document.getElementById('interaction-content')); } catch (e) {}
      try { saveGame(); } catch (e) {}
      if (n) say('<span class="text-amber-300">🛡 物品保護：取消了 ' + n + ' 件受保護物品的廢品標記。</span>');
    };
    ov.addEventListener('change', function (ev) {
      var x = ev.target, gg = cfg();
      if (x.matches('[data-ig]')) { var kd = x.getAttribute('data-ig'), set = kd === 'store' ? gg.store : kd === 'junk' ? gg.junk : gg.sell; if (x.checked) set[x.getAttribute('data-k')] = true; else delete set[x.getAttribute('data-k')]; changed(); }
      else if (x.matches('[data-ig-en]')) { var ke = x.getAttribute('data-ig-en'); gg[ke === 'store' ? 'storeEn' : ke === 'junk' ? 'junkEn' : 'sellEn'] = Number(x.value); changed(); }
    });
    // 手機返回鍵／ESC 也能關（玩家 2026-10-29：不一定要按右上角關閉）
    var nav = null; try { if (W.AFK_NAV) nav = W.AFK_NAV.push(function () { nav = null; ov.remove(); }); } catch (e) {}
    var close = function () { if (nav && W.AFK_NAV) { var h = nav; nav = null; try { W.AFK_NAV.pop(h); } catch (e) {} } ov.remove(); };
    ov.__close = close;
    ov.addEventListener('click', function (ev) { if (ev.target === ov || ev.target.closest('[data-ig-close]')) close(); });
    sum();
  };
  W.openItemGuard = openGuard;
  // 萬一有暫時鎖跟著存檔出去（不該發生）：載入時清掉
  if (typeof W.loadGame === 'function') { var oLoad = W.loadGame; W.loadGame = function () { var r = oLoad.apply(this, arguments); try { var p = P(); if (p) p.inv.forEach(unTmp); } catch (e) {} return r; }; }

  // 快速廢品條件列加一顆按鈕
  if (typeof W.buildQuickHeader === 'function') {
    var oHdr = W.buildQuickHeader;
    W.buildQuickHeader = function (type) {
      var hdr = oHdr.apply(this, arguments);
      try {
        if (hdr && typeof quickJunk !== 'undefined' && quickJunk[type] && quickJunk[type].active) {
          var b = document.createElement('button'); b.type = 'button';
          b.className = 'btn border-amber-700 bg-slate-800 hover:bg-slate-700 px-2 py-1 text-xs font-bold text-amber-200 rounded mt-1';
          b.textContent = '🛡 物品保護（不能賣 ' + count('sell') + ' 項）'; b.onclick = openGuard;
          hdr.appendChild(b);
        }
      } catch (e) {}
      return hdr;
    };
  }

  W.__afkItemGuard = { AFFIX: AFFIX, has: has, why: why, blocked: blocked, autoJunk: autoJunk, cfg: cfg, open: openGuard, clearJunk: clearJunk, lockOn: lockOn, lockOff: lockOff };
})();
