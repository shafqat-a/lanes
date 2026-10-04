import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {jsonStringifyHostSetup} from './json-stringify-test-support.js';
import {jsonBigIntCases,jsonBigIntResumptionSource,jsonBigIntResumptionExpected} from './json-bigint-cases.js';
import {jsonPhase3Cases} from './json-phase3-cases.js';
import {packProgram,entrySource} from './program.js';
import {bootstrapSources,attachBootstrap} from './bootstrap.js';
const run=(s,x,helper)=>new Script((helper?jsonStringifyHostSetup:'')+`(${s})(input)`).runInNewContext({input:x},{timeout:3000});
const cases=[...jsonBigIntCases,...jsonPhase3Cases,{feature:'resumption',source:jsonBigIntResumptionSource,input:3,expected:jsonBigIntResumptionExpected}];let directed=0;
for(const c of cases){assert.ok(Object.is(run(c.source,c.input,false),c.expected),c.feature);for(const x of [0,3,17]){assert.ok(Object.is(run(c.source,x,true),run(c.source,x,false)),c.feature);directed++;}}
let differential=0;
for(let i=0;i<120;i++){
 const values=['1n','Object(2n)','Symbol("x")','3','undefined'];
 const source=`function f(){const data={a:${values[i%5]},b:[${values[(i*7+1)%5]}]};${i%3===0?'BigInt.prototype.toJSON=function(k){return k==="a"?9n:Symbol("z");};':''}try{return JSON.stringify(data,function(k,v){${['return typeof v==="bigint"?"ok":v;','return k==="a"?undefined:v;','return v;','return typeof v==="symbol"?1:v;'][i%4]}});}catch(e){return e instanceof TypeError?"TYPEERROR":"OTHER";}}`;
 assert.equal(run(source,0,true),run(source,0,false),`differential ${i}`);differential++;
}
const compiler=fileURLToPath(new URL('./generated/compiler',import.meta.url));const nr=s=>JSON.parse(execFileSync(compiler,[s],{encoding:'utf8',maxBuffer:1<<26}));
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create(),wr=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,nr(s)])),wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,wr(s)]));let packedParity=0;
for(const c of cases){const a=nr(c.source),b=wr(c.source);assert.deepEqual(JSON.parse(JSON.stringify(a,(k,v)=>k==='bytes'?undefined:v)),JSON.parse(JSON.stringify(b,(k,v)=>k==='bytes'?undefined:v)),c.feature);const p=packProgram(attachBootstrap(a,nb),entrySource(c.source)),q=packProgram(attachBootstrap(b,wb),entrySource(c.source));assert.deepEqual(p.code,q.code);assert.deepEqual(p.image,q.image);packedParity++;}
console.log(JSON.stringify({programs:cases.length,directed,differential,packedParity,gpuChecks:false}));
