import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';

const browser=await testBrowser();
try {
  const {page,errors,close}=await browser.page();
  try {
    await page.evaluate(code=>window.__profile=eval('('+code+')'),createProfile.toString());
    const result=await page.evaluate(()=>{
      const R=AFK_RELIC_RUNTIME,checks=[];
      function ok(v,name){if(!v)throw Error(name);checks.push(name);}
      function near(a,b,name){ok(Math.abs(a-b)<1e-8,name+': '+a+' = '+b);}
      function fresh(eq={}){__profile({eq});return player;}
      function mob(hp=10000){const m={n:'隔離測試目標',uid:'runtime-'+Math.random(),lv:100,hp,curHp:hp,ac:-50,mr:100,e:'none',dr:0,st:newMobStatus(),exp:0,noGold:true,drop:[]};mapState.mobs=[m,null,null,null,null];return m;}
      fresh();
      let definitions=0;
      for(const c of R.catalog){for(const stage of [0,1,2,3,4]){
        if(c.id===29&&stage===4)continue;
        const base=DB.items[c.key],n=stage===0?0:stage===1?5:stage===2?10:base.type==='acc'?10:15,asc=stage>=3?stage===4?5:0:null;
        const id=__afkRelicPlus.makeId(c.key,n,null,asc),d=__afkRelicPlus.buildDef(c.key,n,null,asc,null);
        if(!d)throw Error('missing definition '+id);
        for(const [k,v] of Object.entries(d))if(typeof v==='number'&&!Number.isFinite(v))throw Error('non-finite '+id+'.'+k);
        if(typeof d.d!=='string'||!d.d.length||/undefined|NaN/.test(d.d))throw Error('invalid description '+id);
        JSON.stringify(d);definitions++;
      }}
      ok(definitions===1249,'all 1,249 valid ordinary/stage definitions');
      ok(!Object.keys(DB.items).some(id=>id==='99999'||id==='99998'),'GM fixtures excluded from enumerable acquisition pools');
      for(const id of ['99999','99998']){
        fresh({[id==='99999'?'wpn':'armor']:id});
        ok(R.sources(player).length===250,id+' exposes exactly 250 unique sources');
        ok(DB.items[id].relicAsc===5&&DB.items[id].noEnhance&&DB.items[id].noAscUp,id+' is fixed final stage');
        const eq=JSON.stringify(player.eq);recomputeStats();ok(JSON.stringify(player.eq)===eq,id+' restores real equipment after stat projection');
        ok(Object.values(player.eq).every(e=>!e||!e._relicVirtual),id+' saves no virtual equipment');JSON.stringify(player);
      }
      fresh({wpn:'99999',armor:'99998'});ok(R.sources(player).length===250,'two GM fixtures do not double same-source effects');
      const setCounts=AFK_RELIC_GM.setCount(player,{});ok(Object.keys(setCounts).length===20&&Object.values(setCounts).every(v=>v===99),'GM armor enables all twenty native set families');
      const sc={};AFK_RELIC_GM.sherine(player,sc);ok(Object.keys(sc).length===12&&Object.values(sc).every(v=>v===5),'GM armor enables all twelve Sherine families');
      const ps=__afkSets.count(player);ok(Object.values(ps).filter(v=>v===true).length===22,'GM armor enables all twenty-two plugin set configurations');
      ok(AFK_RELIC_GM.hasMember(player,'acc_purify_earring')&&['red','blue','green'].every(c=>AFK_RELIC_GM.hasMember(player,'acc_curse_'+c)),'GM armor enables three paired earring sets');

      fresh();let t=mob();
      for(const [mark,element] of [['water','wind'],['fire','water'],['earth','fire'],['wind','earth']]){
        R.api.mark(t,mark,10);near(R.consumeMark(t,element),2,mark+' reaction');near(R.consumeMark(t,element),1,mark+' consumed once');
      }
      R.api.mark(t,'none',10);near(R.consumeMark(t,'fire'),1.5,'breach reaction');
      R.api.mark(t,'water',10);state.ticks=100;near(R.consumeMark(t,'wind'),1,'mark expires at ten seconds');
      state.ticks=0;t=mob();R.api.mark(t,'water',10);R.api.mark(t,'none',10);near(R.consumeMark(t,'wind'),3,'distinct wet and breach marks multiply once each');

      fresh();t=mob();near(R.dotCap(t,80),80,'ordinary poison first budget');near(R.dotCap(t,80),20,'ordinary bleed shares one-percent budget');near(R.dotCap(t,1),0,'ordinary budget cannot overflow');
      t._relicAscHit=true;near(R.dotCap(t,500,{ascended:true}),500,'ascended source exempt on struck target');near(R.dotCap(t,10,{ascended:false}),0,'ordinary source stays capped on ascended-hit target');state.ticks=10;near(R.dotCap(t,500),100,'budget resets at next second');
      t=mob();R.api.dot(t,'poison',{layers:70,damage:1,owner:player,source:R.catalog[0].key});R.api.dot(t,'bleed',{layers:70,damage:1,owner:player,source:R.catalog[0].key});near(R.api.dotLayers(t,'poison'),50,'poison maximum fifty layers');near(R.api.dotLayers(t,'bleed'),50,'bleed maximum fifty layers');JSON.stringify(mapState);
      ok(!t.st.poison&&!t.st.poisonDmg,'relic DOT ledger does not leave invalid native poison fields');

      fresh();const src=R.catalog[0].key;player.hp=100;
      near(R.procHeal(player,50,src),50,'first source heal');near(R.procHeal(player,50,src),0,'same-source heal throttled');
      R.dispatch('battleEnd',{actor:player});R.dispatch('battleStart',{actor:player});near(R.procHeal(player,50,src),0,'battle transition does not reset healing cooldown');
      state.ticks=99;near(R.procHeal(player,50,src),0,'healing still blocked before ten seconds');state.ticks=100;near(R.procHeal(player,50,src),50,'healing resumes at ten seconds');
      const ally=JSON.parse(JSON.stringify(player));ally.curHp=100;near(R.procHeal(ally,50,src),50,'different actor has own source clock');
      near(R.procHeal(player,50,R.catalog[1].key),50,'different relic has own source clock');
      player.hp=0;near(R.procHeal(player,50,R.catalog[2].key),0,'healing cannot resurrect a dead actor');

      fresh();t=mob();player.hp=1000;R.api.shield(player,500,{source:'test-shield',duration:10});t._reflectWall={kind:'melee',until:100};
      reflectWallOnDamage(t,300,'melee',null);near(player.hp,1000,'reflection reaches shield before HP');near(R.api.shieldAmount(player,'test-shield'),350,'reflection spends shield once (血壁反彈減半)');
      t._reflectWall={kind:'phys',until:100,block:true};const before=t.curHp;R.api.damage(t,300,{actor:player,type:'physical',reflect:false});near(t.curHp,before,'terror immunity blocks generated damage exactly once');
      player.statuses.slowAtk=10;player.statuses.bind=10;ok(R.api.hasStatus(player,'slow')&&R.api.hasStatus(player,'root'),'native actor status aliases are readable');R.api.removeStatus(player,'slow');R.api.removeStatus(player,'root');ok(player.statuses.slowAtk===0&&player.statuses.bind===0,'native actor aliases are cleansed');
      R.api.selfCast(player,'sk_berserk');near(player.buffs.sk_berserk,DB.skills.sk_berserk.dur,'self-cast buffs retain seconds rather than ticks');

      return {checks,definitions};
    });
    assert.deepEqual(errors,[]);console.log(JSON.stringify(result,null,2));
  } finally {await close();}
} finally {await browser.close();}
