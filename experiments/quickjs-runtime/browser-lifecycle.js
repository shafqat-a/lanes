import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';

const status = document.getElementById('status');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const settle = promise => promise.then(value => ({ value }), error => ({ error }));
async function bounded(promise, name, milliseconds = 15000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${name} exceeded ${milliseconds} ms`)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
const checks = [];
let device, vm, liveJob;
try {
  const started = performance.now();
  const adapter = await navigator.gpu?.requestAdapter();
  assert(adapter, 'WebGPU required; no CPU fallback');
  device = await adapter.requestDevice();
  vm = await QuickJSGPU.create({ device });
  const compiler = await createCompiler();
  const simple = compiler.compile('function f(x) { return x + 1; }');
  const endless = compiler.compile('function f(x) { while (true) { x = x + 1; } }');
  status.textContent = 'Compiling and running on GPU';
  const initial = await bounded(vm.run(simple, [1, 2, 3]), 'Initial GPU run', 180000);
  assert(initial.backend === 'gpu' && initial.done && initial.values.join(',') === '2,3,4', 'GPU baseline mismatch');
  checks.push('GPU execution and results');

  const preReason = new Error('pre-aborted lifecycle probe');
  const pre = await settle(vm.run(simple, [1], { signal: AbortSignal.abort(preReason) }));
  assert(pre.error === preReason, 'Pre-aborted run must preserve cancellation reason');
  checks.push('Pre-aborted run');

  status.textContent = 'Checking disposal and cancellation';
  liveJob = await vm.start(endless, [0]);
  const first = settle(liveJob.step(1)), queued = settle(liveJob.step(1));
  // Let the first dispatch submit, while its readback and the second dispatch
  // are still pending. Rejection handlers are attached before disposal.
  await Promise.resolve();
  await bounded(liveJob.dispose(), 'Job disposal');
  const disposed = await bounded(Promise.all([first, queued]), 'Disposed steps');
  assert(disposed.every(result => /disposed/.test(result.error?.message)), 'Disposed pending steps must reject');
  liveJob = undefined;
  checks.push('In-flight and queued steps disposed');

  const controller = new AbortController(), reason = new Error('active lifecycle cancellation');
  const canceled = settle(vm.run(endless, [0], { budget: 1, maxDispatches: 100000, signal: controller.signal }));
  const abortTimer = setTimeout(() => controller.abort(reason), 0);
  let canceledResult;
  try { canceledResult = await bounded(canceled, 'Active cancellation'); }
  finally { clearTimeout(abortTimer); }
  assert(canceledResult.error === reason, 'Active run must preserve cancellation reason');
  checks.push('Active run cancellation');

  // Reuse the same runtime to prove cancellation did not poison its pipeline.
  const recovered = await bounded(vm.run(simple, [8]), 'Run after cancellation');
  assert(recovered.backend === 'gpu' && recovered.values[0] === 9, 'Runtime unusable after cancellation');
  checks.push('Runtime usable after cancellation');
  const disposal = vm.dispose();
  assert(disposal === vm.dispose(), 'Repeated disposal must share completion');
  await bounded(disposal, 'Runtime disposal');
  vm = undefined;

  // A real submission/readback verifies that disposal retained the caller's
  // GPUDevice, without compiling a second expensive interpreter pipeline.
  const source = device.createBuffer({ size: 4, usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
  const staging = device.createBuffer({ size: 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  try {
    device.queue.writeBuffer(source, 0, new Uint32Array([0x12345678]));
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(source, 0, staging, 0, 4);
    device.queue.submit([encoder.finish()]);
    await bounded(staging.mapAsync(GPUMapMode.READ), 'Caller device readback');
    try { assert(new Uint32Array(staging.getMappedRange())[0] === 0x12345678, 'Caller device was destroyed or corrupted'); }
    finally { staging.unmap(); }
  } finally { source.destroy(); staging.destroy(); }
  checks.push('Caller-owned device retained after runtime disposal');

  window.quickjsReport = {
    backend: 'gpu', compiler: 'QuickJS/Wasm', checked: checks.length, checks,
    elapsedMs: performance.now() - started,
    method: 'Real GPU execution, cancellation, pending dispatch disposal, and independent buffer readback on caller-owned device. No CPU guest execution.',
  };
  document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
  status.textContent = 'Passed';
} catch (error) {
  window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`;
  status.textContent = 'Failed';
} finally {
  if (liveJob) await liveJob.dispose();
  if (vm) await vm.dispose();
  device?.destroy();
}
