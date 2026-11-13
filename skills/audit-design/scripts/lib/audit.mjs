// Pure helpers for visual-audit.mjs: argument parsing, WCAG contrast math, rate checks, the
// finding rules and the report renderers. Nothing here touches a browser, so it is unit-tested
// in tests/visual-audit.test.mjs without Playwright.

export const SEVERITIES = ['blocker', 'major', 'minor', 'info'];
const RANK = Object.fromEntries(SEVERITIES.map((s, i) => [s, i]));

export function parseViewports(spec) {
  return String(spec || '').split(',').map((v) => v.trim()).filter(Boolean).map((v) => {
    const [name, size] = v.includes('=') ? v.split('=') : [v, v];
    const [width, height] = String(size).split('x').map(Number);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 200 || height < 200) {
      throw new Error(`bad viewport "${v}" (use name=WIDTHxHEIGHT, each at least 200)`);
    }
    return { name, width, height, mobile: width < 600 };
  });
}

export function isLocalUrl(u) {
  const url = new URL(u);
  if (url.protocol === 'file:') return true;
  const h = url.hostname;
  return ['localhost', '127.0.0.1', '[::1]'].includes(h) || h.endsWith('.localhost') || h.endsWith('.test');
}

// "rgb(1, 2, 3)", "rgba(1,2,3,0.5)", "rgb(1 2 3 / 50%)", "#abc", "#aabbcc", "transparent".
// Returns {r,g,b,a} or null when the format is not understood (oklch, color-mix...): unknown.
export function parseColor(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const hex = s.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const fn = s.match(/^rgba?\((.*)\)$/);
  if (!fn) return null;
  const parts = fn[1].replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const num = (p, max) => (p.endsWith('%') ? (parseFloat(p) / 100) * max : parseFloat(p));
  const [r, g, b] = parts.slice(0, 3).map((p) => num(p, 255));
  const a = parts[3] === undefined ? 1 : num(parts[3], 1);
  if ([r, g, b, a].some((x) => !Number.isFinite(x))) return null;
  return { r, g, b, a };
}

// Source-over: top color with alpha painted on an opaque bottom color.
export function composite(top, bottom) {
  const a = top.a;
  return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a), a: 1 };
}

export function luminance({ r, g, b }) {
  const ch = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrastRatio(fg, bg) {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// WCAG 2.x AA: 3:1 for large text (>= 24px, or >= 18.66px at weight 700+), 4.5:1 otherwise.
export function contrastThreshold(fontSizePx, fontWeight) {
  const large = fontSizePx >= 24 || (fontSizePx >= 18.66 && Number(fontWeight) >= 700);
  return large ? 3 : 4.5;
}

// The page probe returns the text color, the stack of ancestor backgrounds (innermost first)
// and the effective opacity. A background image or an unparsable color makes the result
// unknown rather than a guess.
export function textContrast(sample) {
  const fg = parseColor(sample.color);
  if (!fg) return { ratio: null, reason: `unparsed text color ${sample.color}` };
  let bg = null;
  const stack = [];
  for (const layer of sample.backgrounds || []) {
    if (layer.image) return { ratio: null, reason: 'text over a background image or gradient' };
    const c = parseColor(layer.color);
    if (!c) return { ratio: null, reason: `unparsed background ${layer.color}` };
    if (c.a === 0) continue;
    stack.push(c);
    if (c.a >= 1) { bg = c; break; }
  }
  if (!bg) {
    if (!sample.canvas) return { ratio: null, reason: 'no opaque background found' };
    bg = sample.canvas;
  }
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i] !== bg) bg = composite(stack[i], bg);
  const opacity = sample.opacity ?? 1;
  const ink = composite({ ...fg, a: fg.a * opacity }, bg);
  return { ratio: Math.round(contrastRatio(ink, bg) * 100) / 100, reason: null };
}

// rAF callbacks per second over a window. Below 2/s is treated as idle.
export function rafRate(count, ms) {
  if (!Number.isFinite(count) || !Number.isFinite(ms) || ms <= 0) return null;
  return Math.round((count / ms) * 1000 * 10) / 10;
}
export const RAF_ACTIVE = 2;

const f = (severity, check, detail, extra = {}) => ({ severity, check, detail, ...extra });

// Turn one view's raw probe results into findings. `view` = {viewport, theme, reducedMotion}.
export function findingsForView(view, probe) {
  const out = [];
  const where = { viewport: view.viewport.name, theme: view.theme };
  if (probe.navigationError) {
    out.push(f('blocker', 'load', `page did not load: ${probe.navigationError}`, where));
    return out;
  }
  for (const e of probe.pageErrors || []) out.push(f('major', 'console', `uncaught error: ${e}`, where));
  for (const e of (probe.consoleErrors || []).slice(0, 5)) out.push(f('minor', 'console', `console error: ${e}`, where));
  if (probe.blank) out.push(f('blocker', 'render', 'page rendered no visible content', where));

  const o = probe.overflow;
  if (o && o.px > 1) {
    out.push(f(view.viewport.mobile ? 'major' : 'minor', 'overflow', `page scrolls sideways by ${o.px}px; widest: ${o.offenders.map((x) => `${x.sel} (right ${x.right}px)`).join(', ') || 'unknown element'}`, where));
  }

  const failing = (probe.contrast?.samples || []).map((s) => ({ ...s, ...textContrast(s) }))
    .filter((s) => s.ratio !== null && s.ratio < contrastThreshold(s.fontSize, s.fontWeight));
  failing.sort((a, b) => a.ratio - b.ratio);
  if (failing.length) {
    out.push(f(failing[0].ratio < 3 ? 'major' : 'minor', 'contrast', `${failing.length} text element(s) below WCAG AA; worst: ${failing.slice(0, 3).map((s) => `${s.sel} "${s.text}" ${s.ratio}:1`).join('; ')}`, where));
  }
  if (probe.contrast?.unknown) out.push(f('info', 'contrast', `${probe.contrast.unknown} text element(s) not measurable (over images, gradients or unparsed colors); check them in the screenshots`, where));

  if (view.viewport.mobile && probe.targets?.length) {
    out.push(f('minor', 'tap-target', `${probe.targets.length} interactive element(s) smaller than 24x24px; e.g. ${probe.targets.slice(0, 3).map((t) => `${t.sel} ${t.w}x${t.h}`).join(', ')}`, where));
  }
  for (const img of probe.images?.broken || []) out.push(f('major', 'image', `broken image ${img}`, where));
  if (probe.images?.noAlt?.length) out.push(f('minor', 'a11y', `${probe.images.noAlt.length} image(s) without an alt attribute; e.g. ${probe.images.noAlt.slice(0, 3).join(', ')}`, where));

  if (Number.isFinite(probe.cls) && probe.cls > 0.1) out.push(f(probe.cls > 0.25 ? 'major' : 'minor', 'layout-shift', `cumulative layout shift ${probe.cls.toFixed(3)} during load (good is 0.1 or less)`, where));
  const loaf = probe.loaf;
  if (loaf && loaf.count) {
    out.push(f(loaf.worst > 200 ? 'major' : 'minor', 'jank', `${loaf.count} long animation frame(s) over 50ms; worst ${Math.round(loaf.worst)}ms`, where));
  }
  return out;
}

export function findingsForMotion(view, m) {
  const out = [];
  const where = { viewport: view.viewport.name, theme: view.theme };
  if (!m) return out;
  if (m.offscreen === 'unknown') out.push(f('info', 'offscreen-render', `could not scroll every canvas or video out of view (${m.offscreenReason}); check pausing by hand`, where));
  else if (m.offscreen !== null && m.offscreen >= RAF_ACTIVE) out.push(f('major', 'offscreen-render', `animation loop keeps running with every canvas/video scrolled out of view (${m.offscreen} frames/s); pause it with IntersectionObserver`, where));
  if (m.idle !== null && m.idle >= RAF_ACTIVE && m.offscreen === null) out.push(f('info', 'idle-render', `requestAnimationFrame runs ${m.idle} times/s with the page at rest; confirm a visible animation needs it`, where));
  if (m.reduced) {
    if (m.reduced.raf !== null && m.reduced.raf >= RAF_ACTIVE) out.push(f('major', 'reduced-motion', `animation loop runs ${m.reduced.raf} frames/s with prefers-reduced-motion: reduce`, where));
    if (m.reduced.infinite.length) out.push(f('major', 'reduced-motion', `${m.reduced.infinite.length} infinite CSS/WAAPI animation(s) still running under reduced motion; e.g. ${m.reduced.infinite.slice(0, 3).join(', ')}`, where));
  }
  return out;
}

export function findingsForInteraction(view, i) {
  const out = [];
  const where = { viewport: view.viewport.name, theme: view.theme };
  if (!i) return out;
  for (const h of i.hover || []) {
    if (h.layoutMoved) out.push(f('major', 'hover', `hovering ${h.sel} changes layout (${h.layoutMoved}); animate transform/opacity instead`, { ...where, evidence: h.evidence }));
    else if (h.unchanged && h.kind === 'button') out.push(f('minor', 'hover', `no visible hover feedback on ${h.sel}`, { ...where, evidence: h.evidence }));
  }
  const stops = i.focus || [];
  if (i.focusCount === 0) out.push(f('major', 'keyboard', 'Tab reaches no focusable element', where));
  const invisible = stops.filter((s) => s.invisible);
  if (invisible.length) out.push(f('major', 'keyboard', `${invisible.length} of ${stops.length} focus stop(s) show no visible focus; e.g. ${invisible.slice(0, 3).map((s) => s.sel).join(', ')}`, { ...where, evidence: invisible[0].evidence }));
  return out;
}

export function themeFindings(sigsByViewport) {
  // sigs are the computed colors of the page root and its first text elements per theme. If they
  // match across light and dark the page ignores the color scheme. Colors, not screenshot hashes:
  // a running animation makes every screenshot differ.
  const out = [];
  for (const [viewport, byTheme] of Object.entries(sigsByViewport)) {
    const sigs = Object.values(byTheme);
    if (sigs.length > 1 && sigs.every((s) => s && s === sigs[0])) out.push(f('info', 'theme', 'light and dark renders are identical: the page does not follow the color scheme (fine if it has one theme by design)', { viewport, theme: 'all' }));
  }
  return out;
}

export function summarize(findings) {
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  for (const x of findings) counts[x.severity]++;
  return { counts, pass: counts.blocker === 0 && counts.major === 0 };
}

export function sortFindings(findings) {
  return [...findings].sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.check.localeCompare(b.check) || String(a.viewport).localeCompare(String(b.viewport)));
}

// Collapse identical findings reported for several views into one line with all the views.
export function mergeFindings(findings) {
  const map = new Map();
  for (const x of findings) {
    const key = `${x.severity}|${x.check}|${x.detail}`;
    const views = `${x.viewport}/${x.theme}`;
    if (map.has(key)) map.get(key).views.push(views);
    else map.set(key, { ...x, views: [views] });
  }
  return sortFindings([...map.values()]);
}

export function renderMarkdown(report) {
  const { summary, findings, url, shots, notes } = report;
  const lines = [`# Visual audit: ${url}`, '', `Result: **${summary.pass ? 'pass' : 'fail'}** (blocker ${summary.counts.blocker}, major ${summary.counts.major}, minor ${summary.counts.minor}, info ${summary.counts.info})`, ''];
  lines.push('Automated checks only cover what a script can measure. Hierarchy, typography, art direction and motion quality still need a person or model to look at the screenshots below.', '');
  if (findings.length) {
    lines.push('## Findings', '');
    for (const x of findings) lines.push(`- **${x.severity}** \`${x.check}\` (${x.views.join(', ')}): ${x.detail}${x.evidence ? ` — evidence: \`${x.evidence}\`` : ''}`);
    lines.push('');
  } else lines.push('No automated findings.', '');
  if (notes?.length) lines.push('## Not checked', '', ...notes.map((n) => `- ${n}`), '');
  lines.push('## Screenshots', '', ...shots.map((s) => `- ${s.label}: \`${s.path}\``), '');
  return lines.join('\n');
}
