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
isArray and basic Array.of are supported. Safari passes 362 programs / 3,258 values and 24 negative checks.
The adapted descriptor inventory most recently passed 406 variants with zero
failures; 626 variants remained unsupported and 925 files were excluded.
Phase 5 now includes guest JavaScript adaptations of engine262 descriptor and
ordinary key-conversion algorithms. Their getters, exceptions and callbacks run
on GPU; the dedicated resumption check passes 206 single-instruction dispatches.
These results do not establish completion of Phases 3 or 4. Larger shader
compilation remains unresolved in Node/Dawn on both M1 and local software WebGPU;
Safari is the actively verified target. CPU fallback has not been introduced.

Next work after the M1/Safari gate: close object-model gaps (intrinsic prototypes,
descriptors/accessors, complete keys and conversions, array length behavior),
extend the conformance runner, and audit every admitted instruction for semantic
coverage. Continue the remaining phases without changing the execution boundary.
