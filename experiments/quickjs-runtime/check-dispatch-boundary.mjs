import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dispatchBoundaryCases as cases} from './dispatch-boundary-cases.js';
import {attachBootstrap,bootstrapSources} from './bootstrap.js';
import {packProgram,entrySource} from './program.js';
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const rawW=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const path=fileURLToPath(new URL('./generated/compiler',import.meta.url));const rawN=s=>JSON.parse(execFileSync(path,[s],{encoding:'utf8',maxBuffer:1<<26}));
const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawN(s)])),wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawW(s)]));
for(const c of cases){for(const input of [7,8]){const value=await new Script(`(${c.source})(input)`).runInNewContext({input},{timeout:3000});if(input===7)assert.equal(value,c.expected,c.name);else assert.notEqual(value,c.expected,c.name+' input sensitivity');}
const a=packProgram(attachBootstrap(rawN(c.source),nb),entrySource(c.source)),b=packProgram(attachBootstrap(rawW(c.source),wb),entrySource(c.source));assert.deepEqual(a.code,b.code,c.name);assert.deepEqual(a.image,b.image,c.name);}
console.log(JSON.stringify({programs:cases.length,nativeValues:cases.length*2,packedNativeWasmParity:cases.length,requiredGC:cases.filter(c=>c.requiresGC).length,gpuExecuted:false}));
