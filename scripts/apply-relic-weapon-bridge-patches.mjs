/** Native seams for weapon relics. All patches are exact, idempotent and loud. */
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function applyRelicWeaponBridgePatches(check = false) {
  const files = new Map(); let edits = 0;
  const B = 'window.AFK_RELIC_WEAPON_BRIDGE';
  function source(file) { if (!files.has(file)) files.set(file, readFileSync(file, 'utf8')); return files.get(file); }
  function edit(file, id, anchor, replacement, expected = 1, fn = null) {
    const mark = `/* relic-weapon-bridge:${id} */`; let s = source(file);
    if (s.includes(mark)) return;
    let start = 0, end = s.length;
    if (fn) { start = s.indexOf('function ' + fn + '('); if (start < 0) throw new Error(`${file}: missing ${fn}`); end = s.indexOf('\nfunction ', start + 1); if (end < 0) end = s.length; }
    let body = s.slice(start,end), count = body.split(anchor).length - 1;
    if (count !== expected) throw new Error(`${file}:${fn || 'file'}:${id}: expected ${expected} anchors, found ${count}`);
    body = body.split(anchor).join(replacement + ' ' + mark);
    files.set(file,s.slice(0,start) + body + s.slice(end)); edits++;
  }
  const C = 'js/03-combat-core.js', A = 'js/04-combat-attack.js', S = 'js/07-skills-cast.js';
  edit(C,'heavy-rolls','    let rollHit = roll(1, 20);',`    let rollHit = roll(1, 20); if (${B}) rollHit=${B}.hitRoll(rollHit,wpn);`,1,'getPhysicalDmg');
  edit(C,'graze-heavy','    if (graze) isCrit = false;',`    if (${B}) heavy=heavy||${B}.grazeHeavy(graze,wpn);\n    if (graze) isCrit = false;`,1,'getPhysicalDmg');
  edit(C,'heavy-weapon-roll','    let weaponRoll = (heavy || _flameSoulMax) ? diceStr : roll(1, diceStr);',
    `    let weaponRoll = (heavy || _flameSoulMax) ? diceStr : roll(1, diceStr); if (${B}) weaponRoll=${B}.weaponRoll(weaponRoll,heavy,wpn);`,1,'getPhysicalDmg');
  const dr = '((target.dr || 0) + (_ignHard ? 0 : mobHardSkin(target)) + ((target._siegeDrEnd > state.ticks) ? (target._siegeDrVal || 0) : 0))';
  edit(C,'true-flat-reduction',dr,`(${B} ? ${B}.flatReduction(target,wpn,${dr}) : ${dr})`,1,'getPhysicalDmg');
  edit(C,'dynamic-element','    let _wAff = getAttrAffix(_attrInst && _attrInst.attr);',
    `    let _wAff = getAttrAffix(_attrInst && _attrInst.attr); if (${B}) _wAff=${B}.affix(_wAff);`,1,'getPhysicalDmg');
  edit(C,'counter-element','      _outDmg = Math.max(1, Math.floor(_outDmg * _ecm)); }',
    `      if (${B}) _ecm=${B}.counterElementMult(wpn,target,_ecm); _outDmg = Math.max(1, Math.floor(_outDmg * _ecm)); }`,1,'getPhysicalDmg');
  edit(A,'iai-rate',"(hasMastery('k_counter') || Math.random() < 0.50)",
    `(${B} ? ${B}.counterReady(player,'iai',false) : (hasMastery('k_counter') || Math.random() < 0.50))`,2,'_enemyPhysicalAttackInner');
  edit(A,'counter-rate',"blocked || hasMastery('k_counter') || Math.random() < 0.50",
    `${B} ? ${B}.counterReady(player,'counter',blocked) : (blocked || hasMastery('k_counter') || Math.random() < 0.50)`,1,'_enemyPhysicalAttackInner');
  edit(A,'pierce-target-count',"let _pTargets = hasMastery('k_pierce') ? otherIdx : [otherIdx[Math.floor(Math.random() * otherIdx.length)]];",
    `let _pTargets = ${B} ? ${B}.pierceTargets(otherIdx,wpn,target,result) : (hasMastery('k_pierce') ? otherIdx : [otherIdx[Math.floor(Math.random() * otherIdx.length)]]);`);
  edit(A,'pierce-ratio','                _pTargets.forEach(exIdx => {',
    `                if (${B}) _pierceDmg=${B}.pierceDamage(_pierceDmg,wpn,result);\n                _pTargets.forEach(exIdx => {`);
  edit(A,'pierce-pre-hp','                    exT.curHp -= _pierceDmg;',
    `                    if (${B} && ${B}.enabled()) ${B}.pierceHit(exT,_pierceDmg,wpn,result); else exT.curHp -= _pierceDmg;`);
  edit(A,'bone-burst','        if (wpn && wpn.bonespike && (target._bonespike || 0) > 0 && target.curHp > 0) {',
    `        if (${B} && ${B}.boneBurst(target,result,wpn)) {} else if (wpn && wpn.bonespike && (target._bonespike || 0) > 0 && target.curHp > 0) {`);
  edit(A,'haste-preservation','wpn && wpn.hasteStrike && player.buffs && player.buffs.haste > 0',
    `wpn && wpn.hasteStrike && !(${B} && ${B}.keepHaste(wpn)) && player.buffs && player.buffs.haste > 0`);
  edit(A,'blunt-delay','                target._atkCd += 10;',`                target._atkCd += ${B} ? ${B}.bluntTicks(wpn) : 10;`);
  edit(A,'cleave-duration',"player.statuses.cleave = hasMastery('k_cleave') ? 40 : 20;",
    `player.statuses.cleave = ${B} ? ${B}.cleaveDuration(wpn,hasMastery('k_cleave') ? 40 : 20) : (hasMastery('k_cleave') ? 40 : 20);`);
  edit('js/02-stats-recompute.js','cleave-speed',"spdMult *= ((typeof _afkM === 'function' ? _afkM(p, 'k_cleave') : p.mastery === 'k_cleave') ? (1/1.5) : (1/1.2));",
    `spdMult *= (${B} ? ${B}.cleaveSpeed(_clvW,((typeof _afkM === 'function' ? _afkM(p, 'k_cleave') : p.mastery === 'k_cleave') ? (1/1.5) : (1/1.2))) : ((typeof _afkM === 'function' ? _afkM(p, 'k_cleave') : p.mastery === 'k_cleave') ? (1/1.5) : (1/1.2)));`);
  edit(S,'slaughter-preserve',"let consume = layers > 0 && !hasMastery('k_weakness');",
    `let consume = layers > 0 && !hasMastery('k_weakness') && !(${B} && ${B}.keepExpose(wpn));`);
  edit(S,'slaughter-random-preserve',"if (!hasMastery('k_weakness')) m.weakExpose = 0;",
    `if (!hasMastery('k_weakness') && !(${B} && ${B}.keepExpose(wpn))) m.weakExpose = 0;`,2,'castSkillInner');
  edit(S,'magic-burst',"if (_bw && _bw.eff === 'magicburst' && _burstDmg > 0 && !player.classicMode) {",
    `if (${B} && _bw && ${B}.magicBurst(_bw,_burstDmg,sk,targets)) {} else if (_bw && _bw.eff === 'magicburst' && _burstDmg > 0 && !player.classicMode) {`);
  // The dual-element spell must keep two separate elemental settlements.
  edit(A,'dual-spell','            let _pd = wpn.procDualSkill, _tot = 0;',
    `            if (${B} && ${B}.enabled() && wpn.relicDualSpellMult) { ${B}.dualSpell(_dt,wpn,null,wpn.relicDualSpellMult,false); } else {\n            let _pd = wpn.procDualSkill, _tot = 0;`,1,'weaponSpellProc');
  edit(A,'dual-spell-end',"            if (_dt.curHp <= 0) { if (_di2 !== -1) killMob(_di2); } else if (!state.ff) renderMobs();",
    "            if (_dt.curHp <= 0) { if (_di2 !== -1) killMob(_di2); } else if (!state.ff) renderMobs();\n            }",1,'weaponSpellProc');
  // Resonance and moonburst are native spell functions outside the generic proc.
  for (const [fn,value,skill,extra] of [
    ['procLightArrow','d','sk',"{skillId:'sk_lightarrow',origin:'resonance'}"],
    ['procMoonburst','mbDmg',"{ele:'wind',n:'月光爆裂'}","{origin:'proc'}"]
  ]) {
    edit(C,'spell-'+fn,`    t.curHp -= ${value};`,
      `    if (${B}) ${value}=${B}.nativeSpellHit(t,${value},${skill},${extra});\n    t.curHp -= ${value};\n    if (${B}) ${B}.nativeSpellAfter(t,${value},'magic');\n    if (player.dead) return;`,1,fn);
  }
  const L='js/06-status-allies.js';
  // Mercenary primary attacks have their own native arithmetic. Share flags
  // without changing their actor, masteries, royal multiplier or stat snapshot.
  edit(L,'ally-attack-flags',"        let hitB = (isRanged ? (d.rangedHit||0) : (d.meleeHit||0)) + (d.extraHit||0);",
    `        let _rWeaponFlags=${B}?${B}.allyFlags(ally,t,wpn):{};\n        let hitB = (isRanged ? (d.rangedHit||0) : (d.meleeHit||0)) + (d.extraHit||0); if (${B}) hitB+=${B}.allyHitBonus(ally,wpn,_rWeaponFlags);`,1,'allyAttackOnce');
  edit(L,'ally-forced-hit',"let _evSure = !!ally._darkEvadeSure, _evCrit = !!ally._darkEvadeCrit;",
    'let _evSure = !!ally._darkEvadeSure || !!_rWeaponFlags.forceHit || !!_rWeaponFlags.forceHeavy, _evCrit = !!ally._darkEvadeCrit || !!_rWeaponFlags.forceCritical;',1,'allyAttackOnce');
  edit(L,'ally-heavy-rolls','        let r = roll(1,20);',`        let r = roll(1,20); if (${B}) r=${B}.allyHitRoll(r,wpn,_rWeaponFlags);`,1,'allyAttackOnce');
  edit(L,'ally-heavy-result','        let heavy = (r === 20) || _crushA;',
    `        let heavy = (r === 20) || _crushA || !!_rWeaponFlags.forceHeavy || !!(${B} && ${B}.grazeHeavy(_grazeA,wpn));`,1,'allyAttackOnce');
  const allyRoll='let wpnRoll = (heavy || (!isRanged && ally.buffs && ally.buffs.sk_elf_flamesoul > 0)) ? dice : roll(1, dice);';
  for(const fn of ['allyAttackOnce','allyStrikeRoll']) edit(L,'ally-weapon-roll-'+fn,allyRoll,`${allyRoll} if (${B}) wpnRoll=${B}.weaponRoll(wpnRoll,heavy,wpn);`,1,fn);
  edit(L,'ally-primary-flat','- (t.dr||0) - _hsSub',`- (${B} ? ${B}.allyFlatReduction(ally,t,wpn,(t.dr||0)+_hsSub) : (t.dr||0)+_hsSub)`,1,'allyAttackOnce');
  edit(L,'ally-extra-flat','- (t.dr||0) - mobHardSkin(t)',`- (${B} ? ${B}.allyFlatReduction(ally,t,wpn,(t.dr||0)+(wpn&&wpn.ignHardSkin?0:mobHardSkin(t))) : (t.dr||0)+mobHardSkin(t))`,1,'allyStrikeRoll');
  edit(L,'ally-element',"let _ecmA = elementCounterMult(getWpnEle(ally.eq ? ally.eq.wpn : null, wpn, ally), t.e);",
    "let _ecmA = elementCounterMult(_rWeaponFlags.element || getWpnEle(ally.eq ? ally.eq.wpn : null, wpn, ally), t.e);",1,'allyAttackOnce');
  edit(L,'ally-counter-element','            dmg = Math.max(1, Math.floor(dmg * _ecmA));',
    `            if (${B}) _ecmA=${B}.counterElementMult(wpn,t,_ecmA); dmg = Math.max(1, Math.floor(dmg * _ecmA));`,1,'allyAttackOnce');
  const allyWet='consumeWetMult(t, getWpnEle(ally.eq ? ally.eq.wpn : null, wpn, ally))';
  edit(L,'ally-defer-reaction',allyWet,`(${B} ? ${B}.deferPhysicalMark(ally,t,_rWeaponFlags.element||getWpnEle(ally.eq ? ally.eq.wpn : null,wpn,ally)) : ${allyWet})`,1,'allyAttackOnce');
  const allyHard='        if (wpn && wpn.hardSkinMult && _hsT > 0)';
  edit(L,'ally-double-blade',allyHard,`        if (${B}) dmg=${B}.allyDoubleDamage(dmg,wpn,_dualX2A);\n${allyHard}`,1,'allyAttackOnce');
  edit(L,'ally-miss-events',"allyWeaponProcs(ally, t, { hit: false, dmg: 0 });",
    `if (${B}) ${B}.allyMiss(ally,t,wpn); allyWeaponProcs(ally, t, { hit: false, dmg: 0 });`,2,'allyAttackOnce');
  edit(L,'ally-haste-preserve','wpn && wpn.hasteStrike && ally.buffs && ally.buffs.haste > 0) { ally.buffs.haste = 0;',
    `wpn && wpn.hasteStrike && !(${B} && ${B}.keepHaste(wpn)) && ally.buffs && ally.buffs.haste > 0) { ally.buffs.haste = 0;`,1,'allyAttackOnce');
  edit(L,'ally-blunt-delay','            t._atkCd += 10;',`            t._atkCd += ${B} ? ${B}.bluntTicks(wpn) : 10;`,1,'allyOnHitEffects');
  edit(L,'ally-cleave-duration',"ally._cleaveTicks = allyHasMastery(ally, 'k_cleave') ? 40 : 20;",
    `ally._cleaveTicks = ${B} ? ${B}.cleaveDuration(wpn,allyHasMastery(ally,'k_cleave')?40:20) : (allyHasMastery(ally,'k_cleave')?40:20);`,1,'allyOnHitEffects');
  for(const fn of ['allyAttackIntervalTicks','allyOffhandIntervalTicks'])edit(L,'ally-cleave-speed-'+fn,"if (!ally.classicMode && ally._cleaveTicks > 0 && !allyHasMastery(ally, 'k_cleave')) itv = Math.max(1, itv * (1/1.2));",
    `if (!ally.classicMode && ally._cleaveTicks > 0 && !allyHasMastery(ally,'k_cleave')) itv = Math.max(1, itv * (${B} ? ${B}.cleaveSpeed(ally.eq&&ally.eq.wpn&&DB.items[ally.eq.wpn.id],1/1.2) : 1/1.2));`,1,fn);
  edit(L,'ally-bone-burst','        if (wpn && wpn.bonespike && (t._bonespike || 0) > 0 && t.curHp > 0) {',
    `        if (${B} && ${B}.boneBurst(t,{crit:isCrit,heavy:heavy},wpn,ally)) {} else if (wpn && wpn.bonespike && (t._bonespike || 0) > 0 && t.curHp > 0) {`,1,'allyAttackOnce');
  edit(L,'ally-bone-stack','mt._bonespike = Math.min(10, (mt._bonespike || 0) + 1);',
    `mt._bonespike = ${B} ? ${B}.boneLayers(mt,wpn,1) : Math.min(10,(mt._bonespike||0)+1);`,1,'allyRapidfire');
  edit(A,'early-sure-hit','    let _sureHit = !!player._darkEvadeSure;',`    let _sureHit = !!player._darkEvadeSure || !!(${B} && ${B}.earlySureHit(player,target));`,1,'playerAttack');
  edit(A,'early-miss-event','        wandLightArrowProc(target);',`        if (${B}) ${B}.allyMiss(player,target,player.eq.wpn&&DB.items[player.eq.wpn.id]); wandLightArrowProc(target);`,1,'playerAttack');
  // Relic-only healing exits, retaining native behavior for skills and potions.
  const healing = [
    [A,'playerAttack','wpn','Math.floor(result.dmg * wpn.vampPct)','player.hp = Math.min(player.mhp, player.hp + Math.floor(result.dmg * wpn.vampPct))'],
    [A,'playerAttack','wpn','wpn.procHealFlat.hp','player.hp = Math.min(player.mhp, player.hp + wpn.procHealFlat.hp)'],
    [A,'playerAttack','wpn','wpn.hpOnHit','player.hp = Math.min(player.mhp, player.hp + wpn.hpOnHit)'],
    [A,'playerAttack','wpn','Math.max(1, Math.floor(_thp * _pk.healPct))','player.hp = Math.min(player.mhp, player.hp + Math.max(1, Math.floor(_thp * _pk.healPct)))'],
    [A,'playerAttack','wpn','_ci.healHp','player.hp = Math.min(player.mhp, player.hp + _ci.healHp)'],
    [A,'offhandInstakillProc','def','Math.max(1, Math.floor(_thp * _pk.healPct))','player.hp = Math.min(player.mhp, player.hp + Math.max(1, Math.floor(_thp * _pk.healPct)))'],
    [A,'offhandAfterHit','def','def.procHealFlat.hp','player.hp = Math.min(player.mhp, player.hp + def.procHealFlat.hp)'],
    [C,'qiguPlayerAttack','wpn','Math.max(1, Math.floor(_thp * _pk.healPct))','player.hp = Math.min(player.mhp, player.hp + Math.max(1, Math.floor(_thp * _pk.healPct)))'],
    [C,'dragonExtraAttackProc','wpn','Math.floor(res.dmg * wpn.vampPct)','player.hp = Math.min(player.mhp, player.hp + Math.floor(res.dmg * wpn.vampPct))'],
    [L,'allyAttackOnce','wpn','wpn.hpOnHit','ally.curHp = Math.min(ally.mhp || 1, (ally.curHp || 0) + wpn.hpOnHit)'],
    [L,'allyAttackOnce','wpn','Math.floor(dmg * wpn.vampPct)','ally.curHp = Math.min(ally.mhp || 1, (ally.curHp || 0) + Math.floor(dmg * wpn.vampPct))'],
    [L,'allyAttackOnce','wpn','wpn.procHealFlat.hp','ally.curHp = Math.min(ally.mhp || 1, (ally.curHp || 0) + wpn.procHealFlat.hp)'],
    [L,'allyAttackOnce','wpn','_ci.healHp','ally.curHp = Math.min(ally.mhp || 1, (ally.curHp || 0) + _ci.healHp)'],
    [L,'allyQiguAttack','wpn','Math.max(1, Math.floor(_thp * _pk.healPct))','ally.curHp = Math.min(ally.mhp || 1, (ally.curHp || 0) + Math.max(1, Math.floor(_thp * _pk.healPct)))'],
    [L,'allyOffhandInstakillProc','def','Math.max(1, Math.floor(_thp * _pk.healPct))','ally.curHp = Math.min(ally.mhp || 1, (ally.curHp || 0) + Math.max(1, Math.floor(_thp * _pk.healPct)))'],
    [L,'allyOffhandAfterHit','def','def.procHealFlat.hp','ally.curHp = Math.min(ally.mhp || 1, (ally.curHp || 0) + def.procHealFlat.hp)'],
    [L,'allyOnHitEffects','wpn','Math.max(1, Math.floor(_thpA * _pk.healPct))','ally.curHp = Math.min(ally.mhp || 1, (ally.curHp || 0) + Math.max(1, Math.floor(_thpA * _pk.healPct)))'],
    [L,'allyProcFreeMagicSkill','sourceItem','_h','ally.curHp = Math.min(ally.mhp || 1, (ally.curHp || 0) + _h)']
  ];
  healing.forEach(([f,fn,d,n,anchor],i)=>{const a=f===L?'ally':'player';edit(f,'source-heal-'+i,anchor,`(${B} ? ${B}.procHeal(${a},${n},${d}) : (${anchor}))`,1,fn);});
  edit(A,'source-group-heal','    if (wpn.procHealSkill && attackHit && Math.random() * 100 < (wpn.procHealSkill.rate || 5)) {',
    `    if (${B} && ${B}.healingSpell(player,wpn,attackHit)) {} else if (wpn.procHealSkill && attackHit && Math.random()*100<(wpn.procHealSkill.rate||5)) {`,1,'weaponSpellProc');
  edit(L,'ally-source-group-heal','    if (wpn.procHealSkill && hitInfo && hitInfo.hit && Math.random() * 100 < (wpn.procHealSkill.rate || 5)) {',
    `    if (${B} && ${B}.healingSpell(ally,wpn,hitInfo&&hitInfo.hit)) {} else if (wpn.procHealSkill && hitInfo && hitInfo.hit && Math.random()*100<(wpn.procHealSkill.rate||5)) {`,1,'allyWeaponProcs');
  // MR bypass is applied before multiplication, so a floor at one cannot erase it.
  for(const [f,fn,a,d,id] of [[A,'procFreeMagicSkill','player','sourceItem','skId'],[A,'_procWeaponSpellHit','player','_procWpn',"sp.skId||sp.id"],[L,'allyProcFreeMagicSkill','ally','sourceItem','skId'],[L,'_allyProcWeaponSpellHit','ally','_procWpn',"sp.skId||sp.id"]])
    edit(f,'spell-mr-'+fn,'    let mrFactor = mrMult(effMr);',`    let mrFactor = mrMult(${B} ? ${B}.spellMr(${a},${d},${id},effMr) : effMr);`,1,fn);
  edit(S,'cast-spell-mr',"let mrFactor = (player.eq.wpn && (DB.items[player.eq.wpn.id] || {}).spellIgnoreMr) ? 1 : mrMult(effMr);",
    `let mrFactor = (player.eq.wpn && (DB.items[player.eq.wpn.id]||{}).spellIgnoreMr) ? 1 : mrMult(${B}?${B}.spellMr(player,player.eq.wpn&&DB.items[player.eq.wpn.id],skId,effMr):effMr);`,1,'castSkillInner');
  for(const [f,fn,a,t] of [[C,'qiguPlayerAttack','player','target'],[L,'allyQiguAttack','ally','t']]) {
    edit(f,'qigu-true-mr-'+fn,'    let dmg = Math.max(1, Math.floor(raw * (ignoreMr ? 1 : mrMult(effMr))));',
      `    let dmg = Math.max(1,Math.floor(raw*(ignoreMr?1:mrMult(${B}?${B}.spellMr(${a},wpn,'@qigu',effMr):effMr))));`,1,fn);
    edit(f,'qigu-true-attr-'+fn,`weaponMagicDamageCoef(d, wpn, ${t}, ele)`,
      `(${B}?${B}.qiguCoef(${a},wpn,${t},ele):weaponMagicDamageCoef(d,wpn,${t},ele))`,1,fn);
  }
  // Mercenary counterparts use the same finite generated-strike adapters.
  edit(L,'ally-magicstrike-rate',"wpn.eff === 'magicstrike' && !ally.classicMode && Math.random() < ((d.str||0)/60)",
    `(wpn.eff==='magicstrike'||wpn.relicMagicStrike) && !ally.classicMode && Math.random()<(${B}?${B}.magicStrikeChance(ally,wpn):(d.str||0)/60)`,1,'allyWeaponProcs');
  edit(L,'ally-magic-burst',"if (_bw && _bw.eff === 'magicburst' && _burstDmg > 0 && !ally.classicMode) {",
    `if (${B} && _bw && ${B}.magicBurst(_bw,_burstDmg,sk,targets,ally)) {} else if (_bw && _bw.eff==='magicburst' && _burstDmg>0 && !ally.classicMode) {`,1,'allyCastMagic');
  edit(L,'ally-dual-spell','            let _pd = wpn.procDualSkill, _tot = 0;',
    `            if (${B} && ${B}.enabled() && wpn.relicDualSpellMult) { ${B}.dualSpell(_dt,wpn,null,wpn.relicDualSpellMult,false,ally); } else {\n            let _pd = wpn.procDualSkill, _tot = 0;`,1,'allyWeaponProcs');
  edit(L,'ally-dual-spell-end',"            _allyDamageMob(ally, _dt, _tot, 'fire');", "            _allyDamageMob(ally, _dt, _tot, 'fire');\n            }",1,'allyWeaponProcs');
  edit(L,'ally-pierce-targets','            let _pT = _allyPierce ? others : [others[Math.floor(Math.random() * others.length)]];',
    `            let _pT=${B}?${B}.pierceTargets(others,wpn,t,res,ally):(_allyPierce?others:[others[Math.floor(Math.random()*others.length)]]);`,1,'allyOnHitEffects');
  edit(L,'ally-pierce-ratio','            _pT.forEach(_ix => {',`            if(${B})_pd=${B}.pierceDamage(_pd,wpn,res);\n            _pT.forEach(_ix => {`,1,'allyOnHitEffects');
  edit(L,'ally-pierce-pre-hp','                _allyDamageMob(ally, exT, _pd, getWpnEle(wpnInst, wpn, ally));',
    `                if(${B}&&${B}.enabled())${B}.pierceHit(exT,Math.floor(_pd*royalAllyMult()),wpn,res,ally);else _allyDamageMob(ally,exT,_pd,getWpnEle(wpnInst,wpn,ally));`,1,'allyOnHitEffects');

  for(const [fn,amount,ending] of [['procFreeMagicSkill','total','return;'],['_procWeaponSpellHit','d','return false;']])
    edit(A,'free-spell-reflect-'+fn,'mobWake(t);',`mobWake(t); if(${B})${B}.nativeSpellAfter(t,${amount},'magic'); if(player.dead){${ending}}`,1,fn);
  for(const [f,fn,a,t] of [[C,'qiguPlayerAttack','player','target'],[L,'allyQiguAttack','ally','t']])
    edit(f,'qigu-critical-'+fn,'    let effMr =',`    if(${B})raw*=${B}.qiguCritMult(${a},${t},wpn);\n    let effMr =`,1,fn);
  const elemental=[[A,'playerAttack','player','target','wpn'],[A,'offhandAfterHit','player','target','def'],[L,'allyAttackOnce','ally','t','wpn'],[L,'allyOffhandAfterHit','ally','t','def']];
  elemental.forEach(([f,fn,a,t,d])=>edit(f,'elemental-reflect-'+fn,`${t}.curHp -= _oh.dmg;`,`if(!(${B}&&${B}.elementalDamage(${a},${t},_oh.dmg,_oh.ele,${d})))${t}.curHp-=_oh.dmg;`,1,fn));
  const allySpells=[
    ['allyProcFreeMagicSkill',"_allyDamageMob(ally, t, total, (sk.ele && sk.ele !== 'none') ? sk.ele : 'magic', 'magic');",'total','sk','sourceItem',"{skillId:skId,origin:'proc'}"],
    ['_allyProcWeaponSpellHit',"_allyDamageMob(ally, t, dd, (sp.ele && sp.ele !== 'none') ? sp.ele : 'magic', 'magic');",'dd','sp','_procWpn',"{origin:'proc'}"],
    ['allyProcLightArrow',"_allyDamageMob(ally, t, dmg, 'magic', 'magic');",'dmg','sk','_resoWpn',"{skillId:'sk_lightarrow',origin:'resonance'}"],
    ['allyProcMoonburst',"_allyDamageMob(ally, t, dmg, 'wind', 'magic');",'dmg',"{ele:'wind',n:'月光爆裂'}",'_procWpn',"{origin:'proc'}"]
  ];
  allySpells.forEach(([fn,anchor,amount,sk,d,extra])=>edit(L,'ally-spell-hit-'+fn,anchor,`if(!(${B}&&${B}.allySpellHit(ally,t,${amount},${sk},${d},${extra})))${anchor}`,1,fn));
  for(const [f,fn,a,t] of [[C,'qiguPlayerAttack','player','target'],[L,'allyQiguAttack','ally','t']])
    edit(f,'qigu-forced-roll-'+fn,'magicBaseDamage(roll(1, dice), d, d.extraDmg || 0, true)',`magicBaseDamage(${B}?${B}.qiguRoll(${a},${t},wpn,dice):roll(1,dice),d,d.extraDmg||0,true)`,1,fn);
  edit(A,'ledger-poison-bonus','wpn.poisonedBonusDmg && target.st && target.st.poison > 0',`wpn.poisonedBonusDmg && (${B}?${B}.hasStatus(target,'poison'):target.st&&target.st.poison>0)`,1,'playerAttack');
  edit(L,'ally-ledger-poison-bonus','wpn.poisonedBonusDmg && t.st && t.st.poison > 0',`wpn.poisonedBonusDmg && (${B}?${B}.hasStatus(t,'poison'):t.st&&t.st.poison>0)`,1,'allyAttackOnce');
  if (check && edits) throw new Error(`Weapon relic bridge: ${edits} unapplied patch groups`);
  if (!check) for (const [file,text] of files) if (text !== readFileSync(file,'utf8')) writeFileSync(file,text);
  console.log(`Weapon relic bridge: ${edits ? 'applied '+edits+' groups' : 'all present'}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) applyRelicWeaponBridgePatches(process.argv.includes('--check'));
