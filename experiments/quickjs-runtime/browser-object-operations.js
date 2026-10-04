import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { objectOperationSources, objectOperationDirectedCases, objectOperationNormativeExpectations, objectOperationResumptionSource, objectOperationResumptionExpected, objectOperationNegativeSources, objectOperationUnsupportedSources } from './object-operation-cases.js';

const status = document.getElementById('status');
function native(source, input) {
  const frame = document.createElement('iframe'); frame.hidden = true; document.body.append(frame);
  try { return frame.contentWindow.Function(`return (${source})`)()(input); }
  finally { frame.remove(); }
}
try {
  const compiler = await createCompiler(), vm = await QuickJSGPU.create();
  const results = [], nativeReferenceDifferences = [], inputs = [0, 1, -1, 17];
  const directed = new Map(objectOperationDirectedCases.map(item => [item.source, item]));
  for (const [source, expected] of objectOperationNormativeExpectations) directed.set(source, { expected, spec: "https://tc39.es/ecma262/2025/multipage/fundamental-objects.html#sec-objectdefineproperties" });
  try {
    for (const source of objectOperationSources) {
      const rule = directed.get(source);
      let expected, nativeValues;
      try { nativeValues = inputs.map(value => native(source, value)); }
      catch (error) { if (!rule) throw new Error(`Native reference failed: ${source}: ${error.message}`); nativeValues = { threw: error.name, message: error.message }; }
      expected = rule ? inputs.map(() => rule.expected) : nativeValues;
      if (rule && (!Array.isArray(nativeValues) || nativeValues.some((value, index) => !Object.is(value, expected[index])))) nativeReferenceDifferences.push({ source, nativeValues, expected: rule.expected, spec: rule.spec });
      let result;
      try { result = await vm.run(compiler.compile(source), inputs, { budget: 4096 }); }
      catch (error) { throw new Error(`${source}: ${error.message}`); }
      if (result.backend !== 'gpu' || result.values.some((value, i) => !Object.is(value, expected[i])))
        throw new Error(`Object operation mismatch: ${source}; actual=${JSON.stringify(result.values)} expected=${JSON.stringify(expected)}`);
      results.push({ source, checked: inputs.length });
      status.textContent = `Passed ${results.length}/${objectOperationSources.length} object programs`;
    }
    for (const { source, input, expected } of objectOperationDirectedCases) {
      const result = await vm.run(compiler.compile(source), [input]);
      if (result.backend !== 'gpu' || !Object.is(result.values[0], expected)) throw new Error(`Directed Object case mismatch: ${source}`);
    }
    for (const source of objectOperationNegativeSources) {
      const wrapped = `function check(x) {try {(${source})(x);} catch(e) {return e instanceof TypeError;} return false;}`;
      const result = await vm.run(compiler.compile(wrapped), [17]);
      if (result.backend !== 'gpu' || result.values[0] !== true) throw new Error(`Expected guest TypeError: ${source}`);
    }
    for (const source of objectOperationUnsupportedSources) {
      let failure;
      try { await vm.run(compiler.compile(source), [17]); } catch (error) { failure = error; }
      if (!failure?.message.includes('Unsupported')) throw new Error(`Expected unsupported: ${source}`);
    }
    if (native(objectOperationResumptionSource, 17) !== objectOperationResumptionExpected) throw new Error('Object resumption reference mismatch');
    const job = await vm.start(compiler.compile(objectOperationResumptionSource), [17]);
    let result, dispatches = 0;
    try {
      do { result = await job.step(1); if (++dispatches > 20000) throw new Error('Object resumption exceeded bound'); } while (!result.done);
      if (result.backend !== 'gpu' || result.values[0] !== objectOperationResumptionExpected) throw new Error('Object resumption mismatch');
    } finally { await job.dispose(); }
    window.quickjsReport = { backend: 'gpu', programs: results.length, checked: results.length * inputs.length, directedChecks: objectOperationDirectedCases.length, negativeChecks: objectOperationNegativeSources.length + objectOperationUnsupportedSources.length, resumptionDispatches: dispatches, nativeReferenceDifferences, results };
    status.textContent = 'Passed';
  } finally { await vm.dispose(); }
} catch (error) { window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ""}`; status.textContent = 'Failed'; }
