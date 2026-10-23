/*
 * Diamond collections and three independent card-ascension tracks.
 * First diamond cards already live permanently in cardDex (afk-cardplus);
 * only unlocked inventory copies can be spent. No collection entry is removed.
 * Combat definitions are supplied by AFK_CARD_FORMS; this module owns access,
 * inventory transactions, persistent ownership, pity, and native scroll UI.
 */
(function () {
  'use strict';
  if (window.AFK_CARD_ASCENSION) return;
  var TOGGLE = 'card-ascension';
  if (window.AFK_TOGGLES) AFK_TOGGLES.register({id:TOGGLE,name:'鑽石變身與高階卡合成',desc:'鑽石卡解鎖怪物變身，重複卡可合成神話、天上與時空卡。',group:'遊戲玩法',parent:'cardplus'});
  var enabled = function () { return !window.AFK_TOGGLES || AFK_TOGGLES.enabled(TOGGLE); };
  if (typeof CARD_MOB_INFO === 'undefined' || !window.useItem || !window.findPolyForm) {
    console.warn('[AFK-card-ascension] Card or polymorph system missing.'); return;
  }
  var TIERS = ['mythic','celestial','spacetime','samsara'];
  var RULES = {
    mythic:{n:'神話',rate:.5,color:'#fb923c',mat:'變身金卡',fail:'材料：5 張變身金卡。失敗什麼都沒有。'},
    celestial:{n:'天上',rate:.3,color:'#fde68a',mat:'怪物白金卡',fail:'材料：5 張怪物白金卡。失敗得到 1 枚鑽石卡碎片（5 枚換 1 張尚未收藏的鑽石卡）。'},
    spacetime:{n:'時空',rate:.1,color:'#c4b5fd',mat:'怪物鑽石卡',fail:'材料：5 張怪物鑽石卡。失敗：下次時空合成成功率 +5%（可累加，最高 50%），再得到 1 枚時空變身碎片。'},
    samsara:{n:'聖衣',rate:.05,color:'#fcd34d',mat:'怪物鑽石卡',fail:'材料：5 張怪物鑽石卡。失敗得到 1 枚時空變身碎片。第一次取得是封印聖衣，再取得同一件解除封印。沒回安全區連續戰鬥 30 分鐘會解除變身，冷卻 30 分鐘。'}
  };
  // 玩家 2026-10-23：天上失敗給鑽石卡碎片；時空失敗累加成功率、給時空變身碎片與鑽石卡；碎片 30 枚指定時空變身（封印型態），10 枚解除封印
  var DSHARD = 'afk_card_diamond_shard', STSHARD = 'afk_card_spacetime_shard', ST_BONUS = .05, ST_CAP = .5, DSHARD_COST = 5, ST_PICK = 30, ST_UNSEAL = 10;
  var CHOICE = 'afk_card_celestial_choice', FRAGMENT = 'afk_card_celestial_fragment', DIAMOND_CHOICE = 'afk_card_diamond_missing_choice';
  var catalog = {mythic:[],celestial:[],spacetime:[],samsara:[]}, byId = Object.create(null), byName = Object.create(null);
  var busy = false, modalLayer = null;
  var clone = function (x) { return x == null ? x : JSON.parse(JSON.stringify(x)); };
  var integer = function (x) { return Math.max(0,Math.floor(Number(x)||0)); };
  var count = function (it) { return it && it.cnt == null ? 1 : integer(it && it.cnt); };
  var escape = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g,function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var say = function (s) { if (typeof logSys === 'function') logSys(escape(s)); };
  var forms = function () { return window.AFK_CARD_FORMS; };
  var monsterNames = function () { var f=forms(); return f && f.monsterNames ? f.monsterNames() : Object.keys(CARD_MOB_INFO); };
  var isMonster = function (name) { var f=forms(); return f && f.isMonsterName ? f.isMonsterName(name) : !!CARD_MOB_INFO[name]; };
  var monsterForm = function (name) { var f=forms(); return f && f.monsterForm ? f.monsterForm(name) : null; };
  function data(actor, create) {
    actor = actor || player;
    var s = actor && actor.cardAscension;
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      s = {v:1,owned:{},failures:{},attempts:{},unlocked:{},rewardSeq:0};
      if (create && actor) actor.cardAscension = s;
    }
    if (create) {
      ['owned','failures','attempts','unlocked','sealed','bonus'].forEach(function (k) { if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = {}; });
      s.v = 1;
    }
    return s;
  }
  function diamondOwned(name, actor) {
    actor = actor || player;
    if (!actor || !isMonster(name)) return false;
    // Native mercenary recomputation temporarily borrows the same-mode dex and
    // removes it afterward. Read its own mode's shared collection when absent.
    var dex = actor.cardDex;
    if (!dex) try {
      var raw = _lzGet(_dexKey(CARDDEX_KEY,actor));
      dex = raw ? JSON.parse(raw) : {};
      if (dex._v !== 2) return false;
    } catch (e) { dex = {}; }
    return Number(dex[name]) >= 10000;
  }
  function owned(id, actor) { return !!(byId[id] && (data(actor).owned || {})[id]); }
  // 輪迴缺點（玩家 2026-10-23）：沒回安全區連續戰鬥 30 分鐘解除變身，冷卻 30 分鐘（存檔用真實時間）
  var SAMSARA_FIGHT = 18000, SAMSARA_CD = 30 * 60 * 1000;
  function samsaraCd(actor) { var s = data(actor); return Math.max(0, (Number(s && s.samsaraCdUntil) || 0) - Date.now()); }
  function samsaraTick(actor, step, safe) {
    actor = actor || player; if (!actor || !actor.cardAscension) return false;
    var s = actor.cardAscension, f = actor.poly, on = !!(f && f.cardAscensionTier === 'samsara' && actor.buffs && actor.buffs.poly > 0);
    if (f && f.cardAscensionTier === 'samsara' && typeof f.n === 'string' && f.n.indexOf('輪迴・') === 0) f.n = f.n.slice(3);   // 舊名「輪迴・X聖衣」→「X聖衣」（玩家 2026-10-24 改名）
    if (safe || !on) { if (s.samsaraFight) s.samsaraFight = 0; return false; }
    s.samsaraFight = (Number(s.samsaraFight) || 0) + step;
    if (s.samsaraFight < SAMSARA_FIGHT) return false;
    s.samsaraFight = 0; s.samsaraCdUntil = Date.now() + SAMSARA_CD;
    actor.poly = null; actor.buffs.poly = 0;
    say('連續戰鬥 30 分鐘，聖衣的力量耗盡，變身解除（冷卻 30 分鐘，期間只能用其他變身）。');
    try { if (typeof calcStats === 'function') calcStats(); } catch (e) {}
    return true;
  }
  function sealed(id, actor) { return owned(id, actor) && !!(data(actor).sealed || {})[id]; }
  function rateOf(tier, actor) { var b = tier === 'spacetime' ? Math.max(0, Number((data(actor).bonus || {}).spacetime) || 0) : 0; return Math.min(tier === 'spacetime' ? ST_CAP : 1, RULES[tier].rate + b); }
  function listOwned(actor) { return TIERS.reduce(function (out,t) { return out.concat(catalog[t].filter(function (r) { return owned(r.id,actor); })); },[]); }
  function diamondFull(actor) { var ns=monsterNames(); return !!ns.length && ns.every(function (n) { return diamondOwned(n,actor); }); }
  function completedRegions(actor) {
    return CARD_REGIONS.filter(function(r){var ns=CARD_REGION_MOBS[r.key]||[];return ns.length>0&&ns.every(function(n){return diamondOwned(n,actor);});}).map(function(r){return {key:r.key,n:r.name};});
  }
  function unlocked(tier, actor) {
    var s=data(actor), o=s.owned||{};
    if ((s.unlocked||{})[tier]) return true;
    // 玩家 2026-10-23：任一地區怪物圖鑑全白金 → 開放神話；神話收集一半 → 同時開放天上、時空
    if (tier==='mythic') return platinumRegion(actor);
    if (tier==='samsara') return catalog.spacetime.length>0 && catalog.spacetime.every(function (r) { return !!o[r.id]; });   // 時空變身收集滿（封印的也算）
    var half=Math.ceil(catalog.mythic.length/2);
    return catalog.mythic.length>0 && catalog.mythic.filter(function (r) { return !!o[r.id]; }).length>=half;
  }
  function syncUnlocks(actor) {
    actor=actor||player;
    if (!actor || !actor.cls) return false;
    var changes=TIERS.filter(function (t) { return unlocked(t,actor) && !(data(actor).unlocked||{})[t]; });
    if (!changes.length) return false;
    var s=data(actor,true);changes.forEach(function(t){s.unlocked[t]=true;});return true;
  }
  function excessCards(actor) {
    actor=actor||player;
    return (actor && actor.inv || []).filter(function (it) {
      var d=it&&DB.items[it.id];
      return !!(d && d.eff==='card' && d.cardTier===5 && !it.lock && count(it)>0 && diamondOwned(d.cardMob,actor));
    });
  }
  function platinumRegion(actor) {
    try { return CARD_REGIONS.some(function (r) { return (CARD_REGION_MOBS[r.key]||[]).length>0 && typeof cardRegionTier==='function' && cardRegionTier(r.key)>=4; }); } catch (e) { return false; }
  }
  // 各階材料：神話＝變身金卡（afk-poly-codex）；天上＝已登錄白金的怪物白金卡；時空＝已登錄鑽石的怪物鑽石卡
  function matCards(tier, actor) {
    actor=actor||player;
    if (tier==='spacetime'||tier==='samsara') return excessCards(actor);
    return (actor && actor.inv || []).filter(function (it) {
      var d=it&&DB.items[it.id]; if (!d || it.lock || count(it)<=0) return false;
      if (tier==='mythic') return d.eff==='afk_pcard' && d.pcardTier===3;
      return d.eff==='card' && d.cardTier===4 && typeof cardDexTier==='function' && cardDexTier(d.cardMob)>=4;
    });
  }
  function matCount(tier, actor) { return matCards(tier,actor).reduce(function (n,it) { return n+count(it); },0); }
  function excessCount(actor) { return excessCards(actor).reduce(function (n,it) { return n+count(it); },0); }
  function itemCount(id, actor) { return (actor && actor.inv || player.inv || []).reduce(function (n,it) { return n+(it.id===id&&!it.lock?count(it):0); },0); }
  function take(pool,n) {
    if (pool.reduce(function (v,it) { return v+count(it); },0)<n) return false;
    pool.forEach(function (it) { var q=Math.min(n,count(it));if(q){it.cnt=count(it)-q;n-=q;} });
    player.inv=player.inv.filter(function (it) { return count(it)>0; });
    if (typeof resetCatchupGainItemIndex==='function') resetCatchupGainItemIndex();
    return true;
  }
  function rng(actor,tier,seq,purpose) {
    var key=String(actor.enSeed||'card')+'|cardAscension|'+tier+'|'+seq+'|'+purpose;
    if (typeof _seededFloat==='function') return _seededFloat(key);
    var h=2166136261;for(var i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619);}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;return (h>>>0)/4294967296;
  }
  function ready() {
    if (!enabled()) return '請先開啟鑽石變身與高階卡合成。';
    if (!player || !player.cls) return '請先載入角色。';
    if (player.dead) return '請先復活。';
    if (typeof inAbsBarrier==='function' && inAbsBarrier()) return '絕對屏障期間無法使用道具。';
    if (typeof _roleSaveAllowed==='function' && !_roleSaveAllowed()) return '角色存檔已變更，請重新載入角色。';
    return '';
  }
  function refresh() {
    try { if (typeof calcStats==='function') calcStats(); } catch(e){}
    try { renderTabs(true);updateUI(); } catch(e){}
    var p=document.getElementById('afk-card-ascension-synth');if(p)renderSynth(p.parentElement);
    if(document.getElementById('afk-card-ascension-collection'))drawCollection();
    try{var cx=document.getElementById('afk-codex');if(cx&&window.AFK_CARD_CODEX)AFK_CARD_CODEX.renderBook(cx.parentElement);}catch(e){}   // 變身卡冊（afk-card-codex）跟著更新
  }
  function transaction(action) {
    var error=ready();if(error)return {ok:false,msg:error};
    if(typeof catchupActive==='function'&&catchupActive())return {ok:false,msg:'正在結算戰鬥進度，請稍後再合成或兌換。'};
    if(busy)return {ok:false,msg:'上一筆合成尚未完成。'};
    busy=true;
    var inv=clone(player.inv),old=clone(player.cardAscension),dex=clone(player.cardDex),misc=clone(player.miscDex),dexV=player.cardDexV,result,committed=false;
    // Acquisition also updates the account's shared collections. Defer those
    // writes until the character transaction commits so a rejected save cannot
    // keep a free refund card while returning its synthesis materials.
    var cardSave=window.saveCardDex,miscSave=window.saveMiscDex,cardDirty=false,miscDirty=false;
    if(typeof cardSave==='function')window.saveCardDex=function(){cardDirty=true;};
    if(typeof miscSave==='function')window.saveMiscDex=function(){miscDirty=true;};
    function rollback(){
      player.inv=inv;
      [['cardAscension',old],['cardDex',dex],['miscDex',misc],['cardDexV',dexV]].forEach(function(pair){if(pair[1]===undefined)delete player[pair[0]];else player[pair[0]]=pair[1];});
      if(typeof resetCatchupGainItemIndex==='function')resetCatchupGainItemIndex();
    }
    try {
      result=action();
      if(!result || !result.ok)return result||{ok:false,msg:'目前無法完成，請稍後再試。'};
      syncUnlocks(player);
      if(typeof saveGame==='function' && saveGame()===false) {
        // saveGame may write the character successfully and subsequently fail
        // a separate pet save. Roll back only when the role did not commit.
        var saved=null;try { saved=JSON.parse(_saveUnwrap(_lzGet('lineage_idle_save_'+currentSlot)).payload).p; } catch(e){}
        if(!saved || JSON.stringify(saved.cardAscension)!==JSON.stringify(player.cardAscension) || JSON.stringify(saved.inv)!==JSON.stringify(player.inv)) {
          rollback();
          return {ok:false,msg:'進度未能儲存，材料已保留；請備份進度後再試。'};
        }
      }
      committed=true;
      return result;
    } catch(e) {
      rollback();
      console.warn('[AFK-card-ascension] Transaction failed.',e);
      return {ok:false,msg:'本次操作未完成，材料已保留。'};
    } finally {
      if(typeof cardSave==='function')window.saveCardDex=cardSave;
      if(typeof miscSave==='function')window.saveMiscDex=miscSave;
      if(committed){if(cardDirty)cardSave();if(miscDirty)miscSave();}
      busy=false;refresh();
    }
  }
  function randomDiamond(tier,purpose) {
    var s=data(player,true),seq=integer(s.rewardSeq)+1;s.rewardSeq=seq;
    var ns=monsterNames().filter(function(n){return !!DB.items[cardId(n,5)];});
    if(!ns.length)throw Error('No ordinary diamond refund pool');
    var n=ns[Math.floor(rng(player,tier,seq,purpose)*ns.length)];
    acquireCard(n,5,1);
    return {kind:'diamond',id:cardId(n,5),n:n+' 的鑽石卡'};
  }
  // 變身卡冊（玩家 2026-10-23）：第一次取得＝點亮；之後每取得一次升 1 星，最多 7 星（共 8 次）；滿星後再取得才返還鑽石卡
  var MAX_COPIES=8;
  function copiesOf(id,actor){var s=data(actor);if(!(s.owned||{})[id])return 0;return Math.max(1,Math.min(MAX_COPIES,integer((s.copies||{})[id])||1));}
  function starsOf(id,actor){return Math.max(0,copiesOf(id,actor)-1);}
  function randomMissingDiamond(tier,purpose) {
    var s=data(player,true),seq=integer(s.rewardSeq)+1;s.rewardSeq=seq;
    var ns=monsterNames().filter(function(n){return !!DB.items[cardId(n,5)]&&!diamondOwned(n,player);});
    if(!ns.length)return randomDiamond(tier,purpose);
    var n=ns[Math.floor(rng(player,tier,seq,purpose)*ns.length)];
    acquireCard(n,5,1);
    return {kind:'diamond',id:cardId(n,5),n:n+' 的鑽石卡'};
  }
  function grant(row) {
    var s=data(player,true);if(!s.copies||typeof s.copies!=='object')s.copies={};
    if((s.owned||{})[row.id]&&s.sealed[row.id]){delete s.sealed[row.id];if(row.tier==='samsara')s.copies[row.id]=2;return {kind:'unseal',id:row.id,n:row.n};}
    if(!(s.owned||{})[row.id]&&row.tier==='samsara'){s.owned[row.id]=true;s.copies[row.id]=1;s.sealed[row.id]=true;return {kind:'sealed',id:row.id,n:row.n};}
    if((s.owned||{})[row.id]&&row.tier==='samsara'){var dup=randomDiamond(row.tier,'duplicate');dup.kind='duplicate';dup.cardId=row.id;return dup;}
    if((s.owned||{})[row.id]) {
      var c=copiesOf(row.id,player);
      if(c<MAX_COPIES){s.copies[row.id]=c+1;return {kind:'star',id:row.id,n:row.n,stars:c};}
      var duplicate=randomDiamond(row.tier,'duplicate');duplicate.kind='duplicate';duplicate.cardId=row.id;return duplicate;
    }
    s.owned[row.id]=true;s.copies[row.id]=1;
    return {kind:'unlock',id:row.id,n:row.n};
  }
  function rewardText(r,tierName){
    if(!r)return '';
    if(r.kind==='star')return '「'+r.n+'」在卡冊升到 '+r.stars+' 星'+(r.stars>=7?'（滿星）':'')+'。';
    if(r.kind==='duplicate')return '「'+(byId[r.cardId]?byId[r.cardId].n:'這張卡')+'」已'+(byId[r.cardId]&&byId[r.cardId].tier==='samsara'?'解除封印':'滿 7 星')+'，返還「'+r.n+'」。';
    if(r.kind==='unlock')return '點亮卡冊「'+r.n+'」，已永久解鎖變身。';
    if(r.kind==='sealed')return '取得封印型態的「'+r.n+'」（效果減半／封印聖衣），再取得一次即可解除封印。';
    if(r.kind==='unseal')return '「'+r.n+'」解除封印，發揮完整力量！';
    if(r.kind==='multi')return r.list.map(function(x){return '「'+x.n+'」';}).join('、');
    return '取得「'+r.n+'」。';
  }
  function status(actor) {
    actor=actor||player;var s=data(actor),ns=monsterNames();
    return {diamonds:ns.filter(function(n){return diamondOwned(n,actor);}).length,total:ns.length,completedRegions:completedRegions(actor),excess:excessCount(actor),fragments:itemCount(FRAGMENT,actor),diamondShards:itemCount(DSHARD,actor),spacetimeShards:itemCount(STSHARD,actor),tiers:TIERS.map(function(t){var fail=Math.min(10,integer((s.failures||{})[t]));return {tier:t,n:RULES[t].n,rate:rateOf(t,actor),unlocked:unlocked(t,actor),failures:fail,guaranteed:fail>=10,attempts:integer((s.attempts||{})[t]),mat:matCount(t,actor),owned:catalog[t].filter(function(r){return owned(r.id,actor);}).length,total:catalog[t].length};})};
  }
  function synthesize(tier) {
    var result=transaction(function(){
      if(TIERS.indexOf(tier)<0 || !catalog[tier].length)return {ok:false,msg:'此階卡片尚未開放。'};
      if(!unlocked(tier,player))return {ok:false,msg:tier==='mythic'?'請先讓任一地區的怪物圖鑑全部達到白金卡。':tier==='samsara'?'請先收集全部 '+catalog.spacetime.length+' 種時空變身。':'請先收集一半的神話變身（'+Math.ceil(catalog.mythic.length/2)+' 種）。'};
      if(matCount(tier,player)<5)return {ok:false,msg:'需要 5 張未鎖定的'+RULES[tier].mat+'。'};
      var s=data(player,true),seq=integer(s.attempts[tier])+1,pity=integer(s.failures[tier])>=10;
      var success=pity || rng(player,tier,seq,'success')<rateOf(tier,player);
      if(!take(matCards(tier,player),5))return {ok:false,msg:'材料數量已改變，請重試。'};
      s.attempts[tier]=seq;s.failures[tier]=success?0:Math.min(10,integer(s.failures[tier])+1);
      var reward=null;
      if(success){
        var rows=catalog[tier];
        reward=grant(rows[Math.floor(rng(player,tier,seq,'card')*rows.length)]);
        if(tier==='spacetime')s.bonus.spacetime=0;
      }
      else if(tier==='mythic'){reward=null;}
      else if(tier==='celestial'){gainItem(DSHARD,1,true,true);reward={kind:'item',id:DSHARD,n:'鑽石卡碎片'};}
      else if(tier==='spacetime'){
        s.bonus.spacetime=Math.min(ST_CAP-RULES.spacetime.rate,(Number(s.bonus.spacetime)||0)+ST_BONUS);
        gainItem(STSHARD,1,true,true);reward={kind:'item',id:STSHARD,n:'時空變身碎片'};
      }
      else if(tier==='samsara'){gainItem(STSHARD,1,true,true);reward={kind:'item',id:STSHARD,n:'時空變身碎片'};}
      return {ok:true,tier:tier,success:success,guaranteed:pity,spent:5,failures:s.failures[tier],reward:reward};
    });
    if(result.ok){say(result.success?rewardText(result.reward):'合成失敗'+(result.reward?'，取得「'+result.reward.n+'」。':'，消耗 5 張'+RULES[tier].mat+'。')+(tier==='spacetime'?'下次時空合成成功率 '+Math.round(rateOf('spacetime',player)*100)+'%。':''));}
    else if(result.msg)say(result.msg);
    return result;
  }
  function acquire(id) {
    return transaction(function(){var row=byId[id];if(!row)return {ok:false,msg:'找不到這張卡片。'};return {ok:true,reward:grant(row)};});
  }
  function exchangeFragments() {
    var result=transaction(function(){
      var pool=player.inv.filter(function(it){return it.id===FRAGMENT&&!it.lock;});
      if(!take(pool,10))return {ok:false,msg:'需要 10 枚未鎖定的天上自選碎片。'};
      gainItem(CHOICE,1,true,true);return {ok:true,spent:10,reward:{id:CHOICE,n:'天上卡自選'}};
    });
    say(result.ok?'已用 10 枚碎片換取 1 張天上卡自選。':result.msg);return result;
  }
  function exchangeDiamondShards() {
    var result=transaction(function(){
      var pool=player.inv.filter(function(it){return it.id===DSHARD&&!it.lock;});
      if(!take(pool,DSHARD_COST))return {ok:false,msg:'需要 '+DSHARD_COST+' 枚未鎖定的鑽石卡碎片。'};
      return {ok:true,spent:DSHARD_COST,reward:randomMissingDiamond('celestial','shard')};
    });
    say(result.ok?'鑽石卡碎片合成「'+result.reward.n+'」。':result.msg);return result;
  }
  function chooseSpacetime(id) {
    var result=transaction(function(){
      var row=byId[id];if(!row||row.tier!=='spacetime')return {ok:false,msg:'請選擇一種時空變身。'};
      if(sealed(id,player))return {ok:false,msg:'這個變身還在封印中，請改用 '+ST_UNSEAL+' 枚碎片解除封印。'};
      var pool=player.inv.filter(function(it){return it.id===STSHARD&&!it.lock;});
      if(!take(pool,ST_PICK))return {ok:false,msg:'需要 '+ST_PICK+' 枚未鎖定的時空變身碎片。'};
      var s=data(player,true);
      if(!owned(id,player)){s.owned[id]=true;if(!s.copies)s.copies={};s.copies[id]=1;s.sealed[id]=true;return {ok:true,reward:{kind:'sealed',id:id,n:row.n}};}
      return {ok:true,reward:grant(row)};
    });
    say(result.ok?rewardText(result.reward):result.msg);if(result.ok&&document.getElementById('afk-card-ascension-modal'))openSpacetimePick();return result;
  }
  function unsealSpacetime(id) {
    var result=transaction(function(){
      var row=byId[id];if(!row||row.tier!=='spacetime'||!sealed(id,player))return {ok:false,msg:'這個時空變身沒有封印。'};
      var pool=player.inv.filter(function(it){return it.id===STSHARD&&!it.lock;});
      if(!take(pool,ST_UNSEAL))return {ok:false,msg:'需要 '+ST_UNSEAL+' 枚未鎖定的時空變身碎片。'};
      delete data(player,true).sealed[id];return {ok:true,reward:{kind:'unseal',id:id,n:row.n}};
    });
    say(result.ok?rewardText(result.reward):result.msg);if(result.ok&&document.getElementById('afk-card-ascension-modal'))openSpacetimePick();return result;
  }
  function chooseReward(uid,id) {
    var result=transaction(function(){
      var it=player.inv.find(function(x){return x.uid===uid;}),row=byId[id];
      if(!it || it.id!==CHOICE || it.lock || count(it)<1)return {ok:false,msg:'請先準備未鎖定的天上卡自選。'};
      if(!row || row.tier!=='celestial')return {ok:false,msg:'請選擇一張天上卡。'};
      take([it],1);return {ok:true,reward:grant(row)};
    });
    say(result.ok?rewardText(result.reward):result.msg);
    if(result.ok)closeCollection();return result;
  }
  function chooseDiamondReward(uid,name) {
    var result=transaction(function(){
      var it=player.inv.find(function(x){return x.uid===uid;});
      if(!it||it.id!==DIAMOND_CHOICE||it.lock||count(it)<1)return {ok:false,msg:'請先準備未鎖定的鑽石卡自選。'};
      if(!isMonster(name)||diamondOwned(name,player)||!DB.items[cardId(name,5)])return {ok:false,msg:'請選擇尚未登錄鑽石卡的怪物。'};
      take([it],1);acquireCard(name,5,1);return {ok:true,reward:{id:cardId(name,5),n:name+' 的鑽石卡'}};
    });
    say(result.ok?'已收藏「'+result.reward.n+'」。':result.msg);if(result.ok)closeCollection();return result;
  }
  function registerCatalog(input) {
    TIERS.forEach(function(t){(input&&input[t]||[]).forEach(function(spec){
      if(!spec || !spec.id || !spec.n || !spec.form)throw Error('Invalid '+t+' card definition');
      var row=Object.assign({},clone(spec),{id:String(spec.id),n:String(spec.n),tier:t,form:clone(spec.form),desc:String(spec.desc||'')});
      row.form.n=row.form.n||row.n;row.form.cardAscensionId=row.id;row.form.cardAscensionTier=t;
      var existing=byId[row.id];if(existing){catalog[existing.tier]=catalog[existing.tier].filter(function(x){return x.id!==row.id;});delete byName[existing.form.n];}
      if(byName[row.form.n] && byName[row.form.n].id!==row.id)throw Error('Duplicate card form name '+row.form.n);
      byId[row.id]=row;byName[row.form.n]=row;catalog[t].push(row);
      var itemId='afk_asc_card_'+row.id;row.itemId=itemId;
      DB.items[itemId]={n:row.n+'的'+RULES[t].n+'卡',type:'misc',eff:'afk_asc_card',cardAscensionId:row.id,p:0,gachaWeight:0,c:'text-yellow-300',img:'assets/icons/items/'+({mythic:'金卡',celestial:'白金卡',spacetime:'鑽白金幻化',samsara:'鑽石卡'}[t]||'鑽石卡')+'.png',
        d:'封存著「'+row.n+'」形貌的'+RULES[t].n+'卡。'+(t==='samsara'?'使用後取得封印聖衣；再取得一次即可解除封印，解封後重複取得返還 1 張隨機鑽石卡。':'使用後永久解鎖這個變身；再次取得在卡冊升 1 星，滿 7 星後返還 1 張隨機鑽石卡。')};
      if(typeof MISC_BOOK_EXCLUDED!=='undefined')MISC_BOOK_EXCLUDED[itemId]=true;
    });});
    return TIERS.reduce(function(n,t){return n+catalog[t].length;},0);
  }
  function rowFor(form) { return form && (byId[form.cardAscensionId]||byName[form.n]); }
  function relevant(form) { return !!(form && (rowFor(form)||form.cardMonster||isMonster(form.n))); }
  function canUseForm(form,actor) {
    actor=actor||player;if(typeof form==='string')form={n:form};if(!form)return false;
    var row=rowFor(form);if(row){
      if(form.n&&form.n!==row.form.n)return false;
      // 神話擴到 32 種後不再限 Lv70 以上（玩家 2026-10-23）；等級資料被改過的變身仍不承認
      if(form.cardNativeLevel!=null&&Number(form.cardNativeLevel)!==Number(row.form.cardNativeLevel))return false;
      if(row.tier==='samsara'&&samsaraCd(actor)>0)return false;   // 輪迴冷卻中只能用其他變身
      return owned(row.id,actor);
    }
    var nm=form.cardMonster||form.n;if(isMonster(nm))return diamondOwned(nm,actor);
    return true;
  }
  function resolve(form,actor) {
    if(!form)return null;var row=rowFor(form);
    if(row)return canUseForm(form,actor)?clone(row.form):null;
    var nm=form.cardMonster||form.n;
    if(isMonster(nm))return diamondOwned(nm,actor)?clone(monsterForm(nm)):null;
    return clone(form);
  }
  function active(actor) {
    actor=actor||player;
    if(!enabled() || !actor || actor._setPoly || !actor.buffs || !(actor.buffs.poly>0) || !actor.poly)return null;
    var row=rowFor(actor.poly);return row && canUseForm(actor.poly,actor)?row:null;
  }
  function normalize(actor) {
    if(!actor || !actor.poly || !actor.buffs || !(actor.buffs.poly>0) || !relevant(actor.poly))return;
    var f=resolve(actor.poly,actor);
    if(f)actor.poly=f;else{actor.poly=null;actor.buffs.poly=0;}
  }
  function clearDisabledForm(actor) {
    if(actor&&actor.poly&&(actor.poly.cardAscensionId||actor.poly.cardMonster)){actor.poly=null;if(actor.buffs)actor.buffs.poly=0;return true;}return false;
  }

  DB.items[CHOICE]={n:'天上卡自選',type:'misc',eff:'afk_asc_choice',p:0,gachaWeight:0,c:'text-yellow-300',img:'assets/icons/items/白金卡.png',d:'以天界羽毛凝成的空白卡面，等待被寫上一個名字。可自選一張天上卡：沒有的永久解鎖，已有的升 1 星。'};
  DB.items[FRAGMENT]={n:'天上自選碎片',type:'misc',eff:'afk_asc_fragment',p:0,gachaWeight:0,c:'text-violet-300',img:'assets/icons/items/格利芬羽毛.png',d:'碎裂的天界卡面，邊緣仍透著微光。集滿 10 枚使用，換取 1 張天上卡自選。'};
  DB.items[DIAMOND_CHOICE]={n:'鑽石卡自選（未收藏）',type:'misc',eff:'afk_asc_diamond_choice',p:0,gachaWeight:0,c:'c-card-diamond',img:'assets/icons/items/鑽石卡.png',d:'映著萬千魔物倒影的鑽石券。自選一隻尚未登錄鑽石卡的怪物（已登錄普卡至白金卡仍可選）；若已全數登錄，此券會留到有新卡可選。'};
  DB.items[DSHARD]={n:'鑽石卡碎片',type:'misc',eff:'afk_asc_dshard',p:0,gachaWeight:0,c:'c-card-diamond',img:'assets/icons/items/品質鑽石.png',d:'天上卡合成失敗時迸落的鑽石碎屑，仍殘留著魔物的魂影。集滿 5 枚使用，合成 1 張隨機的尚未收藏鑽石卡。'};
  DB.items[STSHARD]={n:'時空變身碎片',type:'misc',eff:'afk_asc_stshard',p:0,gachaWeight:0,c:'text-violet-300',img:'assets/icons/items/時空裂痕碎片.png',d:'自時空裂隙剝落的碎片，握在掌中能感覺光陰倒流。時空／聖衣卡合成失敗時取得：30 枚可指定 1 種時空變身（封印型態，效果減半），10 枚可解除 1 種時空變身的封印。'};
  [CHOICE,FRAGMENT,DIAMOND_CHOICE,DSHARD,STSHARD].forEach(function(id){
    if(typeof miscCatKey!=='function'||typeof MISC_CAT_ITEMS==='undefined')return;
    var k=miscCatKey(id,DB.items[id]);if(k&&MISC_CAT_ITEMS[k]&&!MISC_ITEM_CAT[id]){MISC_CAT_ITEMS[k].push(id);MISC_ITEM_CAT[id]=k;if(typeof OBTAINABLE_MISC!=='undefined')OBTAINABLE_MISC[id]=true;}
  });

  // Native lookup remains a data lookup for forced equipment/set forms. The
  // access gate is applied at scroll selection, random rolls and recomputation.
  var oldFind=window.findPolyForm;
  window.findPolyForm=function(name){
    if(!enabled())return oldFind.apply(this,arguments);
    var row=byName[name];if(row)return {form:clone(row.form),color:'text-yellow-300'};
    var old=oldFind.apply(this,arguments);if(old)return old;
    var f=monsterForm(name);return f?{form:f,color:'c-card-diamond'}:null;
  };
  var oldMatches=window.polyFormMatchesEquippedWeapon;
  window.polyFormMatchesEquippedWeapon=function(form){if(enabled()&&relevant(form))return canUseForm(form,player);return oldMatches.apply(this,arguments);};
  var oldCandidates=window.polyRandomCandidates;
  window.polyRandomCandidates=function(){
    var original=oldCandidates.apply(this,arguments);if(!enabled())return original;
    var pool=original.map(function(f){return resolve(f,player);}).filter(Boolean);
    if(!pool.length)pool=monsterNames().filter(function(n){return diamondOwned(n,player);}).map(monsterForm).filter(Boolean);
    if(!pool.length)pool=listOwned(player).map(function(r){return clone(r.form);});
    return pool;
  };
  var oldState=window.getPolyState;
  window.getPolyState=function(dk,kurt){
    if(!enabled()||dk||kurt)return oldState.apply(this,arguments);
    var pool=polyRandomCandidates();if(!pool.length)return null;var f=pool[Math.floor(Math.random()*pool.length)];
    return makePolyState(f,f.c||'c-card-diamond');
  };
  var oldNamed=window.getPolyStateByName;
  window.getPolyStateByName=function(name){
    if(!enabled())return oldNamed.apply(this,arguments);
    var found=findPolyForm(name);if(found&&relevant(found.form)){var f=resolve(found.form,player);return f?makePolyState(f,f.c||'c-card-diamond'):null;}
    return oldNamed.apply(this,arguments);
  };
  var oldRecompute=window.recomputeStats;
  window.recomputeStats=function(){if(enabled())normalize(player);else clearDisabledForm(player);return oldRecompute.apply(this,arguments);};
  if(window.AFK_TOGGLES&&typeof AFK_TOGGLES.set==='function'){
    var oldToggle=AFK_TOGGLES.set;
    AFK_TOGGLES.set=function(id,on){
      var r=oldToggle.apply(this,arguments);
      if((id===TOGGLE||id==='cardplus')&&!enabled()&&typeof player!=='undefined'&&player&&player.cls){
        var changed=clearDisabledForm(player);
        (player.allies||[]).forEach(function(a){if(clearDisabledForm(a)){changed=true;if(typeof _allyLevelRecompute==='function')_allyLevelRecompute(a);}});
        if(changed&&typeof calcStats==='function')calcStats();
      }
      return r;
    };
  }
  if(typeof window.allyMaintainPoly==='function'){
    var oldMaintain=window.allyMaintainPoly;
    window.allyMaintainPoly=function(actor){if(enabled()&&actor&&relevant(actor.poly)){if(!canUseForm(actor.poly,actor))return false;actor.poly=resolve(actor.poly,actor);}return oldMaintain.apply(this,arguments);};
  }
  var oldAcquire=window.acquireCard;
  window.acquireCard=function(){var r=oldAcquire.apply(this,arguments);if(enabled()&&syncUnlocks(player)&&!busy&&player&&player.cls)saveGame();return r;};
  if(typeof window.saveGame==='function'){
    var oldSave=window.saveGame;
    window.saveGame=function(){
      // Manual card registration and previously completed imported collections
      // also latch unlocks at the next native save; no startup write is needed.
      if(enabled()&&typeof player!=='undefined'&&player&&player.cls&&!player.dead&&(typeof _roleSaveAllowed!=='function'||_roleSaveAllowed()))syncUnlocks(player);
      return oldSave.apply(this,arguments);
    };
  }

  function selectionList() {
    var out=[],seen=Object.create(null),ring=hasPolyRing();
    function add(f,c){if(!f||seen[f.n])return;seen[f.n]=true;out.push({form:f,color:c||f.c||'c-card-diamond'});}
    if(ring){
      POLY_TIERS.forEach(function(t){t.forms.forEach(function(f){if(!isMonster(f.n)&&player.lv>=f.lv&&polyFormMatchesEquippedWeapon(f))add(f,t.color);});});
      CONTROL_ONLY_POLY_FORMS.forEach(function(f){if(!isMonster(f.n)&&player.lv>=f.lv&&polyFormMatchesEquippedWeapon(f))add(f,f.c);});
    }
    monsterNames().forEach(function(n){if(diamondOwned(n,player))add(monsterForm(n),'c-card-diamond');});
    listOwned(player).forEach(function(r){add(clone(r.form),'text-yellow-300');});
    return out;
  }
  var oldOpen=window.openPolySelect;
  window.openPolySelect=function(uid){
    if(!enabled())return oldOpen.apply(this,arguments);
    oldOpen.apply(this,arguments);
    var list=document.getElementById('poly-modal-list'),modal=document.getElementById('poly-modal');if(!list||!modal)return;
    var header=modal.querySelector('.panel-header');if(header)header.textContent='選擇變身';
    var search=document.getElementById('afk-card-poly-search');if(!search){search=document.createElement('input');search.id='afk-card-poly-search';search.className='afk-ca-search';search.placeholder='搜尋變身名稱';list.before(search);}search.value='';
    var avail=selectionList();
    function draw(){var q=search.value.trim();list.innerHTML='';var filtered=avail.filter(function(x){return !q||x.form.n.indexOf(q)>=0;});
      filtered.forEach(function(x){var b=document.createElement('button');b.type='button';b.className='btn afk-ca-form';b.dataset.cardForm=x.form.n;
        b.innerHTML='<strong class="'+escape(x.color)+'">'+escape(x.form.n)+'</strong><span>'+escape(polyFormDesc(x.form))+'</span>';
        b.onclick=function(){confirmPolySelect(uid,x.form.n);};list.appendChild(b);});
      if(!filtered.length)list.textContent=avail.length?'找不到符合的變身。':'先取得怪物鑽石卡，或攜帶變形控制戒指。';
    }
    search.oninput=draw;draw();
  };
  var oldConfirm=window.confirmPolySelect;
  window.confirmPolySelect=function(uid,name){
    if(!enabled())return oldConfirm.apply(this,arguments);
    var found=findPolyForm(name);
    if(!found||!relevant(found.form))return oldConfirm.apply(this,arguments);
    var error=ready(),it=player&&player.inv&&player.inv.find(function(x){return x.uid===uid;}),d=it&&DB.items[it.id];
    if(error){say(error);return false;}
    if(!it || count(it)<1 || !d || !(d.eff==='poly'||d.ttmiAction==='poly'||d.ttmiControlledPoly)){say('請先準備變形卷軸。');return false;}
    var f=resolve(found.form,player);if(!f){say(isMonster(name)?'先取得「'+name+'」的鑽石卡。':'請先取得這張變身卡。');return false;}
    // Keep the native consume/update path and the rift wrapper's ownership
    // bookkeeping. Card ownership replaces only this form's level/ring gate.
    var lookup=window.findPolyForm,before=count(it);f.lv=0;f.controlOnly=false;
    window.findPolyForm=function(n){return n===name?{form:clone(f),color:f.c||'c-card-diamond'}:lookup.apply(this,arguments);};
    try{oldConfirm.apply(this,arguments);}finally{window.findPolyForm=lookup;}
    var left=player.inv.find(function(x){return x.uid===uid;}),used=count(left)<before;
    if(used){normalize(player);try{saveGame();}catch(e){}}return used;
  };
  var oldUse=window.useItem;
  window.useItem=function(uid,silent){
    var it=player&&player.inv&&player.inv.find(function(x){return x.uid===uid;}),d=it&&DB.items[it.id];if(!d)return oldUse.apply(this,arguments);
    if(!enabled()){
      if(/^afk_asc_/.test(d.eff)){if(!silent)say('鑽石變身與高階卡合成功能目前停用，道具已保留。');return false;}
      return oldUse.apply(this,arguments);
    }
    if(/^afk_asc_/.test(d.eff)){
      if(silent)return;var error=ready();if(error){say(error);return;}
      if(it.lock){say('請先解除這件道具的鎖定。');return;}
      if(d.eff==='afk_asc_dshard'){exchangeDiamondShards();return;}
      if(d.eff==='afk_asc_stshard'){openSpacetimePick();return;}
      if(d.eff==='afk_asc_diamond_choice'){openDiamondChoice(uid);return;}
      if(d.eff==='afk_asc_choice'){openChoice(uid);return;}
      if(d.eff==='afk_asc_fragment'){exchangeFragments();return;}
      var r=transaction(function(){var row=byId[d.cardAscensionId];if(!row)return {ok:false,msg:'這張卡片尚未開放。'};if(!take([it],1))return {ok:false,msg:'卡片數量不足。'};return {ok:true,reward:grant(row)};});
      if(r.ok)say(r.reward.kind==='duplicate'?'此卡已解鎖，返還「'+r.reward.n+'」。':'已永久解鎖「'+r.reward.n+'」。');else if(r.msg)say(r.msg);return r;
    }
    if(d.eff==='poly'||d.ttmiAction==='poly'||d.ttmiControlledPoly){
      var err=ready();if(err){if(!silent)say(err);return;}
      if(d.ttmiRiftOnly&&!(window.AFK_TTMI_ITEMS&&AFK_TTMI_ITEMS.inRift())){if(!silent)say('這件補給只能在時空裂痕中使用。');return;}
      if(d.ttmiPolyForm&&isMonster(d.ttmiPolyForm)&&!diamondOwned(d.ttmiPolyForm,player)){if(!silent)say('先取得「'+d.ttmiPolyForm+'」的鑽石卡。');return;}
      if(!d.ttmiPolyForm && !silent && (hasPolyRing()||selectionList().length)){
        if(!d.ttmiSourceId){openPolySelect(uid);return;}
        var selectionRing=window.hasPolyRing;window.hasPolyRing=function(){return true;};
        try{return oldUse.apply(this,arguments);}finally{window.hasPolyRing=selectionRing;}
      }
      if(!d.ttmiPolyForm && !(silent&&player.poly&&canUseForm(player.poly,player)) && !polyRandomCandidates().length){if(!silent)say('目前沒有可用變身，卷軸已保留。');return;}
      if(silent&&player.poly&&relevant(player.poly)&&canUseForm(player.poly,player)){
        // Native automatic reuse requires a ring. Card ownership supplies the
        // same persistence without changing hasPolyRing's equipment contract.
        var oldRing=window.hasPolyRing;window.hasPolyRing=function(){return true;};
        try{var rr=oldUse.apply(this,arguments);normalize(player);return rr;}finally{window.hasPolyRing=oldRing;}
      }
      var result=oldUse.apply(this,arguments);normalize(player);return result;
    }
    return oldUse.apply(this,arguments);
  };

  function renderSynth(div) {
    if(!div||!enabled())return;
    var old=div.querySelector('#afk-card-ascension-synth');if(old)old.remove();
    var s=status(player),box=document.createElement('section');box.id='afk-card-ascension-synth';box.className='afk-ca-panel';
    box.innerHTML='<h3>高階變身卡合成</h3><p class="afk-lore">「把五張卡的魂影放進爐裡吧。成與不成，皆是命數。」——至幻者</p><p>每次消耗 5 張背包內的材料卡，圖鑑已登錄的收藏保留。各階分別累計連敗；連敗 10 次後，第 11 次必定成功。</p><div>可用材料：'+s.tiers.map(function(t){return RULES[t.tier].mat+' <b>'+t.mat+'</b>';}).join('　')+'</div>';
    s.tiers.forEach(function(t){var line=document.createElement('div');line.className='afk-ca-tier';
      line.innerHTML='<strong style="color:'+RULES[t.tier].color+'">'+t.n+'卡</strong><span>成功率 '+Math.round(t.rate*100)+'%'+(t.tier==='spacetime'&&t.rate>RULES.spacetime.rate?'（失敗累加，最高 50%）':'')+' · '+(t.guaranteed?'本次必定成功':'連敗 '+t.failures+'/10')+'</span><small>'+escape(RULES[t.tier].fail)+'</small>';
      var b=document.createElement('button');b.type='button';b.className='btn';b.dataset.ascendTier=t.tier;b.disabled=!t.unlocked||t.mat<5||!t.total;
      b.textContent=!t.unlocked?(t.tier==='mythic'?'任一地區圖鑑全白金後開放':t.tier==='samsara'?'時空變身收集滿 '+catalog.spacetime.length+' 種後開放':'神話收集 '+Math.ceil(catalog.mythic.length/2)+' 種後開放'):'合成'+t.n+'卡（'+t.owned+'/'+t.total+'）';
      b.onclick=function(){synthesize(t.tier);};line.appendChild(b);box.appendChild(line);
    });
    var bottom=document.createElement('div');bottom.className='afk-ca-actions';
    var open=document.createElement('button');open.type='button';open.className='btn';open.textContent='查看變身收藏';open.onclick=openCollection;bottom.appendChild(open);
    var ex=document.createElement('button');ex.type='button';ex.className='btn';ex.textContent='碎片 '+s.fragments+'/10 · 兌換天上自選';ex.disabled=s.fragments<10;ex.onclick=exchangeFragments;if(s.fragments>0)bottom.appendChild(ex);
    var ds=document.createElement('button');ds.type='button';ds.className='btn';ds.textContent='鑽石卡碎片 '+s.diamondShards+'/'+DSHARD_COST+' · 合成未收藏鑽石卡';ds.disabled=s.diamondShards<DSHARD_COST;ds.onclick=exchangeDiamondShards;bottom.appendChild(ds);
    var st=document.createElement('button');st.type='button';st.className='btn';st.textContent='時空變身碎片 '+s.spacetimeShards+' · 指定（'+ST_PICK+'）／解除封印（'+ST_UNSEAL+'）';st.onclick=openSpacetimePick;bottom.appendChild(st);
    box.appendChild(bottom);div.appendChild(box);
  }
  if(typeof window.renderCardSynth==='function'){
    /* 高階變身卡合成改由燃柳村 NPC「至幻者」負責（afk-card-codex，玩家 2026-10-23）；這裡不再掛到卡片合成分頁 */
  }
  function hideCollection(){var m=document.getElementById('afk-card-ascension-modal');if(m)m.remove();modalLayer=null;}
  function closeCollection(){var layer=modalLayer;modalLayer=null;if(layer&&window.AFK_UI)AFK_UI.closeLayer(layer);hideCollection();}
  function createModal(title){
    closeCollection();var m=document.createElement('div');m.id='afk-card-ascension-modal';m.className='afk-ca-overlay';
    m.innerHTML='<section class="afk-ca-dialog" role="dialog" aria-modal="true" aria-labelledby="afk-card-ascension-title"><header><strong id="afk-card-ascension-title">'+escape(title)+'</strong><button type="button" data-close>關閉</button></header><div id="afk-card-ascension-body"></div></section>';
    m.onclick=function(e){if(e.target===m)closeCollection();};m.querySelector('[data-close]').onclick=closeCollection;document.body.appendChild(m);
    if(window.AFK_TOGGLES&&AFK_TOGGLES.applyBannerPad)AFK_TOGGLES.applyBannerPad(m);
    else if(window.AFK_BANNER){AFK_BANNER.remeasure();m.style.paddingTop='calc(var(--orig-bar-h, 0px) + 14px)';}
    if(window.AFK_UI&&AFK_UI.openLayer)modalLayer=AFK_UI.openLayer(hideCollection);
    m.querySelector('[data-close]').focus();return m.querySelector('#afk-card-ascension-body');
  }
  function drawCollection(){
    var host=document.getElementById('afk-card-ascension-collection');if(!host)return;host.innerHTML='';
    TIERS.forEach(function(t){var h=document.createElement('h3');h.textContent=RULES[t].n+'卡';h.style.color=RULES[t].color;host.appendChild(h);
      catalog[t].forEach(function(row){var el=document.createElement('div');el.className='afk-ca-tier';el.innerHTML='<strong>'+escape(row.n)+' · '+(!owned(row.id,player)?'未點亮':sealed(row.id,player)?'封印中':t==='samsara'?'已解除封印':'★'+starsOf(row.id,player)+'/7')+'</strong><small>'+escape(row.desc)+'</small>';host.appendChild(el);});
    });
  }
  function openCollection(){
    if(!enabled()||!player||!player.cls)return;
    if(syncUnlocks(player))saveGame();
    var host=createModal('變身卡收藏');host.innerHTML='<p>取得鑽石卡可選擇該怪物變身；高階卡首次取得後永久解鎖。</p><div class="afk-ca-actions"><button type="button" class="btn" data-poly>使用卷軸變身</button></div><div id="afk-card-ascension-collection"></div>';
    host.querySelector('[data-poly]').onclick=function(){var it=player.inv.find(function(x){return x.id==='scroll_poly'&&count(x)>0;});if(!it){say('請先準備變形卷軸。');return;}closeCollection();useItem(it.uid);};drawCollection();
  }
  function openChoice(uid){
    var host=createModal('天上卡自選');host.innerHTML='<p>選一張天上卡：沒有的會點亮卡冊，已有的升 1 星（最多 7 星）。</p>';
    catalog.celestial.forEach(function(row){var b=document.createElement('button');b.type='button';b.className='btn afk-ca-form';b.dataset.choiceCard=row.id;b.innerHTML='<strong>'+escape(row.n)+(owned(row.id,player)?' · '+(starsOf(row.id,player)>=7?'已滿 7 星':starsOf(row.id,player)+' 星'):' · 未點亮')+'</strong><span>'+escape(row.desc)+'</span>';b.onclick=function(){chooseReward(uid,row.id);};host.appendChild(b);});
  }
  function openSpacetimePick(){
    if(!enabled()||!player||!player.cls)return;
    var n=itemCount(STSHARD,player),host=createModal('時空變身碎片（持有 '+n+' 枚）');
    host.innerHTML='<p class="afk-lore">碎片裡的光陰仍在倒流，湊齊了，就能把某一段時空喚回現世。</p><p>'+ST_PICK+' 枚碎片：指定 1 種時空變身。還沒有的會以「封印型態」取得（六項能力、抗性、爆擊、首擊倍率與專屬效果都減半）；已解除封印的升 1 星。'+ST_UNSEAL+' 枚碎片：解除 1 種時空變身的封印。</p>';
    catalog.spacetime.forEach(function(row){
      var el=document.createElement('div');el.className='afk-ca-tier';var o=owned(row.id,player),se=sealed(row.id,player);
      el.innerHTML='<strong style="color:#c4b5fd">'+escape(row.n)+'</strong><span>'+(!o?'未取得':se?'封印中':'★'+starsOf(row.id,player)+'/7')+'</span><small>'+escape(row.desc)+'</small>';
      var b=document.createElement('button');b.type='button';b.className='btn';
      if(se){b.textContent='解除封印（'+ST_UNSEAL+'）';b.dataset.unseal=row.id;b.disabled=n<ST_UNSEAL;b.onclick=function(){unsealSpacetime(row.id);};}
      else{b.textContent=(o?'升星':'指定')+'（'+ST_PICK+'）';b.dataset.stPick=row.id;b.disabled=n<ST_PICK||(o&&starsOf(row.id,player)>=7);b.onclick=function(){chooseSpacetime(row.id);};}
      el.appendChild(b);host.appendChild(el);
    });
  }
  function openDiamondChoice(uid){
    var ns=monsterNames().filter(function(n){return !diamondOwned(n,player);});
    if(!ns.length){say('鑽石卡已全數登錄，此券已保留，等待新增可選卡片。');return;}
    var host=createModal('鑽石卡自選（未收藏）');host.innerHTML='<input class="afk-ca-search" placeholder="搜尋怪物名稱"><div data-diamond-options></div>';
    var search=host.querySelector('input'),list=host.querySelector('[data-diamond-options]');
    function draw(){var q=search.value.trim();list.innerHTML='';ns.filter(function(n){return !q||n.indexOf(q)>=0;}).forEach(function(n){var b=document.createElement('button');b.type='button';b.className='btn afk-ca-form';b.dataset.diamondChoice=n;b.textContent=n;b.onclick=function(){chooseDiamondReward(uid,n);};list.appendChild(b);});if(!list.children.length)list.textContent='找不到符合的怪物。';}
    search.oninput=draw;draw();
  }
  if(typeof window.renderCardBook==='function'){
    var oldBook=window.renderCardBook;window.renderCardBook=function(){var r=oldBook.apply(this,arguments);if(!enabled())return r;var host=document.getElementById('card-book-body');if(host&&!document.getElementById('afk-card-ascension-open')){var b=document.createElement('button');b.id='afk-card-ascension-open';b.type='button';b.className='btn';b.textContent='變身卡收藏';b.onclick=openCollection;host.prepend(b);}return r;};
  }
  var style=document.createElement('style');style.textContent='.afk-ca-panel{padding:14px;border-top:1px solid #334155;color:#e2e8f0}.afk-ca-panel h3,.afk-ca-dialog h3{font-weight:700;margin:8px 0}.afk-ca-panel p,.afk-ca-dialog p{font-size:12px;color:#94a3b8;margin:8px 0}.afk-ca-tier{display:flex;flex-wrap:wrap;gap:8px;align-items:center;border:1px solid #334155;background:#0f172a;padding:10px;border-radius:8px;margin:8px 0}.afk-ca-tier small{flex-basis:100%;color:#94a3b8;font-size:12px}.afk-ca-tier .btn{margin-left:auto}.afk-ca-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.afk-ca-overlay{position:fixed;inset:0;z-index:10001;background:#020617cf;display:flex;align-items:center;justify-content:center;padding:14px 12px 12px;box-sizing:border-box}.afk-ca-dialog{width:min(620px,100%);max-height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid #64748b;background:#0f172a;color:#e2e8f0;border-radius:12px;padding:16px}#afk-card-ascension-body{min-height:0;overflow:auto;overscroll-behavior:contain}.afk-ca-dialog header{flex-shrink:0;padding-bottom:8px}.afk-ca-dialog header{display:flex;justify-content:space-between;align-items:center;gap:12px}.afk-ca-dialog header button{padding:6px 10px;color:#cbd5e1}.afk-ca-form{display:flex;flex-direction:column;text-align:left;padding:10px!important;white-space:normal;margin:3px 0;width:100%}.afk-ca-form span{font-size:11px;color:#94a3b8;margin-top:4px}.afk-ca-search{background:#020617;color:#e2e8f0;border:1px solid #475569;padding:8px;margin:0 0 10px;border-radius:6px}.afk-ca-panel button:disabled{opacity:.45;cursor:not-allowed}';document.head.appendChild(style);
  var publicRules={};TIERS.forEach(function(t){publicRules[t]=Object.freeze(Object.assign({},RULES[t]));});Object.freeze(publicRules);
  window.AFK_CARD_ASCENSION={matCount:matCount,platinumRegion:platinumRegion,copiesOf:copiesOf,starsOf:starsOf,maxCopies:MAX_COPIES,renderSynth:renderSynth,rules:publicRules,cost:5,pityFailures:10,catalog:catalog,registerCatalog:registerCatalog,status:status,owned:owned,listOwned:listOwned,diamondOwned:diamondOwned,diamondFull:diamondFull,completedRegions:completedRegions,canUseForm:canUseForm,active:active,resolve:resolve,synthesize:synthesize,acquire:acquire,chooseReward:chooseReward,chooseDiamondReward:chooseDiamondReward,exchangeFragments:exchangeFragments,exchangeDiamondShards:exchangeDiamondShards,chooseSpacetime:chooseSpacetime,unsealSpacetime:unsealSpacetime,openSpacetimePick:openSpacetimePick,sealed:sealed,rateOf:rateOf,samsaraCd:samsaraCd,samsaraTick:samsaraTick,samsaraFightMax:SAMSARA_FIGHT,openCollection:openCollection,openChoice:openChoice,close:closeCollection,renderSynth:renderSynth,items:{choice:CHOICE,fragment:FRAGMENT,diamondChoice:DIAMOND_CHOICE,diamondShard:DSHARD,spacetimeShard:STSHARD}};
  if(forms()&&forms().catalog)registerCatalog(forms().catalog);
})();
