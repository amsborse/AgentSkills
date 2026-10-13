// A deliberately small YAML subset: block maps, block lists (including lists of maps),
// flow lists/maps of scalars, quoted strings, `|`/`>` block scalars and comments.
// Policies are written in this subset so the engine needs no third-party parser.

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\' && quote === '"') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i).trimEnd();
    }
  }
  return line.trimEnd();
}

function splitFlow(body) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      cur += c;
      if (c === '\\' && quote === '"') cur += body[++i] ?? '';
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function findColon(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\' && quote === '"') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ':' && (i === text.length - 1 || text[i + 1] === ' ')) return i;
    else if (c === '[' || c === '{') return -1;
  }
  return -1;
}

export function parseScalar(raw) {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s.startsWith('"')) return JSON.parse(s);
  if (s.startsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  if (s.startsWith('[')) return splitFlow(s.slice(1, -1)).map(parseScalar);
  if (s.startsWith('{')) {
    const obj = {};
    for (const part of splitFlow(s.slice(1, -1))) {
      const i = findColon(part);
      if (i < 0) throw new Error(`Bad flow map entry: ${part}`);
      obj[parseKey(part.slice(0, i))] = parseScalar(part.slice(i + 1));
    }
    return obj;
  }
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return Number(s);
  return s;
}

function parseKey(raw) {
  const k = raw.trim();
  return k.startsWith('"') || k.startsWith("'") ? parseScalar(k) : k;
}

export function parseYaml(text) {
  const raw = text.replace(/\r\n?/g, '\n').split('\n');
  const lines = [];
  for (let n = 0; n < raw.length; n++) {
    const original = raw[n];
    const content = stripComment(original);
    if (!content.trim() || content.trim() === '---') continue;
    const indent = content.length - content.trimStart().length;
    lines.push({ indent, text: content.trim(), n, raw: original });
  }
  let pos = 0;

  function blockScalar(parentIndent, style, startLine) {
    const out = [];
    let i = startLine + 1;
    let base = null;
    for (; i < raw.length; i++) {
      const l = raw[i];
      if (!l.trim()) {
        out.push('');
        continue;
      }
      const ind = l.length - l.trimStart().length;
      if (ind <= parentIndent) break;
      base ??= ind;
      out.push(l.slice(base));
    }
    while (pos < lines.length && lines[pos].n < i) pos++;
    while (out.length && out[out.length - 1] === '') out.pop();
    return style === '|' ? `${out.join('\n')}\n` : `${out.join(' ').replace(/\s+/g, ' ').trim()}\n`;
  }

  function value(rest, indent, lineNo) {
    if (rest === '|' || rest === '>' || rest === '|-' || rest === '>-') {
      const v = blockScalar(indent, rest[0], lineNo);
      return rest.endsWith('-') ? v.replace(/\n$/, '') : v;
    }
    if (rest !== '') return parseScalar(rest);
    if (pos < lines.length && lines[pos].indent > indent) return block(lines[pos].indent);
    if (pos < lines.length && lines[pos].indent === indent && lines[pos].text.startsWith('- ')) return block(indent);
    return null;
  }

  function mapEntries(obj, indent, first) {
    const entry = (text, lineNo) => {
      const i = findColon(text);
      if (i < 0) throw new Error(`YAML line ${lineNo + 1}: expected "key: value", got "${text}"`);
      const key = parseKey(text.slice(0, i));
      obj[key] = value(text.slice(i + 1).trim(), indent, lineNo);
    };
    if (first) entry(first.text, first.n);
    while (pos < lines.length && lines[pos].indent === indent && !lines[pos].text.startsWith('- ') && lines[pos].text !== '-') {
      const l = lines[pos++];
      entry(l.text, l.n);
    }
    return obj;
  }

  function block(indent) {
    if (lines[pos].text.startsWith('- ') || lines[pos].text === '-') {
      const list = [];
      while (pos < lines.length && lines[pos].indent === indent && (lines[pos].text.startsWith('- ') || lines[pos].text === '-')) {
        const l = lines[pos++];
        const rest = l.text === '-' ? '' : l.text.slice(2).trim();
        if (rest === '') {
          list.push(pos < lines.length && lines[pos].indent > indent ? block(lines[pos].indent) : null);
        } else if (findColon(rest) > 0) {
          const itemIndent = indent + (l.text.length - rest.length);
          list.push(mapEntries({}, itemIndent, { text: rest, n: l.n }));
        } else {
          list.push(parseScalar(rest));
        }
      }
      return list;
    }
    return mapEntries({}, indent);
  }

  if (!lines.length) return {};
  return block(lines[0].indent);
}

const PLAIN_KEY = /^[A-Za-z0-9_./-]+$/;

function scalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  const s = String(v);
  if (
    s === '' ||
    /^[\s]|[\s]$/.test(s) ||
    /^(true|false|null|~|yes|no|on|off)$/i.test(s) ||
    /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s) ||
    /[:#{}[\],&*!|>'"%@`\n]/.test(s) ||
    s.startsWith('- ') ||
    s.startsWith('?')
  ) {
    return JSON.stringify(s);
  }
  return s;
}

function key(k) {
  return PLAIN_KEY.test(k) ? k : JSON.stringify(k);
}

function isScalar(v) {
  return v === null || typeof v !== 'object';
}

export function toYaml(value, indent = 0) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}[]\n`;
    let out = '';
    for (const item of value) {
      if (isScalar(item)) out += `${pad}- ${scalar(item)}\n`;
      else if (Array.isArray(item)) out += `${pad}-\n${toYaml(item, indent + 2)}`;
      else {
        const body = toYaml(item, indent + 2);
        out += `${pad}- ${body.slice(indent + 2)}`;
      }
    }
    return out;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (!entries.length) return `${pad}{}\n`;
    let out = '';
    for (const [k, v] of entries) {
      if (isScalar(v)) out += `${pad}${key(k)}: ${scalar(v)}\n`;
      else if (Array.isArray(v) && !v.length) out += `${pad}${key(k)}: []\n`;
      else if (Array.isArray(v) && v.every(isScalar) && v.join(', ').length < 70) {
        out += `${pad}${key(k)}: [${v.map(scalar).join(', ')}]\n`;
      } else if (!Array.isArray(v) && !Object.keys(v).length) out += `${pad}${key(k)}: {}\n`;
      else out += `${pad}${key(k)}:\n${toYaml(v, indent + 2)}`;
    }
    return out;
  }
  return `${pad}${scalar(value)}\n`;
}
