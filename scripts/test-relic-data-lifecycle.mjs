// Real index, signed native saves, native inventory/warehouse cleanup, and full
// navigation. Only legal character/stock fixtures are supplied; persistence,
// item definitions, toggles, source selection, and dispatch are never mocked.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {testBrowser,createProfile} from './relic-test-browser.mjs';

const browser=await testBrowser();
const reports=[];
function capture() {
  const R=AFK_RELIC_RUNTIME,D=__afkRelicData;
  const fields=['id','uid','cnt','en','bless','anc','attr','attrMagic','attrMagicStar','seteff','lock'];
  const row=i=>Object.fromEntries(fields.map(k=>[k,i[k]??null]));
  const rows=a=>(a||[]).filter(i=>i&&String(i.id).includes('~r')).map(row).sort((a,b)=>a.uid.localeCompare(b.uid));
  const wh=loadWarehouse(),key=R.byId[137].key;
  const s=R.sources(player).find(s=>s.key===key);
  const weapon=DB.items[player.eq.wpn.id];
  const c={actor:player,target:{uid:'data-enemy',curHp:1000,hp:1000},weapon,damage:100,main:true,direct:true,origin:'normal',kind:'melee'};
  R.dispatch('beforeAttack',c);
  const equipped=player.eq.gloves,def=DB.items[equipped.id];
  const enchanted=player.inv.find(i=>i.attrMagicStar===5);
  const proc=enchanted&&getAttrMagicProc(enchanted);
  return {
    inventory:rows(player.inv),equipment:rows(Object.values(player.eq)),warehouse:rows(wh.items),warehouseGold:wh.gold,
    gold:player.gold,enabled:AFK_TOGGLES.enabled('relicplus'),feature:!!window.__afkRelicPlus,data:!!D,
    source:s&&{id:s.catalogId,stage:s.stage,n:s.n,asc:s.asc},forceHeavy:!!c.forceHeavy,weaponMaxMult:c.weaponMaxMult||1,
    effective:{plus:def.relicPlus,asc:def.relicAsc,evo:def.relicEvo,swordStr:def.swordStr},
    names:rows(player.inv.concat(Object.values(player.eq).filter(Boolean))).map(i=>({id:i.id,name:getItemFullName(i)})),
    parsed:rows(player.inv).map(i=>({id:i.id,meta:D.parseId(i.id)})),
    magicStars:proc&&proc.star,serializedMagicStars:enchanted&&enchanted.attrMagicStar,
    evolveEffects:window.__afkRelicPlus?__afkRelicPlus.equippedEvo(player):null
  };
}
function preserved(actual,expected) {
  for(const key of ['inventory','equipment','warehouse','warehouseGold','gold','names','parsed'])assert.deepEqual(actual[key],expected[key],key);
}
function stage(actual,on) {
  assert.equal(actual.enabled,on);assert.equal(actual.feature,on);assert.equal(actual.data,true);
  assert.deepEqual(actual.source,{id:137,stage:on?4:0,n:on?15:0,asc:on?5:null});
  assert.equal(actual.forceHeavy,on);assert.equal(actual.weaponMaxMult,on?2:1);
  assert.deepEqual(actual.effective,{plus:on?15:0,asc:on?5:null,evo:null,swordStr:on?20:3});
  assert.equal(actual.magicStars,on?5:3);assert.equal(actual.serializedMagicStars,5);
}
try {
  const {page,errors,close}=await browser.page();
  try {
    page.on('dialog',dialog=>dialog.accept());
    await page.evaluate(code=>{window.__profile=eval('('+code+')');},createProfile.toString());
    const fixture=await page.evaluate(()=>{
      const R=AFK_RELIC_RUNTIME,D=__afkRelicData;
      const id=(n,level,fx,asc,evo)=>D.makeId(R.byId[n].key,level,fx?R.byId[fx].key:null,asc,evo);
      const ids={gloves:id(137,15,133,5),donor:id(2,10,1),ascended:id(3,15,1,5),armor:id(132,15,133,0),legacy:id(229,5,231,5,6),accessory:id(230,10,231,5)};   /* 第二詞綴：武器防具 +10、飾品 +5 起必有（缺的會被自動補抽），測試物品一併帶上 */
      Object.values(ids).forEach(x=>{if(!D.ensure(x))throw Error('Unregistered fixture '+x);});
      __profile({cls:'knight',lv:100,eq:{wpn:'wpn_2hsword',gloves:ids.gloves}});
      state.ff=false;currentSlot=1;player.enSeed='relic-data-lifecycle';player.name='Relic data lifecycle';
      const item=(id,uid,cnt=1,extra={})=>({id,uid,cnt,en:0,bless:false,anc:false,attr:false,attrMagic:null,attrMagicStar:null,seteff:false,lock:false,...extra});
      player.eq.gloves=item(ids.gloves,'rd-equip',1,{bless:true,anc:true,lock:true});
      player.inv=[
        item(ids.donor,'rd-donor',3,{bless:true,anc:true,attr:'fr3',lock:true}),
        item(ids.ascended,'rd-asc',2,{bless:true,attr:'wa5',attrMagic:'sk_blizzard',attrMagicStar:5}),
        item(ids.armor,'rd-arm',4,{anc:true}),
        item(ids.legacy,'rd-legacy',2,{lock:true}),
        item(ids.accessory,'rd-acc',3,{bless:true})
      ];
      const wh=loadWarehouse();wh.gold=7654321;
      Object.entries(ids).forEach(([kind,id],i)=>wh.items.push(item(id,'rd-wh-'+kind,i+1,{bless:i%2===0,anc:i%2===1,lock:i%2===0,...(kind==='ascended'?{attr:'wa5',attrMagic:'sk_blizzard',attrMagicStar:5}:{})})));
      const warehouseSaved=saveWarehouse(wh),saved=saveGame(),signed=_saveUnwrap(_lzGet('lineage_idle_save_'+currentSlot));
      return {ids,slot:currentSlot,warehouseSaved,saved,signed:signed.signed,verified:signed.ok,weaponMagic:getAttrMagicProc(player.inv.find(i=>i.attrMagicStar===5))};
    });
    assert.equal(fixture.saved,true);assert.equal(fixture.warehouseSaved,true);assert.equal(fixture.signed,true);assert.equal(fixture.verified,true);
    const baseline=await page.evaluate(capture);stage(baseline,true);
    assert.equal(baseline.inventory.length,5);assert.equal(baseline.warehouse.length,6);assert.equal(baseline.equipment.length,1);
    assert.equal(baseline.inventory.find(i=>i.uid==='rd-donor').attr,'fr3');
    assert.equal(baseline.parsed.find(i=>i.id===fixture.ids.donor).meta.fx,'relic_shadow_stinger');
    assert.match(baseline.names.find(i=>i.id===fixture.ids.gloves).name,/\+5.*昇華支配/);
    assert.match(baseline.names.find(i=>i.id===fixture.ids.legacy).name,/至高的支配/);
    reports.push({case:'signed save with equipped, inventory, warehouse, second affix, legacy ascension and evolution',...fixture,stock:baseline});

    const denied=await page.evaluate(()=>{
      const stale=__afkRelicPlus,stock=JSON.stringify({inv:player.inv,eq:player.eq,gold:player.gold,warehouse:loadWarehouse()});
      AFK_TOGGLES.set('relicplus',false);
      const results=[stale.upgrade('fixture'),stale.ascend('fixture',0,false),stale.craftStardust(1),stale.evolve('fixture'),stale.exchange('fixture',null,1),stale.hamaAttr('fire')];
      stale.open();
      const key=AFK_RELIC_RUNTIME.byId[137].key;
      const full=__afkRelicData.buildDef(key,15,null,5,null),ultimate=AFK_RELIC_RUNTIME.ultimate(key);
      const same=stock===JSON.stringify({inv:player.inv,eq:player.eq,gold:player.gold,warehouse:loadWarehouse()});
      return {results,same,modalVisible:!!document.querySelector('#rp-modal[style*="flex"]'),full:{n:full.relicPlus,asc:full.relicAsc},ultimate:{n:ultimate.relicPlus,asc:ultimate.relicAsc},evolve:stale.equippedEvo(player)};
    });
    assert.ok(denied.results.every(x=>x.ok===false&&x.msg==='遺物合成功能已關閉。'));
    assert.equal(denied.same,true);assert.equal(denied.modalVisible,false);assert.deepEqual(denied.evolve,[]);
    assert.deepEqual(denied.full,{n:15,asc:5});assert.deepEqual(denied.ultimate,denied.full);
    const off=await page.evaluate(capture);stage(off,false);preserved(off,baseline);
    reports.push({case:'live disable rebuilds actual source to stage zero and blocks six stale API mutations',denied,source:off.source,effective:off.effective,magicStars:off.magicStars});

    assert.equal(await page.evaluate(()=>saveGame()),true);
    // Remove the optional quick registry: boot must discover the compressed
    // native saves/warehouse themselves, not rely on a prior crafting session.
    await page.evaluate(()=>localStorage.removeItem('afk_relicplus_ids'));
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(()=>!!window.AFK_RELIC_INTEGRATION);
    const boot=await page.evaluate(({ids,slot})=>{
      __testTimers.forEach(clearInterval);state.running=false;state.ff=false;
      const before={known:Object.values(ids).every(id=>!!DB.items[id]),plus:!!window.__afkRelicPlus,data:!!window.__afkRelicData,stages:Object.values(ids).map(id=>DB.items[id]&&{n:DB.items[id].relicPlus,asc:DB.items[id].relicAsc})};
      currentSlot=slot;loadGame();__testTimers.forEach(clearInterval);state.running=false;state.ff=false;
      return {before,purged:purgeOrphanItems(loadWarehouse()),signed:_saveUnwrap(_lzGet('lineage_idle_save_'+slot)).ok};
    },fixture);
    assert.equal(boot.before.known,true);assert.equal(boot.before.plus,false);assert.equal(boot.before.data,true);assert.equal(boot.purged,0);assert.equal(boot.signed,true);
    assert.ok(boot.before.stages.every(x=>x.n===0&&x.asc===null));
    const offReload=await page.evaluate(capture);stage(offReload,false);preserved(offReload,baseline);
    reports.push({case:'startup disabled discovers signed compressed items without registry; native load/purge preserves every item and affix',...boot});

    const late=await page.evaluate(ids=>{
      // An imported late warehouse may be seen after boot. Prove both the
      // warehouse reader and cleanup guard restore missing definitions first.
      delete DB.items[ids.ascended];
      const wh=loadWarehouse(),loaded=!!DB.items[ids.ascended];
      delete DB.items[ids.donor];delete DB.items[ids.gloves];
      const removed=purgeOrphanItems(wh);
      return {loaded,removed,guarded:!!DB.items[ids.donor]&&!!DB.items[ids.gloves],stages:[ids.ascended,ids.donor,ids.gloves].map(id=>DB.items[id].relicPlus)};
    },fixture.ids);
    assert.equal(late.loaded,true);assert.equal(late.removed,0);assert.equal(late.guarded,true);assert.deepEqual(late.stages,[0,0,0]);
    preserved(await page.evaluate(capture),baseline);
    reports.push({case:'late imported identities are restored before native warehouse read and orphan cleanup',...late});

    const enabled=await page.evaluate(()=>{
      AFK_TOGGLES.set('relicplus',true);
      return {api:!!window.__afkRelicPlus,saved:saveGame()};
    });
    assert.deepEqual(enabled,{api:true,saved:true});
    const resumed=await page.evaluate(capture);stage(resumed,true);preserved(resumed,baseline);
    reports.push({case:'enable after disabled boot restores real final-stage dispatch, affixes and original names',source:resumed.source,effective:resumed.effective,magicStars:resumed.magicStars});

    await page.reload({waitUntil:'load'});await page.waitForFunction(()=>!!window.AFK_RELIC_INTEGRATION);
    await page.evaluate(slot=>{__testTimers.forEach(clearInterval);state.running=false;state.ff=false;currentSlot=slot;loadGame();__testTimers.forEach(clearInterval);state.running=false;state.ff=false;},fixture.slot);
    const final=await page.evaluate(capture);stage(final,true);preserved(final,baseline);
    reports.push({case:'native save and second full reload preserve all stock after re-enable',source:final.source,inventoryCount:final.inventory.reduce((n,i)=>n+i.cnt,0),warehouseCount:final.warehouse.reduce((n,i)=>n+i.cnt,0)});

    const fxOff=await page.evaluate(()=>{
      AFK_TOGGLES.set('relicfx',false);
      const c={actor:player,target:{uid:'fx-off',curHp:1000,hp:1000},weapon:DB.items[player.eq.wpn.id],damage:100,main:true,direct:true,origin:'normal',kind:'melee'};
      AFK_RELIC_RUNTIME.dispatch('beforeAttack',c);
      return {count:AFK_RELIC_RUNTIME.sources(player).length,heavy:!!c.forceHeavy,identity:!!DB.items[player.eq.gloves.id],data:!!window.__afkRelicData,plus:!!window.__afkRelicPlus};
    });
    assert.deepEqual(fxOff,{count:0,heavy:false,identity:true,data:true,plus:true});
    reports.push({case:'always-on identity data does not bypass the separate relicfx switch',...fxOff});

    const legacyTransaction=await page.evaluate(()=>{
      AFK_TOGGLES.set('relicfx',true);state.ff=false;
      const D=__afkRelicData,A=__afkRelicPlus,R=AFK_RELIC_RUNTIME;
      const base=R.byId[229].key,fx=R.byId[230].key;
      const oldId=D.makeId(base,5,fx,0),nextId=D.makeId(base,5,fx,1),normalId=D.makeId(fx,5,null,null);
      D.ensure(oldId);D.ensure(normalId);
      player.inv.push({id:oldId,uid:'legacy-transaction',cnt:3,en:0,bless:true,anc:'eternal',attr:false,lock:false});
      player.inv.push({id:normalId,uid:'new-unascended-accessory',cnt:3,en:0,lock:false});
      player.inv.push({id:'afk_asc_stone_acc',uid:'legacy-transaction-stone',cnt:1,en:0,lock:false});
      if(!saveGame())throw Error('Legacy transaction fixture did not save');
      const oldGroup=A.groups().find(g=>g.base===base&&g.n===5&&g.asc===0&&g.fx===fx);
      const before=JSON.stringify({inv:player.inv,gold:player.gold});
      const downgrade=A.upgrade(oldGroup.key),downgradeUnchanged=before===JSON.stringify({inv:player.inv,gold:player.gold});
      A.open();
      const row=Array.from(document.querySelectorAll('#rp-list .rp-row')).find(el=>el.querySelector('[data-k]')?.getAttribute('data-k')===oldGroup.key);
      const button=row&&row.querySelector('button').textContent;
      const next=A.ascend(oldGroup.key,0,true);
      const produced=player.inv.find(i=>i.id===nextId);
      const remaining=player.inv.filter(i=>i.id===oldId).reduce((n,i)=>n+(i.cnt||1),0);
      const stones=player.inv.filter(i=>i.id==='afk_asc_stone_acc').reduce((n,i)=>n+(i.cnt||1),0);
      const normalGroup=A.groups().find(g=>g.base===fx&&g.n===5&&g.asc==null);
      const normalBefore=JSON.stringify({inv:player.inv,gold:player.gold}),normal=A.ascend(normalGroup.key,0,true);
      const normalUnchanged=normalBefore===JSON.stringify({inv:player.inv,gold:player.gold});
      const signed=_saveUnwrap(_lzGet('lineage_idle_save_'+currentSlot));
      return {oldId,nextId,downgrade,downgradeUnchanged,button,next,produced,remaining,stones,normal,normalUnchanged,signed:signed.ok};
    });
    assert.equal(legacyTransaction.downgrade.ok,false);assert.equal(legacyTransaction.downgradeUnchanged,true);
    assert.match(legacyTransaction.button,/昇華支配 \+1/);assert.ok(!legacyTransaction.button.includes('合成 +6'));
    assert.equal(legacyTransaction.next.ok,true);assert.equal(legacyTransaction.next.success,true);
    assert.equal(legacyTransaction.produced.bless,true);assert.equal(legacyTransaction.produced.anc,'eternal');
    assert.equal(legacyTransaction.remaining,2);assert.equal(legacyTransaction.stones,0);
    assert.equal(legacyTransaction.normal.ok,false);assert.match(legacyTransaction.normal.msg,/\+10/);assert.equal(legacyTransaction.normalUnchanged,true);assert.equal(legacyTransaction.signed,true);
    await page.reload({waitUntil:'load'});await page.waitForFunction(()=>!!window.AFK_RELIC_INTEGRATION);
    const legacyReload=await page.evaluate(({slot,id})=>{__testTimers.forEach(clearInterval);state.ff=false;currentSlot=slot;loadGame();__testTimers.forEach(clearInterval);state.running=false;state.ff=false;return {item:player.inv.find(i=>i.id===id),meta:__afkRelicData.parseId(id)};},{slot:fixture.slot,id:legacyTransaction.nextId});
    assert.ok(legacyReload.item);assert.equal(legacyReload.meta.n,5);assert.equal(legacyReload.meta.asc,1);assert.equal(legacyReload.item.bless,true);assert.equal(legacyReload.item.anc,'eternal');
    reports.push({case:'legacy +5 ascended accessory keeps its ascension route, cannot be downgraded by normal merge, and persists the native transaction',...legacyTransaction,reload:legacyReload});
    assert.deepEqual(errors,[]);
  } finally {await close();}
} finally {await browser.close();}
await mkdir(new URL('../.scratch/',import.meta.url),{recursive:true});
await writeFile(new URL('../.scratch/relic-data-lifecycle-results.json',import.meta.url),JSON.stringify({passed:reports.length,reports},null,2));
console.log(JSON.stringify({passed:reports.length,cases:reports.map(r=>r.case)},null,2));
