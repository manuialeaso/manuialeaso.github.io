(() => {
'use strict';
const {mediaBase} = window.AFK_DIMENSION_VIEW;
// A stride is one map cell. Each frame carries a foot anchor because many of the
// original sprites already travel almost one cell across their transparent canvas.
let meta;
let metadata;
let frameIndex;
function loadStrideData() {
  if (!metadata) metadata = Promise.all(['idle-meta.json','strides.json'].map(async file => {
    const response = await fetch(new URL(file, mediaBase));
    if (!response.ok) throw Error('步態資料載入失敗');
    return response.json();
  })).then(([anchors, frames]) => { meta=anchors; frameIndex=frames; return frames; }).catch(error => {
    metadata=undefined;
    throw error;
  });
  return metadata;
}
const sets = new Map(), layers = new WeakMap();
const suffix = ['2','F','','d3','d4','d5','d6','d7'];
const dx = [0,1,1,1,0,-1,-1,-1], dy = [-1,-1,0,1,1,1,0,-1];

function image(url, waitForSheet = false) {
  const im = new Image();
  im.dmFrameUrl = url;
  if (waitForSheet) im.__giranProbeFrame = true;
  im.src = url;
  return im;
}
function loaded(im) { return im instanceof HTMLCanvasElement ? im.width>0 : im?.complete && im.naturalWidth > 0; }
// 11-28 Ping：畫過一次的圖轉成已解碼的點陣圖留著。原本每次把 <img> 畫到畫布，瀏覽器常常要當場重新解碼（實測每次約 3 毫秒、每秒十幾次）。
// 第一次仍照舊直接畫，同時在背景轉；之後都用轉好的。最多留 900 張（手機 300），滿了先丟最久沒用的。
const bitmaps = new Map();
function drawable(im) {
  if (!(im instanceof HTMLImageElement) || typeof createImageBitmap !== 'function') return im;
  const held = bitmaps.get(im);
  if (held && held !== 1) { bitmaps.delete(im); bitmaps.set(im, held); return held; }
  if (!held) {
    bitmaps.set(im, 1);
    createImageBitmap(im).then(bitmap => {
      if (bitmaps.get(im) !== 1) { bitmap.close(); return; }
      bitmaps.set(im, bitmap);
      const cap = window.GiranPartyView?.mobile() ? 300 : 900;
      while (bitmaps.size > cap) {
        const [key, value] = bitmaps.entries().next().value;
        bitmaps.delete(key);
        if (value && value !== 1) value.close();
      }
    }, () => bitmaps.delete(im));
  }
  return im;
}
function origin(folder, action, index = 0) {
  const o = meta?.ORIGIN?.[folder]?.[action];
  return o?.[5]?.[index] || o;
}
// Some later outfits use their own canvas and have no anchor entry.
const measured = new Map();
const ink = new Map();
// 11-27 Ping：角色身高只量「身體」——腳點左右 14% 寬的直條，翅膀、光環、披風往兩側張開的部分不算。
const bodyInk = new Map();
function foot(im) {
  if (measured.has(im.src)) return measured.get(im.src);
  const w = im.naturalWidth, h = im.naturalHeight;
  if (!w || !h) return [0,0];
  const c = document.createElement('canvas');
  c.width=w; c.height=h;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  let a;
  try {
    ctx.drawImage(im,0,0);
    a=ctx.getImageData(0,0,w,h).data;
  } catch (error) {
    if(error.name!=='SecurityError')throw error;
    // Native event cards may use an external portrait. Its visible rectangle supplies the foot anchor.
    c.width=c.height=0;
    if(measured.size>=768)measured.delete(measured.keys().next().value);
    if(ink.size>=768)ink.delete(ink.keys().next().value);
    const p=[w/2,h-1];measured.set(im.src,p);ink.set(im.src,h);bodyInk.set(im.src,h);
    return p;
  }
  let bottom=h-1, sum=0, total=0;
  for (;bottom>0;bottom--) {
    let opaque=0;
    for (let x=0;x<w;x++) if (a[(bottom*w+x)*4+3]>120) opaque++;
    if (opaque>=2) break;
  }
  for (let y=Math.max(0,bottom-6);y<=bottom;y++) for (let x=0;x<w;x++) {
    if (a[(y*w+x)*4+3]>120) {sum+=x; total++;}
  }
  let top=0;
  for (;top<bottom;top++) {
    let opaque=0;
    for (let x=0;x<w;x++) if (a[(top*w+x)*4+3]>120) opaque++;
    if (opaque>=3) break;
  }
  if (ink.size>=768) ink.delete(ink.keys().next().value);
  ink.set(im.src,Math.max(8,bottom-top+1));
  const p=[total?sum/total:w/2,bottom];
  {
    const band=Math.max(4,Math.round(w*.14)),x0=Math.max(0,Math.round(p[0])-band),x1=Math.min(w-1,Math.round(p[0])+band);
    let bodyTop=top;
    for (;bodyTop<bottom;bodyTop++) {
      let opaque=0;
      for (let x=x0;x<=x1;x++) if (a[(bodyTop*w+x)*4+3]>120) opaque++;
      if (opaque>=2) break;
    }
    if (bodyInk.size>=768) bodyInk.delete(bodyInk.keys().next().value);
    // 腳點算偏（拿杖、披風拖地）或躺姿時直條會量到很矮，放大後整個人變巨大馬賽克 → 至少算全身高的 72%
    bodyInk.set(im.src,Math.max(8,bottom-bodyTop+1,Math.round((bottom-top+1)*.72)));
  }
  c.width=0; c.height=0;
  if (measured.size>=768) measured.delete(measured.keys().next().value);
  measured.set(im.src,p);
  return p;
}

// Dimension figures share one world-cell scale. Calibrate from an opaque
// silhouette, once per appearance, never from an individual stride frame.
// One native world diamond is 48 pixels wide at the source resolution.
function terrainCellWidth(terrain){
  if(!terrain?.world?.map)return 48;
  const [x,y]=terrain.origin,world=terrain.world;
  return Math.abs(world.worldPos(x+1,y+1)[0]-world.worldPos(x,y)[0])||48;
}
function figureHeight(terrain,kind,standingInk){
  const cell=terrainCellWidth(terrain);
  if(kind==='character')return cell*1.48;
  if(kind==='npc')return cell*1.16;
  // 11-27 Ping：一般怪 0.85～1.5 格（照原圖比例，太小的才放大；1.0 下限會把哥布林放得跟人一樣高）、寵物 0.7～1.0 格、王上限 2.0 格（角色固定 1.48 格）
  const range=kind==='boss'?[1.55,2.0]:kind==='pet'?[.70,1.0]:[.85,1.5];
  return cell*Math.max(range[0],Math.min(range[1],standingInk/48));
}
function silhouette(im) {
  foot(im);
  return ink.get(im.src)||im.naturalHeight;
}
function bodyHeight(im) {
  foot(im);
  return bodyInk.get(im.src)||ink.get(im.src)||im.naturalHeight;
}
function townFigureRatio(reference,terrain) {
  return figureHeight(terrain,'character',bodyHeight(reference))/bodyHeight(reference);
}
function monsterSpec(name,dir) {
  const anchor=window.GiranBossArt?.anchors[name];
  if(anchor)return {folder:'assets/anim/'+name+'/d'+dir,prefix:'walk_',anchor:()=>anchor};
  const tab=meta?.ANIM?.[name]?.[dir], directory='assets/anim/'+name;
  const manifest=meta?.MANIFEST?.[directory];
  const count=manifest?.['d'+dir+'/walk_'];
  if (!tab || !(count>=2)) return null;
  const prefix='d'+dir+'/walk';
  const o=origin('anim/'+name,prefix) || tab;
  return {folder:directory+'/d'+dir, prefix:'walk_', count,
    shadow:manifest[prefix+'_s_'] || 0, weapon:0,
    anchor:k=>[o[0]+(tab[4]===0?0:24*(dx[dir]+dy[dir])*k/count),
               o[1]+(tab[4]===0?0:12*(dy[dir]-dx[dir])*k/count)]};
}

// Some legacy transformations have combat poses but no walking animation.
// 11-27 Ping：變身一律保留原本的樣子與攻擊動作；沒有走路圖的，走路時由 stride() 用待機圖補步態（poseStride）。
// 舊做法是整段時間換回職業外觀，玩家看起來像「變身被解除」、也看不到變身的攻擊動作。
const canWalk=new Map();
function mapForm(form,who,isAlly) {
  return form;
  if(/冥皇丹特斯/.test(form?.domKey||decodeURIComponent(form?.base||'')))return form;
  if(!frameIndex || !form?.base || form.domKey?.startsWith('class:') || typeof _classForm!=='function')return form;
  let supported=canWalk.get(form.key);
  if(supported===undefined) {
    const folder=decodeURIComponent(form.base).replace(/\/$/,'');
    const name=/^assets\/anim\/([^/]+)/.exec(folder)?.[1] || form.domKey?.replace(/^morph:/,'');
    supported=!!frameIndex[folder+'/'+(form.wpn?form.wpn+'_':'')+'walk_'] || !!monsterSpec(name,who._faceD??2);
    canWalk.set(form.key,supported);
  }
  return supported?form:(_classForm(who,isAlly)||form);
}
function battleForm(who,isAlly) {
  const form=window._actorBattleForm(who,isAlly);
  return window.__dimMapForm?window.__dimMapForm(form,who,isAlly):form;
}

function memberSpec(who,isAlly,dir) {
  const normal=battleForm(who,isAlly);
  if (!normal) return null;
  if(/冥皇丹特斯/.test(normal.domKey+' '+decodeURIComponent(normal.base||'')))return {folder:'world/art/dantes/d'+dir,prefix:'walk_'};
  const face=Object.create(who);
  face._faceD=dir;
  const turned=battleForm(face,isAlly);
  const form=turned?.domKey===normal.domKey?turned:normal;
  if (!form.base) return monsterSpec(who._setPoly?.n || who.poly?.n,dir);
  let folder=decodeURIComponent(form.base).replace(/^\/|\/$/g,'');
  const prefix=(form.wpn?form.wpn+'_':'')+'walk_';
  const cls=/^class:(.+):([^:]+)$/.exec(normal.domKey);
  if (cls && folder.startsWith('assets/classanim/')) {
    folder='assets/classanim/'+cls[1]+suffix[dir];
    const tab=meta?.HERO?.[cls[1]]?.[form.wpn]?.[dir];
    if (tab) {
      const o=origin(folder.slice(7),form.wpn+'_walk') || tab;
      return {folder,prefix,count:4,shadow:4,weapon:0,
        anchor:k=>[o[0]+(k?tab[k*2]:0),o[1]+(k?tab[k*2+1]:0)]};
    }
  }
  const morph=/^morph:(.+)$/.exec(normal.domKey);
  const same=monsterSpec(morph?.[1] || (/^assets\/anim\/([^/]+)/.exec(folder)||[])[1],dir);
  if (same) return same;
  const ground=folder.startsWith('art-v3/frames/') && window.AFK_ART_V3_DATA?.ground;
  return {folder,prefix,anchor:ground?()=>ground:null,costume:!!ground};
}

function setFor(spec) {
  if (!spec) return null;
  const key=spec.folder+'/'+spec.prefix;
  let set=sets.get(key);
  if (set) return set;
  set={body:[],shadow:[],weapon:[],ready:false,missing:false,anchor:spec.anchor,costume:spec.costume};
  if (sets.size>=256) sets.delete(sets.keys().next().value);
  sets.set(key,set);
  async function load() {
    const frames = (await loadStrideData())[key];
    if (!frames?.[0]?.length) { set.missing=true; return; }
    const base = new URL('../'+spec.folder.split('/').map(encodeURIComponent).join('/')+'/'+spec.prefix,mediaBase).href;
    const body = frames[0].map(frame=>parseInt(frame,10));
    // Older foot offsets describe four poses. Extended sequences use the
    // visible foot of each original frame, including its in-between poses.
    if(spec.count && body.length!==spec.count)set.anchor=null;
    const lazy = !!window.GiranPartyView?.mobile();
    for (const [layer, kind, extra] of [[0,'body',''],[1,'shadow','s_'],[2,'weapon','w_']]) {
      const extensions = new Map(frames[layer].map(frame=>[parseInt(frame,10),frame.endsWith('w')?'webp':'png']));
      const sequence = set[kind];
      body.forEach((frame, slot) => {
        const extension = extensions.get(frame);
        if (!extension) { sequence[slot] = null; return; }
        const url = base+extra+frame+'.'+extension;
        if (!lazy) { sequence[slot] = image(url); return; }
        // A change of facing should only request poses that reach the screen.
        Object.defineProperty(sequence,slot,{configurable:true,get() {
          const value=image(url,true);
          Object.defineProperty(sequence,slot,{value,enumerable:true});
          return value;
        }});
      });
    }
    if (lazy) {
      const first = set.body[0];
      if (!loaded(first)) await new Promise((resolve,reject) => {
        first.addEventListener('load', resolve, {once:true});
        first.addEventListener('error', reject, {once:true});
      });
    } else await Promise.all(set.body.map(im=>im.decode()));
    set.ready=true;
  }
  load().catch(()=>{set.missing=true;});
  return set;
}

const standingReferences=new Map();
function monsterReference(match,frame) {
  if(!match)return frame;
  const folder='assets/'+match[1]+'/'+match[2],prefix=match[3].replace(/[^/]*$/,'')+'idle';
  if(!meta?.MANIFEST?.[folder]?.[prefix+'_'])return frame;
  if(match[3]===prefix&&match[4]==='0')return frame;
  const url=folder+'/'+prefix+'_0.png';
  let ref=standingReferences.get(url);
  if(!ref){
    ref=image(url);standingReferences.set(url,ref);
    if(standingReferences.size>256)standingReferences.delete(standingReferences.keys().next().value);
  }
  // A spawn frame may contain only the tips of the wings. The standing pose supplies
  // one scale and ground anchor throughout the original animation.
  return loaded(ref)?ref:(ref.complete?frame:null);
}
function nativeGeometry(el,isMob) {
  const img=isMob
    ? el.querySelector('.mob-img-inner img:not(.mob-anim-shadow):not(.mob-anim-weapon):not(.mob-anim-weapon2)')
    : el.querySelector('.pm-body,.pet-body');
  if (!loaded(img)) return null;
  const er=el.getBoundingClientRect(), ir=img.getBoundingClientRect();
  const scale=er.width/(el.offsetWidth || 1);
  if (!ir.width || !er.width || !scale) return null;
  const cs=getComputedStyle(img), padX=parseFloat(cs.paddingLeft)||0,padY=parseFloat(cs.paddingTop)||0;
  const w=ir.width/scale-2*padX,h=ir.height/scale-2*padY;
  const src=img.currentSrc || img.src;
  const path=decodeURIComponent(new URL(window.__afkFrameSource?.(src)||src).pathname);
  const match=/\/assets\/(classanim|anim|morphanim)\/([^/]+)\/(.*)_(\d+)\.(?:png|webp)$/.exec(path);
  // 11-27：圖片載入失敗時畫面上是缺圖替代圖，拿它量尺寸會把之後載到的真圖放得很大
  if(isMob&&/\/assets\/ui\/missing-icon\.png$/.test(path))return null;
  const ref=isMob?monsterReference(match,img):img;
  if(!ref)return null;
  const ratio=Math.min(w/ref.naturalWidth,h/ref.naturalHeight);
  const action=ref===img?match?.[3]:match[3].replace(/[^/]*$/,'')+'idle';
  const p=match && origin(match[1]+'/'+match[2],action,ref===img?Number(match[4]):0) || foot(ref);
  const x=(ir.left-er.left)/scale+padX+(w-ref.naturalWidth*ratio)/2+p[0]*ratio;
  const y=(ir.top-er.top)/scale+padY+(h-ref.naturalHeight*ratio)/2+p[1]*ratio;
  const local=r=>[(r.left-er.left)/scale-x,(r.top-er.top)/scale-y,r.width/scale,r.height/scale];
  let sourceHeight=isMob||el.hasAttribute('data-pet')?silhouette(ref):bodyHeight(ref);
  // 11-27：有些八方向怪某個方向的待機圖是壞的（例：提卡爾 杰弗雷庫 d6 只剩一小塊），拿它當身高會把整隻放大好幾倍 → 同時參考正面（d2）待機圖，取較高的
  if(isMob&&match&&match[1]==='anim'&&/^d\d\//.test(match[3])){
    const url='assets/anim/'+match[2]+'/d2/idle_0.png';
    let front=standingReferences.get(url);
    if(!front){front=image(url);standingReferences.set(url,front);}
    if(loaded(front))sourceHeight=Math.max(sourceHeight,silhouette(front));
    else if(!front.complete)return null;   // 正面圖還在下載：下一幀再量，不拿壞圖記尺寸
  }
  // Some sprites (particularly flying dragons) have a world origin above their visible feet.
  const headRatio=(p[1]-foot(ref)[1]+sourceHeight)/sourceHeight;
  return {fallback:isMob&&!match,x,y,ratio,height:sourceHeight*ratio,sourceHeight,headRatio,
    offset:[Math.round(el.offsetWidth/2-x),Math.round((isMob||el.hasAttribute('data-pet')?el.offsetHeight:0)-y)],
    image:local(ir),box:isMob?local(img.parentElement.getBoundingClientRect()):null};
}

// Native battle cards anchor the image rectangle. Align its foot with the map
// cell for both standing and moving poses, including after the card is rebuilt.
const anchors=new WeakMap(),monsterGeometry=new Map();
const pendingGeometry=new Map();
let geometryGeneration=0;
let geometryFrame=0;
window.addEventListener('resize',()=>{geometryGeneration++;monsterGeometry.clear();});
function measureActors() {
  geometryFrame=0;
  // All native rectangles are read together before the next field frame moves anyone.
  for(const [el,{actor,isMob,appearance,kind,terrain,key}] of pendingGeometry) {
    if(!el.isConnected)continue;
    const g=(key && monsterGeometry.get(key)) || nativeGeometry(el,isMob);
    if(!g || !(g.height>0))continue;
    // 有動畫的怪卻量到靜態後備圖（動畫圖還沒載到）：先暫用，不記進快取，之後每幀再量，最多 120 次
    const temporary=!!(g.fallback&&isMob&&(meta?.MANIFEST?.['assets/anim/'+appearance]||typeof ANIM_MANIFEST!=='undefined'&&ANIM_MANIFEST['assets/anim/'+appearance])&&(actor.geometryTries=(actor.geometryTries||0)+1)<=120);
    if(key&&!temporary&&!monsterGeometry.has(key)){
      if(monsterGeometry.size>=256)monsterGeometry.delete(monsterGeometry.keys().next().value);
      monsterGeometry.set(key,g);
    }
    actor.nativeAnchor=g;actor.footOffset=g.offset;
    actor.footKey=temporary?null:appearance;actor.temporaryKey=temporary?appearance:null;
    if(!temporary)actor.geometryTries=0;
    actor.footView=geometryGeneration;actor.figureKind=kind;
    actor.inkHeight=figureHeight(terrain,kind,g.sourceHeight);
  }
  pendingGeometry.clear();
}
function alignFeet(actor,el,isMob,appearance,kind='character',terrain=null) {
  if (!el || !meta) return;
  if (actor.footKey!==appearance || !actor.nativeAnchor || actor.footView!==geometryGeneration || actor.figureKind!==kind) {
    const key=isMob && [kind,appearance,el.classList.contains('boss-slot'),el.classList.contains('boss-zoom')].join('/');
    const g=key && monsterGeometry.get(key);
    if(!g){
      pendingGeometry.set(el,{actor,isMob,appearance,kind,terrain,key});
      if(!geometryFrame)geometryFrame=requestAnimationFrame(measureActors);
      // 暫用中的尺寸繼續套用，直到量到真正的動畫圖
      if(actor.temporaryKey!==appearance||!actor.nativeAnchor||actor.footView!==geometryGeneration||actor.figureKind!==kind)return;
    } else {
      actor.nativeAnchor=g;actor.footOffset=g.offset;actor.temporaryKey=null;actor.geometryTries=0;
      actor.footKey=appearance;actor.footView=geometryGeneration;actor.figureKind=kind;
      actor.inkHeight=figureHeight(terrain,kind,g.sourceHeight);
    }
  }
  // During a hit the native HP card may be rebuilt. Its actor retains the measured standing pose.
  const g=actor.nativeAnchor;
  if(anchors.get(el)!==g){
    anchors.set(el,g);
    el.style.setProperty('--dm-figure-scale',String(actor.inkHeight/g.height));
    el.style.setProperty('--dm-figure-pivot',g.x+'px '+g.y+'px');
    if(isMob){
      el.style.setProperty('--dm-label-scale',String(g.height/actor.inkHeight));
      el.style.setProperty('--dm-label-x',g.x+'px');
      el.style.setProperty('--dm-label-y',g.y+'px');
      el.style.setProperty('--dm-ink-height',actor.inkHeight+'px');
    }
  }
  const [x,y]=actor.footOffset;
  if (el.style.getPropertyValue('--dm-foot-x')!==x+'px') el.style.setProperty('--dm-foot-x',x+'px');
  if (el.style.getPropertyValue('--dm-foot-y')!==y+'px') el.style.setProperty('--dm-foot-y',y+'px');
}

function paint(el,set,progress,isMob,mode='dm-walking') {
  if(pendingGeometry.has(el)&&!anchors.has(el))return false;
  const k=Math.max(0,Math.min(set.body.length-1,Math.floor(progress*set.body.length)));
  const frame=set.body[k];
  if(!loaded(frame))return false;
  let layer=layers.get(el);
  if (!layer || !el.contains(layer.box)) {
    const box=document.createElement('span');
    box.className='dm-stride'; box.setAttribute('aria-hidden','true');
    const make=kind=>{
      // 11-27 Ping：電腦版也改用畫布（原本只有手機用）。原本每換一格就改一次 <img> 網址，合成的步伐還要先轉成 data 網址，8 人打一群怪時每幀要花二十幾毫秒。
      const frame=document.createElement('canvas');
      frame.className='stride-'+kind;frame.hidden=true;
      box.append(frame);return frame;
    };
    layer={box,shadow:make('shadow'),body:make('body'),weapon:make('weapon')};
    el.append(box);layers.set(el,layer);
  }
  const anchorGeometry=anchors.get(el);
  if (layer.set!==set || layer.geometry!==(anchorGeometry||layer.geometry)) {
    const geometry=anchorGeometry||nativeGeometry(el,isMob);
    if (!geometry) return false;
    layer.geometry=geometry; layer.set=set; layer.index=-1;
    const first=set.body[0],ratio=geometry.sourceHeight/(set.sourceHeight||(isMob?silhouette(first):bodyHeight(first)));
    // Some action sheets were exported at another resolution. Preserve normal
    // crouches and leaps while matching those sheets to the standing actor.
    layer.ratio=geometry.ratio*(ratio<.65||ratio>1.52?ratio:1);
  }
  // A spell received between the animation frame timestamp and the callback
  // starts on its first image, even when the sampled elapsed time is negative.
  if (set.costume && mode==='dm-walking') {
    const lift=Math.sin(2*Math.PI*progress);
    layer.box.style.translate='0 '+(-2.5*lift*lift*layer.geometry.ratio).toFixed(2)+'px';
  } else layer.box.style.translate='';
  if (layer.index!==k || layer.awaitingPixels) {
    const geom=layer.geometry, anchor=set.anchor?set.anchor(k):foot(frame);
    // Keep the original frame's foot anchored while its body and equipment change.
    layer.box.style.transform='translate('+Math.round(geom.x-anchor[0]*layer.ratio)+'px,'+
      Math.round(geom.y-anchor[1]*layer.ratio)+'px) scale('+layer.ratio+')';
    layer.box.style.transformOrigin='0 0';
    layer.awaitingPixels=false;
    for (const kind of ['body','shadow','weapon']) {
      const im=set[kind][k],dest=layer[kind];
      if(!loaded(im)){
        if(im && !im.complete)layer.awaitingPixels=true;
        if(!dest.hidden)dest.hidden=true;
        continue;
      }
      if(dest.dmImage!==im){
        const width=im.naturalWidth||im.width,height=im.naturalHeight||im.height;
        // Frame sources often have identical dimensions. Keep layout stable while the image changes.
        if(dest.getAttribute('width')!==String(width)) dest.width=width;
        if(dest.getAttribute('height')!==String(height)) dest.height=height;
        if(dest instanceof HTMLCanvasElement){
          // 11-28 Ping：GPU 繪製開著時，這張小畫布只留著當位置，圖由 gpu-sprites 直接從原圖畫；退回網頁繪製時再補畫。
          if(window.GiranGpu?.active)dest.dmPending=true;
          else{const ctx=dest.getContext('2d',{willReadFrequently:true});   // 小畫布用 CPU 繪製：每次重畫不用跟 GPU 同步（實測快 10 倍以上）
            ctx.clearRect(0,0,width,height);ctx.drawImage(drawable(im),0,0);dest.dmPending=false;}
          dest.dmSourceFrame=im;
        }else dest.src=im.currentSrc||im.src||(im.dmURL||=im.toDataURL());
        dest.dmImage=im;
      }
      if(dest.hidden)dest.hidden=false;
    }
    layer.index=k;
  }
  if(!el.classList.contains(mode)){el.classList.remove(mode==='dm-walking'?'dm-performing':'dm-walking');el.classList.add(mode);}
  return true;
}

// Some legacy costumes contain only a standing pose. Flex each lower limb about
// the hip on alternating halves of the stride, keeping its standing silhouette.
const rigCache=new Map();
function poseStride(actor,el,dir,isMob=false){
  if(!el||dir===undefined)return null;
  const im=el.querySelector(isMob?'.mob-img-inner img:not(.mob-anim-shadow):not(.mob-anim-weapon):not(.mob-anim-weapon2)':'.pm-body,.pet-body');
  if(!loaded(im))return null;
  if(actor.poseDir===dir&&actor.poseEl===el&&actor.poseSet)return actor.poseSet;
  const shown=im.currentSrc||im.src;
  const key=String(window.__afkFrameSource?window.__afkFrameSource(shown):shown).replace(/_\d+\.(png|webp)(?:\?.*)?$/i,'_$1')+'/'+(dx[dir]-dy[dir]<0?'left':'right');
  let set=rigCache.get(key);
  // 最近用過的排到最後面，滿了先丟最久沒用的
  if(set){rigCache.delete(key);rigCache.set(key,set);}
  if(!set){
    const [fx,fy]=foot(im),w=im.naturalWidth,h=im.naturalHeight,inkHeight=ink.get(im.src)||h;
    if(!w||!h||w*h>1000000)return null;
    const hip=Math.max(1,Math.min(h-1,Math.round(fy-inkHeight*.32))),split=Math.max(1,Math.min(w-1,Math.round(fx))),pad=8;
    set={body:[],shadow:[],weapon:[],ready:false,missing:false,sourceHeight:isMob||el.hasAttribute('data-pet')?inkHeight:(bodyInk.get(im.src)||inkHeight),anchor:()=>[fx+pad,fy+pad]};
    try{
      for(let k=0;k<8;k++){
        const wave=Math.sin(k*Math.PI/4),lift=Math.abs(wave)*Math.min(2,inkHeight*.04),xstep=dx[dir]-dy[dir];
        const canvas=document.createElement('canvas');canvas.width=w+pad*2;canvas.height=h+pad*2;const ctx=canvas.getContext('2d');
        ctx.imageSmoothingEnabled=false;ctx.drawImage(im,0,0,w,hip, pad,pad-lift,w,hip);
        for(const [start,width,side] of [[0,split,-1],[split,w-split,1]]){
          const stride=wave*side,spread=(xstep?Math.sign(xstep):1)*stride*Math.min(4,inkHeight*.065);
          let row=hip,lastX,lastUp;
          for(let y=hip;y<=h;y++){
            const t=Math.min(1,(y-hip)/Math.max(1,fy-hip));
            const x=Math.round(spread*t),up=Math.round(lift*(1-t)+Math.max(stride,0)*Math.min(3,inkHeight*.06)*t);
            if(y>row&&(x!==lastX||up!==lastUp||y===h)){
              ctx.drawImage(im,start,row,width,y-row,pad+start+lastX,pad+row-lastUp,width,y-row);row=y;
            }
            lastX=x;lastUp=up;
          }
        }
        set.body.push(canvas);
      }
      set.ready=true;
    }catch{set.missing=true;}
    if(rigCache.size>=(window.GiranPartyView?.mobile()?48:96))rigCache.delete(rigCache.keys().next().value);rigCache.set(key,set);
  }
  actor.poseSet=set;actor.poseDir=dir;actor.poseEl=el;return set;
}
// Reconstruct a stride from the actor's own art when no directional sequence ships.
function stride(actor,el,who,kind) {
  if (!el || !meta) return null;
  const dir=actor.step?actor.heading:actor.path[0];
  if (dir===undefined) return null;
  const isMob=kind==='mob';
  if(kind==='pet'){
    const set=poseStride(actor,el,dir);
    return set?.ready&&anchors.has(el)?set:null;
  }
  const id=isMob?who.n:battleForm(who,kind==='ally')?.domKey;
  if (actor.strideDir!==dir || actor.strideId!==id) {
    if(actor.strideId!==id)actor.poseSet=null;
    actor.strideDir=dir; actor.strideId=id;
    const folder=isMob && typeof _animDir==='function'?(who._giranArt||_animDir(who.n)):who.n;
    const spec=isMob && /冥皇丹特斯/.test(folder)?{folder:'world/art/dantes/d'+dir,prefix:'walk_'}:isMob?monsterSpec(folder,dir):memberSpec(who,kind==='ally',dir);
    actor.strideSet=setFor(spec || (isMob && folder ? {folder:'assets/anim/'+folder,prefix:'walk_'} : null));
  }
  let set=actor.strideSet;
  if(!set||set.missing)set=poseStride(actor,el,dir,isMob);
  if(!set||set.missing)return null;
  if (!set.ready || !anchors.has(el)) return null;
  return set;
}

function finishStride(el,set,actor,isMob=false) {
  if (!el) return;
  if (set && actor.walking) paint(el,set,actor.progress,isMob);
  else if (el.classList.contains('dm-walking')) el.classList.remove('dm-walking');
}

// Use the actual form and the frames that exist on disk. Several costumes ship
// only frames 0, 2, 4 and 6, and may share one facing across several directions.
function actionSet(who,isAlly,dir,action,shared=false) {
  const base=battleForm(who,isAlly);
  if (!base?.base) return null;
  const face=Object.create(who);
  face._faceD=dir;
  const turned=battleForm(face,isAlly);
  const form=turned?.domKey===base.domKey?turned:base;
  let folder=decodeURIComponent(form.base).replace(/^\/|\/$/g,'');
  const cls=/^class:(.+):([^:]+)$/.exec(form.domKey);
  if (cls && /^assets\/classanim\//.test(folder) && meta?.HERO?.[cls[1]]?.[form.wpn]?.[dir]) {
    folder='assets/classanim/'+cls[1]+suffix[dir];
  }
  const name=(!shared && form.wpn?form.wpn+'_':'')+action;
  const ground=folder.startsWith('art-v3/frames/') && window.AFK_ART_V3_DATA?.ground;
  const originData=origin(folder.slice(7),name);
  return setFor({folder,prefix:name+'_',anchor:ground?()=>ground:
    originData?k=>origin(folder.slice(7),name,k):null});
}

function actionPose(el,who,isAlly,dir,act,progress) {
  if (!el || !meta) return false;
  let set=actionSet(who,isAlly,dir,act);
  if(act==='skill' && !set?.ready) {
    const weapon=battleForm(who,isAlly)?.wpn;
    const common=weapon==='bow'?actionSet(who,isAlly,dir,'attack'):actionSet(who,isAlly,dir,'skill',true);
    if(common?.ready || set?.missing)set=common;
    if(set?.missing)set=actionSet(who,isAlly,dir,'attack');
  }
  el.dmActionPending=!!set && !set.missing;
  if (!set?.ready || !paint(el,set,Math.min(.999,progress),false,'dm-performing')) return null;
  const frame=set.body[layers.get(el).index];
  if (!loaded(frame)) return null;
  el.dmActionFrames=set.body.length;
  el.dmActionPending=false;
  return frame;
}

Object.assign(window.AFK_DIMENSION_VIEW, {loadStrideData, mapForm, battleForm, stride, finishStride, alignFeet, actionPose, setFor, memberSpec, actionSet, foot, silhouette, figureHeight, townFigureRatio});
})();
