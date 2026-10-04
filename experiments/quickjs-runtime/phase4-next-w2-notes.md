# Phase 4 next wave — worker 2 (public class instance fields) notes

Scope: review/harden the lead's public instance field implementation
(`phase4-class-elements.js`, `phase4-classes.js`, shader `define_field` /
`define_array_el` → `defineOwnData`). No shared file was edited. Host-only:
no GPU execution, no CPU replay. No builtin IDs, heap kinds, continuations or
fixed nodes were used (reservations 2020–2039 / 58–59 stay unused).

## Files (new, worker-owned)

- `phase4-next-w2-cases.js` — fixtures (same shape as `phase4-class-element-cases.js`):
  - `w2FieldCases` 51 value fixtures, `w2FieldErrorCases` 3 uncaught-error fixtures;
  - `w2FieldFixedCases` 4 value fixtures admitted by the lead-applied w2 patches (formerly 2 status-6 boundaries + 2 pinned-QuickJS over-rejections; `fixedBy` records the patch);
  - `w2FieldRejectedCases` 7 early errors (must stay SyntaxError).
- `check-phase4-next-w2.mjs` — host check (V8 `node:vm` oracle + input+1 sensitivity, private native QuickJS from `vendor/`, packing with `generated/compiler` + `program.js`, WGSL case per packed opcode, rejection messages, presence of the applied fixes, native/Wasm compiler parity).
- `phase4-patches/w2-define-own-data.diff`, `phase4-patches/w2-instance-prototype-field.diff` — the shared edits, now **applied by the lead** (with generated/compiler and generated/compiler.mjs rebuilt).

Coverage: init order (base: after this binding, before body; derived: after
argument evaluation and base body, before code after `super()`; on return
override objects; base fields stay on the discarded base `this`), earlier/later
field visibility, duplicate names, `a;` without initializer, define semantics
(own-class and inherited setters/getters not invoked; frozen / sealed /
non-extensible overrides; non-writable-configurable redefinition; key position
preserved; function, Array, String wrapper, Error and unmapped-arguments
overrides; `__proto__` field is an own property), constructor return cases
(derived undefined/object/primitive/null, with and without `super()`; base
object/primitive), computed keys (evaluated + ToPropertyKey'd once at
definition, interleaved with computed methods and static fields, toString →
valueOf order, TypeError when no primitive, abrupt identity, primitive keys
incl. -0/true/null/undefined, re-evaluation per class evaluation, computed
`'constructor'`), function naming (parenthesised, named, numeric, computed,
class, comma expression → ''), static `name` method kept, numeric literal names
(0x10, 1.5, 1e3), contextual keyword names (`get`, `set`, `static`, `async`),
`super` get/set and `new.target` in initializers, nested function `arguments`
/ `this`, initializer exception identity (base and derived), per-instance
evaluation, `super()` twice (base runs twice, fields once, ReferenceError),
GC survival of field values.

## Commands and exact results

After the lead applied the patches (current state):
`node experiments/quickjs-runtime/check-phase4-next-w2.mjs` → exit 0:
`admitted 54, fixedAdmitted 4, v8 58, native 58, nativeDeviations [],
rejected 7, fixesPresent [array-length, mapped-arguments,
instance-prototype-field], opcodes 89, wasmParity {identicalPrograms 58,
bothRejected 7}, failures []` (`gpuChecks: false, guestExecution: false`).
Every packed opcode has a WGSL case. V8 and native QuickJS (built from the
patched `vendor/`) agree on all 58 executed fixtures; all 7 early errors are
SyntaxErrors in V8, native QuickJS and both compilers.

Native/Wasm parity: `generated/compiler` and `generated/compiler.mjs` (via
`compiler.js` `createCompiler`) pack all 58 admitted fixtures to identical
`code` and `image`. All 7 early errors are rejected with SyntaxError by both;
for 4 of them (field/static field named `constructor`, static `prototype`)
the Wasm path reports the front-end parser text ("Classes can't have a field
named 'constructor'") instead of QuickJS's "invalid field name"/"invalid
method name". This is only the order of checks in the harness: `compiler.js`
calls `entrySource(source)` before compiling, whereas this script's native
`pack` calls the compiler first. The rejection outcome is the same.

Before the patches (initial run): `admitted 54, v8 56, native 56, boundary 2,
rejected 7, overRejected 2, failures []`; the diffs were verified to apply
exactly once, and a scratch-patched native QuickJS gave the normative results.

## Defects found and shared edits (all applied by the lead)

1. **Class field named `length` on an Array receiver is status 6, but is always
   a TypeError** (Array `length` is non-configurable; CreateDataPropertyOrThrow
   with `{configurable:true}` always rejects). File
   `phase4-class-elements.js` (`classElementWGSLFunctions`, `defineOwnData`):
   - old: `if(kind==7u&&lengthKey(l,key)){states[l].status=6u;return;}`
   - new: `if(kind==7u&&lengthKey(l,key)){states[l].status=4u;return;}`
   Safe for object/array literals (fresh ordinary objects are never kind 7 on
   `define_field`; array literals only define index keys). Fixture: "array
   override: length field throws TypeError".

2. **Mapped arguments override (sloppy base function `return arguments`) is
   status 6**; ES2025 10.4.4.2 keeps the mapping and writes the parameter
   binding. Same function, before the kind 3/9 check:
   - add: `if(node.kind==15u){if((node.marked&8u)==0u){states[l].status=4u;return;}states[l].heap[node.value.x].value=value;states[l].heap[property].marked=14u;return;}`
   Fixture: "sloppy base returns mapped arguments: field keeps the mapping"
   (expects `o[0]` and the parameter both equal x).
   Both edits: `phase4-patches/w2-define-own-data.diff` (verified by the check
   script to apply exactly once to `phase4-class-elements.js` and to the
   generated shader text; brace balance checked; not a WGSL compile). Applied;
   the two fixtures are now in `w2FieldFixedCases` and the check asserts the
   fixed lines are present in `phase4-class-elements.js` and the shader (and
   the old status-6 line is gone). WGSL still needs an M1/Safari compile.

3. **Pinned QuickJS rejects valid instance fields named `prototype`**
   (`class K { prototype = 1 }`, `'prototype' = 1`) with "invalid field name";
   ES2025 only forbids `constructor` (any field) and static `prototype`.
   Today this is an explicit compiler rejection (no wrong semantics).
   `vendor/quickjs.c` js_parse_class (line ~25701):
   - old: `if (name == JS_ATOM_constructor || name == JS_ATOM_prototype) {`
   - new: `if (name == JS_ATOM_constructor || (is_static && name == JS_ATOM_prototype)) {`
   `phase4-patches/w2-instance-prototype-field.diff`; verified by building a
   scratch patched native QuickJS: both over-rejected fixtures give the
   normative result, all 7 early errors still throw SyntaxError, all 56
   admitted/boundary fixtures unchanged. Applied by the lead with both
   compilers rebuilt; both fixtures are now admitted (`w2FieldFixedCases`),
   pack identically with the native and Wasm compilers, and the check asserts
   the patched condition in `vendor/quickjs.c`. The runtime needs no change
   (`define_field "prototype"` is an ordinary define on the instance).

No defect was found in initialization order, return handling, computed-key
evaluation/ToPropertyKey order, naming, `super`/`new.target` in initializers or
double `super()`; the host oracles and the packed bytecode agree with the
lead's description. GPU behaviour of all fixtures is unverified (WGSL for the
class-element cases has never been compiled; coordinator M1/Safari obligation).

## Remaining boundaries (explicit, unchanged)

- Fields on the `__proto__` accessor holder (a base returning `Object.prototype`)
  and on other non-kind-3/9 property nodes: status 6.
- Fields named `caller`/`arguments` on function receivers: status 6 (functionKey).
- Fields on unmapped built-in function receivers (tag 11 not mapped by
  objectView) and pending prototype gaps (Math/Number/JSON/String/Number
  prototypes): status 6.
- Symbol-keyed computed fields: no Symbols yet; `keyOf` returns status 6 for
  non-string/number keys after ToPropertyKey. Phase 3 hook: `keyOf` must accept
  tag-17 values, and `to_propkey`'s canonical-key fast path (keySlot) must treat
  symbols as canonical; `defineOwnData` needs no change.
- Async/generator initializer values: compiler-rejected (Phase 6).
