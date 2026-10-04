# Phase 4 worker 7: this / arguments / call / declaration edge-case audit

Scope: the single-entry-function model (`entrySource`/`packProgram`). Sloppy
global `this` stays explicitly unsupported because no global object exists.
Fixtures: `phase4-edge-cases.js` (84 `edgeCases`, 8 `edgeTypeErrorCases`,
12 `edgeUnsupportedCases`). Check: `node check-phase4-edge.mjs` (host only).
Spec references use ES2025 numbering. ES2025 Annex B.3.1-B.3.4 were B.3.2-B.3.5
in ES2020; QuickJS source comments still use the old numbering.

## Evidence

Every row was checked by `check-phase4-edge.mjs`:

- **Oracle:** the V8 oracle confirms the fixed ES2025 value, and input+1 gives a
  different result.
- **Native QuickJS:** interpreters built from `vendor/` in a private
  `.phase4-build-w7-*` directory run every case. The "current" build uses vendor
  as is; the "patched" build adds the w7 diffs.
- **Admission:** uses the current `program.js` `packProgram` with bootstrap
  attached. The current and patched compilers must agree.
- **Opcode coverage:** every admitted guest opcode has a WGSL case. Coverage
  includes `phase4ShaderOps`.

"Lanes" is the admission result plus a static review of `shader.js`
(`push_this`, `call`, `construct`, `argumentsObject`, `environment`,
`closure`). **No GPU run was performed.** `pass` means "expected to pass;
GPU qualification pending". V8 and native QuickJS (patched) agree on every
case. No Safari-specific divergence is known for these rows. This was not
re-verified on Safari here.

## Audit table

| Item | Spec | QuickJS (vendor) | Lanes | Class | Action |
|---|---|---|---|---|---|
| Arrow lexical `this` (in method, nested, returned arrow) | 15.3.4, 10.2.1.1 | correct; the parent's `push_this` is stored in a local and captured as a var ref | admitted; the arrow never executes `push_this` | pass | a1, a2, a4 |
| Arrow ignores call/apply/bind thisArg | 10.2.1.1 step 1 | correct | receiver is unused by arrows | pass | a3 |
| Arrow sees outer `arguments` (length, values) | 10.2.11 step 15 | correct; the parent's `special_object` is captured | admitted | pass | a5, a9 |
| Outer `arguments` inside an arrow after the param is reassigned (sloppy mapped / strict unmapped) | 10.4.4.6 / 10.4.4.5 | correct | mapped props (kind 15) point at the same env cell that `put_arg` and the arrow's var ref write | pass | a6, a7, a8 |
| `this` in method default parameter | 10.2.11 | correct | admitted | pass | a10 |
| Strict `this` for plain call / entry / call(null/undefined/primitive) / bind(primitive) | 10.2.1.2 | correct | the receiver is pushed unchanged when the function is strict | pass | b1-b4, b8 |
| Sloppy `this` for a primitive thisArg (call, bind, method on Number.prototype) | 10.2.1.2 step 6.b | correct | `push_this` boxes once per call (`wrap`) | pass | b5, b6, b10 |
| Sloppy `this` = undefined/null (plain call, `call(null)`, `apply(undefined)`, `bind(null)`, detached method, sloppy entry with arrow `this`) | 10.2.1.2 step 6.a | correct (globalThis) | runtime status 6 at `push_this`; this is the existing explicit policy | explicit-unsupported | u1-u4, u6, u7. Keep this until a global object exists (WP-3) |
| Sloppy function that references `this` only in an unreached branch, called plainly | 10.2.1.2 | correct | status 6 at entry: QuickJS emits `push_this` in the prologue (`quickjs.c` ~35110), so the check fires even if `this` is never evaluated | explicit-unsupported (over-conservative) | u5. Accepted; it fails explicitly and never gives a wrong value |
| Member call forms: `o[k]()`, `(o.m)()` keep `this`; `(0,o.m)()` loses it | 13.3.6.1 | correct | `get_field2`/`get_array_el2` + `call_method` vs `call` | pass | b9 (strict callee) |
| Bound `this` wins over a later `.call` | 10.4.1.1 | correct | the bound-chain loop in `call()` | pass | b15 |
| Getter `this` for a primitive receiver (sloppy boxed, strict primitive; Number and String) | 7.3.2 GetV | correct | `getProperty` primitive branch → accessor callback with the primitive receiver → `push_this` | pass | b12-b14 |
| Defaults see earlier params; closures in defaults see the param scope | 10.2.11 | correct | admitted | pass | c1, c3, c8 |
| Defaults do not see body `var`s (separate varEnv) | 10.2.11 step 28 | correct | admitted | pass | c2, c4 |
| `arguments` unmapped with non-simple params | 10.2.11 step 22 | correct (`special_object 0`) | unmapped data props | pass | c5, c6, c13 |
| Default parameter TDZ (`a=b,b`) | 10.2.11 | correct | `get_loc_check` → ReferenceError | pass | c7 |
| Duplicate sloppy params: last wins; only the last occurrence is mapped | 10.2.11, 10.4.4.6 step 17 | correct | the name resolves to the last arg slot. Index 0 maps to its own unread cell, so this is observably equivalent | pass | c9-c11 |
| `length` with defaults / rest | 15.1.5 | correct (`defined_arg_count`) | `closure()` length from image | pass | c12, c20 (rest lowering belongs to worker 2) |
| Body function decl replaces param; `var` redeclaration keeps the param value | 10.2.11 steps 27, 36 | correct | admitted | pass | c14, c15 |
| Strict `arguments.callee` throws; sloppy callee is self | 10.4.4.5/6 | correct | poison accessor 700 / THIS_FUNC closure | pass | c16, c19, TypeError case |
| Named function expression binding (sloppy write ignored, strict TypeError) | 15.2.5, 9.1.1.1.5 | correct | `throw_error` type 0 in strict | pass | c17, c18, TypeError case |
| Function declaration hoisting; last declaration wins; var/fn redeclaration | 10.2.11 | correct | `fclosure`+`put_loc` prologue | pass | d1-d4 |
| B.3.2.1 block function: var is undefined before the block, assigned on evaluation, hoisted inside the block, inner assignment stays lexical | B.3.2.1 | correct | admitted | pass | d5-d8, d12, d13 |
| B.3.2.1 skipped for a `let` conflict, a parameter name, or inside `catch(g)` | B.3.2.1, B.3.4 | correct | admitted | pass | d9-d11 |
| Block function in switch case / default | B.3.2.1 | correct | admitted | pass | d14 |
| B.3.3: function declaration as an if-clause (no else) | B.3.3 | correct | admitted | pass | d15 (bytecode changes under the patch: the closure is now created on clause entry; value unchanged) |
| **B.3.3: if/else clauses that both declare the same function name** | B.3.3 (each clause is its own Block) | **wrong**: both clauses shared one scope (`TOK_IF` `push_scope` around the whole statement). The else clause's declaration became a same-scope redeclaration and its var copy was dropped (`fclosure; drop`), so `g()` gives TypeError | admitted; the GPU would run the wrong bytecode | **compiler-bug** | fixed by `phase4-patches/w7-annexb-if-clause-scope.diff`; regressions d16-d19, control d20 |
| B.3.1 labelled function declaration | B.3.1 | correct | admitted | pass | d21 |
| B.3.4 `var e` inside `catch(e)` (initializer writes the catch param; the function var stays undefined) | B.3.4 | correct | admitted | pass | d22, d23 |
| **B.3.2.1 block function named `arguments`** | B.3.2.1 step iii (applies even though step ii skips creating a binding for `arguments`) | **wrong**: `js_parse_function_decl2` excluded `arguments` from the Annex B copy whenever the function has an arguments binding. `arguments` stayed the arguments object | admitted; wrong value on GPU | **compiler-bug** | fixed by `phase4-patches/w7-annexb-arguments-block-function.diff` (the copy targets the existing arguments binding); regressions d24-d26, d28, control d27 |
| Call order: callee/member base before args; IsCallable after args | 13.3.6.1-2 | correct | `call()` checks the callee tag at the call op, after args | pass | e1-e6, TypeError cases |
| `new` on arrow / method / getter / bound arrow → TypeError | 13.3.5.1.1 | correct | `construct()` checks the `hasPrototype` bit → status 4 | pass | e7-e9, TypeError cases |
| `typeof` TDZ → ReferenceError; `typeof` hoisted var → "undefined" | 13.5.3.1 | correct | `get_loc_check` | pass | e10, e11 |
| `typeof undeclared`, `globalThis`, implicit global write, strict block function referenced outside its block | 13.5.3.1, 6.2.5.6 | correct | compiler rejection `Unsupported global or module reference` | explicit-unsupported | u8-u11 |
| Arrow `new.target` | 13.3.12 | correct | rejection `special object: 3` (worker 5) | explicit-unsupported | u12 |

Strict-mode block functions are block-scoped (B.3.2 does not apply). This is
covered indirectly by u9: the name is unresolved outside the block.

## Compiler patches (unified diffs against the current `vendor/quickjs.c`)

1. `phase4-patches/w7-annexb-if-clause-scope.diff`: `js_parse_statement_or_decl`
   `TOK_IF`. Each clause gets its own `push_scope`/`pop_scope`, inside the
   existing scope for the whole statement. A scope without declarations emits
   no code. Repro:
   `function f(x){if(x>4)function g(){return 'a'+x;}else function g(){return 'b'+x;}return g();}`
   gives `"b3"` for 3. Vendor QuickJS throws TypeError.
2. `phase4-patches/w7-annexb-arguments-block-function.diff`: `js_parse_function_decl2`.
   The `arguments` exclusion from `create_func_var` is removed, and the Annex B
   store uses `add_arguments_var` (the existing arguments binding) instead of
   creating a new var. Repro:
   `function f(x){function h(){{function arguments(){return x;}}return typeof arguments;}return h();}`
   gives `"function"`. Vendor gives `"object"`.

Neither patch adds an opcode. All emitted opcodes (`fclosure`, `put_loc`,
`drop`, `special_object 1`) are already admitted.

Delta: of 1,666 sources (all `*-cases.js` function sources plus 71 bootstrap
helpers), 1,655 have identical raw bytecode. The 11 that changed are all
w7 fixtures with an if-clause function declaration or a block function named
`arguments`. No existing fixture or bootstrap source changed.

## Runtime findings

- No runtime gap was found in scope, so no shader or program edit is proposed.
  The admitted `this`/`arguments`/call paths match the spec by static review.
- Kept explicit: sloppy `this` with an undefined/null receiver gives status 6,
  and the check fires at prologue granularity (u5). If a global object is added
  (WP-3), the single change is the `push_this` `else{states[l].status=6u;}`
  branch. That branch would push the global object instead.
- Guarded invariant (now asserted by the check): no bootstrap helper binds a
  sloppy `this` (all 71 are strict). `push_this` boxing writes
  `Frame.receiver`, and continuations such as `get_array_el3` tail 7 reuse a
  helper frame's `receiver` as private storage. A sloppy helper that used
  `this` would corrupt that slot.

## Lead integration steps

1. From the repo root:
   `git apply experiments/quickjs-runtime/phase4-patches/w7-annexb-if-clause-scope.diff experiments/quickjs-runtime/phase4-patches/w7-annexb-arguments-block-function.diff`.
   Both were tested sequentially with `patch` on the current vendor copy.
2. Rebuild `generated/` (native and Wasm compiler) with `node build.mjs`.
3. Run `node check-phase4-edge.mjs`. It detects the `LANES:` markers
   (`integratedInVendor: true`), and then requires all regression cases to
   pass on the vendor interpreter.
4. Optionally rerun `check-compiler-correctness.mjs` / `check-compiler-delta.mjs`
   for Test262 compiler-delta evidence. Then add a short section to
   `compiler-correctness-notes.md`.
5. GPU qualification (lead, M1/Safari):
   - `edgeCases` and `edgeTypeErrorCases` should produce their expected
     values, or TypeError for the TypeError cases.
   - `edgeUnsupportedCases` with `mechanism: 'runtime-status-6'` should
     report status 6.
   - Cases with the `compiler-rejection` mechanism reject at compile time.
