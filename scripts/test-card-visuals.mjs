import assert from 'node:assert/strict';
import fs from 'node:fs';
import {testBrowser,createProfile} from './relic-test-browser.mjs';

// Native project art, native actor rendering, original CSS aura. This is a
// visual integration check, not a GPU benchmark or an official R/M/W asset.
const b=await testBrowser(),results=[];
fs.mkdirSync('.scratch/card-visuals',{recursive:true});
try {
  const {page,errors,close}=await b.page({assets:true,context:{viewport:{width:1100,height:800}},font:fs.existsSync('.scratch/fonts/NotoSansCJKtc-Regular.otf')?'/.scratch/fonts/NotoSansCJKtc-Regular.otf':undefined});
  try {
    await page.evaluate(createProfile,{cls:'elf',lv:100});
    await page.evaluate(()=>{
      state.ff=false;state.running=false;AFK_POWERSAVE.preset('full');
      document.getElementById('creation-screen').classList.add('hidden');document.getElementById('game-screen').classList.remove('hidden');
      const stage=document.getElementById('app-stage');stage.style.cssText='position:fixed;inset:0;display:block;width:100%;height:100%;transform:none';
      const view=document.getElementById('battle-view');view.classList.remove('hidden');view.classList.add('area-fit');document.body.appendChild(view);view.style.cssText='position:fixed;left:220px;top:100px;width:660px;height:500px;display:block;transform:none;background:radial-gradient(ellipse at center,#263c50,#070e17);overflow:hidden;z-index:100000';
      document.getElementById('mob-list').innerHTML='';
      mapState.current='dragon_valley';mapState.mobs=[null,null,null,null,null];
      player.cardAscension={v:1,owned:{},attempts:{},failures:{},unlocked:{mythic:true,celestial:true,spacetime:true}};
      for(const rows of Object.values(AFK_CARD_ASCENSION.catalog))for(const row of rows)player.cardAscension.owned[row.id]=true;
    });
    for(const tier of ['mythic','celestial','spacetime']) {
      const info=await page.evaluate(tier=>{
        const row=AFK_CARD_ASCENSION.catalog[tier].find(r=>r.prototype==='莉絲安');
        player.poly=JSON.parse(JSON.stringify(row.form));player.buffs.poly=1800;player._faceD=2;recomputeStats();
        _playerMorphApply();const f=_actorBattleForm(player,false);
        return{tier,name:row.n,form:f,highForms:AFK_CARD_FORMS.highForms.map(f=>({name:f.n,level:f.lv}))};
      },tier);
      await page.waitForFunction(key=>{const c=_morphBattleCache[key];return c&&c!=='probing'&&Array.isArray(c.idle)&&c.idle.length>0;},info.form.key,{timeout:15000});
      await page.evaluate(()=>{_playerMorphApply();_playerMorphApply();});
      // 每一階都有自己的自製圖（不再共用同一個資料夾），等目前顯示的那一幀解碼完成再量
      await page.waitForFunction(()=>{const i=document.querySelector('#player-morph-sprite .pm-body');return i&&i.complete&&i.naturalWidth>0;},null,{timeout:15000});
      const rendered=await page.locator('#player-morph-sprite').evaluate(el=>{
        const img=el.querySelector('.pm-body'),aura=el.querySelector('.afk-trans-aura');
        return{tier:el.dataset.cardAura,src:img&&img.src,decoded:!!(img&&img.complete&&img.naturalWidth>0),visible:el.getBoundingClientRect().width>0,aura:!!aura,auraHeight:aura&&aura.getBoundingClientRect().height};
      });
      assert.equal(rendered.tier,tier);assert.equal(rendered.decoded,true);assert.equal(rendered.visible,true);assert.equal(rendered.aura,true);
      assert.ok(rendered.auraHeight>=70,'aura has real height despite native one-pixel actor anchor');
      const hit=await page.locator('#player-morph-sprite').evaluate(el=>{const r=el.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!at&&(el.contains(at)||at.closest('#battle-view')!==null);});
      assert.equal(hit,true,'native sprite is not covered by another panel');
      await page.locator('#battle-view').screenshot({path:'.scratch/card-visuals/'+tier+'.png'});
      results.push({...info,rendered});
    }
    assert.equal(errors.length,0,errors.join('\n'));
    fs.writeFileSync('.scratch/card-visuals/results.json',JSON.stringify({results,errors},null,2)+'\n');
    console.log(JSON.stringify(results.map(r=>({tier:r.tier,name:r.name,decoded:r.rendered.decoded,source:r.form.base}))));
  } finally {await close();}
} finally {await b.close();}
