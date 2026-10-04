# Symbol protocols (phase 3, assignment 3)

Host model only. This directory does not edit `shader.js`, `program.js`, `bootstrap.js`, or phase 4. Phase 3 is not complete.

## Identity seam (assignment 1)

Duplicated in `well-known.js` (`isSymbolCell`, `sameSymbolValue`, `symbolKeyFor`) so this module runs alone.

A symbol cell is `{ tag: "symbol", uniqueIdentity, description, registryKey, nodeId, name }`. `uniqueIdentity` is an integer `>= 1`. `sameSymbolValue` compares `uniqueIdentity` only. Well-known cells set `registryKey` to `null`, so `symbolKeyFor` returns `undefined`. They are not registry keys.

`uniqueIdentity` equals the fixed node id (31..45). Assignment 1 must not mint 31..45 for `Symbol()` or a registry entry.

## Key seam (assignment 2)

Duplicated as `stringPropertyKey` / `symbolPropertyKey` / `isPropertyKey`.

A property key is `{ kind: "string", value }` or `{ kind: "symbol", id }` where `id` is `uniqueIdentity`. OwnPropertyKeys order remains integer indices, then strings, then symbols. `@@toStringTag` and `@@iterator` are symbol keys, so they belong in the symbol region. This module does not sort keys and does not choose the WGSL key bit pattern (`symbol-protocols.wgsl` takes the encoded `u32` as an argument).

## Fixed nodes

Named fixed identities in the current shader stop at 25. `collect` roots `root<=25u` (`shader.js`). `program.js` `packProgram` capture type 6 stays: Math is `add([6, 23, 0, 0])`, JSON is `add([6, 25, 0, 0])`. Do not move 23, 24, or 25.

| Node | Owner | Role |
|---|---|---|
| 23 | existing | Math ordinary object |
| 24 | existing | Number constructor |
| 25 | existing | JSON ordinary object |
| 26 | other worker | Symbol constructor |
| 27 | other worker | Symbol.prototype |
| 28 | other worker | symbol registry |
| 29 | other worker | BigInt constructor |
| 30 | other worker | BigInt.prototype |
| 31 | this assignment | `@@asyncIterator` |
| 32 | this assignment | `@@hasInstance` |
| 33 | this assignment | `@@isConcatSpreadable` |
| 34 | this assignment | `@@iterator` |
| 35 | this assignment | `@@match` |
| 36 | this assignment | `@@matchAll` |
| 37 | this assignment | `@@replace` |
| 38 | this assignment | `@@search` |
| 39 | this assignment | `@@species` |
| 40 | this assignment | `@@split` |
| 41 | this assignment | `@@toPrimitive` |
| 42 | this assignment | `@@toStringTag` |
| 43 | this assignment | `@@unscopables` |
| 44 | this assignment | `@@dispose` |
| 45 | this assignment | `@@asyncDispose` |
| 46 | this assignment | well-known table, heap kind 21 |

No source file names a fixed identity `>= 26`. Nodes 31..45 are therefore the dense cell block. Heap kind 21 is unused in `shader.js` (kinds 0..16 are live; 17..20 and 22..23 are other phase-3 reservations; 24..39 are not used here). Tags 17 and 18 are consumed as the symbol and bigint value tags and are not allocated as new tag numbers.

`createWellKnownTable()` returns a frozen `{ cells, byName, byId, fixedNodes, tableNode: 46, heapKind: 21 }`. Descriptions are `Symbol.<name>`. `Symbol.metadata` is not created.

Pinned `vendor/quickjs-atom.h` has atoms for every name above except `dispose` and `asyncDispose`. Those two cells still exist and are marked defined but not yet dispatched.

## Builtin ids actually used (1100..1149)

| Id | Name | Role |
|---|---|---|
| 1100 | `symbolToPrimitive` | `Symbol.prototype[@@toPrimitive]` |
| 1101 | `functionHasInstance` | `Function.prototype[@@hasInstance]` (OrdinaryHasInstance) |
| 1102 | `arraySpeciesGetter` | `get Array[@@species]`, returns `this` |
| 1103 | `stringIterator` | `String.prototype[@@iterator]` |

`Array.prototype[@@iterator]` is not a new id. It is the same function object as `Array.prototype.values`, builtin **334** (`300 + arrayBuiltins.indexOf("values")`). The test locks that index.

`dataProperty` flags (`shader.js`: `marked = flags << 1`): bit0 writable, bit1 enumerable, bit2 configurable.

## Signatures

```
createWellKnownTable() -> frozen table
isSymbolCell(value) -> boolean
sameSymbolValue(a, b) -> boolean
symbolKeyFor(cell) -> string | undefined
stringPropertyKey(value) -> { kind: "string", value }
symbolPropertyKey(id) -> { kind: "symbol", id }

ToPrimitive(value, preferredType) -> primitive
  preferredType: "number" | "string" | "default" | undefined
  undefined and "default" pass hint "default" and then use the number order
symbolToPrimitive(cell, hint) -> the same symbol cell (hint ignored)
toNumberSymbolThrows(value) -> boolean   // ToNumber(symbol) is TypeError
toNumberBigIntThrows(value) -> boolean   // ToNumber(bigint) is TypeError
Unsupported                           // bigint wrapper, not a TypeError

objectToString(value, getProperty) -> "[object ...]"
builtinTag(value) -> "Undefined" | "Null" | "Array" | "String" | "Arguments"
  | "Function" | "Error" | "Boolean" | "Number" | "Date" | "RegExp" | "Object"
mathAndJsonTags() -> { math, json } each { nodeId, descriptor }

resolveIteratorMethod(obj, getMethod) ->
  { mode: "call-method", methodId } | { mode: "type-error", message }
intrinsicIteratorFastPath(methodId, brand) -> "array" | "string" | null
```

`getProperty(value, symbolKey)` and `getMethod(obj, symbolKey)` are Get. Null and undefined do not call them for `toString` or `GetIterator`.

Values accepted by `ToPrimitive`: `null`, `undefined`, boolean, number (binary64, `-0` and `NaN` preserved), string, symbol cell, bigint limb-ref `{ tag: "bigint", limbs }`, or `{ tag: "object", brand, methods, symbols }`. `methods.toString` / `methods.valueOf` are the ordinary string keys. `methods.toPrimitive` and `symbols[41]` are `@@toPrimitive`, not a string property. A method that returns an object is skipped for the ordinary path. If both fail, `TypeError` (`Cannot convert object to primitive value`). A present non-callable `@@toPrimitive` throws `TypeError` and does not call `valueOf`. An exotic method that returns an object throws that same `TypeError`.

There is no Date brand in the engine (`program.js` has no Date capture, `shader.js` has no Date kind). `ToPrimitive` does not special-case brand `"Date"`. String order is used only when `preferredType` is `"string"`. A bigint primitive is returned unchanged. A `{ brand: "BigInt" }` wrapper with no own `@@toPrimitive` throws `Unsupported` and is not passed to `ToNumber`. `toNumberBigIntThrows` is false for that wrapper.

`objectToString` returns `[object Undefined]` / `[object Null]` before Get. Otherwise a string from Get wins over the builtin brand, including an override on an array. A non-string (number, symbol, object, null, undefined) falls back. Math and JSON are brand `Object`. They read `[object Math]` / `[object JSON]` only when Get returns `"Math"` / `"JSON"`. Brand `"Date"` or `"RegExp"` is honored if the caller sets it; the engine never does. Kind 16 uses the wrapped primitive's brand when the tag property is absent. Kind 7 Array, kind 8 Error, kind 14 Arguments, tags 5 and 11 Function.

No iterator-result helper is exported. Phase 4's record is `{ kind, index, object }` (`phase4-iteration.js`). A guest-visible result, when one is needed, is an ordinary object with string keys `value` and `done`.

## iterationKind rule (opcode 1273 and Open 1270)

Do not edit `phase4-iteration.js`. Parent applies this to `iterationKind` and `__lanesIteratorOpen` (1270). `spreadAppend` trusts kinds 1 and 2 today and must use the same rule.

ES `GetIterator` always calls the method `GetMethod` found. `resolveIteratorMethod` therefore returns only `call-method` or `type-error`. It never returns phase-4 kind 1 or 2.

Kind 1 (array / arguments) or kind 2 (string) is allowed only as a fast path after that lookup, and only when `intrinsicIteratorFastPath` says so:

- method id **334** and brand `Array` or `Arguments` → `"array"` (kind 1)
- method id **1103** and brand `String` → `"string"` (kind 2)

An own or inherited override, including on an array, is `call-method` with the override's id. `intrinsicIteratorFastPath` returns `null`. The fast path must not run. A missing `@@iterator`, or a non-callable one, is `TypeError` (`mode: "type-error"`). It is not an empty iteration and not status 6. Null and undefined stay `TypeError` (today's kind 4) because Get throws before a method exists; `resolveIteratorMethod` does not call `getMethod` for them. Map and Set have no heap brand here, so they have no fast path.

`loadIteratorMethod` in the WGSL fragment only loads the method id. It does not return kind 1 or 2.

## toStringTag bridge replacement

Current bridge, left in place by this assignment:

1. `bootstrap.js` `privateBuiltins.__lanesObjectToString` is **155**.
2. `program.js` `objectBuiltins` index 5 is `toString`, installed as id `150+5` = **155**. That is the same arm.
3. `shader.js` `objectMethod` (`fn objectMethod`), branch `if(id==155u)`. The comment begins "Until Symbol keys land, preserve the intrinsic Math @@toStringTag". The loop walks `heap[tagCurrent].value.x`. Node 23 returns `image[fieldKey(F['[object Math]'])]`. Node 25 returns `F['[object JSON]']`. Otherwise a `switch` on `receiver.z` / heap kind selects the builtin tag string.
4. `secondwave-review-cases.js` `json-tag-inheritance` expects `Object.prototype.toString.call(JSON)` and `Object.prototype.toString.call(Object.create(JSON))` to both be `[object JSON]`. `phase3/conformance/programs.js` sentinels expect `[object Math]` and `[object JSON]`.
5. `array-phase5-source.js` `toStringBootstrap` calls `__lanesObjectToString` when `join` is not a function. It picks up whatever id 155 does.

Replacement, parent wiring, using `objectToString(value, getProperty)` and `mathAndJsonTags()`:

1. Install the descriptors from `mathAndJsonTags()` on nodes 23 and 25. The property value is the bare string `"Math"` or `"JSON"` (`F.Math` / `F.JSON`), **not** the bracketed image strings `F['[object Math]']` / `F['[object JSON]']`. Attributes: writable false, enumerable false, configurable true, `dataProperty` flags **4** (`marked` 8). Key is the symbol key for node 42.
2. In `objectMethod` id 155, delete the node 23 / 25 chain walk. Get `@@toStringTag` (assignment 2's key) with the same prototype walk `getProperty` already uses. If the result is a string (tag 7), return the concatenation `"[object " + tag + "]"`. A string tag wins over the builtin brand. That is what keeps `[object Math]` and `[object JSON]`, including objects that inherit the data property (`Object.create(JSON)`).
3. If Get returns a non-string, keep the existing brand switch (Undefined, Null, Number, Boolean, String, Function, Array kind 7, Error kind 8, Arguments kind 14, wrapper kind 16, else Object). Do not keep the node 23/25 special case, or a deleted tag would still report Math/JSON.
4. Null (tag 2) and undefined (tag 3) return before Get, as they do now.
5. `arrayToString` does not need a new id.

`ownKeys` still returns status 6 for object ids 20..25 (`shader.js` `ownKeys`). Installing the tag property does not by itself make `Object.keys(Math)` work. `toString` uses Get, not `ownKeys`.

## Math / JSON descriptors

```
mathAndJsonTags().math = { nodeId: 23, descriptor: { key: {kind:"symbol", id:42}, value:"Math", writable:false, enumerable:false, configurable:true, flags:4 } }
mathAndJsonTags().json = { nodeId: 25, descriptor: { key: {kind:"symbol", id:42}, value:"JSON", writable:false, enumerable:false, configurable:true, flags:4 } }
```

Capture type 6 for Math and JSON stays.

## Other protocol tables (`PROTOCOL_PROPERTIES`)

Dispatch is parent wiring. Call sites in core were not edited.

| Symbol | Where | Id | State |
|---|---|---|---|
| `@@iterator` | `Array.prototype` node 2 | 334, same as `values` | property table ready; values body is not a real iterator |
| `@@iterator` | `String.prototype` node 20 | 1103 | defined but not yet dispatched |
| `@@iterator` | arguments kind 14, own property | 334 | `argumentsObject` does not install it yet |
| `@@unscopables` | `Array.prototype` node 2 | data, flags 4 | names match host Node and pinned QuickJS (`at` through `values`, no `with`). No `with` opcode |
| `@@hasInstance` | `Function.prototype` node 3 | 1101, flags 0 | `instanceOf` does not Get the method. Call an override; run today's `instanceOf` only when the method id is 1101 |
| `@@isConcatSpreadable` | not installed | — | missing on an array means spreadable. `concat` is not implemented (`array-phase5-metadata.js`) |
| `@@species` | `Array` node 18, accessor flags 4 | getter 1102 | `array-phase5-source.js` `create` returns Unsupported before reading the symbol. No RegExp / Promise / Map / Set / TypedArray constructors |
| `@@toPrimitive` | `Symbol.prototype` node 27 (other worker) | 1100, flags 4 | algorithm is `symbolToPrimitive` |
| `@@toStringTag` | `Symbol.prototype` node 27 | value `"Symbol"`, flags 4 | no builtin Symbol brand in `toString` |

`@@match`, `@@matchAll`, `@@replace`, `@@search`, `@@split` have cells only. `string-search-source.js` does not consult `@@match`.

## WGSL

`symbol-protocols.wgsl` is a fragment: well-known node constants, kind 21 table check, bounds-checked `findSymbolProperty`, `lookupToStringTag`, `loadIteratorMethod`. Loops are capped by `heapLimit`. No function calls itself. `INTEGRATION_GAPS` records the symbol-key encoding, GC root, `objectView`, accessor high bit, and the id 155 replacement.

## GC and init conflict

`shader.js` init (`ready==0`) allocates nodes 1..25 as the named intrinsics, then three kind-13 holders for the string / number / boolean prototype primitives (today's nodes 26, 27, 28), then data properties. Those holders are not named fixed identities, but they are the next `alloc`s. `phase3/conformance/INVENTORY.md` records "Nodes 26..28 are not free" and that later init allocs occupy higher ids. This assignment still reserves 31..46, because nothing names those ids and the other workers already own 26..30. Parent must **insert** the fixed allocs for 26..46 immediately after the JSON object (node 25) and **before** the kind-13 holders, without moving nodes 23..25. Extending `collect`'s `root<=25u` loop before those objects exist would pin free-list slots. After the allocs exist, the root loop must include 26..46 or the cells and the kind-21 table are swept. Kind 16 already marks the holder in `value.y`; moving the holders to new ids is safe if that link is unchanged.

`ownKeys` on nodes 20..25 stays status 6 until assignment 2 teaches it symbol keys. A symbol key must not reuse the `0x80000000` index bit (`arrayIndex` / `keyName`).

## Tests

Command (host `node:test` only, no GPU, no Wasm rebuild):

```
node --test experiments/quickjs-runtime/phase3/symbol-protocols/symbol-protocols.test.js
```

Result: exit 0. 11 passed, 0 failed. Node v26.9.0.

```
✔ well-known symbols are pairwise distinct and keyFor-equivalent undefined
✔ ToPrimitive number/string/default order
✔ @@toPrimitive override and TypeError when it returns an object
✔ hint default vs string
✔ symbol primitive ToPrimitive returns the same identity
✔ toStringTag string override
✔ Math and JSON tags "[object Math]" and "[object JSON]"
✔ absent tag falls back to [object Object]
✔ array with overridden @@iterator does not report the default mode
✔ missing @@iterator is TypeError
✔ wgsl constants match the fixed node and builtin ids
```

The distinctness test uses host `Symbol.keyFor(Symbol[name]) === undefined` and `Symbol.for("iterator") !== Symbol.iterator` as an oracle. Implementation modules do not call host `Symbol`.

## Pending

Defined cells, not dispatched at an engine call site: `asyncIterator`, `match`, `matchAll`, `replace`, `search`, `split`, `species`, `isConcatSpreadable`, `unscopables`, `dispose`, `asyncDispose`, `hasInstance`. Iterator method bodies (334 and 1103) are not implemented. `BigInt.prototype[@@toPrimitive]` is not implemented (wrapper throws `Unsupported`). No `Date.prototype[@@toPrimitive]`. No Map or Set. `Symbol.metadata` is omitted.

Parent still has to allocate nodes 31..46, install the descriptors, replace `objectMethod` id 155, and teach opcodes 1273 / 1270 the rule above. Until that lands, guest `Object.prototype.toString` on Math and JSON still uses the temporary bridge, and an `@@iterator` override still takes the intrinsic fast path.

Phase 3 is not complete.
