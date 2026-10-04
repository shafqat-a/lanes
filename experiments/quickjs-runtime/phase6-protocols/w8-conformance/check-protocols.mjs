// Admission check only. Compiles fixture sources with the native compiler.
// Does not execute guest code and does not treat a throws outcome as unsupported.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { protocolCases } from './cases.js';

const KNOWN_GAPS = Object.freeze([
  'gap-symbol-match',
  'gap-symbol-species',
]);
const PREFIXES = Object.freeze(['prim', 'iter', 'close', 'arr', 'str', 'spread', 'inst', 'name']);

const cases = protocolCases();
const ids = cases.map(item => item.id);
assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids}`);

for (const prefix of PREFIXES) {
  const hits = cases.filter(item => item.id === prefix || item.id.startsWith(`${prefix}-`));
  assert.ok(hits.length > 0, `missing id prefix ${prefix}`);
  assert.ok(hits.some(item => item.outcome !== 'unsupported'), `${prefix} is only marked unsupported`);
}

for (const item of cases) {
  assert.equal(typeof item.id, 'string', item.id);
  assert.ok(item.source.startsWith('function f'), `${item.id} source`);
  assert.ok(item.outcome === 'value' || item.outcome === 'throws' || item.outcome === 'unsupported', item.id);
  assert.ok(typeof item.expected === 'string' || typeof item.expected === 'number', `${item.id} expected`);
  assert.ok(!(item.outcome === 'throws' && KNOWN_GAPS.includes(item.id)), `${item.id} throw treated as unsupported`);
}

const unsupported = cases.filter(item => item.outcome === 'unsupported').map(item => item.id).sort();
assert.deepEqual(unsupported, [...KNOWN_GAPS].sort(), `unsupported ids must be the known gaps only: ${unsupported}`);
assert.ok(cases.some(item => item.outcome === 'throws'), 'expected at least one throws outcome');
assert.ok(cases.filter(item => item.outcome === 'throws').every(item => item.outcome !== 'unsupported'));

const compilerPath = fileURLToPath(new URL('../../generated/compiler', import.meta.url));
if (!existsSync(compilerPath)) {
  console.log(`SKIP execution: native compiler not found at ${compilerPath}`);
  console.log(JSON.stringify({ static: true, cases: cases.length, ids: ids.length, prefixes: PREFIXES, unsupported, compiler: false }));
} else {
  const compiled = [];
  for (const item of cases) {
    const raw = JSON.parse(execFileSync(compilerPath, [item.source], { encoding: 'utf8', maxBuffer: 1 << 26 }));
    const error = raw.error || '';
    assert.equal(/SyntaxError/.test(error), false, `${item.id} SyntaxError: ${error}`);
    if (item.outcome === 'value' || item.outcome === 'throws') {
      assert.equal(error, '', `${item.id} must be admitted, compiler error: ${error}`);
      assert.ok(Array.isArray(raw.functions) && raw.functions.length > 0, `${item.id} produced no functions`);
    }
    compiled.push({ id: item.id, outcome: item.outcome, admitted: error === '' });
  }
  console.log(JSON.stringify({
    static: true,
    compiler: compilerPath,
    cases: cases.length,
    admitted: compiled.filter(item => item.admitted).length,
    unsupported,
    prefixes: PREFIXES,
    throwOutcomes: cases.filter(item => item.outcome === 'throws').map(item => item.id),
  }, null, 1));
}
