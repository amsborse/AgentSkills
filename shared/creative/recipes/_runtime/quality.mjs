// ES module entry for the quality runtime (bundlers, Node tests). The implementation is the
// classic script next to this file, so a page can also load it with a plain <script src>.
import './quality.js';

export const { TIERS, BUDGETS, createQuality, shared } = globalThis.ExperienceQuality;
