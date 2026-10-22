/* Relic event runtime. All time values in this module are seconds of game time.
 * Damage and healing hooks run BEFORE HP mutation. Generated effects cannot
 * recursively generate primary attacks. Persistent game objects contain no
 * function references, and transient source state lives in WeakMaps.
 */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  var enabled = function () { return !T || T.enabled('relicfx'); };
  var catalog = W.AFK_RELIC_CATALOG || [], byKey = {}, byId = {};
  catalog.forEach(function (c) { byKey[c.key] = c; byId[c.id] = c; });
  var actorStates = new WeakMap(), cooldowns = new WeakMap(), caches = new WeakMap(), delayed = [], observers = [];
  var baseDefs = {}, revision = 1, active = null, action = null, seq = 0, depth = 0;
  var battle = 1, lastMap = null, lastTick = -1, GM_IDS = ['99999', '99998'];
  var finite = function (v) { return Number.isFinite(Number(v)) ? Number(v) : 0; };
  var now = function () { return typeof state !== 'undefined' ? finite(state.ticks) / 10 : 0; };
  var clone = function (v) { return JSON.parse(JSON.stringify(v)); };
  function transient(e, key, value) {
    if (!e) return value;
    if (!Object.prototype.hasOwnProperty.call(e, key)) Object.defineProperty(e,key,{value:value,writable:true,configurable:true,enumerable:false});
    else e[key]=value;
    return e[key];
  }
  function trace(kind, data) { if (observers.length) observers.forEach(function (fn) { fn(kind,data); }); }
  var hpKey = function (e) { return e && (e.curHp != null) ? 'curHp' : 'hp'; };
  var hp = function (e) { return e ? Math.max(0, finite(e[hpKey(e)])) : 0; };
  var mhp = function (e) { var C=W.AFK_RELIC_COMPANIONS;return e ? Math.max(1,finite(C&&C.maxHp?C.maxHp(e):(e.mhp != null ? e.mhp : e.hp))) : 1; };
  var targets = function () { return typeof mapState !== 'undefined' && mapState.mobs ? mapState.mobs.filter(function (m) { if(m&&!m._relicDefenseMarks)transient(m,'_relicDefenseMarks',{});return m && hp(m) > 0 && !m._dead; }) : []; };
  var ownerPlayer = function () { return typeof player !== 'undefined' ? player : null; };
  var team = function () { var p = ownerPlayer(); return p ? [p].concat((p.allies || []).filter(function (a) { return a && !a._downed && hp(a) > 0; })) : []; };
  var pets = function () { var p = ownerPlayer(); return p && p.pets ? p.pets.filter(function (x) { return x && !x._downed && hp(x) > 0 && !x.stored; }) : []; };
  var summons = function () { var p = ownerPlayer(); return p ? (p.summons || []).concat(p.spirits || []).filter(function (x) { return x && hp(x) > 0; }) : []; };
  function stateOf(actor, id) {
    if (!actor || typeof actor !== 'object') return {};
    var bag = actorStates.get(actor); if (!bag) { bag = {}; actorStates.set(actor, bag); }
    return bag[id || (active && active.sourceId) || 'runtime'] || (bag[id || (active && active.sourceId) || 'runtime'] = {});
  }
  function stageOf(d) { return d && d.relicAsc != null ? (d.relicAsc >= 5 ? 4 : 3) : d && d.relicPlus >= 10 ? 2 : d && d.relicPlus >= 5 ? 1 : 0; }
  function isGM(actor) { return !!(actor && actor.eq && Object.keys(actor.eq).some(function (k) { var e = actor.eq[k]; return e && GM_IDS.indexOf(String(e.id)) >= 0; })); }
  function sourceInfo(id, def, inst) {
    var key = def && def.relicBase || String(id).split('~')[0], c = byKey[key];
    return c ? { id: key, sourceId: key, catalogId: c.id, key: key, def: def, item: def, inst: inst, stage: stageOf(def), n: finite(def.relicPlus), asc: def.relicAsc == null ? null : def.relicAsc } : null;
  }
  function sourceList(actor) {
    if (!enabled() || !actor || !actor.eq || typeof DB === 'undefined') return [];
    if(action&&action.gm&&action.actor===actor&&action.gmSources)return action.gmSources;
    // Equipment mutates in place, so object identity alone is not sufficient.
    // Compare the same slot/id information as the former sorted string, without
    // allocating/sorting/joining a new signature on every hot-path query.
    var keys=Object.keys(actor.eq),old=caches.get(actor),same=!!(old&&old.revision===revision&&old.count===keys.length);
    if(same){for(var at=0;at<keys.length;at++){var entry=actor.eq[keys[at]];if(old.ids[keys[at]]!==String(entry&&entry.id||'')){same=false;break;}}if(same)return old.sources;}
    var selected = {};
    keys.forEach(function (k) {
      var e = actor.eq[k]; if (!e || e._relicVirtual) return;
      var d = DB.items[e.id], data=W.__afkRelicData||W.__afkRelicPlus; if (!d && data) { data.ensure(e.id); d = DB.items[e.id]; }
      var s = sourceInfo(e.id, d, e); if (s && (!selected[s.key] || selected[s.key].stage < s.stage || selected[s.key].n < s.n)) selected[s.key] = s;
    });
    if (isGM(actor)) catalog.forEach(function (c) {
      var d = ultimate(c.key); if (d) selected[c.key] = sourceInfo(c.key, d, { id: c.key, en: 0, _relicProjection: true });
    });
    var list = Object.keys(selected).map(function (k) { return selected[k]; }).sort(function (a, b) { return a.catalogId - b.catalogId; });
    var ids=Object.create(null);for(var ix=0;ix<keys.length;ix++){var e=actor.eq[keys[ix]];ids[keys[ix]]=String(e&&e.id||'');}
    caches.set(actor, { revision:revision,count:keys.length,ids:ids,sources:list }); return list;
  }
  var ultimateCache = {};
  function ultimate(key) {
    if (ultimateCache[key]) return ultimateCache[key];
    var b = baseDefs[key] || (typeof DB !== 'undefined' && DB.items[key]); if (!b) return null;
    var data=W.__afkRelicData||W.__afkRelicPlus;
    if (data && data.buildDef) {
      var full = data.buildDef(key, b.type==='acc'?10:15, null, byKey[key].id===29?0:5, null);
      ultimateCache[key]=full;return full;
    }
    var d = clone(b); d.relicBase = key; d.relicPlus = 15; d.relicAsc = byKey[key].id === 29 ? 0 : 5;
    configure(d, b, d.relicPlus, d.relicAsc);
    if (d.relicAsc > 0) {
      var a = d.relicAsc;
      if (d.type === 'wpn') { d.dmgS = finite(d.dmgS) + 10 * a; d.dmgL = finite(d.dmgL) + 10 * a; }
      else { if (d.type === 'arm') { d.hpR = finite(d.hpR) + 50 * a; d.mpR = finite(d.mpR) + 50 * a; } ['str','dex','con','int','wis','cha','er','mr','dr'].forEach(function (f) { d[f] = finite(d[f]) + a; }); d.ac = finite(d.ac) + a; ['Fire','Water','Wind','Earth'].forEach(function (e) { d['res' + e] = finite(d['res' + e]) + 10 * a; }); }
    }
    ultimateCache[key] = d; return d;
  }
  var aliasesWeapon = { afterHit: 'hit', afterHurt: 'hurt', beforeCast: 'beforeCastCost', onKill: 'kill', onMarkConsume: 'markConsumed' };
  // Equipment source vectors are immutable until sourceList replaces the cache.
  // Index their dispatch views once, including each GM weapon channel. This only
  // removes repeated filtering; callback order and GM armor deduplication remain
  // exactly the same, including callbacks whose current stage has no effect.
  var dispatchViews = new WeakMap();
  var channelEvents = {beforeAttack:1,beforeHit:1,afterHit:1,miss:1,counter:1,beforeCounter:1,beforeSkill:1,skill:1,resonance:1,magicStrike:1,combo:1,doubleBlade:1,pierce:1,elementHit:1,directHit:1};
  var gmOnceEvents = {afterHit:1,miss:1,onCast:1};
  function dispatchList(list, module, channel) {
    var view=dispatchViews.get(list);
    if(!view){view={all:list,weapon:[],defense:[],channels:Object.create(null)};for(var i=0;i<list.length;i++){var s=list[i];if(s&&s.def)(s.catalogId<=131?view.weapon:view.defense).push(s);}dispatchViews.set(list,view);}
    if(module==='defense')return view.defense;
    if(!channel)return module==='weapon'?view.weapon:view.all;
    var selected=view.channels[channel];
    if(!selected){selected={weapon:[],all:[]};for(var j=0;j<list.length;j++){var x=list[j];if(!x||!x.def)continue;if(x.catalogId>131)selected.all.push(x);else if(x.key===channel){selected.weapon.push(x);selected.all.push(x);}}view.channels[channel]=selected;}
    return module==='weapon'?selected.weapon:selected.all;
  }
  function dispatch(event, ctx, only) {
    if (!enabled() || !ctx || !ctx.actor || depth > 16) return ctx;
    ctx.now = now(); ctx.actionId = ctx.actionId || (action && action.id) || ++seq; ctx.battleId = battle;
    ctx.inBattle = typeof mapState !== 'undefined' && !/^town_/.test(mapState.current || '') && targets().length > 0;
    var movement = stateOf(ctx.actor, '_movement'); ctx.stationaryFor = Math.max(0, now() - (movement.last || 0)); ctx.movingFor = movement.movingFor || 0; ctx.moving = !!movement.moving;
    var list = only ? [only] : sourceList(ctx.actor), prior = active;
    list=dispatchList(list,ctx._module,channelEvents[event]&&ctx.channelKey);
    var weaponModule=W.AFK_RELIC_WEAPONS,defenseModule=W.AFK_RELIC_DEFENSE,weaponEvent=aliasesWeapon[event]||event,once=gmOnceEvents[event];
    depth++;
    try {
      for(var ix=0,length=list.length;ix<length;ix++) {
        var s=list[ix];if(!s||!s.def)continue;
        if (action && action.gm && s.catalogId > 131 && once) {
          var uk = event + ':' + s.key + ':' + (ctx.target && ctx.target.uid || '');
          if (action.seen[uk]) continue; action.seen[uk] = true;
        }
        ctx.source = ctx.item = s.def; ctx.sourceId = s.key; ctx.catalogId = s.catalogId; ctx.stage = s.stage; ctx.n = s.n; ctx.asc = s.asc; ctx.api = api;
        active = ctx;
        var weapon=s.catalogId<=131,mod=weapon?weaponModule:defenseModule;
        if (mod && typeof mod.dispatch === 'function') mod.dispatch(weapon?weaponEvent:event, ctx, api);
      }
    } finally { depth--; active = prior; }
    return ctx;
  }
  function configure(d, b, n, asc) {
    var key = d.relicBase || Object.keys(byKey).find(function (k) { return DB.items[k] === b; }), c = byKey[key]; if (!c) return;
    d.relicBase = key; d.relicCatalogId = c.id; d.relicPlus = n || 0; d.relicAsc = asc == null ? null : asc;
    delete d.rfx;
    var mod = c.id <= 131 ? W.AFK_RELIC_WEAPONS : W.AFK_RELIC_DEFENSE;
    if (mod) { var f = mod.configure || mod.tier; if (typeof f === 'function') f(d, b, n || 0, asc); }
    var s = stageOf(d), lore = typeof mod?.describe === 'function' ? mod.describe(d, c) : '';
    d.d = lore || (d.relicLore?d.d:describe(c,s));
    d.relicRuntime = true;
    if (c.id === 29 && asc != null) d.noAscUp = true;
  }
  function describe(c, stage) {
    var parts = [c.base_effect];
    ['plus5','plus10','ascend','ascend5'].forEach(function (k, i) { if (i < stage && c[k] && !/無此終階|未明確列出|階段歸屬/.test(c[k])) parts.push(c[k]); });
    return '【遺物】' + c.design_concept.replace(/原稿|原本|沿用/g, '') + '\n' + parts.map(function (x) { return x.replace(/D×/g, '本次普通攻擊傷害×').replace(/\bCD\b/g, '冷卻').replace(/Boss/g, '首領').replace(/〔本階標籤暫定〕/g, '').replace(/×(\d+(?:\.\d+)?)/g, '$1 倍'); }).join('\n');
  }
  function cooldown(actor, source, key, seconds) {
    if (!actor) return false;
    var all=cooldowns.get(actor);if(!all){all={};cooldowns.set(actor,all);}
    var st=all[source]||(all[source]={}), k = '_cd_' + key;
    if (finite(st[k]) > now()) return false;
    st[k] = now() + Math.max(0, finite(seconds)); return true;
  }
  function heal(target, amount, opt) {
    opt = opt || {}; var ctx = active, owner = opt.owner || ctx && ctx.actor || target, source = opt.source || ctx && ctx.sourceId || 'relic';
    if (!target || target.dead || target._downed || hp(target) <= 0 || amount <= 0) return 0;
    var cd = Math.max(10, finite(opt.cd) || 10), group = opt.group;
    var st = stateOf(owner, source), permitted = !!opt.prepaid;
    if (!permitted && group != null && st._healGroup === group) permitted = true;
    if (!permitted) { if (!cooldown(owner, source, 'heal', cd)) return 0; st._healGroup = group; }
    var hc = { actor: target, recipient: target, healer: owner, amount: amount, healSource: 'relic', healingSourceId: source, main: false, direct: true };
    dispatch('beforeHeal', hc); amount = Math.max(0, finite(hc.amount));
    if (typeof foulWaterHealMult === 'function' && !opt.ignoreReduction) amount *= foulWaterHealMult(target);
    if (W.AFK_RELIC_DEFENSE && W.AFK_RELIC_DEFENSE.healingReduction) amount *= 1-Math.min(.75,W.AFK_RELIC_DEFENSE.healingReduction(target,now())||0);
    var hr=statusValue(target,'healReduction'); if(hr) amount*=1-Math.min(.75,hr);
    var before = hp(target), actual = Math.max(0,Math.min(mhp(target) - before, Math.floor(amount)));
    target[hpKey(target)] = before + actual; hc.actualHeal = actual; hc.overheal = Math.max(0, Math.floor(amount) - actual);
    if (opt.overhealShield && hc.overheal > 0) {var os=Object.assign({source:source},opt.overhealShield);if(os.cap>0&&os.cap<=1)os.cap*=mhp(target);shield(target,hc.overheal*os.ratio,os);}
    if(opt.overflowShield&&hc.overheal>0)shield(target,hc.overheal,{source:source,cap:mhp(target)*opt.overflowShield,duration:opt.shieldDuration||10});
    dispatch('onHeal', hc); trace('heal',{actor:owner,target:target,source:source,actual:actual,amount:amount,cd:cd});return actual;
  }
  function healGroup(rows, opt) {
    opt = opt || {}; var ctx = active, owner = opt.owner || ctx && ctx.actor, src = opt.source || ctx && ctx.sourceId;
    if (!owner || !cooldown(owner, src, 'heal', Math.max(10, opt.cd || 10))) return 0;
    return rows.reduce(function (sum, r) { return sum + heal(r.actor || r.target, r.amount, Object.assign({}, opt, { owner: owner, source: src, prepaid: true })); }, 0);
  }
  function shield(actor, amount, opt) {
    opt = opt || {}; if (!actor || amount <= 0) return 0;
    var src = opt.source || active && active.sourceId || 'relic', bag = stateOf(actor, '_shields');
    var old = bag[src], prior=old&&old.until>now()?old.amount:0,value = Math.min(finite(opt.cap) || mhp(actor), opt.additive?prior+finite(amount):Math.max(prior, finite(amount)));
    bag[src] = { amount: value, until: now() + (opt.duration || 10), source: src, owner: opt.owner || active && active.actor || actor, onBreakHeal:opt.onBreakHeal||0,healPrepaid:!!opt.healPrepaid,kind:opt.kind }; return value;
  }
  function absorb(actor, damage, context) {
    var bag = stateOf(actor, '_shields');
    Object.keys(bag).forEach(function (k) {
      var s = bag[k]; if (s.until <= now() || s.amount <= 0) { delete bag[k]; return; }
      if(s.kind&&s.kind!==context.kind)return;
      var v = Math.min(damage, s.amount); s.amount -= v; damage -= v;
      if (s.amount <= 0) { delete bag[k]; dispatch('shieldBreak', Object.assign({}, context, { actor: actor, shieldSource: k, damage: v, main: false })); if(s.onBreakHeal)heal(actor,s.onBreakHeal,{owner:s.owner,source:k,prepaid:s.healPrepaid}); }
    }); return damage;
  }
  var markDefs = { water: { key: '_wetUntil', name: '潮濕', by: 'wind', mult: 2 }, fire: { key: '_afkScorch', name: '灼熱', by: 'water', mult: 2 }, earth: { key: '_afkMud', name: '泥濘', by: 'fire', mult: 2 }, wind: { key: '_afkErode', name: '風化', by: 'earth', mult: 2 }, none: { key: '_afkExpose', name: '蝕刻', by: '*', mult: 1.5 } };
  function markDef(kind) { var aliases={wet:'water',scorch:'fire',scorched:'fire',muddy:'earth',eroded:'wind',exposed:'none',breach:'none'};return markDefs[aliases[kind]||kind] || Object.values(markDefs).find(function (m) { return m.name === kind || m.key === kind; }); }
  function mark(target, kind, duration, opt) { var m = markDef(kind); if (!m || !target || hp(target) <= 0) return false; target[m.key] = Math.max(target[m.key] || 0, Math.round((now() + (duration || 10)) * 10)); var owners=stateOf(target,'_marks');owners[m.key]=opt&&opt.source||active&&active.sourceId;return true; }
  function consumeMark(target, element) {
    if (!target || !markDefs[element] || element === 'none') return 1;
    var mult = 1;
    Object.keys(markDefs).forEach(function (k) { var m = markDefs[k]; if (finite(target[m.key]) > now() * 10 && (m.by === element || m.by === '*')) { target[m.key] = 0; mult *= m.mult; var c = active || action && action.context; if (c && c.actor) { var mk={water:'wet',fire:'scorch',earth:'muddy',wind:'eroded',none:'exposed'}[k];c.consumedMarks=(c.consumedMarks||[]).concat(mk);dispatch('onMarkConsume', Object.assign({}, c, { target: target, element: element, mark: mk,markName:m.name, markKind: mk,markSource:stateOf(target,'_marks')[m.key],reaction: m.mult,main:c.main })); } } });
    return mult;
  }
  function addMarkAfter(ctx) {
    if (!ctx.main || !ctx.target || hp(ctx.target) <= 0) return;
    var d = ctx.weapon || ctx.item || {}, ele = ctx.element || d.ele || 'none';
    if (!sourceList(ctx.actor).length || (!d.relic && !isGM(ctx.actor))) return;
    if (!d.onHitWet && Math.random() >= 0.2) return;
    if (d.onHitWet) ele = 'water';
    if (action && action.gm) (action.gmRoot||action).marks.push({ target: ctx.target, kind: ele }); else mark(ctx.target, ele, 10);
  }
  function dotCap(target, amount, source) {
    amount = Math.max(0, finite(amount)); if (!target) return amount;
    if (source && source.ascended && target._relicAscHit) return amount;
    var sec = Math.floor(now()); if (target._relicDotSecond !== sec) { target._relicDotSecond = sec; target._relicDotUsed = 0; }
    var cap = Math.max(0, mhp(target) * 0.01), v = Math.min(amount, Math.max(0, cap - finite(target._relicDotUsed)));
    target._relicDotUsed = finite(target._relicDotUsed) + v; return v;
  }
  function dot(target, kind, opt) {
    opt = opt || {}; if (!target || hp(target) <= 0) return;
    var ctx = active, owner = opt.owner || ctx && ctx.actor || ownerPlayer(), source = opt.source || ctx && ctx.sourceId || 'ordinary';
    var asc = opt.ascended != null ? opt.ascended : !!(ctx && ctx.asc != null);
    if (asc) target._relicAscHit = true;
    if((kind==='poison'&&(target.immPoison||target.d&&target.d.immPoison))||(kind==='bleed'&&target.immBleed))return false;
    var layers = Math.max(1, Math.floor(opt.layers || 1)), cap = kind==='poison'||kind==='bleed'?50:Math.max(1,Math.min(50,Math.floor(opt.cap||1)));
    var list = target._relicDots || transient(target,'_relicDots',[]);
    for (var i = 0; i < layers; i++) {
      var pool=list.filter(function(x){return x.kind===kind;}),same = pool.filter(function (x) { return x.source === source && x.owner === owner; });
      var nativeCount=kind==='bleed'?(target.bleeds||[]).length:kind==='poison'&&target.st&&target.st.poison>0?Math.max(1,target.st.poisonStacks||1):0;
      if (pool.length+nativeCount >= cap) { var replace=same[0]||pool.slice().sort(function(a,b){return a.damage-b.damage;})[0];if(!replace||!same.length&&replace.damage>opt.damage)continue;list.splice(list.indexOf(replace),1); }
      if(kind==='burn'&&same.length)list.splice(list.indexOf(same[0]),1);
      list.push({ kind: kind, source: source, owner: owner, ascended: asc, damage: Math.max(0, finite(opt.damage)),duration:opt.duration||10, until: opt.forever||opt.duration===Infinity ? Number.MAX_SAFE_INTEGER : now() + Math.max(0.1, finite(opt.duration) || 10), next: now() + 1, cap: cap,element:opt.element||'none' });
    }
    return true;
  }
  function statusValue(target,kind) { var st=stateOf(target,'_statuses')[kind];return st&&st.until>now()?st.strength||1:0; }
  function status(target, kind, duration, strength) {
    if (!target) return false;
    var originalKind=kind,S=W.AFK_RELIC_DEFENSE_BRIDGE,attacker=active&&active.actor,blocked=!!(target.boss&&['stun','freeze','stone','sleep','paralyze'].indexOf(kind)>=0||target['imm'+kind[0].toUpperCase()+kind.slice(1)]);
    var sc=S?S.prepareStatus(target,kind,duration,attacker,{immune:blocked,roll:false}):{actor:target,target:attacker,attacker:attacker,statusKind:kind,duration:duration,immune:blocked,applied:false,main:false};sc.strength=strength;
    var immuneBuffs=stateOf(target,'_buffs');Object.keys(immuneBuffs).forEach(function(k){if(immuneBuffs[k].until>now()&&immuneBuffs[k].values.immune===kind)sc.immune=true;});
    if(!S)dispatch('beforeStatus',sc);if(sc.immune){sc.blocked=true;if(S)S.reportStatus(sc);else dispatch('onStatusAttempt',sc);return false;}duration=sc.duration;strength=sc.strength;
    kind = kind === 'silence' && target.curHp != null && !target.eq ? 'magicseal' : kind;
    var st = target.st || target.statuses || target._statuses || (target.eq?target.statuses={}:target.st={});
    var custom=['attackDelay','attackSlow','moveSlow','fireVulnerability','waterVulnerability','earthVulnerability','windVulnerability','fireResistanceDown','earthResistanceDown','flatReductionDown','physicalDamageDown','magicDamageDown','directDamageDown','physicalVulnerability','healReduction','revealed'];
    if(custom.indexOf(kind)>=0){stateOf(target,'_statuses')[kind]={until:now()+(duration||1),strength:strength};if(kind==='attackDelay')target._atkCd=Math.max(target._atkCd||0,(duration||1)*10);}
    else {if(kind==='root')kind='bind';if(kind==='slow'&&st!==target.st)kind='slowAtk';st[kind] = Math.max(st[kind] || 0, Math.round((duration || 1) * 10));}
    sc.applied=true;sc.statusKind=originalKind;if(S)S.reportStatus(sc);else dispatch('onStatusAttempt',sc);return true;
  }
  function buff(actor, key, values, duration) {
    if (!actor) return null; var list = stateOf(actor, '_buffs'), old = list[key];
    var b = { values: Object.assign({}, values), until: now() + (duration || 1), source: active && active.sourceId };
    list[key] = b;
    if (!old || JSON.stringify(old.values) !== JSON.stringify(values)) recalc(actor);
    return b;
  }
  var inRecalc = false;
  function recalc(actor) { if(action&&action.gm&&action.actor===actor){(action.gmRoot||action).gmRecalc=true;return;}if (inRecalc) return; inRecalc = true; try { if (actor === ownerPlayer() && typeof recomputeStats === 'function') recomputeStats();else if(typeof _allyLevelRecompute==='function'&&actor&&actor.eq)_allyLevelRecompute(actor); } finally { inRecalc = false; } }
  function damage(target, amount, opt) {
    opt = opt || {}; var ctx = active||action&&action.context, actor = opt.actor||opt.owner || ctx && ctx.actor || ownerPlayer();
    if (!target || hp(target) <= 0 || !(amount > 0)||actor&&(actor.dead||actor._downed||hp(actor)<=0)) return 0;
    var typ=opt.trueDamage?'true':opt.type||opt.kind||'physical',src=opt.source||ctx&&ctx.sourceId,asc=opt.ascended!=null?opt.ascended:!!(ctx&&ctx.asc!=null),reflection=!!(opt.reflection||ctx&&ctx.origin==='reflection'||action&&action.reflection);
    // A transferred hit and a self cost retain their identity even when paid
    // inside a reflected hit. Their owner is not an enemy to retaliate against.
    var redirected=!!opt.redirected, self=target===actor||opt.origin==='self';
    var origin=redirected||opt.origin==='redirect'?'redirect':self?'self':reflection?'reflection':opt.origin||(typ==='dot'?'dot':'relic');
    amount = Math.max(0, finite(amount)); var ele = opt.element || 'none';
    if (typ !== 'true' && !opt.snapshot && opt.raw) {
      if (typeof elementCounterMult === 'function') amount *= elementCounterMult(ele, target.e);
      if (typ === 'magic' && typeof mrMult === 'function') amount *= mrMult(target.mr || 0);
    }
    if (opt.react === true) amount *= consumeMark(target, ele);
    if (asc) target._relicAscHit = true;
    if(typ==='dot'&&!opt.budgeted)amount=dotCap(target,amount,{ascended:asc});
    var before = hp(target), value = Math.floor(amount); if(window.AFK_CARD_COMBAT)value=window.AFK_CARD_COMBAT.damage(actor,target,value,{nativeRefund:typ==='dot'?null:opt.reflect!==false&&(typ!=='true'||opt.reflect===true)?'full':typ!=='true'?'terror':null,kind:typ==='physical'||typ==='true'&&opt.reflect===true?'melee':typ, /* card-combat:runtime-refund */origin:origin,reflection:reflection,redirected:redirected,ascended:asc,dotCapped:typ==='dot'&&(!opt.budgeted||opt.dotKind==='poison'||opt.dotKind==='bleed'),inherited:!!opt.cardInherited}); /* card-combat:runtime-damage */
    var friendly=target.eq||target===ownerPlayer(), attacker=self?null:(opt.attacker||actor);
    var incomingOpts={kind:typ==='magic'?'magic':typ==='dot'?'dot':typ==='ranged'?'ranged':'melee',element:ele,direct:opt.direct==null?typ!=='dot':!!opt.direct,main:false,origin:origin,dotKind:opt.dotKind,redirected:redirected,noProc:!!opt.noProc,damageSource:src,damageOwner:actor,reflection:reflection};
    if (friendly) value = incoming(target, value, attacker, incomingOpts);
    target[hpKey(target)] -= value; target.justHit = ele === 'none' ? 'magic' : ele;
    if (typeof mobWake === 'function' && !friendly) mobWake(target);
    transient(target,'_relicLastSource',{actor:actor,source:src,ascended:asc,executed:!!opt.execute,origin:origin});
    if(friendly)afterIncoming(target,value,attacker,incomingOpts);
    else if(typ!=='dot'&&origin!=='reflection'&&!opt.reflection){var rk=typ==='magic'?'magic':typ==='ranged'?'ranged':'melee';if(opt.reflect!==false&&(typ!=='true'||opt.reflect===true)&&typeof reflectWallOnDamage==='function')reflectWallOnDamage(target,value,rk,actor===ownerPlayer()?null:actor);else if(typ!=='true'&&typeof terrorVisageOnDamage==='function')terrorVisageOnDamage(target,value,rk);}
    var actual = Math.max(0,Math.min(before,before-hp(target)));
    trace('damage',{actor:actor,target:target,source:src,amount:value,actual:actual,kind:typ,origin:origin,ascended:asc});
    if(opt.settle&&hp(target)<=0&&!target._dead&&typeof killMob==='function'){var ix=mapState.mobs.indexOf(target);if(ix>=0)killMob(ix);}
    return actual;
  }
  var castDepth = 0;
  function cast(target, skillId, opt) {
    opt = opt || {}; if (castDepth >= 8 || !target || hp(target) <= 0) return 0;
    var ctx = active, owner = opt.actor||opt.owner || ctx && ctx.actor || ownerPlayer(), source = opt.source || ctx && ctx.sourceId;
    if(skillId==='@dual'){var B=W.AFK_RELIC_WEAPON_BRIDGE;return B&&B.dualSpell?B.dualSpell(target,ctx&&ctx.item,opt.parts,opt.mult||1,true,owner):0;}
    if (skillId === '@auto'||skillId==='auto') { var el = typeof document !== 'undefined' && document.getElementById('sel-atk-skill'); skillId = owner && (owner._autoAtkSkill||owner.atkSkill) || el && el.value; }
    if (skillId !== '@weapon' && !(typeof DB !== 'undefined' && DB.skills[skillId])) return 0;
    var def = opt.spell || ctx && ctx.item && ctx.item.spellProc;
    var victims=targets(),before = victims.reduce(function (s, m) { return s + hp(m); }, 0), old = W.__afkSpellMult, previous = action,oldPlayer=ownerPlayer();
    W.__afkSpellMult = finite(opt.mult) || 1; castDepth++;
    action = { id: ++seq, origin: 'proc', actor: owner, context:ctx&&Object.assign({},ctx), source: source, marks: [], seen: {},hits:[],calculatingSpell:true,generated:true,reflection:!!(ctx&&ctx.origin==='reflection'||previous&&previous.reflection) };
    if(previous&&previous.gm){action.gm=true;action.gmRoot=previous.gmRoot||previous;action.gmSources=previous.gmSources;action.gmOriginalEquipment=previous.gmOriginalEquipment;action.gmArmor=previous.gmArmor;action.seen=previous.seen;}
    try {
      for (var i = 0; i < Math.max(1, Math.min(20, opt.count || 1)); i++) {
        if (hp(target) <= 0||hp(owner)<=0||owner.dead||owner._downed) break;
        if(owner!==oldPlayer){if(skillId==='@weapon'&&def&&typeof allyProcWeaponSpell==='function')allyProcWeaponSpell(owner,target,def,0);else if(typeof allyProcFreeMagicSkill==='function')allyProcFreeMagicSkill(owner,target,skillId,0,false,ctx&&ctx.item);}
        else if (skillId === '@weapon' && def && typeof procWeaponSpell === 'function') procWeaponSpell(target, def, 0);
        else if (typeof procFreeMagicSkill === 'function') procFreeMagicSkill(target, skillId, 0, false, ctx && ctx.item);
      }
    } finally { flushSpellHits(action);player=oldPlayer;action = previous; W.__afkSpellMult = old; castDepth--; }
    return Math.max(0, before - victims.reduce(function (s, m) { return s + hp(m); }, 0));
  }
  function incoming(actor, amount, attacker, opts) {
    if (!enabled()) return amount; opts = opts || {};
    var c = Object.assign({ actor: actor, target: attacker, attacker: attacker, damage: amount, snapshot: amount, hpBefore: hp(actor), direct: true, kind: 'melee', element: 'none', main: true }, opts);
    c.singleTarget=c.singleTarget==null?c.single:c.singleTarget;c.normalAttack=c.main&&c.kind!=='magic'&&c.kind!=='dot';c.isDot=c.kind==='dot';c.damageType=c.kind==='magic'?'magic':c.kind==='dot'?'dot':'physical';c.now=now();
    var allies=team();allies.forEach(function(owner){if(owner===actor)return;var linked=Object.assign({},c,{actor:owner,recipient:actor,ally:actor});dispatch('beforeAllyHurt',linked);c.damage=linked.damage;});
    if (W.AFK_RELIC_DEFENSE&&W.AFK_RELIC_DEFENSE.incomingModifiers) W.AFK_RELIC_DEFENSE.incomingModifiers(c);
    dispatch('beforeHurt', c);
    var bs=stateOf(actor,'_buffs');Object.keys(bs).forEach(function(k){if(bs[k].until<=now())return;var b=bs[k].values;if(b.invulnerable)c.damage=0;if(c.normalAttack&&b.evadeNextNormal){c.damage=0;delete bs[k];}if(c.direct){if(b.directReduction)c.damage*=1-b.directReduction;if(b.physicalReduction&&c.damageType==='physical')c.damage*=1-b.physicalReduction;}});
    if(attacker&&c.direct){var dr=statusValue(attacker,'directDamageDown');if(dr)c.damage*=1-dr;var kr=statusValue(attacker,c.kind==='magic'?'magicDamageDown':'physicalDamageDown');if(kr)c.damage*=1-kr;}
    c.damage = absorb(actor, Math.max(0, finite(c.damage)), c);
    if (c.damage >= hp(actor)) dispatch('beforeDeath', c);
    c.damage = Math.max(0, finite(c.damage));
    var st = stateOf(actor, '_incoming'); st.pending = c;
    return c.damage;
  }
  function afterIncoming(actor, amount, attacker, opts) {
    var st = stateOf(actor, '_incoming'), c = st.pending || Object.assign({ actor: actor, target: attacker, attacker: attacker, damage: amount }, opts);
    st.pending = null; c.actualDamage = Math.min(c.hpBefore || amount, Math.max(0, amount));
    dispatch('afterHurt', c);trace('hurt',c); return c;
  }
  function attackFlags(actor, target, weapon, origin) {
    var key = weapon && (weapon.relicBase || byKey[weapon.id] && weapon.id), c = { actor: actor, target: target, weapon: weapon, channelKey: key, targetHpBefore: hp(target), damage: 0, main: origin == null || origin === 'normal', direct: true, origin: origin || 'normal', kind: weapon && weapon.ranged ? 'ranged' : 'melee', element: weapon && weapon.ele || 'none' };
    if (weapon) { c.forceHit = !!weapon.relicAlwaysHit; c.forceHeavy = !!weapon.relicForceHeavy; }
    dispatch('beforeAttack', c); return c;
  }
  function beforeHit(actor, target, amount, weapon, result) {
    if(!enabled())return amount;
    result = result || {}; var c = Object.assign({},result.relicFlags||{}, { actor: actor, target: target, weapon: weapon, channelKey: weapon && weapon.relicBase, damage: amount, snapshot: amount, targetHpBefore: hp(target), main:!action||['normal','auto','gm'].indexOf(action.origin)>=0, direct: true, origin: action && action.origin || 'normal', kind: result.ranged || weapon && weapon.ranged ? 'ranged' : 'melee', element: result.element||weapon && weapon.ele || 'none', critical: !!result.crit, heavy: !!result.heavy, graze: !!result.graze }, result);
    c.now=now();if(target&&!target._relicDefenseMarks)transient(target,'_relicDefenseMarks',{});
    if(typeof getWpnEle==='function'&&!result.element)c.element=getWpnEle(actor.eq&&actor.eq.wpn,weapon,actor)||'none';
    applyVulnerability(c);
    if(W.AFK_RELIC_DEFENSE&&W.AFK_RELIC_DEFENSE.targetModifiers)W.AFK_RELIC_DEFENSE.targetModifiers(c,api);
    dispatch('beforeHit', c);
    if (weapon && weapon.relicAsc != null) target._relicAscHit = true;
    c.damage = Math.max(0, finite(c.damage)); c.snapshot = c.damage;result.relicSnapshot=c.snapshot;
    var prev=active;active=c;try{c.damage*=consumeMark(target,c.element);}finally{active=prev;}
    stateOf(actor, '_attack').pending = c; return c.damage;
  }
  function afterHit(actor, target, amount, weapon) {
    if(!enabled())return;
    var st = stateOf(actor, '_attack'), c = st.pending || { actor: actor, target: target, weapon: weapon, channelKey: weapon && weapon.relicBase, damage: amount, snapshot: amount, targetHpBefore: hp(target) + amount, main: true, direct: true, origin: 'normal', kind: weapon && weapon.ranged ? 'ranged' : 'melee', element: weapon && weapon.ele || 'none' };
    st.pending = null; c.actualDamage = Math.max(0,Math.min(amount,(c.targetHpBefore||amount)-hp(target)));transient(target,'_relicLastSource',{actor:actor,source:weapon&&weapon.relicBase,ascended:!!(weapon&&weapon.relicAsc!=null)});
    if(actor.dead||actor._downed||hp(actor)<=0)return c;
    dispatch('afterHit', c);if(c.doubleBlade||c.dualx2)moduleEvent('weapon','doubleBlade',Object.assign({},c));dispatch('directHit',Object.assign({},c));if(c.element!=='none')dispatch('elementHit',Object.assign({},c));addMarkAfter(c);
    trace('damage',{actor:actor,target:target,source:weapon&&weapon.relicBase,amount:amount,actual:c.actualDamage,snapshot:c.snapshot,kind:c.kind,origin:c.origin});return c;
  }
  function spellDamage(actor, target, amount, skill, extra) {
    if(!enabled())return amount;
    var c = Object.assign({ actor: actor, target: target, damage: amount, snapshot: amount, targetHpBefore: hp(target), skillId: skill && skill.id, element: skill && skill.ele || 'none', kind: 'magic', origin: action && action.origin || 'normal', main: false, direct: true, paid: !!(action && action.paid) }, extra || {});
    if(action&&action.reflection)c.origin='reflection';
    c.channelKey=action&&action.source;c.weapon=action&&action.weapon||actor.eq&&actor.eq.wpn&&DB.items[actor.eq.wpn.id];
    if(c.main&&c.weapon)c.channelKey=c.weapon.relicBase;
    if(target&&!target._relicDefenseMarks)transient(target,'_relicDefenseMarks',{});
    c.damage *= action && finite(action.damageMult) || 1;
    c.skillName=skill&&skill.n;c.damageType=skill&&skill.dmgType||'magic';c.skillHitIndex=action?(action.skillHitCount||0):0;if(action)action.skillHitCount=c.skillHitIndex+1;c.generated=!!(action&&action.generated);c.now=now();
    if(c.main&&c.weapon&&W.AFK_RELIC_WEAPON_BRIDGE){var flags=W.AFK_RELIC_WEAPON_BRIDGE.qiguFlags(actor,target,c.weapon);c=Object.assign({},flags,c);}
    applyVulnerability(c);
    if(W.AFK_RELIC_DEFENSE&&W.AFK_RELIC_DEFENSE.targetModifiers)W.AFK_RELIC_DEFENSE.targetModifiers(c,api);
    moduleEvent('weapon',c.main?'beforeHit':'beforeSkill',c);moduleEvent('defense','beforeHit',c);c.snapshot=c.damage;
    var prev=active;active=c;try{c.damage*=consumeMark(target,c.element);}finally{active=prev;}
    var asc=!!(action&&action.context&&action.context.asc!=null||c.main&&c.weapon&&c.weapon.relicAsc!=null);if(asc)target._relicAscHit=true;
    transient(target,'_relicLastSource',{actor:actor,source:action&&action.source,ascended:asc});
    if(action){action.hits=action.hits||[];action.hits.push(c);action.damage=(action.damage||0)+c.damage;action.snapshot=(action.snapshot||0)+c.snapshot;}
    return Math.max(0, finite(c.damage));
  }
  function flushSpellHits(a) {
    if(!a||!a.hits)return;var hs=a.hits.splice(0);
    hs.forEach(function(c){c.actualDamage=Math.max(0,Math.min(c.damage,c.targetHpBefore-hp(c.target)));if(!c.actor.dead&&!c.actor._downed&&hp(c.actor)>0){moduleEvent('defense','afterHit',c);moduleEvent('weapon',c.main?'afterHit':'skill',c);dispatch('directHit',Object.assign({},c));if(c.element!=='none')dispatch('elementHit',Object.assign({},c));if(c.main)addMarkAfter(c);}trace('damage',{actor:c.actor,target:c.target,amount:c.damage,actual:c.actualDamage,snapshot:c.snapshot,kind:c.kind,origin:c.origin,skillId:c.skillId});});
  }
  function applyVulnerability(c){if(!c.target||c.snapshotCopy)return;var n=statusValue(c.target,c.element+'Vulnerability');if(n)c.damage*=1+n;if(c.kind!=='magic'&&c.kind!=='dot'){var p=statusValue(c.target,'physicalVulnerability');if(p)c.damage*=1+p;}}
  function moduleEvent(mod,event,c){var old=c._module;c._module=mod;try{return dispatch(event,c);}finally{c._module=old;}}
  function tickRuntime() {
    if (!enabled() || typeof state === 'undefined' || lastTick === state.ticks) return;
    lastTick = state.ticks; var current = typeof mapState !== 'undefined' ? mapState.current : null;
    if(W.AFK_RELIC_DEFENSE_BRIDGE&&W.AFK_RELIC_DEFENSE_BRIDGE.syncMovement)W.AFK_RELIC_DEFENSE_BRIDGE.syncMovement();
    if (current !== lastMap) {
      team().forEach(function (a) { dispatch('battleEnd', { actor: a }); }); battle++; lastMap = current;
      team().forEach(function (a) { dispatch('battleStart', { actor: a }); });
    }
    var due = delayed.filter(function (d) { return d.at <= now(); }); delayed = delayed.filter(function (d) { return d.at > now(); });
    due.forEach(function (d) { if (d.battle !== battle) return; var prev = active; active = d.context; try { d.fn(); } finally { active = prev; } });
    team().forEach(function (a) {
      var bs = stateOf(a, '_buffs'), expired = false; Object.keys(bs).forEach(function (k) { if (bs[k].until <= now()) { delete bs[k]; expired = true; } }); if (expired) recalc(a);
      dispatch('tick', { actor: a,target:targets()[0], dt: 0.1, main: false });
      var ss=stateOf(a,'_statuses');Object.keys(ss).forEach(function(k){if(ss[k].until<=now()){delete ss[k];dispatch('onStatusEnd',{actor:a,statusKind:k,main:false});}});
      var defense=W.AFK_RELIC_DEFENSE,derived=stateOf(a,'_derived');
      if(defense&&defense.dynamicStatsKey&&derived.dynamicStatsKey!==defense.dynamicStatsKey(a,api))recalc(a);
    });
    targets().forEach(function (m) {
      var list = m._relicDots || [], keep = [];
      list.forEach(function (d) {
        if (d.next <= now() && d.next <= d.until) {
          var dc={actor:d.owner,owner:d.owner,target:m,damage:Math.max(0,d.damage),snapshot:d.damage,dotKind:d.kind,dotSourceId:d.source,critChance:0,critMult:1.5,kind:'dot',isDot:true,direct:false,main:false,origin:'dot'};
          dispatch('beforeDot',dc);var n=dc.damage;if(Math.random()<dc.critChance)n*=dc.critMult;if (d.kind === 'poison' || d.kind === 'bleed') n = dotCap(m, n, d);
          var prev = active; active = { actor: d.owner, sourceId: d.source, asc: d.ascended ? 0 : null };
          try { dc.actualDamage=damage(m, n, { type: 'dot', source: d.source,budgeted:true,reflect:false,element:d.element,dotKind:d.kind } /* card-combat:runtime-dot-kind */);dispatch('afterDot',dc); } finally { active = prev; }
          d.next += 1;
        }
        if (d.until > now()) keep.push(d);
      }); m._relicDots = keep;
      if(hp(m)<=0&&!m._dead&&typeof killMob==='function'){var ix=mapState.mobs.indexOf(m);if(ix>=0)killMob(ix);}
    });
  }
  function stats(actor, d) {
    if(!enabled())return;
    var oldSpeed=d.atkSpdPct||0,oldAspd=d.aspd,aliases={mcrit:'meleeCrit',rcrit:'rangedCrit',evade:'er',moveSpdPct:'moveSpeedPct',immuneStun:'immStun',immuneParalyze:'immParalyze',immuneSlow:'immSlow'},bs = stateOf(actor, '_buffs'); Object.keys(bs).forEach(function (k) { var b = bs[k]; if (b.until <= now()) return; Object.keys(b.values).forEach(function (f) { if(['str','dex','con','int','wis','cha'].indexOf(f)>=0)return;var to=aliases[f]||f;if (typeof b.values[f] === 'number') d[to] = finite(d[to]) + b.values[f]; else d[to] = b.values[f]; }); });
    var c={actor:actor,stats:d,main:false};if(W.AFK_RELIC_COMPANIONS&&W.AFK_RELIC_COMPANIONS.weightInfo)Object.assign(c,W.AFK_RELIC_COMPANIONS.weightInfo(actor,d));dispatch('onStats',c);
    if(c.maxHpAdd)actor.mhp+=c.maxHpAdd;if(c.weightCapacityMult){d._relicWeightCapacityMult=c.weightCapacityMult;var priorTier=d.loadTier||0;d.weightCapacity=(d.weightCapacity||c.weightCapacity||1)*c.weightCapacityMult;d.weightPct=Math.floor((d.equippedWeight||0)/d.weightCapacity*100);d.loadTier=d.weightPct<=49?0:d.weightPct<=81?1:d.weightPct<=99?2:3;d.aspd*=Math.max(1,d.loadTier)/Math.max(1,priorTier);}
    // Missing-HP speed uses the final HP ceiling, including devour/weight HP.
    // Otherwise a later maxHpAdd could leave both the stat and its key stale.
    var defense=W.AFK_RELIC_DEFENSE;
    if(c.relicHpSpeedBonus!=null&&defense&&defense.hpSpeedBonus)d.atkSpdPct+=defense.hpSpeedBonus(actor,api)-c.relicHpSpeedBonus;
    if(d.atkSpdPct!==oldSpeed&&d.aspd>0)d.aspd*=Math.max(.01,1+oldSpeed/100)/Math.max(.01,1+d.atkSpdPct/100);
    if(oldAspd>0&&d.aspdOff>0)d.aspdOff*=d.aspd/oldAspd;stateOf(actor,'_derived').context=c;
    if(defense&&defense.dynamicStatsKey)stateOf(actor,'_derived').dynamicStatsKey=defense.dynamicStatsKey(actor,api);
  }
  function companionDamage(owner,entity,target,amount,extra){
    if(!enabled())return amount;
    var C=W.AFK_RELIC_COMPANIONS,meta=C&&C.companionContext?C.companionContext(owner,entity,extra):C&&C.context?C.context():null;
    var c=Object.assign({actor:owner||ownerPlayer(),owner:owner||ownerPlayer(),companion:entity,pet:entity,target:target,damage:amount,snapshot:amount,targetHpBefore:hp(target),origin:entity&&entity.skId?'summon':'pet',main:false,direct:true,now:now()},extra||{},meta||{});
    c.companionKind=c.kind==='pet'?'pet':'summon';c.kind=extra&&extra.element&&extra.element!=='none'?'magic':'melee';
    if(C&&C.damageMult)c.damage*=C.damageMult(c.actor,entity);if(meta&&meta.mult!=null)c.damage*=meta.mult;
    if(W.AFK_RELIC_DEFENSE&&W.AFK_RELIC_DEFENSE.targetModifiers)W.AFK_RELIC_DEFENSE.targetModifiers(c,api);
    moduleEvent('weapon','petHit',c);c.snapshot=c.damage;
    var q=stateOf(c.actor,'_companions');(q.hits||(q.hits=[])).push(c);return Math.max(0,Math.floor(c.damage));
  }
  function flushCompanionHits(owner){var q=stateOf(owner||ownerPlayer(),'_companions'),list=q.hits||[];q.hits=[];list.forEach(function(c){c.actualDamage=Math.max(0,Math.min(c.damage,c.targetHpBefore-hp(c.target)));moduleEvent('defense','petHit',c);trace('damage',{actor:c.actor,target:c.target,amount:c.damage,actual:c.actualDamage,kind:c.kind,origin:c.origin});});}
  function foreignHeal(actor,amount,source,extra){var c=Object.assign({actor:actor,recipient:actor,amount:amount,hpBefore:hp(actor),healSource:source,main:false},extra||{});dispatch('beforeHeal',c);stateOf(actor,'_healing').pending=c;return Math.max(0,Math.floor(c.amount));}
  function foreignHealDone(actor,amount,event){var s=stateOf(actor,'_healing'),c=s.pending||{actor:actor,recipient:actor,hpBefore:hp(actor)-amount,healSource:event==='onPotion'?'potion':'spell'};s.pending=null;c.actualHeal=Math.max(0,hp(actor)-c.hpBefore);c.overheal=Math.max(0,amount-c.actualHeal);dispatch('onHeal',c);if(event)dispatch(event,c);return c;}
  function castCost(actor,skill,id,cost){var c={actor:actor,target:typeof getTarget==='function'?getTarget():targets()[0],skill:skill,skillId:id,skillName:skill.n,skillType:skill.type,element:skill.ele||'none',damageType:skill.dmgType||'magic',mpCost:cost,hpCost:0,origin:action&&action.origin||'normal',main:false,damageMult:1,healMult:1};dispatch('beforeCast',c);if(action){action.costContext=c;action.damageMult=c.damageMult;action.healMult=c.healMult;}if(c.blocked)return Number.MAX_SAFE_INTEGER;return Math.max(0,Math.ceil(c.mpCost));}
  function castPaid(actor,cost){if(!enabled()||!action)return;var c=action.costContext;action.paid=cost>0;action.paidMp=cost;if(c&&!c._paid){if(c.hpCost)api.payHp(actor,c.hpCost);c._paid=true;}}
  function earlyStats(actor,d){if(!enabled())return;var bs=stateOf(actor,'_buffs');Object.keys(bs).forEach(function(k){var b=bs[k];if(b.until<=now())return;['str','dex','con','int','wis','cha'].forEach(function(f){if(b.values[f])d[f]=finite(d[f])+finite(b.values[f]);});});}
  var api = {
    damage: damage, dot: dot, heal: heal, healGroup: healGroup, shield: shield, cast: cast, buff: buff, status: status,
    hp: hp, mhp: mhp, state: stateOf, cooldown: cooldown, targets: targets, team: team, pets: pets, summons: summons,
    mp: function (a, v) { if (!a) return 0; var key = a.curMp != null ? 'curMp' : 'mp', before = finite(a[key]); a[key] = Math.max(0, Math.min(finite(a.mmp), before + finite(v))); return a[key] - before; },
    delay: function (s, fn) { delayed.push({ at: now() + s, fn: fn, context: active && Object.assign({}, active), battle: battle }); },
    mark: mark, hasMark: function (t, k) { var d = markDef(k); return !!(t && d && t[d.key] > now() * 10); },
    hasStatus: function (e, k) { var s = e && (e.st || e.statuses || e._statuses),nativeKey=k==='silence'&&s===e?.st?'magicseal':k==='slow'&&s!==e?.st?'slowAtk':k==='root'?'bind':k; return !!(s && s[nativeKey] > 0 ||k==='bleed'&&e&&e.bleeds&&e.bleeds.length||e&&statusValue(e,k)|| e && e._relicDots && e._relicDots.some(function (d) { return d.kind === k && d.until > now(); })); },
    removeStatus: function (e, k) {if(!e)return;var one=/:one$/.test(k);k=k.replace(/:one$/,'');var s = e.st || e.statuses || e._statuses,nativeKey=k==='silence'&&s===e.st?'magicseal':k==='slow'&&s!==e.st?'slowAtk':k==='root'?'bind':k; if (s) s[nativeKey]=0;delete stateOf(e,'_statuses')[k];if(k==='bleed'&&e.bleeds){if(one)e.bleeds.shift();else e.bleeds=[];}if(e._relicDots){if(one){var at=e._relicDots.findIndex(function(d){return d.kind===k;});if(at>=0)e._relicDots.splice(at,1);}else e._relicDots=e._relicDots.filter(function(d){return d.kind!==k;});}dispatch('onStatusEnd',{actor:e,statusKind:k,removed:true,main:false}); },
    execute: function (t) { if (t) t[hpKey(t)] = 0; },
    random: function () { return Math.random(); }, now: now,
    dotLayers:function(t,k,src){return(t&&t._relicDots||[]).filter(function(d){return d.kind===k&&(!src||d.source===src)&&d.until>now();}).length;},
    dotDamage:function(t,k,src){return(t&&t._relicDots||[]).filter(function(d){return d.kind===k&&(!src||d.source===src)&&d.until>now();}).reduce(function(sum,d){return sum+d.damage;},0);},
    hasDot:function(t,k,src){return api.dotLayers(t,k,src)>0;},
    transferDots:function(from,to,opt){(from&&from._relicDots||[]).slice().filter(function(d){return d.owner===opt.owner&&opt.kinds.indexOf(d.kind)>=0;}).forEach(function(d){dot(to,d.kind,{owner:d.owner,source:d.source,damage:d.damage,layers:1,ascended:d.ascended,duration:opt.resetDuration?d.duration:Math.max(.1,d.until-now()),cap:d.cap});});},
    shieldAmount:function(a,src){var b=stateOf(a,'_shields')[src];return b&&b.until>now()?b.amount:0;},
    wearHardSkin:function(t,v){if(t&&t.hardSkin>0)t.hardSkin=Math.max(0,t.hardSkin-v);},
    expose:function(t,n,opt){if(!t)return;t.st=t.st||(typeof newMobStatus==='function'?newMobStatus():{});t.st.expose=Math.min(3,(t.st.expose||0)+n);},
    payHp:function(a,n){var actual=Math.max(0,Math.min(hp(a)-1,n));a[hpKey(a)]-=actual;return actual;},
    selfDamage:function(a,n,opt){return damage(a,n,Object.assign({actor:a,origin:'self',type:'dot',reflect:false,budgeted:true},opt||{}));},
    selfCast:function(a,id,opt){var sk=DB.skills[id];if(!a||!sk)return false;a.buffs=a.buffs||{};a.buffs[id]=Math.max(a.buffs[id]||0,sk.dur||sk.duration||30);recalc(a);return true;},
    attack:function(a,t,opt){var B=W.AFK_RELIC_WEAPON_BRIDGE,e=a.eq&&a.eq.wpn,d=e&&DB.items[e.id];if(B&&B.nativeSegment&&d)return B.nativeSegment(t,d,e,Object.assign({actor:a},opt||{}));return 0;},
    healSpellAmount:function(t,id,owner){return typeof rollHealingSpell==='function'&&DB.skills[id]?rollHealingSpell(DB.skills[id],owner.d,owner,t):0;},
    activeContext:function(){return active;},
    weakTo:function(t,e){return typeof elementCounterMult==='function'?elementCounterMult(e,t.e)>1:({water:'fire',fire:'earth',earth:'wind',wind:'water'})[e]===t.e;},
    threat:function(a,m){stateOf(a,'_threat').mult=m;}
  };
  var R = W.AFK_RELIC_RUNTIME = { api: api, catalog: catalog, byKey: byKey, byId: byId, configure: configure, sources: sourceList, ultimate: ultimate,
    dispatch: dispatch, beforeHit: beforeHit, afterHit: afterHit, attackFlags: attackFlags, incoming: incoming, afterIncoming: afterIncoming, spellDamage: spellDamage,
    stats: stats, tick: tickRuntime, marks: markDefs, consumeMark: consumeMark, dotCap: dotCap, isGM: isGM,enabled:enabled,
    context:function(){return active;},weaponEvent:function(e,c){return moduleEvent('weapon',e,c);},defenseEvent:function(e,c){return moduleEvent('defense',e,c);},
    companionDamage:companionDamage,flushCompanionHits:flushCompanionHits,flushSpellHits:flushSpellHits,castCost:castCost,castPaid:castPaid,earlyStats:earlyStats,foreignHeal:foreignHeal,foreignHealDone:foreignHealDone,
    ownsBleed:function(w){var d=typeof w==='string'?DB.items[w]:w;return!!(enabled()&&d&&d.relicOwnsBleed);},
    statusValue:statusValue,transient:transient,recalc:recalc,
    ignorePotionReduction:function(a){var c=stateOf(a,'_healing').pending;return!!(c&&c.ignoreHealingReduction);},
    procHeal:function(a,n,src){if(!a||a.dead||a._downed||hp(a)<=0)return 0;var c=active||action&&action.context,source=src||action&&action.source||c&&c.sourceId;if(enabled()&&source&&byKey[source])return heal(a,n,{owner:a,source:source});var v=Math.min(n,mhp(a)-hp(a));a[hpKey(a)]+=Math.max(0,v);return Math.max(0,v);},
    observe:function(fn){observers.push(fn);return function(){observers=observers.filter(function(x){return x!==fn;});};},
    state: stateOf, invalidate: function () { revision++; ultimateCache = {}; },
    action: function () { return action; }, setAction: function (a) { var old = action; action = a; return old; },
    nextAction: function (actor, origin) { return { id: ++seq, actor: actor, origin: origin || 'normal', marks: [], seen: {},hits:[] }; },
    finishAction: function (a) {flushSpellHits(a);if(a&&(!a.gm||!a.gmRoot||a.gmRoot===a))a.marks.splice(0).forEach(function (m) { mark(m.target, m.kind, 10); });},
    originalBase: function (key) { return baseDefs[key]; }
  };
  W.__afkRelicTier = configure;
  W.__afkRelicDmg = beforeHit; W.__afkRelicHit = afterHit;
  W.__afkRelicNoUp = function (id) { var d = typeof DB !== 'undefined' && DB.items[id]; return GM_IDS.indexOf(String(id)) >= 0 || !!(d && d.noAscUp); };
  W.__afkMarks = markDefs;
  W.consumeWetMult = function (target, ele) { if(enabled()&&action&&(action.calculatingPhysical||action.calculatingSpell))return 1;return enabled() ? consumeMark(target, ele) : target && ele === 'wind' && target._wetUntil > now() * 10 ? (target._wetUntil = 0, 2) : 1; };
  function init() {
    catalog.forEach(function (c) { var d = DB.items[c.key]; if (!d) throw new Error('Missing relic: ' + c.key); if (!baseDefs[c.key]) baseDefs[c.key] = clone(d); configure(d, baseDefs[c.key], 0, null); });
    // This source-aware budget supersedes the old target-wide ascended exemption.
    W.__afkDotCap = function (m, damage, source) { return enabled() ? dotCap(m, damage, source) : damage; };
    revision++;
  }
  R.init = init;
  if (typeof setTimeout === 'function') setTimeout(init, 0);
})();
