import assert from 'node:assert/strict';
import {testBrowser,createProfile} from './relic-test-browser.mjs';
const browser=await testBrowser();
try{
 const {page,errors,close}=await browser.page();
 try{
  await page.evaluate(code=>{window.__weaponProfile=eval('('+code+')');},createProfile.toString());
  const results=await page.evaluate(()=>{
   const R=AFK_RELIC_RUNTIME,W=AFK_RELIC_WEAPONS,B=AFK_RELIC_WEAPON_BRIDGE,rows=[],failures=[];
   function check(ok,msg){if(!ok)throw Error(msg);}
   function fresh(id,stage=4){
    const entry=W.byId[id],asc=stage>=3?(id===29?0:stage===4?5:0):null,n=stage<1?0:stage===1?5:stage===2?10:15;
    const key=__afkRelicPlus.makeId(entry.key,n,null,asc),cls=id===10||id>=35&&id<=44?'elf':id===33||id===34?'illusion':id>=115?'mage':'knight';
    __weaponProfile({cls,lv:100,eq:{wpn:key}});player.classicMode=false;recomputeStats();player.hp=player.mhp;player.mp=player.mmp;
    const mob={...DB.mobs.wolf,n:'武器測試怪',uid:'weapon-test-'+id,lv:1,hp:1e8,curHp:1e8,st:newMobStatus(),ac:0,mr:0,dr:0,e:'none',s:'S',hardSkin:0,hardSkinMax:0,exp:0,noGold:true,drop:[],boss:false,un:false,race:'人類'};
    mapState.mobs=[mob,null,null,null,null];mapState.targetIdx=0;Math.random=()=>.99;
    return {d:DB.items[key],mob,ref:player.eq.wpn};
   }
   for(let id=1;id<=131;id++){
    const {d,mob,ref}=fresh(id),before=mob.curHp,originalStats={...player.d};
    try{
     const got=B.nativeSegment(mob,d,ref,{actor:player});
     check(Number.isFinite(got),'nonfinite return');check(Number.isFinite(player.hp)&&Number.isFinite(mob.curHp),'nonfinite HP');
     check(player.eq.wpn===ref,'equipment reference leaked');check(!R.action(),'action leaked');
     for(const [key,n]of Object.entries(player.d))if(typeof n==='number')check(Number.isFinite(n),'nonfinite stat '+key);
     check(mob.curHp<before||mob._dead,'no primary damage');rows.push({id,name:W.byId[id].name,damage:Math.max(0,before-mob.curHp),hp:player.hp});
    }catch(e){failures.push('weapon '+id+' '+W.byId[id].name+': '+e.message+'\n'+e.stack);}
   }
   check(failures.length===0,failures.join('\n\n'));
   // Two physical paths share the global poison ledger, and resistance/flat
   // debuffs are consumed before native mitigation arithmetic.
   {
    const {d,mob}=fresh(6);R.api.dot(mob,'poison',{owner:player,source:d.relicBase,layers:1,damage:1,duration:10,ascended:true});check(B.hasStatus(mob,'poison'),'ledger poison invisible to native bonus');
    R.api.status(mob,'flatReductionDown',8,200);check(B.flatReduction(mob,d,500)===300,'flat reduction debuff ignored');
    mob.resEarth=80;const before=magicAttrDefense(mob,'earth');R.api.status(mob,'earthResistanceDown',10,30);check(magicAttrDefense(mob,'earth')<before,'element resistance debuff ignored');
   }
   // Blood-kiss bypass really acts before MR; two native free casts are one
   // damage each and share one ten-second native-healing source cooldown.
   {
    const {d,mob}=fresh(12);Math.random=()=>.5;player.hp=1;mob.mr=0;let n=mob.curHp;procFreeMagicSkill(mob,'sk_vampire',0,false,d);const low=n-mob.curHp,healed=player.hp;
    mob.mr=500;n=mob.curHp;procFreeMagicSkill(mob,'sk_vampire',0,false,d);check(n-mob.curHp===low,'blood kiss MR bypass occurs too late');check(player.hp===healed,'free spell healed twice inside ten seconds');
   }
   // Every target of one native AOE retains the same cast action identity.
   {
    const {d,mob}=fresh(116);mapState.mobs[1]={...mob,uid:'aoe-second',st:newMobStatus()};const seen=[],dispatch=W.dispatch;
    W.dispatch=function(event,c,api){if(event==='beforeSkill'&&c.skillId==='sk_fire_storm')seen.push({id:c.actionId,index:c.skillHitIndex});return dispatch(event,c,api);};
    try{procFreeMagicSkill(mob,'sk_fire_storm',0,false,d);}finally{W.dispatch=dispatch;}
    check(seen.length===2,'AOE cast target count');check(seen[0].id===seen[1].id,'AOE resets action identity');check(seen[0].index===0&&seen[1].index===1,'AOE hit counter resets after flush');
   }
   return rows;
  });
  assert.equal(results.length,131);assert.deepEqual(errors,[]);
  console.log('Weapon full-browser tests passed: all 131 final-state native channels, no throws/NaN/leaked actions; ledger debuffs, pre-MR bypass, native heal CD, shared AOE identity.');
 }finally{await close();}
}finally{await browser.close();}
