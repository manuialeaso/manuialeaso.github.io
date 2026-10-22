/** Status and legacy armor heal hooks. Changes are scoped to named functions,
 * validated against exact anchor counts, and buffered until every anchor passes. */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export function applyRelicDefensePatches(check=false){
 const files=new Map();let edits=0;
 function source(file){if(!files.has(file))files.set(file,readFileSync(file,'utf8'));return files.get(file);}
 function mutate(file,fn,id,change){
  let s=source(file),mark=`/* relic-defense:${id} */`;if(s.includes(mark))return;
  const start=s.indexOf(`function ${fn}(`);if(start<0)throw Error(`${file}: missing function ${fn}`);
  let end=s.indexOf('\nfunction ',start+1);if(end<0)end=s.length;
  const body=s.slice(start,end),next=change(body,mark);if(next===body||!next.includes(mark))throw Error(`${file}:${fn}: no verified ${id} change`);
  files.set(file,s.slice(0,start)+next+s.slice(end));edits++;
 }
 function inside(file,fn,id,anchor,replacement,expected=1){mutate(file,fn,id,(body,mark)=>{const n=body.split(anchor).length-1;if(n!==expected)throw Error(`${file}:${fn}: ${id}: expected ${expected} anchors, found ${n}`);return body.split(anchor).join(replacement+' '+mark);});}
 const S='window.AFK_RELIC_DEFENSE_BRIDGE',R='window.AFK_RELIC_RUNTIME',combat='js/04-combat-attack.js';
 const kinds=new Set('freeze stun stone sleep paralyze poison burn scald bleed blind weaken disease silence magicseal slow slowAtk bind fear potionFrost foulWater armorBreak evilAura cleave broken'.split(' '));
 const scopes=[['_enemyPhysicalAttackInner','player',4,2,0],['_enemyAttackAllyInner','ally',1,0,1],['_applyMobMagicToAllyInner','ally',25,0,13],['_applyMobMagicInner','player',28,20,0]];
 for(const [fn,actor,expected,pc,ac] of scopes){
  // A direct helper at the actual assignment also sees refreshed statuses. It
  // cannot mistake native DoT damage/tick metadata for a successful status.
  mutate(combat,fn,'assign-'+fn,(body,mark)=>{let n=0;const out=body.replace(/\b(player\.statuses|ally\.statuses|st)\.(\w+)\s*=\s*([^;\n]+);/g,(whole,store,key,rhs)=>{
   if(!kinds.has(key))return whole;n++;const helper=key==='freeze'&&rhs.startsWith('Math.max(0,')?'shortenStatus':'setStatus';
   return `(${S}?${S}.${helper}(${actor},'${key}',${rhs},mob):(${store}.${key}=${rhs}));${n===1?' '+mark:''}`;
  });if(n!==expected)throw Error(`${fn}: expected ${expected} status assignments, found ${n}`);return out;});
  if(pc)mutate(combat,fn,'player-attacker-'+fn,(body,mark)=>{let n=0;const out=body.replace(/playerStatusResisted\(('[^']+'|_rk)\)/g,(whole,kind)=>{n++;return `playerStatusResisted(${kind},mob)`;});if(n!==pc)throw Error(`${fn}: expected ${pc} player status queries, found ${n}`);return out+'\n'+mark+'\n';});
  if(ac)mutate(combat,fn,'ally-attacker-'+fn,(body,mark)=>{let n=0;const out=body.replace(/allyStatusResisted\(ally,\s*('[^']+'|_rk)\)/g,(whole,kind)=>{n++;return `allyStatusResisted(ally,${kind},mob)`;});if(n!==ac)throw Error(`${fn}: expected ${ac} ally status queries, found ${n}`);return out+'\n'+mark+'\n';});
 }
 // Native immunity shortcuts must also report an actual blocked attempt.
 inside(combat,'_applyMobMagicInner','stone-immunity-player','if(player.d.immStone) return;',"if(playerStatusResisted('stone',mob)) return;");
 inside(combat,'_applyMobMagicInner','poison-immunity-player','if(player.d.immPoison) return;',`if(${S}?${S}.knownImmune(player,sk.type,player.d.immPoison,mob):player.d.immPoison) return;`,2);
 inside(combat,'_applyMobMagicInner','silence-immunity-player','if (player.d && player.d.immSilence)',"if (playerStatusResisted('silence',mob))");
 inside(combat,'_applyMobMagicToAllyInner','stone-immunity-ally','if (d.immStone) return;',"if (allyStatusResisted(ally,'stone',mob)) return;");
 inside(combat,'_applyMobMagicToAllyInner','silence-immunity-ally','if (d.immSilence)',"if (allyStatusResisted(ally,'silence',mob))");
 inside(combat,'_enemyPhysicalAttackInner','poison-hit-player','mob.onHitPoison && !player.d.immPoison','mob.onHitPoison');
 inside(combat,'_enemyAttackAllyInner','poison-hit-ally','mob.onHitPoison && !d.immPoison','mob.onHitPoison');
 inside(combat,'_applyMobMagicInner','poison-secondary-player',"if(sk.sec.type === 'poison' && !player.d.immPoison)","if(sk.sec.type === 'poison')");
 inside(combat,'_applyMobMagicInner','paralyze-secondary-player',"if(sk.sec.type === 'paralyze' && !player.d.immPoison)","if(sk.sec.type === 'paralyze')");
 inside(combat,'_applyMobMagicInner','paralyze-legacy-player',"if(playerStatusResisted('paralyze',mob))", "if(playerStatusResisted('paralyze',mob) || player.d.immPoison)",2);
 // Resolve the spell's native landing chance before checking equipment. A
 // failed secondary status roll must not create immunity counters or healing.
 for(const [kind,base,poison] of [['freeze',200,false],['stun',150,false],['sleep',150,false],['paralyze',50,true],['burn',100,false],['poison',100,true]]){
  const old=`${poison?'!d.immPoison && ':''}!allyStatusResisted(ally,'${kind}',mob) && _sc(${base})`;
  const next=`_sc(${base}) && !allyStatusResisted(ally,'${kind}',mob)${poison?' && !d.immPoison':''}`;
  inside(combat,'_applyMobMagicToAllyInner','secondary-order-'+kind,old,next);
 }
 inside('js/03-combat-core.js','tick','player-status-expiry','player.statuses[k]--;',`player.statuses[k]--; if(player.statuses[k]===0&&${S}) ${S}.statusEnded(player,k,'natural');`);
 inside('js/06-status-allies.js','processAllyStatusTick','ally-status-expiry','st[k]--;',`{ st[k]--; if(st[k]===0&&${S}) ${S}.statusEnded(ally,k,'natural'); }`);
 inside('js/06-status-allies.js','teamCleanseOne','team-cleanse','if (st[k]) st[k] = 0;',`if(st[k]){if(${S})${S}.setStatus(m,k,0);else st[k]=0;}`);
 for(const kind of ['poison','burn','scald','bleed'])inside('js/06-status-allies.js','processAllyStatusTick','ally-dot-'+kind,`ally.curHp -= st.${kind}Dmg;`,`{ let rd=st.${kind}Dmg; if(${R})rd=${R}.incoming(ally,rd,null,{kind:'dot',dotKind:'${kind}',direct:false}); ally.curHp-=rd; if(${R})${R}.afterIncoming(ally,rd,null); }`);
 // The original poison-form branch bypassed the ordinary incoming hook and
 // healed on every tick. Keep its original fallback when the plugin is off.
 inside('js/03-combat-core.js','tick','base-poison-conversion',
  '            let _pheal = Math.max(1, Math.floor(_pdmg * player.d.poisonHealMult));\n            player.hp = Math.min(player.mhp, player.hp - _pdmg + _pheal);\n            logCombat(`毒液化身汲取毒素：受到劇毒傷害 ${_pdmg} 點，恢復 ${_pheal} 點HP。`, \'player\');',
  `            if (${R} && ${R}.enabled()) {
                const before = player.hp, rd = ${R}.incoming(player,_pdmg,null,{kind:'dot',dotKind:'poison',direct:false});
                player.hp -= rd; ${R}.afterIncoming(player,rd,null);
                const gained = Math.max(0,player.hp-before);
                if(gained>0)logCombat('毒液化身汲取毒素，恢復 '+gained+' 點HP。','player');
                if(player.hp<=0){killPlayer();return;}
            } else {
                let _pheal = Math.max(1,Math.floor(_pdmg*player.d.poisonHealMult));
                player.hp = Math.min(player.mhp,player.hp-_pdmg+_pheal);
                logCombat('毒液化身汲取毒素：受到劇毒傷害 '+_pdmg+' 點，恢復 '+_pheal+' 點HP。','player');
            }`);
 inside('js/05-kill-progression.js','killMob','legacy-helm-kill-player','player.hp = Math.min(player.mhp, player.hp + DB.items[player.eq.helm.id].killHealHp);',`{let hd=DB.items[player.eq.helm.id];if(${R})${R}.procHeal(player,hd.killHealHp,hd.relicBase||player.eq.helm.id);else player.hp=Math.min(player.mhp,player.hp+hd.killHealHp);}`);
 inside('js/05-kill-progression.js','killMob','legacy-helm-kill-ally','a.curHp = Math.min(a.mhp || 1, (a.curHp || 0) + DB.items[a.eq.helm.id].killHealHp);',`{let hd=DB.items[a.eq.helm.id];if(${R})${R}.procHeal(a,hd.killHealHp,hd.relicBase||a.eq.helm.id);else a.curHp=Math.min(a.mhp||1,(a.curHp||0)+hd.killHealHp);}`);
 if(check&&edits)throw Error(`relic defense has ${edits} unapplied hook groups`);
 if(!check)for(const [file,text] of files)if(text!==readFileSync(file,'utf8'))writeFileSync(file,text);
 console.log(`Relic defense hooks: ${edits?'applied '+edits+' groups':'all present'}`);return edits;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))applyRelicDefensePatches(process.argv.includes('--check'));
