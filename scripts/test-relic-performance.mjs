/** Native 480-tick relic performance and deterministic semantic comparison.
 * Fresh document per trial. Capture a source snapshot once, then use --overlay
 * only for the files under test; concurrent edits cannot contaminate the pair.
 *
 * --capture ../work/performance/base --mode audit
 * --snapshot ../work/performance/base --mode foreground --rates 1,4
 * --snapshot ../work/performance/base --overlay afk-relic-runtime.js --mode audit
 * --mode combat is a CPU-only diagnostic; foreground keeps render/VFX enabled.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createServer} from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createProfile} from './relic-test-browser.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const arg=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
const mode=arg('--mode','audit'),ticks=Number(arg('--ticks','480')),traceEvents=args.includes('--trace-events');
const snapshotDir=path.resolve(root,arg('--snapshot',arg('--capture','../work/performance/base')));
const output=path.resolve(root,arg('--out','../work/performance/'+mode+'.json'));
const comparePath=arg('--compare',''),comparison=comparePath?JSON.parse(fs.readFileSync(path.resolve(root,comparePath),'utf8')):null;
const overlay=arg('--overlay','').split(',').filter(Boolean),rates=arg('--rates',mode==='foreground'?'1,4':'1').split(',').map(Number);
const repeats=Number(arg('--repeat','1'));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function capture(){
  const files=['index.html',...fs.readdirSync(root).filter(f=>/\.(js|css|json)$/.test(f)&&fs.statSync(path.join(root,f)).isFile())];
  for(const dir of ['js','css'])for(const file of fs.readdirSync(path.join(root,dir)))if(/\.(js|css|json)$/.test(file))files.push(dir+'/'+file);
  fs.mkdirSync(snapshotDir,{recursive:true});const manifest={createdAt:new Date().toISOString(),files:{}};
  for(const file of files){const data=fs.readFileSync(path.join(root,file));fs.mkdirSync(path.dirname(path.join(snapshotDir,file)),{recursive:true});fs.writeFileSync(path.join(snapshotDir,file),data);manifest.files[file]=sha(data);}
  fs.writeFileSync(path.join(snapshotDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
const manifest=args.includes('--capture')?capture():JSON.parse(fs.readFileSync(path.join(snapshotDir,'manifest.json'),'utf8'));
const frozen=new Map(Object.keys(manifest.files).map(file=>[file,fs.readFileSync(path.join(snapshotDir,file))]));
for(const file of overlay){if(!frozen.has(file))throw Error('Overlay file missing from snapshot: '+file);frozen.set(file,fs.readFileSync(path.join(root,file)));}
// Serve frozen bytes at the HTTP layer. Playwright request interception itself
// changes renderer CPU costs (docs/perf-battery.md); neither trial uses a route.
async function performanceBrowser(){
  let pw;try{pw=await import('playwright');}catch(e){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw e;pw=await import(pathToFileURL(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.js')));}
  pw=pw.chromium?pw:pw.default;
  let launch={headless:true};
  if(process.env.CHROME_PATH)launch.executablePath=process.env.CHROME_PATH;
  else {try{const bundled=(await import('/tmp/relic-test-deps/node_modules/@sparticuz/chromium/build/index.js')).default;launch={...launch,executablePath:await bundled.executablePath(),args:bundled.args.filter(x=>x!=='--single-process')};}catch{}}
  const server=createServer((req,res)=>{
    const file=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\//,'')||'index.html',data=frozen.get(file);
    // The sparse repository does not contain graphics/audio. Block those at the
    // browser policy level, identically in both trials, with no per-request JS.
    const headers={'content-type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream',
      'content-security-policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src data:; media-src 'none'; font-src 'none'; connect-src 'self'; worker-src 'self' blob:"};
    res.writeHead(data?200:404,headers);res.end(data||'');
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;try{browser=await pw.chromium.launch(launch);}catch(e){server.close();throw e;}
  const url=`http://127.0.0.1:${server.address().port}/index.html`;
  return{async page(){
    const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e.stack||e)));
    await page.addInitScript(()=>{window.__testTimers=[];const old=window.setInterval;window.setInterval=function(){const id=old.apply(this,arguments);window.__testTimers.push(id);return id;};});
    await page.goto(url,{waitUntil:'load'});await page.waitForFunction(()=>!!window.AFK_RELIC_INTEGRATION);
    await page.evaluate(isForeground=>{state.running=false;stopGameTimers();if(!isForeground)window.__testTimers.forEach(clearInterval);state.ff=true;window.__testBasePlayer=freshPlayerState();},mode==='foreground');
    return{page,errors,close:()=>ctx.close()};
  },async close(){await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
let cases=[
  {id:'gm-99999-antharas',gm:'99999',map:'antharas_lair'},
  {id:'gm-99998-valakas',gm:'99998',map:'cr_valakas_lair'},
  {id:'party16-fafurion',party:16,map:'cr_fafurion_lair'},
  {id:'party16-lindvior',party:16,map:'cr_lindvior_lair'}
].map(c=>({...c,seed:20261022,cls:'knight',weapon:c.gm==='99999'?'99999':100,lv:150,rebirth:1,stage:4}));
if(arg('--case',''))cases=cases.filter(c=>c.id.includes(arg('--case','')));
const report={schema:1,createdAt:new Date().toISOString(),mode,ticks,rates,repeats,seed:20261022,
  sourceSnapshot:manifest.createdAt,overlay,sourceHashes:Object.fromEntries([...frozen].map(([file,data])=>[file,sha(data)])),
  environment:{browser:'Headless Chromium; visible foreground page; software GPU. Frozen source served by a local HTTP server, with no Playwright request interception. Image/media/fonts unavailable in the sparse checkout and blocked by CSP; this measures JS/layout, not complete device rendering or battery life.',foreground:'Native tick, settleDeadMobs and flushTickRender at 100ms scheduling, state.ff=false. Only automatic game/save timers are stopped to prevent a second combat clock; native sprite, VFX, UI intervals and rAF remain enabled.',audit:'Synchronous native ticks, state.ff=true. Same seeded combat RNG, ordered relic callback and damage/heal event digests, per-tick outcome digest and final combat state. Measurement-only wrappers preserve arguments, return values and execution order.'},results:[]};
function save(){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
function firstDifference(a,b,key='semantic'){
  if(a===b)return null;
  if(a==null||b==null||typeof a!=='object'||typeof b!=='object')return{key,before:a,after:b};
  for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const diff=firstDifference(a[k],b[k],key+'.'+k);if(diff)return diff;}
  return null;
}
function summarizeProfile(profile){
  const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map();for(const n of profile.nodes)for(const c of n.children||[])parents.set(c,n.id);
  const self=new Map(),total=new Map();let all=0;
  for(let i=0;i<(profile.samples||[]).length;i++){const id=profile.samples[i],dt=(profile.timeDeltas?.[i]||1000)/1000;all+=dt;self.set(id,(self.get(id)||0)+dt);let cur=id;while(cur){total.set(cur,(total.get(cur)||0)+dt);cur=parents.get(cur);}}
  const groups=new Map();for(const [id,n]of nodes){const f=n.callFrame,k=[f.functionName,f.url.replace(/^http:\/\/127\.0\.0\.1:\d+\//,''),f.lineNumber+1].join('|'),row=groups.get(k)||{name:f.functionName||'(anonymous)',file:f.url.replace(/^http:\/\/127\.0\.0\.1:\d+\//,''),line:f.lineNumber+1,selfMs:0,totalMs:0};row.selfMs+=self.get(id)||0;row.totalMs+=total.get(id)||0;groups.set(k,row);}
  const rows=[...groups.values()].map(r=>({...r,selfMs:+r.selfMs.toFixed(2),totalMs:+r.totalMs.toFixed(2),selfPct:+(r.selfMs/Math.max(1,all)*100).toFixed(2)}));
  return{sampledMs:all,samples:profile.samples?.length||0,self:rows.sort((a,b)=>b.selfMs-a.selfMs).slice(0,45),inclusive:rows.filter(r=>r.file).sort((a,b)=>b.totalMs-a.totalMs).slice(0,45)};
}

function setupNative(cfg){
  const R=AFK_RELIC_RUNTIME;
  function itemId(id){if(typeof id==='string'&&id.startsWith('9999'))return id;const key=R.byId[id].key,base=DB.items[key],n=base.type==='acc'?10:15,id2=__afkRelicPlus.makeId(key,n,null,id===29?0:5);__afkRelicPlus.ensure(id2);return id2;}
  function equipment(c){const magic=c.cls==='mage'||c.cls==='illusion',ranged=c.cls==='elf',ids={wpn:c.weapon,tshirt:134,cloak:151,armor:magic?158:ranged?170:157,gloves:magic?135:ranged?140:137,helm:220,boots:205,shin:190,ring1:227,ring2:229,ear1:233,belt:240,amulet:c.cls==='mage'?248:247};const eq=Object.fromEntries(Object.entries(ids).map(([slot,id])=>[slot,itemId(id)]));if(!DB.items[eq.wpn].w2h)eq.shield=itemId(magic?178:185);if(ranged)eq.arrow='wpn_22';if(c.gm==='99998')eq.armor='99998';return eq;}
  function setup(c,i=0){
    __perfCreateProfile({cls:c.cls,lv:c.lv,rebirth:c.rebirth,eq:equipment(c),seed:c.seed+i});
    player.name='Performance '+c.cls+' '+i;player.enSeed='relic-performance-'+c.seed+'-'+i;player.mastery={knight:'k_counter',mage:'m_resonance',elf:'e_rapid',illusion:'i_qigu'}[c.cls];player.masteryQuest='done';
    player.skills=Object.keys(DB.skills).filter(id=>{const n=skillReqLv(DB.skills[id],id);return Number.isFinite(n)&&n<=player.lv;});player.gold=1000000;player.autoSellOn=false;player.pvpOn=false;player.elfEle='water';
    player.config={selAtkSkill:c.cls==='mage'?'sk_tornado':'',selHealSkill:c.cls==='mage'?'sk_full_heal':c.cls==='elf'?'sk_heal2':c.cls==='knight'?'sk_heal1':'',setHpPot:75,setMpHeal:70,setMpAtk:0};
    if(c.cls==='elf')player.eq.arrow={id:'wpn_22',cnt:1000,en:0,uid:'perf-arrow-'+i};gainItem('potion_ult',100,true,true);recomputeStats();player.hp=player.mhp;player.mp=player.mmp;
    if(DB.items[player.eq.wpn.id].w2h&&player.eq.shield)throw Error('Invalid two-handed/shield fixture');return player;
  }
  if(cfg.party){const members=[...Array(3).fill(['knight',100]),...Array(4).fill(['elf',41]),...Array(4).fill(['mage',129]),...Array(4).fill(['illusion',33])];members.forEach(([cls,weapon],i)=>{const p=setup({...cfg,cls,weapon,gm:null},i+1);_lzSet('lineage_idle_save_'+(i+2),JSON.stringify({p}));});}
  setup(cfg);currentSlot='1';
  if(cfg.party)for(let i=2;i<=16;i++){const ally=buildAlly(String(i));if(!ally)throw Error('Native ally creation failed');ally._potHpPct=75;ally._healHpPct=70;ally._healSkill=ally.cls==='mage'?'sk_full_heal':ally.cls==='elf'?'sk_heal2':'';player.allies.push(ally);}
  if(player.allies.length>allyActiveCap())throw Error('Illegal party size');
  renderSkillSelects();const set=(id,value)=>{const e=document.getElementById(id);if(!e)throw Error('Missing control '+id);if(typeof value==='boolean')e.checked=value;else e.value=String(value);};
  set('set-pot','potion_ult');set('set-hp-pot',75);set('set-auto-buy-pot',true);set('set-auto-buy-arrow',true);set('set-mp-atk',0);set('set-mp-heal',70);set('sel-atk-skill','');set('sel-heal-skill',player.config.selHealSkill);set('sel-convert-skill','');
  for(const id of ['set-haste','set-brave','set-blue','set-cautious','set-elfcookie'])set(id,true);for(const id of ['set-poly','set-magicbarrier','set-teleport'])set(id,false);
  const buffs=['sk_shield','sk_shield2','sk_dex_up','sk_str_up','sk_bless_wpn','sk_reduction_armor','sk_solid_shield','sk_counter_barrier','sk_illu_ogre','sk_illu_lich','sk_illu_golem','sk_illu_endure','sk_illu_avatar'];document.querySelectorAll('[id^="auto-sk-"]').forEach(e=>e.checked=buffs.includes(e.id.slice(8)));
  recomputeStats();player.hp=player.mhp;player.mp=player.mmp;state.ff=true;state.running=false;state.antharas=4;state._afkDragon=(cfg.map.match(/^cr_(\w+)_lair$/)||[])[1]||null;enterOblivionMap(cfg.map);spawnMob(1);mapState.targetIdx=1;
  R.invalidate();R.dispatch('battleStart',{actor:player,main:false});player.allies.forEach(a=>R.dispatch('battleStart',{actor:a,main:false}));
  const creation=document.getElementById('creation-screen'),game=document.getElementById('game-screen');if(creation)creation.classList.add('hidden');if(game)game.classList.remove('hidden');state.ff=false;renderMobs();updateUI();renderTabs(true);state.ff=cfg.mode!=='foreground';
  let seed=cfg.seed>>>0,rngCalls=0;Math.random=()=>{rngCalls++;seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  let eventHash=2166136261,outcomeHash=2166136261,callbackHash=2166136261,events=0,callbacks=0;const counts={},callbackCounts={},durations=[],eventRows=[],tickHashes=[],entityIds=new WeakMap();let entitySeq=0;
  const hash=(h,s)=>{for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
  const eid=e=>{if(!e||typeof e!=='object')return null;if(!entityIds.has(e))entityIds.set(e,++entitySeq);return entityIds.get(e);};[player,...player.allies,...mapState.mobs.filter(Boolean)].forEach(eid);
  const digest=(c)=>[state.ticks,eid(c.actor),eid(c.target),c.source||c.sourceId||null,c.origin||null,c.kind||null,c.skillId||null,c.amount??c.damage??null,c.actual??c.actualDamage??null,c.snapshot??null,c.stage??null,c.critical??null,c.heavy??null];
  if(cfg.mode==='audit'){
    R.observe((kind,c)=>{events++;counts[kind]=(counts[kind]||0)+1;const row=JSON.stringify([kind,...digest(c)]);eventHash=hash(eventHash,row);if(cfg.traceEvents)eventRows.push(row);});
    for(const [label,mod]of [['w',AFK_RELIC_WEAPONS],['d',AFK_RELIC_DEFENSE]]){const old=mod.dispatch;mod.dispatch=function(event,c,api){callbacks++;const k=label+':'+c.catalogId+':'+event;callbackCounts[k]=(callbackCounts[k]||0)+1;callbackHash=hash(callbackHash,JSON.stringify([k,state.ticks,eid(c.actor),eid(c.target),c.damage,c.amount,c.origin]));return old.apply(this,arguments);};}
  }
  const leanActor=a=>({name:a.name||a._allyName,cls:a.cls,lv:a.lv,hp:a.curHp??a.hp,mp:a.curMp??a.mp,mhp:a.mhp,mmp:a.mmp,dead:!!a.dead,downed:!!a._downed,stats:a.d,statuses:a.statuses,buffs:a.buffs,cds:a.cds,eq:Object.fromEntries(Object.entries(a.eq||{}).filter(([,e])=>e).map(([s,e])=>[s,{id:e.id,en:e.en,cnt:e.cnt}])),inv:(a.inv||[]).map(e=>({id:e.id,en:e.en,cnt:e.cnt})),gold:a.gold});
  function finalState(){return{ticks:state.ticks,map:mapState.current,running:state.running,leader:leanActor(player),allies:player.allies.map(leanActor),mobs:mapState.mobs.map(m=>m&&({name:m.n,stage:m._afkDragonStage,hp:m.curHp,maxHp:m.hp,dead:!!m._dead,lock:m._afkLockUntil,st:m.st,marks:[m._wetUntil,m._afkScorch,m._afkMud,m._afkErode,m._afkExpose],dots:(m._relicDots||[]).map(d=>({kind:d.kind,source:d.source,damage:d.damage,until:d.until,next:d.next,ascended:d.ascended,owner:eid(d.owner)}))})),summons:(player.summons||[]).map(e=>({name:e.n,hp:e.curHp??e.hp,mp:e.curMp??e.mp,skId:e.skId})),pets:(player.pets||[]).map(e=>({name:e.n,hp:e.curHp??e.hp,lv:e.lv})),rngCalls,rngSeed:seed};}
  function step(){
    const start=performance.now();state.inTick=true;try{tick();}finally{state.inTick=false;settleDeadMobs();}flushTickRender();durations.push(performance.now()-start);
    if(cfg.mode==='audit')outcomeHash=hash(outcomeHash,JSON.stringify([state.ticks,player.hp,player.mp,player.dead,player.allies.map(a=>[a.curHp,a.curMp,a._downed]),mapState.mobs.map(m=>m&&[m.n,m.curHp,m._afkDragonStage,m._afkLockUntil]),rngCalls]));
    if(cfg.traceEvents)tickHashes.push([state.ticks,eventHash,callbackHash]);
    if(!Number.isFinite(player.hp)||!Number.isFinite(player.mp)||!Number.isFinite(player.d.aspd))throw Error('Nonfinite combat state');
  }
  state.running=true;
  window.__perfRun=async function(){const setupRngCalls=rngCalls;seed=cfg.seed>>>0;rngCalls=0;const started=performance.now();if(cfg.mode==='foreground')await new Promise((resolve,reject)=>{let n=0;const timer=setInterval(()=>{try{step();if(++n>=cfg.ticks){clearInterval(timer);resolve();}}catch(e){clearInterval(timer);reject(e);}},100);});else for(let i=0;i<cfg.ticks;i++)step();const elapsed=performance.now()-started;state.running=false;const values=durations.slice().sort((a,b)=>a-b),p=q=>values[Math.min(values.length-1,Math.floor(values.length*q))];return{case:cfg.id,map:cfg.map,mode:cfg.mode,setupRngCalls,ticks:durations.length,elapsedMs:elapsed,actualGameTicks:state.ticks,visibility:document.visibilityState,tickMs:{p50:p(.5),p95:p(.95),p99:p(.99),max:p(1),mean:values.reduce((a,b)=>a+b,0)/values.length,total:values.reduce((a,b)=>a+b,0),over100:values.filter(v=>v>100).length},semantic:{eventHash:eventHash.toString(16),callbackHash:callbackHash.toString(16),outcomeHash:outcomeHash.toString(16),events,callbacks,counts,callbackCounts,final:finalState()},durations,...(cfg.traceEvents?{trace:{eventRows,tickHashes}}:{})};};
  return{sourceCount:R.sources(player).length,partySize:1+player.allies.length,hp:player.mhp,mp:player.mmp,seed:cfg.seed,gameScreenVisible:!!game&&!game.classList.contains('hidden')};
}

const browser=await performanceBrowser();
try{
 for(const cfg of cases)for(const rate of rates)for(let repeat=0;repeat<repeats;repeat++){
  const {page,errors,close}=await browser.page();let session;
  try{
   await page.bringToFront();await page.setViewportSize({width:1280,height:900});await page.evaluate(code=>window.__perfCreateProfile=eval('('+code+')'),createProfile.toString());
   const fixture=await page.evaluate(setupNative,{...cfg,mode,ticks,traceEvents});
   session=await page.context().newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate});await session.send('Performance.enable');
   const metricsBefore=(await session.send('Performance.getMetrics')).metrics;
   if(mode!=='audit'){await session.send('Profiler.enable');await session.send('Profiler.setSamplingInterval',{interval:1000});await session.send('Profiler.start');}
   const result=await page.evaluate(()=>__perfRun());
   const metricsAfter=(await session.send('Performance.getMetrics')).metrics;
   result.metrics=Object.fromEntries(metricsAfter.filter(m=>['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','ProcessTime','ThreadTime','JSHeapUsedSize','JSHeapTotalSize','Nodes','LayoutCount','RecalcStyleCount'].includes(m.name)).map(m=>[m.name,m.value-(metricsBefore.find(x=>x.name===m.name)?.value||0)]));
   if(mode!=='audit'){const {profile}=await session.send('Profiler.stop');result.cpu=summarizeProfile(profile);const file=path.join(path.dirname(output),path.basename(output,'.json')+'-'+cfg.id+'-'+rate+'x-'+repeat+'.cpuprofile');fs.writeFileSync(file,JSON.stringify(profile));result.profileFile=file;}
   result.rate=rate;result.repeat=repeat;result.fixture=fixture;result.pageErrors=errors;result.semantic.sha256=sha(JSON.stringify(result.semantic));
   if(comparison){const before=comparison.results.find(r=>r.case===cfg.id&&r.rate===rate&&r.repeat===repeat);if(!before)throw Error('Missing comparison case '+cfg.id);result.equivalence={equal:before.semantic.sha256===result.semantic.sha256,before:before.semantic.sha256,after:result.semantic.sha256,difference:before.semantic.sha256===result.semantic.sha256?null:firstDifference(before.semantic,JSON.parse(JSON.stringify(result.semantic)))};}
   report.results.push(result);save();
   console.log(JSON.stringify({case:cfg.id,mode,rate,repeat,p50:result.tickMs.p50,p95:result.tickMs.p95,total:result.tickMs.total,elapsed:result.elapsedMs,semantic:result.semantic.sha256,errors:errors.length,hot:result.cpu?.self.slice(0,5)}));
  }finally{if(session)await session.detach();await close();}
 }
}finally{await browser.close();}
report.completedAt=new Date().toISOString();save();
if(report.results.some(r=>r.pageErrors.length||r.ticks!==ticks||r.actualGameTicks!==ticks||r.equivalence&&!r.equivalence.equal))process.exitCode=1;
