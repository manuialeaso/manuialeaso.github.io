import assert from 'node:assert/strict';
import fs from 'node:fs';
import {testBrowser,createProfile} from './relic-test-browser.mjs';

const browser=await testBrowser();
try{
  const {page,errors,close}=await browser.page();
  try{
    page.on('console',m=>{if(m.text().startsWith('[card-combat]'))console.log(m.text());});
    await page.evaluate(code=>window.__cardProfile=eval('('+code+')'),createProfile.toString());
    const report=await page.evaluate(()=>{
      const C=AFK_CARD_COMBAT,A=AFK_CARD_ASCENSION,F=AFK_CARD_FORMS,R=AFK_RELIC_RUNTIME,out=[];
      let serial=0,clock=10000;
      function check(ok,msg){if(!ok)throw Error(msg);}
      function equal(got,want,msg){if(got!==want)throw Error(msg+': got '+got+', expected '+want);}
      function near(got,want,msg){if(Math.abs(got-want)>1e-7)throw Error(msg+': got '+got+', expected '+want);}
      function done(name,detail){out.push({name,...detail});console.log('[card-combat] '+name);}
      function fresh(cls='knight'){
        petRoster().splice(0);__cardProfile({cls,lv:100,seed:77});clock+=1000;state.ticks=clock;state.running=true;
        player.mastery=null;player.skills=[];Math.random=()=>.5;player.hp=player.mhp;player.mp=player.mmp;return player;
      }
      function mob(){const m={...DB.mobs.wolf,n:'卡片原生結算測試',uid:'card-'+(++serial),lv:1,hp:1e8,curHp:1e8,st:newMobStatus(),ac:0,mr:0,dr:0,e:'none',dmg:[1,1],db:0,exp:0,noGold:true,drop:[]};mapState.mobs=[m,null,null,null,null];mapState.targetIdx=0;return m;}
      function card(tier,actor=player,index=0){const row=A.catalog[tier][index];check(row,'missing '+tier+' card');actor.cardAscension={v:1,owned:{[row.id]:true},unlocked:{[tier]:true},failures:{},attempts:{}};actor.poly=JSON.parse(JSON.stringify(row.form));actor.buffs.poly=10000;if(actor===player)recomputeStats();else _allyLevelRecompute(actor);return row;}
      function deal(m,amount=100,options={}){return R.api.damage(m,amount,{actor:player,type:'true',reflect:false,...options});}
      function loss(m,fn){const before=m.curHp;Math.random=()=>.5;fn();return before-m.curHp;}
      for(const [tier,mult,stat,resist,crit,cdmg] of [['mythic',5,20,100,0,0],['celestial',10,30,150,10,0],['spacetime',15,50,200,15,50]]){
        fresh();const initial={...player.d,hp:player.mhp,mp:player.mmp};card(tier);
        for(const key of ['str','dex','con','int','wis','cha'])equal(player.d[key],Math.min(100,initial[key]+stat),tier+' native '+key);
        check(player.mhp>initial.hp,tier+' CON increases native maximum HP');check(player.mmp>initial.mp,tier+' WIS increases native maximum MP');
        const late={};C.lateStats(player,late);for(const key of ['resFire','resWater','resWind','resEarth','resNone'])equal(late[key],resist,tier+' '+key);
        for(const key of ['meleeCrit','rangedCrit','magicCrit'])equal(late[key],crit,tier+' '+key);for(const key of ['meleeCritDmg','rangedCritDmg','magicCritDmg'])equal(late[key],cdmg,tier+' '+key);
        const m=mob();equal(deal(m),100*mult,tier+' native generated true first damage');equal(deal(m),100,tier+' later true damage');done(tier+' early attributes, derived HP/MP, resistances and first damage',{hp:player.mhp,mp:player.mmp});
      }
      for(const rebirth of [0,1]){
        const key=AFK_RELIC_DEFENSE.byId[137].key,gloves=__afkRelicPlus.makeId(key,10,null,null);__afkRelicPlus.ensure(gloves);
        __cardProfile({cls:'knight',lv:rebirth?150:100,rebirth,eq:{wpn:'wpn_9',gloves}});state.ticks=clock+=1000;state.running=true;const before={panel:player.d.str,raw:player.d._raw.str,hp:player.mhp,mp:player.mmp};
        card('spacetime');const after={panel:player.d.str,raw:player.d._raw.str,hp:player.mhp,mp:player.mmp};equal(after.raw-before.raw,50,'full card source is captured before common cap');equal(after.panel,Math.min(rebirth?200:100,before.raw+50),'existing total stat cap is preserved');check(after.panel-before.panel<50,'high-stat fixture actually crosses existing cap');
        done((rebirth?'reborn 200':'ordinary 100')+' total attribute cap preserves source and effective values',{before,after,sourceBonus:50,effectivePanelBonus:after.panel-before.panel});
      }
      {
        fresh();const m=mob();deal(m,1);card('mythic');equal(deal(m),100,'untransformed damage spends first hit');card('celestial');equal(deal(m),100,'form switching cannot renew first hit');
        const n=mob();const row=card('mythic');delete player.cardAscension.owned[row.id];check(!A.active(player)&&!C.active(player),'unowned metadata cannot grant effects');equal(deal(n),100,'unowned form has no multiplier');
        card('mythic');player.buffs.poly=0;check(!C.active(player),'expired form has no effects');player.buffs.poly=100;player._setPoly={n:'裝備變身'};check(!C.active(player),'set transformation overrides card');
        const ordinary=F.monsterForm(F.monsterNames()[0]);player.poly=ordinary;player._setPoly=null;player.cardDex={[ordinary.cardMonster]:10000};check(!C.active(player),'ordinary diamond does not become mythic');done('ownership, expiry, set override, ordinary diamond and persistent first-hit ledger');
      }
      {
        fresh();card('mythic');
        function equip(id){gainItem(id,1,true,true);const it=player.inv.find(x=>x.id===id);check(it,'native acquired '+id);it.uid='card-equip-'+(++serial);equipItem(it);check(Object.values(player.eq).some(x=>x&&x.id===id),'native equipped '+id);}
        for(const id of ['hlm_dk','amr_dk','glv_dk'])equip(id);
        const before={con:player.d._raw.con,hp:player.mhp,mp:player.mmp};check(C.active(player),'three pieces do not force a form');
        equip('bot_dk');const forced={con:player.d._raw.con,hp:player.mhp,mp:player.mmp};check(player._setPoly&&!C.active(player),'four-piece native set replaces card');equal(forced.con,before.con-20,'equip removes card CON before HP calculation');check(forced.hp<before.hp,'same equipment recalculation removes card-derived HP');
        unequipItem('boots');check(!player._setPoly&&C.active(player),'native unequip restores timed card');equal(player.d._raw.con,before.con,'unequip restores card CON in same recalculation');equal(player.mhp,before.hp,'unequip immediately restores card-derived HP');equal(player.mmp,before.mp,'unequip immediately restores card-derived MP');
        equip('relic_flame_dk_sword');check(player._setPoly&&!C.active(player),'native forced weapon form overrides card');equal(player.d._raw.con,before.con-20,'forced weapon removes early card CON');unequipItem('wpn');check(C.active(player),'removing forced weapon restores card');equal(player.d._raw.con,before.con,'removing forced weapon restores early attributes');
        const emperor=__afkRelicPlus.makeId('wpn_uncursed_emperor_blade',5,null,null);__afkRelicPlus.ensure(emperor);equip(emperor);check(player._setPoly&&!C.active(player),'reinforced emperor preserves its base forced Dantes form');equal(player.d._raw.con,before.con-20,'reinforced emperor suppresses card before HP computation');unequipItem('wpn');check(C.active(player),'removing reinforced emperor restores card');equal(player.d._raw.con,before.con,'reinforced emperor removal restores early attributes');
        done('native set and weapon equip/unequip immediately remove and restore card-derived stats',{before,forced});
      }
      {
        fresh();card('spacetime');const a=mob(),b={...a,uid:'card-cd-b',st:newMobStatus()},c={...a,uid:'card-cd-c',st:newMobStatus()};mapState.mobs=[a,b,c];
        equal(deal(a),1500,'spacetime initial first hit');state.ticks+=1;equal(deal(b),100,'second enemy first hit during cooldown');check(C.firstState(player,b).seen,'cooldown enemy is marked seen');state.ticks+=300;equal(deal(b),100,'missed cooldown opportunity is not deferred');equal(deal(c),1500,'fresh enemy after cooldown');equal(deal(c),100,'same enemy never repeats');done('spacetime 30-second owner cooldown and spent enemy opportunity');
      }
      for(const tier of ['mythic','spacetime']){
        // Exercise real native spawn, the dragon's ten-second lock, its pulse
        // transition, and doMobTransform. Advance only this timer to keep the
        // identity regression independent of the separate combat stress suite.
        fresh();card(tier);state.antharas=4;state._afkDragon=null;mapState.current='antharas_lair';mapState.mobs=[null,null,null,null,null];mapState.targetIdx=1;state.ticks=clock+1;
        let rng=177;Math.random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296;};
        spawnMob(1);let current=mapState.mobs[1];check(current&&current._afkDragonStage===1,'native dragon first phase exists');
        check(!C.firstState(player,current).seen,'fresh native dragon has a new opportunity');
        const first=deal(current),deadline=C.firstState(player,current).nextAt,phases=[{stage:current._afkDragonStage,damage:first}];
        equal(first,100*C.rules[tier].mult,tier+' first dragon phase multiplier');
        for(let n=2;n<=7;n++){
          const previous=current;doMobTransform(1);
          equal(mapState.mobs[1],previous,'native dragon lock defers object replacement');check(previous._afkLockUntil>state.ticks,'native ten-second lock exists');
          state.ticks+=100;__afkCorrupt.pulse();current=mapState.mobs[1];
          check(current!==previous,'native phase replaces the object');equal(current._afkDragonStage,n,'native next dragon stage');
          check(C.firstState(player,current).seen,'new phase inherits consumed first-hit identity');equal(C.firstState(player,current).nextAt,deadline,'phase transition does not change owner cooldown');
          const amount=deal(current);equal(amount,100,tier+' later dragon phase remains ordinary after cooldown');phases.push({stage:n,damage:amount});
        }
        // Clearing this encounter fixture lets the ordinary native spawn path
        // create an unrelated dragon, just as a new instance would.
        const last=current;mapState.mobs=[null,null,null,null,null];spawnMob(1);const respawn=mapState.mobs[1];
        check(respawn!==last,'new native spawn is a distinct enemy');check(!C.firstState(player,respawn).seen,'new native spawn does not inherit the defeated chain');
        const respawnDamage=deal(respawn);equal(respawnDamage,100*C.rules[tier].mult,tier+' new encounter gets its own first hit');
        let duringCooldown=null;
        if(tier==='spacetime'){
          const nextAt=C.firstState(player,respawn).nextAt;mapState.mobs=[null,null,null,null,null];spawnMob(1);const waiting=mapState.mobs[1];
          check(!C.firstState(player,waiting).seen,'another newly spawned enemy starts unseen');duringCooldown=deal(waiting);equal(duringCooldown,100,'owner cooldown survives unrelated native respawn');
          check(C.firstState(player,waiting).seen,'cooldown-blocked first hit is consumed');equal(C.firstState(player,waiting).nextAt,nextAt,'blocked first hit does not extend cooldown');
          doMobTransform(1);state.ticks+=100;__afkCorrupt.pulse();const changed=mapState.mobs[1];check(changed!==waiting&&C.firstState(player,changed).seen,'cooldown-spent identity also crosses native transformation');
          state.ticks=nextAt;equal(deal(changed),100,'transformed enemy cannot defer its spent first hit until cooldown expires');
        }
        state.antharas=0;state._afkDragon=null;mapState.current='training';
        done(tier+' native seven-phase dragon shares one first hit; unrelated spawns retain independent eligibility',{phases,respawnDamage,duringCooldown});
      }
      {
        fresh();card('mythic');const m=mob();equal(deal(m,0),0,'zero damage');check(!C.firstState(player,m).seen,'zero does not spend');
        equal(deal(m,100,{origin:'reflection',reflection:true}),100,'reflection is excluded');check(!C.firstState(player,m).seen,'reflection does not spend');
        equal(deal(m,100,{origin:'redirect',redirected:true}),100,'redirected damage is excluded');check(!C.firstState(player,m).seen,'redirect does not spend');
        equal(deal(m),500,'later ordinary damage remains first');done('zero, reflection and transferred damage do not consume the first hit');
      }
      for(const tier of ['mythic','celestial','spacetime']){
        fresh();card(tier);const m=mob(),first=loss(m,()=>playerAttack()),next=loss(m,()=>playerAttack());check(next>0,'native ordinary attack hits');equal(first,next*C.rules[tier].mult,tier+' native ordinary attack multiplier');done(tier+' native ordinary attack applies its multiplier once',{first,next});
      }
      {
        fresh();card('mythic');const m=mob();m._reflectWall={kind:'phys',block:true,until:state.ticks+100};equal(loss(m,()=>playerAttack()),0,'terror visage actually refunds primary damage');check(!C.firstState(player,m).seen,'immune attack does not spend first damage');delete m._reflectWall;
        const first=loss(m,()=>playerAttack()),next=loss(m,()=>playerAttack());equal(first,next*5,'first successful attack after immunity');done('native terror immunity refunds damage without consuming the first hit');
      }
      {
        fresh();card('mythic');const m=mob();m._reflectWall={kind:'phys',block:true,until:state.ticks+100};
        const first=loss(m,()=>procIai(m)),next=loss(m,()=>procIai(m));check(next>0,'legacy pursuit actually deals damage through its original non-refund path');equal(first,next*5,'effective legacy pursuit consumes and multiplies its actual first damage');check(C.firstState(player,m).seen,'positive pursuit damage spends first despite unrelated immunity wall');
        const holy=mob();holy._dsHolyUntil=state.ticks+100;equal(loss(holy,()=>playerAttack()),0,'native holy wall refunds direct attack');check(!C.firstState(player,holy).seen,'actual holy immunity does not spend first');
        equal(deal(holy),500,'native unreflected true damage keeps its existing non-refund behavior');check(C.firstState(player,holy).seen,'actual positive true settlement spends first');
        done('first-hit eligibility follows actual native immunity and pursuit settlement paths',{first,next});
      }
      {
        fresh('mage');card('celestial');const m=mob();const first=loss(m,()=>procFreeMagicSkill(m,'sk_lightarrow',0,true,null)),next=loss(m,()=>procFreeMagicSkill(m,'sk_lightarrow',0,true,null));check(next>0,'free light arrow does real damage');equal(first,next*10,'native free magic first hit');done('native triggered spell applies first-hit multiplier once',{first,next});
      }
      {
        fresh('mage');card('mythic');player.skills.push('sk_fireball');const m=mob();player.cds.atkSk=0;
        const first=loss(m,()=>check(castSkill('sk_fireball'),'native paid cast succeeds'));player.cds.atkSk=0;const next=loss(m,()=>check(castSkill('sk_fireball'),'second paid cast succeeds'));equal(first,next*5,'native paid magic first damage');done('native paid spell includes card damage in its actual settlement',{first,next});
      }
      for(const weapon of ['wpn_priest_wand','relic_frostdeath_breath']){
        fresh('mage');player.eq.wpn={id:weapon,en:0,uid:'burst-test'};card('mythic');player.skills.push('sk_lightarrow');const a=mob(),b={...a,uid:'card-burst-'+serial,st:newMobStatus()};mapState.mobs=[a,b];const hits=[],native=C.damage;
        C.damage=function(actor,target,amount,opt){const value=native.apply(this,arguments);if(actor===player)hits.push({target:target.uid,base:amount,settled:value,inherited:!!opt?.inherited});return value;};
        try{check(castSkill('sk_lightarrow'),'native single-target spell succeeds');}finally{C.damage=native;}
        const primary=hits.find(x=>x.target===a.uid);check(primary&&primary.settled===primary.base*5,'primary spell is boosted');const secondary=hits.filter(x=>x.target===b.uid);check(secondary.length>0,'native magic burst hits previously untouched secondary enemy');check(secondary.every(x=>x.settled===x.base),'snapshot-derived magic burst never multiplies a second time');check(C.firstState(player,b).seen,'derived first damage spends secondary enemy opportunity');done(weapon+' native magic burst inherits first-hit damage exactly once',{hits});
      }
      for(const scenario of [
        {name:'runtime piercing',weapon:'wpn_12',relics:true,block:false},
        {name:'native piercing after immune primary',weapon:'wpn_12',relics:false,block:true},
        {name:'native independent sub-multiplier piercing',weapon:'relic_elmo_spear',relics:false,block:false}
      ]){
        fresh();player.eq.wpn={id:scenario.weapon,en:0,uid:'card-pierce'};player.mastery='k_pierce';card('mythic');
        const a=mob(),b={...a,uid:'card-pierce-b',st:newMobStatus()},c={...a,uid:'card-pierce-c',st:newMobStatus()};mapState.mobs=[a,b,c];if(scenario.block)a._reflectWall={kind:'phys',block:true,until:state.ticks+100};
        const hits=[],native=C.damage,toggle=AFK_TOGGLES.enabled;
        C.damage=function(actor,target,amount,opt){const value=native.apply(this,arguments);if(actor===player)hits.push({target:target.uid,base:amount,settled:value,inherited:!!opt?.inherited});return value;};
        if(!scenario.relics)AFK_TOGGLES.enabled=function(id){return id==='relicfx'?false:toggle.apply(this,arguments);};
        try{playerAttack();}finally{C.damage=native;AFK_TOGGLES.enabled=toggle;}
        const secondary=hits.filter(x=>x.target!==a.uid);equal(secondary.length,2,'piercing reaches both mastery targets');secondary.forEach(x=>equal(x.settled,x.base*5,'secondary first damage is multiplied once'));equal(secondary[0].base,secondary[1].base,'piercing never compounds its shared base across targets');
        if(scenario.block){equal(a.curHp,a.hp,'primary immunity is preserved');check(!C.firstState(player,a).seen,'blocked primary remains eligible');}
        done(scenario.name+' does not compound first-hit multipliers',{hits});
      }
      {
        fresh('mage');card('mythic');const a=mob(),b={...a,uid:'card-aoe-b',st:newMobStatus()},c={...a,uid:'card-aoe-c',st:newMobStatus()};mapState.mobs=[a,b,c];const first=[a.curHp,b.curHp,c.curHp];procFreeMagicSkill(a,'sk_tornado',0,false,null);const one=[a,b,c].map((m,i)=>first[i]-m.curHp),second=[a.curHp,b.curHp,c.curHp];procFreeMagicSkill(a,'sk_tornado',0,false,null);const two=[a,b,c].map((m,i)=>second[i]-m.curHp);
        one.forEach((n,i)=>{check(two[i]>0,'AOE reaches target '+i);equal(n,two[i]*5,'independent AOE first hit '+i);});done('native AOE uses independent enemy opportunities without compounding shared base damage',{first:one,next:two});
      }
      {
        fresh('elf');player.eq.wpn={id:'wpn_3',uid:'card-bow',en:0};player.eq.arrow={id:'wpn_5',uid:'card-arrow',cnt:100,en:0};card('mythic');const m=mob(),hits=[],native=C.damage;
        C.damage=function(actor,target,amount,opt){const value=native.apply(this,arguments);if(actor===player&&target===m)hits.push({base:amount,settled:value,kind:opt?.kind});return value;};try{playerAttack();}finally{C.damage=native;}
        check(hits.length>0,'native bow hits');equal(hits[0].kind,'ranged','first native hit is ranged');equal(hits[0].settled,hits[0].base*5,'ranged first multiplier');check(hits.slice(1).every(x=>x.base===x.settled),'rapidfire does not consume the first hit again');done('native ranged attacks and their rapidfire chain share one first opportunity',{hits});
      }
      {
        fresh();card('mythic');const m=mob();m.hp=m.curHp=10000;m.st.poison=100;m.st.poisonDmg=30;m.st.poisonTick=10;m.st.poisonSrc='player';state.ticks=clock+10;
        const n=loss(m,()=>processMobStatusTick(m,0));equal(n,100,'poison first damage still respects one-percent budget');check(C.firstState(player,m).seen,'positive capped poison spends first');state.ticks+=10;equal(loss(m,()=>processMobStatusTick(m,0)),30,'later poison is ordinary');
        const k=mob();k.hp=k.curHp=10000;R.api.dot(k,'poison',{owner:player,source:'native-card-test',damage:30,duration:10,ascended:true});state.ticks+=10;equal(loss(k,()=>R.tick()),150,'ascended-source poison remains exempt from budget and multiplies once');done('native poison and ascended relic DOT share owner ledger and preserve their own cap rules');
      }
      {
        fresh();card('mythic');const m=mob(),pet={uid:'card-pet',form:'狼',lv:30,exp:0,mhp:100,mmp:20,hp:100,mp:20,outOwner:_petCurrentOwnerKey(),eq:{},_statuses:{}};petRoster().push(pet);
        const d=petDerive(pet),first=loss(m,()=>petAttackOnce(pet,d,m)),next=loss(m,()=>petAttackOnce(pet,d,m));check(next>0,'native pet attacks');equal(first,next*5,'pet first hit shares owner multiplier');equal(deal(m),100,'owner does not receive another first after pet');done('native pet damage shares the owner first-hit ledger',{first,next});
      }
      {
        fresh('mage');card('mythic');const m=mob(),form=SUMMON_TIERS[0].mobs[0],summon={form:form.n,n:form.n,lv:form.lv||1,skId:'sk_summon',hp:100,mhp:100},d=_sumDerive({form:form.n,n:form.n},player);
        const first=loss(m,()=>summonV2AttackOnce(summon,d,m,player)),next=loss(m,()=>summonV2AttackOnce(summon,d,m,player));check(next>0,'native summon attacks');equal(first,next*5,'summon first hit shares owner');equal(deal(m),100,'owner first already spent by summon');done('native summon damage shares the owner first-hit ledger',{first,next});
      }
      {
        fresh();card('mythic');const ally=JSON.parse(JSON.stringify(player));ally._allyName='卡片傭兵';ally._slot='2';ally.curHp=ally.mhp;ally.allies=[];player.allies=[ally];_allyLevelRecompute(ally);
        const m=mob();equal(deal(m),500,'leader has first hit');const first=loss(m,()=>allyAttackOnce(ally)),next=loss(m,()=>allyAttackOnce(ally));check(next>0,'ally attacks');equal(first,next*5,'ally independently receives first hit');done('native ally has an independent first-hit ledger',{first,next});
      }
      {
        fresh();const noCast=F.monsterNames().find(n=>F.monsterForm(n)?.cast===0);check(noCast,'native zero-cast monster exists');player.cardDex={[noCast]:10000};player.poly=F.monsterForm(noCast);player.buffs.poly=100;recomputeStats();equal(player.d.castLock,0,'monster cast stays zero in stats');equal(castIntervalTicks(player,false),1,'zero-cast monster schedules one native tick');player.poly=null;player.buffs.poly=0;player.d.castLock=0;equal(castIntervalTicks(player,false),12,'ordinary zero fallback retains original 12 ticks');done('ordinary diamond zero-cast forms use the native minimum tick',{monster:noCast});
      }
      {
        fresh();card('spacetime');const m=mob();mapState.current='antharas_lair';state.antharas=4;state.ticks=clock+10;const before=m.curHp;C.tick();equal(before-m.curHp,7500,'aura first tick uses multiplier');C.tick();equal(before-m.curHp,7500,'same game tick does not repeat aura');state.ticks+=10;equal(loss(m,()=>C.tick()),500,'next second is 500');
        const k=mob();state.ticks+=10;equal(loss(k,()=>C.tick()),500,'new enemy inside owner cooldown gets ordinary 500');state.ticks+=300;equal(loss(k,()=>C.tick()),500,'same aura enemy cannot defer its first opportunity');done('spacetime dungeon aura: 7500 first, then 500 per second, no duplicate tick');
      }
      {
        fresh();card('spacetime');const names=[];for(const key of ['antharas_lair','cr_fafurion_lair','cr_valakas_lair','cr_lindvior_lair']){mapState.current=key;check(C.inDungeon(),key+' is a dungeon');names.push(key);}
        for(const key of ['training','pride_f100','dom_tower_10','town_giran']){mapState.current=key;check(!C.inDungeon(),key+' is not a dungeon without a climb run');}
        mapState.current='training';const m=mob();state.ticks=clock+10;equal(loss(m,()=>C.tick()),0,'ordinary map receives no card aura');done('all four dragon lairs classified as dungeons; ordinary hunting and tower layers excluded',{maps:names});
      }
      {
        fresh();card('mythic');const m=mob();const toggle=AFK_TOGGLES.enabled;AFK_TOGGLES.enabled=function(id){return id==='relicfx'?false:toggle.apply(this,arguments);};
        try{const first=loss(m,()=>playerAttack()),next=loss(m,()=>playerAttack());equal(first,next*5,'card first works with relic runtime disabled');}finally{AFK_TOGGLES.enabled=toggle;}
        done('card bonuses are independent of relic equipment and relic toggle');
      }
      const dungeonKeys=[...new Set([...Object.keys(KING_ROOMS),...PURE_BOSS_MAPS,...Object.keys(ANTHARAS_AREA_BOSS)])];
      state.running=false;return{results:out,dungeons:dungeonKeys.map(id=>({id,name:typeof ANTHARAS_AREA_NAMES!=='undefined'&&ANTHARAS_AREA_NAMES[id]||typeof _CARD_MAP_NAMES!=='undefined'&&_CARD_MAP_NAMES[id]||id})),catalog:Object.fromEntries(Object.entries(A.catalog).map(([k,v])=>[k,v.length]))};
    });
    assert.deepEqual(errors,[]);fs.mkdirSync('.scratch',{recursive:true});fs.writeFileSync('.scratch/card-combat-native-results.json',JSON.stringify(report,null,2)+'\n');console.log('Card combat native tests passed: '+report.results.length+'.');
  }finally{await close();}
}finally{await browser.close();}
