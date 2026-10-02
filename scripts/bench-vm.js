import { mkdir, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import assert from 'node:assert/strict';
import { JavaScriptVM } from '../src/vm/runtime.js';
import { openDevice } from './device.js';
function workload(x) { for (let i = 0; i < 32; i++) { x = x * 1.0001 + 0.01; } return x; }
const median = samples => samples.toSorted((a, b) => a - b)[Math.floor(samples.length / 2)];
const context = await openDevice(), vm = await JavaScriptVM.create({ device: context.device });
try {
  const report = { date: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model,
    adapter: Object.fromEntries(['vendor', 'device', 'description', 'isFallbackAdapter'].map(k => [k, context.adapter.info[k]])),
    methodology: 'Single 32-iteration Number workload, 5 warm samples. GPU includes allocations, transfers, software binary64 VM, state readback between 256-instruction dispatches and cleanup. Not a production workload or a speedup claim.', rows: [] };
  const program = vm.compile(workload);
  for (const count of [1, 64, 1024]) {
    const inputs = Array.from({ length: count }, (_, i) => i / 10 - 5);
    const expected = inputs.map(workload);
    for (let i = 0; i < 20; i++) inputs.map(workload);
    const start = performance.now(); assert.deepEqual((await vm.run(program, inputs)).values, expected);
    const firstGpuMs = performance.now() - start, cpu = [], gpu = [];
    for (let i = 0; i < 5; i++) {
      let t = performance.now(); const reference = inputs.map(workload); cpu.push(performance.now() - t); assert.deepEqual(reference, expected);
      t = performance.now(); const result = await vm.run(program, inputs); gpu.push(performance.now() - t); assert.deepEqual(result.values, expected);
    }
    report.rows.push({ count, firstGpuMs, nativeMs: median(cpu), gpuMs: median(gpu), nativeSamples: cpu, gpuSamples: gpu });
  }
  await mkdir('results', { recursive: true }); await writeFile('results/vm-benchmark.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await vm.dispose(); context.device.destroy(); }
