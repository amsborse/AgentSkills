/**
 * Deterministic signal detection over user-typed text. Nothing here calls a model: cues are
 * lexical, categories are keyword maps, and every decision is reproducible from the input.
 */

const CORRECTION_START = /^(no|nope|nah|wrong|stop|wait|hold on|don'?t|do not|never mind|why (did|are|is|would|do)|that'?s not|this is not|it'?s not|you (didn'?t|did not|forgot|missed|broke|should|shouldn'?t|need to)|i (said|asked|told|meant)|again|still|revert|undo|instead|actually)\b/i;
const CORRECTION_ANY = /\b(not what i (asked|wanted|meant|said)|i already (said|told|asked)|as i (said|mentioned)|you keep|keeps? (breaking|failing|happening)|still (broken|not working|failing|wrong|doesn'?t|isn'?t|the same)|doesn'?t work|didn'?t work|not working|isn'?t working|regress(ed|ion)?|you (ignored|missed|forgot|broke|skipped|removed|deleted)|stop (doing|adding|using|asking|making)|that broke|why is (it|this|there)|this is wrong|that'?s wrong|incorrect)\b/i;
const DISSATISFIED = /\b(ugly|generic|bland|cheap[- ]looking|slop|terrible|awful|horrible|clunky|janky|laggy|sluggish|bloated|overkill|over-?engineer\w*|messy|cluttered|boring|amateur\w*|tacky|not premium|looks? (bad|off|wrong|weird|broken)|feels? (off|wrong|cheap|slow)|frustrat\w*|annoying|useless|waste of)\b/i;
const PREFERENCE = /\b(i (want|prefer|like|love|hate|dislike|don'?t (like|want)|need|expect)|i'?d (rather|prefer|like)|prefer(red)?|please (always|never|don'?t|do not|make sure|avoid|use|keep)|make sure|must( not)?|should (always|never|not)|rather than|instead of|avoid|do not|don'?t ever|no more)\b/i;
const DURABLE = /\b(always|never|every time|each time|from now on|going forward|in (the )?future|by default|in general|as a rule|across (all|every)|for (all|every) (project|repo|task)|everywhere|whenever|any time|remember (to|that)|standing (rule|instruction))\b/i;
const TEMPORARY = /\b(for now|this time|just this once|temporar(y|ily)|today|tonight|right now|for this (task|pr|change|session|one|commit)|this one|at the moment|until (we|i|it)|quick(ly)? (test|hack))\b/i;
const PRAISE = /\b(perfect|exactly( right| what i)?|love (it|this|that)|looks (great|amazing|good|clean|premium)|nailed it|well done|works now|that works|this is (great|good|perfect|much better)|much better|great job)\b/i;

export const CATEGORIES = {
  'ui-visual': /\b(design|ui|ux|layout|spacing|padding|margin|typograph\w*|fonts?|colou?rs?|palette|premium|aesthetic\w*|visual\w*|css|tailwind|component|card|hero|gradient|shadow|dark mode|light mode|responsive|mobile|icons?|landing|dashboard|pixel|contrast|whitespace|look(s|ing)? like)\b/i,
  animation: /\b(animat\w*|motion|transition\w*|spring|easing|gsap|framer|smooth\w*|jank\w*|fps|scroll\w*|hover|micro-?interaction\w*)\b/i,
  performance: /\b(perf(ormance)?|fast(er)?|slow(er)?|latency|bundle size|lighthouse|memory|cpu|optimi[sz]\w*|caching|re-?render\w*|load time|lag)\b/i,
  reliability: /\b(retry|retries|crash\w*|flaky|resilien\w*|idempot\w*|timeouts?|recover\w*|robust\w*|error handling|fallback|graceful\w*|race condition|deadlock|stuck|hang(s|ing)?)\b/i,
  'security-privacy': /\b(secrets?|credentials?|api keys?|auth\w*|permissions?|privacy|private|pii|leak\w*|encrypt\w*|sandbox\w*|exfiltrat\w*|redact\w*)\b/i,
  'testing-verification': /\b(tests?|testing|verify|verif\w*|validat\w*|e2e|playwright|screenshots?|ci|coverage|prove|proof|evidence|smoke)\b/i,
  'git-workflow': /\b(commits?|pull requests?|prs?|push(ed|ing)?|merg\w*|branch\w*|rebase|worktrees?|deploy\w*|release\w*|git)\b/i,
  'cost-models': /\b(tokens?|costs?|budget\w*|cheap(er)?|expensive|opus|sonnet|haiku|gpt[-\w.]*|codex|models?|effort|reasoning|credits?|usage|rate limit\w*|billing|paid)\b/i,
  'autonomy-orchestration': /\b(sub-?agents?|agents?|parallel\w*|autonom\w*|loops?|overnight|night\w*|background|delegat\w*|orchestrat\w*|approv\w*|ask (me|for)|without asking|check in|unattended)\b/i,
  communication: /\b(summar\w*|explain\w*|concise|verbose|report\w*|update me|tell me|jargon|plain (english|language)|markdown|tables?|bullet\w*|wall of text|too long|tl;?dr)\b/i,
  'code-quality': /\b(refactor\w*|clean(er|up)?|naming|comments?|types?|typescript|lint\w*|duplicat\w*|simpl\w*|abstraction\w*|architecture|modular\w*|dead code|readab\w*|maintainab\w*)\b/i,
  'scope-discipline': /\b(scope|unrelated|overreach\w*|didn'?t ask|did not ask|unasked|only (change|touch|do)|don'?t (change|touch)|leave (it|that|the rest)|minimal (change|diff))\b/i,
  'research-accuracy': /\b(research\w*|sources?|citations?|accura\w*|hallucinat\w*|fact\w*|up[- ]to[- ]date|latest|docs|documentation)\b/i,
};

const splitStatements = (text) =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.replace(/^[\s>*\-•\d.)]+/, '').trim())
    .filter((s) => s.length >= 8 && s.length <= 500);

export function categorize(s) {
  return Object.entries(CATEGORIES)
    .filter(([, re]) => re.test(s))
    .map(([k]) => k);
}

/**
 * Splits one user turn into signal-bearing statements. Long pasted specs are kept but marked
 * `spec`, because their imperatives usually describe one task rather than a standing rule.
 */
export function analyzeTurn(text) {
  const spec = text.length > 1500;
  const statements = [];
  const all = splitStatements(text);
  all.forEach((s, i) => {
    const kinds = [];
    if ((i === 0 && CORRECTION_START.test(s)) || CORRECTION_ANY.test(s)) kinds.push('correction');
    if (DISSATISFIED.test(s)) kinds.push('dissatisfaction');
    if (PREFERENCE.test(s)) kinds.push('preference');
    if (PRAISE.test(s) && !spec) kinds.push('praise');
    const durable = DURABLE.test(s);
    if (!kinds.length && !durable) return;
    statements.push({ text: s, kinds, durable, temporary: TEMPORARY.test(s), categories: categorize(s) });
  });
  return { spec, statements: statements.slice(0, spec ? 25 : 8) };
}

const STOP = new Set('a an the to of and or but in on at for with is are was were be been it this that these those you your i me my we our they them he she do does did not no so as if then than just very really please can could would should will about into from by up out more most also too all any some there here what which who when where why how its it\'s im i\'m dont don\'t'.split(' '));

export function tokens(s) {
  return [
    ...new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s'-]/g, ' ')
        .split(/\s+/)
        .map((w) => w.replace(/^'+|'+$/g, '').replace(/(ing|ed|es|s)$/, ''))
        .filter((w) => w.length > 1 && !STOP.has(w)),
    ),
  ];
}

export const jaccard = (a, b) => {
  if (!a.length || !b.length) return 0;
  const B = new Set(b);
  let inter = 0;
  for (const x of a) if (B.has(x)) inter++;
  return inter / (a.length + b.length - inter);
};
