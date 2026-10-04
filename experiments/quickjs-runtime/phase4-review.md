# Phase 4 worker-8 review: case files and helper modules

Scope: `template-cases.js`, `phase4-{spread,object-spread,iteration,for-in,edge}-cases.js`,
`phase4-{spread,object-spread,iteration,for-in,classes}.js`, `phase4-registry.js`, as they
were on 2026-10-03 during the Phase 4 wave. Evidence comes from
`node check-phase4-suite.mjs --brief`: the V8 oracle plus a native QuickJS interpreter and
compiler built privately from the current `vendor/` sources. No GPU or runtime.js execution
was done, and native/Wasm compiler parity is still pending (no emcc available locally).

Severity: **High** = a correct runtime would be reported wrong, or a wrong runtime would pass.
**Medium** = a spec deviation that is reachable today, or an integration step that must not be
missed. **Low** = a Phase 3/6 hook or a documentation gap.

## Fixture defects

| File:line | Issue | Severity | Suggested fix |
|---|---|---|---|
| phase4-class-cases.js:153-154 | `this before super() is in TDZ` expects `'true12'`, but `return r + new B().k` reads `r` (still `""`) **before** `new B()` runs the constructor that appends `true`. ES2025 evaluates the left operand of `+` first, so the result is `'12'`. V8 and native QuickJS both give `12`. A correct GPU run would be reported as failed. | High | Use `const b = new B(); return r + b.k;` (expected `'true12'`), or keep the source and change the expected value to `'12'`. The first option keeps the TDZ observation in the result. |
| phase4-for-in-cases.js:30 | (Fixed during the wave.) It earlier expected `'0q1424'`; the correct value `'0q1422'` is now present. | — | none |
| phase4-for-in-cases.js:142-143 | `switch-lexical-initialized-fallthrough`: with input 0 the result is `init1`, but input+1 (= 1) jumps to `case 1` and reads `a` while it is uninitialized, which throws an uncaught ReferenceError. Any input+1 harness (browser-compiler-correctness style, phase4 suite) sees a different outcome kind. | Low | Use a negative or ≥2 second input. The suite already overrides it to `-1` in `phase4SecondInputOverrides`. |
| phase4-iteration-cases.js:60-61, :123-124 | Earlier versions had wrong expectations (474 vs 492; missing `/57` suffix). Both are fixed in the current file and agree with V8 and QuickJS. | — | none |
| phase4-iteration-cases.js:149-150 | `plain object inheriting Array.prototype` is spec-iterable (V8 returns a value) but is classified Unsupported. This is explicit and documented, but it is an over-approximation. | Low | Keep it. List it in the Phase 6 inventory as "conservative Unsupported". |

## Semantic shortcuts / spec deviations in helpers

| File:line | Issue | Severity | Suggested fix |
|---|---|---|---|
| phase4-classes.js:439 (gap note) | **Confirmed QuickJS bug.** For `super.m()`, QuickJS reads `m` from the home prototype with the prototype as receiver, so an inherited accessor sees `this === HomeObject.[[Prototype]]` instead of the instance. ES2025 13.3.7.1 MakeSuperPropertyReference uses thisValue = the environment's this. Native QuickJS from the current vendor returns `false:true:5`; V8 and the spec give `true:true:5`. The GPU executes the same bytecode, so it inherits the bug. | Medium | Add a vendor compiler patch so super *calls* use `get_super_value` with this as receiver (as the non-call `super.x` read already does), then `call_method`. Gate it with regression case `w8:class-super-call-accessor-receiver` (phase4-regression-cases.js). |
| phase4-classes.js:291-295 (collect-home-newtarget) | Classes store new heap references in closure `value.z` (home object) and env `value.z` (new.target). The `collect()` patch that marks them is **not yet in shader.js** (grep finds no `mark(l,node.value.z)`). If the class WGSL is integrated without this patch, the home object or new.target can be freed while still reachable. Under GC pressure, `super`/`new.target` would then read freed nodes. | High (integration) | Apply `collect-home-newtarget` in the same change that admits `define_class`/`set_home_object`. Run the `gc-*` cross cases with classes after integration. |
| phase4-iteration.js:141-147 | String-wrapper iteration converts with `__lanesPrimitive(value,true)` (OrdinaryToPrimitive). String.prototype[@@iterator] calls ToString(O), i.e. ToPrimitive, which first consults `@@toPrimitive`. This is exact today because no symbol keys exist, but it is a hidden symbol-dependent path that has no hook comment. | Low | Add a PHASE 3 HOOK comment next to the `iterationKind` hook: once symbols exist, return Unsupported (or call full ToPrimitive) when the wrapper chain has `@@toPrimitive`. |
| phase4-registry.js:49-50 (`to_string`) | Every non-string tag goes to the `toText` helper (134). Phase 3 tags 17/18 (Symbol/BigInt) must make ToString throw TypeError (Symbol) or format the BigInt. Nothing here asserts that. | Low | Phase 3: extend `toText` and add a `symbol-substitution-typeerror` fixture (already present as `requiresSymbol` in template-cases.js:66). |
| phase4-object-spread.js:101-122 | Correct: define semantics through `__lanesDefine` with a full data descriptor, own-key exclusion, a per-key `[[GetOwnProperty]]` re-check, and ToObject for primitives. Pinned QuickJS deviates in two places (string sources, deleted keys). Native QuickJS was re-confirmed to disagree on `w3-object-spread:*string primitive*`, `*re-checks each key*` and on my `w8:object-spread-string-primitive-indices`. | — (QuickJS finding) | Keep the ES2025 behaviour. These records must be validated against the fixed (V8) expectations, never against native QuickJS. |
| phase4-spread.js:150-168 | Correct: `__lanesDefine`, not Set, so Array.prototype setters do not fire. Iteration goes through `__lanesIterationKind` (4 → TypeError, 0 → Unsupported). There is no array assumption for generic iterables. | — | none |
| phase4-spread.js:97-106 (`apply`) | Reads the internal argument list with `getProperty`, and a hole would fall through to Array.prototype. Lists are always dense (array_from / append / define_array_el in the same frame), so this is safe. Tag 12 is defensively reported as status 2. | Info | none |
| phase4-spread.js:85-92 (`rest`) | Rest elements are defined (`putProperty(...,true)`), so prototype setters stay silent. Up to 16 allocations within one instruction fits the 192-node pre-instruction GC headroom. | Info | none |
| phase4-iteration.js:258, :269 | `frames[depth].receiver` is overwritten with `V(slot,0,0,0)` (tag 0) to carry continuation data. That is GC-safe, because markValue ignores tag 0. It is correct only because the step/open helpers are strict and never read `this`. | Info | Keep the helpers `this`-free. Add an assertion comment in iterationBootstrapSources. |
| phase4-for-in.js:85-115 | Matches the ES2025 reference algorithm: per-level snapshots, visit-time enumerability re-check, visited set, and shadowing by non-enumerable own keys. The `visited` and `levels` objects are null-prototype, so `__proto__` keys stay plain data. | — | none |

## Native QuickJS (current vendor/) disagreements with fixed ES2025 expectations

These come from check-phase4-suite.mjs. They are useful QuickJS findings, not suite failures.

- Object spread of a string primitive copies nothing (`{..."ab"}` is `{}`):
  `w8:object-spread-string-primitive-indices`, `w3-object-spread:*string primitive*`.
- CopyDataProperties does not re-check a key after an earlier getter deletes it:
  `w3-object-spread:*re-checks each key*`.
- `super.m()` calls an inherited accessor with the home prototype as receiver:
  `w8:class-super-call-accessor-receiver` (new; see above).
- Annex B.3.3 if/else function declarations and B.3.2.1 block functions named `arguments`
  (`w7-edge:annexb-if-else-*`, `w7-edge:annexb-block-fn-*arguments*`, 14 values): these wait for
  worker 7's `phase4-patches/*.diff`, which are not yet applied to vendor/.

The GPU executes QuickJS bytecode, so each compiler-level item above, until patched, means the
GPU result can be expected to match QuickJS rather than the fixed value. The helper-level items
(object spread) are implemented as ES2025 in guest helpers, so the GPU should match the fixed value.

## ID / reservation audit (PHASE-4-STATUS.md)

| Worker | Used | Reserved | Status |
|---|---|---|---|
| 2 spread | builtin 1210; no new continuations (44-45 unused); finish code 2 reused for "omit result" | 1210-1239, 44-45 | OK |
| 3 object spread | builtins 1240, 1241; finish code 2 reused | 1240-1269, 46 | OK |
| 4 iteration | builtins 1270-1274 (1274 = non-resolvable `next` placeholder); continuations 40, 41; heap kinds unused | 1270-1309, 24-25, 40-43 | OK |
| 5 classes | no IDs, kinds or continuations; reuses closure/env `value.z/w` (GC patch required, see above) | 1310-1349, 26-28, 47-49 | OK, pending the GC patch |
| 6 for-in | builtins 1350-1354; continuation 50 | 1350-1369, 29-30, 50-51 | OK |
| 7 edge | none | 1370-1389 | OK |
| 8 conformance | none | 1390-1399 | OK |

No duplicate IDs across modules. Opcode names shared between workers (`swap2` from worker 3;
`insert4`/`dup3`/`perm5` from worker 5) must be appended once (dedupe by name).

## Symbol-dependent paths: Unsupported coverage

- GetIterator: `__lanesIterationKind` is the single choke point. Spread, destructuring and for-of
  all route through it. Plain objects, numbers, functions, booleans and Array-less prototype
  chains give status 6. Covered by `w2-spread:spread-*` unsupported records,
  `w4-iteration` unsupported records, and `w8:unsupported-spread-plain-array-like` /
  `w8:unsupported-destructure-plain-array-like`.
- OwnPropertyKeys (object spread/rest): `__lanesOwnPropertyKeys` (1240) has a documented Phase 3
  hook. for-in keys (1353) must stay string-only (documented).
- Missing hook comments: iteratorOpen's ToString on String wrappers, and `to_string` / `toText`
  for symbol and bigint tags (both Low, above).
