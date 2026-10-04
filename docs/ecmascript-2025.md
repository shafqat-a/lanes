# ECMAScript 2025 support in Lanes

Applies to the experimental QuickJS/WGSL runtime released in v0.2.0-alpha.1, not the numeric i32 JIT or older VM. **Full ECMAScript 2025 is not implemented.** CPU compilation prepares bytecode; guest execution uses WGSL on GPU.

“Implemented subset” means code and focused tests exist within the runtime's limits. It does not mean a whole specification chapter passes Test262. “Not implemented” means no supported guest execution path. The feature set below is an overview, not an exhaustive per-method compatibility contract.

## Features introduced in ES2025

The scope follows the [official ECMAScript 2025 specification](https://tc39.es/ecma262/2025/multipage/), rather than newer proposals.

| ES2025 addition | Lanes status | Details |
|---|---|---|
| Set composition and relationship methods | Implemented subset | union, intersection, difference, symmetricDifference, isSubsetOf, isSupersetOf, isDisjointFrom; guest helpers and focused standard-library cases. Collection subclassing and general object-model gaps remain. |
| Math.f16round | Implemented subset | Guest numeric helper and rounding/coercion cases; this does not imply Float16Array support. |
| Iterator constructor and helpers | Not implemented as a complete API | Existing generator/collection iteration is separate from Iterator.from, map, filter, take, drop, flatMap, reduce, toArray, forEach, some, every, find. |
| Promise.try | Not implemented | Existing Promise/combinator support does not include this method. |
| Import attributes and JSON modules | Not implemented | Module linking/evaluation is unfinished. |
| RegExp.escape | Not implemented | RegExp family remains unfinished. |
| RegExp inline modifiers and duplicate named capture groups | Not implemented | No complete guest regular-expression engine. |
| Float16Array and DataView getFloat16/setFloat16 | Not implemented | Buffer and typed-array families remain unfinished. |

Implementation evidence: [Set fixtures](../experiments/quickjs-runtime/stdlib-conformance-cases.js), [numeric helpers](../experiments/quickjs-runtime/stdlib-numeric.js), [numeric fixtures](../experiments/quickjs-runtime/stdlib-numeric-cases.js), [Promise gaps](../experiments/quickjs-runtime/promise-combinators-notes.md). The full standard-library verification belongs to the earlier integration candidate; the latest wave reran the main regression plus Script/Array suites, not that complete aggregate.

## Broader JavaScript language and library

| Area | Status | Implemented / remaining |
|---|---|---|
| Number and primitive operations | Implemented subset | Software binary64, coercion, arithmetic, comparisons; finite resource limits and remaining formatting gaps. |
| BigInt and Symbol | Implemented subset | Guest operations and property/protocol integration; bounded BigInts and no public Symbol transfer. |
| Variables, control flow, functions | Implemented subset | Lexical bindings, closures, loops, calls, recursion, exceptions/finally; not all forms/context combinations certified. |
| Objects and classes | Implemented subset | Properties, accessors, descriptors, prototypes, constructors and class forms; intrinsic/derived newTarget, subclasses and exotic-object gaps remain. |
| Arrays | Implemented subset | Broad method coverage including flat, flatMap, splice, concat, sorting/copy methods; bounded heap/frame capacity and incomplete full conformance. |
| Strings | Implemented subset | UTF-16, extraction/search, case conversion and other helpers; 256-code-unit limit, normalization and RegExp integration remain. |
| JSON | Implemented subset | Parsing, revivers and stringification; this is separate from JSON modules. |
| Map and Set | Implemented subset | Basic collections, iteration, grouping and Set operations; subclass/object-model gaps. |
| Generators, iteration, promises, async | Implemented subset | GPU continuations and job queue; remaining protocol/constructor/host-integration gaps. |
| Script execution | Implemented subset | compileScript, completion values, fresh realm per lane; no persistent realm across runs. |
| Modules and dynamic import | Not implemented | Linking, live bindings, namespace objects, cycles, import.meta, top-level await. |
| eval and dynamic Function constructors | Not implemented for guest execution | Compile-only host service exists; live linking, scope and GPU handoff remain. |
| Proxy | Not implemented | Traps, invariants and revocation. |
| RegExp and Date | Not implemented | Full regex engine and date/time semantics. |
| Buffers, typed arrays, shared memory, Atomics | Not implemented | Includes agent/memory-model semantics. |
| Weak collections and finalization | Not implemented | WeakMap, WeakSet, WeakRef, FinalizationRegistry. |
| Complete built-ins and global functions | Incomplete | Includes Math.random, URI globals, nondecimal Number formatting, remaining descriptors/protocols. |

DOM, fetch/networking, and timers are host APIs. They are not available inside guest programs; normal webpage JavaScript can use them around GPU calls. Intl is a separate ECMA-402 surface and is outside this release's support claim.

## Operational limits and evidence

Apple M1 / Safari 26.4 is the verified target. Initial shader compilation took about 38.5 seconds in one latest-candidate sample. The new runtime requires WebGPU and never falls back to CPU for errors or unsupported programs. Current limits include 2,048 heap nodes, 32 frames, 256 UTF-16 units per string, 16 declared parameters, and 64 locals/captures per function. It is not a security sandbox.

The latest candidate passed 1,209 main programs, 36 Script programs and 49 Array-addition programs. Those are repository-suite results, not full Test262 conformance. See [exact verification scope](../experiments/bootstrap/evidence/quickjs-1_0-parallel-wave1.json), [all 20 release gaps](releases/v0.2.0-alpha.1.md), and [webpage usage](webpage-quickstart.md).
