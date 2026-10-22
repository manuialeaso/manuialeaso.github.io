// Real index + real inventory, card acquisition, scroll actions, native saves,
// and native reload. Fixtures supply collections/stock/character seeds only;
// no synthesis, consumption, saving, polymorph or recompute function is mocked.
import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';

const browser=await testBrowser();
const reports=[];
try {
  const {page,errors,close}=await browser.page();
  try {
    await page.evaluate(code=>{window.__cardProfile=eval('('+code+')');window.__cardFixtureSlot=0;},createProfile.toString());
    const startup=await page.evaluate(()=>{
      const A=window.AFK_CARD_ASCENSION;
      if(!A||!window.AFK_CARD_FORMS)throw Error('Card scripts must be loaded by the actual index.');
      const before=JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
      const denied=[A.synthesize('mythic'),A.acquire(A.catalog.mythic[0].id),A.exchangeFragments()];
      const after=JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
      const native70=[...POLY_TIERS.flatMap(t=>t.forms),...CONTROL_ONLY_POLY_FORMS].filter(f=>f.lv>=70);
      const eligible=[...new Set(native70.map(f=>f.n))].sort();
      const mythic=A.catalog.mythic.map(r=>r.prototype||r.form.cardVisualBase).sort();
      return {denied:denied.every(r=>!r.ok),unchanged:before===after,counts:Object.fromEntries(Object.entries(A.catalog).map(([k,v])=>[k,v.length])),eligible,mythic,missingSpeeds:AFK_CARD_FORMS.monsterNames().filter(n=>!AFK_CARD_FORMS.monsterForm(n))};
    });
    assert.equal(startup.denied,true);assert.equal(startup.unchanged,true);
    assert.deepEqual(startup.mythic,startup.eligible);assert.equal(startup.counts.celestial,3);assert.equal(startup.counts.spacetime,3);
    assert.deepEqual(startup.missingSpeeds,[]);
    reports.push({case:'catalog and title screen',...startup});

    async function fixture(options={}) {
      return page.evaluate(options=>{
        __cardProfile({cls:'mage',lv:80,...options});
        state.ff=false; // Exercise real signed writes, not catch-up's deferred save.
        currentSlot=++window.__cardFixtureSlot;
        player.enSeed='card-fixture-'+currentSlot;
        player.cardDex={};player.cardDexV=2;
        closePolyModal();AFK_CARD_ASCENSION.close();try{closeCardBook();closeModal();}catch(e){}
        document.getElementById('creation-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        window.__cardCount=function(id){return player.inv.reduce((n,it)=>n+(it.id===id?(it.cnt==null?1:it.cnt):0),0);};
        window.__allDiamondCount=function(){return player.inv.reduce((n,it)=>{var d=DB.items[it.id];return n+(d&&d.eff==='card'&&d.cardTier===5?(it.cnt==null?1:it.cnt):0);},0);};
        window.__fillDiamond=function(){player.cardDex=Object.fromEntries(AFK_CARD_FORMS.monsterNames().map(n=>[n,10000]));player.cardDexV=2;saveCardDex();};
        window.__fullPredecessor=function(t){const A=AFK_CARD_ASCENSION;player.cardAscension={v:1,owned:{},attempts:{},failures:{},unlocked:{},rewardSeq:0};if(t==='celestial'||t==='spacetime')A.catalog.mythic.forEach(r=>player.cardAscension.owned[r.id]=true);if(t==='spacetime')A.catalog.celestial.forEach(r=>player.cardAscension.owned[r.id]=true);};
        window.__findCardSeed=function(tier,predicate){for(let i=0;i<200000;i++){let seed='card-rng-'+tier+'-'+i;const draw=(seq,purpose='success')=>_seededFloat(seed+'|cardAscension|'+tier+'|'+seq+'|'+purpose);if(predicate(draw))return seed;}throw Error('No fixture seed');};
        return currentSlot;
      },options);
    }
    await fixture();
    const gating=await page.evaluate(()=>{
      const name=POLY_TIERS.flatMap(t=>t.forms).find(f=>CARD_MOB_INFO[f.n]).n;
      window.__cardMonster=name;
      gainItem('scroll_poly',4,true,true);gainItem('acc_117',1,true,true);
      const uid=player.inv.find(i=>i.id==='scroll_poly').uid;
      const before=__cardCount('scroll_poly');
      const named=getPolyStateByName(name),match=polyFormMatchesEquippedWeapon(findPolyForm(name).form);
      const confirmed=confirmPolySelect(uid,name);
      useItem(uid);
      return {name,named,match,confirmed,before,after:__cardCount('scroll_poly'),lockedShown:[...document.querySelectorAll('[data-card-form]')].some(b=>b.dataset.cardForm===name),force:getPolyState(true).n};
    });
    assert.equal(gating.named,null);assert.equal(gating.match,false);assert.equal(gating.confirmed,false);assert.equal(gating.before,gating.after);assert.equal(gating.lockedShown,false);assert.equal(gating.force,'死亡騎士');
    reports.push({case:'locked monster scroll and forced set exception',...gating});

    const diamond=await page.evaluate(()=>{
      const name=window.__cardMonster;
      player.inv=player.inv.filter(i=>i.id!=='acc_117'); // The card itself grants selection.
      acquireCard(name,5,2);
      const uid=player.inv.find(i=>i.id==='scroll_poly').uid;
      useItem(uid);
      return {name,score:player.cardDex[name],copies:__cardCount(cardId(name,5)),ring:hasPolyRing(),available:[...document.querySelectorAll('[data-card-form]')].some(b=>b.dataset.cardForm===name)};
    });
    assert.equal(diamond.score,10000);assert.equal(diamond.copies,1);assert.equal(diamond.ring,false);assert.equal(diamond.available,true);
    await page.locator('[data-card-form]').filter({hasText:diamond.name}).first().click();
    const selected=await page.evaluate(()=>{
      const f=AFK_CARD_FORMS.monsterForm(__cardMonster),before=__cardCount('scroll_poly');
      const actual={name:player.poly.n,aspd:player.d.aspd,cast:player.d.castLock,stun:player.d.hitstun,expectedAspd:60/f.atkApm,expectedCast:f.cast,expectedStun:f.stun};
      player.buffs.poly=0;
      useItem(player.inv.find(i=>i.id==='scroll_poly').uid,true);
      return {...actual,before,after:__cardCount('scroll_poly'),renewed:player.buffs.poly,renewedName:player.poly.n,ring:hasPolyRing(),mythicActive:AFK_CARD_ASCENSION.active(player)};
    });
    assert.equal(selected.aspd,selected.expectedAspd);assert.equal(selected.cast,selected.expectedCast);assert.equal(selected.stun,selected.expectedStun);
    assert.equal(selected.after,selected.before-1);assert.equal(selected.renewed,1800);assert.equal(selected.renewedName,diamond.name);assert.equal(selected.ring,false);assert.equal(selected.mythicActive,null);
    reports.push({case:'native diamond acquisition, UI scroll, exact base speeds and renewal',diamond,selected});

    await fixture();
    const regional=await page.evaluate(()=>{
      const A=AFK_CARD_ASCENSION;
      const region=CARD_REGIONS.filter(r=>(CARD_REGION_MOBS[r.key]||[]).length).sort((a,b)=>CARD_REGION_MOBS[a.key].length-CARD_REGION_MOBS[b.key].length)[0];
      const names=CARD_REGION_MOBS[region.key];
      names.forEach(n=>player.cardDex[n]=10000);
      const s=A.status();
      gainItem(cardId(names[0],5),4,true,true);
      gainItem('potion_red',7,true,true);
      const before=JSON.stringify(player.inv),dex=JSON.stringify(player.cardDex),result=A.synthesize('mythic');
      return {region:region.name,regionCount:names.length,total:s.total,full:A.diamondFull(),unlock:s.tiers[0].unlocked,result,noMaterialsChanged:before===JSON.stringify(player.inv),dexUnchanged:dex===JSON.stringify(player.cardDex)};
    });
    assert.equal(regional.full,false);assert.ok(regional.regionCount<regional.total);assert.equal(regional.unlock,true);assert.equal(regional.result.ok,false);assert.equal(regional.noMaterialsChanged,true);assert.equal(regional.dexUnchanged,true);
    reports.push({case:'one completed region unlocks mythic; insufficient stock is atomic',...regional});

    await fixture();
    const preservation=await page.evaluate(()=>{
      const A=AFK_CARD_ASCENSION;__fillDiamond();
      const ns=AFK_CARD_FORMS.monsterNames(),first=ns[0],second=ns[1];
      gainItem(cardId(first,5),5,true,true);player.inv.find(i=>i.id===cardId(first,5)).lock=true;
      gainItem(cardId(second,4),5,true,true);gainItem('potion_red',3,true,true);
      const before=JSON.stringify(player.inv),dex=JSON.stringify(player.cardDex),r=A.synthesize('mythic');
      return {result:r,unchanged:before===JSON.stringify(player.inv),dexUnchanged:dex===JSON.stringify(player.cardDex),available:A.status().excess};
    });
    assert.equal(preservation.result.ok,false);assert.equal(preservation.unchanged,true);assert.equal(preservation.dexUnchanged,true);assert.equal(preservation.available,0);
    reports.push({case:'locked diamond and platinum cannot pay the five-card cost',...preservation});

    await fixture();
    const catchingUp=await page.evaluate(()=>{
      const A=AFK_CARD_ASCENSION;__fillDiamond();gainItem(cardId(AFK_CARD_FORMS.monsterNames()[0],5),5,true,true);
      const inv=JSON.stringify(player.inv),dex=JSON.stringify(player.cardDex),shared=_lzGet(_dexKey(CARDDEX_KEY));
      state.ff=true;const action=A.synthesize('mythic');state.ff=false;
      return {action,invUnchanged:inv===JSON.stringify(player.inv),dexUnchanged:dex===JSON.stringify(player.cardDex),sharedUnchanged:shared===_lzGet(_dexKey(CARDDEX_KEY))};
    });
    assert.equal(catchingUp.action.ok,false);assert.equal(catchingUp.invUnchanged,true);assert.equal(catchingUp.dexUnchanged,true);assert.equal(catchingUp.sharedUnchanged,true);
    reports.push({case:'native deferred-save catch-up preserves materials and shared diamond registration',...catchingUp});

    // Ten genuine deterministic failures, then the native eleventh attempt.
    // All diamonds are collected in this fixture so refunds remain physical:
    // mythic net cost 45; the other tracks spend 55 and grant 10 separate refunds.
    for(const tier of ['mythic','celestial','spacetime']) {
      await fixture();
      const pity=await page.evaluate(tier=>{
        const A=AFK_CARD_ASCENSION,rate={mythic:.5,celestial:.3,spacetime:.1}[tier];
        __fillDiamond();__fullPredecessor(tier);
        player.enSeed=__findCardSeed(tier,draw=>Array.from({length:10},(_,i)=>i+1).every(n=>draw(n)>=rate));
        const other=['mythic','celestial','spacetime'].filter(t=>t!==tier);
        other.forEach((t,i)=>player.cardAscension.failures[t]=i+2);
        gainItem(cardId(AFK_CARD_FORMS.monsterNames()[0],5),55,true,true);gainItem('potion_red',9,true,true);
        const dex=JSON.stringify(player.cardDex),results=[];
        for(let n=0;n<11;n++)results.push(A.synthesize(tier));
        return {tier,results,diamonds:__allDiamondCount(),ordinary:__cardCount('potion_red'),fragments:__cardCount(A.items.fragment),choices:__cardCount(A.items.diamondChoice),dexUnchanged:dex===JSON.stringify(player.cardDex),counters:player.cardAscension.failures,attempts:player.cardAscension.attempts,other};
      },tier);
      assert.ok(pity.results.every(r=>r.ok),JSON.stringify(pity));assert.ok(pity.results.slice(0,10).every(r=>!r.success&&!r.guaranteed));
      assert.equal(pity.results[10].success,true);assert.equal(pity.results[10].guaranteed,true);assert.equal(pity.results[10].reward.kind,'unlock');
      assert.equal(pity.attempts[tier],11);assert.equal(pity.counters[tier],0);
      pity.other.forEach((t,i)=>assert.equal(pity.counters[t],i+2));
      assert.equal(pity.diamonds,tier==='mythic'?10:0);assert.equal(pity.ordinary,9);assert.equal(pity.dexUnchanged,true);
      assert.equal(pity.fragments,tier==='spacetime'?10:0);assert.equal(pity.choices,tier==='celestial'?10:0);
      reports.push({case:'independent pity and conserved refunds',...pity});
    }

    await fixture();
    const threshold=await page.evaluate(()=>{
      const A=AFK_CARD_ASCENSION;__fillDiamond();__fullPredecessor('mythic');
      const s=player.cardAscension;
      s.owned[A.catalog.mythic[0].id]=true;
      const oneMyth=A.status().tiers[1].unlocked;
      A.catalog.mythic.slice(0,-1).forEach(r=>s.owned[r.id]=true);
      const missingMyth=A.status().tiers[1].unlocked;
      s.owned[A.catalog.mythic.at(-1).id]=true;
      const allMyth=A.status().tiers[1].unlocked;
      s.owned[A.catalog.celestial[0].id]=true;
      const oneCelestial=A.status().tiers[2].unlocked;
      A.catalog.celestial.forEach(r=>s.owned[r.id]=true);
      return {oneMyth,missingMyth,allMyth,oneCelestial,allCelestial:A.status().tiers[2].unlocked};
    });
    assert.deepEqual(threshold,{oneMyth:false,missingMyth:false,allMyth:true,oneCelestial:false,allCelestial:true});
    reports.push({case:'complete previous collection gates the next tier',...threshold});

    await fixture();
    const duplicate=await page.evaluate(()=>{
      const A=AFK_CARD_ASCENSION;__fillDiamond();__fullPredecessor('mythic');
      const rows=A.catalog.mythic;
      player.enSeed=__findCardSeed('mythic',draw=>draw(1)<.5&&draw(2)<.5&&Math.floor(draw(1,'card')*rows.length)===Math.floor(draw(2,'card')*rows.length));
      gainItem(cardId(AFK_CARD_FORMS.monsterNames()[0],5),10,true,true);
      const a=A.synthesize('mythic'),b=A.synthesize('mythic');
      return {a,b,remaining:__allDiamondCount(),owned:A.listOwned(player).length,failures:player.cardAscension.failures.mythic};
    });
    assert.equal(duplicate.a.success,true);assert.equal(duplicate.a.reward.kind,'unlock');assert.equal(duplicate.b.success,true);assert.equal(duplicate.b.reward.kind,'star');assert.equal(duplicate.b.reward.stars,1);assert.equal(duplicate.owned,1);assert.equal(duplicate.remaining,0);   /* 卡冊：重複取得改為升星（滿 7 星後才返還鑽石卡） */assert.equal(duplicate.failures,0);
    reports.push({case:'duplicate mythic adds one codex star',...duplicate});

    await fixture();
    const choiceStart=await page.evaluate(()=>{
      const A=AFK_CARD_ASCENSION;__fillDiamond();
      const names=AFK_CARD_FORMS.monsterNames();
      window.__missingDiamond=names[0];player.cardDex[names[0]]=1000; // Lower tier remains eligible.
      gainItem(A.items.diamondChoice,2,true,true);
      const it=player.inv.find(i=>i.id===A.items.diamondChoice);
      const rejected=A.chooseDiamondReward(it.uid,names[1]);
      useItem(it.uid);
      return {id:A.items.diamondChoice,rejected,options:[...document.querySelectorAll('[data-diamond-choice]')].map(b=>b.dataset.diamondChoice),missing:names[0]};
    });
    assert.equal(choiceStart.rejected.ok,false);assert.deepEqual(choiceStart.options,[choiceStart.missing]);
    await page.locator('[data-diamond-choice]').click();
    const choiceEnd=await page.evaluate(()=>{
      const A=AFK_CARD_ASCENSION,before=__cardCount(A.items.diamondChoice),it=player.inv.find(i=>i.id===A.items.diamondChoice);
      useItem(it.uid);
      return {score:player.cardDex[__missingDiamond],before,after:__cardCount(A.items.diamondChoice),full:A.diamondFull(),open:!!document.getElementById('afk-card-ascension-modal')};
    });
    assert.equal(choiceEnd.score,10000);assert.equal(choiceEnd.before,1);assert.equal(choiceEnd.after,1);assert.equal(choiceEnd.full,true);assert.equal(choiceEnd.open,false);
    reports.push({case:'native choice only accepts missing diamonds and preserves full-collection voucher',choiceStart,choiceEnd});

    await fixture();
    const fragments=await page.evaluate(()=>{
      const A=AFK_CARD_ASCENSION;gainItem(A.items.fragment,11,true,true);
      const it=player.inv.find(i=>i.id===A.items.fragment);useItem(it.uid);
      const token=player.inv.find(i=>i.id===A.items.choice);useItem(token.uid);
      return {left:__cardCount(A.items.fragment),tokens:__cardCount(A.items.choice),choices:[...document.querySelectorAll('[data-choice-card]')].map(x=>x.dataset.choiceCard)};
    });
    assert.equal(fragments.left,1);assert.equal(fragments.tokens,1);assert.equal(fragments.choices.length,3);
    await page.locator('[data-choice-card]').first().click();
    const chosen=await page.evaluate(()=>({owned:AFK_CARD_ASCENSION.listOwned(player).map(r=>r.id),token:__cardCount(AFK_CARD_ASCENSION.items.choice),fragment:__cardCount(AFK_CARD_ASCENSION.items.fragment),spacetime:AFK_CARD_ASCENSION.status().tiers[2].unlocked}));
    assert.equal(chosen.owned.length,1);assert.equal(chosen.token,0);assert.equal(chosen.fragment,1);assert.equal(chosen.spacetime,false);
    reports.push({case:'native fragment use, ten-to-one exchange and celestial choice UI',fragments,chosen});
    const otherDuplicates=await page.evaluate(()=>{
      const A=AFK_CARD_ASCENSION;__fillDiamond();
      return ['celestial','spacetime'].map(t=>{
        const row=A.catalog[t][0];if(!A.owned(row.id,player)){gainItem(row.itemId,1,true,true);useItem(player.inv.find(i=>i.id===row.itemId).uid);}
        const before=__allDiamondCount();gainItem(row.itemId,1,true,true);useItem(player.inv.find(i=>i.id===row.itemId).uid);
        return {tier:t,delta:__allDiamondCount()-before,left:__cardCount(row.itemId),owned:A.owned(row.id,player)};
      });
    });
    for(const r of otherDuplicates){assert.equal(r.delta,0);assert.equal(r.left,0);assert.equal(r.owned,true);}
    reports.push({case:'native celestial and spacetime duplicates each add one codex star',results:otherDuplicates});

    await fixture();
    const saved=await page.evaluate(()=>{
      const A=AFK_CARD_ASCENSION;__fillDiamond();
      const row=A.catalog.mythic[0];gainItem(row.itemId,1,true,true);
      useItem(player.inv.find(it=>it.id===row.itemId).uid);
      gainItem('scroll_poly',2,true,true);useItem(player.inv.find(it=>it.id==='scroll_poly').uid);confirmPolySelect(player.inv.find(it=>it.id==='scroll_poly').uid,row.form.n);
      player.cardAscension.failures.celestial=7;player.cardAscension.attempts.celestial=12;
      const active=A.active(player)?.id,owned=A.owned(row.id,player),used=__cardCount(row.itemId);
      saveGame();const raw=_saveUnwrap(_lzGet('lineage_idle_save_'+currentSlot));const disk=JSON.parse(raw.payload);
      const before=cloneForTest(player.cardAscension);
      function cloneForTest(x){return JSON.parse(JSON.stringify(x));}
      loadGame();window.__testTimers.forEach(clearInterval);state.running=false;state.ff=false;
      const after=cloneForTest(player.cardAscension),stillOwned=A.owned(row.id,player);
      const isolated={cls:'mage',poly:cloneForTest(row.form),buffs:{poly:1800},cardAscension:{owned:{}}};
      const otherActorLocked=A.active(isolated);isolated.cardAscension.owned[row.id]=true;const otherActorOwned=A.active(isolated)?.id;isolated._setPoly={n:'套裝變身'};const forcedOverrides=A.active(isolated);
      return {active,owned,used,signed:raw.signed,valid:raw.ok,before,after,stillOwned,otherActorLocked,otherActorOwned,forcedOverrides,diskState:disk.p.cardAscension,notInMisc:!MISC_ITEM_CAT[row.itemId]&&!player.miscDex[row.itemId]};
    });
    assert.equal(saved.owned,true);assert.equal(saved.used,0);assert.ok(saved.active);assert.equal(saved.signed,true);assert.equal(saved.valid,true);assert.deepEqual(saved.before,saved.after);assert.deepEqual(saved.before,saved.diskState);assert.equal(saved.stillOwned,true);assert.equal(saved.otherActorLocked,null);assert.equal(saved.otherActorOwned,saved.active);assert.equal(saved.forcedOverrides,null);assert.equal(saved.notInMisc,true);
    reports.push({case:'native card use, signed save/load, actor ownership and forced-form precedence',...saved});

    await fixture();
    const toggles=await page.evaluate(()=>{
      const A=AFK_CARD_ASCENSION;__fillDiamond();recomputeStats();
      const base={aspd:player.d.aspd,cast:player.d.castLock,str:player.d.str};
      const row=A.catalog.mythic[0];A.acquire(row.id);gainItem('scroll_poly',3,true,true);
      const use=()=>confirmPolySelect(player.inv.find(i=>i.id==='scroll_poly').uid,row.form.n);
      use();const wasActive=!!A.active(player);
      AFK_TOGGLES.set('card-ascension',false);
      const ownOff={poly:player.poly,active:A.active(player),aspd:player.d.aspd,cast:player.d.castLock,str:player.d.str};
      AFK_TOGGLES.set('card-ascension',true);use();AFK_TOGGLES.set('cardplus',false);
      const parentOff={poly:player.poly,active:A.active(player),aspd:player.d.aspd,cast:player.d.castLock,str:player.d.str};
      AFK_TOGGLES.set('cardplus',true);
      player.poly=JSON.parse(JSON.stringify(row.form));player.poly.cardNativeLevel=52;player.buffs.poly=1800;
      const forged={can:A.canUseForm(player.poly,player),active:A.active(player)};recomputeStats();forged.cleared=player.poly===null;
      const lower=POLY_TIERS.flatMap(t=>t.forms).find(f=>f.lv<70&&!CARD_MOB_INFO[f.n]);
      player.poly=JSON.parse(JSON.stringify(lower));player.buffs.poly=1800;
      const lowActive=A.active(player);
      return {base,wasActive,ownOff,parentOff,forged,lowActive,enabled:AFK_TOGGLES.enabled('card-ascension'),owned:A.owned(row.id,player)};
    });
    assert.equal(toggles.wasActive,true);assert.equal(toggles.enabled,true);assert.equal(toggles.owned,true);
    for(const off of [toggles.ownOff,toggles.parentOff]){assert.equal(off.poly,null);assert.equal(off.active,null);assert.equal(off.aspd,toggles.base.aspd);assert.equal(off.cast,toggles.base.cast);assert.equal(off.str,toggles.base.str);}
    assert.deepEqual(toggles.forged,{can:false,active:null,cleared:true});assert.equal(toggles.lowActive,null);
    reports.push({case:'both toggle escape paths and low-level metadata rejection',...toggles});

    await fixture();
    const empty=await page.evaluate(()=>{
      // Catalogue fixture: retain real monster forms only, with no diamonds.
      // Both the actual random-candidate function and useItem remain untouched.
      const saved=POLY_TIERS.map(t=>t.forms);
      try{
        POLY_TIERS.forEach(t=>t.forms=t.forms.filter(f=>CARD_MOB_INFO[f.n]));
        gainItem('scroll_poly',2,true,true);
        const pool=polyRandomCandidates().length,state=getPolyState();
        useItem(player.inv.find(i=>i.id==='scroll_poly').uid);
        return {pool,state,left:__cardCount('scroll_poly'),poly:player.poly};
      }finally{POLY_TIERS.forEach((t,i)=>t.forms=saved[i]);}
    });
    assert.equal(empty.pool,0);assert.equal(empty.state,null);assert.equal(empty.left,2);assert.equal(empty.poly,null);
    reports.push({case:'fully locked random pool does not crash or consume scroll',...empty});

    await fixture();
    const stale=await page.evaluate(()=>{
      const A=AFK_CARD_ASCENSION;__fillDiamond();gainItem(cardId(AFK_CARD_FORMS.monsterNames()[0],5),20,true,true);
      saveGame();
      const key='lineage_idle_save_'+currentSlot,payload=JSON.parse(_saveUnwrap(_lzGet(key)).payload);
      payload.p.enSeed='a-different-current-character';payload.p.name='Unrelated preserved character';
      _lzSet(key,_saveWrap(JSON.stringify(payload)));
      const stored=_lzGet(key),inv=JSON.stringify(player.inv),s=JSON.stringify(player.cardAscension);
      const nativeSave=saveGame(),action=A.synthesize('mythic');
      return {nativeSave,action,storedUnchanged:stored===_lzGet(key),invUnchanged:inv===JSON.stringify(player.inv),stateUnchanged:s===JSON.stringify(player.cardAscension)};
    });
    assert.equal(stale.nativeSave,false);assert.equal(stale.action.ok,false);assert.equal(stale.storedUnchanged,true);assert.equal(stale.invUnchanged,true);assert.equal(stale.stateUnchanged,true);
    reports.push({case:'native stale-role save rejection preserves other character and materials',...stale});

    const nativeUI=await page.evaluate(()=>{
      const root=document.createElement('div');root.id='card-asc-test-panel';document.body.appendChild(root);AFK_CARD_CODEX.openNpc(root);   /* 合成改由燃柳村至幻者負責 */
      openCardBook();
      return {tiers:root.querySelectorAll('[data-ascend-tier]').length,words:root.textContent,collection:!!document.getElementById('afk-card-ascension-open')};
    });
    assert.equal(nativeUI.tiers,3);assert.equal(nativeUI.collection,true);assert.match(nativeUI.words,/第 11 次必定成功/);assert.match(nativeUI.words,/尚未登錄鑽石卡/);
    reports.push({case:'native synthesis and card-book entry points',tiers:nativeUI.tiers,collection:nativeUI.collection});

    // Save a real card form, then disable its parent without rewriting that
    // character. A full page reload must reject the stale active metadata while
    // retaining permanent ownership and allowing the feature to be re-enabled.
    await fixture({lv:20});
    const reloadSlot=await page.evaluate(()=>{
      const A=AFK_CARD_ASCENSION,row=A.catalog.mythic[0];
      // A fresh same-mode collection fixture keeps the unregistered physical
      // card below useful for proving disabled use does not register/consume it.
      _lzSet(_dexKey(CARDDEX_KEY),JSON.stringify({_v:2}));
      gainItem(row.itemId,1,true,true);useItem(player.inv.find(it=>it.id===row.itemId).uid);
      gainItem('scroll_poly',4,true,true);
      const names=AFK_CARD_FORMS.monsterNames();acquireCard(names[0],5,5);acquireCard(names[1],4,4);
      const ids=[cardId(names[0],5),cardId(names[1],4),cardId(names[2],5),'afk_card_pick','doll_哈瑪',row.itemId,...Object.values(A.items)];
      gainItem(ids[2],3,true,true);gainItem('afk_card_pick',2,true,true);gainItem('doll_哈瑪',2,true,true);gainItem(row.itemId,2,true,true);
      Object.values(A.items).forEach((id,i)=>gainItem(id,i+1,true,true));
      const wh=loadWarehouse();ids.forEach((id,i)=>wh.items.push({id,uid:uid(),cnt:i+1,en:0,lock:i===0}));saveWarehouse(wh);
      const counts=items=>Object.fromEntries(ids.map(id=>[id,items.reduce((n,it)=>n+(it.id===id?(it.cnt==null?1:it.cnt):0),0)]));
      const held=counts(player.inv),stored=counts(loadWarehouse().items),dex=JSON.stringify(player.cardDex);
      const selected=confirmPolySelect(player.inv.find(it=>it.id==='scroll_poly').uid,row.form.n);
      const active=A.active(player)?.id;saveGame();
      AFK_TOGGLES.set('cardplus',false);
      const attemptIds=[ids[2],'afk_card_pick',row.itemId,...Object.values(A.items)];
      attemptIds.forEach(id=>useItem(player.inv.find(it=>it.id===id).uid));
      acquireCard(names[3],5,1);dollRerollT6();dollRerollT6All();
      const denied={held:counts(player.inv),dexUnchanged:dex===JSON.stringify(player.cardDex),pickOpen:!!document.getElementById('afk-cardpick'),advancedOpen:!!document.getElementById('afk-card-ascension-modal'),hamaCount:dollTierCount(6)};
      return {slot:currentSlot,selected,active,id:row.id,ids,names:names.slice(0,4),held,stored,denied};
    });
    assert.equal(reloadSlot.selected,true);assert.equal(reloadSlot.active,reloadSlot.id);
    assert.deepEqual(reloadSlot.denied.held,reloadSlot.held);assert.equal(reloadSlot.denied.dexUnchanged,true);assert.equal(reloadSlot.denied.pickOpen,false);assert.equal(reloadSlot.denied.advancedOpen,false);assert.equal(reloadSlot.denied.hamaCount,0);
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(()=>!!window.AFK_CARD_ASCENSION);
    const reloaded=await page.evaluate(({slot,id,ids,names})=>{
      window.__testTimers.forEach(clearInterval);state.running=false;state.ff=false;currentSlot=slot;
      const bootDefinitions=ids.every(id=>!!DB.items[id]);
      loadGame();window.__testTimers.forEach(clearInterval);state.running=false;state.ff=false;
      const counts=items=>Object.fromEntries(ids.map(id=>[id,items.reduce((n,it)=>n+(it.id===id?(it.cnt==null?1:it.cnt):0),0)]));
      const A=AFK_CARD_ASCENSION,row=A.catalog.mythic.find(r=>r.id===id),off={enabled:AFK_TOGGLES.enabled('card-ascension'),poly:player.poly,active:A.active(player),owned:A.owned(id,player),level:player.lv,held:counts(player.inv),stored:counts(loadWarehouse().items),tierCount:CARD_TIERS.length,bootDefinitions,diamondScore:player.cardDex[names[0]],platinumScore:player.cardDex[names[1]]};
      const score=JSON.stringify(player.cardDex);
      [ids[2],'afk_card_pick',row.itemId,...Object.values(A.items)].forEach(id=>useItem(player.inv.find(it=>it.id===id).uid));
      acquireCard(names[3],5,1);dollRerollT6();dollRerollT6All();
      off.afterUse=counts(player.inv);off.dexUnchanged=score===JSON.stringify(player.cardDex);
      AFK_TOGGLES.set('cardplus',true);
      // A page initially loaded with the parent disabled must have the same
      // one-time wrappers and definitions after enabling; the real card is used.
      useItem(player.inv.find(it=>it.id===ids[2]).uid);
      const resumed={held:counts(player.inv),score:player.cardDex[names[2]],tierCount:CARD_TIERS.length,regionVals:CARD_REGIONS.every(r=>r.vals.length===5)};
      const selected=confirmPolySelect(player.inv.find(it=>it.id==='scroll_poly').uid,row.form.n);
      const returned=A.active(player)?.id;
      const nm=names[0];
      confirmPolySelect(player.inv.find(it=>it.id==='scroll_poly').uid,nm);
      const diamond={poly:player.poly.n,cast:player.d.castLock};
      const ally=JSON.parse(JSON.stringify(player));ally.allies=[];ally.curHp=ally.hp;ally._mercPolyAuto=true;player.allies=[ally];
      AFK_TOGGLES.set('card-ascension',false);
      const cleared={playerPoly:player.poly,allyPoly:ally.poly,playerCast:player.d.castLock,allyCast:ally.d.castLock};
      AFK_TOGGLES.set('card-ascension',true);
      return {off,resumed,selected,returned,diamond,cleared,reEnabled:AFK_TOGGLES.enabled('card-ascension')};
    },reloadSlot);
    assert.equal(reloaded.off.enabled,false);assert.equal(reloaded.off.poly,null);assert.equal(reloaded.off.active,null);assert.equal(reloaded.off.owned,true);assert.equal(reloaded.off.level,20);
    assert.equal(reloaded.off.bootDefinitions,true);assert.equal(reloaded.off.tierCount,5);assert.equal(reloaded.off.diamondScore,10000);assert.equal(reloaded.off.platinumScore,1000);
    assert.deepEqual(reloaded.off.held,reloadSlot.held);assert.deepEqual(reloaded.off.afterUse,reloadSlot.held);assert.deepEqual(reloaded.off.stored,reloadSlot.stored);assert.equal(reloaded.off.dexUnchanged,true);
    assert.deepEqual(reloaded.resumed.held,{...reloadSlot.held,[reloadSlot.ids[2]]:reloadSlot.held[reloadSlot.ids[2]]-1});assert.equal(reloaded.resumed.score,10000);assert.equal(reloaded.resumed.tierCount,5);assert.equal(reloaded.resumed.regionVals,true);
    assert.equal(reloaded.selected,true);assert.equal(reloaded.returned,reloadSlot.id);assert.equal(reloaded.diamond.cast,0);
    assert.equal(reloaded.cleared.playerPoly,null);assert.equal(reloaded.cleared.allyPoly,null);assert.ok(reloaded.cleared.playerCast>0);assert.ok(reloaded.cleared.allyCast>0);assert.equal(reloaded.reEnabled,true);
    reports.push({case:'full page reload with parent off, lower-level owner access, and player/mercenary diamond-speed reset',...reloaded});
    reports.push({case:'platinum/diamond, choice, Hama and advanced inventories/warehouse survive disabled reload; native actions preserve stock while off',before:reloadSlot.held,warehouse:reloadSlot.stored,denied:reloadSlot.denied,off:reloaded.off,resumed:reloaded.resumed});
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:reports.length,pageErrors:errors,cases:reports},null,2));
  } finally { await close(); }
} finally { await browser.close(); }
