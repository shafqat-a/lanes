# Phase 4 next wave — worker 7: function/class metadata and constructor/new.target/super audit

Files (worker-owned): `phase4-next-w7-cases.js` (78 executable fixtures:
76 value + 2 uncaught-error; 3 declared status-6 boundaries; 2 compiler
rejections), `check-phase4-next-w7.mjs` (host check), this file. No
`phase4-patches/w7next-*.diff` was needed. Reservations 2140–2159 and
continuations 68–69 are **unused**. No fixed nodes, heap kinds, OP/FIELDS
entries or bindings were added.

Previous-wave `phase4-patches/w7-annexb-*.diff` (Annex B, worker 7 of the
earlier wave) are already applied to `vendor/quickjs.c` (PHASE-4-STATUS.md
delegation table) and are unrelated to this audit; they were not redone.

## Result: no confirmed defect

Every fixture agrees in V8 and the pinned native QuickJS (no
`quickjsDeviation` needed) and packs with the coordinator compiler, and
every packed opcode has a WGSL case. I also traced each fixture by hand
through the WGSL paths it reaches (listed below). None reaches an incorrect
WGSL path, so nothing is proposed for shared files. **GPU execution is
still pending**: the fixtures need to go through the M1/Safari harness
once the lead registers them (see "Integration").

| Area | Fixtures | WGSL path traced (shader.js / phase4-classes.js) | Verdict |
|---|---|---|---|
| ordinary function `length`/`name`/`prototype` order + descriptors | fn-meta 1–6 | `closure()` prepends length(8), name(8), prototype(2); `ownKeys` writes named keys backwards → `length,name,prototype`; `prototype.constructor` marked 10; `descriptor()` allows a value change on a configurable non-writable property; strict `putProperty` on marked-8 → status 4 | pass |
| class `length`/`name`/`prototype`, static/proto element order, merges | class-meta 1–11 | `define_class` inserts prototype (marked 0) at the head of the backing list and renames `name` in place (`functionName` force); `classDefineMethod` overwrites existing configurable keys in place (duplicates and get/set merges keep their first position), marked 10; non-configurable `prototype` → TypeError | pass |
| anonymous class names before static initializers | naming 10 | QuickJS `set_class_name` patches the `define_class` atom (or emits `define_class_computed`), so the name exists before static fields and blocks | pass |
| methods/accessors/arrows not constructors | non-ctor 1–3 | `construct()`: `(info.w&0x10000)==0 && classFlags&1==0` → status 4 (QuickJS `has_prototype` is false for methods, accessors, arrows and class ctors) | pass |
| `Function.prototype` | non-ctor 4–5, instanceof 4 | node 3 has name "" / length 0 (marked 8), constructor = 500; builtin 400 call → undefined; `construct` on 400 → status 4 | pass |
| bound functions | bound 1–6, instanceof 1 | `bindFunction`/`boundStorage`: HasOwnProperty(length) → ToIntegerOrInfinity − argc clamped at 0 (Infinity kept), name `"bound "`+ string or "", keys `length,name`, [[Prototype]] = target [[Prototype]]; `construct` swaps NewTarget F→target; `instanceOf` unwraps bound chains | pass |
| NamedEvaluation positions | naming 1–11 | QuickJS emits `set_name`/`set_class_name` in var/let/const, default params, object/array/assignment destructuring defaults, object literal values (incl. computed), `=`, parenthesized RHS, `||=`/`&&=`/`??=`; no naming for member targets, comma expressions or `__proto__:` values; `functionName(force=false)` only replaces an own `""` | pass |
| class ctor [[Call]], new.target | ctor 1–8, error 1 | `check_ctor` (also emitted in explicit derived ctors), `init_ctor` checks env.w; `construct` records NewTarget in env.z/w for every closure; arrows and parameter initializers capture via QuickJS locals; tail calls from constructor frames unwind to the tail-3 frame in `finish()` | pass |
| derived constructors | derived 1–6, error 2 | `get_loc_checkthis` → `get_loc_check` (ReferenceError), `check_ctor_return`, `put_*_check_init` second-init ReferenceError after the base ran, super() inside an arrow through `put_var_ref_check_init` | pass |
| super property semantics | super 1–13 | `classSuperSet` (OrdinarySet with receiver this: defines on this, inherited setter with this, non-writable/frozen → status 4), `get_super_value` getter receiver, `get_array_el` w=1 patch for `super.m()`, dynamic home [[Prototype]] after `setPrototypeOf`, null home prototype → status 4 for get and put | pass |
| `extends` | extends 1–5 | `define_class`: null → protoParent 0 / ctorParent Function.prototype, `init_ctor` into builtin 400 → status 4; `classIsConstructor` false → 4; prototype not object/null → 4; bound parent without/with `prototype` | pass |
| instanceof | instanceof 1–4 | primitive LHS → false before the prototype read; non-callable RHS or missing prototype → 4 | pass |

## Declared boundaries (fail closed, recorded with normative results)

- `w7NextUnsupportedCases` (status 6):
  - Own `caller`/`arguments` queries on any guest closure, including strict functions, where ES2025 answers "no own property" (`functionKey`).
  - `Function.prototype.call` (and apply/bind/toString) `name`/`length`: ids 401–404 have no metadata branch in `getProperty`.
  - `[[OwnPropertyKeys]]` of sloppy closures (`ownKeys` strict gate).
- Optional narrowing (**not a defect**, no patch proposed): sloppy arrows and methods have well-defined keys `length,name` in both V8 and QuickJS. The `ownKeys` gate could become `strict==0 && hasPrototype`. It is left alone because it currently fails closed.
- `w7NextRejectedCases`: `Reflect.construct` (new.target ≠ callee) and `Symbol.hasInstance` stay compiler-rejected ("Unsupported global or module reference"). **Phase 3 hook:** when Symbol lands, `instanceOf()` in shader.js must first run `GetMethod(C, @@hasInstance)` and then fall back to OrdinaryHasInstance. Likewise `Function.prototype[@@hasInstance]` must be added to node 3. Reflect.construct needs the `construct()` NewTarget admission (today status 6 when NewTarget ≠ callee and is not a guest closure).

## Integration (lead)

- Run `node experiments/quickjs-runtime/check-phase4-next-w7.mjs` (host only).
- To run the fixtures on GPU, register `w7NextCases`/`w7NextErrorCases`/`w7NextUnsupportedCases` in `phase4-case-groups.js` and the suite the same way as `classElementCases` (`area` keys: fn-meta, class-meta, non-ctor, bound, naming, ctor, derived, super, extends, instanceof). No shader/program change is required.

## Commands run

| Command | Result |
|---|---|
| `node experiments/quickjs-runtime/check-phase4-next-w7.mjs` | passes: 81 admitted programs pack with WGSL for every opcode (103 distinct opcodes); V8 78/78, native QuickJS 78/78, 0 deviations; 3 unsupported pack; 2 rejected stay rejected; WGSL metadata anchors present |
