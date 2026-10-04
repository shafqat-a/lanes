# Phase 4 next wave — worker 3: public static fields and static blocks

This is a continuation review. The lead's implementation of the shared class
core was reviewed but not redone (`phase4-class-elements.js`,
`phase4-classes.js`, `define_field`/`define_array_el` → `defineOwnData` in
`shader.js`). No shared file was edited. Reservations used: none (builtin IDs
2040–2059, continuations 60–61 and fixed nodes are all still free). Static
elements need no new opcode, heap kind, continuation or fixed node.

## Implemented (worker-owned files)

| File | Contents |
|---|---|
| `phase4-next-w3-cases.js` | 55 value fixtures (`w3StaticCases`), 2 uncaught-error fixtures, 12 early-error fixtures, 1 unsupported (status 6) fixture, 1 Symbol fail-closed (rejected) fixture. 71 in total. Same shape as `phase4-class-element-cases.js`. Every fixture name starts with `w3:`, so ids do not collide with the lead's `class-static` records. |
| `check-phase4-next-w3.mjs` | Host check modelled on `check-phase4-class-elements.mjs`. It covers V8 (`node:vm`) and a private native QuickJS built from `vendor/`, the input+1 sensitivity rule, and packing with `generated/compiler` + `program.js` with a WGSL case for every packed opcode. Early errors are checked three ways: a V8 parse SyntaxError, a native QuickJS parse SyntaxError, and a compiler SyntaxError whose message matches the pinned QuickJS message. It also checks unsupported packing, the Symbol rejection, and the proposed suite integration through the scratch copy. |
| `w3-phase4-suite.js` | Scratch copy of `phase4-suite.js` with the proposed diff applied. Only the check script imports it. Delete it once the lead applies the diff. |
| `phase4-patches/w3-static-suite-integration.diff` | Proposed lead edits to `phase4-case-groups.js` and `phase4-suite.js`. |

### What the fixtures cover

- **Evaluation order (ClassDefinitionEvaluation).**
  - All computed keys are evaluated first, in source order (instance, static, and methods). Only then do static fields and blocks run, interleaved in source order. Instance initializers never run at definition time.
  - A computed static key runs ToPropertyKey exactly once, before any static initializer.
  - A throwing computed key skips every static initializer.
  - A later static field reads as `undefined`. A static method can observe a later field before it is defined.
  - A throwing static block stops the later elements.
  - Static blocks run once per class evaluation, including 6 blocks interleaved with 6 fields.
- **`this` / `super` / `new.target`.**
  - Inside a function declared in a static block, `this` is `undefined` (strict). An arrow sees the class.
  - A `super` getter in a static field receives the derived constructor as its receiver.
  - `super.y = v` in a static block defines on the derived constructor, not on the parent.
  - `super.m()` uses the derived constructor as `this`.
  - `super` works from an arrow nested in a static field.
  - The static home object is the constructor: a static field picks the parent's static `m`, not the prototype `m`.
  - `new.target` is `undefined` in static fields and in arrows inside static blocks.
  - `arguments` is allowed inside a function declared in a static block, and inside a function expression in a static initializer.
- **Scoping.**
  - A `var` in a static block is hoisted within the block (`typeof` before the declaration is `undefined`) and does not leak or shadow the outer `let`.
  - Each static block has its own var scope.
  - Function declarations hoist within the block only.
  - Covered: `let`/`const`/`class` in blocks, labelled break, loops, try/catch/finally, and per-iteration loop bindings captured from static blocks.
  - Nested classes with static blocks keep their own `this`.
- **Bindings.**
  - An abrupt static field leaves the outer class binding in TDZ (a closure created before the declaration throws ReferenceError). The inner binding stays initialized (a closure from a static block returns the class).
  - Assigning the inner binding inside a static block throws TypeError.
  - A static arrow captures the immutable inner binding even after the outer binding is reassigned.
  - A named class expression's inner binding is visible in static initializers.
- **Names.**
  - Anonymous-function naming across identifier, computed, numeric and string-literal static keys.
  - A class value with its own `static name` is not renamed, and a class value with a `static name()` method is not overridden.
  - A named function keeps its name.
  - A computed key names an anonymous class before that class's own static block runs. This covers `define_class_computed` inside the static initializer, also with `extends` + `super`.
  - `this.name` is observed before a `static name` field overrides it.
  - A static name field replaces a static name method.
  - After `delete this.name`, the name falls back to `Function.prototype.name` (`''`).
  - `static length` after arity was observed.
- **DefineField / CreateDataPropertyOrThrow on the constructor.**
  - A static field replaces an earlier static method with an enumerable writable data property. It also wins when the method is declared later.
  - A static field replaces a static accessor without calling its setter, while an assignment in a static block uses [[Set]] and does call the setter.
  - TypeError when an earlier static block froze the constructor.
  - TypeError on a non-configurable property defined by a static block.
  - A static field replaces a configurable method on a non-extensible constructor.
  - A computed `static ['constructor']` defines an own data property; `A.prototype.constructor` is unchanged.
  - A computed `static ['prototype']` throws TypeError *after* earlier statics ran. This is the normative timing; see the V8 deviation below.
  - Canonical numeric keys are ordered.
- **Inheritance and other.**
  - Inherited statics are visible through `this` and `super` without being copied.
  - A subclass static shadows the parent's.
  - Static fields work with `extends null`.
  - Static elements survive collections: 300 iterations of garbage inside a static block, with a static object kept by identity.
  - A `static static` field, and a `static constructor()` method next to a static field.
- **Early errors (12).**
  - `arguments` in a static block, in an arrow inside a block, and in a static field initializer.
  - `await` as identifier reference, as binding, and as label in a static block.
  - `return` and `super()` in a static block.
  - Literal `static prototype` and `static constructor` fields.
  - `let v; var v` in a block.
  - `break` out of a static block.
- **Boundaries.**
  - `static arguments = x` is status 6 through the existing `functionKey` legacy-property boundary. Its normative result is 1.
  - A Symbol-keyed static field fails closed at pack time ("Symbol" global unsupported).

## Commands and exact results (host only; no GPU, no CPU replay)

| Command (from `experiments/quickjs-runtime/`) | Result |
|---|---|
| `node check-phase4-next-w3.mjs` | exit 0. `admitted: 58` (55 value, 2 uncaught error, 1 unsupported), all packed with WGSL for every opcode. `v8: 57` agree plus 1 recorded V8 deviation. `native: 57` agree, no QuickJS deviations. `earlyErrors: 12` (V8, native QuickJS and compiler all SyntaxError with the expected QuickJS message). `unsupported: 1`. `rejected: 1`. `suiteRecords: 71`: the proposed `n-static` suite records build without id collisions, with the right outcomes and normative flags. |
| `node check-phase4-class-elements.mjs --no-native` | passes (73 admitted, 71 V8, 2 unsupported, 1 rejected). It is unaffected because no shared file was changed. |
| `node -e "import('./phase4-suite.js')"` (module load probe) | **fails: `taggedTemplateCases is not defined`.** See the defects section. |

## Defects / findings

1. **No runtime defect was found in the static-field / static-block paths.**
   - Every adversarial fixture agrees with V8 (or with the spec where V8 deviates) and with native QuickJS, and packs to opcodes that all have WGSL cases.
   - I traced these WGSL paths by hand:
     - `define_class` (constructor parent, `extends null`, forced name).
     - `classSetHome` / `classSpecialObject(4)`: the static home object is the constructor's kind-2 backing, mapped back to the closure through `objectValue`.
     - `get_super` (backing `value.x` = parent backing) and `get_super_value`.
     - `put_super_value` → `classSuperSet` (receiver = constructor backing, kind 2).
     - `defineOwnData`:
       - existing configurable method/accessor → data, marked 14;
       - non-configurable (`prototype`, marked 0) → TypeError;
       - non-extensible backing (`value.w==0`) → `putProperty(define)` TypeError;
       - `functionKey` caller/arguments → status 6.
     - `functionName(force=false)` for `set_name` on static field values.
     - The `define_class_computed` key at sp-3 inside the static initializer.
     - GC: the closure home in `value.z` is marked.
   - WGSL for this wave has still never been compiled or run on a GPU, so these fixtures are GPU obligations.
2. **V8 oracle deviation (matters for the lead's harness).**
   - Fixture: `static a = …; static ['proto'+'type'] = 1`.
   - Per ES2025 15.7.10 / 15.7.14 step 31, the TypeError comes from DefineField, so `static a` has already run: the result is `TypeError:a:39`. Pinned QuickJS gives exactly that. V8 throws while evaluating the computed key and gives `TypeError::39`.
   - The fixture carries `v8Deviation`, and the check asserts that V8 still reproduces the deviation.
   - The suite diff adds a `phase4NormativeDifferences` entry with the spec reference. Without it, `check-phase4-suite.mjs` would report `v8-disagrees`.
3. **Pre-existing, outside my assignment: `phase4-suite.js` does not load.**
   - The `n-template` source rows reference `taggedTemplateCases`, `taggedTemplateTypeErrorCases`, `taggedTemplateThrowCases`, `taggedTemplateUnsupportedCases`, `taggedTemplateLimitCases` and `taggedTemplateRejectedCases`, but nothing imports them. Module evaluation throws ReferenceError.
   - As a result, `check-phase4-suite.mjs` and the browser suite page cannot run in this snapshot.
   - Fix: add `import { taggedTemplateCases, taggedTemplateTypeErrorCases, taggedTemplateThrowCases, taggedTemplateUnsupportedCases, taggedTemplateLimitCases, taggedTemplateRejectedCases } from './phase4-template-tagged-cases.js';`. This hunk is included in the w3 diff, and `w3-phase4-suite.js` validates it loads.
   - This is probably an in-progress worker-1 integration; skip the hunk if the lead has already fixed it.
4. **Observation, not changed: `throw_error` arg 1 (`JS_THROW_VAR_REDECL`, a SyntaxError in QuickJS) maps to status 4 (TypeError) in `shader.js`.**
   - QuickJS emits it only for global-script function hoisting (quickjs.c ~34488). Guest programs are functions, so it is unreachable today.
   - If global scripts are ever admitted, use a SyntaxError status for arg 1 instead of TypeError.

## Proposed shared edits

- `phase4-patches/w3-static-suite-integration.diff`:
  - Add a `class-static` group to `phase4-case-groups.js`.
  - Add `n-static` sources to `phase4-suite.js`: value, uncaught error, unsupported, early-error rejected, and Symbol rejected.
  - Add the normative-difference entry above.
  - Add three resumption ids: the super getter with derived receiver, the static setter via [[Set]], and the abrupt static field with outer TDZ.
  - Add the missing tagged-template import.
- After applying: run `node check-phase4-suite.mjs --write-expected` once to record second-input expectations, then `node check-phase4-suite.mjs --brief`, then the M1/Safari `phase4.html` run.
- No `shader.js` / `program.js` / `vendor` / `bridge.c` change is proposed for static elements.
- Worker 2's `w2-instance-prototype-field.diff` (vendor) keeps `static prototype` rejected ("invalid method name", line ~25626) and `static constructor` rejected ("invalid field name"), so my early-error `reason` regexes stay valid if that patch is applied.

## Remaining boundaries (explicit)

- Symbol-keyed static fields/blocks: fail closed today (pack-time `Symbol` global rejection; at runtime `keyOf` returns status 6 for non-string/number keys).
  - Phase 3 hook: teach `keyOf` tag-17 keys.
  - Then move `w3StaticRejectedCases[0]` into `w3StaticCases` with expected `1`.
  - `defineOwnData` and `findProperty` need no change.
- `static caller` / `static arguments` fields on class constructors: status 6 (`functionKey`). The normative result is an own data property.
- Async/generator static methods and `await` inside static blocks: compiler-rejected (Phase 6). `await` in a static block is an early error anyway.
- `Function.prototype.toString` of classes with static blocks: not implemented (lead gap list).
- No GPU/WGSL compilation was done for any of these fixtures.
