# Symbol keys (phase 3, assignment 2)

Parent integrates. This directory does not edit `shader.js`, `program.js`, `bootstrap.js`, or phase 4. Phase 3 is not complete.

## Parent must implement

- Object spread `[[OwnPropertyKeys]]` includes symbol keys. Enumerable symbol keys are copied by `CopyDataProperties`. Non-enumerable symbol keys are not.
- `for-in` / `EnumerateObjectProperties` excludes symbol keys, even when enumerable.
- `iterationKind` (builtin 1273) is not this worker's job. The protocols worker owns `Symbol.iterator` behavior. Do not change 1270..1273 here.

## Allocations

| Resource | Decision |
|---|---|
| Value tag 17 | Not allocated. Identity worker: `SYMBOL_VALUE_TAG`. Guest symbol value is `V(cellNode, 0, 17, 0)` (`symbol_value` in `symbol-identity.wgsl`). |
| Value tag 18 | Not used. |
| Heap kind 20 `SYMBOL_KEY_SIDECAR` | Unused. Inline key. Do not allocate kind 20. |
| Heap kinds 17, 18, 19, 21, 22 | Not used. 17/18 are symbol cells and the registry. 21 is the protocols well-known table. |
| Fixed nodes | None. 23 Math, 24 Number, 25 JSON stay. 26..30 and 31..45 belong to other workers. |
| Builtin ids | **1050** only. 1051..1099 remain free. |
| Capture type 6 | Untouched. |

### Inline `Node.key` word

`shader.js` `Node.key` is one u32. `keyOf` / `arrayIndex` / `keyText` already use both high bits:

- bit 31 set: integer index `n | 0x80000000` for `n < 2^31` (`keyOf`)
- bits 31..30 == 01: dynamic string `heapId | 0x40000000` (`keyText`)
- else: image atom

`0xC0000000 | id` collides with indices `>= 2^30`. `uniqueIdentity` is a full u32 (`MAX_UNIQUE_SYMBOL_ID` in `symbol-cell.js`) and does not fit beside a tag.

The inline encoding stores the **kind-17 cell node** (`V.x` of a tag-17 value), which is `< L.heap` (2048), in the free bit-29 of the dynamic-string subspace:

```
packed = 0x60000000 | cellNode
cellNode = packed & 0x1fffffff     // 1 .. L.heap-1, heap[cellNode].kind == 17
uniqueIdentity = heap[cellNode].value.x   // nonzero
```

`packSymbolCellKey` / `isPackedSymbolKey` / `packedSymbolCellNode` in `symbol-key-builtins.js` are that word. SameValue compares `uniqueIdentity`, never the description and never the node index alone. `arrayIndex` must return `0xffffffff` for this pattern before `keyText`. `keyName` must not run on it.

Logical key, used by `property-key.js` and by `symbolPropertyKey` in `symbol-protocols/well-known.js`:

```
{ kind: "string", value: string } | { kind: "symbol", id: uniqueIdentity }
```

`id` 0 is invalid. `id` must be an integer in `1 .. 0xffffffff`.

## Signatures

`property-key.js`. Entries are a mutable array of `{ key, value, writable, enumerable, configurable, created }`. `created` is a u32 stamp (explicit insertion order). `entries.clock` is the next stamp. `entries.extensible === false` rejects new keys. Objects are `{ entries, parent }` with `parent` null or another object.

| Export | Behavior |
|---|---|
| `isIntegerIndex(string)` | Canonical array index: decimal, no leading zero except `"0"`, range `0 .. 2^32-2`. `"-0"`, `"-1"`, `"01"`, `"1.0"`, `"4294967295"` are false. |
| `compareOwnPropertyKeyOrder(a, b)` | Entries. Class order index, other string, symbol. Indices numeric. Else `created`. |
| `ownPropertyKeys(entries)` | OrdinaryOwnPropertyKeys. All attributes. |
| `defineOwn(entries, key, desc)` | OrdinaryDefineOwnProperty for data. Absent flags on a new key are false; absent value is undefined. `get`/`set` present throws `Unsupported`. Rejected definitions return false and do not move the entry. |
| `getOwn(entries, key)` | Own descriptor copy, or `undefined`. |
| `set(object, key, value)` | OrdinarySet, data only. New properties are writable, enumerable, configurable. |
| `deleteOwn(entries, key)` | Own only. Absent succeeds. Non-configurable fails. |
| `has(object, key)` | `[[HasProperty]]`, own or inherited, symbols included, enumerability ignored. |
| `enumerableOwnStrings(entries)` | `Object.keys` order. |
| `ownSymbols(entries)` | `Object.getOwnPropertySymbols`: every own symbol, insertion order. |
| `copyDataProperties(target, source, excludedIds)` | ES2025 7.3.25. `excludedIds` is a list of keys. Symbol exclusion is SameValue on `id`. `null`/`undefined` source returns `target`. |
| `stringKey` / `symbolKey` / `samePropertyKey` | Constructors and SameValue for keys. |
| `Unsupported` | Accessor rejection. Not a guest TypeError. |

`symbol-key-builtins.js`:

| Name | Id | Length | Integration |
|---|---|---|---|
| `Object.getOwnPropertySymbols` | **1050** `__lanesOwnPropertySymbols` | 1 | New `objectMethod` arm before the status-6 fallthrough. Array of `V(cellNode, 0, 17, 0)`, insertion order, including non-enumerable. No strings. |
| `Reflect.ownKeys` | extend opcode **1240** | 1 | No new id. |
| `HasProperty` | extend opcode **96** (`in`) | 2 | Also own-has builtin **107** (private 902 remapped in `objectMethod`) and method **151**. 107 is own-only. Opcode 96 walks `[[Prototype]]`. |
| `DefineOwnProperty` | extend opcode **34** (`define_field`) and builtin **110** | 3 | Builtin **101** calls the same `descriptor()`. |
| `DeleteProperty` | extend opcode **95** (`delete`) | 2 | Own only. |

## How opcode 1240 and for-in must change

### 1240 `__lanesOwnPropertyKeys`

Defined in `phase4-object-spread.js` (`objectSpreadPrivateBuiltins`, lines 30-38). Wired by:

```
if(id==1240u){return ownKeys(l,original,false);}
```

(`objectSpreadObjectMethodWGSL`, line 90). `copyDataPropertiesBootstrap` (lines 101-122) already walks that list, re-checks `enumerable`, and excludes with `__lanesOwnHas`. Once 1240 yields symbols and `sameKey` is symbol-aware, spread copies enumerable symbols and rest exclusion applies to them. Do not rewrite the helper to filter symbols out.

`fn ownKeys` (`shader.js` lines 990-1048) only counts `arrayIndex` vs other strings. Dispatch (`shader.js` line 1055):

```
if(id==140u||id==710u||id==716u){return ownKeys(l,original,id==716u||(id==140u&&truth(b)));}
```

One `enumerableOnly` boolean cannot say "symbols or not". Adding symbols whenever `enumerableOnly` is false would leak them into **710** `Object.getOwnPropertyNames`.

Required split:

| Caller | enumerable strings | all strings | symbols |
|---|---|---|---|
| **716** `Object.keys` | yes | no | no |
| **140** `__lanesOwnKeys(obj, true)` (`json-stringify-source.js` line 57) | yes | no | no |
| **710** `getOwnPropertyNames` | no | yes | no |
| **140** `__lanesOwnKeys(obj, false)` (`object-operation-source.js` lines 33, 54, 71: defineProperties, seal, freeze, isSealed, isFrozen) | no | yes | yes |
| **1240** | no | yes | yes |

Suggested shape: `ownKeys(l, original, enumerableOnly, includeSymbols)`. 1240 and 140-with-false pass `includeSymbols` true. 710, 716, and 140-with-true pass false. Symbol bucket is appended after strings, oldest-first, matching the newest-first property list (same reversal `ownKeys` already uses for named strings). Do not `keyName` a symbol.

### for-in

`forInKeys` (`phase4-for-in.js` lines 161-203, builtin **1353**) must keep skipping symbol keys before `arrayIndex` / `keyName`. The comment on line 170 is the contract. If `keyName` runs first, a symbol becomes a decimal string and for-in yields it (`conformance/INVENTORY.md` spread/for-in risk).

`forInNextBootstrap` line 98 (`typeof key !== "string"` → `__lanesUnsupported`) stays as a backstop. It is not the skip. Do not point for-in at 1240: 1240 includes non-enumerable strings and symbols, and `forInKeys` deliberately accepts wrapper prototypes that generic `ownKeys` rejects (lines 165-169).

Opcode **96** (`shader.js` lines 1560-1565) is `[[HasProperty]]`. It already walks `value.x`. It fails today because `keyOf` (lines 201-218) sets status 6 for tag 17. Extend `keyOf`, then this loop sees symbol keys. Builtin 107 (lines 1186-1189) is the own half of that.

Opcode **95** (lines 1566-1585) unlinks one node. A symbol key uses the same unlink. Do not rebuild the list. Integer indices are re-sorted only at enumeration time (`arrayIndex` selection in `ownKeys` / `forInKeys`), not stored in numeric order.

`descriptor` (builtin 110 at line 1097, builtin 101 at line 1185) updates a node in place. A new symbol is inserted at the head, like `putProperty` (lines 551). That must not reorder existing string nodes.

## GC

A symbol-keyed property roots both:

- the kind-17 cell (`mark(l, cellNode)` when `Node.key` is a packed symbol key)
- the property value (kind 3 already `markValue`s `node.value`; tag-17 values also need `symbol_mark_value`)

`collect` (`shader.js` lines 109-136) marks a string key only when `(node.key & 0xc0000000) == 0x40000000` (line 126). A packed symbol key matches the dynamic-string test unless the symbol branch runs first. Kind 20 is not a GC root. Do not drop roots 1..25. Extending the root loop for symbol nodes 26..28 belongs to the identity worker.

## Resumption

Order metadata is guest memory. `created` in this model is that stamp. On the live heap the newest-first `Node.next` list is the same metadata, because `descriptor` and `putProperty` update in place and `delete` only unlinks. `finish` tails and the heap image already survive a dispatch boundary. Do not rebuild key order on the host between resumptions. `entries.clock` / the list must be stored in the guest heap, not in a host map.

## Tests and results

`node --test experiments/quickjs-runtime/phase3/symbol-keys/symbol-keys.test.js`

25 passed, 0 failed, 0 skipped (about 121 ms). Host `Object` / `Reflect` / `Symbol` are used only inside that test, as a differential oracle. `property-key.js` does not call them.

Covered: mixed string / integer-index / symbol order; delete+readd string appends; delete+readd index re-sorts; `"1","2","10"` not insertion order; `"-1"`, `"01"`, `"1.0"`, `"-0"` are not indices; non-enumerable symbol omitted from spread and for-in, present in `ownKeys` and `getOwnPropertySymbols`; enumerable symbol copied by spread, not by for-in; `in` on an inherited symbol; two `Symbol("d")` keys; rest exclusion by identity; prototype swap keeps the child's symbol; `name` / `length` stay strings; accessor throws `Unsupported`; packed key does not collide with `n | 0x80000000` or `heapId | 0x40000000`.

WGSL was not compiled. No Dawn, no Wasm rebuild.

## Pending

- `keyOf` still returns status 6 for tag 17. `propertyKeyBootstrap` (builtin 900, `property-key-conversion-source.js` line 7) still rejects `typeof "symbol"`. ToPropertyKey must return the symbol unchanged.
- `objectMethod` has no arm for 1050, so a call falls through to status 6.
- Accessor properties are `Unsupported` in the model. Do not store them as data. Live kind 9 stays as it is.
- `sym_define` in the fragment overwrites flags in place. The live path must keep `descriptor()`'s OrdinaryDefineOwnProperty checks.
- u32 `created` wrap is not reported as a resource limit.
- Fragment buffers are `@group(1)` stand-ins (`INTEGRATION_GAPS` in `symbol-keys.wgsl`). They are not the live heap.
- No guest `Reflect` object and no new fixed node. `Reflect.ownKeys` is 1240, not a constructor property, until some other worker installs `Reflect`.

## Conflicts

- `symbol-identity.wgsl` gap 9 says symbol property keys are heap kind 20. This assignment owns kind 20 and leaves it unused. Parent should follow this file, not that gap.
- Ordinary `uniqueIdentity` values start at 1 (`symbol-cell.js`). Well-known symbols use ids 31..45 (`symbol-protocols/well-known.js`), which are also fixed node ids. Property SameValue is `id` equality, so the 31st ordinary symbol would alias `@@iterator` if both are issued in one realm. Partition the id space before wiring both. This worker does not renumber either side.
- Identity `sameValueSymbols` also checks `brand`. The guest `symbol_same_value` compares cell node and `heap[node].value.x`. Property lookup must use that id, not description text. Node-index equality alone is not enough if two cells could share an id.
- Nodes 26..28 are still kind-13 holders in the current `shader.js` init (`FIXED_NODE_ALLOC_CONFLICT` in `symbol-cell.js`). This worker does not touch that init.
- Protocols builtin ids 1100..1149 and identity ids 1000..1006 do not overlap 1050.
