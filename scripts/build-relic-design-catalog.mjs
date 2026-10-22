import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

// Read the same prose used by the game. Do not copy the pre-implementation
// stage text from the editorial cards: several ambiguities are now resolved.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = {
  console,
  document:{readyState:'loading',addEventListener(){}},
  localStorage:{getItem(){return null;}},
  location:{protocol:'file:',hostname:''}
};
context.window = context;
vm.createContext(context);
// configure() can refine stage prose (movement, immunity, etc.). Supply the
// real item definitions so its numeric branches see the same fields as play.
for (const file of ['js/00-data.js', 'js/01-drops-config.js', 'js/02-stats-recompute.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename:file});
}
const db = vm.runInContext('DB', context);
for (const file of ['afk-relic-catalog.js', 'afk-relic-weapons.js', 'afk-relic-defense.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename:file});
}
const rows = context.AFK_RELIC_CATALOG.slice().sort((a,b) => a.id - b.id);
if (rows.length !== 250 || rows.some((row, i) => row.id !== i + 1)) throw Error('Expected exactly relics 1–250');

function readable(value) {
  return String(value || '').trim()
    .replace(/本次本次/g, '本次')
    .replace(/\bBoss\b/g, '首領')
    .replace(/\bHP\b/g, '生命')
    .replace(/\bMP\b/g, '魔力')
    .replace(/\bCD\b/g, '冷卻')
    .replace(/生命\s+(?=[\u3400-\u9fff])/g, '生命')
    .replace(/魔力\s+(?=[\u3400-\u9fff])/g, '魔力')
    .replace(/([\u3400-\u9fff])\s+(?=生命|魔力|首領)/g, '$1')
    .replace(/首領\s+(?=[\u3400-\u9fff／])/g, '首領')
    .replace(/(?:\s*\/\s*)/g, '；')
    .replace(/原稿所列的/g, '既定的')
    .replace(/依原稿/g, '')
    .replace(/前階/g, '前一階段')
    .replace(/[；;]+$/, '。')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}
function pad(n) { return String(n).padStart(3, '0'); }
function range(group) { return pad(group[0].id) + '～' + pad(group[group.length - 1].id); }
function effectsFor(row) {
  const module = context.AFK_RELIC_WEAPONS.byId[row.id] ? context.AFK_RELIC_WEAPONS : context.AFK_RELIC_DEFENSE;
  const meta = module.byId[row.id];
  if (!meta || meta.key !== row.key) throw Error('Missing current prose for relic ' + row.id);
  const base = db.items[row.key];
  if (!base) throw Error('Missing game definition for relic ' + row.id);
  const fallback = meta.texts || meta.description;
  const effects = [[0,null],[5,null],[10,null],[0,0],[0,5]].map(([n,asc], stage) => {
    const b = JSON.parse(JSON.stringify(base));
    const d = JSON.parse(JSON.stringify(base));
    d.relicBase = row.key;
    if (!module.configure(d, b, n, asc)) throw Error('Could not configure relic ' + row.id);
    return readable(d.relicEffectText || d.relicEffectsText || fallback[stage]);
  });
  if (effects.length !== 5 || effects.some(text => !text || /undefined|NaN/.test(text))) throw Error('Incomplete current prose for relic ' + row.id);
  // These are retained design gaps, not invented numeric implementations.
  if (row.id === 33) effects[4] += ' 原設計另列的「即死機率 15%、魔法爆擊率 +5%」尚未確定所屬階段，沒有加入本階效果。';
  if (row.id === 43) effects[4] += ' 原設計中的自身中毒、出血尚未指定每跳自損量；目前僅累積實際承受的毒血傷害，未額外附加自動扣血。';
  return {lore:readable(meta.lore), effects};
}

const out = [
  '# 遺物設計清單',
  '',
  '本清單收錄 250 件遺物及 2 件 GM 測試道具，按原編號排列。每件保留設計意象、版本方向與分階效果；「原始效果」供核對後續保留的能力。',
  '',
  '| 分類 | 編號 | 件數 |',
  '| --- | --- | ---: |',
  '| [武器](#武器) | 001～131 | 131 |',
  '| [防具](#防具) | 132～222 | 91 |',
  '| [飾品](#飾品) | 223～250 | 28 |',
  '| [GM 測試道具](#gm-測試道具) | 99999、99998 | 2 |',
  '',
  '設計意象沿用遊戲原有世界觀，不為缺少來歷的物品另編歷史或神話出處。各階段未明說取代的效果，依個別描述保留；尚未定案的能力直接標在該件內容中。',
  ''
];

for (const type of ['武器', '防具', '飾品']) {
  const typed = rows.filter(row => row.type === type);
  out.push('## ' + type, '');
  for (const slot of [...new Set(typed.map(row => row.slot))]) {
    const group = typed.filter(row => row.slot === slot);
    out.push('### ' + slot + '｜' + range(group), '');
    for (const row of group) {
      const current = effectsFor(row);
      out.push('#### ' + pad(row.id) + ' ' + row.name, '');
      const concept = readable(row.design_concept);
      out.push('**設計理念**：' + current.lore + (current.lore && !/[。！？]$/.test(current.lore) ? '。' : '') + concept, '');
      out.push('**版本方向**：' + readable(row.version_direction), '');
      out.push('| 階段 | 效果 |', '| --- | --- |');
      const stages = ['原始效果', '+5', '+10', '昇華支配', '昇華支配 +5'];
      for (let i = 0; i < stages.length; i++) {
        if (row.id === 29 && i === 4) continue; // This item has no ascended +5 stage.
        out.push('| ' + stages[i] + ' | ' + current.effects[i] + ' |');
      }
      out.push('');
    }
  }
}

out.push(
  '## GM 測試道具',
  '',
  '兩件均為直接取得的固定 **昇華支配 +5** 測試道具，不設升級路線。',
  '',
  '### 99999 萬象支配者・GM 武器',
  '',
  '**設計理念**：萬兵同鳴，萬象歸一。將全部遺物集中於一件武器，供 GM 檢驗各種攻擊、反擊、施法與支援效果的交互作用。',
  '',
  '**固定狀態**：昇華支配 +5；不可強化、合成或進化。',
  '',
  '**完整效果**：同時具備全部 250 件遺物的最高已定階段效果，包含武器、防具、戒指、項鍊、耳環、腰帶等各部位能力。各來源原有的觸發條件與獨立冷卻照常生效，同源效果只生效一次；不替第 029 件增加不存在的階段，也不加入尚未定案的數值。',
  '',
  '### 99998 萬象支配者・GM 神甲',
  '',
  '**設計理念**：千重甲冑，眾神之契。以一件防具承載全部遺物與套裝，用於檢驗防禦、恢復、夥伴能力及套裝效果的完整互動。',
  '',
  '**固定狀態**：昇華支配 +5；不可強化、合成或進化。',
  '',
  '**完整效果**：同時具備全部 250 件遺物的最高已定階段效果，涵蓋所有武器、防具及飾品；另直接啟用全部 57 組套裝效果配置與其累積門檻效果，不必另穿齊原套裝部件。原有觸發條件與各自冷卻照常生效；與 99999 同時裝備時，同源效果仍只生效一次。',
  '',
  '---',
  '',
  '文字依據：[設計理念與版本方向](../afk-relic-catalog.js)、[目前武器階段敘述](../afk-relic-weapons.js)、[目前防具與飾品階段敘述](../afk-relic-defense.js)、[GM 固定效果](../afk-relic-gm.js)。本清單可由 `node scripts/build-relic-design-catalog.mjs` 重新產生。',
  ''
);
if (process.argv.includes('--check')) {
  console.log('Validated configured prose: 250 relics, 2 fixed GM fixtures; no files changed.');
} else {
  const output = path.join(root, 'docs/relic-design-catalog.md');
  fs.writeFileSync(output, out.join('\n'));
  console.log('Wrote docs/relic-design-catalog.md: 250 relics, 2 fixed GM fixtures.');
}
