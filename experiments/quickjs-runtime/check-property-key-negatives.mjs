// Compiler acceptance + native reference only; GPU must reject every fixture.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { createCompiler } from './compiler.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { entrySource, packProgram } from './program.js';
import { propertyKeyUnsupportedSources, propertyKeyUnsupportedNativeExpected } from './property-key-negative-cases.js';
const compiler=await createCompiler();
const path=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const raw=source=>JSON.parse(execFileSync(path,[source],{encoding:'utf8'}));
const bootstrap=Object.fromEntries(Object.entries(bootstrapSources).map(([name,source])=>[name,raw(source)]));
const expected=propertyKeyUnsupportedNativeExpected;
for(const [index,source] of propertyKeyUnsupportedSources.entries()){
  const wasm=compiler.compile(source),native=packProgram(attachBootstrap(raw(source),bootstrap),entrySource(source));
  assert.deepEqual(wasm.code,native.code);assert.deepEqual(wasm.image,native.image);
  assert.equal(new Script(`(${source})(17)`).runInNewContext(),expected[index]);
}
console.log(JSON.stringify({programs:propertyKeyUnsupportedSources.length,nativeWasmAgreement:true,nativeReferenceChecks:expected.length,gpuChecks:false,gpuExpected:'Unsupported operation, including catch-wrapped failures'}));
