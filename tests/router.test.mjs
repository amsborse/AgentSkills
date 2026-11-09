import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { route } from '../scripts/route.mjs';

const registry = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'registry.json'), 'utf8'));

test('alias phrase beats keyword-only match', () => {
  const result = route('please redesign ui layout', registry);
  assert.equal(result.matches[0].name, 'revamp-ui');
  assert.ok(result.matches[0].score >= 7);
});
test('normalization applies light stemming', () => {
  assert.equal(route('redesigning ui please', registry).matches[0].name, 'revamp-ui');
});
test('threshold and max constrain results', () => {
  assert.deepEqual(route('design layout', registry, { threshold: 3 }).matches, []);
  assert.equal(route('design layout code quality', registry, { threshold: 1, max: 1 }).matches.length, 1);
});
// "design" is a revamp-ui keyword (+1), "check" a verify keyword (+1): an exact tie.
test('ambiguity detects adjacent top scores', () => {
  const result = route('design check', registry, { threshold: 1 });
  assert.equal(result.ambiguous, true);
  assert.equal(route('design code', registry, { threshold: 1 }).ambiguous, false); // review-code 3 vs revamp-ui 1
});
test('singular and plural forms stem to the same token', () => {
  const reg = { skills: [{ name: 'x', aliases: [], keywords: ['feature', 'fix'] }] };
  assert.equal(route('add two features', reg, { threshold: 1 }).matches[0]?.score, 1);
  assert.equal(route('fixes please', reg, { threshold: 1 }).matches[0]?.score, 1);
  const reverse = { skills: [{ name: 'x', aliases: [], keywords: ['features'] }] };
  assert.equal(route('one feature', reverse, { threshold: 1 }).matches[0]?.score, 1);
});
test('empty prompt and no match are empty and unambiguous', () => {
  assert.deepEqual(route('', registry), { matches: [], ambiguous: false });
  assert.deepEqual(route('unrelated planets', registry), { matches: [], ambiguous: false });
});
test('ordering is deterministic for equal scores', () => {
  const result = route('design check', registry, { threshold: 1 });
  assert.deepEqual(result.matches.map((m) => m.name), ['revamp-ui', 'verify']);
});
