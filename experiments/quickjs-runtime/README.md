# QuickJS compiler + WGSL runtime

This isolated implementation follows the [adopted roadmap](ROADMAP.md). It reuses
the pinned QuickJS compiler and executes decoded QuickJS instructions directly
in a new WGSL runtime. The earlier nested-interpreter experiment is in
[`../bootstrap`](../bootstrap). The existing VM and numeric JIT APIs are unchanged.

## Build and run

Requires the repository's Node dependencies and Emscripten **4.0.22** for the
browser compiler. The native compiler bridge can be built with a C compiler.

```sh
node experiments/quickjs-runtime/build.mjs
EMCC=/path/to/emcc node experiments/quickjs-runtime/build.mjs --wasm
node experiments/quickjs-runtime/check-compiler.mjs
node experiments/quickjs-runtime/check.mjs
node experiments/quickjs-runtime/build-browser.mjs
cd experiments/quickjs-runtime/generated
python3 -m http.server 4178 --bind 127.0.0.1
```

Open `http://localhost:4178/` in Safari on M1. With Safari WebDriver already
running on port 4445, run `node experiments/quickjs-runtime/safari.mjs` from the
repository root. Generated binaries are intentionally ignored; rebuild from the
included source. An unavailable GPU fails these checks; they never select CPU
execution.

```js
import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';

const compiler = await createCompiler();
const vm = await QuickJSGPU.create();
try {
  const program = compiler.compile(`function f(x) {
    const o = {value: x};
    function inc(v) { return v + 1; }
    return inc(o.value);
  }`);
  console.log((await vm.run(program, [1, 2])).values); // [2, 3]
} finally {
  await vm.dispose();
}
```

`start(program, inputs)` returns a resumable job with `step(budget)` and
`dispose()`. `run()` accepts `budget`, `maxDispatches` and `signal`.

## Execution and ownership

`bridge.c` calls QuickJS only with `JS_EVAL_FLAG_COMPILE_ONLY`. It exports the
function graph, literal number bits/UTF-16 strings, captures, atoms and decoded
instructions. `program.js` verifies the revision, rejects unimplemented
instructions and repacks operands/branch locations into GPU buffers. The Wasm
compiler does not execute guest instructions. Native JS evaluation occurs only
in test oracles. GPU errors and unsupported features never cause CPU replay.

`bootstrap.js` adapts engine262's Object.defineProperty, ToPropertyDescriptor and
ordinary string-hint conversion algorithms into guest JavaScript. The compiler
appends their bytecode with isolated intrinsic captures. Descriptor getters and
key-conversion methods execute through normal GPU call frames, including
exceptions and suspension between instructions. Private WGSL primitives apply
the converted descriptor and invoke callbacks without consulting mutable public
`.call` methods. Symbols and full numeric string conversion remain incomplete.

The GPU has a bounded operand stack, persistent call frames and a node heap.
Closures reference shared heap cells; collection traces active environments,
frames, operands, object properties, prototype links and captured cells.
Collection happens at instruction boundaries so allocation cannot collect
unrooted intermediate values. QuickJS's CPU object allocator and garbage
collector are **not** being run on the GPU: these parts are an adaptation.

The compiler wrapper currently accepts one named synchronous function. Inputs
are Number, Boolean, String, null or undefined; outputs are supported primitives.
Limits per invocation: 32 frames, 256 operand slots, 2,048 heap nodes, 16 declared
parameters, 64 locals and 64 captures per function. Batches are limited to 1,024
invocations and device memory limits. Strings are limited to 256 UTF-16 code
units. The allocator reserves space for the next instruction, so not all heap
nodes can remain live simultaneously. This experiment is not a security sandbox.

## Coverage and gaps

Implemented subsets include software binary64 arithmetic, data/accessor
properties and their flags, arrays and length updates, prototype links,
local/argument cells, closures, calls, method receivers, loops/branches,
exceptions/finally, and heap collection. Strings support input/output,
concatenation, comparison, indexing, charAt/charCodeAt/slice and property keys.
`typeof`, `in` and `delete` are supported for the implemented value/object kinds.
Object.create, getPrototypeOf, setPrototypeOf, is, hasOwn, preventExtensions,
isExtensible, defineProperty and getOwnPropertyDescriptor have partial GPU
implementations. Ordinary and array prototype properties have per-invocation
storage; most prototype methods remain non-executable placeholders.
Guest and bound functions have GC-traced property storage, name/length metadata,
descriptors, deletion and extensibility. Function.prototype has an explicit
prototype chain. Ordinary constructors, bound constructors, and default
`instanceof` behavior execute on GPU. `call`, data-only `apply`, and `bind` are
implemented. Base Object prototype methods (`hasOwnProperty`,
`propertyIsEnumerable`, `isPrototypeOf`, `toString`, `valueOf`) also execute on GPU.
Mapped and unmapped `arguments` objects preserve actual argument counts, extra
arguments, parameter aliasing, descriptor changes, deletion and GC lifetimes.
Strict/unmapped `callee` access throws; the symbol iterator is still missing.
Array construction (including holes versus elements), `Array.isArray` and
`Array.of` execute on GPU, with an intrinsic Array constructor/prototype link.
Array lengths at or above 2^31, generic-constructor `Array.of`, `Array.from`,
`Array.fromAsync` and most array methods remain explicitly unsupported.

This is not full QuickJS, full ES2025 or production-ready. Complete intrinsic
prototypes and native function metadata,
getter-dependent apply lists/bind metadata, array descriptor changes,
complete keys/coercion, classes/new.target, most built-ins, symbols/BigInt,
generators, async/jobs, modules and dynamic code remain incomplete. Error-family constructors, prototypes, cause data properties and basic error
stringification execute on GPU. Getter-dependent causes and complete message
coercion remain unsupported. Function source text, legacy caller/arguments and home objects
remain unsupported. Sloppy primitive/global `this` is rejected when observed.
The new API currently requires a GPU; full-engine CPU fallback remains roadmap work.

## Source provenance

QuickJS: <https://github.com/bellard/quickjs/tree/535a7c250ff4a577ec36c3e103daab6dadeea650>.
The required C sources and headers are copied unchanged under `vendor/`, with
the upstream [MIT license](vendor/LICENSE). The compiler bridge schema is version
1. The build pins the code, not a claim of complete upstream ES2025 compliance.

The JavaScript bootstrap is adapted from engine262 revision
`a600354c2954300d62d108bf9ed3459a8e4a289b`; source paths are recorded in
`bootstrap.js`, with the [upstream MIT license](engine262-LICENSE.txt).
This is a targeted adaptation, not the complete engine262 runtime.

The latest suite passes **362 programs / 3,258 values and 24 negative checks**
in Safari 26.4 on M1. Native and Wasm compiler exports agree for all 362 programs.
Local software WebGPU last completed 179 programs / 1,611 values; M1 Node/Dawn
last completed 114 programs / 1,026 values. Larger shaders have caused prolonged
Dawn compilation on both paths: the local bound-function run was stopped after
over seven minutes, and an M1 name/length run after over nine minutes, without
results. A subsequent M1 run exceeded a 180-second deadline. These are unresolved
compilation limits, not passes for the latest suite. Safari remains the target.

The adapted descriptor inventory's mapped/unmapped-arguments report has
406 passing variants, zero failing variants, and 626 unsupported variants in
Safari. All 1,032 eligible variants are attempted; 925 files are excluded from
1,441 upstream files for harness limitations. Native Safari reference runs have
zero rejections.
Variant counts include strict/sloppy runs and must not be added to file counts.
Saved reports and source hashes are under
[`../bootstrap/evidence`](../bootstrap/evidence).

`test262-adapted.mjs /path/to/test262` inventories two upstream Object API test
directories. It wraps eligible test bodies in functions and supplies an adapted
GPU assertion object. It reports harness exclusions and unsupported operations
separately. Each adapted variant must also pass in a fresh native Node realm;
reference rejections are reported separately. Global/script tests that use top-level `this` are excluded because
function wrapping changes their meaning. This is **not** the full Test262
harness, full conformance or an overall language-coverage percentage.

To run the adapted descriptor inventory in Safari:

```sh
node experiments/quickjs-runtime/test262-adapted.mjs /path/to/test262 > /tmp/lanes-test262-report.json
node experiments/quickjs-runtime/export-test262-browser.mjs /tmp/lanes-test262-report.json /path/to/test262
node experiments/quickjs-runtime/build-browser.mjs
# Serve generated/ on the isolated test server, then use its Safari WebDriver:
LANES_QUICKJS_URL=http://127.0.0.1:4178/test262.html node experiments/quickjs-runtime/safari.mjs
```

The exporter requires the checkout revision recorded in the report and copies
the upstream license alongside the generated fixture. It exports every harness-eligible variant, including ones previously rejected
at compilation, and keeps harness/reference exclusions visible in the report.
