'use strict';

// Lightweight, zero-secret JSONL telemetry for Antigravity / Gemini defaults.
// Records feature usage, outcomes, and latency to ~/.gemini/config/telemetry/events.jsonl
// so the web dashboard can show real adoption and effectiveness data.

const fs = require('fs');
const os = require('os');
const path = require('path');

function telemetryFile() {
  const override = process.env.AGY_TELEMETRY_FILE;
  if (override) return override;
  return path.join(os.homedir(), '.gemini', 'config', 'telemetry', 'events.jsonl');
}

function recordEvent({ feature, event, outcome, detail = '', repo = '', ms = null }) {
  try {
    const file = telemetryFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      feature: String(feature || 'unknown'),
      event: String(event || ''),
      outcome: String(outcome || 'fired'),
      detail: String(detail || '').slice(0, 80),
      repo: repo ? path.basename(String(repo)) : '',
      ms: typeof ms === 'number' && Number.isFinite(ms) ? Math.round(ms) : null,
    };
    fs.appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // Telemetry must never break or slow down hooks
  }
}

module.exports = { recordEvent, telemetryFile };
