# W4 intrinsic iterators

Real Array Iterator and String Iterator objects. This worker does not allocate heap nodes and does not install `@@iterator` on `Array.prototype`, `String.prototype`, or arguments objects. Kinds 53, 54, and 55 are unused. Iterators are not reported with `__lanesUnsupported`. BigInt-to-string stays unsupported because that conversion is owned elsewhere (`__lanesUnsupported("BigInt to string is unsupported")`).

## Required fixed nodes

Parent writes these in place. They are inside the reserved range 26..79 and are excluded from the free list. Do not `alloc` them. Nodes 66..73 belong to the collections wave. Nodes 74..76 are the generator prototypes and constructor placeholder. This job uses 77..79 only.

| node | intrinsic | [[Prototype]] | kind |
| --- | --- | --- | --- |
| 77 | `%IteratorPrototype%` | Object.prototype (node 1) | 2 ordinary |
| 78 | `%ArrayIteratorPrototype%` | node 77 | 2 ordinary |
| 79 | `%StringIteratorPrototype%` | node 77 | 2 ordinary |

```wgsl
states[l].heap[77]=Node(V(1u,0u,0u,1u),0u,0u,2u,0u);
states[l].heap[78]=Node(V(77u,0u,0u,1u),0u,0u,2u,0u);
states[l].heap[79]=Node(V(77u,0u,0u,1u),0u,0u,2u,0u);
```

`value` is `(prototype, 0, 0, extensible)`. Once `kind != 0`, the existing collect loop over `FIXED_RESERVED_FIRST..FIXED_RESERVED_LAST` roots them. Initialize before `dataProperty`, or the property nodes are not reachable from a root. They are also listed in `PHASE4_FIXED_ROOTS`.

Node 77 is not the `Iterator` global. That global stays unimplemented.

## Properties the parent installs

`dataProperty` flags: bit0 writable, bit1 enumerable, bit2 configurable (`marked = flags << 1`). Do not install `Array.prototype[@@iterator]`, `String.prototype[@@iterator]`, or the arguments own `@@iterator` here. Those are parent wiring: builtin 334 on node 2 and on arguments objects, builtin 1103 on node 20.

| node | key | value | flags |
| --- | --- | --- | --- |
| 77 | `@@iterator` (well-known cell 34, key `0x60000000\|34`) | builtin 2463 `iteratorIdentity` | 5 |
| 78 | string `next` | builtin 2460 `arrayIteratorNext` | 5 |
| 79 | string `next` | builtin 2461 `stringIteratorNext` | 5 |
| 78 | `@@toStringTag` (cell 42) | data string `"Array Iterator"` | 4 |
| 79 | `@@toStringTag` (cell 42) | data string `"String Iterator"` | 4 |

`"next"` is not in `FIELDS` today. Add that field name before `fieldKey`. The toStringTag strings are data properties, not fixed nodes. `objectMethod` id 155 already wraps a string tag as `"[object " + tag + "]"`.

## Heap kinds

Kind 51 Array Iterator. `value.x` = prototype 78, `value.y` = kind-13 holder of the iterated object, `value.z` = next index (u32), `value.w` = kind (0 keys, 1 values, 2 entries).

Kind 52 String Iterator. `value.x` = prototype 79, `value.y` = kind-13 holder of the string, `value.z` = next UTF-16 index, `value.w` = 0.

Cleared array iterator: the holder value becomes `undef()` (tag 3). `value.y` still names the holder. The object is no longer marked, so it can be collected. Brand stays 51.

Mark, in the collect walk:

```wgsl
if(node.kind==51u||node.kind==52u){mark(l,node.value.x);mark(l,node.value.y);}
```

Kind 13 already `markValue`s its value. Do not mark `value.z` (it is an index).

`getProperty` walks `value.x`, so `next` and `@@iterator` resolve on 78/79/77. Kind 51 is not kind 7, so `value.y` is not an array length.

Known collision, not a downgrade: `putProperty` treats `value.w == 0` as non-extensible for every kind. A keys iterator (kind 0) and every string iterator (`value.w` is 0) therefore reject new own properties. Values and entries look extensible. A parent that wants spec extensibility should exempt kinds 51 and 52 in that check. This slice does not edit `putProperty`.

Index slot is a u32 via `toBits` / `fromUnsigned`. That matches exotic array lengths in this VM. A non-integer or a number above 2^32-1 fails the round-trip check with status 4. `ToLength` in the guest still clamps at 2^53-1; indexes that do not fit u32 are outside this slot.

## Builtins

Guest factories and `next` methods (bootstrap fields, strict):

| id | field | role |
| --- | --- | --- |
| 334 | `arrayValues` | `Array.prototype.values`. Existing id, `300 + arrayBuiltins.indexOf("values")`. |
| 317 | `arrayKeys` | `Array.prototype.keys` (`300 + indexOf("keys")`). |
| 303 | `arrayEntries` | `Array.prototype.entries` (`300 + indexOf("entries")`). |
| 1103 | `stringIterator` | `String.prototype[@@iterator]`. |
| 2460 | `arrayIteratorNext` | `%ArrayIteratorPrototype%.next`. |
| 2461 | `stringIteratorNext` | `%StringIteratorPrototype%.next`. |

Merge `arrayIteratorMethodSources` into `arraySources`. `arrayMethods` keeps a helper only when `arraySources` has that name.

Sync `objectMethod` ids (no guest body). Splice `iteratorObjectMethodWGSL()` before the `id>=150` unsupported fallback. Splice `iteratorWgslFunctions()` at module scope after `alloc`, `unit`, and `makeText`.

| id | name | arguments |
| --- | --- | --- |
| 2420 | `__lanesCreateArrayIterator` | object, kind. Stores the object. Does not Get elements. |
| 2421 | `__lanesCreateStringIterator` | text (tag 7). Other tags are status 6. |
| 2422 | `__lanesArrayIteratorSlot` | iterator, selector. 0 brand (false if not kind 51, no status), 1 object, 2 index, 3 kind. |
| 2423 | `__lanesArrayIteratorClear` | iterator. Holder value becomes undefined. |
| 2424 | `__lanesArrayIteratorSetIndex` | iterator, index. |
| 2425 | `__lanesStringIteratorTake` | iterator. `unit` reads one code point, then advances `value.z` by 1 or 2, returns `makeText`. |
| 2426 | `__lanesStringIteratorDone` | iterator. True when the UTF-16 index is past the string. |
| 2427 | `__lanesStringIteratorBrand` | iterator. |
| 2463 | `iteratorIdentity` | no args. Return the receiver. Tag 2 or 3 sets status 4. Do not attach a bootstrap helper; a non-zero field image would skip `objectMethod`. |

2462 and 2428..2439 and 2464..2479 are unused. 2460..2479 and 2420..2439 are this worker's ranges.

Referenced, not defined here: `__lanesToObject` 926, `__lanesNumber` 122, `__lanesPrimitive` 129, `__lanesText` 111, `__lanesUnsupported` 141.

## Algorithm

`arrayValues` / `arrayKeys` / `arrayEntries`: strict, `__lanesToObject(this)` (TypeError on null or undefined), then create with kind 1, 0, or 2. The factory does not read elements.

`arrayIteratorNext`: brand 51 or `TypeError("Array iterator expected")`. If the holder is undefined, `{value: undefined, done: true}` and do not read `length`. Otherwise `ToLength(object.length)` with the phase4-iteration.js clamp (non-number through `__lanesNumber`; `!(length > 0)` becomes 0; above 2^53-1 clamps; else truncate toward zero). If `index >= length`, clear and return done. Otherwise set the index to `index + 1` before any element read. Kind 0 returns the old index and does not Get. Kind 1 returns `object[oldIndex]`. Kind 2 returns `[oldIndex, object[oldIndex]]` (one Get). If that Get throws, the index stays advanced and the object is not cleared. The phase4 fast path cleared the record before the Get; this is the ES2025 order. Result objects are ordinary object literals (`[[Prototype]]` Object.prototype, both properties writable, enumerable, configurable).

`stringIterator`: read `this`. Null or undefined throws. A string primitive is used as the text. An object uses `__lanesPrimitive(this, true)`. A symbol throws `TypeError`. A bigint returns `__lanesUnsupported("BigInt to string is unsupported")`. Anything else is `__lanesText`, then create.

`stringIteratorNext`: brand 52 or `TypeError("String iterator expected")`. Done when the index is past the string; the holder is not cleared (the string length does not change, so later calls stay done). Otherwise take one code point. Lead U+D800..U+DBFF followed by trail U+DC00..U+DFFF advances by 2. A lone surrogate advances by 1. The read is `unit`, not `String.prototype.charCodeAt`.

`iteratorIdentity`: return this object. Null or undefined is status 4, not a guest `throw`.
