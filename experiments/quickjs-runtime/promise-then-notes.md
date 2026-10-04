# Worker 3: Promise.prototype.then / catch / finally, reactions, SpeciesConstructor

Files: `promise-then-source.js` (sources, metadata, WGSL, edits), `promise-then-cases.js` (66 fixtures),
`check-promise-then.mjs` (host-only evidence). No live file is edited.

## Ids

| id | name | kind |
|---|---|---|
| 2802 / 2803 / 2804 | `then` (length 2) / `catch` (1) / `finally` (1) | public tag-11 methods on node 91, flags 5 |
| 2830 | `__promisePerformThen(promise, onF, onR, capability)` | guest helper, field `promisePerformThen` |
| 2831 | `__promiseReactionJob(reaction, argument)` | guest helper (job type 1 body), field `promiseReactionJob` |
| 2832 | `__promiseSpeciesConstructor(O, default)` | guest helper, field `promiseSpeciesConstructor` (worker 4 may reuse) |
| 2855 | `__lanesSpeciesSymbol()` | WGSL intrinsic → `V(39,0,17,0)` (well-known cell `species`) |
| 2856 | `__lanesSpeciesIsConstructor(v)` | WGSL intrinsic, IsConstructor |
| (2800) | `__lanesPromiseIntrinsic` | private name for the %Promise% value (default constructor) |

FIELDS appended: `then, catch, finally, promiseThen, promiseCatch, promiseFinally, promisePerformThen,
promiseReactionJob, promiseSpeciesConstructor`. Slot names never equal public property names.

Dependencies by contract name: 2821 `__promiseNewCapability`, 2827 `__promiseResolve`, 2841/2842/2844/2845/2846
`__lanesPromise{State,Result,AddReaction,MarkHandled,IsHandled}`, 2910 `__lanesEnqueueJob`, existing 113
`__lanesCall`, 112 `__lanesDescriptor` (null-prototype reaction records). Private names resolve only in a
helper's root scope. `finally` binds `__promiseResolve` to a root local before its arrows close over it. The
check rejects any global reference from a nested helper function.

## Semantics notes

- `then` brand-checks with `__lanesPromiseState(this) < 0` and throws a TypeError synchronously. Then it runs
  SpeciesConstructor, NewPromiseCapability and PerformPromiseThen.
- `catch` is `this.then(undefined, onRejected)`. That is Invoke, so it is generic and a patched `then` is
  observed. An undefined or null receiver throws TypeError.
- `finally`:
  - The receiver must be an Object.
  - It calls SpeciesConstructor before anything else, so a species TypeError happens before `then` is invoked.
  - A non-callable `onFinally` is forwarded twice as `then(onFinally, onFinally)`.
  - thenFinally and catchFinally are anonymous arrows passed directly as arguments: name `""`, length 1, not
    constructors. `valueThunk` and `thrower` are anonymous arrows of length 0.
- PerformPromiseThen:
  - Non-callable handlers become `undefined`.
  - Pending: `AddReaction`. Fulfilled: enqueue a job of type 1. Rejected: same as fulfilled, after an explicit
    no-op HostPromiseRejectionTracker branch.
  - Always marks the promise handled. Returns `capability.promise` or `undefined`.
- Reaction job:
  - An `undefined` handler passes a fulfillment through and rethrows a rejection.
  - An abrupt handler call goes to `capability.reject`.
  - The spec asserts that an undefined capability never sees an abrupt result. If that assertion is violated,
    the helper rethrows (status 7) instead of silently dropping the error.
- Chaining cycle: the derived promise resolved with itself becomes a TypeError via worker 2's resolve body. Two
  fixtures cover it.

## Symbol.species: exact boundary

SpeciesConstructor is **fully implemented**:
- `Get(O,"constructor")` is read once.
- `undefined` gives the default.
- A non-object throws TypeError.
- `Get(C, @@species)` is a real guest property read with the true well-known symbol from intrinsic 2855, so
  accessors run.
- `undefined` or `null` gives the default.
- A constructor is returned; anything else throws TypeError.

No path uses `__lanesUnsupported`. The default `constructor === %Promise%` path does the real Get. If worker 4
has not installed `get [@@species]` (2812) on node 90, the property is absent and the result is still the
correct default %Promise%.

Inherited boundaries, none of which can give a wrong value:
- Guest code cannot spell `Symbol.species`, because of the node-26 prototypeGap, which is status 6. Fixtures
  that set a user species get the symbol via `Object.getOwnPropertySymbols(Promise)[0]` and are tagged
  `requires: [... worker 4, 2812]`.
- A tag-11 `constructor` value whose getProperty the core does not map (for example a builtin method) hits the
  existing status-6 getProperty boundary.

IsConstructor (2856) differs from worker 1's `__lanesPromiseIsConstructor` (2847, which is `classIsConstructor`
plus 2800):
- It unwraps bound functions.
- It accepts %Promise%, Symbol, BigInt, Map and Set.
- It **rejects generator and async closures** (function-info bits 18/19). `classIsConstructor` accepts
  generator functions because they have `hasPrototype`.

The parent should consider making 2847 equally strict. Until then, `new C(executor)` in 2821 inherits that
looseness for generator functions. Later constructor builtins, such as AggregateError, must be added to
`promiseThenIsConstructor`.

## Integration edits (`promiseThenIntegrationEdits`, 11 edits, anchors in generator-patched files)

- program.js: one import after the generator-source import, and a FIELDS push after the generator FIELDS line.
- bootstrap.js:
  - an import after the generator-delegation import
  - `...promiseThenPrivateBuiltins` after `__lanesSymbolText:1003,`
  - `...promiseThenSources` after `...generatorDelegationSources,`
- shader.js:
  - an import after the generator-source import
  - name/length metadata before `if(obj.z==11u&&obj.x==2000u){`. Other keys fall through to the
    Function.prototype walk.
  - call() dispatch after the `960u` numberPow line
  - `promiseThenIsConstructor` before `fn instanceOf`
  - the objectMethod prelude after worker 1's anchor
    `var id=method;...107u;}\n  let a=objectView(l,original);`. It uses the same full anchor and `after`, so
    neither edit splits the other.
  - node-91 install before `if(states[l].result.z==18u)...materialize_bigint`. This is after worker 1's
    node-91 init, which comes before the `// Fixed node 65` comment. A guard sets status 2 if node 91 is not
    yet an object.

The check also composes these edits with the delivered worker 1 and worker 2 edit lists in both orders. All
anchors stay unique.

## Gaps

These are listed verbatim in `promiseThenGaps`:
- The species boundaries above.
- IsConstructor coverage for future builtins.
- HostPromiseRejectionTracker is a no-op.
- A throwing custom capability resolve/reject inside a job gives status 7, per the worker-7 contract. The spec
  instead reports the error to the host and keeps running the queue.
- then/catch/finally have no backing nodes. Own-key enumeration, define/delete and `toString` of them keep the
  builtin-function status-6 boundary.
- Property order on node 91 is implementation-defined.

## Evidence (`node check-promise-then.mjs`)

`{"nativeChecks":132,"modelChecks":132,"modelJobsRun":468,"helperNativeWasmParity":6,"fixtureNativeWasmParity":66,"wgslStaticChecks":5,"composedWithSiblingEdits":24,"integrationPreview":{"anchors":11,"packedHelpers":133,"wgslFunctionsAcyclic":207,"opcodesPreserved":153,"fieldsPreserved":401},"gaps":6,"gpuExecuted":false,"liveCoreModified":false}`

- **Real ES:** node's own Promise reproduces all 66 fixtures × 2 inputs.
- **Guest model:** the same fixtures run with my helper sources evaluated verbatim. They sit on spec-faithful
  test models of the worker 1/2/4/7 contracts and drain jobs FIFO. This validates exact tick ordering, but it
  is not GPU execution.
- **Bytecode:** native and Wasm bytecode are identical for the helpers and fixtures. Everything is kind 0.
- **Integration preview:** in temporary copies inside this directory, removed afterwards, every bootstrap helper
  packs through `packProgram` via both bridges, which proves only supported opcodes are used. The WGSL call
  graph has no cycles, and OP/FIELDS are unchanged.
- **GPU:** nothing was executed on a GPU.
