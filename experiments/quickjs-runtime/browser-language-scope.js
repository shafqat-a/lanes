import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { languageScopeCases } from './language-scope-cases.js';
import { globalConstantCases } from './global-constant-cases.js';

const status = document.getElementById('status');
const probes = [...languageScopeCases, ...globalConstantCases];
try {
  const compiler = await createCompiler(), vm = await QuickJSGPU.create();
  const records = [], counts = { passed: 0, failed: 0, unsupported: 0 };
  try {
    for (const { feature, source, input, expected } of probes) {
      let stage = 'compile';
      try {
        const program = compiler.compile(source); stage = 'runtime';
        const result = await vm.run(program, [input], { budget: 4096 });
        if (result.backend !== 'gpu') throw new Error('GPU required');
        if (!Object.is(result.values[0], expected)) throw new Error(`actual=${String(result.values[0])}; expected=${String(expected)}`);
        counts.passed++; records.push({ feature, source, status: 'passed' });
      } catch (error) {
        const outcome = /Unsupported|Resource limit/.test(error.message) ? 'unsupported' : 'failed';
        counts[outcome]++; records.push({ feature, source, status: outcome, stage, error: error.message });
      }
      status.textContent = `Checked ${records.length}/${probes.length} language probes`;
    }
    window.quickjsReport = { backend: 'gpu', diagnostic: true, counts, records };
  } finally { await vm.dispose(); }
} catch (error) { window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`; }
