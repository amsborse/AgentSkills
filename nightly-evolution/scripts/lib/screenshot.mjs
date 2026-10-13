import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { IS_WINDOWS, expand, killTree } from './util.mjs';

/** Use the repository's own Playwright so no browser dependency is added by the skill. */
export async function loadPlaywright(dirs) {
  for (const d of dirs.filter(Boolean)) {
    const req = createRequire(path.join(d, 'package.json'));
    for (const m of ['playwright', '@playwright/test', 'playwright-core']) {
      try {
        const mod = await import(pathToFileURL(req.resolve(m)).href);
        const pw = mod.chromium ? mod : mod.default;
        if (pw?.chromium) return pw;
      } catch {
        // try the next candidate
      }
    }
  }
  throw new Error(`Playwright is not installed in ${dirs.filter(Boolean).join(' or ')}; screenshots need the repository's own Playwright.`);
}

export async function withServer(serve, cwd, vars, fn) {
  if (!serve?.run) return fn();
  const child = spawn(expand(serve.run, vars), { cwd: serve.cwd ? path.join(cwd, serve.cwd) : cwd, shell: true, windowsHide: true, detached: !IS_WINDOWS, stdio: 'ignore', env: { ...process.env, ...(serve.env || {}) } });
  const deadline = Date.now() + Number(serve.ready_timeout_seconds || 120) * 1000;
  try {
    for (;;) {
      try {
        const res = await fetch(serve.url, { signal: AbortSignal.timeout(3000) });
        if (res.status < 500) break;
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) throw new Error(`Server did not answer ${serve.url} within ${serve.ready_timeout_seconds || 120}s`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    return await fn();
  } finally {
    killTree(child.pid);
  }
}

export async function capture(pw, { url, file, viewport = [1440, 900], waitMs = 800, colorScheme }) {
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] }, colorScheme, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    const t = Date.now();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    const loadMs = Date.now() - t;
    await page.waitForTimeout(waitMs);
    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]));
      return { domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null, load: nav ? Math.round(nav.loadEventEnd) : null, ...paint };
    });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: false });
    return { file, loadMs, perf, pageErrors: errors };
  } finally {
    await browser.close();
  }
}

/** Pixel diff of the overlapping region, computed in Chromium's canvas. Writes a diff PNG. */
export async function compareImages(pw, actualFile, referenceFile, diffFile, threshold = 48) {
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage();
    const toUrl = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
    const result = await page.evaluate(
      async ({ a, b, threshold }) => {
        const load = (src) => new Promise((res, rej) => Object.assign(new Image(), { onload() { res(this); }, onerror: rej, src }));
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const w = Math.min(ia.width, ib.width);
        const h = Math.min(ia.height, ib.height);
        const read = (img) => {
          const c = new OffscreenCanvas(w, h);
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          return ctx.getImageData(0, 0, w, h).data;
        };
        const da = read(ia);
        const db = read(ib);
        const out = new OffscreenCanvas(w, h);
        const octx = out.getContext('2d');
        const diff = octx.createImageData(w, h);
        let changed = 0;
        for (let i = 0; i < da.length; i += 4) {
          const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
          const hit = d > threshold;
          if (hit) changed++;
          diff.data[i] = hit ? 255 : da[i] * 0.25;
          diff.data[i + 1] = hit ? 0 : da[i + 1] * 0.25;
          diff.data[i + 2] = hit ? 0 : da[i + 2] * 0.25;
          diff.data[i + 3] = 255;
        }
        octx.putImageData(diff, 0, 0);
        const blob = await out.convertToBlob({ type: 'image/png' });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return { diffRatio: changed / (w * h), width: w, height: h, sizes: [[ia.width, ia.height], [ib.width, ib.height]], png: btoa(bin) };
      },
      { a: toUrl(actualFile), b: toUrl(referenceFile), threshold },
    );
    if (diffFile) fs.writeFileSync(diffFile, Buffer.from(result.png, 'base64'));
    delete result.png;
    return result;
  } finally {
    await browser.close();
  }
}
