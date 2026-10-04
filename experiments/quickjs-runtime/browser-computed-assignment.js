import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import {
  computedAssignmentCases, computedAssignmentResumptionSource,
  computedAssignmentResumptionExpected, computedAssignmentRejectedSources,
} from './computed-assignment-cases.js';

const status = document.getElementById('status');
const inputs = [0, 1, -1, 3, 17];
function nativeResult(source, input) {
  const frame = document.createElement('iframe');
  frame.hidden = true; document.body.append(frame);
  try { return frame.contentWindow.Function(`return (${source})`)()(input); }
  finally { frame.remove(); }
}
function expect(condition, message) { if (!condition) throw new Error(message); }
let vm;
try {
  const started = performance.now();
  const compiler = await createCompiler();
  let compilerRejections = 0;
  for (const source of computedAssignmentRejectedSources) {
    let error;
    try { compiler.compile(source); } catch (caught) { error = caught; }
    expect(error && /Unsupported QuickJS instruction: pow/.test(error.message),
      `Expected explicit unsupported exponentiation opcode, got ${error?.message || 'admitted'}`);
    compilerRejections++;
  }
  vm = await QuickJSGPU.create();
  const results = [], nativeReferenceDifferences = [];
  for (const [index, item] of computedAssignmentCases.entries()) {
    status.textContent = `Computed member ${index + 1}/${computedAssignmentCases.length}: ${item.feature}`;
    const known = nativeResult(item.source, item.input);
    const native = inputs.map(input => nativeResult(item.source, input));
    let expected = native;
    if (item.allowSafariReferenceDifference === true) {
      expect(typeof item.expectedForInput === 'function' && typeof item.spec === 'string', `${item.feature}: normative oracle/spec required`);
      expect(Object.is(item.expectedForInput(item.input), item.expected), `${item.feature}: normative fixed expectation mismatch`);
      expected = inputs.map(item.expectedForInput);
      if (!Object.is(known,item.expected) || native.some((value,i)=>!Object.is(value,expected[i]))) nativeReferenceDifferences.push({feature:item.feature,source:item.source,inputs,nativeValues:native,normativeValues:expected,fixedInput:item.input,fixedNative:known,fixedExpected:item.expected,spec:item.spec,note:item.note});
    } else {
      expect(Object.is(known,item.expected),`${item.feature} fixed native oracle mismatch: ${known}, expected ${item.expected}`);
    }
    let result;
    try { result = await vm.run(compiler.compile(item.source), inputs, { budget: 4096, maxDispatches: 4096 }); }
    catch (error) { throw new Error(`${item.feature}: ${error.message}\n${item.source}`); }
    expect(result.backend === 'gpu' && result.done, `GPU completion required for ${item.feature}`);
    for (let lane = 0; lane < inputs.length; lane++) {
      expect(Object.is(result.values[lane], expected[lane]),
        `${item.feature}, input ${inputs[lane]}: GPU ${result.values[lane]}, native ${expected[lane]}\n${item.source}`);
    }
    results.push({ index, feature: item.feature, checked: inputs.length,
      nativeValues:native,expectedValues:expected,maxSteps: Math.max(...result.steps), collections: Math.max(...result.collections) });
  }
  expect(Object.is(nativeResult(computedAssignmentResumptionSource, 3), computedAssignmentResumptionExpected),
    'Fixed resumption native oracle mismatch');
  const job = await vm.start(compiler.compile(computedAssignmentResumptionSource), [3]);
  let resumed, dispatches = 0;
  try {
    do {
      resumed = await job.step(1);
      if (++dispatches > 20000) throw new Error('Computed assignment resumption instruction limit');
      if (dispatches % 100 === 0) status.textContent = `Getter/coercion/setter resumption: ${dispatches} dispatches`;
    } while (!resumed.done);
  } finally { await job.dispose(); }
  expect(resumed.backend === 'gpu' && Object.is(resumed.values[0], computedAssignmentResumptionExpected),
    `Resumption mismatch: ${resumed.values[0]}, expected ${computedAssignmentResumptionExpected}`);
  await vm.dispose(); vm = undefined;
  window.quickjsReport = {
    backend: 'gpu', compiler: 'QuickJS/Wasm', programs: results.length + 1,
    checked: results.length * inputs.length + 1, inputs, compilerRejections,
    resumptionDispatches: dispatches, resumptionExpected: computedAssignmentResumptionExpected,
    elapsedMs: performance.now() - started, results, nativeReferenceDifferences,
    nativeReference: 'Fresh isolated iframe per input; only explicitly listed object-key read/write conversion fixtures use ES2025 normative expectations, with native differences retained.',
    semantics: 'Computed compound, prefix/postfix and logical assignments retain the original Reference key; GetValue and PutValue perform separate observable key conversions.',
    gaps: ['Symbols, BigInt, custom @@toPrimitive and existing key/resource limits remain outside this test scope'],
  };
  status.textContent = 'Passed';
  document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
} catch (error) {
  window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`;
  status.textContent = 'Failed'; document.getElementById('report').textContent = window.quickjsError;
} finally { if (vm) await vm.dispose(); }
