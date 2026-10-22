/* Complete relic lifecycle integration. Native attacks still own hit rolls,
 * HP mutation, death/loot and skill/potion cooldowns; the runtime supplies
 * source-scoped effects at the anchored pre/post-damage seams. */
(function () {
  'use strict';
  var W=window,R=W.AFK_RELIC_RUNTIME;
  if(!R||typeof DB==='undefined')return;
  var api=R.api,native={},procDepth=0;
  function enabled(){return R.enabled();}
  function weapon(a){return a&&a.eq&&a.eq.wpn&&DB.items[a.eq.wpn.id];}
  function live(a){return !!(a&&!a.dead&&!a._downed&&api.hp(a)>0);}
  function wrap(name,make){var old=W[name];if(typeof old!=='function'||old._fullRelicIntegration)return;native[name]=old;var next=make(old);next._fullRelicIntegration=true;W[name]=next;}
  function locked(a){var b=R.state(a,'_buffs'),now=api.now();return Object.keys(b).some(function(k){return b[k].until>now&&(b[k].values.cannotAct||b[k].values.immobilized);});}
  function settle(){if(typeof mapState==='undefined'||typeof W.killMob!=='function')return;mapState.mobs.slice().forEach(function(m){if(m&&!m._dead&&api.hp(m)<=0){var i=mapState.mobs.indexOf(m);if(i>=0)W.killMob(i);}});}
  function attackAction(a,fn,self,args){
    if(!enabled())return fn.apply(self,args);
    if(!live(a)||locked(a))return;
    var prev=R.action(),w=weapon(a),act=R.nextAction(a,'normal');
    act.weapon=w;act.source=w&&w.relicBase;act.context={actor:a,weapon:w,sourceId:act.source,main:true,direct:true,origin:'normal'};
    if(W.AFK_RELIC_GM&&W.AFK_RELIC_GM.active(a)&&!(prev&&prev.gm)){
      var t=typeof getTarget==='function'?getTarget():api.targets()[0];
      var packet=W.AFK_RELIC_GM.packet(a,t);settle();return packet;
    }
    R.setAction(act);
    try{return fn.apply(self,args);}finally{R.finishAction(act);settle();R.setAction(prev);}
  }
  wrap('playerAttack',function(old){return function(){return attackAction(player,old,this,arguments);};});
  wrap('allyAttackOnce',function(old){return function(a){return attackAction(a,old,this,arguments);};});
  wrap('castSkill',function(old){return function(id){
    if(!enabled())return old.apply(this,arguments);
    if(!live(player)||locked(player))return false;
    var prev=R.action(),act=R.nextAction(player,typeof _autoCastNow!=='undefined'&&_autoCastNow?'auto':'normal'),sk=DB.skills[id],a=player;
    act.weapon=weapon(a);act.calculatingSpell=true;act.context={actor:a,skillId:id,skill:sk,main:false,direct:true,origin:act.origin};
    R.setAction(act);var result=false;
    try {result=old.apply(this,arguments);return result;}
    finally {
      R.finishAction(act);
      if(result){var c=Object.assign({},act.costContext||act.context,{actor:a,skillId:id,skill:sk,success:true,paidMp:act.paidMp||0,damage:act.damage||0,snapshot:act.snapshot||0,main:false,origin:act.origin});R.defenseEvent('onCast',c);}
      settle();R.setAction(prev);
    }
  };});
  function procAction(old,self,args,sourceItem){
    if(!enabled())return old.apply(self,args);
    var a=player;if(!live(a)||locked(a))return;
    var prev=R.action(),ctx=R.context(),w=sourceItem||ctx&&ctx.item||weapon(a);
    var reuse=prev&&prev.calculatingSpell&&prev.origin==='proc'&&prev.actor===a;
    var act=reuse?prev:R.nextAction(a,'proc');
    if(!reuse){act.weapon=w;act.source=w&&w.relicBase||ctx&&ctx.sourceId;act.context=Object.assign({},ctx||{},{actor:a,sourceId:act.source,item:w,asc:w&&w.relicAsc,main:false,direct:true,origin:'proc'});act.generated=true;act.calculatingSpell=true;act.reflection=!!(ctx&&ctx.origin==='reflection'||prev&&prev.reflection);R.setAction(act);}
    procDepth++;
    try{return old.apply(self,args);}finally{procDepth--;if(!reuse||procDepth===0)R.flushSpellHits(act);if(!reuse){settle();R.setAction(prev);}}
  }
  wrap('procFreeMagicSkill',function(old){return function(t,id,en,area,item){if(W.AFK_RELIC_WEAPON_BRIDGE&&item&&item.relicCatalogId<=131)return old.apply(this,arguments);return procAction(old,this,arguments,item);};});
  wrap('_procWeaponSpellHit',function(old){return function(){var w=weapon(player);if(W.AFK_RELIC_WEAPON_BRIDGE&&w&&w.relicCatalogId<=131)return old.apply(this,arguments);return procAction(old,this,arguments,null);};});
  wrap('rollHealingSpell',function(old){return function(sk,stats,caster,target){var v=old.apply(this,arguments),a=R.action();return enabled()&&a&&a.actor===caster&&a.healMult?Math.floor(v*a.healMult):v;};});
  wrap('_supHeal',function(old){return function(target,amount){
    if(!enabled()||!target)return old.apply(this,arguments);
    var c=R.context();if(c&&c.sourceId&&R.byKey[c.sourceId])return api.heal(target,amount,{owner:c.actor,source:c.sourceId});
    var n=R.foreignHeal(target,amount,'spell');
    if(W.AFK_RELIC_DEFENSE&&W.AFK_RELIC_DEFENSE.healingReduction)n*=1-Math.min(.75,W.AFK_RELIC_DEFENSE.healingReduction(target,api.now())||0);
    var result=old.call(this,target,n);R.foreignHealDone(target,n);return result;
  };});
  wrap('tryInstakill',function(old){return function(target){var a=R.action(),prev=a&&a.executionTarget;if(a)a.executionTarget=target;try{return old.apply(this,arguments);}finally{if(a)a.executionTarget=prev;}};});
  wrap('killMob',function(old){return function(idx){
    var m=mapState.mobs[idx];if(!enabled()||!m||m._dead)return old.apply(this,arguments);
    var a=R.action(),src=m._relicLastSource||{},killer=src.actor||a&&a.actor||player;
    var c={actor:killer,target:m,main:false,direct:false,origin:src.origin||a&&a.origin||'normal',wasStone:api.hasStatus(m,'stone'),wasBurning:api.hasStatus(m,'burn'),executed:!!(src.executed||a&&a.executionTarget===m),damage:a&&a.damage||0,snapshot:a&&a.snapshot||0};
    var result=old.apply(this,arguments);
    if(m._dead&&!m._relicKillDispatched&&m.race!=='建築'){
      R.transient(m,'_relicKillDispatched',true);
      if(live(killer))R.dispatch('onKill',c);
      // The death book observes a team kill. Other personal kill effects stay
      // with the actual attacker, including a mercenary or a companion owner.
      api.team().forEach(function(owner){if(owner===killer||!live(owner))return;var s=R.sources(owner).find(function(x){return x.catalogId===196;});if(s)R.dispatch('onKill',Object.assign({},c,{actor:owner}),s);});
    }
    return result;
  };});
  wrap('changeMap',function(old){return function(){var before=mapState.current,result=old.apply(this,arguments);if(enabled()&&before!==mapState.current)api.team().forEach(function(a){var s=R.state(a,'_movement');s.last=api.now();s.movingFor=0;R.dispatch('move',{actor:a,main:false});});return result;};});
  var attr=W.__afkAttrBoost;W.__afkAttrBoost=function(a,d){if(attr)attr.apply(this,arguments);R.earlyStats(a,d);};
  // The source-aware ceiling is installed after relicplus; these hooks remain
  // the same entry points used by the native engine and old saves.
  R.init();
  W.__afkRelicTier=R.configure;W.__afkRelicDmg=R.beforeHit;W.__afkRelicHit=R.afterHit;
  W.AFK_RELIC_INTEGRATION={version:1,settle:settle,native:native,locked:locked};
})();
