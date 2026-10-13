import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import zlib from 'node:zlib';
import { git } from './repo.mjs';
import { expand, globToRegExp, matchesAny, median, nowIso, percentile, run, toPosix } from './util.mjs';

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.kt', '.swift', '.rb', '.cs', '.vue', '.svelte', '.css', '.scss']);
const UNIT = { duration: 'ms', size: 'bytes', duplication: '%', loc: 'lines', http: 'ms', exit: 'failed', regex: '', json: '' };

export function portOpen(port, host = '127.0.0.1', timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

export async function requirementsUnmet(def) {
  if (def.requires_port_free && (await portOpen(Number(def.requires_port_free)))) return `port ${def.requires_port_free} is in use (live service)`;
  if (def.requires_port_open && !(await portOpen(Number(def.requires_port_open)))) return `port ${def.requires_port_open} is not serving`;
  return null;
}

export function trackedCodeFiles(cwd, globs) {
  const files = git(cwd, ['ls-files'], { allowFail: true }).stdout.split('\n').filter(Boolean);
  return files.filter((f) => CODE_EXT.has(path.extname(f).toLowerCase()) && (!globs?.length || matchesAny(f, globs)) && !/(^|\/)(dist|build|vendor|node_modules|__generated__|generated)\//.test(f) && !/\.min\.|\.d\.ts$|lock/.test(f));
}

const TEST_FILE = /(^|\/)test_[^/]+\.py$|_test\.(py|go)$|\.(test|spec)\.[cm]?[jt]sx?$/;

/**
 * Tracked test files that belong to the changed files: changed tests themselves plus
 * tests named after a changed module (test_<stem>*.py, <stem>.test.ts, <stem>_test.go).
 * Paths are returned relative to `scope`, the directory the check runs in.
 */
export function relatedTests(cwd, files, scope = '') {
  const prefix = scope ? `${toPosix(scope).replace(/\/+$/, '')}/` : '';
  const tests = git(cwd, ['ls-files'], { allowFail: true }).stdout.split('\n').filter((f) => f.startsWith(prefix) && TEST_FILE.test(f));
  const out = new Set();
  for (const f of files.map(toPosix)) {
    if (!f.startsWith(prefix)) continue;
    if (tests.includes(f)) {
      out.add(f);
      continue;
    }
    const stem = path.posix.basename(f).replace(/\.[^.]+$/, '');
    if (stem.length < 3 || ['index', '__init__', 'main', 'utils', 'types'].includes(stem)) continue;
    for (const t of tests) {
      const base = path.posix.basename(t);
      if (base.startsWith(`test_${stem}`) || base.startsWith(`${stem}.test.`) || base.startsWith(`${stem}.spec.`) || base.startsWith(`${stem}_test.`)) out.add(t);
    }
  }
  return [...out].map((t) => t.slice(prefix.length)).sort();
}

function normalizedLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && !/^(\/\/|#|\*|\/\*|import |from |export \{|\}|\);?|\]|\{)$/.test(l) && !/^(import|from)\s/.test(l));
}

const WINDOW = 6;

/** Share of normalized lines that sit inside a 6-line window repeated elsewhere, plus top clones. */
export function duplication(cwd, globs) {
  const files = trackedCodeFiles(cwd, globs);
  const seen = new Map();
  const perFile = [];
  for (const f of files) {
    let text;
    try {
      const stat = fs.statSync(path.join(cwd, f));
      if (stat.size > 400_000) continue;
      text = fs.readFileSync(path.join(cwd, f), 'utf8');
    } catch {
      continue;
    }
    const lines = normalizedLines(text);
    perFile.push({ f, lines });
    for (let i = 0; i + WINDOW <= lines.length; i++) {
      const key = lines.slice(i, i + WINDOW).join('\n');
      const list = seen.get(key);
      if (list) {
        if (list.length < 8) list.push(`${f}:${i}`);
      } else seen.set(key, [`${f}:${i}`]);
    }
  }
  let total = 0;
  let dup = 0;
  for (const { f, lines } of perFile) {
    total += lines.length;
    const covered = new Uint8Array(lines.length);
    for (let i = 0; i + WINDOW <= lines.length; i++) {
      if ((seen.get(lines.slice(i, i + WINDOW).join('\n'))?.length ?? 0) > 1) covered.fill(1, i, i + WINDOW);
    }
    dup += covered.reduce((a, b) => a + b, 0);
    void f;
  }
  const clones = [...seen.values()]
    .filter((l) => l.length > 1 && new Set(l.map((x) => x.split(':')[0])).size > 1)
    .slice(0, 400);
  const pairCounts = new Map();
  for (const l of clones) {
    const fs2 = [...new Set(l.map((x) => x.split(':')[0]))].sort();
    const key = fs2.slice(0, 3).join(' <> ');
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  }
  const top = [...pairCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([files, windows]) => ({ files, windows }));
  return { pct: total ? (dup / total) * 100 : 0, totalLines: total, duplicatedLines: dup, top };
}

export function loc(cwd, globs) {
  let total = 0;
  const per = [];
  for (const f of trackedCodeFiles(cwd, globs)) {
    try {
      const n = fs.readFileSync(path.join(cwd, f), 'utf8').split(/\r?\n/).filter((l) => l.trim()).length;
      total += n;
      per.push({ file: f, lines: n });
    } catch {
      // deleted in working tree
    }
  }
  per.sort((a, b) => b.lines - a.lines);
  return { total, largest: per.slice(0, 15) };
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

export function sizeOf(cwd, def) {
  const base = path.join(cwd, def.path);
  if (!fs.existsSync(base)) return null;
  const files = fs.statSync(base).isDirectory() ? walk(base) : [base];
  const re = def.glob ? globToRegExp(def.glob) : null;
  let bytes = 0;
  for (const f of files) {
    if (re && !re.test(toPosix(path.relative(base, f)))) continue;
    bytes += def.gzip ? zlib.gzipSync(fs.readFileSync(f)).length : fs.statSync(f).size;
  }
  return bytes;
}

async function httpLatency(def) {
  const requests = Number(def.requests || 30);
  const timings = [];
  let failures = 0;
  for (let i = 0; i < Number(def.warmup ?? 3); i++) await fetch(def.url).then((r) => r.arrayBuffer()).catch(() => {});
  for (let i = 0; i < requests; i++) {
    const t = performance.now();
    try {
      const res = await fetch(def.url, { signal: AbortSignal.timeout(Number(def.timeout_ms || 15000)) });
      await res.arrayBuffer();
      if (!res.ok) failures++;
      else timings.push(performance.now() - t);
    } catch {
      failures++;
    }
  }
  return { p50: percentile(timings, 50), p95: percentile(timings, 95), p99: percentile(timings, 99), failures, requests };
}

function dig(obj, dotted) {
  return String(dotted)
    .split('.')
    .reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/**
 * Measure one metric definition inside `cwd`. Returns one or more scalar results; http metrics
 * expand into name.p50/.p95/.p99 so every stored value stays comparable.
 */
export async function measureMetric(def, ctx) {
  const at = nowIso();
  const base = { name: def.name, kind: def.kind, unit: def.unit ?? UNIT[def.kind] ?? '', better: def.better ?? 'lower', at };
  const unmet = await requirementsUnmet(def);
  if (unmet) return [{ ...base, ok: false, skipped: true, value: null, error: unmet }];
  const cwd = def.cwd ? path.join(ctx.cwd, def.cwd) : ctx.cwd;
  const timeoutMs = Number(def.timeout_minutes || 20) * 60_000;
  const cmd = def.run ? expand(def.run, ctx.vars) : null;
  const logFile = (i) => (ctx.logDir ? path.join(ctx.logDir, `${def.name}-${Date.now()}-${i}.log`) : undefined);

  try {
    switch (def.kind) {
      case 'duplication': {
        const d = duplication(cwd, def.paths);
        return [{ ...base, ok: true, value: Number(d.pct.toFixed(3)), detail: { totalLines: d.totalLines, duplicatedLines: d.duplicatedLines } }];
      }
      case 'loc':
        return [{ ...base, ok: true, value: loc(cwd, def.paths).total }];
      case 'size': {
        const v = sizeOf(cwd, def);
        return [{ ...base, ok: v != null, value: v, error: v == null ? `${def.path} does not exist (build first?)` : undefined }];
      }
      case 'http': {
        const r = await httpLatency(def);
        const ok = r.p50 != null;
        return ['p50', 'p95', 'p99'].map((p) => ({ ...base, name: `${def.name}.${p}`, ok, value: r[p] == null ? null : Number(r[p].toFixed(1)), detail: { failures: r.failures, requests: r.requests } }));
      }
      default: {
        const repeat = Math.max(1, Number(def.repeat || 1));
        const samples = [];
        let last;
        for (let i = 0; i < repeat; i++) {
          last = await run(cmd, { cwd, timeoutMs, env: def.env, logFile: logFile(i) });
          if (def.kind === 'duration') {
            if (last.code !== 0) break;
            samples.push(last.ms);
          } else if (def.kind === 'exit') {
            samples.push(last.code === 0 ? 0 : 1);
          } else if (def.kind === 'regex') {
            const m = new RegExp(def.pattern, def.flags || 'm').exec(`${last.stdout}\n${last.stderr}`);
            const v = m ? Number(String(m[1] ?? m[0]).replace(/,/g, '')) : def.missing ?? null;
            if (v != null) samples.push(v);
          } else if (def.kind === 'json') {
            const text = last.stdout.slice(Math.max(0, Math.min(...['{', '['].map((c) => last.stdout.indexOf(c)).filter((i) => i >= 0))));
            const v = Number(dig(JSON.parse(text), def.path));
            if (Number.isFinite(v)) samples.push(v);
          }
        }
        const value = median(samples);
        const ok = value != null && (def.kind !== 'duration' || last.code === 0);
        return [
          {
            ...base,
            ok,
            value,
            samples,
            commandMs: last?.ms,
            exitCode: last?.code,
            error: ok ? undefined : `exit ${last?.code}${last?.timedOut ? ' (timeout)' : ''}: ${(last?.stderr || last?.stdout || '').slice(-400)}`,
          },
        ];
      }
    }
  } catch (error) {
    return [{ ...base, ok: false, value: null, error: String(error.message || error).slice(0, 400) }];
  }
}

export async function measureAll(metrics, ctx, { quick = false, only, budgetMs } = {}) {
  const results = {};
  const started = Date.now();
  for (const def of metrics) {
    if (only && !only.includes(def.name)) continue;
    if (quick && !def.quick) continue;
    if (budgetMs && Date.now() - started > budgetMs) {
      results[def.name] = { name: def.name, ok: false, skipped: true, value: null, error: 'tick time budget exhausted' };
      continue;
    }
    for (const r of await measureMetric(def, ctx)) results[r.name] = r;
  }
  return results;
}

/** Decide whether `after` is better/worse than `before` for a metric. */
export function compare(def = {}, before, after) {
  if (before?.value == null || after?.value == null) return { verdict: 'unknown' };
  const b = Number(before.value);
  const a = Number(after.value);
  const delta = a - b;
  const pct = b === 0 ? (a === 0 ? 0 : 100) : (delta / Math.abs(b)) * 100;
  const better = (def.better ?? before.better ?? 'lower') === 'lower' ? -pct : pct;
  const tolerance = Number(def.tolerance_pct ?? 5);
  const improveAt = Number(def.improve_pct ?? Math.max(0.5, tolerance / 2));
  const verdict = better >= improveAt ? 'improved' : -better > tolerance ? 'regressed' : 'neutral';
  return { before: b, after: a, delta, pct: Number(pct.toFixed(2)), verdict, gate: def.gate !== false };
}
