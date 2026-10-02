import test from 'node:test';
import assert from 'node:assert/strict';
import { Lanes } from '../src/index.js';
import { openDevice } from '../scripts/device.js';
import { jitFixtures, jitInputs } from './jit-fixtures.js';
import { source, native } from '../experiments/workload.js';

test('JIT GPU: differential fixtures, caching, resident chaining, and device loss', async t => {
  const context = await openDevice();
  console.log('JIT adapter:', context.adapter.info.device, 'fallback:', context.adapter.info.isFallbackAdapter);
  const lanes = await Lanes.create({ backend: 'auto', device: context.device });
  try {
    for (const [name, source, oracle] of jitFixtures) await t.test(name, async () => {
      const k = lanes.compile(source, { numericMode: 'i32' });
      assert.deepEqual(await k.run(jitInputs), jitInputs.map(oracle));
      assert.deepEqual(await k.run(jitInputs, { backend: 'cpu' }), jitInputs.map(oracle));
    });
    await t.test('shared compilation and concurrent batches', async () => {
      const k = lanes.compile('function concurrent(x) { return x * 37 - 4; }', { numericMode: 'i32' });
      const before = lanes.diagnostics.pipelineCompilations;
      const results = await Promise.all([k.run(jitInputs), k.run(jitInputs), k.run(jitInputs)]);
      assert.equal(lanes.diagnostics.pipelineCompilations - before, 1);
      for (const result of results) assert.deepEqual(result, jitInputs.map(x => Math.imul(x, 37) - 4 | 0));
    });
    await t.test('resident output feeds subsequent kernels and upload replaces it', async () => {
      const a = lanes.compile('function add(x) { return x + 1; }', { numericMode: 'i32' });
      const b = lanes.compile('function mul(x) { return x * 3; }', { numericMode: 'i32' });
      const batch = await lanes.batch(jitInputs);
      try {
        await Promise.all([batch.run(a), batch.run(b)]);
        assert.deepEqual(await batch.read(), jitInputs.map(x => Math.imul(x + 1 | 0, 3)));
        await batch.upload(jitInputs); await batch.run(b);
        assert.deepEqual(await batch.read(), jitInputs.map(x => Math.imul(x, 3)));
      } finally { await batch.dispose(); }
      assert.deepEqual(await a.run(new Int32Array()), new Int32Array());
    });
    await t.test('seeded arithmetic fuzz against independently emitted native JS', async () => {
      let seed = 12345;
      const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return seed >>> 0; };
      const make = depth => {
        if (!depth) { const text = random() % 2 ? 'x' : String(random() % 2147483648); return [text, text]; }
        const [a, aa] = make(depth - 1), [b, bb] = make(depth - 1);
        const op = ['+', '-', '*', '^', '&', '|', '<<', '>>'][random() % 8];
        return [`(${a} ${op} ${b})`, op === '*' ? `Math.imul(${aa}, ${bb})` : `((${aa} ${op} ${bb}) | 0)`];
      };
      for (let i = 0; i < 24; i++) {
        const [expression, reference] = make(3);
        const oracle = new Function('x', `return ${reference}`); // Test oracle only; production uses no eval.
        const k = lanes.compile(`function fuzz${i}(x) { return ${expression}; }`, { numericMode: 'i32' });
        assert.deepEqual(await k.run(jitInputs), jitInputs.map(oracle));
      }
    });
    await t.test('repeated large conditional-loop regression', async () => {
      const stress = process.env.LANES_STRESS === '1';
      const input = Int32Array.from({ length: stress ? 65536 : 4096 }, (_, i) => i + 1);
      const expected = input.map(x => native(x, 256));
      const k = lanes.compile(source(256), { numericMode: 'i32' });
      const batch = await lanes.batch(input);
      try {
        for (let trial = 0; trial < (stress ? 100 : 5); trial++) {
          await batch.upload(input); await batch.run(k);
          assert.deepEqual(await batch.read(), expected, `trial ${trial}`);
        }
      } finally { await batch.dispose(); }
    });
    await t.test('loss rejects resident reads; future auto runs use CPU', async () => {
      const k = lanes.compile('function lost(x) { return x + 2; }', { numericMode: 'i32' });
      const batch = await lanes.batch(jitInputs); await batch.run(k);
      context.device.destroy(); await context.device.lost;
      await assert.rejects(batch.read(), /lost/);
      assert.equal(lanes.backend, 'cpu');
      assert.deepEqual(await k.run(jitInputs), jitInputs.map(x => x + 2 | 0));
      await assert.rejects(k.run(jitInputs, { backend: 'gpu' }), /lost/);
      await batch.dispose();
    });
  } finally { await lanes.dispose(); context.device.destroy(); }
});
