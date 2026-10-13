import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const IS_WINDOWS = process.platform === 'win32';

export function nowIso() {
  return new Date().toISOString();
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
}

export function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, text);
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (error) {
      // Windows refuses the rename while another process briefly holds the target open.
      if (attempt >= 20 || !['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) {
        fs.rmSync(tmp, { force: true });
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
}

export function writeJson(file, value) {
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function appendJsonl(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
}

export function readJsonl(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // A torn final line from an interrupted append is skipped, not fatal.
    }
  }
  return out;
}

export function hash(text, length = 12) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, length);
}

export function toPosix(p) {
  return p.split(path.sep).join('/');
}

export function globToRegExp(glob) {
  let g = toPosix(glob.trim());
  const anchored = g.includes('/') && !g.startsWith('**/');
  if (g.startsWith('/')) g = g.slice(1);
  if (g.endsWith('/')) g += '**';
  let re = '';
  let braces = 0;
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '{' && g.indexOf('}', i) > i) {
      braces++;
      re += '(?:';
    } else if (c === '}' && braces) {
      braces--;
      re += ')';
    } else if (c === ',' && braces) {
      re += '|';
    } else if (c === '*') {
      if (g[i + 1] === '*') {
        const slash = g[i + 2] === '/';
        re += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(anchored ? `^${re}$` : `(?:^|/)${re}$`);
}

export function matchesAny(file, globs = []) {
  const f = toPosix(file);
  return globs.some((g) => {
    const re = globToRegExp(g);
    if (re.test(f)) return true;
    // A bare directory glob ("deploy" or "deploy/") also covers everything below it.
    const dir = toPosix(g).replace(/\/+$/, '');
    return !/[*?]/.test(dir) && (f === dir || f.startsWith(`${dir}/`));
  });
}

export function pathsOverlap(a, b) {
  const x = toPosix(a).replace(/\/+$/, '');
  const y = toPosix(b).replace(/\/+$/, '');
  if (/[*?]/.test(x)) return matchesAny(y, [x]);
  if (/[*?]/.test(y)) return matchesAny(x, [y]);
  return x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`);
}

export function killTree(pid) {
  if (!pid) return;
  try {
    if (IS_WINDOWS) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-pid, 'SIGKILL');
  } catch {
    // Already gone.
  }
}

export function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

const TAIL = 6000;

/**
 * Run a shell command (string) or an argv array with a hard timeout that kills the whole
 * process tree. Output is kept as a bounded tail; the full stream goes to logFile when given.
 */
export function run(command, { cwd, timeoutMs = 10 * 60_000, env, logFile } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const argv = Array.isArray(command);
    const child = spawn(argv ? command[0] : command, argv ? command.slice(1) : [], {
      cwd,
      env: { ...process.env, ...env },
      shell: !argv,
      windowsHide: true,
      detached: !IS_WINDOWS,
    });
    let out = '';
    let err = '';
    let log;
    if (logFile) {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      log = fs.createWriteStream(logFile);
      log.write(`$ ${argv ? command.join(' ') : command}\n# cwd ${cwd}\n`);
    }
    const take = (chunk, which) => {
      const s = chunk.toString();
      log?.write(s);
      if (which === 'out') out = (out + s).slice(-TAIL);
      else err = (err + s).slice(-TAIL);
    };
    child.stdout.on('data', (c) => take(c, 'out'));
    child.stderr.on('data', (c) => take(c, 'err'));
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, timeoutMs);
    const finish = (code, spawnError) => {
      clearTimeout(timer);
      log?.end(`\n# exit ${code}${timedOut ? ' (timeout)' : ''} in ${Date.now() - started}ms\n`);
      resolve({
        code: timedOut ? 124 : code,
        stdout: out,
        stderr: spawnError ? String(spawnError.message) : err,
        ms: Date.now() - started,
        timedOut,
      });
    };
    child.on('error', (e) => finish(127, e));
    child.on('close', (code) => finish(code ?? 1));
  });
}

export function runSync(argv, { cwd, allowFail = false, input, timeoutMs = 120_000 } = {}) {
  const res = spawnSync(argv[0], argv.slice(1), {
    cwd,
    input,
    encoding: 'utf8',
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  const result = {
    code: res.status ?? (res.error ? 127 : 1),
    stdout: (res.stdout || '').trimEnd(),
    stderr: (res.stderr || res.error?.message || '').trimEnd(),
  };
  if (!allowFail && result.code !== 0) {
    throw new Error(`${argv.join(' ')} failed (${result.code}): ${result.stderr || result.stdout}`);
  }
  return result;
}

export function commandExists(name) {
  const probe = IS_WINDOWS ? runSync(['where', name], { allowFail: true }) : runSync(['sh', '-c', `command -v ${name}`], { allowFail: true });
  return probe.code === 0;
}

export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function percentile(values, p) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const idx = Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1));
  return v[idx];
}

export function localDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseWindow(window = '22:00-07:00') {
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(String(window).trim());
  if (!m) throw new Error(`Invalid schedule.window "${window}" (expected HH:MM-HH:MM)`);
  return { start: Number(m[1]) * 60 + Number(m[2]), end: Number(m[3]) * 60 + Number(m[4]) };
}

export function inWindow(window, d = new Date()) {
  const { start, end } = parseWindow(window);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/**
 * JSON laid out the way Prettier prints it (objects expanded, short scalar arrays inline), so a
 * file inside a checkout passes the repo's `prettier --check`. Numeric arrays too long for one
 * line would be "filled" by Prettier; callers keep such data out of checkout files.
 */
export function formatJson(value, width = 80) {
  const pad = (n) => ' '.repeat(n);
  const fmt = (v, indent, lead, trail) => {
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      const nested = v.some((x) => x && typeof x === 'object' && Object.keys(x).length);
      if (!nested) {
        const one = `[${v.map((x) => fmt(x ?? null, indent, 0, 0)).join(', ')}]`;
        if (lead + one.length + trail <= width) return one;
      }
      const inner = indent + 2;
      return `[\n${v.map((x, i) => pad(inner) + fmt(x ?? null, inner, inner, i < v.length - 1 ? 1 : 0)).join(',\n')}\n${pad(indent)}]`;
    }
    if (v && typeof v === 'object') {
      const keys = Object.keys(v).filter((k) => v[k] !== undefined && typeof v[k] !== 'function');
      if (!keys.length) return '{}';
      const inner = indent + 2;
      return `{\n${keys
        .map((k, i) => {
          const key = `${JSON.stringify(k)}: `;
          return pad(inner) + key + fmt(v[k], inner, inner + key.length, i < keys.length - 1 ? 1 : 0);
        })
        .join(',\n')}\n${pad(indent)}}`;
    }
    return JSON.stringify(v) ?? 'null';
  };
  return `${fmt(value, 0, 0, 0)}\n`;
}

/** The date a night is named after: the day its window opened, so 01:00 belongs to the evening before. */
export function nightDate(window, d = new Date()) {
  const { start, end } = parseWindow(window);
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (start > end && minutes < end) {
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    return localDate(prev);
  }
  return localDate(d);
}

/** The next moment the window closes, measured from `from`. */
export function windowEnd(window, from = new Date()) {
  const { end } = parseWindow(window);
  const d = new Date(from);
  d.setHours(Math.floor(end / 60), end % 60, 0, 0);
  if (d <= from) d.setDate(d.getDate() + 1);
  return d;
}

export function fmtMs(ms) {
  if (ms == null) return 'n/a';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}min`;
}

export function expand(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (all, key) => (key in vars ? vars[key] : all));
}

export function tokenize(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'add', 'use', 'make', 'improve', 'better', 'reduce', 'this', 'that']);

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
