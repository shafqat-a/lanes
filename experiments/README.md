# Lanes performance experiment

**Decision: develop the constrained JavaScript-to-WGSL compiler path next.** The bytecode interpreter remains a useful correctness reference and research implementation, but it loses to warmed-up native JavaScript across this experiment. Reusing buffers does not resolve its execution cost.

These are measurements of a synthetic, signed-i32 state-update workload on one Linux machine with Intel UHD (CML GT2) and RTX 2060 (NVK TU106) adapters, using Mesa 26.0.3 and Node 22.22.1. They do not establish speedups for general JavaScript, objects, closures, floating point, or unrelated workloads.

## Results

Medians in milliseconds. “Compiled incl. I/O” includes new input upload, execution, output readback, and decoding; it reuses the pipeline and buffers. “Fresh interpreter” uses the original API, including buffer allocation and cleanup. Setup/compilation is excluded from both timing columns and reported separately in the raw data.

| Adapter | Inputs | Loop iterations | Native JS | Fresh interpreter | Compiled incl. I/O | Native / compiled |
|---|---:|---:|---:|---:|---:|---:|
| RTX 2060 / NVK | 1,024 | 32 | 0.075 | 2.322 | 0.223 | 0.34× |
| RTX 2060 / NVK | 16,384 | 32 | 1.338 | 4.391 | 0.229 | 5.84× |
| RTX 2060 / NVK | 65,536 | 32 | 5.347 | 14.002 | 0.609 | 8.78× |
| RTX 2060 / NVK | 1,024 | 256 | 0.597 | 8.499 | 0.179 | 3.33× |
| RTX 2060 / NVK | 16,384 | 256 | 9.425 | 22.918 | 0.267 | 35.28× |
| RTX 2060 / NVK | 65,536 | 256 | 37.976 | 136.360 | 0.590 | 64.41× |
| Intel UHD | 1,024 | 32 | 0.070 | 6.055 | 0.246 | 0.29× |
| Intel UHD | 16,384 | 32 | 1.314 | 18.686 | 0.396 | 3.32× |
| Intel UHD | 65,536 | 32 | 5.207 | 64.061 | 1.399 | 3.72× |
| Intel UHD | 1,024 | 256 | 0.585 | 20.165 | 0.322 | 1.82× |
| Intel UHD | 16,384 | 256 | 9.493 | 204.253 | 1.744 | 5.44× |
| Intel UHD | 65,536 | 256 | 38.700 | 761.547 | 3.669 | 10.55× |

[RTX raw samples](../benchmarks/performance/nvidia.json) · [Intel raw samples](../benchmarks/performance/intel.json)

## Where the time goes

For the RTX's 65,536-input, 256-iteration case:

- Fresh interpreter end-to-end: **136.36 ms**.
- Prepared interpreter with inputs already resident, including readback: **136.26 ms**.
- Prepared interpreter compute pass, measured with GPU timestamps: **135.73 ms**.
- Generated WGSL with input upload and readback, reused allocations: **0.590 ms**.

The GPU is spending most of the interpreter's time executing the shader. Transfers and allocation are not the primary problem in this case. The experiment does not distinguish opcode-dispatch cost from private-array spilling or branch divergence; those would require further profiling.

Small batches still lose to native JavaScript. The next API should make batching explicit and eventually choose the CPU for work below an empirically established crossover point.

## Correctness finding on RTX / NVK

The initial generated shader retained a divergent `if` inside the loop. At 65,536 inputs and 256 iterations, it produced intermittent wrong values in **4 of 20 repeated runs**, affecting 27–30 lanes per failed run. This is not accepted benchmark output. [Failure evidence](../benchmarks/performance/nvidia-branched-failure.json).

Replacing a pure conditional integer assignment with an equivalent WGSL `select` passed **100 repeated runs** of that case. The final benchmark table uses this predicated version; every output readback in those benchmark runs matched the independent native implementation. [Repeated-run evidence](../benchmarks/performance/nvidia-predicated-check.json).

This narrows the failure to an execution path but does **not** prove a particular driver bug or rule out a problem in our harness or shader generation. The original failure remains unresolved. The predicated result is evidence for this workload, not a general correctness guarantee for NVIDIA hardware. The original branched shader also passed the Intel benchmark matrix, which is useful comparative evidence but not a stress-test guarantee.

## Reproduce

```sh
npm ci
npm test
LANES_ADAPTER='NVIDIA GeForce RTX 2060 (NVK TU106)' npm run test:gpu
LANES_ADAPTER='NVIDIA GeForce RTX 2060 (NVK TU106)' npm run test:experiment
LANES_ADAPTER='NVIDIA GeForce RTX 2060 (NVK TU106)' npm run bench:experiment
LANES_ADAPTER='Intel(R) UHD Graphics (CML GT2)' npm run bench:experiment

# 100 repeated largest-case checks. Nonzero exit if any output differs.
LANES_ADAPTER='NVIDIA GeForce RTX 2060 (NVK TU106)' node experiments/reproduce.js
LANES_ADAPTER='NVIDIA GeForce RTX 2060 (NVK TU106)' LANES_PREDICATE=1 node experiments/reproduce.js
```

Adapter selection uses the existing Dawn adapter filter. No driver changes or privileged configuration are required. Substitute the exact adapter name available on your machine. Benchmarks fail on mismatched output; the reproduction script records mismatch details.

## Method and limits

- The same source is compiled to bytecode and to WGSL. An independently written native function supplies expected values, with explicit i32 wrapping where needed.
- Native JS gets 20 warm-up batches and nine samples. Prepared GPU paths get five samples; fresh interpreter gets three. Raw samples are retained.
- GPU timestamps bracket the compute pass. Host submission/queue completion and output readback are measured separately. Timestamp extraction is outside reported execution totals.
- Timestamp values on this setup are coarse. A zero duration means below effective timing resolution, not free execution. Do not compute speedup from those zero values.
- Resident mode submits four identical dispatches over the same inputs without intermediate output readback. It is not four sequential simulation steps; outputs are not fed back as inputs. Wall time per dispatch includes amortized submission/completion overhead.
- Prepared `totalMs` excludes input upload. `uploadedTotalMs`, used in the table, includes input upload. Both exclude one-time allocation and pipeline creation. Upload-only setup timings include queue completion and are not pure DMA measurements.
- Fixed measurement order, one workload family, one machine, no controlled clock/power state, and no worker-pool or Wasm baseline. Intel samples in particular show variability. These measurements justify further compiler work, not broad marketing claims.
- The direct generator is experiment-only. It supports a smaller structured integer subset, rejects mutation inside expressions and `while`, and has no execution budget or general JS compatibility. Use only trusted, known-terminating inputs here.

## Next development step

Turn the generated-WGSL path into a small, explicitly typed numeric API with persistent batches and CPU fallback. Expand correctness tests across adapters before expanding language features. Keep binary64 semantics, arbitrary objects, closures, and a full JS engine as separate research questions.
