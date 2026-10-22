/* Read-only economy audit: real data/recipe/price registration in an isolated VM.
 * No browser, player actions, real storage, timers, network or production edits.
 * --write-report writes only data/ttmi-economy-audit.json.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fakeElement=()=>({innerHTML:'',style:{},classList:{contains(){return true;},add(){},remove(){}},remove(){},appendChild(){},querySelector(){return null;}});
const ctx={console:{log(){},warn(){}},document:{readyState:'loading',addEventListener(){},getElementById(){return null;},createElement:fakeElement,body:fakeElement()},location:{hostname:'localhost',protocol:'file:'},Math,Date,URL,performance:{now:()=>0},setTimeout(){},setInterval(){},clearTimeout(){},clearInterval(){},localStorage:{getItem(){return null;},setItem(){throw Error('Audit must not write a save');}},AFK_TOGGLES:{register(){},enabled(){return true;}}};
ctx.window=ctx;ctx.addEventListener=()=>{};vm.createContext(ctx);
const run=s=>vm.runInContext(s,ctx);
const loaded=[];
const load=f=>{loaded.push(f);return run(fs.readFileSync(path.join(root,f),'utf8'));};
for(const f of ['js/00-data.js','js/01-drops-config.js','js/02-stats-recompute.js','js/03-combat-core.js','js/04-combat-attack.js','js/05-kill-progression.js','js/06-status-allies.js','js/07-skills-cast.js','js/08-items-equip.js','js/10-ui-tabs.js','js/11-world-map.js','js/14-craft-pandora.js','js/22-pets.js','afk-sets.js','afk-polys.js','afk-maps-data.js','afk-maps.js','afk-corrupt.js','afk-ttmi-items-data.js','afk-ttmi-items.js'])load(f);
const A=ctx.AFK_TTMI_ITEMS,db=run('DB'),stock=new Set(A.shopStock());
assert.equal(A.items.length,2219,'Audit scope differs from the integrated catalogue');
assert.equal(A.recipes.length,893,'Reassess recipe scope before accepting this report');
const rows=new Map(A.source.items.filter(r=>stock.has(r.id)).map(r=>[r.id,r]));

// Only read the native shop declarations. All classes and the cheapest legal
// siege discount are allowed as a conservative price lower bound; actual class
// eligibility and buying whole arrow bundles can only increase these costs.
const shopFile='js/13-shop-save.js',shopSource=fs.readFileSync(path.join(root,shopFile),'utf8');
run(shopSource.slice(shopSource.indexOf('const SHOP_LISTS ='),shopSource.indexOf('function renderTownShop')));
loaded.push(shopFile);
const nativeStock=new Set(Object.values(run('SHOP_LISTS')).flat());
const nativePrice=id=>!nativeStock.has(id)?Infinity:id==='wpn_5'?.08:id==='wpn_22'?.16:Math.floor((db.items[id]?.p||0)*.8);
const buy=id=>id==='gold'?1:Math.min(stock.has(id)?A.price(id):Infinity,nativePrice(id));
const nominalSell=id=>id==='gold'?1:ctx.getSellPrice({id,attr:null,bless:false,anc:false});
const sell=id=>id==='gold'?1:db.items[id]?.noSell?0:nominalSell(id);
const sum=a=>a.reduce((a,b)=>a+b,0);
const finiteOrNull=n=>Number.isFinite(n)?n:null;

// Optional opening of known imported boxes/exchanges, at most once per box.
// Every reward is plain. The real implementation samples each listed random
// outcome uniformly and integer quantities uniformly within min/max.
const unknownNested=new Set();
function cash(id,mode='expected',seen=new Set()){
  if(seen.has(id))throw Error('Container cycle: '+id);
  const row=rows.get(id),d=db.items[id],base=sell(id);
  if(!row){if(d?.eff?.includes('box'))unknownNested.add(id);return base;}
  seen=new Set(seen);seen.add(id);
  if(d.ttmiAction==='exchange')return Math.max(base,cash(d.ttmiResult,mode,seen));
  if(!row.contents)return base;
  return Math.max(base,openCash(row,mode,seen)+(d.ttmiBoxCooldown?base:0));
}
function openCash(row,mode='expected',seen=new Set([row.id])){
  const vs=row.contents.map(q=>cash(A.resolve(q.sourceId),mode,seen)*(mode==='max'?q.max:(q.min+q.max)/2));
  return row.contentsMode==='all'?sum(vs):mode==='max'?Math.max(...vs):sum(vs)/vs.length;
}

// Deterministic purchase -> workshop chains, excluding drops, boxes and daily
// rewards as ingredient sources. Fractional per-unit batching is a lower bound.
const best=new Map(Object.keys(db.items).map(id=>[id,{cost:buy(id),via:Number.isFinite(buy(id))?'shop':'unavailable'}]));
best.set('gold',{cost:1,via:'cash'});
let passes=0,changed=true;
while(changed&&passes++<1000){
  changed=false;
  A.recipes.forEach((r,index)=>{
    const cost=sum(r.req.map(q=>(best.get(q.id)?.cost??Infinity)*q.cnt))/r.yield;
    if(cost+1e-9<(best.get(r.result)?.cost??Infinity)){best.set(r.result,{cost,via:'workshop',recipe:index});changed=true;}
  });
}
assert.ok(!changed,'Recipe cost relaxation failed to converge');

const recipes=A.recipes.map((r,index)=>{
  const gold=sum(r.req.filter(q=>q.id==='gold').map(q=>q.cnt));
  const directCost=sum(r.req.map(q=>buy(q.id)*q.cnt));
  const chainCost=sum(r.req.map(q=>(best.get(q.id)?.cost??Infinity)*q.cnt));
  const row=rows.get(r.result),isContainer=!!row?.contents;
  const expected=isContainer?cash(r.result)*r.yield:null,maximum=isContainer?cash(r.result,'max')*r.yield:null;
  return {index,id:r.result,name:db.items[r.result].n,kind:r.ttmiRecipeKind,yield:r.yield,feeAdded:r.ttmiServiceFee,gold,
    plainResale:nominalSell(r.result)*r.yield,actualResale:sell(r.result)*r.yield,
    cashMinusPlainResale:gold-nominalSell(r.result)*r.yield,
    directPurchaseCostLowerBound:finiteOrNull(directCost),purchaseCraftCostLowerBound:finiteOrNull(chainCost),
    importedContainer:isContainer,expectedLiquidation:expected,maximumLiquidation:maximum,
    expectedNetAfterPurchaseCraft:isContainer?finiteOrNull(expected-chainCost):null,
    maximumNetAfterPurchaseCraft:isContainer?finiteOrNull(maximum-chainCost):null,
    ingredients:r.req.map(q=>({...q,name:q.id==='gold'?'金幣':db.items[q.id].n,directUnitPrice:finiteOrNull(buy(q.id)),chainUnitCost:finiteOrNull(best.get(q.id)?.cost??Infinity),via:best.get(q.id)?.via||'unavailable',recipe:best.get(q.id)?.recipe??null}))};
});
const boxes=[...rows.values()].filter(r=>r.contents).map(r=>{
  const d=db.items[r.id],cost=A.price(r.id),expected=openCash(r),maximum=openCash(r,'max'),retained=d.ttmiBoxCooldown?sell(r.id):0;
  return {id:r.id,name:d.n,source:r.source,cost,mode:r.contentsMode,plainResale:sell(r.id),expectedOpeningRewards:expected,maximumOpeningRewards:maximum,retainedBoxResale:retained,
    expectedBestSingleUseLiquidation:cash(r.id),maximumSingleUseLiquidation:cash(r.id,'max'),
    expectedNet:cash(r.id)-cost,maximumNet:cash(r.id,'max')-cost,
    cooldownSeconds:d.ttmiBoxCooldown||0,
    expectedRewardsPer24Hours:d.ttmiBoxCooldown?expected*86400/d.ttmiBoxCooldown:0,
    expectedRevenuePaybackOpenings:d.ttmiBoxCooldown&&expected>0?Math.ceil(cost/expected):null,
    contents:r.contents.map(q=>({id:A.resolve(q.sourceId),name:A.resolve(q.sourceId)==='gold'?'金幣':db.items[A.resolve(q.sourceId)].n,min:q.min,max:q.max,plainResale:sell(A.resolve(q.sourceId))}))};
});
const repeatable=boxes.filter(x=>x.cooldownSeconds);
const directShop=Array.from(stock,id=>({id,name:db.items[id].n,cost:A.price(id),resale:sell(id)}));
const craftedBoxes=recipes.filter(x=>x.importedContainer);
const legacyContainerOutputs=recipes.filter(r=>!r.importedContainer&&(db.items[r.id].eff?.includes('box')||r.id==='doll_bag')).map(r=>({index:r.index,id:r.id,name:r.name,purchaseCraftCostLowerBound:r.purchaseCraftCostLowerBound}));
const dollFile='js/15-cards.js',dollSource=fs.readFileSync(path.join(root,dollFile),'utf8');
const dollDeclaration=dollSource.match(/^const DOLL_BAG_POOL = .*;$/m)?.[0];
assert.ok(dollDeclaration,'Native doll-bag pool is missing');run(dollDeclaration);loaded.push(dollFile);
const dollPool=run('DOLL_BAG_POOL');
const nativeDollBag={recipe:133,costLowerBound:recipes.find(r=>r.id==='doll_bag')?.purchaseCraftCostLowerBound??null,rewardCount:dollPool.length,expectedResale:sum(dollPool.map(([id,w])=>sell(id)*w))/sum(dollPool.map(([,w])=>w)),maximumResale:Math.max(...dollPool.map(([id])=>sell(id))),allRewardsNoSell:dollPool.every(([id])=>db.items[id].noSell===true)};
const summary={
  registeredItems:A.items.length,shopItems:stock.size,recipes:recipes.length,
  recipesByKind:Object.fromEntries([...new Set(recipes.map(r=>r.kind))].map(k=>[k,recipes.filter(r=>r.kind===k).length])),
  recipeCashFloor:{strictlyAbove:recipes.filter(r=>r.cashMinusPlainResale>0).length,equal:recipes.filter(r=>r.cashMinusPlainResale===0).length,below:recipes.filter(r=>r.cashMinusPlainResale<0).length,minimumPositiveMargin:Math.min(...recipes.filter(r=>r.cashMinusPlainResale>0).map(r=>r.cashMinusPlainResale)),zeroMargins:recipes.filter(r=>r.cashMinusPlainResale===0).map(r=>({index:r.index,id:r.id,name:r.name})),refineCash:100,refineOutputResale:nominalSell(A.resolve(7102))},
  profitableShopResales:directShop.filter(r=>r.resale>r.cost),
  directPurchasableRecipeInputs:recipes.filter(r=>r.directPurchaseCostLowerBound!==null).length,
  purchaseCraftReachableRecipes:recipes.filter(r=>r.purchaseCraftCostLowerBound!==null).length,
  boxes:boxes.length,profitablePurchasedBoxesExpected:boxes.filter(r=>r.expectedNet>0),profitablePurchasedBoxesMaximum:boxes.filter(r=>r.maximumNet>0),
  craftedImportedContainers:craftedBoxes.length,craftedContainerRoutesFromPurchases:craftedBoxes.filter(r=>r.purchaseCraftCostLowerBound!==null).length,
  profitableCraftedBoxesExpected:craftedBoxes.filter(r=>r.expectedNetAfterPurchaseCraft>0).map(r=>r.index),profitableCraftedBoxesMaximum:craftedBoxes.filter(r=>r.maximumNetAfterPurchaseCraft>0).map(r=>r.index),
  craftedBoxRewardAboveCashAlone:craftedBoxes.filter(r=>r.expectedLiquidation>r.gold).length,
  repeatableCount:repeatable.length,repeatableTotalPurchaseCost:sum(repeatable.map(r=>r.cost)),repeatableExpectedRewardsPer22Hours:sum(repeatable.map(r=>r.expectedOpeningRewards)),repeatableExpectedRewardsPer24Hours:sum(repeatable.map(r=>r.expectedRewardsPer24Hours)),
  unresolvedNativeBoxChildren:[...unknownNested],legacyContainerOutputs,nativeDollBag,costRelaxationPasses:passes
};
const report={
  scope:'Static cash-flow audit of the integrated TTMI workshop/catalogue; no browser or player save was used.',
  assumptions:['Plain native resale floor(p * 0.3); noSell outputs valued at zero for achievable cash.','TTMI shop, workshop and custom-container gains force ordinary items, so attribute/blessed/ancient resale multipliers do not apply.','Single-use container analysis recursively opens imported boxes/exchanges at most once, with original uniform item and count sampling; repeatable bodies may be resold afterwards.','Ingredient acquisition uses TTMI prices, native shops at the cheapest siege discount, and these 893 deterministic workshop recipes; class gates and integer purchase/craft batches are relaxed downwards, so costs are conservative lower bounds.','No input is priced as free merely because it can drop. No global claim is made about other crafting NPCs, acquisition by random boxes, black-market buy orders, enchantment/affix conversions or long-term player gold/hour.'],
  summary,repeatable,recipes,boxes,
  sources:loaded.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}))
};
if(process.argv.includes('--write-report'))fs.writeFileSync(path.join(root,'data/ttmi-economy-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
