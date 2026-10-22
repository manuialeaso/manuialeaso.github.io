// Rebuild only the managed plugin region. Keep current cache versions until
// the separately authorized prepush/stamp step; new scripts have no old hash.
import {readFileSync,writeFileSync} from 'node:fs';
const file='index.html',html=readFileSync(file,'utf8');
const begin='    <!-- ═══════════ 加掛版外掛層（',end='    <!-- ═══════════ 加掛版外掛層 END ═══════════ -->';
const from=html.indexOf(begin),to=html.indexOf(end,from);
if(from<0||to<0||html.indexOf(begin,from+1)>=0)throw new Error('Managed plugin region is missing or ambiguous');
const versions=new Map([...html.matchAll(/src="(afk-[^"?]+\.js)(\?v=[^"]+)?"/g)].map(m=>[m[1],m[2]||'']));
const block=readFileSync('scripts/afk-plugin-block.html','utf8').trimEnd().replace(/src="(afk-[^"?]+\.js)(?:\?v=[^"]+)?"/g,(m,p)=>`src="${p}${versions.get(p)||''}"`);
const out=html.slice(0,from)+block+html.slice(to+end.length);
if(process.argv.includes('--check')){if(out!==html)throw new Error('Plugin block differs; run node scripts/sync-local-plugin-block.mjs');}
else if(out!==html)writeFileSync(file,out);
console.log('Plugin block: '+(out===html?'current':'rebuilt'));
