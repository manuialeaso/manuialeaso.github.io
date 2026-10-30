/* 天堂透視鏡物品擴充。來源快照、排除理由與本作適配：docs/ttmi-items.md。
 * 加掛層：保留既有 ID／存檔，不覆寫原裝備平衡，不在載入時寫入存檔。
 * 讀取 afk-ttmi-items-data.js，應在套裝／變身／地圖擴充之後載入。
 */
(function () {
  'use strict';
  var T = window.AFK_TOGGLES;
  if (T) T.register({ id:'ttmi-items', name:'亞丁古物與材料工坊', desc:'亞丁古物商人洛依、工匠薩克與時空裂痕補給。', group:'遊戲內容' });
  function enabled() { return !T || T.enabled('ttmi-items'); }
  // Stored items must remain defined while this optional content is disabled.
  // Native loadGame purges unknown IDs from both inventory and shared storage.
  if (typeof DB === 'undefined' || !window.__AFK_TTMI_ITEMS) return;
  var data = window.__AFK_TTMI_ITEMS, sourceIds = Object.create(null), rows = Object.create(null), imported = [], riftIds = [];
  var SHOP = 'npc_ttmi_archive', WORKSHOP = 'npc_ttmi_workshop', TOWN = DB.towns.town_giran ? 'town_giran' : Object.keys(DB.towns)[0];
  // 洛依搬到亞丁（玩家 2026-10-27：奇岩 NPC 太擠），工匠薩克留在奇岩
  var SHOP_TOWN = DB.towns.town_aden ? 'town_aden' : TOWN, townOf = function (id) { return id === SHOP ? SHOP_TOWN : TOWN; };
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
  var beforeNames = Object.create(null), iconByType = Object.create(null), iconBySlot = Object.create(null), coreKey2 = Object.create(null);
  // 名稱比對時連「?」「·」「．」這類間隔號都忽略：透視鏡的「真?冥皇執行劍」＝本作的「真．冥皇執行劍」
  var key2 = function(n){ return key(n).replace(/[?？·‧・．.]/g,''); };
  Object.keys(DB.items).forEach(function(id) {
    var d = DB.items[id]; beforeNames[key(d.n)] = id; coreKey2[key2(d.n)] = id;
    var slot = d.type + ':' + (d.slot || '');
    if (!iconByType[slot] && typeof getIconUrl === 'function') iconByType[slot] = getIconUrl(d);
    if (d.slot && !iconBySlot[d.slot] && typeof getIconUrl === 'function') iconBySlot[d.slot] = getIconUrl(d);
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
    d.img = d.img || (window.__AFK_TTMI_ICONS && window.__AFK_TTMI_ICONS[d.n]) || iconByType[d.type + ':' + (d.slot || '')] || (d.slot && iconBySlot[d.slot]) || iconByType['pot:'] || '';   // 同部位的圖優先於藥水圖（黃金之牙原本變成紅色藥水）
    // 跟本作物品同名（只差間隔號）＝重複品：定義保留（舊存檔），但不賣、不掉、不進配方與獎池（玩家 2026-10-27）
    var dupOf = coreKey2[key2(d.n)]; if (dupOf && dupOf !== id) { d.ttmiDup = dupOf; d.ttmiEvent = true; }
    DB.items[id] = d; rows[id] = r; imported.push(id);
    if (d.ttmiTags && typeof WEAPON_TAGS !== 'undefined') WEAPON_TAGS[id] = d.ttmiTags.slice();
    if (d.ttmiWeight != null && typeof ITEM_WEIGHTS !== 'undefined') ITEM_WEIGHTS[d.n] = d.ttmiWeight;
    if (d.ttmiRiftOnly) { riftIds.push(id); if (typeof WH_NO_STORE !== 'undefined' && WH_NO_STORE.indexOf(id) < 0) WH_NO_STORE.push(id); }
  });
  function resolve(sid) { return sourceIds[sid] || null; }
  // 活動限定物品（週年、萬聖節、聖誕、情人節、粽子、月餅…，名稱標「(活動)」的也算）：當時天堂的期間限定活動才有，不是常駐物品。
  //   玩家 2026-10-27：移除——不賣、不掉、不進配方與獎池；定義保留，舊存檔裡已有的不會消失。
  var EVENT_RE=/週年|周年|萬聖|聖誕|情人|年糕|粽|月餅|南瓜|雪人|福袋|紀念|活動|陸版|VIP|登入禮|商城/;   // 陸版／VIP／登入禮／商城＝特殊版本限定，同活動品處理（玩家 2026-10-27）
  imported.forEach(function(id){var d=DB.items[id];if(EVENT_RE.test(d.n||''))d.ttmiEvent=true;});
  // 玩家 2026-10-27：「封印的 +8 破壞鋼爪」這類名字寫著強化值、開出來卻是 +0 武器的封印箱 → 移除（不賣、不掉、不做；舊存檔已有的不消失）
  imported.forEach(function(id){var d=DB.items[id];if(d.ttmiAction==='box'&&/\+\s*\d+/.test(d.n||'')){d.ttmiEvent=true;d.ttmiRetired=true;d.ttmiFakePlus=true;}});
  var isEvent=function(id){var d=DB.items[id];return !!(d&&d.ttmiEvent);};
  // 果汁原本借用紅色藥水圖示（玩家 2026-10-27：圖片錯誤）→ 改用飲料瓶
  imported.forEach(function(id){var d=DB.items[id];if(/汁$/.test(d.n||'')&&/紅色藥水/.test(d.img||''))d.img='assets/icons/items/蘑菇汁.png';});
  // 三種果汁原本跟治癒藥水一模一樣（玩家 2026-10-27：功能類似）→ 各給自己的效果（補血量不變）
  var JUICE={'蘋果汁':{mp:[5,10],d:'恢復 10～20 HP，同時恢復 5～10 MP；藥水冷卻 1.03 秒。'},
    '橘子汁':{buff:{mpR:2},dur:300,d:'恢復 10～20 HP；之後 5 分鐘 MP 自然恢復 +2（料理類增益，可以和其他料理疊加）。'},
    '香蕉汁':{buff:{hpR:3},dur:300,d:'恢復 10～20 HP；之後 5 分鐘 HP 自然恢復 +3（料理類增益，可以和其他料理疊加）。'}};
  imported.forEach(function(id){var d=DB.items[id],j=JUICE[String(d.n||'').replace(/\s+/g,'')];if(!j||d.ttmiEvent)return;
    if(j.mp){d.ttmiMpMin=j.mp[0];d.ttmiMpMax=j.mp[1];}
    if(j.buff){d.ttmiBuff=j.buff;d.ttmiBuffFamily='food';d.dur=j.dur;}
    d.d=j.d;});
  var creditId = resolve(12039), crystalId = resolve(7102), leafId = resolve(14889);
  var SHOP_TITLE = '藥水與增益補給';
  var NPC_D = { '古物商人 洛依': '走遍亞丁各地的古物商人，貨架上只擺藥水、料理與各種增益補給。', '工匠 薩克': '手指被爐火燻黑的老工匠，能把旅人帶回的零碎材料打造成古物。' };
  function addNpc(id,n,title) {
    var town = DB.towns[townOf(id)]; if (!town) return;
    town.npcs = town.npcs || [];
    if (!town.npcs.some(function(x){return x.id === id;})) town.npcs.push({id:id,n:n,title:title,type:'shop',d:NPC_D[n]||'遠方古物、補給與工藝在此相逢。'});
  }
  addNpc(SHOP,'古物商人 洛依',SHOP_TITLE); addNpc(WORKSHOP,'工匠 薩克','材料與古物製作');

  // True recipe counts/yields are retained. Acyclic insertion prevents the core
  // recursive auto-crafter from treating alternative conversions as free inputs.
  var recipes = typeof CRAFT_RECIPES !== 'undefined' ? (CRAFT_RECIPES[WORKSHOP] = CRAFT_RECIPES[WORKSHOP] || []) : [];
  var recipeSeen = Object.create(null), graph = Object.create(null), rejectedRecipes = [];
  var otherCraft = Object.create(null);
  if (typeof CRAFT_RECIPES !== 'undefined') Object.keys(CRAFT_RECIPES).forEach(function(npc){ if (npc === WORKSHOP) return; (CRAFT_RECIPES[npc] || []).forEach(function(r){ if (r && r.result) otherCraft[r.result] = 1; }); });
  // 本作原有、而且已經有商店賣或怪物會掉的物品（安特的水果、精靈餅乾、魔法寶石、精靈玉…）也不放進工匠薩克（玩家 2026-10-27）；
  //   「失去氣息的古物復原」例外，那是頭目裝備的另一條路
  var coreHave = Object.create(null);
  try { if (typeof SHOP_LISTS !== 'undefined') Object.keys(SHOP_LISTS).forEach(function(k){ (SHOP_LISTS[k] || []).forEach(function(e){ var id = typeof e === 'string' ? e : (e && (e.id || e[0])); if (id) coreHave[id] = 1; }); }); } catch (e) {}
  try { if (typeof MOB_DROPS !== 'undefined') Object.keys(MOB_DROPS).forEach(function(n){ (MOB_DROPS[n] || []).forEach(function(e){ if (e && e[0]) coreHave[e[0]] = 1; }); }); } catch (e) {}
  if (typeof CRAFT_RECIPES !== 'undefined') Object.keys(CRAFT_RECIPES).forEach(function(npc) {
    CRAFT_RECIPES[npc].forEach(function(r) { (graph[r.result] = graph[r.result] || []).push.apply(graph[r.result], (r.req || []).map(function(x){return x.id;})); });
  });
  function reaches(from,to,seen) {
    if (from === to) return true; if (seen[from]) return false; seen[from] = true;
    return (graph[from] || []).some(function(n){return reaches(n,to,seen);});
  }
  var FEE_MIN=50000;
  function addRecipe(result, req, count, kind) {
    if (!result || !DB.items[result] || !req.length || !req.every(function(x){return (x.id === 'gold' || DB.items[x.id]) && Number.isSafeInteger(x.cnt) && x.cnt > 0;})) return false;
    if (isEvent(result) || req.some(function(x){return isEvent(x.id);})) return false;   // 活動物品不進配方
    if (kind !== 'refine' && kind !== 'scribe' && otherCraft[result]) return false;
    if (kind === 'source' && !rows[result]) return false;   // 本作原有物品一律不在工匠薩克做（玩家 2026-10-27：滅魔裝、暗黑系武器…本作 NPC 都有處理）；復原例外   // 本作已有 NPC 能做的，不重複放進工匠薩克（玩家 2026-10-27）
    // 玩家 2026-10-27：做出裝備或本作原有物品（頭目裝備、龍之心、進化果實…）的配方，材料數量 ×2（金幣不變）
    var rd = DB.items[result], hard = kind !== 'refine' && kind !== 'scribe' && rd && (['wpn','arm','acc'].indexOf(rd.type) >= 0 || !rows[result]);
    if (hard) req = req.map(function(x){return x.id === 'gold' ? x : {id:x.id, cnt:x.cnt * 2};});
    var merged = Object.create(null); req.forEach(function(x){merged[x.id] = (merged[x.id] || 0) + x.cnt;});
    // Buying ingredients -> crafting -> selling must never print gold. New
    // workshop outputs are plain; the minimum gold charge exceeds that plain
    // output's resale price even before any ingredients are valued.
    // 工錢（玩家 2026-10-27：製作統一在薩克，工錢隨難度提高，最低 5 萬）：
    //   成品價值 v＝單價×產出數量；一般配方 v×0.5、困難配方（裝備或本作物品）v×1，取到千位、至少 50,000，加在原本配方的金幣上。
    var v=finite(DB.items[result].p)*Math.max(1,count||1),fee=Math.max(FEE_MIN,Math.ceil(v*(hard?1:.5)/1000)*1000);
    merged.gold=(merged.gold||0)+fee;
    req = Object.keys(merged).map(function(id){return {id:id,cnt:merged[id]};});
    if (req.some(function(x){return reaches(x.id,result,Object.create(null));})) { rejectedRecipes.push({result:result,reason:'cycle'}); return false; }
    var sig = result + '|' + req.map(function(x){return x.id+':'+x.cnt;}).sort().join('|') + '|' + (count || 1);
    if (recipeSeen[sig]) return false; recipeSeen[sig] = true;
    recipes.push({result:result, req:req, yield:Math.max(1,Math.floor(count || 1)), ttmiRecipeKind:kind || 'source',ttmiServiceFee:fee,ttmiHard:!!hard});
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
  // 玩家 2026-10-27：同一成品、同一組材料只差數量的配方（水之支配者＝水之印記 ×10／100／200／500）濃縮成一個，取中間那個（支配者＝200 個印記）
  (function(){var groups=Object.create(null);recipes.forEach(function(r,i){var sig=r.result+'|'+r.req.filter(function(q){return q.id!=='gold';}).map(function(q){return q.id;}).sort().join(',');(groups[sig]=groups[sig]||[]).push(i);});
    var drop=Object.create(null);Object.keys(groups).forEach(function(k){var g=groups[k];if(g.length<2)return;var tot=function(i){return recipes[i].req.reduce(function(s,q){return s+(q.id==='gold'?0:q.cnt);},0);};g.sort(function(a,b){return tot(a)-tot(b);});var keep=g[Math.floor(g.length/2)];g.forEach(function(i){if(i!==keep)drop[i]=1;});});
    for(var i=recipes.length-1;i>=0;i--)if(drop[i])recipes.splice(i,1);})();
  if (typeof buildRecipeIndex === 'function') buildRecipeIndex();
  var workshopCrafting=0;
  wrap('doCraft',function(old,self,args){if(args[0]!==WORKSHOP)return old.apply(self,args);workshopCrafting++;try{return old.apply(self,args);}finally{workshopCrafting--;}},function(old,self,args){if(args[0]===WORKSHOP)return false;return old.apply(self,args);});
  wrap('gainItem',function(old,self,args){if(workshopCrafting)args[3]=true;return old.apply(self,args);});

  // Source monster names, project drop rates. Fixed total budgets keep a large
  // catalogue from multiplying the amount of loot per kill.
  var mobNames = Object.create(null), dropPools = Object.create(null);
  Object.keys(DB.mobs).forEach(function(id){var m=DB.mobs[id]; if (m && m.n) mobNames[key(m.n)] = m;});
  // 「雜項素材」＝原本只能拿去精煉成魔法結晶體、沒有其他用途的素材（綠色布料、麵粉、各種靈魂…）。
  //   玩家 2026-10-27：改成古物學者委託（afk-junkquest）的交付材料，依掉落怪物的等級分三階：
  //   新手（Lv60 以下的怪）／中階（Lv61～84）／高階（Lv85 以上或頭目）。洛依不賣，只能打怪取得。
  //   透視鏡沒寫掉落怪物的，依序平均分給該階的一般怪（每隻最多 3 種）。
  var junkUse=Object.create(null);
  recipes.forEach(function(r){if(r.ttmiRecipeKind!=='refine')r.req.forEach(function(q){junkUse[q.id]=1;});});
  if(typeof CRAFT_RECIPES!=='undefined')Object.keys(CRAFT_RECIPES).forEach(function(n){if(n===WORKSHOP)return;(CRAFT_RECIPES[n]||[]).forEach(function(r){(r.req||[]).forEach(function(q){junkUse[q.id]=1;});});});
  var junk=Object.create(null),junkTier=Object.create(null);imported.forEach(function(id){var d=DB.items[id];if(d.ttmiMaterial&&!junkUse[id]&&!d.ttmiRiftOnly&&!d.gmOnly&&!d.ttmiEvent)junk[id]=1;});
  var srcLv=Object.create(null);
  var tierOfLv=function(lv,boss){return boss||lv>=85?3:lv>60?2:1;};
  imported.forEach(function(id) {
    var d=DB.items[id]; if (d.ttmiRiftOnly || d.gmOnly || d.ttmiEvent || id === leafId) return;   // 生命之葉另外處理（見 killMob）
    (rows[id].dropMobs || []).forEach(function(n) {
      var mob=mobNames[key(n)]; if (!mob || mob.race === '建築') return;
      var a=dropPools[mob.n] = dropPools[mob.n] || [];
      if (!a.some(function(x){return x.id===id;})) a.push({id:id,weight:d.ttmiMaterial?5:(d.type==='pot'?3:1),boss:!!mob.boss});
      if (junk[id]) junkTier[id]=Math.min(junkTier[id]||9,tierOfLv(mob.lv||1,!!mob.boss));
      var sl=srcLv[id];if(!sl||(mob.lv||1)<sl.lv)srcLv[id]={lv:mob.lv||1,boss:!!mob.boss};
    });
  });
  // 指定來源（玩家 2026-10-29：封印的克特套裝箱子不該在新手區，至少要在黑騎士團身上）
  var THEMED=Object.create(null);
  (function(){
    var THEME={'封印的克特套裝箱子':{re:/^(黑騎士|黑騎士搜索隊|精英黑騎士|黑騎士隊長|暗黑黑騎士|邪惡的黑騎士|黑暗的黑騎士)$/,tier:1}};
    Object.keys(junk).forEach(function(id){var th=THEME[DB.items[id].n];if(!th)return;var hit=0;
      Object.keys(DB.mobs).forEach(function(k){var m=DB.mobs[k];if(!m||!m.n||!th.re.test(m.n)||!MOB_DROPS[m.n])return;var a=dropPools[m.n]=dropPools[m.n]||[];
        Object.keys(dropPools).forEach(function(n){if(!th.re.test(n))dropPools[n]=dropPools[n].filter(function(x){return x.id!==id;});});
        if(!a.some(function(x){return x.id===id;})){a.push({id:id,weight:5,boss:!!m.boss});hit++;}});
      if(hit){junkTier[id]=th.tier;THEMED[id]=1;Object.keys(dropPools).forEach(function(n){if(!dropPools[n].length)delete dropPools[n];});}});
  })();
  // 玩家 2026-10-29：「集字遊戲[…]」整個系列都是週年活動的集字道具（只有 [週年] 那一張名字裡有「週年」被擋到）→ 全系列除役：
  //   不掉、不賣、不進委託；但仍在分配清單裡佔位置，其他素材分到哪些怪才不會跟著位移。舊存檔裡已有的不會消失。
  var RETIRED_JUNK=Object.create(null);
  Object.keys(junk).forEach(function(id){var d=DB.items[id];if(/^集字遊戲/.test(d.n||'')){RETIRED_JUNK[id]=1;d.ttmiEvent=true;d.ttmiRetired=true;d.d=String(d.d||'').replace(/\n【古物學者委託[^】]*】[^\n]*/,'')+'（週年活動的集字道具，已除役：不再掉落，古物學者也不收。）';}});
  (function(){
    var orphan=Object.keys(junk).filter(function(id){return !junkTier[id]||THEMED[id];}).sort();   // 指定來源的也留在清單裡佔位置，其他素材的分配才不會跟著位移
    if(!orphan.length||typeof MOB_DROPS==='undefined')return;
    var band=[null,[],[],[]];
    Object.keys(DB.mobs).forEach(function(k){var m=DB.mobs[k];if(!m||!m.n||m.boss||m.race==='建築'||!MOB_DROPS[m.n])return;band[tierOfLv(m.lv||1,false)].push(m);});
    for(var t=1;t<=3;t++)band[t].sort(function(a,b){return (a.lv||0)-(b.lv||0)||(a.n<b.n?-1:1);});
    var cursor=[0,0,0,0];
    orphan.forEach(function(id,i){
      if(THEMED[id]||RETIRED_JUNK[id]){cursor[1+(i%3)]+=3;return;}   // 佔住原本的位置（除役的不分配）
      var t=1+(i%3),list=band[t];if(!list.length)return;junkTier[id]=t;
      for(var k=0;k<3;k++){var m=list[cursor[t]++%list.length],a=dropPools[m.n]=dropPools[m.n]||[];if(!a.some(function(x){return x.id===id;}))a.push({id:id,weight:5,boss:false});}
    });
  })();
  Object.keys(RETIRED_JUNK).forEach(function(id){delete junk[id];delete junkTier[id];Object.keys(dropPools).forEach(function(n){dropPools[n]=dropPools[n].filter(function(x){return x.id!==id;});if(!dropPools[n].length)delete dropPools[n];});});
  var addedDrops = [];
  if (typeof MOB_DROPS !== 'undefined') Object.keys(dropPools).forEach(function(n) {
    var a=dropPools[n], total=a.reduce(function(s,x){return s+x.weight;},0), budget=a[0].boss?20:8;
    var dst=MOB_DROPS[n] = MOB_DROPS[n] || [];
    a.forEach(function(x){if (!dst.some(function(y){return y[0]===x.id;})) { var entry=[x.id,budget*x.weight/total]; dst.push(entry); addedDrops.push({mob:n,entry:entry}); }});
  });
  // 玩家 2026-10-29：低階區域掉的「封印的…」（換魔法結晶體用）提煉要 100 個、掉落率固定 1%
  (function(){
    Object.keys(junk).forEach(function(id){var d=DB.items[id];if(!/^封印的/.test(d.n||'')||junkTier[id]!==1)return;
      d.ttmiSealedLow=true;d.d=String(d.d||'').replace('每 10 份材料','每 100 份材料');
      recipes.forEach(function(r){if(r.ttmiRecipeKind==='refine'&&r.req.some(function(q){return q.id===id;}))r.req.forEach(function(q){if(q.id===id)q.cnt=100;});});
      addedDrops.forEach(function(x){if(x.entry[0]===id){x.entry[1]=1;x.fixed=true;}});});
  })();
  // 玩家 2026-10-29 16:24：材料工坊提煉魔法結晶體，依「掉落怪物的最低等級」分三段：
  //   Lv30 以下（<30）：100 個、金幣照舊；Lv30～59：50 個、金幣 ×1.5；Lv60 以上：10 個、金幣 ×2（金幣＝原本的 100＋工錢）。沒有怪掉的（只能買或做）維持 10 個。
  //   上面低階「封印的…」的 100 個是下限（不會因為這條變少）。
  var REFINE_TIER=[[30,100,1],[60,50,1.5],[1e9,10,2]];
  var refineCost=Object.create(null);
  (function(){
    if(typeof MOB_DROPS==='undefined')return;
    var lvOf=Object.create(null);Object.keys(DB.mobs).forEach(function(k){var m=DB.mobs[k];if(m&&m.n&&m.race!=='建築'){var v=m.lv||1;if(lvOf[m.n]==null||v<lvOf[m.n])lvOf[m.n]=v;}});
    var minLv=Object.create(null);Object.keys(MOB_DROPS).forEach(function(n){var lv=lvOf[n];if(lv==null)return;(MOB_DROPS[n]||[]).forEach(function(e){if(minLv[e[0]]==null||lv<minLv[e[0]])minLv[e[0]]=lv;});});
    recipes.forEach(function(r){if(r.ttmiRecipeKind!=='refine')return;var mat=r.req.find(function(q){return q.id!=='gold';});if(!mat||minLv[mat.id]==null)return;
      var lv=minLv[mat.id],t=REFINE_TIER.find(function(x){return lv<x[0];}),d=DB.items[mat.id];
      var cnt=d&&d.ttmiSealedLow?Math.max(100,t[1]):t[1],gold=0;mat.cnt=cnt;r.req.forEach(function(q){if(q.id==='gold'){q.cnt=Math.round(q.cnt*t[2]);gold=q.cnt;}});
      refineCost[mat.id]={cnt:cnt,gold:gold,mult:t[2],lv:lv};
      if(d)d.d=String(d.d||'').replace(/每 \d+ 份材料與 [\d,]+ 金幣/,'每 '+cnt+' 份材料與 '+gold.toLocaleString()+' 金幣');});
  })();

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
    if(p&&p.ttmiFoods&&p.buffs)Object.keys(p.ttmiFoods).forEach(function(fid){if(p.buffs['ttmi_food:'+fid]>0){var fd=DB.items[fid];if(fd&&fd.ttmiBuff)merge(out,fd.ttmiBuff);}else delete p.ttmiFoods[fid];});
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
  wrap('equipItem',function(old,self,args){var it=args[0],d=it&&DB.items[it.id];if(playerReady()&&d&&((d.ttmiMinLevel&&player.lv<d.ttmiMinLevel)||(d.ttmiMaxLevel&&player.lv>d.ttmiMaxLevel))){say('<span class="text-amber-300">等級不符：「'+esc(d.n)+'」限 '+(d.ttmiMinLevel?'Lv.'+d.ttmiMinLevel+' 以上':'')+(d.ttmiMinLevel&&d.ttmiMaxLevel?'、':'')+(d.ttmiMaxLevel?'Lv.'+d.ttmiMaxLevel+' 以下':'')+'。</span>');return;}return old.apply(self,args);});
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
    if((d.ttmiMinLevel&&player.lv<d.ttmiMinLevel)||(d.ttmiMaxLevel&&player.lv>d.ttmiMaxLevel)){say('你的等級與這件物品並不相合。',silent);return false;}
    if(d.ttmiRiftOnly&&!inRift()){say('這件補給只在時空裂痕中才會回應你。',silent);return false;}
    if(typeof reqAllowsClass==='function'&&!reqAllowsClass(d,player.cls)){say('你的職業駕馭不了這件物品。',silent);return false;}
    return true;
  }
  function rememberRiftBuff(k) {
    if(!inRift())return;var m=player.ttmiRiftBuffs=player.ttmiRiftBuffs||{};
    if(!m[k])m[k]={before:player.buffs[k]||0,at:finite(state.ticks),poly:k==='poly'?clone(player.poly||null):null};
  }
  function putBuff(k,sec,rift){if(rift)rememberRiftBuff(k);else if(player.ttmiRiftBuffs)delete player.ttmiRiftBuffs[k];player.buffs[k]=sec;if(rift)player.ttmiRiftBuffs[k].value=sec;}
  function applyExtras(d,id) {
    if(d.ttmiBuff){var family=d.ttmiBuffFamily||'combat';
      if(family==='food'){player.ttmiFoods=player.ttmiFoods||{};player.ttmiFoods[id]=1;if(typeof BUFF_NAMES!=='undefined')BUFF_NAMES['ttmi_food:'+id]=d.n;putBuff('ttmi_food:'+id,d.dur,d.ttmiRiftOnly);}   // 食物增益各自獨立、可以全部疊加（玩家 2026-10-27）
      else{player.ttmiBuffs=player.ttmiBuffs||{};player.ttmiBuffs[family]=id;putBuff('ttmi_'+family,d.dur,d.ttmiRiftOnly);}}
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
      if(d.ttmiPolyForm&&(!f||player.lv<(f.form.lv||0))){say('你的等級還承載不了這副形貌。',silent);return false;}
      if(d.ttmiRiftOnly)rememberRiftBuff('poly');
      player.poly=f?makePolyState(f.form,f.color):getPolyState();putBuff('poly',d.dur,d.ttmiRiftOnly);
    } else if(action==='scroll') {
      if(silent)return false;var sk=DB.skills[d.ttmiSkill];if(!sk){say('這張卷軸上的法術已經失傳，無法施放。');return false;}
      if(sk.type==='passive'){say('「'+esc(sk.n)+'」是被動法術，無法從卷軸施放。');return false;}
      // Reuse the actual skill ID so its antidote/teleport/target branches work.
      // A synchronous temporary scroll definition removes only resource costs.
      var original=sk,granted=player.grantedSkills,copy=Object.assign({},sk,{mp:0,hpCost:0});delete copy.costItem;
      if(d.dur)copy.dur=d.dur;
      DB.skills[d.ttmiSkill]=copy;player.grantedSkills=(granted||[]).concat([d.ttmiSkill]);
      var ok;try{ok=castSkill(d.ttmiSkill);}finally{DB.skills[d.ttmiSkill]=original;player.grantedSkills=granted;}
      if(!ok){say('現在無法施放「'+esc(sk.n)+'」（沒有目標、沒有需要解除的狀態，或仍在冷卻中），卷軸未消耗。');return false;}
    } else if(action==='returnTown') {
      if(silent)return false;var oldMap=mapState.current;returnToTown();if(mapState.current===oldMap)return false;
    } else if(action==='exchange') {
      if(silent||!DB.items[d.ttmiResult])return false;give(d.ttmiResult,1);
    } else if(action==='box') {
      if(silent)return false;var row=rows[id],out=(row.contents||[]).filter(function(x){var dd=DB.items[resolve(x.sourceId)];return resolve(x.sourceId)&&!(dd&&(dd.ttmiRiftOnly||dd.gmOnly||(dd.ttmiEvent&&!dd.ttmiCurated)));});
      if(!out.length){say('「'+esc(d.n)+'」裡的物品已隨活動結束而失效，無法開啟。',silent);return false;}
      var ready=player.ttmiBoxes=player.ttmiBoxes||{};
      if(d.ttmiBoxCooldown&&ready[id]>Date.now()){say('封印尚未重新凝聚，再等等吧。',silent);return false;}
      if(row.contentsMode==='random')out=[out[randomInt(0,out.length-1)]];
      out.forEach(function(x){var sid=x.pickAny?x.pickAny[randomInt(0,x.pickAny.length-1)]:x.sourceId;give(resolve(sid)||resolve(x.sourceId),randomInt(x.min,x.max));});   // pickAny：永恆禮盒的戒指盒四選一
      try{if(LOTTO[id]&&Math.random()<LOTTO_RATE){give(LOTTO[id],1);say('<span class="text-yellow-300 font-bold">🎉 中獎了！包底還壓著一份「'+esc(DB.items[LOTTO[id]].n)+'」。</span>',false);}}catch(e){}
      if(d.ttmiBoxCooldown){ready[id]=Date.now()+d.ttmiBoxCooldown*1000;applyExtras(d,id);refresh();save();say('封印鬆開，裡頭的物品落入你的掌中。',silent);return true;}
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
    if(d.eff==='afk_matgift'){if(it.lock||!(it.cnt>0))return;openGift(it,d,args[1]);return;}
    var hp=it.id.indexOf('potion_heal')>=0||it.id==='potion_strong'||it.id==='potion_ult'||it.id==='new_item_141';
    if(hp&&(player.ttmiPotionRemaining||0)>0)return;
    if(d.ttmiRiftOnly&&!inRift()){say('這件補給只在時空裂痕中才會回應你。',args[1]);return;}
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

  var usedIn0=Object.create(null);recipes.forEach(function(r){r.req.forEach(function(q){usedIn0[q.id]=1;});});
  var DIA_SCROLL={8:30,9:60,10:100};
  function priceDia(id){var d=DB.items[id],sk=d&&d.ttmiAction==='scroll'&&d.ttmiSkill&&DB.skills[d.ttmiSkill];return sk&&(sk.tier||0)>=8?(DIA_SCROLL[Math.min(10,sk.tier)]||100):0;}
  function price(id,visiting) {
    if(typeof CUR!=='undefined'&&CUR.price[id])return CUR.price[id];
    var d=DB.items[id];if(!d||d.ttmiRiftOnly||d.gmOnly)return 0;
    var base=Math.max(1,Math.ceil(finite(d.p)*(d.ttmiMaterial?5:(['wpn','arm','acc'].indexOf(d.type)>=0?10:3))));
    // 素材：依掉落怪物的等級加價（玩家 2026-10-27：原價太低＝用金幣零成本取代打怪）：等級² ×100，只有頭目掉的再 ×5
    var sl=srcLv[id];if(sl&&(d.ttmiMaterial||usedIn0[id]))base=Math.max(base,Math.ceil(sl.lv*sl.lv*100*(sl.boss?5:1)));
    // 魔法卷軸：1～7 階 1,000 萬 × 階數；8～10 階改收龍之鑽石（見 priceDia）
    var sk=d.ttmiAction==='scroll'&&d.ttmiSkill&&DB.skills[d.ttmiSkill];if(sk&&(sk.tier||0)<=7)base=Math.max(base,10000000*Math.max(1,sk.tier||1));
    var row=rows[id];if(!row||!row.contents)return base;
    visiting=visiting||{};if(visiting[id])return Infinity;visiting[id]=true;
    var sums=row.contents.map(function(x){var child=resolve(x.sourceId);return (child==='gold'?1:price(child,Object.assign({},visiting)))*x.max;});
    return Math.max(base,Math.ceil((row.contentsMode==='all'?sums.reduce(function(a,b){return a+b;},0):Math.max.apply(null,sums))*1.25));
  }
  // 洛依只賣補給與基礎材料（玩家 2026-10-27：金幣買得到頂級裝備、還能經工匠換到本作頭目裝備，跟經濟衝突）。
  //   下架：武器／防具／飾品、失去氣息與封印的古物、寶箱等雜項、頭目掉落的材料，以及（往上推）會被拿去做出裝備或本作原有物品的材料。
  //   這些改成只能打怪掉落；工匠配方保留，但材料要自己打。
  //   「關鍵材料」＝直接拿去做出本作原有物品的那一味（失去氣息的古物、封印品、寒冰原石、地龍的勳章、月光之淚、三龍之石…）不賣；
  //   一般素材（黑魔石、精靈粉末、樹皮…）照賣——它們只是配方裡的雜料，真正卡進度的是關鍵材料。
  // 普通裝備（新手等級，約 Lv60 以下）＝價值不超過遊戲本身商店賣的最貴裝備，照舊用金幣賣；更高階的改成頭目掉落
  var GEAR_MAX=(function(){var mx=0;try{Object.keys(SHOP_LISTS).forEach(function(k){(SHOP_LISTS[k]||[]).forEach(function(e){var id=typeof e==='string'?e:(e&&(e.id||e[0]));var d=id&&DB.items[id];if(d&&['wpn','arm','acc'].indexOf(d.type)>=0)mx=Math.max(mx,finite(d.p));});});}catch(e){}return mx||51800;})();
  var isGear=function(d){return ['wpn','arm','acc'].indexOf(d.type)>=0;};
  var feeds=Object.create(null);
  var keyResult=function(id){var d=DB.items[id];if(!d)return false;return ['wpn','arm','acc'].indexOf(d.type)>=0||finite(d.p)>=10000||/^(魔法書|技術書|精靈水晶|黑暗精靈水晶|戰士的印記|龍騎士書板|記憶水晶|封印的傲慢之塔)|之心$|果實$|娃娃/.test(d.n||'');};
  //   被很多配方共用的通用素材（空的魔法卷軸、生命之葉、魔法結晶體…用在 5 種以上成品）不算關鍵材料
  var usesOf=Object.create(null);recipes.forEach(function(r){r.req.forEach(function(q){(usesOf[q.id]=usesOf[q.id]||Object.create(null))[r.result]=1;});});
  var generic=function(id){return Object.keys(usesOf[id]||{}).length>=5;};
  //   新增的高階裝備（價值高於普通裝備上限）也一樣：它的關鍵材料不賣，免得用金幣買料就做得出來
  var gatedResult=function(id){var d=DB.items[id];if(!d)return false;return rows[id]?(isGear(d)&&finite(d.p)>GEAR_MAX):keyResult(id);};
  recipes.forEach(function(r){if(r.ttmiHard&&gatedResult(r.result))r.req.forEach(function(q){if(q.id!=='gold'&&rows[q.id]&&!generic(q.id))feeds[q.id]=1;});});
  imported.forEach(function(id){if(/^(失去氣息的|封印的|寒冰的)/.test(DB.items[id].n||''))feeds[id]=1;});
  var bossDrop=Object.create(null),mobDrop=Object.create(null);Object.keys(dropPools).forEach(function(n){dropPools[n].forEach(function(x){if(x.boss)bossDrop[x.id]=1;else mobDrop[x.id]=1;});});
  Object.keys(mobDrop).forEach(function(id){delete bossDrop[id];});   // 只有頭目會掉的才算頭目材料
  // 補給＝藥水、增益、回魔、加速、解毒、變身卷軸、法術卷軸、回村卷軸
  var SUPPLY_ACT={buff:1,mp:1,blue:1,thirdHaste:1,antidote:1,poly:1,scroll:1,returnTown:1};
  var usedIn=Object.create(null);recipes.forEach(function(r){r.req.forEach(function(q){usedIn[q.id]=1;});});
  var baseSale=function(id){
    var d=DB.items[id];if(!d||d.ttmiRiftOnly||d.gmOnly||d.ttmiEvent||feeds[id]||bossDrop[id]||junk[id])return false;   // 雜項素材是委託材料、活動物品已移除，都不賣
    if(isGear(d))return finite(d.p)<=GEAR_MAX;
    if(d.ttmiAction==='box'||d.ttmiAction==='exchange')return null;   // 看內容物
    if(d.ttmiMaterial||usedIn[id])return true;   // 素材，或配方裡會用到的雜項（黑魔石、精靈粉末…）
    if(d.ttmiAction)return !!SUPPLY_ACT[d.ttmiAction];
    return d.type==='pot'||d.type==='scroll';
  };
  // 洛依只賣藥水與增益（玩家 2026-10-27）：藥水、料理／增益、回魔、加速、解毒。其餘（素材、普通裝備、卷軸、變身、箱子）改成怪物掉落
  var POTION_ACT={buff:1,mp:1,blue:1,thirdHaste:1,antidote:1};
  var forSale=function(id){
    var d0=DB.items[id];if(!d0||d0.ttmiRiftOnly||d0.gmOnly||d0.ttmiEvent||isGear(d0))return false;
    if(!(d0.type==='pot'||POTION_ACT[d0.ttmiAction]))return false;
    var v=baseSale(id);if(v!==null)return v;
    var d=DB.items[id],row=rows[id];
    if(d.ttmiAction==='exchange')return false;   // 兌換券只是換成本作原有的卷軸，跟原有物品功能重複，不賣（玩家 2026-10-27）
    var c=(row&&row.contents)||[];
    if(c.some(function(x){var cid=resolve(x.sourceId),cd=cid&&DB.items[cid];return cd&&isGear(cd);}))return false;   // 裝了裝備的箱子改成龍鑽抽抽樂
    return c.length>0&&c.every(function(x){var cid=resolve(x.sourceId);return cid==='gold'||(cid&&rows[cid]&&baseSale(cid)===true);});
  };
  // ── 洛依的貨架（玩家 2026-10-27 重整）：只留一套乾淨的補給，價格比照其他 NPC ──
  //   ① 治癒藥水：依回復量分段，每段只留一種（回復量最高的那個）；價格＝遊戲本身同級藥水的 1.5 倍，回復量更高的照比例
  //   ② 魔力藥水、藍色（加速魔力回覆）、解毒：同樣每段一種，1.5 倍
  //   ③ 加速：一段 3 種、二段（勇敢）4 種、三段 2 種，依持續時間挑；1.5 倍（以自我加速藥水／勇敢藥水為準）
  //   ④ 增益：效果類似的合成一罐——戰鬥增益分「生命魔力／攻擊／防禦／能力」四罐、料理分四盤、經驗三種；從 1 萬金幣起跳
  //   其餘同類物品不再上架；沒有其他用途的直接移除（不掉、不賣），配方會用到的改成怪物掉落。
  var CUR={ids:[],price:Object.create(null)};
  (function(){
    var pool=imported.filter(function(id){var d=DB.items[id];return d&&!d.ttmiRiftOnly&&!d.gmOnly&&!d.ttmiEvent&&!isGear(d);});
    var avg=function(a,b){return (finite(a)+finite(b))/2;};
    var pick=function(list,score){return list.slice().sort(function(a,b){return score(b)-score(a)||String(DB.items[a].n).length-String(DB.items[b].n).length||(a<b?-1:1);})[0];};
    var keep=Object.create(null),touched=Object.create(null);
    var put=function(id,gold){if(!id)return;keep[id]=1;CUR.price[id]=Math.max(1,Math.ceil(gold));};
    // ① 治癒
    var heals=pool.filter(function(id){var d=DB.items[id];return d.type==='pot'&&finite(d.valMax)>0&&!d.ttmiBuff&&d.ttmiMpMin==null;});
    heals.forEach(function(id){touched[id]=1;});
    [[0,17,37*1.5],[18,45,200*1.5],[46,100,600*1.5],[101,180,0],[181,400,0],[401,1e9,0]].forEach(function(b){
      var list=heals.filter(function(id){var d=DB.items[id],a=avg(d.valMin,d.valMax);return a>=b[0]&&a<=b[1];});if(!list.length)return;
      var r=pick(list,function(id){return avg(DB.items[id].valMin,DB.items[id].valMax);});put(r,b[2]||600*1.5*avg(DB.items[r].valMin,DB.items[r].valMax)/70);
    });
    // 果汁（各有效果，玩家指定保留）
    pool.forEach(function(id){var d=DB.items[id];if(/汁$/.test(String(d.n).replace(/\s+/g,''))&&d.type==='pot'){touched[id]=1;put(id,37*1.5*2);}});
    // ② 魔力藥水
    var mps=pool.filter(function(id){return DB.items[id].ttmiAction==='mp';});mps.forEach(function(id){touched[id]=1;});
    [[0,15],[16,60],[61,200],[201,1e9]].forEach(function(b){var list=mps.filter(function(id){var d=DB.items[id],a=avg(d.ttmiMpMin,d.ttmiMpMax);return a>=b[0]&&a<=b[1];});if(!list.length)return;
      var r=pick(list,function(id){return avg(DB.items[id].ttmiMpMin,DB.items[id].ttmiMpMax);});put(r,1.5*30*avg(DB.items[r].ttmiMpMin,DB.items[r].ttmiMpMax));});
    var blues=pool.filter(function(id){return DB.items[id].ttmiAction==='blue';});blues.forEach(function(id){touched[id]=1;});
    [[0,900],[901,1e9]].forEach(function(b){var list=blues.filter(function(id){var v=finite(DB.items[id].dur);return v>=b[0]&&v<=b[1];});if(!list.length)return;var r=pick(list,function(id){return finite(DB.items[id].dur);});put(r,1046*1.5*finite(DB.items[r].dur)/600);});
    var anti=pool.filter(function(id){return DB.items[id].ttmiAction==='antidote';});anti.forEach(function(id){touched[id]=1;});
    put(anti.filter(function(id){return /藥水/.test(DB.items[id].n);})[0]||anti[0],300*1.5);
    // ③ 加速
    var hastes=pool.filter(function(id){var d=DB.items[id];return d.ttmiAction==='buff'&&d.ttmiHaste&&!d.ttmiBuff;});hastes.forEach(function(id){touched[id]=1;});
    var stage=function(id){var h=DB.items[id].ttmiHaste[0]||{};return h.moveOnly?0:h.stage;};
    var pickDur=function(st,mult,durs,unit){durs.forEach(function(want){var list=hastes.filter(function(id){var h=DB.items[id].ttmiHaste[0];return stage(id)===st&&h.mult>=mult&&!keep[id];});if(!list.length)return;
      var pot=function(x){return /藥水|之血/.test(DB.items[x].n)?1:0;};
      var r=list.slice().sort(function(a,b){return Math.abs(finite(DB.items[a].dur)-want)-Math.abs(finite(DB.items[b].dur)-want)||pot(b)-pot(a)||String(DB.items[a].n).length-String(DB.items[b].n).length||(a<b?-1:1);})[0];
      if(Math.abs(finite(DB.items[r].dur)-want)<=want*0.5)put(r,unit*1.5*finite(DB.items[r].dur)/300);});};
    pickDur(1,1.3,[300,1200,1800],200); pickDur(2,1.3,[300,600,1200,1800],880); pickDur(3,1.3,[300,600],1500);
    // ④ 增益合成
    var CAT={hpmp:['hpR','mpR','mhp','mmp'],atk:['meleeHit','meleeDmg','rangedHit','rangedDmg','extraDmg','extraHit','mdmg','magicHit'],def:['ac','dr','mr','resFire','resWater','resWind','resEarth'],stat:['str','dex','con','int','wis','cha','weightCap']};
    var CAP={hpR:10,mpR:5,mhp:150,mmp:100,meleeHit:5,meleeDmg:5,rangedHit:5,rangedDmg:5,extraDmg:5,extraHit:5,mdmg:3,magicHit:5,ac:4,dr:5,mr:10,resFire:10,resWater:10,resWind:10,resEarth:10,str:3,dex:3,con:3,int:3,wis:3,cha:3,weightCap:500};
    var MIX=[['combat','hpmp','生命魔力強化藥水','神秘魔力恢復藥水.png',1800,50000],['combat','atk','攻擊強化藥水','食人巨魔的血.png',1800,50000],['combat','def','防禦強化藥水','翡翠藥水.png',1800,50000],['combat','stat','能力強化藥水','慎重藥水.png',1800,50000],
      ['food','hpmp','營養料理・生命魔力','肉.png',900,20000],['food','atk','營養料理・力量','漂浮之眼肉.png',900,20000],['food','def','營養料理・守護','精靈餅乾.png',900,20000],['food','stat','營養料理・百味','安特的水果.png',900,20000]];
    var buffs=pool.filter(function(id){var d=DB.items[id];return d.ttmiBuff&&(d.ttmiBuffFamily==='combat'||d.ttmiBuffFamily==='food')&&d.type!=='pot';});buffs.forEach(function(id){touched[id]=1;});
    MIX.forEach(function(m){
      var keys=CAT[m[1]],st={},rep=null,repN=0;
      buffs.forEach(function(id){var d=DB.items[id];if((d.ttmiBuffFamily||'combat')!==m[0])return;var hit=0;Object.keys(d.ttmiBuff).forEach(function(k){if(keys.indexOf(k)>=0&&finite(d.ttmiBuff[k])>0){hit++;st[k]=Math.max(st[k]||0,Math.min(CAP[k]||finite(d.ttmiBuff[k]),finite(d.ttmiBuff[k])));}});
        if(hit>repN&&/^assets\/icons\/ttmi\//.test(d.img||'')){rep=d.img;repN=hit;}});   // 合成品借用「效果最接近的原料」的透視鏡原圖
      if(!Object.keys(st).length)return;
      var id='ttmi_mix_'+m[0]+'_'+m[1],NM={hpR:'HP 自然恢復',mpR:'MP 自然恢復',mhp:'HP 上限',mmp:'MP 上限',meleeHit:'近距離命中',meleeDmg:'近距離傷害',rangedHit:'遠距離命中',rangedDmg:'遠距離傷害',extraDmg:'額外傷害',extraHit:'額外命中',mdmg:'魔法傷害',magicHit:'魔法命中',ac:'防禦',dr:'傷害減免',mr:'魔法防禦',resFire:'火屬性抗性',resWater:'水屬性抗性',resWind:'風屬性抗性',resEarth:'地屬性抗性',str:'力量',dex:'敏捷',con:'體質',int:'智力',wis:'精神',cha:'魅力',weightCap:'負重'};
      DB.items[id]={n:m[2],type:'misc',eff:'ttmi_item',req:'all',gachaWeight:0,p:Math.floor(m[5]/3),ttmiAction:'buff',ttmiBuff:st,ttmiBuffFamily:m[0],dur:m[4],ttmiSourceId:'mix',c:'text-slate-200',img:rep||'assets/icons/items/'+m[3],
        d:'獲得'+Object.keys(st).map(function(k){return (NM[k]||k)+'+'+st[k];}).join('、')+'；持續 '+m[4]+' 秒；'+(m[0]==='food'?'料理類增益，各種料理可以疊加。':'同類增益僅保留最後使用的一種。')};
      put(id,m[5]);CUR.mix=CUR.mix||{};CUR.mix[id]=1;
    });
    // 經驗：三種
    var exps=pool.filter(function(id){var d=DB.items[id];return d.ttmiBuffFamily==='exp'&&d.ttmiBuff;});exps.forEach(function(id){touched[id]=1;});
    [[1.2,1.25,30000],[1.3,1.4,60000],[2.5,2.5,300000]].forEach(function(b){var list=exps.filter(function(id){var v=finite(DB.items[id].ttmiBuff.ttmiExpMult);return v>=b[0]&&v<=b[1];});if(!list.length)return;
      put(pick(list,function(id){return finite(DB.items[id].dur);}),b[2]);});
    // 增益至少 1 萬
    Object.keys(keep).forEach(function(id){var d=DB.items[id];if(d.ttmiAction==='buff'&&!d.ttmiHaste)CUR.price[id]=Math.max(10000,CUR.price[id]);});
    // 上架品的圖示修正（原本借錯圖：信、靴子、靈魂之球、飼料袋…）；2026-10-27 起透視鏡原圖優先，這裡只是沒有原圖時的備案
    var ICON={'兔子的肝':'肉','奇怪的體力藥水':'白色藥水','紅茶':'蘑菇汁','酒釀湯圓':'糖果','勇氣貨幣':'藍色藥水','桂花湯圓':'糖果','下層魔力藥水':'藍色藥水','精神秘藥':'神秘魔力恢復藥水',
      '綠茶蛋糕卷':'糖果','150%神力藥水':'白色藥水','喜鵲的禮糖':'糖果','戰鬥藥水':'橙色藥水','加速蛋糕':'糖果','回覆妙藥':'橙色藥水'};
    Object.keys(keep).forEach(function(id){var d=DB.items[id],k=ICON[String(d.n).replace(/\s+/g,'')];if(k&&!/^assets\/icons\/ttmi\//.test(d.img||''))d.img='assets/icons/items/'+k+'.png';});   // 已有透視鏡原圖就不換
    CUR.ids=Object.keys(keep);
    // 沒上架的同類物品：沒有配方用途＝移除（不掉、不賣）；有用途＝交給怪物掉落
    Object.keys(touched).forEach(function(id){if(!keep[id]&&!usedIn0[id]){DB.items[id].ttmiEvent=true;DB.items[id].ttmiRetired=true;DB.items[id].ttmiCurated=true;}});   // ttmiCurated：只是洛依不上架，道具包裡照樣開得到（玩家 2026-10-29：嘯龍道具包開不出東西）
    // 🔧 開不出任何東西的道具包（內容全是活動/裂痕/GM 物品，如 糖果禮物盒→白色情人節糖果）、以及施放被動技能的魔法卷軸（返生術）＝用不了 → 一併移除（不掉、不賣；舊存檔保留）
    imported.forEach(function(id){var d=DB.items[id],row=rows[id];if(!d||d.ttmiEvent)return;
      if(d.ttmiAction==='box'&&row&&row.contents&&row.contents.length&&!row.contents.some(function(x){var cid=resolve(x.sourceId),cd=cid&&DB.items[cid];return cid&&!(cd&&(cd.ttmiRiftOnly||cd.gmOnly||(cd.ttmiEvent&&!cd.ttmiCurated)));})){d.ttmiEvent=true;d.ttmiRetired=true;}
      if(d.ttmiAction==='scroll'&&DB.skills[d.ttmiSkill]&&DB.skills[d.ttmiSkill].type==='passive'){d.ttmiEvent=true;d.ttmiRetired=true;}});
    // 已經放進掉落表的移除品要拿掉
    for(var i=addedDrops.length-1;i>=0;i--){var x=addedDrops[i];if(DB.items[x.entry[0]]&&DB.items[x.entry[0]].ttmiRetired){var L=MOB_DROPS[x.mob],j=L?L.indexOf(x.entry):-1;if(j>=0)L.splice(j,1);addedDrops.splice(i,1);}}
  })();
  var stock=CUR.ids.filter(function(id){return DB.items[id];});   // 洛依只賣上面整理過的這一套
  // 玩家 2026-10-29：道具包（嘯龍道具包…）裡開得到、但上面沒挑進來的消耗品，也改成古物商人的販賣物品
  (function(){var inBox=Object.create(null);imported.forEach(function(id){var d=DB.items[id],row=rows[id];if(!d||d.ttmiAction!=='box'||d.ttmiEvent||d.gmOnly||d.ttmiRiftOnly||!row||!row.contents)return;
    row.contents.forEach(function(x){var cid=resolve(x.sourceId),cd=cid&&DB.items[cid];if(cd&&cd.ttmiCurated&&!cd.gmOnly&&!cd.ttmiRiftOnly&&!isGear(cd))inBox[cid]=1;});});
    var avg=function(a,b){return (finite(a)+finite(b))/2;};
    Object.keys(inBox).sort().forEach(function(id){if(stock.indexOf(id)>=0)return;var d=DB.items[id],h=d.ttmiHaste&&d.ttmiHaste[0],g=0;   // 價格比照上面同類（治癒、魔力、加速、增益、解毒）的算法，不讓道具包的品項比較便宜
      if(d.type==='pot'&&finite(d.valMax)>0)g=600*1.5*avg(d.valMin,d.valMax)/70;else if(d.ttmiAction==='mp')g=1.5*30*avg(d.ttmiMpMin,d.ttmiMpMax);else if(d.ttmiAction==='blue')g=1046*1.5*finite(d.dur)/600;
      else if(h)g=(h.stage>=3?1500:h.stage===2&&!h.moveOnly?880:200)*1.5*finite(d.dur||300)/300;else if(d.ttmiAction==='antidote')g=450;else if(d.ttmiAction==='buff')g=10000;
      if(g>0)CUR.price[id]=Math.max(1,Math.ceil(g));stock.push(id);d.ttmiBoxSold=true;});})();
  // 玩家 2026-10-29：嘯龍道具包也在古物商人販售；開包有 0.1% 中獎，多給一份「材料禮包」，價值超過道具包售價的 5 倍
  var LOTTO=Object.create(null),LOTTO_RATE=0.001,LOTTO_X=5;
  (function(){imported.forEach(function(id){var d=DB.items[id];if(!d||d.ttmiAction!=='box'||d.ttmiEvent||d.gmOnly||!/^嘯龍道具包/.test(d.n||''))return;
    if(stock.indexOf(id)<0)stock.push(id);
    var gid='afk_matgift_'+id,val=Math.ceil(price(id)*LOTTO_X);
    DB.items[gid]={n:d.n.replace(/^嘯龍道具包/,'嘯龍材料禮包'),type:'misc',req:'all',gachaWeight:0,p:0,c:'text-yellow-300',img:d.img,eff:'afk_matgift',giftValue:val,
      d:'嘯龍道具包裡 0.1% 才會出現的中獎禮包。打開會得到一批隨機材料，總價值超過 '+val.toLocaleString()+' 金幣（'+d.n+'售價的 '+LOTTO_X+' 倍）。'};
    LOTTO[id]=gid;
    try{if(typeof miscCatKey==='function'&&typeof MISC_CAT_ITEMS!=='undefined'){var k=miscCatKey(gid,DB.items[gid]);if(k&&MISC_CAT_ITEMS[k]&&!MISC_ITEM_CAT[gid]){MISC_CAT_ITEMS[k].push(gid);MISC_ITEM_CAT[gid]=k;}}}catch(e){}
  });})();
  var giftPool=null;
  function openGift(it,d,silent){
    if(!giftPool)giftPool=imported.filter(function(id){var x=DB.items[id];return x&&x.ttmiMaterial&&!x.ttmiEvent&&!x.ttmiRiftOnly&&!x.gmOnly&&price(id)>0&&isFinite(price(id));});
    if(!giftPool.length)return false;
    var want=d.giftValue||0,got=0,bag=Object.create(null),guard=0;
    while(got<=want&&guard++<500){var id=giftPool[randomInt(0,giftPool.length-1)],pr=price(id),n=Math.max(1,Math.min(50,Math.ceil((want-got+1)*0.25/pr)));bag[id]=(bag[id]||0)+n;got+=pr*n;}
    if((it.cnt||1)>1)it.cnt--;else player.inv.splice(player.inv.indexOf(it),1);
    Object.keys(bag).forEach(function(id){give(id,bag[id]);});
    refresh();save();
    say('打開了 '+esc(d.n)+'：'+Object.keys(bag).map(function(id){return esc(DB.items[id].n)+' ×'+bag[id];}).join('、')+'（價值約 '+Math.round(got).toLocaleString()+' 金幣）。',silent);
    return true;
  }
  var stockSet0=Object.create(null);stock.forEach(function(id){stockSet0[id]=1;});
  var whyNot=function(id){var d=DB.items[id];return !d?"none":d.ttmiRiftOnly?"rift":d.gmOnly?"gm":feeds[id]?"key":bossDrop[id]?"boss":isGear(d)?(finite(d.p)<=GEAR_MAX?"sale":"gear-high"):forSale(id)?"sale":d.ttmiAction?("act:"+d.ttmiAction):("type:"+d.type);};
  // 高階裝備、失去氣息的古物、封印品…原本只能在洛依買、又沒有怪物掉落的 → 分到頭目掉落（玩家 2026-10-27）
  //   失去氣息的古物：優先給「本來就會掉復原後那件」的頭目（機率同那件）；其他依價值分三層給對應等級的頭目，
  //   每隻頭目每層總共約 1.5％／1％／0.6％，平均分給分到牠身上的物品（每件至少 0.05％）
  var bossAdded=[];
  var RIFT_NAME=/歐西里斯|庫庫爾坎|底比斯|提卡爾/;
  (function(){
    if(typeof MOB_DROPS==='undefined')return;
    var dropped=Object.create(null);Object.keys(MOB_DROPS).forEach(function(n){(MOB_DROPS[n]||[]).forEach(function(e){dropped[e[0]]=1;});});
    var crafted=Object.create(null);if(typeof CRAFT_RECIPES!=='undefined')Object.keys(CRAFT_RECIPES).forEach(function(n){(CRAFT_RECIPES[n]||[]).forEach(function(r){crafted[r.result]=1;});});
    var need=imported.filter(function(id){var d=DB.items[id];return id!==leafId&&!d.ttmiRiftOnly&&!d.gmOnly&&!d.ttmiEvent&&!stockSet0[id]&&!dropped[id];});
    var riftNeed=need.filter(function(id){return RIFT_NAME.test(DB.items[id].n||'');});need=need.filter(function(id){return riftNeed.indexOf(id)<0;});   // 時空裂痕（底比斯／提卡爾）專屬的寶箱與碎片：只給該裂痕的怪（玩家 2026-10-29：新手區掉底比斯箱）
    var bosses=Object.keys(DB.mobs).map(function(k){return DB.mobs[k];}).filter(function(m){return m&&m.boss&&m.race!=='建築'&&m.n&&MOB_DROPS[m.n]&&(m.lv||0)>=40;})
      .sort(function(a,b){return (a.lv||0)-(b.lv||0)||(a.n<b.n?-1:1);});
    var add=function(mob,id,pct){var list=MOB_DROPS[mob];if(list.some(function(e){return e[0]===id;}))return;var entry=[id,Math.max(0.05,+pct.toFixed(3))];list.push(entry);addedDrops.push({mob:mob,entry:entry});bossAdded.push(id);};
    riftNeed.forEach(function(id){var n=DB.items[id].n||'',pre=/庫庫爾坎|提卡爾/.test(n)?'提卡爾':'底比斯';
      Object.keys(DB.mobs).map(function(k){return DB.mobs[k];}).filter(function(m){return m&&!m.boss&&m.n&&m.n.indexOf(pre)===0&&MOB_DROPS[m.n];})
        .forEach(function(m){add(m.n,id,0.5);});});
    var rest=[],common=[];
    need.forEach(function(id){
      var d=DB.items[id];
      // 2026-10-27 洛依只賣藥水後：普通裝備、素材、卷軸、變身卷軸、箱子…改成一般怪掉落；高階裝備與關鍵物品才給頭目
      var bossy=(isGear(d)&&finite(d.p)>GEAR_MAX)||/^(失去氣息的|封印的|寒冰的)/.test(d.n||'')||feeds[id];
      if(!bossy){common.push(id);return;}
      if(/^失去氣息的/.test(d.n||'')){
        var res=recipes.filter(function(r){return r.ttmiRecipeKind==='restore'&&r.req.some(function(q){return q.id===id;});}).map(function(r){return r.result;})[0];
        var hit=res?bosses.filter(function(m){return MOB_DROPS[m.n].some(function(e){return e[0]===res;});}):[];
        if(hit.length){hit.forEach(function(m){var e=MOB_DROPS[m.n].filter(function(x){return x[0]===res;})[0];add(m.n,id,Math.min(1,finite(e[1])||0.1));});return;}
      }
      rest.push(id);
    });
    var BANDS=[[40,69,1.5],[60,84,1.0],[80,999,0.6]];
    var tierOf=function(d){var v=finite(d.p);return v<=150000?0:v<=500000?1:2;};
    BANDS.forEach(function(b,ti){
      var items=rest.filter(function(id){return tierOf(DB.items[id])===ti;}).sort(function(x,y){return finite(DB.items[x].p)-finite(DB.items[y].p)||(x<y?-1:1);});
      var bs=bosses.filter(function(m){return (m.lv||0)>=b[0]&&(m.lv||0)<=b[1];});if(!items.length||!bs.length)return;
      var per=Object.create(null);items.forEach(function(id,i){var m=bs[i%bs.length].n;(per[m]=per[m]||[]).push(id);});
      Object.keys(per).forEach(function(m){per[m].forEach(function(id){add(m,id,b[2]/per[m].length);});});
    });
    // 一般怪：物品依價值由低到高、一般怪依等級由低到高對齊，每件給相鄰的 3 隻；每隻怪這部分合計 3%，平均分給牠身上的物品
    (function(){
      var mobs=Object.keys(DB.mobs).map(function(k){return DB.mobs[k];}).filter(function(m){return m&&!m.boss&&m.race!=='建築'&&m.n&&MOB_DROPS[m.n];})
        .sort(function(a,b){return (a.lv||0)-(b.lv||0)||(a.n<b.n?-1:1);});
      if(!mobs.length||!common.length)return;
      common.sort(function(x,y){return finite(DB.items[x].p)-finite(DB.items[y].p)||(x<y?-1:1);});
      var per=Object.create(null),M=mobs.length,N=common.length;
      common.forEach(function(id,i){var at=Math.floor(i*M/N);for(var k=0;k<3;k++){var m=mobs[Math.min(M-1,at+k)].n;(per[m]=per[m]||[]);if(per[m].indexOf(id)<0)per[m].push(id);}});
      Object.keys(per).forEach(function(m){per[m].forEach(function(id){add(m,id,3/per[m].length);});});
    })();
    // 每隻怪新增的掉落合計不超過 20%（與原本的預算一致）：超過就整組等比例縮小
    var sum=Object.create(null);addedDrops.forEach(function(x){sum[x.mob]=(sum[x.mob]||0)+finite(x.entry[1]);});
    addedDrops.forEach(function(x){if(sum[x.mob]>20&&!x.fixed)x.entry[1]=x.entry[1]*20/sum[x.mob]*(1-1e-9);});
  })();
  var stockSet=Object.create(null);stock.forEach(function(id){stockSet[id]=true;});
  // 特殊裝備抽抽樂（玩家 2026-10-27）：原本用金幣賣的「裝了裝備的箱子」（究極 T 恤箱子…）改成每抽 10 龍之鑽石，從所有這類箱子的裝備裡平均抽一件
  var GACHA_DIA=10,gachaPool=[];
  (function(){var seen=Object.create(null);imported.forEach(function(id){var d=DB.items[id],row=rows[id];if(!d||d.ttmiAction!=='box'||d.ttmiEvent||d.gmOnly||d.ttmiRiftOnly||!row||!row.contents)return;
    row.contents.forEach(function(x){var cid=resolve(x.sourceId),cd=cid&&DB.items[cid];if(!cd||!isGear(cd)||!rows[cid]||finite(cd.p)>500000||cd.ttmiEvent||cd.gmOnly||cd.ttmiRiftOnly||seen[cid])return;seen[cid]=1;gachaPool.push(cid);});});   // 只抽透視鏡新增、價值 50 萬以下的裝備（本作原有的頭目裝備、英雄系王裝不進獎池）
    gachaPool.sort();})();
  function gacha(times){
    if(!enabled()||!atTown()||!gachaPool.length)return false;times=Math.max(1,Math.min(10,Math.floor(Number(times)||1)));
    var need=GACHA_DIA*times,have=0;try{have=Math.floor(Number(window.pandoraGetSharedDiamonds())||0);}catch(e){}
    if(have<need){say('龍之鑽石不夠（需要 '+need+'）。');return false;}
    var pr={};try{pr=window.pandoraAdjustSharedDiamonds(-need)||{};}catch(e){}if(!pr.ok){say('龍之鑽石扣款失敗。');return false;}
    var got=[];for(var i=0;i<times;i++){var g=gachaPool[Math.floor(Math.random()*gachaPool.length)];give(g,1);got.push(DB.items[g].n);}
    say('<span class="text-cyan-300">特殊裝備抽抽樂（'+need+' 龍之鑽石）：</span>'+got.map(esc).join('、'));
    refresh();save();redrawCatalogue();return got;
  }
  function acquisition(id){
    var d=DB.items[id];if(!d||d.gmOnly||!rows[id])return null;
    if(d.ttmiRiftOnly)return {rift:{mapId:'rift_battle',creditId:creditId,cost:d.ttmiCost||0,isCredit:id===creditId,entryCredits:10,normalCredits:1,bossCredits:10}};
    var cost=stockSet[id]?price(id):Infinity;
    var dia=stockSet[id]?priceDia(id):0;if(dia)return {shop:{npcId:SHOP,townId:SHOP_TOWN,price:dia,currency:'dia',discount:false}};
    return Number.isFinite(cost)?{shop:{npcId:SHOP,townId:SHOP_TOWN,price:cost,discount:false}}:null;
  }
  // The native books build before add-ons. Add obtainable catalogue rows now,
  // without granting ownership or writing a save, so denominators survive a
  // reload and collecting a new material never creates a new surprise slot.
  var actualDrops=Object.create(null);
  if(typeof MOB_DROPS!=='undefined')Object.keys(MOB_DROPS).forEach(function(n){(MOB_DROPS[n]||[]).forEach(function(e){actualDrops[e[0]]=true;});});
  data.items.map(function(r){return resolve(r.sourceId);}).forEach(function(id){
    var d=DB.items[id];if(!d||d.gmOnly||(!acquisition(id)&&!actualDrops[id]&&id!==leafId))return;   // 生命之葉由頭目／首領固定掉落（不在掉落表）
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
  function atTown(){return playerReady()&&!player.dead&&typeof mapState!=='undefined'&&(mapState.current===TOWN||mapState.current===SHOP_TOWN);}
  function catalogueRows(){
    var q=key(catalogue.query),a=catalogue.mode==='craft'?recipes.map(function(r,i){return {id:r.result,recipe:i};}):stock.map(function(id){return {id:id};});
    return a.filter(function(x){var d=DB.items[x.id];return d&&(!q||key(d.n).indexOf(q)>=0)&& (catalogue.kind==='all'||(catalogue.kind==='material'?d.ttmiMaterial:catalogue.kind==='pot'?d.type==='pot'||d.ttmiAction: d.type===catalogue.kind));});
  }
  // 介面（玩家 2026-10-27：跟遊戲本身的商店／製作一樣有圖示、名稱顏色、持有數量，滑鼠指到圖示看完整資訊）
  function iconBox(id,craftTip){
    var d=DB.items[id],u='';try{u=typeof getIconUrl==='function'?getIconUrl(d):(d.img||'');}catch(e){}
    return '<div class="w-12 h-12 bg-slate-900 rounded border border-slate-600 flex items-center justify-center shrink-0 tip-host" data-tip-id="'+esc(id)+'"'+(craftTip?' data-tip-craft="1"':'')+'><img src="'+esc(u)+'" alt="" onerror="this.style.display=\'none\'" class="w-10 h-10 object-contain pointer-events-none"></div>';
  }
  function nameCls(id){try{return typeof getItemColor==='function'?getItemColor({id:id}):(DB.items[id].c||'');}catch(e){return DB.items[id].c||'';}}
  function owned(id){try{return typeof invCountId==='function'?invCountId(id):count(id);}catch(e){return 0;}}
  var ROW='list-item bg-slate-800 rounded mb-2 border border-slate-700 p-3 hover:bg-slate-700 transition-colors';
  var ROWCSS='display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px 12px;width:100%;box-sizing:border-box';
  var CLAMP='display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden';
  function shopRow(id){
    var d=DB.items[id],cost=price(id),have=owned(id);
    return '<div class="'+ROW+'" style="'+ROWCSS+'"><div class="flex items-center gap-4 min-w-0" style="flex:1 1 260px">'+iconBox(id,false)
      +'<div class="flex flex-col items-start gap-1 min-w-0"><span class="'+esc(nameCls(id))+' font-bold text-lg leading-tight">'+esc(d.n)+'</span>'
      +(d.d?'<span class="text-slate-400 text-sm" style="'+CLAMP+'">'+esc(d.d)+'</span>':'')
      +'<span class="text-sm"><span class="'+(priceDia(id)?'text-cyan-300':'text-amber-300')+' font-bold">'+(priceDia(id)?priceDia(id).toLocaleString()+' 龍之鑽石':cost.toLocaleString()+' 金幣')+'</span><span class="text-slate-400">　持有 '+have.toLocaleString()+'</span></span></div></div>'
      +'<div class="flex items-center gap-2 shrink-0"><input type="number" min="1" max="100" value="1" id="ttmi-qty-'+esc(id)+'" aria-label="購買數量" onclick="event.stopPropagation()" class="w-14 px-1 py-2 bg-slate-900 border border-slate-600 rounded text-center text-white font-bold">'
      +'<button class="btn bg-blue-700 hover:bg-blue-600 border-blue-500 py-2 px-5 font-bold shadow" onclick="AFK_TTMI_ITEMS.buyQty(\''+esc(id)+'\')">購買</button></div></div>';
  }
  function craftRow(idx){
    var r=recipes[idx],d=DB.items[r.result],out=r.yield||1;
    var req=typeof craftReqHtml==='function'?craftReqHtml(r.req):r.req.map(function(z){return esc(z.id==='gold'?'金幣':DB.items[z.id].n)+' ×'+z.cnt.toLocaleString();}).join('、');
    var act=typeof craftActionHtml==='function'?craftActionHtml(WORKSHOP,idx):'<button class="btn" onclick="AFK_TTMI_ITEMS.craft('+idx+')">製作</button>';
    return '<div class="'+ROW+'" style="'+ROWCSS+'"><div class="flex items-center gap-4 min-w-0" style="flex:1 1 260px">'+iconBox(r.result,true)
      +'<div class="flex flex-col items-start gap-1.5 min-w-0"><span class="'+esc(nameCls(r.result))+' font-bold text-lg leading-tight">'+esc(d.n)+(out>1?' <span class="text-yellow-400 text-sm">(x'+out+')</span>':'')
+'</span>'
      +'<div class="flex items-center gap-x-2 gap-y-1 flex-wrap"><span class="text-slate-400 text-sm">需求：</span>'+req+'</div></div></div>'+act+'</div>';
  }
  function renderCatalogue(div) {
    if(!div)return;var a=catalogueRows(),pages=Math.max(1,Math.ceil(a.length/PAGE));catalogue.page=Math.max(0,Math.min(pages-1,catalogue.page));
    var craftMode=catalogue.mode==='craft';
    var h=(!craftMode&&catalogue.tab==='gacha')?'':'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><input id="ttmi-search" aria-label="搜尋古物" placeholder="搜尋物品名稱" value="'+esc(catalogue.query)+'" onkeydown="if(event.key===\'Enter\')AFK_TTMI_ITEMS.search()" style="color:#fff;background:#0f172a;padding:8px;border:1px solid #475569;border-radius:6px;min-width:120px;flex:1"><button onclick="AFK_TTMI_ITEMS.search()" class="btn">搜尋</button></div>';   // 洛依只賣、薩克只做，不再互相切換（玩家 2026-10-27）
    if(craftMode){h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';[['all','全部'],['wpn','武器'],['arm','防具'],['acc','飾品與娃娃'],['pot','補給'],['material','材料']].forEach(function(x){h+='<button class="btn" onclick="AFK_TTMI_ITEMS.kind(\''+x[0]+'\')"'+(catalogue.kind===x[0]?' style="color:#fcd34d"':'')+'>'+x[1]+'</button>';});h+='</div>';}
    else{var tb=catalogue.tab||'supply';h+='<div style="display:flex;gap:8px;margin-bottom:10px">'+[['supply','🧪 補給'],['gacha','🎰 抽抽樂']].map(function(x){return '<button class="btn" style="flex:1;'+(tb===x[0]?'color:#fcd34d;border-color:#a8823f':'')+'" onclick="AFK_TTMI_ITEMS.tab(\''+x[0]+'\')">'+x[1]+'</button>';}).join('')+'</div>';}
    var gachaTab=!craftMode&&(catalogue.tab||'supply')==='gacha';
    h+='<p class="text-slate-400 text-sm" style="margin-bottom:8px">'+(gachaTab?'每抽 '+GACHA_DIA+' 龍之鑽石，從特殊裝備（各種究極 T 恤、套裝箱子裡的裝備…）平均抽一件。':craftMode?'缺的中間材料會自動補製，鎖定的物品不會被消耗。':'藥水與增益補給。')+'</p>';
    if(gachaTab&&gachaPool.length){var dia=0;try{dia=Math.floor(Number(window.pandoraGetSharedDiamonds())||0);}catch(e){}
      h+='<div class="'+ROW+'" style="'+ROWCSS+';border-color:#155e75"><div class="flex flex-col gap-1 min-w-0" style="flex:1 1 260px"><span class="text-cyan-300 font-bold text-lg leading-tight">🎰 特殊裝備抽抽樂</span><span class="text-slate-400 text-sm">每抽 '+GACHA_DIA+' 龍之鑽石，從 '+gachaPool.length+' 件特殊裝備（各種究極 T 恤、套裝箱子裡的裝備…）平均抽一件。持有龍之鑽石 '+dia.toLocaleString()+'。</span>'
        +'<details open><summary class="text-sm text-slate-300 cursor-pointer">獎池（'+gachaPool.length+' 件）</summary><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px;margin-top:6px">'+gachaPool.map(function(g){return '<div class="flex items-center gap-2 text-sm">'+iconBox(g,false).replace('w-12 h-12','w-9 h-9').replace('w-10 h-10','w-7 h-7')+'<span class="'+esc(nameCls(g))+'" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(DB.items[g].n)+'</span></div>';}).join('')+'</div></details></div>'
        +'<div class="flex items-center gap-2 shrink-0"><button class="btn bg-cyan-800 hover:bg-cyan-700 border-cyan-500 py-2 px-4 font-bold" onclick="AFK_TTMI_ITEMS.gacha(1)"'+(dia>=GACHA_DIA?'':' disabled')+'>抽 1 次</button><button class="btn bg-cyan-900 hover:bg-cyan-800 border-cyan-600 py-2 px-4 font-bold" onclick="AFK_TTMI_ITEMS.gacha(10)"'+(dia>=GACHA_DIA*10?'':' disabled')+'>抽 10 次</button></div></div>';}
    var list=gachaTab?[]:a.slice(catalogue.page*PAGE,(catalogue.page+1)*PAGE);
    if(gachaTab){div.innerHTML=h;return;}
    if(!list.length)h+='<p class="text-slate-500 text-sm" style="padding:16px 0">沒有符合的物品。</p>';
    list.forEach(function(x){h+=x.recipe!=null?craftRow(x.recipe):shopRow(x.id);});
    h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0"><button class="btn" onclick="AFK_TTMI_ITEMS.page(-1)"'+(catalogue.page<=0?' disabled':'')+'>上一頁</button><span>'+(catalogue.page+1)+' / '+pages+' 頁（共 '+a.length.toLocaleString()+' 項）</span><button class="btn" onclick="AFK_TTMI_ITEMS.page(1)"'+(catalogue.page>=pages-1?' disabled':'')+'>下一頁</button></div>';div.innerHTML=h;
  }
  function redrawCatalogue(){if(typeof document!=='undefined')renderCatalogue(document.getElementById('interaction-content'));}
  function openCatalogue(mode){if(!enabled()||!atTown())return;catalogue.mode=mode;catalogue.page=0;if(typeof openTownFloatWindow==='function')openTownFloatWindow(mode==='craft'?'工匠 薩克':'古物商人 洛依',mode==='craft'?'材料與古物製作':SHOP_TITLE,renderCatalogue);}
  function buy(id,qty){
    if(!enabled()||!atTown()||stock.indexOf(id)<0||DB.items[id].gmOnly||!Number.isInteger(qty)||qty<1||qty>100)return false;
    var dia=priceDia(id);
    if(dia){var need=dia*qty,have=0;try{have=Math.floor(Number(window.pandoraGetSharedDiamonds())||0);}catch(e){}if(have<need){say('龍之鑽石不夠（需要 '+need.toLocaleString()+'）。');return false;}
      var pr={};try{pr=window.pandoraAdjustSharedDiamonds(-need)||{};}catch(e){}if(!pr.ok){say('龍之鑽石扣款失敗。');return false;}give(id,qty);refresh();save();redrawCatalogue();return true;}
    var total=price(id)*qty;if(!Number.isSafeInteger(total)||total<=0||(player.gold||0)<total){say('你的金幣不夠。');return false;}
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
    if(!enabled()||!inRift())return;var run=String(state._riftRunKey||state.riftStartMs||'active');   /* afk-rift2 會依遊戲時間改寫 riftStartMs，用固定的場次編號 */if(player.ttmiRiftRunKey===run){riftButton();return;}
    clearRift();player.ttmiRiftRunKey=run;give(creditId,10);say('裂痕守衛遞來 10 枚戰勳：「擊倒敵人還能再得，拿去換這一場的補給。」');riftButton();
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
    if(!enabled()||!inRift()||riftIds.indexOf(id)<0)return false;var d=DB.items[id];if(!d.ttmiCost||!take(creditId,d.ttmiCost)){say('你的裂痕戰勳不夠。');return false;}
    give(id,1);refresh();save();renderRiftSupplies();return true;
  }
  wrap('enterRiftMap',function(old,self,args){var r=old.apply(self,args);beginRift();return r;});
  function endRift(old,self,args){var active=inRift(),r=old.apply(self,args);if(active&&!state.riftRun){clearRift();refresh();}return r;}
  wrap('riftEndRun',endRift,endRift);
  wrap('killMob',function(old,self,args){var m=mapState&&mapState.mobs&&mapState.mobs[args[0]],eligible=inRift()&&m&&!m._dead&&!m._ttmiCreditGiven&&m.race!=='建築';
    // 生命之葉（玩家 2026-10-27）：所有頭目與「首領」被打倒時固定 1%，不吃組隊、席琳、夢域等任何掉落倍率；攻城守軍、星迴試煉、軍王之室小怪不算
    var leafOk=!!(leafId&&m&&!m._dead&&!m._ttmiLeaf&&(m.boss||/首領/.test(m.n||''))&&m.race!=='建築'&&!m.siegeV2&&!m.siegeEnemy&&!m._dreamStar);
    var r=old.apply(self,args);
    if(leafOk&&m._dead&&!m._ttmiLeaf){m._ttmiLeaf=true;if(Math.random()<0.01){give(leafId,1);say('<span class="text-emerald-300 font-bold">✦ '+esc(m.n)+' 留下了一片 '+esc(DB.items[leafId].n)+'。</span>');}}
    if(eligible&&m._dead&&inRift()&&!m._ttmiCreditGiven){m._ttmiCreditGiven=true;give(creditId,m.boss?10:1);}return r;});
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
    var on=enabled(),town=DB.towns[TOWN],stown=DB.towns[SHOP_TOWN];
    if(on){addNpc(SHOP,'古物商人 洛依',SHOP_TITLE);addNpc(WORKSHOP,'工匠 薩克','材料與古物製作');}
    else [town,stown].forEach(function(t){if(t&&t.npcs)t.npcs=t.npcs.filter(function(n){return n.id!==SHOP&&n.id!==WORKSHOP;});});
    if(typeof CRAFT_RECIPES!=='undefined')CRAFT_RECIPES[WORKSHOP]=on?recipes:[];
    if(typeof MOB_DROPS!=='undefined')addedDrops.forEach(function(x){
      var list=MOB_DROPS[x.mob]||(MOB_DROPS[x.mob]=[]),at=list.indexOf(x.entry);
      if(on){if(at<0&&!list.some(function(e){return e[0]===x.entry[0];}))list.push(x.entry);}
      else if(at>=0)list.splice(at,1);
    });
    if(typeof buildRecipeIndex==='function')buildRecipeIndex();
    if(!on&&typeof document!=='undefined'){closeRiftSupplies();var b=document.getElementById('ttmi-rift-button');if(b)b.remove();}
  }
  // 玩家 2026-10-30 12:19／12:48：禮盒整理
  //   ①四種永恆禮盒（回覆／集中／體力／魔力）合成一種「永恆禮盒」：開到戒指盒時，四種戒指盒隨機一個；
  //     掉落改成只掉這一種（同一隻怪原本掉好幾種＝取其中最高的掉落率，不疊加）。舊的三種不再掉落，背包裡的照樣能開，內容一樣。
  //   ②「魔法娃娃：小思克巴(商城)」＝本作原本就有的「魔法娃娃：小思克巴」→ 禮盒直接開出本作那一隻。
  //   ③神力藥水（150%～250%）狩獵經驗倍率上限 ×2。
  (function(){
    var BOX=resolve(10246),OLD=[10247,10248,10249].map(resolve).filter(Boolean),RINGS=[10251,10252,10253,10254];
    var core=DB.items['doll_小思克巴'],shop=DB.items[resolve(7097)];
    if(core&&shop&&resolve(7097)!=='doll_小思克巴'){shop.n=core.n;shop.ttmiDup='doll_小思克巴';shop.ttmiEvent=true;sourceIds[7097]='doll_小思克巴';}
    if(BOX&&DB.items[BOX]&&rows[BOX]){
      var list=(rows[BOX].contents||[]).map(function(x){return RINGS.indexOf(x.sourceId)>=0?{sourceId:x.sourceId,min:x.min,max:x.max,pickAny:RINGS.slice()}:x;});
      var names=RINGS.map(function(sid){var d=DB.items[resolve(sid)];return d?String(d.n).replace('戒指盒',''):null;}).filter(Boolean).join('／');
      var desc='隨機取得下列一種：永恆糖果 ×10、戒指盒 ×1（'+names+'隨機一種）、巧克力蛋糕 ×5、'+
        list.filter(function(x){var d=DB.items[resolve(x.sourceId)];return d&&d.doll;}).map(function(x){return DB.items[resolve(x.sourceId)].n+' ×1';}).join('、')+'等 '+list.length+' 種獎勵。';
      [BOX].concat(OLD).forEach(function(id){var r=rows[id];if(!r)return;r.contents=list;var d=DB.items[id];
        if(id===BOX){d.n='永恆禮盒';d.d=desc;}else{d.ttmiRetired=true;d.ttmiMergedInto=BOX;d.d='（舊版禮盒，已不再掉落）內容與「永恆禮盒」相同：'+desc;}});
      if(typeof MOB_DROPS!=='undefined'){
        var best={};
        for(var i=addedDrops.length-1;i>=0;i--){var x=addedDrops[i],id=x.entry[0];if(id!==BOX&&OLD.indexOf(id)<0)continue;
          best[x.mob]=Math.max(best[x.mob]||0,x.entry[1]);var L=MOB_DROPS[x.mob],j=L?L.indexOf(x.entry):-1;if(j>=0)L.splice(j,1);addedDrops.splice(i,1);}
        Object.keys(best).forEach(function(mob){var entry=[BOX,best[mob]],L=MOB_DROPS[mob]=MOB_DROPS[mob]||[];L.push(entry);addedDrops.push({mob:mob,entry:entry});});
      }
    }
    [9589,9590,9591,9592,9593].forEach(function(sid){var d=DB.items[resolve(sid)];if(!d||!d.ttmiBuff||!(d.ttmiBuff.ttmiExpMult>2))return;
      d.ttmiOrigExpMult=d.ttmiBuff.ttmiExpMult;d.ttmiBuff.ttmiExpMult=2;d.d=String(d.d||'').replace(/×\s*[\d.]+/,'×2.0');});
  })();

  // ── 變身卷軸系列全部移除（玩家 2026-10-31 05:09）：只留遊戲原本的「變形卷軸」（scroll_poly）——
  //    透視鏡匯入的各式變形／變身卷軸（邊境的、Lv52～65、黃金、英雄之、黑帝斯之、潘朵拉、少女賽尼斯、裂痕專用…）、變身石、修練者解咒卷軸、
  //    只裝這些卷軸的道具包；薩克那邊做這些東西的配方；只被這些配方用到的材料——全部不掉、不賣、不能做。舊存檔裡已有的保留。
  var polyGone=Object.create(null);
  (function(){
    var RE=/變形卷軸|變身卷軸|變身石|少女賽尼斯|^修練者解咒卷軸$/;
    imported.forEach(function(id){var d=DB.items[id];if(d&&(d.ttmiAction==='poly'||RE.test(d.n||'')))polyGone[id]=1;});
    imported.forEach(function(id){var d=DB.items[id],row=rows[id];if(!d||polyGone[id]||d.ttmiAction!=='box'||!row||!row.contents||!row.contents.length)return;
      if(row.contents.every(function(x){var c=resolve(x.sourceId);return !c||polyGone[c];}))polyGone[id]=1;});
    var reqOf=Object.create(null);
    for(var i=recipes.length-1;i>=0;i--){var r=recipes[i];if(polyGone[r.result]){r.req.forEach(function(q){reqOf[q.id]=1;});recipes.splice(i,1);}}
    var used=Object.create(null);
    try{Object.keys(CRAFT_RECIPES).forEach(function(k){(CRAFT_RECIPES[k]||[]).forEach(function(r){(r.req||[]).forEach(function(q){used[q.id]=1;});});});}catch(e){}
    recipes.forEach(function(r){r.req.forEach(function(q){used[q.id]=1;});});
    Object.keys(reqOf).forEach(function(id){var d=DB.items[id];if(id!=='gold'&&d&&!used[id]&&d.ttmiMaterial&&imported.indexOf(id)>=0&&!stock.some(function(x){return x===id;}))polyGone[id]=1;});
    Object.keys(polyGone).forEach(function(id){var d=DB.items[id];if(!d)return;d.ttmiEvent=true;d.ttmiRetired=true;d.ttmiPolyRemoved=true;d.gachaWeight=0;});
    var strip=function(t){if(!t)return;Object.keys(t).forEach(function(m){var L=t[m];if(!Array.isArray(L))return;for(var j=L.length-1;j>=0;j--){var e=L[j],eid=Array.isArray(e)?e[0]:e;if(polyGone[eid])L.splice(j,1);}});};
    try{strip(MOB_DROPS);}catch(e){}try{strip(DARK_WEAPON_DROPS);}catch(e){}try{strip(DARK_CRYSTAL_DROPS);}catch(e){}try{strip(DRAGON_DROPS);}catch(e){}try{strip(WARRIOR_DROPS);}catch(e){}try{strip(MEM_DROPS);}catch(e){}
    for(var k=addedDrops.length-1;k>=0;k--)if(polyGone[addedDrops[k].entry[0]])addedDrops.splice(k,1);
    stock=stock.filter(function(id){return !polyGone[id];});
    for(var q=riftIds.length-1;q>=0;q--)if(polyGone[riftIds[q]])riftIds.splice(q,1);
    for(var g=gachaPool.length-1;g>=0;g--)if(polyGone[gachaPool[g]])gachaPool.splice(g,1);
  })();

  syncAvailability();
  if(T&&typeof T.set==='function'){
    var oldToggle=T.set;
    T.set=function(id,on){var r=oldToggle.apply(this,arguments);if(id==='ttmi-items'){
      syncAvailability();if(enabled()&&inRift())beginRift();
      if(playerReady())refresh();if(window.AFK_DEX_API&&AFK_DEX_API.refresh)AFK_DEX_API.refresh();
    }return r;};
  }

  window.AFK_TTMI_ITEMS={
    sourceIds:sourceIds,items:imported,recipes:recipes,source:data,resolve:resolve,bonus:bonus,conditional:conditional,price:price,buy:buy,buyQty:function(id){var el=typeof document!=='undefined'&&document.getElementById('ttmi-qty-'+id),q=Math.max(1,Math.min(100,Math.floor(Number(el&&el.value)||1)));return buy(id,q);},craft:craft,riftBuy:riftBuy,enabled:enabled,
    acquisition:acquisition,polyGone:function(){return Object.keys(polyGone);},priceDia:priceDia,gacha:gacha,gachaPool:function(){return gachaPool.slice();},isEvent:isEvent,whyNot:whyNot,refineCost:function(id){return refineCost[id]||null;},junk:function(){return Object.keys(junkTier).map(function(id){return {id:id,tier:junkTier[id]};});},gearMax:function(){return GEAR_MAX;},shopStock:function(){return stock.slice();},
    beginRift:beginRift,clearRift:clearRift,inRift:inRift,openRift:openRiftSupplies,closeRift:closeRiftSupplies,
    coverage:function(){return {registered:imported.length,catalogueCandidates:data.items.length,reusedCandidates:data.items.filter(function(r){return resolve(r.sourceId)!==r.id;}).map(function(r){return {sourceId:r.sourceId,id:resolve(r.sourceId),n:r.n};}),sourceItems:data.sourceItems,sourcePages:data.sourcePages,recipes:recipes.length,dropMobs:Object.keys(dropPools).length,riftItems:riftIds.length,rejectedRecipes:rejectedRecipes.slice()};},
    mode:function(m){if(!enabled()||!atTown())return;catalogue.mode=m==='craft'?'craft':'shop';catalogue.page=0;catalogue.kind='all';redrawCatalogue();},
    search:function(){if(!enabled()||!atTown())return;var el=document.getElementById('ttmi-search');catalogue.query=el?el.value:'';catalogue.page=0;redrawCatalogue();},
    kind:function(k){if(!enabled()||!atTown())return;catalogue.kind=k;catalogue.page=0;redrawCatalogue();},
    tab:function(t){if(!enabled()||!atTown())return;catalogue.tab=t==='gacha'?'gacha':'supply';catalogue.page=0;catalogue.kind='all';redrawCatalogue();},
    page:function(step){if(!enabled()||!atTown())return;catalogue.page+=step;redrawCatalogue();}
  };
  console.log('[AFK-ttmi-items] '+imported.length+' 件物品、'+recipes.length+' 條配方、'+riftIds.length+' 件裂痕補給已登錄。');
})();
