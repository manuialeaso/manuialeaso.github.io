/** Precise, idempotent hooks for the complete relic runtime. No copied engine. */
import { readFileSync, writeFileSync } from 'node:fs';

export function applyRelicRuntimePatches(check = false) {
  const files = new Map(); let edits = 0;
  function source(file) { if (!files.has(file)) files.set(file, readFileSync(file, 'utf8')); return files.get(file); }
  function edit(file, id, anchor, replacement, expected = 1) {
    let s = source(file), mark = `/* relic-runtime:${id} */`;
    if (s.includes(mark)) return;
    const n = s.split(anchor).length - 1;
    if (n !== expected) throw new Error(`${file}: ${id}: expected ${expected} anchors, found ${n}`);
    s = s.split(anchor).join(replacement + ' ' + mark); files.set(file, s); edits++;
  }
  function inside(file, fn, id, anchor, replacement, expected = 1) {
    let s = source(file), mark = `/* relic-runtime:${id} */`; if (s.includes(mark)) return;
    const start = s.indexOf('function ' + fn + '('); if (start < 0) throw new Error(`${file}: missing ${fn}`);
    let end = s.indexOf('\nfunction ', start + 1); if (end < 0) end = s.length;
    let body = s.slice(start, end), n = body.split(anchor).length - 1;
    if (n !== expected) throw new Error(`${file}:${fn}: ${id}: expected ${expected} anchors, found ${n}`);
    body = body.split(anchor).join(replacement + ' ' + mark); files.set(file, s.slice(0, start) + body + s.slice(end)); edits++;
  }
  const C = 'window.AFK_RELIC_RUNTIME';
  edit('js/22-pets.js','ttmi-pet-exp','p.exp = (p.exp || 0) + each;','p.exp = (p.exp || 0) + Math.floor(each * (typeof window.__afkTtmiPetExpMult === \'function\' ? window.__afkTtmiPetExpMult(p) : 1));');
  edit('js/03-combat-core.js','relic-attack-slow','m._atkCd = Math.max(1, Math.floor(m.atkSpd * 10)) + slowAdd;',`m._atkCd = Math.max(1, Math.floor(m.atkSpd * 10)) + slowAdd; if(${C}) m._atkCd=Math.ceil(m._atkCd/(1-Math.min(.9,${C}.statusValue(m,'attackSlow'))));`);
  for(const [file,t] of [['js/04-combat-attack.js','target'],['js/06-status-allies.js','t']]) edit(file,'defer-native-wet','if (wpn && wpn.onHitWet && '+t+'.curHp > 0)','if (!(window.AFK_RELIC_RUNTIME && window.AFK_RELIC_RUNTIME.enabled()) && wpn && wpn.onHitWet && '+t+'.curHp > 0)');
  edit('js/03-combat-core.js','runtime-tick','    state.ticks++;',`    state.ticks++;\n    if (${C}) ${C}.tick();`);
  edit('js/04-combat-attack.js','main-result-context','window.__afkRelicDmg(player, target, result.dmg, wpn);','window.__afkRelicDmg(player, target, result.dmg, wpn, result);');
  edit('js/06-status-allies.js','ally-result-context','window.__afkRelicDmg(ally, t, dmg, wpn);','window.__afkRelicDmg(ally, t, dmg, wpn, {crit:isCrit,heavy:heavy,graze:_grazeA,ranged:isRanged,relicFlags:window.AFK_RELIC_WEAPON_BRIDGE?window.AFK_RELIC_WEAPON_BRIDGE.allyResultFlags(ally,t,wpn):{}});');
  edit('js/06-status-allies.js','ally-double-blade-context','{crit:isCrit,heavy:heavy,graze:_grazeA,ranged:isRanged,relicFlags:','{crit:isCrit,heavy:heavy,graze:_grazeA,ranged:isRanged,doubleBlade:_dualX2A,relicFlags:');
  // Resolve reflection/death before on-hit healing and generated follow-ups.
  edit('js/04-combat-attack.js','defer-main-hit','        if (window.__afkRelicHit) window.__afkRelicHit(player, target, result.dmg, wpn);','        /* on-hit effects follow reflection below */');
  edit('js/04-combat-attack.js','main-hit-after-reflect',"        if (target.curHp > 0 && player._setIron5",`        if (window.__afkRelicHit) window.__afkRelicHit(player,target,result.dmg,wpn);\n        if (target.curHp > 0 && player._setIron5`);
  edit('js/06-status-allies.js','defer-ally-hit','if (window.__afkRelicHit) window.__afkRelicHit(ally, t, dmg, wpn);','/* on-hit effects follow reflection */');
  inside('js/06-status-allies.js','allyAttackOnce','ally-hit-after-reflect',"        if (t.curHp > 0 && wpn && wpn.hitEchoMagic",`        if (window.__afkRelicHit) window.__afkRelicHit(ally,t,dmg,wpn);\n        if (t.curHp > 0 && wpn && wpn.hitEchoMagic`);
  inside('js/04-combat-attack.js','reflectWallOnDamage','reflect-player', '        player.hp -= dmg;',
    `        if (${C}) dmg=${C}.incoming(player,dmg,mob,{kind:kind,origin:'reflection',main:false,direct:true});\n        player.hp -= dmg;\n        if (${C}) ${C}.afterIncoming(player,dmg,mob);`);
  inside('js/04-combat-attack.js','reflectWallOnDamage','reflect-ally','        ally.curHp -= dmg;',
    `        if (${C}) dmg=${C}.incoming(ally,dmg,mob,{kind:kind,origin:'reflection',main:false,direct:true});\n        ally.curHp -= dmg;\n        if (${C}) ${C}.afterIncoming(ally,dmg,mob);`);
  edit('js/07-skills-cast.js','cast-cost','    if(player.mp < cost) return false;',`    if (${C}) cost=${C}.castCost(player,sk,skId,cost);\n    if(player.mp < cost) return false;`);
  edit('js/07-skills-cast.js','cast-blood-gate','    if(sk.hpCost && player.hp <= sk.hpCost + 5)',`    if (${C} && ${C}.action() && ${C}.action().costContext) { let cc=${C}.action().costContext; if (cc.hpCost && player.hp<=cc.hpCost+(sk.hpCost||0)) return false; }\n    if(sk.hpCost && player.hp <= sk.hpCost + 5)`);
  inside('js/07-skills-cast.js','castSkillInner','cast-paid','player.mp -= cost;',`if (${C}) ${C}.castPaid(player,cost); player.mp -= cost;`,15);
  edit('js/06-status-allies.js','burst-poison-budget',"            m.curHp -= _udc.dmg;",`            if (${C}) _udc.dmg=${C}.dotCap(m,_udc.dmg);\n            m.curHp -= _udc.dmg;`);
  // Potions retain their own clocks; only relic-triggered follow-up healing is gated.
  for(const [file,actor,before,after,def] of [
    ['js/08-items-equip.js','player','            if (player.statuses && player.statuses.potionFrost > 0)','            player.hp = Math.min(player.mhp, player.hp + h);','d'],
    ['js/06-status-allies.js','ally','    if (ally.statuses && ally.statuses.potionFrost > 0)','    ally.curHp = Math.min(mhp, cur + h);','pdef'],
    ['js/22-pets.js','p','    if (p._statuses && p._statuses.potionFrost > 0)','    p.hp = Math.min(petMhpEff(p), p.hp + h);','pdef']
  ]){
    edit(file,'potion-before-'+actor,before,`    if (${C}) h=${C}.foreignHeal(${actor},h,'potion',{item:${def}});\n${before.replace(' > 0)',` > 0 && !(${C} && ${C}.ignorePotionReduction(${actor})))`)}`);
    const foul=actor==='p'?'    if (p._statuses && p._statuses.foulWater > 0)':actor==='ally'?'    if (ally.statuses && ally.statuses.foulWater > 0)':'            if (player.statuses && player.statuses.foulWater > 0)';
    edit(file,'potion-foul-'+actor,foul,foul.replace(' > 0)',` > 0 && !(${C} && ${C}.ignorePotionReduction(${actor})))`));
    if(actor==='player') edit(file,'potion-after-'+actor,after+"\n            player.cds.pot = 1;\n            if(!silent)",after+`\n    if (${C}) ${C}.foreignHealDone(${actor},h,'onPotion');\n            player.cds.pot = 1;\n            if(!silent)`);
    else edit(file,'potion-after-'+actor,after,after+`\n    if (${C}) ${C}.foreignHealDone(${actor},h,'onPotion');`);
  }
  inside('js/04-combat-attack.js','procFreeMagicSkill','proc-heal-source','player.hp += _h;',`if(${C}) _h=${C}.procHeal(player,_h);else player.hp+=_h;`);
  inside('js/04-combat-attack.js','_procWeaponSpellHit','proc-spell-heal-source','player.hp = Math.min(player.mhp, player.hp + Math.floor(d * sp.heal));',`if(${C}) ${C}.procHeal(player,Math.floor(d*sp.heal));else player.hp=Math.min(player.mhp,player.hp+Math.floor(d*sp.heal));`);
  // Set eligibility and stat projection are independent of physical equipment weight.
  edit('js/02-stats-recompute.js','gm-earring-sets','let _eqHas = id => Object.values(p.eq).some(e => e && e.id === id);',"let _eqHas = id => window.AFK_RELIC_GM ? window.AFK_RELIC_GM.hasMember(p,id) : Object.values(p.eq).some(e => e && e.id === id);");
  edit('js/02-stats-recompute.js','gm-sherine',"    let _shN = (g) => (_shSets[g] || 0);","    if(window.AFK_RELIC_GM) window.AFK_RELIC_GM.sherine(p,_shSets);\n    let _shN = (g) => (_shSets[g] || 0);");
  edit('js/02-stats-recompute.js','gm-form',"    let _polyForm = p._setPoly", "    if(window.AFK_RELIC_GM) window.AFK_RELIC_GM.mergeForms(p);\n    let _polyForm = p._setPoly");
  edit('js/05-kill-progression.js','ttmi-player-exp','_playerExpGain = Math.floor(_petExpGain * getExpGainMult(player.lv))',"_playerExpGain = Math.floor(_petExpGain * getExpGainMult(player.lv) * (typeof window.__afkTtmiExpMult === 'function' ? window.__afkTtmiExpMult(player) : 1))");
  // At this point HP is still intact: mitigation, shields and death prevention
  // all finish before the native engine performs damage/death/drop settlement.
  inside('js/04-combat-attack.js','_enemyPhysicalAttackInner','hurt-player-physical',
    '        player.hp -= totalDmg;',
    `        if (${C}) totalDmg = ${C}.incoming(player,totalDmg,mob,{kind:'melee',element:mob.e||'none',heavy:heavy,blocked:blocked});\n        player.hp -= totalDmg;\n        if (${C}) ${C}.afterIncoming(player,totalDmg,mob);`);
  inside('js/04-combat-attack.js','_enemyAttackAllyInner','hurt-ally-physical',
    '    ally.curHp -= totalDmg;',
    `    if (${C}) totalDmg = ${C}.incoming(ally,totalDmg,mob,{kind:'melee',element:mob.e||'none',heavy:typeof heavy!=='undefined'&&heavy});\n    ally.curHp -= totalDmg;\n    if (${C}) ${C}.afterIncoming(ally,totalDmg,mob);`);
  inside('js/04-combat-attack.js','_applyMobMagicInner','hurt-player-magic',
    '        player.hp -= dmg;',
    `        if (${C}) dmg = ${C}.incoming(player,dmg,mob,{kind:'magic',element:sk.ele||'none',skill:sk,single:sk.target!=='all'});\n        player.hp -= dmg;\n        if (${C}) ${C}.afterIncoming(player,dmg,mob);`);
  inside('js/04-combat-attack.js','_applyMobMagicToAllyInner','hurt-ally-magic',
    '        ally.curHp -= dmg;',
    `        if (${C}) dmg = ${C}.incoming(ally,dmg,mob,{kind:'magic',element:sk.ele||'none',skill:sk,single:sk.target!=='all'});\n        ally.curHp -= dmg;\n        if (${C}) ${C}.afterIncoming(ally,dmg,mob);`);
  // Native status damage remains an ordinary source. Relic-created DoT uses
  // separate per-source ledgers and shares only the ordinary one-percent budget.
  for (const [kind, field] of [['burn','burnDmg'],['scald','scaldDmg'],['bleed','bleedDmg']]) {
    edit('js/03-combat-core.js','hurt-player-dot-' + kind,
      `        player.hp -= player.statuses.${field};`,
      `        { let rd=player.statuses.${field}; if (${C}) rd=${C}.incoming(player,rd,null,{kind:'dot',dotKind:'${kind}',direct:false}); player.hp-=rd; if (${C}) ${C}.afterIncoming(player,rd,null); }`);
  }
  edit('js/03-combat-core.js','hurt-player-poison', '            player.hp -= _pdmg;',
    `            { let rd=_pdmg; if (${C}) rd=${C}.incoming(player,rd,null,{kind:'dot',dotKind:'poison',direct:false}); player.hp-=rd; if (${C}) ${C}.afterIncoming(player,rd,null); }`);
  // Correct actor is explicit: a reborn leader does not silently change the
  // potion multiplier of a mercenary whose own character has not reincarnated.
  edit('js/08-items-equip.js','potion-owner-player','potionHealBase(d) *','potionHealBase(d, player) *');
  edit('js/06-status-allies.js','potion-owner-ally','potionHealBase(pdef) *','potionHealBase(pdef, ally) *');
  edit('js/22-pets.js','potion-owner-pet','potionHealBase(pdef) *','potionHealBase(pdef, player) *');
  // Stat augmentation before HP multipliers and speed calculation.
  edit('js/02-stats-recompute.js','ttmi-stats', '    if(p.buffs.sk_soul_up > 0)',
    "    if (typeof window.__afkTtmiStats === 'function') window.__afkTtmiStats(p,d);\n    if(p.buffs.sk_soul_up > 0)");
  edit('js/02-stats-recompute.js','relic-stats-final', '    p.hp = Math.min(p.hp, p.mhp);',
    `    if (${C}) ${C}.stats(p,d);\n    p.hp = Math.min(p.hp, p.mhp);`);
  // GM set eligibility must run in the early stat pass as well as the normal
  // final set pass, otherwise STR/CON changes never reach derived combat values.
  edit('js/02-stats-recompute.js','gm-early-sets', "      if (_setEarly['icequeen_charm'] >= 3)",
    "      if (typeof window.__afkGmSetCount === 'function') window.__afkGmSetCount(p,_setEarly);\n      if (_setEarly['icequeen_charm'] >= 3)");
  // Skip native bleed when an explicit per-relic per-source ledger owns it.
  // Every occurrence remains tied to its actual weapon definition.
  for (const file of ['js/04-combat-attack.js','js/06-status-allies.js']) {
    let s = source(file), mark = '/* relic-runtime:owned-bleed */';
    if (!s.includes(mark)) {
      let n = 0;
      s = s.replace(/weaponHasBleed\(([^\n;]*?)\)/g, (full, arg) => { n++; return `(${C} && ${C}.ownsBleed(${arg}) ? false : ${full})`; });
      if (!n) throw new Error(file + ': no weaponHasBleed anchors');
      files.set(file, s + '\n' + mark + '\n'); edits++;
    }
  }
  // Spell damage modifiers are applied before subtraction, not by multiplying
  // the HP delta after a kill. This preserves kill credit and final damage logs.
  const spellFunctions = [
    ['js/07-skills-cast.js','castSkillInner','player','sk',"{skillId:skId}"],
    ['js/04-combat-attack.js','procFreeMagicSkill','player','sk',"{skillId:skId,origin:'proc'}"],
    ['js/04-combat-attack.js','_procWeaponSpellHit','player','sp',"{origin:'proc'}"],
    ['js/03-combat-core.js','qiguPlayerAttack','player',"{ele:wpn.ele||'none'}","{main:true,origin:'normal'}"]
  ];
  for (const [file, fn, actor, skill, extra] of spellFunctions) {
    let s = source(file), mark = `/* relic-runtime:spell-${fn} */`; if (s.includes(mark)) continue;
    let start = s.indexOf('function ' + fn + '('), end = s.indexOf('\nfunction ', start + 1); if (start < 0) throw new Error('missing ' + fn); if (end < 0) end = s.length;
    let body = s.slice(start, end), n = 0;
    body = body.replace(/([A-Za-z_]\w*)\.curHp -= ([A-Za-z_]\w*(?:\.dmg)?);/g, (full, target, value) => { n++; return `if (${C}) ${value}=${C}.spellDamage(${actor},${target},${value},${skill},${extra}); ${full}`; });
    if (!n) throw new Error(fn + ': no damage mutation anchors');
    files.set(file, s.slice(0,start) + body + '\n' + mark + '\n' + s.slice(end)); edits++;
  }
  // Companion damage uses the same pre-damage event path as equipment effects.
  for (const [file, fn, actor, target, value, companionKind] of [
    ['js/23-summons.js','summonV2AttackOnce','owner','t','dmg','summon'],
    ['js/23-summons.js','spiritAttackOnce','owner','t','dmg','summon']
  ]) {
    inside(file,fn,'companion-'+fn, `${target}.curHp -= ${value};`,
      `if (${C}) ${value}=${C}.companionDamage(${actor}||player,s,${target},${value},{kind:'${companionKind}'}); ${target}.curHp -= ${value};`);
  }
  if (check && edits) throw new Error(`relic runtime has ${edits} unapplied patch groups`);
  if (!check) for (const [file, text] of files) if (text !== readFileSync(file,'utf8')) writeFileSync(file,text);
  console.log(`Relic runtime hooks: ${edits ? 'applied '+edits+' groups' : 'all present'}`);
}
