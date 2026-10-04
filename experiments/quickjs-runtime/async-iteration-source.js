// Promise + async wave, worker 7 part B: async iteration.
//   %AsyncIteratorPrototype% (fixed node 96), %AsyncFromSyncIteratorPrototype%
//   (fixed node 97, ES2025 27.1.6), GetIterator(obj, async) with the
//   CreateAsyncFromSyncIterator fallback, the for-await opcodes and async
//   IteratorClose (AsyncIteratorClose, ES2025 7.4.13) for break / return /
//   throw out of a for-await loop.
//
// QuickJS lowering (vendor/quickjs.c 29109-29133, 19156-19194), async function:
//   e; for_await_of_start; goto N; B: <store>; body; N: for_await_of_next;
//   await; G: iterator_get_value_done; if_false B; drop; C: iterator_close
//   break -> C (shared with exhaustion); return -> nip_catch; rot3r;
//   undefined; iterator_close; return_async. Async generators close inline on
//   return (get_field2 return / call_method / iterator_check_object / await).
//   yield* in async generators: for_await_of_start; drop; iterator_next ...
//   (worker 6, reusing the synchronous delegation opcodes, which read a
//   {iterator, next} record at the record slot).
// QuickJS itself calls return() on normal exhaustion (iterator_close after
// done) and never awaits it (JS_IteratorClose); both deviate from ES2025 and
// are NOT reproduced: exhaustion clears the record slot, break/return/throw
// await the return() result.
//
// Stack layout of a for-await loop (async function / async generator frame):
//   [iterator, nextMethod, marker]
//   marker: V(0,5,9,0) after start; undefined while next()/await/value-done
//   run (exceptions there must not close: ES2025 ForIn/OfBodyEvaluation);
//   V(N,0,9,0) while the body runs. That is an ordinary catch offset whose
//   target N is this loop's for_await_of_next: raise() delivers a body throw
//   to N with [iterator, nextMethod, error], and N runs AsyncIteratorClose
//   with a throw completion. nip_catch (return) stops at it like at any
//   QuickJS catch offset. yield* keeps a {iterator,next} record instead.
// Transient tags (tag 9, never guest-visible, skipped by raise/GC):
//   T1 V(0,6,9,0) / T2 V(0,7,9,0): throw-close in progress at N;
//   R1 V(0,8,9,0) / R2 V(0,9,9,0): normal close in progress at C.
// Each closing state re-executes its own opcode (pc of N or C) after a guest
// helper returns (continuation 152) or after the activation resumes from
// `await` (worker 5 asyncAwait / worker 6 asyncGeneratorStep at that pc).
import { PROMISE_NODES, PROMISE_CONTINUATIONS, ASYNC_ID_RANGES, PROMISE_IDS, PROMISE_KINDS } from './promise-ids.js';
import { phase3WellKnownNames } from './phase3-values.js';
import { applyEdits } from './promise-jobs-source.js';

export const ASYNC_ITERATOR_PROTO_NODE = PROMISE_NODES.asyncIteratorProto;            // 96
export const ASYNC_FROM_SYNC_PROTO_NODE = PROMISE_NODES.asyncFromSyncIteratorProto;   // 97
// Well-known symbol cells are 31 + index (phase3-values.js): asyncIterator = 31.
export const ASYNC_ITERATOR_SYMBOL_NODE = 31 + phase3WellKnownNames.indexOf('asyncIterator');
export const ITERATOR_SYMBOL_NODE = 31 + phase3WellKnownNames.indexOf('iterator');
if (ASYNC_ITERATOR_SYMBOL_NODE !== 31 || ITERATOR_SYMBOL_NODE !== 34) throw new Error('well-known symbol cell drift');
// [[SyncIteratorRecord]] brand cell: heap kind 67 (worker-7 payload kind),
// value = sync record (guest {iterator,next,done}), key = owning object node.
export const BRAND_KIND = PROMISE_KINDS.jobPayload;

export const ASYNC_ITERATION_IDS = Object.freeze({
  asyncIteratorMethod: 2912,   // %AsyncIteratorPrototype%[@@asyncIterator] (WGSL: returns this)
  fromSyncNext: 2913,          // %AsyncFromSyncIteratorPrototype%.next   (guest)
  fromSyncReturn: 2914,        //   .return (guest)
  fromSyncThrow: 2915,         //   .throw  (guest)
  open: 2916,                  // __asyncIteratorOpen(value) -> {iterator, next}      (guest)
  valueDone: 2917,             // __asyncIteratorValueDone(result) -> value | DONE    (guest)
  close: 2918,                 // __asyncIteratorClose(iterator) -> inner | NO_AWAIT  (guest)
  closeThrow: 2919,            // __asyncIteratorCloseThrow(iterator) -> inner | NO_AWAIT, never throws (guest)
  fromSyncContinuation: 2920,  // __asyncFromSyncContinuation(result, capability, syncRecord, closeOnRejection) (guest)
  fromSyncCreate: 2921,        // __lanesAsyncFromSyncCreate(syncRecord) (WGSL)
  fromSyncRecord: 2922,        // __lanesAsyncFromSyncRecord(object) -> syncRecord | undefined (WGSL)
  done: 2923,                  // sentinel value: iterator result done (never callable)
  noAwait: 2924,               // sentinel value: no return method => nothing to await
  // 2925..2939 spare.
});
for (const id of Object.values(ASYNC_ITERATION_IDS)) if (id < ASYNC_ID_RANGES.worker7[0] || id > ASYNC_ID_RANGES.worker7[1]) throw new Error(`async-iteration id ${id} outside worker-7 range`);
export const ASYNC_ITERATION_CONTINUATIONS = Object.freeze({ reexecute: 152, valueDone: 153, open: 154 }); // 155..159 spare
for (const c of Object.values(ASYNC_ITERATION_CONTINUATIONS)) if (c < PROMISE_CONTINUATIONS.asyncIterationFirst || c > PROMISE_CONTINUATIONS.asyncIterationLast) throw new Error('continuation drift');
export const asyncIterationOpcodes = Object.freeze(['for_await_of_start', 'for_await_of_next', 'iterator_get_value_done']);
const I = ASYNC_ITERATION_IDS, C = ASYNC_ITERATION_CONTINUATIONS;
const TAG = Object.freeze({ start: 5, t1: 6, t2: 7, r1: 8, r2: 9 });

// ---- guest helpers (strict intrinsic roots) --------------------------------------
const isObject = v => `(${v} !== null && (typeof ${v} === "object" || typeof ${v} === "function"))`;
// GetIterator(obj, async) (7.4.3) + GetIteratorFromMethod (7.4.2) + CreateAsyncFromSyncIterator (27.1.6.1).
const openSource = `function asyncIteratorOpenBootstrap(value) {
  "use strict";
  if (value === null || value === undefined) throw new TypeError("Value is not async iterable");
  const method = value[Symbol.asyncIterator];
  let iterator;
  if (method === undefined || method === null) {
    const syncMethod = value[Symbol.iterator];
    if (syncMethod === undefined || syncMethod === null) throw new TypeError("Value is not async iterable");
    if (typeof syncMethod !== "function") throw new TypeError("Symbol.iterator is not a function");
    const syncIterator = __lanesCall(syncMethod, value);
    if (!${isObject('syncIterator')}) throw new TypeError("Iterator is not an object");
    const syncRecord = __lanesDescriptor();
    syncRecord.iterator = syncIterator;
    syncRecord.next = syncIterator.next;
    syncRecord.done = false;
    iterator = __lanesAsyncFromSyncCreate(syncRecord);
  } else {
    if (typeof method !== "function") throw new TypeError("Symbol.asyncIterator is not a function");
    iterator = __lanesCall(method, value);
    if (!${isObject('iterator')}) throw new TypeError("Async iterator is not an object");
  }
  const record = __lanesDescriptor();
  record.iterator = iterator;
  record.next = iterator.next;
  return record;
}`;
// ForIn/OfBodyEvaluation step 6.c-f: result must be an Object; done is read
// first; value only when not done (QuickJS reads both: not reproduced).
const valueDoneSource = `function asyncIteratorValueDoneBootstrap(result) {
  "use strict";
  if (!${isObject('result')}) throw new TypeError("Iterator result is not an object");
  if (result.done) return __asyncIteratorDone;
  return result.value;
}`;
// AsyncIteratorClose, normal completion (break / return): GetMethod(return)
// abrupt or non-callable throws; the call's result is awaited by WGSL, then
// checked for Object.
const closeSource = `function asyncIteratorCloseBootstrap(iterator) {
  "use strict";
  const method = iterator.return;
  if (method === undefined || method === null) return __asyncIteratorNoAwait;
  if (typeof method !== "function") throw new TypeError("Iterator return is not a function");
  return __lanesCall(method, iterator);
}`;
// AsyncIteratorClose, throw completion: every abrupt step is ignored (the
// original error wins); the call's result is still awaited (WGSL).
const closeThrowSource = `function asyncIteratorCloseThrowBootstrap(iterator) {
  "use strict";
  try {
    const method = iterator.return;
    if (method === undefined || method === null) return __asyncIteratorNoAwait;
    if (typeof method !== "function") return __asyncIteratorNoAwait;
    return __lanesCall(method, iterator);
  } catch (error) {
    return __asyncIteratorNoAwait;
  }
}`;
// %AsyncFromSyncIteratorPrototype%.next (27.1.6.2.1).
const fromSyncNextSource = `function asyncFromSyncNextBootstrap(value) {
  "use strict";
  const syncRecord = __lanesAsyncFromSyncRecord(this);
  if (syncRecord === undefined) throw new TypeError("not an Async-from-Sync Iterator");
  const capability = __promiseNewCapability(__asyncIterationPromise);
  let result;
  try {
    if (arguments.length > 0) result = __lanesCall(syncRecord.next, syncRecord.iterator, value);
    else result = __lanesCall(syncRecord.next, syncRecord.iterator);
    if (!${isObject('result')}) throw new TypeError("Iterator result is not an object");
  } catch (error) {
    syncRecord.done = true;
    __lanesCall(capability.reject, undefined, error);
    return capability.promise;
  }
  return __asyncFromSyncContinuation(result, capability, syncRecord, true);
}`;
// %AsyncFromSyncIteratorPrototype%.return (27.1.6.2.2).
const fromSyncReturnSource = `function asyncFromSyncReturnBootstrap(value) {
  "use strict";
  const syncRecord = __lanesAsyncFromSyncRecord(this);
  if (syncRecord === undefined) throw new TypeError("not an Async-from-Sync Iterator");
  const capability = __promiseNewCapability(__asyncIterationPromise);
  const syncIterator = syncRecord.iterator;
  let method;
  let result;
  try {
    method = syncIterator.return;
    if (method !== undefined && method !== null) {
      if (typeof method !== "function") throw new TypeError("Iterator return is not a function");
      if (arguments.length > 0) result = __lanesCall(method, syncIterator, value);
      else result = __lanesCall(method, syncIterator);
    }
  } catch (error) {
    __lanesCall(capability.reject, undefined, error);
    return capability.promise;
  }
  if (method === undefined || method === null) {
    __lanesCall(capability.resolve, undefined, { value: value, done: true });
    return capability.promise;
  }
  if (!${isObject('result')}) {
    __lanesCall(capability.reject, undefined, new TypeError("Iterator result is not an object"));
    return capability.promise;
  }
  return __asyncFromSyncContinuation(result, capability, syncRecord, false);
}`;
// %AsyncFromSyncIteratorPrototype%.throw (27.1.6.2.3), incl. step 7: missing
// throw => IteratorClose(syncIteratorRecord, normal) then reject TypeError.
const fromSyncThrowSource = `function asyncFromSyncThrowBootstrap(value) {
  "use strict";
  const syncRecord = __lanesAsyncFromSyncRecord(this);
  if (syncRecord === undefined) throw new TypeError("not an Async-from-Sync Iterator");
  const capability = __promiseNewCapability(__asyncIterationPromise);
  const syncIterator = syncRecord.iterator;
  let method;
  try {
    method = syncIterator.throw;
    if (method !== undefined && method !== null && typeof method !== "function") throw new TypeError("Iterator throw is not a function");
  } catch (error) {
    __lanesCall(capability.reject, undefined, error);
    return capability.promise;
  }
  if (method === undefined || method === null) {
    syncRecord.done = true;
    try {
      const closer = syncIterator.return;
      if (closer !== undefined && closer !== null) {
        if (typeof closer !== "function") throw new TypeError("Iterator return is not a function");
        const inner = __lanesCall(closer, syncIterator);
        if (!${isObject('inner')}) throw new TypeError("Iterator result is not an object");
      }
    } catch (error) {
      __lanesCall(capability.reject, undefined, error);
      return capability.promise;
    }
    __lanesCall(capability.reject, undefined, new TypeError("The iterator does not provide a 'throw' method"));
    return capability.promise;
  }
  let result;
  try {
    if (arguments.length > 0) result = __lanesCall(method, syncIterator, value);
    else result = __lanesCall(method, syncIterator);
  } catch (error) {
    syncRecord.done = true;
    __lanesCall(capability.reject, undefined, error);
    return capability.promise;
  }
  if (!${isObject('result')}) {
    __lanesCall(capability.reject, undefined, new TypeError("Iterator result is not an object"));
    return capability.promise;
  }
  return __asyncFromSyncContinuation(result, capability, syncRecord, true);
}`;
// AsyncFromSyncIteratorContinuation (27.1.6.4). onFulfilled/onRejected are
// anonymous arrows (CreateBuiltinFunction(..., 1, "")) that capture root
// locals only (private names are not visible in nested functions).
const fromSyncContinuationSource = `function asyncFromSyncContinuationBootstrap(result, capability, syncRecord, closeOnRejection) {
  "use strict";
  const call = __lanesCall;
  let done;
  let value;
  let valueWrapper;
  try {
    done = result.done ? true : false;
  } catch (error) {
    syncRecord.done = true;
    call(capability.reject, undefined, error);
    return capability.promise;
  }
  if (done) syncRecord.done = true;
  try {
    value = result.value;
  } catch (error) {
    syncRecord.done = true;
    call(capability.reject, undefined, error);
    return capability.promise;
  }
  const syncIterator = syncRecord.iterator;
  try {
    valueWrapper = __promiseResolve(__asyncIterationPromise, value);
  } catch (error) {
    if (!done && closeOnRejection) {
      try {
        const closer = syncIterator.return;
        if (closer !== undefined && closer !== null) call(closer, syncIterator);
      } catch (ignored) {}
    }
    call(capability.reject, undefined, error);
    return capability.promise;
  }
  __promisePerformThen(valueWrapper, (v) => ({ value: v, done: done }), (!done && closeOnRejection) ? (error) => {
    try {
      const closer = syncIterator.return;
      if (closer !== undefined && closer !== null) call(closer, syncIterator);
    } catch (ignored) {}
    throw error;
  } : undefined, capability);
  return capability.promise;
}`;

// FIELDS slot names (never public property names).
export const asyncIterationSources = Object.freeze({
  asyncIteratorOpenHelper: openSource,
  asyncIteratorValueDoneHelper: valueDoneSource,
  asyncIteratorCloseHelper: closeSource,
  asyncIteratorCloseThrowHelper: closeThrowSource,
  asyncFromSyncNextHelper: fromSyncNextSource,
  asyncFromSyncReturnHelper: fromSyncReturnSource,
  asyncFromSyncThrowHelper: fromSyncThrowSource,
  asyncFromSyncContinuationHelper: fromSyncContinuationSource,
});
export const asyncIterationBuiltinFields = Object.freeze({
  [I.fromSyncNext]: 'asyncFromSyncNextHelper', [I.fromSyncReturn]: 'asyncFromSyncReturnHelper', [I.fromSyncThrow]: 'asyncFromSyncThrowHelper',
  [I.open]: 'asyncIteratorOpenHelper', [I.valueDone]: 'asyncIteratorValueDoneHelper', [I.close]: 'asyncIteratorCloseHelper',
  [I.closeThrow]: 'asyncIteratorCloseThrowHelper', [I.fromSyncContinuation]: 'asyncFromSyncContinuationHelper',
});
// '[Symbol.asyncIterator]' is the function-name text of 2912.
export const asyncIterationFields = Object.freeze([...Object.keys(asyncIterationSources), '[Symbol.asyncIterator]']);
export const asyncIterationPrivateBuiltins = Object.freeze({
  __asyncIteratorOpen: I.open, __asyncIteratorValueDone: I.valueDone, __asyncIteratorClose: I.close, __asyncIteratorCloseThrow: I.closeThrow,
  __asyncFromSyncContinuation: I.fromSyncContinuation, __lanesAsyncFromSyncCreate: I.fromSyncCreate, __lanesAsyncFromSyncRecord: I.fromSyncRecord,
  __asyncIteratorDone: I.done, __asyncIteratorNoAwait: I.noAwait, __asyncIterationPromise: PROMISE_IDS.ctor,
});
export const asyncIterationDependencies = Object.freeze({
  __promiseNewCapability: { id: 2821, owner: 'worker 1' },
  __promiseResolve: { id: 2827, owner: 'worker 2' },
  __promisePerformThen: { id: 2830, owner: 'worker 3' },
  __lanesCall: { id: 113, owner: 'existing' }, __lanesDescriptor: { id: 112, owner: 'existing' },
});
export const asyncIterationWGSLDependencies = Object.freeze({
  asyncActive: 'worker 5: fn asyncActive(l:u32,env:u32)->u32 (executing async-function activation)',
  asyncAwait: 'worker 5: fn asyncAwait(l:u32) (await opcode: awaits the stack top, resumes at states[l].pc pushing the value or throwing there)',
  asyncGeneratorActive: 'worker 6: fn asyncGeneratorActive(l:u32,env:u32)->u32',
  asyncGeneratorStep: 'worker 6: fn asyncGeneratorStep(l:u32,op:u32) (op = OP.await: same contract as asyncAwait)',
});
export const asyncIterationMetadata = Object.freeze([
  { id: I.asyncIteratorMethod, name: '[Symbol.asyncIterator]', field: '[Symbol.asyncIterator]', length: 0 },
  { id: I.fromSyncNext, name: 'next', field: 'next', length: 1 },
  { id: I.fromSyncReturn, name: 'return', field: 'return', length: 1 },
  { id: I.fromSyncThrow, name: 'throw', field: 'throw', length: 1 },
]);

// ---- WGSL --------------------------------------------------------------------------
const tag = y => `V(0u,${y}u,9u,0u)`;
// asyncGenerators=false (or an OP table without worker 5's `await`, i.e. a
// worker-7-only preview) emits only the worker-5 await path; the composed
// production tree uses both (check-async-iteration.mjs asserts it).
export const asyncIterationWGSLFunctions = ({ F, L, OP, asyncGenerators = true }) => `
const ASYNC_ITERATOR_PROTOTYPE:u32=${ASYNC_ITERATOR_PROTO_NODE}u;
const ASYNC_FROM_SYNC_PROTOTYPE:u32=${ASYNC_FROM_SYNC_PROTO_NODE}u;
fn asyncIterTag(v:V,y:u32)->bool {return v.z==9u&&v.y==y&&v.x==0u;}
fn asyncIterObject(v:V)->bool {return v.z==4u||v.z==5u||v.z==11u;}
fn asyncIterSentinel(v:V,id:u32)->bool {return v.z==11u&&v.x==id;}
// Await the operand-stack top in the running async activation; it resumes at
// states[l].pc (fulfilled: value pushed; rejected: thrown at that pc).
fn asyncIterationAwait(l:u32) {
  if(asyncActive(l,states[l].env)!=0u){asyncAwait(l);return;}
  ${asyncGenerators && OP.await !== undefined ? `if(asyncGeneratorActive(l,states[l].env)!=0u){asyncGeneratorStep(l,${OP.await}u);return;}` : ''}
  states[l].status=2u;
}
// Call guest helper id with one argument; its result is delivered by
// continuation code with frame receiver data.
fn asyncIterHelper(l:u32,id:u32,argument:V,code:u32,data:V) {
  if(states[l].sp+2u>${L.stack}u){states[l].status=3u;return;}
  push(l,V(id,0u,11u,0u));push(l,argument);
  let depth=states[l].depth;call(l,1u,false,false);
  if(states[l].status!=0u){return;}
  if(states[l].depth!=depth+1u){states[l].status=2u;return;}
  states[l].frames[states[l].depth].tail=code;states[l].frames[states[l].depth].receiver=data;
}
// for_await_of_start: value -> iterator next marker (yield*: record next marker).
fn asyncIterationStart(l:u32) {
  let value=pop(l);if(states[l].status!=0u){return;}
  if(states[l].sp+5u>${L.stack}u){states[l].status=3u;return;}
  let slot=states[l].sp;
  push(l,undef());push(l,undef());push(l,${tag(TAG.start)});
  // yield* (async generator) drops the marker next and reads a {iterator,next} record.
  let delegation=states[l].pc<params.instructions&&code[states[l].pc].x==${OP.drop}u;
  asyncIterHelper(l,${I.open}u,value,${C.open}u,V(slot,select(0u,1u,delegation),0u,0u));
}
// continuation ${C.open}: helper returned the {iterator,next} record.
fn asyncIterationOpened(l:u32,data:V,record:V) {
  if(record.z!=4u||data.x+1u>=states[l].sp){states[l].status=2u;return;}
  let iterator=getProperty(l,record,fieldKey(${F.iterator}u));
  let next=getProperty(l,record,fieldKey(${F.next}u));
  if(iterator.z==12u||next.z==12u){states[l].status=2u;return;}
  if(states[l].status!=0u){return;}
  if(data.y==1u){states[l].stack[data.x]=record;}else{states[l].stack[data.x]=iterator;}
  states[l].stack[data.x+1u]=next;
}
// for_await_of_next at pc N: next() call, or one of the throw-close states.
fn asyncIterationNext(l:u32) {
  let base=states[l].frames[states[l].depth].base;let sp=states[l].sp;let here=states[l].pc-1u;
  // T2 + catch(N) + value: return() result awaited (fulfilled) => rethrow the original error.
  if(sp>=base+4u&&asyncIterTag(states[l].stack[sp-4u],${TAG.t2}u)&&states[l].stack[sp-2u].z==9u&&states[l].stack[sp-2u].y==0u&&states[l].stack[sp-2u].x==here){
    let error=states[l].stack[sp-3u];states[l].sp=sp-4u;raise(l,error);return;
  }
  // T2 + error + rejection (caught by catch(N)) => rethrow the original error.
  if(sp>=base+3u&&asyncIterTag(states[l].stack[sp-3u],${TAG.t2}u)){
    let error=states[l].stack[sp-2u];states[l].sp=sp-3u;raise(l,error);return;
  }
  // T1 + error + helper result: await it (unless there was no return method).
  if(sp>=base+3u&&asyncIterTag(states[l].stack[sp-3u],${TAG.t1}u)){
    let error=states[l].stack[sp-2u];let inner=states[l].stack[sp-1u];
    if(asyncIterSentinel(inner,${I.noAwait}u)){states[l].sp=sp-3u;raise(l,error);return;}
    if(sp+1u>${L.stack}u){states[l].status=3u;return;}
    states[l].stack[sp-3u]=${tag(TAG.t2)};states[l].stack[sp-1u]=V(here,0u,9u,0u);push(l,inner);
    states[l].pc=here;asyncIterationAwait(l);return;
  }
  if(sp<base+3u){states[l].status=2u;return;}
  let top=states[l].stack[sp-1u];
  if(top.z!=9u){
    // raise() delivered a body exception here (marker = catch offset N):
    // [iterator, next, error] -> AsyncIteratorClose(iterator, throw completion).
    let iterator=states[l].stack[sp-3u];states[l].sp=sp-3u;
    push(l,${tag(TAG.t1)});push(l,top);
    asyncIterHelper(l,${I.closeThrow}u,iterator,${C.reexecute}u,V(here,0u,0u,0u));return;
  }
  // Normal: disable the catch offset (next/await/value-done exceptions do not close).
  let iterator=states[l].stack[sp-3u];let next=states[l].stack[sp-2u];
  states[l].stack[sp-1u]=undef();
  if(sp+2u>${L.stack}u){states[l].status=3u;return;}
  push(l,iterator);push(l,next);call(l,0u,true,false);
}
// iterator_get_value_done at pc G (= N + 2: QuickJS emits for_await_of_next; await; iterator_get_value_done).
fn asyncIterationValueDone(l:u32) {
  let base=states[l].frames[states[l].depth].base;let sp=states[l].sp;
  if(sp<base+4u||states[l].pc<3u){states[l].status=2u;return;}
  let result=pop(l);
  asyncIterHelper(l,${I.valueDone}u,result,${C.valueDone}u,V(sp-4u,states[l].pc-3u,0u,0u));
}
// continuation ${C.valueDone}: [iterator next undefined] + value/DONE -> catch_offset value done.
fn asyncIterationStepResult(l:u32,data:V,returned:V) {
  let index=data.x;
  if(index+3u!=states[l].sp){states[l].status=2u;return;}
  if(asyncIterSentinel(returned,${I.done}u)){
    states[l].stack[index]=undef();push(l,undef());push(l,boolean(true));
  }else{
    states[l].stack[index+2u]=V(data.y,0u,9u,0u);push(l,returned);push(l,boolean(false));
  }
}
// iterator_close prefix. True when handled here (async record or a closing
// state); false leaves the synchronous for-of path (next slot = 1274) intact.
fn asyncIterationClose(l:u32)->bool {
  let base=states[l].frames[states[l].depth].base;let sp=states[l].sp;let here=states[l].pc-1u;
  if(sp>=base+2u&&asyncIterTag(states[l].stack[sp-2u],${TAG.r2}u)){
    let value=states[l].stack[sp-1u];states[l].sp=sp-2u;
    if(!asyncIterObject(value)){states[l].status=4u;}
    return true;
  }
  if(sp>=base+2u&&asyncIterTag(states[l].stack[sp-2u],${TAG.r1}u)){
    let inner=states[l].stack[sp-1u];
    if(asyncIterSentinel(inner,${I.noAwait}u)){states[l].sp=sp-2u;return true;}
    states[l].stack[sp-2u]=${tag(TAG.r2)};
    states[l].pc=here;asyncIterationAwait(l);return true;
  }
  if(sp<base+3u){return false;}
  let next=states[l].stack[sp-2u];
  if(next.z==11u&&next.x==1274u){return false;}
  let iterator=states[l].stack[sp-3u];states[l].sp=sp-3u;
  if(!asyncIterObject(iterator)){return true;}
  push(l,${tag(TAG.r1)});
  asyncIterHelper(l,${I.close}u,iterator,${C.reexecute}u,V(here,0u,0u,0u));
  return true;
}
// Private intrinsics 2912 / 2921 / 2922 (objectMethod).
fn asyncIterationIntrinsic(l:u32,id:u32,receiver:V,v:V)->V {
  if(id==${I.asyncIteratorMethod}u){return receiver;}
  if(id==${I.fromSyncCreate}u){
    let object=alloc(l,2u,V(ASYNC_FROM_SYNC_PROTOTYPE,0u,0u,1u),0u,0u);
    if(states[l].status!=0u){return undef();}
    let cell=alloc(l,${BRAND_KIND}u,v,object,0u);
    if(states[l].status!=0u){return undef();}
    states[l].heap[object].value.z=cell;
    return V(object,0u,4u,0u);
  }
  if(id==${I.fromSyncRecord}u){
    if(v.z!=4u||states[l].heap[v.x].kind!=2u){return undef();}
    let cell=states[l].heap[v.x].value.z;
    if(cell==0u||(cell&0x80000000u)!=0u||states[l].heap[cell].kind!=${BRAND_KIND}u||states[l].heap[cell].key!=v.x){return undef();}
    return states[l].heap[cell].value;
  }
  states[l].status=6u;return undef();
}
`;
// Note: getProperty field keys are filled by the shader template (F in scope there).
export const asyncIterationWGSLCases = () => ({
  for_await_of_start: 'asyncIterationStart(l);',
  for_await_of_next: 'asyncIterationNext(l);',
  iterator_get_value_done: 'asyncIterationValueDone(l);',
});
export const asyncIterationContinuations = () => [
  { code: C.reexecute, body: 'push(l,returned);states[l].pc=constructed.x;' },
  { code: C.valueDone, body: 'asyncIterationStepResult(l,constructed,returned);' },
  { code: C.open, body: 'asyncIterationOpened(l,constructed,returned);' },
];
export function asyncIterationLowering(op, instruction, previous) {
  if (!asyncIterationOpcodes.includes(op)) return null;
  // G must directly follow `await`, which directly follows N (quickjs.c 29113-29117).
  if (op === 'iterator_get_value_done' && previous?.op !== 'await') throw new SyntaxError('iterator_get_value_done must follow await (for-await lowering)');
  return { op, a: 0, b: 0 };
}
export const asyncIterationObjectMethodWGSL = `if(id==${I.asyncIteratorMethod}u||id==${I.fromSyncCreate}u||id==${I.fromSyncRecord}u){return asyncIterationIntrinsic(l,id,receiver,original);}`;
export const asyncIterationGCWGSL = `
    if(node.kind==2u&&node.value.z!=0u&&(node.value.z&0x80000000u)==0u&&states[l].heap[node.value.z].kind==${BRAND_KIND}u){mark(l,node.value.z);}
`;
export const asyncIterationInitWGSL = ({ F }) => {
  for (const n of ['next', 'return', 'throw', 'asyncIterator']) if (!(n in F)) throw new Error(`async-iteration: FIELDS lacks ${n}`);
  return `
    states[l].heap[${ASYNC_ITERATOR_PROTO_NODE}u]=Node(V(1u,0u,0u,1u),0u,0u,2u,0u);
    states[l].heap[${ASYNC_FROM_SYNC_PROTO_NODE}u]=Node(V(${ASYNC_ITERATOR_PROTO_NODE}u,0u,0u,1u),0u,0u,2u,0u);
    dataProperty(l,${ASYNC_ITERATOR_PROTO_NODE}u,0x60000000u|${ASYNC_ITERATOR_SYMBOL_NODE}u,V(${I.asyncIteratorMethod}u,0u,11u,0u),5u);
    dataProperty(l,${ASYNC_FROM_SYNC_PROTO_NODE}u,fieldKey(${F.next}u),V(${I.fromSyncNext}u,0u,11u,0u),5u);
    dataProperty(l,${ASYNC_FROM_SYNC_PROTO_NODE}u,fieldKey(${F.return}u),V(${I.fromSyncReturn}u,0u,11u,0u),5u);
    dataProperty(l,${ASYNC_FROM_SYNC_PROTO_NODE}u,fieldKey(${F.throw}u),V(${I.fromSyncThrow}u,0u,11u,0u),5u);
    dataProperty(l,26u,fieldKey(${F.asyncIterator}u),V(${ASYNC_ITERATOR_SYMBOL_NODE}u,0u,17u,0u),0u);
  `;
};
// getProperty() name/length of the tag-11 method values.
export const asyncIterationPropertyWGSL = ({ F }) => asyncIterationMetadata.map(m =>
  `if(obj.z==11u&&obj.x==${m.id}u){if(field(l,key,${F.name}u)){return image[fieldKey(${F[m.field]}u)];}if(lengthKey(l,key)){return num(fromUnsigned(${m.length}u));}states[l].status=6u;return undef();}`).join('\n  ');
export const asyncIterationDispatchWGSL = ({ F }) => Object.entries(asyncIterationBuiltinFields).map(([id, field]) => `if(fnValue.x==${id}u){field=${F[field]}u;}`).join('\n    ');

// ---- integration edits -----------------------------------------------------------
export const asyncIterationShaderFunctions = context => asyncIterationWGSLFunctions(context);
const IMPORT = "import {asyncIterationShaderFunctions,asyncIterationObjectMethodWGSL,asyncIterationGCWGSL,asyncIterationInitWGSL,asyncIterationPropertyWGSL,asyncIterationDispatchWGSL} from './async-iteration-source.js';";
export const asyncIterationIntegrationEdits = Object.freeze([
  { file: 'program.js', anchor: 'export const FIELDS =', position: 'before',
    text: "for(const name of ['asyncIteratorOpenHelper','asyncIteratorValueDoneHelper','asyncIteratorCloseHelper','asyncIteratorCloseThrowHelper','asyncFromSyncNextHelper','asyncFromSyncReturnHelper','asyncFromSyncThrowHelper','asyncFromSyncContinuationHelper','[Symbol.asyncIterator]'])if(!fieldNames.includes(name))fieldNames.push(name);\n",
    why: 'append-only FIELDS: 8 helper slots + the [Symbol.asyncIterator] name text' },
  { file: 'bootstrap.js', anchor: "import { phase4BootstrapSources, phase4PrivateBuiltins, protocolBootstrapSources } from './phase4-registry.js';", position: 'after',
    text: "\nimport { asyncIterationSources, asyncIterationPrivateBuiltins } from './async-iteration-source.js';", why: 'import helper sources + private names' },
  { file: 'bootstrap.js', anchor: '  ...phase3BigintConversionIntrinsics,', position: 'before',
    text: '  ...asyncIterationPrivateBuiltins,\n', why: 'privateBuiltins 2916..2924 + %Promise% alias' },
  { file: 'bootstrap.js', anchor: '  ...generatorDelegationSources,', position: 'after',
    text: '\n  ...asyncIterationSources,', why: 'bootstrapSources: async iteration helpers' },
  { file: 'phase4-registry.js', anchor: "import {generatorOpcodes,generatorWGSLFunctions,generatorWGSLCases} from './generator-source.js';\n", position: 'before',
    text: "import {asyncIterationOpcodes,asyncIterationLowering,asyncIterationWGSLCases,asyncIterationContinuations} from './async-iteration-source.js';\n", why: 'import' },
  { file: 'phase4-registry.js', anchor: '...generatorDelegationOpcodes', position: 'after',
    text: ',...asyncIterationOpcodes', why: 'append opcodes for_await_of_start, for_await_of_next, iterator_get_value_done' },
  { file: 'phase4-registry.js', anchor: '  if(generatorOpcodes.includes(op))return {op,a:0,b:0};', position: 'after',
    text: '\n  const asyncIterationLowered=asyncIterationLowering(op,instruction,previous);if(asyncIterationLowered)return asyncIterationLowered;',
    why: 'admit the for-await opcodes before the phase-4 rejection list (iterationRejectedOpcodes)' },
  { file: 'phase4-registry.js', anchor: '    ...generatorDelegationCasesWGSL(context),', position: 'after',
    text: '\n    ...asyncIterationWGSLCases(context),', why: 'opcode cases' },
  { file: 'phase4-registry.js', anchor: '...generatorDelegationContinuations(context)', position: 'after',
    text: ',...asyncIterationContinuations(context)', why: 'continuations 152..154' },
  { file: 'phase4-iteration.js', anchor: '  iterator_close: `', position: 'after',
    text: 'if(asyncIterationClose(l)){break;}\n        ', why: 'iterator_close: async records and closing states (sync path untouched)' },
  { file: 'shader.js', anchor: "import { LIMITS as L, OP, FIELDS as F, objectStaticPlaceholders, numberWords } from './program.js';", position: 'after',
    text: '\n' + IMPORT, why: 'async-iteration WGSL fragments' },
  { file: 'shader.js', anchor: '${phase4WGSLFunctions(phase4Context)}', position: 'before',
    text: '${asyncIterationShaderFunctions({F,L,OP})}\n', why: 'module-scope functions' },
  { file: 'shader.js', anchor: '    ${generatorGCWGSL}', position: 'after',
    text: '\n    ${asyncIterationGCWGSL}', why: 'GC: Async-from-Sync object -> brand cell (kind 67 marks its record)' },
  { file: 'shader.js', anchor: '    if(fnValue.x==960u){field=${F.numberPow}u;}', position: 'before',
    text: '    ${asyncIterationDispatchWGSL({F})}\n', why: 'call(): 2913..2920 -> helper closures' },
  { file: 'shader.js', anchor: '  var id=method;if(id==901u){id=102u;}if(id==902u){id=107u;}\n  let a=objectView(l,original);', position: 'after',
    text: '\n  ${asyncIterationObjectMethodWGSL}', why: 'objectMethod: 2912 / 2921 / 2922' },
  { file: 'shader.js', anchor: '  if(obj.z==11u&&obj.x==2000u){', position: 'before',
    text: '  ${asyncIterationPropertyWGSL({F})}\n', why: 'getProperty: name/length of 2912..2915' },
  { file: 'shader.js', anchor: '    // Fixed node 65: global object (phase4-global.js), global-object mode only.', position: 'before',
    text: '    ${asyncIterationInitWGSL({F})}\n', why: 'init nodes 96/97 + Symbol.asyncIterator (requires FIXED_RESERVED_LAST >= 97)' },
]);
export const applyAsyncIterationEdits = (files, edits = asyncIterationIntegrationEdits) => applyEdits(files, edits, 'async-iteration');

export const asyncIterationGaps = Object.freeze([
  'Async generators: the inline QuickJS return-out-of-for-await sequence (get_field2 return; call_method; iterator_check_object; await) checks Object before awaiting (ES2025: await, then check). Owned by the async-generator bytecode; not changed here.',
  'for-await in async generators awaits through worker 6 asyncGeneratorStep(l, OP.await); its resumption must push the value / throw at states[l].pc like worker 5 asyncAwait.',
  'Proxy / exotic iterators are not modelled by the VM (unchanged).',
  'The Async-from-Sync wrapper is not observable to guest code in ES2025 except through these methods; brand failures throw TypeError (spec asserts).',
  'iterator_get_value_done assumes QuickJS emits for_await_of_next; await; iterator_get_value_done consecutively (lowering checks the await predecessor).',
]);
