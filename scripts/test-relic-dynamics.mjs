import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';

// Run the complete game. Values are compared after the real recompute path;
// kill-triggered resources use native killMob and travel uses maybeSpawnMobs.
const browser=await testBrowser();
try{
 const {page,errors,close}=await browser.page();
 try{
  page.on('console',m=>{if(m.text().startsWith('[relic-dynamic]'))console.log(m.text());});
  await page.evaluate(code=>{window.__dynamicProfile=eval('('+code+')');},createProfile.toString());
  const results=await page.evaluate(()=>{
   const R=AFK_RELIC_RUNTIME,D=AFK_RELIC_DEFENSE,S=AFK_RELIC_DEFENSE_BRIDGE,out=[],heals=[],hurts=[],damage=[];
   let base=1000,recomputes=0;
   const recompute=recomputeStats;window.recomputeStats=function(){recomputes++;return recompute.apply(this,arguments);};
   R.observe((event,row)=>{if(event==='heal')heals.push(row);if(event==='hurt')hurts.push(row);if(event==='damage')damage.push(row);});
   function check(v,message){if(!v)throw Error(message);}
   function same(got,want,message){if(got!==want)throw Error(message+': expected '+want+', got '+got);}
   function near(got,want,message){if(Math.abs(got-want)>1e-7)throw Error(message+': expected '+want+', got '+got);}
   function done(text){out.push(text);console.log('[relic-dynamic] '+text);}
   function fresh(entries){
    petRoster().splice(0);const eq={};
    for(const [slot,id,stage=4] of entries){const key=D.byId[id].key,n=stage===0?0:stage===1?5:stage>=3&&DB.items[key].type==='arm'?15:10;eq[slot]=__afkRelicPlus.makeId(key,n,null,stage>=3?stage===4?5:0:null);}
    __dynamicProfile({eq,lv:100,cls:'knight'});Math.random=()=>.99;base+=1000;player.enSeed='dynamic-profile-'+base;state.ticks=base;state.running=true;
    const mob={...DB.mobs.wolf,n:'動態遺物測試敵人',uid:'dynamic-'+base,lv:1,hp:1e8,curHp:1e8,st:newMobStatus(),ac:0,mr:0,dr:0,e:'none',dmg:[1,1],db:0,exp:0,noGold:true,drop:[]};
    mapState.mobs=[mob,null,null,null,null];S.syncMovement();R.tick();R.recalc(player);player.hp=player.mhp;player.mp=player.mmp;R.recalc(player);
    recomputes=0;heals.length=0;hurts.length=0;damage.length=0;return mob;
   }
   function at(t){state.ticks=base+t;R.tick();}
   function kill(){const m=mapState.mobs[0];m.curHp=0;killMob(0);}
   {
    fresh([['gloves',142,4]]);const speed=player.d.atkSpdPct,interval=player.d.aspd;
    player.hp=player.mhp*.5;at(1);same(player.d.atkSpdPct,speed+50,'missing HP changes speed');check(player.d.aspd<interval,'native attack interval follows speed');
    const count=recomputes;player.hp=player.mhp*.495;at(2);same(recomputes,count,'same one-percent HP bucket does not rebuild');
    player.statuses.bleed=100;at(3);same(player.d.atkSpdPct,speed+150,'bleeding adds one hundred speed');
    R.api.removeStatus(player,'bleed');at(4);same(player.d.atkSpdPct,speed+50,'cleansing removes bleeding speed');
    player.hp=player.mhp;at(5);same(player.d.atkSpdPct,speed,'full healing removes missing-HP speed');
    const stable=recomputes;for(let i=6;i<16;i++)at(i);same(recomputes,stable,'stable stats do not rebuild every tick');done('HP buckets, bleeding, native attack speed and stable-tick cache');
   }
   for(const stage of [2,4]){
    fresh([['armor',157,stage]]);const dr=player.d.dr,threshold=stage===4?20:30;
    at(threshold-1);same(player.d.dr,dr,'stand guard not early');at(threshold);same(player.d.dr,dr+30,'stand guard activates at its exact tier threshold');
    mapState.mobs=[null,null,null,null,null];mapState.spawnAt=[null,null,null,null,null];maybeSpawnMobs();check(R.state(player,'_movement').moving,'empty field starts encounter travel');
    at(threshold+1);same(player.d.dr,dr,'travel removes stand guard');near(R.state(player,'_movement').movingFor,.1,'travel counts game time');done('tier '+stage+' stand guard activates and clears with native travel');
   }
   {
    const mob=fresh([['armor',164,4]]),initial={dr:player.d.dr,speed:player.d.atkSpdPct,mp:player.d.mpR};
    R.dispatch('afterHit',{actor:player,target:mob,kind:'melee',origin:'normal',main:true,direct:true,actualDamage:10,snapshot:10});at(1);same(player.d.dr,initial.dr+40,'melee form rebuilds defense');
    R.dispatch('afterHit',{actor:player,target:mob,kind:'ranged',origin:'normal',main:true,direct:true,actualDamage:10,snapshot:10});at(2);same(player.d.atkSpdPct,initial.speed+60,'ranged form rebuilds attack interval');
    R.dispatch('afterHit',{actor:player,target:mob,kind:'magic',skillId:'sk_fireball',paid:true,origin:'normal',main:true,direct:true,actualDamage:10,snapshot:10});at(3);same(player.d.mpR,initial.mp+100,'paid magic form rebuilds mana regeneration');
    at(103);same(player.d.dr,initial.dr,'melee form expires');same(player.d.atkSpdPct,initial.speed,'ranged form expires');same(player.d.mpR,initial.mp,'magic form expires');done('three combat forms independently enter and expire in derived stats');
   }
   {
    fresh([['helm',221,4]]);const hp=player.mhp,dr=player.d.dr,dmg=player.d.extraDmg;kill();at(1);
    same(R.state(player,D.byId[221].key).devour,2,'native kill stores devour');same(player.mhp,hp+200,'devour updates HP maximum');same(player.d.dr,dr+4,'devour updates mitigation');same(player.d.extraDmg,dmg+20,'devour updates damage');
    R.dispatch('battleEnd',{actor:player});R.dispatch('battleStart',{actor:player});at(2);same(player.mhp,hp,'new battle clears devour HP');same(player.d.dr,dr,'new battle clears devour mitigation');done('native kills and battle reset rebuild devour damage, defense and HP');
   }
   {
    fresh([['belt',235,4]]);const melee=player.d.meleeDmg,ranged=player.d.rangedDmg;kill();at(1);
    same(R.state(player,D.byId[235].key).plunder,1,'native kill stores plunder');same(player.d.meleeDmg,melee+20,'plunder updates melee damage');same(player.d.rangedDmg,ranged+20,'plunder updates ranged damage');
    R.dispatch('battleStart',{actor:player});at(2);same(player.d.meleeDmg,melee,'battle reset clears plunder');done('native kill plunder becomes real melee/ranged damage');
   }
   {
    fresh([['ring1',233,4]]);const melee=player.d.meleeDmg,hit=player.d.extraHit,owner=_petCurrentOwnerKey();check(owner,'pet profile has a native owner');
    const pet={uid:'dynamic-pet',form:'狼',lv:10,exp:0,mhp:100,mmp:20,hp:100,mp:20,outOwner:owner,eq:{},_statuses:{}};petRoster().push(pet);
    at(1);same(player.d.meleeDmg,melee+100,'deployed pet level adds damage');same(player.d.extraHit,hit+10,'deployed pet level adds hit');
    pet.lv=11;at(2);same(player.d.meleeDmg,melee+110,'pet level-up propagates without equipment change');
    pet.hp=0;pet._downed=true;at(3);same(player.d.meleeDmg,melee,'fallen pet no longer grants damage');
    pet.hp=100;pet._downed=false;at(4);same(player.d.meleeDmg,melee+110,'revived deployed pet restores bonus');
    pet.outOwner=null;at(5);same(player.d.meleeDmg,melee,'stored pet no longer grants damage');done('native deployed pet level, fall, revival and storage update owner stats');
   }
   for(const [stage,threshold,bonus] of [[1,.25,60],[2,.35,100],[3,.5,200]]){
    fresh([['amulet',248,stage]]);const regen=player.d.mpR;
    player.mp=player.mmp*threshold;at(1);same(player.d.mpR,regen,'exact threshold stays inactive');
    player.mp=Math.max(0,player.mmp*threshold-1);at(2);same(player.d.mpR,regen+bonus,'low MP activates correct tier regeneration');
    player.mp=player.mmp;at(3);same(player.d.mpR,regen,'restored MP removes conditional regeneration');done('tier '+stage+' low-MP threshold updates mana regeneration');
   }
   {
    fresh([['gloves',142,4],['helm',221,4]]);player.hp=player.mhp*.5;at(1);kill();at(2);
    const itemSpeed=DB.items[player.eq.gloves.id].atkSpdPct;const expected=itemSpeed+D.hpSpeedBonus(player,R.api);
    same(player.d.atkSpdPct,expected,'missing-HP speed uses post-devour maximum');const saved=recomputes;at(3);same(recomputes,saved,'post-devour stat key is already settled');done('HP-derived speed uses final maximum and does not rebuild recursively');
   }
   {
    fresh([['boots',203,4]]);player.hp=100;mapState.mobs=[null,null,null,null,null];mapState.spawnAt=[null,null,null,null,null];maybeSpawnMobs();const next=Math.min(...mapState.spawnAt.filter(x=>x!=null));
    check(next-base>=30,'real encounter delay is long enough to test travel');check(R.state(player,'_movement').moving,'native queue is travel');
    for(let t=1;t<=next-base;t++){at(t);maybeSpawnMobs();}
    const source=D.byId[203].key;check(heals.filter(x=>x.source===source).length===3,'pilgrim regeneration delivers exactly three paid pulses');same(R.state(player,source).pilgrimSeals,1,'two continuous seconds earn one pilgrim seal');
    check(mapState.mobs.some(m=>m&&m.curHp>0),'native queue actually spawns enemies');check(!R.state(player,'_movement').moving,'arrival ends travel');
    at(next-base+1);maybeSpawnMobs();check(!R.state(player,'_movement').moving,'vacant back slots do not move a fighting party');
    mapState.current=PURE_BOSS_MAPS[0];mapState.mobs=[null,null,null,null,null];mapState.spawnAt=[null,base+200,null,null,null];S.syncMovement();check(!R.state(player,'_movement').moving,'fixed boss respawn is not travel');
    same(R.state(player,source).pilgrimSeals,1,'fixed boss waiting grants no seal');done('native empty-field travel enables pilgrim healing and excludes partial/boss respawns');
   }
   {
    const mob=fresh([['shield',187,4]]),actor=JSON.parse(JSON.stringify(player));actor._allyName='倍率測試傭兵';actor._slot='1';actor.curHp=actor.mhp;actor.allies=[];player.allies=[actor];R.invalidate();
    const def=DB.items[actor.eq.shield.id],before=mob.curHp;
    window.__afkSpellMult=1;allyProcFreeMagicSkill(actor,mob,'sk_fireball',0,false,def);const first=before-mob.curHp;
    window.__afkSpellMult=2;const middle=mob.curHp;allyProcFreeMagicSkill(actor,mob,'sk_fireball',0,false,def);window.__afkSpellMult=undefined;
    check(first>0,'native armor free spell deals damage');same(middle-mob.curHp,first*2,'native ally armor spell multiplier applies exactly once');
    check(damage.some(x=>x.source===D.byId[187].key&&x.actor===actor),'ally spell retains its armor source');done('native ally armor spell multiplier and source attribution apply once');
   }
   for(const role of ['player','ally']){
    const mob=fresh([['shield',187,4]]);let actor=player;player.skills.push('sk_fireball');player._autoAtkSkill='sk_fireball';
    if(role==='ally'){actor=JSON.parse(JSON.stringify(player));actor._allyName='反傷法術測試傭兵';actor._slot='1';actor.curHp=actor.mhp;actor.allies=[];player.allies=[actor];R.invalidate();}
    const before=R.api.hp(actor),mobBefore=mob.curHp;mob._reflectWall={kind:'magic',until:state.ticks+100};
    R.api.damage(mob,200,{actor,source:'test-reflection-entry',kind:'magic',element:'fire',reflect:true});
    same(hurts.length,1,role+' counter spell must not reenter blood wall');same(R.api.hp(actor),before-25,role+' only original reflected damage after reduction (血壁反彈減半)');check(mob.curHp<mobBefore-200,role+' reflected hit actually casts retaliatory damage');
    check(damage.some(x=>x.origin==='reflection'&&x.target===mob),role+' retaliation inherits reflection origin');done('blood wall → '+role+' retaliatory spell cannot create a reflection loop');
   }
   return out;
  });
  assert.equal(results.length,15);assert.deepEqual(errors,[]);console.log('Relic dynamic integration tests passed: '+results.length+' complete-game regressions.');
 }finally{await close();}
}finally{await browser.close();}
