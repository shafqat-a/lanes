// Reference checks are test oracles only, not a runtime fallback.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { globalConstantCases } from './global-constant-cases.js';
const path=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const raw=source=>JSON.parse(execFileSync(path,[source],{encoding:'utf8'}));
for(const item of globalConstantCases){
  const result=raw(item.source);assert.equal(result.error,undefined,item.feature);
  assert.ok(result.functions.length>0,item.feature);
  assert.equal(new Script(`(${item.source})(${item.input})`).runInNewContext(),item.expected,item.feature);
}
let nativeWasmAgreement=false;
if(!process.argv.includes('--native-only')){
  const [{createCompiler},{attachBootstrap,bootstrapSources},{entrySource,packProgram}]=await Promise.all([
    import('./compiler.js'),import('./bootstrap.js'),import('./program.js'),
  ]);
  const compiler=await createCompiler();
  const bootstraps=Object.fromEntries(Object.entries(bootstrapSources).map(([name,source])=>[name,raw(source)]));
  for(const {source,feature} of globalConstantCases){
    const wasm=compiler.compile(source),native=packProgram(attachBootstrap(raw(source),bootstraps),entrySource(source));
    assert.deepEqual(wasm.code,native.code,feature);assert.deepEqual(wasm.image,native.image,feature);
  }
  nativeWasmAgreement=true;
}
console.log(JSON.stringify({programs:globalConstantCases.length,nativeReferenceChecks:globalConstantCases.length,nativeWasmAgreement,gpuChecks:false}));
