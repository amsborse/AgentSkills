// Held-out routing evals for the creative skills (evals/creative/routing.json).
// These phrasings are never used to tune aliases; the gate is "no regression, no confident misroute".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { route } from "../scripts/route.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(readFileSync(join(root, "registry/skills.json"), "utf8"));
const evals = JSON.parse(readFileSync(join(root, "evals/creative/routing.json"), "utf8"));
const names = new Set(registry.skills ? registry.skills.map((s) => s.name) : registry.map((s) => s.name));

test("held-out eval file is well formed", () => {
  assert.ok(evals.cases.length >= 16, "too few held-out cases");
  assert.ok(evals.baselineTop1 > 0 && evals.baselineTop1 <= 1);
  for (const c of evals.cases) assert.ok(names.has(c.expected), `unknown skill ${c.expected}`);
  for (const s of evals.creativeSkills) {
    assert.ok(names.has(s), `unknown creative skill ${s}`);
    assert.ok(evals.cases.some((c) => c.expected === s), `${s} has no held-out case`);
  }
});

test("held-out top-1 rate does not regress below the recorded baseline", () => {
  const misses = [];
  let hits = 0;
  for (const c of evals.cases) {
    const top = route(c.prompt, registry).matches[0]?.name;
    if (top === c.expected) hits++;
    else misses.push(`${c.prompt} -> ${top ?? "none"} (want ${c.expected})`);
  }
  const rate = hits / evals.cases.length;
  console.log(`# creative held-out top-1 ${hits}/${evals.cases.length}`);
  assert.ok(rate >= evals.baselineTop1, `top-1 ${rate} < baseline ${evals.baselineTop1}\n${misses.join("\n")}`);
});

test("no held-out case confidently routes to the wrong skill", () => {
  for (const c of evals.cases) {
    const r = route(c.prompt, registry);
    const top = r.matches[0];
    if (top && top.name !== c.expected) assert.ok(r.ambiguous, `"${c.prompt}" confidently routed to ${top.name}, want ${c.expected}`);
  }
});

test("non-creative prompts never route to a creative skill", () => {
  const creative = new Set(evals.creativeSkills);
  for (const p of evals.negatives) {
    for (const m of route(p, registry).matches) assert.ok(!creative.has(m.name), `"${p}" routed to ${m.name}`);
  }
});
