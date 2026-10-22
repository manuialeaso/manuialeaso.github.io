/* Native companion adapters for relic effects. Runtime entities stay in WeakMaps
 * or the engine's existing transient lists; no skills or save slots are granted.
 * Extra actions reuse the original species skill tables, hit rolls and death path.
 */
(function (W) {
  'use strict';
  var R=W.AFK_RELIC_RUNTIME;if(!R)return;
  var native={},extraKings=new WeakMap(),summonHp=new WeakMap(),contexts=[],necroKills=new WeakMap();
  var enabled=function(){return !W.AFK_TOGGLES||W.AFK_TOGGLES.enabled('relicfx');};
  var num=function(x){return Number.isFinite(Number(x))?Number(x):0;};
  var playerNow=function(){return typeof player!=='undefined'?player:null;};
  var now=function(){return R.api.now?R.api.now():typeof state!=='undefined'?num(state.ticks)/10:0;};
  var hp=function(e){return e?Math.max(0,num(e.curHp!=null?e.curHp:e.hp)):0;};
  var live=function(e){return !!(e&&!e.dead&&!e._downed&&hp(e)>0);};
  var uniq=function(a){return a.filter(function(e,i){return e&&a.indexOf(e)===i;});};
  var context=function(){return contexts[contexts.length-1]||null;};
  var active=function(){return R.api.activeContext?R.api.activeContext():R.context?R.context():null;};
  function source(owner,id){return R.sources(owner).find(function(x){return x.catalogId===id;})||null;}
  function teamSource(id){var best=null;characters().forEach(function(owner){var s=source(owner,id);if(s&&(!best||s.stage>best.source.stage||s.stage===best.source.stage&&num(s.n)>num(best.source.n)))best={owner:owner,source:s};});return best;}
  function characters(includeDown){var p=playerNow();return p?[p].concat(p.allies||[]).filter(includeDown?Boolean:live):[];}
  function team(){var out=characters();if(typeof W.guardAliveList==='function')out=out.concat(W.guardAliveList());return uniq(out);}
  function pets(owner,includeDown){
    var p=playerNow();owner=owner||p;if(!p||owner!==p)return [];
    var a=typeof W.petsOutList==='function'?W.petsOutList():p.pets||[];
    return a.filter(includeDown?Boolean:live);
  }
  function necroSkeletons(includeDown){return typeof W.necroSkeletonList==='function'?W.necroSkeletonList().filter(includeDown?Boolean:live):[];}
  function ownerOf(e){
    var p=playerNow();if(!e)return p;
    if(e._relicOwner)return e._relicOwner;
    if(e._necroOwnerKey&&typeof W._necroOwnerByKey==='function')return W._necroOwnerByKey(e._necroOwnerKey)||p;
    if(p&&(p.allies||[]).some(function(a){return a&&a.summon===e;}))return (p.allies||[]).find(function(a){return a&&a.summon===e;});
    return p;
  }
  function kindOf(e){if(!e)return 'summon';if(e.skId==='sk_elf_summon'||e.skId==='sk_elf_summon2')return 'spirit';if(pets(null,true).indexOf(e)>=0)return 'pet';return 'summon';}
  function summons(owner,includeDown){
    var p=playerNow();owner=owner||p;if(!owner)return [];
    var a=owner===p?(p.summonsV2||[]).slice():[];
    if(owner.summon&&num(owner.summon.mhp)>0)a.push(owner.summon);
    a=a.concat(necroSkeletons(true).filter(function(e){return ownerOf(e)===owner;}),extraKings.get(owner)||[]);
    return uniq(a).filter(includeDown?Boolean:live);
  }
  function beneficiaries(){return uniq(team().concat(pets(),characters().flatMap(function(a){return summons(a);})));}
  function stamp(e,k,v){if(!e)return;Object.defineProperty(e,k,{value:v,writable:true,configurable:true,enumerable:false});}
  function dispatchCompanion(event,owner,e,more){
    var c=Object.assign({actor:owner,owner:owner,companion:e,pet:e,companionKind:kindOf(e),main:false,direct:true},more||{});
    R.dispatch(event,c);return c;
  }
  function companionStats(owner,e,stats){
    var k=kindOf(e),c=dispatchCompanion('onCompanionStats',owner,e,{stats:stats||{},maxHpMult:1,directDamageMult:1});
    // Training whip protects and strengthens the entire team, including allies' summons.
    var all=characters().flatMap(function(a){return R.sources(a).filter(function(s){return s.catalogId===18;});});
    c.maxHpAdd=k==='pet'?0:all.reduce(function(n,s){return n+num(s.def.relicSummonHp);},0);
    var B=W.AFK_RELIC_WEAPON_BRIDGE;if(B&&B.companionDamageMult)c.directDamageMult*=B.companionDamageMult(owner,e);
    var speed=k==='pet'?0:R.sources(owner).reduce(function(n,s){return Math.max(n,num(s.def.relicCompanionAttackSpeed));},0);c.attackSpeedPct=speed;
    var buffs=R.state(e,'_buffs');Object.keys(buffs).forEach(function(k){var b=buffs[k];if(b.until>now()&&b.values&&b.values.directDamageMult)c.directDamageMult*=b.values.directDamageMult;});
    return c;
  }
  function maxHp(e){
    if(!e)return 1;
    if(kindOf(e)==='pet'&&native.petMhpEff){var c=companionStats(playerNow(),e,{});return Math.max(1,Math.floor(native.petMhpEff(e)*(c.maxHpMult||1)));}
    var meta=summonHp.get(e);return Math.max(1,num(meta?meta.effective:e.mhp!=null?e.mhp:e.hp));
  }
  function syncSummonHp(e,owner,fill){
    if(!e||!(num(e.mhp)>0))return;
    var meta=summonHp.get(e);
    if(!meta){meta={base:num(e.mhp),effective:num(e.mhp)};summonHp.set(e,meta);}
    else if(num(e.mhp)!==meta.effective)meta.base=num(e.mhp);
    var c=companionStats(owner||ownerOf(e),e,{}),amount=Math.max(1,Math.floor((meta.base+(c.maxHpAdd||0))*(c.maxHpMult||1)));
    meta.effective=amount;e.mhp=amount;e.hp=fill?amount:Math.min(hp(e),amount);
  }
  function damageMult(owner,e){return enabled()?companionStats(owner||ownerOf(e),e,{}).directDamageMult||1:1;}
  function companionContext(owner,e,meta){
    var current=context(),k=kindOf(e),c=Object.assign({owner:owner||ownerOf(e),companion:e,companionKind:k,petElement:e&&e.ele||'none',origin:k==='pet'?'pet':'summon',mult:1},meta||{});
    if(current&&current.companion===e){c.origin=current.origin==='relic'?'relic':k==='pet'?'pet':'summon';c.mult=current.mult||1;c.skillId=c.skillId||current.skillId;c.actionFirstHit=!current.hitSeen;current.hitSeen=true;}
    if(k==='pet'){var trainer=teamSource(188);if(trainer){c.petTrainingOwner=trainer.owner;c.petTrainingSource=trainer.source.key;}}
    return c;
  }
  function withContext(c,fn){contexts.push(c);try{return fn();}finally{
    if(typeof R.flushCompanionHits==='function'){
      var hits=(R.state(c.owner,'_companions').hits||[]).slice();R.flushCompanionHits(c.owner);
      hits.forEach(function(h){if(h.petTrainingOwner&&h.petTrainingOwner!==h.actor){var s=source(h.petTrainingOwner,188);if(s)R.dispatch('petHit',Object.assign({},h,{actor:h.petTrainingOwner}),s);}});
    }contexts.pop();}}
  function wrap(name,make){var old=W[name];if(typeof old!=='function'||old._relicCompanionWrapper)return;native[name]=old;var next=make(old);next._relicCompanionWrapper=true;W[name]=next;}

  function summonSkeleton(owner,opt){
    opt=opt||{};if(!enabled()||!owner||typeof W.necroBookPassiveEnabled!=='function'||!W.necroBookPassiveEnabled(owner))return 0;
    var ac=active(),corpse=ac&&ac.target;
    if(corpse&&corpse.race==='建築')return 0;
    // One kill creates one group; two holders cannot bypass the global skeleton cap.
    if(corpse&&necroKills.has(corpse))return 0;
    var holders=characters().filter(function(a){return W.necroBookPassiveEnabled(a);}),best=null;
    holders.forEach(function(a){var s=source(a,196);if(s&&(!best||s.stage>best.source.stage))best={owner:a,source:s};});
    if(!best)return 0;
    var cfg=best.source.def.relicNecro||{cap:6,count:1,hpMult:1,damageMult:1},cap=Math.min(20,Math.max(6,num(cfg.cap||opt.cap))),count=Math.max(1,num(cfg.count||opt.count));
    var list=W.necroSkeletonList(),added=0;
    if(corpse)necroKills.set(corpse,true);
    for(var i=0;i<count&&necroSkeletons().length<cap;i++){
      var legal=holders.filter(function(a){return W._necroTierForOwner(a)&&W._necroOwnerKey(a);});if(!legal.length)break;
      legal.sort(function(a,b){return necroSkeletons().filter(function(x){return ownerOf(x)===a;}).length-necroSkeletons().filter(function(x){return ownerOf(x)===b;}).length;});
      var own=legal[0],s=source(own,196),sc=s.def.relicNecro||{hpMult:1,damageMult:1},tier=W._necroTierForOwner(own),baseHp=tier.hp*(sc.hpMult||1);
      var ent={uid:typeof W.uid==='function'?W.uid():'relic-skeleton-'+now()+'-'+i,skId:'sk_zombie',form:'骷髏',formGfx:'骷髏召喚物',lv:tier.lv,hp:baseHp,mhp:baseHp,_atkCd:5,_necroSkeleton:true,_noHeal:true,_necroOwnerKey:W._necroOwnerKey(own)};
      stamp(ent,'_relicOwner',own);stamp(ent,'_relicNecroSource',s.key);stamp(ent,'_relicNecroDamage',sc.damageMult||1);syncSummonHp(ent,own,true);list.push(ent);added++;
    }
    if(added&&typeof W.renderSummonPanel==='function')W.renderSummonPanel(true);return added;
  }
  function summonKing(element,count,opt){
    opt=opt||{};var ac=active(),owner=opt.owner||ac&&ac.actor||playerNow();
    if(!enabled()||!live(owner)||typeof W._spiritSpec!=='function'||!['fire','water','wind','earth'].includes(element))return [];
    var key=opt.source||ac&&ac.sourceId,src=R.sources(owner).find(function(s){return s.key===key&&s.def.relicExtraKings;});if(!src)return [];
    var list=extraKings.get(owner)||[],existing=list.filter(function(e){return e._relicKingSource===key&&live(e);});
    count=Math.min(2,Math.max(0,Math.floor(count||1)));
    existing.slice(count).forEach(function(e){list=list.filter(function(x){return x!==e;});});
    for(var i=existing.length;i<count;i++){
      var spec=W._spiritSpec('sk_elf_summon2',element,true),zh={fire:'火',water:'水',wind:'風',earth:'地'}[element];
      var e={uid:typeof W.uid==='function'?W.uid():'relic-king-'+element+'-'+now()+'-'+i,skId:'sk_elf_summon2',ele:element,_king:true,lv:spec.lv,form:zh+'之精靈王',formGfx:'強力'+zh+'屬性精靈',hp:spec.hp,mhp:spec.hp,_atkCd:5};
      stamp(e,'_relicOwner',owner);stamp(e,'_relicKingSource',key);stamp(e,'_relicExtraKing',true);syncSummonHp(e,owner,true);list.push(e);
    }
    extraKings.set(owner,list);return list.filter(function(e){return e._relicKingSource===key;});
  }
  function commandKings(element,target,seconds,opt){var ac=active(),owner=opt&&opt.owner||ac&&ac.actor||playerNow(),src=opt&&opt.source;var count=0;(extraKings.get(owner)||[]).forEach(function(e){if(e.ele===element&&(!src||e._relicKingSource===src)){stamp(e,'_relicCommand',{target:target,until:now()+seconds});count++;}});return count;}
  function companionAttack(owner,e,target,opt){
    opt=opt||{};if(!enabled()||!live(owner)||!live(e)||!target||hp(target)<=0)return 0;
    var count=Math.max(1,Math.min(5,Math.floor(opt.count||1))),done=0;
    for(var i=0;i<count&&live(e)&&hp(target)>0;i++){
      var c={owner:owner,companion:e,origin:'relic',mult:opt.mult||1,free:!!opt.free,skillId:opt.skill?'pet-skill':null,hitSeen:false};
      withContext(c,function(){
        var run=function(){if(kindOf(e)==='pet'){var d=W.petDerive(e);if(opt.skill){if(W.petCastSkill(e,d,target))done++;}else{W.petAttackOnce(e,d,target);done++;}}
          else if(kindOf(e)==='spirit'){W.spiritAttackOnce(e,target,owner);done++;}
          else {var d=W._sumDeriveAny(e,owner);W.summonV2AttackOnce(e,d,target,owner);done++;}};
        if(typeof W.threatWrap==='function')W.threatWrap(e,run);else run();
      });
    }return done;
  }
  function petSkillCost(e,amount){
    if(!enabled())return Math.max(0,num(amount));var current=context();if(current&&current.companion===e&&current.free)return 0;
    var c={actor:playerNow(),companion:e,mpCost:num(amount),main:false},trainer=teamSource(188);
    if(trainer)R.dispatch('beforePetSkillCost',Object.assign(c,{actor:trainer.owner}),trainer.source);
    return Math.max(0,Math.ceil(c.mpCost));
  }
  function nextPetSkillWait(e,base){var m=e&&e._relicNextSkillWait||1;if(e)delete e._relicNextSkillWait;return Math.max(0,base*m);}
  function downedCompanions(owner){var p=playerNow();if(!p||owner&&owner!==p)return [];return (p.allies||[]).concat(pets(p,true)).filter(function(e){return e&&e._downed;});}
  function hasReviveScroll(){var p=playerNow();return !!(p&&(p.inv||[]).some(function(x){return x.id==='scroll_revive'&&num(x.cnt)>0;}));}
  function revive(e,opt){
    opt=opt||{};if(!e||!e._downed)return false;var p=playerNow();if(!p)return false;
    if(opt.consumeScroll&&!opt.free){var scroll=(p.inv||[]).find(function(x){return x.id==='scroll_revive'&&num(x.cnt)>0;});if(!scroll)return false;scroll.cnt--;if(scroll.cnt<=0)p.inv=p.inv.filter(function(x){return x!==scroll;});}
    var isPet=kindOf(e)==='pet';e._downed=false;e._reviveCd=0;e._animAct=null;
    if(isPet){e._statuses=typeof W.newMobStatus==='function'?W.newMobStatus():{};e.hp=Math.max(1,Math.floor(maxHp(e)*(opt.hpPct||.5)));e.mp=num(e.mmp)+(W.petDerive(e).mmpBonus||0);W.petDevotionGrant(e);e.hp=Math.max(1,Math.floor(maxHp(e)*(opt.hpPct||.5)));if(typeof W.petMarkDirty==='function')W.petMarkDirty();}
    else {e.statuses={};e.curHp=Math.max(1,Math.floor(maxHp(e)*(opt.hpPct||.5)));e.mp=num(e.mmp);}
    if(opt.invulnerable)R.api.buff(e,(opt.source||'relic')+':reviveGuard',{invulnerable:true},opt.invulnerable);
    if(typeof W.renderSquadPanel==='function')W.renderSquadPanel();return true;
  }
  function incoming(e,amount,enemy,opt){
    if(!enabled())return amount;opt=opt||{};
    var value=R.incoming(e,amount,enemy,opt);
    var B=W.AFK_RELIC_WEAPON_BRIDGE;if(B&&B.companionIncoming)value=B.companionIncoming(e,value,enemy,opt.kind);
    return value;
  }
  function afterIncoming(e,amount,enemy){
    if(!enabled())return;var result=R.afterIncoming(e,amount,enemy),owner=ownerOf(e);
    dispatchCompanion('petHurt',owner,e,Object.assign({},result,{actor:owner,companion:e,recipient:e,attacker:enemy,target:enemy,actualDamage:Math.min(result.hpBefore||amount,amount)}));
  }
  function petSlots(base){if(!enabled())return base;var c=R.dispatch('petSlots',{actor:playerNow(),value:base,main:false});return Math.max(base,Math.floor(c.value));}
  function trackingChance(base){if(!enabled())return base;return Math.max(0,Math.min(1,R.dispatch('trackingChance',{actor:playerNow(),value:base,main:false}).value));}
  function isTracked(owner,target){return !!(owner&&target&&owner.tracking&&owner.tracking.until>Date.now()&&typeof mapState!=='undefined'&&owner.tracking.map===mapState.current&&(target.id===owner.tracking.mob||target._id===owner.tracking.mob||target.mobId===owner.tracking.mob));}
  function trackingHit(owner,target,value){return enabled()?R.dispatch('trackingHit',{actor:owner,target:target,trackedTarget:isTracked(owner,target),value:value,main:false}).value:value;}
  function regenAmount(owner,value,kind){return enabled()?R.dispatch('regen',{actor:owner,value:value,regenKind:kind,blockedByWeight:!!(owner.d&&owner.d.loadTier>0),main:false}).value:value;}
  function knockback(owner,value){return enabled()?R.dispatch('knockback',{actor:owner,value:value,main:false}).value:value;}
  function realEquipment(owner){var G=W.AFK_RELIC_GM;return G&&G.realEquipment?G.realEquipment(owner):owner&&owner.eq||{};}
  function weightSlots(){return typeof WEIGHT_COUNT_SLOTS!=='undefined'?WEIGHT_COUNT_SLOTS:['wpn','offwpn','shield','helm','armor','shin','tshirt','cloak','gloves','boots','amulet','ear1','ear2','ring1','ring2','ring3','ring4','belt','eye','pet','doll'];}
  function itemWeight(def){
    if(!def||def.relicProjected)return 0;if(def.weight!=null)return Math.max(0,num(def.weight));
    var base=def.relicBase&&typeof DB!=='undefined'?DB.items[def.relicBase]:null,n=base&&base.n||def.n;
    return typeof ITEM_WEIGHTS!=='undefined'?Math.max(0,num(ITEM_WEIGHTS[n])):0;
  }
  function equipmentWeight(owner){var eq=realEquipment(owner);return weightSlots().reduce(function(sum,k){var e=eq[k];return sum+(e&&!e._relicVirtual?itemWeight(DB.items[e.id]):0);},0);}
  function equipmentCapacity(owner,fallback){
    if(!enabled())return fallback;var eq=realEquipment(owner),sources=R.sources(owner),seen={},cap=0;
    weightSlots().forEach(function(k){var e=eq[k],d=e&&DB.items[e.id];if(!d||e._relicVirtual)return;var key=d.relicBase||e.id,s=sources.find(function(x){return x.key===key;});
      if(!s)cap+=num(d.weightCap);else if(!seen[key]){cap+=num(s.def.weightCap);seen[key]=true;}
      if(d.slot==='belt')cap+=Math.min(num(e.en),5)*20;
    });
    sources.forEach(function(s){if(!seen[s.key])cap+=num(s.def.weightCap);});return cap;
  }
  function weightInfo(owner,d){d=d||owner.d||{};return {equippedWeight:equipmentWeight(owner),weightCapacity:num(d.weightCapacity)};}
  function threat(owner,mult){if(!owner||typeof W.threatKey!=='function')return;var k=W.threatKey(owner);R.api.targets().forEach(function(m){if(typeof W._threatDecayMob==='function')W._threatDecayMob(m);if(m._threat&&m._threat[k]!=null)m._threat[k]*=Math.max(0,mult);});}
  function healSpellAmount(target,skillId,caster){
    var sk=typeof DB!=='undefined'&&DB.skills[skillId];if(!sk||typeof W.rollHealingSpell!=='function')return 0;
    // Runtime applies healing reduction once; avoid including foul water in the roll too.
    var proxy=Object.create(target||{});proxy.statuses=Object.assign({},target&&target.statuses,{foulWater:0});proxy._statuses=Object.assign({},target&&target._statuses,{foulWater:0});
    return W.rollHealingSpell(sk,caster&&caster.d,caster,proxy);
  }
  function extraTick(){
    if(!enabled())return;var p=playerNow();if(!p)return;
    characters(true).forEach(function(owner){
      var list=extraKings.get(owner)||[];
      if(!live(owner)||typeof W._petInWild==='function'&&!W._petInWild()){if(list.length)extraKings.set(owner,[]);return;}
      list=list.filter(function(e){return live(e)&&R.sources(owner).some(function(s){return s.key===e._relicKingSource&&s.def.relicExtraKings;});});extraKings.set(owner,list);
      list.forEach(function(e){syncSummonHp(e,owner,false);e._atkCd=num(e._atkCd)-1;if(e._atkCd>0)return;var d=W._sumDeriveAny(e,owner);e._atkCd=d.aspd;var t=W._petPickTarget(e);if(t)companionAttack(owner,e,t,{count:1,mult:1,free:true});});
    });
    // Base earring still rescues, but no base relic can bypass the source's ten-second clock.
    var s=source(p,232),fallen=downedCompanions(p);if(s&&s.stage===0&&fallen.length&&hasReviveScroll()&&R.api.cooldown(p,s.key,'heal',10))revive(fallen[0],{owner:p,source:s.key,hpPct:.5,consumeScroll:true});
  }

  wrap('necroBookEquipped',function(old){return function(owner){return enabled()?!!source(owner,196):old.apply(this,arguments);};});
  wrap('necroBookOnKill',function(old){return function(mob){
    if(!enabled())return old.apply(this,arguments);if(!mob||mob.race==='建築')return;
    var holders=characters().filter(function(a){return !!source(a,196);}),enhanced=holders.some(function(a){return source(a,196).stage>0;});
    if(enhanced)return;var before=necroSkeletons();if(holders.length)summonSkeleton(holders[0],{count:1,cap:6});
    holders.forEach(function(owner){var s=source(owner,196);if(R.api.cooldown(owner,s.key,'heal',10)){beneficiaries().forEach(function(e){R.api.heal(e,maxHp(e)*.01,{owner:owner,source:s.key,prepaid:true,cd:10});});if(before.length>=6){var weakest=before.slice().sort(function(a,b){return hp(a)-hp(b);})[0];if(weakest)R.api.heal(weakest,maxHp(weakest),{owner:owner,source:s.key,prepaid:true,cd:10});}}});
  };});
  wrap('_necroSkeletonDerive',function(old){return function(e,owner){var d=old.apply(this,arguments);if(enabled()&&e._relicNecroDamage)d.dmgMult*=e._relicNecroDamage;return d;};});
  wrap('hasSummonCtrlRing',function(old){return function(owner){owner=owner||playerNow();return old.apply(this,arguments)||(enabled()&&!!source(owner,189));};});
  wrap('_sumCountFor',function(old){return function(name,owner){owner=owner||playerNow();if(!enabled())return old.apply(this,arguments);var e=W._sumTierOf(name);if(!e)return 0;var original=old.apply(this,arguments),src=source(owner,189);if(!src||!src.stage)return original;var cap=W.hasSummonCtrlRing(owner)?e.tier.ringCap:e.tier.cap,c=R.dispatch('summonLimit',{actor:owner,value:cap,main:false},src);if(e.tier.fixedCount)return Math.max(1,Math.floor(c.value));return Math.max(0,Math.min(Math.floor(c.value),Math.floor((num(owner.d&&owner.d.cha)+6)/e.tier.div)));};});
  wrap('_sumDeriveAny',function(old){return function(e,owner){owner=owner||ownerOf(e);if(enabled())syncSummonHp(e,owner,false);var d=old.call(this,e,owner);if(enabled()){var c=companionStats(owner,e,{});d=Object.assign({},d);if(c.attackSpeedPct)d.aspd/=1+c.attackSpeedPct/100;}return d;};});
  wrap('petDerive',function(old){return function(e){var d=old.apply(this,arguments);if(!enabled()||!d)return d;var c=companionStats(playerNow(),e,d);d._relicCritChance=c.stats.critChance||0;if(c.attackSpeedPct)d.atkItv/=1+c.attackSpeedPct/100;return d;};});
  wrap('petMhpEff',function(old){return function(e){return enabled()?maxHp(e):old.apply(this,arguments);};});
  wrap('petAttackOnce',function(old){return function(e,d,target,forceCrit,addDmg,skName){if(!enabled())return old.apply(this,arguments);var self=this,args=Array.prototype.slice.call(arguments),cur=context();if(!forceCrit&&d&&Math.random()<(d._relicCritChance||0))args[3]=true;var c=cur&&cur.companion===e?cur:{owner:playerNow(),companion:e,origin:'normal',mult:1,skillId:skName||null,hitSeen:false};return withContext(c,function(){return old.apply(self,args);});};});
  wrap('petCastSkill',function(old){return function(e,d,target){if(!enabled())return old.apply(this,arguments);var self=this,args=arguments,cur=context(),c=cur&&cur.companion===e?cur:{owner:playerNow(),companion:e,origin:'normal',mult:1,skillId:'pet-skill',hitSeen:false};return withContext(c,function(){return old.apply(self,args);});};});
  ['summonV2AttackOnce','spiritAttackOnce'].forEach(function(name){wrap(name,function(old){return function(e){if(!enabled())return old.apply(this,arguments);var self=this,args=arguments,owner=(name==='spiritAttackOnce'?args[2]:args[3])||ownerOf(e),cur=context(),c=cur&&cur.companion===e?cur:{owner:owner,companion:e,origin:'normal',mult:1,skillId:null,hitSeen:false};return withContext(c,function(){return old.apply(self,args);});};});});
  wrap('summonV2CastFor',function(old){return function(){var before=(playerNow().summonsV2||[]).slice(),result=old.apply(this,arguments);if(enabled()&&result)(playerNow().summonsV2||[]).forEach(function(e){if(before.indexOf(e)<0)syncSummonHp(e,playerNow(),true);});return result;};});
  wrap('buildSummon',function(old){return function(sk,def,duration,owner){var e=old.apply(this,arguments);if(enabled())syncSummonHp(e,owner||playerNow(),true);return e;};});
  wrap('summonV2List',function(old){return function(){var list=old.apply(this,arguments);return enabled()?list.concat(extraKings.get(playerNow())||[]):list;};});
  wrap('summonRenderList',function(old){return function(){var list=old.apply(this,arguments);return enabled()?uniq(list.concat(characters().flatMap(function(a){return extraKings.get(a)||[];}))):list;};});
  wrap('_petPickTarget',function(old){return function(e){var c=e&&e._relicCommand;return enabled()&&c&&c.until>now()&&live(c.target)?c.target:old.apply(this,arguments);};});
  wrap('summonV2Tick',function(old){return function(){var result=old.apply(this,arguments);extraTick();return result;};});
  wrap('petDevotionGrant',function(old){return function(e){var before=maxHp(e),ratio=hp(e)/before,result=old.apply(this,arguments);if(enabled()){var owner=playerNow(),s=source(owner,245);if(s){e._reviveGuardUntil=Math.max(e._reviveGuardUntil||0,Math.round(now()*10)+80);dispatchCompanion('petRevive',owner,e,{});e.hp=Math.min(maxHp(e),Math.max(hp(e),Math.floor(maxHp(e)*ratio)));}}return result;};});
  wrap('playerHasAutoReviveEarring',function(old){return function(){return enabled()&&source(playerNow(),232)?false:old.apply(this,arguments);};});
  wrap('hasLoadFreeRegen',function(old){return function(){var s=source(playerNow(),239);return old.apply(this,arguments)||(enabled()&&s&&s.stage>=3);};});
  wrap('computeThreatMult',function(old){return function(owner){var value=old.apply(this,arguments);return enabled()&&owner&&owner.eq?R.dispatch('threat',{actor:owner,value:value,main:false}).value:value;};});

  Object.assign(R.api,{team:team,pets:pets,summons:summons,mhp:maxHp,necroSkeletons:necroSkeletons,healBeneficiaries:beneficiaries,
    summonSkeleton:summonSkeleton,summonKing:summonKing,commandKings:commandKings,companionAttack:companionAttack,
    downedCompanions:downedCompanions,hasReviveScroll:hasReviveScroll,revive:revive,threat:threat,healSpellAmount:healSpellAmount,
    healSpell:function(target,skillId,opt){opt=opt||{};var ac=active(),owner=opt.owner||ac&&ac.actor||playerNow();return R.api.heal(target,healSpellAmount(target,skillId,owner)*(opt.mult||1),opt);},
    reduceCompanionSkillCooldown:function(e,mult){if(e._castCd>0)e._castCd*=mult;else stamp(e,'_relicNextSkillWait',mult);},
    payHp:function(e,amount){var key=e.curHp!=null?'curHp':'hp',paid=Math.min(Math.max(0,hp(e)-1),Math.max(0,amount));e[key]-=paid;return paid;}
  });
  W.AFK_RELIC_COMPANIONS={context:context,companionContext:companionContext,companionStats:companionStats,damageMult:damageMult,maxHp:maxHp,ownerOf:ownerOf,kindOf:kindOf,
    petSkillCost:petSkillCost,nextPetSkillWait:nextPetSkillWait,incoming:incoming,afterIncoming:afterIncoming,petSlots:petSlots,trackingChance:trackingChance,trackingHit:trackingHit,isTracked:isTracked,
    regenAmount:regenAmount,knockback:knockback,weightInfo:weightInfo,itemWeight:itemWeight,equipmentCapacity:equipmentCapacity,tick:extraTick,summonSkeleton:summonSkeleton,summonKing:summonKing,commandKings:commandKings,
    companionAttack:companionAttack,revive:revive,extraKings:function(owner){return (extraKings.get(owner||playerNow())||[]).slice();}};
})(window);
