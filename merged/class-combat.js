(function(W){
 'use strict';
 const C=W.LineageClassCore,R=W.AFK_RELIC_RUNTIME,states=new WeakMap(),mobStates=new WeakMap(),seen=new WeakMap(),passes=new WeakMap();
 const N=x=>Number(x)||0,now=()=>N(state.ticks)/10,P=()=>player;
 const hp=x=>N(x===player?x.hp:x.curHp==null?x.hp:x.curHp),hpKey=x=>x===player||x.curHp==null?'hp':'curHp';
 const maxhp=x=>x.cls?N(x.mhp)||1:W.AFK_RELIC_COMPANIONS?.maxHp(x)||N(x.mhp||x.maxHp||x.hp)||1;
 const live=x=>!!(x&&!x.dead&&!x._downed&&!x._dead&&hp(x)>0);
 function st(p){let s=states.get(p);if(!s){s={buffs:{},marks:new WeakMap(),cd:{},resources:{corpse:0},delayed:[],dots:[],damageLog:[],shieldLog:[],elementHistory:new Set(),lastAuto:-10,baseline:1};states.set(p,s);}return s;}
 function ms(m){if(!m)return {born:now(),debuffs:{},breaches:{}};let s=mobStates.get(m);if(!s){s={born:now(),debuffs:{},breaches:{}};mobStates.set(m,s);}return s;}
 function enemies(){return (mapState.mobs||[]).filter(live);}
 function castMode(s){return s?.plan.channel==='melee'?'basic':s?.plan.channel==='ranged'?'ranged':'magic';}
 function primaryEnemy(p){
  if(!W.GiranCombat?.inWorld())return enemies()[0];
  const aim=getTarget();
  return p===player?aim:W.GiranCombat.target(p,aim,'magic');
 }
 function nearbyEnemies(p,s){const l=enemies().filter(m=>!W.GiranCombat||W.GiranCombat.onTerrain(p,m,castMode(s)));return W.giranArea?W.giranArea(p,l,castMode(s)):l;}   // 11-27：自由走動只波及主目標周圍
 const needsEnemy=new Set(['hit','dot','breach','status','mark','debuff','retaliate','detonate','assist']);
 function companions(p){return [...new Set(R.api.pets(p).concat(R.api.summons(p),p===player?(typeof guardAliveList==='function'?guardAliveList():player.guards||[]):[]))].filter(live);}
 function members(){const head=W.GiranPartyEffects?.leaderOf(player)||player;return [head].concat(GiranPartyView.combatAllies(head)).filter(live);}
 function team(){return [...new Set(members().flatMap(p=>[p,...companions(p)]))].filter(live);}
 function targets(p,o,selected){let xs=o.target==='self'||!o.target?[p]:o.target==='companions'?companions(p):o.target==='selfCompanions'?[p,...companions(p)]:o.target==='allies'?team().filter(t=>t!==p):team();if(selected&&xs.includes(selected))xs=[selected,...xs.filter(x=>x!==selected)];else xs=xs.slice().sort((a,b)=>hp(a)/maxhp(a)-hp(b)/maxhp(b));if(o.target==='selfTeam'||o.target==='selfCompanions')xs=[p,...xs.filter(t=>t!==p)];return xs.slice(0,o.count||1);}
 function buffs(p){return Object.values(st(p).buffs).filter(b=>b.until>now());}
 function put(p,key,value,seconds,source,charges,extra={}){st(p).buffs[source+':'+key]={key,value,until:now()+seconds,charges,...extra};mapRecipient(p,'buff',source);}
 function spendCharged(p,key){let changed=false;for(const b of buffs(p))if(b.key===key&&b.charges>0){if(--b.charges===0)b.until=0;changed=true;}if(changed&&key==='critDamage')R.recalc(p);}
 function hitBonus(p,t,probe,kind){const ctx={kind:kind||(W.GiranCombat?.usesBow(p)?'ranged':'melee')};return (W.LineageSherine?.hitBonus(p)||0)+value(p,'hit',t,ctx)-value(p,'hit',null,ctx)+(probe?value(p,'nextHit',t):consume(p,'nextHit'));}
 function consume(p,key){let best=0;for(const b of buffs(p))if(b.key===key){best=Math.max(best,b.value);if(b.charges>1)b.charges--;else b.until=0;}return best;}
 function passive(p){const v=p.classPath;if(!v||!C.valid(p))return [];let a=passes.get(v);if(!a||a.stage!==v.stage){a={stage:v.stage,ops:C.tree(p).skills.filter(s=>s.type==='被動'&&s.stage<=v.stage).flatMap(s=>s.plan.ops.map(o=>({...o,source:s.id})))};passes.set(v,a);}return a.ops;}
 function condition(p,o,t){return !o.condition||o.condition==='low'&&hp(p)<maxhp(p)*.35||o.condition==='shield'&&p.eq?.shield||o.condition==='masterShield'&&p.eq?.shield&&W.__afkArts?.art(p)==='w_arms'||o.condition==='marked'&&mark(p,t).mark>now()||o.condition==='poison'&&(N(t?.st?.poison)>0||resource(p,t,'poison'));}
 function activeAuras(owner){const state=states.get(owner);return live(owner)&&state?(state.activeAuras||[]).filter(s=>N(state.cd['upkeep:'+s.id])>now()):[];}
 function acceptsAura(p,o){return (!o.companionsOnly||!p.cls)&&(!o.summonsOnly||!!p.skId);}
 function aura(p,key,target,ctx){let value=0;for(const owner of members()){const a=st(owner).activeAuras||[];if(!live(owner))continue;for(const s of a){if(N(st(owner).cd['upkeep:'+s.id])<=now())continue;for(const o of s.plan.ops)if(acceptsAura(p,o)&&condition(owner,o,target)&&filter(o,ctx)&&(o.key===key||(o.key==='companionDamage'&&key==='damage'&&!p.cls)))value=Math.max(value,o.value);}}return value;}
 function filter(o,c){if(!o.filter)return true;if(!c)return false;
  const elemental=['fire','wind','earth','water'].includes(c.element);
  if(o.filter==='element')return elemental;
  if(o.filter==='rangedElement')return c.kind==='ranged'||elemental;
  if(o.filter==='single')return c.normalAttack&&!c.aoe;
  if(o.filter==='heavy')return !!c.heavy;
  return o.filter===c.kind;} function value(p,key,target,ctx){let n=0;for(const o of passive(p))if(o.kind==='passive'&&o.key===key&&condition(p,o,target))n+=o.value;let timed=0,negative=0;for(const b of buffs(p))if(b.key===key&&condition(p,b,target)&&filter(b,ctx)){timed=Math.max(timed,b.value);negative=Math.min(negative,b.value);}return n+negative+Math.max(timed,aura(p,key,target,ctx));}
 // 11-28 Ping：印記改用 WeakMap。原本的 Map 把每一隻查過的怪都留著，打死也不放（4 人掛機 4 小時累積 3.5 萬隻、約 230MB）
 function mark(p,t){const s=st(p);if(!t)return {};const store=typeof t==='object'||typeof t==='function'?s.marks:(s.idMarks||=new Map());let m=store.get(t);if(!m){m={stack:0,mark:0,casts:new Set(),last:0};store.set(t,m);}if(now()-m.last>12){m.stack=0;m.casts.clear();}return m;}
 function putMark(p,t,sec,stack){if(!live(t))return;const m=mark(p,t);m.mark=now()+sec+value(p,'markDuration');m.last=now();if(stack)m.stack=Math.min(3,N(m.stack)+1);mapRecipient(t,'mark');}
 function usable(p,id){return !!(live(p)&&!p.classicMode&&C.valid(p)&&C.canUse(p,id));}
 function cooldown(p,s){const cds=p.classPath?.cooldowns||{},key=s.type==='大絕'?'ult':s.type==='龍魔法'?'dragon:'+s.id:s.id;return Math.max(0,(N(cds[key])-Date.now())/1000,s.type==='龍魔法'?(N(cds.dragonGlobal)-Date.now())/1000:0);}
 function cost(p,s){let mp=s.plan.mp*N(p.mmp);mp*=1-Math.min(.6,value(p,'cost'));if(s.type==='法術'&&W.LineageSherine)mp*=W.LineageSherine.costMultiplier(p);const t=C.tree(p);if(t?.tradeoff&&/成本\+15%/.test(t.tradeoff))mp*=1.15;return {mp:Math.ceil(mp),hp:Math.ceil(s.plan.hp*maxhp(p))};}
 function controls(p){const z=p.statuses||p.st||{};return ['stun','freeze','stone','sleep','paralysis','paralyze','silence','magicseal'].some(k=>z[k]>0&&!(k==='silence'&&W.LineageSherine?.ignoreSilence(p)))||p._timeSealed||p._afkLockUntil>state.ticks;}
 function resource(p,t,key){const a=st(p),m=mark(p,t);if(key==='silenced')return (p.statuses?.magicseal||p.statuses?.silence||0)>0?1:0;if(key==='elements')return a.elementHistory.size;if(key==='distinct')return m.casts.size;if(key==='absorbed')return a.absorbed>0?1:0;if(key==='corpse')return a.resources.corpse;if(key==='stack')return now()-m.last<=12?m.stack:0;if(key==='mark')return m.mark>now()?1:0;if(key==='poison')return a.dots.some(x=>x.target===t&&x.poison&&x.until>now())?1:0;const z=(key==='dual'||key==='third')?m[key]:a.resources[key];return z&&z.until>now()&&!z.used?1:0;}
 function spendResource(p,t,o){const a=st(p),m=mark(p,t);if(!o.consume)return;if(o.key==='stack')for(const x of passive(p))if(x.kind==='spendHeal'&&N(a.cd[x.source])<=now()){a.cd[x.source]=now()+x.cd;heal(p,p,maxhp(p)*x.ratio,{id:x.source});}if(o.key==='silenced')return;else if(o.key==='elements')a.elementHistory.clear();else if(o.key==='distinct')m.casts.clear();else if(o.key==='corpse')a.resources.corpse-=o.amount||1;else if(o.key==='stack')m.stack-=o.amount||1;else if(o.key==='mark')m.mark=0;else if(o.key==='poison')a.dots=a.dots.filter(x=>x.target!==t||!x.poison);else{const z=o.key==='dual'||o.key==='third'?m[o.key]:a.resources[o.key];if(z)z.used=true;}}
 function absoluteLock(p){return !!(p._timeSealed||p._afkLockUntil>state.ticks||p===player&&typeof inAbsBarrier==='function'&&inAbsBarrier());} function reason(p,s,t){if(t && s?.plan?.ops?.some(o=>needsEnemy.has(o.kind)) && W.GiranCombat && !W.GiranCombat.permits(p,t,castMode(s)))return '目標超出施法距離或視線';if(!s||!usable(p,s.id))return '尚未開放此流派技能';if(s.type==='被動')return '被動自動生效';if(absoluteLock(p)||controls(p)&&!s.plan.allowControl)return '目前無法施法';if(st(p).casting)return '正在蓄力';if(cooldown(p,s)>.01)return '技能冷卻中';const c=cost(p,s);if(N(p.mp)<c.mp)return '魔力不足';if(hp(p)<=c.hp)return '生命不足，不能以護盾支付血費';for(const o of s.plan.ops){if(needsEnemy.has(o.kind)&&!live(t))return '目前沒有目標';if(o.kind==='require'&&resource(p,t,o.key)<(o.amount||1))return '尚未完成前置：'+({dual:'法術一與五連接',third:'法術八',stack:'自身三層印記',mark:'自身印記',poison:'目標身上由自己施加的中毒',corpse:'屍骸',dodge:'成功迴避',hurt:'實際受擊',shieldBroken:'護盾被擊破'}[o.key]||o.key);if(o.target==='companions'&&!companions(p).length||o.kind==='assist'&&!companions(p).length)return '沒有可支援的現有同伴';if(o.kind==='sacrifice'&&!companions(p).some(x=>x.skId==='sk_zombie'||x._necroOwnerKey))return '需要一名現有亡靈';if(o.kind==='shareShield'&&!team().some(x=>x!==p))return '沒有可分配護盾的隊友';if(o.kind==='redirect'&&!team().some(x=>x!==p))return '沒有可連結的隊友';if(o.kind==='consumeShield'&&!shieldAmount(p,true))return '沒有可消耗的自身護盾';}return '';}
 function shieldAmount(p,own=false){return Object.entries(R.state(p,'_shields')).filter(([k,s])=>s.until>now()&&(!own||k.startsWith('class:'))).reduce((n,[k,s])=>n+N(s.amount),0);}
 function cleanse(p,n,allowed){const z=p.statuses||p.st||{};let count=0;for(const k of ['stun','freeze','stone','sleep','paralysis','paralyze','blind','fear','magicseal','silence','slowAtk','slow','weaken','disease','confuse','poison','bind','curse','mrhalf'])if((!allowed||allowed.includes(k)||k==='silence'&&allowed.includes('magicseal'))&&z[k]>0){z[k]=0;if(++count>=n)break;}return count;}
 function baseline(p){const d=st(p).baseStats||p.d||{},w=DB.items[p.eq?.wpn?.id]||{};const kind=C.tree(p)?.channel||'melee';let n;if(kind==='magic'){const sk=DB.skills.sk_lightarrow||DB.skills.sk_light;const dice=sk?.dmgDice;const avg=Array.isArray(dice)?N(dice[0])*(N(dice[1])+1)/2:20;n=magicBaseDamage(avg,d,0,true)*magicDamageCoef(d,0,1)/Math.max(.5,N(sk?.cd)||2);}else n=((N(w.dmgS)+1)/2+N(d[kind+'Dmg']))*(typeof wpnEnFinalMult==='function'?wpnEnFinalMult(p.eq?.wpn):1)/Math.max(.25,N(d.aspd)||1);return Math.max(1,Math.floor(n));}
 function hitChance(p,t,kind){if(kind==='magic')return true;const d=p.d||{},bonus=N(d[kind+'Hit'])+N(d.extraHit)+hitBonus(p,t,false),ac=typeof mobEffAC==='function'?mobEffAC(t):N(t.ac);let h=stretchHitValue(N(p.lv)+bonus-N(t.lv)+ac);h=Math.max(h,physicalHitSoftFloor(bonus,t));const rollHit=1+Math.floor(Math.random()*20);return rollHit===20||rollHit!==1&&rollHit<=Math.min(20,h);}
 function damage(p,t,amount,s,options={}){if(!live(t)||!live(p))return 0;const kind=options.kind||s.plan.channel;
  if(!options.dot&&!hitChance(p,t,kind)){if(typeof vfxMiss==='function')vfxMiss(t);return 0;}
  if(kind==='magic')amount*=mrMult(N(t.mr)*(1-(options.pierceMr||0)));else amount=Math.max(0,amount-(N(t.dr)+(typeof mobHardSkin==='function'?mobHardSkin(t):0))*(1-(options.pierceAc||0)));
  const ele=options.element||(/火|炎/.test(s.name)?'fire':/水|冰|霜/.test(s.name)?'water':/風|雷/.test(s.name)?'wind':/地|土/.test(s.name)?'earth':'none');
  if(kind==='magic'&&typeof elementCounterMult==='function')amount*=elementCounterMult(ele,t.e);
  amount*=1+vulnOf(options.attacker||p,t,{kind,element:ele});
  amount=W.LineageGrowth.absolute(p,t,amount,kind);if(!(amount>0))return 0;
  if(!options.dot&&W.LineageSherine&&!s.id.startsWith('sherine-')){const ctx={actor:p,target:t,damage:amount,kind,skillId:s.id,origin:'normal',direct:true};W.LineageSherine.event('beforeSkill',ctx);amount=ctx.damage;}
  const actual=R.api.damage(t,amount,{actor:p,source:s.id,type:options.dot?'dot':kind,element:ele,origin:'class',generated:true,direct:!options.dot,cardInherited:true,reflect:!options.dot,settle:true,dotKind:options.poison?'poison':undefined,budgeted:false});
  if(actual>0){mapRecipient(t,'hit',s.id);burstAdd(p,t,actual);const lr=s.plan?.v3ult||options.dot?0:leechRate(p);if(lr>0)R.api.heal(p,actual*lr,{owner:p,source:'class-leech3',prepaid:true});if(typeof threatHeal==='function'&&false)threatHeal(p,actual);if(typeof _threatAdd==='function')_threatAdd(t,threatKey(p),actual*computeThreatMult(p));if(typeof vfxText==='function')vfxText(t,String(Math.floor(actual)),kind==='magic'?'#92bcf5':'#e2c588');}
  return actual;
 }
 function heal(p,t,amount,s){if(!live(t))return 0;const gained=R.api.heal(t,amount*(1+value(p,'healing')),{owner:p,source:s.id,prepaid:true});if(gained>0)mapRecipient(t,'heal',s.id);return gained;}
 function shield(p,t,amount,s,seconds){if(!live(t))return;const added=R.api.shield(t,amount*(1+value(p,'shield')),{owner:p,source:'class:'+s.id,cap:maxhp(p)*1.2,duration:seconds,classOnlyDirect:true,classSingle:/普通單體/.test(s.description||'')});if(added>0)mapRecipient(t,'guard',s.id);}
 // ── 大絕、龍語絕技第三版（docs/ultimate-redesign.md「零之二」的疊加規則都在這一段）──
 const VIRTUAL=new Set(['vulnerability','physVuln','magicVuln','eleVuln','eleRes','critVuln','comboVuln','petVuln','guardVuln','allyVuln','rangedVuln','weakVuln','lowHpVuln','debuffedVuln','lightVuln','dotVuln','bleedVuln','bloodVuln','healSteal','eleRes_fire','eleRes_water','eleRes_wind','eleRes_earth','atkDown']);
 const ELE4={fire:1,water:1,wind:1,earth:1};
 const isGuard=x=>!!(x&&typeof player!=='undefined'&&(player.guardsV2||[]).includes(x));
 const guardsOf=p=>p===player?(player.guardsV2||[]).filter(live):[];
 const weakMax=()=>typeof weakExposeMaxLayers==='function'?weakExposeMaxLayers():3;
 function dv(t,key){if(!t)return 0;let n=0;for(const d of Object.values(ms(t).debuffs))if(d.key===key&&d.until>now())n+=d.value;return n;}
 function poisoned(t){if(!t)return false;const z=t.st||{};if(N(z.poison)>0||N(z.venom)>0||N(z.deadlyPoison)>0)return true;for(const m of members())if(st(m).dots.some(x=>x.target===t&&x.poison&&x.until>now()))return true;return false;}
 // 敵人受到的傷害 +%：大絕來源先相加，合計最多 +300%（B5）
 function vulnOf(attacker,t,ctx={}){if(!t)return 0;const k=ctx.kind;let n=dv(t,'vulnerability')+dv(t,'bloodVuln');
  if(k==='melee'||k==='ranged'||k==='phys')n+=dv(t,'physVuln');if(k==='magic')n+=dv(t,'magicVuln');
  const e=ctx.element;if(e&&e!=='none'){n+=dv(t,'eleVuln')+dv(t,'eleRes')/1000+(ELE4[e]?dv(t,'eleRes_'+e)/1000+(t._afkMagicRift?.1:0):0);if(e==='light')n+=dv(t,'lightVuln');}
  if(ctx.crit)n+=dv(t,'critVuln');if(ctx.extra)n+=dv(t,'comboVuln');if(k==='ranged')n+=dv(t,'rangedVuln');
  if(attacker&&!attacker.cls){n+=dv(t,'petVuln');if(isGuard(attacker))n+=dv(t,'guardVuln');}
  if(attacker&&attacker!==player)n+=dv(t,'allyVuln');
  if(N(t.weakExpose)>0)n+=dv(t,'weakVuln');if(hp(t)<maxhp(t)*.5)n+=dv(t,'lowHpVuln');
  const z=t.st||{};if(dv(t,'debuffedVuln')&&Object.keys(z).some(x=>N(z[x])>0&&!/Dmg|Tick|Stacks|Cd/.test(x)))n+=dv(t,'debuffedVuln');
  return Math.min(3,n);}
 function ultMult(p,t,kind){let m=value(p,'damage2')+value(p,'damage3');if(kind==='ranged')m+=value(p,'rangedDamage');if(t&&N(t.weakExpose)>0)m+=value(p,'weakDamage')+value(p,'weakDamage2');const ls=value(p,'lowHpScale');if(ls)m+=ls*Math.floor((1-hp(p)/maxhp(p))*10);return m;}
 function leechRate(p){return Math.min(1,value(p,'leech')+value(p,'leech2')+value(p,'leech3'));}   // 吸血合計最多 100%（B6）
 function burstAdd(p,t,n){const b=ms(t).burst;if(b&&b.owner===p&&b.until>now())b.acc+=n;}
 // 追加攻擊：追加出來的還能再觸發，同一下最多往下追 3 層（Ping 21:49）
 function extraHits(p,t,base,depth,c){if(depth>=3||!live(t)||!(base>0))return;const list=[];const add=r=>{if(r>0)list.push(r);};
  add(value(p,'extraHit'));add(value(p,'extraHit2'));add(value(p,'cloneHit'));
  if(Math.random()<value(p,'procExtra'))add(1);if(Math.random()<value(p,'procExtra2'))add(1);if(depth===0&&consume(p,'comboNext'))add(1);
  for(const r of list){if(!live(t))break;const n=R.api.damage(t,base*r*(1+vulnOf(p,t,{kind:c.kind,element:c.element,extra:true})),{actor:p,source:'class-extra',type:c.kind==='magic'?'magic':c.kind==='ranged'?'ranged':'physical',origin:'class',generated:true,direct:false,settle:true,noProc:true,reflect:false});
   if(n>0){burstAdd(p,t,n);if(!state.ff&&typeof vfxText==='function')vfxText(t,String(Math.floor(n)),'#c4b5fd');extraHits(p,t,n,depth+1,c);}}}
 function allNeg(t,list,seconds,strength,bossToo,actor){let n=0;for(const k of list){if(t.boss&&!bossToo)continue;if(R.api.status(t,k,seconds,strength)!==false)n++;}return n;}
 function revive(p,ratio){let n=0;const pool=[].concat(p===player?(GiranPartyView.combatAllies()):[],R.api.pets(p)||[],R.api.summons(p)||[],p===player?(player.guardsV2||[]):[]);
  for(const x of pool){if(!x)continue;const mh=maxhp(x);if(x._downed||x.dead||hp(x)<=0){x._downed=false;x.dead=false;x._dead=false;x[hpKey(x)]=Math.max(1,Math.floor(mh*ratio));n++;}else if(x._afkImmortal||hp(x)<=1){x[hpKey(x)]=Math.min(mh,hp(x)+Math.floor(mh*ratio));n++;}}return n;}   // B13：不會死的寵物改成回血
 function payCost(p,o,s){const H=maxhp(p);let paid=0;const who=o.who==='team'?members():o.who==='highest'?[members().slice().sort((x,y)=>hp(y)-hp(x))[0]].filter(Boolean):[p];
  for(const m of who){let n=Math.floor(maxhp(m)*o.ratio);if(o.costHalf&&m===p)n=Math.floor(n/2);n=Math.min(n,Math.max(0,hp(m)-1));m[hpKey(m)]-=n;if(m===p)paid+=n;m._afkSelfCostUntil=Date.now()+15000;}   // B1：自己付的代價不觸發不屈命運
  if(paid>0){if(o.costShield)shield(p,p,paid*o.costShield,{id:s.id+':cost'},10);if(o.costMp)p.mp=Math.min(p.mmp,N(p.mp)+paid);
   if(o.guardDrain){let pool=paid;for(const g of guardsOf(p)){const take=Math.min(pool,Math.max(0,hp(g)-1));g[hpKey(g)]-=take;pool-=take;const room=H-hp(p),back=Math.min(room,paid-pool);p[hpKey(p)]+=back;if(paid-pool>back)shield(p,p,paid-pool-back,{id:s.id+':drain'},10);if(pool<=0)break;}}}
  W.LineageSherine?.signal(p,'blood',null,{amount:paid});return paid;}
 function remainingDots(t){let n=0;const list=[];for(const m of members())for(const x of st(m).dots)if(x.target===t&&x.until>now()){n+=x.damage*Math.max(0,x.until-now());list.push([m,x]);}
  const z=t.st||{};for(const k of ['poison','burn','bleed','scald'])if(N(z[k])>0&&N(z[k+'Dmg'])>0)n+=N(z[k+'Dmg'])*N(z[k])/10;return {n,list};}
 function clearDots(t,list){for(const [m,x] of list)st(m).dots=st(m).dots.filter(y=>y!==x);const z=t.st||{};for(const k of ['poison','burn','bleed','scald'])if(N(z[k])>0)z[k]=0;}
 function debuffAll(p,o,targets){for(const t of targets){if(!live(t))continue;let val=o.value;if(o.poisonedX&&poisoned(t))val*=o.poisonedX;
   if(o.key==='mr'&&val<0)val=-Math.min(-val,Math.max(0,N(t.mr)));   // 魔防扣到 0 為止
   if(o.key==='atkDown'){R.api.status(t,'physicalDamageDown',o.seconds,val);R.api.status(t,'magicDamageDown',o.seconds,val);}
   debuff(t,'u3:'+o.key+':'+(o.src||''),o.key,val,o.seconds);}}
 function perform3(p,s,target,selected){const a=st(p),H=maxhp(p),B=baseline(p);let actual=0,useful=0;
  const ens=()=>nearbyEnemies(p,s),main=target&&live(target)?target:primaryEnemy(p);
  const mult0=(1+value(p,'skill',main)+value(p,'damage',main)+ultMult(p,main,s.plan.channel)+consume(p,'nextDamage'))*tradeDamage(p);
  const lowOf=o=>{let m=1;if(o.lowHp&&hp(p)/H<o.lowHp.below)m*=o.lowHp.mult;if(o.lowHpScale)m*=1+o.lowHpScale*Math.floor((1-hp(p)/H)*10);return m;};
  const hitOne=(t,scale,o)=>{if(!live(t))return 0;let sc=scale;if(o.weakFull&&N(t.weakExpose)>=weakMax())sc*=1+o.weakFull;return damage(p,t,B*sc*mult0*lowOf(o),s,{element:o.element,pierceAc:o.pierceAc,pierceMr:o.pierceMr,kind:o.channel});};
  const pick=o=>o.target==='guards'?guardsOf(p):o.target==='companions'?companions(p):o.target==='team'?team():[p];
  for(const o of s.plan.ops){
   if(o.kind==='hit'){
    if(o.all){for(const t of ens())actual+=hitOne(t,o.scale*(t.boss?(o.bossMult||1):1),o);useful++;continue;}
    const t=main;if(!t)continue;
    if(o.execute&&hp(t)<maxhp(t)*o.execute.below){if(!t.boss&&o.execute.kill){actual+=R.api.damage(t,hp(t)+1,{actor:p,source:s.id,type:'true',origin:'class',generated:true,settle:true,reflect:false,execute:true});useful++;continue;}actual+=hitOne(t,o.scale*o.execute.mult,o);useful++;continue;}
    for(let i=0;i<(o.hits||1)&&live(t);i++)actual+=hitOne(t,o.scale,o);
    if(o.chain){let j=0,last=t;while(j<o.chain.jumps&&!live(last)){const nx=ens()[0];if(!nx)break;actual+=hitOne(nx,o.scale*o.chain.ratio,o);last=nx;j++;}}
    useful++;continue;}
   if(o.kind==='settle'){for(const t of o.all?ens():[main].filter(Boolean)){const r=remainingDots(t);clearDots(t,r.list);let n=r.n*o.mult*lowOf(o);n=Math.min(n,B*40);if(n>0)actual+=damage(p,t,n,s,{kind:'magic',dot:true});if(o.add)actual+=hitOne(t,o.add,o);}useful++;continue;}
   if(o.kind==='markBurst'){for(const t of ens())ms(t).burst={owner:p,until:now()+o.seconds,ratio:o.ratio*lowOf(o),cap:B*o.cap,acc:0,skill:s};useful++;continue;}
   if(o.kind==='spread'){const z=main?.st||{};const ks=['stun','freeze','stone','sleep','paralyze','blind','weaken','disease','slow','confuse','fear','mrhalf','poison','bind','curse'].filter(k=>N(z[k])>0);for(const t of ens())if(t!==main)for(const k of ks)R.api.status(t,k,Math.max(1,N(z[k])/10),z[k+'Dmg']);useful++;continue;}
   if(o.kind==='cdr'){const cds=p.classPath?.cooldowns||{};for(const k of Object.keys(cds)){if(k==='ult'||k.startsWith('dragon'))continue;const left=N(cds[k])-Date.now();if(left>0)cds[k]=Date.now()+left*(1-o.ratio);}useful++;continue;}   // 不影響大絕冷卻
   if(o.kind==='cost'){payCost(p,o,s);useful++;continue;}
   if(o.kind==='buff'){for(const t of pick(o)){let val=o.value;if(o.royalX&&t.cls==='royal')val*=o.royalX;if(o.guardX&&isGuard(t))val*=o.guardX;put(t,o.key,val,o.seconds,s.id,o.charges);}useful++;continue;}
   if(o.kind==='shield'){for(const t of pick(o)){let r=o.ratio;if(o.royalX&&t.cls==='royal')r*=o.royalX;if(o.royalAdd&&t.cls==='royal')r+=o.royalAdd;shield(p,t,maxhp(t)*r,{id:s.id+(o.src?':'+o.src:'')},o.seconds);}useful++;continue;}
   if(o.kind==='heal'){const xs=pick(o);const low=xs.slice().sort((x,y)=>hp(x)/maxhp(x)-hp(y)/maxhp(y))[0];for(const t of xs){let r=o.ratio;if(o.royalX&&t.cls==='royal')r*=o.royalX;if(o.lowestX&&t===low)r*=o.lowestX;const amt=maxhp(t)*r;
     if(o.overTime){const steps=o.interval?Math.floor(o.overTime/o.interval):3;for(let k=1;k<=steps;k++)a.delayed.push({at:now()+o.overTime*k/steps,type:'heal',target:t,amount:amt,skill:s});useful++;continue;}
     const room=maxhp(t)-hp(t);useful+=heal(p,t,amt,s);if(o.overflowMp&&amt>room&&t.mmp>0)t.mp=Math.min(t.mmp,N(t.mp)+Math.floor(amt-room));}
    a.resources.support={until:now()+8};continue;}
   if(o.kind==='mana'){for(const t of pick(o))if(t.mmp>0)t.mp=Math.min(t.mmp,N(t.mp)+Math.floor(t.mmp*o.ratio));useful++;continue;}
   if(o.kind==='cleanse'){let n=0;for(const t of pick(o))n+=cleanse(t,o.number,o.statuses);useful+=n;continue;}
   if(o.kind==='revive'){useful+=revive(p,o.ratio);continue;}
   if(o.kind==='taunt'){for(const t of o.one?[main].filter(Boolean):ens()){if(t.boss&&!o.bossToo)continue;if(typeof ironGuardTaunt==='function'){ironGuardTaunt(t,p);if(t._ironGuardTaunt)t._ironGuardTaunt.until=state.ticks+o.seconds*10;}}useful++;continue;}
   if(o.kind==='redirectAll'){const guards=o.byGuards?guardsOf(p):null;for(const m of team()){if(m===p||isGuard(m))continue;const ratio=m.cls==='royal'&&o.royalRatio!=null?o.royalRatio:o.ratio;if(!(ratio>0))continue;const guardian=guards?guards[0]:p;if(!guardian||guardian===m)continue;st(m).redirect={guardian,ratio,guardianReduction:0,single:false,until:now()+o.seconds,fromRoyal:m.cls==='royal',owner:p};}useful++;continue;}
   if(o.kind==='store'){a.store={until:now()+o.seconds,ratio:o.ratio*lowOf(o),royalRatio:o.royalRatio||o.ratio,acc:0,royalAcc:0,skill:s};useful++;continue;}
   if(o.kind==='debuffAll'){debuffAll(p,o,ens());useful++;continue;}
   if(o.kind==='debuffMain'){if(main)debuff(main,'u3:'+o.key,o.key,o.value,o.seconds);useful++;continue;}
   if(o.kind==='bloodVuln'){const v=o.per*Math.floor((1-hp(p)/H)*10);if(v>0)debuffAll(p,{key:'bloodVuln',value:v,seconds:o.seconds},ens());useful++;continue;}
   if(o.kind==='block'){for(const t of ens()){const m=ms(t),cur=m.suppression?.until>now()?m.suppression.value:0;m.suppression={until:now()+o.seconds,value:Math.max(cur,o.value)};}useful++;continue;}
   if(o.kind==='breachAll'){for(const t of ens()){const m=ms(t);for(const mode of ['phys','magic']){const old=m.breaches[mode];m.breaches[mode]={until:now()+o.seconds,recover:Math.max(N(old?.recover),now()+o.seconds)};}}useful++;continue;}   // B9：無視回復冷卻
   if(o.kind==='statusAll'){for(const t of ens())useful+=allNeg(t,o.statuses,o.seconds,o.strength,o.bossToo,p);continue;}
   if(o.kind==='statusOne'){if(main){const sec=main.boss&&o.bossSeconds!=null?o.bossSeconds:o.seconds;useful+=allNeg(main,[o.status],sec,o.strength,o.bossToo||o.bossSeconds!=null,p);}continue;}
   if(o.kind==='weak'){for(const t of o.all?ens():[main].filter(Boolean)){const mx=weakMax();t.weakExpose=o.add==='max'?mx:Math.min(mx,N(t.weakExpose)+o.add);}useful++;continue;}
   if(o.kind==='dot'){for(const t of [main].filter(Boolean)){if(o.poison&&(t.immPoison||t.poisonImmune))continue;a.dots=a.dots.filter(x=>!(x.target===t&&x.skill.id===s.id));a.dots.push({target:t,skill:s,poison:o.poison,damage:B*o.scale*mult0*(1+value(p,'poison',t)),next:now()+1,until:now()+o.seconds});}useful++;continue;}   // B7：同一招只留一條
   if(o.kind==='assist'){const list=o.guards?guardsOf(p):companions(p);for(const c of list)if(main)actual+=damage(p,main,B*.3*o.scale,s,{kind:'melee',attacker:c});useful++;continue;}
   if(o.kind==='trueDps'){const w=DB.items[p.eq?.wpn?.id]||{},per=Math.max(N(w.dmgS),N(w.dmgL),1)*o.weaponMax;(a.pulses||(a.pulses=[])).push({skill:s,until:now()+o.seconds,next:now()+1,true:per});useful++;continue;}
   if(o.kind==='pulse'){(a.pulses||(a.pulses=[])).push({skill:s,until:now()+o.seconds,next:now()+1,scale:o.scale*mult0,element:o.element});useful++;continue;}
   if(o.kind==='bite'){const B2=W.__afkPetBite;if(B2&&B2.fill)for(const t of ens())B2.fill(t);useful++;continue;}   // 用現有的寵物傷口撕咬（afk-petbite）
  }
  R.recalc(p);return {actual,useful};
 }
 // 每一刻：印記爆發、累積反攻、持續脈衝、殿堂偷回復
 function tick3(p){const a=st(p);
  if(a.store&&a.store.until<=now()){const x=a.store;a.store=null;const total=x.acc*x.ratio+x.royalAcc*x.royalRatio;if(total>0)for(const t of nearbyEnemies(p,x.skill))damage(p,t,Math.min(total,baseline(p)*50),x.skill,{kind:'melee',dot:true});}
  if(a.pulses?.length){for(const x of a.pulses)if(x.next<=now()&&x.until>=now()){x.next+=1;for(const t of nearbyEnemies(p,x.skill)){if(x.true)R.api.damage(t,x.true,{actor:p,source:x.skill.id,type:'true',origin:'class',generated:true,settle:true,reflect:false});else damage(p,t,baseline(p)*x.scale,x.skill,{kind:'magic',element:x.element,dot:true});}}a.pulses=a.pulses.filter(x=>x.until>now());}
  if(p!==player)return;
  for(const t of enemies()){const m=ms(t);if(m.burst&&m.burst.until<=now()){const b=m.burst;m.burst=null;const n=Math.min(b.acc*b.ratio,b.cap);if(n>0)damage(b.owner,t,n,b.skill,{kind:'magic',dot:true});}
   if(dv(t,'healSteal')>0){const was=N(t._afkHsHp);if(was>0&&hp(t)>was){const diff=hp(t)-was;t[hpKey(t)]=was;const low=team().sort((x,y)=>hp(x)/maxhp(x)-hp(y)/maxhp(y))[0];if(low)R.api.heal(low,Math.min(diff,maxhp(low)-hp(low)),{owner:p,source:'class-healsteal',prepaid:true});}t._afkHsHp=hp(t);}else t._afkHsHp=0;}
 }
 let mapCast = null;
 function mapRecipient(t, kind, source) {
  if (!mapCast || !t || (source && source !== mapCast.id && !source.startsWith(mapCast.id + ':'))) return;
  if (!mapCast.targets.some(x => x.who === t && x.kind === kind)) mapCast.targets.push({who:t, kind});
 }
 function perform(p,s,target,selected) {
  const notify = !state.ff && W.__dimMapSkillPerformed;
  if (!notify) return performOriginal(p,s,target,selected);
  const parent = mapCast, receipt = {id:s.id, targets:[]};
  mapCast = receipt;
  let result;
  try { result = performOriginal(p,s,target,selected); } finally { mapCast = parent; }
  try { notify(p,s,receipt.targets,result,target); } catch(e) { console.warn(e); }
  return result;
 }
 function performOriginal(p,s,target,selected){if(s.plan.v3ult)return perform3(p,s,target,selected);const a=st(p),H=maxhp(p),M=N(p.mmp),B=baseline(p);let actual=0;const next=s.type==='法術'?consume(p,'nextSkill'):0,mult=(1+value(p,'skill',target)+value(p,'damage',target)+next+(s.type==='法術'?consume(p,'nextClassDamage'):0))*tradeDamage(p);let useful=0;
  const ordered=s.plan.ops.slice().sort((x,y)=>(x.kind==='require'?-1:0)-(y.kind==='require'?-1:0));
  for(const o of ordered){
   const xs=targets(p,o,selected);if(['mark','debuff','status'].includes(o.kind)&&s.plan.ops.some(x=>x.kind==='hit')&&actual<=0)continue;
   if(o.kind==='require'){const full=o.consume&&resource(p,target,o.key)>=(o.key==='stack'?3:1);spendResource(p,target,o);if(full)W.LineageSherine?.signal(p,'resource',target);continue;}
   if(o.kind==='hit'){const ts=[target,...nearbyEnemies(p,s).filter(t=>t!==target)].filter(live);ts.slice(0,o.targets||1).forEach(t=>{let scale=o.low&&hp(p)/H>=.4?o.low:o.unmarked&&!resource(p,t,'mark')?o.unmarked:o.scale;const split=o.split||(a.stance?.until>now()&&a.stance.family==='element'?.3:0);actual+=damage(p,t,B*scale*mult*(1-split),s);if(split&&live(t))actual+=damage(p,t,B*scale*mult*split,s,{kind:'magic',element:a.stance?.element});});if(o.secondaryCount)ts.slice(1,1+o.secondaryCount).forEach(t=>actual+=damage(p,t,B*o.secondaryScale*mult,s));if(actual>0)useful++;}
   if(o.kind==='dot'){for(const t of [target,...nearbyEnemies(p,s).filter(t=>t!==target)].slice(0,o.targets||1)){if(!live(t)||o.poison&&(t.immPoison||t.poisonImmune))continue;a.dots=a.dots.filter(x=>!(x.target===t&&x.skill.id===s.id));a.dots.push({target:t,skill:s,poison:o.poison,damage:B*o.scale*mult*(1+value(p,'poison',t))*(o.perSecond?1:1/o.seconds),next:now()+1,until:now()+o.seconds});putMark(p,t,o.seconds,false);}useful++;}
   if(o.kind==='shield'){let budget=H*(o.cap||1);for(const t of xs){const amount=Math.min(budget,maxhp(t)*o.ratio);shield(p,t,amount,s,o.seconds);budget-=amount;}if(o.refund||o.endHeal)a.delayed.push({at:now()+o.seconds,type:'shieldEnd',skill:s,refund:o.refund,endHeal:o.endHeal,amount:shieldAmount(p),source:'class:'+s.id});if(o.refund)for(const t of xs)st(t).shieldRefund={source:'class:'+s.id,ratio:o.refund,owner:p,until:now()+o.seconds,used:false};useful++;}
   if(o.kind==='heal'){let budget=H*(o.cap||1);for(const t of xs){const amount=Math.min(budget,maxhp(t)*o.ratio*(1+next));budget-=amount;if(o.overTime){const steps=o.interval?Math.floor(o.overTime/o.interval):3;for(let k=1;k<=steps;k++)a.delayed.push({at:now()+o.overTime*k/steps,type:'heal',target:t,amount:o.perTick?amount:amount/steps,skill:s});}else useful+=heal(p,t,amount,s);}a.resources.support={until:now()+8};}
   if(o.kind==='leech'&&condition(p,o,target))useful+=heal(p,p,Math.min(actual*o.ratio,H*o.cap),s);
   if(o.kind==='mana')for(const t of xs){if(t.mmp>0)t.mp=Math.min(t.mmp,N(t.mp)+Math.floor(t.mmp*o.ratio));useful++;}
   if(o.kind==='cleanse'){let removed=0;for(const t of xs)removed+=cleanse(t,o.number,o.statuses);useful+=removed;if(removed)W.LineageSherine?.signal(p,'cleanse',target);}
   if(o.kind==='buff'){const sharedBudget=o.budget?{remaining:B*o.budget}:null;for(const t of xs)put(t,o.key,o.value,o.seconds,s.id,o.charges,{condition:o.condition,filter:o.filter,leechCap:o.leechCap,budget:o.budget?sharedBudget:null});useful++;}
   if(o.kind==='mark'){putMark(p,target,o.seconds,o.stack);useful++;}
   if(o.kind==='debuff'){debuff(target,s.id,o.key,o.value,o.seconds);W.LineageSherine?.signal(p,'debuff',target,{seconds:o.seconds});useful++;}
   if(o.kind==='status')for(const t of [target,...nearbyEnemies(p,s).filter(t=>t!==target)].slice(0,o.targets||1)){if(!live(t)||o.normalOnly&&t.boss)continue;if(R.api.status(t,o.status,o.seconds,t.boss&&o.bossValue||o.value)!==false)W.LineageSherine?.signal(p,'debuff',t,{seconds:o.seconds});useful++;}
   if(o.kind==='breach'){const m=ms(target),before=m.breaches[o.mode];if((!before||before.recover<=now())&&hitChance(p,target,'melee')){m.breaches[o.mode]={until:now()+o.seconds,recover:now()+o.seconds+o.recovery};debuff(target,'class-breach-ac','ac',o.ac,o.seconds);debuff(target,'class-breach-mr','mr',o.mr,o.seconds);m.suppression={until:now()+o.seconds,value:o.suppression};W.LineageSherine?.signal(p,'breach',target);useful++;}}
   if(o.kind==='taunt')for(const t of nearbyEnemies(p,s)){if(t.boss)continue;ironGuardTaunt(t,p);t._ironGuardTaunt.until=state.ticks+o.seconds*10;useful++;}
   if(o.kind==='redirect'){const recipient=selected&&live(selected)&&selected!==p?selected:team().filter(t=>t!==p).sort((x,y)=>hp(x)/maxhp(x)-hp(y)/maxhp(y))[0];const guardian=o.guardian?companions(p).find(x=>x._guard||x.guard||x.kind==='guard'):p;if(recipient&&guardian&&recipient!==guardian){st(recipient).redirect={guardian,ratio:o.royal&&recipient.cls!=='royal'?.2:o.ratio,guardianReduction:o.guardianReduction||0,single:o.single,until:now()+o.seconds};useful++;}}
   if(o.kind==='retaliate'){const n=(o.shield?a.shieldLog:a.damageLog).filter(x=>now()-x.at<=(o.window||6)).reduce((n,x)=>n+x.amount,0);actual+=damage(p,target,Math.min(B*o.scale,N(n)*o.ratio),s);a.absorbed=a.hurt=0;useful++;}
   if(o.kind==='assist'){const pet=companions(p)[0];if(pet){const d=pet.d||{},base=N(d.meleeDmg)||N(pet.atk)||N(pet.db)||B*.3;actual+=damage(p,target,base*o.scale,s);useful++;}}
   if(o.kind==='drain')a.drains={until:now()+o.seconds,next:now()+1,ratio:o.ratio};
   if(o.kind==='consumeShield'){const shields=R.state(p,'_shields'),amount=shieldAmount(p,true);for(const [key,z] of Object.entries(shields))if(key.startsWith('class:'))delete shields[key];actual+=damage(p,target,B*o.scale*Math.min(1,amount/(H*.3)),s);useful++;}
   if(o.kind==='shareShield'){if(!team().some(t=>t!==p))continue;const list=R.state(p,'_shields');let amount=0;for(const [key,z] of Object.entries(list))if(key.startsWith('class:')&&z.until>now()){amount+=z.amount;delete list[key];}const group=team().filter(t=>t!==p).slice(0,o.count);if(!group.length){Object.assign(list,{});continue;}group.forEach(t=>shield(p,t,amount/group.length,s,6));useful+=group.length;}
   if(o.kind==='detonate'){const dots=a.dots.filter(x=>x.target===target&&x.poison);const amount=dots.reduce((n,x)=>n+x.damage*Math.max(0,Math.floor(x.until-now())),0);a.dots=a.dots.filter(x=>!dots.includes(x));actual+=damage(p,target,Math.min(B*o.scale,amount),s);useful++;}
   if(o.kind==='extendPoison')a.dots.filter(x=>x.target===target&&x.poison).forEach(x=>{x.until+=o.seconds;useful++;});
   if(o.kind==='stance'){if(o.family==='weaponStyle')a.weaponStyle=selected?.style==='claw'?'claw':'dual';if(a.stance?.family==='element')a.elementHistory.add(a.stance.element);a.stance={family:o.family,until:now()+o.seconds,element:a.stance?.element==='fire'?'water':a.stance?.element==='water'?'wind':'fire'};triggerPassives(p,'stance');useful++;}
   if(o.kind==='borrowMagic'){p.classPath.borrowMagic=true;useful++;}
   if(o.kind==='sacrifice'){const pet=companions(p).find(x=>x.skId==='sk_zombie'||x._necroOwnerKey);if(pet){pet[hpKey(pet)]=0;pet._downed=true;pet._diedAt=Date.now();useful++;}}
   if(o.kind==='focus')for(const pet of companions(p))pet._classTarget=target?.uid;
   if(o.kind==='summon'){useful+=summon(p,s,o.seconds)?1:0;}
  }
  if(actual>0){const m=mark(p,target);m.last=now();m.casts.add(s.id);m.stack=Math.min(3,m.stack+1);if(s.number===1)m.first=now()+8;if(s.number===5&&m.first>now())m.dual={until:now()+8,used:false};if(s.number===8)m.third={until:now()+8,used:false};}
  else if(useful&&!s.plan.ops.some(o=>o.kind==='hit')&&s.number===8&&live(target))mark(p,target).third={until:now()+8,used:false};
  // Support opening skills also establish the ordered fusion link for the current target.
  if(useful&&live(target)&&(!s.plan.ops.some(o=>o.kind==='hit')||actual>0)&&C.tree(p)?.requiresFusionTransfer){const m=mark(p,target);if(s.number===1)m.first=now()+8;if(s.number===5&&m.first>now())m.dual={until:now()+8,used:false};}
  if(useful||actual>0){triggerPassives(p,'cast');if(s.type==='法術')W.LineageSherine?.signal(p,'cast',target,{id:s.id});}R.recalc(p);return {actual,useful};
 }
 function cast(id,target,selected,p=player){const s=C.skills.get(id);target=target||primaryEnemy(p);const why=reason(p,s,target);if(why)return {ok:false,reason:why};if(s.type==='光環')return {ok:false,reason:'請在光環頁啟用'};const c=cost(p,s);spendCharged(p,'cost');p.mp-=c.mp;p[hpKey(p)]-=c.hp;if(c.hp>0)W.LineageSherine?.signal(p,'blood',target,{amount:c.hp});W.LineageSherine?.consumeSilence(p);const cds=p.classPath.cooldowns||(p.classPath.cooldowns={}),key=s.type==='大絕'?'ult':s.type==='龍魔法'?'dragon:'+s.id:s.id;cds[key]=Date.now()+s.plan.cd*1000*(s.type==='大絕'?1:(st(p).spellDelay||1)*(typeof W.__afkCdrMult==='function'?W.__afkCdrMult(p,s):1));if(s.type==='龍魔法')cds.dragonGlobal=Date.now()+5000;
  if(s.plan.castTime){st(p).casting={at:now()+s.plan.castTime,s,target,selected};return {ok:true,charging:true};}const result=perform(p,s,target,selected);if(!state.ff&&typeof logCombat==='function')logCombat('<span style="color:#d8c58d">'+s.name+'</span>','magic');return {ok:true,...result};
 }
 function debuff(t,source,key,value,seconds){if(!t)return;const m=ms(t),old=m.debuffs[source];if(old&&!VIRTUAL.has(old.key))t[old.key]-=old.value;m.debuffs[source]={key,value,until:now()+seconds};if(!VIRTUAL.has(key))t[key]=N(t[key])+value;mapRecipient(t,'mark');}
 function broken(t,kind){if(kind==='melee'||kind==='ranged')kind='phys';return N(ms(t).breaches[kind]?.until)>now();}
 function summon(p,s,seconds){if(p!==player)return false;const list=p.summonsV2||(p.summonsV2=[]);if(list.some(x=>x._classSpirit&&live(x)))return false;const form=typeof _sumDefaultForm==='function'?_sumDefaultForm(p):null;if(!form)return false;const limit=_sumCountFor(form,p),e=_sumTierOf(form);if(!e||limit<=0||list.filter(live).length>=limit)return false;list.push({uid:uid(),skId:'sk_summon',form,lv:e.mob.lv,hp:e.mob.hp,mhp:e.mob.hp,_atkCd:5,_classSpirit:true,_classExpires:now()+seconds});return true;}
 function stats(p){if(!p?.d||!C.valid(p))return;const a=st(p);if(!a.baseStats||!enemies().length)a.baseStats={...p.d};if(!C.tree(p)&&!members().some(owner=>activeAuras(owner).length))return;const d=p.d;p.mhp=Math.max(1,Math.floor(p.mhp*(1+value(p,'maxHp'))));
  const trade=C.tree(p)?.tradeoff||'';const atkCut=trade.match(/攻速[−-](\d+)/);if(atkCut){d.aspd/=Math.max(.2,1-Number(atkCut[1])/100);if(d.aspdOff)d.aspdOff/=Math.max(.2,1-Number(atkCut[1])/100);}if(/施法間隔\+10%/.test(trade))st(p).spellDelay=1.1;const cut=(trade.match(/最大MP[−-](\d+)%/)||[])[1];if(tIs(p,'knight','mage')&&!cut)p.mmp=Math.max(1,Math.floor(p.mmp*.2));if(cut)p.mmp=Math.max(0,Math.floor(p.mmp*(1-Number(cut)/100)));
  if(/最大HP[−-]10%/.test(trade))p.mhp=Math.max(1,Math.floor(p.mhp*.9));
  for(const kind of ['melee','ranged','magic'])d[kind+'Hit']=N(d[kind+'Hit'])+value(p,'hit',null,{kind});for(const k of ['meleeCritDmg','rangedCritDmg','magicCritDmg'])d[k]=N(d[k])+value(p,'critDamage');d.mr=N(d.mr)+value(p,'mr');d.ac=N(d.ac)+value(p,'ac');for(const [e,k] of [['fire','resFire'],['water','resWater'],['wind','resWind'],['earth','resEarth']])d[k]=N(d[k])+value(p,'res_'+e);for(const k of ['meleeCritDmg','rangedCritDmg','magicCritDmg'])d[k]=N(d[k])+value(p,'critDamage2');for(const k of ['resFire','resWater','resWind','resEarth'])d[k]=N(d[k])+value(p,'resist');d.moveSpeedPct=N(d.moveSpeedPct)+value(p,'move');const speed=1+Math.min(1,value(p,'haste'));d.aspd=Math.max(.1,N(d.aspd)/speed);if(d.aspdOff>0)d.aspdOff=Math.max(.1,d.aspdOff/speed);p.hp=Math.min(p.hp,p.mhp);p.mp=Math.min(p.mp,p.mmp);
 }
 function direct(c){return c.direct!==false&&!c.generated&&!c.isDot&&!c.reflection&&!c.redirected&&['normal','auto','gm'].includes(c.origin||'normal');}
 function event(name,c){if(!c?.actor)return;let done=seen.get(c);if(!done){done=new Set();seen.set(c,done);}const eventKey=name==='petHit'?name+':'+(c.actualDamage==null?'before':'after'):name;if(done.has(eventKey))return;done.add(eventKey);const p=c.actor,a=st(p);
  if(name==='battleEnd'){reset(p);return;}
  if(name==='beforeCast'&&direct(c)){c.mpCost*=1-Math.min(.6,value(p,'cost'));if(['atk','heal'].includes(c.skillType)){c.classSkillBoost=value(p,'nextSkill');c.damageMult=(c.damageMult||1)*(1+c.classSkillBoost);c.healMult=(c.healMult||1)*(1+c.classSkillBoost);}}
  if(name==='castPaid'&&direct(c)){spendCharged(p,'cost');if(c.classSkillBoost)consume(p,'nextSkill');}
  if(name==='regen'&&c.regenKind==='hp')c.value*=1+value(p,'regen');
  if(name==='regen'&&c.regenKind==='mp')c.value*=1+value(p,'mpRegen');
  if(name==='beforeDot'&&c.dotKind==='poison')c.damage*=1+value(p,'poison',c.target);
  if(name==='beforeDot'&&c.target)c.damage*=1+Math.min(3,dv(c.target,'dotVuln')+(c.dotKind==='bleed'?dv(c.target,'bleedVuln'):0)+vulnOf(p,c.target,{kind:'dot'}));
  if(name==='onCast'&&direct(c)){a.resources.nativeSpell={until:now()+8};triggerPassives(p,'cast');}

  if(name==='tick'){tick(p);return;}
  if(name==='beforeStatus'&&value(p,'statusImmune')>0){c.immune=true;c.duration=0;return;}
  if(name==='beforeStatus'&&c.duration>0){const allowed=passive(p).filter(o=>o.kind==='passive'&&o.key==='control'&&(!o.statuses||o.statuses.includes(c.statusKind))).reduce((n,o)=>n+o.value,0);c.duration*=1-Math.min(.75,allowed+Math.max(0,...buffs(p).filter(b=>b.key==='control').map(b=>b.value))+aura(p,'control'));}
  if(name==='beforeHeal')c.amount*=Math.max(0,1+value(c.recipient||p,'healingIn'));

  if(name==='onCompanionStats'&&c.companion){c.maxHpMult*=1+value(c.companion,'maxHp');c.attackSpeedPct=N(c.attackSpeedPct)+value(c.companion,'haste')*100;}
  if(name==='petHit'&&c.companion){if(c.actualDamage==null&&c.target){c.damage*=1+vulnOf(c.companion,c.target,{kind:'melee'});}if(c.actualDamage==null){const pet=c.companion;let bonus=c.damage*value(pet,'damage',c.target,c);for(const b of buffs(pet))if(b.key==='damage'&&b.budget){const n=Math.min(bonus,b.budget.remaining);b.budget.remaining-=n;bonus=n;}c.damage+=bonus+c.damage*consume(pet,'nextDamage');}else if(c.actualDamage>0){a.resources.companion={until:now()+6};refundTriggers(p,'companion');}}
  if(name==='shieldAbsorb'&&c.shieldSource?.startsWith('class:')){a.absorbed=N(a.absorbed)+N(c.absorbed);a.shieldLog.push({at:now(),amount:N(c.absorbed)});a.resources.hurt={until:now()+6};}
  if(name==='shieldBreak'&&c.shieldSource?.startsWith('class:')&&direct(c)){a.resources.shieldBroken={until:now()+6};refundTriggers(p,'shieldBroken');const f=a.shieldRefund;if(f&&!f.used&&f.until>=now()&&f.source===c.shieldSource){f.used=true;f.owner.mp=Math.min(f.owner.mmp,f.owner.mp+f.owner.mmp*f.ratio);}}
  if((name==='beforeHit'||name==='beforeSkill')&&direct(c)&&!done.has('damage')){done.add('damage');c.damage*=tradeDamage(p);c.damage*=1+value(p,'damage',c.target,c)+consume(p,'nextDamage')+(c.skillId?value(p,'skill',c.target):0);c.damage*=1+ultMult(p,c.target,c.kind);c.damage*=1+vulnOf(p,c.target,{kind:c.kind,element:c.element,crit:c.crit||c.isCrit});}
  if(name==='beforeHurt'&&c.damage>0){if(value(p,'invuln')>0){c.damage=0;return;}
   if(c.normalAttack&&N(c.attacker?.st?.confuse)>0&&Math.random()<.5){c.damage=0;return;}   // 混亂的怪物：一般攻擊 50% 打空（Ping 21:49）
   const mg=value(p,'manaGuard');if(mg>0&&N(p.mp)>0){const take=Math.min(c.damage*mg,N(p.mp));p.mp-=take;c.damage-=take;}
   if(c.damage>=hp(p)){if(value(p,'hpFloor')>0)c.damage=Math.max(0,hp(p)-1);else if(value(p,'antiExecute')>0){c.damage=Math.max(0,hp(p)-1);spendCharged(p,'antiExecute');}}}
  if(name==='beforeHurt'&&direct(c)){
   c.damage*=1-Math.min(.75,value(p,'reduction',c.attacker,c)+value(p,'reduction2'));if(c.normalAttack&&Math.random()<value(p,'decoy'))c.damage=0;if(c.normalAttack&&Math.random()<Math.min(.5,value(p,'dodge')/100)){c.damage=0;a.resources.dodge={until:now()+6};triggerPassives(p,'dodge');}
   const link=a.redirect;if(link?.until>now()&&live(link.guardian)&&!c.redirected&&(!link.single||c.normalAttack&&!c.aoe)){const n=c.damage*link.ratio;c.damage-=n;if(link.fromRoyal&&st(link.guardian).store)st(link.guardian).store.royalAcc+=n;R.api.damage(link.guardian,n*(1-link.guardianReduction),{actor:link.guardian,attacker:c.attacker,source:'class-redirect',redirected:true,origin:'redirect',direct:true,type:c.kind,noProc:true});if(hp(link.guardian)<=0){if(link.guardian===player)killPlayer();else link.guardian._downed=true;}}
  }
  if(name==='afterHurt'&&c.actualDamage>0&&!c.reflection){if(a.store&&a.store.until>now())a.store.acc+=c.actualDamage;const rf=value(p,'reflect');if(rf>0&&live(c.attacker)&&c.attacker.curHp!=null)R.api.damage(c.attacker,c.actualDamage*rf,{actor:p,source:'class-reflect',type:'true',origin:'reflection',reflection:true,generated:true,settle:true,reflect:false});const hl=value(p,'hurtLeech');if(hl>0)R.api.heal(p,c.actualDamage*hl,{owner:p,source:'class-hurtleech',prepaid:true});}
  if(name==='afterHurt'&&direct(c)&&c.actualDamage>0){a.resources.hurt={until:now()+6};a.hurt=N(a.hurt)+c.actualDamage;a.damageLog.push({at:now(),amount:c.actualDamage});const rate=value(p,'hurtHeal');if(rate&&N(a.cd.hurtHeal)<=now()){a.cd.hurtHeal=now()+2;heal(p,p,maxhp(p)*rate,{id:'class-hurt-regen'});}for(const o of passive(p))if(o.kind==='hurtHeal'&&N(a.cd[o.source])<=now()){a.cd[o.source]=now()+o.cd;heal(p,p,maxhp(p)*o.ratio,{id:o.source});}}
  if(name==='directHit'&&direct(c)&&c.actualDamage>0){if(c.skillId&&c.element&&a.lastElement&&a.lastElement!==c.element)refundTriggers(p,'alternate');if(c.element)a.lastElement=c.element;if(c.actionId!=null&&a.lastAction===c.actionId)return;a.lastAction=c.actionId;if(!c.skillId&&c.main!==false)spendCharged(p,'critDamage');a.resources.mainHit={until:now()+8};if(c.skillId)a.resources.nativeSpell={until:now()+8};const m=mark(p,c.target);m.last=now();m.stack=Math.min(3,m.stack+1);if(c.skillId)m.casts.add(c.skillId);m.stack=Math.min(3,m.stack+consume(p,'extraStack'));const leech=value(p,'leech',c.target);if(leech>0&&N(a.cd.leech)<=now()){a.cd.leech=now()+1;heal(p,p,Math.min(c.actualDamage*leech,maxhp(p)*Math.max(.02,...buffs(p).filter(b=>b.key==='leech').map(b=>b.leechCap||.02))),{id:'class-leech'});}for(const o of passive(p))if(o.kind==='resourceTrigger'&&o.trigger==='hit'&&N(a.cd[o.source])<=now()){a.cd[o.source]=now()+o.cd;p.mp=Math.min(p.mmp,p.mp+p.mmp*o.ratio);}
   burstAdd(p,c.target,c.actualDamage);const l3=Math.min(1,value(p,'leech2')+value(p,'leech3'));if(l3>0)R.api.heal(p,c.actualDamage*l3,{owner:p,source:'class-leech3',prepaid:true});if(!c.skillId&&c.main!==false)extraHits(p,c.target,c.actualDamage,0,c);}
  if(name==='onHeal'&&c.actualHeal>0){const owner=c.healer||c.owner||c.actor;if(owner)for(const o of passive(owner)){if(o.kind==='supportShield'&&N(st(owner).cd[o.source])<=now()){st(owner).cd[o.source]=now()+o.cd;shield(owner,owner,maxhp(owner)*o.ratio,{id:o.source},6);}if(o.kind==='resourceTrigger'&&o.trigger==='support'&&N(st(owner).cd[o.source])<=now()){st(owner).cd[o.source]=now()+o.cd;owner.mp=Math.min(owner.mmp,owner.mp+owner.mmp*o.ratio);}}}
  const trigger=name==='afterHurt'&&direct(c)&&c.actualDamage>0?'hurt':name==='directHit'&&direct(c)&&c.actualDamage>0?'third':name==='onDodge'?'dodge':null;
  if(trigger)for(const o of passive(p))if(o.kind==='nextTrigger'&&o.trigger===trigger&&(!o.filter||o.filter===c.kind)&&N(a.cd[o.source])<=now()){if(trigger==='third'){const k='count:'+o.source;a.cd[k]=N(a.cd[k])+1;if(a.cd[k]%3)continue;}a.cd[o.source]=now()+o.cd;put(p,o.key||'nextDamage',o.value,6,o.source,1);}
 }
 function tick(p){const a=st(p);if(!live(p))return;try{tick3(p);}catch(e){}a.damageLog=a.damageLog.filter(x=>now()-x.at<=10);a.shieldLog=a.shieldLog.filter(x=>now()-x.at<=10);if(a.casting){if(controls(p))a.casting=null;else if(a.casting.at<=now()){const x=a.casting;a.casting=null;if(!x.target||live(x.target))perform(p,x.s,x.target,x.selected);}}for(const [k,b] of Object.entries(a.buffs))if(b.until<=now()){delete a.buffs[k];R.recalc(p);}
  if(Array.isArray(p.summonsV2)){const before=p.summonsV2.length;p.summonsV2=p.summonsV2.filter(x=>!x._classSpirit||x._classExpires>now());if(before!==p.summonsV2.length)for(const o of passive(p))if(o.kind==='resourceTrigger'&&o.trigger==='companionGone'&&N(a.cd[o.source])<=now()){a.cd[o.source]=now()+o.cd;p.mp=Math.min(p.mmp,p.mp+p.mmp*o.ratio);}}
  if(p===player)for(const t of enemies()){const m=ms(t);for(const [key,d] of Object.entries(m.debuffs))if(d.until<=now()){if(!VIRTUAL.has(d.key))t[d.key]-=d.value;delete m.debuffs[key];}}
  for(const x of a.delayed.filter(x=>x.at<=now())){if(x.type==='heal')heal(p,x.target,x.amount,x.skill);else if(x.type==='shieldEnd'){if(x.endHeal)heal(p,p,N(R.state(p,'_shields')[x.source]?.amount)*x.endHeal,x.skill);}}a.delayed=a.delayed.filter(x=>x.at>now());
  for(const x of a.dots)if(live(x.target)&&x.until>=now()&&x.next<=now()){x.next+=1;damage(p,x.target,x.damage,x.skill,{dot:true,poison:x.poison});}a.dots=a.dots.filter(x=>live(x.target)&&x.until>now());
  if(a.drains?.until>now()&&a.drains.next<=now()){a.drains.next=now()+1;const n=maxhp(p)*a.drains.ratio;if(hp(p)>n)p[hpKey(p)]-=n;else{a.drains=null;a.buffs={};}}
  for(const o of passive(p))if(o.kind==='regen'&&N(a.cd[o.source])<=now()){a.cd[o.source]=now()+o.interval;heal(p,p,maxhp(p)*o.ratio,{id:o.source});}
  if(!C.tree(p))return;
  if(now()-N(a.auraCheck)>.9){a.auraCheck=now();const next=[];for(const id of p.classPath.auras||[]){const s=C.skills.get(id);if(!usable(p,id)||s?.type!=='光環')continue;const key='upkeep:'+id;if(N(a.cd[key])<=now()){const n=Math.ceil(p.mmp*(a.cd[key]?s.plan.upkeep:s.plan.mp)),h=Math.ceil(maxhp(p)*s.plan.blood);if(p.mp<n||hp(p)<=h)continue;p.mp-=n;p[hpKey(p)]-=h;a.cd[key]=now()+5.1;}next.push(s);}const changed=next.map(s=>s.id).join()!==(a.activeAuras||[]).map(s=>s.id).join();a.activeAuras=next;if(changed)members().forEach(t=>R.recalc(t));}
  if(p!==player||!state.running||!enemies().length||controls(p)||W.LineageClasses?.isBusy()||now()-a.lastAuto<1)return;
  const ids=p.classPath.auto||[],t0=primaryEnemy(p);
  // 11-20（Ping）：大絕自動放——冷卻好了就先放已選定的大絕（第 3 段優先），不用放進自動施放 8 格
  {const u=p.classPath.ultimates||{};if(t0)for(const n of [3,2,1]){const id=u[n],s=id&&C.skills.get(id);if(s&&s.type==='大絕'&&usable(p,id)&&!reason(p,s,t0)){cast(id,t0,null,p);break;}}}   // 不佔自動施放的 1 秒間隔
  // 11-19（Ping）：自動施放會排連段——自動清單裡有要「法術一與五連接」或「法術八」的招時，路線的 1、5、8 號也一起算進候選；
  //   前置剛完成就優先放接續的招（連段 8 秒內），1 號放過就優先放 5 號。
  {const route=p.classPath.route,byNo=n=>{for(const x of C.skills.values())if(x.tree===route&&x.number===n&&usable(p,x.id))return x;return null;},need=new Set();
   for(const id of ids){const s=C.skills.get(id);for(const o of(s&&s.plan&&s.plan.ops)||[])if(o.kind==='require'&&(o.key==='dual'||o.key==='third'))need.add(o.key);}
   if(need.size&&t0){const m=mark(p,t0),pick=[];
    for(const id of ids){const s=C.skills.get(id);if(s&&(s.plan.ops||[]).some(o=>o.kind==='require'&&(o.key==='dual'||o.key==='third'))&&!reason(p,s,t0))pick.push(s);}
    if(!pick.length&&need.has('dual')&&m.first>now()){const s5=byNo(5);if(s5&&!reason(p,s5,t0))pick.push(s5);}
    if(!pick.length&&need.has('dual')&&!(m.first>now())&&!(m.dual&&m.dual.until>now()&&!m.dual.used)){const s1=byNo(1);if(s1&&!reason(p,s1,t0))pick.push(s1);}
    if(!pick.length&&need.has('third')&&!(m.third&&m.third.until>now()&&!m.third.used)){const s8=byNo(8);if(s8&&!reason(p,s8,t0))pick.push(s8);}
    if(pick.length){a.lastAuto=now();cast(pick[0].id,t0,null,p);return;}}}
  for(let k=0;k<ids.length;k++){const i=((a.autoCursor||0)+k)%ids.length,s=C.skills.get(ids[i]),t=t0;if(s&&!reason(p,s,t)){a.lastAuto=now();a.autoCursor=(i+1)%ids.length;cast(s.id,t,null,p);break;}}
 }
 function refundTriggers(p,trigger){const a=st(p);for(const o of passive(p))if(o.kind==='resourceTrigger'&&o.trigger===trigger&&N(a.cd[o.source])<=now()){a.cd[o.source]=now()+o.cd;p.mp=Math.min(p.mmp,p.mp+p.mmp*o.ratio);}}
 function triggerPassives(p,trigger){const a=st(p);for(const o of passive(p))if(o.kind==='nextTrigger'&&o.trigger===trigger&&N(a.cd[o.source])<=now()){a.cd[o.source]=now()+o.cd;put(p,o.key||'nextDamage',o.value,6,o.source,1);}}
 function tradeDamage(p){const d=C.tree(p)?.tradeoff||'';const m=d.match(/(?:自身|自己|直接|法術|普通直接|站樁遠攻)(?:傷害|法術傷害)?[−-](\d+)%/);return m?Math.max(.1,1-Number(m[1])/100):1;}
 function tIs(p,base,partner){const t=C.tree(p);return !!(t?.requiresFusionTransfer&&t.base===base&&t.partnerKey===partner);}
 function reset(p){const old=states.get(p);if(old?.baseStats){states.delete(p);st(p).baseStats=old.baseStats;}else states.delete(p);passes.delete(p);}
  W.__afkBiteCapMult=()=>typeof player!=='undefined'&&player?(value(player,'biteCap')||1):1;
 W.LineageClassCombat={activeAuras,acceptsAura,cast,reason,cooldown,cost,baseline,event,stats,reset,broken,state:st,mark,resource,passive,perform,team,companions,value,damage,vulnOf,extraHits,leechRate,mobState:ms,tIs,absoluteLock,shieldAmount,hitBonus,blockSuppression:t=>ms(t).suppression?.until>now()?ms(t).suppression.value:0};
 const orig=W.castSkill;W.castSkill=function(id){if(C.skills.has(id))return cast(id).ok;return orig.apply(this,arguments);};
 const recompute=W.recomputeStats;W.recomputeStats=function(){const out=recompute.apply(this,arguments);stats(player);return out;};
 const oldKill=W.killMob;W.killMob=function(i){const t=mapState.mobs[i],was=live(t)||t&&t.curHp<=0&&!t._dead;const out=oldKill.apply(this,arguments);if(was&&t&&!t.boss)for(const p of members())if(C.tree(p))st(p).resources.corpse=Math.min(3,N(st(p).resources.corpse)+1);return out;};
 const serialize=W.saveStateJson;W.saveStateJson=function(){const restored=[];for(const t of mapState.mobs||[]){if(!t)continue;for(const d of Object.values(ms(t).debuffs))if(!VIRTUAL.has(d.key)){t[d.key]-=d.value;restored.push([t,d]);}}try{const doc=JSON.parse(serialize.apply(this,arguments));if(Array.isArray(doc.p?.summonsV2))doc.p.summonsV2=doc.p.summonsV2.filter(x=>!x._classSpirit);return JSON.stringify(doc);}finally{for(const [t,d] of restored)t[d.key]+=d.value;}};
})(window);
