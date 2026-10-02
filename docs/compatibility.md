# v0.1 alpha compatibility contract

## Values

All arguments, locals, intermediate arithmetic, and results are signed 32-bit integers. Addition, subtraction, multiplication, and unary negation wrap modulo 2^32. Multiplication behaves like `Math.imul`, although calling `Math.imul` in input source is not supported. Comparisons and logical negation yield integer 0 or 1. Shift counts are masked to five bits; right shift is signed.

Examples: `2147483647 + 1` yields `-2147483648`; `!0` yields integer `1`. Ordinary JavaScript Number/Boolean behavior is not promised. APIs require `Int32Array`; any conversions performed while constructing that array occur before Lanes receives it.

## Syntax

| Supported | Contract |
|---|---|
| Named function declaration | Exactly one synchronous function, one identifier parameter |
| Source string or function object | A function object's source is parsed; captured variables are not imported |
| Integer literals | i32 range, including `-2147483648` |
| `let`, `const`, blocks | Initializers required; active-scope shadowing is rejected |
| `+ - * & \| ^ << >>` | Pure expressions with wrapping arithmetic |
| `< <= > >= === !==`, unary `- ~ !` | Integer results, no coercion |
| `= += -= *= &= \|= ^=` and `++ --` | Standalone statements only |
| `if` / `else` | Nested blocks supported; WGSL uses predicated assignments |
| Bounded `for` | Static start/bound, `<` or `<=`, own index incremented by `++` |
| `return` | Exactly one final top-level return expression; no early returns |

A supported loop looks like `for (let i = 0; i < 32; i++)`. Start and bound may be constant-foldable integer expressions. Named constants as loop bounds are not propagated in this release. Body assignments to an induction variable are rejected. The index is scoped to the loop and cannot wrap on its final increment.

Unsupported constructs include floating point, division/remainder, unsigned right shift, strings, Boolean literals, arrays/objects, destructuring, closures, external identifiers, calls, recursion, promises, async/generators, `while`, `break`/`continue`, ternaries, short-circuit operators, and mutation inside expressions. These fail at compile time on both backends. No automatic translation to unrestricted host JavaScript occurs.

## Limits

- Source: 32,768 UTF-8 bytes.
- Lowering budget: 4,096 visited nodes and 256 local slots.
- Per-loop trip count: at most 4,096.
- Static work estimate: at most 100,000 visited operations after loop multipliers. Both branches contribute to this bound.
- Batch: at most 16,777,216 inputs, further limited by the GPU's buffer and dispatch limits. Oversized GPU batches require explicit splitting or CPU selection.

These are resource bounds for an experimental numeric library, not a security certification. Source parsing occurs on the host. Use trusted workloads in the alpha.

## GPU correctness status

Validated with Node/Dawn on physical Intel UHD (CML GT2, i915/Mesa), RTX 2060 (NVK TU106, nouveau/Mesa), and Apple M1 (Metal, macOS 26.4), and with Chromium's software WebGPU backend. Tests cover integer edge cases, nested control flow, randomized arithmetic expressions, pipeline sharing, resident chaining, and device loss. A 65,536-input/256-iteration regression passed 100 repetitions on each physical adapter. The M1 run used Node 24.4.1 at commit `64cc2fd8b5dc28592db0c47db757a3d54a6eb108`; all 31 CPU and 31 GPU tests passed, as did TypeScript checking and the browser build. The agent-field demo also passed real Safari 26.4 WebGPU checks on the M1 at 1,024, 16,384, and 65,536 agents, including edited source, native result selection, playback, and reset. This is a demo smoke test, not the complete Node differential suite running inside Safari. See [browser evidence](../benchmarks/alpha/safari-m1-demo.json).

The earlier divergent branched shader intermittently returned incorrect results on RTX/NVK. Its root cause is unresolved. The current emitter evaluates pure branches with masks/selects and uniform static loops, avoiding that path; its passing tests do not establish universal GPU correctness. Test on your target browser, driver, and hardware. No ECMAScript/Test262 conformance claim is made.

## TypeScript

Declarations reference WebGPU DOM types. Use a TypeScript version whose DOM library includes WebGPU (validated with TypeScript 7), or supply compatible WebGPU types in your application when using an older compiler. Do not load duplicate WebGPU global declarations alongside a DOM library that already provides them.
