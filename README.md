# Lanes

**An experimental JavaScript bytecode interpreter on WebGPU.**

Lanes explores running many independent instances of one JavaScript program on a GPU. The CPU compiles source once; each GPU invocation interprets shared bytecode with its own registers and program counter.

**Status: research prototype.** The first milestone implements an explicitly opt-in, signed 32-bit integer mode. It is not a complete JavaScript engine, does not preserve general JavaScript Number semantics, and makes no general GPU speedup claim.

## Run it

Requires Node.js 22+ for the scripts. GPU checks require a WebGPU adapter through Dawn's `webgpu` package (a software adapter works for correctness).

```sh
npm ci
npm test
npm run test:gpu
npm run bench
```

`test:gpu` fails if no adapter is available; it does not silently skip. The benchmark prints adapter details and writes `results/latest.json`. The core modules accept a browser `GPUDevice` too, but browser integration has not yet been tested. Nothing has been published to npm.

```js
import { compile, runCPU, createGPU, STATUS } from './src/index.js';

const program = compile(`
  function step(x) {
    let result = x;
    for (let i = 0; i < 10; i++) {
      result = result ^ (result << 3);
    }
    return result;
  }
`, { numericMode: 'i32' });

const inputs = new Int32Array([1, 2, 3, 4]);
const reference = runCPU(program, inputs);

// Supply a GPUDevice from a browser or Dawn. Caller owns its lifetime.
const runtime = await createGPU(device);
const { values, statuses } = await runtime.run(program, inputs, { budget: 10000 });
// A value is valid only when its status is STATUS.DONE.
```

## Supported today

- One synchronous function declaration with one integer parameter and an integer result.
- Integer literals, initialized `let`/`const`, blocks, `if`/`else`, `for`, `while`, and `return`.
- `+`, `-`, `*`, signed comparisons, `===`, `!==`, `&`, `|`, `^`, `<<`, `>>`, unary `-`, `~`, `!`.
- `=`, `+=`, `-=`, `*=`, prefix/postfix `++` and `--`.
- CPU reference execution and a WGSL interpreter with independent state per input.
- Instruction budgets and explicit completion, budget-exhaustion, or invalid-execution statuses.

All arithmetic wraps to signed 32 bits; multiplication keeps the low 32 bits (like `Math.imul`). Comparisons and `!` produce integer 0 or 1. This intentionally differs from JavaScript's Number and Boolean semantics. For example, `2147483647 + 1` becomes `-2147483648` in this mode. Division, unsigned shifts, floating-point literals, implicit conversions, strings, objects, arrays, calls, closures, async functions, DOM APIs, and `eval` are unsupported. Unsupported constructs fail compilation.

There are at most 128 virtual registers per program. Each lexical declaration needs an initializer; shadowing is rejected. A path reaching the end without returning is invalid. Budgets count bytecode instructions per invocation, not milliseconds; exhausted tasks do not yet support resumption. This runtime is not an audited sandbox for hostile programs.

## Architecture

```text
Source → Acorn parser → subset compiler → immutable bytecode
                                              ├── CPU reference interpreter
                                              └── WGSL interpreter
                                                  one invocation per input
                                                  private registers + PC
                                                  result + status buffers
```

Bytecode uses four 32-bit words per instruction: opcode, destination, operand A, operand B. Branch operands address instructions; constants encode signed integer bits. The shader is compiled once per runtime. Initial runs allocate and upload fresh buffers, execute, read back, and release resources. No guest code is passed to host `eval`.

## Measurement

`npm run bench` compares warmed-up native JavaScript, the CPU bytecode interpreter, and WebGPU on a synthetic integer state-update workload at 64, 1,024, and 16,384 inputs. Every measured result is checked against an independent native implementation. Five repetitions are summarized by the median.

GPU totals include buffer allocation, uploads, dispatch, readback, output decoding, and cleanup. Source compilation and pipeline creation are reported separately. These totals are **not kernel-only timings**. Native JavaScript gets explicit warm-up; no worker-pool or Wasm baseline exists yet.

Initial validation used Mesa llvmpipe, a **software adapter**. This proves the shader executes through WebGPU, not that Lanes is faster on physical GPUs. See [the recorded baseline](benchmarks/initial-software.json).

## Performance experiment

The follow-up experiment compares interpreter execution with direct WGSL generation on Intel UHD and RTX 2060 hardware. It separates GPU timestamps from host overhead and measures persistent buffers with and without new input uploads. See [results and limitations](experiments/README.md).

```sh
npm run test:experiment
LANES_ADAPTER='NVIDIA GeForce RTX 2060 (NVK TU106)' npm run bench:experiment
```

The direct compiler is an experiment under `experiments/`, with a smaller supported subset than the interpreter. It does not yet replace the public runtime. A branched shader showed intermittent incorrect results on the RTX/NVK configuration; the report includes a reproducer and the checked branch-free alternative.

## Next milestones

1. Measure on physical GPUs and browsers, add worker-pool/Wasm baselines, and sweep divergence and batch size.
2. Benchmark software binary64 arithmetic before choosing a Number compatibility strategy.
3. Add resumable instruction slices and persistent GPU buffers.
4. Add function frames, tagged values, objects, and closures with differential correctness tests.
5. Publish an explicit compatibility matrix and selected Test262 results.
6. Investigate specialization to WGSL only after interpreter measurements identify worthwhile workloads.

## Research foundations

- [GVM / tinyBee](https://users.ece.utexas.edu/~gligoric/papers/CelikETAL19GVM.pdf): batched GPU bytecode interpreters and the importance of memory layout and divergence.
- [LateralJS](https://www.slideshare.net/slideshow/javascript-on-the-gpu/12292189): historical JavaScript-on-GPU experiment, including poor performance from an early AST interpreter.
- [WGSL](https://www.w3.org/TR/WGSL/) and [WebGPU](https://gpuweb.github.io/gpuweb/): execution model and API constraints.
- [ECMAScript Number](https://tc39.es/ecma262/2022/#sec-ecmascript-language-types-number-type): binary64 semantics the integer prototype does not implement.
- [QuickJS](https://bellard.org/quickjs/quickjs.html): reference engine; its bytecode is version-specific. Lanes does not use QuickJS bytecode.
- [Test262](https://github.com/tc39/test262): future conformance testing; no conformance claim yet.

## License

MIT. See [LICENSE](LICENSE).
