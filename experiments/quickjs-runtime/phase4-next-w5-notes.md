# Phase 4 next wave, worker 5: private methods, accessors, static private brands

Scope: review, harden and extend the lead's private-method support in
`phase4-class-elements.js` (heap kind 33 private name, 34 field, 35 brand
keyed by the [[HomeObject]] node). No builtin IDs (2090–2109), heap kinds,
continuations (64–65), fixed nodes, OP or FIELDS entries were used or added.
Host only: no GPU run, no CPU replay.

## Status: both defects found by w5 are fixed (applied by the lead)

| Defect | Applied fix (lead-owned files) | Regression fixtures |
|---|---|---|
| D1 setter-only `#x in o` (QuickJS answered `false`; GPU threw a guest ReferenceError from the TDZ `#x` slot) | `vendor/quickjs.c` OP_scope_in_private_field loads `#x<set>` (from `phase4-patches/w5-private-in-setter-only.diff`); native and Wasm compilers rebuilt | 2 `setterOnlyIn` + 1 shadowing fixture |
| D2 private slot read in a computed key before its element definition (GPU threw a guest ReferenceError instead of TypeError / `false`) | `program.js` packs loads that feed private opcodes with b=1 (`privateSlotLoad` in `phase4-class-elements.js`); `shader.js` get case `v.z==6u && ins.z==0u`; `privateNameOrAbsent` / `privateFind` key 0; `privateBrand` TypeError (from `phase4-patches/w5-private-tdz.diff`) | 8 `tdzRead` fixtures + 1 after-definition control |

The interim gate diff was not needed and has been deleted.

## Files (worker-owned)

- `phase4-next-w5-cases.js`: 46 `w5Cases`, 3 `w5ErrorCases`, 11 `w5RegressionCases`
  (all passing expectations), 2 `w5UnsupportedCases`, 25 `w5RejectedCases`.
- `check-phase4-next-w5.mjs`: V8 + native QuickJS oracles; packing + WGSL
  coverage; assertions that the applied fixes are present and effective;
  native-vs-Wasm compiler parity.
- `phase4-patches/w5-private-in-setter-only.diff`, `phase4-patches/w5-private-tdz.diff`
  (kept as the record of what was applied).

## What the check asserts about the fixes

- **Vendor:** the `OP_scope_in_private_field` case contains the
  `JS_VAR_PRIVATE_SETTER` → `#x<set>` redirect. In the setter-only fixtures,
  every packed `private_in` operand is the `#s<set>` ref. No `private_in` in
  any w5 or lead fixture reads a private slot that is never written.
- **program.js:** for every w5, lead and unsupported fixture, each packed
  `get_loc`/`get_var_ref` has b=1 exactly when `privateSlotLoad` holds.
  Every unchecked load of a `#…` ref is flagged, and no non-private var_ref is
  flagged (172 flagged loads).
  The 8 `tdzRead` fixtures still contain the TDZ-read shape, and all 8 witness
  loads are packed with b=1.
- **shader.js / phase4-class-elements.js:** the get case text is present.
  `privateNameOrAbsent` maps tag 6 to key 0, and `privateFind` rejects key 0.
  `get_private_field`, `put_private_field` and `private_in` use
  `privateNameOrAbsent`. `define_private_field` keeps the strict
  `privateName`, which is correct: its load is checked and never sees a TDZ
  cell. `privateBrand` throws TypeError for a non-closure.

## Verified behaviour (V8 = native QuickJS = fixed ES2025 value; packs; WGSL case per opcode)

**Brands and identity**
- The brand is installed before field initializers run (public and private
  fields, getters, `#m in this`). In derived classes it is installed right
  after `super()`, and it is already present in the base constructor body.
- A base constructor that calls a derived private method throws TypeError.
- Private method identity is shared per class evaluation and differs between
  evaluations.
- `.name` is `#m`/`#sm`, and `.length` follows the parameters.
- Extracted methods work with `.call(other)`. Methods can be passed as `map`
  callbacks with a thisArg.

**Reads and writes**
- Writes to methods throw only after the RHS is evaluated.
- `??=`/`||=` on a method do not write; `&&=` throws. Destructuring targets
  behave as specified.
- A getter-only write throws without calling the getter. A compound
  assignment calls the getter once and then throws.
- Setter-only reads, compound assignments and updates throw without calling
  the setter. A setter assignment evaluates to its RHS.
- Updates and `**=` on a getter+setter pair run in the right order, including
  setter-before-getter declaration order.

**`#x in o` and evaluation order**
- `#x in o` ignores the prototype chain, never calls the getter, and throws
  TypeError for a primitive operand.
- Brand checks run before argument evaluation. A setter's brand check runs
  after the RHS.

**Inside private methods and accessors**
- `super`, the `arguments` object, recursion, default parameters, arrows and
  optional chaining all work.
- Nested classes can shadow outer names and can reach outer names.
- A return override stamps the brand exactly once, including on frozen
  objects and function objects.
- Brands survive 400-allocation collections.

**Static**
- `Sub.#sm()` from the base class body, and `this.#sg` (read and write) from an
  inherited static method called on a subclass, both throw TypeError.
  `#sm in Sub` is false.
- Static and instance brands are distinct.
- The static brand is in place before static fields and static blocks run.
- `super` works in static private methods. Static accessor pairs work with
  static private fields.

## Boundaries and rejections

- **Unsupported (status 6 expected; unverified on GPU):** `this.#m++` and
  `this.#m += ''` need Function.prototype.toString for ToPrimitive of a method
  closure. ES2025 result: TypeError.
- **Class gate (SyntaxError):** private `*#g`, `async #a`, `async *#ag`,
  `static *#g`, `static async #a`.
- **Function-kind gate (RangeError):** generator or async function values
  inside private methods or getters, or as private field initializers. This is
  explicit, but it is not a SyntaxError.
- **Early errors (acorn and QuickJS, SyntaxError):**
  - duplicate private names;
  - mismatched get/get, get/set/set and static/instance getter-setter pairs;
  - field/method and accessor/method clashes;
  - `#constructor`;
  - `delete this.#m`;
  - `super.#m`;
  - undeclared names, names outside any class, bare `#m`, and `#m` in object
    literals;
  - `1 + #m in o`.
- **Not observable:** the "get #x" name of a private accessor function.

## Phase 3 (Symbols)

No hooks are needed. Private names stay kind 33. The b=1 flag only marks loads
that feed private opcodes.

## Review notes on the applied lead files

- No functional problem found. The packed output for all 134 programs is
  identical between the native and Wasm compilers. `check-phase4-classes.mjs`
  reports 1,764 corpus programs packing identically.
- Comment only: the `privateNameOrAbsent` comment says a TDZ name can come
  from "an earlier static element of the same class body". Static fields and
  blocks run after every element is defined, so only computed keys (direct, or
  closures they call) can see a TDZ slot.
- The raw `bytes` arrays differ between the native and Wasm compilers because
  they embed atom numbers from each compiler instance. The decoded raw output,
  the packed code and the packed image are identical, so this is harmless.

## Commands (host only)

| Command | Result |
|---|---|
| `node experiments/quickjs-runtime/check-phase4-next-w5.mjs` | passes. 63 admitted programs pack with WGSL. V8 61/61, native QuickJS 61/61, no deviations. Regression: 2 setterOnlyIn, 8 tdzRead, 8 witness loads b=1. 172 flagged loads. Native vs Wasm parity: 134 programs (decoded raw output, packed code and image), 25 rejections (same class and message), 106 bootstrap sources. Rejections: 5 gate, 3 kind, 17 acorn + QuickJS |
| `node experiments/quickjs-runtime/check-phase4-class-elements.mjs --no-native` | passes (71 V8, 73 admitted) |
| `node experiments/quickjs-runtime/check-phase4-classes.mjs` | passes (1,764 corpus programs pack identically) |

## Still pending (coordinator)

On M1/Safari: compile the WGSL and confirm that the regression fixtures give
the expected values and that the unsupported records stop with status 6.
