/* ============================================================================
 * afk-lore-kit.js — 劇情任務線與新 Boss 的共用工具（玩家 2026-10-29；企劃 docs/lore-expansion-plan.md）
 *
 *   W.__afkLore.defineLine(line)：一條劇情任務線（沿用試煉接取制 TRIAL_Q：達等級接取 → 指定怪 100% 掉任務道具 → 一次交付）
 *     line = { id, name, hostIds:[npcId…]（掛在現有 NPC 下面）, hostN, intro, outro, chapters:[{
 *       lv, title, story, map,
 *       reqs:[{ id, n, img, d, need, mobs:[怪物名…] }…],
 *       rewards:{ all:[物品 id…], royal:[…], knight:[…] … }（交付時每件給 1 個）,
 *       first:[[物品 id 或 'gold', 數量]…]（第一次完成另外給）
 *     }…] }
 *     每章每職業一份 TRIAL_Q（key＝afkL_<line>_<章>_<職業>），要照順序；任務道具不能存倉庫。
 *   W.__afkLore.addItem(id, def)、addMob(id, def, animFrom)、aliasAnim(新名, 原名)
 *   W.__afkLore.defineSet({ ids, name, tiers:[[件數, { mhp, mmp, extraDmg, extraHit, mr, ac, dr, er, hpR, mpR, mdmg }]…] })
 *   W.__afkLore.boss：summon(怪 id, 數量, opt)、hurt(目標, 傷害)、party()、royals()
 * ========================================================================== */
(function () {
  'use strict';
  var W = window;
  if (typeof DB === 'undefined' || !DB.items || !DB.mobs || typeof TRIAL_Q === 'undefined') { console.warn('[AFK-lore-kit] 缺少任務系統，略過'); return; }
  var CLASSES = ['knight', 'mage', 'elf', 'dark', 'illusion', 'warrior', 'dragon', 'royal'];
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { if (typeof logSys === 'function') logSys(h); } catch (e) {} };
  var clog = function (h, c) { try { if (typeof logCombat === 'function' && !S().ff) logCombat(h, c || 'enemy'); } catch (e) {} };

  // ── 物品、怪物 ──
  var addItem = function (id, def) {
    if (DB.items[id]) return DB.items[id];
    var d = Object.assign({ p: 0, gachaWeight: 0, weight: 0 }, def);
    DB.items[id] = d;
    return d;
  };
  var GET = function (n) { try { return (0, eval)(n); } catch (e) { return null; } };
  var aliasAnim = function (n, src) {
    try {
      var names = GET('MOB_ANIM_NAMES'); if (!names || !names.has(src)) return false;
      var target = (typeof MOB_ANIM_ALIAS !== 'undefined' && MOB_ANIM_ALIAS[src]) || src;
      if (typeof MOB_ANIM_ALIAS !== 'undefined') MOB_ANIM_ALIAS[n] = target;
      ['MOB_ANIM_NAMES', 'MOB_ANIM_BAKED_SHADOW', 'MOB_SHADOW_TINT', 'MOB_ANIM_BIG', 'MOB_ANIM_SMALL', 'MOB_ANIM_SPRITE_SHADOW', 'MOB_ANIM_WEAPON_FX', 'MOB_ANIM_WEAPON_FX2', 'MOB_ANIM_8DIR'].map(GET).forEach(function (s) { if (s && s.has && s.has(src)) s.add(n); });
      ['MOB_ANIM_SKILL_FX', 'MOB_YLIFT', 'MOB_ANIM_DEATH_FX', 'BOSS_ENTRANCE_FX', 'MOB_HURT_SFX', 'MOB_KILL_SFX', 'MOB_ATTACK_SFX'].map(GET).forEach(function (o) { if (o && o[src] != null && o[n] == null) o[n] = o[src]; });
      return true;
    } catch (e) { return false; }
  };
  var addMob = function (id, def, animFrom) {
    if (!DB.mobs[id]) DB.mobs[id] = def;
    var src = animFrom && Object.keys(DB.mobs).map(function (k) { return DB.mobs[k]; }).filter(function (m) { return m && m.n === animFrom; })[0];
    if (src && !DB.mobs[id].img && src.img) DB.mobs[id].img = src.img;
    if (animFrom) aliasAnim(DB.mobs[id].n, animFrom);
    return DB.mobs[id];
  };

  // ── 套裝 ──
  var sets = [];
  var defineSet = function (s) { sets.push(s); };
  var countOf = function (p, ids) { var n = 0; Object.keys((p && p.eq) || {}).forEach(function (k) { var it = p.eq[k]; if (it && ids.indexOf(it.id) >= 0) n++; }); return n; };
  var bonusOf = function (p) {
    var out = {};
    sets.forEach(function (s) { var n = countOf(p, s.ids); s.tiers.forEach(function (t) { if (n >= t[0]) Object.keys(t[1]).forEach(function (k) { out[k] = (out[k] || 0) + t[1][k]; }); }); });
    return out;
  };
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) { var b = bonusOf(p); if (b.mhp) p.mhp = (p.mhp || 0) + b.mhp; if (b.mmp) p.mmp = (p.mmp || 0) + b.mmp; });
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try { var p = P(); if (p && p.d && sets.length) { var b = bonusOf(p); ['extraDmg', 'extraHit', 'mr', 'dr', 'er', 'hpR', 'mpR'].forEach(function (k) { if (b[k]) p.d[k] = (p.d[k] || 0) + b[k]; }); if (b.ac) p.d.ac = (p.d.ac || 0) - b.ac; if (b.mdmg) p.d.magicDmg = (p.d.magicDmg || 0) + b.mdmg; } } catch (e) {}
      return r;
    };
  }

  // ── 劇情任務線 ──
  var LINES = {}, KEYS = {};   // KEYS[key] = { line, i }
  var keyOf = function (line, i, cls) { return 'afkL_' + line.id + '_' + (i + 1) + '_' + cls; };
  var prevDone = function (line, i, p) { return i === 0 || trialQStateFor(p, keyOf(line, i - 1, p.cls)) === 2; };
  var defineLine = function (line) {
    LINES[line.id] = line;
    line.chapters.forEach(function (ch, i) {
      ch.reqs.forEach(function (q) {
        addItem(q.id, { n: q.n, type: 'etc', c: 'text-amber-300', img: q.img || 'assets/icons/items/古代的卷軸.png', noUse: true, noSell: true, questItem: true,
          d: q.d + '（劇情「' + line.name + '」第 ' + (i + 1) + ' 章任務道具）' });
        try { if (typeof WH_NO_STORE !== 'undefined' && WH_NO_STORE.indexOf(q.id) < 0) WH_NO_STORE.push(q.id); } catch (e) {}
        try { if (typeof TRIAL_ITEM_CLASS !== 'undefined') TRIAL_ITEM_CLASS[q.id] = CLASSES.slice(); } catch (e) {}
        try { if (typeof MOB_DROPS !== 'undefined') (q.mobs || []).forEach(function (mn) { MOB_DROPS[mn] = MOB_DROPS[mn] || []; if (!MOB_DROPS[mn].some(function (x) { return x[0] === q.id; })) MOB_DROPS[mn].push([q.id, 1]); }); } catch (e) {}
      });
      CLASSES.forEach(function (cls) {
        var k = keyOf(line, i, cls); KEYS[k] = { line: line, i: i };
        if (TRIAL_Q[k]) return;
        var rw = ((ch.rewards && ch.rewards.all) || []).concat((ch.rewards && ch.rewards[cls]) || []).filter(function (id) { return !!DB.items[id]; });
        TRIAL_Q[k] = { cls: cls, lv: ch.lv, npc: line.hostN, reqs: ch.reqs.map(function (q) { return [q.id, q.need]; }), rewards: rw, afkLore: line.id };
        ch.reqs.forEach(function (q) { try { var L = (TRIAL_ITEM_Q[q.id] = TRIAL_ITEM_Q[q.id] || []); if (L.indexOf(k) < 0) L.push(k); } catch (e) {} });
      });
    });
    var rr = 'afkLoreRender_' + line.id;
    W[rr] = function (div) { render(line, div); };
    return line;
  };
  // ── 劇情任務介面（玩家 2026-11-01：貼近原本 NPC 製作／試煉面板、標楷體、字放大）──
  //   只管呈現：狀態判斷照核心 trialQHTML 的順序（已完成 → 前章未完成 → 等級不足 → 未接取 → 收集中／可交付），
  //   按鈕仍呼叫 trialQAccept／trialQComplete；核心 trialQHTML 仍會被呼叫，取出其他外掛注入的區塊（afk-retrial 批次兌換、afk-ancdrop 遠古標記）接在卡片裡。
  var KAI = '"DFKai-SB","BiauKai","標楷體","Kaiti TC","STKaiti","KaiTi","TW-Kai","AR PL UKai TW",serif';
  var CSS_ID = 'afk-lore-css';
  var ensureCss = function () {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style'); st.id = CSS_ID;
    st.textContent = [
      '.alq{margin-top:12px;padding:12px 12px 4px;border:1px solid #6b4e36;border-radius:6px;background-image:linear-gradient(180deg,rgba(74,54,40,.45),rgba(40,39,48,0) 120px);box-shadow:inset 0 1px rgba(222,176,112,.12)}',
      '.alq-head{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;padding:0 2px 9px;margin-bottom:10px;border-bottom:1px solid #594638}',
      '.alq-title{font-family:' + KAI + ';font-size:23px;font-weight:bold;line-height:1.3;color:#e7d2a7;letter-spacing:.06em;text-shadow:1px 1px 0 #000,0 0 6px rgba(177,132,84,.35)}',
      '.alq-sum{margin-left:auto;font-size:13px;font-weight:bold;color:#cdb991;padding:2px 10px;border:1px solid #6e5845;border-radius:999px;background:#1d1b20;white-space:nowrap}',
      '.alq-intro{font-family:' + KAI + ';font-size:17px;line-height:1.8;color:#dcd0bb;padding:8px 12px;margin-bottom:10px;border-left:3px solid #8d6846;border-radius:0 4px 4px 0;background:rgba(0,0,0,.2)}',
      '.alq-ch{margin-bottom:10px;padding:12px 14px;border:1px solid #514138;border-radius:6px;background-image:linear-gradient(180deg,#2e2c35,#222027);box-shadow:inset 3px 0 0 var(--alq-acc,#8d6846),inset 0 1px rgba(222,176,112,.06)}',
      '.alq-ch.s-done{--alq-acc:#3f8a5f}.alq-ch.s-ready{--alq-acc:#34d399;border-color:#2f6b4a}.alq-ch.s-active{--alq-acc:#d4943f}.alq-ch.s-lock{--alq-acc:#4b4540}.alq-ch.s-lv{--alq-acc:#9b2c2c}',
      '.alq-ch.s-lock .alq-cht{color:#a59a8c}.alq-ch.s-lock .alq-story{color:#b3a999}',
      '.alq-chh{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px}',
      '.alq-no{font-size:12.5px;font-weight:bold;color:#e7d2a7;padding:1px 8px;border:1px solid #8d6846;border-radius:3px;background:linear-gradient(180deg,#3a2e27,#211d20);white-space:nowrap}',
      '.alq-cht{font-family:' + KAI + ';font-size:21px;font-weight:bold;line-height:1.35;color:#f1d9a6;text-shadow:1px 1px 0 #000}',
      '.alq-lv{font-size:13px;font-weight:bold;color:#a8998a;white-space:nowrap}',
      '.alq-badge{margin-left:auto;font-size:13px;font-weight:bold;padding:2px 10px;border:1px solid;border-radius:999px;white-space:nowrap}',
      '.alq-badge.s-done{color:#7ee2a8;border-color:#2f6b4a;background:rgba(16,64,40,.5)}',
      '.alq-badge.s-ready{color:#bbf7d0;border-color:#34d399;background:rgba(6,95,70,.55);box-shadow:0 0 8px rgba(52,211,153,.35)}',
      '.alq-badge.s-active{color:#fcd38a;border-color:#a8742f;background:rgba(120,72,20,.4)}',
      '.alq-badge.s-new{color:#e7d2a7;border-color:#8d6846;background:rgba(80,58,40,.4)}',
      '.alq-badge.s-lock{color:#9c958c;border-color:#4b4540;background:rgba(30,29,33,.7)}',
      '.alq-badge.s-lv{color:#fca5a5;border-color:#7f1d1d;background:rgba(80,20,20,.4)}',
      '.alq-story{font-family:' + KAI + ';font-size:17px;line-height:1.85;color:#ddd3c3;margin:8px 0 8px}',
      '.alq-meta{font-size:13.5px;line-height:1.6;color:#a8998a;margin-bottom:4px}',
      '.alq-meta b{color:#cdb991;font-weight:bold}',
      '.alq-row{display:flex;align-items:flex-start;gap:8px;margin-top:8px}',
      '.alq-lab{flex:0 0 auto;font-size:14px;color:#a8998a;line-height:40px;white-space:nowrap}',
      '.alq-items{display:flex;flex-wrap:wrap;gap:6px 16px;min-width:0}',
      '.alq-it{display:flex;align-items:center;gap:8px;min-width:0}',
      '.alq-ic{width:40px;height:40px;flex:0 0 40px;display:flex;align-items:center;justify-content:center;background:#17161a;border:1px solid #6e5845;border-radius:4px;box-shadow:inset 0 0 0 1px #0d0c0f}',
      '.alq-ic img{width:34px;height:34px;object-fit:contain;pointer-events:none}',
      '.alq-itx{display:flex;flex-direction:column;min-width:0;line-height:1.3}',
      '.alq-in{font-size:15px;font-weight:bold}',
      '.alq-cnt{font-size:13.5px;font-weight:bold;color:#cfc6b8}',
      '.alq-cnt .ok{color:#4ade80}.alq-cnt .no{color:#f87171}',
      '.alq-sub{font-size:12px;color:#8f877d;font-weight:normal}',
      '.alq-act{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-top:12px;padding-top:10px;border-top:1px dashed #4a3c32}',
      '.alq-act .btn{font-size:15px}',
      '.alq-note{font-size:13.5px;line-height:1.6;color:#8f877d}',
      '.alq-warn{font-size:13.5px;line-height:1.6;color:#f87171}',
      '.alq-ext{margin-top:8px}',
      '.alq-ext>div{padding:8px 10px!important;background:rgba(0,0,0,.18)}',
      '.alq-ext .text-xs{font-size:13px;line-height:1.6}',
      '.alq-more{margin-top:6px}',
      '.alq-more>summary{cursor:pointer;list-style:none;display:inline-block;font-size:13px;color:#a8998a;padding:1px 0;user-select:none}',
      '.alq-more>summary::-webkit-details-marker{display:none}',
      '.alq-more>summary::before{content:"▸ ";color:#8d6846}.alq-more[open]>summary::before{content:"▾ "}',
      '.alq-more>summary:hover{color:#e7d2a7}',
      '.alq-outro{font-family:' + KAI + ';font-size:17px;line-height:1.85;color:#f0c4f5;padding:10px 12px;margin-bottom:10px;border:1px solid #6b3f6e;border-radius:6px;background:rgba(60,24,64,.25)}',
      '@media (max-width:640px){.alq{padding:10px 8px 2px}.alq-title{font-size:21px}.alq-ch{padding:10px 10px}.alq-cht{font-size:19px}.alq-story,.alq-intro,.alq-outro{font-size:16px;line-height:1.75}.alq-ic{width:36px;height:36px;flex-basis:36px}.alq-ic img{width:30px;height:30px}.alq-lab{line-height:36px}.alq-items{gap:6px 12px}.alq-badge{margin-left:0}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  };
  var iconOf = function (id) { var d = DB.items[id]; if (!d) return ''; try { return typeof getIconUrl === 'function' ? getIconUrl(d) : (d.img || ''); } catch (e) { return d.img || ''; } };
  var colorOf = function (id) { try { return typeof getItemColor === 'function' ? getItemColor({ id: id }) : 'text-amber-200'; } catch (e) { return 'text-amber-200'; } };
  var chip = function (id, name, cls, cnt, sub, tag) {   // 圖示框＋名稱（＋數量）——同製作面板的 48px 圖示框縮小版
    var img = id === 'gold' ? 'assets/icons/items/金幣.png' : iconOf(id);
    return '<div class="alq-it"><div class="alq-ic' + (id !== 'gold' && DB.items[id] ? ' tip-host" data-tip-id="' + esc(id) + '"' : '"') + '>'
      + (img ? '<img src="' + esc(img) + '" onerror="this.style.display=\'none\'" alt="">' : '') + '</div>'
      + '<div class="alq-itx"><span class="alq-in ' + cls + '">' + esc(name) + (tag || '') + '</span>' + (cnt ? '<span class="alq-cnt">' + cnt + '</span>' : '') + (sub ? '<span class="alq-sub">' + sub + '</span>' : '') + '</div></div>';
  };
  var row = function (lab, inner) { return inner ? '<div class="alq-row"><span class="alq-lab">' + lab + '</span><div class="alq-items">' + inner + '</div></div>' : ''; };
  // 核心 trialQHTML 的輸出：取出其他外掛加進去的東西（批次兌換區塊、遠古標記）
  var extOf = function (k, rr) {
    var out = { blocks: '', anc: {} };
    if (typeof trialQHTML !== 'function') return out;
    var raw = '';
    try { raw = trialQHTML(k, rr) || ''; } catch (e) { return out; }
    if (!raw) return out;
    try {
      var t = document.createElement('div'); t.innerHTML = raw;
      var root = t.firstElementChild; if (!root) return out;
      Array.prototype.forEach.call(root.querySelectorAll('b.text-sky-300'), function (b) { var n = b.nextElementSibling; if (n && n.classList.contains('c-ancient')) out.anc[b.textContent] = n.outerHTML; });
      Array.prototype.forEach.call(root.children, function (c) { if (/批次兌換/.test(c.textContent)) out.blocks += c.outerHTML.replace(/試煉/g, '任務'); });
    } catch (e) {}
    return out;
  };
  var STN = { done: '已完成', ready: '可交付', active: '進行中', 'new': '未接取', lock: '未解鎖', lv: '等級不足' };
  var html = function (line, p) {
    ensureCss();
    var rr = 'afkLoreRender_' + line.id, n = line.chapters.length;
    var done = line.chapters.filter(function (ch, i) { return trialQStateFor(p, keyOf(line, i, p.cls)) === 2; }).length;
    var h = '<div id="afk-lore-' + line.id + '" class="alq"><div class="alq-head"><span class="alq-title">📜 劇情「' + esc(line.name) + '」</span><span class="alq-sum">已完成 ' + done + '／' + n + ' 章</span></div>'
      + (line.intro ? '<div class="alq-intro">' + line.intro + '</div>' : '');
    line.chapters.forEach(function (ch, i) {
      var k = keyOf(line, i, p.cls), st = trialQStateFor(p, k), c = TRIAL_Q[k] || { reqs: [], rewards: [] };
      var reqs = c.reqs || [], have = function (id) { return typeof questCountId === 'function' ? questCountId(id) : 0; };
      var ok = reqs.every(function (r) { return have(r[0]) >= r[1]; });
      var s = st === 2 ? 'done' : !prevDone(line, i, p) ? 'lock' : (p.lv || 1) < ch.lv ? 'lv' : st === 0 ? 'new' : ok ? 'ready' : 'active';
      var ext = (s === 'done' || s === 'ready' || s === 'active') ? extOf(k, rr) : { blocks: '', anc: {} };
      var mobs = []; (ch.reqs || []).forEach(function (q) { (q.mobs || []).forEach(function (m) { if (mobs.indexOf(m) < 0) mobs.push(m); }); });
      var reqH = reqs.map(function (r) {
        var d = DB.items[r[0]] || {}, hv = have(r[0]), lk = 0;
        if (hv < r[1] && typeof lockedCountId === 'function') { try { lk = lockedCountId(r[0]); } catch (e) {} }
        return chip(r[0], d.n || r[0], 'text-amber-200', '<span class="' + (hv >= r[1] ? 'ok' : 'no') + '">' + Math.min(hv, r[1]) + '</span>/' + r[1], lk > 0 ? '另 ' + lk + ' 個已上鎖不計' : '');
      }).join('');
      var rwH = (c.rewards || []).map(function (id) { var d = DB.items[id] || {}; return chip(id, d.n || id, colorOf(id), '', '', ext.anc[d.n] || ''); }).join('');
      var firstH = (ch.first || []).map(function (x) { return chip(x[0], x[0] === 'gold' ? '金幣' : (DB.items[x[0]] || {}).n, x[0] === 'gold' ? 'text-yellow-300' : colorOf(x[0]), '×' + Number(x[1]).toLocaleString()); }).join('');
      var body = '<div class="alq-story">' + ch.story + '</div>'
        + '<div class="alq-meta">地點：<b>' + esc(ch.map) + '</b>' + (mobs.length ? '（' + mobs.map(esc).join('、') + '）' : '') + '</div>'
        + row('需求：', reqH) + row('獎勵：', rwH) + row('首次另送：', firstH);
      h += '<div class="alq-ch s-' + s + '"><div class="alq-chh"><span class="alq-no">' + esc(line.name) + ' ' + (i + 1) + '／' + n + '</span><span class="alq-cht">' + esc(ch.title) + '</span><span class="alq-lv">Lv' + ch.lv + '</span><span class="alq-badge s-' + s + '">' + STN[s] + '</span></div>';
      if (s === 'done') h += '<details class="alq-more"><summary>回顧這一章</summary>' + body + '</details>' + (ext.blocks ? '<div class="alq-ext">' + ext.blocks + '</div>' : '');
      else {
        h += body + '<div class="alq-act">';
        if (s === 'lock') h += '<span class="alq-note">完成「' + esc(line.chapters[i - 1].title) + '」後才能接取。</span>';
        else if (s === 'lv') h += '<span class="alq-warn">需要等級 ' + ch.lv + ' 以上才能接取此任務。</span>';
        else if (s === 'new') h += '<button class="btn bg-amber-800 hover:bg-amber-700 py-2 px-4 font-bold" onclick="trialQAccept(\'' + k + '\',\'' + rr + '\')">接取任務</button><span class="alq-note">接取後擊殺指定怪物 100% 掉落・無法存入倉庫・達需求數量即停止掉落</span>';
        else if (s === 'ready') h += '<button class="btn bg-emerald-800 hover:bg-emerald-700 py-2 px-4 font-bold" onclick="trialQComplete(\'' + k + '\',\'' + rr + '\')">交付任務（獲得全部獎勵）</button>';
        else h += '<span class="alq-warn">尚未備齊。</span><span class="alq-note">擊殺指定怪物必定掉落，集滿為止' + (reqs.some(function (r) { return have(r[0]) < r[1] && typeof lockedCountId === 'function' && lockedCountId(r[0]) > 0; }) ? '（有道具已上鎖・解鎖後才會列入計數）' : '') + '</span>';
        h += '</div>' + (ext.blocks ? '<div class="alq-ext">' + ext.blocks + '</div>' : '');
      }
      h += '</div>';
    });
    if (line.outro && done === n) h += '<div class="alq-outro">' + line.outro + '</div>';
    return h + '</div>';
  };
  var render = function (line, div) {
    var p = P(); if (!p || !div) return;
    var old = div.querySelector('#afk-lore-' + line.id), box = document.createElement('div'); box.innerHTML = html(line, p);
    if (old) old.replaceWith(box.firstChild); else div.appendChild(box.firstChild);
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      try {
        var div = document.getElementById('interaction-content'); if (!div) return r;
        Object.keys(LINES).forEach(function (id) { var L = LINES[id]; if ((L.hostIds || []).indexOf(npcId) >= 0) { if (L.own === npcId && !div.querySelector('#afk-lore-' + id)) div.innerHTML = ''; render(L, div); } });
      } catch (e) { console.warn('[AFK-lore-kit] ui', e); }
      return r;
    };
  }
  if (typeof W.trialQAccept === 'function') {
    var oAcc = W.trialQAccept;
    W.trialQAccept = function (key) {
      var x = KEYS[key], p = P();
      if (x && p && !prevDone(x.line, x.i, p)) { sys('<span class="text-amber-300">' + esc(x.line.hostN) + '：先把「' + esc(x.line.chapters[x.i - 1].title) + '」的事辦完。</span>'); return; }
      return oAcc.apply(this, arguments);
    };
  }
  if (typeof W.trialQComplete === 'function') {
    var oDone = W.trialQComplete;
    W.trialQComplete = function (key) {
      var x = KEYS[key], before = x ? trialQState(key) : 0;
      var r = oDone.apply(this, arguments);
      try {
        if (x && before === 1 && trialQState(key) === 2) {
          var ch = x.line.chapters[x.i], got = [];
          (ch.first || []).forEach(function (f) { if (f[0] === 'gold') { player.gold = (Number(player.gold) || 0) + f[1]; got.push('金幣 ×' + Number(f[1]).toLocaleString()); } else if (DB.items[f[0]]) { gainItem(f[0], f[1], true, true); got.push(DB.items[f[0]].n + ' ×' + f[1]); } });
          if (got.length) sys('<span class="text-amber-200">' + esc(x.line.hostN) + '另外交給你：' + got.join('、') + '</span>');
          if (typeof ch.onDone === 'function') ch.onDone(player);
          try { saveGame(); } catch (e) {}
        }
      } catch (e) { console.warn('[AFK-lore-kit] done', e); }
      return r;
    };
  }
  var addNpc = function (town, def, spr, pos) {
    try {
      var t = DB.towns[town]; if (!t) return;
      t.npcs = t.npcs || []; if (!t.npcs.some(function (n) { return n.id === def.id; })) t.npcs.push(def);
      if (spr && typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[def.id]) NPC_SPR_FIXED[def.id] = spr;
      if (pos && typeof TOWN_NPC_POS_OVERRIDE !== 'undefined') (TOWN_NPC_POS_OVERRIDE[town] = TOWN_NPC_POS_OVERRIDE[town] || {})[def.id] = pos;
    } catch (e) {}
  };

  // ── Boss 小工具 ──
  var party = function () { var p = P(); if (!p) return []; var out = []; if (!p.dead) out.push(p); (p.allies || []).forEach(function (a) { if (a && !a._downed && (a.curHp || 0) > 0) out.push(a); }); return out; };
  var hurt = function (t, dmg, trueDmg) {
    var p = P(); if (!t || !(dmg > 0)) return 0;
    if (trueDmg !== false && typeof W.__afkTrueCut === 'function') dmg = W.__afkTrueCut(t, dmg);
    if (typeof W.__afkIncomingMod === 'function') { try { dmg = W.__afkIncomingMod(t, dmg); } catch (e) {} }   // 隱藏規則「命運」等：受到的傷害（afk-fate.js）
    dmg = Math.max(1, Math.floor(dmg));
    if (t === p) { p.hp -= dmg; if (p.hp <= 0 && !p.dead) { try { killPlayer(); } catch (e) {} } }
    else { t.curHp -= dmg; if (t.curHp <= 0) { t.curHp = 0; t._downed = true; t._reviveCd = 150; } }
    return dmg;
  };
  var place = function (idx, base, extra) {
    var o = Object.assign(JSON.parse(JSON.stringify(base)), extra || {});
    mapState.mobs[idx] = Object.assign(o, { curHp: o.hp, uid: uid(), _born: ++_mobBornSeq, _bornMs: Date.now(), _magCd: {}, justHit: false, st: newMobStatus() });
    try { if (typeof applySherineBuff === 'function') applySherineBuff(idx); } catch (e) {}
    var m = mapState.mobs[idx];
    try { if (m.hard && typeof initHardSkin === 'function') initHardSkin(m); } catch (e) {}
    return m;
  };
  var summon = function (id, n, extra) {
    var base = DB.mobs[id]; if (!base) return 0;
    var got = 0;
    for (var i = 0; i < n; i++) {
      var ms = mapState.mobs, j = -1;
      for (var q = 0; q < ms.length; q++) if (!ms[q] || ms[q]._dead) { j = q; break; }
      if (j < 0) break;
      place(j, base, Object.assign({ mobId: id }, extra || {})); got++;
    }
    try { if (got && !S().ff) renderMobs(); } catch (e) {}
    return got;
  };
  var halted = function (m) { return !!(W.__afkHalted && W.__afkHalted(m)); };

  W.__afkLore = { questUI: { ensureCss: ensureCss, chip: chip, row: row, extOf: extOf, STN: STN, colorOf: colorOf }, CLASSES: CLASSES, defineLine: defineLine, lines: LINES, keyOf: keyOf, addItem: addItem, addMob: addMob, aliasAnim: aliasAnim, addNpc: addNpc,
    defineSet: defineSet, setBonus: bonusOf, render: render, html: html, esc: esc, sys: sys, clog: clog,
    boss: { party: party, hurt: hurt, place: place, summon: summon, halted: halted } };
})();
