import {objectCopyMetadata} from './object-copy-source.js';
import {fieldListWGSL} from './field-list-wgsl.js';
import {builtinMetadataWGSL} from './builtin-metadata-wgsl.js';
import {shareFinishDispatch} from './shared-finish-dispatch.js';
import {shareCallDispatch} from './shared-call-dispatch.js';
import {asyncFunctionGCWGSL,asyncFunctionWGSLFunctions,asyncFunctionCallWGSL,asyncFunctionEnterWGSL,asyncFunctionClosureWGSL,asyncFunctionInitWGSL,asyncFunctionPropertyWGSL,asyncFunctionDispatchWGSL} from './async-function-source.js';
import {generatorGCWGSL,generatorClosureWGSL,generatorInitWGSL,generatorMetadata} from './generator-source.js';
import {asyncGeneratorGCWGSL,asyncGeneratorClosureWGSL,asyncGeneratorInitWGSL,asyncGeneratorObjectMethodWGSL,asyncGeneratorCallWGSL,asyncGeneratorPropertyWGSL} from './async-generator-source.js';
import {promiseCombinatorsMetadataWGSL,promiseCombinatorsHasOwnLengthWGSL,promiseCombinatorsDispatchWGSL,promiseCombinatorsObjectMethodWGSL,promiseCombinatorsObjectViewWGSL,promiseCombinatorsObjectValueWGSL,promiseCombinatorsConstructWGSL,promiseCombinatorsInitWGSL} from './promise-combinators-source.js';
import {promiseThenWGSLFunctions,promiseThenObjectMethodWGSL,promiseThenDispatchWGSL,promiseThenPropertyWGSL,promiseThenInitWGSL} from './promise-then-source.js';
import { promiseResolveBuiltinFields } from './promise-resolve-source.js';
import { arrayFromMetadata } from './array-from-source.js';
import { phase3BigintPowWGSL, phase3BigintPowDispatchWGSL, phase3BigintPowOpcode } from './phase3-bigint-pow.js';
import { phase3BigintComparisonWGSL, phase3BigintComparisonDispatchWGSL, bigintComparisonOpcodeCases } from './phase3-bigint-comparison.js';
import { phase3BigintWidthMetadata, phase3BigintWidthWGSL, phase3BigintWidthDispatchWGSL } from './phase3-bigint-width.js';
import { phase3BigintConversionWGSL, phase3BigintConversionDispatchWGSL } from './phase3-bigint-conversion.js';
import { phase3BigintConversionMetadata } from './phase3-bigint-conversion-source.js';
import { phase3BigintBitwiseWGSL } from './phase3-bigint-bitwise.js';
import { functionSourceWGSL, functionSourceDispatchWGSL } from './function-source-core.js';
import { phase3BigintOpsWGSL } from './phase3-bigint-ops.js';
import { stringCaseMetadata, stringCaseDispatchWGSL } from './string-case-metadata.js';
import { stringCaseWGSL } from './string-case-wgsl.js';
import { arraySortMetadata } from './array-sort-metadata.js';
import { jsonStringifyMetadata, jsonStringifyNewIntrinsics } from './json-stringify-metadata.js';
import { arrayCopyMetadata } from './array-copy-metadata.js';
import { numberParseMetadata } from './number-parse-metadata.js';
import { jsonPhase5Metadata, jsonPhase5NewIntrinsics, jsonPhase5CodeUnitWGSL } from './json-phase5-metadata.js';
import { arrayPhase5Metadata } from './array-phase5-metadata.js';
import {scriptEntryWGSL,scriptClosureWGSL,scriptDeclarationWGSL} from './script-entry.js';
import { stringPhase5Metadata, stringPhase5Aliases } from './string-phase5-metadata.js';
import { numericPhase5Metadata, numberPhase5Metadata, mathPhase5Metadata, numberPhase5Constants, mathPhase5Constants, numberPhase5Pending, mathPhase5Pending } from './math-phase5-metadata.js';
import { stringExtractMetadata } from './string-extract-source.js';
import { propertyKeyMethodFields } from './property-key-conversion-source.js';
import { stringSearchMetadata } from './string-search-metadata.js';
import { arrayMethods, arrayBuiltins } from './array-source.js';
import { arrayBuiltinLengths } from './array-builtin-metadata.js';
import { numberWGSL } from '../../src/vm/number.js';
import { LIMITS as L, OP, FIELDS as F, objectStaticPlaceholders, numberWords } from './program.js';
import {asyncIterationShaderFunctions,asyncIterationObjectMethodWGSL,asyncIterationGCWGSL,asyncIterationInitWGSL,asyncIterationPropertyWGSL,asyncIterationDispatchWGSL} from './async-iteration-source.js';
import {promiseJobWGSLFunctions,promiseJobGCWGSL,promiseJobInitWGSL,promiseJobCallWGSL,promiseJobDispatchWGSL,promiseJobContinuationWGSL,promiseJobCompleteWGSL,promiseJobMainWGSL} from './promise-jobs-source.js';
import {promiseCoreWGSLFunctions,promiseCoreObjectMethodWGSL,promiseCoreCallFieldsWGSL,promiseCoreConstructWGSL,promiseCoreObjectViewWGSL,promiseCoreObjectValueWGSL,promiseCoreGCWGSL,promiseCoreInitWGSL} from './promise-core-source.js';
import { FIXED_INIT_LAST, FIXED_RESERVED_FIRST, FIXED_RESERVED_LAST, FIXED_RESERVED_COUNT, PHASE4_FIXED_ROOTS, TEMPLATE_REGISTRY_NODE, ITERATOR_PROTO_NODE, ARRAY_ITERATOR_PROTO_NODE, STRING_ITERATOR_PROTO_NODE } from './phase4-fixed-nodes.js';
import { phase4BuiltinFields, phase4WGSLFunctions, phase4WGSLCases, phase4Continuations, phase4ObjectMethods, phase4MarkWGSL } from './phase4-registry.js';
import { phase3EarlyWGSL, phase3ArithWGSL, phase3IdentityWGSL, phase3EnumWGSL, phase3SymbolStructWGSL, phase3WellKnownNames, PHASE3_NODES } from './phase3-values.js';
if (PHASE3_NODES.symbolCtor !== 26 || PHASE3_NODES.symbolRegistry !== 28 || PHASE3_NODES.bigintCtor !== 29 || PHASE3_NODES.iterator !== 34 || PHASE3_NODES.toPrimitive !== 41 || PHASE3_NODES.toStringTag !== 42 || PHASE3_NODES.reflect !== 47 || PHASE3_NODES.lastFixed !== 47) {
  throw new Error('phase 3 fixed-node map drifted');
}
const phase3ToPrimitiveNode = 31 + phase3WellKnownNames.indexOf('toPrimitive');
const phase3ToStringTagNode = 31 + phase3WellKnownNames.indexOf('toStringTag');
const phase3HasInstanceNode = 31 + phase3WellKnownNames.indexOf('hasInstance');
const phase4Context = Object.freeze({ OP, F, L });
const phase4Cases = phase4WGSLCases(phase4Context);
for (const name of Object.keys(phase4Cases)) if (!(name in OP)) throw new Error(`Phase 4 WGSL case for unknown opcode ${name}`);
const phase4Finish = phase4Continuations(phase4Context);
// Text scanners (check-language-scope.mjs) only see literal cases('...') calls.
export const phase4ShaderOps = Object.freeze(Object.keys(phase4Cases));
import { boxingBuiltins as B, boxingIntrinsics as BI, stringPrototypeMethods, numberPrototypeMethods, booleanPrototypeMethods, stringPrototypeUnsupported, numberPrototypeUnsupported } from './boxing-metadata.js';
import { stdlibFunctionMetadata, stdlibConstructors, stdlibWGSLFunctions, stdlibMarkWGSL, stdlibObjectMethodWGSL, stdlibInitWGSL, stdlibConstructWGSL, stdlibCallWithoutNewWGSL, stdlibObjectView, stdlibImplementedNames } from './stdlib-registry.js';
const phase5Methods=[...objectCopyMetadata,...phase3BigintWidthMetadata,...arrayFromMetadata,...stringCaseMetadata,...arraySortMetadata,...jsonStringifyMetadata,...arrayCopyMetadata,...numberParseMetadata,...jsonPhase5Metadata,...arrayPhase5Metadata,...stringPhase5Metadata,...numericPhase5Metadata,...stdlibFunctionMetadata];
// Names still unimplemented on Math / Reflect after the standard-library wave.
const mathGapNames=mathPhase5Pending.filter(name=>!stdlibImplementedNames('Math').includes(name));
const reflectGapNames=['apply','construct','defineProperty','deleteProperty','get','getOwnPropertyDescriptor','getPrototypeOf','has','isExtensible','preventExtensions','set','setPrototypeOf'].filter(name=>!stdlibImplementedNames('Reflect').includes(name));
const boxingMethods = [...stringPrototypeMethods, ...numberPrototypeMethods, ...booleanPrototypeMethods];
// prototypeGap scans each unsupported-name block as one contiguous FIELDS range.
const fieldRange = names => {
  const first = F[names[0]], last = F[names[names.length - 1]];
  if (last - first + 1 !== names.length || names.some((name, i) => F[name] !== first + i)) throw new Error('Unsupported prototype names must be contiguous FIELDS');
  return [first, last];
};
const numberGap = fieldRange(numberPrototypeUnsupported);
export const SNAPSHOT_WORDS = 264;
export const STATE_WORDS = 16 + L.frames * 8 + L.stack * 4 + L.heap * 8 + L.heap;
const cases = (names, body) => `case ${names.split(' ').map(n => `${OP[n]}u`).join(', ')}: { ${body} }`;
const matchesText = text => `(s.y==${text.length}u && ${[...text].map((c,i) => `unit(l,s,${i}u)==${c.charCodeAt(0)}u`).join(' && ')})`;
const unsharedShader = `${numberWGSL}
alias V = vec4<u32>;
// Kind-1 cells use bit 1 for immutable global captures; GC only clears bit 0.
const IMMUTABLE_GLOBAL_CELL: u32 = 2u;
struct Node { value: V, next: u32, key: u32, kind: u32, marked: u32 }
struct Frame { pc: u32, env: u32, base: u32, tail: u32, receiver: V }
struct State {
  pc: u32, env: u32, depth: u32, sp: u32,
  status: u32, steps: u32, freeHead: u32, freeCount: u32,
  result: V, collections: u32, ready: u32, queueTop: u32, pad: u32,
  frames: array<Frame, ${L.frames}>, stack: array<V, ${L.stack}>,
  heap: array<Node, ${L.heap}>, queue: array<u32, ${L.heap}>
}
struct Snapshot { status: u32, steps: u32, collections: u32, pad: u32, value: V, chars: array<u32,256> }
struct Params { count: u32, budget: u32, instructions: u32, padding: u32 }
${phase3SymbolStructWGSL}
@group(0) @binding(0) var<storage, read> code: array<V>;
@group(0) @binding(1) var<storage, read> image: array<V>;
@group(0) @binding(2) var<storage, read_write> states: array<State>;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var<storage, read_write> output: array<Snapshot>;
fn undef() -> V { return V(0u, 0x7ff80000u, 3u, 0u); }
fn num(n: Pair) -> V { return V(n, 0u, 0u); }
fn boolean(b: bool) -> V { return V(0u, select(0u,0x3ff00000u,b),1u,0u); }
fn truth(v: V) -> bool { return v.z == 4u || v.z == 5u || v.z==11u || v.z==17u || (v.z==18u && v.y!=0u) || (v.z == 7u && v.y > 0u) || (v.z < 2u && !zero(v.xy) && !nan(v.xy)); }
fn unit(l:u32,v:V,index:u32)->u32 {
  if(v.w!=0u){return image[v.x+index].x;}
  var id=v.x;for(var i=0u;i<index/4u;i++){id=states[l].heap[id].next;}
  return states[l].heap[id].value[index%4u];
}
${phase3EarlyWGSL}
${phase3BigintComparisonWGSL}
fn keyText(l:u32,key:u32)->V {
  if(phase3SymbolKey(key)){states[l].status=2u;return undef();}
  if((key&0xe0000000u)==0x40000000u){let id=key&0x1fffffffu;return V(id,states[l].heap[id].key,7u,0u);}
  return image[key];
}
fn sameKey(l:u32,a:u32,b:u32)->bool {
  if(a==b){return true;}
  if(phase3SymbolKey(a)||phase3SymbolKey(b)){return false;}
  if(((a|b)&0x80000000u)!=0u){return false;}
  return textEqual(l,keyText(l,a),keyText(l,b));
}
fn textEqual(l: u32, a: V, b: V) -> bool {
  if (a.y != b.y) { return false; }
  for (var j = 0u; j < a.y; j++) {
    if(unit(l,a,j)!=unit(l,b,j)){return false;}
  }
  return true;
}
fn equal(l: u32, a: V, b: V) -> bool {
  if (a.z != b.z) { return false; }
  if (a.z < 2u) { return equalNumber(a.xy,b.xy); }
  if (a.z == 7u) { return textEqual(l,a,b); }
  if (a.z == 4u || a.z == 5u || a.z==11u) { return a.x == b.x; }
  if (a.z == 17u) { return symbol_same_value(l, a, b); }
  if (a.z == 18u) { return bigint_same(l, a, b); }
  return true;
}
fn push(l: u32, v: V) {
  if (states[l].sp >= ${L.stack}u) { states[l].status = 3u; return; }
  states[l].stack[states[l].sp] = v; states[l].sp++;
}
fn pop(l: u32) -> V {
  if (states[l].sp <= states[l].frames[states[l].depth].base) { states[l].status = 2u; return undef(); }
  states[l].sp--; return states[l].stack[states[l].sp];
}
fn peek(l: u32) -> V {
  if (states[l].sp == 0u) { states[l].status = 2u; return undef(); }
  return states[l].stack[states[l].sp-1u];
}
fn alloc(l: u32, kind: u32, value: V, key: u32, next: u32) -> u32 {
  let id = states[l].freeHead;
  if (id == 0u) { states[l].status = 3u; return 0u; }
  states[l].freeHead = states[l].heap[id].next; states[l].freeCount--;
  states[l].heap[id] = Node(value,next,key,kind,select(0u,14u,kind==3u || kind==9u)); return id;
}
${phase3ArithWGSL}
${phase3BigintPowWGSL}
${phase3BigintBitwiseWGSL}
${phase3BigintOpsWGSL}
${phase3BigintConversionWGSL}
${phase3BigintWidthWGSL}
fn mark(l: u32, id: u32) {
  if (id == 0u || (states[l].heap[id].marked&1u) != 0u) { return; }
  states[l].heap[id].marked |= 1u;
  states[l].queue[states[l].queueTop] = id; states[l].queueTop++;
}
fn markValue(l: u32, v: V) { if (v.z == 4u || v.z == 5u || (v.z==7u && v.w==0u) || v.z==17u || v.z==18u) { mark(l,v.x); } }
fn collect(l: u32) {
  // Fixed-node roots (phase4-fixed-nodes.js): 1..${FIXED_INIT_LAST}, the assigned phase-4 nodes, and every
  // initialized (kind != 0) reserved node ${FIXED_RESERVED_FIRST}..${FIXED_RESERVED_LAST}, so an in-place fixed node is never left unrooted.
  states[l].queueTop = 0u;for(var root=1u;root<=${FIXED_INIT_LAST}u;root++){mark(l,root);}${PHASE4_FIXED_ROOTS.map(n=>`mark(l,${n}u);`).join('')}
  for(var root=${FIXED_RESERVED_FIRST}u;root<=${FIXED_RESERVED_LAST}u;root++){if(states[l].heap[root].kind!=0u){mark(l,root);}}
  mark(l,states[l].env); markValue(l,states[l].result);
  for (var i=0u;i<=states[l].depth;i++) { mark(l,states[l].frames[i].env); markValue(l,states[l].frames[i].receiver); }
  for (var i=0u;i<states[l].sp;i++) { markValue(l,states[l].stack[i]); }
  for (var i=0u;i<states[l].queueTop;i++) {
    let node = states[l].heap[states[l].queue[i]];
    mark(l,node.next);
    if (node.kind == 1u || node.kind == 3u || node.kind==13u) { markValue(l,node.value); }
    if (node.kind == 4u || node.kind == 6u || node.kind==15u) { mark(l,node.value.x); }
    if (node.kind == 2u || node.kind == 7u || node.kind==8u || node.kind==14u || node.kind==16u) { mark(l,node.value.x); }
    if(node.kind==16u){mark(l,node.value.y);}
    if(node.kind==32u){mark(l,node.value.x);}
    if(node.kind==2u&&(node.value.z&0x80000000u)!=0u){mark(l,node.value.z&0x7fffffffu);}
    if (node.kind == 5u || node.kind==12u) { mark(l,node.value.y); }
    if(node.kind==5u){mark(l,node.value.z);}
    if(node.kind==4u){markValue(l,V(node.value.z,0u,node.value.w,0u));}
    // Private elements (phase4-class-elements.js): holder chain, field value
    // and private name, brand home object.
    if(node.kind==2u||node.kind==8u){mark(l,node.value.y);}
    if(node.kind==34u){markValue(l,node.value);mark(l,node.key);}
    ${generatorGCWGSL}
    ${asyncIterationGCWGSL}
    ${asyncGeneratorGCWGSL}
    ${asyncFunctionGCWGSL}
    ${promiseJobGCWGSL}
    if(node.kind==35u){mark(l,node.key);}
    ${promiseCoreGCWGSL}
    if(node.kind==12u){markValue(l,V(node.value.x,0u,node.value.z,0u));}
    if(node.kind==9u){if((node.value.x&0x80000000u)==0u){mark(l,node.value.x);}if((node.value.y&0x80000000u)==0u){mark(l,node.value.y);}}
    if(node.kind==17u){if(node.value.y!=0u){mark(l,node.value.y);}if(node.value.z!=0u&&node.value.z!=node.value.y){mark(l,node.value.z);}}
    if(node.kind==18u&&node.value.z!=0u){mark(l,node.value.z);}
    ${phase4MarkWGSL()}
    if ((node.kind==3u || node.kind==9u || node.kind==15u) && (node.key&0xe0000000u)==0x40000000u) {mark(l,node.key&0x1fffffffu);}
    if ((node.kind==3u || node.kind==9u || node.kind==15u) && phase3SymbolKey(node.key)) {mark(l,node.key&0x1fffffffu);}
    // Standard-library collections (stdlib-collections-core.js).${stdlibMarkWGSL}
  }
  collectionCompact(l);
  states[l].freeHead=0u; states[l].freeCount=0u;
  for (var i=${L.heap-1}u;i>0u;i--) {
    // Reserved fixed nodes ${FIXED_RESERVED_FIRST}..${FIXED_RESERVED_LAST} are never swept onto the free list.
    if (i>=${FIXED_RESERVED_FIRST}u && i<=${FIXED_RESERVED_LAST}u) { states[l].heap[i].marked &= ~1u; continue; }
    if ((states[l].heap[i].marked&1u) == 0u) {
      states[l].heap[i].kind=0u; states[l].heap[i].next=states[l].freeHead;
      states[l].freeHead=i; states[l].freeCount++;
    } else { states[l].heap[i].marked &= ~1u; }
  }
  states[l].collections++;
}
fn find(l: u32, head: u32, key: u32) -> u32 {
  var id = states[l].heap[head].next;
  for (var n=0u;n<${L.heap}u && id!=0u && states[l].heap[id].key!=key;n++) { id=states[l].heap[id].next; }
  return id;
}
fn findProperty(l:u32,head:u32,key:u32)->u32 {
  var id=states[l].heap[head].next;
  for(var i=0u;i<${L.heap}u && id!=0u && !sameKey(l,states[l].heap[id].key,key);i++){id=states[l].heap[id].next;}return id;
}
fn makeText(l:u32,a:V,b:V,start:u32,length:u32)->V {
  if(length>256u){states[l].status=3u;return undef();}
  var first=0u;var previous=0u;
  for(var i=0u;i<length;i+=4u){
    var chars=V(0u);
    for(var j=0u;j<4u && i+j<length;j++){
      let index=start+i+j;if(index<a.y){chars[j]=unit(l,a,index);}else{chars[j]=unit(l,b,index-a.y);}
    }
    let id=alloc(l,10u,chars,length,0u);if(first==0u){first=id;}else{states[l].heap[previous].next=id;}previous=id;
  }
  return V(first,length,7u,0u);
}
${phase3IdentityWGSL}
fn cell(l: u32, env: u32, slot: u32, isReference: bool) -> u32 {
  var id: u32;
  if (isReference) { id=find(l,states[l].heap[env].value.x,slot); id=states[l].heap[id].value.x; }
  else { id=find(l,env,slot); }
  if (id==0u) { states[l].status=2u; } return id;
}
fn environment(l: u32, closure: u32, argc:u32) -> u32 {
  let env=alloc(l,4u,V(closure,argc,0u,0u),0u,0u);
  let fnInfo=image[states[l].heap[closure].value.x*2u];let args=max(argc,fnInfo.y);
  for (var i=0u;i<args+fnInfo.z;i++) {
    var slot=i; if (i>=args) { slot=16u+i-args; }
    let c=alloc(l,1u,undef(),slot,states[l].heap[env].next); states[l].heap[env].next=c;
  }
  return env;
}
fn closure(l: u32, f: u32) -> V {
  let id=alloc(l,5u,V(f,0u,0u,0u),0u,0u); let fnInfo=image[f*2u]; let refs=image[f*2u+1u].x;
  ${scriptDeclarationWGSL}
  for (var i=0u;i<(fnInfo.w&0xffffu);i++) {
    let spec=image[refs+i]; var captured=0u;
    // Global-object mode binding (phase4-global.js): no capture cell.
    ${scriptClosureWGSL}
    if(spec.x==7u){continue;}
    if (spec.x==0u) { captured=cell(l,states[l].env,16u+spec.y,false); }
    else if (spec.x==1u) { captured=cell(l,states[l].env,spec.y,false); }
    else if (spec.x==2u) { captured=cell(l,states[l].env,spec.y,true); }
    else if(spec.x==4u){captured=alloc(l,1u,V(spec.y,0u,11u,0u),0u,0u);}
    else if(spec.x==6u){captured=alloc(l,1u,V(spec.y,0u,4u,0u),0u,0u);}
    else if(spec.x==5u){captured=alloc(l,1u,V(spec.y,spec.z,spec.w,0u),0u,0u);states[l].heap[captured].marked|=IMMUTABLE_GLOBAL_CELL;}
    else { captured=alloc(l,1u,V(id,0u,5u,0u),0u,0u); }
    let c=alloc(l,6u,V(captured,0u,0u,0u),i,states[l].heap[id].next); states[l].heap[id].next=c;
  }
  let backing=alloc(l,2u,V(3u,0u,id|0x80000000u,1u),0u,0u);
  states[l].heap[id].value.y=backing;
  let length=alloc(l,3u,num(fromUnsigned(image[f*2u+1u].z)),fieldKey(${F.length}u),0u);
  states[l].heap[length].marked=8u;states[l].heap[backing].next=length;
  let name=alloc(l,3u,image[image[f*2u+1u].w],fieldKey(${F.name}u),length);
  states[l].heap[name].marked=8u;states[l].heap[backing].next=name;
  if((fnInfo.w&0x10000u)!=0u){
    let proto=alloc(l,2u,V(1u,0u,0u,1u),0u,0u);
    let constructor=alloc(l,3u,V(id,0u,5u,0u),fieldKey(${F.constructor}u),0u);
    states[l].heap[constructor].marked=10u;states[l].heap[proto].next=constructor;
    let property=alloc(l,3u,V(proto,0u,4u,0u),fieldKey(${F.prototype}u),states[l].heap[backing].next);
    states[l].heap[property].marked=2u;states[l].heap[backing].next=property;
  }
  ${generatorClosureWGSL({F})}
  ${asyncGeneratorClosureWGSL({F})}
${asyncFunctionClosureWGSL}  return V(id,0u,5u,0u);
}
fn keyOf(l: u32, value: V) -> u32 {
  if (value.z==0u) {
    let n=toBits(value.xy);
    if (n<0x80000000u && equalNumber(fromUnsigned(n),value.xy)) { return n|0x80000000u; }
  }
  if (value.z==7u) {
    if (value.y>0u && value.y<=10u && (value.y==1u || unit(l,value,0u)!=48u)) {
      var n=0u; var valid=true;
      for (var i=0u;i<value.y && valid;i++) {
        let c=unit(l,value,i);
        valid=!(c<48u || c>57u || n>429496729u || (n==429496729u && c>53u));
        if(valid){n=n*10u+c-48u;}
      }
      if (valid && n<0x80000000u) { return n|0x80000000u; }
    }
    if(value.w==0u){return value.x|0x40000000u;}return value.w;
  }
  if (value.z==17u) {
    if (value.x!=0u && states[l].heap[value.x].kind==17u) { return 0x60000000u|value.x; }
    states[l].status=2u; return 0u;
  }
  states[l].status=6u; return 0u;
}
// Array indices include canonical decimal strings through 2^32-2. 2^32-1
// is the sentinel and remains an ordinary named property. No allocation here:
// dynamic string keys keep their existing markKey/GC ownership.
fn arrayIndex(l:u32,key:u32)->u32 {
  if((key&0x80000000u)!=0u){return key&0x7fffffffu;}
  if(phase3SymbolKey(key)){return 0xffffffffu;}
  let text=keyText(l,key);
  if(text.y==0u||text.y>10u){return 0xffffffffu;}
  if(text.y>1u&&unit(l,text,0u)==48u){return 0xffffffffu;}
  var index=0u;
  for(var i=0u;i<text.y;i++){
    let digit=unit(l,text,i);
    if(digit<48u||digit>57u||index>429496729u||(index==429496729u&&digit>52u)){return 0xffffffffu;}
    index=index*10u+digit-48u;
  }
  return index;
}
fn lengthKey(l: u32, key: u32) -> bool {
  if ((key&0x80000000u)!=0u || phase3SymbolKey(key)) { return false; }
  let s=keyText(l,key);
  return ${matchesText('length')};
}
fn inheritedBuiltin(l:u32,key:u32,kind:u32)->bool {
  if((key&0x80000000u)!=0u || kind==0u){return false;}
  for(var i=0u;i<image[params.padding+1u].z;i++) {
    let item=image[params.padding+2u+i];
    if(item.y<=kind && sameKey(l,key,item.x)){return true;}
  }
  return false;
}
fn fieldKey(index:u32)->u32 {return image[image[params.padding+1u].w+index].x;}
fn field(l:u32,key:u32,index:u32)->bool {return sameKey(l,key,fieldKey(index));}
fn sameValue(l:u32,a:V,b:V)->bool {
  if(a.z==0u && b.z==0u){if(nan(a.xy)&&nan(b.xy)){return true;}return all(a.xy==b.xy);}
  return equal(l,a,b);
}
fn objectView(l:u32,v:V)->V {
  if(v.z==11u&&v.x==1101u){return V(80u,0u,4u,0u);}
  if(v.z==11u&&v.x==1103u){return V(81u,0u,4u,0u);}
  if(v.z==11u&&v.x==2460u){return V(82u,0u,4u,0u);}
  if(v.z==11u&&v.x==2461u){return V(83u,0u,4u,0u);}
  if(v.z==11u&&v.x==2463u){return V(84u,0u,4u,0u);}
  if(v.z==11u&&v.x==401u){return V(85u,0u,4u,0u);}
  ${promiseCombinatorsObjectViewWGSL()}
  ${promiseCoreObjectViewWGSL}

  if(v.z==5u){return V(states[l].heap[v.x].value.y,0u,4u,0u);}
  if(v.z==11u&&v.x==122u){return V(24u,0u,4u,0u);}
  if(v.z==11u&&v.x==100u){return V(19u,0u,4u,0u);}
  if(v.z==11u&&v.x==200u){return V(18u,0u,4u,0u);}
  if(v.z==11u&&v.x==400u){return V(3u,0u,4u,0u);}
  if(v.z==11u&&v.x>=600u&&v.x<=606u){return V(11u+v.x-600u,0u,4u,0u);}
  if(v.z==11u&&v.x==1000u){return V(26u,0u,4u,0u);}if(v.z==11u&&v.x==1150u){return V(29u,0u,4u,0u);}
  ${stdlibObjectView.map(([id,node])=>`if(v.z==11u&&v.x==${id}u){return V(${node}u,0u,4u,0u);}`).join('')}return v;
}
fn objectValue(l:u32,id:u32)->V {
  if(id==80u){return V(1101u,0u,11u,0u);}
  if(id==81u){return V(1103u,0u,11u,0u);}
  if(id==82u){return V(2460u,0u,11u,0u);}
  if(id==83u){return V(2461u,0u,11u,0u);}
  if(id==84u){return V(2463u,0u,11u,0u);}
  if(id==85u){return V(401u,0u,11u,0u);}
  ${promiseCombinatorsObjectValueWGSL()}
  ${promiseCoreObjectValueWGSL}

  if(id==0u){return V(0u,0u,2u,0u);}
  if(id==24u){return V(122u,0u,11u,0u);}
  if(id==19u){return V(100u,0u,11u,0u);}
  if(id==18u){return V(200u,0u,11u,0u);}
  if(id==3u){return V(400u,0u,11u,0u);}
  if(id>=11u&&id<=17u){return V(600u+id-11u,0u,11u,0u);}
  if(id==26u){return V(1000u,0u,11u,0u);}
  if(id==29u){return V(1150u,0u,11u,0u);}
  ${stdlibObjectView.map(([id,node])=>`if(id==${node}u){return V(${id}u,0u,11u,0u);}`).join('')}
  let owner=states[l].heap[id].value.z;
  if(states[l].heap[id].kind==2u&&(owner&0x80000000u)!=0u){return V(owner&0x7fffffffu,0u,5u,0u);}
  return V(id,0u,4u,0u);
}
// Primitive wrappers are kind 16: value=(prototype, holder, 0, extensible) and
// the kind-13 holder stores the primitive. Nodes 20-22 are String.prototype,
// Number.prototype and Boolean.prototype, themselves wrappers of "", 0, false.
fn strictCode(l:u32)->bool {return image[code[states[l].pc-1u].w*2u+1u].y!=0u;}
fn wrapperPrototype(v:V)->u32 {
  if(v.z==7u){return 20u;}if(v.z==0u){return 21u;}if(v.z==1u){return 22u;}if(v.z==17u){return 27u;}if(v.z==18u){return 30u;}return 0u;
}
fn wrap(l:u32,primitive:V)->V {
  let holder=alloc(l,13u,primitive,0u,0u);
  let id=alloc(l,16u,V(wrapperPrototype(primitive),holder,0u,1u),0u,0u);
  return V(id,0u,4u,0u);
}
// The wrapped primitive, or tag 6 when id is not a wrapper.
fn wrapped(l:u32,id:u32)->V {
  if(states[l].heap[id].kind!=16u){return V(0u,0u,6u,0u);}
  return states[l].heap[states[l].heap[id].value.y].value;
}
fn toObject(l:u32,value:V)->V {
  if(value.z==2u||value.z==3u){states[l].status=4u;return undef();}
  if(wrapperPrototype(value)!=0u){return wrap(l,value);}return value;
}
fn thisPrimitive(l:u32,value:V,tag:u32)->V {
  if(value.z==tag){return value;}
  if(value.z==4u){let primitive=wrapped(l,value.x);if(primitive.z==tag){return primitive;}}
  states[l].status=4u;return undef();
}
// String exotic own properties: 1 = index (enumerable), 2 = length; both are
// read-only and non-configurable. 0 when text is not a string.
fn textOwn(l:u32,text:V,key:u32)->u32 {
  if(text.z!=7u){return 0u;}
  let index=arrayIndex(l,key);if(index!=0xffffffffu){return select(0u,1u,index<text.y);}
  return select(0u,2u,lengthKey(l,key));
}
fn textOwnValue(l:u32,text:V,key:u32)->V {
  let index=arrayIndex(l,key);if(index!=0xffffffffu){return makeText(l,text,undef(),index,1u);}
  return num(fromUnsigned(text.y));
}
fn stringOwn(l:u32,id:u32,key:u32)->u32 {return textOwn(l,wrapped(l,id),key);}
// ES2025 prototype properties that are not implemented: reaching the owning
// prototype without a guest-defined property is unsupported, not a miss.
fn prototypeGap(l:u32,id:u32,key:u32)->bool {
  if(id==GLOBAL_OBJECT){return globalGap(l,key);}
  if(id==23u){${fieldListWGSL(mathGapNames.map(name=>F[name]))}}
  if(id==24u){${fieldListWGSL(numberPhase5Pending.map(name=>F[name]))}}
  if(id==26u){${fieldListWGSL(phase3WellKnownNames.filter(name=>!['iterator','hasInstance','toPrimitive','toStringTag','species','isConcatSpreadable'].includes(name)).map(name=>F[name]))}}
  if(id==47u){${fieldListWGSL(reflectGapNames.map(name=>F[name]))}}
  if((key&0x80000000u)!=0u||(id!=20u&&id!=21u)){return false;}
  if(id==20u){${fieldListWGSL(stringPrototypeUnsupported.map(name=>F[name]))}}
  // Contiguous Number.prototype gap range minus methods implemented by the standard-library wave.
  ${fieldListWGSL(Array.from({length:numberGap[1]-numberGap[0]+1},(_,i)=>numberGap[0]+i).filter(i=>!stdlibImplementedNames('Number.prototype').includes(Object.keys(F).find(k=>F[k]===i))))}
}
// Own-property queries on those prototypes cannot answer for absent names.
fn ownGap(l:u32,id:u32,key:u32)->bool {
  // Only these fixed intrinsic holders can contain an unsupported own name.
  // Keep ordinary objects off the nested prototype-gap/name-comparison path.
  if(id!=GLOBAL_OBJECT&&id!=20u&&id!=21u&&id!=23u&&id!=24u&&id!=26u&&id!=47u){return false;}
  let gap=prototypeGap(l,id,key);
  if(!gap){return false;}
  let property=findProperty(l,id,key);
  if(property!=0u){return false;}
  states[l].status=6u;return true;
}
// [[Set]] with a primitive receiver from its prototype: only an inherited
// setter can run; every other outcome returns false (TypeError when strict).
fn primitiveSet(l:u32,start:u32,key:u32)->V {
  var current=start;
  for(var i=0u;i<${L.heap}u&&current!=0u;i++){
    let property=findProperty(l,current,key);
    if(property!=0u){
      let node=states[l].heap[property];
      if(node.kind==9u&&node.value.y!=0u){return V(node.value.y,0u,12u,0u);}
      break;
    }
    if(stringOwn(l,current,key)!=0u){break;}
    current=states[l].heap[current].value.x;
  }
  if(strictCode(l)){states[l].status=4u;}return undef();
}
fn boxingMethod(l:u32,id:u32,receiver:V,a:V,b:V,c:V)->V {
  if(id==${B.stringToString}u||id==${B.stringValueOf}u){return thisPrimitive(l,receiver,7u);}
  if(id==${B.numberValueOf}u){return thisPrimitive(l,receiver,0u);}
  if(id==${B.booleanValueOf}u){return thisPrimitive(l,receiver,1u);}
  if(id==${B.booleanToString}u){let value=thisPrimitive(l,receiver,1u);if(states[l].status!=0u){return undef();}return primitiveText(l,value);}
  if(id==${BI.__lanesToObject}u){return toObject(l,a);}
  if(id==${BI.__lanesThisNumber}u){return thisPrimitive(l,a,0u);}
  if(id==${B.constructBoolean}u){return wrap(l,boolean(truth(a)));}
  if(id==${BI.__lanesWrap}u){if(wrapperPrototype(a)==0u){states[l].status=6u;return undef();}return wrap(l,a);}
  if(id>=${BI.__lanesCharCodeAt}u&&id<=${BI.__lanesSlice}u){
    if(a.z!=7u||b.z>=4u||c.z>=4u){states[l].status=6u;return undef();}
    return stringMethod(l,id-${BI.__lanesCharCodeAt-1}u,a,b,c);
  }
  states[l].status=6u;return undef();
}
// Legacy caller/arguments accessors need additional strict/sloppy semantics.
fn functionKey(l:u32,v:V,key:u32)->bool {
  if((v.z!=5u&&v.z!=11u)||(key&0x80000000u)!=0u){return true;}
  let unsupported=field(l,key,${F.caller}u)||field(l,key,${F.arguments}u);
  if(unsupported){states[l].status=6u;}return !unsupported;
}
fn functionName(l:u32,value:V,name:V,force:bool) {
  if(value.z!=5u){states[l].status=6u;return;}
  let obj=objectView(l,value);var property=findProperty(l,obj.x,fieldKey(${F.name}u));
  if(property!=0u&&!force){let node=states[l].heap[property];if(node.kind!=3u||node.value.z!=7u||node.value.y!=0u){return;}}
  if(property==0u){property=alloc(l,3u,name,fieldKey(${F.name}u),states[l].heap[obj.x].next);states[l].heap[obj.x].next=property;}
  states[l].heap[property].value=name;states[l].heap[property].kind=3u;states[l].heap[property].marked=8u;
}
fn unsignedText(l:u32,number:u32)->V {
  var n=number;var digits:array<u32,10>;var count=0u;
  loop{digits[count]=48u+n%10u;count++;n/=10u;if(n==0u){break;}}
  var first=0u;var previous=0u;
  for(var i=0u;i<count;i+=4u){var chars=V(0u);
    for(var j=0u;j<4u&&i+j<count;j++){chars[j]=digits[count-1u-i-j];}
    let id=alloc(l,10u,chars,count,0u);if(first==0u){first=id;}else{states[l].heap[previous].next=id;}previous=id;
  }return V(first,count,7u,0u);
}
fn keyName(l:u32,key:u32)->V {
  if(phase3SymbolKey(key)){states[l].status=6u;return undef();}
  if((key&0x80000000u)==0u){return keyText(l,key);}return unsignedText(l,key&0x7fffffffu);
}
fn callbackValue(id:u32)->V {return V(id&0x7fffffffu,0u,select(5u,11u,(id&0x80000000u)!=0u),0u);}
fn callbackId(value:V)->u32 {
  if(value.z==3u){return 0u;}return value.x|select(0u,0x80000000u,value.z==11u);
}
fn getProperty(l: u32, original: V, key: u32) -> V {
  if(!functionKey(l,original,key)){return undef();}var obj=objectView(l,original);
  if(obj.z==11u&&nativeNonconstructor(obj)&&field(l,key,${F.prototype}u)){obj=V(3u,0u,4u,0u);}
  // Native functions without mutable backing still inherit the intrinsic
  // @@hasInstance. Backed functions take the ordinary property walk below.
  if(obj.z==11u&&key==(0x60000000u|${phase3HasInstanceNode}u)){obj=V(3u,0u,4u,0u);}
  if(obj.z==11u&&(field(l,key,${F.call}u)||field(l,key,${F.apply}u)||field(l,key,${F.bind}u)||field(l,key,${F.toString}u))){obj=V(3u,0u,4u,0u);}
  if (obj.z==2u || obj.z==3u) { states[l].status=4u; return undef(); }
  if (lengthKey(l,key)) {
    if (obj.z==7u) { return num(fromUnsigned(obj.y)); }
    if (obj.z==4u && states[l].heap[obj.x].kind==7u) { return num(fromUnsigned(states[l].heap[obj.x].value.y)); }
  }
  if(obj.z==11u&&obj.x>=300u&&obj.x<${300+arrayBuiltins.length}u){
    if(lengthKey(l,key)){
      let lengths=array<u32,${arrayBuiltins.length}>(${arrayBuiltins.map(name=>`${arrayBuiltinLengths[name]}u`).join(',')});
      return num(fromUnsigned(lengths[obj.x-300u]));
    }
    if(field(l,key,${F.name}u)){
      for(var i=0u;i<image[params.padding+1u].z;i++){
        let builtin=image[params.padding+2u+i];
        if(builtin.y==2u&&builtin.z==obj.x){return image[builtin.x];}
      }
    }
    states[l].status=6u;return undef();
  }
  ${generatorMetadata.map(m=>`if(obj.z==11u&&obj.x==${m.id}u){if(field(l,key,${F.name}u)){return image[fieldKey(${F[m.name]}u)];}if(lengthKey(l,key)){return num(fromUnsigned(${m.length}u));}if(obj.x==2503u&&field(l,key,${F.prototype}u)){return V(75u,0u,4u,0u);}states[l].status=6u;return undef();}`).join('\n  ')}
  ${promiseThenPropertyWGSL({F})}
  ${promiseCombinatorsMetadataWGSL({F})}
  ${asyncFunctionPropertyWGSL({F})}
  ${asyncGeneratorPropertyWGSL({F})}
  ${asyncIterationPropertyWGSL({F})}
  if(obj.z==11u&&obj.x==2000u){
    if(field(l,key,${F.name}u)){return image[fieldKey(${F.raw}u)];}
    if(lengthKey(l,key)){return num(fromUnsigned(1u));}
    states[l].status=6u;return undef();
  }
  if(obj.z==11u&&(obj.x==122u||obj.x==136u||obj.x==137u)){
    if(field(l,key,${F.name}u)){var name=${F.Number}u;if(obj.x==136u){name=${F.String}u;}if(obj.x==137u){name=${F.Boolean}u;}return image[fieldKey(name)];}
    if(lengthKey(l,key)){return num(fromUnsigned(1u));}
    if(field(l,key,${F.prototype}u)){var prototype=21u;if(obj.x==136u){prototype=20u;}if(obj.x==137u){prototype=22u;}return V(prototype,0u,4u,0u);}
    if(obj.x==136u&&field(l,key,${F.raw}u)){return V(2000u,0u,11u,0u);}
    states[l].status=6u;return undef();
  }
  if(obj.z==11u&&obj.x==404u){if(field(l,key,${F.name}u)){return image[fieldKey(${F.toString}u)];}if(lengthKey(l,key)){return num(fromUnsigned(0u));}states[l].status=6u;return undef();}
  ${builtinMetadataWGSL([...phase5Methods,...boxingMethods,...objectStaticPlaceholders,...stringSearchMetadata,...stringExtractMetadata],F)}
  if(obj.z==11u&&(obj.x==1001u||obj.x==1002u||obj.x==1003u||obj.x==1004u||obj.x==1005u||obj.x==1050u||obj.x==1100u||obj.x==1151u||obj.x==1152u||obj.x==1051u)){
    if(lengthKey(l,key)){var len=0u;if(obj.x==1001u||obj.x==1002u||obj.x==1050u||obj.x==1100u||obj.x==1051u){len=1u;}return num(fromUnsigned(len));}
    if(field(l,key,${F.name}u)){
      var name=${F.toString}u;
      if(obj.x==1001u){name=${F.for}u;}
      if(obj.x==1002u){name=${F.keyFor}u;}
      if(obj.x==1004u||obj.x==1152u){name=${F.valueOf}u;}
      if(obj.x==1005u){name=${F['get description']}u;}
      if(obj.x==1050u){name=${F.getOwnPropertySymbols}u;}
      if(obj.x==1100u){name=${F['[Symbol.toPrimitive]']}u;}
      if(obj.x==1051u){name=${F.ownKeys}u;}
      return image[fieldKey(name)];
    }
    states[l].status=6u;return undef();
  }
  if(obj.z==11u&&obj.x==500u){
    if(field(l,key,${F.prototype}u)){return V(400u,0u,11u,0u);}
    if(field(l,key,${F.name}u)){return image[fieldKey(${F.Function}u)];}
    if(lengthKey(l,key)){return num(fromUnsigned(1u));}
    states[l].status=6u;return undef();
  }
  if(obj.z==11u && obj.x==100u){
    if(field(l,key,${F.prototype}u)){return V(1u,0u,4u,0u);}
    if(field(l,key,${F.length}u)){return num(fromUnsigned(1u));}
    if(field(l,key,${F.name}u)){return image[fieldKey(${F.Object}u)];}
    var id=1u;for(;id<=9u&&!field(l,key,id);id++){}
    if(id<=9u){return V(100u+id,0u,11u,0u);}
    states[l].status=6u;return undef();
  }
  // A primitive base reads through ToObject without allocating: string index
  // and length are its only own properties, then its intrinsic prototype.
  var current=obj.x;
  if(obj.z==7u&&textOwn(l,obj,key)!=0u){return textOwnValue(l,obj,key);}
  if(obj.z==0u||obj.z==1u||obj.z==7u||obj.z==17u||obj.z==18u){current=wrapperPrototype(obj);}
  else if (obj.z!=4u) { states[l].status=6u; return undef(); }
  var property=0u;
  for(var i=0u;i<${L.heap}u && current!=0u && property==0u;i++){
    property=findProperty(l,current,key);
    if(property==0u&&states[l].heap[current].kind==7u&&lengthKey(l,key)){return num(fromUnsigned(states[l].heap[current].value.y));}
    if(property==0u&&stringOwn(l,current,key)!=0u){return textOwnValue(l,wrapped(l,current),key);}
    if(property==0u&&prototypeGap(l,current,key)){states[l].status=6u;return undef();}
    current=states[l].heap[current].value.x;
  }
  if(property==0u){
    if(original.z==11u&&original.x==100u){
      var known=field(l,key,${F.groupBy}u)||field(l,key,${F.prototype}u)||field(l,key,${F.length}u)||field(l,key,${F.name}u)||key==(0x60000000u|${31+phase3WellKnownNames.indexOf('species')}u);
      for(var i=1u;i<=9u;i++){known=known||field(l,key,i);}
      ${objectStaticPlaceholders.map(item=>`known=known||field(l,key,${F[item.name]}u);`).join('\n      ')}
      if(!known){states[l].status=6u;}
    }
    return undef();
  }
  let node=states[l].heap[property];
  if(node.kind==11u){if(obj.z!=4u){return objectValue(l,wrapperPrototype(obj));}return objectValue(l,states[l].heap[obj.x].value.x);}
  if(node.kind==9u){if(node.value.x==0u){return undef();}return V(node.value.x,0u,12u,0u);}
  if(node.kind==15u){return states[l].heap[node.value.x].value;}
  return node.value;
}
// Array value.z bit 0 marks a non-writable length; the other bits are reserved.
fn arrayLengthValue(l:u32,value:V)->u32 {
  if(value.z>=4u){states[l].status=6u;return 0u;}
  let length=toBits(value.xy);
  if(!equalNumber(fromUnsigned(length),value.xy)){states[l].status=8u;return 0u;}
  return length;
}
fn resizeArray(l:u32,obj:u32,length:u32)->bool {
  var finalLength=length;var property=states[l].heap[obj].next;
  // Deletion has no callbacks. Find the highest undeletable index first, then
  // remove exactly the properties descending deletion would reach before it.
  for(var i=0u;i<${L.heap}u&&property!=0u;i++){
    let node=states[l].heap[property];
    let index=arrayIndex(l,node.key);
    if(index!=0xffffffffu&&(node.marked&8u)==0u){
      if(index>=length){finalLength=max(finalLength,index+1u);}
    }
    property=node.next;
  }
  var previous=obj;property=states[l].heap[obj].next;
  for(var i=0u;i<${L.heap}u&&property!=0u;i++){
    let node=states[l].heap[property];
    let index=arrayIndex(l,node.key);
    if(index!=0xffffffffu&&index>=finalLength){
      states[l].heap[previous].next=node.next;states[l].heap[property].next=0u;
    }else{previous=property;}
    property=node.next;
  }
  states[l].heap[obj].value.y=finalLength;return finalLength==length;
}
fn putProperty(l: u32, original: V, key: u32, value: V, define: bool) -> V {
  if(!functionKey(l,original,key)){return undef();}let obj=objectView(l,original);
  if(!define&&wrapperPrototype(obj)!=0u){
    // A primitive's own string index/length is read-only; otherwise the
    // receiver is not an object, so only an inherited setter can succeed.
    if(textOwn(l,obj,key)!=0u){if(strictCode(l)){states[l].status=4u;}return undef();}
    return primitiveSet(l,wrapperPrototype(obj),key);
  }
  if (obj.z!=4u) { states[l].status=select(6u,4u,obj.z==2u||obj.z==3u); return undef(); }
  if(define&&stringOwn(l,obj.x,key)!=0u){states[l].status=4u;return undef();}
  if (states[l].heap[obj.x].kind==7u) {
    if (lengthKey(l,key)) {
      let throws=define||image[code[states[l].pc-1u].w*2u+1u].y!=0u;
      if((states[l].heap[obj.x].value.z&1u)!=0u){if(throws){states[l].status=4u;}return undef();}
      if(value.z>=4u){return V(0x80000000u|select(124u,125u,throws),0u,12u,0u);}
      let length=arrayLengthValue(l,value);if(states[l].status!=0u){return undef();}
      if(!resizeArray(l,obj.x,length)&&throws){states[l].status=4u;}return undef();
    }
  }
  if(!define) {
    var current=obj.x;var inherited=0u;var virtualLength=false;var lengthWritable=true;
    for(var i=0u;i<${L.heap}u && current!=0u && inherited==0u&&!virtualLength;i++) {
      inherited=findProperty(l,current,key);
      if(inherited==0u&&states[l].heap[current].kind==7u&&lengthKey(l,key)){virtualLength=true;lengthWritable=(states[l].heap[current].value.z&1u)==0u;}
      if(inherited==0u&&!virtualLength&&stringOwn(l,current,key)!=0u){virtualLength=true;lengthWritable=false;}
      current=states[l].heap[current].value.x;
    }
    if(virtualLength&&!lengthWritable){if(image[code[states[l].pc-1u].w*2u+1u].y!=0u){states[l].status=4u;}return undef();}
    if(inherited!=0u) {
        let node=states[l].heap[inherited];
        if(node.kind==11u){return V(0x80000079u,0u,12u,0u);}
        if(node.kind==9u) {
          if(node.value.y!=0u) {return V(node.value.y,0u,12u,0u);}
          if(image[code[states[l].pc-1u].w*2u+1u].y!=0u) {states[l].status=4u;}
          return undef();
        }
        if((node.marked&2u)==0u){if(image[code[states[l].pc-1u].w*2u+1u].y!=0u){states[l].status=4u;}return undef();}
    }
  }
  var property=findProperty(l,obj.x,key);
  if(property==0u&&obj.x==GLOBAL_OBJECT&&ownGap(l,obj.x,key)){return undef();}
  if(property==0u && states[l].heap[obj.x].value.w==0u){if(define || image[code[states[l].pc-1u].w*2u+1u].y!=0u){states[l].status=4u;}return undef();}
  let index=arrayIndex(l,key);
  if(states[l].heap[obj.x].kind==7u && index!=0xffffffffu){
    let length=states[l].heap[obj.x].value.y;
    if(index>=length&&(states[l].heap[obj.x].value.z&1u)!=0u){if(define||image[code[states[l].pc-1u].w*2u+1u].y!=0u){states[l].status=4u;}return undef();}
    states[l].heap[obj.x].value.y=max(length,index+1u);
  }
  if (property==0u) { property=alloc(l,3u,value,key,states[l].heap[obj.x].next); states[l].heap[obj.x].next=property; }
  else if(states[l].heap[property].kind==15u){states[l].heap[states[l].heap[property].value.x].value=value;}
  else { states[l].heap[property].value=value;states[l].heap[property].kind=3u; }
  return undef();
}
fn defineAccessor(l:u32,obj:V,key:u32,fnValue:V,setter:bool) {
  if(obj.z!=4u||fnValue.z!=5u){states[l].status=4u;return;}
  var property=findProperty(l,obj.x,key);
  if(property==0u){property=alloc(l,9u,V(0u),key,states[l].heap[obj.x].next);states[l].heap[obj.x].next=property;}
  if(states[l].heap[property].kind!=9u){states[l].heap[property].kind=9u;states[l].heap[property].value=V(0u);}
  states[l].heap[property].value[select(0u,1u,setter)]=fnValue.x;
}
fn finish(l:u32,completionValue:V) {
  let result=generatorBeforeFinish(l,completionValue);if(states[l].status!=0u){return;}
  asyncGeneratorBeforeFinish(l);
  // Keep completion writes outside the unwind loop. The equivalent loop with
  // early returns failed to publish completion in the tested Dawn/Metal build.
  // Continuations: 2 setter, 3 constructor, 4/5 postfix update, 6 local store, 7 converted stack key.
  var complete=true;var omitResult=false;var constructed=undef();var isConstructor=false;var continuation=0u;
  for(var i=0u;i<${L.frames}u;i++) {
    if(states[l].depth==0u){break;}
    let frame=states[l].frames[states[l].depth];states[l].depth--;states[l].sp=frame.base;
    states[l].env=states[l].frames[states[l].depth].env;states[l].pc=frame.pc;
    if(frame.tail!=1u){complete=false;omitResult=frame.tail==2u;isConstructor=frame.tail==3u;constructed=frame.receiver;continuation=frame.tail;break;}
  }
  var returned=result;
  if(isConstructor&&result.z!=4u&&result.z!=5u&&result.z!=11u){returned=constructed;}
  if(complete){states[l].result=returned;states[l].status=1u;}
  else if(continuation==4u||continuation==5u){
    push(l,returned);
    if(returned.z==18u){let updated=phase3BigintStep(l,returned,continuation==5u);if(states[l].status==0u){push(l,updated);}}
    else{push(l,num(plus(returned.xy,Pair(0u,select(0x3ff00000u,0xbff00000u,continuation==5u)))));}
  }
  else if(continuation==6u){states[l].heap[constructed.x].value=returned;}
  else if(continuation==7u){states[l].stack[constructed.x]=returned;}
  ${promiseJobContinuationWGSL}  ${phase4Finish.map(({code,body})=>`else if(continuation==${code}u){${body}}`).join('\n  ')}
  else if(!omitResult){push(l,returned);}
${promiseJobCompleteWGSL}}
fn raise(l:u32,error:V) {
  // suspendClose stops the scan. Heap kind 50 is unused: the error is frame.receiver.
  // Continuation 80 is finish() -> raise(l, returned). This function does not call itself.
  var depth=states[l].depth;var sp=states[l].sp;var found=false;var destination=0u;var suspendClose=false;var closeRecordIndex=0u;var asyncBoundary=0u;
  for(var i=0u;i<${L.stack+L.frames}u && !found && !suspendClose && asyncBoundary==0u && (sp>states[l].frames[depth].base || depth>0u);i++) {
    if(sp>states[l].frames[depth].base) {
      sp--;let value=states[l].stack[sp];
      // Iterator marker V(0,1,9,0). After this decrement the marker slot is sp,
      // next is stack[sp-1], and the record is stack[sp-2].
      if(value.z==9u&&value.y==1u){
        if(sp>=states[l].frames[depth].base+2u){
          let record=states[l].stack[sp-2u];
          // Tag 3: exhaustion, or a step throw already cleared the slot. Keep scanning.
          if(record.z==4u){suspendClose=true;closeRecordIndex=sp-2u;}
        }
      }else{found=value.z==9u&&value.y==0u;destination=value.x;}
    }else{
      asyncBoundary=asyncUnwindBoundary(l,depth);if(asyncBoundary!=0u){break;}
      // Tail 40 is for_of_next. js_for_of_next stores undefined over the record
      // when next throws, so return must not run.
      if(states[l].frames[depth].tail==40u){
        let recordIndex=states[l].frames[depth].receiver.x;
        if(recordIndex<sp){states[l].stack[recordIndex]=undef();}
      }
      asyncGeneratorUnwind(l,states[l].frames[depth].env);generatorUnwind(l,states[l].frames[depth].env);depth--;
    }
  }
  states[l].depth=depth;states[l].sp=sp;states[l].env=states[l].frames[depth].env;
  if(asyncBoundary!=0u){asyncRaiseBoundary(l,asyncBoundary,error);return;}
  if(suspendClose){
    let record=states[l].stack[closeRecordIndex];
    if(states[l].sp+3u>${L.stack}u){states[l].status=3u;}
    else{
      // 2440 returns the original error. Do not call 1272: its result is undefined.
      push(l,V(2440u,0u,11u,0u));push(l,record);push(l,error);
      // Defer guest dispatch to main: raise -> call -> finish -> raise would
      // otherwise form a forbidden recursive WGSL call graph. The error and
      // record stay on the live operand stack until dispatch installs its frame.
      states[l].status=9u;
    }
  }else if(found){states[l].pc=destination;states[l].status=0u;push(l,error);}
  else{states[l].result=error;states[l].status=7u;}
}
fn truncatePositive(value:Pair)->Pair {
  let exponent=(value.y>>20u)&2047u;
  if(exponent<1023u){return Pair(0u);}if(exponent>=1075u){return value;}
  let bits=1075u-exponent;
  if(bits>=32u){return Pair(0u,value.y&~((1u<<(bits-32u))-1u));}
  return Pair(value.x&~((1u<<bits)-1u),value.y);
}
fn bindFunction(l:u32,callee:V,thisValue:V,count:u32,argumentsOffset:u32)->V {
  if(callee.z!=5u&&callee.z!=11u){states[l].status=4u;return undef();}
  let obj=objectView(l,callee);var prototype=3u;var length=num(Pair(0u));
  if(obj.z==4u){
    prototype=states[l].heap[obj.x].value.x;
    if(findProperty(l,obj.x,fieldKey(${F.length}u))!=0u){length=getProperty(l,callee,fieldKey(${F.length}u));}
  }else{length=getProperty(l,callee,fieldKey(${F.length}u));}
  if(length.z==12u){states[l].status=6u;}if(states[l].status!=0u){return undef();}
  var boundLength=Pair(0u);
  if(length.z==0u&&!nan(length.xy)&&lessNumber(Pair(0u),length.xy)){
    let integer=truncatePositive(length.xy);let amount=fromUnsigned(count);
    if(lessNumber(amount,integer)){boundLength=plus(integer,Pair(amount.x,amount.y^0x80000000u));}
  }
  var name=getProperty(l,callee,fieldKey(${F.name}u));
  if(name.z==12u){states[l].status=6u;}if(states[l].status!=0u){return undef();}
  if(name.z!=7u){name=image[fieldKey(${F['']}u)];}
  let prefix=image[fieldKey(${F['bound ']}u)];name=makeText(l,prefix,name,0u,prefix.y+name.y);
  if(states[l].status!=0u){return undef();}
  return boundStorage(l,callee,thisValue,count,argumentsOffset,prototype,name,boundLength);
}
fn boundStorage(l:u32,callee:V,thisValue:V,count:u32,argumentsOffset:u32,prototype:u32,name:V,boundLength:Pair)->V {
  let id=alloc(l,12u,V(callee.x,0u,callee.z,count),0u,0u);
  let backing=alloc(l,2u,V(prototype,0u,id|0x80000000u,1u),0u,0u);states[l].heap[id].value.y=backing;
  let lengthProperty=alloc(l,3u,num(boundLength),fieldKey(${F.length}u),0u);states[l].heap[lengthProperty].marked=8u;
  let nameProperty=alloc(l,3u,name,fieldKey(${F.name}u),lengthProperty);states[l].heap[nameProperty].marked=8u;states[l].heap[backing].next=nameProperty;
  var previous=alloc(l,13u,thisValue,0u,0u);states[l].heap[id].next=previous;
  for(var i=0u;i<count;i++){let node=alloc(l,13u,states[l].stack[argumentsOffset+i],0u,0u);states[l].heap[previous].next=node;previous=node;}
  return V(id,0u,5u,0u);
}
fn argumentsObject(l:u32,mapped:bool)->V {
  let env=states[l].env;let count=states[l].heap[env].value.y;
  let id=alloc(l,14u,V(1u,0u,0u,1u),0u,0u);
  for(var i=0u;i<count;i++){
    let binding=cell(l,env,i,false);
    if(mapped){let property=alloc(l,15u,V(binding,0u,0u,0u),0x80000000u|i,states[l].heap[id].next);states[l].heap[property].marked=14u;states[l].heap[id].next=property;}
    else{dataProperty(l,id,0x80000000u|i,states[l].heap[binding].value,7u);}
  }
  dataProperty(l,id,fieldKey(${F.length}u),num(fromUnsigned(count)),5u);
  dataProperty(l,id,0x60000000u|${PHASE3_NODES.iterator}u,V(334u,0u,11u,0u),5u);
  if(mapped){dataProperty(l,id,fieldKey(${F.callee}u),V(states[l].heap[env].value.x,0u,5u,0u),5u);return V(id,0u,4u,0u);}
  let poison=0x80000000u|700u;
  let property=alloc(l,9u,V(poison,poison,0u,0u),fieldKey(${F.callee}u),states[l].heap[id].next);
  states[l].heap[property].marked=0u;states[l].heap[id].next=property;
  return V(id,0u,4u,0u);
}
fn makeArray(l:u32,count:u32,offset:u32,elementsOnly:bool)->V {
  var length=count;var elements=count;
  if(count==1u&&!elementsOnly){
    let value=states[l].stack[offset];
    if(value.z==0u){
      length=toBits(value.xy);elements=0u;
      if(!equalNumber(fromUnsigned(length),value.xy)){states[l].status=8u;return undef();}
    }
  }
  let id=alloc(l,7u,V(2u,length,0u,1u),0u,0u);let obj=V(id,0u,4u,0u);
  for(var i=0u;i<elements;i++){let ignored=putProperty(l,obj,0x80000000u|i,states[l].stack[offset+i],true);}
  return obj;
}
fn applyLength(l:u32,value:V)->u32 {
  if(value.z>=4u){states[l].status=6u;return 0u;}
  if(nan(value.xy)||!lessNumber(Pair(0u),value.xy)){return 0u;}
  if(!lessNumber(value.xy,fromUnsigned(${L.args+1}u))){states[l].status=3u;return 0u;}
  return toBits(value.xy);
}
fn applyArguments(l:u32,base:u32,list:V)->u32 {
  if(list.z==2u||list.z==3u){return 0u;}
  let obj=objectView(l,list);
  if(obj.z!=4u){states[l].status=select(4u,6u,obj.z==11u);return 0u;}
  let count=applyLength(l,getProperty(l,list,fieldKey(${F.length}u)));
  if(base+2u+count>${L.stack}u){states[l].status=3u;return 0u;}
  for(var j=0u;j<count&&states[l].status==0u;j++){
    let value=getProperty(l,list,j|0x80000000u);
    if(value.z==12u){states[l].status=6u;}else{states[l].stack[base+2u+j]=value;}
  }
  return count;
}
fn bindFromList(l:u32,callee:V,thisValue:V,list:V,base:u32)->V {
  if(callee.z!=5u&&callee.z!=11u){states[l].status=4u;return undef();}
  let obj=objectView(l,callee);var prototype=3u;if(obj.z==4u){prototype=states[l].heap[obj.x].value.x;}
  let count=applyArguments(l,base,list);if(states[l].status!=0u){return undef();}
  return boundStorage(l,callee,thisValue,count,base+2u,prototype,image[fieldKey(${F['']}u)],Pair(0u));
}
fn callWrapper(l:u32,value:V)->bool {
  return (value.z==11u&&(value.x==401u||value.x==113u||value.x==114u||(value.x==402u&&image[image[params.padding+1u].w+${F.apply}u].y==0u)))||(value.z==5u&&states[l].heap[value.x].kind==12u);
}
fn call(l: u32, argumentCount: u32, method: bool, tail: bool) {
  var argc=argumentCount;var isMethod=method;var extra=select(1u,2u,isMethod);
  if(argc>${L.args}u||states[l].sp<argc+extra){states[l].status=3u;return;}
  let base=states[l].sp-argc-extra;var fnValue=states[l].stack[base+extra-1u];var invalidReceiver=false;
  for(var i=0u;i<${L.frames}u&&callWrapper(l,fnValue)&&!invalidReceiver&&states[l].status==0u;i++){
    if(fnValue.z==5u){
      let bound=states[l].heap[fnValue.x];let count=bound.value.w;
      if(argc+count>${L.args}u||base+2u+argc+count>${L.stack}u){states[l].status=3u;}
      else{
        for(var j=argc;j>0u;j--){states[l].stack[base+2u+count+j-1u]=states[l].stack[base+extra+j-1u];}
        var node=bound.next;let thisValue=states[l].heap[node].value;node=states[l].heap[node].next;
        for(var j=0u;j<count;j++){states[l].stack[base+2u+j]=states[l].heap[node].value;node=states[l].heap[node].next;}
        fnValue=V(bound.value.x,0u,bound.value.z,0u);states[l].stack[base]=thisValue;states[l].stack[base+1u]=fnValue;
        argc+=count;extra=2u;isMethod=true;states[l].sp=base+extra+argc;
      }
    }else if(fnValue.x==113u){
      var callee=undef();var thisValue=undef();
      if(argc>0u){callee=states[l].stack[base+extra];}
      if(argc>1u){thisValue=states[l].stack[base+extra+1u];}
      invalidReceiver=callee.z!=5u&&callee.z!=11u;
      let remaining=select(0u,argc-2u,argc>1u);
      for(var j=0u;j<remaining;j++){states[l].stack[base+2u+j]=states[l].stack[base+extra+2u+j];}
      fnValue=callee;states[l].stack[base]=thisValue;states[l].stack[base+1u]=callee;
      argc=remaining;extra=2u;isMethod=true;states[l].sp=base+extra+argc;
    }else if(fnValue.x==114u){
      var callee=undef();var thisValue=undef();var list=undef();
      if(argc>0u){callee=states[l].stack[base+extra];}
      if(argc>1u){thisValue=states[l].stack[base+extra+1u];}
      if(argc>2u){list=states[l].stack[base+extra+2u];}
      invalidReceiver=callee.z!=5u&&callee.z!=11u;
      if(!invalidReceiver){
        let remaining=applyArguments(l,base,list);
        fnValue=callee;states[l].stack[base]=thisValue;states[l].stack[base+1u]=callee;
        argc=remaining;extra=2u;isMethod=true;states[l].sp=base+extra+argc;
      }
    }else{
      var callee=undef();if(isMethod){callee=states[l].stack[base];}
      invalidReceiver=callee.z!=5u&&callee.z!=11u;
      if(!invalidReceiver){
        var thisValue=undef();if(argc>0u){thisValue=states[l].stack[base+2u];}
        var remaining=0u;
        if(fnValue.x==401u){
          remaining=select(0u,argc-1u,argc>0u);
          for(var j=0u;j<remaining;j++){states[l].stack[base+2u+j]=states[l].stack[base+3u+j];}
        }else{
          var list=undef();if(argc>1u){list=states[l].stack[base+3u];}
          remaining=applyArguments(l,base,list);
        }
        if(states[l].status==0u){
          states[l].stack[base]=thisValue;states[l].stack[base+1u]=callee;
          argc=remaining;states[l].sp=base+2u+argc;fnValue=callee;
        }
      }
    }
  }
  if(invalidReceiver){states[l].status=4u;return;}if(states[l].status!=0u){return;}
  if(callWrapper(l,fnValue)){states[l].status=3u;return;}
  if(fnValue.z==11u&&fnValue.x==111u&&argc>0u){
    let input=states[l].stack[base+extra];let magnitude=Pair(input.x,input.y&0x7fffffffu);
    if(input.z==0u&&!nan(input.xy)&&magnitude.y!=0x7ff00000u&&!equalNumber(fromUnsigned(toBits(magnitude)),magnitude)){
      let helper=image[image[params.padding+1u].w+${F.numberText}u].y;
      if(helper!=0u){fnValue=closure(l,helper-1u);states[l].stack[base+extra-1u]=fnValue;}
    }
  }
  if(fnValue.z==11u&&fnValue.x>=600u&&fnValue.x<=606u&&image[image[params.padding+1u].w+${F.errorCreate}u].y!=0u){
    if(base+extra+3u>${L.stack}u){states[l].status=3u;return;}
    for(var i=argc;i<2u;i++){states[l].stack[base+extra+i]=undef();}
    states[l].stack[base+extra+2u]=num(fromUnsigned(fnValue.x-600u));argc=3u;states[l].sp=base+extra+argc;
    fnValue=closure(l,image[image[params.padding+1u].w+${F.errorCreate}u].y-1u);states[l].stack[base+extra-1u]=fnValue;
  }
  if(fnValue.z==11u&&(fnValue.x==101u||fnValue.x==402u||fnValue.x==403u||fnValue.x==122u||fnValue.x==124u||fnValue.x==125u||fnValue.x==127u||fnValue.x==128u||fnValue.x==129u||fnValue.x==130u||fnValue.x==131u||fnValue.x==132u||fnValue.x==134u||fnValue.x==650u||fnValue.x==136u||fnValue.x==139u)){
    var field=${F.defineProperty}u;if(fnValue.x==402u){field=${F.apply}u;}if(fnValue.x==403u){field=${F.bind}u;}if(fnValue.x==122u){field=${F.toNumber}u;}if(fnValue.x==124u){field=${F.arrayLengthSet}u;}if(fnValue.x==125u){field=${F.arrayLengthSetStrict}u;}if(fnValue.x==127u){field=${F.unaryNumber}u;}if(fnValue.x==128u){field=${F.binaryNumber}u;}if(fnValue.x==129u){field=${F.toPrimitive}u;}if(fnValue.x==130u){field=${F.relational}u;}if(fnValue.x==131u){field=${F.equality}u;}if(fnValue.x==132u){field=${F.addition}u;}if(fnValue.x==134u){field=${F.toText}u;}if(fnValue.x==650u){field=${F.errorText}u;}if(fnValue.x==136u){field=${F.stringCall}u;}if(fnValue.x==139u){field=${F.toDescriptor}u;}
    let helper=image[image[params.padding+1u].w+field].y;
    if(helper!=0u){fnValue=closure(l,helper-1u);states[l].stack[base+extra-1u]=fnValue;}
  }
  if(fnValue.z==11u){
    var field=0xffffffffu;
    if(fnValue.x==105u){field=${F.objectSetPrototype}u;}
    if(fnValue.x==121u){field=${F.legacySetPrototype}u;}
    ${phase3BigintConversionMetadata.map(m=>`if(fnValue.x==${m.id}u){field=${F[m.field]}u;}`).join('\n    ')}
    ${phase5Methods.map(m=>`if(fnValue.x==${m.id}u){field=${F[m.field]}u;}`).join("\n    ")}
    ${stdlibConstructors.map(m=>`if(fnValue.x==${m.id}u){field=${F[m.field]}u;}`).join("\n    ")}
    ${Object.entries(promiseResolveBuiltinFields).map(([id,field])=>`if(fnValue.x==${id}u){field=${F[field]}u;}`).join('\n    ')}
    ${promiseJobDispatchWGSL({F})}
    ${asyncFunctionDispatchWGSL({F})}
    ${asyncIterationDispatchWGSL({F})}
    if(fnValue.x==960u){field=${F.numberPow}u;}
    ${promiseCombinatorsDispatchWGSL({F})}
    ${promiseThenDispatchWGSL({F})}
    ${promiseCoreCallFieldsWGSL({F})}
    if(fnValue.x==1167u){field=${F.comparisonToPrimitive}u;}
    if(fnValue.x==1168u){field=${F.numericPow}u;}
    ${objectStaticPlaceholders.filter(item=>item.id>=711&&item.id<=715).map(item=>`if(fnValue.x==${item.id}u){field=${F[item.name]}u;}`).join('\n    ')}
    ${Object.entries(arrayMethods).map(([id, field]) => `if(fnValue.x==${id}u){field=${F[field]}u;}`).join('\n    ')}
    ${[...stringSearchMetadata,...stringExtractMetadata].map(item=>`if(fnValue.x==${item.id}u){field=${F[item.field]}u;}`).join('\n    ')}
    ${Object.entries(propertyKeyMethodFields).map(([id,field])=>`if(fnValue.x==${id}u){field=${F[field]}u;}`).join('\n    ')}
    ${Object.entries(phase4BuiltinFields).map(([id,field])=>`if(fnValue.x==${id}u){field=${F[field]}u;}`).join('\n    ')}
    // Native charCodeAt/charAt/slice handle a primitive string receiver with
    // primitive arguments; other calls convert in their guest helpers.
    if(fnValue.x>=1u&&fnValue.x<=3u){
      var direct=isMethod&&states[l].stack[base].z==7u;
      for(var i=0u;i<min(argc,2u);i++){direct=direct&&states[l].stack[base+extra+i].z<4u;}
      if(!direct){field=${F.stringCharCodeAt}u;if(fnValue.x==2u){field=${F.stringCharAt}u;}if(fnValue.x==3u){field=${F.stringSlice}u;}}
    }
    if(fnValue.x==${B.numberToString}u){field=${F.numberToString}u;}
    if(fnValue.x==${B.constructString}u){field=${F.stringConstruct}u;}
    if(fnValue.x==${B.constructNumber}u){field=${F.numberConstruct}u;}
    if(field!=0xffffffffu){
      let helper=image[image[params.padding+1u].w+field].y;
      if(helper!=0u){fnValue=closure(l,helper-1u);states[l].stack[base+extra-1u]=fnValue;}
    }
  }
${promiseJobCallWGSL}${asyncGeneratorCallWGSL}  if(fnValue.z==11u&&fnValue.x>=2500u&&fnValue.x<=2502u){
    var generatorReceiver=undef();if(isMethod){generatorReceiver=states[l].stack[base];}
    var generatorArgument=undef();if(argc>0u){generatorArgument=states[l].stack[base+extra];}
    generatorResume(l,generatorReceiver,generatorArgument,fnValue.x-2500u,base,tail);return;
  }
${asyncFunctionCallWGSL}  if(fnValue.z==11u) {
    var receiver=undef();if(isMethod){receiver=states[l].stack[base];}
    // Array.of's generic constructor path needs guest [[Construct]] resumption.
    if(fnValue.x==202u&&(receiver.z==5u||(receiver.z==11u&&receiver.x!=200u))){states[l].status=6u;return;}
    var a=undef();var b=undef();if(argc>0u){a=states[l].stack[base+extra];}if(argc>1u){b=states[l].stack[base+extra+1u];}
    var c=undef();if(argc>2u){c=states[l].stack[base+extra+2u];}
    var value=undef();if(fnValue.x==116u){value=bindFromList(l,a,b,c,base);}else if(fnValue.x==200u||fnValue.x==202u){value=makeArray(l,argc,base+extra,fnValue.x==202u);}else if(fnValue.x==403u){value=bindFunction(l,receiver,a,select(0u,argc-1u,argc>0u),base+extra+1u);}else if(fnValue.x<100u){value=stringMethod(l,fnValue.x,receiver,a,b);}else{value=objectMethod(l,fnValue.x,receiver,a,b,c);}states[l].sp=base;
    if(states[l].status==0u){if(tail){finish(l,value);}else{push(l,value);}}return;
  }
  if (fnValue.z!=5u) { states[l].status=4u; return; }
  if (states[l].depth+1u>=${L.frames}u) { states[l].status=3u; return; }
  let fnInfo=image[states[l].heap[fnValue.x].value.x*2u];
  let env=environment(l,fnValue.x,argc);
  for (var i=0u;i<argc;i++) { let c=cell(l,env,i,false); states[l].heap[c].value=states[l].stack[base+extra+i]; }
  var receiver=undef(); if (isMethod) { receiver=states[l].stack[base]; }
  if(asyncGeneratorFunction(l,fnValue)){asyncGeneratorEnter(l,fnValue,env,receiver);if(states[l].status!=0u){return;}}
  else if(generatorFunction(l,fnValue)){generatorEnter(l,fnValue,env,receiver);if(states[l].status!=0u){return;}}${asyncFunctionEnterWGSL}
  states[l].depth++; states[l].frames[states[l].depth]=Frame(states[l].pc,env,base,select(0u,1u,tail),receiver);
  states[l].sp=base; states[l].env=env; states[l].pc=fnInfo.x;
}
fn construct(l:u32,argumentCount:u32) {constructWithPrototype(l,argumentCount,undef(),false);}
// Private Reflect bridge: list is a fresh null-prototype guest descriptor with
// captured own data slots. No getter or collection occurs while copying it.
fn preparedConstruct(l:u32) {
  if(states[l].sp<5u){states[l].status=2u;return;}
  let base=states[l].sp-5u;
  let constructorTarget=states[l].stack[base+1u];let list=states[l].stack[base+2u];
  let newTarget=states[l].stack[base+3u];let prototype=states[l].stack[base+4u];
  let argc=applyArguments(l,base,list);if(states[l].status!=0u){return;}
  states[l].stack[base]=constructorTarget;states[l].stack[base+1u]=newTarget;states[l].sp=base+2u+argc;
  constructWithPrototype(l,argc,prototype,true);
}
fn constructWithPrototype(l:u32,argumentCount:u32,providedPrototype:V,hasProvidedPrototype:bool) {
  var argc=argumentCount;
  if(argc>${L.args}u||states[l].sp<argc+2u){states[l].status=3u;return;}
  let base=states[l].sp-argc-2u;var callee=states[l].stack[base];let newTarget=states[l].stack[base+1u];var constructTarget=newTarget;
  if(callee.z==11u&&callee.x==2860u){states[l].status=6u;return;}
  if(callee.z==11u&&callee.x==2883u){states[l].status=6u;return;}
  if(callee.z==11u&&callee.x==2503u){states[l].status=6u;return;}
  if(callee.z!=5u&&callee.z!=11u){states[l].status=4u;return;}
  if(!equal(l,callee,newTarget)&&!reflectIsConstructor(l,newTarget)){states[l].status=4u;return;}
  for(var i=0u;i<${L.frames}u&&callee.z==5u&&states[l].heap[callee.x].kind==12u&&states[l].status==0u;i++){
    let bound=states[l].heap[callee.x];let count=bound.value.w;
    if(argc+count>${L.args}u||base+2u+argc+count>${L.stack}u){states[l].status=3u;}
    else{
      for(var j=argc;j>0u;j--){states[l].stack[base+2u+count+j-1u]=states[l].stack[base+2u+j-1u];}
      var node=states[l].heap[bound.next].next;
      for(var j=0u;j<count;j++){states[l].stack[base+2u+j]=states[l].heap[node].value;node=states[l].heap[node].next;}
      argc+=count;let inner=V(bound.value.x,0u,bound.value.z,0u);if(equal(l,callee,constructTarget)){constructTarget=inner;}callee=inner;states[l].sp=base+2u+argc;
    }
  }
  if(states[l].status!=0u){return;}
  if(callee.z==5u&&states[l].heap[callee.x].kind==12u){states[l].status=3u;return;}
  var receiver=undef();var ordinaryConstructor=false;
  if(callee.z==11u){
    var constructorId=0u;
    if(!equal(l,callee,constructTarget)){states[l].status=select(4u,6u,classIsConstructor(l,callee));return;}
    ${stdlibConstructWGSL}
    // new String/Number/Boolean: NewTarget equals the callee, so the result
    // is a wrapper with the intrinsic prototype.
    if(callee.x==136u||callee.x==122u||callee.x==137u){
      constructorId=${B.constructString}u;if(callee.x==122u){constructorId=${B.constructNumber}u;}if(callee.x==137u){constructorId=${B.constructBoolean}u;}
    }
    ${promiseCoreConstructWGSL}
    ${promiseCombinatorsConstructWGSL()}
    if(callee.x==100u||callee.x==200u||(callee.x>=600u&&callee.x<=606u)){constructorId=callee.x;}
    if(constructorId==0u){states[l].status=select(4u,6u,callee.x==500u||callee.x==122u||callee.x==136u||callee.x==137u);return;}
    callee=V(constructorId,0u,11u,0u);
  }else{
    ordinaryConstructor=true;
  if(callee.z!=5u){states[l].status=4u;return;}
  let info=image[states[l].heap[callee.x].value.x*2u];let classFlags=states[l].heap[callee.x].value.w;
  if((info.w&0x10000u)==0u&&(classFlags&1u)==0u){states[l].status=4u;return;}
  // Derived constructors receive an uninitialized this; super() creates it.
  if((classFlags&2u)==0u){
    var value=providedPrototype;if(!hasProvidedPrototype){value=getProperty(l,constructTarget,fieldKey(${F.prototype}u));}let prototype=objectView(l,value);
    if(states[l].status!=0u){return;}
    if(prototype.z==11u||prototype.z==12u){states[l].status=6u;return;}
    var parent=1u;if(prototype.z==4u){parent=prototype.x;}
    receiver=V(alloc(l,2u,V(parent,0u,0u,1u),0u,0u),0u,4u,0u);
    if(states[l].status!=0u){return;}
  }
  }
  // Both intrinsic and ordinary constructors dispatch at this one call site.
  states[l].stack[base]=receiver;states[l].stack[base+1u]=callee;
  let depth=states[l].depth;call(l,argc,true,false);
  if(ordinaryConstructor&&states[l].status==0u&&states[l].depth>depth){
    states[l].frames[states[l].depth].tail=3u;
    states[l].heap[states[l].env].value.z=constructTarget.x;states[l].heap[states[l].env].value.w=constructTarget.z;
  }
}
// Trusted commit: caller has performed the ordinary validation in guest code.
fn commitPrototype(l:u32,original:V,parentValue:V)->V {
  let obj=objectView(l,original);let proto=objectView(l,parentValue);
  if(obj.z==11u||proto.z==11u){states[l].status=6u;return undef();}
  if(obj.z!=4u||(proto.z!=4u&&proto.z!=2u)){states[l].status=2u;return undef();}
  var parent=0u;if(proto.z==4u){parent=proto.x;}
  states[l].heap[obj.x].value.x=parent;return original;
}
fn descriptor(l:u32,original:V,key:u32,description:V)->V {
  if(!functionKey(l,original,key)){return undef();}
  let obj=objectView(l,original);let desc=objectView(l,description);
  if(obj.z==11u||desc.z==11u){states[l].status=6u;return undef();}
  if(obj.z!=4u || desc.z!=4u){states[l].status=4u;return undef();}
  var values:array<V,6>;var has:array<bool,6>;
  for(var i=0u;i<6u;i++){
    let k=fieldKey(${F.value}u+i);var current=desc.x;
    while(current!=0u){if(findProperty(l,current,k)!=0u){has[i]=true;break;}current=states[l].heap[current].value.x;}
    values[i]=getProperty(l,desc,k);if(values[i].z==12u){states[l].status=6u;return undef();}
  }
  let accessor=has[2]||has[3];let data=has[0]||has[1];
  if(accessor&&data){states[l].status=4u;return undef();}
  for(var i=2u;i<4u;i++){if(has[i]&&values[i].z!=3u&&values[i].z!=5u&&values[i].z!=11u){states[l].status=4u;return undef();}}
  let arrayObject=states[l].heap[obj.x].kind==7u;
  if(arrayObject&&lengthKey(l,key)){
    let oldLength=states[l].heap[obj.x].value.y;var length=oldLength;
    if(has[0]){length=arrayLengthValue(l,values[0]);if(states[l].status!=0u){return undef();}}
    let writable=(states[l].heap[obj.x].value.z&1u)==0u;
    if(accessor||(has[4]&&truth(values[4]))||(has[5]&&truth(values[5]))||(!writable&&((has[1]&&truth(values[1]))||length!=oldLength))){states[l].status=4u;return undef();}
    var success=true;if(has[0]){success=resizeArray(l,obj.x,length);}
    if(has[1]&&!truth(values[1])){states[l].heap[obj.x].value.z|=1u;}
    if(!success){states[l].status=4u;return undef();}return original;
  }
  let index=arrayIndex(l,key);
  if(arrayObject&&index!=0xffffffffu&&index>=states[l].heap[obj.x].value.y&&(states[l].heap[obj.x].value.z&1u)!=0u){states[l].status=4u;return undef();}
  if(ownGap(l,obj.x,key)){return undef();}
  let stringKind=stringOwn(l,obj.x,key);
  if(stringKind!=0u){
    // ValidateAndApplyPropertyDescriptor against a non-configurable,
    // non-writable string property: only an unchanged description succeeds.
    let current=textOwnValue(l,wrapped(l,obj.x),key);
    if(accessor||(has[5]&&truth(values[5]))||(has[4]&&truth(values[4])!=(stringKind==1u))||(has[1]&&truth(values[1]))||(has[0]&&!sameValue(l,values[0],current))){states[l].status=4u;return undef();}
    return original;
  }
  var property=findProperty(l,obj.x,key);var flags=0u;var kind=select(3u,9u,accessor);var old=undef();var mapping=0u;
  if(property!=0u){
    let node=states[l].heap[property];flags=(node.marked>>1u)&7u;old=node.value;
    let oldKind=select(node.kind,3u,node.kind==15u);if(node.kind==15u){mapping=node.value.x;old=states[l].heap[mapping].value;}
    if(node.kind==11u){states[l].status=6u;return undef();}
    if(!accessor&&!data){kind=oldKind;}
    if((flags&4u)==0u){
      if((has[5]&&truth(values[5]))||(has[4]&&truth(values[4])!=((flags&2u)!=0u))||kind!=oldKind){states[l].status=4u;return undef();}
      if(kind==3u && (flags&1u)==0u && ((has[1]&&truth(values[1]))||(has[0]&&!sameValue(l,values[0],old)))){states[l].status=4u;return undef();}
      if(kind==9u){for(var i=2u;i<4u;i++){if(has[i]){let id=callbackId(values[i]);if(id!=old[i-2u]){states[l].status=4u;return undef();}}}}
    }
    if(kind!=oldKind){old=undef();flags&=6u;}
  }else{
    if(states[l].heap[obj.x].value.w==0u){states[l].status=4u;return undef();}
    property=alloc(l,kind,undef(),key,states[l].heap[obj.x].next);states[l].heap[obj.x].next=property;
  }
  for(var i=0u;i<3u;i++){
    let index=select(4u+i-1u,1u,i==0u);let mask=1u<<i;
    if(has[index]){flags=(flags&~mask)|select(0u,mask,truth(values[index]));}
  }
  if(kind==3u){if(has[0]){old=values[0];}}
  else{
    if(old.z==3u){old=V(0u);}
    for(var i=2u;i<4u;i++){if(has[i]){old[i-2u]=callbackId(values[i]);}}
  }
  if(mapping!=0u&&kind==3u){
    if(has[0]){states[l].heap[mapping].value=old;}
    if((flags&1u)!=0u){kind=15u;old=V(mapping,0u,0u,0u);}
  }
  states[l].heap[property].kind=kind;states[l].heap[property].value=old;states[l].heap[property].marked=flags<<1u;
  if(arrayObject&&index!=0xffffffffu){states[l].heap[obj.x].value.y=max(states[l].heap[obj.x].value.y,index+1u);}
  return original;
}
fn descriptorObject(l:u32,value:V,flags:u32,accessor:bool)->V {
  // FromPropertyDescriptor creates four fresh own data properties, never [[Set]].
  // Reserve the object plus its four slots before direct writes (no collection).
  if(states[l].status!=0u){return undef();}
  if(states[l].freeCount<5u){states[l].status=3u;return undef();}
  let id=alloc(l,2u,V(1u,0u,0u,1u),0u,0u);let obj=V(id,0u,4u,0u);
  if(id==0u||states[l].status!=0u){return undef();}
  if(accessor){
    for(var i=0u;i<2u;i++){var v=undef();if(value[i]!=0u){v=V(value[i]&0x7fffffffu,0u,select(5u,11u,(value[i]&0x80000000u)!=0u),0u);}dataProperty(l,id,fieldKey(${F.get}u+i),v,7u);}
  }else{dataProperty(l,id,fieldKey(${F.value}u),value,7u);dataProperty(l,id,fieldKey(${F.writable}u),boolean((flags&1u)!=0u),7u);}
  dataProperty(l,id,fieldKey(${F.enumerable}u),boolean((flags&2u)!=0u),7u);
  dataProperty(l,id,fieldKey(${F.configurable}u),boolean((flags&4u)!=0u),7u);return obj;
}
fn dataProperty(l:u32,obj:u32,key:u32,value:V,flags:u32) {
  let property=alloc(l,3u,value,key,states[l].heap[obj].next);
  states[l].heap[property].marked=flags<<1u;states[l].heap[obj].next=property;
}
fn primitiveText(l:u32,value:V)->V {
  if(value.z==17u){states[l].status=4u;return undef();}
  if(value.z==18u){return phase3BigintToText(l,value,10u);}
  if(value.z==7u){return value;}
  if(value.z==1u){return image[fieldKey(select(${F['false']}u,${F['true']}u,truth(value)))];}
  if(value.z==2u){return image[fieldKey(${F['null']}u)];}
  if(value.z==3u){return image[fieldKey(${F['undefined']}u)];}
  if(value.z==0u){
    if(nan(value.xy)){return image[fieldKey(${F.NaN}u)];}
    if(value.x==0u&&(value.y&0x7fffffffu)==0x7ff00000u){return image[fieldKey(select(${F.Infinity}u,${F['-Infinity']}u,(value.y&0x80000000u)!=0u))];}
    let magnitude=Pair(value.x,value.y&0x7fffffffu);let n=toBits(magnitude);
    if(equalNumber(fromUnsigned(n),magnitude)){
      let text=unsignedText(l,n);
      if((value.y&0x80000000u)!=0u&&n!=0u){let prefix=image[fieldKey(${F['-']}u)];return makeText(l,prefix,text,0u,1u+text.y);}return text;
    }
  }
  states[l].status=6u;return undef();
}
fn makeError(l:u32,kind:u32,message:V,options:V)->V {
  var text=undef();if(message.z!=3u){text=primitiveText(l,message);}
  if(states[l].status!=0u){return undef();}
  let id=alloc(l,8u,V(4u+kind,0u,0u,1u),0u,0u);
  if(message.z!=3u){dataProperty(l,id,fieldKey(${F.message}u),text,5u);}
  let obj=objectView(l,options);
  if(obj.z==11u){states[l].status=6u;return undef();}
  if(obj.z==4u){
    var current=obj.x;var property=0u;
    for(var i=0u;i<${L.heap}u&&current!=0u&&property==0u;i++){property=findProperty(l,current,fieldKey(${F.cause}u));current=states[l].heap[current].value.x;}
    if(property!=0u){let cause=getProperty(l,options,fieldKey(${F.cause}u));
      if(cause.z==12u){states[l].status=6u;return undef();}dataProperty(l,id,fieldKey(${F.cause}u),cause,5u);}
  }
  return V(id,0u,4u,0u);
}
fn errorString(l:u32,receiver:V)->V {
  if(objectView(l,receiver).z!=4u){states[l].status=select(4u,6u,receiver.z==11u);return undef();}
  let rawName=getProperty(l,receiver,fieldKey(${F.name}u));var name=image[fieldKey(${F.Error}u)];
  if(rawName.z!=3u){name=primitiveText(l,rawName);}
  if(states[l].status!=0u){return undef();}
  let rawMessage=getProperty(l,receiver,fieldKey(${F.message}u));var message=image[fieldKey(${F['']}u)];
  if(rawMessage.z!=3u){message=primitiveText(l,rawMessage);}
  if(states[l].status!=0u){return undef();}
  if(name.y==0u){return message;}if(message.y==0u){return name;}
  let separator=image[fieldKey(${F[': ']}u)];let first=makeText(l,name,separator,0u,name.y+separator.y);
  return makeText(l,first,message,0u,first.y+message.y);
}
${phase3EnumWGSL}
// Own keys: array indices ascending, then chronological string keys, then
// symbol keys when includeSymbols is set. Property lists are newest-first.
fn nativeNonconstructor(v:V)->bool {
  if(v.z!=11u){return false;}
  switch v.x {
    ${[...new Set(stdlibFunctionMetadata.map(m=>m.id))].map(id=>`case ${id}u:{return true;}`).join('\n    ')}
    default:{return false;}
  }
}
fn ownKeys(l:u32,original:V,enumerableOnly:bool,includeSymbols:bool)->V {
  if(original.z==2u||original.z==3u){states[l].status=4u;return undef();}
  let object=objectView(l,original);
  // These native functions have complete mutable name/length backing objects.
  // Other native intrinsic key lists remain explicitly incomplete.
  if(original.z==11u&&(object.z!=4u||((object.x<80u||object.x>85u)&&object.x!=66u&&object.x!=68u))){states[l].status=6u;return undef();}
  if(original.z==5u&&states[l].heap[original.x].kind!=12u){
    let functionIndex=states[l].heap[original.x].value.x;
    if(image[functionIndex*2u+1u].y==0u){states[l].status=6u;return undef();}
  }
  if(object.z!=4u&&object.z!=7u&&object.z!=0u&&object.z!=1u){states[l].status=6u;return undef();}
  // The three wrapper prototypes do not have their complete ES2025 key lists.
  if(object.z==4u&&object.x>=20u&&object.x<=24u){states[l].status=6u;return undef();}
  if(object.z==4u&&object.x==GLOBAL_OBJECT&&!enumerableOnly){states[l].status=6u;return undef();}
  if(object.z==4u&&(object.x==26u||object.x==29u||object.x==30u||object.x==47u)){states[l].status=6u;return undef();}
  if(object.z==4u){let intrinsicKind=states[l].heap[object.x].kind;if(intrinsicKind==17u||intrinsicKind==18u||intrinsicKind==19u||intrinsicKind==21u){states[l].status=6u;return undef();}}
  // String wrappers list their exotic indices first, then other indices, then
  // length (created first), then named keys in creation order.
  var numeric=0u;var named=0u;var arrayLength=false;var exotic=0u;var symbolCount=0u;
  if(object.z==4u){
    arrayLength=states[l].heap[object.x].kind==7u&&!enumerableOnly;
    let text=wrapped(l,object.x);
    if(text.z==7u){exotic=text.y;numeric=exotic;arrayLength=!enumerableOnly;}
    var current=states[l].heap[object.x].next;
    for(var n=0u;n<${L.heap}u&&current!=0u;n++){
      let node=states[l].heap[current];
      if(phase3SymbolKey(node.key)){
        if(includeSymbols&&(!enumerableOnly||(node.marked&4u)!=0u)){symbolCount++;}
      }else if(!enumerableOnly||(node.marked&4u)!=0u){
        if(arrayIndex(l,node.key)!=0xffffffffu){numeric++;}else{named++;}
      }
      current=node.next;
    }
  }else if(object.z==7u){numeric=object.y;arrayLength=!enumerableOnly;}
  let stringCount=numeric+named+select(0u,1u,arrayLength);
  let count=stringCount+symbolCount;
  let result=alloc(l,7u,V(2u,count,0u,1u),0u,0u);let value=V(result,0u,4u,0u);
  if(arrayLength){dataProperty(l,result,0x80000000u|numeric,image[fieldKey(${F.length}u)],7u);}
  if(object.z==7u){
    for(var i=0u;i<numeric&&states[l].status==0u;i++){dataProperty(l,result,0x80000000u|i,unsignedText(l,i),7u);}
    return value;
  }
  if(object.z!=4u){return value;}
  var nextName=stringCount;var current=states[l].heap[object.x].next;
  for(var n=0u;n<${L.heap}u&&current!=0u&&states[l].status==0u;n++){
    let node=states[l].heap[current];
    if(!phase3SymbolKey(node.key)&&arrayIndex(l,node.key)==0xffffffffu&&(!enumerableOnly||(node.marked&4u)!=0u)){
      nextName--;dataProperty(l,result,0x80000000u|nextName,keyName(l,node.key),7u);
    }
    current=node.next;
  }
  for(var i=0u;i<exotic&&states[l].status==0u;i++){dataProperty(l,result,0x80000000u|i,unsignedText(l,i),7u);}
  var minimum=0u;
  for(var i=exotic;i<numeric&&states[l].status==0u;i++){
    var found=0xffffffffu;current=states[l].heap[object.x].next;
    for(var n=0u;n<${L.heap}u&&current!=0u;n++){
      let node=states[l].heap[current];let index=arrayIndex(l,node.key);
      if(index!=0xffffffffu&&index>=minimum&&(!enumerableOnly||(node.marked&4u)!=0u)){found=min(found,index);}
      current=node.next;
    }
    if(found==0xffffffffu){states[l].status=6u;return undef();}
    dataProperty(l,result,0x80000000u|i,unsignedText(l,found),7u);minimum=found+1u;
  }
  if(includeSymbols){
    var slot=count;current=states[l].heap[object.x].next;
    for(var n=0u;n<${L.heap}u&&current!=0u&&states[l].status==0u;n++){
      let node=states[l].heap[current];
      if(phase3SymbolKey(node.key)&&(!enumerableOnly||(node.marked&4u)!=0u)){
        slot--;dataProperty(l,result,0x80000000u|slot,V(node.key&0x1fffffffu,0u,17u,0u),7u);
      }
      current=node.next;
    }
  }
  return value;
}
fn objectMethod(l:u32,method:u32,receiver:V,original:V,b:V,c:V)->V {
  var id=method;if(id==901u){id=102u;}if(id==902u){id=107u;}
  let a=objectView(l,original);
  ${asyncIterationObjectMethodWGSL}
  ${promiseThenObjectMethodWGSL}
  ${promiseCoreObjectMethodWGSL}
  ${functionSourceDispatchWGSL}
  ${phase3BigintComparisonDispatchWGSL}
  ${phase3BigintPowDispatchWGSL}
  ${jsonPhase5CodeUnitWGSL}
  // InternalizeJSONProperty ignores ordinary [[Delete]] / CreateDataProperty
  // false results, but must preserve every genuine abrupt/unsupported status.
  // Keys are normalized strings produced by the trusted JSON traversal.
  if(id==1860u||id==1861u){
    let key=keyOf(l,b);if(states[l].status!=0u){return undef();}
    if(!functionKey(l,original,key)){return undef();}
    if(a.z!=4u){states[l].status=6u;return undef();}
    if(ownGap(l,a.x,key)){return undef();}
    let arrayObject=states[l].heap[a.x].kind==7u;
    // Trusted traversal visits array indices only. Defining array length can
    // perform coercion before descriptor rejection; keep that unreachable
    // contract violation explicit rather than suppressing possible side effects.
    if(arrayObject&&lengthKey(l,key)){if(id==1861u){states[l].status=6u;return undef();}return boolean(false);}
    if(stringOwn(l,a.x,key)!=0u){return boolean(false);}
    var property=findProperty(l,a.x,key);
    if(property!=0u){
      if(states[l].heap[property].kind==11u){states[l].status=6u;return undef();}
      if((states[l].heap[property].marked&8u)==0u){return boolean(false);}
    }
    if(id==1860u){
      if(property!=0u){
        var previous=a.x;
        for(var i=0u;i<${L.heap}u&&states[l].heap[previous].next!=property;i++){previous=states[l].heap[previous].next;}
        states[l].heap[previous].next=states[l].heap[property].next;
        states[l].heap[property].next=0u;
      }
      return boolean(true);
    }
    let index=arrayIndex(l,key);
    if(arrayObject&&index!=0xffffffffu&&index>=states[l].heap[a.x].value.y&&(states[l].heap[a.x].value.z&1u)!=0u){return boolean(false);}
    if(property==0u){
      if(states[l].heap[a.x].value.w==0u){return boolean(false);}
      property=alloc(l,3u,c,key,states[l].heap[a.x].next);
      if(states[l].status!=0u){return undef();}
      states[l].heap[a.x].next=property;
    }else if(states[l].heap[property].kind==15u){
      // Mapped arguments keep their binding when redefined writable=true.
      states[l].heap[states[l].heap[property].value.x].value=c;
      states[l].heap[property].marked=14u;
      return boolean(true);
    }
    states[l].heap[property].kind=3u;states[l].heap[property].value=c;
    states[l].heap[property].marked=14u;
    if(arrayObject&&index!=0xffffffffu){states[l].heap[a.x].value.y=max(states[l].heap[a.x].value.y,index+1u);}
    return boolean(true);
  }
  // JSON wrapper inspection reads only actual internal slots, never public
  // valueOf/toString or a forged prototype chain. Primitive inputs are not boxes.
  ${stringCaseDispatchWGSL}
  if(id==${jsonStringifyNewIntrinsics.__lanesJSONWrapperKind}u){
    if(original.z!=4u){return num(fromUnsigned(0u));}
    let primitive=wrapped(l,original.x);var kind=0u;
    if(primitive.z==0u){kind=1u;}else if(primitive.z==7u){kind=2u;}
    else if(primitive.z==1u){kind=3u;}else if(primitive.z==18u){kind=4u;}
    return num(fromUnsigned(kind));
  }
  if(id==${jsonStringifyNewIntrinsics.__lanesJSONWrapperValue}u){
    if(original.z==4u){let primitive=wrapped(l,original.x);if(primitive.z==1u){return primitive;}}
    states[l].status=6u;return undef();
  }
  if(id>=920u&&id<=949u){return boxingMethod(l,id,receiver,original,b,c);}
  if(id==141u){states[l].status=6u;return undef();}
  if(id==140u||id==710u||id==716u){let enumerableOnly=id==716u||(id==140u&&truth(b));let includeSymbols=id==140u&&!truth(b);return ownKeys(l,original,enumerableOnly,includeSymbols);}
  ${phase4ObjectMethods(phase4Context).join('\n  ')}
  ${asyncGeneratorObjectMethodWGSL}
  ${stdlibObjectMethodWGSL()}
  ${stdlibCallWithoutNewWGSL}
  if(id==138u){
    if(original.z==2u||original.z==3u){states[l].status=4u;return undef();}
    if(original.z!=4u&&original.z!=5u&&original.z!=11u){states[l].status=6u;return undef();}
    return original;
  }
  if(id==137u){return boolean(truth(original));}
  if(id==135u){if(original.z!=0u){states[l].status=6u;return undef();}return num(fromUnsigned(select(original.x,original.y,truth(b))));}
  if(id==123u){return num(Pair(toBits(original.xy),toBits(b.xy)));}
  if(id==126u){
    if(a.z!=4u||states[l].heap[a.x].kind!=7u){states[l].status=4u;return undef();}
    let desc=alloc(l,2u,V(0u,0u,0u,1u),0u,0u);dataProperty(l,desc,fieldKey(${F.value}u),b,7u);
    let ignored=descriptor(l,original,fieldKey(${F.length}u),V(desc,0u,4u,0u));
    if(states[l].status==4u&&!truth(c)){states[l].status=0u;}return undef();
  }

  if(id==115u){return num(fromUnsigned(applyLength(l,original)));}
  if(id==117u){
    var length=Pair(0u);
    if(original.z==0u&&!nan(original.xy)&&lessNumber(Pair(0u),original.xy)){
      let integer=truncatePositive(original.xy);let amount=b.xy;
      if(lessNumber(amount,integer)){length=plus(integer,Pair(amount.x,amount.y^0x80000000u));}
    }
    return num(length);
  }
  if(id==118u){
    if(original.z!=5u||states[l].heap[original.x].kind!=12u){states[l].status=4u;return undef();}
    let property=findProperty(l,a.x,fieldKey(${F.length}u));states[l].heap[property].value=b;
    functionName(l,original,c,true);return original;
  }
  if(id==119u){
    if(original.z==11u&&(${phase5Methods.map(m=>`original.x==${m.id}u`).join("||")})){return boolean(true);}
    if(original.z==11u&&original.x>=800u&&original.x<=807u){return boolean(true);}
    ${promiseCombinatorsHasOwnLengthWGSL()}
    if(original.z==11u&&original.x==2000u){return boolean(true);}
    if(original.z==11u&&(${boxingMethods.map(item=>`original.x==${item.id}u`).join('||')})){return boolean(true);}
    if(a.z==4u){return boolean(findProperty(l,a.x,fieldKey(${F.length}u))!=0u);}
    if(original.z==11u&&(original.x==100u||original.x==500u||original.x==122u||original.x==136u||original.x==137u)){return boolean(true);}
    states[l].status=6u;return undef();
  }

  if(id==700u){states[l].status=4u;return undef();}
  if(id==201u){return boolean(a.z==4u&&states[l].heap[a.x].kind==7u);}
  if(id==110u){let key=keyOf(l,b);if(states[l].status!=0u){return undef();}return descriptor(l,original,key,c);}
  if(id==111u){return primitiveText(l,original);}
  if(id==133u){if(c.z!=0u||toBits(c.xy)>6u){states[l].status=6u;return undef();}return makeError(l,toBits(c.xy),original,b);}
  if(id==112u){return V(alloc(l,2u,V(0u,0u,0u,1u),0u,0u),0u,4u,0u);}
  ${promiseCombinatorsObjectMethodWGSL()}
  if(id>=600u&&id<=606u){return makeError(l,id-600u,original,b);}
  if(id==650u){return errorString(l,receiver);}
  if(id==400u){return undef();}
  if(id==151u||id==153u){
    let receiverObject=objectView(l,receiver);let primitive=wrapperPrototype(receiver)!=0u;
    if(receiverObject.z!=4u&&!primitive){states[l].status=select(6u,4u,receiverObject.z==2u||receiverObject.z==3u);return undef();}
    let key=keyOf(l,original);if(states[l].status!=0u){return undef();}if(!functionKey(l,receiver,key)){return undef();}
    // ToObject(primitive) has only the string exotic properties of its value.
    if(primitive){let own=textOwn(l,receiver,key);return boolean(own==1u||(id==151u&&own!=0u));}
    if(ownGap(l,receiverObject.x,key)){return undef();}
    let property=findProperty(l,receiverObject.x,key);let arrayLength=states[l].heap[receiverObject.x].kind==7u&&lengthKey(l,key);
    let stringKind=stringOwn(l,receiverObject.x,key);
    if(id==151u){return boolean(property!=0u||arrayLength||stringKind!=0u);}
    return boolean((property!=0u&&(states[l].heap[property].marked&4u)!=0u)||stringKind==1u);
  }
  if(id==152u){
    let receiverObject=objectView(l,receiver);
    if(a.z==11u||receiverObject.z==11u){states[l].status=6u;return undef();}
    if(a.z!=4u){return boolean(false);}
    // A fresh ToObject(primitive) wrapper is on no existing prototype chain.
    if(wrapperPrototype(receiver)!=0u){return boolean(false);}
    if(receiverObject.z!=4u){states[l].status=select(6u,4u,receiverObject.z==2u||receiverObject.z==3u);return undef();}
    var current=states[l].heap[a.x].value.x;var found=false;
    for(var i=0u;i<${L.heap}u&&current!=0u&&!found;i++){found=current==receiverObject.x;current=states[l].heap[current].value.x;}
    return boolean(found);
  }
  if(id==155u){
    let tagKey=0x60000000u|${phase3ToStringTagNode}u;
    var tagValue=undef();
    if(receiver.z==17u||receiver.z==18u||wrapperPrototype(receiver)!=0u||objectView(l,receiver).z==4u){tagValue=getProperty(l,receiver,tagKey);}
    if(states[l].status!=0u){return undef();}
    if(tagValue.z==12u){states[l].status=6u;return undef();}
    if(tagValue.z==7u){
      let prefix=image[fieldKey(${F['[object ']}u)];
      let suffix=image[fieldKey(${F[']']}u)];
      let mid=makeText(l,prefix,tagValue,0u,prefix.y+tagValue.y);
      if(states[l].status!=0u){return undef();}
      return makeText(l,mid,suffix,0u,mid.y+suffix.y);
    }
    var key=${F['[object Object]']}u;
    switch receiver.z {
      case 0u:{key=${F['[object Number]']}u;}
      case 1u:{key=${F['[object Boolean]']}u;}
      case 2u:{key=${F['[object Null]']}u;}
      case 3u:{key=${F['[object Undefined]']}u;}
      case 5u,11u:{key=${F['[object Function]']}u;}
      case 7u:{key=${F['[object String]']}u;}
      case 4u:{let kind=states[l].heap[receiver.x].kind;
        if(kind==7u){key=${F['[object Array]']}u;}else if(kind==8u){key=${F['[object Error]']}u;}else if(kind==14u){key=${F['[object Arguments]']}u;}
        else if(kind==16u){let tag=wrapped(l,receiver.x).z;key=select(select(${F['[object String]']}u,${F['[object Boolean]']}u,tag==1u),${F['[object Number]']}u,tag==0u);if(tag!=0u&&tag!=1u&&tag!=7u){key=${F['[object Object]']}u;}}}
      case 17u,18u:{key=${F['[object Object]']}u;}
      default:{states[l].status=6u;return undef();}
    }
    return image[fieldKey(key)];
  }
  if(id==1000u){
    if(original.z==3u){return symbol_construct(l,false,original);}
    if(original.z==17u){states[l].status=4u;return undef();}
    let described=phase3SymbolArgument(l,original);if(states[l].status!=0u){return undef();}return symbol_construct(l,false,described);
  }
  if(id==1001u){let keyTextValue=phase3SymbolArgument(l,original);if(states[l].status!=0u){return undef();}return symbol_for(l,keyTextValue);}
  if(id==1002u){return symbol_key_for(l,original);}
  if(id==1003u){let sym=phase3SymbolThis(l,receiver);if(states[l].status!=0u){return undef();}return symbol_prototype_to_string(l,sym);}
  if(id==1004u){let sym=phase3SymbolThis(l,receiver);if(states[l].status!=0u){return undef();}return symbol_prototype_value_of(l,sym);}
  if(id==1005u){let sym=phase3SymbolThis(l,receiver);if(states[l].status!=0u){return undef();}return symbol_prototype_description(l,sym);}
  if(id==1050u){return phase3OwnSymbols(l,original);}
  if(id==1051u){if(original.z!=4u&&original.z!=5u&&original.z!=11u){states[l].status=4u;return undef();}return ownKeys(l,original,false,true);}
  if(id==1100u){return phase3SymbolThis(l,receiver);}
${phase3BigintConversionDispatchWGSL}
${phase3BigintWidthDispatchWGSL}
  if(id==1152u){return phase3BigintThis(l,receiver);}
  if(id==156u){if(objectView(l,receiver).z==4u){return receiver;}if(wrapperPrototype(receiver)!=0u){return wrap(l,receiver);}states[l].status=select(6u,4u,receiver.z==2u||receiver.z==3u);return undef();}
  if(id==2362u){return commitPrototype(l,original,b);}
  if(id>=150u){states[l].status=6u;return undef();}
  if(id==120u){let obj=objectView(l,receiver);if(wrapperPrototype(receiver)!=0u){return objectValue(l,wrapperPrototype(receiver));}if(obj.z!=4u){states[l].status=select(6u,4u,obj.z==2u||obj.z==3u);return undef();}return objectValue(l,states[l].heap[obj.x].value.x);}
  if((id==108u||id==109u)&&a.z==11u){states[l].status=6u;return undef();}
  if(id==106u){return boolean(sameValue(l,original,b));}
  if(id==108u){if(a.z==4u){states[l].heap[a.x].value.w=0u;}return original;}
  if(id==109u){return boolean(a.z==4u && states[l].heap[a.x].value.w!=0u);}
  if(id==103u){
    if(a.z==11u){states[l].status=6u;return undef();}
    if(a.z!=4u&&a.z!=2u){states[l].status=4u;return undef();}if(b.z!=3u){states[l].status=6u;return undef();}
    var proto=0u;if(a.z==4u){proto=a.x;}let obj=alloc(l,2u,V(proto,0u,0u,1u),0u,0u);return V(obj,0u,4u,0u);
  }
  if(id==100u){if(a.z==4u){return original;}if(a.z==2u||a.z==3u){let obj=alloc(l,2u,V(1u,0u,0u,1u),0u,0u);return V(obj,0u,4u,0u);}
    if(wrapperPrototype(original)!=0u){return wrap(l,original);}states[l].status=6u;return undef();}
  // getPrototypeOf, getOwnPropertyDescriptor and hasOwn apply ToObject first;
  // only string primitives then have own (exotic) properties.
  if((id==102u||id==104u||id==107u)&&wrapperPrototype(original)!=0u){
    if(id==104u){return objectValue(l,wrapperPrototype(original));}
    let key=keyOf(l,b);if(states[l].status!=0u){return undef();}
    let own=textOwn(l,original,key);
    if(id==107u){return boolean(own!=0u);}
    if(own==0u){return undef();}
    return descriptorObject(l,textOwnValue(l,original,key),select(0u,2u,own==1u),false);
  }
  if((id==102u||id==107u)&&a.z==11u&&nativeNonconstructor(original)){
    let key=keyOf(l,b);if(states[l].status!=0u){return undef();}
    if(field(l,key,${F.prototype}u)){if(id==107u){return boolean(false);}return undef();}
  }
  if(a.z!=4u){states[l].status=select(6u,4u,a.z==2u||a.z==3u||(id==101u&&a.z!=11u));return undef();}
  if(id==104u){return objectValue(l,states[l].heap[a.x].value.x);}
  if(id==101u){let key=keyOf(l,b);if(states[l].status!=0u){return undef();}return descriptor(l,original,key,c);}
  if(id==102u||id==107u){
    let key=keyOf(l,b);if(states[l].status!=0u){return undef();}if(!functionKey(l,original,key)){return undef();}if(ownGap(l,a.x,key)){return undef();}let property=findProperty(l,a.x,key);let arrayLength=states[l].heap[a.x].kind==7u&&lengthKey(l,key);
    let stringKind=stringOwn(l,a.x,key);
    if(id==107u){return boolean(property!=0u||arrayLength||stringKind!=0u);}
    if(stringKind!=0u){return descriptorObject(l,textOwnValue(l,wrapped(l,a.x),key),select(0u,2u,stringKind==1u),false);}
    if(arrayLength){return descriptorObject(l,num(fromUnsigned(states[l].heap[a.x].value.y)),select(0u,1u,(states[l].heap[a.x].value.z&1u)==0u),false);}
    if(property==0u){return undef();}let node=states[l].heap[property];var value=node.value;if(node.kind==15u){value=states[l].heap[value.x].value;}return descriptorObject(l,value,(node.marked>>1u)&7u,node.kind==9u||node.kind==11u);
  }
  states[l].status=6u;return undef();
}
${promiseThenWGSLFunctions({L})}
fn instanceOf(l:u32,value:V,original:V)->V {
  // Custom hooks precede ordinary callable checks and bound-target unwrapping.
  var hookObject=objectView(l,original);var hookCurrent=0u;
  if(hookObject.z==4u){hookCurrent=hookObject.x;}
  for(var i=0u;i<${L.heap}u&&hookCurrent!=0u;i++){
    let property=findProperty(l,hookCurrent,0x60000000u|${phase3HasInstanceNode}u);
    if(property!=0u){let node=states[l].heap[property];if(node.kind==9u||(node.value.z!=2u&&node.value.z!=3u)){states[l].status=6u;return undef();}break;}
    hookCurrent=states[l].heap[hookCurrent].value.x;
  }
  var callee=original;
  for(var i=0u;i<${L.frames}u&&callee.z==5u&&states[l].heap[callee.x].kind==12u;i++){
    let bound=states[l].heap[callee.x];callee=V(bound.value.x,0u,bound.value.z,0u);
  }
  if(callee.z==5u&&states[l].heap[callee.x].kind==12u){states[l].status=3u;return undef();}
  if(callee.z!=5u&&callee.z!=11u){states[l].status=4u;return undef();}
  let calleeObject=objectView(l,callee);
  if(calleeObject.z==4u&&findProperty(l,calleeObject.x,0x60000000u|${phase3HasInstanceNode}u)!=0u){states[l].status=6u;return undef();}
  if(value.z!=4u&&value.z!=5u&&value.z!=11u){return boolean(false);}
  var prototype=undef();
  if(callee.z==11u&&callee.x==200u){prototype=V(2u,0u,4u,0u);}
  else if(callee.z==11u&&(callee.x==136u||callee.x==122u||callee.x==137u)){prototype=getProperty(l,callee,fieldKey(${F.prototype}u));}
  else if(objectView(l,callee).z==4u||callee.x==100u||callee.x==500u){prototype=objectView(l,getProperty(l,callee,fieldKey(${F.prototype}u)));}
  if(states[l].status!=0u){return undef();}
  if(prototype.z==11u||prototype.z==12u){states[l].status=6u;return undef();}
  if(prototype.z!=4u){states[l].status=4u;return undef();}
  let obj=objectView(l,value);var current=3u;
  if(obj.z==4u){
    current=states[l].heap[obj.x].value.x;
  }
  var found=false;
  for(var i=0u;i<${L.heap}u&&current!=0u&&!found;i++){found=current==prototype.x;current=states[l].heap[current].value.x;}
  return boolean(found);
}
fn stringIndex(l:u32,v:V,length:u32,relative:bool)->u32 {
  if(v.z>=4u){states[l].status=6u;return 0u;}
  let n=v.xy;if(nan(n)||zero(n)){return 0u;}
  let magnitude=Pair(n.x,n.y&0x7fffffffu);
  if(lessNumber(magnitude,Pair(0u,0x3ff00000u))){return 0u;}
  let negative=(n.y&0x80000000u)!=0u;
  if(!lessNumber(magnitude,fromUnsigned(length))){return select(length,0u,negative&&relative);}
  let integer=toBits(magnitude);
  if(negative){return select(length,length-integer,relative);}return integer;
}
fn stringMethod(l:u32,id:u32,receiver:V,a:V,b:V)->V {
  if(receiver.z!=7u){states[l].status=4u;return undef();}
  if(id==3u){let start=stringIndex(l,a,receiver.y,true);var end=receiver.y;
    if(b.z!=3u){end=stringIndex(l,b,receiver.y,true);}return makeText(l,receiver,undef(),start,select(0u,end-start,end>start));}
  let index=stringIndex(l,a,receiver.y,false);
  if(id==1u){if(index>=receiver.y){return num(qnan());}return num(fromUnsigned(unit(l,receiver,index)));}
  return makeText(l,receiver,undef(),index,select(0u,1u,index<receiver.y));
}
fn binary(l: u32, op: u32, a: V, b: V) -> V {
  if (op==${OP.strict_eq}u || op==${OP.strict_neq}u) { return boolean(equal(l,a,b)!=(op==${OP.strict_neq}u)); }
  if (op==${OP.eq}u || op==${OP.neq}u) {
    var same=false;
    if (a.z==b.z) { same=equal(l,a,b); }
    else if ((a.z==2u || a.z==3u) && (b.z==2u || b.z==3u)) { same=true; }
    else if (a.z<2u && b.z<2u) { same=equalNumber(a.xy,b.xy); }
    else if (a.z==2u || a.z==3u || b.z==2u || b.z==3u) { same=false; }
    else { states[l].status=6u; }
    return boolean(same!=(op==${OP.neq}u));
  }
  if(a.z==7u && b.z==7u){
    if(op==${OP.add}u){return makeText(l,a,b,0u,a.y+b.y);}
    if(op==${OP.lt}u||op==${OP.lte}u||op==${OP.gt}u||op==${OP.gte}u){
      var order=0i;
      for(var i=0u;i<min(a.y,b.y)&&order==0i;i++){let x=unit(l,a,i);let y=unit(l,b,i);if(x!=y){order=select(1i,-1i,x<y);}}
      if(order==0i && a.y!=b.y){order=select(1i,-1i,a.y<b.y);}
      if(op==${OP.lt}u){return boolean(order<0i);}if(op==${OP.lte}u){return boolean(order<=0i);}
      if(op==${OP.gt}u){return boolean(order>0i);}return boolean(order>=0i);
    }
  }
  if (a.z>=4u || b.z>=4u) { states[l].status=6u; return undef(); }
  switch op {
    ${cases('add', 'return num(plus(a.xy,b.xy));')}
    ${cases('sub', 'return num(plus(a.xy,Pair(b.x,b.y^0x80000000u)));')}
    ${cases('mul', 'return num(times(a.xy,b.xy));')}
    ${cases('div', 'return num(divide(a.xy,b.xy));')}
    ${cases('mod', 'return num(remainder(a.xy,b.xy));')}
    ${cases('lt', 'return boolean(lessNumber(a.xy,b.xy));')}
    ${cases('lte', 'return boolean(lessNumber(a.xy,b.xy)||equalNumber(a.xy,b.xy));')}
    ${cases('gt', 'return boolean(lessNumber(b.xy,a.xy));')}
    ${cases('gte', 'return boolean(lessNumber(b.xy,a.xy)||equalNumber(a.xy,b.xy));')}
    ${cases('and', 'return num(fromSigned(toBits(a.xy)&toBits(b.xy)));')}
    ${cases('or', 'return num(fromSigned(toBits(a.xy)|toBits(b.xy)));')}
    ${cases('xor', 'return num(fromSigned(toBits(a.xy)^toBits(b.xy)));')}
    ${cases('shl', 'return num(fromSigned(toBits(a.xy)<<(toBits(b.xy)&31u)));')}
    ${cases('sar', 'return num(fromSigned(bitcast<u32>(bitcast<i32>(toBits(a.xy))>>(toBits(b.xy)&31u))));')}
    ${cases('shr', 'return num(fromUnsigned(toBits(a.xy)>>(toBits(b.xy)&31u)));')}
    default: { states[l].status=2u; return undef(); }
  }
}
${stringCaseWGSL}
${functionSourceWGSL({F,methods:[...phase5Methods,...boxingMethods,...objectStaticPlaceholders,...stringSearchMetadata,...stringExtractMetadata]})}
${promiseCoreWGSLFunctions({F,L})}
${promiseJobWGSLFunctions({F})}
${asyncIterationShaderFunctions({F,L,OP})}
${scriptEntryWGSL}
${phase4WGSLFunctions(phase4Context)}
${stdlibWGSLFunctions(phase4Context)}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let l=gid.x; if (l>=params.count) { return; }
  if (states[l].ready==0u) {
    // Free list skips the reserved fixed nodes ${FIXED_RESERVED_FIRST}..${FIXED_RESERVED_LAST} (phase4-fixed-nodes.js):
    // node ${FIXED_INIT_LAST} links straight to ${FIXED_RESERVED_LAST+1}, so alloc() can never return a reserved node.
    states[l].ready=1u; states[l].pad=0u; states[l].freeHead=1u; states[l].freeCount=${L.heap-1-FIXED_RESERVED_COUNT}u;
    for (var i=1u;i<${L.heap-1}u;i++) { states[l].heap[i].next=i+1u; }
    states[l].heap[${FIXED_INIT_LAST}u].next=${FIXED_RESERVED_LAST+1}u;
    for (var i=${FIXED_RESERVED_FIRST}u;i<=${FIXED_RESERVED_LAST}u;i++) { states[l].heap[i]=Node(V(0u),0u,0u,0u,0u); }
    let objectProto=alloc(l,2u,V(0u,0u,1u,1u),0u,0u);
    let arrayProto=alloc(l,7u,V(objectProto,0u,2u,1u),0u,0u);
    let functionProto=alloc(l,2u,V(objectProto,0u,0u,1u),0u,0u);
    for(var i=0u;i<7u;i++){let id=alloc(l,2u,V(select(4u,1u,i==0u),0u,0u,1u),0u,0u);}
    for(var i=0u;i<7u;i++){let id=alloc(l,2u,V(select(11u,3u,i==0u),0u,0u,1u),0u,0u);}
    let arrayConstructor=alloc(l,2u,V(3u,0u,0u,1u),0u,0u);
    let objectConstructor=alloc(l,2u,V(3u,0u,0u,1u),0u,0u);
    // Nodes 20-22, immediately after the Object constructor (19).
    let stringProto=alloc(l,16u,V(objectProto,0u,0u,1u),0u,0u);
    let numberProto=alloc(l,16u,V(objectProto,0u,0u,1u),0u,0u);
    let booleanProto=alloc(l,16u,V(objectProto,0u,0u,1u),0u,0u);
    let mathObject=alloc(l,2u,V(objectProto,0u,0u,1u),0u,0u);
    let numberConstructor=alloc(l,2u,V(functionProto,0u,0u,1u),0u,0u);
    let jsonObject=alloc(l,2u,V(objectProto,0u,0u,1u),0u,0u);
    if(jsonObject!=${FIXED_INIT_LAST}u){states[l].status=2u;}
    // Fixed node ${TEMPLATE_REGISTRY_NODE}: tagged template registry (phase4-templates.js), kind 32; written in place, never allocated.
    states[l].heap[TEMPLATE_REGISTRY]=Node(V(0u),0u,0u,32u,0u);
    // Phase3 uses nodes reserved from allocation and collection by phase4.
    let symbolCtor=26u;let symbolProto=27u;let symbolRegistry=28u;
    let bigintCtor=29u;let bigintProto=30u;let wk0=31u;
    let wellKnownTable=46u;let reflectObject=47u;
    states[l].heap[symbolCtor]=Node(V(3u,0u,0u,1u),0u,0u,2u,0u);
    states[l].heap[symbolProto]=Node(V(1u,0u,0u,1u),0u,0u,2u,0u);
    states[l].heap[symbolRegistry]=Node(V(0u,1u,0u,1024u),0u,0u,18u,0u);
    symbol_init_registry_fields(l);
    states[l].heap[bigintCtor]=Node(V(3u,0u,0u,1u),0u,0u,2u,0u);
    states[l].heap[bigintProto]=Node(V(1u,0u,0u,1u),0u,0u,2u,0u);
    for(var i=0u;i<15u;i++){let cell=31u+i;states[l].heap[cell]=Node(V(cell,0u,0u,0u),0u,0u,17u,0u);}
    states[l].heap[wellKnownTable]=Node(V(wk0,15u,0u,0u),0u,0u,21u,0u);
    states[l].heap[reflectObject]=Node(V(objectProto,0u,0u,1u),0u,0u,2u,0u);
    states[l].heap[stringProto].value.y=alloc(l,13u,image[fieldKey(${F['']}u)],0u,0u);
    states[l].heap[numberProto].value.y=alloc(l,13u,num(Pair(0u)),0u,0u);
    states[l].heap[booleanProto].value.y=alloc(l,13u,boolean(false),0u,0u);
    dataProperty(l,stringProto,fieldKey(${F.constructor}u),V(136u,0u,11u,0u),5u);
    ${[...stringPrototypeMethods, ...stringSearchMetadata, ...stringExtractMetadata,...stringPhase5Metadata,...stringCaseMetadata].map(item=>`dataProperty(l,stringProto,fieldKey(${F[item.name]}u),V(${item.id}u,0u,11u,0u),5u);`).join('\n    ')}
    ${stringPhase5Aliases.map(m=>`dataProperty(l,stringProto,fieldKey(${F[m.name]}u),V(${m.id}u,0u,11u,0u),5u);`).join("\n    ")}
    dataProperty(l,numberProto,fieldKey(${F.constructor}u),V(122u,0u,11u,0u),5u);
    ${numberPrototypeMethods.map(item=>`dataProperty(l,numberProto,fieldKey(${F[item.name]}u),V(${item.id}u,0u,11u,0u),5u);`).join('\n    ')}
    dataProperty(l,booleanProto,fieldKey(${F.constructor}u),V(137u,0u,11u,0u),5u);
    ${booleanPrototypeMethods.map(item=>`dataProperty(l,booleanProto,fieldKey(${F[item.name]}u),V(${item.id}u,0u,11u,0u),5u);`).join('\n    ')}
    dataProperty(l,numberConstructor,fieldKey(${F.name}u),image[fieldKey(${F.Number}u)],4u);
    dataProperty(l,numberConstructor,fieldKey(${F.length}u),num(fromUnsigned(1u)),4u);
    dataProperty(l,numberConstructor,fieldKey(${F.prototype}u),V(numberProto,0u,4u,0u),0u);
    ${[...jsonPhase5Metadata,...jsonStringifyMetadata].map(m=>`dataProperty(l,jsonObject,fieldKey(${F[m.name]}u),V(${m.id}u,0u,11u,0u),5u);`).join("\n    ")}
    ${[...numberPhase5Metadata,...numberParseMetadata].map(m=>`dataProperty(l,numberConstructor,fieldKey(${F[m.name]}u),V(${m.id}u,0u,11u,0u),5u);`).join("\n    ")}
    ${mathPhase5Metadata.map(m=>`dataProperty(l,mathObject,fieldKey(${F[m.name]}u),V(${m.id}u,0u,11u,0u),5u);`).join("\n    ")}
    ${Object.entries(numberPhase5Constants).map(([name,value])=>{const w=numberWords(value);return `dataProperty(l,numberConstructor,fieldKey(${F[name]}u),V(${w[0]}u,${w[1]}u,0u,0u),0u);`;}).join("\n    ")}
    ${Object.entries(mathPhase5Constants).map(([name,value])=>{const w=numberWords(value);return `dataProperty(l,mathObject,fieldKey(${F[name]}u),V(${w[0]}u,${w[1]}u,0u,0u),0u);`;}).join("\n    ")}
    dataProperty(l,objectConstructor,fieldKey(${F.name}u),image[fieldKey(${F.Object}u)],4u);
    dataProperty(l,objectConstructor,fieldKey(${F.length}u),num(fromUnsigned(1u)),4u);
    dataProperty(l,objectConstructor,fieldKey(${F.prototype}u),V(objectProto,0u,4u,0u),0u);
    for(var i=1u;i<=9u;i++){dataProperty(l,objectConstructor,fieldKey(i),V(100u+i,0u,11u,0u),5u);}
    ${objectStaticPlaceholders.map(item=>`dataProperty(l,objectConstructor,fieldKey(${F[item.name]}u),V(${item.id}u,0u,11u,0u),5u);`).join('\n    ')}
    dataProperty(l,arrayConstructor,fieldKey(${F.name}u),image[fieldKey(${F.Array}u)],4u);
    dataProperty(l,arrayConstructor,fieldKey(${F.length}u),num(fromUnsigned(1u)),4u);
    dataProperty(l,arrayConstructor,fieldKey(${F.prototype}u),V(arrayProto,0u,4u,0u),0u);
    let arrayStatics=array<u32,4>(${F.isArray}u,${F.of}u,${F.from}u,${F.fromAsync}u);
    for(var i=0u;i<4u;i++){dataProperty(l,arrayConstructor,fieldKey(arrayStatics[i]),V(201u+i,0u,11u,0u),5u);}
    let errorNames=array<u32,7>(${F.Error}u,${F.TypeError}u,${F.ReferenceError}u,${F.RangeError}u,${F.SyntaxError}u,${F.URIError}u,${F.EvalError}u);
    for(var i=0u;i<7u;i++){
      let name=image[fieldKey(errorNames[i])];let prototype=4u+i;let constructor=11u+i;
      dataProperty(l,prototype,fieldKey(${F.name}u),name,5u);
      dataProperty(l,prototype,fieldKey(${F.message}u),image[fieldKey(${F['']}u)],5u);
      dataProperty(l,prototype,fieldKey(${F.constructor}u),V(600u+i,0u,11u,0u),5u);
      dataProperty(l,constructor,fieldKey(${F.name}u),name,4u);
      dataProperty(l,constructor,fieldKey(${F.length}u),num(fromUnsigned(1u)),4u);
      dataProperty(l,constructor,fieldKey(${F.prototype}u),V(prototype,0u,4u,0u),0u);
    }
    dataProperty(l,4u,fieldKey(${F.toString}u),V(650u,0u,11u,0u),5u);
    let functionKeys=array<u32,7>(${F.name}u,${F.length}u,${F.constructor}u,${F.call}u,${F.apply}u,${F.bind}u,${F.toString}u);
    for(var i=0u;i<7u;i++){
      var value=V(398u+i,0u,11u,0u);var flags=10u;
      if(i==0u){value=image[fieldKey(${F['']}u)];flags=8u;}
      if(i==1u){value=num(fromUnsigned(0u));flags=8u;}
      if(i==2u){value=V(500u,0u,11u,0u);}
      let property=alloc(l,3u,value,fieldKey(functionKeys[i]),states[l].heap[functionProto].next);
      states[l].heap[property].marked=flags;states[l].heap[functionProto].next=property;
    }
    states[l].heap[80u]=Node(V(3u,0u,0u,1u),0u,0u,2u,0u);
    dataProperty(l,80u,fieldKey(${F.length}u),num(fromUnsigned(1u)),4u);
    dataProperty(l,80u,fieldKey(${F.name}u),image[fieldKey(${F['[Symbol.hasInstance]']}u)],4u);
    states[l].heap[81u]=Node(V(3u,0u,0u,1u),0u,0u,2u,0u);
    dataProperty(l,81u,fieldKey(${F.length}u),num(fromUnsigned(0u)),4u);
    dataProperty(l,81u,fieldKey(${F.name}u),image[fieldKey(${F['[Symbol.iterator]']}u)],4u);
    states[l].heap[82u]=Node(V(3u,0u,0u,1u),0u,0u,2u,0u);
    dataProperty(l,82u,fieldKey(${F.length}u),num(fromUnsigned(0u)),4u);
    dataProperty(l,82u,fieldKey(${F.name}u),image[fieldKey(${F['next']}u)],4u);
    states[l].heap[83u]=Node(V(3u,0u,0u,1u),0u,0u,2u,0u);
    dataProperty(l,83u,fieldKey(${F.length}u),num(fromUnsigned(0u)),4u);
    dataProperty(l,83u,fieldKey(${F.name}u),image[fieldKey(${F['next']}u)],4u);
    states[l].heap[84u]=Node(V(3u,0u,0u,1u),0u,0u,2u,0u);
    dataProperty(l,84u,fieldKey(${F.length}u),num(fromUnsigned(0u)),4u);
    dataProperty(l,84u,fieldKey(${F.name}u),image[fieldKey(${F['[Symbol.iterator]']}u)],4u);
    states[l].heap[85u]=Node(V(3u,0u,0u,1u),0u,0u,2u,0u);
    dataProperty(l,85u,fieldKey(${F.length}u),num(fromUnsigned(1u)),4u);
    dataProperty(l,85u,fieldKey(${F.name}u),image[fieldKey(${F['call']}u)],4u);
    // Phase 6 protocols. Nodes 77-79 are written in place (phase4-fixed-nodes.js).
    dataProperty(l,arrayProto,0x60000000u|${PHASE3_NODES.iterator}u,V(334u,0u,11u,0u),5u);
    dataProperty(l,stringProto,0x60000000u|${PHASE3_NODES.iterator}u,V(1103u,0u,11u,0u),5u);
    dataProperty(l,functionProto,0x60000000u|${phase3HasInstanceNode}u,V(1101u,0u,11u,0u),0u);
    states[l].heap[${ITERATOR_PROTO_NODE}u]=Node(V(1u,0u,0u,1u),0u,0u,2u,0u);
    states[l].heap[${ARRAY_ITERATOR_PROTO_NODE}u]=Node(V(${ITERATOR_PROTO_NODE}u,0u,0u,1u),0u,0u,2u,0u);
    states[l].heap[${STRING_ITERATOR_PROTO_NODE}u]=Node(V(${ITERATOR_PROTO_NODE}u,0u,0u,1u),0u,0u,2u,0u);
    dataProperty(l,${ITERATOR_PROTO_NODE}u,0x60000000u|${PHASE3_NODES.iterator}u,V(2463u,0u,11u,0u),5u);
    dataProperty(l,${ARRAY_ITERATOR_PROTO_NODE}u,fieldKey(${F.next}u),V(2460u,0u,11u,0u),5u);
    dataProperty(l,${ARRAY_ITERATOR_PROTO_NODE}u,0x60000000u|${phase3ToStringTagNode}u,image[fieldKey(${F['Array Iterator']}u)],4u);
    dataProperty(l,${STRING_ITERATOR_PROTO_NODE}u,fieldKey(${F.next}u),V(2461u,0u,11u,0u),5u);
    dataProperty(l,${STRING_ITERATOR_PROTO_NODE}u,0x60000000u|${phase3ToStringTagNode}u,image[fieldKey(${F['String Iterator']}u)],4u);
    // Constructor precedes prototype methods in the intrinsic creation order.
    let ctor=alloc(l,3u,V(200u,0u,11u,0u),image[params.padding+2u].x,states[l].heap[arrayProto].next);states[l].heap[arrayProto].next=ctor;states[l].heap[ctor].marked=10u;
    for(var i=0u;i<image[params.padding+1u].z;i++){
      let item=image[params.padding+2u+i];let parent=item.y;
      var kind=3u;var value=V(item.z,0u,11u,0u);
      if(field(l,item.x,${F.__proto__}u)){kind=9u;value=V(0x80000078u,0x80000079u,0u,0u);}
      let property=alloc(l,kind,value,item.x,states[l].heap[parent].next);states[l].heap[parent].next=property;states[l].heap[property].marked=10u;
    }
    dataProperty(l,symbolCtor,fieldKey(${F.name}u),image[fieldKey(${F.Symbol}u)],4u);
    dataProperty(l,symbolCtor,fieldKey(${F.length}u),num(fromUnsigned(0u)),4u);
    dataProperty(l,symbolCtor,fieldKey(${F.prototype}u),V(symbolProto,0u,4u,0u),0u);
    dataProperty(l,symbolCtor,fieldKey(${F.for}u),V(1001u,0u,11u,0u),5u);
    dataProperty(l,symbolCtor,fieldKey(${F.keyFor}u),V(1002u,0u,11u,0u),5u);
    let symbolNames=array<u32,15>(${phase3WellKnownNames.map(name => `${F[name]}u`).join(',')});
    let symbolDescs=array<u32,15>(${phase3WellKnownNames.map(name => `${F['Symbol.' + name]}u`).join(',')});
    for(var i=0u;i<15u;i++){
      let copied=symbol_copy_text(l,image[fieldKey(symbolDescs[i])]);
      states[l].heap[31u+i].value.y=copied;states[l].heap[31u+i].value.w=1u;
      if(i==${phase3WellKnownNames.indexOf('isConcatSpreadable')}u||i==${phase3WellKnownNames.indexOf('species')}u||i==${phase3WellKnownNames.indexOf('iterator')}u||i==${phase3WellKnownNames.indexOf('hasInstance')}u||i==${phase3WellKnownNames.indexOf('toPrimitive')}u||i==${phase3WellKnownNames.indexOf('toStringTag')}u){dataProperty(l,symbolCtor,fieldKey(symbolNames[i]),V(31u+i,0u,17u,0u),0u);}
    }
    dataProperty(l,symbolProto,fieldKey(${F.constructor}u),V(1000u,0u,11u,0u),5u);
    dataProperty(l,symbolProto,fieldKey(${F.toString}u),V(1003u,0u,11u,0u),5u);
    dataProperty(l,symbolProto,fieldKey(${F.valueOf}u),V(1004u,0u,11u,0u),5u);
    let symbolDescription=alloc(l,9u,V(0x800003edu,0u,0u,0u),fieldKey(${F.description}u),states[l].heap[symbolProto].next);
    states[l].heap[symbolDescription].marked=8u;states[l].heap[symbolProto].next=symbolDescription;
    dataProperty(l,symbolProto,0x60000000u|${phase3ToPrimitiveNode}u,V(1100u,0u,11u,0u),4u);
    dataProperty(l,symbolProto,0x60000000u|${phase3ToStringTagNode}u,image[fieldKey(${F.Symbol}u)],4u);
    dataProperty(l,bigintCtor,fieldKey(${F.name}u),image[fieldKey(${F.BigInt}u)],4u);
    dataProperty(l,bigintCtor,fieldKey(${F.length}u),num(fromUnsigned(1u)),4u);
    dataProperty(l,bigintCtor,fieldKey(${F.prototype}u),V(bigintProto,0u,4u,0u),0u);
    ${phase3BigintWidthMetadata.map(m=>`dataProperty(l,bigintCtor,fieldKey(${F[m.name]}u),V(${m.id}u,0u,11u,0u),5u);`).join('\n    ')}
    dataProperty(l,bigintProto,fieldKey(${F.constructor}u),V(1150u,0u,11u,0u),5u);
    dataProperty(l,bigintProto,fieldKey(${F.toString}u),V(1151u,0u,11u,0u),5u);
    dataProperty(l,bigintProto,fieldKey(${F.valueOf}u),V(1152u,0u,11u,0u),5u);
    dataProperty(l,bigintProto,0x60000000u|${phase3ToStringTagNode}u,image[fieldKey(${F.BigInt}u)],4u);
    dataProperty(l,objectConstructor,fieldKey(${F.getOwnPropertySymbols}u),V(1050u,0u,11u,0u),5u);
    dataProperty(l,mathObject,0x60000000u|${phase3ToStringTagNode}u,image[fieldKey(${F.Math}u)],4u);
    dataProperty(l,jsonObject,0x60000000u|${phase3ToStringTagNode}u,image[fieldKey(${F.JSON}u)],4u);
    dataProperty(l,reflectObject,fieldKey(${F.name}u),image[fieldKey(${F.Reflect}u)],4u);
    dataProperty(l,reflectObject,fieldKey(${F.ownKeys}u),V(1051u,0u,11u,0u),5u);
    ${objectCopyMetadata.map(m=>`dataProperty(l,19u,fieldKey(${F[m.name]}u),V(${m.id}u,0u,11u,0u),5u);`).join('\n    ')}
    // Standard-library wave: fixed nodes 66..71 and Map/Set/iterator/Reflect/Math methods (stdlib-registry.js).
    ${stdlibInitWGSL(phase4Context)}
    ${promiseCoreInitWGSL({F})}
    ${promiseJobInitWGSL}
    ${asyncIterationInitWGSL({F})}
    // Fixed node 65: global object (phase4-global.js), global-object mode only.
    ${generatorInitWGSL({F,iteratorPrototypeNode:77,toStringTagNode:42})}
    ${promiseCombinatorsInitWGSL({F})}
    ${asyncFunctionInitWGSL({F})}
    ${asyncGeneratorInitWGSL({F})}
    if(globalMode()){globalInit(l);}
    ${promiseThenInitWGSL({F})}
    if(states[l].result.z==18u){states[l].result=materialize_bigint(l,states[l].result.x);}
    let fnValue=closure(l,0u); let env=environment(l,fnValue.x,1u);
    if(globalMode()&&!scriptMode()){globalEntryBinding(l,fnValue);}
    states[l].env=env; states[l].frames[0]=Frame(0u,env,0u,0u,select(undef(),V(GLOBAL_OBJECT,0u,4u,0u),scriptMode()));
    { let c=cell(l,env,0u,false); states[l].heap[c].value=states[l].result; }
    states[l].result=undef(); states[l].pc=image[0].x;
  }
  asyncRejectDispatch(l);
  jobDispatch(l);
  for (var step=0u;step<params.budget && states[l].status==0u;step++) {
    // Collection only at instruction boundaries: temporary values stay rooted.
    // states.pad: a collection requested by the Map/Set core (tombstone threshold).
    if (states[l].freeCount<192u || states[l].pad!=0u) { states[l].pad=0u; collect(l); if (states[l].freeCount<192u) { states[l].status=3u; break; } }
    if (states[l].pc>=params.instructions) { states[l].status=2u; break; }
    let ins=code[states[l].pc]; let op=ins.x; let arg=ins.y; states[l].pc++; states[l].steps++;
    // A suspended key conversion retains every operand beneath the helper's
    // frame base. Completion replaces just the key and retries this opcode.
    var keySlot=0xffffffffu;var objectSlot=0xffffffffu;
    if(${['get_array_el','get_array_el2','delete'].filter(name=>OP[name]!==undefined).map(name=>`op==${OP[name]}u`).join('||')}){
      keySlot=states[l].sp-1u;objectSlot=states[l].sp-2u;
    }
    if(op==${OP.put_array_el}u){keySlot=states[l].sp-2u;objectSlot=states[l].sp-3u;}
    if(op==${OP.define_array_el}u||op==${OP.define_method_computed}u||op==${OP.set_name_computed}u||op==${OP.define_class_method_computed}u||op==${OP.put_super_value}u){keySlot=states[l].sp-2u;}
    if(op==${OP.get_super_value}u){keySlot=states[l].sp-1u;}
    // Private field initializers (#f = () => 0): QuickJS names the anonymous
    // function with set_name_computed over the kind-33 private name, which is
    // not a property key: never run ToPropertyKey (builtin 900) on it.
    if(op==${OP.set_name_computed}u&&states[l].sp>=2u){let named=states[l].stack[states[l].sp-2u];if(named.z==4u&&states[l].heap[named.x].kind==33u){keySlot=0xffffffffu;}}
    if(op==${OP.to_propkey}u){keySlot=states[l].sp-1u;}
    if(op==${OP.in}u){
      keySlot=states[l].sp-2u;let keyReceiver=states[l].stack[states[l].sp-1u];
      if(keyReceiver.z!=4u&&keyReceiver.z!=5u&&keyReceiver.z!=11u){states[l].status=4u;}
    }
    if(objectSlot!=0xffffffffu){let keyReceiver=states[l].stack[objectSlot];if(keyReceiver.z==2u||keyReceiver.z==3u){states[l].status=4u;}}
    if(keySlot!=0xffffffffu&&states[l].status==0u){
      let keyValue=states[l].stack[keySlot];var canonical=keyValue.z==7u||keyValue.z==17u;
      if(keyValue.z==0u){let n=toBits(keyValue.xy);canonical=n<0x80000000u&&equalNumber(fromUnsigned(n),keyValue.xy);}
      if(!canonical){
        states[l].pc--;let depth=states[l].depth;
        push(l,V(900u,0u,11u,0u));push(l,keyValue);call(l,1u,false,false);
        if(states[l].depth>depth){states[l].frames[states[l].depth].tail=7u;states[l].frames[states[l].depth].receiver=V(keySlot,0u,0u,0u);continue;}
        if(states[l].status==0u){states[l].status=6u;}
      }
    }
    if(states[l].status==0u&&asyncGeneratorOpcode(l,op)){asyncGeneratorStep(l,op);}else
    if(states[l].status==0u){switch op {
      ${cases('push', 'let word=image[arg];if((word.z&0xffff0000u)==0x42490000u){push(l,materialize_bigint(l,arg));}else{push(l,word);}')}
      ${cases('closure', 'let v=closure(l,arg); push(l,v);')}
      ${cases('special_object', `if(arg<2u){push(l,argumentsObject(l,arg==1u));}else if(arg==2u){push(l,V(states[l].heap[states[l].env].value.x,0u,5u,0u));}else{push(l,classSpecialObject(l,arg));}`)}
      ${cases('object', 'let id=alloc(l,2u,V(1u,0u,0u,1u),0u,0u); push(l,V(id,0u,4u,0u));')}
      ${cases('array_from', `if (arg>128u || states[l].sp<arg) { states[l].status=3u; break; }
        let id=alloc(l,7u,V(2u,arg,0u,1u),0u,0u); let obj=V(id,0u,4u,0u); let base=states[l].sp-arg;
        for (var i=0u;i<arg;i++) { let ignored=putProperty(l,obj,0x80000000u|i,states[l].stack[base+i],true); }
        states[l].sp=base; push(l,obj);`)}
      ${cases('drop', 'let v=pop(l);')}
      ${cases('dup', 'let v=peek(l); push(l,v);')}
      ${cases('dup1 dup2 swap nip nip1 insert2 insert3 perm3 rot3l rot3r', `
        let b=pop(l); let a=pop(l);
        if (op==${OP.dup1}u) { push(l,a);push(l,a);push(l,b); }
        else if (op==${OP.dup2}u) { push(l,a);push(l,b);push(l,a);push(l,b); }
        else if (op==${OP.swap}u) { push(l,b);push(l,a); }
        else if (op==${OP.nip}u) { push(l,b); }
        else if (op==${OP.insert2}u) { push(l,b);push(l,a);push(l,b); }
        else { let c=pop(l);
          if (op==${OP.nip1}u) { push(l,a);push(l,b); }
          else if (op==${OP.insert3}u) { push(l,b);push(l,c);push(l,a);push(l,b); }
          else if (op==${OP.perm3}u) { push(l,a);push(l,c);push(l,b); }
          else if (op==${OP.rot3l}u) { push(l,a);push(l,b);push(l,c); }
          else { push(l,b);push(l,c);push(l,a); }
        }`)}
      ${cases('get_arg get_loc get_loc_check get_var_ref get_var_ref_check', `
        let isRef=op==${OP.get_var_ref}u || op==${OP.get_var_ref_check}u;
        let slot=arg+select(0u,16u,op==${OP.get_loc}u || op==${OP.get_loc_check}u);
        let c=cell(l,states[l].env,slot,isRef); let v=states[l].heap[c].value;
        // b=1 (packProgram, privateSlotLoad): unchecked load feeding a private opcode keeps a TDZ cell as a value.
        if (v.z==6u && ins.z==0u) { states[l].status=5u; } else { push(l,v); }`)}
      ${cases('put_arg set_arg put_loc set_loc put_loc_check set_loc_check put_loc_check_init put_var_ref set_var_ref put_var_ref_check put_var_ref_check_init set_loc_uninitialized', `
        let isRef=op==${OP.put_var_ref}u || op==${OP.set_var_ref}u || op==${OP.put_var_ref_check}u || op==${OP.put_var_ref_check_init}u;
        let local= !isRef && op!=${OP.put_arg}u && op!=${OP.set_arg}u;
        let c=cell(l,states[l].env,arg+select(0u,16u,local),isRef);
        if (op==${OP.set_loc_uninitialized}u) { states[l].heap[c].value=V(0u,0u,6u,0u); }
        else {
          if ((op==${OP.put_loc_check}u || op==${OP.set_loc_check}u || op==${OP.put_var_ref_check}u) && states[l].heap[c].value.z==6u) { states[l].status=5u; break; }
          if ((op==${OP.put_loc_check_init}u || op==${OP.put_var_ref_check_init}u) && states[l].heap[c].value.z!=6u) { states[l].status=5u; break; }
          var value=peek(l);
          if (op!=${OP.set_arg}u && op!=${OP.set_loc}u && op!=${OP.set_loc_check}u && op!=${OP.set_var_ref}u) { value=pop(l); }
          if((states[l].heap[c].marked&IMMUTABLE_GLOBAL_CELL)!=0u){
            // PutValue to non-writable globals: ignore sloppy writes, throw in
            // the currently executing strict function. Nested captures share c.
            if(image[ins.w*2u+1u].y!=0u){states[l].status=4u;}
          }else{states[l].heap[c].value=value;}
        }`)}
      // Keep the original Reference key: GetValue and PutValue each perform
      // ToPropertyKey. The private guest reader converts a copy for the read;
      // a later put_array_el can observe a second key coercion independently.
      ${cases('get_array_el3', `
        let keyValue=peek(l);let obj=states[l].stack[states[l].sp-2u];
        push(l,V(903u,0u,11u,0u));push(l,obj);push(l,keyValue);
        call(l,2u,false,false);`)}
      // QuickJS perm4: object key old updated -> old object key updated.
      ${cases('perm4', `let updated=pop(l);let old=pop(l);let key=pop(l);let obj=pop(l);
        push(l,old);push(l,obj);push(l,key);push(l,updated);`)}
      ${cases('get_field get_field2 get_array_el get_array_el2 get_length', `
        var key=0u;
        if (op==${OP.get_array_el}u || op==${OP.get_array_el2}u) { let k=pop(l); key=keyOf(l,k); }
        else if (op!=${OP.get_length}u) { key=keyOf(l,image[arg]); }
        if(states[l].status!=0u){break;}
        let obj=pop(l); var value=undef();
        if (op==${OP.get_length}u) {
          if (obj.z==7u) { value=num(fromUnsigned(obj.y)); }
          else if (obj.z==5u) { value=num(fromUnsigned(image[states[l].heap[obj.x].value.x*2u].y)); }
          else if (obj.z==4u && states[l].heap[obj.x].kind==7u) { value=num(fromUnsigned(states[l].heap[obj.x].value.y)); }
          else { states[l].status=6u; }
        } else { value=getProperty(l,obj,key); }
        if (op==${OP.get_field2}u || op==${OP.get_array_el2}u) { push(l,obj); }
        if(value.z==12u) {var getterThis=obj;if(op==${OP.get_array_el}u&&obj.w==1u&&(obj.z==4u||obj.z==5u||obj.z==11u)){getterThis=peek(l);}push(l,getterThis);push(l,callbackValue(value.x));call(l,0u,true,false);}
        else {push(l,value);}`)}
      ${cases('put_field define_field put_array_el', `
        let value=pop(l); var key=0u;
        if (op==${OP.put_array_el}u) { let k=pop(l); key=keyOf(l,k); } else { key=keyOf(l,image[arg]); }
        if(states[l].status!=0u){break;}
        if(op==${OP.define_field}u&&ins.z!=0u){functionName(l,value,image[ins.z],true);classSetHome(l,value,peek(l));}
        let obj=pop(l); var pending=undef();
        if(op==${OP.define_field}u){defineOwnData(l,obj,key,value);}else{pending=putProperty(l,obj,key,value,false);}
        if(pending.z==12u) {push(l,obj);push(l,callbackValue(pending.x));push(l,value);let depth=states[l].depth;call(l,1u,true,false);if(states[l].status==0u){if(states[l].depth>depth){states[l].frames[states[l].depth].tail=2u;}else{let ignored=pop(l);}}}
        if (op==${OP.define_field}u) { push(l,obj); }`)}
      ${cases('define_getter define_setter', `let fnValue=pop(l);functionName(l,fnValue,image[ins.z],true);classSetHome(l,fnValue,peek(l));
        let key=keyOf(l,image[arg]);if(states[l].status!=0u){break;}defineAccessor(l,peek(l),key,fnValue,op==${OP.define_setter}u);`)}
      ${cases('define_method_computed', `let fnValue=pop(l);let key=keyOf(l,pop(l));if(states[l].status!=0u){break;}let obj=peek(l);var name=symbolFunctionName(l,key);
        if(states[l].status!=0u){break;}
        if(arg!=0u){let prefix=image[ins.z];name=makeText(l,prefix,name,0u,prefix.y+name.y);}
        functionName(l,fnValue,name,true);classSetHome(l,fnValue,obj);
        if(arg==0u){let ignored=putProperty(l,obj,key,fnValue,true);}else{defineAccessor(l,obj,key,fnValue,arg==2u);}`)}
      ${cases('define_array_el', 'let value=pop(l);let key=keyOf(l,peek(l));if(states[l].status!=0u){break;}let obj=states[l].stack[states[l].sp-2u];defineOwnData(l,obj,key,value);')}
      ${cases('to_propkey', 'let value=pop(l);if(value.z==17u){push(l,value);break;}let key=keyOf(l,value);if(states[l].status!=0u){break;}push(l,keyName(l,key));')}
      ${cases('set_name', 'functionName(l,peek(l),image[arg],false);')}
      ${cases('set_name_computed', 'let named=states[l].stack[states[l].sp-2u];if(named.z==4u&&states[l].heap[named.x].kind==33u){functionName(l,peek(l),image[states[l].heap[named.x].value.x],false);}else{let key=keyOf(l,named);if(states[l].status!=0u){break;}let name=symbolFunctionName(l,key);if(states[l].status!=0u){break;}functionName(l,peek(l),name,false);}')}
      ${cases('call_constructor', 'construct(l,arg);')}
      ${cases('call tail_call call_method tail_call_method', `
        if(op==${OP.call}u&&arg==4u&&states[l].sp>=5u&&states[l].stack[states[l].sp-5u].z==11u&&states[l].stack[states[l].sp-5u].x==2360u){preparedConstruct(l);}
        else{call(l,arg,op==${OP.call_method}u || op==${OP.tail_call_method}u,op==${OP.tail_call}u || op==${OP.tail_call_method}u);}`)}
      ${cases('return', 'let value=pop(l); if(states[l].status==0u) { finish(l,value); }')}
      ${cases('return_undef', 'finish(l,undef());')}
      ${cases('push_this', `let value=states[l].frames[states[l].depth].receiver;
        if (value.z!=4u&&value.z!=5u&&value.z!=11u&&image[ins.w*2u+1u].y==0u) {
          // Sloppy this: box a primitive once per call so this===this holds.
          // undefined/null: the global object in global-object mode (phase4-global.js).
          if(wrapperPrototype(value)!=0u){let boxed=wrap(l,value);states[l].frames[states[l].depth].receiver=boxed;push(l,boxed);}
          else if((value.z==2u||value.z==3u)&&globalMode()){push(l,V(GLOBAL_OBJECT,0u,4u,0u));}
          else{states[l].status=6u;}
        } else { push(l,value); }`)}
      ${cases('strict_eq strict_neq', 'let b=pop(l); let a=pop(l); let value=binary(l,op,a,b); push(l,value);')}
      ${cases('pow', phase3BigintPowOpcode)}
      ${cases('add', `
        let b=pop(l);let a=pop(l);
        if((a.z==17u||b.z==17u)&&(a.z<4u||b.z<4u||a.z==17u||b.z==17u)&&!(a.z==4u||a.z==5u||a.z==11u||b.z==4u||b.z==5u||b.z==11u)){states[l].status=4u;break;}
        if(a.z==18u&&b.z==18u){let sum=phase3BigintAdd(l,a,b);if(states[l].status!=0u){break;}push(l,sum);break;}
        if((a.z==18u||b.z==18u)&&(a.z<4u||a.z==18u)&&(b.z<4u||b.z==18u)){states[l].status=4u;break;}
        if((a.z>=4u||b.z>=4u)&&!(a.z==7u&&b.z==7u)){
          push(l,V(132u,0u,11u,0u));push(l,a);push(l,b);call(l,2u,false,false);
        }else{push(l,binary(l,op,a,b));}
      `)}
      ${Object.entries(bigintComparisonOpcodeCases({OP})).map(([names,body])=>cases(names,body)).join('\n')}
      ${['sub','mul','div','mod','and','or','xor','shl','sar','shr'].map((name,index)=>cases(name, `
        let b=pop(l);let a=pop(l);
        if((a.z==17u||b.z==17u)&&(a.z<4u||a.z==17u)&&(b.z<4u||b.z==17u)){states[l].status=4u;break;}
        if(a.z==18u&&b.z==18u){
          if(${index}u==0u){let diff=phase3BigintSub(l,a,b);if(states[l].status!=0u){break;}push(l,diff);}
          else if(${index}u==1u){let prod=phase3BigintMul(l,a,b);if(states[l].status!=0u){break;}push(l,prod);}
          else if(${index}u==2u||${index}u==3u){let result=phase3BigintDivMod(l,a,b,${index}u==3u);if(states[l].status!=0u){break;}push(l,result);}
          else if(${index}u>=4u&&${index}u<=6u){let result=phase3BigintBitwise(l,a,b,${index}u-4u);if(states[l].status!=0u){break;}push(l,result);}
          else if(${index}u==7u||${index}u==8u){let result=phase3BigintShift(l,a,b,${index}u==7u);if(states[l].status!=0u){break;}push(l,result);}
          else{states[l].status=4u;}
          break;
        }
        if((a.z==18u||b.z==18u)&&(a.z<4u||a.z==18u)&&(b.z<4u||b.z==18u)){states[l].status=4u;break;}
        if(a.z>=4u||b.z>=4u){
          push(l,V(128u,0u,11u,0u));push(l,a);push(l,b);push(l,num(fromUnsigned(${index}u)));call(l,3u,false,false);
        } else {push(l,binary(l,op,a,b));}
      `)).join('\n')}
      ${cases('neg plus inc dec post_inc post_dec not lnot is_undefined is_null is_undefined_or_null', `
        let value=pop(l);
        if (op==${OP.lnot}u) { push(l,boolean(!truth(value))); }
        else if (op==${OP.is_undefined}u) { push(l,boolean(value.z==3u)); }
        else if (op==${OP.is_null}u) { push(l,boolean(value.z==2u)); }
        else if (op==${OP.is_undefined_or_null}u) { push(l,boolean(value.z==2u || value.z==3u)); }
        else if (value.z==17u) { states[l].status=4u; }
        else if (value.z==18u) {
          if(op==${OP.neg}u){let flipped=phase3BigintNeg(l,value);if(states[l].status!=0u){break;}push(l,flipped);}
          else if(op==${OP.plus}u){states[l].status=4u;}
          else if(op==${OP.not}u){let result=phase3BigintBitwise(l,value,undef(),3u);if(states[l].status!=0u){break;}push(l,result);}
          else{let updated=phase3BigintStep(l,value,op==${OP.dec}u||op==${OP.post_dec}u);if(states[l].status!=0u){break;}if(op==${OP.post_inc}u||op==${OP.post_dec}u){push(l,value);}push(l,updated);}
        }
        else if (value.z>=4u) {
          push(l,V(127u,0u,11u,0u));push(l,value);
          var operation=select(select(0u,1u,op==${OP.neg}u),2u,op==${OP.not}u);
          if(op==${OP.inc}u){operation=3u;}if(op==${OP.dec}u){operation=4u;}if(op==${OP.post_inc}u||op==${OP.post_dec}u){operation=5u;}
          push(l,num(fromUnsigned(operation)));
          let depth=states[l].depth;call(l,2u,false,false);
          if(states[l].depth>depth&&(op==${OP.post_inc}u||op==${OP.post_dec}u)){
            states[l].frames[states[l].depth].tail=select(4u,5u,op==${OP.post_dec}u);
          }
        }
        else if (op==${OP.neg}u) { push(l,num(Pair(value.x,value.y^0x80000000u))); }
        else if (op==${OP.plus}u) { push(l,num(value.xy)); }
        else if (op==${OP.not}u) { push(l,num(fromSigned(~toBits(value.xy)))); }
        else { if(op==${OP.post_inc}u || op==${OP.post_dec}u) { push(l,num(value.xy)); }
          push(l,num(plus(value.xy,Pair(0u,select(0x3ff00000u,0xbff00000u,op==${OP.dec}u || op==${OP.post_dec}u))))); }
      `)}
      ${cases('inc_loc dec_loc add_loc', `
        let c=cell(l,states[l].env,16u+arg,false); let a=states[l].heap[c].value; var b=num(Pair(0u,0x3ff00000u));
        if(op==${OP.add_loc}u) { b=pop(l); }
        if(a.z==17u||(op==${OP.add_loc}u&&b.z==17u)){states[l].status=4u;break;}
        if(op==${OP.add_loc}u&&(a.z>=4u||b.z>=4u)&&!(a.z==7u&&b.z==7u)){
          push(l,V(132u,0u,11u,0u));push(l,a);push(l,b);
          let depth=states[l].depth;call(l,2u,false,false);
          if(states[l].depth>depth){states[l].frames[states[l].depth].tail=6u;states[l].frames[states[l].depth].receiver=V(c,0u,4u,0u);}
        }else if(a.z>=4u&&op!=${OP.add_loc}u){
          push(l,V(127u,0u,11u,0u));push(l,a);push(l,num(fromUnsigned(select(3u,4u,op==${OP.dec_loc}u))));
          let depth=states[l].depth;call(l,2u,false,false);
          if(states[l].depth>depth){states[l].frames[states[l].depth].tail=6u;states[l].frames[states[l].depth].receiver=V(c,0u,4u,0u);}
        }else{let value=binary(l,select(${OP.add}u,${OP.sub}u,op==${OP.dec_loc}u),a,b);states[l].heap[c].value=value;}`)}
      ${cases('goto', 'states[l].pc=arg;')}
      ${cases('if_true if_false', `let value=pop(l); if (truth(value)==(op==${OP.if_true}u)) { states[l].pc=arg; }`)}
      ${cases('set_proto', `let proto=objectView(l,pop(l));let obj=peek(l);if(proto.z==11u){states[l].status=6u;break;}
        if(obj.z!=4u) {states[l].status=4u;} else if(proto.z==4u) {states[l].heap[obj.x].value.x=proto.x;states[l].heap[obj.x].value.z=0u;}
        else if(proto.z==2u) {states[l].heap[obj.x].value.x=0u;states[l].heap[obj.x].value.z=0u;}`)}
      ${cases('typeof_is_function typeof_is_undefined', `let v=pop(l);push(l,boolean(select(v.z==3u,v.z==5u||v.z==11u,op==${OP.typeof_is_function}u)));`)}
      ${cases('typeof', `let v=pop(l);if(v.z==17u){push(l,image[fieldKey(${F.symbol}u)]);}else if(v.z==18u){push(l,image[fieldKey(${F.bigint}u)]);}else{var index=2u;
        if(v.z==0u){index=0u;}else if(v.z==1u){index=1u;}else if(v.z==3u){index=3u;}else if(v.z==5u||v.z==11u){index=4u;}else if(v.z==7u){index=5u;}
        let offset=image[params.padding+index/4u][index%4u];push(l,image[offset]);}`)}
      ${cases('instanceof', 'let constructor=pop(l);let value=pop(l);push(l,V(2490u,0u,11u,0u));push(l,value);push(l,constructor);call(l,2u,false,false);')}
      ${cases('in', `let original=pop(l);let keyValue=pop(l);let key=keyOf(l,keyValue);if(states[l].status!=0u){break;}if(!functionKey(l,original,key)){break;}var obj=objectView(l,original);
        if(obj.z==11u&&nativeNonconstructor(original)&&field(l,key,${F.prototype}u)){obj=V(3u,0u,4u,0u);}
        if(obj.z!=4u){states[l].status=select(4u,6u,obj.z==11u);break;}var current=obj.x;var exists=false;var intrinsic=0u;
        while(current!=0u){if(findProperty(l,current,key)!=0u || (lengthKey(l,key)&&states[l].heap[current].kind==7u) || stringOwn(l,current,key)!=0u){exists=true;break;}
          if(prototypeGap(l,current,key)){exists=true;break;}
          intrinsic=states[l].heap[current].value.z;current=states[l].heap[current].value.x;}
        push(l,boolean(exists));`)}
      ${cases('delete', `let keyValue=pop(l);let original=pop(l);let key=keyOf(l,keyValue);if(states[l].status!=0u){break;}if(!functionKey(l,original,key)){break;}let obj=objectView(l,original);
        if(obj.z==2u||obj.z==3u){states[l].status=4u;break;}
        if(wrapperPrototype(obj)!=0u){
          // ToObject(primitive): only string index/length are own, non-configurable.
          let kept=textOwn(l,obj,key)!=0u;
          if(kept&&image[ins.w*2u+1u].y!=0u){states[l].status=4u;}else{push(l,boolean(!kept));}break;
        }
        if(obj.z!=4u){states[l].status=6u;break;}if(ownGap(l,obj.x,key)){break;}var removed=true;
        if(lengthKey(l,key)&&states[l].heap[obj.x].kind==7u){removed=false;}
        else if(stringOwn(l,obj.x,key)!=0u){removed=false;}
        else {let property=findProperty(l,obj.x,key);
          if(property!=0u){
            if((states[l].heap[property].marked&8u)==0u){removed=false;}
            else {var previous=obj.x;
              for(var i=0u;i<${L.heap}u && states[l].heap[previous].next!=property;i++){previous=states[l].heap[previous].next;}
              states[l].heap[previous].next=states[l].heap[property].next;states[l].heap[property].next=0u;
            }
          }
        }
        if(!removed&&image[ins.w*2u+1u].y!=0u){states[l].status=4u;}else{push(l,boolean(removed));}`)}
      ${cases('close_loc', `let env=states[l].env;let old=cell(l,env,16u+arg,false);
        let node=states[l].heap[old]; let fresh=alloc(l,1u,node.value,node.key,node.next);
        var previous=env;
        for(var i=0u;i<${L.heap}u;i++) { if(states[l].heap[previous].next==old) {break;} previous=states[l].heap[previous].next; }
        states[l].heap[previous].next=fresh;states[l].heap[old].next=0u;`)}
      ${cases('catch', 'push(l,V(arg,0u,9u,0u));')}
      ${cases('gosub', 'push(l,V(states[l].pc,0u,10u,0u)); states[l].pc=arg;')}
      ${cases('ret', 'let dest=pop(l); if(dest.z!=10u) {states[l].status=2u;} else {states[l].pc=dest.x;}')}
      ${cases('nip_catch', `let value=pop(l);var found=false;
        while(states[l].sp>states[l].frames[states[l].depth].base) {let v=pop(l);if(v.z==9u){found=true;break;}}
        if(!found){states[l].status=2u;}push(l,value);`)}
      ${cases('throw', 'let value=pop(l); raise(l,value);')}
      ${cases('throw_error', 'states[l].status=select(4u,5u,arg==2u || arg==3u || arg==5u);')}
      ${cases('nop', '')}
      ${Object.entries(phase4Cases).map(([name,body])=>cases(name,body)).join('\n      ')}
      default: { states[l].status=2u; }
    }}
    asyncRejectDispatch(l);
    if (states[l].status==4u || states[l].status==5u || states[l].status==8u) {
      let status=states[l].status;
      states[l].status=0u;var kind=1u;var message=${F['Invalid operation']}u;
      if(status==5u){kind=2u;message=${F['Invalid reference']}u;}else if(status==8u){kind=3u;message=${F['Invalid array length']}u;}
      let error=makeError(l,kind,image[fieldKey(message)],undef());
      if(states[l].status==0u){raise(l,error);}
      // Preserve useful host diagnostics for an uncaught implicit error.
      if(states[l].status==7u) {states[l].status=status;}
    }
    asyncRejectDispatch(l);
    if(states[l].status==9u){
      let error=peek(l);let callDepth=states[l].depth;states[l].status=0u;
      call(l,2u,false,false);
      if(states[l].status==0u){
        if(states[l].depth>callDepth){states[l].frames[states[l].depth].tail=80u;states[l].frames[states[l].depth].receiver=error;}
        else{states[l].status=2u;}
      }
    }
${promiseJobMainWGSL}  }
  output[l].status=select(states[l].status,0u,states[l].status==10u||states[l].status==11u);output[l].steps=states[l].steps;output[l].collections=states[l].collections;output[l].pad=states[l].pc;output[l].value=states[l].result;
  if((states[l].status==1u||states[l].status==12u||states[l].status==13u) && states[l].result.z==7u) {
    for(var i=0u;i<states[l].result.y;i++){output[l].chars[i]=unit(l,states[l].result,i);}
  }
  if((states[l].status==1u||states[l].status==12u||states[l].status==13u) && states[l].result.z==18u){
    let header=bigint_header(l,states[l].result);
    if(header!=0u){
      let metadata=states[l].heap[header].value;
      output[l].value=V(metadata.x,metadata.y,18u,0u);
      for(var i=0u;i<metadata.y;i++){output[l].chars[i]=bigint_limb(l,header,i);}
    }
    output[l].status=states[l].status;
  }
}
`;

// Fail closed if prototypeGap acquires another holder without its ownGap guard.
export function assertOwnGapHolders(source){
  const prototype=source.slice(source.indexOf('fn prototypeGap('),source.indexOf('fn ownGap('));
  const own=source.slice(source.indexOf('fn ownGap('),source.indexOf('fn primitiveSet('));
  const holders=body=>[...new Set([...body.matchAll(/\bid\s*(?:==|!=)\s*(GLOBAL_OBJECT|\d+u)/g)].map(m=>m[1]))].sort().join(',');
  const expected=holders(prototype),guarded=holders(own);
  if(!expected||expected!==guarded)throw new Error('ownGap fixed-holder guard drift: '+expected+' vs '+guarded);
}
assertOwnGapHolders(unsharedShader);
export const shader=shareFinishDispatch(shareCallDispatch(unsharedShader));
