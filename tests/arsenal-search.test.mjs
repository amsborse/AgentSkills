// Arsenal search: skills look up existing components before building new ones, so the index
// must find exports by their doc comments, rank names above prose, and fail loudly with no root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildIndex,
  importHint,
  parseCatalogEntries,
  parseExports,
  resolveArsenalRoot,
  search,
} from '../shared/creative/arsenal/lib/arsenal-index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'shared/creative/arsenal/search.mjs');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arsenal-'));
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  write('packages/motion/package.json', JSON.stringify({ name: '@arsenal/motion', description: 'Motion primitives' }));
  write(
    'packages/motion/src/index.ts',
    [
      '/** A drafting crosshair that follows the pointer and reads out x/y. */',
      'export function mountCrosshairCursor() {}',
      '',
      '// Strokes draw themselves in once on arrival.',
      'export { drawIn, type DrawInOptions } from "./draw-in";',
      'export * from "./springs";',
      'export type PacketRoute = { d: string };',
    ].join('\n')
  );
  write('packages/fx/package.json', JSON.stringify({ name: '@arsenal/fx', keywords: ['canvas', 'print'] }));
  write(
    'packages/fx/src/index.ts',
    '/** Procedural wood engraving: tone field cut into ribbons. */\nexport const engrave = () => [];\n'
  );
  write(
    'packages/ui/package.json',
    JSON.stringify({ name: '@arsenal/ui' })
  );
  write(
    'packages/ui/src/component-catalog.ts',
    "export const C = [\n  {\n    id: 'technical-sheet',\n    name: 'TechnicalSheet',\n    description:\n      'A topology drawn as an engineering sheet with a title block.',\n  },\n];\n"
  );
  write('packages/ui/README.md', '# UI\n\n## Halftone plate\n\nRedraws a photo as newsprint dots.\n');
  write('packages/broken/package.json', '{not json');
  return dir;
}

test('parseExports reads declarations, re-export lists with inline types, and doc comments', () => {
  const exports = parseExports(
    '/** Spring a value. */\nexport function spring() {}\nexport { a, type B, c as d } from "./x";\nexport * from "./y";'
  );
  assert.deepEqual(
    exports.map((e) => [e.name, e.kind]),
    [
      ['spring', 'function'],
      ['a', 'reexport'],
      ['B', 'type'],
      ['d', 'reexport'],
      ['*', 'star'],
    ]
  );
  assert.equal(exports[0].doc, 'Spring a value.');
});

test('parseCatalogEntries reads multi-line descriptions', () => {
  const [entry] = parseCatalogEntries("{ id: 'x', name: 'X', description:\n  'Hello there.' }");
  assert.deepEqual([entry.id, entry.name, entry.description], ['x', 'X', 'Hello there.']);
});

test('buildIndex covers manifests, exports, catalog entries and readme sections, skipping bad manifests', () => {
  const items = buildIndex(fixture());
  const kinds = new Set(items.map((item) => item.type));
  assert.deepEqual([...kinds].sort(), ['catalog', 'export', 'package', 'readme']);
  assert.ok(items.some((item) => item.type === 'catalog' && item.id === 'technical-sheet' && item.line === 3));
  assert.ok(!items.some((item) => item.package === 'broken'));
  assert.ok(!items.some((item) => item.name === '*'));
});

test('search ranks a name hit first, matches doc comments, and needs every word', () => {
  const items = buildIndex(fixture());
  assert.equal(search(items, 'crosshair')[0].name, 'mountCrosshairCursor');
  assert.equal(search(items, 'wood engraving')[0].name, 'engrave');
  assert.equal(search(items, 'technical sheet')[0].type, 'catalog');
  assert.equal(search(items, 'halftone')[0].type, 'readme');
  assert.deepEqual(search(items, 'crosshair engraving'), []);
  assert.deepEqual(search(items, '  '), []);
});

test('importHint gives a value import, a type import, or a file pointer', () => {
  const items = buildIndex(fixture());
  const find = (name) => items.find((item) => item.name === name);
  assert.equal(importHint(find('drawIn')), 'import { drawIn } from "@arsenal/motion";');
  assert.equal(importHint(find('PacketRoute')), 'import type { PacketRoute } from "@arsenal/motion";');
  assert.match(importHint(find('TechnicalSheet')), /^see packages\/ui\/src\/component-catalog.ts:3$/);
});

test('resolveArsenalRoot prefers --root, then ARSENAL_DIR, then ~/arsenal, else null', () => {
  const dir = fixture();
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  assert.equal(resolveArsenalRoot({ root: dir, env: {}, home: empty }), path.resolve(dir));
  assert.equal(resolveArsenalRoot({ env: { ARSENAL_DIR: dir }, home: empty }), path.resolve(dir));
  assert.equal(resolveArsenalRoot({ env: {}, home: empty }), null);
});

test('the CLI prints matches with import lines, and exits 2 when Arsenal is missing', () => {
  const dir = fixture();
  const ok = spawnSync(process.execPath, [cli, '--root', dir, 'crosshair'], { encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /import \{ mountCrosshairCursor \} from "@arsenal\/motion";/);
  const json = JSON.parse(spawnSync(process.execPath, [cli, '--root', dir, '--json', 'engraving'], { encoding: 'utf8' }).stdout);
  assert.equal(json.hits[0].name, 'engrave');
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const missing = spawnSync(process.execPath, [cli, 'anything'], {
    encoding: 'utf8',
    env: { ...process.env, ARSENAL_DIR: '', HOME: empty, USERPROFILE: empty },
  });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /no checkout found/);
});
