import { createCompiler } from '../../compiler.js';
import { QuickJSGPU } from '../../runtime.js';
import { protocolCases } from './cases.js';

const status = document.getElementById('status');
let vm;
try {
  if (!navigator.gpu) throw new Error('WebGPU required; no CPU fallback');
  const compiler = await createCompiler();
  vm = await QuickJSGPU.create();
  const cases = protocolCases();
  const records = [];
  for (const item of cases) {
    status.textContent = `Protocols ${records.length + 1}/${cases.length}: ${item.id}`;
    let result;
    let error;
    try {
      const program = compiler.compile(item.source);
      result = await vm.run(program, [0], { budget: 4096, maxDispatches: 4096 });
    } catch (caught) {
      error = caught;
    }
    if (item.outcome === 'unsupported') {
      const message = error?.message || '';
      const explicit = /Unsupported runtime operation/.test(message) && /no CPU fallback/.test(message);
      records.push({
        id: item.id,
        status: explicit ? 'unsupported' : (error ? 'threw' : 'mismatch'),
        outcome: item.outcome,
        expected: item.expected,
        value: result?.values?.[0],
        message: message || undefined,
      });
      continue;
    }
    if (error || !result || result.backend !== 'gpu' || !result.done) {
      records.push({
        id: item.id,
        status: 'threw',
        outcome: item.outcome,
        expected: item.expected,
        message: error?.message || 'GPU execution required',
      });
      continue;
    }
    if (item.requireGC && !result.collections.every(value => value > 0)) { records.push({id:item.id,status:'mismatch',message:'Required GC did not occur'});continue; }
    if (!Object.is(result.values[0], item.expected)) {
      records.push({
        id: item.id,
        status: 'mismatch',
        outcome: item.outcome,
        expected: item.expected,
        value: result.values[0],
      });
      continue;
    }
    records.push({ id: item.id, status: 'passed', outcome: item.outcome, value: result.values[0], collections:result.collections });
  }
  const resumptions=[];
  for(const item of cases.filter(item=>item.resume||item.id==='iter-resumption-next')){
    const job=await vm.start(compiler.compile(item.source),[0]);let result,dispatches=0;
    try{do{result=await job.step(1);if(++dispatches>60000)throw new Error(item.id+': resumption bound');}while(!result.done);}finally{await job.dispose();}
    if(result.backend!=='gpu'||!Object.is(result.values[0],item.expected))throw new Error(item.id+': resumed mismatch');
    resumptions.push({id:item.id,dispatches,value:result.values[0]});
  }
  const passes = records.filter(record => record.status === 'passed');
  const throws = records.filter(record => record.status === 'threw');
  const mismatches = records.filter(record => record.status === 'mismatch');
  const unsupported = records.filter(record => record.status === 'unsupported');
  window.quickjsReport = {
    backend: 'gpu',
    compiler: 'QuickJS/Wasm',
    checked: passes.length,
    programs: records.length,
    passes: passes.length,
    throws: throws.length,
    mismatches: mismatches.length,
    unsupported: unsupported.length,
    note: 'Guest semantics run only on QuickJSGPU. The host packs, uploads, and compares returned strings and numbers. No CPU interpreter and no CPU fallback.',
    records, resumptions,
  };
  document.getElementById('report').textContent = JSON.stringify(window.quickjsReport, null, 2);
  if (throws.length || mismatches.length) {
    window.quickjsError = [...throws, ...mismatches]
      .map(record => `${record.id}: ${record.status} ${record.message || JSON.stringify(record.value)} expected ${JSON.stringify(record.expected)}`)
      .join('\n');
    status.textContent = 'Failed';
  } else {
    status.textContent = 'Passed';
  }
} catch (error) {
  window.quickjsError = `${error.name}: ${error.message}\n${error.stack || ''}`;
  status.textContent = 'Failed';
  document.getElementById('report').textContent = window.quickjsError;
} finally {
  if (vm) await vm.dispose();
}
