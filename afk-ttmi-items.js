/* 天堂透視鏡物品擴充。來源快照、排除理由與本作適配：docs/ttmi-items.md。
 * 加掛層：保留既有 ID／存檔，不覆寫原裝備平衡，不在載入時寫入存檔。
 * 讀取 afk-ttmi-items-data.js，應在套裝／變身／地圖擴充之後載入。
 */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T) T.register({ id:'ttmi-items', name:'亞丁古物與材料工坊', desc:'收錄可對應本作系統的透視鏡物品、配方與裂痕專用補給。', group:'遊戲內容' });
  function enabled() { return !T || T.enabled('ttmi-items'); }
  // Stored items must remain defined while this optional content is disabled.
  // Native loadGame purges unknown IDs from both inventory and shared storage.
  if (typeof DB === 'undefined' || !window.__AFK_TTMI_ITEMS) return;
  var data = window.__AFK_TTMI_ITEMS, sourceIds = Object.create(null), rows = Object.create(null), imported = [], riftIds = [];
  var SHOP = 'npc_ttmi_archive', WORKSHOP = 'npc_ttmi_workshop', TOWN = DB.towns.town_giran ? 'town_giran' : Object.keys(DB.towns)[0];
  var ATTR = ['str','dex','con','int','wis','cha'];
  var SPECIAL = ['ttmiStunResist','ttmiFreezeResist','ttmiStoneResist','ttmiSleepResist','ttmiHoldResist','ttmiPvpDmg','ttmiPvpDr','ttmiPotionFlat','ttmiFireDmg','ttmiWaterDmg','ttmiWindDmg','ttmiEarthDmg','ttmiMaxHpPct','ttmiMaxMpPct'];
  function key(s) { return String(s || '').replace(/\s+|[()（）]|套裝/g,'').replace(/裡|𥚃/g,'里').replace(/回覆/g,'回復').replace(/奇巖/g,'奇岩').replace(/鍊/g,'鏈').replace(/煉/g,'鍊').replace(/修練/g,'修煉').replace(/高侖/g,'高崙').replace(/範德/g,'范德'); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function finite(n) { return Number.isFinite(Number(n)) ? Number(n) : 0; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g,function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function playerReady() { return typeof player !== 'undefined' && player && player.cls && Array.isArray(player.inv); }
  function inRift() { return playerReady() && typeof state !== 'undefined' && state.riftRun && typeof mapState !== 'undefined' && mapState.current === 'rift_battle'; }
  function say(s, silent) { if (!silent && typeof logSys === 'function') logSys(s); }
  function refresh() { if (typeof calcStats === 'function') calcStats(); if (typeof renderTabs === 'function') renderTabs(true); if (typeof updateUI === 'function') updateUI(); }
  function save() { if (playerReady() && typeof saveGame === 'function') saveGame(); }
  function wrap(name, fn, off) {
    var old = window[name];
    if (typeof old !== 'function') return;
    window[name] = function () { if (!enabled()) return off ? off(old,this,Array.prototype.slice.call(arguments)) : old.apply(this,arguments); return fn(old,this,Array.prototype.slice.call(arguments)); };
  }
  var beforeNames = Object.create(null), iconByType = Object.create(null);
  Object.keys(DB.items).forEach(function(id) {
    var d = DB.items[id]; beforeNames[key(d.n)] = id;
    var slot = d.type + ':' + (d.slot || '');
    if (!iconByType[slot] && typeof getIconUrl === 'function') iconByType[slot] = getIconUrl(d);
  });
  data.aliases.forEach(function(r) { if (r.id === 'gold' || DB.items[r.id]) sourceIds[r.sourceId] = r.id; });
  data.items.forEach(function(r) {
    var oldId = beforeNames[key(r.n)];
    var id = oldId || r.id;
    sourceIds[r.sourceId] = id;
    if (oldId) return;
    var d = clone(r.def);
    d.ttmiSourceId = r.sourceId;
    d.c = d.c || (d.ttmiRiftOnly ? 'text-violet-300' : d.ttmiMaterial ? 'text-amber-200' : 'text-slate-200');
    d.img = d.img || iconByType[d.type + ':' + (d.slot || '')] || iconByType['pot:'] || '';
    DB.items[id] = d; rows[id] = r; imported.push(id);
    if (d.ttmiTags && typeof WEAPON_TAGS !== 'undefined') WEAPON_TAGS[id] = d.ttmiTags.slice();
    if (d.ttmiWeight != null && typeof ITEM_WEIGHTS !== 'undefined') ITEM_WEIGHTS[d.n] = d.ttmiWeight;
    if (d.ttmiRiftOnly) { riftIds.push(id); if (typeof WH_NO_STORE !== 'undefined' && WH_NO_STORE.indexOf(id) < 0) WH_NO_STORE.push(id); }
  });
  function resolve(sid) { return sourceIds[sid] || null; }
  var creditId = resolve(12039), crystalId = resolve(7102);
  function addNpc(id,n,title) {
    var town = DB.towns[TOWN]; if (!town) return;
    town.npcs = town.npcs || [];
    if (!town.npcs.some(function(x){return x.id === id;})) town.npcs.push({id:id,n:n,title:title,type:'shop',d:'遠方古物、補給與工藝在此相逢。'});
  }
  addNpc(SHOP,'古物商人 洛依','古物與遠行補給'); addNpc(WORKSHOP,'工匠 薩克','材料與古物製作');

  // True recipe counts/yields are retained. Acyclic insertion prevents the core
  // recursive auto-crafter from treating alternative conversions as free inputs.
  var recipes = typeof CRAFT_RECIPES !== 'undefined' ? (CRAFT_RECIPES[WORKSHOP] = CRAFT_RECIPES[WORKSHOP] || []) : [];
  var recipeSeen = Object.create(null), graph = Object.create(null), rejectedRecipes = [];
  if (typeof CRAFT_RECIPES !== 'undefined') Object.keys(CRAFT_RECIPES).forEach(function(npc) {
    CRAFT_RECIPES[npc].forEach(function(r) { (graph[r.result] = graph[r.result] || []).push.apply(graph[r.result], (r.req || []).map(function(x){return x.id;})); });
  });
  function reaches(from,to,seen) {
    if (from === to) return true; if (seen[from]) return false; seen[from] = true;
    return (graph[from] || []).some(function(n){return reaches(n,to,seen);});
  }
  function addRecipe(result, req, count, kind) {
    if (!result || !DB.items[result] || !req.length || !req.every(function(x){return (x.id === 'gold' || DB.items[x.id]) && Number.isSafeInteger(x.cnt) && x.cnt > 0;})) return false;
    var merged = Object.create(null); req.forEach(function(x){merged[x.id] = (merged[x.id] || 0) + x.cnt;});
    // Buying ingredients -> crafting -> selling must never print gold. New
    // workshop outputs are plain; the minimum gold charge exceeds that plain
    // output's resale price even before any ingredients are valued.
    var fee=kind==='refine'?0:Math.max(0,Math.ceil(finite(DB.items[result].p)*.375*Math.max(1,count||1))-(merged.gold||0));
    if(fee)merged.gold=(merged.gold||0)+fee;
    req = Object.keys(merged).map(function(id){return {id:id,cnt:merged[id]};});
    if (req.some(function(x){return reaches(x.id,result,Object.create(null));})) { rejectedRecipes.push({result:result,reason:'cycle'}); return false; }
    var sig = result + '|' + req.map(function(x){return x.id+':'+x.cnt;}).sort().join('|') + '|' + (count || 1);
    if (recipeSeen[sig]) return false; recipeSeen[sig] = true;
    recipes.push({result:result, req:req, yield:Math.max(1,Math.floor(count || 1)), ttmiRecipeKind:kind || 'source',ttmiServiceFee:fee});
    (graph[result] = graph[result] || []).push.apply(graph[result],req.map(function(x){return x.id;})); return true;
  }
  data.aliases.concat(data.items).forEach(function(r) {
    (r.recipes || []).forEach(function(v){ addRecipe(resolve(r.sourceId),v.parts.map(function(x){return {id:resolve(x.sourceId),cnt:x.count};}),v.yield,'source'); });
  });
  data.items.forEach(function(r) {
    // Other add-ons may already define the same material. Reuse that ID and
    // still install its optional workshop use without replacing its stats.
    var id = resolve(r.sourceId); if (!id || !DB.items[id]) return;
    if (r.refine && crystalId && id !== crystalId) addRecipe(crystalId,[{id:id,cnt:10},{id:'gold',cnt:100}],1,'refine');
    if (r.restore) addRecipe(resolve(r.restore.result),[{id:id,cnt:1},{id:resolve(r.restore.leaf),cnt:1},{id:'gold',cnt:1000}],1,'restore');
    var d = DB.items[id], sk = d.ttmiSkill && DB.skills[d.ttmiSkill];
    if (sk && sk.tier >= 1 && sk.tier <= 5 && resolve(622 + 2 * (sk.tier - 1)) && crystalId) addRecipe(id,[{id:resolve(622 + 2 * (sk.tier - 1)),cnt:1},{id:crystalId,cnt:Math.max(1,sk.tier * 10)},{id:'gold',cnt:1000}],1,'scribe');
  });
  if (typeof buildRecipeIndex === 'function') buildRecipeIndex();
  var workshopCrafting=0;
  wrap('doCraft',function(old,self,args){if(args[0]!==WORKSHOP)return old.apply(self,args);workshopCrafting++;try{return old.apply(self,args);}finally{workshopCrafting--;}},function(old,self,args){if(args[0]===WORKSHOP)return false;return old.apply(self,args);});
  wrap('gainItem',function(old,self,args){if(workshopCrafting)args[3]=true;return old.apply(self,args);});

  // Source monster names, project drop rates. Fixed total budgets keep a large
  // catalogue from multiplying the amount of loot per kill.
  var mobNames = Object.create(null), dropPools = Object.create(null);
  Object.keys(DB.mobs).forEach(function(id){var m=DB.mobs[id]; if (m && m.n) mobNames[key(m.n)] = m;});
  imported.forEach(function(id) {
    var d=DB.items[id]; if (d.ttmiRiftOnly || d.gmOnly) return;
    (rows[id].dropMobs || []).forEach(function(n) {
      var mob=mobNames[key(n)]; if (!mob || mob.race === '建築') return;
      var a=dropPools[mob.n] = dropPools[mob.n] || [];
      if (!a.some(function(x){return x.id===id;})) a.push({id:id,weight:d.ttmiMaterial?5:(d.type==='pot'?3:1),boss:!!mob.boss});
    });
  });
  var addedDrops = [];
  if (typeof MOB_DROPS !== 'undefined') Object.keys(dropPools).forEach(function(n) {
    var a=dropPools[n], total=a.reduce(function(s,x){return s+x.weight;},0), budget=a[0].boss?20:8;
    var dst=MOB_DROPS[n] = MOB_DROPS[n] || [];
    a.forEach(function(x){if (!dst.some(function(y){return y[0]===x.id;})) { var entry=[x.id,budget*x.weight/total]; dst.push(entry); addedDrops.push({mob:n,entry:entry}); }});
  });

  function equipped(p,fn) { if (!p || !p.eq) return; Object.keys(p.eq).forEach(function(slot){var e=p.eq[slot],d=e&&DB.items[e.id];if(e&&d)fn(e,d,slot);}); }
  function merge(to,from) { Object.keys(from || {}).forEach(function(k){if(k==='ttmiExpMult')to[k]=Math.max(to[k]||1,finite(from[k]));else to[k]=(to[k]||0)+finite(from[k]);}); }
  function conditional(e,d,p) {
    var out={}, tiers={}, en=Math.max(0,finite(e.en));
    (d.ttmiConditional || []).forEach(function(c){
      if (c.cls) { if(c.cls===p.cls)merge(out,c.stats);return; }
      if (en<c.minEn || en>c.maxEn) return;
      Object.keys(c.stats || {}).forEach(function(k){if(!tiers[k] || c.minEn>=tiers[k].min)tiers[k]={min:c.minEn,value:c.stats[k]};});
    });
    Object.keys(tiers).forEach(function(k){out[k]=(out[k]||0)+tiers[k].value;});
    return out;
  }
  function bonus(p) {
    var out={};
    equipped(p,function(e,d,slot){
      if (!d.ttmiSourceId) return;
      merge(out,conditional(e,d,p));
      SPECIAL.forEach(function(k){if(d[k])out[k]=(out[k]||0)+d[k];});
      if(d.ttmiExpMult)out.ttmiExpMult=Math.max(out.ttmiExpMult||1,d.ttmiExpMult);
      if(d.ttmiPvpDmgPerEn)out.ttmiPvpDmg=(out.ttmiPvpDmg||0)+Math.max(0,finite(e.en))*d.ttmiPvpDmgPerEn;
      if(d.ttmiPvpDrPerEn)out.ttmiPvpDr=(out.ttmiPvpDr||0)+Math.max(0,finite(e.en))*d.ttmiPvpDrPerEn;
      if(slot==='wpn' || slot==='offwpn') ['meleeDmg','rangedDmg','meleeHit','rangedHit','extraHit','magicHit','resFire','resWater','resWind','resEarth','ac','er'].forEach(function(k){if(d[k])out[k]=(out[k]||0)+d[k];});
    });
    var active=p && p.ttmiBuffs;
    if(active && p.buffs) Object.keys(active).forEach(function(family){
      if(!(p.buffs['ttmi_'+family]>0))return;var d=DB.items[active[family]];if(d&&d.ttmiBuff)merge(out,d.ttmiBuff);
    });
    return out;
  }
  var prevAttr=window.__afkAttrBoost;
  window.__afkAttrBoost=function(p,d){if(typeof prevAttr==='function')prevAttr.apply(this,arguments);if(!enabled())return;var b=bonus(p);ATTR.forEach(function(k){d[k]=(d[k]||0)+(b[k]||0);});};
  var prevStats=window.__afkTtmiStats;
  window.__afkTtmiStats=function(p,d){
    if(typeof prevStats==='function')prevStats.apply(this,arguments);if(!enabled())return;
    var b=bonus(p);
    Object.keys(b).forEach(function(k){
      if(ATTR.indexOf(k)>=0 || k.indexOf('ttmi')===0 || k==='potionBonus')return;
      if(k==='mhp'||k==='mmp')p[k]=(p[k]||0)+b[k];
      else if(k==='ac')d.ac-=b[k];
      else if(k==='mdmg')d.magicDmg=(d.magicDmg||0)+b[k];
      else if(k==='weightCap')d._miscWeightBonus=(d._miscWeightBonus||0)+b[k];
      else d[k]=(d[k]||0)+b[k];
    });
    if(p.buffs&&p.buffs.ttmi_blue>0){var extra=(d.wis>=12?d.wis-(p.ttmiBlueBase||10):1);var prior=p.buffs.blue>0&&typeof getWisBlueBonus==='function'?getWisBlueBonus(d.wis):0;d.mpR+=Math.max(0,extra-prior);}
    var soul=p.buffs&&p.buffs.sk_soul_up>0?20:0;
    if(b.ttmiMaxHpPct)p.mhp=Math.floor(p.mhp*(1+Math.max(soul,b.ttmiMaxHpPct)/100)/(1+soul/100));
    if(b.ttmiMaxMpPct)p.mmp=Math.floor(p.mmp*(1+Math.max(soul,b.ttmiMaxMpPct)/100)/(1+soul/100));
    var h=p.buffs&&p.buffs.ttmi_haste3>0?Math.max(1,finite(p.ttmiHaste3Factor)||1.15):1;
    if(h>1){d.aspd/=h;if(d.castLock)d.castLock/=h;if(d.supportCastLock)d.supportCastLock/=h;}
  };
  window.__afkTtmiExpMult=function(p){return enabled()?Math.max(1,bonus(p).ttmiExpMult||1):1;};
  wrap('playerEquipPotionBonusPct',function(old,self,args){return old.apply(self,args)+(playerReady()?bonus(player).potionBonus||0:0);});
  wrap('playerMoveDelayMultiplier',function(old,self,args){
    var r=old.apply(self,args);if(!playerReady())return r;
    var h=player.buffs.ttmi_haste3>0?Math.max(1,finite(player.ttmiHaste3Factor)||1.15):1;
    if(player.buffs.ttmi_walk2>0){var current=player.buffs.brave>0?1.33:(player.buffs.elfcookie>0?1.15:1);h*=Math.max(1,(finite(player.ttmiWalkFactor)||1)/current);}
    return r/h;
  });
  wrap('checkCanEquip',function(old,self,args){var it=args[0],d=it&&DB.items[it.id];if(d&&((d.ttmiMinLevel&&player.lv<d.ttmiMinLevel)||(d.ttmiMaxLevel&&player.lv>d.ttmiMaxLevel)))return false;return old.apply(self,args);});

  // Both pet slots may carry magic, protection, and experience bonuses. The
  // core already reads weapon hit/damage and armor AC/INT/WIS/MR once.
  wrap('petGearBonus',function(old,self,args){var r=old.apply(self,args),p=args[0],d=p&&p.eq&&p.eq.arm&&DB.items[p.eq.arm.id];if(d&&d.ttmiSourceId){r.dmg+=d.petDmg||0;r.hit+=d.petHit||0;}return r;});
  wrap('petDerive',function(old,self,args){
    var r=old.apply(self,args),p=args[0];if(!r||!p||!p.eq)return r;
    var w=p.eq.wpn&&DB.items[p.eq.wpn.id],a=p.eq.arm&&DB.items[p.eq.arm.id];
    if(w&&w.ttmiSourceId){r.ac-=w.petAc||0;r.mr+=w.petMr||0;r.skillFlat+=(w.petInt||0)+(w.petMdmg||0);r.mmpBonus+=(w.petWis||0)*5;r.mpRegBonus+=w.petWis||0;}
    if(a&&a.ttmiSourceId)r.skillFlat+=a.petMdmg||0;return r;
  });
  window.__afkTtmiPetExpMult=function(p){var mult=1;if(enabled()&&p&&p.eq)Object.keys(p.eq).forEach(function(s){var d=p.eq[s]&&DB.items[p.eq[s].id];if(d)mult=Math.max(mult,d.ttmiPetExpMult||1);});return mult;};

  // Add new resistance points to the same roll as existing equipment; rolling
  // a second independent chance would incorrectly turn 50+50 into only 75%.
  var resistanceActor=null;
  wrap('playerStatusResisted',function(old,self,args){var prev=resistanceActor;resistanceActor=player;try{return old.apply(self,args);}finally{resistanceActor=prev;}});
  wrap('allyStatusResisted',function(old,self,args){var prev=resistanceActor;resistanceActor=args[0];try{return old.apply(self,args);}finally{resistanceActor=prev;}});
  wrap('statusResistanceFromRoll',function(old,self,args){
    var fields={stun:'ttmiStunResist',freeze:'ttmiFreezeResist',paralyze:'ttmiStoneResist',stone:'ttmiStoneResist',sleep:'ttmiSleepResist',slow:'ttmiHoldResist',bind:'ttmiHoldResist'};
    var extra=resistanceActor?(bonus(resistanceActor)[fields[args[0]]]||0):0;
    if(extra>0){if(!(args[2]>0)&&!args[1]&&!args[3])args[4]=Math.random();args[2]=(args[2]||0)+extra;}
    return old.apply(self,args);
  });
  function isPvp(m){return !!(m&&(m.trollPlayer||m._pvpDuelFoe));}
  wrap('getPhysicalDmg',function(old,self,args){
    var r=old.apply(self,args);if(!r||!r.hit||!playerReady())return r;
    var b=bonus(player),m=args[1];if(isPvp(m))r.dmg=Math.max(1,r.dmg+(b.ttmiPvpDmg||0));
    ['Fire','Water','Wind','Earth'].forEach(function(k){var n=b['ttmi'+k+'Dmg']||0;if(n)r.dmg+=Math.max(0,Math.floor(n*(typeof elementCounterMult==='function'?elementCounterMult(k.toLowerCase(),m.e):1)));});
    return r;
  });
  var incomingActors=new WeakSet();
  function incoming(old,self,args,actorIndex) {
    var actor=actorIndex==null?player:args[actorIndex],mob=args[0],dr=actor&&actor.d&&actor.d.dr,extra=isPvp(mob)?bonus(actor).ttmiPvpDr||0:0;
    if(!actor||incomingActors.has(actor))return old.apply(self,args);
    var hpKey=actor.curHp!=null?'curHp':'hp',before=actor[hpKey];incomingActors.add(actor);
    if(extra&&actor.d)actor.d.dr=(actor.d.dr||0)+extra;
    var result;try{result=old.apply(self,args);}finally{if(extra&&actor.d)actor.d.dr=dr;incomingActors.delete(actor);}
    if(actor[hpKey]<before&&mob&&mob.curHp>0)equipped(actor,function(e,d){
      var cfg=d.ttmiReflect;if(cfg&&Math.random()*100<cfg.rate){mob.curHp-=cfg.dmg;if(typeof mobWake==='function')mobWake(mob);if(mob.curHp<=0&&typeof killMob==='function'){var at=mapState.mobs.indexOf(mob);if(at>=0)killMob(at);}}
    });return result;
  }
  wrap('enemyPhysicalAttack',function(o,s,a){return incoming(o,s,a,null);});
  wrap('applyMobMagic',function(o,s,a){return incoming(o,s,a,null);});
  wrap('enemyAttackAlly',function(o,s,a){return incoming(o,s,a,1);});
  wrap('applyMobMagicToAlly',function(o,s,a){return incoming(o,s,a,2);});

  function count(id) { return player.inv.reduce(function(s,it){return s+(it.id===id&&!it.lock?Math.max(0,finite(it.cnt)||1):0);},0); }
  function take(id,n) {
    if(count(id)<n)return false;
    for(var j=player.inv.length-1;j>=0&&n>0;j--){var it=player.inv[j];if(it.id!==id||it.lock)continue;var q=Math.min(n,it.cnt||1);it.cnt=(it.cnt||1)-q;n-=q;if(it.cnt<=0)player.inv.splice(j,1);}return true;
  }
  function give(id,n) { if(id==='gold')player.gold=(player.gold||0)+n;else gainItem(id,n,true,true); }
  function randomInt(lo,hi) { return lo+Math.floor((typeof lootRng==='function'?lootRng('ttmi-items'):Math.random())*(hi-lo+1)); }
  function canUse(it,d,silent) {
    if(!playerReady()||!it||!d||it.lock||!(it.cnt>0))return false;
    if(player.dead|| (typeof inAbsBarrier==='function'&&inAbsBarrier()))return false;
    if((d.ttmiMinLevel&&player.lv<d.ttmiMinLevel)||(d.ttmiMaxLevel&&player.lv>d.ttmiMaxLevel)){say('目前等級不符這件物品的使用條件。',silent);return false;}
    if(d.ttmiRiftOnly&&!inRift()){say('這件補給只能在時空裂痕中使用。',silent);return false;}
    if(typeof reqAllowsClass==='function'&&!reqAllowsClass(d,player.cls)){say('目前職業無法使用這件物品。',silent);return false;}
    return true;
  }
  function rememberRiftBuff(k) {
    if(!inRift())return;var m=player.ttmiRiftBuffs=player.ttmiRiftBuffs||{};
    if(!m[k])m[k]={before:player.buffs[k]||0,at:finite(state.ticks),poly:k==='poly'?clone(player.poly||null):null};
  }
  function putBuff(k,sec,rift){if(rift)rememberRiftBuff(k);else if(player.ttmiRiftBuffs)delete player.ttmiRiftBuffs[k];player.buffs[k]=sec;if(rift)player.ttmiRiftBuffs[k].value=sec;}
  function applyExtras(d,id) {
    if(d.ttmiBuff){var family=d.ttmiBuffFamily||'combat';player.ttmiBuffs=player.ttmiBuffs||{};player.ttmiBuffs[family]=id;putBuff('ttmi_'+family,d.dur,d.ttmiRiftOnly);}
    if(d.ttmiMpMin!=null)player.mp=Math.min(player.mmp,player.mp+randomInt(d.ttmiMpMin,d.ttmiMpMax));
    (d.ttmiHaste||[]).forEach(function(h){
      if(h.moveOnly){player.ttmiWalkFactor=h.mult;putBuff('ttmi_walk2',d.dur,d.ttmiRiftOnly);return;}
      if(h.stage===1)putBuff('haste',d.dur,d.ttmiRiftOnly);
      else if(h.stage===2){var k=h.mult>=1.3?'brave':'elfcookie';putBuff(k,d.dur,d.ttmiRiftOnly);player.buffs[k==='brave'?'elfcookie':'brave']=0;}
      else {player.ttmiHaste3Factor=h.mult;putBuff('ttmi_haste3',d.dur,d.ttmiRiftOnly);}
    });
    var acts=d.ttmiExtraActions||[];
    if(d.ttmiAction==='blue'||acts.indexOf('blue')>=0){player.ttmiBlueBase=d.ttmiBlueBase||8;putBuff('ttmi_blue',d.dur,d.ttmiRiftOnly);}
    if(d.ttmiAction==='thirdHaste'){player.ttmiHaste3Factor=1.15;putBuff('ttmi_haste3',d.dur,d.ttmiRiftOnly);}
    if(d.ttmiAction==='antidote'||acts.indexOf('antidote')>=0){['poison','venom','deadlyPoison','poisonDmg','poisonTick','poisonStacks','poisonUnit'].forEach(function(k){if(player.statuses&&player.statuses[k])player.statuses[k]=0;});}
  }
  function setPotionCooldown(d){player.ttmiPotionRemaining=Math.max(0.1,finite(d.ttmiPotionCooldown)||1);player.cds.pot=player.ttmiPotionRemaining;}
  function addPotionFlat(before){
    var flat=bonus(player).ttmiPotionFlat||0;if(!(flat>0)||!(player.hp>before))return;
    if(player.statuses){if(player.statuses.potionFrost>0)flat*=.5;if(player.statuses.foulWater>0)flat*=.5;}
    player.hp=Math.min(player.mhp,player.hp+Math.floor(flat));
  }
  function useCustom(it,d,silent) {
    var action=d.ttmiAction,id=it.id;
    if(!canUse(it,d,silent))return false;
    if(d.noUse)return false;
    if(action==='mp'&&((player.cds.pot||0)>0||(player.ttmiPotionRemaining||0)>0))return false;
    if(action==='poly'){
      var f=d.ttmiPolyForm&&typeof findPolyForm==='function'?findPolyForm(d.ttmiPolyForm):null;
      if(d.ttmiPolyForm&&(!f||player.lv<(f.form.lv||0))){say('尚未達到這個變身型態的開放等級。',silent);return false;}
      if(d.ttmiRiftOnly)rememberRiftBuff('poly');
      player.poly=f?makePolyState(f.form,f.color):getPolyState();putBuff('poly',d.dur,d.ttmiRiftOnly);
    } else if(action==='scroll') {
      if(silent)return false;var sk=DB.skills[d.ttmiSkill];if(!sk)return false;
      // Reuse the actual skill ID so its antidote/teleport/target branches work.
      // A synchronous temporary scroll definition removes only resource costs.
      var original=sk,granted=player.grantedSkills,copy=Object.assign({},sk,{mp:0,hpCost:0});delete copy.costItem;
      if(d.dur)copy.dur=d.dur;
      DB.skills[d.ttmiSkill]=copy;player.grantedSkills=(granted||[]).concat([d.ttmiSkill]);
      var ok;try{ok=castSkill(d.ttmiSkill);}finally{DB.skills[d.ttmiSkill]=original;player.grantedSkills=granted;}
      if(!ok)return false;
    } else if(action==='returnTown') {
      if(silent)return false;var oldMap=mapState.current;returnToTown();if(mapState.current===oldMap)return false;
    } else if(action==='exchange') {
      if(silent||!DB.items[d.ttmiResult])return false;give(d.ttmiResult,1);
    } else if(action==='box') {
      if(silent)return false;var row=rows[id],out=(row.contents||[]).filter(function(x){var dd=DB.items[resolve(x.sourceId)];return resolve(x.sourceId)&&!(dd&&(dd.ttmiRiftOnly||dd.gmOnly));});
      if(!out.length)return false;
      var ready=player.ttmiBoxes=player.ttmiBoxes||{};
      if(d.ttmiBoxCooldown&&ready[id]>Date.now()){say('封印尚未重新凝聚，請等待冷卻結束。',silent);return false;}
      if(row.contentsMode==='random')out=[out[randomInt(0,out.length-1)]];
      out.forEach(function(x){give(resolve(x.sourceId),randomInt(x.min,x.max));});
      if(d.ttmiBoxCooldown){ready[id]=Date.now()+d.ttmiBoxCooldown*1000;applyExtras(d,id);refresh();save();say('封印開啟，取得了其中的物品。',silent);return true;}
    } else if(['buff','mp','blue','thirdHaste','antidote'].indexOf(action)<0)return false;
    applyExtras(d,id);
    if(action==='mp'){
      if(d.ttmiMpMin==null)player.mp=Math.min(player.mmp,player.mp+randomInt(d.valMin||0,d.valMax||d.valMin||0));
      setPotionCooldown(d);
    }
    consume(it);refresh();save();say('使用了 '+esc(d.n)+'。',silent);return true;
  }
  wrap('useItem',function(old,self,args){
    if(!playerReady())return old.apply(self,args);
    var it=player.inv.find(function(x){return x.uid===args[0];}),d=it&&DB.items[it.id];
    if(!d)return old.apply(self,args);
    var hp=it.id.indexOf('potion_heal')>=0||it.id==='potion_strong'||it.id==='potion_ult'||it.id==='new_item_141';
    if(hp&&(player.ttmiPotionRemaining||0)>0)return;
    if(d.ttmiRiftOnly&&!inRift()){say('這件補給只能在時空裂痕中使用。',args[1]);return;}
    if(d.ttmiAction)return useCustom(it,d,args[1]);
    if(!d.ttmiSourceId){
      var q=it.cnt||1,normalHp=player.hp,normal=old.apply(self,args),left=player.inv.find(function(x){return x.uid===it.uid;});
      if(!left||(left.cnt||1)<q){if(d.eff&&player.ttmiRiftBuffs)delete player.ttmiRiftBuffs[d.eff];if(hp){addPotionFlat(normalHp);if(typeof updateUI==='function')updateUI();}}
      return normal;
    }
    if(!canUse(it,d,args[1]))return;
    if(d.ttmiControlledPoly&&!args[1]){rememberRiftBuff('poly');openPolySelect(it.uid);return;}
    var before=it.cnt||1,preHp=player.hp;
    if(d.ttmiRiftOnly&&d.eff)rememberRiftBuff(d.eff);
    var result=old.apply(self,args),after=player.inv.find(function(x){return x.uid===it.uid;});
    if(!after||(after.cnt||1)<before){
      if(!d.ttmiRiftOnly&&d.eff&&player.ttmiRiftBuffs)delete player.ttmiRiftBuffs[d.eff];
      if(d.ttmiHealPotion){setPotionCooldown(d);addPotionFlat(preHp);}
      applyExtras(d,it.id);refresh();
    }
    return result;
  },function(old,self,args){
    var it=playerReady()&&player.inv.find(function(x){return x.uid===args[0];}),d=it&&DB.items[it.id];
    if(d&&d.ttmiSourceId){say('亞丁古物與材料工坊目前停用，道具已保留。',args[1]);return false;}
    return old.apply(self,args);
  });
  wrap('confirmPolySelect',function(old,self,args){
    var it=playerReady()&&player.inv.find(function(x){return x.uid===args[0];}),d=it&&DB.items[it.id];
    if(!it||!d)return old.apply(self,args);
    if(d.ttmiRiftOnly&&!canUse(it,d,false)){closePolyModal();return;}
    if(d.ttmiRiftOnly)rememberRiftBuff('poly');
    var before=it.cnt||1,r=old.apply(self,args),after=player.inv.find(function(x){return x.uid===it.uid;});
    if(!d.ttmiRiftOnly&&(!after||(after.cnt||1)<before)&&player.ttmiRiftBuffs)delete player.ttmiRiftBuffs.poly;
    return r;
  },function(old,self,args){
    var it=playerReady()&&player.inv.find(function(x){return x.uid===args[0];}),d=it&&DB.items[it.id];
    if(d&&d.ttmiSourceId){say('亞丁古物與材料工坊目前停用，道具已保留。');return false;}
    return old.apply(self,args);
  });
  wrap('castSkill',function(old,self,args){
    var before={},bag=playerReady()&&player.ttmiRiftBuffs;Object.keys(bag||{}).forEach(function(k){before[k]=player.buffs[k];});
    var r=old.apply(self,args);
    if(r&&bag){var sk=DB.skills[args[0]];Object.keys(before).forEach(function(k){if(player.buffs[k]!==before[k]||(k==='haste'&&sk&&sk.haste))delete bag[k];});}
    return r;
  });

  function price(id,visiting) {
    var d=DB.items[id];if(!d||d.ttmiRiftOnly||d.gmOnly)return 0;
    var base=Math.max(1,Math.ceil(finite(d.p)*(d.ttmiMaterial?5:(['wpn','arm','acc'].indexOf(d.type)>=0?10:3))));
    var row=rows[id];if(!row||!row.contents)return base;
    visiting=visiting||{};if(visiting[id])return Infinity;visiting[id]=true;
    var sums=row.contents.map(function(x){var child=resolve(x.sourceId);return (child==='gold'?1:price(child,Object.assign({},visiting)))*x.max;});
    return Math.max(base,Math.ceil((row.contentsMode==='all'?sums.reduce(function(a,b){return a+b;},0):Math.max.apply(null,sums))*1.25));
  }
  var stock=imported.filter(function(id){return !DB.items[id].ttmiRiftOnly&&!DB.items[id].gmOnly;});
  var stockSet=Object.create(null);stock.forEach(function(id){stockSet[id]=true;});
  function acquisition(id){
    var d=DB.items[id];if(!d||d.gmOnly||!rows[id])return null;
    if(d.ttmiRiftOnly)return {rift:{mapId:'rift_battle',creditId:creditId,cost:d.ttmiCost||0,isCredit:id===creditId,entryCredits:10,normalCredits:1,bossCredits:10}};
    var cost=stockSet[id]?price(id):Infinity;
    return Number.isFinite(cost)?{shop:{npcId:SHOP,townId:TOWN,price:cost,discount:false}}:null;
  }
  // The native books build before add-ons. Add obtainable catalogue rows now,
  // without granting ownership or writing a save, so denominators survive a
  // reload and collecting a new material never creates a new surprise slot.
  var actualDrops=Object.create(null);
  if(typeof MOB_DROPS!=='undefined')Object.keys(MOB_DROPS).forEach(function(n){(MOB_DROPS[n]||[]).forEach(function(e){actualDrops[e[0]]=true;});});
  data.items.map(function(r){return resolve(r.sourceId);}).forEach(function(id){
    var d=DB.items[id];if(!d||d.gmOnly||(!acquisition(id)&&!actualDrops[id]))return;
    if(typeof equipCatKey==='function'&&typeof EQUIP_CAT_ITEMS!=='undefined'){
      // Native pet weapons use type acc, while the source classifies fangs as
      // armor. Both occupy the existing pet equipment category by their slot.
      var ek=(d.slot==='petwpn'||d.slot==='petarm')?'pet':equipCatKey(id,d);if(ek&&EQUIP_CAT_ITEMS[ek]&&!EQUIP_ITEM_CAT[id]){EQUIP_CAT_ITEMS[ek].push(id);EQUIP_ITEM_CAT[id]=ek;}
    }
    if(typeof miscCatKey==='function'&&typeof MISC_CAT_ITEMS!=='undefined'){
      var mk=miscCatKey(id,d);if(mk&&MISC_CAT_ITEMS[mk]&&!MISC_ITEM_CAT[id]){MISC_CAT_ITEMS[mk].push(id);MISC_ITEM_CAT[id]=mk;if(typeof OBTAINABLE_MISC!=='undefined')OBTAINABLE_MISC[id]=true;}
    }
  });
  function sortCollection(groups){Object.keys(groups).forEach(function(k){groups[k].sort(function(a,b){return finite(DB.items[a].p)-finite(DB.items[b].p)||String(DB.items[a].n).localeCompare(String(DB.items[b].n),'zh-Hant');});});}
  if(typeof EQUIP_CAT_ITEMS!=='undefined')sortCollection(EQUIP_CAT_ITEMS);
  if(typeof MISC_CAT_ITEMS!=='undefined')sortCollection(MISC_CAT_ITEMS);
  var catalogue={mode:'shop',page:0,query:'',kind:'all'}, PAGE=30;
  function atTown(){return playerReady()&&!player.dead&&typeof mapState!=='undefined'&&mapState.current===TOWN;}
  function catalogueRows(){
    var q=key(catalogue.query),a=catalogue.mode==='craft'?recipes.map(function(r,i){return {id:r.result,recipe:i};}):stock.map(function(id){return {id:id};});
    return a.filter(function(x){var d=DB.items[x.id];return d&&(!q||key(d.n).indexOf(q)>=0)&& (catalogue.kind==='all'||(catalogue.kind==='material'?d.ttmiMaterial:catalogue.kind==='pot'?d.type==='pot'||d.ttmiAction: d.type===catalogue.kind));});
  }
  function renderCatalogue(div) {
    if(!div)return;var a=catalogueRows(),pages=Math.max(1,Math.ceil(a.length/PAGE));catalogue.page=Math.max(0,Math.min(pages-1,catalogue.page));
    var h='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><input id="ttmi-search" aria-label="搜尋古物" placeholder="搜尋物品名稱" value="'+esc(catalogue.query)+'" style="color:#fff;background:#0f172a;padding:8px;border:1px solid #475569;border-radius:6px;min-width:120px;flex:1"><button onclick="AFK_TTMI_ITEMS.search()" class="btn">搜尋</button><button onclick="AFK_TTMI_ITEMS.mode(\''+(catalogue.mode==='shop'?'craft':'shop')+'\')" class="btn">'+(catalogue.mode==='shop'?'查看製作':'查看商品')+'</button></div>';
    h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';[['all','全部'],['wpn','武器'],['arm','防具'],['acc','飾品與娃娃'],['pot','補給'],['material','材料']].forEach(function(x){h+='<button class="btn" onclick="AFK_TTMI_ITEMS.kind(\''+x[0]+'\')"'+(catalogue.kind===x[0]?' style="color:#fcd34d"':'')+'>'+x[1]+'</button>';});h+='</div>';
    h+='<p class="text-slate-400 text-sm">'+(catalogue.mode==='craft'?'金幣需求含工資，成品不附詞綴；工坊會自動補製中間材料，鎖定物品不會被消耗。':'可直接購買，也可到工坊查看材料配方。')+'</p>';
    a.slice(catalogue.page*PAGE,(catalogue.page+1)*PAGE).forEach(function(x){
      var d=DB.items[x.id];h+='<div style="padding:12px 0;border-bottom:1px solid #334155"><b class="'+esc(d.c||'')+'">'+esc(d.n)+'</b><p style="font-size:13px;color:#94a3b8;margin:5px 0">'+esc(d.d||'')+'</p>';
      if(x.recipe!=null){var r=recipes[x.recipe];h+='<div class="text-amber-200 text-sm">需求：'+r.req.map(function(z){return esc(z.id==='gold'?'金幣':DB.items[z.id].n)+' ×'+z.cnt.toLocaleString();}).join('、')+' → 產出 '+r.yield+' 份</div><button class="btn" onclick="AFK_TTMI_ITEMS.craft('+x.recipe+')">製作 1 次</button>';}
      else {var cost=price(x.id);h+='<span class="text-amber-300">'+(Number.isFinite(cost)?cost.toLocaleString()+' 金幣':'僅可從怪物或製作取得')+'</span>';if(Number.isFinite(cost))h+=' <button class="btn" onclick="AFK_TTMI_ITEMS.buy(\''+x.id+'\',1)">購買 1 份</button> <button class="btn" onclick="AFK_TTMI_ITEMS.buy(\''+x.id+'\',10)">購買 10 份</button>';}
      h+='</div>';
    });
    h+='<div style="display:flex;justify-content:space-between;padding:12px 0"><button class="btn" onclick="AFK_TTMI_ITEMS.page(-1)">上一頁</button><span>'+(catalogue.page+1)+' / '+pages+' 頁</span><button class="btn" onclick="AFK_TTMI_ITEMS.page(1)">下一頁</button></div>';div.innerHTML=h;
  }
  function redrawCatalogue(){if(typeof document!=='undefined')renderCatalogue(document.getElementById('interaction-content'));}
  function openCatalogue(mode){if(!enabled()||!atTown())return;catalogue.mode=mode;catalogue.page=0;if(typeof openTownFloatWindow==='function')openTownFloatWindow(mode==='craft'?'工匠 薩克':'古物商人 洛依',mode==='craft'?'材料與古物製作':'古物與遠行補給',renderCatalogue);}
  function buy(id,qty){
    if(!enabled()||!atTown()||stock.indexOf(id)<0||DB.items[id].gmOnly||!Number.isInteger(qty)||qty<1||qty>100)return false;
    var total=price(id)*qty;if(!Number.isSafeInteger(total)||total<=0||(player.gold||0)<total){say('金幣不足。');return false;}
    player.gold-=total;give(id,qty);refresh();save();redrawCatalogue();return true;
  }
  function craft(idx){if(!enabled()||!atTown()||!Number.isInteger(idx)||!recipes[idx])return false;doCraft(WORKSHOP,idx,false);save();redrawCatalogue();return true;}
  wrap('interactNPC',function(old,self,args){if(args[0]===SHOP||args[0]===WORKSHOP){openCatalogue(args[0]===SHOP?'shop':'craft');return;}return old.apply(self,args);},function(old,self,args){if(args[0]===SHOP||args[0]===WORKSHOP){say('亞丁古物與材料工坊目前停用。');return false;}return old.apply(self,args);});
  wrap('renderUniversalCraft',function(old,self,args){if(args[1]===WORKSHOP){catalogue.mode='craft';renderCatalogue(args[0]);return;}return old.apply(self,args);});

  var riftLayer=null;
  function hideRiftSupplies(){var box=document.getElementById('ttmi-rift-supplies');if(box)box.remove();riftLayer=null;}
  function closeRiftSupplies(){var layer=riftLayer;riftLayer=null;if(layer&&window.AFK_UI)AFK_UI.closeLayer(layer);hideRiftSupplies();}
  function clearRift() {
    if(typeof document!=='undefined')closeRiftSupplies();
    if(!playerReady())return false;var before=player.inv.length;player.inv=player.inv.filter(function(it){return riftIds.indexOf(it.id)<0;});
    var buffs=player.ttmiRiftBuffs||{};
    Object.keys(buffs).forEach(function(k){var rec=buffs[k],elapsed=Math.max(0,(finite(state.ticks)-rec.at)/10);player.buffs[k]=Math.max(0,rec.before-elapsed);if(k==='poly'&&player.buffs[k]>0)player.poly=rec.poly;});
    delete player.ttmiRiftBuffs;delete player.ttmiRiftRunKey;
    if(typeof document!=='undefined'){var b=document.getElementById('ttmi-rift-button');if(b)b.remove();}
    return before!==player.inv.length||Object.keys(buffs).length>0;
  }
  function beginRift(){
    if(!enabled()||!inRift())return;var run=String(state.riftStartMs||'active');if(player.ttmiRiftRunKey===run){riftButton();return;}
    clearRift();player.ttmiRiftRunKey=run;give(creditId,10);say('裂痕守衛交付 10 枚戰勳。擊敗敵人可再取得戰勳，換取本場專用補給。');riftButton();
  }
  function riftButton(){
    if(!enabled()||typeof document==='undefined'||!inRift())return;var host=document.getElementById('battle-view');if(!host||document.getElementById('ttmi-rift-button'))return;
    var b=document.createElement('button');b.id='ttmi-rift-button';b.className='btn';b.textContent='裂痕補給';b.style.cssText='position:relative;z-index:25;color:#c4b5fd;margin:6px';b.onclick=openRiftSupplies;host.appendChild(b);
  }
  function renderRiftSupplies(){
    var body=document.getElementById('ttmi-rift-supplies-body');if(!body)return;
    var top=body.scrollTop,h='<p>可用戰勳：'+count(creditId)+'。補給與戰勳於離場後消失。</p>';
    riftIds.forEach(function(id){var d=DB.items[id];if(!d.ttmiCost)return;h+='<div style="border-bottom:1px solid #334155;padding:10px 0"><b>'+esc(d.n)+'</b><p style="font-size:13px;color:#94a3b8">'+esc(d.d)+'</p><button type="button" class="btn" data-rift-buy="'+esc(id)+'">'+d.ttmiCost+' 戰勳 · 兌換</button></div>';});body.innerHTML=h;body.scrollTop=top;
    body.querySelectorAll('[data-rift-buy]').forEach(function(b){b.onclick=function(){riftBuy(b.getAttribute('data-rift-buy'));};});
  }
  function openRiftSupplies(){
    if(!enabled()||!inRift()||typeof document==='undefined')return;
    if(document.getElementById('ttmi-rift-supplies')){renderRiftSupplies();return;}
    var box=document.createElement('div');box.id='ttmi-rift-supplies';box.style.cssText='position:fixed;inset:0;z-index:10001;background:#020617cf;color:#e2e8f0;display:flex;align-items:center;justify-content:center;padding:14px 12px 12px;box-sizing:border-box';
    box.innerHTML='<section class="ttmi-rift-dialog" role="dialog" aria-modal="true" aria-labelledby="ttmi-rift-title" style="width:min(620px,100%);max-height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:#0f172a;border:1px solid #8b5cf6;border-radius:12px;box-shadow:0 12px 40px #000b"><header style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;padding:14px 16px;border-bottom:1px solid #334155"><h3 id="ttmi-rift-title">裂痕補給</h3><button type="button" class="btn" data-rift-close>關閉</button></header><div id="ttmi-rift-supplies-body" style="min-height:0;overflow:auto;overscroll-behavior:contain;padding:12px 16px"></div></section>';
    box.onclick=function(e){if(e.target===box)closeRiftSupplies();};box.querySelector('[data-rift-close]').onclick=closeRiftSupplies;document.body.appendChild(box);
    if(window.AFK_TOGGLES&&AFK_TOGGLES.applyBannerPad)AFK_TOGGLES.applyBannerPad(box);
    else if(window.AFK_BANNER){AFK_BANNER.remeasure();box.style.paddingTop='calc(var(--orig-bar-h, 0px) + 14px)';}
    renderRiftSupplies();if(window.AFK_UI&&AFK_UI.openLayer)riftLayer=AFK_UI.openLayer(hideRiftSupplies);box.querySelector('[data-rift-close]').focus();
  }
  function riftBuy(id){
    if(!enabled()||!inRift()||riftIds.indexOf(id)<0)return false;var d=DB.items[id];if(!d.ttmiCost||!take(creditId,d.ttmiCost)){say('裂痕戰勳不足。');return false;}
    give(id,1);refresh();save();renderRiftSupplies();return true;
  }
  wrap('enterRiftMap',function(old,self,args){var r=old.apply(self,args);beginRift();return r;});
  function endRift(old,self,args){var active=inRift(),r=old.apply(self,args);if(active&&!state.riftRun){clearRift();refresh();}return r;}
  wrap('riftEndRun',endRift,endRift);
  wrap('killMob',function(old,self,args){var m=mapState&&mapState.mobs&&mapState.mobs[args[0]],eligible=inRift()&&m&&!m._dead&&!m._ttmiCreditGiven&&m.race!=='建築';var r=old.apply(self,args);if(eligible&&m._dead&&inRift()&&!m._ttmiCreditGiven){m._ttmiCreditGiven=true;give(creditId,m.boss?10:1);}return r;});
  function afterLoad(old,self,args){var r=old.apply(self,args);if(playerReady()){if(!inRift())clearRift();else if(enabled())beginRift();}return r;}
  wrap('loadGame',afterLoad,afterLoad);
  wrap('tick',function(old,self,args){
    var p=playerReady()?player:null,at=typeof state!=='undefined'?state.ticks:0,remain=p&&finite(p.ttmiPotionRemaining),r=old.apply(self,args);
    if(!p||p!==player)return r;var dt=Math.max(0,finite(state.ticks)-at)/10;
    if(remain>0){p.ttmiPotionRemaining=Math.max(0,remain-dt);p.cds.pot=p.ttmiPotionRemaining;}
    if(!inRift()&&p.ttmiRiftRunKey){if(clearRift())refresh();}
    if(!p.dead&&dt>0)[p].concat((p.allies||[]).filter(function(a){return a&&!a._downed;})).forEach(function(actor){
      var timers=actor.ttmiPeriodic=actor.ttmiPeriodic||{};
      equipped(actor,function(e,d){(d.ttmiPeriodic||[]).forEach(function(x,i){var k=e.uid+':'+i;timers[k]=(timers[k]||0)+dt;if(timers[k]>=x.sec){timers[k]%=x.sec;var field=x.stat==='hp'&&actor.curHp!=null?'curHp':x.stat;actor[field]=Math.min(actor[x.stat==='hp'?'mhp':'mmp'],actor[field]+x.amount);}});});
    });
    return r;
  },function(old,self,args){var r=old.apply(self,args);if(playerReady()&&!inRift()&&player.ttmiRiftRunKey){if(clearRift())refresh();}return r;});
  if(typeof BUFF_NAMES!=='undefined')Object.assign(BUFF_NAMES,{ttmi_food:'料理加持',ttmi_combat:'戰鬥補給',ttmi_exp:'歷練加持',ttmi_blue:'魔力湧泉',ttmi_haste3:'三段加速',ttmi_walk2:'疾行加持'});

  function syncAvailability(){
    var on=enabled(),town=DB.towns[TOWN];
    if(on){addNpc(SHOP,'古物商人 洛依','古物與遠行補給');addNpc(WORKSHOP,'工匠 薩克','材料與古物製作');}
    else if(town&&town.npcs)town.npcs=town.npcs.filter(function(n){return n.id!==SHOP&&n.id!==WORKSHOP;});
    if(typeof CRAFT_RECIPES!=='undefined')CRAFT_RECIPES[WORKSHOP]=on?recipes:[];
    if(typeof MOB_DROPS!=='undefined')addedDrops.forEach(function(x){
      var list=MOB_DROPS[x.mob]||(MOB_DROPS[x.mob]=[]),at=list.indexOf(x.entry);
      if(on){if(at<0&&!list.some(function(e){return e[0]===x.entry[0];}))list.push(x.entry);}
      else if(at>=0)list.splice(at,1);
    });
    if(typeof buildRecipeIndex==='function')buildRecipeIndex();
    if(!on&&typeof document!=='undefined'){closeRiftSupplies();var b=document.getElementById('ttmi-rift-button');if(b)b.remove();}
  }
  syncAvailability();
  if(T&&typeof T.set==='function'){
    var oldToggle=T.set;
    T.set=function(id,on){var r=oldToggle.apply(this,arguments);if(id==='ttmi-items'){
      syncAvailability();if(enabled()&&inRift())beginRift();
      if(playerReady())refresh();if(window.AFK_DEX_API&&AFK_DEX_API.refresh)AFK_DEX_API.refresh();
    }return r;};
  }

  window.AFK_TTMI_ITEMS={
    sourceIds:sourceIds,items:imported,recipes:recipes,source:data,resolve:resolve,bonus:bonus,conditional:conditional,price:price,buy:buy,craft:craft,riftBuy:riftBuy,enabled:enabled,
    acquisition:acquisition,shopStock:function(){return stock.slice();},
    beginRift:beginRift,clearRift:clearRift,inRift:inRift,openRift:openRiftSupplies,closeRift:closeRiftSupplies,
    coverage:function(){return {registered:imported.length,catalogueCandidates:data.items.length,reusedCandidates:data.items.filter(function(r){return resolve(r.sourceId)!==r.id;}).map(function(r){return {sourceId:r.sourceId,id:resolve(r.sourceId),n:r.n};}),sourceItems:data.sourceItems,sourcePages:data.sourcePages,recipes:recipes.length,dropMobs:Object.keys(dropPools).length,riftItems:riftIds.length,rejectedRecipes:rejectedRecipes.slice()};},
    mode:function(m){if(!enabled()||!atTown())return;catalogue.mode=m==='craft'?'craft':'shop';catalogue.page=0;redrawCatalogue();},
    search:function(){if(!enabled()||!atTown())return;var el=document.getElementById('ttmi-search');catalogue.query=el?el.value:'';catalogue.page=0;redrawCatalogue();},
    kind:function(k){if(!enabled()||!atTown())return;catalogue.kind=k;catalogue.page=0;redrawCatalogue();},
    page:function(step){if(!enabled()||!atTown())return;catalogue.page+=step;redrawCatalogue();}
  };
  console.log('[AFK-ttmi-items] '+imported.length+' 件物品、'+recipes.length+' 條配方、'+riftIds.length+' 件裂痕補給已登錄。');
})();
