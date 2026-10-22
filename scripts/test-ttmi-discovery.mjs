// Full indexed game, isolated storage. Exercise the actual search UI, custom
// merchant, native crafting, rift entry/exit, inventory use and history manager.
// Only the character/stock and viewport are fixtures; no action is replaced.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {testBrowser,createProfile} from './relic-test-browser.mjs';

const browser=await testBrowser(),cases=[];
try {
  const {page,errors,close}=await browser.page();
  try {
    await page.evaluate(createProfile,{cls:'mage',lv:80});
    await page.evaluate(()=>{
      state.ff=false;player.enSeed='ttmi-discovery-native';currentSlot=1;
      player.cardDex={};player.cardDexV=2;
      document.getElementById('creation-screen').classList.add('hidden');
      document.getElementById('game-screen').classList.remove('hidden');
      window.__ttmiCount=id=>player.inv.reduce((n,it)=>n+(it.id===id?(it.cnt==null?1:it.cnt):0),0);
    });
    const coverage=await page.evaluate(()=>{
      const A=AFK_TTMI_ITEMS,D=AFK_DEX_API,miss=[],wrongShop=[],wrongRift=[],missingRecipes=[],missingUses=[],missingBook=[];
      const acq=new Map(),get=id=>{if(!acq.has(id))acq.set(id,D.acquireHTML(id));return acq.get(id);};
      const plain=html=>{const el=document.createElement('div');el.innerHTML=html;return el.textContent;};
      for(const id of A.items){const d=DB.items[id],s=D.searchSummary(d.n,10000);if(!s||!s.items.includes(d.n))miss.push(id);
        const src=A.acquisition(id),h=get(id);
        if(src?.shop&&(!h.includes('古物商人 洛依')||!h.includes(src.shop.price.toLocaleString()+' 金幣')||h.includes('攻城獲勝期間 8 折')))wrongShop.push(id);
        if(src?.rift&&(!h.includes('時空裂痕')||h.includes('古物商人 洛依')||h.includes('沒有固定取得途徑')))wrongRift.push(id);
        const ek=(d.slot==='petwpn'||d.slot==='petarm')?'pet':equipCatKey(id,d),mk=miscCatKey(id,d);
        if(ek&&!EQUIP_ITEM_CAT[id]||mk&&!MISC_ITEM_CAT[id])missingBook.push(id);
        if(d.ttmiMaterial&&!D.itemDetailHTML(id).includes('製作用途'))missingUses.push(id);
      }
      for(const r of A.recipes){const text=plain(get(r.result));if(!text.includes('工匠 薩克')||!r.req.every(m=>text.includes((m.id==='gold'?'金幣':DB.items[m.id].n)+' ×'+m.cnt)))missingRecipes.push(r.result);}
      const gm=Object.keys(DB.items).filter(id=>DB.items[id].gmOnly).filter(id=>A.shopStock().includes(id)||(D.searchSummary(DB.items[id].n,10000)?.items||[]).includes(DB.items[id].n));
      const remapped=A.source.items.filter(r=>A.resolve(r.sourceId)!==r.id).map(r=>{const id=A.resolve(r.sourceId);return {source:r.sourceId,n:r.n,id,found:D.searchSummary(DB.items[id].n,10000)?.items.includes(DB.items[id].n),drop:get(id).includes('怪物掉落'),uses:D.itemDetailHTML(id).includes('製作用途'),book:!!MISC_ITEM_CAT[id]};});
      const newIds=new Set(A.items),dropItems=new Set(Object.values(MOB_DROPS).flatMap(a=>a.map(e=>e[0])).filter(id=>newIds.has(id)));
      return {items:A.items.length,shop:A.shopStock().length,rift:A.items.filter(id=>DB.items[id].ttmiRiftOnly).length,recipes:A.recipes.length,materials:A.items.filter(id=>DB.items[id].ttmiMaterial).length,dropMobs:A.coverage().dropMobs,dropItems:dropItems.size,equipmentBook:A.items.filter(id=>EQUIP_ITEM_CAT[id]).length,miscBook:A.items.filter(id=>MISC_ITEM_CAT[id]).length,remapped,miss,wrongShop,wrongRift,missingRecipes,missingUses,missingBook,gm};
    });
    assert.equal(coverage.items,2219,JSON.stringify(coverage));assert.equal(coverage.remapped.length,24);assert.equal(coverage.items+coverage.remapped.length,2243);assert.equal(coverage.shop,2208);assert.equal(coverage.rift,11);assert.equal(coverage.recipes,893);assert.equal(coverage.materials+coverage.remapped.length,422);
    for(const k of ['miss','wrongShop','wrongRift','missingRecipes','missingUses','missingBook','gm'])assert.deepEqual(coverage[k],[],k);
    assert.ok(coverage.remapped.every(r=>r.found&&r.drop&&r.uses&&r.book),JSON.stringify(coverage.remapped));
    cases.push({case:'all imported items searchable with live prices, all recipes and material uses, fixed collection indexes',...coverage});

    const craft=await page.evaluate(()=>{
      const A=AFK_TTMI_ITEMS,row=A.source.items.find(r=>r.refine),id=A.resolve(row.sourceId),index=A.recipes.findIndex(r=>r.ttmiRecipeKind==='refine'&&r.req.some(m=>m.id===id)),recipe=A.recipes[index];
      window.__ttmiMaterial=id;mapState.current='town_giran';
      const book=JSON.stringify(MISC_CAT_ITEMS),gold=player.gold,cost=A.price(id),bought=A.buy(id,10),afterBuy=player.gold;
      const beforeResult=__ttmiCount(recipe.result),crafted=A.craft(index);
      return {id,name:DB.items[id].n,recipe,index,cost,bought,crafted,gold,afterBuy,after:player.gold,left:__ttmiCount(id),result:__ttmiCount(recipe.result)-beforeResult,bookStable:book===JSON.stringify(MISC_CAT_ITEMS),registered:!!player.miscDex[id]};
    });
    assert.equal(craft.bought,true);assert.equal(craft.crafted,true);assert.equal(craft.afterBuy,craft.gold-craft.cost*10);assert.equal(craft.after,craft.afterBuy-100);assert.equal(craft.left,0);assert.equal(craft.result,1);assert.equal(craft.bookStable,true);assert.equal(craft.registered,true);
    cases.push({case:'native merchant purchase and workshop material/gold consumption',...craft});

    await page.evaluate(q=>AFK_DEX_API.goto({q}),craft.name);
    await page.locator('#m-dex-results .m-dex-iname[data-id="'+craft.id+'"]').first().click();
    const detail=await page.locator('#m-dex-itempop-body').textContent();
    assert.match(detail,/古物商人 洛依/);assert.match(detail,/工匠 薩克/);assert.match(detail,/製作用途/);assert.match(detail,/固定售價/);
    const detailLayers=await page.evaluate(()=>AFK_NAV.depth());
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!AFK_DEX_API.isOpen());
    cases.push({case:'actual search results open material details and ESC closes both navigation layers',detailLayers});

    const cardSources=await page.evaluate(()=>{
      const A=AFK_CARD_ASCENSION,ids=[...Object.values(A.items),...Object.values(A.catalog).flat().map(r=>r.itemId)];
      return ids.map(id=>({id,name:DB.items[id].n,text:AFK_EXTRA.itemAcquireOf(id)?.short,found:AFK_DEX_API.searchSummary(DB.items[id].n,10000)?.items.includes(DB.items[id].n)}));
    });
    assert.equal(cardSources.length,23);assert.ok(cardSources.every(r=>r.found&&r.text));
    assert.match(cardSources.find(r=>r.id==='afk_card_diamond_missing_choice').text,/尚未登錄鑽石卡/);
    assert.ok(cardSources.filter(r=>r.id.startsWith('afk_asc_card_mythic')).every(r=>r.text.includes('50%')&&r.text.includes('任一地區')));
    cases.push({case:'all advanced card and compensation items share live acquisition rules',items:cardSources.length});

    const relicRules=await page.evaluate(()=>{
      AFK_DEX_API.goto({q:'遺物'});
      const text=()=>document.querySelector('#m-dex-special [data-spid="relic"]').textContent;
      const enabled=text();
      AFK_TOGGLES.set('relicplus',false);AFK_TOGGLES.set('relicaffix',false);AFK_DEX_API.goto({q:'遺物'});
      const disabled=text();
      AFK_TOGGLES.set('relicplus',true);AFK_TOGGLES.set('relicaffix',true);AFK_DEX_API.goto({q:'遺物'});
      const restored=text();
      return {enabled,disabled,restored};
    });
    assert.match(relicRules.enabled,/武器／防具最高 \+15，飾品最高 \+10/);assert.match(relicRules.enabled,/各有 50%/);assert.doesNotMatch(relicRules.enabled,/數值永遠固定|遺物無法強化/);
    assert.match(relicRules.disabled,/遺物合成功能目前停用/);assert.match(relicRules.disabled,/重複遺物詞綴功能目前停用/);assert.equal(relicRules.restored,relicRules.enabled);
    cases.push({case:'actual special-drop rules update immediately for relic synthesis and affix toggles',enabled:relicRules.enabled,disabled:relicRules.disabled});
    await page.locator('#m-dex-close').click();
    await page.waitForFunction(()=>!AFK_DEX_API.isOpen()&&AFK_NAV.depth()===0);

    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{
      // The local host is exempt from the native unofficial-site banner. Supply
      // its real DOM id and a measured 52px fixture; padding/navigation APIs stay
      // untouched so the mobile test also exercises an occupied top edge.
      if(!document.getElementById('_orig_pbar')){const bar=document.createElement('div');bar.id='_orig_pbar';bar.textContent='非官方轉載版本（測試版面）';bar.style.cssText='position:fixed;top:0;left:0;right:0;height:52px;z-index:1000000;background:#7c2d12;color:white';document.body.appendChild(bar);}
      AFK_BANNER.remeasure();
    });
    const entered=await page.evaluate(()=>{
      gainItem('mat_crack_core',1,true,true);const before=__ttmiCount('mat_crack_core');enterRift();
      return {before,after:__ttmiCount('mat_crack_core'),active:!!AFK_TTMI_ITEMS.inRift(),credits:__ttmiCount(AFK_TTMI_ITEMS.resolve(12039)),depth:AFK_NAV.depth()};
    });
    assert.equal(entered.after,entered.before-1);assert.equal(entered.active,true);assert.equal(entered.credits,10);
    await page.locator('#ttmi-rift-button').click();
    const modal=await page.evaluate(()=>{
      const m=document.getElementById('ttmi-rift-supplies'),d=m.querySelector('[role="dialog"]'),body=document.getElementById('ttmi-rift-supplies-body'),header=d.querySelector('header'),r=d.getBoundingClientRect(),bar=document.getElementById('_orig_pbar');
      const before=header.getBoundingClientRect().top;body.scrollTop=300;
      return {role:d.getAttribute('role'),modal:d.getAttribute('aria-modal'),depth:AFK_NAV.depth(),seq:AFK_NAV.top().seq,top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:innerWidth,height:innerHeight,bannerBottom:bar?bar.getBoundingClientRect().bottom:0,headerStationary:before===header.getBoundingClientRect().top,scroll:body.scrollTop,overflow:getComputedStyle(body).overflowY};
    });
    assert.equal(modal.role,'dialog');assert.equal(modal.modal,'true');assert.equal(modal.depth,entered.depth+1);assert.ok(modal.bannerBottom>0);assert.ok(modal.top>=modal.bannerBottom);assert.ok(modal.left>=0&&modal.right<=modal.width&&modal.bottom<=modal.height);assert.equal(modal.headerStationary,true);assert.ok(modal.scroll>0);assert.equal(modal.overflow,'auto');
    const healId=await page.evaluate(()=>AFK_TTMI_ITEMS.resolve(12029));
    await page.locator('[data-rift-buy="'+healId+'"]').click();
    const bought=await page.evaluate(id=>({count:__ttmiCount(id),credits:__ttmiCount(AFK_TTMI_ITEMS.resolve(12039)),depth:AFK_NAV.depth(),seq:AFK_NAV.top().seq,registered:!!player.miscDex[id]}),healId);
    assert.equal(bought.count,1);assert.equal(bought.credits,9);assert.equal(bought.depth,modal.depth);assert.equal(bought.seq,modal.seq);assert.equal(bought.registered,true);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('ttmi-rift-supplies'));
    await page.locator('#ttmi-rift-button').click();
    await page.evaluate(()=>history.back());await page.waitForFunction(()=>!document.getElementById('ttmi-rift-supplies'));
    const afterBack=await page.evaluate(()=>AFK_NAV.depth());assert.equal(afterBack,entered.depth);
    const riftToggle=await page.evaluate(id=>{
      const credit=AFK_TTMI_ITEMS.resolve(12039),before=__ttmiCount(credit),held=__ttmiCount(id);
      AFK_TOGGLES.set('ttmi-items',false);useItem(player.inv.find(it=>it.id===id).uid);
      const hidden=!document.getElementById('ttmi-rift-button'),kept=__ttmiCount(id)===held;
      AFK_TOGGLES.set('ttmi-items',true);
      return {before,after:__ttmiCount(credit),hidden,kept,restored:!!document.getElementById('ttmi-rift-button')};
    },healId);
    assert.equal(riftToggle.after,riftToggle.before);assert.equal(riftToggle.hidden,true);assert.equal(riftToggle.kept,true);assert.equal(riftToggle.restored,true);
    await page.locator('#ttmi-rift-button').click();
    const exited=await page.evaluate(id=>{
      const it=player.inv.find(i=>i.id===id);player.hp=1;useItem(it.uid);const healed=player.hp>1;
      riftEvacuate();
      return {healed,active:!!AFK_TTMI_ITEMS.inRift(),modal:!!document.getElementById('ttmi-rift-supplies'),depth:AFK_NAV.depth(),remaining:player.inv.filter(i=>DB.items[i.id]?.ttmiRiftOnly).length,registered:!!player.miscDex[id],creditRegistered:!!player.miscDex[AFK_TTMI_ITEMS.resolve(12039)]};
    },healId);
    assert.equal(exited.healed,true);assert.equal(exited.active,false);assert.equal(exited.modal,false);assert.equal(exited.depth,entered.depth);assert.equal(exited.remaining,0);assert.equal(exited.registered,true);assert.equal(exited.creditRegistered,true);
    cases.push({case:'native rift entry, mobile supply dialog, exact purchase, native heal, ESC/back, toggle and evacuation cleanup',entered,modal,bought,riftToggle,exited});

    const cardModal=await page.evaluate(()=>{
      const base=AFK_NAV.depth();AFK_CARD_ASCENSION.openCollection();
      const d=document.querySelector('#afk-card-ascension-modal [role="dialog"]'),r=d.getBoundingClientRect(),bar=document.getElementById('_orig_pbar');
      return {base,depth:AFK_NAV.depth(),modal:d.getAttribute('aria-modal'),top:r.top,bottom:r.bottom,width:r.width,height:innerHeight,bannerBottom:bar?bar.getBoundingClientRect().bottom:0};
    });
    assert.equal(cardModal.depth,cardModal.base+1);assert.equal(cardModal.modal,'true');assert.ok(cardModal.top>=cardModal.bannerBottom);assert.ok(cardModal.bottom<=cardModal.height);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('afk-card-ascension-modal'));
    assert.equal(await page.evaluate(()=>AFK_NAV.depth()),cardModal.base);
    const books=await page.evaluate(()=>({misc:JSON.stringify(MISC_CAT_ITEMS),equip:JSON.stringify(EQUIP_CAT_ITEMS),material:__ttmiMaterial,rifts:AFK_TTMI_ITEMS.items.filter(id=>DB.items[id].ttmiRiftOnly),slot:currentSlot}));
    await page.evaluate(()=>saveGame());await page.reload({waitUntil:'load'});
    const restored=await page.evaluate(({slot,material,rifts})=>{
      window.__testTimers.forEach(clearInterval);state.running=false;state.ff=false;currentSlot=slot;loadGame();window.__testTimers.forEach(clearInterval);state.running=false;state.ff=false;
      return {misc:JSON.stringify(MISC_CAT_ITEMS),equip:JSON.stringify(EQUIP_CAT_ITEMS),material:!!player.miscDex[material],rift:rifts.some(id=>player.miscDex[id])};
    },books);
    assert.equal(restored.misc,books.misc);assert.equal(restored.equip,books.equip);assert.equal(restored.material,true);assert.equal(restored.rift,true);
    cases.push({case:'card dialog navigation and native collection/save reload stability',cardModal,materialRegistered:restored.material,riftCollectionRetained:restored.rift});

    const disabledSave=await page.evaluate(()=>{
      const A=AFK_TTMI_ITEMS,normal=A.items.filter(id=>!DB.items[id].ttmiRiftOnly);
      const potion=normal.find(id=>DB.items[id].ttmiHealPotion&&DB.items[id].valMin>0&&(!DB.items[id].req||DB.items[id].req==='all'));
      const ids=[...new Set(['wpn','arm','acc','pot','misc','scroll','skillbk','etc'].map(type=>normal.find(id=>DB.items[id].type===type)).concat(potion).filter(Boolean))];
      ids.forEach((id,i)=>gainItem(id,i+2,true,true));
      const wh=loadWarehouse();ids.forEach((id,i)=>wh.items.push({id,uid:uid(),cnt:i+1,en:0,lock:i===0}));saveWarehouse(wh);
      const counts=items=>Object.fromEntries(ids.map(id=>[id,items.reduce((n,it)=>n+(it.id===id?(it.cnt==null?1:it.cnt):0),0)]));
      const held=counts(player.inv),stored=counts(loadWarehouse().items),newIds=new Set(A.items);
      const dropEntries=Object.values(MOB_DROPS).reduce((n,a)=>n+a.filter(e=>newIds.has(e[0])).length,0);
      const saved=saveGame();AFK_TOGGLES.set('ttmi-items',false);
      useItem(player.inv.find(it=>it.id===potion).uid);
      const denied=[A.buy(potion,1),A.craft(0),doCraft('npc_ttmi_workshop',0,false)];
      return {ids,potion,held,stored,dropEntries,saved,slot:currentSlot,after:counts(player.inv),denied};
    });
    assert.equal(disabledSave.saved,true);assert.deepEqual(disabledSave.after,disabledSave.held);assert.ok(disabledSave.denied.every(x=>x===false));
    await page.reload({waitUntil:'load'});
    const disabledReload=await page.evaluate(({slot,ids,potion})=>{
      window.__testTimers.forEach(clearInterval);state.running=false;state.ff=false;currentSlot=slot;
      const A=AFK_TTMI_ITEMS,allDefined=A.items.every(id=>DB.items[id]),newIds=new Set(A.items);
      loadGame();window.__testTimers.forEach(clearInterval);state.running=false;state.ff=false;
      const counts=items=>Object.fromEntries(ids.map(id=>[id,items.reduce((n,it)=>n+(it.id===id?(it.cnt==null?1:it.cnt):0),0)]));
      const dropCount=()=>Object.values(MOB_DROPS).reduce((n,a)=>n+a.filter(e=>newIds.has(e[0])).length,0);
      const npcCount=()=>DB.towns.town_giran.npcs.filter(n=>n.id==='npc_ttmi_archive'||n.id==='npc_ttmi_workshop').length;
      const off={enabled:A.enabled(),allDefined,held:counts(player.inv),stored:counts(loadWarehouse().items),drops:dropCount(),npcs:npcCount(),recipes:CRAFT_RECIPES.npc_ttmi_workshop.length,book:JSON.stringify(MISC_CAT_ITEMS),equipBook:JSON.stringify(EQUIP_CAT_ITEMS)};
      useItem(player.inv.find(it=>it.id===potion).uid);off.afterUse=counts(player.inv);
      AFK_TOGGLES.set('ttmi-items',true);AFK_TOGGLES.set('ttmi-items',true);
      mapState.current='town_giran';player.hp=1;player.cds.pot=0;player.ttmiPotionRemaining=0;
      const bought=A.buy(potion,1),afterBuy=counts(player.inv)[potion];useItem(player.inv.find(it=>it.id===potion).uid);
      const on={enabled:A.enabled(),npcs:npcCount(),drops:dropCount(),recipes:CRAFT_RECIPES.npc_ttmi_workshop.length,bought,afterBuy,afterUse:counts(player.inv)[potion],healed:player.hp>1,stored:counts(loadWarehouse().items)};
      return {off,on};
    },disabledSave);
    assert.equal(disabledReload.off.enabled,false);assert.equal(disabledReload.off.allDefined,true);assert.deepEqual(disabledReload.off.held,disabledSave.held);assert.deepEqual(disabledReload.off.afterUse,disabledSave.held);assert.deepEqual(disabledReload.off.stored,disabledSave.stored);
    assert.equal(disabledReload.off.drops,0);assert.equal(disabledReload.off.npcs,0);assert.equal(disabledReload.off.recipes,0);assert.equal(disabledReload.off.book,books.misc);assert.equal(disabledReload.off.equipBook,books.equip);
    assert.equal(disabledReload.on.enabled,true);assert.equal(disabledReload.on.npcs,2);assert.equal(disabledReload.on.drops,disabledSave.dropEntries);assert.equal(disabledReload.on.recipes,893);assert.equal(disabledReload.on.bought,true);assert.equal(disabledReload.on.afterUse,disabledReload.on.afterBuy-1);assert.equal(disabledReload.on.healed,true);assert.deepEqual(disabledReload.on.stored,disabledSave.stored);
    cases.push({case:'all TTMI definitions and native inventory/warehouse survive disabled reload; acquisition is disabled and resumes once',protected:disabledSave.ids.length,definitions:2219,off:{drops:disabledReload.off.drops,npcs:disabledReload.off.npcs,recipes:disabledReload.off.recipes},on:disabledReload.on});
    assert.deepEqual(errors,[]);
    const report={passed:cases.length,pageErrors:errors,cases};
    if(process.argv.includes('--write-report'))await writeFile(new URL('../data/ttmi-items-integration.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  } finally {await close();}
} finally {await browser.close();}
