import os from 'node:os';

/**
 * Deterministic redaction applied before any text is stored as evidence or shown to a model.
 * Order matters: specific credential formats first, generic entropy last.
 */
const RULES = [
  ['PRIVATE_KEY', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g],
  ['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g],
  ['API_KEY', /\b(sk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|glpat-[A-Za-z0-9_-]{20,}|re_[A-Za-z0-9]{20,}|SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|npm_[A-Za-z0-9]{30,}|hf_[A-Za-z0-9]{30,})\b/g],
  ['URL_CREDENTIALS', /\b([a-z][a-z0-9+.-]*:\/\/)[^\s:@/]+:[^\s@/]+@/gi],
  ['SECRET_ASSIGNMENT', /\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|CREDENTIAL|AUTH)[A-Z0-9_]*)\s*[:=]\s*["']?[^\s"'`]{6,}/gi],
  ['BEARER', /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/g],
  ['EMAIL', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g],
  ['PHONE', /(?<![\w.])\+?\d{1,3}[\s.-]?\(?\d{3,4}\)?[\s.-]?\d{3}[\s.-]?\d{3,4}(?![\w.])/g],
  ['CARD', /\b(?:\d[ -]?){13,16}\b/g],
  ['IP', /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g],
  ['HIGH_ENTROPY', /\b(?=[A-Za-z0-9_\-+/]*\d)(?=[A-Za-z0-9_\-+/]*[A-Z])(?=[A-Za-z0-9_\-+/]*[a-z])[A-Za-z0-9_\-+/]{32,}={0,2}/g],
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function makeRedactor({ home = os.homedir(), user = os.userInfo().username, extraTerms = [] } = {}) {
  const homeRe = new RegExp(home.split(/[\\/]+/).filter(Boolean).map(escapeRe).join('[\\\\/]+'), 'gi');
  const userRe = user && user.length > 2 ? new RegExp(`\\b${escapeRe(user)}\\b`, 'gi') : null;
  const extra = extraTerms.filter(Boolean).map((t) => new RegExp(escapeRe(t), 'gi'));
  return function redact(text) {
    let out = String(text);
    const hits = {};
    const sub = (name, re, repl) => {
      out = out.replace(re, (m, ...g) => {
        hits[name] = (hits[name] || 0) + 1;
        return typeof repl === 'function' ? repl(m, ...g) : repl;
      });
    };
    for (const [name, re] of RULES) {
      if (name === 'URL_CREDENTIALS') sub(name, re, (m, scheme) => `${scheme}[REDACTED]@`);
      else if (name === 'SECRET_ASSIGNMENT') sub(name, re, (m, k) => `${k}=[REDACTED]`);
      else sub(name, re, `[${name}]`);
    }
    sub('HOME', homeRe, '~');
    if (userRe) sub('USERNAME', userRe, '[USER]');
    for (const re of extra) sub('TERM', re, '[REDACTED]');
    return { text: out, hits };
  };
}
