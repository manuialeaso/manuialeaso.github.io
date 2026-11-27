(() => {
'use strict';
const stepX=[0,1,1,1,0,-1,-1,-1],stepY=[-1,-1,0,1,1,1,0,-1];
const BW = 24, BH = 23, PREFETCH = 14, KEEP = 24, CHUNK_MAX = 30, MAPS_KEEP = 4, CORE = 5;
const freeCanvas = c => { c.width = c.height = 0; };
// 第 300 項（站長 2026-10-26「三項都做」：圖檔加密）：角色／怪物／魔法圖（/gfx/*.png）、地圖拼圖頁（/data/maps/m*/p*.png）
//   網頁伺服器送出時用金鑰攪亂（server/server.mjs sendStat packed），直接開網址、整包抓走只拿到亂碼；網頁跟同網站要金鑰（/api/packkey）還原成 PNG 再畫。
//   ⚠ 金鑰總要交給瀏覽器，擋得住順手存圖、整站爬圖，擋不住有心人照著網頁程式還原——跟別家「加密素材包」同一個等級。
//   scramble 是 XOR，加解同一個函式；server.mjs 也 import 這支（一份演算法，兩邊不會對不上）
const isPacked = url => /\/terrain\/m\d+\/p\d+\.png(?:\?|$)/.test(url);

const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;   // 這台是 little-endian（幾乎都是）：Uint32Array 的位元組順序跟 DataView(…, true) 一樣
// k：4 個 uint32；同一把金鑰、同樣長度的檔案用同一串（夠用：只是不讓圖直接打得開）
function scramble(bytes, k) {
    const n = bytes.length;
    let s = (k[0] ^ Math.imul(n, 0x9E3779B1)) >>> 0 || 0x6D2B79F5;
    const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s; };
    const words = n >> 2;
    if (LE && bytes.byteOffset % 4 === 0) {
        // 一般情況（瀏覽器下載的整包從 0 開始、little-endian）：一次一個 uint32 直接改，不經 DataView（手機上解大張圖的主要時間），結果逐位元一樣
        //   亂數照 int32 算（同一串位元，不用每步 >>>0 轉成大於 2^31 的浮點數）
        const u = new Uint32Array(bytes.buffer, bytes.byteOffset, words), k1 = k[1] | 0, k2 = k[2] | 0, k3 = k[3] | 0;
        let x = s | 0;
        for (let i = 0, j = 0; i < words; i++) {
            x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
            u[i] ^= x ^ (j === 0 ? k1 : j === 1 ? k2 : k3);
            if (++j === 3) j = 0;
        }
        s = x >>> 0;
    } else {
        const dv = new DataView(bytes.buffer, bytes.byteOffset, n);
        for (let i = 0; i < words; i++) dv.setUint32(i * 4, (dv.getUint32(i * 4, true) ^ next() ^ k[1 + (i % 3)]) >>> 0, true);
    }
    for (let i = words * 4, w = next(); i < n; i++) bytes[i] ^= (w >>> ((i & 3) * 8)) & 255;
    return bytes;
}

// ── 以下只在瀏覽器用 ──
// 金鑰：拿到就記在這台瀏覽器（金鑰本來就要交給瀏覽器，不是秘密）；拿不到隔 1、2 秒再試，三次都不行才算沒有
//   站長 2026-11-07「好多人都有這問題」（整張地圖黑）：回報裡 LINE／FB 內建瀏覽器常「沒有金鑰」→ 一次要不到整張地圖都畫不出來
const sampleX = [2,5,9,15,19,22];
function sampleFeet(pixels,width,height,d) {
    const feet=new Uint8Array(d.per);
    for(let i=0;i<feet.length;i++){
        const x=(i%d.cols)*d.cellW+1,y=Math.floor(i/d.cols)*d.cellH+12;
        if(y>=height||x+22>=width)continue;
        for(let j=0;j<sampleX.length;j++){
            const p=4*(y*width+x+sampleX[j]);
            if(pixels[p+3]<128)continue;
            feet[i]|=1<<j;
            if(Math.max(pixels[p],pixels[p+1],pixels[p+2])>16)feet[i]|=64;
        }
    }
    return feet;
}
if(typeof module==='object'&&module.exports){module.exports={scramble,sampleFeet};return;}
window.AFK_DIMENSION_VIEW = Object.create(null);
const mediaBase = new URL('.', document.currentScript.src);
window.AFK_DIMENSION_VIEW.mediaBase = mediaBase;
const terrainRoot = new URL('terrain/m', mediaBase).href;
const PK = 'dim_terrain_pk_v1', okKey = d => Array.isArray(d) && d.length === 4 && d.every(n => Number.isInteger(n));
let keyP = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = () => keyP || (keyP = (async () => {
    for (let i = 0; i < 3; i++) {
        try { const r = await fetch(new URL('terrain/packkey.json', mediaBase), { cache: 'no-store' }); const d = r.ok ? await r.json() : null; if (d && okKey(d.k)) { try { localStorage.setItem(PK, JSON.stringify(d.k)); } catch (e) { /* 存不了照用 */ } return d.k; } } catch (e) { /* 再試 */ }
        if (i < 2) await sleep(1000 * (i + 1));
    }
    try { const s = JSON.parse(localStorage.getItem(PK) || 'null'); if (okKey(s)) return s; } catch (e) { /* 沒記過 */ }
    return null;
})().then(k => { if (!k) keyP = null; return k; }));   // 拿不到下次再要

// 還原出來是不是完整的 PNG（開頭簽名＋結尾 IEND）：瀏覽器快取裡存到不完整的檔（手機內建瀏覽器斷線時）會一直解不開，要重抓
const fullPng = b => b.length > 20 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 && b[b.length - 8] === 0x49 && b[b.length - 7] === 0x45 && b[b.length - 6] === 0x4E && b[b.length - 5] === 0x44;

async function loadTileImage(url, firstBytes) {
    async function imageFrom(src){
        const image=new Image();image.decoding='async';
        await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('地圖拼圖無法解碼'));image.src=src;});
        try{await image.decode?.();}catch{/* The load event already supplied a drawable image. */}
        return image;
    }
    if(!isPacked(url))return imageFrom(url);
    const get = async (k,reload) => {
        let bytes=!reload&&firstBytes?await firstBytes:null;
        if(!bytes){
            const response=await fetch(url,reload?{cache:'reload'}:undefined);
            if(!response.ok)throw new Error('HTTP '+response.status);
            bytes=new Uint8Array(await response.arrayBuffer());
        }
        return fullPng(bytes)?bytes:scramble(bytes,k);
    };
    const k=await key();if(!k)throw Error('沒有金鑰');
    let bytes=await get(k,false);
    if(!fullPng(bytes))bytes=await get(k,true);
    if(!fullPng(bytes))throw Error('圖片解不開（重抓後還是不完整）');
    const png=new Blob([bytes],{type:'image/png'});
    const src=URL.createObjectURL(png);
    try{return await imageFrom(src);}finally{URL.revokeObjectURL(src);}
}
function releaseTileImage(image){
    if(image)image.removeAttribute('src');
}
// 預先抓進瀏覽器快取（不用解）：取代 new Image().src = url 的預載
function prefetch(url) { if (isPacked(url)) fetch(url).catch(() => {}); else new Image().src = url; }

const MAP_SRC = { 1091: 1001, 1092: 1001, 1093: 1001 };
const msrc = id => MAP_SRC[id] || id;
const pageUrl = (id, k, gen) => terrainRoot + msrc(id) + '/p' + k + '.png' + (gen ? '?g=' + gen + '&e=1' : '?e=1');
let batchSupported=!!window.LineageSite?.localServer&&!window.LineageMedia?.mediaBase;
async function loadPageBatch(t,rows){
    const [[first,resolveFirst],...rest]=rows;
    if(!rest.length){resolveFirst(null);return;}
    try{
        const url=pageUrl(t.id,first,t.d.gen)+'&pages='+rest.map(([id])=>id).join(',');
        const response=await fetch(url,{priority:'high'});
        if(!response.ok)throw Error('無法讀取地形分頁組');
        const type=response.headers.get('Content-Type')||'';
        if(!type.startsWith('application/vnd.giran.terrain-pages')){
            // A static host serves the ordinary first page at this URL.
            const bytes=type.startsWith('image/png')?new Uint8Array(await response.arrayBuffer()):null;
            batchSupported=false;resolveFirst(bytes);for(const [,resolve] of rest)resolve(null);return;
        }
        const buf=await response.arrayBuffer(),view=new DataView(buf);
        if(view.getUint32(0)!==0x474d5031||view.getUint32(4,true)!==rows.length)throw Error('地形分頁標頭有誤');
        let offset=8+8*rows.length;
        const images=rows.map(([id],i)=>{
            const size=view.getUint32(12+8*i,true);
            if(view.getUint32(8+8*i,true)!==id||size<20||size>buf.byteLength-offset)throw Error('地形分頁長度有誤');
            const bytes=new Uint8Array(buf,offset,size);offset+=Math.ceil(size/4)*4;return bytes;
        });
        if(offset!==buf.byteLength)throw Error('地形分頁組長度有誤');
        rows.forEach(([,resolve],i)=>resolve(images[i]));
    }catch{for(const [,resolve] of rows)resolve(null);}
}
function pageBytes(t,k){
    if(!batchSupported)return null;
    if(!t.pageQueue){
        t.pageQueue=[];
        queueMicrotask(()=>{
            const queue=t.pageQueue;t.pageQueue=null;
            queue.sort(([a],[b])=>a-b);
            for(let i=0;i<queue.length;i+=24)loadPageBatch(t,queue.slice(i,i+24));
        });
    }
    return new Promise(resolve=>t.pageQueue.push([k,resolve]));
}
// A tile is a 24 x 23 half-diamond. At its middle row these six samples
// straddle a standing sprite's foot across the two adjacent halves.
function readTileFeet(page, d) {
    if (page.feet) return page.feet;
    const image = page.img, canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width; canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const feet=sampleFeet(pixels,canvas.width,canvas.height,d);
    freeCanvas(canvas);
    return page.feet = feet;
}
const footingIndex=fetch(new URL('terrain-footing.json',mediaBase)).then(r=>r.ok?r.json():null).catch(()=>null);
const descriptors=new Map();
function mapDescriptor(source){
    let pending=descriptors.get(source);
    if(pending)descriptors.delete(source);
    else pending=fetch(terrainRoot+source+'.json').then(response=>{
        if(!response.ok)throw new Error('no map');
        return response.json();
    }).then(data=>({data,footing:loadFooting(source,data).catch(()=>null)})).catch(error=>{
        if(descriptors.get(source)===pending)descriptors.delete(source);
        throw error;
    });
    descriptors.set(source,pending);
    if(descriptors.size>MAPS_KEEP)descriptors.delete(descriptors.keys().next().value);
    return pending;
}
async function loadFooting(source,data){
    if(typeof DecompressionStream!=='function')return;
    const index=await footingIndex,range=index?.ranges?.[source];
    if(!range||range[0]!==data.gen)return;
    const [,start,size]=range,url=new URL('terrain-footing.bin?v='+index.hash,mediaBase);
    const response=await fetch(url,{headers:{Range:'bytes='+start+'-'+(start+size-1)}});
    if(!response.ok)return;
    let blob=await response.blob();
    if(response.status===200)blob=blob.slice(start,start+size);
    if(blob.size!==size)return;
    const bytes=new Uint8Array(await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    if(bytes.length===data.pages*data.per)return bytes;
}
function buildFooting(t, r) {
    const d = t.d, feet = r.pal.map(id => t.feet?t.feet[id]:readTileFeet(t.pages[Math.floor(id/d.per)],d)[id%d.per]);
    r.ground = new Uint8Array(r.f.length);
    for (let j = 0; j < r.f.length; j++) r.ground[j] = (feet[r.g[2*j]] | feet[r.g[2*j+1]]) & 64;
    for (let k = 0; k < r.fIdx.length; k++) {
        if (feet[r.fIdx[k]] & 64) r.ground[r.flatCell[k]] = 64;
    }
    r.walk = new Uint8Array(r.f.length);
    for (let j = 0; j < r.walk.length; j++) {
        // A canopy can cover a road. The native map owns its directional collision flags.
        if (r.ground[j]) r.walk[j] = r.f[j] & 3;
    }
    r.flatCell = null;
}
class World {
    static preloadDescriptor(id) {
        return mapDescriptor(msrc(id));
    }
    constructor() {
        this.map = null;      // { id, d, reg: [], pages: [] }
        this.maps = {};
        this.chunks = new Map();
        this.groundRevision = 0;
        this.missing = null;  // 這張圖沒有資料時的地圖編號
        // 站長 2026-11-05「黑畫面」（iPhone Safari 銀騎士村莊：NPC、人物都在，地面整片黑）：iOS 切到背景、記憶體吃緊時會把畫好的
        //   分塊畫布內容清掉（寬高還在、畫上去是透明＝底色黑），快取著的分塊不會自己重畫 → 回到前景時整批丟掉重畫，平常抽查（checkChunks）
        this.onShow = () => { if (!document.hidden) this.flushChunks(); };
        document.addEventListener('visibilitychange',this.onShow);
        addEventListener('pageshow',this.onShow);
    }
    dispose() {
        document.removeEventListener('visibilitychange',this.onShow);removeEventListener('pageshow',this.onShow);
        this.release();
    }
    flushChunks() {
        this.groundRevision++;
        for (const c of this.chunks.values()) freeCanvas(c);
        this.chunks.clear();
    }
    // 畫布被瀏覽器收回又還回來（main.js contextrestored）：只重畫分塊不夠——安卓 Firefox 收回時拼圖頁的圖也可能一起壞掉，拿壞的圖重畫一樣缺一格一格的菱形
    //   （站長 2026-11-08「地圖又扭曲了」：同一位玩家回報前有 contextlost、拼圖頁解不開）→ 目前這張圖的分區、拼圖頁全部放掉重抓（瀏覽器快取裡有，不會真的重新下載）
    reloadImages() {
        const t = this.map; if (!t) return;
        t.reg.forEach((r, i) => { if (r) { r.pages.forEach(k => this.freePage(t, k)); t.reg[i] = null; } });
        this.flushChunks();
    }
    // 每 3 秒抽一塊畫面上的分塊，看蓋好時記下的那一點還在不在（不在＝被系統清掉了）→ 全部重畫
    //   輪流抽（站長 2026-11-07 安卓 Firefox 玩家地圖一條條黑塊：原本每次都抽第一塊，被清掉的是別塊就永遠抓不到）
    checkChunks(now) {
        // 畫面上缺東西的分塊（畫的時候有拼圖頁不在）：隔 2 秒重畫一次，不必等哪一區剛載好
        if (!this._partAt || now - this._partAt > 2000) {
            this._partAt = now;
            for (const [k, c] of this.chunks) if (c.holes && c.used === this.frame && now - c.born > 2000) { freeCanvas(c); this.chunks.delete(k); this.groundRevision++; }
        }
        if (this._chkAt && now - this._chkAt < 3000) return;
        this._chkAt = now;
        const vis = [...this.chunks.values()].filter(c => c.probe && c.used === this.frame);
        if (!vis.length) return;
        const c = vis[(this._chkI = ((this._chkI || 0) + 1) % vis.length)];
        let a = 255;
        try { a = c.getContext('2d').getImageData(c.probe[0], c.probe[1], 1, 1).data[3]; } catch (e) { /* 讀不到就當正常 */ }
        if (a !== 0) return;
        // 整批重畫 30 秒最多一次，其餘只重畫抽到的那塊（站長 2026-11-08 玩家影片「龍之谷地監走動畫面跳動」：手機記憶體吃緊時整批重畫又把記憶體推上去，一直循環）
        console.warn('[world] 地圖分塊被系統清掉，重畫');
        if (!this._flushAt || now - this._flushAt > 30000) { this._flushAt = now; this.flushChunks(); return; }
        for (const [k, v] of this.chunks) if (v === c) { freeCanvas(c); this.chunks.delete(k); this.groundRevision++; break; }
    }

    // ── 地圖載入 ───────────────────────────────────
    setMap(id) {
        if (this.map && this.map.id === id) return Promise.resolve(this.map);
        this.release();
        this.missing = null;
        const t = this.meta(id);
        this.map = t;
        return t.p.catch(e => { if (this.map === t) this.missing = id; throw e; });
    }
    meta(id) {   // 地圖總表（setMap、preload 共用，只抓一次）
        // 只留最近用到的 MAPS_KEEP 張（目前這張一定留）：原本每張去過、預載過的地圖總表（大地圖幾 MB）一直留著
        const rc = this.recent || (this.recent = []), i = rc.indexOf(id);
        if (i !== 0) { if (i > 0) rc.splice(i, 1); rc.unshift(id); if (rc.length > MAPS_KEEP) rc.length = MAPS_KEEP; }
        for (const k of Object.keys(this.maps)) if (!rc.some(x => String(x) === k) && !(this.map && String(this.map.id) === k)) delete this.maps[k];
        const t = this.maps[id] || (this.maps[id] = { id, reg: [], pages: [], d: null });
        if (!t.p) t.p = mapDescriptor(msrc(id))
            .then(({data,footing}) => { t.d = data; t.footing=footing.then(bytes=>{t.feet=bytes;}); return t; })
            .catch(e => { t.p = null; throw e; });
        return t;
    }
    // 知道要去哪（狩獵場傳送：按下去到伺服器把人送過去之間）就先把目的地角色周圍的區檔、拼圖頁抓進瀏覽器快取，到了直接用
    //   r＝抓落點周圍幾格（預設 CORE；站長 2026-10-29「圖檔…為何還是會讀檔 沒事先讀嗎」：展開狩獵場卡片、滑鼠停在傳送點上就先抓，見 hud.js tpPreload）
    preload(id, x, y, r = CORE) {
        const t = this.meta(id);
        t.p.then(() => {
            const d = t.d, lx = x - d.gameX0, ly = y - d.gameY0, q = d.gen ? '?g=' + d.gen : '';
            for (let ry = Math.max(0, Math.floor((ly - r) / d.rs)); ry <= Math.min(d.rny - 1, Math.floor((ly + r) / d.rs)); ry++)
                for (let rx = Math.max(0, Math.floor((lx - r) / d.rs)); rx <= Math.min(d.rnx - 1, Math.floor((lx + r) / d.rs)); rx++) {
                    const i = ry * d.rnx + rx; if (d.regions[i] === -1 || (t.reg[i] && t.reg[i].ready)) continue;
                    fetch(terrainRoot + msrc(id) + '/r' + rx + '_' + ry + '.bin' + q).catch(() => {});
                    for (const k of d.regions[i]) if (!t.pages[k]) prefetch(pageUrl(id, k, d.gen));
                }
        }).catch(() => {});
    }
    coreBox(center) {   // 角色周圍（地圖內格子範圍）
        const d = this.map.d, lx = Math.round(center[0]) - d.gameX0, ly = Math.round(center[1]) - d.gameY0;
        return [lx - CORE, ly - CORE, lx + CORE, ly + CORE];
    }
    // 照順序要：角色周圍 → 畫面 → 外圍預載（前一圈到齊了才要下一圈）
    wantStaged(center, vb) {
        const c = this.coreBox(center);
        this.wantRegions(c[0], c[1], c[2], c[3]);
        if (!this.viewReady(c)) return;
        this.wantRegions(vb[0], vb[1], vb[2], vb[3]);
        if (this.viewReady(vb)) this.wantRegions(vb[0] - PREFETCH, vb[1] - PREFETCH, vb[2] + PREFETCH, vb[3] + PREFETCH);
    }
    release() {
        this.landingBox=null;
        if (!this.map) return;
        const t = this.map;
        t.reg.forEach((r, i) => { if (r) { r.pages.forEach(k => this.freePage(t, k)); t.reg[i] = null; } });
        for (const c of this.chunks.values()) freeCanvas(c);   // 換地圖：舊圖的分塊一次放掉（iPhone 畫布上限，見 freeCanvas）
        this.chunks.clear();
        this.map = null;
    }
    usePage(t, k) {
        let pg = t.pages[k];
        if (pg && pg.bad) pg = t.pages[k] = { refs: pg.refs, img: null };   // 上次載失敗的拼圖頁：重抓（引用數照舊）
        if (!pg || !pg.p) {
            if (!pg) pg = t.pages[k] = { refs: 0, img: null };
            pg.p = loadTileImage(pageUrl(t.id,k,t.d.gen),pageBytes(t,k)).then(img=>{
                if(t.pages[k]===pg)pg.img=img;
                else releaseTileImage(img);
            },error=>{pg.bad=true;throw error;});
        }
        pg.refs++;
        return pg.p;
    }
    freePage(t, k) {
        const pg = t.pages[k]; if (!pg || --pg.refs > 0) return;
        releaseTileImage(pg.img);
        t.pages[k] = null;
    }
    loadRegion(t, i) {
        const d = t.d, rx = i % d.rnx, ry = (i / d.rnx) | 0;
        const r = t.reg[i] = { i, x0: rx * d.rs, y0: ry * d.rs, ready: false, failed: false, pages: d.regions[i] };
        // Page requests start before the region bytes arrive. The region still checks and reports failures below.
        r.pages.forEach(k => this.usePage(t, k).catch(() => {}));
        r.loading=fetch(terrainRoot + msrc(t.id) + '/r' + rx + '_' + ry + '.bin' + (d.gen ? '?g=' + d.gen : '')).then(res => { if (!res.ok) throw new Error(res.status); return res.arrayBuffer(); })
            .then(buf => { unpackRegion(d, r, buf); return Promise.all([t.footing,...r.pages.map(k => t.pages[k]?.p)]); })
            .then(() => {
                if (t.reg[i] !== r) return;
                buildFooting(t, r);
                r.ready = true;this.groundRevision++;
                for (const [k, c] of this.chunks) if (c.partial) { freeCanvas(c); this.chunks.delete(k); }   // 缺這區畫的分塊重畫
            })
            .catch(e => {
                console.warn('[world] 地圖分區載入失敗', t.id, rx, ry, '第' + (r.tries || 1) + '次', e); r.failed = true; r.failAt = performance.now();
                // 回報（errlog.js；同一張地圖一頁只報一次）：拼圖頁載不進來是 Event（img onerror），區檔是 Error
                if (window.L1WEB_REPORT) L1WEB_REPORT('地圖分區載入失敗：' + ((e && e.message) || (e && e.type) || e), '/js/world.js map=' + t.id, 'r' + rx + '_' + ry + ' 第' + (r.tries || 1) + '次；分塊 ' + this.chunks.size + '；' + (window.L1WEB_DEV ? L1WEB_DEV() : ''));
            });
        return r;
    }
    wantRegions(x0, y0, x1, y1) {
        const t = this.map, d = t.d;
        for (let ry = Math.max(0, Math.floor(y0 / d.rs)); ry <= Math.min(d.rny - 1, Math.floor(y1 / d.rs)); ry++)
            for (let rx = Math.max(0, Math.floor(x0 / d.rs)); rx <= Math.min(d.rnx - 1, Math.floor(x1 / d.rs)); rx++) {
                const i = ry * d.rnx + rx; if (d.regions[i] === -1) continue;
                const r = t.reg[i], n = (r && r.tries) || 1;
                if (r && r.failed && performance.now() - r.failAt > Math.min(n < 10 ? 10000 : 30000, 1500 * n)) {   // 載入失敗的：隔一下重抓（手機網路瞬斷）；站長 2026-11-07 黑畫面：原本 10 次就放棄、一直黑到重新整理 → 還在畫面內就一直試（10 次之後慢慢拉到 30 秒一次，一次要抓很多拼圖頁）
                    t.reg[i] = null; r.pages.forEach(k => this.freePage(t, k)); this.loadRegion(t, i).tries = n + 1; continue;
                }
                if (!r) this.loadRegion(t, i);
            }
    }
    dropRegions(x0, y0, x1, y1) {
        const t = this.map, d = t.d;
        t.reg.forEach((r, i) => {
            if (!r) return;
            if (r.x0 + d.rs - 1 >= x0 && r.x0 <= x1 && r.y0 + d.rs - 1 >= y0 && r.y0 <= y1) return;
            const box=this.landingBox;
            if(box && r.x0+d.rs-1>=box[0] && r.y0+d.rs-1>=box[1] && r.x0<=box[2] && r.y0<=box[3])return;
            t.reg[i] = null;
            r.pages.forEach(k => this.freePage(t, k));
        });
    }
    async loadLandingBox(box) {
        const map=this.map,d=map.d,waiting=[];
        this.landingBox=box;
        this.wantRegions(...box);
        for(let ry=Math.max(0,Math.floor(box[1]/d.rs));ry<=Math.min(d.rny-1,Math.floor(box[3]/d.rs));ry++){
            for(let rx=Math.max(0,Math.floor(box[0]/d.rs));rx<=Math.min(d.rnx-1,Math.floor(box[2]/d.rs));rx++){
                const region=map.reg[ry*d.rnx+rx];
                if(region&&!region.ready)waiting.push(region.loading);
            }
        }
        await Promise.all(waiting);
        return this.map===map && this.viewReady(box,true);
    }
    get ready() { return !!(this.map && this.map.d); }
    viewReady(vb, requireLoaded = false) {
        const t = this.map, d = t.d;
        for (let ry = Math.max(0, Math.floor(vb[1] / d.rs)); ry <= Math.min(d.rny - 1, Math.floor(vb[3] / d.rs)); ry++)
            for (let rx = Math.max(0, Math.floor(vb[0] / d.rs)); rx <= Math.min(d.rnx - 1, Math.floor(vb[2] / d.rs)); rx++) {
                const i = ry * d.rnx + rx, r = t.reg[i];
                if (d.regions[i] !== -1 && !(r && (r.ready || (!requireLoaded && r.failed)))) return false;
            }
        return true;
    }

    // ── 能不能走（照 L1J L1V1Map.isPassable：bit0 往 x+1 的邊能過、bit1 往 y−1 的邊能過）──
    //   lx,ly＝地圖內格子；還沒載的區當牆
    flags(lx, ly) {
        const t = this.map; if (!t || !t.d) return 0;
        const d = t.d;
        if (lx < 1 || ly < 1 || lx >= d.cw - 1 || ly >= d.ch - 1) return 0;
        const r = t.reg[Math.floor(ly / d.rs) * d.rnx + Math.floor(lx / d.rs)];
        return (r && r.ready) ? r.f[(ly - r.y0) * d.rs + lx - r.x0] : 0;
    }
    regionAt(lx, ly) {
        const t = this.map, d = t?.d;
        if (!d || lx < 1 || ly < 1 || lx >= d.cw-1 || ly >= d.ch-1) return null;
        return t.reg[Math.floor(ly/d.rs)*d.rnx + Math.floor(lx/d.rs)];
    }
    pass(lx, ly) {
        const r = this.regionAt(lx, ly);
        if (!r?.ready) return 0;
        const index=(ly-r.y0)*this.map.d.rs+lx-r.x0;
        // Native room paths pass beneath cave overhangs. A foreground sprite is not a collision wall.
        return r.walk[index] || (this.bossCorridor?.has((lx+this.map.d.gameX0)+','+(ly+this.map.d.gameY0)) ? r.f[index]&3 : 0);
    }
    hasGround(lx, ly) {
        const r = this.regionAt(lx, ly);
        return !!(r?.ready && r.ground[(ly-r.y0)*this.map.d.rs+lx-r.x0]);
    }
    // 站長 2026-11-03「射箭跟怪物的直線距離上有牆壁攻擊就不成立」：箭能不能從 (x,y) 往方向 h 飛一格（照 L1V1Map.isArrowPassable：箭用 0x04／0x08 那兩個位元，跟走路的 0x01／0x02 不同）
    arrowStep(x, y, h) {
        const d = this.map && this.map.d; if (!d) return false;
        // 舊的地圖資料沒存箭的位元（tools/gen-map.mjs 原本只留 0x03）：整張圖都沒有就退回用走路的判斷
        if (this.map._arrow == null) { let any = false; for (const r of this.map.reg || []) if (r && r.ready && r.f) { for (let i = 0; i < r.f.length; i += 7) if (r.f[i] & 12) { any = true; break; } if (any) break; } if (any || (this.map.reg || []).some(r => r && r.ready)) this.map._arrow = any; }
        if (!this.map._arrow) return this.canStep(x, y, h, null, true);   // 箭不管萬物百貨商旁邊那圈（noEnter 只管人走）
        const lx = x - d.gameX0, ly = y - d.gameY0, f = (a, b) => this.flags(a, b);
        const DXs=stepX,DYs=stepY, t2 = f(lx + DXs[h], ly + DYs[h]), t1 = f(lx, ly);
        switch (h) {
            case 0: return !!(t1 & 8);
            case 1: return !!((f(lx, ly - 1) & 4) || (f(lx + 1, ly) & 8));
            case 2: return !!(t1 & 4);
            case 3: return !!(f(lx, ly + 1) & 4);
            case 4: return !!(t2 & 8);
            case 5: return !!(t2 & 12);
            case 6: return !!(t2 & 4);
            default: return !!(f(lx - 1, ly) & 8);
        }
    }
    // 遊戲座標 (x,y) 往方向 h 走一步行不行；occupied(x,y) 回 true＝那格有人
    //   noZone＝不管 noEnter（箭用）。noEnter(fx, fy, tx, ty)：main.js 給，回 true＝這一步不准走（伺服器第 757 項：萬物百貨商 5 格內不能走進去）
    canStep(x, y, h, occupied, noZone) {
        const d = this.map && this.map.d; if (!d) return false;
        const DXs=stepX,DYs=stepY;
        const lx=x-d.gameX0,ly=y-d.gameY0,dx=DXs[h],dy=DYs[h];
        if(lx<0||ly<0||lx>=d.cw||ly>=d.ch)return false;
        if(this.edgesRevision!==this.groundRevision||this.edgesMap!==this.map||this.edgesCorridor!==this.bossCorridor){
            this.edges=new Map();this.edgesRevision=this.groundRevision;this.edgesMap=this.map;this.edgesCorridor=this.bossCorridor;
        }
        const cell=ly*d.cw+lx,bit=1<<h,known=bit<<8,mask=this.edges.get(cell)||0;
        if(!(mask&known)){
            const open=this.pass(lx+dx,ly+dy)&&(!dx||!dy||this.pass(lx+dx,ly)||this.pass(lx,ly+dy))&&this.nativeStep(x,y,h);
            if(this.edges.size>=65536)this.edges.clear();
            this.edges.set(cell,mask|known|(open?bit:0));if(!open)return false;
        }else if(!(mask&bit))return false;
        return (noZone||!this.noEnter||!this.noEnter(x,y,x+dx,y+dy))&&(!occupied||!occupied(x+dx,y+dy));
    }
    nativeStep(x,y,h) {
        const d=this.map.d, lx=x-d.gameX0, ly=y-d.gameY0;
        const DXs=stepX,DYs=stepY;
        const nx = lx + DXs[h], ny = ly + DYs[h];
        const p = (a,b) => this.flags(a,b) & 3;
        if (!p(nx,ny)) return false;
        switch (h) {
            case 0: return !!(p(lx, ly) & 2);
            case 1: return !!((p(lx, ly - 1) & 1) || (p(lx + 1, ly) & 2));
            case 2: return !!(p(lx, ly) & 1);
            case 3: return !!(p(lx, ly + 1) & 1);
            case 4: return !!(p(nx, ny) & 2);
            case 5: return true;
            case 6: return !!(p(nx, ny) & 1);
            default: return !!(p(lx - 1, ly) & 2);
        }
    }
    safeZone(x, y) { const d = this.map && this.map.d; return d ? (this.flags(x - d.gameX0, y - d.gameY0) & 0x30) === 0x10 : false; }

    // ── 畫 ────────────────────────────────────────
    worldPos(fx, fy) {   // 遊戲座標（可帶小數）→ 世界像素
        const d = this.map.d, lx = fx - d.gameX0, ly = fy - d.gameY0;
        return [24 * (lx + ly) + d.ox, 12 * (ly - lx) + d.oy];
    }
    // 畫面像素 → 遊戲座標（取最近的格子）
    screenToCell(px, py, cam) {
        const d = this.map.d, wx = px + cam[0] - d.ox, wy = py + cam[1] - d.oy;
        const s = wx / 24, dd = wy / 12;   // s = lx+ly, dd = ly−lx
        return [Math.round((s - dd) / 2) + d.gameX0, Math.round((s + dd) / 2) + d.gameY0];
    }
    blit(c, r, idx, dx, dy) {
        const d = this.map.d, g = r.pal[idx], pg = this.map.pages[(g / d.per) | 0], im = pg && pg.img;
        if (!im) return false;
        const s = g % d.per;
        c.drawImage(im, (s % d.cols) * d.cellW + 1, ((s / d.cols) | 0) * d.cellH + 1, BW, BH, dx, dy, BW, BH);
        return true;
    }
    buildChunk(ci, cj) {
        const t = this.map, d = t.d, cs = d.cs;
        const c = document.createElement('canvas'); c.width = cs; c.height = cs;
        const x = c.getContext('2d'), X0 = ci * cs, Y0 = cj * cs;
        if (!x) return null;   // 畫布用光了（iPhone 上限）：這幀先不畫這塊，下一幀再試
        let partial = false, holes = false;   // partial：有區還沒到（到了會重畫）；holes：區到了但拼圖頁不在（隔 2 秒重畫）
        const sMin = Math.floor((X0 - d.ox - 48) / 24), sMax = Math.ceil((X0 + cs - d.ox + 24) / 24);
        const dMin = Math.floor((Y0 - d.oy - 12) / 12), dMax = Math.ceil((Y0 + cs - d.oy + 11) / 12);
        for (let dd = dMin; dd <= dMax; dd++) for (let s = sMin; s <= sMax; s++) {
            if ((s + dd) & 1) continue;
            const lx = (s - dd) / 2, ly = (s + dd) / 2;
            if (lx < 0 || ly < 0 || lx >= d.cw || ly >= d.ch) continue;
            const ri = Math.floor(ly / d.rs) * d.rnx + Math.floor(lx / d.rs), r = t.reg[ri];
            if (!r || !r.ready) { if (d.regions[ri] !== -1) partial = true; continue; }   // 載入失敗的也算缺（會重試，到了要重畫）
            const wx = 24 * s + d.ox - X0, wy = 12 * dd + d.oy - 11 - Y0, gi = ((ly - r.y0) * d.rs + lx - r.x0) * 2;
            // 拼圖頁不在（被放掉、還在重抓）：原本靜靜跳過＝那格一直是黑的菱形（站長 2026-11-08「地圖又扭曲了」）→ 記成缺，之後重畫
            if (!this.blit(x, r, r.g[gi], wx - 24, wy)) holes = true;
            if (!this.blit(x, r, r.g[gi + 1], wx, wy)) holes = true;
        }
        const b = cj * d.cx + ci, list = [];
        t.reg.forEach(rr => { const fb = rr && rr.ready && rr.fBy[b]; if (fb) for (const k of fb) list.push([rr, k]); });
        list.sort((p, q) => p[0].fOrd[p[1]] - q[0].fOrd[q[1]]);
        for (const [o, k] of list) if (!this.blit(x, o, o.fIdx[k], o.fX[k] - X0, o.fY[k] - Y0)) holes = true;
        c.partial = partial; c.holes = holes; c.born = performance.now();
        // 記一點確定有畫到的（正中間 16×16 裡找不透明的；整塊讀回來在 iPhone 太貴），給 checkChunks 對；正中間是空地就不記
        try {
            const h = cs >> 1, im = x.getImageData(h - 8, h - 8, 16, 16).data;
            for (let p = 0; p < 256; p++) if (im[p * 4 + 3] === 255) { c.probe = [h - 8 + (p & 15), h - 8 + (p >> 4)]; break; }
        } catch (e) { /* 讀不到就不記 */ }
        return c;
    }
    viewBox(cam, W, H, pad) {
        const d = this.map.d, s0 = (cam[0] - d.ox - 48) / 24, s1 = (cam[0] + W - d.ox + 24) / 24, d0 = (cam[1] - d.oy - 12) / 12, d1 = (cam[1] + H - d.oy + 12) / 12;
        return [Math.floor((s0 - d1) / 2) - pad, Math.floor((s0 + d0) / 2) - pad, Math.ceil((s1 - d0) / 2) + pad, Math.ceil((s1 + d1) / 2) + pad];
    }

    // 相機：中心點（自己）的世界像素先取整、再減掉畫面上要落的那點（也取整）。原本是相減以後才取整：畫面高、寬是奇數或 sy 帶小數時，
    //   自己走路中（座標帶小數）取整的時機跟 drawActor／drawLabel 的取整錯開半格 → 自己（連同頭上名字、血條）在畫面上一下上一下下跳 1 點
    //   （站長 2026-10-24「走路時候 id 會晃動」）。先各自取整＝自己永遠落在同一個整數點，相機跟地圖照樣每點都跟上
    camFor(center, W, H, opts) {
        const cw = this.worldPos(center[0], center[1]);
        return [Math.round(cw[0]) - Math.round(opts.sx != null ? opts.sx : W / 2), Math.round(cw[1]) - Math.round(opts.sy != null ? opts.sy : H / 2)];
    }
    // 換地圖進度條（maploading.js）：畫面內的地圖分區（.bin＋拼圖頁）、角色的圖到了幾個 → { need, done }；地圖總表還沒到回 null。
    //   畫面蓋著不畫的時候也要把這些叫來下載，所以跟 draw 一樣先 wantRegions、每個角色問一次 frameFor。
    //   frameNow＝固定的時間點（開始換圖那一刻）：待機動畫照時間換幀，網路慢時每幀的圖還沒到就換下一幀、永遠等不齊 → 等待中每隻只等一張；
    //   等到的那張記成 _last（drawActor 下一幀圖還沒到時先畫它，不會變回影子圈）
    //   只等角色周圍（coreBox）：先要、先到，到了就進場；畫面其他地方、外圍由 draw 照順序接著要（wantStaged）
    prepare(W, H, center, actors, frameNow, opts = {}) {
        if (!this.ready) return null;
        const t = this.map, d = t.d, cam = this.camFor(center, W, H, opts), vb = this.viewBox(cam, W, H, 0), c = this.coreBox(center);
        if(opts.arrival){
            this.wantRegions(...c);
            // Queue the rest of the visible entrance while the core's image pages decode.
            this.wantRegions(...vb);
        }
        else this.wantStaged(center,vb);
        let need = 0, done = 0, failed = false;
        // 站長 2026-11-03「傳送地圖時候會有一瞬間看到黑地圖然後慢慢載入」：原本只等人物周圍（coreBox）那幾塊就進場，畫面其他分區進場後才到＝黑一塊一塊冒出來
        //   → 分區等整個畫面（viewBox）的；角色的圖照舊只等周圍的。上限照舊 3 秒（maploading.js MAX_MS），時間到沒載完一樣直接進
        for (let ry = Math.max(0, Math.floor(vb[1] / d.rs)); ry <= Math.min(d.rny - 1, Math.floor(vb[3] / d.rs)); ry++)
            for (let rx = Math.max(0, Math.floor(vb[0] / d.rs)); rx <= Math.min(d.rnx - 1, Math.floor(vb[2] / d.rs)); rx++) {
                const i = ry * d.rnx + rx, r = t.reg[i]; if (d.regions[i] === -1) continue;
                const pages = d.regions[i];
                need += 1 + pages.length;
                if (r && r.failed) failed = true;
                if (r && r.ready) done += 1 + pages.length;
                else if (r) done += (r.f ? 1 : 0) + pages.filter(k => t.pages[k] && t.pages[k].img).length;
            }
        return {need, done, failed};
    }
    draw(ctx, W, H, center, actors, now, opts = {}) {
        ctx.fillStyle = '#05080c'; ctx.fillRect(0, 0, W, H);
        if (!this.ready) return null;
        const t = this.map, d = t.d;
        const cam = this.camFor(center, W, H, opts);
        const vb = this.viewBox(cam, W, H, 0), gx0 = d.gameX0, gy0 = d.gameY0;
        // 剛傳送、等滿 3 秒先進來：角色周圍 → 畫面 → 外圍，前一圈到齊才要下一圈，免得互相搶頻寬
        this.wantStaged(center, vb);
        if (!this._dropAt || now - this._dropAt > 2000) { this._dropAt = now; this.dropRegions(vb[0] - KEEP, vb[1] - KEEP, vb[2] + KEEP, vb[3] + KEEP); }
        this.frame = (this.frame || 0) + 1;
        const i0 = Math.max(0, Math.floor(cam[0] / d.cs)), i1 = Math.min(d.cx - 1, Math.floor((cam[0] + W) / d.cs));
        const j0 = Math.max(0, Math.floor(cam[1] / d.cs)), j1 = Math.min(d.cy - 1, Math.floor((cam[1] + H) / d.cs));
        // 地面塊的四邊對齊到整數「畫布像素」再畫（站長 2026-10-19 截圖「有線條」）：4:3 舞台放大 1.498 這種不是整數的倍率，
        //   塊的邊落在半個像素上，瀏覽器把邊緣畫成半透明，相鄰兩塊中間透出底色＝一條細線。改成照目前的縮放（畫布像素／世界像素）
        //   算出每塊左右上下在畫布上的整數位置，相鄰兩塊共用同一條邊，暫時換成 1:1 座標畫，畫完換回來
        const m = ctx.getTransform(), S = m.a, chunkPx = v => Math.round(v * S);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (let cj = j0; cj <= j1; cj++) for (let ci = i0; ci <= i1; ci++) {
            const key = cj * d.cx + ci;
            let ch = this.chunks.get(key);
            if (!ch) { ch = this.buildChunk(ci, cj); if (!ch) continue; this.chunks.set(key, ch); }
            ch.used = this.frame;
            const x0 = chunkPx(ci * d.cs - cam[0]), y0 = chunkPx(cj * d.cs - cam[1]);
            ctx.drawImage(ch, x0, y0, chunkPx((ci + 1) * d.cs - cam[0]) - x0, chunkPx((cj + 1) * d.cs - cam[1]) - y0);
        }
        ctx.setTransform(m);
        this.checkChunks(now);
        if (this.chunks.size > CHUNK_MAX) {
            const old = [...this.chunks.entries()].filter(e => e[1].used !== this.frame).sort((p, q) => p[1].used - q[1].used);
            for (let k = 0; k < old.length && this.chunks.size > CHUNK_MAX; k++) { freeCanvas(old[k][1]); this.chunks.delete(old[k][0]); }
        }
        const vis = [];
        const bi0 = Math.max(0, Math.floor((cam[0] - BW) / d.cs)), bj0 = Math.max(0, Math.floor((cam[1] - BH) / d.cs));
        t.reg.forEach(r => {
            if (!r || !r.ready) return;
            for (let cj = bj0; cj <= j1; cj++) for (let ci = bi0; ci <= i1; ci++) {
                const tb = r.tBy[cj * d.cx + ci]; if (!tb) continue;
                for (const k of tb) {
                    const x = r.tX[k] - cam[0], y = r.tY[k] - cam[1];
                    if (x > -BW && y > -BH && x < W && y < H) vis.push({ r, k, s: r.tSeq[k] });
                }
            }
        });
        vis.sort((p, q) => p.s - q.s);
        const bins=new Map();
        for (const item of vis) {
            const {r,k}=item,x=r.tX[k],y=r.tY[k],key=(x>>6)+','+(y>>6);
            this.blit(ctx,r,r.tIdx[k],x-cam[0],y-cam[1]);
            let group=bins.get(key);
            if(!group){group=[];bins.set(key,group);}
            group.push(item);
        }
        this.foreground=bins;
        return cam;
    }
    findPath(sx, sy, gx, gy, occupied, pad = 24) { const r = this.astar(sx, sy, gx, gy, occupied, pad, false); return r && r.path; }
    walkRoute(start, goal, occupied) {
        const d = this.map?.d;
        if (!d) return null;
        let next = goal, loading = false;
        if (d.regions) {
            const dx = goal[0] - start[0], dy = goal[1] - start[1];
            const distance = Math.max(Math.abs(dx), Math.abs(dy));
            if (distance > KEEP) {
                next = [start[0] + Math.round(dx * KEEP / distance), start[1] + Math.round(dy * KEEP / distance)];
            }
            const box = [Math.min(start[0], next[0])-d.gameX0-3, Math.min(start[1], next[1])-d.gameY0-3,
                         Math.max(start[0], next[0])-d.gameX0+3, Math.max(start[1], next[1])-d.gameY0+3];
            loading = !this.viewReady(box, true);
            if (loading) this.wantRegions(...box);
        }
        const clear = occupied && !occupied(...next) && this.findPath(...start, ...next, occupied);
        const near = clear ? {path:clear, to:next} : this.findPathNear(...start, ...next);
        if (!near) return null;
        // Keep the original click while the next region streams or a longer journey advances.
        // Only snap a finished route to a genuine physical obstruction.
        if (loading || (next !== goal && near.path.length)) return {path:near.path, to:goal};
        return near;
    }
    // 點地面用（站長 2026-10-23「點走不過去的位置人物就不動了」）：點的格子走得到＝同 findPath；
    //   點在牆、柱子、水上，或那邊跟這邊不連通（或繞太遠、超過搜尋上限）＝改走到「搜過的格子裡離點的位置最近」那格
    //   （A* 本來就往點的方向先搜，搜到的最近格＝點擊點旁邊走得到的格子；整個不連通時＝往那個方向走得到的最遠處）
    //   點的格子能站、但近的範圍裡繞不過去（要繞大圈）：範圍放大、上限放寬再找一次，找到就繞過去
    //   回傳 { path, to:[x,y] }；起點本身就是最近（已經貼著牆）回 path 空陣列
    // 11-27 Ping：wide=false 時到不了就直接用「最接近的那格」，不再放大範圍重找一次（那一次最多要搜兩萬格，怪物追擊被人牆擋住時每隻每輪都會跑到）
    findPathNear(sx, sy, gx, gy, occupied, pad = 24, wide = true) {
        const r = this.astar(sx, sy, gx, gy, occupied, pad, true);
        if (!wide) return r;
        const d = this.map && this.map.d;
        if (!r || (r.to[0] === gx && r.to[1] === gy) || !d || !this.pass(gx - d.gameX0, gy - d.gameY0) || (this.noEnter && this.noEnter(gx, gy, gx, gy))) return r;   // 點在萬物百貨商那圈裡：走到圈邊就好，不再大範圍找
        const r2 = this.astar(sx, sy, gx, gy, occupied, 64, true, 20000);
        return r2 && r2.to[0] === gx && r2.to[1] === gy ? r2 : r;
    }
    astar(sx, sy, gx, gy, occupied, pad, near, budget = 6000) {
        const d = this.map && this.map.d; if (!d) return null;
        if (sx === gx && sy === gy) return { path: [], to: [gx, gy] };
        const X0 = Math.min(sx, gx) - pad, Y0 = Math.min(sy, gy) - pad, W = Math.abs(gx - sx) + 2 * pad + 1, H = Math.abs(gy - sy) + 2 * pad + 1;
        const N = W * H, gs = new Float32Array(N).fill(Infinity), from = new Int8Array(N).fill(-1), closed = new Uint8Array(N);
        const idx = (x, y) => (y - Y0) * W + (x - X0);
        const hh = (x, y) => Math.max(Math.abs(x - gx), Math.abs(y - gy));
        const heap = [], hf = [];
        const push = (i, f) => { heap.push(i); hf.push(f); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; [hf[p], hf[k]] = [hf[k], hf[p]]; k = p; } };
        const pop = () => { const top = heap[0], lt = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = lt; hf[0] = lf; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && hf[l] < hf[m]) m = l; if (r < heap.length && hf[r] < hf[m]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; [hf[m], hf[k]] = [hf[k], hf[m]]; k = m; } } return top; };
        const DXs=stepX,DYs=stepY;
        const s = idx(sx, sy); gs[s] = 0; push(s, hh(sx, sy));
        const back = i => {
            const path = []; let c = i;
            while (c !== s) { const h = from[c]; path.push(h); c = idx((c % W + X0) - DXs[h], (((c / W) | 0) + Y0) - DYs[h]); }
            return { path: path.reverse(), to: [i % W + X0, ((i / W) | 0) + Y0] };
        };
        // 離點擊點多近：直線距離的近似（長邊＋短邊×0.41），一樣近挑路短的
        const far = (x, y) => { const a = Math.abs(x - gx), b = Math.abs(y - gy); return Math.max(a, b) + 0.41 * Math.min(a, b); };
        let best = s, bestF = far(sx, sy), bestG = 0;
        while (heap.length && budget-- > 0) {
            const i = pop(); if (closed[i]) continue; closed[i] = 1;
            const x = i % W + X0, y = ((i / W) | 0) + Y0;
            if (x === gx && y === gy) return back(i);
            if (near) { const f = far(x, y); if (f < bestF - 1e-6 || (f < bestF + 1e-6 && gs[i] < bestG)) { best = i; bestF = f; bestG = gs[i]; } }
            for (let h = 0; h < 8; h++) {
                const nx = x + DXs[h], ny = y + DYs[h];
                if (nx < X0 || ny < Y0 || nx >= X0 + W || ny >= Y0 + H) continue;
                const j = idx(nx, ny); if (closed[j]) continue;
                const last = nx === gx && ny === gy;
                if (!this.canStep(x, y, h, last ? null : occupied)) continue;
                const ng = gs[i] + (h & 1 ? 1.0001 : 1);
                if (ng < gs[j]) { gs[j] = ng; from[j] = h; push(j, ng + hh(nx, ny)); }
            }
        }
        return near ? back(best) : null;
    }
}

function unpackRegion(d, r, buf) {
    let o = 0;
    const rs = d.rs;
    const take = (T, n, sz) => { const a = new T(buf, o, n); o += (n * sz + 3) & ~3; return a; };
    const head = take(Uint32Array, 3, 4), nP = head[0], nF = head[1], nT = head[2];
    r.pal = take(Uint32Array, nP, 4); r.g = take(Uint16Array, rs * rs * 2, 2); r.f = take(Uint8Array, rs * rs, 1);
    r.fIdx = take(Uint16Array, nF, 2); const fHx = take(Uint16Array, nF, 2), fGy = take(Uint16Array, nF, 2); r.fOrd = take(Uint32Array, nF, 4);
    r.tIdx = take(Uint16Array, nT, 2); const tHx = take(Uint16Array, nT, 2), tGy = take(Uint16Array, nT, 2); r.tLy = take(Uint8Array, nT, 1); r.tSeq = take(Uint32Array, nT, 4);
    const pos = (hx, gy, X, Y, k) => {
        const h = hx - d.off, ly = gy - d.off, lx = h >> 1;
        X[k] = 24 * (lx + ly) - (h & 1 ? 0 : 24) + d.ox; Y[k] = 12 * (ly - lx) - 11 + d.oy;
        return [lx, ly];
    };
    r.fX = new Int32Array(nF); r.fY = new Int32Array(nF); r.fBy = {};
    r.flatCell = new Uint16Array(nF);
    for (let k = 0; k < nF; k++) {
        const [x,y] = pos(fHx[k], fGy[k], r.fX, r.fY, k);
        r.flatCell[k] = (y-r.y0)*rs+x-r.x0;
        for (let cj = Math.max(0, Math.floor(r.fY[k] / d.cs)); cj <= Math.min(d.cy - 1, Math.floor((r.fY[k] + BH - 1) / d.cs)); cj++)
            for (let ci = Math.max(0, Math.floor(r.fX[k] / d.cs)); ci <= Math.min(d.cx - 1, Math.floor((r.fX[k] + BW - 1) / d.cs)); ci++) {
                const b = cj * d.cx + ci; (r.fBy[b] || (r.fBy[b] = [])).push(k);
            }
    }
    r.tX = new Int32Array(nT); r.tY = new Int32Array(nT); r.tKey = new Int32Array(nT); r.tBy = {};
    for (let k = 0; k < nT; k++) {
        const c = pos(tHx[k], tGy[k], r.tX, r.tY, k);
        r.tKey[k] = 4 * (c[1] - c[0]) + r.tLy[k];
        const b = Math.min(d.cy - 1, Math.max(0, Math.floor(r.tY[k] / d.cs))) * d.cx + Math.min(d.cx - 1, Math.max(0, Math.floor(r.tX[k] / d.cs)));
        (r.tBy[b] || (r.tBy[b] = [])).push(k);
    }
}

Object.assign(window.AFK_DIMENSION_VIEW, {World});
})();
