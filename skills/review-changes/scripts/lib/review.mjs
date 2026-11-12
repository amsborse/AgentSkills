// Pure helpers for review-changes: pixel diff, shot classification, backend-card checks and the
// HTML report. No Node built-ins and no browser APIs, so the diff runs both in tests and inside
// the page (capture.mjs passes diffRgba's source to Playwright).

/**
 * Compare two RGBA images. Sizes may differ (full-page shots of different heights): the canvas is
 * the larger of each side, and pixels that exist in only one image count as changed.
 * Each changed pixel is classified against each image's own background (its most common colour):
 * background before and content after is added (green), content before and background after is
 * removed (red), content in both that differs is changed in place (amber). The overlay dims the
 * after-image to grey and paints the changed pixels in those colours.
 * Self-contained (no outside helpers) so it survives toString() into the page.
 */
export function diffRgba(a, aw, ah, b, bw, bh, threshold = 24) {
  const w = Math.max(aw, bw);
  const h = Math.max(ah, bh);
  const overlay = new Uint8ClampedArray(w * h * 4);
  // Background = the most common colour, bucketed to 5 bits per channel.
  const background = (img, iw, ih) => {
    const bins = new Uint32Array(32768);
    let best = 0;
    for (let k = 0, n = iw * ih * 4; k < n; k += 4) {
      const bin = ((img[k] >> 3) << 10) | ((img[k + 1] >> 3) << 5) | (img[k + 2] >> 3);
      if (++bins[bin] > bins[best]) best = bin;
    }
    return [((best >> 10) << 3) + 4, (((best >> 5) & 31) << 3) + 4, ((best & 31) << 3) + 4];
  };
  const bgA = background(a, aw, ah);
  const bgB = background(b, bw, bh);
  const ink = (img, k, bg) => Math.max(Math.abs(img[k] - bg[0]), Math.abs(img[k + 1] - bg[1]), Math.abs(img[k + 2] - bg[2])) > threshold;
  const paint = (o, rgb) => { overlay[o] = rgb[0]; overlay[o + 1] = rgb[1]; overlay[o + 2] = rgb[2]; overlay[o + 3] = 255; };
  const ADDED = [34, 197, 94], REMOVED = [239, 68, 68], MODIFIED = [245, 158, 11];
  // Coarse spatial buckets keep grouping bounded by image area, not changed pixels.
  const tile = 24, cols = Math.ceil(w / tile), cells = new Map();
  // Fine cells of changed ink per side, later joined into text-line highlights.
  const fine = 8, fcols = Math.ceil(w / fine), inkA = new Map(), inkB = new Map();
  const note = (m, x, y) => {
    const k = Math.floor(y / fine) * fcols + Math.floor(x / fine), c = m.get(k);
    if (c) { c.x = Math.min(c.x, x); c.y = Math.min(c.y, y); c.r = Math.max(c.r, x); c.b = Math.max(c.b, y); }
    else m.set(k, { x, y, r: x, b: y });
  };
  let changed = 0, added = 0, removed = 0, modified = 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const inA = x < aw && y < ah;
      const inB = x < bw && y < bh;
      const i = (y * aw + x) * 4;
      const j = (y * bw + x) * 4;
      let differs = inA !== inB;
      let grey = 0;
      if (inB) {
        grey = 0.299 * b[j] + 0.587 * b[j + 1] + 0.114 * b[j + 2];
        if (inA) {
          const d = Math.max(Math.abs(a[i] - b[j]), Math.abs(a[i + 1] - b[j + 1]), Math.abs(a[i + 2] - b[j + 2]), Math.abs(a[i + 3] - b[j + 3]));
          differs = d > threshold;
        }
      }
      if (differs) {
        changed++;
        const key = Math.floor(y / tile) * cols + Math.floor(x / tile);
        const cell = cells.get(key);
        if (cell) { cell.x = Math.min(cell.x, x); cell.y = Math.min(cell.y, y); cell.r = Math.max(cell.r, x); cell.b = Math.max(cell.b, y); }
        else cells.set(key, { x, y, r: x, b: y });
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        const before = inA && ink(a, i, bgA);
        const after = inB && ink(b, j, bgB);
        if (before) note(inkA, x, y);
        if (after) note(inkB, x, y);
        if (!inA || (after && !before)) { added++; paint(o, ADDED); }
        else if (!inB || (before && !after)) { removed++; paint(o, REMOVED); }
        else { modified++; paint(o, MODIFIED); }
      } else {
        const g = 40 + grey * 0.35;
        paint(o, [g, g, g]);
      }
    }
  }
  const boxes = [];
  const union = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) });
  while (cells.size) {
    const key = cells.keys().next().value;
    let box = cells.get(key);
    cells.delete(key);
    const queue = [key];
    for (let i = 0; i < queue.length; i++) {
      const cx = queue[i] % cols, cy = Math.floor(queue[i] / cols);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (cx + dx < 0 || cx + dx >= cols || cy + dy < 0) continue;
        const next = (cy + dy) * cols + cx + dx;
        if (!cells.has(next)) continue;
        box = union(box, cells.get(next)); cells.delete(next); queue.push(next);
      }
    }
    boxes.push(box);
  }
  // Many scattered changes: first pair up neighbours in reading order (n log n per halving) so
  // the closest-pair merge below only ever sees a few dozen boxes.
  while (boxes.length > 48) {
    boxes.sort((a, b) => a.y - b.y || a.x - b.x);
    const paired = [];
    for (let i = 0; i < boxes.length; i += 2) paired.push(i + 1 < boxes.length ? union(boxes[i], boxes[i + 1]) : boxes[i]);
    boxes.splice(0, boxes.length, ...paired);
  }
  // Retain all changes when capping: combine the closest pair rather than discard regions.
  while (boxes.length > 6) {
    let best = Infinity, ai = 0, bi = 1;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const distance = Math.hypot(Math.max(0, a.x - b.r, b.x - a.r), Math.max(0, a.y - b.b, b.y - a.b));
      if (distance < best) { best = distance; ai = i; bi = j; }
    }
    boxes[ai] = union(boxes[ai], boxes[bi]); boxes.splice(bi, 1);
  }
  const regions = boxes.sort((a, b) => a.y - b.y || a.x - b.x).map(({ x, y, r, b }) => ({ x, y, w: r - x + 1, h: b - y + 1 }));
  // Join ink cells into line boxes: across word gaps on a row, then down while rows touch.
  const lines = (m) => {
    const runs = [];
    let row = -1, cur = null;
    for (const k of [...m.keys()].sort((p, q) => p - q)) {
      const c = m.get(k), r = Math.floor(k / fcols);
      if (cur && r === row && c.x - cur.r <= 12) cur = union(cur, c);
      else { if (cur) runs.push(cur); cur = { ...c }; row = r; }
    }
    if (cur) runs.push(cur);
    const out = [];
    for (const run of runs) {
      // Absorb every box this run touches, so letter tops in the row above join their line.
      let box = run;
      for (let i = out.length - 1; i >= 0; i--) {
        const o = out[i];
        if (box.y - o.b <= 2 && box.x <= o.r + 12 && box.r >= o.x - 12) { box = union(box, o); out.splice(i, 1); }
      }
      out.push(box);
      if (out.length > 600) break;
    }
    return out.slice(0, 600).sort((p, q) => p.y - q.y || p.x - q.x).map(({ x, y, r, b }) => ({ x, y, w: r - x + 1, h: b - y + 1 }));
  };
  const marks = { before: lines(inkA), after: lines(inkB) };
  const total = w * h;
  return {
    width: w,
    height: h,
    changed,
    added,
    removed,
    modified,
    total,
    ratio: total ? changed / total : 0,
    bbox: changed ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null,
    regions,
    marks,
    overlay,
  };
}

/**
 * Decide what a before/after pair shows. A shot that failed is never a pass: it is "not checked".
 * `noise` is the share of pixels that changed between two captures of the same after-page
 * (animation, clocks, carets); changes at or under it are not reported as real.
 */
export function classifyShot({ before, after, ratio, noise }) {
  if (after?.error) return { status: 'not-checked', reason: `after failed: ${after.error}` };
  if (before?.missing && after?.missing) return { status: 'not-checked', reason: 'page not found on either side; check the route' };
  if (before?.missing) return { status: 'new', reason: 'page does not exist before the change' };
  if (before?.error) return { status: 'not-checked', reason: `before failed: ${before.error}` };
  if (after?.missing) return { status: 'removed', reason: 'page no longer exists after the change' };
  if (typeof ratio !== 'number') return { status: 'not-checked', reason: 'no diff computed' };
  if (ratio === 0) return { status: 'unchanged', reason: 'pixel identical' };
  const floor = typeof noise === 'number' ? noise : 0;
  if (ratio <= floor * 1.5) return { status: 'noise', reason: `${pct(ratio)} changed, within the ${pct(floor)} noise of the page itself` };
  return { status: 'changed', reason: `${pct(ratio)} of pixels changed` };
}

// Git Bash (MSYS) rewrites a leading "/route" argument into "C:/Program Files/Git/route".
export function badRoute(r) {
  if (/^\/?[A-Za-z]:[\/]/.test(r) || /Program Files/i.test(r)) return `route "${r}" looks like a rewritten Windows path; in Git Bash run with MSYS_NO_PATHCONV=1`;
  return null;
}

export const pct = (r) => `${(r * 100).toFixed(r && r < 0.001 ? 3 : 2)}%`;

const LEVELS = ['high', 'medium', 'low'];

/**
 * Check backend change cards before they reach the report. Confidence must be earned: "high"
 * needs runtime or test evidence (a test that fails without the change, a run, a measurement),
 * and every card states its evidence and what would raise the confidence. Returns problems, so a
 * card that overclaims is rejected loudly instead of rendered.
 */
export function validateBackend(cards) {
  const problems = [];
  if (!Array.isArray(cards)) return ['backend.json must be an array of change cards'];
  cards.forEach((c, n) => {
    const at = `card ${n + 1}${c?.title ? ` ("${c.title}")` : ''}`;
    for (const k of ['title', 'what', 'improves', 'risk', 'confidence', 'evidence']) {
      if (c?.[k] === undefined || c[k] === '' || (Array.isArray(c[k]) && !c[k].length)) problems.push(`${at}: missing ${k}`);
    }
    if (c?.risk && !LEVELS.includes(c.risk.level)) problems.push(`${at}: risk.level must be high, medium or low`);
    if (c?.risk && !c.risk.scenario) problems.push(`${at}: risk.scenario must say how it could break`);
    if (c?.confidence && !LEVELS.includes(c.confidence)) problems.push(`${at}: confidence must be high, medium or low`);
    const ev = Array.isArray(c?.evidence) ? c.evidence : [];
    for (const e of ev) {
      if (!['test-fails-without', 'test-passes', 'runtime', 'measurement', 'code-read', 'inferred'].includes(e?.kind)) problems.push(`${at}: evidence kind "${e?.kind}" is unknown`);
      if (!e?.detail) problems.push(`${at}: every evidence item needs a detail`);
    }
    const strong = ev.some((e) => ['test-fails-without', 'runtime', 'measurement'].includes(e?.kind));
    const any = ev.some((e) => e?.kind !== 'inferred');
    if (c?.confidence === 'high' && !strong) problems.push(`${at}: high confidence needs a failing-without test, a runtime check or a measurement`);
    if (c?.confidence === 'medium' && !any) problems.push(`${at}: medium confidence needs at least a code read or a passing test`);
    if (c?.confidence && c.confidence !== 'high' && !c.raise) problems.push(`${at}: say what would raise the confidence (raise)`);
    if (c?.suggestions && !Array.isArray(c.suggestions)) problems.push(`${at}: suggestions must be an array`);
    for (const s of c?.suggestions || []) {
      if (!s?.text || !LEVELS.includes(s?.confidence)) problems.push(`${at}: each suggestion needs text and a confidence`);
      if (s && !['confirmed', 'plausible', 'unverified'].includes(s.check)) problems.push(`${at}: suggestion check must be confirmed, plausible or unverified`);
    }
  });
  return problems;
}

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// Only relative paths inside the report folder become image sources.
const src = (p) => (typeof p === 'string' && /^[\w./-]+$/.test(p) && !p.includes('..') && !p.startsWith('/') ? esc(p) : '');

const STATUS = {
  changed: ['Changed', 'Pixels differ beyond the page’s own noise.'],
  new: ['New feature', 'This page did not exist before the change.'],
  removed: ['Removed', 'Existed before, gone after.'],
  unchanged: ['Unchanged', 'Pixel identical.'],
  noise: ['No real change', 'Differences are within what the page varies between two captures of itself.'],
  'not-checked': ['Not checked', 'A capture failed, so this view was not compared. Not a pass.'],
};

// Share of the change that is added, removed or changed in place, for the diff caption.
function parts(s) {
  const n = (s.added || 0) + (s.removed || 0) + (s.modified || 0);
  if (!n) return '';
  const pc = (k) => Math.round((100 * (s[k] || 0)) / n);
  return ` <small>${[['added', 'k-add', 'added'], ['removed', 'k-del', 'removed'], ['modified', 'k-mod', 'in place']]
    .filter(([k]) => s[k]).map(([k, c, t]) => `<span class="${c}">${pc(k)}% ${t}</span>`).join(' · ')}</small>`;
}

// Only validated, finite geometry reaches inline CSS or numeric data attributes.
function changeRegions(s) {
  if (s.status !== 'changed') return [];
  const clean = (list) => list.flatMap((r) => {
    const values = ['x', 'y', 'w', 'h'].map((k) => Number(r?.[k]));
    if (!values.every((v) => Number.isFinite(v) && Math.abs(v) <= 10000000)) return [];
    const [x, y, w, h] = values;
    return x >= 0 && y >= 0 && w > 0 && h > 0 ? [{ x, y, w, h }] : [];
  });
  const regions = clean(Array.isArray(s.regions) ? s.regions.slice(0, 6) : []);
  return regions.length ? regions : clean(s.bbox ? [s.bbox] : []);
}

function changeMarks(s) {
  const clean = (list) => (Array.isArray(list) ? list.slice(0, 600) : []).flatMap((r) => {
    const v = ['x', 'y', 'w', 'h'].map((k) => Number(r?.[k]));
    return v.every((n) => Number.isFinite(n) && Math.abs(n) <= 10000000) && v[0] >= 0 && v[1] >= 0 && v[2] > 0 && v[3] > 0 ? [{ x: v[0], y: v[1], w: v[2], h: v[3] }] : [];
  });
  return { before: clean(s.marks?.before), after: clean(s.marks?.after) };
}

function closeups(s, regions) {
  if (!regions.length) return '';
  const marks = changeMarks(s);
  const hits = (list, r) => list.some((m) => m.x < r.x + r.w && m.y < r.y + r.h && m.x + m.w > r.x && m.y + m.h > r.y);
  const KIND = { both: ['Changed', 'Red shows how it was, green shows how it is now.'], add: ['New here', 'Green shows what was added.'], del: ['Gone', 'Red shows what was taken away.'] };
  return `<div class="closeups"><h4>Each change up close</h4><p class="meta">Shown at full size. Scroll inside a picture to see wider changes.</p>${regions.map((r, i) => {
    const b = hits(marks.before, r), a = hits(marks.after, r);
    const [kind, say] = KIND[a && !b ? 'add' : b && !a ? 'del' : 'both'];
    const x = Math.max(0, r.x - 24), y = Math.max(0, r.y - 24);
    const w = r.w + r.x - x + 24, h = r.h + r.y - y + 24;
    // Highlights sit behind each changed line with a little room around it, so text stays readable.
    const hl = (list, cls) => list.filter((m) => m.x < x + w && m.y < y + h && m.x + m.w > x && m.y + m.h > y)
      .map((m) => `<i class="hl ${cls}" style="left:${m.x - 4 - x}px;top:${m.y - 4 - y}px;width:${m.w + 8}px;height:${m.h + 8}px"></i>`).join('');
    return `<div class="change-region"><h4><span class="num">${i + 1}</span>${kind}<small>${say}</small></h4><div class="crop-grid">${[[s.before?.file, 'Before', hl(marks.before, 'del')], [s.after?.file, 'After', hl(marks.after, 'add')]].map(([file, label, lit]) => `<figure><figcaption>${label}</figcaption>${src(file) ? `<div class="crop" tabindex="0" role="region" aria-label="${label}, change ${i + 1}" data-at="${r.x},${r.y}" style="height:${h}px"><div style="width:${w}px;height:${h}px"><img loading="lazy" src="${src(file)}" alt="${label}, change ${i + 1}" style="left:-${x}px;top:-${y}px">${lit}</div></div><div class="gap" hidden>Not in this capture: the page ends before this point.</div>` : '<div class="gap">No image</div>'}</figure>`).join('')}</div></div>`;
  }).join('')}</div>`;
}

function shotCard(s) {
  const regions = changeRegions(s);
  const img = (p, alt) => (src(p) ? `<img loading="lazy" src="${src(p)}" alt="${esc(alt)}">` : `<div class="gap">${esc(alt)}: no image</div>`);
  const markers = regions.map((r, i) => `<span class="region-mark" data-box="${r.x},${r.y},${r.w},${r.h}"><b>${i + 1}</b></span>`).join('');
  const marked = (p, alt) => (regions.length && src(p) ? `<div class="diff-map">${img(p, alt)}${markers}</div>` : img(p, alt));
  const summary = regions.length ? `${regions.length} change${regions.length > 1 ? 's' : ''} on this page. Look for the numbered boxes.` : s.reason;
  const pixels = src(s.diffFile) && s.status !== 'new'
    ? `<details class="pixels"><summary>Pixel details</summary><figure class="diff">${img(s.diffFile, 'changed pixels')}<figcaption class="meta">${esc(s.reason || '')}${parts(s)}. Grey is unchanged; amber changed in place.</figcaption></figure></details>` : '';
  const [label, hint] = STATUS[s.status] || [s.status, ''];
  const errs = [...(s.before?.consoleErrors || []).map((e) => ['before', e]), ...(s.after?.consoleErrors || []).map((e) => ['after', e])];
  const compare = src(s.before?.file) && src(s.after?.file)
    ? `<div class="slider" style="--x:50%"><img src="${src(s.after.file)}" alt="after"><div class="clip">${img(s.before.file, 'before')}</div><input type="range" min="0" max="100" value="50" aria-label="Reveal before and after"></div>`
    : '';
  return `<article class="shot" data-status="${esc(s.status)}" data-theme-name="${esc(s.theme)}" data-viewport="${esc(s.viewport)}">
  <header><h3>${esc(s.route)}</h3><span class="meta">${esc(s.theme)} · ${esc(s.viewport)}</span><span class="badge b-${esc(s.status)}" title="${esc(hint)}">${esc(label)}</span><span class="why">${esc(summary)}</span></header>
  <div class="views" data-mode="side">
    <figure><figcaption><i class="k-del"></i>Before: how it was <small>${esc(s.baseLabel || '')}</small></figcaption>${s.before?.missing ? '<div class="gap">Did not exist</div>' : marked(s.before?.file, 'before')}</figure>
    <figure><figcaption>${s.status === 'new' ? '<i class="k-new"></i>After: a whole new page' : '<i class="k-add"></i>After: how it is now'} <small>${esc(s.headLabel || '')}</small></figcaption>${s.after?.missing ? '<div class="gap">Removed</div>' : s.status === 'new' && src(s.after?.file) ? `<div class="newfeat">${img(s.after.file, 'new feature')}</div>` : marked(s.after?.file, 'after')}</figure>
    ${compare ? `<figure class="cmp">${compare}</figure>` : ''}
  </div>
  ${closeups(s, regions)}
  ${pixels}
  ${errs.length ? `<details class="errs"><summary>${errs.length} console error${errs.length > 1 ? 's' : ''}</summary><ul>${errs.map(([w, e]) => `<li><b>${w}</b> ${esc(e)}</li>`).join('')}</ul></details>` : ''}
</article>`;
}

function backendCard(c) {
  const ev = (c.evidence || []).map((e) => `<li><span class="ek">${esc(e.kind)}</span> ${esc(e.detail)}</li>`).join('');
  const sug = (c.suggestions || []).map((s) => `<li><span class="lvl cf-${esc(s.confidence)}">${esc(s.confidence)}</span><span class="chk c-${esc(s.check)}">${esc(s.check)}</span> ${esc(s.text)}</li>`).join('');
  return `<article class="card">
  <header><h3>${esc(c.title)}</h3>${c.files?.length ? `<span class="meta">${esc(c.files.join(', '))}</span>` : ''}</header>
  <dl>
    <div><dt>What changed</dt><dd>${esc(c.what)}</dd></div>
    <div><dt>What it improves</dt><dd>${esc(c.improves)}</dd></div>
    <div><dt>Risk <span class="lvl l-${esc(c.risk?.level)}">${esc(c.risk?.level)}</span></dt><dd>${esc(c.risk?.scenario)}${c.risk?.blastRadius ? `<br><small>Blast radius: ${esc(c.risk.blastRadius)}</small>` : ''}</dd></div>
    <div><dt>Confidence <span class="lvl cf-${esc(c.confidence)}">${esc(c.confidence)}</span></dt><dd><ul class="ev">${ev}</ul>${c.raise ? `<small>Would raise it: ${esc(c.raise)}</small>` : ''}</dd></div>
  </dl>
  ${sug ? `<div class="sug"><h4>Suggestions</h4><ul>${sug}</ul></div>` : ''}
</article>`;
}

/** The whole report as one HTML file. Every value from the diff, the page or the cards is escaped. */
export function renderReport({ title = 'Change review', base = '', head = '', generated = '', ui = null, backend = null, notes = [] }) {
  const shots = ui?.shots || [];
  const count = (st) => shots.filter((s) => s.status === st).length;
  const order = ['changed', 'new', 'removed', 'not-checked', 'noise', 'unchanged'];
  const sorted = [...shots].sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status));
  const cards = backend || [];
  const levels = (k) => ['high', 'medium', 'low'].map((l) => [l, cards.filter((c) => (k === 'risk' ? c.risk?.level : c.confidence) === l).length]);
  const tally = (k) => levels(k).filter(([, n]) => n).map(([l, n]) => `<span class="lvl ${k === 'risk' ? 'l' : 'cf'}-${l}">${n} ${l}</span>`).join(' ') || '<span class="muted">none</span>';
  const uiBlock = ui
    ? `<section id="ui"><div class="sechead"><h2>Interface</h2><div class="filters" role="group" aria-label="Filter views"><button data-f="real" aria-pressed="true">Changes only</button><button data-f="all" aria-pressed="false">All views</button><span class="sep"></span><button data-m="side" aria-pressed="true">Side by side</button><button data-m="slide" aria-pressed="false">Slider</button></div></div>
<div class="legend" aria-label="How to read this"><span><b class="num">1</b>The numbered boxes show where to look</span><span><i class="k-del"></i>Red: how it was before</span><span><i class="k-add"></i>Green: how it is now</span><span><i class="k-new"></i>Purple: a whole new page</span></div>
${sorted.map(shotCard).join('\n') || '<p class="muted">No views were captured.</p>'}</section>`
    : `<section id="ui"><h2>Interface</h2><p class="muted">No interface capture was run for this change.</p></section>`;
  const beBlock = backend
    ? `<section id="backend"><h2>Behind the interface</h2>${cards.map(backendCard).join('\n') || '<p class="muted">No backend changes.</p>'}</section>`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{--bg:#f4f1ea;--bg2:#ebe6db;--card:#fffdf8;--line:#ddd5c6;--ink:#1d1b17;--sub:#5a5449;--accent:#c2185b;--hi:#b3261e;--md:#a35c00;--lo:#2e7d32;--add:#15803d;--del:#c62828;--mod:#b45309;--new:#7c3aed;--shadow:0 1px 2px rgba(60,40,10,.06),0 8px 24px rgba(60,40,10,.07);color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0d0f14;--bg2:#141822;--card:#171b25;--line:#2a3040;--ink:#eef0f5;--sub:#a6adbd;--accent:#ff4f9a;--hi:#ff6b5e;--md:#f0a640;--lo:#5fd38a;--add:#4ade80;--del:#f87171;--mod:#fbbf24;--new:#b388ff;--shadow:0 0 0 1px rgba(255,255,255,.03),0 12px 40px rgba(0,0,0,.45);color-scheme:dark}}
:root[data-theme=dark]{--bg:#0d0f14;--bg2:#141822;--card:#171b25;--line:#2a3040;--ink:#eef0f5;--sub:#a6adbd;--accent:#ff4f9a;--hi:#ff6b5e;--md:#f0a640;--lo:#5fd38a;--add:#4ade80;--del:#f87171;--mod:#fbbf24;--new:#b388ff;--shadow:0 0 0 1px rgba(255,255,255,.03),0 12px 40px rgba(0,0,0,.45);color-scheme:dark}
*{box-sizing:border-box}html{background:var(--bg)}
body{margin:0;font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:radial-gradient(1200px 500px at 10% -10%,color-mix(in srgb,var(--accent) 10%,transparent),transparent 70%),var(--bg);min-height:100vh}
main{max-width:1440px;margin:0 auto;padding:48px 24px 96px}
h1{font-size:clamp(28px,4vw,44px);letter-spacing:-.02em;line-height:1.1;margin:0 0 8px}h2{font-size:22px;letter-spacing:-.01em;margin:0}h3{font-size:16px;margin:0}h4{margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--sub)}
.lede{color:var(--sub);margin:0 0 28px}.lede code{font:13px ui-monospace,monospace;background:var(--bg2);padding:2px 6px;border-radius:6px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 40px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;box-shadow:var(--shadow)}.stat b{display:block;font-size:26px;letter-spacing:-.02em}.stat span{color:var(--sub);font-size:13px}
section{margin-top:40px}.sechead{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:16px}
.filters{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.filters button{font:inherit;font-size:13px;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:999px;padding:6px 12px;cursor:pointer}.filters button[aria-pressed=true]{border-color:var(--accent);color:var(--accent)}.sep{width:1px;height:20px;background:var(--line)}
.shot,.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;margin:0 0 18px;box-shadow:var(--shadow)}
.shot>header,.card>header{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:baseline;margin-bottom:14px}.meta{color:var(--sub);font-size:13px}.why{color:var(--sub);font-size:13px;flex-basis:100%}
.badge{font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px;border:1px solid currentColor}
.b-changed{color:var(--accent)}.b-new{color:var(--new)}.shot[data-status=new]{border-color:color-mix(in srgb,var(--new) 45%,var(--line));box-shadow:var(--shadow),0 0 0 1px color-mix(in srgb,var(--new) 20%,transparent)}
.legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;margin:-4px 0 16px}.legend span{display:inline-flex;align-items:center;gap:6px}.legend i{width:10px;height:10px;border-radius:3px;display:inline-block}
i.k-add{background:#22c55e}i.k-del{background:#ef4444}i.k-mod{background:#f59e0b}i.k-new{background:var(--new)}span.k-add{color:var(--add)}span.k-del{color:var(--del)}span.k-mod{color:var(--mod)}
.newfeat{position:relative;border-radius:10px;overflow:hidden;outline:2px solid var(--new);outline-offset:-2px}.newfeat img{border:0;filter:grayscale(.6) brightness(.8)}.newfeat::after{content:'';position:absolute;inset:0;background:color-mix(in srgb,var(--new) 38%,transparent);mix-blend-mode:screen;pointer-events:none}.b-removed,.b-not-checked{color:var(--hi)}.b-unchanged,.b-noise{color:var(--lo)}
body.real .shot[data-status=unchanged],body.real .shot[data-status=noise]{display:none}
.views{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}
.views figure{margin:0;min-width:0}.views figcaption{font-size:12px;font-weight:600;color:var(--sub);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}.views figcaption small{text-transform:none;letter-spacing:0;font-weight:400}
.views img{display:block;width:100%;height:auto;border-radius:10px;border:1px solid var(--line);background:var(--bg2)}
.diff-map{position:relative}.region-mark{position:absolute;outline:2px solid var(--mod);outline-offset:4px;box-shadow:0 0 0 4px rgba(0,0,0,0);min-width:8px;min-height:8px;pointer-events:none}.region-mark b{position:absolute;top:-14px;left:-14px;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:var(--mod);color:#111;font:800 13px/1 ui-sans-serif,system-ui;box-shadow:0 0 0 2px var(--card),0 2px 6px rgba(0,0,0,.3)}
.num{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--mod);color:#111;font:800 13px/1 ui-sans-serif,system-ui;margin-right:8px;flex:none}.change-region>h4{text-transform:none;letter-spacing:0;color:var(--ink);display:flex;align-items:center;flex-wrap:wrap;gap:4px 0;font-size:16px;margin:0 0 10px}.change-region>h4 small{flex-basis:100%;margin-left:32px;font-weight:400;font-size:13px;color:var(--sub)}
.views figcaption i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}.pixels{margin-top:18px}.pixels summary{cursor:pointer;color:var(--sub);font-size:13px}.pixels figure{margin:10px 0 0;max-width:480px}.pixels img{display:block;width:100%;border-radius:8px;border:1px solid var(--line)}.pixels figcaption{margin-top:6px}
.closeups{margin-top:24px;border-top:1px solid var(--line);padding-top:18px}.closeups>h4{color:var(--ink)}.closeups>p{margin:0 0 18px}.change-region{margin-top:18px}.crop-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.crop-grid figure{margin:0;min-width:0}.crop-grid figcaption{font-size:12px;font-weight:600;color:var(--sub);margin-bottom:6px}.crop{width:fit-content;max-width:100%;max-height:480px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:var(--bg2)}.crop.more{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 40px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 40px),transparent)}.crop:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.crop>div{position:relative;overflow:hidden}.crop img{position:absolute;max-width:none;width:auto;height:auto;display:block}.hl{position:absolute;border-radius:4px;pointer-events:none}.hl.add{background:color-mix(in srgb,var(--add) 22%,transparent);box-shadow:inset 0 -2px 0 var(--add)}.hl.del{background:color-mix(in srgb,var(--del) 22%,transparent);box-shadow:inset 0 -2px 0 var(--del)}.shot h3,.meta,.lede{overflow-wrap:anywhere}
[hidden]{display:none!important}.gap{display:grid;place-items:center;min-height:160px;border:1px dashed var(--line);border-radius:10px;color:var(--sub);font-size:13px;background:var(--bg2)}
.cmp{display:none}.views[data-mode=slide]{grid-template-columns:1fr}.views[data-mode=slide] figure{display:none}.views[data-mode=slide] .cmp{display:block}
.slider{position:relative;max-width:1100px}.slider>img{display:block;width:100%;border-radius:10px;border:1px solid var(--line)}
.slider .clip{position:absolute;inset:0;width:var(--x);overflow:hidden;border-right:2px solid var(--accent)}.slider .clip img{width:auto;max-width:none;height:100%;border:0;border-radius:10px 0 0 10px}
.slider input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ew-resize;margin:0}
.errs{margin-top:12px;font-size:13px}.errs summary{cursor:pointer;color:var(--hi)}.errs li{font-family:ui-monospace,monospace;font-size:12px;overflow-wrap:anywhere}
.card dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 24px;margin:0}.card dt{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--sub);margin-bottom:4px}.card dd{margin:0}.card small{color:var(--sub)}
.ev{margin:0 0 6px;padding-left:18px}.ek{font:12px ui-monospace,monospace;color:var(--sub)}
.lvl,.chk{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:1px 8px;border-radius:999px;border:1px solid currentColor;margin-right:6px}
.l-high{color:var(--hi)}.l-medium{color:var(--md)}.l-low{color:var(--lo)}
dt .lvl{margin-left:6px}
.cf-high{color:var(--lo)}.cf-medium{color:var(--md)}.cf-low{color:var(--hi)}
.c-confirmed{color:var(--lo)}.c-plausible{color:var(--md)}.c-unverified{color:var(--sub)}
.sug{margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}.sug ul{margin:0;padding-left:0;list-style:none}.sug li{margin:6px 0}
.muted{color:var(--sub)}.notes{color:var(--sub);font-size:13px;margin-top:40px}
@media (max-width:900px){.views,.crop-grid{grid-template-columns:1fr}.card dl{grid-template-columns:1fr}main{padding:28px 16px 64px}}
</style></head>
<body class="real"><main>
<h1>${esc(title)}</h1>
<p class="lede">Before <code>${esc(base)}</code> → after <code>${esc(head)}</code>${generated ? ` · ${esc(generated)}` : ''}. Screenshots are from the running app.</p>
<div class="stats">
  <div class="stat"><b>${count('changed') + count('new') + count('removed')}</b><span>views that changed</span></div>
  ${count('new') ? `<div class="stat"><b style="color:var(--new)">${count('new')}</b><span>new feature views</span></div>` : ''}
  <div class="stat"><b>${count('unchanged') + count('noise')}</b><span>views unchanged</span></div>
  <div class="stat"><b${count('not-checked') ? ' style="color:var(--hi)"' : ''}>${count('not-checked')}</b><span>views not checked</span></div>
  ${backend ? `<div class="stat"><b>${cards.length}</b><span>backend changes</span></div><div class="stat"><span>Risk</span><div>${tally('risk')}</div></div><div class="stat"><span>Confidence</span><div>${tally('confidence')}</div></div>` : ''}
</div>
${uiBlock}
${beBlock}
${notes.length ? `<div class="notes"><h4>Notes</h4><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
</main>
<script>
document.querySelectorAll('.diff-map').forEach(map=>{const img=map.querySelector('img'),fit=()=>{if(!img.naturalWidth||!img.naturalHeight)return;map.querySelectorAll('[data-box]').forEach(mark=>{const [x,y,w,h]=mark.dataset.box.split(',').map(Number);mark.style.left=(100*x/img.naturalWidth)+'%';mark.style.top=(100*y/img.naturalHeight)+'%';mark.style.width=(100*Math.min(w,img.naturalWidth-x)/img.naturalWidth)+'%';mark.style.height=(100*Math.min(h,img.naturalHeight-y)/img.naturalHeight)+'%'})};img.addEventListener('load',fit);fit()});
// A crop whose change lies past the end of a shorter capture says so instead of showing an empty box.
document.querySelectorAll('.crop[data-at]').forEach(c=>{const img=c.querySelector('img'),[x,y]=c.dataset.at.split(',').map(Number),check=()=>{if(img.naturalWidth&&(x>=img.naturalWidth||y>=img.naturalHeight)){c.hidden=true;c.nextElementSibling.hidden=false}};if(img.complete)check();else img.addEventListener('load',check)});
// The crops of one change scroll together, and fade at the edge while more is hidden.
document.querySelectorAll('.change-region').forEach(g=>{const cs=[...g.querySelectorAll('.crop')],cue=()=>cs.forEach(c=>c.classList.toggle('more',c.scrollWidth-c.clientWidth-c.scrollLeft>2));cs.forEach(c=>c.addEventListener('scroll',()=>{cs.forEach(o=>{if(o!==c){o.scrollLeft=c.scrollLeft;o.scrollTop=c.scrollTop}});cue()},{passive:true}));addEventListener('resize',cue);cue()});
document.querySelectorAll('[data-f]').forEach(b=>b.addEventListener('click',()=>{document.body.classList.toggle('real',b.dataset.f==='real');document.querySelectorAll('[data-f]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))}));
document.querySelectorAll('[data-m]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.views').forEach(v=>v.dataset.mode=b.dataset.m);document.querySelectorAll('[data-m]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))}));
document.querySelectorAll('.slider').forEach(s=>{const i=s.querySelector('input'),c=s.querySelector('.clip img'),fit=()=>{c.style.width=s.clientWidth+'px'};i.addEventListener('input',()=>s.style.setProperty('--x',i.value+'%'));addEventListener('resize',fit);fit()});
</script>
</body></html>
`;
}
