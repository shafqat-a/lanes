# Lanes

**JavaScript → WGSL, compiled when you need it.**

Lanes is an experimental numeric JIT for applying one function to many independent inputs. It validates a restricted JavaScript subset, lowers it to typed integer IR, generates WGSL, and caches the GPU pipeline. A CPU backend implements the same integer semantics without `eval`.

**v0.1.0-alpha.1** · [Playground](https://shafqat-a.github.io/lanes/) · [Compatibility](docs/compatibility.md) · [API](docs/api.md) · [Benchmarks](docs/performance.md)

The alpha uses **explicit wrapping signed 32-bit arithmetic**, not general JavaScript `Number` semantics. Objects, closures, floating point, arbitrary function calls, and browser APIs are outside its supported language. Check the compatibility contract before adopting it.

## Try it

Clone and run locally (Node.js 22+):

```sh
git clone https://github.com/shafqat-a/lanes.git
cd lanes
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`. The playground runs locally in your browser and shows source, generated WGSL, timings, and correctness checks. Its CPU comparison is the Lanes fallback, not native JavaScript; the standalone benchmark supplies native/worker baselines.

The installable tarball is attached to the [GitHub alpha release](https://github.com/shafqat-a/lanes/releases/tag/v0.1.0-alpha.1). npm registry publication is pending maintainer authentication. After downloading the release asset:

```sh
npm install ./lanes-webgpu-0.1.0-alpha.1.tgz
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
