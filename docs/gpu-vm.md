# Experimental JavaScript GPU VM

The long-term target is ECMAScript 2025 guest execution on Apple M1 through Safari/WebGPU/WGSL. This implementation is the **primitive-value and Number feasibility stage**, not a full ECMAScript engine or a 1.0 release. The existing restricted i32 JIT remains a separate API.

## Execution boundary

The CPU parses source with Acorn and produces bytecode. A WGSL interpreter executes guest instructions on GPU. Each independent input has a program counter, status, result, instruction counter, and 128 tagged value registers in GPU storage. Registers and program counters survive dispatch boundaries. Software binary64 uses pairs of u32 words, integer arithmetic, and round-to-nearest ties-to-even; no f32 approximation or host arithmetic implements GPU Number instructions.

With `backend: 'auto'`, an absent WebGPU API or a null adapter selects the CPU interpreter for the entire job. GPU compilation errors, unsupported language features, allocation errors, and device loss do not trigger CPU execution. Once a GPU runtime is selected, device loss fails the job and does not replay it. A new runtime may be created afterward. Explicit `backend: 'cpu'` is available for testing and deliberate selection. The current CPU interpreter supports the same subset; it is not yet a full-JavaScript fallback engine either.

Neither VM interpreter uses eval or new Function. The conformance harness uses native JavaScript execution as an independent oracle; that host execution is test infrastructure, not a fallback path.

## Implemented language

| Area | Current support |
|---|---|
| Values | Number, Boolean, null, undefined; primitive inputs and outputs |
| Number operations | `+ - * /`, unary `+ -`, overflow, gradual underflow, NaN, infinities, signed zero |
| Comparisons | `< <= > >= === !==`, preserving Boolean result tags |
| Bitwise | `& \| ^ ~ << >> >>>` with Number conversion and masked shift counts |
| Control flow | if/else, for, while, early return, fallthrough to undefined |
| Locals | Initialized let/const, lexical blocks, standalone or expression assignment/update |
| Assignment | `= += -= *= /=`, prefix/postfix increment/decrement |
| Function boundary | One synchronous named function with exactly one identifier parameter |

NaN payloads are canonicalized by arithmetic; only JavaScript-observable primitive numeric behavior is currently promised. CPU compilation converts source literals into binary64 constants. Registers hold the original primitive tag together with its numeric conversion, allowing Boolean/null/undefined coercion without a host call.

Not implemented: strings, objects, arrays, property access, function calls, recursion, closures, a heap or garbage collector, exceptions, BigInt, symbols, generators, modules, eval/Function, promises/async, standard library methods, remainder/exponentiation, loose equality, logical/conditional expressions, break/continue, var, uninitialized declarations, and local shadowing. These constructs fail compilation. Parsing with an ES2025 grammar is not ES2025 execution support. Host APIs such as DOM and network access are not available.

## API (main checkout only)

The experimental export is not included in the previously published alpha tarball and is not API-stable.

```js
import { JavaScriptVM } from 'lanes-webgpu/experimental/vm';

const vm = await JavaScriptVM.create();
try {
  const program = vm.compile(`function f(x) {
    for (let i = 0; i < 10; i++) { x += 0.1; }
    return x;
  }`);
  const result = await vm.run(program, [0, 1, null, undefined]);
  console.log(result.backend, result.values);
} finally {
  await vm.dispose();
}
```

`run()` uses a default budget of 256 instructions per dispatch and at most 1,024 dispatches. It returns `{backend, values, statuses, steps, done}` only after every instance completes. An execution limit throws without exposing partial values. `AbortSignal` cancellation is checked between dispatches. A dispatch already submitted cannot be cancelled midway.

For explicit resumption, use `const job = await vm.start(program, inputs)`, call `await job.step(budget)` repeatedly, and finally `await job.dispose()`. A running lane has status 0 and an undefined placeholder; a completed lane has status 1 and may itself have returned undefined. Check the status to distinguish those cases. Completed lanes are not re-executed. Calls on one job are serialized; jobs have separate storage. Runtime disposal releases its jobs and destroys only an internally acquired device.

Limits: 32,768 source characters, 4,096 AST nodes, AST depth 128, 128 allocated registers (including temporaries), 4,096 independent inputs, and at most 4,096 guest instructions per dispatch. GPU device limits also apply. The interpreter has a finite per-instruction cost for the implemented primitives; future host operations and heap algorithms need their own bounded execution design. This is not a security sandbox.

## Validation and public samples

The shared suite runs 216 programs and checks 90,836 results with Object.is against native JavaScript or explicit upstream expected values. It covers random binary64 bit patterns from a fixed seed, exceptional values, rounding boundaries, arithmetic, coercion, evaluation order, and control flow. GPU lifecycle tests separately exercise resumption and failure on device loss. Browser tests cover cancellation and no-GPU selection.

Eight numeric addition tests from [Test262](https://github.com/tc39/test262/tree/7ab7fafa0003f73fc85c1b95d88094d33f7eb8bd/test/language/expressions/addition) are pinned under `test/fixtures/test262`. Their 44 pure failure predicates are adapted into functions, with Number constants substituted and isNaN on pure expressions represented as self-inequality. Harness assertions remain on the CPU. These are **adapted numeric checks, not unmodified full Test262 execution**. The original files, BSD license, source revision, and generator are checked in. Regenerate with `node scripts/generate-vm-test262.js`.

Validated on M1 with Node/Dawn/Metal and Safari 26.4, plus local software WebGPU/Chromium. [Safari report](../benchmarks/vm/safari-m1.json). NVIDIA is outside this VM's current target; the older i32 shader investigation remains separate.

```sh
npm test
npm run test:gpu
npm run test:browser
# On the M1, with safaridriver -p 4445 and npm run dev running:
npm run test:safari:vm
# Benchmark the prototype on Metal:
LANES_BACKEND=metal node scripts/bench-vm.js
```

## Performance finding

On the M1, the initial 32-iteration multiply/add workload at 1,024 instances took a warm median of **7.61 ms on the GPU VM versus 0.043 ms in native JS**. One instance took approximately 5.78 ms on GPU. The first GPU call included roughly 15 ms total latency including pipeline compilation. These are one-host, five-sample measurements, not stable general estimates. [Raw measurements](../benchmarks/vm/m1-benchmark.json).

The VM currently reads back all register state after every dispatch, and `run()` yields to the host event loop between dispatches. Software binary64 and register interpretation add further costs. The measurement establishes feasibility and the cost of this implementation; it is not an isolated GPU arithmetic benchmark. The numeric JIT's earlier speedups do not transfer to this runtime.

## Remaining path to ECMAScript 2025

1. Add call frames, functions, recursion, lexical environments, and closures; test suspension across calls.
2. Add GPU heap allocation and garbage collection, strings, arrays, objects, descriptors, and prototypes.
3. Add exception completion records and try/catch/finally, then class and iterator semantics.
4. Implement built-ins, BigInt, symbols, regular expressions, proxies, typed arrays, and shared-memory requirements.
5. Add modules, generators, promises, microtasks, async functions, and the CPU compilation request protocol for dynamic code. Guest execution remains on GPU.
6. Expand to the applicable full ES2025 conformance suite with an explicit host contract, real workloads, memory stress tests, and stable APIs before considering 1.0.

Each step is substantial. Larger public workloads such as Acorn from the Web Tooling Benchmark remain future integration targets: this VM cannot execute them yet. There is no promised 1.0 delivery date or claim that general JavaScript will run faster on GPU.
