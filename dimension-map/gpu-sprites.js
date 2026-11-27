'use strict';
// 11-28 Ping：自由走動的角色、怪物、寵物與遮蔽改由一張 WebGL 畫布統一繪製（PixiJS）。
// 原本每個角色是一組網頁圖片與小畫布，人多怪多時，每一張小畫布重畫都要跟 GPU 同步（實測每次 0.5～1 毫秒、每秒上百次）。
// 做法：網頁元素照舊負責版面、點選、名稱與動畫切換，只是把圖片設成看不見；每幀依它們的實際位置，
// 在一張畫布上一次畫完。WebGL 不能用、建立失敗或畫布遺失時，自動退回原本的網頁繪製。
// 關閉：localStorage 'giran.gpu.v1' 設成 '0'。
(() => {
  const W = window;
  const KEY = 'giran.gpu.v1';
  let wanted = true;
  try { wanted = localStorage.getItem(KEY) !== '0'; } catch {}
  const mobile = () => !!W.GiranPartyView?.mobile?.();

  let renderer = null, stage = null, canvas = null, host = null;
  let state = 'idle';            // idle → starting → ready；failed 之後不再嘗試
  let active = false;
  const textures = new Map();    // key → {tex, used, ver}
  const temporary = [];          // 這一幀才用的裁切貼圖
  const sprites = [];
  const outlines = new Map();    // 顏色 → OutlineFilter
  const styles = new WeakMap();
  const matrices = new Map();
  let frameNo = 0, lastError = '';
  const stats = { items: 0, uploads: 0, evicted: 0, ms: 0, frames: 0, measure: 0, render: 0 };

  const style = el => { let s = styles.get(el); if (!s) { s = getComputedStyle(el); styles.set(el, s); } return s; };
  // transform 字串 → [x 方向縮放, 是否左右翻轉]
  function parseTransform(t) {
    if (!t || t === 'none') return [1, 1];
    let m = matrices.get(t);
    if (m) return m;
    const n = t.match(/-?[\d.]+(?:e-?\d+)?/g)?.map(Number) || [];
    let a = 1, b = 0;
    if (t.startsWith('matrix3d')) { a = n[0] ?? 1; b = n[1] ?? 0; }
    else if (t.startsWith('matrix')) { a = n[0] ?? 1; b = n[1] ?? 0; }
    m = [Math.hypot(a, b) || 1, a < 0 ? -1 : 1];
    if (matrices.size > 2000) matrices.clear();
    matrices.set(t, m);
    return m;
  }
  function parseScale(s) {
    if (!s || s === 'none') return [1, 1];
    const n = s.split(/\s+/).map(Number);
    const x = Number.isFinite(n[0]) ? n[0] : 1;
    return [Math.abs(x) || 1, x < 0 ? -1 : 1];
  }
  const capacity = () => mobile() ? 600 : 2500;
  const resolution = scale => Math.max(1, Math.min((W.devicePixelRatio || 1) * scale, mobile() ? 1.5 : 2));

  function fail(error) {
    lastError = String(error?.message || error);
    state = 'failed';
    deactivate();
    try { W.GiranDiagnostics?.record('gpu', lastError); } catch {}
  }

  async function start(field) {
    const P = W.GiranPixi;
    if (!P) throw Error('PixiJS 沒有載入');
    canvas = document.createElement('canvas');
    canvas.className = 'dm-gpu-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fail('WebGL 畫布遺失'); });
    field.append(canvas);
    const r = new P.WebGLRenderer();
    await r.init({
      canvas, width: Math.max(1, field.clientWidth), height: Math.max(1, field.clientHeight),
      resolution: resolution(1), autoDensity: false, backgroundAlpha: 0, antialias: false,
      powerPreference: 'low-power', textureGCActive: false, preference: 'webgl', hello: false
    });
    renderer = r;
    stage = new P.Container();
    host = field;
  }

  function deactivate() {
    if (!active && !host) return;
    active = false;
    const field = host || document.getElementById('battle-view');
    field?.classList.remove('dm-gpu');
    // 走路圖在 GPU 繪製期間沒有畫進小畫布，退回網頁繪製時補畫。
    for (const c of field?.querySelectorAll('.dm-stride canvas') || []) {
      if (!c.dmPending || !c.dmImage) continue;
      try { const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.drawImage(c.dmImage, 0, 0); } catch {}
      c.dmPending = false;
    }
    if (state === 'failed') {
      for (const { tex } of textures.values()) try { tex.destroy(true); } catch {}
      textures.clear();
      try { renderer?.destroy(); } catch {}
      renderer = null; stage = null;
      canvas?.remove(); canvas = null;
    }
  }

  // 圖片先在背景解碼成點陣圖（createImageBitmap，不佔主執行緒）再上傳；還沒好的這一兩幀，畫同一個位置上一張圖。
  const decoding = new Set();
  const fresh = [];
  function texture(source, pixel) {
    const P = W.GiranPixi;
    let key = source, version = 0;
    const isImage = source instanceof HTMLImageElement;
    // 動畫切格會換成新的 blob 網址（#giran-frame= 後面是原圖路徑），用原圖路徑當鍵，同一格不重複上傳。
    if (isImage) { key = source.currentSrc || source.src; if (key.startsWith('blob:') && W.__afkFrameSource) key = W.__afkFrameSource(key); }
    else if (source instanceof HTMLCanvasElement) version = source.__gpuVer | 0;
    let entry = textures.get(key);
    if (entry && entry.ver !== version) {
      entry.tex.source.update();
      entry.ver = version;
      stats.uploads++;
    }
    if (!entry) {
      if (isImage) {
        if (!decoding.has(key) && decoding.size < 48) {
          decoding.add(key);
          createImageBitmap(source).then(bitmap => {
            decoding.delete(key);
            if (state !== 'ready' || textures.has(key)) { bitmap.close(); return; }
            const src = new P.ImageSource({ resource: bitmap, scaleMode: pixel ? 'nearest' : 'linear' });
            const added = { tex: new P.Texture({ source: src }), used: frameNo, ver: 0, bitmap };
            textures.set(key, added);
            fresh.push(added);
            stats.uploads++;
          }, () => decoding.delete(key));
        }
        return null;
      }
      const src = new P.CanvasSource({ resource: source, scaleMode: pixel ? 'nearest' : 'linear' });
      entry = { tex: new P.Texture({ source: src }), used: 0, ver: version };
      textures.set(key, entry);
      stats.uploads++;
    } else {
      // 最近用過的排到最後，滿了先丟最久沒用的。
      textures.delete(key); textures.set(key, entry);
    }
    entry.used = frameNo;
    return entry.tex;
  }
  function trim() {
    const cap = capacity();
    if (textures.size <= cap) return;
    for (const [key, entry] of textures) {
      if (textures.size <= cap) break;
      if (entry.used === frameNo) continue;
      try { entry.tex.destroy(true); } catch {}
      try { entry.bitmap?.close(); } catch {}
      textures.delete(key);
      stats.evicted++;
    }
  }
  function outline(color) {
    let f = outlines.get(color);
    if (!f) {
      f = new W.GiranPixi.OutlineFilter({ thickness: 1.5, color, quality: 0.15 });
      outlines.set(color, f);
    }
    return f;
  }
  function colorOf(filter) {
    const m = filter.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i);
    if (!m) return 0xffffff;
    const c = m[0];
    if (c[0] === '#') {
      let h = c.slice(1);
      if (h.length <= 4) h = h.split('').map(x => x + x).join('');
      return parseInt(h.slice(0, 6), 16);
    }
    const [r, g, b] = c.match(/[\d.]+/g).map(Number);
    return (r << 16) | (g << 8) | b;
  }

  // 讀算好的樣式很慢（每個屬性都要查一次），所以照元素的 class 與 style 屬性記住結果，沒變就不重讀。
  // 透明度會有漸變動畫，每幀照讀。
  const looks = new WeakMap();
  // 子元素的樣式也受外層 class 影響（例如 .mob-target.active 底下的外框），所以把角色節點的 class 一起算進去。
  function look(x, outer = '') {
    const sig = x.className + '|' + (x.getAttribute('style') || '') + '|' + outer;
    let v = looks.get(x);
    if (v && v.sig === sig) return v;
    const s = style(x);
    const [ts, tf] = parseTransform(s.transform), [ss, sf] = parseScale(s.scale);
    v = { sig, scale: ts * ss, sign: tf * sf,
      outline: s.filter !== 'none' && s.filter.includes('drop-shadow') ? colorOf(s.filter) : null,
      blend: s.mixBlendMode === 'multiply' || s.mixBlendMode === 'screen' ? s.mixBlendMode : 'normal',
      pad: [parseFloat(s.paddingLeft) || 0, parseFloat(s.paddingRight) || 0, parseFloat(s.paddingTop) || 0, parseFloat(s.paddingBottom) || 0],
      opacity: Number(s.opacity), fit: s.objectFit, animated: s.transitionProperty !== 'all' || s.animationName !== 'none' };
    looks.set(x, v);
    return v;
  }
  // 一張圖：在畫布上的中心、寬高、翻轉、透明度、混色、外框
  function leaf(items, el, field, g, fr, z, order, options = {}) {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    let scale = 1, sign = 1, alpha = 1, outlineColor = null;
    const outer = options.node ? options.node.className : '';
    for (let x = el; x && x !== field; x = x.parentElement) {
      const v = look(x, x === options.node ? '' : outer);
      scale *= v.scale; sign *= v.sign;
      // 角色節點本身會有淡入淡出，照讀；裡面的元素透明度只跟 class 有關，用記住的值。
      alpha *= x === options.node ? Number(style(x).opacity) : v.opacity;
      if (alpha <= 0.01) return;
      if (outlineColor === null && v.outline !== null) outlineColor = v.outline;
      if (x === options.node) {
        // 節點外面（#mob-list、#pet-layer）只看透明度
        for (let p = x.parentElement; p && p !== field; p = p.parentElement) alpha *= Number(style(p).opacity);
        break;
      }
    }
    const source = options.source || el;
    const nw = source.naturalWidth || source.width, nh = source.naturalHeight || source.height;
    if (!nw || !nh) return;
    const v = look(el, el === options.node ? '' : outer);
    const s = { objectFit: v.fit, mixBlendMode: v.blend };
    // 版面上的大小（不含旋轉）×累積縮放 → 畫布單位
    let bw = (el.offsetWidth || rect.width / g) * scale, bh = (el.offsetHeight || rect.height / g) * scale;
    const pl = v.pad[0] * scale, pr = v.pad[1] * scale, pt = v.pad[2] * scale, pb = v.pad[3] * scale;
    const cx0 = ((rect.left + rect.right) / 2 - fr.left) / g, cy0 = ((rect.top + rect.bottom) / 2 - fr.top) / g;
    const cw = Math.max(0, bw - pl - pr), ch = Math.max(0, bh - pt - pb);
    let w = cw, h = ch;
    const fit = options.fit || s.objectFit;
    if (fit === 'contain' || fit === 'scale-down' || fit === 'none' || fit === 'cover') {
      let k = fit === 'cover' ? Math.max(cw / nw, ch / nh) : Math.min(cw / nw, ch / nh);
      if (fit === 'none') k = scale;
      if (fit === 'scale-down') k = Math.min(k, scale);
      w = nw * k; h = nh * k;
    }
    const cx = cx0 + (pl - pr) / 2, cy = cy0 + (pt - pb) / 2;
    const blend = s.mixBlendMode === 'multiply' || s.mixBlendMode === 'screen' ? s.mixBlendMode : 'normal';
    items.push({ z, order, source, holder: el, frame: options.frame || null, x: cx, y: cy, w, h, sign, alpha, blend,
      outline: outlineColor, pixel: !!options.pixel });
  }

  const NATIVE = ':scope > img.pm-shadow, :scope > img.pm-body, :scope > img.pm-weapon, :scope > img.pet-shadow, :scope > img.pet-body, .mob-img-inner > img';
  // 每個角色有哪些圖片元素：子元素數量沒變就沿用上次查到的，不用每幀重查。
  const parts = new WeakMap();
  function partsOf(node) {
    const inner = node.querySelector(':scope > .mob-img-wrap > .mob-img-inner, :scope .mob-img-inner');
    const sig = node.childElementCount * 1000 + (inner ? inner.childElementCount : 0);
    let p = parts.get(node);
    if (!p || p.sig !== sig) {
      p = { sig, imgs: Array.from(node.querySelectorAll(NATIVE)), box: node.querySelector(':scope > .dm-stride') };
      parts.set(node, p);
    }
    return p;
  }
  function collect(field, g, fr) {
    const items = [];
    let order = 0;
    for (const node of field.querySelectorAll('.dm-placed, canvas.g-terrain-cover')) {
      order++;
      if (node.tagName === 'CANVAS') {
        if (node.hidden || !node.width || !node.height) continue;
        const s = style(node);
        if (s.display === 'none') continue;
        const z = parseInt(node.style.zIndex) || 0;
        const clip = /inset\(([^)]*)\)/.exec(s.clipPath);
        let frame = null;
        if (clip) {
          // inset(上 右 下 左)，跟 CSS 一樣可以只寫 1～3 個值
          const v = clip[1].trim().split(/\s+/).map(x => parseFloat(x) || 0);
          const tt = v[0], rr = v[1] ?? tt, bb = v[2] ?? tt, ll = v[3] ?? rr;
          const w = node.width - ll - rr, h = node.height - tt - bb;
          if (w <= 0 || h <= 0) continue;
          frame = [ll, tt, w, h];
        }
        const rect = node.getBoundingClientRect();
        const x0 = (rect.left - fr.left) / g, y0 = (rect.top - fr.top) / g;
        const k = rect.width / g / node.width || 1;
        const [fx, fy, fw, fh] = frame || [0, 0, node.width, node.height];
        items.push({ z, order, source: node, holder: node, frame, x: x0 + (fx + fw / 2) * k, y: y0 + (fy + fh / 2) * k, w: fw * k, h: fh * k,
          sign: 1, alpha: Number(s.opacity), blend: 'normal', outline: null, pixel: false, cover: true });
        continue;
      }
      if (node.classList.contains('dm-no-seat') || node.classList.contains('dm-off-camera')) continue;
      const ns = style(node);
      if (ns.visibility === 'hidden' || ns.display === 'none') continue;
      const pet = node.parentElement?.id === 'pet-layer';
      const z = pet ? 6 : (parseInt(node.style.zIndex) || parseInt(ns.zIndex) || 0);
      const striding = node.classList.contains('dm-walking') || node.classList.contains('dm-performing');
      const p = partsOf(node);
      if (striding) {
        const box = p.box;
        if (box) for (const c of box.children) {
          if (c.hidden || !c.dmImage || !c.checkVisibility({ opacityProperty: true })) continue;
          leaf(items, c, field, g, fr, z, order, { node, source: c.dmImage, fit: 'fill', pixel: true });
        }
      }
      for (const img of p.imgs) {
        if (!img.isConnected) { parts.delete(node); continue; }
        if (!img.complete || !img.naturalWidth || !img.checkVisibility({ opacityProperty: true })) continue;
        leaf(items, img, field, g, fr, z, order, { node });
      }
    }
    // 先比 z-index，同層照網頁順序（跟瀏覽器的疊放規則相同）
    items.sort((a, b) => a.z - b.z || a.order - b.order);
    return items;
  }

  // 量位置與繪製放在瀏覽器排完版面之後（ResizeObserver 的回呼就在那個時間點，還沒上畫面），
  // 讀位置不會逼瀏覽器多排一次版面，也不會差一幀。每幀改一下哨兵元素的寬度，讓回呼每幀都觸發。
  let snapshot = null, sentinel = null, observer = null, flip = false, pendingField = null;
  function measure(field, camera) {
    const fr = field.getBoundingClientRect();
    const cw = field.clientWidth, ch = field.clientHeight;
    if (!cw || !ch || !fr.width) { snapshot = null; return; }
    const g = fr.width / cw;
    snapshot = { items: collect(field, g, fr), cw, ch, g, cx: camera ? camera[0] : 0, cy: camera ? camera[1] : 0 };
  }
  function draw(field, camera) {
    const P = W.GiranPixi;
    if (!snapshot) return;
    const { items, cw, ch, g } = snapshot;
    const dx = camera ? snapshot.cx - camera[0] : 0, dy = camera ? snapshot.cy - camera[1] : 0;
    const res = resolution(g);
    if (renderer.width !== cw || renderer.height !== ch || renderer.resolution !== res) renderer.resize(cw, ch, res);
    stage.removeChildren();
    let n = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let tex = texture(it.source, it.pixel);
      if (!tex) tex = it.holder.__gpuLast;
      it.drawn = !!(tex && !tex.destroyed);
      if (!it.drawn) continue;
      it.holder.__gpuLast = tex;
      let sp = sprites[n];
      if (!sp) { sp = new P.Sprite(); sp.anchor.set(0.5); sprites[n] = sp; }
      n++;
      if (it.frame) {
        const [x, y, w, h] = it.frame;
        tex = new P.Texture({ source: tex.source, frame: new P.Rectangle(x, y, w, h) });
        temporary.push(tex);
      }
      sp.texture = tex;
      sp.position.set(it.x + dx, it.y + dy);
      sp.width = it.w; sp.height = it.h;
      if (it.sign < 0) sp.scale.x = -Math.abs(sp.scale.x);
      sp.alpha = it.alpha;
      sp.blendMode = it.blend;
      sp.filters = it.outline === null ? null : [outline(it.outline)];
      stage.addChild(sp);
    }
    const r0 = performance.now();
    renderer.render(stage);
    stats.render += performance.now() - r0;
    // 已經上傳到 GPU 的點陣圖可以放掉，CPU 端不用再留一份。
    for (let i = fresh.length - 1; i >= 0; i--) {
      const entry = fresh[i];
      if (!entry.bitmap || entry.tex.destroyed) { fresh.splice(i, 1); continue; }
      if (entry.used === frameNo) { try { entry.bitmap.close(); } catch {} entry.bitmap = null; fresh.splice(i, 1); }
    }
    for (const t of temporary) t.destroy(false);
    temporary.length = 0;
    stats.items = n;
    trim();
  }

  function begin() {}
  function afterLayout() {
    const field = pendingField;
    pendingField = null;
    if (!field || !active || state !== 'ready') return;
    const t0 = performance.now();
    try {
      measure(field, null);
      const t1 = performance.now();
      stats.measure += t1 - t0;
      draw(field, null);
    } catch (error) { fail(error); return; }
    stats.frames++;
    stats.ms += performance.now() - t0;
  }
  function frame(field, camera) {
    if (!wanted || state === 'failed' || !field) return;
    if (state === 'idle') {
      if (!W.GiranPixi) return;
      state = 'starting';
      start(field).then(() => { state = 'ready'; }, fail);
      return;
    }
    if (state !== 'ready') return;
    if (!field.classList.contains('dm-map')) return;
    if (canvas.parentElement !== field) field.append(canvas);
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.className = 'dm-gpu-sentinel';
      sentinel.setAttribute('aria-hidden', 'true');
      observer = new ResizeObserver(afterLayout);
      observer.observe(sentinel);
    }
    if (sentinel.parentElement !== field) field.append(sentinel);
    frameNo++;
    if (!active) { active = true; field.classList.add('dm-gpu'); }
    pendingField = field;
    flip = !flip;
    sentinel.style.width = flip ? '2px' : '1px';
  }

  W.GiranGpu = {
    begin,
    frame,
    get active() { return active; },
    status() {
      return { 狀態: state, 啟用: active, 想要: wanted, 錯誤: lastError, 圖數: stats.items, 貼圖: textures.size,
        上傳: stats.uploads, 淘汰: stats.evicted, 每幀毫秒: stats.frames ? +(stats.ms / stats.frames).toFixed(2) : 0,
        量位置: stats.frames ? +(stats.measure / stats.frames).toFixed(2) : 0, 繪製: stats.frames ? +(stats.render / stats.frames).toFixed(2) : 0 };
    },
    // 測試用：上一幀畫了哪些圖
    debug() {
      return (snapshot?.items || []).map(it => ({ z: it.z, x: Math.round(it.x), y: Math.round(it.y), w: Math.round(it.w), h: Math.round(it.h),
        a: +it.alpha.toFixed(2), sign: it.sign, blend: it.blend, outline: it.outline, drawn: it.drawn,
        el: (it.holder.className || it.holder.tagName) + '', src: String(it.source.currentSrc || it.source.src || it.source.tagName).split('/').slice(-2).join('/').slice(0, 60) }));
    },
    resetStats() { Object.assign(stats, { ms: 0, frames: 0, measure: 0, render: 0 });
    },
    disable() { wanted = false; try { localStorage.setItem(KEY, '0'); } catch {} deactivate(); },
    enable() { wanted = true; try { localStorage.removeItem(KEY); } catch {} }
  };
})();
