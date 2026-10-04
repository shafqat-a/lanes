import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { arraySearchSources, arraySearchResumptionSource, arraySearchResumptionExpected } from './array-search-cases.js';

const status = document.getElementById('status');
const inputs = [0, 1, -1, 17];
function nativeResult(source, input) {
  const frame = document.createElement('iframe');
  frame.hidden = true;
  document.body.append(frame);
  try { return frame.contentWindow.Function(`return (${source})`)()(input); }
  finally { frame.remove(); }
}
try {
  status.textContent = 'Compiling array search helpers in WebAssembly; executing on WebGPU…';
  const compiler = await createCompiler();
  const vm = await QuickJSGPU.create();
  const results = [];
  try {
    for (const source of arraySearchSources) {
      const expected = inputs.map(input => nativeResult(source, input));
      const result = await vm.run(compiler.compile(source), inputs, { budget: 4096 });
      if (result.backend !== 'gpu') throw new Error('GPU execution required');
      for (let i = 0; i < inputs.length; i++) {
        if (!Object.is(result.values[i], expected[i])) throw new Error(`Mismatch for input ${inputs[i]}: GPU ${result.values[i]}, native ${expected[i]}`);
      }
      results.push({ checked: inputs.length, maxSteps: Math.max(...result.steps), collections: Math.max(...result.collections) });
      status.textContent = `Passed ${results.length}/${arraySearchSources.length} array search programs on GPU`;
    }
    const nativeOrder = nativeResult(arraySearchResumptionSource, 17);
    if (nativeOrder !== arraySearchResumptionExpected) throw new Error(`Native resumption order ${nativeOrder}`);
    const job = await vm.start(compiler.compile(arraySearchResumptionSource), [17]);
    let dispatches = 0;
    let resumed;
    try {
      do {
        resumed = await job.step(1);
        if (++dispatches > 20000) throw new Error('Array search resumption exceeded instruction bound');
      } while (!resumed.done);
    } finally { await job.dispose(); }
    if (resumed.backend !== 'gpu' || resumed.values[0] !== arraySearchResumptionExpected) throw new Error(`Array search resumption mismatch: ${resumed.values && resumed.values[0]}`);
    window.quickjsReport = {
      backend: 'gpu',
      compiler: 'QuickJS/Wasm',
      programs: arraySearchSources.length + 1,
      checked: results.reduce((sum, item) => sum + item.checked, 0) + 1,
      resumptionDispatches: dispatches,
      resumptionExpected: arraySearchResumptionExpected,
      primitiveBoxing: 'explicitly unsupported',
      numericIndexLimit: 'indices at or above 2^31 remain unsupported by the existing numeric key path',
      method: 'Guest find/findIndex/findLast/findLastIndex/lastIndexOf compared with a fresh native realm. Compiler and host checks are separate and are not a GPU pass.',
      results,
    };
    status.textContent = 'Passed';
    document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
  } finally { await vm.dispose(); }
} catch (error) {
  window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`;
  status.textContent = 'Failed';
  document.getElementById('report').textContent = window.quickjsError;
}
