// Promise + async wave, worker 5: async function activations (QuickJS function
// kind 2). Production WGSL hooks plus strict guest bootstrap helpers. Nothing
// here runs guest semantics on the host; the host only packs and checks.
//
// Representation (heap kinds 68..70, PROMISE_KINDS.asyncHeader/asyncSaved/asyncThis):
//   header kind 68: value=(savedPc, activationEnv, firstSavedCell, state),
//                   key = result promise P (object node), next = this slot (kind 70).
//   saved cell kind 69: value = saved operand V, key = stack index, next = next cell.
//   this slot kind 70: value = frame receiver captured at suspension.
//   activation env (kind 4) key = header id while the activation is live
//   (env.key is otherwise always 0; env.value.z/w stay untouched so new.target
//   and constructor markers keep their meaning). The env->header link is the
//   brand: header.value.y must point back at the env.
// States: 2 executing, 1 awaiting (saved), 3 completed (links dropped).
// The awaiting token handed to guest helpers is V(header,0,4,0): an opaque
// internal value only trusted bootstrap helpers ever hold (never user code).
import { ASYNC_KIND_BIT, PROMISE_NODES, PROMISE_KINDS, PROMISE_STATUS, PROMISE_IDS, ASYNC_ID_RANGES, SYMBOL_NODES, PROMISE_CONTINUATIONS } from './promise-ids.js';

export const ASYNC_FUNCTION_KIND_BIT = ASYNC_KIND_BIT; // 1<<19, kind 2 => bit 19 only
export const ASYNC_FUNCTION_IDS = Object.freeze({
  asyncFunction: 2860,   // %AsyncFunction% identity; call/construct => status 6 (dynamic code unsupported)
  awaitHelper: 2861,     // guest helper asyncFunctionAwait(activation, value, promise)
  resolveReturn: 2862,   // guest helper asyncFunctionResolveReturn(promise, value)
  resume: 2870,          // WGSL intrinsic __lanesAsyncResume(activation, isThrow, value): installs the saved frame
});
export const ASYNC_FUNCTION_NODES = Object.freeze({ asyncFunctionProto: PROMISE_NODES.asyncFunctionProto });
export const ASYNC_FUNCTION_KINDS = Object.freeze({ header: PROMISE_KINDS.asyncHeader, saved: PROMISE_KINDS.asyncSaved, thisSlot: PROMISE_KINDS.asyncThis });
// Continuations 138..143 are reserved for this worker but unused: every
// guest dispatch either replaces the activation frame in place (await,
// object return) or is deferred through status 11 to main().
export const ASYNC_FUNCTION_CONTINUATIONS_USED = Object.freeze([]);
export const ASYNC_FUNCTION_STATUS = Object.freeze({ asyncReject: PROMISE_STATUS.asyncReject });

const I = ASYNC_FUNCTION_IDS, N = ASYNC_FUNCTION_NODES, K = ASYNC_FUNCTION_KINDS;
for (const id of Object.values(I)) if (id < ASYNC_ID_RANGES.worker5[0] || id > ASYNC_ID_RANGES.worker5[1]) throw new Error(`async id ${id} outside worker-5 range`);
if (N.asyncFunctionProto !== 93 || K.header !== 68 || K.saved !== 69 || K.thisSlot !== 70 || PROMISE_STATUS.asyncReject !== 11) throw new Error('worker-5 reservation drift');
if (PROMISE_CONTINUATIONS.asyncFirst !== 138 || PROMISE_CONTINUATIONS.asyncLast !== 143) throw new Error('worker-5 continuation drift');
if (ASYNC_KIND_BIT !== 0x80000) throw new Error('ASYNC_KIND_BIT drift');

// QuickJS kind-2 opcodes. return_async is already in the generator opcode list;
// worker 5 adds only `await` (owner of the opcode; for-await reuses it).
export const asyncFunctionOpcodes = Object.freeze(['await']);
export const asyncFunctionKind2Opcodes = Object.freeze(['await', 'return_async']);

// ---- guest helpers (strict intrinsic roots, compiled by QuickJS, run on GPU)
// Await(value) (ES2025 27.7.5.3): the activation is already suspended when this
// helper runs (its frame was replaced in place by this helper's frame, so the
// helper's return value goes to the activation's caller):
//  2. promise = ? PromiseResolve(%Promise%, value)  -- abrupt => thrown INTO the
//     activation at the await point (synchronous resume with a throw), which is
//     exactly where the spec's `?` delivers it; the function may catch it.
//  3-9. PerformPromiseThen(promise, onFulfilled, onRejected) with no result
//     capability; the closures resume the saved activation (fulfil => value is
//     the await result, reject => thrown at the await point).
// Returns the activation's result promise: for the first activation step that
// is the value the original caller receives; for later steps the caller is a
// resume closure that discards it. Private names are bound to locals because
// nested arrows cannot see intrinsic-root private names.
export const asyncFunctionAwaitSource = `function asyncFunctionAwaitBootstrap(activation, value, promise) {
  "use strict";
  const resume = __lanesAsyncResume;
  let awaited;
  try {
    awaited = __promiseResolve(__asyncPromiseIntrinsic, value);
  } catch (error) {
    resume(activation, 1, error);
    return promise;
  }
  __promisePerformThen(awaited, v => { resume(activation, 0, v); }, r => { resume(activation, 1, r); }, undefined);
  return promise;
}`;
// AsyncBlockStart step "normal completion with value": Call(capability.[[Resolve]],
// undefined, <<value>>). Only object-like values reach this helper (primitives
// are fulfilled directly in WGSL, which is unobservably identical). P's
// resolving functions are never exposed, so alreadyResolved is always false and
// the Promise Resolve Functions body (worker 2, 2825) is the complete operation.
export const asyncFunctionResolveReturnSource = `function asyncFunctionResolveReturnBootstrap(promise, value) {
  "use strict";
  __promiseResolveBody(promise, value);
  return promise;
}`;
// FIELDS slots (distinct from every public property name).
export const asyncFunctionSources = Object.freeze({
  asyncFunctionAwait: asyncFunctionAwaitSource,
  asyncFunctionResolveReturn: asyncFunctionResolveReturnSource,
});
export const asyncFunctionBuiltinFields = Object.freeze({ [I.awaitHelper]: 'asyncFunctionAwait', [I.resolveReturn]: 'asyncFunctionResolveReturn' });
// 'AsyncFunction' is a text slot (name / @@toStringTag value), not a helper slot.
export const asyncFunctionFields = Object.freeze(['AsyncFunction', ...Object.keys(asyncFunctionSources)]);
// privateBuiltins OWNED by worker 5 (name -> id). __asyncPromiseIntrinsic is a
// worker-5 private alias for the tag-11 %Promise% value (id 2800, worker 1).
export const asyncFunctionPrivateBuiltins = Object.freeze({
  __lanesAsyncResume: I.resume,
  __asyncPromiseIntrinsic: PROMISE_IDS.ctor,
});
// Names the helpers reference that other workers register.
export const asyncFunctionDependencies = Object.freeze({
  __promiseResolve: { id: 2827, owner: 'worker 2 (promise-resolve-source.js)' },
  __promisePerformThen: { id: 2830, owner: 'worker 3 (promise-then-source.js)' },
  __promiseResolveBody: { id: 2825, owner: 'worker 2 (promise-resolve-source.js)' },
});
export const asyncFunctionWGSLDependencies = Object.freeze({
  promiseAllocate: 'worker 1: fn promiseAllocate(l:u32,proto:u32)->u32',
  promiseHeaderOf: 'worker 1: fn promiseHeaderOf(l:u32,v:V)->u32',
  promiseSettleHeader: 'worker 1: fn promiseSettleHeader(l:u32,header:u32,state:u32,value:V)',
  promiseMatchingReactions: 'worker 1: fn promiseMatchingReactions(l:u32,header:u32,state:u32)->u32',
});
export const asyncFunctionMetadata = Object.freeze([
  Object.freeze({ id: I.asyncFunction, name: 'AsyncFunction', length: 1 }),
]);

// ---- WGSL ----------------------------------------------------------------------
export const asyncFunctionGCWGSL = `
    if(node.kind==4u&&node.key!=0u){mark(l,node.key);}
    if(node.kind==${K.header}u){mark(l,node.value.y);mark(l,node.value.z);mark(l,node.key);}
    if(node.kind==${K.saved}u||node.kind==${K.thisSlot}u){markValue(l,node.value);}
`;
export const asyncFunctionWGSLFunctions = ({ L }) => `
const ASYNC_FUNCTION_PROTOTYPE:u32=${N.asyncFunctionProto}u;
const ASYNC_AWAITING:u32=1u;
const ASYNC_EXECUTING:u32=2u;
const ASYNC_COMPLETED:u32=3u;
fn asyncFunction(l:u32,fnValue:V)->bool {
  if(fnValue.z!=5u||states[l].heap[fnValue.x].kind!=5u){return false;}
  return (image[states[l].heap[fnValue.x].value.x*2u].w&0xc0000u)==${ASYNC_KIND_BIT}u;
}
fn asyncActive(l:u32,env:u32)->u32 {
  if(env==0u||states[l].heap[env].kind!=4u){return 0u;}
  let id=states[l].heap[env].key;
  if(id==0u||states[l].heap[id].kind!=${K.header}u||states[l].heap[id].value.y!=env){return 0u;}
  return id;
}
fn asyncPromise(l:u32,id:u32)->V {return V(states[l].heap[id].key,0u,4u,0u);}
fn asyncClose(l:u32,id:u32) {
  let env=states[l].heap[id].value.y;
  if(env!=0u&&states[l].heap[env].kind==4u&&states[l].heap[env].key==id){states[l].heap[env].key=0u;}
  states[l].heap[id].value=V(0u,0u,0u,ASYNC_COMPLETED);
  let thisSlot=states[l].heap[id].next;
  if(thisSlot!=0u&&states[l].heap[thisSlot].kind==${K.thisSlot}u){states[l].heap[thisSlot].value=undef();}
}
// call() hook: after the activation environment exists and arguments are
// bound, before the frame is pushed. Allocates P (%Promise.prototype%), the
// this slot and the header; links env->header last so a failed allocation
// leaves no half-branded environment. No collection happens here.
fn asyncEnter(l:u32,env:u32) {
  let promise=promiseAllocate(l,${PROMISE_NODES.promiseProto}u);
  if(states[l].status!=0u){return;}
  if(promise==0u){states[l].status=3u;return;}
  let thisSlot=alloc(l,${K.thisSlot}u,undef(),0u,0u);
  if(states[l].status!=0u){return;}
  let id=alloc(l,${K.header}u,V(0u,env,0u,ASYNC_EXECUTING),promise,thisSlot);
  if(states[l].status!=0u){return;}
  states[l].heap[env].key=id;
}
// Replace the current (activation) frame by a frame for builtin helper id with
// 2 or 3 arguments. The helper frame inherits the activation frame's return pc,
// stack base, tail flag/continuation code and continuation data, so the
// helper's return value is delivered exactly as the activation's would be.
fn asyncReplaceFrame(l:u32,helper:u32,a:V,b:V,c:V,argc:u32) {
  if(states[l].depth==0u){states[l].status=2u;return;}
  let frame=states[l].frames[states[l].depth];
  states[l].sp=frame.base;states[l].depth--;
  states[l].env=states[l].frames[states[l].depth].env;states[l].pc=frame.pc;
  push(l,V(helper,0u,11u,0u));push(l,a);push(l,b);if(argc>2u){push(l,c);}
  if(states[l].status!=0u){return;}
  let depth=states[l].depth;call(l,argc,false,false);
  if(states[l].status!=0u){return;}
  if(states[l].depth!=depth+1u){states[l].status=2u;return;}
  states[l].frames[states[l].depth].tail=frame.tail;
  states[l].frames[states[l].depth].receiver=frame.receiver;
}
// await opcode. Collect first while the awaited value and the whole operand
// segment are still rooted on the live stack (generatorSuspend rule), then
// save the segment (without the awaited value), the receiver and pc, and hand
// control to the await helper in place of the activation frame.
fn asyncAwait(l:u32) {
  let id=asyncActive(l,states[l].env);
  if(id==0u||states[l].heap[id].value.w!=ASYNC_EXECUTING||states[l].depth==0u){states[l].status=2u;return;}
  let frame=states[l].frames[states[l].depth];
  if(states[l].sp<frame.base+1u){states[l].status=2u;return;}
  let needed=states[l].sp-frame.base+${L.args + 24}u;
  if(states[l].freeCount<needed){collect(l);}
  if(states[l].freeCount<needed){states[l].status=3u;return;}
  let awaited=pop(l);
  if(states[l].status!=0u){return;}
  var first=0u;var previous=0u;
  for(var index=frame.base;index<states[l].sp;index++){
    let slot=alloc(l,${K.saved}u,states[l].stack[index],index-frame.base,0u);
    if(states[l].status!=0u){return;}
    if(previous==0u){first=slot;}else{states[l].heap[previous].next=slot;}previous=slot;
  }
  let thisSlot=states[l].heap[id].next;
  if(thisSlot==0u||states[l].heap[thisSlot].kind!=${K.thisSlot}u){states[l].status=2u;return;}
  states[l].heap[thisSlot].value=frame.receiver;
  states[l].heap[id].value=V(states[l].pc,states[l].env,first,ASYNC_AWAITING);
  asyncReplaceFrame(l,${I.awaitHelper}u,V(id,0u,4u,0u),awaited,asyncPromise(l,id),3u);
}
// return_async inside an async activation (value still on the stack).
fn asyncReturn(l:u32,id:u32) {
  let promise=asyncPromise(l,id);
  let header=promiseHeaderOf(l,promise);
  if(header==0u){states[l].status=2u;return;}
  let needed=promiseMatchingReactions(l,header,1u)*3u+${L.args + 24}u;
  if(states[l].freeCount<needed){collect(l);}
  let value=pop(l);
  if(states[l].status!=0u){return;}
  asyncClose(l,id);
  if(value.z==4u||value.z==5u||value.z==11u){
    asyncReplaceFrame(l,${I.resolveReturn}u,promise,value,undef(),2u);return;
  }
  promiseSettleHeader(l,header,1u,value);
  if(states[l].status==0u){finish(l,promise);}
}
// __lanesAsyncResume(activation, isThrow, value) from a resume closure (or the
// await helper's PromiseResolve-abrupt path). Installs the saved frame on top
// of the caller like generatorResume; never allocates.
fn asyncResume(l:u32,token:V,isThrow:bool,value:V,base:u32,tail:bool) {
  if(token.z!=4u||states[l].heap[token.x].kind!=${K.header}u){states[l].status=2u;return;}
  let id=token.x;let saved=states[l].heap[id].value;
  if(saved.w!=ASYNC_AWAITING){states[l].status=2u;return;}
  if(states[l].depth+1u>=${L.frames}u){states[l].status=3u;return;}
  var count=0u;var cursor=saved.z;
  for(var i=0u;i<${L.stack}u&&cursor!=0u;i++){
    if(states[l].heap[cursor].kind!=${K.saved}u){states[l].status=2u;return;}
    count++;cursor=states[l].heap[cursor].next;
  }
  if(cursor!=0u||base+count+2u>${L.stack}u){states[l].status=3u;return;}
  let thisSlot=states[l].heap[id].next;
  if(thisSlot==0u||states[l].heap[thisSlot].kind!=${K.thisSlot}u){states[l].status=2u;return;}
  states[l].depth++;
  states[l].frames[states[l].depth]=Frame(states[l].pc,saved.y,base,select(0u,1u,tail),states[l].heap[thisSlot].value);
  states[l].sp=base;states[l].env=saved.y;states[l].pc=saved.x;
  cursor=saved.z;
  for(var i=0u;i<count;i++){push(l,states[l].heap[cursor].value);cursor=states[l].heap[cursor].next;}
  states[l].heap[id].value.z=0u;states[l].heap[id].value.w=ASYNC_EXECUTING;
  if(isThrow){raise(l,value);}else{push(l,value);}
}
// raise() hook, evaluated when unwinding reaches the base of frame depth:
// nonzero when that frame is an executing async activation (the exception is
// converted to rejection instead of crossing it).
fn asyncUnwindBoundary(l:u32,depth:u32)->u32 {
  let id=asyncActive(l,states[l].frames[depth].env);
  if(id==0u||states[l].heap[id].value.w!=ASYNC_EXECUTING){return 0u;}
  return id;
}
// raise() hook after the scan stopped at an activation boundary (sp == frame
// base, depth == activation frame). Leaves P and the reason on the live stack
// (rooted) and defers to main() with internal status 11; raise cannot call
// finish() (finish -> raise via continuation 80 would recurse).
fn asyncRaiseBoundary(l:u32,id:u32,error:V) {
  let promise=asyncPromise(l,id);
  asyncClose(l,id);
  push(l,promise);push(l,error);
  if(states[l].status==0u){states[l].status=${PROMISE_STATUS.asyncReject}u;}
}
// main(): status 11 => RejectPromise(P, reason) in WGSL (no guest code is
// observable in RejectPromise), then the activation frame returns P.
fn asyncRejectDispatch(l:u32) {
  if(states[l].status!=${PROMISE_STATUS.asyncReject}u){return;}
  states[l].status=0u;
  if(states[l].sp<states[l].frames[states[l].depth].base+2u){states[l].status=2u;return;}
  let promise=states[l].stack[states[l].sp-2u];
  let header=promiseHeaderOf(l,promise);
  if(header==0u){states[l].status=2u;return;}
  let needed=promiseMatchingReactions(l,header,2u)*3u+8u;
  if(states[l].freeCount<needed){collect(l);}
  let reason=pop(l);let ignored=pop(l);
  promiseSettleHeader(l,header,2u,reason);
  if(states[l].status==0u){finish(l,promise);}
}
`;
export const asyncFunctionWGSLCases = () => ({
  await: 'asyncAwait(l);',
  // Overrides the generator body; generators keep the plain finish path.
  return_async: 'let returning=asyncActive(l,states[l].env);if(returning!=0u&&states[l].heap[returning].value.w==ASYNC_EXECUTING){asyncReturn(l,returning);}else{let value=pop(l);if(states[l].status==0u){finish(l,value);}}',
});
// call(): resume intrinsic and %AsyncFunction% (dynamic code unsupported).
export const asyncFunctionCallWGSL = `  if(fnValue.z==11u&&fnValue.x==${I.resume}u){
    var asyncToken=undef();var asyncMode=undef();var asyncValue=undef();
    if(argc>0u){asyncToken=states[l].stack[base+extra];}
    if(argc>1u){asyncMode=states[l].stack[base+extra+1u];}
    if(argc>2u){asyncValue=states[l].stack[base+extra+2u];}
    asyncResume(l,asyncToken,truth(asyncMode),asyncValue,base,tail);return;
  }
  if(fnValue.z==11u&&fnValue.x==${I.asyncFunction}u){states[l].status=6u;return;}
`;
export const asyncFunctionEnterWGSL = `\n  if(asyncFunction(l,fnValue)){asyncEnter(l,env);if(states[l].status!=0u){return;}}`;
export const asyncFunctionClosureWGSL = `  if((fnInfo.w&0xc0000u)==${ASYNC_KIND_BIT}u){states[l].heap[backing].value.x=ASYNC_FUNCTION_PROTOTYPE;}\n`;
export const asyncFunctionInitWGSL = ({ F }) => `
  states[l].heap[${N.asyncFunctionProto}u]=Node(V(3u,0u,0u,1u),0u,0u,2u,0u);
  dataProperty(l,${N.asyncFunctionProto}u,fieldKey(${F.constructor}u),V(${I.asyncFunction}u,0u,11u,0u),4u);
  dataProperty(l,${N.asyncFunctionProto}u,0x60000000u|${SYMBOL_NODES.toStringTag}u,image[fieldKey(${F.AsyncFunction}u)],4u);
`;
export const asyncFunctionPropertyWGSL = ({ F }) => `if(obj.z==11u&&obj.x==${I.asyncFunction}u){if(field(l,key,${F.name}u)){return image[fieldKey(${F.AsyncFunction}u)];}if(lengthKey(l,key)){return num(fromUnsigned(1u));}if(field(l,key,${F.prototype}u)){return V(${N.asyncFunctionProto}u,0u,4u,0u);}states[l].status=6u;return undef();}`;
export const asyncFunctionDispatchWGSL = ({ F }) => Object.entries(asyncFunctionBuiltinFields).map(([id, field]) => `if(fnValue.x==${id}u){field=${F[field]}u;}`).join('\n    ');

// ---- integration edits (anchors in generatorIntegrationPatch(live,{iteratorPrototypeNode:77}) output)
const IMPORT = "import {asyncFunctionGCWGSL,asyncFunctionWGSLFunctions,asyncFunctionCallWGSL,asyncFunctionEnterWGSL,asyncFunctionClosureWGSL,asyncFunctionInitWGSL,asyncFunctionPropertyWGSL,asyncFunctionDispatchWGSL} from './async-function-source.js';\n";
export const asyncFunctionIntegrationEdits = Object.freeze([
  // program.js: admit kind 2 and mark it with bit 19. Literal bit keeps program.js import-free.
  { file: 'program.js', anchor: 'fn.kind !== 1))', position: 'before', text: 'fn.kind !== 2 && ',
    why: 'admit QuickJS async function kind 2 (kind 3 stays rejected for worker 6)' },
  { file: 'program.js', anchor: '(fn.kind === 1 ? GENERATOR_KIND_BIT : 0) |', position: 'after', text: ' (fn.kind === 2 ? 0x80000 /* ASYNC_KIND_BIT */ : 0) |',
    why: 'function-info word bit 19 marks async functions' },
  { file: 'program.js', anchor: 'export const FIELDS =', position: 'before',
    text: "for(const name of ['AsyncFunction','asyncFunctionAwait','asyncFunctionResolveReturn'])if(!fieldNames.includes(name))fieldNames.push(name);\n",
    why: 'append-only FIELDS: AsyncFunction text + two helper slots' },
  // phase4-class-elements.js: async (non-generator) methods admitted; async generator methods stay rejected for worker 6.
  { file: 'phase4-class-elements.js', anchor: "if (node.type === 'MethodDefinition' && node.value && node.value.async)", position: 'replace',
    text: "if (node.type === 'MethodDefinition' && node.value && node.value.async && node.value.generator)",
    why: 'admit async class/private methods (kind 2)' },
  { file: 'phase4-class-elements.js', anchor: "return 'Unsupported async class method';", position: 'replace',
    text: "return 'Unsupported async generator class method';", why: 'message matches the remaining rejection' },
  // phase4-registry.js: opcode, WGSL functions, cases.
  { file: 'phase4-registry.js', anchor: "import {generatorOpcodes,generatorWGSLFunctions,generatorWGSLCases} from './generator-source.js';\n", position: 'before',
    text: "import {asyncFunctionOpcodes,asyncFunctionWGSLFunctions,asyncFunctionWGSLCases} from './async-function-source.js';\n", why: 'import worker-5 module' },
  { file: 'phase4-registry.js', anchor: '...generatorDelegationOpcodes', position: 'after', text: ',...asyncFunctionOpcodes',
    why: 'append opcode await (return_async already appended by generators)' },
  { file: 'phase4-registry.js', anchor: '  if(generatorOpcodes.includes(op))return {op,a:0,b:0};', position: 'after',
    text: '\n  if(asyncFunctionOpcodes.includes(op))return {op,a:0,b:0};',
    why: 'lower await before the iteration module rejects it (await stays rejected only for kinds still rejected by packProgram)' },
  { file: 'phase4-registry.js', anchor: ' generatorWGSLFunctions(context) + ', position: 'after', text: 'asyncFunctionWGSLFunctions(context) + ',
    why: 'WGSL functions (module-scope order is irrelevant in WGSL)' },
  { file: 'phase4-registry.js', anchor: '    ...generatorDelegationCasesWGSL(context),', position: 'after', text: '\n    ...asyncFunctionWGSLCases(context),',
    why: 'await case; return_async override dispatching async activations, else the generator/plain finish path' },
  // bootstrap.js: helper sources + private names.
  { file: 'bootstrap.js', anchor: "import { phase4BootstrapSources, phase4PrivateBuiltins, protocolBootstrapSources } from './phase4-registry.js';", position: 'after',
    text: "\nimport { asyncFunctionSources, asyncFunctionPrivateBuiltins } from './async-function-source.js';", why: 'import worker-5 helpers' },
  { file: 'bootstrap.js', anchor: '  ...phase3BigintConversionIntrinsics,', position: 'before', text: '  ...asyncFunctionPrivateBuiltins,\n',
    why: 'privateBuiltins: __lanesAsyncResume 2870, __asyncPromiseIntrinsic 2800' },
  { file: 'bootstrap.js', anchor: '  ...generatorDelegationSources,', position: 'after', text: '\n  ...asyncFunctionSources,',
    why: 'bootstrapSources: asyncFunctionAwait, asyncFunctionResolveReturn' },
  // shader.js
  { file: 'shader.js', anchor: "import {generatorGCWGSL,generatorClosureWGSL,generatorInitWGSL,generatorMetadata} from './generator-source.js';\n", position: 'before',
    text: IMPORT, why: 'import worker-5 WGSL fragments' },
  { file: 'shader.js', anchor: '    ${generatorGCWGSL}', position: 'after', text: '\n    ${asyncFunctionGCWGSL}',
    why: 'GC: env->header, header->env/saved/P, saved cells and this slot' },
  { file: 'shader.js', anchor: '  return V(id,0u,5u,0u);\n}\nfn keyOf', position: 'before', text: '${asyncFunctionClosureWGSL}',
    why: 'closure(): async functions inherit from %AsyncFunction.prototype% (no prototype property: hasPrototype=0)' },
  { file: 'shader.js', anchor: '    if(fnValue.x==960u){field=${F.numberPow}u;}', position: 'before',
    text: '    ${asyncFunctionDispatchWGSL({F})}\n', why: 'call(): tag-11 2861/2862 -> helper closures' },
  { file: 'shader.js', anchor: '  if(fnValue.z==11u) {\n    var receiver=', position: 'before', text: '${asyncFunctionCallWGSL}',
    why: 'call(): __lanesAsyncResume installs a frame; %AsyncFunction% call => status 6' },
  { file: 'shader.js', anchor: 'if(generatorFunction(l,fnValue)){generatorEnter(l,fnValue,env,receiver);if(states[l].status!=0u){return;}}', position: 'after',
    text: '${asyncFunctionEnterWGSL}', why: 'call(): create activation header + result promise before the first instruction' },
  { file: 'shader.js', anchor: '  if(callee.z==11u&&callee.x==2503u){states[l].status=6u;return;}', position: 'before',
    text: '  if(callee.z==11u&&callee.x==2860u){states[l].status=6u;return;}\n', why: 'construct(): new AsyncFunction(...) is dynamic code => status 6' },
  { file: 'shader.js', anchor: '  if(obj.z==11u&&obj.x==2000u){', position: 'before', text: '  ${asyncFunctionPropertyWGSL({F})}\n',
    why: 'getProperty(): %AsyncFunction% name/length/prototype' },
  { file: 'shader.js', anchor: '    if(globalMode()){globalInit(l);}', position: 'before', text: '    ${asyncFunctionInitWGSL({F})}\n',
    why: 'init fixed node 93 %AsyncFunction.prototype% (requires FIXED_RESERVED_LAST >= 93)' },
  // raise(): catching activation boundary.
  { file: 'shader.js', anchor: 'var suspendClose=false;var closeRecordIndex=0u;', position: 'after', text: 'var asyncBoundary=0u;',
    why: 'raise(): boundary id' },
  { file: 'shader.js', anchor: '!found && !suspendClose', position: 'after', text: ' && asyncBoundary==0u', why: 'raise(): stop scanning at a boundary' },
  { file: 'shader.js', anchor: '      // Tail 40 is for_of_next.', position: 'before',
    text: '      asyncBoundary=asyncUnwindBoundary(l,depth);if(asyncBoundary!=0u){break;}\n',
    why: 'raise(): an executing async activation frame catches (before tail-40 record clearing and generatorUnwind)' },
  { file: 'shader.js', anchor: '  if(suspendClose){\n    let record=states[l].stack[closeRecordIndex];', position: 'before',
    text: '  if(asyncBoundary!=0u){asyncRaiseBoundary(l,asyncBoundary,error);return;}\n', why: 'raise(): defer rejection via status 11' },
  // main(): status 11 dispatch, both before the implicit-error block (switch => 11)
  // and before the status-9 block (implicit error raise => 11).
  { file: 'shader.js', anchor: '    if (states[l].status==4u || states[l].status==5u || states[l].status==8u) {', position: 'before',
    text: '    asyncRejectDispatch(l);\n', why: 'main(): status 11 raised by an opcode' },
  { file: 'shader.js', anchor: '    if(states[l].status==9u){\n      let error=peek(l);', position: 'before',
    text: '    asyncRejectDispatch(l);\n', why: 'main(): status 11 raised while converting status 4/5/8' },
]);

export const asyncFunctionGaps = Object.freeze([
  'HostPromiseRejectionTracker is not modelled (no unhandled-rejection reporting).',
  'Dynamic AsyncFunction(...) construction/call is explicitly unsupported (status 6); other %AsyncFunction% properties than name/length/prototype report status 6.',
  'Continuations 138..143 stay reserved and unused.',
  'Async generators (kind 3, bits 18|19) remain rejected; generatorFunction() matches bit 18 and must be narrowed by worker 6; return_async override must be chained by worker 6.',
  'Settling P with more pending reactions than free nodes/3 is a resource outcome (status 3).',
]);
