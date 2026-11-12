#!/usr/bin/env node
// Before/after screenshots of the running app, per route, theme and viewport, with a pixel diff
// and a noise floor, written as ui.json plus a side-by-side report.html.
//
// node capture.mjs --project <dir with Playwright> --before <url> --after <url> --routes "/,/settings"
//   --out <dir> [--themes dark,light] [--theme-attr data-theme | --theme-storage <key>]
//   [--theme-value dark=deep-forge,light=ivory-graphite] [--viewports desktop=1440x900,mobile=390x844]
//   [--wait 800] [--viewport-only] [--mask ".clock,[data-live]"] [--before-label main]
//   [--after-label my-branch] [--backend backend.json] [--title "..."]
//
// Exit codes: 0 every view compared, 2 some views not checked (capture failed), 1 usage error.
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { badRoute, classifyShot, diffRgba, renderReport, validateBackend } from './lib/review.mjs';

const { values: o } = parseArgs({
  options: {
    project: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' },
    routes: { type: 'string' }, out: { type: 'string' },
    themes: { type: 'string', default: 'dark,light' }, 'theme-attr': { type: 'string' },
    'theme-storage': { type: 'string' }, 'theme-value': { type: 'string', default: '' },
    viewports: { type: 'string', default: 'desktop=1440x900,mobile=390x844' },
    wait: { type: 'string', default: '800' }, 'viewport-only': { type: 'boolean', default: false },
    mask: { type: 'string', default: '' }, 'before-label': { type: 'string', default: 'before' },
    'after-label': { type: 'string', default: 'after' }, backend: { type: 'string' },
    title: { type: 'string', default: 'Change review' },
  },
});
const need = ['project', 'before', 'after', 'routes', 'out'].filter((k) => !o[k]);
if (need.length) {
  console.error(`missing --${need.join(', --')}\nsee the header of capture.mjs for usage`);
  process.exit(1);
}
const local = (u) => {
  const h = new URL(u).hostname;
  return ['localhost', '127.0.0.1', '[::1]'].includes(h) || h.endsWith('.localhost') || h.endsWith('.test');
};
for (const k of ['before', 'after']) {
  if (!local(o[k])) console.warn(`note: --${k} ${o[k]} is not a local dev host; only read the page, never submit anything`);
}

const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
const routes = list(o.routes).map((r) => (r.startsWith('/') ? r : `/${r}`));
const routeProblems = routes.map(badRoute).filter(Boolean);
if (routeProblems.length) {
  console.error(routeProblems.join('\n'));
  process.exit(1);
}
const themes = list(o.themes);
const themeValue = Object.fromEntries(list(o['theme-value']).map((p) => p.split('=')));
const viewports = list(o.viewports).map((v) => {
  const [name, size] = v.includes('=') ? v.split('=') : [v, v];
  const [width, height] = size.split('x').map(Number);
  if (!width || !height) throw new Error(`bad viewport "${v}" (use name=WIDTHxHEIGHT)`);
  return { name, width, height };
});
const waitMs = Number(o.wait) || 0;
const masks = list(o.mask);
const out = path.resolve(o.out);
fs.mkdirSync(path.join(out, 'shots'), { recursive: true });

let backend = null;
if (o.backend) {
  backend = JSON.parse(fs.readFileSync(o.backend, 'utf8'));
  const problems = validateBackend(backend);
  if (problems.length) {
    console.error(`backend cards rejected:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
}

const require = createRequire(path.resolve(o.project, 'package.json'));
let chromium;
for (const m of ['@playwright/test', 'playwright']) {
  try {
    ({ chromium } = require(m));
    break;
  } catch {}
}
if (!chromium) {
  console.error(`Playwright not found from ${o.project}. Point --project at a folder where @playwright/test or playwright is installed.`);
  process.exit(1);
}

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
const browser = await chromium.launch();

async function shoot(baseUrl, route, theme, vp, file) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: theme === 'light' ? 'light' : 'dark', reducedMotion: 'reduce' });
  const value = themeValue[theme] || theme;
  if (o['theme-storage']) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [o['theme-storage'], value]);
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 400)));
  page.on('pageerror', (e) => consoleErrors.push(String(e?.message || e).slice(0, 400)));
  try {
    const res = await page.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle', timeout: 60_000 });
    const status = res?.status() ?? 0;
    if (status === 404) return { missing: true, status, consoleErrors };
    if (status >= 400) return { error: `HTTP ${status}`, status, consoleErrors };
    // Streamed not-found pages (Next.js and others) can arrive with HTTP 200.
    if (/\b(404|not found|page not found)\b/i.test(await page.title())) return { missing: true, status, consoleErrors };
    // Dev-server overlays (Next.js issue badge) are tooling, not the app's interface.
    await page.addStyleTag({ content: 'nextjs-portal, #__next-build-watcher, vite-error-overlay { display: none !important; }' });
    const attr = o['theme-attr'];
    const setTheme = () => page.evaluate(([a, v]) => document.documentElement.setAttribute(a, v), [attr, value]);
    const themeNow = () => page.evaluate((a) => document.documentElement.getAttribute(a), attr);
    if (attr) await setTheme();
    await page.evaluate(() => document.fonts?.ready);
    if (waitMs) await page.waitForTimeout(waitMs);
    // Hydration or a theme script can reset the attribute after it was set; re-apply once.
    if (attr && (await themeNow()) !== value) {
      await setTheme();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: path.join(out, file), fullPage: !o['viewport-only'], animations: 'disabled', caret: 'hide', mask: masks.map((s) => page.locator(s)) });
    if (attr && (await themeNow()) !== value) {
      fs.rmSync(path.join(out, file), { force: true });
      return { error: `theme "${value}" did not stay applied (${attr}="${await themeNow()}")`, status, consoleErrors };
    }
    return { file, status, consoleErrors };
  } catch (e) {
    return { error: String(e?.message || e).split('\n')[0].slice(0, 200), consoleErrors };
  } finally {
    await ctx.close();
  }
}

// The diff runs in the browser (canvas decodes the PNGs), using the same tested function.
const diffPage = await (await browser.newContext()).newPage();
await diffPage.setContent('<canvas></canvas>');
async function diff(fileA, fileB, overlayFile) {
  const a = fs.readFileSync(path.join(out, fileA)).toString('base64');
  const b = fs.readFileSync(path.join(out, fileB)).toString('base64');
  const r = await diffPage.evaluate(async ([a, b, fn, wantOverlay]) => {
    const load = (d) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = `data:image/png;base64,${d}`; });
    const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const diffRgba = new Function(`return (${fn})`)();
    const d = diffRgba(px(ia), ia.width, ia.height, px(ib), ib.width, ib.height);
    let png = null;
    if (wantOverlay) {
      const c = document.querySelector('canvas'); c.width = d.width; c.height = d.height;
      c.getContext('2d').putImageData(new ImageData(d.overlay, d.width, d.height), 0, 0);
      png = c.toDataURL('image/png').split(',')[1];
    }
    return { ratio: d.ratio, changed: d.changed, added: d.added, removed: d.removed, modified: d.modified, bbox: d.bbox, png };
  }, [a, b, diffRgba.toString(), Boolean(overlayFile)]);
  if (overlayFile && r.png) fs.writeFileSync(path.join(out, overlayFile), Buffer.from(r.png, 'base64'));
  return r;
}

const shots = [];
for (const route of routes) {
  for (const theme of themes) {
    for (const vp of viewports) {
      const id = `${slug(route)}--${slug(theme)}--${vp.name}`;
      const before = await shoot(o.before, route, theme, vp, `shots/${id}--before.png`);
      const after = await shoot(o.after, route, theme, vp, `shots/${id}--after.png`);
      const shot = { route, theme, viewport: `${vp.name} ${vp.width}×${vp.height}`, before, after, baseLabel: o['before-label'], headLabel: o['after-label'] };
      if (before.file && after.file) {
        const again = await shoot(o.after, route, theme, vp, `shots/${id}--after-again.png`);
        try {
          const d = await diff(before.file, after.file, `shots/${id}--diff.png`);
          shot.ratio = d.ratio;
          shot.changedPixels = d.changed;
          Object.assign(shot, { added: d.added, removed: d.removed, modified: d.modified });
          shot.bbox = d.bbox;
          shot.diffFile = `shots/${id}--diff.png`;
          if (again.file) shot.noise = (await diff(after.file, again.file, null)).ratio;
          else shot.noiseError = again.error || 'second capture failed';
        } catch (e) {
          shot.diffError = String(e?.message || e).slice(0, 200);
        }
        if (again.file) fs.rmSync(path.join(out, again.file), { force: true });
      }
      Object.assign(shot, classifyShot(shot));
      shots.push(shot);
      console.log(`${shot.status.padEnd(11)} ${route} ${theme} ${vp.name}  ${shot.reason}`);
    }
  }
}
// A theme switch that did not apply gives identical pictures per theme; say so loudly.
const notes = [];
if (themes.length > 1) {
  for (const route of routes) {
    for (const vp of viewports) {
      const same = shots.filter((s) => s.route === route && s.viewport.startsWith(`${vp.name} `) && s.after.file);
      if (same.length < 2) continue;
      const d = await diff(same[0].after.file, same[1].after.file, null).catch(() => null);
      if (d && d.ratio === 0) {
        const msg = `${route} ${vp.name}: the ${same[0].theme} and ${same[1].theme} pictures are identical, so the theme switch probably did not apply (check --theme-attr/--theme-storage and --theme-value).`;
        notes.push(msg);
        console.warn(`warning: ${msg}`);
      }
    }
  }
}
await browser.close();

const ui ={ before: o.before, after: o.after, generated: new Date().toISOString(), shots };
fs.writeFileSync(path.join(out, 'ui.json'), JSON.stringify(ui, null, 2));
if (shots.some((s) => s.noiseError)) notes.push('Some views could not be captured twice, so their noise floor is unknown and any difference is reported as a change.');
fs.writeFileSync(path.join(out, 'report.html'), renderReport({ title: o.title, base: o['before-label'], head: o['after-label'], generated: ui.generated.slice(0, 16).replace('T', ' '), ui, backend, notes }));
const unchecked = shots.filter((s) => s.status === 'not-checked').length;
console.log(`\nreport: ${path.join(out, 'report.html')}${unchecked ? `\n${unchecked} view(s) NOT checked; see the report` : ''}`);
process.exit(unchecked ? 2 : 0);
