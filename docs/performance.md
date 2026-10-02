# Alpha performance validation

The v0.1 API was tested on three numeric workload models: a 256-step simulation update, a 64-round integer hash, and 128-rule scoring. These are reproducible computational models, not production application traces.

The table below uses 65,536 independent inputs. Times are warm medians in milliseconds. GPU totals include transient allocation, input upload, execution, readback, decoding, and cleanup; the pipeline is cached. Workers use a persistent four-worker pool, including input copies/transfers, messaging, and output assembly.

| Workload | Native JS (RTX run) | Four workers | RTX 2060 | RTX / native speedup | Intel UHD | Intel / native speedup |
|---|---:|---:|---:|---:|---:|---:|
| Simulation | 32.53 | 8.88 | 0.736 | 44.2× | 4.17 | 7.84× |
| Integer hash | 10.51 | 3.11 | 0.608 | 17.3× | 1.94 | 5.34× |
| Rule evaluation | 10.27 | 2.94 | 0.514 | 20.0× | 2.86 | 3.60× |

Intel ratios use its separately measured native baseline. The RTX speedups over four workers at this size were approximately 12.1×, 5.1×, and 5.7× respectively. Intel's rule workload only slightly beat the four-worker pool (3.12 ms vs 2.86 ms).

**Small batches often lose.** At 1,024 inputs, RTX hash and rule evaluation were approximately 2.2× slower than native JavaScript. On Intel, all three 1,024-input cases lost. The `auto` backend does not use these narrow measurements as a universal routing threshold.

## Raw data and reproduction

- [RTX measurements](https://github.com/shafqat-a/lanes/blob/main/benchmarks/alpha/nvidia.json)
- [Intel measurements](https://github.com/shafqat-a/lanes/blob/main/benchmarks/alpha/intel.json)
- [Workloads and independent native implementations](https://github.com/shafqat-a/lanes/blob/main/scripts/workloads.js)

```sh
LANES_ADAPTER='NVIDIA GeForce RTX 2060 (NVK TU106)' npm run bench:jit
LANES_ADAPTER='Intel(R) UHD Graphics (CML GT2)' npm run bench:jit
```

The benchmark retains every timing sample. It warms native JS with 20 batches and workers with three batches, then takes five samples per warm path. It records source-lowering time and the first GPU call (including pipeline creation when uncached) separately. Later sizes reuse the same workload pipeline. First-run costs can dominate small tasks.

Resident dispatch timing includes command submission and queue completion, with inputs uploaded before timing and readback after timing. That measurement does not include transfers. The main table uses the end-to-end transient API instead. Every returned output in every accepted sample is compared with independently written native code using matching wrapping arithmetic.

The earlier [interpreter experiment](https://github.com/shafqat-a/lanes/blob/main/experiments/README.md) isolates GPU execution with timestamps and explains the compiler pivot. Its runtime, allocations, and source generation differ from the alpha; do not mix its numbers with these measurements.

## Limits

One host, two adapters, fixed measurement order, uncontrolled power/clocks/load, five warm samples, and three workload models. No broad claim about arbitrary JavaScript or GPU vendors follows. The CPU fallback is an IR executor, not the native baseline. Browser playground timings compare that fallback with the GPU and are deliberately labeled accordingly.

Correctness and the known RTX branched-shader limitation are documented in [compatibility](compatibility.md). The alpha emitter uses predicated assignments; both physical GPUs passed the regression and differential suites.
