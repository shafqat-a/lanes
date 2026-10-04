# QuickJS reuse: path to ECMAScript 2025 on GPU

Decision (2026-10-02): adopt QuickJS compiler/runtime reuse as the main direction
for the full-language GPU VM. The separate numeric JIT is unaffected.

The bootstrap experiment executed QuickJS numeric bytecode on Apple M1 Metal
(153 checks) and three type-stripped engine262 helpers (148 checks). This validates
an integration route, not an ES2025 conformance claim. The new runtime executes
decoded QuickJS instructions directly in WGSL; it does not nest the previous
Lanes interpreter. Most runtime semantics still need a GPU adaptation.

## Requirements

- ECMAScript 2025 guest execution through WGSL, M1/Safari first.
- CPU parsing/compilation and explicit host services are allowed.
- Automatic whole-job CPU fallback only when WebGPU is unavailable. Unsupported
  features, GPU errors and device loss must never trigger CPU replay.
- The isolated experimental API currently requires a GPU; fallback integration
  is unfinished. Preserve this distinction from the existing VM API.
- Pin QuickJS source and bridge schema. Never expose its private bytecode as a
  stable public format. Maintain source attribution and licenses.

## Phases and acceptance gates

| Phase | Deliverable | Acceptance gate |
|---|---|---|
| 0 | Preserve experiment, revisions, fixtures, licenses and evidence | Reproduce numeric bytecode and helper checks |
| 1 | Browser Wasm compiler; versioned export of instructions, constants, atoms, nested functions and captures | Safari compiles without CPU guest execution |
| 2 | Direct WGSL instruction execution, heap object/property access and calls | Object + nested-call example passes on M1/Safari, including one-instruction dispatches |
| 3 | Complete value/object model, arrays, strings, symbols, BigInt, descriptors, prototypes and collection | Focused semantic and heap-pressure tests; resource limits fail explicitly |
| 4 | Complete synchronous language semantics, declarations, calls, this/arguments, classes, destructuring and exceptions | Applicable synchronous Test262 tests run on GPU with failure inventory |
| 5 | Adapt built-ins and supporting algorithms; use self-hosted helpers where suitable | Built-in tests cover coercion, exceptions and evaluation order |
| 6 | Generators, iterators, promises, async functions and guest job queue | Correct continuation state and microtask order across dispatches |
| 7 | Modules, dynamic import, eval/Function and explicit host request protocol | Compilation services retain scope and return executable data; guest execution stays on GPU |
| 8 | Full applicable ES2025 conformance, upstream gaps, shared memory/Atomics, explicit host and Annex B policy | No unexplained failures or silent feature skips in the declared release scope |
| 9 | M1/Safari release qualification, CPU fallback parity, workloads, resource handling, API and packaging | Reproducible release gates; limitations and performance documented |

Tests grow with every phase. Passing an earlier gate does not certify later
features. Do not convert a test count into a percentage of JavaScript support.

## First parallel 1.0 implementation wave (2026-10-04)

The earlier full integration baseline remains in
[its qualification manifest](../bootstrap/evidence/quickjs-m1-resumed-integration.json).
The [new wave record](../bootstrap/evidence/quickjs-1_0-parallel-wave1.json)
pins the newer compiler/runtime and keeps its verification scope separate.

| Track | Implemented increment | Verification | Still open |
|---|---|---|---|
| Script execution | compileScript using real Script bytecode, fresh global/lexical bindings and completion values | M1:36 programs/144 values,8 compiler boundaries,36 resumption pairs,1 GC probe | Persistent realms and module linking/evaluation |
| Dynamic compilation | Compile-only Function artifacts, validated request service and append reservations | 13 host tests, including actual native/Wasm compilation | GPU suspension/publication, code linking and global lexical access; guest Function remains Unsupported |
| Array methods | flat, flatMap and splice guest algorithms | M1:49 programs/106 values,4 resumption/GC pairs,1 resource boundary;600 host differentials | Existing heap/frame/argument limits remain |
| Integration | Shared compiler/bootstrap/shader wiring | M1 main regression:1,209 programs/10,881 values/238 negative checks and all resumptions | Full ES2025 conformance and release qualification |

All new guest execution remains on GPU. This wave does not claim full 1.0 or
reuse the older full stdlib/Promise passes as passes on the new candidate.
Remaining builtin families, memory/API work, conformance and release gates
continue to apply.

## Latest integration milestone (2026-10-04)

Phase 3 Symbol/BigInt subsets and phase 4 tagged templates, class elements and
global-object behavior are integrated with the built-in waves and tested on M1.
The two previously observed independent semantic defects are fixed. Current GPU evidence is listed
in [README.md](README.md#combined-integration-verification-2026-10-04). Phases
3–5 remain incomplete; later phases and full release gates still apply.

## Current implementation

Phase 1's pinned C bridge and Wasm compiler are implemented. Phase 2's direct GPU
runtime passed the object/call/resumption gate on M1 Metal and Safari. It also includes
early Phase 3/4 support: data properties, arrays, user-defined prototype links,
closure cells, mark/sweep collection, branch/loop execution, method receivers,
basic exceptions/finally, dynamic strings, accessors and initial Object built-ins.
Function property storage now participates in GC, descriptors and extensibility.
Guest function names, computed methods/accessors, explicit Function.prototype,
call/apply/bind, ordinary/bound constructors, and default instanceof are implemented
as subsets. Mapped/unmapped arguments, including aliasing and descriptor
transitions, are implemented without symbol iteration. Array construction,
isArray and basic Array.of are supported. Twenty Array.prototype methods
(push/pop/at/indexOf/includes/every/some/forEach/find/findIndex/findLast/findLastIndex/lastIndexOf/reduce/reduceRight/fill/copyWithin/reverse/shift/unshift)
execute guest helpers, with 685 dispatches validating the original getter/callback
resumption and 1,719 dispatches validating array search resumption. The earlier integrated M1/Safari suite passed 1,124 programs / 10,116 values
and 108 negative checks (`quickjs-safari-parallel-expanded.json`), with matching
native/Wasm compiler exports. This full run precedes the separate compiler fixes;
a packed-program comparison found only two changed main-corpus programs, and
both pass the patched GPU runtime on all nine inputs (18 values).
The previous integrated baseline passed 790 programs / 7,110 values and 61 negative checks.
The seven newest Array methods separately pass 123 programs / 483 values,
including 35 guest-caught negative programs; reduce/mutation/shift resume across
1,394 / 2,106 / 1,412 single-instruction dispatches.
The fresh expanded-phase descriptor rerun passes 1,192 variants with zero
failures, zero resource limits and zero native reference rejections; 826 variants
remain unsupported and 432 files are explicitly excluded
(`quickjs-test262-safari-descriptors-expanded.json`). All 2,018 eligible variants are attempted.
Seven Object statics (getOwnPropertyNames, keys, defineProperties, seal, freeze,
isSealed, isFrozen) now execute GPU guest helpers within the supported object
model. Their focused Safari suite passes 38 programs / 152 values, eight
negative checks and 1,063 resumption dispatches. Symbols and remaining exotic objects are incomplete; wrapper integration is
recorded below.
Phase 5 now includes guest JavaScript adaptations of engine262 descriptor and
ordinary key-conversion algorithms, plus getter-aware apply/bind helpers. Their getters, exceptions and callbacks run
on GPU; dedicated resumption checks pass 210 single-instruction dispatches for
descriptors (209 in the current expanded suite) and 191 for apply. Array descriptors and read-only length/truncation
semantics, including string/object length conversion, have also passed the
M1/Safari regression suite. Number conversion uses exact integer/rational
arithmetic in guest JavaScript with IEEE-754 rounding; its guest callbacks
and parser execute on GPU. Unary numeric operators, numeric binary operators, prefix/postfix updates,
relational comparisons and loose equality now run their conversions on GPU.
A combined numeric/callback check passes 1,256 one-instruction dispatches.
Mixed-type addition, Error message/cause/toString getters and mutable implemented
Object statics also pass. Error callbacks resume across 334 single-instruction
dispatches. Shortest decimal Number formatting passes 173 targeted M1/Safari GPU cases
and 124,709 host algorithm checks. Ordinary computed property-key coercion now runs resumably on GPU; Symbol
keys remain unsupported.
Five String search helpers (indexOf, lastIndexOf, includes, startsWith, endsWith)
pass 49 focused M1/Safari programs / 193 values, 15 negative checks, five
explicit unsupported checks and 4,277 resumption dispatches. The latter three
reject all object/function search values until RegExp/Symbol.match semantics
exist (`quickjs-safari-string-search.json`).

Conformance inventory now covers 4,081 files / 8,121 explicitly recorded variants
across descriptor, Array, and String/Object conversion scopes. There are 6,732
eligible variants and 1,389 harness-excluded variants. The Array GPU run's raw
outcomes are 2,800 passed / 570 unsupported / 14 failed. A provenance-preserving
classification-only report (no rerun) separates these into 2,800 passed / 566
unsupported / 18 resource-limited / zero other failures. The conversion scope separately passes 436 of 1,330 GPU variants, with 894
unsupported, zero failures, zero resource limits and zero reference rejections
(`quickjs-test262-safari-conversions-expanded.json`). Resource-limited cases
remain unresolved, never passes; execution, heap and string limits are counted
separately from unimplemented features and semantic defects.

Immutable undefined/NaN/Infinity captures now ignore sloppy writes and reject
strict writes with TypeError; 29 directed GPU cases pass. Primitive property writes were explicitly unsupported in that earlier run;
wrapper/prototype integration now implements strict/sloppy behavior. The corrected language audit passes 52 programs with two explicit
unsupported outcomes and zero failures (all 29 global-constant checks and
23 language checks). The initial language audit passed 50 cases, failed two, and explicitly
rejected two. Both defects are now fixed by documented local compiler patches:
const-before-initialization writes raise ReferenceError, and for-let-continue
closures retain per-iteration bindings. Dedicated M1/Safari qualification passes
46 GPU programs / 94 values, including 137/333-dispatch resumptions; two unsupported
iteration cases remain expected compiler rejections. Across all 6,732 eligible
Test262 variants, 5,644 packed outputs and 1,088 compiler rejections are unchanged
by the patch; this is compiler-delta evidence, not a GPU rerun. One captured-const RHS
fixture retains a documented Safari reference discrepancy and uses its ES2025
expectation. Global/script const and with/eval paths remain outside the patch.

Cancellation/disposal, queued work rejection, and caller-owned device retention
pass six M1/Safari lifecycle checks. Failure-path tests additionally cover buffer
cleanup and error-scope handling. These are Phase 9 groundwork, not a release gate.

These results do not establish completion of Phases 3 or 4. Larger shader
compilation remains unresolved in Node/Dawn on both M1 and local software WebGPU;
Safari is the actively verified target. CPU fallback has not been introduced.

Next work after the M1/Safari gate: close object-model gaps (intrinsic prototypes,
descriptors/accessors, complete keys and conversions, array length behavior),
extend the conformance runner, and audit every admitted instruction for semantic
coverage. Continue the remaining phases without changing the execution boundary.

## Parallel phases 3–5 (2026-10-03)

Grok owns object-model/Symbol/BigInt work, Claude owns synchronous language
semantics, and Codex owns built-ins. Eight external subagents per provider are
requested; actual launches and blockers are tracked in
[`phase345-workplan.json`](../bootstrap/evidence/phase345-workplan.json).
Codex uses three native workers plus the integration coordinator.

Phase 5's first wave integrates 28 methods with four focused M1/Safari GPU
suites: Array 43 programs / 211 values, String 25 / 97, Number/Math 77 / 360,
and cross-feature GC/coercion/metadata checks 13 / 52. This is partial built-in
coverage. A second integrated wave passes focused GPU suites for Array copy
methods (37 programs / 181 values), numeric parsers (66 / 72), and JSON parsing
(44 / 173). Revivers, JSON stringification and Array toSorted remain pending.

## Foundation integration baseline (2026-10-03)

The full integrated M1/Safari suite passes **1,185 programs / 10,665 values
and 102 negative checks**, including all callback resumption checks. Native/Wasm
compiler parity passes 1,185 main and 29 validation programs.

Claude primitive boxing and Grok String extraction patches are integrated with
ordinary property-key conversion, computed assignments, sparse uint32 array
indices and binary64 exponentiation. Focused M1/Safari qualification passes
173 boxing programs / 689 values and 27 String extraction programs / 105 values.
The boxing suite includes GC/high-index/pow cross-feature checks. Negative,
unsupported, and compiler-rejected cases are counted separately. Template
substitutions remain explicitly rejected pending correct compiler lowering;
String substring/substr use a private span intrinsic rather than mutable slice.
See the README and integration evidence manifest for exact test provenance.

Phases 3–5 advance within their supported subsets; their completion gates remain
open. Symbols, BigInt, remaining exotic objects, classes/destructuring, the full
standard library, generators/async, modules/dynamic code and release qualification
remain unfinished. No CPU fallback was added.

## Full upstream inventory baseline

`inventory-test262-full.mjs CHECKOUT OUTPUT_JSON` inventories every committed
JavaScript file under `test/` directly from Git objects, including paths absent
from a sparse checkout. The pinned revision
`7ab7fafa0003f73fc85c1b95d88094d33f7eb8bd` contains 53,597 tests and 294 fixture
files. The current adapted function harness admits 29,766 test files (57,557
variants); 23,831 require additional harness or execution-context support.
**None of these inventory records is an execution or conformance pass.**

The revision includes post-ES2025 proposals. ES2025 applicability must be reviewed
before defining release gates; current admission does not determine release
scope. Async execution, script-level negative tests, property-descriptor helpers,
realms and typed-array support are substantial harness gaps. The full per-file
inventory, content hashes and admission reasons are in
[quickjs-full-test262-inventory.json](../bootstrap/evidence/quickjs-full-test262-inventory.json).

The integrated upstream property-helper loader raises adapted-harness admission
to 33,611 files / 65,209 variants, retaining 19,986 harness-blocked files. This
removes a harness obstacle for 3,845 files; it does not establish compiler or GPU
support for them. The updated [inventory](../bootstrap/evidence/quickjs-full-test262-property-inventory.json)
retains all original paths and marks every execution as not run. Upstream helper
bytes, revision and license are recorded in
[test262-upstream-harness-manifest.json](test262-upstream-harness-manifest.json).
