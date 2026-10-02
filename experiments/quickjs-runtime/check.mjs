import assert from 'node:assert/strict';
import { verifyFailures, verifyDescriptorResumption } from './validation.js';
import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { openDevice } from '../../scripts/device.js';
import { Script } from 'node:vm';
const compiler = await createCompiler(), context = await openDevice();
const vm = await QuickJSGPU.create({ device: context.device });
import { sources, inputs, stringSources, stringInputs } from './cases.js';
const results = [];
try {
  for (const source of [...sources,...stringSources]) compiler.compile(source);
  for (const budget of [1,2,4,256,4096]) {
    const result = await vm.run(compiler.compile('function f(x) { return x+1; }'), [1], { budget });
    assert.equal(result.done,true);assert.deepEqual(result.values,[2]);
  }
  for (const source of sources) {
    console.error(source);
    const program = compiler.compile(source), oracle = new Script(`(${source})`);
    const expected = inputs.map(x => oracle.runInNewContext()(x));
    const result = await vm.run(program, inputs, { budget: 4096 });
    assert.equal(result.backend, 'gpu');
    result.values.forEach((value, i) => assert(Object.is(value, expected[i]), `${source}: input ${inputs[i]}, got ${value}, expected ${expected[i]}`));
    results.push({ source, checked: inputs.length, maxSteps: Math.max(...result.steps), collections: Math.max(...result.collections) });
  }
  const p = compiler.compile(sources[1]), job = await vm.start(p, [2]);
  let dispatches = 0, last;
  try { do { last = await job.step(1); dispatches++; assert(dispatches < 100); } while (!last.done); }
  finally { await job.dispose(); }
  assert.deepEqual(last.values, [3]); assert(dispatches > 1);
  const negativeChecks = await verifyFailures(compiler, vm);
  const descriptorDispatches = await verifyDescriptorResumption(compiler, vm);
  for (const source of stringSources) {
    const strings = stringInputs;
    const oracle = new Script(`(${source})`);
    const result = await vm.run(compiler.compile(source), strings, { budget: 4096 });
    result.values.forEach((v, i) => assert(Object.is(v, oracle.runInNewContext()(strings[i])), `${source}: ${JSON.stringify(strings[i])}`));
    results.push({ source, checked: strings.length, inputs: 'strings', collections: Math.max(...result.collections) });
  }
  const info = context.adapter.info;
  console.log(JSON.stringify({ adapter: { vendor: info.vendor, device: info.device, description: info.description },
    programs: results.length, checked: results.reduce((sum,r)=>sum+r.checked,0), oneInstructionDispatches: dispatches, descriptorDispatches, negativeChecks, results }, null, 2));
} finally { await vm.dispose(); context.device.destroy(); }
