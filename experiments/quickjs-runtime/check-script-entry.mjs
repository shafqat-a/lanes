import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {Worker} from 'node:worker_threads';
// Contextified vm sandboxes misreport global-var configurable flags. Run each
// reference Script in a fresh worker's real global realm instead.
async function nativeScript(source){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(`const{parentPort,workerData}=require('node:worker_threads');try{parentPort.postMessage({value:require('node:vm').runInThisContext(workerData,{timeout:3000})});}catch(e){parentPort.postMessage({error:e.name+': '+e.message});}`,{eval:true,workerData:source});
  const timer=setTimeout(()=>{void worker.terminate();reject(new Error('Native Script timeout'));},5000);
  worker.once('message',result=>{clearTimeout(timer);void worker.terminate();result.error?reject(new Error(result.error)):resolve(result.value);});
  worker.once('error',e=>{clearTimeout(timer);void worker.terminate();reject(e);});
 });
}
import {pathToFileURL,fileURLToPath} from 'node:url';
import {scriptEntryCases,scriptEntryRejectedCases} from './script-entry-cases.js';
import {scriptSource,entrySource,packProgram,OP} from './program.js';
import {attachBootstrap,bootstrapSources} from './bootstrap.js';
import {compilerForModule} from './compiler.js';
import {SCRIPT_MODE_BIT} from './script-entry.js';
const native=process.env.LANES_SCRIPT_NATIVE||'/tmp/lanes-script-entry/compiler';
const wasm=process.env.LANES_SCRIPT_WASM||'/tmp/lanes-script-entry/compiler.mjs';
const create=(await import(pathToFileURL(wasm))).default,module=await create(),compiler=compilerForModule(module);
const raw=(s,script=false)=>JSON.parse(execFileSync(native,script?['--script',s]:[s],{encoding:'utf8',maxBuffer:1<<27}));
const bootstrap=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,raw(s)]));
let nativeValues=0,parity=0;const nativeReferenceDifferences=[];
for(const c of scriptEntryCases){
 for(const input of c.inputs){
  const actual=await nativeScript(c.source);
  if(!Object.is(actual,c.expected)&&Object.hasOwn(c,'nativeNodeExpected')){assert.ok(Object.is(actual,c.nativeNodeExpected),c.name);nativeReferenceDifferences.push({name:c.name,input,actual,expected:c.expected,spec:c.spec,reason:'Observed Node worker global key order; Lanes uses an ordinary global object and ES2025 declaration order'});}
  else assert.ok(Object.is(actual,c.expected),c.name);nativeValues++;
 }
 const r=raw(c.source,true);assert.equal(r.entryKind,'script');
 const n=packProgram(attachBootstrap(r,bootstrap),scriptSource(c.source)),w=compiler.compileScript(c.source);
 assert.deepEqual(n.code,w.code,c.name);assert.deepEqual(n.image,w.image,c.name);assert.ok(n.image[3]&SCRIPT_MODE_BIT);parity++;
 const root=r.functions[0];
 if(c.name.startsWith('declaration-order')){
  const refs=root.refs.filter(ref=>ref.type===4&&!ref.lexical);
  const order=refs.filter((ref,i)=>ref.varKind===10&&!refs.slice(i+1).some(later=>later.varKind===10&&later.name===ref.name)).map(r=>r.name);
  for(const ref of refs)if(ref.varKind!==10&&!order.includes(ref.name))order.push(ref.name);
  assert.equal(order.join(),c.expected,'packed declaration ordering '+c.name);
 }

 root.refs.forEach((ref,i)=>{const off=n.image[4]*4+i*4,spec=n.image.slice(off,off+4);
  if(ref.type===4)assert.equal(spec[0],ref.lexical?8:9,c.name+' declaration');
  if(ref.type===5)assert.equal(spec[0],7,c.name+' unresolved global');
 });
}
for(const c of scriptEntryRejectedCases)assert.throws(()=>compiler.compileScript(c.source),undefined,c.name);
// Legacy entry images stay identical to the previously built compiler.
const oldNative=new URL('./generated/compiler',import.meta.url);
for(const source of ['function f(x){return x+1}', 'function f(x){return globalThis.Array===Array}', 'function f(x){let y=x;return ()=>y}']){
 const old=JSON.parse(execFileSync(fileURLToPath(oldNative),[source],{encoding:'utf8',maxBuffer:1<<27}));
 assert.deepEqual(raw(source),old,'legacy raw ABI unchanged');
 const n=packProgram(attachBootstrap(raw(source),bootstrap),entrySource(source)),w=compiler.compile(source);
 assert.deepEqual(n.code,w.code);assert.deepEqual(n.image,w.image);
}
console.log(JSON.stringify({scriptPrograms:parity,nativeValues,compilerRejections:scriptEntryRejectedCases.length,legacyPrograms:3,bootstrapHelpers:Object.keys(bootstrap).length,requiresGC:scriptEntryCases.filter(c=>c.requiresGC).length,nativeReferenceDifferences,gpuExecuted:false}));
