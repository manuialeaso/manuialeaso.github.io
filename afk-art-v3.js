/* afk-art-v3.js — GPT新美術：變身動畫（外掛開關 art-v3，2026-10-30 起預設開，與新怪物動畫、裝備圖示光影共用）：神話、天上、時空與十二聖衣改用新繪製的三方向逐幀動畫。
 * 只換外觀，不改能力與存檔。圖檔在 art-v3/frames/<角色>-<方向>[-wing]/，已壓縮、去掉遊戲用不到的變身動作。 */
(function(W){'use strict';
  var D=W.AFK_ART_V3_DATA,T=W.AFK_TOGGLES;
  if(!D||typeof W._actorBattleForm!=='function'||typeof ANIM_MANIFEST==='undefined')return;
  if(T){T.register({id:'art-v3',name:'GPT新美術',desc:'GPT 重新繪製的美術：神話、天上、時空與十二聖衣的變身動畫，29 隻新怪物的專屬動畫，以及 837 件裝備圖示的光影修補（只換外觀，不影響能力與存檔）。',group:'遊戲介面'});   /* 玩家 2026-10-30 16:27：GPT變身檔、新怪物專屬動畫、裝備圖示光影合成一個開關，預設開（afk-gptart-icons 先登錄，這裡內容相同） */T.register({id:'art-v3-wings',name:'聖衣星座翅膀',desc:'GPT新美術的十二聖衣顯示星座翅膀（封印或在副本中不顯示）。',group:'遊戲介面',parent:'art-v3'});}
  function enabled(){return !T||T.enabled('art-v3');}
  var byName=Object.create(null),directions=['right','left','rear'];
  D.characters.forEach(function(c){
    byName[c.name]=c;byName['輪迴・'+c.name]=c;
    directions.forEach(function(dir){[false,true].forEach(function(wing){
      if(wing&&!c.wing)return;
      var folder=c.id+'-'+dir+(wing?'-wing':''),entry={};
      Object.keys(D.counts).forEach(function(a){entry[a+'_']=D.counts[a];});
      ANIM_MANIFEST['art-v3/frames/'+folder]=entry;
      if(typeof PM_CROWN_ANCHOR!=='undefined')PM_CROWN_ANCHOR['afk-v3-'+folder]=[D.ground[0],D.canvas[1]-D.ground[1]+80];
    });});
  });
  function active(actor){
    if(!enabled()||!actor)return null;
    var f=actor._setPoly||((actor.buffs&&actor.buffs.poly>0)?actor.poly:null);
    if(!f||!f.n||f.keepClassAppearance)return null;
    if(f.cardAscensionId&&T&&!T.enabled('card-ascension'))return null;
    return byName[f.n]||null;
  }
  function showWings(actor,c){
    if(!c.wing||(T&&!T.enabled('art-v3-wings')))return false;
    var f=actor._setPoly||actor.poly,A=W.AFK_CARD_ASCENSION,C=W.AFK_CARD_COMBAT;
    if(f&&f.cardAscensionId&&A&&A.sealed&&A.sealed(f.cardAscensionId,actor))return false;
    if(C&&C.inDungeon&&C.inDungeon())return false;
    return true;
  }
  var oldForm=W._actorBattleForm;
  W._actorBattleForm=function(actor,allyGroup){
    var c=active(actor);if(!c)return oldForm.apply(this,arguments);
    var s=typeof _animDirSfx==='function'?_animDirSfx(actor._faceD==null?2:actor._faceD,false):'',dir=s==='F'?'rear':s==='2'?'left':'right';
    var folder=c.id+'-'+dir+(showWings(actor,c)?'-wing':'');
    return {key:'morph:afk-v3-'+folder,domKey:'morph:afk-v3-'+c.id,base:'art-v3/frames/'+folder+'/',wpn:null};
  };
  // 讓吉爾塔斯和其他變身一樣走轉向重繪
  var oldMorph=W._actorMorphName;
  if(typeof oldMorph==='function')W._actorMorphName=function(actor){var c=active(actor);return c?c.name:oldMorph.apply(this,arguments);};
  if(typeof MORPH_ANIM_3DIR!=='undefined')D.characters.forEach(function(c){MORPH_ANIM_3DIR.add(c.name);});
  var oldThumb=W.__afkFormThumb;
  if(typeof oldThumb==='function')W.__afkFormThumb=function(name,on){
    var c=enabled()&&byName[name];if(!c)return oldThumb.apply(this,arguments);
    return '<span class="afk-v3-thumb" style="display:inline-block;width:100%;height:112px;overflow:hidden;'+(on?'':'opacity:.42;filter:grayscale(1);')+'"><img alt="" loading="lazy" width="212" height="196" style="width:212px;height:196px;max-width:none;image-rendering:pixelated;position:relative;left:50%;transform:translateX(-50%);margin-top:-36px" src="art-v3/frames/'+c.id+'-right'+(c.wing&&(!T||T.enabled('art-v3-wings'))?'-wing':'')+'/idle_0.png"></span>';
  };
  W.AFK_ART_V3={version:3,count:D.characters.length,active:active};
})(window);
