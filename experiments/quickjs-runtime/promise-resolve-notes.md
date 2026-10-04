# Worker 2: Promise resolution procedure and thenable assimilation

Files: `promise-resolve-source.js` (sources, ids, metadata, integration edits, pending),
`promise-resolve-cases.js` (62 fixtures), `check-promise-resolve.mjs` (host-only evidence).

## Design

The three operations are strict guest bootstrap helpers. QuickJS compiles them as intrinsic
roots and the WGSL VM runs them. No WGSL is added, and ids 2850..2854 stay unused. Every
observable step is plain guest bytecode: the `then` Get (getter calls), `typeof` (IsCallable),
`try/catch` (abrupt completions), and `__lanesCall` (receiver-correct calls). All of these
already run on the GPU.

| id | private name | FIELDS slot | spec |
|---|---|---|---|
| 2825 | `__promiseResolveBody(promise, resolution)` | `promiseResolveBody` | 27.2.1.3.2 steps 7-16 |
| 2826 | `__promiseResolveThenableJob(promise, thenable, then)` | `promiseResolveThenableJob` | 27.2.2.2 step 1 |
| 2827 | `__promiseResolve(C, x)` | `promiseResolveAbstract` | 27.2.4.7.1 |

The FIELDS names are deliberately not public property names. `program.js` merges names
with `if(!fieldNames.includes(name))`, so a shared name such as `resolve` would silently
alias two different helpers.

### How a helper calls another helper by private name
1. In an intrinsic-root function (`attachBootstrap` marks only index 0 of each bootstrap), a
   free name that is a key of `bootstrap.js` `privateBuiltins` is packed as capture spec
   `[4,id]`. The guest therefore sees the tag-11 value `V(id,0,11,0)` (`program.js` line 128).
2. Calling that value enters `shader.js call()`. The `fnValue.z==11u` id→FIELDS table replaces
   it with `closure(l, bootstrapFunctions[field])`, so it becomes an ordinary guest frame.
3. So a helper that other helpers can call needs four things: a `privateBuiltins` entry, an
   id→field dispatch line in `call()`, a `bootstrapSources` entry and a FIELDS slot.
   `promiseResolveIntegrationEdits` adds all four for 2825..2827. Pure WGSL intrinsics
   (2841/2843/2910) only need the `privateBuiltins` entry plus their owner's WGSL case.
4. Nested functions inside a helper are not roots, so they cannot see private names. These
   helpers use no nested functions, and the check enforces this. Worker 1's resolve closure
   is nested, so it must take `__promiseResolveBody` from its root's scope. One way is to
   bind a local in the root, `const body = __promiseResolveBody;`, and let the arrow capture
   it.

Exports for other workers: `promiseResolveHelperNames` (name→id, for `privateBuiltins`) and
`promiseResolveBuiltinFields` (id→field, for dispatch).

## Spec step mapping

**Resolve body** (called after worker 1's alreadyResolved guard, steps 1-6):
- Step 7: `resolution === promise` rejects with a new TypeError. `===` is SameValue here
  because `promise` is an object.
- Step 8: a non-Object resolution goes to `__lanesPromiseSettle(p,1,v)` and `then` is
  never read. A fixture with a `Number.prototype.then` getter proves this.
- Steps 9-10: one `resolution.then` inside `try`. An abrupt read settles the promise as
  rejected with the thrown value. The getter runs synchronously inside resolve.
- Step 12: `typeof then !== "function"` fulfills with the object. In the VM, typeof
  "function" means tags 5/11, which is exactly IsCallable.
- Steps 13-15: `__lanesEnqueueJob(2, promise, resolution, then)`. `then` is captured now,
  and later changes to `resolution.then` have no effect. HostMakeJobCallback is the identity.
- Native promises take no shortcut: their (possibly patched) `then` is fetched and called
  inside the job.

**Thenable job:**
- Creates fresh resolving functions through 2820.
- Calls `__lanesCall(then, thenable, resolve, reject)`.
- If the call is abrupt, it does `return reject(error)` as a plain call. That reject
  respects the fresh pair's alreadyResolved record, so a throw after resolve is ignored.
- The return value goes to the runner, which ignores it.

**PromiseResolve:**
- IsPromise is `__lanesPromiseState(x) >= 0`.
- It then does one `x.constructor` Get and returns `x` if the result `=== C`. C is always an
  Object, so `===` is SameValue.
- Otherwise it calls `__promiseNewCapability(C)`, reads `resolve` into a local and calls it
  plainly, so the receiver is undefined. Abrupt completions propagate.

## Ordering rationale (all verified against Node native)
- A plain value takes 1 tick until reactions run.
- A non-callable `then` also takes 1 tick, because no job is created.
- A user thenable takes 2 ticks: the thenable job, then the reaction.
- A native promise as the resolution takes 3 ticks: the thenable job calls `p.then`, which
  queues a reaction job; that resolves the outer promise, which queues the outer reaction.
  The same count applies to rejected promises and to a `then` handler that returns a promise.
- Each extra nesting level of thenables adds 1 job.
- `Promise.resolve(p)` returns `p` itself, adding 0 ticks. When the constructor does not
  match, the result is resolved through the thenable path, and that path's `then` reads
  `p.constructor` a second time (SpeciesConstructor). The fixture asserts the counts 1 and 2.

## Evidence (`node check-promise-resolve.mjs`)
- **Native oracle:** 62 fixtures × 2 inputs run in fresh vm realms with real microtask
  draining. Settlement and value match.
- **Spec-model realm:** the same fixtures run against a reference model of workers 1/3/4/7.
  The model is oracle-only and executes the actual helper sources unmodified. Results match
  native, including exact job order.
- **Mutation self-test:** 10/10 plausible wrong helpers are caught, for example a synchronous
  thenable call, a double Get, a native-promise shortcut, a lost receiver, and a bypassed guard.
- **Unit checks:** 11 checks on job payload identities, getter counts and receivers.
- **Bytecode parity:** native and Wasm bytecode match for the 3 helpers and 62 fixtures.
  All functions are kind 0.
- **Integration preview** (tmpdir copies of `generatorIntegrationPatch(live,{iteratorPrototypeNode:77})`
  plus these edits):
  - All 6 anchors are unique.
  - Opcodes and FIELDS are stable.
  - The helpers pack via `attachBootstrap`/`packProgram` from both compilers with identical
    code and image, which confirms the opcodes are supported.
  - Shader dispatch lines render once per id.
  - Worker 1/7 names are registered as **test-only stand-ins** at their contract ids.

## Gaps / dependencies
- Nothing can run on the GPU until these land:
  - worker 1: 2820, 2821, 2841, 2843, the Promise constructor, and the `Promise` global
    binding; fixtures currently fail to pack with "Unsupported global or module reference: Promise";
  - worker 3: `then`/`catch`/reaction jobs;
  - worker 4: `Promise.resolve`/`reject`/`race`, used by the fixtures;
  - worker 7: the queue and a runner that calls 2826 for job type 2.
- `Get(builtinFunction, "then")` (resolving with a tag-11 function value) goes through the
  builtin property path. That path reports status 6 for unmodelled names, while the spec
  gives `undefined` and therefore fulfill. This gap already existed.
- HostPromiseRejectionTracker (unhandled-rejection reporting) is not modelled.
