(() => {
'use strict';
const {World, HuntingField, mediaBase} = window.AFK_DIMENSION_VIEW;
// The captain's saved position uses native floor coordinates. Followers form up around that cell.
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const clean = name => String(name || '').normalize('NFKC').replace(/[\s|｜·．]/g, '');

// A hunting region can cover several teleport points. These use a point inside that region.
const entryNames = {
  talking_island: '說話之島｜周邊', talking_island_port: '說話之島｜港口',
  pirate_wild: '海賊島｜周邊', twilight_mt: '亞丁｜黃昏山脈',
  zone_02: '歐瑞｜侏儒區', zone_03: '歐瑞｜雪原', zone_04: '歐瑞｜艾爾摩戰場',
  silver_knight: '銀騎士｜西部森林', zone_01: '妖精森林｜眠龍洞穴入口',
  zone_13: '冒險洞窟1樓', zone_14: '冒險洞窟2樓', elf_forest: '燃柳｜森林1',
  pirate_dungeon: '海賊島地監1樓', hidden_cave: '大洞穴｜隱遁者村莊',
  gludio: '古魯丁｜遠古戰場', kent: '肯特｜毆吉海', desert: '風木｜沙漠綠洲',
  mirror_forest: '海音｜鏡子森林', heine: '海音｜多眼區', giran: '奇岩｜獨眼巨人區',
  dragon_valley: '龍之谷｜三岔路', fire_dragon: '威頓｜火龍窟右側',
  dream_island: '夢幻之島｜風區', forgotten_island: '遺忘之島｜入口',
};

let resources,atlas;
function loadTerrain() {
  if (!resources) {
    resources = Promise.all([
      fetch(new URL('areas.json', mediaBase)).then(r => { if (!r.ok) throw Error('讀取狩獵區失敗'); return r.json(); }),
      fetch(new URL('teleports.json', mediaBase)).then(response => {
        if (!response.ok) throw Error('讀取地圖入口失敗');
        return response.json();
      }),
    ]).then(([areas, entries]) => (atlas={
      ...window.GiranTerrainAtlas.expand(areas),
      entries: new Map(entries.map(entry => [clean(entry.name), entry])),
    })).catch(error => { resources = undefined; throw error; });
  }
  return resources;
}

function walker(x, y) {
  return {x, y, fx: x, fy: y, path: [], step: null, progress: 0, walking: false, heading: 4};
}

const MOVE_SPEED = document.documentElement.dataset.playMode === 'fusion' ? .8 : 1;
function advance(actor, seconds, pace, terrain, occupied) {
  if (!actor.step && actor.path.length) {
    const h = actor.path.shift();
    if (!terrain.world.canStep(actor.x,actor.y,h,occupied)) {
      actor.path.length=0;actor.goalX=actor.goalY=undefined;
    }
    else {
      actor.heading = h;
      actor.step = [actor.x + DX[h], actor.y + DY[h]];
      actor.progress = 0;
    }
  }
  actor.walking = !!actor.step;
  if (!actor.step) return;
  // 11-27 Ping：自由走動所有人（隊伍、怪物、城鎮）移動速度 ×0.8，追擊關係不變。
  actor.progress = Math.min(1, actor.progress + seconds * MOVE_SPEED / pace);
  const travel = actor.progress - 0.035*Math.sin(4*Math.PI*actor.progress);
  actor.fx = actor.x + (actor.step[0] - actor.x) * travel;
  actor.fy = actor.y + (actor.step[1] - actor.y) * travel;
  if (actor.progress === 1) {
    [actor.x, actor.y] = actor.step;
    actor.step = null;
  }
}

function route(actor,to,terrain,occupied,wide=true) {
  const start=actor.step || [actor.x,actor.y];
  const found=terrain.world.findPathNear(...start,...to,occupied,24,wide);
  actor.path=found?.path || [];
  return found?.to || start;
}

class TerrainView {
  static preloadEntry(key){
    if(!atlas){loadTerrain().catch(()=>{});return;}
    const native=atlas.areas[key];
    if(native&&!(window.AFK_DIMENSION_VIEW.paintings[key]&&native.instance&&!window.GiranBossRooms?.room(key,native.map))){
      World.preloadDescriptor(native.map).catch(()=>{});
    }
  }
  constructor(canvas) {
    this.canvas=canvas;this.context=canvas.getContext('2d',{alpha:false});
    this.field=new HuntingField();this.generation=0;this.revision=0;this.reset();
  }
  reset(){
    for(const el of this.scenery||[])el.remove();this.scenery=[];
    for(const canvas of this.coverPool||[])canvas.remove();
    this.coverPool=[];this.freeCovers=[];this.coverByActor=new WeakMap();this.coverFrame=1;
    this.generation++;this.pending=null;this.hasTileEntry=false;this.resolving=false;this.loadingProgress=null;
    this.continuation=null;this.backOrigin=null;
    if(this.backdrop){this.backdrop.width=this.backdrop.height=0;this.backdrop=null;}
    if(this.tiles)this.tiles.release();
    this.field.release();this.world=null;this.key=null;this.origin=[0,0];this.focus=this.camera=null;
    this.canvas.hidden=true;this.kind='idle';this.revision++;
  }
  use(world,origin,kind){
    this.world=world;this.origin=origin;this.focus=origin.slice();this.camera=this.framing=null;
    this.centerCell=origin.slice();this.kind=kind;this.revision++;
  }
  async select(key,label,artOverride){
    this.reset();this.key=key;this.sourceMap=undefined;this.resolving=true;const id=this.generation,arrival=window.GiranGates?.destination(key);
    this.kind='loading';this.loadFailure='';this.retryAt=0;this.selection={key,label,artOverride};
    const crossing=window.GiranGates?.takeCrossing(key);
    if(crossing){
      if(this.tiles&&this.tiles!==crossing.world)this.tiles.dispose();
      this.resolving=false;this.instance=false;this.hasTileEntry=true;this.tiles=crossing.world;
      this.sourceMap=crossing.sourceMap;this.areas=crossing.areas;this.continuation=crossing;
      const p=crossing.captain;this.use(crossing.world,[p.x,p.y],'tiles');this.focus=crossing.focus;this.checkedAt=0;
      return;
    }
    try {
      const {entries,areas,resolve}=atlas||await loadTerrain();
      if(this.generation!==id)return;
      this.areas=areas;
      const painting=window.AFK_DIMENSION_VIEW.paintings[key],native=areas[key];
      // An atlas instance can reuse a different native floor. An authored plate belongs to
      // this area. A matching original floor, including a boss room with native paths, wins.
      if(painting&&(!native||native.instance&&!window.GiranBossRooms?.room(key,native.map))){
        const world=this.field;
        world.select(key,label,window.AFK_HUNTING_FIELDS[key]?.art?undefined:artOverride);
        await world.image.decode();
        if(this.generation!==id)return;
        this.instance=true;this.hasTileEntry=true;this.sourceMap=key;
        const room=window.GiranBossRooms?.preparePainting(key,world);
        const p=arrival?.map===key&&world.pass(arrival.x+48,arrival.y+48)?[arrival.x,arrival.y]:room?.entry||[0,0];
        this.use(world,p,'tiles');this.checkedAt=0;
        this.buildScenery(world);return;
      }
      const dest=native||entries.get(clean(label))||entries.get(clean(entryNames[key]))||resolve(key,label);
      this.instance=!!dest.instance;
      this.sourceMap=dest.sourceMap??dest.map;
      // The original dragon raid runs have separate gates on copies of the same terrain.
      // Keep the run's source ID on a native gate arrival and when resuming that save.
      const source=Number(arrival?.sourceMap);
      if(key==='giran_floor_'+dest.map && Number(arrival?.map)===dest.map && Number.isInteger(source) &&
         ((dest.map===1005&&source>=1006&&source<=1010)||(dest.map===1011&&source>=1012&&source<=1016))){
        this.sourceMap=source;
      }
      this.hasTileEntry=true;
      const room=window.GiranBossRooms?.room(key,dest.map);
      const world=this.tiles || (this.tiles=new World());
      world.bossCorridor=room?.corridor;
      const table=await world.setMap(dest.map);
      if(this.generation!==id || world.map!==table || !world.ready)return;
      const exact=!!arrival && Number(arrival.map)===Number(dest.map) && (arrival.sourceMap==null || Number(arrival.sourceMap)===Number(this.sourceMap)) && Number.isSafeInteger(arrival.x) && Number.isSafeInteger(arrival.y);
      this.pending={world,entry:exact?[arrival.x,arrival.y]:room?.entry||[dest.x,dest.y],exact:exact||!!room,started:performance.now()};
      const {entry,started}=this.pending;
      if(this.width>0&&this.height>0){
        world.prepare(this.width,this.height,entry,[],started,{sx:this.width/2,sy:this.focusY(this.height),arrival:true});
      }else world.wantRegions(...world.coreBox(entry));
    }catch(error){if(this.generation===id){this.loadFailure=error.message;this.retryAt=performance.now()+1800;}}
    finally{if(this.generation===id)this.resolving=false;}
  }
  buildScenery(world){
    const {ww,wh}=world.map.d;
    for(const polygon of world.painting.front){
      const points=polygon.map(([x,y])=>[x*ww,y*wh]),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
      const left=Math.floor(Math.min(...xs)),top=Math.floor(Math.min(...ys)),foot=Math.ceil(Math.max(...ys));
      const el=document.createElement('canvas');el.className='g-terrain-cover';el.setAttribute('aria-hidden','true');
      el.width=Math.ceil(Math.max(...xs))-left;el.height=foot-top;el.base=[left,top,foot];
      const ctx=el.getContext('2d');ctx.translate(-left,-top);ctx.beginPath();
      points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();
      ctx.drawImage(world.image,0,0,ww,wh);this.canvas.parentElement.append(el);this.scenery.push(el);
    }
  }
  entrance(world,x,y){
    const d=world.map.d,lx=x-d.gameX0,ly=y-d.gameY0,view=[];
    for(let row=0;row<7;row++)for(let col=0;col<9;col++){
      const sx=((col/8-.5)*(this.width+80))/24;
      const sy=(row/6*(this.height+48)-this.focusY(this.height)-24)/12;
      view.push([Math.round((sx-sy)/2),Math.round((sx+sy)/2)]);
    }
    // A teleport can sit at an outer wall. Pick visible floor in the same native
    // walkable area and score the ground the camera and the party will actually use.
    const native=(a,b)=>world.flags(a,b)&3;
    let seed=null;
    for(let r=0;r<=10 && !seed;r++)for(let ax=-r;ax<=r && !seed;ax++)for(let ay=-r;ay<=r;ay++){
      if(Math.max(Math.abs(ax),Math.abs(ay))===r && native(lx+ax,ly+ay)){seed=[lx+ax,ly+ay];break;}
    }
    if(!seed)return null;
    const radius=24,size=2*radius+1,visited=new Uint8Array(size*size);
    const index=(a,b)=>(b-ly+radius)*size+a-lx+radius;
    const queue=[seed];visited[index(...seed)]=1;
    const roomSizes=new Map();
    const spaceAt=(a,b)=>{
      const start=index(a,b);
      if(roomSizes.has(start))return roomSizes.get(start);
      const cells=[[a,b]],seen=new Set([start]);
      for(let i=0;i<cells.length&&cells.length<48;i++){
        const [x,y]=cells[i];
        for(let h=0;h<8;h++){
          const xx=x+DX[h],yy=y+DY[h],id=index(xx,yy);
          if(Math.abs(xx-lx)>radius||Math.abs(yy-ly)>radius||seen.has(id)||
             !world.canStep(x+d.gameX0,y+d.gameY0,h)||!world.canStep(xx+d.gameX0,yy+d.gameY0,(h+4)%8))continue;
          seen.add(id);cells.push([xx,yy]);
        }
      }
      const count=Math.min(cells.length,48);for(const id of seen)roomSizes.set(id,count);return count;
    };
    // Most native arrival coordinates are already on open ground. Verify that
    // exact tile, its connected floor and the visible map before searching the neighbourhood.
    if(world.pass(lx,ly) && spaceAt(lx,ly)>=40 &&
       DX.filter((_,h)=>world.canStep(x,y,h)&&world.canStep(x+DX[h],y+DY[h],(h+4)%8)).length>=4 &&
       view.filter(([dx,dy])=>world.hasGround(lx+dx,ly+dy)).length>=54)return [x,y];
    let best=null,bestScore=-Infinity;
    for(let i=0;i<queue.length;i++){
      const [a,b]=queue[i],gx=a+d.gameX0,gy=b+d.gameY0;
      for(let h=0;h<8;h++){
        const nx=a+DX[h],ny=b+DY[h];
        if(Math.abs(nx-lx)>radius||Math.abs(ny-ly)>radius||visited[index(nx,ny)]||!world.nativeStep(gx,gy,h))continue;
        visited[index(nx,ny)]=1;queue.push([nx,ny]);
      }
      if(!world.pass(a,b))continue;
      let exits=0,open=0,ground=0;
      for(let h=0;h<8;h++)if(world.canStep(gx,gy,h))exits++;
      if(exits<2)continue;
      for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(world.pass(a+dx,b+dy))open++;
      for(const [dx,dy] of view)if(world.hasGround(a+dx,b+dy))ground++;
      const score=ground*4+open*.7+exits*.5+spaceAt(a,b)*10-Math.hypot(a-lx,b-ly)*.8;
      if(score>bestScore){bestScore=score;best=[gx,gy];}
    }
    return best;
  }
  async randomLanding(hero,area,current){
    const world=this.world,d=world.map.d;
    function pick(x0,y0,width,height,minDistance){
      const count=width*height,start=Math.floor(Math.random()*count);
      for(let n=0;n<count;n++){
        const index=(start+n)%count,lx=x0+index%width,ly=y0+Math.floor(index/width);
        const x=d.gameX0+lx,y=d.gameY0+ly;
        if(!world.pass(lx,ly)||Math.max(Math.abs(x-hero.x),Math.abs(y-hero.y))<minDistance||!area.open(x,y))continue;
        // Require a two-way path extending beyond the landing tile.
        for(let h=0;h<8;h++){
          const nx=x+DX[h],ny=y+DY[h],back=(h+4)%8;
          if(world.canStep(x,y,h)&&world.canStep(nx,ny,back)&&
             DX.some((_,j)=>j!==back&&world.canStep(nx,ny,j)&&world.canStep(nx+DX[j],ny+DY[j],(j+4)%8)))return [x,y];
        }
      }
      return null;
    }
    if(world===this.field)return pick(0,0,d.cw,d.ch,4)||pick(0,0,d.cw,d.ch,1);
    const regions=[];
    for(let i=0;i<d.regions.length;i++){
      if(d.regions[i]===-1)continue;
      const x=(i%d.rnx)*d.rs+d.gameX0,y=Math.floor(i/d.rnx)*d.rs+d.gameY0,edge=d.rs-1,mid=d.rs>>1;
      if(area.contains(x+mid,y+mid)||area.contains(x,y)||area.contains(x+edge,y)||
         area.contains(x,y+edge)||area.contains(x+edge,y+edge))regions.push(i);
    }
    let held;
    try{
      // A region can contain only water or walls. Try distinct regions before the nearby fallback.
      for(let attempt=0;attempt<12&&regions.length&&current();attempt++){
        const i=Math.floor(Math.random()*regions.length),region=regions[i];
        regions[i]=regions[regions.length-1];regions.pop();
        const x=region%d.rnx*d.rs,y=Math.floor(region/d.rnx)*d.rs;
        held=[x,y,x+d.rs-1,y+d.rs-1];
        if(!await world.loadLandingBox(held)||!current())return null;
        const cell=pick(x,y,d.rs,d.rs,4);
        if(!cell)continue;
        const cam=world.camFor(cell,this.width,this.height,{sx:this.width/2,sy:this.focusY(this.height)});
        held=world.viewBox(cam,this.width,this.height,4);
        return await world.loadLandingBox(held)&&current()?cell:null;
      }
      const lx=hero.x-d.gameX0,ly=hero.y-d.gameY0;
      return current()&&(pick(lx-14,ly-14,29,29,4)||pick(lx-4,ly-4,9,9,1))||null;
    }finally{if(world.landingBox===held)world.landingBox=null;}
  }
  focusY(height){
    return height*(window.AFK_DIMENSION_VIEW.portraitFocus??.58);
  }
  cameraAnchor(width,height,now){
    const sx=width/2,sy=this.focusY(height),world=this.world;
    if(!world||world===this.field)return {sx,sy};
    const [x,y]=this.focus,d=world.map.d;
    let f=this.framing;
    const layout=!f||f.width!==width||f.height!==height||f.sy!==sy;
    if(layout)f=this.framing={width,height,sy,x:NaN,y:NaN,dx:0,dy:0,tx:0,ty:0,time:now};
    const distance=Math.max(Math.abs(x-f.x),Math.abs(y-f.y));
    if(layout||distance>=3||
       f.revision!==world.groundRevision&&now-f.checked>300){
      const lx=x-d.gameX0,ly=y-d.gameY0;
      const coverage=(dx,dy)=>{
        let ground=0;
        for(let j=0;j<9;j++)for(let i=0;i<7;i++){
          const across=((i+.5)*width/7-sx-dx)/24,down=((j+.5)*height/9-sy-dy)/12;
          if(world.hasGround(Math.round(lx+(across-down)/2),Math.round(ly+(across+down)/2)))ground++;
        }
        return ground;
      };
      const center=coverage(0,0);f.tx=0;f.ty=0;
      if(center<58){
        // Keep the character, its nameplate and a tappable margin above the phone dock.
        const visible=height*Math.min(window.AFK_DIMENSION_VIEW.visibleFieldFraction??1,sy/height<.58?sy/height/.68:1);
        const mx=Math.min(130,width*.24),up=Math.min(140,sy-Math.min(sy,height*.19));
        const down=Math.max(0,Math.min(140,height*.21,visible-20-sy));
        let best=center+2;
        for(const dy of [-up,-up/2,0,down/2,down])for(const dx of [0,-mx/2,mx/2,-mx,mx]){
          const score=coverage(dx,dy)-2*(Math.abs(dx)/width+Math.abs(dy)/height);
          if(score>best){best=score;f.tx=dx;f.ty=dy;}
        }
      }
      f.x=x;f.y=y;f.revision=world.groundRevision;f.checked=now;
    }
    // Fresh entries can frame immediately. Interpolate subsequent changes as the captain walks.
    if(layout||distance>7){f.dx=f.tx;f.dy=f.ty;}
    else if(Math.abs(f.tx-f.dx)>.1||Math.abs(f.ty-f.dy)>.1){
      const blend=1-Math.exp(-Math.max(0,now-f.time)/140);
      f.dx+=(f.tx-f.dx)*blend;f.dy+=(f.ty-f.dy)*blend;
    }else{f.dx=f.tx;f.dy=f.ty;}
    f.time=now;
    return {sx:sx+f.dx,sy:sy+f.dy};
  }
  prepare(width,height,now){
    this.width=width;this.height=height;
    if(this.world===this.field && this.field.fitViewport(width,height)){
      for(const el of this.scenery)el.remove();this.scenery=[];
      this.buildScenery(this.field);this.backOrigin=null;this.revision++;
    }
    if(this.canvas.width!==width || this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    if(this.kind==='loading'&&!this.resolving&&!this.pending&&this.retryAt&&now>=this.retryAt){
      this.retryAt=0;const s=this.selection;this.select(s.key,s.label,s.artOverride);return;
    }
    const p=this.pending,options={sx:width/2,sy:this.focusY(height)};
    if(p){
      const ready=p.world.prepare(width,height,p.entry,[],now,{...options,arrival:true});
      this.loadingProgress=ready;
      if(ready && !ready.need){
        this.pending=null;this.loadingProgress=null;p.world.release();this.loadFailure='入口缺少地形分區';this.retryAt=now+4500;
      }else if(ready?.need && ready.done===ready.need){
        const d=p.world.map.d,[x,y]=p.entry;
        let cell=null;
        if(p.exact)for(let r=0;r<=3&&!cell;r++)for(let a=-r;a<=r&&!cell;a++)for(let b=-r;b<=r;b++){
          if(Math.max(Math.abs(a),Math.abs(b))===r&&p.world.pass(x+a-d.gameX0,y+b-d.gameY0)&&DX.some((_,h)=>p.world.canStep(x+a,y+b,h))){cell=[x+a,y+b];break;}
        }
        cell ||= this.entrance(p.world,...p.entry);
        this.pending=null;
        if(cell){this.use(p.world,cell,'tiles');this.checkedAt=now;}
        else {p.world.release();this.loadFailure='入口附近缺少可走地形';this.retryAt=now+4500;}
      }
    }
    if(this.kind==='tiles' && now-this.checkedAt>150){
      this.checkedAt=now;
      this.loadingProgress=this.world.prepare(width,height,this.focus,[],now,this.cameraAnchor(width,height,now));
    }
  }
  draw(hero,width,height,now){
    // The map scrolls with the captain's interpolated foot position on every walking frame.
    this.focus[0]=hero.fx;this.focus[1]=hero.fy;
    this.centerCell=[hero.x,hero.y];
    const world=this.world,inset=world===this.field?0:64,options=this.cameraAnchor(width,height,now);
    const cam=world.camFor(this.focus,width,height,options),old=this.camera,base=this.backOrigin;
    const bw=width+inset*2,bh=height+inset*2;
    world.checkChunks(now);
    const repaint=!base || this.backdrop.width!==bw || this.backdrop.height!==bh || this.backRevision!==world.groundRevision ||
      cam[0]<base[0] || cam[1]<base[1] || cam[0]+width>base[0]+bw || cam[1]+height>base[1]+bh;
    if(repaint){
      const image=this.backdrop || (this.backdrop=document.createElement('canvas'));
      if(image.width!==bw)image.width=bw;if(image.height!==bh)image.height=bh;
      this.backOrigin=world.draw(image.getContext('2d',{alpha:false}),bw,bh,this.focus,[],now,{sx:options.sx+inset,sy:options.sy+inset});
      this.backRevision=world.groundRevision;
    }
    if(repaint || !old || old[0]!==cam[0] || old[1]!==cam[1]){
      this.context.drawImage(this.backdrop,cam[0]-this.backOrigin[0],cam[1]-this.backOrigin[1],width,height,0,0,width,height);
    }
    if(!old||old[0]!==cam[0]||old[1]!==cam[1]||repaint)for(const el of this.scenery){
      const [left,top,foot]=el.base;
      el.style.transform='translate('+Math.round(left-cam[0])+'px,'+Math.round(top-cam[1])+'px)';
      el.style.zIndex=String(4+Math.max(0,Math.min(60,Math.floor(60*(foot-cam[1])/height))));
    }
    this.camera=cam;this.canvas.hidden=false;
  }
  cover(actor,z,height=78,width=90,captain=false){
    const world=this.world,bins=world?.foreground;
    if(!bins||!this.camera)return;
    const [wx,wy]=world.worldPos(actor.fx??actor.x,actor.fy??actor.y);
    const x=Math.round(wx-width/2),y=Math.round(wy-height),h=height+4;
    const sx=x-this.camera[0],sy=y-this.camera[1];
    if(sx+width<0||sy+h<0||sx>this.width||sy>this.height)return;
    const d=world.map.d,depth=Math.floor(4*((actor.fy??actor.y)-(actor.fx??actor.x)-d.gameY0+d.gameX0)+19.5+(captain?.25:0));
    // Cache the actual foreground pixels in world space. A scrolling camera only moves the mask.
    const grid=24,left=Math.floor(x/grid)*grid,top=Math.floor(y/grid)*grid,w=width+grid,hh=h+grid;
    const key=[left,top,w,hh,depth].join('/');
    let entry=this.coverByActor.get(actor);
    if(!entry){entry={};this.coverByActor.set(actor,entry);}
    if(entry.key!==key||entry.bins!==bins){
      const sameArea=entry.left===left&&entry.top===top&&entry.w===w&&entry.h===hh;
      entry.key=key;entry.bins=bins;entry.left=left;entry.top=top;entry.w=w;entry.h=hh;
      const tiles=[];
      for(let bx=(left-24)>>6;bx<=(left+w)>>6;bx++)for(let by=(top-23)>>6;by<=(top+hh)>>6;by++){
        const bin=bins.get(bx+','+by);if(!bin)continue;
        for(const v of bin){
          const {r,k}=v,ox=r.tX[k],oy=r.tY[k];
          if(r.tKey[k]>depth&&ox+24>left&&oy+23>top&&ox<left+w&&oy<top+hh)tiles.push(v);
        }
      }
      tiles.sort((a,b)=>a.s-b.s);
      // Adjacent depth levels often have the same foreground, especially on a staircase.
      const old=entry.tiles;
      if(!sameArea||!old||tiles.length!==old.length||tiles.some((v,i)=>v.k!==old[i].k||v.r!==old[i].r))entry.dirty=true;
      entry.tiles=tiles;
    }
    if(!entry.tiles.length)return;
    let mask=entry.mask;
    if(!mask){
      mask=this.freeCovers.pop();
      if(!mask){mask=document.createElement('canvas');mask.className='g-terrain-cover';mask.setAttribute('aria-hidden','true');this.canvas.parentElement.append(mask);this.coverPool.push(mask);}
      entry.mask=mask;mask.owner=entry;entry.dirty=true;
    }
    mask.frame=this.coverFrame;
    if(mask.hidden)mask.hidden=false;
    mask.style.zIndex=z;mask.style.opacity=captain?'.62':'1';
    mask.style.transform='translate('+Math.round(left-this.camera[0])+'px,'+Math.round(top-this.camera[1])+'px)';
    // Clip to this actor so a cache margin cannot cover somebody standing in front of it.
    mask.style.clipPath='inset('+(y-top)+'px '+(w-width-x+left)+'px '+(hh-h-y+top)+'px '+(x-left)+'px)';
    if(!entry.dirty)return;
    entry.dirty=false;
    if(mask.width!==w)mask.width=w;if(mask.height!==hh)mask.height=hh;
    const ctx=mask.getContext('2d');ctx.clearRect(0,0,w,hh);
    for(const {r,k} of entry.tiles)world.blit(ctx,r,r.tIdx[k],r.tX[k]-left,r.tY[k]-top);
    mask.__gpuVer=(mask.__gpuVer|0)+1;   // 11-28：GPU 繪製要知道遮蔽重畫過
  }
  endCovers(){
    for(const canvas of this.coverPool)if(canvas.owner&&canvas.frame!==this.coverFrame){
      canvas.hidden=true;canvas.owner.mask=null;canvas.owner=null;this.freeCovers.push(canvas);
    }
    this.coverFrame++;
  }
  project(x,y){
    const p=this.world.worldPos(x,y);
    const cam=this.camera || this.world.camFor(this.focus,this.width,this.height,{sx:this.width/2,sy:this.focusY(this.height)});
    return [p[0]-cam[0],p[1]-cam[1]];
  }
  cell(px,py){
    return this.world.screenToCell(clamp(px,12,this.width-12),clamp(py,25,this.height-12),this.camera);
  }
}

Object.assign(window.AFK_DIMENSION_VIEW, {TerrainView, walker, advance, route});
})();
