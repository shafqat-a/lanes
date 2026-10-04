import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {phase4IntegrationCases} from './phase4-integration-cases.js';
import {attachBootstrap,bootstrapSources} from './bootstrap.js';
import {packProgram,entrySource} from './program.js';
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const rawW=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const native=fileURLToPath(new URL('./generated/compiler',import.meta.url));const rawN=s=>JSON.parse(execFileSync(native,[s],{encoding:'utf8',maxBuffer:1<<26}));
const nativeBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawN(s)])),wasmBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawW(s)]));
for(const fixture of phase4IntegrationCases){assert.equal(new Script(`(${fixture.source})(input)`).runInNewContext({input:fixture.input},{timeout:2000}),fixture.expected,fixture.feature);
 for(const input of [0,1,-1,17])assert.ok(['number','string','boolean'].includes(typeof new Script(`(${fixture.source})(input)`).runInNewContext({input},{timeout:2000})),fixture.feature);
 const a=packProgram(attachBootstrap(rawN(fixture.source),nativeBoot),entrySource(fixture.source)),b=packProgram(attachBootstrap(rawW(fixture.source),wasmBoot),entrySource(fixture.source));assert.deepEqual(a.code,b.code,fixture.feature);assert.deepEqual(a.image,b.image,fixture.feature);}
console.log(JSON.stringify({fixedNativeExpectations:phase4IntegrationCases.length,packedNativeWasmParity:phase4IntegrationCases.length,nativeInputs:phase4IntegrationCases.length*4,gcRequiredPrograms:phase4IntegrationCases.filter(c=>c.requiresGC).length,gpuChecks:false}));
