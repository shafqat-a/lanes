// Host differential tests are test oracles only, never a runtime fallback.
// Worker 6 (Reflect): (a) the guest helper sources run in node:vm against host
// stand-ins for the private intrinsics they use (faithful to the WGSL
// behaviour documented in stdlib-reflect-notes.md) and are compared with
// native V8 Reflect using Object.is; (b) helper compile parity native vs Wasm
// compiler (raw function streams always; packProgram code/image when the
// registry graph is importable); (c) every fixture compiles natively.
// No GPU, no Dawn, no browser: gpuChecks is false.
import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';import vm from'node:vm';
import{REFLECT_ID_FIRST,REFLECT_ID_LAST}from'./stdlib-ids.js';
import{reflectMethods,reflectSources,reflectIntrinsics,reflectNewIntrinsics,reflectPending,reflectWGSL}from'./stdlib-reflect.js';
import{reflectCases,reflectUnsupportedSources,reflectResumptionSource,reflectResumptionInputs,reflectResumptionExpected}from'./stdlib-reflect-cases.js';
import{toDescriptorSource}from'./object-operation-source.js';

// ---- metadata sanity -------------------------------------------------------
const specOrder=['apply','construct','defineProperty','deleteProperty','get','getOwnPropertyDescriptor','getPrototypeOf','has','isExtensible','preventExtensions','set','setPrototypeOf'];
const specLength={apply:3,construct:2,defineProperty:3,deleteProperty:2,get:2,getOwnPropertyDescriptor:2,getPrototypeOf:1,has:2,isExtensible:1,preventExtensions:1,set:3,setPrototypeOf:2};
assert.deepEqual(reflectMethods.map(m=>m.name),specOrder);
for(const [i,m] of reflectMethods.entries()){
  assert.equal(m.owner,'Reflect');assert.equal(m.kind,'method');assert.equal(m.id,2300+i);assert.equal(m.length,specLength[m.name]);
  assert.equal(m.field,'reflect'+m.name[0].toUpperCase()+m.name.slice(1));assert.equal(m.source,reflectSources[m.field]);
  assert.match(m.source,/^function \w+\(/);assert.match(m.source,/"use strict";/);
  assert.equal(Reflect[m.name].length,m.length,'V8 length '+m.name);
}
for(const [name,id] of Object.entries(reflectNewIntrinsics))assert.ok((id>=REFLECT_ID_FIRST+12&&id<=REFLECT_ID_LAST)||id===2360||id===2361||id===2362,`new intrinsic ${name} id ${id}`);
const ident=/\b__lanes\w+/g;const used=new Set();
for(const source of Object.values(reflectSources))for(const name of source.match(ident)??[]){used.add(name);assert.ok(Object.hasOwn(reflectIntrinsics,name),`undeclared intrinsic ${name}`);}
assert.match(reflectWGSL.objectMethod,/^if\(id==2312u\)\{return boolean\(reflectIsConstructor\(l,original\)\);\}/);
assert.ok(Array.isArray(reflectPending)&&reflectPending.length>0);

// ---- (a) oracle realm ------------------------------------------------------
class OracleUnsupported extends Error{}class OracleResource extends Error{}
const prelude=`"use strict";
const N={gopd:Object.getOwnPropertyDescriptor,define:Object.defineProperty,create:Object.create,hasOwn:Object.hasOwn,ownKeys:Reflect.ownKeys,
  isArray:Array.isArray,isExtensible:Object.isExtensible,preventExtensions:Object.preventExtensions,getPrototypeOf:Object.getPrototypeOf,
  setPrototypeOf:Object.setPrototypeOf,apply:Reflect.apply,construct:Reflect.construct,String:String};
// Host stand-ins (oracle only). Each mirrors the WGSL/guest operation named in stdlib-reflect-notes.md.
// These host stand-ins cover the passive-prototype alternate fixtures below.
// Reentrant/getter/new.target/bound-target cases use independent fixed native
// expectations plus packed parity in check-constructor-resume, then real GPU.
const __lanesBaseConstructNewTarget=function(target,newTarget){const text=Function.prototype.toString.call(target);return /\\[native code\\]/.test(text)||/^class[\\s\\S]*?extends/.test(text)?undefined:newTarget;};
const __lanesPreparedConstruct=function(target,list,newTarget,prototype){return N.construct(target,Array.from({length:list.length},(_,i)=>list[i]),newTarget);};
const __lanesDescriptor=function(){return N.create(null);};                       // 112: fresh null-prototype object
const __lanesToDescriptor=(${toDescriptorSource});                                  // 139: the actual guest helper
const __lanesToPropertyKey=function(v){return N.ownKeys(N.define(N.create(null),v,{value:0}))[0];};  // 900: ToPropertyKey
const __lanesOwnDescriptor=function(o,k){return N.gopd(o,k);};                     // 901 -> 102 descriptorObject()
const __lanesOwnHas=function(o,k){return N.hasOwn(o,k);};                          // 902 -> 107
const __lanesOwnKeys=function(o,b){return N.ownKeys(o);};                          // 140 (b falsy: strings + symbols)
const __lanesDefine=function(o,k,d){N.define(o,k,d);return o;};                    // 110 -> descriptor(): status 4 (TypeError) on every rejection
const __lanesIsArray=function(v){return N.isArray(v);};                            // 201
const __lanesNumber=function(v){return +v;};                                       // 122 ToNumber
const __lanesText=function(v){return N.String(v);};                                // 111 (numbers only here)
const __lanesIsExtensible=function(o){return N.isExtensible(o);};                  // 109
const __lanesPreventExtensions=function(o){N.preventExtensions(o);return o;};      // 108
const __lanesGetPrototypeOf=function(o){return N.getPrototypeOf(o);};              // 1354
const __lanesSetPrototype=function(o,p){return N.setPrototypeOf(o,p);};            // 2362 trusted commit after guest validation
const __lanesReviverDelete=function(o,k){const d=N.gopd(o,k);if(d===undefined)return true;if(!d.configurable)return false;delete o[k];return true;}; // 1860
const __lanesCall=function(f,t){const a=[];for(let i=2;i<arguments.length;i++)a.push(arguments[i]);return N.apply(f,t,a);}; // 113
const __lanesApply=function(f,t,list){const a=[];for(let i=0;i<list.length;i++)a.push(list[i]);return N.apply(f,t,a);};  // 114 applyArguments()
const __lanesLength=function(n){if(n!==n||!(0<n))return 0;if(!(n<17))__oracleResource();return n-n%1;};                 // 115 applyLength()
const __lanesUnsupported=function(){__oracleUnsupported();};                       // 141
const __lanesIsConstructor=function(v){if(typeof v!=="function")return false;try{N.construct(N.String,[],v);return true;}catch(e){return false;}}; // 2312
const helpers={${Object.entries(reflectSources).map(([field,source])=>`${field}:(${source})`).join(',\n')}};
const mock={};
${reflectMethods.map(m=>`{const fn={${m.name}(){return N.apply(helpers.${m.field},this,arguments);}}.${m.name};N.define(fn,"length",{value:${m.length},configurable:true});N.define(mock,"${m.name}",{value:fn,writable:true,enumerable:false,configurable:true});}`).join('\n')}
N.define(mock,"ownKeys",{value:Reflect.ownKeys,writable:true,enumerable:false,configurable:true});
N.define(globalThis,"Reflect",{value:mock,writable:true,enumerable:false,configurable:true});`;
function makeRealm(){
  const state={unsupported:false,resource:false};
  const ctx=vm.createContext({__oracleUnsupported:()=>{state.unsupported=true;throw new OracleUnsupported('status 6');},__oracleResource:()=>{state.resource=true;throw new OracleResource('status 3');}});
  vm.runInContext(prelude,ctx);return{ctx,state};
}
const UNSUPPORTED='<Unsupported status 6>',RESOURCE='<Resource status 3>';
const describeThrow=e=>'<throw '+(e&&e.constructor&&e.constructor.name)+'>';
function runMock(source,input){const{ctx,state}=makeRealm();let value;try{value=new vm.Script('('+source+')').runInContext(ctx)(input);}catch(e){if(e instanceof OracleUnsupported)return UNSUPPORTED;if(e instanceof OracleResource)return RESOURCE;value=describeThrow(e);}if(state.unsupported)return UNSUPPORTED;if(state.resource)return RESOURCE;return value;}
function runNative(source,input){try{return new vm.Script('('+source+')').runInNewContext()(input);}catch(e){return describeThrow(e);}}
const isPrimitiveResult=v=>v===null||['number','boolean','string','undefined'].includes(typeof v);
let exactChecks=0,fixtureChecks=0;const failures=[];
function same(actual,expected,label){if(Object.is(actual,expected))exactChecks++;else failures.push(`${label}: actual ${String(actual)} vs expected ${String(expected)}`);}
const features=new Set();const perMethod=Object.fromEntries(specOrder.map(n=>[n,0]));
for(const item of reflectCases){
  assert.ok(!features.has(item.feature),'duplicate feature '+item.feature);features.add(item.feature);
  assert.match(item.source,/^function f\(x\)\{/);assert.ok(item.inputs.length>0);
  for(const name of specOrder)if(item.source.includes('Reflect.'+name+'('))perMethod[name]++;
  for(const input of item.inputs){
    const expected=runNative(item.source,input),actual=runMock(item.source,input);
    assert.ok(isPrimitiveResult(expected),`${item.feature}: non-primitive result`);
    assert.ok(!String(expected).startsWith('<throw'),`${item.feature}(${String(input)}): native threw ${expected}`);
    same(actual,expected,`${item.feature}(${String(input)})`);fixtureChecks++;
  }
}
for(const [name,count] of Object.entries(perMethod))assert.ok(count>=3,`too few cases for Reflect.${name}: ${count}`);
let unsupportedChecks=0;
for(const item of reflectUnsupportedSources)for(const input of item.inputs){
  const native=runNative(item.source,input);assert.ok(!String(native).startsWith('<throw'),`${item.feature}: native threw`);
  same(runMock(item.source,input),item.status===6?UNSUPPORTED:RESOURCE,item.feature);unsupportedChecks++;
}
for(const input of reflectResumptionInputs){same(runNative(reflectResumptionSource,input),reflectResumptionExpected,'resumption native');same(runMock(reflectResumptionSource,input),reflectResumptionExpected,'resumption mock');}

// Direct boolean-vs-throw probes of the helpers (no fixture wrapper).
let directChecks=0;{
  const{ctx}=makeRealm();const probe=src=>vm.runInContext(src,ctx);
  for(const [src,expected] of [
    ['Reflect.defineProperty(Object.freeze({a:1}),"a",{value:2})',false],['Reflect.set(Object.freeze({a:1}),"a",2)',false],
    ['Reflect.deleteProperty(Object.freeze({a:1}),"a")',false],['(()=>{const a={},b=Object.create(a);return Reflect.setPrototypeOf(a,b);})()',false],
    ['Reflect.preventExtensions({})',true],['Reflect.setPrototypeOf(Object.preventExtensions({}),null)',false],
  ]){same(probe(src),expected,'direct '+src);directChecks++;}
}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}

// ---- (b) compile parity ----------------------------------------------------
const nativePath=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const compileNative=source=>JSON.parse(execFileSync(nativePath,[source],{encoding:'utf8'}));
const compileWasm=source=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[source]));
let rawParity=0,packedParity=0,packPending=null;let program=null,privateBuiltins=null;
try{program=await import('./program.js');({privateBuiltins}=await import('./bootstrap.js'));}catch(error){packPending=String(error.message).split('\n')[0];}
const LIMIT={locals:64,refs:64,stack:256,args:16};
for(const m of reflectMethods){
  const n=compileNative(m.source),w=compileWasm(m.source);
  assert.equal(n.error,undefined,m.field+': '+n.error);assert.equal(w.error,undefined,m.field+': '+w.error);
  assert.equal(n.functions.length,1,m.field+' must be flat');
  for(const fn of n.functions)assert.ok(fn.locals<=LIMIT.locals&&fn.refs.length<=LIMIT.refs&&fn.stack<=LIMIT.stack&&fn.args<=LIMIT.args,m.field+' exceeds GPU limits');
  assert.deepEqual(n.functions.map(f=>f.instructions.map(i=>[i.op,i.operand])),w.functions.map(f=>f.instructions.map(i=>[i.op,i.operand])),m.field+' opcode/operand streams');
  // Raw `bytes` embed build-local atom indices (they differ between the native
  // and Wasm builds); everything else, including resolved atom operands, must match.
  const strip=fns=>fns.map(f=>({...f,instructions:f.instructions.map(({bytes,...rest})=>rest)}));
  assert.deepEqual(strip(n.functions),strip(w.functions),m.field+' raw functions (bytes excluded)');rawParity++;
  if(program){
    for(const name of m.source.match(ident)??[])assert.equal(privateBuiltins[name],reflectIntrinsics[name],`privateBuiltins.${name}`);
    for(const raw of [n,w])raw.functions[0].intrinsicRoot=true;
    const a=program.packProgram(n,program.entrySource(m.source)),b=program.packProgram(w,program.entrySource(m.source));
    assert.deepEqual(a.code,b.code);assert.deepEqual(a.image,b.image);packedParity++;
  }
}

// ---- (c) fixtures compile natively ----------------------------------------
let nativeFixtureCompiles=0,packedFixtures=0;
for(const source of [...reflectCases.map(i=>i.source),...reflectUnsupportedSources.map(i=>i.source),reflectResumptionSource]){
  const raw=compileNative(source);assert.equal(raw.error,undefined,source+': '+raw.error);nativeFixtureCompiles++;
  if(program){program.packProgram(raw,program.entrySource(source));packedFixtures++;}
}
console.log(JSON.stringify({cases:reflectCases.length,fixtureChecks,exactChecks,unsupportedChecks,directChecks,perMethod,
  intrinsicsUsed:[...used].sort(),newIntrinsics:reflectNewIntrinsics,rawParity,packedParity,packPending,nativeFixtureCompiles,packedFixtures,gpuChecks:false}));
