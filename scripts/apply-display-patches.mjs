import {readFileSync,writeFileSync} from 'node:fs';

export function applyDisplayPatches(check=false) {
  const file='js/09-vfx-render.js';
  const before=`                    el.style.width = fxW + 'px'; el.style.height = fxH + 'px';
                    el.style.left = (px - fxW * axf) + 'px'; el.style.top = (py - fxH * ayf) + 'px';
                    let fi = Math.floor(elapsed / frameDur) % cfg.n; if (frames[fi]) el.src = frames[fi].src;   // 途中循環幀`;
  const after=`                    let fi = Math.floor(elapsed / frameDur) % cfg.n;
                    // AFK_DISPLAY_PROJECTILE: same path/time, compositor-friendly motion.
                    if (!(typeof window.__afkProjectileFrame === 'function' && window.__afkProjectileFrame(el, px - fxW * axf, py - fxH * ayf, fxW, fxH, _flipX, frames[fi] && frames[fi].src))) {
                        el.style.width = fxW + 'px'; el.style.height = fxH + 'px';
                        el.style.left = (px - fxW * axf) + 'px'; el.style.top = (py - fxH * ayf) + 'px';
                        if (frames[fi]) el.src = frames[fi].src;
                    }`;
  const src=readFileSync(file,'utf8'),marker='AFK_DISPLAY_PROJECTILE';
  if(src.includes(marker)) {
    if(src.split(after).length!==2)throw new Error(`[${file}] projectile rendering patch changed unexpectedly`);
    console.log('[display-patch] projectile rendering already installed'); return;
  }
  if(src.split(before).length!==2)throw new Error(`[${file}] projectile rendering anchor must occur exactly once`);
  if(check)throw new Error(`[${file}] projectile rendering patch is missing`);
  writeFileSync(file,src.replace(before,after));
  console.log('[display-patch] projectile rendering installed');
}
