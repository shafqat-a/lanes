# Coordinator verification update (2026-10-04)

The latest integrated core is GPU-tested on Apple M1 Safari. The primary language
suite has 811 semantic passes and zero unexpected failures. The independent suite
now has 228 semantic passes and zero failures; the strict-global reference timing
and Function.prototype.toString defects are fixed. Unsupported, rejected and
resource-limited outcomes remain separately reported. Resumption and required-GC
checks pass. See `quickjs-next-core-integration-manifest.json` in the evidence
folder. The original worker report below describes its earlier snapshot.

---

# Phase 4 next wave (synchronous language) — status and integration contracts

Owner: Phase 4 lead (single integrator for `vendor/`, `bridge.c`, `program.js`,
`shader.js`, `bootstrap.js`, `compiler.js`, `phase4-registry.js`,
`phase4-fixed-nodes.js`, `phase4-class-elements.js`, `phase4-case-groups.js`,
`phase4-suite*.js`, README/ROADMAP).
Continues [PHASE-4-STATUS.md](PHASE-4-STATUS.md); the previous 8-worker wave
and the Phase 5 builtins (Math/Number/JSON globals, arraycopy, parsers) are
already integrated in this snapshot and were not redone. This file does **not**
declare Phase 4 complete. Everything below is host-verified only: no WGSL from
this wave has been compiled, and nothing ran on a GPU (coordinator owns M1/Safari).

## Ground rules (unchanged)

- Guest semantics execute only on the GPU through WGSL. Host code only parses,
  compiles, packs and runs *test oracles* (V8, a private native QuickJS built
  from `vendor/`). No CPU replay, no Node/Dawn GPU, no host-global fallback.
- Unsupported forms fail explicitly: compiler rejection (`SyntaxError`),
  runtime status 6 (Unsupported) or status 3 (Resource limit).
- Normative ES2025 expectations outrank pinned-QuickJS/V8 behaviour; deviations
  are recorded per fixture (`quickjsDeviation`, `v8Deviation`,
  `phase4NormativeDifferences`).
- The strict browser harness (`browser-phase4.js`) was not relaxed.

## Fixed intrinsic heap node layout (`phase4-fixed-nodes.js`, single source of truth)

| Nodes | Owner | Notes |
|---|---|---|
| 1–25 | existing | allocated in `main()` init in order (… 23 Math, 24 Number ctor, 25 JSON); init now checks `jsonObject==25` (else status 2) |
| 26–63 | **Phase 3 reserved** | never on the free list, never swept |
| 64 | tagged-template `[[TemplateMap]]` registry (kind 32) | written in place at init (was draft node 26) |
| 65 | global object (kind 2, proto `Object.prototype`) | written in place only in global-object mode (was draft node 27) |
| 66–79 | Phase 4 next wave, unassigned | document here before use |

Enforced in `shader.js`: the init free list links node 25 straight to 80 and
zeroes 26..79; `freeCount` excludes the 54 reserved nodes (heap 2048 → 1993
dynamic nodes; programs near the limit hit status 3 sooner); `collect()` marks
1..25, `PHASE4_FIXED_ROOTS` (64, 65) and every reserved node whose kind != 0
(so an in-place fixed node can never be left unrooted); the sweep never puts
26..79 on the free list (it only clears their mark bit). `alloc()` therefore
cannot return or overwrite a reserved node.

## Reservations for this wave (actual use)

| Assignment | Private builtin IDs | Heap kinds | Continuations | Fixed nodes | Used |
|---|---|---|---|---|---|
| 1 tagged templates | 2000–2019 | 32 | 56–57 | 64 | `String.raw` ID, kind 32, node 64, field `raw`, opcode `push_template` |
| 2 public instance fields | 2020–2039 | — | 58–59 | — | none |
| 3 static fields / static blocks | 2040–2059 | — | 60–61 | — | none |
| 4 private fields / `#x in o` | 2060–2089 | 33–35 (shared with 5) | 62–63 | — | kinds 33–35 |
| 5 private methods / accessors | 2090–2109 | 33–35 (shared with 4) | 64–65 | — | kinds 33–35 |
| 6 sloppy global this / global object | 2110–2139 | 36 | 66–67 | 65 | node 65, opcodes `get_global`/`put_global`/`delete_global`, global FIELDS names; IDs/kind 36/continuations unused |
| 7 function/class metadata audit | 2140–2159 | — | 68–69 | — | none |
| 8 conformance / review (tests only) | 2160–2179 | — | — | — | none |
| lead spare | 2180–2199 | 37–39 | 70–71 | 66–79 | none |

Existing contracts kept: Phase 3 IDs 1000–1199, tags 17/18, heap kinds 17–23;
previous Phase 4 IDs 1200–1399, kinds 24–31, continuations 40–55; Phase 5 IDs
1400–1839 (JSON.stringify 1820); pending JSON reviver 1860/1861 untouched.
Every OP/FIELDS index is append-only (worker 8 verified OP/FIELDS of HEAD~2,
HEAD~1, HEAD unchanged; this wave appends 7 private opcodes, `push_template`,
3 global opcodes, `raw` and the global names). GPU binding 5 is not used.
**Merge note:** root main has advanced (JSON.stringify 1820, sort 1840/1841,
Unicode 1850/1851, read-only Unicode table binding 5); none of those are in
this snapshot and a future merge must preserve them.

## Delegation record (this wave, actual calls)

K = 8. Eight background workers were launched in one parallel batch, one
assignment each, with disjoint owned files (shared core edits returned as
exact proposed edits/diffs, integrated by the lead):

| # | Assignment | Worker output | Follow-up calls |
|---|---|---|---|
| 1 | tagged templates | `phase4-templates.js` node 64 remap, 5 value + 1 status-6 + 6 early-error fixtures, `phase4-next-w1-notes.md` | 1 message (fixed-node module) |
| 2 | public instance fields | `phase4-next-w2-cases.js` (65 fixtures), `check-phase4-next-w2.mjs`, 3 defects + diffs | 1 resume (update after fixes applied) |
| 3 | static fields / blocks | `phase4-next-w3-cases.js` (71 fixtures), `check-phase4-next-w3.mjs`, suite diff; no runtime defect | — |
| 4 | private fields / `#x in` | `phase4-next-w4-cases.js`, `check-phase4-next-w4.mjs`, 2 defects + diffs | 1 resume (update after fixes applied) |
| 5 | private methods / accessors | `phase4-next-w5-cases.js`, `check-phase4-next-w5.mjs`, 2 defects + diffs | 1 resume (update after fixes applied) |
| 6 | sloppy global this / global object | `phase4-global.js`, `phase4-global-cases.js`, `check-phase4-global.mjs`, 17 exact edits | 1 message (fixed-node module) |
| 7 | function/class metadata | `phase4-next-w7-cases.js` (78 + 3 + 2), `check-phase4-next-w7.mjs`; no defect | — |
| 8 | conformance inventory / review | `phase4-next-conformance-cases.js` (151), `check-phase4-next-conformance.mjs`, `phase4-next-w8-review.md` | — |

Two further lead-scoped agents ran after the eight finished: one converted the
five suites that asserted "Unsupported tagged template" into admitted value
checks (boxing / string-extract / native, host + browser pages); one
reconciled suites after the global object landed and registered the remaining
fixture groups (see "Integration after the global object").

## Implemented and integrated by the lead (exact changes)

Shared core:
- `phase4-fixed-nodes.js` (new) and `shader.js` init/`collect()`/sweep: the
  fixed-node layout above.
- `phase4-class-elements.js` `defineOwnData` (w2): Array `length` field →
  TypeError (was status 6); mapped-arguments element (kind 15) → write through
  the mapping, ES2025 10.4.4.2 (was status 6).
- `phase4-class-elements.js` (w4 D2 + w5): `privateNameOrAbsent` (TDZ name →
  key 0), `privateFind` rejects key 0, used by `get_private_field`,
  `put_private_field`, `private_in`; `privateSlotLoad` flags unchecked
  `get_loc`/`get_var_ref` that feed a private opcode.
- `program.js`: such loads pack with `b=1`; `shader.js` get case keeps a TDZ
  cell as a value only when `ins.z!=0` (a private computed-key read before the
  element is defined → TypeError / `false`, not ReferenceError).
- `shader.js` (w4 D1): `set_name_computed` over a kind-33 private name names
  the function `#f` and never runs ToPropertyKey on it (was wrong name /
  internal error for `#f = () => 0`).
- `vendor/quickjs.c` (w2): instance field named `prototype` admitted (only
  static `prototype` / any `constructor` field is an early error).
- `vendor/quickjs.c` (w5): `#x in o` for a setter-only private accessor loads
  the `#x<set>` closure (same brand); previously a never-initialized slot.
- Global object (w6, applied verbatim from `phase4-global.js`
  `globalPatches`): `phase4-registry.js` (import, 3 appended opcodes, WGSL
  functions/cases), `program.js` (FIELDS append, `globalProgramPlan`, capture
  spec 7 for global refs, `image[0].w` bit 17, lowering of
  `get_var`/`get_var_undef`/`put_var`/`delete_var`), `shader.js` (closure skips
  spec 7, node-65 gaps in `prototypeGap`/own keys/`putProperty`, `push_this`
  undefined/null → node 65 in global mode, `globalInit` before the entry
  closure + entry binding), `PHASE4_FIXED_ROOTS` += 65.
- `phase4-suite.js`: missing tagged-template import (suite failed to load),
  `n-static`/`n-meta` groups, w3 normative difference, w3 resumption ids;
  `phase4-case-groups.js`: `class-static`, `function-metadata`.
- Compilers rebuilt twice (after each vendor change): native
  `generated/compiler` (`node build.mjs`) and Wasm `generated/compiler.mjs`
  (EMCC `/tmp/lanes-bootstrap-xcCerK/emsdk/upstream/emscripten/emcc`). Workers
  2, 4 and 5 verified native-vs-Wasm packed `code`/`image` identical for all
  their fixtures (raw atom bytes differ per instance; packing resolves them).

Explicit boundaries kept/declared:
- Private elements on arrays/arguments/wrappers/unmapped built-ins (return
  override) → status 6; `this.#m++` / `this.#m += ''` expected status 6 (needs
  function source text; unconfirmed on GPU).
- Static `caller`/`arguments` and own-`caller`/`arguments` queries → status 6;
  `Function.prototype.call/apply/bind/toString` name/length → status 6; own keys
  of sloppy functions → status 6.
- Async/generator class methods and private methods compiler-rejected;
  async/generator function values rejected by `packProgram` (RangeError).
- Tagged templates: `eval` tag and Symbol rejected; `Function(...)` bodies
  status 6; one realm per run; `String.raw` reflective queries status 6;
  > 16 strings per site / > 256 UTF-16 units → pack-time RangeError.
- Global object: unimplemented ES2025 globals (Symbol, Map, Reflect, eval,
  isNaN, …) compiler-rejected by name, status 6 when reached dynamically; full
  own-key lists of the global object status 6; `function NaN(){}` (and
  Infinity/undefined entry names) rejected; top-level script code / global
  lexical declarations stay rejected (programs are one function). Known
  shared QuickJS/V8 deviation: strict assignment to a name created by its own
  RHS stores instead of throwing. `Object.prototype.toString.call(globalThis)`
  is `[object Object]` (host tag needs Symbols).
- Class source text not implemented.

## Symbol handshakes (Phase 3)

- Private names are not Symbols (ES2025 6.2.12); `privateName()` rejects every
  non-kind-33 value with status 2 (TDZ marker excepted, see above), so Phase 3
  tag-17 values can never be used as private names.
- Computed field keys go through `to_propkey`/`keyOf`: Phase 3 must teach
  `keyOf` symbol keys (today non-string/number keys are status 6; the w3
  Symbol-keyed static field fixture fails closed and becomes a value case).
- `defineOwnData` uses `findProperty`; no change needed once keys carry symbols.
- Template objects are plain frozen arrays: only symbol keys are needed.
- `instanceof` must consult `@@hasInstance` first once Symbol exists.
- Global object: add `Symbol` (and BigInt) as properties, remove them from
  `globalUnimplementedNames`, add them to `program.js`'s literal table
  (`check-phase4-global.mjs` fails if the lists drift); `@@toStringTag`.
- Private-element storage uses `value.y` of kind 2/8 holders: Phase 3/6 must
  not reuse that word (e.g. for Proxy).

## Tests run (host only; no GPU, no CPU replay)

See the final integration table below; per-worker results are in
`phase4-next-w*-notes.md`, `phase4-next-w8-review.md`.

## Pending / required from the coordinator

1. M1/Safari: full `phase4.html` plus boxing/string-extract pages. WGSL for
   this wave (class elements, templates, global object, fixed-node layout) has
   never been compiled.
2. Rebuild is already done for this snapshot; rebuild again only if vendor or
   bridge changes.

## Remaining Phase 4 gaps (explicit)

- Everything listed in PHASE-4-STATUS.md that is not addressed above.
