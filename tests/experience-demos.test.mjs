// The three experience demos in a real browser: they load clean on every tier and in both
// themes, their one interaction works by keyboard and by touch, nothing overflows on a phone,
// and each keeps its stated cost at rest. Needs Playwright: set PLAYWRIGHT_PROJECT.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMOS = ['index', 'signal', 'field-notes', 'lantern'];
const TIERS = ['static', 'low', 'balanced', 'high', 'ultra'];
const PHONE = { width: 390, height: 844 };
const demo = (name, query = '') => pathToFileURL(path.join(root, 'demos/experience', `${name}.html`)).href + query;

function loadPlaywright() {
  const dir = process.env.PLAYWRIGHT_PROJECT;
  if (!dir) return null;
  const req = createRequire(path.resolve(dir, 'package.json'));
  for (const m of ['@playwright/test', 'playwright']) { try { return req(m); } catch {} }
  return null;
}
const pw = loadPlaywright();
const skip = pw ? false : 'set PLAYWRIGHT_PROJECT to a folder with playwright installed to run the demo browser tests';

let browser;
before(async () => { if (pw) browser = await pw.chromium.launch(); });
after(async () => { if (browser) await browser.close(); });

async function open(url, { reducedMotion = 'no-preference', viewport = { width: 1280, height: 800 }, hasTouch = false, colorScheme = 'dark' } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion, hasTouch, colorScheme });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
  await page.addInitScript(() => {
    window.__raf = 0;
    const real = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => { window.__raf += 1; return real(fn); };
  });
  await page.goto(url);
  return { page, errors, close: () => context.close() };
}
const framesIn = async (page, ms) => {
  const start = await page.evaluate(() => window.__raf);
  await page.waitForTimeout(ms);
  return (await page.evaluate(() => window.__raf)) - start;
};

test('every demo loads without errors on every tier, in both themes', { skip }, async () => {
  for (const name of DEMOS) {
    for (const tier of TIERS) {
      for (const colorScheme of ['light', 'dark']) {
        const { page, errors, close } = await open(demo(name, `?quality=${tier}`), { colorScheme });
        await page.waitForTimeout(120);
        assert.deepEqual(errors, [], `${name} ${tier} ${colorScheme}`);
        if (name !== 'index') assert.equal(await page.evaluate(() => document.documentElement.dataset.quality), tier, `${name} ${tier}`);
        await close();
      }
    }
  }
});

test('no demo scrolls sideways on a phone', { skip }, async () => {
  for (const name of DEMOS) {
    const { page, close } = await open(demo(name), { viewport: PHONE, hasTouch: true });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 0, `${name} overflows by ${over}px`);
    await close();
  }
});

test('the three demos do not share a typeface, a background or an accent', { skip }, async () => {
  const looks = [];
  for (const name of ['signal', 'field-notes', 'lantern']) {
    const { page, close } = await open(demo(name));
    looks.push(await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return { font: getComputedStyle(document.querySelector('h1')).fontFamily.split(',')[0], bg: root.getPropertyValue('--bg') || root.getPropertyValue('--paper'), accent: root.getPropertyValue('--accent') };
    }));
    await close();
  }
  for (const key of ['font', 'bg', 'accent']) {
    assert.equal(new Set(looks.map((l) => l[key].trim())).size, 3, `${key}: ${JSON.stringify(looks.map((l) => l[key]))}`);
  }
});

test('signal: opens a service and returns by keyboard, with focus following, and draws nothing at rest', { skip }, async () => {
  const { page, errors, close } = await open(demo('signal'));
  await page.waitForTimeout(300);
  assert.equal(await framesIn(page, 600), 0, 'frames requested while the list is at rest');
  assert.equal(await page.locator('#rows tr').count(), 10);

  await page.locator('#rows .open').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.getElementById('detail').hidden && document.activeElement.id === 'd-name');
  assert.equal(await page.locator('#d-name').textContent(), 'checkout-api');
  assert.equal(await page.locator('#list').isHidden(), true);
  assert.match(page.url(), /#checkout-api$/);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('detail').hidden && document.activeElement.dataset.id === 'checkout-api');
  assert.doesNotMatch(page.url(), /#/);
  await page.waitForTimeout(500);
  assert.equal(await framesIn(page, 600), 0, 'frames requested after returning to the list');

  // The filter changes what is listed, and the tally matches the rows.
  await page.locator('#only').focus();
  await page.keyboard.press('Space');
  const attention = await page.locator('#rows tr').count();
  const tally = await page.evaluate(() => +document.getElementById('n-warn').textContent + +document.getElementById('n-down').textContent);
  assert.equal(attention, tally);
  assert.ok(attention > 0 && attention < 10);

  // The legend discloses and says so to assistive technology.
  await page.locator('#legend-btn').click();
  assert.equal(await page.locator('#legend-btn').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#legend').getAttribute('data-open'), 'true');
  assert.deepEqual(errors, []);
  await close();
});

test('signal: the list is complete in the first paint, so nothing shifts on a slow processor', { skip }, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(demo('signal'), { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const shift = await page.evaluate(() => new Promise((done) => {
    let total = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) total += e.value; }).observe({ type: 'layout-shift', buffered: true });
    setTimeout(() => done(total), 300);
  }));
  assert.equal(shift, 0, `layout shift ${shift}`);
  await context.close();
});

test('signal: a deep link opens the service directly, and the view change still works with reduced motion', { skip }, async () => {
  const { page, errors, close } = await open(demo('signal') + '#media-resize', { reducedMotion: 'reduce' });
  await page.waitForFunction(() => !document.getElementById('detail').hidden);
  assert.equal(await page.locator('#d-name').textContent(), 'media-resize');
  assert.equal(await page.locator('#d-state').getAttribute('data-s'), 'down');
  await page.locator('#back').click();
  await page.waitForFunction(() => document.getElementById('detail').hidden);
  assert.deepEqual(errors, []);
  await close();
});

test('signal: a tap opens a service on a phone', { skip }, async () => {
  const { page, errors, close } = await open(demo('signal'), { viewport: PHONE, hasTouch: true });
  await page.locator('#rows .open').nth(3).tap();
  await page.waitForFunction(() => !document.getElementById('detail').hidden);
  assert.equal(await page.locator('#d-name').textContent(), 'media-resize');
  assert.deepEqual(errors, []);
  await close();
});

test('field notes: every block ends visible, footnotes open in place, no script frames at rest', { skip }, async () => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const { page, errors, close } = await open(demo('field-notes'), { reducedMotion });
    await page.waitForTimeout(300);
    assert.equal(await framesIn(page, 600), 0, `frames at rest (${reducedMotion})`);
    // Scroll to the end: every revealed block must end fully visible.
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(900);
    const hidden = await page.evaluate(() => [...document.querySelectorAll('.more .reveal')].filter((n) => +getComputedStyle(n).opacity < 0.99).length);
    assert.equal(hidden, 0, `cards still faded at the end of the page (${reducedMotion})`);

    const note = page.locator('.fn').first();
    await note.focus();
    await page.keyboard.press('Enter');
    assert.equal(await note.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#fn1').getAttribute('data-open'), 'true');
    assert.equal(await page.locator('#bars rect').count(), 12);
    assert.deepEqual(errors, []);
    await close();
  }
});

test('lantern: the shader runs only above the static tier, and the slider changes the sky on every tier', { skip }, async () => {
  const still = await open(demo('lantern', '?quality=static'));
  await still.page.waitForTimeout(400);
  assert.equal(await still.page.locator('#hero canvas').count(), 0, 'static tier must not create a canvas');
  assert.equal(await still.page.locator('#hero').getAttribute('data-flow'), 'still');
  assert.equal(await framesIn(still.page, 600), 0, 'frames at rest on the static tier');
  const before = await still.page.evaluate(() => getComputedStyle(document.getElementById('hero')).getPropertyValue('--flow-c'));
  await still.page.locator('#hour').focus();
  for (let i = 0; i < 40; i++) await still.page.keyboard.press('ArrowRight');
  await still.page.waitForTimeout(100);
  const afterC = await still.page.evaluate(() => getComputedStyle(document.getElementById('hero')).getPropertyValue('--flow-c'));
  assert.notEqual(afterC, before, 'the still gradient follows the slider');
  assert.match(await still.page.locator('#hour-out').textContent(), /^Midnight · \d\d:\d\d$/);
  assert.deepEqual(still.errors, []);
  await still.close();

  const reduced = await open(demo('lantern', '?quality=ultra'), { reducedMotion: 'reduce' });
  await reduced.page.waitForTimeout(400);
  assert.equal(await reduced.page.locator('#hero canvas').count(), 0, 'reduced motion must not create a canvas');
  assert.deepEqual(reduced.errors, []);
  await reduced.close();

  const live = await open(demo('lantern', '?quality=low'));
  await live.page.waitForFunction(() => document.getElementById('hero').dataset.flow === 'live', null, { timeout: 5000 });
  assert.ok(await framesIn(live.page, 500) > 3, 'the shader draws while the hero is on screen');
  await live.page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await live.page.waitForTimeout(800);
  assert.ok(await framesIn(live.page, 600) <= 2, 'the shader stops once the hero is off screen');
  // Regression: with the hero's bottom edge exactly on the viewport's top edge (which an observer
  // still calls intersecting, and which sat inside the old 100px margin) it must also be stopped.
  await live.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await live.page.waitForFunction(() => document.getElementById('hero').dataset.flow === 'live');
  await live.page.evaluate(() => window.scrollTo({ top: document.getElementById('hero').getBoundingClientRect().bottom + scrollY, behavior: 'instant' }));
  await live.page.waitForTimeout(500);
  assert.ok(await framesIn(live.page, 600) <= 2, 'the shader stops as soon as the hero leaves the viewport');
  assert.deepEqual(live.errors, []);
  await live.close();
});

// Regression: the readout sat in an auto-width grid column, so "Midnight · 00:00" widened it and
// shrank the slider by about 20px under the pointer. On the static tier that reflow left a key
// release waiting about 520ms for a paint (Event Timing), which field INP would count.
test('lantern: the slider keeps its width while the readout changes, at desktop and phone widths', { skip }, async () => {
  for (const viewport of [{ width: 1440, height: 900 }, PHONE]) {
    const { page, errors, close } = await open(demo('lantern', '?quality=static'), { viewport });
    await page.locator('#hour').focus();
    const sizes = [];
    for (const key of ['Home', 'PageUp', 'End']) {
      if (key === 'PageUp') await page.evaluate(() => { const h = document.getElementById('hour'); h.value = 50; h.dispatchEvent(new Event('input')); });
      else await page.keyboard.press(key);
      await page.waitForTimeout(80);
      sizes.push(await page.evaluate(() => ({
        text: document.getElementById('hour-out').textContent,
        slider: Math.round(document.getElementById('hour').getBoundingClientRect().width * 10) / 10,
      })));
    }
    assert.deepEqual(sizes.map((s) => s.text.split(' ')[0]), ['Dusk', 'Midnight', 'Dawn'], `${viewport.width}px readouts`);
    assert.equal(new Set(sizes.map((s) => s.slider)).size, 1, `${viewport.width}px slider widths ${JSON.stringify(sizes)}`);
    assert.deepEqual(errors, []);
    await close();
  }
});

test('lantern: on touch the call to action stays put and still navigates', { skip }, async () => {
  const { page, errors, close } = await open(demo('lantern', '?quality=balanced'), { viewport: PHONE, hasTouch: true });
  await page.locator('#hero .magnetic').tap();
  await page.waitForFunction(() => location.hash === '#rooms');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#hero .magnetic__inner')).getPropertyValue('--mx').trim() || '0px'), '0px');
  assert.deepEqual(errors, []);
  await close();
});
