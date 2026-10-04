import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { highIndexCases, highIndexResumptionSource, highIndexResumptionExpected } from './high-index-cases.js';
const status = document.getElementById('status'), inputs = [0, 1, -1, 17];
function nativeResult(source, input) {
  const frame = document.createElement('iframe'); frame.hidden = true; document.body.append(frame);
  try { return frame.contentWindow.Function(`return (${source})`)()(input); }
  finally { frame.remove(); }
}
function expect(condition, message) { if (!condition) throw new Error(message); }
let vm;
try {
  const started = performance.now(), compiler = await createCompiler();
  vm = await QuickJSGPU.create(); const results = [];
  for (const fixture of highIndexCases) {
    status.textContent = `GPU sparse index check ${fixture.feature}`;
    expect(Object.is(nativeResult(fixture.source, fixture.input), fixture.expected), `Fixed native oracle mismatch: ${fixture.feature}`);
    const expected = inputs.map(input => nativeResult(fixture.source, input));
    let result;
    try { result = await vm.run(compiler.compile(fixture.source), inputs, { budget: 4096, maxDispatches: 4096 }); }
    catch (error) { throw new Error(`${fixture.feature}: ${error.message}\n${fixture.source}`); }
    expect(result.backend === 'gpu' && result.done, `GPU completion required: ${fixture.feature}`);
    for (let i = 0; i < inputs.length; i++) expect(Object.is(result.values[i], expected[i]), `${fixture.feature}, input ${inputs[i]}: GPU ${result.values[i]}, native ${expected[i]}`);
    results.push({ feature: fixture.feature, checked: inputs.length, maxSteps: Math.max(...result.steps), collections: Math.max(...result.collections) });
  }
  expect(nativeResult(highIndexResumptionSource, 17) === highIndexResumptionExpected, 'Fixed resumption oracle mismatch');
  const job = await vm.start(compiler.compile(highIndexResumptionSource), [17]);
  let resumed, dispatches = 0;
  try {
    do {
      resumed = await job.step(1);
      if (++dispatches > 20000) throw new Error('High index resumption exceeded instruction bound');
      if (dispatches % 100 === 0) status.textContent = `Sparse index resumption: ${dispatches} single-instruction dispatches`;
    } while (!resumed.done);
  } finally { await job.dispose(); }
  expect(resumed.backend === 'gpu' && resumed.values[0] === highIndexResumptionExpected, `Sparse resumption mismatch: ${resumed.values[0]}`);
  await vm.dispose(); vm = undefined;
  window.quickjsReport = {
    backend: 'gpu', compiler: 'QuickJS/Wasm', programs: highIndexCases.length + 1,
    checked: highIndexCases.length * inputs.length + 1, fixedNativeExpectations: highIndexCases.length + 1,
    resumptionDispatches: dispatches, resumptionExpected: highIndexResumptionExpected,
    elapsedMs: performance.now() - started, results,
    method: 'Sparse array/object indices compared with fresh native realms and fixed expected values; dynamic string keys, GC workload, maximum lengths, ordering, descriptors, partial truncation and one-instruction resumption.',
    constraints: ['Declared lengths remain sparse; heap capacity unchanged', 'Methods visiting billions of holes remain execution-budget limited', 'Symbols unsupported'],
  };
  status.textContent = 'Passed'; document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
} catch (error) {
  window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`;
  status.textContent = 'Failed'; document.getElementById('report').textContent = window.quickjsError;
} finally { if (vm) await vm.dispose(); }
