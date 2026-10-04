# Symbol identity contract (phase 3, assignment 1)

Phase 3 is not complete. This directory is the symbol-identity slice only: the guest cell, the global registry, the constructor factory, and a WGSL fragment the parent has not spliced. BigInt, symbol property keys, well-known protocols, and the object model stay with their owners. Shared core (`program.js`, `shader.js`, `bootstrap.js`) was not edited.

## Files

| File | Role |
| --- | --- |
| `experiments/quickjs-runtime/phase3/symbol-identity/symbol-cell.js` | Pure guest cell and registry. No host `Symbol` call. |
| `experiments/quickjs-runtime/phase3/symbol-identity/symbol-builtins.js` | Builtin factory, ids 1000..1006, and the JS dispatch. |
| `experiments/quickjs-runtime/phase3/symbol-identity/symbol-identity.wgsl` | Unspliced WGSL fragment. Guest-heap registry. |
| `experiments/quickjs-runtime/phase3/symbol-identity/symbol-identity.test.js` | `node:test`. Host `Symbol` appears only in this file, as the differential oracle. |
| `experiments/quickjs-runtime/phase3/symbol-identity/CONTRACT.md` | This file. |

## Identifiers actually used

| Resource | Value | Notes |
| --- | --- | --- |
| Value tag | 17 | Guest symbol. Tag 18 stays with BigInt. |
| Heap kind | 17 `SYMBOL_CELL` | `Node.value = V(id, descNode, registryKeyNode, flags)`. |
| Heap kind | 18 `SYMBOL_REGISTRY` | One node. Count, next id, list head, capacity. |
| Fixed node | 26 | Symbol constructor. Kind 2. `[[Prototype]]` is node 3 (Function.prototype). |
| Fixed node | 27 | Symbol.prototype. Kind 2. `[[Prototype]]` is node 1 (Object.prototype). |
| Fixed node | 28 | Symbol registry. Kind 18. Not a guest object. |
| Builtin ids | 1000..1006 | See the table below. 1007..1049 are unused and unclaimed. |

No id in 1000..1049 was already a builtin id in `shader.js`, `program.js`, `bootstrap.js`, or the other phase-3 modules read here. Ids were not renumbered. Nodes 23 (Math), 24 (Number constructor), and 25 (JSON) are untouched. Capture type 6 stays Math/JSON. Symbol is capture type 4, builtin id 1000.

Kinds 19..23, nodes 29+, builtin ids 1050..1199, 1200..1399, 1400..1819, and 2000..2199 are not claimed.

### Builtin table

Each `symbolBuiltins` entry is `{ id, name, length, arity, attributes, wgslHookName, specNote }`.

| id | name | length | arity | attributes | WGSL hook |
| --- | --- | --- | --- | --- | --- |
| 1000 | `Symbol` | 0 | 1 | writable, configurable, data flags 5 | `symbol_construct` |
| 1001 | `for` | 1 | 1 | same | `symbol_for` |
| 1002 | `keyFor` | 1 | 1 | same | `symbol_key_for` |
| 1003 | `toString` | 0 | 0 | same | `symbol_prototype_to_string` |
| 1004 | `valueOf` | 0 | 0 | same | `symbol_prototype_value_of` |
| 1005 | `description` | 0 | 0 | accessor, configurable, no setter, data flags 4, getter high bit | `symbol_prototype_description` |
| 1006 | `typeof` | 0 | 1 | dispatch-only, not a guest property | `symbol_typeof` |

`Symbol.prototype` on node 26 uses `symbolPrototypePropertyAttributes`: writable false, enumerable false, configurable false, data flags 0. The prototype `constructor` property reuses id 1000. Kind-9 description getter stores `value.x = 0x80000000 | 1005` and `value.y = 0`.

`SYMBOL_BUILTIN_IDS` names the same seven ids: `construct`, `for`, `keyFor`, `toString`, `valueOf`, `description`, `typeof`.

## Bounds

| Constant | Value | Overflow |
| --- | --- | --- |
| `MAX_UNIQUE_SYMBOL_ID` | `0xFFFFFFFF` | Next id becomes 0. 0 is exhausted. Further `createSymbol` / `symbolFor` throws status 3 `symbol identity space exhausted`. No wrap to 1. |
| `MAX_REGISTRY_ENTRIES` | 1024 | Checked before a new cell is allocated. Status 3 `symbol registry capacity exhausted`. A failed intern does not consume an id. |
| `MAX_DESCRIPTION_UNITS` | 256 | Input and `SymbolDescriptiveString` (`8 + description` UTF-16 units). Status 3 `GPU string limit: 256 UTF-16 code units`. |

`createSymbolRealm({ maxUniqueSymbols, maxRegistryEntries, initialNextId })` can only lower the registry cap (it cannot exceed 1024). `initialNextId` is a host-model seam so tests can reach the u32 sentinel. It is not a guest opcode. `0` means already exhausted.

Flags: bit 0 `SYMBOL_FLAG_HAS_DESCRIPTION` (1), bit 1 `SYMBOL_FLAG_IN_REGISTRY` (2).

## Exported signatures

`symbol-cell.js`:

- `createSymbolRealm(options?) -> realm`
- Realm and module: `createSymbol(description) -> cell` — `description` is a string or `null`. `undefined` is rejected here; the constructor converts `undefined` to `null` first.
- Realm and module: `symbolFor(keyString) -> cell` — key is already a string. Canonical per key. `Symbol.for("x")` is the same cell on a later call and is a different cell from `createSymbol("x")`. `Symbol.for("")` has description `""` and is distinct from both `createSymbol("")` and `createSymbol(null)`.
- `symbolKeyFor(cell) -> string | null` — `null` is the spec `undefined` result. Unique symbols return `null`. A non-symbol throws `{ tag:'TypeError', name:'TypeError', message:'not a symbol', status:4 }`.
- `sameValueSymbols(a, b) -> boolean` — `uniqueIdentity !== 0`, equal ids, and equal realm brand. Description is ignored. Number SameValueZero is not defined in this module.
- `typeofSymbol(cell) -> "symbol"` — non-symbol throws the same TypeError.
- `symbolDescriptiveString(cell) -> string` — absent and `""` both yield `Symbol()`. Otherwise `Symbol(` + description + `)` with no JSON escaping.
- `assertCallableAsConstructor() -> throws` — message `Symbol is not a constructor`, status 4.
- `symbolPrimitiveValue(cell) -> cell` — `@@toPrimitive` / `valueOf` hook. Non-symbol throws.
- `isSymbolCell(value) -> boolean`
- `resetSymbolRealm(options?) -> realm` — replaces the module-level realm used by `createSymbol` and `symbolFor`.
- `typeError(message)`, `resourceLimit(message)`, `unsupported(message)` — plain thrown objects, not `Error` instances. Statuses 4, 3, and 6.
- `inspect()` on a realm: `{ nextIdentity, issued, registrySize, registryKeys, identities, maxUniqueSymbols, maxRegistryEntries, liveCells }`.

A cell is frozen: enumerable `uniqueIdentity`, `description` (`null` or string), `registryKey` (`null` or string), `tag` 17, and a non-enumerable realm `brand`.

`symbol-builtins.js`:

- `symbolConstruct(realm, description, newTarget) -> cell` — `newTarget !== undefined` throws. `description === undefined` becomes an absent description. Any other non-string, including `null`, throws `Symbol description must be a string or undefined`.
- `symbolForBuiltin(realm, keyString)`, `symbolKeyForBuiltin(realm, value)`
- `symbolPrototypeToString(realm, receiver)`, `symbolPrototypeValueOf(realm, receiver)`, `symbolPrototypeDescription(realm, receiver)` — description getter returns `undefined` when the cell description is `null`, otherwise the string.
- `symbolTypeofDispatch(tag)` — tag 17 returns `"symbol"`. Any other tag throws Unsupported.
- `dispatchSymbolBuiltin(realm, id, { argument, receiver, newTarget, tag })`
- Re-exports `symbolPrimitiveValue`, `typeofSymbol`, `SYMBOL_VALUE_TAG`.

## WGSL hooks

Fragment only. No compute entry point. Top comment block is titled `INTEGRATION_GAPS`.

`struct SymbolCell { id: u32, desc: u32, registry_key: u32, flags: u32 }` is a view of a kind-17 `Node`, not a second buffer. Guest symbol value is `V(cellNode, 0, 17, 0)`. Registry node 28 `value` is `V(count, nextId, headCell, 1024)`. `nextId` starts at 1. Empty description and empty registry key are length-0 kind-10 nodes so they stay distinct from a 0 (absent) reference. Image strings are copied onto the heap before they are stored.

Functions: `symbol_cell_from_node`, `symbol_mark_value`, `symbol_mark_cell`, `symbol_init_registry_fields`, `symbol_stored_unit`, `symbol_text_equals_node`, `symbol_copy_text`, `symbol_alloc_cell`, `symbol_value`, `symbol_create`, `symbol_intern_lookup`, `symbol_construct`, `symbol_for`, `symbol_key_for`, `symbol_same_value`, `symbol_this_symbol`, `symbol_primitive_value`, `symbol_prefix_unit`, `symbol_descriptive_unit`, `symbol_descriptive_string`, `symbol_typeof`, `symbol_prototype_to_string`, `symbol_prototype_value_of`, `symbol_prototype_description`, `symbol_fixed_node`.

Loops are bounded by `SYMBOL_STRING_LIMIT` (256), `SYMBOL_MAX_REGISTRY_ENTRIES` (1024), or 64 string chunks. No recursion.

Registry writes are heap stores: node 28 `value.x` (count), `value.y` (next id), `value.z` (list head), and the cell's `next` link. The JS `Map` is only the host image of that list. The GPU must not consult it.

## GC roots

Every live symbol cell and the registry must stay rooted in guest memory.

- Root fixed nodes 26, 27, and 28 for the realm lifetime. Node 28 roots every registered cell through the list head. `collect` already marks `node.next`, so the prepended list stays live once the head is marked.
- `markValue` must mark tag 17 (`symbol_mark_value`). A unique symbol is rooted only while a tag-17 value is reachable (stack, frame, env, or a property). The registry does not retain unique symbols.
- `symbol_mark_cell`: kind 17 marks the description head and the registry-key head; kind 18 marks the list head. Kind-10 chunk chains follow `node.next`.
- Ids are never recycled. A collected unique cell does not free its id.

The JS model keeps every cell in a module `WeakSet` plus the realm's cell array. That set is the host oracle's liveness, not a GPU root.

## Insertion points (parent; these files were not edited)

`program.js`

- `packProgram`, global-capture branch around lines 104–113. Next to `Number` (`add([4, 122, 0, 0])`), add `if (root && ref.name === 'Symbol') add([4, 1000, 0, 0])`. Type 4, not type 6.
- `fieldNames` / `FIELDS` (lines 40–44). `name`, `length`, `prototype`, `constructor`, `toString`, and `valueOf` already exist. Append `Symbol`, `for`, `keyFor`, and `description` when absent. `typeof` result `"symbol"` is a heap string from `symbol_typeof`, not a new `FIELDS` slot.
- `typeNames` (line 85) is `number, boolean, object, undefined, function, string`. Leave that order. The typeof opcode reads it through `params.padding`.

`shader.js`

- Paste the fragment functions before `main` (line 1280). Do not add a compute entry point.
- `main` init, immediately after `jsonObject` (line 1298) and before the three kind-13 holder allocs (lines 1299–1301): allocate node 26 kind 2 with prototype node 3, node 27 kind 2 with prototype node 1, node 28 kind 18 via `symbol_init_registry_fields`. Then `dataProperty` name `"Symbol"`, length 0, and prototype node 27 (flags 0) on node 26; `for` (1001) and `keyFor` (1002) as flags-5 data properties on node 26; `constructor` (1000), `toString` (1003), and `valueOf` (1004) as flags-5 data properties on node 27; description as a kind-9 accessor (getter `0x80000000 | 1005`, no setter, configurable). `objectView` (line 255) maps builtin 1000 to node 26. `objectValue` (line 263) maps node 26 back to `V(1000, 0, 11, 0)`.
- Holder shift: today those allocs occupy slots 26, 27, and 28 (`stringProto.value.y`, `numberProto.value.y`, `booleanProto.value.y`). `shader.js` does not hardcode 26, 27, or 28. See Conflicts for why the holders must not land on 29+.
- `collect` (line 110): change `root<=25u` to `root<=28u`. Inside the queue walk, call `symbol_mark_cell` for kinds 17 and 18. `markValue` (line 108) must call `symbol_mark_value` so tag 17 is marked. Kind 16 already marks `value.y`, which is how the shifted holders stay live from nodes 20–22.
- `equal` (line 78): before `return true` (line 83), tag 17 must use `symbol_same_value`. `sameValue` (line 251) delegates to `equal` except for numbers. Leave number equality, including SameValue of NaN and −0/+0, unchanged.
- `objectMethod` (line 1049): ids 1000..1006 must be dispatched before `if (id>=150u)` (line 1155), which currently returns status 6. `call` (line 687) already sends tag-11 ids `>= 100` into `objectMethod` (line 792). Wire 1000 `symbol_construct`, 1001 `symbol_for`, 1002 `symbol_key_for`, 1003 `symbol_prototype_to_string`, 1004 `symbol_prototype_value_of`, 1005 `symbol_prototype_description`. Id 1006 is the typeof opcode, not an `objectMethod` property.
- `construct` (line 804): unknown builtin ids fall through to status 6 at line 831. `callee.x == 1000u` must call `symbol_construct(l, true, description)` so the status is 4. The status-4 epilogue still builds `Invalid operation` through `makeError`. The JS model keeps the spec message `Symbol is not a constructor`.
- `typeof` opcode (line 1556): when `v.z == 17u`, push `symbol_typeof(l, v)`. Do not insert a seventh name into the six-entry table.
- `ownKeys` (line 992): the incomplete-prototype gap is `object.x>=20u && object.x<=25u` (line 1002). Extend that gap to nodes 26 and 27. Reject kind 18 (node 28 is not a guest object).
- `keyOf` (line 201) returns status 6 for a non-string, non-index key. Leave it. Symbol property keys are kind 20, owned by the symbol-keys worker.
- Builtin 155 (line 1127), the temporary `@@toStringTag` bridge for Math (node 23) and JSON (node 25): leave it in place. The comment there says symbol integration must replace the bridge; this assignment does not. The protocols worker owns that replacement. Cells still store `uniqueIdentity` and `description` so a later real symbol key can be attached.

`bootstrap.js`

- No new guest source. `privateBuiltins` and `bootstrapSources` should not gain a function that mentions the host `Symbol`. Line 32 records that symbols remain unsupported until the parent wires the hooks. `ToString` of a non-string `Symbol` / `Symbol.for` argument stays a resumable guest step (builtin 134, `toText`) in front of these hooks.

## Implemented

- Unique symbols: monotonic ids from 1, not interned by description. `Symbol("a")` and another `Symbol("a")` differ. Absent description and `""` differ as cells and share the descriptive string `Symbol()`.
- `Symbol.for` canonical per key, including `""`. Distinct from unique symbols with the same description. Re-lookup does not reorder the list or consume an id.
- `Symbol.keyFor`: string for a registered symbol, `null` (spec undefined) for a unique symbol, TypeError `not a symbol` otherwise.
- `typeof` tag 17 is `"symbol"`.
- SameValue for symbols is identity (id plus realm brand in JS; heap node plus stored id in WGSL).
- `SymbolDescriptiveString` without JSON escaping. Quotes, backslash, newline, tab, emoji, and an unpaired surrogate are copied through.
- `new Symbol` throws TypeError. Constructor call with `undefined` or a string succeeds.
- `toString`, `valueOf`, and `description` on a non-symbol throw TypeError. `valueOf` and `symbolPrimitiveValue` return the cell. The description getter is an accessor.
- Registry and identity overflow throw a resource-limit object (status 3). They do not wrap and do not insert a partial record.
- Cross-realm cells with the same numeric id are not SameValue.
- Explicit failures where the spec would continue: non-string arguments (`ToString` is not approximated; `Symbol(null)` does not become `"null"`), symbol wrappers, unknown builtin ids, and `typeof` of a tag other than 17.

## Pending

- Splicing the fragment and the capture / `FIELDS` / init / GC / `equal` / `objectMethod` / `construct` / `typeof` / `ownKeys` edits listed above.
- `ToString` of constructor and `Symbol.for` arguments. WGSL sets status 6 for a non-string (tag 3 is absent only for `symbol_construct`). The JS constructor throws TypeError for a non-string other than `undefined`.
- Custom TypeError text on the GPU. Status 4 still surfaces as `Invalid operation` until the parent keeps the message.
- `@@toPrimitive` installation. Hook is `symbolPrimitiveValue` / `symbol_primitive_value`. Well-known symbols are not created here and no string-named stand-in is installed.
- `@@toStringTag` on `Symbol.prototype` (`"Symbol"` on the host). Builtin 155 is unchanged. `Symbol.prototype[@@toStringTag]` is pending the protocols worker.
- Symbol object wrappers. `thisSymbolValue` accepts a primitive tag-17 value only.
- Symbol property keys, `keyOf` of a symbol, and `OwnPropertyKeys` order that includes symbols.
- Registry larger than 1024 entries, and descriptive strings longer than 256 UTF-16 units. Both are resource limits. The host allows both.
- `ENGINE_HAS_SYMBOL` in `phase3/conformance/boundaries.js` remains false until the parent wires the shader. This module does not flip it.
- Guest execution of these operations on GPU. The node tests exercise the pure model and the shape of the fragment. They do not launch Dawn, WebGPU, or a Wasm rebuild.

## Conflicts

- Fixed slots 26..28 are free as names and occupied as the next `alloc` results. Current init puts the String, Number, and Boolean primitive holders there. Claim stands: named nodes 26, 27, 28, allocated after node 25 and before those holders, with GC roots extended to 28.
- Moving the holders by allocating only 26..28 first would make the holders nodes 29, 30, and 31. Those indices are already reserved by sibling workers: BigInt constructor 29 and prototype 30 (`phase3/bigint-bridge/builtins.js`), well-known symbols 31..45 and the well-known table node 46 (`phase3/symbol-protocols/well-known.js`). The parent init must allocate every reserved fixed node that this integration includes before the three kind-13 holders. Holders have no hardcoded indices. This module does not allocate 29+.
- Protocols documents well-known `uniqueIdentity` as the fixed node id 31..45 and says assignment 1 must not mint those identities. This counter is dense from 1, so the 31st ordinary symbol receives id 31. GPU `symbol_same_value` also requires the same heap node, so two different cells still compare false there. The protocols host helper `sameSymbolValue` compares `uniqueIdentity` alone. Parent wiring must keep ordinary ids and well-known ids disjoint (skip 31..45 in `allocId` / `symbol_alloc_cell`, or give well-known symbols a range outside this counter). This module does not create those cells.
- Protocols' local cell uses `tag: "symbol"` and `symbolKeyFor` returns `undefined`. This module uses numeric tag 17 and returns `null` for the undefined result, which is the encoding this assignment specified. The two records need an adapter at integration. They are not the same object.
- `phase3/conformance/CONTRACT.md` says node 26 is the String.prototype holder and that growing `root<=25` changes an existing GC root. Both statements describe today's shader. The reservation above is the assignment's resolution, and it is still unwired.
- Kind 17 and kind 18 were free in `shader.js` (kinds 0..16 are live). Kind 19 is BigInt limbs. Kind 21 is the well-known table. Kind 23 is unused and unclaimed. No kind was stolen.
- Builtin ids 1100..1103 (protocols) and 1150 (BigInt) sit outside 1000..1049. No overlap.

## Tests

Command, from the worktree root:

```
node --test experiments/quickjs-runtime/phase3/symbol-identity/symbol-identity.test.js
```

Result: exit 0. 16 tests, 16 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo. `duration_ms` 119.243133.

Node printed a warning that `NO_COLOR` is ignored because `FORCE_COLOR` is set. The tests themselves passed:

- constants reserve tag 17, kinds 17 and 18, and nodes 26..28
- unique symbols are not interned by description
- Symbol.for is canonical and distinct from Symbol(description)
- realms do not share identities or the registry
- descriptive strings match the host and do not JSON-escape
- typeof, valueOf and the primitive hook agree with the host on symbols
- keyFor, toString, valueOf and description reject non-symbols
- constructor call is not new, and new Symbol is a TypeError
- ToString of registry keys and descriptions is not approximated
- ids stay stable when later symbols and a failed overflow run
- registry and identity overflow do not wrap
- descriptive output shares the 256-unit guest string limit
- module-level registry follows resetSymbolRealm
- builtin table uses 1000..1006 and matches host length and attributes
- wgsl fragment has bounded guest-memory hooks and the integration gap list
- implementation files do not call the host Symbol constructor

The host oracle agrees on uniqueness, `Symbol.for` identity, `keyFor` of registered and unique symbols, `typeof`, equality, descriptive strings within the 256-unit cap, the constructor TypeError, and prototype TypeErrors on non-symbols. Cases the host would coerce (`Symbol(null)`, `Symbol.for(1)`) are asserted as explicit failures of this model. Descriptions of 249 or 256 units throw the resource limit here; the host can still `toString` them.
