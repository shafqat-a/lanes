import { Worker } from 'node:worker_threads';
import { availableParallelism, cpus } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Lanes, COMPILER_VERSION } from '../src/index.js';
import { openDevice } from './device.js';
import { workloads } from './workloads.js';
const median = xs => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)];
const workers = Array.from({ length: Math.min(4, availableParallelism()) }, () => new Worker(new URL('./bench-worker.js', import.meta.url)));
async function workerRun(name, inputs) {
  const width = Math.ceil(inputs.length / workers.length);
  const parts = await Promise.all(workers.map((worker, index) => new Promise((resolve, reject) => {
    const input = inputs.slice(index * width, Math.min(inputs.length, (index + 1) * width));
    const onError = error => { worker.off('message', onMessage); reject(error); };
    const onMessage = ({ output, error }) => { worker.off('error', onError); error ? reject(new Error(error)) : resolve(output); };
    worker.once('error', onError); worker.once('message', onMessage); worker.postMessage({ name, input }, [input.buffer]);
  })));
  const output = new Int32Array(inputs.length); parts.forEach((part, i) => output.set(part, i * width)); return output;
}
async function timed(run, expected, repetitions = 5) {
  const samples = [];
  for (let i = 0; i < repetitions; i++) {
    const start = performance.now(); const output = await run(); samples.push(performance.now() - start);
    assert.deepEqual(output, expected);
  }
  return { medianMs: median(samples), samples };
}
let context, lanes;
try {
  context = await openDevice(); lanes = await Lanes.create({ backend: 'gpu', device: context.device });
  const info = context.adapter.info;
  const adapter = Object.fromEntries(['vendor', 'architecture', 'device', 'description', 'isFallbackAdapter'].map(k => [k, info[k]]));
  console.log('Adapter:', adapter);
  const rows = [];
  const report = { compiler: COMPILER_VERSION, date: new Date().toISOString(), node: process.version, adapter,
    cpu: cpus()[0]?.model, workerCount: workers.length, rows,
    methodology: [
      'Three numeric workload models, not production application traces; wrapping i32 semantics.',
      'Native and persistent workers warmed before sampling. Worker totals include copies, messaging and output assembly.',
      'GPU cold call includes pipeline compilation if not cached. Later sizes reuse the same workload pipeline.',
      'warmGpu includes fresh batch allocations, input upload, dispatch, readback, decoding and cleanup.',
      'residentDispatch includes submission and queue completion; inputs are resident and readback is outside timing.',
      'Five samples per warm path; all returned outputs checked against independent native JS.',
      'Fixed order, one host, uncontrolled clocks/power, no automatic performance routing implied.'
    ] };
  await mkdir('results', { recursive: true });
  const path = `results/jit-${adapter.vendor}.json`;
  for (const workload of workloads) {
    const start = performance.now(); const kernel = lanes.compile(workload.source, { numericMode: 'i32' });
    const sourceCompileMs = performance.now() - start;
    for (const size of [1024, 16384, 65536]) {
      const inputs = Int32Array.from({ length: size }, (_, i) => Math.imul(i + 1, 1664525));
      const expected = inputs.map(workload.native);
      for (let i = 0; i < 20; i++) inputs.map(workload.native);
      for (let i = 0; i < 3; i++) assert.deepEqual(await workerRun(workload.name, inputs), expected);
      const native = await timed(() => inputs.map(workload.native), expected);
      const worker = await timed(() => workerRun(workload.name, inputs), expected);
      const before = lanes.diagnostics.pipelineCompilations;
      const cold = await timed(() => kernel.run(inputs), expected, 1);
      const compiledPipeline = lanes.diagnostics.pipelineCompilations !== before;
      const warmGpu = await timed(() => kernel.run(inputs), expected);
      const batch = await lanes.batch(inputs), resident = [];
      try {
        for (let i = 0; i < 5; i++) {
          await batch.upload(inputs); await context.device.queue.onSubmittedWorkDone();
          const start = performance.now(); await batch.run(kernel); await context.device.queue.onSubmittedWorkDone();
          resident.push(performance.now() - start); assert.deepEqual(await batch.read(), expected);
        }
      } finally { await batch.dispose(); }
      const row = { workload: workload.name, size, sourceCompileMs, compiledPipeline, native, worker,
        firstGpu: cold, warmGpu, residentDispatch: { medianMs: median(resident), samples: resident },
        nativeSpeedup: native.medianMs / warmGpu.medianMs, workerSpeedup: worker.medianMs / warmGpu.medianMs,
        bufferBytesPerBatch: size * 12 };
      rows.push(row);
      console.log(JSON.stringify({ workload: row.workload, size, nativeMs: native.medianMs, workerMs: worker.medianMs,
        gpuMs: warmGpu.medianMs, speedup: row.nativeSpeedup }));
      await writeFile(path, JSON.stringify(report, null, 2) + '\n');
    }
  }
  console.log('Saved', path);
} finally {
  await lanes?.dispose(); context?.device.destroy();
  await Promise.all(workers.map(w => w.terminate()));
}
