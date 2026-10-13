import fs from 'node:fs';
import path from 'node:path';
import { git } from './repo.mjs';
import { duplication, loc, trackedCodeFiles } from './measure.mjs';
import { digest } from './memory.mjs';
import { expand, run } from './util.mjs';

function hotspots(cwd, days) {
  const out = git(cwd, ['log', `--since=${days}.days`, '--name-only', '--pretty=format:'], { allowFail: true }).stdout;
  const counts = new Map();
  for (const f of out.split('\n').map((s) => s.trim()).filter(Boolean)) counts.set(f, (counts.get(f) || 0) + 1);
  return [...counts.entries()]
    .filter(([f]) => fs.existsSync(path.join(cwd, f)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([file, commits]) => ({ file, commits }));
}

function markers(cwd, globs) {
  const per = [];
  for (const f of trackedCodeFiles(cwd, globs)) {
    try {
      const n = (fs.readFileSync(path.join(cwd, f), 'utf8').match(/\b(TODO|FIXME|HACK|XXX)\b/g) || []).length;
      if (n) per.push({ file: f, count: n });
    } catch {
      // ignore unreadable files
    }
  }
  return { total: per.reduce((a, b) => a + b.count, 0), top: per.sort((a, b) => b.count - a.count).slice(0, 10) };
}

function summarizeCommand(name, res) {
  const text = res.stdout.trim();
  try {
    const json = JSON.parse(text.slice(text.search(/[[{]/)));
    if (json?.metadata?.vulnerabilities) return { name, exit: res.code, vulnerabilities: json.metadata.vulnerabilities };
    if (Array.isArray(json)) return { name, exit: res.code, items: json.length, sample: json.slice(0, 5) };
    return { name, exit: res.code, keys: Object.keys(json).slice(0, 20) };
  } catch {
    return { name, exit: res.code, tail: `${text}\n${res.stderr}`.trim().slice(-1200) };
  }
}

export async function runSurvey({ repo, policy, cwd, night, logDir }) {
  const globs = (policy.focus || []).flatMap((f) => f.paths || []);
  const dup = duplication(cwd, globs.length ? globs : undefined);
  const size = loc(cwd, globs.length ? globs : undefined);
  const commands = [];
  for (const c of policy.survey?.commands || []) {
    const res = await run(expand(c.run, { main: repo.main, worktree: cwd, night: night.night }), {
      cwd: c.cwd ? path.join(cwd, c.cwd) : cwd,
      timeoutMs: Number(c.timeout_minutes || 5) * 60_000,
      logFile: path.join(logDir, `survey-${c.name}.log`),
    });
    commands.push({ dimension: c.dimension, ms: res.ms, ...summarizeCommand(c.name, res) });
  }
  return {
    night: night.night,
    base: night.baseSha,
    generatedAt: new Date().toISOString(),
    priorities: policy.priorities,
    focus: (policy.focus || []).map((f) => ({ area: f.area, goals: f.goals })),
    baseline: Object.fromEntries(Object.entries(night.baseline?.metrics || {}).map(([k, v]) => [k, v.ok ? `${v.value}${v.unit ? ` ${v.unit}` : ''}` : `unavailable: ${v.error?.slice(0, 100)}`])),
    hotspots: hotspots(cwd, policy.survey?.hotspot_days || 30),
    largestFiles: size.largest.slice(0, 10),
    duplication: { pct: Number(dup.pct.toFixed(2)), top: dup.top },
    markers: markers(cwd, globs.length ? globs : undefined),
    commands,
    memory: digest(repo),
  };
}

export function surveyMarkdown(s) {
  const lines = [`# Survey ${s.night} (base ${s.base?.slice(0, 8)})`, ''];
  lines.push('## Priorities', Object.entries(s.priorities).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', '), '');
  if (s.focus.length) lines.push('## Focus', ...s.focus.map((f) => `- ${f.area}${f.goals?.length ? `: ${f.goals.join('; ')}` : ''}`), '');
  lines.push('## Baseline', ...Object.entries(s.baseline).map(([k, v]) => `- ${k}: ${v}`), '');
  lines.push('## Churn hotspots', ...s.hotspots.map((h) => `- ${h.file} (${h.commits} commits)`), '');
  lines.push('## Largest files', ...s.largestFiles.map((f) => `- ${f.file} (${f.lines} lines)`), '');
  lines.push(`## Duplication ${s.duplication.pct}%`, ...s.duplication.top.map((d) => `- ${d.files} (${d.windows} windows)`), '');
  lines.push(`## TODO/FIXME markers: ${s.markers.total}`, ...s.markers.top.map((m) => `- ${m.file} (${m.count})`), '');
  for (const c of s.commands) lines.push(`## ${c.name} [${c.dimension || 'general'}] exit ${c.exit}`, '```json', JSON.stringify(c.vulnerabilities || c.sample || c.keys || c.tail, null, 1).slice(0, 1500), '```', '');
  lines.push('## Memory (do not repeat)', '```json', JSON.stringify(s.memory, null, 1).slice(0, 5000), '```');
  return `${lines.join('\n')}\n`;
}
