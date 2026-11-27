// The morning report (Markdown + Interactive HTML Dashboard). Every line and metric comes strictly
// from .night/ evidence (state, baseline, experiments, failures, approvals, artifacts); nothing is
// fabricated or estimated. Unknowns stay visibly unknown.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, readJsonl, writeAtomic, fmtMs } from '../../../../nightly-evolution/scripts/lib/util.mjs';
import { paths, loadState } from './state.mjs';
import { readApprovals, reportState } from './unblock.mjs';

const short = (sha) => (sha ? String(sha).slice(0, 8) : 'none');
const checkLine = (c) => `${c.name}: ${c.skipped ? 'skipped' : c.missing_tool ? 'could not run (tool missing)' : c.ok ? 'pass' : `fail (exit ${c.code})`}${c.counts ? ` [${c.counts.passed ?? '?'} passed, ${c.counts.failed ?? '?'} failed${c.counts.skipped ? `, ${c.counts.skipped} skipped` : ''}]` : ''}${c.flaky ? ' (flaky)' : ''}`;
const why = (e) => [...(e.regressions || []), ...(e.notes || [])].slice(0, 3).join('; ') || 'no detail recorded';
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function collectEvidence(root) {
  const p = paths(root);
  const s = loadState(root);
  if (!s) return { p, s: null };
  const exps = readJsonl(p.experiments).filter((e) => e.run_id === s.run_id);
  const fails = readJsonl(p.failures).filter((f) => f.run_id === s.run_id);
  const baseline = readJson(p.baseline, null);
  const approvals = readApprovals(root);
  const kept = exps.filter((e) => e.verdict === 'keep');
  const keptCode = kept.filter((e) => e.commit);
  const keptReports = kept.filter((e) => e.artifact);
  const finished = exps.filter((e) => e.finished);
  const notKept = exps.filter((e) => e.verdict !== 'keep' && !e.finished);
  const blocked = (s.tasks || []).filter((t) => t.status === 'blocked');
  const pending = (s.tasks || []).filter((t) => t.status === 'pending').sort((a, b) => b.priority - a.priority);
  const elapsed = (Date.parse(s.ended_at || new Date().toISOString()) - Date.parse(s.started_at)) || 0;
  const u = s.usage || {};
  const costText = u.cost_known === false
    ? `unknown (some agents do not report cost; ${u.cost_usd ? `at least $${u.cost_usd}` : 'no reported cost'})`
    : `$${u.cost_usd ?? 0}`;
  const tokens = (u.input_tokens || 0) + (u.output_tokens || 0);
  const decisions = [
    ...approvals.filter((a) => a.status === 'pending').map((a) => `Approval ${a.id}: ${a.decision}${a.consequence ? ` (${a.consequence})` : ''}`),
    ...blocked.map((t) => `${t.title}: ${t.blocked_reason}`),
    ...(s.warnings || []).filter((w) => /dirty|uncommitted|no evaluation|flaky|tool missing|no agent/i.test(w)),
  ];

  // Discover visual screenshot artifacts under .night/artifacts/<run_id>/ if any were captured.
  const runArtDir = path.join(p.artifacts, s.run_id || '');
  const images = [];
  if (s.run_id && fs.existsSync(runArtDir)) {
    const walkImg = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, ent.name);
        if (ent.isDirectory()) walkImg(abs);
        else if (/\.(png|jpe?g|webp|gif)$/i.test(ent.name)) {
          images.push({ name: path.relative(runArtDir, abs).replace(/\\/g, '/'), relFromReports: path.relative(p.reports, abs).replace(/\\/g, '/') });
        }
      }
    };
    try { walkImg(runArtDir); } catch { /* best effort */ }
  }
  return { p, s, exps, fails, baseline, approvals, kept, keptCode, keptReports, finished, notKept, blocked, pending, elapsed, u, costText, tokens, decisions, images };
}

export function renderReport(root) {
  const ev = collectEvidence(root);
  if (!ev.s) return '# Night report\n\nNo run has been recorded in this repository yet.\n';
  const { s, exps, fails, baseline, kept, keptCode, keptReports, finished, notKept, blocked, pending, elapsed, u, costText, tokens, decisions } = ev;

  const out = [
    `# Night report: ${s.run_id}`, '',
    `**${s.status}** (${s.stop_reason || 'running'}) after ${fmtMs(elapsed)} and ${s.iterations} iteration(s): ${keptCode.length} change(s) kept as commits, ${keptReports.length} report(s), ${notKept.length} attempt(s) not kept, ${blocked.length} task(s) blocked.`,
    '',
    `Mode \`${s.mode}\`${s.preset ? ` (preset \`${s.preset}\`)` : ''}${s.stage ? `, stage \`${s.stage}\`` : ''}${s.objective ? `, objective: ${s.objective}` : ''}. Base ${short(s.base_sha)}${s.base_branch ? ` on ${s.base_branch}` : ''}; run branch \`${s.branch || 'none'}\` at ${short(s.head_sha)}. Usage: ${tokens ? `${tokens} tokens reported` : 'no tokens reported'}, cost ${costText}.`,
    '',
  ];

  out.push('## Kept', '');
  if (!kept.length) out.push('Nothing was kept.', '');
  for (const e of keptCode) out.push(`- ${short(e.commit)} ${e.title} (confidence ${e.confidence}, ${e.agent})`, `  evidence: ${(e.improvements || []).join('; ') || 'checks passed with no regression'}${e.changes?.stat ? `; ${e.changes.stat}` : ''}`);
  for (const e of keptReports) out.push(`- report: ${e.title}: \`${path.relative(root, e.artifact).replace(/\\/g, '/')}\``);
  if (kept.length) out.push('');
  if (finished.length) out.push(`Finished (the agent found nothing left to do): ${[...new Set(finished.map((e) => e.title))].join('; ')}.`, '');

  out.push('## Not kept', '');
  if (!notKept.length) out.push('None.', '');
  for (const e of notKept) out.push(`- ${e.verdict.toUpperCase()}${e.failure ? ` (${e.failure})` : ''} ${e.title}, attempt ${e.attempt}: ${why(e)}${e.patch ? `\n  patch: \`${path.relative(root, e.patch).replace(/\\/g, '/')}\`` : ''}`);
  if (notKept.length) out.push('');

  out.push('## Needs you', '', ...(decisions.length ? decisions.map((d) => `- ${d}`) : ['Nothing.']), '');

  if (fails.length) {
    const byClass = new Map();
    for (const f of fails) byClass.set(f.class, (byClass.get(f.class) || 0) + 1);
    out.push('## Failures by kind', '', ...[...byClass].map(([k, n]) => `- ${k}: ${n}`), '');
  }

  out.push('## Checks', '');
  if (baseline?.checks?.length) {
    out.push('Baseline:', ...baseline.checks.map((c) => `- ${checkLine(c)}`), '');
    out.push('Run branch head:', ...(s.head_checks || []).map((c) => `- ${checkLine(c)}`), '');
  } else out.push('No baseline was recorded (no evaluation command, or the run stopped before it).', '');

  out.push('## Next', '');
  out.push(...(pending.length ? pending.slice(0, 8).map((t) => `- ${t.title} (priority ${t.priority})`) : ['The queue is empty.']), '');

  out.push('## How to review', '');
  if (s.branch && keptCode.length) {
    out.push(`- \`git log --oneline ${short(s.base_sha)}..${s.branch}\` lists the kept commits; each has Night-Run and Night-Task trailers.`);
    out.push(`- \`git diff ${short(s.base_sha)}...${s.branch}\` shows the whole night. Merge or cherry-pick what you want; nothing was pushed.`);
  } else out.push('- No commits to review.');
  if (s.run_dir) out.push(`- The run worktree is \`${s.run_dir}\`; remove it with \`git worktree remove\` when done.`);
  out.push('- Interactive dashboard: `.night/reports/latest.html`; experiments: `.night/experiments.jsonl`; logs: `.night/logs/`.', '');

  const unknown = [];
  if (u.cost_known === false) unknown.push('total cost (an agent did not report it)');
  if (!s.head_checks?.length) unknown.push('whether the code works: no check ran');
  if (exps.some((e) => e.verdict === 'inconclusive' && e.failure === 'unverified')) unknown.push('the effect of unverified attempts');
  if (unknown.length) out.push('## Unknown', '', ...unknown.map((x) => `- ${x}`), '');
  return out.join('\n');
}

function pairScreenshots(images) {
  const pairs = [];
  const used = new Set();
  for (const img of images) {
    if (used.has(img.name)) continue;
    if (/(^|\/|[-_])before([-_./]|$)/i.test(img.name)) {
      const target = img.name.replace(/before/i, 'after');
      const mate = images.find((x) => x.name.toLowerCase() === target.toLowerCase());
      if (mate) {
        used.add(img.name);
        used.add(mate.name);
        pairs.push({ label: img.name.replace(/(^|\/|[-_])before([-_.]|$)/i, '$1').replace(/\.[^.]+$/, '') || 'Viewport comparison', before: img, after: mate });
      }
    }
  }
  const singles = images.filter((x) => !used.has(x.name));
  return { pairs, singles };
}

export function renderHtmlReport(root) {
  const repoName = path.basename(root);
  const ev = collectEvidence(root);
  if (!ev.s) {
    return `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Night Report — ${esc(repoName)}</title><style>body{margin:0;font-family:system-ui,sans-serif;background:#0a0d12;color:#e2e8f0;display:grid;place-items:center;min-height:100vh}.empty{max-width:440px;padding:32px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:#111620}h1{margin:0 0 8px;font-size:20px}p{margin:0;color:#94a3b8;line-height:1.5}</style></head><body><main class="empty"><h1>No night run recorded yet</h1><p>Start an autonomous overnight run in <code>${esc(repoName)}</code> with <code>night run auto --detach</code> or seed a DAG with <code>night preset list</code>.</p></main></body></html>\n`;
  }
  const { s, exps, baseline, keptCode, keptReports, finished, notKept, blocked, elapsed, u, tokens, decisions, images } = ev;
  const { pairs, singles } = pairScreenshots(images);
  const basePass = (baseline?.checks || []).reduce((n, c) => n + (c.counts?.passed ?? 0), 0);
  const headPass = (s.head_checks || []).reduce((n, c) => n + (c.counts?.passed ?? 0), 0);
  const checksOk = (s.head_checks || []).filter((c) => c.ok).length;
  const checksTotal = (s.head_checks || []).length;
  const costDisplay = u.cost_known === false ? 'Unknown' : `$${Number(u.cost_usd ?? 0).toFixed(2)}`;
  const costHint = u.cost_known === false
    ? `Exact cost is unknown because at least one agent did not report USD usage${u.cost_usd ? ` (reported floor: $${u.cost_usd})` : ''}. Never shown as $0.`
    : 'Reported USD usage across iterations in this run.';

  const statusTone = s.status === 'done' ? 'emerald' : s.status === 'running' ? 'sky' : s.status === 'paused' ? 'amber' : s.status === 'failed' ? 'rose' : 'slate';
  const signals = (s.signals || []).filter((x) => !x.startsWith('stage-')).slice(0, 8);

  // Build signature timeline SVG nodes (one marker per iteration, spaced smoothly along a subtle horizon curve).
  const pulseNodes = exps.map((e, idx) => {
    const x = exps.length === 1 ? 500 : 60 + (idx / (exps.length - 1)) * 880;
    const y = 38 - Math.sin((idx / Math.max(1, exps.length - 1)) * Math.PI) * 18;
    const kind = e.commit ? 'kept' : e.artifact ? 'report' : e.finished ? 'done' : 'reverted';
    const sym = kind === 'kept' ? '●' : kind === 'report' ? '◆' : kind === 'done' ? '✓' : '↺';
    const label = `#${idx + 1} ${sym} ${e.title} (${e.verdict}${e.commit ? ` ${short(e.commit)}` : ''})`;
    return `<g class="pulse-node pulse-${kind}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})"><title>${esc(label)}</title><circle r="5.5"></circle></g>`;
  }).join('');

  const logCmd = s.branch && keptCode.length ? `git log --oneline ${short(s.base_sha)}..${s.branch}` : '';
  const diffCmd = s.branch && keptCode.length ? `git diff ${short(s.base_sha)}...${s.branch}` : '';

  const readArtifactPreview = (artPath) => {
    try {
      if (!artPath || !fs.existsSync(artPath)) return '';
      return fs.readFileSync(artPath, 'utf8').slice(0, 8000);
    } catch { return ''; }
  };

  const keptCards = keptCode.map((e) => {
    const pick = `git cherry-pick ${e.commit}`;
    const show = `git show ${e.commit}`;
    return `<article class="card item" data-kind="kept">
      <div class="card-row">
        <div class="card-main">
          <div class="badges">
            <span class="pill pill-emerald" title="Verified by supervisor checks and committed on run branch">● Kept</span>
            <code class="sha">${esc(short(e.commit))}</code>
            ${e.loop ? `<span class="tag">${esc(e.loop)}</span>` : ''}
            <span class="meta">conf ${esc(Math.round((e.confidence || 0) * 100))}% · ${esc(e.agent || 'agent')} · ${esc(fmtMs(e.agent_ms || 0))}</span>
          </div>
          <h3 class="item-title">${esc(e.title)}</h3>
          <p class="item-sub">${esc((e.improvements || []).join(' · ') || 'All baseline checks passed with zero regressions')}${e.changes?.stat ? ` <span class="muted">— ${esc(e.changes.stat)}</span>` : ''}</p>
        </div>
        <div class="card-actions">
          <button type="button" class="btn btn-primary" data-copy="${esc(pick)}" title="Copy git cherry-pick command">Cherry-pick</button>
        </div>
      </div>
      <details class="drawer">
        <summary>Evidence, hypothesis &amp; files (${(e.changes?.files || []).length})</summary>
        <div class="drawer-body">
          ${e.hypothesis ? `<p><strong>Hypothesis:</strong> ${esc(e.hypothesis)}</p>` : ''}
          ${e.changes?.files?.length ? `<p><strong>Changed files:</strong> <code>${e.changes.files.map(esc).join('</code>, <code>')}</code></p>` : ''}
          ${e.next_hypothesis ? `<p><strong>Next hypothesis:</strong> ${esc(e.next_hypothesis)}</p>` : ''}
          <div class="cmd-inline"><code>${esc(show)}</code> <button type="button" class="btn btn-ghost" data-copy="${esc(show)}">Copy</button></div>
        </div>
      </details>
    </article>`;
  }).join('');

  const reportCards = keptReports.map((e) => {
    const rel = path.relative(root, e.artifact).replace(/\\/g, '/');
    const body = readArtifactPreview(e.artifact);
    return `<article class="card item" data-kind="reports">
      <div class="card-row">
        <div class="card-main">
          <div class="badges">
            <span class="pill pill-sky" title="Read-only research or product discovery report">◆ Report</span>
            ${e.loop ? `<span class="tag">${esc(e.loop)}</span>` : ''}
            <code class="sha">${esc(rel)}</code>
          </div>
          <h3 class="item-title">${esc(e.title)}</h3>
          <p class="item-sub">${esc(e.claim?.summary || e.hypothesis || 'Evidence-backed report saved in .night/artifacts')}</p>
        </div>
      </div>
      ${body ? `<details class="drawer"><summary>Read report markdown</summary><pre class="report-pre">${esc(body)}</pre></details>` : ''}
    </article>`;
  }).join('');

  const revertedCards = notKept.map((e) => {
    const relPatch = e.patch ? path.relative(root, e.patch).replace(/\\/g, '/') : null;
    const applyCmd = relPatch ? `git apply "${relPatch}"` : '';
    return `<article class="card item" data-kind="reverted">
      <div class="card-row">
        <div class="card-main">
          <div class="badges">
            <span class="pill pill-amber" title="Supervisor reverted this attempt cleanly; worktree restored">↺ ${esc(e.verdict.toUpperCase())}${e.failure ? ` · ${esc(e.failure)}` : ''}</span>
            ${e.loop ? `<span class="tag">${esc(e.loop)}</span>` : ''}
            <span class="meta">attempt ${esc(e.attempt)}</span>
          </div>
          <h3 class="item-title">${esc(e.title)}</h3>
          <p class="item-sub">${esc(why(e))}</p>
        </div>
        ${applyCmd ? `<div class="card-actions"><button type="button" class="btn btn-ghost" data-copy="${esc(applyCmd)}" title="Copy git apply command for saved patch">Copy patch cmd</button></div>` : ''}
      </div>
      ${relPatch ? `<div class="patch-note">Saved patch: <code>${esc(relPatch)}</code></div>` : ''}
    </article>`;
  }).join('');

  const decisionItems = decisions.length
    ? decisions.map((d) => `<li class="decision-row"><span class="pill pill-amber">■ Action</span> <span>${esc(d)}</span></li>`).join('')
    : '<li class="decision-empty">No pending owner decisions, approvals, or warnings.</li>';

  const queueItems = (s.tasks || []).map((t) => {
    const st = reportState(t);
    const tone = st === 'VERIFIED' ? 'emerald' : st === 'RUNNING' ? 'sky' : st === 'READY' ? 'slate' : 'amber';
    const deps = (t.dependencies || t.depends_on || []);
    return `<tr data-kind="queue">
      <td><span class="pill pill-${tone}">${esc(st)}</span></td>
      <td><strong>${esc(t.title)}</strong>${t.key ? ` <code class="sha">${esc(t.key)}</code>` : ''}${deps.length ? `<div class="muted small">depends on: ${deps.map(esc).join(', ')}</div>` : ''}</td>
      <td class="num">${esc(t.priority ?? '—')}</td>
      <td class="num">${esc(t.attempts ?? 0)}</td>
      <td>${t.commits?.length ? `<code class="sha">${esc(short(t.commits.at(-1)))}</code>` : `<span class="muted">${esc(t.blocked_reason || '—')}</span>`}</td>
    </tr>`;
  }).join('');

  const visualHtml = (pairs.length || singles.length) ? `
    <section class="panel" data-section="visuals">
      <div class="section-head">
        <h2>Before &amp; After Visual Evidence</h2>
        <span class="muted small">${pairs.length} pair(s), ${singles.length} snapshot(s)</span>
      </div>
      <div class="pair-grid">
        ${pairs.map((pr, idx) => `<div class="card pair-card" data-pair="${idx}">
          <div class="pair-bar">
            <strong>${esc(pr.label)}</strong>
            <div class="seg" role="group" aria-label="Comparison view">
              <button type="button" class="seg-btn active" data-view="split">Split</button>
              <button type="button" class="seg-btn" data-view="after">After</button>
              <button type="button" class="seg-btn" data-view="before">Before</button>
            </div>
          </div>
          <div class="pair-stage" data-mode="split">
            <figure class="shot shot-before"><figcaption>Before</figcaption><img src="${esc(pr.before.relFromReports)}" alt="Before ${esc(pr.label)}" loading="lazy"></figure>
            <figure class="shot shot-after"><figcaption>After</figcaption><img src="${esc(pr.after.relFromReports)}" alt="After ${esc(pr.label)}" loading="lazy"></figure>
          </div>
        </div>`).join('')}
        ${singles.map((im) => `<figure class="card shot-single"><figcaption>${esc(im.name)}</figcaption><img src="${esc(im.relFromReports)}" alt="${esc(im.name)}" loading="lazy"></figure>`).join('')}
      </div>
    </section>` : '';

  const checksHtml = (baseline?.checks?.length || s.head_checks?.length) ? `
    <section class="panel">
      <div class="section-head">
        <h2>Verification Gates (Baseline → Run Head)</h2>
        <span class="muted small">Supervisor-executed; agent claims ignored</span>
      </div>
      <div class="checks-grid">
        ${(s.head_checks?.length ? s.head_checks : baseline?.checks || []).map((c) => {
          const b = (baseline?.checks || []).find((x) => x.name === c.name);
          const ok = c.ok && !c.flaky;
          const tone = c.missing_tool || c.skipped ? 'slate' : ok ? 'emerald' : 'rose';
          const badge = c.missing_tool ? 'MISSING TOOL' : c.skipped ? 'SKIPPED' : c.flaky ? 'FLAKY' : c.ok ? 'PASS' : `FAIL (${c.code})`;
          const passDelta = b?.counts && c.counts ? `${b.counts.passed} → ${c.counts.passed} passed` : c.counts ? `${c.counts.passed} passed` : 'exit check';
          return `<div class="card check-card">
            <div class="badges"><span class="pill pill-${tone}">${esc(badge)}</span> <strong>${esc(c.name)}</strong></div>
            <div class="num check-stat">${esc(passDelta)}</div>
            <code class="small muted">${esc(c.run || '')}</code>
          </div>`;
        }).join('')}
      </div>
    </section>` : '';

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Night Report · ${esc(repoName)} · ${esc(s.run_id)}</title>
<script>
  try {
    var saved = localStorage.getItem('night-report-theme');
    var sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', saved || sys);
  } catch (e) {}
</script>
<style>
  :root, [data-theme="dark"] {
    --bg: #090c12;
    --bg-glow: radial-gradient(920px 380px at 16% -8%, rgba(56, 189, 248, 0.12), transparent 65%),
               radial-gradient(760px 320px at 86% -12%, rgba(16, 185, 129, 0.09), transparent 60%);
    --surface: #111621;
    --surface-2: #161d2b;
    --header-bg: rgba(13, 17, 26, 0.88);
    --border: rgba(255, 255, 255, 0.085);
    --border-strong: rgba(255, 255, 255, 0.16);
    --text: #f1f5f9;
    --text-2: #cbd5e1;
    --muted: #94a3b8;
    --accent: #38bdf8;
    --accent-ink: #06131f;
    --shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.6);
    --code-bg: rgba(255, 255, 255, 0.055);
    --emerald-bg: rgba(16, 185, 129, 0.15); --emerald-fg: #6ee7b7; --emerald-bd: rgba(16, 185, 129, 0.35);
    --sky-bg: rgba(56, 189, 248, 0.15);     --sky-fg: #7dd3fc;     --sky-bd: rgba(56, 189, 248, 0.35);
    --amber-bg: rgba(245, 158, 11, 0.15);   --amber-fg: #fcd34d;   --amber-bd: rgba(245, 158, 11, 0.35);
    --rose-bg: rgba(244, 63, 94, 0.16);     --rose-fg: #fda4af;    --rose-bd: rgba(244, 63, 94, 0.38);
    --slate-bg: rgba(148, 163, 184, 0.14);  --slate-fg: #cbd5e1;   --slate-bd: rgba(148, 163, 184, 0.28);
  }
  [data-theme="light"] {
    --bg: #f6f4ef;
    --bg-glow: radial-gradient(900px 340px at 15% -10%, rgba(14, 116, 144, 0.07), transparent 65%),
               radial-gradient(720px 280px at 88% -12%, rgba(5, 150, 105, 0.06), transparent 60%);
    --surface: #ffffff;
    --surface-2: #f0ede6;
    --header-bg: rgba(246, 244, 239, 0.92);
    --border: #e2ded4;
    --border-strong: #c8c2b4;
    --text: #14171f;
    --text-2: #2d3340;
    --muted: #596173;
    --accent: #0284c7;
    --accent-ink: #ffffff;
    --shadow: 0 1px 2px rgba(20, 23, 31, 0.04), 0 10px 26px -10px rgba(20, 23, 31, 0.08);
    --code-bg: #efece4;
    --emerald-bg: #ecfdf5; --emerald-fg: #065f46; --emerald-bd: #a7f3d0;
    --sky-bg: #f0f9ff;     --sky-fg: #075985;     --sky-bd: #bae6fd;
    --amber-bg: #fffbeb;   --amber-fg: #92400e;   --amber-bd: #fde68a;
    --rose-bg: #fff1f2;    --rose-fg: #9f1239;    --rose-bd: #fecdd3;
    --slate-bg: #f1f5f9;   --slate-fg: #334155;   --slate-bd: #cbd5e1;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background-color: var(--bg);
    background-image: var(--bg-glow);
    background-attachment: fixed;
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  code, pre, .num, .sha {
    font-family: "JetBrains Mono", "Cascadia Code", "SF Mono", Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }
  .topbar {
    position: sticky; top: 0; z-index: 20;
    background: var(--header-bg);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .topbar-inner, .wrap { max-width: 1160px; margin: 0 auto; padding: 0 24px; }
  .topbar-inner { min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding-top: 8px; padding-bottom: 8px; }
  .brand { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .brand-title { font-weight: 650; letter-spacing: -0.02em; font-size: 16px; }
  .hero { position: relative; padding: 28px 0 18px; overflow: hidden; }
  .hero-grid { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap; position: relative; z-index: 2; }
  .hero h1 { margin: 6px 0 6px; font-size: clamp(22px, 3vw, 30px); letter-spacing: -0.025em; line-height: 1.2; }
  .hero-sub { margin: 0; color: var(--text-2); font-size: 14px; max-width: 72ch; }
  /* Signature horizon pulse blended into hero atmosphere via radial mask */
  .pulse-wrap {
    margin-top: 14px;
    mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
    -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
  }
  .pulse-svg { width: 100%; height: 46px; display: block; overflow: visible; }
  .pulse-track { fill: none; stroke: var(--border-strong); stroke-width: 1.5; stroke-dasharray: 5 5; }
  .pulse-node circle { transition: transform 180ms cubic-bezier(.2,.8,.2,1); transform-box: fill-box; transform-origin: center; cursor: pointer; }
  .pulse-node:hover circle { transform: scale(1.75); }
  .pulse-kept circle { fill: var(--emerald-fg); }
  .pulse-report circle { fill: var(--sky-fg); }
  .pulse-done circle { fill: var(--slate-fg); }
  .pulse-reverted circle { fill: var(--amber-fg); }
  .legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin-top: 4px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(195px, 1fr)); gap: 12px; margin: 12px 0 20px; }
  .kpi {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 14px 16px; box-shadow: var(--shadow);
  }
  .kpi-label { font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; align-items: center; }
  .kpi-val { font-size: 24px; font-weight: 650; letter-spacing: -0.02em; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .kpi-foot { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .cmd-bar {
    display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 10px 14px; margin-bottom: 20px;
  }
  .cmd-chip { display: flex; align-items: center; gap: 8px; background: var(--code-bg); padding: 5px 10px; border-radius: 8px; font-size: 12.5px; }
  .tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
  .tab {
    background: transparent; color: var(--text-2); border: 1px solid transparent;
    padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 550; cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
  }
  .tab:hover { background: var(--surface-2); color: var(--text); }
  .tab.active { background: var(--surface); color: var(--text); border-color: var(--border-strong); box-shadow: var(--shadow); }
  .panel { margin-bottom: 26px; }
  .section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 10px; }
  .section-head h2 { margin: 0; font-size: 16px; letter-spacing: -0.01em; }
  .stack { display: flex; flex-direction: column; gap: 10px; }
  .card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 14px 16px; box-shadow: var(--shadow);
  }
  .card-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .card-main { min-width: 0; flex: 1; }
  .badges { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
  .pill {
    display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600;
    padding: 2px 8px; border-radius: 999px; border: 1px solid transparent; letter-spacing: 0.01em;
    white-space: nowrap; flex-shrink: 0;
  }
  .pill-emerald { background: var(--emerald-bg); color: var(--emerald-fg); border-color: var(--emerald-bd); }
  .pill-sky     { background: var(--sky-bg);     color: var(--sky-fg);     border-color: var(--sky-bd); }
  .pill-amber   { background: var(--amber-bg);   color: var(--amber-fg);   border-color: var(--amber-bd); }
  .pill-rose    { background: var(--rose-bg);    color: var(--rose-fg);    border-color: var(--rose-bd); }
  .pill-slate   { background: var(--slate-bg);   color: var(--slate-fg);   border-color: var(--slate-bd); }
  .tag { font-size: 12px; color: var(--text-2); background: var(--surface-2); padding: 2px 8px; border-radius: 6px; border: 1px solid var(--border); }
  .sha { font-size: 12px; background: var(--code-bg); padding: 2px 7px; border-radius: 6px; color: var(--text); }
  .meta, .muted { color: var(--muted); }
  .small { font-size: 12px; }
  .item-title { margin: 0 0 4px; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
  .item-sub { margin: 0; font-size: 13.5px; color: var(--text-2); }
  .btn {
    border-radius: 8px; font-size: 12.5px; font-weight: 600; padding: 7px 12px; cursor: pointer;
    border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text);
    transition: transform 120ms ease, background-color 150ms ease; white-space: nowrap;
  }
  .btn:hover { background: var(--border); }
  .btn:active { transform: scale(0.98); }
  .btn-primary { background: var(--accent); color: var(--accent-ink); border-color: transparent; }
  .btn-primary:hover { filter: brightness(1.07); background: var(--accent); }
  .btn-ghost { padding: 4px 9px; font-size: 12px; }
  button:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .drawer { margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px; }
  .drawer summary { font-size: 12.5px; color: var(--muted); cursor: pointer; user-select: none; }
  .drawer-body { margin-top: 8px; font-size: 13px; color: var(--text-2); }
  .drawer-body p { margin: 4px 0; }
  .cmd-inline { display: flex; align-items: center; gap: 8px; margin-top: 6px; background: var(--code-bg); padding: 6px 10px; border-radius: 8px; overflow-x: auto; }
  .report-pre { margin: 8px 0 0; padding: 12px; background: var(--code-bg); border-radius: 8px; font-size: 12.5px; white-space: pre-wrap; word-break: break-word; max-height: 420px; overflow: auto; }
  .patch-note { margin-top: 8px; font-size: 12px; color: var(--muted); }
  .decision-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .decision-row { display: flex; align-items: baseline; gap: 10px; font-size: 13.5px; }
  .decision-empty { color: var(--muted); font-size: 13.5px; }
  .checks-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
  .check-stat { font-size: 16px; font-weight: 600; margin: 4px 0; }
  .queue-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { color: var(--muted); font-weight: 550; font-size: 12px; }
  .pair-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
  .pair-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 12px; }
  .seg { display: inline-flex; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 2px; }
  .seg-btn { border: 0; background: transparent; color: var(--muted); padding: 4px 10px; font-size: 12px; border-radius: 6px; cursor: pointer; }
  .seg-btn.active { background: var(--surface); color: var(--text); font-weight: 600; }
  .pair-stage { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .pair-stage[data-mode="after"] .shot-before, .pair-stage[data-mode="before"] .shot-after { display: none; }
  .pair-stage[data-mode="after"], .pair-stage[data-mode="before"] { grid-template-columns: 1fr; }
  .shot, .shot-single { margin: 0; }
  .shot figcaption, .shot-single figcaption { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
  .shot img, .shot-single img { width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--border); display: block; }
  .toast {
    position: fixed; bottom: 20px; right: 20px; background: var(--surface); color: var(--text);
    border: 1px solid var(--border-strong); border-radius: 10px; padding: 9px 14px; font-size: 13px;
    box-shadow: var(--shadow); opacity: 0; transform: translateY(8px); pointer-events: none;
    transition: opacity 160ms ease, transform 160ms ease;
  }
  .toast.show { opacity: 1; transform: translateY(0); }
  .hidden { display: none !important; }
  footer { padding: 20px 0 40px; color: var(--muted); font-size: 12.5px; border-top: 1px solid var(--border); margin-top: 24px; }
  @media (max-width: 680px) {
    .card-row { flex-direction: column; }
    .pair-stage { grid-template-columns: 1fr; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition: none !important; animation: none !important; }
  }
</style>
</head>
<body>
<header class="topbar">
  <div class="topbar-inner">
    <div class="brand">
      <span class="brand-title">${esc(repoName)}</span>
      <span class="pill pill-${statusTone}">${esc(s.status.toUpperCase())}${s.stop_reason ? ` · ${esc(s.stop_reason)}` : ''}</span>
      ${s.stage ? `<span class="tag" title="Detected repository lifecycle stage">stage: ${esc(s.stage)}</span>` : ''}
      ${s.preset ? `<span class="tag" title="Seeded from DAG preset">preset: ${esc(s.preset)}</span>` : ''}
    </div>
    <div class="brand">
      <code class="sha" title="Base commit → Run branch head">${esc(short(s.base_sha))} → ${esc(s.branch || 'no-branch')} (${esc(short(s.head_sha))})</code>
      <button type="button" class="btn btn-ghost" id="themeToggle" aria-label="Toggle light or dark theme">Light / Dark</button>
    </div>
  </div>
</header>

<main class="wrap">
  <section class="hero">
    <div class="hero-grid">
      <div>
        <div class="badges">
          <span class="muted small">Run <code>${esc(s.run_id)}</code> · ${esc(fmtMs(elapsed))} · ${esc(s.iterations)} iteration(s)</span>
          ${signals.map((sg) => `<span class="tag">${esc(sg)}</span>`).join('')}
        </div>
        <h1>Overnight Morning Brief</h1>
        <p class="hero-sub">Mode <code>${esc(s.mode)}</code>${s.objective ? ` — ${esc(s.objective)}` : ''}. Every commit below passed independent verification on an isolated worktree; nothing was pushed or merged.</p>
      </div>
    </div>
    ${exps.length ? `<div class="pulse-wrap" aria-label="Iteration timeline">
      <svg class="pulse-svg" viewBox="0 0 1000 52">
        <path class="pulse-track" d="M 30 38 Q 500 12 970 38"></path>
        ${pulseNodes}
      </svg>
    </div>
    <div class="legend">
      <span>● Kept commit (${keptCode.length})</span>
      <span>◆ Report (${keptReports.length})</span>
      <span>✓ Loop finished (${finished.length})</span>
      <span>↺ Reverted / Inconclusive (${notKept.length})</span>
    </div>` : ''}
  </section>

  <section class="kpis" aria-label="Run summary metrics">
    <div class="kpi" title="Verified commits cherry-picked onto ${esc(s.branch || 'the run branch')}">
      <div class="kpi-label"><span>Kept Commits</span><span>●</span></div>
      <div class="kpi-val num">${keptCode.length}</div>
      <div class="kpi-foot">${keptCode.length ? `On ${esc(s.branch)}` : 'No code commits kept'}</div>
    </div>
    <div class="kpi" title="Read-only research specs and loops that completed cleanly">
      <div class="kpi-label"><span>Reports &amp; Done</span><span>◆</span></div>
      <div class="kpi-val num">${keptReports.length} <span class="muted small">/ ${finished.length} done</span></div>
      <div class="kpi-foot">${notKept.length} attempt(s) reverted cleanly</div>
    </div>
    <div class="kpi" title="Supervisor check status on run branch head vs baseline">
      <div class="kpi-label"><span>Verification Gates</span><span>✓</span></div>
      <div class="kpi-val num">${checksTotal ? `${checksOk}/${checksTotal}` : '0'}</div>
      <div class="kpi-foot">${headPass || basePass ? `${basePass} → ${headPass} tests passing` : 'No test counts reported'}</div>
    </div>
    <div class="kpi" title="Tasks needing owner attention or remaining in queue">
      <div class="kpi-label"><span>Needs You / Blocked</span><span>■</span></div>
      <div class="kpi-val num">${decisions.length}</div>
      <div class="kpi-foot">${(s.tasks || []).filter((t) => t.status === 'pending').length} pending in queue</div>
    </div>
    <div class="kpi" title="${esc(costHint)}">
      <div class="kpi-label"><span>Reported Cost</span><span>ℹ</span></div>
      <div class="kpi-val num">${esc(costDisplay)}</div>
      <div class="kpi-foot num">${tokens ? `${tokens.toLocaleString('en-US')} tokens` : 'No tokens reported'}</div>
    </div>
  </section>

  ${(logCmd || diffCmd) ? `<section class="cmd-bar" aria-label="Quick review commands">
    <span class="small muted">Review branch:</span>
    <div class="cmd-chip"><code>${esc(logCmd)}</code> <button type="button" class="btn btn-ghost" data-copy="${esc(logCmd)}">Copy log</button></div>
    <div class="cmd-chip"><code>${esc(diffCmd)}</code> <button type="button" class="btn btn-ghost" data-copy="${esc(diffCmd)}">Copy diff</button></div>
  </section>` : ''}

  <nav class="tabs" role="tablist" aria-label="Filter overnight results">
    <button type="button" class="tab active" data-filter="all">All (${exps.length})</button>
    <button type="button" class="tab" data-filter="kept">Kept Commits (${keptCode.length})</button>
    <button type="button" class="tab" data-filter="reports">Reports (${keptReports.length})</button>
    <button type="button" class="tab" data-filter="reverted">Not Kept (${notKept.length})</button>
    <button type="button" class="tab" data-filter="decisions">Needs You (${decisions.length})</button>
    <button type="button" class="tab" data-filter="queue">Queue / DAG (${(s.tasks || []).length})</button>
  </nav>

  ${visualHtml}

  <section class="panel" data-group="decisions">
    <div class="section-head"><h2>Needs You</h2><span class="muted small">Approvals, blockers &amp; environment notices</span></div>
    <div class="card"><ul class="decision-list">${decisionItems}</ul></div>
  </section>

  <section class="panel" data-group="kept">
    <div class="section-head"><h2>Kept Commits</h2><span class="muted small">${keptCode.length} verified commit(s)</span></div>
    <div class="stack">${keptCards || '<div class="card muted">No code commits were kept in this run.</div>'}</div>
  </section>

  ${keptReports.length ? `<section class="panel" data-group="reports">
    <div class="section-head"><h2>Research &amp; Discovery Reports</h2><span class="muted small">${keptReports.length} artifact(s)</span></div>
    <div class="stack">${reportCards}</div>
  </section>` : ''}

  ${notKept.length ? `<section class="panel" data-group="reverted">
    <div class="section-head"><h2>Not Kept (Reverted Cleanly with Saved Patches)</h2><span class="muted small">${notKept.length} attempt(s)</span></div>
    <div class="stack">${revertedCards}</div>
  </section>` : ''}

  ${checksHtml}

  <section class="panel" data-group="queue">
    <div class="section-head"><h2>Task Queue &amp; DAG State</h2><span class="muted small">${(s.tasks || []).length} task(s)</span></div>
    <div class="card queue-wrap">
      <table>
        <thead><tr><th>State</th><th>Task</th><th>Priority</th><th>Attempts</th><th>Commit / Note</th></tr></thead>
        <tbody>${queueItems || '<tr><td colspan="5" class="muted">Queue is empty.</td></tr>'}</tbody>
      </table>
    </div>
  </section>

  <footer>
    Evidence-only report generated from <code>.night/state.json</code>, <code>baseline.json</code>, and <code>experiments.jsonl</code>. Worktree: <code>${esc(s.run_dir || 'none')}</code>.
  </footer>
</main>

<div class="toast" id="toast" role="status" aria-live="polite">Copied command</div>
<script>
  (function () {
    var root = document.documentElement;
    var toggle = document.getElementById('themeToggle');
    if (toggle) toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('night-report-theme', next); } catch (e) {}
    });
    var toast = document.getElementById('toast');
    var timer = null;
    function flash(msg) {
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(function () { toast.classList.remove('show'); }, 1800);
    }
    document.addEventListener('click', function (ev) {
      var copyBtn = ev.target.closest('[data-copy]');
      if (copyBtn) {
        var cmd = copyBtn.getAttribute('data-copy') || '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(cmd).then(function () { flash('Copied: ' + cmd.slice(0, 48)); });
        }
        return;
      }
      var tab = ev.target.closest('.tab[data-filter]');
      if (tab) {
        var f = tab.getAttribute('data-filter');
        document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b === tab); });
        document.querySelectorAll('[data-group]').forEach(function (sec) {
          sec.classList.toggle('hidden', f !== 'all' && sec.getAttribute('data-group') !== f);
        });
        return;
      }
      var seg = ev.target.closest('.seg-btn[data-view]');
      if (seg) {
        var card = seg.closest('.pair-card');
        if (!card) return;
        card.querySelectorAll('.seg-btn').forEach(function (b) { b.classList.toggle('active', b === seg); });
        var stage = card.querySelector('.pair-stage');
        if (stage) stage.setAttribute('data-mode', seg.getAttribute('data-view'));
      }
    });
  })();
</script>
</body>
</html>
`;
}

export function writeReport(root) {
  const p = paths(root);
  const s = loadState(root);
  const text = renderReport(root);
  const html = renderHtmlReport(root);
  fs.mkdirSync(p.reports, { recursive: true });
  const id = s?.run_id || 'none';
  const file = path.join(p.reports, `${id}.md`);
  const htmlFile = path.join(p.reports, `${id}.html`);
  writeAtomic(file, text);
  writeAtomic(path.join(p.reports, 'latest.md'), text);
  writeAtomic(htmlFile, html);
  writeAtomic(path.join(p.reports, 'latest.html'), html);
  return { file, htmlFile, text, html };
}
