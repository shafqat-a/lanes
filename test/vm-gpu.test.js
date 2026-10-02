import test from 'node:test';
import assert from 'node:assert/strict';
import { JavaScriptVM } from '../src/vm/runtime.js';
import { openDevice } from '../scripts/device.js';
import { runVMConformance } from './vm-cases.js';
test('GPU VM: software binary64 and primitive conformance', async () => {
  const context = await openDevice();
  const vm = await JavaScriptVM.create({ device: context.device });
  try {
    console.log('VM adapter:', context.adapter.info.device);
    console.log(await runVMConformance(vm));
    await assert.rejects(vm.run(vm.compile('function f(x) { return f(x); }'), [0], { budget: 4096 }), /resource limit/);
    await assert.rejects(vm.run(vm.compile('function f(x) { return y; let y = 1; }'), [0]), /ReferenceError/);
    await assert.rejects(vm.run(vm.compile('function f(x) { throw x; }'), [0]), /Uncaught/);
    await assert.rejects(vm.run(vm.compile('function f(x) { return () => x; }'), [0]), /host boundary/);
    await assert.rejects(vm.run(vm.compile('function f(x) { return x; }'), ['a'.repeat(257)]), /string limit/);
    await assert.rejects(vm.run(vm.compile('function f(x) { return x + x; }'), ['a'.repeat(129)]), /resource limit/);
    await assert.rejects(vm.run(vm.compile('function f(x) { return x + 1; }'), ['2']), /does not support/);
    await assert.rejects(vm.run(vm.compile('function f(x) { try { x(); } catch (e) { return e; } }'), [0]), /host boundary/);
    const programs = [vm.compile('function f(x) { return x + 0.1; }'), vm.compile('function f(x) { return x * 1.5; }')];
    const parallel = await Promise.all(programs.map(p => vm.run(p, [1, -0, true])));
    assert.deepEqual(parallel[0].values, [1.1, 0.1, 1.1]);
    assert.deepEqual(parallel[1].values, [1.5, -0, 1.5]);
    const p = vm.compile('function f(x) { let i = 0; while (i < 11) { x += 0.25; i++; } return x; }');
    const job = await vm.start(p, [0, 1, -0]);
    try {
      assert.equal((await job.step(1)).done, false);
      let result; for (let i = 0; i < 100; i++) { result = await job.step(3); if (result.done) break; }
      assert.deepEqual(result.values, [2.75, 3.75, 2.75]);
      assert.equal(result.done, true);
    } finally { await job.dispose(); }
    assert.throws(() => vm.compile('function f(x) { return [x]; }'), /does not support/);
    context.device.destroy(); await context.device.lost;
    await assert.rejects(vm.run(p, [0]), /lost/); assert.equal(vm.backend, 'gpu');
  } finally { await vm.dispose(); context.device.destroy(); }
});
