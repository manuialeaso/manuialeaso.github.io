/* Native status and legacy armor-healing adapters.
 * beforeStatus is a pure query. A resolved attempt is reported once, after the
 * native status assignment or confirmed resistance; damage is never restored.
 * Runtime state and pending attempts are transient, outside character saves.
 */
(function(W){
  'use strict';
  var R=W.AFK_RELIC_RUNTIME;if(!R)return;
  var pending=new WeakMap(),originals={},seq=0,counterContext=null;
  var enabled=function(){return R.enabled?R.enabled():!W.AFK_TOGGLES||W.AFK_TOGGLES.enabled('relicfx');};
  var playerNow=function(){return typeof player!=='undefined'?player:null;};
  var now=function(){return R.api.now?R.api.now():typeof state!=='undefined'?Number(state.ticks||0)/10:0;};
  var num=function(n){return Number.isFinite(Number(n))?Number(n):0;};
  var canonical=function(k){return {slowAtk:'slow',slowatk:'slow',bind:'root',potionfrost:'potionFrost',foulwater:'foulWater'}[k]||k;};
  var nativeKey=function(k){return {slow:'slowAtk',root:'bind'}[k]||k;};
  var IMM={freeze:'immFreeze',stun:'immStun',stone:'immStone',paralyze:'immParalyze',sleep:'immSleep',slow:'immSlow',root:'immBind',poison:'immPoison',burn:'immBurn',blind:'immBlind',silence:'immSilence',fear:'immFear'};
  var RES={freeze:'freezeResist',stun:'stunResist',paralyze:'paralyzeResist',sleep:'sleepResist',slow:'slowResist',poison:'poisonResist'};
  var STATUS_KEYS=['freeze','stun','stone','sleep','paralyze','poison','burn','scald','bleed','blind','weaken','disease','silence','magicseal','slow','slowAtk','bind','fear','potionFrost','foulWater','armorBreak','evilAura','cleave','broken'];
  function slots(){return typeof WEIGHT_COUNT_SLOTS!=='undefined'?WEIGHT_COUNT_SLOTS:['wpn','offwpn','shield','helm','armor','shin','tshirt','cloak','gloves','boots','amulet','ear1','ear2','ring1','ring2','ring3','ring4','belt','eye','pet','doll'];}
  function definitions(actor){
    var G=W.AFK_RELIC_GM,eq=G&&G.realEquipment?G.realEquipment(actor):actor&&actor.eq||{},src=R.sources(actor),keys={};
    src.forEach(function(s){keys[s.key]=true;});
    var out=slots().map(function(k){var e=eq[k],d=e&&DB.items[e.id];return d&&!keys[d.relicBase||e.id]?d:null;}).filter(Boolean);
    return out.concat(src.map(function(s){return s.def;}));
  }
  function inferredAttacker(attacker){var c=R.context&&R.context();return attacker||c&&c.attacker||null;}
  function teamStatus(actor,kind){
    var out={immune:false,resist:0},members=R.api.team?R.api.team():[actor];if(members.indexOf(actor)<0)return out;
    members.forEach(function(a){var c=R.state(a,'_derived').context;if(!c)return;if((c.teamImmunities||[]).indexOf(kind)>=0)out.immune=true;out.resist+=num(c.teamAbnormalResist);});
    return out;
  }
  function immunity(actor,kind,roll){
    var field=IMM[kind],resField=RES[kind],imm=!!(actor&&field&&actor[field]),pct=0,d=actor&&actor.d||{};
    definitions(actor).forEach(function(def){if(field&&def[field])imm=true;if(resField)pct+=num(def[resField]);pct+=num(def.abnormalResist);});
    if(field&&d[field])imm=true;
    if((kind==='poison'||kind==='paralyze')&&d.immPoison)imm=true;
    if(kind==='stun'&&(actor.skills||[]).indexOf('sk_royal_kingguard')>=0)pct+=20;
    var team=teamStatus(actor,kind);imm=imm||team.immune;pct+=team.resist;
    var derived=R.state(actor,'_derived').context;if(kind==='fear'&&derived&&derived.immuneFear)imm=true;
    var buffs=R.state(actor,'_buffs');Object.keys(buffs).forEach(function(k){var b=buffs[k],v=b.values&&b.values.immune;if(b.until>now()&&(v===kind||Array.isArray(v)&&v.indexOf(kind)>=0))imm=true;});
    return {immune:imm||!!(roll&&pct>0&&Math.random()*100<Math.min(100,pct)),nativeImmune:imm,resistPct:Math.min(100,pct)};
  }
  function prepare(actor,kind,duration,attacker,opt){
    opt=opt||{};kind=canonical(kind);var check=enabled()?immunity(actor,kind,!!opt.roll):{immune:false};
    var c={actor:actor,recipient:actor,target:inferredAttacker(attacker),attacker:inferredAttacker(attacker),statusKind:kind,duration:Math.max(0,num(duration)),
      immune:!!(opt.immune||check.immune),blocked:false,applied:false,main:false,direct:false,statusAttemptId:++seq,native:true};
    if(enabled())R.dispatch('beforeStatus',c);c.blocked=!!c.immune;return c;
  }
  function report(c){
    if(!c||c._statusReported||!enabled())return c;c._statusReported=true;c.resolved=true;c.blocked=!!c.immune;
    R.dispatch('onStatusAttempt',c);return c;
  }
  function resisted(actor,kind,attacker){
    if(!actor)return false;var k=canonical(kind),c=prepare(actor,k,0,attacker,{roll:true});
    var all=pending.get(actor)||{};pending.set(actor,all);all[k]={context:c,at:now()};
    if(c.immune){delete all[k];report(c);}return !!c.immune;
  }
  function knownImmune(actor,kind,flag,attacker){
    if(!flag)return false;if(!enabled())return true;
    var c=prepare(actor,kind,0,attacker,{immune:true});report(c);return true;
  }
  function ended(actor,key,reason){
    if(!enabled()||!actor||STATUS_KEYS.indexOf(key)<0)return;
    R.dispatch('onStatusEnd',{actor:actor,recipient:actor,statusKind:canonical(key),removed:reason!=='natural',natural:reason==='natural',reason:reason||'cleanse',main:false,direct:false});
  }
  function setStatus(actor,key,ticks,attacker){
    if(!actor)return 0;var st=actor.statuses||actor._statuses||actor.st||(actor.statuses={}),old=num(st[key]);ticks=Math.max(0,num(ticks));
    if(!enabled()){st[key]=ticks;return ticks;}
    if(ticks<=0){st[key]=0;if(old>0)ended(actor,key,'cleanse');return 0;}
    var k=canonical(key),all=pending.get(actor),saved=all&&all[k],c;
    if(saved&&saved.at===now()&&(!attacker||!saved.context.attacker||saved.context.attacker===attacker)){
      c=saved.context;delete all[k];c.duration=ticks/10;c.attacker=inferredAttacker(attacker)||c.attacker;c.target=c.attacker;
      R.dispatch('beforeStatus',c);c.blocked=!!c.immune;
    }else c=prepare(actor,k,ticks/10,attacker,{roll:false});
    if(c.immune){report(c);return old;}
    st[key]=Math.max(1,Math.round(c.duration*10));c.applied=true;c.duration=st[key]/10;report(c);
    return st[key];
  }
  function shortenStatus(actor,key,ticks){var st=actor&&(actor.statuses||actor._statuses||actor.st);if(!st)return 0;var old=num(st[key]);st[key]=Math.max(0,num(ticks));if(old>0&&st[key]===0)ended(actor,key,'hit');return st[key];}
  function legacyStatusHeal(actor,before){
    if(!before||!actor||actor.dead||actor._downed||R.api.hp(actor)<=0)return;
    var st=actor.statuses||actor._statuses||{};if(!STATUS_KEYS.some(function(k){return st[k]>0&&!before[k];}))return;
    R.sources(actor).filter(function(s){return s.def.statusHealHp;}).forEach(function(s){var actual=R.procHeal(actor,num(s.def.statusHealHp),s.key);if(actual>0&&typeof W.logCombat==='function')W.logCombat('【'+s.def.n+'】異常狀態激發生機，恢復 '+actual+' 點 HP。','heal',actor===playerNow()?undefined:'mercenary');});
  }
  function legacyDamageHeal(actor,old,args,receiver){
    if(!enabled())return old.apply(receiver,args);
    if(!actor||actor.dead||actor._downed||R.api.hp(actor)<=0)return;
    var d=actor.d||{};if(!d.onDmgHeal)return old.apply(receiver,args);var s=R.sources(actor).find(function(x){return x.def.onDmgHeal===d.onDmgHeal;});if(!s)return old.apply(receiver,args);
    var skill=s.def.onDmgHeal,amount=R.api.healSpellAmount?R.api.healSpellAmount(actor,skill,actor):0;
    var actual=R.api.heal(actor,amount,{owner:actor,source:s.key,cd:Math.max(10,num(s.def.onDmgHealCd))});
    if(actual>0){actor._shellHealCd=Math.round((now()+Math.max(10,num(s.def.onDmgHealCd)))*10);if(typeof W.logCombat==='function')W.logCombat('【'+s.def.n+'】受擊自癒，恢復 '+actual+' 點 HP。','heal',actor===playerNow()?undefined:'mercenary');if(typeof W.updateUI==='function')W.updateUI();}
    return actual;
  }
  // This idle game has no manual position controls. Its actual walking time
  // is the speed-scaled encounter queue after the field has been cleared.
  // Refilling a vacant slot while enemies remain, and fixed boss respawns,
  // are not movement. Every living party member follows the same encounter.
  function syncMovement(){
    if(!enabled()||typeof state==='undefined'||typeof mapState==='undefined')return;
    var map=mapState.current,p=playerNow(),time=now(),rows=mapState.mobs||[];
    var fixed=typeof PURE_BOSS_MAPS!=='undefined'&&PURE_BOSS_MAPS.indexOf(map)>=0||typeof KING_ROOMS!=='undefined'&&!!KING_ROOMS[map]||map==='antharas_lair';
    var alive=rows.some(function(m){return m&&!m._dead&&R.api.hp(m)>0;});
    var queued=(mapState.spawnAt||[]).some(function(t){return t!=null&&Number.isFinite(Number(t))&&Number(t)>=Number(state.ticks);});
    var walking=!!(state.running&&p&&!p.dead&&!/^town_/.test(map||'')&&!fixed&&!alive&&queued);
    (R.api.team?R.api.team():[p]).filter(Boolean).forEach(function(actor){
      var m=R.state(actor,'_movement');
      if(m.map!==map){m.map=map;m.last=time;m.moving=false;m.movingSince=null;m.movingFor=0;}
      var buffs=R.state(actor,'_buffs'),blocked=Object.keys(buffs).some(function(k){return buffs[k].until>time&&(buffs[k].values.immobilized||buffs[k].values.cannotAct);});
      var moving=walking&&!blocked&&!actor.dead&&!actor._downed&&R.api.hp(actor)>0,started=moving&&!m.moving;
      if(started){m.movingSince=time;m.last=time;}
      else if(!moving&&m.moving){m.last=time;m.movingSince=null;}
      m.moving=moving;m.movingFor=moving?Math.max(0,time-m.movingSince):0;
      if(moving)m.last=time;
      if(started)R.dispatch('move',{actor:actor,main:false,direct:false,reason:'encounter-travel'});
    });
  }
  function wrap(name,make){var old=W[name];if(typeof old!=='function'||old._relicDefenseBridge)return;originals[name]=old;var next=make(old);next._relicDefenseBridge=true;W[name]=next;}
  // A monster's counter barrier reuses the normal physical attack functions.
  // Their anchored incoming hooks already protect HP; preserve that path while
  // identifying the return attack so it cannot count as another main attack.
  wrap('trollCounterBarrierOnDamage',function(old){return function(mob,damage,ally){
    if(!enabled())return old.apply(this,arguments);
    var previous=counterContext;counterContext={actor:ally||playerNow(),attacker:mob};
    try{return old.apply(this,arguments);}finally{counterContext=previous;}
  };});
  var incoming=R.incoming;
  R.incoming=function(actor,amount,attacker,options){
    if(counterContext&&counterContext.actor===actor&&counterContext.attacker===attacker)
      options=Object.assign({},options||{},{origin:'reflection',main:false});
    return incoming.call(this,actor,amount,attacker,options);
  };
  // Weapon bridge owns weapon procs. Armor/accessory free spells need the same
  // native ally settlement seam, including their spell multiplier and source.
  // Ordinary ally spells and weapon relics continue through their own path.
  var B=W.AFK_RELIC_WEAPON_BRIDGE,allySpellHit=B&&B.allySpellHit;
  if(allySpellHit)B.allySpellHit=function(actor,target,amount,skill,def,extra){
    if(!enabled()||!def||def.relicCatalogId<132||def.relicCatalogId>250||!def.relicBase)return allySpellHit.apply(this,arguments);
    var act=R.action&&R.action(),mult=Number(W.__afkSpellMult)||1;
    amount=Math.max(0,Math.floor(amount*mult*(typeof W.royalAllyMult==='function'?W.royalAllyMult():1)));
    amount=R.spellDamage(actor,target,amount,skill,extra||{});
    R.api.damage(target,amount,{actor:actor,source:def.relicBase,ascended:def.relicAsc!=null,type:'magic',element:skill&&skill.ele||'none',origin:act&&act.reflection?'reflection':'proc',react:false,snapshot:true,reflect:!(act&&act.reflection),settle:false});
    R.flushSpellHits(act);
    if(R.api.hp(actor)>0&&!actor.dead&&!actor._downed&&R.api.hp(target)<=0&&!target._dead&&typeof W.killMob==='function'){var ix=mapState.mobs.indexOf(target);if(ix>=0)W.killMob(ix);}
    return true;
  };
  wrap('maybeSpawnMobs',function(old){return function(){if(enabled())syncMovement();try{return old.apply(this,arguments);}finally{if(enabled())syncMovement();}};});
  wrap('playerStatusResisted',function(old){return function(kind,attacker){return enabled()?resisted(playerNow(),kind,attacker):old.apply(this,arguments);};});
  wrap('allyStatusResisted',function(old){return function(actor,kind,attacker){return enabled()?resisted(actor,kind,attacker):old.apply(this,arguments);};});
  wrap('_statusInflictHeal',function(old){return function(before){return enabled()?legacyStatusHeal(playerNow(),before):old.apply(this,arguments);};});
  wrap('_allyStatusInflictHeal',function(old){return function(actor,before){return enabled()?legacyStatusHeal(actor,before):old.apply(this,arguments);};});
  wrap('_relicOnDamageHeal',function(old){return function(){return legacyDamageHeal(playerNow(),old,arguments,this);};});
  wrap('_allyRelicOnDamageHeal',function(old){return function(actor){return legacyDamageHeal(actor,old,arguments,this);};});
  W.AFK_RELIC_DEFENSE_BRIDGE={prepareStatus:prepare,reportStatus:report,resisted:resisted,knownImmune:knownImmune,setStatus:setStatus,shortenStatus:shortenStatus,statusEnded:ended,canonicalStatus:canonical,legacyStatusHeal:legacyStatusHeal,syncMovement:syncMovement};
})(window);
