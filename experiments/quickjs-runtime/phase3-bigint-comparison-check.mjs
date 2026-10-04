import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {comparisonHelperProgram,comparisonHostSetup,compareWordModel} from './phase3-bigint-comparison-test-support.js';
import {phase3BigintComparisonCases,phase3BigintComparisonResumptionSource,phase3BigintComparisonResumptionExpected} from './phase3-bigint-comparison-cases.js';
import {bigintRelationalSource,bigintEqualitySource,bigintComparisonPrimitiveSource} from './phase3-bigint-comparison.js';
import {bootstrapSources,attachBootstrap,privateBuiltins} from './bootstrap.js';
import {packProgram,entrySource,LIMITS,FIELDS} from './program.js';
const fixtures=[...phase3BigintComparisonCases,{source:phase3BigintComparisonResumptionSource,expected:phase3BigintComparisonResumptionExpected,input:3,feature:'resumption'}];
let directed=0;
for(const c of fixtures){const native=new Script(`(${c.source})(${c.input})`).runInNewContext({},{timeout:2000});assert.equal(native,c.expected,c.feature);const helper=new Script(comparisonHostSetup+`(${comparisonHelperProgram(c.source)})(${c.input})`).runInNewContext({},{timeout:2000});assert.equal(helper,native,c.feature);directed++;}
let seed=0x197305;const rand=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;let wordComparisons=0;
const buffer=new ArrayBuffer(8),view=new DataView(buffer);
for(let i=0;i<12000;i++){
 view.setUint32(0,rand(),true);view.setUint32(4,rand(),true);const n=view.getFloat64(0,true);
 let a=(BigInt(rand())<<BigInt(rand()%2016))+BigInt(rand());if(rand()&1)a=-a;
 const candidates=[a,0n,1n,-1n];if(Number.isFinite(n)) {const integer=BigInt(Math.trunc(n));candidates.push(integer,integer-1n,integer+1n);}
 for(const value of candidates){const expected=value<n?-1:value>n?1:value==n?0:2;assert.equal(compareWordModel(value,n),expected,`word case ${i}`);wordComparisons++;}
}
const compiler=fileURLToPath(new URL('./generated/compiler',import.meta.url));const nr=s=>JSON.parse(execFileSync(compiler,[s],{encoding:'utf8',maxBuffer:1<<26}));const {default:create}=await import('./generated/compiler.mjs');const wasm=await create(),wr=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const integrated=privateBuiltins.__lanesBigIntNumberCompare===1165&&privateBuiltins.__lanesBigIntParseString===1166&&privateBuiltins.__lanesComparisonPrimitive===1167&&bootstrapSources.relational===bigintRelationalSource&&bootstrapSources.equality===bigintEqualitySource&&bootstrapSources.comparisonToPrimitive===bigintComparisonPrimitiveSource;
if(integrated){assert.equal(typeof FIELDS.comparisonToPrimitive,'number');const {shader}=await import('./shader.js');assert.ok(!shader.includes('undefinedu'));assert.ok(shader.includes('fn bigintNumberCompare('));}
let nb,wb;if(integrated){nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,nr(s)]));wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,wr(s)]));}
let nativeWasmParity=0,packedParity=0;const limits={locals:0,refs:0,stack:0};
for(const source of [bigintRelationalSource,bigintEqualitySource,bigintComparisonPrimitiveSource,...fixtures.map(c=>c.source)]){
 const a=nr(source),b=wr(source);assert.equal(a.error,undefined);assert.deepEqual(JSON.parse(JSON.stringify(a,(k,v)=>k==='bytes'?undefined:v)),JSON.parse(JSON.stringify(b,(k,v)=>k==='bytes'?undefined:v)));nativeWasmParity++;
 for(const f of a.functions){for(const [k,v]of [['locals',f.locals],['refs',f.refs.length],['stack',f.stack]]){limits[k]=Math.max(limits[k],v);assert.ok(v<=LIMITS[k]);}}
 if(integrated&&fixtures.some(c=>c.source===source)){const p=packProgram(attachBootstrap(a,nb),entrySource(source)),q=packProgram(attachBootstrap(b,wb),entrySource(source));assert.deepEqual(p.code,q.code);assert.deepEqual(p.image,q.image);packedParity++;}
}
console.log(JSON.stringify({directed,wordComparisons,nativeWasmParity,packedParity,integrationPending:!integrated,limits,gpuChecks:false}));
