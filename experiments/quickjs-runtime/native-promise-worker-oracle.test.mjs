import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {nativePromiseWorkerOutcome} from './native-promise-worker-oracle.js';
let created=0,terminated=0;const exits=[];
function createWorker(source){created++;const w=new Worker(`const {parentPort}=require('node:worker_threads');global.postMessage=v=>parentPort.postMessage(v);let onmessage;${source};parentPort.on('message',data=>{void onmessage({data});});`,{eval:true});const adapter={postMessage:v=>w.postMessage(v),terminate(){terminated++;exits.push(w.terminate());}};w.on('message',data=>adapter.onmessage?.({data}));w.on('error',e=>adapter.onerror?.(e));return adapter;}
const run=(source,options={})=>nativePromiseWorkerOutcome(source,7,{createWorker,...options});
assert.deepEqual(await run('function f(x){return x;}'),{settlement:undefined,value:7});
assert.deepEqual(await run('function f(x){return Promise.resolve(x);}'),{settlement:'fulfilled',value:7});
assert.deepEqual(await run('function f(x){return Promise.reject(x);}'),{settlement:'rejected',value:7});
assert.deepEqual(await run('function f(){return new Promise(()=>{});}'),{settlement:'pending',value:undefined});
assert.deepEqual(await run('function f(){throw new TypeError("exact");}'),{settlement:'sync-throw',value:'TypeError: exact'});
const loop=await run('function f(){function spin(){Promise.resolve().then(spin);}spin();return new Promise(()=>{});}',{timeoutMs:200});assert.equal(loop.timeout,true);assert.equal(loop.name,'NativeOracleTimeout');assert.ok(loop.nativeError);
assert.deepEqual(await run('async function f(x){return x+1;}'),{settlement:'fulfilled',value:8});
await Promise.all(exits);assert.equal(created,7);assert.equal(terminated,7);console.log(JSON.stringify({checks:7,workersTerminated:terminated,pendingTimerInsideWorker:true,infiniteMicrotaskTimeoutAndRecovery:true,gpuExecuted:false}));
const {allowedNativePromiseError}=await import('./native-promise-worker-oracle.js');
const {asyncIterationCases}=await import('./async-iteration-cases.js');
const {normalizeCase}=await import('./promise-gpu-suite.js');
assert.deepEqual(asyncIterationCases.filter(c=>c.nativeOracleError).map(c=>c.feature),['sync-rejected-close-throw-ignored','sync-next-non-object-typeerror']);
let exactChecks=0;
for(const raw of asyncIterationCases.filter(c=>c.nativeOracleError)){
 const item=normalizeCase(raw,'review');const error={name:raw.nativeOracleError.name,nativeError:raw.nativeOracleError.nativeError,timeout:raw.nativeOracleError.timeout};
 for(const input of [3,4]){assert.equal(allowedNativePromiseError(item,input,error),true);exactChecks++;}
 for(const changed of [{...error,nativeError:error.nativeError+'other'},{...error,name:'OtherError'},{...error,timeout:!error.timeout}]){assert.equal(allowedNativePromiseError(item,3,changed),false);exactChecks++;}
 assert.equal(allowedNativePromiseError(item,5,error),false);assert.equal(allowedNativePromiseError({...item,expected:undefined},3,error),false);assert.equal(allowedNativePromiseError({...item,hasSettlement:false},3,error),false);exactChecks+=3;
}
assert.equal(exactChecks,16);console.log(JSON.stringify({exactFixtureNativeErrorChecks:exactChecks,unexpectedErrorsRejected:true}));
let mutationChecks=0;
for(const [source,expected]of [
 ['function f(x){const orig=Promise.resolve;let n=0;Object.defineProperty(Promise,"resolve",{get(){n++;return orig;}});return Promise.all([x]).then(v=>n+":"+v[0]);}','1:7'],
 ['function f(x){Object.defineProperty(Promise,"resolve",{get(){throw "polluted";}});return new Promise(r=>r(x));}',7],
 ['function f(x){Promise.resolve=()=>({then(){}});return new Promise(r=>r(x));}',7],
 ['function f(x){Promise.race=()=>{throw "polluted";};return new Promise(r=>r(x));}',7],
 ['function f(x){Promise.prototype.then=function(){throw "polluted";};return new Promise(r=>r(x));}',7],
 ['function f(x){return {then(resolve){resolve(x);}};}',7],
]){assert.deepEqual(await run(source),{settlement:'fulfilled',value:expected},source);mutationChecks++;}
await Promise.all(exits);assert.equal(created,terminated);console.log(JSON.stringify({pristineObserverMutationChecks:mutationChecks,totalWorkersTerminated:terminated}));
const {asyncFunctionCases}=await import('./async-function-cases.js');const bound=asyncFunctionCases.find(c=>c.gpuOutcome==='resource');assert.ok(bound);assert.equal(normalizeCase(bound,'review').expectedStatus,3);assert.ok(normalizeCase(bound,'review').resource);
