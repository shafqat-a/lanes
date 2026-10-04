import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {promiseCombinatorCases} from './promise-combinators-cases.js';
import {nativePromiseWorkerOutcome} from './native-promise-worker-oracle.js';
let workers=0,terminated=0,values=0;const exits=[];
function createWorker(source){workers++;const w=new Worker(`const {parentPort}=require('node:worker_threads');global.postMessage=v=>parentPort.postMessage(v);let onmessage;process.on('unhandledRejection',()=>{});${source};parentPort.on('message',data=>{void onmessage({data});});`,{eval:true});const a={postMessage:v=>w.postMessage(v),terminate(){terminated++;exits.push(w.terminate());}};w.on('message',data=>a.onmessage?.({data}));w.on('error',e=>a.onerror?.(e));return a;}
for(const c of promiseCombinatorCases)for(const [input,value]of[[c.input,c.expected],[c.input+1,c.expectedNext]]){
 const result=await nativePromiseWorkerOutcome(c.source,input,{createWorker});assert.deepEqual(result,{settlement:c.settlement,value},c.feature+' '+input);values++;
}
await Promise.all(exits);assert.equal(workers,terminated);console.log(JSON.stringify({fixtures:promiseCombinatorCases.length,nativeValues:values,workersTerminated:terminated,gpuExecuted:false}));
if(process.argv.includes('--packed')){
 const {execFileSync}=await import('node:child_process');const {fileURLToPath}=await import('node:url');
 const {createCompiler}=await import('./compiler.js');const {packProgram,entrySource}=await import('./program.js');const {attachBootstrap,bootstrapSources}=await import('./bootstrap.js');
 const compiler=await createCompiler(),bin=fileURLToPath(new URL('./generated/compiler',import.meta.url));const raw=s=>JSON.parse(execFileSync(bin,[s],{encoding:'utf8',maxBuffer:1<<26}));
 const bootstrap=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,raw(s)]));
 for(const c of promiseCombinatorCases){const n=packProgram(attachBootstrap(raw(c.source),bootstrap),entrySource(c.source)),w=compiler.compile(c.source);assert.deepEqual(n.code,w.code,c.feature);assert.deepEqual(n.image,w.image,c.feature);}
 console.log(JSON.stringify({packedNativeWasmPrograms:promiseCombinatorCases.length,gpuExecuted:false}));
}
