# Coordinator integration update (2026-10-04)

The latest core is integrated and GPU-tested on Apple M1 Safari. The phase 3
suite passes 33 semantic cases; nine separately reported boundaries remain,
including Symbol output. BigInt API input/output now supports up to 2,048 bits.
Focused suites verify division/remainder (26 programs), bitwise/shifts (37),
API transfer (8), and JSON BigInt ordering/error behavior (42). Required-GC and
resumption checks pass. JSON cross-feature tests pass 20 programs / 60 values.

Conversions, mixed comparisons, custom Symbol protocols and generic iteration
are still being extended. These results do not establish complete BigInt,
Symbol or ES2025 support. See `quickjs-next-core-integration-manifest.json` in
`../bootstrap/evidence/`. The original worker report below describes its earlier
snapshot and its then-current limitations.

---

# Phase 3 (values / objects) — wave status and integration contracts

Owner: Phase 3 parent. Shared core is `phase3-values.js`, `shader.js`,
`program.js`, and the phase 4 call sites listed below. Worker modules under
`experiments/quickjs-runtime/phase3/` stay disjoint and were not overwritten.

This file does not declare Phase 3 complete. Symbol identity, symbol keys,
`@@toStringTag`, and an i32-range BigInt subset are spliced into the GPU
shader. Many spec operations stay explicit Unsupported or TypeError. No GPU
run and no Wasm rebuild happened in this wave.

## Ground rules

- Guest semantics execute only in WGSL. Host code may parse, pack, and compare
  limb results with a host BigInt oracle. No CPU replay of guest programs.
- Absent behavior is status 6 (Unsupported), status 4 (TypeError, catchable),
  status 3 (resource limit), or a compiler `SyntaxError`. It is not approximated.
- Do not run Node/Dawn GPU. Do not edit `node_modules` or `generated/`.
- `generated/compiler` and `generated/compiler.mjs` do not contain the `bridge.c`
  BigInt constant export. Rebuild is a coordinator step.

## Reservations used by this wave

| Item | Value |
|---|---|
| Value tags | 17 Symbol, 18 BigInt |
| Heap kinds | 17 symbol cell, 18 registry, 19 bigint header/chunk, 21 well-known table. Kind 20 sidecar is reserved and unused. Kinds 22–23 stay reserved and unused. |
| Fixed nodes | 26 Symbol, 27 Symbol.prototype, 28 registry, 29 BigInt, 30 BigInt.prototype, 31–45 well-known cells, 46 kind-21 table, 47 Reflect. `collect` roots `root<=47u`. Startup status 2 if those ids drift. |
| Holders | The three kind-13 holders that used to sit at 26–28 are allocated after node 47. Nothing hardcodes holder ids 26–28. |
| Builtins | 1000 Symbol, 1001 for, 1002 keyFor, 1003 toString, 1004 valueOf, 1005 description getter, 1050 Object.getOwnPropertySymbols, 1100 Symbol.prototype `@@toPrimitive`, 1150 BigInt, 1151 BigInt.prototype.toString, 1152 BigInt.prototype.valueOf. |
| Not installed | Identity builtin 1006. Array.prototype `@@iterator` is not installed as 334. String.prototype `@@iterator` is not installed as 1103. `@@hasInstance` 1101 is not installed. |
| Free in 1000–1199 | 1006–1049, 1051–1099, 1101–1149, 1153–1179. 1180–1199 stay parent reserve. |
| Not used | Phase 4 ids 1200–1399, phase 5 ids 1400–1819, Claude-wave ids 2000–2199, heap kinds 24–39, continuations 40–71. No opcode was appended. `push_bigint_i32` lowers to existing `push`. |

Capture: Symbol is type 4 id 1000, BigInt is type 4 id 1150, Reflect is type 6 node 47. `objectView` / `objectValue` map 1000↔26 and 1150↔29. Node 47 stays a tag-4 object. The registry node is not a guest object.

## Symbol contract

- Guest symbol word: `V(cellNode, 0, 17, 0)`. Every symbol is truthy.
- Property key: `0x60000000 | cellNode`. Payload mask `0x1fffffff`. The payload is the kind-17 cell, not `uniqueIdentity`. `0xC0000000|id` is rejected because it collides with integer indices in `[2^30, 2^31)`.
- Dynamic-string test is `(key & 0xe0000000) == 0x40000000`, mask `0x1fffffff`. Symbol keys are marked separately.
- `uniqueIdentity` lives in `heap[cell].value.x`. The ordinary counter starts at 1 and skips 31–45. Well-known cells use their node id as identity and are not `Symbol.for` keys. `Symbol.metadata` is not created.
- Registry node 28, kind 18, capacity 1024. Overflow is status 3. Empty description still allocates a length-0 kind-10 string. `Symbol()` / `Symbol(undefined)` stores an absent description (tag 3), not the string `"undefined"`. `Symbol.for()` with no arguments stringifies `undefined` to `"undefined"`.
- `Symbol` / `Symbol.for` arguments: tags below 4 go through `primitiveText`. A symbol or bigint argument is status 4. An object is status 6. A non-integer number such as `1.5` is status 6 because `primitiveText` cannot format it.
- `new Symbol` and `new BigInt` are status 4 via `construct()` (catchable TypeError). `Symbol.prototype.toString` (1003) is the descriptive string. `valueOf` (1004) returns the symbol. The description getter is a kind-9 node whose `value.x` is the literal `0x800003ed` (1005 with the builtin bit) and whose `marked` flags are configurable only.
- `typeof` does not grow the six-entry `typeNames` table. Tag 17 pushes the field `"symbol"`. Tag 18 pushes `"bigint"`.
- Same-tag `equal()` is false for two different symbols and for two different bigints. `1n === 1` is false. `1n == 1` is status 4 before the guest equality helper.

## Symbol-key and protocol contract

- `ownKeys(l, original, enumerableOnly, includeSymbols)`. Builtin 1240 (Reflect.ownKeys and object spread) passes `includeSymbols` true. 710 / 716 stay string-only. Builtin 140 with a truthy second argument is enumerable strings only (JSON.stringify). Symbol keys are emitted after strings, oldest first.
- `Object.getOwnPropertySymbols` (1050) returns symbol keys only, all attributes, insertion order. It does not use the nodes 20–25 rejection.
- `ownKeys` of nodes 26, 29, 30, and 47, and of kinds 17/18/19/21, is status 6 so an incomplete key list is not reported as complete. Node 27 Symbol.prototype is enumerable. A missing name such as `Symbol.metadata` gets `undefined`; the Unsupported outcome is on `ownKeys`, not on Get.
- for-in skips symbol keys in both the count and the emit loop, including enumerable symbol data properties.
- Computed symbol data keys use `to_propkey` + `define_array_el` and are canonical (tag 17 skips helper 900). `define_method_computed`, `set_name_computed`, and computed class names/methods on a symbol key are status 6.
- `Object.prototype.toString` (id 155) no longer special-cases nodes 23 and 25. Math and JSON own a data property keyed `0x60000000|42` whose value is the string `"Math"` or `"JSON"` (flags configurable only). If `@@toStringTag` is a string, the result is `"[object " + tag + "]"`. If it is an accessor (tag 12), status 6. Otherwise the existing brand switch runs, with no Math/JSON exception, and symbols/bigints fall back to `"[object Object]"` only when the tag property is not a string. Symbol.prototype and BigInt.prototype install the strings `"Symbol"` and `"BigInt"`.
- `iterationKind`: if the object or string prototype chain has an own property keyed `0x60000000|34` (`@@iterator`, node 34), the kind is 0. The iterator opener then calls `__lanesUnsupported` (host Unsupported, not a guest catch). Kind 4 (null/undefined) stays TypeError. If `@@iterator` is absent, array/arguments stay kind 1 and strings stay kind 2. The user method is not called. Tags 17 and 18 return kind 0. Intrinsic `@@iterator` methods are not installed, so arrays and strings keep today's fast path until something defines the symbol.
- `instanceof`: after the bound unwrap and the non-function TypeError, an own `@@hasInstance` (node 32) on the callee is status 6. Inherited properties do not count. 1101 is not installed.
- `@@toPrimitive` (1100) is installed only on Symbol.prototype, ignores the hint, and returns the symbol. Other ToPrimitive hooks are not installed. A symbol method key such as `{[Symbol.toPrimitive](){...}}` is status 6 at `define_method_computed`. The language-scope fixture `symbol-toprimitive-key` now packs (admission `admitted`) and still cannot return the host value 4 on the GPU.
- Reflect node 47 has `name` and `ownKeys` (function id 1240). `apply`, `construct`, `defineProperty`, `deleteProperty`, `get`, `getOwnPropertyDescriptor`, `getPrototypeOf`, `has`, `isExtensible`, `preventExtensions`, `set`, and `setPrototypeOf` are `prototypeGap` status 6. `toString` and `ownKeys` are not in that gap.
- Template `to_string`: tag 17 pops and sets status 4 (catchable, so `` `${Symbol("s")}` `` inside `try` can return a guest boolean). Tag 18 pops and sets status 6 (decimal formatting is pending). Other values use the existing guest `toText` (builtin 134).

## BigInt contract

- Tag-18 word: `x` is the kind-19 header, `y` is a truth hint (0 for zero, 1 otherwise), `z` is 18, `w` is 0. `0n` is falsy. `truth()` has no heap lane, so the hint is mandatory. The worker bridge fragment that required `y==0` is not spliced.
- Pool header lane 2 is `0x42490000 | signCode` (0 zero, 1 positive, 2 negative). It is not tag 18. `push` of that header calls `materialize_bigint`. Literals use storage 1 (image offset). Arithmetic results use storage 0 (chunk chain). Limb words are not pointers. Kind 19 is not `markValue`'d; the generic `next` walk marks the chunk chain.
- `MAX_LIMBS` is 64. A longer result is status 3. No truncation and no Number coercion.
- Shader arithmetic this wave: add, sub, mul, neg, compare, strict equality. Each op uses `array<u32,64>` and an inlined store. No `ptr<function>`. `array<u32,64>` is a Safari risk the coordinator should watch on the first M1 compile.
- Division, remainder, bitwise ops, and shifts are status 6 in the shader. `limbs.js` implements `divTrunc` / `remTrunc` for the host oracle only.
- Both operands bigint: add/sub/mul run. Mixed bigint and number/bool/null/undefined among primitives is status 4. `bigint + string` is status 6. If either operand is an object (tag 4/5/11), add/relational/binary fall through to the existing guest helper so ToPrimitive still runs. Abstract equality of a symbol or bigint against an object is status 6 and does not fall through.
- Unary `+` on a symbol or bigint is status 4. Unary `-` on a bigint is `phase3BigintNeg`. `~` on a bigint is status 4. `++`, `--`, and `+=` on a bigint are status 6 even when both sides are bigint.
- `BigInt()` as a call is status 6 (ToBigInt is not implemented). `BigInt.prototype.toString` (1151) confirms the receiver and then sets status 6. `valueOf` (1152) returns the primitive, including a kind-16 holder. A kind-16 wrapper is not a full BigInt or Symbol exotic object.
- `JSON.stringify` of a bigint stays status 6. It is not coerced to a number.
- i32 literals, including `-2147483648n`, pack through existing `push_bigint_i32` with no host BigInt in `packProgram`. A synthetic constant `{bigint:"..."}` packs through `packBigIntDecimal`. The shipped compiler still emits `{unsupported:true}` for `9007199254740993n`, and `packProgram` throws `Unsupported QuickJS constant type`. `bridge.c` writes `{"bigint":"<decimal>"}` via `JS_ToString`, but neither `generated/compiler` nor `generated/compiler.mjs` was rebuilt.

## Parent decisions that override worker fragments

- Do not splice `symbol-keys.wgsl`, `symbol-protocols.wgsl`, `limbs.wgsl`, or the whole `bigint-bridge.wgsl`. Identity WGSL is loaded by `phase3-values.js`, `symbol_same_value` is stripped from that copy (one definition lives in the early block), and `symbol_alloc_cell` skips ids 31–45. `struct SymbolCell` is hoisted to just after `struct Params`.
- Symbol `()` / `for` stringification of primitives uses `primitiveText`. The identity host model reported status 6 for every non-string.
- `GetIterator` does not call a user method. Presence of `@@iterator` forces kind 0 and host Unsupported.
- `conformance/boundaries.js` keeps `ENGINE_HAS_SYMBOL` and `ENGINE_HAS_BIGINT` false. That module must not be read as "the shader has no symbols." It is the inventory gate that still refuses to mark the phase supported.
- Object-model worker `defects.js` is empty. No extra object-model core patch was applied.

## Implemented in the shader (not GPU-tested)

- Symbol constructor, registry, `keyFor`, description, descriptive `toString`, `valueOf`, `typeof`, truth, identity equality.
- Symbol-key get/set/define/`in`/delete through the existing property opcodes, `Reflect.ownKeys`, `Object.getOwnPropertySymbols`, for-in exclusion, object-spread inclusion.
- Well-known cells 31–45, Math/JSON `@@toStringTag` data properties, Symbol.prototype `@@toPrimitive` and `@@toStringTag`.
- BigInt literal materialization, truth, strict equality, add, sub, mul, neg, compare, and the explicit status 4 / status 6 boundaries above.
- GC marks for tags 17 and 18 and for kinds 17 and 18. Fixed nodes 26–47 are roots.

## Host-tested this wave

| Command | Result |
|---|---|
| `node experiments/quickjs-runtime/check-phase3-values.mjs` | exit 0. Limb oracle 408 checks (i32 samples plus six wide values). Pool round-trip 5 i32 cases plus decimal `4294967296`. Native `1n` lowers `push_bigint_i32` to `push` of a `0x42490000` header. Synthetic `{bigint:"4294967296"}` packs length 2. Native `9007199254740993n` is `{unsupported:true}` and `packProgram` throws. Shader static checks pass (one `symbol_same_value`, no `undefinedu`, no `ptr<function>`, root `<=47`, id skip 31–45, description getter `0x800003ed`, `ownKeys` 4-argument calls). 27 browser-case sources: wasm `compiler.mjs` code/image equal native `generated/compiler`. `gpuChecks` and `guestExecution` are false. |
| `node --test experiments/quickjs-runtime/phase3/bigint-source/limbs.test.js` | 7 pass, 0 fail. `oracle-checks=900`, `div-oracle-checks=344`. Division is host-only and is not in the shader. |
| `node --test` of symbol-identity, symbol-keys, symbol-protocols, bigint-bridge, object-model, gc-fixtures, conformance | 96 pass, 0 fail. These are host models and fixtures. They do not execute the shader. |
| `node experiments/quickjs-runtime/check-language-scope.mjs` | exit 0. Admitted 34, rejected 3, native/wasm pack agreement. `symbol-toprimitive-key` packs and has no missing shader opcode. GPU execution of that fixture is still status 6. |
| `node experiments/quickjs-runtime/check-string-extract.mjs` | exit 0. `nativeWasmAgreement` true. `10n` and `Symbol` sources pack. The host-gap simulator still documents symbol ToString and bigint formatting as its own gaps. Pack success is not a GPU semantic claim. |
| `node experiments/quickjs-runtime/check-phase4-native.mjs` | exit 0. `corpusPrograms` 1351. Template group admitted 25 / rejected 4 / V8 oracle 24 (the `requiresSymbol` fixture skips the V8 oracle and keeps expected `'sym5'`). Every admitted opcode has a WGSL case. |
| Not run | `check-phase4-suite.mjs` (rebuilds a private native QuickJS). `build-browser.mjs`. Node/Dawn WebGPU. Wasm/native compiler rebuild. Naga/WGSL compile. |

The first draft of `check-phase3-values.mjs` called the limb ops with the wrong arguments and threw `expected a bigint limb value`. That helper was corrected before the passing run.

## Browser harness (written, not executed, not bundled)

- `browser-phase3.html`, `browser-phase3.js`, `phase3-browser-cases.js`.
- 23 value cases return a boolean, number, or string with a fixed expected constant. 4 cases expect `vm.run` to reject with `Unsupported runtime operation` (iterator override, `BigInt(1)`, `1n+"1"`, `JSON.stringify(1n)`).
- `build-browser.mjs` lists `'phase3'` after `'phase4'`. The build was not run. `generated/` was not written by this worker.
- Distinct from `phase3/conformance/phase3-focus.html`, which stays behind the false engine flags.

## Pending (phase is not complete)

Coordinator, before treating this wave as landed:

1. Rebuild native and Wasm from `bridge.c` so cpool bigints emit `{bigint:"..."}` instead of `{unsupported:true}`. Then update the `9007199254740993n` assertion in `check-phase3-values.mjs`.
2. M1/Safari GPU: the 27 `phase3BrowserCases`, the Math/JSON `toString` sentinels, the phase 4 template fixture `symbol-substitution-typeerror` (guest catch must return `'sym5'`), and the existing 1200-program regression. Status 4 must stay catchable. Status 6 must stay a host rejection.
3. First WGSL compile will validate `array<u32,64>`, forward references, and the `SymbolCell` hoist. This wave did not compile the shader.

Still explicit and not implemented:

- `Symbol.species`, `match`, `matchAll`, `replace`, `search`, `split`, `isConcatSpreadable`, `unscopables`, `dispose`, `asyncDispose`, `asyncIterator` have cells and are not wired into the corresponding builtins.
- User `@@iterator` / `@@hasInstance` / `@@toPrimitive` (except Symbol.prototype) are detected only far enough to fail explicitly.
- `ToBigInt`, `BigInt.asIntN` / `asUintN`, bigint decimal `toString` / `toLocaleString`, bitwise, shifts, division, remainder, exponentiation, `++` / `--` / `+=`.
- Bigint as a property key (status 6 through helper 900 / `keyOf`).
- JSON.stringify of a bigint. Symbol JSON key escaping beyond the descriptive string.
- `Symbol.metadata`. Complete `ownKeys` of Symbol, BigInt, and Reflect.
- Kind 20 sidecar. Builtin 1006.
- Full descriptor/prototype audit beyond the existing object opcodes. The object-model worker recorded no confirmed core defect.
- GC fixtures are host data. They were not executed as single-instruction GPU resumptions.
- `conformance/boundaries.js` engine flags stay false until a GPU run cites the behaviors above.

## Delegation

Eight background subagents were launched and all eight finished with exit 0. Parent integrated the shared core after they returned. Worker directories were left in place.

| Assignment | Directory | Host tests re-run here |
|---|---|---|
| Symbol identity | `phase3/symbol-identity/` | 16 pass |
| Symbol keys | `phase3/symbol-keys/` | 25 pass |
| Well-known protocols | `phase3/symbol-protocols/` | 11 pass |
| BigInt limbs | `phase3/bigint-source/` | 7 pass (900 + 344 oracle checks) |
| BigInt bridge | `phase3/bigint-bridge/` | 10 pass |
| Object model | `phase3/object-model/` | 19 pass, `defects.js` empty |
| GC fixtures | `phase3/gc-fixtures/` | 9 pass, host data only |
| Conformance inventory | `phase3/conformance/` | 6 pass, engine flags false |
