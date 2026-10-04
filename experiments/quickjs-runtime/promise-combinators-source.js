// Promise + async wave, worker 4: Promise.resolve / reject / all / allSettled /
// any / race / withResolvers, get Promise[@@species], and AggregateError.
//
// Guest code only: every string in `promiseCombinatorsSources` is a strict
// bootstrap helper compiled by QuickJS and executed by the WGSL VM. The WGSL
// strings below only install metadata, route builtin ids to those helpers and
// allocate the AggregateError object (makeError with prototype node 99). No
// host Promise is involved anywhere in guest semantics.
//
// Spec: ECMA-262 2025, 27.2.4.1 Promise.all (+ 27.2.4.1.1 GetPromiseResolve,
// 27.2.4.1.2 PerformPromiseAll, 27.2.4.1.3 Promise.all Resolve Element
// Functions), 27.2.4.2 allSettled (+ .1/.2/.3), 27.2.4.3 any (+ .1/.2),
// 27.2.4.5 race (+ .1), 27.2.4.6 reject, 27.2.4.7 resolve, 27.2.4.8
// withResolvers (ES2025 addition), 27.2.4.9 get Promise[@@species];
// 20.5.7 AggregateError, 20.5.8.1 InstallErrorCause, 7.4.x iterator ops.
//
// Exact algorithm order shared by all/allSettled/any/race (27.2.4.1 steps):
//   1. C = this value.
//   2. promiseCapability = ? NewPromiseCapability(C)      (throws synchronously; not a rejection)
//   3. promiseResolve = Completion(GetPromiseResolve(C))   (Get(C,"resolve") exactly once, IsCallable)
//   4. IfAbruptRejectPromise(promiseResolve, capability)   (iterator NOT yet obtained: nothing to close)
//   5. iteratorRecord = Completion(GetIterator(iterable, sync))
//   6. IfAbruptRejectPromise(iteratorRecord, capability)
//   7. result = Completion(PerformPromiseX(...))
//   8. abrupt: if iteratorRecord.[[Done]] is false -> IteratorClose(iteratorRecord, result);
//      IfAbruptRejectPromise(result, capability).
// [[Done]] becomes true on an abrupt IteratorStepValue (throwing next(), a
// non-object result, throwing `done` or `value` getters) and on exhaustion, so
// those never call `return`. Abrupt Call(promiseResolve, C, next) and abrupt
// Invoke(nextPromise, "then", ...) happen with [[Done]] false and close.
// IfAbruptRejectPromise performs `? Call(capability.[[Reject]], undefined, «e»)`:
// a throwing reject function propagates synchronously.
//
// Iteration uses the live generic IteratorRecord ABI (phase6-protocols w2/w3):
// __lanesIteratorOpen 1270 (GetIterator + Get(next) once), __lanesIteratorStep
// 1271 (IteratorStepValue: returns the record itself as the DONE sentinel and
// lets abrupt completions propagate without closing), __lanesIteratorCloseThrow
// 2440 (IteratorClose with a throw completion: original error wins). Guest
// for-of is NOT used: its throw path closes the iterator for abrupt next()/
// value completions inside the loop body boundary in ways that do not match the
// IfAbruptRejectPromise split above, and the combinators need the DONE branch
// to keep [[Done]] = true.
import { PROMISE_IDS, PROMISE_NODES, PROMISE_HELPER_RANGES, PROMISE_INTRINSIC_RANGES } from './promise-ids.js';

// ------------------------------------------------------------------ ids ----
// Worker 4 helper range 2835..2839 (guest helpers) and intrinsic range
// 2940..2949. 2940 is the public AggregateError constructor identity
// (tag-11 value V(2940,0,11,0) <-> backing node 98, like 600..606 <-> 11..17).
export const PROMISE_COMBINATOR_HELPER_IDS = Object.freeze({
  getPromiseResolve: 2835,   // __promiseGetResolve(C)
  listToArray: 2836,         // __promiseListToArray(list, count)  CreateArrayFromList
  aggregateErrorFor: 2837,   // __promiseAggregateError(list, count) Promise.any rejection value
  // 2838, 2839: spare (unused)
});
export const AGGREGATE_ERROR_IDS = Object.freeze({
  ctor: 2940,                // public AggregateError (callable and constructible; guest helper field aggregateErrorConstruct)
  create: 2941,              // WGSL intrinsic __lanesAggregateErrorCreate(): new kind-8 error object, [[Prototype]] node 99
  // 2942..2949: spare (unused)
});
export const AGGREGATE_ERROR_NODES = Object.freeze({ ctor: PROMISE_NODES.aggregateErrorCtor, proto: PROMISE_NODES.aggregateErrorProto });
// makeError(l, kind, ...) allocates value=(4u+kind, ...); kind 95 => prototype node 99.
export const AGGREGATE_ERROR_MAKE_ERROR_KIND = AGGREGATE_ERROR_NODES.proto - 4;
// %Symbol.species% well-known cell: 31 + phase3WellKnownNames.indexOf('species') = 39.
export const SPECIES_SYMBOL_NODE = 39;
export const SPECIES_KEY = (0x60000000 | SPECIES_SYMBOL_NODE) >>> 0;

// Names this module resolves in bootstrap roots (parent adds the worker-4
// entries to bootstrap.js privateBuiltins; the others already exist or are
// owned by workers 1/2).
export const promiseCombinatorsIntrinsics = Object.freeze({
  __promiseGetResolve: PROMISE_COMBINATOR_HELPER_IDS.getPromiseResolve,
  __promiseListToArray: PROMISE_COMBINATOR_HELPER_IDS.listToArray,
  __promiseAggregateError: PROMISE_COMBINATOR_HELPER_IDS.aggregateErrorFor,
  __lanesAggregateErrorCreate: AGGREGATE_ERROR_IDS.create,
});
// Dependencies (not owned here): must resolve in privateBuiltins at integration.
export const promiseCombinatorsDependencies = Object.freeze({
  __promiseNewCapability: 2821,   // worker 1: NewPromiseCapability(C) -> {promise, resolve, reject}
  __promiseResolve: 2827,         // worker 2: PromiseResolve(C, x)
  __lanesCall: 113, __lanesDescriptor: 112, __lanesDefine: 110, __lanesText: 111, __lanesToText: 134,
  __lanesReviverDefine: 1861,     // CreateDataProperty (all-true attributes), bypasses inherited setters
  __lanesIteratorOpen: 1270, __lanesIteratorStep: 1271, __lanesIteratorCloseThrow: 2440,
});

// ------------------------------------------------------------- sources ----
// Shared prologue of the iterator combinators (steps 1..6 above).
const prologue = `
  "use strict";
  const C = this;
  const capability = __promiseNewCapability(C);
  const promise = capability.promise;
  const resolve = capability.resolve;
  const reject = capability.reject;
  const call = __lanesCall;
  let promiseResolve;
  try {
    promiseResolve = __promiseGetResolve(C);
  } catch (error) {
    call(reject, undefined, error);
    return promise;
  }
  let record;
  try {
    record = __lanesIteratorOpen(iterable);
  } catch (error) {
    call(reject, undefined, error);
    return promise;
  }`;

// IteratorStepValue: abrupt => [[Done]] true => reject without IteratorClose.
const step = `
    let next;
    try {
      next = __lanesIteratorStep(record);
    } catch (error) {
      call(reject, undefined, error);
      return promise;
    }`;

// Invoke(nextPromise, "then", args): GetV (boxes primitives, TypeError on
// undefined/null) then Call (TypeError if not callable). Any abrupt completion
// inside the per-element block closes the iterator ([[Done]] is false).
const invoke = (args) => `
      const then = nextPromise.then;
      if (typeof then !== "function") throw new TypeError("Promise combinator: then is not callable");
      call(then, nextPromise, ${args});`;

const closeAndReject = `
    } catch (error) {
      call(reject, undefined, __lanesIteratorCloseThrow(record, error));
      return promise;
    }`;

// Element functions are anonymous arrow functions created inline as call
// arguments: length 1, name "", no "prototype", not constructors (built-in
// spec functions created by CreateBuiltinFunction(steps, 1, "", ...)). The
// [[AlreadyCalled]] / [[Index]] / [[Values]] / [[RemainingElements]] slots are
// the per-iteration `alreadyCalled` / `elementIndex` bindings and the shared
// `values` list / `remaining` counter of the root activation.
// Private names (__lanes*, __promise*) and globals (undefined, TypeError) only
// resolve in a helper's ROOT scope, so element functions use root locals only
// (`call`, `toArray`, `aggregate`, `resolve`, `reject`) and `void 0`; the check
// asserts nested functions carry no global (type 3) references.
// Internal lists are null-prototype objects (no inherited setters), copied by
// CreateArrayFromList (__promiseListToArray) when they are published.
const allLike = (name, { settled }) => `function ${name}(iterable) {${prologue}
  const values = __lanesDescriptor();
  const toArray = __promiseListToArray;
  let remaining = 1;
  let index = 0;
  for (;;) {${step}
    if (next === record) {
      remaining = remaining - 1;
      if (remaining === 0) {
        try {
          call(resolve, undefined, toArray(values, index));
        } catch (error) {
          call(reject, undefined, error);
        }
      }
      return promise;
    }
    try {
      values[index] = undefined;
      const nextPromise = call(promiseResolve, C, next);
      const elementIndex = index;
      let alreadyCalled = false;
      remaining = remaining + 1;${invoke(settled ? `(x) => {
        if (alreadyCalled) return;
        alreadyCalled = true;
        values[elementIndex] = { status: "fulfilled", value: x };
        remaining = remaining - 1;
        if (remaining === 0) return call(resolve, void 0, toArray(values, index));
      }, (x) => {
        if (alreadyCalled) return;
        alreadyCalled = true;
        values[elementIndex] = { status: "rejected", reason: x };
        remaining = remaining - 1;
        if (remaining === 0) return call(resolve, void 0, toArray(values, index));
      }` : `(x) => {
        if (alreadyCalled) return;
        alreadyCalled = true;
        values[elementIndex] = x;
        remaining = remaining - 1;
        if (remaining === 0) return call(resolve, void 0, toArray(values, index));
      }, reject`)}${closeAndReject}
    index = index + 1;
  }
}`;

export const promiseAllSource = allLike('promiseAllBootstrap', { settled: false });
export const promiseAllSettledSource = allLike('promiseAllSettledBootstrap', { settled: true });

// 27.2.4.3.1 PerformPromiseAny: on DONE with remaining 0 the AggregateError is
// a throw completion with [[Done]] true -> rejected without IteratorClose.
export const promiseAnySource = `function promiseAnyBootstrap(iterable) {${prologue}
  const errors = __lanesDescriptor();
  const aggregate = __promiseAggregateError;
  let remaining = 1;
  let index = 0;
  for (;;) {${step}
    if (next === record) {
      remaining = remaining - 1;
      if (remaining === 0) call(reject, undefined, aggregate(errors, index));
      return promise;
    }
    try {
      errors[index] = undefined;
      const nextPromise = call(promiseResolve, C, next);
      const elementIndex = index;
      let alreadyCalled = false;
      remaining = remaining + 1;${invoke(`resolve, (x) => {
        if (alreadyCalled) return;
        alreadyCalled = true;
        errors[elementIndex] = x;
        remaining = remaining - 1;
        if (remaining === 0) return call(reject, void 0, aggregate(errors, index));
      }`)}${closeAndReject}
    index = index + 1;
  }
}`;

// 27.2.4.5.1 PerformPromiseRace: an empty iterable leaves the promise pending.
export const promiseRaceSource = `function promiseRaceBootstrap(iterable) {${prologue}
  for (;;) {${step}
    if (next === record) return promise;
    try {
      const nextPromise = call(promiseResolve, C, next);${invoke('resolve, reject')}${closeAndReject}
  }
}`;

// 27.2.4.7: C must be an Object (TypeError), then PromiseResolve(C, x) (worker 2).
export const promiseResolveStaticSource = `function promiseResolveStaticBootstrap(x) {
  "use strict";
  const C = this;
  if (C === null || (typeof C !== "object" && typeof C !== "function")) throw new TypeError("Promise.resolve called on a non-object");
  return __promiseResolve(C, x);
}`;

// 27.2.4.6: NewPromiseCapability(C) (TypeError for non-constructors), then
// ? Call(capability.[[Reject]], undefined, «r»). r is never unwrapped.
export const promiseRejectStaticSource = `function promiseRejectStaticBootstrap(r) {
  "use strict";
  const capability = __promiseNewCapability(this);
  __lanesCall(capability.reject, undefined, r);
  return capability.promise;
}`;

// 27.2.4.8: OrdinaryObjectCreate(%Object.prototype%) + CreateDataPropertyOrThrow
// promise, resolve, reject (object literal fields are defined, not [[Set]]).
export const promiseWithResolversSource = `function promiseWithResolversBootstrap() {
  "use strict";
  const capability = __promiseNewCapability(this);
  return { promise: capability.promise, resolve: capability.resolve, reject: capability.reject };
}`;

// 27.2.4.1.1 GetPromiseResolve(promiseConstructor).
export const promiseGetResolveSource = `function promiseGetResolveBootstrap(C) {
  "use strict";
  const promiseResolve = C.resolve;
  if (typeof promiseResolve !== "function") throw new TypeError("Promise resolve is not callable");
  return promiseResolve;
}`;

// 7.3.18 CreateArrayFromList over a null-prototype internal list.
export const promiseListToArraySource = `function promiseListToArrayBootstrap(list, count) {
  "use strict";
  const array = [];
  for (let i = 0; i < count; i++) {
    if (!__lanesReviverDefine(array, __lanesText(i), list[i])) throw new TypeError("Cannot create array element");
  }
  return array;
}`;

// 27.2.4.3.1 step 9.d / 27.2.4.3.2 step 10: a newly created AggregateError
// with ! DefinePropertyOrThrow(error, "errors", {W, !E, C, CreateArrayFromList(errors)}).
// The message is implementation-defined (not specified); V8's text is used.
export const PROMISE_ANY_MESSAGE = 'All promises were rejected';
export const promiseAggregateErrorSource = `function promiseAggregateErrorBootstrap(list, count) {
  "use strict";
  const error = __lanesAggregateErrorCreate();
  const message = __lanesDescriptor();
  message.value = "${PROMISE_ANY_MESSAGE}"; message.writable = true; message.configurable = true;
  __lanesDefine(error, "message", message);
  const errors = __lanesDescriptor();
  errors.value = __promiseListToArray(list, count); errors.writable = true; errors.configurable = true;
  __lanesDefine(error, "errors", errors);
  return error;
}`;

// 20.5.7.1.1 AggregateError(errors, message [, options]). NewTarget is always
// %AggregateError% here (call and `new` both route to this helper; a different
// NewTarget is the construct() status-6 boundary), so
// OrdinaryCreateFromConstructor yields [[Prototype]] node 99. Order: message
// ToString, InstallErrorCause (HasProperty then Get), then
// IteratorToList(GetIterator(errors)) with no IteratorClose on abrupt steps.
export const aggregateErrorConstructSource = `function aggregateErrorBootstrap(errors, message, options) {
  "use strict";
  const error = __lanesAggregateErrorCreate();
  if (message !== undefined) {
    const desc = __lanesDescriptor();
    desc.value = __lanesToText(message); desc.writable = true; desc.configurable = true;
    __lanesDefine(error, "message", desc);
  }
  if (options !== null && (typeof options === "object" || typeof options === "function") && "cause" in options) {
    const desc = __lanesDescriptor();
    desc.value = options.cause; desc.writable = true; desc.configurable = true;
    __lanesDefine(error, "cause", desc);
  }
  const record = __lanesIteratorOpen(errors);
  const list = __lanesDescriptor();
  let count = 0;
  for (;;) {
    const value = __lanesIteratorStep(record);
    if (value === record) break;
    list[count] = value;
    count = count + 1;
  }
  const desc = __lanesDescriptor();
  desc.value = __promiseListToArray(list, count); desc.writable = true; desc.configurable = true;
  __lanesDefine(error, "errors", desc);
  return error;
}`;

// FIELDS key -> guest source (parent spreads into bootstrap.js bootstrapSources).
export const promiseCombinatorsSources = Object.freeze({
  promiseResolveStatic: promiseResolveStaticSource,
  promiseRejectStatic: promiseRejectStaticSource,
  promiseAll: promiseAllSource,
  promiseAllSettled: promiseAllSettledSource,
  promiseAny: promiseAnySource,
  promiseRace: promiseRaceSource,
  promiseWithResolvers: promiseWithResolversSource,
  promiseGetResolve: promiseGetResolveSource,
  promiseListToArray: promiseListToArraySource,
  promiseAggregateError: promiseAggregateErrorSource,
  aggregateErrorConstruct: aggregateErrorConstructSource,
});

// ------------------------------------------------------------ metadata ----
// Public functions on %Promise% (node 90). `name` is the FIELDS key of the
// function's "name" value; installation order follows ES2025 27.2.4.
export const promiseStaticMetadata = Object.freeze([
  { key: 'all', name: 'all', id: PROMISE_IDS.all, length: 1, field: 'promiseAll' },
  { key: 'allSettled', name: 'allSettled', id: PROMISE_IDS.allSettled, length: 1, field: 'promiseAllSettled' },
  { key: 'any', name: 'any', id: PROMISE_IDS.any, length: 1, field: 'promiseAny' },
  { key: 'race', name: 'race', id: PROMISE_IDS.race, length: 1, field: 'promiseRace' },
  { key: 'reject', name: 'reject', id: PROMISE_IDS.reject, length: 1, field: 'promiseRejectStatic' },
  { key: 'resolve', name: 'resolve', id: PROMISE_IDS.resolve, length: 1, field: 'promiseResolveStatic' },
  { key: 'withResolvers', name: 'withResolvers', id: PROMISE_IDS.withResolvers, length: 0, field: 'promiseWithResolvers' },
].map(m => Object.freeze(m)));
// get Promise[@@species]: accessor {get, set: undefined, E: false, C: true}; the getter returns this (WGSL).
export const promiseSpeciesMetadata = Object.freeze({ id: PROMISE_IDS.species, name: 'get [Symbol.species]', length: 0, key: SPECIES_KEY });
// Private guest helpers (dispatch only, no public metadata).
export const promiseHelperMetadata = Object.freeze([
  { id: PROMISE_COMBINATOR_HELPER_IDS.getPromiseResolve, field: 'promiseGetResolve' },
  { id: PROMISE_COMBINATOR_HELPER_IDS.listToArray, field: 'promiseListToArray' },
  { id: PROMISE_COMBINATOR_HELPER_IDS.aggregateErrorFor, field: 'promiseAggregateError' },
  { id: AGGREGATE_ERROR_IDS.ctor, field: 'aggregateErrorConstruct' },
].map(m => Object.freeze(m)));
export const aggregateErrorMetadata = Object.freeze({ name: 'AggregateError', length: 2, ctorNode: AGGREGATE_ERROR_NODES.ctor, protoNode: AGGREGATE_ERROR_NODES.proto, parentCtorNode: 11, parentProtoNode: 4 });

// FIELDS names (append-only; parent pushes missing names in program.js).
export const promiseCombinatorsFields = Object.freeze([...new Set([
  ...promiseStaticMetadata.flatMap(m => [m.key, m.name, m.field]),
  promiseSpeciesMetadata.name,
  ...promiseHelperMetadata.map(m => m.field),
  'AggregateError', 'errors',
])]);

// ---------------------------------------------------------------- WGSL ----
const need = (F, name) => { if (!(name in F)) throw new Error(`promise combinators: FIELDS lacks ${name}`); return F[name]; };

// getProperty(): name/length of the backing-less tag-11 builtins (same shape
// as phase5Methods). Other keys keep the existing status-6 boundary.
export const promiseCombinatorsMetadataWGSL = ({ F }) => [...promiseStaticMetadata, promiseSpeciesMetadata].map(m =>
  `if(obj.z==11u&&obj.x==${m.id}u){if(field(l,key,${need(F, 'name')}u)){return image[fieldKey(${need(F, m.name)}u)];}if(lengthKey(l,key)){return num(fromUnsigned(${m.length}u));}states[l].status=6u;return undef();}`
).join('\n  ');

// objectMethod id 119 (__lanesHasOwnLength): these builtins own "length".
export const promiseCombinatorsHasOwnLengthWGSL = () =>
  `if(original.z==11u&&original.x>=${PROMISE_IDS.resolve}u&&original.x<=${PROMISE_IDS.species}u){return boolean(true);}`;

// call(): builtin id -> bootstrap helper FIELDS slot.
export const promiseCombinatorsDispatchWGSL = ({ F }) => [...promiseStaticMetadata, ...promiseHelperMetadata].map(m =>
  `if(fnValue.x==${m.id}u){field=${need(F, m.field)}u;}`
).join('\n    ');

// objectMethod(): WGSL intrinsics (no allocation besides makeError's own).
export const promiseCombinatorsObjectMethodWGSL = () => [
  `if(id==${AGGREGATE_ERROR_IDS.create}u){return makeError(l,${AGGREGATE_ERROR_MAKE_ERROR_KIND}u,undef(),undef());}`,
  `if(id==${PROMISE_IDS.species}u){return receiver;}`,
].join('\n  ');

export const promiseCombinatorsObjectViewWGSL = () =>
  `if(v.z==11u&&v.x==${AGGREGATE_ERROR_IDS.ctor}u){return V(${AGGREGATE_ERROR_NODES.ctor}u,0u,4u,0u);}`;
export const promiseCombinatorsObjectValueWGSL = () =>
  `if(id==${AGGREGATE_ERROR_NODES.ctor}u){return V(${AGGREGATE_ERROR_IDS.ctor}u,0u,11u,0u);}`;

// construct(): `new AggregateError(...)` with NewTarget === callee calls the
// helper with an undefined receiver (exactly like 600..606).
export const promiseCombinatorsConstructWGSL = () =>
  `if(callee.x==${AGGREGATE_ERROR_IDS.ctor}u){constructorId=callee.x;}`;

// main() init. Part A (AggregateError, nodes 98/99) is self-contained. Part B
// adds the statics to node 90 and MUST run after worker 1 writes node 90 in
// place (otherwise worker 1's Node(...) assignment would drop them).
export const aggregateErrorInitWGSL = ({ F }) => {
  const { ctorNode: c, protoNode: p } = aggregateErrorMetadata;
  return [
    `states[l].heap[${c}u]=Node(V(11u,0u,0u,1u),0u,0u,2u,0u);`,
    `states[l].heap[${p}u]=Node(V(4u,0u,0u,1u),0u,0u,2u,0u);`,
    `dataProperty(l,${c}u,fieldKey(${need(F, 'length')}u),num(fromUnsigned(2u)),4u);`,
    `dataProperty(l,${c}u,fieldKey(${need(F, 'name')}u),image[fieldKey(${need(F, 'AggregateError')}u)],4u);`,
    `dataProperty(l,${c}u,fieldKey(${need(F, 'prototype')}u),V(${p}u,0u,4u,0u),0u);`,
    `dataProperty(l,${p}u,fieldKey(${need(F, 'constructor')}u),V(${AGGREGATE_ERROR_IDS.ctor}u,0u,11u,0u),5u);`,
    `dataProperty(l,${p}u,fieldKey(${need(F, 'message')}u),image[fieldKey(${need(F, '')}u)],5u);`,
    `dataProperty(l,${p}u,fieldKey(${need(F, 'name')}u),image[fieldKey(${need(F, 'AggregateError')}u)],5u);`,
  ].join('\n    ');
};
export const promiseStaticsInitWGSL = ({ F }) => {
  const ctor = PROMISE_NODES.promiseCtor, s = promiseSpeciesMetadata;
  return [
    ...promiseStaticMetadata.map(m => `dataProperty(l,${ctor}u,fieldKey(${need(F, m.key)}u),V(${m.id}u,0u,11u,0u),5u);`),
    `{let accessor=alloc(l,9u,V(${(0x80000000 | s.id) >>> 0}u,0u,0u,0u),${s.key}u,states[l].heap[${ctor}u].next);states[l].heap[accessor].marked=8u;states[l].heap[${ctor}u].next=accessor;}`,
  ].join('\n    ');
};
export const promiseCombinatorsInitWGSL = ({ F }) => `${aggregateErrorInitWGSL({ F })}\n    ${promiseStaticsInitWGSL({ F })}`;

export const promiseCombinatorsWGSL = ({ F }) => [
  promiseCombinatorsMetadataWGSL({ F }), promiseCombinatorsHasOwnLengthWGSL(), promiseCombinatorsDispatchWGSL({ F }),
  promiseCombinatorsObjectMethodWGSL(), promiseCombinatorsObjectViewWGSL(), promiseCombinatorsObjectValueWGSL(),
  promiseCombinatorsConstructWGSL(), promiseCombinatorsInitWGSL({ F }),
].join('\n');

// ------------------------------------------------------ integration edits --
// Anchors are exact substrings of the files produced by
// generatorIntegrationPatch(live, {iteratorPrototypeNode: 77}); each must match
// exactly once (check-promise-combinators.mjs). All edits are 'before'/'after'
// insertions independent of other workers, except the documented ordering of
// the init edit (after worker 1's node-90 initialization at the same anchor).
const IMPORT = "import {promiseCombinatorsMetadataWGSL,promiseCombinatorsHasOwnLengthWGSL,promiseCombinatorsDispatchWGSL,promiseCombinatorsObjectMethodWGSL,promiseCombinatorsObjectViewWGSL,promiseCombinatorsObjectValueWGSL,promiseCombinatorsConstructWGSL,promiseCombinatorsInitWGSL} from './promise-combinators-source.js';\n";
export const promiseCombinatorsIntegrationEdits = Object.freeze([
  { file: 'shader.js', anchor: "import {generatorGCWGSL,generatorClosureWGSL,generatorInitWGSL,generatorMetadata} from './generator-source.js';\n", position: 'after', text: IMPORT,
    why: 'Import the worker-4 WGSL generators.' },
  { file: 'shader.js', anchor: '  if(obj.z==11u&&obj.x==2000u){', position: 'before', text: '  ${promiseCombinatorsMetadataWGSL({F})}\n',
    why: 'getProperty: name/length of Promise.resolve..withResolvers and get [Symbol.species] (backing-less tag-11 builtins).' },
  { file: 'shader.js', anchor: '    if(original.z==11u&&original.x==2000u){return boolean(true);}', position: 'before', text: '    ${promiseCombinatorsHasOwnLengthWGSL()}\n',
    why: '__lanesHasOwnLength (Function.prototype.bind) sees an own length on the statics.' },
  { file: 'shader.js', anchor: '    if(fnValue.x==960u){field=${F.numberPow}u;}', position: 'after', text: '\n    ${promiseCombinatorsDispatchWGSL({F})}',
    why: 'call(): route 2805..2811, 2835..2837 and 2940 to their guest bootstrap helpers.' },
  { file: 'shader.js', anchor: '  if(id>=600u&&id<=606u){return makeError(l,id-600u,original,b);}', position: 'before', text: '  ${promiseCombinatorsObjectMethodWGSL()}\n',
    why: 'objectMethod(): 2941 __lanesAggregateErrorCreate (makeError kind 95 => [[Prototype]] node 99) and the 2812 species getter (returns this).' },
  { file: 'shader.js', anchor: '  if(v.z==11u&&v.x==401u){return V(85u,0u,4u,0u);}', position: 'after', text: '\n  ${promiseCombinatorsObjectViewWGSL()}',
    why: 'objectView: AggregateError V(2940,11) <-> backing node 98.' },
  { file: 'shader.js', anchor: '  if(id==85u){return V(401u,0u,11u,0u);}', position: 'after', text: '\n  ${promiseCombinatorsObjectValueWGSL()}',
    why: 'objectValue: node 98 -> V(2940,11) (identity of AggregateError.prototype.constructor reads).' },
  { file: 'shader.js', anchor: '    if(callee.x==100u||callee.x==200u||(callee.x>=600u&&callee.x<=606u)){', position: 'before', text: '    ${promiseCombinatorsConstructWGSL()}\n',
    why: 'construct(): new AggregateError(...) -> guest helper with undefined receiver.' },
  { file: 'shader.js', anchor: '    if(globalMode()){globalInit(l);}', position: 'before', text: '    ${promiseCombinatorsInitWGSL({F})}\n', after: ['worker1'],
    why: 'main() init: AggregateError nodes 98/99 and Promise statics + @@species accessor on node 90. ORDER: apply after worker 1 edit that initializes node 90 at this anchor (later before-insertions run later).' },
  { file: 'program.js', anchor: "import {generatorFields,GENERATOR_KIND_BIT} from './generator-source.js';\n", position: 'after', text: "import {promiseCombinatorsFields} from './promise-combinators-source.js';\n",
    why: 'Import FIELDS names.' },
  { file: 'program.js', anchor: 'export const FIELDS =', position: 'before', text: 'for(const name of promiseCombinatorsFields)if(!fieldNames.includes(name))fieldNames.push(name);\n',
    why: 'Append-only FIELDS names (method names, helper fields, AggregateError, errors, get [Symbol.species]).' },
  { file: 'program.js', anchor: "      if(root && ref.name==='Reflect'){add([6,47,0,0]);continue;}", position: 'after', text: "\n      if(root && ref.name==='AggregateError'){add([4,2940,0,0]);continue;}",
    why: 'Classic-mode capture of the AggregateError global (must match phase4-global.js globalBindings).' },
  { file: 'bootstrap.js', anchor: "import { phase4BootstrapSources, phase4PrivateBuiltins, protocolBootstrapSources } from './phase4-registry.js';\n", position: 'after', text: "import { promiseCombinatorsSources, promiseCombinatorsIntrinsics } from './promise-combinators-source.js';\n",
    why: 'Import guest sources and private names.' },
  { file: 'bootstrap.js', anchor: '  ...phase3BigintConversionIntrinsics,', position: 'before', text: '  ...promiseCombinatorsIntrinsics,\n',
    why: 'privateBuiltins: __promiseGetResolve 2835, __promiseListToArray 2836, __promiseAggregateError 2837, __lanesAggregateErrorCreate 2941.' },
  { file: 'bootstrap.js', anchor: '  ...generatorDelegationSources,', position: 'after', text: '\n  ...promiseCombinatorsSources,',
    why: 'bootstrapSources: compile the worker-4 guest helpers as intrinsic roots.' },
  { file: 'phase4-global.js', anchor: "  { name: 'Reflect', value: { node: 47 }, flags: WRITABLE | CONFIGURABLE },", position: 'after', text: "\n  { name: 'AggregateError', value: { builtin: 2940 }, flags: WRITABLE | CONFIGURABLE },",
    why: 'Global binding AggregateError (W, !E, C) in global-object mode; identity V(2940,11).' },
  { file: 'phase4-global.js', anchor: "  'AggregateError', 'ArrayBuffer',", position: 'replace', text: "  'ArrayBuffer',",
    why: 'AggregateError is implemented: remove it from globalUnimplementedNames.' },
]);

// Parent-side requirements this module cannot express as edits of its own.
export const promiseCombinatorsParentRequirements = Object.freeze([
  'FIXED_RESERVED_LAST must cover 98/99 (phase4-fixed-nodes.js 85 -> 105, already planned in promise-ids.js) so nodes 98/99 are never allocated/swept; kind 2 makes them GC roots.',
  'Worker 1 must initialize node 90 (Promise ctor backing, kind 2) BEFORE promiseCombinatorsInitWGSL runs, and own objectView(V(2800,11)) <-> 90.',
  'Promise global (V(2800,11)) wiring is worker 1/parent; fixtures reference Promise and AggregateError as free names.',
  'Symbol.species reads stay a node-26 prototypeGap (phase6 w7 boundary): the @@species accessor is installed under key 0x60000027 but guest code can only reach it once Symbol.species is exposed.',
  'promise-ids.js SYMBOL_NODES.asyncIterator is 32, but phase3 well-known cells are 31 + index: asyncIterator = 31, hasInstance = 32 (shader.js phase3HasInstanceNode). Workers 6/7 must use 31.',
]);

export const promiseCombinatorsGaps = Object.freeze([
  'Promise.try (ES2025 27.2.4.8 in the 2025 edition numbering) has no reserved id (2813..2819 are parent spare); not implemented here.',
  'Subclassing: class X extends Promise / extends AggregateError and Reflect.construct with another NewTarget keep the construct() status-6 boundary; combinators called with a non-Promise C go through worker 1 NewPromiseCapability (plain constructor functions are supported).',
  'Promise.all/allSettled/any/race/resolve/reject/withResolvers/get [Symbol.species] are backing-less tag-11 functions: name/length are served by getProperty, other own-property reflection (getOwnPropertyDescriptor on the function, defineProperty on it) keeps the existing tag-11 status-6 boundary like phase5 builtins. Function.prototype.toString source text uses the shared native-function path only if the parent adds them to functionSourceWGSL methods.',
  'AggregateError instances carry no `stack` property (no engine has to); messages from Promise.any use the V8 text "All promises were rejected" (implementation-defined).',
  'get Promise[@@species] is installed but unreachable until Symbol.species is exposed (w7 boundary).',
]);

export const promiseCombinatorsReservations = Object.freeze({
  publicIds: [PROMISE_IDS.resolve, PROMISE_IDS.species], helperRange: PROMISE_HELPER_RANGES.worker4,
  intrinsicRange: PROMISE_INTRINSIC_RANGES.worker4, usedHelpers: Object.values(PROMISE_COMBINATOR_HELPER_IDS),
  usedIntrinsics: Object.values(AGGREGATE_ERROR_IDS), fixedNodes: Object.values(AGGREGATE_ERROR_NODES),
  heapKinds: [], continuations: [],
});
