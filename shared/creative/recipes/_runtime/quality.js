/* Experience quality runtime. No dependencies, about 3 KB minified.
 *
 * One page, one quality tier: static < low < balanced < high < ultra. The tier is written to
 * <html data-quality="…"> so CSS can key off it, and effects that draw every frame register a
 * loop here so they stop when hidden, offscreen or static, and free their resources.
 *
 * Order of authority: reduced motion (always static) > an explicit choice (set(), then
 * ?quality=, then the stored choice) > data saver (caps automatic mode at low) > measured frame
 * pacing > device hints. Measurement only happens while a registered loop is running, so a page
 * with no continuous effect never renders a frame for the runtime's sake.
 *
 * Classic script: defines globalThis.ExperienceQuality. ES module: import from ./quality.mjs.
 */
(function (global) {
  'use strict';

  var TIERS = ['static', 'low', 'balanced', 'high', 'ultra'];
  // What a tier allows. dpr: device pixel ratio cap for canvases. fps: render rate cap (null is
  // the display rate, 0 is no loop). detail: 0..1 scale for counts, octaves, blur and the like.
  var BUDGETS = {
    static: { dpr: 1, fps: 0, detail: 0 },
    low: { dpr: 1, fps: 30, detail: 0.25 },
    balanced: { dpr: 1.5, fps: 60, detail: 0.5 },
    high: { dpr: 2, fps: 60, detail: 0.75 },
    ultra: { dpr: 2, fps: null, detail: 1 },
  };
  var WINDOW = 60; // frames per judgement
  var WINDOW_MS = 2000; // or this long, so a slow device is not judged more slowly than a fast one
  var WINDOW_MIN = 12; // fewest frames a timed window may hold
  var PAUSE_MS = 250; // a single gap this long is a pause (throttled tab, debugger), not a frame
  var STALL_GAPS = 3; // this many in a row is not a pause: the page cannot draw
  var SLOW_MS = 25; // a frame this long has clearly missed 60 Hz
  var DOWN_SHARE = 0.2; // slow share that counts as a bad window
  var SEVERE_SHARE = 0.5; // one window this bad steps down at once
  var UP_SHARE = 0.05; // slow share that counts as a good window
  var DOWN_WINDOWS = 2;
  var UP_WINDOWS = 5;
  var COOLDOWN_MS = 4000;
  var UNUSABLE_MS = 50; // median frame time above which only a still is honest

  function idx(t) { return TIERS.indexOf(t); }
  function attempt(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }

  function createQuality(opts) {
    opts = opts || {};
    var w = opts.window || global;
    var doc = w.document || null;
    var root = opts.root || (doc && doc.documentElement) || null;
    var param = opts.param || 'quality';
    var storageKey = opts.storageKey === undefined ? 'experience-quality' : opts.storageKey;
    var floor = Math.max(0, idx(opts.min || 'static'));
    var ceiling = idx(opts.max || 'ultra') < 0 ? 4 : idx(opts.max || 'ultra');
    var slowMs = opts.slowMs || SLOW_MS;

    var listeners = [];
    var loops = [];
    var undo = [];
    var tier = null;
    var mode = 'auto';
    var reasons = [];
    var forced = null;
    var autoTier = 2;
    var autoMax = ceiling;
    var drops = {};
    var good = 0;
    var bad = 0;
    var skip = 1;
    var lastChange = -Infinity;
    var buf = [];
    var bufMs = 0;
    var stalls = 0;
    var destroyed = false;

    function now() { return w.performance && w.performance.now ? w.performance.now() : Date.now(); }
    function media(q) { return attempt(function () { return w.matchMedia ? w.matchMedia(q) : null; }, null); }
    var mqMotion = media('(prefers-reduced-motion: reduce)');
    var mqData = media('(prefers-reduced-data: reduce)');

    function dataSaver() {
      var c = w.navigator && w.navigator.connection;
      return !!((c && c.saveData) || (mqData && mqData.matches));
    }
    function hint() {
      var n = w.navigator || {};
      if ((n.hardwareConcurrency && n.hardwareConcurrency <= 2) || (n.deviceMemory && n.deviceMemory <= 2)) return 1;
      if (n.hardwareConcurrency >= 8 && (n.deviceMemory === undefined || n.deviceMemory >= 8)) return 3;
      return 2;
    }
    function store(kind) { return attempt(function () { return w[kind] || null; }, null); }
    function read(kind, key) { var s = store(kind); return s && key ? attempt(function () { return s.getItem(key); }, null) : null; }
    function write(kind, key, value) {
      var s = store(kind);
      if (!s || !key) return;
      attempt(function () { if (value === null) s.removeItem(key); else s.setItem(key, value); });
    }

    function emit(detail) {
      listeners.slice().forEach(function (fn) { fn(detail); });
      if (root && root.dispatchEvent && w.CustomEvent) root.dispatchEvent(new w.CustomEvent('qualitychange', { detail: detail }));
    }

    function resolve(reason) {
      var why = [];
      var want;
      if (forced) {
        mode = 'forced';
        want = idx(forced.tier);
        why.push('chosen (' + forced.source + ')');
      } else {
        mode = 'auto';
        want = Math.min(Math.max(Math.min(autoTier, autoMax), floor), ceiling);
        if (want > 1 && dataSaver()) { want = 1; why.push('data saver'); }
      }
      if (mqMotion && mqMotion.matches) { want = 0; why.push('reduced motion'); }
      reasons = why;
      var next = TIERS[want];
      if (next === tier) return;
      var previous = tier;
      tier = next;
      lastChange = now();
      buf = [];
      bufMs = 0;
      stalls = 0;
      good = 0;
      bad = 0;
      skip = 1;
      if (root) { if (root.dataset) root.dataset.quality = tier; else if (root.setAttribute) root.setAttribute('data-quality', tier); }
      if (mode === 'auto' && why.length === 0) write('sessionStorage', storageKey && storageKey + ':auto', tier + ',' + TIERS[autoMax]);
      loops.slice().forEach(function (l) { l.refresh(); });
      emit({ tier: tier, previous: previous, mode: mode, reason: reason, reasons: why.slice() });
    }

    // One raw frame gap from a running loop. Decides, a window at a time, whether to step.
    function sample(dt) {
      if (mode !== 'auto' || !(dt > 0)) return;
      if (dt > PAUSE_MS) {
        // One long gap is a pause. Several in a row, with the loop running, is a frame rate
        // too low to measure in windows: treat it as a severe window of its own.
        if (++stalls < STALL_GAPS) return;
        buf = []; bufMs = 0;
        for (var g = 0; g < WINDOW_MIN; g++) buf.push(dt);
        bufMs = WINDOW_MS;
        skip = 0;
      } else {
        stalls = 0;
        buf.push(dt);
        bufMs += dt;
      }
      if (buf.length < WINDOW && !(bufMs >= WINDOW_MS && buf.length >= WINDOW_MIN)) return;
      bufMs = 0;
      stalls = 0;
      var sorted = buf.slice().sort(function (a, b) { return a - b; });
      buf = [];
      if (skip > 0) { skip--; return; } // the first window after a change includes set-up cost
      var slow = 0;
      for (var k = 0; k < sorted.length; k++) if (sorted[k] > slowMs) slow++;
      slow /= sorted.length;
      var p50 = sorted[sorted.length >> 1];
      if (slow > DOWN_SHARE) { bad++; good = 0; } else if (slow <= UP_SHARE) { good++; bad = 0; } else { good = 0; bad = 0; }
      var i = idx(tier);
      if (bad >= DOWN_WINDOWS || slow > SEVERE_SHARE) {
        bad = 0;
        var lowest = Math.max(floor, p50 > UNUSABLE_MS ? 0 : 1); // only an unusable frame rate earns a still
        if (i > lowest) {
          drops[i] = (drops[i] || 0) + 1;
          if (drops[i] >= 2) autoMax = Math.min(autoMax, i - 1); // failed here twice: stop trying
          autoTier = i - 1;
          resolve('slow frames');
        }
        return;
      }
      var patience = UP_WINDOWS * (1 << (drops[i + 1] || 0));
      if (good >= patience && i < autoMax && i < ceiling && now() - lastChange >= COOLDOWN_MS) {
        good = 0;
        autoTier = i + 1;
        resolve('headroom');
      }
    }

    var api = {
      get tier() { return tier; },
      get mode() { return mode; },
      get budget() { return BUDGETS[tier]; },
      get reasons() { return reasons.slice(); },
      at: function (t) { return idx(tier) >= idx(t); },
      on: function (fn) {
        listeners.push(fn);
        return function () { var k = listeners.indexOf(fn); if (k >= 0) listeners.splice(k, 1); };
      },
      // set('low') pins a tier and remembers it; set('auto') returns to measured mode.
      set: function (t, o) {
        var persist = !o || o.persist !== false;
        if (t === 'auto' || t === null || t === undefined) {
          forced = null;
          if (persist) write('localStorage', storageKey, null);
        } else {
          if (idx(t) < 0) throw new Error('unknown quality tier "' + t + '" (use ' + TIERS.join(', ') + ' or auto)');
          forced = { tier: t, source: 'user' };
          if (persist) write('localStorage', storageKey, t);
        }
        resolve('choice');
      },
      sample: sample,
      loop: loop,
      destroy: function () {
        destroyed = true;
        loops.slice().forEach(function (l) { l.stop(); });
        undo.forEach(function (fn) { fn(); });
        undo = [];
        listeners = [];
      },
    };

    // A managed render loop. o.render(t, dt, quality) runs only while the element is on screen,
    // the tab is visible and the tier is not static, at the tier's frame rate. o.setup() runs
    // before the first frame; o.dispose() when the tier turns static, after idleDisposeMs off
    // screen, or on stop(); o.still() after a switch to static, for a one-off still.
    function loop(o) {
      var el = o.element || null;
      var idleMs = o.idleDisposeMs === undefined ? 15000 : o.idleDisposeMs;
      var ready = false;
      var raf = 0;
      var last = null;
      var lastRender = null;
      var stopped = false;
      var idleTimer = 0;
      var io = null;
      var inView = true;

      function release() {
        if (idleTimer) { w.clearTimeout(idleTimer); idleTimer = 0; }
        if (ready) { ready = false; if (o.dispose) o.dispose(api); }
      }
      function tick(t) {
        raf = w.requestAnimationFrame(tick);
        if (last !== null) sample(t - last);
        last = t;
        if (!raf) return; // the sample changed the tier and this loop was stopped
        var fps = BUDGETS[tier].fps;
        if (fps && lastRender !== null && t - lastRender < 1000 / fps - 2) return;
        var dt = lastRender === null ? 0 : Math.min(t - lastRender, 100);
        lastRender = t;
        o.render(t, dt, api);
      }
      function refresh() {
        var active = !stopped && tier !== 'static' && inView && (!doc || doc.visibilityState !== 'hidden');
        if (active) {
          if (idleTimer) { w.clearTimeout(idleTimer); idleTimer = 0; }
          if (!ready) { ready = true; if (o.setup) o.setup(api); }
          if (!raf) { last = null; lastRender = null; raf = w.requestAnimationFrame(tick); }
          return;
        }
        if (raf) { w.cancelAnimationFrame(raf); raf = 0; }
        if (stopped) { release(); return; }
        if (tier === 'static') { release(); if (o.still) o.still(api); return; }
        if (ready && idleMs >= 0 && !idleTimer) idleTimer = w.setTimeout(function () { idleTimer = 0; release(); }, idleMs);
      }
      var handle = {
        get running() { return raf !== 0; },
        get ready() { return ready; },
        refresh: refresh,
        stop: function () {
          if (stopped) return;
          stopped = true;
          if (io) io.disconnect();
          var k = loops.indexOf(handle);
          if (k >= 0) loops.splice(k, 1);
          refresh();
        },
      };
      loops.push(handle);
      if (el && w.IntersectionObserver) {
        inView = false;
        io = new w.IntersectionObserver(function (entries) {
          // The default -1px margin matters: an element whose edge only touches the viewport edge
          // counts as intersecting at 0px, and nothing may draw with nothing on screen.
          inView = entries[entries.length - 1].isIntersecting;
          refresh();
        }, { rootMargin: o.rootMargin || '-1px' });
        io.observe(el);
      }
      if (destroyed) handle.stop(); else refresh();
      return handle;
    }

    function listen(target, type, fn) {
      if (!target) return;
      if (target.addEventListener) { target.addEventListener(type, fn); undo.push(function () { target.removeEventListener(type, fn); }); }
    }
    listen(mqMotion, 'change', function () { resolve('preference'); });
    listen(mqData, 'change', function () { resolve('preference'); });
    listen(doc, 'visibilitychange', function () { loops.slice().forEach(function (l) { l.refresh(); }); });

    // Starting point: an explicit choice, else where this session settled, else device hints.
    var fromUrl = attempt(function () { return new (w.URLSearchParams || URLSearchParams)(w.location.search).get(param); }, null);
    var stored = read('localStorage', storageKey);
    if (idx(fromUrl) >= 0) forced = { tier: fromUrl, source: 'url' };
    else if (idx(stored) >= 0) forced = { tier: stored, source: 'user' };
    var settled = (read('sessionStorage', storageKey && storageKey + ':auto') || '').split(',');
    autoTier = idx(opts.start) >= 0 ? idx(opts.start) : idx(settled[0]) >= 0 ? idx(settled[0]) : hint();
    if (idx(settled[1]) >= 0) autoMax = Math.min(autoMax, idx(settled[1]));
    resolve('start');
    return api;
  }

  var sharedInstance = null;
  global.ExperienceQuality = {
    TIERS: TIERS,
    BUDGETS: BUDGETS,
    createQuality: createQuality,
    // One governor per page: every recipe on the page shares it.
    shared: function (opts) { return sharedInstance || (sharedInstance = createQuality(opts)); },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
