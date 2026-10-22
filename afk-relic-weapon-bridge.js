/* Native combat adapters for the weapon relic catalog.
 * All damage is finalized before HP subtraction. A generated strike has an
 * explicit source and origin, and never re-enters the ordinary attack loop.
 * Core-only seams are installed by apply-relic-weapon-bridge-patches.mjs.
 */
(function () {
  'use strict';
  var W = window, physical = [], allyFlagsByActor = new WeakMap(), earlyFlags = new WeakMap(), qiguFlagsByActor = new WeakMap();
  function enabled() { return !!W.AFK_RELIC_RUNTIME && (!W.AFK_TOGGLES || W.AFK_TOGGLES.enabled('relicfx')); }
  function runtime() { return W.AFK_RELIC_RUNTIME; }
  function owner() { return typeof player !== 'undefined' ? player : null; }
  function number(v, fallback) { return Number.isFinite(Number(v)) ? Number(v) : (fallback || 0); }
  function hp(x) { return x ? Math.max(0, number(x.curHp == null ? x.hp : x.curHp)) : 0; }
  function alive(x) { return !!x && hp(x) > 0 && !x._dead && !x.dead; }
  function mainWeapon(a) { a = a || owner(); return a && a.eq && a.eq.wpn && DB.items[a.eq.wpn.id]; }
  function key(d) { return d && (d.relicSourceId || d.relicBase); }
  function equipped(d) { return !!(d && d.relicCatalogId && d.relicCatalogId <= 131); }
  function mastery(k, a) { return a && a !== owner() && typeof allyHasMastery === 'function' ? allyHasMastery(a,k) : typeof hasMastery === 'function' && hasMastery(k); }
  function current() { return physical[physical.length - 1] || null; }
  function source(d, a) {
    a = a || owner(); var k = key(d), r = runtime();
    var found = r && r.sources(a).find(function (s) { return s.key === k; });
    return found || { key: k, sourceId: k, catalogId: d.relicCatalogId, def: d, item: d,
      stage: number(d.relicWeaponStage), n: number(d.relicPlus), asc: d.relicAsc == null ? null : d.relicAsc };
  }
  function context(d, target, origin, extra) {
    d=d||{};
    var a = extra && extra.actor || owner(), s = source(d, a), r = runtime(), act = r.action();
    return Object.assign({ actor: a, target: target, item: d, source: d, weapon: d,
      sourceId: s.key, catalogId: s.catalogId, stage: s.stage, n: s.n, asc: s.asc,
      channelKey: s.key, origin: origin, actionId: act && act.id, targetHpBefore: hp(target),
      hpBefore: hp(a), element: d.ele || 'none', kind: d.ranged ? 'ranged' : 'melee',
      damageType: 'physical', main: origin === 'normal' || origin === 'auto', direct: true }, extra || {});
  }
  function weaponEvent(event, c) {
    var r = runtime();
    if (r.weaponEvent) return r.weaponEvent(event, c);
    return r.dispatch(event, c, source(c.weapon || c.item, c.actor));
  }
  function withAction(d, target, origin, fn, actor) {
    var r = runtime(), previous = r.action(), c = context(d, target, origin, {actor:actor||owner()});
    var a = r.nextAction(actor||owner(), origin); a.context = c; a.source = key(d); c.actionId = a.id;
    a.gm = !!(previous && previous.gm); a.gmSources = previous && previous.gmSources; a.gmOriginalEquipment=previous&&previous.gmOriginalEquipment; a.gmRoot=previous&&(previous.gmRoot||previous);a.gmArmor=previous&&previous.gmArmor; if(a.gm&&previous.seen)a.seen=previous.seen;
    a.generated = origin !== 'normal' && origin !== 'auto';a.reflection=!!(previous&&previous.reflection||r.context()&&r.context().origin==='reflection');if(a.reflection)c.origin='reflection';
    r.setAction(a);
    try { return fn(c, a); } finally { r.finishAction(a); r.setAction(previous); }
  }
  function runDamage(target, amount, d, origin, extra) {
    if (!enabled() || !alive(target) || !alive(extra && extra.actor || owner())) return 0;
    var r = runtime();
    return r.api.damage(target, Math.max(0, number(amount)), Object.assign({ actor: owner(),
      source: key(d), ascended: d.relicAsc != null, origin: origin, element: d.ele || 'none',
      type: 'physical', reflect: true, react: true, snapshot: true, settle: true }, extra || {}));
  }
  function targets() { return runtime().api.targets().filter(alive); }
  function pick(t) { return alive(t) ? t : targets()[0]; }
  function log(label, t, n) {
    if (typeof logCombat === 'function' && n > 0) logCombat('【' + label + '】對 ' + (t.n || '敵人') + ' 造成 ' + Math.floor(n) + ' 點傷害。', 'player-special');
  }
  function wrap(name, make) {
    if (typeof W[name] !== 'function') return;
    var original = W[name]; W[name] = make(original); W[name]._relicWeaponBridge = true;
  }
  function procHeal(a,n,d) {
    if(enabled()&&equipped(d))return runtime().procHeal(a,n,key(d));
    if(!alive(a))return 0;var field=a.curHp==null?'hp':'curHp',got=Math.max(0,Math.min(n,(a.mhp||a.hp)-hp(a)));a[field]+=got;return got;
  }
  function healingSpell(a,d,hit) {
    if(!enabled()||!equipped(d)||!d.procHealSkill)return false;
    if(!hit||!alive(a)||Math.random()*100>=(d.procHealSkill.rate||5))return true;
    var sk=DB.skills[d.procHealSkill.skId];if(!sk)return true;
    var rows=(typeof healBeneficiaries==='function'?healBeneficiaries():runtime().api.team()).filter(alive).map(function(x){return {actor:x,amount:rollHealingSpell(sk,a.d,a,x)};});
    runtime().api.healGroup(rows,{owner:a,source:key(d),cd:10});return true;
  }
  // Narrow pre-calculation flags: these must never dispatch stateful skill events.
  function spellMr(a,d,skillId,value) {
    if(!enabled()||!equipped(d))return value;
    var act=runtime().action();
    return d.relicSpellIgnoreMr&&skillId==='sk_vampire'||d.qiguIgnoreMr&&skillId==='@qigu'||act&&act.context&&act.context.ignoreMr?0:value;
  }
  function spellFlatReduction(a,d,skillId,value) {
    if(!enabled()||!equipped(d))return value;
    if(d.relicMainTrue&&skillId==='@qigu')return 0;
    if(d.relicCatalogId===123&&skillId==='sk_hell_fang')return value*(1-[0,.25,.5,.5,1][d.relicWeaponStage||0]);
    return value;
  }
  function qiguCoef(a,d,t,ele) {
    if(enabled()&&d&&d.relicMainTrue)return magicDamageCoef(a.d,0,weaponMagicTier(d));
    return weaponMagicDamageCoef(a.d,d,t,ele);
  }
  function qiguFlags(a,t,d) {
    var act=runtime().action(),old=qiguFlagsByActor.get(a);
    if(old&&old.target===t&&old.weapon===d&&old.action===(act&&act.id))return old.flags;
    var c=physicalFlags(a,t,d,'normal',false);c.kind='magic';c.damageType=d.relicMainTrue?'true':'magic';c.main=true;c.critical=!!c.forceCritical;c.heavy=!!c.forceHeavy;
    qiguFlagsByActor.set(a,{target:t,weapon:d,action:act&&act.id,flags:c});return c;
  }
  function qiguCritMult(a,t,d) {
    if(!enabled()||!runtime().sources(a).length)return 1;
    return qiguFlags(a,t,d).forceCritical?1+number(a.d.magicCritDmg)/100:1;
  }
  function qiguRoll(a,t,d,dice) {
    if(!enabled()||!runtime().sources(a).length)return roll(1,dice);
    var c=qiguFlags(a,t,d);return c.forceHeavy?weaponRoll(dice,true,d):roll(1,dice);
  }
  function qiguBefore(a,t,amount,d) {
    if(!enabled()||!equipped(d))return amount;
    var c=qiguFlags(a,t,d),r=runtime();c.damage=amount;c.snapshot=amount;c.now=typeof state!=='undefined'?state.ticks/10:0;
    // Qigu is a basic hit; beforeHit owns its weapon predicates exactly once.
    return r.beforeHit(a,t,amount,d,{relicFlags:c,element:c.element,damageType:c.damageType,main:true,ranged:false,origin:'normal'});
  }
  function magicStrikeChance(a,d) {
    return enabled()&&d&&d.relicMagicStrikeRate!=null?d.relicMagicStrikeRate/100:number(a.d&&a.d.str)/60;
  }
  function combo(a,t,full) {
    var d=mainWeapon(a);if(!alive(a)||!alive(t))return 0;
    return withAction(d,t,'combo',function(c){
      var r=a===owner()?getPhysicalDmg(t.s==='L'?d.dmgL:d.dmgS,t,d,null,false,false,false,full&&!!d.comboForceCrit):allyStrikeRoll(a,t,{forceCrit:full&&!!d.comboForceCrit});
      if(!r.hit)return 0;
      var n=r.dmg;
      if(a===owner()){
        if(a.buffs&&a.buffs.sk_dark_burn>0&&Math.random()<.3)n*=1.5;
        if(a.buffs&&a.buffs.sk_dark_double>0){var tags=getWeaponTags(a.eq.wpn.id);if((tags.indexOf('雙刀')>=0||tags.indexOf('鋼爪')>=0)&&Math.random()*100<10+(a.lv>=45?Math.floor((a.lv-45)/5):0))n*=2;}
      }else n*=elementCounterMult(r.element||d.ele||'none',t.e)*royalAllyMult();
      n=Math.max(1,Math.floor(n*(full?(a._setShadow5?2:1):(a._setShadow5?1:.5))));
      c.damage=c.snapshot=n;c.critical=!!r.crit;c.heavy=!!r.heavy;c.main=false;c.element=r.element||d.ele||'none';
      c.actualDamage=runDamage(t,n,d,'combo',{actor:a,element:c.element});
      if(!alive(a))return c.actualDamage;
      if(r.crit&&typeof grantCritFuryHaste==='function')grantCritFuryHaste(a,d);
      if(alive(t)&&typeof wearHardSkin==='function')wearHardSkin(t,a.eq.wpn.id,r.heavy,false,true,a.classicMode);
      if(full&&d.mpOnComboHit)runtime().api.mp(a,d.mpOnComboHit);
      weaponEvent('combo',c);log('雙擊',t,c.actualDamage);return c.actualDamage;
    },a);
  }
  wrap('procCombo',function(native){return function(t,full){return enabled()&&equipped(mainWeapon())?combo(owner(),t,full):native.apply(this,arguments);};});
  wrap('allyComboAttack',function(native){return function(a,t,full){return enabled()&&equipped(mainWeapon(a))?combo(a,t,full):native.apply(this,arguments);};});

  // These callbacks are inside getPhysicalDmg, before its dependent arithmetic.
  function hitRoll(first, d) {
    var c = current(); if (!enabled() || !c || c.probe || c.forced) return first;
    var rolls = Math.max(1, number(c.flags.heavyRolls || d && d.relicHeavyRolls, 1));
    var threshold = d && d.eff === 'crush' ? 19 - Math.round(number(d.heavyRatePct) / 5) : 20;
    for (var i = 1; i < Math.min(10, rolls); i++) if (roll(1, 20) >= threshold) return 20;
    return first;
  }
  function grazeHeavy(graze, d) {
    if (!enabled() || !graze || !d || !d.relicGrazeCanHeavy) return false;
    return roll(1, 20) >= (d.eff === 'crush' ? 19 - Math.round(number(d.heavyRatePct) / 5) : 20);
  }
  function weaponRoll(value, heavy, d) {
    return enabled() && heavy && d && d.relicHeavyWeaponMult ? value * d.relicHeavyWeaponMult : value;
  }
  function flatReduction(target, d, value) {
    if(!enabled())return value;
    value=Math.max(0,value-(runtime().statusValue?runtime().statusValue(target,'flatReductionDown'):0));
    var c = current(); if (!c) return value;
    return c.ignoreFlat || c.flags.ignoreFlatReduction || c.flags.damageType === 'true' ? 0 : value;
  }
  function counterElementMult(d, target, value) {
    if (enabled() && d && d.relicCounterElementMult && d.counterEles && d.counterEles.indexOf(target.e) >= 0) return Math.max(value, d.relicCounterElementMult);
    return value;
  }
  function affix(original) {
    var c = current(); return enabled() && c && c.flags.element ? Object.assign({}, original || {}, { ele: c.flags.element }) : original;
  }
  function physicalFlags(a, t, d, origin, probe) {
    d=d||{};var r = runtime(), act = r.action(), c, early=earlyFlags.get(a);
    if(!probe&&early&&early.target===t&&early.weapon===d&&early.action===(act&&act.id)){c=early.flags;earlyFlags.delete(a);}
    else if (!probe && (origin === 'normal' || origin === 'auto') && !(act && (act.noProc || act.context && act.context.skillId))) c = r.attackFlags(a, t, d, origin);
    else c = context(d, t, origin, { actor:a, main: false });
    c.forceHit = !!(c.forceHit || d.relicAlwaysHit);
    c.forceHeavy = !!(c.forceHeavy || d.relicForceHeavy);
    if (d.relicMainTrue && c.main) c.damageType = 'true';
    if (d.relicHeavyWeaponElement && c.forceHeavy) c.element = d.relicHeavyWeaponElement;
    if (d.relicCatalogId === 53 && d.relicWeaponStage >= 3 && number(r.state(t, key(d)).sharpen) >= 10) c.ignoreFlatReduction = true;
    if (act && act.context && act.context.ignoreFlatReduction) c.ignoreFlatReduction = true;
    if (c.element === (d.ele || 'none') && typeof getWpnEle === 'function') c.element = getWpnEle(a.eq && a.eq.wpn,d,a) || c.element;
    return c;
  }
  function earlySureHit(a,t) {
    if(!enabled()||!runtime().sources(a).length)return false;
    var d=mainWeapon(a)||{},act=runtime().action(),c=physicalFlags(a,t,d,'normal',false);
    earlyFlags.set(a,{target:t,weapon:d,action:act&&act.id,flags:c});return !!(c.forceHit||c.forceHeavy);
  }
  wrap('playerAttack',function(native){return function(){
    var a=owner(),d=mainWeapon(a)||{};if(!enabled()||!runtime().sources(a).length)return native.apply(this,arguments);
    var self=this,args=arguments,act=runtime().action();
    try{return act?native.apply(self,args):withAction(d,null,'normal',function(){return native.apply(self,args);},a);}
    finally{earlyFlags.delete(a);}
  };});
  function physicalResult(result, c, d) {
    if (!result) return result;
    result.relicFlags = Object.assign({}, c); result.relicGuaranteed = !!c.relicGuaranteed;
    result.targetHpBefore = c.targetHpBefore; result.element = c.element || d.ele || 'none';
    result.damageType = c.damageType || 'physical'; result.origin = c.origin;
    result.main = c.main; result.doubleBlade = !!result.dualx2;
    if (result.dualx2 && d.relicDoubleBladeMult) result.dmg = Math.max(1, result.dmg / 2 * d.relicDoubleBladeMult);
    return result;
  }
  wrap('getPhysicalDmg', function (native) { return function () {
    var args = Array.prototype.slice.call(arguments), d = args[2]||{}, a = owner();
    if (!enabled() || !a || !runtime().sources(a).length) return native.apply(this, args);
    var r = runtime(), previousAction = r.action(), temporaryAction = !previousAction;
    if (temporaryAction) r.setAction(r.nextAction(a, 'normal'));
    var act = r.action(), origin = act.nativeOrigin || act.origin || 'normal', probe = !!args[10];
    var c = physicalFlags(a, args[1], d, origin, probe), oldExtraHit = a.d.extraHit;
    var oldCalc = act.calculatingPhysical, wasForced = !!(args[4] || args[5] || args[6]);
    var stack = { flags: c, weapon: d, target: args[1], probe: probe, forced: wasForced,
      ignoreFlat: !!(act.context && (act.context.damageType === 'true' || act.context.ignoreFlatReduction)) };
    if (!probe) {
      if (origin !== 'counter') args[4] = args[4] || c.forceHeavy;
      args[6] = args[6] || c.forceHit; args[7] = args[7] || c.forceCritical;
      a.d.extraHit = number(oldExtraHit) + number(c.hitBonus) + Math.floor(number(a.lv, 1) / number(d.relicLevelDiv, 1)) * number(d.relicLevelHit);
      if (a.buffs && a.buffs.haste > 0 && d.hasteStrike && d.relicHasteStrikeHit) a.d.extraHit += d.relicHasteStrikeHit - 30;
    }
    physical.push(stack); act.calculatingPhysical = true;
    try { return physicalResult(native.apply(this, args), c, d); }
    finally { physical.pop(); a.d.extraHit = oldExtraHit; act.calculatingPhysical = oldCalc; if (temporaryAction) r.setAction(previousAction); }
  }; });

  function allyFlags(a,t,d) {
    if (!enabled() || !runtime().sources(a).length) return {};
    var c=physicalFlags(a,t,d,'normal',false); allyFlagsByActor.set(a,{target:t,weapon:d,flags:c}); return c;
  }
  function allyResultFlags(a,t,d) {
    var old=allyFlagsByActor.get(a); return old&&old.target===t&&old.weapon===d?old.flags:{};
  }
  function allyHitBonus(a,d,flags) {
    if(!enabled()||!d)return 0;
    var n=number(flags&&flags.hitBonus)+Math.floor(number(a.lv,1)/number(d.relicLevelDiv,1))*number(d.relicLevelHit);
    if(a.buffs&&a.buffs.haste>0&&d.hasteStrike&&d.relicHasteStrikeHit)n+=d.relicHasteStrikeHit-30;
    return n;
  }
  function allyHitRoll(first,d,flags) {
    if(!enabled())return first;
    var c={flags:flags||{},weapon:d,probe:false,forced:false}; physical.push(c);
    try{return hitRoll(first,d);}finally{physical.pop();}
  }
  function allyFlatReduction(a,t,d,value) {
    if(!enabled())return value;var c=allyResultFlags(a,t,d),act=runtime().action();
    if(c.ignoreFlatReduction||c.damageType==='true'||d&&d.relicMainTrue||act&&act.context&&(act.context.ignoreFlatReduction||act.context.damageType==='true'))return 0;
    return flatReduction(t,d,value);
  }
  function allyDoubleDamage(amount,d,yes) { return enabled()&&yes&&d&&d.relicDoubleBladeMult?amount*d.relicDoubleBladeMult/2:amount; }
  function allyMiss(a,t,d) { if(enabled())runtime().dispatch('miss',Object.assign({},allyResultFlags(a,t,d),{actor:a,target:t,weapon:d,channelKey:key(d),main:true,origin:'normal',damage:0})); }
  function deferPhysicalMark(a,t,element) { return enabled()?1:consumeWetMult(t,element); }
  wrap('allyAttackOnce',function(native){return function(a){
    var d=mainWeapon(a)||{};if(!enabled()||!runtime().sources(a).length)return native.apply(this,arguments);
    var self=this,args=arguments,old=allyFlagsByActor.get(a);
    try{return withAction(d,null,'normal',function(){return native.apply(self,args);},a);}
    finally{if(old)allyFlagsByActor.set(a,old);else allyFlagsByActor.delete(a);}
  };});
  wrap('allyStrikeRoll',function(native){return function(a,t,opts){
    var d=opts&&opts.wpnInst?DB.items[opts.wpnInst.id]:mainWeapon(a);if(!enabled()||!equipped(d))return native.apply(this,arguments);
    var act=runtime().action(),origin=act&&act.origin||'proc',c=physicalFlags(a,t,d,origin,!!(opts&&opts.probe)),old=a.d.extraHit;
    opts=Object.assign({},opts||{});if(!opts.noHeavy)opts.forceHeavy=opts.forceHeavy||c.forceHeavy;
    opts.forceHit=opts.forceHit||c.forceHit;opts.forceCrit=opts.forceCrit||c.forceCritical;
    var stack={flags:c,weapon:d,target:t,probe:!!opts.probe,forced:!!(opts.forceHeavy||opts.forceHit),ignoreFlat:!!(act&&act.context&&(act.context.ignoreFlatReduction||act.context.damageType==='true'))};
    a.d.extraHit=number(old)+allyHitBonus(a,d,c);physical.push(stack);
    try{return physicalResult(native.call(this,a,t,opts),c,d);}finally{physical.pop();a.d.extraHit=old;}
  };});

  function counterChance(a, kind, fallback) {
    var d = mainWeapon(a); if (!enabled() || !d) return fallback == null ? .5 : fallback;
    if (d.relicNoCounter) return 0;
    var value = kind === 'iai' ? d.relicIaiRate : d.relicCounterRate;
    return value == null ? (fallback == null ? .5 : fallback) : Math.max(0, Math.min(1, value / 100));
  }
  function counterReady(a, kind, blocked) {
    var d = mainWeapon(a); if (enabled() && d && d.relicNoCounter) return false;
    return !!blocked || mastery('k_counter',a) || Math.random() < counterChance(a, kind, .5);
  }
  function counter(t, isIai, actor) {
    var a = actor || owner(), d = mainWeapon(a), r = runtime(), origin = isIai ? 'iai' : 'counter';
    if (!alive(a) || a.classicMode || !alive(t) || d.relicNoCounter) return;
    return withAction(d, t, origin, function (c, act) {
      var count = Math.max(1, Math.min(10, number(isIai ? d.relicIaiCount : d.relicCounterCount, 1))), dealt = 0;
      for (var i = 0; i < count && alive(a) && alive(t); i++) {
        var flags = context(d, t, origin, { actor:a, damage: 1, snapshot: 1, main: false, barrier: !!(a.buffs && a.buffs.sk_counter_barrier > 0) });
        if (isIai && d.relicIaiIgnoreFlat) flags.ignoreFlatReduction = true;
        if (!isIai && d.relicCounterTrue) flags.damageType = 'true';
        weaponEvent('beforeCounter', flags); act.context = flags;
        var dice = t.s === 'L' ? d.dmgL : d.dmgS;
        var crit=mastery('k_counter',a)||!!(isIai&&d.iaiCrit);
        var res = a===owner()?getPhysicalDmg(dice,t,d,null,false,!isIai,isIai,crit):_allyStrikeWithIllu(a,t,{forceHit:true,noHeavy:!isIai,forceCrit:crit});
        var ratio = isIai ? (mastery('k_counter',a) ? 1.3 : 1) : (mastery('k_counter',a) ? .65 : .5);
        var tags = typeof getWeaponTags === 'function' ? getWeaponTags(a.eq.wpn.id) : [];
        if (flags.barrier && (isIai ? tags.indexOf('武士刀') >= 0 : tags.indexOf('單手劍') >= 0 || d.counterBarrierX2 || d.relicCounterBarrierMult)) ratio *= d.relicCounterBarrierMult || 2;
        ratio *= number(isIai ? d.relicIaiDamageMult : d.relicCounterDamageMult, 1);
        if (!isIai && d.relicCounterStepAdd) ratio *= 1 + i * d.relicCounterStepAdd;
        var amount = Math.max(1, Math.floor(res.dmg * ratio * flags.damage));
        c = Object.assign(flags, { damage: amount, snapshot: amount, critical: !!res.crit, heavy: !!res.heavy, element: res.element || d.ele || 'none' });
        c.actualDamage = runDamage(t, amount, d, origin, { actor:a, type: c.damageType, element: c.element });
        dealt += c.actualDamage;
        if (!alive(a)) break;
        if (alive(t) && typeof wearHardSkin === 'function') wearHardSkin(t, null, !!(isIai && res.heavy), false, mastery('k_counter',a));
        weaponEvent('counter', c); log(isIai ? '居合' : '反擊', t, c.actualDamage);
      }
      return dealt;
    },a);
  }
  ['procCounter', 'procIai'].forEach(function (name) { wrap(name, function (native) { return function (t) {
    if (!enabled() || !equipped(mainWeapon())) return native.apply(this, arguments);
    return counter(t, name === 'procIai');
  }; }); });
  ['allyReactCounter','allyReactIai'].forEach(function(name){wrap(name,function(native){return function(t,blocked){
    if(!enabled()||!owner()||!owner().allies)return native.apply(this,arguments);
    var a=owner(),allies=a.allies,selected=allies.filter(function(x){return equipped(mainWeapon(x));}),isIai=name==='allyReactIai';
    if(!selected.length)return native.apply(this,arguments);
    a.allies=allies.filter(function(x){return !equipped(mainWeapon(x));});
    try{native.apply(this,arguments);}finally{a.allies=allies;}
    selected.forEach(function(x){
      if(!alive(x)||x._downed||x.classicMode||!alive(t))return;
      var d=mainWeapon(x),tags=getWeaponTags(x.eq.wpn.id),shield=x.eq.shield&&!(typeof _isArmguard==='function'&&_isArmguard(x.eq.shield));
      if(isIai){if(shield||tags.indexOf('武士刀')<0)return;}
      else{if(!(tags.indexOf('單手劍')>=0||x.buffs&&x.buffs.sk_counter_barrier>0&&d.w2h))return;if(tags.indexOf('武士刀')>=0&&!shield)return;}
      if(counterReady(x,isIai?'iai':'counter',!isIai&&blocked))counter(t,isIai,x);
    });
  };});});

  function magicStrike(t, spread, actor) {
    var a = actor || owner(), d = mainWeapon(a); if (!alive(a) || !alive(t)) return 0;
    return withAction(d, t, 'magicStrike', function (c) {
      var res = a===owner()?getPhysicalDmg(t.s === 'L' ? d.dmgL : d.dmgS, t, d, null, true):_allyStrikeWithIllu(a,t,{forceHeavy:true});
      if(a!==owner())res.dmg*=elementCounterMult(res.element||d.ele||'none',t.e)*royalAllyMult();
      c.damage = c.snapshot = res.dmg; c.critical = !!res.crit; c.heavy = true; c.main = false;
      weaponEvent('beforeSkill', c); c.snapshot = c.damage;
      c.actualDamage = runDamage(t, c.damage, d, 'magicStrike', { actor:a, element: res.element });
      if (alive(a)) weaponEvent('magicStrike', c); log(spread ? '擴散魔擊' : '魔擊', t, c.actualDamage);
      if (!spread && alive(a) && mastery('m_strike',a)) targets().forEach(function (x) { if (alive(a)) magicStrike(x, true,a); });
      return c.actualDamage;
    },a);
  }
  wrap('_allyMagicStrikeHit',function(native){return function(a,t,inst,d){return enabled()&&equipped(d)?magicStrike(t,false,a):native.apply(this,arguments);};});
  wrap('procMagicStrike', function (native) { return function (t, spread) {
    return enabled() && equipped(mainWeapon()) ? magicStrike(t, spread) : native.apply(this, arguments);
  }; });
  wrap('magicStrikeProc', function (native) { return function (t) {
    var a = owner(), d = mainWeapon(a); if (!enabled() || !equipped(d)) return native.apply(this, arguments);
    if (!a || a.classicMode || !(d.eff === 'magicstrike' || d.relicMagicStrike)) return;
    var chance = d.relicMagicStrikeRate == null ? number(a.d.str) / 60 : d.relicMagicStrikeRate / 100;
    if (Math.random() < chance) { var x = pick(t); if (x) return magicStrike(x, false); }
  }; });

  function boneLayers(target, d, add) {
    var cap = enabled() && d && d.relicBoneCap || 10;
    target._bonespike = Math.min(cap, number(target._bonespike) + number(add, 1)); return target._bonespike;
  }
  function boneBurst(target, result, d, actor) {
    if (!enabled() || !d || !d.bonespike || !alive(target) || !target._bonespike) return false;
    var count = target._bonespike, cap = d.relicBoneCap || 10;
    if (d.relicBoneCritOrFull && !result.crit && count < cap) return true;
    target._bonespike = 0;
    var n = runDamage(target, count * (d.relicBoneUnit || 20), d, 'bone', { actor:actor||owner(), type: d.relicBoneTrue ? 'true' : 'physical', element: 'none', react: false, settle: false });
    log('骨刺爆裂', target, n); return true;
  }
  function rapidfire(a,arrowData,forced,classicOk) {
    var d=mainWeapon(a);if(!alive(a)||a.classicMode&&!classicOk||!d.rapidfire||!forced&&roll(1,100)>d.rapidfire)return 0;
    var baseMax=mastery('e_rapid',a)?5:3,count=d.rapidCount?(d.rapidFixed?d.rapidCount:roll(1,Math.max(baseMax,d.rapidCount))):d.rapidMax?baseMax:roll(1,baseMax);
    return withAction(d,null,'rapidfire',function(c){
      if(d.rapidTrue)c.damageType='true';var total=0;
      for(var i=0;i<Math.min(50,count)&&alive(a);i++){
        var pool=targets();if(!pool.length)break;var t=pool[Math.floor(Math.random()*pool.length)],dice=t.s==='L'?d.dmgL:d.dmgS;
        if(arrowData)dice+=t.s==='L'?arrowData.dmgL||0:arrowData.dmgS||0;
        var res=a===owner()?getPhysicalDmg(dice,t,d,arrowData):allyStrikeRoll(a,t,{});if(!res.hit)continue;
        var ratio=a._setGale5?(mastery('e_rapid',a)?1:.8):mastery('e_rapid',a)?.5:.3;if(d.rapidArrowPct)ratio=Math.max(ratio,d.rapidArrowPct/100);
        var amount=Math.max(1,Math.floor(res.dmg*ratio));if(a!==owner())amount=Math.max(1,Math.floor(amount*elementCounterMult(res.element||d.ele||'none',t.e)*royalAllyMult()));
        var actual=runDamage(t,amount,d,'rapidfire',{actor:a,type:d.rapidTrue?'true':'ranged',element:res.element,kind:'ranged'});total+=actual;
        if(!alive(a))break;if(d.bonespike&&alive(t))boneLayers(t,d,1);log('連射',t,actual);
        if(a===owner()&&typeof moonburstProc==='function')moonburstProc(t);else if(d.eff==='moonburst'&&Math.random()<.08&&typeof allyProcMoonburst==='function')allyProcMoonburst(a,pick(t));
      }return total;
    },a);
  }
  wrap('rapidfireProc',function(native){return function(arrow,forced,classicOk){return enabled()&&equipped(mainWeapon())?rapidfire(owner(),arrow,forced,classicOk):native.apply(this,arguments);};});
  wrap('allyRapidfire',function(native){return function(a,forced,classicOk){return enabled()&&equipped(mainWeapon(a))?rapidfire(a,null,forced,classicOk):native.apply(this,arguments);};});

  function pierceTargets(indices, d, target, result, actor) {
    if (!enabled()) return indices;
    var count = result && result.relicFlags && result.relicFlags.pierceCount || d && d.relicPierceCount;
    if (!count) count = mastery('k_pierce',actor) ? indices.length : 1;
    var pool = indices.slice(), out = [];
    while (pool.length && out.length < count) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }
  function pierceDamage(amount, d, result) {
    if (!enabled()) return amount;
    var base = result && number(result.relicSnapshot || result.snapshot);
    if (base > 0 && result.dmg > 0) amount *= base / result.dmg;
    return Math.max(1, Math.floor(amount * number(d && d.relicPierceMult, 1)));
  }
  function pierceHit(target, amount, d, result, actor) {
    actor=actor||owner();
    return withAction(d, target, 'pierce', function (c) {
      c.snapshot = c.damage = amount; c.heavy = !!result.heavy; c.critical = !!result.crit;
      c.actualDamage = runDamage(target, amount, d, 'pierce', { actor:actor, settle: false });
      if (alive(actor)) weaponEvent('pierce', c); return c.actualDamage;
    },actor);
  }
  function cleaveDuration(d, fallback) { return enabled() && d && d.relicCleaveDuration ? d.relicCleaveDuration * 10 : fallback; }
  function cleaveSpeed(d, fallback) { return enabled() && d && d.relicCleavePct ? 1 / (1 + d.relicCleavePct / 100) : fallback; }
  function bluntTicks(d) { return enabled() && d && d.relicBluntSeconds ? d.relicBluntSeconds * 10 : 10; }
  function keepExpose(d) { return enabled() && !!(d && d.relicSlaughterKeepExpose); }
  function keepHaste(d) { return enabled() && !!(d && d.relicKeepHaste); }
  function hasStatus(target,kind) {
    return !!(target&&(enabled()?runtime().api.hasStatus(target,kind):target.st&&target.st[kind]>0));
  }
  wrap('magicAttrDefense',function(native){return function(target,ele){
    if(!enabled()||!target||!runtime().statusValue)return native.apply(this,arguments);
    var down=runtime().statusValue(target,ele+'ResistanceDown');if(!down)return native.apply(this,arguments);
    var field={earth:'resEarth',fire:'resFire',water:'resWater',wind:'resWind'}[ele];if(!field)return native.apply(this,arguments);
    var view=Object.assign({},target),stats=target.d?Object.assign({},target.d):view;stats[field]=number(stats[field])-down;if(target.d)view.d=stats;
    return native.call(this,view,ele);
  };});
  wrap('applyPlayerWeakExpose', function (native) { return function (target) {
    var d = mainWeapon(); if (!enabled() || !d || d.relicExposeChance == null) return native.apply(this, arguments);
    if (!alive(target) || !playerCanWeakExpose()) return;
    if (!(mastery('k_chainblade') || mastery('k_weakness')) && Math.random() * 100 >= d.relicExposeChance) return;
    target.weakExpose = Math.min(weakExposeMaxLayers(), number(target.weakExpose) + number(d.relicExposeLayers, 1));
  }; });
  wrap('effTwoHanded', function (native) { return function (d) { return enabled() && d && d.relicMandatoryTwoHand ? true : native.apply(this, arguments); }; });
  wrap('warriorDualWieldWpnOk', function (native) { return function (id) { return enabled() && DB.items[id] && DB.items[id].relicMandatoryTwoHand ? false : native.apply(this, arguments); }; });
  wrap('allyWarriorDualWieldWpnOk', function(native){return function(a,id){return enabled()&&DB.items[id]&&DB.items[id].relicMandatoryTwoHand?false:native.apply(this,arguments);};});
  wrap('playerAttackIntervalTicks', function (native) { return function () {
    var d = mainWeapon(); return enabled() && d && d.relicFixedAttackInterval ? Math.max(1, d.relicFixedAttackInterval * 10) : native.apply(this, arguments);
  }; });
  wrap('allyAttackIntervalTicks',function(native){return function(a){var d=mainWeapon(a);return enabled()&&d&&d.relicFixedAttackInterval?Math.max(1,d.relicFixedAttackInterval*10):native.apply(this,arguments);};});

  function weaponSources(a) { return runtime().sources(a).filter(function (s) { return s.catalogId <= 131; }); }
  function teamSources() {
    var r = runtime(), out = []; r.api.team().forEach(function (a) { weaponSources(a).forEach(function (s) { out.push({ owner: a, source: s, def: s.def }); }); }); return out;
  }
  function petBonus(p, field) {
    if (!enabled()) return 0; var n = 0, form = (p.form || '').replace(/^高等/, '');
    teamSources().forEach(function (x) {
      var d = x.def, generic = d.relicPetStats, specific = d.relicPartnerStats && (d.relicPartnerStats[p.form] || d.relicPartnerStats[form]);
      n += number(generic && generic[field]);
      // Core already consumes partnerHit; partnerDmg has no native consumer.
      if (specific) n += field === 'hit' && x.owner === owner() ? 0 : number(specific[field]);
      else if (field === 'dmg' && d.partnerDmg) n += number(d.partnerDmg[p.form] || d.partnerDmg[form]);
    }); return n;
  }
  function companionDamageMult(a, companion) {
    if (!enabled()) return 1; var n = 1;
    var best = {}; teamSources().forEach(function (x) { var k=x.source.key; best[k]=Math.max(best[k]||1,number(x.def.relicCompanionDamageMult,1)); });
    Object.keys(best).forEach(function(k){n*=best[k];}); return n;
  }
  function companionIncoming(entity, damage, attacker, kind) {
    if (!enabled() || !entity || !(damage > 0)) return damage;
    var amount = damage, r = runtime();
    teamSources().forEach(function (x) {
      if (!x.def.relicCompanionDeathGuard) return;
      var st = r.state(x.owner, x.source.key), guards = st.bridgeCompanionGuards || (st.bridgeCompanionGuards = new WeakSet());
      if (guards.has(entity)) amount = 0;
      else if (amount >= hp(entity)) { guards.add(entity); amount = Math.max(0, hp(entity) - 1); }
    });
    return amount;
  }
  wrap('petGearBonus', function (native) { return function (p) {
    var d = native.apply(this, arguments); if (!enabled() || !d) return d;
    d.dmg += petBonus(p, 'dmg'); d.hit += petBonus(p, 'hit'); return d;
  }; });
  wrap('petDerive', function (native) { return function (p) {
    var d = native.apply(this, arguments); if (!enabled() || !d) return d;
    d.dr += petBonus(p, 'dr'); var speed = 0;
    weaponSources(owner()).forEach(function (x) { speed += number(x.def.relicCompanionAttackSpeed); });
    if (speed) d.atkItv = Math.max(1, d.atkItv / (1 + speed / 100)); return d;
  }; });
  wrap('petMhpEff', function (native) { return function (p) { return native.apply(this, arguments) + (enabled() ? petBonus(p, 'mhp') : 0); }; });
  function magicBurst(d, burst, skill, spellTargets, actor) {
    if (!enabled() || !equipped(d) || d.relicMagicBurstRatio == null) return false;
    var a = actor || owner(); if (!alive(a) || a.classicMode || !(burst > 0)) return true;
    var ms = mastery('m_strike',a), aoe = skill.target === 'all' || spellTargets.length > 1;
    var chance = d.relicMagicBurstAlways ? 1 : ms ? number(a.d.str) / 60 : number(a.d.int) / (aoe ? 60 : 100);
    if (Math.random() >= chance) return true;
    if (ms) { var t = pick(spellTargets[0]); if (t) magicStrike(t, false,a); return true; }
    withAction(d, spellTargets[0], 'magicBurst', function () {
      var pool = targets(), portion = burst * d.relicMagicBurstRatio / (d.relicMagicBurstAll ? 1 : Math.max(1, pool.length));
      pool.forEach(function (t, i) {
        if (!alive(a)) return; var n = Math.max(1, Math.floor(portion * (typeof fragileMult === 'function' ? fragileMult(t) : 1)));
        if(a!==owner()){n*=royalAllyMult();if(typeof _allyIllusionMagicDmg==='function')n=_allyIllusionMagicDmg(a,n,i===0);}else if(typeof illusionMagicDmg==='function')n=illusionMagicDmg(n,true,i===0);
        log('魔爆', t, runDamage(t, n, d, 'magicBurst', { actor:a, type: 'magic', element: 'none', react: false }));
      });
    },a); return true;
  }
  function dualSpell(target, d, parts, multiplier, generated, actor) {
    var a=actor||owner();if (!enabled() || !alive(target)||!alive(a)) return 0;
    return withAction(d, target, 'proc', function (c) {
      c.skillName = '熾焰地裂術'; c.dualSpell = true; c.generated = !!generated; c.damageType = 'magic'; c.kind = 'magic'; c.main = false;
      var total = 0;
      (parts || (d.procDualSkill && d.procDualSkill.parts) || []).forEach(function (part) {
        if (!alive(target) || !alive(a)) return;
        var ele = part[2] || 'none', mr = target.st && target.st.mrhalf > 0 ? target.mr / 2 : target.mr;
        var amount = Math.max(1, Math.floor(roll(part[0], part[1]) * weaponMagicDamageCoef(a.d, d, target, ele) * mrMult(mr)));
        amount = Math.max(1, Math.floor(amount * elementCounterMult(ele, target.e) * number(multiplier, d.relicDualSpellMult || 1)));
        if(a!==owner()){amount*=royalAllyMult();if(typeof W.__afkIlluWpnFix==='function'&&W.__afkIlluWpnFix())amount=_allyIllusionMagicDmg(a,amount);}else if(typeof W.__afkIlluWpnFix==='function'&&W.__afkIlluWpnFix())amount=illusionMagicDmg(amount,true);
        total += runDamage(target, amount, d, 'proc', { actor:a, type: 'magic', element: ele, settle: false });
      });
      c.actualDamage = c.damage = c.snapshot = total;
      if (alive(a)) weaponEvent('skill', c);
      if (!alive(target) && !target._dead && alive(a) && typeof killMob === 'function') { var idx = mapState.mobs.indexOf(target); if (idx >= 0) killMob(idx); }
      log('熾焰地裂術', target, total); return total;
    },a);
  }
  function nativeSpellHit(target, amount, skill, extra) {
    if (!enabled()) return amount; return runtime().spellDamage(owner(), target, amount, skill, extra);
  }
  function nativeSpellAfter(target, amount, kind) {
    if (!enabled()) return;
    var r=runtime(),act=r.action(),relic=equipped(mainWeapon())||act&&r.byKey&&r.byKey[act.source];
    if (relic&&act&&act.reflection){if(typeof terrorVisageOnDamage==='function')terrorVisageOnDamage(target,amount,kind||'magic');}
    else if (relic&&typeof reflectWallOnDamage === 'function') reflectWallOnDamage(target, amount, kind || 'magic', null);
    if (r.flushSpellHits) r.flushSpellHits(act);
  }
  function allySpellHit(a,t,amount,sk,d,extra) {
    if(!enabled()||!equipped(d))return false;
    amount=Math.max(1,Math.floor(amount*royalAllyMult()));
    amount=runtime().spellDamage(a,t,amount,sk,extra||{});
    runDamage(t,amount,d,extra&&extra.origin||'proc',{actor:a,type:'magic',element:sk&&sk.ele||'none',react:false,settle:false});
    runtime().flushSpellHits(runtime().action());
    if(alive(a)&&!alive(t)&&!t._dead){var idx=mapState.mobs.indexOf(t);if(idx>=0)killMob(idx);}
    return true;
  }
  // Free casts have a distinct source action; native elemental consumption is
  // deferred until spellDamage has captured the final pre-reaction snapshot.
  [['procFreeMagicSkill',0,4,1],['_procWeaponSpellHit',0,-1,-1],['allyProcFreeMagicSkill',1,5,2],['_allyProcWeaponSpellHit',1,-1,-1],['allyProcLightArrow',1,-1,-2],['allyProcMoonburst',1,-1,-3]].forEach(function(spec){
    wrap(spec[0],function(native){return function(){
      var args=arguments,a=spec[0].indexOf('ally')>=0||spec[0].indexOf('_ally')>=0?args[0]:owner(),d=spec[2]>=0?args[spec[2]]:mainWeapon(a);
      if(!enabled()||!equipped(d))return native.apply(this,args);
      var self=this,previous=runtime().action(),target=args[spec[1]],origin=spec[3]===-2?'resonance':'proc';
      var area=spec[0]==='procFreeMagicSkill'?args[3]:spec[0]==='allyProcFreeMagicSkill'?args[4]:spec[3]===-1;
      if(area&&previous&&previous._relicCastFn===spec[0]&&previous.source===key(d))return native.apply(self,args);
      return withAction(d,target,origin,function(c,act){
        act.calculatingSpell=true;act._relicCastFn=spec[0];c.ignoreMr=!!(previous&&previous.context&&previous.context.ignoreMr);
        if(spec[3]>=0)c.skillId=args[spec[3]];else if(spec[3]===-2)c.skillId='sk_lightarrow';
        return native.apply(self,args);
      },a);
    };});
  });
  [['procWeaponSpell','_procWeaponSpellHit'],['allyProcWeaponSpell','_allyProcWeaponSpellHit']].forEach(function(names){
    wrap(names[0],function(native){return function(){var args=arguments,a=names[0]==='procWeaponSpell'?owner():args[0],d=mainWeapon(a);if(!enabled()||!equipped(d))return native.apply(this,args);var self=this,previous=runtime().action();return withAction(d,args[a===owner()?0:1],'proc',function(c,act){act.calculatingSpell=true;act._relicCastFn=names[1];c.ignoreMr=!!(previous&&previous.context&&previous.context.ignoreMr);return native.apply(self,args);},a);};});
  });
  function elementalDamage(a,t,amount,ele,d) {
    if(!enabled()||!equipped(d))return false;
    runDamage(t,amount,d,'element',{actor:a,type:'magic',element:ele,settle:false});return true;
  }
  wrap('procLightArrow', function (native) { return function (t) {
    var d = mainWeapon(); if (!enabled() || !equipped(d)) return native.apply(this, arguments);
    var self = this, args = arguments; return withAction(d, t, 'resonance', function (c) { c.skillId = 'sk_lightarrow'; return native.apply(self, args); });
  }; });
  wrap('_relicOnHurtCast', function (native) { return function () {
    var d = mainWeapon(); if (!enabled() || !equipped(d) || !d.relicCastMult) return native.apply(this, arguments);
    // The runtime applies beforeSkill from this source; no second multiplier here.
    var self = this, args = arguments; return withAction(d, args[0], 'proc', function () { return native.apply(self, args); });
  }; });

  function nativeExecute(a,t,d,res) {
    var p=d.procInstakill, idx=mapState.mobs.indexOf(t), yes=false;
    if(idx<0||!alive(t)||t.boss||t.trollPlayer)return false;
    if(p&&(!p.maxLv||t.lv<=p.maxLv)&&(!p.hardOnly||number(t.hardSkinMax)>0)&&(!p.hpBelow||hp(t)<=Math.max(1,Math.floor(t.hp*p.hpBelow)))) {
      if(typeof tryInstakill==='function')yes=tryInstakill(t,{p:p.p,tag:p.tag||null},d.n,idx);
      if(yes){if(p.healPct)procHeal(a,Math.max(1,Math.floor(t.hp*p.healPct)),d);if(p.hasteSec)a._crushFuryTicks=p.hasteSec*10;return true;}
    }
    if(d.stoneInstakill&&t.st&&t.st.stone>0&&typeof tryInstakill==='function')return tryInstakill(t,{p:1,tag:null},d.n,idx);
    if(d.crushInstakill&&res.heavy&&t.lv<a.lv&&runtime().api.cooldown(a,key(d),'nativeExecute',d.crushInstakill.cdSec||3)&&typeof tryInstakill==='function'){
      yes=tryInstakill(t,{p:1,tag:null},d.n,idx);if(yes&&d.crushInstakill.healHp)procHeal(a,d.crushInstakill.healHp,d);return yes;
    }
    return false;
  }
  function nativeHitTails(a,t,d,res,ref,arrow) {
    var r=runtime(),tags=getWeaponTags(ref.id),en=capWpnEn(ref.en||0),actual=res.actualDamage||0;
    if(d.eff==='mp_drain'||d.mpOnHit)r.api.mp(a,mpOnHitAmount(d,en));
    if(d.vampPct)procHeal(a,Math.floor(actual*d.vampPct),d);
    if(d.hpOnHit)procHeal(a,d.hpOnHit,d);
    if(d.procHealFlat&&Math.random()*100<d.procHealFlat.rate)procHeal(a,d.procHealFlat.hp,d);
    if(d.hasteStrike&&!keepHaste(d)&&a.buffs)a.buffs.haste=0;
    if(res.crit&&typeof grantCritFuryHaste==='function')grantCritFuryHaste(a,d);
    if(res.heavy&&d.eff==='cleave'&&!a.classicMode){var ticks=cleaveDuration(d,mastery('k_cleave',a)?40:20);if(a===owner()){a.statuses=a.statuses||{};a.statuses.cleave=ticks;}else a._cleaveTicks=ticks;}
    if(alive(t)) {
      var blunt=!a.classicMode&&tags.indexOf('單手鈍器')>=0;
      if(blunt&&!t._bluntDelayed){t._atkCd=number(t._atkCd,Math.max(1,number(t.atkSpd,2)*10))+bluntTicks(d);t._bluntDelayed=true;t._bluntShow=state.ticks+30;}
      if(typeof wearHardSkin==='function')wearHardSkin(t,ref.id,res.heavy,blunt,true,a.classicMode);
      boneBurst(t,res,d,a);
      if(a===owner()&&!d.ranged&&typeof applyPlayerWeakExpose==='function')applyPlayerWeakExpose(t);
      else if(d.weakExpose&&!d.ranged&&Math.random()*100<(d.relicExposeChance||12))t.weakExpose=Math.min(mastery('k_chainblade',a)?5:3,number(t.weakExpose)+number(d.relicExposeLayers,1));
      if(!d.relicOwnsBleed&&!a.classicMode&&typeof weaponHasBleed==='function'&&weaponHasBleed(ref.id)&&Math.random()<(d.relicPlus>=10?1:number(a.d.str)/60))r.api.dot(t,'bleed',{owner:a,source:key(d),ascended:d.relicAsc!=null,layers:1,damage:(res.relicSnapshot||res.dmg)*(.2+number(d.relicBleedBonus)/100),duration:8,cap:50});
      if(d.onHitEleDmg&&(!d.onHitEleDmg.rate||Math.random()*100<d.onHitEleDmg.rate))runDamage(t,d.onHitEleDmg.dmg,d,'element',{actor:a,type:'magic',element:d.onHitEleDmg.ele,react:true});
      if(d.procBurn&&Math.random()*100<d.procBurn.rate)r.api.dot(t,'burn',{owner:a,source:key(d),ascended:d.relicAsc!=null,layers:1,damage:d.procBurn.dmg||10,duration:d.procBurn.dur||5,element:'fire'});
      if(d.procPoisonPct&&Math.random()*100<d.procPoisonPct.rate)r.api.dot(t,'poison',{owner:a,source:key(d),ascended:d.relicAsc!=null,layers:1,damage:(res.relicSnapshot||res.dmg)*(d.procPoisonPct.pct||.2),duration:d.procPoisonPct.dur||10,cap:50});
      if(d.onHitCastSkill&&r.api.cooldown(a,key(d),'nativeOnHitCast',d.onHitCastSkill.cdSec||5)){
        if(a===owner())procFreeMagicSkill(t,d.onHitCastSkill.skId,en,false,d);else allyProcFreeMagicSkill(a,t,d.onHitCastSkill.skId,en,false,d);
      }
      if(d.meleeHitSpell&&!d.ranged){if(a===owner()&&typeof laiaWandHitProc==='function')laiaWandHitProc(t);else if(a!==owner()&&typeof allyLaiaWandHitProc==='function')allyLaiaWandHitProc(a,t);}
      if(d.traumaProc&&Math.random()*100<d.traumaProc.pct){var tp=d.traumaProc,old=t._trauma&&t._trauma.until>state.ticks?t._trauma.s:0;t._trauma={s:Math.min(tp.maxStacks||2,old+1),dmg:tp.dmg||5,until:state.ticks+(tp.dur||6)*10};}
    }
    if((d.eff==='pierce'||d.alsoPierce)&&(!a.classicMode||d.classicOk)&&Math.random()*100<number(d.pierceChance,100)){
      var pool=targets().filter(function(x){return x!==t;}),chosen=pierceTargets(pool,d,t,res,a),amount=(res.relicSnapshot||res.dmg)*number(d.pierceSubMult,1)*number(d.relicPierceMult,1);
      chosen.forEach(function(x){if(!alive(a))return;var pr=a===owner()?getPhysicalDmg(x.s==='L'?d.dmgL:d.dmgS,x,d,arrow,false,false,false,false,ref,false,true):allyStrikeRoll(a,x,{probe:true});if(pr.hit)pierceHit(x,Math.floor(amount),d,res,a);});
    }
  }
  // A finite primary channel. Generated defense strikes explicitly suppress
  // primary callbacks and native procs; equipment/stat references always restore.
  function nativeSegment(target,d,inst,options) {
    options=options||{};var a=options.actor||owner();
    if(!enabled()||!d||!alive(target)||!alive(a))return 0;
    var r=runtime(),k=key(d)||inst&&inst.id,oldRef=a.eq.wpn,oldDef=DB.items[k],previous=r.action(),origin=options.origin||'normal';
    var ref=Object.assign({},inst||{},{id:k,_relicProjection:true}),localStats={},hitField=d.ranged?'rangedHit':'meleeHit',damageField=d.ranged?'rangedDmg':'meleeDmg';
    [hitField,damageField].forEach(function(f){localStats[f]=a.d[f];});
    if(previous&&previous.gm){a.d[hitField]=number(a.d[hitField])+number(d.hit)+(d.ranged?number(d.bowHit):0)+(d.lvHitDiv?Math.floor(number(a.lv,1)/d.lvHitDiv):0);a.d[damageField]=number(a.d[damageField])+number(d.dmgBonus)+(d.ranged?number(d.bowDmg):0)+(d.lvDmgDiv?Math.floor(number(a.lv,1)/d.lvDmgDiv):0);}
    DB.items[k]=d;a.eq.wpn=ref;
    try{return withAction(d,target,origin,function(c,action){
      action.channelKey=k;action.noProc=!!options.noProc;action.weapon=d;
      var arrow=d.ranged&&a.eq.arrow?DB.items[a.eq.arrow.id]:null,dice=target.s==='L'?d.dmgL:d.dmgS,res;
      if(d.qigu){
        var flags=options.noProc?context(d,target,origin,{actor:a,main:false}):qiguFlags(a,target,d),ele=flags.element||d.ele||'none',mr=target.st&&target.st.mrhalf>0?target.mr/2:target.mr;
        var raw=magicBaseDamage(roll(1,dice),a.d,a.d.extraDmg||0,true)*qiguCoef(a,d,target,ele);
        var crit=!!(flags.forceCritical||options.critical);if(crit)raw*=1+number(a.d.magicCritDmg)/100;
        var n=raw*(mastery('i_qigu',a)?1:mrMult(spellMr(a,d,'@qigu',mr)))*elementCounterMult(ele,target.e)*wpnEnFinalMult(ref)*(a===owner()?rlFuryMult():allyRlFuryMult(a))*fragileMult(target)*illuLvMult(a);
        if(a!==owner())n*=royalAllyMult();
        res={hit:true,dmg:Math.max(1,Math.floor(n)),crit:crit,heavy:false,ranged:false,kind:'magic',damageType:d.relicMainTrue?'true':'magic',element:ele,relicFlags:flags};
      }else{
        if(arrow)dice+=target.s==='L'?arrow.dmgL||0:arrow.dmgS||0;
        res=a===owner()?getPhysicalDmg(dice,target,d,arrow,!!options.heavy,!!options.forceHit,false,!!options.critical,ref):allyStrikeRoll(a,target,{forceHeavy:!!options.heavy,forceHit:!!options.forceHit,forceCrit:!!options.critical});
        if(a!==owner())res.dmg*=elementCounterMult(res.element||d.ele||'none',target.e)*royalAllyMult();
        if(!res.hit&&d.missGrazeRate&&Math.random()*100<d.missGrazeRate&&a===owner())res=getPhysicalDmg(dice,target,d,arrow,false,false,false,false,ref,true);
      }
      if(!res.hit){if(!options.noProc)r.dispatch('miss',context(d,target,origin,{actor:a}));return 0;}
      if(!options.noProc&&nativeExecute(a,target,d,res))return 0;
      var hard=typeof mobHardSkin==='function'?mobHardSkin(target):0;res.hardSkinBefore=hard;
      if(d.hardSkinMult&&hard>0)res.dmg*=d.hardSkinMult;
      if(d.softMult&&hard<=0)res.dmg*=d.softMult;
      if(d.fullHpMult&&target.curHp===target.hp)res.dmg*=d.fullHpMult;
      if(d.raceBonus&&d.raceBonus.race===target.race)res.dmg*=d.raceBonus.mult;
      if(d.raceFlat&&d.raceFlat.race===target.race)res.dmg+=d.raceFlat.add;
      if(d.eleBonusDmg&&d.eleBonusDmg.ele===target.e)res.dmg+=d.eleBonusDmg.add;
      if(d.silencedBonusDmg&&target.st&&target.st.magicseal>0)res.dmg+=d.silencedBonusDmg;
      if(d.poisonedBonusDmg&&hasStatus(target,'poison'))res.dmg+=d.poisonedBonusDmg;
      if(d.slowedBonusDmg&&target.st&&target.st.slow>0)res.dmg+=d.slowedBonusDmg;
      if(d.pierceMainMult)res.dmg*=d.pierceMainMult;
      res.dmg*=number(options.mult,1);res.origin=origin;res.main=!options.noProc;
      if(!options.noProc)res.dmg=r.beforeHit(a,target,res.dmg,d,res);
      var actual=runDamage(target,res.dmg,d,origin,{actor:a,source:options.source||key(d),type:res.damageType==='true'?'true':d.qigu?'magic':d.ranged?'ranged':'physical',element:res.element,react:!!options.noProc,settle:false});res.actualDamage=actual;
      if(!alive(a))return actual;
      if(!options.noProc){
        r.afterHit(a,target,res.dmg,d);
        nativeHitTails(a,target,d,res,ref,arrow);
        if(alive(a)){
          if(a===owner()){
            if(typeof weaponSpellProc==='function')weaponSpellProc(target,true,ref);
            if(d.rapidfire)rapidfireProc(arrow);
            if(typeof magicStrikeProc==='function')magicStrikeProc(target);
            if(typeof wandLightArrowProc==='function')wandLightArrowProc(target);
            if(d.qigu&&typeof qiguWeaponProc==='function')qiguWeaponProc(target,d);
            if(d.dragonStrike&&typeof dragonStrikeProc==='function')dragonStrikeProc();
            if(d.dragonSlayStrike&&typeof dragonSlayStrikeProc==='function')dragonSlayStrikeProc();
          }else{
            if(typeof allyWeaponProcs==='function')allyWeaponProcs(a,target,{hit:true,dmg:res.dmg},ref);
            if(d.rapidfire&&typeof allyRapidfire==='function')allyRapidfire(a);
          }
          if(alive(target)&&Math.random()*100<comboTriggerChance(a,d,ref))combo(a,target,true);
        }
      }
      if(alive(a)&&!alive(target)&&!target._dead&&typeof killMob==='function'){var index=mapState.mobs.indexOf(target);if(index>=0)killMob(index);}
      return actual;
    },a);}finally{a.eq.wpn=oldRef;DB.items[k]=oldDef;Object.keys(localStats).forEach(function(f){a.d[f]=localStats[f];});r.setAction(previous);}
  }
  W.AFK_RELIC_WEAPON_BRIDGE = {
    version: 1, enabled: enabled, procHeal:procHeal,healingSpell:healingSpell,spellMr:spellMr,spellFlatReduction:spellFlatReduction,qiguCoef:qiguCoef,qiguFlags:qiguFlags,qiguCritMult:qiguCritMult,qiguRoll:qiguRoll,elementalDamage:elementalDamage,allySpellHit:allySpellHit,qiguBefore:qiguBefore,magicStrikeChance:magicStrikeChance,earlySureHit:earlySureHit, hasStatus:hasStatus, physicalFlags: physicalFlags, physicalResult: physicalResult,
    hitRoll: hitRoll, grazeHeavy: grazeHeavy, weaponRoll: weaponRoll, flatReduction: flatReduction,
    allyFlags:allyFlags,allyResultFlags:allyResultFlags,allyHitBonus:allyHitBonus,allyHitRoll:allyHitRoll,allyFlatReduction:allyFlatReduction,allyDoubleDamage:allyDoubleDamage,allyMiss:allyMiss,deferPhysicalMark:deferPhysicalMark,
    counterElementMult: counterElementMult, affix: affix, counterChance: counterChance, counterReady: counterReady,
    boneLayers: boneLayers, boneBurst: boneBurst, pierceTargets: pierceTargets, pierceDamage: pierceDamage, pierceHit: pierceHit,
    cleaveDuration: cleaveDuration, cleaveSpeed: cleaveSpeed, bluntTicks: bluntTicks, keepExpose: keepExpose, keepHaste: keepHaste,
    companionDamageMult: companionDamageMult, companionIncoming: companionIncoming, magicBurst: magicBurst,
    dualSpell: dualSpell, nativeSpellHit: nativeSpellHit, nativeSpellAfter: nativeSpellAfter, nativeSegment: nativeSegment
  };
})();
