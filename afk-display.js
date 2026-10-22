/* Keep projectile motion on transform/opacity; preserve native timing/geometry. */
(function () {
    'use strict';
    var T = window.AFK_TOGGLES, frames = new WeakMap();
    window.__afkProjectileFrame = function (el, x, y, width, height, flip, src) {
        if (T && !T.enabled('perf-render')) {
            if (frames.has(el)) { el.style.transform = flip ? 'scaleX(-1)' : ''; el.style.willChange = ''; frames.delete(el); }
            return false;
        }
        var previous = frames.get(el);
        if (!previous) {
            previous = {}; frames.set(el, previous);
            el.style.left = '0px'; el.style.top = '0px';
            // A short-lived hint only on active projectiles, never all sprites.
            el.style.willChange = 'transform';
        }
        if (previous.width !== width) { el.style.width = width + 'px'; previous.width = width; }
        if (previous.height !== height) { el.style.height = height + 'px'; previous.height = height; }
        var transform = 'translate3d(' + x + 'px,' + y + 'px,0)' + (flip ? ' scaleX(-1)' : '');
        if (previous.transform !== transform) { el.style.transform = transform; previous.transform = transform; }
        if (src && previous.src !== src) { if (el.src !== src) el.src = src; previous.src = src; }
        return true;
    };
})();
