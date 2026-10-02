# Experimental JavaScript GPU VM

The target is ECMAScript 2025 guest execution on Apple M1 through Safari/WebGPU/WGSL. The current implementation supports functions, closures, exceptions, software binary64 arithmetic, and basic strings. It is **not a full ECMAScript engine or a 1.0 release**. The existing restricted i32 JIT remains a separate API.

## Execution boundary

The CPU parses source with Acorn and produces bytecode. A WGSL interpreter executes guest instructions on GPU. Each independent input has persistent registers, call frames, lexical environments, exception handlers, and heap storage. Execution can suspend between instructions and resume in another dispatch, including inside nested calls. Only status, counters, and the result snapshot are read back; registers and heap remain on GPU.

Software binary64 uses pairs of u32 words, integer arithmetic, and round-to-nearest ties-to-even. No f32 approximation or host arithmetic implements GPU Number instructions. NaN payloads are canonicalized by arithmetic.

With `backend: 'auto'`, an absent WebGPU API or a null adapter selects the CPU interpreter for the entire job. GPU compilation errors, unsupported features, allocation errors, and device loss fail the job without CPU replay. Explicit `backend: 'cpu'` is available for testing and deliberate selection. The CPU interpreter supports the same subset; it is not yet a full-JavaScript fallback engine either.

Neither VM interpreter uses eval or new Function. Native JavaScript execution in the conformance harness is an independent test oracle, not a fallback path.

## Implemented language

| Area | Current support |
|---|---|
| Values | Number, Boolean, null, undefined, basic UTF-16 strings; internal function and opaque error values |
| Number operations | `+ - * / %`, unary `+ -`, overflow, gradual underflow, NaN, infinities, signed zero |
| Comparisons | Relational, strict equality, and loose equality for the supported coercions |
| Bitwise | `& \| ^ ~ << >> >>>` with Number conversion and masked shift counts |
| Expressions | Conditional, logical, nullish, sequence, void, assignment/update, compound and logical assignment |
| Control flow | if/else, for, while, do/while, switch/fallthrough, unlabelled break/continue, return |
| Bindings | let/const, lexical blocks, shadowing, temporal dead zones, per-iteration closure bindings |
| Functions | Nested declarations, expressions, arrows, hoisting, recursion, higher-order calls, mutable closures, function.length |
| Exceptions | throw/catch/finally, unwinding across calls, completion overrides, catchable invalid-call, const-assignment, and temporal-dead-zone errors |
| Strings | Host inputs/outputs, literals, string-to-string concatenation/comparison, length, indexing, charAt, charCodeAt, UTF-16 code units including lone surrogates |
| Heap | GPU allocation and tracing collection for lexical environments, closure references, and dynamic strings |

The source entry point is one synchronous named function with exactly one identifier parameter. Nested functions accept up to 16 simple parameters/arguments. Missing arguments are undefined; extra arguments are evaluated. Named function-expression self-bindings respect strict versus non-strict assignment behavior. General `this` and `arguments` semantics are not available.

String support is deliberately limited: mixed string/number conversion and concatenation are unsupported. Property access covers the implemented length and string-index operations; it is not a general property model. Implicit TypeError/ReferenceError values can be caught and rethrown, but their properties and constructors are not implemented. Functions and opaque errors cannot be returned across the host boundary.

Not implemented: general objects, arrays, descriptors/prototypes, classes, destructuring, default/rest parameters, var, labelled statements, BigInt, symbols, exponentiation, typeof/delete/in/instanceof, generators, modules, eval/Function, promises/async, most standard library methods, and host APIs such as DOM/network access. Unsupported syntax fails compilation; unsupported runtime operations fail execution. Parsing an ES2025 grammar does not establish ES2025 execution support.

## API (main checkout only)

The experimental export is not included in the previously published alpha tarball and is not API-stable.

```js
import { JavaScriptVM } from 'lanes-webgpu/experimental/vm';

const vm = await JavaScriptVM.create();
try {
  const program = vm.compile(`function f(x) {
    function counter() { return x += 0.1; }
    for (let i = 0; i < 3; i++) counter();
    return x;
  }`);
  const result = await vm.run(program, [0, 1, 2]);
  console.log(result.backend, result.values, result.collections);
} finally {
  await vm.dispose();
}
```

`run()` defaults to 256 instructions per dispatch and at most 1,024 dispatches. It returns `{backend, values, statuses, steps, collections, done}` after every instance completes. An execution limit throws without exposing partial values. AbortSignal cancellation is checked between dispatches; an already submitted dispatch cannot be cancelled midway.

For explicit resumption, use `const job = await vm.start(program, inputs)`, call `await job.step(budget)` repeatedly, and finally `await job.dispose()`. Status 0 means running with an undefined placeholder; status 1 means completed, possibly with an actual undefined result. Completed lanes are not re-executed. Calls on one job are serialized; jobs have separate storage. Runtime disposal releases its jobs and destroys only an internally acquired device.

Resource limits, unsupported operations, cancellation, and device loss are host failures, not guest exceptions; guest finally blocks are not guaranteed to execute after these failures.

## Memory and limits

Each function has 128 registers including temporaries. Programs involving calls use up to 32 total call frames, 256 environment records, and 2,048 heap cells per instance. Simpler programs use smaller pools. Strings are limited to 256 UTF-16 code units, including input and concatenated strings. There are at most 32 active exception handlers per instance.

The GPU collector traces active registers, call frames, handlers, results, environment parents, and function/string references. It reclaims unreachable environment records and compacts live cells while keeping environment identifiers stable. Collection runs when allocation exhausts a pool; a still-full pool terminates that instance with a resource error. This supports escaped closures, cycles, and strings surviving dispatch boundaries, but is not a general object heap yet.

Other limits: 32,768 source characters, 4,096 AST nodes, AST depth 128, 4,096 independent inputs, and at most 4,096 instructions per dispatch. GPU device limits also apply. Snapshots reserve 1,056 bytes per instance, including space for a maximum-length string result. This experimental runtime is not a security sandbox.

## Validation and public samples

The shared suite runs **328 programs and checks 110,254 results** against native JavaScript or explicit upstream expected values. Numeric checks use Object.is to distinguish signed zero and recognize NaN. Coverage includes seeded random binary64 patterns, rounding boundaries, remainder, coercion, evaluation order, control flow, recursion, escaping/mutable closures, per-iteration bindings, exceptions and finally overrides, UTF-16 strings, and collection under allocation pressure. Small instruction budgets force suspension inside calls and handlers. Separate tests exercise resource limits, cancellation, concurrent jobs, device loss, and whole-job CPU selection.

Eight numeric addition tests from [Test262](https://github.com/tc39/test262/tree/7ab7fafa0003f73fc85c1b95d88094d33f7eb8bd/test/language/expressions/addition) are pinned under `test/fixtures/test262`. Their 44 pure failure predicates are adapted into functions, with Number constants substituted and isNaN on pure expressions represented as self-inequality. Harness assertions remain on the CPU. These are **adapted numeric checks, not unmodified full Test262 execution**. Original files, BSD license, revision, and generator are checked in. Regenerate with `node scripts/generate-vm-test262.js`.

Validated on M1 with Node/Dawn/Metal and Safari 26.4, plus local software WebGPU/Chromium. [Safari report](../benchmarks/vm/safari-m1.json). NVIDIA is outside this VM's current target; the older i32 shader investigation remains separate.

```sh
npm test
npm run test:types
npm run test:gpu
npm run test:browser
# On M1, with safaridriver -p 4445 and npm run dev running:
npm run test:safari:vm
LANES_BACKEND=metal node scripts/bench-vm.js
```

## Performance

The [M1 measurements](../benchmarks/vm/m1-benchmark.json) compare a small 32-iteration multiply/add workload with native JavaScript. The GPU VM is slower on this workload. Measurements include allocations, transfers, software binary64 interpretation, result/status readback, event-loop yields between dispatches, and cleanup. Registers and heap are no longer read back. Five warm samples on one host do not establish general performance; the numeric JIT's earlier speedups do not transfer to this runtime.

## Remaining path to ECMAScript 2025

1. General heap objects and arrays, property descriptors, prototypes, and full primitive conversion/string semantics.
2. Complete function/declaration semantics, this/arguments, destructuring, classes, and iterators.
3. Standard built-ins, BigInt, symbols, regular expressions, proxies, typed arrays, and shared-memory requirements.
4. Modules, generators, promises, microtasks, async functions, and a CPU compilation request protocol for dynamic code. Guest execution remains on GPU.
5. Applicable full ES2025 conformance tests with an explicit host contract, real workloads, memory stress tests, and stable APIs before considering 1.0.

Public workloads such as Acorn from the Web Tooling Benchmark remain future integration targets; this VM cannot execute them yet. There is no claim that general JavaScript will run faster on GPU.
