# Promise + async execution: integration status

Status: **integrated in the shared runtime; host-verified, not GPU-verified.**

The coordinator integrated the guarded recipe after generators, standard-library helpers,
Array.from, groupBy/species, and BigInt power/width support. No compiler rebuild was needed.
The recipe detects already-installed generators and preserves every existing field/opcode;
calling it on the fully integrated async tree is a no-op. A partial installation is rejected.
The main browser build must bundle `browser-promise.js` directly; the legacy private-preview
builder is unnecessary for qualification. All eight worker fixture modules are static imports,
and a complete run requires exactly 578 records before executing anything.

Latest composed checks: 578/578 native/Wasm packed programs, 251 bootstrap helpers,
274 acyclic WGSL functions, 160 existing opcodes and 512 fields preserved (+5/+57).
Seven additional mock-device tests cover fulfilled/rejected UTF-16 and BigInt output,
pending settlement, opt-in, output-boundary errors, and cleanup. These are host checks,
not evidence of GPU execution. The root coordinator owns M1 qualification.

## Exact reservations (promise-ids.js, reserved-ranges.js)

Wave ranges: builtin ids 2800..2999, heap kinds 64..79, continuations 136..167, fixed nodes 90..105.
RegExp (Grok) keeps ids 2600..2799, kinds 80..95, fixed 86..89, continuations 120..135.
`reserved-ranges.js` records every wave's owner and asserts disjointness. `FIXED_RESERVED_LAST` grows
85 → 105, so 86..105 are never allocated or swept (uninitialized nodes stay unrooted kind 0).

| Space | Assignment |
|---|---|
| Fixed nodes | 90 %Promise% backing, 91 %Promise.prototype%, 92 job queue header (kind 72), 93 %AsyncFunction.prototype%, 94 %AsyncGeneratorFunction.prototype%, 95 %AsyncGeneratorPrototype%, 96 %AsyncIteratorPrototype%, 97 %AsyncFromSyncIteratorPrototype%, 98 AggregateError backing, 99 AggregateError.prototype; 100..105 spare |
| Heap kinds | 64 promise header, 65 reaction cell, 66 spare, 67 job payload, 68/69/70 async activation header/saved operand/receiver+promise, 71 spare, 72 job queue header, 73 job cell, 74/75/76/77 async generator header/request/saved operand/aux, 78/79 spare |
| Continuations | 136 job done; 152..154 for-await; 137..151, 155..167 reserved unused |
| Statuses | 10 drain jobs (internal), 11 async reject (internal), 12 fulfilled, 13 rejected, 14 pending (published) |
| Function info | bit 19 async (kind 2); kind 3 = bits 18 and 19 |
| Ids | 2800 Promise, 2801 construct, 2802..2804 then/catch/finally, 2805..2811 statics, 2812 get @@species; 2820/2821 resolving functions/NewPromiseCapability; 2825..2827 resolve body/thenable job/PromiseResolve; 2830..2832 PerformPromiseThen/reaction job/SpeciesConstructor; 2835..2837 combinator helpers; 2840..2847 promise intrinsics; 2855/2856 species symbol/IsConstructor; 2860 %AsyncFunction%, 2861/2862 await/return helpers, 2870 async resume; 2880..2883 async generator next/return/throw/%AsyncGeneratorFunction%, 2884..2895 async generator intrinsics/helpers; 2910 enqueue job, 2911 job runner, 2912..2915 and 2920 async iteration; 2940/2941 AggregateError |
| Symbols | asyncIterator cell 31, hasInstance 32, iterator 34, species 39, toStringTag 42 |

Deviations from the original contract, adopted by the parent: worker 5 rejects the async result
promise directly in WGSL for status 11 (no guest reject helper runs); `jobEnqueue` names its type
parameter `jobType` (`type` is reserved in WGSL); promise header state lives in `marked` bits 4..5.

## Host API: waiting for guest async results

```js
const result = await runtime.run(program, inputs, { promiseResults: 'settle' });
// result.settlements[i]: 'fulfilled' | 'rejected' | 'pending' | undefined (non-promise result)
// result.values[i]: fulfillment value or rejection reason (decoded like any completion value)
```
The GPU runs the script, then drains the guest job queue (status 10 is internal and resumable at any
instruction boundary across `job.step(budget)` calls), then publishes status 12/13/14 for a
promise result. `'pending'` means the queue is empty and the promise can never settle; it is
reported, never faked. Without the option, a settled promise result is an error. Object
values/reasons still cannot cross the boundary (same TypeError as any object result). The host never
runs guest callbacks, never uses a host Promise for guest semantics, and never replays work on CPU.
`start()` takes the same option; `step()` reports `settlements`.

## Verification performed (host only)

`node check-promise-integration.mjs` (composed tree in a private preview): reserved ranges disjoint,
FIXED_RESERVED_LAST 105, 153 opcodes and 401 FIELDS unchanged (+12 opcodes, +65 FIELDS appended),
261 uniquely defined WGSL functions with an acyclic call graph and no reserved identifiers or template
residue, statuses 10/11 handled, fixed nodes 90..99 initialized in place, 169 bootstrap helpers
compiled, **578/578 fixtures pack identically from the native and Wasm compilers**, and the host
settlement API passes against a mock device (fulfilled/rejected/pending, opt-in required).

Per-worker checks (each passes): check-promise-core, check-promise-resolve, check-promise-then,
check-promise-combinators, check-async-functions, check-async-generators, check-promise-jobs,
check-async-iteration (node native oracle with real job draining, native/Wasm parity, WGSL lint,
anchor uniqueness, isolated previews). check-promise-conformance: 115 independent fixtures plus
cross-check of all 8 sibling case modules against node. check-generator-integration still passes.

**Not verified:** WGSL compilation on any device, GPU execution, real GC collections in pressure
fixtures, single-instruction resumption, tick order on GPU. These require the coordinator's M1 Safari
run of `generated/promise.html` (default: all fixtures, GC fixtures must record collections,
resumption fixtures stepped one instruction at a time, resource fixtures must report status 3;
`?coreOnly=1` is explicitly not qualified).

## Remaining gaps (exact)

- Subclassing: `class X extends Promise/AggregateError`, `Reflect.construct` with a foreign NewTarget
  stay the status-6 built-in-parent boundary (construct() cannot pass NewTarget to tag-11 helpers);
  normative outcomes kept in `promiseCoreBoundaryCases`.
- Symbol.species is now admitted by the preceding standard-library integration. Custom-species fixtures remain required positive checks when the constructor is otherwise supported.
- `Promise.try` (ES2025) is not implemented (no id assigned; 2813..2819 spare).
- Host rejection tracker / unhandled-rejection reporting is not modelled (a rejected top-level promise
  publishes status 13).
- An uncaught exception inside a job (only possible for job type 3 or a throwing custom capability
  function) ends the lane with status 7; a real host would report and continue draining.
- Dynamic `AsyncFunction(...)`/`AsyncGeneratorFunction(...)` construction: status 6. Async generator
  class methods remain rejected by the class-element admission.
- Reflection on tag-11 Promise/static functions beyond name/length (`getOwnPropertyNames(Promise)`,
  descriptors, defineProperty) keeps the existing tag-11 status-6 boundary.
- Resolving with a builtin function value (e.g. `resolve(Math.max)`) hits the existing tag-11 `then`
  lookup boundary (status 6).
- Resources: heap 2048 nodes, 32 frames, 256 stack slots. A pending `then` costs roughly 20..30 nodes
  (estimate), so about 70..90 concurrently pending reactions per lane; settling with many reactions or
  deep synchronous async recursion reports status 3, as encoded by the resource fixtures.
- Async-from-sync next() throwing / non-object result / throwing value getter: fixtures follow the
  ES2025 text (no close); node 26 closes the sync iterator. Both values are recorded in the fixtures.
- QuickJS's inline for-await `return` path in async generators checks object-ness before awaiting
  (ES2025 awaits first); bytecode belongs to the compiler and is unchanged.
- test262: 415 Promise files need the `$DONE`/`flags:[async]` harness, which is not adapted yet.

See promise-review.md (worker 8) for the review of ordering, reentrancy, GC and resource risks, and
each worker's `*-notes.md` for design details.

## Resolution of the early worker review

The six highest-risk observations in `promise-review.md` describe an earlier contract.
The final integrated recipe copies string/BigInt payloads for statuses 12/13, decodes
settlements only with explicit host opt-in, masks internal statuses 10/11 as running and
resumes them, keeps the top-level result rooted while jobs execute in frame depth one or
higher, traces queue heads/tails and payload cells, and reserves nodes through 105.
Settlement can allocate three nodes per reaction; collection occurs while operands are
still rooted, and exhaustion reports Resource rather than silently completing. This remains
a bounded implementation, not a claim of unlimited pending reactions.

The three async-from-sync close discrepancies have exact native alternative values and
ES2025 rationale in fixture metadata. Browser qualification still requires the fixed
normative GPU values; unexpected native outcomes fail.
