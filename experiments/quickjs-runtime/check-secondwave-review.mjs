import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {secondwaveReviewCases} from './secondwave-review-cases.js';
import {attachBootstrap,bootstrapSources} from './bootstrap.js';
import {packProgram,entrySource} from './program.js';
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const rawW=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const native=fileURLToPath(new URL('./generated/compiler',import.meta.url));const rawN=s=>JSON.parse(execFileSync(native,[s],{encoding:'utf8',maxBuffer:1<<26}));
const nativeBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawN(s)])),wasmBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawW(s)]));
for(const fixture of secondwaveReviewCases){assert.equal(new Script(`(${fixture.source})(input)`).runInNewContext({input:fixture.input},{timeout:2000}),fixture.expected,fixture.feature);
 const a=packProgram(attachBootstrap(rawN(fixture.source),nativeBoot),entrySource(fixture.source)),b=packProgram(attachBootstrap(rawW(fixture.source),wasmBoot),entrySource(fixture.source));assert.deepEqual(a.code,b.code,fixture.feature);assert.deepEqual(a.image,b.image,fixture.feature);}
console.log(JSON.stringify({fixedNativeExpectations:secondwaveReviewCases.length,packedNativeWasmParity:secondwaveReviewCases.length,gpuChecks:false}));
