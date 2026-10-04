# Promise core (wave worker 1): brand/state, constructor, resolving functions, GC

Status: staged. These are new files only. No live core file was edited. `node check-promise-core.mjs` passes on the host. No GPU was used, so runtime behavior on the GPU has not been verified.

Files: `promise-core-source.js` (helpers, WGSL, edits), `promise-core-cases.js` (45 core fixtures plus 3 boundary fixtures), `check-promise-core.mjs`.

## Representation
- A promise is an ordinary object: tag 4, heap kind 2, `value=(proto, holder, header, extensible)`. `value.z` holds the header without the high-bit flag, the same way generators store theirs.
- The header has kind 64:
  - `value` is the settled value or reason (undefined while pending).
  - `key` is the owning object (a back-link checked by `promiseHeaderOf`).
  - `next` is the first reaction cell while pending, and 0 after settlement.
  - `marked` bits 4..5 hold the state; bit 6 is `[[PromiseIsHandled]]`. GC only touches bit 0.
- Reaction cells have kind 65. `value` is the reaction record and `key` is 0 (fulfill) or 1 (reject). One chain holds both lists interleaved in registration order. Settlement walks the chain once and enqueues the cells whose `key == state-1`, still in order.
- Fixed node 90 is the Promise constructor backing (proto 3). `objectView(V(2800,11))` and `objectValue(90)` map to each other. Its own properties are length 1, name "Promise" (both configurable only) and prototype (no flags set).
- Fixed node 91 is `%Promise.prototype%` (proto 1), with `constructor` (writable and configurable) and `@@toStringTag` "Promise" (configurable) under key `0x60000000|42`.

## WGSL API (other workers)
- `promiseAllocate(l,proto)->u32`
- `promiseHeaderOf(l,v)->u32`
- `promiseSettleHeader(l,header,state,value)`: requires a pending promise and state 1 or 2, otherwise status 2. It enqueues `jobEnqueue(l,1u,reaction,value,undef())` per matching cell, then clears `next`.
- Internal helpers: `promiseStateOf`, `promiseMatchingReactions`, `promiseIntrinsic`.
- Private intrinsics 2840..2846 follow the contract. 2847 `__lanesPromiseIsConstructor(v)` is an addition: it wraps `classIsConstructor` and is needed by NewPromiseCapability, because stdlib-reflect's 2312 is not live.
- Intrinsics that receive a promise return status 2 on a wrong brand. 2841 never throws.
- Calling `Promise` without `new` (including `.call` and `.apply`) raises status 4, which becomes a guest TypeError.

## Guest helpers
These are strict QuickJS roots:
- **2801 `promiseConstruct`**:
  1. IsCallable check (TypeError).
  2. `__lanesPromiseCreate(undefined)`, which uses node 91.
  3. `__promiseCreateResolvingFunctions`.
  4. Calls the executor with undefined `this`; an abrupt executor completion calls `reject`.
- **2820 `promiseCreateResolvingFunctions`**: returns `[resolve, reject]`. Both are anonymous arrows in an array literal, so QuickJS gives each length 1, own name "", no prototype, and no construct. This matches the spec and the native results, so there is no discrepancy. The two arrows share one `alreadyResolved` binding. Private names resolve only in a helper's root scope (coordinator note), so the root binds `resolveBody`/`settle` locals and the arrows use those. The check fails if a nested helper function references a `__lanes*`/`__promise*` name. `resolve` calls `__promiseResolveBody(promise, resolution)` (worker 2, 2825). `reject` calls `__lanesPromiseSettle(p,2,reason)`. Both return undefined.
- **2821 `promiseNewCapability`**: does the IsConstructor check, then runs `new C(anonymous executor of length 2)` with the "already set" TypeErrors and the callable checks. It returns `{promise, resolve, reject}`.

Routing:
- `construct()` sends `new Promise` (callee === NewTarget === 2800) to 2801 through `call(l,argc,true,false)`, the same pattern as stdlib Map.
- `call()` maps ids 2801/2820/2821 to their bootstrap fields.

## Invariants, GC, limits
- GC marks:
  - object → header, but only when the target is kind 64;
  - header → value and owner;
  - cell → reaction value;
  - the `next` chains through collect()'s generic `mark(node.next)`.
- A dead promise frees its object, header and cells together. The `many-promises-*` fixtures allocate about 300 promises, which is more than the 2048-node heap without collection.
- Allocation never collects implicitly:
  - Create allocates 2 nodes and add-reaction allocates 2, both under main()'s 192-node guard.
  - Settle (2843) calls `collect()` before its first allocation if `freeCount < 3×matching reactions`. At that point every argument is still on the operand stack, because call() resets sp only after objectMethod returns.
  - If memory is still exhausted afterwards, the result is status 3.
- Chain walks are bounded by `L.heap`. A cycle or overrun gives status 3 or status 2.
- The WGSL call graph is acyclic. This was checked on the fully patched preview (212 functions). The only external call is `jobEnqueue` (worker 7).

## Integration edits (`promiseCoreIntegrationEdits`, 18 entries; each anchor matches exactly once after generatorIntegrationPatch)
- **program.js**: an import after `import { privateBuiltins } ...`; a FIELDS append before `export const FIELDS =`; and the classic-mode `Promise` → `[4,2800]` binding after the `Reflect` mapping.
- **phase4-global.js**: a `Promise` global binding after the Reflect row, and removal of `'Promise'` from `globalUnimplementedNames`.
- **bootstrap.js**: an import; `...promiseCoreIntrinsics` before `...phase3BigintConversionIntrinsics,\n});`; and `...promiseCoreSources` after `...generatorDelegationSources,`.
- **phase4-classes.js**: `classIsConstructor` gains `||v.x==2800u`. Without it, `class extends Promise` gives a wrong TypeError; with it, it reaches the status-6 boundary.
- **shader.js**:
  - an import after the program.js import;
  - the GC hook after the kind-35 mark line;
  - objectView after the 401→85 line, and objectValue after the 85→401 line;
  - call fields after the `960u` numberPow line;
  - the construct hook before the `callee.x==100u||callee.x==200u...` line;
  - the objectMethod dispatch right after `let a=objectView(l,original);`, which is before every other id test and before the `id>=150` fallthrough;
  - the functions before `${phase4WGSLFunctions(phase4Context)}\n@compute`;
  - init before the "Fixed node 65" comment, after node 3 exists.

## Exact gaps and dependencies
1. **Fixed nodes 90/91 are not yet reserved.** `FIXED_RESERVED_LAST` (phase4-fixed-nodes.js, owned by the parent) is currently 85, so nodes 90/91 are on the free list. They must be excluded (the contract says up to 105) before this init runs. The check reports `fixedReservedCoversNodes90to91: false`.
2. **Subclassing stays at status 6.** This covers `class X extends Promise` and `Reflect.construct(Promise,args,NT)`. construct() cannot hand a foreign NewTarget to a tag-11 constructor helper, so OrdinaryCreateFromConstructor cannot read `NewTarget.prototype`. `define_class` already gives status 6 for built-in parents. The normative outcomes are recorded in `promiseCoreBoundaryCases`, which are not passes. Closing the gap needs parent construct dispatch to pass NewTarget, for example as a 2nd argument for `__lanesPromiseCreate(NewTarget.prototype)`.
3. **External dependencies.** Every fulfilled fixture needs worker 2's 2825. Any settlement with reactions needs worker 7's `jobEnqueue`. Published fixture results (status 12/13) need worker 7's drain.
4. **ownKeys on tag-11 values gives status 6.** `Object.getOwnPropertyNames(Promise)` and `Reflect.ownKeys(Promise)` hit this. It is a shared limitation that also affects natives backed by fixed nodes; fixtures avoid it.
5. **Not GPU-verified.** No GPU compile or run has happened: WGSL correctness, the actual collections in the GC fixtures, and the init ordering all still need M1 Safari runs.

## Validation run
`node check-promise-core.mjs` (exit 0) checks:
- 96 native-oracle settlements with real host job draining;
- native/Wasm bytecode parity for the 3 helpers (all kind 0, strict, nested global refs resolve to root slots, arrows anonymous with lengths 1/1/2);
- compile parity for 48 fixtures;
- WGSL lint;
- 18 anchors;
- an isolated preview that packs 48 fixtures with every bootstrap helper from both compilers into an identical code/image, with opcodes and FIELDS stable and an acyclic call graph.

The preview binds the identifier `__promiseResolveBody`→2825 for test purposes only (name→id, no semantics) until worker 2's edit lands.
