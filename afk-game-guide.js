/* Current-version encyclopedia additions. All lists come from the live game
 * catalogs; this module reads data and never changes a character or inventory.
 * Loaded after the gameplay plugins, before the encyclopedia is first opened.
 */
(function () {
  'use strict';
  var W=window, relicPage=0, relicQuery='', relicCache=null, PAGE_SIZE=25;
  var esc=function(x){return String(x==null?'':x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
  var copy=function(x){return JSON.parse(JSON.stringify(x));};
  var on=function(id){return !W.AFK_TOGGLES||AFK_TOGGLES.enabled(id);};
  function note(s){return '<div class="m-wiki-note">'+s+'</div>';}
  function desc(s){return '<div class="m-wiki-desc">'+s+'</div>';}
  function card(title,body){return '<section class="m-wiki-card"><div class="m-wiki-name">'+title+'</div>'+body+'</section>';}
  function table(head,rows){return '<div class="m-wiki-tblwrap"><table class="m-wiki-tbl"><thead><tr>'+head.map(function(s){return '<th>'+s+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+row.map(function(s){return '<td>'+s+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>';}
  function link(name){return '<span class="m-dexlink" data-dexq="'+esc(name)+'">'+esc(name)+'</span>';}
  function clean(s){return String(s||'').replace(/本次本次/g,'本次').replace(/\bBoss\b/g,'首領').replace(/\bCD\b/g,'冷卻').replace(/原稿所列的/g,'既定的').replace(/依原稿/g,'').replace(/〔本階標籤暫定〕/g,'');}
  function plain(s){return String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
  function relicRows(){
    if(relicCache)return relicCache;
    var R=W.AFK_RELIC_RUNTIME;
    relicCache=(W.AFK_RELIC_CATALOG||[]).map(function(c){
      var mod=c.id<=131?W.AFK_RELIC_WEAPONS:W.AFK_RELIC_DEFENSE,meta=mod&&mod.byId[c.id],base=R&&R.originalBase(c.key)||DB.items[c.key];
      var stages=[[0,null],[5,null],[10,null],[0,0],[0,5]].map(function(pair,i){
        if(c.id===29&&i===4)return null;
        if(!base||!mod)return clean(c[['base_effect','plus5','plus10','ascend','ascend5'][i]]);
        var d=copy(base);d.relicBase=c.key;mod.configure(d,copy(base),pair[0],pair[1]);
        return clean(d.relicEffectText||d.relicEffectsText||(meta.texts||meta.description)[i]);
      });
      var lore=clean(meta&&meta.lore||c.design_concept),row={id:c.id,key:c.key,n:c.name,type:c.type,slot:c.slot,lore:lore,direction:clean(c.version_direction),stages:stages};
      row.search=[row.id,row.n,row.type,row.slot,lore,row.direction].concat(stages).join(' ').toLowerCase();return row;
    });
    return relicCache;
  }
  function relicCard(r,open){
    var labels=['原始效果','+5','+10','昇華支配','昇華支配 +5'];
    var body=desc('<b>設計理念：</b>'+esc(r.lore))+desc('<b>版本方向：</b>'+esc(r.direction));
    body+=table(['階段','特殊效果'],r.stages.map(function(s,i){return s==null?null:[labels[i],esc(s)];}).filter(Boolean));
    return '<details class="m-wiki-card afk-guide-relic"'+(open?' open':'')+'><summary class="m-wiki-name">'+String(r.id).padStart(3,'0')+' '+esc(r.n)+' <small>'+esc(r.slot)+'</small></summary>'+body+'</details>';
  }
  function filteredRelics(){var terms=relicQuery.toLowerCase().split(/\s+/).filter(Boolean);return relicRows().filter(function(r){return terms.every(function(t){return r.search.indexOf(t)>=0;});});}
  function relicResults(){
    var all=filteredRelics(),pages=Math.max(1,Math.ceil(all.length/PAGE_SIZE));relicPage=Math.min(relicPage,pages-1);
    var controls='<div class="afk-guide-page"><button type="button" class="btn" data-guide-page="-1"'+(relicPage===0?' disabled':'')+'>上一頁</button><span>'+(relicPage+1)+'／'+pages+' 頁・'+all.length+' 件</span><button type="button" class="btn" data-guide-page="1"'+(relicPage+1>=pages?' disabled':'')+'>下一頁</button></div>';
    return controls+(all.length?all.slice(relicPage*PAGE_SIZE,(relicPage+1)*PAGE_SIZE).map(function(r){return relicCard(r,false);}).join(''):note('找不到符合的遺物，請縮短名稱或改用效果關鍵字。'))+controls;
  }
  function relics(){
    return note('翻開遺物的來歷與力量，查看 +5、+10、昇華支配及終階效果。印記、毒血上限與治療冷卻請看「冒險規則」。')+
      '<label class="afk-guide-search">搜尋遺物<input id="afk-guide-relic-query" type="search" value="'+esc(relicQuery)+'" placeholder="名稱、編號或效果，例如：護盾"></label><div id="afk-guide-relic-results">'+relicResults()+'</div>'+
      card('GM 測試道具・固定終階',table(['編號／部位','效果'],[
        ['99999・武器','同時啟用全部遺物的最高已定階段效果。'],['99998・防具','全部遺物效果，並啟用全部套裝配置。']
      ])+desc('兩件均直接處於昇華支配 +5，不能強化或合成；同源效果不重複疊加。第 029 件保留其最高已定的昇華支配階段。'));
  }
  function formRules(){
    var F=W.AFK_CARD_FORMS,A=W.AFK_CARD_ASCENSION;
    if(!F||!A)return note('請開啟「白金／鑽石卡」與「鑽石變身與高階卡合成」，再重新載入遊戲。');
    var keys=['mythic','celestial','spacetime'],rates=A.rules||{mythic:{rate:.5},celestial:{rate:.3},spacetime:{rate:.1}},cost=A.cost||5,pity=A.pityFailures||10;
    var h=note('鑽石封存怪物的身姿，神話喚醒傳說的力量。先登錄卡片，再用變形卷軸選擇已解鎖的型態。');
    h+=card('鑽石卡解鎖怪物變身',table(['條件','結果'],[
      ['取得某隻怪的第一張鑽石卡','自動登錄，永久解鎖該怪物變身。'],
      ['使用變形卷軸','可自選已解鎖的卡片變身，不另需變形控制戒指。'],
      ['普通鑽石變身','採該怪物的基礎攻擊間隔、施法鎖定與受擊硬直；不附帶神話能力。'],
      ['套裝或武器強制變身','依原裝備規則優先生效；卡片變身的高階能力暫停。']
    ])+desc('卡片解鎖不消耗收藏紀錄；用於合成的只會是背包中未鎖定的多餘鑽石卡。'));
    h+=card('三階合成的開放條件',table(['階級','開放條件','成功率'],[
      ['神話','任一地區的所有怪物都登錄鑽石卡。',Math.round(rates.mythic.rate*100)+'%'],
      ['天上','集滿下表全部 '+F.catalog.mythic.length+' 種 70 級以上變身的神話卡。',Math.round(rates.celestial.rate*100)+'%'],
      ['時空','集滿全部 '+F.catalog.celestial.length+' 種天上變身。',Math.round(rates.spacetime.rate*100)+'%']
    ])+desc('每次消耗 '+cost+' 張多餘鑽石卡；各階分別累計失敗，連敗 '+pity+' 次後，第 '+(pity+1)+' 次必定成功。成功後該階失敗次數歸零。'));
    h+=card('失敗與重複的補償',table(['結果','取得物'],[
      ['神話失敗','1 張隨機一般鑽石卡。'],['天上失敗','1 張鑽石卡自選，只能選尚未登錄鑽石的怪物。'],
      ['時空失敗','1 枚天上自選碎片；10 枚換 1 張天上卡自選。'],['抽到已擁有的高階卡','換成 1 張隨機一般鑽石卡；本次仍算合成成功。']
    ])+desc('若所有怪物都已有鑽石卡，未收藏自選券會保留，等待出現可選的新卡。'));
    h+=card('高階變身能力',table(['能力','神話','天上','時空'],[
      ['對每隻怪的首傷','×5，一次','×10，一次','×15，一次；共用冷卻 30 秒'],
      ['力量、敏捷、體質、智力、精神、魅力','各 +20','各 +30','各 +50'],
      ['火、水、風、地、無屬性抗性','各 +100','各 +150','各 +200'],
      ['近距離／遠距離／魔法爆擊率','—','各 +10%','各 +15%'],
      ['三系爆擊傷害','—','—','各 +50%'],['副本敵人承受真實傷害','—','—','每秒 500 點']
    ]));
    h+=card('首傷如何判定',table(['情況','判定'],[
      ['第一次真正扣血','普攻、魔法、追加傷害、毒血或所屬夥伴傷害，共用該角色的一次機會。'],
      ['未命中、免疫、結算為 0','不消耗首傷機會。'],['先打過怪，再換高階變身','不能對同一隻怪重新領取首傷。'],
      ['同一隻怪變身或換階','整條變身階段共用一次首傷；重新生成的怪物另計。'],
      ['時空冷卻未結束時首次命中','本隻怪不取得倍率；冷卻結束後也不補發。'],
      ['副本真傷先接觸怪物','500 點若符合時空首傷條件，首次為 7,500 點；後續每秒 500 點。'],
      ['反射、自傷、友方分攤','不觸發首傷；首傷放大的攻擊仍會正常受到敵方反射。']
    ])+desc('首傷只放大一次傷害結算，多段攻擊不會每段都乘倍率。毒與出血仍遵守「冒險規則」的來源上限。'));
    h+=desc('六項能力沿用全來源共通上限：未轉生 100、轉生 200。高階卡提供的完整加值會進入計算，面板仍受這個上限限制。');
    h+=card('神話候選・現有 70 級以上變身',table(['神話變身','原型等級'],F.catalog.mythic.map(function(r){return [esc(r.n),'Lv'+r.form.cardNativeLevel];}))+desc('這裡的 70 級是變身原型等級。低階變身不會因神話系統已開啟，就自動取得神話特效。'));
    ['celestial','spacetime'].forEach(function(t){h+=card(F.tiers[t].name+'變身',table(['型態','意象'],F.catalog[t].map(function(r){return [esc(r.n),esc(r.lore)];})));});
    return h;
  }
  function marks(){
    var names={fire:'火',water:'水',wind:'風',earth:'地',none:'無屬性'},defs=W.AFK_RELIC_RUNTIME&&AFK_RELIC_RUNTIME.marks;
    if(!defs)return '';
    return card('屬性印記・以另一種力量破開弱點',table(['印記','附加來源','持續','下一次命中'],Object.keys(defs).map(function(k){var m=defs[k];return [m.name,names[k],'10 秒',(m.by==='*'?'任一四屬性':names[m.by])+'傷害 ×'+m.mult];}))+desc('一般印記以 20% 機率附加；保證潮濕及遺物指定的觸發率，依各件效果處理。命中對應屬性後消耗印記。')+desc('破綻可與對應屬性印記一起消耗：×1.5 與 ×2 相乘，該次傷害合計 ×3。'));
  }
  function healing(){return card('回復與冷卻',table(['來源','規則'],[
    ['遺物附帶的生命回復','每名角色、每件原始遺物共用至少 10 秒冷卻；較長的原冷卻保留。'],
    ['角色原有治療技能與藥水','沿用原本冷卻；不因遺物治療規則一律改成 10 秒。'],
    ['完成轉生後的治療藥水','基礎回復量變為原本 3 倍，例如 5～80 變為 15～240；其餘增減量再依規則結算。']
  ])+desc('四龍的「死亡藥水」會把喝藥回復轉為傷害。回復倍率越高，詛咒期間的反噬也可能越大。'));}
  function dragonRules(){return card('四龍巢穴・承受龍威，辨識反射',table(['機制','現行規則'],[
    ['巢穴侵蝕','每秒 500 點真實傷害＋500 點對應屬性傷害；屬性部分受抗性影響。'],
    ['最終龍王','連續七階；進入變身或致死門檻後，以 1 點生命鎖血 10 秒，再進階或結算。'],
    ['龍鱗反射','每 5 秒開啟一次物理或魔法反射，持續 2 秒。'],
    ['龍之再生','每階持續 60 秒仍存活且有失血時，回滿一次生命。'],
    ['治療詛咒','死亡藥水、死亡治療或減少治療；辨識狀態後再使用對應回復。']
  ])+desc('環境傷害、反射與治療反噬會先經護盾及免死判定。高傷害角色仍須處理詛咒與反射時機。'));}
  function supplyRules(){return card('古物、材料與裂痕補給',table(['地點／入口','用途'],[
    ['奇岩・古物商人 洛依','搜尋並購買裝備、材料與補給。'],['奇岩・工匠 薩克','查看材料用途、製作古物與法術卷軸。'],
    ['時空裂痕戰場・裂痕補給','角鬥戰場道具在此用戰勳兌換；離場時清除專用物品與戰勳。']
  ])+desc('裂痕入場取得 10 枚戰勳；一般怪真正死亡給 1 枚，首領給 10 枚。'));}
  function rules(){return note('每次出發前，先看清力量如何相互作用。遺物效果見「遺物進階」，卡片進程見「鑽石變身」。')+marks()+
    card('中毒與出血・合併計算上限',table(['傷害來源','每秒上限'],[
      ['一般遺物、原有技能及其他普通來源','合計最多扣除目標最大生命的 1%。'],
      ['昇華支配遺物來源','目標受過昇華命中後，該昇華來源的毒血不受 1% 上限限制。']
    ])+desc('普通毒血不會因隊友打過昇華傷害而一併解限。中毒與出血各自最多 50 層。'))+healing()+dragonRules()+
    card('夢艷地獄・擊殺代價',table(['事件','效果'],[
      ['擊敗一般小怪','不再因小怪死亡扣除自己的生命。'],['擊敗首領','保留首領死亡時原有的生命與魔力代價。']
    ]))+supplyRules()+
    card('畫面與效能選項',table(['選項','用途'],[
      ['外掛開關 → 變身光環','只控制光環外觀；關閉後保留變身能力。'],['省電模式','可關閉動畫、光暈、戰鬥特效與音效，減少裝置負擔。'],
      ['外掛開關 → 卡頓修正','啟用日誌合併、按需繪製及動畫快取管理。']
    ]));}
  function augment(key,html){
    if(key==='relicbook'&&on('relicfx'))return note('各件分階能力請看「遺物進階」；共通的印記、毒血及治療規則請看「冒險規則」。')+html;
    if(key==='combat'&&on('relicfx'))return marks()+healing()+html;
    if(key==='rift'&&W.AFK_TTMI_ITEMS)return supplyRules()+html;
    if(key==='antharas'&&on('corrupt')){
      // The original page describes the base three-stage dragon; the current
      // dragon plugin extends that same encounter to seven stages.
      html=html.replace(/三段變身/g,'七階變身').replace(/連續變身三階/g,'連續變身七階').replace(/前兩階/g,'前六階');
      return dragonRules()+html;
    }
    return html;
  }
  var guide=W.AFK_GAME_GUIDE={
    render:function(key){return key==='relicstages'?relics():key==='cardforms'?formRules():key==='versionrules'?rules():null;},
    augment:augment,
    searchRelics:function(terms,max){return relicRows().filter(function(r){return terms.every(function(t){return r.search.indexOf(t.toLowerCase())>=0;});}).slice(0,max||60).map(function(r){return {title:r.n,html:relicCard(r,true)};});},
    relicRows:relicRows,
    invalidate:function(){relicCache=null;}
  };
  var inputTimer=0;
  function repaintRelics(){var el=document.getElementById('afk-guide-relic-results');if(el)el.innerHTML=relicResults();}
  document.addEventListener('input',function(e){if(!e.target||e.target.id!=='afk-guide-relic-query')return;relicQuery=e.target.value;relicPage=0;clearTimeout(inputTimer);inputTimer=setTimeout(repaintRelics,150);});
  document.addEventListener('click',function(e){var b=e.target&&e.target.closest('[data-guide-page]');if(!b||b.disabled)return;relicPage=Math.max(0,relicPage+Number(b.dataset.guidePage));repaintRelics();});
  var style=document.createElement('style');style.id='afk-game-guide-style';style.textContent='.afk-guide-search{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}.afk-guide-search input{flex:1;min-width:0;width:100%;background:#080e1b;color:#e2e8f0;border:1px solid #475569;border-radius:8px;padding:10px}.afk-guide-page{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:12px 0;font-size:13px}.afk-guide-page button{min-height:36px;padding:6px 12px}.afk-guide-page button:disabled{opacity:.4}.afk-guide-relic summary{cursor:pointer;line-height:1.6;list-style:revert}.afk-guide-relic summary small{font-size:12px;color:#a5b4c8}.afk-guide-relic[open] summary{padding-bottom:8px;border-bottom:1px solid #334155;margin-bottom:10px}.afk-guide-missing summary{padding:8px;cursor:pointer;color:#cbd5e1}.afk-guide-missing small{color:#94a3b8;font-size:12px}.afk-guide-missing .m-wiki-desc{overflow-wrap:anywhere}';document.head.appendChild(style);
})();
