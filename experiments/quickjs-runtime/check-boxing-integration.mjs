import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCompiler } from './compiler.js';
import { attachBootstrap,bootstrapSources } from './bootstrap.js';
import { entrySource,packProgram } from './program.js';
import { boxingIntegrationCases } from './boxing-integration-cases.js';
const raw=source=>JSON.parse(execFileSync(fileURLToPath(new URL('./generated/compiler',import.meta.url)),[source],{encoding:'utf8'}));
const boot=Object.fromEntries(Object.entries(bootstrapSources).map(([name,source])=>[name,raw(source)]));
const compiler=await createCompiler();let nativeChecks=0;
for(const item of boxingIntegrationCases){
 const evaluate=input=>new Script(`(${item.source})(${input})`).runInNewContext({}, {timeout:1000});
 assert.ok(Object.is(evaluate(item.input),item.expected),`${item.feature}: ${evaluate(item.input)} expected ${item.expected}`);
 for(const input of [0,1,-1,3,17]){const first=evaluate(input);assert.equal(typeof first,'string');assert.ok(Object.is(first,evaluate(input)),item.feature);nativeChecks++;}
 const native=packProgram(attachBootstrap(raw(item.source),boot),entrySource(item.source));const wasm=compiler.compile(item.source);
 assert.deepEqual(native.code,wasm.code,item.feature);assert.deepEqual(native.image,wasm.image,item.feature);
}
console.log(JSON.stringify({programs:boxingIntegrationCases.length,nativeChecks,nativeWasmAgreement:true,gpuChecks:false}));
