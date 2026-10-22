/** Native companion hooks. Each anchor is scoped to one named engine function;
 * regeneration and ordinary potion/scroll timing stay in their original paths. */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export function applyRelicCompanionPatches(check=false){
 const files=new Map();let edits=0;
 function source(file){if(!files.has(file))files.set(file,readFileSync(file,'utf8'));return files.get(file);}
 function inside(file,fn,id,anchor,replacement,expected=1){
  let s=source(file),mark=`/* relic-companion:${id} */`;if(s.includes(mark))return;
  const start=s.indexOf(`function ${fn}(`);if(start<0)throw Error(`${file}: missing function ${fn}`);
  let end=s.indexOf('\nfunction ',start+1);if(end<0)end=s.length;
  let body=s.slice(start,end),count=body.split(anchor).length-1;
  if(count!==expected)throw Error(`${file}:${fn}: ${id}: expected ${expected} anchors, found ${count}`);
  body=body.split(anchor).join(replacement+' '+mark);files.set(file,s.slice(0,start)+body+s.slice(end));edits++;
 }
 const C='window.AFK_RELIC_COMPANIONS',R='window.AFK_RELIC_RUNTIME';
 inside('js/22-pets.js','petCastSkill','pet-affordable','p.mp >= s.mp',`p.mp >= (${C}?${C}.petSkillCost(p,s.mp):s.mp)`);
 inside('js/22-pets.js','petCastSkill','pet-pay','p.mp -= sk.mp;',`p.mp -= ${C}?${C}.petSkillCost(p,sk.mp):sk.mp;`);
 inside('js/22-pets.js','petsTick','pet-next-wait','p._castCd = d.castItv;',`p._castCd = ${C}?${C}.nextPetSkillWait(p,d.castItv):d.castItv;`);
 inside('js/22-pets.js','petAttackOnce','pet-hit','target.curHp -= dmg;',`if (${R}) dmg=${R}.companionDamage(player,p,target,dmg,{kind:'pet',skillId:skName||null,element:'none'}); target.curHp -= dmg;`);
 inside('js/22-pets.js','petCastSkill','pet-magic','m.curHp -= dmg;',`if (${R}) dmg=${R}.companionDamage(player,p,m,dmg,{kind:'pet',skillId:sk.n,element:sk.ele||'none'}); m.curHp -= dmg;`);
 inside('js/23-summons.js','spiritAttackOnce','spirit-mutable','const dmg = summonElementDamage(', 'let dmg = summonElementDamage(');
 inside('js/23-summons.js','summonV2AttackOnce','summon-proc','m.curHp -= pd;',`if (${R}) pd=${R}.companionDamage(owner||player,s,m,pd,{kind:'summon',skillId:pr.name,element:pr.ele||'none',main:false}); m.curHp -= pd;`);
 inside('js/23-summons.js','spiritAttackOnce','spirit-proc-mutable','const pd = summonElementDamage(', 'let pd = summonElementDamage(');
 inside('js/23-summons.js','spiritAttackOnce','spirit-proc','m.curHp -= pd;',`if (${R}) pd=${R}.companionDamage(owner||player,s,m,pd,{kind:'summon',skillId:spellN,element:s.ele||'none',main:false}); m.curHp -= pd;`);
 for(const [file,fn,entity,kind,extra] of [
  ['js/22-pets.js','enemyAttackPet','p','melee',",heavy:heavy"],
  ['js/22-pets.js','applyMobMagicToPet','p','magic',",element:sk.ele||'none',skill:sk"],
  ['js/23-summons.js','enemyAttackSummon','s','melee',",heavy:heavy"],
  ['js/23-summons.js','applyMobMagicToSummon','s','magic',",element:sk.ele||'none',skill:sk"]
 ])inside(file,fn,fn+'-incoming',`${entity}.hp -= dmg;`,`if (${C}) dmg=${C}.incoming(${entity},dmg,mob,{kind:'${kind}'${extra}}); ${entity}.hp -= dmg; if (${C}) ${C}.afterIncoming(${entity},dmg,mob);`);
 // DOT also honours an already-triggered companion guard; it does not trigger
 // pet melee thorns, ordinary attack procs, or source healing repeatedly.
 inside('js/22-pets.js','_petStatusTick','pet-dot',"p.hp -= Math.max(1, st[x[1]] || 1);",`{ let rd=Math.max(1,st[x[1]]||1); if (${C}) rd=${C}.incoming(p,rd,null,{kind:'dot',dotKind:x[0],direct:false}); p.hp-=rd; if (${C}) ${C}.afterIncoming(p,rd,null); }`);
 for(const [fn,count] of [['_petEnforceCarry',3],['petDeployToggle',2],['renderPetStorageNPC',2]]){
  inside('js/22-pets.js',fn,'slots-'+fn,'PET_CARRY_MAX',`(${C}?${C}.petSlots(PET_CARRY_MAX):PET_CARRY_MAX)`,count);
 }
 inside('js/03-combat-core.js','spawnMob','tracking-rate','if (Math.random() < _trkRate)',`if (Math.random() < (${C}?${C}.trackingChance(_trkRate):_trkRate))`);
 inside('js/03-combat-core.js','spawnMob','tracking-identity','{ ...base, curHp: base.hp, uid: uid(),', '{ ...base, mobId: mobId, curHp: base.hp, uid: uid(),');
 inside('js/03-combat-core.js','_regenHP','regen-hp','if (totalHpRegen > 0)',`if (${C}) totalHpRegen=${C}.regenAmount(player,totalHpRegen,'hp');\n        if (totalHpRegen > 0)`);
 inside('js/03-combat-core.js','_regenMP','regen-mp','if (totalMpRegen > 0)',`if (${C}) totalMpRegen=${C}.regenAmount(player,totalMpRegen,'mp');\n        if (totalMpRegen > 0)`);
 inside('js/06-status-allies.js','alliesTick','ally-regen-hp','if (_hr > 0) ally.curHp',`if (${C}) _hr=${C}.regenAmount(ally,_hr,'hp');\n            if (_hr > 0) ally.curHp`);
 inside('js/06-status-allies.js','alliesTick','ally-regen-mp',"ally.mp = Math.min(ally.mmp, (ally.mp||0) + ((ally.d && ally.d.mpR) || 0));",`ally.mp = Math.min(ally.mmp,(ally.mp||0)+(${C}?${C}.regenAmount(ally,(ally.d&&ally.d.mpR)||0,'mp'):((ally.d&&ally.d.mpR)||0)));`);
 inside('js/02-stats-recompute.js','recomputeStats','weight-values','d.weightPct = _pct; d.loadTier = _tier;', 'd.weightPct = _pct; d.loadTier = _tier; d.equippedWeight = _cur; d.weightCapacity = _limit;');
 inside('js/02-stats-recompute.js','recomputeStats','weight-real-equipment','let _it = p.eq && p.eq[_k];', 'let _eq = window.AFK_RELIC_GM ? window.AFK_RELIC_GM.realEquipment(p) : p.eq; let _it = _eq && _eq[_k];');
 inside('js/02-stats-recompute.js','recomputeStats','weight-canonical','_cur += (ITEM_WEIGHTS[_ed.n] || 0);', `_cur += ${C}?${C}.itemWeight(_ed):(ITEM_WEIGHTS[_ed.n]||0);`);
 inside('js/02-stats-recompute.js','recomputeStats','weight-source-capacity',"if (p.buffs && p.buffs.sk_load_up > 0) _cap += 50;", `if (${C}) _cap=${C}.equipmentCapacity(p,_cap);\n        if (p.buffs && p.buffs.sk_load_up > 0) _cap += 50;`);
 if(check&&edits)throw Error(`relic companions have ${edits} unapplied hook groups`);
 if(!check)for(const [file,text] of files)if(text!==readFileSync(file,'utf8'))writeFileSync(file,text);
 console.log(`Relic companion hooks: ${edits?'applied '+edits+' groups':'all present'}`);
 return edits;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))applyRelicCompanionPatches(process.argv.includes('--check'));
