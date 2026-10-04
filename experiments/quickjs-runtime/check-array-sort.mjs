import {arraySortReviewCases} from './array-sort-review-cases.js';
// Host-only native algorithm oracle and native/Wasm packed-bytecode checks.
// Standalone helper roots are explicitly trusted for private captures here;
// this does not admit user access to those private intrinsics.
import assert from 'node:assert/strict';
import {createContext,Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {arraySortSources} from './array-sort-source.js';
import {arraySortMetadata} from './array-sort-metadata.js';
import {arraySortCases,arraySortResourceCases,arraySortResumptionSource,arraySortResumptionExpected} from './array-sort-cases.js';
import {bootstrapSources,attachBootstrap} from './bootstrap.js';
import {packProgram,entrySource,LIMITS} from './program.js';
const setup=`const define=Object.defineProperty;
function __lanesToObject(value){if(value===null||value===undefined)throw new TypeError();return Object(value);}
function __lanesNumber(value){return +value;}
const __lanesDefineProperty=define;
const __lanesDescriptor=()=>Object.create(null);
function __lanesToText(value){if(typeof value==='symbol')throw new TypeError();return String(value);}
`+arraySortMetadata.map(({name,field})=>`{const helper=(${arraySortSources[field]});define(helper,'name',{value:${JSON.stringify(name)},configurable:true});define(Array.prototype,${JSON.stringify(name)},{value:helper,writable:true,configurable:true});}`).join('\n');
function evaluate(source,input,helpers){const realm=createContext({});if(helpers)new Script(setup).runInContext(realm);return new Script(`(${source})(${input})`).runInContext(realm,{timeout:1000});}
let directedChecks=0;
for(const item of [...arraySortCases,...arraySortReviewCases])for(const input of [0,1,-1,3,17]){const expected=evaluate(item.source,input,false),actual=evaluate(item.source,input,true);assert.ok(Object.is(actual,expected),`${item.feature} input${input}: helper ${actual}, native ${expected}`);directedChecks++;}
assert.equal(evaluate(arraySortResumptionSource,3,false),arraySortResumptionExpected);
assert.equal(evaluate(arraySortResumptionSource,3,true),arraySortResumptionExpected);
let state=0x17c0ffee;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
const seeds=300;
const shape='function shape(a){let s=""+a.length;for(let i=0;i<a.length;i++)s+=":"+(Object.hasOwn(a,i)?typeof a[i]+"="+a[i]:"hole");return s;}';
let randomizedChecks=0;
for(let seed=0;seed<seeds;seed++){
 const size=(random()*16)|0,values=[];for(let i=0;i<size;i++)values.push(random()<.25?'':random()<.2?'undefined':String(((random()*51)|0)-25));
 const literal='['+values.join(',')+(values.length&&values.at(-1)===''?',':'')+']';
 for(const form of ['a.sort()','a.toSorted()','a.sort((a,b)=>a-b)','a.toSorted((a,b)=>a-b)']){
  const source=`function f(x){${shape}const a=${literal};const b=${form};return shape(b)+'|'+shape(a);}`;
  assert.ok(Object.is(evaluate(source,3,true),evaluate(source,3,false)),`seed${seed}: ${source}`);randomizedChecks++;
 }
}
const nativePath=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const nativeRaw=source=>JSON.parse(execFileSync(nativePath,[source],{encoding:'utf8'}));
const {default:create}=await import('./generated/compiler.mjs');const module=await create();
const wasmRaw=source=>JSON.parse(module.ccall('lanes_compile','string',['string'],[source]));
const nativeBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([key,source])=>[key,nativeRaw(source)]));
const wasmBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([key,source])=>[key,wasmRaw(source)]));
let helperCompilerPrograms=0,fixtureCompilerPrograms=0,maxLocals=0,maxRefs=0,maxStack=0;
for(const source of Object.values(arraySortSources)){
 function pack(raw,boot){assert.equal(raw.error,undefined);raw.functions[0].intrinsicRoot=true;for(const fn of raw.functions){maxLocals=Math.max(maxLocals,fn.locals);maxRefs=Math.max(maxRefs,fn.refs.length);maxStack=Math.max(maxStack,fn.stack);assert.ok(fn.locals<=LIMITS.locals&&fn.refs.length<=LIMITS.refs&&fn.stack<=LIMITS.stack);}return packProgram(attachBootstrap(raw,boot),entrySource(source));}
 const native=pack(nativeRaw(source),nativeBoot),wasm=pack(wasmRaw(source),wasmBoot);assert.deepEqual(native.code,wasm.code);assert.deepEqual(native.image,wasm.image);helperCompilerPrograms++;
}
for(const item of [...arraySortCases,...arraySortReviewCases,...arraySortResourceCases,{source:arraySortResumptionSource}]){
 const native=packProgram(attachBootstrap(nativeRaw(item.source),nativeBoot),entrySource(item.source));const wasm=packProgram(attachBootstrap(wasmRaw(item.source),wasmBoot),entrySource(item.source));assert.ok(native.code.every((value,index)=>value===wasm.code[index])&&native.code.length===wasm.code.length, 'code parity: '+item.feature);assert.ok(native.image.every((value,index)=>value===wasm.image[index])&&native.image.length===wasm.image.length, 'image parity: '+item.feature);fixtureCompilerPrograms++;
}
console.log(JSON.stringify({directedPrograms:arraySortCases.length+arraySortReviewCases.length,directedChecks,randomizedChecks,seeds,resumptionChecks:1,helperCompilerPrograms,fixtureCompilerPrograms,nativeWasmAgreement:true,maxLocals,maxRefs,maxStack,publicIntegrationPresent:Object.keys(arraySortSources).every(key=>bootstrapSources[key]===arraySortSources[key]),gpuChecks:false}));
