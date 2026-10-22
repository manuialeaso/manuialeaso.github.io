/* Card ascension combat. First damage belongs to one character/enemy pair,
 * including that character's companions. The native HP settlements call damage
 * exactly where their final positive amount is about to be subtracted.
 * All clocks use game ticks; this module creates no timer or save transaction.
 */
(function(W){
  'use strict';
  if(W.AFK_CARD_COMBAT)return;
  var ledger=new WeakMap(),targetTokens=new WeakMap(),scopes=[],lastTick=-1,sequence=0;
  var ATTR=['str','dex','con','int','wis','cha'];
  var RES=['resFire','resWater','resWind','resEarth','resNone'];
  var CRIT=['meleeCrit','rangedCrit','magicCrit'];
  var CRIT_DAMAGE=['meleeCritDmg','rangedCritDmg','magicCritDmg'];
  var RULES={mythic:{stat:20,resist:100,mult:5,crit:0,critDamage:0},celestial:{stat:30,resist:150,mult:10,crit:10,critDamage:0},spacetime:{stat:50,resist:200,mult:15,crit:15,critDamage:50},
    // 輪迴聖衣（玩家 2026-10-23）：封印＝時空效果＋最終減傷 100；解除封印＝能力 +100、五抗 +500、最終減傷 +500＋星座特殊能力。副本內無效果
    samsara:{stat:50,resist:200,mult:15,crit:15,critDamage:50,finalDR:100},samsaraOpen:{stat:100,resist:500,mult:15,crit:15,critDamage:50,finalDR:500}};
  // 封印的時空變身（碎片換得）效果減半
  function ruleFor(row,actor){
    var A=W.AFK_CARD_ASCENSION,se=!!(A&&A.sealed&&A.sealed(row.id,actor));
    if(row.tier==='samsara')return se?RULES.samsara:RULES.samsaraOpen;
    var r=RULES[row.tier];if(!se)return r;
    var h={};Object.keys(r).forEach(function(k){h[k]=r[k]/2;});h.half=true;return h;
  }
  function special(row,actor){var A=W.AFK_CARD_ASCENSION;return row&&row.tier==='samsara'&&!(A.sealed&&A.sealed(row.id,actor))?row.zodiac:null;}
  var playerNow=function(){return typeof player!=='undefined'?player:null;};
  var ticks=function(){return typeof state!=='undefined'?Number(state.ticks)||0:0;};
  var runtime=function(){return W.AFK_RELIC_RUNTIME;};
  var enabled=function(){return !!W.AFK_CARD_ASCENSION&&(!W.AFK_TOGGLES||W.AFK_TOGGLES.enabled('card-ascension'));};
  var hp=function(a){return a?Math.max(0,Number(a.curHp!=null?a.curHp:a.hp)||0):0;};
  var live=function(a){return !!(a&&!a.dead&&!a._dead&&!a._downed&&hp(a)>0);};
  function members(){var p=playerNow();return p?[p].concat(p.allies||[]).filter(live):[];}
  function active(actor){
    if(!enabled())return null;
    var row=W.AFK_CARD_ASCENSION.active(actor);
    if(!row||!RULES[row.tier])return null;
    if(row.tier==='samsara'&&inDungeon())return null;   // 輪迴聖衣：副本內沒有效果
    // Read the registered definition, never a caller-supplied tier or level.
    // 神話擴到 32 種後不再限 Lv70 以上（玩家 2026-10-23）
    return row;
  }
  function memory(actor){var s=ledger.get(actor);if(!s){s={seen:new WeakSet(),nextAt:-Infinity};ledger.set(actor,s);}return s;}
  // Native transformation replaces the monster object and UID. A separate
  // identity survives that replacement without retaining old phase objects or
  // writing combat history into saves. Unrelated spawns get a fresh token.
  function targetIdentity(target){
    if(!target||typeof target!=='object')return null;
    var token=targetTokens.get(target);if(!token){token={};targetTokens.set(target,token);}return token;
  }
  function inheritTarget(previous,next){
    var token=targetIdentity(previous);if(token&&next&&typeof next==='object')targetTokens.set(next,token);
    return next;
  }
  function enemy(target){return !!(target&&target!==playerNow()&&!target.eq&&live(target)&&typeof mapState!=='undefined'&&mapState.mobs&&mapState.mobs.indexOf(target)>=0);}
  function immune(target,opt){
    if(!target||!opt||!opt.nativeRefund)return false;
    var wall=target._reflectWall,kind=opt.kind;
    // Full direct-hit hooks always enter reflectWallOnDamage; the narrower
    // terror hook enters it only when a block wall exists. Older true damage,
    // DOT and pursuit paths have no refund at all. Keep their native behavior.
    if(target._dsHolyUntil&&ticks()<=target._dsHolyUntil&&(opt.nativeRefund==='full'||wall&&wall.block))return true;
    return !!(wall&&wall.block&&ticks()<=wall.until&&kind&&(wall.kind===kind||wall.kind==='phys'&&(kind==='melee'||kind==='ranged')));
  }
  function physicalKind(actor){var e=actor&&actor.eq&&actor.eq.wpn,d=e&&DB.items[e.id];return d&&(d.isBow||d.ranged)?'ranged':'melee';}
  function ownerOfEquipment(eq){var p=playerNow();return p&&p.eq===eq?p:p&&(p.allies||[]).find(function(a){return a&&a.eq===eq;})||p;}
  function scope(){return scopes[scopes.length-1]||null;}
  function currentActor(){var s=scope(),r=runtime(),a=r&&r.action&&r.action();return s&&s.actor||a&&a.actor||playerNow();}
  function sourceActor(src){
    if(src&&typeof src==='object'){
      if(src.cls)return src;
      if(src.owner&&src.owner.cls)return src.owner;
      if(src.slot!=null){var p=playerNow(),key=String(src.slot);return p&&(p.allies||[]).find(function(a){return a&&String(a._slot==null?a._allyName:a._slot)===key;})||null;}
    }
    return playerNow();
  }
  function reflected(opt){
    if(opt&&(opt.reflection||opt.redirected||opt.origin==='reflection'||opt.origin==='self'||opt.origin==='redirect'))return true;
    var r=runtime(),a=r&&r.action&&r.action(),c=r&&r.context&&r.context();
    return !!(a&&a.reflection||c&&(c.origin==='reflection'||c.origin==='self'||c.origin==='redirect'||c.redirected));
  }
  function noteSettlement(actor,target,before,after,opt){
    if(opt.packet){opt.packet.cardFirstMultiplier=after/before;opt.packet.cardFirstApplied=after!==before;}
    if(after===before)return;
    var r=runtime();if(!r)return;
    // Native spell queues keep the pre-reaction snapshot, but their damage and
    // actual-loss accounting must include this final card multiplier.
    var a=r.action&&r.action(),hs=a&&a.hits,hit=hs&&hs[hs.length-1];
    if(hit&&hit.actor===actor&&hit.target===target&&hit.damage===before){hit.damage=after;if(a)a.damage=(Number(a.damage)||0)+after-before;}
    var pending=r.state&&r.state(actor,'_attack').pending;
    if(pending&&pending.target===target&&pending.damage===before)pending.cardSettledDamage=after;
    var companions=r.state&&r.state(actor,'_companions').hits,last=companions&&companions[companions.length-1];
    if(last&&last.target===target&&last.damage===before)last.damage=after;
  }
  function damage(actor,target,amount,opt){
    opt=opt||{};
    if(!enabled()||!actor||!actor.cls||!enemy(target)||!(amount>0)||!Number.isFinite(Number(amount))||actor===target||reflected(opt)||immune(target,opt))return amount;
    var s=memory(actor),identity=targetIdentity(target),first=!s.seen.has(identity);
    var row0=active(actor),zs=special(row0,actor);
    if(zs&&!(opt.dotCapped)){var base=Number(amount);amount=zodiacHit(actor,target,base,zs,opt);if(amount!==base)noteSettlement(actor,target,base,amount,opt);}
    if(!first)return amount;
    // Mark only a real, positive settlement. An ordinary-form first hit also
    // spends this enemy's opportunity, so changing form cannot renew it.
    s.seen.add(identity);
    var row=row0,ctx=scope();if(!row)return amount;
    if(opt.inherited||ctx&&ctx.actor===actor&&ctx.inherited)return amount;
    if(row.tier==='spacetime'||row.tier==='samsara'){
      if(ticks()<s.nextAt)return amount;
      s.nextAt=ticks()+300;
    }
    var value=Number(amount)*(zs==='gemini'?30:ruleFor(row,actor).mult);
    if(opt.dotCapped){
      // The ordinary poison/bleed budget has already paid for amount. Only
      // request the extra part, preserving the same shared one-percent cap.
      var extra=value-amount,r=runtime();
      if(r&&r.enabled&&r.enabled()&&r.dotCap)extra=r.dotCap(target,extra,{ascended:!!opt.ascended});
      else if(typeof W.__afkDotCap==='function')extra=W.__afkDotCap(target,extra,{ascended:!!opt.ascended});
      value=Number(amount)+Math.max(0,Number(extra)||0);
    }
    if(ctx&&ctx.actor===actor)ctx.boosted.add(target);
    noteSettlement(actor,target,Number(amount),value,opt);
    return value;
  }
  // 解除封印的星座特殊能力（每次傷害結算）
  var stings=new WeakMap();
  function zodiacHit(actor,target,amount,z,opt){
    var v=amount;
    if(z==='leo'&&Math.random()<.1)v*=3;
    if(z==='scorpio'){var tok=targetIdentity(target),n=(stings.get(tok)||0)+1;if(n>=15){n=0;v*=15;}stings.set(tok,n);}
    if(z==='aquarius'&&!target.boss&&target.hp>0&&(target.curHp-v)<target.hp*.2)v=Math.max(v,target.curHp);
    if(z==='cancer'){var heal=Math.floor(Math.min(v,target.curHp)*.03);if(heal>0){if(actor===playerNow()){var mx=Number(actor.mhp)||0;actor.hp=Math.min(mx||actor.hp+heal,actor.hp+heal);}else if(actor.curHp!=null&&actor.mhp)actor.curHp=Math.min(actor.mhp,actor.curHp+heal);}}
    return v;
  }
  // 最終減傷（真實減傷）：所有減傷算完、被打的數值最後再扣（afk-arts 受傷補算時呼叫）
  function finalDR(actor){var row=active(actor);if(!row)return 0;var r=ruleFor(row,actor);return Number(r.finalDR)||0;}
  function finalBlock(actor){var row=active(actor);return special(row,actor)==='aries'&&Math.random()<.15;}
  function withScope(actor,fn,self,args){
    var previous=scope();if(previous&&previous.actor===actor)return fn.apply(self,args);
    scopes.push({id:++sequence,actor:actor,boosted:new WeakSet(),inherited:false});
    try{return fn.apply(self,args);}finally{scopes.pop();}
  }
  function withInherited(actor,targets,fn,self,args){
    var ctx=scope(),was=ctx&&ctx.inherited,inherit=ctx&&ctx.actor===actor&&(targets||[]).some(function(t){return t&&ctx.boosted.has(t);});
    if(inherit)ctx.inherited=true;
    try{return fn.apply(self,args);}finally{if(ctx)ctx.inherited=was;}
  }
  function inherited(actor,targets){var ctx=scope();return !!(ctx&&ctx.actor===actor&&(ctx.inherited||(targets||[]).some(function(t){return t&&ctx.boosted.has(t);})));}
  function forcedEquipment(actor){
    var G=W.AFK_RELIC_GM,eq=G&&G.realEquipment?G.realEquipment(actor):actor.eq||{};
    if(G&&G.armorActive&&G.armorActive(actor))return true;
    var counts={},seen={};Object.keys(eq).forEach(function(k){var it=eq[k],d=it&&DB.items[it.id];if(!d||k==='wpn'||k==='offwpn'||seen[it.id])return;seen[it.id]=true;if(d.set)counts[d.set]=(counts[d.set]||0)+1;});
    if(typeof W.__afkSetBoost==='function')W.__afkSetBoost(actor,counts);
    if(counts.dk>=4||counts.kurt>=4||counts.demon>=4||counts.darkelf>=3||counts.kenrauhel>=4||counts.cerenis>=4)return true;
    var w=eq.wpn&&DB.items[eq.wpn.id],id=w&&w.relicBase||eq.wpn&&eq.wpn.id;
    return !!(w&&(w.flameDkMorph||id==='wpn_cursed_emperor_blade'||id==='wpn_uncursed_emperor_blade'));
  }
  function prepareStats(actor){
    if(!enabled()||!actor||!actor.poly||!actor.buffs||!(actor.buffs.poly>0))return;
    // The native engine rebuilds _setPoly in Phase 3, after CON/WIS have
    // already produced HP/MP. Predict only its currently equipped sources so
    // the early attribute hook sees this equipment change immediately.
    actor._setPoly=forcedEquipment(actor)?actor._setPoly||{cardForcedPending:true}:null;
  }
  function earlyStats(actor,d){var row=active(actor);if(row){var st=ruleFor(row,actor).stat;ATTR.forEach(function(k){d[k]=(Number(d[k])||0)+st;});}}
  function lateStats(actor,d){
    if(d)d.finalDR=0;   // 最終減傷只有這裡給，每次重算歸零
    var row=active(actor);if(!row||!d)return;
    var rule=ruleFor(row,actor),half=rule.half?.5:1;RES.forEach(function(k){d[k]=(Number(d[k])||0)+rule.resist;});
    CRIT.forEach(function(k){d[k]=(Number(d[k])||0)+rule.crit;});CRIT_DAMAGE.forEach(function(k){d[k]=(Number(d[k])||0)+rule.critDamage;});
    if(row.bonus)Object.keys(row.bonus).forEach(function(k){d[k]=(Number(d[k])||0)+Math.floor(row.bonus[k]*half);});   // 每個變身的專屬效果（afk-card-forms）；封印減半
    if(rule.finalDR)d.finalDR=rule.finalDR;
    if(special(row,actor)&&row.specialBonus)Object.keys(row.specialBonus).forEach(function(k){d[k]=(Number(d[k])||0)+row.specialBonus[k];});
  }
  function monsterActive(actor){
    var A=W.AFK_CARD_ASCENSION,f=actor&&actor.poly;
    return !!(enabled()&&actor&&!actor._setPoly&&actor.buffs&&actor.buffs.poly>0&&f&&f.cardMonster&&A.canUseForm(f,actor));
  }
  function castInterval(actor,value){return Number(value)===0&&monsterActive(actor)?1:Math.max(1,Number(value)||12);}
  function inDungeon(){
    if(typeof mapState==='undefined')return false;var key=mapState.current||'';
    if(/^town_/.test(key))return false;
    if(typeof KING_ROOMS!=='undefined'&&KING_ROOMS[key])return true;
    if(typeof PURE_BOSS_MAPS!=='undefined'&&PURE_BOSS_MAPS.indexOf(key)>=0)return true;
    if(typeof ANTHARAS_AREA_BOSS!=='undefined'&&ANTHARAS_AREA_BOSS[key])return true;
    return !!(typeof state!=='undefined'&&(state.riftRun&&key==='rift_battle'||state.dreamStar||state.prideClimb));
  }
  function aura(actor,target){
    if(!enemy(target)||immune(target,{nativeRefund:'full'}))return 0;
    var row=active(actor),amount=damage(actor,target,row?500*(ruleFor(row,actor).half?.5:1):500,{kind:'true',origin:'cardAura'}),before=target.curHp;
    if(!(amount>0))return 0;
    target.curHp-=amount;target.justHit='magic';
    if(typeof W.mobWake==='function')W.mobWake(target);
    Object.defineProperty(target,'_relicLastSource',{value:{actor:actor,source:'card:spacetime',origin:'cardAura',ascended:false},configurable:true,writable:true,enumerable:false});
    if(typeof W._dpsCreditDot==='function')W._dpsCreditDot(actor===playerNow()?'player':typeof W._dpsAllySrc==='function'?W._dpsAllySrc(actor):'player',Math.min(before,amount));
    if(target.curHp<=0&&!target._dead&&typeof W.killMob==='function'){var i=mapState.mobs.indexOf(target);if(i>=0)W.killMob(i);}
    return Math.min(before,amount);
  }
  var wasDungeon=null;
  function tick(){
    var now=ticks();if(lastTick===now)return;lastTick=now;
    if(!enabled()||!state.running||now%10)return;
    var dg=inDungeon();
    if(wasDungeon!==null&&dg!==wasDungeon&&members().some(function(a){var f=a.poly;return f&&f.cardAscensionTier==='samsara';})){try{if(typeof W.calcStats==='function')W.calcStats();}catch(e){}}
    wasDungeon=dg;
    if(!dg){
      // 雙魚座：副本外每秒恢復 2% 最大 HP
      members().forEach(function(a){if(special(active(a),a)!=='pisces')return;if(a===playerNow()){var mx=Number(a.mhp)||0;if(mx)a.hp=Math.min(mx,a.hp+Math.ceil(mx*.02));}else if(a.mhp)a.curHp=Math.min(a.mhp,a.curHp+Math.ceil(a.mhp*.02));});
      return;
    }
    var originalMap=mapState.current;
    members().forEach(function(actor){var row=active(actor);if(!row||row.tier!=='spacetime')return;mapState.mobs.slice().forEach(function(m){if(mapState.current===originalMap&&live(actor))aura(actor,m);});});
  }
  function wrap(name,actorOf){var old=W[name];if(typeof old!=='function')return;W[name]=function(){return withScope(actorOf.apply(this,arguments),old,this,arguments);};}
  ['playerAttack','dualWieldOffhandAttack','castSkill','procFreeMagicSkill','procWeaponSpell','stormBuffTick','cubeTick','petAttackOnce','petCastSkill'].forEach(function(name){wrap(name,playerNow);});
  wrap('illuSummonTick',function(owner){return owner||playerNow();});
  wrap('summonTick',function(s,clear,owner){return owner||playerNow();});
  wrap('summonAttack',function(s,owner){return owner||playerNow();});
  ['allyAttackOnce','allyCastMagic','allyProcFreeMagicSkill','allyProcWeaponSpell','allyCubeTick','allyStormTick','allyCastPhysicalSkill'].forEach(function(name){wrap(name,function(a){return a;});});
  wrap('summonV2AttackOnce',function(s,d,t,owner){return owner||s&&s._relicOwner||playerNow();});
  wrap('spiritAttackOnce',function(s,t,owner){return owner||s&&s._relicOwner||playerNow();});
  var oldAttr=W.__afkAttrBoost;W.__afkAttrBoost=function(actor,d){earlyStats(actor,d);if(oldAttr)return oldAttr.apply(this,arguments);};
  var oldStats=W.recomputeStats;if(typeof oldStats==='function')W.recomputeStats=function(){var actor=playerNow();prepareStats(actor);var out=oldStats.apply(this,arguments);lateStats(actor,actor&&actor.d);return out;};
  var r=runtime();if(r&&r.afterHit){var oldHit=r.afterHit;r.afterHit=function(actor,target,amount,weapon){var pending=r.state(actor,'_attack').pending;if(pending&&pending.target===target&&pending.cardSettledDamage!=null)amount=pending.cardSettledDamage;return oldHit.call(this,actor,target,amount,weapon);};}
  var B=W.AFK_RELIC_WEAPON_BRIDGE;if(B&&B.magicBurst){var oldBurst=B.magicBurst;B.magicBurst=function(d,n,sk,targets,actor){return withInherited(actor||playerNow(),targets,oldBurst,this,arguments);};}
  W.AFK_CARD_COMBAT={finalDR:finalDR,finalBlock:finalBlock,ruleFor:ruleFor,special:special,enabled:enabled,active:active,damage:damage,inheritTarget:inheritTarget,tick:tick,aura:aura,inDungeon:inDungeon,sourceActor:sourceActor,currentActor:currentActor,castInterval:castInterval,monsterActive:monsterActive,earlyStats:earlyStats,lateStats:lateStats,prepareStats:prepareStats,forcedEquipment:forcedEquipment,withInherited:withInherited,inherited:inherited,physicalKind:physicalKind,ownerOfEquipment:ownerOfEquipment,
    firstState:function(actor,target){var s=ledger.get(actor);return {seen:!!(s&&target&&s.seen.has(targetIdentity(target))),nextAt:s?s.nextAt:-Infinity};},rules:RULES};
})(window);
