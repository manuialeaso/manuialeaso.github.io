(function(W){
  'use strict';
  const C=W.LineageGrowthCore, backupKey='lineage_growth_transaction_backup_v1';
  // 玩家 11-11：舊版留下的整份交易備份（可能好幾 MB）一載入就清掉，騰出瀏覽器容量
  try{localStorage.removeItem(backupKey);}catch(e){}
  let busy=false, action=null, preparing=false, prepared=null;
  const checked=new WeakMap();
  const N=n=>Number(n)||0, P=()=>typeof player==='undefined'?null:player;
  function read(p){
    if(!p||!p.cls||p.classicMode)return null;   // 11-28 Ping：經典模式沒有天賦／巔峰
    // 11-16（隱藏規則）：天賦／巔峰資料被直接改過 → 實際計算當作沒有（面板、天賦視窗照常）
    try{if(W.__afkTpBad&&W.__afkTpBad(p,'growth')){const ov=document.getElementById('growth-overlay');if(!(ov&&!ov.hidden&&!ov.classList.contains('hidden')))return null;}}catch(e){}
    if(!p.growth||Number(p.lv)>p.growth.maxLevel||Number(p.lv)>=100&&!p.growth.unlocked){const next=C.reconcile(p);if(!next)return null;p.growth=next;}
    const g=p.growth;if(!g||typeof g!=='object'||!g.paragon||!g.paragon.points)return null;const mark=checked.get(g);if(!mark||mark.t!==g.talent||mark.p!==g.paragon.points){if(!C.valid(g,N(p.rebirth)))return null;checked.set(g,{t:g.talent,p:g.paragon.points});}
    return g;
  }
  function pct(p,k){const g=read(p);return g?C.value(g,k):0;}
  function sync(){const g=read(P());if(g&&W.LineageGrowthUI)W.LineageGrowthUI.refreshSummary();return g;}
  function gainOfflineXP(petExp){let n=Number(petExp)||0;const p=P();if(typeof W.__afkTtmiExpMult==='function')n*=W.__afkTtmiExpMult(p);if(typeof W.__afkExpShare==='function')n*=W.__afkExpShare(p);gainXP(Math.floor(n));}
  function gainXP(n){const p=P(),g=read(p);if(g){n=Math.floor(N(n)*(1+C.value(g,'pexp')/100)*(typeof W.__afkPgBuffMult==='function'?W.__afkPgBuffMult(p):1));C.gain(g,n,N(p.rebirth),N(p.lv),W.getExpReq(100));}}   // 11-23：巔峰經驗節點＋巔峰祝福藥水
  const trackedKey=k=>k!==backupKey&&k!=='afk_clock_v1';
  function snapshot(){const out={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(trackedKey(k))out[k]=localStorage.getItem(k);}return out;}
  function restore(before,writes,put,remove){
    for(const [k,last] of writes){if(localStorage.getItem(k)!==last)throw Error('另一個視窗已修改資料，保留較新資料並提供交易備份');}
    for(const [k] of writes){if(k in before)put.call(localStorage,k,before[k]);else remove.call(localStorage,k);}
    for(const [k] of writes)if(localStorage.getItem(k)!==(k in before?before[k]:null))throw Error('回復回讀不一致');
  }
  function transaction(label,fn,verifySaved){
    const p=P();if(busy||preparing&&!prepared||!p||p.dead||!currentSlot)throw Error('目前無法保存角色，未扣款');
    const before=snapshot(),stateBefore={antharas:state.antharas,_antAdvance:state._antAdvance,_afkDragon:state._afkDragon,running:state.running},saved=saveStateJson();
    // 玩家 11-11：整份存檔備份寫進瀏覽器會讓容量爆掉（The quota has been exceeded）→ 不再寫；失敗時用記憶體裡的 before 回復
    try{localStorage.removeItem(backupKey);}catch(e){}
    const writes=new Map(),proto=Storage.prototype,put=proto.setItem,remove=proto.removeItem;
    proto.setItem=function(k,v){const r=put.call(this,k,v);if(this===localStorage&&trackedKey(String(k)))writes.set(String(k),String(v));return r;};
    proto.removeItem=function(k){const r=remove.call(this,k);if(this===localStorage&&trackedKey(String(k)))writes.set(String(k),null);return r;};
    busy=true;
    try {
      const result=fn();if(saveGame()!==true)throw Error('存檔失敗');
      const wrapped=_saveUnwrap(_lzGet('lineage_idle_save_'+currentSlot));if(!wrapped.ok&&wrapped.signed)throw Error('存檔簽章不符');
      const disk=JSON.parse(wrapped.payload);if(JSON.stringify(disk.p.growth)!==JSON.stringify(p.growth))throw Error('成長資料回讀不符');
      if(typeof verifySaved==='function'&&verifySaved(disk,p)!==true)throw Error('交易資料回讀不符');
      return result;
    } catch(e){
      Object.assign(state,stateBefore);const q=JSON.parse(saved);Object.keys(p).forEach(k=>{if(!(k in q.p))delete p[k];});Object.assign(p,q.p);
      Object.keys(mapState).forEach(k=>{if(!(k in q.ms))delete mapState[k];});Object.assign(mapState,q.ms);
      try{restore(before,writes,put,remove);}catch(r){throw Error(e.message+'；回復失敗，請從成長視窗下載交易備份，勿繼續遊戲。');}
      throw e;
    }finally{proto.setItem=put;proto.removeItem=remove;busy=false;try{calcStats();updateUI();}catch(e){}}
  }
  async function transactionAsync(label,fn,verifySaved){
    const p=P(),slot=currentSlot;if(busy||preparing||!p||p.dead||!slot)throw Error('目前無法保存角色，未扣款');
    preparing=true;const running=state.running;state.running=false;
    try{
      sync();
      // Cancel pending compression replies, not game writes. Their raw signed
      // values are already durable and must not race the verified snapshot.
      if(typeof _lzWorkerRev!=='undefined')for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);_lzWorkerRev[k]=(_lzWorkerRev[k]||0)+1;}
      const stamp=()=>JSON.stringify({map:mapState.current,...Object.fromEntries(['cls','enSeed','name','lv','rebirth','exp','gold','inv','eq','growth','classPath','sherineMixed','dead'].map(k=>[k,p[k]]))});
      const before=snapshot(),saved=saveStateJson(),roleBefore=stamp(),receipt=await W.LineageBackups.save({format:W.LineageRecovery.ID,schema:1,createdAt:new Date().toISOString(),keys:before,changes:[],label,slot,role:saved},'game-transaction');
      if(!receipt?.verified||!receipt.id)throw Error('交易備份未驗證，未扣款');
      if(P()!==p||currentSlot!==slot)throw Error('備份期間角色已切換，未扣款');
      if(stamp()!==roleBefore){const a=JSON.parse(roleBefore),b=JSON.parse(stamp()),changed=Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));throw Error('備份期間角色已變更（'+changed.join('、')+'），未扣款');}
      const after=snapshot();for(const k of new Set([...Object.keys(before),...Object.keys(after)]))if(k!=='fb5_active_role_sessions_v1'&&!/^afk_diag_/.test(k)&&before[k]!==after[k])throw Error('備份期間資料已變更（'+k+'），未扣款');
      prepared=receipt;return transaction(label,fn,verifySaved);
    }finally{prepared=null;preparing=false;if(P()===p)state.running=running;}
  }
  function blood(){return (P().inv||[]).filter(i=>i.id==='afk_blood_dia').reduce((n,i)=>n+(i.cnt==null?1:N(i.cnt)),0);}
  function spendBlood(n){if(!busy||!Number.isSafeInteger(n)||n<=0)throw Error('血龍鑽扣款必須在已備份的存檔交易內執行');if(blood()<n)throw Error('血龍鑽不足，需要 '+n);for(const it of P().inv){if(it.id!=='afk_blood_dia')continue;const have=it.cnt==null?1:N(it.cnt),take=Math.min(have,n);it.cnt=have-take;n-=take;if(!n)break;}P().inv=P().inv.filter(i=>i.id!=='afk_blood_dia'||i.cnt>0);}
  function commitTalent(next){const g=read(P());if(!g||!g.unlocked)throw Error('一轉 Lv100 開放');if(!C.validTalent(next)||C.spent(next)>C.earned(g,N(P().rebirth)))throw Error('天賦點數或前置不符');
    const changed=g.talent.nodes.some(id=>!next.nodes.includes(id))||g.talent.j&&!next.j;
    if(changed)throw Error('已保存的天賦不能拿掉；要重新配點請按「洗點」（50,000 血龍鑽，全部點數退還）');
    return transaction('天賦配點',()=>{g.talent=C.copy(next);g.supportBuffs={};W.LineageTalents?.reset(P());});
  }
  function commitParagon(points){const g=read(P());if(!g||!g.unlocked||N(P().rebirth)<1||N(P().lv)<100)throw Error('一轉 Lv100 開放');const candidate=C.copy(g);candidate.paragon.points=C.copy(points);if(!C.valid(candidate,N(P().rebirth)))throw Error('巔峰點數或上限不符');
    const changed=Object.keys(g.paragon.points).some(k=>N(points[k])<g.paragon.points[k]);
    if(changed)throw Error('已保存的巔峰點數不能減少；要重新配點請按「洗點」（每 1000 等 5 萬血龍鑽，全部點數退還）');
    return transaction('巔峰配點',()=>{g.paragon.points=C.copy(points);});
  }
  // 玩家 11-11：保存後就鎖定；洗點＝花 50,000 血龍鑽把這一邊目前的點數全部退還
  const WASH=50000;
  // 巔峰洗點分層收費（Ping 11-14 14:44）：5 萬 ×（巔峰等級 ÷ 1000，無條件進位），例 5000 等＝25 萬、2300 等＝15 萬
  const paragonWash=g=>WASH*Math.max(1,Math.ceil(N(g&&g.paragon&&g.paragon.level)/1000));
  function respec(kind){const g=read(P());if(!g)throw Error('成長資料異常');if(!g.unlocked)throw Error('一轉 Lv100 開放');
    if(kind==='talent'){if(!g.talent.nodes.length&&!g.talent.j)throw Error('天賦還沒有配點');return transaction('天賦洗點',()=>{spendBlood(WASH);g.talent={order:[],nodes:[],j:false};g.supportBuffs={};W.LineageTalents?.reset(P());});}
    if(kind==='paragon'){if(!Object.values(g.paragon.points).some(v=>N(v)>0))throw Error('巔峰還沒有配點');const cost=paragonWash(g);return transaction('巔峰洗點',()=>{spendBlood(cost);g.paragon.points={};});}
    throw Error('未知分類');}
  function statBase(p){const g=read(p);if(!g)return;const m=C.movement(g);p.d.moveSpeedPct=N(p.d.moveSpeedPct)+m.speed;}
  function weight(p,n){const g=read(p);return g?Math.floor(n*(1+C.movement(g).weight/100)):n;}
  function statFinal(p){const g=read(p);if(!g)return;p.mhp=Math.floor(p.mhp*(1+C.value(g,'hp')/100));p.mmp=Math.floor(p.mmp*(1+C.value(g,'mp')/100));if(W.LineageTalents)W.LineageTalents.passive(p);}
  function finalDefense(p,n){return Math.max(0,n*(1-pct(p,'trueDefense')/100));}
  function absolute(p,t,amount,kind){
    const ticks=state.ticks||0;if(!t||t._dead||t.curHp<=0)return 0;
    if(t._afkLockUntil>ticks||t._dsHolyUntil&&t._dsHolyUntil>=ticks||t.invulnerable||t.immune||t._invulnerable||t._timeSealed)return 0;
    const wall=t._reflectWall;if(wall&&wall.block&&wall.until>=ticks&&!(W.LineageClassCombat&&W.LineageClassCombat.broken(t,kind==='magic'?'magic':'phys')))return 0;
    for(const gate of W.LineageAbsoluteDamageGates||[])amount=Math.min(amount,Math.max(0,gate(p,t,amount,kind)));
    return Math.max(0,Math.floor(amount));
  }
  function secondaryHit(p,t,amount,kind){
    if(!p||p.dead||!t||t._dead||t.curHp<=0)return 0;
    // A single derived hit. It uses target mitigation, but never the relic/card proc chain.
    amount=kind==='magic'?amount*(typeof mrMult==='function'?mrMult(N(t.mr)):1):Math.max(0,amount-(typeof mobHardSkin==='function'?mobHardSkin(t):N(t.dr)));
    amount=absolute(p,t,amount,kind);if(!amount)return 0;t.curHp-=amount;t.justHit='magic';if(typeof mobWake==='function')mobWake(t);
    if(t.curHp<=0){const i=mapState.mobs.indexOf(t);if(i>=0)killMob(i);}return amount;
  }
  function trueBase(p,t,kind){
    const d=p.d||{},w=p.eq&&p.eq.wpn&&DB.items[p.eq.wpn.id],channel=kind==='magic'?'magic':kind==='ranged'?'ranged':'melee';
    const main=p.cls==='elf'?'ranged':/^(mage|illusion)$/.test(p.cls)?'magic':'melee';
    const primary={melee:()=>getStrMeleeDmg(N(d.str)),ranged:()=>getDexRangedDmg(N(d.dex)),magic:()=>getIntMagicDmg(N(d.int))};
    return C.trueAmount(w?N(t.s==='L'?w.dmgL:w.dmgS):2,primary[main](),N(d[channel+'Dmg']),primary[channel](),pct(p,'trueDamage'));
  }
  function trueHit(c){
    const p=c.actor,t=c.target;if((typeof _royalFreeCast!=='undefined'&&_royalFreeCast)||!action||action.used||action.actor!==p||p!==P()||p.dead||!t||t._dead||t.curHp<=0||c.hit===false||c.direct===false||c.isDot||c.reflection||!['normal','auto','gm'].includes(c.origin||'normal')||c.generated)return 0;
    action.used=true;let amount=trueBase(p,t,c.kind);if(!amount)return 0;
    amount=absolute(p,t,amount,c.kind);
    if(!(amount>0))return 0;
    amount=Math.floor(amount);t.curHp-=amount;t.justHit='magic';if(typeof mobWake==='function')mobWake(t);
    if(typeof logCombat==='function'&&!state.ff)logCombat('<span class="text-cyan-300">巔峰真傷 '+amount+'</span>','player-special');
    // Dedicated packet: no card multiplier, reflection, lifesteal, relic event or recursive proc.
    if(t.curHp<=0&&!t._dead){const ix=mapState.mobs.indexOf(t);if(ix>=0)killMob(ix);}return amount;
  }
  function event(name,c){if(W.LineageTalents)W.LineageTalents.event(name,c);}
  W.LineageGrowth={read,pct,sync,gainXP,gainOfflineXP,transaction,transactionAsync,blood,spendBlood,commitTalent,commitParagon,respec,WASH,paragonWash,statBase,statFinal,weight,finalDefense,trueBase,trueHit,event,absolute,secondaryHit,backupKey};
  function wrap(name,fn){const old=W[name];if(typeof old==='function')W[name]=function(){return fn.call(this,old,arguments);};}
  for(const name of ['playerAttack','castSkill'])wrap(name,function(old,args){const parent=action;action=parent||{actor:P(),used:false};if(name==='playerAttack'&&W.LineageTalents)W.LineageTalents.beforeAttack(P());try{return old.apply(this,args);}finally{action=parent;}});
  wrap('loadGame',function(old,args){const r=old.apply(this,args);sync();return r;});
  wrap('saveGame',function(old,args){read(P());return old.apply(this,args);});
  wrap('checkLvUp',function(old,args){sync();const r=old.apply(this,args);sync();return r;});
  const R=W.AFK_RELIC_RUNTIME;if(R){
    function hookIncoming(){if(R.incoming._growthFinal)return;const old=R.incoming;
      const f=function(actor){let n;const before=GDeferred.depth;GDeferred.depth++;try{n=old.apply(this,arguments);}finally{GDeferred.depth=before;}return before?n:R.growthFinishIncoming(actor,finalDefense(actor,n));};f._growthFinal=true;R.incoming=f;
    }
    const GDeferred=W.LineageGrowthDeferred={depth:0};hookIncoming();W.addEventListener('load',hookIncoming);
  }
  // Read-only backup download remains available even if a rollback cannot complete.
  W.LineageGrowth.downloadBackup=async function(){let s=localStorage.getItem(backupKey);if(!s)return;const record=JSON.parse(s);if(record.backupId)s=(await W.LineageBackups.read(record.backupId)).text;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([s],{type:'application/json'}));a.download='lineage-growth-transaction-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
})(window);
