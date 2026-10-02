import test from 'node:test';
import assert from 'node:assert/strict';
import { JavaScriptVM, compileVM } from '../src/vm/runtime.js';
import { runVMConformance } from './vm-cases.js';
test('VM CPU: native Number semantics and supported syntax', async () => {
  const vm = await JavaScriptVM.create({ backend: 'cpu' });
  try { const report = await runVMConformance(vm); assert.ok(report.checked > 80000); }
  finally { await vm.dispose(); }
});
test('VM resumes bounded dispatches and distinguishes undefined from pending', async () => {
  const vm = await JavaScriptVM.create({ backend: 'cpu' });
  const job = await vm.start(vm.compile('function f(x) { let i = 0; while (i < 5) { x += 0.1; i++; } return x; }'), [0]);
  try {
    const first = await job.step(1); assert.equal(first.done, false); assert.equal(first.steps[0], 1);
    let last; for (let i = 0; i < 100; i++) { last = await job.step(2); if (last.done) break; }
    assert.equal(last.done, true); assert.equal(last.values[0], 0.5);
    assert.deepEqual(await job.step(4), last);
  } finally { await job.dispose(); await vm.dispose(); }
  await assert.rejects(job.step(), /disposed/);
});
test('VM selects CPU only without a GPU and never falls back for missing features', async () => {
  const vm = await JavaScriptVM.create({ gpu: null });
  assert.equal(vm.backend, 'cpu');
  for (const code of ['function f(x) { return x.toString(); }', 'function f(x) { return [x]; }', 'function f(x) { return {x}; }'])
    assert.throws(() => vm.compile(code), /does not support/);
  await assert.rejects(JavaScriptVM.create({ backend: 'gpu', gpu: null }), /No GPU/);
  await assert.rejects(JavaScriptVM.create({ gpu: { requestAdapter() { throw new Error('adapter error'); } } }), /adapter error/);
  const infinite = vm.compile('function f(x) { while (true) { x++; } }');
  await assert.rejects(vm.run(infinite, [0], { budget: 1, maxDispatches: 2 }), /limit/);
  await assert.rejects(vm.run(infinite, [0], { signal: AbortSignal.abort() }), /abort/i);
  await vm.dispose();
});
test('VM validates provenance, primitive inputs and limits', async () => {
  const vm = await JavaScriptVM.create({ backend: 'cpu' });
  const p = compileVM('function f(x) { return x; }');
  await assert.rejects(vm.start({ ...p }, [1]), /compileVM/);
  await assert.rejects(vm.start(p, [{}]), /primitive|only/);
  await assert.rejects(vm.start(p, Array(4097)), /limit/);
  assert.equal((await vm.run(p, [])).done, true);
  const job = await vm.start(p, [true, null, undefined]);
  const result = await job.step(); assert.deepEqual(result.values, [true, null, undefined]);
  await job.dispose(); await vm.dispose();
});
test('VM runtime faults, stack bounds, and host function boundary are explicit', async () => {
  const vm = await JavaScriptVM.create({ backend: 'cpu' });
  try {
    await assert.rejects(vm.run(vm.compile('function f(x) { return f(x); }'), [0], { budget: 4096 }), /resource limit/);
    await assert.rejects(vm.run(vm.compile('function f(x) { return y; let y = 1; }'), [0]), /ReferenceError/);
    await assert.rejects(vm.run(vm.compile('function f(x) { throw x; }'), [0]), /Uncaught/);
    await assert.rejects(vm.run(vm.compile('function f(x) { return () => x; }'), [0]), /host boundary/);
    await assert.rejects(vm.run(vm.compile('function f(x) { return x; }'), ['a'.repeat(257)]), /string limit/);
    await assert.rejects(vm.run(vm.compile('function f(x) { return x + x; }'), ['a'.repeat(129)]), /resource limit/);
    await assert.rejects(vm.run(vm.compile('function f(x) { return x + 1; }'), ['2']), /does not support/);
    await assert.rejects(vm.run(vm.compile('function f(x) { try { x(); } catch (e) { return e; } }'), [0]), /host boundary/);
    assert.throws(() => vm.compile('function f(x) { return arguments; }'), /does not support/);
  } finally { await vm.dispose(); }
});
