import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cp=x=>JSON.parse(JSON.stringify(x));
const fakeElement=()=>({innerHTML:'',value:'',style:{},classList:{contains(){return true},add(){},remove(){}},remove(){},appendChild(){},querySelector(){return fakeElement()}});
const nodes={'item-modal':fakeElement(),'interaction-content':fakeElement(),'modal-item-name':fakeElement(),'modal-item-desc':fakeElement(),'modal-actions':fakeElement(),'modal-compare':fakeElement()};
const math=Object.create(Math);math.random=()=>0;
let saved=0,toggle=true;
const ctx={console:{log(){},warn(){}},document:{readyState:'loading',addEventListener(){},getElementById(id){return nodes[id]||null},createElement:fakeElement,body:fakeElement()},location:{hostname:'localhost',protocol:'file:'},Math:math,Date,URL,performance:{now:()=>0},setTimeout(){},setInterval(){},clearTimeout(){},clearInterval(){},queueMicrotask,localStorage:{getItem(){return null},setItem(){}},AFK_TOGGLES:{register(){},enabled(){return toggle}}};
ctx.window=ctx;ctx.addEventListener=()=>{};vm.createContext(ctx);
const run=s=>vm.runInContext(s,ctx);
const load=f=>run(fs.readFileSync(path.join(root,f),'utf8'));
for(const f of ['js/00-data.js','js/01-drops-config.js','js/02-stats-recompute.js','js/03-combat-core.js','js/04-combat-attack.js','js/05-kill-progression.js','js/06-status-allies.js','js/07-skills-cast.js','js/08-items-equip.js','js/10-ui-tabs.js','js/11-world-map.js','js/14-craft-pandora.js','js/22-pets.js','afk-sets.js','afk-polys.js','afk-maps-data.js','afk-maps.js'])load(f);
ctx.saveGame=()=>saved++;
run(`
var WH_NO_STORE=[],__uiCalls=[],__nextUid=0;
function getIconUrl(){return 'test.png'}
function logSys(){} function logCombat(){} function renderTabs(){} function updateUI(){} function closeModal(){}
function renderMobs(){} function getItemColor(){return 'text-white'} function inAbsBarrier(){return !!player._testBarrier}
function getGlowClass(){return ''} function getItemFullName(it){return DB.items[it.id].n} function buildItemDescHTML(it){return DB.items[it.id].d||''}
function hasMastery(){return false} function dollFieldVal(){return 0}
function getConPotionPct(){return 0} function calcStats(){}
function loadWarehouse(){return {items:[]}} function saveWarehouse(){}
function lootRng(){return Math.random()}
function gainItem(id,n,silent,forceNormal){window.__lastGain={id,n,forceNormal};var it=player.inv.find(x=>x.id===id&&!x.lock);if(it)it.cnt+=n;else player.inv.push({id,uid:'test-'+(++__nextUid),cnt:n,en:0});return true}
function consume(it){it.cnt--;if(it.cnt<=0)player.inv=player.inv.filter(x=>x.uid!==it.uid)}
function getWeaponTags(id){return WEAPON_TAGS[id]||[]}
function interactNPC(){} function openTownFloatWindow(a,b,render){__uiCalls.push([a,b]);render(document.getElementById('interaction-content'))}
function enterRiftMap(){state.riftRun=true;state.riftStartMs=(state.riftStartMs||0)+1;mapState.current='rift_battle'}
function riftEndRun(){state.riftRun=false;mapState.current='town_giran'}
function loadGame(){return true}
function killMob(i){var m=mapState.mobs[i];if(m.transform&&!m._transformed){m._transformed=true;return}if(!m._dead)m._dead=true}
function tick(){state.ticks++;if(state.ticks%10===0){for(var k in player.buffs)if(player.buffs[k]>0)player.buffs[k]=Math.max(0,player.buffs[k]-1);for(var k in player.cds)if(player.cds[k]>0)player.cds[k]=Math.max(0,player.cds[k]-1)}}
function returnToTown(){if(!state.riftRun&&!player.statuses.stun)mapState.current='town_giran'}
function enemyPhysicalAttack(m){player.hp-=Math.max(0,100-(player.d.dr||0))}
function applyMobMagic(m){return enemyPhysicalAttack(m)}
function enemyAttackAlly(m,a){a.curHp-=Math.max(0,100-(a.d.dr||0))}
function applyMobMagicToAlly(m,s,a){return enemyAttackAlly(m,a)}
function playerMoveDelayMultiplier(){return player.buffs.brave>0?1/1.33:player.buffs.elfcookie>0?1/1.15:1}
`);
const baseline=cp(run('player')),db=run('DB'),originalDb=JSON.stringify(db.items),originalDrop=cp(run('MOB_DROPS'));
load('afk-rebirth.js');run('hasMastery=function(){return false};'); // isolate potion base from class mastery bonuses
load('afk-ttmi-items-data.js');load('afk-ttmi-items.js');
const A=ctx.AFK_TTMI_ITEMS,data=ctx.__AFK_TTMI_ITEMS;
assert.ok(A);assert.equal(saved,0,'loading an add-on must never overwrite a save');
const coverage=JSON.parse(fs.readFileSync(path.join(root,'data/ttmi-items-coverage.json'),'utf8'));
assert.equal(coverage.items.length,6370);assert.equal(Object.values(coverage.counts).reduce((a,b)=>a+b,0),6370);
assert.equal(new Set(coverage.items.map(x=>x.sourceId)).size,6370);
for(const [id,d]of Object.entries(JSON.parse(originalDb)))assert.equal(JSON.stringify(db.items[id]),JSON.stringify(d),`preexisting item overwritten: ${id}`);
for(const row of data.items){const id=A.resolve(row.sourceId),d=db.items[id];assert.ok(d);assert.ok(d.n&&d.d);assert.equal(d.gachaWeight,0);assert.ok(!d.gmOnly);assert.ok(['wpn','arm','acc','pot','skillbk','scroll'].includes(d.type)||d.noUse||d.ttmiAction||d.eff==='expsoul',`inert item: ${id}`);}
for(const row of coverage.items.filter(x=>x.status==='excluded-system'&&x.reason==='釣魚'))assert.equal(A.resolve(row.sourceId),null);
assert.equal(A.coverage().riftItems,11);
for(const r of A.recipes){assert.ok(db.items[r.result]);assert.ok(r.yield>=1);for(const q of r.req)assert.ok((q.id==='gold'||db.items[q.id])&&Number.isSafeInteger(q.cnt)&&q.cnt>0);if(r.ttmiRecipeKind!=='refine'&&db.items[r.result].p>0)assert.ok((r.req.find(q=>q.id==='gold')?.cnt||0)>Math.floor(db.items[r.result].p*.3)*r.yield,'new crafting recipe can mint gold');}
const ingredientIds=new Set(A.recipes.flatMap(r=>r.req.map(q=>q.id)));
for(const r of data.items.filter(r=>r.def.ttmiMaterial))assert.ok(ingredientIds.has(A.resolve(r.sourceId)),`material has no executable use: ${r.id}`);
for(const r of data.items.filter(r=>r.contents))assert.ok(Number.isFinite(A.price(r.id)),`cyclic box or unreachable catalogue reward: ${r.id}`);
for(const [name,list]of Object.entries(run('MOB_DROPS'))){const prev=new Set((originalDrop[name]||[]).map(x=>x[0])),added=list.filter(x=>!prev.has(x[0])&&A.items.includes(x[0]));assert.ok(added.reduce((sum,x)=>sum+x[1],0)<=20+1e-7);for(const [id]of added)assert.ok(!db.items[id].ttmiRiftOnly&&!db.items[id].gmOnly);}
function reset(){ctx.__player=cp(baseline);run(`player=__player;player.cls='knight';player.lv=80;player.hp=1;player.mhp=10000;player.mp=0;player.mmp=1000;player.gold=1000000000;state.ticks=0;state.riftRun=false;mapState.current='town_giran';mapState.mobs=[];`);return run('player');}
function add(id,n=1,lock=false){run(`gainItem(${JSON.stringify(id)},${n})`);const p=run('player'),it=p.inv.find(x=>x.id===id&&!x.lock);it.lock=lock;return it;}
function use(it){ctx.useItem(it.uid);}
function ticks(n){for(let i=0;i<n;i++)ctx.tick();}
function count(id){return run('player').inv.filter(x=>x.id===id).reduce((sum,x)=>sum+x.cnt,0);}
let checks=0;
// Every custom action is reachable from the unchanged native inventory modal.
{
 reset();for(const row of data.items.filter(r=>r.def.ttmiAction)){const it=add(row.id);ctx.openModal(it,false);assert.ok(nodes['modal-actions'].innerHTML.includes("useItem('"+it.uid+"')"),`no inventory use button: ${row.id}`);}checks++;
}
// HP potions use the actual native useItem path and the root rebirth multiplier.
{
 const row=data.items.find(r=>r.def.ttmiHealPotion&&!r.def.ttmiRiftOnly&&r.def.valMin!=null),d=db.items[row.id];
 let p=reset(),it=add(row.id,3);p.rebirth=1;use(it);assert.equal(p.hp-1,d.valMin*3);assert.equal(it.cnt,2);assert.equal(p.cds.pot,d.ttmiPotionCooldown);
 const old=add('potion_heal',2),before=p.hp;use(old);assert.equal(old.cnt,2);assert.equal(p.hp,before);
 ticks(Math.ceil(d.ttmiPotionCooldown*10));assert.equal(p.ttmiPotionRemaining,0);math.random=()=>.999999;use(it);assert.equal(p.hp-before,d.valMax*3);math.random=()=>0;checks++;
}
// New consumables preserve dead/barrier/lock and shared potion cooldown gates.
{
 const row=data.items.find(r=>r.def.ttmiAction==='mp'&&!r.def.ttmiRiftOnly),p=reset(),it=add(row.id,3);
 p.dead=true;use(it);assert.equal(it.cnt,3);p.dead=false;p._testBarrier=true;use(it);assert.equal(it.cnt,3);p._testBarrier=false;it.lock=true;use(it);assert.equal(it.cnt,3);it.lock=false;
 use(it);assert.ok(p.mp>0);assert.equal(it.cnt,2);use(it);assert.equal(it.cnt,2);checks++;
}
// Buying and real core crafting deduct precisely; locks cannot become inputs.
{
 let p=reset(),row=data.items.find(r=>r.refine),id=A.resolve(row.sourceId),cost=A.price(id);assert.equal(A.buy(id,10),true);assert.equal(p.gold,1000000000-cost*10);assert.equal(count(id),10);
 const index=A.recipes.findIndex(r=>r.ttmiRecipeKind==='refine'&&r.req.some(q=>q.id===id));assert.ok(index>=0);
 const gold=p.gold,result=A.recipes[index].result;A.craft(index);assert.equal(count(id),0);assert.equal(count(result),1);assert.equal(p.gold,gold-100);
 p=reset();add(id,10,true);A.craft(index);assert.equal(count(id),10);assert.equal(count(result),0);assert.equal(p.gold,1000000000);
 assert.equal(A.buy('99999',1),false);run("mapState.current='training'");assert.equal(A.buy(id,1),false);checks++;
}
// Imported real recipe counts and output yield are honored by native doCraft.
{
 const index=A.recipes.findIndex(r=>r.ttmiRecipeKind==='source'&&r.req.every(q=>q.id==='gold'||q.id!==r.result));assert.ok(index>=0);const r=A.recipes[index],p=reset();p.gold=0;
 for(const q of r.req)if(q.id==='gold')p.gold=q.cnt;else add(q.id,q.cnt);
 A.craft(index);assert.equal(count(r.result),r.yield);for(const q of r.req)if(q.id!=='gold')assert.equal(count(q.id),0);assert.equal(p.gold,0);assert.equal(ctx.__lastGain.forceNormal,true);checks++;
}
// Box rewards resolve only to live definitions; advertised min/max counts work.
{
 const row=data.items.find(r=>r.contents&&r.contentsMode==='all'&&!r.def.ttmiBoxCooldown),p=reset(),it=add(row.id);use(it);assert.equal(count(row.id),0);
 for(const q of row.contents){const id=A.resolve(q.sourceId);assert.ok(id==='gold'||db.items[id]);if(id!=='gold')assert.ok(count(id)>=q.min);}
 assert.ok(p.gold>=1000000000);checks++;
}
// Conditional tiers replace a stat, rather than stacking +5/+7/+9 declarations.
{
 const p=reset(),d={ttmiConditional:[{minEn:5,maxEn:99,stats:{dr:1}},{minEn:7,maxEn:99,stats:{dr:2,mr:3}},{minEn:9,maxEn:99,stats:{dr:3}},{cls:'knight',stats:{mhp:50}}]};
 assert.deepEqual(cp(A.conditional({en:10},d,p)),{dr:3,mr:3,mhp:50});assert.deepEqual(cp(A.conditional({en:4},d,p)),{mhp:50});checks++;
}
// Food replaces its family, expires cleanly, and never grants another actor XP.
{
 const foods=data.items.filter(r=>r.def.ttmiBuffFamily==='food'),p=reset();assert.ok(foods.length>1);
 use(add(foods[0].id));use(add(foods[1].id));assert.equal(p.ttmiBuffs.food,foods[1].id);
 const exp=data.items.find(r=>r.def.ttmiBuffFamily==='exp'&&r.def.ttmiBuff?.ttmiExpMult>1);use(add(exp.id));assert.ok(ctx.__afkTtmiExpMult(p)>1);assert.equal(ctx.__afkTtmiExpMult({eq:{},buffs:{}}),1);
 p.buffs.ttmi_exp=0;p.buffs.ttmi_food=0;assert.equal(ctx.__afkTtmiExpMult(p),1);checks++;
}
// Eleven arena items are obtainable only via one rift run and leave no inventory.
{
 const p=reset(),credit=A.resolve(12039),hp=A.resolve(12029),haste=A.resolve(12031);assert.equal(A.riftBuy(hp),false);
 ctx.enterRiftMap();assert.equal(count(credit),10);A.beginRift();assert.equal(count(credit),10);
 assert.equal(A.riftBuy(hp),true);assert.equal(count(credit),9);assert.equal(count(hp),1);use(p.inv.find(x=>x.id===hp));assert.equal(count(hp),0);assert.equal(p.hp,11);
 assert.equal(A.riftBuy(haste),true);p.buffs.haste=50;use(p.inv.find(x=>x.id===haste));assert.equal(p.buffs.haste,1800);
 run("mapState.mobs=[{curHp:0,hp:10},{curHp:0,hp:20,boss:true},{curHp:0,hp:10,transform:true}]");ctx.killMob(0);ctx.killMob(0);ctx.killMob(1);ctx.killMob(2);assert.equal(count(credit),15);
 ticks(10);ctx.riftEndRun();assert.equal(p.inv.filter(it=>db.items[it.id]?.ttmiRiftOnly).length,0);assert.equal(p.buffs.haste,49);assert.equal(A.riftBuy(hp),false);checks++;
}
// Ordinary replacement buffs survive exiting, and restricted modal use is gated.
{
 const p=reset();ctx.enterRiftMap();const id=A.resolve(12031);A.riftBuy(id);use(p.inv.find(x=>x.id===id));
 const normalId=Object.keys(db.items).find(id=>!db.items[id].ttmiSourceId&&db.items[id].eff==='haste'&&db.items[id].dur);assert.ok(normalId);use(add(normalId));const dur=p.buffs.haste;ctx.riftEndRun();assert.equal(p.buffs.haste,dur);
 const poly=add(A.resolve(12037));ctx.confirmPolySelect(poly.uid,'哥布林');assert.equal(poly.cnt,1);checks++;
}
// Nested magic -> physical calls apply PvP reduction/reflection exactly once.
{
 const p=reset();db.items.__ttmi_test={ttmiSourceId:-1,ttmiPvpDr:10,ttmiReflect:{rate:100,dmg:7}};p.eq.armor={id:'__ttmi_test',uid:'pvptest'};p.hp=1000;p.d.dr=2;
 const m={trollPlayer:true,curHp:1000};ctx.applyMobMagic(m);assert.equal(p.hp,912);assert.equal(p.d.dr,2);assert.equal(m.curHp,993);
 const a={curHp:1000,mhp:1000,d:{dr:2},eq:{armor:{id:'__ttmi_test',uid:'apvp'}},buffs:{}};ctx.applyMobMagicToAlly(m,{},a);assert.equal(a.curHp,912);assert.equal(a.d.dr,2);assert.equal(m.curHp,986);delete db.items.__ttmi_test;checks++;
}
// Actual pet derivation reads supported armor and weapon stats, including magic.
{
 const p=reset(),pet={form:'杜賓狗',lv:5,eq:{}};const form=run('Object.keys(PET_BOOK)[0]');pet.form=form;
 const initial=ctx.petDerive(pet),row=data.items.find(r=>r.def.slot==='petwpn'&&r.def.petMdmg),armor=data.items.find(r=>r.def.slot==='petarm'&&r.def.petInt);
 assert.ok(row&&armor);pet.eq={wpn:{id:row.id,en:0},arm:{id:armor.id,en:0}};const got=ctx.petDerive(pet);
 assert.equal(got.skillFlat-initial.skillFlat,(row.def.petMdmg||0)+(row.def.petInt||0)+(armor.def.petInt||0)+(armor.def.petMdmg||0));assert.equal(initial.ac-got.ac,(row.def.petAc||0)+(armor.def.petAc||0));checks++;
}
// Runtime toggle disables use, purchase, stats and experience additions.
{
 const p=reset(),row=data.items.find(r=>r.def.ttmiAction==='mp'&&!r.def.ttmiRiftOnly),it=add(row.id);toggle=false;assert.equal(A.buy(row.id,1),false);assert.equal(ctx.__afkTtmiExpMult(p),1);assert.equal(ctx.__afkTtmiPetExpMult(p),1);use(it);assert.equal(it.cnt,1);toggle=true;checks++;
}
// Percent HP/MP buffs use percentages and share the native soul-up cap.
{
 const row=data.items.find(r=>r.def.ttmiBuff?.ttmiMaxHpPct===20),p=reset();use(add(row.id));p.mhp=1000;p.mmp=500;ctx.__afkTtmiStats(p,{});assert.equal(p.mhp,1200);assert.equal(p.mmp,600);
 p.mhp=1000;p.mmp=500;p.buffs.sk_soul_up=100;ctx.__afkTtmiStats(p,{});assert.equal(p.mhp,1000);assert.equal(p.mmp,500);checks++;
}
// Only the equipped pet receives its XP multiplier in actual petsGainExp.
{
 const p=reset(),row=data.items.find(r=>r.def.ttmiPetExpMult>1),form=run('Object.keys(PET_BOOK)[0]'),a={form,lv:5,exp:0,eq:{arm:{id:row.id,en:0}}},b={form,lv:5,exp:0,eq:{}};
 const prior=ctx.petsOutList;ctx.petsOutList=()=>[a,b];ctx.petsGainExp(10);ctx.petsOutList=prior;assert.equal(a.exp,12);assert.equal(b.exp,10);assert.equal(p.exp,0);checks++;
}
// Imported arrows occupy the native arrow slot and are actually consumed.
{
 const p=reset(),id=A.resolve(14118),d=db.items[id];assert.equal(d.isArrow,true);assert.equal(d.isBow,undefined);assert.equal(d.onHitEleDmg.dmg,3);p.eq.arrow={id,uid:'ammo',cnt:2};assert.equal(ctx.consumeArrow(),d);assert.equal(p.eq.arrow.cnt,1);checks++;
}
// Movement-only acceleration never gives attack speed, and stage two does not stack.
{
 const p=reset(),row=data.items.find(r=>r.def.ttmiHaste?.some(h=>h.moveOnly));if(row.def.req!=='all')p.cls=row.def.req.split(',')[0];use(add(row.id));assert.ok(Math.abs(ctx.playerMoveDelayMultiplier()-1/1.15)<1e-10);const d={aspd:10};ctx.__afkTtmiStats(p,d);assert.equal(d.aspd,10);p.buffs.brave=100;assert.ok(Math.abs(ctx.playerMoveDelayMultiplier()-1/1.33)<1e-10);checks++;
}
if(process.argv.includes('--write-report')){
 const drops=run('MOB_DROPS'),recipeData=A.recipes.map((r,index)=>({...cp(r),index}));
 const items=data.items.map(row=>{const id=A.resolve(row.sourceId),d=db.items[id];return {sourceId:row.sourceId,id,name:d.n,source:row.source,type:d.type,slot:d.slot||null,use:d.ttmiAction||d.eff||(d.ttmiMaterial?'craft-material':d.type==='skillbk'?'learn-skill':'equip'),acquisition:d.ttmiRiftOnly?{rift:true,cost:d.ttmiCost||null}:{town:'town_giran',npc:'npc_ttmi_archive',price:A.price(id),drops:Object.entries(drops).filter(([n,list])=>list.some(e=>e[0]===id)).map(([n])=>n),recipes:recipeData.filter(r=>r.result===id).map(r=>r.index)},craftUses:recipeData.filter(r=>r.req.some(q=>q.id===id)).map(r=>r.index),adaptation:d.ttmiAdaptation||null};});
 fs.writeFileSync(path.join(root,'data/ttmi-items-runtime.json'),JSON.stringify({coverage:A.coverage(),items,recipes:recipeData},null,2)+'\n');
}
console.log(`TTMI item tests passed: ${A.items.length} registered items, ${A.recipes.length} recipes, ${checks} behavior regressions, 6,370 source dispositions.`);
