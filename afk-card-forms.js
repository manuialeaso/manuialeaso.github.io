/* Diamond monster forms and original ascension appearances.
 * Visual references: official Lineage Remastered classic-form showcase,
 * Lineage M mythic-form announcements, and Lineage W mythic Death Knight.
 * Tier names and combat bonuses below are this project's design, not official
 * R/M/W balance data. Existing project sprites and speed tables are reused.
 */
(function () {
  'use strict';
  var W = window;
  if (typeof CARD_MOB_INFO === 'undefined' || typeof DB === 'undefined' || typeof findPolyForm !== 'function') return;
  var copy = function (v) { return JSON.parse(JSON.stringify(v)); };
  var nativeFind = W.findPolyForm, cache = Object.create(null);
  var T=W.AFK_TOGGLES;
  if(T)T.register({id:'card-aura',name:'變身光環',desc:'顯示鑽石、神話、天上與時空變身的光環；關閉後保留全部能力。',group:'遊戲介面',parent:'card-ascension'});
  // 天上 21 種、時空 14 種（玩家 2026-10-23）：前 3 種保留原 ID（已持有的卡不受影響），其餘借用既有變身的外型
  var prototypes = [
    { key:'knight', name:'烈焰的死亡騎士', role:'重甲騎士', celestial:'曙光聖騎', spacetime:'永劫騎士' },
    { key:'ranger', name:'莉絲安', role:'精靈弓手', celestial:'月羽神弓', spacetime:'裂星獵手' },
    { key:'sage', name:'真夏納', role:'秘法賢者', celestial:'熾光聖賢', spacetime:'萬象先知' },
    { key:'blade', name:'格利特', role:'劍聖', celestial:'天穹劍聖', spacetime:'虛空劍帝' },
    { key:'thunder', name:'雷霆死亡騎士', role:'雷霆騎士', celestial:'雷霆天將', spacetime:'逆時雷霆' },
    { key:'golden', name:'黃金死亡騎士', role:'守護騎士', celestial:'金輝守護', spacetime:'終焉守門' },
    { key:'blaze', name:'焚焰死亡騎士', role:'烈焰戰神', celestial:'焚天戰神', spacetime:'時砂暴君' },
    { key:'night', name:'闇黑死亡騎士', role:'暗影劍士', celestial:'夜幕天刃', spacetime:'輪迴劍鬼' },
    { key:'judge', name:'特羅斯', role:'審判者', celestial:'天律裁決', spacetime:'次元裁判' },
    { key:'arcana', name:'伊詩蒂', role:'星術師', celestial:'星海魔導', spacetime:'混沌魔尊' },
    { key:'sword', name:'喬', role:'劍豪', celestial:'雲端劍豪', spacetime:'時空劍豪' },
    { key:'star', name:'絲莉安', role:'星弓手', celestial:'天羽獵星', spacetime:'星界弓神' },
    { key:'shinobi', name:'忍者', role:'忍者', celestial:'天影忍神', spacetime:'永夜忍皇' },
    { key:'onmyo', name:'陰陽師', role:'陰陽師', celestial:'天命陰陽', spacetime:'時之巫女' },
    { key:'dawnbow', name:'安迪斯', role:'射手', celestial:'曦光射手' },
    { key:'chant', name:'艾迪爾', role:'法師', celestial:'天籟法師' },
    { key:'samurai', name:'侍', role:'武士', celestial:'天雷武士' },
    { key:'daimyo', name:'大名', role:'將軍', celestial:'天威大名' },
    { key:'hime', name:'姬武者', role:'姬武者', celestial:'天弓姬武' },
    { key:'fist', name:'拉曼斯', role:'鬥士', celestial:'蒼穹拳聖' },
    { key:'wolf', name:'反王肯恩', role:'王者', celestial:'天狼王' }
  ];
  // 每個變身自己的效果：依戰鬥型態給主傷害／命中，再依序輪一項副加成（玩家 2026-10-23：每個變身都有自己效果）
  var MAGIC_FORMS = /法師|賢|夏納|伊詩蒂|陰陽|艾迪爾|巫|魔/;
  var roleOf = function (name) { if (typeof RANGED_POLY_FORMS !== 'undefined' && RANGED_POLY_FORMS.has(name)) return 'ranged'; return MAGIC_FORMS.test(name) ? 'magic' : 'melee'; };
  var SECOND = [['hpR','HP 自然恢復'],['mpR','MP 自然恢復'],['mr','魔法防禦'],['dr','傷害減免'],['er','遠距離迴避'],['extraMp','額外魔法點數'],['hitstunReduce','受擊硬直減少 %'],['moveSpeedPct','移動速度 %']];
  var SECOND_VAL = { hpR: 5, mpR: 3, mr: 5, dr: 2, er: 3, extraMp: 3, hitstunReduce: 5, moveSpeedPct: 5 };
  var MAIN = { melee: [['meleeDmg','近距離傷害'],['meleeHit','近距離命中']], ranged: [['rangedDmg','遠距離傷害'],['rangedHit','遠距離命中']], magic: [['magicDmg','魔法傷害'],['magicHit','魔法命中']] };
  var TIER_SCALE = { mythic: 1, celestial: 2, spacetime: 3 };
  function bonusFor(tier, baseName, index) {
    var k = TIER_SCALE[tier] || 1, role = roleOf(baseName), out = {}, txt = [];
    MAIN[role].forEach(function (m) { out[m[0]] = 3 * k; txt.push(m[1] + ' +' + (3 * k)); });
    // 副加成：依序取 8 項裡的兩項組合（28 種組合，同階內每種都不同；超過 28 再多加一項）
    var pairs = []; for (var x = 0; x < SECOND.length; x++) for (var y = x + 1; y < SECOND.length; y++) pairs.push([x, y]);
    var pick = pairs[index % pairs.length].slice(); if (index >= pairs.length) pick.push((index - pairs.length) % SECOND.length);
    pick.forEach(function (si) { var sec = SECOND[si]; out[sec[0]] = (out[sec[0]] || 0) + SECOND_VAL[sec[0]] * k; txt.push(sec[1] + ' +' + SECOND_VAL[sec[0]] * k); });
    return { stats: out, text: '專屬效果：' + txt.join('、').replace(/ %/g, '%').replace(/% \+(\d+)/g, ' +$1%') + '。' };
  }
  var tiers = {
    mythic:{name:'神話',stat:20,resist:100,mult:5,crit:0,critDamage:0,color:'#f6c766',className:'afk-card-mythic',lore:'金焰守住不滅的輪廓，古老傳說在第一擊甦醒。'},
    celestial:{name:'天上',stat:30,resist:150,mult:10,crit:10,critDamage:0,color:'#fff0b8',className:'afk-card-celestial',lore:'羽光展開，星冠垂落；一擊如晨曦穿透長夜。'},
    spacetime:{name:'時空',stat:50,resist:200,mult:15,crit:15,critDamage:50,color:'#9ceaff',className:'afk-card-spacetime',lore:'星環逆轉，裂隙無聲；萬象在同一瞬間迎來終局。'},
    samsara:{name:'輪迴',stat:100,resist:500,mult:15,crit:15,critDamage:50,color:'#fcd34d',className:'afk-card-samsara',lore:'黃金聖衣覆身，十二宮的星光在此輪迴。'}
  };
  var catalog = {mythic:[],celestial:[],spacetime:[],samsara:[]};
  // 輪迴變身：十二星座聖衣（玩家 2026-10-23）。時空變身收集滿才開放；第一次取得是封印型態，第二次取得解除封印。副本內無效果。
  var ZODIAC = [
    { key:'aries', z:'白羊座', base:'真夏納', sp:'星屑護壁：受到攻擊時 15% 機率完全抵銷該次傷害，之後 10 秒魔法防禦 +50、AC -50、迴避 +10', bonus:{} },
    { key:'taurus', z:'金牛座', base:'黃金死亡騎士', sp:'巨角之鎧：AC -50、魔法防禦 +50、五屬性抗性各 +50、傷害減免 +30', bonus:{ac:-50,mr:50,resFire:50,resWater:50,resWind:50,resEarth:50,resNone:50,dr:30} },
    { key:'gemini', z:'雙子座', base:'闇黑死亡騎士', sp:'異次元：每 50 秒一次，冷卻好後的下一擊傷害 ×30（優先於首擊加倍，不影響首擊加倍的冷卻）', bonus:{} },
    { key:'cancer', z:'巨蟹座', base:'特羅斯', sp:'冥界之息：造成傷害的 3% 轉為自己的 HP', bonus:{} },
    { key:'leo', z:'獅子座', base:'雷霆死亡騎士', sp:'光速連擊：每次造成傷害 10% 機率變成 3 倍', bonus:{} },
    { key:'virgo', z:'處女座', base:'伊詩蒂', sp:'天舞：魔法傷害 +30、額外魔法點數 +30、魔法爆擊率 +5%、魔法爆擊傷害 +50%', bonus:{magicDmg:30,extraMp:30,magicCrit:5,magicCritDmg:50} },
    { key:'libra', z:'天秤座', base:'喬', sp:'十二武器：近距離、遠距離、魔法的傷害、命中與爆擊傷害各 +50', bonus:{meleeDmg:50,rangedDmg:50,magicDmg:50,meleeHit:50,rangedHit:50,magicHit:50,meleeCritDmg:50,rangedCritDmg:50,magicCritDmg:50} },
    { key:'scorpio', z:'天蠍座', base:'忍者', sp:'赤針：對同一隻怪物每第 15 次命中，傷害 ×15', bonus:{} },
    { key:'sagittarius', z:'射手座', base:'莉絲安', sp:'黃金之箭：遠距離傷害 +30、遠距離爆擊率 +20%', bonus:{rangedDmg:30,rangedCrit:20} },
    { key:'capricorn', z:'摩羯座', base:'格利特', sp:'聖劍：近距離爆擊率 +20%、近距離爆擊傷害 +100%', bonus:{meleeCrit:20,meleeCritDmg:100} },
    { key:'aquarius', z:'水瓶座', base:'陰陽師', sp:'絕對零度：直接擊殺 HP 低於 20% 的非首領怪物', bonus:{} },
    { key:'pisces', z:'雙魚座', base:'絲莉安', sp:'玫瑰之癒：每秒恢復自己 2% 最大 HP；每 10 秒全體隊友（傭兵、寵物、召喚物）恢復 2% 最大 HP', bonus:{} },
  ];
  function description(tier) {
    var t=tiers[tier],s='對每隻怪物的首次傷害 ×'+t.mult+'；六項能力各 +'+t.stat+'，火、水、風、地、無屬性抗性各 +'+t.resist+'。';
    if(tier==='spacetime')s='對每隻怪物的首次傷害 ×15，角色共用冷卻 30 秒；六項能力各 +50，五屬性抗性各 +200。';
    if(t.crit)s+=' 近距離、遠距離、魔法爆擊率各 +'+t.crit+'%。';
    if(t.critDamage)s+=' 三種爆擊傷害各 +'+t.critDamage+'%；對副本中的敵人每秒造成 500 點真實傷害。';
    return s;
  }
  // Mythic cards upgrade the existing selectable Lv70+ forms. Equipment-only
  // transformations are not part of the scroll collection or its unlock gate.
  // 神話 32 種（玩家 2026-10-23）：選得到的變身裡等級最高的 32 種（原本只有 Lv70 以上的 14 種，ID 不變）
  var highForms=[],seenHigh=Object.create(null),pool=[];
  function addHigh(f){if(!f||!(Number(f.lv)>0)||seenHigh[f.n])return;seenHigh[f.n]=true;pool.push(copy(f));}
  if(typeof POLY_TIERS!=='undefined')POLY_TIERS.forEach(function(t){t.forms.forEach(addHigh);});
  if(typeof CONTROL_ONLY_POLY_FORMS!=='undefined')CONTROL_ONLY_POLY_FORMS.forEach(addHigh);
  (W.__afkPolyCatalog||[]).forEach(addHigh);
  pool.sort(function(a,b){return b.lv-a.lv||a.n.localeCompare(b.n,'zh-Hant');});
  highForms=pool.slice(0,32);
  highForms.sort(function(a,b){return a.lv-b.lv||a.n.localeCompare(b.n,'zh-Hant');});
  highForms.forEach(function(base,hi){
    var id='mythic_'+Array.from(base.n).map(function(c){return c.codePointAt(0).toString(16);}).join('_');
    var f=copy(base),n='神話・'+base.n;
    f.n=n;f.c=tiers.mythic.className;f.cardAscensionId=id;f.cardAscensionTier='mythic';f.cardVisualBase=base.n;f.cardNativeLevel=base.lv;
    delete f.controlOnly;
    var bm=bonusFor('mythic',base.n,hi);
    catalog.mythic.push({id:id,n:n,tier:'mythic',form:f,prototype:base.n,level:base.lv,role:'高階變身',lore:tiers.mythic.lore,bonus:bm.stats,desc:description('mythic')+' '+bm.text});
    if(typeof MORPH_BATTLE_ALIAS!=='undefined')MORPH_BATTLE_ALIAS[n]=MORPH_BATTLE_ALIAS[base.n]||base.n;
  });
  prototypes.forEach(function (p,pi) {
    var found=nativeFind(p.name);
    if(!found){console.warn('[AFK-card-forms] 找不到變身原型：'+p.name);return;}
    ['celestial','spacetime'].forEach(function (key) {
      if(!p[key])return;
      var t=tiers[key],id=key+'_'+p.key,n=t.name+'・'+p[key],form=copy(found.form),bb=bonusFor(key,p.name,pi);
      form.n=n;form.c=t.className;form.cardAscensionId=id;form.cardAscensionTier=key;form.cardVisualBase=p.name;form.cardNativeLevel=found.form.lv;
      delete form.controlOnly;
      catalog[key].push({id:id,n:n,tier:key,form:form,prototype:p.name,role:p.role,lore:t.lore,bonus:bb.stats,desc:description(key)+' '+bb.text});
      if(typeof MORPH_BATTLE_ALIAS!=='undefined')MORPH_BATTLE_ALIAS[n]=MORPH_BATTLE_ALIAS[p.name]||p.name;
    });
  });
  ZODIAC.forEach(function (z) {
    var found=nativeFind(z.base);
    if(!found){console.warn('[AFK-card-forms] 找不到聖衣外型：'+z.base);return;}
    var t=tiers.samsara,id='samsara_'+z.key,n='輪迴・'+z.z+'聖衣',form=copy(found.form);
    form.n=n;form.c=t.className;form.cardAscensionId=id;form.cardAscensionTier='samsara';form.cardVisualBase=z.base;form.cardNativeLevel=found.form.lv;
    delete form.controlOnly;
    catalog.samsara.push({id:id,n:n,tier:'samsara',form:form,prototype:z.base,role:'星座聖衣',lore:t.lore,zodiac:z.key,special:z.sp,specialBonus:copy(z.bonus),
      desc:'封印型態：效果同時空變身，另有最終減傷 +100。解除封印（第二次取得）：六項能力各 +100、五屬性抗性各 +500、最終減傷 +500，並得到特殊能力「'+z.sp+'」。副本內一律回到封印型態、沒有特殊能力。缺點：沒回安全區連續戰鬥 30 分鐘會解除變身，冷卻 30 分鐘（期間不能用輪迴變身）。'});
    if(typeof MORPH_BATTLE_ALIAS!=='undefined')MORPH_BATTLE_ALIAS[n]=MORPH_BATTLE_ALIAS[z.base]||z.base;
  });
  function monsterForm(name) {
    var info=CARD_MOB_INFO[name],mob=info&&DB.mobs[info.id]||info&&info.mob;
    if(!mob||!(Number(mob.atkSpd)>0))return null;
    // Enemy attack scheduling uses floor(atkSpd * 10), not the ordinary
    // polymorph animation table. Preserve that native base interval exactly.
    var attackTicks=Math.max(1,Math.floor(Number(mob.atkSpd)*10));
    var sig=[attackTicks,mob.castSpd,mob.hitstun].join('|');
    if(!cache[name]||cache[name].sig!==sig){
      cache[name]={sig:sig,form:{n:name,lv:1,c:'c-card-diamond',atkApm:600/attackTicks,cast:mob.castSpd==null?0:Math.max(0,Number(mob.castSpd)*10),stun:mob.hitstun==null?0:Math.max(0,Number(mob.hitstun)),wlk:16,cardMonster:name,cardMobId:info.id,cardNativeAttackTicks:attackTicks}};
    }
    return copy(cache[name].form);
  }
  var F=W.AFK_CARD_FORMS={
    catalog:catalog,tiers:tiers,zodiac:ZODIAC,description:description,monsterForm:monsterForm,highForms:highForms,
    monsterNames:function(){return Object.keys(CARD_MOB_INFO);},
    isMonsterName:function(name){return Object.prototype.hasOwnProperty.call(CARD_MOB_INFO,name);},
    references:[
      'https://tw.beanfun.com/lineagenew/events/2019remastered/index.html',
      'https://tw-event.beanfun.com/LineageM/EventAD/EventAD.aspx?EventADID=468',
      'https://tw-event.beanfun.com/LineageM/EventAD/EventAD.aspx?EventADID=2647',
      'https://lineagew.plaync.com/tw/board/update/view?articleId=50162501'
    ]
  };
  function activeForm(actor) {
    var A=W.AFK_CARD_ASCENSION;
    if(!A||(T&&!T.enabled('card-ascension'))||!actor||actor._setPoly||!actor.buffs||!(actor.buffs.poly>0))return null;
    var f=actor.poly;if(!f)return null;
    if(f.cardAscensionId)return A.active(actor)?f:null;
    if(f.cardMonster&&A.canUseForm&&A.canUseForm(f,actor))return f;
    return null;
  }
  // Use each monster's existing battle animation when it has no normal
  // polymorph sprite. Static monsters keep their own portrait as a fallback.
  var oldBattle=W._actorBattleForm;
  if(typeof oldBattle==='function')W._actorBattleForm=function(actor,allyGroup){
    var f=activeForm(actor);
    if(f&&f.cardAscensionId&&f.classMorph&&typeof _classForm==='function')return _classForm(actor,!!allyGroup,f.cardVisualBase)||oldBattle.apply(this,arguments);
    if(!f||!f.cardMonster)return oldBattle.apply(this,arguments);
    if(typeof MORPH_BATTLE_ANIM!=='undefined'&&MORPH_BATTLE_ANIM.has(f.cardMonster))return oldBattle.apply(this,arguments);
    var name=f.cardMonster,dir=typeof _animDir==='function'?_animDir(name):name;
    if(typeof MOB_ANIM_NAMES!=='undefined'&&MOB_ANIM_NAMES.has(name)){
      var eight=typeof MOB_ANIM_8DIR!=='undefined'&&MOB_ANIM_8DIR.has(name),face=Math.max(0,Math.min(7,Number(actor._faceD)||2));
      return{key:'diamond:'+name+(eight?':'+face:''),domKey:'diamond:'+name,base:'assets/anim/'+encodeURIComponent(dir)+'/'+(eight?'d'+face+'/':''),wpn:null};
    }
    var info=CARD_MOB_INFO[name],mob=info&&DB.mobs[info.id]||{},fallback=oldBattle.apply(this,arguments);
    return{key:'diamond-static:'+name,domKey:'diamond-static:'+name,base:'',wpn:null,cardStaticUrl:mob.img||'assets/icons/monsters/'+encodeURIComponent(name)+'.png',cardFallbackForm:fallback};
  };
  var oldProbe=W._battleSpriteProbe;
  if(typeof oldProbe==='function')W._battleSpriteProbe=function(form){
    if(!form||!form.cardStaticUrl)return oldProbe.apply(this,arguments);
    if(typeof _morphBattleCache==='undefined')return;
    _morphBattleCache[form.key]='probing';var im=new Image();
    im.onload=function(){_morphBattleCache[form.key]={idle:[im,im],shadow:{},weapon:{}};};
    im.onerror=function(){
      if(form.cardFallbackForm){var fb=Object.assign({},form.cardFallbackForm,{key:form.key,domKey:form.domKey});oldProbe.call(W,fb);}
      else _morphBattleCache[form.key]={idle:null,shadow:{},weapon:{}};
    };
    im.src=form.cardStaticUrl;
  };
  var style=document.createElement('style');style.id='afk-card-aura-style';
  style.textContent=`
.afk-card-mythic{color:#f6c766;text-shadow:0 0 8px #9a651c}
.afk-card-celestial{color:#fff0b8;text-shadow:0 0 9px #c6a85d}
.afk-card-spacetime{color:#9ceaff;text-shadow:0 0 10px #6856d5}
.afk-card-samsara{color:#fcd34d;text-shadow:0 0 10px #f59e0b}
.afk-cloth-wings{position:absolute;width:0;height:0;pointer-events:none;z-index:0;filter:drop-shadow(0 0 4px #fbbf24aa)}
.afk-cloth-wings i{position:absolute;display:block;width:var(--cw-s,90px);height:var(--cw-s,90px);top:calc(var(--cw-s,90px) * -0.6286)}
.afk-cloth-wings i svg{width:100%;height:100%;overflow:visible;display:block}
.afk-cloth-wings .cw-r{left:calc(var(--cw-s,90px) * -0.0686);transform-origin:6.86% 62.86%;animation:cw-flap 2.6s ease-in-out infinite}
.afk-cloth-wings .cw-l{left:calc(var(--cw-s,90px) * -0.0686);transform-origin:6.86% 62.86%;transform:scaleX(-1);animation:cw-flap-l 2.6s ease-in-out infinite}
.afk-cloth-wings.is-sealed{filter:saturate(.25) brightness(.62);opacity:.55}
.afk-cloth-wings.is-sealed i{animation:none}
.afk-card-aura-downed .afk-cloth-wings{opacity:.15}
body.afk-no-glow .afk-cloth-wings{filter:none}
body.afk-no-animation .afk-cloth-wings i,body.afk-card-background .afk-cloth-wings i{animation-play-state:paused}
@media(prefers-reduced-motion:reduce){.afk-cloth-wings i{animation:none!important}}
@keyframes cw-flap{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-9deg)}}
@keyframes cw-flap-l{0%,100%{transform:scaleX(-1) rotate(0deg)}50%{transform:scaleX(-1) rotate(-9deg)}}
[data-card-aura="samsara"]{--ca-gold:#fcd34d;--ca-light:#fffbeb;--ca-shadow:#f59e0b90}
[data-card-aura]{--ca-gold:#f6c766;--ca-light:#ffedb4;--ca-shadow:#d07a2570}
[data-card-aura="diamond"]{--ca-gold:#67e8f9;--ca-light:#e0fcff;--ca-shadow:#0891b250}
[data-card-aura="celestial"]{--ca-gold:#fff0b8;--ca-light:#ffffff;--ca-shadow:#f0c56a60}
[data-card-aura="spacetime"]{--ca-gold:#7de8ff;--ca-light:#e4dcff;--ca-shadow:#7c3aed80}
.afk-trans-aura{position:absolute;left:50%;bottom:12px;width:84px;height:100px;transform:translateX(-50%);pointer-events:none;z-index:0;overflow:visible;opacity:.9}
.afk-trans-aura .ca-ring{position:absolute;left:7%;bottom:-8%;width:86%;height:48%;border:2px solid var(--ca-gold);border-radius:50%;box-shadow:0 0 8px var(--ca-gold),inset 0 0 12px var(--ca-shadow);background:radial-gradient(ellipse,transparent 38%,var(--ca-shadow) 65%,transparent 72%);transform:scaleY(.42);animation:ca-breathe 3.8s ease-in-out infinite}
.afk-trans-aura .ca-crown{position:absolute;left:28%;top:9%;width:44%;height:18%;border-top:2px solid var(--ca-light);border-radius:50%;opacity:.6;box-shadow:0 -2px 7px var(--ca-shadow);animation:ca-rise 3.8s ease-in-out infinite}
.afk-trans-aura .ca-wings{position:absolute;inset:5% -12% 12%;background:radial-gradient(ellipse at 50% 90%,transparent 18%,var(--ca-shadow) 40%,transparent 65%);opacity:.6;clip-path:polygon(50% 70%,12% 8%,6% 45%,28% 70%,4% 65%,30% 91%,50% 100%,70% 91%,96% 65%,72% 70%,94% 45%,88% 8%);animation:ca-breathe 4.6s ease-in-out infinite}
[data-card-aura="diamond"] .ca-wings,[data-card-aura="diamond"] .ca-crown{display:none}
[data-card-aura="mythic"] .ca-wings{opacity:.34}
[data-card-aura="celestial"] .ca-crown{top:2%;width:54%;left:23%;box-shadow:0 -3px 12px var(--ca-shadow)}
[data-card-aura="spacetime"] .ca-wings{clip-path:none;inset:5% 12%;border:1px solid #bca8ff;border-radius:50%;background:transparent;box-shadow:inset 0 0 12px #7c3aed40,0 0 10px #67e8f950;transform:rotate(-35deg);animation:ca-orbit 9s linear infinite}
[data-card-aura="spacetime"] .ca-crown{inset:12% 4%;width:auto;height:auto;border:1px solid #67e8f9;border-radius:50%;transform:rotate(35deg);animation:ca-orbit 12s linear infinite reverse;opacity:.55}
[data-card-aura].afk-card-aura-downed .afk-trans-aura{opacity:.15;animation:none}
body.afk-no-glow .afk-trans-aura{display:none}
body.afk-no-animation .afk-trans-aura *,body.afk-card-background .afk-trans-aura *{animation-play-state:paused}
@keyframes ca-breathe{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes ca-rise{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-4px);opacity:.8}}
@keyframes ca-orbit{0%{transform:rotate(0deg);opacity:.4}50%{opacity:.8}100%{transform:rotate(360deg);opacity:.4}}
@media(prefers-reduced-motion:reduce){.afk-trans-aura *{animation:none!important}}
`;
  document.head.appendChild(style);
  function visibility(){if(document.body)document.body.classList.toggle('afk-card-background',document.hidden);}
  document.addEventListener('visibilitychange',visibility);visibility();
  var decorationState=new WeakMap(),geometryCache=Object.create(null);
  function auraGeometry(body,key){
    if(geometryCache[key])return geometryCache[key];
    if(!body||!body.complete||!body.naturalWidth||!body.naturalHeight)return null;
    var w=body.naturalWidth,h=body.naturalHeight,box={left:w*.25,right:w*.75,top:h*.25,bottom:h*.9};
    // Native actor containers are only one pixel high. Anchor the aura to
    // visible artwork, not percentages of that container or transparent frame
    // padding. Read a small decoded frame once per form; never per animation.
    try{
      if(w*h<=1048576){
        var c=document.createElement('canvas');c.width=w;c.height=h;
        var ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(body,0,0);
        var data=ctx.getImageData(0,0,w,h).data,l=w,r=-1,t=h,b=-1;
        for(var y=0;y<h;y++)for(var x=0;x<w;x++)if(data[(y*w+x)*4+3]>32){if(x<l)l=x;if(x>r)r=x;if(y<t)t=y;if(y>b)b=y;}
        if(r>=l&&b>=t)box={left:l,right:r+1,top:t,bottom:b+1};
      }
    }catch(e){} // Cross-origin portraits keep a bounded geometric fallback.
    var bh=box.bottom-box.top,bw=box.right-box.left;
    return geometryCache[key]={left:(box.left+box.right)/2,bottom:h-box.bottom+Math.max(3,bh*.04),width:Math.max(64,Math.min(180,bw*1.6)),height:Math.max(70,Math.min(220,bh*1.35))};
  }
  // 輪迴聖衣的黃金羽翼（玩家 2026-10-23：只有玩家自己；原創造型，SVG 一次產生）
  var WING_SVG=null;
  // 單邊翅膀（往右展開），肩膀在 (0,0)；左翅用 CSS 鏡像
  function wingSvgBuild(){
  var f=function(v){return v.toFixed(1);};
  // 翼骨：肩→腕（上外）
  var P=function(t){var x0=0,y0=0,cx=34,cy=-62,x1=78,y1=-70;var u=1-t;return [u*u*x0+2*u*t*cx+t*t*x1,u*u*y0+2*u*t*cy+t*t*y1];};
  var out='';
  var layer=function(n,lenA,lenB,angA,angB,wid,grad,shift){
    for(var i=n-1;i>=0;i--){
      var t=shift+(1-shift)*i/(n-1),r=P(t),a=(angA+(angB-angA)*i/(n-1))*Math.PI/180,len=lenA+(lenB-lenA)*i/(n-1),w=wid;
      var tx=r[0]+Math.cos(a)*len,ty=r[1]+Math.sin(a)*len,nx=-Math.sin(a)*w,ny=Math.cos(a)*w;
      var mx=r[0]+Math.cos(a)*len*.55,my=r[1]+Math.sin(a)*len*.55;
      var ex=tx+Math.cos(a)*3,ey=ty+Math.sin(a)*3;
      out+='<path d="M'+f(r[0]-nx*.5)+' '+f(r[1]-ny*.5)+' Q'+f(mx-nx)+' '+f(my-ny)+' '+f(tx-nx*.35)+' '+f(ty-ny*.35)+' Q'+f(ex)+' '+f(ey)+' '+f(tx+nx*.35)+' '+f(ty+ny*.35)+' Q'+f(mx+nx)+' '+f(my+ny)+' '+f(r[0]+nx*.5)+' '+f(r[1]+ny*.5)+'Z" fill="url(#'+grad+')" stroke="#6b3f08" stroke-width=".9"/>';
      out+='<path d="M'+f(r[0])+' '+f(r[1])+' L'+f(r[0]+(tx-r[0])*.9)+' '+f(r[1]+(ty-r[1])*.9)+'" stroke="#fff6d0" stroke-width=".8" opacity=".75"/>';
    }
  };
  layer(11,40,88,100,-22,9.5,'cw-a',0.12);   // 主羽：靠肩往下垂，越到腕越長、越往外
  layer(8,22,38,92,-5,8,'cw-b',0.08);    // 覆羽
  var arm=P(0),aw=P(1);
  out+='<path d="M0 0 Q34 -62 78 -70" fill="none" stroke="#8a5410" stroke-width="7" stroke-linecap="round"/><path d="M0 0 Q34 -62 78 -70" fill="none" stroke="url(#cw-b)" stroke-width="4.5" stroke-linecap="round"/>';
  out+='<circle cx="78" cy="-70" r="4.5" fill="url(#cw-a)" stroke="#6b3f08" stroke-width=".8"/>';
  return '<svg viewBox="-12 -110 175 175" aria-hidden="true"><defs><linearGradient id="cw-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffbe6"/><stop offset=".45" stop-color="#f8cf55"/><stop offset="1" stop-color="#b9781a"/></linearGradient><linearGradient id="cw-b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#e2a92f"/></linearGradient></defs>'+out+'</svg>';
}

  function wingSvg(){return WING_SVG||(WING_SVG=wingSvgBuild());}
  var SH_X=12/175,SH_Y=110/175;   // 肩膀在 SVG 方框中的位置
  function clothWings(el,actor,tier,geometry){
    var w=el.querySelector(':scope > .afk-cloth-wings'),P=typeof player!=='undefined'?player:null;
    if(tier!=='samsara'||!P||actor!==P||el.id!=='player-morph-sprite'){if(w)w.remove();return;}
    if(!w){w=document.createElement('span');w.className='afk-cloth-wings';w.setAttribute('aria-hidden','true');w.innerHTML='<i class="cw-l">'+wingSvg()+'</i><i class="cw-r">'+wingSvg()+'</i>';el.prepend(w);}
    var A=W.AFK_CARD_ASCENSION,f=actor.poly,se=!!(A&&f&&A.sealed&&A.sealed(f.cardAscensionId,actor)),C=W.AFK_CARD_COMBAT,dg=!!(C&&C.inDungeon&&C.inDungeon());
    w.classList.toggle('is-sealed',se||dg);
    if(geometry){
      // 容器以肩膀為原點（寬高 0），兩片翅膀各自從肩膀展開
      var bh=geometry.height/1.35,S=Math.round(bh*1.1);
      w.style.left=Math.round(geometry.left)+'px';w.style.bottom=Math.round(geometry.bottom+bh*.66)+'px';w.style.setProperty('--cw-s',S+'px');
    }
  }
  function decorate(el,actor) {
    if(!el)return;var f=(!T||T.enabled('card-aura'))&&activeForm(actor),tier=f&&(f.cardAscensionTier||'diamond');
    var down=!!(actor&&(actor.dead||actor._downed||(actor.curHp==null?actor.hp:actor.curHp)<=0));
    var visual=f&&(f.cardVisualBase||f.cardMonster||f.n)+'|'+(actor&&actor.avatar||''),body=tier&&el.querySelector('.pm-body');
    var geometry=tier&&auraGeometry(body,visual);
    var sealKey='';if(tier==='samsara'){var A0=W.AFK_CARD_ASCENSION,C0=W.AFK_CARD_COMBAT;sealKey=((A0&&A0.sealed&&A0.sealed(f.cardAscensionId,actor))?'s':'o')+((C0&&C0.inDungeon&&C0.inDungeon())?'d':'');}
    var signature=(tier||'')+'|'+(down?1:0)+'|'+(visual||'')+'|'+(geometry?'ready':'pending')+'|'+sealKey,previous=decorationState.get(el);
    if(previous&&previous.signature===signature&&(!tier||previous.aura&&previous.aura.parentNode===el))return;
    var aura=previous&&previous.aura&&previous.aura.parentNode===el?previous.aura:el.querySelector(':scope > .afk-trans-aura');
    decorationState.set(el,{signature:signature,aura:aura});
    clothWings(el,actor,tier,geometry);
    if(!tier){el.removeAttribute('data-card-aura');el.classList.remove('afk-card-aura-downed');if(aura)aura.remove();return;}
    el.setAttribute('data-card-aura',tier);el.classList.toggle('afk-card-aura-downed',down);
    if(!aura){aura=document.createElement('span');aura.className='afk-trans-aura';aura.setAttribute('aria-hidden','true');['ca-ring','ca-wings','ca-crown'].forEach(function(c){var x=document.createElement('i');x.className=c;aura.appendChild(x);});el.prepend(aura);}
    if(geometry){aura.style.left=geometry.left+'px';aura.style.bottom=geometry.bottom+'px';aura.style.width=geometry.width+'px';aura.style.height=geometry.height+'px';}
    decorationState.get(el).aura=aura;
  }
  var oldPlayer=W._playerMorphApply;
  if(typeof oldPlayer==='function')W._playerMorphApply=function(){var v=oldPlayer.apply(this,arguments);decorate(document.getElementById('player-morph-sprite'),typeof player!=='undefined'?player:null);return v;};
  var oldParty=W._allySpritesApply;
  if(typeof oldParty==='function')W._allySpritesApply=function(){var v=oldParty.apply(this,arguments);if(typeof _allySpriteStates!=='undefined'&&typeof player!=='undefined'&&player)(player.allies||[]).forEach(function(a){var s=_allySpriteStates[String(a._slot)];if(s)decorate(s.el,a);});return v;};
  F.decorate=decorate;F.activeForm=activeForm;
})();
