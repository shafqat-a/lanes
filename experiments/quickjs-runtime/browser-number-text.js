import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { numberTextCases } from './number-text-cases.js';
const status = document.getElementById('status');
try {
  const query = new URLSearchParams(location.search);
  const option = (name, fallback, min, max) => {
    const value = query.has(name) ? Number(query.get(name)) : fallback;
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`Invalid ${name}`);
    return value;
  };
  const randomCount = option('random', 16, 0, 10000);
  const batchSize = option('batch', 8, 1, 32);
  const budget = option('budget', 4096, 1, 4096);
  const compiler = await createCompiler(), vm = await QuickJSGPU.create();
  const program = compiler.compile('function f(value) { return value + ""; }');
  const cases = numberTextCases(randomCount), batches = [];
  const started = performance.now();
  try {
    for (let offset = 0; offset < cases.length; offset += batchSize) {
      const inputs = cases.slice(offset, offset + batchSize);
      status.textContent = `Checking ${offset + 1}–${offset + inputs.length}/${cases.length} numeric formatting cases on GPU`;
      let result;
      try { result = await vm.run(program, inputs, { budget, maxDispatches: Math.ceil(40960000 / budget) }); }
      catch (error) { throw new Error(`Cases ${offset}–${offset + inputs.length - 1} (${inputs.map(String).join(', ')}): ${error.message}`); }
      for (let i = 0; i < inputs.length; i++) {
        if (result.values[i] !== String(inputs[i])) throw new Error(`Formatting mismatch for ${inputs[i]}: GPU ${result.values[i]}`);
      }
      if (result.backend !== 'gpu') throw new Error('GPU execution required');
      batches.push({ inputs: inputs.map(String), values: result.values, checked: inputs.length,
        maxSteps: Math.max(...result.steps), collections: Math.max(...result.collections) });
      status.textContent = `Passed ${offset + inputs.length}/${cases.length} numeric formatting cases on GPU`;
    }
    window.quickjsReport = { backend: 'gpu', compiler: 'QuickJS/Wasm', checked: cases.length, randomCases: randomCount, fixedCases: cases.length - randomCount, batchSize, budget, elapsedMs: performance.now() - started,
      method: 'Exact string equality against native Number formatting; signed decimal-boundary neighbors, subnormals, nearest/carry cases and deterministic random binary64 patterns. Native conversion is only the test oracle; guest conversion runs on GPU.', batches };
    status.textContent = 'Passed';
    document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
  } finally { await vm.dispose(); }
} catch (error) {
  window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`;
  status.textContent = 'Failed';
}
