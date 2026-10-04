// Promise + async wave, worker 1: Promise brand/state, the Promise constructor,
// resolving functions, NewPromiseCapability, settled value/reason and GC.
//
// Everything here runs on the GPU: the guest helpers below are strict
// functions compiled by QuickJS (bootstrap roots) and executed by the WGSL VM;
// the WGSL strings are production hooks spliced into shader.js by
// `promiseCoreIntegrationEdits`. This module never writes files and the host
// never evaluates these sources (the native oracle in check-promise-core.mjs
// evaluates only the *fixtures*, with the host engine's own Promise).
//
// Representation (PROMISE-ASYNC-CONTRACT.md "Promise object"):
//   promise object  heap kind 2, tag-4 value, value=(prototype, holder, header, extensible)
//                   value.z = header node, unflagged (like the generator brand, kind 56)
//   header kind 64  value = settled value/reason (undefined while pending)
//                   key   = owning object node (brand back-link)
//                   next  = first reaction cell while pending, 0 once settled
//                   marked bit 0 GC, bits 4..5 state (0 pending,1 fulfilled,2 rejected), bit 6 [[PromiseIsHandled]]
//   cell kind 65    value = reaction record (guest value), key = 0 fulfill / 1 reject, next = next cell
//                   (one chain holds both lists interleaved in registration order)
import { PROMISE_IDS, PROMISE_NODES, PROMISE_KINDS, SYMBOL_NODES } from './promise-ids.js';

export const PROMISE_CORE_IDS = Object.freeze({
  ctor: PROMISE_IDS.ctor,                 // 2800 public %Promise%
  construct: PROMISE_IDS.construct,       // 2801 private construct helper (new Promise(executor))
  createResolvingFunctions: 2820,         // guest helper
  newCapability: 2821,                    // guest helper
  // WGSL private intrinsics (trusted bootstrap only)
  create: 2840, state: 2841, result: 2842, settle: 2843, addReaction: 2844,
  markHandled: 2845, isHandled: 2846, isConstructor: 2847,
});
const I = PROMISE_CORE_IDS;
export const PROMISE_CORE_NODES = Object.freeze({ ctor: PROMISE_NODES.promiseCtor, proto: PROMISE_NODES.promiseProto });
export const PROMISE_CORE_KINDS = Object.freeze({ header: PROMISE_KINDS.promiseHeader, cell: PROMISE_KINDS.reactionCell });
const N = PROMISE_CORE_NODES, K = PROMISE_CORE_KINDS;
// Worker 2 (assumed to exist per contract): Promise Resolve Functions steps 7..16.
export const PROMISE_RESOLVE_BODY_ID = 2825;

// ------------------------------------------------------------ guest helpers --
// ES2025 27.2.3.1 Promise(executor), steps 2..11. Step 1 (NewTarget undefined
// -> TypeError) is the WGSL call path for id 2800 (status 4 = guest TypeError).
// NewTarget is always %Promise% here: the construct() hook routes only
// callee === NewTarget === 2800; a different NewTarget (class extends Promise,
// Reflect.construct) stays the existing status-6 boundary, so
// OrdinaryCreateFromConstructor(NewTarget, "%Promise.prototype%") is exactly
// the intrinsic prototype (node 91; Promise.prototype is non-writable and
// non-configurable, so the Get is unobservable).
export const promiseConstructSource = `function promiseConstructBootstrap(executor){
  "use strict";
  if (typeof executor !== "function") throw new TypeError("Promise resolver is not a function");
  const promise = __lanesPromiseCreate(undefined);
  const resolvingFunctions = __promiseCreateResolvingFunctions(promise);
  try {
    executor(resolvingFunctions[0], resolvingFunctions[1]);
  } catch (error) {
    resolvingFunctions[1](error);
  }
  return promise;
}`;

// ES2025 27.2.1.3 CreateResolvingFunctions(promise). The two functions are
// anonymous arrows (length 1, own name "", no prototype, not constructors)
// sharing one alreadyResolved binding. Resolve delegates every step after the
// guard to worker 2's __promiseResolveBody (2825); reject is RejectPromise.
// Both return undefined. Private names resolve only in the helper's root
// scope, so the arrows use root locals bound to them.
export const promiseCreateResolvingFunctionsSource = `function promiseCreateResolvingFunctionsBootstrap(promise){
  "use strict";
  const resolveBody = __promiseResolveBody;
  const settle = __lanesPromiseSettle;
  let alreadyResolved = false;
  return [
    (resolution) => {
      if (alreadyResolved) return undefined;
      alreadyResolved = true;
      resolveBody(promise, resolution);
      return undefined;
    },
    (reason) => {
      if (alreadyResolved) return undefined;
      alreadyResolved = true;
      settle(promise, 2, reason);
      return undefined;
    },
  ];
}`;

// ES2025 27.2.1.5 NewPromiseCapability(C) with GetCapabilitiesExecutor
// (27.2.1.5.1: anonymous, length 2). Returns the capability record as an
// ordinary object {promise, resolve, reject}.
export const promiseNewCapabilitySource = `function promiseNewCapabilityBootstrap(C){
  "use strict";
  if (!__lanesPromiseIsConstructor(C)) throw new TypeError("Promise capability constructor is not a constructor");
  let resolve = undefined;
  let reject = undefined;
  const promise = new C((resolveFunction, rejectFunction) => {
    if (resolve !== undefined) throw new TypeError("Promise capability resolve already set");
    if (reject !== undefined) throw new TypeError("Promise capability reject already set");
    resolve = resolveFunction;
    reject = rejectFunction;
    return undefined;
  });
  if (typeof resolve !== "function") throw new TypeError("Promise capability resolve is not callable");
  if (typeof reject !== "function") throw new TypeError("Promise capability reject is not callable");
  return { promise: promise, resolve: resolve, reject: reject };
}`;

// FIELDS name -> source. Field names are append-only FIELDS entries.
export const promiseCoreSources = Object.freeze({
  promiseConstruct: promiseConstructSource,
  promiseCreateResolvingFunctions: promiseCreateResolvingFunctionsSource,
  promiseNewCapability: promiseNewCapabilitySource,
});
// Builtin id -> bootstrap field (call() redirects these tag-11 ids to the helper closure).
export const promiseCoreBuiltinFields = Object.freeze({
  [I.construct]: 'promiseConstruct',
  [I.createResolvingFunctions]: 'promiseCreateResolvingFunctions',
  [I.newCapability]: 'promiseNewCapability',
});
// New FIELDS names (append-only). 'Promise' already exists (phase4-global.js globalFieldNames).
export const promiseCoreFields = Object.freeze([...Object.keys(promiseCoreSources), 'Promise']);

// Bootstrap identifier -> id (merged into bootstrap.js privateBuiltins).
export const promiseCoreIntrinsics = Object.freeze({
  __promiseCreateResolvingFunctions: I.createResolvingFunctions,
  __promiseNewCapability: I.newCapability,
  __lanesPromiseCreate: I.create,
  __lanesPromiseState: I.state,
  __lanesPromiseResult: I.result,
  __lanesPromiseSettle: I.settle,
  __lanesPromiseAddReaction: I.addReaction,
  __lanesPromiseMarkHandled: I.markHandled,
  __lanesPromiseIsHandled: I.isHandled,
  __lanesPromiseIsConstructor: I.isConstructor,
});
// Identifiers the helpers above use but do not own.
export const promiseCoreExternalIntrinsics = Object.freeze({ __promiseResolveBody: PROMISE_RESOLVE_BODY_ID });

// Public function metadata. Promise is backed by fixed node 90 (objectView),
// so name/length/prototype are ordinary own data properties installed by init.
export const promiseCoreMetadata = Object.freeze([
  Object.freeze({ id: I.ctor, name: 'Promise', length: 1, node: N.ctor }),
]);

// --------------------------------------------------------------------- WGSL --
const STATE_MASK = 0x30, HANDLED = 0x40;
const toStringTagKey = (0x60000000 | SYMBOL_NODES.toStringTag) >>> 0;

// Exported WGSL API (contract): promiseAllocate, promiseHeaderOf,
// promiseSettleHeader. promiseSettleHeader calls worker 7's
// jobEnqueue(l,type,a,b,c)->bool (type 1: A = reaction record, B = argument).
export const promiseCoreWGSLFunctions = ({ L }) => `
const PROMISE_PROTOTYPE:u32=${N.proto}u;
const PROMISE_HEADER:u32=${K.header}u;
const PROMISE_REACTION:u32=${K.cell}u;
const PROMISE_STATE_MASK:u32=${STATE_MASK}u;
const PROMISE_HANDLED:u32=${HANDLED}u;
fn promiseAllocate(l:u32,proto:u32)->u32 {
  let object=alloc(l,2u,V(proto,0u,0u,1u),0u,0u);
  if(states[l].status!=0u){return 0u;}
  let header=alloc(l,PROMISE_HEADER,undef(),object,0u);
  if(states[l].status!=0u){return 0u;}
  states[l].heap[object].value.z=header;
  return object;
}
fn promiseHeaderOf(l:u32,v:V)->u32 {
  if(v.z!=4u||v.x==0u||states[l].heap[v.x].kind!=2u){return 0u;}
  let header=states[l].heap[v.x].value.z;
  if(header==0u||(header&0x80000000u)!=0u){return 0u;}
  if(states[l].heap[header].kind!=PROMISE_HEADER||states[l].heap[header].key!=v.x){return 0u;}
  return header;
}
fn promiseStateOf(l:u32,header:u32)->u32 {
  return (states[l].heap[header].marked&PROMISE_STATE_MASK)>>4u;
}
fn promiseMatchingReactions(l:u32,header:u32,state:u32)->u32 {
  var count=0u;var cell=states[l].heap[header].next;
  for(var i=0u;i<${L.heap}u&&cell!=0u;i++){
    if(states[l].heap[cell].key==state-1u){count++;}
    cell=states[l].heap[cell].next;
  }
  return count;
}
// FulfillPromise / RejectPromise (ES2025 27.2.1.4 / 27.2.1.7) + TriggerPromiseReactions.
fn promiseSettleHeader(l:u32,header:u32,state:u32,value:V) {
  if(header==0u||states[l].heap[header].kind!=PROMISE_HEADER||promiseStateOf(l,header)!=0u||(state!=1u&&state!=2u)){states[l].status=2u;return;}
  states[l].heap[header].value=value;
  states[l].heap[header].marked=(states[l].heap[header].marked&~PROMISE_STATE_MASK)|(state<<4u);
  var cell=states[l].heap[header].next;
  for(var i=0u;i<${L.heap}u&&cell!=0u;i++){
    if(states[l].heap[cell].kind!=PROMISE_REACTION){states[l].status=2u;return;}
    if(states[l].heap[cell].key==state-1u){
      if(!jobEnqueue(l,1u,states[l].heap[cell].value,value,undef())){return;}
    }
    cell=states[l].heap[cell].next;
  }
  states[l].heap[header].next=0u;
}
// Private intrinsics ${I.create}..${I.isConstructor}. Called from objectMethod while every
// argument is still on the live operand stack (call() resets sp afterwards), so
// the explicit collect() in settle runs with all values rooted.
fn promiseIntrinsic(l:u32,id:u32,v:V,b:V,c:V)->V {
  if(id==${I.create}u){
    var proto=PROMISE_PROTOTYPE;let view=objectView(l,v);if(view.z==4u){proto=view.x;}
    let object=promiseAllocate(l,proto);if(states[l].status!=0u){return undef();}
    return V(object,0u,4u,0u);
  }
  if(id==${I.isConstructor}u){return boolean(classIsConstructor(l,v));}
  let header=promiseHeaderOf(l,v);
  if(id==${I.state}u){if(header==0u){return num(fromSigned(0xffffffffu));}return num(fromUnsigned(promiseStateOf(l,header)));}
  if(header==0u){states[l].status=2u;return undef();}
  if(id==${I.result}u){return states[l].heap[header].value;}
  if(id==${I.markHandled}u){states[l].heap[header].marked|=PROMISE_HANDLED;return undef();}
  if(id==${I.isHandled}u){return boolean((states[l].heap[header].marked&PROMISE_HANDLED)!=0u);}
  if(promiseStateOf(l,header)!=0u){states[l].status=2u;return undef();}
  if(id==${I.settle}u){
    if(b.z!=0u){states[l].status=2u;return undef();}
    let state=toBits(b.xy);
    if(state!=1u&&state!=2u){states[l].status=2u;return undef();}
    // Each queued job allocates at most three nodes (job cell + two payload cells).
    let needed=promiseMatchingReactions(l,header,state)*3u;
    if(states[l].freeCount<needed){collect(l);}
    promiseSettleHeader(l,header,state,c);return undef();
  }
  if(id==${I.addReaction}u){
    let fulfill=alloc(l,PROMISE_REACTION,b,0u,0u);
    let reject=alloc(l,PROMISE_REACTION,c,1u,0u);
    if(states[l].status!=0u){return undef();}
    states[l].heap[fulfill].next=reject;
    var tail=header;
    for(var i=0u;i<${L.heap}u&&states[l].heap[tail].next!=0u;i++){tail=states[l].heap[tail].next;}
    if(states[l].heap[tail].next!=0u){states[l].status=3u;return undef();}
    states[l].heap[tail].next=fulfill;
    return undef();
  }
  states[l].status=2u;return undef();
}
`;

// objectMethod dispatch (inserted at its top; `id`, `original`, `b`, `c` in scope).
// Calling %Promise% without new is a TypeError (27.2.3.1 step 1).
export const promiseCoreObjectMethodWGSL = `if(id>=${I.create}u&&id<=${I.isConstructor}u){return promiseIntrinsic(l,id,original,b,c);}
  if(id==${I.ctor}u){states[l].status=4u;return undef();}`;

// call(): tag-11 helper ids -> bootstrap closure field.
export const promiseCoreCallFieldsWGSL = ({ F }) => Object.entries(promiseCoreBuiltinFields)
  .map(([id, field]) => { if (!(field in F)) throw new Error(`promise-core: FIELDS lacks ${field}`); return `if(fnValue.x==${id}u){field=${F[field]}u;}`; }).join('\n    ');

// construct(): new Promise(...) with NewTarget === %Promise% runs the construct helper.
export const promiseCoreConstructWGSL = `if(callee.x==${I.ctor}u){constructorId=${I.construct}u;}`;

// objectView / objectValue identity: V(2800,tag 11) <-> fixed node 90.
export const promiseCoreObjectViewWGSL = `if(v.z==11u&&v.x==${I.ctor}u){return V(${N.ctor}u,0u,4u,0u);}`;
export const promiseCoreObjectValueWGSL = `if(id==${N.ctor}u){return V(${I.ctor}u,0u,11u,0u);}`;

// collect(): object -> header, header -> value/owner, cell -> reaction record.
// header.next / cell.next are traced by collect()'s generic mark(node.next).
export const promiseCoreGCWGSL = `
    if(node.kind==2u&&node.value.z!=0u&&(node.value.z&0x80000000u)==0u&&states[l].heap[node.value.z].kind==${K.header}u){mark(l,node.value.z);}
    if(node.kind==${K.header}u){markValue(l,node.value);mark(l,node.key);}
    if(node.kind==${K.cell}u){markValue(l,node.value);}
`;

// main() init: fixed nodes 90 (Promise constructor backing) and 91
// (%Promise.prototype%), written in place (never allocated). Requires
// FIXED_RESERVED_LAST >= 91 (contract: parent grows it to 105).
export const promiseCoreInitWGSL = ({ F }) => {
  for (const name of ['length', 'name', 'prototype', 'constructor', 'Promise']) if (!(name in F)) throw new Error(`promise-core: FIELDS lacks ${name}`);
  return `
    states[l].heap[${N.ctor}u]=Node(V(3u,0u,0u,1u),0u,0u,2u,0u);
    states[l].heap[${N.proto}u]=Node(V(1u,0u,0u,1u),0u,0u,2u,0u);
    dataProperty(l,${N.ctor}u,fieldKey(${F.length}u),num(fromUnsigned(1u)),4u);
    dataProperty(l,${N.ctor}u,fieldKey(${F.name}u),image[fieldKey(${F.Promise}u)],4u);
    dataProperty(l,${N.ctor}u,fieldKey(${F.prototype}u),V(${N.proto}u,0u,4u,0u),0u);
    dataProperty(l,${N.proto}u,fieldKey(${F.constructor}u),V(${I.ctor}u,0u,11u,0u),5u);
    dataProperty(l,${N.proto}u,${toStringTagKey}u,image[fieldKey(${F.Promise}u)],4u);
  `;
};

// class extends Promise / Reflect.construct(Promise, args, Other): IsConstructor
// is true, so the existing built-in-parent boundary (status 6) applies instead
// of a wrong TypeError.
export const promiseCoreClassIsConstructorTerm = `||v.x==${I.ctor}u`;

export const promiseCoreUsedIds = Object.freeze([I.ctor, I.construct, I.createResolvingFunctions, I.newCapability, I.create, I.state, I.result, I.settle, I.addReaction, I.markHandled, I.isHandled, I.isConstructor]);
export const promiseCoreUsedKinds = Object.freeze([K.header, K.cell]);
export const promiseCoreUsedNodes = Object.freeze([N.ctor, N.proto]);

// ------------------------------------------------------- integration edits --
// Anchors are exact substrings of the files produced by
// generatorIntegrationPatch(live, {iteratorPrototypeNode:77}); each must match
// exactly once. Inserted text is order-independent with other workers' edits.
const IMPORT_SHADER = "import {promiseCoreWGSLFunctions,promiseCoreObjectMethodWGSL,promiseCoreCallFieldsWGSL,promiseCoreConstructWGSL,promiseCoreObjectViewWGSL,promiseCoreObjectValueWGSL,promiseCoreGCWGSL,promiseCoreInitWGSL} from './promise-core-source.js';";
export const promiseCoreIntegrationEdits = Object.freeze([
  // program.js
  { file: 'program.js', anchor: "import { privateBuiltins } from './bootstrap.js';", position: 'after',
    text: "\nimport { promiseCoreFields } from './promise-core-source.js';", why: 'promise-core FIELDS names' },
  { file: 'program.js', anchor: 'export const FIELDS =', position: 'before',
    text: 'for(const name of promiseCoreFields)if(!fieldNames.includes(name))fieldNames.push(name);\n', why: 'append-only FIELDS: promiseConstruct, promiseCreateResolvingFunctions, promiseNewCapability' },
  { file: 'program.js', anchor: "      if(root && ref.name==='Reflect'){add([6,47,0,0]);continue;}", position: 'after',
    text: "\n      if(root && ref.name==='Promise'){add([4,2800,0,0]);continue;}", why: 'classic-mode global Promise -> V(2800, tag 11)' },
  // phase4-global.js (global-object mode binding; Promise is no longer an unimplemented global)
  { file: 'phase4-global.js', anchor: "  { name: 'Reflect', value: { node: 47 }, flags: WRITABLE | CONFIGURABLE },", position: 'after',
    text: "\n  { name: 'Promise', value: { builtin: 2800 }, flags: WRITABLE | CONFIGURABLE },", why: 'global object own property Promise (same identity as classic mode)' },
  { file: 'phase4-global.js', anchor: "'Iterator', 'Map', 'Promise', 'Proxy',", position: 'replace',
    text: "'Iterator', 'Map', 'Proxy',", why: 'Promise is implemented: remove from globalUnimplementedNames' },
  // bootstrap.js
  { file: 'bootstrap.js', anchor: "import { phase4BootstrapSources, phase4PrivateBuiltins, protocolBootstrapSources } from './phase4-registry.js';", position: 'after',
    text: "\nimport { promiseCoreSources, promiseCoreIntrinsics } from './promise-core-source.js';", why: 'promise-core helper sources and private names' },
  { file: 'bootstrap.js', anchor: '  ...phase3BigintConversionIntrinsics,', position: 'before',
    text: '  ...promiseCoreIntrinsics,\n', why: 'privateBuiltins: __promiseCreateResolvingFunctions/__promiseNewCapability/__lanesPromise* ids' },
  { file: 'bootstrap.js', anchor: '  ...generatorDelegationSources,', position: 'after',
    text: '\n  ...promiseCoreSources,', why: 'bootstrapSources: promiseConstruct, promiseCreateResolvingFunctions, promiseNewCapability' },
  // phase4-classes.js
  { file: 'phase4-classes.js', anchor: '||v.x==137u||v.x==500u', position: 'replace',
    text: '||v.x==137u||v.x==500u||v.x==2800u', why: 'IsConstructor(%Promise%) is true: extends Promise / foreign NewTarget hit the status-6 built-in-parent boundary, not TypeError' },
  // shader.js
  { file: 'shader.js', anchor: "import { LIMITS as L, OP, FIELDS as F, objectStaticPlaceholders, numberWords } from './program.js';", position: 'after',
    text: '\n' + IMPORT_SHADER, why: 'promise-core WGSL strings' },
  { file: 'shader.js', anchor: '    if(node.kind==35u){mark(l,node.key);}', position: 'after',
    text: '\n    ${promiseCoreGCWGSL}', why: 'GC: object->header, header->value/owner, cell->reaction' },
  { file: 'shader.js', anchor: '  if(v.z==11u&&v.x==401u){return V(85u,0u,4u,0u);}', position: 'after',
    text: '\n  ${promiseCoreObjectViewWGSL}', why: 'objectView: %Promise% backing node 90' },
  { file: 'shader.js', anchor: '  if(id==85u){return V(401u,0u,11u,0u);}', position: 'after',
    text: '\n  ${promiseCoreObjectValueWGSL}', why: 'objectValue: node 90 -> %Promise%' },
  { file: 'shader.js', anchor: '    if(fnValue.x==960u){field=${F.numberPow}u;}', position: 'after',
    text: '\n    ${promiseCoreCallFieldsWGSL({F})}', why: 'call(): helper ids 2801/2820/2821 -> bootstrap closures' },
  { file: 'shader.js', anchor: '    if(callee.x==100u||callee.x==200u||(callee.x>=600u&&callee.x<=606u)){', position: 'before',
    text: '    ${promiseCoreConstructWGSL}\n', why: 'construct(): new Promise(executor) -> construct helper 2801' },
  { file: 'shader.js', anchor: '  var id=method;if(id==901u){id=102u;}if(id==902u){id=107u;}\n  let a=objectView(l,original);', position: 'after',
    text: '\n  ${promiseCoreObjectMethodWGSL}', why: 'objectMethod: intrinsics 2840..2847, Promise() without new -> TypeError' },
  { file: 'shader.js', anchor: '${phase4WGSLFunctions(phase4Context)}', position: 'before',
    text: '${promiseCoreWGSLFunctions({F,L})}\n', why: 'promise-core WGSL functions (module scope)' },
  { file: 'shader.js', anchor: '    // Fixed node 65: global object (phase4-global.js), global-object mode only.', position: 'before',
    text: '    ${promiseCoreInitWGSL({F})}\n', why: 'init fixed nodes 90/91 (after Function.prototype/Object.prototype exist)' },
]);

export function applyPromiseCoreEdits(files, edits = promiseCoreIntegrationEdits) {
  const out = { ...files };
  for (const e of edits) {
    const s = out[e.file];
    if (typeof s !== 'string') throw new Error(`promise-core: missing file ${e.file}`);
    const n = s.split(e.anchor).length - 1;
    if (n !== 1) throw new Error(`promise-core anchor matched ${n} times: ${e.file}: ${e.anchor.slice(0, 90)}`);
    out[e.file] = e.position === 'replace' ? s.replace(e.anchor, () => e.text)
      : e.position === 'before' ? s.replace(e.anchor, () => e.text + e.anchor)
      : s.replace(e.anchor, () => e.anchor + e.text);
  }
  return out;
}

export const promiseCorePending = Object.freeze([
  'Subclass construction (class X extends Promise, Reflect.construct(Promise, args, NewTarget)) stays the existing status-6 built-in-parent boundary: construct() has no path that passes a foreign NewTarget into a tag-11 constructor helper, so OrdinaryCreateFromConstructor(NewTarget) cannot read NewTarget.prototype. promiseCoreBoundaryCases records the normative outcomes.',
  'FIXED_RESERVED_LAST (phase4-fixed-nodes.js, parent-owned) must be >= 91 (contract: 105) before init writes nodes 90/91; otherwise they are on the free list.',
  'jobEnqueue (worker 7) and __promiseResolveBody 2825 (worker 2) are external dependencies; settling a promise with reactions and every resolve() path need them.',
  'Object.getOwnPropertyNames(Promise) / Reflect.ownKeys(Promise): ownKeys() rejects every tag-11 value with status 6 (shared limitation for all backed natives, e.g. Map).',
  'Function.prototype.toString.call(Promise) follows the existing native-function source path (not changed here).',
]);
