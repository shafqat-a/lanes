# Phase 4 next wave, worker 8: conformance inventory and code review

Scope: `phase4-class-elements.js`, `phase4-templates.js`, `phase4-fixed-nodes.js`, and the
class/template/GC parts of `shader.js` (read-only). Inventory: `phase4-next-conformance-cases.js`.
Check: `check-phase4-next-conformance.mjs`. I reviewed the working tree as of 2026-10-03, while the
lead was still editing `shader.js`, `vendor/quickjs.c` and the template files. Line numbers refer to
that snapshot.

This is host-only evidence: the V8 oracle, a private native QuickJS built from `vendor/`, the
coordinator's `generated/compiler`, and `program.js` packing. **No GPU run and no WGSL compilation
were done.** Every "status N" claim about the GPU is a static prediction from the packed bytecode and
the WGSL source.

Severity scale:
- **High**: a spec-valid program gets an undeclared outcome or a wrong value.
- **Medium**: reachable but narrow, or an integration hazard that will fire.
- **Low**: latent hazard or documentation.

## Results of `node check-phase4-next-conformance.mjs`

- 151 cases: 114 required values, 3 uncaught errors, 19 early errors, 5 declared boundaries and
  10 probes.
- **Oracle:** V8 reproduces every fixed expectation. Every value record changes with input+1.
  0 oracle problems.
- **Native QuickJS:** agrees with ES2025 on all but one case, `setter-only private accessor in
  operator` (see F1). That deviation is recorded as `quickjsDeviation`.
- **Packing:**
  - Areas fully packed-ok: tagged-template 11/11, class-fields 14/14, class-static 11/11,
    metadata 28/28.
  - class-private 18/18 and class-private-methods 15/15 pack, but 3 of them are predicted status 2
    (F1, F2).
  - All 19 early errors are rejected with SyntaxError, which is the conformant outcome.
  - The 5 declared boundaries keep their declared outcome. No boundary drift.
  - Every packed opcode has a WGSL case.
- **Gaps (required cases):**
  - global area: 17 compiler-rejected (`Unsupported global or module reference`) and
    2 predicted status 6 at `push_this`.
  - Probe `probe resumption sloppy global this` is rejected.
  - 3 predicted status-2 cases (F1, F2).
  - The global gaps are assignment 6's work. They are listed so they cannot be closed by
    re-labelling them as boundaries.
- **Append-only:** `OP` and `FIELDS` of HEAD~2, HEAD~1 and HEAD are exact prefixes of the working
  tree. This wave appended `private_symbol` … `private_in` and `push_template` to OP, and `raw` to
  FIELDS.
- **Static GC/fixed-node checks:** all hold:
  - the free list skips 26..79;
  - `freeCount` excludes the 54 reserved nodes;
  - the sweep skips 26..79;
  - init checks node 25;
  - node 64 is the only initialized reserved node and it is rooted;
  - private and template marking is present.

## Findings (ranked)

### F1 — High: `#s in o` for a setter-only private accessor hits status 2 on the GPU (and is wrong in QuickJS)

- **Code:**
  - `vendor/quickjs.c:33839-33842` (`resolve_scope_private_field`, `OP_scope_in_private_field`)
    loads the variable named `#s`.
  - For a setter-only accessor, that local is never written. `js_parse_class`
    (`vendor/quickjs.c:25651-25683`) stores the setter in `#s<set>` and leaves `#s` uninitialized.
    The packed bytecode is `get_arg0; get_var_ref0; private_in`, where the cell is still
    `set_loc_uninitialized`.
  - On the GPU, `private_in` (`phase4-class-elements.js:171-176`) sends that tag-6 value to
    `privateName()` (`:91-94`), which sets **status 2** (invalid bytecode state).
- **Outcome:** that is not a declared outcome, so the strict harness fails it. ES2025 13.10.1 gives
  `true` for a branded instance. Pinned QuickJS gives `false:false` because it converts the
  uninitialized value to an atom.
- **Fixture:** `n-w8:setter-only private accessor in operator` (expected `true:false:1`).
- **Fix (vendor; the lead owns it):** in the `OP_scope_in_private_field` case, re-resolve when
  `var_kind == JS_VAR_PRIVATE_SETTER`, as the put path at `:33811-33821` already does:
  ```c
  case OP_scope_in_private_field:
      if (var_kind == JS_VAR_PRIVATE_SETTER) {
          JSAtom setter_name = get_private_setter_name(ctx, var_name);
          if (setter_name == JS_ATOM_NULL) return -1;
          idx = resolve_scope_private_field1(ctx, &is_ref, &var_kind, s, setter_name, scope_level);
          JS_FreeAtom(ctx, setter_name);
          if (idx < 0) return -1;
      }
      get_loc_or_ref(bc, is_ref, idx);
      dbuf_putc(bc, OP_private_in);
      break;
  ```
  The setter closure has its `[[HomeObject]]` set (`set_home_object` at `:25665`), so the existing
  `private_in` brand path (`name.z==5`) answers correctly. No WGSL change is needed.

### F2 — High/Medium: private names are created in source order, so computed keys before the declaration reach status 2

- **Spec:** ES2025 15.7.14 ClassDefinitionEvaluation creates every private name (step 6) before any
  element is evaluated.
- **Code:** pinned QuickJS emits `private_symbol` where the field is parsed
  (`vendor/quickjs.c:25714`). A computed key that appears earlier in the class body therefore reads
  an uninitialized compiler local:
  - `object; get_loc3; private_in` for `static [(#p in {}, 'k')] = 1; #p;`
  - `object; get_var_ref0; get_private_field` for a read
- **Outcome:** the GPU gives status 2 (`privateName`). The ES2025 result is `false` or a catchable
  TypeError. Native QuickJS happens to give the right values.
- **Fixtures:** `n-w8:private in inside a computed key before the declaration`,
  `n-w8:private read inside a computed key before the declaration`.
- **Fix (local to `phase4-class-elements.js`, spec-equivalent):** have `privateName()` return a
  sentinel for an uninitialized (tag 6) operand:
  - `get_private_field` / `put_private_field` then raise TypeError (status 4);
  - `private_in` pushes `false`;
  - `define_private_field` keeps status 2 (it can only run after `private_symbol`).

  This is exact because no object can carry a private name or brand before that name's
  `private_symbol` / method closure exists, since names are fresh per class evaluation.
  `check_brand` with a tag-6 method variable already gives TypeError through `privateBrand`.

### F3 — Medium (latent High): reserved fixed nodes survive the sweep even when not rooted

- **Code:**
  - `shader.js:139` skips 26..79 in the sweep unconditionally.
  - Roots are only `1..25` plus `PHASE4_FIXED_ROOTS` (`shader.js:112`,
    `phase4-fixed-nodes.js:31`, currently `[64]`).
- **Failure scenario:** a reserved node is initialized in place but not added to the roots list.
  Candidates are the global object at 65 (assignment 6, in progress: `phase4-global-cases.js`
  exists) and Phase 3 nodes 26..63, whose header says "Phase 3 initializes and marks them". Such a
  node keeps its own slot, but its `next` property chain, prototype (`value.x`) and values are not
  marked. They are swept and handed out again by `alloc()`, so `globalThis.Math` (for example) later
  reads a recycled node. That is silent heap corruption, not an explicit failure.
- **Fix:**
  - Make the root set self-describing: in `collect()`, mark every reserved node whose `kind != 0`:
    `for(var i=26u;i<=79u;i++){if(states[l].heap[i].kind!=0u){mark(l,i);}}`.
  - Or assert at shader build time that every in-place `Node(` write to 26..79 is in
    `PHASE4_FIXED_ROOTS`.
  - `check-phase4-next-conformance.mjs` already reports `gc.unrootedInitializedReservedNodes`.
    Keep it as a gate when node 65 lands.
- **Answers to the brief:**
  - Dynamic `alloc()` cannot return 26..79 or 64. The init free list links 25 → 80 before the
    first `alloc` (`shader.js:1302-1305`), `freeCount` excludes the 54 nodes, and the sweep never
    pushes them.
  - The free list cannot contain a root: 1..25 are always marked and 26..79 are never swept.
  - The last heap node's `next` is 0 because `runtime.js:118` zero-fills the state buffer.

### F4 — Medium (integration): strict-browser declarations flip when the global object lands

- **Records:** these declare `unsupported` because the GPU had no global object:
  - `phase4-edge-cases.js:231-245` u1–u7 (runtime status 6 at `push_this`);
  - u8/u10/u11 (`:247-254`, compiler rejection);
  - `phase4-template-tagged-cases.js:161-162` (`n-template:sloppy-tag-this-global`).
- **Failure scenario:** once assignment 6 makes sloppy `this` the global object, these records
  produce values. `browser-phase4.js:66` then reports "expected unsupported; GPU produced value",
  and `:52` reports "expected compile rejection; compilation succeeded".
- **Fix:** convert them to value records, using their `expected` fields, in the same integration
  change. Do not relax the harness. u5 (prologue-granularity status 6) becomes a plain value too.
- **Related doc drift:** `PHASE-4-NEXT-STATUS.md:26,31` still reserve fixed nodes 26/27.
  `phase4-fixed-nodes.js` now uses 64/65 and reserves 26..63 for Phase 3.

### F5 — Low: `privateBrand` reports status 4 (TypeError) for an internal invariant violation

- **Code:** `phase4-class-elements.js:121-126`.
- **Issue:** `check_brand` / `private_in` with a non-closure, or a closure without
  `[[HomeObject]]`, becomes a catchable TypeError. Reachable compiler output never does this except
  the TDZ case in F2, where TypeError is the right answer. Any other occurrence would be a lowering
  bug, and status 4 hides it.
- **Fix:** none needed now. If F2 is fixed through the `privateName` sentinel, `privateBrand` can
  return status 2 for `z!=5 && z!=6`.

### F6 — Low: the private-element representation relies on nothing else touching `value.y` of kind 2/8

- **Status:** I verified this holds today by grep.
  - The only `value.y` writes are: the closure node's backing (`shader.js:197`, kind 5);
    array lengths (`:518`, `:565`, `:948`, kind 7); and wrapper-prototype holders (`:1323-1325`,
    kind 16).
  - No code copies a whole kind-2 `value` into another node, which would alias the private chain.
- **Hazard:** Phase 3 or later work that clones objects or reuses `value.y` must keep this rule.
- **Fix:** add the invariant as a comment next to `collect()` line 129.

### Checked and found correct

- **Exception identity:**
  - Private-element errors set status 4. The main loop (`shader.js:1628-1636`) turns that into
    `makeError(kind 1)` with prototype node 5 (TypeError) and calls `raise()`. The strict wrapper
    then sees `instanceof TypeError && getPrototypeOf === TypeError.prototype`.
  - `throw_error` takes the type byte from `bytes[5]` (`program.js:172`). `JS_THROW_VAR_RO` (0) →
    TypeError, which covers method/getter-only writes and setter-only reads.
  - ES2025 operand order is preserved, and the fixtures cover it:
    - `this.#m = rhs`: the right side runs first, then TypeError.
    - `this.#g += rhs`: the getter runs, then the right side, then TypeError.
    - `this.#s += rhs`: TypeError before the right side.
- **GC:**
  - `collect()` marks the following: the kind 2/8 `value.y` chain; kind 34 value and private name;
    kind 35 brand home; kind 32 `value.x`; registry node 64 through roots.
  - Kind 33 has no references.
  - Brand homes are retained, so a stale home id cannot be reused as a false brand.
  - Probes target this case: `n-w8:probe stale method brand home is never reused` and
    `n-w8:probe stale private name is never reused`.
- **Allocation headroom:** `templateCreate` makes at most 2·16+3 allocations within one instruction,
  under the 192-node pre-instruction headroom. Collection happens only at instruction boundaries.
- **Resumption:**
  - None of the eight new opcodes suspends. Each completes or sets a status inside one instruction.
  - Field, static and private-accessor code runs as ordinary `call_method` frames. String.raw is a
    guest helper.
  - No new `keySlot` retry entries are needed: private names never go through property-key
    conversion.
- **Append-only:** `OP` and `FIELDS` are stable against HEAD~2, HEAD~1 and HEAD (checked by
  importing the git-archived `program.js`).
- **Template object shape:**
  - Elements and the array `length` are enumerable-only (`dataProperty` flags 2 → `marked` 4).
  - `raw` uses flags 0.
  - Arrays have `w=0` (non-extensible) and `value.z` bit 0 set (length non-writable).
  - `header.x` is bounded by `L.args`, and the packer enforces ≤16.

## Suite integration (exact records for the lead)

`phase4-suite.js`:
```js
import { conformanceCases, conformanceErrorCases, conformanceEarlyErrorCases, conformanceBoundaryCases, conformanceProbeCases, conformanceResumptionIds } from './phase4-next-conformance-cases.js';
// in `sources`, after the n-class lines:
  // Next wave worker 8: independent ES2025 inventory (per-item `area`). Required
  // records stay value records even where they are current gaps (global area).
  ['n-w8', 'conformance', 'value', conformanceCases],
  ['n-w8', 'conformance', 'value', conformanceErrorCases],
  ['n-w8', 'conformance', 'rejected', conformanceEarlyErrorCases],
  ['n-w8', 'conformance', 'unsupported', conformanceBoundaryCases.filter(item => item.status === 'unsupported')],
  ['n-w8', 'conformance', 'rejected', conformanceBoundaryCases.filter(item => item.status === 'rejected')],
  ['n-w8', 'probe', 'value', conformanceProbeCases],
// in phase4ResumptionIds:
  ...conformanceResumptionIds,
```
`conformanceResumptionIds` contains:
- `n-w8:probe resumption private accessors in derived field initializers`
- `n-w8:probe resumption getter tag forwarding to String.raw`
- `n-w8:probe resumption computed static key with toString and private in`
- `n-w8:probe resumption sloppy global this` (a gap until assignment 6)

The GC probes (300-iteration loops) are value records only. They are too long for
one-instruction-per-dispatch resumption under the 60,000-dispatch bound.

`phase4-suite-expected.js` second expectations: run
`node check-phase4-next-conformance.mjs --records`, which prints the V8-verified
`"n-w8:<feature>": <value>,` lines for every value record. These are omitted for uncaught-error
records, which use input+2 parity.
