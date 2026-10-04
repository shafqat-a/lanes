import{promiseCombinatorCases}from'./promise-combinators-cases.js';
import assert from 'node:assert/strict';import{Script}from'node:vm';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
import{promiseThenCases}from'./promise-then-cases.js';import{promiseJobsCases}from'./promise-jobs-cases.js';import{promiseCapacityProbes}from'./promise-capacity-probes.js';
import{attachBootstrap,bootstrapSources}from'./bootstrap.js';import{packProgram,entrySource,LIMITS}from'./program.js';
const fixtures=[...promiseThenCases,...promiseJobsCases,...promiseCombinatorCases].filter(c=>/bounded/.test(c.feature)||c.gpuOutcome==='resource');
const cases=[...fixtures,...promiseCapacityProbes];let values=0;
assert(700*3>LIMITS.heap);assert(500*(2+4)>LIMITS.heap);
for(const c of fixtures)for(const x of[3,4]){assert.equal(await new Script(`(${c.source})(${x})`).runInNewContext(),x===3?c.expected:c.expectedNext,c.feature);values++;}
for(const c of promiseCapacityProbes)for(const x of c.inputs){assert.equal(await new Script(`(${c.source})(${x})`).runInNewContext(),c.expectedForInput(x),c.feature);values++;}
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const rawW=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const path=fileURLToPath(new URL('./generated/compiler',import.meta.url));const rawN=s=>JSON.parse(execFileSync(path,[s],{encoding:'utf8',maxBuffer:1<<26}));
const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawN(s)])),wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawW(s)]));
for(const c of cases){const a=packProgram(attachBootstrap(rawN(c.source),nb),entrySource(c.source)),b=packProgram(attachBootstrap(rawW(c.source),wb),entrySource(c.source));assert.deepEqual(a.code,b.code,c.name);assert.deepEqual(a.image,b.image,c.name);}
console.log(JSON.stringify({programs:cases.length,nativeValues:values,packedParity:cases.length,gpuExecuted:false}));
