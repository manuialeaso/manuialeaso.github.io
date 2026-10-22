/** Isolated logging equivalence and renderer A/B.
 * Default: cheap deterministic VM checks, no browser. --browser adds native
 * scroll-lock/selection checks and fresh-page fixed-input renderer measurements.
 * The frozen fixture is the original production logging block; the candidate
 * block and native log/scroll functions are extracted from current source.
 * No combat, unrelated UI, timer cadence, or message producer is benchmarked.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const original=fs.readFileSync(path.join(root,'scripts/fixtures/perf-log-baseline.js'),'utf8');
const source=fs.readFileSync(path.join(root,'afk-perf.js'),'utf8');
const begin=source.indexOf('(function () {');
const finish=source.indexOf('  // ─────────────────',source.indexOf('window.__afkPerfFlushLogs = flushAll;'));
assert.ok(begin>=0&&finish>begin,'production log-section anchors exist');
const optimized=source.slice(begin,finish)+'})();\n';
const hash=s=>createHash('sha256').update(s).digest('hex');
const report={methodology:'Frozen original logging block versus current production block. Same queued HTML, native caps and lock semantics. Fixed input; no combat speed or visual degradation changes.',hashes:{original:hash(original),optimized:hash(optimized)},unit:[],browser:[],benchmark:[]};
const ids=['combat-log','sys-log','world-log'];
const flags=['_combatLogLocked','_sysLogLocked','_worldLogLocked'];

function sandbox(code,options={}){
  const trace=[],tasks=[],nodes={};let serial=0;
  class Element {
    constructor(id){this.id=id;this.nodes=[];this._top=0;this.visible=true;this.clientHeight=66;this.classes=new Set(['hidden']);this.classList={add:(...x)=>x.forEach(v=>this.classes.add(v)),remove:(...x)=>x.forEach(v=>this.classes.delete(v))};}
    get children(){return this.nodes.filter(n=>n.nodeType===1);}
    get firstChild(){return this.nodes[0];}
    insertAdjacentHTML(where,html){assert.equal(where,'beforeend');trace.push(['dom',this.id,html]);html.split(/(?=<div class="log-entry )/).filter(Boolean).forEach(html=>this.nodes.push({nodeType:1,html,identity:++serial}));}
    removeChild(node){assert.equal(node,this.nodes[0]);trace.push(['remove',this.id,node.identity]);this.nodes.shift();}
    get scrollHeight(){trace.push(['read',this.id]);if(this.failRead)throw Error('fixture layout read failure');return this.visible?this.children.length*22:0;}
    get scrollTop(){return this._top;}
    set scrollTop(v){trace.push(['scroll',this.id,v]);if(this.failScroll)throw Error('fixture scroll write failure');this._top=Math.max(0,Math.min(Number(v)||0,(this.visible?this.children.length*22:0)-this.clientHeight));}
  }
  ids.concat('logtab-dot-sys').forEach(id=>nodes[id]=new Element(id));
  const enabled={perf:true,'perf-log':true,'perf-render':true,...options};
  const e={state:{ff:false},COMBAT_LOG_MAX:50,COMBAT_LOG_MAX_LOCKED:150,SYS_LOG_MAX:50,SYS_LOG_MAX_LOCKED:150,WORLD_LOG_MAX:60,WORLD_LOG_MAX_LOCKED:200,_combatLogLocked:false,_sysLogLocked:false,_worldLogLocked:false,_combatSrc:null,_logTab:'combat',logCombat(){},logSys(){},logWorld(){},AFK_TOGGLES:{enabled:id=>!!enabled[id]},document:{hidden:false,getElementById:id=>nodes[id]||null,addEventListener(){}},setTimeout:(fn,ms)=>(tasks.push({kind:'timer',fn,ms}),tasks.length),requestAnimationFrame:fn=>(tasks.push({kind:'raf',fn}),tasks.length),console:{log(){}}};
  e.window=e;vm.runInNewContext(code,e);
  return {e,nodes,trace,tasks,enabled,Element,snapshot(){return {panes:Object.fromEntries(ids.map(id=>[id,nodes[id]?{children:nodes[id].nodes.map(n=>({html:n.html,identity:n.identity,nodeType:n.nodeType})),top:nodes[id]._top}:null])),locked:flags.map(f=>e[f]),dot:[...nodes['logtab-dot-sys'].classes].sort(),scheduled:tasks.map(t=>({kind:t.kind,ms:t.ms??null}))};}};
}
function emit(t,n,prefix='wave'){
  for(let i=0;i<n;i++){
    t.e._combatSrc=i%2?'mercenary':'pet';
    t.e.logCombat('<span data-seq="'+prefix+'-'+i+'">測試 &amp; '+i+'</span>',i%3===0?'player-crit':i%3===1?'magic':'enemy',i%5===0?'summon':null);
    t.e.logSys('<span>'+prefix+' 道具 '+i+'</span>',i===n-1?'relic':null);
    t.e.logWorld('<em>'+prefix+' 世界 '+i+'</em>','text-amber-300');
  }
}
function unitCase(name,run){
  const baseline=sandbox(original),candidate=sandbox(optimized);
  run(baseline);run(candidate);assert.deepEqual(candidate.snapshot(),baseline.snapshot(),name);
  // The same exact inserts/removals preserve retained-node identity. Layout
  // reads and scroll writes are intentionally reordered, not silently dropped.
  const changes=t=>t.trace.filter(r=>r[0]==='dom'||r[0]==='remove');
  assert.deepEqual(changes(candidate),changes(baseline),name+' DOM operations');
  report.unit.push({name});
  return {baseline,candidate};
}

const order=unitCase('three-channel HTML, sources, classifications, ordering and normal caps',t=>{emit(t,220);t.e.__afkPerfFlushLogs();});
const reads=order.candidate.trace.map((r,i)=>r[0]==='read'?i:-1).filter(i=>i>=0),writes=order.candidate.trace.map((r,i)=>r[0]==='scroll'?i:-1).filter(i=>i>=0),mutations=order.candidate.trace.map((r,i)=>r[0]==='dom'||r[0]==='remove'?i:-1).filter(i=>i>=0);
assert.equal(reads.length,3);assert.equal(writes.length,3);assert.ok(Math.max(...mutations)<Math.min(...reads));assert.ok(Math.max(...reads)<Math.min(...writes));
assert.deepEqual(ids.map(id=>order.candidate.nodes[id].children.length),[50,50,60]);
report.unit.push({name:'all DOM mutations precede all layout reads, which precede all auto-scroll writes'});
unitCase('locked history caps and scroll position survive repeated clipping',t=>{flags.forEach(f=>t.e[f]=true);emit(t,175);t.e.__afkPerfFlushLogs();ids.forEach(id=>t.nodes[id]._top=77);emit(t,85,'next');t.e.__afkPerfFlushLogs();assert.deepEqual(ids.map(id=>t.nodes[id].children.length),[150,150,200]);assert.ok(!t.trace.some(r=>r[0]==='read'||r[0]==='scroll'));});
unitCase('retained existing nodes, source context and lock changes before flush',t=>{emit(t,20);t.e.__afkPerfFlushLogs();flags.forEach(f=>t.e[f]=true);emit(t,130,'locked');t.e._combatLogLocked=false;t.e.__afkPerfFlushLogs();t.e._sysLogLocked=false;emit(t,5,'unlock');t.e.__afkPerfFlushLogs();});
unitCase('hidden panes, missing elements and per-channel layout failures stay isolated',t=>{t.nodes['sys-log'].visible=false;t.nodes['combat-log'].failRead=true;emit(t,5);t.e.__afkPerfFlushLogs();delete t.nodes['world-log'];t.nodes['combat-log'].failRead=false;emit(t,5,'missing');t.e.__afkPerfFlushLogs();});
unitCase('scroll setter failure does not suppress another channel',t=>{t.nodes['combat-log'].failScroll=true;emit(t,5);t.e.__afkPerfFlushLogs();assert.ok(t.nodes['world-log']._top>0);});
unitCase('catch-up suppresses all messages; rare system unread dot stays immediate',t=>{t.e.state.ff=true;emit(t,10);assert.equal(t.tasks.length,0);t.e.state.ff=false;t.e.logSys('<b>傳說</b>','legend');assert.ok(t.nodes['logtab-dot-sys'].classes.has('logtab-dot-legend'));assert.equal(t.nodes['sys-log'].children.length,0);t.e.__afkPerfFlushLogs();});
unitCase('foreground timer and rAF scheduling remain coalesced',t=>{emit(t,5);assert.equal(t.tasks.length,1);assert.equal(t.tasks[0].ms,200);t.tasks[0].fn();assert.equal(t.tasks[1].kind,'raf');t.tasks[1].fn();assert.equal(t.nodes['combat-log'].children.length,5);});
unitCase('background timer fallback retains exact timing and queue bounds',t=>{t.e.document.hidden=true;emit(t,200);assert.equal(t.tasks.length,1);assert.equal(t.tasks[0].ms,250);t.tasks[0].fn();assert.equal(t.nodes['world-log'].children.length,60);});
for(const key of ['perf','perf-log']){for(const code of [original,optimized]){const t=sandbox(code,{[key]:false});assert.equal(t.e.__afkPerfFlushLogs,undefined);}report.unit.push({name:key+' disabled does not install the logger'});}
const schedule=s=>s.slice(s.indexOf('    var schedule = function'),s.indexOf('    // 與核心'));
assert.equal(schedule(optimized),schedule(original));report.unit.push({name:'flush scheduling and enqueue source text are byte-for-byte unchanged'});
console.log('Logging semantic unit checks passed: '+report.unit.length+'.');

// Browser comparisons are opt-in so shared CPU measurements can finish first.
if(process.argv.includes('--browser')){
  let pw;try{pw=await import('playwright');}catch(e){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw e;pw=await import(pathToFileURL(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.js')));}
  pw=pw.chromium?pw:pw.default;
  let launch={headless:true};
  if(process.env.CHROME_PATH)launch.executablePath=process.env.CHROME_PATH;
  else {const bundled=(await import('/tmp/relic-test-deps/node_modules/@sparticuz/chromium/build/index.js')).default;launch={...launch,executablePath:await bundled.executablePath(),args:bundled.args.filter(a=>a!=='--single-process')};}
  const browser=await pw.chromium.launch(launch);
  const core=fs.readFileSync(path.join(root,'js/01-drops-config.js'),'utf8');
  const a=core.indexOf('let _combatLogLocked = false;'),b=core.indexOf('// 🔧 架構#4：calcStats',a);assert.ok(a>=0&&b>a);
  const native=core.slice(a,b);
  const fixture=`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#172033;color:#eee;font:14px/20px sans-serif}.logs{display:flex;gap:10px}.pane{width:310px;height:150px;overflow:auto;padding:4px;border:1px solid #64748b;contain:content}.log-entry{line-height:20px;min-height:20px}.hidden{display:none!important}button{font:inherit}.cf-hide-pet>[data-src="pet"]{display:none}</style><div class="logs">${ids.map(id=>'<div><div id="'+id+'" class="pane"></div><button id="'+id+'-unlock" class="hidden">回到底部</button></div>').join('')}</div><span id="logtab-dot-sys" class="hidden"></span>`;
  async function freshPage(variant){
    const context=await browser.newContext({viewport:{width:1100,height:750},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e.stack||e)));await page.setContent(fixture);
    await page.addScriptTag({content:`window.state={ff:false};window.AFK_TOGGLES={enabled:function(id){return ['perf','perf-log','perf-render'].includes(id)}};window.__logTimers=[];window.setTimeout=function(fn,ms){__logTimers.push({fn:fn,ms:ms});return __logTimers.length;};`});
    await page.addScriptTag({content:native});await page.addScriptTag({content:variant==='original'?original:optimized});
    await page.evaluate(()=>{initCombatLogLock();initSysLogLock();initWorldLogLock();});
    return {page,errors,close:()=>context.close()};
  }
  async function semantics(variant){
    const {page,errors,close}=await freshPage(variant);
    try{
      const value=await page.evaluate(async()=>{
        const ids=['combat-log','sys-log','world-log'],out=[];
        const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        const row=(prefix,i)=>'<span data-log-row="'+prefix+'-'+i+'">'+prefix+' 訊息 '+i+' &amp; <b>次序</b></span>';
        function emit(n,prefix){for(let i=0;i<n;i++){_combatSrc=i%2?'mercenary':'pet';logCombat(row(prefix,i),i%2?'player-crit':'magic',i%3===0?'summon':null);logSys(row(prefix,i),i===n-1?'relic':null);logWorld(row(prefix,i),'text-amber-300');}}
        function snap(name,extra){out.push({name,panes:ids.map(id=>{const el=document.getElementById(id);return {id,html:el.innerHTML,count:el.children.length,top:el.scrollTop,height:el.scrollHeight,client:el.clientHeight,unlock:document.getElementById(id+'-unlock').className};}),locks:[_combatLogLocked,_sysLogLocked,_worldLogLocked],dot:document.getElementById('logtab-dot-sys').className,...extra});}
        emit(70,'normal');__afkPerfFlushLogs();await frame();snap('unlocked caps and automatic bottom');
        for(const id of ids){const el=document.getElementById(id);el.scrollTop=80;el.dispatchEvent(new Event('scroll'));}
        const kept=document.querySelector('#combat-log [data-log-row="normal-45"]');const sel=getSelection(),range=document.createRange();range.selectNodeContents(kept);sel.removeAllRanges();sel.addRange(range);const text=sel.toString();
        emit(30,'retained');__afkPerfFlushLogs();await frame();snap('locked append preserves retained node and text selection',{sameNode:kept===document.querySelector('#combat-log [data-log-row="normal-45"]'),selection:sel.toString(),expectedSelection:text});
        emit(240,'clipped');__afkPerfFlushLogs();await frame();snap('locked per-channel history bounds');
        combatLogToBottom();sysLogToBottom();worldLogToBottom();emit(5,'unlocked');__afkPerfFlushLogs();await frame();snap('explicit native unlock returns to normal caps');
        logCombat('<button id="retained-focus">可選的訊息按鈕</button>','player');__afkPerfFlushLogs();await frame();const button=document.getElementById('retained-focus');button.focus();emit(3,'focused');__afkPerfFlushLogs();await frame();snap('surviving log node retains focus',{focus:document.activeElement===button,connected:button.isConnected});
        const sys=document.getElementById('sys-log');sys.classList.add('hidden');emit(8,'hidden');__afkPerfFlushLogs();await frame();snap('hidden channel stays hidden while receiving messages');
        switchLogTab('sys');await frame();snap('native tab switch restores unlocked channel bottom');
        _logTab='combat';logSys('<strong>傳說稀有掉落</strong>','legend');snap('rare dot is immediate before flush');__afkPerfFlushLogs();await frame();snap('rare message is flushed normally');
        return out;
      });
      assert.deepEqual(errors,[]);return value;
    }finally{await close();}
  }
  try{
    const before=await semantics('original'),after=await semantics('optimized');assert.deepEqual(after,before,'native browser message/scroll/selection equivalence');
    assert.equal(after.find(x=>x.name.startsWith('locked append')).sameNode,true);assert.equal(after.find(x=>x.name.startsWith('locked append')).selection,after.find(x=>x.name.startsWith('locked append')).expectedSelection);
    assert.equal(after.find(x=>x.name.startsWith('surviving log')).focus,true);report.browser=after;console.log('Native browser logging checks passed: '+after.length+'.');
    const roundsIndex=process.argv.indexOf('--rounds'),rounds=roundsIndex>=0?Number(process.argv[roundsIndex+1]):5;
    for(let round=0;round<rounds;round++)for(const variant of (round%2?['optimized','original']:['original','optimized'])){
      const {page,errors,close}=await freshPage(variant);
      try{
        await page.evaluate(async()=>{for(let i=0;i<200;i++){logCombat('<span>暖機 '+i+'</span>');logSys('<span>暖機 '+i+'</span>');logWorld('<span>暖機 '+i+'</span>');}__afkPerfFlushLogs();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
        const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');const first=await cdp.send('Performance.getMetrics');
        const work=await page.evaluate(()=>{
          const start=performance.now();
          for(let wave=0;wave<240;wave++){
            for(let n=0;n<12;n++){const html='<span data-wave="'+wave+'-'+n+'">第 '+wave+' 批：固定測試 '+n+' <b>繁體中文</b> &amp; <em>ABC</em></span>';logCombat(html,n%2?'player-crit':'magic',n%3?'mercenary':'pet');logSys(html);logWorld(html,'text-amber-300');}
            __afkPerfFlushLogs();
          }
          return {elapsedMs:performance.now()-start,panes:['combat-log','sys-log','world-log'].map(id=>{const el=document.getElementById(id);return {id,html:el.innerHTML,count:el.children.length,top:el.scrollTop,height:el.scrollHeight};}),locks:[_combatLogLocked,_sysLogLocked,_worldLogLocked]};
        });
        const last=await cdp.send('Performance.getMetrics'),metrics={};for(const k of ['LayoutCount','LayoutDuration','RecalcStyleCount','RecalcStyleDuration','TaskDuration'])metrics[k]=last.metrics.find(x=>x.name===k).value-first.metrics.find(x=>x.name===k).value;
        assert.deepEqual(errors,[]);report.benchmark.push({variant,round,...work,metrics});console.log(JSON.stringify({variant,round,elapsedMs:work.elapsedMs,metrics}));
      }finally{await close();}
    }
    for(let i=0;i<report.benchmark.length;i+=2){assert.deepEqual(report.benchmark[i].panes,report.benchmark[i+1].panes);assert.deepEqual(report.benchmark[i].locks,report.benchmark[i+1].locks);}
  }finally{await browser.close();}
}
fs.mkdirSync(path.join(root,'.scratch'),{recursive:true});
const file=process.argv.includes('--browser')?'perf-log-results.json':'perf-log-unit-results.json';
fs.writeFileSync(path.join(root,'.scratch',file),JSON.stringify(report,null,2)+'\n');
