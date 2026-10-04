# Promise + async wave: worker 8 review

Scope: `PROMISE-ASYNC-CONTRACT.md`, `promise-ids.js`, the live `shader.js`/`runtime.js`/`program.js`
paths the contract hooks into, plus the worker files present when this review was written
(`promise-core-source.js`, `promise-resolve-source.js`, `promise-then-source.js`,
`promise-combinators-source.js`, and the case modules for core/resolve/then). Worker 5/6/7 sources
(async functions, async generators, jobs) did not exist yet, so the job-queue and async findings
are about the contract only. Everything here is read-only analysis plus host checks. Nothing ran on
a GPU.

Evidence: `node check-promise-conformance.mjs` checks 115 independent fixtures against node's
native engine (230 checks) and checks native/Wasm QuickJS bytecode parity for all 115. It also
cross-checks 176 fixtures from workers 1–3 (352 checks, 0 disagreements).

## Highest risks (fix before the integration run)

1. **Statuses 12/13 lose string and BigInt payloads.** `main()` copies `output.chars` only when
   `status==1u` (the `result.z==7u` and `result.z==18u` branches at the end of `main`), and
   `runtime.js` decodes only when `status === 1`. A fulfilled string (most fixtures here) or a
   rejected string/BigInt reason (`reject-string`, `reject-bigint`) would come back empty or garbled.
   *Fix:* make both output branches handle `status==1u||status==12u||status==13u`. In
   `runtime.js`, decode the value for 1/12/13 and return `undefined` for 14.
2. **runtime.js treats every status `>= 2` as an error and requires `s === 1` for `done`.** Under
   `{promiseResults:'settle'}`, statuses 12/13/14 must count as terminal success with
   `settlements[i]`, and `done` must accept them. Without the option they must still throw the
   object-result error the contract promises (the browser suite checks this with `optInProbe`).
   `step(budget)` takes no options, so the option has to be fixed at `start(program, inputs,
   {promiseResults})`. `browser-promise.js` passes it there.
3. **Internal statuses 10/11 must never reach `output`.** The step loop exits as soon as
   `status!=0`. Status 9 avoids leaking because it is resolved in the post-switch block of the
   *same* iteration. Statuses 10 and 11 must use that same block (dequeue/dispatch, then set the
   status back to 0) even when the budget runs out on that instruction. Otherwise `runtime.js`
   reports `undefined in lane …` (`reasons[10]` is missing). *Fix:* handle them next to the status-9
   block, and in `runtime.js` add `10/11: 'Internal status leaked'` so a regression reads clearly.
4. **The top-level result must stay rooted and unchanged while jobs drain.** `collect()` marks
   `states[l].result`, so keeping the top-level promise there roots it. Job-runner frames must
   therefore always run at depth ≥ 1 with tail 136 so that `finish()` never takes the
   `complete=true` path for a job and overwrites `result`. Inspection shows this holds only if
   `main()` installs the 2911 frame from depth 0 through `call()`, not by re-entering the entry
   path. Add a GC fixture where the result promise is reachable only from `result` while a job
   allocates (`gc-collect-inside-job-with-queued-jobs` covers this).
5. **Job-cell GC marking needs per-kind rules.** `collect()` marks `node.next` for every kind and
   marks `key` only for kinds 3/9/15. Kind 73 stores its payload cell in `key`, so it needs an
   explicit `mark(l,node.key)` plus `markValue(node.value)`. Kind 67 needs `markValue(node.value)`,
   and its `key` (the job type 1..3) must not be marked. Kind 65 (`key` = 0/1) already follows this
   in worker 1's `promiseCoreGCWGSL`. Kind 72 (node 92) stores raw node indices in
   `value=(head,tail,count,totalRun)`. Mark `value.x` (head) explicitly. The generic `next` marking
   does not cover it because the header's `next` is unused. If head is not marked, **the whole
   queue is unrooted**, which is exactly what `gc-job-queue-only-root` and
   `gc-thenable-job-payload-only-root` probe.
6. **Fixed-node range growth.** `FIXED_RESERVED_LAST` is still 85 in the live build. Nodes 90..99
   are on the free list until the parent grows it to 105. Init writes there would corrupt
   allocator state, and the `kind!=0` root sweep would miss them. Worker 1 lists this as an
   external dependency. Grow it, and re-check that the `main()` free-list splice
   (`heap[FIXED_INIT_LAST].next = FIXED_RESERVED_LAST+1`) and the reserved-node zeroing loop run
   **before** any promise init writes.

## Job ordering

- The tick canon (verified natively, encoded as `order-*` fixtures): `await <native promise>` =
  1 tick, `await <thenable>` = 2, `async return <promise>` and `resolve(<promise>)` = 3, and a
  `then` handler returning a promise = +2. To match it, the GPU needs:
  - Await calls `PromiseResolve(%Promise%, v)`, which does an observable `Get(v,"constructor")`
    only when `v` is a promise. It must **not** run full resolve-function semantics.
  - Await then calls the internal `__promisePerformThen` with `capability === undefined`. It must
    **not** call `promise.then(...)`, which is observable through a patched `then` or species and
    allocates an extra promise.
  - An async function's `return v` goes through the result capability's `resolve` (worker 2's
    2825). It must **not** take a direct `__lanesPromiseSettle` shortcut, which would make a
    returned promise cost 1 tick instead of 3 (`order-async-return-promise-three-ticks`).
- Worker 1's `promiseSettleHeader` stores the state before enqueuing and then walks one
  interleaved fulfill/reject cell list in registration order. Order is correct. Enqueueing runs no
  guest code, so no reaction can be appended during the walk. A reaction added by a handler while
  the queue drains goes to the *back* of the FIFO (`reent-settle-during-reaction-list`,
  `order-then-inside-then-goes-to-back`).
- Worker 3's `promiseReactionJob` rethrows when `capability === undefined` and the handler was
  abrupt, which becomes status 7. That is correct for Await closures, which never throw. But the
  contract's job type 3 ("plain call A(B)") also turns any exception into status 7, which kills the
  lane. ES2025 would call HostReportErrors and keep draining. *Recommend:* either have the runner
  swallow type-3 exceptions or document type 3 as trusted-only (not reachable from guest code).

## Reentrancy hazards

- **Settle during reaction iteration:** safe as written (see above). Keep `jobEnqueue`
  allocation-only. It must never call into guest code or `collect()`.
- **Allocation during settle:** worker 1 counts 3 nodes per matching reaction and calls
  `collect()` mid-intrinsic if fewer are free. Two concerns:
  1. The contract says collection happens only at the instruction boundary. A mid-intrinsic
     collect is safe only if every live WGSL local (header, value `c`, receiver) is still on the
     operand stack. Verify that `call()`/`objectMethod` has not popped the receiver/arguments
     before the intrinsic runs.
  2. Allocation is unbounded: N reactions need 3N nodes in one instruction. *Recommend:* make
     type-1 job payload B reference the settled **header** (immutable once settled) instead of
     copying the value. Then reuse the reaction cell itself as the job cell (relink kind 65 to 73
     in place). Settlement then allocates nothing and cannot fail partway.
- **Resolve functions called reentrantly** (from a handler, from a thenable's `then`, twice,
  resolve-then-reject-then-throw): worker 1's shared `alreadyResolved` record covers this, and
  fixtures `reent-resolve-functions-once-only`, `reent-thenable-calls-resolve-then-reject-then-throws`
  and `reent-resolve-with-thenable-locks-then-reject-ignored` pin it.
- **Raise boundary for async (status 11):** the unwinder in `shader.js` (`raise`) walks frames
  until a catch slot is found. An async activation frame must act as a hard stop. That includes the
  synchronous prefix before the first `await`, which runs inside the caller's call stack:
  `async function a(){throw x}` called from a sync frame must reject `a()`'s promise and must
  **not** reach the caller's `catch` (`order-async-throw-before-await-is-sync-start`,
  `t262-async-default-param-throw-rejects`, where parameter-initializer throws also reject). Status
  11 must save the thrown value somewhere GC-rooted (stack top or `receiver` of the async frame)
  before deferring to `main()`.
- **Async generator self-request:** a `next()` queued from inside the running body is served only
  after the next suspension. Awaiting it from the body deadlocks, and that is the spec behaviour
  (`reent-async-generator-self-request-deadlocks`). The request queue (kind 75) must not resume a
  generator in state executing.
- **Status 10 versus step budget:** the job queue must be drained through `main()` (one job per
  status-10 transition), not by a WGSL loop that runs to completion. Otherwise `job.step(1)`
  resumption does not hold. The browser suite runs 7 resumption fixtures with `step(1)` and a
  150,000-dispatch bound.

## GC root completeness

| Root | Covered by | Fixture |
|---|---|---|
| promise object → header → value/reactions | worker 1 GC WGSL + generic `next` | `gc-settled-value-only-in-header`, `gc-rejection-reason-retained` |
| reaction record (guest object) | kind 65 `markValue(value)` | `gc-pending-reaction-only-root` |
| job queue head (node 92 value.x) | **missing until worker 7 lands; see risk 5** | `gc-job-queue-only-root`, `gc-collect-inside-job-with-queued-jobs` |
| job payload cells (73.key → 67 → 67) | **needs explicit `mark(key)` for kind 73** | `gc-thenable-job-payload-only-root` |
| suspended async activation (68..70), reachable only from a reaction closure | worker 5: closures must capture the activation header | `gc-suspended-async-only-reachable-from-reaction` |
| async generator request queue (75) and saved state (76) | worker 6 | `gc-async-generator-suspended-with-request` |
| combinator element state (values list, remaining counter) | guest objects captured by element closures | `gc-promise-all-values-retained` |
| top-level result while draining | `states[l].result` (already marked) | all fixtures with collections > 0 |

Fixed nodes 90..105 are rooted only when `kind != 0`. The spare nodes 100..105 must therefore stay
kind 0 until they are used: initializing one without wiring it would leak, but not crash. For kinds
64..79, the sweep clears only bit 0 of `marked`, so worker 1's state bits 4..6 survive collection.
`alloc()` resets `marked` to 0 (pending, unhandled), which is correct for a fresh header.

## Resource limits (program.js LIMITS)

- frames 32: each job uses runner 2911 → reaction job 2831 → handler → capability resolve 2825
  (→ `Get then`), so about 5 frames are used before user code. An async activation can therefore
  nest roughly 25 guest calls deep inside a job. Synchronous async recursion of depth 40 must fail
  with status 3 (`resource-frames-sync-async-recursion-40`).
- stack 256: `resource-stack-pending-operands-across-async-calls` (12 frames × about 27 pending
  operands) must fail with status 3 before the frame limit.
- heap 2048 (collect at fewer than 192 free nodes): with reaction records and capabilities as
  ordinary guest objects (an object node plus 3 property nodes each), every pending `then` costs
  about 20–30 nodes. That allows roughly 70–90 simultaneously pending `then`s per lane.
  `resource-heap-10000-deep-promise-chain` and `resource-heap-3000-pending-promises` must fail with
  status 3. *Recommend:* measure nodes per pending `then` once integrated and record it. A raw
  kind-66 reaction cell would cut this cost about 4×.

## Host API

- Add `settlements` to `run()` and `step()` results. The option belongs on `start()`, and `run()`
  forwards it.
- A status-13 reason that is an object (an Error, for example) currently throws "Object/function
  results cannot cross". *Recommend* a distinct message ("rejection reason is an object") so a
  rejected Error is not mistaken for a fulfilled object.
- Unhandled rejections must not affect the status. A rejected promise that is not the top-level
  result leaves the run at status 12 or 1 (`unhandled-*` fixtures).
- `program.js` still rejects any function with `kind !== 0` (in `packProgram`, line 119:
  "uses a generator/async kind"; the generator patch relaxes it for kind 1). The browser suite
  cannot compile any async fixture until the parent also relaxes it for nested kinds 2 and 3 with
  `ASYNC_KIND_BIT`. The entry `f` should stay kind 0.

## test262 inventory note

`../bootstrap/evidence/quickjs-full-test262-inventory.json` (records with `adaptedHarnessEligible`):

| Area | Files | Eligible | Main blocker |
|---|---|---|---|
| built-ins/Promise | 732 | 230 | `flags:[async]` (415) |
| built-ins/AsyncFunction | 18 | 10 | |
| built-ins/AsyncGenerator* | 71 | 7 | async flag (41) |
| language/{expressions,statements}/async-* | 1151 | 180 | async flag (756) |
| for-await paths | 1297 | 4 | async flag (1172) |

The adapted harness has no `$DONE`/async flag support, so most Promise tests are not admissible
yet. A `$DONE` adapter that maps to settlement statuses 12/13 would unlock about 2,400 files.

## Other workers' files (read-only)

- **Worker 1 (core):**
  - Brand and state layout match the contract.
  - `addReaction` walks to the list tail on every `then` (O(n) per call, bounded by `L.heap`).
    Acceptable at heap 2048.
  - `promiseHeaderOf` checks `heap[value.z].kind==64 && key==object`, which guards against
    generator brands that share `value.z`.
  - Mid-intrinsic `collect()`: see the reentrancy section.
- **Worker 2 (resolve):** matches spec steps exactly. There is one observable `Get then` and
  self-resolution is checked with `===`. The thenable job creates fresh resolving functions, so a
  throw after a resolve is ignored.
- **Worker 3 (then/finally):**
  - `finally` uses `Invoke(p,"then",…)` through `p.then` as the spec requires.
  - The reaction job rethrow is discussed under Job ordering.
  - The `then` capability goes through species. My `t262-then-species-constructor-used` depends
    on Promise subclassing, which worker 1 lists as a boundary, so the browser treats a status 6
    there as a reported gap.
- **Worker 4 (combinators):**
  - `Promise.any` captures the mutable `index` in its element closures and reads it only after
    iteration finishes, so the count is correct.
  - `errors[index] = undefined` preallocation matches the spec's list append.
- **Cross-check:** 352/352 checks of workers 1–3 fixtures agree with node.
