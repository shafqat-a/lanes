# Phase 4 (synchronous language) — wave status and integration contracts

Owner: Phase 4 lead (single integrator for `vendor/`, `bridge.c`, `program.js`,
`shader.js`, `bootstrap.js`, `compiler.js`, `cases.js`, README/ROADMAP).
This file is the coordination record. It does **not** declare Phase 4 complete.

## Ground rules (all workers)

- Guest semantics execute only on the GPU through WGSL. Host code may parse,
  compile, pack and run *test oracles* (V8 `node:vm`, a native QuickJS
  interpreter built from `vendor/` in a private temp dir). No CPU replay.
- Unsupported forms fail explicitly: compiler rejection (`SyntaxError` from
  `program.js`), runtime status 6 (`Unsupported runtime operation`) or status 3
  (`Resource limit`). Never approximate symbol-dependent semantics.
- Do not run Node/Dawn GPU. Do not edit `node_modules` or the shared
  `generated/` artifacts except the lead rebuilding the native compiler.
- Workers build private compilers/interpreters under
  `experiments/quickjs-runtime/.phase4-build-<worker>-*` (delete afterwards).

## Runtime vocabulary (existing)

Value tags (`V.z`): 0 number, 1 boolean, 2 null, 3 undefined, 4 object,
5 guest function (closure node), 6 uninitialized (TDZ), 7 string, 9 catch
offset, 10 gosub return, 11 native/private builtin id, 12 accessor callback.
Phase 3 owns new tags 17, 18 (Symbol/BigInt). Status codes: 0 running, 1 done,
2 invalid bytecode state, 3 resource limit, 4 TypeError, 5 ReferenceError,
6 Unsupported, 7 uncaught guest exception, 8 RangeError.
Heap kinds 0–16 are in use; Phase 3 owns 17–23; Phase 4 owns 24–31.
`finish()` continuation codes (`Frame.tail`) 0–7 are in use.

## Phase 4 reservations

| Worker / area | Private builtin IDs | Heap kinds | Continuations (`Frame.tail`) |
|---|---|---|---|
| 1 template lowering | 1200–1209 | — | — |
| 2 rest / spread / apply / append | 1210–1239 | — | 44–45 |
| 3 object rest / spread | 1240–1269 | — | 46 |
| 4 array destructuring / iteration | 1270–1309 | 24–25 | 40–43 |
| 5 classes / super / new.target | 1310–1349 | 26–28 | 47–49 |
| 6 for-in / lexical TDZ | 1350–1369 | 29–30 | 50–51 |
| 7 this/arguments/declarations | 1370–1389 | — | — |
| 8 conformance (tests only) | 1390–1399 | — | — |
| lead spare | — | 31 | 52–55 |

New opcodes are **appended** to `program.js` `OP` (existing indices never change).

## Shared interface: synchronous iteration (owner: worker 4; consumers: 2, 3)

Guest-callable private builtins (resolved for bootstrap helpers through
`privateBuiltins`; each maps to a bootstrap helper field or a WGSL primitive):

- `__lanesIterationKind(value)` = **1273** (WGSL primitive). Returns a number:
  `0` symbol-dependent / not provably intrinsic (caller must invoke
  `__lanesUnsupported`), `1` intrinsic array-like iteration (Array exotic
  objects and arguments objects, whose `@@iterator` is `%Array.prototype.values%`),
  `2` string primitive or String wrapper (code-point iteration), `4` null or
  undefined (GetIterator throws TypeError). **This is the single choke point
  Phase 3 must update** when Symbol values become definable: kind 1/2 may only
  be returned while `Array.prototype[@@iterator]`, `String.prototype[@@iterator]`
  and `%ArrayIteratorPrototype%.next` / `%StringIteratorPrototype%.next` are the
  unmodified intrinsics and the object has no own `@@iterator`; otherwise 0.
- `__lanesIteratorOpen(value)` = **1270** → private iterator record (never
  guest-visible) or throws TypeError / reports Unsupported.
- `__lanesIteratorStep(record)` = **1271** → next value, or the record itself
  as the done sentinel. Array-like stepping performs observable `Get(length)`
  (ToLength) and `Get(index)` on every step, exactly like `%ArrayIteratorPrototype%.next`.
- `__lanesIteratorClose(record)` = **1272** → no-op for intrinsic iterators
  (they have no `return` method). Generic iterators with `return` belong to
  Phase 6 and must not reach this helper.

## Shared interface: own keys (consumers: 3, 6)

Today the runtime has no symbol keys, so string-keyed own-key order is exact.
Phase 4 helpers that need `[[OwnPropertyKeys]]` call `__lanesOwnPropertyKeys`
(**1240**, owner worker 3). Phase 3 must extend it to append symbol keys after
string keys (ES2025 OrdinaryOwnPropertyKeys order) when symbol keys exist.

## Actual use of reservations (end of wave)

| Area | Builtin IDs used | Heap kinds | Continuations | Opcodes appended |
|---|---|---|---|---|
| template | — (reuses 134 toText) | — | — | `to_string` |
| spread | 1210 | — | — (reuses 2) | `rest`, `apply`, `append` |
| object spread | 1240 (WGSL own keys), 1241 | — | — (reuses 2) | `copy_data_properties`, `to_object`, `swap2` |
| iteration | 1270–1273, 1274 (non-callable `next` placeholder) | — | 40 step, 41 open | `for_of_start`, `for_of_next`, `iterator_close` |
| for-in | 1350–1354 | — | 50 | `for_in_start`, `for_in_next` |
| classes | — | — (closure `value.z/w` = home/flags; env `value.z/w` = new.target; GC marks both) | — | `define_class`, `define_class_method`, `define_class_method_computed`, `set_home_object`, `check_ctor`, `check_ctor_return`, `init_ctor`, `get_super`, `get_super_value`, `put_super_value`, `insert4`, `dup3`, `perm5` |
| edge (W7) | — | — | — | — (two compiler patches) |

Iterator catch marker: `V(0,1,9,0)` (tag 9, y=1). `raise()` skips it; `nip_catch`
still stops at any tag 9 (QuickJS emit_return contract). Super base values from
`get_super` carry `w=1` so `get_array_el` passes `this` to inherited getters
(ES2025 super Reference thisValue; pinned QuickJS's own interpreter is wrong here).

## Delegation record (this wave)

Eight background subagents were launched in parallel (K = 8), each owning new
files only; the lead integrated everything into the shared files.

| Worker | Assignment | Delivered files | Integration by lead |
|---|---|---|---|
| 1 | template lowering | vendor patch (`js_parse_template`, `DEF(to_string)`, interpreter case), `bridge.c` features field, `template-cases.js`, `check-template-lowering.mjs` | `to_string` WGSL, `program.js` gate + tagged-template rejection, boxing/String-extract suite updates |
| 2 | rest/spread | `phase4-spread{,-cases}.js`, `check-phase4-spread.mjs` | registry wiring, cycle-free WGSL generator |
| 3 | object rest/spread | `phase4-object-spread{,-cases}.js`, `check-phase4-object-spread.mjs` | registry + objectMethod hook; renamed WGSL-reserved `target` |
| 4 | array destructuring / for-of | `phase4-iteration{,-cases}.js`, `check-phase4-iteration.mjs` | registry patches, `raise()` marker skip |
| 5 | classes / super / new.target | `phase4-classes.js`, `phase4-class-cases.js`, `check-phase4-classes.mjs` | 13 shader + 4 program patches; found and the lead fixed `@compute` placement |
| 6 | for-in / lexical TDZ | `phase4-for-in{,-cases}.js`, `check-phase4-for-in.mjs` | registry wiring; compiler-correctness controls flipped |
| 7 | this/arguments/declarations + Annex B audit | `phase4-edge-cases.js`, `phase4-edge-audit.md`, `check-phase4-edge.mjs`, `phase4-patches/w7-*.diff` | both diffs applied to `vendor/quickjs.c` |
| 8 | conformance / review | `phase4-regression-cases.js`, `phase4-suite{,-expected}.js`, `check-phase4-suite.mjs`, `browser-phase4.{html,js}`, `phase4-review.md` | `build-browser.mjs` emits `phase4.html` |

## Implemented (host-verified; GPU execution pending coordinator M1/Safari run)

- **Template literals (milestone 1):** untagged substitutions lower to
  `<expr> to_string add` per substitution (ToString with hint string immediately,
  no mutable `concat`). Tagged templates and `String.raw` stay compiler-rejected
  (`Unsupported tagged template`). The bridge advertises
  `features:["template-to-string"]`; `packProgram` rejects compiler output
  without it (`Rebuild the compiler bridge`), so the stale Wasm cannot silently
  produce the old lowering.
- **Rest parameters, spread calls, `new F(...a)`, method spread, array spread**
  (`rest`, `apply` magic 0/1, `append` via guest `spreadAppend`; >16 args → status 3;
  `super(...a)` and `eval(...a)` rejected).
- **Object spread / rest / destructuring** (`to_object`, `copy_data_properties`
  via ES2025 CopyDataProperties guest helper, define-not-set, per-key re-check).
- **Array destructuring and for-of** over intrinsic iterables (Array, arguments,
  string, String wrapper); per-step `Get(length)`/`Get(index)`; normal-completion
  IteratorClose; null/undefined TypeError; other values **status 6** (symbol-dependent).
- **for-in** with the ES2025 EnumerateObjectProperties reference algorithm;
  lexical/TDZ fixtures (25) all admitted.
- **Classes:** declarations/expressions, methods/static/accessors/computed keys,
  `extends` (class/ordinary/bound/null), `super()`, `super.x` get/set/update,
  object-literal home objects, `new.target` (constructors, functions, arrows),
  class-ctor call TypeError, derived `this` TDZ, double-super ReferenceError,
  return checks. Fields, private names, static blocks, async/generator methods:
  compiler-rejected. Built-in parents: status 6.
- **Annex B fixes (compiler):** if/else FunctionDeclaration clauses get separate
  scopes (B.3.3); block function named `arguments` (B.3.2.1).

## Tests run in this wave (host only; no GPU, no CPU replay)

| Command | Result |
|---|---|
| `node check-phase4-native.mjs` | 1,329 existing programs (main 1,185 + boxing/String-extract focused) pack with the patched native compiler; per group admitted/rejected: compiler-correctness 37/0, language-scope 33/4, template 24/5, spread 48/0, edge 100/4, class 85/9, for-in+lexical 75/0, iteration 71/0, object-spread 40/0; every admitted opcode has WGSL; V8 oracle confirms fixed values |
| `node check-phase4-suite.mjs --brief` | 565 records, 533 admitted, 0 pending; V8 1,104/1,104; native QuickJS 1,094/1,104 (all disagreements are documented QuickJS deviations) |
| `node check-phase4-wgsl-lint.mjs` | passes (reserved identifiers, balance, `@compute` placement). **Not** a WGSL compilation |
| `node check-template-lowering.mjs` | 29 cases; V8 + native interpreter agree; 54 `to_string` ops; no `concat` |
| `node check-phase4-edge.mjs` | 104 cases; patched vendor matches V8 on all 208 runs |
| `node check-language-scope.mjs` (before the feature gate) | passes; afterwards requires the rebuilt Wasm |
| `node check-phase4-{spread,object-spread,iteration,for-in,classes}.mjs` | all pass in integrated mode (verify wiring in place) |
| Not run: `check-compiler.mjs`, `check-boxing.mjs`, `check-string-extract.mjs`, `check-compiler-correctness.mjs` | need the rebuilt Wasm / emcc; the stale Wasm output is rejected by the feature gate |

## Pending / required from the coordinator

1. **Rebuild Wasm** (`EMCC=… node build.mjs --wasm`): vendor and `bridge.c`
   changed; the private `generated/compiler.mjs` is stale and is now rejected by
   the feature gate. Then rerun `check-compiler.mjs`, `check-language-scope.mjs`,
   `check-boxing.mjs`, `check-string-extract.mjs`,
   `check-compiler-correctness.mjs` (its `--baseline` mode must ignore
   `bytes[0]` opcode numbers and use the original `quickjs-opcode.h`, since
   `to_string` shifts later opcode numbers).
2. **M1/Safari:** full suite (expect ≥1,185 programs; boxing now has 2 more positive
   template programs and 2 tagged rejections), `boxing.html`,
   `string-extract.html` (2 former gap fixtures now run), `language-scope.html`,
   `compiler-correctness.html`, and the new `phase4.html`.
   WGSL has never been compiled; the first Safari run is the WGSL validation.
3. Native/Wasm parity for all Phase 4 programs.

## Remaining Phase 4 gaps (explicit)

- Tagged templates / template objects; class fields, private names, static
  blocks; `super(...a)` spread; extending built-ins; Reflect.construct new.target.
- Generic iterators, IteratorClose on throw and `return()` calls (Phase 6 hook in
  `raise()`; continuations 42–43 reserved); plain array-likes are conservative
  Unsupported.
- Sloppy global `this`, `globalThis`, undeclared globals, script-level code.
- Symbol-dependent paths (Phase 3 hooks: `iterationKind`, `__lanesOwnPropertyKeys`,
  for-in keys string-only, `toText` for tags 17/18, String-wrapper ToPrimitive).
- Applicable synchronous Test262 run with failure inventory (Phase 4 gate) not yet done.
- Pinned QuickJS's interpreter `super.m()` accessor receiver deviation is
  worked around in the GPU lowering, not patched in the compiler.

Phase 4 is **not** complete; this wave delivers the subsets above.
