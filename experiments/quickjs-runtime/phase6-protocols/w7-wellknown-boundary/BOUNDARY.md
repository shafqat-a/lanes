# Well-known protocol boundary (w7)

Shader is the source of truth (`experiments/quickjs-runtime/shader.js`). Cells 31–45 exist for every `phase3WellKnownNames` entry. Only four of those names are data properties of Symbol (node 26). `Symbol.metadata` has no cell.

`dataProperty` flags: bit0 writable, bit1 enumerable, bit2 configurable; `marked = flags << 1` (`descriptorObject` tests `flags&1u`, `flags&2u`, `flags&4u`). Array methods use `marked=10`, so flags are 5 (writable, not enumerable, configurable). Flags 4 are configurable only.

Nodes 77–79 are inside the reserved range 26–79. Installers initialize them in place and list them in `PHASE4_FIXED_ROOTS`. Nodes 66–73 and generator nodes 74–76 are reserved elsewhere and are not initialized here. Node 77 is `%IteratorPrototype%`, an internal object. It is not the `Iterator` global. The global stays in `globalUnimplementedNames`.

Installing `@@iterator` or `@@hasInstance` without replacing the chokepoints below turns today's fast paths into status 6. Removing only the two gap lines is not enough. Do not delete the node-26 gap for the other well-known names.

## Allow-list (this job)

| Protocol | Exposed on Symbol? | Installed on | Runtime | Shader site |
|---|---|---|---|---|
| iterator | yes, node 34, flags 0 | not today. Allow-list: Array.prototype node 2, same function as `values` builtin 334, flags 5; String.prototype node 20 builtin 1103, flags 5; `%IteratorPrototype%` node 77 builtin 2463 (identity), flags 5. `%ArrayIteratorPrototype%` node 78 string key `next` builtin 2460, flags 5, `@@toStringTag` `"Array Iterator"` flags 4. `%StringIteratorPrototype%` node 79 string key `next` builtin 2461, flags 5, `@@toStringTag` `"String Iterator"` flags 4 | implemented. GetIterator / `next` / IteratorClose. Intrinsic 334 (array, arguments) and 1103 (string) may keep the fast path. Any other method is a real call. Missing or non-callable method is TypeError, not status 6. Null and undefined stay TypeError (iteration kind 4) | Remove `prototypeGap` on nodes 2 and 20 (see `patches.js`). Today `phase3ChainHasIterator` (`phase3-values.js`) makes `iterationKind` return 0 (`phase4-iteration.js`), and `iteratorOpenBootstrap` calls `__lanesUnsupported` (status 6). A present property on node 2 or 20 does that for every array and string |
| hasInstance | yes, node 32, flags 0 | not today. Allow-list: Function.prototype node 3 builtin 1101, flags 4 (configurable only; ES attributes are non-configurable, flags 0 — this job uses flags 4 so delete is observable) | implemented. Resolved method 1101 runs ordinary `instanceof`. Another callable is called. Undefined after delete continues to OrdinaryHasInstance when the target is callable. A non-callable is TypeError | Remove `prototypeGap` on node 3. Today `instanceOf` (`shader.js`) sets status 6 when any `@@hasInstance` value is present, including an inherited one, before the ordinary walk. `[] instanceof Array` would become status 6 if 1101 were installed and that check stayed |
| toPrimitive | yes, node 41, flags 0 | Symbol.prototype node 27, builtin 1100, flags 4 (already installed) | implemented for a symbol and for a kind-16 symbol wrapper: 1100 ignores the hint and returns the symbol (`phase3SymbolThis`). A non-symbol receiver is TypeError (status 4). Ordinary lookup/call is allow-listed: call the method; a non-callable or an object result is TypeError | `objectMethod` `id==1100u`. Ordinary objects still hit guest `__lanesPrimitive` (129) in `comparison-source.js` `primitiveBootstrap`, which returns `__lanesUnsupported` (status 6) when `Symbol.toPrimitive` is present and does not call it. `number-source.js` does the same. Replace that chokepoint; do not leave status 6 |
| toStringTag | yes, node 42, flags 0 | data strings, flags 4: Symbol.prototype `"Symbol"`, BigInt.prototype `"BigInt"`, Math node 23 `"Math"`, JSON node 25 `"JSON"`. Allow-list adds `"Array Iterator"` on node 78 and `"String Iterator"` on node 79 | implemented when the value is a string. `Object.prototype.toString` (155) returns `"[object " + tag + "]"`. A non-string falls through to the brand switch. An accessor (tag 12) is status 6 | `objectMethod` `if(id==155u)`, key `0x60000000\|` node 42, branch `tagValue.z==7u` |
| computed method name (symbol key) | n/a | n/a | implemented. A symbol key may be the name of a method or accessor. `keyName` must not be used on a symbol key (it sets status 6) | `define_method_computed` and `set_name_computed`: `if(phase3SymbolKey(key)){states[l].status=6u;break;}`. `keyName` starts with the same status 6 |
| Symbol() | n/a (the constructor is node 26, builtin 1000) | n/a | implemented. `new Symbol` is TypeError (status 4). Registry `Symbol.for` 1001 / `Symbol.keyFor` 1002, description getter 1005, `toString` 1003, `valueOf` 1004, `typeof` tag 17 `"symbol"`. Registry node 28 kind 18. Well-known cells are not registry keys | `objectMethod` 1000–1005; `typeof` case tag 17; `symbol_init_registry_fields` |
| ordinary instanceof | n/a | walks `prototype` | implemented when `@@hasInstance` is absent or is 1101. A non-callable constructor is TypeError (status 4) | `instanceOf`, opcode `instanceof` |

## Explicit gaps (status 6 or absent — do not fake success)

These names are cells, not properties of node 26. `prototypeGap` for `id==26u` matches their string keys and `getProperty` sets status 6. That gap stays. Do not add them to `symbolExposures`.

| Protocol | Exposed on Symbol? | Installed on | Runtime | Shader site |
|---|---|---|---|---|
| asyncIterator | no (node 31) | not installed | status 6 | `prototypeGap` `id==26u` filter over `phase3WellKnownNames` excluding iterator, hasInstance, toPrimitive, toStringTag |
| isConcatSpreadable | no (node 33) | not installed | status 6 | same node-26 `prototypeGap`. Do not treat a missing property on an array as a successful species/concat protocol |
| match | no (node 35) | not installed | status 6 | node-26 `prototypeGap`. `string-search` does not read `@@match` |
| matchAll | no (node 36) | not installed | status 6 | node-26 `prototypeGap` |
| replace | no (node 37) | not installed | status 6 | node-26 `prototypeGap` |
| search | no (node 38) | not installed | status 6 | node-26 `prototypeGap` |
| species | no (node 39) | not installed (1102 is not installed) | status 6 | node-26 `prototypeGap` |
| split | no (node 40) | not installed | status 6 | node-26 `prototypeGap` |
| unscopables | no (node 43) | not installed | status 6 | node-26 `prototypeGap`. No `with` opcode |
| dispose | no (node 44) | not installed | status 6 | node-26 `prototypeGap` |
| asyncDispose | no (node 45) | not installed | status 6 | node-26 `prototypeGap` |
| metadata | no (no cell, not in `phase3WellKnownNames`) | absent | absent on Get (`undefined`, not a forged symbol). `ownKeys` of node 26 is status 6 | `ownKeys` rejects object ids 26, 29, 30, and 47. Do not create `Symbol.metadata` |
| RegExp | no | absent | status 6 | `globalUnimplementedNames` / `globalGap` (node 65) |
| Map | no | absent | status 6 | `globalGap` |
| Set | no | absent | status 6 | `globalGap` |
| Promise | no | absent | status 6 | `globalGap` |
| Proxy | no | absent | status 6 | `globalGap` |
| Iterator global | no | absent. Node 77 is not this constructor | status 6 | `globalUnimplementedNames` includes `Iterator` |
| JSON symbol keys | n/a | n/a | omitted. Not implemented as inclusion | `json-stringify-source.js` `__lanesOwnKeys(item,true)`. `objectMethod` `includeSymbols=id==140u&&!truth(b)`. `ownKeys` writes symbols only in `if(includeSymbols)`. Do not change this |
| JSON.stringify of a symbol value or a bigint | n/a | n/a | pending, separate. Bigint serialization is status 6. Do not claim symbol-value JSON here | `json-stringify-source.js`: bigint branches call `__lanesUnsupported`; `text` throws TypeError on `typeof "symbol"` / status 6 on bigint text |
| BigInt division, remainder, bitwise, decimal toString | n/a | BigInt.prototype `toString` is 1151 | status 6 | two-bigint `div`/`mod`/`and`/`or`/`xor`/`shl`/`sar`/`shr` set status 6 (only sub and mul run). `id==1151u` confirms the receiver then sets status 6. Do not modify these |
| Reflect methods other than ownKeys | n/a | node 47 has `ownKeys` builtin 1051 only, plus `name` | status 6 for apply, construct, defineProperty, deleteProperty, get, getOwnPropertyDescriptor, getPrototypeOf, has, isExtensible, preventExtensions, set, setPrototypeOf. `ownKeys` is implemented (`ownKeys(..., false, true)`, symbols included) | `prototypeGap` `id==47u`. `toString` is not in that gap |

## Gap lines this job removes

Quoted from `shader.js` `prototypeGap`. After removal, a deleted Array/String `@@iterator` or Function `@@hasInstance` is a miss (`undefined`), not status 6.

```
if((id==2u||id==20u)&&key==(0x60000000u|${PHASE3_NODES.iterator}u)){return true;}
if(id==3u&&key==(0x60000000u|${phase3HasInstanceNode}u)){return true;}
```

The node-26 filter and the Reflect filter stay.
