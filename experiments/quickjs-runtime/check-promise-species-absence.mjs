import assert from 'node:assert/strict';
import {Script} from 'node:vm';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {promiseSpeciesAbsenceCases as cases} from './promise-species-absence-cases.js';
import {attachBootstrap,bootstrapSources} from './bootstrap.js';import {packProgram,entrySource} from './program.js';
let values=0;for(const c of cases)for(const input of [3,4]){assert.equal(await new Script(`(${c.source})(${input})`).runInNewContext(),input===4&&'expectedNext'in c?c.expectedNext:c.expected,c.feature);values++;}
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const rawW=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const path=fileURLToPath(new URL('./generated/compiler',import.meta.url));const rawN=s=>JSON.parse(execFileSync(path,[s],{encoding:'utf8',maxBuffer:1<<26}));
const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawN(s)])),wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawW(s)]));
for(const c of cases){const a=packProgram(attachBootstrap(rawN(c.source),nb),entrySource(c.source)),b=packProgram(attachBootstrap(rawW(c.source),wb),entrySource(c.source));assert.deepEqual(a.code,b.code,c.name);assert.deepEqual(a.image,b.image,c.name);}
console.log(JSON.stringify({programs:cases.length,nativeValues:values,packedParity:cases.length,gpuExecuted:false}));
