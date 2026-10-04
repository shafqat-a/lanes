import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { arrayExtendedSources, arrayExtendedNegativeSources, arrayExtendedResumptions } from './array-extended-cases.js';

const status = document.getElementById('status');
const inputs = [0, 1, -1, 17];
function nativeResult(source, input) {
  const frame = document.createElement('iframe'); frame.hidden = true; document.body.append(frame);
  try { return frame.contentWindow.Function(`return (${source})`)()(input); }
  finally { frame.remove(); }
}
try {
  const compiler = await createCompiler(), vm = await QuickJSGPU.create();
  const results = [], resumptions = [];
  try {
    for (const [kind, sources] of [['semantic', arrayExtendedSources], ['negative', arrayExtendedNegativeSources]]) {
      for (const [index, source] of sources.entries()) {
        const expected = inputs.map(input => nativeResult(source, input));
        if (kind === 'negative' && expected.some(value => value !== true)) throw new Error(`Native negative case ${index} did not catch expected completion`);
        const result = await vm.run(compiler.compile(source), inputs, { budget: 4096 });
        if (result.backend !== 'gpu') throw new Error('GPU execution required');
        for (let i = 0; i < inputs.length; i++) {
          if (!Object.is(result.values[i], expected[i])) throw new Error(`${kind} ${index}, input ${inputs[i]}: GPU ${result.values[i]}, native ${expected[i]}`);
        }
        results.push({ kind, index, checked: inputs.length, maxSteps: Math.max(...result.steps), collections: Math.max(...result.collections) });
        status.textContent = `Passed ${results.length} extended array programs on GPU`;
      }
    }
    for (const { name, source, expected } of arrayExtendedResumptions) {
      const native = nativeResult(source, 17);
      if (native !== expected) throw new Error(`${name} native resumption mismatch: ${native}`);
      const job = await vm.start(compiler.compile(source), [17]);
      let dispatches = 0, resumed;
      try {
        do {
          resumed = await job.step(1);
          if (++dispatches > 20000) throw new Error(`${name} resumption exceeded instruction bound`);
        } while (!resumed.done);
      } finally { await job.dispose(); }
      if (resumed.backend !== 'gpu' || resumed.values[0] !== expected) throw new Error(`${name} GPU resumption mismatch: ${resumed.values?.[0]}`);
      resumptions.push({ name, dispatches, expected, checked: 1 });
    }
    window.quickjsReport = {
      backend: 'gpu', compiler: 'QuickJS/Wasm', methods: ['reduce', 'reduceRight', 'fill', 'copyWithin', 'reverse', 'shift', 'unshift'],
      programs: results.length + resumptions.length, semanticPrograms: arrayExtendedSources.length,
      negativePrograms: arrayExtendedNegativeSources.length, checked: results.length * inputs.length + resumptions.length,
      inputs, resumptions, results,
      nativeReference: 'Fresh isolated Safari iframe per input; negative completions caught and checked inside guest code',
      primitiveBoxing: 'explicitly unsupported', numericIndexLimit: 'indices at or above 2^31 remain unsupported',
    };
    status.textContent = 'Passed'; document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
  } finally { await vm.dispose(); }
} catch (error) {
  window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`;
  status.textContent = 'Failed'; document.getElementById('report').textContent = window.quickjsError;
}
