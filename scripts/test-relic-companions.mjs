import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const noop=()=>{};let serial=0;
const env={console:{log:noop,warn:noop},addEventListener:noop,document:{getElementById:()=>null,addEventListener:noop,readyState:'loading'},location:{hostname:'localhost'},localStorage:{getItem:()=>null,setItem:noop},setTimeout:noop,setInterval:noop,Date,Math:Object.create(Math),URL,
 player:null,state:{ticks:0,running:true},mapState:{current:'test',mobs:[]},outPets:[],_combatSrc:null,
 logCombat:noop,logSys:noop,renderMobs:noop,renderSquadPanel:noop,saveGame:noop,updateUI:noop,petMarkDirty:noop,
 uid:()=>`unit-${++serial}`,newMobStatus:()=>({}),roll:(n,s)=>n*s,capEn:x=>x,hasMastery:()=>false,stretchHitValue:x=>x,mobEffAC:x=>x.ac||0,mrMult:()=>1,elementCounterMult:()=>1,
 traumaPhysicalBonus:()=>0,markBossPhysicalHit:noop,mobWake:noop,terrorVisageOnDamage:noop,petGearBonus:()=>({hit:0,dmg:0}),summonGearBonus:()=>({hit:0,dmg:0}),getMobColor:()=>'',riftDamageMult:()=>1,
 tamerAuraHit:()=>0,effResistPct:x=>x,hasSummonCtrlRing:()=>false,playerHasAutoReviveEarring:()=>false,hasLoadFreeRegen:()=>false,computeThreatMult:()=>2,
 summonElementDamage:(dice,ele,t,flat,mult)=>(dice[0]*dice[1]+flat)*(mult||1),summonHitValue:()=>20,summonDamageMult:sm=>sm.dmgMult||1,
 rollHealingSpell:(sk,d,caster,target)=>target.statuses?.foulWater||target._statuses?.foulWater?50:100,
 killMob(i){const m=env.mapState.mobs[i];if(m){m.curHp=0;m._dead=true;}},getTarget:()=>env.mapState.mobs.find(x=>x.curHp>0)};
env.Math.random=()=>.01;env.window=env;vm.createContext(env);
for(const file of ['js/00-data.js','js/22-pets.js','js/23-summons.js','afk-relic-defense.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),env,{filename:file});
const db=vm.runInContext('DB',env),D=env.AFK_RELIC_DEFENSE;
env.petsOutList=()=>env.outPets;env.renderSummonPanel=noop;env.petMarkDirty=noop;env._petInWild=()=>true;
const states=new WeakMap(),cooldowns=new WeakMap();let active=null,battle=1;
const hp=e=>e?.curHp??e?.hp??0,mhp=e=>e?.mhp??e?.hp??1;
function memory(e,key){if(!states.has(e))states.set(e,{});const st=states.get(e);return st[key]||(st[key]={});}
function sources(e){return Object.values(e?.eq||{}).map(x=>db.items[x.id]).filter(d=>d&&d.relicCatalogId).map(d=>({catalogId:d.relicCatalogId,def:d,key:d.relicBase,sourceId:d.relicBase,stage:d.relicStage,n:d.relicPlus,asc:d.relicAsc}));}
const R=env.AFK_RELIC_RUNTIME={state:memory,sources,api:{now:()=>env.state.ticks/10,hp,mhp,state:memory,activeContext:()=>active,targets:()=>env.mapState.mobs.filter(x=>hp(x)>0),
 cooldown(owner,src,key,sec){if(!cooldowns.has(owner))cooldowns.set(owner,{});let c=cooldowns.get(owner),k=src+':'+key,now=env.state.ticks/10;if((c[k]??-1)>now)return false;c[k]=now+sec;return true;},
 heal(e,amount,opt){if(!opt.prepaid&&!R.api.cooldown(opt.owner,opt.source,'heal',Math.max(10,opt.cd||10)))return 0;const n=Math.max(0,Math.min(amount,R.api.mhp(e)-hp(e)));if(e.curHp!=null)e.curHp+=n;else e.hp+=n;return n;},
 buff(e,key,values,duration){memory(e,'_buffs')[key]={values,until:env.state.ticks/10+duration};return values;},mp(e,n){const old=e.mp;e.mp=Math.min(e.mmp,Math.max(0,old+n));return e.mp-old;},
 removeStatus:noop,hasStatus:()=>false,delay:noop,random:()=>.01,shield:noop,status:()=>true,hasMark:()=>false,mark:noop,
 damage(e,n){const actual=Math.min(hp(e),n);if(e.curHp!=null)e.curHp-=actual;else e.hp-=actual;return actual;},dot:()=>true
 },
 dispatch(event,c,only){c.now=env.state.ticks/10;c.battleId=battle;c.inBattle=true;c.stationaryFor=5;const old=active;for(const s of only?[only]:sources(c.actor)){Object.assign(c,{source:s.def,item:s.def,catalogId:s.catalogId,sourceId:s.key,stage:s.stage,n:s.n,asc:s.asc});active=c;if(s.catalogId>=132)D.dispatch(event,c,R.api);}active=old;return c;},
 incoming(e,n,enemy,opt){const buffs=memory(e,'_buffs');for(const b of Object.values(buffs))if(b.until>env.state.ticks/10&&b.values.invulnerable)n=0;memory(e,'incoming').pending={...opt,hpBefore:hp(e),damage:n,actualDamage:n,target:enemy};return n;},
 afterIncoming(e,n){return memory(e,'incoming').pending||{actualDamage:n};},
 companionDamage(owner,e,t,n,extra){const C=env.AFK_RELIC_COMPANIONS,meta=C.companionContext(owner,e,extra),c={actor:owner,owner,companion:e,pet:e,target:t,damage:n*C.damageMult(owner,e)*(meta.mult||1),snapshot:n,targetHpBefore:hp(t),actualDamage:n,main:false,direct:true,...extra,...meta};c.kind=extra.skillId?'magic':'melee';const q=memory(owner,'_companions');(q.hits||(q.hits=[])).push(c);return c.damage;},
 flushCompanionHits(owner){const q=memory(owner,'_companions'),hits=q.hits||[];q.hits=[];for(const c of hits){c.actualDamage=Math.max(0,Math.min(c.damage,c.targetHpBefore-hp(c.target)));R.dispatch('petHit',c);}}
};
vm.runInContext(fs.readFileSync(path.join(root,'afk-relic-companions.js'),'utf8'),env);
const C=env.AFK_RELIC_COMPANIONS;
function actor(){return{uid:`actor-${++serial}`,cls:'mage',lv:72,hp:1000,mhp:2000,mp:100,mmp:200,d:{cha:100,wis:20,magicDmg:0},eq:{},skills:[],grantedSkills:[],buffs:{},statuses:{},allies:[],inv:[],config:{autoBuffSkills:{}},summonsV2:[]};}
function reset(){env.player=actor();env.outPets=[];env.mapState.mobs=[{uid:`mob-${++serial}`,id:'wolf',n:'敵人',lv:1,e:'none',race:'人類',hp:1e8,curHp:1e8,dr:0,ac:0,mr:0,st:{},dmg:[1,100],db:0}];env.state.ticks+=1000;battle++;return env.player;}
function equip(p,id,stage=4,slot){const entry=D.byId[id],b=db.items[entry.key],d=JSON.parse(JSON.stringify(b));d.relicBase=entry.key;d.relicPlus=stage===1?5:10;d.relicAsc=stage>=3?stage===4?5:0:null;D.configure(d,b,d.relicPlus,d.relicAsc);const key=`test-${id}-${++serial}`;db.items[key]=d;p.eq[slot||b.slot||'shield']={id:key};return d;}
function pet(form='狐狸'){const x={uid:`pet-${++serial}`,form,lv:20,hp:100,mhp:100,mp:100,mmp:100,eq:{},_statuses:{},_atkCd:0,_castCd:0};env.outPets.push(x);return x;}

// Upgraded/GM-backed book identification retains learned-skill and auto-cast eligibility.
{
 const p=reset();equip(p,196);assert.equal(env.necroBookEquipped(p),true);assert.equal(C.summonSkeleton(p,{count:3,cap:20}),0);assert.deepEqual(p.skills,[]);
 p.skills=['sk_zombie'];assert.equal(C.summonSkeleton(p,{count:3,cap:20}),0);p.config.autoBuffSkills.sk_zombie=true;
 const enemy=env.mapState.mobs[0];R.dispatch('onKill',{actor:p,target:enemy});assert.equal(env.necroSkeletonList().length,3);R.dispatch('onKill',{actor:p,target:enemy});assert.equal(env.necroSkeletonList().length,3);
 for(let i=0;i<12;i++)R.dispatch('onKill',{actor:p,target:{race:'人類',hp:1,curHp:0}});assert.equal(env.necroSkeletonList().length,20);assert.ok(env.necroSkeletonList().every(e=>e.mhp===960));
 const base=env.necroSkeletonList()[0],d=env._necroSkeletonDerive(base,p);assert.equal(d.dmgMult,2);env.necroBookOnKill(enemy);assert.equal(env.necroSkeletonList().length,20);
}
// Multiple book holders share the global cap and only generate one group per kill.
{
 const p=reset(),a=actor();a._slot='2';a.curHp=1000;p.allies=[a];for(const owner of [p,a]){equip(owner,196);owner.skills=['sk_zombie'];owner.config.autoBuffSkills.sk_zombie=true;}
 for(let i=0;i<9;i++){const target={race:'人類',hp:1,curHp:0};R.dispatch('onKill',{actor:p,target});R.dispatch('onKill',{actor:a,target});}
 assert.equal(env.necroSkeletonList().length,20);assert.equal(env.necroSkeletonList().filter(e=>C.ownerOf(e)===p).length,10);assert.equal(R.api.pets(a).length,0);
}
// Live native pet maxima and damage have one multiplier; stored pet stats are untouched.
{
 const p=reset(),e=pet();equip(p,152);assert.equal(env.petMhpEff(e),200);assert.equal(e.mhp,100);assert.equal(C.damageMult(p,e),1.5);const t=env.mapState.mobs[0],before=t.curHp;env.petAttackOnce(e,env.petDerive(e),t);assert.ok(t.curHp<before);assert.equal(e.hp,100+(before-t.curHp)*.1);const healed=e.hp;env.petAttackOnce(e,env.petDerive(e),t);assert.equal(e.hp,healed);assert.equal(R.api.mhp(e),200);
}
// Cost reductions affect affordability before choosing a native skill, not a later MP refund.
{
 const p=reset(),e=pet();equip(p,188,2);e.mp=5;const t=env.mapState.mobs[0],before=t.curHp;assert.equal(C.petSkillCost(e,6),5);assert.equal(env.petCastSkill(e,env.petDerive(e),t),true);assert.equal(e.mp,0);assert.ok(t.curHp<before);
}
// Three native skill actions shorten the NEXT wait. AOE counts once; free commands do not train.
{
 const p=reset(),e=pet('黃金龍');equip(p,188,3);env.mapState.mobs.push({...env.mapState.mobs[0],uid:'second',curHp:1e8});const t=env.mapState.mobs[0];
 for(let i=0;i<3;i++)env.petCastSkill(e,env.petDerive(e),t);assert.equal(C.nextPetSkillWait(e,20),10);assert.equal(C.nextPetSkillWait(e,20),20);
 const src=D.byId[188].key;assert.equal(memory(e,src).skillCount,0);e.mp=0;for(let i=0;i<3;i++)assert.equal(C.companionAttack(p,e,t,{skill:true,free:true}),1);assert.equal(e.mp,0);assert.equal(memory(e,src).skillCount,0);
}
// One additional deployment slot does not alter charm or storage requirements.
{const p=reset();assert.equal(C.petSlots(4),4);equip(p,230);assert.equal(C.petSlots(4),5);}
// Team-wide training uses the highest same-source tier once, including an ally holder.
{
 const p=reset(),e=pet(),ally=actor();ally.curHp=1000;p.allies=[ally];equip(p,188,2);equip(ally,188,3);assert.equal(C.petSkillCost(e,8),6);
 const t=env.mapState.mobs[0];for(let i=0;i<3;i++)env.petCastSkill(e,env.petDerive(e),t);assert.equal(C.nextPetSkillWait(e,20),10);assert.equal(memory(e,D.byId[188].key).skillCount,0);
}
// High-level summon caps expand without accidentally multiplying zombies or spirit HP.
{
 const p=reset();equip(p,189);assert.equal(env.hasSummonCtrlRing(p),true);assert.equal(env._sumCountFor('黑豹',p),11);
 const s={skId:'sk_summon',form:'哈柏哥布林',hp:100,mhp:100,lv:20},z={skId:'sk_zombie',form:'人形殭屍',hp:100,mhp:100,lv:20};env._sumDeriveAny(s,p);env._sumDeriveAny(z,p);assert.equal(s.mhp,200);assert.equal(z.mhp,100);env._sumDeriveAny(s,p);assert.equal(s.mhp,200);assert.equal(C.damageMult(p,s),1.5);
}
// Relic revival consumes exactly one scroll, fully restores its declared fraction, and protects pre-damage.
{
 const p=reset(),e=pet();e._downed=true;e.hp=0;p.inv=[{id:'scroll_revive',cnt:2,uid:'scroll'}];assert.equal(C.revive(e,{owner:p,source:'revive-test',hpPct:.8,consumeScroll:true,invulnerable:5}),true);assert.equal(p.inv[0].cnt,1);assert.equal(e.hp,80);assert.equal(C.incoming(e,10000,env.mapState.mobs[0],{kind:'magic'}),0);assert.equal(C.revive(e,{hpPct:1,consumeScroll:true}),false);assert.equal(p.inv[0].cnt,1);
}
// Pet devotion is keyed to a real revival in this battle and does not compound on repeat revival.
{
 const p=reset(),e=pet();equip(p,245);assert.equal(C.damageMult(p,e),1);env.petDevotionGrant(e);assert.equal(env.petMhpEff(e),200);assert.equal(C.damageMult(p,e),3);env.petDevotionGrant(e);assert.equal(env.petMhpEff(e),200);assert.equal(C.damageMult(p,e),3);battle++;assert.equal(env.petMhpEff(e),100);assert.equal(C.damageMult(p,e),1);
}
// Extra kings use the existing native king specification and never occupy the regular summon list.
{
 const p=reset(),d={relicCatalogId:98,relicBase:'test-fire-king',relicStage:4,relicExtraKings:{element:'fire',count:2}};db.items.king=d;p.eq.wpn={id:'king'};
 const kings=C.summonKing('fire',2,{source:d.relicBase,owner:p});assert.equal(kings.length,2);assert.equal(p.summonsV2.length,0);assert.equal(env.summonV2List().length,2);assert.equal(kings[0].mhp,1200);C.summonKing('fire',2,{source:d.relicBase,owner:p});assert.equal(C.extraKings(p).length,2);
 const t=env.mapState.mobs[0];C.commandKings('fire',t,5,{source:d.relicBase,owner:p});assert.equal(env._petPickTarget(kings[0]),t);const before=t.curHp;env.spiritAttackOnce(kings[0],t,p);assert.ok(t.curHp<before);
}
// Natural regen, tracking and threat hooks resolve only equipped relics; no shared heal CD is spent.
{const p=reset();equip(p,239);assert.equal(C.regenAmount(p,60,'hp'),120);assert.equal(env.hasLoadFreeRegen(),true);equip(p,231,4,'ear');assert.equal(C.trackingChance(.5),1);equip(p,153,4,'armor');assert.equal(env.computeThreatMult(p),4);}
// Native heal rolls omit foul-water reduction; the runtime applies it exactly once afterwards.
{const p=reset(),e=pet();e._statuses.foulWater=10;assert.equal(R.api.healSpellAmount(e,'sk_heal1',p),100);assert.equal(e._statuses.foulWater,10);}
// GM stat projection keeps the physical inventory's weight and grants each source's capacity once.
{
 const p=reset();db.items['weight-base']={n:'重鎧',weightCap:100};db.items['weight-plus']={n:'重鎧＋10',relicBase:'weight-base',weight:500,weightCap:200};
 db.items['weight-gm']={gmOnly:true,weight:0};db.items['weight-belt']={slot:'belt',weight:20,weightCap:50};
 const real={armor:{id:'weight-plus'},belt:{id:'weight-belt',en:4},wpn:{id:'weight-gm'}};p.eq={wpn:real.wpn,_gm_200:{id:'weight-plus',_relicVirtual:true}};
 env.AFK_RELIC_GM={realEquipment:()=>real};assert.equal(C.weightInfo(p,{weightCapacity:1500}).equippedWeight,520);assert.equal(C.equipmentCapacity(p,0),330);assert.equal(C.weightInfo(p,{weightCapacity:1500}).weightCapacity,1500);delete env.AFK_RELIC_GM;
}
// The installed mhp API reads the captured native pet maximum; it never calls itself.
{
 const p=reset(),e=pet();equip(p,152);let petReads=0;const original=R.api.mhp;R.api.mhp=function(x){if(x===e)assert.equal(++petReads,1,'pet maximum must not recurse through runtime API');return C.maxHp(x);};assert.equal(R.api.mhp(e),200);assert.equal(petReads,1);R.api.mhp=original;
}
console.log('Companion bridge tests passed: 15 native integration regressions (book gates/cap, skill payment/waits, HP/damage, revival, kings, source queries, GM weight).');
