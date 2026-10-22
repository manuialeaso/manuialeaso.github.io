/** Final HP-settlement seams for card ascension. Each named native function has
 * an explicit ordered list of its outgoing damage assignments. No calculator,
 * preview, enemy-to-party damage or reflected damage is multiplied here.
 * All changes are buffered; a changed/missing upstream anchor fails loudly. */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function applyCardCombatPatches(check=false){
  const files=new Map();let edits=0,settlements=0;
  const C='window.AFK_CARD_COMBAT';
  function source(file){if(!files.has(file))files.set(file,readFileSync(file,'utf8'));return files.get(file);}
  function mutate(file,fn,id,change){
    const text=source(file),mark=`/* card-combat:${id} */`;if(text.includes(mark))return;
    const start=fn?text.indexOf(`function ${fn}(`):0;if(start<0)throw Error(`${file}: missing function ${fn}`);
    let end=fn?text.indexOf('\nfunction ',start+1):text.length;if(end<0)end=text.length;
    const body=text.slice(start,end),next=change(body,mark);
    if(next===body||!next.includes(mark))throw Error(`${file}:${fn||'module'}: no verified ${id} change`);
    files.set(file,text.slice(0,start)+next+text.slice(end));edits++;
  }
  function inside(file,fn,id,anchor,replacement,expected=1){
    mutate(file,fn,id,(body,mark)=>{const count=body.split(anchor).length-1;if(count!==expected)throw Error(`${file}:${fn||'module'}:${id}: expected ${expected} anchors, found ${count}`);return body.split(anchor).join(replacement+' '+mark);});
  }
  // An entry is target:expression, followed by its exact damage kind and any
  // metadata. Ordinary locals/result packets are mutable; DB definitions and
  // shared AOE scalars are explicitly read-only.
  function hits(file,fn,actor,rows){
    mutate(file,fn,'settle-'+fn,(body,mark)=>{
      let index=0;
      const next=body.replace(/\b(\w+)\.curHp\s*-=\s*([^;\n]+);/g,(whole,target,amount)=>{
        if(fn==='bombFlowerExplode'&&target==='_w')return whole; // native self cost
        const row=rows[index++];if(!row)throw Error(`${file}:${fn}: unexpected ${whole}`);
        const [anchor,kind,extra='',readonly=false]=row;
        if(`${target}:${amount.trim()}`!==anchor)throw Error(`${file}:${fn}: settlement ${index}: expected ${anchor}, found ${target}:${amount}`);
        const who=typeof actor==='function'?actor(index-1):actor;
        const opts=`{kind:${kind}${extra?','+extra:''}}`;
        const value=`(${C}?${C}.damage(${who},${target},${amount},${opts}):${amount})`;
        settlements++;
        return `${target}.curHp -= ${readonly?value:`(${amount}=${value})`};${index===1?' '+mark:''}`;
      });
      if(index!==rows.length)throw Error(`${file}:${fn}: expected ${rows.length} settlements, found ${index}`);
      return next;
    });
  }
  const phys=actor=>`${C}.physicalKind(${actor})`,magic="'magic'",melee="'melee'",ranged="'ranged'",dot="'dot'",fixed="'true'";
  const core='js/03-combat-core.js',attack='js/04-combat-attack.js',allies='js/06-status-allies.js',skills='js/07-skills-cast.js';
  for(const [fn,rows] of [
    ['procLightArrow',[['t:d',magic]]],['procMoonburst',[['t:mbDmg',magic]]],['procMagicStrike',[['t:res.dmg',melee]]],
    ['rapidfireProc',[['_t:_rfDmg',ranged]]],['procCounter',[['t:dmg',phys('player')]]],['procIai',[['t:res.dmg',phys('player')]]],
    ['dragonExtraAttackProc',[['t:res.dmg',melee]]],['procCombo',[['t:dmg',phys('player')]]],['dualWieldOffhandAttack',[['t:dmg',melee]]],
    ['reboundExtraAttack',[['mob:dmg',melee]]],['witchIceLance',[['t:dmg',magic]]],['qiguPlayerAttack',[['target:dmg',magic]]],['qiguWeaponProc',[['target:dmg',magic]]]
  ])hits(core,fn,'player',rows);
  // This aura's base amount is shared by every target: retain it and expose a
  // per-target local to the existing combat log instead of compounding ×5.
  inside(core,'relicAuraTick','native-aura','m.curHp -= dmg; m.justHit',`let _cardAura=${C}?${C}.damage(${C}.ownerOfEquipment(_s.eq),m,dmg,{kind:'dot'}):dmg; m.curHp -= _cardAura; m.justHit`);
  inside(core,'relicAuraTick','native-aura-log','${m.n}</span> ${dmg}','${m.n}</span> ${_cardAura}');
  hits(attack,'playerAttack','player',[
    ['target:result.dmg',phys('player'),'packet:result'],['target:_bs',fixed],['target:result.dmg',magic],['target:_hf',magic],
    ['exT:_pierceDmg',phys('player'),'inherited:!!result.cardFirstApplied'],['target:_oh.dmg',magic,'',true],['target:wpn.frozenBonusDmg',fixed,'',true],
    ['target:_whb',fixed],['target:_ah.dmg',magic,'',true]
  ]);
  for(const [fn,rows] of [
    ['dragonStrikeProc',[['m:dmg',melee]]],['dragonSlayStrikeProc',[['m:dmg',melee]]],['stormBuffTick',[['t:d',dot]]],
    ['offhandAfterHit',[['target:_oh.dmg',magic,'',true]]],['weaponSpellProc',[['target:_add',fixed],['_dt:_tot',magic],['t:dmg',magic]]],
    ['procFreeMagicSkill',[['t:total',magic]]],['_procWeaponSpellHit',[['t:d',magic]]],['laiaWandHitProc',[['t:d',magic]]]
  ])hits(attack,fn,'player',rows);
  hits(attack,'bombFlowerExplode','_w',[['t:dd',magic]]);
  inside(attack,'consumeStrawCurse','straw-damage',"m.curHp -= 80; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(m, 80, 'magic');",`let _cardStraw=${C}?${C}.damage(player,m,80,{kind:'magic'}):80; m.curHp -= _cardStraw; if (typeof terrorVisageOnDamage === 'function') terrorVisageOnDamage(m, _cardStraw, 'magic');`);
  hits(allies,'processMobStatusTick',i=>`${C}.sourceActor(${['s.poisonSrc','m._bleedSrc','m._burstPoison.src','m._burnDot.src'][i]})`,[
    ['m:_pdc.dmg',dot,'dotCapped:true'],['m:_bdc.dmg',dot,'dotCapped:true'],['m:_udc.dmg',dot,'dotCapped:true'],['m:_fdc.dmg',dot]
  ]);
  hits(allies,'allyQiguAttack','ally',[['t:dmg',magic],['t:pd',magic]]);
  hits(allies,'allyAttackOnce','ally',[
    ['t:dmg',magic],['t:dmg',phys('ally')],['t:_bs',fixed],['t:dmg',magic],['t:_hf',magic],['t:_oh.dmg',magic,'',true],
    ['t:wpn.frozenBonusDmg',fixed,'',true],['t:_whb',fixed],['t:_ah.dmg',magic,'',true]
  ]);
  for(const [fn,rows] of [
    ['allyOffhandAfterHit',[['t:_oh.dmg',magic,'',true]]],['allyCastMagic',[['t:totalDmg',magic],['m:_d',magic,`inherited:${C}.inherited(ally,targets)`]]],
    ['allyCastPhysicalSkill',[['t:res.dmg',phys('ally')]]],['allyRapidfire',[['mt:dmg',ranged]]],['_allyDamageMob',[['t:dmg','terrorKind||null']]],
    ['allyDollAttackProcs',[['target:_add',fixed]]],['allyWarriorAct',[['m:dmg',magic]]],['allyCubeTick',[['t:dd',dot],['m:dd',dot]]],
    ['allyStormTick',[['t:dmg',dot]]],['allyCastCrush',[['t:dmg',phys('ally')]]],['allyCastSlaughter',[['t:dmg',phys('ally')]]],
    ['allyCastMpDmg',[['t:dmg',magic]]],['allyDarkCrit',[['t:dmg',phys('ally')]]]
  ])hits(allies,fn,'ally',rows);
  hits(skills,'summonAttack','owner',[['t:dmg',melee],['t:dmg',"sm.kind==='magic'?'magic':'melee'"]]);
  hits(skills,'summonTick','owner',[['t:pd',magic]]);
  hits(skills,'cubeTick','player',[['t:d',dot],['m:d',dot]]);
  hits(skills,'illuSummonTick','owner',[['t:dmg',"c.kind==='magic'?'magic':'melee'"]]);
  hits(skills,'castSkillInner','player',[
    ['_t:dmg',phys('player')],['ht:dmg',phys('player')],['m:dmg',magic],['t:dmg',"sk.weaponDmg?window.AFK_CARD_COMBAT.physicalKind(player):'magic'"],
    ['t:res.dmg',phys('player')],['t:totalDmg',magic],['m:_d',magic,`inherited:${C}.inherited(player,targets)`]
  ]);
  // Upgrade the first local development version if it was already applied.
  const oldMental="{kind:sk.mpDmg?'magic':window.AFK_CARD_COMBAT.physicalKind(player)}";
  if(source(skills).includes(oldMental))inside(skills,'castSkillInner','mental-kind',oldMental,"{kind:sk.weaponDmg?window.AFK_CARD_COMBAT.physicalKind(player):'magic'}");
  hits('js/22-pets.js','petAttackOnce','player',[['target:dmg',melee]]);
  hits('js/22-pets.js','petCastSkill','player',[['m:dmg',magic]]);
  hits('js/23-summons.js','summonV2AttackOnce','owner||player',[['t:dmg',melee],['m:pd',magic]]);
  hits('js/23-summons.js','spiritAttackOnce','owner||player',[['t:dmg',melee],['m:pd',magic]]);
  hits('js/31-castle-guards.js','guardAttackOnce','player',[['t:dmg',melee]]);
  // Immunity is a property of the actual native settlement path. Legacy
  // pursuit/true/DOT paths without a refund keep dealing damage and therefore
  // spend first-hit eligibility. Do not silently expand their immunity rules.
  function refunds(file,fn,modes){
    mutate(file,fn,'refund-'+fn,(body,mark)=>{
      let n=0;const next=body.replace(/window\.AFK_CARD_COMBAT\.damage\([^{};]*?,\{kind:/g,whole=>{
        if(n>=modes.length)throw Error(`${file}:${fn}: unexpected card refund hook`);
        const mode=modes[n++];return whole.replace('{kind:',`{nativeRefund:${mode},kind:`);
      });
      if(n!==modes.length)throw Error(`${file}:${fn}: expected ${modes.length} refund hooks, found ${n}`);
      return next.replace('/* card-combat:',mark+' /* card-combat:');
    });
  }
  const full="'full'",terror="'terror'",none='null';
  for(const fn of ['procLightArrow','procMoonburst','rapidfireProc','procCombo','dualWieldOffhandAttack','qiguWeaponProc'])refunds(core,fn,[terror]);
  refunds(core,'qiguPlayerAttack',[full]);
  refunds(attack,'playerAttack',[full,none,terror,terror,none,none,none,none,none]);
  for(const fn of ['consumeStrawCurse','procFreeMagicSkill','_procWeaponSpellHit','laiaWandHitProc'])refunds(attack,fn,[terror]);
  refunds(allies,'allyQiguAttack',[full,terror]);
  refunds(allies,'allyAttackOnce',[full,full,none,terror,terror,none,none,none,none]);
  refunds(allies,'allyCastMagic',[full,terror]);
  for(const fn of ['allyCastPhysicalSkill','allyWarriorAct','allyCastCrush','allyCastSlaughter','allyCastMpDmg','allyDarkCrit'])refunds(allies,fn,[full]);
  refunds(allies,'allyRapidfire',[terror]);refunds(allies,'_allyDamageMob',["terrorKind?'terror':null"]);
  refunds(skills,'castSkillInner',[full,full,full,"t._reflectWall?'full':null",full,full,terror]);
  for(const fn of ['petAttackOnce','petCastSkill'])refunds('js/22-pets.js',fn,[terror]);
  for(const fn of ['summonV2AttackOnce','spiritAttackOnce'])refunds('js/23-summons.js',fn,[terror,terror]);
  refunds('js/31-castle-guards.js','guardAttackOnce',[terror]);
  const crushKind="damage(ally,t,dmg,{nativeRefund:'full',kind:'magic'})";
  if(source(allies).includes(crushKind))inside(allies,'allyCastCrush','crush-physical-kind',crushKind,`damage(ally,t,dmg,{nativeRefund:'full',kind:${phys('ally')}})`);
  // Native fallback piercing shares its base scalar across the target loop.
  // A blocked primary can leave every secondary eligible; never compound ×5
  // into ×25 by writing a target's final amount back to that shared scalar.
  inside(attack,'playerAttack','pierce-local',"if (window.AFK_RELIC_WEAPON_BRIDGE && window.AFK_RELIC_WEAPON_BRIDGE.enabled()) window.AFK_RELIC_WEAPON_BRIDGE.pierceHit(exT,_pierceDmg,wpn,result); else exT.curHp -= (_pierceDmg=(window.AFK_CARD_COMBAT?window.AFK_CARD_COMBAT.damage(player,exT,_pierceDmg,{nativeRefund:null,kind:window.AFK_CARD_COMBAT.physicalKind(player),inherited:!!result.cardFirstApplied}):_pierceDmg));",`let _cardPierce=_pierceDmg; if (window.AFK_RELIC_WEAPON_BRIDGE && window.AFK_RELIC_WEAPON_BRIDGE.enabled()) window.AFK_RELIC_WEAPON_BRIDGE.pierceHit(exT,_pierceDmg,wpn,result); else { _cardPierce=${C}?${C}.damage(player,exT,_pierceDmg,{nativeRefund:null,kind:${phys('player')},inherited:!!result.cardFirstApplied&&!wpn.pierceSubMult}):_pierceDmg; exT.curHp -= _cardPierce; }`);
  inside(attack,'playerAttack','pierce-moon-damage','moonShatterOnDamage(player, exT, _pierceDmg)','moonShatterOnDamage(player, exT, _cardPierce)');
  inside(attack,'playerAttack','pierce-local-log','${exT.n}</span>，造成 ${_pierceDmg}','${exT.n}</span>，造成 ${_cardPierce}');
  // Relic-generated physical/magic/true hits and stacked DOT all end here.
  inside('afk-relic-runtime.js',null,'runtime-damage','var before = hp(target), value = Math.floor(amount);',`var before = hp(target), value = Math.floor(amount); if(${C})value=${C}.damage(actor,target,value,{kind:typ==='physical'?'melee':typ,origin:origin,reflection:reflection,redirected:redirected,ascended:asc,dotCapped:typ==='dot'&&(!opt.budgeted||opt.dotKind==='poison'||opt.dotKind==='bleed'),inherited:!!opt.cardInherited});`);
  inside('afk-relic-runtime.js',null,'runtime-refund',`${C}.damage(actor,target,value,{kind:typ==='physical'?'melee':typ,`,`${C}.damage(actor,target,value,{nativeRefund:typ==='dot'?null:opt.reflect!==false&&(typ!=='true'||opt.reflect===true)?'full':typ!=='true'?'terror':null,kind:typ==='physical'||typ==='true'&&opt.reflect===true?'melee':typ,`);
  inside('afk-relic-runtime.js',null,'runtime-dot-kind',"{ type: 'dot', source: d.source,budgeted:true,reflect:false,element:d.element }","{ type: 'dot', source: d.source,budgeted:true,reflect:false,element:d.element,dotKind:d.kind }");
  inside('afk-stackdot.js',null,'stack-dot','m.curHp -= sum; m.justHit',`if(${C})sum=${C}.damage(${C}.sourceActor(st[kind + 'Src']),m,sum,{kind:'dot',dotCapped:true}); m.curHp -= sum; m.justHit`);
  // Arts has a private HP helper. Give it the actual owner rather than silently
  // crediting an ally's timed/area effect to the leader's first-hit ledger.
  inside('afk-arts.js',null,'arts-settle','var hurtMob = function (m, v) { if (!(v > 0) || !m || m._dead) return; m.curHp -= Math.floor(v);',`var hurtMob = function (m, v, owner) { if (!(v > 0) || !m || m._dead) return; var amount=Math.floor(v);if(${C})amount=${C}.damage(owner||${C}.currentActor(),m,amount,{kind:'true'});m.curHp -= amount;`);
  for(const [id,old,next] of [
    ['arts-extra','hurtMob(m, plus)','hurtMob(m, plus, actor)'],['arts-element','hurtMob(prim, el)','hurtMob(prim, el, actor)'],['arts-flat','hurtMob(prim, kv)','hurtMob(prim, kv, actor)'],
    ['arts-dragon',"hurtMob(m, (r3() + r3() + r3() + 30) * (1 + F(actor)) * (typeof fragileMult === 'function' ? fragileMult(m) : 1))","hurtMob(m, (r3() + r3() + r3() + 30) * (1 + F(actor)) * (typeof fragileMult === 'function' ? fragileMult(m) : 1), actor)"],
    ['arts-ally-spell',"hurtMob(m, base * 3 * eles.length * (typeof mrMult === 'function' ? mrMult(m.mr || 0) : 1))","hurtMob(m, base * 3 * eles.length * (typeof mrMult === 'function' ? mrMult(m.mr || 0) : 1), actor)"],
    ['arts-timed','hurtMob(m, (m.hp || m.curHp) * 0.2)','hurtMob(m, (m.hp || m.curHp) * 0.2, p)']
  ])inside('afk-arts.js',null,id,old,next);
  // Native 0.1-second scheduling, including offline execution. No new interval.
  inside(core,'tick','aura-tick','state.ticks++;',`state.ticks++; if(${C})${C}.tick();`);
  // A phase transition is still the same enemy. Keep its first-hit identity
  // before replacing the native object; ordinary spawn paths remain untouched.
  inside('js/05-kill-progression.js','doMobTransform','inherit-target','    mapState.mobs[idx] = next;',`    if (${C}) ${C}.inheritTarget(mob, next);\n    mapState.mobs[idx] = next;`);
  inside('js/01-drops-config.js','castIntervalTicks','monster-cast-zero','return Math.max(1, Number(v) || 12);',`return ${C}?${C}.castInterval(p,v):Math.max(1, Number(v) || 12);`);
  // Reinforced #51 definitions keep their base weapon's mandatory Dantes form.
  // Resolve the registered relic identity, exactly as early card stats do.
  inside('js/02-stats-recompute.js','recomputeStats','emperor-morph-base',"p.eq.wpn.id === 'wpn_uncursed_emperor_blade'","(DB.items[p.eq.wpn.id] && DB.items[p.eq.wpn.id].relicBase || p.eq.wpn.id) === 'wpn_uncursed_emperor_blade'");
  for(const [file,content] of files){if(content!==readFileSync(file,'utf8')){if(check)throw Error(`Card combat patch missing: ${file}`);writeFileSync(file,content);}}
  return {groups:edits,settlements};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
  console.log(JSON.stringify(applyCardCombatPatches(process.argv.includes('--check'))));
}
