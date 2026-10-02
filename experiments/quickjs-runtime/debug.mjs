import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { openDevice } from '../../scripts/device.js';
import assert from 'node:assert/strict';
const compiler=await createCompiler(), context=await openDevice(), vm=await QuickJSGPU.create({device:context.device});
try {
 const program=compiler.compile('function f(x) { return x + 1; }');
 console.log('program',JSON.stringify([...program.code]),JSON.stringify([...program.image.slice(0,8)]));
 for(const budget of [1,2,4,256,4096]) {
   const job=await vm.start(program,[1]);
   try { let result;for(let i=0;i<8;i++){result=await job.step(budget);console.log('budget',budget,result);if(result.done)break;} assert.equal(result.done,true);assert.deepEqual(result.values,[2]); }
   finally{await job.dispose();}
 }
} finally{await vm.dispose();context.device.destroy();}
