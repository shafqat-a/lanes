import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { stringSearchCases, stringSearchNegativeSources, stringSearchResumptionSource, stringSearchResumptionExpected } from './string-search-cases.js';
import { stringSearchIntegrationSources, stringSearchIntegrationNegativeSources, stringSearchIntegrationUnsupportedSources } from './string-search-integration-cases.js';

const status = document.getElementById('status'), inputs = [0, 1, -1, 17];
function nativeResult(source, input) {
  const frame = document.createElement('iframe'); frame.hidden = true; document.body.append(frame);
  try { return frame.contentWindow.Function(`return (${source})`)()(input); }
  finally { frame.remove(); }
}
function expect(condition, message) { if (!condition) throw new Error(message); }
const typeErrorSources = stringSearchIntegrationNegativeSources.map(source =>
  `function f(x){const run=(${source});try{run(x);}catch(e){return e instanceof TypeError;}return false;}`);
const sources = [...stringSearchCases, ...stringSearchIntegrationSources, ...typeErrorSources];
let vm;
try {
  const started = performance.now(), compiler = await createCompiler();
  vm = await QuickJSGPU.create(); const results = [];
  for (const [index, source] of sources.entries()) {
    status.textContent = `GPU string search program ${index + 1}/${sources.length}`;
    const expected = inputs.map(input => nativeResult(source, input));
    let result;
    try { result = await vm.run(compiler.compile(source), inputs, { budget: 4096, maxDispatches: 4096 }); }
    catch (error) { throw new Error(`Program ${index}: ${error.message}\n${source}`); }
    expect(result.backend === 'gpu' && result.done, `GPU completion required for ${index}`);
    for (let i = 0; i < inputs.length; i++) expect(Object.is(result.values[i], expected[i]), `Program ${index}, input ${inputs[i]}: GPU ${result.values[i]}, native ${expected[i]}\n${source}`);
    results.push({ index, checked: inputs.length, maxSteps: Math.max(...result.steps), collections: Math.max(...result.collections) });
  }
  let negativeChecks = 0;
  for (const source of [...stringSearchNegativeSources, ...stringSearchIntegrationNegativeSources]) {
    let nativeThrew = false;
    try { nativeResult(source, 17); } catch { nativeThrew = true; }
    expect(nativeThrew, `Negative fixture does not throw natively: ${source}`);
    let error;
    try { await vm.run(compiler.compile(source), [17], { budget: 4096 }); } catch (caught) { error = caught; }
    expect(error && /TypeError|Uncaught guest exception/.test(error.message) && /no CPU fallback/.test(error.message), `Expected guest exception, got ${error?.message}\n${source}`);
    negativeChecks++;
  }
  let unsupportedChecks = 0;
  for (const source of stringSearchIntegrationUnsupportedSources) {
    let error;
    try { await vm.run(compiler.compile(source), [17], { budget: 4096 }); } catch (caught) { error = caught; }
    expect(error && /Unsupported runtime operation/.test(error.message) && /no CPU fallback/.test(error.message), `Expected uncatchable unsupported operation, got ${error?.message}\n${source}`);
    unsupportedChecks++;
  }
  expect(nativeResult(stringSearchResumptionSource, 17) === stringSearchResumptionExpected, 'Native resumption oracle mismatch');
  const job = await vm.start(compiler.compile(stringSearchResumptionSource), [17]);
  let resumed, dispatches = 0;
  try {
    do {
      resumed = await job.step(1);
      if (++dispatches > 20000) throw new Error('String resumption exceeded instruction bound');
      if (dispatches % 100 === 0) status.textContent = `String callback resumption: ${dispatches} single-instruction dispatches`;
    } while (!resumed.done);
  } finally { await job.dispose(); }
  expect(resumed.backend === 'gpu' && resumed.values[0] === stringSearchResumptionExpected, `String resumption mismatch: ${resumed.values[0]}`);
  await vm.dispose(); vm = undefined;
  window.quickjsReport = {
    backend: 'gpu', compiler: 'QuickJS/Wasm', programs: sources.length + 1,
    checked: sources.length * inputs.length + 1, negativeChecks, unsupportedChecks,
    typeErrorIdentityPrograms: typeErrorSources.length,
    resumptionDispatches: dispatches, resumptionExpected: stringSearchResumptionExpected,
    elapsedMs: performance.now() - started, results,
    method: 'GPU guest string search and method metadata/call/apply/bind compared with fresh native realms; explicit guest exception and uncatchable unsupported checks; callback resumption at one instruction per dispatch.',
    gaps: ['Complete String.prototype method set', 'RegExp and Symbol.match', 'Custom Symbol.toPrimitive', 'Builtin descriptors and mutation'],
  };
  status.textContent = 'Passed'; document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
} catch (error) {
  window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`;
  status.textContent = 'Failed'; document.getElementById('report').textContent = window.quickjsError;
} finally { if (vm) await vm.dispose(); }
