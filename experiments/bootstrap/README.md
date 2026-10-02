# Engine reuse feasibility experiment

Decision: adopt the [QuickJS reuse roadmap](../quickjs-runtime/ROADMAP.md).
The direct implementation now lives in [`../quickjs-runtime`](../quickjs-runtime).

On Apple M1/Metal, the bootstrap experiment passed:

- 9 QuickJS-compiled numeric functions, 153 checks, interpreted by the earlier
  Lanes VM. The compiler executed no guest instructions on CPU.
- 3 standalone, type-stripped engine262 helpers, 148 checks, executed on GPU.

The engine262 source audit found 374 `.mts` files, 1,055 generator functions,
74 class declarations and extensive object/array/collection dependencies after
TypeScript/decorator lowering. Of 542 isolated named one-parameter functions,
16 compiled with the then-current Lanes compiler. This is neither dependency
closure analysis nor a percentage of ECMAScript conformance.

## Revisions and evidence

- Lanes snapshot: `10384dc7514851f83be17d268000a282358b399e`.
- QuickJS: `535a7c250ff4a577ec36c3e103daab6dadeea650`.
- engine262: `a600354c2954300d62d108bf9ed3459a8e4a289b`.
- [M1 bytecode results](evidence/m1-result.json).
- [M1 helper results](evidence/m1-reuse-result.json).
- [Static engine262 audit](evidence/engine262-result.json).
- [engine262 license](evidence/engine262-LICENSE), covering extracted function
  text in the audit. QuickJS source and license are retained in the direct
  runtime's `vendor/` directory.

`probe.c` reads pinned QuickJS private compiler structures. Compile it with the
QuickJS directory as an include path and link `dtoa.c`, `libregexp.c`,
`libunicode.c`, `cutils.c`, `-lm` and `-lpthread`, with `_GNU_SOURCE` and
`CONFIG_VERSION` defined. `run.mjs /path/to/probe` generates the numeric fixtures
and requires WebGPU. `audit.mjs /path/to/engine262` writes the static audit;
`reuse.mjs audit.json` executes the three selected helpers. Set `LANES_ROOT` to
the pinned Lanes checkout for exact reproduction.

The native evaluator in the checks supplies expected values only. Local initial
WebGPU results used Mesa's software adapter; the M1 reports identify real Metal
hardware. The direct-runtime Safari reports are separate from these bootstrap
experiments. No timings here establish a speedup.
