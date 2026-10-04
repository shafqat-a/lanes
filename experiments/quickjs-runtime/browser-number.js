import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { numberCases } from './number-cases.js';

const status = document.getElementById('status');
try {
  const compiler = await createCompiler(), vm = await QuickJSGPU.create();
  const program = compiler.compile('function f(value) { return Number(value); }');
  const cases = numberCases(128), batches = [];
  try {
    for (let offset = 0; offset < cases.length; offset += 16) {
      const inputs = cases.slice(offset, offset + 16);
      const result = await vm.run(program, inputs, { budget: 4096 });
      for (let i = 0; i < inputs.length; i++) {
        const expected = Number(inputs[i]);
        if (!Object.is(result.values[i], expected)) throw new Error(`Number mismatch for ${JSON.stringify(inputs[i])}: GPU ${result.values[i]}, native ${expected}`);
      }
      if (result.backend !== 'gpu') throw new Error('GPU execution required');
      batches.push({ inputs, checked: inputs.length, maxSteps: Math.max(...result.steps), collections: Math.max(...result.collections) });
      status.textContent = `Passed ${offset + inputs.length}/${cases.length} numeric conversions on GPU`;
    }
    window.quickjsReport = { backend: 'gpu', compiler: 'QuickJS/Wasm', checked: cases.length, randomCases: 128,
      method: 'Exact Object.is comparison against native Number, including signed zero, NaN, boundary cases and deterministic randomized decimals.', batches };
    status.textContent = 'Passed';
    document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
  } finally { await vm.dispose(); }
} catch (error) {
  window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`;
  status.textContent = 'Failed';
}
