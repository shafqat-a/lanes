// Compiler/reference checks for Object static descriptors; algorithm tests live separately.
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCompiler } from './compiler.js';
import { entrySource, packProgram } from './program.js';
import { bootstrapSources, attachBootstrap } from './bootstrap.js';
import { objectStaticDescriptorSources } from './object-static-descriptor-cases.js';
const compiler=await createCompiler();
const path=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const raw=source=>JSON.parse(execFileSync(path,[source],{encoding:'utf8'}));
const bootstrap=Object.fromEntries(Object.entries(bootstrapSources).map(([key,source])=>[key,raw(source)]));
for(const source of objectStaticDescriptorSources){
  const native=packProgram(attachBootstrap(raw(source),bootstrap),entrySource(source));
  const wasm=compiler.compile(source);
  assert.deepEqual(wasm.code,native.code,source);assert.deepEqual(wasm.image,native.image,source);
}
for(const source of objectStaticDescriptorSources)assert.equal(new Script(`(${source})(7)`).runInNewContext(),true,source);
console.log(JSON.stringify({programs:objectStaticDescriptorSources.length,nativePredicates:21,nativeWasmAgreement:true,gpuChecks:false}));
