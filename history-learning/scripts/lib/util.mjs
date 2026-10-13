import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

export const HOME = os.homedir();

/** Private state lives outside every repository: evidence must never land in a public tree. */
export function stateDir(env = process.env) {
  const dir = env.HISTORY_LEARNING_HOME ? path.resolve(env.HISTORY_LEARNING_HOME) : path.join(HOME, '.agent-history-learning');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const sha = (s, n = 16) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, n);

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

export function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

export const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

export const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

export function walkFiles(dir, test, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, test, out);
    else if (e.isFile() && test(p, e.name)) out.push(p);
  }
  return out;
}

/** Streams a JSONL file without loading it whole; malformed lines are counted, never thrown. */
export async function* jsonl(file, stats = {}) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line);
    } catch {
      stats.badLines = (stats.badLines || 0) + 1;
    }
  }
}

let sqlite;
/** Opens SQLite strictly read-only; the original database is never written. */
export async function openDb(file) {
  if (!sqlite) {
    const emit = process.emitWarning;
    process.emitWarning = (w, ...rest) => (String(w).includes('SQLite') ? undefined : emit.call(process, w, ...rest));
    sqlite = await import('node:sqlite');
  }
  return new sqlite.DatabaseSync(file, { readOnly: true });
}

export const toIso = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : Date.parse(v);
  return Number.isFinite(n) ? new Date(n).toISOString() : null;
};

export const minIso = (a, b) => (!a ? b : !b ? a : a < b ? a : b);
export const maxIso = (a, b) => (!a ? b : !b ? a : a > b ? a : b);

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
    const [k, v] = a.slice(2).split('=', 2);
    if (v !== undefined) args[k] = v;
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) args[k] = argv[++i];
    else args[k] = true;
  }
  return args;
}

export const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
