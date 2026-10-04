# Worker 7: job queue, completion publication, async iteration

Files: `promise-jobs-source.js` (part A), `async-iteration-source.js` (part B),
`promise-jobs-cases.js` (24 fixtures), `async-iteration-cases.js` (66 fixtures),
`promise-jobs-preview.js` (test support: isolated composition preview),
`check-promise-jobs.mjs`, `check-async-iteration.mjs`. No live core file is edited.
The integration recipe is `promiseJobsIntegrationEdits` + `asyncIterationIntegrationEdits`.
Their anchors match exactly once in `generatorIntegrationPatch(live,{iteratorPrototypeNode:77})`.
They compose with the edits of workers 1-6 in either order.

## A. Guest job queue

- Fixed node 92, kind 72: `value=(head, tail, count, totalRun)`. Job cell kind 73: `value=A`, `key=payload`, `next=next job`.
  Payload kind 67: `value=B`, `key=type`, `next=C cell` (type 2 only) or 0.
- WGSL `jobEnqueue(l, jobType, a, b, c) -> bool`. The parameter is `jobType` because `type` is a reserved word in WGSL.
  It never collects. Exhaustion returns false and sets status 3. Callers collect at the start of their instruction.
  Worker 1's settle intrinsic already does this, and so does the `__lanesEnqueueJob` hook.
- 2910 `__lanesEnqueueJob(type, a, b, c)` is a `call()` hook. It needs four arguments, so it does not go through `objectMethod`.
- 2911 `__promiseRunJob(type, a, b, c)` is a strict guest helper that dispatches by type:
  - type 1 calls `__promiseReactionJob` (2831).
  - type 2 calls `__promiseResolveThenableJob` (2826).
  - type 3 runs `__lanesCall(a, undefined, b)`.
- **Draining.**
  - When `finish()` completes the outermost frame with status 1, it calls `jobsSettle`. The top-level result stays in `states[l].result`, which `collect()` roots.
  - If the queue is non-empty, `jobsSettle` sets internal status 10.
  - `jobDispatch` (in `main()`) then:
    1. collects while every payload is still rooted through node 92;
    2. puts the runner and its arguments on the depth-0 stack;
    3. unlinks the head job;
    4. calls the runner with frame tail 136.
  - Continuation 136 discards the runner's result and calls `jobsSettle` again.
- **Publication.** When the queue is empty, `jobsPublish` checks the top-level result with worker 1's `promiseHeaderOf`:
  - not a promise: status 1;
  - fulfilled: status 12, value = the fulfillment value;
  - rejected: status 13, value = the reason;
  - pending: status 14, value = undefined.

  Statuses 12 and 13 publish string chars and BigInt limbs exactly like status 1 (two output-block edits).
- **Status 10 and 11 never reach the host.**
  - `jobDispatch` runs at the end of the post-instruction block, after the status-9 block and after worker 5's status-11 dispatch. A status 10 produced in an iteration is therefore resolved in that same iteration.
  - `jobDispatch` also runs once before the step loop, so a persisted status 10 resumes on the next dispatch.
  - The output snapshot publishes statuses 10 and 11 as 0 (running). The state keeps the real status.
  - Recommendation to the parent: add a matching pre-loop `asyncRejectDispatch(l);` so a persisted status 11 also resumes. That function belongs to worker 5.
- **GC.** Node 92 is a root while its kind is non-zero, provided it is inside the reserved range. The mark arm marks:
  - the header's head and tail (node ids in `value.x`/`value.y`);
  - each job cell's value (V) and its payload cell (`key`);
  - each payload cell's value.

  The generic `mark(node.next)` follows job→job and payload→payload links.

### Host API proposal (parent applies to runtime.js)

The host never runs guest callbacks. It only maps final statuses to settlements:

- `promiseResults` is a `start()` option, because `step()` takes no options. `run()` passes it through.
- Statuses 12/13/14 count as done, with `settlements[i] = 'fulfilled' | 'rejected' | 'pending'`. Statuses 1 and 12/13 decode `values[i]`.
- Without the option, a promise result throws exactly like any other object result.
- Budget resumption is unchanged: status 0 means running. Statuses 10/11 are internal and accepted as running defensively.

The exact diff text is `promiseJobsRuntimeProposal` in `promise-jobs-source.js`.

### Gaps (part A)

- An uncaught exception that escapes a job ends the lane with status 7, as the contract requires. Only type 3 jobs or a trusted-helper bug can do this. ES hosts would report the error and keep draining.
- Starvation: a job chain that never ends only consumes steps. The host's `maxDispatches` limit applies. There is no separate job budget.
- Jobs queued before an uncaught top-level throw are not run, because status 7 is terminal.
- A rejection reason that is an object publishes status 13 with an object value. The host decoder rejects object values, the same as it does for status 1.

## B. Async iteration

- Node 96 is `%AsyncIteratorPrototype%` (proto 1). Its `[Symbol.asyncIterator]` (2912) returns `this`. The key is `0x60000000|31`.
  The well-known cell is 31, not 32: cells are 31 + index of `WELL_KNOWN_NAMES`.
- Node 97 is `%AsyncFromSyncIteratorPrototype%` (proto 96), with `next`/`return`/`throw` = 2913/2914/2915, implemented as guest helpers per ES2025 27.1.6.
  - `AsyncFromSyncIteratorContinuation` (2920) closes the sync iterator when the value promise rejects. This applies to next/throw (`closeOnRejection`), not to return.
  - When `throw()` is missing, the helper closes the sync iterator and then rejects with a TypeError.
  - The `[[SyncIteratorRecord]]` brand is a kind-67 cell referenced from `value.z` of the wrapper object. Intrinsics: 2921 create, 2922 read.
- `Symbol.asyncIterator` is installed on the Symbol constructor (node 26).
- New opcodes (append-only): `for_await_of_start`, `for_await_of_next`, `iterator_get_value_done`. The existing `iterator_close` case gets an async prefix; the sync path is untouched.
  `async_iterator_close` does not exist in this QuickJS revision.
- **For-await lowering.** This QuickJS revision never awaits `return()` on break or return, and calls `return()` after exhaustion. Neither is reproduced:
  - Exhaustion clears the record slot.
  - Break, return and throw run AsyncIteratorClose with an await, through resumable opcode states. The design comment at the top of `async-iteration-source.js` explains the states:
    - Catch offset `V(N,0,9,0)` while the body runs.
    - States T1/T2 at N for a throw completion.
    - States R1/R2 at C for a normal completion.
    - Continuations 152 (deliver a helper result and re-execute the opcode), 153 (value/done), 154 (open).
- **Await interface.** Worker 5's `asyncAwait(l)` handles async functions; worker 6's `asyncGeneratorStep(l, OP.await)` handles async generators. Both await the stack top and resume at `states[l].pc`.
- **Async `yield*`.** In this mode `for_await_of_start` is followed by `drop`. The record slot then holds the `{iterator, next}` record that the existing `iterator_next`/`iterator_call` read.

### Gaps (part B)

- Async generators close inline on return using QuickJS bytecode (`iterator_check_object` before `await`). That order differs from ES2025, and the async-generator bytecode owns it.
- Node 26 (V8) closes the sync iterator when an Async-from-Sync `next()` throws, or when its result is a non-object or its `value` getter throws. The ES2025 text does not.
  The fixtures follow ES2025, and the check asserts the observed V8 value separately in `v8`.
- `value[Symbol.asyncIterator]` on a tag-11 builtin function reports status 6 (an existing builtin-getProperty limit).

## Dependencies

- Parent: `FIXED_RESERVED_LAST >= 97`, and 105 per the contract. The live value is 85; the previews patch it.
- Parent: the runtime.js proposal.
- Worker 1: `promiseHeaderOf`, 2821.
- Worker 2: 2826, 2827.
- Worker 3: 2830, 2831.
- Worker 5: `asyncActive`, `asyncAwait`.
- Worker 6: `asyncGeneratorActive`, `asyncGeneratorStep`.
