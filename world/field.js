(() => {
'use strict';
const {TerrainView, BattleFormation, walker, advance, route, loadStrideData, mapForm, battleForm, stride, finishStride, alignFeet, trainingHealth, battleActions} = window.AFK_DIMENSION_VIEW;
const field = document.getElementById('battle-view');
const enemyList = document.getElementById('mob-list');
const game = document.getElementById('game-screen');
const heading = document.getElementById('map-adventure-heading');

if (field && enemyList && game) install();

function install() {
  const element = (tag, css, parent) => {
    const el = document.createElement(tag);
    el.className = css;
    parent.append(el);
    return el;
  };
  const canvas = element('canvas', 'dm-map-canvas', field);
  canvas.hidden = true;
  canvas.setAttribute('aria-hidden', 'true');
  const terrain = new TerrainView(canvas);
  const heads = element('div','giran-mob-heads',field);
  heads.id='giran-mob-heads';
  let fieldWidth=0,fieldHeight=0;
  new ResizeObserver(([entry])=>{
    fieldWidth=Math.round(entry.contentRect.width);fieldHeight=Math.round(entry.contentRect.height);
  }).observe(field);
  const marker = element('div', 'dm-marker', field);
  marker.hidden = true;
  const mobileQuery = matchMedia('(max-width: 820px), (max-width: 1024px) and (max-height: 520px) and (pointer: coarse)');
  const board=new BattleFormation(terrain);
  // Screen-space offsets give allies a visible front and back line on a 2:1 isometric floor.
  const enemySlots=[[168,12],[145,-96],[155,102],[258,-45],[252,71],[90,135],[236,-125]];
  const partySlots=[[-100,61],[-102,-56],[-208,-14],[16,-108],[0,111],[-201,-107],[-200,96],[-286,12],[-310,94],[-299,-93],[-92,156],[-102,-155],[85,131],[76,-140],[-357,-11]];
  const meleeSlots=[[-48,0],[48,0],[0,-24],[0,24],[-24,-12],[24,12],[24,-12],[-24,12]];
  const rangedSlots=[[-201,-73],[-201,76],[-120,-120],[-121,126],[-258,0],[-252,-90],[-248,103]];
  const companionSlots=[[60,65],[44,-67],[-41,82],[-49,-73],[122,44],[-137,35],[-121,-47]];
  const mobs = new Map(), allies = new Map();
  const companions=new Map();
  let rally;
  let mobHistory=new WeakMap(),outdoorHunt=false;
  let active=false, suspended=false, request=0, previous=0, plannedAt=0;
  let partyPlan=0, mobPlan=0, mobPlanAt=0, nextParty=new Set(), nextMobs=new Set();
  function planSlice(items,cursor,count){
    const work=new Set();
    for(let n=0;n<Math.min(count,items.length);n++)work.add(items[(cursor+n)%items.length]);
    return work;
  }
  let sceneId = '', mapKey = null, renderedRevision = -1;
  let leader, rosterHero, destination = null, resumeAt = 0, blockedAt = 0, cachedTarget = null;
  let walkingCommand=false;
  let paused = false, pausedAt=0,blinkMap=null;
  const fieldReady=()=>active && !!leader && mapKey===mapState.current && !!terrain.world && !!terrain.camera && !terrain.resolving && !terrain.pending;
  const canShow=()=>fieldReady() &&
    field.classList.contains('dm-map') && !window.__vfxOff && !backgroundBattle();
  const actions=battleActions(field,resolveActor,canShow);

  function mapLabel(key) {
    const select = document.getElementById('map-select');
    if (select?.value === key && select.selectedOptions[0]) {
      return select.selectedOptions[0].textContent.trim().replace(/^[🔒⚔️\s]+/u, '');
    }
    if (typeof MAP_REGIONS !== 'undefined') {
      for (const region of MAP_REGIONS) {
        const found = region.maps.find(m => m.v === key);
        if (found) return found.t;
      }
    }
    return (typeof mapEntryOf === 'function' && mapEntryOf(key)?.t) || key;
  }
  function mobile() { return mobileQuery.matches || window.__afkm?.isMobile?.(); }
  function encounter(key) {
    const floor=/^pride_f(\d+)$/.exec(key);
    if(floor)return {signature:key,name:'傲慢之塔 '+floor[1]+' 樓'};
    if(key==='afk_riftdg'){
      const run=window.__afkRiftDg?.run?.();
      if(run){
        const id='riftdg_'+run.id;
        const variant=id+(run.pick?'_'+run.pick:'');
        const pick=run.D.pick?.find(p=>String(p[0])===String(run.pick));
        const earth=window.__afkRiftDg.earthField(run);
        if(earth)return {signature:earth+'@'+run.until,field:earth,
          name:run.D.n+'・安塔瑞斯・'+(run.bd?'地龍王房':run.D.stages[run.si].n)};
        return {signature:variant,field:window.AFK_HUNTING_FIELDS[variant]?variant:id,
          name:run.D.n+(pick?'・'+pick[1]:''),art:window.AFK_HUNTING_FIELDS[id]?undefined:SPECIAL_AREA_BG[key]};
      }
    }
    if(key==='rift_battle')return {signature:key,name:'時空裂痕戰場'};
    const name=typeof SANCTUARY_MAP_NAMES!=='undefined' && SANCTUARY_MAP_NAMES[key];
    if(!window.AFK_HUNTING_FIELDS[key] && typeof SPECIAL_AREA_BG!=='undefined' && SPECIAL_AREA_BG[key]){
      const art=typeof upgradeAreaPath==='function'?upgradeAreaPath(SPECIAL_AREA_BG[key]):SPECIAL_AREA_BG[key];
      return {signature:key,name,art};
    }
    return {signature:key,name};
  }
  function backgroundBattle() {
    return state.running === false || GiranCombat.offline();
  }
  function selectScene(current){
    heads.hidden=true;
    GiranFieldUI.clearMark(field);
    actions.reset();mapKey=mapState.current;sceneId=current.signature;blinkMap=null;
    const labels=[current.name,typeof mapDisplayName==='function'&&mapDisplayName(mapKey),
      typeof ANTHARAS_AREA_NAMES!=='undefined'&&ANTHARAS_AREA_NAMES[mapKey],mapLabel(mapKey),
      window.AFK_HUNTING_FIELDS[current.field||mapKey]?.art];
    const label=labels.find(value=>typeof value==='string'&&value!==mapKey&&/[\u3400-\u9fff]/.test(value))||'冒險區域';
    field.dataset.giranPlace=label;
    terrain.select(current.field || sceneId,label,current.art);
  }
  GiranCombat.beginTravel=key=>{
    if(!key||key.startsWith('town_')||document.hidden||game.classList.contains('hidden')||backgroundBattle())return;
    const current=encounter(key);
    TerrainView.preloadEntry(current.field||current.signature);
    // A physical village crossing hands over its existing World after changeMap returns.
    queueMicrotask(()=>{if(mapState.current===key)sync();});
  };
  function clearMovement() {
    GiranFieldUI.clearMark(field);
    for(const actor of mobs.values())removeHead(actor);
    mobs.clear(); allies.clear(); companions.clear();mobHistory=new WeakMap();
    mobPlan=0;mobPlanAt=0;
    const crossing=terrain.continuation;
    outdoorHunt=terrain.kind==='tiles'&&!terrain.instance&&!isSiegeArea(mapKey)&&mapCategoryOf(mapKey)==='wild';
    rosterHero=null;actions.reset();
    if (active) GiranCombat.attach(worldState);
    leader=crossing?.captain||walker(...terrain.origin);rally={x:leader.x,y:leader.y};board.floor=[];
    if(crossing)for(const [id,a] of crossing.party)allies.set(id,a);
    for(const node of field.querySelectorAll('#pet-layer .dm-grounded'))node.classList.remove('dm-grounded');
    destination = travel = trail = null; resumeAt = blockedAt = 0; plannedAt = 0; cachedTarget = null;
    walkingCommand=!!crossing?.goal;
    if(crossing)destination=crossing.goal;
    terrain.continuation=null;marker.hidden = true;
    for (const moving of field.querySelectorAll('.dm-walking')) moving.classList.remove('dm-walking');
    for(const card of enemyList.querySelectorAll('.dm-off-camera'))card.classList.remove('dm-off-camera');
  }
  function stop() {

    active = false; suspended=false; GiranCombat.attach(null);
    if (request) cancelAnimationFrame(request);
    request = 0; previous = 0; mapKey = null;sceneId=''; paused = false;
    field.classList.remove('dm-map');
    document.body.classList.remove('dm-viewing');
    delete field.dataset.dmTerrain;delete field.dataset.dmMap;delete field.dataset.dmScene;
    marker.hidden = true;
    terrain.reset(); clearMovement();
    delete window.__dimMapForm;
    delete window.__dimMapArrival;
    delete window.__dimMapHit;
    delete window.__dimMapSkillPerformed;
    delete window.__dimMapProc;
    delete window.__dimMapNative;
    delete window.__dimMapMemberCast;
    delete window.__dimMapSpellFx;
    delete window.__dimMapCompanions;
    delete window.__dimMapCompanionPoint;
  }
  function suspend() {
    if(!active || suspended)return;
    suspended=true;
    if(request)cancelAnimationFrame(request);
    request=0;previous=0;actions.reset();GiranCombat.attach(null,worldState);
  }
  function sync() {

    const loaded = typeof player !== 'undefined' && player?.cls &&
      typeof mapState !== 'undefined' && typeof state !== 'undefined' &&
      !game.classList.contains('hidden');
    const inBattle = loaded && !!mapState.current && !field.classList.contains('hidden') && !mapState.current.startsWith('town_');
    if (!inBattle) { if (active) stop(); return; }
    if (document.hidden) { suspend(); return; }
    if(suspended){
      suspended=false;previous=0;plannedAt=0;blockedAt=0;
      if(rosterHero && rosterHero!==player)stop();
      else {GiranCombat.attach(worldState);request=requestAnimationFrame(frame);}
    }
    if (!active) {
      active = true; previous = 0; GiranCombat.attach(worldState);
      window.__dimMapForm=mapForm;
      window.__dimMapArrival=actions.arrival;
      window.__dimMapHit=actions.hit;
      loadStrideData().catch(error => console.warn('步態載入失敗',error));
      window.__dimMapSkillPerformed = showSkill;
      window.__dimMapProc=actions.proc;
      window.__dimMapNative=actions.native;
      window.__dimMapMemberCast=actions.memberCast;
      window.__dimMapSpellFx=actions.spellFx;
      window.__dimMapCompanions=()=>{
        if(!field.classList.contains('dm-map'))return null;
        return companions;
      };
      window.__dimMapCompanionPoint=pet=>{
        const actor=companions.get(pet.uid);
        if(!actor || !terrain.camera || mapKey!==mapState.current)return null;
        const [x,y]=terrain.project(actor.fx,actor.fy);
        return {x:x/terrain.width,y:y/terrain.height};
      };
      request = requestAnimationFrame(frame);
    }
    if(mapKey!==mapState.current&&!backgroundBattle())selectScene(encounter(mapState.current));
  }
  field.addEventListener('click', event => {
    if (!active || !field.classList.contains('dm-map') || !leader || player.dead ||
        document.hidden || state.running===false || state.ff || window.__afkOfflineNow?.()) return;
    if (event.target.closest('.mob-target[data-uid]')) {
      // The game's delegated click handler has already resolved the UID to a live slot.
      cancelOrders();
      return;
    }
    if (event.target.closest('button,select,input,a,[onclick],#status-icon-bar')) return;
    if (terrain.resolving || terrain.pending || terrain.kind === 'loading') return;
    const rect = field.getBoundingClientRect();
    const to = terrain.cell((event.clientX - rect.left) * field.clientWidth / rect.width,
                            (event.clientY - rect.top) * field.clientHeight / rect.height);
    const world=terrain.world;
    if(!world?.map)return;
    if(GiranRoam.manual()){GiranRoam.choose(null);cancelOrders();}
    walkTo(to);
    window.GiranHunt?.anchor(destination);
    resumeAt = blockedAt = 0;
  });

  function walkTo(to){routeLeader(to);walkingCommand=true;}
  function routeLeader(to,replan=false,following=false) {
    if(!replan){walkingCommand=false;travel=null;if(!following)trail=null;}
    const occupied=board.blockers(leader);
    if(!replan)resumeAt=blockedAt=0;
    const start=leader.step||[leader.x,leader.y],world=terrain.world;
    // An occupied destination cannot be reached by an occupancy-aware search.
    // Ask for a route around traffic first, then keep the walkable terrain goal for yielding allies.
    const route=world.walkRoute(start,to,occupied),end=route?.to||start;
    leader.path=route?.path||[];destination=end;
    [leader.goalX,leader.goalY]=end;
  }
  function restoreCards(){
    if(!fieldReady())return;
    for(const card of enemyList.children){
      const actor=mobs.get(card.dataset.uid);
      if(actor&&!card.classList.contains('dm-placed'))placeActor(card,actor);
    }
  }
  function placeActor(node,actor) {
    const [x, y] = terrain.project(actor.fx, actor.fy);
    if(!node.classList.contains('dm-placed'))node.classList.add('dm-placed');
    // Non-inherited properties keep moving one sprite from restyling all of its image and status children.
    const [dx,dy]=actor.footOffset||[0,0],px=Math.round(x)+dx,py=Math.round(y)+dy;
    const z=String(4+Math.max(0,Math.min(60,Math.floor(60*y/terrain.height))));
    if(node.dmX!==px||node.dmY!==py){
      const party=node.id==='player-morph-sprite'||node.classList.contains('party-sprite');
      node.style.translate=(party?'calc('+px+'px - 50%)':px+'px')+' '+py+'px';
      node.dmX=px;node.dmY=py;
    }
    if(node.style.zIndex!==z)node.style.setProperty('z-index',z,'important');
    return z;
  }
  function position(node,actor){
    const z=placeActor(node,actor);
    terrain.cover(actor,z,Math.ceil(Math.min(156,Math.max(65,(actor.inkHeight||60)+13))),actor.footprint?138:96,actor===leader);
  }
  function removeHead(actor){
    if(!actor.head)return;
    actor.head.card.giranHead=null;
    actor.head.root.remove();
    actor.head=null;
  }
  function positionHead(card,actor,mob){
    if(!live(mob)){removeHead(actor);return;}
    let head=actor.head;
    if(!head){
      const root=element('div','giran-head',heads);
      root.dataset.uid=card.dataset.uid;
      const name=element('div','mob-name giran-head-name',root);
      const bar=element('div','giran-head-hp',root);
      bar.setAttribute('role','meter');bar.setAttribute('aria-label',mob.n+' 血量');
      bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');
      head=actor.head={root,name,bar,fill:element('i','',bar)};
    }
    if(head.card!==card){
      if(head.card)head.card.giranHead=null;
      head.card=card;card.giranHead=head.root;
      const source=card.querySelector('.mob-name');
      head.name.replaceChildren(...Array.from(source?.children||[],n=>n.cloneNode(true)));
      // The native shield painter can run before this card has a map position.
      const shield=card.querySelector('.afk-rr-sh');
      if(shield){head.root.querySelector('.afk-rr-sh')?.remove();head.root.append(shield);}
      card.classList.add('giran-projected-head');
    }
    head.root.classList.toggle('active',card.classList.contains('active'));
    head.root.classList.toggle('name-show',card.classList.contains('name-show'));
    if(head.bar.hidden===_showMobHp)head.bar.hidden=!_showMobHp;
    const hp=Math.max(0,Math.min(100,Math.round(mob.curHp*100/(mob.hp||1))));
    if(head.hp!==hp){
      head.hp=hp;
      head.fill.style.transform='scaleX('+hp/100+')';
      head.bar.setAttribute('aria-valuenow',String(hp));
    }
    const [dx,dy]=actor.footOffset||[0,0];
    const x=card.dmX-dx,y=card.dmY-dy;
    const height=(actor.inkHeight||62)*(actor.nativeAnchor?.headRatio??1);
    const bottom=Math.round(y-height)-4;
    // Keep the heading of a partially visible monster readable at the top edge.
    const visible=x>=0&&x<=terrain.width&&y>=0&&bottom<=terrain.height;
    if(head.root.hidden===visible)head.root.hidden=!visible;
    if(!visible)return;
    const margin=Math.min(76,terrain.width/2);
    // When the name and bars would be clipped above the field, tuck them beside the
    // monster on the roomier side. Pinning them straight down covers flying sprites.
    const beside=bottom<50;
    const shift=beside?(x<terrain.width/2?1:-1)*(margin+Math.min(80,(actor.inkHeight||62)*.55)+4):0;
    const left=Math.min(terrain.width-margin,Math.max(margin,x+shift));
    const top=Math.max(50,bottom);
    if(head.x!==left||head.y!==top){
      head.x=left;head.y=top;
      head.root.style.translate=left+'px '+top+'px';
    }
  }
  function approach(actor,anchor,offset) {
    // A resting follower retains the seat chosen for this captain and formation.
    const held=actor.seated;
    if(held&&held.anchor===anchor&&held.x===anchor.x&&held.y===anchor.y&&held.offset===offset&&held.revision===terrain.revision&&
       actor.goalX===held.gx&&actor.goalY===held.gy&&(actor.step||actor.path.length||actor.x===held.gx&&actor.y===held.gy)&&
       !board.occupied(actor,held.gx,held.gy))return;
    const seat=board.seat(actor,anchor,offset);
    if(!seat)return;
    const [x,y]=seat;
    actor.seated={anchor,x:anchor.x,y:anchor.y,offset,revision:terrain.revision,gx:x,gy:y};
    if(actor.goalX===x && actor.goalY===y && (actor.step || actor.path.length || actor.x===x && actor.y===y))return;
    const to=route(actor,seat,terrain,board.blockers(actor));
    if((to[0]!==x || to[1]!==y) && board.occupied(actor,...to)){actor.path=[];return;}
    actor.goalX=to[0];actor.goalY=to[1];
  }
  function ranged(who) {
    const id = who?.eq?.wpn?.id;
    const weapon = typeof DB !== 'undefined' && DB.items?.[id];
    return weapon?.isBow || weapon?.animFam === 'bow' || (id && typeof atkSpdFamily === 'function' && atkSpdFamily(id) === 'bow') ||
      who?.cls === 'mage';
  }
  function live(ref) { return ref && !ref._dead && ref.curHp > 0; }
  function resolveActor(who) {
    if (!who || !rosterHero || !fieldReady()) return null;
    let actor,el,id,short,name,mob=false,afterHit=false;
    if(who===rosterHero) {
      actor=leader;id='hero';el=document.getElementById('player-morph-sprite');
      short=who.name || allyName(who);name='隊長・'+short;
    } else if(rosterHero.allies?.includes(who)) {
      id='ally-'+who._slot;actor=allies.get(String(who._slot));
      el=typeof _allySpriteStates!=='undefined' && _allySpriteStates[String(who._slot)]?.el;
      short=who.name || who._allyName || allyName(who);
      const index=rosterHero.allies.indexOf(who)+1;
      if(rosterHero.allies.some(a=>a && a!==who && (a.name||a._allyName||allyName(a))===short))short+=' '+index;
      name='傭兵・'+short;
    } else if(who.uid!=null && (mapState.mobs.includes(who)||mobHistory.has(who))) {
      id='mob-'+who.uid;actor=mobHistory.get(who);short=name=who.n;mob=true;
      if(!actor)return null;
      el=actor.el;
      if(!el?.isConnected || el.dataset.uid!==String(who.uid))
        el=Array.from(enemyList.children).find(n=>n.dataset.uid===String(who.uid));
      if(!el)afterHit=performance.now()-actor.seenAt<900;
    } else return null;
    // Hidden mercenaries still have real positions for aiming and hit effects.
    const hiddenMember=!mob && !GiranPartyView.shows(who);
    if(!actor || (!el?.isConnected && !afterHit && !hiddenMember))return null;
    const [x,y]=terrain.project(actor.fx,actor.fy);
    return {who,actor,el,id,short,name,mob,afterHit,x,y,h:Math.max(18,Math.min(150,actor.inkHeight||62)),
      ranged:!mob && ranged(who), onRoute:!mob && (!!destination || actor.path.length>1),
      commandedWalk:!mob && !!destination && (!!actor.step || actor.path.length>0)};
  }
  // Native projectiles use viewport rectangles. The original party element can be
  // one pixel tall, so supply the visible silhouette measured at its current foot.
  for(const [fn,getWho] of [['_partyMemberRect',who=>who],['_pmCasterRect',()=>player]]) {
    const original=window[fn];
    if(typeof original==='function')window[fn]=function(who) {
      return actions.rect(getWho(who)) || original.apply(this,arguments);
    };
  }
  function point(who) {
    if(!who)return null;
    if(who===player)return leader;
    const enemy=mobHistory.get(who);
    if(enemy)return mapState.mobs.includes(who)?enemy:null;
    if(player.allies?.includes(who))return GiranPartyView.canFight(who)?allies.get(String(who._slot)):null;
    if(who.uid!=null && companions.has(who.uid))return companions.get(who.uid);
    return null;
  }
  function relocate(cell){
    if(!active||mapKey!==mapState.current||backgroundBattle()||!leader||!terrain.camera)return false;
    if(terrain.resolving||terrain.pending){if(!cell)blinkMap=mapKey;return false;}
    blinkMap=null;
    if(!cell){
      const candidates=board.floor.filter(([x,y])=>!board.obscured.has(x+','+y)&&Math.max(Math.abs(x-leader.x),Math.abs(y-leader.y))>=4);
      if(!candidates.length)return false;
      cell=candidates[Math.floor(Math.random()*candidates.length)];
    }
    clearMovement();leader=walker(...cell);rally={x:leader.x,y:leader.y};travel=null;
    terrain.focus=cell.slice();terrain.checkedAt=0;
    GiranGates.remember(terrain,leader);window.GiranHunt?.anchor(cell);
    return true;
  }
  function cancelOrders(){
    walkingCommand=false;destination=travel=trail=null;resumeAt=blockedAt=plannedAt=0;marker.hidden=true;
    for(const a of [leader,...allies.values(),...companions.values()])if(a){a.path=[];a.goalX=a.goalY=undefined;}
  }
  function mobRect(uid,part='box'){
    if(!fieldReady())return null;
    const actor=mobs.get(String(uid));if(!actor)return null;
    if(part==='heading'){
      const h=actor.head;
      if(!h||h.root.hidden)return null;
      return actions.screenRect(h.x-76,h.y-50,152,50);
    }
    const [x,y]=terrain.project(actor.fx,actor.fy);
    if(part==='body'){
      const h=actor.inkHeight||62;
      return actions.screenRect(x-h*.30,y-h,h*.6,h);
    }
    const g=actor.nativeAnchor,r=g?.[part];if(!r)return null;
    const scale=actor.inkHeight/g.height;
    return actions.screenRect(x+r[0]*scale,y+r[1]*scale,r[2]*scale,r[3]*scale);
  }
  const worldState={terrain,board,point,mobRect,screenRect:actions.screenRect,restoreCards,move:routeLeader,cancel:cancelOrders,relocate,followBoss,get followingBoss(){return trail;},ready:()=>active && mapKey===mapState.current && !!rosterHero && !!terrain.camera && terrain.kind!=='loading' && !terrain.resolving && !terrain.pending && (mapKey!=='afk_riftdg'||encounter(mapKey).signature===sceneId),
    walkTo,get commanded(){return walkingCommand&&!!destination;},hold:who=>!!destination && (who===player || player.allies?.includes(who)),get leader(){return leader;},get walkGoal(){return destination;},get map(){return mapKey;},get scene(){return sceneId;}};
  let travel=null,trail=null;
  const nativeGates=GiranGates.layer(field,(c,arrive)=>{routeLeader(c);travel={x:c[0],y:c[1],arrive};});
  function placeDoors(){
    const scripted=state.antharas||state.riftRun||state._afkFinal||window.__afkRiftDg?.run?.()||/^afk_|^pride_f/.test(mapKey);
    nativeGates(terrain,leader,!scripted);
    GiranGates.remember(terrain,leader);
    if(travel && destination && !leader.step && !leader.path.length && GiranGeometry.distance(leader,travel)<=1){
      const arrived=travel.arrive;travel=null;arrived();
    }
  }
  function followBoss(){
    if(!worldState.ready() || player.dead || document.body.classList.contains('giran-guest'))return false;
    cancelOrders();
    trail=GiranBossRooms.nearest(terrain,leader);
    return !!trail;
  }
  function engage(actor,target,reach,formation){
    if(!target)return false;
    actor.seated=null;
    const assigned=actor.attackSeat;
    if(formation&&assigned&&assigned.target===target&&assigned.x===target.x&&assigned.y===target.y&&
       assigned.formation===formation&&actor.x===assigned.gx&&actor.y===assigned.gy&&!actor.step&&
       !board.occupied(actor,actor.x,actor.y)&&GiranGeometry.canHit(terrain.world,actor,target,reach))return true;
    if((!formation||reach<=2) && GiranGeometry.canHit(terrain.world,actor,target,reach)){
      actor.path=[];actor.goalX=actor.x;actor.goalY=actor.y;return true;
    }
    if((actor.path.length||actor.step) && Number.isFinite(actor.goalX) &&
       GiranGeometry.canHit(terrain.world,{x:actor.goalX,y:actor.goalY,footprint:actor.footprint},target,reach))return true;
    const cell=GiranGeometry.chooseSeat(terrain.world,board,actor,target,reach,formation);
    if(cell){
      if(formation)actor.attackSeat={target,x:target.x,y:target.y,formation,gx:cell[0],gy:cell[1]};
      if(cell[0]===actor.x&&cell[1]===actor.y){actor.path=[];actor.goalX=actor.x;actor.goalY=actor.y;return true;}
      if(actor.seatRoute){actor.path=actor.seatRoute.path;actor.seatRoute=null;[actor.goalX,actor.goalY]=cell;}
      else [actor.goalX,actor.goalY]=route(actor,cell,terrain,board.blockers(actor));
      return true;
    }
    return false;
  }
  function pursueMember(who,actor,focus,mode,formation){
    const range=GiranCombat.reach(who,mode),within=GiranCombat.target(who,focus,mode);
    const strict=GiranRoam.manual()||focus.boss&&player.giranHunt?.bossFirst;
    const held=actor.otherOpponent;
    if(!within&&!strict&&held?.focus===focus&&previous<held.until&&live(held.mob)&&
       mapState.mobs.includes(held.mob)&&(!player.giranHunt||GiranHunt.allows(held.mob))&&
       engage(actor,point(held.mob),range,formation))return;
    actor.otherOpponent=null;
    if(engage(actor,point(within||focus),range,formation))return;
    actor.path=[];actor.goalX=actor.x;actor.goalY=actor.y;
    if(strict||actor.failedFocus===focus&&previous<actor.otherSearchAt)return;
    actor.failedFocus=focus;actor.otherSearchAt=previous+600;
    // Full rings and narrow approaches can leave a melee attacker without a square.
    // In automatic mode try the nearest living opponents on the same navigable floor.
    const options=[];
    for(const mob of mapState.mobs){
      if(!live(mob)||mob===within||mob===focus||player.giranHunt&&!GiranHunt.allows(mob))continue;
      const at=point(mob);if(at)options.push({mob,at,d:GiranGeometry.distance(actor,at)});
    }
    options.sort((a,b)=>a.d-b.d);
    // 11-27 Ping：只試最近的 5 隻。原本會把場上每一隻都試一遍，每試一隻就要找一次位子，場上 25 隻怪時一次要卡幾十毫秒。
    options.length=Math.min(options.length,5);
    for(const {mob,at} of options)if(engage(actor,at,range,formation)){
      actor.otherOpponent={focus,mob,until:previous+1400};return;
    }
  }
  function showSkill(who, skill, records, result, aimedAt) {
    if(!canShow()||!skill?.name)return;
    const aim=!records?.length && aimedAt && skill.plan?.ops.some(o=>['hit','mark','debuff','status'].includes(o.kind));
    actions.active(who,skill,aim?[{who:aimedAt,kind:'aim'}]:records,aim?{kind:'aim'}:{});
  }
  function updateMobs(seconds, plan) {
    const current = new Set();
    const byUid = new Map();
    const exterior=(x,y)=>GiranGates.outsideVillage(terrain,x,y);
    const roam=GiranRoam.owns();
    const spread=!roam&&mapState.mobs.length>5&&(GiranRoam.instanceSlots()||mapKey==='afk_riftdg'||mapKey==='afk_zodiac');
    let livingParty;
    for (const mob of mapState.mobs) if (mob) byUid.set(String(mob.uid), mob);
    Array.from(enemyList.children).forEach((card, slot) => {
      const uid = card.dataset.uid, mob = byUid.get(uid);
      if (!mob) return;

      current.add(uid);
      let offset=enemySlots[slot%enemySlots.length];
      const fixed=card.matches('.siege-fixed,.duel-fixed');
      if(fixed && card.style.left && card.style.top){
        offset=[(parseFloat(card.style.left)/100-.5)*terrain.width,(parseFloat(card.style.top)/100-.58)*terrain.height];
      }
      let actor = mobs.get(uid);
      const home=GiranBossRooms.home(terrain,mob);
      const guardVillage=!home&&(outdoorHunt||mob._giranSpawn);
      // Legacy spawns and residents returning from the pool can already have a sprite.
      // Recheck its feet when the placement or the loaded terrain changes.
      if(actor&&guardVillage&&(actor.spawnCell!==mob._giranSpawn?.cell||actor.checkedGround!==terrain.world.groundRevision)){
        if(!exterior(actor.x,actor.y)||actor.step&&!exterior(...actor.step)){
          removeHead(actor);board.members.delete(actor);mobs.delete(uid);mobHistory.delete(mob);actor=null;
        }
      }
      if (!actor) {
        if(home){
          if(GiranGeometry.distance(leader,home)<=15){
            const cell=GiranWorldBosses.seat(terrain,home,board);
            if(cell){actor=walker(...cell);board.members.add(actor);}
          }
        }else if(mob._giranSpawn){
          const tag=mob._giranSpawn;
          const [x,y]=tag.home&&!exterior(...tag.cell)?tag.home:tag.cell;
          const cell=GiranWorldBosses.seat(terrain,{x,y},board,exterior);
          if(cell){actor=walker(...cell);board.members.add(actor);}
        }else{
          const cell=spread&&!mob.boss&&GiranRoam.waveCell(worldState,slot);
          if(cell){actor=walker(...cell);board.members.add(actor);}
          else actor=board.spawn(destination?leader:rally,offset,guardVillage?exterior:undefined);
        }
        card.classList.toggle('dm-no-seat',!actor);
        if(!actor)return;
        mobs.set(uid,actor);
      }
      if(guardVillage){actor.spawnCell=mob._giranSpawn?.cell;actor.checkedGround=terrain.world.groundRevision;}
      // Melee can reach the outer edge of a large boss's three-tile-wide sprite.
      actor.footprint=mob.boss&&(mob.s==='L'||mob._afkFinal)?1:0;
      card.classList.toggle('dm-no-seat',false);actor.el=card;actor.seenAt=previous;mobHistory.set(mob,actor);
      if(home)GiranBossRooms.showEntrance(mob);
      if ((plan===true || nextMobs.has(mob)) && !fixed && !player.dead && live(mob)) {
        livingParty||=[leader,...GiranPartyView.combatAllies().filter(a=>a && !a._downed && a.curHp>0).map(point).filter(Boolean)];
        const nearest=livingParty.reduce((a,b)=>GiranGeometry.distance(actor,a)<=GiranGeometry.distance(actor,b)?a:b);
        const intent=home?GiranBossRooms.intent(home,mob,actor,nearest):GiranRoam.ai(mob,actor,nearest,previous,roam);
        // 11-27 Ping：怪擠不進去（對象周圍站滿、或被人牆擋住）時，原本每一輪規劃都重新找位子、重新尋路，8 人被一群怪圍住時最花時間。
        // 同一個對象、同一個位置剛找過而且失敗 → 半秒內不重找；對象一移動就立刻重找。
        if(intent==='engage'){
          if(!(actor.engageHold>previous&&actor.engageX===nearest.x&&actor.engageY===nearest.y)){
            const ok=engage(actor,nearest,GiranCombat.reach(mob,'basic'));
            actor.engageX=nearest.x;actor.engageY=nearest.y;actor.engageHold=ok?0:previous+500;
          }
        }
        else if(intent&&(!actor.path.length||actor.goalX!==intent[0]||actor.goalY!==intent[1])){
          if(!(actor.routeHold>previous&&actor.routeAimX===intent[0]&&actor.routeAimY===intent[1])){
            [actor.goalX,actor.goalY]=route(actor,intent,terrain,board.blockers(actor),false);
            actor.routeAimX=intent[0];actor.routeAimY=intent[1];
            actor.routeHold=actor.goalX===intent[0]&&actor.goalY===intent[1]?0:previous+500;
          }
        }
        GiranRoam.observe(mob,actor);
      }
      const blocked=(x,y)=>board.occupied(actor,x,y)||guardVillage&&!exterior(x,y);
      if(GiranPartyView.mobile()){
        const [x,y]=terrain.project(actor.fx,actor.fy),margin=Math.max(160,(actor.inkHeight||0)*2);
        const outside=x< -margin||x>terrain.width+margin||y< -margin||y>terrain.height+margin;
        card.classList.toggle('dm-off-camera',outside);
        if(outside){
          if(actor.hurtUntil>previous)actor.walking=false;
          else advance(actor,seconds,0.64,terrain,blocked);
          if(actor.head&&!actor.head.root.hidden)actor.head.root.hidden=true;
          return;
        }
      }else if(card.classList.contains('dm-off-camera'))card.classList.remove('dm-off-camera');
      alignFeet(actor,card,true,mob._giranArt||mob.n,mob.boss?'boss':'monster',terrain);
      // A hit briefly exposes the native hurt pose beneath the walking overlay.
      if(actor.hurtUntil>previous){actor.walking=false;finishStride(card,null,actor,true);}
      else{
        const steps=live(mob)?stride(actor,card,mob,'mob'):null;
        advance(actor,seconds,0.64,terrain,blocked);
        finishStride(card,steps,actor,true);
      }
      position(card,actor);
      positionHead(card,actor,mob);
    });
    for (const [id,actor] of mobs) if (!current.has(id)){removeHead(actor);mobs.delete(id);}
  }
  function giveCaptainRoom(){
    if(leader.step||!destination||!leader.path.length)return true;
    const directions=GiranGeometry.directions,heading=leader.path[0];
    const [dx,dy]=directions[heading],x=leader.x+dx,y=leader.y+dy;
    const blocker=[...allies.values(),...companions.values()].find(a=>a.x===x&&a.y===y||a.step?.[0]===x&&a.step?.[1]===y);
    if(!blocker)return true;
    if(blocker.step)return false;
    const occupied=board.blockers(blocker),next=directions[leader.path[1]]||[0,0];
    // Step off the captain's path on actual connected ground. No one crosses the
    // obstacle or moves to another tile until their walking step has completed.
    for(const turn of [2,6,1,7,3,5,0,4]){
      const h=(heading+turn)%8,[sx,sy]=directions[h],nx=x+sx,ny=y+sy;
      if(nx===x+next[0]&&ny===y+next[1]||occupied(nx,ny))continue;
      if(!terrain.world.canStep(x,y,h,occupied)||!terrain.world.canStep(nx,ny,(h+4)%8))continue;
      blocker.path=[h];blocker.goalX=nx;blocker.goalY=ny;blocker.yielding=true;return false;
    }
    if(!blockedAt)blockedAt=previous;
    if(previous-blockedAt>650){leader.path=[];blockedAt=previous;}
    return false;
  }
  function moveMember(el,actor,who,kind,seconds) {
    const strideSeconds=(kind==='hero'?0.47:0.50)/(1+(who.d?.moveSpeedPct||0)/100);
    if (!el) {
      advance(actor,seconds,strideSeconds,terrain,(x,y)=>board.occupied(actor,x,y));
      return;
    }
    alignFeet(actor,el,false,battleForm(who,kind==='ally')?.domKey,'character',terrain);
    const moving=!!actor.step || actor.path.length>0;
    if(!moving&&actions.pose(el,who,kind,previous)){actor.walking=false;return;}
    if(kind==='hero'&&!giveCaptainRoom()){actor.walking=false;finishStride(el,null,actor);return;}
    const steps=stride(actor,el,who,kind);
    advance(actor,seconds,strideSeconds,terrain,(x,y)=>board.occupied(actor,x,y));
    if (!moving || !actions.pose(el,who,kind,previous)) finishStride(el,steps,actor);
  }
  function updateParty(seconds, plan, now, deployed) {
    const mob = mapState.mobs[mapState.targetIdx], target = live(mob) && mobs.get(String(mob.uid));
    if(target && destination && !walkingCommand && !travel && !trail)cancelOrders();
    if (leader.step) blockedAt=0;
    if (destination && !leader.path.length && !leader.step &&
        (leader.x!==destination[0] || leader.y!==destination[1])) {
      // A moving ally can occupy the next tile after the original click.
      if(!blockedAt)blockedAt=now;
      if(plan)routeLeader(destination,true);
    }
    if (destination && !leader.step && leader.x===destination[0] && leader.y===destination[1]) {
      if (!resumeAt) {rally={x:leader.x,y:leader.y};resumeAt=trail?now:now+500;}
      if (now >= resumeAt) { destination = null; resumeAt = blockedAt = 0; }
    }
    const hero = document.getElementById('player-morph-sprite');
    if (!player.dead && player.hp > 0) {
      if (plan && !destination && target) {
        engage(leader,target,GiranCombat.reach(player,'basic'));
      }
      if(plan && !destination && !leader.step && !leader.path.length && (!target || trail)){
        const home=trail||(!GiranRoam.manual() && (!player.giranHunt||GiranBossRooms.room(terrain.key)?.encounter) && GiranBossRooms.nearest(terrain,leader));
        const next=home && GiranBossRooms.nextStep(terrain,leader,home);
        if(next)routeLeader(next,false,true);
        else if(home)trail=null;
        else if(!target)GiranRoam.patrol(worldState,now);
      }
      moveMember(hero,leader,player,'hero',seconds);
    } else { leader.path = []; leader.walking = false; destination = null; actions.pose(hero,player,'hero',now);finishStride(hero,null,leader); }
    if (hero) position(hero,leader);
    const headHeight=(leader.inkHeight||67)*(leader.nativeAnchor?.headRatio??1);
    GiranFieldUI.mark(field,terrain,leader,headHeight,!!hero && hero.style.visibility!=='hidden');
    const seen = new Set();
    let back=0,front=0;
    deployed.forEach((ally,i) => {
      if (!ally) return;
      const id = String(ally._slot);
      seen.add(id);
      const support=ranged(ally);
      const offset=partySlots[i%partySlots.length];
      const combat=support?rangedSlots[back++%rangedSlots.length]:meleeSlots[front++%meleeSlots.length];
      let actor = allies.get(id);
      const visual=GiranPartyView.shows(ally) && typeof _allySpriteStates!=='undefined' && _allySpriteStates[id];
      if(!actor){
        actor=board.spawn(leader,offset);visual?.el?.classList.toggle('dm-no-seat',!actor);
        if(!actor)return;
        allies.set(id,actor);
      }
      visual?.el?.classList.toggle('dm-no-seat',false);
      if (!ally._downed && ally.curHp > 0) {
        if (plan===true || nextParty.has(ally)) {
          if(actor.yielding){if(!actor.step&&!actor.path.length)actor.yielding=false;}
          else if (target && !destination) {
            pursueMember(ally,actor,mob,allyFieldAttackMode(ally),combat);
          } else approach(actor,leader,offset);
        }
        moveMember(visual?.el,actor,ally,'ally',seconds);
      } else { actor.walking=false;actions.pose(visual?.el,ally,'ally',now); finishStride(visual?.el,null,actor); }
      if (visual?.el) position(visual.el,actor);
    });
    for (const id of allies.keys()) if (!seen.has(id)) allies.delete(id);
    marker.hidden = !destination;
    if (destination) {
      const [x,y] = terrain.project(...destination);
      marker.style.left = Math.round(x)+'px'; marker.style.top = Math.round(y)+'px';
    }
  }
  function updateCompanions(seconds, plan) {
    const companionRoster=_petFieldRoster();
    if(!companionRoster.length && !companions.size)return;
    const nodes=new Map(Array.from(field.querySelectorAll('#pet-layer [data-pet]'),el=>[el.dataset.pet,el]));
    const seen=new Set();
    for(const [i,p] of companionRoster.entries()){
      const el=nodes.get(String(p.uid));
      const offset=companionSlots[i%companionSlots.length];
      let actor=companions.get(p.uid);
      if(!actor){
        actor=board.spawn(leader,offset);
        if(!actor){el?.classList.remove('dm-grounded');continue;}
        companions.set(p.uid,actor);
      }
      seen.add(p.uid);
      const target=!destination && mapState.mobs[mapState.targetIdx];
      if(actor.yielding&&!actor.step&&!actor.path.length)actor.yielding=false;
      if(plan && !actor.yielding && !p._downed){if(live(target))pursueMember(p,actor,target,'basic');else approach(actor,leader,offset);}
      const dir=actor.step?actor.heading:actor.path[0];
      if(plan||actor.movePercent==null)actor.movePercent=window.LineageClassCombat?.value(p,'move')||0;
      const form=p.formGfx||p.form;
      if(dir!==undefined && !actor.step)actor.heading=dir;
      const anim=typeof _pet8Cache!=='undefined' && _pet8Cache[form+'#'+actor.heading];
      const pose=el&&!p._downed&&!p._animAct&&!anim?.walk?.length?stride(actor,el,p,'pet'):null;
      if(!p._downed)advance(actor,seconds,.48/(1+actor.movePercent/100),terrain,(x,y)=>board.occupied(actor,x,y));
      else actor.walking=false;
      if(!el)continue;
      finishStride(el,pose,actor);
      alignFeet(actor,el,false,form,'pet',terrain);position(el,actor);
      el.classList.toggle('dm-grounded',true);
    }
    for(const id of companions.keys())if(!seen.has(id))companions.delete(id);
  }
  // 11-27 Ping：量測點。只有帶測試口令的裝置會記錄（一般玩家進不了自由走動，也不會跑到這裡）；結果放在 window.GiranProbe，用來找每一幀花最多時間的段落。
  const probe = (() => {
    let on = false;
    try { on = !!localStorage.getItem('giran.tester.v1'); } catch {}
    if (!on) return null;
    const totals = {}, state = {frames:0, totals, last:0, reset(){ for (const k in totals) delete totals[k]; state.frames = 0; }};
    state.begin = () => { state.last = performance.now(); state.frames++; };
    state.mark = name => { const t = performance.now(); totals[name] = (totals[name] || 0) + t - state.last; state.last = t; };
    window.GiranProbe = state;
    return state;
  })();
  function frame(now) {
    request = 0;
    if (!active || suspended) return;
    // 11-27 Ping：電腦版地圖畫面原本固定約 30 幀，改成跟著螢幕更新（60 幀螢幕就是 60 幀）；手機維持約 30 幀省電
    if (now-previous < (GiranPartyView.mobile()?31:15)) { request=requestAnimationFrame(frame); return; }
    const seconds = previous ? Math.min(.30,(now-previous)/1000) : 0;
    previous = now;
    try {
      if (backgroundBattle()) {
    
        if(!paused){pausedAt=now;paused=true;}
        if(pausedAt>=0 && (now-pausedAt>300 || state.running===false || document.hidden)) {
          actions.reset();pausedAt=-1;
        }
        request=requestAnimationFrame(frame);return;
      }
      if (paused) {
        paused = false;
        plannedAt = 0;
      }
      const current=encounter(mapState.current);
      if (mapKey!==mapState.current || sceneId!==current.signature) {
        selectScene(current);
      }

      {


        const width=fieldWidth || field.clientWidth,height=fieldHeight || field.clientHeight;
        if(!width||!height){request=requestAnimationFrame(frame);return;}
        const resized=terrain.width!==width || terrain.height!==height;
        probe?.begin();
        window.GiranGpu?.begin(field,terrain.camera);
        terrain.prepare(width,height,now);
        if(terrain.kind==='loading'||terrain.pending||terrain.resolving){GiranFieldUI.update(terrain);request=requestAnimationFrame(frame);return;}
        if (renderedRevision !== terrain.revision) { clearMovement(); renderedRevision = terrain.revision; }
        terrain.draw(leader,width,height,now);
        probe?.mark('地形');
        if(resized)plannedAt=0;
        if(field.dataset.dmMap!==mapKey)field.dataset.dmMap=mapKey;
        if(field.dataset.dmScene!==sceneId)field.dataset.dmScene=sceneId;
        if(field.dataset.dmTerrain!==terrain.kind)field.dataset.dmTerrain=terrain.kind;
        if (!field.classList.contains('dm-map')) {field.classList.add('dm-map');document.body.classList.add('dm-viewing');}
        rosterHero=player;

        const uid = mapState.mobs[mapState.targetIdx]?.uid;
        const plan = now >= plannedAt || cachedTarget !== uid;
        if (plan) { plannedAt=now+320; cachedTarget=uid; }
        board.begin([leader,...allies.values(),...mobs.values(),...companions.values()],leader,plan);
        if(blinkMap===mapKey&&!terrain.resolving&&!terrain.pending){relocate();board.begin([leader],leader,true);}
        probe?.mark('站位表');
        batchWorldRender(GiranRoam.update,worldState,now);
        probe?.mark('走動決策');
        const deployed=GiranPartyView.combatAllies();
        const spaced=mobileQuery.matches && deployed.length>=5;
        const crowd=mobs.size>=16;
        if(spaced){
          // Rotate route decisions across frames. All positions, impacts, and animations still advance every draw.
          const enemies=mapState.mobs.filter(live);
          const count=Math.max(2,Math.ceil(deployed.length/4));
          const enemyCount=Math.max(2,Math.ceil(enemies.length/4));
          nextParty=planSlice(deployed,partyPlan,count);nextMobs=planSlice(enemies,mobPlan,enemyCount);
          partyPlan=(partyPlan+count)%deployed.length;mobPlan=(mobPlan+enemyCount)%Math.max(1,enemies.length);
        }else{
          nextParty.clear();nextMobs.clear();
          if(crowd&&now>=mobPlanAt){
            const enemies=mapState.mobs.filter(live),count=Math.ceil(enemies.length/4);
            nextMobs=planSlice(enemies,mobPlan,count);
            mobPlan=(mobPlan+count)%Math.max(1,enemies.length);mobPlanAt=now+75;
          }
        }
        probe?.mark('分批規劃');
        updateMobs(seconds,spaced||crowd?false:plan);
        probe?.mark('怪物');
        if(heads.hidden)heads.hidden=false;
        updateParty(seconds,spaced?(plan?'captain':false):plan,now,deployed);
        probe?.mark('隊伍');
        updateCompanions(seconds,plan);
        probe?.mark('寵物召喚');
        terrain.endCovers();
        probe?.mark('遮蔽');
        placeDoors();
        probe?.mark('傳送門');
        batchWorldRender(GiranCombat.update,now);
        probe?.mark('戰鬥同步');
        actions.frame(now,terrain.width,terrain.height);
        probe?.mark('動作特效');
        window.GiranGpu?.frame(field,terrain.camera);
        probe?.mark('GPU繪製');
        GiranFieldUI.update(terrain);
        probe?.mark('介面');
        serviceForegroundClock();
      }
    } catch (error) {
      window.GiranDiagnostics?.record('field', error.message);
      if(!field.dataset.worldError){ console.error('地圖更新失敗',error); field.dataset.worldError=error.message; }
    }
    request = requestAnimationFrame(frame);
  }
  const observer = new MutationObserver(sync);
  for (const node of [field, game, document.getElementById('town-view')].filter(Boolean)) {
    observer.observe(node,{attributes:true,attributeFilter:['class']});
  }
  // The field also changes class during normal renders. Avoid writing our own class twice.
  mobileQuery.addEventListener('change',sync);
  window.addEventListener('resize',sync);
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('pagehide',event=>event.persisted?suspend():stop());
  window.addEventListener('pageshow',sync);
  sync();
}

})();
