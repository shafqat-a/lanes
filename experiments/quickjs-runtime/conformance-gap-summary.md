# Selected conformance gaps

Selected adapted directory subsets only. Strict/sloppy variants are counted separately. No full ECMAScript 2025 coverage or completion percentage is inferred. Reports are dated snapshots; later source changes require new evidence.

Test262 checkout: `7ab7fafa0003f73fc85c1b95d88094d33f7eb8bd`. This summary analyzes saved reports; it does not execute GPU tests. Exact diagnostic histograms, report hashes, source hashes, directory counts, exclusion reasons and resource-limited records are in [conformance-gap-summary.json](./conformance-gap-summary.json).

| Snapshot | Passed | Unsupported | Compile / runtime unsupported | Resource limited | Failed | Exported variants |
|---|---:|---:|---:|---:|---:|---:|
| conversions | 436 | 894 | 330 / 564 | 0 | 0 | 1330 |
| arrays | 2800 | 566 | 220 / 346 | 18 | 0 | 3384 |
| descriptors | 1192 | 826 | 534 / 292 | 0 | 0 | 2018 |

The arrays snapshot is a **classification-only derivation**, not a new test run. It moves 14 formerly failed and four formerly unsupported resource outcomes into a separate bucket. Those 18 cases remain unresolved. The fresh descriptor rerun reproduces the prior 1,192 passed / 826 unsupported counts. Equal totals do not prove identical failing rows; this artifact records the fresh report diagnostics.

## Diagnostic breakdown

### conversions

Saved report: [quickjs-test262-safari-conversions-expanded.json](../bootstrap/evidence/quickjs-test262-safari-conversions-expanded.json), dated `2026-10-02T19:34:27.125Z`.

| Normalized unsupported diagnostic | Variants |
|---|---:|
| `Unsupported runtime operation in lane <n>, instruction <n>; no CPU fallback` | 564 |
| `Unsupported QuickJS instruction: for_in_start` | 100 |
| `Unsupported global or module reference: Symbol` | 70 |
| `Unsupported global or module reference: Date` | 34 |
| `Unsupported global or module reference: RegExp` | 32 |
| `Unsupported global or module reference: JSON` | 26 |
| `Unsupported global or module reference: Math` | 26 |
| `Unsupported global or module reference: Proxy` | 18 |
| `Unsupported global or module reference: BigInt` | 6 |
| `Unsupported global or module reference: eval` | 4 |
| `Unsupported QuickJS instruction: push_bigint_i32` | 2 |
| `Unsupported QuickJS instruction: to_object` | 2 |
| `Unsupported global or module reference: Map` | 2 |
| `Unsupported global or module reference: Promise` | 2 |
| `Unsupported global or module reference: Set` | 2 |
| `Unsupported global or module reference: WeakMap` | 2 |
| `Unsupported global or module reference: WeakSet` | 2 |

Runtime source signals below overlap. They identify likely work areas, **not confirmed root causes or disjoint counts**. Exact runtime messages lack the missing operation name.

| Source signal | Runtime unsupported variants containing it |
|---|---:|
| object_create | 344 |
| boxed_primitive_construction | 112 |
| property_descriptors | 102 |
| string_prototype_access | 78 |
| function_this_or_sloppy_receiver | 36 |
| builtin_metadata_name_length | 28 |
| number_or_boolean_prototype_access | 14 |

### arrays

Saved report: [quickjs-test262-safari-arrays-expanded-classified.json](../bootstrap/evidence/quickjs-test262-safari-arrays-expanded-classified.json), dated `2026-10-02T19:21:34.354Z`.

| Normalized unsupported diagnostic | Variants |
|---|---:|
| `Unsupported runtime operation in lane <n>, instruction <n>; no CPU fallback` | 346 |
| `Unsupported global or module reference: Math` | 40 |
| `Unsupported global or module reference: Symbol` | 40 |
| `Unsupported global or module reference: RegExp` | 30 |
| `Unsupported global or module reference: Date` | 28 |
| `Unsupported global or module reference: JSON` | 28 |
| `Unsupported QuickJS instruction: pow` | 18 |
| `Unsupported QuickJS instruction: regexp` | 8 |
| `Unsupported global or module reference: eval` | 8 |
| `Unsupported global or module reference: foo` | 8 |
| `Unsupported global or module reference: Proxy` | 6 |
| `Unsupported global or module reference: parseInt` | 4 |
| `Unsupported global or module reference: isNaN` | 2 |

Resource limits, excluded from the unsupported table:

- 10: `Execution limit; use start()/step() to resume`
- 4: `GPU string limit: 256 UTF-16 code units`
- 2: `Resource limit in lane 0, instruction 349; no CPU fallback`
- 2: `Resource limit in lane 0, instruction 55; no CPU fallback`

Runtime source signals below overlap. They identify likely work areas, **not confirmed root causes or disjoint counts**. Exact runtime messages lack the missing operation name.

| Source signal | Runtime unsupported variants containing it |
|---|---:|
| boxed_primitive_construction | 120 |
| function_this_or_sloppy_receiver | 58 |
| large_indices_or_lengths | 26 |
| number_or_boolean_prototype_access | 26 |
| string_prototype_access | 6 |
| property_descriptors | 4 |

### descriptors

Saved report: [quickjs-test262-safari-descriptors-expanded.json](../bootstrap/evidence/quickjs-test262-safari-descriptors-expanded.json), dated `2026-10-02T19:46:48.811Z`.

| Normalized unsupported diagnostic | Variants |
|---|---:|
| `Unsupported runtime operation in lane <n>, instruction <n>; no CPU fallback` | 292 |
| `Unsupported QuickJS instruction: for_in_start` | 214 |
| `Unsupported global or module reference: Date` | 134 |
| `Unsupported global or module reference: Math` | 88 |
| `Unsupported global or module reference: RegExp` | 56 |
| `Unsupported global or module reference: JSON` | 34 |
| `Unsupported global or module reference: Symbol` | 4 |
| `Unsupported QuickJS instruction: push_bigint_i32` | 2 |
| `Unsupported global or module reference: document` | 2 |

Runtime source signals below overlap. They identify likely work areas, **not confirmed root causes or disjoint counts**. Exact runtime messages lack the missing operation name.

| Source signal | Runtime unsupported variants containing it |
|---|---:|
| property_descriptors | 290 |
| boxed_primitive_construction | 108 |
| string_prototype_access | 54 |
| number_or_boolean_prototype_access | 40 |
| large_indices_or_lengths | 10 |
| builtin_metadata_name_length | 2 |

## Priorities

1. **Primitive boxing, primitive prototype objects, and complete builtin function metadata/descriptors.** Runtime unsupported diagnostics dominate conversions and arrays. Source signals show new String/Number/Boolean, String.prototype access and builtin metadata reads. Diagnostics alone do not determine which branch failed. Validation: Add focused GPU cases; rerun selected conversion/array subsets against pinned source.

2. **Object.create second properties argument via existing descriptor conversion pipeline.** Object/create accounts for 524 conversion unsupported variants across all causes. Direct source inspection of 15.2.3.5-4-1.js exercises the currently rejected properties argument; metadata-only 15.2.3.5-0-2.js is another separate blocker. Do not interpret 524 as all fixable by this one change. Validation: Descriptor getter ordering, abrupt completion and no partial definition during descriptor collection.

3. **for-in enumeration and missing compile-time operations.** for_in_start blocks 100 conversion and 214 descriptor variants. Array pow/regexp and conversion to_object/push_bigint_i32 have distinct missing semantics. Validation: Own/inherited enumeration, mutation and dispatch resumption; language-specific conformance batches.

4. **Symbols and conversion hooks, then remaining standard globals.** Exact compile diagnostics identify Symbol, Date, RegExp, Math, JSON, Proxy, eval and other globals. These are dependency blockers, not proof each test would pass once the global name exists. Validation: Implement observable semantics and descriptors, never placeholder success or CPU replay.

5. **Resolve resource limits separately from missing semantics.** Array classified report has 18 resource-limited variants: preserve original outcomes; no rerun occurred in classification. Validation: Replay targeted resource cases with measured heap/string/dispatch requirements; retain unresolved outcomes until GPU evidence exists.

6. **Expand adapted harness and full script/module execution accounting.** Harness exclusions are outside exported GPU variants; adapted function wrapping is not upstream full Test262 execution. Validation: Record source files and strict/sloppy variants, excluded harness reasons and unsupported host semantics explicitly.

## Descriptor rerun observations

The fresh descriptor snapshot contains 826 unsupported variants: 534 compile-time and 292 runtime. Counts match the historical parallel-integration snapshot. The new Object statics did not remove these `for_in_start` or missing-global blockers. Instruction offsets cannot be compared across changed compiler/bootstrap images.

The conversion snapshot excludes 123 source files / 246 variants; arrays excludes 148 files / 291 variants. Fresh descriptors excludes 432 files / 852 variants. Do not add file exclusions to variant totals. Host oracle and compiler parity checks are separate evidence from GPU passes.
