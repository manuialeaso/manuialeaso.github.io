/* ============================================================================
 * afk-skillup.js — 技能強化（玩家 2026-11-06 18:22 選 B 方案、18:33 同意開工；設計稿 docs/skill-upgrade-design.md B 方案第二版）
 *   外掛開關 skillup（預設開；經典模式沒有）。狀態：測試版，Ping 試玩確認後才上線。
 *
 *   NPC：席琳神殿「技藝導師 薇爾娜」。每個角色各自升級（player.afkSkillUp＝0～3），照順序、必定成功：
 *     一：席琳結晶 100,000          → 全部職業技能 +5%，招牌技能第一段
 *     二：夢艷結晶 100,000          → 再 +5%（累計 +10%），招牌技能第二段
 *     三：轉生用時空材料六種各 1,000 → 再 +10%（累計 +20%），招牌技能第三段
 *   傭兵：吃「他自己的」階段。傭兵是招募當下的快照，所以來源角色升級後要重新招募才生效（Ping 18:33）。
 *
 *   第一批（施放當下讀的數值）＋第二批（戰鬥內部的倍率、機率，11-06 晚）都做完；跟設計稿不同的地方見 SIG_NOTE。
 *   這一版做到的：
 *     ‧+%：施放職業技能當下造成的傷害（玩家 castSkill、傭兵各種施技函式）、立方與冰雪颶風這類持續技能的每一跳、治療技能的回復量。
 *     ‧招牌技能：施放當下讀技能資料的那些數值（發數、骰數、持續、HP／MP 消耗、追加傷害、箭數、刀數），
 *       施放那一下暫時把 DB.skills 換成「施放者自己的階段」的數值，放完立刻還原（玩家、傭兵各算各的）。
 *     ‧面板：增幅防禦的傷害減免、鏡像的迴避（recomputeStats 之後補差額；傭兵重算時 player 會暫時換成傭兵，所以同一套）。
 *     ‧隱藏規則連動（都不寫進任何說明）：
 *         幻術士做過技能強化（≥ 一）→ 取消隱藏規則十三的攻擊魔法 −30%；
 *         流星雨二：副目標 ×0.8 → ×1.0；流星雨三：範圍冷卻 3.5 → 2 秒；
 *         呼喚盟友一：冷卻 3 → 2.5 秒。
 *   HP 消耗「降到 0」一律做成 1：龍血 5 件的「HP 消耗技傷害 +20%」看 sk.hpCost 有沒有值，0 會把這個加成弄掉。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'skillup', name: '技能強化', group: '遊戲內容',
    desc: '席琳神殿「技藝導師 薇爾娜」：用席琳結晶、夢艷結晶、轉生用時空材料強化職業技能（三個階段）' });
  if (T && !T.enabled('skillup')) return;
  if (typeof DB === 'undefined' || !DB.skills) { console.warn('[AFK-skillup] 找不到 DB.skills，略過'); return; }

  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return (typeof state !== 'undefined' && state) ? state : {}; };
  var tk = function () { return Number(S().ticks) || 0; };
  var sys = function (h) { try { logSys(h); } catch (e) {} };

  // ── 階段 ──
  var PCT = [0, 0.05, 0.10, 0.20];
  var stageOf = function (a) {
    if (!a || a.classicMode) return 0;
    var me = P(); if (me && me.classicMode) return 0;
    var s = Math.floor(Number(a.afkSkillUp) || 0);
    return Math.max(0, Math.min(3, s));
  };
  var pctOf = function (a) { return PCT[stageOf(a)] || 0; };

  // ── 費用 ──
  var SHER = 'sherine_crystal', DREAM = 'afk_dream_crystal';
  var TS = ['afk_ts_contempt_earth', 'afk_ts_contempt_water', 'afk_ts_contempt_wind', 'afk_ts_contempt_fire', 'afk_ts_dark_stardust', 'afk_ts_dream_dust'];
  var COST = [null, [[SHER, 100000]], [[DREAM, 100000]], TS.map(function (id) { return [id, 1000]; })];
  var nameOf = function (id) { try { return (DB.items[id] && DB.items[id].n) || id; } catch (e) { return id; } };
  var count = function (id) { var p = P(); return p ? (p.inv || []).reduce(function (s, it) { return s + (it && it.id === id && !it.lock ? Math.max(1, Number(it.cnt) || 1) : 0); }, 0) : 0; };
  var take = function (id, n) {
    var p = P(); if (count(id) < n) return false;
    for (var j = p.inv.length - 1; j >= 0 && n > 0; j--) { var it = p.inv[j]; if (!it || it.id !== id || it.lock) continue; var q = Math.min(n, it.cnt || 1); it.cnt = (it.cnt || 1) - q; n -= q; if (it.cnt <= 0) p.inv.splice(j, 1); }
    return true;
  };
  var pullWh = function (list) {   // 倉庫裡的材料先搬到背包
    try { var MW = W.__afkMatWh; if (MW && MW.on && MW.on()) list.forEach(function (x) { var lack = x[1] - count(x[0]); if (lack > 0) { try { MW.pull(x[0], lack); } catch (e) {} } }); } catch (e) {}
  };
  var lacks = function (st) { return (COST[st] || []).filter(function (x) { return count(x[0]) < x[1]; }).map(function (x) { return nameOf(x[0]) + '還差 ' + (x[1] - count(x[0])).toLocaleString(); }); };
  var upgrade = function () {
    var p = P(); if (!p || p.classicMode) return false;
    var st = stageOf(p) + 1; if (st > 3) return false;
    pullWh(COST[st]);
    var miss = lacks(st);
    if (miss.length) { sys('<span class="text-amber-300">技能強化第' + '一二三'.charAt(st - 1) + '階段：' + miss.join('；') + '。</span>'); return false; }
    COST[st].forEach(function (x) { take(x[0], x[1]); });
    p.afkSkillUp = st;
    sys('<span class="font-bold" style="color:#fde68a">📖 薇爾娜替你重新磨亮了技藝——技能強化第' + '一二三'.charAt(st - 1) + '階段完成。</span>');
    try { calcStats(); } catch (e) {}
    try { saveGame(); } catch (e) {}
    try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e) {}
    return true;
  };

  // ── 招牌技能（施放當下讀的數值）──
  //   每一筆：{ 階段: function (sk) → 要暫時換上的欄位 }；階段越高，前面階段的也一起套。
  var rep = function (arr, n) { var out = []; for (var i = 0; i < n; i++) out.push((arr[i % arr.length] || arr[0]).slice()); return out; };
  var SIG = {
    // 騎士
    sk_shock_stun:      { 1: function (sk) { return { skillAddDmg: (sk.skillAddDmg || 0) + 300 }; } },       // +500 真實 → +800
    sk_counter_barrier: { 1: function (sk) { return { dur: (sk.dur || 64) * 2 }; } },                        // 64 → 128
    // 法師
    sk_meteor:          { 1: function (sk) { return { multiDmg: rep(sk.multiDmg || [[2, 9]], 15) }; },        // 12 → 15 發
                          3: function (sk) { return { mp: 45 }; } },                                          // MP 60 → 45
    sk_blizzard_storm:  { 1: function (sk) { return { dur: Math.round((sk.dur || 32) * 1.5) }; } },          // 32 → 48
    // 妖精
    sk_elf_triple:      { 1: function (sk) { var dream = false; try { dream = !!(W.__afkDreamHell && W.__afkDreamHell.on()); } catch (e) {} return { hits: (sk.hits || 3) + (dream ? 2 : 1) }; } },   // 3 → 4 箭（夢域鏡 10 → 12）
    sk_elf_preciseshot: { 1: function (sk) { return { dur: (sk.dur || 64) * 2 }; } },                        // 64 → 128
    // 龍騎士
    sk_dragon_slaughter:      { 2: function (sk) { return { hits: (sk.hits || 3) + 1 }; },                    // 3 → 4 刀
                                3: function () { return { hpCost: 1 }; } },                                   // 16 → 1
    sk_dragon_deathlightning: { 1: function (sk) { var d = (sk.multiDmg && sk.multiDmg[0]) || [8, 8]; return { multiDmg: [[d[0] + 3, d[1]]] }; },   // 8 顆骰 → 11 顆
                                2: function () { return { hpCost: 20 }; } },                                  // 35 → 20
    sk_dragon_bloodlust:      { 2: function (sk) { return { dur: (sk.dur || 300) * 2 }; },                    // 300 → 600
                                3: function () { return { hpCost: 1 }; } },                                   // 30 → 1
    // 幻術士
    sk_illu_pain:       { 1: function (sk) { return { dur: (sk.dur || 64) * 2 }; },                          // 64 → 128
                          2: function () { return { hpCost: 1 }; } },                                         // 40 → 1
    sk_illu_cube_burn:    { 1: function (sk) { return { dur: Math.round((sk.dur || 20) * 1.5) }; } },        // 20 → 30
    sk_illu_cube_quake:   { 1: function (sk) { return { dur: Math.round((sk.dur || 20) * 1.5) }; } },
    sk_illu_cube_shock:   { 1: function (sk) { return { dur: Math.round((sk.dur || 20) * 1.5) }; } },
    sk_illu_cube_harmony: { 1: function (sk) { return { dur: Math.round((sk.dur || 20) * 1.5) }; } },
    // 王族
    sk_royal_precise:   { 1: function (sk) { return { dur: (sk.dur || 16) * 2 }; } }                         // 16 → 32
  };

  var patchFor = function (actor, sk) {
    var id = sk && sk._afkSuId; if (!id || !SIG[id]) return null;
    var st = stageOf(actor); if (!st) return null;
    var out = null;
    for (var s = 1; s <= st; s++) { var f = SIG[id][s]; if (f) { var o = f(sk); out = Object.assign(out || {}, o); } }
    return out;
  };
  Object.keys(SIG).forEach(function (id) { if (DB.skills[id]) { try { Object.defineProperty(DB.skills[id], '_afkSuId', { value: id, enumerable: false }); } catch (e) {} } });

  // ── 施放情境：誰在放哪一招 ──
  var stack = [];
  var FLAGS = ['darkCrit', 'call', 'counter', 'atk', 'spirit', 'frost', 'cube'];
  var cur = function () { return stack.length ? stack[stack.length - 1] : null; };
  // 暫時換欄位：有的欄位是別的外掛裝的 getter（例：三重矢的 hits），所以存「描述子」、換成一般欄位、用完把描述子裝回去
  var applyPatch = function (sk, patch) {
    var saved = [];
    Object.keys(patch).forEach(function (k) {
      var d = Object.getOwnPropertyDescriptor(sk, k);
      try { Object.defineProperty(sk, k, { value: patch[k], writable: true, configurable: true, enumerable: d ? d.enumerable : true }); saved.push([k, d]); } catch (e) {}
    });
    return function () {
      for (var i = saved.length - 1; i >= 0; i--) {
        var k = saved[i][0], d = saved[i][1];
        try { if (d) Object.defineProperty(sk, k, d); else delete sk[k]; } catch (e) {}
      }
    };
  };
  var withCtx = function (actor, sk, fn, self, args, extra) {
    var patch = sk ? patchFor(actor, sk) : null, undo = patch ? applyPatch(sk, patch) : null;
    var par = cur(), inh = {};
    if (par && par.actor === actor) FLAGS.forEach(function (f) { if (par[f]) inh[f] = par[f]; });   // 同一個人巢狀施放（例：會心一擊、呼喚盟友外層）沿用外層的標記
    stack.push(Object.assign(inh, { actor: actor, sk: sk, pct: true, n: 0 }, extra || {}));
    try { return fn.apply(self, args); }
    finally { stack.pop(); if (undo) undo(); }
  };
  var isMember = function (x) { var p = P(); return !!(p && x && (x === p || (p.allies || []).indexOf(x) >= 0)); };

  // 玩家施技
  if (typeof W.castSkill === 'function') {
    var oCast = W.castSkill;
    W.castSkill = function (skId) {
      var p = P(), sk = DB.skills[skId];
      if (!p || !sk || !stageOf(p)) return oCast.apply(this, arguments);
      var before = (p._afkCallCd || 0), r = withCtx(p, sk, oCast, this, arguments);
      if (r && sk.callAllies && stageOf(p) >= 1 && (p._afkCallCd || 0) > before && (p._afkCallCd || 0) > tk()) p._afkCallCd -= 5;   // 呼喚盟友一：3 → 2.5 秒
      return r;
    };
  }
  // 傭兵施技（第一個參數是傭兵；sk 在第二個參數，沒有的用 null）
  var wrapAlly = function (name, skArg, extra) {
    var o = W[name]; if (typeof o !== 'function' || o._afkSu) return;
    var f = function (ally) {
      if (!ally || !stageOf(ally)) return o.apply(this, arguments);
      var sk = skArg != null ? arguments[skArg] : null;
      return withCtx(ally, (sk && typeof sk === 'object') ? sk : null, o, this, arguments, extra);
    };
    f._afkSu = true; W[name] = f;
  };
  [['allyCastMagic', 1], ['allyCastNonDamage', 1], ['allyCastPhysicalSkill', 1], ['allyCastCrush', 1], ['allyCastFixedStatus', 1],
    ['allyCastSlaughter', 1], ['allyCastMpDmg', 1], ['allyStormTick', 1], ['allyDarkCrit', null], ['allyCubeTick', null, { cube: true }]].forEach(function (x) { wrapAlly(x[0], x[1], x[2]); });
  // 傭兵三重矢：核心固定射 3 箭，一階再補 1 箭
  if (typeof W.allyTripleShot === 'function') {
    var oTri = W.allyTripleShot;
    W.allyTripleShot = function (ally) {
      if (!ally || !stageOf(ally)) return oTri.apply(this, arguments);
      return withCtx(ally, null, function () {
        var r = oTri.apply(this, arguments);
        try { var t = getTarget(); if (t && t.curHp > 0 && typeof allyAttackOnce === 'function') allyAttackOnce(ally, 270); } catch (e) {}
        return r;
      }, this, arguments);
    };
  }
  // 傭兵自己維持增益（持續、HP 消耗照他自己的階段）：逐招套數值
  if (typeof W.allyMaintainBuffs === 'function') {
    var oMB = W.allyMaintainBuffs;
    W.allyMaintainBuffs = function (ally) {
      if (!ally || !stageOf(ally)) return oMB.apply(this, arguments);
      var undos = [];
      try {
        (ally.skills || []).forEach(function (sid) {
          var sk = DB.skills[sid], patch = sk ? patchFor(ally, sk) : null; if (patch) undos.push(applyPatch(sk, patch));
        });
        return oMB.apply(this, arguments);
      } finally {
        for (var i = undos.length - 1; i >= 0; i--) undos[i]();
      }
    };
  }
  // 傭兵呼喚盟友冷卻
  if (typeof W.allyRoyalAct === 'function') {
    var oRA = W.allyRoyalAct;
    W.allyRoyalAct = function (ally) {
      var before = ally ? (ally._afkCallCd || 0) : 0, r = oRA.apply(this, arguments);
      try { if (ally && stageOf(ally) >= 1 && (ally._afkCallCd || 0) > before && (ally._afkCallCd || 0) > tk()) ally._afkCallCd -= 5; } catch (e) {}
      return r;
    };
  }
  // 玩家的持續技能（立方每一跳、冰雪颶風這類增益每一跳）
  if (typeof W.cubeTick === 'function') {
    var oCube = W.cubeTick;
    W.cubeTick = function () { var p = P(); if (!p || !stageOf(p)) return oCube.apply(this, arguments); return withCtx(p, null, oCube, this, arguments, { cube: true }); };
  }
  if (typeof W.stormBuffTick === 'function') {
    var oStorm = W.stormBuffTick;
    W.stormBuffTick = function (sk, noMageBonus) {
      var p = P(); if (!p || !stageOf(p) || noMageBonus) return oStorm.apply(this, arguments);   // noMageBonus＝魔女套裝觸發的冰雪暴，不是職業技能
      return withCtx(p, null, oStorm, this, arguments);
    };
  }

  // ── +%：傷害（以及第二批各種「打出去那一下」的加成，見 dealt）──
  var dmgHooked = false;
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (dmgHooked) return true; if (!C || typeof C.damage !== 'function') return false; dmgHooked = true;
    var o = C.damage;
    var f = function (actor, target, amount, opt) {
      try { if (actor && target && !isMember(target) && amount > 0) amount = dealt(actor, target, amount, opt || {}); } catch (e) {}
      return o.call(this, actor, target, amount, opt);
    };
    f._afkSu = true; C.damage = f; return true;
  };
  var dmgOk = function () { return dmgHooked; };
  var dealtHooks = [];
  var dealt = function (actor, target, amount, opt) {
    var c = cur();
    if (c && actor === c.actor) {
      c.n++;
      for (var i = 0; i < dealtHooks.length; i++) amount = dealtHooks[i](c, actor, target, amount, opt);
      if (c.pct) { var k = pctOf(actor); if (k > 0) amount = amount * (1 + k); }
      if (c.mult) amount = amount * c.mult;
    }
    amount = markMult(actor, target, amount);
    return Math.max(1, Math.floor(amount));
  };
  if (!hookDamage()) { try { document.addEventListener('DOMContentLoaded', hookDamage); } catch (e) {} }

  // ── +%：治療 ──
  if (typeof W.rollHealingSpell === 'function') {
    var oHeal = W.rollHealingSpell;
    W.rollHealingSpell = function (sk, dStats, caster, target) {
      var v = oHeal.apply(this, arguments);
      try { var k = pctOf(caster); if (k > 0 && v > 0 && !(sk && sk.fullRestore)) v = Math.floor(v * (1 + k)); } catch (e) {}
      return v;
    };
  }

  // ── 面板：增幅防禦、鏡像 ──
  if (typeof W.recomputeStats === 'function') {
    var oRe = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe.apply(this, arguments);
      try {
        var p = P(), st = stageOf(p); if (!p || !st || !p.d) return r;
        var b = p.buffs || {};
        if (b.sk_reduction_armor > 0) {
          var lv = Math.max(1, Number(p.lv) || 1), base = Math.floor(lv / 10), now = st >= 3 ? Math.floor(lv / 6) : Math.floor(lv / 8);
          if (now > base) p.d.dr = (Number(p.d.dr) || 0) + (now - base);
        }
        if (b.sk_illu_mirror > 0) p.d.er = (Number(p.d.er) || 0) + 10;   // 鏡像 +25 → +35
      } catch (e) {}
      return r;
    };
  }

  // ── 隱藏規則連動（不寫進任何說明）──
  var linkHidden = function () {
    var H = W.__afkHidden;
    if (typeof W.__afkSpellRoll === 'function' && !W.__afkSpellRoll._afkSu) {
      var oRoll = W.__afkSpellRoll;
      var f = function (a, t, sk, targets, ally) {
        var r = oRoll.apply(this, arguments);
        try {
          if (!r || !a) return r;
          var st = stageOf(a);
          if (st >= 1 && a.cls === 'illusion' && H && H.illuSk && H.illuSk(sk) && H.ILLU_CUT) r.mult = r.mult / H.ILLU_CUT;   // 十三：幻術士做過技能強化就取消
          if (st >= 2 && sk && sk._afkSuId === 'sk_meteor' && H && H.SPLASH && r.noCrit && Math.abs(r.mult - H.SPLASH) < 1e-9) r.mult = 1;   // 流星雨二：副目標 ×1.0（仍不爆擊）
        } catch (e) {}
        return r;
      };
      f._afkSu = true; W.__afkSpellRoll = f;
    }
    if (typeof W.__afkHiddenAoeCd === 'function' && !W.__afkHiddenAoeCd._afkSu) {
      var oCd = W.__afkHiddenAoeCd;
      var g = function (sk, a) {
        var v = oCd.apply(this, arguments);
        try { var who = a || P(); if (v > 0 && sk && sk._afkSuId === 'sk_meteor' && stageOf(who) >= 3) v = Math.min(v, 20); } catch (e) {}   // 流星雨三：3.5 → 2 秒
        return v;
      };
      g._afkSu = true; W.__afkHiddenAoeCd = g;
    }
  };
  linkHidden(); try { document.addEventListener('DOMContentLoaded', linkHidden); } catch (e) {}

  // ════════════════ 第二批：要改戰鬥內部算法的招牌效果（11-06 18:50 Ping：繼續做到完成）════════════════
  //   原則：核心檔不動，只包全域函式；核心裡寫死的機率／倍率（狂暴、雙重破壞、勇猛意志）用「施放者是升過級的人時，
  //   先把核心那一段關掉、改由這裡照新數值重擲」的方式做，所以不會跟原本的疊兩次。
  var EV = function (x) { try { return (0, eval)(x); } catch (e) { return undefined; } };
  var rnd = function () { return Math.random(); };
  var hasSk = function (a, id) { return !!(a && a.skills && a.skills.indexOf(id) >= 0); };
  var mOf = function (a, id) { try { if (typeof W._afkM === 'function') return !!W._afkM(a, id); } catch (e) {} return !!(a && a.mastery === id); };
  var tagsOf = function (a) { try { return (a && a.eq && a.eq.wpn && typeof getWeaponTags === 'function') ? getWeaponTags(a.eq.wpn.id) : []; } catch (e) { return []; } };
  var artOf = function (a) { return a && a.rebirth > 0 ? a.rebirthArt : null; };
  var party = function () { var p = P(); return p ? [p].concat(p.allies || []) : []; };
  var PHYS = { melee: 1, ranged: 1, phys: 1 };

  // ── 目標身上的印記：暈住的頭目、被凍住、奪命之雷打到的王（全隊打牠都加）──
  var mark = function (t, key, ticks, k) { if (!t) return; var m = t._afkSuMk || (t._afkSuMk = {}); m[key] = { until: tk() + ticks, k: k }; };
  var partyBuff = { until: -1, k: 0 };   // 勇猛意志三：全隊 3 秒傷害 +10%
  var markMult = function (actor, target, amount) {
    if (!isMember(actor)) return amount;
    var m = target && target._afkSuMk, t = tk();
    if (m) Object.keys(m).forEach(function (key) {
      var x = m[key]; if (!x || x.until < t) return;
      if (key === 'frost' && !(target.st && target.st.freeze > 0)) return;
      amount *= 1 + x.k;
    });
    if (partyBuff.until >= t) amount *= 1 + partyBuff.k;
    return amount;
  };

  // ── 一般攻擊：狂暴、雙重破壞、勇猛意志、粉碎對頭目 ──
  var DD_W = ['雙刀', '鋼爪'];
  var ddChance = function (a) { return 10 + ((a.lv || 1) >= 45 ? Math.floor(((a.lv || 1) - 45) / 5) : 0); };
  var hide = function (a) {   // 回傳還原函式；只關掉「這個角色有升級、而且會由這裡重擲」的那幾項
    var st = stageOf(a), undo = [];
    if (!st) return null;
    if (hasSk(a, 'sk_warrior_berserk')) { var i = a.skills.indexOf('sk_warrior_berserk'); a.skills.splice(i, 1); undo.push(function () { a.skills.splice(i, 0, 'sk_warrior_berserk'); }); a._afkSuBz = true; }
    if (a.buffs && a.buffs.sk_dark_double > 0) { var v = a.buffs.sk_dark_double; a.buffs.sk_dark_double = 0; undo.push(function () { a.buffs.sk_dark_double = v; }); a._afkSuDd = true; }
    if (a.buffs && a.buffs.sk_royal_bravewill > 0 && artOf(a) !== 'r_sword') { var b = a.buffs.sk_royal_bravewill; a.buffs.sk_royal_bravewill = 0; undo.push(function () { a.buffs.sk_royal_bravewill = b; }); a._afkSuBw = true; }
    return function () { for (var j = undo.length - 1; j >= 0; j--) undo[j](); };
  };
  var rerollAtk = function (a, amount, ranged) {
    var st = stageOf(a), t = tk();
    if (a._afkSuBz && !ranged && rnd() < 0.07) {   // 狂暴一：5% → 7%；二：×2 → ×2.5；三：之後 3 秒攻速 +20%
      amount *= st >= 2 ? 2.5 : 2;
      if (st >= 3 && a === P()) { var was = (a._afkSuBzUntil || 0) > t; a._afkSuBzUntil = t + 30; if (!was) { try { calcStats(); } catch (e) {} } }
    }
    if (a._afkSuDd) {   // 雙重破壞一：+3%；二：×2.5；三：匕首也有效
      var tg = tagsOf(a), okW = DD_W.some(function (x) { return tg.indexOf(x) >= 0; }) || (st >= 3 && tg.indexOf('匕首') >= 0);
      if (okW && rnd() * 100 < ddChance(a) + 3) amount *= st >= 2 ? 2.5 : 2;
    }
    if (a._afkSuBw && rnd() < (mOf(a, 'k_royal_sword') ? 0.2 : 0.1) + 0.05) {   // 勇猛意志一：+5%；二：×1.8；三：全隊 3 秒 +10%
      amount *= st >= 2 ? 1.8 : 1.5;
      if (st >= 3) { partyBuff.until = t + 30; partyBuff.k = 0.10; }
    }
    return amount;
  };
  var unflag = function (a) { a._afkSuBz = a._afkSuDd = a._afkSuBw = false; };
  if (typeof W.playerAttack === 'function') {
    var oPA = W.playerAttack;
    W.playerAttack = function () {
      var p = P(); if (!p || !stageOf(p)) return oPA.apply(this, arguments);
      var undo = hide(p);
      try { return withCtx(p, null, oPA, this, arguments, { pct: false, atk: true }); }
      finally { if (undo) undo(); unflag(p); }
    };
  }
  dealtHooks.push(function (c, a, t, amount, opt) {
    if (!c.atk || !PHYS[opt.kind]) return amount;
    amount = rerollAtk(a, amount, opt.kind === 'ranged');
    var st = stageOf(a);
    if (st >= 3 && hasSk(a, 'sk_warrior_crush') && t.boss && opt.kind !== 'ranged') amount += crushBonus(a) * 1.2 * 0.25;   // 粉碎三：對頭目再 ×1.25（加在粉碎那一份上）
    return amount;
  });
  if (typeof W._allyAtkBuffProcs === 'function') {   // 傭兵一般攻擊的增益判定（狂暴、勇猛意志、雙重破壞都在這裡）
    var oAB = W._allyAtkBuffProcs;
    W._allyAtkBuffProcs = function (ally, dmg, isRanged) {
      if (!ally || !stageOf(ally)) return oAB.apply(this, arguments);
      var undo = hide(ally), r;
      try { r = oAB.apply(this, arguments); r = Math.max(1, Math.floor(rerollAtk(ally, r, !!isRanged))); }
      finally { if (undo) undo(); unflag(ally); }
      return r;
    };
  }
  var crushBonus = function (a) { return 2 + Math.max(0, (a.lv || 1) - 44); };

  // ── 反擊屏障：二 ×2 → ×2.5；三 必定爆擊 ──
  var counterCtx = 0;
  ['procCounter', 'procIai'].forEach(function (name) {
    var o = W[name]; if (typeof o !== 'function') return;
    W[name] = function () {
      var p = P(); if (!p || !stageOf(p)) return o.apply(this, arguments);
      counterCtx++;
      try { return withCtx(p, null, o, this, arguments, { pct: false, counter: true }); } finally { counterCtx--; }
    };
  });
  dealtHooks.push(function (c, a, t, amount) {
    if (c.counter && stageOf(a) >= 2 && a.buffs && a.buffs.sk_counter_barrier > 0) amount *= 1.25;
    return amount;
  });
  var allyReact = 0;
  ['allyReactCounter', 'allyReactIai'].forEach(function (name) {
    var o = W[name]; if (typeof o !== 'function') return;
    W[name] = function () { allyReact++; try { return o.apply(this, arguments); } finally { allyReact--; } };
  });
  if (typeof W._allyStrikeWithIllu === 'function') {
    var oASI = W._allyStrikeWithIllu;
    W._allyStrikeWithIllu = function (ally, mob, opts) {
      var st = stageOf(ally), bar = !!(ally && ally.buffs && ally.buffs.sk_counter_barrier > 0);
      if (allyReact && st >= 3 && bar) { opts = Object.assign({}, opts || {}, { forceCrit: true }); arguments[2] = opts; }
      var r = oASI.apply(this, arguments);
      try { if (allyReact && st >= 2 && bar && r && r.dmg > 0) r.dmg = Math.max(1, Math.floor(r.dmg * 1.25)); } catch (e) {}
      return r;
    };
  }

  // ── getPhysicalDmg：強制爆擊（反擊屏障三、暗隱術二、三重矢三的最後一箭）──
  if (typeof W.getPhysicalDmg === 'function') {
    var oGPD = W.getPhysicalDmg;
    W.getPhysicalDmg = function () {
      try {
        var p = P(), c = cur(), force = false;
        if (p && c && c.actor === p) {
          var st = stageOf(p);
          if (c.counter && st >= 3 && p.buffs && p.buffs.sk_counter_barrier > 0) force = true;
          if (c.atk && p._afkSuSure) { force = true; p._afkSuSure = false; }
          if (c.sk && c.sk._afkSuId === 'sk_elf_triple' && st >= 3) { c.arrow = (c.arrow || 0) + 1; if (c.arrow === (c.sk.hits || 3)) force = true; }
        }
        if (force) { var args = Array.prototype.slice.call(arguments); while (args.length < 8) args.push(undefined); args[7] = true; return oGPD.apply(this, args); }
      } catch (e) {}
      return oGPD.apply(this, arguments);
    };
  }

  // ── 三重矢二：夢域鏡遞減 −10% → −6%（每支箭）──
  if (typeof W.__afkTripleArrowMult === 'function') {
    var oTAM = W.__afkTripleArrowMult;
    W.__afkTripleArrowMult = function (actor, opt) {
      var v = oTAM.apply(this, arguments);
      try {
        if (stageOf(actor) >= 2 && !(opt && opt.second)) {
          var c = cur(); if (c && c.actor === actor) { c.tri = (c.tri || 0) + 1; var n = c.tri; v = n <= 3 ? 1 : Math.max(0.30, 1 - 0.06 * (n - 3)); }
        }
      } catch (e) {}
      return v;
    };
  }

  // ── 精準射擊三：期間無視硬皮（玩家一般攻擊與技能）──
  if (typeof W.mobHardSkin === 'function') {
    var oMHS = W.mobHardSkin;
    W.mobHardSkin = function (m) {
      try { var p = P(), c = cur(); if (p && c && c.actor === p && stageOf(p) >= 3 && p.buffs && p.buffs.sk_elf_preciseshot > 0) return 0; } catch (e) {}
      return oMHS.apply(this, arguments);
    };
  }

  // ── 屠宰者一：每層弱點曝光 +10 → +15（每刀）；會心一擊二：倍率上限 ×10 → ×12 ──
  dealtHooks.push(function (c, a, t, amount) {
    var id = c.sk && c.sk._afkSuId, st = stageOf(a);
    if (id === 'sk_dragon_slaughter' && st >= 1 && (t.weakExpose || 0) > 0) amount += 5 * t.weakExpose;
    if (c.darkCrit && st >= 2) amount *= 1.2;
    return amount;
  });
  // 會心一擊：一 HP 消耗 50% → 40%；二 ×1.2（上面）；三 MP 只扣一半
  var DCRIT = DB.skills.sk_dark_crit;
  if (DCRIT) { try { Object.defineProperty(DCRIT, '_afkSuId', { value: 'sk_dark_crit', enumerable: false }); } catch (e) {} }
  var darkCritAround = function (a, fn, self, args) {
    var st = stageOf(a), hp0 = a === P() ? a.hp : a.curHp, mp0 = a.mp, mhp = a.mhp || 1;
    var r = withCtx(a, null, fn, self, args, { pct: true, darkCrit: true });
    try {
      var hp1 = a === P() ? a.hp : a.curHp;
      if (hp1 < hp0 && st >= 1) { var back = Math.floor(mhp * 0.1); if (a === P()) a.hp = Math.min(mhp, a.hp + back); else a.curHp = Math.min(mhp, a.curHp + back); }
      if (st >= 3 && a.mp < mp0) a.mp = Math.floor(mp0 / 2);
    } catch (e) {}
    return r;
  };
  if (DCRIT && typeof W.castSkill === 'function') {
    var oCast2 = W.castSkill;
    W.castSkill = function (skId) {
      var p = P(); if (skId === 'sk_dark_crit' && p && stageOf(p)) return darkCritAround(p, oCast2, this, arguments);
      return oCast2.apply(this, arguments);
    };
  }
  if (typeof W.allyDarkCrit === 'function') {
    var oADC = W.allyDarkCrit;
    W.allyDarkCrit = function (ally) { if (ally && stageOf(ally)) return darkCritAround(ally, oADC, this, arguments); return oADC.apply(this, arguments); };
  }

  // ── 呼喚盟友：二 傭兵補的那一下 ×1.3；三 寵物、召喚物、城堡護衛也補一下 ──
  if (typeof W.allyAttackOnce === 'function') {
    var oAAO = W.allyAttackOnce;
    W.allyAttackOnce = function (ally) {
      var c = cur();
      if (c && c.call && stageOf(c.actor) >= 2 && ally) return withCtx(ally, null, oAAO, this, arguments, { pct: false, mult: 1.3 });
      return oAAO.apply(this, arguments);
    };
  }
  var callExtras = function () {
    var t = null; try { t = getTarget(); } catch (e) {} if (!t || !(t.curHp > 0)) return;
    var p = P(); if (!p) return;
    try { if (typeof petsOutList === 'function' && typeof petAttackOnce === 'function' && typeof petDerive === 'function') petsOutList().forEach(function (pet) { if (!pet || pet._downed) return; var d = petDerive(pet); if (d && t.curHp > 0) petAttackOnce(pet, d, t); }); } catch (e) {}
    try { if (typeof guardAttackOnce === 'function' && typeof guardDerive === 'function') (p.guardsV2 || []).forEach(function (g) { if (!g || g._downed || t.curHp <= 0) return; var d = guardDerive(g); if (d) guardAttackOnce(g, d, t); }); } catch (e) {}
    try { if (typeof summonV2AttackOnce === 'function') (p.summonsV2 || []).forEach(function (s) { if (!s || s._downed || t.curHp <= 0) return; var d = EV('typeof _sumDeriveAny === "function" ? _sumDeriveAny : null'); d = d ? d(s) : null; if (d) summonV2AttackOnce(s, d, t); }); } catch (e) {}
    try { var i = mapState.mobs.findIndex(function (m) { return m && m.uid === t.uid; }); if (t.curHp <= 0 && i !== -1) killMob(i); } catch (e) {}
  };
  if (typeof W.castSkill === 'function') {
    var oCast3 = W.castSkill;
    W.castSkill = function (skId) {
      var p = P(), sk = DB.skills[skId];
      if (!p || !sk || !sk.callAllies || !stageOf(p)) return oCast3.apply(this, arguments);
      var r = withCtx(p, null, oCast3, this, arguments, { pct: false, call: true });
      if (r && stageOf(p) >= 3) callExtras();
      return r;
    };
  }
  if (typeof W.allyRoyalAct === 'function') {
    var oRA2 = W.allyRoyalAct;
    W.allyRoyalAct = function (ally) { if (ally && stageOf(ally) >= 2) return withCtx(ally, null, oRA2, this, arguments, { pct: false, call: true }); return oRA2.apply(this, arguments); };
  }

  // ── 精準目標：二 等級 ÷10 → ÷8（沒精通 ÷15 → ÷12）；三 對頭目效果 ×1.5 ──
  if (typeof W.fragileMult === 'function') {
    var oFM = W.fragileMult;
    W.fragileMult = function (t) {
      var v = oFM.apply(this, arguments);
      try {
        var p = P(), pp = null;
        if (p && p.buffs && p.buffs.sk_royal_precise > 0) pp = p;
        else if (p) (p.allies || []).some(function (a) { if (a && !a._downed && a.buffs && a.buffs.sk_royal_precise > 0) { pp = a; return true; } return false; });
        var st = stageOf(pp);
        if (pp && st >= 2) {
          var div = pp.mastery === 'k_royal_pledge' || mOf(pp, 'k_royal_pledge') ? 10 : 15, lv = pp.lv || 1;
          var oldK = (1 + lv / div) / 100, newK = (1 + lv / (div === 10 ? 8 : 12)) / 100;
          if (st >= 3 && t && t.boss) newK *= 1.5;
          v = v / (1 + oldK) * (1 + newK);
        }
        if (titanFlag.on && titanFlag.t === tk()) { titanFlag.on = false; var a0 = titanFlag.a; if (stageOf(a0) >= 2) v *= 1.3; if (stageOf(a0) >= 3) { var heal = Math.floor((a0.mhp || 0) * 0.01); if (a0 === P()) a0.hp = Math.min(a0.mhp, a0.hp + heal); } }
      } catch (e) {}
      return v;
    };
  }

  // ── 泰坦：一 門檻 80% → 90%（沒精通 40% → 50%）；二 反射量 +30%；三 每次反射回 HP 1% ──
  var titanFlag = { on: false, t: -1, a: null };
  if (typeof W.titanThreshold === 'function') {
    var oTT = W.titanThreshold;
    W.titanThreshold = function () {
      var v = oTT.apply(this, arguments);
      try {
        var p = P();
        if (p && stageOf(p) >= 1) {
          v = Math.min(0.95, v + 0.1);
          if (p.hp < p.mhp * v && (hasSk(p, 'sk_warrior_titan_rock') || hasSk(p, 'sk_warrior_titan_magic'))) { titanFlag.on = true; titanFlag.t = tk(); titanFlag.a = p; }   // 下一個傷害倍率查詢＝這一下的反射
        }
      } catch (e) {}
      return v;
    };
  }

  // ── 精靈：一 精靈傷害 +20%；二 全體法術 15% → 25%；三 全體法術傷害 +30% ──
  if (typeof W.spiritAttackOnce === 'function') {
    var oSAO = W.spiritAttackOnce;
    W.spiritAttackOnce = function (s, t, owner) {
      var o = owner || P(), st = stageOf(o);
      if (!st) return oSAO.apply(this, arguments);
      var K = EV('typeof SPIRIT_KING !== "undefined" ? SPIRIT_KING : null'), p0 = K && K.aoe ? K.aoe.p : null;
      if (K && K.aoe && st >= 2) K.aoe.p = 0.25;
      try { return withCtx(o, null, oSAO, this, arguments, { pct: false, spirit: true }); }
      finally { if (K && K.aoe && p0 != null) K.aoe.p = p0; }
    };
  }
  dealtHooks.push(function (c, a, t, amount) {
    if (!c.spirit) return amount;
    var st = stageOf(a);
    amount *= 1.2;
    if (c.n > 1 && st >= 3) amount *= 1.3;   // 第一下是精靈本身，之後是全體法術
    return amount;
  });

  // ── 疼痛的歡愉三：反彈 +30% ──
  var linkPain = function () {
    if (typeof W.__afkPainRf !== 'function' || W.__afkPainRf._afkSu) return;
    var o = W.__afkPainRf;
    var f = function (ent) { var v = o.apply(this, arguments); try { if (stageOf(ent) >= 3 && v > 0) v = v * 1.3; } catch (e) {} return v; };
    f._afkSu = true; W.__afkPainRf = f;
  };
  linkPain(); try { document.addEventListener('DOMContentLoaded', linkPain); } catch (e) {}

  // ── 冰雪颶風：二 每 4 秒 → 3 秒（玩家）；三 冰凍命中 −3 → +3、被凍住的敵人受到的傷害 +15% ──
  var STORM = DB.skills.sk_blizzard_storm;
  if (STORM) {
    try {
      var baseIv = STORM.stormInterval || 40;
      Object.defineProperty(STORM, 'stormInterval', { configurable: true, enumerable: true,
        get: function () { var p = P(), c = cur(); if (!c && p && stageOf(p) >= 2 && p.buffs && p.buffs.sk_blizzard_storm > 0) return 30; return baseIv; },
        set: function (v) { baseIv = v; } });
    } catch (e) {}
  }
  if (typeof W.stormBuffTick === 'function') {
    var oSBT = W.stormBuffTick;
    W.stormBuffTick = function (sk) {
      var p = P();
      if (!(sk === STORM && p && stageOf(p) >= 3)) return oSBT.apply(this, arguments);
      var undo = applyPatch(sk, { freezeHitOff: 3 });
      try { return withCtx(p, null, oSBT, this, arguments, { pct: true, frost: true }); } finally { undo(); }
    };
  }
  dealtHooks.push(function (c, a, t, amount) { if (c.frost) mark(t, 'frost', 60, 0.15); return amount; });

  // ── 立方：二 四種的觸發間隔各 −1 秒；三 立方的傷害、回復 +30% ──
  var CUBES = ['sk_illu_cube_burn', 'sk_illu_cube_quake', 'sk_illu_cube_shock', 'sk_illu_cube_harmony'];
  var cubePatch = function (a) {
    var st = stageOf(a), undos = [];
    if (st < 2) return null;
    CUBES.forEach(function (id) {
      var sk = DB.skills[id]; if (!sk || !sk.cube) return;
      var pt = { iv: Math.max(10, (sk.cube.iv || 40) - 10) };
      if (st >= 3 && sk.cube.val) pt.val = Math.round(sk.cube.val * 1.3);
      undos.push(applyPatch(sk.cube, pt));
    });
    return function () { for (var i = undos.length - 1; i >= 0; i--) undos[i](); };
  };
  ['cubeTick', 'allyCubeTick'].forEach(function (name) {
    var o = W[name]; if (typeof o !== 'function') return;
    W[name] = function () {
      var a = name === 'cubeTick' ? P() : arguments[0];
      var undo = a ? cubePatch(a) : null;
      try { return o.apply(this, arguments); } finally { if (undo) undo(); }
    };
  });
  dealtHooks.push(function (c, a, t, amount) { if (c.cube && stageOf(a) >= 3) amount *= 1.3; return amount; });

  // ── 異常狀態：技能施放中的異常 → 持續 +%、失敗時依 +% 再判定一次；衝擊之暈三 8 秒、暈住頭目；奪命之雷三 王的易傷 ──
  if (typeof W.applyMobStatus === 'function') {
    var oAMS = W.applyMobStatus;
    W.applyMobStatus = function (m, st0, name) {
      var c = cur(), a = c && c.actor, s = stageOf(a);
      if (!m || !st0 || !s || !c.pct) return oAMS.apply(this, arguments);
      var k = pctOf(a), stx = Object.assign({}, st0), kind = stx.kind;
      if (stx.dur) stx.dur = Math.round(stx.dur * (1 + k) * 10) / 10;
      if (name === '衝擊之暈' && kind === 'stun' && s >= 3) stx.dur = Math.max(stx.dur, Math.round(8 * (1 + k) * 10) / 10);
      var args = Array.prototype.slice.call(arguments); args[1] = stx;
      var before = m.st ? (m.st[kind] || 0) : 0, r = oAMS.apply(this, args);
      var ok = !!(m.st && (m.st[kind] || 0) > before);
      if (!ok && !(m.boss && typeof BOSS_IMMUNE !== 'undefined' && BOSS_IMMUNE.indexOf(kind) >= 0) && rnd() < k) { r = oAMS.apply(this, args); ok = !!(m.st && (m.st[kind] || 0) > before); }
      try {
        if (name === '衝擊之暈' && s >= 3 && ok && m.boss) mark(m, 'stunboss', 80, 0.10);
        if (c.sk && c.sk._afkSuId === 'sk_dragon_deathlightning' && s >= 3 && m.boss && !ok) mark(m, 'dlvuln', 60, 0.10);
      } catch (e) {}
      return r;
    };
  }
  // 衝擊之暈二：敏捷加的暈眩率上限 60% → 70%（轉生騎士的全畫面衝擊之暈，afk-knight-shock 問這裡）
  W.__afkSkillUpStunCap = function (a) { return stageOf(a) >= 2 ? 0.7 : 0.6; };

  // ── 受到傷害：增幅防禦、暗隱術三、鏡像三 ──
  var R = W.AFK_RELIC_RUNTIME;
  if (R && typeof R.incoming === 'function') {
    var oInc = R.incoming;
    R.incoming = function (actor, amount, attacker, opts) {
      var v = oInc.apply(this, arguments);
      try {
        var s = stageOf(actor); if (!s || !(v > 0) || !isMember(actor)) return v;
        var b = actor.buffs || {}, kind = (opts && opts.kind) || 'melee', t = tk(), me = actor === P();
        var hp = me ? actor.hp : actor.curHp, mhp = actor.mhp || 1;
        if (b.sk_dark_stealth > 0 && s >= 3 && kind === 'magic') {   // 暗隱術三：也能迴避一次魔法
          b.sk_dark_stealth = 0; actor._darkStealthCd = t + 30;
          try { logCombat('<span class="text-fuchsia-300">' + (me ? '你' : '協力·' + (actor._allyName || '')) + '的暗影隱蔽擋下了魔法。</span>', 'evade'); } catch (e) {}
          if (me) { try { calcStats(); } catch (e) {} }
          return 0;
        }
        if (b.sk_illu_mirror > 0 && s >= 3 && t >= (actor._afkSuMirror || 0)) {   // 鏡像三：每 20 秒擋下一次攻擊
          actor._afkSuMirror = t + 200;
          try { logCombat('<span class="text-sky-300">' + (me ? '你' : '協力·' + (actor._allyName || '')) + '的鏡像替你擋下了這一擊。</span>', 'evade'); } catch (e) {}
          return 0;
        }
        if (b.sk_reduction_armor > 0) {
          var lv = Math.max(1, actor.lv || 1), dr = s >= 3 ? Math.floor(lv / 6) : Math.floor(lv / 8);
          if (s >= 2 && kind === 'magic') v = Math.max(1, v - dr);   // 增幅防禦二：同樣多的魔法傷害減免
          if (s >= 3 && hp < mhp * 0.3) v = Math.max(1, v - dr);    // 增幅防禦三：HP<30% 減免再 ×2
        }
      } catch (e) {}
      return v;
    };
  }

  // ── 迴避之後：暗隱術二 下一擊必定爆擊；鏡像二 20% 反擊 ──
  (function () {
    var prev = W.__afkOnEvade;
    W.__afkOnEvade = function (ent, mob) {
      if (typeof prev === 'function') { try { prev.apply(this, arguments); } catch (e) {} }
      try {
        var s = stageOf(ent); if (!s || ent !== P()) return;
        if (s >= 2 && ent.buffs && ent.buffs.sk_dark_stealth > 0) ent._afkSuSure = true;
        if (s >= 2 && ent.buffs && ent.buffs.sk_illu_mirror > 0 && mob && mob.curHp > 0 && rnd() < 0.2 && typeof W.procCounter === 'function') W.procCounter(mob);
      } catch (e) {}
    };
  })();

  // ── 每一刻之後：暗隱術冷卻、魔法屏障、狂暴的攻速結束 ──
  var lastShield = 0;
  var postTick = function () {
    var p = P(); if (!p || p.classicMode) return;
    var t = tk();
    party().forEach(function (a) {   // 暗隱術：一 冷卻 5 → 4 秒；三 3 秒
      if (!a) return; var s = stageOf(a); if (!s) return;
      var cd = a._darkStealthCd || 0;
      if (cd > t && a._afkSuCdSeen !== cd && cd - t >= 45) { var nc = cd - (s >= 3 ? 20 : 10); a._darkStealthCd = nc; a._afkSuCdSeen = nc; }
    });
    var s = stageOf(p);
    if (s) {
      var sh = (p.buffs && p.buffs.sk_magic_shield) || 0;
      if (lastShield > 0 && sh <= 0 && (p.magicShieldCd || 0) >= 3) {   // 魔法屏障剛擋下：一 冷卻 3 → 1 秒；二 回 MP 10%
        p.magicShieldCd = 1;
        if (s >= 2) p.mp = Math.min(p.mmp || 0, (p.mp || 0) + Math.floor((p.mmp || 0) * 0.1));
      }
      lastShield = sh;
      if (s >= 3 && sh <= 0 && !(p.magicShieldCd > 0) && hasSk(p, 'sk_magic_shield') && t % 10 === 0 && !String(mapState.current || '').startsWith('town_')) { try { castSkill('sk_magic_shield'); } catch (e) {} }   // 三：自動重新展開
      if (p._afkSuBzUntil && p._afkSuBzUntil <= t) { p._afkSuBzUntil = 0; try { calcStats(); } catch (e) {} }
    }
  };
  if (typeof W.tick === 'function') {
    var oTick = W.tick;
    W.tick = function () { var r = oTick.apply(this, arguments); try { postTick(); } catch (e) {} return r; };
  }

  // ── 面板（recomputeStats 之後）：血之渴望、狂暴攻速、粉碎、精準射擊、全部增益的數值 +% ──
  var BUFF_KEYS = ['meleeDmg', 'meleeHit', 'rangedDmg', 'rangedHit', 'extraDmg', 'extraHit', 'magicDmg', 'er', 'mpR', 'dr'];
  if (typeof W.recomputeStats === 'function') {
    var oRe2 = W.recomputeStats;
    W.recomputeStats = function () {
      var r = oRe2.apply(this, arguments);
      try {
        var p = P(), s = stageOf(p); if (!p || !s || !p.d) return r;
        var d = p.d, b = p.buffs || {}, k = pctOf(p), t = tk();
        if (b.sk_dragon_bloodlust > 0 && d.aspd) d.aspd = d.aspd * 1.15 / 1.20;   // 血之渴望一：+15% → +20%
        if ((p._afkSuBzUntil || 0) > t && d.aspd) d.aspd = d.aspd / 1.2;          // 狂暴三：3 秒攻速 +20%
        if (hasSk(p, 'sk_warrior_crush')) { var cb = crushBonus(p); d.meleeDmg = (d.meleeDmg || 0) + Math.round(cb * 0.2); if (s >= 2) d.rangedDmg = (d.rangedDmg || 0) + Math.round(cb * 1.2 * 0.5); }   // 粉碎一 ×1.2、二 遠程吃一半
        if (s >= 2 && b.sk_elf_preciseshot > 0) d.rangedCrit = (d.rangedCrit || 0) + 5;   // 精準射擊二
        if (k > 0) Object.keys(b).forEach(function (sid) {   // 增益數值 +%（只算自己學會的職業技能）
          if (!(b[sid] > 0) || !hasSk(p, sid)) return; var sk = DB.skills[sid]; if (!sk || !sk.d) return;
          BUFF_KEYS.forEach(function (key) { var v = Number(sk.d[key]) || 0; if (v) d[key] = (Number(d[key]) || 0) + Math.round(v * k); });
          if (sk.d.ac) d.ac = (Number(d.ac) || 0) - Math.round(sk.d.ac * k);
        });
      } catch (e) {}
      return r;
    };
  }

  // ── NPC：席琳神殿 技藝導師 薇爾娜 ──
  var NPC_ID = 'npc_afk_skillup', TOWN = 'town_sherine', NPC_SPR = '6804';   // 女性外型（席琳神殿裡沒人用）
  try {
    var def = { id: NPC_ID, n: '技藝導師 薇爾娜', title: '技能強化・職業進化', type: 'quest', classicHide: true,
      d: '在席琳神殿替冒險者重新磨亮技藝的導師。她說，技藝不會因為輪迴而消失，只會被遺忘。' };
    var L = W.__afkLore; if (L && L.addNpc) L.addNpc(TOWN, def, NPC_SPR, null); else if (DB.towns && DB.towns[TOWN]) DB.towns[TOWN].npcs.push(def);
    if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[NPC_ID]) NPC_SPR_FIXED[NPC_ID] = NPC_SPR;
  } catch (e) {}

  // 介面只顯示自己職業的招牌技能（玩家 2026-11-06 20:19）；隱藏規則的部分只寫「更強」
  var STAGE_TXT = [null,
    { n: '第一階段', all: '全部職業技能 +5%（傷害、治療、增益數值、異常狀態的機率與持續）' },
    { n: '第二階段', all: '全部職業技能累計 +10%' },
    { n: '第三階段', all: '全部職業技能累計 +20%' }];
  var CLS_TXT = {
    knight: [null,
      ['衝擊之暈：追加傷害提高', '反擊屏障：持續加倍', '增幅防禦：傷害減免提高'],
      ['衝擊之暈：暈眩機率上限提高', '反擊屏障：反擊、居合傷害 ×2.5', '增幅防禦：也減少魔法傷害'],
      ['衝擊之暈：暈眩 8 秒，暈住頭目時全隊對牠的傷害 +10%', '反擊屏障：反擊、居合必定爆擊', '增幅防禦：減免再提高，HP 低於 30% 時加倍']],
    mage: [null,
      ['流星雨：15 發', '冰雪颶風：持續 1.5 倍', '魔法屏障：擋下後更快能再放'],
      ['流星雨：範圍傷害更強', '冰雪颶風：每 3 秒一次', '魔法屏障：擋下時回復 MP'],
      ['流星雨：MP 消耗降低、冷卻更短', '冰雪颶風：更容易凍住，凍住的敵人受到傷害 +15%', '魔法屏障：自動重新展開']],
    elf: [null,
      ['三重矢：多 1 箭', '精準射擊：持續加倍', '召喚強力屬性精靈：精靈傷害 +20%'],
      ['三重矢：席琳夢域鏡裡後面的箭不容易變弱', '精準射擊：期間遠距離爆擊率 +5%', '召喚強力屬性精靈：精靈王更常放全體法術'],
      ['三重矢：最後一箭必定爆擊', '精準射擊：期間無視硬皮', '召喚強力屬性精靈：全體法術傷害 +30%']],
    dark: [null,
      ['會心一擊：HP 消耗 50% → 40%', '雙重破壞：更容易觸發', '暗隱術：冷卻 5 → 4 秒'],
      ['會心一擊：倍率 ×10 → ×12', '雙重破壞：×2 → ×2.5', '暗隱術：迴避後下一擊必定爆擊'],
      ['會心一擊：只消耗一半 MP', '雙重破壞：拿匕首也有效', '暗隱術：冷卻 3 秒，也能擋一次魔法']],
    dragon: [null,
      ['屠宰者：每層弱點曝光的加成提高', '奪命之雷：骰數 8 → 11', '血之渴望：攻速 +15% → +20%'],
      ['屠宰者：3 → 4 刀', '奪命之雷：HP 消耗 35 → 20', '血之渴望：持續加倍'],
      ['屠宰者：幾乎不消耗 HP', '奪命之雷：打不暈王時，讓王 6 秒受到的傷害 +10%', '血之渴望：幾乎不消耗 HP']],
    illusion: [null,
      ['疼痛的歡愉：持續加倍', '鏡像：迴避提高', '立方：持續 1.5 倍'],
      ['疼痛的歡愉：幾乎不消耗 HP', '鏡像：迴避成功時可能反擊', '立方：觸發間隔縮短'],
      ['疼痛的歡愉：反彈 +30%', '鏡像：每 20 秒擋下一次攻擊', '立方：效果 +30%']],
    warrior: [null,
      ['粉碎：加成 ×1.2', '狂暴：更容易觸發', '泰坦：更早觸發'],
      ['粉碎：遠程攻擊也有一半', '狂暴：×2 → ×2.5', '泰坦：反射傷害 +30%'],
      ['粉碎：對頭目更強', '狂暴：觸發後 3 秒攻速 +20%', '泰坦：每次反射回復 HP']],
    royal: [null,
      ['呼喚盟友：冷卻縮短', '精準目標：持續加倍', '勇猛意志：更容易觸發'],
      ['呼喚盟友：傭兵那一下 ×1.3', '精準目標：效果提高', '勇猛意志：×1.5 → ×1.8'],
      ['呼喚盟友：寵物、召喚物、城堡護衛也一起出手', '精準目標：對頭目 ×1.5', '勇猛意志：觸發時全隊 3 秒傷害 +10%']]
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ROMAN = ['', '一', '二', '三'];
  var render = function (box) {
    var p = P(); if (!box || !p) return;
    var st = stageOf(p), h = '';
    h += '<div class="su-steps">' + [1, 2, 3].map(function (s) { return '<div class="su-step' + (st >= s ? ' done' : st + 1 === s ? ' next' : '') + '"><i>' + (st >= s ? '✓' : ROMAN[s]) + '</i><span>' + STAGE_TXT[s].n + '</span></div>'; }).join('<div class="su-line"></div>') + '</div>';
    h += '<div class="su-now">' + (st ? '目前 <b>' + STAGE_TXT[st].n + '</b>：' + esc(STAGE_TXT[st].all) : '還沒有強化過。') + '</div>';
    for (var s = 1; s <= 3; s++) {
      var done = st >= s, next = st + 1 === s, T2 = STAGE_TXT[s], ok = true;
      var mats = COST[s].map(function (x) { var have = count(x[0]), enough = have >= x[1]; if (!enough) ok = false;
        return '<span class="su-mat' + (done ? '' : enough ? ' ok' : ' no') + '">' + esc(nameOf(x[0])) + ' <b>' + (done ? '' : have.toLocaleString() + ' / ') + x[1].toLocaleString() + '</b></span>'; }).join('');
      var sig = (CLS_TXT[p.cls] && CLS_TXT[p.cls][s]) || [];
      h += '<div class="su-card' + (done ? ' done' : next ? ' next' : ' lock') + '"><div class="su-ct"><b>' + T2.n + '</b><em>' + (done ? '已完成' : next ? '可以強化' : '先完成前一階段') + '</em></div>'
        + '<div class="su-all">' + esc(T2.all) + '</div>'
        + (sig.length ? '<ul class="su-sig">' + sig.map(function (x) { var i = x.indexOf('：'); return '<li>' + (i > 0 ? '<b>' + esc(x.slice(0, i)) + '</b>' + esc(x.slice(i)) : esc(x)) + '</li>'; }).join('') + '</ul>' : '')
        + (done ? '' : '<div class="su-mats">' + mats + '</div>')
        + (next ? '<button type="button" class="su-btn" data-su="1"' + (ok ? '' : ' disabled') + '>' + (ok ? '強化到' + T2.n : '材料不足') + '</button>' : '') + '</div>';
    }
    h += '<div class="su-foot">每個角色各自計算，照順序升級、一定成功。傭兵要「重新招募」才會用到新的階段。</div>';
    box.innerHTML = h;
  };
  var css = function () {
    if (document.getElementById('afk-skillup-css')) return;
    var s = document.createElement('style'); s.id = 'afk-skillup-css';
    s.textContent = [
      '.afk-su{color:#e2e8f0;font-size:14px;line-height:1.65}',
      '.afk-su .su-hero{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:10px;background:linear-gradient(135deg,rgba(76,29,149,.35),rgba(15,23,42,.6));border:1px solid rgba(167,139,250,.35)}',
      '.afk-su .su-hero .q{color:#ddd6fe;font-style:italic}',
      '.afk-su .su-tabs{display:flex;gap:6px;margin:12px 0 10px;padding:4px;border-radius:10px;background:#0f172a;border:1px solid #1e293b}',
      '#town-interaction-container .afk-su .su-tab,.afk-su .su-tab{flex:1;padding:8px 0!important;border-radius:8px!important;border:1px solid transparent!important;background:transparent!important;color:#94a3b8!important;font-weight:bold;font-size:15px;box-shadow:none!important}',
      '#town-interaction-container .afk-su .su-tab.on,.afk-su .su-tab.on{background:linear-gradient(180deg,#7c3aed,#4c1d95)!important;color:#fff!important;border-color:#a78bfa!important;box-shadow:0 0 10px rgba(124,58,237,.45)!important}',
      '.afk-su .su-steps{display:flex;align-items:center;margin:4px 2px 8px}',
      '.afk-su .su-step{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:64px}',
      '.afk-su .su-step i{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:bold;background:#1e293b;border:2px solid #334155;color:#64748b}',
      '.afk-su .su-step span{font-size:12px;color:#94a3b8}',
      '.afk-su .su-step.done i{background:#a16207;border-color:#facc15;color:#fff}.afk-su .su-step.done span{color:#fde68a}',
      '.afk-su .su-step.next i{border-color:#a78bfa;color:#ddd6fe;box-shadow:0 0 8px rgba(167,139,250,.6)}',
      '.afk-su .su-line{flex:1;height:2px;background:#334155;margin-bottom:16px}',
      '.afk-su .su-now{padding:6px 10px;border-radius:8px;background:rgba(30,41,59,.7);color:#cbd5e1;font-size:13px}.afk-su .su-now b{color:#fde68a}',
      '.afk-su .su-card{border:1px solid #334155;border-radius:10px;padding:10px 12px;margin:10px 0;background:rgba(15,23,42,.7)}',
      '.afk-su .su-card.done{border-color:rgba(250,204,21,.6);background:linear-gradient(180deg,rgba(113,63,18,.25),rgba(15,23,42,.7))}',
      '.afk-su .su-card.next{border-color:#8b5cf6;box-shadow:0 0 10px rgba(139,92,246,.35)}',
      '.afk-su .su-card.lock{opacity:.7}',
      '.afk-su .su-ct{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.afk-su .su-ct b{color:#fde68a;font-size:16px}',
      '.afk-su .su-ct em{font-style:normal;font-size:12px;padding:1px 8px;border-radius:999px;background:#1e293b;color:#94a3b8}',
      '.afk-su .su-card.done .su-ct em{background:#713f12;color:#fde68a}.afk-su .su-card.next .su-ct em{background:#4c1d95;color:#ddd6fe}',
      '.afk-su .su-all{color:#e2e8f0}',
      '.afk-su .su-sig{margin:6px 0 4px;padding-left:0;list-style:none}.afk-su .su-sig li{padding:2px 0 2px 14px;position:relative;color:#cbd5e1}',
      '.afk-su .su-sig li:before{content:"◆";position:absolute;left:0;color:#a78bfa;font-size:9px;top:7px}.afk-su .su-sig b{color:#c4b5fd;font-weight:bold}',
      '.afk-su .su-mats{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}',
      '.afk-su .su-mat{font-size:12px;padding:2px 8px;border-radius:6px;background:#1e293b;color:#cbd5e1;border:1px solid #334155}',
      '.afk-su .su-mat.ok{border-color:#15803d;color:#bbf7d0}.afk-su .su-mat.no{border-color:#991b1b;color:#fecaca}',
      '#town-interaction-container .afk-su .su-btn,.afk-su .su-btn{width:100%;margin-top:4px;padding:9px 0!important;border-radius:8px!important;background:linear-gradient(180deg,#7c3aed,#5b21b6)!important;color:#fff!important;border:1px solid #a78bfa!important;font-size:15px;font-weight:bold}',
      '#town-interaction-container .afk-su .su-btn:disabled,.afk-su .su-btn:disabled{background:#334155!important;border-color:#475569!important;color:#94a3b8!important}',
      '.afk-su .su-foot{font-size:12px;color:#94a3b8;margin-top:6px}'
    ].join('');
    document.head.appendChild(s);
  };
  var tab = 'skill';
  var embed = function (div) {
    if (!div) return; css();
    var hasEvo = !!(W.__afkEvolve && W.__afkEvolve.render);
    div.innerHTML = '<div class="afk-su"><div class="su-hero"><div style="font-size:28px">📜</div><div><div style="color:#fde68a;font-weight:bold">技藝導師 薇爾娜</div><div class="q">「技藝不會因為輪迴而消失，只會被遺忘。把材料拿來，我幫你想起來。」</div></div></div>'
      + (hasEvo ? '<div class="su-tabs"><button type="button" class="su-tab" data-su-tab="skill">⚔️ 技能強化</button><button type="button" class="su-tab" data-su-tab="evo">✦ 職業進化</button></div>' : '<div style="height:10px"></div>')
      + '<div class="box" id="afk-su-pane-skill"></div><div id="afk-su-pane-evo"></div></div>';
    var host = div.querySelector('.afk-su');
    var show = function () {
      if (!hasEvo) tab = 'skill';
      host.querySelectorAll('[data-su-tab]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-su-tab') === tab); });
      host.querySelector('#afk-su-pane-skill').style.display = tab === 'skill' ? '' : 'none';
      host.querySelector('#afk-su-pane-evo').style.display = tab === 'evo' ? '' : 'none';
      if (tab === 'skill') render(host.querySelector('.box')); else try { W.__afkEvolve.render(div); } catch (e) { console.warn('[AFK-skillup] evo', e); }
    };
    host.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-su-tab]'); if (t) { tab = t.getAttribute('data-su-tab'); show(); return; }
      var b = ev.target.closest('button'); if (!b || !b.dataset.su) return;
      var go = function () { upgrade(); render(host.querySelector('.box')); };
      var msg = '確定要進行技能強化嗎？材料會直接扣掉，不能還原。';
      if (W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '技能強化', message: msg, okText: '強化', cancelText: '取消', onOk: go }); else if (confirm(msg)) go();
    });
    show();
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      var r = oNpc.apply(this, arguments);
      if (npcId === NPC_ID) { try { embed(document.getElementById('interaction-content')); } catch (e) {} }
      return r;
    };
  }

  var SIG_NOTE = ['召喚強力屬性精靈：只做傷害 +20%（HP 沒加）；三改成「全體法術傷害 +30%」', '立方三：改成「效果 +30%」（立方本來就能同時展開）', '魔法屏障三：改成「自動重新展開」（傭兵沒有屏障的擋招判定）',
    '泰坦三：改成「每次反射回 HP 1%」（子彈的迴避 +50 寫死在核心）', '只有你本人有：冰雪颶風每 3 秒、泰坦門檻與反射、暗隱術迴避後必爆、鏡像反擊、三重矢最後一箭必爆、狂暴攻速、呼喚盟友三（寵物等一起出手）',
    '勇猛意志：修習「血誓王劍」的人維持原本的觸發（技藝那一段另外擲），不換成強化後的數值'];
  W.__afkSkillUp = { dmgOk: dmgOk, stageOf: stageOf, pctOf: pctOf, upgrade: upgrade, SIG: SIG, SIG_NOTE: SIG_NOTE, COST: COST, patchFor: patchFor, NPC_ID: NPC_ID,
    _set: function (n) { var p = P(); if (p) { p.afkSkillUp = Math.max(0, Math.min(3, n | 0)); try { calcStats(); } catch (e) {} } } };
  console.log('[AFK] 已啟用：技能強化（席琳神殿 技藝導師 薇爾娜）');
})();
