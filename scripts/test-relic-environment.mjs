import assert from 'node:assert/strict';
import {testBrowser, createProfile} from './relic-test-browser.mjs';

// Complete index, real dungeon entry, tick, reflection, useItem and allyTryPotion.
// Only fixtures and random draws are controlled. Room targets cannot attack;
// actors have no automatic healing, and ticks 10/20/30 avoid natural HP regen.
// No hurt, pulse, incoming, reflection or tick function is replaced.
const browser = await testBrowser();
try {
  const {page, errors, close} = await browser.page();
  try {
    await page.evaluate(code => { window.__environmentProfile = eval('(' + code + ')'); }, createProfile.toString());
    const result = await page.evaluate(() => {
      const R = AFK_RELIC_RUNTIME, source = AFK_RELIC_DEFENSE.byId[222].key;
      const results = [], hurts = [], heals = [];
      const unobserve = R.observe((kind, row) => {
        if (kind === 'hurt') hurts.push({...row});
        if (kind === 'heal') heals.push({...row});
      });
      function check(value, message) { if (!value) throw Error(message); }
      function same(actual, expected, message) { if (actual !== expected) throw Error(message + ': expected ' + expected + ', got ' + actual); }
      function getHp(actor) { return actor === player ? actor.hp : actor.curHp; }
      function setHp(actor, amount) { if (actor === player) actor.hp = amount; else actor.curHp = amount; }
      function step() { state.running = true; try { tick(); } finally { state.running = false; } }
      function stepAt(before) { state.ticks = before; step(); same(state.ticks, before + 1, 'The original tick advances'); }
      function clearAutomation() {
        document.querySelectorAll('input[type=checkbox]').forEach(node => { node.checked = false; });
        player.config = {}; player.skills = []; player.grantedSkills = []; player.hots = {};
        player.autoSellOn = false;
      }
      function allyOfLeader() {
        const ally = JSON.parse(JSON.stringify(player));
        ally._allyName = '環境回歸傭兵'; ally._slot = '2'; ally.allies = [];
        ally.curHp = player.hp; ally._potHpPct = 0; ally._hpSafePct = 0;
        ally._mercPermanentPotions = true; ally._mercChaModelV = 2;
        ally._atkCd = 100000; ally._atkSkillCd = 100000; ally._healCastCd = 100000;
        ally._healSkill = null; ally._atkSkill = null; ally._convertSkill = null;
        player.allies = [ally]; R.invalidate(); return ally;
      }
      function fresh({helm = false, rebirth = 0, cls = 'knight'} = {}) {
        const eq = helm ? {helm:__afkRelicPlus.makeId(source, 15, null, 5)} : {};
        __environmentProfile({cls, lv:100, rebirth, eq, seed:24681357});
        state._afkDragon = null; player.enSeed = 'native-environment-test';
        clearAutomation(); Math.random = () => .999;
        hurts.length = 0; heals.length = 0;
        return allyOfLeader();
      }
      function quietRoom(ally) {
        // Keep real battle state while excluding enemy damage and all actor
        // actions. The native room pulse still runs after the original tick.
        const m = {n:'環境回歸目標', uid:uid(), lv:1, hp:10000000, curHp:10000000,
          ac:0, mr:0, e:'none', dr:0, dmg:[1,1], db:0, exp:0, noGold:true,
          noAttack:true, beh:'被動', drop:[], _born:++_mobBornSeq, _bornMs:Date.now(), _magCd:{}, st:newMobStatus()};
        mapState.mobs = [m, null, null, null, null];
        mapState.spawnAt = [null, 10000000, 10000000, 10000000, 10000000];
        player.statuses.stun = 100000;
        if (ally) ally.statuses.stun = 100000;
        state.ticks = 0; step(); // Prime the real map/battle transition at tick 1.
        return m;
      }
      function enterDragon(key, ally) {
        if (key === 'antharas') antharasEnter(); else afkCorruptEnter(key);
        const map = key === 'antharas' ? 'antharas_nest_1' : 'cr_' + key + '_nest_1';
        same(mapState.current, map, 'Native dungeon entry: ' + key);
        same(state.antharas, 1, 'The entered dungeon is active');
        quietRoom(ally);
        for (const actor of [player, ally]) {
          actor.d.resFire = actor.d.resWater = actor.d.resWind = actor.d.resEarth = 50;
          // Fixed environmental damage must not accidentally use ordinary DR/MR.
          actor.d.dr = 100000; actor.d.mr = 100000;
          setHp(actor, 3000);
        }
        hurts.length = 0; heals.length = 0;
      }
      function auraRows() { return hurts.filter(row => row.origin === 'dragon-aura'); }
      function expectAura(actors, raw, actual) {
        const rows = auraRows(); same(rows.length, actors.length, 'Exactly one environment event per actor');
        actors.forEach((actor, i) => {
          const row = rows.find(entry => entry.actor === actor);
          check(!!row, 'Environment event belongs to the correct actor');
          same(row.snapshot, raw[i], 'Environment raw amount before shield');
          same(row.actualDamage, actual[i], 'Environment actual HP damage');
          same(row.kind, 'dot', 'Environment uses the non-direct damage path');
          same(row.dotKind, 'environment', 'Environment has its own damage label');
          same(row.direct, false, 'Environment does not masquerade as an enemy direct hit');
        });
      }

      for (const [key, element] of [['antharas','earth'], ['fafurion','water'], ['valakas','fire'], ['lindvior','wind']]) {
        let ally = fresh(); enterDragon(key, ally);
        const actors = [player, ally], shieldSource = 'test-environment-shield';
        actors.forEach(actor => R.api.shield(actor, 1200, {source:shieldSource, duration:60}));
        stepAt(9);
        actors.forEach(actor => { same(getHp(actor), 3000, 'A full shield protects HP'); same(R.api.shieldAmount(actor, shieldSource), 200, 'The shield absorbs 500 true + 500 element'); });
        expectAura(actors, [1000,1000], [0,0]);
        hurts.length = 0; stepAt(19);
        actors.forEach(actor => { same(getHp(actor), 2200, 'Only shield overflow reaches HP'); same(R.api.shieldAmount(actor, shieldSource), 0, 'A broken shield is exhausted'); });
        expectAura(actors, [1000,1000], [800,800]);
        // Existing resistance rules: 250 resistance gives ×0.5, zero gives ×1.5.
        // Only the elemental half changes: 500+250 and 500+750 respectively.
        const stat = 'res' + element[0].toUpperCase() + element.slice(1);
        player.d[stat] = 250; ally.d[stat] = 0;
        hurts.length = 0; stepAt(29);
        same(player.hp, 1450, 'Player resistance affects only the elemental half');
        same(ally.curHp, 950, 'The mercenary uses its own resistance');
        expectAura(actors, [750,1250], [750,1250]);
        results.push({case:'native room shield, overflow and resistance', dungeon:key, rawAt50:1000, rawAt250:750, rawAt0:1250});

        ally = fresh({helm:true}); enterDragon(key, ally);
        const protectedActors = [player, ally];
        protectedActors.forEach(actor => { setHp(actor, 100); R.api.shield(actor, 1200, {source:shieldSource, duration:60}); });
        stepAt(9);
        protectedActors.forEach(actor => { same(getHp(actor), 100, 'Absorption precedes the lethal check'); same(R.state(actor, source).deathUses || 0, 0, 'An absorbed hit does not spend reconstruction'); });
        hurts.length = 0; stepAt(19);
        protectedActors.forEach(actor => { same(getHp(actor), 1, 'Environmental lethality preserves one HP'); same(R.state(actor, source).deathUses, 1, 'Each actor spends its own reconstruction once'); same(R.api.shieldAmount(actor, shieldSource), 0, 'The remaining shield is consumed before reconstruction'); check(!actor.dead && !actor._downed, 'The protected actor never enters a dead state'); });
        expectAura(protectedActors, [1000,1000], [99,99]);
        // +5 reconstruction restores full HP after one real second. At tick 30
        // that heal happens before the next real environmental pulse.
        hurts.length = 0; stepAt(29);
        protectedActors.forEach(actor => { same(getHp(actor), actor.mhp - 1000, 'Deferred reconstruction completes before the next room pulse'); same(R.state(actor, source).deathUses, 1, 'The next nonlethal pulse does not spend another charge'); });
        same(heals.filter(row => row.source === source && protectedActors.includes(row.target)).length, 2, 'One deferred reconstruction heal per actor');
        results.push({case:'native room #222 shield-before-lethal and deferred recovery', dungeon:key, chargesPerActor:1});
      }

      // 2026-10-24：夢艷地獄的小怪一律不反彈（60 級以上的夢艷反射移除；小怪自己的血壁空間也不反彈），頭目照舊。
      function dreamMob(kind, boss) {
        const m = {n:'夢艷反射回歸目標', uid:uid(), lv:60, hp:1000000, curHp:1000000, boss:!!boss,
          ac:0, mr:0, e:'none', dr:0, dmg:[1,1], db:0, exp:0, noGold:true,
          noAttack:true, _sherine:true, _born:++_mobBornSeq, _magCd:{}, st:newMobStatus()};
        Math.random = () => .99; __afkDreamHell.applyDream(m);
        check(!m._afkDreamReflect, 'Dream small mobs no longer get a reflection flag');
        m._reflectWall = {kind, until:state.ticks + 100};   // 非免疫型血壁空間
        mapState.mobs = [m, null, null, null, null]; return m;
      }
      for (const role of ['player', 'mercenary']) for (const kind of ['phys', 'magic']) {
        const ally = fresh({helm:true}), actor = role === 'player' ? player : ally;
        player.sherineMad = player.sherineDream = true;
        const shieldSource = 'test-dream-reflection', hitKind = kind === 'phys' ? 'melee' : 'magic';
        let m = dreamMob(kind, false); setHp(actor, 1000);
        R.api.shield(actor, 400, {source:shieldSource, duration:60});
        const before = hurts.filter(row => row.actor === actor && row.origin === 'reflection').length;
        reflectWallOnDamage(m, 250, hitKind, role === 'player' ? null : ally);
        same(getHp(actor), 1000, 'Small dream mob does not reflect');
        same(R.api.shieldAmount(actor, shieldSource), 400, 'Small dream mob reflection does not touch the shield');
        same(hurts.filter(row => row.actor === actor && row.origin === 'reflection').length, before, 'No reflected incoming event from a small dream mob');
        check(!!m._reflectWall, 'The small mob keeps its wall state (only the reflection is suppressed)');
        m = dreamMob(kind, true);
        reflectWallOnDamage(m, 200, hitKind, role === 'player' ? null : ally);
        check(R.api.shieldAmount(actor, shieldSource) < 400, 'Boss blood wall still reflects in dream mode');
        results.push({case:'dream small mobs never reflect; bosses still do', role, kind});
      }

      // Use a mage to exclude the independent knight/warrior/dragon potion
      // masteries. CON=10, no equipment or collection bonus, and ample missing
      // HP isolate the base potion multiplier without replacing any function.
      for (const role of ['player', 'mercenary']) for (const rebirth of [0, 1]) {
        for (const id of ['potion_heal', 'potion_strong', 'potion_ult']) for (const end of ['minimum', 'maximum']) {
          const ally = fresh({cls:'mage', rebirth:role === 'player' ? rebirth : 1 - rebirth});
          const actor = role === 'player' ? player : ally;
          actor.rebirth = rebirth; player.d.con = ally.d.con = 10;
          player._miscPotionBonus = 0; player.mhp = ally.mhp = 100000;
          player.hp = ally.curHp = 100; player.cds.pot = 0; ally._potCd = 0; ally._potHpPct = 95;
          const selector = document.getElementById('set-pot'); selector.value = id;
          same(selector.value, id, 'The native potion selector accepts the HP potion');
          gainItem(id, 3, true, true);
          const item = player.inv.find(entry => entry.id === id), def = DB.items[id];
          check(item && item.cnt === 3, 'The native inventory holds the test potion');
          const rolled = def[end === 'minimum' ? 'valMin' : 'valMax'] ?? def.val;
          Math.random = () => end === 'minimum' ? 0 : .999999;
          const use = () => role === 'player' ? useItem(item.uid, true) : allyTryPotion(ally);
          const before = getHp(actor), expected = rolled * (rebirth ? 3 : 1);
          use(); same(getHp(actor) - before, expected, 'Actual native HP potion restores the rolled base ×' + (rebirth ? 3 : 1));
          same(item.cnt, 2, 'A successful use consumes exactly one potion');
          same(role === 'player' ? player.cds.pot : ally._potCd, role === 'player' ? 1 : 10, 'Original player/mercenary potion cooldown remains one second');
          use(); same(item.cnt, 2, 'A second immediate use is blocked by native cooldown');
          same(getHp(actor) - before, expected, 'Cooldown blocks a second heal');
          results.push({case:'native HP potion multiplier and unchanged cooldown', role, rebirth, id, roll:end, healed:expected});
        }
      }
      for (const role of ['player', 'mercenary']) {
        const ally = fresh({cls:'mage', rebirth:1});
        const actor = role === 'player' ? player : ally;
        quietRoom(ally);
        player.d.con = ally.d.con = 10; player._miscPotionBonus = 0;
        player.mhp = ally.mhp = 100000; player.hp = ally.curHp = 100;
        player.cds.pot = 0; ally._potCd = 0; ally._potHpPct = 95;
        document.getElementById('set-pot').value = 'potion_heal';
        gainItem('potion_heal', 3, true, true);
        const item = player.inv.find(entry => entry.id === 'potion_heal');
        Math.random = () => 0;
        const use = () => role === 'player' ? useItem(item.uid, true) : allyTryPotion(ally);
        use(); same(getHp(actor), 130, 'Minimum red potion heals 30 after rebirth');
        // Disable only the ally’s automated drink threshold during timing;
        // native alliesTick still decrements its actual cooldown every tick.
        ally._potHpPct = 0; state.ticks = 0;
        for (let i = 0; i < 9; i++) step();
        same(role === 'player' ? player.cds.pot : ally._potCd, 1, 'Potion remains on cooldown through native tick 9');
        same(item.cnt, 2, 'No automatic potion was consumed during the timing case');
        step();
        same(role === 'player' ? player.cds.pot : ally._potCd, 0, 'Original one-second cooldown ends on native tick 10');
        ally._potHpPct = 95; use();
        same(getHp(actor), 160, 'HP potion can heal again after one native second');
        same(item.cnt, 1, 'Only the two intended uses consume inventory');
        results.push({case:'native HP potion cooldown tick timing', role, ticks:10, firstHeal:30, secondHeal:30});
      }
      unobserve();
      return {cases:results.length, results};
    });
    assert.deepEqual(errors, [], 'The full index and native operations must have no uncaught page errors');
    console.log(JSON.stringify(result, null, 2));
    console.log('Environment/reflection/HP-potion native browser regressions passed.');
  } finally { await close(); }
} finally { await browser.close(); }
