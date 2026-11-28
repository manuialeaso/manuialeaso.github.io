/* ============================================================================
 * afk-hotbar.js — 道具熱鍵列 F5～F12（玩家 2026-10-27 指定）
 *
 * ‧左欄最底下一塊天堂風格的熱鍵面板：兩組四格，左右滑動，F5～F12
 * ‧任何背包裡的東西都能放：藥水、勇水、綠水、變形卷軸、卷軸、裝備……（每格記物品 id，疊放的數量會跟著顯示）
 * ‧點空格＝選要放什麼；點已放的格子＝使用（裝備類＝穿上／卸下切換）；右鍵或長按＝重新選擇；🔒 鎖住時不能改
 * ‧鍵盤 F5～F12 同樣觸發（打字中、按住 Ctrl／Alt 時不攔，瀏覽器的 Ctrl+F5 照常）
 * ‧每個角色各自記住（player._afkHotbar）
 * ‧魔法也能放（玩家 2026-10-30 22:21）：格子記 'sk:<技能 id>'，按下去＝施放（手動技能走 manualCast，其他走 castSkill，MP、冷卻照原本）
 * ‧自動施法（玩家 2026-11-01 15:18 定案；外掛開關 hotcast，預設開）：
 *     攻擊類魔法（技能類型 atk）的格子可以勾「自動」，並選條件（一律／2 隻以上／只對頭目）。
 *     共用施法間隔：熱鍵自動格與技能設定的「攻擊技能」走同一條施法間隔（職業／變身決定），間隔到了只放一個。
 *     順序（玩家 2026-11-01 17:05）：排隊中的 →「攻擊技能」→ F5 → F6 → F7 → F8，放第一個「現在可以放」的。
 *     法系輸出（攻擊類而且是魔法傷害）放出去後自己有 1.5 秒冷卻，冷卻中跳過換下一個；攻擊技能也算（有勾自動格時才排輪替）。
 *       範圍魔法（打全體）是 3 秒，而且所有人都套用（afk-balance1101，2026-11-01 17:36）。
 *       全部都在冷卻時，照樣放「攻擊技能」補上這一次——施法次數不會比原本少，也不會比原本多。
 *       物理類技能（三重矢、屠宰者、咆哮…）沒有這個冷卻。沒有勾任何自動格時，跟原本完全一樣。
 *     手動按熱鍵的攻擊類魔法＝插隊：施法間隔與它自己的冷卻都好了就立刻放，否則排在下一次第一個放（最多等 5 秒，過了就取消）。
 *       （實測：原本手動按也會被核心的攻擊魔法冷卻擋住，連點不會多放；改成插隊是為了跟自動格排在同一條間隔、不互搶。）
 *     顯示（玩家 2026-11-01 18:23）：自動施放的格子右上角標「AUTO」，沒標的就是放著手點。
 *       選擇要放什麼的視窗最上面有「自動施放」勾選與條件：選攻擊類魔法的同時就決定好是自動還是手點（其他東西不受影響）。
 *     自動格吃技能設定「攻擊技能」的 MP 門檻（MP 低於門檻不自動放）；手動插隊不看門檻。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'hotbar', name: '道具熱鍵列 F5～F12', desc: '兩組四格熱鍵，任何道具、裝備、魔法都能放，鍵盤 F5～F12 可用', group: '遊戲介面' });
  var on = function () { return !T || T.enabled('hotbar'); };
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var KEYS = ['F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'], N = 8;
  var pageIndex=0,pageOwner=null,dragging=false,touchBusy=false,suppressClickUntil=0;
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };

  // ── 樣式（原創的暗金屬框，仿天堂熱鍵列的排法）──
  var css = function () {
    if (document.getElementById('afk-hotbar-css')) return;
    var st = document.createElement('style'); st.id = 'afk-hotbar-css';
    st.textContent = [
      '#afk-hotbar{position:relative;border-radius:6px;padding:6px 8px 8px;background:linear-gradient(180deg,#2b2a30 0%,#1b1a1f 60%,#121115 100%);border:2px solid transparent;',
      'background-clip:padding-box;box-shadow:inset 0 0 0 1px rgba(0,0,0,.8),inset 0 1px rgba(220,177,116,.12),0 6px 14px rgba(0,0,0,.55);user-select:none}',
      '#afk-hotbar::before{content:"";position:absolute;inset:-2px;border-radius:7px;z-index:-1;background:linear-gradient(135deg,#6b4a2e,#95633f 25%,#3a2a22 50%,#8a5a3a 75%,#4a3024)}',
      '#afk-hotbar .hb-top{display:flex;align-items:center;justify-content:space-between;height:22px;margin-bottom:6px}',
      '#afk-hotbar .hb-emblem{width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#f1d9a8,#8a5a2a 55%,#3a2415);box-shadow:0 0 0 1px #000,inset 0 0 4px #000;position:relative}',
      '#afk-hotbar .hb-emblem::after{content:"";position:absolute;left:7px;top:7px;width:8px;height:8px;border-radius:50%;background:radial-gradient(circle at 40% 40%,#fff4,#7a1b1b 40%,#2a0606);box-shadow:0 0 4px #b91c1c}',
      '#afk-hotbar .hb-title{flex:1;text-align:center;font-size:12px;letter-spacing:2px;color:#d9c08c;text-shadow:1px 1px 0 #000}',
      '#afk-hotbar .hb-lock{width:22px;height:22px;border-radius:4px;border:1px solid #5b4632;background:linear-gradient(180deg,#3a3238,#1d1a1f);color:#cbb58a;font-size:12px;line-height:20px;text-align:center;cursor:pointer}',
      '#afk-hotbar .hb-moon{width:22px;height:22px;border-radius:4px;border:1px solid #5b4632;background:linear-gradient(180deg,#3a3238,#1d1a1f);font-size:12px;line-height:20px;text-align:center;cursor:pointer}',
      '#afk-hotbar .hb-lock.on{color:#f87171;border-color:#7f1d1d;box-shadow:0 0 6px #7f1d1d inset}',
      '#afk-hotbar .hb-row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}',
      '#afk-hotbar .hb-pages{display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;touch-action:pan-x;overscroll-behavior-x:contain;min-width:0;width:100%}',
      '#afk-hotbar .hb-pages::-webkit-scrollbar{display:none}#afk-hotbar .hb-page{flex:0 0 100%;min-width:0;scroll-snap-align:start;scroll-snap-stop:always}',
      '#afk-hotbar .hb-pager{display:flex;justify-content:center;gap:2px;flex:1}#afk-hotbar .hb-pager button{display:grid;place-items:center;width:28px;height:28px;min-width:28px;padding:0;border:0;background:transparent;box-shadow:none;cursor:pointer}#afk-hotbar .hb-pager button::before{content:"";width:6px;height:6px;border-radius:50%;background:#5b6b60;box-shadow:0 0 0 1px #17221b}#afk-hotbar .hb-pager button[aria-selected=true]::before{background:#e4cf91;box-shadow:0 0 5px #d6bd6955}#afk-hotbar .hb-pager button:focus-visible{outline:1px solid #d0b56b;outline-offset:-3px}',
      '#afk-hotbar .hb-names{display:none}#afk-hotbar.hb-mobile{flex:0 0 auto;margin:0 2px}#afk-hotbar.hb-mobile .hb-row,#afk-hotbar.hb-mobile .hb-names{grid-template-columns:repeat(4,minmax(0,68px));justify-content:center;gap:10px 14px}',
      // 手機：熱鍵固定在下方導覽列上面、不被蓋住（玩家 2026-10-27：有非官方橫幅時名字被導覽列遮住）——戰鬥畫面讓出高度（最少 130px），熱鍵本身不縮
      '#col-center.hb-host{flex:1 1 0!important;min-height:0!important}#col-center.hb-host>#map-view-panel{flex:1 1 0!important;min-height:0!important}#col-center.hb-host #battle-view{flex:0 1 auto!important;min-height:130px!important}#afk-hotbar.hb-mobile .hb-top{height:18px;margin-bottom:3px}',
      // 手機橫拿（高度 ≤520px，玩家 2026-10-31 14:11：熱鍵面板蓋住地圖列和戰場）：熱鍵縮成一列——左邊月亮／鎖、右邊四格 40px，不顯示標題與名字
      '@media (orientation:landscape) and (max-height:520px){#afk-hotbar.hb-mobile{display:flex;align-items:center;justify-content:center;gap:10px;padding:3px 8px}#afk-hotbar.hb-mobile .hb-top{height:auto;margin:0;gap:4px;flex-direction:column}#afk-hotbar.hb-mobile .hb-title,#afk-hotbar.hb-mobile .hb-names{display:none!important}#afk-hotbar.hb-mobile .hb-row{grid-template-columns:repeat(4,40px);gap:8px}#col-center.hb-host #battle-view{min-height:110px!important}}',
      '#afk-hotbar.hb-mobile .hb-names{display:grid;margin-top:4px}#afk-hotbar.hb-mobile .hb-names span{font-size:11px;line-height:1.25;color:#cbb58a;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:1px 1px 0 #000}',
      '#afk-hotbar .hb-slot{position:relative;aspect-ratio:1/1;border-radius:4px;background:linear-gradient(180deg,#141318,#0b0a0d);border:1px solid #3b3238;box-shadow:inset 0 0 0 1px #000,inset 0 2px 6px rgba(0,0,0,.9);cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center}',
      '#afk-hotbar .hb-slot:hover{border-color:#a67c52}',
      '#afk-hotbar .hb-slot.empty .hb-key{position:static;font-size:16px;color:#4b4650;text-shadow:none}',
      '#afk-hotbar .hb-slot img{width:72%;height:72%;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 1px 1px #000)}',
      '#afk-hotbar .hb-slot.none img{filter:grayscale(1) brightness(.4)}',
      '#afk-hotbar .hb-slot.worn{box-shadow:inset 0 0 0 1px #000,inset 0 0 0 2px #22c55e66}',
      '#afk-hotbar .hb-key{position:absolute;left:3px;top:1px;font-size:10px;color:#cbb58a;text-shadow:1px 1px 0 #000;font-weight:700}',
      '#afk-hotbar .hb-cnt{position:absolute;right:3px;bottom:1px;font-size:11px;color:#fde68a;text-shadow:1px 1px 0 #000;font-weight:700}',
      '#afk-hotbar .hb-slot.flash{animation:afkHbFlash .25s}',
      '#afk-hotbar .hb-auto{position:absolute;right:1px;top:1px;font-size:8px;letter-spacing:.2px;line-height:11px;padding:0 2px;border-radius:3px;background:#14532d;color:#bbf7d0;font-weight:700;box-shadow:0 0 0 1px #000}',
      '#afk-hotbar .hb-cdv{position:absolute;inset:0;background:#171222b8;z-index:2;transform-origin:bottom;transform:scaleY(0);transition:transform .1s linear;pointer-events:none}#afk-hotbar .hb-remaining{position:absolute;inset:0;z-index:3;display:grid;place-items:center;font:bold 13px/1 Arial;color:white;text-shadow:0 1px 3px black;pointer-events:none}#afk-hotbar :is(.hb-key,.hb-auto,.hb-cnt){z-index:4}',
      '#afk-hotbar .hb-slot.hb-q{border-color:#fbbf24;box-shadow:inset 0 0 0 1px #000,0 0 6px #fbbf24}',
      '#afk-hotbar-pick .hc{padding:8px 14px;border-bottom:1px solid #3b3238;display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;color:#d9c08c}',
      '#afk-hotbar-pick .hc select{background:#0f0e12;border:1px solid #3b3238;border-radius:4px;color:#e5e7eb;padding:2px 6px;font-size:12px}',
      '#afk-hotbar-pick .hc small{flex-basis:100%;color:#8f877d}',
      '@keyframes afkHbFlash{0%{box-shadow:inset 0 0 0 2px #fde68a}100%{box-shadow:inset 0 0 0 1px #000}}',
      '#afk-hotbar-pick{position:fixed;inset:0;top:var(--orig-bar-h,0px);z-index:9900;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:12px}',
      '#afk-hotbar-pick .box{width:min(560px,100%);max-height:min(calc((100dvh - var(--orig-bar-h,0px)) * .85),640px);display:flex;flex-direction:column;background:#1b1a1f;border:1px solid #805839;border-radius:8px;box-shadow:0 10px 30px #000}',
      '#afk-hotbar-pick .hd{padding:10px 14px;border-bottom:1px solid #805839;font-weight:700;color:#ddd8d2;display:flex;align-items:center;gap:8px}',
      '#afk-hotbar-pick .hd input{flex:1;background:#0f0e12;border:1px solid #3b3238;border-radius:4px;color:#e5e7eb;padding:4px 8px;font-size:13px}',
      '#afk-hotbar-pick .ls{overflow:auto;padding:6px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}',
      '#afk-hotbar-pick .it{display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid #3b3238;border-radius:4px;background:#121115;cursor:pointer;font-size:12px;color:#e5e7eb;min-width:0}',
      '#afk-hotbar-pick .it:hover{border-color:#a67c52;background:#1f1b22}',
      '#afk-hotbar-pick .it img{width:28px;height:28px;object-fit:contain;image-rendering:pixelated;flex:none}',
      '#afk-hotbar-pick .it span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#afk-hotbar-pick .grp{grid-column:1/-1;font-size:12px;color:#d9c08c;padding:4px 2px 0;border-bottom:1px solid #3b3238}',
      '#afk-hotbar-pick .ft{padding:8px 14px;border-top:1px solid #805839;display:flex;gap:8px;justify-content:flex-end}',
      '#afk-hotbar-pick .ft button{padding:4px 12px;border-radius:4px;border:1px solid #805839;background:#2b2a30;color:#ddd8d2;cursor:pointer}'
    ].join('\n');
    document.head.appendChild(st);
  };

  // ── 資料 ──
  var slots=function(key,empty){var p=P();if(!p)return Array(N).fill(empty);if(!Array.isArray(p[key]))p[key]=[];while(p[key].length<N)p[key].push(empty);return p[key];};
  var bar = function () { return P()?slots('_afkHotbar',null):null; };
  var locked = function () { var p = P(); return !!(p && p._afkHotbarLock); };
  // 自動施法設定（每格）：auto＝是否自動；cond＝'all'｜'multi'｜'boss'
  var autoArr = function () { return slots('_afkHotbarAuto',false); };
  var condArr = function () { return slots('_afkHotbarCond','all'); };
  var itemAuto=function(id){return W.AFK_HOTBAR_ITEMS&&W.AFK_HOTBAR_ITEMS.describe(id);};
  var autoLabels=function(id){var info=itemAuto(id);return info?W.AFK_HOTBAR_ITEMS.conditions(info):COND_N;};
  var findInv = function (id) { var p = P(); if (!p) return null; var list = (p.inv || []).filter(function (i) { return i && i.id === id; }); if (!list.length) return null; list.sort(function (a, b) { return (b.cnt || 1) - (a.cnt || 1); }); return list[0]; };
  var countOf = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (s, i) { return s + ((i && i.id === id) ? (i.cnt || 1) : 0); }, 0) : 0; };
  var wornSlot = function (id) { var p = P(); if (!p || !p.eq) return null; for (var k in p.eq) if (p.eq[k] && p.eq[k].id === id) return k; return null; };
  var isEquip = function (d) { return !!d && (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc'); };
  var skOf = function (id) { return (typeof id === 'string' && id.indexOf('sk:') === 0) ? (DB.skills[id.slice(3)] || null) : null; };
  var learned = function (skId) { var p = P(); return !!(p && (p.skills || []).indexOf(skId) >= 0); };
  var skIcon = function (sk) { try { return getIconUrl(sk, true); } catch (e) { return ''; } };
  var castable = function (id) { var sk = DB.skills[id]; return !!(sk && sk.type !== 'passive' && !sk.passive && sk.n); };

  // ── 觸發 ──
  var fire = function (i) {
    if (!on()||!Number.isInteger(i)||i<0||i>=N) return;
    var p = P(), b = bar(); if (!p || !b) return;
    var id = b[i]; if (!id) { pick(i); return; }
    var sk = skOf(id);
    if (sk) {   // 魔法
      var skId = id.slice(3);
      if (!learned(skId)) { sys('<span class="text-slate-400">還沒學會 ' + esc(sk.n) + '。</span>'); return; }
      var el0 = document.querySelector('#afk-hotbar .hb-slot[data-i="' + i + '"]'); if (el0) { el0.classList.remove('flash'); void el0.offsetWidth; el0.classList.add('flash'); }
      if (HC.on() && HC.lane(sk)) { HC.press(skId); schedule(true); return; }   // 攻擊類魔法：插隊（共用施法間隔）
      try { if (sk.type === 'manual') manualCast(skId); else if (typeof castSkill === 'function' && !castSkill(skId)) sys('<span class="text-slate-400">' + esc(sk.n) + ' 現在無法施放（MP、冷卻或目標）。</span>'); } catch (e) { console.warn('[AFK-hotbar]', e); }
      try { if (typeof updateUI === 'function') updateUI(); } catch (e) {}
      schedule(true); return;
    }
    var d = DB.items[id]; if (!d) { b[i] = null; render(); return; }
    var el = document.querySelector('#afk-hotbar .hb-slot[data-i="' + i + '"]'); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    if (isEquip(d)) {
      var ws = wornSlot(id);
      if (ws) { try { unequipItem(ws); } catch (e) {} }
      else { var it = findInv(id); if (!it) { sys('<span class="text-slate-400">背包裡沒有 ' + esc(d.n) + '。</span>'); return; } try { equipItem(it); } catch (e) {} }
      try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    } else {
      var it2 = findInv(id); if (!it2) { sys('<span class="text-slate-400">背包裡沒有 ' + esc(d.n) + '。</span>'); return; }
      try { useItem(it2.uid, false, true); } catch (e) { console.warn('[AFK-hotbar]', e); }
    }
    schedule(true);
  };

  // ── 選擇要放什麼 ──
  var layer = null;
  var closePick = function () { var m = document.getElementById('afk-hotbar-pick'); if (m) m.remove(); if (layer && W.AFK_UI && AFK_UI.closeLayer) { var l = layer; layer = null; try { AFK_UI.closeLayer(l); } catch (e) {} } layer = null; };
  var groupOf = function (d) { if (d.type === 'wpn') return '武器'; if (d.type === 'arm') return '防具'; if (d.type === 'acc') return '飾品'; if (d.type === 'pot') return '藥水'; if (d.type === 'scroll') return '卷軸'; if (d.type === 'skillbk') return '技能書'; return '道具'; };
  var ORDER = ['魔法', '藥水', '卷軸', '道具', '武器', '防具', '飾品', '技能書'];
  var pick = function (i) {
    if(!Number.isInteger(i)||i<0||i>=N)return;
    if (locked()) { sys('<span class="text-amber-300">熱鍵列已鎖住，先解鎖再改。</span>'); return; }
    var p = P(); if (!p) return; css(); closePick();
    var m = document.createElement('div'); m.id = 'afk-hotbar-pick';
    m.innerHTML = '<div class="box"><div class="hd">F' + (5 + i) + ' 要放什麼？<input type="text" placeholder="輸入名稱篩選"></div><div class="ls"></div><div class="ft"><button type="button" data-clear="1">清空這格</button><button type="button" data-close="1">取消</button></div></div>';
    document.body.appendChild(m);
    var curSk = skOf(bar()[i]), curLane = !!(curSk && HC.lane(curSk)), curItem=itemAuto(bar()[i]), hc = null;
    if (HC.on()) {   // 自動施法設定：放攻擊類魔法時一起決定「自動」還是「手點」
      hc = document.createElement('div'); hc.className = 'hc';
      var labels=autoLabels(bar()[i]);
      hc.innerHTML = '<label><input type="checkbox" data-auto="1"' + ((curLane||curItem) && autoArr()[i] ? ' checked' : '') + '> 自動使用／施放</label>'
        + '<span>條件</span><select data-cond="1">' + Object.keys(labels).map(function (k) { return '<option value="' + k + '"' + (condArr()[i] === k ? ' selected' : '') + '>' + labels[k] + '</option>'; }).join('') + '</select>'
        + '<small>補血／補魔依比例，增益藥水、料理及輔助卷軸在效果結束後補用。勾選後再選道具即可；長按已配置格可調整。只使用背包未鎖定物品、不自動購買；沒有 AUTO 的道具保持手動。攻擊魔法沿用原本施法間隔與 MP 門檻。</small>';
      m.querySelector('.box').insertBefore(hc, m.querySelector('.ls'));
      hc.addEventListener('change', function (ev) {
        var cs = skOf(bar()[i]); if (!(cs && HC.lane(cs))&&!itemAuto(bar()[i])) return;
        if (ev.target.matches('[data-auto]')) autoArr()[i] = !!ev.target.checked;
        if (ev.target.matches('[data-cond]')) condArr()[i] = ev.target.value;
        render(); save();
      });
    }
    var ls = m.querySelector('.ls'), inp = m.querySelector('input');
    var build = function (q) {
      q = (q || '').trim().toLowerCase();
      var seen = {}, rows = [];
      (p.inv || []).forEach(function (it) { if (!it || !it.id || seen[it.id]) return; var d = DB.items[it.id]; if (!d) return; seen[it.id] = 1; if (q && String(d.n).toLowerCase().indexOf(q) < 0) return; rows.push({ id: it.id, d: d, g: groupOf(d), cnt: countOf(it.id) }); });
      if (p.eq) Object.keys(p.eq).forEach(function (k) { var it = p.eq[k]; if (!it || !it.id || seen[it.id]) return; var d = DB.items[it.id]; if (!d) return; seen[it.id] = 1; if (q && String(d.n).toLowerCase().indexOf(q) < 0) return; rows.push({ id: it.id, d: d, g: groupOf(d), cnt: 0, worn: true }); });
      (p.skills || []).forEach(function (sid) { if (!castable(sid)) return; var sk = DB.skills[sid]; if (q && String(sk.n).toLowerCase().indexOf(q) < 0) return; rows.push({ id: 'sk:' + sid, d: sk, g: '魔法', sk: true }); });
      rows.sort(function (a, b) { return (ORDER.indexOf(a.g) - ORDER.indexOf(b.g)) || String(a.d.n).localeCompare(String(b.d.n), 'zh-Hant'); });
      var h = '', last = null;
      rows.forEach(function (r) {
        if (r.g !== last) { last = r.g; h += '<div class="grp">' + r.g + '</div>'; }
        h += '<div class="it" data-id="' + esc(r.id) + '" title="' + esc(r.d.n) + '"><img src="' + esc(r.sk ? skIcon(r.d) : getIconUrl(r.d)) + '" alt="" onerror="this.style.visibility=\'hidden\'"><span>' + esc(r.d.n) + (r.worn ? '（裝備中）' : (r.cnt > 1 ? ' ×' + r.cnt : '')) + '</span></div>';
      });
      ls.innerHTML = h || '<div class="grp">背包裡沒有東西</div>';
    };
    build('');
    inp.addEventListener('input', function () { build(inp.value); });
    m.addEventListener('click', function (ev) {
      if (ev.target === m || ev.target.closest('[data-close]')) { closePick(); return; }
      if (ev.target.closest('[data-clear]')) { bar()[i] = null;autoArr()[i]=false;condArr()[i]='all'; closePick(); render(); save(); return; }
      var it = ev.target.closest('.it'); if (!it) return;
      var id = it.getAttribute('data-id'); var b = bar();
      for (var k = 0; k < N; k++) if (k !== i && b[k] === id) {b[k] = null;autoArr()[k]=false;condArr()[k]='all';}   // 同一樣東西只放一格
      var nsk = skOf(id), nLane = !!(nsk && HC.on() && HC.lane(nsk)), wantAuto = false, wantCond = 'all';
      var nItem=itemAuto(id),names=autoLabels(id);
      if ((nLane||nItem) && hc) { var cb = hc.querySelector('[data-auto]'), sl = hc.querySelector('[data-cond]'); wantAuto = !!(cb && cb.checked); wantCond = (sl && sl.value) || 'all'; }
      autoArr()[i] = !!((nLane||nItem) && wantAuto); condArr()[i] = Object.hasOwn(names,wantCond)?wantCond:(nItem?'smart':'all');
      b[i] = id; closePick(); render(); save();
      sys('<span class="text-emerald-300">F' + (5 + i) + ' 設為 ' + esc((nsk || DB.items[id] || {}).n || id) + (autoArr()[i] ? '（自動：'+esc(names[condArr()[i]])+'）':'（手動）') + '。</span>');
    });
    layer = (W.AFK_UI && AFK_UI.openLayer) ? AFK_UI.openLayer(closePick) : null;
    try { inp.focus(); } catch (e) {}
  };
  var save = function () { try { if (typeof saveGame === 'function') saveGame(); } catch (e) {} };

  // ── 畫面 ──
  var MQ = '(max-width: 768px), (max-height: 520px) and (pointer: coarse)';
  var mobileGeom = function () { try { return document.body.classList.contains('m-unified') || (document.body.classList.contains('m-mobile') && W.matchMedia(MQ).matches); } catch (e) { return false; } };
  var lastHtml = '';
  var lockButton;
  function placeLock(host, isLocked) {
    if (!lockButton) {
      lockButton = document.createElement('button');
      lockButton.type = 'button';
      lockButton.className = 'hb-lock';
      lockButton.setAttribute('aria-label', '鎖定熱鍵配置');
      var icon = document.createElement('i');
      icon.setAttribute('aria-hidden', 'true');
      lockButton.appendChild(icon);
      lockButton.addEventListener('click', function () {
        var current = P();
        if (!current || !on()) return;
        current._afkHotbarLock = !current._afkHotbarLock;
        render();
        save();
      });
    }
    var vitals = document.body.classList.contains('m-unified') && document.body.classList.contains('giran-chrome') && document.getElementById('giran-vitals');
    var parent = vitals || host.firstElementChild;
    if (lockButton.parentElement !== parent) {
      parent.insertBefore(lockButton, vitals ? vitals.querySelector('.ga-mp') : null);
    }
    if (lockButton.getAttribute('aria-pressed') !== String(isLocked)) {
      lockButton.setAttribute('aria-pressed', String(isLocked));
      lockButton.classList.toggle('on', isLocked);
      lockButton.firstChild.textContent = isLocked ? '🔒' : '🔓';
      lockButton.title = isLocked ? '已鎖住：F5～F12 交還瀏覽器；仍可點格子使用及滑動，但不能換內容。' : '右鍵或長按格子可配置；點鎖頭避免誤改。';
    }
  }
  // 流派自動施放 8 格（Ping 11-13 03:22）：有流派時熱鍵變四組，第三、四組是流派專用（merged/class-ui 的 hotbarPages 給內容、處理點擊與冷卻）
  var clsPages = function () { try { var U = W.LineageClassUI; return U && U.hotbarPages ? U.hotbarPages() : null; } catch (e) { return null; } };
  var nPages = function () { return clsPages() ? 4 : 2; };
  var pageTo=function(index){
    pageIndex=Math.max(0,Math.min(nPages()-1,index));
    var host=document.getElementById('afk-hotbar'),pages=host&&host.querySelector('.hb-pages');
    if(pages)pages.scrollLeft=pageIndex*pages.clientWidth;
    if(host)host.querySelectorAll('[data-hb-page]').forEach(function(b){b.setAttribute('aria-selected',String(Number(b.dataset.hbPage)===pageIndex));});
  };
  var render = function () {
    var host = document.getElementById('afk-hotbar'); var p = P();
    if (!on() || !p) { if (host) host.style.display = 'none'; if (lockButton) lockButton.remove(); return; }
    if(p!==pageOwner){pageOwner=p;pageIndex=0;lastHtml='';if(HC)HC.reset();}
    if(dragging||touchBusy)return;
    if (!host) {
      var col = document.getElementById('col-left'); if (!col) return; css();
      host = document.createElement('div'); host.id = 'afk-hotbar'; col.appendChild(host);
      host.addEventListener('click', function (ev) {
        if(Date.now()<suppressClickUntil&&ev.target.closest('.hb-pages')){ev.preventDefault();return;}
        var pg=ev.target.closest('[data-hb-page]');if(pg){pageTo(Number(pg.dataset.hbPage));return;}
        if (ev.target.closest('.hb-cls')) return;   // 流派格：class-ui 自己處理
        if (ev.target.closest('.hb-moon')) { if (W.AFK_SCREEN) W.AFK_SCREEN.start(); return; }
        var s = ev.target.closest('.hb-slot'); if (!s) return; fire(Number(s.getAttribute('data-i')));
      });
      host.addEventListener('contextmenu', function (ev) { if (ev.target.closest('.hb-cls')) return; var s = ev.target.closest('.hb-slot'); if (!s) return; ev.preventDefault(); pick(Number(s.getAttribute('data-i'))); });
      var pressT = null, pressI = -1;
      host.addEventListener('touchstart', function (ev) { if (ev.target.closest('.hb-cls')) return; var s = ev.target.closest('.hb-slot'); if (!s) return;touchBusy=true; pressI = Number(s.getAttribute('data-i')); pressT = setTimeout(function () { pressT = null;suppressClickUntil=Date.now()+700; pick(pressI); }, 550); }, { passive: true });
      ['touchend', 'touchmove', 'touchcancel'].forEach(function (t) { host.addEventListener(t, function () { if (pressT) { clearTimeout(pressT); pressT = null; } }, { passive: true }); });
      ['touchend','touchcancel'].forEach(function(t){host.addEventListener(t,function(){touchBusy=false;schedule();},{passive:true});});
      var pointer=null;
      host.addEventListener('pointerdown',function(ev){
        var pages=ev.target.closest('.hb-pages');if(!pages||ev.button!==0||!ev.isPrimary)return;
        // A fresh press can use the new group's slot immediately after a swipe.
        suppressClickUntil=0;pointer={x:ev.clientX,left:pages.scrollLeft,pages:pages,type:ev.pointerType};
      });
      W.addEventListener('pointermove',function(ev){if(!pointer)return;var dx=ev.clientX-pointer.x;if(Math.abs(dx)>10){dragging=true;suppressClickUntil=Date.now()+700;if(pressT){clearTimeout(pressT);pressT=null;}}if(dragging&&pointer.type==='mouse'){pointer.pages.scrollLeft=pointer.left-dx;ev.preventDefault();}},{passive:false});
      var endDrag=function(){if(!pointer)return;var was=dragging,type=pointer.type,left=pointer.pages.scrollLeft,width=pointer.pages.clientWidth;pointer=null;dragging=false;if(was){suppressClickUntil=Date.now()+400;if(type==='mouse')pageTo(Math.round(left/Math.max(1,width)));}schedule();};
      W.addEventListener('pointerup',endDrag);W.addEventListener('pointercancel',endDrag);
      host.addEventListener('wheel',function(ev){if(!ev.target.closest('.hb-pages')||ev.ctrlKey)return;var delta=Math.abs(ev.deltaX)>Math.abs(ev.deltaY)?ev.deltaX:ev.deltaY;if(Math.abs(delta)<8)return;var next=Math.max(0,Math.min(nPages()-1,pageIndex+(delta>0?1:-1)));if(next!==pageIndex){ev.preventDefault();pageTo(next);}},{passive:false});
    }
    host.style.display = '';
    // 手機（玩家 2026-10-27）：放到戰鬥畫面正下方那塊空白，戰鬥時一眼看到藥水等道具還剩多少；桌機照舊在左欄最底下
    var want = document.getElementById('ga-hot-dock') || (mobileGeom() ? document.getElementById('col-center') : document.getElementById('col-left'));
    if (want && host.parentElement !== want) { want.appendChild(host); host.classList.toggle('hb-mobile', want.id === 'col-center'); }
    try { var cc = document.getElementById('col-center'); if (cc) cc.classList.toggle('hb-host', host.parentElement === cc); } catch (e) {}
    var b = bar(), lk = locked();
    var cp = clsPages(); if (!cp && pageIndex > 1) pageIndex = 0;
    var h = '<div class="hb-top">' + (W.AFK_SCREEN ? '<button type="button" class="hb-moon" aria-label="休眠掛網" title="休眠掛網">☾</button>' : '<div style="width:22px"></div>') + '<div class="hb-pager" role="tablist" aria-label="左右滑動切換熱鍵"><button type="button" role="tab" data-hb-page="0" aria-label="第一組熱鍵 F5 至 F8" title="第一組 F5–F8" aria-selected="'+(pageIndex===0)+'"></button><button type="button" role="tab" data-hb-page="1" aria-label="第二組熱鍵 F9 至 F12" title="第二組 F9–F12" aria-selected="'+(pageIndex===1)+'"></button>'+(cp?'<button type="button" role="tab" data-hb-page="2" aria-label="流派自動施放 1 至 4" title="流派 1–4" aria-selected="'+(pageIndex===2)+'"></button><button type="button" role="tab" data-hb-page="3" aria-label="流派自動施放 5 至 8" title="流派 5–8" aria-selected="'+(pageIndex===3)+'"></button>':'')+'</div></div><div class="hb-pages"><div class="hb-page" aria-label="第一組 F5 至 F8"><div class="hb-row">';
    for (var i = 0; i < N; i++) {
      if(i===4)h+='</div><div class="hb-names">'+b.slice(0,4).map(function(id){var d=id&&(skOf(id)||DB.items[id]);return '<span>'+(d?esc(d.n):'')+'</span>';}).join('')+'</div></div><div class="hb-page" aria-label="第二組 F9 至 F12"><div class="hb-row">';
      var id = b[i], skd = skOf(id);
      if (skd) {
        var lr = learned(id.slice(3)), mpc = 0; try { mpc = P().d && P().d.getMpCost ? P().d.getMpCost(skd.mp || 0, skd.tier) : (skd.mp || 0); } catch (e) { mpc = skd.mp || 0; }
        var au = HC.on() && HC.lane(skd) && autoArr()[i], qd = HC.on() && HC.queued() === id.slice(3);
        h += '<div class="hb-slot' + (lr ? '' : ' none') + (qd ? ' hb-q' : '') + '" data-i="' + i + '" data-sk="' + esc(id.slice(3)) + '" title="' + esc(skd.n) + '（魔法' + (mpc ? '，MP ' + mpc : '') + (au ? '，自動：' + COND_N[condArr()[i]] : '') + '）"><span class="hb-key">F' + (5 + i) + '</span>' + (au ? '<span class="hb-auto">AUTO</span>' : '') + '<i class="hb-cdv"></i><span class="hb-remaining"></span><img src="' + esc(skIcon(skd)) + '" alt="" onerror="this.style.visibility=\'hidden\'">' + (mpc ? '<span class="hb-cnt">' + mpc + '</span>' : '') + '</div>';
        continue;
      }
      var d = id ? DB.items[id] : null;
      if (!d) { h += '<div class="hb-slot empty" data-i="' + i + '" title="點一下放東西"><span class="hb-key">F' + (5 + i) + '</span></div>'; continue; }
      var cnt = countOf(id), ws = wornSlot(id), none = !cnt && !ws;
      var ia=autoArr()[i]&&itemAuto(id);
      h += '<div class="hb-slot' + (none ? ' none' : '') + (ws ? ' worn' : '') + '" data-i="' + i + '" title="' + esc(d.n) + (ia?'（自動使用）':ws ? '（裝備中，按一下卸下）' : (isEquip(d) ? '（按一下裝備）' : '')) + '"><span class="hb-key">F' + (5 + i) + '</span>'+(ia?'<span class="hb-auto">AUTO</span>':'')+'<img src="' + esc(getIconUrl(d)) + '" alt="" onerror="this.style.visibility=\'hidden\'">' + (isEquip(d) ? '' : '<span class="hb-cnt">' + cnt + '</span>') + '</div>';
    }
    h += '</div><div class="hb-names">' + b.slice(4,8).map(function (id) { var dd = id && (skOf(id) || DB.items[id]); return '<span>' + (dd ? esc(dd.n) : '') + '</span>'; }).join('') + '</div></div>' + (cp ? cp.pages.map(function (ph, k) { return '<div class="hb-page hb-cls-page" aria-label="流派自動施放第 ' + (k + 1) + ' 組"><div class="hb-row">' + ph + '</div><div class="hb-names">' + cp.names[k].map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('') + '</div></div>'; }).join('') : '') + '</div>';
    if (h !== lastHtml) { host.innerHTML = h; lastHtml = h;
      host.querySelector('.hb-pages').addEventListener('scroll',function(){if(!this.clientWidth)return;pageIndex=Math.round(this.scrollLeft/this.clientWidth);host.querySelectorAll('[data-hb-page]').forEach(function(b){b.setAttribute('aria-selected',String(Number(b.dataset.hbPage)===pageIndex));});},{passive:true});
      pageTo(pageIndex);
    }
    placeLock(host, lk);
  };
  var pending = false;
  // 11-28 Ping：遊戲每次更新介面都會叫快捷列重組一次（每秒數十次）。非玩家操作的重組最多每 0.25 秒一次；按鍵、點擊照舊立即更新。
  var lastRender = 0, timer = 0;
  var run = function () { pending = false; timer = 0; lastRender = performance.now(); try { render(); } catch (e) {} };
  var schedule = function (urgent) {
    if (urgent === true) { if (timer) { clearTimeout(timer); timer = 0; pending = false; } if (pending) return; pending = true; requestAnimationFrame(run); return; }
    if (pending) return; pending = true;
    var wait = 250 - (performance.now() - lastRender);
    if (wait > 0) timer = setTimeout(function () { requestAnimationFrame(run); }, wait); else requestAnimationFrame(run);
  };
  ['renderTabs', 'updateUI', 'loadGame'].forEach(function (fn) { var o = W[fn]; if (typeof o !== 'function') return; W[fn] = function () { var r = o.apply(this, arguments); schedule(); return r; }; });

  // ── 自動施法引擎（共用施法間隔＋法系 1.5 秒冷卻＋插隊）──
  var COND_N = { all: '一律', multi: '2 隻以上', boss: '只對頭目' };
  var HC = (function () {
    if (T && T.register) T.register({ id: 'hotcast', name: '熱鍵自動施法', group: '遊戲玩法', seal: true, parent: 'hotbar',
      desc: '熱鍵上的攻擊類魔法可以勾「自動」：跟攻擊技能共用施法間隔（次數不變），法系輸出從熱鍵放出後各自 1.5 秒冷卻；手動按＝插隊到下一次施法' });
    var hcOn = function () { return on() && (!T || T.enabled('hotcast')); };
    var CD = 15, QWAIT = 50;   // 1.5 秒；插隊最多等 5 秒（tick＝0.1 秒）
    var cdUntil = Object.create(null), queue = null, stats = { lane: 0, hot: 0, queued: 0 };
    var displayed = new Map(), previousSpell = '';
    var tk = function () { return (typeof state !== 'undefined' && state && Number(state.ticks)) || 0; };
    var lane = function (sk) { return !!(sk && sk.type === 'atk'); };
    var magic = function (sk) { return !!(sk && sk.type === 'atk' && sk.dmgType === 'magic'); };
    var BAL = function () { return W.__afkBalance1101 || null; };
    var cdLen = function (sid) { var b = BAL(), sk = DB.skills[sid]; return (b && (b.cdOn ? b.cdOn(sk, player) : (b.isAoe(sk) && b.aoeOn(player)))) ? (b.cdLen ? b.cdLen(sk, player) : b.AOE_CD) : CD; };   // 範圍魔法、粉碎能量 3 秒（afk-balance1101），其他法系 1.5 秒
    var cdLeft = function (sid) {
      var u = cdUntil[sid] || 0, t = tk(); if (u - t > cdLen(sid)) { delete cdUntil[sid]; u = 0; }
      var own = Math.max(0, u - t), b = BAL(), g = b ? b.aoeLeft(player, sid) : 0;   // 範圍魔法的冷卻記在施法者身上（攻擊技能、手動放的也算）
      return Math.max(own, g);
    };
    function observed(sid) {
      var sk=DB.skills[sid], p=P();
      if(!p||!sk)return;
      var laneName={atk:'atkSk',heal:'healSk',convert:'convertSk',purify:'purifySk',buff:'buffSk'}[sk.type];
      var ticks=Math.max(p.manualCd?.[sid]||0,p.cds?.[laneName]||0,cdLeft(sid));
      if(ticks>0)displayed.set(sid,{end:tk()+ticks,duration:ticks});
    }
    var targetOk = function (sid, tg) {   // 照核心自動施法的判斷（即死標籤、標籤需求、不重複上狀態）
      var sk = DB.skills[sid]; if (!sk || !tg) return false;
      var ik = sk.instakill && sk.instakill.tag, need = sk.tagReq;
      if (sk.noRecastStatus && tg.st && tg.st[sk.noRecastStatus] > 0) return false;
      try { if (ik && (tg.boss || !mobHasTag(tg, ik))) return false; if (need && !mobHasTag(tg, need)) return false; } catch (e) { return false; }
      return true;
    };
    var condOk = function (c, tg) {
      if (c === 'boss') return !!(tg && tg.boss);
      if (c === 'multi') return (mapState.mobs || []).filter(function (m) { return m && !m._dead && m.curHp > 0; }).length >= 2;
      return true;
    };
    var cast = function (sid, auto) {
      var ok = false;
      try { (0, eval)('_autoCastNow = ' + (auto ? 'true' : 'false')); } catch (e) {}
      try { ok = !!castSkill(sid); } catch (e) { ok = false; }
      finally { try { (0, eval)('_autoCastNow = false'); } catch (e) {} }
      if (ok) {
        try { player.cds.castLock = getAutoCastInterval(player, false, player.cds.castLock); } catch (e) { player.cds.castLock = 10; }
        var _bf = BAL(); if (magic(DB.skills[sid]) && !(_bf && _bf.freeNow && _bf.freeNow(player, sid))) cdUntil[sid] = tk() + cdLen(sid);   // 這一次免 3 秒冷卻（背神者、聖紋 E）就不記
        observed(sid);stats.lane++; stats.hot++;
        var el = document.querySelector('#afk-hotbar .hb-slot[data-sk="' + sid + '"]'); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
      }
      return ok;
    };
    var laneFree = function () { return (player.cds.castLock || 0) <= 0; };
    var canAct = function () { return state.running && player && !player.dead && (player.d.loadTier || 0) < 2 && !(typeof inAbsBarrier === 'function' && inAbsBarrier()); };
    var step = function () {   // 每 tick、原本自動施法之前
      if (!hcOn() || !canAct() || !laneFree()) return;
      var tg = null; try { tg = getTarget(); } catch (e) {}
      if (queue) {
        if (tk() > queue.until || !learned(queue.sk)) { queue = null; schedule(); }
        else if (tg && !cdLeft(queue.sk) && targetOk(queue.sk, tg)) { var qs = queue.sk; if (cast(qs, false)) { queue = null; schedule(); return; } }
        else return;   // 排隊中：這次間隔留給它（冷卻／目標還沒好就等）
      }
      if (!tg) return;
      var b = bar(), au = autoArr(), cd = condArr();
      if (!au.some(function (x, j) { return x && lane(skOf(b[j])); })) return;   // 沒有勾自動格：完全照原本
      var mpPct = (player.mp / Math.max(1, player.mmp)) * 100, thr = 0;
      try { thr = parseInt(document.getElementById('set-mp-atk').value, 10) || 0; } catch (e) {}
      if (mpPct < thr) return;
      var atk = ''; try { atk = document.getElementById('sel-atk-skill').value || ''; } catch (e) {}
      // 11-28 Ping：「自動施放設定」選的攻擊技能優先；它這次放不了（冷卻、目標不合）才輪到熱鍵上勾自動的格子。
      if(atk && lane(DB.skills[atk]) && learned(atk) && !cdLeft(atk) && targetOk(atk,tg) && cast(atk,true)){previousSpell=atk;return;}
      var choices=[];
      for(var i=0;i<N;i++){
        var id=b[i], sk=skOf(id);
        if(au[i]&&lane(sk)&&condOk(cd[i],tg)&&!choices.includes(id.slice(3)))choices.push(id.slice(3));
      }
      var start=choices.indexOf(previousSpell)+1;
      for(var offset=0;offset<choices.length;offset++){
        var sid=choices[(start+offset)%choices.length];
        if(learned(sid)&&!cdLeft(sid)&&targetOk(sid,tg)&&cast(sid,true)){
          previousSpell=sid;return;
        }
      }
    };
    var press = function (sid) {
      if (!learned(sid)) return;
      var tg = null; try { tg = getTarget(); } catch (e) {}
      if (canAct() && laneFree() && !cdLeft(sid) && tg && targetOk(sid, tg) && !queue) { if (cast(sid, false)) return; }
      queue = { sk: sid, until: tk() + QWAIT }; stats.queued++;
    };
    // ── 11-28 Ping：流派／職業轉職的技能也能在「自動施放設定 → 攻擊技能」選（選項值 cp:技能編號），而且最優先 ──
    var CP = 'cp:';
    var cpList = function (p) {
      var C = W.LineageClasses && W.LineageClasses.C; if (!C || !C.skills || !p || !p.classPath) return [];
      var out = []; C.skills.forEach(function (s, id) { try { if ((s.type === '法術' || s.type === '龍魔法') && C.canUse(p, id)) out.push(s); } catch (e) {} });
      return out;
    };
    var cpStep = function () {
      var el = document.getElementById('sel-atk-skill'), v = el && el.value; if (!v || v.indexOf(CP) !== 0) return;
      if (!canAct() || !laneFree()) return;
      var tg = null; try { tg = getTarget(); } catch (e) {} if (!tg) return;
      var thr = 0; try { thr = parseInt(document.getElementById('set-mp-atk').value, 10) || 0; } catch (e) {}
      if ((player.mp / Math.max(1, player.mmp)) * 100 < thr) return;
      var CC = W.LineageClassCombat, C = W.LineageClasses && W.LineageClasses.C, id = v.slice(CP.length);
      if (!CC || !C || !player.classPath || !C.skills.get(id)) return;
      try { if (!C.canUse(player, id)) return; var r = CC.cast(id, tg); if (r && r.ok) { try { player.cds.castLock = getAutoCastInterval(player, false, player.cds.castLock); } catch (e) { player.cds.castLock = 10; } stats.lane++; } } catch (e) {}
    };
    var hookCpSel = function () {
      var o = W.renderSkillSelects; if (typeof o !== 'function' || o.__afkCp) return;
      var f = function () {
        var el = document.getElementById('sel-atk-skill'), prev = el ? el.value : '', p = P();
        if (el && el.__cpFor !== p) { el.__cpFor = p; var c = p && p.config && p.config.selAtkSkill; if (c && String(c).indexOf(CP) === 0) prev = c; }   // 剛讀檔：選項還沒建好時存檔裡的設定先記著
        var r = o.apply(this, arguments);
        try {
          el = document.getElementById('sel-atk-skill'); if (!el) return r;
          var old = el.querySelector('optgroup[data-cp]'); if (old) old.remove();
          var list = cpList(P());
          if (list.length) {
            var g = document.createElement('optgroup'); g.label = '流派技能'; g.setAttribute('data-cp', '1');
            list.forEach(function (s) { var op = document.createElement('option'); op.value = CP + s.id; op.textContent = s.name; g.appendChild(op); });
            el.appendChild(g);
          }
          if (prev && prev.indexOf(CP) === 0) el.value = el.querySelector('option[value="' + prev.replace(/"/g, '\\"') + '"]') ? prev : '';
        } catch (e) {}
        return r;
      };
      f.__afkCp = true; W.renderSkillSelects = f; try { (0, eval)('renderSkillSelects = window.renderSkillSelects'); } catch (e) {}
    };
    hookCpSel(); W.addEventListener('load', function () { hookCpSel(); try { if (P()) renderSkillSelects(); } catch (e) {} });
    if (typeof W.autoCastSpells === 'function') {
      var oACS = W.autoCastSpells;
      W.autoCastSpells = function () {
        try { cpStep(); } catch (e) {}
        try { step(); } catch (e) { console.warn('[AFK-hotcast]', e); }
        var el = document.getElementById('sel-atk-skill'), v = el && el.value;
        if (v && v.indexOf(CP) === 0) { el.value = ''; try { return oACS.apply(this, arguments); } finally { el.value = v; } }   // 原生自動施法不認得流派技能：這段期間當作「無」
        return oACS.apply(this, arguments);
      };
      try { (0, eval)('autoCastSpells = window.autoCastSpells'); } catch (e) {}
    }
    setInterval(function () {   // 冷卻遮罩
      if (!hcOn()) return;
      document.querySelectorAll('#afk-hotbar .hb-slot[data-sk]').forEach(function (el) {
        var sid=el.dataset.sk, v=el.querySelector('.hb-cdv');if(!v)return;
        var record=displayed.get(sid), remaining=Math.max(0,cdLeft(sid),P()?.manualCd?.[sid]||0,(record?.end||0)-tk());
        var total=Math.max(remaining,record?.duration||cdLen(sid));
        v.style.transform='scaleY('+(remaining/total).toFixed(3)+')';
        var label=el.querySelector('.hb-remaining');
        if(label)label.textContent=remaining>0?(remaining>=10?Math.ceil(remaining/10):(remaining/10).toFixed(1)):'';
        if(!remaining)displayed.delete(sid);
        el.classList.toggle('hb-q', !!(queue && queue.sk === el.getAttribute('data-sk')));
      });
    }, 100);
    return { on: hcOn, lane: lane, magic: magic, press: press, step: step, queued: function () { return queue && queue.sk; }, cdLeft: cdLeft, stats: stats, CD: CD, observed: observed,
      reset: function () { cdUntil = Object.create(null); displayed.clear();previousSpell='';queue = null; } };
  })();
  W.__afkHotcast = HC;

  // ── 鍵盤 ──
  document.addEventListener('keydown', function (e) {
    if (!on()) return;
    var i = KEYS.indexOf(e.key); if (i < 0) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    var gs = document.getElementById('game-screen'); if (!gs || gs.classList.contains('hidden') || !P()) return;
    var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (locked()) return;   // 熱鍵列鎖住時 F5～F12 交還給瀏覽器（F5 可以重新整理網頁；玩家 2026-11-04 11:53）
    e.preventDefault(); if(!e.repeat)fire(i);
  }, true);

  W.addEventListener('resize', schedule);
  W.addEventListener('giran-mobile-layout', schedule);
  W.AFK_HOTBAR = { fire: fire, pick: pick, render: render, bar: bar, page:pageTo };
  schedule();
  console.log('[AFK-hotbar] 已啟用：道具熱鍵列 F5～F12');
})();
