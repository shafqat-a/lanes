import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {jsonStringifySources} from './json-stringify-source.js';
import {jsonStringifyCases,jsonStringifyResumptionSource,jsonStringifyResumptionExpected,jsonStringifyResourceCases} from './json-stringify-cases.js';
import {privateBuiltins,bootstrapSources,attachBootstrap} from './bootstrap.js';
import {packProgram,entrySource,LIMITS} from './program.js';
import {jsonStringifyHostSetup} from './json-stringify-test-support.js';
export {jsonStringifyHostSetup} from './json-stringify-test-support.js';
function run(source,input,helper=false){return new Script((helper?jsonStringifyHostSetup:'')+`(${source})(input)`).runInNewContext({input},{timeout:3000});}
let directed=0;
for(const c of [...jsonStringifyCases,{feature:'resumption',source:jsonStringifyResumptionSource,input:3,expected:jsonStringifyResumptionExpected},...jsonStringifyResourceCases]){
 assert.ok(Object.is(run(c.source,c.input),c.expected),`fixed expectation: ${c.feature}: ${run(c.source,c.input)}`);
 for(const input of [0,1,-1,3,17]){assert.ok(Object.is(run(c.source,input,true),run(c.source,input)),c.feature);directed++;}
}
let seed=0x637281;const rand=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
const units=[0,8,9,10,13,31,34,92,97,0xd800,0xdc00,0xd83d,0xde00,0x2028];
function value(depth){const k=rand()%(depth?7:5);if(k===0)return null;if(k===1)return rand()%2000-1000;if(k===2)return !!(rand()%2);if(k===3)return undefined;if(k===4){let s='';for(let i=rand()%8;i>0;i--)s+=String.fromCharCode(units[rand()%units.length]);return s;}if(k===5)return [value(depth-1),value(depth-1)];return {a:value(depth-1),2:value(depth-1),z:value(depth-1)};}
// Generated literal text transports inputs only. Native JSON.stringify is the
// independent oracle; no assertions reproduce the serializer implementation.
let differential=0;
for(let i=0;i<300;i++){
 const data=value(3);const literal=JSON.stringify(data);const space=[undefined,0,1,2.5,12,'-', '0123456789XYZ'][rand()%7];
 for(const replacer of ['undefined','["z","a","2","a"]','function(k,v){return typeof v==="number"?v+1:v;}']){
  const source=`function f(){return JSON.stringify(${literal},${replacer},${JSON.stringify(space)});}`;
  assert.equal(run(source,0,true),run(source,0));differential++;
 }
}
for(const source of ['function f(){return JSON.stringify(1n);}','function f(){return JSON.stringify(Object(1n));}'])assert.throws(()=>run(source,0,true),e=>e.name==='TypeError');
const native=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const source=jsonStringifySources.stringify;
const n=JSON.parse(execFileSync(native,[source],{encoding:'utf8',maxBuffer:1<<25}));
const w=JSON.parse(wasm.ccall('lanes_compile','string',['string'],[source]));
assert.equal(n.error,undefined);assert.equal(w.error,undefined);
const normalize=raw=>JSON.parse(JSON.stringify(raw,(k,v)=>k==='bytes'?undefined:v));assert.deepEqual(normalize(n),normalize(w));
let packedHelperParity=false;
if(privateBuiltins.__lanesJSONWrapperKind===1821&&privateBuiltins.__lanesJSONWrapperValue===1822){const stamp=raw=>({...raw,bootstrapFunctions:{jsonStringify:0},functions:raw.functions.map((f,i)=>i?f:{...f,intrinsicRoot:true})});const a=packProgram(stamp(n),'jsonStringifyBootstrap'),b=packProgram(stamp(w),'jsonStringifyBootstrap');assert.deepEqual(a.code,b.code);assert.deepEqual(a.image,b.image);packedHelperParity=true;}
const limits={locals:0,refs:0,stack:0};for(const f of n.functions){limits.locals=Math.max(limits.locals,f.locals);limits.refs=Math.max(limits.refs,f.refs.length);limits.stack=Math.max(limits.stack,f.stack);assert.ok(f.locals<=LIMITS.locals&&f.refs.length<=LIMITS.refs&&f.stack<=LIMITS.stack);}
let nativeBoot,wasmBoot;
if(packedHelperParity){
 nativeBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,JSON.parse(execFileSync(native,[s],{encoding:'utf8',maxBuffer:1<<25}))]));
 wasmBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]))]));
}
let fixturesParity=0,packedFixturesParity=0;
for(const c of [...jsonStringifyCases,{source:jsonStringifyResumptionSource},...jsonStringifyResourceCases]){const a=JSON.parse(execFileSync(native,[c.source],{encoding:'utf8',maxBuffer:1<<25}));const b=JSON.parse(wasm.ccall('lanes_compile','string',['string'],[c.source]));assert.equal(a.error,undefined,c.feature);assert.deepEqual(normalize(a),normalize(b));fixturesParity++;
 if(packedHelperParity){const pa=packProgram(attachBootstrap(a,nativeBoot),entrySource(c.source)),pb=packProgram(attachBootstrap(b,wasmBoot),entrySource(c.source));assert.deepEqual(pa.code,pb.code);assert.deepEqual(pa.image,pb.image);packedFixturesParity++;}}
console.log(JSON.stringify({directed,differential,bigintTypeErrorChecks:2,normalizedHelperParity:true,packedHelperParity,fixturesParity,packedFixturesParity,limits,gpuChecks:false}));
