import assert from 'node:assert/strict';
import {testBrowser, createProfile} from './relic-test-browser.mjs';

// Load the complete index and all its real killMob wrappers in an isolated
// browser context. Fixtures are placed at the death boundary so enemy attacks,
// boss entrance damage, healing ticks and level-ups cannot obscure the cost.
// No combat function, kill handler, pet roster or summon implementation is mocked.
const browser = await testBrowser();
try {
  const {page, errors, close} = await browser.page();
  try {
    await page.evaluate(code => { window.__dreamProfile = eval('(' + code + ')'); }, createProfile.toString());
    const result = await page.evaluate(() => {
      const cases = [];
      function require(v, message) { if (!v) throw Error(message); }
      function same(actual, expected, message) {
        require(JSON.stringify(actual) === JSON.stringify(expected), message + '\nactual=' + JSON.stringify(actual) + '\nexpected=' + JSON.stringify(expected));
      }
      function setup(rebirth, dream = true) {
        __dreamProfile({cls:'knight', lv:100, rebirth, seed:98765 + rebirth});
        player.sherineMad = dream;
        player.sherineDream = dream;
        player.enSeed = 'dreamcost-native-test-' + rebirth;
        // An ordinary empty-equipment party has no on-kill healing effects.
        const ally = JSON.parse(JSON.stringify(player));
        ally._allyName = '夢艷回歸傭兵';
        ally._slot = 2;
        ally.allies = [];
        ally.curHp = Math.max(20, Math.floor(ally.mhp * .47));
        ally.mp = Math.max(20, Math.floor(ally.mmp * .41));
        player.allies = [ally];
        const form = Object.keys(PET_BOOK).find(key => (PET_BOOK[key].mp0 || 0) > 0);
        require(!!form, 'A native pet with MP is available');
        const pet = petNewInstance(form, 40);
        const roster = petRoster();
        roster.splice(0, roster.length, pet);
        pet.outOwner = _petCurrentOwnerKey();
        pet.outSlot = String(currentSlot);
        pet.hp = Math.max(20, Math.floor(pet.mhp * .59));
        pet.mp = Math.max(1, Math.floor(pet.mmp * .51));
        require(petsOutList().length === 1 && petsOutList()[0] === pet, 'The native pet is deployed');
        require(summonV2CastFor('sk_zombie', true), 'Native summon creation succeeds');
        require(player.summonsV2.length === 1, 'The native summon is present');
        const summon = player.summonsV2[0];
        summon.hp = Math.floor(summon.mhp * .63);
        player.hp = Math.max(20, Math.floor(player.mhp * .61));
        player.mp = Math.max(20, Math.floor(player.mmp * .53));
        require(player.hp < player.mhp && ally.curHp < ally.mhp && pet.hp < pet.mhp && summon.hp < summon.mhp, 'All HP fixtures are below maximum');
        require(player.mp < player.mmp && ally.mp < ally.mmp, 'Player and mercenary MP fixtures are below maximum');
        require(__afkDreamHell.on() === dream, 'The real dream-mode flag matches the case');
        return {ally, pet, summon};
      }
      function snapshot(team) {
        return {
          playerHp:player.hp, playerMp:player.mp,
          allyHp:team.ally.curHp, allyMp:team.ally.mp,
          petHp:team.pet.hp, petMp:team.pet.mp,
          summonHp:team.summon.hp
        };
      }
      function deadMob(boss = false, race = '人類') {
        const m = {
          n:boss ? '夢艷回歸首領' : '夢艷回歸一般怪', uid:uid(), lv:1,
          hp:120, curHp:0, ac:10, mr:0, e:'none', dr:0, exp:0,
          noGold:true, drop:[], boss, race, _born:++_mobBornSeq,
          _bornMs:Date.now(), _magCd:{}, justHit:false, st:newMobStatus(),
          _sherine:!!player.sherineMad, _sherineMad:!!player.sherineMad,
          _dream:!!player.sherineDream
        };
        mapState.mobs = [m, null, null, null, null];
        return m;
      }
      function expectedBoss(before) {
        const expected = {...before};
        for (const key of ['playerHp', 'allyHp', 'petHp', 'summonHp', 'playerMp', 'allyMp']) expected[key] -= Math.floor(expected[key] * .1);
        return expected;
      }

      for (const rebirth of [0, 1]) {
        const team = setup(rebirth);
        // 玩家 2026-10-24：一般怪死亡 → 你與傭兵各扣最大 HP 1%（寵物、召喚物、MP 不變）
        const before = snapshot(team), auditBefore = _audit.kills;
        let expect = {...before};
        for (let i = 0; i < 30; i++) {
          const m = deadMob();
          killMob(0);
          require(m._dead === true, 'Native normal kill settles: rebirth=' + rebirth + ', kill=' + (i + 1));
          expect.playerHp -= Math.max(1, Math.floor(player.mhp * .01)); expect.allyHp -= Math.max(1, Math.floor(team.ally.mhp * .01));
          same(snapshot(team), expect, 'Normal kill costs 1% max HP ' + (i + 1) + ', rebirth=' + rebirth);
        }
        require(_audit.kills - auditBefore === 30, 'All 30 kills reach native reward/audit settlement');
        cases.push({case:'30 normal kills', rebirth, count:30, before, after:snapshot(team)});

        for (let i = 0; i < 2; i++) {
          const bossBefore = snapshot(team), boss = deadMob(true);
          killMob(0);
          require(boss._dead === true, 'The native boss kill settles');
          const after = snapshot(team);
          same(after, expectedBoss(bossBefore), 'Boss ' + (i + 1) + ' takes floor(current HP/MP ×10%), rebirth=' + rebirth);
          // Even if a caller retains and re-submits the dead object, the real
          // _dead guard must prevent a second death curse and reward settlement.
          mapState.mobs[0] = boss;
          const auditAfter = _audit.kills;
          killMob(0);
          same(snapshot(team), after, 'Duplicate boss settlement does not charge the team again');
          require(_audit.kills === auditAfter, 'Duplicate boss settlement does not award twice');
          cases.push({case:'boss current-value cost', rebirth, boss:i + 1, before:bossBefore, after});
        }
      }

      let team = setup(1, false), before = snapshot(team);
      const normalBoss = deadMob(true);
      killMob(0);
      require(normalBoss._dead === true, 'Non-dream boss still reaches native settlement');
      same(snapshot(team), before, 'Boss death outside dream mode has no dream cost');
      cases.push({case:'non-dream boss', before, after:snapshot(team)});

      team = setup(1);
      before = snapshot(team);
      const building = deadMob(true, '建築');
      killMob(0);
      require(building._dead === true, 'Building reaches native settlement');
      same(snapshot(team), before, 'Buildings remain excluded from the death curse');
      cases.push({case:'building exclusion', before, after:snapshot(team)});
      return {normalKills:200, bosses:4, cases};
    });
    assert.deepEqual(errors, [], 'The complete index must load and execute without uncaught page errors');
    console.log(JSON.stringify(result, null, 2));
    console.log('Dreamcost native browser regression passed: 60 normal kills (1% max HP each), four boss costs, duplicate settlement, mode and building guards.');
  } finally { await close(); }
} finally { await browser.close(); }
