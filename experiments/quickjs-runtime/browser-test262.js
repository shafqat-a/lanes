import { classifyTest262Outcome } from './test262-outcome.js';
import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';

const status = document.getElementById('status');
function nativeReference(source) {
  const frame = document.createElement('iframe'); frame.hidden = true; document.body.append(frame);
  try { return frame.contentWindow.Function(`return (${source})(0)`)(); }
  finally { frame.remove(); }
}
try {
  const suiteFile = new URLSearchParams(location.search).get('suite') ?? 'test262-suite.json';
  if (!/^test262-[a-z0-9-]+\.json$/.test(suiteFile)) throw new Error('Invalid Test262 suite filename');
  const response = await fetch(`./${suiteFile}`);
  if (!response.ok) throw new Error('Export the browser Test262 fixture first');
  const suite = await response.json();
  const compiler = await createCompiler(), vm = await QuickJSGPU.create();
  const records = [], counts = { exportedVariants: suite.cases.length, passed: 0, failed: 0, unsupported: 0, resourceLimited: 0, referenceRejected: 0 };
  try {
    for (const { file, strict, source } of suite.cases) {
      try {
        if (nativeReference(source) !== true) throw new Error('Native reference did not return true');
      } catch (error) {
        counts.referenceRejected++; records.push({ file, strict, status: 'referenceRejected', error: String(error) }); continue;
      }
      let stage = 'compile';
      try {
        const program = compiler.compile(source); stage = 'runtime';
        const result = await vm.run(program, [0], { budget: 4096, maxDispatches: 32 });
        if (result.values[0] !== true || result.backend !== 'gpu') throw new Error('Expected true on GPU');
        counts.passed++; records.push({ file, strict, status: 'passed' });
      } catch (error) {
        const outcome = classifyTest262Outcome(error, stage);
        counts[outcome]++; records.push({ file, strict, status: outcome, stage, error: error.message });
      }
      status.textContent = `Checked ${records.length}/${suite.cases.length} adapted variants`;
    }
    const { cases, ...provenance } = suite;
    window.quickjsReport = { ...provenance, backend: 'gpu', compiler: 'QuickJS/Wasm',
      nativeReference: 'Fresh Safari iframe realm per adapted variant', counts, records };
    status.textContent = counts.failed || counts.referenceRejected ? 'Completed with failures' : counts.resourceLimited ? 'Completed with resource limits' : 'Completed';
    document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
  } finally { await vm.dispose(); }
} catch (error) {
  window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`;
  status.textContent = 'Failed'; document.getElementById('report').textContent = window.quickjsError;
}
