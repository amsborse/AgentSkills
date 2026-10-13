import { claude } from './claude.mjs';
import { codex } from './codex.mjs';
import { cursorIde, cursorTranscripts } from './cursor.mjs';
import { opencode } from './opencode.mjs';
import { antigravity } from './antigravity.mjs';
import { kiro, qwen } from './minor.mjs';

/** Order matters for duplicates: when two stores hold the same conversation, the earlier one is primary. */
export const ADAPTERS = [claude, codex, cursorIde, cursorTranscripts, opencode, antigravity, kiro, qwen];

/** Stable, user-facing source ids used for consent (`hl consent --enable <id>`). */
export const SOURCE_IDS = ADAPTERS.map((a) => a.id);

const SOURCE_TO_ID = { 'cursor:ide': 'cursor-ide', 'cursor:agent-transcripts': 'cursor-transcripts' };
export const sourceIdOf = (source) => SOURCE_TO_ID[source] || source.split(':')[0];

export const adapterFor = (source) => ADAPTERS.find((a) => a.id === sourceIdOf(source));
