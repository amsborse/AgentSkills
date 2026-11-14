// Blind before/after pairing and verdict tallying for improve-visuals. Pure functions; the CLI
// in ../blind-pairs.mjs does the file copying.

// Deterministic PRNG so a seed reproduces the same A/B assignment.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// beforeFiles / afterFiles: relative paths ('/'-separated). Only files present on both sides are
// paired; the rest are reported so a missing screenshot is visible, never silently dropped.
export function planPairs(beforeFiles, afterFiles, seed) {
  const rand = mulberry32(seed);
  const before = new Set(beforeFiles);
  const after = new Set(afterFiles);
  const common = [...after].filter((f) => before.has(f)).sort();
  const pairs = common.map((rel, i) => ({
    id: String(i + 1).padStart(3, '0'),
    rel,
    a: rand() < 0.5 ? 'before' : 'after',
  }));
  return {
    seed,
    pairs,
    beforeOnly: [...before].filter((f) => !after.has(f)).sort(),
    afterOnly: [...after].filter((f) => !before.has(f)).sort(),
  };
}

const sideOf = (pair, letter) => (letter === 'A' ? pair.a : pair.a === 'before' ? 'after' : 'before');

// Maps blind verdicts back to before/after. A pair without a valid verdict counts as unknown.
export function tally(key, verdicts) {
  if (!Array.isArray(verdicts)) throw new Error('verdicts must be a JSON array');
  const byId = new Map();
  for (const v of verdicts) {
    if (!v || typeof v.id !== 'string') throw new Error(`verdict without a string id: ${JSON.stringify(v)}`);
    if (byId.has(v.id)) throw new Error(`duplicate verdict for pair ${v.id}`);
    byId.set(v.id, v);
  }
  const known = new Set(key.pairs.map((p) => p.id));
  const stray = [...byId.keys()].filter((id) => !known.has(id));
  if (stray.length) throw new Error(`verdicts for unknown pairs: ${stray.join(', ')}`);
  const counts = { after: 0, before: 0, same: 0, unknown: 0 };
  const regressions = [];
  const rows = key.pairs.map((p) => {
    const v = byId.get(p.id);
    let winner = 'unknown';
    if (v && (v.winner === 'A' || v.winner === 'B')) winner = sideOf(p, v.winner);
    else if (v && v.winner === 'same') winner = 'same';
    counts[winner]++;
    const regression = v && (v.regression === 'A' || v.regression === 'B') ? sideOf(p, v.regression) : null;
    if (regression) regressions.push({ id: p.id, rel: p.rel, side: regression, reason: v.reason || '' });
    return { id: p.id, rel: p.rel, winner, dimension: v?.dimension || null, reason: v?.reason || null, regression };
  });
  return { counts, total: key.pairs.length, regressions, rows };
}

export function renderPairsList(plan) {
  const lines = ['# Pairs', '', 'Each pair shows the same region; judge A against B.', ''];
  for (const p of plan.pairs) lines.push(`- ${p.id}: ${p.rel}`);
  return `${lines.join('\n')}\n`;
}
