/** Reproducible native-combat balance matrix. No combat formula is mocked. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {testBrowser,createProfile} from './relic-test-browser.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),quick=args.includes('--quick');
const arg=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const output=path.resolve(root,arg('--out',quick?'../work/weapon_implementation/balance-quick.json':'docs/relic-balance-results.json'));
const maps=['pride_f100','dom_tower_10','antharas_lair','cr_fafurion_lair','cr_valakas_lair','cr_lindvior_lair'];
const stages=['','+5','+10','昇華支配','昇華支配+5'];
const profiles=[...[1,2,3,4].map(stage=>({id:'lv100-knight-w51-s'+stage,cls:'knight',weapon:51,lv:100,rebirth:0,stage})),
 ...[['knight',100],['elf',41],['mage',129],['illusion',33]].map(([cls,weapon])=>({id:'reborn-'+cls+'-w'+weapon,cls,weapon,lv:150,rebirth:1,stage:4})),
 ...['99999','99998'].map(gm=>({id:'gm-'+gm,cls:'knight',weapon:gm==='99999'?gm:100,gm,lv:150,rebirth:1,stage:4}))];
let cases=profiles.flatMap(p=>maps.map(map=>({...p,map,seed:20261022,maxSeconds:map.includes('lair')?300:180})));
cases.push(...maps.slice(2).map(map=>({...profiles[4],id:'party16-reborn',map,party:16,seed:20261022,maxSeconds:300})));
cases.push(...[[4,2,'phys'],[6,3,'magic'],[8,4,'magic'],[9,5,'magic']].map(([p,m,kind])=>({...profiles[p],id:'reflection-window-'+profiles[p].id,map:maps[m],waitReflect:kind,gmEquipOnReflection:p>=8,seed:20261022,maxSeconds:300})));
if(quick)cases=[cases.find(c=>c.id==='lv100-knight-w51-s1'&&c.map==='pride_f100'),cases.find(c=>c.id==='reborn-knight-w100'&&c.map==='antharas_lair')];
if(arg('--filter',''))cases=cases.filter(c=>(c.id+'@'+c.map).includes(arg('--filter','')));
if(arg('--limit',''))cases=cases.slice(0,Number(arg('--limit','')));
if(args.includes('--trace-defense'))cases=cases.map(c=>({...c,traceDefense:true}));
// Record every native numbered core file, plus all relic/card damage and data
// modules used by this matrix. This includes the cross-stage target identity seam.
const sourceFiles=[
 'afk-relic-weapons.js','afk-relic-weapon-bridge.js','afk-relic-runtime.js',
 'afk-relic-defense.js','afk-relic-defense-bridge.js','afk-relic-companions.js',
 'afk-relic-integration.js','afk-relic-gm.js','afk-relicfx.js','afk-relicplus.js',
 'afk-corrupt.js','afk-dreamhell.js','afk-dreamstar.js','afk-rebirth.js',
 'afk-card-combat.js','afk-card-forms.js','afk-card-ascension.js','afk-cardplus.js',
 'afk-arts.js','afk-stackdot.js','afk-extradata.js',
 ...fs.readdirSync(path.join(root,'js')).filter(f=>/^\d\d-.*\.js$/.test(f)).sort().map(f=>'js/'+f)
];
function fingerprint(){return Object.fromEntries(sourceFiles.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex').slice(0,16)]));}
const report={schema:2,createdAt:new Date().toISOString(),mode:quick?'quick':'matrix',seed:20261022,expectedCases:cases.length,stages,
 methodology:{clock:'Native tick at 0.1 game seconds; each case uses a new isolated browser context.',profiles:'Legal creation points, level allocations and rebirth carry from createProfile; native recomputeStats and buildAlly.',
 combat:'Unmodified native attacks, skills, enemy spawns, transformations and reflection. Boss encounter selection is fixed; stats are not changed.',
 reflectionPressure:'Four additional cases hold only the player ordinary attack schedule and offensive auto-cast until a native reflection window of the matching damage type appears. Enemy actions, environmental damage, defensive counters and healing remain active. No reflection status is inserted. For the two GM pressure cases, a normal final-stage weapon100 outfit waits first, then native equipItem equips the GM item during the natural window without replenishing HP.',
 supplies:'100 white potions; native auto-buy to 100; potion threshold 75%; native haste/class/blue potions enabled. No manually selected polymorph, cards, dolls or manually granted invulnerability; native equipment-forced transformations remain active.',
 skills:'All class/level-legal skills learned; one legal mastery before rebirth, native all-masteries after rebirth. Mage auto-casts tornado; legal healing selected at 70% HP. Listed safe buffs use native automatic casts.',
 party:'One knight leader plus 3 knights, 4 elves, 4 mages and 4 illusionists, all level150 reborn; 15 allies instantiated by native buildAlly from isolated test saves.',
 measurement:'Read/write-transparent HP observers record bounded HP loss, native recovery, raw single-hit loss and minimum HP. Net DPS=(actual HP loss-native enemy recovery)/elapsed game time. Overkill is excluded from applied damage.',
 limitation:'One fixed seed per configuration is a reproducible scenario, not a statistical estimate of win probability. Lair tests begin in the final room, retaining all seven native stages and mechanics.'},
 sourceStart:fingerprint(),results:[]};
function save(){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
const browser=await testBrowser();
try{
 for(const cfg of cases){
  const {page,errors,close}=await browser.page(),started=Date.now(),caseSourceStart=fingerprint();let result;
  try{
   await page.evaluate(code=>window.__balanceProfile=eval('('+code+')'),createProfile.toString());
   result=await page.evaluate(cfg=>{
    const R=AFK_RELIC_RUNTIME,rows=[],friendlyRows=[],seen=new WeakMap(),friendSeen=new WeakSet(),scope=[],reflectionWindows=[],reflectionHits=[],windowSeen=new WeakSet();
    const totals={loss:0,recovery:0,bossLoss:0,bossRecovery:0,maxRawHit:0,maxAppliedHit:0,reflectionHpLoss:0,reflectionEvents:0,reflectionIncoming:0,reflectionAfterDefense:0,reflectionCalls:0,reflectionMaxIncoming:0,reflectionMaxAfterDefense:0,healing:0};
    const checks=[],deaths=[],recent=[],bigHits=[];let completed=false,started=false,firstBoss=null,terminalDeath=null,gmEquipped=null;
    // Optional, read-only diagnosis of a native fatal hit. Never adds defenses,
    // probes a cooldown, changes RNG, or changes the original return values.
    const defenseTrace=[],cooldownSuccesses=[],cooldownUntil=new Map(),preDefense=new WeakMap();
    function defensiveState(actor){
     const now=state.ticks/10,shields=R.state(actor,'_shields'),buffs=R.state(actor,'_buffs'),tail=R.state(actor,'relic_bluetail_tail');
     return{seconds:now,maxHp:actor.mhp,hp:actor===player?actor.hp:actor.curHp,
      shields:Object.entries(shields).map(([source,x])=>({source,amount:x.amount,until:x.until,active:x.until>now&&x.amount>0,kind:x.kind||null})),
      invulnerability:Object.entries(buffs).filter(([,x])=>x.values&&x.values.invulnerable).map(([source,x])=>({source,until:x.until,active:x.until>now})),
      tail:{used:!!tail.tailUsed,deathReadyAt:tail.tailDeathNext||0,deathCooldownRemaining:Math.max(0,(tail.tailDeathNext||0)-now),cleanseReadyAt:tail.tailCleanseNext||0,healReadyAt:cooldownUntil.get('relic_bluetail_tail:heal')||0,healCooldownRemaining:Math.max(0,(cooldownUntil.get('relic_bluetail_tail:heal')||0)-now)}};
    }
    if(cfg.traceDefense){
     const originalCooldown=R.api.cooldown;R.api.cooldown=function(actor,source,key,seconds){const out=originalCooldown.apply(this,arguments);if(out&&actor===player){const row={seconds:state.ticks/10,source,key,duration:seconds,readyAt:state.ticks/10+Math.max(0,Number(seconds)||0)};cooldownUntil.set(source+':'+key,row.readyAt);cooldownSuccesses.push(row);}return out;};
     const originalIncoming=R.incoming;R.incoming=function(actor,amount,attacker,opt){const before=actor===player&&opt&&opt.origin==='reflection'?defensiveState(actor):null;const out=originalIncoming.apply(this,arguments);if(before){const pending=R.state(actor,'_incoming').pending;if(pending)preDefense.set(pending,before);}return out;};
    }

    const idOf=id=>R.byId[id].key;
    function itemId(id,stage){if(typeof id==='string'&&id.startsWith('9999'))return id;const key=idOf(id),base=DB.items[key],n=stage===1?5:stage===2?10:base.type==='acc'?10:15,asc=stage>=3?(id===29?0:stage===4?5:0):null,id2=__afkRelicPlus.makeId(key,n,null,asc);__afkRelicPlus.ensure(id2);return id2;}
    function equipment(c){
     const magic=c.cls==='mage'||c.cls==='illusion',ranged=c.cls==='elf';
     const ids={wpn:c.weapon,tshirt:134,cloak:151,armor:magic?158:ranged?170:157,gloves:magic?135:ranged?140:137,helm:220,boots:205,shin:190,ring1:227,ring2:229,ear1:233,belt:240,amulet:c.cls==='mage'?248:247};
     const eq=Object.fromEntries(Object.entries(ids).map(([slot,id])=>[slot,itemId(id,c.stage)]));
     const d=DB.items[eq.wpn];if(!d.w2h)eq.shield=itemId(magic?178:185,c.stage);
     if(ranged)eq.arrow='wpn_22';if(c.gm==='99998')eq.armor='99998';return eq;
    }
    const buffs=['sk_shield','sk_shield2','sk_dex_up','sk_str_up','sk_bless_wpn','sk_reduction_armor','sk_solid_shield','sk_counter_barrier','sk_illu_ogre','sk_illu_lich','sk_illu_golem','sk_illu_endure','sk_illu_avatar'];
    function setup(c,index=0){
     __balanceProfile({cls:c.cls,lv:c.lv,rebirth:c.rebirth,eq:equipment(c),seed:c.seed+index});
     player.name='Balance '+c.cls+' '+index;player.enSeed='relic-balance-'+c.seed+'-'+index;player.mastery={knight:'k_counter',mage:'m_resonance',elf:'e_rapid',illusion:'i_qigu'}[c.cls];
     player.masteryQuest='done';player.skills=Object.keys(DB.skills).filter(id=>{const n=skillReqLv(DB.skills[id],id);return Number.isFinite(n)&&n<=player.lv;});
     player.gold=1000000;player.autoSellOn=false;player.pvpOn=false;player.elfEle='water';
     const heal=c.cls==='mage'?'sk_full_heal':c.cls==='elf'?'sk_heal2':c.cls==='knight'?'sk_heal1':'';
     player.config={selAtkSkill:c.cls==='mage'?'sk_tornado':'',selHealSkill:heal,setHpPot:75,setMpHeal:70,setMpAtk:0};
     if(c.cls==='elf')player.eq.arrow={id:'wpn_22',cnt:1000,en:0,uid:'balance-arrow-'+index};
     gainItem('potion_ult',100,true,true);recomputeStats();player.hp=player.mhp;player.mp=player.mmp;
     if(!c.rebirth)for(const [slot,e]of Object.entries(player.eq)){if(!e)continue;const d=DB.items[e.id];if(d.req&&d.req!=='all'&&!d.req.split(',').includes(c.cls))throw Error('Illegal '+c.cls+' '+slot+' '+d.n);}
     if(DB.items[player.eq.wpn.id].w2h&&player.eq.shield)throw Error('Two-handed weapon equipped with shield');
     return player;
    }
    if(cfg.party){
     const members=[...Array(3).fill(['knight',100]),...Array(4).fill(['elf',41]),...Array(4).fill(['mage',129]),...Array(4).fill(['illusion',33])];
     members.forEach(([cls,weapon],i)=>{const p=setup({...cfg,cls,weapon,gm:null},i+1);_lzSet('lineage_idle_save_'+(i+2),JSON.stringify({p}));});
    }
    setup(cfg.gmEquipOnReflection?{...cfg,gm:null,weapon:100}:cfg);currentSlot='1';
    if(cfg.party)for(let i=2;i<=16;i++){const ally=buildAlly(String(i));if(!ally)throw Error('Native buildAlly failed '+i);ally._potHpPct=75;ally._healHpPct=70;ally._healSkill=ally.cls==='mage'?'sk_full_heal':ally.cls==='elf'?'sk_heal2':'';player.allies.push(ally);}
    if(player.allies.length>allyActiveCap())throw Error('Party exceeds native ally cap');
    renderSkillSelects();
    const set=(id,value)=>{const e=document.getElementById(id);if(!e)throw Error('Missing control '+id);if(typeof value==='boolean')e.checked=value;else e.value=String(value);};
    set('set-pot','potion_ult');set('set-hp-pot',75);set('set-auto-buy-pot',true);set('set-auto-buy-arrow',true);set('set-mp-atk',0);set('set-mp-heal',70);set('sel-atk-skill',cfg.cls==='mage'?'sk_tornado':'');set('sel-heal-skill',player.config.selHealSkill);set('sel-convert-skill','');
    for(const id of ['set-haste','set-brave','set-blue','set-cautious','set-elfcookie'])set(id,true);
    for(const id of ['set-poly','set-magicbarrier','set-teleport'])set(id,false);
    document.querySelectorAll('[id^="auto-sk-"]').forEach(e=>e.checked=buffs.includes(e.id.slice(8)));
    recomputeStats();player.hp=player.mhp;player.mp=player.mmp;state.ff=true;state.running=false;
    function detail(a){return{name:a.name||a._allyName,cls:a.cls,lv:a.lv,rebirth:a.rebirth,base:a.base,alloc:a.alloc,mastery:a.mastery,skills:a.skills.length,hp:a.mhp,mp:a.mmp,stats:JSON.parse(JSON.stringify(a.d)),equipment:Object.fromEntries(Object.entries(a.eq).filter(([,e])=>e).map(([slot,e])=>[slot,{id:e.id,name:DB.items[e.id].n,req:DB.items[e.id].req,stage:DB.items[e.id].relicWeaponStage??DB.items[e.id].relicDefenseStage}]))};}
    const initial={leader:detail(player),allies:player.allies.map(detail),allyCap:allyActiveCap()};
    function recordHit(m,raw,actual){if(!(actual>0))return;totals.loss+=actual;if(m.boss)totals.bossLoss+=actual;totals.maxRawHit=Math.max(totals.maxRawHit,raw);totals.maxAppliedHit=Math.max(totals.maxAppliedHit,actual);const a=R.action();if(raw>=totals.maxRawHit){bigHits.push({seconds:state.ticks/10,target:m.n,raw,actual,source:a&&a.source,origin:a&&a.origin});if(bigHits.length>12)bigHits.shift();}}
    function observeMob(m){
     if(!m||seen.has(m))return;const row={name:m.n,id:Object.keys(DB.mobs).find(k=>DB.mobs[k].n===m.n),boss:!!m.boss,stage:m._afkDragonStage||null,maxHp:m.hp,spawnedAt:state.ticks/10,transformedAt:null,defeatedAt:null,lockedAt:null};rows.push(row);seen.set(m,row);if(m.boss&&!firstBoss)firstBoss=m;
     let value=m.curHp;Object.defineProperty(m,'curHp',{enumerable:true,configurable:true,get(){return value;},set(v){const old=value;value=v;if(!started||!Number.isFinite(v)||!Number.isFinite(old))return;if(v<old)recordHit(m,old-v,Math.max(0,Math.min(old,old-v)));else if(v>old){const n=Math.max(0,v)-Math.max(0,old);totals.recovery+=n;if(m.boss)totals.bossRecovery+=n;}}});
    }
    function observeFriendly(a){
     if(friendSeen.has(a))return;friendSeen.add(a);const field=a===player?'hp':'curHp',row={name:a.name||a._allyName,maxHp:a.mhp,minHp:a[field],damage:0,healing:0,reflectionLoss:0};friendlyRows.push(row);let value=a[field];
     Object.defineProperty(a,field,{enumerable:true,configurable:true,get(){return value;},set(v){const old=value;value=v;if(!started||!Number.isFinite(v)||!Number.isFinite(old))return;row.minHp=Math.min(row.minHp,Math.max(0,v));if(v<old){const loss=Math.max(0,Math.min(old,old-v)),pending=R.state(a,'_incoming').pending,source=pending&&Math.abs((old-v)-pending.damage)<1e-7?{kind:pending.origin||pending.kind,damageType:pending.kind,dotKind:pending.dotKind,enemy:pending.attacker&&pending.attacker.n}:scope.at(-1)||{kind:'environment/status'};row.damage+=loss;const event={seconds:state.ticks/10,actor:row.name,amount:loss,raw:old-v,...source};recent.push(event);if(recent.length>15)recent.shift();if(scope.some(s=>s.kind==='reflection')){totals.reflectionHpLoss+=loss;totals.reflectionEvents++;row.reflectionLoss+=loss;}if(cfg.traceDefense&&a===player&&(source.kind==='reflection'||old>0&&v<=0))defenseTrace.push({...event,hpBefore:old,hpAfter:v,incoming:pending&&pending.snapshot,afterDefense:pending&&pending.damage,preDefense:pending&&preDefense.get(pending)||null,postDefense:defensiveState(a)});if(old>0&&v<=0)deaths.push(event);}else{row.healing+=v-old;totals.healing+=v-old;}}});
    }
    [player,...player.allies].forEach(observeFriendly);
    R.observe((kind,c)=>{if(!started||kind!=='hurt'||c.origin!=='reflection')return;totals.reflectionIncoming+=c.snapshot||0;totals.reflectionAfterDefense+=c.damage||0;totals.reflectionCalls++;totals.reflectionMaxIncoming=Math.max(totals.reflectionMaxIncoming,c.snapshot||0);totals.reflectionMaxAfterDefense=Math.max(totals.reflectionMaxAfterDefense,c.damage||0);reflectionHits.push({seconds:state.ticks/10,actor:c.actor.name||c.actor._allyName,enemy:c.attacker&&c.attacker.n,kind:c.kind,incoming:c.snapshot,afterDefense:c.damage,hpBefore:c.hpBefore,actualDamage:c.actualDamage});if(reflectionHits.length>60)reflectionHits.shift();});
    function wrap(name,handler){const original=window[name];if(typeof original==='function')window[name]=function(...args){return handler(original,this,args);};}
    wrap('killPlayer',(old,self,args)=>{const dead=player.dead,hp=player.hp,out=old.apply(self,args);if(!dead&&player.dead)terminalDeath={...(recent.at(-1)||{}),seconds:state.ticks/10,hpAtDeathCall:hp};return out;});
    wrap('spawnMob',(old,self,args)=>{const out=old.apply(self,args);mapState.mobs.forEach(observeMob);return out;});
    wrap('doMobTransform',(old,self,args)=>{const before=mapState.mobs[args[0]],out=old.apply(self,args),after=mapState.mobs[args[0]];if(before&&before!==after&&seen.has(before))seen.get(before).transformedAt=state.ticks/10;mapState.mobs.forEach(observeMob);return out;});
    wrap('killMob',(old,self,args)=>{const m=mapState.mobs[args[0]],out=old.apply(self,args);if(m&&m._dead&&seen.has(m)&&seen.get(m).defeatedAt==null){seen.get(m).defeatedAt=state.ticks/10;if(m===firstBoss&&!cfg.map.includes('lair')||m._afkDragonStage===7)completed=true;}mapState.mobs.forEach(observeMob);return out;});
    for(const [name,kind]of [['reflectWallOnDamage','reflection'],['enemyPhysicalAttack','enemy physical'],['enemyAttackAlly','enemy physical'],['applyMobMagic','enemy magic'],['applyMobMagicToAlly','enemy magic'],['useItem','item/backlash']])wrap(name,(old,self,args)=>{scope.push({kind,enemy:args[0]&&args[0].n,skill:args[1]&&args[1].skn});try{return old.apply(self,args);}finally{scope.pop();}});
    if(cfg.map.includes('lair')){state.antharas=4;state._afkDragon=(cfg.map.match(/^cr_(\w+)_lair$/)||[])[1]||null;enterOblivionMap(cfg.map);spawnMob(1);}
    else{
     if(cfg.map==='pride_f100')enterPrideFloor(100);else enterOblivionMap(cfg.map);
     const desired=cfg.map==='pride_f100'?'pride_reaper_boss':'afk_ttmi_220',pool=DB.maps[cfg.map].filter(id=>DB.mobs[id].boss),pos=pool.indexOf(desired);if(pos<0)throw Error('Required boss missing '+desired);
     const rand=Math.random;Math.random=()=> (pos+.5)/pool.length;mapState.forceBoss=true;try{spawnMob(1);}finally{Math.random=rand;}
     if(!mapState.mobs[1]||mapState.mobs[1].n!==DB.mobs[desired].n)throw Error('Wrong encounter selected');
    }
    mapState.targetIdx=1;mapState.mobs.forEach(observeMob);if(!firstBoss)throw Error('No native boss spawned');
    initial.encounter=rows.find(r=>r.boss);checks.push('native boss and legal equipment');
    R.invalidate();R.dispatch('battleStart',{actor:player,main:false});player.allies.forEach(a=>R.dispatch('battleStart',{actor:a,main:false}));
    let seed=cfg.seed>>>0;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    state.running=true;started=true;let ticks=0,holding=!!cfg.waitReflect,attackReleasedAt=null;
    if(holding)set('sel-atk-skill','');
    while(ticks<cfg.maxSeconds*10&&!player.dead&&!completed){
     if(holding){state.pDmgTick=-1000000;state.pOffDmgTick=-1000000;}
     tick();ticks++;mapState.mobs.forEach(m=>{observeMob(m);const row=seen.get(m);if(row&&m._afkLockUntil&&row.lockedAt==null)row.lockedAt=state.ticks/10;if(m&&m._reflectWall&&m._reflectWall.until>=state.ticks&&!windowSeen.has(m._reflectWall)){windowSeen.add(m._reflectWall);reflectionWindows.push({boss:m.n,stage:m._afkDragonStage||null,kind:m._reflectWall.kind,openedAt:state.ticks/10,until:m._reflectWall.until/10});}});
     if(holding&&mapState.mobs.some(m=>m&&m.curHp>0&&!m._dead&&m._reflectWall&&m._reflectWall.until>state.ticks&&m._reflectWall.kind===cfg.waitReflect)){holding=false;attackReleasedAt=state.ticks/10;if(cfg.gmEquipOnReflection){const hpBefore=player.hp;if(cfg.gm==='99999')unequipItem('wpn');gainItem(cfg.gm,1,true,true);const instance=player.inv.find(x=>x.id===cfg.gm);equipItem(instance);if(!(player.eq[cfg.gm==='99999'?'wpn':'armor']&&player.eq[cfg.gm==='99999'?'wpn':'armor'].id===cfg.gm))throw Error('Native GM equip failed');gmEquipped={at:state.ticks/10,hpBefore,hpAfter:player.hp,profile:detail(player)};}state.pDmgTick=playerAttackIntervalTicks(true);state.pOffDmgTick=0;set('sel-atk-skill',cfg.cls==='mage'?'sk_tornado':'');}
     if(!Number.isFinite(player.hp)||!Number.isFinite(player.mp)||!Number.isFinite(player.d.aspd))throw Error('Nonfinite player state at tick '+state.ticks);if(!state.running&&!player.dead)break;}
    started=false;state.running=false;const elapsed=state.ticks/10,net=Math.max(0,totals.loss-totals.recovery),bossNet=Math.max(0,totals.bossLoss-totals.bossRecovery);
    return{...cfg,status:completed?'cleared':player.dead?'dead':'timeout',elapsedSeconds:elapsed,clearSeconds:completed?elapsed:null,netDps:net/Math.max(.1,elapsed),bossNetDps:bossNet/Math.max(.1,elapsed),totals,bosses:rows.filter(r=>r.boss),enemyCount:rows.length,initial,friendly:friendlyRows,alliesAlive:player.allies.filter(a=>!a._downed&&a.curHp>0).length,finalHp:player.hp,finalMp:player.mp,finalMap:mapState.current,death:terminalDeath||(player.dead?deaths.filter(e=>e.actor===player.name).at(-1):null),transientHpZeroCrossings:deaths.length,recentDamage:recent,maxHitEvents:bigHits,...(cfg.traceDefense?{defenseDiagnostics:{hits:defenseTrace,cooldownSuccesses}}:{}),reflection:{windows:reflectionWindows,hits:reflectionHits,attackReleasedAt,engaged:totals.reflectionCalls>0,bypassed:totals.reflectionCalls===0&&reflectionWindows.length===0,holdUnreleased:holding,gmEquipped},checks};
   },cfg);
   result.pageErrors=errors;result.wallSeconds=(Date.now()-started)/1000;
   if(errors.length)result.status='error';
  }catch(e){result={...cfg,status:'error',error:String(e.stack||e),pageErrors:errors,wallSeconds:(Date.now()-started)/1000};}
  finally{await close();}
  result.sourceStart=caseSourceStart;result.sourceEnd=fingerprint();report.results.push(result);report.sourceEnd=result.sourceEnd;save();
  console.log(JSON.stringify({case:cfg.id,map:cfg.map,status:result.status,seconds:result.elapsedSeconds,dps:result.netDps&&Math.round(result.netDps),max:result.totals?.maxRawHit,minHp:result.friendly?.[0]?.minHp,reflect:result.totals?.reflectionHpLoss,reflectIncoming:result.totals?.reflectionIncoming,reflectCalls:result.totals?.reflectionCalls,release:result.reflection?.attackReleasedAt,stages:result.bosses?.map(b=>({s:b.stage,hp:b.maxHp,lock:b.lockedAt,end:b.transformedAt??b.defeatedAt})),error:result.error?.split('\n').slice(0,2).join(' ')}));
 }
}finally{await browser.close();}
report.completedAt=new Date().toISOString();report.summary={cases:report.results.length,cleared:report.results.filter(r=>r.status==='cleared').length,dead:report.results.filter(r=>r.status==='dead').length,timeout:report.results.filter(r=>r.status==='timeout').length,errors:report.results.filter(r=>r.status==='error').length};save();console.log(JSON.stringify({output,...report.summary}));
if(report.summary.errors)process.exitCode=1;
