import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const env={console:{log(){},warn(){}},document:{readyState:'loading',addEventListener(){}},location:{hostname:'localhost'},setTimeout(){},setInterval(){},localStorage:{getItem(){return null},setItem(){}},URL,Math,Date};
env.window=env;vm.createContext(env);
vm.runInContext(fs.readFileSync(path.join(root,'js/00-data.js'),'utf8'),env);
vm.runInContext(fs.readFileSync(path.join(root,'afk-relic-defense.js'),'utf8'),env);
const db=vm.runInContext('DB',env),R=env.AFK_RELIC_DEFENSE,copy=x=>JSON.parse(JSON.stringify(x));
assert.equal(Object.keys(R.byId).length,119);
assert.equal(Object.keys(R.byKey).length,119);
function def(id,stage){
 const entry=R.byId[id],base=db.items[entry.key];assert.ok(base,`live DB item missing: ${entry.key}`);
 const saved=JSON.stringify(base),out=copy(base);out.relicBase=entry.key;
 const [n,asc]=[[0,null],[5,null],[10,null],[15,0],[15,5]][stage];
 assert.equal(R.configure(out,base,n,asc),true);assert.equal(JSON.stringify(base),saved,`configuration mutated ${entry.key}`);
 assert.equal(out.relicCatalogId,id);assert.equal(out.relicStage,stage);assert.ok(out.relicLore&&out.relicEffectsText&&out.d);
 return out;
}
for(let id=132;id<=250;id++)for(let stage=0;stage<=4;stage++)def(id,stage);

function arena(id,stage=4){
 const actor={hp:500,mhp:1000,mp:0,mmp:100,lv:50,d:{wis:20,str:20,con:20,er:20,weightCapacity:2000},eq:{},buffs:{},st:{}},ally={hp:300,mhp:1000,mp:0,mmp:100,d:{},st:{}},pet={hp:300,mhp:500,mp:0,mmp:100,lv:20,st:{}},summon={hp:400,mhp:800,mp:0,mmp:100,skId:'sk_zombie',st:{}};
 const targets=[{hp:100000,mhp:100000,curHp:100000,st:{},e:'none',race:'人類',n:'甲'},{hp:100000,mhp:100000,curHp:100000,st:{},e:'water',race:'不死',n:'乙'}];
 const states=new WeakMap(),cds=new WeakMap(),events=[],pending=[];let clock=0,random=0;
 const state=(x,k)=>{assert.ok(x,`state actor missing for ${id}`);if(!states.has(x))states.set(x,{});const z=states.get(x);return z[k]||(z[k]={});};
 const api={random:()=>random,hp:x=>x?.curHp??x?.hp??0,mhp:x=>x?.mhp??x?.hp??0,state,targets:()=>targets.filter(x=>x.curHp>0),team:()=>[actor,ally],pets:()=>[pet],summons:()=>[summon],
 cooldown(x,source,key,seconds){if(!cds.has(x))cds.set(x,{});const bag=cds.get(x),k=source+':'+key;if((bag[k]??-1)>clock)return false;bag[k]=clock+seconds;return true;},
 damage(x,amount,opts){assert.ok(x,`damage target missing for ${id}`);assert.ok(Number.isFinite(amount),`nonfinite damage for ${id}`);const got=Math.min(api.hp(x),Math.max(0,amount));if(x.curHp!=null)x.curHp-=got;else x.hp-=got;events.push({kind:'damage',target:x,amount:got,opts});return got;},
 dot(x,kind,opts){events.push({kind:'dot',target:x,dotKind:kind,opts});x.st[kind]=opts.duration;return true;},
 heal(x,amount,opts){assert.ok(Number.isFinite(amount),`nonfinite heal for ${id}`);assert.ok(opts.cd>=10,`relic heal bypassed minimum cooldown for ${id}`);if(!opts.prepaid&&!api.cooldown(opts.owner||actor,opts.source,'heal',Math.max(10,opts.cd)))return 0;const healed=Math.max(0,Math.min(amount,api.mhp(x)-api.hp(x)));if(x.curHp!=null)x.curHp+=healed;else x.hp+=healed;events.push({kind:'heal',target:x,amount:healed,requested:amount,opts});return healed;},
 shield(x,amount,opts){assert.ok(Number.isFinite(amount));events.push({kind:'shield',target:x,amount,opts});},
 cast(x,skillId,opts){assert.ok(x);events.push({kind:'cast',target:x,skillId,opts});return opts.count||1;},
 buff(x,key,values,duration){events.push({kind:'buff',target:x,key,values,duration});return values;},
 status(x,kind,duration,strength){if(x.immune?.includes(kind))return false;x.st??={};x.st[kind]=duration;events.push({kind:'status',target:x,status:kind,duration,strength});return true;},
 mp(x,amount){const before=x.mp||0;x.mp=Math.max(0,Math.min(x.mmp||100,before+amount));events.push({kind:'mp',target:x,amount:x.mp-before});return x.mp-before;},
 hasStatus:(x,k)=>Boolean(x?.st?.[k]),removeStatus(x,k){if(x?.st)delete x.st[k];},hasMark:()=>false,mark(x,k,duration){events.push({kind:'mark',target:x,mark:k,duration});},
 delay(sec,fn){pending.push({at:clock+sec,fn});},hasDot:(x,k)=>Boolean(x?.st?.[k]),transferDots(x,y,opts){events.push({kind:'transfer',target:y,from:x,opts});},
 healSpellAmount:()=>100,immuneTo:(x,k)=>Boolean(x?.immune?.includes(k)),threat(x,mult){events.push({kind:'threat',target:x,mult});},payHp(x,amount){x.hp-=Math.min(x.hp-1,amount);},
 summonSkeleton(x,opts){events.push({kind:'skeleton',target:x,opts});},companionAttack(x,companion,target,opts){events.push({kind:'companionAttack',target,companion,opts});},downedCompanions:()=>[],hasReviveScroll:()=>true,revive:()=>true,reduceCompanionSkillCooldown(x,mult){events.push({kind:'petCooldown',target:x,mult});}
 };
 const item=def(id,stage),sourceId=R.byId[id].key,base={actor,item,source:item,sourceId,catalogId:id,stage,battleId:1,main:true,direct:true,origin:'normal',kind:'melee',damage:100,snapshot:100,actualDamage:100,target:targets[0],targetHpBefore:100000};
 return{actor,ally,pet,summon,targets,events,api,state,item,sourceId,get clock(){return clock;},set random(x){random=x;},run(event,extra={}){const ctx={...base,...extra,now:clock};R.dispatch(event,ctx,api);return ctx;},advance(n){clock+=n;for(const p of pending.splice(0))if(p.at<=clock)p.fn();else pending.push(p);},hurt(extra={}){const c=this.run('beforeHurt',extra);c.actualDamage=c.damage;this.run('afterHurt',c);return c;}};
}

// Chains bind each attacker separately; their upper bound cannot turn damage negative.
{const q=arena(133);for(let i=0;i<5;i++)q.hurt({damage:1000});assert.equal(q.run('beforeHurt',{damage:1000}).damage,237.5);assert.equal(q.run('beforeHurt',{damage:1000,target:q.targets[1]}).damage,950);assert.equal(q.run('beforeHurt',{damage:10}).damage,0);}
// A riddle's third matching attack is nullified, and a new attacker starts its own sequence.
{const q=arena(151);assert.equal(q.hurt().damage,50);assert.equal(q.hurt().damage,50);assert.equal(q.hurt().damage,0);assert.equal(q.hurt().damage,50);assert.equal(q.hurt({target:q.targets[1]}).damage,50);}
// Full-health execution cannot execute a boss; its authorized multiplier still applies.
{const q=arena(156);let c=q.run('beforeAttack');assert.equal(c.relicFullExecuteChance,1);q.targets[0].boss=true;c=q.run('beforeAttack');assert.equal(c.relicFullExecuteChance,undefined);assert.equal(c.damage,800);}
// Poison/bleed crit upgrades guarantee 3× without lowering an already higher multiplier.
{const q=arena(139,3);let c=q.run('beforeDot',{dotKind:'poison',critChance:.1,critMult:1.5});assert.equal(c.critChance,1);assert.equal(c.critMult,3);c=q.run('beforeDot',{dotKind:'bleed',critMult:4});assert.equal(c.critMult,4.5);}
// Poison healing belongs to this item's own damage, with a single ten-second source clock.
{const q=arena(143);q.run('afterDot',{dotKind:'poison',dotSourceId:'other',actualDamage:100});assert.equal(q.actor.hp,500);q.run('afterDot',{dotKind:'poison',dotSourceId:q.sourceId,actualDamage:100});assert.equal(q.actor.hp,540);q.run('afterDot',{dotSourceId:q.sourceId,actualDamage:100});assert.equal(q.actor.hp,540);q.advance(10);q.run('afterDot',{dotSourceId:q.sourceId,actualDamage:100});assert.equal(q.actor.hp,580);}
// Party heals pay the cooldown once, not once per recipient, and all branches share it.
{const q=arena(197);q.run('afterHit',{element:'water',actualDamage:1000});assert.equal(q.actor.hp,600);assert.equal(q.ally.hp,400);q.run('afterHit',{element:'water',actualDamage:1000});assert.equal(q.actor.hp,600);assert.equal(q.ally.hp,400);q.advance(10);q.run('afterHit',{element:'water',actualDamage:1000});assert.equal(q.ally.hp,500);}
// Limited invulnerability prevents the lethal hit before settlement; it never heals incidentally.
{const q=arena(172);q.run('battleStart');const c=q.run('beforeDeath',{damage:800});assert.equal(c.preventDeath,true);assert.equal(c.hpFloor,1);assert.equal(c.damage,499);assert.equal(q.actor.hp,500);assert.equal(q.run('beforeDeath',{damage:800}).preventDeath,undefined);q.run('battleStart',{battleId:2});assert.equal(q.run('beforeDeath',{damage:800,battleId:2}).preventDeath,true);}
// Egg saves consume one egg and use a thirty-second shared healing clock for the whole party.
{const q=arena(184);q.run('battleStart');assert.equal(q.run('beforeDeath',{damage:2000}).preventDeath,true);assert.equal(q.actor.hp,1000);assert.equal(q.ally.hp,600);q.advance(10);assert.equal(q.run('beforeDeath',{damage:2000}).preventDeath,undefined);q.advance(20);assert.equal(q.run('beforeDeath',{damage:2000}).preventDeath,true);assert.equal(q.state(q.actor,q.sourceId).eggs,4);}
// Replica spells copy the pre-reaction main damage and cannot trigger mark reactions again.
{const q=arena(244);q.run('afterHit',{skillId:'sk_ice_spike',damage:800,snapshot:100});const copies=q.events.filter(x=>x.kind==='damage');assert.equal(copies.length,4);assert.ok(copies.every(x=>x.amount===50&&x.opts.snapshot&&x.opts.consumeMarks===false&&x.opts.applyMarks===false));}
// Mana shared by the spectral garment is based on actual recovery, never requested overfill.
{const q=arena(223);q.actor.mp=90;q.run('afterHurt',{kind:'dot',direct:false,dotKind:'burn',actualDamage:100});assert.equal(q.actor.mp,100);assert.equal(q.ally.mp,5);const c=q.run('beforeCast',{skillId:'sk_fireball',mpCost:100});assert.equal(c.mpCost,80);assert.equal(c.damageMult,2);q.run('onCast',{...c,success:true});assert.equal(q.run('beforeCast',{skillId:'sk_fireball',mpCost:100}).damageMult,undefined);}
// A completed wish cycle refreshes at twenty seconds without resetting shared healing clocks.
{const q=arena(225);q.run('battleStart');q.run('beforeDeath',{damage:2000});q.run('tick');q.advance(10);q.run('tick');assert.equal(q.state(q.actor,q.sourceId).wishResetAt,30);q.advance(19);q.run('tick');assert.equal(q.state(q.actor,q.sourceId).wishes.life,true);q.advance(1);q.run('tick');assert.equal(q.state(q.actor,q.sourceId).wishes.life,false);assert.equal(q.state(q.actor,q.sourceId).victory.value,3);}
// The tail's emergency save and ordinary low-health heal share one healing source.
{const q=arena(240);q.actor.hp=100;q.run('afterHurt');assert.equal(q.actor.hp,300);assert.equal(q.run('beforeDeath',{damage:2000}).preventDeath,undefined);q.advance(10);assert.equal(q.run('beforeDeath',{damage:2000}).preventDeath,true);assert.equal(q.run('beforeDeath',{damage:2000}).preventDeath,undefined);}
// Potion shielding uses overflow, while party healing remains behind the relic's ten-second CD.
{const q=arena(229);q.run('onPotion',{actualHeal:100,overheal:200});q.run('onPotion',{actualHeal:100,overheal:200});assert.equal(q.events.filter(x=>x.kind==='shield').length,2);assert.equal(q.ally.hp,330);q.advance(10);q.run('onPotion',{actualHeal:100,overheal:0});assert.equal(q.ally.hp,360);}
// Existing pet stats do not receive the "revived this battle" multiplier before a revival.
{const q=arena(245);assert.equal(q.run('onCompanionStats',{companion:q.pet,companionKind:'pet',stats:{},battleId:undefined}).maxHpMult,undefined);q.run('petRevive',{companion:q.pet});let c=q.run('onCompanionStats',{companion:q.pet,companionKind:'pet',stats:{}});assert.equal(c.maxHpMult,2);assert.equal(c.directDamageMult,3);assert.equal(q.run('onCompanionStats',{companion:q.pet,companionKind:'pet',stats:{},battleId:2}).maxHpMult,undefined);}
// Refund counts actual positive spell payments; free item procs cannot generate mana.
{const q=arena(248);for(let i=0;i<3;i++)q.run('onCast',{paidMp:20,origin:'relic'});assert.equal(q.actor.mp,0);for(let i=0;i<3;i++)q.run('onCast',{paidMp:0});assert.equal(q.actor.mp,0);for(let i=0;i<3;i++)q.run('onCast',{paidMp:20});assert.equal(q.actor.mp,60);}
// Boss hits only store meat. Healing happens in the later low-health branch, not for free per hit.
{const q=arena(250);q.targets[0].boss=true;for(let i=0;i<5;i++)q.run('afterHit');assert.equal(q.state(q.actor,q.sourceId).meat,1);assert.equal(q.actor.hp,500);q.actor.hp=300;q.run('afterHurt');assert.equal(q.actor.hp,800);assert.equal(q.state(q.actor,q.sourceId).meat,0);}
// Enhanced fire shields and death books replace legacy proc fields instead of doubling them.
{assert.equal(def(173,4).dmgReflect,undefined);assert.equal(def(175,4).block,undefined);assert.equal(def(196,4).necroBook,true);assert.equal(def(196,4).killTeamHealPct,undefined);assert.equal(def(196,4).relicNecro.cap,20);assert.equal(def(237,4).thorns,undefined);}
// Target marks are team-visible; snapshot copies skip the amplifier so no multiplier is squared.
{const q=arena(138);q.run('afterHit');const c={actor:q.ally,target:q.targets[0],damage:100,now:0,kind:'melee',direct:true};R.targetModifiers(c,q.api);assert.equal(c.damage,120);c.damage=100;c.snapshotCopy=true;R.targetModifiers(c,q.api);assert.equal(c.damage,100);}

// Exercise every event/tier with live DB data; this catches unresolved spells and invalid amounts.
const eventNames=['battleStart','onStats','beforeAttack','miss','afterHit','beforeHurt','afterHurt','beforeDeath','onStatusAttempt','onStatusEnd','onKill','tick','beforeCast','onCast','beforeHeal','onHeal','onPotion','beforeDot','afterDot','shieldBreak','onMarkConsume','onCompanionStats','beforePetSkillCost','petHit','petHurt','petRevive','summonLimit','petSlots','trackingChance','trackingHit','threat','knockback','regen','beforeAllyHurt','move','battleEnd'];
let eventChecks=0;
for(let id=132;id<=250;id++)for(let stage=1;stage<=4;stage++){
 const q=arena(id,stage);
 for(const event of eventNames){const c=q.run(event,{stats:{er:20,wis:20,weightCapacity:2000},critical:true,heavy:true,skillId:event==='beforeCast'?'sk_fireball':undefined,attacker:q.targets[0],statusKind:'paralyze',applied:true,immune:true,duration:10,companion:q.pet,companionKind:'pet',recipient:q.ally,value:5,mpCost:100,paidMp:10,actualHeal:100,amount:100,inBattle:true,stationaryFor:5,movingFor:5,equippedWeight:1000,weightCapacity:2000});assert.ok(Number.isFinite(c.damage),`nonfinite event result: ${id}/${stage}/${event}`);eventChecks++;}
 q.advance(15);
 for(const e of q.events)if(e.kind==='cast'&&e.skillId!=='auto')assert.ok(db.skills[e.skillId],`unresolved skill: ${id}/${stage}/${e.skillId}`);
}
console.log(`Defense relic tests passed: 119 live definitions × 5 states; 19 behavioral regressions; ${eventChecks} event checks.`);
