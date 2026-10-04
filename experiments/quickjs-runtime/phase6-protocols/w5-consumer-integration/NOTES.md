# W5 consumer integration

Generic iterator records (open 1270, step 1271, close 1272) feed every consumer that walks `@@iterator`. Object spread does not. `spreadAppendSource` in `index.js` is the replacement for `phase4-spread.js` `spreadBootstrapSources.spreadAppend`. It does not read `__lanesIterationKind` and does not call `__lanesUnsupported`. A `TypeError` from open propagates. That covers null, a symbol, and a plain object with no `@@iterator`. It is not a status-6 downgrade.

Open, as upgraded: Get `@@iterator`, call it, snapshot `next`, `TypeError` (not status 6) when the method is missing or not callable. Step: call the snapshotted `next`, read `done` before `value`, return the record itself as the done sentinel and clear the live slot. Close: `IteratorClose` `return` on a normal break, return, or short destructuring pattern, only while that slot is still live.

## Array spread and spread arguments (`append` → `spreadAppend`)

`[...obj]` and `f(...obj)` / `new F(...obj)` / `o.m(...obj)` lower to `append` (`phase4-spread.js`, QuickJS `js_parse_array_literal` and `js_parse_postfix_expr` both emit `OP_append`; the `for_of_start` alternative in `vendor/quickjs.c` is inside `#else` and is not what the compiler emits). `append` is one guest call, helper 1210 `spreadAppend(array, position, iterable)`. There is no `for_of_start` marker on the stack inside that call.

Observable order for a custom iterable:

1. Get `@@iterator` on the operand (a getter runs here).
2. Call that method with the operand as `this`. A non-object result is `TypeError`.
3. Get `next` once and snapshot it. Later steps do not re-get `next`.
4. Call `next`.
5. Get `done` on the result, then ToBoolean. If `done` is true, do not get `value`. Step returns the record. `spreadAppend` sees `value === record` and returns the new index.
6. If `done` is false, get `value`, then `__lanesDefine` a writable, enumerable, configurable data property at the index. That is `CreateDataPropertyOrThrow`, not `[[Set]]`, so an `Array.prototype` index setter does not run.
7. Repeat from step 4.

Close:

- Exhausted: close is not called. Step already cleared the live slot and returned the record as the done sentinel. `ArrayAccumulation` (`SpreadElement`) returns `nextIndex` on a done `IteratorStepValue` and never calls `IteratorClose`. `spreadAppend` does not call `__lanesIteratorClose`.
- `next` throws: the exception propagates out of step and out of `spreadAppend`. Close is not called. That matches `IteratorNext`: a throw from `next` sets `[[Done]]` and is returned as the throw. The throw is the iterator's own exception.
- A `value` getter throw is also inside step (`IteratorValue` / `IteratorStepValue` sets `[[Done]]` and rethrows). Same path: no close.
- If `__lanesDefine` threw, this helper would also skip close. There is no `try`/`finally` and no for-of marker to catch it. Define on the fresh array built by `array_from` in this frame does not throw. The spec writes `! CreateDataPropertyOrThrow` for that step for the same reason.
- A later consumer of the element (the callee, or an element after the spread) is outside this helper. It is not an iterator close.

QuickJS `js_append_enumerate` calls `JS_IteratorClose` on its C exception label. Do not copy that into `spreadAppend`. The spec spread algorithms do not close, and a throw from `next` must not call `return`.

Null spread, symbol spread, and plain-object spread: open throws `TypeError` before any step. The helper does not catch it. Guest `try`/`catch` around the spread can see it. Missing `@@iterator` is that `TypeError`, not an empty array and not status 6.

An overridden `Array.prototype[@@iterator]` is an own or inherited method. Open gets and calls it. The old kind-1 fast path must not skip the override. String spread goes through the same open: `String.prototype[@@iterator]` yields code points, so a surrogate pair is one element and a lone surrogate is one element.

## for-of

`for (lhs of obj)` already emits `for_of_start`, `for_of_next`, and `iterator_close` (`phase4-iteration.js`). Those opcodes call 1270 / 1271 / 1272. No new opcode is required.

Order: open (Get `@@iterator`, call, snapshot `next`), then each step (call `next`, `done`, then `value` only when not done), then the body. An overridden array `@@iterator` is called because open does the Get. The intrinsic array and string paths are only a fast path after that lookup says the method is the unmodified intrinsic.

Close:

- `break`, `continue` to an outer label, and `return` emit `iterator_close` while the record is live (`emit_break` / `emit_return` when `has_iterator`). The `return` method runs. The fixture observes that by a code the function returns.
- Normal exhaustion: step returns the record sentinel and clears the slot. `for_of_next` stores `undefined` over the stack record (`iterationStepResult`). The `iterator_close` after the loop then sees no live record and does not call `return`.
- A throw from `next` is the iterator's exception. Step clears the slot / sets done before the throw propagates, so the close-on-throw path must not call `return`.
- A throw from the body, or from evaluating the assignment target after a value was produced, is a different completion. The record is still live. The close worker calls `return`, then the original throw continues. The opcodes already close on `break`; close-on-throw is that worker, not this helper.

## Array destructuring, including rest

`[a, b] = obj` and `[...r] = obj` use the same iterator opcodes, not `append`. QuickJS `js_parse_destructuring_element` emits `for_of_start`, then per element `for_of_next` (elisions drop the value), and for a rest element `js_emit_spread_code`: `array_from 0`, `push_i32 0`, loop `for_of_next` with offset `2 + depth`, `define_array_el`, `inc`. After the pattern it always emits `iterator_close`.

- Stopping early (`[a, b]` while `next` would still yield) leaves `[[Done]]` false. `iterator_close` calls `return`. The function still has the bound values.
- Exhaustion (`[...r]`, or a binding whose step returns done) makes step clear the slot. `iterator_close` does not call `return`. The function still returns the values taken before done. Exactly two yields and exactly two bindings is not exhaustion: `done` was never observed, so `return` still runs.
- A throw from `next` does not call `return` (slot cleared, done set). A throw from a default or from `PutValue` after a value was produced does call `return`.

## Rest parameters

`function g(...r)` is not an iterator consumer by itself. Confirmed in `phase4-spread.js` (rest parameter lowers to `` `rest first` `` at function entry) and in `vendor/quickjs.c` `js_parse_function_decl2`: `OP_rest` with the first rest index, then `put_arg`. `OP_rest` copies `argv[min(first, argc) .. argc)` into a fresh array. It does not call `GetIterator` and it does not call `spreadAppend`.

A custom iterable reaches that rest parameter only through a spread argument at the call, `g(...iterable)`. That call emits `append`, so the elements are produced by `spreadAppend` (open / step / define, no close on exhaustion or on a throw from `next`). `apply` then invokes `g`, and `rest` only repackages those already evaluated arguments. Rest of a custom iterable depends on `append` → `spreadAppend`. The `rest` opcode does not grow a second iterator walk.

## Object spread stays `copy_data_properties`

`{...o}` and object rest in destructuring are not iterator consumers. `phase4-object-spread.js` lowers `{...e}` to `object; <e>; null; copy_data_properties` and object rest to `copy_data_properties` with an excluded-key object. The guest helper is `copyDataPropertiesBootstrap`: null or undefined returns the target; otherwise `__lanesToObject`, `__lanesOwnPropertyKeys`, and a per-key enumerable own-property copy via `__lanesDefine`. It never calls `__lanesIteratorOpen`. Do not switch it to iterators.

An own `@@iterator` on the source is ignored. Enumerable string keys are copied in own-key order. Enumerable symbol keys are the separate own-key feature already implemented at `__lanesOwnPropertyKeys` (symbol keys after string keys). They are not this worker's protocol and they are not produced by iterating `@@iterator`.

Null or undefined object-spread sources do not throw. That is `CopyDataProperties`, and it is different from array spread, which TypeErrors.
