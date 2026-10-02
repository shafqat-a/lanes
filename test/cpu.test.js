import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, runCPU, STATUS } from '../src/index.js';
import { cases, inputs } from './cases.js';
const c = source => compile(source, { numericMode: 'i32' });
for (const [name, source, oracle] of cases) test(name, () => {
  const result = runCPU(c(source), inputs);
  assert.deepEqual(result.values, inputs.map(oracle));
  assert.ok(result.statuses.every(s => s === STATUS.DONE));
});
test('requires explicit semantics and rejects unsupported source', () => {
  assert.throws(() => compile('function f(x) { return x; }'), /numericMode/);
  for (const source of [
    'function f(x) { return x / 2; }', 'function f(x) { return 1.5; }',
    'function f(x) { return fetch(x); }', 'function f(x) { const y = 1; y = 2; return y; }',
    'function f(x) { { let y = 1; } return y; }',
    'function f(x) { let y = 1; { let y = 2; } return y; }',
    'function f(x) { return y; let y = 1; }',
  ]) assert.throws(() => c(source), SyntaxError);
});
test('budgets, missing return, empty input and immutable program', () => {
  const program = c('function f(x) { while (1) {} return x; }');
  assert.equal(runCPU(program, new Int32Array([0]), { budget: 20 }).statuses[0], STATUS.BUDGET);
  assert.equal(runCPU(c('function f(x) {}'), new Int32Array([0])).statuses[0], STATUS.INVALID);
  assert.equal(runCPU(program, new Int32Array()).values.length, 0);
  assert.throws(() => runCPU(program, inputs, { budget: 0 }), RangeError);
  assert.throws(() => runCPU(program, [1]), TypeError);
  assert.throws(() => runCPU({ ...program }, inputs), TypeError);
  assert.throws(() => { program.instructions[0] = 100; }, TypeError);
});
test('numeric mode exposes the Number compatibility gap', () => {
  const result = runCPU(c('function f(x) { return x + 1; }'), new Int32Array([2147483647]));
  assert.equal(result.values[0], -2147483648);
  assert.notEqual(result.values[0], 2147483647 + 1);
  assert.equal(Math.fround(16777216 + 1), 16777216);
  assert.notEqual(16777216 + 1, 16777216);
});
