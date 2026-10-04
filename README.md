# Lanes

**JavaScript → WGSL, compiled when you need it.**

Lanes runs an expanding subset of JavaScript on WebGPU. The experimental full-engine runtime uses QuickJS to compile source on CPU and executes guest bytecode through WGSL on GPU. Apple M1 / Safari is the verified target. **Full ECMAScript 2025 support is not implemented yet.**

**[v0.2.0-alpha.1 prerelease](https://github.com/shafqat-a/lanes/releases/tag/v0.2.0-alpha.1)** · [ECMAScript 2025 support table](docs/ecmascript-2025.md) · [Use from a webpage, with examples](docs/webpage-quickstart.md) · [Not yet implemented](docs/releases/v0.2.0-alpha.1.md#not-yet-implemented-or-incomplete)

The runtime implements subsets of objects, closures, classes, exceptions, software double-precision arithmetic, strings, BigInt, Symbols, collections, generators, promises, async functions, and standard-library operations. Fresh-realm Script execution and Array.flat/flatMap/splice are GPU-verified. Persistent realms, modules, eval/Function execution, Proxy, RegExp, Date, buffers/typed arrays, weak collections, and other gaps remain. The new runtime requires WebGPU; unsupported work never triggers CPU replay.

The latest M1 candidate passed 1,209 main-suite programs plus focused Script and Array suites. Earlier full standard-library/Promise results apply to an earlier candidate. See the [exact verification scope](experiments/bootstrap/evidence/quickjs-1_0-parallel-wave1.json); these are not full-language conformance results.

## Use JavaScript on the GPU from a webpage

Download the **webpage kit** from the prerelease, extract it, run `python3 -m http.server 4178 --bind 127.0.0.1`, then open `http://localhost:4178/web-example.html` in Safari on M1. The kit provides `lanes-quickjs.js`, `compiler.wasm`, and runnable HTML. Initial shader compilation can take around 40 seconds or longer.

```js
import { createCompiler, QuickJSGPU } from './lanes-quickjs.js';
const compiler = await createCompiler();
const vm = await QuickJSGPU.create();
try {
  const program = compiler.compile('function twice(x) { return x * 2; }');
  const result = await vm.run(program, [1, 2, 3], { budget: 4096 });
  console.log(result.values); // [2, 4, 6]
} finally {
  await vm.dispose();
}
```

Serve over localhost or HTTPS. DOM/networking remain in normal page JavaScript; guest source runs on the GPU. See the [complete HTML example, Script API, build and deployment instructions](docs/webpage-quickstart.md).

## Existing numeric JIT and VM demos

The original numeric JIT is a separate API with explicit wrapping signed 32-bit arithmetic and a restricted JavaScript subset. The npm-format package exports this JIT and the older experimental VM, **not the newer QuickJS/WGSL runtime**. Their compatibility contracts and performance claims are separate.

[Agent field demo](https://shafqat-a.github.io/lanes/simulation.html) · [Numeric playground](https://shafqat-a.github.io/lanes/) · [Numeric compatibility](docs/compatibility.md) · [API](docs/api.md) · [Benchmarks](docs/performance.md) · [Older GPU VM lab](docs/gpu-vm.md)

## Try it

Clone and run locally (Node.js 22+):

```sh
git clone https://github.com/shafqat-a/lanes.git
cd lanes
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`. The playground runs locally in your browser and shows source, generated WGSL, timings, and correctness checks. Its CPU comparison is the Lanes fallback, not native JavaScript; the standalone benchmark supplies native/worker baselines.

The [agent field](https://shafqat-a.github.io/lanes/simulation.html) animates up to 65,536 independent agents with an editable steering function, adjustable computation, and native JavaScript/GPU result selection. Every GPU step is checked against native execution before drawing. Timings separate native compute, GPU upload/execution/readback, and canvas drawing; playback includes both execution paths and verification. The demo generates native JS from validated IR in a worker (using `new Function` there); the library's CPU fallback remains eval-free. Edited-code comparisons share the compiler frontend and are not independent proof of correctness.

Safari smoke tests can run on a Mac with Safari remote automation enabled: start `safaridriver -p 4445` and `npm run dev` in separate terminals, then run `npm run test:safari`. This exercises the real Safari WebGPU path, all three agent counts, edits, playback, and reset. Override `LANES_WEBDRIVER_URL` or `LANES_DEMO_URL` to test another driver endpoint or the deployed site.

The installable tarball is attached to the [GitHub alpha release](https://github.com/shafqat-a/lanes/releases/tag/v0.2.0-alpha.1). npm registry publication is pending maintainer authentication. After downloading the release asset:

```sh
npm install ./lanes-webgpu-0.2.0-alpha.1.tgz
```

## Use the JIT

```js
import { Lanes } from 'lanes-webgpu';

const lanes = await Lanes.create({ backend: 'auto' });
const transform = lanes.compile(
  function transform(x) {
    return (x ^ (x << 3)) + 1;
  },
  { numericMode: 'i32' }
);

const output = await transform.run(new Int32Array([1, 2, 3, 4]));
console.log(output); // Int32Array [10, 19, 28, 37]
await lanes.dispose();
```

`auto` selects GPU when available and CPU otherwise. It does not predict which backend is faster for a batch. Use `backend: 'cpu'` or `'gpu'` for explicit control. In Node, pass a `GPUDevice` from a WebGPU implementation; the package does not implicitly load a native GPU binding.

## Keep data on the GPU

```js
const batch = await lanes.batch(new Int32Array([1, 2, 3]));
try {
  await batch.run(firstKernel);
  await batch.run(secondKernel); // consumes firstKernel's output; no readback
  const output = await batch.read();
} finally {
  await batch.dispose();
}
```

Batches reuse two GPU buffers and a readback buffer. Calls on one batch are ordered. A GPU `batch.run()` resolves after submission; `read()` waits for the result. Dispose batches and runtimes explicitly. User-supplied devices remain owned by the caller.

## What is implemented

- Source validation, lexical scope checks, explicit i32 typed IR, constant folding, and source-located errors.
- Pure integer expressions, assignment statements, `if`/`else`, bounded `for` loops, and a final return.
- Predicated WGSL conditionals; validated static loop bounds.
- Lazy compilation with cached/in-flight pipeline reuse per runtime/device.
- Persistent batches, resident kernel chaining, CPU fallback, and device-loss handling.
- TypeScript declarations, a self-contained browser bundle, and a browser playground.

## Measurements

On the tested RTX 2060/NVK setup, warm end-to-end runs at 65,536 inputs were approximately **17–44× faster than native JavaScript** across three numeric workload models. That timing includes fresh batch buffers, upload, execution, readback, and cleanup, with the pipeline cached. Small batches often lose. See [raw data, worker comparisons, and limitations](docs/performance.md); these are not general JavaScript speedup claims.

A previous branched shader produced intermittent wrong output on RTX/NVK. This compiler uses predicated assignments and uniform bounded loops; cross-adapter tests and the repeated regression pass. The original failure's root cause remains unresolved and its [reproducer is preserved](experiments/README.md).

## Development

For parallel coding work through signed-in Claude Code and Grok Build subscriptions,
see the [external agent runner and MCP server](tools/external-agents/README.md).


```sh
npm test                 # compiler, CPU semantics, fallback, lifecycle
npm run test:types
npm run test:gpu         # requires a WebGPU adapter; fails if none exists
npx playwright install chromium
npm run test:browser     # browser GPU and unavailable-GPU paths
npm run bench:jit        # native JS / persistent workers / GPU
npm pack                # builds the browser bundle and alpha tarball
```

For Dawn adapter selection and hardware stress testing:

```sh
LANES_ADAPTER='NVIDIA GeForce RTX 2060 (NVK TU106)' LANES_STRESS=1 npm run test:gpu
LANES_ADAPTER='Intel(R) UHD Graphics (CML GT2)' npm run bench:jit
```

The original bytecode `compile`, `runCPU`, and `createGPU` exports remain for research and have a different supported subset. New integrations should use `Lanes`.

MIT licensed. See [LICENSE](LICENSE).
