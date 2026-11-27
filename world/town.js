'use strict';
window.GiranTown=(()=>{
  const view=document.getElementById('town-npc-map');
  const flags=document.getElementById('town-view');
  __afkLore.addNpc('town_gludio',{id:'npc_jackson',n:'傑克森',title:'雜貨商',type:'shop'},'457');
  const api=AFK_DIMENSION_VIEW, geo=GiranGeometry;
  const canvas=document.createElement('canvas');canvas.className='g-town-ground';
  const terrain=new api.TerrainView(canvas), board=new api.BattleFormation(terrain);
  const layer=document.createElement('div');layer.className='g-town-roster';
  const unitMap=new Map(),npcSeats=new WeakMap(),extraSeats=new Map(),inkSizes=new WeakMap();
  let pendingTalk=null;
  let key=null,rev=-1,leader=null,goal=null,at=null,last=0,planned=0,permit=false;
  const usable=()=>typeof player==='object' && player?.cls && typeof mapState==='object' && /^town_/.test(mapState.current) &&
    !document.getElementById('game-screen').classList.contains('hidden') && !flags.classList.contains('hidden');
  function command(cell,onArrival=null){
    if(!leader || !terrain.camera)return false;
    const start=leader.step||[leader.x,leader.y], path=terrain.world.walkRoute(start,cell);
    if(!path || onArrival && Math.max(Math.abs(path.to[0]-cell[0]),Math.abs(path.to[1]-cell[1]))>1)return false;
    leader.path=path.path;goal=path.to;at=onArrival;return true;
  }
  function relocate(cell){
    if(!usable()||key!==mapState.current||!terrain.camera||terrain.pending||terrain.resolving)return false;
    pendingTalk=goal=at=null;planned=0;
    leader=api.walker(...cell);unitMap.clear();layer.replaceChildren();
    terrain.focus=cell.slice();terrain.checkedAt=0;GiranGates.remember(terrain,leader);
    return true;
  }
  function walkOut(){
    if(!usable()||key!==mapState.current||!leader||!terrain.camera||terrain.pending||terrain.resolving)return false;
    const beyond=GiranGates.walkOut(terrain,leader);
    if(!beyond)return false;
    pendingTalk=null;
    return command(beyond,GiranGates.outsideVillage(terrain,...beyond)?null:walkOut);
  }
  const nativeGates=GiranGates.layer(view,command);
  view.addEventListener('click',e=>{
    if(permit || !usable() || e.target.closest('.g-native-gate'))return;
    const npc=e.target.closest('.town-npc');
    pendingTalk=null;
    if(npc){
      e.preventDefault();e.stopImmediatePropagation();
      const id=npc.dataset.worldNpc,name=npc.querySelector('.tn-name')?.textContent;
      approachNpc(mapState.current,id,name);
      return;
    }
    if(!terrain.camera || !leader)return;
    if(e.target.closest('button,input,select'))return;
    const r=view.getBoundingClientRect();
    command(terrain.cell((e.clientX-r.left)*view.clientWidth/r.width,(e.clientY-r.top)*view.clientHeight/r.height));
  },true);
  function approachNpc(town,id,name){
    if(town!==mapState.current||document.body.classList.contains('giran-guest'))return false;
    pendingTalk={town,id,name};return true;
  }
  function place(el,p){
    const [x,y]=terrain.project(p.fx??p.x,p.fy??p.y);
    el.style.left=x.toFixed(1)+'px';el.style.top=y.toFixed(1)+'px';el.style.zIndex=String(10+Math.max(0,Math.round(y)));
  }
  function paint(el,who,actor,isAlly) {
    const dir=actor.heading;
    const pick=w=>actor.walking?api.setFor(api.memberSpec(w,isAlly,dir)):api.actionSet(w,isAlly,dir,'idle');
    let set=pick(who);
    // 11-27：變身沒有城鎮用的待機／走路圖時改用原職業外觀，不要整個人消失（戰場上照樣顯示變身）
    if(!set||set.missing){
      const plain=Object.create(who);plain._setPoly=null;plain.poly=null;plain.buffs=Object.assign({},who.buffs,{poly:0});
      const alt=pick(plain);if(alt){set=alt;who=plain;}
    }
    if(!set?.ready)return;
    const phase=actor.walking?actor.progress:(performance.now()%1000)/1000;
    const i=Math.min(set.body.length-1,Math.floor(phase*set.body.length)), im=set.body[i];
    if(!im?.naturalWidth)return;
    const foot=set.anchor?.(i)||api.foot(im);
    let body=el.firstChild;
    if(!body){body=document.createElement('img');body.alt=who.name||'隊員';el.append(body);}
    if(body.getAttribute('src')!==im.src)body.src=im.src;
    const form=api.battleForm(who,isAlly)?.domKey;
    if(!actor.figureRatio||actor.figureForm!==form){
      const idle=api.actionSet(who,isAlly,0,'idle');
      const ref=idle?.ready?idle.body[0]:set.body[0];
      actor.figureRatio=api.townFigureRatio(ref,terrain);actor.inkHeight=api.figureHeight(terrain,'character',api.silhouette(ref));actor.figureForm=form;
    }
    const ratio=actor.figureRatio;
    body.style.left=-foot[0]*ratio+'px';body.style.top=-foot[1]*ratio+'px';
    body.style.width=im.naturalWidth*ratio+'px';body.style.height=im.naturalHeight*ratio+'px';
  }
  function npcBody(npc){
    const image=npc.querySelector('.tn-body');if(!image?.naturalWidth)return;
    let body=inkSizes.get(npc);
    if(!body){
      const height=api.silhouette(image),ratio=api.figureHeight(terrain,'npc',height)/height;
      body={ratio,height:height*ratio};inkSizes.set(npc,body);
    }
    if(body.src===image.currentSrc)return body;
    // 11-27：腳點只量第一張。每張待機圖的輪廓不同，逐張重量會讓 NPC 在原地抖動（倉庫朵琳最明顯）。
    body.src=image.currentSrc;const feet=body.feet||(body.feet=api.foot(image)),r=body.ratio;
    npc.style.setProperty('--npc-x',(-feet[0]*r).toFixed(2)+'px');
    npc.style.setProperty('--npc-y',(-feet[1]*r).toFixed(2)+'px');
    npc.style.setProperty('--npc-head',Math.round(body.height)+'px');
    npc.style.setProperty('--npc-w',(image.naturalWidth*r).toFixed(2)+'px');
    npc.style.setProperty('--npc-h',(image.naturalHeight*r).toFixed(2)+'px');
    return body;
  }
  function fixedSeat(id,locations){
    if(locations[id])return locations[id];
    if(extraSeats.has(id))return extraSeats.get(id);
    const available=Object.keys(locations).filter(k=>k.startsWith('visitor')).map(k=>locations[k]);
    if(!available.length)return null;
    let hash=0;for(const ch of id)hash=(Math.imul(hash,31)+ch.charCodeAt(0))>>>0;
    const claimed=new Set([...extraSeats.values()].map(p=>p.join()));
    for(let n=0;n<available.length;n++){const cell=available[(hash+n)%available.length];if(!claimed.has(cell.join())){extraSeats.set(id,cell);return cell;}}
    return null;
  }
  function load(town){
    extraSeats.clear();key=town;leader=null;rev=-1;goal=at=null;
    GiranFieldUI.clearMark(view);
    unitMap.clear();layer.replaceChildren();
    const art=/url\(["']?([^"')]+)/.exec(_townMapBg(town))?.[1];
    const label=DB.towns[town]?.n || mapDisplayName(town) || town;
    terrain.select(town,label,art);
  }
  function update(now) {
    if(!usable()){pendingTalk=null;if(key){key=null;goal=at=null;unitMap.clear();GiranFieldUI.clearMark(view);terrain.reset();}return;}
    if(!view.contains(canvas)){view.prepend(canvas);view.append(layer);}
    if(key!==mapState.current)load(mapState.current);
    const w=view.clientWidth,h=view.clientHeight;if(w<32||h<32)return;
    terrain.prepare(w,h,now);
    if(terrain.kind==='loading'||terrain.pending||terrain.resolving){GiranFieldUI.update(terrain);last=now;return;}
    if(rev!==terrain.revision){
      rev=terrain.revision;leader=terrain.continuation?.captain||api.walker(...terrain.origin);
      for(const el of view.querySelectorAll('.town-npc'))npcSeats.delete(el);
      unitMap.clear();layer.replaceChildren();at=null;goal=terrain.continuation?.goal||null;planned=0;
    }
    const dt=last?Math.min(.30,(now-last)/1000):0;last=now;
    terrain.draw(leader,w,h,now);
    nativeGates(terrain,leader,true);
    if(mapState.current!==key)return;
    const plan=now>=planned; if(plan)planned=now+480;
    board.begin([leader,...[...unitMap.values()].map(v=>v.actor).filter(a=>a!==leader)],leader,plan);
    const locations=window.GiranTownPlaces?.[key]||{};
    const residents=[...view.querySelectorAll('.town-npc')];
    const visibleIds=new Set(residents.map(el=>el.dataset.worldNpc));
    for(const id of extraSeats.keys())if(!visibleIds.has(id))extraSeats.delete(id);
    const labelBands=[];
    const [captainX,captainY]=terrain.project(leader.fx??leader.x,leader.fy??leader.y);
    for(const npc of residents){
      let seat=npcSeats.get(npc);
      if(!seat){
        const cell=fixedSeat(npc.dataset.worldNpc,locations);if(!cell){npc.hidden=true;continue;}
        seat={x:cell[0],y:cell[1],fx:cell[0],fy:cell[1]};npcSeats.set(npc,seat);
        npc.dataset.mapX=seat.x;npc.dataset.mapY=seat.y;
      }
      board.members.add(seat);place(npc,seat);
      const [px,py]=terrain.project(seat.x,seat.y);npc.hidden=px< -65||px>w+65||py< -45||py>h+100;
      if(!npc.hidden){
        const height=Math.ceil(npcBody(npc)?.height||56);
        terrain.cover(seat,npc.style.zIndex,height,64);
        if(Math.abs(px-captainX)<108&&Math.abs(py-captainY)<95)labelBands.push(py-height-(npc.classList.contains('has-castle-crown')?17:3));
      }
    }
    if(pendingTalk&&pendingTalk.town!==key)pendingTalk=null;
    if(pendingTalk&&!terrain.resolving&&!terrain.pending&&terrain.kind!=='loading'){
      const {id,name,town}=pendingTalk;
      const findNpc=()=>[...view.querySelectorAll('.town-npc')].find(n=>id?n.dataset.worldNpc===id:n.querySelector('.tn-name')?.textContent===name);
      const pos=npcSeats.get(findNpc());
      if(pos){
        const world=terrain.world,d=world.map.d;
        const from=leader.step||[leader.x,leader.y];
        const bounds=[Math.min(from[0],pos.x)-d.gameX0-5,Math.min(from[1],pos.y)-d.gameY0-5,Math.max(from[0],pos.x)-d.gameX0+5,Math.max(from[1],pos.y)-d.gameY0+5];
        if(!world.viewReady(bounds)){world.wantRegions(...bounds);}
        else{
        pendingTalk=null;
        const stand=geo.directions.map(([dx,dy])=>[pos.x+dx,pos.y+dy]).filter(([x,y],h)=>world.canStep(pos.x,pos.y,h)&&!residents.some(n=>+n.dataset.mapX===x&&+n.dataset.mapY===y))
          .sort((a,b)=>Math.hypot(a[0]-from[0],a[1]-from[1])-Math.hypot(b[0]-from[0],b[1]-from[1])).find(c=>world.findPath(...from,...c));
        const routed=stand&&command(stand,()=>{
          if(key!==town||!usable())return;
          const actual=findNpc();if(actual){permit=true;try{actual.click();}finally{permit=false;}}
        });
        if(!routed)logSys('通往'+(name||findNpc()?.querySelector('.tn-name')?.textContent||'目的地')+'的路受阻，請移動到附近後再帶路。');
        }
      }
    }
    const members=[player,...GiranPartyView.combatAllies().filter(Boolean)],seen=new Set();
    members.forEach((who,i)=>{
      const id=i?'a'+who._slot:'hero';seen.add(id);
      let unit=unitMap.get(id);
      const theta=i*2.3999632, ring=78+23*Math.sqrt(i), offset=[Math.cos(theta)*ring,Math.sin(theta)*ring*.65];
      if(!unit){
        const carried=i&&terrain.continuation?.party.get(String(who._slot));
        const actor=i?(carried||board.spawn(leader,offset)):leader;if(!actor)return;
        board.members.add(actor);
        unit={actor,el:null};unitMap.set(id,unit);
      }
      const {actor}=unit;
      if(i && plan && !actor.step && !actor.path.length && (goal || geo.distance(actor,leader)>6)){
        const c=board.seat(actor,leader,offset);
        if(c)api.route(actor,c,terrain,(x,y)=>board.occupied(actor,x,y));
      }
      api.advance(actor,dt,(.32+(i?.015:0))/(1+(who.d?.moveSpeedPct||0)/100),terrain,i?(x,y)=>board.occupied(actor,x,y):null);
      if(!GiranPartyView.shows(who)){
        if(unit.el){unit.el.remove();unit.el=null;}
        return;
      }
      if(!unit.el){
        unit.el=document.createElement('div');unit.el.className='g-town-unit';unit.el.dataset.slot=id;layer.append(unit.el);
      }
      const el=unit.el;
      place(el,actor);paint(el,who,actor,!!i);
      const sprite=el.firstChild;terrain.cover(actor,el.style.zIndex,Math.ceil(Math.abs(parseFloat(sprite?.style.top))||72),Math.ceil(parseFloat(sprite?.style.width)||78),!i);
      if(!i)GiranFieldUI.mark(view,terrain,actor,actor.inkHeight||56,!!sprite,labelBands);
    });
    GiranGates.remember(terrain,leader);
    terrain.continuation=null;
    for(const [id,u] of unitMap)if(!seen.has(id)){u.el?.remove();unitMap.delete(id);}
    if(goal && !leader.step && !leader.path.length){
      if(leader.x===goal[0] && leader.y===goal[1]){
        const action=at;goal=at=null;action?.();
      }else if(plan && !command(goal,at)){
        goal=at=null;
      }
    }
    GiranFieldUI.update(terrain);
    terrain.endCovers();view.dataset.worldTown=key;
  }
  api.loadStrideData().catch(e=>console.error('村莊角色圖載入失敗',e));
  function frame(now){if(now-last>=36 && !document.hidden){try{update(now);}catch(e){if(!view.dataset.error){view.dataset.error=e.message;console.error(e);}last=now;}}requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
  return {command,relocate,approachNpc,walkOut,get approaching(){return !!(pendingTalk||at);},get walkGoal(){return goal;},get leader(){return leader;},get terrain(){return terrain;},get units(){return unitMap;}};
})();
