// The experience composer is a thin router: everything it points at must exist, its modes must
// be documented, and requests for it must not steal requests that belong to the direct skills.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { route } from '../scripts/route.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const skill = read('skills/experience/SKILL.md');
const explore = read('skills/improve-visuals/workflows/explore.md');
const registry = JSON.parse(read('registry/skills.json'));
const entry = registry.skills.find((s) => s.name === 'experience');

test('experience is in the generated registry with a short description', () => {
  assert.ok(entry, 'run node scripts/build-registry.mjs');
  assert.ok(entry.description.length <= 220, `description is ${entry.description.length} characters`);
});

test('every skill it composes exists', () => {
  const composes = skill.match(/composes: "([^"]+)"/)[1].split(',').map((s) => s.trim());
  assert.ok(composes.length >= 8);
  for (const name of composes) assert.ok(existsSync(join(root, 'skills', name, 'SKILL.md')), name);
});

test('every path and skill named in the composer and the explore workflow exists', () => {
  for (const [label, text, base] of [['experience', skill, 'skills/experience'], ['explore', explore, 'skills/improve-visuals/workflows']]) {
    for (const [, p] of text.matchAll(/~\/agent-skills\/([\w./-]+\w\/?)/g)) assert.ok(existsSync(join(root, p)), `${label}: ${p}`);
    for (const [, p] of text.matchAll(/`((?:shared|scripts|workflows)\/[\w./-]+)`/g)) {
      const found = existsSync(join(root, p)) || existsSync(join(root, 'skills/improve-visuals', p)) || existsSync(join(root, base, p));
      assert.ok(found, `${label}: ${p}`);
    }
  }
  const skills = new Set(readdirSync(join(root, 'skills')));
  const recipes = new Set(readdirSync(join(root, 'shared/creative/recipes')));
  const known = new Set(['audit', 'polish', 'transform', 'cinematic', 'interactions', 'performance', 'experiment', 'full', 'current', 'opacity']);
  for (const [, name] of skill.matchAll(/`([a-z]+(?:-[a-z0-9]+)*)`/g)) {
    assert.ok(skills.has(name) || recipes.has(name) || known.has(name), `unknown name \`${name}\` in experience`);
  }
});

test('all eight modes are documented and the redesign guard is stated', () => {
  for (const mode of ['audit', 'polish', 'transform', 'cinematic', 'interactions', 'performance', 'experiment', 'full']) {
    assert.match(skill, new RegExp(`\| \`${mode}\` \|`), mode);
  }
  assert.match(skill, /needs the owner to have asked for a redesign/);
  assert.match(skill, /Prototype before large changes/);
});

test('explore forces three directions apart and stops for a choice', () => {
  assert.match(explore, /No two directions may share a position on more\s+than two axes/);
  assert.match(explore, /`current`: it is always the fourth candidate/);
  assert.match(explore, /Nothing is applied to the product until the owner picks/);
  assert.match(read('skills/improve-visuals/SKILL.md'), /workflows\/explore\.md/);
});

const ROUTES = [
  ['/experience audit', 'experience'],
  ['Take this site to the next level', 'experience'],
  ['Explore three directions for the landing page', 'experience'],
  ['Show me three different design directions', 'experience'],
  // Direct requests still reach the direct skills.
  ['Improve the visuals.', 'improve-visuals'],
  ['Make this interface feel premium.', 'revamp-ui'],
  ['Add stunning hover interactions.', 'add-interactions'],
  ["Audit this website's visual quality.", 'audit-design'],
  ['Build a cinematic landing page.', 'build-animation'],
  ['Improve the user experience of the checkout API docs', null],
];
for (const [prompt, expected] of ROUTES) {
  test(`routes "${prompt}" to ${expected ?? 'no experience match'}`, () => {
    const { matches } = route(prompt, registry);
    if (expected === null) {
      // "experience" is an everyday word: on its own it must not route here. The slash command
      // itself is resolved by the agent from the skill name, not by this router.
      assert.ok(!matches.some((m) => m.name === 'experience'), JSON.stringify(matches));
      return;
    }
    assert.equal(matches[0]?.name, expected, JSON.stringify(matches));
  });
}
