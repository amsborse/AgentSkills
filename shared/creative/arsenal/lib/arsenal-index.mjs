// Index an Arsenal checkout so a skill can ask "do we already have this?" before building.
// Sources, cheapest first: package manifests, each package's public exports (with the doc
// comment above them), UI catalog entries, and package READMEs. No dependencies, no network.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Where Arsenal lives: --root, then ARSENAL_DIR, then a ~/arsenal link. Null when none exist. */
export function resolveArsenalRoot({ root, env = process.env, home = os.homedir() } = {}) {
  const candidates = [root, env.ARSENAL_DIR, path.join(home, 'arsenal'), path.join(home, 'Arsenal')];
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, 'packages'))) return path.resolve(dir);
  }
  return null;
}

const read = (file) => {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
};

/** The JSDoc or line comments directly above `lineIndex`, flattened to one sentence. */
function commentAbove(lines, lineIndex) {
  const out = [];
  for (let i = lineIndex - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line) break;
    if (/^(\/\*\*|\*\/|\*|\/\/)/.test(line)) {
      out.unshift(line.replace(/^(\/\*\*|\*\/|\*|\/\/)\s?/, '').replace(/\*\/$/, ''));
    } else break;
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

const DECL =
  /^export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(function\*?|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/;
const LIST = /^export\s+(type\s+)?\{([^}]*)\}\s*(?:from\s+['"]([^'"]+)['"])?/;
const STAR = /^export\s+\*\s+from\s+['"]([^'"]+)['"]/;

/** Named exports of a TS/JS entry file, including `export { a, b } from` lists. */
export function parseExports(text) {
  const lines = text.split('\n');
  const found = [];
  lines.forEach((line, index) => {
    const doc = () => commentAbove(lines, index);
    const decl = line.match(DECL);
    if (decl) {
      found.push({ name: decl[2], kind: decl[1].replace('*', ''), line: index + 1, doc: doc() });
      return;
    }
    const list = line.match(LIST);
    if (list) {
      for (const part of list[2].split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop();
        const isType = Boolean(list[1]) || /^\s*type\s/.test(part);
        if (name) {
          found.push({ name, kind: isType ? 'type' : 'reexport', line: index + 1, doc: doc(), from: list[3] });
        }
      }
      return;
    }
    const star = line.match(STAR);
    if (star) found.push({ name: '*', kind: 'star', line: index + 1, doc: doc(), from: star[1] });
  });
  return found;
}

/** `{ id: '…', name: '…', description: '…' }` objects in a catalog source file. */
export function parseCatalogEntries(text) {
  const entries = [];
  const re =
    /id:\s*['"]([^'"]+)['"][\s\S]{0,400}?name:\s*['"]([^'"]+)['"][\s\S]{0,400}?description:\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = re.exec(text))) {
    const line = text.slice(0, match.index).split('\n').length;
    entries.push({ id: match[1], name: match[2], description: match[3].replace(/\s+/g, ' ').trim(), line });
  }
  return entries;
}

/** Walk `packages/*` and return one flat list of searchable items. */
export function buildIndex(root) {
  const items = [];
  const packagesDir = path.join(root, 'packages');
  const rel = (file) => path.relative(root, file).split(path.sep).join('/');
  for (const dir of fs.readdirSync(packagesDir).sort()) {
    const pkgDir = path.join(packagesDir, dir);
    const manifest = read(path.join(pkgDir, 'package.json'));
    if (!manifest) continue;
    let pkg;
    try {
      pkg = JSON.parse(manifest);
    } catch {
      continue;
    }
    const name = pkg.name || dir;
    items.push({
      type: 'package',
      package: name,
      name,
      summary: pkg.description || '',
      file: rel(path.join(pkgDir, 'package.json')),
      line: 1,
      keywords: (pkg.keywords || []).join(' '),
    });

    for (const entry of ['src/index.ts', 'src/index.tsx', 'src/index.js', 'index.ts']) {
      const file = path.join(pkgDir, entry);
      const text = read(file);
      if (!text) continue;
      for (const exp of parseExports(text)) {
        if (exp.kind === 'star') continue;
        items.push({
          type: 'export',
          package: name,
          name: exp.name,
          kind: exp.kind,
          summary: exp.doc,
          file: rel(file),
          line: exp.line,
          from: exp.from || '',
        });
      }
      break;
    }

    const srcDir = path.join(pkgDir, 'src');
    if (fs.existsSync(srcDir)) {
      for (const file of fs.readdirSync(srcDir).sort()) {
        if (!/catalog/i.test(file) || !/\.(ts|tsx|js)$/.test(file) || /\.test\./.test(file)) continue;
        const text = read(path.join(srcDir, file));
        if (!text) continue;
        for (const entry of parseCatalogEntries(text)) {
          items.push({
            type: 'catalog',
            package: name,
            name: entry.name,
            id: entry.id,
            summary: entry.description,
            file: rel(path.join(srcDir, file)),
            line: entry.line,
          });
        }
      }
    }

    const readme = read(path.join(pkgDir, 'README.md'));
    if (readme) {
      const lines = readme.split('\n');
      lines.forEach((line, index) => {
        const heading = line.match(/^#{2,3}\s+(.+)/);
        if (!heading) return;
        const body = lines
          .slice(index + 1, index + 6)
          .join(' ')
          .replace(/[`#*>|]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        items.push({
          type: 'readme',
          package: name,
          name: heading[1].trim(),
          summary: body.slice(0, 220),
          file: rel(path.join(pkgDir, 'README.md')),
          line: index + 1,
        });
      });
    }
  }
  return items;
}

const tokenize = (text) =>
  String(text)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);

const TYPE_BONUS = { catalog: 1.5, export: 1, package: 0.5, readme: 0 };

/**
 * Rank items for a free-text query. A name hit outweighs a summary hit, and every query word
 * must appear somewhere, so "pointer beam" does not return every pointer helper.
 */
export function search(items, query, { limit = 15 } = {}) {
  const words = tokenize(query);
  if (!words.length) return [];
  const scored = [];
  for (const item of items) {
    const name = tokenize(`${item.name} ${item.id || ''}`);
    const rest = tokenize(`${item.summary} ${item.package} ${item.keywords || ''} ${item.file}`);
    let score = 0;
    let all = true;
    for (const word of words) {
      const inName = name.some((token) => token.startsWith(word));
      const inRest = rest.some((token) => token.startsWith(word));
      if (!inName && !inRest) {
        all = false;
        break;
      }
      score += inName ? 3 : 1;
    }
    if (!all) continue;
    scored.push({ ...item, score: score + (TYPE_BONUS[item.type] ?? 0) });
  }
  return scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
}

/** How to bring an item into another project. */
export function importHint(item) {
  if (item.type === 'export' && item.kind === 'type') return `import type { ${item.name} } from "${item.package}";`;
  if (item.type === 'export') return `import { ${item.name} } from "${item.package}";`;
  return `see ${item.file}:${item.line}`;
}
