# Object model contract (assignment 6)

Phase 3 is not complete. This directory is a host reference and an audit. No shared core file was edited. No GPU run. No Wasm rebuild.

## Correct in the engine already

Ordinary objects in `experiments/quickjs-runtime/shader.js` already follow the ES2025 rules this assignment covers.

- `[[OwnPropertyKeys]]` (`ownKeys`) lists canonical array indices ascending, then other strings in creation order. Property nodes are newest-first; named keys are written backwards. `"10"` is not ordered before `"2"`. `arrayIndex` treats `"4294967295"` and leading-zero strings as ordinary names. `object-operation-cases.js` expects `2,10,b,a` for `{b,10,a,2}` and `ba` after delete-and-readd.
- Redefining a property updates that node. Deleting unlinks it. Adding again prepends, so the restored key is last among strings. `setPrototype` changes only `value.x`, so a prototype write does not reorder keys.
- `descriptor()` is `ValidateAndApplyPropertyDescriptor`. Absent attributes on a new property are false. A non-configurable data property rejects a different value and rejects `writable: true` when it is already non-writable. The same value, including NaN via `sameValue`, is accepted. Changing `writable` from true to false on a non-configurable property is accepted. A new `[[Set]]` creates a writable, enumerable, configurable data property (`alloc` marked 14). A non-writable data `[[Set]]` fails in strict code with status 4 even when the value is unchanged.
- Accessors are real (kind 9). `[[Get]]` and `[[Set]]` return a tag-12 continuation for the getter or setter. A missing setter is status 4 in strict code. Mixed data/accessor descriptors are status 4. This is not a data-property fallback.
- Function `name` and `length` are `marked=8`: not enumerable, not writable, configurable. `cases.js` expects that descriptor, a failed assignment, a successful `defineProperty`, and inheritance from `Function.prototype` after delete.
- `setPrototype` throws status 4 (TypeError, message `Invalid operation`) on a cycle, a non-extensible target, and `Object.prototype` (node 1), unless the requested prototype is already the current one. That same-prototype request succeeds. Null is parent 0. `[[Get]]` and `in` walk the prototype. `ownKeys` does not.
- Status 4 is the precise failure for these ordinary rejections. Guest `ToPropertyDescriptor` keeps its own strings: `Invalid getter`, `Invalid setter`, `Mixed property descriptor`, `Descriptor is not an object`.

## Confirmed broken

None. `defects.js` exports an empty list. The checks are in `checked`.

`OP_set_proto` does not call `setPrototype`. That is not filed. The literal under construction is not reachable from its `__proto__` expression, non-object proto values must be ignored, and no local test builds a cycle. A patch that calls `setPrototype` would throw on those ignored values.

These stay explicit Unsupported (status 6), not silent successes and not defects to patch here: `Object.create` properties argument, sloppy-function `ownKeys`, `caller` / `arguments`, unmapped builtin objects used as prototypes, and unknown properties of the Object constructor.

## Proposed edits

None. See `proposed-edits.md`. The parent should not apply a core patch for this assignment.

## Tests

Host command:

`node --test experiments/quickjs-runtime/phase3/object-model/object-model.test.js`

The tests call `ordinary-object.js` only. They cover prototype cycles, null prototype, inherited `[[Get]]` / `has`, `ownKeys` excluding inherited names, integer order `"10","2","1"`, non-configurable redefinition, non-writable `[[Set]]`, non-extensible objects, `name` / `length` attributes, a symbol-kind key after strings, delete-then-readd, and `setPrototypeOf` to the current prototype. They do not use Dawn, WebGPU, or Wasm.

Result: 19 passed, 0 failed, 0 skipped (`duration_ms` 111.872206).

## Pending

- Symbol keys in the GPU runtime. String order is already the prefix of `OrdinaryOwnPropertyKeys`. Extending `__lanesOwnPropertyKeys` (1240) with a symbol tail is the symbol-keys worker's proposal. This module's extension point is key class 2, sorted after strings, stable by insertion, keyed by `{kind:"symbol", id}`.
- The status-6 gaps listed above.
- Phase 3 acceptance is still open. This assignment does not close it.

## IDs and kinds

None. No builtin in 1180..1199. No new opcode. No heap kind 22. No kinds 17..21 or 23..39. No tags 17 or 18. Nodes 23..31 untouched. Continuations 40..71 unused.
