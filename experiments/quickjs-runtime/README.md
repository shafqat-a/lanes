# QuickJS compiler + WGSL runtime

This isolated implementation follows the [adopted roadmap](ROADMAP.md). It reuses
the pinned QuickJS compiler and executes decoded QuickJS instructions directly
in a new WGSL runtime. The earlier nested-interpreter experiment is in
[`../bootstrap`](../bootstrap). The existing VM and numeric JIT APIs are unchanged.

## Current integration verification

The integrated runtime now compiles and executes on Apple M1 / Safari 26.4.
The final candidate passes the main suite (1,209 programs, 10,881 value checks,
238 negative checks and all resumptions) and the full standard-library suite
(788 GPU programs, 2,425 value checks, 21 GC probes, 12 resumptions and 16
boundary checks). The 583-fixture Promise aggregate also passes its admitted
scope: 569 GPU programs, 1,159 value/settlement checks, 25 GC probes, 10
resumptions and 10 resource-boundary checks; four unsupported gaps are reported.
See the [qualification record](../bootstrap/evidence/quickjs-m1-resumed-integration.json)
for exact candidate hashes, reports, historical failures and remaining checks.
These are repository-suite results, not full ECMAScript 2025 conformance.

The compiler blocker was resolved by separating interpreter execution, call
preparation, and built-in method execution into three GPU pipelines. The final
candidate compiles in 16.016 s, 4.588 s and 23.423 s respectively. A 144-byte
control record per lane preserves pending calls, completion values, GC roots
and instruction budgets between passes. The host schedules GPU passes;
guest execution and completion stay on GPU. An epoch prevents completed lanes
from running twice. The pipelines share seven bindings, including six storage
buffers. The earlier monolithic compiler memory failures remain documented in
[the historical retry record](../bootstrap/evidence/quickjs-m1-retry-status.json).

The resumed integration fixes ordinary own-property queries, function-key
comparison, alternate ordinary/base-class Reflect.construct, prototype
mutation and absent Object species lookup. It adds Object.entries,
Object.assign and Array.concat, including sparse inputs, custom species and
Symbol.isConcatSpreadable. Prototype validation runs in guest bytecode before
a private GPU commit. Constructor prototype getters, tagged new.target GC
roots, mutation observation and instruction-by-instruction resumptions have
focused coverage. The string equality rewrite is an observed compiler-sensitive
fix, not a confirmed driver root cause; see
[the isolated comparison result](../bootstrap/evidence/quickjs-safari-text-equal-early-probe.json).

Native reference execution is isolated in bounded workers so a browser-engine
loop cannot freeze the GPU runner. The Promise observer captures pristine
intrinsics before fixtures deliberately modify them. Exact documented native
engine differences retain strict ES2025 GPU expectations. Designated
implementation-approximated Math fields allow at most one binary64 ULP and
record each difference separately; this is a project differential-test policy,
not a bound prescribed by ECMAScript. Formatting, coercion traces, signed zero,
NaN and infinities remain exact.

Resource boundaries are explicit. The current runtime has a 2,048-node heap,
32 frames and a 256-UTF-16-unit string limit. Oversized concatenated test outputs
were split without dropping precision or coercion checks. Oversized pending
Promise stress cases remain resource tests, alongside smaller GC-required
success cases. The [live-capacity accounting](../bootstrap/evidence/quickjs-promise-live-capacity-accounting.json)
records conservative node lower bounds; it does not claim general leak freedom.

Full 1.0 work remains: persistent script realms and modules, dynamic code, Proxy, RegExp,
Date, buffers/typed arrays, weak collections, remaining builtin and constructor
gaps, full ES2025 Test262 execution, public value transfer and release packaging.
Alternate intrinsic/derived constructor targets and collection subclassing
remain unsupported. The experimental runtime requires WebGPU and never
replays unsupported guest work on CPU. The existing i32 JIT and older VM APIs
are separate. See the [roadmap](ROADMAP.md).

## Next 1.0 implementation wave

The working tree adds `compiler.compileScript(source)` for true Script bytecode
in a fresh realm per lane. Top-level lexical bindings use private capture cells;
var/function declarations use the global object. It preserves Script completion
values and top-level `this`. This first increment does not provide persistent
realms, modules, eval, or dynamic access to global lexical bindings. Its 36
fixtures pass native/Wasm packing and real-global host reference checks. M1
verification passes 144 value checks, eight compiler boundaries, all resumption
pairs and a required GC probe. The existing `compile(functionSource)` API is retained.

Array.flat, flatMap and splice are integrated as guest helpers. Host validation
passes 49 packed fixture parities, 98 directed comparisons and 600 seeded
sparse-array differentials. M1 verification passes 49 programs and 106 value
checks, including species, coercion ordering, mutation failures, GC and execution
resumption, plus one explicit recursive-frame resource boundary.

The dynamic Function compilation service has 13 passing host tests and emits
compile-only artifacts. It is not connected to guest Function calls yet; those
remain Unsupported. Append-only linking, the GPU request/response handoff and
access to the global lexical environment remain required. See
[the integration contract](dynamic-compilation-integration.md). The [wave evidence](../bootstrap/evidence/quickjs-1_0-parallel-wave1.json)
separates these new results from the previous fully qualified baseline. The new
candidate also passes the full main regression: 1,209 programs, 10,881 values,
238 negative checks and all resumptions. Full stdlib/Promise aggregates were
not repeated for this wave.

## Chrome hardware verification

Latest Linux attempt: hardware compute/readback passed on Intel gen-9, but
the full runtime pipeline caused GPU-process exit 133 in Chromium 148 and
149, including a watchdog-disabled retry. No guest programs executed.
See [the verification manifest](../bootstrap/evidence/chrome-linux-integrated/manifest.json).
Debugger evidence strongly indicates exhaustion of Chrome's 16 GiB allocator
pool during compilation; the allocating compiler pass is unidentified.
The older Safari-qualified shader also fails on this Chrome setup, as does a
compile-only variant omitting BigInt power, width conversion and collection
compaction. These failures do not establish that the new features caused the
Chrome failure. See the
[memory diagnosis](../bootstrap/evidence/chrome-linux-integrated/compiler-memory-diagnosis.json)
and [baseline comparison](../bootstrap/evidence/chrome-linux-integrated/isolation/results-isolation-qualified-old/shader-compile.json).
An isolated Chrome trace places the failure after Tint/SPIR-V generation
(352 ms) and Vulkan shader-module creation (0.634 ms), with asynchronous
pipeline initialization unfinished. This points to downstream pipeline
compilation rather than WGSL parsing; see the
[stage trace](../bootstrap/evidence/chrome-linux-integrated/compiler-stage-trace-diagnosis.json).

`chrome.mjs` serves the generated artifacts on loopback, launches an isolated
headless browser, records the adapter identity, rejects software adapters,
and verifies a compute/readback result before running suites. Linux Vulkan
flags follow [Chrome's headless WebGPU guide](https://developer.chrome.com/blog/supercharge-web-ai-testing).
Set `LANES_CHROME_BINARY` to the real browser executable (a wrapper may disable
the GPU), and `VK_DRIVER_FILES` when selecting an installed Vulkan driver.

```sh
node experiments/quickjs-runtime/chrome.mjs shader-compile phase6-review stdlib generators promise index
```

`LANES_BROWSER_ROOT` overrides the generated directory and
`LANES_CHROME_EVIDENCE` overrides the report directory. Each suite has a
10-minute timeout by default (`LANES_CHROME_TIMEOUT_MS`). For compilation
diagnosis only, `LANES_CHROME_DISABLE_GPU_WATCHDOG=1` adds the corresponding
browser flag; evidence records it explicitly. Hardware smoke and
shader compilation are diagnostics, not JavaScript conformance results.

## Build and run

Requires the repository's Node dependencies and Emscripten **4.0.22** for the
browser compiler. The native compiler bridge can be built with a C compiler.

```sh
node experiments/quickjs-runtime/build.mjs
EMCC=/path/to/emcc node experiments/quickjs-runtime/build.mjs --wasm
node experiments/quickjs-runtime/check-compiler.mjs
node experiments/quickjs-runtime/check-array-search.mjs # host oracle/compiler agreement only
node experiments/quickjs-runtime/check-array-reduce.mjs
node experiments/quickjs-runtime/check-array-mutation.mjs
node experiments/quickjs-runtime/check-array-shift.mjs
node experiments/quickjs-runtime/check-object-operations.mjs
node experiments/quickjs-runtime/check.mjs
node experiments/quickjs-runtime/build-browser.mjs
cd experiments/quickjs-runtime/generated
python3 -m http.server 4178 --bind 127.0.0.1
```

Open `http://localhost:4178/` in Safari on M1. With Safari WebDriver already
running on port 4445, run `node experiments/quickjs-runtime/safari.mjs` from the
repository root. Generated binaries are intentionally ignored; rebuild from the
included source. An unavailable GPU fails these checks; they never select CPU
execution. For the focused array search GPU checks, use
`LANES_QUICKJS_URL=http://localhost:4178/array-search.html` with `safari.mjs`.
Other focused pages include `array-extended.html`, `object-operations.html`,
`lifecycle.html`, `boxing.html`, `string-extract.html`, `number-pow.html`,
`property-key-conversion.html`, `computed-assignment.html`, and `high-index.html`.

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
Cancellation preserves the abort reason, pending and queued steps reject on
job disposal, and disposing the runtime leaves a caller-owned GPU device usable.
Allocation and validation failures clean up buffers. Device loss and GPU errors
remain errors, never triggers for CPU replay. Six lifecycle checks passed on
M1/Safari (`quickjs-safari-lifecycle.json`); mocked-device tests separately cover
failure paths in `runtime-lifecycle.test.mjs`.

## Execution and ownership

`bridge.c` calls QuickJS only with `JS_EVAL_FLAG_COMPILE_ONLY`. It exports the
function graph, literal number bits/UTF-16 strings, captures, atoms and decoded
instructions. `program.js` verifies the revision, rejects unimplemented
instructions and repacks operands/branch locations into GPU buffers. The Wasm
compiler does not execute guest instructions. Native JS evaluation occurs only
in test oracles and the standalone numeric-algorithm check. GPU errors and unsupported features never cause CPU replay.

`bootstrap.js` adapts engine262's Object.defineProperty, ToPropertyDescriptor and
ordinary string-hint conversion algorithms into guest JavaScript. The compiler
appends their bytecode with isolated intrinsic captures. Descriptor getters and
key-conversion methods execute through normal GPU call frames, including
exceptions and suspension between instructions. Private WGSL primitives apply
the converted descriptor and invoke callbacks without consulting mutable public
`.call` methods. Symbols and complete property-key conversion remain incomplete. Number-to-decimal text uses a guest exact-rational shortest-formatting algorithm.

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
implementations. Seven further Object statics (`getOwnPropertyNames`,
`defineProperties`, `seal`, `freeze`, `isSealed`, `isFrozen`, `keys`) now execute
GPU guest helpers for the supported object model. Own-key enumeration,
descriptor conversion, integrity levels and callbacks are covered by a focused
38-program / 152-value Safari suite, eight negative checks and 1,063
single-instruction resumption dispatches. Symbols and remaining exotic objects are still incomplete. String, Number and
Boolean wrapper integration is described below. Two defineProperties tests
retain explicit ES2025 expectations where Safari's native result differs. Ordinary and array prototype properties have per-invocation
storage; most prototype methods remain non-executable placeholders.
Guest and bound functions have GC-traced property storage, name/length metadata,
descriptors, deletion and extensibility. Function.prototype has an explicit
prototype chain. Ordinary constructors, bound constructors, and default
`instanceof` behavior execute on GPU. `call`, getter-aware `apply`, and `bind` are
implemented. Base Object prototype methods (`hasOwnProperty`,
`propertyIsEnumerable`, `isPrototypeOf`, `toString`, `valueOf`) also execute on GPU.
Mapped and unmapped `arguments` objects preserve actual argument counts, extra
arguments, parameter aliasing, descriptor changes, deletion and GC lifetimes.
Strict/unmapped `callee` access throws; the symbol iterator is still missing.
Array descriptors include index/accessor properties, writable length flags,
partial truncation at non-configurable indices and inherited length behavior.
Length assignments and descriptors perform string/object conversion on GPU,
including repeated valueOf calls and descriptor changes during conversion.
Array construction (including holes versus elements), `Array.isArray` and
`Array.of` execute on GPU, with an intrinsic Array constructor/prototype link.
Array.prototype `push`, `pop`, `at`, `indexOf`, `includes`, `every`, `some`, and
`forEach`, plus `find`, `findIndex`, `findLast`, `findLastIndex`, `lastIndexOf`,
`reduce`, `reduceRight`, `fill`, `copyWithin`, `reverse`, `shift`, and `unshift`,
execute guest helpers on GPU: 20 methods total. Tests cover holes, inherited slots,
length conversion, mutation during callbacks, strict writes/deletes, and abrupt
completions. The original getter/callback check passes 685 single-instruction dispatches.
The array search check passes 1,719 single-instruction dispatches; its focused
Safari suite passes 25 programs and 97 checked results, including holes, inherited
slots, omitted versus undefined fromIndex, and negative-zero normalization.
The seven newest methods pass 123 focused programs / 483 values, including
35 guest-caught negative programs. Reduce, mutation and shift resumptions pass
1,394, 2,106 and 1,412 single-instruction dispatches respectively
(`quickjs-safari-array-extended.json`).
These Array methods support object/function receivers; primitive receivers remain
unsupported in the Array helpers. Sparse array indices through 4294967294 and
lengths through 4294967295 are supported; visiting billions of holes still exceeds
the execution budget. Generic-constructor `Array.of`, `Array.from`,
`Array.fromAsync` and remaining array methods are explicitly unsupported.

Five String search helpers (`indexOf`, `lastIndexOf`, `includes`, `startsWith`,
`endsWith`) pass 49 focused M1/Safari programs / 193 values, 15 negative
checks, five explicit unsupported checks and 4,277 single-instruction resumption
dispatches (`quickjs-safari-string-search.json`). They search UTF-16 code units
within the existing 256-unit string limit.
`includes`/`startsWith`/`endsWith` explicitly reject object/function search
arguments because RegExp and Symbol.match semantics are unfinished. This also
rejects plain object search arguments; it is a declared unsupported subset,
not a catchable guest TypeError. String.prototype now exposes implemented
methods through mutable per-invocation properties; remaining methods and
complete prototype own-key enumeration are explicitly unsupported.

Writes to the intrinsic captures `undefined`, `NaN`, and `Infinity` now ignore
sloppy assignments and throw TypeError in strict functions; all 29 directed
constant-global cases pass on M1/Safari. String, Number and Boolean wrappers,
primitive prototype lookup, inherited setters and strict/sloppy property writes
are implemented. Null/undefined bases still throw TypeError.

This is not full QuickJS, full ES2025 or production-ready. Complete intrinsic
prototypes and native function metadata,
symbol keys/coercion, remaining class forms, most built-ins, symbols/BigInt,
generators, async/jobs, modules and dynamic code remain incomplete. Error-family constructors, prototypes, cause data properties and basic error
stringification execute on GPU. Cause/message/toString getters execute on GPU; numeric message formatting uses the GPU decimal formatter. Function source text and legacy caller/arguments
remain unsupported. Sloppy primitive `this` is boxed; sloppy global `this`
uses the GPU global object. Untagged template substitutions use immediate
ToString lowering. Tagged templates are implemented with cached frozen template
objects; remaining protocol and resource boundaries are explicit.
The new API currently requires a GPU; full-engine CPU fallback remains roadmap work.

## Combined integration verification (2026-10-04)

The latest core increment passes **1,207 programs / 10,863 values / 118 negative
checks** on Apple M1/Safari. Both previously observed normative defects are fixed:
strict global references are resolved before the assignment RHS, and
Function.prototype.toString retains guest source text.

The 869-record language suite has **811 semantic passes and zero unexpected
failures**, with 29 explicit unsupported outcomes, 25 compiler rejections and four
resource boundaries. The independent 265-record suite now has **228 semantic
passes and zero failures**, with nine unsupported outcomes and 28 compiler
rejections. Resumption and required-GC checks pass.

Focused GPU suites verify global references (32 programs), function source (31),
BigInt API transfer (8), division/remainder (26), bitwise/shifts (37), and BigInt
JSON ordering/errors (42). BigInt input/output supports up to 2,048 bits; Symbol
output remains an explicit boundary. JSON cross-feature checks pass 20 programs /
60 values. Main, language and JSON regressions pass on the same runtime.

These are verified subsets, not full ES2025 or 1.0 readiness. Conversions, mixed
comparisons, general iteration, collections and generators are being extended.
See the [artifact and report manifest](../bootstrap/evidence/quickjs-next-core-integration-manifest.json).
The [earlier integration manifest](../bootstrap/evidence/quickjs-phase345-integration-manifest.json)
retains the previous results for comparison.

## Earlier phase 4 integration

The first language wave integrated untagged templates, rest/spread, object and
array destructuring, intrinsic Array/String iteration, for-in, and a class
subset including super and new.target. Class fields/private names and tagged
templates followed in the combined integration above; generic Symbol iteration
remains pending. This earlier build had native/Wasm agreement for 565 focused
records and 1,200 main plus 29 validation programs.

The qualified M1/Safari run has **508 semantic passes and zero failures**, with
22 explicit unsupported outcomes, 32 compiler rejections and three resource
boundaries. All five single-instruction resumption cases pass. String casing
and Array sorting resolved the two failures from the initial run.
See [the qualified GPU report](../bootstrap/evidence/quickjs-safari-phase4-integrated.json).
The later combined regression passes **1,201 programs / 10,809 values / 119
negative checks**; its exact tested artifacts are recorded in the
[built-ins manifest](../bootstrap/evidence/quickjs-phase4-builtins-manifest.json).
Further phase 3 and phase 4 changes are undergoing separate integration.

## Phase 5 built-ins: first wave qualification

The first wave adds Array `join`, `toString`, `map`, `filter`, and `slice`;
ten String methods (`at`, `codePointAt`, `repeat`, padding, trimming, and
well-formedness); four Number predicates; and nine software-binary64 Math
methods. `trimLeft` and `trimRight` alias the corresponding trim methods.

Focused Apple M1 / Safari GPU runs pass Array **43 programs / 211 values**,
String **25 / 97**, Number/Math **77 / 360**, and cross-feature integration
**13 / 52**. The cross-feature suite verifies retained intrinsic objects after
garbage collection. Reports and tested bundle hashes are recorded in
[`quickjs-phase5-first-wave-manifest.json`](../bootstrap/evidence/quickjs-phase5-first-wave-manifest.json).
These are focused results, not full ES2025 conformance. Custom Array species,
cyclic joins, and incomplete intrinsic own-key enumeration remain explicit
unsupported or resource-limit boundaries. Later phase 5 helpers and phase 3/4
worker patches require separate integration and GPU qualification.

The second wave also integrates Array `toReversed`, `toSpliced`, and `with`
(**37 GPU programs / 181 values**), `Number.parseInt`/`parseFloat` and identical
global aliases (**66 / 72**), and `JSON.parse` (**44 / 173**, including 31
SyntaxError identity fixtures). Single-instruction resumption passes for all
three groups. Numeric parsing performs guest limb arithmetic; JSON parsing
preserves UTF-16 code units and creates data properties safely, including
`__proto__`. This historical second-wave run predates callable revivers.
Revivers are now GPU-qualified: **48 programs / 236 values**, including
single-instruction resumption.
Array `sort` and `toSorted` subsequently passed **58 GPU programs / 286 values**,
including resumption. Unicode upper/lower casing passed **65 programs / 321
values** using a read-only GPU data buffer. See the
[sorting report](../bootstrap/evidence/quickjs-safari-array-sort.json) and
[casing report](../bootstrap/evidence/quickjs-safari-string-case.json).

The combined phase 5 runtime passes the full M1/Safari regression:
**1,200 programs / 10,800 values / 104 negative checks**, including all existing
callback resumption groups. Native/Wasm packing agrees for 1,200 main and 29
validation programs. See
[`quickjs-safari-phase5-integrated.json`](../bootstrap/evidence/quickjs-safari-phase5-integrated.json)
and the [second-wave manifest](../bootstrap/evidence/quickjs-phase5-second-wave-manifest.json).

## JSON stringification qualification

`JSON.stringify` now executes through guest helpers, including function/array
replacers, spacing, toJSON, boxed primitives, cycle errors and lone-surrogate
escaping. Its M1/Safari suite passes **48 programs / 236 values**, one explicit
resource boundary and 1,007 single-instruction resumption dispatches. JSON.parse
regression also passes **44 programs / 173 values** with exact SyntaxError
identity. BigInt, Symbol and Proxy behavior remains subject to the engine's
explicit admission boundaries. See
[the stringify GPU report](../bootstrap/evidence/quickjs-safari-json-stringify.json).

## Foundation integration qualification (earlier baseline)

The earlier full integrated M1/Safari run passes **1,185 programs / 10,665 values
and 102 negative checks**, plus descriptor, apply, numeric, error, Array, String
and Object callback resumption checks (`quickjs-safari-foundations-integrated.json`).
Native/Wasm compiler exports agree for all 1,185 main and 29 validation programs.
The negative count decreases as newly supported cases move to positive coverage.

The primitive wrapper and String extraction patches are integrated. On M1/Safari,
`boxing.html` passes 173 programs / 689 values, 52 uncaught guest exception checks,
28 explicit unsupported checks and two template compiler rejections. Its callback
resumption runs across 2,406 single-instruction dispatches. Ten cross-feature
fixtures cover GC-retained dynamic wrappers, large String-wrapper indices,
boxed exponentiation and computed property keys. String exotic character and
length descriptors remain immutable; sloppy primitive receivers are boxed.

`string-extract.html` passes 27 programs / 105 values and 4,815 resumption
dispatches for `concat`, `substring` and Annex B `substr`. Span extraction uses
a private intrinsic, so replacing `String.prototype.slice` cannot change these
algorithms. At that baseline two default Array-to-string conversions were explicitly unsupported
(the phase 5 Array methods now support them);
six template-substitution fixtures reject at compilation. Supporting ordinary
`concat` calls does not establish correct template-literal lowering.

Reference differences are retained in the focused reports. Safari permits writes
to inherited String exotic indices in three directed fixtures where ES2025 and
Node require readonly behavior; computed read/write references also exhibit the
previously documented key-conversion difference. Only exact-source fixtures use
normative expectations. The independent native-only boxing diagnostic records
all 172 programs and the four differing sources. These are scoped checks, not a
full ECMAScript 2025 conformance claim.

## Source provenance

QuickJS: <https://github.com/bellard/quickjs/tree/535a7c250ff4a577ec36c3e103daab6dadeea650>.
The required C sources and headers are based on that pinned revision under
`vendor/`; `quickjs.c` includes two documented local compiler correctness patches
([patch notes](compiler-correctness-notes.md)). The upstream
[MIT license](vendor/LICENSE) is retained. The compiler bridge schema is version
1. The build pins the code, not a claim of complete upstream ES2025 compliance.

The JavaScript bootstrap is adapted from engine262 revision
`a600354c2954300d62d108bf9ed3459a8e4a289b`; source paths are recorded in
`bootstrap.js`, with the [upstream MIT license](engine262-LICENSE.txt).
This is a targeted adaptation, not the complete engine262 runtime.

The earlier integrated M1/Safari suite passed **1,124 programs / 10,116 values
and 108 negative checks** (`quickjs-safari-parallel-expanded.json`). Native and
Wasm compiler exports agree for all 1,124 programs. This verifies the expanded
Array/Object/String and lifecycle phase before the separate compiler fixes.
The patched compiler changes only two packed programs in that main corpus;
both were rerun on all nine inputs (18 values) and passed. That older report predates the full foundation integration rerun recorded above.
Descriptor/apply/numeric/error/base-Array/array-search resumption checks pass
209 / 191 / 1,256 / 334 / 685 / 1,719 single-instruction dispatches. The focused
extended-Array/Object/String resumption counts are recorded above.

The previous integrated baseline passes **790 programs / 7,110 values and 61 negative checks**
in Safari 26.4 on M1. Native and Wasm compiler exports agreed for all 790 programs.
Local software WebGPU last completed 179 programs / 1,611 values; M1 Node/Dawn
last completed 114 programs / 1,026 values. Larger shaders have caused prolonged
Dawn compilation on both paths: the local bound-function run was stopped after
over seven minutes, and an M1 name/length run after over nine minutes, without
results. A subsequent M1 run exceeded a 180-second deadline. These are unresolved
compilation limits, not passes for the latest suite. Safari remains the target.

The fresh expanded-phase descriptor rerun has **1,192 passing variants, zero
failing variants, and 826 unsupported variants** in Safari, with zero resource
limits and zero native reference rejections (`quickjs-test262-safari-descriptors-expanded.json`). All 2,018 eligible
strict/sloppy variants across 1,009 files are attempted. The remaining 432 of
1,441 upstream files are excluded with explicit harness reasons. There are zero
native Safari reference rejections. The initial expanded run's 14 failures are
preserved separately; missing Object static descriptors caused them, and the
final runtime fixes all 14 without excluding those tests. The earlier `quickjs-test262-safari-parallel-integration.json` remains in the
evidence directory alongside the fresh descriptor report. Native Safari reference runs have
zero rejections.
Variant counts include strict/sloppy runs and must not be added to file counts.
Saved reports and source hashes are under
[`../bootstrap/evidence`](../bootstrap/evidence).

The adapted conformance runner offers `--scope=descriptors` (legacy default),
`arrays` (20 complete method directories), `conversions` (17 String/Object API
directories), and `expanded` (their union). The current expanded inventory has
4,081 files / 8,121 variants: 6,732 eligible, 703 harness-excluded files /
1,389 excluded variants, and zero native Node reference rejections. Every
selected variant has an explicit record; file and variant counts are distinct.
This is **not** full Test262 or a language-coverage percentage.

The new Array Safari corpus attempts all 3,384 eligible variants. Its raw report
records 2,800 passed, 570 unsupported and 14 failed. A separate classification-only
derivation records **2,800 passed, 566 unsupported, 18 resource-limited, and zero
remaining failure-classified outcomes**. No tests were rerun to produce that
derivation: original statuses and hashes are retained. Ten variants exceed the
execution budget on large sparse scans, four exceed the 256-unit string limit,
and four hit runtime resource limits. These unresolved outcomes are not passes.
See `quickjs-test262-safari-arrays-expanded.json` and its `-classified.json`
companion. The separate conversion corpus passes 436 of 1,330 GPU variants, with 894
unsupported, zero failures, zero resource limits and zero reference rejections
(`quickjs-test262-safari-conversions-expanded.json`). Semantic errors, assertion
failures and unknown diagnostics remain failures; `resourceLimited` is reported separately.

The runner wraps original test bodies in functions and supplies adapted
assertions (callable assert, SameValue, exact-constructor throws, compareArray).
It does not reproduce script/global semantics or the full upstream harness.
Use `--inventory-only` for native-reference inventory without a GPU;
`--compile-only` additionally records compiler rejection and resource reasons.
Run the `test262-harness.test.mjs`, `test262-inventory.test.mjs` and
`test262-outcome.test.mjs` Node tests to check the adapters and accounting.

```sh
node experiments/quickjs-runtime/test262-adapted.mjs /path/to/test262 --inventory-only --scope=arrays > /tmp/lanes-test262-arrays.json
node experiments/quickjs-runtime/export-test262-browser.mjs /tmp/lanes-test262-arrays.json /path/to/test262 experiments/quickjs-runtime/generated/test262-arrays-suite.json
node experiments/quickjs-runtime/build-browser.mjs
LANES_QUICKJS_URL='http://127.0.0.1:4178/test262.html?suite=test262-arrays-suite.json' node experiments/quickjs-runtime/safari.mjs
```

The exporter verifies the recorded checkout revision and source hashes, includes
previously compile-unsupported/resource-limited variants, retains exclusion
records, and copies the upstream license. Named corpora can run sequentially
through the `suite` URL parameter without replacing the legacy descriptor suite.

The corrected directed language audit passes **52 programs with two explicitly
unsupported and zero failures**, including all 29 global-constant cases and
23 language cases (`quickjs-safari-language-scope-corrected.json`).
The initial directed language audit recorded 50 passing, two failing and two
unsupported programs (`quickjs-safari-language-scope.json`). Both failures are
now fixed by local compiler patches: const writes before initialization throw
ReferenceError, and `for (let …)` continues preserve per-iteration captures.
The dedicated patched-compiler M1/Safari run passes **46 GPU programs / 94 values**,
including 137- and 333-dispatch resumption checks, with two expected compiler
rejections for unsupported iteration. It also verifies the two changed
main-corpus programs separately (18 values). See
`quickjs-safari-compiler-correctness.json` and [the language audit](language-model-audit.md).

One captured-const/throwing-RHS fixture uses an explicit ES2025 expectation:
Safari raises ReferenceError before evaluating the RHS; plain assignment must
evaluate the RHS before PutValue. The diagnostic and focused reports retain
Safari's differing results for both inputs. This exception is restricted to
that fixture; other native-oracle mismatches fail the check. The 6,732 eligible Test262 variants were also compared before/after the compiler
patch: 5,644 packed outputs are unchanged and 1,088 compiler rejections are
identical, with zero changed outcomes (`quickjs-test262-compiler-delta.json`).
This compiler comparison does not rerun GPU tests. Global/script-level
const and with/eval paths remain outside the compiler patch's supported scope.

Four regression cases have explicit ES2025 expected values because Safari 26.4
reads apply arguments before rejecting a non-callable receiver, and captures
bind prototypes after metadata getters. It also rejects a strict array-length
assignment when conversion makes the unchanged length nonwritable. Reports retain the differing native
Safari observations; Node agrees with the documented specification expectations.

The new exact-rational numeric conversion helper passes 1,059 host algorithm
checks. The integrated GPU suite also passes its Number and array-length
conversion cases. A separate 175-case string-conversion corpus also passes on GPU, including
128 deterministic randomized decimals and hard rounding boundaries. Run
`node experiments/quickjs-runtime/check-number.mjs` for the algorithm checks.
The decimal formatter separately passed 124,709 host algorithm checks and 173
GPU cases on M1/Safari, including signed boundary neighbors, subnormals, and
random binary64 values. See `quickjs-safari-number-formatting.json` in the evidence
directory. Run `node experiments/quickjs-runtime/check-number-text.mjs` for its
default host corpus or set `LANES_NUMBER_TEXT_RANDOM=100000` for the larger run.
These host checks validate the algorithm only; they are not GPU execution.
Computed numeric property keys outside the existing integer subset still need
resumable ToPropertyKey conversion.
For longer Safari runs, set `LANES_QUICKJS_TIMEOUT_MS=600000`; progress is written
to stderr every 30 seconds without changing the JSON report on stdout.
