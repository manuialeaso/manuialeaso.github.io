import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const env={console:{log(){},warn(){}},document:{readyState:'loading',addEventListener(){}},location:{hostname:'localhost'},setTimeout(){},setInterval(){},localStorage:{getItem(){return null},setItem(){}},URL,Math,Date};
env.window=env;vm.createContext(env);
vm.runInContext(fs.readFileSync(path.join(root,'js/00-data.js'),'utf8'),env);
vm.runInContext(fs.readFileSync(path.join(root,'afk-relic-weapons.js'),'utf8'),env);
const db=vm.runInContext('DB',env),W=env.AFK_RELIC_WEAPONS;
const cp=x=>JSON.parse(JSON.stringify(x));
assert.equal(W.entries.length,131);
assert.equal(new Set(W.entries.map(x=>x.key)).size,131);
function def(id,stage){const m=W.byId[id],b=db.items[m.key];assert.ok(b,`missing live DB item ${m.key}`);const saved=JSON.stringify(b),d=cp(b);d.relicBase=m.key;const [n,asc]=[[0,null],[5,null],[10,null],[15,0],[15,5]][stage];W.configure(d,b,n,asc);assert.equal(JSON.stringify(b),saved,`${id}: configuration mutates base`);return d;}
for(const m of W.entries)for(let s=0;s<=4;s++){const d=def(m.id,s);assert.equal(d.relicCatalogId,m.id);assert.equal(d.relicWeaponStage,s);assert.ok(d.d);}
function arena(id,stage=4){
 const actor={hp:500,mhp:1000,mp:0,mmp:100,lv:50,eq:{},buffs:{},statuses:{}},targets=[{hp:10000,curHp:10000,st:{},e:'none',n:'測試甲'},{hp:10000,curHp:10000,st:{},e:'water',n:'測試乙'}];
 const states=new WeakMap(),cds=new WeakMap(),events=[],pending=[];let clock=0;
 const state=(x,k)=>{if(!states.has(x))states.set(x,{});const z=states.get(x);return z[k]||(z[k]={});};
 const api={random:()=>0,hp:x=>x.curHp??x.hp,mhp:x=>x.mhp??x.hp,state,targets:()=>targets.filter(x=>x.curHp>0),team:()=>[actor],pets:()=>[],summons:()=>[],
 cooldown(x,source,key,seconds){if(!cds.has(x))cds.set(x,{});const bag=cds.get(x),k=source+':'+key;if((bag[k]??-1)>clock)return false;bag[k]=clock+seconds;return true;},
 damage(x,amount,opts){const got=Math.min(x.curHp??x.hp,Math.max(0,amount));if(x.curHp!=null)x.curHp-=got;else x.hp-=got;events.push({kind:'damage',target:x,amount:got,opts});return got;},
 dot(x,kind,opts){events.push({kind:'dot',target:x,dotKind:kind,opts});x.st[kind]=opts.duration;},
 heal(x,amount,opts){if(!api.cooldown(actor,opts.source,'heal',Math.max(10,opts.cd)))return false;const healed=Math.min(amount,x.mhp-x.hp);x.hp+=healed;events.push({kind:'heal',target:x,amount:healed,opts});return healed;},
 healGroup(entries,opts){if(!api.cooldown(actor,opts.source,'heal',Math.max(10,opts.cd)))return false;for(const e of entries){const healed=Math.min(e.amount,e.actor.mhp-e.actor.hp);e.actor.hp+=healed;events.push({kind:'heal',target:e.actor,amount:healed,opts});}return true;},
 shield(x,amount,opts){events.push({kind:'shield',target:x,amount,opts});},
 cast(x,skillId,opts){events.push({kind:'cast',target:x,skillId,opts});return 100;},
 buff(x,key,values,duration){events.push({kind:'buff',target:x,key,values,duration});},
 status(x,kind,duration,strength){x.st??={};x.st[kind]=duration;events.push({kind:'status',target:x,status:kind,duration,strength});},
 mp(x,amount){x.mp=Math.min(x.mmp??100,(x.mp||0)+amount);},hasStatus:(x,k)=>Boolean(x.st?.[k]||x.statuses?.[k]),removeStatus(x,k){if(x.st)delete x.st[k];if(x.statuses)delete x.statuses[k];},hasMark:()=>false,mark(){},delay(sec,fn){pending.push({at:clock+sec,fn});},dotLayers:()=>0,dotDamage:()=>0};
 const item=def(id,stage),base={actor,item,sourceId:W.byId[id].key,catalogId:id,stage,main:true,direct:true,origin:'normal',damage:100,snapshot:100,actualDamage:100,target:targets[0],targetHpBefore:10000};
 return{actor,targets,events,api,state,item,run(event,extra={}){const ctx={...base,...extra,now:clock};W.dispatch(event,ctx,api);return ctx;},advance(n){clock+=n;for(const p of pending.splice(0))if(p.at<=clock)p.fn();else pending.push(p);}};
}
// All-target ascension bleed carries one source and the exact layer/time contract.
{
 const q=arena(1);q.run('hit');const dots=q.events.filter(e=>e.kind==='dot');assert.equal(dots.length,2);for(const e of dots){assert.equal(e.opts.layers,10);assert.equal(e.opts.damage,100);assert.equal(e.opts.duration,15);assert.equal(e.opts.ascended,true);}
}
// The final werewolf tier inherits five layers; older implementation accidentally dropped to one.
{
 const q=arena(27);q.run('hit');const d=q.events.find(e=>e.kind==='dot');assert.equal(d.opts.layers,5);assert.equal(d.opts.damage,50);assert.ok(d.opts.duration>10000);
}
// A finite interval penalty replaces the undefined minus-100-percent speed.
{for(const stage of [1,2,3,4]){const q=arena(26,stage),c=q.run('onStats',{stats:{aspd:1}});assert.equal(c.stats.aspd,stage===1?2:3);assert.equal(q.item.atkSpdPct,0);}}
// Companion ascension totals replace +10 rather than adding a second +30.
{const d=def(18,4);assert.equal(d.petDmgAll,30);assert.equal(d.petHitAll,30);assert.equal(d.summonDmg,30);assert.equal(d.relicCompanionDamageMult,2);}
// A final group heal includes the spring and shares a single twenty-second clock.
{
 const q=arena(23);q.actor.hp=100;q.run('hit');assert.equal(q.actor.hp,1000);q.actor.hp=100;q.advance(10);q.run('hit');assert.equal(q.actor.hp,100);q.advance(10);q.run('hit');assert.equal(q.actor.hp,1000);
}
// First-hit sniper true damage is per target, not per target selection.
{
 const q=arena(44);q.run('hit');q.run('hit');q.run('hit',{target:q.targets[1]});q.run('hit');const extra=q.events.filter(e=>e.kind==='damage');assert.equal(extra.length,2);assert.ok(extra.every(e=>e.amount===200&&e.opts.type==='true'));
}
// The toy hammer is a terminal tier and the ambiguous Mandrake tier grants no invented proc.
{const d=def(29,3);assert.equal(d.noAscUp,true);assert.equal(d.dmgS,1);assert.equal(d.dmgL,1);const m=def(33,4);assert.equal(m.procInstakill.p,.15);assert.equal(m.magicCrit,5);assert.equal(m.relicMainTrue,true);}
// The blood-payment substitute cannot kill its owner and is only used for configured autocast.
{
 const q=arena(124);q.actor.hp=20;let c=q.run('beforeCastCost',{origin:'auto',mpCost:50,skillId:'sk_fireball'});assert.equal(c.blocked,true);q.actor.hp=21;c=q.run('beforeCastCost',{origin:'auto',mpCost:50,skillId:'sk_fireball'});assert.equal(c.hpCost,20);assert.equal(c.mpCost,0);c=q.run('beforeCastCost',{origin:'proc',mpCost:50,skillId:'sk_fireball'});assert.equal(c.hpCost,undefined);
}
// Summoned/free casts do not train the apprentice; native spells train to 20 stacks, cost cap 50%.
{
 const q=arena(131);for(let i=0;i<30;i++)q.run('skill',{origin:'proc',skillId:'sk_fireball'});let c=q.run('beforeSkill',{origin:'auto',mpCost:100,damage:100,skillId:'sk_fireball'});assert.equal(c.damage,100);for(let i=0;i<30;i++)q.run('skill',{origin:'normal',skillId:'sk_fireball'});c=q.run('beforeSkill',{origin:'auto',mpCost:100,damage:100,skillId:'sk_fireball'});assert.equal(c.damage,200);c=q.run('beforeCastCost',{origin:'auto',mpCost:100,skillId:'sk_fireball'});assert.equal(c.mpCost,50);assert.equal(q.events.filter(e=>e.kind==='heal').length,1);
}
// Single-action volley cannot recursively create another phantom.
{
 const q=arena(84);q.run('hit');q.run('hit');q.advance(3);assert.equal(q.events.filter(e=>e.kind==='damage').length,3);
}
// Execute restrictions preserve bosses except the explicitly authorized dragon threshold.
{
 const q=arena(100);q.targets[0].boss=true;q.targets[0].race='龍族';q.targets[0].curHp=400;q.run('hit',{targetHpBefore:400});assert.equal(q.targets[0].curHp,0);
 const other=arena(96);other.targets[0].boss=true;other.targets[0].curHp=10;other.run('hit',{targetHpBefore:10});assert.equal(other.targets[0].curHp,10);
}
// Every event branch must tolerate a live item and resolve all explicit skill IDs.
const eventsToCheck=['battleStart','beforeAttack','beforeHit','hit','beforeSkill','beforeCastCost','skill','resonance','magicStrike','beforeCounter','counter','beforeHurt','hurt','kill','tick','markConsumed','elementHit','pierce','combo','doubleBlade','shieldBreak','petHit','directHit','battleEnd'];
for(let id=1;id<=131;id++)for(let s=1;s<=4;s++){
 const q=arena(id,s);
 for(const event of eventsToCheck){
  const result=q.run(event,{critical:true,heavy:true,graze:true,skillId:'sk_fireball',origin:'normal',damageType:'physical',normalAttack:true,attacker:q.targets[1],hardSkinBefore:100,mark:'wet'});
  assert.ok(Number.isFinite(result.damage),`nonfinite damage: ${id}/${s}/${event}`);
 }
 for(const e of q.events)if(e.kind==='cast'&&!e.skillId.startsWith('@'))assert.ok(db.skills[e.skillId],`unresolved skill ${e.skillId} for relic ${id}`);
}
console.log('Weapon relic tests passed: 131 live definitions × 5 states; 12 behavioral regressions; 12,576 event/skill-resolution checks.');
