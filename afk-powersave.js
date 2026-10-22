/**
 * afk-powersave.js — 省電模式（補回我方原本核心的省電選項＋光暈濾鏡開關）
 *
 * 上游首頁原生已有「✨戰鬥特效」「🔢傷害數字」兩顆開關（__vfxOff / __vfxNumOff）。本檔再加兩個：
 *   ① 關戰鬥動畫：把 8fps sprite ticker 推進的動畫關掉（怪/玩家/傭兵/寵物/召喚 sprite 不再逐幀動）。
 *   ② 關閉光暈與濾鏡：注入覆寫樣式拔掉常駐的 GPU 熱點（全域圖片濾鏡、鎖定光暈、物品光暈動畫、
 *      modal 背景模糊…）。手機發熱的主力是這些每幀重算的 filter，詳見 docs/perf-battery.md。
 * 純包核心函式＋注入 CSS、不動核心；設定存本機（per 裝置的效能偏好，不進存檔）。
 *
 * ⚠️ 刻意沒有「節流 updateUI / renderMobs」這種選項：實測省 4%／−2%~8% ＝等於沒省，加狠到 250~500ms
 * 也一樣（畫面照樣每秒合成 57 幀，少算幾次「要畫什麼」省不到電）。數據見 docs/perf-battery.md。
 *
 * 入口：首頁「⚙ 其他功能 → 🔋 省電模式」面板勾選。關掉本外掛(開關) → 完全回原版。
 */
(function () {
    'use strict';
    if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('powersave')) return;   // 🎚️ 外掛開關

    // on() 掛在 sprite ticker 與怪物卡渲染的熱路徑上（每秒數十次），不能每次同步讀 localStorage。
    // 唯一寫入者是本檔 set()（面板勾選），快取不會過期。
    var _ps = {};
    function on(k) {
        if (k in _ps) return _ps[k];
        try { return (_ps[k] = localStorage.getItem('afk_ps_' + k) === '1'); } catch (e) { return false; }
    }
    function set(k, v) { if (k !== 'noanim' && k !== 'nofx') return; try { localStorage.setItem('afk_ps_' + k, v ? '1' : '0'); } catch (e) {} _ps[k] = !!v; applyVisualState(); }

    // Static mode still creates/removes sprites when a form, companion or life
    // state changes. A blanket no-op made characters invisible on a fresh load.
    var staticKeys = Object.create(null);
    function actorState(actor, group) {
        if (!actor || !actor.cls || typeof _actorBattleForm !== 'function') return null;
        var form = _actorBattleForm(actor, group), cache = form && typeof _morphBattleCache !== 'undefined' && _morphBattleCache[form.key];
        return { actor: actor, form: form, cache: cache, down: !!(actor.dead || actor._downed || (actor.curHp == null ? actor.hp : actor.curHp) <= 0) };
    }
    function cacheKey(a) { return a === 'probing' ? 'probing' : a ? ((a.idle && a.idle.length) || 0) + ':' + ((a.death && a.death.length) || 0) : 'empty'; }
    function petStates() {
        var out = typeof player !== 'undefined' && player && player.cls && typeof petsOutList === 'function' ? petsOutList() : [];
        if (typeof summonRenderList === 'function') out = out.concat(summonRenderList());
        if (typeof guardRenderList === 'function') out = out.concat(guardRenderList());
        return out;
    }
    function snapshotKey(fn) {
        var bv = document.getElementById('battle-view'), base = (bv && !bv.classList.contains('hidden') && bv.classList.contains('area-fit') ? 'visible' : 'hidden') + '|' + (typeof mapState !== 'undefined' ? mapState.current : '');
        if (fn === '_playerMorphApply') {
            var a = actorState(typeof player !== 'undefined' ? player : null, false), el = typeof _pmState !== 'undefined' && _pmState.el;
            return base + '|' + (a && a.form ? a.form.key + ':' + cacheKey(a.cache) + ':' + a.down : 'none') + ':' + !!(el && el.isConnected);
        }
        if (fn === '_allySpritesApply') return base + '|' + ((typeof player !== 'undefined' && player && player.allies) || []).map(function (actor, i) {
            var a = actorState(actor, i > 0), st = typeof _allySpriteStates !== 'undefined' && _allySpriteStates[String(actor._slot)];
            return actor._slot + ':' + (a && a.form ? a.form.key + ':' + cacheKey(a.cache) + ':' + a.down : 'none') + ':' + !!(st && st.el && st.el.isConnected);
        }).join('|');
        if (fn === '_petAnimApply') return base + '|' + petStates().map(function (p) {
            var key = (p.formGfx || p.form) + '#' + (p._dir == null ? 6 : p._dir), a = typeof _pet8Cache !== 'undefined' && _pet8Cache[key];
            return p.uid + ':' + key + ':' + cacheKey(a) + ':' + !!p._downed;
        }).join('|');
        return null;
    }
    function fixedImage(img, seq, last) {
        if (!img) return;
        var f = seq && seq.length ? seq[last ? seq.length - 1 : 0] : null;
        if (!f) { img.style.visibility = 'hidden'; return; }
        img.style.visibility = ''; if (img.src !== f.src) img.src = f.src;
    }
    function freezeActor(a, st) {
        if (!a || !st || !st.imgs || !a.cache || a.cache === 'probing') return;
        var act = a.down && a.cache.death ? 'death' : 'idle', cache = a.cache;
        fixedImage(st.imgs.bd, cache[act], a.down); fixedImage(st.imgs.sh, cache.shadow && cache.shadow[act], a.down); fixedImage(st.imgs.wp, cache.weapon && cache.weapon[act], a.down);
    }
    function freezeSnapshot(fn) {
        if (fn === '_playerMorphApply' && typeof _pmState !== 'undefined') freezeActor(actorState(player, false), _pmState);
        if (fn === '_allySpritesApply' && typeof _allySpriteStates !== 'undefined') (player.allies || []).forEach(function (a, i) { freezeActor(actorState(a, i > 0), _allySpriteStates[String(a._slot)]); });
        if (fn === '_petAnimApply' && typeof _petLayerEl === 'function' && typeof _pet8Cache !== 'undefined') {
            var layer = _petLayerEl(); if (!layer) return;
            var els = Array.from(layer.querySelectorAll('[data-pet]'));
            petStates().forEach(function (p) {
                var key = (p.formGfx || p.form) + '#' + (p._dirLoaded == null ? 6 : p._dirLoaded), a = _pet8Cache[key], el = els.find(function (e) { return e.getAttribute('data-pet') === String(p.uid); });
                if (!a || a === 'probing' || !el) return;
                var act = p._downed && a.death ? 'death' : 'idle';
                fixedImage(el.querySelector('.pet-body'), a[act], p._downed); fixedImage(el.querySelector('.pet-shadow'), a.shadow && a.shadow[act], p._downed);
            });
        }
    }
    window.addEventListener('resize', function () { staticKeys = Object.create(null); });

    // ① 關戰鬥動畫：8fps ticker only rebuilds a static snapshot when necessary.
    //   _petAnimApply=寵物/召喚物 sprite(js/22 自己的 ticker,已改間接呼叫讓 wrapper 生效);漏包它=關動畫後召喚物照樣跑(踩過)。
    ['_mobAnimApply', '_allySpritesApply', '_playerMorphApply', '_petAnimApply'].forEach(function (fn) {
        if (typeof window[fn] === 'function' && !window[fn].__afkPs) {
            var o = window[fn];
            window[fn] = function () {
                if (!on('noanim')) { delete staticKeys[fn]; return o.apply(this, arguments); }
                if (fn === '_mobAnimApply') return;
                var key = snapshotKey(fn); if (staticKeys[fn] === key) return;
                var value = o.apply(this, arguments); freezeSnapshot(fn); staticKeys[fn] = key; return value;
            };
            window[fn].__afkPs = true;
        }
    });

    // ①-b 關動畫時,怪物卡的初始圖要改要「待機首幀」而不是「登場動畫首幀」。
    //   核心戰鬥渲染呼叫 mobStillImg(name, img, preferSpawn=true) → 初始 src = spawn_0.png,
    //   本來會在下一個 8fps tick 被 _mobAnimApply 換成真正的幀;動畫關掉後那步不跑 → 圖就凍在 spawn_0。
    //   而破土/從骨堆爬起那類登場動畫的第 0 幀是**全透明的**(實測 骷髏/史巴托/殘暴的史巴托/被侵蝕的安塔瑞斯 0%、
    //   林德拜爾 0.15%、巨大骷髏 0.32%、安塔瑞斯 0.43%)→ 玩家看到的是「這隻怪沒有圖」。
    //   順帶解掉另一個副作用:動畫關著時幀檔探測不會跑,mobStillImg 會對「根本沒有登場動畫」的 530 隻怪
    //   每次重繪都固定要一次 spawn_0.png(404)。
    if (typeof window.mobStillImg === 'function' && !window.mobStillImg.__afkPs) {
        var _origStill = window.mobStillImg;
        window.mobStillImg = function (name, staticUrl, preferSpawn) {
            return _origStill.call(this, name, staticUrl, on('noanim') ? false : preferSpawn);
        };
        window.mobStillImg.__afkPs = true;
    }

    // ② 關閉光暈與濾鏡：鏡射上游選擇器覆寫、靠「後載入者勝出」而**不用 !important**——
    //    功能性 filter（剪影怪 brightness(0)、reduced-motion 的 !important 靜態光）的勝負關係才不會被打亂。
    var NOFX_CSS = [
        /* 全遊戲每張 <img> 的常駐濾鏡：任一張 8fps 換幀都整層重算，是最大範圍的 GPU 熱點 */
        '#game-screen img, #creation-screen img, #battle-view img { filter: none; }',
        /* 鎖定紅光暈疊在 8fps 換幀的 sprite 上 → 拔掉。不補任何替代標示：打誰不影響操作，
           要看正在打誰有 afk-mobname 的「鎖定中常駐顯示」，在怪圖上加框反而礙眼。 */
        '#battle-view.has-bg .mob-target.active .mob-img-inner { filter: none; }',
        '#battle-view.has-bg .mob-target.active .mob-img-inner.mob-shadow-tint { filter: brightness(0); }',
        /* 物品/怪物光暈：drop-shadow 動畫每幀重算；靜態多層光也一併拔（背包開著就是整片） */
        '.legend-glow, .mana-glow, .relic-glow, .bless-glow, .curse-glow, .ancient-glow,',
        '.anc-bless-glow, .ancient-glow-strong, .bless-glow-strong, .tri-glow,',
        '.attr-glow-fr5, .attr-glow-wa5, .attr-glow-wi5, .attr-glow-ea5,',
        '.sherine-glow-icon, .rem-slot-dim .sherine-glow-icon, .grace-glow { animation: none; filter: none; }',
        '.c-sherine { animation: none; }',
        '.attr-glow-fr1, .attr-glow-fr2, .attr-glow-fr3, .attr-glow-fr4,',
        '.attr-glow-wa1, .attr-glow-wa2, .attr-glow-wa3, .attr-glow-wa4,',
        '.attr-glow-wi1, .attr-glow-wi2, .attr-glow-wi3, .attr-glow-wi4,',
        '.attr-glow-ea1, .attr-glow-ea2, .attr-glow-ea3, .attr-glow-ea4 { filter: none; }',
        /* 遺物星芒/遺骸與套裝掃光/稀有掉落脈動：停動畫、留靜態（掃光比照上游 reduced-motion 的降級寫法） */
        '.classic-icon-box:has(.relic-glow)::before, .classic-icon-box:has(.relic-glow)::after,',
        '.equipment-visual-slot:has(.relic-glow)::before, .equipment-visual-slot:has(.relic-glow)::after,',
        '.relic-glow-wrap::before, .relic-glow-wrap::after { animation: none; }',
        '.rem-slot-lit::after, .set-slot-lit::after { animation: none; transform: none; opacity: .18; width: 100%; }',
        '#sys-log .sys-item-gain .sys-drop-rare { animation: none; }',
        /* 日誌 inline 色字的整批 filter：最多 150 個 span，每秒插入訊息時整段跟著重繪 */
        '#combat-log [style*="color:"], #sys-log [style*="color:"] { filter: none; }',
        /* 頭目狂暴：拔本體 drop-shadow 呼吸與 blur 氣焰（最貴的兩層），保留地面紅環當狂暴標示 */
        '#battle-view .mob-target.mob-raging .mob-img-wrap { animation: none; }',
        '#battle-view .mob-target.mob-raging .mob-img-inner::before { display: none; }',
        /* modal 的全螢幕背景模糊：底下戰鬥還在 8fps 換幀，開著就每幀重算整片模糊 */
        ':is(#autosell-rule-modal, #autosell-preview-modal, #poly-modal, #osiris-box-modal,',
        '    #summon-select-overlay, #pet-evo-overlay, #pet-gear-overlay,',
        '    #pvp-arena-modal, #pvp-result-modal,',
        '    #card-book, #equip-book, #misc-book, #relic-book, #collection-panel) { backdrop-filter: none; }',
        '.backdrop-blur-sm { backdrop-filter: none; -webkit-backdrop-filter: none; }',
        'body.afk-no-glow .afk-trans-aura { display: none; }',
        'body.afk-no-glow [data-card-aura] { filter: none; }'
    ].join('\n');
    function applyNofx() {
        var el = document.getElementById('afk-ps-nofx');
        if (on('nofx')) {
            if (!el) {
                el = document.createElement('style'); el.id = 'afk-ps-nofx'; el.textContent = NOFX_CSS;
                (document.head || document.documentElement).appendChild(el);
            }
        } else if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    function applyVisualState() {
        if (document.body) {
            document.body.classList.toggle('afk-no-animation', on('noanim'));
            document.body.classList.toggle('afk-no-glow', on('nofx'));
            document.body.classList.toggle('afk-visual-paused', document.hidden);
        }
        applyNofx();
    }
    applyVisualState();
    document.addEventListener('visibilitychange', applyVisualState);

    // ── 首頁設定面板 ──
    window.AFK_SETTINGS = window.AFK_SETTINGS || { _items: [], add: function (it) { this._items.push(it); } };
    AFK_SETTINGS.add({ label: '🔋 省電模式', onClick: openPanel });
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    // ── 原版本來就有的四個開關,收進同一個面板 ─────────────────────
    // 音樂/音效在遊戲中的音量列、戰鬥特效/傷害數字在標題畫面,分散在三個地方,而玩家想省電時
    // 是「四個一起關」。這裡**不另存一份設定**——一律讀寫核心自己的狀態並呼叫核心的 setter,
    // 所以原本那三處的顯示會跟著變、關掉本外掛也不會留下孤兒設定。
    // 勾選＝省電(該效果關閉),與上面兩項語意一致。
    var CORE = {
        vfx:    { get: function () { return !window.__vfxOff; },
                  set: function (want) { if (!!window.__vfxOff === !want) return; toggleVfxPref(); } },
        vfxnum: { get: function () { return !window.__vfxNumOff; },
                  set: function (want) { if (!!window.__vfxNumOff === !want) return; toggleVfxNumPref(); } },
        bgm:    { get: function () { return !!(window._bgmCfg && _bgmCfg.on); },
                  set: function (want) { setBgmOn(want); try { _bgmSyncUI(); } catch (e) {} } },
        sfx:    { get: function () { return !!(window._sfxCfg && _sfxCfg.on); },
                  set: function (want) { setSfxOn(want); try { _sfxSyncUI(); } catch (e) {} } }
    };
    // 核心少了哪一支就不列那一列(上游改版時安靜少一項,不會整個面板壞掉)
    function coreReady(k) {
        try {
            if (k === 'vfx') return typeof toggleVfxPref === 'function';
            if (k === 'vfxnum') return typeof toggleVfxNumPref === 'function';
            if (k === 'bgm') return typeof setBgmOn === 'function' && typeof _bgmCfg === 'object';
            if (k === 'sfx') return typeof setSfxOn === 'function' && typeof _sfxCfg === 'object';
        } catch (e) {}
        return false;
    }
    var PRESETS = {
        full: { label: '完整效果', noanim: false, nofx: false, vfx: true, vfxnum: true },
        smooth: { label: '流暢顯示', noanim: false, nofx: true, vfx: false, vfxnum: true },
        low: { label: '極省電', noanim: true, nofx: true, vfx: false, vfxnum: false }
    };
    function preset(key) {
        var p = PRESETS[key]; if (!p) return false;
        set('noanim', p.noanim); set('nofx', p.nofx);
        ['vfx', 'vfxnum'].forEach(function (k) { if (coreReady(k)) CORE[k].set(p[k]); });
        return true;
    }
    function snapshot() {
        var r = { noanim: on('noanim'), nofx: on('nofx') };
        Object.keys(CORE).forEach(function (k) { if (coreReady(k)) r[k] = CORE[k].get(); });
        return r;
    }
    window.AFK_POWERSAVE = { on: on, set: set, preset: preset, snapshot: snapshot, open: openPanel };

    function openPanel() {
        if (document.getElementById('afk-ps-overlay')) return;
        var ov = document.createElement('div');
        ov.id = 'afk-ps-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.66);display:flex;align-items:flex-start;justify-content:center;padding:calc(var(--orig-bar-h,0px) + 14px) 12px calc(12px + env(safe-area-inset-bottom, 0px));';
        if (window.AFK_TOGGLES && AFK_TOGGLES.applyBannerPad) AFK_TOGGLES.applyBannerPad(ov);   // 開啟當下實測橫幅高度覆寫 padding-top
        // 由上而下＝省電效果由大到小。**順序照實測排,不是照直覺**(2026-08-05 實測,數據與方法見 docs/perf-battery.md):
        //   關動畫 24~37% > 光暈濾鏡 22~25% > 特效 16~17% >> 傷害數字 0。
        //   傷害數字實測 0% 仍留著:那是上游自己的開關(__vfxNumOff),標題畫面本來就有,拿掉這一列
        //   只會讓「省電模式」跟標題畫面兩邊不一致,不是我們能決定的東西。
        //   音樂/音效無頭環境量不到(沒有使用者手勢→不會播),排最後是依「音訊解碼常駐且切背景不停」推估。
        var opts = [
            { k: 'noanim', name: '關閉戰鬥動畫', desc: '怪物/玩家/傭兵/寵物/召喚的逐幀動畫停止（傷害/戰鬥數值不變）' },
            { k: 'nofx', name: '關閉光暈與濾鏡', desc: '裝備與怪物的發光、畫面濾鏡等裝飾效果關閉' },
            { core: 'vfx', name: '關閉戰鬥特效', desc: '不再播放技能與攻擊的特效動畫' },
            { core: 'vfxnum', name: '關閉傷害數字', desc: '不再跳出傷害/治療的浮動數字' },
            { core: 'bgm', name: '關閉背景音樂', desc: '同遊戲中音量列的音樂開關' },
            { core: 'sfx', name: '關閉音效', desc: '同遊戲中音量列的音效開關' }
        ].filter(function (o) { return !o.core || coreReady(o.core); });
        var rows = opts.map(function (o) {
            var checked = o.core ? !CORE[o.core].get() : on(o.k);   // 核心那四項:勾選＝該效果關閉
            var attr = o.core ? ('data-pscore="' + o.core + '"') : ('data-ps="' + o.k + '"');
            return '<label style="display:flex;align-items:center;gap:12px;padding:10px;border:1px solid #1e293b;border-radius:10px;margin-bottom:8px;cursor:pointer;background:#0b1222;">'
                + '<input type="checkbox" ' + attr + ' ' + (checked ? 'checked' : '') + ' style="width:18px;height:18px;flex:none;accent-color:#22c55e;">'
                + '<span><span style="font-weight:600;">' + esc(o.name) + '</span><span style="display:block;font-size:13px;line-height:1.6;color:#94a3b8;margin-top:2px;">' + esc(o.desc) + '</span></span></label>';
        }).join('');
        var card = document.createElement('div');
        // max-height:100% 是相對「遮罩扣掉 padding 後」的高度 —— 橫幅讓位(applyBannerPad 改的是同一個 padding)
        // 自動吃得到,不必再自己算 dvh。清單自己捲,標題與「完成」永遠留在畫面上。
        card.style.cssText = 'background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:14px;max-width:460px;width:100%;max-height:100%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.6);';
        card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'afk-ps-title');
        card.innerHTML = '<div style="padding:16px 18px;border-bottom:1px solid #1e293b;flex:0 0 auto;"><div id="afk-ps-title" style="font-size:18px;font-weight:700;">🔋 省電模式</div>'
            + '<div style="font-size:13px;line-height:1.6;color:#94a3b8;margin-top:5px;">卡頓時先選「流暢顯示」，仍不順再選「極省電」；戰鬥數值照常計算。</div></div>'
            + '<div style="padding:12px 14px;flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;"><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">'
            + Object.keys(PRESETS).map(function (k) { return '<button class="btn" type="button" data-preset="' + k + '" style="flex:1;min-height:40px;">' + PRESETS[k].label + '</button>'; }).join('') + '</div>' + rows + '</div>'
            + '<div style="padding:12px 16px;border-top:1px solid #1e293b;text-align:right;flex:0 0 auto;"><button id="afk-ps-close" style="background:#0ea5e9;border:none;color:#04263a;font-weight:700;border-radius:8px;padding:8px 16px;cursor:pointer;">完成</button></div>';
        ov.appendChild(card); document.body.appendChild(ov);
        var previousFocus = document.activeElement, layer = null;
        function dismiss() { layer = null; if (ov.parentNode) ov.parentNode.removeChild(ov); if (previousFocus && previousFocus.isConnected && previousFocus.focus) previousFocus.focus(); }
        function close() { if (layer && window.AFK_UI) AFK_UI.closeLayer(layer); else dismiss(); }
        if (window.AFK_UI && AFK_UI.openLayer) layer = AFK_UI.openLayer(dismiss);
        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        card.querySelector('#afk-ps-close').addEventListener('click', close);
        card.querySelectorAll('input[data-ps]').forEach(function (cb) {
            cb.addEventListener('change', function () { set(cb.getAttribute('data-ps'), cb.checked); });
        });
        card.querySelectorAll('input[data-pscore]').forEach(function (cb) {
            // 勾選＝省電＝把該效果關掉 → 傳給核心的是「要不要開啟」,所以取反
            cb.addEventListener('change', function () {
                try { CORE[cb.getAttribute('data-pscore')].set(!cb.checked); } catch (e) {}
            });
        });
        card.querySelectorAll('[data-preset]').forEach(function (button) {
            button.addEventListener('click', function () {
                preset(button.getAttribute('data-preset'));
                card.querySelectorAll('input[data-ps]').forEach(function (cb) { cb.checked = on(cb.getAttribute('data-ps')); });
                card.querySelectorAll('input[data-pscore]').forEach(function (cb) { cb.checked = !CORE[cb.getAttribute('data-pscore')].get(); });
            });
        });
        card.querySelector('#afk-ps-close').focus();
    }

    try { console.log('[AFK-powersave] hooks OK — 省電模式（關動畫/關光暈濾鏡）已就緒。'); } catch (e) {}
})();
