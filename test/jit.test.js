import test from 'node:test';
import assert from 'node:assert/strict';
import { Lanes, CompileError } from '../src/index.js';
import { jitFixtures, jitInputs } from './jit-fixtures.js';
import { lower, LIMITS } from '../src/jit/ir.js';

for (const [name, source, oracle] of jitFixtures) test(`JIT CPU: ${name}`, async () => {
  const lanes = await Lanes.create({ backend: 'cpu' });
  try { assert.deepEqual(await lanes.compile(source, { numericMode: 'i32' }).run(jitInputs), jitInputs.map(oracle)); }
  finally { await lanes.dispose(); }
});
test('rejects unsupported source and unsafe loop shapes with locations', () => {
  for (const source of [
    'function f(x) { return x / 2; }', 'function f(x) { return Math.imul(x, 3); }',
    'function f(x) { return x++; }', 'function f(x) { let y = 1; x += (y = 2); return x; }',
    'function f(x) { if (x) return 1; return 2; }', 'function f(x) { while (x) x--; return x; }',
    'function f(x) { let y; return y; }', 'function f(x) { const y = 1; y++; return y; }',
    'function f(x) { for(let i=0;i<x;i++) { x++; } return x; }',
    'function f(x) { for(let i=0;i<3;i++) { i++; } return x; }',
    'function f(x) { for(let i=2147483647;i<=2147483647;i++) {} return x; }',
    'function f(x) { for(let i=0;i<4097;i++) {} return x; }',
    'function f(x) { for(let i=0;i<4096;i++) { for(let j=0;j<4096;j++) { x++; } } return x; }',
    'function f(x) { let y = 1; { let y = 2; } return y; }',
    'function f(x) { { let y = 1; } return y; }',
    'function f(x) { return outside; }', 'function f(x) { return 1.5; }', 'function f(x) {}',
  ]) assert.throws(() => lower(source, { numericMode: 'i32' }), CompileError, source);
  assert.throws(() => lower(' '.repeat(LIMITS.sourceBytes + 1)), /numericMode/);
  assert.throws(() => lower(' '.repeat(LIMITS.sourceBytes + 1), { numericMode: 'i32' }), /too large/);
  try { lower('function f(x) {\n return x / 3;\n}', { numericMode: 'i32' }); assert.fail(); }
  catch (error) { assert.equal(error.line, 2); assert.ok(error.column > 0); }
});
test('frozen typed IR and deterministic compiler cache', async () => {
  const lanes = await Lanes.create({ backend: 'cpu' });
  const source = 'function f(x) { return (3 * 5) + x; }';
  const kernel = lanes.compile(source, { numericMode: 'i32' });
  assert.equal(kernel, lanes.compile(source, { numericMode: 'i32' }));
  assert.equal(kernel.ir.result.a.value, 15);
  assert.throws(() => { kernel.ir.result.a.value = 5; }, TypeError);
  assert.match(kernel.wgsl, /15u/);
  await lanes.dispose();
  await assert.rejects(kernel.run(jitInputs), /disposed/);
});
test('CPU batches chain, serialize, copy inputs and release resources', async () => {
  const lanes = await Lanes.create({ backend: 'cpu' });
  const a = lanes.compile(function add(x) { return x + 1; }, { numericMode: 'i32' });
  const b = lanes.compile(function twice(x) { return x * 2; }, { numericMode: 'i32' });
  const input = new Int32Array([1, 2]);
  const batch = await lanes.batch(input); input[0] = 99;
  const one = batch.run(a), two = batch.run(b), output = batch.read();
  await Promise.all([one, two]); assert.deepEqual(await output, new Int32Array([4, 6]));
  const next = new Int32Array([3, 4]); const upload = batch.upload(next); next[0] = 99;
  await upload; assert.deepEqual(await batch.read(), new Int32Array([3, 4]));
  assert.throws(() => batch.upload(new Int32Array([1])), /length/);
  await batch.dispose(); await assert.rejects(batch.read(), /disposed/);
  assert.deepEqual(await a.run(new Int32Array()), new Int32Array());
  const pendingBatch = await lanes.batch(2); const pending = pendingBatch.run(a);
  await lanes.dispose(); await pending;
  assert.throws(() => lanes.compile('function f(x) { return x; }', { numericMode: 'i32' }), /disposed/);
});
test('fallback is availability-based; compiler errors do not trigger fallback', async () => {
  const lanes = await Lanes.create({ backend: 'auto', gpu: { requestAdapter: async () => null } });
  assert.equal(lanes.backend, 'cpu'); assert.match(lanes.diagnostics.fallbackReason, /adapter/);
  assert.throws(() => lanes.compile('function f(x) { return external; }', { numericMode: 'i32' }), CompileError);
  await assert.rejects(lanes.batch(1, { backend: 'gpu' }), /unavailable/);
  await assert.rejects(Lanes.create({ backend: 'gpu', gpu: { requestAdapter: async () => null } }), /unavailable/);
  await assert.rejects(lanes.batch(-1), /length/);
  await lanes.dispose();
});
