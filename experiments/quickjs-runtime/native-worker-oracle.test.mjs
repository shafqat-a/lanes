import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {nativeWorkerOutcome} from './native-worker-oracle.js';
let created=0,terminated=0;const exits=[];
function createWorker(source){
 created++;const w=new Worker(`const {parentPort}=require('node:worker_threads');global.postMessage=v=>parentPort.postMessage(v);let onmessage;${source};parentPort.on('message',data=>onmessage({data}));`,{eval:true});
 const adapter={postMessage:v=>w.postMessage(v),terminate(){terminated++;exits.push(w.terminate());}};
 w.on('message',data=>adapter.onmessage?.({data}));w.on('error',e=>adapter.onerror?.(e));return adapter;
}
for(const input of [undefined,NaN,-0,12345678901234567890n,'s']){const r=await nativeWorkerOutcome('function f(x){return x;}',input,{createWorker});assert.ok(Object.is(r.value,input));}
const thrown=await nativeWorkerOutcome('function f(){throw new RangeError("exact message");}',0,{createWorker});assert.equal(thrown.name,'RangeError');assert.equal(thrown.message,'exact message');
const timeout=await nativeWorkerOutcome('function f(){while(true){}}',0,{createWorker,timeoutMs:150});assert.equal(timeout.timeout,true);
const after=await nativeWorkerOutcome('async function f(){return 42;}',0,{createWorker});assert.equal(after.value,42);
const first=await nativeWorkerOutcome('function f(){globalThis.oracleLeak=1;return 1;}',0,{createWorker});assert.equal(first.value,1);
const isolated=await nativeWorkerOutcome('function f(){return typeof globalThis.oracleLeak;}',0,{createWorker});assert.equal(isolated.value,'undefined');
await Promise.all(exits);assert.equal(created,10);assert.equal(terminated,created);console.log(JSON.stringify({checks:10,workersCreated:created,workersTerminated:terminated,timeoutRecovery:true,gpuExecuted:false}));
