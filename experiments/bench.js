import { source, native } from './workload.js';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { compile, createGPU } from '../src/index.js';
import { interpreterShader } from '../src/gpu.js';
import { openDevice } from '../scripts/device.js';
import { directWGSL } from './direct.js';
import { prepare } from './runner.js';

const median = xs => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)];
function check(result, expected) {
  assert.deepEqual(result.values, expected);
  assert.ok(result.statuses.every(s => s === 1));
}
async function sample(prepared, expected) {
  check(await prepared.run(), expected);
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const result = await prepared.run(); check(result, expected);
    const { values, statuses, ...timing } = result; samples.push(timing);
  }
  const uploaded = [];
  for (let i = 0; i < 5; i++) {
    const result = await prepared.run({ upload: true }); check(result, expected);
    uploaded.push(result.totalMs);
  }
  // Same resident inputs, repeated dispatches; not sequential simulation steps.
  const resident = [];
  for (let i = 0; i < 5; i++) {
    const result = await prepared.run({ repeats: 4, readback: false });
    resident.push({ wallPerDispatchMs: result.dispatchWallMs / 4,
      gpuPerDispatchMs: result.gpuMs === null ? null : result.gpuMs / 4 });
  }
  check(await prepared.run(), expected);
  return { pipelineMs: prepared.pipelineMs, uploadMs: prepared.uploadMs,
    medians: Object.fromEntries(['dispatchWallMs', 'readbackMs', 'totalMs', 'gpuMs'].map(k => [k,
      samples[0][k] === null ? null : median(samples.map(s => s[k]))])),
    residentWallPerDispatchMs: median(resident.map(s => s.wallPerDispatchMs)),
    residentGpuPerDispatchMs: resident[0].gpuPerDispatchMs === null ? null : median(resident.map(s => s.gpuPerDispatchMs)),
    uploadedTotalMs: median(uploaded), uploadedSamples: uploaded, samples, resident };
}
const context = await openDevice({ timestamps: true });
try {
  const info = context.adapter.info;
  const adapter = Object.fromEntries(['vendor', 'architecture', 'device', 'description', 'isFallbackAdapter']
    .map(key => [key, info[key] ?? null]));
  console.log('Adapter:', adapter, 'timestamp-query:', context.device.features.has('timestamp-query'));
  const baseline = await createGPU(context.device);
  const rows = [];
  for (const ticks of [32, 256]) for (const size of [1024, 16384, 65536]) {
    const js = source(ticks), program = compile(js, { numericMode: 'i32' });
    const inputs = Int32Array.from({ length: size }, (_, i) => i + 1);
    const oracle = x => native(x, ticks), expected = inputs.map(oracle);
    for (let i = 0; i < 20; i++) inputs.map(oracle);
    const nativeSamples = [];
    for (let i = 0; i < 9; i++) {
      const start = performance.now(); const values = inputs.map(oracle);
      nativeSamples.push(performance.now() - start); assert.deepEqual(values, expected);
    }
    const fresh = [];
    check(await baseline.run(program, inputs, { budget: 1000000 }), expected);
    for (let i = 0; i < 3; i++) {
      const start = performance.now(); const result = await baseline.run(program, inputs, { budget: 1000000 });
      fresh.push(performance.now() - start); check(result, expected);
    }
    const interpreter = await prepare(context.device, interpreterShader, inputs, program);
    let interpreterResult;
    try { interpreterResult = await sample(interpreter, expected); } finally { interpreter.dispose(); }
    const direct = await prepare(context.device, directWGSL(js), inputs);
    let directResult;
    try { directResult = await sample(direct, expected); } finally { direct.dispose(); }
    const row = { size, ticks, nativeMs: median(nativeSamples), nativeSamples,
      freshInterpreterMs: median(fresh), freshSamples: fresh, interpreter: interpreterResult, direct: directResult };
    rows.push(row);
    console.log(JSON.stringify({ size, ticks, nativeMs: row.nativeMs, freshInterpreterMs: row.freshInterpreterMs,
      interpreterGpuMs: interpreterResult.medians.gpuMs, interpreterWallMs: interpreterResult.medians.totalMs,
      directGpuMs: directResult.medians.gpuMs, directWallMs: directResult.medians.totalMs,
      directResidentMs: directResult.residentWallPerDispatchMs, directWithUploadMs: directResult.uploadedTotalMs }));
  }
  const report = { date: new Date().toISOString(), node: process.version, adapter,
    predicateAssignments: true, timestampQuery: context.device.features.has('timestamp-query'), rows,
    methodology: [
      'Same synthetic signed-i32 workload and outputs checked against native JS on every readback.',
      'Fresh interpreter: original API with allocation, upload, execution, readback and cleanup.',
      'Prepared paths: preallocated buffers and resident bytecode/inputs; upload and pipeline setup reported separately.',
      'uploadedTotalMs includes a fresh input upload each run with reused allocations and pipeline.',
      'Zero GPU timestamps are below effective timer resolution, not zero execution cost.',
      'GPU timestamps bracket the compute pass only. Wall dispatch includes encoding, submit and queue completion.',
      'Readback uses a separate submission and includes copying, mapAsync, decoding and unmap.',
      'Prepared total excludes initial upload, allocation, pipeline creation and timestamp extraction.',
      'Resident measures four identical dispatches per submission, without output readback; not chained simulation steps.',
      'Five prepared samples, three fresh samples, nine native samples; medians reported, raw samples retained.',
      'One workload family, one machine, fixed measurement order; no broad speedup claim or worker-pool baseline.'
    ] };
  await mkdir('results', { recursive: true });
  const tag = (adapter.vendor + '-' + adapter.device).replace(/[^a-z0-9-]/gi, '_');
  const path = `results/experiment-${tag}.json`;
  await writeFile(path, JSON.stringify(report, null, 2) + '\n'); console.log('Saved', path);
} finally { context.device.destroy(); }
