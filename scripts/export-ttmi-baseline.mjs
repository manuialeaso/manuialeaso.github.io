// Export only game definitions for the deterministic item importer. Never load a save.
import fs from 'node:fs';
import vm from 'node:vm';
const context = { console: { log(){}, warn(){} }, document: { readyState:'loading', addEventListener(){} }, localStorage:{ getItem(){ return null; } }, location:{ protocol:'file:',hostname:'' } };
context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/00-data.js','utf8'),context);
vm.runInContext(fs.readFileSync('js/01-drops-config.js','utf8'),context);
vm.runInContext(fs.readFileSync('js/02-stats-recompute.js','utf8'),context);
vm.runInContext('var CRAFT_RECIPES = {};',context);
for (const file of ['afk-sets.js','afk-polys.js']) vm.runInContext(fs.readFileSync(file,'utf8'),context);
fs.mkdirSync('.scratch',{recursive:true});
fs.writeFileSync('.scratch/ttmi-baseline-db.json',JSON.stringify(vm.runInContext('Object.assign({},DB,{polyForms:POLY_TIERS.flatMap(t=>t.forms).concat(typeof CONTROL_ONLY_POLY_FORMS!=="undefined"?CONTROL_ONLY_POLY_FORMS:[])})',context)));
