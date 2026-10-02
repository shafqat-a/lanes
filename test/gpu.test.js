import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, runCPU, createGPU, STATUS } from '../src/index.js';
import { openDevice } from '../scripts/device.js';
import { cases, inputs } from './cases.js';

test('WebGPU executes all fixtures, partial workgroups, and failure statuses', async t => {
  const context = await openDevice();
  console.log('Adapter:', context.adapter.info);
  try {
    const runtime = await createGPU(context.device);
    for (const [name, source, oracle] of cases) await t.test(name, async () => {
      const program = compile(source, { numericMode: 'i32' });
      const result = await runtime.run(program, inputs);
      assert.deepEqual(result, runCPU(program, inputs));
      assert.deepEqual(result.values, inputs.map(oracle));
      assert.ok(result.statuses.every(s => s === STATUS.DONE));
    });
    const infinite = compile('function f(x) { while (1) {} return x; }', { numericMode: 'i32' });
    assert.deepEqual(await runtime.run(infinite, inputs, { budget: 20 }), runCPU(infinite, inputs, { budget: 20 }));
    const absent = compile('function f(x) {}', { numericMode: 'i32' });
    assert.deepEqual(await runtime.run(absent, inputs), runCPU(absent, inputs));
    assert.deepEqual(await runtime.run(absent, new Int32Array()), runCPU(absent, new Int32Array()));
  } finally { context.device.destroy(); }
});
