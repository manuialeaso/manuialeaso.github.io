/** Twelve native dragon-window tests. No reflected status, hit value, damage,
 * HP, shield or invulnerability is inserted. Only the player's ordinary attack
 * schedule/offensive auto-cast is held while the native dragon opens its wall. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {testBrowser,createProfile} from './relic-test-browser.mjs';

const output='.scratch/card-reflection-results.json',quick=process.argv.includes('--quick');
const scenarios=['mythic','celestial','spacetime'].flatMap(tier=>[
  ['antharas_lair','phys'],['cr_fafurion_lair','magic'],['cr_valakas_lair','phys'],['cr_lindvior_lair','magic']
].map(([map,kind])=>({tier,map,kind,cls:kind==='phys'?'knight':'mage',seed:20261022})));
const report={createdAt:new Date().toISOString(),methodology:'Native legal Lv150 reborn profiles, approved final-tier non-GM defensive equipment, actual game tick and natural dragon reflection. Ordinary attacks and offensive auto-cast are paused until a matching native window. During that window the native equipment and transformation-scroll paths prepare the selected card, then one real ordinary attack/paid tornado is attempted. Existing HP is never replenished, damage is never suppressed, and no wall/shield/immune effect is inserted. Aura remains active after transformation; first-hit opportunities remain permanent.',results:[]};
const browser=await testBrowser();
try{
  for(const cfg of quick?scenarios.slice(0,2):scenarios){
    const {page,errors,close}=await browser.page();
    try{
      await page.evaluate(code=>window.__cardPressureProfile=eval('('+code+')'),createProfile.toString());
      const result=await page.evaluate(cfg=>{
        const C=AFK_CARD_COMBAT,A=AFK_CARD_ASCENSION,R=AFK_RELIC_RUNTIME,events=[],firstHits=[],windows=[];
        function ensure(ok,message){if(!ok)throw Error(message);}
        function id(n,asc=5){const key=R.byId[n].key,d=DB.items[key],id=__afkRelicPlus.makeId(key,d.type==='acc'?10:15,null,asc);__afkRelicPlus.ensure(id);return id;}
        // These pieces have no autonomous damage. The no-weapon waiting period
        // also avoids native sword/katana retaliation spending the first hit.
        const equipment={tshirt:134,cloak:151,armor:157,gloves:135,helm:219,boots:205,shin:190,shield:178,ring1:227,ring2:229,ear1:233,belt:240,amulet:247};
        const eq=Object.fromEntries(Object.entries(equipment).map(([k,n])=>[k,id(n)]));
        __cardPressureProfile({cls:cfg.cls,lv:150,rebirth:1,eq,seed:cfg.seed});currentSlot='1';player.name='Card pressure '+cfg.tier;player.enSeed='card-pressure-'+cfg.seed;player.mastery=cfg.cls==='mage'?'m_resonance':'k_counter';player.masteryQuest='done';
        player.skills=Object.keys(DB.skills).filter(k=>{const n=skillReqLv(DB.skills[k],k);return Number.isFinite(n)&&n<=player.lv;});
        player.config={selAtkSkill:'',selHealSkill:cfg.cls==='mage'?'sk_full_heal':'sk_heal1',setHpPot:75,setMpHeal:70,setMpAtk:0};player.gold=1000000;player.pvpOn=false;player.autoSellOn=false;
        gainItem('potion_ult',100,true,true);gainItem('scroll_poly',1,true,true);renderSkillSelects();
        const set=(key,value)=>{const e=document.getElementById(key);if(!e)throw Error('missing '+key);if(typeof value==='boolean')e.checked=value;else e.value=String(value);};
        set('set-pot','potion_ult');set('set-hp-pot',75);set('set-auto-buy-pot',true);set('set-mp-heal',70);set('set-mp-atk',0);set('sel-atk-skill','');set('sel-heal-skill',player.config.selHealSkill);set('sel-convert-skill','');
        for(const key of ['set-haste','set-brave','set-blue'])set(key,true);for(const key of ['set-poly','set-magicbarrier','set-teleport'])set(key,false);
        document.querySelectorAll('[id^="auto-sk-"]').forEach(e=>e.checked=false);
        const row=A.catalog[cfg.tier].find(x=>cfg.kind==='magic'?/真夏納/.test(x.prototype):/烈焰死亡騎士/.test(x.prototype))||A.catalog[cfg.tier][0];
        player.cardAscension={v:1,owned:{[row.id]:true},unlocked:{[cfg.tier]:true},failures:{},attempts:{}};
        recomputeStats();player.hp=player.mhp;player.mp=player.mmp;const initial={hp:player.mhp,mp:player.mmp,stats:JSON.parse(JSON.stringify(player.d)),equipment:Object.fromEntries(Object.entries(player.eq).filter(([,e])=>e).map(([k,e])=>[k,{id:e.id,name:DB.items[e.id].n}]))};
        let observedHp=player.hp,lowestHp=player.hp;
        Object.defineProperty(player,'hp',{configurable:true,enumerable:true,get(){return observedHp;},set(value){observedHp=value;if(Number.isFinite(value))lowestHp=Math.min(lowestHp,Math.max(0,value));}});
        R.observe((type,c)=>{if(type==='hurt')events.push({tick:state.ticks,type,origin:c.origin,kind:c.kind,incoming:c.snapshot,afterDefense:c.damage,actual:c.actualDamage,hpBefore:c.hpBefore,enemy:c.attacker&&c.attacker.n});});
        const nativeDamage=C.damage;C.damage=function(actor,target,amount,opt){const first=!C.firstState(actor,target).seen,hpBefore=target.curHp,value=nativeDamage.apply(this,arguments);if(actor===player&&first&&amount>0)firstHits.push({tick:state.ticks,target:target.n,uid:target.uid,kind:opt&&opt.kind,origin:opt&&opt.origin,base:amount,settled:value,hpBefore,multiplier:value/amount,tier:C.active(actor)?.tier||null,reflected:!!target._reflectWall,wall:target._reflectWall&&target._reflectWall.kind});return value;};
        state.antharas=4;state._afkDragon=(cfg.map.match(/^cr_(\w+)_lair$/)||[])[1]||null;enterOblivionMap(cfg.map);spawnMob(1);mapState.targetIdx=1;
        const boss=mapState.mobs[1];ensure(boss&&boss._afkDragonStage===1,'native dragon phase one');R.invalidate();R.dispatch('battleStart',{actor:player,main:false});
        let seed=cfg.seed>>>0;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};state.ff=true;state.running=true;
        let minHp=player.hp,openedAt=null,prepared=null,attempts=0,windowObject=null;
        while(state.ticks<400&&!player.dead){
          state.pDmgTick=-1000000;state.pOffDmgTick=-1000000;tick();minHp=Math.min(minHp,player.hp);
          const m=mapState.mobs.find(m=>m&&m._afkDragonStage&&m.curHp>0&&!m._dead),wall=m&&m._reflectWall;
          if(wall&&wall!==windowObject){windowObject=wall;windows.push({tick:state.ticks,kind:wall.kind,until:wall.until,boss:m.n});}
          if(wall&&wall.until>state.ticks&&wall.kind===cfg.kind){openedAt=state.ticks;ensure(!C.firstState(player,m).seen,'waiting equipment spent first damage before wall');
            const before=player.hp,weapon=id(cfg.kind==='phys'?100:129);if(DB.items[weapon].w2h)unequipItem('shield');gainItem(weapon,1,true,true);const instance=player.inv.find(x=>x.id===weapon);equipItem(instance);ensure(player.eq.wpn?.id===weapon,'native weapon equip');
            const scroll=player.inv.find(x=>x.id==='scroll_poly');ensure(scroll,'scroll supply');ensure(confirmPolySelect(scroll.uid,row.form.n),'native card scroll selection');ensure(C.active(player)?.tier===cfg.tier,'selected card is active');
            prepared={tick:state.ticks,hpBefore:before,hpAfter:player.hp,maxHp:player.mhp,mp:player.mp,weapon,form:player.poly.n,unspent:!C.firstState(player,m).seen,stats:JSON.parse(JSON.stringify(player.d))};
            // Both are native action functions. No hit/critical flag is forced.
            const act=()=>{attempts++;if(cfg.kind==='phys')playerAttack();else castSkill('sk_tornado');};act();
            let next=state.ticks+Math.ceil(playerAttackIntervalTicks(true));
            while(state.ticks<wall.until&&!player.dead){state.pDmgTick=-1000000;state.pOffDmgTick=-1000000;tick();minHp=Math.min(minHp,player.hp);if(!C.firstState(player,m).seen&&state.ticks>=next){act();next=state.ticks+Math.ceil(playerAttackIntervalTicks(true));}}
            break;
          }
        }
        state.running=false;const reflection=events.filter(x=>x.origin==='reflection'),boosted=firstHits.filter(x=>x.tier===cfg.tier&&x.multiplier===C.rules[cfg.tier].mult),death=player.dead?events.filter(x=>x.afterDefense>=x.hpBefore&&x.actual>0).at(-1)||events.at(-1):null;
        const lethalFirst=boosted.some(x=>x.settled>=x.hpBefore&&x.wall===cfg.kind);
        return{...cfg,initial,prepared,windows,openedAt,attempts,firstHits,reflection,boosted:boosted.length,lethalFirst,reflectionBypassed:!reflection.length&&lethalFirst,finalHp:player.hp,minHp:Math.min(minHp,lowestHp),dead:player.dead,death,finalMap:mapState.current,events:events.slice(-35)};
      },cfg);
      result.pageErrors=errors;report.results.push(result);fs.mkdirSync('.scratch',{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
      console.log(JSON.stringify({tier:cfg.tier,map:cfg.map,kind:cfg.kind,openedAt:result.openedAt,boosted:result.boosted,reflection:result.reflection,dead:result.dead,minHp:result.minHp,errors}));
      assert.deepEqual(errors,[]);assert.ok(result.openedAt!=null,'Natural reflection window was reached');assert.ok(result.boosted>0,'Card first multiplier reached actual damage');assert.ok(result.reflection.length>0||result.reflectionBypassed,'Reflection either settled or the native lethal-hit rule explicitly skipped it');
    }finally{await close();}
  }
  if(!quick){assert.ok(report.results.filter(r=>r.reflection.length).length>=6,'At least six actual natural reflection cases');for(const tier of ['mythic','celestial','spacetime'])assert.ok(report.results.some(r=>r.tier===tier&&r.reflection.length),'Actual reflection for '+tier);}
  console.log('Card natural-reflection tests passed: '+report.results.length+'.');
}finally{await browser.close();}
