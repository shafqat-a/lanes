// Host-only native algorithm oracle and native/Wasm packed-bytecode checks.
// Standalone helper roots are explicitly trusted for private captures here;
// this does not admit user access to those private intrinsics.
import assert from 'node:assert/strict';
import {createContext,Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {arrayCopySources} from './array-copy-source.js';
import {arrayCopyMetadata} from './array-copy-metadata.js';
import {arrayCopyCases,arrayCopyResourceCases,arrayCopyResumptionSource,arrayCopyResumptionExpected} from './array-copy-cases.js';
import {bootstrapSources,attachBootstrap} from './bootstrap.js';
import {packProgram,entrySource,LIMITS} from './program.js';
const setup=`const define=Object.defineProperty;
function __lanesToObject(value){if(value===null||value===undefined)throw new TypeError();return Object(value);}
function __lanesNumber(value){return +value;}
const __lanesDefineProperty=define;
`+arrayCopyMetadata.map(({name,field})=>`{const helper=(${arrayCopySources[field]});define(helper,'name',{value:${JSON.stringify(name)},configurable:true});define(Array.prototype,${JSON.stringify(name)},{value:helper,writable:true,configurable:true});}`).join('\n');
function evaluate(source,input,helpers){const realm=createContext({});if(helpers)new Script(setup).runInContext(realm);return new Script(`(${source})(${input})`).runInContext(realm,{timeout:1000});}
let directedChecks=0;
for(const item of arrayCopyCases)for(const input of [0,1,-1,3,17]){const expected=evaluate(item.source,input,false),actual=evaluate(item.source,input,true);assert.ok(Object.is(actual,expected),`${item.feature} input${input}: helper ${actual}, native ${expected}`);directedChecks++;}
assert.equal(evaluate(arrayCopyResumptionSource,3,false),arrayCopyResumptionExpected);
assert.equal(evaluate(arrayCopyResumptionSource,3,true),arrayCopyResumptionExpected);
let state=0x394f92a1;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
const seeds=Number(process.env.LANES_ARRAY_COPY_SEEDS??300);assert.ok(Number.isInteger(seeds)&&seeds>=0&&seeds<=10000);
const shape='function shape(a){let s=""+a.length;for(let i=0;i<a.length;i++)s+=":"+(Object.hasOwn(a,i)?typeof a[i]+"="+a[i]:"hole");return s;}';
let randomizedChecks=0;
for(let seed=0;seed<seeds;seed++){
 const size=(random()*13)|0,values=[];for(let i=0;i<size;i++)values.push(random()<.35?'':String(((random()*31)|0)-15));
 const literal='['+values.join(',')+(values.length&&values.at(-1)===''?',':'')+']';
 const start=((random()*30)|0)-15,skip=((random()*18)|0)-3;
 const forms=['a.toReversed()',`a.toSpliced(${start},${skip},x,undefined)`,`a.toSpliced(${start})`,`a.with(${start},x)`];
 for(const form of forms){const source=`function f(x){${shape}const a=${literal};try{const b=${form};return shape(b)+'|'+shape(a);}catch(e){return e instanceof RangeError?'RangeError':'wrong exception';}}`;assert.ok(Object.is(evaluate(source,3,true),evaluate(source,3,false)),`seed${seed}: ${source}`);randomizedChecks++;}
}
const nativePath=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const nativeRaw=source=>JSON.parse(execFileSync(nativePath,[source],{encoding:'utf8'}));
const {default:create}=await import('./generated/compiler.mjs');const module=await create();
const wasmRaw=source=>JSON.parse(module.ccall('lanes_compile','string',['string'],[source]));
const nativeBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([key,source])=>[key,nativeRaw(source)]));
const wasmBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([key,source])=>[key,wasmRaw(source)]));
let helperCompilerPrograms=0,fixtureCompilerPrograms=0,maxLocals=0,maxRefs=0,maxStack=0;
for(const source of Object.values(arrayCopySources)){
 function pack(raw,boot){assert.equal(raw.error,undefined);raw.functions[0].intrinsicRoot=true;for(const fn of raw.functions){maxLocals=Math.max(maxLocals,fn.locals);maxRefs=Math.max(maxRefs,fn.refs.length);maxStack=Math.max(maxStack,fn.stack);assert.ok(fn.locals<=LIMITS.locals&&fn.refs.length<=LIMITS.refs&&fn.stack<=LIMITS.stack);}return packProgram(attachBootstrap(raw,boot),entrySource(source));}
 const native=pack(nativeRaw(source),nativeBoot),wasm=pack(wasmRaw(source),wasmBoot);assert.deepEqual(native.code,wasm.code);assert.deepEqual(native.image,wasm.image);helperCompilerPrograms++;
}
for(const item of [...arrayCopyCases,...arrayCopyResourceCases,{source:arrayCopyResumptionSource}]){
 const native=packProgram(attachBootstrap(nativeRaw(item.source),nativeBoot),entrySource(item.source));const wasm=packProgram(attachBootstrap(wasmRaw(item.source),wasmBoot),entrySource(item.source));assert.deepEqual(native.code,wasm.code);assert.deepEqual(native.image,wasm.image);fixtureCompilerPrograms++;
}
console.log(JSON.stringify({directedPrograms:arrayCopyCases.length,directedChecks,randomizedChecks,seeds,resumptionChecks:1,helperCompilerPrograms,fixtureCompilerPrograms,nativeWasmAgreement:true,maxLocals,maxRefs,maxStack,publicIntegrationPresent:Object.keys(arrayCopySources).every(key=>bootstrapSources[key]===arrayCopySources[key]),gpuChecks:false}));
