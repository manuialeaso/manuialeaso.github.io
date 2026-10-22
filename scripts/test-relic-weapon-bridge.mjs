import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const noop=()=>{};let serial=0,draws=[],fallback=.6,reflections=[];
const dom=new Proxy({value:'',checked:false,style:{},classList:{add:noop,remove:noop,toggle:noop},addEventListener:noop,appendChild:noop,querySelectorAll:()=>[],getBoundingClientRect:()=>({x:0,y:0,width:1,height:1})},{get(t,k){return k in t?t[k]:noop;}});
const env={console:{log:noop,warn:noop,error:console.error},document:{readyState:'loading',addEventListener:noop,getElementById:()=>dom,querySelectorAll:()=>[],createElement:()=>dom,body:dom},location:{hostname:'localhost'},localStorage:{getItem:()=>null,setItem:noop},setTimeout:noop,setInterval:noop,requestAnimationFrame:noop,addEventListener:noop,Date,Math:Object.create(Math),URL,
 player:null,state:{ticks:1000,ff:true,running:true},mapState:{current:'test',mobs:[],targetIdx:0},outPets:[],
 uid:()=>`unit-${++serial}`,logCombat:noop,logSys:noop,renderMobs:noop,renderSquadPanel:noop,saveGame:noop,updateUI:noop,playSfx:noop,
 getTarget(){return env.mapState.mobs.find(t=>t.curHp>0&&!t._dead);},killMob(i){const t=env.mapState.mobs[i];if(t){t.curHp=0;t._dead=true;}},
 reflectWallOnDamage(t,n,kind,actor){reflections.push({t,n,kind,actor});if(t.reflect){const a=actor||env.player,key=a.curHp==null?'hp':'curHp';a[key]-=n*t.reflect;if(a[key]<=0)a.dead=true;}},
 newMobStatus:()=>({}),playArrowFx:noop,vfxMiss:noop,playSpellFx:noop,
};env.window=env;env.Math.random=()=>fallback;vm.createContext(env);
// Load the full native combat files, rather than copying their formulas into tests.
for(const file of ['js/00-data.js','js/01-drops-config.js','js/02-stats-recompute.js','js/03-combat-core.js','js/04-combat-attack.js','js/06-status-allies.js','js/07-skills-cast.js','js/08-items-equip.js','js/10-ui-tabs.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),env,{filename:file});
const db=vm.runInContext('DB',env);
vm.runInContext('state=globalThis.state;mapState=globalThis.mapState;',env);
Object.assign(env,{roll:(lo,hi)=>draws.length?draws.shift():hi,rollDice:(n,s)=>n*s,logCombat:noop,logSys:noop,renderMobs:noop,renderSquadPanel:noop,saveGame:noop,updateUI:noop,
 hasMastery:k=>(env.player.masteries||[]).includes(k),allyHasMastery:(a,k)=>(a.masteries||[]).includes(k),_afkM:(a,k)=>(a.masteries||[]).includes(k),
 capWpnEn:x=>x||0,capEn:x=>x||0,wpnEnFinalMult:()=>1,enhanceWpnFinalMult:()=>1,
 getMobColor:()=>'',mobEffAC:t=>t.ac||0,mobHardSkin:t=>t.hardSkin||0,markBossPhysicalHit:noop,traumaPhysicalBonus:()=>0,mobWake:noop,terrorVisageOnDamage:()=>false,
 rlFuryMult:()=>1,allyRlFuryMult:()=>1,royalAllyMult:()=>1,fragileMult:()=>1,illusionMagicDmg:x=>x,_allyIllusionMagicDmg:(a,x)=>x,illuLvMult:()=>1,
 foulWaterHealMult:()=>1,petGearBonus:()=>({hit:0,dmg:0}),petDerive:()=>({dr:0,atkItv:20}),petMhpEff:p=>p.mhp,
 reflectWallOnDamage(t,n,kind,actor){reflections.push({t,n,kind,actor});if(t.reflect){const a=actor||env.player,key=a.curHp==null?'hp':'curHp';a[key]-=n*t.reflect;if(a[key]<=0)a.dead=true;}},
 calcStats:noop,recomputeStats:noop,_allyLevelRecompute:noop,rollHealingSpell:()=>100,healBeneficiaries:()=>[env.player,...env.player.allies],grantCritFuryHaste:noop,
 killMob(i){const t=env.mapState.mobs[i];if(t){t.curHp=0;t._dead=true;}},getTarget:()=>env.mapState.mobs.find(t=>t.curHp>0&&!t._dead)
});
for(const file of ['afk-relic-catalog.js','afk-relic-weapons.js','afk-relic-runtime.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),env,{filename:file});
const R=env.AFK_RELIC_RUNTIME,W=env.AFK_RELIC_WEAPONS;R.init();
vm.runInContext(fs.readFileSync(path.join(root,'afk-relic-weapon-bridge.js'),'utf8'),env,{filename:'afk-relic-weapon-bridge.js'});
const B=env.AFK_RELIC_WEAPON_BRIDGE,trace=[];R.observe((kind,c)=>trace.push({kind,...c}));
function actor(ally=false){const a={uid:`actor-${++serial}`,cls:'knight',lv:50,hp:10000,mhp:20000,mp:500,mmp:1000,eq:{},allies:[],pets:[],summons:[],buffs:{},statuses:{},skills:[],masteries:[],d:{str:10,dex:10,con:10,int:10,wis:10,cha:10,meleeHit:50,rangedHit:50,meleeDmg:0,rangedDmg:0,extraDmg:0,extraHit:0,meleeCrit:0,rangedCrit:0,magicCrit:0,meleeCritDmg:100,rangedCritDmg:100,magicCritDmg:100,sp:10,magicDmg:0,extraMp:0}};if(ally){a.curHp=a.hp;a._allyName='測試傭兵';}return a;}
function enemy(extra={}){return{uid:`mob-${++serial}`,id:'wolf',n:'測試敵人',lv:1,s:'S',e:'none',race:'人類',hp:1e7,curHp:1e7,ac:0,dr:0,mr:0,st:{},hardSkin:0,hardSkinMax:0,...extra};}
function reset(){env.player=actor();vm.runInContext('player=globalThis.player',env);env.state.ticks+=1000;env.mapState.mobs=[enemy()];env.mapState.targetIdx=0;R.setAction(null);draws=[];fallback=.6;reflections=[];trace.length=0;return env.player;}
function equip(a,id,stage=4){const m=W.byId[id],base=R.originalBase(m.key),d=JSON.parse(JSON.stringify(base));d.relicBase=m.key;d.relicPlus=stage===0?0:stage===1?5:stage===2?10:15;d.relicAsc=stage<3?null:stage===3?0:5;W.configure(d,base,d.relicPlus,d.relicAsc);const k=`${m.key}~test${++serial}`;db.items[k]=d;a.eq.wpn={id:k,en:0};return d;}
function action(a,origin='normal'){const act=R.nextAction(a,origin);act.source=db.items[a.eq.wpn.id].relicBase;R.setAction(act);return act;}
// Weapon-only doubling precedes flat reductions; it does not double derived flat damage.
{
 const a=reset(),d=equip(a,18),t=env.mapState.mobs[0];d.dmgS=d.dmgL=10;a.d.meleeDmg=20;t.dr=5;action(a);const res=env.getPhysicalDmg(10,t,d);assert.equal(res.dmg,35);assert.equal(res.heavy,true);assert.equal(a.d.extraHit,0);assert.equal(R.action().calculatingPhysical,undefined);
}
// Three counters escalate 1/1.5/2; the final form emits five finite true counters.
{
 const a=reset(),d=equip(a,30,3),t=env.mapState.mobs[0];d.dmgS=d.dmgL=20;env.procCounter(t);let hits=trace.filter(x=>x.kind==='physical'&&x.origin==='counter');assert.deepEqual(hits.map(x=>x.amount),[10,15,20]);assert.equal(reflections.length,3);
 equip(a,30,4).dmgS=20;t.dr=100000;trace.length=0;reflections=[];env.procCounter(t);hits=trace.filter(x=>x.origin==='counter');assert.equal(hits.length,5);assert.ok(hits.every(x=>x.amount===10&&x.kind==='true'));assert.equal(reflections.length,5);
}
// True rapidfire ignores DR before the one-point clamp, using a finite fixed count.
{
 const a=reset(),d=equip(a,35),t=env.mapState.mobs[0];d.dmgS=d.dmgL=100;t.dr=100000;env.rapidfireProc(null,true);const hits=trace.filter(x=>x.origin==='rapidfire');assert.equal(hits.length,5);assert.ok(hits.every(x=>x.amount===50&&x.kind==='true'));
}
// Bone stacks wait for crit/full only in final form, cap at30 and clear on one burst.
{
 const a=reset(),d=equip(a,40),t=env.mapState.mobs[0];for(let i=0;i<40;i++)B.boneLayers(t,d,1);assert.equal(t._bonespike,30);B.boneBurst(t,{crit:false},d);assert.equal(t._bonespike,0);assert.equal(trace.at(-1).amount,1500);t._bonespike=12;const before=t.curHp;assert.equal(B.boneBurst(t,{crit:false},d),true);assert.equal(t.curHp,before);B.boneBurst(t,{crit:true},d);assert.equal(t._bonespike,0);
}
// Generated defense counter respects actor/mult/source and cannot re-enter primary passives.
{
 const a=reset(),ally=actor(true);a.allies=[ally];const d=equip(ally,30),t=env.mapState.mobs[0];d.dmgS=d.dmgL=20;const hp=a.hp,ref=ally.eq.wpn;B.nativeSegment(t,d,ref,{actor:ally,source:'relic_iron_shackle',mult:4,origin:'counter',noProc:true,forceHit:true});const hits=trace.filter(x=>x.origin==='counter');assert.equal(hits.length,1);assert.equal(hits[0].amount,80);assert.equal(hits[0].actor,ally);assert.equal(a.hp,hp);assert.equal(ally.eq.wpn,ref);assert.equal(R.state(ally,d.relicBase).mainCount,undefined);
}
// All elemental reactions use an unconsumed physical snapshot, then consume once.
{
 const a=reset(),d=equip(a,9,1),t=env.mapState.mobs[0];d.dmgS=d.dmgL=10;t._afkScorch=env.state.ticks+100;action(a);const res=env.getPhysicalDmg(10,t,d);assert.equal(t._afkScorch>env.state.ticks,true);const pre=res.dmg;res.dmg=R.beforeHit(a,t,res.dmg,d,res);assert.equal(res.relicSnapshot,pre);assert.equal(res.dmg,pre*2);assert.equal(t._afkScorch,0);
}
// Healing uses one source cooldown even between native branches and battles.
{
 const a=reset(),d=equip(a,12,0);a.hp=100;assert.equal(B.procHeal(a,100,d),100);R.dispatch('battleEnd',{actor:a});assert.equal(B.procHeal(a,100,d),0);env.state.ticks+=100;assert.equal(B.procHeal(a,100,d),100);const ordinary=db.items.wpn_dagger||{};assert.equal(B.procHeal(a,50,ordinary),50);
}
// Magic burst distributes a fixed pool before ascension and emits full per-target damage after.
{
 const a=reset(),d=equip(a,120,2);a.d.int=100;env.mapState.mobs.push(enemy());fallback=0;B.magicBurst(d,100,{target:'all'},env.mapState.mobs);let hits=trace.filter(x=>x.origin==='magicBurst');assert.deepEqual(hits.map(x=>x.amount),[30,30]);trace.length=0;const asc=equip(a,120);B.magicBurst(asc,100,{target:'all'},env.mapState.mobs);hits=trace.filter(x=>x.origin==='magicBurst');assert.deepEqual(hits.map(x=>x.amount),[150,150]);
}
// Every GM weapon channel is finite and restores the equipped reference and local stats.
{
 for(let id=1;id<=131;id++){
  const a=reset(),d=equip(a,id),t=env.mapState.mobs[0],ref=a.eq.wpn,stats={...a.d};fallback=.99;
  const act=action(a);act.gm=true;act.gmSources=R.sources(a);
  try{B.nativeSegment(t,d,ref,{actor:a});}catch(e){e.message=`weapon ${id}: ${e.message}`;throw e;}
  assert.equal(a.eq.wpn,ref,`weapon ${id} reference leak`);assert.equal(a.d.meleeHit,stats.meleeHit);assert.equal(a.d.rangedDmg,stats.rangedDmg);assert.ok(trace.length<300,`weapon ${id} recursively emitted ${trace.length} events`);
 }
}
console.log('Weapon bridge native-engine tests passed: weapon-roll order, true DR, finite counters/rapidfire, actor-safe counter, reactions, heal CD, magic-burst pools, all 131 GM channels.');
