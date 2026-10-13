import path from 'node:path';
import { SOURCE_IDS } from './adapters/index.mjs';
import { readJson, stateDir, writeJson } from './util.mjs';

const file = () => path.join(stateDir(), 'consent.json');

/** Every source and model use starts disabled; only an explicit `hl consent` call changes that. */
export function loadConsent() {
  const c = readJson(file(), {});
  return {
    sources: c.sources || {},
    model: c.model || { allowed: false, maxDigestTokens: 0 },
    redactTerms: c.redactTerms || [],
    history: c.history || [],
  };
}

export function enabledSources(c = loadConsent()) {
  return SOURCE_IDS.filter((id) => c.sources[id]?.enabled);
}

export function updateConsent({ enable = [], disable = [], model, budget, redact = [] }) {
  const c = loadConsent();
  const at = new Date().toISOString();
  const unknown = [...enable, ...disable].filter((s) => !SOURCE_IDS.includes(s));
  if (unknown.length) throw new Error(`unknown source(s): ${unknown.join(', ')}; known: ${SOURCE_IDS.join(', ')}`);
  for (const s of enable) c.sources[s] = { enabled: true, at };
  for (const s of disable) c.sources[s] = { enabled: false, at };
  if (model === 'allow') c.model = { allowed: true, maxDigestTokens: Number(budget) || c.model.maxDigestTokens || 60000, at };
  else if (model === 'deny') c.model = { allowed: false, maxDigestTokens: 0, at };
  else if (budget !== undefined) c.model.maxDigestTokens = Number(budget);
  c.redactTerms = [...new Set([...c.redactTerms, ...redact])];
  c.history.push({ at, enable, disable, model: model || null, budget: budget ?? null, redactTerms: redact.length });
  writeJson(file(), c);
  return c;
}
