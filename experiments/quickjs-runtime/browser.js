import { verifyExtendedBuiltinResumption, verifyFailures, verifyDescriptorResumption, verifyApplyResumption, verifyNumericResumption, verifyErrorResumption, verifyArrayMethodResumption, verifyArraySearchResumption } from './validation.js';
import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { sources, inputs, stringSources, stringInputs, specExpectations } from './cases.js';
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
    status.textContent = 'Checking compiler and runtime boundaries';
    const negativeChecks = await verifyFailures(compiler, vm);
    const cases = [...sources.map(source=>[source,inputs]),...stringSources.map(source=>[source,stringInputs])];
    for (const [source, values] of cases) {
      status.textContent = `Checking ${results.length + 1}/${cases.length} programs on GPU`;
      const normative = specExpectations.get(source);
      const nativeValues = values.map(value => {
        try { return nativeResult(source, value); }
        catch (error) {
          if (!normative) throw new Error(`Native reference threw for ${source}: ${error.name}: ${error.message}`);
          return { threw: error.name, message: error.message };
        }
      });
      const expected = normative ? values.map(()=>normative.value) : nativeValues;
      let result;
      try { result = await vm.run(compiler.compile(source), values, { budget: 4096 }); }
      catch (error) { throw new Error(`GPU execution failed for ${source}: ${error.message}`); }
      for (let i = 0; i < values.length; i++) if (!Object.is(result.values[i], expected[i])) throw new Error(`Mismatch: ${source}; input ${values[i]}; actual=${String(result.values[i])}; expected=${String(expected[i])}`);
      if (result.backend !== 'gpu') throw new Error('GPU execution required');
      const referenceDifference = normative && nativeValues.some((v,i)=>!Object.is(v,expected[i]))
        ? { ...normative, nativeValues } : undefined;
      results.push({ source, checked: values.length, collections: Math.max(...result.collections), referenceDifference });
      status.textContent = `Passed ${results.length}/${cases.length} programs on GPU`;
    }
    const job = await vm.start(compiler.compile(sources[1]), [2]);
    let dispatches = 0, result;
    try {
      do { result = await job.step(1); if (++dispatches > 100) throw new Error('Resumption failed'); } while (!result.done);
      if (result.values[0] !== 3 || dispatches < 2) throw new Error('Resumption mismatch');
    } finally { await job.dispose(); }

    const descriptorDispatches = await verifyDescriptorResumption(compiler, vm);
    const applyDispatches = await verifyApplyResumption(compiler, vm);
    const numericDispatches = await verifyNumericResumption(compiler, vm);
    const errorDispatches = await verifyErrorResumption(compiler, vm);
    const arrayMethodDispatches = await verifyArrayMethodResumption(compiler, vm);
    const arraySearchDispatches = await verifyArraySearchResumption(compiler, vm);
    const extendedBuiltinDispatches = await verifyExtendedBuiltinResumption(compiler, vm);
    window.quickjsReport = { backend: 'gpu', compiler: 'QuickJS/Wasm', programs: results.length, checked: results.reduce((sum,r)=>sum+r.checked,0), oneInstructionDispatches: dispatches, descriptorDispatches, applyDispatches, numericDispatches, errorDispatches, arrayMethodDispatches, arraySearchDispatches, extendedBuiltinDispatches, negativeChecks, results };
    status.textContent = 'Passed'; document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
  } finally { await vm.dispose(); }
} catch (error) { window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ""}`; status.textContent = 'Failed'; document.getElementById('report').textContent = window.quickjsError; }
