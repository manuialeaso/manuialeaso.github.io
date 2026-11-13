/* Mandatory web import boundary: a role import never rewinds shared assets. */
(function(){'use strict';
 const B=window.LineageSaveBridge,R=window.LineageRecovery;
 function profile(p){
  const items=Object.fromEntries(Object.getOwnPropertyNames(DB.items).map(id=>{const d=DB.items[id],cap=['wpn','arm','acc'].includes(d.type)?enhanceCap(d):null,relic=!!window.__afkRelicPlus?.kindOk(d);return [id,{name:d.n,type:d.type,cap,relic,relicMax:relic?(cap<=5?10:15):undefined}];}));
  return {sherineSystem:1,classSystem:1,derivedRelics:1,items,maxLevel:typeof window.__afkLvCap==='function'?__afkLvCap(p):100,skills:Object.keys(DB.skills),maps:[...new Set([...Object.keys(DB.maps),...Object.keys(DB.towns),...Object.values(typeof MAP_CATEGORIES!=='undefined'?MAP_CATEGORIES:{}).flat().map(x=>x.v).filter(Boolean)])]};
 }
 // 11-12 00:42（Ping）：匯入除錯紀錄——每一步記下來，失敗時告訴玩家卡在哪一步；最近 20 筆存在 lineage_import_debug_v1，存檔與修復可以看、可以複製
 const DBG_KEY='lineage_import_debug_v1';let T=null;
 const shortP=p=>p?((p.name||'?')+'／'+(p.cls||'?')+'／'+(p.rebirth||0)+'轉 Lv'+(p.lv||'?')):'（無）';
 const trace={
  start(raw,slot){let head='';try{head=String(raw||'').replace(/^\uFEFF/,'').trimStart().slice(0,5);}catch(e){}
   T={at:new Date().toISOString(),slot,size:(raw||'').length,head,ver:(window.__afkCodeVersion||(typeof document!=='undefined'&&document.querySelector?(document.querySelector('script[src*="save-gate.js"]')||{}).src:'')||'').toString().slice(-20),ua:(typeof navigator!=='undefined'&&navigator.userAgent||'').replace(/\s+/g,' ').slice(0,120),steps:[],ok:null,msg:'',failStep:''};},
  step(name,detail){if(T)T.steps.push({n:name,d:String(detail==null?'':detail).slice(0,300),t:Date.now()});},
  end(ok,msg){if(!T)return;T.ok=ok;T.msg=String(msg||'').slice(0,500);if(!ok)T.failStep=(T.steps[T.steps.length-1]||{}).n||'';
   try{const a=JSON.parse(localStorage.getItem(DBG_KEY)||'[]');a.unshift(T);localStorage.setItem(DBG_KEY,JSON.stringify(a.slice(0,20)));}catch(e){}
   const r=T;T=null;return r;},
  fail(e){const r=trace.end(false,e&&e.message||e);return '匯入已停止：'+(e&&e.message||e)+(r?'\n\n【除錯】卡在第 '+r.steps.length+' 步「'+r.failStep+'」'+(r.steps.length?'：'+r.steps[r.steps.length-1].d:'')+'\n詳細紀錄：存檔與修復 →「匯入紀錄」。':'');}
 };
 window.LineageImportDebug={key:DBG_KEY,list(){try{return JSON.parse(localStorage.getItem(DBG_KEY)||'[]');}catch(e){return [];}},clear(){try{localStorage.removeItem(DBG_KEY);}catch(e){}}};
 // 11-12（Ping）：共用資料（倉庫、寵物、龍鑽布告欄、血盟、魂魄簿）沒有存檔次數 → 每台裝置逐項記下這些資料的「變動紀錄」（內容雜湊），
 //   合併還原時逐項判斷：備份那份是不是從這台目前的狀態接著動下去的（是＝新的蓋舊的；兩邊都動過＝保留這台的）。
 //   收集冊（布林聯集）不用比：兩邊合起來。
 const SHARED=/^(lineage_idle_warehouse(_classic)?|fb5_pet_roster(_classic)?|fb5_pandora_relic_market_v1|fb5_clan_state_v1|lineage_character_souls_v1)$/,DEX=/^lineage_idle_(card|equip|misc|relic)dex(_classic)?$/,CHAIN='lineage_shared_chain_v2';
 const SHARED_N=k=>/warehouse/.test(k)?'倉庫':/pet_roster/.test(k)?'寵物':/pandora/.test(k)?'龍之鑽石與布告欄':/clan/.test(k)?'血盟':/souls/.test(k)?'魂魄簿':k;
 const fnv=t=>{t=String(t==null?'':t);let h=0x811c9dc5,g=0x01000193;for(let i=0;i<t.length;i++){const c=t.charCodeAt(i);h^=c;h=Math.imul(h,16777619)>>>0;g=(Math.imul(g^c,2654435761)>>>0);}return h.toString(36)+g.toString(36)+t.length.toString(36);};
 const chainOf=keys=>{try{const c=JSON.parse(keys[CHAIN]||'null');return c&&c.keys&&typeof c.keys==='object'?c:{keys:{}};}catch(e){return {keys:{}};}};
 const unionDex=(a,b)=>{try{const x=JSON.parse(a),y=JSON.parse(b);if(!x||!y||typeof x!=='object'||typeof y!=='object'||Array.isArray(x)||Array.isArray(y))return null;const flat=o=>Object.values(o).every(v=>v===true||v===false||typeof v==='number');if(!flat(x)||!flat(y))return null;const o={...x};for(const k of Object.keys(y))if(y[k]&&!o[k])o[k]=y[k];return JSON.stringify(o);}catch(e){return null;}};
 window.LineageSharedChain={SHARED,DEX,KEY:CHAIN,hash:fnv,chainOf,name:SHARED_N,
  record(){try{const c=chainOf({[CHAIN]:localStorage.getItem(CHAIN)});let changed=false;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!SHARED.test(k))continue;const h=fnv(localStorage.getItem(k)),L=c.keys[k]||(c.keys[k]=[]);if(L[L.length-1]!==h){L.push(h);if(L.length>60)L.splice(0,L.length-60);changed=true;}}if(changed)localStorage.setItem(CHAIN,JSON.stringify({v:2,keys:c.keys}));return changed;}catch(e){return false;}}};
 // 11-13（Ping）：換裝置匯入回到舊進度 → 角色多記「每台裝置存到第幾次」（p._devSeq，afk-antisl 存檔時寫）與存檔時間（p._savedAt）
 //   比較兩份同一個角色：某一邊每台裝置的次數都 ≥ 另一邊 → 那邊是接著玩下去的（自動用它）；兩邊各自在不同裝置往前走過 → 分岔，讓玩家選
 //   舊存檔沒有 _devSeq：備份的存檔次數比較多 → 用備份；否則一律讓玩家選（不再自動留這台）
 const DEV_KEY='lineage_device_id_v1';
 const devId=()=>{try{let d=localStorage.getItem(DEV_KEY);if(!d){d='d'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);localStorage.setItem(DEV_KEY,d);}return d;}catch(e){return 'd0';}};
 const roleRel=(pB,pD,rawB,rawD)=>{
  if(rawB===rawD)return 'same';
  const sq=p=>{const n=Number(p&&p._saveSeq);return Number.isSafeInteger(n)&&n>0?n:0;};
  const mB=pB&&pB._devSeq&&typeof pB._devSeq==='object'?pB._devSeq:null,mD=pD&&pD._devSeq&&typeof pD._devSeq==='object'?pD._devSeq:null;
  if(mB&&mD&&Object.keys(mB).length&&Object.keys(mD).length){
   let bA=false,dA=false;for(const k of new Set([...Object.keys(mB),...Object.keys(mD)])){const b=Number(mB[k])||0,d=Number(mD[k])||0;if(b>d)bA=true;if(d>b)dA=true;}
   return bA&&!dA?'backup':dA&&!bA?'device':!bA&&!dA?'same':'diverged';
  }
  if(sq(pB)>sq(pD))return 'backup';
  if(sq(pB)===sq(pD)&&sq(pB)>0&&(pB&&pB.lv)===(pD&&pD.lv)&&(pB&&pB.exp)===(pD&&pD.exp))return 'same';
  return 'diverged';
 };
 const roleSum=p=>({name:(p&&p.name)||'',cls:(p&&p.cls)||'',lv:Number(p&&p.lv)||0,rb:Math.floor(Number(p&&p.rebirth)||0),at:Number(p&&p._savedAt)||0});
 window.LineageDevice={id:devId,KEY:DEV_KEY,rel:roleRel};
 window.LineageSaveGate={
  async importRole(raw,slot){
   trace.start(raw,slot);
   try{
    let cur0=null;try{cur0=typeof _roleReadSavePlayer==='function'?_roleReadSavePlayer(slot):null;}catch(e){}
    trace.step('讀取檔案','大小 '+(raw||'').length+' 字元、開頭「'+String(raw||'').replace(/^\uFEFF/,'').trimStart().slice(0,5)+'」；選的位置 '+slot+'：'+shortP(cur0));
    // 11-11 23:56：完整備份也能「讀回同一個角色自己的舊進度」——從備份裡挑出這個位置那個角色的存檔來用
    let d0=null;try{d0=B.inspect(raw);}catch(e){trace.step('判斷檔案種類','解不開：'+(e.message||e));throw e;}
    trace.step('判斷檔案種類',d0.kind==='full'?'完整備份（裡面有 '+(d0.roles||[]).length+' 個角色）':'單一角色存檔：'+shortP(d0.value&&d0.value.p)+(d0.signed?'，有簽章':'，沒有簽章')+(d0.compressed?'，壓縮過':''));
    if(d0.kind==='full'){const pick=this.roleFromFull(d0,slot);trace.step('從完整備份挑角色',typeof pick==='string'?'找到這個位置的角色':pick.why);if(typeof pick!=='string')throw Error(pick.why);raw=pick;}
    if(!await this.beforeImport(raw,slot,true))return false;
    const decoded=B.decode(raw),doc=decoded.value;
    if(!decoded.signed&&!confirm('此存檔沒有完整性簽章。仍要匯入舊版角色嗎？')){trace.step('玩家按了取消','');trace.end(false,'玩家取消');return false;}
    const shared=['wh','pets','pandoraDiamonds','clanState'];
    if(shared.some(k=>Object.prototype.hasOwnProperty.call(doc,k))&&!confirm('單一角色匯入只帶入角色進度，不會覆蓋共用倉庫、寵物、貨幣或血盟。完整搬家請使用完整資料備份。繼續匯入角色嗎？')){trace.step('玩家按了取消','');trace.end(false,'玩家取消');return false;}
    doc.p.enSeed=LineageIntegrityCore.seed(doc.p);doc.p._roleEpoch=_roleEpoch();doc.p.allies=[];
    for(const k of shared)delete doc[k];
    const key='lineage_idle_save_'+slot;
    const cur=localStorage.getItem(key),reload=cur!==null;
    trace.step(reload?'讀回舊進度檢查':'匯入到空位置',reload?'倉庫存入次數：存檔 '+(Number(doc.p.afkWhPut)||0)+'／帳本 '+(window.__afkReloadLedger?window.__afkReloadLedger.wh(doc.p):'?'):'位置 '+slot);
    if(!reload){try{const IC=window.LineageIntegrityCore,q=Object.assign({},doc.p);q.enSeed=IC.seed(doc.p);const want=IC.identity(q);for(let n=1;n<=SAVE_SLOT_MAX;n++){if(n===slot)continue;const o=typeof _roleReadSavePlayer==='function'?_roleReadSavePlayer(n):null;if(!o)continue;const r=Object.assign({},o);r.enSeed=IC.seed(o);if(IC.identity(r)===want)throw Error('「'+(doc.p.name||'')+'」已經在第 '+n+' 格。要換成這份進度，請選第 '+n+' 格再匯入。');}}catch(e){if(/已經在第/.test(e.message))throw e;}}
    const curSeq=(()=>{try{return Number(B.decode(cur).value.p._saveSeq)||0;}catch(e){return 0;}})(),inSeq=Number(doc.p._saveSeq)||0,newer=inSeq>curSeq;
    if(reload){const why=this.reloadWhy(doc.p,slot);if(why)throw Error(why);if(!confirm(newer?'這份是「'+(doc.p.name||'')+'」比較新的進度（第 '+inSeq+' 次存檔，這裡是第 '+curSeq+' 次）。\n要換成這份進度嗎？這個位置目前的進度會被蓋掉（會先自動備份一份）。':'這份是「'+(doc.p.name||'')+'」自己的舊存檔。\n要讀回這份舊進度嗎？這個位置目前的進度會被蓋掉（會先自動備份一份）。')){trace.step('玩家按了取消','');trace.end(false,'玩家取消');return false;}
     const RL=window.__afkReloadLedger;if(RL)doc.p.afkReloadN=RL.count(doc.p)+1;}
    const apply=async()=>{
     if(localStorage.getItem(key)!==cur)throw Error('目的位置的資料已變更，請重新操作');
     const change={key,before:cur,after:LineageLegacyCodec.wrap(JSON.stringify(doc)),reason:reload?'ROLE_RELOAD':'ROLE_IMPORT'};
     await R.transact(localStorage,[change],s=>LineageBackups.save({...s,originalImport:raw,slot},reload?'role-reload':'role-import'),{integrity:reload?'reload':'import',canWrite:()=>!(typeof state!=='undefined'&&state.running)&&R.scan(R.capture(localStorage)).canRepair});
     if(reload&&window.__afkReloadLedger)window.__afkReloadLedger.bump(doc.p);
     try{const IC=window.LineageIntegrityCore,q=Object.assign({},doc.p);q.enSeed=IC.seed(doc.p);const m=JSON.parse(localStorage.getItem('lineage_uid_imported_v1')||'{}');m[IC.identity(q)]=Date.now();localStorage.setItem('lineage_uid_imported_v1',JSON.stringify(m));}catch(e){}
    };
    trace.step('寫入存檔（保護交易）','先自動備份再寫入');
    await (navigator.locks?navigator.locks.request('lineage-merged-save-write',{mode:'exclusive'},apply):apply());
    trace.step('完成',reload?'讀回成功':'匯入成功');trace.end(true,'');
    renderLoadSelect();alert(reload?(newer?'已換成「'+(doc.p.name||'')+'」比較新的進度；倉庫等共用資料維持原樣。':'已讀回「'+(doc.p.name||'')+'」的舊進度；倉庫等共用資料維持原樣。'):'角色已匯入；共用資料維持原進度。');return true;
   }catch(e){alert(trace.fail(e));return false;}
  },
  roleFromFull(d0,slot){
   const cur=typeof _roleReadSavePlayer==='function'?_roleReadSavePlayer(slot):null,IC=window.LineageIntegrityCore;
   if(!cur||!IC)return {why:'這是完整備份。要讀回某個角色的舊進度，請先選那個角色原本的存檔位置再匯入；要整個還原請到「存檔與修復」。'};
   const want=IC.identity(cur);
   for(const k of d0.roles||[]){try{const v=d0.keys[k],p=B.decode(v).value.p;if(!p)continue;const q=Object.assign({},p);q.enSeed=IC.seed(p);if(IC.identity(q)===want)return v;}catch(e){}}
   return {why:'這份完整備份裡沒有「'+(cur.name||'')+'」。只能讀回同一個角色自己的舊進度；要整個還原請到「存檔與修復」。'};
  },
  // 11-11 21:37 同一個角色讀回自己的舊存檔：只限同一個角色；這份存檔之後有把東西存進倉庫就不行（防洗倉庫）
  reloadWhy(p,slot){
   try{
    const cur=typeof _roleReadSavePlayer==='function'?_roleReadSavePlayer(slot):null;const IC=window.LineageIntegrityCore;
    if(!cur||!IC)return '此位置已有角色，請選擇空的存檔位置。';
    const q=Object.assign({},p);q.enSeed=IC.seed(p);
    if(IC.identity(q)!==IC.identity(cur))return '此位置已有別的角色。只能把同一個角色自己的舊存檔讀回它原本的位置；其他角色請選空的存檔位置。';
    const RL=window.__afkReloadLedger;if(RL&&(Number(p.afkWhPut)||0)<RL.wh(cur))return '這份舊存檔之後，這個角色有把東西存進倉庫，不能讀回這份存檔（避免倉庫裡的東西變成兩份）。';
    return '';
   }catch(e){return '讀不到這個位置的角色：'+e.message;}
  },
  async beforeImport(raw,slot,inner){
   const own=!T;if(own)trace.start(raw,slot);
   try{
    trace.step('遊戲狀態',(typeof state!=='undefined'&&state.running)?'遊戲還在進行中':'在角色選擇畫面');
    if(typeof player!=='undefined'&&player&&player.cls&&typeof state!=='undefined'&&state.running)throw Error('請先返回角色選擇畫面，再匯入存檔。');
    const data=B.inspect(raw);
    trace.step('檢查職業傳承資料',data.kind==='role'?shortP(data.value.p)+(data.value.p.classPath?'，有職業進化 '+data.value.p.classPath.route+' 第 '+data.value.p.classPath.stage+' 段':'，沒有職業進化'):'完整備份');
    if(data.kind==='role'&&window.LineageClassCore&&!LineageClassCore.valid(data.value.p))throw Error('職業傳承資料與目前版本不相容，未修改原始存檔');if(data.kind!=='role')throw Error('這是完整備份，請到「存檔與修復」還原。');
    trace.step('檢查存檔位置','位置 '+slot+'（上限 '+(typeof SAVE_SLOT_MAX!=='undefined'?SAVE_SLOT_MAX:'?')+'）'+(slotSummary(slot)?'，已有角色':'，空位置'));
    if(!Number.isInteger(slot)||slot<1||slot>SAVE_SLOT_MAX)throw Error('請先選擇有效的存檔位置。');
    if(slotSummary(slot)){trace.step('同一個角色檢查','備份：'+shortP(data.value.p));const why=this.reloadWhy(data.value.p,slot);if(why)throw Error(why);}
    const keys=R.capture(localStorage),status=R.scan(keys);
    trace.step('其他分頁檢查',status.canRepair?'沒有其他分頁在用':'有其他遊戲分頁開著');
    if(!status.canRepair)throw Error('其他遊戲分頁仍在使用資料，請先關閉後再匯入。');
    trace.step('檢查席琳界約資料','');
    if(window.LineageSherineCore&&!LineageSherineCore.valid(data.value.p))throw Error('席琳界約資料無法驗證');
    const compatibility=B.analyzeCompatibility(data.value,profile(data.value.p));
    trace.step('版本相容檢查',compatibility.ok?'相容':(compatibility.blockers||[]).map(b=>b.message).join('；'));
    if(!compatibility.ok)throw Error(compatibility.blockers[0].message+' 原始檔已保留，請使用對應版本。');
    trace.step('匯入前自動備份','');
    const snapshot={format:R.ID,schema:1,createdAt:new Date().toISOString(),keys,changes:[],originalImport:raw,slot};
    await LineageBackups.save(snapshot,'before-import');
    const after=R.capture(localStorage);
    if(!R.scan(after).canRepair)throw Error('備份期間有其他遊戲分頁啟動，請關閉後重新匯入。');
    // Session registry heartbeats may change harmlessly; every other source key must remain stable.
    const stable=k=>k!=='fb5_active_role_sessions_v1'&&!/^afk_diag_/.test(k);
    for(const k of new Set([...Object.keys(keys),...Object.keys(after)]))if(stable(k)&&keys[k]!==after[k]){trace.step('備份期間資料變動','變動的資料：'+k);throw Error('備份期間資料已變更，請重新匯入。');}
    if(own)trace.end(true,'檢查通過');
    return true;
   }catch(e){alert(trace.fail(e));return false;}
  },
  // 匯入前預覽：這台已經有角色時，列出每個角色的比較結果與「兩台都有變動」的共用資料（afk-fullsave 用來問玩家）
  async mergePreview(pack){
   const data=B.inspect(JSON.stringify(pack));if(data.kind!=='full')return null;
   const cur0=R.capture(localStorage),curRoles=B.roleKeys(cur0);if(!curRoles.length)return {roles:[],shared:[],deviceHas:false};
   const IC=window.LineageIntegrityCore,idOf=p=>{const q=Object.assign({},p);q.enSeed=IC.seed(p);return IC.identity(q);},dec=raw=>{try{return B.decode(raw).value.p;}catch(e){return null;}};
   const mine={};for(const k of curRoles){const p=dec(cur0[k]);if(p)mine[idOf(p)]={key:k,p};}
   const roles=[];for(const k of B.roleKeys(data.keys)){const p=dec(data.keys[k]);if(!p)continue;const id=idOf(p),m=mine[id];
    if(m)roles.push({id,slot:Number(String(m.key).replace(/\D+/g,''))||0,rel:roleRel(p,m.p,data.keys[k],cur0[m.key]),dev:roleSum(m.p),bak:roleSum(p)});else roles.push({id,slot:0,rel:'new',bak:roleSum(p)});}
   const cB=chainOf(data.keys),cD=chainOf(cur0),shared=[];
   for(const k of Object.keys(data.keys)){if(!SHARED.test(k)||!Object.prototype.hasOwnProperty.call(cur0,k))continue;const hB=fnv(data.keys[k]),hD=fnv(cur0[k]);if(hB===hD)continue;const histB=cB.keys[k]||[],histD=cD.keys[k]||[];if(histB.includes(hD)||histD.includes(hB))continue;if(!shared.includes(SHARED_N(k)))shared.push(SHARED_N(k));}
   return {roles,shared,deviceHas:true,deviceOnly:curRoles.filter(k=>{const p=dec(cur0[k]);return p&&!roles.some(r=>r.id===idOf(p));}).length};
  },
  // opt.mode：'replace'＝整台換成這份備份；'merge'（預設）＝逐格比較。opt.pick[id]：分岔的角色選 'backup'／'device'；opt.shared：兩台都動過的共用資料選 'backup'／'device'
  async restoreFull(pack,opt){
   opt=opt||{};
   if(typeof state!=='undefined'&&state.running)throw Error('請先返回角色選擇畫面再還原。');
   const data=B.inspect(JSON.stringify(pack));if(data.kind!=='full')throw Error('不是完整資料備份。');
   const qp=R.quarantinePlan(data.keys);
   if(qp.count){
    if(!await confirm('備份有 '+qp.count+' 筆缺少物品 ID。是否完整備份後封存異常記錄，再還原其餘內容？不猜造或刪除原記錄。'))throw Error('已取消封存，原檔未更改');
    await LineageBackups.save({format:R.ID,schema:1,keys:data.keys,changes:[],originalImport:JSON.stringify(pack)},'import-original');
    data.keys={...data.keys};for(const change of qp.changes)data.keys[change.key]=change.after;
   }
   if(R.scan(data.keys).issues.some(x=>x.severity==='critical'))throw Error('備份含有毀損角色，沒有寫入任何資料。');
   for(const key of B.roleKeys(data.keys)){
    const role=B.decode(data.keys[key]).value;
    if(window.LineageClassCore&&!LineageClassCore.valid(role.p))throw Error('備份中的職業傳承資料無法驗證');
    if(window.LineageSherineCore&&!LineageSherineCore.valid(role.p))throw Error('席琳界約資料無法驗證');
    const c=B.analyzeCompatibility(role,profile(role.p));if(!c.ok)throw Error(key+' '+(c.blockers[0].location||'')+'：'+c.blockers[0].message);
   }
   const soulKey=window.LineageClasses?.KEY;if(soulKey&&data.keys[soulKey]&&!LineageClassCore.validVault(JSON.parse(data.keys[soulKey])))throw Error('備份中的魂魄簿無法驗證');
   // 11-12（Ping）：已經在玩的裝置 → 合併還原：每格角色留比較新的；共用資料只有「備份是從這台接著動下去的」才用備份的
   const cur0=R.capture(localStorage),curRoles=B.roleKeys(cur0);let report=null;
   const bumpTo=(raw,n)=>{try{const doc=B.decode(raw).value;if(!doc||!doc.p)return raw;doc.p._saveSeq=n;return LineageLegacyCodec.wrap(JSON.stringify(doc));}catch(e){return raw;}};
   if(curRoles.length&&opt.mode==='replace'){
    // 整台換成備份：角色、共用資料全部用備份的；只有「備份是這台同一個角色的舊進度」的不換（讀舊檔＝重，不能拿自己的舊備份回到過去）
    const IC=window.LineageIntegrityCore,idOf=p=>{const q=Object.assign({},p);q.enSeed=IC.seed(p);return IC.identity(q);},dec=raw=>{try{return B.decode(raw).value.p;}catch(e){return null;}};
    let led=null;try{led=(await window.LineageIntegrityStore.read()).ledger;}catch(e){}
    const mine={};for(const k of curRoles){const p=dec(cur0[k]);if(p)mine[idOf(p)]={key:k,p};}
    report={replaced:[],kept:[],added:[],skipped:[],shared:{},mode:'replace'};const out={...data.keys},name=p=>(p&&p.name)||'（未命名）',slotN=k=>Number(String(k).replace(/\D+/g,''))||k;
    for(const k of B.roleKeys(data.keys)){const p=dec(data.keys[k]);if(!p)continue;const id=idOf(p),m=mine[id],last=Math.max(m?(Number(m.p._saveSeq)||0):0,led&&led.seq?Number(led.seq[id])||0:0);
     if(m&&roleRel(p,m.p,data.keys[k],cur0[m.key])==='device'){delete out[k];let dest=Object.prototype.hasOwnProperty.call(out,m.key)?null:m.key;if(!dest)for(let n=1;n<=(typeof SAVE_SLOT_MAX!=='undefined'?SAVE_SLOT_MAX:40);n++){const kk='lineage_idle_save_'+n;if(!Object.prototype.hasOwnProperty.call(out,kk)){dest=kk;break;}}if(dest)out[dest]=cur0[m.key];report.kept.push('第 '+slotN(dest||m.key)+' 格「'+name(m.p)+'」（備份是這個角色比較舊的進度）');continue;}
     if((Number(p._saveSeq)||0)<=last)out[k]=bumpTo(data.keys[k],last+1);
     report.replaced.push('第 '+slotN(k)+' 格「'+name(p)+'」');}
    data.keys=out;
   }
   else if(curRoles.length){
    const IC=window.LineageIntegrityCore,seqOf=p=>IC.saveSeq?IC.saveSeq(p):(Number(p&&p._saveSeq)||0),idOf=p=>{const q=Object.assign({},p);q.enSeed=IC.seed(p);return IC.identity(q);};
    const dec=raw=>{try{return B.decode(raw).value.p;}catch(e){return null;}};
    let led=null;try{led=(await window.LineageIntegrityStore.read()).ledger;}catch(e){}
    const mine={};for(const k of curRoles){const p=dec(cur0[k]);if(p)mine[idOf(p)]={key:k,p};}
    const impIds={};const out={...cur0};report={replaced:[],kept:[],added:[],skipped:[],shared:''};
    const name=p=>(p&&p.name)||'（未命名）',slotN=k=>Number(String(k).replace(/\D+/g,''))||k;
    for(const k of B.roleKeys(data.keys)){
     const p=dec(data.keys[k]);if(!p)continue;const id=idOf(p),m=mine[id];
     if(m){const rel=roleRel(p,m.p,data.keys[k],cur0[m.key]),useB=rel==='backup'||(rel==='diverged'&&(opt.pick&&opt.pick[id])==='backup');
      if(useB){const last=Math.max(seqOf(m.p),led&&led.seq?Number(led.seq[id])||0:0);out[m.key]=seqOf(p)>last?data.keys[k]:bumpTo(data.keys[k],last+1);impIds[id]=Date.now();report.replaced.push('第 '+slotN(m.key)+' 格「'+name(p)+'」'+(rel==='diverged'?'（你選了備份）':'（備份比較新）'));}
      else report.kept.push('第 '+slotN(m.key)+' 格「'+name(m.p)+'」'+(rel==='diverged'?'（你選了這台）':rel==='same'?'（兩邊一樣）':'（這台比較新）'));continue;}
     const last=led&&led.seq?Number(led.seq[id])||0:0,seen=!!(led&&led.seen&&Object.prototype.hasOwnProperty.call(led.seen,id));
     if(seen&&seqOf(p)<=last){report.skipped.push('「'+name(p)+'」（這台以前有過、這份比較舊）');continue;}
     let dest=Object.prototype.hasOwnProperty.call(out,k)?null:k;
     if(!dest)for(let n=1;n<=(typeof SAVE_SLOT_MAX!=='undefined'?SAVE_SLOT_MAX:40);n++){const kk='lineage_idle_save_'+n;if(!Object.prototype.hasOwnProperty.call(out,kk)){dest=kk;break;}}
     if(!dest){report.skipped.push('「'+name(p)+'」（沒有空的存檔位置）');continue;}
     out[dest]=data.keys[k];impIds[id]=Date.now();report.added.push('第 '+slotN(dest)+' 格「'+name(p)+'」');
    }
    // 共用資料逐項比：備份是從這台目前的狀態接著動下去的 → 用備份的；這台比較新或兩邊都動過 → 保留這台的
    const cB=chainOf(data.keys),cD=chainOf(cur0),sh={};
    for(const k of new Set([...Object.keys(cur0),...Object.keys(data.keys)])){
     if(DEX.test(k)){if(Object.prototype.hasOwnProperty.call(data.keys,k)){if(!Object.prototype.hasOwnProperty.call(cur0,k))out[k]=data.keys[k];else{const u=unionDex(cur0[k],data.keys[k]);if(u!=null)out[k]=u;}}continue;}
     if(!SHARED.test(k))continue;
     const inB=Object.prototype.hasOwnProperty.call(data.keys,k),inD=Object.prototype.hasOwnProperty.call(cur0,k);if(!inB)continue;
     const hB=fnv(data.keys[k]),hD=inD?fnv(cur0[k]):null,histB=cB.keys[k]||[],histD=cD.keys[k]||[];let r;
     if(!inD){out[k]=data.keys[k];r='backup';}
     else if(hB===hD)r='same';
     else if(histB.includes(hD)){out[k]=data.keys[k];r='backup';const L=histD.slice();for(const h of histB)if(!L.includes(h))L.push(h);cD.keys[k]=L.slice(-60);}
     else if(histD.includes(hB))r='device-newer';
     else if(opt.shared==='backup'){out[k]=data.keys[k];r='both-backup';}
     else r='both';
     sh[SHARED_N(k)]=r;
    }
    out[CHAIN]=JSON.stringify({v:2,keys:cD.keys});report.shared=sh;
    try{const m=JSON.parse(out['lineage_uid_imported_v1']||'{}');Object.assign(m,impIds);out['lineage_uid_imported_v1']=JSON.stringify(m);}catch(e){}
    data.keys=out;
   }
   // 11-13：裝置代號是這台自己的，不跟著備份搬（否則兩台會變成同一個代號）
   data.keys={...data.keys};if(Object.prototype.hasOwnProperty.call(cur0,DEV_KEY))data.keys[DEV_KEY]=cur0[DEV_KEY];else delete data.keys[DEV_KEY];
   // 11-11 14:13：電腦上的角色存檔有時是沒壓縮的明文（一格 180 萬字），手機寫不進去 → 角色與倉庫在寫入前先壓縮（遊戲讀取本來就會自動解壓）
   if(typeof LZString!=='undefined'){data.keys={...data.keys};for(const k of Object.keys(data.keys)){const v=data.keys[k];if((/^lineage_idle_save(?:_\d+)?$/.test(k)||/^lineage_idle_warehouse(?:_[a-z]+)*$/.test(k))&&typeof v==='string'&&v.length>20000&&v.slice(0,4)!=='LZ1:'){try{const z='LZ1:'+LZString.compressToUTF16(v);if(LZString.decompressFromUTF16(z.slice(4))===v)data.keys[k]=z;}catch{}}}}
   const apply=()=>{if(typeof _lzWorkerRev!=='undefined')for(const k of new Set([...Object.keys(data.keys),...Object.keys(R.capture(localStorage))]))_lzWorkerRev[k]=(_lzWorkerRev[k]||0)+1;return R.transact(localStorage,R.fullRestorePlan(data.keys,R.capture(localStorage)),snapshot=>LineageBackups.save(snapshot,'full-restore'),{canWrite:()=>R.scan(R.capture(localStorage)).canRepair});};
   const res=await (navigator.locks?navigator.locks.request('lineage-merged-save-write',{mode:'exclusive'},apply):apply());
   if(report)try{sessionStorage.setItem('lineage_merge_report',JSON.stringify(report));}catch(e){}
   return Object.assign({},res,{merge:report});
  }
 };
})();
