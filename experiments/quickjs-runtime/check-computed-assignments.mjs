// Host reference and native/Wasm compiler parity; GPU validation is separate.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { createCompiler } from './compiler.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { packProgram, entrySource } from './program.js';
import { computedAssignmentCases, computedAssignmentResumptionSource, computedAssignmentResumptionExpected, computedAssignmentRejectedSources } from './computed-assignment-cases.js';
const compiler=await createCompiler();
const path=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const raw=source=>JSON.parse(execFileSync(path,[source],{encoding:'utf8'}));
const bootstraps=Object.fromEntries(Object.entries(bootstrapSources).map(([name,source])=>[name,raw(source)]));
const cases=[...computedAssignmentCases,{feature:'resumption',source:computedAssignmentResumptionSource,input:3,expected:computedAssignmentResumptionExpected}];
for(const item of cases){
  const wasm=compiler.compile(item.source),native=packProgram(attachBootstrap(raw(item.source),bootstraps),entrySource(item.source));
  assert.deepEqual(wasm.code,native.code,item.feature);assert.deepEqual(wasm.image,native.image,item.feature);
  assert.equal(new Script(`(${item.source})(${item.input})`).runInNewContext(),item.expected,item.feature);
  if(item.allowSafariReferenceDifference){
    assert.equal(item.expectedForInput(item.input),item.expected,item.feature);
    for(const input of [0,1,-1,3,17])assert.equal(new Script(`(${item.source})(${input})`).runInNewContext(),item.expectedForInput(input),`${item.feature} ${input}`);
  }
}
for(const source of computedAssignmentRejectedSources)assert.throws(()=>compiler.compile(source),/Unsupported QuickJS instruction: pow/);
console.log(JSON.stringify({programs:cases.length,rejectedPrograms:computedAssignmentRejectedSources.length,nativeReferenceChecks:cases.length,nativeWasmAgreement:true,gpuChecks:false,resumptionExpected:computedAssignmentResumptionExpected}));
