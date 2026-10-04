# Iterator record (phase 6, w2)

Guest sources in `sources.js` replace `iteratorOpen` and `iteratorStep` in `experiments/quickjs-runtime/phase4-iteration.js`. Splice the strings only. Do not rename the functions: they stay `iteratorOpenBootstrap` and `iteratorStepBootstrap` (the intrinsic root is the first compiled function, which is where `__lanes*`, `Symbol`, `Array`, and `String` resolve). These sources reference none of `Array` or `String`, and they reference no `__lanes*` / `Symbol` / `TypeError` inside a nested function. There is no nested function.

Opcodes do not change. `for_of_start` is still helper **1270** (`ITERATOR_OPEN`) and `for_of_next` is still helper **1271** (`ITERATOR_STEP`). Continuation **41** still stores the open result into the `for_of_start` slot. Continuation **40** still treats “step result is the same object as the record” as done, writes `undefined` over that slot, and pushes `undefined, true`. `iterator_close` (1272) is not modified.

## Record contract

`__lanesDescriptor()` (builtin 112) allocates the record: a null-prototype object, never returned to user code. It lives in the `for_of_start` stack slot (or in a helper local). Successful generic open always stores:

| field | value |
|---|---|
| `kind` | `3` |
| `iterator` | the iterator object |
| `next` | `Get(iterator, "next")` captured once at open |
| `object` | `undefined` |
| `index` | `0` |

`next` is not checked for callability at open (spec Get, not GetMethod) and is not called from open. Later writes to `iterator.next` are ignored. Step uses the snapshot.

Done sentinel: when iteration completes, step sets `record.iterator = undefined` and **returns the record itself**. It does not return the iterator result or any other user-visible `{ done, value }` object. Continuation 40 then replaces the stack slot with `undefined`, so `IteratorClose` is skipped. A later step that still sees the record (`kind === 3` and `iterator === undefined`) returns the record again and performs no Get and no Call. `next`, `object`, and `index` are left as they were. Only `iterator` is cleared, and only after a truthy `done`.

Kind `1` (array / arguments: ToLength of `length`, then the index) and kind `2` (UTF-16 code point via `__lanesCharCodeAt` / `__lanesSlice`) stay in the step body for records already shaped that way. Open no longer produces them and no longer calls `__lanesIterationKind` or `__lanesUnsupported`. After the splice, arrays and strings iterate only by calling their `@@iterator` method and then `next`; the record is kind 3.

## GetIterator (`iteratorOpenBootstrap`)

1. `null` or `undefined`: `TypeError("Value is not iterable")` before any Get, including before `Symbol.iterator` is read. No fast path.
2. `method = value[Symbol.iterator]`. `Symbol` is the intrinsic-root capture of builtin 1000. A getter throw propagates with the same identity.
3. `method` `null` or `undefined`: `TypeError("Value is not iterable")`. Not status 6.
4. `typeof method !== "function"`: the same TypeError. Not status 6.
5. `iterator = __lanesCall(method, value)` (builtin 113). The receiver is the iterable. A throw propagates. There is no iterator record yet, so nothing is closed.
6. `null`, or not an object and not a function: `TypeError("Iterator is not an object")`.
7. `next = iterator.next` (getter runs now, once).
8. Store the fields above and return the record. Do not call `next`.

Symbols, bigints, numbers, booleans, plain objects, and functions that do not have `@@iterator` throw `TypeError("Value is not iterable")`. They are not `__lanesUnsupported`.

## IteratorNext (`iteratorStepBootstrap`)

Kind other than 3: the phase-4 step body, unchanged (exhausted check clears `object` before the length/index gets, so an abrupt length or index get leaves the record exhausted).

Kind 3:

1. `iterator === undefined`: return the record (already exhausted).
2. Read `record.next`, then `record.iterator`. If `typeof next !== "function"`, `TypeError("Iterator next is not a function")`. Do not clear `iterator` (close must still see it).
3. `result = __lanesCall(next, iterator)`. A throw propagates and does not mark the record done.
4. `null`, or not an object and not a function: `TypeError("Iterator result is not an object")`. Do not clear `iterator`.
5. `done = result.done` **before** any read of `value`. A throw from the `done` getter propagates with `iterator` still set, and `value` is not read.
6. Truthy `done`: set `record.iterator = undefined` and return the record. Do not read `value`.
7. Otherwise `value = result.value` and return that value. A throw from the `value` getter propagates with `iterator` still set.

## Continuations 76-79

Reserved for this assignment and **unused**. Open and step are ordinary guest functions. Property Gets (including accessors) and Calls (`__lanesCall`, and the callee’s own body) suspend and resume on the existing guest call stack. They do not need a new `finish()` continuation. 76, 77, 78, and 79 must not be assigned to another protocol. Continuations 40 and 41 stay the opcode tails for 1271 and 1270.

## Host check

`simulate.js` exports `simulateOpenOrder(value, log)` and `simulateStepOrder(record, log)` for a scripted iterable (real `@@iterator` / `next` / `done` / `value` getters). `node --test experiments/quickjs-runtime/phase6-protocols/w2-iterator-record/w2.test.js` runs those and the same scenarios through the guest strings (`compileGuestIterators`). No GPU, no Dawn.
