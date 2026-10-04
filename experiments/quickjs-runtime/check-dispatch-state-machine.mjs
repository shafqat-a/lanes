import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dispatchStateMachineCases} from './dispatch-state-machine-cases.js';
import {sharedFinishCases} from './shared-finish-cases.js';
const fixtures=[...dispatchStateMachineCases,...sharedFinishCases];
import {bootstrapSources,attachBootstrap} from './bootstrap.js';
import {packProgram,entrySource} from './program.js';
for(const c of fixtures){const value=new Script(`(${c.source})(${c.input})`).runInNewContext({},{timeout:3000});assert.equal(await value,c.expected,c.feature);}
const binary=fileURLToPath(new URL('./generated/compiler',import.meta.url));const native=s=>JSON.parse(execFileSync(binary,[s],{encoding:'utf8',maxBuffer:1<<26}));const {default:create}=await import('./generated/compiler.mjs');const wasm=await create(),compile=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([n,s])=>[n,native(s)])),wb=Object.fromEntries(Object.entries(bootstrapSources).map(([n,s])=>[n,compile(s)]));
for(const c of fixtures){const n=packProgram(attachBootstrap(native(c.source),nb),entrySource(c.source)),w=packProgram(attachBootstrap(compile(c.source),wb),entrySource(c.source));assert.deepEqual(n.code,w.code,c.feature);assert.deepEqual(n.image,w.image,c.feature);}
console.log(JSON.stringify({nativeExpectations:fixtures.length,packedParity:fixtures.length,gpuExecuted:false}));
