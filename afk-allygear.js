/* ============================================================================
 * afk-allygear.js — 傭兵的兩個介面（Ping 2026-11-13 17:31 確認，參考 lostshin 版的做法、照本版架構重寫）
 *
 *   一、傭兵公會「裝備」改成圖形畫面（取代原本的文字清單 renderAllyEquipmentManager）：
 *       左：傭兵的紙娃娃（裝備 1／裝備 2）；右：隊長背包裡這名傭兵能穿的裝備（搜尋、部位篩選；點左邊部位也會篩選）。
 *       點一件 → 下方預覽穿上後能力的變化；雙擊背包裡的裝備＝穿上，雙擊部位＝卸下（Enter 也可以穿上選到的那件）。
 *       穿脫照舊走 allyEquipItem／allyUnequipItem（只能在安全區、會寫回那名傭兵自己的存檔）。不做強化。
 *   二、隊伍名單點傭兵 → 即時小視窗（能力：增益、異常狀態、角色能力；裝備：紙娃娃、負重、AC，只能看），每秒更新。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'allygear', name: '傭兵換裝畫面與隊員即時視窗', group: '介面', desc: '傭兵公會的圖形換裝畫面；隊伍名單點名字看隊員的增益、能力與裝備' });
  if (T && !T.enabled('allygear')) return;
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var N = function (x) { return Number(x) || 0; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var strip = function (h) { return String(h || '').replace(/<[^>]*>/g, ''); };
  var fmt = function (v) { v = Math.round(N(v) * 10) / 10; return v.toLocaleString(); };

  // ── 紙娃娃（座標同 js/19 裝備視窗）──
  var PAGES = [
    [['helm', 50.0, 15.81], ['ear1', 19.4, 18.01], ['ear2', 80.1, 18.01], ['amulet', 50.0, 33.46], ['gloves', 19.4, 31.50], ['cloak', 80.1, 31.50], ['tshirt', 50.0, 42.77], ['wpn', 19.4, 44.98], ['shield', 80.1, 44.98, 'offwpn'],
      ['armor', 50.0, 52.08], ['ring1', 19.4, 58.46], ['ring2', 80.1, 58.46], ['belt', 50.0, 63.36], ['ring3', 19.4, 67.77], ['ring4', 80.1, 67.77], ['shin', 50.0, 72.67], ['boots', 50.0, 81.99], ['doll', 19.4, 80.76], ['arrow', 80.1, 80.76]],
    [['eye', 19.4, 15.81], ['rem_eye', 50.0, 15.81], ['rem_soul', 80.1, 15.81], ['rem_blood', 80.1, 31.50], ['rem_scale', 50.0, 52.08], ['rem_bone', 19.4, 31.50], ['rem_fang', 80.1, 44.98], ['rem_heart', 50.0, 63.36], ['rem_flesh', 50.0, 81.99], ['rem_claw', 19.4, 44.98],
      ['holy', 19.4, 80.76], ['engrave', 50.0, 72.67], ['bracelet', 80.1, 58.46], ['bracelet2', 80.1, 67.77], ['mio', 19.4, 67.77], ['sigil', 50.0, 33.46], ['guard', 19.4, 58.46]]
  ];
  var LBL = { helm: '頭盔', ear1: '耳環 1', ear2: '耳環 2', amulet: '項鍊', gloves: '手套', cloak: '斗篷', tshirt: 'T恤', wpn: '主手', shield: '盾牌', offwpn: '副手', armor: '盔甲', ring1: '戒指 1', ring2: '戒指 2', belt: '腰帶', ring3: '戒指 3', ring4: '戒指 4', shin: '脛甲', boots: '長靴', doll: '娃娃', arrow: '箭矢',
    eye: '魔眼', rem_eye: '遺骸・眼', rem_soul: '之魂', rem_blood: '遺骸・血', rem_scale: '遺骸・鱗', rem_bone: '遺骸・骨', rem_fang: '遺骸・牙', rem_heart: '遺骸・心', rem_flesh: '遺骸・肉', rem_claw: '遺骸・爪', holy: '聖物', engrave: '遠征徽記', bracelet: '手環', bracelet2: '手環', mio: '密奧', sigil: '聖紋', guard: '守護者' };
  var TPL = { royal: '王族', knight: '騎士', mage: '法師', elf: '妖精', dark: '黑妖', illusion: '幻術', dragon: '龍騎', warrior: '戰士' };
  var tplUrl = function (a) {
    var c = TPL[a && a.cls]; if (!c) return 'public/assets/login/EQ%20UI/' + encodeURIComponent('原圖.webp') + '?v=20260713';
    var av = String(a.avatar || ''), f = av.indexOf('女') === 0 || av === '公主';
    return 'public/assets/login/EQ%20UI/' + encodeURIComponent((f ? '女' : '男') + c + '.webp') + '?v=20260713';
  };
  var icon = function (d) { try { return typeof getIconUrl === 'function' ? getIconUrl(d) : (d.img || ''); } catch (e) { return ''; } };
  var enOf = function (it, d) { try { return typeof capEn === 'function' ? capEn(it.en, d) : N(it.en); } catch (e) { return N(it.en); } };
  var itemName = function (it, actor) {
    try { if (actor && typeof _withAllyEquipmentContext === 'function' && actor !== P()) return strip(_withAllyEquipmentContext(actor, function () { return getItemFullName(it); })); return strip(getItemFullName(it)); } catch (e) { var d = DB.items[it.id]; return d ? d.n : it.id; }
  };
  var doll = function (actor, page, mode) {
    var eq = actor.eq || {}, h = '<div class="ag-doll" data-ag-mode="' + mode + '"><img class="ag-doll-bg" src="' + tplUrl(actor) + '" alt="" draggable="false">';
    PAGES[page].forEach(function (pos) {
      var k = pos[0], alt = pos[3], key = alt && eq[alt] ? alt : k, it = eq[key], d = it && DB.items[it.id];
      if (page === 1 && !it && !/^(eye|rem_)/.test(k)) return;   // 第二頁：有裝東西才畫（聖物、徽記、手環…看本人的開放條件，這裡只列出已裝備的）
      var nm = d ? itemName(it, actor) : '';
      h += '<button type="button" class="equipment-visual-slot ag-slot' + (it ? ' is-filled' : ' is-empty') + '" data-ag-slot="' + key + '" style="left:' + pos[1] + '%;top:' + pos[2] + '%;width:19.67%;height:8.82%" title="' + esc(LBL[key] || key) + ' · ' + esc(nm || '尚未裝備') + '">';
      if (d) {
        var gc = ''; try { gc = typeof getGlowClass === 'function' ? (getGlowClass(it, d) || '') : ''; } catch (e) {}
        h += '<img src="' + esc(icon(d)) + '" alt="" class="' + esc(gc) + '" draggable="false">';
        if ((d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') && !d.isArrow) h += '<span class="equipment-slot-equipped">E</span>';
        if (N(it.en) > 0) h += '<span class="equipment-slot-enhance">+' + enOf(it, d) + '</span>'; else if (N(it.cnt) > 1) h += '<span class="equipment-slot-count">' + N(it.cnt).toLocaleString() + '</span>';
      }
      h += '<span class="ag-slot-lbl">' + esc(LBL[key] || key) + '</span></button>';
    });
    return h + '</div>';
  };
  var pager = function (cur, attr) { return '<div class="ag-pages">' + [0, 1].map(function (i) { return '<button type="button" class="ag-page" ' + attr + '="' + i + '" aria-pressed="' + (cur === i) + '">裝備 ' + (i + 1) + '</button>'; }).join('') + '</div>'; };

  // ── 部位分類（篩選）──
  var groupOfKey = function (k) { return /^ring/.test(k) ? 'ring' : /^ear/.test(k) ? 'ear' : k === 'offwpn' ? 'shield' : /^bracelet/.test(k) ? 'bracelet' : k; };
  var groupOfDef = function (d) { if (!d) return ''; if (d.isArrow) return 'arrow'; if (d.type === 'wpn') return d.slot === 'offwpn' ? 'shield' : 'wpn'; var s = String(d.slot || ''); return groupOfKey(s); };
  var GROUPS = [['all', '全部部位'], ['wpn', '武器'], ['helm', '頭盔'], ['armor', '盔甲'], ['tshirt', 'T恤'], ['cloak', '斗篷'], ['gloves', '手套'], ['shield', '盾牌／副手'], ['boots', '長靴'], ['shin', '脛甲'], ['belt', '腰帶'], ['amulet', '項鍊'], ['ear', '耳環'], ['ring', '戒指'], ['doll', '娃娃'], ['arrow', '箭矢']];

  // ── 能力預覽：在複本上穿上去重算，比較前後 ──
  var STATS = [['HP', function (a) { return a.mhp; }], ['MP', function (a) { return a.mmp; }], ['AC', function (a) { return a.d && a.d.ac; }, true], ['魔防', function (a) { return a.d && a.d.mr; }],
    ['近距離傷害', function (a) { return a.d && a.d.meleeDmg; }], ['近距離命中', function (a) { return a.d && a.d.meleeHit; }], ['遠距離傷害', function (a) { return a.d && a.d.rangedDmg; }], ['遠距離命中', function (a) { return a.d && a.d.rangedHit; }],
    ['魔法傷害', function (a) { return a.d && a.d.magicDmg; }], ['魔法命中', function (a) { return a.d && a.d.magicHit; }], ['傷害減免', function (a) { return a.d && a.d.dr; }], ['迴避', function (a) { return a.d && a.d.er; }],
    ['力量', function (a) { return a.d && a.d.str; }], ['敏捷', function (a) { return a.d && a.d.dex; }], ['體質', function (a) { return a.d && a.d.con; }], ['智力', function (a) { return a.d && a.d.int; }], ['精神', function (a) { return a.d && a.d.wis; }], ['魅力', function (a) { return a.d && a.d.cha; }],
    ['負重', function (a) { return a.d && a.d.weightPct; }, true]];
  var quiet = function (fn) {
    var keep = {}, names = ['logSys', 'logCombat', 'saveGame', 'updateUI', 'renderTabs'];
    names.forEach(function (n) { keep[n] = W[n]; W[n] = function () {}; try { (0, eval)(n + ' = window.' + n); } catch (e) {} });
    try { return fn(); } finally { names.forEach(function (n) { W[n] = keep[n]; try { (0, eval)(n + ' = window.' + n); } catch (e) {} }); }
  };
  var snap = function (a) { return STATS.map(function (s) { return N(s[1](a)); }); };
  var preview = function (source, item) {
    try {
      return quiet(function () {
        var a = JSON.parse(JSON.stringify(source)), b = JSON.parse(JSON.stringify(source));
        _withAllyEquipmentContext(a, function () { recomputeStats(); });
        var ok = false;
        _withAllyEquipmentContext(b, function () { var t = JSON.parse(JSON.stringify(item)); t.cnt = 1; t.uid = 'agpv' + Date.now(); t._agpv = 1; b.inv.push(t); equipItem(t); ok = Object.values(b.eq || {}).some(function (x) { return x && x._agpv; }); recomputeStats(); });
        return { ok: ok, before: snap(a), after: snap(b) };
      });
    } catch (e) { return null; }
  };

  // ════════ 一、傭兵公會的換裝畫面 ════════
  var G = { slot: null, page: 0, group: 'all', q: '', sel: null, pv: null, pvFor: null };
  var render = function (div, slotN) {
    var ctx = typeof _allyManagerSource === 'function' ? _allyManagerSource(slotN, true) : null;
    if (!ctx) { try { renderAllyNPC(div); } catch (e) {} return; }
    if (G.slot !== String(slotN)) { G.slot = String(slotN); G.sel = null; G.pv = null; G.pvFor = null; G.page = 0; }
    var src = ctx.source, p = P(), allies = (p.allies || []).filter(Boolean);
    var inv = (p.inv || []).filter(function (it) { var d = it && DB.items[it.id]; return d && (d.type === 'wpn' || !!d.slot) && _allyCanEquipLeaderItem(src, it); });
    var q = G.q.trim().toLowerCase();
    var list = inv.filter(function (it) { var d = DB.items[it.id]; if (G.group !== 'all' && groupOfDef(d) !== G.group) return false; if (q && itemName(it).toLowerCase().indexOf(q) < 0 && String(d.n || '').toLowerCase().indexOf(q) < 0) return false; return true; });
    if (G.sel && !inv.some(function (it) { return String(it.uid) === G.sel; })) { G.sel = null; G.pv = null; }
    var selIt = G.sel ? inv.filter(function (it) { return String(it.uid) === G.sel; })[0] : null;
    if (selIt && G.pvFor !== G.sel) { G.pv = preview(src, selIt); G.pvFor = G.sel; }
    var h = '<div class="ag-wrap"><div class="ag-left">' + doll(src, G.page, 'guild') + pager(G.page, 'data-ag-page') + '</div><div class="ag-right">';
    h += '<div class="ag-head"><b>傭兵公會・換裝</b><button type="button" class="btn ag-btn" data-ag-back="1">返回</button></div>';
    var idx = allies.findIndex(function (a) { return String(a._slot) === G.slot; });
    h += '<div class="ag-pick"><button type="button" class="btn ag-btn" data-ag-step="-1" ' + (allies.length > 1 ? '' : 'disabled') + '>‹</button><select data-ag-ally>' + allies.map(function (a) { return '<option value="' + esc(a._slot) + '"' + (String(a._slot) === G.slot ? ' selected' : '') + '>' + esc((a._allyName || '隊員') + ' · ' + ((typeof CLAN_CLASS_NAMES !== 'undefined' && CLAN_CLASS_NAMES[a.cls]) || a.cls) + ' Lv.' + (a.lv || 1)) + '</option>'; }).join('') + '</select><button type="button" class="btn ag-btn" data-ag-step="1" ' + (allies.length > 1 ? '' : 'disabled') + '>›</button></div>';
    h += '<div class="ag-sub">隊長背包・可穿戴裝備（' + inv.length + '）</div>';
    h += '<div class="ag-filter"><select data-ag-group>' + GROUPS.map(function (g) { return '<option value="' + g[0] + '"' + (G.group === g[0] ? ' selected' : '') + '>' + g[1] + '</option>'; }).join('') + '</select><input type="search" data-ag-q placeholder="搜尋裝備" value="' + esc(G.q) + '"></div>';
    var LIM = 240, more = list.length - LIM; if (more > 0) list = list.slice(0, LIM);
    h += '<div class="ag-grid" tabindex="0">' + (list.length ? list.map(function (it) {
      var d = DB.items[it.id], c = Math.max(1, Math.floor(N(it.cnt) || 1));
      return '<button type="button" class="ag-item' + (String(it.uid) === G.sel ? ' sel' : '') + '" data-ag-item="' + esc(it.uid) + '" title="' + esc(itemName(it)) + '"><img src="' + esc(icon(d)) + '" alt="" draggable="false">' + (N(it.en) > 0 ? '<i>+' + enOf(it, d) + '</i>' : c > 1 ? '<i>' + c.toLocaleString() + '</i>' : '') + '<span>' + esc(itemName(it)) + '</span></button>';
    }).join('') + (more > 0 ? '<div class="ag-empty">還有 ' + more.toLocaleString() + ' 件沒有列出，請用搜尋或部位篩選。</div>' : '') : '<div class="ag-empty">' + (inv.length ? '沒有符合條件的裝備。' : '隊長背包沒有這名傭兵可穿戴的裝備。') + '</div>') + '</div>';
    h += '<div class="ag-pv">';
    if (!selIt) h += '<div class="ag-note">點選裝備，預覽隊員能力的變化。</div>';
    else {
      h += '<div class="ag-pv-h">候選：' + esc(itemName(selIt)) + '</div>';
      var pv = G.pv;
      if (!pv) h += '<div class="ag-note">這件裝備無法預覽。</div>';
      else if (!pv.ok) h += '<div class="ag-note">這名隊員穿不上這件裝備。</div>';
      else {
        var rows = STATS.map(function (s, i) { var a = pv.before[i], b = pv.after[i]; if (Math.abs(b - a) < 0.05) return ''; var up = s[2] ? b < a : b > a; return '<tr><td>' + s[0] + '</td><td>' + fmt(a) + '</td><td>→</td><td class="' + (up ? 'up' : 'dn') + '">' + fmt(b) + '（' + (b > a ? '+' : '') + fmt(b - a) + '）</td></tr>'; }).join('');
        h += rows ? '<table class="ag-diff">' + rows + '</table>' : '<div class="ag-note">能力沒有變化。</div>';
      }
      h += '<button type="button" class="btn ag-btn ag-wear" data-ag-wear="1">穿上</button>';
    }
    h += '</div><div class="ag-hint">雙擊背包裡的裝備穿上；雙擊左邊部位卸下；點左邊部位只顯示那個部位。Enter 也可以穿上選到的裝備。只能在安全區操作。</div></div></div>';
    div.innerHTML = h;
    bindGuild(div);
    if (G.focusQ) { var qi = div.querySelector('[data-ag-q]'); if (qi) { qi.focus(); try { qi.setSelectionRange(qi.value.length, qi.value.length); } catch (e) {} } G.focusQ = false; }
  };
  var rerender = function () { var div = document.getElementById('interaction-content'); if (div && G.slot) render(div, G.slot); };
  var wear = function (uid) { if (!uid) return; G.sel = null; G.pv = null; G.pvFor = null; try { allyEquipItem(G.slot, encodeURIComponent(String(uid))); } catch (e) {} };
  var bindGuild = function (div) {
    if (div.__agBound) return; div.__agBound = true;
    div.addEventListener('click', function (e) {
      if (!div.querySelector('.ag-wrap')) return;
      var t = e.target.closest('[data-ag-back],[data-ag-step],[data-ag-page],[data-ag-item],[data-ag-slot],[data-ag-wear]'); if (!t) return;
      if (t.hasAttribute('data-ag-back')) { try { closeAllyEquipmentManager(); } catch (er) {} return; }
      if (t.hasAttribute('data-ag-step')) { var al = (P().allies || []).filter(Boolean), i = al.findIndex(function (a) { return String(a._slot) === G.slot; }), n = al[(i + N(t.getAttribute('data-ag-step')) + al.length) % al.length]; if (n) openAllyEquipmentManager(n._slot); return; }
      if (t.hasAttribute('data-ag-page')) { G.page = N(t.getAttribute('data-ag-page')); rerender(); return; }
      if (t.hasAttribute('data-ag-wear')) { wear(G.sel); return; }
      if (t.hasAttribute('data-ag-item')) { G.sel = t.getAttribute('data-ag-item'); rerender(); return; }
      if (t.hasAttribute('data-ag-slot')) { var g = groupOfKey(t.getAttribute('data-ag-slot')); G.group = GROUPS.some(function (x) { return x[0] === g; }) ? g : 'all'; rerender(); }
    });
    div.addEventListener('dblclick', function (e) {
      if (!div.querySelector('.ag-wrap')) return;
      var it = e.target.closest('[data-ag-item]'); if (it) { wear(it.getAttribute('data-ag-item')); return; }
      var sl = e.target.closest('.ag-doll [data-ag-slot].is-filled'); if (sl) { try { allyUnequipItem(G.slot, sl.getAttribute('data-ag-slot')); } catch (er) {} }
    });
    div.addEventListener('change', function (e) {
      if (!div.querySelector('.ag-wrap')) return;
      if (e.target.matches('[data-ag-ally]')) { openAllyEquipmentManager(e.target.value); return; }
      if (e.target.matches('[data-ag-group]')) { G.group = e.target.value; rerender(); }
    });
    div.addEventListener('input', function (e) { if (!div.querySelector('.ag-wrap') || !e.target.matches('[data-ag-q]')) return; G.q = e.target.value; G.focusQ = true; rerender(); });
    div.addEventListener('keydown', function (e) { if (!div.querySelector('.ag-wrap')) return; if (e.key === 'Enter' && G.sel && !e.target.matches('input,select')) { e.preventDefault(); wear(G.sel); } });
  };
  var hookGuild = function () {
    if (typeof W.renderAllyEquipmentManager !== 'function' || W.renderAllyEquipmentManager.__ag) return;
    W.renderAllyEquipmentManager = function (div, slotN) { try { render(div, slotN); } catch (e) { console.warn('[allygear]', e); } };
    W.renderAllyEquipmentManager.__ag = true;
    try { (0, eval)('renderAllyEquipmentManager = window.renderAllyEquipmentManager'); } catch (e) {}
  };
  hookGuild(); W.addEventListener('load', hookGuild);

  // ════════ 二、隊伍名單點名字 → 即時視窗 ════════
  var PI = { slot: null, tab: 'ability', page: 0, timer: null, sig: '' };
  var allyOf = function (s) { var p = P(); return p ? (p.allies || []).filter(function (a) { return a && String(a._slot) === String(s); })[0] : null; };
  var buffRows = function (a) {
    var rows = [], seen = {}, add = function (name, sec, label, ic) { if (!name || seen[name]) return; seen[name] = 1; rows.push({ label: label || name, sec: Math.max(0, Math.ceil(N(sec))), icon: ic || name }); };
    var b = a.buffs || {};
    if (N(b.sk_greater_haste) > 0) add('加速術', b.sk_greater_haste, '強力加速術');
    if (N(b.haste) > 0 || a._equipHaste || a._mercPermanentPotions) add('加速術', b.haste, '加速');
    if (N(b.brave) > 0) add('勇敢藥水', b.brave); if (N(b.blue) > 0) add('藍色藥水', b.blue); if (N(b.cautious) > 0) add('慎重藥水', b.cautious); if (N(b.elfcookie) > 0) add('精靈餅乾', b.elfcookie);
    if (a._setPoly || (N(b.poly) > 0 && a.poly)) add('變形術', b.poly, '變身');
    try { Object.keys(STATUS_ICON_SKILLS).forEach(function (id) { if (N(b[id]) > 0) add(STATUS_ICON_SKILLS[id], b[id], DB.skills[id] ? DB.skills[id].n : STATUS_ICON_SKILLS[id]); }); } catch (e) {}
    return rows;
  };
  var debuffRows = function (a) { var out = [], st = a.statuses || {}; try { Object.keys(st).forEach(function (k) { var t = N(st[k]); if (t <= 0) return; out.push({ label: (typeof PLAYER_DEBUFF_NAME !== 'undefined' && PLAYER_DEBUFF_NAME[k]) || k, sec: Math.ceil(t / 10), icon: typeof PLAYER_DEBUFF_ICON !== 'undefined' ? PLAYER_DEBUFF_ICON[k] : null }); }); } catch (e) {} return out; };
  var iconsHtml = function (rows, empty) {
    if (!rows.length) return '<div class="ag-note">' + empty + '</div>';
    return '<div class="ag-icons">' + rows.map(function (r) { var t = r.label + (r.sec > 0 ? '｜剩餘 ' + r.sec + ' 秒' : ''); return r.icon ? '<span class="status-icon" title="' + esc(t) + '"><img src="assets/state-icons/' + encodeURIComponent(r.icon) + '.jpg" alt="' + esc(r.label) + '"></span>' : '<span class="ag-tag" title="' + esc(t) + '">' + esc(r.label) + '</span>'; }).join('') + '</div>';
  };
  var pct = function (v) { return fmt(v) + '%'; }, sgn = function (v) { v = N(v); return (v > 0 ? '+' : '') + fmt(v); };
  var abilityHtml = function (a) {
    var d = a.d || {}, cond = a._downed ? '倒地' : (String(mapState.current || '').indexOf('town_') === 0 ? '就緒' : '戰鬥中');
    var h = '<div class="ag-cap">Lv.' + (a.lv || 1) + ' · ' + cond + ' · HP ' + fmt(a.curHp) + ' / ' + fmt(a.mhp) + ' · MP ' + fmt(a.mp) + ' / ' + fmt(a.mmp) + ' · 即時更新</div>';
    h += '<h4>生效增益</h4>' + iconsHtml(buffRows(a), '目前沒有增益');
    h += '<h4>異常狀態</h4>' + iconsHtml(debuffRows(a), '目前沒有異常狀態');
    var six = [['力量', d.str], ['敏捷', d.dex], ['體質', d.con], ['智力', d.int], ['精神', d.wis], ['魅力', d.cha]];
    h += '<h4>角色能力</h4><div class="ag-six">' + six.map(function (x) { return '<span><b>' + x[0] + '</b>' + fmt(x[1]) + '</span>'; }).join('') + '</div>';
    var rows = [['近距離傷害', sgn(d.meleeDmg)], ['近距離命中', sgn(d.meleeHit)], ['近距離爆擊率', pct(d.meleeCrit)], ['近距離爆擊傷害', pct(d.meleeCritDmg)],
      ['遠距離傷害', sgn(d.rangedDmg)], ['遠距離命中', sgn(d.rangedHit)], ['遠距離爆擊率', pct(d.rangedCrit)], ['遠距離爆擊傷害', pct(d.rangedCritDmg)],
      ['魔法傷害', sgn(d.magicDmg)], ['魔法命中', sgn(d.magicHit)], ['額外魔法點數', sgn(d.extraMp)], ['魔法爆擊率', pct(d.magicCrit)], ['魔法爆擊傷害', pct(d.magicCritDmg)],
      ['AC', fmt(d.ac)], ['魔法防禦', fmt(d.mr)], ['傷害減免', fmt(d.dr)], ['迴避率', pct(Math.min(W.__afkEvadeCap || 100, typeof effResistPct === 'function' ? effResistPct(d.er) : N(d.er)))],
      ['HP 恢復量', fmt(d.hpR)], ['MP 恢復量', fmt(d.mpR)], ['MP 消耗減免', pct(d.mpReduce)],
      ['無屬性抗性', fmt(d.resNone)], ['火屬性抗性', fmt(d.resFire)], ['水屬性抗性', fmt(d.resWater)], ['風屬性抗性', fmt(d.resWind)], ['地屬性抗性', fmt(d.resEarth)]];
    h += '<div class="ag-stats">' + rows.map(function (r) { return '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('') + '</div>';
    return h;
  };
  var gearHtml = function (a) {
    var d = a.d || {}, tier = Math.max(0, Math.min(3, N(d.loadTier)));
    var h = '<div class="ag-cap">負重 ' + (isFinite(d.weightCur) && isFinite(d.weightLimit) ? fmt(d.weightCur) + ' / ' + fmt(d.weightLimit) + ' · ' : '') + fmt(d.weightPct) + '%' + (tier >= 2 ? '（一般攻擊變慢）' : '') + '　防禦 AC ' + fmt(d.ac) + '</div>';
    return h + '<div class="ag-pi-doll">' + doll(a, PI.page, 'view') + pager(PI.page, 'data-pi-page') + '</div><div class="ag-note">游標移到裝備上看名稱。換裝請到傭兵公會。</div>';
  };
  var box = function () {
    var el = document.getElementById('afk-pi'); if (el) return el;
    el = document.createElement('section'); el.id = 'afk-pi'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '隊員狀態');
    el.innerHTML = '<header><b id="afk-pi-title"></b><button type="button" class="btn ag-btn" data-pi-close="1">關閉 ✕</button></header><nav><button type="button" data-pi-tab="ability">能力</button><button type="button" data-pi-tab="gear">裝備</button></nav><div id="afk-pi-body"></div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-pi-close],[data-pi-tab],[data-pi-page]'); if (!t) return;
      if (t.hasAttribute('data-pi-close')) { closePI(); return; }
      if (t.hasAttribute('data-pi-tab')) { PI.tab = t.getAttribute('data-pi-tab'); PI.sig = ''; paintPI(); return; }
      if (t.hasAttribute('data-pi-page')) { PI.page = N(t.getAttribute('data-pi-page')); PI.sig = ''; paintPI(); }
    });
    return el;
  };
  var paintPI = function () {
    var el = document.getElementById('afk-pi'); if (!el || !PI.slot) return;
    var a = allyOf(PI.slot); if (!a) { el.querySelector('#afk-pi-body').innerHTML = '<div class="ag-note">這名隊員已經離隊。</div>'; return; }
    var cn = (typeof CLAN_CLASS_NAMES !== 'undefined' && CLAN_CLASS_NAMES[a.cls]) || a.cls;
    el.querySelector('#afk-pi-title').textContent = (a._allyName || '隊員') + '（' + cn + '）';
    [].forEach.call(el.querySelectorAll('[data-pi-tab]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-pi-tab') === PI.tab)); });
    var html = PI.tab === 'gear' ? gearHtml(a) : abilityHtml(a);
    if (html !== PI.sig) { var body = el.querySelector('#afk-pi-body'), sc = body.scrollTop; body.innerHTML = html; body.scrollTop = sc; PI.sig = html; }
  };
  var openPI = function (slot) {
    PI.slot = String(slot); PI.sig = ''; PI.page = 0; var el = box(); el.classList.add('open');
    try { var sb = document.getElementById('squad-body'), r = sb && sb.getBoundingClientRect(); if (r && r.width && innerWidth > 760) { el.style.left = Math.max(8, Math.min(innerWidth - el.offsetWidth - 8, r.right + 8)) + 'px'; el.style.top = Math.max(8, Math.min(r.top, innerHeight - 200)) + 'px'; } else { el.style.left = ''; el.style.top = ''; } } catch (e) {}
    paintPI();
    if (!PI.timer) PI.timer = setInterval(function () { if (document.hidden) return; var el = document.getElementById('afk-pi'); if (!el || !el.classList.contains('open')) return; paintPI(); }, 1000);
  };
  var closePI = function () { var el = document.getElementById('afk-pi'); if (el) el.classList.remove('open'); PI.slot = null; if (PI.timer) { clearInterval(PI.timer); PI.timer = null; } };
  document.addEventListener('click', function (e) {
    var card = e.target.closest && e.target.closest('#squad-tab-team .ally-compact-card'); if (!card) return;
    if (e.target.closest('button,select,input,a')) return;
    var hp = card.querySelector('[id^="squad-hp-"]'); if (!hp || /txt/.test(hp.id)) hp = card.querySelector('[id^="squad-hp-"]:not([id*="txt"])'); if (!hp) return;
    var s = hp.id.replace('squad-hp-', ''); if (PI.slot === s && document.getElementById('afk-pi') && document.getElementById('afk-pi').classList.contains('open')) { closePI(); return; } openPI(s);
  });

  // ── 樣式 ──
  var css = document.createElement('style');
  css.textContent = [
    '.ag-wrap{display:grid;grid-template-columns:minmax(220px,1fr) minmax(240px,1fr);gap:12px;align-items:start;color:#e2e8f0}',
    '@media(max-width:720px){.ag-wrap{grid-template-columns:1fr}}',
    '.ag-doll{position:relative;width:100%;aspect-ratio:1084/1447;border-radius:6px;overflow:hidden;background:#0b0a08}',
    '.ag-doll-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none}',
    '.ag-doll .ag-slot{position:absolute;z-index:2;display:flex;align-items:center;justify-content:center;padding:1%;border:0;background:transparent;transform:translate(-50%,-50%);cursor:pointer}',
    '.ag-doll .ag-slot img{width:82%;height:82%;object-fit:contain;filter:drop-shadow(0 2px 3px #000)}',
    '.ag-doll .ag-slot-lbl{position:absolute;left:0;right:0;bottom:-2px;text-align:center;font-size:10px;color:#d6cba8;text-shadow:0 1px 2px #000;pointer-events:none}',
    '.ag-doll .ag-slot:hover,.ag-doll .ag-slot:focus-visible{outline:2px solid #e8c36a;outline-offset:-2px}',
    '.ag-doll .equipment-slot-equipped{position:absolute;left:4%;top:3%;font:700 11px/1 serif;color:#fff;background:#1e40af;padding:1px 3px;border-radius:2px}',
    '.ag-doll .equipment-slot-enhance,.ag-doll .equipment-slot-count{position:absolute;right:4%;bottom:12%;color:#ffe07a;font-weight:800;font-size:11px;text-shadow:0 1px 2px #000}',
    '.ag-pages{display:flex;gap:6px;justify-content:center;margin-top:6px}.ag-page{flex:1;max-width:140px;padding:5px;border:1px solid #6b5a35;border-radius:4px;background:#1a1712;color:#e7d9b4}.ag-page[aria-pressed=true]{background:linear-gradient(#7c6940,#493d24);color:#fff3cf}',
    '.ag-right{display:flex;flex-direction:column;gap:8px;min-width:0}.ag-head{display:flex;justify-content:space-between;align-items:center}.ag-head b{font-size:18px;color:#fde68a}',
    '.ag-btn{padding:4px 12px;font-size:13px}.ag-pick{display:flex;gap:6px}.ag-pick select{flex:1;min-width:0;background:#0f172a;border:1px solid #475569;color:#e2e8f0;border-radius:4px;padding:4px}',
    '.ag-sub{color:#fcd34d;font-weight:700}.ag-filter{display:flex;gap:6px}.ag-filter select,.ag-filter input{background:#0f172a;border:1px solid #475569;color:#e2e8f0;border-radius:4px;padding:4px 6px}.ag-filter input{flex:1;min-width:0}',
    '.ag-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px;max-height:320px;overflow-y:auto;padding:2px;-webkit-overflow-scrolling:touch}',
    '.ag-item{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 4px;border:1px solid #3f3a2e;border-radius:4px;background:#161411;color:#e5e7eb;font-size:11px;line-height:1.25;text-align:center;cursor:pointer}',
    '.ag-item img{width:40px;height:40px;object-fit:contain}.ag-item i{position:absolute;right:4px;top:30px;font-style:normal;font-weight:800;color:#fcd34d;font-size:11px;text-shadow:0 1px 2px #000}',
    '.ag-item span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-all}.ag-item.sel{border-color:#e8c36a;box-shadow:inset 0 0 0 1px #e8c36a;background:#2a2213}',
    '.ag-pv{border:1px solid #3f3a2e;border-radius:4px;background:#100f0d;padding:8px;min-height:80px}.ag-pv-h{color:#fde68a;font-weight:700;margin-bottom:4px}.ag-wear{margin-top:6px}',
    '.ag-diff{width:100%;font-size:12px;border-collapse:collapse}.ag-diff td{padding:2px 4px;border-bottom:1px solid #2a2620}.ag-diff td:nth-child(2),.ag-diff td:nth-child(4){text-align:right}.ag-diff .up{color:#86efac}.ag-diff .dn{color:#fca5a5}',
    '.ag-note,.ag-hint,.ag-empty{color:#94a3b8;font-size:12px}.ag-empty{grid-column:1/-1;padding:8px}',
    '#afk-pi{position:fixed;z-index:80;top:70px;left:max(8px,calc(50% - 560px));width:min(420px,calc(100vw - 16px));max-height:calc(100vh - 90px);display:none;flex-direction:column;background:#141210;border:2px solid #6b5a35;border-radius:8px;box-shadow:0 18px 40px #000c;color:#e2e8f0}',
    '#afk-pi.open{display:flex}#afk-pi header{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid #3f3a2e}#afk-pi header b{font-size:17px;color:#fde68a}',
    '#afk-pi nav{display:flex;gap:6px;padding:8px 10px}#afk-pi nav button{flex:1;padding:6px;border:1px solid #6b5a35;border-radius:4px;background:#1a1712;color:#e7d9b4}#afk-pi nav button[aria-pressed=true]{background:linear-gradient(#7c6940,#493d24);color:#fff3cf}',
    '#afk-pi-body{flex:1;min-height:0;overflow-y:auto;padding:0 10px 10px;-webkit-overflow-scrolling:touch}#afk-pi h4{margin:10px 0 4px;color:#fcd34d;font-weight:700;font-size:14px}',
    '.ag-cap{color:#94a3b8;font-size:12px;margin:2px 0 4px}.ag-icons{display:flex;flex-wrap:wrap;gap:4px}.ag-icons .status-icon{width:32px;height:32px;display:inline-block;border:1px solid #475569;border-radius:3px;overflow:hidden}.ag-icons .status-icon img{width:100%;height:100%}',
    '.ag-tag{display:inline-block;padding:2px 6px;border:1px solid #7f1d1d;border-radius:3px;background:#3f1d1d;color:#fca5a5;font-size:12px}',
    '.ag-six{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.ag-six span{display:flex;justify-content:space-between;padding:3px 6px;background:#1c1915;border:1px solid #2f2a22;border-radius:3px;font-size:13px}.ag-six b{color:#cbd5e1;font-weight:600;margin-right:6px}',
    '.ag-stats{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-top:6px}.ag-stats div{display:flex;justify-content:space-between;gap:6px;padding:3px 6px;background:#1c1915;border:1px solid #2f2a22;border-radius:3px;font-size:12px}.ag-stats b{color:#fde68a;font-weight:600}',
    '.ag-pi-doll{max-width:330px;margin:0 auto}',
    '#squad-tab-team .ally-compact-card{cursor:pointer}#squad-tab-team .ally-compact-card:hover{border-color:#a8894c}'
  ].join('\n');
  document.head.appendChild(css);

  W.__afkAllyGear = { render: render, openPI: openPI, closePI: closePI, preview: preview, doll: doll };
})();
