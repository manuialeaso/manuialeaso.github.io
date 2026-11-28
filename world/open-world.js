'use strict';
// The visible population uses the same monster objects as Dimension's combat tick.
window.GiranRoam=(()=>{
  const sight=20, release=26;
  let densityOwner,densityMap,densityTier,targetCount;
  function capacity(){
    const p=typeof player==='object'?player:null,key=mapState.current,tier=GiranHunt.activePopulation(p?.giranHunt);
    if(p!==densityOwner||key!==densityMap||tier!==densityTier){
      densityOwner=p;densityMap=key;densityTier=tier;targetCount=GiranHunt.rollPopulation(tier);
    }
    return window.TwistedSpace?.here()?Math.min(TwistedSpace.limit,Math.max(TwistedSpace.baseSlots,targetCount)):targetCount;
  }
  let owner=null,zone='',focus=null,activeField=null,request=null,stamp='',nextScan=0,patrolAt=0,patrolCount=0;
  let enteringField=true;
  let targetStamp='',nextSearch=0,candidate=null;
  const residents=new Map();
  const gap=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  const alive=m=>m&&!m._dead&&m.curHp>0;
  const manual=()=>typeof player==='object'&&player?.giranCombatMode==='manual';
  function resetChoice(){focus=null;candidate=null;nextSearch=0;targetStamp='';}
  function actorChanged(){
    if(owner!==player){owner=player;zone='';activeField=null;residents.clear();resetChoice();stamp='';nextScan=0;}
    if(zone!==mapState.current){zone=mapState.current;resetChoice();stamp='';nextScan=0;patrolAt=0;enteringField=true;}
  }
  function leaveVillage(world){
    actorChanged();
    activeField=world;enteringField=false;stamp='';nextScan=0;
  }
  function choose(m){
    actorChanged();focus=alive(m)?m:null;candidate=null;nextSearch=0;
    const idx=focus?mapState.mobs.indexOf(focus):-1;
    if(mapState.targetIdx!==idx)setTarget(idx);
    window.GiranFieldUI?.refresh();
  }
  function mode(value){
    if(!['auto','manual'].includes(value)||!player?.cls||document.body.classList.contains('giran-guest'))return;
    actorChanged();player.giranCombatMode=value;choose(null);
    GiranCombat.field?.cancel?.();patrolAt=0;
    saveGame();window.GiranFieldUI?.refresh();
  }
  function locked(){
    actorChanged();
    if(!alive(focus)||!mapState.mobs.includes(focus))focus=null;
    return focus;
  }
  const desktop=()=>document.documentElement.dataset.playMode!=='dimension'&&!GiranPartyView.mobile();
  // An authored encounter owns its queue, boss slot and completion conditions.
  // Scale the slots it can fill with ordinary enemies, leaving that queue in charge.
  function instanceSlots(){
    if(!desktop())return 0;
    const k=mapState.current;
    if(!k)return 0;
    if(KING_ROOMS[k]?.minion||ANTHARAS_AREA_BOSS[k])return capacity()+1;
    if(GiranBossRooms.room(k)&&!KING_ROOMS[k]&&!PURE_BOSS_MAPS.includes(k)&&
       DB.maps[k]?.some(id=>DB.mobs[id]&&!DB.mobs[id].boss))return capacity();
    if(k==='afk_ghostship'||k==='rift_battle'||state.prideClimb||state.oblivion)return capacity();
    if(k==='afk_hardin_time'&&window.__afkHardin?.run()?.stage==='wave')return capacity();
    if(k.startsWith('afk_solo_')){
      const r=window.__afkNewZones?.run();
      if(r?.phase==='room')return Math.min(capacity(),r.D.rooms[r.ri].k);
    }
    if(k.startsWith('afk_guard_dg_'))return Math.min(capacity(),window.__afkGuardRing?.DG?.perWave||0);
    return 0;
  }
  function waveSize(nativeCount){return desktop()?capacity():nativeCount;}
  let fieldKey,fieldPool,hasFieldPopulation=false,mobileHuntingField=false;
  function owns(){
    if(!GiranCombat.inWorld()&&!(player?.giranWorld?.key===mapState.current&&player.giranWorld.sheltered))return false;
    const k=mapState.current,pool=DB.maps[k];
    if(!k)return false;
    if(state.prideClimb||state.riftRun||state.oblivion||state.antharas)return false;
    if(k!==fieldKey||pool!==fieldPool){
      fieldKey=k;fieldPool=pool;
      mobileHuntingField=!/^(?:afk_|dom_|hidden_)|_lair$/.test(k)&&
        (k==='training'||k.startsWith('giran_floor_')||['wild','dungeon'].includes(mapCategoryOf(k)));
      hasFieldPopulation=!!pool?.some(id=>DB.mobs[id]&&!DB.mobs[id].boss)&&!KING_ROOMS[k]&&!PURE_BOSS_MAPS.includes(k)&&
        !GiranBossRooms.room(k)&&!ANTHARAS_AREA_BOSS[k]&&!isSiegeArea(k)&&
        (!/^(?:town_|afk_|pride_f\d|cr_|siege_)/.test(k)||k==='afk_flame_depth')&&k!=='rift_battle'&&k!=='arena_pvp';
    }
    if(!hasFieldPopulation||!mobileHuntingField&&!desktop())return false;
    if(typeof npcClanGroupBattleActive==='function'&&npcClanGroupBattleActive()||typeof wcMassTauntGroupBattleActive==='function'&&wcMassTauntGroupBattleActive())return false;
    return true;
  }
  function eligibleTarget(m){
    return alive(m)&&(!player.giranHunt||GiranHunt.allows(m));
  }
  function selectTarget(){
    const explicit=locked();
    if(manual())return GiranCombat.inWorld()?explicit:null;
    const preferBoss=!!player.giranHunt?.bossFirst;
    if(explicit&&eligibleTarget(explicit)&&(!preferBoss||explicit.boss))return explicit;
    const f=GiranCombat.field;
    if(!f?.ready())return null;
    const now=performance.now(),p=f.leader,tag=[zone,p.x,p.y,preferBoss].join('/');
    if(now<nextSearch&&targetStamp===tag&&(!candidate||eligibleTarget(candidate)&&mapState.mobs.includes(candidate)))return candidate;
    targetStamp=tag;nextSearch=now+650;
    // Retain a living reachable opponent already under attack. New acquisitions use walking distance.
    const mobs=mapState.mobs.filter(eligibleTarget).map(m=>[m,f.point(m)]).filter(pair=>pair[1])
      .sort((a,b)=>gap(a[1],p)-gap(b[1],p));
    if(candidate&&mapState.mobs.includes(candidate)&&alive(candidate)){
      const index=mobs.findIndex(entry=>entry[0]===candidate);
      if(index>=0&&gap(mobs[index][1],p)<=GiranCombat.reach(player,'basic')+2)mobs.unshift(...mobs.splice(index,1));
    }
    if(preferBoss)mobs.sort((a,b)=>Number(!!b[0].boss)-Number(!!a[0].boss));
    candidate=null;
    const ground=f.board.reachable?.cells;
    const captainOnFloor=ground?.has(p.x*131072+p.y),reach=GiranCombat.reach(player,'basic');
    for(const [m,at] of mobs){
      if(gap(p,at)>(GiranBossRooms.home(f.terrain,m)?8:sight))continue;
      // The board already floods the nearby floor through traversable edges.
      // Search explicitly only for targets beyond that connected neighbourhood.
      if(!(captainOnFloor&&ground.has(at.x*131072+at.y))&&!GiranGeometry.canHit(f.terrain.world,p,at,reach)){
        const found=f.terrain.world.findPathNear(p.x,p.y,at.x,at.y);
        if(!found||!GiranGeometry.canHit(f.terrain.world,{x:found.to[0],y:found.to[1]},at,reach))continue;
      }
      candidate=m;break;
    }
    return candidate;
  }
  function mix(x,y,s){
    let n=Math.imul(x^s,73856093)^Math.imul(y+s,19349663);
    n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;
  }
  let spawnFloor=null,spawnDensity=0,spawnSites=[];
  const fieldSource=window.GiranHuntingData;
  const authoredCells=new Map();
  for(const rows of Object.values(fieldSource?.buckets||{})){
    for(const [number,x,y] of rows){
      if(Object.hasOwn(GiranAtlasData.nativeFallback,number)){
        authoredCells.set(x*131072+y,{id:GiranAtlas.mobKey(number),key:[fieldSource.map,number,x,y].join('/')});
      }
    }
  }
  function tiles(f){
    const cap=capacity(),dense=cap>=12;
    if(spawnFloor===f.board.floor&&spawnDensity===cap)return spawnSites;
    // Formation's flood fill uses the actual loaded, connected floor. Keep spawn sites
    // stable as the camera moves, and never put an enemy on a roof or behind a closed wall.
    const salt=[...zone].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0)|0,7);
    const originalMap=fieldSource && (f.terrain.sourceMap??f.terrain.world.map.id)===fieldSource.map;
    const cells=f.board.floor.filter(([x,y])=>gap({x,y},f.leader)>=3&&GiranGates.outsideVillage(f.terrain,x,y))
      .map(([x,y])=>{
        const original=originalMap && authoredCells.get(x*131072+y);
        return {x,y,id:original?.id,key:original?.key||'field/'+zone+'/'+x+'/'+y,rank:mix(x,y,salt),near:gap({x,y},f.leader)<=8};
      }).sort((a,b)=>Number(!!b.id)-Number(!!a.id)||a.rank-b.rank);
    const selected=[],busy=new Set();
    const index=(x,y)=>x*131072+y;
    function add(cell,separation){
      for(let dx=1-separation;dx<separation;dx++)for(let dy=1-separation;dy<separation;dy++){
        if(busy.has(index(cell.x+dx,cell.y+dy)))return;
      }
      selected.push(cell);busy.add(index(cell.x,cell.y));
    }
    if(dense){
      const near=cells.filter(c=>c.near),nearCount=Math.ceil(cap*.6);
      for(const spacing of [2,1]){
        for(const cell of near){if(selected.length>=nearCount)break;add(cell,spacing);}
      }
    }
    for(const cell of cells)add(cell,dense?2:3);
    for(const cell of cells)add(cell,dense?1:2);
    spawnFloor=f.board.floor;spawnDensity=cap;spawnSites=selected;return selected;
  }
  function waveCell(f,slot){
    const sites=tiles(f);
    for(let j=0;j<sites.length;j++){
      const p=sites[(slot+j)%sites.length];
      if(!f.board.occupied(null,p.x,p.y))return [p.x,p.y];
    }
    return null;
  }
  function freeSlot(){
    const open=mapState.mobs.findIndex(m=>!m);return open<0?mapState.mobs.length:open;
  }
  function store(m,point){
    const rec=residents.get(point.key)||{};
    rec.mob=m;rec.zone=zone;rec.seen=Date.now();residents.set(point.key,rec);return rec;
  }
  // 11-27 Ping：新生的怪從畫面邊緣出生再走進來（剛進地圖的第一波照舊直接在場上）。
  // 已載入的地形只到畫面範圍，畫面外沒有可站的格子，所以改成避開畫面中間 76% 的區域。
  function onScreen(f,p){
    const t=f.terrain;if(!t?.camera)return false;
    const [x,y]=t.project(p.x,p.y);
    return x>t.width*.12&&y>t.height*.12&&x<t.width*.88&&y<t.height*.88;
  }
  function make(f,p,hidden=false){
    const saved=residents.get(p.key),index=freeSlot();
    const twisted=window.TwistedSpace?.here()?TwistedSpace:null;
    if(twisted&&!twisted.canPlace(index))return false;
    if(saved&&alive(saved.mob)&&saved.zone===zone&&(!twisted||canRestore(saved.mob))){
      const m=saved.mob,x=saved.x??p.x,y=saved.y??p.y;
      m._giranSpawn.cell=gap(f.leader,{x,y})<=sight&&GiranGates.outsideVillage(f.terrain,x,y)?[x,y]:[p.x,p.y];
      mapState.mobs[index]=m;return true;
    }
    if(f.board.occupied(null,p.x,p.y)||gap(f.leader,p)<2)return false;
    if(hidden&&onScreen(f,p))return false;
    request={index,p};
    try{spawnMob(index);}finally{request=null;}
    const m=mapState.mobs[index];if(!alive(m))return false;
    if(!m._giranSpawn)m._giranSpawn=twisted?.resident(m)?
      {key:p.key,kind:'ordinary',cell:[p.x,p.y]}:{key:'event/'+zone+'/'+m.uid,kind:'event',cell:[p.x,p.y]};
    const at=m._giranSpawn;at.home ||= at.cell.slice();store(m,at);return true;
    function canRestore(mob){
      if(!twisted.resident(mob)||!!mob.boss!==twisted.needsBoss(index))return false;
      return !mob.boss||!mapState.mobs.some(other=>alive(other)&&other.boss&&other.n===mob.n);
    }
  }
  // ── 11-28 Ping：生怪跟奇岩版一樣——怪固定在原版出生點，走過去才遇到；打掉後該點 10 秒重生 ──
  //   主大陸用 GiranHuntingData（奇岩來源 3,232 點）；其他地圖用 3.50C 伺服器 spawnlist（GiranSpawnPoints）；
  //   兩者都沒有的地圖，依地形在每個 16×16 區塊固定算出出生點（同一張圖每次都一樣）。扭亂時空照舊用自己的規則。
  //   密度三檔：每個出生點的隻數 ×1／×2／×3。效能保護：同時在場最多 60 隻（手機 24 隻），先補離隊長近的。
  const FIXED_CAP=()=>GiranPartyView.mobile()?24:60, FIXED_REACH=30, FIXED_RELEASE=34;
  let fixedPts={map:null}, fixedFloor={floor:null,set:null}, fixedSlots=0;
  function hash32(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function fixedPoints(f){
    const map=f.terrain.sourceMap??f.terrain.world.map?.id;
    if(fixedPts.map===map&&fixedPts.zone===zone)return fixedPts;
    const list=[],grid=new Map();
    if(fieldSource&&map===fieldSource.map){for(const rows of Object.values(fieldSource.buckets))for(const [n,x,y,c] of rows)list.push({npc:n,x,y,c:Math.max(1,c||1)});}
    else for(const r of window.GiranSpawnPoints?.maps?.[map]||[])list.push({npc:r[0],x:r[1],y:r[2],c:Math.max(1,r[3]||1),rx:r[4]||0,ry:r[5]||0,box:r[6]||r[8]?[r[6],r[7],r[8],r[9]]:null});
    list.forEach((p,i)=>{p.i=i;const k=(p.x>>4)+','+(p.y>>4);let g=grid.get(k);if(!g)grid.set(k,g=[]);g.push(p);});
    return fixedPts={map,zone,list,grid,made:new Set(),generated:!list.length};
  }
  function fixedPool(){return (DB.maps[mapState.current]||[]).filter(id=>DB.mobs[id]&&!DB.mobs[id].boss&&!DB.mobs[id].trollPlayer);}
  function fixedMob(p,pool){
    if(p.id!==undefined)return p.id;
    let id=null;
    if(p.npc&&Object.hasOwn(GiranAtlasData.nativeFallback,p.npc)){const k=GiranAtlas.mobKey(p.npc);if(DB.mobs[k])id=k;}
    if(!id&&pool.length){
      const lv=window.GiranSpawnPoints?.levels?.[p.npc];
      if(lv>0){let best=null,bd=1e9;for(const k of pool){const d=Math.abs((DB.mobs[k].lv||1)-lv);if(d<bd){bd=d;best=k;}}id=best;}
      else id=pool[hash32(zone+'/'+p.i)%pool.length];
    }
    return p.id=id;
  }
  // 沒有出生資料的地圖：每個 16×16 區塊整塊載入後，依地形固定算出出生點（約每 100 格可走地 1 點、每點 1～2 隻）
  function generateBlock(f,P,bx,by,pool){
    const key=bx+','+by;if(P.made.has(key)||!pool.length)return;
    const w=f.terrain.world,d=w.map?.d;if(!d)return;
    const x0=bx*16-d.gameX0,y0=by*16-d.gameY0;
    if(!w.viewReady([x0,y0,x0+15,y0+15],true))return;
    P.made.add(key);
    const cells=[];
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(w.pass(x0+x,y0+y)&&w.hasGround(x0+x,y0+y))cells.push([bx*16+x,by*16+y]);
    const n=Math.floor((cells.length+hash32(P.map+'/'+key)%100)/100);
    const out=[];
    for(let i=0;i<n&&cells.length;i++){
      const h=hash32(P.map+'/'+key+'/'+i),[x,y]=cells[h%cells.length];
      const p={i:P.list.length,x,y,c:1+(h>>>8)%2,id:pool[(h>>>12)%pool.length]};
      P.list.push(p);out.push(p);
    }
    if(out.length)P.grid.set(key,(P.grid.get(key)||[]).concat(out));
  }
  function floorSet(f){
    if(fixedFloor.floor!==f.board.floor){const s=new Set();for(const [x,y] of f.board.floor)s.add(x*131072+y);fixedFloor={floor:f.board.floor,set:s};}
    return fixedFloor.set;
  }
  function fixedSites(f){
    const P=fixedPoints(f),pool=fixedPool(),floor=floorSet(f),leader=f.leader,mult=GiranHunt.activePopulation(player?.giranHunt);
    const out=[],bx0=(leader.x-FIXED_REACH)>>4,bx1=(leader.x+FIXED_REACH)>>4,by0=(leader.y-FIXED_REACH)>>4,by1=(leader.y+FIXED_REACH)>>4;
    for(let bx=bx0;bx<=bx1;bx++)for(let by=by0;by<=by1;by++){
      if(P.generated)generateBlock(f,P,bx,by,pool);
      for(const p of P.grid.get(bx+','+by)||[]){
        if(gap(p,leader)>FIXED_REACH)continue;
        const id=fixedMob(p,pool);if(!id)continue;
        const n=p.c*mult;
        for(let k=0;k<n;k++){
          let x=p.x,y=p.y;
          const box=p.box||(p.rx||p.ry?[p.x-p.rx,p.y-p.ry,p.x+p.rx,p.y+p.ry]:null);
          if(box){   // 原版的隨機範圍：在範圍內固定挑一格可站的地
            const w=Math.max(1,box[2]-box[0]+1),h=Math.max(1,box[3]-box[1]+1);
            for(let t=0;t<8;t++){const r=hash32(P.map+'/'+p.i+'/'+k+'/'+t),cx=box[0]+r%w,cy=box[1]+(r>>>12)%h;if(floor.has(cx*131072+cy)){x=cx;y=cy;break;}}
          }
          if(!floor.has(x*131072+y)||!GiranGates.outsideVillage(f.terrain,x,y))continue;
          out.push({x,y,id,key:'sp/'+P.map+'/'+p.i+'/'+k});
        }
      }
    }
    out.sort((a,b)=>gap(a,leader)-gap(b,leader));
    return out;
  }
  function updateFixed(f,now){
    const {leader}=f,cap=FIXED_CAP();
    nextScan=now+500;
    let changed=false;
    const sites=fixedSites(f);fixedSlots=sites.length;
    const used=new Set();let live=0;
    for(const [i,m] of mapState.mobs.entries()){
      if(!alive(m))continue;
      const tag=m._giranSpawn;
      if(tag&&tag.kind!=='ordinary'){live++;continue;}   // 事件、首領等照舊
      const at=f.point(m),pos=at||(tag?{x:tag.cell[0],y:tag.cell[1]}:null);
      if(!tag||!tag.key.startsWith('sp/')||!pos||gap(leader,pos)>FIXED_RELEASE||!GiranGates.outsideVillage(f.terrain,pos.x,pos.y)){
        if(tag&&tag.key.startsWith('sp/')){const rec=store(m,tag);rec.x=pos?.x;rec.y=pos?.y;}
        mapState.mobs[i]=null;if(mapState.targetIdx===i)mapState.targetIdx=-1;
        if(focus===m||candidate===m)resetChoice();changed=true;continue;
      }
      const rec=store(m,tag);rec.x=pos.x;rec.y=pos.y;used.add(tag.key);live++;
    }
    if(GiranWorldBosses.spawn(freeSlot()))changed=true;   // 原版首領：固定點、10 分鐘重生（照舊）
    let arrivals=0;const wave=enteringField?24:8;enteringField=false;
    for(const p of sites){
      if(live>=cap||arrivals>=wave)break;
      if(used.has(p.key)||(player.giranHuntRecovery?.[p.key]||0)>Date.now())continue;
      if(!make(f,p,false))continue;
      used.add(p.key);live++;arrivals++;changed=true;
    }
    if(arrivals>=wave)nextScan=now+120;
    if(residents.size>600){
      const stale=[...residents].filter(([,r])=>!mapState.mobs.includes(r.mob)).sort((a,b)=>a[1].seen-b[1].seen);
      for(const [k] of stale.slice(0,residents.size-480))residents.delete(k);
    }
    if(changed){renderMobs();nextSearch=0;}
  }
  function update(f,now){
    actorChanged();
    if(!owns()||!f.ready())return;
    if(activeField!==f.terrain.world){activeField=f.terrain.world;stamp='';enteringField=true;}
    const cap=capacity(),{leader,terrain}=f,prefix=zone+'/'+terrain.revision+'/'+leader.x+'/'+leader.y+'/'+cap;
    if(now<nextScan)return;
    // Across the village boundary, keep the same live residents for the return trip.
    if(!GiranGates.huntingGround(terrain,leader)){
      enteringField=false;
      let removed=false;
      for(const [i,m] of mapState.mobs.entries()){
        if(!alive(m)||m._giranSpawn?.kind!=='ordinary'&&m._giranSpawn)continue;
        if(m._giranSpawn)store(m,m._giranSpawn);
        mapState.mobs[i]=null;if(mapState.targetIdx===i)mapState.targetIdx=-1;
        if(focus===m||candidate===m)resetChoice();
        removed=true;
      }
      nextScan=now+250;stamp='';
      if(removed)renderMobs();
      return;
    }
    const twisted=window.TwistedSpace?.here()?TwistedSpace:null;
    if(!twisted)return updateFixed(f,now);
    const living=mapState.mobs.filter(alive);
    const existing=living.filter(m=>twisted?twisted.resident(m):m._giranSpawn?.kind==='ordinary');
    const guests=living.length-existing.length;
    const residentCap=twisted?Math.min(twisted.limit-guests,Math.max(twisted.bossSlots,cap-guests)):cap;
    const bossCap=twisted?Math.min(twisted.bossSlots,residentCap):0;
    if(prefix===stamp&&existing.length===residentCap&&now<nextScan+1600&&
      (!twisted||existing.filter(m=>m.boss).length===bossCap&&existing.every(m=>m._giranSpawn?.kind==='ordinary')))return;
    nextScan=now+(cap>=12?320:650);stamp=prefix;
    let changed=false;
    function trim(group,keep){
      if(group.length<=keep)return;
      const distance=m=>gap(leader,f.point(m)||{x:m._giranSpawn?.cell[0]??leader.x,y:m._giranSpawn?.cell[1]??leader.y});
      group.sort((a,b)=>Number(a===focus)-Number(b===focus)||distance(b)-distance(a));
      for(const m of group.slice(0,group.length-keep)){
        const i=mapState.mobs.indexOf(m);mapState.mobs[i]=null;if(mapState.targetIdx===i)mapState.targetIdx=-1;
        if(focus===m||candidate===m)resetChoice();
      }
      changed=true;
    }
    if(twisted){
      // Reserve three places even when an older save or a density change leaves only small monsters nearby.
      trim(existing.filter(m=>m.boss),bossCap);
      trim(existing.filter(m=>!m.boss),residentCap-bossCap);
    }else trim(existing,cap);
    let spots;
    const sites=()=>spots||(spots=tiles(f));
    const used=new Set();let ordinary=0,nearby=0;
    for(const [i,m] of mapState.mobs.entries()){
      if(!alive(m))continue;
      const tag=m._giranSpawn;
      if(!tag||twisted&&twisted.resident(m)!==(tag.kind==='ordinary')){
        // Preserve existing combatants when resuming a save or a scripted encounter.
        const at=f.point(m),p=sites().find(s=>(!s.id||s.id===m.mobId)&&!used.has(s.key)&&!residents.has(s.key));
        if(tag)residents.delete(tag.key);
        if(p&&(twisted?twisted.resident(m):!m.boss&&!m.trollPlayer))m._giranSpawn={key:p.key,kind:'ordinary',home:[p.x,p.y],cell:at?[at.x,at.y]:[p.x,p.y]};
        else if(at)m._giranSpawn={key:'event/'+zone+'/'+m.uid,kind:'event',home:[at.x,at.y],cell:[at.x,at.y]};
      }
      const point=m._giranSpawn;if(!point){ordinary++;continue;}
      const rec=store(m,point),at=f.point(m);
      rec.x=at?.x??point.cell[0];rec.y=at?.y??point.cell[1];
      const radius=cap>=12&&point.kind==='ordinary'?16:release;
      if(gap(leader,rec)>radius||point.kind==='ordinary'&&(!GiranGates.outsideVillage(terrain,rec.x,rec.y)||point.home&&!GiranGates.outsideVillage(terrain,...point.home))){
        mapState.mobs[i]=null;if(mapState.targetIdx===i)mapState.targetIdx=-1;
        if(focus===m)resetChoice();changed=true;continue;
      }
      used.add(point.key);
      if(point.kind==='ordinary'){ordinary++;if(gap(leader,rec)<=8)nearby++;}
    }
    // Native bosses have their own fixed coordinates and ten-minute recovery.
    if(!twisted&&mapState.mobs.filter(alive).length<cap+2&&GiranWorldBosses.spawn(freeSlot()))changed=true;
    // Fill close, connected cells first even if earlier battles put some of them on cooldown.
    const waveLimit=enteringField?Math.min(12,cap):Math.max(2,Math.ceil(cap/4));
    const firstWave=enteringField;
    enteringField=false;
    let arrivals=0;
    const available=twisted?Math.max(0,twisted.limit-mapState.mobs.filter(alive).length):Infinity;
    const nearTarget=cap>=12?Math.ceil(cap*.6):0;
    function fill(closeOnly,hidden){
      for(const p of sites()){
        if(ordinary>=residentCap||arrivals>=available||arrivals>=waveLimit||closeOnly&&nearby>=nearTarget)break;
        if(used.has(p.key)||closeOnly&&gap(leader,p)>8||(player.giranHuntRecovery?.[p.key]||0)>Date.now())continue;
        if(!make(f,p,hidden))continue;
        arrivals++;used.add(p.key);changed=true;
        const resident=residents.get(p.key);
        if(resident?.mob?._giranSpawn?.kind==='ordinary'){
          ordinary++;
          if(gap(leader,resident.x===undefined?p:resident)<=8)nearby++;
        }
      }
    }
    if(firstWave){
      if(ordinary<residentCap&&nearby<nearTarget)fill(true,false);
      if(ordinary<residentCap&&arrivals<waveLimit)fill(false,false);
    }else{
      if(ordinary<residentCap&&arrivals<waveLimit)fill(false,true);
      // 畫面外沒有可用的出生點（地圖太小、牆擋住）而場上怪太少時，才在畫面內補
      if(ordinary<Math.ceil(residentCap/2)&&arrivals<waveLimit)fill(false,false);
    }
    if(arrivals&&ordinary<residentCap)nextScan=now;
    if(residents.size>384){
      const stale=[...residents].filter(([,r])=>!mapState.mobs.includes(r.mob)).sort((a,b)=>a[1].seen-b[1].seen);
      for(const [k] of stale.slice(0,residents.size-320))residents.delete(k);
    }
    if(changed){renderMobs();nextSearch=0;}
  }
  function given(index){
    if(!request||request.index!==index)return undefined;
    const p=request.p;
    return {id:p.id,point:{key:p.key,kind:'ordinary',home:[p.x,p.y],cell:[p.x,p.y]}};
  }
  function ai(m,actor,nearest,now,roaming){
    if(!m._giranSpawn||!roaming)return 'engage';
    const home=m._giranSpawn.home||m._giranSpawn.cell,h={x:home[0],y:home[1]};
    // 11-27 Ping：所有地圖的怪都主動追擊（新兵訓練場維持原樣）；發現 10 格、追到 15 格、離出生點 16 格放棄
    const calm=mapState.current==='training',reach=calm?[6,12,13]:[10,15,16];
    const alert=gap(actor,nearest),chasing=!calm||m.curHp<m.hp||m.beh==='主動'||m.aggro||m.boss;
    if(chasing&&alert<=(actor.alert?reach[1]:reach[0])&&gap(actor,h)<reach[2]){actor.alert=true;return 'engage';}
    actor.alert=false;
    if(gap(actor,h)>4)return home;
    if(actor.step||actor.path.length||now<(actor.roamAt||0))return null;
    const r=mix(h.x,h.y,Math.floor(now/2400));
    actor.roamAt=now+1800+r%3600;
    return [h.x+r%5-2,h.y+(r>>>8)%5-2];
  }
  function patrol(f,now){
    if(manual()||!owns()||now<patrolAt||player.dead||!f.ready())return;
    patrolAt=now+2200;
    const p=f.leader,all=f.board.floor.filter(([x,y])=>{const d=gap(p,{x,y});return d>=5&&d<=11&&!f.board.occupied(p,x,y)&&GiranHunt.inside(x,y);});
    if(!all.length)return;
    const start=mix(p.x,p.y,++patrolCount)%all.length;
    for(let i=0;i<Math.min(16,all.length);i++){
      const cell=all[(start+13*i)%all.length],path=f.terrain.world.findPathNear(p.x,p.y,...cell);
      if(path?.path?.length&&path.to[0]===cell[0]&&path.to[1]===cell[1]){f.move(cell);break;}
    }
  }
  return {manual,mode,choose,locked,selectTarget,owns,update,given,ai,patrol,alive,leaveVillage,instanceSlots,waveSize,waveCell,
    get spawning(){return !!request;},get cap(){return capacity();},
    fixedNote(){return window.TwistedSpace?.here()?'':'／附近出生點 '+fixedSlots+' 隻（第'+'一二三'[GiranHunt.activePopulation(player?.giranHunt)-1]+'檔）';},
    defeated(m){if(m?._giranSpawn){residents.delete(m._giranSpawn.key);nextScan=0;}if(focus===m||candidate===m)resetChoice();},
    observe(m,at){const r=residents.get(m?._giranSpawn?.key);if(r&&at){r.x=at.x;r.y=at.y;}},
    refresh(){stamp='';nextScan=0;nextSearch=0;},
  };
})();
