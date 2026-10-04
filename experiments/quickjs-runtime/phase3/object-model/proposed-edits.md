# Proposed core edits

No confirmed ordinary-object defect. Do not apply a shader, program, or bootstrap patch from this assignment.

## Not proposed

`OP_set_proto` in `shader.js` (`cases('set_proto')`) writes `[[Prototype]]` without the cycle, extensibility, and immutable-prototype checks inside `setPrototype`. That branch is not a confirmed defect:

- A fresh object literal is extensible and is not `Object.prototype`.
- The literal is not a guest-reachable value while the `__proto__` expression runs, so the cycle walk cannot see it. Proxies are unsupported. `define_field` uses `CreateDataProperty` and does not call setters.
- `var self = {__proto__: self}` evaluates the proto to `undefined`, which both ES and QuickJS ignore. `let` is a temporal-dead-zone `ReferenceError` before `set_proto`.
- No local test constructs a literal prototype cycle.

Do not replace the opcode body with a call to `setPrototype`. `setPrototype` throws status 4 when the proto is neither an object nor null. Object-literal `__proto__` must ignore those values (`shader.js` already does, and so does QuickJS `OP_set_proto`).

Integer keys are not sorted as strings. `ownKeys` and `arrayIndex` already put `"2"` before `"10"`. Do not add a lexicographic sort.

Accessors are kind 9, with getter and setter continuations (tag 12). Do not replace them with data properties and do not add an `Unsupported` rejection for `get`/`set`.

`name` and `length` are already `marked=8` (configurable, not writable, not enumerable). Do not make them enumerable.

## IDs and kinds

No new builtin id. No new opcode. No heap kind 22. No use of kinds 17..21 or 23..39, tags 17..18, nodes 23..31, or continuations 40..71.
