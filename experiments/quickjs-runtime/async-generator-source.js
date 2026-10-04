// Promise + async wave, worker 6: async generators (ES2025 27.6).
//
// Split of responsibilities (all guest semantics run on the GPU):
//  * WGSL (this module's strings): the activation. Calling an async generator
//    function creates the generator object (heap kind 2, unflagged value.z link
//    to a kind-74 header), runs parameter initialization, and suspends at
//    `initial_yield`. Inside a kind-3 activation the opcodes `await`, `yield`,
//    `async_yield_star` and `initial_yield` are intercepted *before* the
//    opcode switch: they save the activation's operand segment (kind 76 cells),
//    record why the body stopped (the "signal"), and return the operand to
//    whoever resumed the body. `return_async` and exceptions escaping the
//    activation are observed by finish()/raise() hooks that complete the
//    activation (signal return/throw). Resumption is a private intrinsic
//    (2884) that installs the saved frame on top of its guest caller.
//  * Guest strict bootstrap helpers (QuickJS bytecode run by the VM): the
//    request queue protocol (AsyncGeneratorEnqueue / Resume / CompleteStep /
//    DrainQueue / AwaitReturn / Await) using worker 1/2/3 promise helpers.
//    The body's stop signal is consumed by asyncGeneratorRun, a loop that also
//    implements AsyncGeneratorYield step 11 (queue not empty: continue without
//    suspending) and Await (PromiseResolve + PerformPromiseThen with arrow
//    closures that call asyncGeneratorRun again from a reaction job).
//
// The request queue is a WGSL list of kind-75 cells rooted in the header's
// kind-77 aux node; each cell's value is a guest request record
// {type, value, capability} (null-prototype object from __lanesDescriptor).
//
// This module never imports program.js/shader.js (import cycle) and never
// writes files. Integration is the exported anchored edit list, applied on top
// of generatorIntegrationPatch(live, {iteratorPrototypeNode:77}).
import { GENERATOR_KIND_BIT } from './generator-source.js';
import { ASYNC_KIND_BIT, PROMISE_NODES, PROMISE_KINDS, ASYNC_ID_RANGES, PROMISE_CONTINUATIONS, SYMBOL_NODES } from './promise-ids.js';

export const ASYNC_GENERATOR_INFO_BITS = GENERATOR_KIND_BIT | ASYNC_KIND_BIT; // 0xC0000: QuickJS kind 3
if (ASYNC_GENERATOR_INFO_BITS !== 0xC0000) throw new Error('async generator function-info bits drifted');

export const ASYNC_GENERATOR_NODES = Object.freeze({
  functionPrototype: PROMISE_NODES.asyncGeneratorFunctionProto, // 94 %AsyncGeneratorFunction.prototype%
  prototype: PROMISE_NODES.asyncGeneratorProto,                 // 95 %AsyncGeneratorPrototype%
  asyncIteratorPrototype: PROMISE_NODES.asyncIteratorProto,     // 96 (worker 7 initializes; referenced only)
});
export const ASYNC_GENERATOR_KINDS = Object.freeze({
  header: PROMISE_KINDS.asyncGeneratorHeader,   // 74
  request: PROMISE_KINDS.asyncGeneratorRequest, // 75
  saved: PROMISE_KINDS.asyncGeneratorSaved,     // 76
  aux: PROMISE_KINDS.asyncGeneratorSpare,       // 77 (receiver + queue head/tail)
});
// Environment marker (env node kind 4, value.w) for an active async generator
// activation; value.z = owning generator object. Distinct from constructor 5
// and synchronous generator 6. Any non-zero w makes GC trace value.z.
export const ASYNC_GENERATOR_ENV = 74;
// Continuations 144..151 are reserved for this worker and intentionally
// unused: all guest dispatch is ordinary nested guest calls from helpers.
export const ASYNC_GENERATOR_CONTINUATIONS_USED = Object.freeze([]);
if (PROMISE_CONTINUATIONS.asyncGeneratorFirst !== 144) throw new Error('continuation reservation drifted');

export const ASYNC_GENERATOR_IDS = Object.freeze({
  next: 2880, return: 2881, throw: 2882, functionIdentity: 2883,
  // WGSL private intrinsics (trusted bootstrap only).
  resume: 2884,    // __lanesAsyncGeneratorResume(generator, mode, value): installs frame (call() hook)
  state: 2885,     // __lanesAsyncGeneratorState(value) -> -1 | 0..4 (never throws)
  setState: 2886,  // __lanesAsyncGeneratorSetState(generator, state)
  enqueue: 2887,   // __lanesAsyncGeneratorEnqueue(generator, request)
  first: 2888,     // __lanesAsyncGeneratorFirst(generator) -> request | undefined
  dequeue: 2889,   // __lanesAsyncGeneratorDequeue(generator) -> request | undefined
  signal: 2890,    // __lanesAsyncGeneratorSignal(generator) -> 0 yield, 1 await, 2 return, 3 throw
  // Guest helpers callable from other helpers.
  request: 2891, run: 2892, completeStep: 2893, drainQueue: 2894, awaitReturn: 2895,
  // 2896..2909 spare.
});
{
  const [first, last] = ASYNC_ID_RANGES.worker6;
  for (const id of Object.values(ASYNC_GENERATOR_IDS)) if (id < first || id > last) throw new Error(`async generator id ${id} outside worker 6 range`);
}
// Spec states published to guest helpers by 2885.
export const ASYNC_GENERATOR_STATES = Object.freeze({ suspendedStart: 0, suspendedYield: 1, executing: 2, drainingQueue: 3, completed: 4 });
// Internal resume protocol (what the saved activation expects on resumption).
export const ASYNC_GENERATOR_PROTOCOL = Object.freeze({ start: 0, yield: 1, yieldStar: 2, await: 3, running: 4, done: 5 });
export const ASYNC_GENERATOR_SIGNALS = Object.freeze({ yield: 0, await: 1, return: 2, throw: 3, none: 7 });

// Public builtin metadata (tag-11 values; name/length served by getProperty).
export const asyncGeneratorMetadata = Object.freeze([
  { id: 2880, name: 'next', length: 1, field: 'asyncGeneratorNext' },
  { id: 2881, name: 'return', length: 1, field: 'asyncGeneratorReturn' },
  { id: 2882, name: 'throw', length: 1, field: 'asyncGeneratorThrow' },
  { id: 2883, name: 'AsyncGeneratorFunction', length: 1, field: null },
]);

// QuickJS opcodes this worker adds to the OP table (append-only).
export const asyncGeneratorOpcodes = Object.freeze(['async_yield_star']);
// Shared opcodes owned by other workers that kind-3 bytecode also uses.
// `await` (worker 5) must exist in OP: the intercept below reads OP.await.
// `for_await_of_start` (worker 7) is GetIterator(obj, async) for yield* and
// for-await. iterator_next/iterator_call/iterator_check_object come from the
// synchronous generator delegation module and are reused unchanged.
export const asyncGeneratorDependencyOpcodes = Object.freeze({ await: 'worker 5', for_await_of_start: 'worker 7' });

// --------------------------------------------------------------- guest --
// Private names are visible only in a helper's ROOT scope (coordinator note),
// so arrow closures capture root-scope locals bound to them.
const S = ASYNC_GENERATOR_STATES;
export const asyncGeneratorSources = Object.freeze({
  // %AsyncGeneratorPrototype%.next / return / throw (27.6.1.2-4).
  asyncGeneratorNext: `function asyncGeneratorNextBootstrap(value) {
  "use strict";
  return __asyncGeneratorRequest(this, 0, value);
}`,
  asyncGeneratorReturn: `function asyncGeneratorReturnBootstrap(value) {
  "use strict";
  return __asyncGeneratorRequest(this, 1, value);
}`,
  asyncGeneratorThrow: `function asyncGeneratorThrowBootstrap(exception) {
  "use strict";
  return __asyncGeneratorRequest(this, 2, exception);
}`,
  // Shared body of next/return/throw: NewPromiseCapability(%Promise%),
  // AsyncGeneratorValidate (IfAbruptRejectPromise: brand failures reject, never
  // throw synchronously), completed/suspended-start shortcuts,
  // AsyncGeneratorEnqueue, then AsyncGeneratorResume or AsyncGeneratorAwaitReturn.
  asyncGeneratorRequest: `function asyncGeneratorRequestBootstrap(generator, type, value) {
  "use strict";
  const capability = __promiseNewCapability(__lanesAsyncGeneratorPromise);
  const state = __lanesAsyncGeneratorState(generator);
  if (state < 0) {
    const rejectBrand = capability.reject;
    rejectBrand(new TypeError("AsyncGenerator method called on incompatible receiver"));
    return capability.promise;
  }
  if (type === 0) {
    if (state === ${S.completed}) {
      const resolveDone = capability.resolve;
      resolveDone({ value: undefined, done: true });
      return capability.promise;
    }
  } else if (type === 2) {
    let current = state;
    if (current === ${S.suspendedStart}) {
      __lanesAsyncGeneratorSetState(generator, ${S.completed});
      current = ${S.completed};
    }
    if (current === ${S.completed}) {
      const rejectDone = capability.reject;
      rejectDone(value);
      return capability.promise;
    }
  }
  const request = __lanesDescriptor();
  request.type = type;
  request.value = value;
  request.capability = capability;
  __lanesAsyncGeneratorEnqueue(generator, request);
  if (type === 1 && (state === ${S.suspendedStart} || state === ${S.completed})) {
    __lanesAsyncGeneratorSetState(generator, ${S.drainingQueue});
    __asyncGeneratorAwaitReturn(generator);
  } else if (state === ${S.suspendedStart} || state === ${S.suspendedYield}) {
    __asyncGeneratorRun(generator, type, value);
  }
  return capability.promise;
}`,
  // AsyncGeneratorResume + the generator side of AsyncGeneratorStart /
  // AsyncGeneratorYield / Await. Each iteration resumes the saved activation
  // once; the WGSL intrinsic returns when the body stops and 2890 says why.
  //  signal 1 (await): Await(value) = PromiseResolve(%Promise%, value) (abrupt
  //    -> thrown into the body at the await) then PerformPromiseThen with
  //    closures that resume through this helper from a reaction job.
  //  signal 0 (yield; operand already awaited by QuickJS bytecode):
  //    AsyncGeneratorCompleteStep(normal, false); if the queue is non-empty,
  //    continue with its first completion without suspending (step 11),
  //    otherwise publish suspended-yield.
  //  signal 2/3 (body returned / threw; the WGSL hook already set
  //    draining-queue): CompleteStep(done=true) then AsyncGeneratorDrainQueue.
  asyncGeneratorRun: `function asyncGeneratorRunBootstrap(generator, type, value) {
  "use strict";
  const run = __asyncGeneratorRun;
  let mode = type;
  let sent = value;
  for (;;) {
    let result;
    let signal;
    try {
      result = __lanesAsyncGeneratorResume(generator, mode, sent);
      signal = __lanesAsyncGeneratorSignal(generator);
    } catch (error) {
      result = error;
      signal = 3;
    }
    if (signal === 1) {
      let promise;
      try {
        promise = __promiseResolve(__lanesAsyncGeneratorPromise, result);
      } catch (error) {
        mode = 2;
        sent = error;
        continue;
      }
      __promisePerformThen(promise, v => { run(generator, 0, v); }, e => { run(generator, 2, e); }, undefined);
      return undefined;
    }
    if (signal === 0) {
      __asyncGeneratorCompleteStep(generator, 0, result, false);
      const next = __lanesAsyncGeneratorFirst(generator);
      if (next === undefined) {
        __lanesAsyncGeneratorSetState(generator, ${S.suspendedYield});
        return undefined;
      }
      mode = next.type;
      sent = next.value;
      continue;
    }
    __asyncGeneratorCompleteStep(generator, signal === 3 ? 2 : 0, result, true);
    __asyncGeneratorDrainQueue(generator);
    return undefined;
  }
}`,
  // AsyncGeneratorCompleteStep (27.6.3.4): remove the first request, then
  // reject with a throw completion or resolve with CreateIterResultObject.
  asyncGeneratorCompleteStep: `function asyncGeneratorCompleteStepBootstrap(generator, type, value, done) {
  "use strict";
  const next = __lanesAsyncGeneratorDequeue(generator);
  const capability = next.capability;
  if (type === 2) {
    const reject = capability.reject;
    reject(value);
  } else {
    const resolve = capability.resolve;
    resolve({ value: value, done: done });
  }
  return undefined;
}`,
  // AsyncGeneratorDrainQueue (27.6.3.9); state is draining-queue.
  asyncGeneratorDrainQueue: `function asyncGeneratorDrainQueueBootstrap(generator) {
  "use strict";
  for (;;) {
    const next = __lanesAsyncGeneratorFirst(generator);
    if (next === undefined) {
      __lanesAsyncGeneratorSetState(generator, ${S.completed});
      return undefined;
    }
    if (next.type === 1) {
      __asyncGeneratorAwaitReturn(generator);
      return undefined;
    }
    if (next.type === 2) __asyncGeneratorCompleteStep(generator, 2, next.value, true);
    else __asyncGeneratorCompleteStep(generator, 0, undefined, true);
  }
}`,
  // AsyncGeneratorAwaitReturn (27.6.3.8); state is draining-queue and the
  // first request is a return completion.
  asyncGeneratorAwaitReturn: `function asyncGeneratorAwaitReturnBootstrap(generator) {
  "use strict";
  const complete = __asyncGeneratorCompleteStep;
  const drain = __asyncGeneratorDrainQueue;
  const next = __lanesAsyncGeneratorFirst(generator);
  let promise;
  try {
    promise = __promiseResolve(__lanesAsyncGeneratorPromise, next.value);
  } catch (error) {
    complete(generator, 2, error, true);
    drain(generator);
    return undefined;
  }
  __promisePerformThen(promise, v => { complete(generator, 0, v, true); drain(generator); }, e => { complete(generator, 2, e, true); drain(generator); }, undefined);
  return undefined;
}`,
});
export const asyncGeneratorFields = Object.freeze(['AsyncGenerator', 'AsyncGeneratorFunction', ...Object.keys(asyncGeneratorSources)]);
const I = ASYNC_GENERATOR_IDS;
// id -> FIELDS slot of the implementing guest helper (shader call() dispatch).
export const asyncGeneratorBuiltinFields = Object.freeze({
  [I.next]: 'asyncGeneratorNext', [I.return]: 'asyncGeneratorReturn', [I.throw]: 'asyncGeneratorThrow',
  [I.request]: 'asyncGeneratorRequest', [I.run]: 'asyncGeneratorRun', [I.completeStep]: 'asyncGeneratorCompleteStep',
  [I.drainQueue]: 'asyncGeneratorDrainQueue', [I.awaitReturn]: 'asyncGeneratorAwaitReturn',
});
// Private names owned by this worker (bootstrap privateBuiltins).
export const asyncGeneratorPrivateBuiltins = Object.freeze({
  __lanesAsyncGeneratorResume: I.resume, __lanesAsyncGeneratorState: I.state, __lanesAsyncGeneratorSetState: I.setState,
  __lanesAsyncGeneratorEnqueue: I.enqueue, __lanesAsyncGeneratorFirst: I.first, __lanesAsyncGeneratorDequeue: I.dequeue,
  __lanesAsyncGeneratorSignal: I.signal,
  __asyncGeneratorRequest: I.request, __asyncGeneratorRun: I.run, __asyncGeneratorCompleteStep: I.completeStep,
  __asyncGeneratorDrainQueue: I.drainQueue, __asyncGeneratorAwaitReturn: I.awaitReturn,
  // %Promise% identity (worker 1 id 2800), private alias so no mutable global lookup.
  __lanesAsyncGeneratorPromise: 2800,
});
// Private names used by the helpers and registered by their owners.
export const asyncGeneratorDependencies = Object.freeze({
  __promiseNewCapability: { id: 2821, owner: 'worker 1' },
  __promiseResolve: { id: 2827, owner: 'worker 2' },
  __promisePerformThen: { id: 2830, owner: 'worker 3' },
  __lanesDescriptor: { id: 112, owner: 'existing core' },
});

// ---------------------------------------------------------------- WGSL --
const P = ASYNC_GENERATOR_PROTOCOL, SIG = ASYNC_GENERATOR_SIGNALS, K = ASYNC_GENERATOR_KINDS, N = ASYNC_GENERATOR_NODES;
const pack = (protocol, state, signal) => `${(protocol | (state << 8) | (signal << 16)) >>> 0}u`;

export const asyncGeneratorGCWGSL = `
    if(node.kind==2u&&node.value.z!=0u&&(node.value.z&0x80000000u)==0u&&states[l].heap[node.value.z].kind==${K.header}u){mark(l,node.value.z);}
    if(node.kind==${K.header}u){mark(l,node.value.y);mark(l,node.value.z);mark(l,node.key);}
    if(node.kind==${K.aux}u){markValue(l,node.value);mark(l,node.key);}
    if(node.kind==${K.request}u||node.kind==${K.saved}u){markValue(l,node.value);}
`;

export const asyncGeneratorWGSLFunctions = ({ F, L, OP }) => {
  for (const name of ['initial_yield', 'yield', 'await', 'async_yield_star'])
    if (!Number.isInteger(OP[name])) throw new Error(`Async generator integration requires opcode ${name}`);
  return `
const ASYNC_GENERATOR_PROTOTYPE:u32=${N.prototype}u;
const ASYNC_GENERATOR_FUNCTION_PROTOTYPE:u32=${N.functionPrototype}u;
const ASYNC_GENERATOR_ENV:u32=${ASYNC_GENERATOR_ENV}u;
const AG_START:u32=${P.start}u;
const AG_YIELD:u32=${P.yield}u;
const AG_YIELD_STAR:u32=${P.yieldStar}u;
const AG_AWAIT:u32=${P.await}u;
const AG_RUNNING:u32=${P.running}u;
const AG_DONE:u32=${P.done}u;
fn asyncGeneratorFunction(l:u32,fnValue:V)->bool {
  return fnValue.z==5u&&(image[states[l].heap[fnValue.x].value.x*2u].w&${ASYNC_GENERATOR_INFO_BITS}u)==${ASYNC_GENERATOR_INFO_BITS}u;
}
// Brand check: object node whose unflagged value.z is a kind-${K.header} header owned by it.
fn asyncGeneratorHeader(l:u32,value:V)->u32 {
  if(value.z!=4u||states[l].heap[value.x].kind!=2u){return 0u;}
  let id=states[l].heap[value.x].value.z;
  if(id==0u||(id&0x80000000u)!=0u){return 0u;}
  if(states[l].heap[id].kind!=${K.header}u||states[l].heap[id].key!=value.x){return 0u;}
  return id;
}
fn asyncGeneratorActive(l:u32,env:u32)->u32 {
  if(env==0u||states[l].heap[env].kind!=4u||states[l].heap[env].value.w!=ASYNC_GENERATOR_ENV){return 0u;}
  return asyncGeneratorHeader(l,V(states[l].heap[env].value.z,0u,4u,0u));
}
fn asyncGeneratorPack(protocol:u32,state:u32,signal:u32)->u32 {return protocol|(state<<8u)|(signal<<16u);}
fn asyncGeneratorProtocol(l:u32,id:u32)->u32 {return states[l].heap[id].value.w&0xffu;}
// Activation finished (body return or escaping throw): spec state becomes
// draining-queue (AsyncGeneratorStart step 4.i); links are dropped for GC.
fn asyncGeneratorComplete(l:u32,id:u32,signal:u32) {
  states[l].heap[id].value=V(0u,0u,0u,asyncGeneratorPack(AG_DONE,${S.drainingQueue}u,signal));
  let aux=states[l].heap[id].next;
  if(aux!=0u){states[l].heap[aux].value=undef();}
}
fn asyncGeneratorBeforeFinish(l:u32) {
  let id=asyncGeneratorActive(l,states[l].env);
  if(id==0u||asyncGeneratorProtocol(l,id)!=AG_RUNNING){return;}
  asyncGeneratorComplete(l,id,${SIG.return}u);
}
fn asyncGeneratorUnwind(l:u32,env:u32) {
  let id=asyncGeneratorActive(l,env);
  if(id!=0u&&asyncGeneratorProtocol(l,id)==AG_RUNNING){asyncGeneratorComplete(l,id,${SIG.throw}u);}
}
// Called once after call() created the activation environment and filled the
// arguments, before the first instruction (parameter defaults run before initial_yield).
fn asyncGeneratorEnter(l:u32,fnValue:V,env:u32,receiver:V) {
  var prototype=ASYNC_GENERATOR_PROTOTYPE;
  let requested=getProperty(l,fnValue,fieldKey(${F.prototype}u));
  if(states[l].status!=0u){return;}
  if(requested.z==12u){states[l].status=6u;return;}
  let view=objectView(l,requested);if(view.z==4u){prototype=view.x;}
  let aux=alloc(l,${K.aux}u,receiver,0u,0u);
  let object=alloc(l,2u,V(prototype,0u,0u,1u),0u,0u);
  let id=alloc(l,${K.header}u,V(0u,env,0u,asyncGeneratorPack(AG_RUNNING,${S.executing}u,${SIG.none}u)),object,aux);
  if(states[l].status!=0u){return;}
  states[l].heap[object].value.z=id;
  states[l].heap[env].value.z=object;states[l].heap[env].value.w=ASYNC_GENERATOR_ENV;
}
// Save this activation's operand segment and return the operand (or the
// generator object for initial_yield) to the resumer. Collection happens first
// while the operand and full stack are still rooted (generatorSuspend rule).
fn asyncGeneratorSuspend(l:u32,protocol:u32) {
  let id=asyncGeneratorActive(l,states[l].env);
  if(id==0u||asyncGeneratorProtocol(l,id)!=AG_RUNNING){states[l].status=2u;return;}
  let needed=states[l].sp-states[l].frames[states[l].depth].base+4u;
  if(states[l].freeCount<needed){collect(l);}
  var operand=undef();if(protocol!=AG_START){operand=pop(l);}
  if(states[l].status!=0u){return;}
  let base=states[l].frames[states[l].depth].base;
  var first=0u;var previous=0u;
  for(var index=base;index<states[l].sp;index++){
    let slot=alloc(l,${K.saved}u,states[l].stack[index],index-base,0u);
    if(states[l].status!=0u){return;}
    if(previous==0u){first=slot;}else{states[l].heap[previous].next=slot;}previous=slot;
  }
  let aux=states[l].heap[id].next;
  if(aux==0u||states[l].heap[aux].kind!=${K.aux}u){states[l].status=2u;return;}
  states[l].heap[aux].value=states[l].frames[states[l].depth].receiver;
  var suspendedState=${S.executing}u;var signal=${SIG.yield}u;var result=operand;
  if(protocol==AG_START){suspendedState=${S.suspendedStart}u;signal=${SIG.none}u;result=V(states[l].heap[id].key,0u,4u,0u);}
  if(protocol==AG_AWAIT){signal=${SIG.await}u;}
  states[l].heap[id].value=V(states[l].pc,states[l].env,first,asyncGeneratorPack(protocol,suspendedState,signal));
  finish(l,result);
}
// Pre-dispatch intercept for kind-3 activations (runs instead of the switch).
fn asyncGeneratorOpcode(l:u32,op:u32)->bool {
  if(op!=${OP.initial_yield}u&&op!=${OP.yield}u&&op!=${OP.await}u&&op!=${OP.async_yield_star}u){return false;}
  return asyncGeneratorActive(l,states[l].env)!=0u;
}
fn asyncGeneratorStep(l:u32,op:u32) {
  if(op==${OP.initial_yield}u){asyncGeneratorSuspend(l,AG_START);}
  else if(op==${OP.yield}u){asyncGeneratorSuspend(l,AG_YIELD);}
  else if(op==${OP.async_yield_star}u){asyncGeneratorSuspend(l,AG_YIELD_STAR);}
  else{asyncGeneratorSuspend(l,AG_AWAIT);}
}
// Private intrinsic ${I.resume}: resume(generator, mode 0 normal/1 return/2 throw, value).
// Trusted helpers guarantee the spec preconditions; violations are status 2.
// Installs a frame above the caller exactly like generatorResume.
fn asyncGeneratorResume(l:u32,generator:V,modeValue:V,argument:V,base:u32,tail:bool) {
  let id=asyncGeneratorHeader(l,generator);
  if(id==0u||modeValue.z!=0u){states[l].status=2u;return;}
  let mode=toBits(modeValue.xy);
  let saved=states[l].heap[id].value;let protocol=saved.w&0xffu;
  if(protocol>AG_AWAIT||mode>2u||(protocol==AG_START&&mode!=0u)||(protocol==AG_AWAIT&&mode==1u)){states[l].status=2u;return;}
  if(states[l].depth+1u>=${L.frames}u){states[l].status=3u;return;}
  var count=0u;var cursor=saved.z;
  for(var i=0u;i<${L.stack}u&&cursor!=0u;i++){
    if(states[l].heap[cursor].kind!=${K.saved}u){states[l].status=2u;return;}
    count++;cursor=states[l].heap[cursor].next;
  }
  if(cursor!=0u||base+count+2u>${L.stack}u){states[l].status=3u;return;}
  let aux=states[l].heap[id].next;
  if(aux==0u||states[l].heap[aux].kind!=${K.aux}u){states[l].status=2u;return;}
  states[l].depth++;
  states[l].frames[states[l].depth]=Frame(states[l].pc,saved.y,base,select(0u,1u,tail),states[l].heap[aux].value);
  states[l].sp=base;states[l].env=saved.y;states[l].pc=saved.x;
  cursor=saved.z;
  for(var i=0u;i<count;i++){
    push(l,states[l].heap[cursor].value);cursor=states[l].heap[cursor].next;
  }
  states[l].heap[id].value=V(0u,saved.y,0u,asyncGeneratorPack(AG_RUNNING,${S.executing}u,${SIG.none}u));
  if(protocol==AG_YIELD){
    if(mode==2u){raise(l,argument);}else{push(l,argument);push(l,num(fromUnsigned(mode)));}
  }else if(protocol==AG_YIELD_STAR){push(l,argument);push(l,num(fromUnsigned(mode)));}
  else if(protocol==AG_AWAIT){
    if(mode==2u){raise(l,argument);}else{push(l,argument);}
  }
}
fn asyncGeneratorAux(l:u32,generator:V)->u32 {
  let id=asyncGeneratorHeader(l,generator);
  if(id==0u){states[l].status=2u;return 0u;}
  let aux=states[l].heap[id].next;
  if(aux==0u||states[l].heap[aux].kind!=${K.aux}u){states[l].status=2u;return 0u;}
  return aux;
}
fn asyncGeneratorStateValue(l:u32,value:V)->V {
  let id=asyncGeneratorHeader(l,value);
  if(id==0u){return V(0u,0xbff00000u,0u,0u);}
  return num(fromUnsigned((states[l].heap[id].value.w>>8u)&0xffu));
}
fn asyncGeneratorSetState(l:u32,generator:V,stateValue:V) {
  let id=asyncGeneratorHeader(l,generator);
  if(id==0u||stateValue.z!=0u){states[l].status=2u;return;}
  let state=toBits(stateValue.xy);
  if(state>${S.completed}u){states[l].status=2u;return;}
  let packed=states[l].heap[id].value.w;
  var currentProtocol=packed&0xffu;
  // Leaving suspended-start without running the body discards the activation.
  if(state==${S.completed}u||state==${S.drainingQueue}u){
    if(currentProtocol==AG_START){states[l].heap[id].value=V(0u,0u,0u,0u);currentProtocol=AG_DONE;let aux=states[l].heap[id].next;if(aux!=0u){states[l].heap[aux].value=undef();}}
  }
  states[l].heap[id].value.w=(packed&0xffff0000u)|(state<<8u)|currentProtocol;
}
fn asyncGeneratorEnqueue(l:u32,generator:V,request:V) {
  let aux=asyncGeneratorAux(l,generator);if(aux==0u){return;}
  let requestCell=alloc(l,${K.request}u,request,0u,0u);
  if(states[l].status!=0u){return;}
  let tail=states[l].heap[aux].next;
  if(tail==0u){states[l].heap[aux].key=requestCell;}else{states[l].heap[tail].next=requestCell;}
  states[l].heap[aux].next=requestCell;
}
fn asyncGeneratorFirst(l:u32,generator:V,remove:bool)->V {
  let aux=asyncGeneratorAux(l,generator);if(aux==0u){return undef();}
  let head=states[l].heap[aux].key;
  if(head==0u){return undef();}
  let request=states[l].heap[head].value;
  if(remove){
    let following=states[l].heap[head].next;
    states[l].heap[aux].key=following;
    if(following==0u){states[l].heap[aux].next=0u;}
    states[l].heap[head].next=0u;
  }
  return request;
}
fn asyncGeneratorSignal(l:u32,generator:V)->V {
  let id=asyncGeneratorHeader(l,generator);
  if(id==0u){states[l].status=2u;return undef();}
  return num(fromUnsigned((states[l].heap[id].value.w>>16u)&0xffu));
}
`;
};

// objectMethod() arms (inside objectMethod: id, original=a, b, c in scope).
export const asyncGeneratorObjectMethodWGSL = `
  if(id==${I.state}u){return asyncGeneratorStateValue(l,original);}
  if(id==${I.setState}u){asyncGeneratorSetState(l,original,b);return undef();}
  if(id==${I.enqueue}u){asyncGeneratorEnqueue(l,original,b);return undef();}
  if(id==${I.first}u){return asyncGeneratorFirst(l,original,false);}
  if(id==${I.dequeue}u){return asyncGeneratorFirst(l,original,true);}
  if(id==${I.signal}u){return asyncGeneratorSignal(l,original);}
`;

// call() hook for the frame-installing resume intrinsic.
export const asyncGeneratorCallWGSL = `  if(fnValue.z==11u&&fnValue.x==${I.resume}u){
    var asyncGeneratorTarget=undef();var asyncGeneratorMode=undef();var asyncGeneratorArgument=undef();
    if(argc>0u){asyncGeneratorTarget=states[l].stack[base+extra];}
    if(argc>1u){asyncGeneratorMode=states[l].stack[base+extra+1u];}
    if(argc>2u){asyncGeneratorArgument=states[l].stack[base+extra+2u];}
    asyncGeneratorResume(l,asyncGeneratorTarget,asyncGeneratorMode,asyncGeneratorArgument,base,tail);return;
  }
`;

// closure() hook, after generatorClosureWGSL (which, seeing bit 18, already set
// GeneratorFunction.prototype and a fresh `prototype` object). Kind 3 retargets
// both: [[Prototype]] %AsyncGeneratorFunction.prototype% and a fresh
// prototype object inheriting from %AsyncGeneratorPrototype% (no constructor).
export const asyncGeneratorClosureWGSL = ({ F }) => `
  if((fnInfo.w&${ASYNC_GENERATOR_INFO_BITS}u)==${ASYNC_GENERATOR_INFO_BITS}u&&states[l].status==0u){
    states[l].heap[backing].value.x=ASYNC_GENERATOR_FUNCTION_PROTOTYPE;
    let asyncPrototypeProperty=states[l].heap[backing].next;
    if(asyncPrototypeProperty==0u||states[l].heap[asyncPrototypeProperty].kind!=3u||states[l].heap[asyncPrototypeProperty].key!=fieldKey(${F.prototype}u)){states[l].status=2u;}
    else{states[l].heap[states[l].heap[asyncPrototypeProperty].value.x].value.x=ASYNC_GENERATOR_PROTOTYPE;}
  }
`;

export const asyncGeneratorInitWGSL = ({ F, toStringTagNode = SYMBOL_NODES.toStringTag }) => `
  states[l].heap[${N.functionPrototype}u]=Node(V(3u,0u,0u,1u),0u,0u,2u,0u);
  states[l].heap[${N.prototype}u]=Node(V(${N.asyncIteratorPrototype}u,0u,0u,1u),0u,0u,2u,0u);
  dataProperty(l,${N.functionPrototype}u,fieldKey(${F.prototype}u),V(${N.prototype}u,0u,4u,0u),4u);
  dataProperty(l,${N.functionPrototype}u,fieldKey(${F.constructor}u),V(${I.functionIdentity}u,0u,11u,0u),4u);
  dataProperty(l,${N.prototype}u,fieldKey(${F.constructor}u),V(${N.functionPrototype}u,0u,4u,0u),4u);
  dataProperty(l,${N.functionPrototype}u,0x60000000u|${toStringTagNode}u,image[fieldKey(${F.AsyncGeneratorFunction}u)],4u);
  dataProperty(l,${N.prototype}u,0x60000000u|${toStringTagNode}u,image[fieldKey(${F.AsyncGenerator}u)],4u);
  ${asyncGeneratorMetadata.slice(0, 3).map(m => `dataProperty(l,${N.prototype}u,fieldKey(${F[m.name]}u),V(${m.id}u,0u,11u,0u),5u);`).join('\n  ')}
`;

// getProperty() arms for the tag-11 builtin values.
export const asyncGeneratorPropertyWGSL = ({ F }) => asyncGeneratorMetadata.map(m =>
  `if(obj.z==11u&&obj.x==${m.id}u){if(field(l,key,${F.name}u)){return image[fieldKey(${F[m.name]}u)];}if(lengthKey(l,key)){return num(fromUnsigned(${m.length}u));}${m.id === I.functionIdentity ? `if(field(l,key,${F.prototype}u)){return V(${N.functionPrototype}u,0u,4u,0u);}` : ''}states[l].status=6u;return undef();}`).join('\n  ');

// ----------------------------------------------------------- integration --
// Anchors are exact unique substrings of the files produced by
// generatorIntegrationPatch(live, {iteratorPrototypeNode:77}). 'before' and
// 'after' insertions are order-independent with other workers' insertions at
// the same anchors; the single 'replace' is the generator enter line, which
// only async generators (bits 18|19) must divert.
export const asyncGeneratorIntegrationEdits = Object.freeze([
  // program.js
  { file: 'program.js', anchor: "import {generatorFields,GENERATOR_KIND_BIT} from './generator-source.js';\n", position: 'after',
    text: "import {asyncGeneratorFields,ASYNC_GENERATOR_INFO_BITS} from './async-generator-source.js';\n", why: 'FIELDS names and kind-3 function-info bits' },
  { file: 'program.js', anchor: 'export const FIELDS =', position: 'before',
    text: 'for(const name of asyncGeneratorFields)if(!fieldNames.includes(name))fieldNames.push(name);\n', why: 'append-only FIELDS: toStringTag texts and helper slots' },
  { file: 'program.js', anchor: 'fn.kind !== 1))', position: 'before',
    text: 'fn.kind !== 3 && ', why: 'admit QuickJS kind 3 (async generator)' },
  { file: 'program.js', anchor: '(fn.kind === 1 ? GENERATOR_KIND_BIT : 0) |', position: 'after',
    text: ' (fn.kind === 3 ? ASYNC_GENERATOR_INFO_BITS : 0) |', why: 'kind 3 packs bits 18|19' },
  // bootstrap.js
  { file: 'bootstrap.js', anchor: "import {generatorDelegationSources} from './generator-delegation-source.js';\n", position: 'after',
    text: "import {asyncGeneratorSources,asyncGeneratorPrivateBuiltins} from './async-generator-source.js';\n", why: 'guest helper sources' },
  { file: 'bootstrap.js', anchor: '  ...generatorDelegationSources,', position: 'after',
    text: '\n  ...asyncGeneratorSources,', why: 'bootstrapSources entries' },
  { file: 'bootstrap.js', anchor: '  ...phase3BigintConversionIntrinsics,', position: 'before',
    text: '  ...asyncGeneratorPrivateBuiltins,\n', why: 'private names for 2884..2895 and %Promise% alias' },
  // phase4-registry.js
  { file: 'phase4-registry.js', anchor: "import {generatorOpcodes,generatorWGSLFunctions,generatorWGSLCases} from './generator-source.js';\n", position: 'after',
    text: "import {asyncGeneratorOpcodes,asyncGeneratorWGSLFunctions,asyncGeneratorBuiltinFields} from './async-generator-source.js';\n", why: 'registry imports' },
  { file: 'phase4-registry.js', anchor: '...generatorOpcodes,...generatorDelegationOpcodes', position: 'after',
    text: ',...asyncGeneratorOpcodes', why: 'append async_yield_star to OP' },
  { file: 'phase4-registry.js', anchor: '  if(generatorOpcodes.includes(op))return {op,a:0,b:0};', position: 'after',
    text: '\n  if(asyncGeneratorOpcodes.includes(op))return {op,a:0,b:0};', why: 'lower async_yield_star before phase4-iteration rejects it' },
  { file: 'phase4-registry.js', anchor: 'export const phase4WGSLFunctions = context => generatorWGSLFunctions(context) + ', position: 'after',
    text: 'asyncGeneratorWGSLFunctions(context) + ', why: 'WGSL functions' },
  { file: 'phase4-registry.js', anchor: '...generatorDelegationBuiltinFields', position: 'after',
    text: ',...asyncGeneratorBuiltinFields', why: 'call() id -> helper slot dispatch for 2880..2882 and 2891..2895' },
  // shader.js
  { file: 'shader.js', anchor: "import {generatorGCWGSL,generatorClosureWGSL,generatorInitWGSL,generatorMetadata} from './generator-source.js';\n", position: 'after',
    text: "import {asyncGeneratorGCWGSL,asyncGeneratorClosureWGSL,asyncGeneratorInitWGSL,asyncGeneratorObjectMethodWGSL,asyncGeneratorCallWGSL,asyncGeneratorPropertyWGSL} from './async-generator-source.js';\n", why: 'shader imports' },
  { file: 'shader.js', anchor: '    ${generatorGCWGSL}', position: 'after',
    text: '\n    ${asyncGeneratorGCWGSL}', why: 'GC: object->header, header->env/saved/object, aux->receiver/queue, request/saved values' },
  { file: 'shader.js', anchor: '  ${generatorClosureWGSL({F})}', position: 'after',
    text: '\n  ${asyncGeneratorClosureWGSL({F})}', why: 'kind-3 function [[Prototype]] and fresh prototype object' },
  { file: 'shader.js', anchor: '  let result=generatorBeforeFinish(l,completionValue);if(states[l].status!=0u){return;}', position: 'after',
    text: '\n  asyncGeneratorBeforeFinish(l);', why: 'body return completes the activation (signal return)' },
  { file: 'shader.js', anchor: 'generatorUnwind(l,states[l].frames[depth].env);depth--;', position: 'before',
    text: 'asyncGeneratorUnwind(l,states[l].frames[depth].env);', why: 'escaping exception completes the activation (signal throw); helper catch receives it' },
  { file: 'shader.js', anchor: '  if(fnValue.z==11u&&fnValue.x>=2500u&&fnValue.x<=2502u){', position: 'before',
    text: '${asyncGeneratorCallWGSL}', why: 'frame-installing resume intrinsic 2884' },
  { file: 'shader.js', anchor: 'if(generatorFunction(l,fnValue)){generatorEnter(', position: 'replace',
    text: 'if(asyncGeneratorFunction(l,fnValue)){asyncGeneratorEnter(l,fnValue,env,receiver);if(states[l].status!=0u){return;}}\n  else if(generatorFunction(l,fnValue)){generatorEnter(', why: 'kind 3 also has bit 18: divert from generatorEnter' },
  { file: 'shader.js', anchor: '  if(callee.z==11u&&callee.x==2503u){states[l].status=6u;return;}', position: 'before',
    text: '  if(callee.z==11u&&callee.x==2883u){states[l].status=6u;return;}\n', why: 'AsyncGeneratorFunction dynamic construction unsupported' },
  { file: 'shader.js', anchor: '    if(globalMode()){globalInit(l);}', position: 'before',
    text: '    ${asyncGeneratorInitWGSL({F})}\n', why: 'fixed nodes 94/95' },
  { file: 'shader.js', anchor: '  if(obj.z==11u&&obj.x==2000u){', position: 'before',
    text: '  ${asyncGeneratorPropertyWGSL({F})}\n', why: 'name/length of 2880..2883, AsyncGeneratorFunction.prototype' },
  { file: 'shader.js', anchor: "  ${phase4ObjectMethods(phase4Context).join('\\n  ')}", position: 'after',
    text: '\n  ${asyncGeneratorObjectMethodWGSL}', why: 'queue/state/signal intrinsics 2885..2890' },
  { file: 'shader.js', anchor: '    if(states[l].status==0u){switch op {', position: 'before',
    text: '    if(states[l].status==0u&&asyncGeneratorOpcode(l,op)){asyncGeneratorStep(l,op);}else\n', why: 'kind-3 initial_yield/yield/await/async_yield_star intercept before the opcode switch' },
]);

export function applyIntegrationEdits(files, edits) {
  const out = { ...files };
  for (const edit of edits) {
    const s = out[edit.file];
    if (typeof s !== 'string') throw new Error(`Missing file ${edit.file}`);
    const parts = s.split(edit.anchor);
    if (parts.length !== 2) throw new Error(`Async generator anchor ${parts.length - 1} matches: ${edit.file}: ${edit.anchor.slice(0, 90)}`);
    const replacement = edit.position === 'before' ? edit.text + edit.anchor : edit.position === 'after' ? edit.anchor + edit.text : edit.position === 'replace' ? edit.text : null;
    if (replacement === null) throw new Error(`Bad edit position ${edit.position}`);
    out[edit.file] = parts[0] + replacement + parts[1];
  }
  return out;
}

export const asyncGeneratorGaps = Object.freeze([
  'GPU shader compilation and execution have not run (no GPU allowed for this worker); evidence is host-only.',
  'Depends on worker 1 (2821, %Promise% 2800), worker 2 (2827), worker 3 (2830), worker 5 (`await` opcode in OP), worker 7 (`for_await_of_start`, node 96 %AsyncIteratorPrototype%, job queue draining) and parent FIXED_RESERVED_LAST >= 95.',
  'AsyncGeneratorFunction (2883) dynamic construction/call is explicitly unsupported (status 6).',
  'Async generator class/object methods: class elements still reject async methods (phase4-class-elements.js); object-literal async generator methods pack but are untested here.',
  'Internal resume closures are guest arrow functions (not spec built-in function objects); they are never exposed to user code.',
  'Continuations 144..151 are unused.',
]);
