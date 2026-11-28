(function(W){
  'use strict';
  const G=W.LineageGrowth,C=W.LineageGrowthCore,MAP='growth_mushroom',MOB='growth_mushroom_1000';
  const N=n=>Number(n)||0;
  let lease=0,leaseOwner=null,leaseDay=null,advancing=false,lastCheckpoint=0,seen=new WeakSet();
  // 玩家 11-11：經驗 1.7 萬 → 17 萬 → 85 萬（18:04）；能進次元裂縫的角色 170 萬（出生時依當下角色決定）
  const riftOK=()=>{try{const p=(typeof player!=='undefined'?player:null),R=W.__afkDimRift;return !!(p&&R&&typeof R.canOpen==='function'&&!R.canOpen(p));}catch(e){return false;}};
  DB.mobs[MOB]={...DB.mobs.nm_002};Object.defineProperty(DB.mobs[MOB],'exp',{enumerable:true,configurable:true,get:()=>riftOK()?1700000:850000,set:()=>{}});DB.maps[MAP]=[MOB];
  W.__afkNoOfflineMaps=(W.__afkNoOfflineMaps||[]).concat(MAP);
  if(typeof SANCTUARY_MAP_NAMES!=='undefined')SANCTUARY_MAP_NAMES[MAP]='限時蘑菇秘境';
  if(typeof SPECIAL_AREA_BG!=='undefined')SPECIAL_AREA_BG[MAP]='assets/area/1920x1080/新兵修練場.jpg';
  function key(){if(!player.enSeed)throw Error('角色識別資料未就緒，請先存檔');return 'lineage_mushroom_quota_'+String(player.enSeed);}
  function quota(){const g=G.read(player);if(!g)throw Error('成長資料異常');const disk=localStorage.getItem(key()),q=C.quota(disk?JSON.parse(disk):null,Date.now()),own=C.quota(g.mushroom,Date.now());q.used=Math.max(q.used,own.used);return q;}
  function remaining(){return Math.max(0,1800000-quota().used+(leaseOwner===player&&leaseDay===C.dayKey(Date.now())?lease:0));}
  // 11-11 15:58：當傭兵進過也算——隊伍裡每個傭兵（玩家自己的其他角色）都一起扣時間，今天用完的傭兵不能再進
  const mercs=()=>(player.allies||[]).filter(a=>a&&a.enSeed&&String(a.enSeed)!==String(player.enSeed));
  const mKey=a=>'lineage_mushroom_quota_'+String(a.enSeed);
  const mQuota=a=>{let d=null;try{d=JSON.parse(localStorage.getItem(mKey(a))||'null');}catch{}try{return C.quota(d,Date.now());}catch{return {day:C.dayKey(Date.now()),used:0};}};
  const mDone=()=>mercs().filter(a=>mQuota(a).used>=1800000);
  function chargeMercs(n){for(const a of mercs()){const q=mQuota(a);q.used=Math.min(1800000,q.used+n);try{localStorage.setItem(mKey(a),JSON.stringify(q));}catch{}}}
  function reserve(){
    if(leaseOwner!==player||leaseDay!==C.dayKey(Date.now())){lease=0;leaseOwner=player;leaseDay=C.dayKey(Date.now());}if(lease>0)return true;
    const q=quota();if(q.used>=1800000)return false;if(mDone().length)return false;const n=Math.min(1000,1800000-q.used);q.used+=n;
    const raw=JSON.stringify(q);localStorage.setItem(key(),raw);if(localStorage.getItem(key())!==raw)throw Error('副本時間無法保存');
    G.read(player).mushroom=q;lease=n;chargeMercs(n);return true;
  }
  function town(){state.antharas=0;state._afkDragon=null;setMapSelectors('town_talking');changeMap(true);}
  function enterMushroom(){if(player.dead)throw Error('請先復活');if(!remaining())throw Error('今天的 30 分鐘已用完');if(state.antharas||state.riftRun)throw Error('請先離開目前副本');
    {const d=mDone();if(d.length)throw Error('傭兵「'+d.map(a=>a.name||'?').join('、')+'」今天的蘑菇秘境時間已經用完（當主角或當傭兵進去過都算），請先讓他離隊');}
    const before={lease,leaseOwner,leaseDay};try{G.transaction('進入蘑菇秘境',()=>{if(!reserve())throw Error('今日時間已用完');enterOblivionMap(MAP);if(mapState.current!==MAP)throw Error('無法進入副本');});}catch(e){lease=before.lease;leaseOwner=before.leaseOwner;leaseDay=before.leaseDay;throw e;}
  }
  const bosses={antharas:'ant_antharas_s7',fafurion:'cr_fafurion_d7',valakas:'cr_valakas_d7',lindvior:'cr_lindvior_d7',hardin:'afk_hd_hardin',halpas:'afk_hp_halpas'};
  const names={antharas:'安塔瑞斯',fafurion:'法利昂',valakas:'巴拉卡斯',lindvior:'林德拜爾',hardin:'哈汀的時空',halpas:'闇龍的低語'};
  function special(id){
    const [type,mode,key]=id.split(':'),g=W.__afkGuardRing,z=W.__afkZodiac;
    if(type==='gr'&&g?.KN[key]&&['dream','rift'].includes(mode))return{map:g.mapOf(key),api:g,check:()=>g.canEnter(key,mode)||'',enter:()=>g.enter(key,mode),clears:()=>N(player.afkGuard?.clears?.[key]),matches:q=>q?.k===key&&q.mode===mode};
    const nz=W.__afkNewZones;
    if(type==='nz'&&nz?.SBY[key]&&['dream','rift'].includes(mode)){const x=nz.exped;return{map:nz.SBY[key].map,api:{growthCheckpoint:x.growthCheckpoint,growthRestore:x.growthRestore,run:x.run},check:()=>x.check(key,mode)||'',enter:()=>x.enter(key),clears:()=>x.clears(key),matches:q=>q?.id===key};}
    if(type==='zd'&&z?.H.some(h=>h.k===mode))return{map:z.MAP,api:z,check:()=>z.canEnter(player)||(!z.today().some(h=>h.k===mode)?'今天未開放這一宮':''),enter:()=>z.enter(mode),clears:()=>N(player.afkZodiac?.clears?.[mode]),matches:q=>q?.k===mode};
    return null;
  }
  function activityTransaction(label,fn){
    const native=[W.__afkGuardRing,W.__afkZodiac,W.__afkNewZones&&W.__afkNewZones.exped].filter(Boolean).map(api=>[api,api.growthCheckpoint()]);
    try{return G.transaction(label,fn);}catch(e){for(const [api,q] of native){try{api.growthRestore(q);}catch{api.growthRestore(null);}}throw e;}
  }
  function rows(){
    const base=Object.keys(bosses).map(id=>({id,name:names[id],points:true,kind:'dream',fee:'原生入場條件'})).concat((W.__afkRiftDg?W.__afkRiftDg.D:[]).filter(d=>!d.endless).flatMap(d=>(d.pick?d.pick.map(pk=>[':'+pk[0],'・'+pk[1]]):[['','']]).map(([ks,ns])=>({id:'rd:'+d.id+ks,name:d.n+ns,points:false,kind:d.noRift?'dream':'rift',fee:(d.fee.blood||0)+' 血龍鑽'+(d.fee.items||[]).map(x=>'、'+(DB.items[x[0]]||{}).n+' ×'+x[1]).join('')}))));   // 11-17 Ping：四龍、阿納金各形態也列入
    const g=W.__afkGuardRing,z=W.__afkZodiac;
    if(g)for(const kind of ['dream','rift'])for(const key of g.KEYS)base.push({id:'gr:'+kind+':'+key,name:'守護者之戒・'+g.DGK[key].map,points:false,kind,fee:'完成騎士劇情；每日 '+g.DG.daily[kind]+' 次，付一次費用打完今天剩下的次數'});
    const nz=W.__afkNewZones;   // 11-17（Ping）：單人副本也能付費代打；每個副本每天一次、入場費（夢域鏡 1,000 龍鑽／次元裂縫 500 血龍鑽）另付
    if(nz&&nz.exped)for(const kind of ['dream','rift'])for(const d of nz.SOLO)base.push({id:'nz:'+kind+':'+d.id,name:'單人副本・'+d.n+(d.pick?'（打'+d.pick[0][1]+'）':''),points:false,kind,fee:'每天一次；入場費 '+(kind==='rift'?'500 血龍鑽':'1,000 龍鑽')+'另付；要在'+((DB.towns[d.town]||{}).n||'村莊')+'出發（會自動移過去）'});
    if(z)for(const h of z.H)base.push({id:'zd:'+h.k,name:'黃道十二宮・'+h.n,points:false,kind:'dream',fee:'二轉後；每日開放三宮，選一宮挑戰一次'});
    return base;
  }
  function round(){const g=G.read(player);return g&&g.expedition;}
  function quote(ids){
    const allowed=new Set(rows().map(x=>x.id));ids=[...new Set(ids)].filter(id=>allowed.has(id));
    if(!ids.length)throw Error('請選擇副本');
    if(ids.filter(id=>id.startsWith('zd:')).length>1)throw Error('黃道十二宮每日三選一，一輪只能選擇一宮');
    const rift=ids.filter(id=>rows().some(x=>x.id===id&&x.kind==='rift')).length;
    if(rift&&rift!==ids.length)throw Error('一般夢域鏡與次元裂縫請分成兩輪，各付對應費用');
    return rift?{kind:'rift',currency:'blood',amount:1000,label:'1,000 血龍鑽'}:{kind:'dream',currency:'diamond',amount:10000,label:'10,000 龍鑽'};
  }
  function paidRound(r){
    if(!r||!Array.isArray(r.queue)||!r.queue.length)return false;
    // Legacy rounds already paid 10,000 diamonds, including mixed queues: honor that payment.
    if(!r.payment)return r.v===1&&r.paid===10000;
    try{const q=quote(r.queue);return r.paid===q.amount&&r.payment.amount===q.amount&&r.payment.currency===q.currency&&r.payment.kind===q.kind;}catch(e){return false;}
  }
  function why(id){
    if(player.dead)return '請先復活';
    const native=special(id);if(native)return native.check();
    if(!player.sherineDream||!player.sherineMad)return '需要開啟夢域鏡模式';
    if(bosses[id]&&W.__afkExpedition?.store(player).got[bosses[id]])return '✓ 今天已打完（遠征點數已拿）';
    if(id==='hardin')return W.__afkHardin.canEnter()||'';
    if(id==='halpas')return W.__afkHalpas.canEnter('halpas')||'';
    if(id.startsWith('rd:')){const [did,pk]=rdParts(id),d=W.__afkRiftDg.BYID[did];return d?W.__afkRiftDg.canEnter(d,pk)||'':'未知副本';}
    if(!bosses[id])return '未知副本';
    const used=id==='antharas'?antharasPartyUsedToday():W.__afkCorrupt.withCtx(id,()=>antharasPartyUsedToday());
    return used.length?'隊伍成員今天已通關此龍巢':'';
  }
  // 玩家 11-11：次元裂縫副本要在席琳神殿才進得去；上一項打完會回到別的村莊 → 下一項進不去、整輪卡在暫停。
  //   在村莊裡時先移到席琳神殿再進場。
  function rdParts(id){const s=String(id).slice(3),i=s.indexOf(':');return i<0?[s,undefined]:[s.slice(0,i),s.slice(i+1)];}
  function prep(id){{const m=/^nz:\w+:(\w+)$/.exec(String(id)),d=m&&W.__afkNewZones&&W.__afkNewZones.SBY[m[1]];if(d&&/^town_/.test(mapState.current||'')&&mapState.current!==d.town){try{setMapSelectors(d.town);changeMap(true);}catch(e){}}}const D=W.__afkRiftDg,leftRd=D&&mapState.current===D.MAP&&!D.run();if(String(id).startsWith('rd:')&&(leftRd||/^town_/.test(mapState.current||'')&&mapState.current!=='town_sherine')){try{setMapSelectors('town_sherine');changeMap(true);}catch(e){}}else if(leftRd){try{setMapSelectors('town_sherine');changeMap(true);}catch(e){}}}
  function enter(id){
    prep(id);const err=why(id);if(err)throw Error(err);const old=mapState.current,native=special(id),r=round();r.itemAt=Date.now();
    if(native){r.clearBefore=native.clears();native.enter();}
    else if(id==='antharas')antharasEnter();else if(id==='hardin')W.__afkHardin.enter();else if(id==='halpas')W.__afkHalpas.enter('halpas');else if(id.startsWith('rd:')){const [did,pk]=rdParts(id);W.__afkRiftDg.enter(did,pk);}else afkCorruptEnter(id);
    if(mapState.current===old)throw Error('未成功進入 '+(names[id]||id));
    r.map=mapState.current;r.maps=id==='antharas'?['antharas_nest_1','antharas_nest_2','antharas_nest_3','antharas_lair']:W.__afkCorrupt.areasOf[id]||[mapState.current];r.status='running';r.reason='';state.running=true;
    checkpoint();
  }
  function start(ids,choice){
    if(round()&&!['done','cancelled'].includes(round().status))throw Error('請繼續或結束已付款的這輪遠征');
    const allowed=new Set(rows().map(x=>x.id));ids=[...new Set(ids)].filter(id=>allowed.has(id));if(!ids.length)throw Error('請選擇副本');
    const payment=quote(ids);ids.sort((a,b)=>Number(!bosses[a])-Number(!bosses[b]));
    // 玩家 11-11：守護者之戒付一次錢，打滿當天的次數（用完的會自動跳過）
    ids=ids.flatMap(id=>{const m=/^gr:(dream|rift):/.exec(id),g=W.__afkGuardRing;return m&&g?Array(Math.max(1,N(g.DG.daily[m[1]]))).fill(id):[id];});
    if(!/^town_/.test(mapState.current||''))throw Error('請先回村再開始遠征');
    const here0=mapState.current;prep(ids[0]);const err=why(ids[0]);if(err){if(mapState.current!==here0){try{setMapSelectors(here0);changeMap(true);}catch(e){}}throw Error(err);}
    if((payment.currency==='blood'?G.blood():pandoraGetSharedDiamonds())<payment.amount)throw Error('餘額不足，需要 '+payment.label+'（副本門票另計）');
    return activityTransaction('啟動自動遠征',()=>{
      G.read(player).expedition={v:2,id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),queue:ids,index:0,status:'starting',paid:payment.amount,payment,choice:choice==='stop'?'stop':'ritual',completed:[],created:Date.now()};
      if(payment.currency==='blood')G.spendBlood(payment.amount);else{const pay=pandoraAdjustSharedDiamonds(-payment.amount);if(!pay||!pay.ok)throw Error('龍鑽扣款失敗');}enter(ids[0]);
    });
  }
  function checkpoint(){const r=round();if(!r||r.status!=='running')return;const id=r.queue[r.index],rd=id.startsWith('rd:')?W.__afkRiftDg.growthCheckpoint():null,native=special(id)?.api.growthCheckpoint();
    // Native load may return transient rift maps to town. Keep the actual battle with the paid checkpoint.
    if((rd||native)&&typeof normalizeFacingRefsForSave==='function')normalizeFacingRefsForSave();
    r.checkpoint={map:mapState.current,ticks:state.ticks,antharas:state.antharas,dragon:state._afkDragon,hardin:id==='hardin'?C.copy(W.__afkHardin.run()):null,halpas:id==='halpas'?C.copy(W.__afkHalpas.run()):null,rd,native:native||null,battlefield:rd||native?C.copy(mapState):null};}
  function pause(reason,failed=false){const r=round();if(r&&r.status==='running'){if(failed)r.checkpoint=null;else checkpoint();r.status='paused';r.reason=reason;state.running=false;saveGame();}}
  function resume(){const r=round();if(!paidRound(r)||r.status!=='paused')throw Error('沒有可繼續的已付款遠征');if(player.dead)throw Error('請先復活');
    const cp=r.checkpoint,id=r.queue[r.index],native=special(id);
    return activityTransaction('繼續已付款遠征',()=>{
      if(native&&native.clears()>r.clearBefore){r.status='running';finishJob();return;}
      if(native&&cp?.native&&cp.battlefield&&cp.map===native.map&&cp.battlefield.current===native.map&&native.matches(cp.native)){
        Object.keys(mapState).forEach(k=>{if(!(k in cp.battlefield))delete mapState[k];});Object.assign(mapState,C.copy(cp.battlefield));native.api.growthRestore(cp.native);
        state.antharas=cp.antharas;state._afkDragon=cp.dragon;r.status='running';r.reason='';state.running=true;syncMapSelectors();applyAreaBackground();renderMobs();return;
      }
      if(!native&&cp&&(mapState.current===cp.map||cp.rd&&cp.battlefield&&cp.map===W.__afkRiftDg.MAP&&cp.battlefield.current===cp.map&&cp.rd.id===rdParts(id)[0])){
        if(mapState.current!==cp.map){Object.keys(mapState).forEach(k=>{if(!(k in cp.battlefield))delete mapState[k];});Object.assign(mapState,C.copy(cp.battlefield));syncMapSelectors();applyAreaBackground();renderMobs();}
        state.antharas=cp.antharas;state._afkDragon=cp.dragon;
        if(cp.hardin)W.__afkHardin.growthRestore(cp.hardin);if(cp.halpas)W.__afkHalpas.growthRestore(cp.halpas);if(cp.rd)W.__afkRiftDg.growthRestore(cp.rd);
        r.status='running';r.reason='';state.running=true;
      }else if(!native&&!String(id).startsWith('rd:')&&(r.maps||[]).includes(mapState.current)&&(state.antharas=0,state._afkDragon=null,W.__afkCorrupt?.resumeHere?.())){
        // 11-28 Ping：人還在這條龍的巢穴裡（例如手機重新整理時剛好換到下一區、進度點還停在上一區），照所在地圖接著打，不要從入口重打
        r.status='running';r.reason='';state.running=true;checkpoint();
      }else{state.antharas=0;state._afkDragon=null;enter(id);}
    });
  }
  function cancel(){const r=round();if(r)G.transaction('結束本輪遠征',()=>{r.status='cancelled';r.reason='玩家結束本輪，不自動再扣款';});}
  // 玩家 11-12「遠征一直發呆不進場」：手機跟不上時（每 tick 的時間超過 100ms）遊戲會進入補跑，補跑中的存檔一律延到補跑結束才寫（saveGame 回 false），
  //   原本把這個當成「存檔失敗」→ 打完一項就暫停、或每 30 秒的進度點直接暫停。延後寫入不算失敗。
  function saved(){const ok=saveGame();if(ok===true)return true;return typeof catchupActive==='function'&&catchupActive()&&typeof _ffSavePending!=='undefined'&&_ffSavePending===true;}
  function finishJob(){const r=round();if(!r||r.status!=='running')return;r.completed.push(r.queue[r.index]);r.index++;r.checkpoint=null;
    if(r.index>=r.queue.length){r.status='done';r.reason='本輪完成';saveGame();return;}
    r.status='between';if(!saved()){r.status='paused';r.reason='通關紀錄尚未保存，已停止自動切換；請先保存再繼續';state.running=false;return;}scheduleNext(r.id);
  }
  // 守護者之戒今天的次數已經用完的那幾項：直接跳過
  function skipUsed(r){while(r.index<r.queue.length){const q=r.queue[r.index],n=special(q);if(!n||!/^gr:/.test(q))break;let w='';try{w=n.check();}catch(e){w='';}if(!/用完/.test(w))break;(r.skipped=r.skipped||[]).push(r.index);r.completed.push(q);r.index++;}if(r.index>=r.queue.length){r.status='done';r.reason='本輪完成';saveGame();return true;}return false;}
  function scheduleNext(id){setTimeout(()=>{const r=round();if(!r||r.id!==id||r.status!=='between')return;if(skipUsed(r))return;try{state.antharas=0;state._afkDragon=null;activityTransaction('進入遠征下一項',()=>enter(r.queue[r.index]));}catch(e){const current=round();current.status='paused';current.reason=e.message;saveGame();}},1800);}
  // 裂縫副本這一項打完了沒（四龍各自記；11-18 Ping）
  function rdCleared(id,q){if(!String(id).startsWith('rd:')||!W.__afkRiftDg)return false;const [did,pk]=rdParts(id),d=W.__afkRiftDg.BYID[did];return W.__afkRiftDg.store().clear[did+(d&&d.pickChain&&pk?pk:pk?'@'+pk:'')]>=(q.itemAt||q.created);}
  function checkRound(){const r=round();if(!r)return;if(r.status==='running'){
    if(rdCleared(r.queue[r.index],r)){finishJob();return;}   // 11-23 Ping：燃燼礦坑這種「撐滿時間」的副本是計時結算、不是打倒怪時結算 → 原本只在打倒怪時檢查，結算後回村就被當成「離開副本」暫停
    const native=special(r.queue[r.index]);if(native&&native.clears()>r.clearBefore){finishJob();return;}
    if(player.dead||player.hp<=0){pause('隊伍戰敗，復活後重新進場仍受每日次數限制',!!native);return;}
    if(!(r.maps||[r.map]).includes(mapState.current)){pause('已離開副本，繼續時重新進場',!!native);return;}
    if(native&&!native.api.run()){pause('試煉已結束或失敗，重新進場仍受每日次數限制',true);return;}
    if(r.queue[r.index]==='hardin'){const h=W.__afkHardin.run();if(h&&h.stage==='choice')W.__afkHardin.choose(r.choice);}
    if(r.checkpoint&&r.checkpoint.map!==mapState.current&&(r.maps||[]).includes(mapState.current)){checkpoint();lastCheckpoint=state.ticks;}   // 11-28：換到下一區就馬上記進度點
    if(state.ticks-lastCheckpoint>=300){checkpoint();if(!saved()){pause('存檔失敗，已暫停遠征');state.running=false;}lastCheckpoint=state.ticks;}
  }}
  function shortcut(before){
    if(advancing||!C.movement(G.read(player)).shortcut||Math.random()>=.05)return;
    const D=W.__afkRiftDg,r=D&&D.run();if(!r||mapState.current!==D.MAP||!D.growthCanShortcut(before))return;
    advancing=true;try{if(D.growthShortcut(before))logSys('發現捷徑，前往下一層');}finally{advancing=false;}
  }
  const oKill=W.killMob;W.killMob=function(i){const m=mapState.mobs[i],d=W.__afkRiftDg&&W.__afkRiftDg.run(),before=d?{id:d.id,si:d.si,wave:d.wave}:null;
    const r=oKill.apply(this,arguments);if(m&&m._dead&&!seen.has(m)){seen.add(m);W.LineageTalents.killed(player,m);const q=round();if(q&&q.status==='running'){
      const id=q.queue[q.index],boss=bosses[id];if(boss&&(m.mobId===boss||m.n===(DB.mobs[boss]||{}).n))finishJob();
      else if(rdCleared(id,q))finishJob();   // 11-18 Ping：四龍原本共用一個通關紀錄→打完第一條龍，後面三條一進場殺第一隻怪就被當成打完
      else {const native=special(id);if(native&&native.clears()>q.clearBefore)finishJob();}
    }if(before&&G.read(player))shortcut(before);}return r;
  };
  const oSpawn=W.spawnMob;W.spawnMob=function(i){if(mapState.current!==MAP)return oSpawn.apply(this,arguments);if(i>4||player.dead)return;
    if(mapState.mobs[i]&&!mapState.mobs[i]._dead&&mapState.mobs[i].curHp>0)return;
    const base=DB.mobs[MOB];mapState.mobs[i]={...base,mobId:MOB,curHp:base.hp,uid:uid(),_born:++_mobBornSeq,_bornMs:Date.now(),_magCd:{},justHit:false,st:newMobStatus()};
  };
  const oTick=W.tick;W.tick=function(){const inMushroom=mapState.current===MAP,t=state.ticks;
    if(inMushroom&&!player.dead&&state.running){try{if(!reserve()){town();logSys(mDone().length?'隊伍裡有傭兵今天的蘑菇秘境時間用完了，回到村莊。':'今日蘑菇秘境時間已用完。');return;}}catch(e){state.running=false;logSys(e.message);return;}}
    const r=oTick.apply(this,arguments);if(inMushroom&&state.ticks>t)lease=Math.max(0,lease-(state.ticks-t)*100);
    if(player.dead&&round()?.status==='running')checkRound();
    if(state.ticks>t&&state.ticks%10===0){checkRound();W.LineageTalents.tick();if(W.LineageGrowthUI)W.LineageGrowthUI.clock();}return r;
  };
  // 玩家 11-12「遠征一直發呆」：重新整理／手機把分頁收掉再打開／上線後自動更新，遠征都會變成「暫停、按繼續恢復」，玩家沒注意就一直停著。
  //   改成讀檔 4 秒後自動按一次「繼續」（跟手動按完全同一個流程，不會多扣錢）；繼續不了就把原因寫在本輪狀態上。
  function autoResume(id){setTimeout(()=>{try{const r=round();if(!r||r.id!==id||r.status!=='paused'||!/^已讀取已付款的遠征/.test(r.reason||''))return;if(player.dead)return;
    resume();logSys('<span class="text-violet-300">🧭 自動繼續已付款的遠征。</span>');}catch(e){const r=round();if(r&&r.id===id&&r.status==='paused')r.reason='自動繼續失敗：'+e.message+'（可以手動按繼續）';}},4000);}
  W.LineageActivities={MAP,MOB,quota,remaining,enterMushroom,rows,round,quote,paidRound,why,start,pause,resume,cancel,checkpoint,finishJob};
  // On reload, restore only through the explicit paid-round continuation button.
  const loaded=new WeakSet();const oUI=W.updateUI;W.updateUI=function(){if(player&&player.cls&&!loaded.has(player)){loaded.add(player);const r=round();if(r&&['running','between','starting'].includes(r.status)){r.status='paused';r.reason='已讀取已付款的遠征，按繼續恢復';autoResume(r.id);}}return oUI.apply(this,arguments);};
})(window);
