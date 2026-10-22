import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const calls=[],catalog=[1,2,132,133].map(id=>({id,key:'relic_'+id}));
let on=true;
const sandbox={console,WeakMap,Number,Object,Math,JSON,Array,setTimeout(){},
  state:{ticks:20},mapState:{current:'test',mobs:[{uid:'enemy',hp:100,curHp:100}]},
  AFK_TOGGLES:{enabled:()=>on},AFK_RELIC_CATALOG:catalog,DB:{items:{}},
  AFK_RELIC_WEAPONS:{dispatch(e,c){calls.push(['w',e,c.catalogId,c.stage,c.target?.uid]);}},
  AFK_RELIC_DEFENSE:{dispatch(e,c){calls.push(['d',e,c.catalogId,c.stage,c.target?.uid]);}}
};
sandbox.window=sandbox;sandbox.player={hp:100,mhp:100,eq:{}};
for(const c of catalog)sandbox.DB.items[c.key]={type:c.id<=131?'wpn':'arm',relicBase:c.key,relicPlus:5};
sandbox.DB.items.relic_2_high={type:'wpn',relicBase:'relic_2',relicPlus:15,relicAsc:5};
vm.runInNewContext(fs.readFileSync(path.join(root,'afk-relic-runtime.js'),'utf8'),sandbox);
const R=sandbox.AFK_RELIC_RUNTIME,p=sandbox.player;
const checks=[];
function expectedRows(event,ids,target='a'){return ids.map(id=>[id<=131?'w':'d',id<=131&&event==='afterHit'?'hit':event,id,id===2&&p.eq.off?.id==='relic_2_high'?4:1,target]);}
function run(event,extra={}){calls.length=0;const c={actor:p,target:{uid:'a'},main:true,...extra};R.dispatch(event,c);return c;}
function verify(name,rows){assert.deepEqual(calls,rows,name);checks.push(name);}
p.eq={armor:{id:'relic_133'},wpn:{id:'relic_2'},shield:{id:'relic_132'},off:{id:'relic_1'}};
run('tick');verify('Catalog order is retained',expectedRows('tick',[1,2,132,133]));
run('afterHit',{channelKey:'relic_2'});verify('One weapon channel plus every defense source',expectedRows('afterHit',[2,132,133]));
run('beforeAttack',{channelKey:'relic_1',_module:'weapon'});verify('Weapon-only channel view',expectedRows('beforeAttack',[1]));
run('beforeAttack',{channelKey:'relic_1',_module:'defense'});verify('Defense-only view ignores weapon channel',expectedRows('beforeAttack',[132,133]));
run('afterHit',{channelKey:'missing'});verify('Missing channel still dispatches defense effects',expectedRows('afterHit',[132,133]));
run('tick',{channelKey:'relic_2'});verify('Non-channel event reaches every source',expectedRows('tick',[1,2,132,133]));
const a=R.nextAction(p,'normal');a.gm=true;a.gmSources=R.sources(p).slice();R.setAction(a);
run('afterHit',{channelKey:'relic_2'});verify('First GM channel dispatches defense effects',expectedRows('afterHit',[2,132,133]));
run('afterHit',{channelKey:'relic_1'});verify('GM defense deduplication preserves weapon callback',expectedRows('afterHit',[1]));
run('afterHit',{channelKey:'relic_2',target:{uid:'b'}});verify('Another GM target gets its own defense callbacks',expectedRows('afterHit',[2,132,133],'b'));
R.setAction(null);
p.eq.off={id:'relic_2_high'};
run('tick');verify('In-place equipment change replaces view and selects higher tier',expectedRows('tick',[2,132,133]));
delete p.eq.armor;run('tick');verify('Removed slot cannot leave a stale effect',expectedRows('tick',[2,132]));
p.eq={wpn:{id:'relic_1'}};run('tick');verify('Replaced equipment object invalidates source signature',expectedRows('tick',[1]));
on=false;run('tick');verify('Toggle off remains transparent',[]);on=true;
R.invalidate();run('tick');verify('Explicit invalidation recreates safe dispatch views',expectedRows('tick',[1]));
assert.equal(R.context(),null);checks.push('Active context restored after every dispatch');
console.log(JSON.stringify({checks},null,2));
