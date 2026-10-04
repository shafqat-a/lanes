// Promise + async execution wave: shared reservations (parent-owned single
// source of truth). Workers import these constants and never edit this file.
//
// Wave reservation (coordinator): builtin ids 2800..2999, heap kinds 64..79,
// continuations 136..167, fixed nodes 90..105.
// Grok's RegExp wave independently owns ids 2600..2799, heap kinds 80..95,
// fixed nodes 86..89, continuations 120..135. Nothing here touches them.
//
// Existing owners that MUST NOT be reused: fixed nodes 1..85 (stdlib 66..71,
// generator 74/75 (+76 reserved), Iterator 77..79, native backing 80..85),
// heap kinds <= 63 (generator 56..58, collections 40..47, ...), continuations
// <= 119 (generator delegation 104..119), Unicode binding 5.

export const PROMISE_ID_FIRST = 2800, PROMISE_ID_LAST = 2999;
export const PROMISE_KIND_FIRST = 64, PROMISE_KIND_LAST = 79;
export const PROMISE_CONTINUATION_FIRST = 136, PROMISE_CONTINUATION_LAST = 167;
export const PROMISE_FIXED_FIRST = 90, PROMISE_FIXED_LAST = 105;
// RegExp (Grok) ranges, recorded only so the reserved-range machinery can
// assert disjointness and cover 86..89 in the fixed-node sweep exclusion.
export const REGEXP_ID_RANGE = Object.freeze([2600, 2799]);
export const REGEXP_KIND_RANGE = Object.freeze([80, 95]);
export const REGEXP_FIXED_RANGE = Object.freeze([86, 89]);
export const REGEXP_CONTINUATION_RANGE = Object.freeze([120, 135]);

// Fixed heap nodes, initialized in place by main() (kind != 0 => GC root;
// never on the free list). FIXED_RESERVED_LAST must grow from 85 to 105 so
// 86..105 are excluded from allocation/sweep (86..89 stay kind 0 until the
// RegExp wave initializes them; uninitialized reserved nodes are not roots).
export const PROMISE_NODES = Object.freeze({
  promiseCtor: 90,                 // kind 2, proto Function.prototype (3); objectView(V(2800,11)) <-> node 90 (worker 1)
  promiseProto: 91,                // kind 2, proto Object.prototype (1) (worker 1; then/catch/finally installed by worker 3)
  jobQueue: 92,                    // kind 72 queue header: value=(headJob, tailJob, count, totalRun) (worker 7)
  asyncFunctionProto: 93,          // kind 2, %AsyncFunction.prototype%, proto 3 (worker 5)
  asyncGeneratorFunctionProto: 94, // kind 2, %AsyncGeneratorFunction.prototype%, proto 3 (worker 6)
  asyncGeneratorProto: 95,         // kind 2, %AsyncGeneratorPrototype%, proto 96 (worker 6)
  asyncIteratorProto: 96,          // kind 2, %AsyncIteratorPrototype%, proto 1, [@@asyncIterator] (worker 7)
  asyncFromSyncIteratorProto: 97,  // kind 2, %AsyncFromSyncIteratorPrototype%, proto 96 (worker 7)
  aggregateErrorCtor: 98,          // kind 2, AggregateError ctor backing, proto Error ctor? see worker 4 notes
  aggregateErrorProto: 99,         // kind 2, AggregateError.prototype, proto Error.prototype (worker 4)
  // 100..105: parent spare (uninitialized, never allocated).
});

// Heap kinds 64..79.
export const PROMISE_KINDS = Object.freeze({
  // Worker 1 (Promise brand/state). A promise is an ordinary tag-4 object,
  // heap kind 2, value=(prototype, 0, header, extensible), header unflagged
  // in value.z exactly like the generator brand (kind 56).
  promiseHeader: 64,   // value = settled value/reason (undefined while pending), key = owning object node,
                       // next = first reaction cell (kind 65) while pending, 0 once settled.
                       // marked bits: bit0 GC, bits 4..5 state (0 pending, 1 fulfilled, 2 rejected), bit 6 [[PromiseIsHandled]].
  reactionCell: 65,    // value = reaction record (guest value V), key = 0 fulfill-list / 1 reject-list, next = next cell
  promiseSpare1: 66,
  jobPayload: 67,      // worker 7: value = payload V, key = job type (first payload cell only), next = next payload cell
  // Worker 5 (async functions).
  asyncHeader: 68,     // async activation header (same layout family as generator 56; distinct brand)
  asyncSaved: 69,      // saved operand cell (like 57)
  asyncThis: 70,       // saved receiver / result-promise slot (like 58)
  asyncSpare: 71,
  // Worker 7 (job queue).
  jobQueueHeader: 72,  // fixed node 92 only
  jobCell: 73,         // value = job record (guest value V), next = next job
  // Worker 6 (async generators).
  asyncGeneratorHeader: 74,
  asyncGeneratorRequest: 75, // queued {completion, capability}: value = request record (guest V), next = next request
  asyncGeneratorSaved: 76,
  asyncGeneratorSpare: 77,
  // Parent spare.
  parentSpare1: 78,
  parentSpare2: 79,
});

// Continuations 136..167 (frame.tail codes consumed by finish()).
export const PROMISE_CONTINUATIONS = Object.freeze({
  jobDone: 136,              // job-runner frame returned: discard result, drain next job (worker 7)
  jobSpare: 137,
  // 138..143 worker 5 (async functions)
  asyncFirst: 138, asyncLast: 143,
  // 144..151 worker 6 (async generators)
  asyncGeneratorFirst: 144, asyncGeneratorLast: 151,
  // 152..159 worker 7 (for-await / async-from-sync)
  asyncIterationFirst: 152, asyncIterationLast: 159,
  // 160..163 workers 1..4 (promise core, only if a WGSL-initiated guest call needs one)
  promiseFirst: 160, promiseLast: 163,
  // 164..167 parent spare
});

// VM status codes added by this wave. Existing: 0 running, 1 done, 2 invalid,
// 3 resource, 4 TypeError, 5 ReferenceError, 6 unsupported, 7 uncaught guest
// exception, 8 RangeError, 9 deferred IteratorClose dispatch.
export const PROMISE_STATUS = Object.freeze({
  drainJobs: 10,          // internal (never published): main() dequeues and dispatches the next job
  asyncReject: 11,        // internal (never published): exception crossed an async activation boundary; main() dispatches the reject helper
  resultFulfilled: 12,    // published: script completed, job queue empty, top-level result is a fulfilled promise; value = fulfillment value
  resultRejected: 13,     // published: ... rejected promise; value = rejection reason
  resultPending: 14,      // published: ... promise still pending with an empty job queue (never settles); value = undefined
});

// Public and private builtin ids (tag-11 values). Sub-ranges per worker.
export const PROMISE_IDS = Object.freeze({
  // Worker 1: constructor
  ctor: 2800, construct: 2801,
  // Worker 3: prototype methods
  then: 2802, catch: 2803, finally: 2804,
  // Worker 4: statics
  resolve: 2805, reject: 2806, all: 2807, allSettled: 2808, any: 2809, race: 2810, withResolvers: 2811, species: 2812,
  // 2813..2819 public spare
});
// Guest bootstrap helpers (strict functions compiled by QuickJS, run on GPU).
export const PROMISE_HELPER_RANGES = Object.freeze({
  worker1: [2820, 2824], // e.g. createResolvingFunctions, rejectPromise/fulfillPromise wrappers
  worker2: [2825, 2829], // resolve procedure, NewPromiseResolveThenableJob body
  worker3: [2830, 2834], // PerformPromiseThen, NewPromiseReactionJob body, finally thunks
  worker4: [2835, 2839], // GetPromiseResolve, combinator element functions, AggregateError helpers
});
// WGSL private intrinsics (trusted bootstrap only).
export const PROMISE_INTRINSIC_RANGES = Object.freeze({
  worker1: [2840, 2849], // brand/state/result/settle/reactions/handled
  worker2: [2850, 2854],
  worker3: [2855, 2859],
  worker4: [2940, 2949], // AggregateError construction / errors array install
});
export const ASYNC_ID_RANGES = Object.freeze({
  worker5: [2860, 2879],  // 2860 AsyncFunction identity (dynamic construction unsupported); await/settle helpers
  worker6: [2880, 2909],  // 2880 next, 2881 return, 2882 throw, 2883 AsyncGeneratorFunction identity, ...
  worker7: [2910, 2939],  // 2910 __lanesEnqueueJob, 2911 job runner helper, AsyncFromSync/AsyncIterator methods
  parent: [2950, 2999],
});

// Function-info word (image[f*2].w) bits: 0..15 refs, 16 hasPrototype,
// 17 global mode, 18 generator (GENERATOR_KIND_BIT). New:
export const ASYNC_KIND_BIT = 1 << 19; // QuickJS kind 2 (async) and kind 3 (async generator = bits 18|19)

// Well-known symbol keys (phase3 contract: key = 0x60000000 | cellNode).
// Cells are 31 + index in phase3-values.js WELL_KNOWN_NAMES.
export const SYMBOL_NODES = Object.freeze({ asyncIterator: 31, hasInstance: 32, iterator: 34, species: 39, toStringTag: 42 });
