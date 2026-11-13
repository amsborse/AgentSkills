#!/usr/bin/env node
// Deterministic visual audit of a running page with Playwright: screenshots across viewports and
// themes, plus measured checks a script can actually prove (overflow, console errors, contrast,
// focus visibility, hover side effects, reduced motion, offscreen render loops, layout shift,
// long frames, broken images, tap targets). It never judges taste: the report says so and points
// at the screenshots for the human or model critique.
//
//   node visual-audit.mjs --url http://localhost:3000 [--project DIR] [--out DIR]
//     [--viewports desktop=1440x900,tablet=834x1112,mobile=390x844] [--themes light,dark]
//     [--hover 6] [--tabs 12] [--settle 800] [--allow-remote] [--json]
//
// --project is the folder whose node_modules has playwright or @playwright/test (default: cwd).
// If axe-core is installed there too, its WCAG AA rules run as an extra check.
// Exit codes: 0 pass, 3 blocker or major findings, 2 audit incomplete, 1 usage error.
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseViewports, isLocalUrl, rafRate, findingsForView, findingsForMotion, findingsForInteraction,
  themeFindings, summarize, mergeFindings, renderMarkdown,
} from './lib/audit.mjs';

const { values: o } = parseArgs({
  options: {
    url: { type: 'string' },
    project: { type: 'string', default: process.cwd() },
    out: { type: 'string' },
    viewports: { type: 'string', default: 'desktop=1440x900,tablet=834x1112,mobile=390x844' },
    themes: { type: 'string', default: 'light,dark' },
    hover: { type: 'string', default: '6' },
    tabs: { type: 'string', default: '12' },
    settle: { type: 'string', default: '800' },
    'allow-remote': { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

const usage = (msg) => {
  if (msg) console.error(`error: ${msg}`);
  console.error('usage: node visual-audit.mjs --url URL [--project DIR] [--out DIR] [--viewports name=WxH,...] [--themes light,dark] [--hover N] [--tabs N] [--settle MS] [--allow-remote] [--json]');
  process.exit(msg ? 1 : 0);
};
if (o.help) usage();
if (!o.url) usage('--url is required');
let viewports, themes;
try {
  new URL(o.url);
  viewports = parseViewports(o.viewports);
  themes = o.themes.split(',').map((t) => t.trim()).filter(Boolean);
  if (!themes.length || themes.some((t) => !['light', 'dark'].includes(t))) throw new Error('--themes takes light and/or dark');
} catch (e) { usage(e.message); }
if (!isLocalUrl(o.url) && !o['allow-remote']) {
  usage('refusing a remote URL without --allow-remote. For a third-party site, check its robots.txt and terms first, capture logged-out at a low rate, and keep only measurements and notes, never its assets.');
}
const HOVER_MAX = Math.max(0, parseInt(o.hover, 10) || 0);
const TAB_MAX = Math.max(0, parseInt(o.tabs, 10) || 0);
const SETTLE = Math.max(0, parseInt(o.settle, 10) || 0);
const outDir = path.resolve(o.out || path.join(os.tmpdir(), `visual-audit-${Date.now()}`));
fs.mkdirSync(path.join(outDir, 'evidence'), { recursive: true });

const require = createRequire(path.resolve(o.project, 'package.json'));
let chromium;
for (const m of ['@playwright/test', 'playwright']) {
  try { ({ chromium } = require(m)); break; } catch {}
}
if (!chromium) {
  console.error(`Playwright not found from ${o.project}. Point --project at a folder where @playwright/test or playwright is installed. Nothing was audited.`);
  process.exit(2);
}
let axePath = null;
try { axePath = require.resolve('axe-core/axe.min.js'); } catch {}

// Runs in the page before any app script: counts requestAnimationFrame requests (not callbacks;
// the app scheduling frames is what costs CPU), sums layout shifts and records long frames.
const INIT = () => {
  const va = (window.__va = { raf: 0, cls: 0, loaf: { count: 0, worst: 0 } });
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { va.raf++; return raf(cb); };
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) va.cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.duration > 50) { va.loaf.count++; va.loaf.worst = Math.max(va.loaf.worst, e.duration); }
    }).observe({ type: 'long-animation-frame', buffered: false });
  } catch {}
};

// Everything measured inside the page for one view. Returns plain data for lib/audit.mjs.
const PROBE = (theme) => {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.01;
  };
  const desc = (el) => {
    let d = el.tagName.toLowerCase();
    if (el.id) d += `#${el.id}`;
    else if (typeof el.className === 'string' && el.className.trim()) d += `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`;
    return d;
  };
  const all = [...document.body.querySelectorAll('*')];

  // Sideways scroll: only real when the root actually scrolls (overflow-x not hidden or clip).
  const se = document.scrollingElement || document.documentElement;
  const clipsX = (el) => ['hidden', 'clip'].includes(getComputedStyle(el).overflowX);
  const rootClips = clipsX(document.documentElement) || clipsX(document.body);
  const px = rootClips ? 0 : Math.max(0, se.scrollWidth - se.clientWidth);
  let offenders = [];
  if (px > 1) {
    const clipped = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return true; return false; };
    const wide = all.filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && !clipped(el); });
    const set = new Set(wide);
    offenders = wide.filter((el) => !set.has(el.parentElement)).slice(0, 3).map((el) => ({ sel: desc(el), right: Math.round(el.getBoundingClientRect().right) }));
  }

  const media = all.filter((el) => ['IMG', 'CANVAS', 'VIDEO', 'SVG', 'svg', 'PICTURE'].includes(el.tagName) && visible(el));
  const blank = !document.body.innerText.trim() && media.length === 0;

  // Contrast samples: elements that directly hold text. Anything under an image, canvas or
  // video, or with filters or blend modes, is counted as unknown, not measured.
  const htmlScheme = getComputedStyle(document.documentElement).colorScheme || 'normal';
  const canvas = /dark/.test(htmlScheme) ? null : { r: 255, g: 255, b: 255, a: 1 };
  let unknown = 0;
  const samples = [];
  for (const el of all) {
    if (samples.length >= 400) break;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION'].includes(el.tagName)) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!text || !visible(el)) continue;
    const r = el.getBoundingClientRect();
    let opacity = 1;
    const backgrounds = [];
    let tricky = false;
    for (let p = el; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      opacity *= Number(s.opacity);
      if (s.filter !== 'none' || s.mixBlendMode !== 'normal' || s.backdropFilter && s.backdropFilter !== 'none') tricky = true;
      backgrounds.push({ color: s.backgroundColor, image: s.backgroundImage !== 'none' });
    }
    const cx = Math.min(Math.max(r.left + r.width / 2, 0), vw - 1);
    const cy = r.top + r.height / 2;
    if (cy >= 0 && cy < vh) {
      const chain = new Set(); for (let p = el; p; p = p.parentElement) chain.add(p);
      if (document.elementsFromPoint(cx, cy).some((u) => !chain.has(u) && !el.contains(u) && ['IMG', 'CANVAS', 'VIDEO', 'PICTURE', 'svg'].includes(u.tagName))) tricky = true;
    }
    if (tricky) { unknown++; continue; }
    const s = getComputedStyle(el);
    samples.push({ sel: desc(el), text: text.slice(0, 40), color: s.color, fontSize: parseFloat(s.fontSize), fontWeight: s.fontWeight, opacity, backgrounds, canvas });
  }

  const interactive = all.filter((el) => el.matches('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[tabindex]:not([tabindex="-1"])') && visible(el));
  const targets = interactive.filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width >= 24 && r.height >= 24) return false;
    // WCAG 2.5.8 exempts links inside a sentence.
    if (el.tagName === 'A' && el.parentElement && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false;
    return true;
  }).slice(0, 20).map((el) => { const r = el.getBoundingClientRect(); return { sel: desc(el), w: Math.round(r.width), h: Math.round(r.height) }; });

  const imgs = [...document.images];
  const images = {
    broken: imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.getAttribute('src').slice(0, 120)),
    noAlt: imgs.filter((i) => !i.hasAttribute('alt')).map((i) => (i.getAttribute('src') || desc(i)).slice(0, 80)),
  };
  const themeSig = [document.documentElement, document.body, ...all.slice(0, 60)].map((el) => { const s = getComputedStyle(el); return `${s.color}/${s.backgroundColor}`; }).join(';');
  return { theme, themeSig, overflow: { px, offenders }, blank, contrast: { samples, unknown }, targets, images, cls: window.__va ? window.__va.cls : null, loaf: window.__va ? window.__va.loaf : null };
};

const browser = await chromium.launch();
const findings = [];
const shots = [];
const notes = [];
const themeSigs = {};
let incomplete = false;
const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function openPage(vp, theme, reducedMotion = 'no-preference') {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: theme, reducedMotion, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1 });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const errors = { pageErrors: [], consoleErrors: [] };
  page.on('pageerror', (e) => errors.pageErrors.push(String(e.message || e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('requestfailed', (r) => errors.consoleErrors.push(`request failed: ${r.url().slice(0, 160)} (${r.failure()?.errorText || 'unknown'})`));
  let navigationError = null;
  try {
    await page.goto(o.url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await wait(SETTLE);
  } catch (e) { navigationError = String(e.message || e).split('\n')[0]; }
  return { ctx, page, errors, navigationError };
}

async function rafWindow(page, ms) {
  const a = await page.evaluate(() => window.__va.raf);
  await wait(ms);
  const b = await page.evaluate(() => window.__va.raf);
  return rafRate(b - a, ms);
}

// Scroll the page so no canvas or video is in view, then count frame requests.
async function offscreenRate(page) {
  const r = await page.evaluate(async () => {
    const els = [...document.querySelectorAll('canvas,video')].filter((e) => e.getBoundingClientRect().width > 0);
    if (!els.length) return { none: true };
    const max = (document.scrollingElement || document.documentElement).scrollHeight;
    const inView = () => els.some((e) => { const b = e.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth; });
    for (let y = 0; y <= max; y += Math.max(200, innerHeight / 2)) {
      window.scrollTo(0, y);
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      if (!inView()) return { ok: true };
    }
    return { ok: false, reason: 'a canvas or video stays in view at every scroll position (fixed or full-page background)' };
  });
  if (r.none) return { offscreen: null };
  if (!r.ok) return { offscreen: 'unknown', offscreenReason: r.reason };
  await wait(300);
  const rate = await rafWindow(page, 1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  return { offscreen: rate };
}

async function shoot(page, label, file, opts = {}) {
  const p = path.join(outDir, file);
  await page.screenshot({ path: p, caret: 'hide', ...opts });
  shots.push({ label, path: p });
}

async function interactions(page, vp, theme) {
  const result = { hover: [], focus: [], focusCount: null };
  // Hover: only on pointer devices. Measure the element's own box (offset sizes ignore
  // transforms) and its next sibling before and after; a move means hover changes layout.
  if (!vp.mobile && HOVER_MAX) {
    const ids = await page.evaluate((max) => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.top >= 0 && r.bottom <= innerHeight && getComputedStyle(el).visibility !== 'hidden'; };
      const picks = [...document.querySelectorAll('button,a[href],[role=button],[class*=card],[class*=Card],[class*=tile]')].filter(vis).slice(0, max);
      return picks.map((el, i) => { el.setAttribute('data-va-hover', String(i)); return { i, kind: el.matches('button,[role=button]') ? 'button' : el.tagName === 'A' ? 'link' : 'card' }; });
    }, HOVER_MAX);
    for (const { i, kind } of ids) {
      const sel = `[data-va-hover="${i}"]`;
      const snap = () => page.evaluate((s) => {
        const el = document.querySelector(s);
        const st = getComputedStyle(el);
        const sib = el.nextElementSibling;
        const props = ['color', 'backgroundColor', 'boxShadow', 'transform', 'opacity', 'borderColor', 'outlineStyle', 'textDecorationLine', 'filter', 'backgroundImage', 'scale', 'translate'];
        const kids = [...el.querySelectorAll('*')].slice(0, 30).map((k) => { const ks = getComputedStyle(k); return `${ks.transform}|${ks.opacity}|${ks.color}|${ks.backgroundColor}`; }).join(';');
        const pseudo = ['::before', '::after'].map((p) => { const ps = getComputedStyle(el, p); return `${ps.opacity}|${ps.transform}|${ps.backgroundColor}`; }).join(';');
        let d = el.tagName.toLowerCase(); if (el.id) d += `#${el.id}`; else if (typeof el.className === 'string' && el.className.trim()) d += `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`;
        return { desc: d, box: `${el.offsetWidth}x${el.offsetHeight}`, sib: sib ? `${sib.offsetLeft},${sib.offsetTop}` : '', style: props.map((p) => st[p]).join('|') + kids + pseudo };
      }, sel);
      try {
        const before = await snap();
        const box = await page.locator(sel).boundingBox();
        if (!box) continue;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
        await wait(450);
        const after = await snap();
        const evidence = path.join(outDir, 'evidence', `hover-${slug(vp.name)}-${theme}-${i}.png`);
        await page.locator(sel).screenshot({ path: evidence }).catch(() => {});
        const moved = [];
        if (before.box !== after.box) moved.push(`size ${before.box} to ${after.box}`);
        if (before.sib !== after.sib) moved.push('next element shifted');
        result.hover.push({ sel: before.desc, kind, layoutMoved: moved.join(', ') || null, unchanged: before.style === after.style, evidence });
        await page.mouse.move(1, 1, { steps: 2 });
        await wait(200);
      } catch (e) { notes.push(`hover check skipped for one element: ${String(e.message || e).split('\n')[0]}`); }
    }
  }
  // Keyboard: snapshot every focusable element's look first, then Tab and compare.
  if (TAB_MAX) {
    await page.evaluate(() => {
      window.__vaFocus = new Map();
      const look = (el) => { const s = getComputedStyle(el); const a = getComputedStyle(el, '::after'); const b = getComputedStyle(el, '::before'); const p = el.parentElement ? getComputedStyle(el.parentElement) : null; return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor, s.color, s.textDecorationLine, s.transform, a.opacity, a.boxShadow, a.borderColor, b.opacity, b.boxShadow, p ? p.boxShadow : '', p ? p.outlineStyle : '', p ? p.borderColor : ''].join('|'); };
      window.__vaLook = look;
      for (const el of document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex],[contenteditable=true]')) window.__vaFocus.set(el, look(el));
      document.activeElement && document.activeElement.blur && document.activeElement.blur();
    });
    let count = 0;
    const seen = new Set();
    for (let t = 0; t < TAB_MAX; t++) {
      await page.keyboard.press('Tab');
      await wait(120);
      const st = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body || el === document.documentElement) return null;
        let d = el.tagName.toLowerCase(); if (el.id) d += `#${el.id}`; else if (typeof el.className === 'string' && el.className.trim()) d += `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`;
        const txt = (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 24);
        const before = window.__vaFocus.get(el);
        el.setAttribute('data-va-focus', '1');
        return { sel: txt ? `${d} "${txt}"` : d, invisible: before !== undefined && before === window.__vaLook(el), key: d + txt };
      });
      if (!st) continue;
      if (seen.has(st.key)) break;
      seen.add(st.key);
      count++;
      if (st.invisible) {
        st.evidence = path.join(outDir, 'evidence', `focus-${slug(vp.name)}-${theme}-${t}.png`);
        await page.locator('[data-va-focus="1"]').screenshot({ path: st.evidence }).catch(() => { st.evidence = undefined; });
      }
      await page.evaluate(() => document.querySelector('[data-va-focus="1"]')?.removeAttribute('data-va-focus'));
      result.focus.push(st);
    }
    result.focusCount = count;
  }
  return result;
}

for (const vp of viewports) {
  for (const [ti, theme] of themes.entries()) {
    const view = { viewport: vp, theme };
    const tag = `${slug(vp.name)}-${theme}`;
    const { ctx, page, errors, navigationError } = await openPage(vp, theme);
    try {
      if (navigationError) {
        findings.push(...findingsForView(view, { navigationError }));
        incomplete = true;
        continue;
      }
      await shoot(page, `${vp.name} ${theme} (first screen)`, `${tag}.png`, { animations: 'disabled' });
      // Scroll through once so lazy content loads; long frames are counted during the scroll.
      await page.evaluate(() => { window.__va.loaf = { count: 0, worst: 0 }; });
      const height = await page.evaluate(() => (document.scrollingElement || document.documentElement).scrollHeight);
      for (let y = 0; y < height; y += Math.round(vp.height * 0.6)) { await page.mouse.wheel(0, Math.round(vp.height * 0.6)); await wait(120); }
      await wait(300);
      const probe = await page.evaluate(PROBE, theme);
      await page.evaluate(() => window.scrollTo(0, 0));
      await wait(200);
      await shoot(page, `${vp.name} ${theme} (full page)`, `${tag}-full.png`, { fullPage: true, animations: 'disabled' });
      findings.push(...findingsForView(view, { ...probe, ...errors }));
      themeSigs[vp.name] ??= {};
      themeSigs[vp.name][theme] = probe.themeSig;

      if (axePath && vp === viewports[0]) {
        try {
          await page.addScriptTag({ path: axePath });
          const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], resultTypes: ['violations'] })).violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, target: v.nodes[0]?.target?.join(' ') })));
          for (const v of res) findings.push({ severity: ['critical', 'serious'].includes(v.impact) ? 'major' : 'minor', check: `axe:${v.id}`, detail: `${v.help} (${v.n} element(s); e.g. ${v.target})`, viewport: vp.name, theme });
        } catch (e) { notes.push(`axe-core failed to run: ${String(e.message || e).split('\n')[0]}`); }
      }

      if (ti === 0) {
        const idle = await rafWindow(page, 1500);
        const off = await offscreenRate(page);
        const inter = await interactions(page, vp, theme);
        findings.push(...findingsForInteraction(view, inter));
        // Reduced motion: a fresh load with the preference set, as a returning user would have.
        const rm = await openPage(vp, theme, 'reduce');
        let reduced = null;
        try {
          if (!rm.navigationError) {
            const rate = await rafWindow(rm.page, 1500);
            const infinite = await rm.page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).map((a) => {
              const t = a.effect.target; let d = t ? t.tagName.toLowerCase() : 'unknown'; if (t && t.id) d += `#${t.id}`; else if (t && typeof t.className === 'string' && t.className.trim()) d += `.${t.className.trim().split(/\s+/)[0]}`;
              return `${d} (${a.animationName || a.id || 'animation'})`;
            }));
            reduced = { raf: rate, infinite };
            await shoot(rm.page, `${vp.name} ${theme} (reduced motion)`, `${tag}-reduced.png`);
          } else notes.push(`reduced-motion load failed at ${vp.name}: ${rm.navigationError}`);
        } finally { await rm.ctx.close(); }
        findings.push(...findingsForMotion(view, { idle, ...off, reduced }));
      }
    } catch (e) {
      incomplete = true;
      notes.push(`${vp.name}/${theme} audit stopped early: ${String(e.message || e).split('\n')[0]}`);
    } finally { await ctx.close(); }
  }
}
await browser.close();

findings.push(...themeFindings(themeSigs));
if (!axePath) notes.push('axe-core is not installed in --project, so only the built-in computed-style contrast check ran (install axe-core there for the full WCAG rule set).');
if (viewports.every((v) => v.mobile)) notes.push('hover was not checked: every viewport is a touch viewport.');
notes.push('Hidden-tab pausing is not measured (headless Chromium cannot hide a tab reliably); offscreen pausing is measured by scrolling canvases and videos out of view.');

const merged = mergeFindings(findings);
const summary = summarize(merged);
const report = { url: o.url, date: new Date().toISOString(), viewports, themes, summary, incomplete, findings: merged, notes, shots };
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, 'report.md'), renderMarkdown(report));
if (o.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else console.log(`${summary.pass && !incomplete ? 'PASS' : incomplete ? 'INCOMPLETE' : 'FAIL'}: blocker ${summary.counts.blocker}, major ${summary.counts.major}, minor ${summary.counts.minor}, info ${summary.counts.info}. Report: ${path.join(outDir, 'report.md')}`);
process.exit(incomplete ? 2 : summary.pass ? 0 : 3);
