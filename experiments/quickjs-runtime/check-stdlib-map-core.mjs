// Host differential tests are test oracles only, never a runtime fallback.
// Worker 1 (Map constructor/get/set/has): (a) guest helper sources executed by
// Node against the collection host model, compared with native V8 Map;
// (b) helper compile parity native vs Wasm compiler (packProgram with
// intrinsicRoot); (c) every fixture compiles with the native compiler.
import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';import vm from'node:vm';
import{createCollectionHostModel,instantiateHelper}from'./stdlib-collections-host-model.js';
import{MAP_IDS,collectionIntrinsics}from'./stdlib-ids.js';
import{mapConstructSource,mapConstructEntry,mapCoreSources,mapCoreMethods,mapCoreIntrinsics,mapCorePending}from'./stdlib-map-core.js';
import{mapCoreCases,mapCoreUnsupportedSources,mapCoreResumptionSource,mapCoreResumptionInputs,mapCoreResumptionExpected}from'./stdlib-map-core-cases.js';
import{packProgram,entrySource}from'./program.js';import{privateBuiltins}from'./bootstrap.js';

// ---- metadata sanity -------------------------------------------------------
assert.equal(mapConstructEntry.id,MAP_IDS.construct);assert.equal(mapConstructEntry.field,'mapConstruct');
const expectMeta={get:[MAP_IDS.get,1,'mapGet'],set:[MAP_IDS.set,2,'mapSet'],has:[MAP_IDS.has,1,'mapHas']};
for(const m of mapCoreMethods){assert.equal(m.owner,'Map.prototype');assert.deepEqual([m.id,m.length,m.field],expectMeta[m.name]);assert.equal(m.source,mapCoreSources[m.field]);}
for(const [name,id] of Object.entries(mapCoreIntrinsics))assert.equal(privateBuiltins[name],id,`intrinsic ${name}`);
const ident=/\b__lanes\w+/g;for(const source of Object.values(mapCoreSources))for(const name of source.match(ident))assert.ok(Object.hasOwn(mapCoreIntrinsics,name),`undeclared intrinsic ${name}`);
assert.ok(Array.isArray(mapCorePending));

// ---- (a) oracle realm ------------------------------------------------------
const FOR_OF='for (const entry of iterable)';
assert.equal(mapConstructSource.split(FOR_OF).length,2,'constructor for-of shape');
// Models only the guest language-iteration guard (phase4-iteration.js kind 1/2
// fast path, everything else status 6). The helper body is otherwise unchanged.
const oracleConstructSource=mapConstructSource.replace(FOR_OF,'for (const entry of __oracleIterate(iterable))');
assert.ok(mapConstructSource.includes('__lanesIterationKind(iterable) === 0'),'constructor pre-check present');
// Host model of existing builtin 1273 (phase4-iteration.js), evaluated inside
// the realm so Array.prototype/String.prototype are the realm's: 4 null/undefined,
// 2 primitive string or String wrapper whose chain reaches String.prototype before
// Array.prototype, 1 Array exotic whose chain reaches Array.prototype before
// String.prototype or an arguments object, 0 otherwise.
const iterationKindSource=`function __lanesIterationKind(v){
  if(v===null||v===undefined)return 4;
  if(typeof v==="string")return 2;
  if(typeof v!=="object")return 0;
  const first=()=>{for(let p=Object.getPrototypeOf(v);p!==null;p=Object.getPrototypeOf(p)){if(p===Array.prototype)return 1;if(p===String.prototype)return 2;}return 0;};
  const tag=Object.prototype.toString.call(v);
  if(Array.isArray(v))return first()===1?1:0;
  if(tag==="[object Arguments]")return 1;
  if(tag==="[object String]"){try{String.prototype.valueOf.call(v);}catch(e){return 0;}return first()===2?2:0;}
  return 0;
}`;
const realmPrelude=`"use strict";
const __lanesIterationKind=(${iterationKindSource});
const __oracleIterate=function(v){
  const kind=__lanesIterationKind(v);
  if(kind===4)throw new TypeError("not iterable");
  if(kind===1||kind===2)return v;
  __oracleUnsupported("iteration: generic iterator protocol pending");
};
const mapConstruct=(${oracleConstructSource});
const helpers={mapGet:(${mapCoreSources.mapGet}),mapSet:(${mapCoreSources.mapSet}),mapHas:(${mapCoreSources.mapHas})};
const proto=Object.create(Object.prototype);
__setMapPrototype(proto);
const Map=function Map(){
  if(new.target===undefined)throw new TypeError("Constructor Map requires 'new'");
  if(new.target!==Map)__oracleUnsupported("subclass NewTarget");
  return mapConstruct(arguments[0]);
};
Object.defineProperty(Map,"prototype",{value:proto,writable:false,enumerable:false,configurable:false});
const methods={get(key){return helpers.mapGet.call(this,key);},set(key,value){return helpers.mapSet.call(this,key,value);},has(key){return helpers.mapHas.call(this,key);},
  // ORACLE ONLY (owned by another worker): forEach and @@toStringTag for fixtures marked requires.
  forEach(callback){if(__lanesCollectionBrand(this)!==1)throw new TypeError("forEach");if(typeof callback!=="function")throw new TypeError("callback");const thisArg=arguments[1];const it=__lanesCollectionIterator(this,2);while(__lanesCollectionStep(it))__lanesCall(callback,thisArg,__lanesCollectionIterValue(it),__lanesCollectionIterKey(it),this);}};
for(const name of ["get","set","has","forEach"])Object.defineProperty(proto,name,{value:methods[name],writable:true,enumerable:false,configurable:true});
Object.defineProperty(proto,"constructor",{value:Map,writable:true,enumerable:false,configurable:true});
// ORACLE ONLY: Map.prototype[@@iterator] belongs to the iterator worker; a callable
// stand-in so the constructor pre-check passes and the for-of guard decides (status 6).
Object.defineProperty(proto,Symbol.iterator,{value:function entries(){__oracleUnsupported("Map iterator called");},writable:true,enumerable:false,configurable:true});
Object.defineProperty(proto,Symbol.toStringTag,{value:"Map",writable:false,enumerable:false,configurable:true});
globalThis.Map=Map;`;
class OracleUnsupported extends Error{}
function makeRealm(){
  const model=createCollectionHostModel();const state={unsupported:null};
  const ctx=vm.createContext({...model.intrinsics,__lanesCall:(f,t,...a)=>Reflect.apply(f,t,a),
    __setMapPrototype:p=>{model.prototypes.mapPrototype=p;},
    __oracleUnsupported:reason=>{state.unsupported??=reason;throw new OracleUnsupported(reason);}});
  vm.runInContext(realmPrelude,ctx);return{ctx,state};
}
const UNSUPPORTED='<Unsupported status 6>';
function runMock(source,input){const{ctx,state}=makeRealm();let value;try{value=new vm.Script('('+source+')').runInContext(ctx)(input);}catch(e){if(e instanceof OracleUnsupported)return UNSUPPORTED;if(e&&e.message&&/internal error/.test(e.message))throw e;value='<throw '+(e&&e.constructor&&e.constructor.name)+'>';}return state.unsupported?UNSUPPORTED:value;}
function runNative(source,input){try{return new vm.Script('('+source+')').runInNewContext()(input);}catch(e){return '<throw '+(e&&e.constructor&&e.constructor.name)+'>';}}
const isPrimitiveResult=v=>v===null||['number','boolean','string','undefined'].includes(typeof v);
let exactChecks=0,fixtureChecks=0,requiresOracleOnly=0;const failures=[];
function same(actual,expected,label){if(Object.is(actual,expected))exactChecks++;else failures.push(`${label}: actual ${String(actual)} vs expected ${String(expected)}`);}
const features=new Set();
for(const item of mapCoreCases){
  assert.ok(!features.has(item.feature),'duplicate feature '+item.feature);features.add(item.feature);
  assert.match(item.source,/^function \w+\(\w+\)\{/);
  if(item.requires)requiresOracleOnly++;
  for(const [i,input] of item.inputs.entries()){
    const expected=runNative(item.source,input),actual=runMock(item.source,input);
    assert.ok(isPrimitiveResult(expected),`${item.feature}: non-primitive result`);
    assert.ok(!String(expected).startsWith('<throw'),`${item.feature}: native threw ${expected}`);
    if(item.expected)same(item.expected[i],expected,item.feature+' expected');
    same(actual,expected,`${item.feature}(${String(input)})`);fixtureChecks++;
  }
}
let unsupportedChecks=0;
for(const item of mapCoreUnsupportedSources)for(const input of item.inputs){
  const native=runNative(item.source,input);assert.ok(isPrimitiveResult(native)&&!String(native).startsWith('<throw'),item.feature+' native');
  same(runMock(item.source,input),UNSUPPORTED,item.feature+' unsupported');unsupportedChecks++;}
for(const input of mapCoreResumptionInputs){same(runNative(mapCoreResumptionSource,input),mapCoreResumptionExpected,'resumption native');same(runMock(mapCoreResumptionSource,input),mapCoreResumptionExpected,'resumption mock');}

// Randomized SameValueZero differential directly against the helpers (host realm).
const model=createCollectionHostModel();const hostIterationKind=Function('return ('+iterationKindSource+')')();const hostBindings={...model.intrinsics,__lanesCall:(f,t,...a)=>Reflect.apply(f,t,a),__lanesIterationKind:hostIterationKind};
const H=Object.fromEntries(Object.entries(mapCoreSources).filter(([k])=>k!=='mapConstruct').map(([k,s])=>[k,instantiateHelper(s,hostBindings)]));
H.mapConstruct=instantiateHelper(mapConstructSource,hostBindings);
model.prototypes.mapPrototype={get:H.mapGet,set:H.mapSet,has:H.mapHas};
const objA={},objB={},fnA=function(){},symA=Symbol('a'),symB=Symbol('a');
const pool=[0,-0,NaN,-NaN,1,-1,0.1,Infinity,-Infinity,'','0','-0','NaN','a','A',true,false,null,undefined,0n,1n,-1n,2n**64n,2n**64n+0n,objA,objB,fnA,symA,symB,Symbol.iterator,[],'1'];
let seed=0x2201;const rnd=n=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)%n;};
let randomChecks=0;
for(let round=0;round<200;round++){
  const native=new Map(),mock=H.mapConstruct(undefined);
  for(let op=0;op<60;op++){const k=pool[rnd(pool.length)],v=rnd(1000);
    switch(rnd(3)){
      case 0:assert.equal(H.mapSet.call(mock,k,v),mock);native.set(k,v);break;
      case 1:same(H.mapGet.call(mock,k),native.get(k),'random get');randomChecks++;break;
      default:same(H.mapHas.call(mock,k),native.has(k),'random has');randomChecks++;}}
  // Final insertion order and stored keys (−0 normalized) match native.
  const it=model.intrinsics.__lanesCollectionIterator(mock,2);const order=[];while(model.intrinsics.__lanesCollectionStep(it))order.push([model.intrinsics.__lanesCollectionIterKey(it),model.intrinsics.__lanesCollectionIterValue(it)]);
  const nat=[...native];assert.equal(order.length,nat.length);for(let i=0;i<nat.length;i++){same(order[i][0],nat[i][0],'order key');same(order[i][1],nat[i][1],'order value');randomChecks++;}
}
// Constructor from pairs in the host realm, plus brand errors are TypeErrors.
{const m=H.mapConstruct([[-0,1],[NaN,2],[1n,3]]);same(H.mapGet.call(m,0),1,'ctor -0');same(H.mapGet.call(m,NaN),2,'ctor NaN');same(H.mapGet.call(m,1n),3,'ctor bigint');
 for(const f of [H.mapGet,H.mapSet,H.mapHas])for(const r of [{},null,undefined,1,'s',model.prototypes.mapPrototype])assert.throws(()=>f.call(r,1,2),TypeError);
 assert.throws(()=>H.mapConstruct([1]),TypeError);assert.throws(()=>H.mapConstruct([,[1,2]]),TypeError);exactChecks+=3;
 // Pre-check (temporary until the generic protocol): kind 0 without a callable @@iterator is a TypeError.
 for(const v of [5,true,Symbol(),{},{[Symbol.iterator]:1},{[Symbol.iterator]:null},function(){},Object.create(null)]){assert.throws(()=>H.mapConstruct(v),TypeError);exactChecks++;}
 for(const [v,k] of [[null,4],[undefined,4],['',2],['ab',2],[new String('s'),2],[[],1],[[1],1],[(function(){return arguments;})(),1],[{},0],[5,0],[true,0],[Symbol(),0],[new Map(),0],[Object.create(Array.prototype),0],[Object.setPrototypeOf([],null),0],[Object.setPrototypeOf(new String(''),Array.prototype),0],[{[Symbol.toStringTag]:'String'},0],[function(){},0]]){same(hostIterationKind(v),k,'iterationKind '+String(k));}
}

// ---- (b) helper compile parity -------------------------------------------
const nativePath=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const compileNative=source=>JSON.parse(execFileSync(nativePath,[source],{encoding:'utf8'}));
let helperParity=0;const helperSizes={};
for(const [field,source] of Object.entries(mapCoreSources)){
  const native=compileNative(source),raw=JSON.parse(wasm.ccall('lanes_compile','string',['string'],[source]));
  assert.ok(!native.error,field+': '+native.error);
  for(const code of [raw,native])code.functions[0].intrinsicRoot=true;
  const a=packProgram(raw,entrySource(source)),b=packProgram(native,entrySource(source));
  assert.deepEqual(a.code,b.code);assert.deepEqual(a.image,b.image);helperParity++;
  helperSizes[field]=native.functions.reduce((n,f)=>n+f.instructions.length,0);
}

// ---- (c) fixtures compile -------------------------------------------------
let nativeFixtureCompiles=0,packedFixtures=0;const integrationPendingReasons=new Set();
for(const source of [...mapCoreCases.map(i=>i.source),...mapCoreUnsupportedSources.map(i=>i.source),mapCoreResumptionSource]){
  const raw=compileNative(source);assert.ok(!raw.error,'compile error: '+raw.error+' in '+source);nativeFixtureCompiles++;
  try{packProgram(raw,entrySource(source));packedFixtures++;}catch(error){integrationPendingReasons.add(error.message);}
}

const summary={exactChecks,fixtureCases:mapCoreCases.length,fixtureChecks,requiresOracleOnly,unsupportedChecks,randomChecks,helperParity,helperSizes,nativeFixtureCompiles,packedFixtures,
  integrationPending:integrationPendingReasons.size>0,integrationPendingReasons:[...integrationPendingReasons],failures,gpuChecks:false};
console.log(JSON.stringify(summary,null,1));
if(failures.length)process.exitCode=1;
