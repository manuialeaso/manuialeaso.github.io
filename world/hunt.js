'use strict';
window.GiranHunt=(()=>{
  // 11-28 Ping：三檔——1＝原版、2＝每個出生點 2 倍、3＝3 倍（原版 3 隻的點最多 9 隻）
  const tiers=[[3,3],[6,6],[9,9]];
  function population(value){
    const n=Number(value);
    if(Number.isInteger(n)&&n>=1&&n<=3)return n;
    return 1;
  }
  // 舊存檔是 5 檔：1→1、2～3→2、4～5→3
  const legacy=v=>{const n=Number(v);return Number.isInteger(n)&&n>=1&&n<=5?[1,2,2,3,3][n-1]:1;};
  function stored(settings,key){const v=settings?.[key];return settings?.popV===2?population(v):legacy(v);}
  function activePopulation(settings){
    if(!window.GiranPartyView?.mobile())return stored(settings,'population');
    return stored(settings,settings?.mobilePopulation!=null?'mobilePopulation':'population');
  }
  function rollPopulation(tier){
    const [min,max]=tiers[population(tier)-1];
    return min+Math.floor(Math.random()*(max-min+1));
  }
  const empty=()=>({radius:0,home:0,idle:0,rest:0,resume:60,escape:false,bossFirst:false,population:1,lists:{}});
  const number=(value,cap)=>Math.min(cap,Math.max(0,Math.floor(Number(value)||0)));
  const names=value=>[...new Set(String(value||'').split(/[,，、\n]/).map(s=>s.trim().slice(0,70)).filter(Boolean))].slice(0,80);
  function importLegacy(raw,monsters){
    if(!raw||typeof raw!=='object')return null;
    const h=empty(),flags=Number(raw.flags)||0;
    h.radius=number(raw.roamRange,60);h.home=number(raw.homeHpPct,90);
    h.idle=flags&16384?Math.max(3,number(raw.teleSec||10,120)):0;
    h.escape=!!(flags&2097152);
    h.rest=flags&65536?number(raw.restMpPct||30,95):0;
    h.resume=Math.max(h.rest+1,number(raw.restMpUp||60,100));
    for(const [original,dest] of [['ignore','ignore'],['boss','avoid']]){
      for(const [id,ids] of Object.entries(raw[original]||{})){
        if(!/^\d{1,6}$/.test(id)||!Array.isArray(ids))continue;
        const label=ids.map(n=>monsters[n]?.name || window.GiranAtlasData?.nativeMobs[n]?.[0]).filter(Boolean);
        if(label.length)(h.lists['map:'+id]||={})[dest]=[...new Set(label)].slice(0,80);
      }
    }
    return h;
  }
  let actor=null,area=null,center=null,quiet=null,nextTry=0,escapes=[],resting=false;
  function normal(){
    if(document.documentElement.dataset.playMode==='dimension')return false;
    const k=mapState.current;
    return !!k&&!/^town_|^afk_|^pride_f\d|^cr_|^dom_|^siege_/.test(k)&&!state.riftRun&&!state.prideClimb&&!state.oblivion&&!state.antharas&&!state._afkFinal&&
      !KING_ROOMS[k]&&!PURE_BOSS_MAPS.includes(k);
  }
  function field(){
    const f=window.GiranCombat?.field;
    return f?.map===mapState.current&&f.ready()&&!state.ff&&!document.hidden?f:null;
  }
  function mapId(){
    const k=mapState.current;
    return field()?.terrain.sourceMap??(player.giranWorld?.key===k?player.giranWorld.sourceMap:null)??window.GiranAtlasData?.floors[k]?.[2];
  }
  function listKey(){const id=mapId();return Number.isInteger(id)?'map:'+id:'area:'+mapState.current;}
  function reset(p){
    actor=player;area=mapState.current;quiet=null;nextTry=0;escapes=[];resting=false;
    const l=p||field()?.leader;center=l?{x:l.x,y:l.y}:null;
  }
  function context(){
    if(actor!==player||area!==mapState.current)reset();
    const f=field();if(!center&&f)center={x:f.leader.x,y:f.leader.y};
    return f;
  }
  function anchor(cell){if(player.giranHunt?.radius&&cell){context();center={x:cell[0],y:cell[1]};}}
  function distance(a,b){return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));}
  function allows(m){
    const h=player.giranHunt;
    if(!h||!m||!normal())return true;
    const f=context(),p=f?.point(m);
    if(f&&p&&(mapState.current!=='training'||m.beh==='主動'||m.aggro)&&distance(p,f.leader)<=2)return true;   // 11-27 Ping：所有地圖怪都主動（訓練場除外），貼上來就還手
    const l=h.lists?.[listKey()];
    return !resting&&!(l?.ignore?.includes(m.n)||l?.avoid?.includes(m.n))&&!(h.radius&&p&&center&&distance(p,center)>h.radius);
  }
  function controlled(){
    return ['stone','paralyze','freeze','stun','sleep'].some(k=>player.statuses?.[k]>0);
  }
  function recall(){
    if(controlled())return false;
    const ids=window.GiranAtlasData.itemIds;
    const owned=player.inv.find(i=>i.id===ids[40079]&&i.cnt>0);
    const price=shopPrice(120);
    if(!owned&&player.gold<price)return false;
    returnToTown();
    if(!mapState.current.startsWith('town_'))return false;
    if(owned)consume(owned);else player.gold-=price;
    logSys('隊長依狩獵設定帶全隊回村，'+(owned?'使用'+DB.items[owned.id].n:'購買回家卷軸花費 '+price+' 金幣')+'。');
    saveGame();return true;
  }
  function teleport(){
    if(controlled()||!GiranBookmarks.canTravel()||GiranBookmarks.scrollFlight)return false;
    const id='scroll_teleport',own=()=>player.inv.find(i=>i.id===id&&i.cnt>0);
    let item=own();
    if(!item&&DB.items[id].p>0&&player.gold>=shopPrice(DB.items[id].p)){
      buyItem(id,1);item=own();
    }
    if(item){const count=item.cnt;useItem(item.uid,true);return GiranBookmarks.scrollFlight||item.cnt<count;}
    return player.skills.includes('sk_teleport')&&GiranBookmarks.escapeSpell();
  }
  function step(){
    const h=player.giranHunt;
    if(!h||!normal()||player.dead||window.GiranRoam?.manual())return false;
    const f=context(),now=state.ticks,hp=100*player.hp/Math.max(1,player.mhp);
    if(now<nextTry)return false;
    if(h.home&&hp<h.home){nextTry=now+10;if(recall())return true;}
    if(h.rest&&['elf','mage'].includes(questCls(player))){
      const mp=100*player.mp/Math.max(1,player.mmp);
      if(resting?mp>=h.resume:mp<h.rest)resting=!resting;
    }else resting=false;
    const living=mapState.mobs.filter(m=>m&&!m._dead&&m.curHp>0);
    const danger=h.lists?.[listKey()]?.avoid;
    const near=danger?.length&&living.some(m=>{
      const at=f?.point(m);return danger.includes(m.n)&&(!f||at&&distance(at,f.leader)<=13);
    });
    if(living.some(allows)||resting)quiet=null;else if(quiet===null)quiet=now;
    const weak=h.escape&&hp<25;
    if(weak||near||(h.idle&&quiet!==null&&now-quiet>=h.idle*10)){
      nextTry=now+30;escapes=escapes.filter(t=>now-t<600);
      if(weak&&escapes.length>=2&&recall())return true;
      const result=teleport();
      if(result){
        const captain=player,map=mapState.current;
        const escaped=ok=>{if(ok&&captain===player&&map===mapState.current){if(weak)escapes.push(now);quiet=now;}};
        if(typeof result.then==='function')result.then(escaped);else escaped(true);
        return true;
      }
    }
    return false;
  }
  function exactSettlement(){const h=player.giranHunt;return !!(h&&(h.home||h.idle||h.rest||h.escape||Object.keys(h.lists||{}).length)&&normal());}
  const selector=document.querySelector('#giran-hunt-options [name="population"]');
  const panel=selector?.closest('details');
  const options=['原版數量','原版 2 倍','原版 3 倍'].map((t,i)=>new Option('第'+'一二三'[i]+'檔 · '+t,String(i+1)));
  function refreshPopulation(){
    if(!selector)return;
    if(selector.options.length!==options.length)selector.replaceChildren(...options);
    const settings=typeof player==='object'?player?.giranHunt:null;
    selector.value=String(activePopulation(settings));
  }
  function refreshCensus(){
    if(!panel?.open||!panel.offsetWidth||typeof player==='undefined'||!player?.cls)return;
    const line=panel.querySelector('[data-population-count]'),roam=window.GiranRoam,f=window.GiranCombat?.field;
    const key=mapState.current;
    let note='進入狩獵地圖後套用';
    if(f?.map===key&&f.ready()){
      const hunting=roam.owns();
      if(hunting&&!GiranGates.huntingGround(f.terrain,f.leader))note='離開村莊安全區後開始出怪';
      else if(hunting||roam.instanceSlots()||key==='afk_riftdg'||key==='afk_zodiac'){
        const count=mapState.mobs.filter(m=>m&&!m._dead&&m.curHp>0&&!m.boss&&(!hunting||m._giranSpawn?.kind==='ordinary')).length;
        note='場上普通怪 '+count+' 隻';
        if(hunting)note+=roam.fixedNote?.()||'／本區目標 '+roam.cap+' 隻';
        else note+=' · 依關卡波次出場';
      }else note='此戰場依關卡編制出場';
    }
    if(line.textContent!==note)line.textContent=note;
  }
  function refresh(){
    refreshPopulation();
    if(!panel||typeof player==='undefined'||!player?.cls||panel.contains(document.activeElement)&&!panel.querySelector('summary:focus'))return;
    const h=player.giranHunt||empty();
    for(const k of ['home','radius','idle','rest','resume','escape','bossFirst']){
      const i=panel.querySelector('[name="'+k+'"]');
      if(i.type==='checkbox')i.checked=h[k];else i.value=h[k];
    }
    const list=h.lists?.[listKey()]||{};
    for(const k of ['ignore','avoid'])panel.querySelector('[name="'+k+'"]').value=(list[k]||[]).join('、');
    panel.querySelector('output').textContent=window.GiranUI?.placeName(mapState.current)||'目前地圖';
  }
  if(panel){
    refreshPopulation();
    window.addEventListener('giran-party-layout',refreshPopulation);
    window.addEventListener('giran-mobile-layout',refreshPopulation);
    window.addEventListener('resize',refreshPopulation);
    panel.addEventListener('toggle',()=>{if(panel.open){refresh();refreshCensus();}});
    panel.addEventListener('change',e=>{
      const input=e.target,k=input.name;
      if(!k||!player?.cls||document.body.classList.contains('giran-guest'))return;
      const h=player.giranHunt||=empty();
      if(k==='population'){
        if(h.popV!==2){h.population=legacy(h.population);if(h.mobilePopulation!=null)h.mobilePopulation=legacy(h.mobilePopulation);h.popV=2;}
        if(window.GiranPartyView?.mobile())h.mobilePopulation=population(input.value);
        else h.population=population(input.value);
        refreshPopulation();
      }else if(k==='ignore'||k==='avoid'){
        const id=listKey(),l=(h.lists||={})[id]||={};
        l[k]=names(input.value);input.value=l[k].join('、');
        if(!l.ignore?.length&&!l.avoid?.length)delete h.lists[id];
      }else{
        h[k]=input.type==='checkbox'?input.checked:number(input.value,Number(input.max));
        h.resume=Math.max(h.rest+1,h.resume||60);h.idle=h.idle?Math.max(3,h.idle):0;
        if(input.type!=='checkbox')input.value=h[k];
        panel.querySelector('[name="resume"]').value=h.resume;
      }
      reset();window.GiranRoam?.refresh();saveGame();
      if(k==='population')refreshCensus();
    });
    let last='';setInterval(()=>{
      if(!panel.open||!panel.offsetWidth||typeof player==='undefined'||!player?.cls)return;
      const id=currentSlot+'/'+mapState.current+'/'+listKey();if(id!==last){last=id;refresh();}
      refreshCensus();
    },650);
  }
  function inside(x,y){return !player.giranHunt?.radius||!center||distance({x,y},center)<=player.giranHunt.radius;}
  return {population,activePopulation,rollPopulation,importLegacy,allows,step,anchor,inside,exactSettlement,refresh,reset};
})();
