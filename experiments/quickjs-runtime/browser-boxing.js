import { boxingIntegrationSources, boxingIntegrationNormativeExpectations } from './boxing-integration-cases.js';
import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { boxingNegativeNormativeExpectations, boxingInputNormativeExpectations, boxingTaggedTemplateSources, boxingSources, boxingTypeErrorSources, boxingRangeErrorSources, boxingUnsupportedSources, boxingResumptionSource, boxingResumptionExpected, boxingNormativeExpectations, wrapErrorSource } from './boxing-cases.js';

const status = document.getElementById('status'), inputs = [0, 1, -1, 17];
// Each native reference runs in a fresh iframe realm, so prototype mutation does not leak.
function nativeResult(source, input) {
  const frame = document.createElement('iframe'); frame.hidden = true; document.body.append(frame);
  try { return frame.contentWindow.Function(`return (${source})`)()(input); }
  finally { frame.remove(); }
}
function expect(condition, message) { if (!condition) throw new Error(message); }
const identitySources = [
  ...boxingTypeErrorSources.map(source => wrapErrorSource(source, 'TypeError')),
  ...boxingRangeErrorSources.map(source => wrapErrorSource(source, 'RangeError')),
];
const sources = [...boxingSources, ...identitySources, ...boxingIntegrationSources];
let vm;
try {
  const started = performance.now(), compiler = await createCompiler();
  vm = await QuickJSGPU.create();
  const results = [], nativeReferenceDifferences = [];
  for (const [index, source] of sources.entries()) {
    status.textContent = `GPU boxing program ${index + 1}/${sources.length}`;
    const nativeValues = inputs.map(input => nativeResult(source, input));
    let expected = nativeValues;
    if (boxingNormativeExpectations.has(source)) {
      expected = inputs.map(() => boxingNormativeExpectations.get(source));
      if (nativeValues.some((value, i) => !Object.is(value, expected[i]))) nativeReferenceDifferences.push({ source, nativeValues, expected: expected[0] });
    }
    if(boxingIntegrationNormativeExpectations.has(source)){
      expected=inputs.map(boxingIntegrationNormativeExpectations.get(source));
      if(nativeValues.some((v,i)=>!Object.is(v,expected[i])))nativeReferenceDifferences.push({source,nativeValues,expected,spec:'https://tc39.es/ecma262/2025/multipage/ecmascript-language-expressions.html#sec-evaluate-property-access-with-expression-key'});
    }
    if(boxingInputNormativeExpectations.has(source)){const item=boxingInputNormativeExpectations.get(source);expected=inputs.map(item.expectedForInput);if(nativeValues.some((v,i)=>!Object.is(v,expected[i])))nativeReferenceDifferences.push({source,nativeValues,expected,spec:item.spec,note:item.note});}
    let result;
    try { result = await vm.run(compiler.compile(source), inputs, { budget: 4096, maxDispatches: 4096 }); }
    catch (error) { throw new Error(`Program ${index}: ${error.message}\n${source}`); }
    expect(result.backend === 'gpu' && result.done, `GPU completion required for ${index}`);
    for (let i = 0; i < inputs.length; i++) expect(Object.is(result.values[i], expected[i]), `Program ${index}, input ${inputs[i]}: GPU ${result.values[i]}, expected ${expected[i]}\n${source}`);
    results.push({ index, checked: inputs.length, maxSteps: Math.max(...result.steps), collections: Math.max(...result.collections) });
  }
  // Formerly rejected tagged templates are admitted: they ran above as ordinary
  // positive programs (GPU vs fresh native iframe realms, same inputs).
  for(const source of boxingTaggedTemplateSources)expect(sources.includes(source),`Tagged template program not run on GPU: ${source}`);
  // Unwrapped negatives must escape as uncaught guest exceptions, never CPU fallback.
  let negativeChecks = 0;
  for (const source of [...boxingTypeErrorSources, ...boxingRangeErrorSources]) {
    let nativeThrew = false,nativeValue,nativeError;
    try { nativeValue=nativeResult(source, 17); } catch(e) { nativeThrew = true;nativeError=e.name; }
    const normative=boxingNegativeNormativeExpectations.get(source);
    if(normative){if(nativeError!==normative.expectedError)nativeReferenceDifferences.push({source,input:17,nativeThrew,nativeValue,nativeError,expectedError:normative.expectedError,spec:normative.spec,note:normative.note});}
    else expect(nativeThrew, `Negative fixture does not throw natively: ${source}`);
    let error;
    try { await vm.run(compiler.compile(source), [17], { budget: 4096 }); } catch (caught) { error = caught; }
    expect(error && /TypeError|RangeError|Uncaught guest exception/.test(error.message) && /no CPU fallback/.test(error.message), `Expected guest exception, got ${error?.message}\n${source}`);
    negativeChecks++;
  }
  let unsupportedChecks = 0;
  for (const source of boxingUnsupportedSources) {
    let error;
    try { await vm.run(compiler.compile(source), [17], { budget: 4096 }); } catch (caught) { error = caught; }
    expect(error && /Unsupported runtime operation/.test(error.message) && /no CPU fallback/.test(error.message), `Expected uncatchable unsupported operation, got ${error?.message}\n${source}`);
    unsupportedChecks++;
  }
  expect(nativeResult(boxingResumptionSource, 17) === boxingResumptionExpected, 'Native boxing resumption oracle mismatch');
  const job = await vm.start(compiler.compile(boxingResumptionSource), [17]);
  let resumed, dispatches = 0;
  try {
    do {
      resumed = await job.step(1);
      if (++dispatches > 20000) throw new Error('Boxing resumption exceeded instruction bound');
      if (dispatches % 100 === 0) status.textContent = `Boxing callback resumption: ${dispatches} single-instruction dispatches`;
    } while (!resumed.done);
  } finally { await job.dispose(); }
  expect(resumed.backend === 'gpu' && resumed.values[0] === boxingResumptionExpected, `Boxing resumption mismatch: ${resumed.values[0]}`);
  await vm.dispose(); vm = undefined;
  window.quickjsReport = {
    backend: 'gpu', compiler: 'QuickJS/Wasm', programs: sources.length + 1,
    checked: sources.length * inputs.length + 1, negativeChecks, unsupportedChecks, taggedTemplatePrograms: boxingTaggedTemplateSources.length,
    typeErrorIdentityPrograms: boxingTypeErrorSources.length, rangeErrorIdentityPrograms: boxingRangeErrorSources.length,
    resumptionDispatches: dispatches, resumptionExpected: boxingResumptionExpected,
    nativeReferenceDifferences, elapsedMs: performance.now() - started, results,
    method: 'GPU primitive boxing (Object(v), wrappers, prototype objects, primitive receivers/writes) compared with fresh native iframe realms; TypeError/RangeError identity inside the guest; uncaught guest exceptions; uncatchable unsupported checks; callback resumption at one instruction per dispatch.',
    gaps: ['Unimplemented String/Number prototype methods', 'Prototype own-key enumeration', 'Non-decimal Number radix', 'Sloppy global this', 'Array methods on primitive receivers', 'String/Number constructor statics'],
  };
  status.textContent = 'Passed'; document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
} catch (error) {
  window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`;
  status.textContent = 'Failed'; document.getElementById('report').textContent = window.quickjsError;
} finally { if (vm) await vm.dispose(); }
