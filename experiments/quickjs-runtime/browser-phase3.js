import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { phase3BrowserCases } from './phase3-browser-cases.js';

const status = document.getElementById('status');
const printable = value => typeof value === 'bigint' ? `${value}n` : value;
const json = value => JSON.stringify(value,(_,v)=>printable(v));
try {
  const compiler = await createCompiler();
  const vm = await QuickJSGPU.create();
  const records = [];
  try {
    for (const item of phase3BrowserCases) {
      status.textContent = `Phase 3 ${records.length + 1}/${phase3BrowserCases.length}: ${item.name}`;
      if(!item.reject){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{const expected=frame.contentWindow.Function('return ('+item.source+')')()(0);if(!Object.is(expected,item.expected))throw new Error(item.name+': fixed native oracle mismatch');}finally{frame.remove();}}
      const program = compiler.compile(item.source);
      let result;
      let error;
      try {
        result = await vm.run(program, [0], { budget: 4096 });
      } catch (caught) {
        error = caught;
      }
      if (item.reject) {
        const message = error?.message || '';
        if (!(item.outputTag?message===`Unsupported GPU output: ${item.outputTag} values cannot cross the QuickJS GPU boundary yet`:/^Unsupported runtime operation in lane \d+, instruction -?\d+; no CPU fallback$/.test(message))) {
          throw new Error(`${item.name}: expected ${item.reject}, got ${result ? json(result.values) : message}`);
        }
        records.push({ name: item.name, status: 'rejected', message });
        continue;
      }
      if (!result || result.backend !== 'gpu' || !result.done) {
        throw new Error(`${item.name}: GPU execution required (${error?.message || 'incomplete'})`);
      }
      if (!Object.is(result.values[0], item.expected)) {
        throw new Error(`${item.name}: GPU ${json(result.values[0])}, expected ${json(item.expected)}`);
      }
      if(item.requiresGC&&!result.collections.every(n=>n>0))throw new Error(item.name+': required collection did not occur');
      records.push({ name: item.name, status: 'passed', value: printable(result.values[0]),collections:Array.from(result.collections) });
    }
    window.quickjsReport = {
      backend: 'gpu',
      compiler: 'QuickJS/Wasm',
      checked: records.filter(r=>r.status==='passed').length,
      programs: records.length,
      unsupported: records.filter(r=>r.status==='rejected').length,
      phase: 3,
      note: 'Fixed native-verified expectations. Pending BigInt mixed comparisons/coercion and custom Symbol protocols produce explicit Unsupported; they are not counted as supported execution.',
      records,
    };
    status.textContent = 'Passed';
    document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
  } finally {
    await vm.dispose();
  }
} catch (error) {
  window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`;
  status.textContent = 'Failed';
  document.getElementById('report').textContent = window.quickjsError;
}
