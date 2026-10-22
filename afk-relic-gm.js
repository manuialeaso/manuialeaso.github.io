/* Fixed final-state GM fixtures. Source projection is synchronous and never saved. */
(function(){
  'use strict';
  var W=window,R=W.AFK_RELIC_RUNTIME;if(!R)return;
  var originals=new WeakMap(),CORE=['leather','bone','dk','silver','oasis','gnome','mage','kurt','steel','mr','guard','kinglord','demon','darkelf','orin','icequeen_charm','frost','bluepirate','emperor','priest'];
  var SHERINE=['紅獅','白鳥','鐵衛','麗人','疾風','月光','學徒','魔女','暗影','幻覺','龍血','狂怒'];
  function eqOf(p){var a=R.action();return originals.get(p)||a&&a.gm&&a.actor===p&&a.gmOriginalEquipment||p&&p.eq||{};}
  function armor(p){return R.enabled()&&Object.values(eqOf(p)).some(function(e){return e&&String(e.id)==='99998';});}
  function gm(p){return R.enabled()&&Object.values(eqOf(p)).some(function(e){return e&&['99999','99998'].indexOf(String(e.id))>=0;});}
  function install(id,type,name,slot){
    var d={n:name,type:type,slot:slot,req:'all',gmOnly:true,noEnhance:true,noAscUp:true,noTrade:true,noSell:true,noUse:true,gachaWeight:0,p:0,weight:0,relicAsc:5,relicPlus:0,relicFixed:true,c:'text-fuchsia-200',img:type==='wpn'?'assets/icons/weapons/真．冥皇執行劍.png':'assets/icons/armors/真．冥皇鎧甲.png',d:'【GM 測試專用・昇華支配＋5】\n'+(type==='wpn'?'萬兵同鳴，萬象歸一。':'千重甲冑，眾神之契。')+'\n同時具備全部 250 件遺物的終階效果；原有觸發條件與各自冷卻照常生效。'+(type==='arm'?'另啟用全部 57 組套裝效果。':'')+'\n同源效果只生效一次。狀態固定，不可強化、合成或進化。'};
    if(type==='wpn'){d.dmgS=1;d.dmgL=1;d.oneHand=true;}
    Object.defineProperty(DB.items,String(id),{value:d,writable:true,configurable:true,enumerable:false});
  }
  install(99999,'wpn','萬象支配者・GM 武器','wpn');install(99998,'arm','萬象支配者・GM 神甲','armor');
  function setCount(p,out){if(!armor(p))return out;CORE.forEach(function(k){out[k]=Math.max(out[k]||0,99);});return out;}
  W.__afkGmSetCount=setCount;
  var oldSet=W.__afkSetBoost;W.__afkSetBoost=function(p,c){if(oldSet)oldSet.apply(this,arguments);setCount(p,c);};
  function pluginSets(p,c,seen){if(!armor(p))return;var I=W.__afkSets&&W.__afkSets.items||{};Object.keys(I).forEach(function(k){seen[k]=1;if(I[k].set)c[I[k].set]=99;});}
  function sherine(p,c){if(armor(p))SHERINE.forEach(function(k){c[k]=5;});}
  function hasMember(p,id){return armor(p)&&/^acc_(purify_earring|curse_(red|blue|green))$/.test(id)||Object.values(eqOf(p)).some(function(e){return e&&e.id===id;});}
  function mergeForms(p){
    if(!armor(p))return;
    var forms=[];if(typeof SET_POLY_FORMS!=='undefined')['dk','kurt','demon','darkelf'].forEach(function(k){if(SET_POLY_FORMS[k])forms.push(SET_POLY_FORMS[k]);});
    if(typeof findPolyForm==='function'&&typeof makePolyState==='function')['反王肯恩','賽尼斯'].forEach(function(n){var f=findPolyForm(n);if(f)forms.push(makePolyState(f.form,f.color));});
    if(!forms.length)return;
    var f=Object.assign({},forms[0]),stats=['md','mh','rd','rh','ed','eh','mgd','sp','mpr','ac','er','mr'];stats.forEach(function(k){f[k]=forms.reduce(function(s,x){return s+(Number(x[k])||0);},0);});
    ['atk','wlk','cast','stun'].forEach(function(k){var ns=forms.map(function(x){return Number(x[k]);}).filter(function(n){return n>0;});if(ns.length)f[k]=Math.min.apply(Math,ns);});
    f.n='萬象支配者';p._setPoly=f;
  }
  var re=W.recomputeStats;
  if(typeof re==='function')W.recomputeStats=function(){
    var p=player;if(!gm(p)||originals.has(p))return re.apply(this,arguments);
    var real=p.eq,projection={};Object.keys(real).forEach(function(k){var e=real[k],d=e&&DB.items[e.id];if(!d||!R.byKey[d.relicBase||e.id]||d.gmOnly)projection[k]=e;});
    R.sources(p).forEach(function(s){var id='gm_source_'+s.catalogId,d=Object.assign({},s.def);d.relicProjected=true;d.weight=0;delete d.set;Object.defineProperty(DB.items,id,{value:d,writable:true,configurable:true,enumerable:false});projection['_gm_'+s.catalogId]={id:id,en:0,_relicVirtual:true};});
    originals.set(p,real);p.eq=projection;
    try{return re.apply(this,arguments);}finally{p.eq=real;originals.delete(p);}
  };
  function packet(actor,target){
    var B=W.AFK_RELIC_WEAPON_BRIDGE;if(!B||!B.nativeSegment||!target)return false;
    var current=R.action();if(current&&current.gm)return false;
    var sources=R.sources(actor).slice(),a=R.nextAction(actor,'normal'),before=R.setAction(a),total=0,segments=0;
    a.gm=true;a.gmSources=sources;a.gmOriginalEquipment=Object.assign({},eqOf(actor));a.gmRoot=a;a.gmArmor=armor(actor);a.context={actor:actor,target:target,main:true,direct:true,origin:'normal'};
    try{sources.filter(function(s){return s.catalogId<=131;}).forEach(function(s){
      if(actor.dead||actor._downed||R.api.hp(actor)<=0)return;
      if(!target||target._dead||R.api.hp(target)<=0)target=R.api.targets()[0];if(!target)return;
      a.context={actor:actor,target:target,sourceId:s.key,item:s.def,source:s.def,asc:s.asc,stage:s.stage,channelKey:s.key,main:true,direct:true,origin:'normal'};a.source=s.key;
      total+=Number(B.nativeSegment(target,s.def,{id:s.key,en:0,_relicProjection:true},{actor:actor}))||0;segments++;
    });}finally{try{R.finishAction(a);}finally{R.setAction(before);if(a.gmRecalc)R.recalc(actor);}}
    return {segments:segments,damage:total};
  }
  function grant(id){id=String(id);if(['99999','99998'].indexOf(id)<0)throw new Error('GM item id must be 99999 or 99998');if(!player||!player.cls)throw new Error('請先進入測試角色。');gainItem(id,1,true,true);if(typeof renderTabs==='function')renderTabs(true);return id;}
  W.AFK_RELIC_GM={active:gm,armorActive:armor,realEquipment:eqOf,setCount:setCount,pluginSets:pluginSets,sherine:sherine,hasMember:hasMember,mergeForms:mergeForms,packet:packet,grant:grant,setConfigurations:57};
  W.__afkGM=W.AFK_RELIC_GM;
})();
