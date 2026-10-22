import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';

// Exercise the actual HP settlement, native summon damage and GM projections.
// Event-count assertions detect recursion; no game callback is truncated.
const browser=await testBrowser();
try{
 const {page,errors,close}=await browser.page();
 try{
  page.on('console',m=>{if(m.text().startsWith('[relic-reaction]'))console.log(m.text());});
  await page.evaluate(code=>{window.__reactionProfile=eval('('+code+')');},createProfile.toString());
  const result=await page.evaluate(()=>{
   const R=AFK_RELIC_RUNTIME,D=AFK_RELIC_DEFENSE,C=AFK_RELIC_COMPANIONS,out=[],hurts=[],damages=[];
   let sequence=0;
   R.observe((event,row)=>{if(event==='hurt')hurts.push(row);if(event==='damage')damages.push(row);});
   function check(value,message){if(!value)throw Error(message);}
   function same(got,want,message){if(got!==want)throw Error(message+': expected '+want+', got '+got);}
   function near(got,want,message){if(Math.abs(got-want)>1e-7)throw Error(message+': expected '+want+', got '+got);}
   function done(message){out.push(message);console.log('[relic-reaction] '+message);}
   function fresh(entries,gm){
    petRoster().splice(0);const eq={};
    for(const [slot,id,stage=4] of entries){const key=D.byId[id].key,n=stage===1?5:stage>=3&&DB.items[key].type==='arm'?15:10;eq[slot]=__afkRelicPlus.makeId(key,n,null,stage>=3?stage===4?5:0:null);}
    if(gm)eq[gm==='99999'?'wpn':'armor']=gm;
    __reactionProfile({eq,cls:'knight',lv:150,rebirth:1});Math.random=()=>.99;state.ticks=++sequence*10000;state.running=true;player.enSeed='reaction-'+sequence;
    const mob={...DB.mobs.wolf,n:'反擊測試敵人',uid:'reaction-'+sequence,lv:150,hp:1e8,curHp:1e8,st:newMobStatus(),ac:0,mr:0,dr:0,e:'none',dmg:[1,1000],db:0,exp:0,noGold:true,drop:[]};
    mapState.mobs=[mob,null,null,null,null];hurts.length=0;damages.length=0;return mob;
   }
   function hurt(actor,amount,enemy,opts={}){const value=R.incoming(actor,amount,enemy,{kind:'melee',origin:'normal',main:true,direct:true,...opts});if(actor.curHp!=null)actor.curHp-=value;else actor.hp-=value;R.afterIncoming(actor,value,enemy);return value;}
   function summon(){const s={skId:'sk_zombie',form:'殭屍',lv:20,hp:10000,mhp:10000,mp:0,mmp:0,remain:1000};player.summonsV2=[s];return s;}
   {
    const mob=fresh([['shin',191],['helm',214]]),before=player.hp;
    R.api.damage(player,100,{actor:player,source:'self-regression',origin:'self',type:'physical',noProc:true});
    same(player.hp,before-100,'self cost settles once');same(mob.curHp,mob.hp,'self cost does not strike enemies');same(hurts.length,1,'self cost has one hurt event');same(damages.length,1,'self cost has one damage settlement');
    const own=hurts[0];same(own.attacker,null,'self is not a hostile attacker');same(own.origin,'self','self origin survives settlement');same(own.damageSource,'self-regression','incoming damage source survives source dispatch');same(own.damageOwner,player,'incoming owner is retained separately');check(own.noProc,'noProc reaches hurt handlers');
    same((player._relicDots||[]).length,0,'thorns cannot apply bleed to its owner');hurts.length=0;damages.length=0;
    hurt(player,100,mob);same(hurts.length,1,'hostile hit remains a single incoming event');same(mob.hp-mob.curHp,1600,'hostile hit still triggers both authorized retaliations');done('self damage retains provenance while genuine enemy attacks still retaliate');
   }
   for(const gm of ['99999','99998']){
    const mob=fresh([],gm);R.api.damage(player,100,{actor:player,source:'gm-self-regression',origin:'self',type:'physical'});
    same(hurts.length,1,gm+' self damage has one incoming event');same(damages.length,1,gm+' self damage produces no offensive branch');same(mob.curHp,mob.hp,gm+' self damage cannot attack enemies');check(player.hp>0&&!player.dead,gm+' remains alive');same(hurts[0].attacker,null,gm+' self is never the attacker');done(gm+' all-effect projection cannot retaliate against itself');
   }
   {
    fresh([['shin',191],['helm',222]]);player.hp=1000;
    R.api.shield(player,500,{source:'self-protection',cap:500,duration:10});
    R.api.damage(player,100,{actor:player,source:'self-protection-test',origin:'self',type:'physical',noProc:true});same(player.hp,1000,'self damage still respects shields');
    R.api.damage(player,1e9,{actor:player,source:'self-protection-test',origin:'self',type:'physical',noProc:true});same(player.hp,1,'self damage still reaches pre-death protection');same(hurts.length,2,'shield and death-save each settle once');check(hurts[1].preventDeath,'lethal hit records prevention');done('self damage keeps shield absorption and pre-death protection');
   }
   {
    const mob=fresh([['shin',191],['helm',213,1]]),before=player.hp;hurt(player,100,mob);
    same(player.hp,before-200,'bombflower pays its one explicit self cost');same(mob.hp-mob.curHp,1300,'bombflower and thorns retain their original hostile damage');same(hurts.length,2,'bombflower cost does not trigger further retaliation');check(hurts.some(c=>c.origin==='self'&&c.noProc&&c.attacker===null),'bombflower self cost is tagged');done('bombflower retains its self cost without generating a retaliation tree');
   }
   {
    const mob=fresh([['shield',186],['shin',191],['helm',214]]),ally=JSON.parse(JSON.stringify(player));ally._allyName='分攤測試傭兵';ally._slot='1';ally.curHp=ally.mhp;ally.allies=[];player.allies=[ally];R.invalidate();
    const s=summon(),p0=player.hp,a0=ally.curHp;
    let value=C.incoming(s,1000,mob,{kind:'melee',origin:'normal',main:false,direct:true});s.hp-=value;C.afterIncoming(s,value,mob);
    near(value,360,'two distinct holders reduce the remaining incoming hit once each');near(player.hp,p0-100,'first holder takes 20 percent then its authorized 100 heal');near(ally.curHp,a0-20,'second holder takes 20 percent of remaining damage then its authorized heal');
    same(hurts.length,3,'two transfers and the original hit settle exactly once');same(damages.length,2,'only the two transfers deal generated damage');same(mob.curHp,mob.hp,'transfers produce no offensive retaliation');
    const redirected=hurts.filter(c=>c.redirected);same(redirected.length,2,'both transfer contexts retain redirected');check(redirected.every(c=>c.noProc&&c.origin==='redirect'&&c.attacker===null&&c.damageSource===D.byId[186].key),'transfer identity survives every source dispatch');done('two guardian holders share a summon hit once each without transfer bounce');
   }
   for(const gm of ['99999','99998']){
    const mob=fresh([],gm),s=summon();enemyAttackSummon(mob,s);
    same(hurts.length,2,gm+' native summon attack settles its transfer and victim once');same(hurts.filter(c=>c.redirected).length,1,gm+' native summon hit causes one guardian transfer');
    const transfer=hurts.find(c=>c.redirected);check(transfer.noProc&&transfer.attacker===null&&transfer.origin==='redirect',gm+' native transfer cannot attack its owner');check(player.hp>0&&!player.dead,gm+' native summon damage leaves owner alive');check(s.hp>0&&!s._downed,gm+' protected summon remains alive');done(gm+' native summon damage cannot start the previously reproduced self-retaliation loop');
   }
   return out;
  });
  assert.equal(result.length,8);assert.deepEqual(errors,[]);console.log('Relic reaction integration tests passed: '+result.length+' complete-game regressions.');
 }finally{await close();}
}finally{await browser.close();}
