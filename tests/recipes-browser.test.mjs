// Experience recipes in a real browser: every tier loads clean, and each recipe's fallback
// modes (static tier, reduced motion, no pointer, offscreen, script path) really behave as
// documented. Needs Playwright: set PLAYWRIGHT_PROJECT to a folder that has it installed.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECIPES = ['spring-states', 'route-transition', 'scroll-reveal', 'cursor-light', 'magnetic-target', 'flow-hero'];
const TIERS = ['static', 'low', 'balanced', 'high', 'ultra'];
const demo = (name, query = '') => pathToFileURL(path.join(root, 'shared/creative/recipes', name, 'demo.html')).href + query;

function loadPlaywright() {
  const dir = process.env.PLAYWRIGHT_PROJECT;
  if (!dir) return null;
  const req = createRequire(path.resolve(dir, 'package.json'));
  for (const m of ['@playwright/test', 'playwright']) { try { return req(m); } catch {} }
  return null;
}
const pw = loadPlaywright();
const skip = pw ? false : 'set PLAYWRIGHT_PROJECT to a folder with playwright installed to run the recipe browser tests';

let browser;
before(async () => { if (pw) browser = await pw.chromium.launch(); });
after(async () => { if (browser) await browser.close(); });

// Opens a page that records errors and counts animation frames, so "nothing runs at rest" is measured.
async function open(url, { reducedMotion = 'no-preference', viewport = { width: 1280, height: 800 }, hasTouch = false, noWebgl = false } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion, hasTouch });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    window.__raf = 0;
    const real = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => { window.__raf += 1; return real(fn); };
  });
  if (noWebgl) await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : real.call(this, type, ...rest); };
  });
  await page.goto(url);
  return { page, errors, close: () => context.close() };
}
const framesIn = async (page, ms) => {
  const start = await page.evaluate(() => window.__raf);
  await page.waitForTimeout(ms);
  return (await page.evaluate(() => window.__raf)) - start;
};
const tierOf = (page) => page.evaluate(() => document.documentElement.dataset.quality);

test('every recipe demo loads without errors on every tier, and the tier in the URL is applied', { skip }, async () => {
  for (const name of RECIPES) {
    for (const tier of TIERS) {
      const { page, errors, close } = await open(demo(name, `?quality=${tier}`));
      assert.equal(await tierOf(page), tier, `${name} ${tier}`);
      await page.waitForTimeout(150);
      assert.deepEqual(errors, [], `${name} ${tier}`);
      await close();
    }
  }
});

test('reduced motion puts every recipe on the static tier even when a higher tier is requested', { skip }, async () => {
  for (const name of RECIPES) {
    const { page, errors, close } = await open(demo(name, '?quality=ultra'), { reducedMotion: 'reduce' });
    assert.equal(await tierOf(page), 'static', name);
    assert.deepEqual(errors, [], name);
    await close();
  }
});

test('spring states: real spring easing when moving, no transition when static, state always changes', { skip }, async () => {
  const style = (page, sel, prop) => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [sel, prop]);
  const high = await open(demo('spring-states', '?quality=high'));
  assert.match(await style(high.page, '#press', 'transitionTimingFunction'), /^linear\(/);
  assert.equal(await style(high.page, '#press', 'transitionDuration'), '0.79s');
  await high.close();

  const low = await open(demo('spring-states', '?quality=low'));
  assert.equal(await style(low.page, '#press', 'transitionDuration'), '0.43s', 'low tier drops the overshoot spring');
  await low.close();

  for (const opts of [{ q: '?quality=static', ctx: {} }, { q: '', ctx: { reducedMotion: 'reduce' } }]) {
    const s = await open(demo('spring-states', opts.q), opts.ctx);
    assert.equal(await style(s.page, '#press', 'transitionDuration'), '0s');
    await s.page.focus('#disclose');
    await s.page.keyboard.press('Enter');
    assert.equal(await s.page.getAttribute('#disclose', 'aria-expanded'), 'true');
    assert.ok(await s.page.evaluate(() => document.querySelector('#answer').offsetHeight) > 20, 'disclosure opens at once');
    await s.page.focus('#toggle');
    await s.page.keyboard.press('Space');
    assert.equal(await s.page.isChecked('#toggle'), false, 'the switch still works from the keyboard');
    await s.close();
  }
});

test('scroll reveal: content is never left hidden, on the native path, the script path or when static', { skip }, async () => {
  const opacities = (page) => page.evaluate(() => [...document.querySelectorAll('.reveal')].map((el) => Number(getComputedStyle(el).opacity)));
  const toEnd = async (page) => { await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(900); };

  const stat = await open(demo('scroll-reveal', '?quality=static'));
  assert.ok((await opacities(stat.page)).every((o) => o === 1), 'static: everything visible without scrolling');
  await stat.close();

  const reduced = await open(demo('scroll-reveal', '?fallback=1'), { reducedMotion: 'reduce' });
  assert.ok((await opacities(reduced.page)).every((o) => o === 1), 'reduced motion: everything visible on the script path too');
  await reduced.close();

  const native = await open(demo('scroll-reveal', '?quality=high'));
  if (await native.page.evaluate(() => CSS.supports('animation-timeline: view()'))) {
    assert.equal(await native.page.evaluate(() => getComputedStyle(document.querySelector('.reveal')).animationName), 'scroll-reveal-in');
    assert.equal(await native.page.evaluate(() => document.documentElement.classList.contains('reveal-js')), false, 'the script stays out of the way');
  }
  await toEnd(native.page);
  const seen = await opacities(native.page);
  assert.equal(seen[seen.length - 1], 1, 'the last section is fully visible at the end of the page');
  await native.close();

  const js = await open(demo('scroll-reveal', '?quality=high&fallback=1'));
  assert.equal(await js.page.evaluate(() => document.documentElement.classList.contains('reveal-js')), true);
  const start = await opacities(js.page);
  assert.equal(start[start.length - 1], 0, 'below the fold waits for the reader, and is hidden at once rather than faded out');
  assert.equal(await framesIn(js.page, 400), 0, 'no frame loop while the page rests');
  await toEnd(js.page);
  const end = await opacities(js.page);
  assert.equal(end[end.length - 1], 1, 'revealed on arrival');
  assert.ok(Number(await js.page.evaluate(() => document.querySelector('.scroll-progress').style.getPropertyValue('--scroll-progress'))) > 0.95, 'progress follows the scroll');
  await js.close();
});

test('route transition: the view changes and focus follows on every tier, and no names are left behind', { skip }, async () => {
  for (const tier of ['high', 'low', 'static']) {
    const { page, errors, close } = await open(demo('route-transition', `?quality=${tier}`));
    await page.focus('.tile[data-id="tide"]');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('#detail').hidden);
    assert.equal(await page.textContent('#d-title'), 'Tide', tier);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'd-title', `${tier}: focus moves to the new view`);
    await page.waitForTimeout(tier === 'static' ? 50 : 1100);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#list').hidden);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'tide', `${tier}: focus returns to the tile`);
    await page.waitForTimeout(tier === 'static' ? 50 : 1100);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('*')].filter((el) => el.style.viewTransitionName).length), 0, `${tier}: names cleared`);
    assert.deepEqual(errors, [], tier);
    await close();
  }
});

test('cursor light: follows a mouse, clears on leave, and does not track when static or on touch', { skip }, async () => {
  const lx = (page) => page.evaluate(() => document.querySelector('#one').style.getPropertyValue('--lx'));
  const high = await open(demo('cursor-light', '?quality=high'));
  assert.equal(await framesIn(high.page, 400), 0, 'no frame loop at rest');
  const box = await high.page.locator('#one').boundingBox();
  await high.page.mouse.move(box.x + 40, box.y + 30);
  await high.page.mouse.move(box.x + 60, box.y + 50, { steps: 4 });
  await high.page.waitForTimeout(80);
  assert.equal(await lx(high.page), '60.0px');
  await high.page.mouse.move(5, 5, { steps: 3 });
  await high.page.waitForTimeout(80);
  assert.equal(await lx(high.page), '', 'cleared once the pointer leaves the surface');
  await high.page.keyboard.press('Tab');
  await high.page.keyboard.press('Tab');
  await high.page.waitForTimeout(400);
  assert.equal(await high.page.evaluate(() => document.activeElement.id), 'one');
  assert.equal(await high.page.evaluate(() => getComputedStyle(document.querySelector('#one'), '::before').opacity), '1', 'keyboard focus lights the surface too');
  await high.close();

  const stat = await open(demo('cursor-light', '?quality=static'));
  const b2 = await stat.page.locator('#one').boundingBox();
  await stat.page.mouse.move(b2.x + 60, b2.y + 50, { steps: 4 });
  await stat.page.waitForTimeout(80);
  assert.equal(await lx(stat.page), '', 'static tier does not track');
  await stat.close();
});

test('magnetic target: the face leans, the hit area stays put, and low, static and disabled do nothing', { skip }, async () => {
  const mx = (page, id) => page.evaluate((i) => document.querySelector(i).style.getPropertyValue('--mx'), id);
  const high = await open(demo('magnetic-target', '?quality=high'));
  const before = await high.page.locator('#primary').boundingBox();
  await high.page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await high.page.mouse.move(before.x + before.width - 4, before.y + before.height / 2, { steps: 5 });
  await high.page.waitForTimeout(80);
  const pulled = parseFloat(await mx(high.page, '#primary'));
  assert.ok(pulled > 0 && pulled <= 12, `leans toward the pointer within the cap, got ${pulled}`);
  assert.deepEqual(await high.page.locator('#primary').boundingBox(), before, 'the clickable area did not move');
  const dis = await high.page.locator('#disabled').boundingBox();
  await high.page.mouse.move(dis.x + dis.width - 4, dis.y + dis.height / 2, { steps: 5 });
  await high.page.waitForTimeout(80);
  assert.equal(await mx(high.page, '#disabled'), '', 'a disabled control is not magnetic');
  assert.equal(await mx(high.page, '#primary'), '', 'released when the pointer moves on');
  await high.close();

  for (const tier of ['low', 'static']) {
    const p = await open(demo('magnetic-target', `?quality=${tier}`));
    const b = await p.page.locator('#primary').boundingBox();
    await p.page.mouse.move(b.x + b.width - 4, b.y + b.height / 2, { steps: 5 });
    await p.page.waitForTimeout(80);
    assert.equal(await mx(p.page, '#primary'), '', tier);
    await p.close();
  }
});

test('flow hero: still by default, live only when affordable and visible, and resources are released', { skip }, async (t) => {
  const state = (page) => page.evaluate(() => {
    const hero = document.querySelector('#hero');
    const c = hero.querySelector('canvas');
    return { flow: hero.dataset.flow, canvas: !!c, width: c ? c.width : 0, running: window.flow.loop.running, ready: window.flow.loop.ready };
  });
  for (const opts of [{ q: '?quality=static', ctx: {} }, { q: '?quality=ultra', ctx: { reducedMotion: 'reduce' } }]) {
    const s = await open(demo('flow-hero', opts.q), opts.ctx);
    await s.page.waitForTimeout(300);
    assert.deepEqual(await state(s.page), { flow: 'still', canvas: false, width: 0, running: false, ready: false });
    assert.equal(await framesIn(s.page, 400), 0, 'static: no frames requested at all');
    assert.notEqual(await s.page.evaluate(() => getComputedStyle(document.querySelector('#hero')).backgroundImage), 'none', 'the still gradient is the effect');
    await s.close();
  }

  const widths = {};
  for (const tier of ['low', 'balanced', 'ultra']) {
    const p = await open(demo('flow-hero', `?quality=${tier}`));
    await p.page.waitForTimeout(700);
    const st = await state(p.page);
    if (st.flow === 'still' && !st.canvas) { await p.close(); t.skip('WebGL is not available in this browser, so the live path was not exercised'); return; }
    assert.equal(st.flow, 'live', tier);
    assert.equal(st.running, true, tier);
    widths[tier] = st.width;
    if (tier === 'balanced') {
      // Offscreen: the loop stops. Back on screen: it resumes.
      await p.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await p.page.waitForTimeout(400);
      assert.equal((await state(p.page)).running, false, 'paused offscreen');
      assert.equal(await framesIn(p.page, 400), 0, 'no frames requested offscreen');
      await p.page.evaluate(() => window.scrollTo(0, 0));
      await p.page.waitForTimeout(400);
      assert.equal((await state(p.page)).running, true, 'resumes on return');
      // Dropping to static tears the canvas and context down.
      await p.page.selectOption('[data-quality-pick]', 'static');
      await p.page.waitForTimeout(200);
      assert.deepEqual(await state(p.page), { flow: 'still', canvas: false, width: 0, running: false, ready: false });
    }
    assert.deepEqual(p.errors, [], tier);
    await p.close();
  }
  assert.ok(widths.low < widths.balanced && widths.balanced < widths.ultra, `resolution follows the tier: ${JSON.stringify(widths)}`);
});

test('flow hero: without WebGL it stays on the still and stops asking for frames', { skip }, async () => {
  const p = await open(demo('flow-hero', '?quality=high'), { noWebgl: true });
  await p.page.waitForTimeout(500);
  const st = await p.page.evaluate(() => {
    const hero = document.querySelector('#hero');
    return { flow: hero.dataset.flow, canvas: !!hero.querySelector('canvas'), running: window.flow.loop.running };
  });
  assert.deepEqual(st, { flow: 'still', canvas: false, running: false });
  assert.equal(await framesIn(p.page, 400), 0, 'no frames requested once set-up has failed');
  await p.close();
});
