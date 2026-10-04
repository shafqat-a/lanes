# Phase 4 next wave — worker 4: private instance fields and `#x in o`

Scope: review, harden and extend the lead's existing implementation
(`phase4-class-elements.js`, kinds 33/34/35, opcodes `private_symbol`,
`get_private_field`, `put_private_field`, `define_private_field`, `add_brand`,
`check_brand`, `private_in`). Nothing was redone. Lead-owned files were never
edited by worker 4.

**Status:** the lead has integrated all three defect fixes:
- D1 and D2 from this worker's diffs.
- D3 via worker 5's `w5-private-in-setter-only.diff`.
- Worker 5's `w5-private-tdz.diff`, which completes D2.

The native and Wasm compilers were rebuilt in `generated/`. The former
`gpuDefect` fixtures are now ordinary value fixtures marked
`regression: 'D1' | 'D2' | 'D3'`. The check asserts that each fix is present in
the integrated sources and that each regression fixture still has the bytecode
shape the fix handles.

Reservations used: none. IDs 2060–2089, continuations 62–63 and fixed nodes are
not needed. No OP/FIELDS change and no GPU binding change.

## Files (worker 4)

| File | Purpose |
|---|---|
| `phase4-next-w4-cases.js` | 54 value fixtures (7 of them `regression`, 6 `gc`) + 3 uncaught-error + 2 unsupported (status 6) + 13 early-error fixtures, same record shape as `phase4-class-element-cases.js` (`w4Cases`, `w4ErrorCases`, `w4UnsupportedCases`, `w4RejectedCases`) |
| `check-phase4-next-w4.mjs` | V8 + native QuickJS oracles, packing/WGSL coverage, fix-presence assertions, regression bytecode shapes, native-vs-Wasm pack parity; `--dump=<substring>` prints packed bytecode |
| `phase4-patches/w4-private-field-function-name.diff` | D1 (applied by the lead; kept as a record) |
| `phase4-patches/w4-private-name-before-init.diff` | D2 WGSL half (applied by the lead; kept as a record) |
| this file | findings, representation reference, integration requests |

## Commands and results (host only; no GPU, no CPU replay, WGSL not compiled)

`node experiments/quickjs-runtime/check-phase4-next-w4.mjs` passes. Output
summary:

- 59 admitted programs pack, and every packed opcode has a WGSL case.
- V8 matches 57/57 and native QuickJS (built from the patched `vendor/`) matches
  57/57, with no QuickJS deviations.
- 2 unsupported fixtures pack and 13 early errors are rejected (by V8, the
  native compiler and the Wasm compiler).
- All 7 opcodes are exercised.
- Fix presence: D1, D2 and D3 are all present.
- Regression shapes:
  - D1: `set_name_computed` over a private name at instructions 84/86/59.
  - D2: early private-slot reads at 13/15/43, all flagged `b=1`.
  - D3: a flagged load feeds `private_in` at 75.
- Every `b=1` load in every fixture feeds a private opcode.
- The native QuickJS answer for setter-only `#s in o` is the ES2025 answer on
  4/4 probes.
- `leadFixturesWithPrivateSetName: []`, i.e. the lead's fixtures still have no
  D1 coverage; the w4 fixtures provide it.

**Native-vs-Wasm parity.** All 59 admitted programs, plus the 4 setter-only
probes, pack to identical `code` and `image` with `generated/compiler` and
`generated/compiler.mjs`. All 13 early-error fixtures are rejected by both with
SyntaxError.

Raw compiler JSON is *not* byte-identical: for example, bootstrap
`arrayToSpliced` has `push_atom_value` bytes 14 vs 15. The instruction `bytes`
carry runtime-local atom numbers, which differ between a fresh native process
and the long-lived Wasm instance. Packing resolves atoms to text, so the packed
comparison is the meaningful one. Every packed program includes the bootstrap,
so bootstrap parity is covered as well.

`node experiments/quickjs-runtime/check-phase4-class-elements.mjs` (the lead
check) still passes after integration: 73 admitted, V8 71/71, native 71/71,
2 unsupported, 1 rejected.

## Defects (all integrated)

### D1 (high): naming anonymous functions in private field initializers

`#f = () => 0`, `#g = function(){}` and `static #h = () => x` lower to
`get_var_ref_check <#f>; closure; set_name_computed; define_private_field`.

Before the fix, the pre-dispatch key conversion treated the kind-33 private
name (a tag-4 value) as a non-canonical key and ran ToPropertyKey (builtin 900)
on it. The description text index was read as a `[[Prototype]]`, so
construction gave a wrong name or an internal error.

Integrated fix (shader.js):
- The keySlot is skipped for private names.
- `set_name_computed` names the function from `image[heap[name].value.x]`. That
  is the private name's [[Description]] (ES2025 NamedEvaluation).

Regression fixtures:
- "anonymous functions in private field initializers are named by the private name"
- "static private arrow field is named by the private name"
- "calls through private fields bind this"

### D2 (medium): private-name slot read before its declaration

In ES2025 all private names of a class body exist before any element is
evaluated. QuickJS emits `private_symbol` per element, in source order, into a
slot that starts in the TDZ (`set_loc_uninitialized`). A computed key placed
before the `#x` declaration, or a closure called from such a key, therefore
reads the slot uninitialized:

```js
class A { static [(r = #x in {}, 'k')] = 1; #x; }               // ES2025: r === false
class A { static [(() => { try { ({}).#x } catch (e) { return e.constructor.name } })()] = 1; #x; } // 'TypeError'
```

**Correction to my first report:** I wrote that the GPU answered status 2.
Before `w5-private-tdz.diff`, the unchecked `get_loc`/`get_var_ref` case
already turned a TDZ cell into status 5 (a guest ReferenceError), so
`privateName()` was never reached. The observable bug was therefore a
ReferenceError where ES2025 requires false or TypeError, i.e. a wrong exception
identity. My WGSL half alone would not have fixed it.

The integrated fix has two parts:
1. Worker 5 (`program.js` `privateSlotLoad`): unchecked loads that feed
   `private_in`, `get_private_field`, `put_private_field` or `check_brand`
   (including the setter-write `swap rot3r check_brand` shape) are flagged `b=1`.
   The shader get case then pushes the TDZ cell instead of raising status 5.
2. Worker 4 (`phase4-class-elements.js`):
   - `privateNameOrAbsent` maps tag 6 to key 0.
   - `privateFind` returns 0 for key 0.
   - `get_private_field`, `put_private_field` and the field branch of
     `private_in` use the new helper.
   - Result: get and put throw TypeError and `in` answers false. The
     non-object check comes first, so `#x in 1` is still a TypeError.
   - `define_private_field` keeps the strict helper.
   - A TDZ method closure in `check_brand` gives TypeError through
     `privateBrand`.

Native QuickJS answered these fixtures correctly all along.

Regression fixtures:
- "#x in from a computed key before the declaration answers false"
- "#x in before the declaration ignores an ordinary "undefined" key"
- "private read from a computed key before the declaration throws TypeError"

### D3 (medium; worker 5's fix): setter-only `#s in o`

The `#s` slot of a setter-only accessor is never written; the setter lives in
`#s<set>`. Pinned QuickJS answered false, and the GPU reached the TDZ path.
Worker 5's vendor fix makes `OP_scope_in_private_field` load the `#s<set>`
closure, whose [[HomeObject]] brand is the right one. The check verifies:
- the vendor marker is present,
- the native interpreter gives the ES2025 answer on 4 probes,
- the w4 regression fixture's `private_in` operand is a flagged load.

Note for worker 5's record: the unpatched slot was in the TDZ, not `undefined`.
`#s in {undefined: 1}` was false unpatched.

Regression fixture: "setter-only private accessor answers #s in o by brand".

## Comment corrections for `phase4-class-elements.js` (for the lead to port)

The exact replacement texts are below; the lead ports them.

1. Header, "kind 33 private name" bullet. Replace
   "Pushed as V(id,0,4,0); it only flows through compiler-synthesized bindings
   and the private opcodes below (never a guest-visible property value)." with:
   > Pushed as V(id,0,4,0). It flows through compiler-synthesized bindings and
   > their closure cells, generic stack shuffles (dup/swap/insert*/perm*/rot*),
   > the private opcodes below and set_name_computed (an anonymous function in a
   > private field initializer is named from the description, image[value.x]).
   > It is never a property key or a property value. Before its private_symbol
   > runs, the slot holds the TDZ marker (tag 6); flagged loads (b=1) hand that
   > marker to the private opcodes, where it names no element.
2. `classElementNotes.symbolHooks`. Replace "privateName() rejects every
   non-kind-33 value with status 2" with:
   > privateName() rejects every non-kind-33 value with status 2; the private
   > get/put/in opcodes go through privateNameOrAbsent, which additionally maps
   > the TDZ marker (tag 6) to 'no element'. Tag-17 Symbols still give status 2.
3. Holder bullet. After "(kinds 2 ordinary/function backing and 8 error
   objects, whose value.y was always 0)", add:
   > This includes the fixed kind-2 intrinsic nodes (Object.prototype,
   > Function.prototype, the mapped constructors Object/Number/Array/Error*,
   > Math, JSON), which can carry private elements via a base-constructor return
   > override; they are GC roots 1-25, so their chains are always marked. Phase
   > 3/6 must not reuse value.y of kinds 2/8 (e.g. for Proxy/Map/WeakMap).
4. "PrivateFieldAdd ignores [[Extensible]], ES2025 7.3.31". That section
   number comes from ES2022 and is unverified for ES2025. Replace with:
   > PrivateFieldAdd / PrivateMethodOrAccessorAdd ignore [[Extensible]] (ES2025,
   > cited by name).
5. Opcode table, `private_in` note. Replace with:
   > obj (name | method/accessor closure) -> bool; TypeError if obj is not an
   > object; a TDZ name answers false.
   Also extend the `get_private_field` and `put_private_field` notes with
   "(a TDZ name: TypeError)".

## Representation reference (precise)

Value tags involved: 4 = object (heap id in `x`), 5 = closure (kind-5 id in `x`),
11 = intrinsic builtin (`x` = builtin id), 6 = TDZ marker (`V(0,0,6,0)`).

Private name (kind 33):
- `alloc(33, value=V(descText,0,0,0), key=0, next=0)`. `descText` is the
  `private_symbol` operand, i.e. the image index of the text `#name`, so
  `image[descText]` is a tag-7 image-backed string. It is used for function
  naming (D1).
- Pushed as `V(id,0,4,0)`. Each evaluation of a class body allocates a fresh
  name, so names are distinct per evaluation. Identity is by node id only.
- Lives in compiler-synthesized `#x` slots that guest code cannot name. Before
  `private_symbol` runs, the slot holds the TDZ marker. Loads that feed private
  opcodes are flagged `b=1` and push the marker, which
  `privateNameOrAbsent` maps to key 0 ("no element").
- GC: reached through env cells (markValue on tag 4) and from the kind-34
  `key`. Kind 33 references nothing.

Holder resolution (`privateHolder(v)`):
- A tag other than 4/5/11 gives 0, which means TypeError for get/put/in.
- `objectView(v)`:
  - Closures (tag 5) and bound functions resolve to their kind-2 backing
    (`heap[fn].value.y`).
  - Mapped intrinsics (tag 11, x ∈ {100, 122, 200, 400, 600..606}) resolve to
    the fixed kind-2 nodes 19, 24, 18, 3 and 11..17.
  - Other tag-11 builtins give `PRIVATE_NO_STORAGE`.
- Kind 2 (ordinary, function backing, intrinsic) or kind 8 (error) gives the
  holder id.
- Any other kind (7 array, 14 arguments, 16 primitive wrapper) gives
  `PRIVATE_NO_STORAGE`: adding there is status 6, and lookups answer absent.

Private element chain (holder `value.y`, singly linked through `next`, newest
first):
- Kind 34 field: `value` = the field value, `key` = the name id.
- Kind 35 brand: `value` = undefined, `key` = the [[HomeObject]] node id. That
  is the class prototype for instance methods/accessors, or the constructor's
  kind-2 backing for static ones (`classSetHome` stores `objectView(home).x`;
  `add_brand` uses the same view).
- Invariant: `value.y` of kinds 2 and 8 is written only by `privateAdd`.
  - All allocations start it at 0.
  - No code copies a whole kind-2 node or rewrites its `value`. I checked every
    `.value=V(` and `.kind=` write; all are on property or cell nodes.
- Lookup is own-only: `privateFind` never walks the prototype chain. `privateAdd`
  enforces uniqueness and reports status 4 (TypeError) if the `(kind, key)` pair
  is already present. Key 0 never matches.
- Ordinary-key paths walk `heap[holder].next` and never see the chain. These
  are findProperty, own keys, for-in, JSON, spread, freeze, seal,
  preventExtensions, hasOwnProperty and `in`.
- `privateAdd` ignores `[[Extensible]]`.

Opcode stack contracts (these match QuickJS):
- `get_private_field obj name -> v`
- `put_private_field obj v name ->`
- `define_private_field obj name v -> obj`
- `add_brand obj home ->`: a no-op for a non-object `obj`, which covers QuickJS's
  `dup null swap add_brand`
- `check_brand obj fn -> obj fn`
- `private_in obj (name|closure) -> bool`

GC (`collect()`):
- A kind 2/8 holder marks `value.y`; the rest of the chain is reached via `next`.
- Kind 34 marks its value and its `key`; kind 35 marks its `key`.
- Marking the brand's home keeps a detached prototype's id from being reused.
  The fixture "stale private name and brand ids are never reused while an
  instance holds them" catches a regression of either key mark.
- Collection runs only at instruction boundaries (`freeCount<192`).

## Audit checklist → fixtures

| Requirement | Result | Fixtures (`phase4-next-w4-cases.js`) |
|---|---|---|
| Ordinary keys never see private fields (keys, gOPN, for-in, JSON, hasOwnProperty, `'#p' in`, spread) | OK | ordinary key paths…, object spread copy…, private, public and string "#x" keys…, private methods are not prototype own keys |
| freeze/seal/preventExtensions do not block writes | OK | sealed and non-extensible instances… (+ lead freeze fixture) |
| Return override adds to frozen / non-extensible objects | OK (ES2025) | return override adds a private field to a frozen object, …brands a non-extensible object, public field TypeError on a frozen override… |
| Object.assign | not used: `Object.assign` is not implemented on the GPU; covered by spread | — |
| Brand-check TypeErrors (get/set/in; `#x in` primitive) | OK | #x in throws TypeError for every primitive…, private set on a primitive and on null…, private fields are own…, #x in on functions…, uncaught #x in a primitive |
| Reading before initialization | OK (D2 integrated) | reading a later private field…, uncaught read of a later private field, 3 D2 regression fixtures |
| Double initialization via return override | OK, including spec order | brand failure on re-stamp…, field re-stamp evaluates the initializer…, uncaught double initialization… |
| Compound / update / destructuring / for-in-of targets | OK | compound assignment operators…, update expressions…, array and object destructuring…, rest destructuring…, for-of and for-in heads…, destructuring into a foreign private field… |
| `??=`, `&&=`, `\|\|=` incl. short circuit on getter-only/methods | OK | logical assignment operators…, short-circuited logical assignment… |
| Accessor pair under compound/update/destructuring | OK | getter/setter pair under compound… |
| Optional chain `o?.#x`, `o?.#m()`, `o?.a?.#x` | OK | optional chains through private names |
| Early errors (`delete this.#x`, `delete this?.#x`, undeclared, `super.#x`, duplicates, `#constructor`, object literal, `o in #x`) | SyntaxError in V8, native and Wasm compilers | `w4RejectedCases` (13) |
| Nested classes / shadowing | OK | nested class shadows…, nested class mixes outer and inner… |
| Closure capture across evaluations | OK | closures capture the private name…, a class body evaluated in a loop…, two class evaluations stamp the same object… |
| Static privates / function objects | OK | static private field on the class constructor, return override stamps arrow, bound and class functions, …an Error object, …intrinsic objects, static private field holds the only reference to a function |
| GC | OK by review; heap-pressure fixtures | 6 `gc: true` fixtures |
| Before/after `super()` | OK | private access on this before super() is a ReferenceError, arrow created before super()… |
| Function naming | OK (D1 integrated) | 3 D1 regression fixtures |
| Setter-only `#s in o` | OK (D3 integrated) | setter-only private accessor answers #s in o by brand |

## Remaining integration requests to the lead

1. Register the w4 records in `phase4-case-groups.js` / `phase4-suite.js`, e.g.
   `['n-w4-private', 'class-private', 'value', w4Cases]`, plus negative,
   unsupported and rejected groups. All value fixtures are now ordinary.
2. Proposed resumption records (`phase4ResumptionIds`):
   - `n-w4-private:getter/setter pair under compound, update and destructuring writes`
   - `n-w4-private:static initializers and blocks reach instance private names`
   - `n-w4-private:linked list threaded only through private fields survives collections`
3. For `gc: true` records, have `browser-phase4.js` assert
   `result.collections.every(n => n > 0)`, as `browser-secondwave-review.js`
   does. This is stricter, not looser.
4. Port the comment corrections above.
5. M1/Safari: none of the new WGSL (D1, D2, the b=1 get path) has been compiled
   or run on a GPU.

## Phase 3 (Symbols) hooks

- Private names are not Symbols. Tag 17 values keep getting status 2 from
  `privateName()`; only the tag-6 TDZ marker is tolerated (`privateNameOrAbsent`).
- `set_name_computed` checks for a private name first. Phase 3's
  `[description]` symbol naming goes in the `else` branch.
- `Object.getOwnPropertySymbols` and `Reflect.ownKeys` need no change.
- Proxy (Phase 6): no tunnelling. A Proxy representation must not reuse
  `value.y` of kinds 2/8.
