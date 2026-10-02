import { verifyFailures, verifyDescriptorResumption } from './validation.js';
import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { sources, inputs, stringSources, stringInputs } from './cases.js';
const status = document.getElementById('status');
function nativeResult(source, input) {
  const frame = document.createElement('iframe'); frame.hidden = true; document.body.append(frame);
  try { return frame.contentWindow.Function(`return (${source})`)()(input); }
  finally { frame.remove(); }
}
try {
  status.textContent = 'Compiling in WebAssembly; executing on WebGPU…';
  const compiler = await createCompiler(), vm = await QuickJSGPU.create();
  const results = [];
  try {
    const cases = [...sources.map(source=>[source,inputs]),...stringSources.map(source=>[source,stringInputs])];
    for (const [source] of cases) compiler.compile(source);
    for (const [source, values] of cases) {
      const expected = values.map(value=>nativeResult(source,value));
      const result = await vm.run(compiler.compile(source), values, { budget: 4096 });
      for (let i = 0; i < values.length; i++) if (!Object.is(result.values[i], expected[i])) throw new Error(`Mismatch: ${source}; input ${values[i]}`);
      if (result.backend !== 'gpu') throw new Error('GPU execution required');
      results.push({ source, checked: values.length, collections: Math.max(...result.collections) });
      status.textContent = `Passed ${results.length}/${cases.length} programs on GPU`;
    }
    const job = await vm.start(compiler.compile(sources[1]), [2]);
    let dispatches = 0, result;
    try {
      do { result = await job.step(1); if (++dispatches > 100) throw new Error('Resumption failed'); } while (!result.done);
      if (result.values[0] !== 3 || dispatches < 2) throw new Error('Resumption mismatch');
    } finally { await job.dispose(); }
    const negativeChecks = await verifyFailures(compiler, vm);
    const descriptorDispatches = await verifyDescriptorResumption(compiler, vm);
    window.quickjsReport = { backend: 'gpu', compiler: 'QuickJS/Wasm', programs: results.length, checked: results.reduce((sum,r)=>sum+r.checked,0), oneInstructionDispatches: dispatches, descriptorDispatches, negativeChecks, results };
    status.textContent = 'Passed'; document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
  } finally { await vm.dispose(); }
} catch (error) { window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ""}`; status.textContent = 'Failed'; document.getElementById('report').textContent = window.quickjsError; }
