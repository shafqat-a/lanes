import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { compilerCorrectnessCases } from './compiler-correctness-cases.js';
import { compilerReviewCases } from './compiler-review-cases.js';
import { languageScopeCases } from './language-scope-cases.js';
import { sources as mainSources, inputs as mainInputs } from './cases.js';

const status = document.getElementById('status');
const originalFeatures = new Set(['const-assign-before-init-referenceerror', 'for-let-continue-per-iteration']);
const originals = languageScopeCases.filter(item => originalFeatures.has(item.feature)).map(item => ({ ...item, feature: `original:${item.feature}` }));
const fixtures = [...compilerCorrectnessCases, ...compilerReviewCases, ...originals];
function expect(condition, message) { if (!condition) throw new Error(message); }
function oracle(source, input) {
  const frame = document.createElement('iframe'); frame.hidden = true; document.body.append(frame);
  try { return frame.contentWindow.Function(`return (${source})`)()(input); }
  finally { frame.remove(); }
}
let vm;
try {
  expect(originals.length === 2, 'Original compiler regression fixtures missing');
  const started = performance.now(), compiler = await createCompiler();
  vm = await QuickJSGPU.create(); const records = [], resumptions = [], nativeReferenceDifferences = [], deltaResults = [];
  let passed = 0, checked = 0, rejected = 0;
  for (const { feature, source, input, expected, admission, allowSafariReferenceDifference, expectedForInput, spec } of fixtures) {
    status.textContent = `Compiler correctness: ${records.length + 1}/${fixtures.length} (${feature})`;
    expect(typeof input === 'number' && Number.isFinite(input), `${feature}: numeric fixture input required`);
    const inputs = [input, input + 1], native = inputs.map(value => oracle(source, value));
    let reference = native;
    if (allowSafariReferenceDifference === true) {
      expect(typeof expectedForInput === 'function' && typeof spec === 'string', `${feature}: explicit normative oracle and spec required`);
      reference = inputs.map(expectedForInput);
      expect(Object.is(reference[0], expected), `${feature}: normative oracle disagrees with fixed expectation`);
      for (let i = 0; i < inputs.length; i++) {
        if (!Object.is(native[i], reference[i])) nativeReferenceDifferences.push({ feature, input: inputs[i], native: native[i], normative: reference[i], spec });
      }
    } else {
      expect(Object.is(reference[0], expected), `${feature}: native result ${reference[0]} disagrees with fixed expectation ${expected}`);
    }
    if (admission === 'rejected') {
      let rejection;
      try { compiler.compile(source); } catch (error) { rejection = error; }
      expect(rejection && /Unsupported QuickJS instruction: for_(in|of)_start/.test(rejection.message), `${feature}: expected unsupported iteration compiler rejection; got ${rejection?.message}`);
      rejected++; records.push({ feature, status: 'rejected-as-expected', error: rejection.message });
      continue;
    }
    let result;
    try { result = await vm.run(compiler.compile(source), inputs, { budget: 4096, maxDispatches: 4096 }); }
    catch (error) { throw new Error(`${feature}: ${error.message}\n${source}`); }
    expect(result.backend === 'gpu' && result.done, `${feature}: GPU execution required`);
    for (let i = 0; i < inputs.length; i++) expect(Object.is(result.values[i], reference[i]), `${feature}, input ${inputs[i]}: GPU ${result.values[i]}, native ${reference[i]}\n${source}`);
    passed++; checked += inputs.length;
    records.push({ feature, status: 'passed', inputs, values: result.values, nativeValues: native, expectedValues: reference, normativeOverride: allowSafariReferenceDifference === true, maxSteps: Math.max(...result.steps), collections: Math.max(...result.collections) });
  }
  for (const feature of ['const-closure-before-and-after-init', 'for-let-continue-per-iteration']) {
    const fixture = compilerCorrectnessCases.find(item => item.feature === feature);
    expect(fixture, `Resumption fixture missing: ${feature}`);
    const input = fixture.input + 1, expected = oracle(fixture.source, input);
    const job = await vm.start(compiler.compile(fixture.source), [input]);
    let dispatches = 0, result;
    try {
      do {
        result = await job.step(1);
        if (++dispatches > 20000) throw new Error(`${feature}: resumption exceeded instruction bound`);
        if (dispatches % 100 === 0) status.textContent = `${feature}: ${dispatches} one-instruction dispatches`;
      } while (!result.done);
    } finally { await job.dispose(); }
    expect(result.backend === 'gpu' && Object.is(result.values[0], expected), `${feature}: resumed GPU ${result.values[0]}, native ${expected}`);
    checked++; resumptions.push({ feature, input, expected, dispatches });
  }
  // Exact source guards tie these probes to the two changed main-corpus
  // entries in quickjs-compiler-delta.json. An index drift is a hard failure.
  const deltaCases = [
    { index: 216, source: 'function f(x) { try { const a=x; a=3; } catch(e) { return 19; } }', expected: 19 },
    { index: 1101, source: 'function check(x){return (function f(x){const c=x;try{c=c+1;}catch(e){return (e instanceof TypeError)+":"+c;}return "mutated";})(7);}', expected: 'true:7' },
  ];
  expect(mainInputs.length === 9, 'Compiler delta main-input inventory changed');
  for (const {index, source, expected} of deltaCases) {
    expect(mainSources[index] === source, `Compiler delta source drift at main index ${index}`);
    const native = mainInputs.map(value => oracle(source, value));
    expect(native.every(value => Object.is(value, expected)), `Compiler delta native mismatch at ${index}`);
    const result = await vm.run(compiler.compile(source), mainInputs, {budget:4096});
    expect(result.backend === 'gpu' && result.done, `Compiler delta GPU required at ${index}`);
    expect(result.values.every(value => Object.is(value, expected)), `Compiler delta GPU mismatch at ${index}`);
    deltaResults.push({index, source, inputs:mainInputs, values:result.values, checked:mainInputs.length});
  }
  await vm.dispose(); vm = undefined;
  window.quickjsReport = {
    backend: 'gpu', compiler: 'QuickJS/Wasm with local correctness patches',
    fixturePrograms: fixtures.length, gpuPrograms: passed, compilerRejectedPrograms: rejected,
    checked, resumptionPrograms: resumptions.length, elapsedMs: performance.now() - started,
    originalRegressionPrograms: originals.length, records, resumptions, nativeReferenceDifferences,
    deltaPrograms:deltaResults.length, deltaValues:deltaResults.reduce((sum,item)=>sum+item.checked,0), deltaResults,
    method: 'Fixed semantic expectations validated by fresh Safari realms; admitted fixtures compared on GPU for input and input+1; unsupported iteration remains compiler-rejected; representative TDZ and for-continue closures resumed one instruction per dispatch. Only explicitly flagged fixtures use a documented normative oracle; native differences are retained. Two compiler-delta main-corpus sources are guarded by exact text and rechecked on all nine main inputs.',
  };
  status.textContent = 'Passed'; document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
} catch (error) {
  window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`;
  status.textContent = 'Failed'; document.getElementById('report').textContent = window.quickjsError;
} finally { if (vm) await vm.dispose(); }
