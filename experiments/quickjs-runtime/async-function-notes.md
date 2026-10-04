# Worker 5: async functions (QuickJS kind 2)

Status: WGSL hooks, guest helpers, integration edits, fixtures and a host check are staged in new files.
Live core files are unchanged. Host checks pass. GPU compilation and execution have **not** run.
Files: `async-function-source.js`, `async-function-cases.js`, `check-async-functions.mjs` (this note).

## Compiler facts (probed with the Wasm and native bridges)
- Async functions, arrows, object/class/static/private methods compile as kind 2, `hasPrototype` 0.
- Kind-2 bytecode uses `await` and `return_async`, plus ordinary opcodes. It never uses `return`,
  `return_undef`, `tail_call*` or `initial_yield`, and the check asserts this for every fixture. QuickJS has no
  initial suspension: the body, including parameter defaults, runs synchronously in the call.
- At `await`, the awaited value is on top of the stack. On fulfilment the resume value replaces it. On rejection
  the exception is thrown at that pc. `try`/`finally` state (catch markers, gosub return addresses,
  pending completions) is ordinary operand-stack content.

## Representation
- Header kind 68: `value=(savedPc, env, firstSavedCell, state)`, `key`=result promise P, `next`=this slot.
- Kind 69: saved operand (`value`=V, `key`=index). Kind 70: the frame receiver at suspension.
- Activation env (kind 4): `key` = header id. This brand is not otherwise used for kind-4 nodes. `value.z/w` is left
  alone because `classSpecialObject` reads `value.w` as the new.target tag. Header `value.y` must point
  back at the env. On completion the brand is cleared.
- States: 2 executing, 1 awaiting, 3 completed.
- The awaiting token handed to helpers is `V(header,0,4,0)`, an opaque internal value. Only trusted bootstrap
  helpers and their closures ever hold it.
- Function info word: bit 19 (`0x80000`) for kind 2. `asyncFunction()` requires `(w & 0xC0000) == 0x80000`, so
  kind-3 async generators (bits 18|19) are excluded.

## Control flow
- **Call** (call() hook after env/argument binding, before the frame push): `asyncEnter` allocates P via
  `promiseAllocate(l,91)`, the this slot and the header, then brands the env. The body runs in the caller's
  instruction stream.
- **await** (`asyncAwait`): if `freeCount < saved+40`, collect first (the awaited value and the whole segment are
  still rooted). Then pop the value and save the segment, receiver and pc. Next, `asyncReplaceFrame` replaces the
  activation frame *in place* with a call to helper 2861 `asyncFunctionAwait(token, value, P)`. The helper frame
  inherits the activation's return pc, base, tail flag/continuation code and continuation data, so the helper's
  return value (P) goes to the activation's caller exactly as if the activation had returned it. The helper:
  - runs `PromiseResolve(%Promise%, v)` (2827). If that is abrupt, it calls `__lanesAsyncResume(token,1,e)`
    synchronously, which throws *into* the activation at the await point (the spec's `?`), and the function can
    catch it. QuickJS rejects P instead; we follow the spec.
  - otherwise calls `PerformPromiseThen(p, v=>resume(token,0,v), r=>resume(token,1,r), undefined)` (2830). This
    gives 1 tick for a native promise or a non-promise, and 2 ticks for a thenable that calls back synchronously.
  - returns P.
- **Resume** (2870 `__lanesAsyncResume`, handled by a call() hook): this works like `generatorResume`. It checks
  the frame-depth and stack limits (status 3), installs a frame on top of the caller with the saved
  env/pc/receiver, and restores the segment. Then it either pushes the value or calls `raise` at the await pc.
  It never allocates. The closures ignore the return value. Reactions have no capability, so the handler result
  is discarded.
- **return_async** (case override): if the current env is an executing activation, `asyncReturn` runs.
  Otherwise the generator/plain `finish` path runs.
  - Primitive results: `promiseSettleHeader(P,1,v)` and then `finish(P)`. This is unobservably identical to calling
    the resolve function.
  - Object, function or builtin results: frame replacement with helper 2862 `asyncFunctionResolveReturn(P, v)`,
    which runs `__promiseResolveBody` (2825) and returns P. This makes thenables resolve rather than fulfil, and
    the `then` Get is synchronous and observable.
- **Uncaught exception**: the `raise()` scan stops when it reaches the base of an *executing* activation frame.
  This check comes before the tail-40 record clearing and the generator unwind hook, so a rejected async `next`
  never looks like a throwing `next`. `asyncRaiseBoundary` closes the activation, leaves P and the reason on the
  live stack, and sets internal status 11. `raise` cannot call `finish` because that would recurse through
  continuation 80. `asyncRejectDispatch` in `main()` runs `promiseSettleHeader(P,2,reason)` and then
  `finish(P)`. Rejection runs no guest code, so no guest reject helper is needed. The dispatch is placed twice:
  before the status-4/5/8 conversion block (status 11 from an opcode) and before the status-9 block (status 11
  from a converted VM error). That way a status 4 or 9 produced by `finish` in the first dispatch is still handled.
- Continuations 138..143 are **unused** and stay reserved.

## Invariants
- WGSL call graph is acyclic (checked over the full composed shader: 222 functions with generator+worker 5,
  261 with all wave workers). New edges: call→asyncEnter/asyncResume→raise; main→asyncRejectDispatch→finish;
  return_async/await cases→asyncReplaceFrame→call.
- Only executing activation frames carry a branded env. While suspended, the frame no longer exists because the
  helper replaced it.
- No allocation path collects implicitly. `asyncAwait`, `asyncReturn` and `asyncRejectDispatch` collect only at
  their start while every live value is on the stack. Exhaustion is status 3.
- GC: env→header (via `key`), header→env/saved list/P, cells→value, generic `next` covers the this slot and the
  saved chain, and closures hold the token. An activation awaiting a promise that nobody can settle is
  unreachable and is collected (correct: it can never resume). The top-level P stays rooted through `result`.

## Resource limits
- Frames: every synchronous nested async call takes a frame. A resumption adds one frame above the job runner →
  reaction job → closure. Exceeding `LIMITS.frames` (32) gives status 3 (fixture
  `deep-sync-recursion-resource-limit`, `gpuOutcome:'resource'`).
- Settling P enqueues one job (3 nodes) per matching reaction. Heap exhaustion gives status 3.

## Function objects
- Closures with bit 19 get [[Prototype]] = fixed node 93 %AsyncFunction.prototype% (proto 3,
  `constructor` = 2860 and @@toStringTag "AsyncFunction", both configurable only). They have no `prototype`
  property, and `new` on them is a TypeError (hasPrototype 0).
- 2860 %AsyncFunction% has name "AsyncFunction", length 1, and prototype node 93. Calling or constructing it gives
  status 6 (dynamic code unsupported), and so does reading any other property.

## Dependencies
- Worker 1: `promiseAllocate`, `promiseHeaderOf`, `promiseSettleHeader`, `promiseMatchingReactions` (WGSL);
  id 2800 for %Promise%.
- Worker 2: 2827 `__promiseResolve`, 2825 `__promiseResolveBody`.
- Worker 3: 2830 `__promisePerformThen`.
- Worker 7: job queue/draining, statuses 12/13/14.
- Parent: `FIXED_RESERVED_LAST >= 93` (node 93 is written in place).
- Worker 6: `await` opcode, the OP entry and lowering are owned here. Kind 3 is excluded by the bit test. The
  return_async override only takes the async path for branded kind-2 envs.
- Worker 7: for-await reuses `await`.

## Validation (host only)
`node experiments/quickjs-runtime/check-async-functions.mjs`:
- 67 fixtures, with 134 native oracle settlements (node:vm, microtasks drained): 59 fulfilled, 7 rejected,
  1 pending. This includes 5 GC-pressure fixtures and 3 one-instruction resumptions.
- 67/67 raw native/Wasm parity. Kind-2 opcode coverage includes `await` and `return_async`.
- WGSL lint of all fragments and of the full composed shader.
- 28 edits anchor exactly once against `generatorIntegrationPatch(live,{iteratorPrototypeNode:77})`.
- Previews in isolated temp copies:
  - generator+worker 5 alone: all fixtures fail packing on the not-yet-integrated `__promiseResolve`.
  - With preview-only stubs for the three other-worker names and the four worker-1 WGSL functions: 67/67 pack
    identically from both compilers, and kind-2 info words carry bit 19 only.
  - Composed with the edits exported by workers 1, 2, 3, 4, 6 and 7 (promise-jobs and async-iteration), with
    worker 5 applied first and last: 67/67 pack, no stubs, and 261 WGSL functions with an acyclic call graph.

## Gaps
- No GPU run. Real resumption, tick order, GC pressure (collections > 0) and the status-11 path need M1 Safari.
- HostPromiseRejectionTracker is not modelled.
- `Object.prototype.toString(asyncFn)` relies on the runtime's @@toStringTag lookup for function values
  (fixture `async-function-to-string-tag`).
- A status 11 produced by a `finish()` continuation inside the second `asyncRejectDispatch` would end the lane.
  This needs an activation called directly by the IteratorClose helper, which no compiler path emits.
- `__lanesAsyncResume` with a bad token gives status 2 (internal invariant failure). Only bootstrap code can
  reach it.
