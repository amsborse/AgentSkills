// Routes the acceptance requests against the real generated registry (not a fixture),
// and measures the per-turn token overhead of the installed descriptions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { route } from "../scripts/route.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(readFileSync(join(root, "registry/skills.json"), "utf8"));

const ACCEPTANCE = [
  ["Revamp my website UI", "revamp-ui"],
  ["Build this feature end to end", "build-feature"],
  ["Research this topic deeply", "research"],
  ["Find and fix this bug", "fix-bug"],
  ["Understand the architecture of this repository", "understand-code"],
  ["Make this project production ready", "production-ready"],
  ["Automate this browser workflow", "automate-browser"],
  ["Run this task autonomously overnight", "run-autonomous"],
];

for (const [prompt, expected] of ACCEPTANCE) {
  test(`routes "${prompt}" to ${expected}`, () => {
    const { matches } = route(prompt, registry);
    assert.ok(matches.length > 0, `no match for "${prompt}"`);
    assert.equal(matches[0].name, expected, JSON.stringify(matches));
  });
}

test("unrelated prompts do not route", () => {
  for (const prompt of ["what time is it in Tokyo", "thanks, that is all"]) {
    assert.deepEqual(route(prompt, registry).matches, [], prompt);
  }
});

test("description overhead stays within budget", () => {
  const chars = registry.skills.reduce((n, s) => n + s.name.length + s.description.length, 0);
  const approxTokens = Math.round(chars / 4);
  console.log(`# ${registry.skills.length} skills, ${chars} description chars, ~${approxTokens} tokens per turn`);
  assert.ok(chars <= 16000, `descriptions use ${chars} chars`);
});
