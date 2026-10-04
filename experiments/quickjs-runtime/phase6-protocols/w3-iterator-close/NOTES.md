# IteratorClose (phase 6, throw and normal)

Parent splices `index.js` sources and `raisePatch.js`. This worker does not edit `shader.js` or `phase4-iteration.js`.

## IDs

| Use | Value |
|---|---|
| Normal close (existing opcode `iterator_close`) | builtin **1272** `__lanesIteratorClose`, source replaced by `iteratorCloseSource` |
| Throw close (`raise`) | builtin **2440** `__lanesIteratorCloseThrow`, source `iteratorCloseThrowSource` |
| Continuation when 2440 returns | **80** → `raise(l, returned)` |
| Reserved, no arm | **81** |
| Heap kind 50 | **unused** |

Do not point the throw path at 1272. Continuation 80 re-raises the helper's **return value**. 1272 returns `undefined` on success, which would drop the original error. 2440 always returns that error. Phase 4 reserved continuations 42/43 for this hook; this patch uses 80/81 instead and does not emit 42 or 43.

Heap kind 50 stays unused. The saved error is `frame.receiver` on the close frame (tail 80). `markValue` already traces receivers (`shader.js` `markValue`, and `collect` marks `frames[i].receiver`). No close-state node is allocated.

## Guest close

Generic records are null-proto objects with `kind === 3`, `iterator`, and `next` (open/step worker). This module does not open iterators.

`iteratorCloseBootstrap(record)` — normal completion (break, `return` from the function, destructuring that stops early):

- `kind !== 3`: `record.object = undefined`; return `undefined`. Intrinsic no-op, unchanged.
- `record.iterator === undefined`: return `undefined` without reading `return`.
- Otherwise save `iterator`, set `record.iterator = undefined` **before** the `return` Get/call (a throw from the getter or from `return()` must not double-close), then `ret = iterator.return`.
- `ret` null or undefined: return `undefined`.
- `inner = __lanesCall(ret, iterator)`. A throw propagates (it replaces the normal completion).
- `inner` null or not an object/function: `TypeError("Iterator close result is not an object")`.
- Else return `undefined`.

`iteratorCloseThrowBootstrap(record, error)` — throw completion. One root function, body inlined inside `try/catch`, `__lanesCall` in that root (private builtins do not resolve in a nested function). `catch (e) { return error; }` then `return error`. The original error wins over a return-getter throw, a `return()` throw, and a non-object result. Kind 1/2 still do the no-op (`record.object = undefined`) and then return `error`.

Normal exhaustion does **not** call either helper. `for_of_next` continuation 40 (`iterationStepResult` in `phase4-iteration.js`) stores undefined over the stack record when the step result is the record. `iterator_close` only calls 1272 when the popped record is tag 4 (`phase4-iteration.js` `iterator_close` case). `return` must not run on that path.

## Exact stack

`for_of_start` (`phase4-iteration.js`): pop the iterable, `slot = sp`, push record placeholder, next placeholder `V(1274,0,11,0)`, marker `V(0,1,9,0)`, then the open call. Continuation 41 writes the record into `stack[slot]` and does not push. After open:

```
stack[slot+0] = record     tag 4 while live, tag 3 (undef()) when exhausted
stack[slot+1] = next       tag 11, id 1274
stack[slot+2] = marker     tag 9, y = 1, x = 0
sp            = slot+3
```

`raise` reads a slot only after `sp--`. When the value is the marker, `sp` is the marker index, so:

```
stack[sp]   = marker   (consumed; not live once sp stays here)
stack[sp-1] = next
stack[sp-2] = record
```

Worked example, `slot = 10`:

```
index 10 record
index 11 next
index 12 marker
sp = 13
```

### Body / destructuring throw (record still live)

No step frame is current. `throw` (`shader.js` case `throw`) pops the thrown value and calls `raise`. It does not call `finish`. With no extra temps, `sp` is 13.

1. `sp--` → 12, value is the marker (`z == 9`, `y == 1`).
2. Record `stack[10]` is tag 4. Stop the scan (`suspendClose`). Do not look at outer catches yet.
3. `sp` stays 12. Push `V(2440,0,11,0)`, the record, the error (indices 12, 13, 14). `call(l, 2, false, false)` sets the new frame's `base` to 12.
4. Set that frame's `tail` to 80 and `receiver` to the error value. `call` uses `tail = false`, so it does not enter `finish`.

`next` is intentionally left at index 11. QuickJS drops the next method before `JS_IteratorClose`; dropping it here would move the record and break the `sp-2` index. The placeholder is tag 11 (not a heap object).

While 2440 runs, `sp == frame.base == 12`, so `collect`'s `i < sp` loop still marks the record at index 10. The error is marked because it is `frame.receiver` (`markValue` on every frame). Both are also copied into the callee's argument cells until `finish` pops that frame.

### Continuation 80

`finish` (`shader.js` `fn finish`) pops the close frame first (`depth--`, `sp = frame.base` = 12), then runs the tail. Tail 80 is **not** inside `raise`. The arm is:

```
else if(continuation==80u){raise(l,returned);}
```

`returned` is whatever 2440 returned, which is the original error. This is a new `raise` invocation from `finish`, not a recursive call (WGSL forbids `raise` calling `raise`, and `raiseIteratorCloseWGSL` does not). `finish` pops the frame before the continuation, so the close frame's argument cells are no longer roots; the error is in `returned` and then in `raise`'s parameter. GC runs only at instruction boundaries, not mid-`finish`.

Resumed `raise` starts at `sp == 12` (marker already consumed):

1. Pop index 11 (next). Not a catch.
2. Pop index 10 (record). Not a catch. The record leaves the stack here.
3. Keep scanning. An outer `y == 0` catch gets `push(error)`. Another `y == 1` marker whose record is still tag 4 suspends again (nested for-of: inner marker is higher, so it closed first).

### Step-helper throw (frame.tail == 40)

`for_of_next` (`phase4-iteration.js`) with offset 0: `index = sp - 3 = slot`, push step callee and the record argument, `call`, then set `frame.tail = 40` and `frame.receiver = V(slot, 0, 0, 0)`. That receiver is the **record index**, not the error (`z == 0`, so `markValue` does not treat it as a heap pointer).

Example: callee at index 13, argument at 14, helper `frame.base = 13`. During the helper, `sp` starts at 13. The marker at 12 is below the helper frame.

`throw` pops the thrown value and calls `raise`. Compare `finish`: `finish` is only reached from `return` / tail calls. It would pop the tail-40 frame and run continuation 40 (`iterationStepResult`), which consumes a **return value**, not a throw. A step throw must not take that path. `raise`'s loop (`shader.js` `fn raise`) scans operands while `sp > frame.base`, and only then executes `depth--`. So:

1. Helper temps above `base` are scanned first (a `y == 0` catch inside the step handler stops here; the record is **not** cleared; tail 40 is not popped).
2. If `sp == base` (no leftover temps — the throw already popped the error), the frame is popped **before** parent operands are scanned. The marker is a parent operand, so it is still on the stack below the helper frame and is visible only after this pop.
3. On that pop, if `tail == 40`, store `undef()` (tag 3) at `stack[receiver.x]` (`stack[slot]`). This is `js_for_of_next` (`vendor/quickjs.c`): on an abrupt `IteratorNext` it sets the enum slot to undefined **before** the exception handler reaches catch-offset 0. `return` must not run when `next` throws. The error argument is unchanged.
4. `depth--`. Scan the parent from `sp == 13`: the first value is the marker at 12. `stack[sp-2]` is now tag 3, so the marker is ignored and the scan continues with the same error. Callee (index 13) and argument (index 14) are at and above `base` and are not scanned; `call` had already set `sp = base`, so they were not live during the helper. The closure stays rooted by the env (`environment` stores it in the kind-4 header, and `collect` marks `frame.env`) until this pop.

An outer catch below the for-of triple is then found normally and receives the original error.

### Kind 1/2

A body throw still sees a tag-4 record, so it still calls 2440. The guest sees `kind !== 3`, clears `record.object`, and returns the original error. No `return` method is read. The tail-40 clear is kind-independent: a throwing step never calls 2440.

## `finish` / `raise` check

- `fn finish` (`experiments/quickjs-runtime/shader.js`): walks frames, sets `sp = frame.base`, and dispatches `frame.tail`. Tail 1 keeps walking. Other tails, including 40 and 80, stop the walk. Completion writes stay after the loop. 80 must be an `else if` on `continuation` before `else if(!omitResult)`, otherwise a returned error would be pushed as a normal value and the throw would end.
- `fn raise`: one forward scan. Operand pop (`sp--`) while `sp > frames[depth].base`; `depth--` only when the current frame's stack is empty. Then it writes `depth`, `sp`, and `env` once. The patch keeps that shape (no early `return`, no call to `raise`). The new `y == 1` arm sets `suspendClose` and the loop condition stops the scan. The epilogue performs the 2440 call.
- Opcode `throw`: `let value=pop(l); raise(l,value);`
- Status 4/5/8 builds an error object and calls `raise` the same way, after setting `status` back to 0. A guest `try` inside 2440 is a real catch marker (`y == 0`) on that helper's stack, so a TypeError from `__lanesCall` is caught by the bootstrap `try` and the helper returns the original error.

If 2440 is not registered as a guest closure, `call` can finish in-line (`objectMethod` sets status 6 for `id >= 150`) and `raise` must not recurse to resume the scan. The epilogue publishes the original error as status 7 in that failure. A real guest always increases `depth`; set tail 80 and the receiver only then. `sp+3 > stack limit` is status 3 and does not pretend to close.

## GC summary

The error is rooted as the close frame's receiver. The record remains on the stack under the call until continuation 80 re-enters `raise` and pops it (`next` at `sp-1`, then the record at `sp-2`). Kind 50 is not used.
