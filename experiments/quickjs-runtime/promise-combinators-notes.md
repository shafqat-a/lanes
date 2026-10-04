# Worker 4: Promise combinators + AggregateError

Files: `promise-combinators-source.js` (guest sources, metadata, WGSL, edits),
`promise-combinators-cases.js` (70 fixtures), `check-promise-combinators.mjs` (host oracle).

## Ids
| id | kind | name / field |
|---|---|---|
| 2805..2811 | public, tag 11 on node 90 | resolve, reject, all, allSettled, any, race, withResolvers -> fields `promiseResolveStatic`, `promiseRejectStatic`, `promiseAll`, `promiseAllSettled`, `promiseAny`, `promiseRace`, `promiseWithResolvers` |
| 2812 | public getter | `get [Symbol.species]` (WGSL: returns receiver), accessor key `0x60000027` (well-known cell 39) |
| 2835 | guest helper | `__promiseGetResolve(C)` field `promiseGetResolve` |
| 2836 | guest helper | `__promiseListToArray(list,count)` field `promiseListToArray` (CreateArrayFromList via 1861) |
| 2837 | guest helper | `__promiseAggregateError(list,count)` field `promiseAggregateError` |
| 2940 | public ctor | AggregateError, V(2940,0,11,0) <-> node 98, field `aggregateErrorConstruct` |
| 2941 | WGSL intrinsic | `__lanesAggregateErrorCreate()` = `makeError(l,95u,..)` (kind-8 object, [[Prototype]] node 99) |

Nodes 98 (ctor backing, proto node 11 = %Error%; length 2, name, prototype) and 99
(proto node 4 = %Error.prototype%; constructor, message "", name "AggregateError").
No heap kinds, no continuations.

## Spec order (verified against ES2025 27.2.4.1)
NewPromiseCapability(C) (synchronous TypeError) -> GetPromiseResolve(C) (one Get; abrupt
rejects, no iterator yet) -> GetIterator -> loop. IteratorStepValue abrupt ([[Done]] true)
rejects without close; Call(promiseResolve, C, next) / Invoke(nextPromise,"then") abrupt
closes via `__lanesIteratorCloseThrow` (original error wins) then rejects. Reject throwing
propagates synchronously. `any` with zero remaining on DONE rejects with AggregateError
without closing. Iteration uses the live generic IteratorRecord helpers 1270/1271/2440
directly (not guest for-of).

Element functions are inline arrows (length 1, name "", no prototype, not constructors);
nested closures use only root locals and `void 0` (private names / globals resolve only in
the root; the check asserts nested functions have no type-3 refs).

## Dependencies
- worker 1: `__promiseNewCapability` 2821 (`{promise,resolve,reject}`), node 90 initialized
  BEFORE `promiseCombinatorsInitWGSL` (same anchor; apply worker 4 edit after worker 1),
  objectView 2800 <-> 90, Promise global. Worker 1's `__lanesPromiseIsConstructor` and
  worker 3's `promiseThenIsConstructor` should learn 2940 if AggregateError is to be a
  valid constructor/species for them.
- worker 2: `__promiseResolve` 2827.
- worker 3: then (fixtures); worker 7: job draining + statuses 12/13/14 (GPU execution).
- parent: FIXED_RESERVED_LAST >= 99; apply `promiseCombinatorsIntegrationEdits` (17 edits,
  incl. program.js classic capture `AggregateError -> [4,2940]`, phase4-global.js binding
  and removal from `globalUnimplementedNames`).

## Discrepancy found
`promise-ids.js` `SYMBOL_NODES.asyncIterator = 32` is wrong: well-known cells are
`31 + phase3WellKnownNames.indexOf(name)`, so asyncIterator = 31, hasInstance = 32
(`shader.js phase3HasInstanceNode`), species = 39.

## Evidence (`node check-promise-combinators.mjs`)
140 native-oracle checks (70 fixtures x 2 inputs, real microtask draining), 145 model
checks (same fixtures with this worker's guest helpers + live iterator helpers + worker
1/2 real sources, only WGSL intrinsics modeled; exact equality with native), 81
native/Wasm bytecode parity programs, 11 helpers packed by live packProgram (worker-wave
private names aliased to `__lanesCall`), WGSL lint, 17 anchors unique in the
generator-patched files and applied in memory. Not executed on GPU; not integrated.

## Gaps
- Promise.try (ES2025) has no reserved id; not implemented.
- Subclassing (`extends Promise/AggregateError`, Reflect.construct NewTarget) stays status 6.
- Statics are backing-less tag-11 functions: name/length via getProperty; other reflection
  on the function objects keeps the existing tag-11 status-6 boundary.
- `Promise[Symbol.species]` is installed but `Symbol.species` itself is still a node-26 gap
  (w7 boundary); worker 3's SpeciesConstructor does reach it internally.
- Promise.any's AggregateError message uses V8's text "All promises were rejected"
  (implementation-defined).
- Fixture user programs are compile-checked only (they need the Promise/AggregateError
  globals that integration adds before they can pack).
