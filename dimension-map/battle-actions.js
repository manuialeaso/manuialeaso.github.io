(() => {
'use strict';
const {actionPose, finishStride} = window.AFK_DIMENSION_VIEW;
const tones={hit:'#ffbf77',aim:'#f2ce92',basic:'#f2cc89',strike:'#f4bc86',spell:'#bcdcff',
  mark:'#d9adfa',heal:'#89efc0',guard:'#94d6ff',mana:'#a6c8ff',buff:'#f2d793',passive:'#e6caef'};
const cap=(v,min,max)=>Math.max(min,Math.min(max,v));
function node(parent,tag,cls) {
  const el=document.createElement(tag);
  el.className=cls; parent.append(el); return el;
}
function battleActions(field,resolve,available) {
  const fx=node(field,'canvas','dm-action-fx'), ctx=fx.getContext('2d');
  fx.setAttribute('aria-hidden','true');
  const tag=node(field,'div','dm-source-tag'), passiveTag=node(field,'div','dm-source-tag dm-passive-tag');
  const targetTag=node(field,'div','dm-recipient-tag');
  const labelSizes=new Map(),textCanvas=document.createElement('canvas');
  textCanvas.width=textCanvas.height=1;
  const textContext=textCanvas.getContext('2d');
  tag.hidden=passiveTag.hidden=targetTag.hidden=true;
  let lit=null;
  const poses=new Map(), lastFeatured=new Map(), lastProc=new Map(), nativePending=new Map();
  const arrivals=new Map(),impacts=new Map();
  let extraIds=new WeakMap(), nextExtra=0;
  let featured=null, passive=null, serial=0, dirty=false;

  function recipients(records) {
    const found=new Set(), result=[];
    for (const rec of records||[]) {
      if (!GiranPartyView.shows(rec.who)) continue;
      let t=resolve(rec.who);
      if(!t && rec.who && typeof rec.who==='object') {
        // Keep the recipient's identity if its sprite is created or removed during the hit.
        const who=rec.who, short=who.name||who._allyName||who.n;
        if(!short)continue;
        const enemy=who.uid!=null && ['hit','aim','basic','mark','spell','strike'].includes(rec.kind);
        if(!enemy && !extraIds.has(who))extraIds.set(who,'companion-'+(++nextExtra));
        t={who,id:enemy?'mob-'+who.uid:extraIds.get(who),name:short,short};
      }
      if (!t || found.has(t.id)) continue;
      found.add(t.id);result.push({...t,kind:rec.kind});
    }
    return result;
  }
  function point(ref) {
    const p=ref && resolve(ref.who);
    if(!p || p.id!==ref.id || (!p.el?.isConnected && !p.afterHit)) return null;
    return p;
  }
  function poseFor(source,refs,kind,time,priority) {
    const actor=source.actor, target=refs.find(t=>t.actor && t.id!==source.id);
    const distance=target?Math.hypot(target.x-source.x,target.y-source.y):0;
    const basic=kind==='basic';
    const current=poses.get(source.who);
    if (current && time<current.expires && ((current.started && !current.contact) ||
        (priority<=current.priority && (time<current.end || !current.contact)))) return;
    let dir=actor.heading ?? 4;
    if (target && distance>4) {
      const angle=Math.atan2(target.actor.fx-actor.fx,actor.fy-target.actor.fy);
      dir=(Math.round(angle/(Math.PI/4))+8)%8;
    }
    const duration=source.commandedWalk?320:basic?470:690;
    poses.set(source.who,{end:time+duration,expires:time+duration+2200,duration,started:false,contact:false,dir,
      act:basic || kind==='hit'&&!source.ranged?'attack':'skill',priority});
  }
  function memberCast(who) {
    if (!available() || who._downed || who.curHp<=0) return;
    const source=resolve(who);
    if (source?.actor) poseFor(source,[],'spell',performance.now(),1);
  }
  function active(who,skill,records,options={}) {
    if (!available() || !skill?.name || !GiranPartyView.shows(who)) return;
    const source=resolve(who);
    if (!source || source.mob || who.dead || who._downed) return;
    const kind=options.kind || ['hit','guard','heal','mark','buff'].find(k=>records?.some(r=>r.kind===k)) || 'buff';
    const main=(records||[]).filter(t=>t.kind===kind);
    const refs=recipients(main.length?main:records);
    if(kind==='basic'&&!refs.length)return;
    const priority=kind==='basic'?0:['大絕','龍魔法'].includes(skill.type)?3:2;
    const now=performance.now();
    poseFor(source,refs,kind,now,priority);
    const current=featured && now<featured.until?featured:null;
    const last=lastFeatured.get(source.id)??-Infinity;
    if(current && (priority<current.priority || (priority===current.priority && now-current.time<1550))) return;
    if(priority===0 && (source.onRoute || now-last<5200 || current)) return;
    if(priority===2 && current && current.source.id===source.id && now-last<2600) return;
    if(priority===0 && !source.ranged && refs[0] && Math.hypot(refs[0].x-source.x,refs[0].y-source.y)>76) return;
    featured={source,refs,kind,name:skill.name,
      time:now,until:now+(priority===0?1260:priority===3?2600:2180),priority,nativeFx:options.nativeFx};
    lastFeatured.set(source.id,now);
  }
  // Merge native spells that visit multiple victims inside the same game tick.
  function native(who,name,target,kind) {
    if (!available() || !who || !name || !GiranPartyView.shows(who)) return;
    let batch=nativePending.get(who);
    if(!batch){batch=new Map();nativePending.set(who,batch);}
    const key=kind+'|'+name;
    const entry=batch.get(key)||{who,name,kind,records:[]};
    if(target && !entry.records.some(t=>t.who===target)) entry.records.push({who:target,kind});
    batch.set(key,entry);
    if(dirty)return;
    dirty=true;
    const generation=serial;
    queueMicrotask(()=>{
      if(generation!==serial)return;
      dirty=false;
      const entries=Array.from(nativePending.values()).flatMap(m=>[...m.values()]);
      nativePending.clear();
      // Named casts get first choice when basic attacks and magic land in the same tick.
      for(const e of entries.sort((a,b)=>(a.kind==='basic')-(b.kind==='basic') ||
        (lastFeatured.get(resolve(a.who)?.id)??-Infinity)-(lastFeatured.get(resolve(b.who)?.id)??-Infinity))) {
        const k=e.kind==='support'?'buff':e.kind;
        const nativeFx=k==='spell' && typeof SPELL_FX!=='undefined' && !!SPELL_FX[e.name];
        active(e.who,{name:e.name},e.records,{kind:k,nativeFx});
      }
    });
  }
  function proc(key,_icon,name,_color,detail) {
    if(!field.classList.contains('dm-map'))return false;
    if(!available())return true;
    const source=detail?.owner?resolve(detail.owner):null;
    if(!source || !GiranPartyView.shows(source.who))return true;
    const kind=detail.kind||'passive', now=performance.now(), id=source.id+'|'+key;
    const age=now-(lastProc.get(id)??-Infinity);
    if(age<4400)return true;
    if(passive && now<passive.until) {
      const elapsed=now-passive.time;
      if(elapsed<(kind==='heal' && passive.kind!=='heal'?700:1150) ||
        (elapsed<1950 && kind!=='heal' && age<13000))return true;
    }
    if(lastProc.size>=160)lastProc.delete(lastProc.keys().next().value);
    lastProc.set(id,now);
    passive={source,name,refs:recipients((detail.targets||[]).map(who=>({who,kind}))),
      kind,time:now,until:now+2350};
    return true;
  }
  function pose(el,who,kind,now) {
    const p=poses.get(who);
    if (!p || now>=p.expires || (now>=p.end && p.contact) || who.dead || who._downed || who.curHp<=0) {
      if(p)poses.delete(who);
      if(el?.dmSwing){el.dmSwing.cancel();el.dmSwing=null;}
      el?.classList.toggle('dm-performing',false);
      return false;
    }
    if(!el)return false;
    finishStride(el,null,{});
    if(!p.started){p.started=true;p.first=now;p.end=now+p.duration;}
    // Advance the original sequence only after a decoded pose has been shown.
    // At low FPS the second sample must still show the impact, even if the
    // gameplay clock already ran through the wind-up and the recovery.
    const phase = p.image ? cap((now-p.firstInk)/p.duration, 0, p.contact ? .999 : .72) : .12;
    const image=actionPose(el,who,kind==='ally',p.dir,p.act,phase);
    if(image){
      if(el.dmSwing){el.dmSwing.cancel();el.dmSwing=null;}
      if(!p.image){p.image=image;p.firstInk=now;p.end=now+p.duration;}
      else if(image!==p.image || (el.dmActionFrames===1 && phase>=.5))p.contact=true;
    }else{
      el.classList.remove('dm-performing');
      const body=el.querySelector(':scope > .pm-body');
      if(body && !el.dmSwing){
        el.dmSwing=body.animate([{translate:'0 0',rotate:'0deg'},{translate:'-2px 1px',rotate:'-5deg',offset:.25},{translate:'5px -2px',rotate:'7deg',offset:.56},{translate:'0 0',rotate:'0deg'}],{id:'giran-swing',duration:p.duration,fill:'both'});
        el.dmSwing.pause();
      }
      if(el.dmSwing){
        const phase = cap((now-p.first)/p.duration, .15, p.fallbackContact ? .95 : .60);
        el.dmSwing.currentTime=phase*p.duration;
        if(phase>=.50){p.fallbackContact=true;if(!el.dmActionPending)p.contact=true;}
      }
    }
    return true;
  }
  function spellFx(who,name,target) {
    if(!available())return false;
    native(who,name,target,'spell');
    const generation=serial;
    setTimeout(()=>{
      if(serial!==generation)return;
      const shown=featured?.source.who===who && featured.name===name?featured:null;
      if(!available() || !resolve(target)?.el?.isConnected) {
        if(shown)shown.nativeFx=false;
        return;
      }
      try {window.playSpellFx(name,target,who);} catch(e) {if(shown)shown.nativeFx=false;return;}
      if(!shown)return;
      const owner=who===player?'player':'ally:'+String(who._slot||who.enSeed||'unknown');
      const key=name+'|'+target.uid+'|'+owner;
      const layers=Array.from(document.querySelectorAll('#vfx-layer .vfx-spell[data-fxkey]')).filter(el=>el.dataset.fxkey===key);
      if(layers.length) {
        for(const el of layers)el.classList.add('dm-featured-fx');
      } else {
        shown.nativeFx=false;
      }
    },180);
    return true;
  }
  function ellipse(x,y,rx,ry,color,alpha,width=1.4) {
    ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.stroke();
  }
  function glint(x,y,r,color,alpha) {
    ctx.globalAlpha=alpha;ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r*.28,y-r*.27);ctx.lineTo(x+r,y);
    ctx.lineTo(x+r*.28,y+r*.27);ctx.lineTo(x,y+r);ctx.lineTo(x-r*.28,y+r*.27);
    ctx.lineTo(x-r,y);ctx.lineTo(x-r*.28,y-r*.27);ctx.closePath();ctx.fill();
  }
  function sizeOf(label){
    const text=label.textContent,cache=label.dmSize;
    if(cache?.text===text)return cache;
    const passive=label===passiveTag,target=label===targetTag;
    const key=(target?'target/':passive?'passive/':'source/')+text;
    let size=labelSizes.get(key);
    if(!size){
      textContext.font=(target?'600 ':'bold ')+(passive||target?'11':'13')+'px "Microsoft JhengHei",sans-serif';
      const width=textContext.measureText(text).width+(target?10:passive?12:14);
      size={text,w:target?width:Math.min(180,width),h:target?19:passive?18:22};
      if(labelSizes.size>=256)labelSizes.delete(labelSizes.keys().next().value);
      labelSizes.set(key,size);
    }
    label.dmSize=size;return size;
  }
  function draw(event,label,now,secondary,avoid) {
    const s=point(event?.source);
    if(!s){label.hidden=true;return;}
    const age=now-event.time, color=tones[event.kind]||tones.passive;
    const alpha=cap((event.until-now)/280,0,1);
    const same=secondary && avoid?.id===s.id;
    label.hidden=!!same;
    if(!same) {
      const text=secondary?s.short+' · '+event.name:s.name;
      if(label.textContent!==text)label.textContent=text;
      if(label.dataset.source!==s.id)label.dataset.source=s.id;
      label.style.setProperty('--dm-tone',color);
      label.style.opacity=String(alpha);
      const {h,w}=sizeOf(label);
      const x=cap(s.x,w/2+5,fx.width-w/2-5);
      let y=cap(s.y-s.h-7,h+4,fx.height-25);
      if(secondary && avoid && Math.abs(avoid.x-x)<(w+avoid.w)/2+4 && Math.abs(avoid.y-y)<h+5)y=cap(avoid.y-h-7,h+3,fx.height-25);
      label.style.left=x+'px';label.style.top=y+'px';
      ctx.strokeStyle=color;ctx.globalAlpha=.72*alpha;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x,y+1);ctx.lineTo(s.x,s.y-s.h+2);ctx.stroke();
      if(!secondary)avoid={id:s.id,x,y,w};
    }
    const rx=secondary?15:21;
    ellipse(s.x,s.y+1,rx,rx*.38,color,.9*alpha,secondary?1.3:2);
    if(age<520)ellipse(s.x,s.y+1,rx+age/58,rx*.38+age/155,color,.52*(1-age/520),1);
    const end=event.refs.filter(t=>t.id!==s.id).map(point).find(Boolean);
    const hand={x:s.x+(end?Math.sign(end.x-s.x):1)*Math.min(12,s.h*.17),y:s.y-s.h*.57};
    const visualDelivery=!secondary && (event.kind==='spell' || event.kind==='hit' && s.ranged) && !event.nativeFx ||
      event.kind==='heal' || !secondary && ['guard','buff'].includes(event.kind);
    if(age<700 && (!secondary || event.kind==='heal' || event.kind==='mana')) {
      glint(hand.x,hand.y,3+4*Math.sin(Math.min(1,age/700)*Math.PI),color,1-age/750);
    }
    if(end && visualDelivery && age>=200 && age<725) {
      const t=cap((age-200)/525,0,1);
      const toX=end.x,toY=end.y-end.h*.48,arc=Math.min(22,Math.abs(toX-hand.x)*.11);
      const at=u=>[hand.x+(toX-hand.x)*u,hand.y+(toY-hand.y)*u-4*arc*u*(1-u)];
      ctx.strokeStyle=color;ctx.lineWidth=2;ctx.globalAlpha=.78;ctx.beginPath();
      for(let i=0;i<7;i++){const [x,y]=at(Math.max(0,t-(6-i)*.026));if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
      ctx.stroke();glint(...at(t),5,color,.98);
    }
    if(!secondary)window.GiranSpells?.draw(ctx,event.name,s,end,age,event.nativeFx);
    const impact=visualDelivery&&end?710:secondary?40:310;
    if(event.kind!=='aim' && age>=impact && age<impact+680) {
      const t=(age-impact)/680;
      for(const ref of event.refs) {
        const p=point(ref);if(!p)continue;
        ellipse(p.x,p.y+1,10+t*15,4+t*6,color,(1-t)*.95,2);
        if((ref.kind==='guard'||event.kind==='mana'||event.kind==='heal') && age<impact+480)
          glint(p.x+4,p.y-p.h*.47-t*8,6*(1-t),color,1-t);
      }
    }
    return avoid;
  }
  function arrival(mob,color) {
    if(!available() || mob.uid==null)return false;
    arrivals.set(mob,{start:performance.now(),color});
    return true;
  }
  function hit(mob,element){
    const point=resolve(mob);if(!available()||!point)return;
    const now=performance.now(),prior=impacts.get(mob);
    if(prior&&now-prior.start<100)return;
    if(impacts.size>=8)impacts.delete(impacts.keys().next().value);
    const color=({fire:'#ff9467',water:'#9bdcff',wind:'#afefc2',earth:'#e8c38c'})[element]||'#ffe0a1';
    impacts.set(mob,{start:now,x:point.x,y:point.y,h:point.h,color});
    if(point.actor)point.actor.hurtUntil=now+250;
    const card=point.el;
    if(card){card.dmWound?.cancel();
      // 11-28 Ping：受擊只留晃動，拿掉整隻怪變亮的濾鏡。濾鏡要把整隻怪（本體、影子、武器、血條）重新合成一次，場上每隻怪被打都在跑；受擊的閃光本來就另外畫在特效畫布上。
      card.dmWound=card.animate([{rotate:'0deg'},{rotate:'-4deg',offset:.26},{rotate:'2deg',offset:.58},{rotate:'0deg'}],{id:'giran-wound',duration:360,easing:'ease-out'});}
  }
  let lastDraw=false;
  function frame(now,w,h) {
    if(!lastDraw&&!featured&&!passive&&!arrivals.size&&!impacts.size)return;
    lastDraw=!!(featured||passive||arrivals.size||impacts.size);
    if(fx.width!==w||fx.height!==h){fx.width=w;fx.height=h;}
    ctx.clearRect(0,0,w,h);
    for(const [mob,impact] of impacts){
      const age=Math.max(0,now-impact.start)/420;
      if(age>=1){impacts.delete(mob);continue;}
      const pos=resolve(mob)||impact;
      const x=pos.x,y=pos.y-impact.h*.53;
      ctx.save();ctx.translate(x,y);ctx.rotate(-.58);ctx.globalAlpha=.96*(1-age);
      ctx.fillStyle=impact.color;const r=8+18*age;
      ctx.beginPath();ctx.moveTo(-r,3);ctx.quadraticCurveTo(2,-6,r,-3);ctx.quadraticCurveTo(0,2,-r,3);ctx.fill();
      glint(0,0,3+5*(1-age),impact.color,1-age);ctx.restore();
    }
    for(const [mob,entry] of arrivals) {
      const t=cap((now-entry.start)/720,0,1);
      if(t>=1){arrivals.delete(mob);continue;}
      const p=resolve(mob);
      if(p?.el?.isConnected && !p.afterHit && mob.curHp>0)ellipse(p.x,p.y,15+20*t,6+8*t,entry.color,(1-t)*.85,2);
    }
    if(featured && now>=featured.until)featured=null;
    if(passive && now>=passive.until)passive=null;
    const occupied=draw(featured,tag,now,false,null);
    draw(passive,passiveTag,now,true,occupied);
    const focus=featured||passive, caster=point(focus?.source);
    if(lit!==caster?.el) {lit?.classList.remove('dm-lit');lit=caster?.el;lit?.classList.add('dm-lit');}
    if(lit)lit.style.setProperty('--dm-aura',tones[focus.kind]||tones.passive);
    const link=(featured?.refs.some(t=>t.id!==featured.source.id)?featured:null) ||
      (passive?.kind==='heal'?passive:null);
    const ref=link?.refs.find(t=>t.id!==link.source?.id && point(t)), receiver=point(ref);
    targetTag.hidden=!receiver || now-link.time<250;
    if(!targetTag.hidden) {
      const label=({heal:'受治療',guard:'受護盾',buff:'受強化'})[ref.kind]||'目標';
      const text=label+'・'+receiver.short;
      if(targetTag.textContent!==text)targetTag.textContent=text;
      targetTag.style.setProperty('--dm-tone',tones[link.kind]||tones.passive);
      const {w:tw,h:th}=sizeOf(targetTag);
      const obstacles=[];
      for(const name of [tag,passiveTag])if(!name.hidden) {
        const cx=parseFloat(name.style.left),cy=parseFloat(name.style.top);
        const {w,h}=sizeOf(name);
        obstacles.push({l:cx-w/2-3,r:cx+w/2+3,t:cy-h-3,b:cy+3});
      }
      const rx=receiver.x,ry=receiver.y;
      const options=[[rx,ry+9],[rx-tw/2-18,ry-11],[rx+tw/2+18,ry-11],
        [rx,ry-receiver.h-th-5],[rx-tw/2-28,ry-receiver.h*.48],[rx+tw/2+28,ry-receiver.h*.48]];
      const candidates=options.map(([x,y])=>[cap(x,tw/2+5,w-tw/2-5),cap(y,5,h-th-5)]);
      const [x,y]=candidates.find(([cx,cy])=>obstacles.every(o=>cx+tw/2<o.l || cx-tw/2>o.r || cy+th<o.t || cy>o.b)) || candidates[0];
      targetTag.style.left=x+'px';targetTag.style.top=y+'px';
      targetTag.dataset.target=ref.id;
      if(Math.abs(x-rx)>12){
        ctx.globalAlpha=.75;ctx.strokeStyle=tones[link.kind];ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(x+Math.sign(rx-x)*tw/2,y+th/2);ctx.lineTo(rx,ry-3);ctx.stroke();
      }
    }
  }
  let viewport=null;
  window.addEventListener('resize',()=>{viewport=null;});
  window.addEventListener('scroll',ev=>{if(ev.target===document||ev.target?.contains?.(field))viewport=null;},true);
  new ResizeObserver(()=>{viewport=null;}).observe(field);
  function screenRect(left,top,width,height){
    if(!viewport){
      const f=field.getBoundingClientRect();
      if(!f.width||!f.height)return null;
      viewport={x:f.left,y:f.top,sx:f.width/field.clientWidth,sy:f.height/field.clientHeight};
    }
    const {x,y,sx,sy}=viewport;
    return new DOMRect(x+left*sx,y+top*sy,width*sx,height*sy);
  }
  function rect(who) {
    if(!available())return null;
    const p=resolve(who);if(!p || (!p.el?.isConnected && GiranPartyView.shows(who)))return null;
    return screenRect(p.x-p.h*.23,p.y-p.h,p.h*.46,p.h);
  }
  function reset() {
    serial++;viewport=null;dirty=false;nativePending.clear();poses.clear();lastFeatured.clear();lastProc.clear();arrivals.clear();impacts.clear();
    extraIds=new WeakMap();nextExtra=0;
    featured=passive=null;
    tag.hidden=passiveTag.hidden=targetTag.hidden=true;ctx.clearRect(0,0,fx.width,fx.height);
    lit?.classList.remove('dm-lit');lit=null;
    for(const el of field.querySelectorAll('.dm-performing'))el.classList.remove('dm-performing');
    for(const el of field.querySelectorAll('#player-morph-sprite,.party-sprite')){
      if(el.dmSwing){el.dmSwing.cancel();el.dmSwing=null;}
    }
  }
  return {active,native,memberCast,spellFx,proc,pose,rect,screenRect,arrival,hit,frame,reset};
}

Object.assign(window.AFK_DIMENSION_VIEW, {battleActions});
})();
