# Worker 6: async generators

Status: staged in new files only, with no live core edits. Host checks pass. The GPU has not run this code, so this is not a qualified runtime feature yet.

Files: `async-generator-source.js` (WGSL, guest helpers, metadata, edits), `async-generator-cases.js` (60 fixtures), `check-async-generators.mjs`.

## Design

- **Activation (WGSL).** A kind-3 closure is packed with function-info bits 18|19 (`0xC0000`).
  - `asyncGeneratorEnter` (call() hook) creates the generator object: kind 2, with an unflagged `value.z` pointing to a header of heap kind 74.
    - Header `value` = (pc, env, saved-operand head, packed word). The packed word is protocol | spec state<<8 | signal<<16.
    - Header `key` = owning object. Header `next` = aux node (kind 77): `value` = saved receiver, `key` = queue head, `next` = queue tail.
  - The env is marked `value.w=74` and `value.z=object`.
  - Parameter initialization runs at call time. `initial_yield` suspends and returns the object.
- **Opcode intercept.** Inside a kind-3 activation, `initial_yield`, `yield`, `await` and `async_yield_star` are handled before the opcode switch by `asyncGeneratorStep`.
  - The intercept saves the operand segment (kind 76 cells, collecting first while everything is rooted) and the receiver.
  - It records the stop signal (yield 0, await 1) and calls `finish(l, operand)`. The operand goes to whoever resumed the body.
  - QuickJS bytecode already performs `Await` on the `yield` operand, and on `return()` resumptions (`if_false; await; return_async`).
- **Completion.**
  - `return_async` → `asyncGeneratorBeforeFinish`: protocol done, spec state draining-queue, signal return.
  - An exception that escapes the activation → `asyncGeneratorUnwind` (in raise, before `generatorUnwind`): same, with signal throw. The resuming helper's own `try/catch` receives the exception, so it never becomes uncaught status 7.
- **Resume.** Intrinsic 2884 (call() hook) installs the saved frame above its guest caller, like `generatorResume`. What it does depends on where the body stopped:
  - suspended at yield: push value+mode, or raise for throw.
  - suspended at yield*: push value+mode for all modes.
  - suspended at await: push value, or raise.
- **Guest helpers** (strict bootstrap code, run on the GPU):
  - `asyncGeneratorRequest` implements next/return/throw (27.6.1.2-4). It does NewPromiseCapability(%Promise%) and the brand check, which rejects the promise and never throws synchronously. It also handles the completed and suspended-start shortcuts, AsyncGeneratorEnqueue, and either Resume or AwaitReturn.
  - `asyncGeneratorRun` loop:
    - Await: PromiseResolve (an abrupt result is thrown into the body), then PerformPromiseThen. Its arrow closures call Run again from a reaction job.
    - Yield: CompleteStep(value, false). If the queue is non-empty, resume immediately (AsyncGeneratorYield step 11). Otherwise publish suspended-yield.
    - Return/throw: CompleteStep(done=true), then DrainQueue.
  - `asyncGeneratorCompleteStep`, `asyncGeneratorDrainQueue` and `asyncGeneratorAwaitReturn` follow 27.6.3.4/.8/.9.
  - While the body is suspended at an await, the spec state stays `executing`, so new requests only enqueue.
  - Private names are bound to root-scope locals before arrows use them.
- **GC.**
  - object→header (74).
  - header→env, saved list, owner; `next`→aux.
  - aux→receiver (markValue) and queue head.
  - request cells (75) and saved cells (76) are traced with markValue.

## IDs, kinds, nodes

- **Public builtins:** 2880 next, 2881 return, 2882 throw, 2883 AsyncGeneratorFunction identity. Calling or constructing 2883 is status 6.
- **WGSL intrinsics:**
  - 2884 resume (frame-installing)
  - 2885 state (-1 or 0..4)
  - 2886 setState
  - 2887 enqueue
  - 2888 first
  - 2889 dequeue
  - 2890 signal
- **Helpers:**
  - 2891 request
  - 2892 run
  - 2893 completeStep
  - 2894 drainQueue
  - 2895 awaitReturn
  - The private alias `__lanesAsyncGeneratorPromise` = 2800.
  - 2896..2909 are spare.
- **Heap kinds:** 74 header, 75 request, 76 saved operand, 77 aux. Env marker is 74.
- **Fixed nodes:**
  - 94 %AsyncGeneratorFunction.prototype%: proto 3, `prototype`→95, `constructor`→2883, @@toStringTag.
  - 95 %AsyncGeneratorPrototype%: proto 96, `constructor`→94, next/return/throw, @@toStringTag "AsyncGenerator".
  - Each kind-3 closure gets [[Prototype]] 94 and a fresh `prototype` object inheriting from 95. This reuses the object the generator closure hook allocated, retargeting its prototype.
- **Continuations 144..151:** unused.
- **Opcodes added:** `async_yield_star`, with its lowering.

## Dependencies (stubbed only in the check's preview, never executed)

- Worker 1: `__promiseNewCapability` (2821), %Promise% id 2800, the `Promise` global (the two tick-order fixtures are not packed without it).
- Worker 2: `__promiseResolve` (2827).
- Worker 3: `__promisePerformThen` (2830).
- Worker 5: the `await` opcode name and lowering. Its `await` switch case is bypassed in kind-3 activations.
- Worker 7:
  - `for_await_of_start`, `for_await_of_next` and `iterator_get_value_done` (yield* and for-await)
  - node 96
  - async-from-sync
  - job draining
- Parent: `FIXED_RESERVED_LAST` ≥ 95.

The edit sets of workers 1/2/3/5/7 that exist now compose with these edits in both orders. Worker 5 brands activations through `env.key`, and its async-function test requires bits == `0x80000`, so kind-3 frames are not async-function boundaries.

## Gaps

- No GPU compilation or execution has run. The WGSL is checked only statically: call graph, defined identifiers, reserved words, let-reassignment, balance.
- Class async generator methods: class elements still reject async methods. Worker 5's class-element edit may admit them; untested here.
- The internal resume closures are arrows, not spec built-in function objects. They are never exposed to user code.

## Commands

`node experiments/quickjs-runtime/check-async-generators.mjs`
