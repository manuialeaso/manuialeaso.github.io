import assert from 'node:assert/strict';
import fs from 'node:fs';
import {testBrowser,createProfile} from './relic-test-browser.mjs';

const browser=await testBrowser(),report=[];
fs.mkdirSync('.scratch/interface',{recursive:true});
try {
  for(const spec of [
    {name:'desktop',viewport:{width:1440,height:1000}},
    {name:'phone',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
    {name:'tablet',viewport:{width:820,height:1180},isMobile:true,hasTouch:true},
    {name:'phone-mobile-off',viewport:{width:390,height:844},isMobile:true,hasTouch:true,mobileOff:true},
    {name:'landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true}
  ].filter(spec=>!process.env.INTERFACE_CASE||spec.name===process.env.INTERFACE_CASE)) {
    const {page,errors,close}=await browser.page({context:{viewport:spec.viewport,isMobile:!!spec.isMobile,hasTouch:!!spec.hasTouch},font:fs.existsSync('.scratch/fonts/NotoSansCJKtc-Regular.otf')?'/.scratch/fonts/NotoSansCJKtc-Regular.otf':undefined,init:spec.mobileOff?()=>localStorage.setItem('afk_toggle_mobile','0'):undefined});
    try {
      const initial=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('lineage_'))));
      await page.evaluate(()=>{let b=document.getElementById('_orig_pbar');if(!b){b=document.createElement('div');b.id='_orig_pbar';document.body.appendChild(b);}b.textContent='非官方轉載版本・原作者 shines871';b.style.cssText='position:fixed;top:0;left:0;right:0;height:58px;z-index:2147483647;background:#782a18;color:white;';AFK_BANNER.remeasure();AFK_WIKI_API.goto({tab:'relicstages'});});
      const tabs=await page.locator('#m-wiki-tabs [data-tab]').evaluateAll(es=>es.map(e=>({key:e.dataset.tab,n:e.textContent})));
      const tabChecks=[];
      for(const t of tabs) {
        await page.evaluate(k=>AFK_WIKI_API.goto({tab:k}),t.key);
        const info=await page.evaluate(()=>{const e=document.getElementById('m-wiki-body'),w=document.getElementById('m-wiki-wrap'),c=document.getElementById('m-wiki-close'),r=w.getBoundingClientRect(),q=c.getBoundingClientRect();return{text:e.textContent.trim().length,scroll:e.scrollWidth,client:e.clientWidth,rect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},close:{y:q.y,bottom:q.bottom},vw:innerWidth,vh:innerHeight};});
        assert.ok(info.text>0,`${spec.name}/${t.key} has content`);
        assert.ok(info.rect.x>=-2&&info.rect.right<=info.vw+2,`${spec.name}/${t.key} dialog stays within width: ${JSON.stringify(info)}`);
        assert.ok(info.close.y>=58&&info.close.bottom<=info.vh,`${spec.name}/${t.key} close stays below banner`);
        assert.ok(info.scroll<=info.client+2,`${spec.name}/${t.key} body has no horizontal overflow (${info.scroll}/${info.client})`);
        tabChecks.push(t.key);
      }
      await page.evaluate(()=>AFK_WIKI_API.goto({tab:'relicstages'}));
      assert.equal(await page.evaluate(()=>AFK_GAME_GUIDE.relicRows().length),250);
      await page.locator('#afk-guide-relic-query').fill('治療');
      await page.waitForTimeout(180);
      assert.ok(await page.locator('.afk-guide-relic').count()>0,'effect search spans relic catalog');
      await page.locator('.afk-guide-relic summary').first().click();
      await page.screenshot({path:'.scratch/interface/'+spec.name+'-relics.png'});
      await page.evaluate(()=>AFK_WIKI_API.goto({tab:'cardforms'}));
      assert.ok((await page.locator('#m-wiki-body').innerText()).includes('任一地區'));
      await page.screenshot({path:'.scratch/interface/'+spec.name+'-cards.png'});
      await page.evaluate(()=>AFK_WIKI_API.goto({tab:'antharas'}));
      const dragonText=await page.locator('#m-wiki-body').innerText();
      assert.ok(dragonText.includes('七階龍王')&&!dragonText.includes('三段變身')&&!dragonText.includes('前兩階'),'dragon page has current stages only');
      await page.evaluate(()=>AFK_WIKI_API.goto({tab:'enhance'}));
      const enhanceText=await page.locator('#m-wiki-body').innerText();
      assert.ok(enhanceText.includes('哈瑪大師')&&enhanceText.includes('飾品最高 +10'),'enhancement help follows the current relic rules');
      assert.ok(!enhanceText.includes('遺物不能強化')&&!enhanceText.includes('遠古系已無取得途徑'),'retired relic claims do not appear');
      await page.keyboard.press('Escape');
      const after=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('lineage_'))));
      assert.deepEqual(after,initial,'encyclopedia never rewrites a player save at the main menu');
      await page.evaluate(createProfile,{lv:100});
      await page.evaluate(()=>{
        document.getElementById('creation-screen').classList.add('hidden');document.getElementById('game-screen').classList.remove('hidden');
        const R=__afkRelicPlus,row=AFK_RELIC_CATALOG.find(r=>r.id===240),id=R.makeId(row.key,10,null,5);R.ensure(id);
        const item={id,uid:'interface-long-relic',cnt:1,en:0};player.inv.push(item);player.eq.belt={id:row.key,uid:'interface-current-belt',en:0};
        openModal(item,false);
      });
      const itemInfo=await page.locator('#item-modal').evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,scroll:e.scrollWidth,client:e.clientWidth};});
      assert.ok(itemInfo.x>=-2&&itemInfo.right<=spec.viewport.width+2&&itemInfo.y>=58&&itemInfo.bottom<=spec.viewport.height+2,`${spec.name} long item comparison bounds: ${JSON.stringify(itemInfo)}`);
      assert.ok(itemInfo.scroll<=itemInfo.client+2,`${spec.name} item comparison width`);
      const itemFlow=await page.evaluate(()=>{const d=document.getElementById('modal-item-desc').getBoundingClientRect(),a=document.getElementById('modal-actions').getBoundingClientRect();return{descriptionBottom:d.bottom,actionsTop:a.top};});
      assert.ok(itemFlow.descriptionBottom<=itemFlow.actionsTop+1,`${spec.name} long description must not overlap actions: ${JSON.stringify(itemFlow)}`);
      assert.ok(await page.locator('#modal-compare').isVisible(),'native equipment comparison remains visible');
      assert.ok((await page.locator('#modal-item-desc').innerText()).includes('哈瑪大師合成'),'item description names the actual relic upgrade route');
      assert.ok(!(await page.locator('#modal-item-desc').innerText()).includes('無法強化'),'relic does not contradict its upgrade system');
      await page.screenshot({path:'.scratch/interface/'+spec.name+'-item.png'});
      await page.locator('#item-modal button').filter({hasText:'關閉視窗'}).click();
      assert.ok(await page.locator('#item-modal').evaluate(e=>e.classList.contains('hidden')),'item close is reachable by native scrolling');
      await page.evaluate(()=>{
        const name=AFK_CARD_FORMS.monsterNames()[0];player.cardDex={[name]:10000};player.cardDexV=2;
        const item={id:'scroll_poly',uid:'interface-poly',cnt:1};player.inv.push(item);openPolySelect(item.uid);
      });
      const polyInfo=await page.locator('#poly-modal>.panel').evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,scroll:e.scrollWidth,client:e.clientWidth};});
      assert.ok(polyInfo.x>=-2&&polyInfo.right<=spec.viewport.width+2&&polyInfo.y>=58&&polyInfo.bottom<=spec.viewport.height+2,`${spec.name} polymorph bounds: ${JSON.stringify(polyInfo)}`);
      assert.ok(polyInfo.scroll<=polyInfo.client+2,`${spec.name} polymorph width`);
      await page.screenshot({path:'.scratch/interface/'+spec.name+'-poly.png'});
      await page.locator('#poly-modal button').filter({hasText:'取消'}).click();
      assert.ok(await page.locator('#poly-modal').evaluate(e=>e.classList.contains('hidden')),'native polymorph cancel works');
      await page.evaluate(()=>{
        const row=AFK_RELIC_CATALOG.find(r=>r.id===29),id=__afkRelicPlus.makeId(row.key,15,null,0);__afkRelicPlus.ensure(id);
        player.inv.push({id,uid:'interface-terminal-relic',en:0,cnt:1});__afkRelicPlus.open();
      });
      const hamaInfo=await page.locator('#rp-modal .rp-box').evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,scroll:e.scrollWidth,client:e.clientWidth};});
      assert.ok(hamaInfo.x>=-2&&hamaInfo.right<=spec.viewport.width+2&&hamaInfo.y>=58&&hamaInfo.bottom<=spec.viewport.height+2,`${spec.name} relic smith bounds: ${JSON.stringify(hamaInfo)}`);
      assert.ok(hamaInfo.scroll<=hamaInfo.client+2,`${spec.name} relic smith width`);
      await page.locator('#rp-modal .rp-rule summary').click();
      assert.ok((await page.locator('#rp-modal .rp-rule').innerText()).includes('飾品最高 +10'),'smith rules show accessory cap');
      const hamaScroll=await page.locator('#rp-modal .rp-content').evaluate(e=>({scroll:e.scrollHeight,client:e.clientHeight,width:e.scrollWidth,clientWidth:e.clientWidth}));
      assert.ok(hamaScroll.client>=80&&hamaScroll.width<=hamaScroll.clientWidth+2,`${spec.name} smith body has usable vertical scrolling: ${JSON.stringify(hamaScroll)}`);
      const terminalRow=page.locator('#rp-list .rp-row').filter({hasText:'這件遺物昇華支配後即達終階'});
      assert.equal(await terminalRow.count(),1,'terminal relic has one final-stage row');
      assert.equal(await terminalRow.locator('button').innerText(),'已達終階','terminal relic does not advertise a nonexistent upgrade');
      assert.ok(await terminalRow.locator('button').isDisabled(),'terminal upgrade is disabled');
      await page.screenshot({path:'.scratch/interface/'+spec.name+'-smith.png'});
      await page.keyboard.press('Escape');
      assert.ok(!await page.locator('#rp-modal').isVisible(),'ESC closes smith dialog');
      await page.evaluate(()=>{document.getElementById('town-view').classList.remove('hidden');interactNPC('npc_hama','town_gludio');});
      assert.ok(await page.locator('#interaction-content #rp-modal.rp-embed').isVisible(),'native NPC route embeds the smith');
      const embedded=await page.locator('#town-interaction-container').evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};});
      assert.ok(embedded.x>=-2&&embedded.right<=spec.viewport.width+2&&embedded.y>=58&&embedded.bottom<=spec.viewport.height+2,`${spec.name} embedded smith bounds: ${JSON.stringify(embedded)}`);
      await page.screenshot({path:'.scratch/interface/'+spec.name+'-smith-npc.png'});
      await page.evaluate(()=>closeNpcInteraction());
      await page.evaluate(()=>AFK_CARD_ASCENSION.openCollection());
      const cardRect=await page.locator('.afk-ca-dialog').boundingBox();
      assert.ok(cardRect.y>=58&&cardRect.y+cardRect.height<=spec.viewport.height+2,`${spec.name} card dialog bounds`);
      const cardBody=await page.locator('#afk-card-ascension-body').evaluate(e=>({scroll:e.scrollHeight,client:e.clientHeight}));
      assert.ok(cardBody.client>40,'card content has usable scroll area');
      await page.screenshot({path:'.scratch/interface/'+spec.name+'-collection.png'});
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#afk-card-ascension-modal').count(),0,'ESC closes card collection');
      await page.waitForTimeout(400); // ESC 關卡冊會走 history.back，等 popstate 落地再開下一個面板，免得被它順手關掉
      await page.evaluate(()=>AFK_POWERSAVE.open());
      await page.locator('#afk-ps-overlay').waitFor();
      const beforeAudio=await page.evaluate(()=>{const v=AFK_POWERSAVE.snapshot();return{bgm:v.bgm,sfx:v.sfx};});
      await page.locator('[data-preset="smooth"]').click();
      assert.deepEqual(await page.evaluate(()=>{const v=AFK_POWERSAVE.snapshot();return{noanim:v.noanim,nofx:v.nofx,vfx:v.vfx,vfxnum:v.vfxnum};}),{noanim:false,nofx:true,vfx:false,vfxnum:true});
      await page.locator('[data-preset="low"]').click();
      assert.ok(await page.evaluate(()=>document.body.classList.contains('afk-no-animation')));
      assert.deepEqual(await page.evaluate(()=>{const v=AFK_POWERSAVE.snapshot();return{bgm:v.bgm,sfx:v.sfx};}),beforeAudio,'visual presets preserve audio preference');
      await page.locator('[data-preset="full"]').click();
      assert.ok(!await page.evaluate(()=>document.body.classList.contains('afk-no-glow')));
      await page.screenshot({path:'.scratch/interface/'+spec.name+'-powersave.png'});
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#afk-ps-overlay').count(),0,'ESC closes power settings');
      await page.evaluate(()=>AFK_TOGGLES.openPanel());
      const toggleText=await page.locator('#afk-toggles-overlay').innerText();
      for(const text of ['鑽石變身與高階卡合成','變身光環','亞丁古物與材料工坊','文字與對話框整理'])assert.ok(toggleText.includes(text),text+' listed in toggles');
      assert.ok(!toggleText.includes('降低畫面更新頻率'),'removed setting is not advertised');
      assert.equal(errors.length,0,errors.join('\n'));
      const r={viewport:spec.name,tabs:tabChecks.length,passed:true,errors:errors.length};report.push(r);console.log(JSON.stringify(r));
    } finally {await close();}
  }
  fs.writeFileSync('.scratch/interface/results.json',JSON.stringify(report,null,2)+'\n');
  console.log('PASS: encyclopedia, responsive dialogs, navigation and power presets');
} finally {await browser.close();}
