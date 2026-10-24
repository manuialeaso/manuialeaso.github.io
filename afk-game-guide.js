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
  function desc(s){return '<div class="m-wiki-desc" style="margin-top:4px;">・'+s+'</div>';}   // 與小百科原本的條列一致
  function card(title,body){return '<section class="m-wiki-card"><div class="m-wiki-name">'+title+'</div>'+body+'</section>';}
  // 表格：沿用小百科原本的樣式（第一欄靠左、其餘置中、表頭不換行）
  var TH='style="text-align:left;padding:5px 8px;border-bottom:1px solid #475569;color:#e2e8f0;font-weight:bold;white-space:nowrap;"',THc='style="text-align:center;padding:5px 8px;border-bottom:1px solid #475569;color:#e2e8f0;font-weight:bold;white-space:nowrap;"',TD='style="padding:5px 8px;border-bottom:1px solid #1e293b;color:#cbd5e1;vertical-align:top;"',TD0='style="padding:5px 8px;border-bottom:1px solid #1e293b;color:#e2e8f0;vertical-align:top;min-width:5em;"';
  function table(head,rows){return '<div class="m-wiki-tblwrap"><table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px;"><thead><tr>'+head.map(function(h,i){return '<th '+(i===0?TH:THc)+'>'+h+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+row.map(function(c,i){return '<td '+(i===0?TD0:TD)+'>'+c+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>';}
  // 專精頁那種卡片：名稱、副標、敘述、📐 實際數據
  function factCard(name,sub,text,facts){return '<div class="m-wiki-card"><div class="m-wiki-name">'+name+'</div>'+(sub?'<div class="m-wiki-msg">'+sub+'</div>':'')+(text?'<div class="m-wiki-desc">'+text+'</div>':'')+(facts&&facts.length?'<div class="m-wiki-desc" style="margin-top:6px;padding:8px 10px;border:1px solid #475569;border-left:3px solid #fbbf24;border-radius:8px;"><b style="color:#fbbf24;">📐 實際數據</b>'+facts.map(function(f){return '<div style="margin-top:3px;">・'+f+'</div>';}).join('')+'</div>':'')+'</div>';}
  var splitFacts=function(d){return String(d||'').split(/[；。]/).map(function(x){return x.trim();}).filter(Boolean);};
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
      evoCard();
  }
  function evoCard(){
    return factCard('至高的支配（昇華支配 +5 再進化）','遺物的最後一個階段','在燃柳村「哈瑪大師」把「+5 昇華支配」遺物進化，成功率 100%。',[
      '材料：六種時空材料各 1 個（滅魔蔑視水晶 地／水／火／風、暗星塵、夢域塵）',
      '進化後隨機得到一種特效（身上與背包已有的會優先避開）：克特套裝、死亡騎士套裝、惡魔套裝、四大軍王套裝（各視同穿滿 4 件）、真．冥皇套裝（視同 5 件）、全能力 +30、面板能力 +50、四屬性抗性 +100',
      '遺物・司祭苦行套裝的遺物進化時，直接得到全部八種特效',
      '最多同時裝備 6 件至高的支配',
      '裝滿 6 件：發動「至暗支配・席琳的永生」——受到致命傷時免於死亡，30 秒後可再次觸發'
    ]);
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
      ['聖衣','已登錄鑽石的怪物鑽石卡','14 種時空變身全部取得（封印的也算）',rate('samsara'),'時空變身碎片 ×1']
    ])+desc('只使用背包裡未鎖定的材料卡；各階分別累計連敗，連敗 '+pity+' 次後第 '+(pity+1)+' 次必定成功。聖衣 12 件平均隨機抽出。'));
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
      ['聖衣','第一次取得為封印聖衣，第二次解除封印；解封後再取得返還鑽石卡（不升星）。']
    ]));
    h+=card('高階變身能力',table(['能力','神話','天上','時空','聖衣（封印）','聖衣（解封）'],[
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
    if(F.catalog.samsara&&F.catalog.samsara.length)h+=card('聖衣・十二星座',table(['聖衣','傳說','特殊能力（解除封印後）'],F.catalog.samsara.map(function(r){return [esc(r.n),esc(r.lore||''),esc(r.special||'')];}))
      +desc('<b>副本內</b>：一律回到封印型態，沒有特殊能力。<b>缺點</b>：沒回安全區（村莊）連續戰鬥 30 分鐘會解除變身並冷卻 30 分鐘（真實時間），冷卻中不能變身聖衣；回村莊計時歸零。雙子座的 ×30 有自己的 50 秒冷卻，優先於首擊加倍、也不消耗首擊。')
      +desc('<b>聖衣共通</b>：造成的傷害 50% 轉成全隊回復（每 3 秒一次，溢出的部分轉成轉生者的護盾）。')+desc('玩家變身成聖衣時，背後會展開該星座的點陣背飾（可在外掛開關「變身光環」關閉）。'));
    h+=card('最終減傷（真實減傷）',table(['項目','說明'],[
      ['計算順序','公式減傷 → 聖結界 → 傷害減免與技藝減傷 → 最後再扣最終減傷（最低扣到 0）。'],
      ['適用','玩家與傭兵受到的怪物物理、魔法攻擊；持續傷害與夢艷的王登場衝擊不算。'],
      ['來源','聖衣（封印 100／解封 500）、騎士技藝命運迴響（先減 10% 後再扣 500）。']
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
    var h=note('轉生後到<b>燃柳村・奧拉奇里亞</b>免費修習；每個職業兩門技藝擇一，可隨時回來改選。卡片下方金框是實際數據。');
    Object.keys(by).forEach(function(c){
      h+='<div class="m-wiki-note" style="margin-top:10px;"><b>'+(CN[c]||c)+'</b></div>';
      by[c].forEach(function(x){h+=factCard(esc(x[1].n),esc((X.LORE||{})[x[0]]||''),'',splitFacts(x[1].d).map(esc));});
    });
    h+=factCard('四大天王','傭兵越多，全隊的刀鋒越重','轉生後招傭兵自動生效。',[
      '上場人數每 4 人計 1 次，16 人＝5 次',
      '每次一般攻擊，對主目標追加「武器最大值 × 次數 × 5」的傷害',
      '16 人上場時，傭兵的技藝效果減半'
    ]);
    h+=factCard('最終減傷（真實減傷）','所有減傷算完之後，最後再扣一次','',[
      '來源：聖衣（封印 100／解封 500）、命運迴響 500',
      '命運迴響：受到的傷害先減 10%，再扣 500 點'
    ]);
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
      ['敵對血盟的強度','依你一般攻擊的平均傷害換算，但扣掉變身卡系統（首擊加成、雙子座、星座特效）與卡冊的傷害加成；單擊最多算平均的 3 倍，一次爆發不會把敵人拉上天。'],
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
    note('夢艷地獄的完整規則請看「席琳」分頁。')+supplyRules()+
    card('畫面與效能選項',table(['選項','用途'],[
      ['魔法武器','你的魔法武器發動時，20% 機率傷害加倍。'],
      ['外掛開關 → 變身光環','只控制光環外觀；關閉後保留變身能力。'],['省電模式','可關閉動畫、光暈、戰鬥特效與音效，減少裝置負擔。'],
      ['外掛開關 → 卡頓修正','啟用日誌合併、按需繪製及動畫快取管理。'],
      ['恢復統計','統計分頁 DPS 下方列出玩家、傭兵、寵物、召喚物的每秒恢復；能力面板的 HP 恢復量顯示完整算式。'],
      ['回城卡頓偵測','回城後 3 秒內畫面停頓超過 0.3 秒，系統訊息會列出停頓時間、耗時函式與記憶體變化，可回報給作者。']
    ]));}
  function reborn(){
    return note('夢艷地獄的盡頭是暗夢星迴，星迴的盡頭是冥王域。走過一次輪迴，同一副身軀便能承載兩倍的力量。轉生技藝請看「轉生技藝」。')+
    note('暗夢星迴・星迴試煉的完整規則請看「副本」分頁。')+
    card('輪迴轉生（時空裂痕-冥王域）',table(['項目','規則'],[
      ['條件','Lv100、集齊六種時空材料；從時空裂痕入口進入「時空裂痕-冥王域」，轉生後回到說話之島。'],
      ['第二次轉生','集齊八職業的「不屈的命運」（星迴試煉頭目必掉，隨機職業）後，冥王域會顯示第二次轉生。轉生資訊：暫無（尚未開放，不扣材料、不重置等級）。'],
      ['等級','回到 Lv1、經驗歸零，但保留 Lv100 時的 HP／MP；等級上限 150（Lv100 以上每級需求依 Lv99 再每級 +10%）。技能、裝備、背包都保留。'],
      ['屬性','全部保留；屬性上限 200（配點上限 60 → 200），100 以上的效果依 80→100 那段的成長往上延伸。'],
      ['精通','自動擁有該職業全部四種精通。'],
      ['面板 +50','近／遠距離傷害與命中、魔法傷害與命中、額外魔法點數、四屬性抗性、魔防、迴避各 +50，AC −50。'],
      ['裝備','不限職業；所有武器都可雙持（主手有武器時再裝一把放到副手，副手追加一次攻擊，兩把弓也行）。'],
      ['傭兵','任何職業都能帶 7 名；轉生後 15 名（連自己 16 人）。'],
      ['技藝','可向奧拉奇里亞學轉生技藝（見「轉生技藝」）。'],
      ['魔法消耗','只限傷害型法術：（技能基礎 MP ＋ SP 超過 50 時再 +50）× 3。例：流星雨 80 MP → (80+50)×3＝390。補助、增益、對敵負面狀態的魔法照原價。'],
      ['SP','INT 提供的 SP 不再封頂 33，至少 (INT＋35)÷3（INT 200 → 78）；面板的額外魔法點數 +50 也算進魔法公式。'],
      ['HP 恢復','自然恢復改為每 3 秒一次。'],
      ['溢補護盾','治療溢出的部分變成護盾，上限為最大 HP 20%；受傷先扣護盾，可以防暴斃。'],
      ['敗者榮光（全隊）','隊長轉生後全隊生效：所有武器都有擦傷——沒命中的一般攻擊改成擦傷（傷害 50%）；屬性抗性滿（免疫）時，原本轉成物理的傷害減半，而且這一半改成回復 HP。']
    ]))+
    card('轉生後的夢艷地獄',table(['項目','規則'],[
      ['技能消耗','你與傭兵的技能 MP／HP 消耗 ×2。'],
      ['復活與召喚','返生術、召喚術、造屍術、召喚屬性精靈的 MP 與復活卷軸張數再 ×2；同一場戰鬥累積倒下 20／50／60／80／100 次各再 ×2，100 次起復活有 10 秒冷卻（寵物除外）。你倒下、換地圖或離開就歸零。'],
      ['復活卷軸','你與傭兵 HP 100% 復活，但吸走當前 MP 10%。'],
      ['不論轉生','一般怪死亡：你與傭兵各扣最大 HP 1%（身上有魔法屏障就不受影響）；王死亡全隊受當前 HP 10% 真實傷害，並吸走你與傭兵 MP 10%。王登場全隊扣最大 HP 10%（傳送控制戒指引來的 15%）。60 級以上小怪免疫期間反彈另一類傷害的 25%。']
    ]))+
    card('遺物的夢艷詞條與收購',table(['項目','規則'],[
      ['夢艷地獄掉遺物','遠古系詞條＋屬性五階同時出現 0.1%；只出遠古系詞條 1%、只出屬性五階 1%；頭目掉的遺物必定兩者都有（屬性只存在於武器）。'],
      ['賣給商人','販賣、自動賣出、一鍵賣出的遺物改付龍之鑽石，固定價：+0＝500，每 +1 多 100，最高 +15＝2000；昇華支配遺物以 +15 計。'],
      ['收購 NPC','安全區的龍鑽收購 NPC 也會指名收 +0 遺物，出價 1～500 顆亂數；其他收購單一律在 1～原定價之間亂數（詳見小百科「遺物市場」）。'],
      ['分解','昇華支配遺物（+0～+5）可分解成 1 顆自選的昇華支配強化石（武器／防具／飾品）。']
    ]))+
    card('寵物 MP 恢復',desc('寵物的 MP 自然恢復改吃你自己的面板「MP 恢復」：比寵物原本的高就用你的，寵物裝備加成照加；任何地區都有效。'));
  }
  // ── 套裝：加掛版新增的套裝（資料取自天堂透視鏡）──
  var SET_SRC={kenrauhel:'首領「反王肯恩」Lv75（傲慢之塔 41～60 樓）',cerenis:'首領「賽尼斯(首領)」Lv72（傲慢之塔 41～60 樓）；兩隻首領互掉對方的部分部件',yahee:'炎魔謁見所的炎魔鐵匠製作（靈魂石碎片＋火焰之影素材＋混沌／死亡裝備）；素材由象牙塔 4～8 樓的怪物掉落',wet:'海音、伊娃王國、海賊島的水邊怪物掉落（原作是釣魚）',mutation:'首領「變異實驗體」Lv89（黑魔法研究室）',sihon:'不死系首領掉落（原作是屍魂塔分解）',vigor:'活動：所有首領 0.05% 掉落其中一件',old_bone:'原版骷髏套裝的掉落處，1/5 機率',old_gnome:'原版侏儒套裝的掉落處，1/5 機率',old_oasis:'原版歐西斯套裝的掉落處，1/5 機率'};
  function setExtra(){
    var S=W.__afkSets;if(!S||!S.SETNAME)return '';
    var by={};Object.keys(S.items||{}).forEach(function(id){var d=S.items[id];if(d&&d.set)(by[d.set]=by[d.set]||[]).push(d.n);});
    var h='<div class="m-wiki-note" style="margin-top:12px;">以下是加掛版依<b>天堂透視鏡</b>補齊的套裝（部件數值、套裝效果、取得方式照透視鏡；中文名轉繁體）。</div>';
    Object.keys(S.SETNAME).forEach(function(k){
      if(!by[k])return;var src=SET_SRC[k]||(/^(love|miracle|hope|luck|passion|truth|w11|b11|r11|trainee)$/.test(k)?'活動：所有首領 0.05% 掉落其中一件':'');
      h+='<div class="m-wiki-card"><div class="m-wiki-name">'+esc(S.SETNAME[k])+'　<span style="color:#7dd3fc;font-size:12.5px;">'+by[k].length+' 件部件</span></div>'
        +'<div class="m-wiki-desc"><b>效果：</b>'+esc((S.SET_TXT||{})[k]||'')+'</div>'
        +'<div class="m-wiki-desc" style="color:#94a3b8;"><b>組成：</b>'+esc(by[k].join('、'))+'</div>'
        +(src?'<div class="m-wiki-desc" style="color:#94a3b8;"><b>取得：</b>'+esc(src)+'</div>':'')+'</div>';
    });
    return h+note('透視鏡上有、但這裡沒做的：妖精套裝（透視鏡沒列部件）、修好的飾品（只有水中呼吸，本作用不到）。');
  }
  // ── 席琳：夢艷地獄 ──
  function dreamCard(){
    return card('瘋狂席琳・夢艷地獄',table(['事件','效果'],[
      ['開啟','席琳神殿向席琳祈禱（需 Lv40）；以瘋狂席琳為底，怪物 HP 共 ×50、傷害與命中大幅提高，沒有經驗與金幣，改掉昇華支配材料。'],
      ['王的數量','場上的王保持 1 隻；用傳送控制戒指找來的王一次出 3 隻同名王。傲慢之塔與時空裂痕不限制，副本維持原規則。'],
      ['王的看破','所有王每次出手 5% 機率發動看破：這一下的傷害 ×2（任何傷害都算，只有一下）。'],
      ['王的回血','每秒回復最大 HP 0.1%（暗夢星迴的試煉頭目不回）。'],
      ['王登場','不論是否轉生：每隻王登場、每次變身成下一階，都先對全隊（含寵物、召喚物）造成最大 HP 10% 的真實傷害；用傳送控制戒指引來的那一波改為 15%。'],
      ['轉生者','解除場上限制（最多 5 隻、王在場照樣出小怪）。'],
      ['60 級以上小怪','出生時隨機免疫物理或魔法 10 秒；免疫期間同時反彈另一類傷害（魔法免疫→反彈物理；物理免疫→反彈魔法），每次反彈該擊傷害的 25%（−75%）。'],
      ['擊敗一般小怪','你與傭兵各扣最大 HP 1%（身上有魔法屏障就不受影響）。'],['擊敗首領','全隊受到當前 HP 10% 的真實傷害，並吸走你與傭兵當前 MP 的 10%。'],
      ['轉生後的代價','技能消耗 ×2；復活與召喚代價再 ×2，戰鬥中累積倒下 20／50／60／80／100 次各再 ×2；100 次起復活有 10 秒冷卻。你自己倒下或換地圖歸零。'],
      ['復活卷軸（夢艷）','HP 100% 復活，吸走當前 MP 10%。'],
      ['夢艷遺物','打到的遺物：遠古系詞條＋屬性五階同時出現 0.1%；只出遠古系詞條 1%、只出屬性五階 1%；頭目掉的遺物必定兩者都有。'],
      ['暗夢星迴','在瘋狂席琳或夢艷地獄的世界裡，時空裂痕入口可進入星迴試煉（見「副本」與「輪迴轉生」）。']
    ]));
  }
  // ── 能力值：轉生後的上限與延伸 ──
  function statsExtra(){
    var fns=[['力量','近距離傷害','getStrMeleeDmg'],['力量','近距離命中','getStrMeleeHit'],['敏捷','遠距離傷害','getDexRangedDmg'],['敏捷','遠距離命中','getDexRangedHit'],['智力','魔法傷害','getIntMagicDmg'],['智力','魔法命中','getIntMagicHit'],['智力','額外魔法點數','getIntExtraMp']];
    var ext=function(fn,v){var f=W[fn];if(typeof f!=='function')return '—';var a=f(100),b=f(80);if(typeof a!=='number')return '—';return v<=100?f(v):a+Math.floor((a-b)/20*(v-100));};
    var rows=fns.filter(function(x){return typeof W[x[2]]==='function';}).map(function(x){return [x[0]+'・'+x[1]].concat([100,120,150,200,250].map(function(v){return String(ext(x[2],v));}));});
    return card('轉生後的能力值（上限 200，超過還能算）',
      desc('轉生後屬性上限提升到 <b>200</b>（配點上限 60 → 200）。100 以上的效果，依「80 → 100」那一段的成長幅度往上延伸：<b>效果(v) = 效果(100) ＋ ⌊(效果(100) − 效果(80)) ÷ 20 × (v − 100)⌋</b>。')+
      desc('<b>超過 200 也還能計算</b>：裝備、Buff、血盟等其他來源把屬性推過 200 時，面板顯示「200(+X)」，超出的 X 仍算進近距離、遠距離、魔法的傷害、命中、爆擊與額外魔法點數（照同一條延伸公式）。')+
      desc('INT 提供的 SP 不再封頂 33，至少 ⌊(INT ＋ 35) ÷ 3⌋（INT 200 → 78）；面板的額外魔法點數 +50 也算進魔法公式。')+
      table(['屬性・效果','100','120','150','200','250'],rows));
  }
  // ── 副本：四龍巢穴與星迴試煉 ──
  function dungeonExtra(){
    var C=W.__afkCorrupt,h='';
    if(C&&C.DRAGONS){
      var EN={water:'水',fire:'火',wind:'風',earth:'地'};
      h+=card('四龍巢穴（法利昂／巴拉卡斯／林德拜爾）',
        desc('在威頓村「多魯嘉貝爾」進入，跟安塔瑞斯一樣分 4 區推進（入口 → 通道 → 深處 → 棲息地），擊敗各區頭目自動深入，最終龍七階變身。每個角色每天每座 1 次（主戰與出戰傭兵都消耗，UTC+8 凌晨 12 點重置；失敗或離開不消耗）。')+
        table(['副本','屬性','各區頭目','小怪'],Object.keys(C.DRAGONS).map(function(k){var d=C.DRAGONS[k];return ['<b style="color:'+d.color+'">'+esc(d.pre+'的'+d.dragon)+'</b>',EN[d.ele]||d.ele,esc(d.bosses.map(function(b){return b[0];}).join('、')),esc(d.minions.map(function(b){return b[0];}).join('、'))];}))+
        desc('房間效果：每秒 500 真實傷害＋500 對應屬性傷害（屬性部分吃抗性）。王在場時每 20 秒對全隊施放一種治療減益 10 秒：死亡藥水（藥水變扣血）、死亡治療（治癒魔法變扣血）、減少治療（治癒減半）。')+
        desc('最終龍的技能：龍魂吸取（倒下前吸走全隊 20% HP、80% MP）、不滅龍心（致命一擊以 1 HP 撐 10 秒）、龍之再生（60 秒內沒擊倒就回滿）、龍鱗反射（2 秒反射物理或魔法）。')+
        desc('掉落：比照安塔瑞斯，最終龍改掉該龍的八種專屬材料，另有該龍的六階魔法娃娃 1%；四座最終龍另有白金卡 0.001%、鑽白金幻化 0.01%、境滅亡域鑰匙。'));
    }
    var D=W.__afkDreamStarCfg;
    h+=card('暗夢星迴・星迴試煉（最終頭目）',
      desc('只在<b>瘋狂席琳</b>或<b>夢艷地獄</b>的世界裡開啟：時空裂痕入口消耗 1000 顆龜裂之核，只出一隻頭目「裂縫夢境者投影」（外觀與魔法沿用抽到的頭目），15 分鐘內沒打倒就自爆。')+
      table(['項目','夢艷地獄（完整試煉）','瘋狂席琳（簡化版）'],[
        ['頭目','HP '+(D?Math.round(D.hp/1e6)+' 百萬':'—')+'，AC −80、減傷 30、魔防與四屬性抗性 300，不回血','同 HP；AC、減傷、魔防、抗性都減半'],
        ['一般攻擊','6D40＋80，每 2 秒；原頭目的魔法保留','傷害減半'],
        ['受到的傷害','夢境之軀 −30%；星輝護甲（物理）／夢紗（魔法）每分鐘輪替再 −30%','只有夢境之軀的一半（−15%）'],
        ['暴走','一開場就暴走：傷害 +10%，每分鐘再 +10%，最多 +100%；第 4、8 分暴氣，全隊額外扣最大 HP 10%','沒有'],
        ['血壁空間','每 30 秒，3 秒內近距離、遠距離、魔法傷害的 10% 反彈給出手的人','沒有'],
        ['百分比傷害','星蝕每 20 秒全隊最大 HP 5%；夢噬每 35 秒血最多的人現有 HP 30%；墜星 2 分 30 秒起每分鐘全隊 10%','只有星蝕（每 20 秒全隊 5%）'],
        ['其他時間軸','魔法相消術（15 秒）、衝擊之暈與聖結界（30 秒）、堅固防禦（1 分）、全幻覺（3 分）、鏡反射與疼痛歡愉（5／6 分，各 10 秒反彈一成）、四屬性風暴（7 分起，每秒地水火風各 100）、四大究極魔法（10 分 05 秒起每 2 秒一發，共 4 發，每發最大 HP 12%）','沒有'],
        ['死亡藥水','喝治癒藥水：一半回復、一半變成傷害（藥水加成照算）','沒有'],
        ['基準','16 人、全身昇華支配 +5、時空變身，苦戰約 14 分鐘','—']
      ])+
      desc('掉落：必掉一種時空材料＋5000 龍之鑽石＋一顆「不屈的命運」（八職業隨機）；50% 再掉 3 個昇華支配材料；0.01% 鑽白金幻化。八職業的不屈的命運全部集齊，冥王域顯示第二次轉生（轉生資訊：暫無）。'));
    return h;
  }

  function augment(key,html){
    if(key==='relicbook'&&on('relicfx'))return note('各件分階能力請看「遺物進階」；共通的印記、毒血及治療規則請看「冒險規則」。')+html;
    if(key==='combat'&&on('relicfx'))return marks()+healing()+html;
    if(key==='rift'&&W.AFK_TTMI_ITEMS)return supplyRules()+html;
    if(key==='pledge'&&W.__afkCastleWar)return castleWar()+html.replace(/肯特城／風木城／海音城/g,'七座城（詳見上方）');
    if(key==='poly')return note('怪物型態：<b>等級夠就能變身</b>（表中「解鎖條件」的等級）。要吃到<b>變身收集冊</b>的加成：怪物圖鑑收到<b>銀卡</b>後，那隻怪才會掉變身卡；<b>普卡</b>全部收集滿才開放銀卡掉落，銀卡全部收集滿才開放<b>金卡</b>。')+html.replace(/「鑽石變身」/g,'「變身卡」');
    if(key==='set')return html+setExtra();
    if(key==='sherine')return dreamCard()+html;
    if(key==='stats')return html+statsExtra();
    if(key==='antharas'&&on('corrupt')){
      // The original page describes the base three-stage dragon; the current
      // dragon plugin extends that same encounter to seven stages.
      html=html.replace(/三段變身/g,'七階變身').replace(/連續變身三階/g,'連續變身七階').replace(/前兩階/g,'前六階');
      return dungeonExtra()+dragonRules()+html;
    }
    return html;
  }
  var guide=W.AFK_GAME_GUIDE={
    render:function(key){return key==='relicstages'?relics():key==='cardforms'?formRules():key==='versionrules'?rules():key==='rebirtharts'?arts():key==='reborn'?reborn():null;},
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
