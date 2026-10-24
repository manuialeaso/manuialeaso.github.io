import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {testBrowser,createProfile} from './relic-test-browser.mjs';

// These cases run the complete loaded game, original status spells and tick/
// kill paths. Only the random draw is fixed; damage, resistance and healing are
// the real runtime. Every browser context is isolated from player save slots.
console.log('Defense native tests: launching isolated browser.');
const browser=await testBrowser();
try{
 console.log('Defense native tests: loading complete game.');
 const {page,errors,close}=await browser.page();
 try{
  console.log('Defense native tests: page ready.');
  page.on('console',message=>{if(message.text().startsWith('[defense-test]'))console.log(message.text());});
  if(!await page.evaluate(()=>!!window.AFK_RELIC_DEFENSE_BRIDGE))await page.addScriptTag({content:await readFile(new URL('../afk-relic-defense-bridge.js',import.meta.url),'utf8')});
  await page.evaluate(code=>{window.__defenseProfile=eval('('+code+')');},createProfile.toString());
  const results=await page.evaluate(()=>{
   const R=AFK_RELIC_RUNTIME,S=AFK_RELIC_DEFENSE_BRIDGE,D=AFK_RELIC_DEFENSE,events=[],heals=[],casts=[],hurts=[];
   const dispatch=R.dispatch;R.dispatch=function(event,c,only){const out=dispatch(event,c,only);if(['onStatusAttempt','onStatusEnd'].includes(event))events.push({event,kind:c.statusKind,applied:!!c.applied,immune:!!c.immune,natural:!!c.natural,actor:c.actor,target:c.attacker});return out;};
   const cast=R.api.cast;R.api.cast=function(t,id,opt){casts.push({t,id,opt});return cast.apply(this,arguments);};
   R.observe((event,row)=>{if(event==='heal')heals.push(row);if(event==='hurt')hurts.push(row);});
   const out=[];out.push=function(value){console.log('[defense-test] '+value);return Array.prototype.push.call(this,value);};
   function check(value,message){if(!value)throw Error(message);}
   function same(got,want,message){if(got!==want)throw Error(message+': expected '+want+', got '+got);}
   function fresh(entries){
    const eq={};for(const [slot,id,stage=4] of entries){const key=D.byId[id].key,n=stage===0?0:stage===1?5:stage>=3&&DB.items[key].type==='arm'?15:10;eq[slot]=__afkRelicPlus.makeId(key,n,null,stage>=3?stage===4?5:0:null);}
    __defenseProfile({eq,lv:100,cls:'knight'});Math.random=()=>.99;player.d.mr=0;player.hp=100;player.mp=0;
    const mob={n:'狀態測試施法者',uid:'status-caster',lv:1,hp:1e8,curHp:1e8,st:newMobStatus(),ac:0,mr:0,dr:0,e:'none',dmg:[1,1],db:0,exp:0,noGold:true,drop:[]};
    mapState.mobs=[mob,null,null,null,null];events.length=0;heals.length=0;casts.length=0;hurts.length=0;return mob;
   }
   function spell(mob,type,more){applyMobMagic(mob,{type,pbase:400,dur:10,tick:1,d:100,...more});}
   function attempts(){return events.filter(e=>e.event==='onStatusAttempt');}

   // A real blocked paralysis cures two other statuses, heals once, and uses
   // the same source's ten-second clock on the next attempted paralysis.
   {
    const mob=fresh([['gloves',135,2]]),before=player.hp,amount=Math.floor(player.mhp*.1);
    player.statuses.poison=80;player.statuses.burn=80;spell(mob,'paralyze');
    same(player.statuses.paralyze||0,0,'paralysis immunity');same(player.statuses.poison,0,'first cleanse');same(player.statuses.burn,0,'second cleanse');same(player.hp,before+amount,'personal ten-percent heal');
    spell(mob,'paralyze');same(player.hp,before+amount,'shared source heal cooldown');same(attempts().length,2,'one result per attempt');check(attempts().every(e=>e.immune&&!e.applied&&e.target===mob),'blocked result has the caster');out.push('native paralysis immunity and shared healing clock');
   }
   {
    const mob=fresh([['armor',158,4]]),before=player.hp;spell(mob,'poison');same(player.hp,before+300,'poison immunity heal');same((mob._relicDots||[]).filter(x=>x.kind==='poison').length,3,'three retaliation poison layers');
    spell(mob,'poison');same(player.hp,before+300,'poison healing is throttled');same((mob._relicDots||[]).filter(x=>x.kind==='poison').length,3,'retaliation shares blessing clock');same(attempts().length,2,'early native immunity emits one result');out.push('native poison immunity and retaliation');
   }
   {
    const mob=fresh([['ring1',227,1]]),before=player.hp;spell(mob,'burn');same(player.hp,before+150,'successful status heals');same(player.statuses.burn,100,'native duration retained');same(R.incoming(player,100,mob,{kind:'dot',dotKind:'burn',direct:false}),75,'only this accepted DoT receives protection');
    spell(mob,'burn');same(player.hp,before+150,'refresh does not bypass healing cooldown');same(attempts().length,2,'each real refresh reports once');check(attempts().every(e=>e.applied&&!e.immune),'successful result flags');out.push('successful status, refresh, DoT reduction');
   }
   {
    const mob=fresh([['ring1',227,1],['armor',158,0]]),before=player.hp;spell(mob,'poison');same(player.hp,before,'black ring does not heal a rejected status');same(attempts().length,1,'one rejected status result');check(attempts()[0].immune&&!attempts()[0].applied,'rejected is not applied');out.push('blocked status does not trigger black ring');
   }
   {
    const mob=fresh([['helm',220,2]]);spell(mob,'stun');same(player.statuses.stun,48,'skull duration multiplier');same(attempts().length,1,'duration query creates no extra event');out.push('native control duration reduction');
   }
   {
    const mob=fresh([['helm',220,4]]),before=mob.curHp,amount=Math.floor(player.mhp*.2);spell(mob,'stun');same(player.statuses.stun,0,'skull immediately removes accepted control');same(before-mob.curHp,amount,'skull retaliation once');
    spell(mob,'stun');same(before-mob.curHp,amount,'temporary immunity causes no second success retaliation');same(attempts().length,2,'successful cleanse and subsequent immunity are distinct attempts');out.push('native successful control cleanse and temporary immunity');
   }
   {
    const mob=fresh([['helm',219,4]]),key=D.byId[219].key;spell(mob,'burn');same(R.state(player,key).seals,1,'one seal for one blocked event');same(heals.length,1,'one immune heal');same(attempts().length,1,'no pre-query duplicated result');out.push('three-head immunity reaction counted once');
   }
   {
    const mob=fresh([['amulet',243,4]]),before=mob.curHp;player.skills.push('sk_fireball');player._autoAtkSkill='sk_fireball';spell(mob,'silence');same(player.statuses.silence||0,0,'priest silence immunity');same(casts.length,1,'final silence counter happens once');check(mob.curHp<before,'counter executes the configured native damage spell');same(player.mp,Math.min(player.mmp,100),'one mana return');same(attempts().length,1,'one silence attempt');out.push('uncapped silence counter has no duplicate dispatch');
   }
   {
    fresh([['gloves',135,2]]);const before=player.hp;player.statuses.paralyze=1;state.running=true;tick();state.running=false;same(player.hp,before+Math.floor(player.mhp*.1),'native player status expiry heals');check(events.some(e=>e.kind==='paralyze'&&e.natural),'native expiry event');
    state.ticks+=100;player.statuses.paralyze=30;const second=player.hp;S.setStatus(player,'paralyze',0);same(player.hp,second,'manual cleansing is not natural expiry');out.push('native player expiration differs from manual cleanse');
   }
   {
    const mob=fresh([['ring1',227,2]]),ally=JSON.parse(JSON.stringify(player));ally._allyName='狀態測試傭兵';ally._slot='1';ally.curHp=100;ally.d.mr=0;ally.allies=[];player.allies=[ally];R.invalidate();
    applyMobMagicToAlly(mob,{type:'burn',dur:10,tick:1,d:100},ally);same(ally.curHp,500,'ally successful status heal');state.ticks=10;processAllyStatusTick(ally);same(ally.curHp,450,'native ally DoT passes through fifty-percent protection');out.push('native ally successful status and DoT defense');
   }
   {
    fresh([['shield',178,0]]);const source=D.byId[178].key;_relicOnDamageHeal();const healed=player.hp;check(healed>100,'base shield heals');_relicOnDamageHeal();same(player.hp,healed,'base shield repeat blocked');state.ticks=99;_relicOnDamageHeal();same(player.hp,healed,'base shield remains blocked before ten seconds');state.ticks=100;_relicOnDamageHeal();check(player.hp>healed,'base shield allowed at ten seconds');same(heals.filter(x=>x.source===source).length,2,'base shield source clock');out.push('base shield native healing minimum ten seconds');
   }
   {
    const mob=fresh([['ring1',227,0]]);spell(mob,'burn');same(player.hp,150,'base black ring healing');spell(mob,'scald');same(player.hp,150,'different status cannot reset base ring cooldown');out.push('base status ring shares cooldown across status kinds');
   }
   {
    fresh([['helm',221,0]]);const killed=()=>{mapState.mobs[0]={...DB.mobs.wolf,n:'冷卻測試野狼',uid:'kill-test-'+state.ticks+'-'+Math.random(),hp:100,curHp:0,lv:1,exp:0,noGold:true,drop:[],st:newMobStatus()};killMob(0);};
    killed();same(player.hp,130,'base helmet kill heal');killed();same(player.hp,130,'rapid kill cannot repeat helmet heal');state.ticks=100;killed();same(player.hp,160,'helmet healing resumes at ten seconds');out.push('native kill helmet minimum ten seconds');
   }
   {
    fresh([['armor',163,0]]);player.statuses.poison=1000;player.statuses.poisonDmg=100;player.statuses.poisonTick=10;
    const step=(at)=>{state.ticks=at;state.running=true;tick();state.running=false;};
    step(9);same(player.hp,150,'base poison net fifty-percent healing');
    step(19);same(player.hp,150,'base poison remains harmless during healing cooldown');
    step(109);same(player.hp,200,'base poison resumes healing at ten seconds');
    same(heals.filter(x=>x.source===D.byId[163].key).length,2,'base poison shares one source clock');
    check(!player.dead,'poison conversion never kills and revives the player');out.push('base poison native tick immunity and ten-second net healing');
   }
   {
    fresh([['armor',163,0]]);const ally=JSON.parse(JSON.stringify(player));ally._allyName='毒素測試傭兵';ally._slot='1';ally.curHp=100;ally.allies=[];ally.statuses.poison=1000;ally.statuses.poisonDmg=100;ally.statuses.poisonTick=10;player.allies=[ally];R.invalidate();
    state.ticks=10;processAllyStatusTick(ally);same(ally.curHp,150,'ally base poison conversion');
    state.ticks=20;processAllyStatusTick(ally);same(ally.curHp,150,'ally poison cooldown immunity');
    state.ticks=110;processAllyStatusTick(ally);same(ally.curHp,200,'ally poison resumes healing');same(player.hp,100,'ally healing does not leak to leader');
    check(!ally._downed,'poison does not down converted ally');out.push('base poison native ally tick shares the same source rule');
   }
   for(const role of ['player','ally']){
    const mob=fresh([['helm',222,4]]);let actor=player;
    if(role==='ally'){actor=JSON.parse(JSON.stringify(player));actor._allyName='反射測試傭兵';actor._slot='1';actor.curHp=100;actor.allies=[];player.allies=[actor];R.invalidate();}
    mob._reflectWall={kind:'magic',until:100};R.api.shield(actor,500,{source:'test-reflect-shield',cap:500,duration:10});
    reflectWallOnDamage(mob,200,'magic',role==='ally'?actor:null);same(R.api.hp(actor),100,role+' blood wall first consumes shield');same(R.api.shieldAmount(actor,'test-reflect-shield'),400,role+' shield balance');
    same(hurts.length,1,role+' one protected incoming event');check(hurts[0].origin==='reflection'&&hurts[0].main===false,role+' reflection context');
    reflectWallOnDamage(mob,1e7,'magic',role==='ally'?actor:null);same(R.api.hp(actor),1,role+' death prevention happens before HP subtraction');check(!actor.dead&&!actor._downed,role+' survives without native death settlement');same(R.state(actor,D.byId[222].key).deathUses,1,role+' consumes exactly one stone seal');
    same(hurts.length,2,role+' no reflection recursion');out.push('native blood-wall '+role+' shields and lethal protection');
   }
   for(const role of ['player','ally']){
    const mob=fresh([['helm',222,4]]);let actor=player;
    if(role==='ally'){actor=JSON.parse(JSON.stringify(player));actor._allyName='屏障測試傭兵';actor._slot='1';actor.curHp=100;actor.allies=[];player.allies=[actor];R.invalidate();}
    mob.dmg=[1,10000];mob._counterBarrier=1;R.api.shield(actor,20000,{source:'test-counter-shield',cap:20000,duration:10});
    trollCounterBarrierOnDamage(mob,1,role==='ally'?actor:null);same(mob._counterBarrier,0,role+' barrier is consumed before return attack');same(R.api.hp(actor),100,role+' counter barrier consumes shield first');check(R.api.shieldAmount(actor,'test-counter-shield')<20000,role+' real counter damage reaches the shield');
    same(hurts.length,1,role+' one counter hit');check(hurts[0].origin==='reflection'&&hurts[0].main===false,role+' counter uses reflection identity');
    delete R.state(actor,'_shields')['test-counter-shield'];mob._counterBarrier=1;trollCounterBarrierOnDamage(mob,1,role==='ally'?actor:null);
    same(R.api.hp(actor),1,role+' counter lethal damage protected before HP subtraction');check(!actor.dead&&!actor._downed,role+' counter cannot bypass stone seal');same(R.state(actor,D.byId[222].key).deathUses,1,role+' counter consumes one stone seal');same(hurts.length,2,role+' no counter recursion');
    out.push('native counter-barrier '+role+' shields, death protection and source identity');
   }
   return out;
  });
  assert.equal(results.length,19);assert.deepEqual(errors,[]);console.log('Defense native bridge tests passed: '+results.length+' full-engine browser regressions.');for(const item of results)console.log('  '+item);
 }catch(e){console.error('Defense native test failure:',e);throw e;}finally{console.log('Defense native tests: closing context.');await close();}
}finally{console.log('Defense native tests: closing browser.');await browser.close();}
