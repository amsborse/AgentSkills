// Quality runtime and spring generator, on a fake window with a fake clock: no browser needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuality, TIERS, BUDGETS } from '../shared/creative/recipes/_runtime/quality.mjs';
import { springAt, springLinear, springCss, settleTime } from '../shared/creative/recipes/_runtime/spring.mjs';

function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
}

function fakeWindow({ search = '', cores = 4, memory = 8, saveData = false, reducedMotion = false, local = {}, session = {} } = {}) {
  let clock = 0;
  let nextId = 1;
  let frames = new Map();
  const timers = new Map();
  const media = {};
  const mq = (matches) => {
    const fns = new Set();
    return { matches, addEventListener: (_, fn) => fns.add(fn), removeEventListener: (_, fn) => fns.delete(fn), set(v) { this.matches = v; fns.forEach((fn) => fn()); }, fns };
  };
  media['(prefers-reduced-motion: reduce)'] = mq(reducedMotion);
  media['(prefers-reduced-data: reduce)'] = mq(false);
  const docListeners = new Set();
  const events = [];
  const observers = [];
  const w = {
    performance: { now: () => clock },
    matchMedia: (q) => media[q] || mq(false),
    requestAnimationFrame: (cb) => { const id = nextId++; frames.set(id, cb); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: (cb, ms) => { const id = nextId++; timers.set(id, { at: clock + ms, cb }); return id; },
    clearTimeout: (id) => timers.delete(id),
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    URLSearchParams,
    IntersectionObserver: class {
      constructor(cb) { this.cb = cb; this.connected = true; observers.push(this); }
      observe(el) { this.el = el; }
      disconnect() { this.connected = false; }
      set(isIntersecting) { this.cb([{ isIntersecting }]); }
    },
    location: { search },
    navigator: { hardwareConcurrency: cores, deviceMemory: memory, connection: { saveData } },
    localStorage: fakeStorage(local),
    sessionStorage: fakeStorage(session),
    document: {
      visibilityState: 'visible',
      addEventListener: (_, fn) => docListeners.add(fn),
      removeEventListener: (_, fn) => docListeners.delete(fn),
      documentElement: { dataset: {}, dispatchEvent: (e) => events.push(e) },
    },
  };
  return {
    w,
    media,
    events,
    observers,
    get pending() { return frames.size; },
    get clock() { return clock; },
    // Advance the clock and run what is due: timers first, then one animation frame.
    frame(dt = 16) {
      clock += dt;
      for (const [id, t] of [...timers]) if (t.at <= clock) { timers.delete(id); t.cb(); }
      const due = frames;
      frames = new Map();
      for (const cb of due.values()) cb(clock);
    },
    run(n, dt = 16) { for (let i = 0; i < n; i++) this.frame(dt); },
    // n frames of which every `every`-th is slow.
    runMixed(n, every, slow = 40, fast = 16) { for (let i = 0; i < n; i++) this.frame(i % every === 0 ? slow : fast); },
    setVisibility(v) { w.document.visibilityState = v; docListeners.forEach((fn) => fn()); },
  };
}

const quality = (env, opts = {}) => createQuality({ window: env.w, ...opts });

test('tiers are ordered and every tier has a budget', () => {
  assert.deepEqual(TIERS, ['static', 'low', 'balanced', 'high', 'ultra']);
  for (const t of TIERS) assert.ok(BUDGETS[t], t);
  assert.equal(BUDGETS.static.fps, 0);
  assert.ok(BUDGETS.low.dpr <= BUDGETS.balanced.dpr && BUDGETS.balanced.dpr <= BUDGETS.high.dpr);
});

test('device hints pick a conservative starting tier', () => {
  assert.equal(quality(fakeWindow({ cores: 2 })).tier, 'low');
  assert.equal(quality(fakeWindow({ cores: 8, memory: 2 })).tier, 'low');
  assert.equal(quality(fakeWindow({ cores: 4 })).tier, 'balanced');
  assert.equal(quality(fakeWindow({ cores: 8, memory: 8 })).tier, 'high');
  assert.equal(quality(fakeWindow({ cores: 16, memory: 32 })).tier, 'high', 'ultra is earned by measurement, never assumed');
});

test('the tier is written to the root and announced', () => {
  const env = fakeWindow();
  const seen = [];
  const q = quality(env);
  q.on((d) => seen.push(d));
  assert.equal(env.w.document.documentElement.dataset.quality, 'balanced');
  assert.equal(env.events[0].type, 'qualitychange');
  assert.equal(env.events[0].detail.tier, 'balanced');
  q.set('low');
  assert.equal(env.w.document.documentElement.dataset.quality, 'low');
  assert.deepEqual({ tier: seen[0].tier, previous: seen[0].previous, mode: seen[0].mode }, { tier: 'low', previous: 'balanced', mode: 'forced' });
  assert.ok(q.at('low') && !q.at('balanced'));
});

test('reduced motion is static whatever else is asked, and lifts when the preference does', () => {
  const env = fakeWindow({ search: '?quality=ultra', reducedMotion: true });
  const q = quality(env);
  assert.equal(q.tier, 'static');
  assert.ok(q.reasons.includes('reduced motion'));
  q.set('high');
  assert.equal(q.tier, 'static');
  env.media['(prefers-reduced-motion: reduce)'].set(false);
  assert.equal(q.tier, 'high');
  env.media['(prefers-reduced-motion: reduce)'].set(true);
  assert.equal(q.tier, 'static');
});

test('data saver caps automatic mode at low but not an explicit choice', () => {
  const env = fakeWindow({ cores: 8, saveData: true });
  const q = quality(env);
  assert.equal(q.tier, 'low');
  assert.deepEqual(q.reasons, ['data saver']);
  q.set('high');
  assert.equal(q.tier, 'high');
  q.set('auto');
  assert.equal(q.tier, 'low');
});

test('explicit choices: URL beats stored, set() persists, auto clears, unknown tiers throw', () => {
  const env = fakeWindow({ search: '?quality=low', local: { 'experience-quality': 'ultra' } });
  const q = quality(env);
  assert.equal(q.tier, 'low');
  assert.equal(q.mode, 'forced');
  assert.equal(quality(fakeWindow({ local: { 'experience-quality': 'ultra' } })).tier, 'ultra');
  assert.equal(quality(fakeWindow({ search: '?quality=bogus' })).mode, 'auto', 'an unknown value is ignored, not obeyed');
  q.set('high');
  assert.equal(env.w.localStorage.getItem('experience-quality'), 'high');
  q.set('auto');
  assert.equal(env.w.localStorage.getItem('experience-quality'), null);
  assert.equal(q.mode, 'auto');
  assert.throws(() => q.set('extreme'), /unknown quality tier/);
});

test('min and max bound automatic mode', () => {
  assert.equal(quality(fakeWindow({ cores: 8 }), { max: 'balanced' }).tier, 'balanced');
  assert.equal(quality(fakeWindow({ cores: 2 }), { min: 'balanced' }).tier, 'balanced');
});

test('storage that throws does not break the runtime', () => {
  const env = fakeWindow();
  Object.defineProperty(env.w, 'localStorage', { get() { throw new Error('denied'); } });
  Object.defineProperty(env.w, 'sessionStorage', { get() { throw new Error('denied'); } });
  const q = quality(env);
  assert.equal(q.tier, 'balanced');
  q.set('low');
  assert.equal(q.tier, 'low');
});

test('a page with no loop never requests a frame', () => {
  const env = fakeWindow();
  quality(env);
  assert.equal(env.pending, 0);
});

test('sustained slow frames step down one tier; a mixed window needs two in a row', () => {
  const env = fakeWindow();
  const q = quality(env);
  let renders = 0;
  q.loop({ render: () => renders++ });
  env.run(61); // first window after a change is ignored
  assert.equal(q.tier, 'balanced');
  env.runMixed(60, 3); // one third slow: bad window 1
  assert.equal(q.tier, 'balanced');
  env.runMixed(60, 3); // bad window 2
  assert.equal(q.tier, 'low');
  assert.ok(renders > 0);
});

test('a severe window steps down at once, and stops at low while frames are still usable', () => {
  const env = fakeWindow();
  const q = quality(env);
  q.loop({ render() {} });
  env.run(61);
  env.run(60, 40);
  assert.equal(q.tier, 'low');
  env.run(400, 40); // 25 fps: poor but not a slideshow
  assert.equal(q.tier, 'low');
});

test('an unusable frame rate falls back to a still and stops the loop', () => {
  const env = fakeWindow();
  const q = quality(env);
  let stills = 0;
  let disposed = 0;
  const loop = q.loop({ render() {}, still: () => stills++, dispose: () => disposed++ });
  env.run(61);
  env.run(60, 80);
  assert.equal(q.tier, 'low');
  env.run(121, 80);
  assert.equal(q.tier, 'static');
  assert.equal(loop.running, false);
  assert.equal(env.pending, 0);
  assert.equal(stills, 1);
  assert.equal(disposed, 1);
});

test('headroom steps up after five good windows and the cooldown, one tier at a time', () => {
  const env = fakeWindow();
  const q = quality(env, { start: 'low' });
  q.loop({ render() {} });
  env.run(61 + 240);
  assert.equal(q.tier, 'low', 'four good windows are not enough');
  env.run(60);
  assert.equal(q.tier, 'balanced');
  env.run(61 + 300);
  assert.equal(q.tier, 'high');
});

test('an isolated long gap is a pause, not a slow frame', () => {
  const env = fakeWindow();
  const q = quality(env);
  q.loop({ render() {} });
  env.run(61);
  for (let i = 0; i < 40; i++) { env.run(1, 400); env.run(20); } // a throttled tab now and then
  assert.ok(TIERS.indexOf(q.tier) >= TIERS.indexOf('balanced'), `never stepped down, got ${q.tier}`);
});

test('long gaps in a row are a stalled page, which steps down instead of waiting for ever', () => {
  const env = fakeWindow();
  const q = quality(env);
  const loop = q.loop({ render() {} });
  env.run(2);
  env.run(3, 400); // about 2 fps: three gaps in a row
  assert.equal(q.tier, 'low', 'one tier at a time');
  env.run(3, 400);
  assert.equal(q.tier, 'static', 'a frame rate this low earns a still');
  assert.equal(loop.running, false);
});

test('a slow device is judged by elapsed time, not only by frame count', () => {
  const env = fakeWindow();
  const q = quality(env);
  q.loop({ render() {} });
  env.run(1);
  env.run(20, 100); // 2 s at 10 fps: the ignored first window
  assert.equal(q.tier, 'balanced');
  env.run(20, 100); // the next 2 s is judged
  assert.notEqual(q.tier, 'balanced', 'stepped down within about four seconds');
});

test('a tier that fails twice is not tried again, and the session remembers', () => {
  const env = fakeWindow({ cores: 8 });
  const q = quality(env);
  q.loop({ render() {} });
  assert.equal(q.tier, 'high');
  env.run(61);
  env.run(60, 40);
  assert.equal(q.tier, 'balanced');
  env.run(61 + 600); // patience doubles after a drop: ten good windows
  assert.equal(q.tier, 'high');
  env.run(61);
  env.run(60, 40);
  assert.equal(q.tier, 'balanced');
  env.run(61 + 3000);
  assert.equal(q.tier, 'balanced');
  assert.equal(env.w.sessionStorage.getItem('experience-quality:auto'), 'balanced,balanced');
  const again = quality(fakeWindow({ cores: 8, session: { 'experience-quality:auto': 'balanced,balanced' } }));
  assert.equal(again.tier, 'balanced');
});

test('a forced tier is never changed by measurement', () => {
  const env = fakeWindow({ search: '?quality=ultra' });
  const q = quality(env);
  q.loop({ render() {} });
  env.run(400, 80);
  assert.equal(q.tier, 'ultra');
});

test('loop: sets up once, renders while visible, pauses offscreen and when hidden', () => {
  const env = fakeWindow();
  const q = quality(env);
  const log = { setup: 0, render: 0, dispose: 0 };
  const loop = q.loop({ element: {}, setup: () => log.setup++, render: () => log.render++, dispose: () => log.dispose++ });
  assert.equal(loop.running, false, 'waits for the observer before drawing');
  assert.equal(log.setup, 0);
  env.observers[0].set(true);
  assert.equal(log.setup, 1);
  env.run(10);
  assert.equal(log.render, 10);
  env.observers[0].set(false);
  assert.equal(env.pending, 0);
  env.run(10);
  assert.equal(log.render, 10);
  env.observers[0].set(true);
  env.run(5);
  assert.equal(log.render, 15);
  assert.equal(log.setup, 1, 'a short trip offscreen keeps resources');
  env.setVisibility('hidden');
  assert.equal(env.pending, 0);
  env.setVisibility('visible');
  env.run(5);
  assert.equal(log.render, 20);
  assert.equal(log.dispose, 0);
});

test('loop: resources are freed after a long time offscreen and rebuilt on return', () => {
  const env = fakeWindow();
  const q = quality(env);
  const log = { setup: 0, dispose: 0 };
  const loop = q.loop({ element: {}, idleDisposeMs: 1000, setup: () => log.setup++, render() {}, dispose: () => log.dispose++ });
  env.observers[0].set(true);
  env.run(3);
  env.observers[0].set(false);
  env.run(30);
  assert.equal(log.dispose, 0);
  env.run(40);
  assert.equal(log.dispose, 1);
  assert.equal(loop.ready, false);
  env.observers[0].set(true);
  assert.equal(log.setup, 2);
});

test('loop: low renders at about half rate; static renders nothing and offers a still', () => {
  const env = fakeWindow({ search: '?quality=low' });
  const q = quality(env);
  let renders = 0;
  let stills = 0;
  q.loop({ render: () => renders++, still: () => stills++ });
  env.run(60, 16.7);
  assert.ok(renders >= 28 && renders <= 32, `expected about 30 renders, got ${renders}`);
  q.set('static');
  assert.equal(env.pending, 0);
  assert.equal(stills, 1);
  const before = renders;
  env.run(30);
  assert.equal(renders, before);
  q.set('balanced');
  env.run(10);
  assert.equal(renders, before + 10);
});

test('loop: reduced motion never starts the loop or allocates', () => {
  const env = fakeWindow({ reducedMotion: true });
  const q = quality(env);
  const log = { setup: 0, render: 0, still: 0 };
  q.loop({ setup: () => log.setup++, render: () => log.render++, still: () => log.still++ });
  env.run(20);
  assert.deepEqual(log, { setup: 0, render: 0, still: 1 });
});

test('stop and destroy release everything', () => {
  const env = fakeWindow();
  const q = quality(env);
  let disposed = 0;
  const a = q.loop({ element: {}, render() {}, dispose: () => disposed++ });
  const b = q.loop({ render() {}, dispose: () => disposed++ });
  env.observers[0].set(true);
  env.run(2);
  a.stop();
  assert.equal(disposed, 1);
  assert.equal(env.observers[0].connected, false);
  q.destroy();
  assert.equal(disposed, 2);
  assert.equal(b.running, false);
  assert.equal(env.pending, 0);
  assert.equal(env.media['(prefers-reduced-motion: reduce)'].fns.size, 0);
});

test('spring: starts at rest, reaches the target, and the damping regimes behave', () => {
  for (const s of [{ stiffness: 170, damping: 26 }, { stiffness: 100, damping: 20 }, { stiffness: 100, damping: 40 }]) {
    assert.ok(Math.abs(springAt(0, s)) < 1e-9);
    assert.ok(Math.abs(springAt(5, s) - 1) < 1e-3);
  }
  const critical = springLinear({ stiffness: 100, damping: 20 });
  assert.ok(critical.overshoot < 1e-6, 'a critically damped spring does not overshoot');
  const bouncy = springLinear({ stiffness: 260, damping: 16 });
  assert.ok(bouncy.overshoot > 0.1);
  assert.ok(settleTime({ stiffness: 400, damping: 32 }) < settleTime({ stiffness: 170, damping: 26 }));
});

test('spring: linear() output is well formed, compact and close to the curve', () => {
  const spring = { stiffness: 260, damping: 16 };
  const s = springLinear(spring);
  assert.match(s.easing, /^linear\(0, .*, 1\)$/);
  assert.ok(s.points.length < 40, `${s.points.length} stops`);
  const xs = s.points.map((p) => p[0]);
  assert.deepEqual(xs, [...xs].sort((a, b) => a - b));
  // Interpolating the stops stays within 1% of the exact spring.
  for (let i = 0; i <= 200; i++) {
    const x = i / 200;
    const k = s.points.findIndex((p) => p[0] >= x);
    const [x1, y1] = s.points[k];
    const [x0, y0] = s.points[Math.max(0, k - 1)];
    const y = x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    assert.ok(Math.abs(y - springAt((x * s.duration) / 1000, spring)) < 0.01, `x=${x}`);
  }
  assert.match(springCss('spring-x', spring), /^--spring-x: linear\(.*\);\n--spring-x-duration: \d+ms;$/);
});

test('spring: bad input fails loudly', () => {
  assert.throws(() => springLinear({ damping: 0 }), /damping must be a positive number/);
  assert.throws(() => springLinear({ stiffness: -1 }), /stiffness must be a positive number/);
  assert.throws(() => springLinear({ stiffness: 100, damping: 0.001 }), /does not settle/);
});
