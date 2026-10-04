// Promise + async wave, worker 2: Promise resolution procedure and thenable
// assimilation (ES2025 27.2.1.3.2 Promise Resolve Functions steps 7-16,
// 27.2.2.2 NewPromiseResolveThenableJob, 27.2.4.7.1 PromiseResolve).
//
// Guest code only: strict bootstrap helpers compiled by QuickJS as intrinsic
// roots and executed by the WGSL VM. No WGSL intrinsics are introduced (the
// 2850..2854 range stays unused). The host never evaluates these sources
// except inside the check-promise-resolve.mjs test oracle.
//
// Helper-to-helper calls: inside an intrinsic-root helper, a free identifier
// listed in bootstrap.js `privateBuiltins` is packed as capture spec
// [4,id] (program.js packProgram), i.e. the tag-11 builtin value V(id,0,11,0).
// Calling that value goes through shader.js call(): the `fnValue.z==11u`
// id->FIELDS table swaps it for closure(l, bootstrapFunctions[field]) so the
// callee is the other helper's guest closure (a normal GPU frame). Therefore a
// helper-callable helper needs BOTH (a) a privateBuiltins name->id entry and
// (b) an id->field entry in the shader call dispatch, plus (c) its source in
// bootstrapSources and (d) its field name in program.js FIELDS. Edits for all
// four are exported below. Plain intrinsic ids (2841/2843/2910) only need (a)
// and their owner's objectMethod/WGSL case. Nested functions inside a helper
// are NOT intrinsic roots and cannot see private names, so these helpers use
// none.
import { PROMISE_HELPER_RANGES, PROMISE_INTRINSIC_RANGES, ASYNC_ID_RANGES } from './promise-ids.js';

export const PROMISE_RESOLVE_IDS = Object.freeze({
  resolveBody: 2825,        // __promiseResolveBody(promise, resolution)
  resolveThenableJob: 2826, // __promiseResolveThenableJob(promise, thenable, then)
  promiseResolve: 2827,     // __promiseResolve(C, x)
  // 2828, 2829 spare; WGSL 2850..2854 unused.
});

// Job type for NewPromiseResolveThenableJob (PROMISE-ASYNC-CONTRACT.md "Jobs").
export const THENABLE_JOB_TYPE = 2;

// ---- sources -----------------------------------------------------------------

// Promise Resolve Functions, after worker 1's closure has checked and set
// alreadyResolved (steps 1-6). Spec steps:
//  7. SameValue(resolution, promise) -> RejectPromise(promise, new TypeError).
//     Both operands: promise is an object, so === is SameValue here.
//  8. resolution not an Object -> FulfillPromise(promise, resolution).
//  9. then = Completion(Get(resolution, "then")) -- exactly one observable Get.
// 10. abrupt -> RejectPromise(promise, then.[[Value]]).
// 12. IsCallable(thenAction) false -> FulfillPromise(promise, resolution).
//     typeof === "function" is exactly IsCallable for VM values (tags 5/11).
// 13-15. job = NewPromiseResolveThenableJob(promise, resolution, thenJobCallback);
//     HostEnqueuePromiseJob -> __lanesEnqueueJob(2, promise, resolution, then).
//     HostMakeJobCallback is the identity record (no host-defined data).
// 16. return undefined.
export const promiseResolveBodySource = `function promiseResolveBodyBootstrap(promise, resolution) {
  "use strict";
  if (resolution === promise) {
    __lanesPromiseSettle(promise, 2, new TypeError("Chaining cycle detected for promise"));
    return undefined;
  }
  if (resolution === null || (typeof resolution !== "object" && typeof resolution !== "function")) {
    __lanesPromiseSettle(promise, 1, resolution);
    return undefined;
  }
  let then;
  try {
    then = resolution.then;
  } catch (error) {
    __lanesPromiseSettle(promise, 2, error);
    return undefined;
  }
  if (typeof then !== "function") {
    __lanesPromiseSettle(promise, 1, resolution);
    return undefined;
  }
  __lanesEnqueueJob(2, promise, resolution, then);
  return undefined;
}`;

// NewPromiseResolveThenableJob job closure body (27.2.2.2 step 1):
//  a. resolvingFunctions = CreateResolvingFunctions(promise)  (worker 1, 2820)
//  b. thenCallResult = Completion(HostCallJobCallback(then, thenable, <<resolve, reject>>))
//  c. abrupt -> Return ? Call(resolvingFunctions.[[Reject]], undefined, <<value>>)
//     (the fresh reject respects its own alreadyResolved record, so a throw
//     after the thenable already called resolve/reject is ignored).
//  d. Return ? thenCallResult -- the runner (worker 7) discards it.
// resolve/reject are read into locals and called as plain calls, so their
// receiver is undefined exactly as in the spec.
export const promiseResolveThenableJobSource = `function promiseResolveThenableJobBootstrap(promise, thenable, then) {
  "use strict";
  const resolvingFunctions = __promiseCreateResolvingFunctions(promise);
  const resolve = resolvingFunctions[0];
  const reject = resolvingFunctions[1];
  let result;
  try {
    result = __lanesCall(then, thenable, resolve, reject);
  } catch (error) {
    return reject(error);
  }
  return result;
}`;

// PromiseResolve(C, x) (27.2.4.7.1):
//  1. IsPromise(x) ([[PromiseState]] slot) -> __lanesPromiseState(x) >= 0.
//     a. xConstructor = ? Get(x, "constructor") -- one observable Get, abrupt propagates.
//     b. SameValue(xConstructor, C) -> return x. C is always an Object at every
//        call site (Promise.resolve checks Type(C), await passes %Promise%), so
//        === is SameValue.
//  2. promiseCapability = ? NewPromiseCapability(C)   (worker 1, 2821)
//  3. ? Call(promiseCapability.[[Resolve]], undefined, <<x>>)
//  4. return promiseCapability.[[Promise]]
// The capability record is a guest object produced by worker 1 (own data
// properties promise/resolve/reject), so reading it is not user-observable.
export const promiseResolveSource = `function promiseResolveBootstrap(C, x) {
  "use strict";
  if (__lanesPromiseState(x) >= 0) {
    const xConstructor = x.constructor;
    if (xConstructor === C) return x;
  }
  const capability = __promiseNewCapability(C);
  const resolve = capability.resolve;
  resolve(x);
  return capability.promise;
}`;

// FIELDS names (append-only; distinct from any public property name so the
// `if(!fieldNames.includes(name))` merge in program.js can never alias them).
export const promiseResolveSources = Object.freeze({
  promiseResolveBody: promiseResolveBodySource,
  promiseResolveThenableJob: promiseResolveThenableJobSource,
  promiseResolveAbstract: promiseResolveSource,
});
export const promiseResolveFields = Object.freeze(Object.keys(promiseResolveSources));

export const promiseResolveMetadata = Object.freeze([
  Object.freeze({ id: 2825, name: '__promiseResolveBody', field: 'promiseResolveBody', length: 2, kind: 'helper', spec: 'ES2025 27.2.1.3.2 steps 7-16' }),
  Object.freeze({ id: 2826, name: '__promiseResolveThenableJob', field: 'promiseResolveThenableJob', length: 3, kind: 'job', spec: 'ES2025 27.2.2.2 step 1' }),
  Object.freeze({ id: 2827, name: '__promiseResolve', field: 'promiseResolveAbstract', length: 2, kind: 'helper', spec: 'ES2025 27.2.4.7.1' }),
]);

// id -> FIELDS name for the shader call() tag-11 dispatch (same shape as
// generatorDelegationBuiltinFields / phase4BuiltinFields).
export const promiseResolveBuiltinFields = Object.freeze(Object.fromEntries(promiseResolveMetadata.map(m => [m.id, m.field])));

// privateBuiltins entries OWNED by this worker (name -> id). Exported so other
// helpers (worker 1's resolve closure owner, worker 4's Promise.resolve,
// worker 5's await, worker 7's job runner) can call these by private name.
export const promiseResolveHelperNames = Object.freeze(Object.fromEntries(promiseResolveMetadata.map(m => [m.name, m.id])));

// Every private name referenced by the sources, with its owner. Entries owned
// by other workers are registered by them; listed here so the check can verify
// the sources reference nothing undeclared.
export const promiseResolveDependencies = Object.freeze({
  __lanesPromiseState: { id: 2841, owner: 'worker 1 (WGSL intrinsic)' },
  __lanesPromiseSettle: { id: 2843, owner: 'worker 1 (WGSL intrinsic)' },
  __promiseCreateResolvingFunctions: { id: 2820, owner: 'worker 1 (guest helper; returns [resolve, reject])' },
  __promiseNewCapability: { id: 2821, owner: 'worker 1 (guest helper; returns {promise, resolve, reject})' },
  __lanesEnqueueJob: { id: 2910, owner: 'worker 7 (WGSL intrinsic)' },
  __lanesCall: { id: 113, owner: 'existing bootstrap.js privateBuiltins' },
});
export const promiseResolveIntrinsics = Object.freeze({
  ...Object.fromEntries(Object.entries(promiseResolveDependencies).map(([name, { id }]) => [name, id])),
  ...promiseResolveHelperNames,
});

// Sanity: ids live in the reserved worker-2 helper range.
for (const { id } of promiseResolveMetadata) {
  const [lo, hi] = PROMISE_HELPER_RANGES.worker2;
  if (id < lo || id > hi) throw new Error(`promise-resolve id ${id} outside worker-2 range`);
}
if (promiseResolveDependencies.__lanesEnqueueJob.id !== ASYNC_ID_RANGES.worker7[0]) throw new Error('enqueue id drift');
if (PROMISE_INTRINSIC_RANGES.worker2[0] !== 2850) throw new Error('worker-2 intrinsic range drift');

// ---- integration (anchors in the generatorIntegrationPatch(live,{iteratorPrototypeNode:77}) output)
export const promiseResolveIntegrationEdits = Object.freeze([
  { file: 'bootstrap.js',
    anchor: "import { phase4BootstrapSources, phase4PrivateBuiltins, protocolBootstrapSources } from './phase4-registry.js';",
    position: 'after',
    text: "\nimport { promiseResolveSources, promiseResolveHelperNames } from './promise-resolve-source.js';",
    why: 'import worker-2 helper sources and private names' },
  { file: 'bootstrap.js',
    anchor: '  ...phase3BigintConversionIntrinsics,',
    position: 'before',
    text: '  ...promiseResolveHelperNames,\n',
    why: 'privateBuiltins: __promiseResolveBody 2825, __promiseResolveThenableJob 2826, __promiseResolve 2827 (callable by name from other intrinsic-root helpers)' },
  { file: 'bootstrap.js',
    anchor: '  ...generatorDelegationSources,',
    position: 'after',
    text: '\n  ...promiseResolveSources,',
    why: 'bootstrapSources: compile the three helpers as intrinsic roots' },
  { file: 'program.js',
    anchor: 'export const FIELDS =',
    position: 'before',
    text: "for(const name of ['promiseResolveBody','promiseResolveThenableJob','promiseResolveAbstract'])if(!fieldNames.includes(name))fieldNames.push(name);\n",
    why: 'append-only FIELDS slots for the helper closures (literal list keeps program.js import-free)' },
  { file: 'shader.js',
    anchor: "import {generatorGCWGSL,generatorClosureWGSL,generatorInitWGSL,generatorMetadata} from './generator-source.js';",
    position: 'after',
    text: "\nimport { promiseResolveBuiltinFields } from './promise-resolve-source.js';",
    why: 'import id->field dispatch table' },
  { file: 'shader.js',
    anchor: '    if(fnValue.x==960u){field=${F.numberPow}u;}',
    position: 'before',
    text: "    ${Object.entries(promiseResolveBuiltinFields).map(([id,field])=>`if(fnValue.x==${id}u){field=${F[field]}u;}`).join('\\n    ')}\n",
    why: 'call(): tag-11 ids 2825..2827 dispatch to their bootstrap helper closures' },
]);

export const promiseResolvePending = Object.freeze([
  'Depends on worker 1 (2820 __promiseCreateResolvingFunctions returning an indexable [resolve, reject]; 2821 __promiseNewCapability returning {promise, resolve, reject}; 2841 __lanesPromiseState; 2843 __lanesPromiseSettle) and worker 7 (2910 __lanesEnqueueJob, job type 2 runner calling 2826 with (A=promise, B=thenable, C=then)). Until those land the helpers compile and pack but cannot execute.',
  'Worker 1 resolve closure must call __promiseResolveBody(promise, resolution) as a plain call (receiver irrelevant) only after setting alreadyResolved; its return value is ignored.',
  'Get(resolution, "then") on a tag-11 builtin function value (e.g. resolve(Math.max)) goes through the builtin getProperty path, which reports status 6 for names it does not model; spec result is undefined -> fulfill. Pre-existing VM gap, not introduced here.',
  'HostPromiseRejectionTracker is not modelled (no unhandled-rejection reporting); [[PromiseIsHandled]] is maintained by worker 3.',
  'Realm/HostMakeJobCallback host-defined data is the identity (single realm).',
]);
