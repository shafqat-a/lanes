import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFile, mkdir } from 'node:fs/promises';
import { compile, runCPU, createGPU, STATUS } from '../src/index.js';
import { openDevice } from './device.js';

const source = `function simulate(x) {
  let state = x;
  for (let tick = 0; tick < 32; tick++) {
    state = state ^ (state << 13);
    state = state ^ (state >> 17);
    state = state ^ (state << 5);
    if ((state & 7) === 0) { state += tick; }
  }
  return state;
}`;
function native(x) {
  let state = x;
  for (let tick = 0; tick < 32; tick++) {
    state = state ^ (state << 13);
    state = state ^ (state >> 17);
    state = state ^ (state << 5);
    if ((state & 7) === 0) state = state + tick | 0;
  }
  return state;
}
const median = values => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
async function measure(run, check) {
  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const result = await run();
    times.push(performance.now() - start);
    check(result);
  }
  return median(times);
}
const start = performance.now();
const program = compile(source, { numericMode: 'i32' });
const compileMs = performance.now() - start;
const context = await openDevice();
try {
  const start = performance.now();
  const gpu = await createGPU(context.device);
  const pipelineMs = performance.now() - start;
  const info = context.adapter.info;
  const adapter = Object.fromEntries(['vendor', 'architecture', 'device', 'description', 'isFallbackAdapter']
    .map(key => [key, info[key] ?? null]));
  console.log('Adapter:', adapter);
  console.log('Times include allocation and outputs; GPU includes upload, dispatch, readback, decoding and cleanup.');
  const rows = [];
  for (const size of [64, 1024, 16384]) {
    const inputs = Int32Array.from({ length: size }, (_, i) => i + 1);
    const expected = inputs.map(native);
    const check = result => {
      assert.deepEqual(result.values, expected);
      assert.ok(result.statuses.every(s => s === STATUS.DONE));
    };
    // Warm each path. Native JS gets additional warm-up to allow JIT optimization.
    for (let i = 0; i < 20; i++) inputs.map(native);
    check(runCPU(program, inputs)); check(await gpu.run(program, inputs));
    const nativeMs = await measure(() => inputs.map(native), result => assert.deepEqual(result, expected));
    const cpuInterpreterMs = await measure(() => runCPU(program, inputs), check);
    const gpuTotalMs = await measure(() => gpu.run(program, inputs), check);
    rows.push({ size, nativeMs, cpuInterpreterMs, gpuTotalMs, speedupOverNative: nativeMs / gpuTotalMs });
  }
  console.table(rows);
  const report = { date: new Date().toISOString(), node: process.version, platform: process.platform,
    adapter, numericMode: 'i32', compileMs, pipelineMs, repetitions: 5, statistic: 'median', rows,
    caveats: ['Single synthetic workload; not a general JavaScript benchmark.',
      'GPU run includes fresh buffers and bytecode upload; pipeline creation is separate.',
      'No worker-pool or Wasm baseline yet. No kernel-only GPU timestamps.',
      'i32 arithmetic is not full ECMAScript Number semantics.'] };
  await mkdir('results', { recursive: true });
  await writeFile('results/latest.json', JSON.stringify(report, null, 2) + '\n');
} finally { context.device.destroy(); }
