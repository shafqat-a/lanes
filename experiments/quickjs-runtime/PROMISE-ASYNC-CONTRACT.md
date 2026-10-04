# Promise + async execution wave: worker contract

Exact numeric reservations live in `promise-ids.js` (parent-owned; workers import, never edit).
This file states the cross-worker *interfaces*. Anything not listed is private to its owner.

## Ground rules

- All guest semantics execute on the GPU: either as strict guest bootstrap helpers (JS source
  compiled by QuickJS, executed by the WGSL VM, like `stdlib-map-core.js`) or as WGSL
  intrinsics/opcode cases (like `generator-source.js`). The CPU only parses, packs, and runs
  test oracles. No host `Promise` is used for guest semantics; the host never replays guest work.
- Live core files (`shader.js`, `program.js`, `bootstrap.js`, `phase4-registry.js`,
  `phase4-class-elements.js`, `phase4-fixed-nodes.js`, `runtime.js`, `build-browser.mjs`,
  generator/stdlib sources) are NOT edited by workers. Each worker delivers new files plus an
  exported list of anchored integration edits; the parent composes them in
  `promise-integration-patch.js`, which applies on top of `generatorIntegrationPatch(...)`.
- Opcode and FIELDS lists are append-only. Never renumber.
- Allocation never collects implicitly mid-helper; a WGSL hook that must allocate a bounded
  number of nodes collects at the start of the instruction while every live value is still on
  the stack (same rule as `generatorSuspend`). Exhaustion = status 3 (resource limit).
- WGSL call graph must stay acyclic (no recursion). A WGSL hook that needs to run guest code
  either installs a frame (like `generatorResume`) or defers dispatch to `main()` through an
  internal status code (like status 9).

## Integration edit format (every worker exports one)

```js
export const <name>IntegrationEdits = [
  { file: 'shader.js', anchor: '<exact unique substring in the post-generator-patch file>',
    position: 'before' | 'after' | 'replace', text: '<inserted text>' , why: '...'},
];
```
Anchors must match exactly once in the file produced by `generatorIntegrationPatch(live, {iteratorPrototypeNode:77})`.
Prefer anchors in stable places (function signatures, `${phase4Finish...}`, the `default: { states[l].status=2u; }`
dispatch tail, the status-9 block in main, the generator hooks). Several workers may need the same
anchor: use `position:'before'`/`'after'` text that is independent of order.

## Promise object (worker 1)

Ordinary object, tag 4, heap kind 2, `value=(prototype,0,header,extensible)`; header kind 64:
`value` = result (undefined while pending), `key` = owning object node, `next` = first reaction
cell (kind 65) while pending, 0 after settlement. `marked` bits 4..5 = state (0 pending,
1 fulfilled, 2 rejected); bit 6 = [[PromiseIsHandled]]. GC marks object→header, header→value,
header→reaction cells, cell→reaction value.

WGSL functions exported by worker 1 (other workers may call them in WGSL):
- `promiseAllocate(l:u32, proto:u32) -> u32` — new pending promise object node (0 + status 3 on exhaustion).
- `promiseHeaderOf(l:u32, v:V) -> u32` — header node or 0 if `v` is not a promise.
- `promiseSettleHeader(l:u32, header:u32, state:u32, value:V)` — pending only; enqueues one
  type-1 job per reaction in the matching list, in registration order, via worker 7's `jobEnqueue`.

Guest-callable private intrinsics (names are the bootstrap identifiers):
| id | name | contract |
|---|---|---|
| 2840 | `__lanesPromiseCreate(proto)` | object proto → used; otherwise %Promise.prototype% (node 91). Returns pending promise. |
| 2841 | `__lanesPromiseState(v)` | -1 not a promise, 0 pending, 1 fulfilled, 2 rejected. Never throws. |
| 2842 | `__lanesPromiseResult(p)` | settled value/reason (undefined if pending). |
| 2843 | `__lanesPromiseSettle(p, state, value)` | FulfillPromise/RejectPromise (state 1/2). Internal error if not pending. |
| 2844 | `__lanesPromiseAddReaction(p, fulfillReaction, rejectReaction)` | append to both lists (pending only). |
| 2845 | `__lanesPromiseMarkHandled(p)` | set [[PromiseIsHandled]]. |
| 2846 | `__lanesPromiseIsHandled(p)` | boolean. |

Guest helpers (worker 1): 2820 `__promiseCreateResolvingFunctions(promise)` → `[resolve, reject]`
(arrow closures sharing one alreadyResolved record; resolve calls worker 2's 2825);
2821 `__promiseNewCapability(C)` → `{promise, resolve, reject}` (NewPromiseCapability incl.
GetCapabilitiesExecutor and IsConstructor/IsCallable TypeErrors); 2801 construct helper.

## Resolution (worker 2)
2825 `__promiseResolveBody(promise, resolution)` — Promise Resolve Functions steps after the
alreadyResolved guard (self-resolution TypeError, non-object fulfill, Get `then` abrupt → reject,
callable → enqueue job type 2, else fulfill).
2826 `__promiseResolveThenableJob(promise, thenable, then)` — job body.
2827 `__promiseResolve(C, x)` — PromiseResolve abstract op (IsPromise + `x.constructor === C` fast return).

## Reactions (worker 3)
Reaction record = null-prototype guest object `{capability, type, handler}`; `capability` is
`undefined` or a capability record, `type` 0 fulfill / 1 reject, `handler` callable or `undefined`.
2830 `__promisePerformThen(promise, onFulfilled, onRejected, capability)` (returns capability.promise or undefined).
2831 `__promiseReactionJob(reaction, argument)` — job body.
Async workers (5/6/7) do NOT extend the reaction format: to resume an activation they pass guest
arrow closures as `onFulfilled/onRejected` that call their own resume intrinsic.

## Jobs (worker 7)
FIFO rooted at fixed node 92 (kind 72 `value=(head,tail,count,totalRun)`). Job cell kind 73:
`value` = payload A, `key` = payload cell (kind 67: `value` = payload B, `key` = job type,
`next` = payload C cell kind 67 or 0), `next` = next job.
Job types: 1 PromiseReactionJob(A=reaction, B=argument); 2 PromiseResolveThenableJob(A=promise,
B=thenable, C=then); 3 plain call A(B) with undefined receiver.
- WGSL: `jobEnqueue(l:u32, type:u32, a:V, b:V, c:V) -> bool` (false + status 3 on exhaustion).
- Guest: 2910 `__lanesEnqueueJob(type, a, b, c)`; 2911 `__promiseRunJob(type, a, b, c)` runner
  helper dispatches to 2831 / 2826 / call.
- Draining: when the outermost frame completes (finish with complete=true) and the queue is
  non-empty, status 10 defers to `main()`, which dequeues one job and calls 2911 with frame tail
  136; continuation 136 re-enters draining. When the queue is empty the run completes: if the
  top-level result is a promise, publish status 12/13/14 with value = fulfillment/reason/undefined;
  otherwise status 1 as today. An uncaught exception in a job is status 7.

## Async functions (worker 5)
QuickJS kind 2 packs with `ASYNC_KIND_BIT` (bit 19); kind 3 packs with bits 18|19. Await =
suspend activation (kinds 68..70), PromiseResolve(%Promise%, v), PerformPromiseThen with
closures that resume via a worker-5 intrinsic, and return the function's result promise to the
first caller. Exceptions crossing an async activation boundary are converted to rejection of the
result promise (status 11 defers the reject helper dispatch to `main()`).

## Host API (parent)
`QuickJSGPU#run(program, inputs, {promiseResults:'settle'})` / `job.step()` report per-lane
`settlements` (`'fulfilled'|'rejected'|'pending'|undefined`) from statuses 12/13/14. Without the
option, a promise result is an error exactly like any other object result. The host never runs
guest callbacks and never synthesizes settlement.
