import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {jsonPhase5Sources} from './json-phase5-source.js';
import {jsonPhase5Cases,jsonPhase5SyntaxSources} from './json-phase5-cases.js';
import {jsonReviverCases,jsonReviverNormativeCases,jsonReviverResumptionSource,jsonReviverResumptionExpected} from './json-reviver-cases.js';
import {evaluateJSONReviver as run} from './json-reviver-test-support.js';
import {jsonReviverReviewCases,jsonReviverReviewVersionCases} from './json-reviver-review-cases.js';
const ordinary=[...jsonReviverCases,...jsonReviverReviewCases],normative=[...jsonReviverNormativeCases,...jsonReviverReviewVersionCases];
import {privateBuiltins,bootstrapSources,attachBootstrap} from './bootstrap.js';
import {packProgram,entrySource,LIMITS} from './program.js';
let directed=0;const nativeVersionDifferences=[];
for(const c of [...ordinary,...normative,{feature:'resumption',source:jsonReviverResumptionSource,input:3,expected:jsonReviverResumptionExpected}]){
 assert.ok(Object.is(run(c.source,c.input,true),c.expected),c.feature);
 const native=run(c.source,c.input,false);
 if(normative.includes(c)){if(!Object.is(native,c.expected)){assert.ok(Object.is(native,c.allowedNativeExpected));nativeVersionDifferences.push({feature:c.feature,native,ecmascript2025:c.expected});}}
 else assert.ok(Object.is(native,c.expected),c.feature);
 for(const input of [0,1,-1,3,17]){assert.ok(Object.is(run(c.source,input,true),normative.includes(c)?c.expected:run(c.source,input,false)),c.feature);directed++;}
}
let parseRegressions=0;
for(const c of jsonPhase5Cases){assert.ok(Object.is(run(c.source,c.input,true),run(c.source,c.input,false)),c.feature);parseRegressions++;}
for(const source of jsonPhase5SyntaxSources){assert.equal(run(source,3,true),true);parseRegressions++;}
let state=0x617af;const rand=()=>state=(Math.imul(state,1664525)+1013904223)>>>0;
let differential=0;
for(let seed=0;seed<200;seed++){
 const count=2+rand()%6,object={};for(let i=0;i<count;i++)object['k'+i]=rand()%100;
 const text=JSON.stringify(object),target='k'+(rand()%count),action=rand()%6;
 const source=`function f(){let log="";const result=JSON.parse(${JSON.stringify(text)},function(k,v){log+=k+":"+typeof v+",";if(k==="k0"){${['delete this['+JSON.stringify(target)+'];','this['+JSON.stringify(target)+']={n:7};','Object.defineProperty(this,'+JSON.stringify(target)+',{value:9,writable:false,configurable:false});','Object.defineProperty(this,'+JSON.stringify(target)+',{enumerable:false});','this.extra=8;','Object.preventExtensions(this);'][action]}}if(k===${JSON.stringify(target)})return ${seed%2?'undefined':'12'};return v;});return log+JSON.stringify(result);}`;
 assert.equal(run(source,3,true),run(source,3,false),`seed${seed}`);differential++;
}
const native=fileURLToPath(new URL('./generated/compiler',import.meta.url));const nr=s=>JSON.parse(execFileSync(native,[s],{encoding:'utf8',maxBuffer:1<<25}));
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create(),wr=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const norm=r=>JSON.parse(JSON.stringify(r,(k,v)=>k==='bytes'?undefined:v));
const integrated=privateBuiltins.__lanesReviverDelete===1860&&privateBuiltins.__lanesReviverDefine===1861;
let nb,wb;if(integrated){nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,nr(s)]));wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,wr(s)]));}
let parity=0,packedParity=0;const limits={locals:0,refs:0,stack:0};
for(const [source,helper] of [[jsonPhase5Sources.parse,true],...[...ordinary,...normative,{source:jsonReviverResumptionSource}].map(c=>[c.source,false])]){
 const a=nr(source),b=wr(source);assert.equal(a.error,undefined);assert.deepEqual(norm(a),norm(b));parity++;
 for(const f of a.functions){limits.locals=Math.max(limits.locals,f.locals);limits.refs=Math.max(limits.refs,f.refs.length);limits.stack=Math.max(limits.stack,f.stack);assert.ok(f.locals<=LIMITS.locals&&f.refs.length<=LIMITS.refs&&f.stack<=LIMITS.stack);}
 if(integrated){if(helper){a.functions[0].intrinsicRoot=true;b.functions[0].intrinsicRoot=true;}const p=packProgram(attachBootstrap(a,nb),entrySource(source)),q=packProgram(attachBootstrap(b,wb),entrySource(source));assert.deepEqual(p.code,q.code);assert.deepEqual(p.image,q.image);packedParity++;}
}
console.log(JSON.stringify({directed,parseRegressions,differential,nativeVersionDifferences,parity,packedParity,limits,gpuChecks:false}));
