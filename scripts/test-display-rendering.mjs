import assert from 'node:assert/strict';
import fs from 'node:fs';
import {testBrowser,createProfile} from './relic-test-browser.mjs';

// The server supplies CSP restrictions directly: no request interception while
// collecting renderer metrics. Only decoded data-URL image fixtures are used.
const browser=await testBrowser({offlineFixtures:true}),results=[];
async function scene(page){
  await page.evaluate(createProfile,{lv:100,seed:913});
  await page.evaluate(async()=>{
    state.ff=false;state.running=false;window.__vfxOff=false;mapState.current='dragon_valley';
    document.getElementById('creation-screen').classList.add('hidden');document.getElementById('game-screen').classList.remove('hidden');
    const stage=document.getElementById('app-stage');stage.style.cssText='position:fixed;inset:0;display:block;width:100%;height:100%;transform:none';
    const bv=document.getElementById('battle-view');bv.classList.remove('hidden');bv.classList.add('area-fit');bv.style.cssText='position:fixed;left:100px;top:100px;width:800px;height:500px;display:block;transform:none';
    const ml=document.getElementById('mob-list');ml.style.cssText='position:absolute;left:0;top:0;width:800px;height:242px;display:block';ml.innerHTML='<div class="mob-target" data-uid="display-target" style="position:absolute;left:380px;top:10px;width:100px;height:120px"><div class="mob-img-inner" style="width:100px;height:112px"></div></div>';
    window.__displayImages=[];
    for(const color of ['#facc15','#38bdf8']){const im=new Image();im.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="48"><path fill="'+color+'" d="M16 1L29 16 24 47H8L3 16Z"/></svg>');await im.decode();__displayImages.push(im);}
    window.__displayMob={...DB.mobs.wolf,uid:'display-target',curHp:10000,hp:10000,st:newMobStatus()};mapState.mobs=[__displayMob,null,null,null,null];mapState.targetIdx=0;
    for(let d=0;d<8;d++)_spellFxCache['冰箭/1797-'+d]=[__displayImages[0],__displayImages[1],__displayImages[0],__displayImages[1]];
  });
}
try {
  {
    const {page,errors,close}=await browser.page();
    try {
      await scene(page);
      const checks=await page.evaluate(()=>{
        const out=[],ok=(v,s)=>{if(!v)throw Error(s);out.push(s);};
        const el=document.createElement('img');document.body.appendChild(el);el.style.cssText='position:fixed;transform-origin:center';
        ok(__afkProjectileFrame(el,41,62,32,48,true,__displayImages[0].src),'projectile handler enabled');
        const r=el.getBoundingClientRect();ok(Math.abs(r.x-41)<.1&&Math.abs(r.y-62)<.1&&r.width===32&&r.height===48,'transform preserves anchor, size and horizontal mirror');
        AFK_TOGGLES.set('perf-render',false);ok(!__afkProjectileFrame(el,50,70,32,48,true,__displayImages[0].src)&&el.style.transform==='scaleX(-1)','disabling render optimization restores native path');el.remove();AFK_TOGGLES.set('perf-render',true);
        const base=findPolyForm('烈焰的死亡騎士').form;player.poly=JSON.parse(JSON.stringify(base));player.buffs.poly=10000;
        const ally=JSON.parse(JSON.stringify(player));ally._slot=2;ally.curHp=ally.mhp;ally.allies=[];player.allies=[ally];
        function preloadActor(a,group){for(let d=0;d<8;d++){a._faceD=d;const f=_actorBattleForm(a,group);_morphBattleCache[f.key]={idle:__displayImages,attack:__displayImages,skill:__displayImages,hurt:__displayImages,death:__displayImages,shadow:{},weapon:{}};}}
        preloadActor(player,false);preloadActor(ally,false);
        AFK_POWERSAVE.preset('low');
        for(let i=0;i<5;i++){_playerMorphApply();_allySpritesApply();}
        ok(!!(_pmState.el&&_pmState.imgs.bd.src===__displayImages[0].src),'static mode creates a visible player on first load');
        ok(!!(_allySpriteStates['2']&&_allySpriteStates['2'].imgs.bd.src===__displayImages[0].src),'static mode creates a visible ally on first load');
        const src=_pmState.imgs.bd.src;
        for(let i=0;i<50;i++){_playerMorphApply();_allySpritesApply();}
        ok(_pmState.imgs.bd.src===src,'static player keeps idle frame');
        ally._downed=true;ally.curHp=0;_allySpritesApply();_allySpritesApply();ok(_allySpriteStates['2'].imgs.bd.src===__displayImages[1].src,'static ally shows final death frame');
        player.allies=[];_allySpritesApply();ok(!_allySpriteStates['2'],'removed ally is removed from the battlefield');
        player.enSeed='display-test-owner';const p=petNewInstance(Object.keys(PET_BOOK)[0],20);p.outOwner=_petCurrentOwnerKey();p._px=.2;p._py=.7;p._dir=6;petRoster().push(p);
        for(let d=0;d<8;d++)_pet8Cache[(p.formGfx||p.form)+'#'+d]={idle:__displayImages,walk:__displayImages,attack:__displayImages,death:__displayImages,shadow:{}};
        for(let i=0;i<5;i++)_petAnimApply();
        const petEl=Array.from(document.querySelectorAll('[data-pet]')).find(e=>e.dataset.pet===String(p.uid));
        ok(!!petEl&&petEl.querySelector('.pet-body').src===__displayImages[0].src,'static mode creates a visible pet');
        p._downed=true;_petAnimApply();_petAnimApply();ok(petEl.querySelector('.pet-body').src===__displayImages[1].src,'static pet shows final death frame');
        p.outOwner='';_petAnimApply();ok(!petEl.isConnected,'removed pet is removed from battlefield');
        const row=AFK_CARD_ASCENSION.catalog.spacetime[0];player.cardAscension={v:1,owned:{[row.id]:true},unlocked:{spacetime:true},failures:{},attempts:{}};player.poly=JSON.parse(JSON.stringify(row.form));player.buffs.poly=1000;AFK_CARD_FORMS.decorate(_pmState.el,player);
        const aura=_pmState.el.querySelector('.afk-trans-aura');ok(!!aura&&getComputedStyle(aura).display==='none','no-glow mode hides card aura');
        AFK_POWERSAVE.set('nofx',false);ok(getComputedStyle(aura.querySelector('.ca-ring')).animationPlayState==='paused','no-animation mode pauses card glow motion');
        AFK_POWERSAVE.preset('full');ok(getComputedStyle(aura).display!=='none'&&getComputedStyle(aura.querySelector('.ca-ring')).animationPlayState==='running','full visuals restore aura');
        return out;
      });
      assert.equal(errors.length,0,errors.join('\n'));results.push({checks});console.log('PASS static rendering: '+checks.length+' checks');
    } finally {await close();}
  }
  // Native playSpellFx runs unchanged apart from the anchored frame hook.
  // Only images are fixture frames; there are no gameplay ticks in this test.
  for(let round=0;round<5;round++)for(const enabled of (round%2?[true,false]:[false,true])){
    const {page,errors,close}=await browser.page();
    try {
      await scene(page);await page.evaluate(on=>AFK_TOGGLES.set('perf-render',on),enabled);
      const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
      const before=await cdp.send('Performance.getMetrics');
      const count=await page.evaluate(async()=>{
        let generated=0,maxNodes=0;
        for(let wave=0;wave<6;wave++){
          for(let i=0;i<30;i++)playSpellFx('冰箭',__displayMob,{_slot:'vfx-'+wave+'-'+i});
          const l=document.getElementById('vfx-layer');const n=l?l.querySelectorAll('.vfx-spell').length:0;generated+=l?Array.from(l.querySelectorAll('.vfx-spell')).filter(e=>e.dataset.fxkey.includes('ally:vfx-'+wave+'-')).length:0;maxNodes=Math.max(maxNodes,n);
          // Wait for this wave's native animation cleanup. A busy host must
          // not silently turn one side into a different concurrency scenario.
          const until=performance.now()+5000;
          while(document.querySelector('#vfx-layer .vfx-spell')){
            if(performance.now()>until)throw Error('Native projectile wave failed to finish');
            await new Promise(r=>requestAnimationFrame(r));
          }
        }
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        return{generated,maxNodes,remaining:document.querySelectorAll('#vfx-layer .vfx-spell').length,hp:player.hp,targetHp:__displayMob.curHp};
      });
      const after=await cdp.send('Performance.getMetrics'),metrics={};
      for(const key of ['LayoutCount','LayoutDuration','RecalcStyleCount','RecalcStyleDuration','TaskDuration'])metrics[key]=after.metrics.find(m=>m.name===key).value-before.metrics.find(m=>m.name===key).value;
      assert.equal(count.generated,180);assert.equal(count.maxNodes,30);assert.equal(count.remaining,0);assert.equal(count.targetHp,10000);assert.equal(errors.length,0,errors.join('\n'));
      const r={optimized:enabled,round,images:'decoded local SVG fixtures',...count,metrics};results.push(r);console.log(JSON.stringify(r));
    } finally{await close();}
  }
  const median=xs=>xs.sort((a,b)=>a-b)[Math.floor(xs.length/2)];
  const baseline=results.filter(x=>x.optimized===false),optimized=results.filter(x=>x.optimized===true);
  const comparison={baselineLayouts:median(baseline.map(x=>x.metrics.LayoutCount)),optimizedLayouts:median(optimized.map(x=>x.metrics.LayoutCount)),baselineTaskSeconds:median(baseline.map(x=>x.metrics.TaskDuration)),optimizedTaskSeconds:median(optimized.map(x=>x.metrics.TaskDuration))};
  fs.mkdirSync('.scratch',{recursive:true});fs.writeFileSync('.scratch/display-rendering-results.json',JSON.stringify({results,comparison},null,2)+'\n');console.log(JSON.stringify(comparison));
} finally{await browser.close();}
