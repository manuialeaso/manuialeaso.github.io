import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let pw;
try{pw=await import('playwright');}catch(e){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw e;pw=await import(pathToFileURL(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.js')));}
pw=pw.chromium?pw:pw.default;
export async function testBrowser(browserOptions={}){
  let launch={headless:true};
  if(process.env.CHROME_PATH)launch.executablePath=process.env.CHROME_PATH;
  else {
    try {const bundled=(await import('/tmp/relic-test-deps/node_modules/@sparticuz/chromium/build/index.js')).default;launch={...launch,executablePath:await bundled.executablePath(),args:bundled.args.filter(arg=>arg!=='--single-process')};} catch {}
  }
  const server=createServer(async(req,res)=>{
    const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname==='/'?'/index.html':new URL(req.url,'http://local').pathname));
    try{if(!p.startsWith(root+path.sep))throw new Error('path');const data=await readFile(p);const headers={'content-type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'}[path.extname(p)]||'application/octet-stream'};if(browserOptions.offlineFixtures)headers['content-security-policy']="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src data:; font-src 'none'; media-src 'none'; connect-src 'self'";res.writeHead(200,headers);res.end(data);}catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;try{browser=await pw.chromium.launch(launch);}catch(e){server.close();throw e;}
  const url=`http://127.0.0.1:${server.address().port}/index.html`;
  return {
    async page(options={}){
      const ctx=await browser.newContext({serviceWorkers:'block',...(options.context||{})}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(String(e.stack||e)));
      if(!browserOptions.offlineFixtures)await page.route('**/*',route=>{const q=new URL(route.request().url());if(q.protocol==='data:')return route.continue();if(options.font&&q.host===new URL(url).host&&q.pathname===options.font)return route.continue();if(q.host!==new URL(url).host||(!options.assets&&['image','media','font'].includes(route.request().resourceType())))return route.abort();return route.continue();});
      if(options.init)await page.addInitScript(options.init);
      await page.addInitScript(()=>{window.__testTimers=[];const old=window.setInterval;window.setInterval=function(){const id=old.apply(this,arguments);window.__testTimers.push(id);return id;};});
      await page.goto(url,{waitUntil:'load'});
      if(options.font){await page.addStyleTag({content:`@font-face{font-family:InterfaceTestCJK;src:url(${JSON.stringify(options.font)})}*{font-family:InterfaceTestCJK,sans-serif!important}`});await page.evaluate(()=>document.fonts.load('14px InterfaceTestCJK'));}
      try{await page.waitForFunction(()=>!!window.AFK_RELIC_INTEGRATION,null,{timeout:20000});}catch(e){throw new Error(e.message+'\nPage errors: '+errors.join('\n'));}
      await page.evaluate(()=>{window.__testTimers.forEach(clearInterval);state.running=false;state.ff=true;window.__testBasePlayer=freshPlayerState();});
      return {page,errors,close:()=>ctx.close()};
    },
    async close(){await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
  };
}
export function createProfile({cls='knight',lv=100,rebirth=0,eq={},seed=12345}={}){
  let n=seed>>>0;Math.random=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
  state.running=false;state.ff=true;state.ticks=0;state.antharas=0;state.riftRun=null;
  player=freshPlayerState();player.cls=cls;player.name='Relic isolated test';player.avatar='男騎士';player.lv=lv;player.rebirth=rebirth;player.classicMode=false;player.gold=1000000;player.bonus=0;player.pvpOn=false;player.config={};
  const b=createBase[cls];player.base={str:b.str,dex:b.dex,con:b.con,int:b.int,wis:b.wis,cha:b.cha};
  const primary=cls==='mage'||cls==='illusion'?'int':cls==='elf'?'dex':'str',order=[...new Set([primary,'con','wis','dex','str','int','cha'])];let free=b.pts||0;
  for(const k of order){const n=Math.min(free,20-player.base[k]);player.base[k]+=n;free-=n;}
  player.alloc={str:0,dex:0,con:0,int:0,wis:0,cha:0};
  let points=(rebirth?51:0)+Math.max(0,lv-49);for(const k of order){const n=Math.min(points,(rebirth?200:60)-player.base[k]);player.alloc[k]+=n;points-=n;}player.bonus=points;
  player.skills=[];player.eq=Object.fromEntries(Object.keys(player.eq).map(k=>[k,null]));
  for(const [slot,id] of Object.entries(eq)){if(!DB.items[id]&&window.__afkRelicPlus)__afkRelicPlus.ensure(id);if(!DB.items[id])throw new Error('Missing item '+id);player.eq[slot]={id,en:0,uid:'test-'+slot};}
  player.inv=[];player.allies=[];player.hp=100000;player.mp=100000;mapState=freshMapState();mapState.current='training';mapState.mobs=[null,null,null,null,null];
  if(rebirth){const saved={lv:player.lv,rebirth:player.rebirth,alloc:player.alloc};player.rebirth=0;player.alloc={str:0,dex:0,con:0,int:0,wis:0,cha:0};let carry=51;for(const k of order){const n=Math.min(carry,60-player.base[k]);player.alloc[k]+=n;carry-=n;}player.lv=100;recomputeStats();const h100=player.mhp,m100=player.mmp;player.lv=1;recomputeStats();player.rebirthHpKeep=Math.max(0,h100-player.mhp);player.rebirthMpKeep=Math.max(0,m100-player.mmp);Object.assign(player,saved);}
  recomputeStats();player.hp=player.mhp;player.mp=player.mmp;
  if(window.AFK_RELIC_RUNTIME){AFK_RELIC_RUNTIME.invalidate();AFK_RELIC_RUNTIME.dispatch('battleStart',{actor:player,main:false});}
  return {hp:player.mhp,mp:player.mmp,ac:player.d.ac,dr:player.d.dr,aspd:player.d.aspd,stats:player.d};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const b=await testBrowser();try{const {page,errors,close}=await b.page();console.log(JSON.stringify(await page.evaluate(()=>({relics:AFK_RELIC_RUNTIME.catalog.length,sources:AFK_RELIC_RUNTIME.sources(player).length,gm:!!DB.items[99999],mapNames:Object.entries(DB.maps).filter(([k,v])=>/傲慢.*100|支配.*10|龍|安塔瑞斯|法利昂|林德拜爾|巴拉卡斯/.test(v.n||'')).map(([id,v])=>({id,n:v.n})),errors:[]})),null,2));console.log('Page errors:',errors);await close();}finally{await b.close();}
}
