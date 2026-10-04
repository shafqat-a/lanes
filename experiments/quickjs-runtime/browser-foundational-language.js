import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { foundationalLanguageCases } from './foundational-language-cases.js';

const status = document.getElementById('status');
let vm;
try {
  const compiler = await createCompiler();
  vm = await QuickJSGPU.create();
  const records = [], counts = { passed: 0, failed: 0, unsupported: 0, resourceLimited: 0 };
  for (const fixture of foundationalLanguageCases) {
    const { feature, area, source, input, expected } = fixture;
    let stage = 'compile';
    try {
      const program = compiler.compile(source);
      stage = 'runtime';
      const result = await vm.run(program, [input], { budget: 4096, maxDispatches: 1024 });
      if (result.backend !== 'gpu' || !Object.is(result.values[0], expected)) {
        throw new Error(`GPU ${String(result.values[0])}; fixed expectation ${String(expected)}`);
      }
      counts.passed++;
      records.push({ feature, area, status: 'passed', source, input, expected });
    } catch (error) {
      const outcome = /^Unsupported /.test(error.message) ? 'unsupported'
        : /^(Resource limit|GPU string limit|Execution limit)/.test(error.message) ? 'resourceLimited' : 'failed';
      counts[outcome]++;
      records.push({ feature, area, status: outcome, stage, source, input, expected, error: error.message });
    }
    status.textContent = `Checked ${records.length}/${foundationalLanguageCases.length} foundational programs`;
  }
  window.quickjsReport = { backend: 'gpu', diagnostic: true, counts, records,
    oracle: 'Fixed ES2025 expectations; separate host checker validates fixtures. Unsupported/resource outcomes are not passes.' };
  document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
} catch (error) {
  window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`;
} finally { if (vm) await vm.dispose(); }
