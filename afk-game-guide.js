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
    var body=desc('<b>來歷：</b>'+esc(r.lore))+desc('<b>成長方向：</b>'+esc(r.direction));
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
    var F=W.AFK_CARD_FORMS,A=W.AFK_CARD_ASCENSION,PC=W.AFK_POLY_CODEX;
    if(!F||!A)return note('請開啟「白金／鑽石卡」與「鑽石變身與高階卡合成」，再重新載入遊戲。');
    var R=A.rules||{},rate=function(t){return Math.round(((R[t]||{}).rate||0)*100)+'%';},cost=A.cost||5,pity=A.pityFailures||10,half=Math.ceil(F.catalog.mythic.length/2);
    var h=note('倒下的魔物會留下一縷形貌；收集它們、熔鑄它們，終有一天能披上十二宮的星光。高階合成與卡冊都在<b>燃柳村・至幻者</b>。');
    h+=card('鑽石卡解鎖怪物變身',table(['條件','結果'],[
      ['取得某隻怪的第一張鑽石卡','自動登錄，永久解鎖該怪物變身。'],
      ['使用變形卷軸','可自選已解鎖的卡片變身，不另需變形控制戒指。'],
      ['普通鑽石變身','採該怪物的基礎攻擊間隔、施法鎖定與受擊硬直；不附帶高階能力。'],
      ['套裝或武器強制變身','依原裝備規則優先生效；卡片變身的高階能力暫停。']
    ]));
    if(PC)h+=card('變身收集冊（普通／銀／金）',table(['項目','規則'],[
      ['掉落','擊敗與變身同名的怪物掉該變身卡；沒有同名怪物的變身，由等級 ±5 內的怪物以一半機率隨機掉落。'],
      ['機率','普通 0.3%／銀 0.1%／金 0.03%，再乘上場人數（你＋未倒下的傭兵，最多 ×16）。'],
      ['登錄','同一款依 普通 → 銀 → 金 依序登錄（要先登錄前一階）；金卡登錄後仍會掉金卡，是神話合成的材料。'],
      ['每款加成','每登錄一階：最大 HP +10，另依款式輪流給額外命中／額外傷害／魔防／HP 恢復／MP 恢復／防禦／遠距離迴避／額外魔法點數 +1。'],
      ['系列加成','同等級系列全部普通：HP +50、MP +30；全部銀：防禦 +2、魔防 +2；全部金：額外傷害、命中、魔法點數各 +2。'],
      ['開放神話卡冊','金卡登錄滿 5 種。'],
      ['借用外觀','沒有專屬圖的變身先借相近的變身動畫：忍者＝黑暗妖精刺客、侍＝黑暗騎士、大名＝騎士范德、姬武者＝艾莉絲、陰陽師＝西瑪、格利特＝白金騎士、特羅斯＝克特、伊詩蒂＝賽尼斯、喬＝馬庫爾、拉曼斯／安迪斯／艾迪爾＝長老／黑暗巡守／黑長者、亞克騎士＝黑騎士、墮落的司祭＝卡士柏、歐姆裝甲兵＝重裝歐姆、生日慶祝妖精＝黃金騎士／巡守／法師；夏納穿真夏納的圖。']
    ])+desc('共 '+PC.forms.length+' 款。至幻者的收集冊用圖卡顯示，未登錄的是剪影。'));
    h+=card('高階合成（至幻者）',table(['階級','材料（5 張）','開放條件','成功率','失敗時'],[
      ['神話','變身金卡','任一地區的怪物圖鑑全部達到白金卡',rate('mythic'),'什麼都沒有'],
      ['天上','已登錄白金的怪物白金卡','神話變身收集一半（'+half+' 種）',rate('celestial'),'鑽石卡碎片 ×1（5 枚合成 1 張尚未收藏的鑽石卡）'],
      ['時空','已登錄鑽石的怪物鑽石卡','神話變身收集一半（'+half+' 種）',rate('spacetime')+' 起','下次時空合成 +5%（可累加，最高 50%，成功歸零）＋時空變身碎片 ×1'],
      ['輪迴','已登錄鑽石的怪物鑽石卡','14 種時空變身全部取得（封印的也算）',rate('samsara'),'時空變身碎片 ×1']
    ])+desc('只使用背包裡未鎖定的材料卡；各階分別累計連敗，連敗 '+pity+' 次後第 '+(pity+1)+' 次必定成功。輪迴 12 件平均隨機抽出。'));
    h+=card('時空變身碎片',table(['用途','需要','結果'],[
      ['指定時空變身','30 枚','還沒有的以「封印型態」取得：六項能力、抗性、爆擊、爆擊傷害、首擊倍率、副本光環與專屬效果全部減半；已解除封印的升 1 星。'],
      ['解除封印','10 枚','封印中的時空變身恢復完整效果。封印中再從合成抽到同一張，也會直接解除封印。']
    ]));
    h+=card('變身卡冊（點亮與升星）',table(['項目','規則'],[
      ['點亮','第一次取得高階卡＝點亮卡冊並永久解鎖變身。'],
      ['升星','再取得同一張＋1 星，最多 7 星（共 8 次）；滿星後再取得返還 1 張隨機鑽石卡。'],
      ['星數加成','每顆星五種屬性抗性（火、水、風、地、無）各 +5；滿 7 星再 +10（一張最多 +45）。'],
      ['收集加成','每張神話 HP +20；天上 HP +40、額外傷害 +1；時空 HP +60、額外傷害 +1、額外命中 +1。'],
      ['階段加成','同一階收集一半：額外傷害與命中 神話 +2／天上 +3／時空 +5；全部收集：神話 +3／天上 +5／時空 +8，另加同值額外魔法點數。'],
      ['輪迴聖衣','第一次取得為封印聖衣，第二次解除封印；解封後再取得返還鑽石卡（不升星）。']
    ]));
    h+=card('高階變身能力',table(['能力','神話','天上','時空','輪迴（封印）','輪迴（解封）'],[
      ['對每隻怪的首次傷害','×5','×10','×15（共用 30 秒冷卻）','×15（共用 30 秒冷卻）','×15（共用 30 秒冷卻）'],
      ['六項能力','各 +20','各 +30','各 +50','各 +50','各 +100'],
      ['五屬性抗性','各 +100','各 +150','各 +200','各 +200','各 +500'],
      ['三系爆擊率','—','各 +10%','各 +15%','各 +15%','各 +15%'],
      ['三系爆擊傷害','—','—','各 +50%','各 +50%','各 +50%'],
      ['副本中每秒真實傷害','—','—','500','500（副本內）','—（副本內回到封印型態）'],
      ['最終減傷','—','—','—','100','500'],
      ['星座特殊能力','—','—','—','—','有（見下表）'],
      ['每張專屬效果','依戰鬥型態給主傷害／命中，另兩項副加成；天上 ×2、時空 ×3','','','—','—']
    ])+desc('封印的時空變身（碎片換得）上述數值全部減半。'));
    if(F.catalog.samsara&&F.catalog.samsara.length)h+=card('輪迴變身・十二星座聖衣',table(['聖衣','傳說','特殊能力（解除封印後）'],F.catalog.samsara.map(function(r){return [esc(r.n),esc(r.lore||''),esc(r.special||'')];}))
      +desc('<b>副本內</b>：一律回到封印型態，沒有特殊能力。<b>缺點</b>：沒回安全區（村莊）連續戰鬥 30 分鐘會解除變身並冷卻 30 分鐘（真實時間），冷卻中不能用輪迴變身；回村莊計時歸零。雙子座的 ×30 有自己的 50 秒冷卻，優先於首擊加倍、也不消耗首擊。')
      +desc('玩家變身成輪迴聖衣時，背後會展開該星座的點陣背飾（可在外掛開關「變身光環」關閉）。'));
    h+=card('最終減傷（真實減傷）',table(['項目','說明'],[
      ['計算順序','公式減傷 → 聖結界 → 傷害減免與技藝減傷 → 最後再扣最終減傷（最低扣到 0）。'],
      ['適用','玩家與傭兵受到的怪物物理、魔法攻擊；持續傷害與夢艷的王登場衝擊不算。'],
      ['來源','輪迴聖衣（封印 100／解封 500）、騎士技藝命運迴響（先減 10% 後再扣 500）。']
    ]));
    h+=card('首傷如何判定',table(['情況','判定'],[
      ['第一次真正扣血','普攻、魔法、追加傷害、毒血或所屬夥伴傷害，共用該角色的一次機會。'],
      ['未命中、免疫、結算為 0','不消耗首傷機會。'],['先打過怪，再換高階變身','不能對同一隻怪重新領取首傷。'],
      ['同一隻怪變身或換階','整條變身階段共用一次首傷；重新生成的怪物另計。'],
      ['時空冷卻未結束時首次命中','本隻怪不取得倍率；冷卻結束後也不補發。'],
      ['反射、自傷、友方分攤','不觸發首傷；首傷放大的攻擊仍會正常受到敵方反射。']
    ])+desc('首傷只放大一次傷害結算，多段攻擊不會每段都乘倍率。毒與出血仍遵守「冒險規則」的來源上限。'));
    h+=desc('六項能力沿用全來源共通上限：未轉生 100、轉生 200。高階卡提供的完整加值會進入計算，面板仍受這個上限限制。');
    h+=card('神話變身（'+F.catalog.mythic.length+' 種）',table(['神話變身','原型等級'],F.catalog.mythic.map(function(r){return [esc(r.n),'Lv'+r.form.cardNativeLevel];}))+desc('取選得到的變身裡等級最高的 '+F.catalog.mythic.length+' 種。'));
    ['celestial','spacetime'].forEach(function(t){h+=card(F.tiers[t].name+'變身（'+F.catalog[t].length+' 種）',table(['型態','傳說'],F.catalog[t].map(function(r){return [esc(r.n),esc(r.lore)];})));});
    return h;
  }
  function arts(){
    var X=W.__afkArts;if(!X||!X.ARTS)return note('請開啟「轉生技藝」外掛後重新載入遊戲。');
    var CN={royal:'王族',knight:'騎士',mage:'法師',elf:'妖精',dark:'黑暗妖精',illusion:'幻術士',dragon:'龍騎士',warrior:'戰士'},by={};
    Object.keys(X.ARTS).forEach(function(id){var a=X.ARTS[id];(by[a.cls]=by[a.cls]||[]).push([id,a]);});
    var h=note('「輪迴洗去了你的等級，卻洗不去刻在靈魂上的技藝。」轉生後到<b>燃柳村・奧拉奇里亞</b>免費修習；每個職業兩門技藝擇一，可隨時回來改選。');
    Object.keys(by).forEach(function(c){h+=card((CN[c]||c)+'的技藝',table(['技藝','傳說','效果'],by[c].map(function(x){return ['<b>'+esc(x[1].n)+'</b>',esc((X.LORE||{})[x[0]]||''),esc(x[1].d)];})));});
    h+=card('四大天王與上場人數',table(['項目','規則'],[
      ['四大天王','隊伍每 4 人，全隊一般攻擊追加 1 次；16 人上場＝追加 5 次。'],
      ['16 人上場','傭兵的技藝效果減半。'],
      ['命運迴響','受到的傷害先減 10%，再扣 500 點最終減傷（見「變身卡」的最終減傷說明）。']
    ]));
    return h;
  }
  function castleWar(){
    var C=W.__afkCastleWar;if(!C)return '';
    return card('🏰 七城攻城與統一天下（加掛版）',table(['項目','規則'],[
      ['可攻城池','肯特、風木、海音、奇岩、亞丁、妖魔堡（燃柳地區）、侏儒城（威頓地區）七座；打下的城會一直持有，已持有的城不能再打。'],
      ['城堡收成','3 座以上每小時 500 萬天幣；5 座以上每小時 500 萬天幣＋100 龍鑽；7 座（統一）每小時 1,000 萬天幣＋100 龍鑽＋100 席琳結晶。'],
      ['宣戰','持有 2 座以上，會有（座數−1）×2 個血盟對你宣戰；統一後全伺服器宣戰。擊殺敵對血盟越多，對方越強、一次來的人越多。'],
      ['城堡護衛','持有的每座城都能招該城部隊（任一護衛隊長面板可切換）；新城：奇岩＝黃金之鷹、妖魔堡＝妖魔傭兵、侏儒城＝鐵斧護衛、亞丁＝亞丁白虎衛。宣戰不再遣散護衛，失去該城才失效。'],
      ['聖十字近衛','統一七城後在亞丁招募：能力＝七支部隊相加，另有迴避 5%、魔法抗性 5%，不受魅力限制最多 8 名；一口氣招滿 8 名可融合，HP、傷害、減傷、抗性、AC、魔防、迴避 ×8（上限：魔防 1000、AC −200、迴避 80%、抗性 90%）。'],
      ['投降','統一後連續擊殺 10,000 名敵對血盟成員，全體投降、宣戰結束；你死亡時連續擊殺歸零。'],
      ['血盟等級','上限 20，每級全屬性 +1、四屬性抗性 +5；血盟 Buff 數值乘上持有城堡數。'],
      ['回城地點','持有多座時，在<b>血盟分頁</b>的「回城地點」選單指定；回城鈕與 Ctrl+C 都會回到那座城。'],
      ['城堡標示','名字旁與血盟分頁：1 座顯示城名、多座顯示「N城」（王族「N城主」）、七座顯示「統一」；滑鼠移上去看全部城名。']
    ]));
  }
  function marks(){
    var names={fire:'火',water:'水',wind:'風',earth:'地',none:'無屬性'},defs=W.AFK_RELIC_RUNTIME&&AFK_RELIC_RUNTIME.marks;
    if(!defs)return '';
    return card('屬性印記・以另一種力量破開弱點',table(['印記','附加來源','持續','下一次命中'],Object.keys(defs).map(function(k){var m=defs[k];return [m.name,names[k],'10 秒',(m.by==='*'?'任一四屬性':names[m.by])+'傷害 ×'+m.mult];}))+desc('一般印記以 20% 機率附加；保證潮濕及遺物指定的觸發率，依各件效果處理。命中對應屬性後消耗印記。')+desc('蝕刻可與對應屬性印記一起消耗：×1.5 與 ×2 相乘，該次傷害合計 ×3。'));
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
  function rules(){return note('每次出發前，先看清力量如何相互作用。遺物效果見「遺物進階」，卡片進程見「變身卡」。')+marks()+
    card('中毒與出血・合併計算上限',table(['傷害來源','每秒上限'],[
      ['一般遺物、原有技能及其他普通來源','合計最多扣除目標最大生命的 1%。'],
      ['昇華支配遺物來源','目標受過昇華命中後，該昇華來源的毒血不受 1% 上限限制。']
    ])+desc('普通毒血不會因隊友打過昇華傷害而一併解限。中毒與出血各自最多 50 層。'))+healing()+dragonRules()+
    card('夢艷地獄・規則與代價',table(['事件','效果'],[
      ['開啟','席琳神殿向席琳祈禱（需 Lv40）；以瘋狂席琳為底，怪物 HP 共 ×50、傷害與命中大幅提高，沒有經驗與金幣，改掉昇華支配材料。'],
      ['王的數量','場上的王保持 1 隻；用傳送控制戒指找來的王一次出 3 隻同名王。傲慢之塔與時空裂痕不限制，副本維持原規則。'],
      ['轉生者','解除場上限制（最多 5 隻、王在場照樣出小怪）；但每隻王登場、每次變身，都先對全隊（含寵物、召喚物）造成最大 HP 10% 的真實傷害。'],
      ['60 級以上小怪','出生時隨機免疫物理或魔法 10 秒，同時反射另一類傷害（只維持 1 秒、只反射一次，反射回施放者）。'],
      ['擊敗一般小怪','不扣血。'],['擊敗首領','全隊受到當前 HP 10% 的真實傷害，並吸走你與傭兵當前 MP 的 10%。'],
      ['轉生後的代價','技能消耗 ×2；復活與召喚代價再 ×2，戰鬥中累積倒下 20／50／60／80／100 次各再 ×2；100 次起復活有 10 秒冷卻。你自己倒下或換地圖歸零。'],
      ['復活卷軸（夢艷）','HP 100% 復活，吸走當前 MP 10%。']
    ]))+supplyRules()+
    card('畫面與效能選項',table(['選項','用途'],[
      ['外掛開關 → 變身光環','只控制光環外觀；關閉後保留變身能力。'],['省電模式','可關閉動畫、光暈、戰鬥特效與音效，減少裝置負擔。'],
      ['外掛開關 → 卡頓修正','啟用日誌合併、按需繪製及動畫快取管理。'],
      ['恢復統計','統計分頁 DPS 下方列出玩家、傭兵、寵物、召喚物的每秒恢復；能力面板的 HP 恢復量顯示完整算式。'],
      ['回城卡頓偵測','回城後 3 秒內畫面停頓超過 0.3 秒，系統訊息會列出停頓時間、耗時函式與記憶體變化，可回報給作者。']
    ]));}
  function augment(key,html){
    if(key==='relicbook'&&on('relicfx'))return note('各件分階能力請看「遺物進階」；共通的印記、毒血及治療規則請看「冒險規則」。')+html;
    if(key==='combat'&&on('relicfx'))return marks()+healing()+html;
    if(key==='rift'&&W.AFK_TTMI_ITEMS)return supplyRules()+html;
    if(key==='pledge'&&W.__afkCastleWar)return castleWar()+html.replace(/肯特城／風木城／海音城/g,'七座城（詳見上方）');
    if(key==='poly')return html.replace(/「鑽石變身」/g,'「變身卡」');
    if(key==='antharas'&&on('corrupt')){
      // The original page describes the base three-stage dragon; the current
      // dragon plugin extends that same encounter to seven stages.
      html=html.replace(/三段變身/g,'七階變身').replace(/連續變身三階/g,'連續變身七階').replace(/前兩階/g,'前六階');
      return dragonRules()+html;
    }
    return html;
  }
  var guide=W.AFK_GAME_GUIDE={
    render:function(key){return key==='relicstages'?relics():key==='cardforms'?formRules():key==='versionrules'?rules():key==='rebirtharts'?arts():null;},
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
