# Language-model audit: remaining work for synchronous ES2025 semantics

Status: original source audit as of 2026-10-03 (worktree HEAD `6d0564f`),
updated with coordinator GPU evidence below. Original line references may have shifted. This covers Phase 4 (and the Phase 3/5
pieces that block it) from `ROADMAP.md`. It is not a conformance claim.

## Integration update (2026-10-03)

The original tables below are historical findings, not current admission results.
Ordinary property keys, computed compound/update/logical assignments, sparse
uint32 array indices and Number exponentiation have since been implemented.
String/Number/Boolean boxing and primitive prototype reads/writes now pass
173 M1/Safari programs / 689 values, including GC and high-index integration.
String concat/substring/Annex B substr pass 27 programs / 105 values.

G7 remains open: adding String.prototype.concat exposed the pinned compiler's
mutable-method template lowering. Template substitutions now reject explicitly
in the source admission pass, including nested and tagged substitutions, until
a correct lowering exists. This does not reject ordinary explicit concat calls.
Sloppy global this, Symbols, BigInt and the other documented major language gaps
remain incomplete. See README/ROADMAP and the foundation integration manifest
for verification provenance and the remaining boundaries.

## Method

1. Read the admission pipeline: `bridge.c` exports post-optimization QuickJS short opcodes
   (`bridge.c:84-104`). `program.js` rewrites them and rejects any name missing from the `OP`
   allow-list (`program.js:5-17`, `program.js:137`). It also rejects unresolved global refs
   (`program.js:82`), unsupported special objects (`program.js:136`) and non-normal function
   kinds (`program.js:62`).
2. Read the WGSL dispatch (`shader.js:1097-1276`) and its helpers (`keyOf` `shader.js:169`,
   `getProperty` `:254`, `putProperty` `:358`, `call` `:531`, `construct` `:633`). Runtime
   status codes are listed at `runtime.js:169`: 4 = TypeError, 5 = ReferenceError,
   6 = "Unsupported runtime operation", and 2 = invalid bytecode (the default case).
3. For each feature, located the QuickJS emitter in `vendor/quickjs.c` to find out which opcodes
   reach `program.js`. Then I checked whether the allow-list and shader handle each opcode.
4. **The original audit did not execute probes.** Its Bash tool was denied, so it could not execute the
   `node -e` / `generated/compiler` probes. Every "observed" column below comes from code
   evidence and was not executed. Confidence:
   **H** = a direct code path proves the outcome (an opcode is missing from `OP`, or a branch
   sets an explicit status). **M** = it also depends on QuickJS emitter details that I read but
   did not execute. The "Verification commands" section lists the commands that confirm each row.

Repro convention: `compiler.compile(src)` followed by `vm.run(program, [x])`. A compiler
rejection throws `SyntaxError` from `program.js`, with the message shown.

## Prioritized gap table

### P0 (common syntax or core semantics; blocks much of Test262 chapter 12-14)

| # | Gap | Category | Source refs | Minimal repro | Spec expected | Observed / inferred (evidence) | Conf |
|---|---|---|---|---|---|---|---|
| G1 | Compound assignment and update on computed members | compiler rejection | `quickjs.c:26217` emits `get_array_el3` for keep-lvalue; `quickjs.c:26328` emits `perm4`; neither is in `program.js:5-17` | `function f(x){var o=[1];o[0]+=x;o[0]++;return o[0];}` | `x+2` (f(1)=3) | `SyntaxError: Unsupported QuickJS instruction: get_array_el3` (`program.js:137`). No existing case uses `a[i]++` or `a[i]+=` (grep of `*.js` found no match) | H |
| G2 | ToPropertyKey is incomplete. `keyOf` handles only int32-range non-negative integer Numbers and Strings | runtime rejection | `shader.js:169-188` (`status=6` at `:183` and `:187`); used by get/put_array_el `:1140,:1154`, `in` `:1243`, `delete` `:1248`, `to_propkey` `:1166`, `define_array_el` `:1165`, `set_name_computed` `:1168`, `define_method_computed` `:1161` | `function f(x){var o={};o[{toString(){return "k"}}]=x;o[1.5]=1;o[-1]=2;o[true]=3;o[undefined]=4;return o.k+o["1.5"]+o["-1"]+o["true"]+o["undefined"];}` | `x+10` | status 6 "Unsupported runtime operation" on the first object key. Also status 6 for keys 1.5, -1, NaN, 2**31, true, null, undefined, and the strings `"2147483648"`..`"4294967294"` (`:183`) | H |
| G2b | Computed object-literal keys (same root cause as G2) | runtime rejection | `quickjs.c:25220` emits `to_propkey` before the value (order is correct). `shader.js:1166` calls `keyOf` | `function f(x){var k={toString(){return "a"}};var o={[k]:x,[0.5]:1};return o.a+o["0.5"];}` | `x+1` | status 6 at `to_propkey` | H |
| G2c | Evaluation-order hazard once G2 is implemented. The key is converted before the base is checked | suspected wrong result (latent) | `shader.js:1140-1142` and `:1154-1156` run `keyOf` before the base is popped or checked. ES2025 GetValue/PutValue run `ToObject(base)` before `ToPropertyKey` | `function f(x){var n=null;try{n[{toString(){throw 1}}];}catch(e){return e instanceof TypeError;}}` | `true` | Now: status 6. A naive G2 fix would throw `1` → `false` | M |
| G3 | Sloppy-mode `this` (undefined/null → globalThis; primitive → wrapper) | runtime rejection | `shader.js:1173` sets status 6 when the receiver is not an object or function and the function is sloppy. QuickJS semantics: `quickjs.c:18092-18110`. The repo already treats this as unsupported: `validation.js:20` | `function f(x){function g(){return typeof this;}return g()+g.call(x);}` | `"objectobject"` | status 6 "Unsupported runtime operation" | H |
| G4 | Free global identifiers: globalThis, `typeof undeclared`, sloppy implicit globals, strict unresolvable ReferenceError | compiler rejection | `program.js:66-84`. Only `f`, the Error family, String, Boolean, Number, Array, Function, Object, NaN, Infinity and undefined are mapped. Everything else hits `program.js:82` | `function f(x){return typeof notDeclared;}` and `function f(x){return globalThis===this;}` | `"undefined"`; `true` | `SyntaxError: Unsupported global or module reference: notDeclared` (also `globalThis`). Matches `validation.js:92` (`Math`) | H |
| G5 | Classes of any shape | compiler rejection | `quickjs.c:25527` emits `define_class`; `:36910` `check_ctor`; `:25312` `init_ctor`; `:27244,:27444` `get_super`; `:25752` `define_private_field`; `:33288` `get_loc_checkthis`. None are in `OP` | `function f(x){class A{constructor(v){this.v=v;}}return new A(x).v;}` | `x` | Executed: `Invalid operand for push`. Rejection is incidental: the class constructor constant is packed as `{function}` but `push_const` reads `.literal` (`program.js:89-94,106,138`); there is no explicit class guard, so `define_class` is never reached | H |
| G6 | Exponent operator `**` / `**=` | compiler rejection | `quickjs.c:27927` emits `pow`; it is not in `OP`; the shader has no binary64 pow | `function f(x){var y=2;y**=x;return x**2+y;}` | f(3)=17 | `SyntaxError: Unsupported QuickJS instruction: pow` | H |
| G7 | Template literals with substitutions | runtime rejection | `quickjs.c:24734-24735` lowers them to `"head".concat(...)` with `get_field2 concat` + `call_method`. String `getProperty` only knows charCodeAt/charAt/slice and sets status 6 otherwise (`shader.js:299-305`) | ``function f(x){return `a${x}b`;}`` | `"a1b"` for 1 | status 6 at `get_field2 concat` | H |

### P1 (needed for Phase 4 gate; less frequent or depends on P0)

| # | Gap | Category | Source refs | Minimal repro | Spec expected | Observed / inferred (evidence) | Conf |
|---|---|---|---|---|---|---|---|
| G8 | Immutable `undefined`/`NaN`/`Infinity` captures | fixed for admitted globals | `closure()` marks intrinsic literal cells with `IMMUTABLE_GLOBAL_CELL`; capture writes check strictness and GC preserves the flag | `function f(x){undefined=x;return undefined;}` | Sloppy writes ignored; strict writes throw TypeError | Fixed and verified: all 29 directed global-constant cases pass on M1/Safari, including nested captures. A complete global object remains absent | H |
| G9 | Property writes on primitive bases | explicitly unsupported | `putProperty` returns runtime status 6 for unboxed Number/Boolean/String bases; null/undefined return TypeError | `function f(x){var s="ab";s.foo=x;return s.foo;}` | Sloppy writes may be ignored or invoke inherited setters; strict failures throw TypeError | Previous misleading unconditional TypeError removed. Both strict/sloppy primitive writes remain unsupported until wrapper/prototype semantics exist; this is not implemented boxing | H |
| G10 | Property read/delete/method lookup on Number/Boolean, and non-builtin String keys (no ToObject/boxing; shares wrappers with G3) | runtime rejection | `getProperty` sets status 6 for z=0/1 (`shader.js:307`) and unknown string keys (`:305`); `delete` on non-object sets status 6 (`:1249`). The repo already marks `new Number/String/Boolean` unsupported (`validation.js:10-12`) | `function f(x){Object.prototype.q=function(){return typeof this;};return (1).q()+delete "ab"[0];}` | `"objectfalse"` (sloppy q boxes the Number receiver) | status 6 | H |
| G11 | `new.target` (functions and arrows) | compiler rejection | `quickjs.c:35059-35062` emits `special_object 3`; `program.js:136` accepts only 0/1/2; `Frame` has no new.target slot (`shader.js:630`, `construct` `:633-666`) | `function f(x){function C(){return new.target===C;}return new C() instanceof C && !C();}` | `true` | `SyntaxError: Unsupported QuickJS special object: 3` | H |
| G12 | Object-literal `super` / home objects | compiler rejection | `quickjs.c:35047-35050` emits `special_object 4`; `get_super_value` (`quickjs.c:27646`) is not in `OP`; `set_home_object` becomes `nop` (`program.js:127`), which is safe only while the former is rejected | `function f(x){var p={v:x},o={__proto__:p,m(){return super.v;}};return o.m();}` | `x` | `SyntaxError: Unsupported QuickJS special object: 4` | H |
| G13 | Destructuring (object), object rest/spread | compiler rejection | `quickjs.c:26573` emits `to_object`; `:25164,:26618` emit `copy_data_properties`. Neither is in `OP` | `function f(x){var {a,b=2}={a:x};var {...r}={c:1};return a+b+r.c;}` | `x+3` | `SyntaxError: Unsupported QuickJS instruction: to_object` | H |
| G14 | Rest parameters, spread calls/arrays, array destructuring, for-of | compiler rejection | `rest` `quickjs.c:36974`; `apply` `:27538`; `append` `:26032`; `for_of_*`/`iterator_*` (`quickjs-opcode.h:201-211`). None are in `OP`; `Symbol.iterator` is missing (README:108) | `function f(x){function g(...a){return a.length;}var [p]=[x];return g(1,2)+p;}` | `x+2` | `SyntaxError: Unsupported QuickJS instruction: rest` | H |
| G15 | for-in enumeration | compiler rejection | `for_in_start`/`for_in_next` (`quickjs-opcode.h:201,204`) are not in `OP` | `function f(x){var s="";for(var k in {a:1,b:2})s+=k;return s;}` | `"ab"` | `SyntaxError: Unsupported QuickJS instruction: for_in_start` | H |

### P2 (legacy/dynamic scoping, script-level; Phase 7/8 policy)

| # | Gap | Category | Source refs | Minimal repro | Spec expected | Observed / inferred (evidence) | Conf |
|---|---|---|---|---|---|---|---|
| G16 | `with` statements | compiler rejection | `quickjs.c:29770` (`to_object`), `with_*`/`make_*_ref`/`get_ref_value` (`quickjs-opcode.h:131-132,190-199`) are not in `OP` | `function f(x){var o={a:x};with(o){return a;}}` | `x` | Executed: `Unsupported global or module reference: a`. The ref-table check (`program.js:82`) fires before `to_object` is reached | H |
| G17 | Direct/indirect eval | compiler rejection | `eval` is a free global ref → `program.js:82`; `eval`/`apply_eval` opcodes are not in `OP` | `function f(x){var y=x;return eval("y+1");}` | `x+1` | `SyntaxError: Unsupported global or module reference: eval` | H |
| G18 | `delete` of an unqualified unresolvable name | compiler rejection | `quickjs.c:33492-33494` emits `delete_var` (atom operand); it is not in `OP` | `function f(x){return delete notDeclared;}` | `true` (sloppy) | Executed: `Unsupported global or module reference: notDeclared`. The ref-table rejection fires first, so `delete_var` is never reached | H |
| G19 | Global declaration instantiation / script code (top-level var/let/function, global `this`) | compiler rejection | `program.js:32-39`: only one named sync FunctionDeclaration is admitted. `bridge.c:42` compiles as a global script but the script body is discarded (`bridge.c:48-53`) | `var g=1; function f(x){return g+x;}` | `x+1` | `SyntaxError: Expected one synchronous named function declaration` | H |

Out of scope here (tracked by other phases): generators/async (`program.js:62` rejects
`kind!==0`), RegExp literals (`regexp`), BigInt (`push_bigint_i32`; the bridge marks BigInt
constants unsupported: `bridge.c:81` → `program.js:93`), and Symbols.

### Areas with code evidence of support (no gap found; confirm with the probes below)

- TDZ: `set_loc_uninitialized` writes tag 6. Every `get_*` op raises ReferenceError on tag 6
  (`shader.js:1126,1131`). `put_*_check` checks before writing (`:1133`). This covers switch-case
  `let` and closure reads via `get_var_ref_check`.
- `const` reassignment: `throw_error` type 0 → TypeError, and types 2/3/5 → ReferenceError
  (`shader.js:1273`; enum at `quickjs.c:18492-18497`).
- Per-iteration `let` bindings: `close_loc` swaps in a fresh cell and leaves captured cells
  intact (`shader.js:1261-1265`).
- Labeled break/continue: these lower to `goto`/`gosub` (no dedicated opcode).
- Function declaration hoisting in `f`: these lower to `fclosure`+`put_loc` (admitted). **Annex B
  sloppy block-function var-copy is unverified**; it is the first probe below.
- Mapped/unmapped `arguments` (`shader.js:475-489`, `special_object` 0/1).
- Object-literal getters/setters (`define_getter`/`define_setter`, `define_method_computed`).
- `delete` on objects, including the strict TypeError and sloppy `false` (`shader.js:1248-1260`).
- `typeof` on all implemented tags (`shader.js:1239-1241`).

## Dependency graph

```
G6 pow ───────────────────────────────(independent)
G7 template concat ───────────────────(independent; String.prototype.concat or ToString+add)
G1 get_array_el3/perm4 ──┐
G2 ToPropertyKey (resumable) ─┬─> G2b literal keys, G2c order
                             ├─> G13 object destructuring/spread (keys + to_object)
                             ├─> G15 for-in (own-key order + proto walk)
                             └─> G5 classes (computed members, private names need unique keys)
WP-C ToObject + globalThis ──┬─> G3 sloppy this
                             ├─> G9/G10 primitive base get/set/delete
                             ├─> G4 global refs (typeof undeclared, implicit globals) ─> G18 delete_var
                             ├─> G8 already fixed for intrinsic captures; full global object still needed
                             └─> G16 with (object environment) ─> G17 eval (Phase 7 host compile)
G11 Frame.newTarget ──> G5 classes ──> G12 object-literal super (shares home object)
Symbols/iterators (Phase 3) ──> G14 rest/spread/for-of/array destructuring
                                (rest params alone need only array creation: independent)
```

## Work packages (ordered; parallel lanes marked)

| WP | Contents | Depends on | Parallel? | Suggested ownership (avoid edit collisions) |
|---|---|---|---|---|
| WP-1 Keys | G2, G2b, G2c, then G1 (`get_array_el3`, `perm4`). Add a guest `toPropertyKey` bootstrap: generalize `propertyKey` in `bootstrap.js:20-35`, and reuse `numberText` for non-integer Numbers. Add a continuation tail kind in `finish()` (`shader.js:408-418`; current kinds 2-6) so `get/put_array_el`, `in`, `delete`, `to_propkey`, `define_array_el` and `define_method_computed` can resume after the callback. Check the base before conversion | none | Lane A | `shader.js` `keyOf`/key-op cases (`:169-188`, `:1138-1168`, `:1243-1260`) + `finish` tails; `bootstrap.js`; append ops in `program.js:5-17` |
| WP-2 Quick ops | G6 `pow`: guest helper over the existing binary64 arithmetic, or WGSL software pow; follow the spec special cases (NaN/±0/±Infinity). G7: GPU `String.prototype.concat` in the string branch (`shader.js:299-305`) with guest `toText` | none | Lane B | new `cases('pow')` near `shader.js:1193`; string-method branch; `program.js` OP append |
| WP-3 Global object + ToObject | Global object intrinsic with non-writable `undefined/NaN/Infinity` (G8 already fixed for admitted capture cells; preserve that behavior). Ref table resolves free names to global-object property lookups instead of rejecting (`program.js:66-84`): get_var throws ReferenceError, get_var_undef returns undefined, sloppy put_var creates the property. Wrapper objects for Number/String/Boolean, `push_this` conversion (`shader.js:1173`), primitive branches in get/put/delete (G9, G10), `delete_var` (G18) | none to start; G4 runtime needs the global object first | Lane C | `program.js` ref loop; `shader.js` `closure()` spec kinds (`:142-167`), `push_this`, primitive branches of `getProperty`/`putProperty`/`delete`, intrinsic init (`:1040-1090`) |
| WP-4 new.target + classes | Add `newTarget` to `Frame`, set it in `construct` (`shader.js:633-666`), and admit `special_object 3` (G11). Then `define_class`, `check_ctor`, `init_ctor`, `check_ctor_return`, `get_loc_checkthis` (derived-this TDZ), `get_super`, `get/put_super_value`, `insert4`/`perm5`/`rot4l`/`dup3`, home object (`special_object 4`, real `set_home_object`), fields/static blocks (field-init functions), then private names (`private_symbol`, brand ops, `private_in`) | G11 first. Computed and private members need WP-1 key representation (private names as unique non-string keys) | Lane D (new.target + base classes can start now) | `construct`/`call`/`Frame` in `shader.js`; new class cases; `program.js:127,136` |
| WP-5 Destructuring / enumeration | `to_object` (object-only first; primitives after WP-3), `copy_data_properties` (reuse `__lanesOwnKeys`), `for_in_*` (G15), `rest` params (independent, array allocation only) | WP-1 (keys), WP-3 (primitive ToObject) | After A/C; `rest` can go now | new cases; guest helper for EnumerateObjectProperties |
| WP-6 Iteration protocol | `for_of_*`, `iterator_*`, `apply`, `append`, array destructuring, spread (G14) | Symbols (Phase 3), WP-5 | Later | iterator helpers in bootstrap |
| WP-7 Dynamic scope | `with` (G16), direct eval via host compile service (G17), script-level entry (G19) | WP-3; Phase 7 host protocol | Later | `program.js` entry/ref policy; `bridge.c` scope export |

Serialization notes: `program.js:5-17` and the `shader.js` switch are shared hot spots. Append
new opcode names at the end of the `OP` list; opcode indices are positional but are generated
from names. Each lane should touch disjoint helper functions. WP-1 should merge its continuation-tail
enum before WP-3 and WP-4 add callback-driven paths. Each new tail kind must also be added to the
comment at `shader.js:411`.

## Executed compiler-admission probes (coordinator, 2026-10-03)

The coordinator ran `compiler.compile(src)` (WASM compiler) on each row's repro. Every compiler
rejection was confirmed, with these message differences now reflected in the tables: G5 gives
`Invalid operand for push`, and both G16 and G18 give `Unsupported global or module reference`.
At the time of those probes, G1 also rejects for `o[0]++` (`get_array_el3`), and G12 rejects with `special object: 4`.
These were **admitted** by the compiler; their initial audit had not run the GPU: G3 (sloppy `this`), G7 (template substitution), G8 (`undefined=x`), G9
(primitive property write) and Annex B block functions
(`function f(x){if(x){function g(){return 1;}}return typeof g;}`; the oracle gives `"function"`
for f(1)). That original G8 uncertainty is superseded by the implemented immutable-cell guard
and 29 passing directed M1/Safari GPU cases.

Compiler admission/rejection plus host-oracle expectations for TDZ, const, loop bindings,
finally, arguments, computed keys and constructor returns are pinned in
`language-scope-cases.js` and checked by `check-language-scope.mjs`. That file also records two
wrong results originally confirmed on M1/Safari and now fixed by local compiler patches:
- **const write before initialization.** QuickJS emits `throw_error` type 0 with no TDZ check
  (`vendor/quickjs.c:33154-33159`), which leads to TypeError (`shader.js:1273`). The spec
  requires ReferenceError. Repro:
  `function f(x){try{k=x;}catch(e){return e instanceof ReferenceError?"ref":"type";}const k=1;}`
  (spec `"ref"`; the directed GPU variant appends x and returned `"type1"`
  instead of `"ref1"` for x=1).
- **`continue` in `for(let…)` may skip the per-iteration `close_loc`.** The QuickJS emitter
  moves `label_cont` after the scope close (`vendor/quickjs.c:29441-29460`, "XXX: check continue
  case"). Repro:
  `function f(x){const a=[];for(let i=0;i<3;i++){a[i]=function(){return i+x;};if(i<3)continue;}return a[0]()+","+a[1]()+","+a[2]();}`
  (spec `"1,2,3"` for x=1; GPU returned `"4,4,4"`).

## Current GPU qualification and blockers

The corrected report `quickjs-safari-language-scope-corrected.json` records
52 passing programs, two unsupported computed-key programs and zero failures.
All 29 global-constant and 23 admitted language probes pass.

The historical `quickjs-safari-language-scope.json` records 54 directed programs: 50 pass,
two fail, and two are explicitly unsupported. All 29 immutable-global cases
pass. The two unsupported cases require object-valued computed keys. The two
failures confirmed the const-before-initialization and for-let-continue closure
defects above. Both are now resolved within the function-entry subset: the
patched compiler's focused M1/Safari run passes 46 GPU programs / 94 values,
including both original reproductions and 137/333-dispatch resumption checks.
Two for-in/for-of controls remain expected compiler rejections. The two changed
main-corpus programs also pass all nine inputs (18 values); the previous full
1,124-program GPU baseline was not rerun wholesale after the patch.

See `quickjs-safari-compiler-correctness.json` and
[compiler patch notes](compiler-correctness-notes.md). A single captured-const
throwing-RHS fixture uses its normative ES2025 result because Safari checks TDZ
before invoking the RHS; the native discrepancy is preserved for both inputs.
Global/script-level const, with/eval, and other unsupported language features
remain outside these fixes.

G9 is an honesty fix: primitive writes now fail explicitly as unsupported rather
than emitting the wrong catchable guest TypeError. It does not supply ToObject,
sloppy primitive writes, inherited setters, or complete strict-write behavior.
G7 remains open: the five new String search methods do not implement concat.

## Verification commands (original audit's probe script)

Run these from `experiments/quickjs-runtime` after `node build.mjs`. Each one should print the
rejection message predicted above, or `OK`:

```sh
for s in 'function f(x){var o=[1];o[0]+=x;return o[0];}' \
         'function f(x){return x**2;}' \
         'function f(x){class A{}return 1;}' \
         'function f(x){return typeof notDeclared;}' \
         'function f(x){function C(){return new.target;}return 1;}' \
         'function f(x){var {a}={a:x};return a;}' \
         'function f(x){for(var k in {})x++;return x;}' \
         'function f(x){return delete notDeclared;}' \
         'function f(x){undefined=x;return undefined;}' \
         'function f(x){if(x){function g(){return 1;}}return typeof g;}'; do
  node --input-type=module -e "import {createCompiler} from './compiler.js';
    const c=await createCompiler();
    try{const p=c.compile(process.argv[1]);console.log('OK',p.raw.functions[0].instructions.map(i=>i.op).join(' '));}
    catch(e){console.log(e.message);}" "$s"
done
```

The last two lines check G8's emitted `put_var` and Annex B admission (the expected sloppy
result is `"function"`). Runtime outcomes (G2, G3, G7, G9, G10) need the Safari/M1 GPU path
(`safari.mjs`), because no GPU is available here.
