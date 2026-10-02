import { writeFile, mkdir } from 'node:fs/promises';
import { openDevice } from '../scripts/device.js';
import { directWGSL } from './direct.js';
import { prepare } from './runner.js';
import { source, native } from './workload.js';
const context = await openDevice({ timestamps: true });
try {
  const inputs = Int32Array.from({ length: 65536 }, (_, i) => i + 1);
  const expected = inputs.map(x => native(x, 256));
  const runtime = await prepare(context.device, directWGSL(source(256), { predicateAssignments: process.env.LANES_PREDICATE === '1' }), inputs);
  const runs = [];
  try {
    for (let trial = 0; trial < 100; trial++) {
      const result = await runtime.run();
      const mismatches = [];
      for (let i = 0; i < inputs.length; i++) if (result.values[i] !== expected[i] || result.statuses[i] !== 1)
        mismatches.push({ lane: i, input: inputs[i], actual: result.values[i], expected: expected[i], status: result.statuses[i] });
      const row = { trial, gpuMs: result.gpuMs, mismatchCount: mismatches.length, firstMismatches: mismatches.slice(0, 64) };
      runs.push(row); console.log(JSON.stringify({ trial, mismatchCount: mismatches.length, first: mismatches[0] }));
    }
  } finally { runtime.dispose(); }
  await mkdir('results', { recursive: true });
  const report = { predicateAssignments: process.env.LANES_PREDICATE === '1', adapter: context.adapter.info.device, runs };
  await writeFile(`results/direct-reproduction-${process.env.LANES_PREDICATE === '1' ? 'predicated' : 'branched'}.json`, JSON.stringify(report, null, 2)+'\n');
  if (runs.some(r => r.mismatchCount)) process.exitCode = 1;
} finally { context.device.destroy(); }
