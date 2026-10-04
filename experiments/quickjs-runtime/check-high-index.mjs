import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {highIndexCases,highIndexResumptionSource,highIndexResumptionExpected} from './high-index-cases.js';
import {attachBootstrap,bootstrapSources} from './bootstrap.js';
import {packProgram,entrySource} from './program.js';
import {createCompiler} from './compiler.js';
const compiler=await createCompiler();
const {default:createModule}=await import('./generated/compiler.mjs');
const wasm=await createModule();
const native=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const boots=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,JSON.parse(execFileSync(native,[s],{encoding:'utf8'}))]));
const fixtures=[...highIndexCases,{feature:'high-index-resumption',source:highIndexResumptionSource,input:17,expected:highIndexResumptionExpected}];
let packed=0;
for(const c of fixtures){
 assert.equal(new Script(`(${c.source})(input)`).runInNewContext({input:c.input},{timeout:1000}),c.expected,c.feature);
 const a=JSON.parse(execFileSync(native,[c.source],{encoding:'utf8'}));
 const b=JSON.parse(wasm.ccall('lanes_compile','string',['string'],[c.source]));
 const normalize=v=>JSON.parse(JSON.stringify(v,(key,value)=>key==='bytes'?undefined:value));
 assert.deepEqual(normalize(a),normalize(b),c.feature+' normalized raw compiler parity');
 const w=compiler.compile(c.source),n=packProgram(attachBootstrap(a,boots),entrySource(c.source));
 assert.deepEqual(w.code,n.code,c.feature+' packed code');assert.deepEqual(w.image,n.image,c.feature+' packed image');packed++;
}
console.log(JSON.stringify({fixtures:fixtures.length,fixedNativeExpectations:fixtures.length,nativeWasmParity:fixtures.length,packed,gpuChecks:false}));
