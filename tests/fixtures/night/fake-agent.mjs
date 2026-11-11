// Deterministic stand-in for a coding agent in night tests. Never calls a model.
// Usage: node fake-agent.mjs <lane cwd> <plan> <counter file>
// <plan> is a comma list of behaviours; call i runs plan[min(i, last)].
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [cwd, planArg = 'noop', counterFile] = process.argv.slice(2);
const plan = planArg.split(',');
const n = counterFile && fs.existsSync(counterFile) ? Number(fs.readFileSync(counterFile, 'utf8')) : 0;
if (counterFile) fs.writeFileSync(counterFile, String(n + 1));
const behaviour = plan[Math.min(n, plan.length - 1)];
const result = (o) => console.log(`NIGHT_RESULT: ${JSON.stringify(o)}`);
const count = (re) => fs.readdirSync(cwd).filter((f) => re.test(f)).length;

switch (behaviour) {
  case 'js-test': {
    const k = count(/^gen\d+\.test\.js$/) + 1;
    if (k > 2) { result({ summary: 'nothing left', done: true }); break; }
    fs.writeFileSync(path.join(cwd, `gen${k}.test.js`), `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { mul } from './math.js';\ntest('mul ${k}', () => assert.equal(mul(${k}, 3), ${k * 3}));\n`);
    result({ summary: `add mul test ${k}`, hypothesis: 'mul is untested', next_hypothesis: 'cover more of math.js' });
    break;
  }
  case 'py-test': {
    const k = count(/^test_gen\d+\.py$/) + 1;
    if (k > 2) { result({ summary: 'nothing left', done: true }); break; }
    fs.writeFileSync(path.join(cwd, `test_gen${k}.py`), `import unittest\nfrom calc import mul\n\nclass T(unittest.TestCase):\n    def test_mul_${k}(self):\n        self.assertEqual(mul(${k}, 3), ${k * 3})\n`);
    result({ summary: `add mul test ${k}`, hypothesis: 'mul is untested' });
    break;
  }
  case 'fix-add': {
    const file = path.join(cwd, 'math.js');
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('a - b')) { result({ summary: 'no failing behaviour left', done: true }); break; }
    fs.writeFileSync(file, src.replace('a - b', 'a + b'));
    result({ summary: 'fix add', hypothesis: 'add subtracts instead of adding' });
    break;
  }
  case 'break': {
    const file = path.join(cwd, 'math.js');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('a * b', 'a * b + 1'));
    result({ summary: 'faster mul', hypothesis: 'mul can be simplified' });
    break;
  }
  case 'usage': {
    const k = count(/^gen\d+\.test\.js$/) + 1;
    fs.writeFileSync(path.join(cwd, `gen${k}.test.js`), `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { mul } from './math.js';\ntest('mul ${k}', () => assert.equal(mul(${k}, 2), ${k * 2}));\n`);
    console.log('NIGHT_USAGE: {"input_tokens": 600, "output_tokens": 100, "cost_usd": 0.25}');
    result({ summary: `add mul test ${k}` });
    break;
  }
  case 'hang': {
    fs.writeFileSync(path.join(cwd, 'half-done.txt'), 'partial work\n');
    console.log('working...');
    setInterval(() => console.log('still working'), 1000);
    setTimeout(() => process.exit(0), 600_000);
    break;
  }
  case 'push': {
    // Stands in for an agent that pushed: a push moves the remote-tracking ref, so move one locally.
    const k = count(/^gen\d+\.test\.js$/) + 1;
    fs.writeFileSync(path.join(cwd, `gen${k}.test.js`), `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { mul } from './math.js';\ntest('mul ${k}', () => assert.equal(mul(${k}, 3), ${k * 3}));\n`);
    execFileSync('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD'], { cwd });
    result({ summary: `add mul test ${k}` });
    break;
  }
  default:
    result({ summary: 'nothing to do', done: true });
}
